/**
 * P2.3.5.3b — ExperienceEncoderV0: the deterministic reference mapping
 *
 *   TrustedLearningExperienceV0 → EpisodicMemoryRecordV0
 *
 * frozen by docs/implementation/p2-3-5-learning-v0-reference-contract.md §6
 * (exact field mapping), §6.1 (episode_ref derivation), §7
 * (WRITE_CARDINALITY_V0 = EXACTLY_ONE_RECORD_PER_VALID_LEARNING — no salience
 * gate, no filter, no expansion), §9/§13 (frozen identity derivations reused
 * verbatim), §16 (logical time). Commit 0e11e62.
 *
 * TRUST GATE (mandatory, runtime): `isTrustedLearningExperience(input)` must be
 * true before ANY record construction. A TypeScript annotation is not a trust
 * capability; structurally identical plain objects, JSON clones,
 * structuredClones, spreads, descriptor copies and deep-frozen fakes are all
 * rejected fail-closed. There is NO unchecked encoder path.
 *
 * PURE TRANSFORMATION: permitted inputs are ONLY the trusted experience plus
 * the narrow deterministic encoding context (canonical logical time for
 * `recorded_at_logical_time`; the contract-frozen Learning identity basis
 * {expected_state_revision, rebuild_ordinal} consumed by the frozen transition-id
 * derivation; and the opaque prepare-identity component consumed by the frozen
 * §6.1 episode-ref projection). Forbidden dependencies: MemoryRepository /
 * MemoryPreparationAuthority / SubjectCore / AtomicCommitStore / wall clock /
 * randomness / LLM / full SubjectState. No Date.now, new Date, Math.random,
 * randomUUID or process-local counters.
 *
 * IDENTITY BOUNDARY (scope-corrected in isolation): this module implements the
 * frozen learning-transition-id derivation (§13) and the frozen episode-ref
 * composition (§6.1) — both belong to the encoded record lifecycle. The
 * memory prepare-intent derivation itself is a REPOSITORY-PREPARE concern
 * (P2.3.5.3c): its minted identifier reaches the episode-ref projection ONLY
 * as an opaque component of the encoding context; no intent object is ever
 * constructed, hashed as an entity, allocated or registered here. Those begin
 * in P2.3.5.3c.
 *
 * FUTURE CONSUMER RULE: encoding does NOT persist trust. The WeakSet authority
 * marker is runtime-only and intentionally disappears across serialization,
 * cloning, IPC and process restart; after crash/restart the host re-supplies
 * the candidate and the system reruns durable validation. Record bytes depend
 * on canonical visible trusted DATA only — never on registry internals (two
 * independently validated equivalent trusted objects encode byte-identically).
 */

