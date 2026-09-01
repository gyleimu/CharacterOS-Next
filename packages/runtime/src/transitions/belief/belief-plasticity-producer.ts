/**
 * BeliefPlasticityProducer V0 — deterministic runtime-only contract.
 *
 * Responsibility:
 *
 *   current canonical SubjectState
 *   + host-authorized Belief semantic result
 *   → deterministic NONCANONICAL Belief plasticity result
 *
 * Only ACCEPTED semantic decisions produce plasticity:
 *
 *   EXISTING_PROPOSITION + SUPPORTS      → next = clamp(current + 0.05, 0, 1)
 *   EXISTING_PROPOSITION + CONTRADICTS   → next = clamp(current - 0.05, 0, 1)
 *
 * Authorized NO_BEARING and NEW_PROPOSITION_CANDIDATE results are REJECTED as
 * INELIGIBLE_SEMANTIC_KIND — NO_BEARING never converts to plasticity, and a NEW
 * candidate has NO canonical identity authority and can never drive credence.
 *
 * AUTHORITY (frozen):
 *  - semantic input: HOST_MINTED_AUTHORIZED_SEMANTIC_RESULT_ONLY (the frozen
 *    semantic capability check is the FIRST authority gate; JSON clones and
 *    structural reconstructions fail it)
 *  - current credence: CANONICAL_BELIEF_STATE exclusively (never caller-supplied)
 *  - caller/model numeric authority: NONE (no current/next credence, delta, step,
 *    confidence, score, weight, or probability is ever accepted)
 *  - canonical mutation: NONE — this producer performs ZERO SubjectCore commits,
 *    constructs NO BeliefMutationProposalV0, and touches no executor/journal/trace
 *
 * UPDATE LAW (fixed, NOT caller-configurable):
 *  - policy: belief-plasticity-policy-v0; nominal step exactly 0.05
 *  - SUPPORTS is NONDECREASING, CONTRADICTS is NONINCREASING, magnitudes SYMMETRIC
 *  - NO evidence-count scaling, NO inertia, NO cross-domain modulation
 *  - saturation (current 1 + SUPPORTS, current 0 + CONTRADICTS) returns the
 *    EXPLICIT NO_CHANGE / SATURATED outcome — never a fabricated CREDENCE_CHANGE
 *
 * NUMERIC CANONICALIZATION:
 *  - IEEE_754_SINGLE_SIGNED_ADD_CLAMP_VALIDATE_JCS_NO_FINAL_ROUND — one raw
 *    IEEE-754 double add, clamp to [0,1], UnitInterval validation, then JCS
 *    hashing. NO toFixed/round/decimal-grid quantize. 0.6 - 0.05 lawfully remains
 *    0.5499999999999999.
 *
 * REPEAT EVIDENCE POLICY:
 *  - the producer is PURE and does NOT dedup history. Same exact authorized input
 *    + same state → same exact output, zero canonical effect. It makes NO claim
 *    that historically seen evidence cannot be processed again through a newly
 *    authorized future workflow.
 *
 * Capability: an accepted plasticity result is trusted only through a
 * module-private, process-local WeakSet. A JSON clone or structural
 * reconstruction FAILS the capability check even when byte-identical.
 */

