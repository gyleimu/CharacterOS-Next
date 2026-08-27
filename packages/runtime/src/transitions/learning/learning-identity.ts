/**
 * P2.3.5.3c — Learning prepare/intent identity derivations, implemented EXACTLY
 * as frozen by docs/implementation/p2-3-5-learning-v0-reference-contract.md
 * (§9 intent id, §13 transition id). Commit 0e11e62.
 *
 * Deterministic, domain-separated (distinct projections), subject-bound,
 * source-experience-bound, expected-state-revision-bound, rebuild-ordinal-bound.
 * No randomUUID, Math.random, wall clock or process-local counters.
 *
 * Package-internal module suitable for future 3d reuse (stale rebase derives
 * NEW identities by advancing the rebuild ordinal). NOT exported from the root
 * public barrel: identity helpers are not public architecture surface.
 *
 * P2.3.5.3b consumes ONLY deriveLearningTransitionId (for record provenance);
 * the intent derivation and all repository execution belong to 3c (this slice).
 */

import { hashEnvelope } from "@characteros-next/subject-core";
import type { TrustedLearningExperienceV0 } from "./learning-source-authority.js";

export const LEARNING_TRANSITION_ID_PROJECTION =
  "characteros-next/runtime/learning-transition-id/v1" as const;
export const LEARNING_PREPARE_INTENT_ID_PROJECTION =
  "characteros-next/memory/learning-prepare-intent/v1" as const;

export interface LearningIdentityBasis {
  /** State revision basis of the Learning attempt (SR0 from the same canonical read). */
  readonly expected_state_revision: number;
  /** 0 for the initial attempt; advanced per A13 rebuild (3d). */
  readonly rebuild_ordinal: number;
}

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/**
 * Frozen §13 derivation — the Learning transition identity
 * (`t-learn-<64hex>`). MUST equal `EpisodicMemoryRecordV0.provenance.transition_id`.
 */
export async function deriveLearningTransitionId(
  experience: Pick<TrustedLearningExperienceV0, "subject_id" | "source_transition_id">,
  basis: LearningIdentityBasis
): Promise<string> {
  const digest = strip(
    await hashEnvelope(LEARNING_TRANSITION_ID_PROJECTION, {
      subject_id: experience.subject_id,
      expected_state_revision: basis.expected_state_revision,
      source_transition_id: experience.source_transition_id,
      rebuild_ordinal: basis.rebuild_ordinal
    })
  );
  return `t-learn-${digest}`;
}

/**
 * Frozen §9 derivation — the Learning prepare-intent identity (`li-<64hex>`).
 * Same id + same fingerprint ⇒ repository reuses the SAME prepared revision
 * (existing MemoryPrepareIntent contract); changed fingerprint ⇒ conflict.
 */
export async function deriveLearningIntentId(
  experience: Pick<TrustedLearningExperienceV0, "subject_id" | "source_transition_id">,
  basis: LearningIdentityBasis
): Promise<string> {
  const digest = strip(
    await hashEnvelope(LEARNING_PREPARE_INTENT_ID_PROJECTION, {
      subject_id: experience.subject_id,
      source_transition_id: experience.source_transition_id,
      expected_state_revision: basis.expected_state_revision,
      rebuild_ordinal: basis.rebuild_ordinal
    })
  );
  return `li-${digest}`;
}
