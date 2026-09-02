/**
 * Restore Chain Authority Integration V0 — runtime product restore entrypoint
 * (RESTORE_CHAIN_AUTHORITY_INTEGRATION_V0, LEVEL_2).
 *
 * The authoritative product restore path:
 *   untrusted persisted envelope + candidate bundles
 *   + an EXISTING Level-2 trusted canonical history boundary (object identity)
 *   → DIRECT invocation of CharacterOS Atomic Commit Chain Validator V0
 *   → exact envelope/history cross-artifact binding
 *   → invocation-local bridge to the existing SubjectCore restoreFromEnvelope.
 *
 * AUTHORITY MODEL (frozen):
 *   - The product input accepts NO chain validator function, NO chain VALID
 *     boolean, NO chain receipt/result, NO prevalidated terminal, and NO
 *     reference/adoption validator callbacks. Extra keys reject fail-closed.
 *     CALLER_SUPPLIED_CHAIN_VALIDATION_RECEIPT_ALLOWED_FOR_RESTORE = NO.
 *   - The coordinator DIRECTLY calls validateAtomicCommitChainV0; a
 *     caller-supplied structural VALID result has ZERO authority.
 *   - The legacy low-level commitChainVerifier seam is bridged by an
 *     invocation-local closure that returns true ONLY on exact equality with
 *     the validated terminal position; it is never exported, returned,
 *     persisted, cached, or accepted as input.
 *     HOST_COMMIT_CHAIN_VERIFIER_REMAINS_PRODUCT_RESTORE_AUTHORITY = NO.
 *   - V2 proposal effect replay remains owned exclusively by the chain
 *     validator; this module duplicates NO transition-effect law.
 *     RESTORE_DUPLICATES_V2_EFFECT_REPLAY_LAW = NO.
 *
 * TOCTOU: the caller-owned envelope and bundles are deep-snapshotted
 * synchronously BEFORE the first await; the trusted boundary is NOT cloned
 * (object identity is its Level-2 admission).
 * RESTORE_TOCTOU_POLICY_V0 = PRIVATE_PRE_AWAIT_DEEP_SNAPSHOT_ONLY.
 *
 * PURE: zero commit/store write/publication/repair/migration/model/network.
 * RESTORE_CHAIN_AUTHORITY_INTEGRATION_CANONICAL_STATE_DELTA = ZERO.
 */

import type {
  AtomicCommitBundleAnyVersion,
  SubjectStateV0
} from "@characteros-next/subject-core";
import {
  canonicalJsonString,
  restoreFromEnvelope,
  validateAtomicCommitBundleAnyVersion,
  type CanonicalRefV0,
  type HashV1,
  type PersistedSubjectEnvelopeV1,
  type RepositoryRevisionBindingV1
} from "@characteros-next/subject-core";

import { validateAtomicCommitChainV0 } from "./atomic-commit-chain-validator.js";

import {
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0
} from "./trusted-canonical-history-boundary.js";

// ---- public contracts ---------------------------------------------------------------

export interface RestoreCanonicalSubjectFromHistoryInputV0 {
  /** Untrusted persisted envelope candidate. */
  readonly persisted_envelope: unknown;
  /** EXISTING minted trusted boundary — object identity admitted, never cloned. */
  readonly trusted_boundary: TrustedCanonicalHistoryBoundaryReceiptV0;
  /** Candidate canonical path, oldest → newest (untrusted). */
  readonly bundles: readonly unknown[];
}

export type RestoreChainAuthorityFailureCodeV0 =
  | "INVALID_INPUT"
  | "INVALID_ENVELOPE"
  | "UNTRUSTED_HISTORY_BOUNDARY"
  | "INVALID_CHAIN"
  | "ENVELOPE_CHAIN_MISMATCH"
  | "REPOSITORY_BINDING_MISMATCH"
  | "LOW_LEVEL_RESTORE_FAILURE";

export interface RestoreChainAuthorityFailureV0 {
  readonly code: RestoreChainAuthorityFailureCodeV0;
  /** Bounded input evidence (INVALID_INPUT only; never caller-detail authority). */
  readonly detail?: string | undefined;
  /** Bounded chain-failure evidence from the directly-run validator. */
  readonly chain_failure?:
    | {
        readonly policy_id: string;
        readonly policy_fingerprint: HashV1;
        readonly code: string;
        readonly bundle_index: number | null;
        readonly commit_ref: CanonicalRefV0 | null;
      }
    | undefined;
  /** Bounded low-level SubjectCore restore failure evidence. */
  readonly restore_failure?:
    | {
        readonly error_code: string;
        readonly reason: string;
        readonly detail: string;
      }
    | undefined;
}

