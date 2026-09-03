/**
 * Belief Decision Influence Relation Foundation V0 — host admission + relation
 * projection producer (frozen architecture §18-§26).
 *
 * Bounded chain owned here:
 *   host binding + projection integrity + validated canonical action universe
 *   → at most ONE untrusted CognitionRelationProviderV1 call
 *   → closed V1 validation + normalization
 *   → accepted proposal fingerprint
 *   → deep-freed AcceptedCognitionProposalV1 + module-private WeakSet
 *     capability mint
 *   → deterministic relation-only DecisionInfluenceProjectionV0
 *
 * Capability privacy (§20): the WeakSet, the mint and the authorization check
 * are module-private. Public fingerprint derivations confer NO authorization.
 * The producer verifies capability FIRST, then binding, then fingerprint, and
 * exposes ONLY relations — never reasoning_summary, current_intent,
 * confidence/uncertainty or evidence arrays.
 *
 * Canonical authority: this slice receives NO SubjectCore mutation port.
 * SUBJECT_STATE_REVISION_DELTA = TRACE_DELTA = LOGICAL_TIME_DELTA =
 * MEMORY_DELTA = BELIEF_DELTA = RELATIONSHIP_DELTA = PERSONALITY_DELTA = 0.
 */

import type { HashV1, IdentifierV0, LogicalTimeV0, StateRevisionV0 } from "@characteros-next/subject-core";
import { hashEnvelope, validateHash, type ValidationResult, fail, ok } from "@characteros-next/subject-core";

import type { CognitionRelationProviderInputV1, CognitionRelationProviderV1 } from "../../ports/cognition-relation-port.js";
import { COGNITION_RELATION_PROVIDER_INPUT_SCHEMA_VERSION } from "../../ports/cognition-relation-port.js";
import type { AllowedActionV0, CognitiveContextProjectionV0 } from "./types.js";
import {
  COGNITIVE_CONTEXT_PROJECTION_SCHEMA_VERSION,
  allowedEvidenceSet,
  cognitiveProjectionHash
} from "./types.js";
import {
  CognitionRelationRejectionErrorV1,
  deriveAcceptedCognitionProposalFingerprintV1,
  deriveCognitionActionSpaceFingerprintV1,
  validateAllowedActionSpaceV1,
  validateAndNormalizeCognitionProposalV1,
  ACCEPTED_COGNITION_PROPOSAL_SCHEMA_VERSION,
  type AcceptedCognitionProposalV1,
  type BeliefStateActionRelationV0,
  type CognitionProposalV1,
  type CognitionProposalV1RejectionCodeV1
} from "./cognition-proposal-v1.js";

export const DECISION_INFLUENCE_PROJECTION_SCHEMA_VERSION =
  "decision-influence-projection-v0" as const;

/** Output fingerprint namespace EXACT (single literal, no line break). */
export const DECISION_INFLUENCE_RELATION_OUTPUT_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-decision-influence-relation-projection/v1" as const;

/**
 * Deterministic relation-only decision influence projection. Contains NO
 * numeric influence, NO final action, NO reasoning/intent/confidence/evidence
 * — semantic directional relations only.
 */
export interface DecisionInfluenceProjectionV0 {
  readonly schema_version: typeof DECISION_INFLUENCE_PROJECTION_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly relations: readonly BeliefStateActionRelationV0[];
  readonly source_proposal_fingerprint: HashV1;
  readonly output_fingerprint: HashV1;
}

/** Trusted host anchors binding one admission / projection derivation. */
export interface CognitionRelationHostBindingV1 {
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
}

/** Host admission terminal result (fail-closed; deterministic first failure). */
export type CognitionRelationAdmissionResultV1 =
  | {
      readonly kind: "ACCEPTED";
      readonly accepted: AcceptedCognitionProposalV1;
      readonly canonical_actions: readonly AllowedActionV0[];
      readonly action_space_fingerprint: HashV1;
    }
  | {
      readonly kind: "FAILED";
      readonly code: "INVALID_ACTION_SPACE" | "BOUND_CONTEXT_MISMATCH";
      readonly detail: string;
    }
  | {
      readonly kind: "PROVIDER_REJECTED";
      readonly code: CognitionProposalV1CodeOrProviderRejected;
      readonly detail: string;
    };