import type { CanonicalRefV0, LogicalTimeV0, StateRevisionV0 } from "@characteros-next/subject-core";
import { hashEnvelope, isString } from "@characteros-next/subject-core";
import {
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  validateEpisodicMemoryRecord,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import { isTrustedLearningExperience } from "./learning-source-authority.js";
import { deriveLearningTransitionId } from "./learning-identity.js";

/** Domain-separated episode-ref projection EXACTLY as frozen by the contract. */
const EPISODE_REF_PROJECTION =
  "characteros-next/memory/episode-ref/v1" as const;

/**
 * Narrow deterministic encoding context (contract §4 "encoding context if
 * required"): everything the pure transformation needs that is NOT part of the
 * trusted experience itself. Closed shape; nothing else may be passed.
 */
export interface LearningEncodingContextV0 {
  /** Canonical logical time at encoding read — becomes recorded_at_logical_time. */
  readonly current_logical_time: LogicalTimeV0;
  /** State revision basis of the Learning identity derivations (contract §9/§13). */
  readonly expected_state_revision: StateRevisionV0;
  /** Rebuild ordinal of the attempt (0 for first attempt; +1 per A13 rebuild). */
  readonly rebuild_ordinal: number;
  /**
   * Opaque prepare-identity component required by the frozen contract-§6.1
   * episode-ref projection (`{subject_id, source_transition_id, <this value>}`).
   * This slice owns NO derivation of it: the value is minted by the
   * repository-prepare/idempotency slice (P2.3.5.3c, contract §9 rule) and
   * injected here solely so record identity matches that frozen composition.
   * Consumers treat it as an opaque deterministic string.
   */
  readonly intent_identity: string;
}

/** sorted-unique union over ref arrays (set semantics independent of input order). */
function sortedUniqueUnion(groups: ReadonlyArray<readonly string[]>): CanonicalRefV0[] {
  const unique = new Set<string>();
  for (const group of groups) {
    for (const ref of group) unique.add(ref);
  }
  return [...unique].sort() as CanonicalRefV0[];
}

async function hex64(projection: string, value: unknown): Promise<string> {
  const digest = await hashEnvelope(projection, value);
  return digest.replace(/^sha256:/, "");
}

/**
 * Deterministic encoder. One trusted experience ⇒ exactly ONE immutable,
 * deep-frozen EpisodicMemoryRecordV0 that passes the canonical memory
 * validator. Fails closed on any untrusted input and on any produced-record
 * schema violation (never repairs/coerces).
 */
export class ExperienceEncoderV0 {
  async encode(
    input: unknown,
    context: LearningEncodingContextV0
  ): Promise<EpisodicMemoryRecordV0> {
    // ---- MANDATORY trust gate (runtime, not a type annotation) -----------------
    if (!isTrustedLearningExperience(input)) {
      throw new Error(
        "experience encoder: input did not pass durable source-authority validation (trust gate)"
      );
    }
    const t = input;

    // ---- Closed-shape encoding-context admission --------------------------------
    if (context === null || typeof context !== "object") {
      throw new Error("experience encoder: encoding context required");
    }
    if (typeof context.current_logical_time !== "number" || !Number.isSafeInteger(context.current_logical_time)) {
      throw new Error("experience encoder: context.current_logical_time must be a safe integer");
    }
    if (
      typeof context.expected_state_revision !== "number" ||
      !Number.isSafeInteger(context.expected_state_revision) ||
      context.expected_state_revision < 0
    ) {
      throw new Error("experience encoder: context.expected_state_revision must be a non-negative safe integer");
    }
    if (typeof context.rebuild_ordinal !== "number" || !Number.isSafeInteger(context.rebuild_ordinal) || context.rebuild_ordinal < 0) {
      throw new Error("experience encoder: context.rebuild_ordinal must be a non-negative safe integer");
    }
    if (!isString(context.intent_identity) || context.intent_identity.length === 0) {
      throw new Error("experience encoder: context.intent_identity must be a non-empty deterministic identifier");
    }

    // ---- Frozen identity derivations (contract §13 shared derivation + §6.1) ---
    // transition id: shared frozen §13 derivation (single implementation, also
    // used by the Learning executor for the canonical proposal identity);
    // episode_ref: frozen §6.1 projection composed over the OPAQUE
    // prepare-identity component supplied by the encoding context (minted
    // upstream by the repository-prepare slice; NO derivation, construction or
    // registration happens here).
    const learningTransitionId = await deriveLearningTransitionId(t, context);
    const episodeRef = `episode:${await hex64(EPISODE_REF_PROJECTION, {
      subject_id: t.subject_id,
      source_transition_id: t.source_transition_id,
      intent_id: context.intent_identity
    })}`;

    // ---- Exact §6 field mapping ---------------------------------------------------
    const causeRefs = sortedUniqueUnion([
      [t.observation_ref],
      t.appraisal_ref === null ? [] : [t.appraisal_ref],
      t.entity_refs,
      t.event_refs
    ]);
    const references = sortedUniqueUnion([
      t.entity_refs,
      t.event_refs,
      [t.observation_ref]
    ]);
    const record: EpisodicMemoryRecordV0 = {
      schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
      episode_ref: episodeRef as never,
      occurrence_logical_time: t.occurrence_logical_time,
      recorded_at_logical_time: context.current_logical_time as LogicalTimeV0,
      provenance: {
        transition_id: learningTransitionId as never,
        producer: "memory",
        cause_refs: causeRefs
      },
      references,
      context: {
        scene: t.scene,
        focus_refs: [...t.focus_refs] as CanonicalRefV0[],
        environment_refs: [...t.environment_refs] as CanonicalRefV0[]
      },
      appraisal_ref: t.appraisal_ref as never,
      // Contract §6: no committed V0 source exists — fixed null, never invented.
      affect_snapshot_ref: null as never,
      salience: {
        declared_score: t.declared_salience as never,
        source: SALIENCE_SOURCE_ENCODING_DECLARED
      }
    };

    // ---- Fail-closed self-validation against the canonical memory schema --------
    const checked = validateEpisodicMemoryRecord(record);
    if (!checked.ok) {
      throw new Error(`experience encoder: produced record violates memory schema (${checked.error.detail})`);
    }

    // ---- Immutable output (deep-frozen, per current repository patterns) --------
    const freeze = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      if (Object.isFrozen(value)) return;
      Object.freeze(value);
      for (const key of Object.keys(value as Record<string, unknown>)) {
        freeze((value as Record<string, unknown>)[key]);
      }
    };
    freeze(record);
    return record;
  }
}