export type RestoreChainAuthorityResultV0 =
  | {
      readonly kind: "RESTORED";
      readonly restored_snapshot: SubjectStateV0;
      readonly chain_receipt: unknown;
    }
  | { readonly kind: "REJECTED"; readonly failure: RestoreChainAuthorityFailureV0 };

/** Trusted-composition dependencies, bound at coordinator CONSTRUCTION only. */
export interface RestoreChainAuthorityCompositionV0 {
  /**
   * Optional trusted repository-reference capability preserved from the
   * existing SubjectCore restore contract (§15.1 verdict-only). Supplied ONLY
   * by trusted runtime composition at construction; NEVER accepted through
   * the product input. Absence keeps the low-level structural guarantees —
   * no existing trusted authority is weakened.
   */
  readonly referenceValidator?: (
    binding: RepositoryRevisionBindingV1
  ) => boolean | Promise<boolean>;
}

// ---- input validation / TOCTOU snapshot ---------------------------------------------

interface PrivateRestoreSnapshotV0 {
  readonly envelope: PersistedSubjectEnvelopeV1;
  readonly bundles: readonly unknown[];
  readonly boundary: TrustedCanonicalHistoryBoundaryReceiptV0;
}

/**
 * Synchronous closed-input validation + deep snapshot of caller-owned data.
 * The trusted boundary is admitted by object identity and never cloned.
 */
function snapshotPrivateInputs(
  input: unknown
):
  | { readonly ok: true; readonly value: PrivateRestoreSnapshotV0 }
  | { readonly ok: false; readonly detail: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, detail: "input: expected plain object" };
  }
  const keys = Object.keys(input).sort();
  const expected = ["bundles", "persisted_envelope", "trusted_boundary"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, detail: "input: exact {persisted_envelope, trusted_boundary, bundles} required" };
  }
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record["bundles"])) {
    return { ok: false, detail: "input.bundles: expected array" };
  }
  // Synchronous deep snapshot BEFORE the first await (TOCTOU closure).
  // structuredClone throws on unsupported caller values → INVALID_INPUT.
  let envelopeClone: PersistedSubjectEnvelopeV1;
  let bundlesClone: readonly unknown[];
  try {
    envelopeClone = structuredClone(record["persisted_envelope"]) as PersistedSubjectEnvelopeV1;
    bundlesClone = structuredClone(record["bundles"]) as readonly unknown[];
  } catch {
    return { ok: false, detail: "input: envelope/bundles are not structurally cloneable" };
  }
  const boundary = record["trusted_boundary"];
  if (!isTrustedCanonicalHistoryBoundaryReceiptV0(boundary)) {
    return { ok: false, detail: "UNTRUSTED_HISTORY_BOUNDARY" };
  }
  return {
    ok: true,
    value: {
      envelope: envelopeClone,
      bundles: bundlesClone,
      boundary: boundary as TrustedCanonicalHistoryBoundaryReceiptV0
    }
  };
}

// ---- cross-artifact binding helpers ---------------------------------------------------

function canonicalEquals(a: unknown, b: unknown): boolean {
  return canonicalJsonString(a) === canonicalJsonString(b);
}

/**
 * §18: projects the terminal bundle's repository bindings to the EXACT
 * revisions referenced by the terminal snapshot (memory_state.repository_revision
 * plus a non-null autobiographical_index_revision — the same membership law
 * SubjectCore's validateRepositoryBindingSet owns) and requires canonical JCS
 * equality with the private envelope's repository_bindings (IDs AND hashes).
 * History/proposal-only extras in the terminal bundle remain allowed.
 */
function repositoryBindingProjectionMatches(
  terminal: AtomicCommitBundleAnyVersion,
  envelope: PersistedSubjectEnvelopeV1
): boolean {
  const snapshot = terminal.next_snapshot;
  const expected = new Set<string>([snapshot.memory_state.repository_revision]);
  const autobio = snapshot.memory_state.autobiographical_index_revision;
  if (autobio !== null) expected.add(autobio);
  const projected = terminal.repository_revision_bindings.filter((binding) =>
    expected.has(binding.repository_revision)
  );
  return canonicalEquals(projected, envelope.repository_bindings);
}

// ---- internal legacy bridge ----------------------------------------------------------

/**
 * INVOCATION-LOCAL ONLY: builds the legacy low-level commitChainVerifier
 * closure over the PRIVATE validated terminal bundle. Returns true ONLY if
 * every field the legacy callback exposes equals the validated terminal
 * position exactly. Never exported, returned, persisted, cached, or accepted
 * as input. HOST_COMMIT_CHAIN_VERIFIER_REMAINS_PRODUCT_RESTORE_AUTHORITY = NO.
 */