type CognitionProposalV1CodeOrProviderRejected =
  | CognitionProposalV1RejectionCodeV1
  | "PROVIDER_REJECTED";

// ---- capability authority (module-private; NEVER exported) --------------------

const authorizedAcceptedCognitionProposalsV1 = new WeakSet<AcceptedCognitionProposalV1>();

function isAuthorizedAcceptedCognitionProposalV1(value: unknown): value is AcceptedCognitionProposalV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    authorizedAcceptedCognitionProposalsV1.has(value as AcceptedCognitionProposalV1)
  );
}

function mintAcceptedCognitionProposalV1(fields: {
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly proposal: CognitionProposalV1;
  readonly accepted_proposal_fingerprint: HashV1;
}): AcceptedCognitionProposalV1 {
  const accepted: AcceptedCognitionProposalV1 = {
    schema_version: ACCEPTED_COGNITION_PROPOSAL_SCHEMA_VERSION,
    subject_id: fields.subject_id,
    state_revision: fields.state_revision,
    current_logical_time: fields.current_logical_time,
    projection_hash: fields.projection_hash,
    action_space_fingerprint: fields.action_space_fingerprint,
    proposal: fields.proposal,
    accepted_proposal_fingerprint: fields.accepted_proposal_fingerprint
  };
  deepFreeze(accepted);
  authorizedAcceptedCognitionProposalsV1.add(accepted);
  return accepted;
}

// ---- local helpers -------------------------------------------------------------

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

function jsonDeepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Projection authoritative body/hash integrity: recomputes the frozen
 * cognitiveProjectionHash over the exact projection body and compares.
 * INTERNAL: package admission layers only — never re-exported from the index.
 */
export async function verifyCognitiveProjectionIntegrityV1(
  projection: CognitiveContextProjectionV0
): Promise<ValidationResult<void>> {
  if (projection.schema_version !== COGNITIVE_CONTEXT_PROJECTION_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "projection.schema_version: expected cognitive-context-projection-v0");
  }
  const hash = validateHash(projection.projection_hash, "projection.projection_hash");
  if (!hash.ok) return hash;
  const recomputed = await cognitiveProjectionHash({
    subject_id: projection.subject_id,
    current_logical_time: projection.current_logical_time,
    state_revision: projection.state_revision,
    traits_dimensions: projection.traits_dimensions,
    affect_channels: projection.affect_channels,
    mood_baseline: projection.mood_baseline,
    regulation: projection.regulation,
    context: projection.context,
    memory_working_refs: projection.memory_working_refs,
    recent_retrieval_refs: projection.recent_retrieval_refs,
    belief_item_count: projection.belief_item_count,
    belief_items: projection.belief_items,
    relationship_counterpart_count: projection.relationship_counterpart_count,
    relationship_dimensions: projection.relationship_dimensions,
    interaction_familiarity: projection.interaction_familiarity,
    interaction_familiarity_cognition_influences: projection.interaction_familiarity_cognition_influences,
    // The frozen V0 hash body binds allowed_actions (always the empty V0 list).
    allowed_actions: projection.allowed_actions
  });
  if (recomputed !== projection.projection_hash) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "projection.projection_hash: body integrity mismatch");
  }
  return ok(undefined);
}

/**
 * Deterministic deep-copied, deep-frozen provider input (§16). INTERNAL:
 * package admission layers only — never re-exported from the index.
 */