import type {
  HashV1,
  IdentifierV0,
  RepositoryRevisionIdV0,
  StateRevisionV0,
  SubjectStateV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import {
  hashEnvelope,
  isRecord,
  validateSubjectState,
  validateUnitInterval
} from "@characteros-next/subject-core";
import {
  deriveBeliefEvidenceMemberSetFingerprint,
  type BeliefEvidenceBindingV0
} from "./belief-mutation-proposal.js";
import {
  isAuthorizedBeliefSemanticTargetResolutionV0,
  type BeliefSemanticRelationV0
} from "./belief-semantic-target-resolution.js";

export const BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION = "belief-plasticity-result-v0" as const;
export const BELIEF_PLASTICITY_POLICY_VERSION = "belief-plasticity-policy-v0" as const;
export const BELIEF_PLASTICITY_STEP = 0.05 as const;
export const BELIEF_PLASTICITY_OUTPUT_FINGERPRINT_PROJECTION =
  "characteros-next/belief/plasticity-output/v1" as const;
export const BELIEF_PLASTICITY_NUMERIC_CANONICALIZATION =
  "IEEE_754_SINGLE_SIGNED_ADD_CLAMP_VALIDATE_JCS_NO_FINAL_ROUND" as const;

export interface BeliefPlasticityProducerInputV0 {
  /** Exact canonical snapshot the plasticity is computed against (validated, never mutated). */
  readonly current_subject_state: SubjectStateV0;
  /** Host-minted authorized semantic result (frozen capability check gates everything). */
  readonly semantic_capability: unknown;
}

/** Closed outcome union: an explicit NO_CHANGE is never fabricated as a change. */
export type BeliefPlasticityOutcomeV0 =
  | {
      readonly kind: "CREDENCE_CHANGE";
      readonly next_credence: UnitIntervalV0;
    }
  | {
      readonly kind: "NO_CHANGE";
      readonly reason: "SATURATED";
    };

/** Noncanonical, noncommitting, deeply frozen plasticity result. */
export interface BeliefPlasticityResultV0 {
  readonly schema_version: typeof BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION;
  readonly policy_version: typeof BELIEF_PLASTICITY_POLICY_VERSION;
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly proposition_id: IdentifierV0;
  readonly relation: BeliefSemanticRelationV0;
  readonly current_credence: UnitIntervalV0;
  readonly outcome: BeliefPlasticityOutcomeV0;
  readonly evidence_binding: BeliefEvidenceBindingV0;
  readonly semantic_context_fingerprint: HashV1;
  readonly candidate_catalog_fingerprint: HashV1;
  readonly output_fingerprint: HashV1;
}

export const BELIEF_PLASTICITY_REJECTION_CODES = [
  "INVALID_INPUT",
  "UNTRUSTED_SEMANTIC_CAPABILITY",
  "INELIGIBLE_SEMANTIC_KIND",
  "INVALID_CURRENT_SUBJECT_STATE",
  "SEMANTIC_SUBJECT_MISMATCH",
  "STALE_STATE_REVISION",
  "STALE_REPOSITORY_REVISION",
  "TARGET_PROPOSITION_MISSING",
  "EVIDENCE_BINDING_MISMATCH"
] as const;
export type BeliefPlasticityRejectionCodeV0 = (typeof BELIEF_PLASTICITY_REJECTION_CODES)[number];

export type BeliefPlasticityProducerRunResultV0 =
  | { readonly ok: true; readonly result: BeliefPlasticityResultV0 }
  | { readonly ok: false; readonly code: BeliefPlasticityRejectionCodeV0; readonly detail: string };

/** Module-private, process-local capability store (NEVER serialized). */
const authorizedResults = new WeakSet<object>();

/** Only results minted by THIS producer pass this check. */
export function isAuthorizedBeliefPlasticityResultV0(
  candidate: unknown
): candidate is BeliefPlasticityResultV0 {
  return (
    isRecord(candidate) &&
    authorizedResults.has(candidate) &&
    candidate["schema_version"] === BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as unknown as Record<string, unknown>)) {
      deepFreeze((value as unknown as Record<string, unknown>)[key]);
    }
  }
  return value;
}

const INPUT_KEYS = ["current_subject_state", "semantic_capability"];

/**
 * Runs the deterministic plasticity producer. Pure, fail-closed, and canonical-
 * effect-free: every gate rejects with a closed code; NO retry, NO repair, NO
 * mutation proposal construction, NO SubjectCore involvement.
 */