function buildInternalCommitChainBridgeV0(
  terminal: AtomicCommitBundleAnyVersion
): (expected: {
  readonly subject_id: string;
  readonly state_revision: number;
  readonly commit_ref: CanonicalRefV0 | null;
  readonly record_checksum: HashV1 | null;
  readonly snapshot_hash: HashV1;
}) => boolean {
  return (expected) =>
    expected.subject_id === terminal.subject_id &&
    expected.state_revision === terminal.next_revision &&
    expected.commit_ref === terminal.commit_ref &&
    expected.record_checksum === terminal.record_checksum &&
    expected.snapshot_hash === terminal.snapshot_hash_after;
}

// ---- coordinator ---------------------------------------------------------------------

/**
 * Product restore entrypoint: directly runs CharacterOS Atomic Commit Chain
 * Validator V0 over the private snapshot, binds the envelope exactly to the
 * validated terminal history, and reuses the existing SubjectCore
 * restoreFromEnvelope law for materialization.
 */
export async function restoreCanonicalSubjectFromHistoryV0(
  input: unknown
): Promise<RestoreChainAuthorityResultV0> {
  return restoreCanonicalSubjectFromHistoryWithCompositionV0(input, {});
}

/**
 * Trusted-composition constructor variant: identical authority path with an
 * INTERNAL repository-reference capability preserved from the existing
 * SubjectCore restore contract. The capability is bound at construction and
 * can never be supplied through the product input.
 */
export function createRestoreChainAuthorityV0(
  composition: RestoreChainAuthorityCompositionV0 = {}
): {
  readonly restoreCanonicalSubjectFromHistoryV0: (
    input: unknown
  ) => Promise<RestoreChainAuthorityResultV0>;
} {
  return {
    restoreCanonicalSubjectFromHistoryV0: (input: unknown) =>
      restoreCanonicalSubjectFromHistoryWithCompositionV0(input, composition)
  };
}