export function buildCognitionRelationProviderInputV1(
  projection: CognitiveContextProjectionV0,
  canonicalActions: readonly AllowedActionV0[],
  actionSpaceFingerprint: HashV1
): CognitionRelationProviderInputV1 {
  const input: CognitionRelationProviderInputV1 = {
    schema_version: COGNITION_RELATION_PROVIDER_INPUT_SCHEMA_VERSION,
    projection: jsonDeepCopy(projection),
    canonical_actions: canonicalActions.map((a) => ({
      action_type: a.action_type,
      target_ref: a.target_ref
    })),
    action_space_fingerprint: actionSpaceFingerprint,
    allowed_evidence_refs: [...allowedEvidenceSet(projection)].sort() as unknown as CognitionRelationProviderInputV1["allowed_evidence_refs"]
  };
  deepFreeze(input);
  return input;
}

export interface CognitionRelationAdmissionPreparationV1 {
  readonly binding: CognitionRelationHostBindingV1;
  readonly canonical_actions: readonly AllowedActionV0[];
  readonly provider_input: CognitionRelationProviderInputV1;
}

/**
 * Pre-provider admission preparation (frozen order steps 2-11 + 15):
 * projection integrity, host anchor binding, action grammar/duplicate/canonical
 * sort, action-space fingerprint, deep-frozen provider input. Throws
 * CognitionRelationRejectionErrorV1 with BOUND_CONTEXT_MISMATCH or
 * INVALID_ACTION_SPACE. INTERNAL: never re-exported from the index.
 */
export async function prepareCognitionRelationAdmissionV1(args: {
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection: CognitiveContextProjectionV0;
  readonly allowed_actions: readonly AllowedActionV0[];
}): Promise<CognitionRelationAdmissionPreparationV1> {
  const integrity = await verifyCognitiveProjectionIntegrityV1(args.projection);
  if (!integrity.ok) {
    throw new CognitionRelationRejectionErrorV1(
      "BOUND_CONTEXT_MISMATCH",
      `projection integrity failure: ${integrity.error.detail}`
    );
  }
  if (
    args.projection.subject_id !== args.subject_id ||
    args.projection.state_revision !== args.state_revision ||
    args.projection.current_logical_time !== args.current_logical_time
  ) {
    throw new CognitionRelationRejectionErrorV1(
      "BOUND_CONTEXT_MISMATCH",
      "host binding anchors do not match the supplied projection (subject/state/logical time)"
    );
  }
  const space = validateAllowedActionSpaceV1(args.allowed_actions);
  if (!space.ok) {
    throw new CognitionRelationRejectionErrorV1("INVALID_ACTION_SPACE", space.error.detail);
  }
  const actionSpaceFingerprint = await deriveCognitionActionSpaceFingerprintV1(space.value);
  const binding: CognitionRelationHostBindingV1 = {
    subject_id: args.subject_id,
    state_revision: args.state_revision,
    current_logical_time: args.current_logical_time,
    projection_hash: args.projection.projection_hash,
    action_space_fingerprint: actionSpaceFingerprint
  };
  const providerInput = buildCognitionRelationProviderInputV1(
    args.projection,
    space.value,
    actionSpaceFingerprint
  );
  return { binding, canonical_actions: space.value, provider_input: providerInput };
}

/**
 * Post-provider admission core (frozen order steps 17-20): closed validation +
 * normalization, accepted fingerprint, deepFreeze, WeakSet capability mint.
 * Throws CognitionRelationRejectionErrorV1 with the exact stable model code.
 * INTERNAL: never re-exported from the index.
 */
export async function admitCognitionRelationProviderPayloadV1(args: {
  readonly binding: CognitionRelationHostBindingV1;
  readonly projection: CognitiveContextProjectionV0;
  readonly canonical_actions: readonly AllowedActionV0[];
  readonly raw_payload: unknown;
}): Promise<AcceptedCognitionProposalV1> {
  const normalized = await validateAndNormalizeCognitionProposalV1(args.raw_payload, {
    projection: args.projection,
    canonical_actions: args.canonical_actions,
    action_space_fingerprint: args.binding.action_space_fingerprint
  });
  const acceptedFingerprint = await deriveAcceptedCognitionProposalFingerprintV1({
    subject_id: args.binding.subject_id,
    state_revision: args.binding.state_revision,
    current_logical_time: args.binding.current_logical_time,
    projection_hash: args.binding.projection_hash,
    action_space_fingerprint: args.binding.action_space_fingerprint,
    proposal: normalized
  });
  return mintAcceptedCognitionProposalV1({
    subject_id: args.binding.subject_id,
    state_revision: args.binding.state_revision,
    current_logical_time: args.binding.current_logical_time,
    projection_hash: args.binding.projection_hash,
    action_space_fingerprint: args.binding.action_space_fingerprint,
    proposal: normalized,
    accepted_proposal_fingerprint: acceptedFingerprint
  });
}

