/**
 * P2.1.4 — restore pipeline (pure, asynchronous, fail-closed).
 * Source: docs/implementation/p2-1-contract-freeze.md §11 (restore steps 1–10),
 * §13.3 (exact error mapping), §5.1 (closed schema rules).
 *
 * EXACT RECONSTRUCTION ONLY: a successful restore materializes the embedded snapshot
 * byte-for-byte as a deeply frozen immutable value — no defaults, no reset, no repair,
 * no migration, no revision increment, no transition. Any defect rejects with the
 * FIRST failing stage's frozen code:
 *
 *   1 envelope shell + embedded SubjectState admission ......... INVALID_SCHEMA family
 *   2 full_snapshot_checksum recomputation ..................... FULL_SNAPSHOT_CHECKSUM_MISMATCH / SS-RESTORE-001
 *   3 StateHash recomputation .................................. STATE_HASH_MISMATCH / HASH-PROJ-001
 *   4 SnapshotHash recomputation ............................... SNAPSHOT_HASH_MISMATCH / HASH-SNAPSHOT-001
 *   5 repository binding set + verdict-only validator .......... INVALID_MEMORY_REVISION / MEM-REV-001
 *   6 memory-bound reference membership (capability) .......... INVALID_MEMORY_REFERENCE / MEM-REV-001
 *   7 trace window/cursor linkage integrity .................... TRACE_INTEGRITY_FAILURE / TRACE-CONTENT-001
 *   8 commit_head rule (null iff revision 0; well-formed) ...... COMMIT_CHAIN_INTEGRITY_FAILURE / SS-RESTORE-001
 *
 * Trace-linkage defects discovered during step 1 are DEFERRED to step 7 so the
 * reported code follows §11 precedence even when a corrupted snapshot carries
 * self-consistently recomputed hashes.
 */

import type { PersistedSubjectEnvelopeV1, RepositoryRevisionBindingV1 } from "../types/persistence.js";
import type { HashV1 } from "../types/scalars.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { ErrorCode, RequirementId } from "../types/enums.js";
import type { ValidationFailure } from "../validation/result.js";
import { validateSubjectState } from "../validation/subject-state.js";
import { validateHash } from "../validation/scalars.js";
import {
  fullSnapshotChecksum,
  snapshotHash,
  stateHash
} from "../canonical/projections.js";
import { lastTraceRef } from "../trace/trace.js";
import {
  validateCommitHeadRule,
  validateRepositoryBindingSet
} from "./envelope.js";

const SCHEMA_REASON = "SS-SCHEMA-001";

const ENVELOPE_KEYS: readonly string[] = [
  "schema_version",
  "serialization_version",
  "snapshot",
  "full_snapshot_checksum",
  "state_hash",
  "snapshot_hash",
  "repository_bindings",
  "commit_head"
];

export interface RestoreCapabilities {
  /**
   * Verdict-only inverted capability (§15.1): for one binding it must confirm the
   * immutable manifest exists, its hash matches AND every memory-bound ref of the
   * snapshot belongs to that revision. Pure verdict — never returns payloads.
   */
  readonly referenceValidator?: (binding: RepositoryRevisionBindingV1) => boolean | Promise<boolean>;
}