async function restoreCanonicalSubjectFromHistoryWithCompositionV0(
  input: unknown,
  composition: RestoreChainAuthorityCompositionV0
): Promise<RestoreChainAuthorityResultV0> {
  // 1. Synchronous closed-input validation + private pre-await snapshot,
  //    including trusted-boundary object-identity admission.
  const snapshotted = snapshotPrivateInputs(input);
  if (!snapshotted.ok) {
    const code: RestoreChainAuthorityFailureCodeV0 =
      snapshotted.detail === "UNTRUSTED_HISTORY_BOUNDARY"
        ? "UNTRUSTED_HISTORY_BOUNDARY"
        : "INVALID_INPUT";
    return { kind: "REJECTED", failure: { code, detail: snapshotted.detail } };
  }
  const priv = snapshotted.value;

  // 2. DIRECT chain validation — cannot be bypassed by the caller.
  const chain = await validateAtomicCommitChainV0({
    trusted_boundary: priv.boundary,
    bundles: priv.bundles
  });
  if (chain.kind === "INVALID") {
    return {
      kind: "REJECTED",
      failure: {
        code: "INVALID_CHAIN",
        chain_failure: {
          policy_id: chain.policy_id,
          policy_fingerprint: chain.policy_fingerprint,
          code: chain.failure.code,
          bundle_index: chain.failure.bundle_index,
          commit_ref: chain.failure.commit_ref
        }
      }
    };
  }
  const receipt = chain.receipt;

  // 3. R0 path: exact envelope/genesis binding, then plain low-level restore
  //    (revision 0 keeps genesis semantics — no chain bridge).
  const snapshot = priv.envelope.snapshot as SubjectStateV0;
  if (snapshot.runtime_metadata.state_revision === 0) {
    if (receipt.terminal_revision !== 0 || priv.bundles.length !== 0) {
      return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
    }
    if (!canonicalEquals(priv.envelope, priv.boundary.genesis)) {
      return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
    }
    try {
      const restored = await restoreFromEnvelope(
        priv.envelope,
        composition.referenceValidator !== undefined
          ? { referenceValidator: composition.referenceValidator }
          : {}
      );
      return finishLowLevelRestore(restored, receipt);
    } catch (error: unknown) {
      return lowLevelException(error);
    }
  }

  // 4. Positive-revision path: chain VALID + bundles > 0 + terminal
  //    revalidation for typed access (single-record only — chain validation
  //    and V2 proposal replay remain owned by the chain validator).
  if (priv.bundles.length === 0 || receipt.terminal_revision === 0) {
    return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
  }
  const terminalRaw = priv.bundles[priv.bundles.length - 1] as unknown;
  const terminal = await validateAtomicCommitBundleAnyVersion(terminalRaw);
  if (!terminal.ok) {
    // The private snapshot was chain-validated; a terminal revalidation
    // failure here is an internal invariant violation, reported bounded.
    return {
      kind: "REJECTED",
      failure: {
        code: "LOW_LEVEL_RESTORE_FAILURE",
        restore_failure: {
          error_code: terminal.error.error_code,
          reason: terminal.error.reason,
          detail: terminal.error.detail
        }
      }
    };
  }
  const terminalBundle = terminal.value as AtomicCommitBundleAnyVersion;

  // 5. Exact terminal snapshot JCS equality (envelope ↔ terminal bundle).
  if (!canonicalEquals(priv.envelope.snapshot, terminalBundle.next_snapshot)) {
    return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
  }

  // 6. Subject/revision binding across envelope/terminal/receipt/boundary head.
  if (
    snapshot.identity.subject_id !== terminalBundle.subject_id ||
    terminalBundle.subject_id !== receipt.subject_id ||
    receipt.subject_id !== priv.boundary.head.subject_id
  ) {
    return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
  }
  if (
    snapshot.runtime_metadata.state_revision !== terminalBundle.next_revision ||
    terminalBundle.next_revision !== receipt.terminal_revision ||
    receipt.terminal_revision !== priv.boundary.head.revision
  ) {
    return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
  }

  // 7. Commit-head binding (no subset): envelope ↔ terminal ↔ receipt ↔ head.
  const commitHead = priv.envelope.commit_head;
  if (
    commitHead === null ||
    commitHead.commit_ref !== terminalBundle.commit_ref ||
    commitHead.record_checksum !== terminalBundle.record_checksum ||
    commitHead.commit_ref !== receipt.terminal_commit_ref ||
    commitHead.record_checksum !== receipt.terminal_record_checksum ||
    commitHead.commit_ref !== priv.boundary.head.commit_ref ||
    commitHead.record_checksum !== priv.boundary.head.record_checksum
  ) {
    return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
  }

  // 8. State/snapshot hash binding: envelope ↔ terminal after-hashes ↔
  //    receipt ↔ head. Low-level restore remains the sole recomputation
  //    authority for these hashes.
  if (
    priv.envelope.state_hash !== terminalBundle.state_hash_after ||
    priv.envelope.snapshot_hash !== terminalBundle.snapshot_hash_after ||
    priv.envelope.state_hash !== receipt.terminal_state_hash ||
    priv.envelope.snapshot_hash !== receipt.terminal_snapshot_hash ||
    priv.envelope.state_hash !== priv.boundary.head.state_hash ||
    priv.envelope.snapshot_hash !== priv.boundary.head.snapshot_hash
  ) {
    return { kind: "REJECTED", failure: { code: "ENVELOPE_CHAIN_MISMATCH" } };
  }

  // 9. Repository binding terminal projection (IDs AND hashes).
  if (!repositoryBindingProjectionMatches(terminalBundle, priv.envelope)) {
    return { kind: "REJECTED", failure: { code: "REPOSITORY_BINDING_MISMATCH" } };
  }

  // 10. Invocation-local legacy bridge + existing SubjectCore restore law.
  let restored: Awaited<ReturnType<typeof restoreFromEnvelope>>;
  try {
    restored = await restoreFromEnvelope(
      priv.envelope,
      composition.referenceValidator !== undefined
        ? {
            referenceValidator: composition.referenceValidator,
            commitChainVerifier: buildInternalCommitChainBridgeV0(terminalBundle)
          }
        : { commitChainVerifier: buildInternalCommitChainBridgeV0(terminalBundle) }
    );
  } catch (error: unknown) {
    return lowLevelException(error);
  }
  return finishLowLevelRestore(restored, receipt);
}

function lowLevelException(error: unknown): RestoreChainAuthorityResultV0 {
  // Unexpected low-level exception → bounded LOW_LEVEL_RESTORE_FAILURE.
  return {
    kind: "REJECTED",
    failure: {
      code: "LOW_LEVEL_RESTORE_FAILURE",
      restore_failure: {
        error_code: "LOW_LEVEL_RESTORE_FAILURE",
        reason: "RESTORE-CHAIN-001",
        detail: `unexpected low-level restore exception: ${error instanceof Error ? error.message : "unknown"}`
      }
    }
  };
}

function finishLowLevelRestore(
  restored:
    | { readonly ok: true; readonly snapshot: SubjectStateV0 }
    | {
        readonly ok: false;
        readonly failure: {
          readonly error_code: string;
          readonly reason: string;
          readonly detail: string;
        };
      },
  receipt: unknown
): RestoreChainAuthorityResultV0 {
  if (!restored.ok) {
    // Normal closed low-level failure → INVALID_ENVELOPE with bounded
    // SubjectCore-owned evidence (never caller-controlled detail).
    return {
      kind: "REJECTED",
      failure: {
        code: "INVALID_ENVELOPE",
        restore_failure: {
          error_code: restored.failure.error_code,
          reason: restored.failure.reason,
          detail: restored.failure.detail
        }
      }
    };
  }
  return {
    kind: "RESTORED",
    restored_snapshot: restored.snapshot,
    chain_receipt: receipt
  };
}