export async function produceBeliefPlasticityV0(
  input: BeliefPlasticityProducerInputV0
): Promise<BeliefPlasticityProducerRunResultV0> {
  const reject = (code: BeliefPlasticityRejectionCodeV0, detail: string) =>
    ({ ok: false as const, code, detail });

  // ---- 1. closed input shape: callers can NEVER supply numeric authority ------
  if (!isRecord(input)) {
    return reject("INVALID_INPUT", "producer input: expected object");
  }
  const inputKeys = Object.keys(input);
  if (inputKeys.length !== INPUT_KEYS.length || !INPUT_KEYS.every((key) => inputKeys.includes(key))) {
    return reject(
      "INVALID_INPUT",
      "producer input: expected exactly current_subject_state + semantic_capability"
    );
  }

  // ---- 2. FIRST semantic authority gate: host-minted capability only ----------
  const semantic = input.semantic_capability;
  if (!isAuthorizedBeliefSemanticTargetResolutionV0(semantic)) {
    return reject(
      "UNTRUSTED_SEMANTIC_CAPABILITY",
      "semantic_capability is not a host-minted authorized BeliefSemanticTargetResolutionV0"
    );
  }

  // ---- 3. eligible decisions: EXISTING_PROPOSITION only -----------------------
  if (semantic.decision.kind !== "EXISTING_PROPOSITION") {
    return reject(
      "INELIGIBLE_SEMANTIC_KIND",
      `semantic decision kind ${semantic.decision.kind} cannot produce belief plasticity`
    );
  }
  const decision = semantic.decision;

  // ---- 4. current canonical state validation (never mutated/normalized) -------
  const stateChecked = validateSubjectState(input.current_subject_state);
  if (!stateChecked.ok) {
    return reject("INVALID_CURRENT_SUBJECT_STATE", stateChecked.error.detail);
  }
  const state = stateChecked.value;

  // ---- 5. exact binding against the current canonical state (no rebase) -------
  const subjectId = state.identity.subject_id as string;
  if ((semantic.subject_id as string) !== subjectId) {
    return reject(
      "SEMANTIC_SUBJECT_MISMATCH",
      `semantic subject ${semantic.subject_id as string} does not match current subject ${subjectId}`
    );
  }
  const stateRevision = state.runtime_metadata.state_revision as number;
  if ((semantic.state_revision as number) !== stateRevision) {
    return reject(
      "STALE_STATE_REVISION",
      `semantic result is bound to state revision ${semantic.state_revision} but current is ${stateRevision}`
    );
  }
  const repositoryRevision = state.memory_state.repository_revision as string;
  if ((semantic.repository_revision as string) !== repositoryRevision) {
    return reject(
      "STALE_REPOSITORY_REVISION",
      `semantic result is bound to repository revision ${semantic.repository_revision} but current is ${repositoryRevision}`
    );
  }

  // ---- 6. target lookup: current credence comes ONLY from canonical -----------
  const target = state.beliefs.items.find(
    (item) => (item.proposition_id as string) === (decision.proposition_id as string)
  );
  if (target === undefined) {
    return reject(
      "TARGET_PROPOSITION_MISSING",
      `proposition ${decision.proposition_id as string} is not present in the current canonical BeliefState`
    );
  }
  const currentCredence = target.credence as number;

  // ---- 7. evidence binding verification: recompute, never trust blindly -------
  const recomputedMemberFingerprint = await deriveBeliefEvidenceMemberSetFingerprint(
    semantic.evidence_binding.member_refs
  );
  if (recomputedMemberFingerprint !== semantic.evidence_binding.member_set_fingerprint) {
    return reject(
      "EVIDENCE_BINDING_MISMATCH",
      "semantic evidence binding member_set_fingerprint does not match recomputed member-set fingerprint"
    );
  }
  const evidenceBinding: BeliefEvidenceBindingV0 = {
    member_refs: semantic.evidence_binding.member_refs,
    member_set_fingerprint: recomputedMemberFingerprint
  };

  // ---- 8. fixed signed-step update law (NO other factor) ----------------------
  const relation: BeliefSemanticRelationV0 = decision.relation;
  let outcome: BeliefPlasticityOutcomeV0;
  const saturated =
    (currentCredence === 1 && relation === "SUPPORTS") ||
    (currentCredence === 0 && relation === "CONTRADICTS");
  if (saturated) {
    // Explicit abstention from change — never fabricated as a CREDENCE_CHANGE.
    outcome = { kind: "NO_CHANGE", reason: "SATURATED" };
  } else {
    const signedStep = relation === "SUPPORTS" ? BELIEF_PLASTICITY_STEP : -BELIEF_PLASTICITY_STEP;
    // IEEE_754_SINGLE_SIGNED_ADD_CLAMP_VALIDATE_JCS_NO_FINAL_ROUND: one raw double
    // add, clamp, validate — NO final rounding/quantization of any kind.
    const rawNext = currentCredence + signedStep;
    const clamped = Math.max(0, Math.min(1, rawNext));
    const nextChecked = validateUnitInterval(clamped, "outcome.next_credence");
    if (!nextChecked.ok) {
      return reject("INVALID_CURRENT_SUBJECT_STATE", nextChecked.error.detail);
    }
    outcome = { kind: "CREDENCE_CHANGE", next_credence: nextChecked.value };
  }

  // ---- 9. deterministic output fingerprint over every bound field -------------
  const preimage = {
    schema_version: BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION,
    policy_version: BELIEF_PLASTICITY_POLICY_VERSION,
    subject_id: state.identity.subject_id,
    state_revision: state.runtime_metadata.state_revision,
    repository_revision: state.memory_state.repository_revision,
    proposition_id: decision.proposition_id,
    relation,
    current_credence: target.credence,
    outcome,
    evidence_binding: evidenceBinding,
    semantic_context_fingerprint: semantic.semantic_context_fingerprint,
    candidate_catalog_fingerprint: semantic.candidate_catalog_fingerprint
  };
  const outputFingerprint = await hashEnvelope(
    BELIEF_PLASTICITY_OUTPUT_FINGERPRINT_PROJECTION,
    preimage
  );

  // ---- 10. host-minted, deeply frozen, noncanonical result --------------------
  const result = deepFreeze({
    ...preimage,
    output_fingerprint: outputFingerprint
  }) as BeliefPlasticityResultV0;
  authorizedResults.add(result);
  return { ok: true, result };
}