/**
 * Replay remint through a PRIVATE revalidation path (§20/§35): revalidates a
 * persisted normalized payload against the CURRENT bound projection/action
 * universe, recomputes the accepted fingerprint and compares it against the
 * persisted value before minting a fresh process-local capability. Zero
 * provider recall. INTERNAL: never re-exported from the index.
 */
export async function replayAcceptedCognitionProposalV1(args: {
  readonly stored_proposal: unknown;
  readonly stored_accepted_proposal_fingerprint: HashV1;
  readonly binding: CognitionRelationHostBindingV1;
  readonly projection: CognitiveContextProjectionV0;
  readonly canonical_actions: readonly AllowedActionV0[];
}): Promise<AcceptedCognitionProposalV1> {
  const normalized = await validateAndNormalizeCognitionProposalV1(args.stored_proposal, {
    projection: args.projection,
    canonical_actions: args.canonical_actions,
    action_space_fingerprint: args.binding.action_space_fingerprint
  });
  const recomputed = await deriveAcceptedCognitionProposalFingerprintV1({
    subject_id: args.binding.subject_id,
    state_revision: args.binding.state_revision,
    current_logical_time: args.binding.current_logical_time,
    projection_hash: args.binding.projection_hash,
    action_space_fingerprint: args.binding.action_space_fingerprint,
    proposal: normalized
  });
  if (recomputed !== args.stored_accepted_proposal_fingerprint) {
    throw new CognitionRelationRejectionErrorV1(
      "ACCEPTED_PROPOSAL_FINGERPRINT_MISMATCH",
      "persisted accepted proposal fingerprint does not match the revalidated payload"
    );
  }
  return mintAcceptedCognitionProposalV1({
    subject_id: args.binding.subject_id,
    state_revision: args.binding.state_revision,
    current_logical_time: args.binding.current_logical_time,
    projection_hash: args.binding.projection_hash,
    action_space_fingerprint: args.binding.action_space_fingerprint,
    proposal: normalized,
    accepted_proposal_fingerprint: recomputed
  });
}

/**
 * HOST VALIDATION / ACCEPTANCE RUNNER (§18) — the chosen production symbol is
 * runCognitionRelationAdmissionV1. Takes the trusted host binding, validates
 * the action universe, calls the untrusted provider AT MOST ONCE, validates +
 * normalizes + fingerprints + deepFreezes the payload and mints the
 * AcceptedCognitionProposalV1 capability. The concrete LLM provider owns NO
 * acceptance authority. Never mutates canonical state.
 */
export async function runCognitionRelationAdmissionV1(args: {
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection: CognitiveContextProjectionV0;
  readonly allowed_actions: readonly AllowedActionV0[];
  readonly provider: CognitionRelationProviderV1;
}): Promise<CognitionRelationAdmissionResultV1> {
  let prepared: CognitionRelationAdmissionPreparationV1;
  try {
    prepared = await prepareCognitionRelationAdmissionV1(args);
  } catch (error) {
    if (error instanceof CognitionRelationRejectionErrorV1) {
      return { kind: "FAILED", code: error.code as "INVALID_ACTION_SPACE" | "BOUND_CONTEXT_MISMATCH", detail: error.message };
    }
    throw error;
  }

  let raw: unknown;
  try {
    raw = await args.provider.propose(prepared.provider_input);
  } catch (error) {
    if (error instanceof CognitionRelationRejectionErrorV1) {
      return { kind: "PROVIDER_REJECTED", code: error.code, detail: error.message };
    }
    return {
      kind: "PROVIDER_REJECTED",
      code: "PROVIDER_REJECTED",
      detail: `provider threw: ${(error as Error).message}`
    };
  }

  try {
    const accepted = await admitCognitionRelationProviderPayloadV1({
      binding: prepared.binding,
      projection: args.projection,
      canonical_actions: prepared.canonical_actions,
      raw_payload: raw
    });
    return {
      kind: "ACCEPTED",
      accepted,
      canonical_actions: prepared.canonical_actions,
      action_space_fingerprint: prepared.binding.action_space_fingerprint
    };
  } catch (error) {
    if (error instanceof CognitionRelationRejectionErrorV1) {
      return { kind: "PROVIDER_REJECTED", code: error.code, detail: error.message };
    }
    throw error;
  }
}