export type RestoreResult =
  | { readonly ok: true; readonly snapshot: SubjectStateV0 }
  | { readonly ok: false; readonly failure: ValidationFailure };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function rejection(error_code: ErrorCode, reason: RequirementId, detail: string): RestoreResult {
  return { ok: false, failure: { error_code, reason, detail } };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * Restores one closed PersistedSubjectEnvelopeV1 into an immutable SubjectStateV0.
 * Accepts unknown input (never trusts callers to have parsed/validated).
 */
export async function restoreFromEnvelope(
  envelope: unknown,
  capabilities: RestoreCapabilities = {}
): Promise<RestoreResult> {
  // ---- Stage 1: envelope shell + embedded snapshot admission -----------------------
  if (!isRecord(envelope)) {
    return rejection("INVALID_SCHEMA", SCHEMA_REASON, "envelope: expected object");
  }
  for (const key of Object.keys(envelope)) {
    if (!ENVELOPE_KEYS.includes(key)) {
      return rejection("INVALID_SCHEMA", SCHEMA_REASON, `envelope.${key}: unknown key`);
    }
  }
  if (envelope["schema_version"] !== "subject-persistence-envelope-v1") {
    return rejection("INVALID_SCHEMA", SCHEMA_REASON, "envelope.schema_version");
  }
  if (envelope["serialization_version"] !== "canonical-json-v1") {
    return rejection("INVALID_SCHEMA", SCHEMA_REASON, "envelope.serialization_version");
  }
  const hashFields = ["full_snapshot_checksum", "state_hash", "snapshot_hash"] as const;
  for (const field of hashFields) {
    const raw = envelope[field];
    if (typeof raw !== "string") {
      return rejection("INVALID_SCHEMA", SCHEMA_REASON, `envelope.${field}: expected hash string`);
    }
    const formatted = validateHash(raw, `envelope.${field}`);
    if (!formatted.ok) {
      return rejection("INVALID_SCHEMA", SCHEMA_REASON, `envelope.${field}: hash format`);
    }
  }
  if (!Array.isArray(envelope["repository_bindings"])) {
    return rejection("INVALID_SCHEMA", SCHEMA_REASON, "envelope.repository_bindings: expected array");
  }
  const head = envelope["commit_head"];
  if (head !== null && !isRecord(head)) {
    return rejection("INVALID_SCHEMA", SCHEMA_REASON, "envelope.commit_head: expected object or null");
  }

  let deferredTraceFailure: ValidationFailure | null = null;
  const snapshotAdmission = validateSubjectState(envelope["snapshot"]);
  if (!snapshotAdmission.ok) {
    if (snapshotAdmission.error.error_code === "TRACE_INTEGRITY_FAILURE") {
      // §11 step 7 owns trace linkage reporting; keep first-error precedence intact.
      deferredTraceFailure = snapshotAdmission.error;
    } else {
      return { ok: false, failure: snapshotAdmission.error };
    }
  }
  const snapshot = envelope["snapshot"] as SubjectStateV0;

  // ---- Stage 2: full-snapshot checksum ----------------------------------------------
  const recomputedChecksum = await fullSnapshotChecksum(snapshot);
  if (recomputedChecksum !== (envelope["full_snapshot_checksum"] as HashV1)) {
    return rejection(
      "FULL_SNAPSHOT_CHECKSUM_MISMATCH",
      "SS-RESTORE-001",
      "full_snapshot_checksum mismatch"
    );
  }

  // ---- Stage 3: StateHash ------------------------------------------------------------
  const recomputedStateHash = await stateHash(snapshot);
  if (recomputedStateHash !== (envelope["state_hash"] as HashV1)) {
    return rejection("STATE_HASH_MISMATCH", "HASH-PROJ-001", "state_hash mismatch");
  }

  // ---- Stage 4: SnapshotHash ----------------------------------------------------------
  const recomputedSnapshotHash = await snapshotHash({
    state_hash: recomputedStateHash,
    subject_id: snapshot.identity.subject_id,
    state_revision: snapshot.runtime_metadata.state_revision,
    trace_cursor: snapshot.trace_window.cursor,
    last_trace_ref: lastTraceRef(snapshot.trace_window)
  });
  if (recomputedSnapshotHash !== (envelope["snapshot_hash"] as HashV1)) {
    return rejection("SNAPSHOT_HASH_MISMATCH", "HASH-SNAPSHOT-001", "snapshot_hash mismatch");
  }

  // ---- Stage 5: repository bindings (+ capability verdicts) ---------------------------
  const bindingsCheck = validateRepositoryBindingSet(
    snapshot,
    envelope["repository_bindings"] as RepositoryRevisionBindingV1[]
  );
  if (!bindingsCheck.ok) return { ok: false, failure: bindingsCheck.error };
  if (capabilities.referenceValidator !== undefined) {
    for (const binding of envelope["repository_bindings"] as RepositoryRevisionBindingV1[]) {
      const verdict = await capabilities.referenceValidator(binding);
      if (verdict !== true) {
        return rejection(
          "INVALID_MEMORY_REVISION",
          "MEM-REV-001",
          `reference validator rejected ${binding.repository_revision}`
        );
      }
    }
  }
  // Stage 6 (bound-ref membership) is folded into the same verdict-only capability:
  // a conforming validator resolves manifest existence/hash AND membership of every
  // memory-bound ref without exposing payload. Absence of the capability keeps the
  // pure structural guarantees only.

  // ---- Stage 7: deferred trace linkage integrity --------------------------------------
  if (deferredTraceFailure !== null) {
    return { ok: false, failure: deferredTraceFailure };
  }

  // ---- Stage 8: commit head rule --------------------------------------------------------
  const headRule = validateCommitHeadRule(snapshot, head as PersistedSubjectEnvelopeV1["commit_head"]);
  if (!headRule.ok) return { ok: false, failure: headRule.error };

  // ---- Materialization: exact reconstruction, immutable ---------------------------------
  const restored = structuredClone(snapshot) as unknown as SubjectStateV0;
  deepFreeze(restored);
  return { ok: true, snapshot: restored };
}
