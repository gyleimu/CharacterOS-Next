/**
 * Language Realization Input V0 — the ONE deterministic host-owned input
 * artifact for the language stage (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * It binds the actual production information required to express the
 * ALREADY-COMPUTED cognition: subject identity, source revision, response
 * request identity, current scene/task/context refs, the validated
 * current_intent, the frozen interaction-familiarity projection and cognition
 * influence already visible to cognition, the already-provider-visible Belief /
 * traits / affect / mood read-only fields, the lawful Memory evidence refs and
 * their validated episode contents, and the language-stage output constraints.
 *
 * DELIBERATELY EXCLUDED: reasoning_summary, hidden chain-of-thought, the entire
 * SubjectState, journals, writer capabilities, trusted runtime capability
 * objects, unprojected canonical state, arbitrary repository handles. The
 * language provider expresses an already-computed cognition; it never becomes
 * a second brain.
 *
 * input_hash binds the EXACT actual language-stage input (version/schema,
 * subject, revision, request id, cognition projection identity/hash, validated
 * proposal identity/material, context inputs, lawful evidence refs, Memory
 * content payload hashes, constraints) under the existing canonical
 * hashEnvelope convention — not merely the projection_hash, and never any
 * process-local capability identity. Same exact semantic input ⇒ same
 * input_hash.
 */

import type { CanonicalRefV0, HashV1, IdentifierV0, StateRevisionV0 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type {
  RelationshipInteractionFamiliarityCognitionInfluenceV0,
  RelationshipInteractionFamiliarityReadProjectionV0
} from "../../transitions/relationship/index.js";
import type { BeliefStanceProjectionV0 } from "../cognition-action/types.js";

export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0 =
  "language-realization-input-v0" as const;

export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V0 =
  "characteros-next/runtime/language-realization-input/v1" as const;

/** Validated episode content resolved through the trusted Memory reader. */
export interface LanguageEpisodeContentV0 {
  readonly ref: CanonicalRefV0;
  readonly payload_hash: string;
  readonly scene: string;
}

/** Frozen V0 language-stage output constraints. */
export interface LanguageRealizationConstraintsV0 {
  readonly max_text_code_points: 4096;
  readonly evidence_refs_only: true;
  readonly no_new_evidence_authority: true;
}

/**
 * Exact closed host-owned language realization input. All members are lawful
 * existing projections; nothing here is caller-authoritative.
 */
export interface LanguageRealizationInputV0 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly cognition_projection_hash: HashV1;
  /** Validated cognition proposal identity/material required by this stage. */
  readonly cognition_proposal_binding: {
    readonly schema_version: string;
    readonly projection_hash: HashV1;
    readonly current_intent: string | null;
  };
  readonly scene: string;
  readonly task: string | null;
  readonly focus_refs: readonly CanonicalRefV0[];
  readonly active_entity_refs: readonly CanonicalRefV0[];
  readonly environment_refs: readonly CanonicalRefV0[];
  readonly current_observation_ref: CanonicalRefV0 | null;
  /** Already-provider-visible read-only state fields (copied, no internals). */
  readonly belief_items: readonly BeliefStanceProjectionV0[];
  readonly traits_dimensions: Readonly<Record<string, number>>;
  readonly affect_channels: ReadonlyArray<{ readonly channel: string; readonly strength: number }>;
  readonly mood_baseline: number;
  readonly regulation: {
    readonly energy: number;
    readonly stress: number;
    readonly arousal: number;
    readonly fatigue: number;
  };
  /** Frozen familiarity semantics already visible to cognition. */
  readonly interaction_familiarity: readonly RelationshipInteractionFamiliarityReadProjectionV0[];
  readonly interaction_familiarity_cognition_influences: readonly RelationshipInteractionFamiliarityCognitionInfluenceV0[];
  /** Lawful Memory evidence refs (memory_working_refs ∪ recent_retrieval_refs). */
  readonly evidence_refs: readonly CanonicalRefV0[];
  /** Validated episode contents for the episode-kind subset of evidence refs. */
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  readonly constraints: LanguageRealizationConstraintsV0;
}

/**
 * Deterministic input_hash over the EXACT language-stage input. Pure; same
 * semantic input ⇒ same hash; any change (revision, request id, proposal
 * material, context, evidence, contents, constraints) changes the hash.
 */
export async function deriveLanguageRealizationInputHashV0(
  input: LanguageRealizationInputV0
): Promise<HashV1> {
  return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V0, input);
}