/**
 * The deterministic relation-only producer. Verifies the WeakSet capability
 * FIRST, then the bound context, then recomputes and verifies the accepted
 * proposal fingerprint; derives the canonical relation list, computes the
 * output fingerprint and deep-freezes the projection. Exposes NO reasoning,
 * intent, confidence, uncertainty or evidence. Rejects raw/spread/JSON clones
 * (UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL).
 */
export async function produceBeliefDecisionInfluenceRelationProjectionV0(
  accepted: AcceptedCognitionProposalV1,
  binding: CognitionRelationHostBindingV1
): Promise<DecisionInfluenceProjectionV0> {
  if (!isAuthorizedAcceptedCognitionProposalV1(accepted)) {
    throw new CognitionRelationRejectionErrorV1(
      "UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL",
      "accepted cognition proposal was not minted by the host admission authority"
    );
  }
  if (
    accepted.subject_id !== binding.subject_id ||
    accepted.state_revision !== binding.state_revision ||
    accepted.current_logical_time !== binding.current_logical_time ||
    accepted.projection_hash !== binding.projection_hash ||
    accepted.action_space_fingerprint !== binding.action_space_fingerprint
  ) {
    throw new CognitionRelationRejectionErrorV1(
      "BOUND_CONTEXT_MISMATCH",
      "accepted cognition proposal is bound to a different subject/state/projection/action space"
    );
  }
  const recomputedFingerprint = await deriveAcceptedCognitionProposalFingerprintV1({
    subject_id: accepted.subject_id,
    state_revision: accepted.state_revision,
    current_logical_time: accepted.current_logical_time,
    projection_hash: accepted.projection_hash,
    action_space_fingerprint: accepted.action_space_fingerprint,
    proposal: accepted.proposal
  });
  if (recomputedFingerprint !== accepted.accepted_proposal_fingerprint) {
    throw new CognitionRelationRejectionErrorV1(
      "ACCEPTED_PROPOSAL_FINGERPRINT_MISMATCH",
      "accepted proposal fingerprint does not match the recomputed fingerprint"
    );
  }

  // Canonical relation derivation: copied deep structure in frozen canonical
  // comparator order (already canonical in the normalized proposal).
  const relations: BeliefStateActionRelationV0[] = accepted.proposal.state_action_relations.map(
    (r) => ({
      state_locator: { domain: "BELIEF" as const, proposition_id: r.state_locator.proposition_id },
      action: { action_type: r.action.action_type, target_ref: r.action.target_ref },
      relation: r.relation
    })
  );

  const body = {
    schema_version: DECISION_INFLUENCE_PROJECTION_SCHEMA_VERSION,
    subject_id: accepted.subject_id,
    state_revision: accepted.state_revision,
    current_logical_time: accepted.current_logical_time,
    projection_hash: accepted.projection_hash,
    action_space_fingerprint: accepted.action_space_fingerprint,
    relations,
    source_proposal_fingerprint: accepted.accepted_proposal_fingerprint
  };
  const outputFingerprint = await hashEnvelope(
    DECISION_INFLUENCE_RELATION_OUTPUT_FINGERPRINT_PROJECTION,
    body
  );
  const projection: DecisionInfluenceProjectionV0 = { ...body, output_fingerprint: outputFingerprint };
  deepFreeze(projection);
  return projection;
}
