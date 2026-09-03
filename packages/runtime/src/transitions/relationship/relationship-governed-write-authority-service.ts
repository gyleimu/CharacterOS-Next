/**
 * Relationship Governed Write Authority Service V0
 * (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0 §8/§12/§17-§23/§26/§43,
 * LEVEL_2).
 *
 * ONE internal CharacterOS-owned evaluation pipeline shared by the Runtime
 * Relationship governed writer path (the pre-proposal policy phase and the
 * commit-time revalidation phase run the SAME law):
 *
 *   1. target derivation (§18/§19) — from the exact predecessor vs candidate
 *      diff via the SubjectCore-owned reserved-target classifier: exactly ONE
 *      governed relationship_core_* target, removal rejected
 *   2. feature admission (§8)      — exact registered binding (domain, source
 *      state schema, dimension, contract id, contract fingerprint) through
 *      the frozen feature-semantics registry; every identity except the ONE
 *      admitted real feature (interaction familiarity) FAILS CLOSED here
 *      (FEATURE_NOT_ADMITTED)
 *   3. evidence binding (§12)      — evidence refs nonempty, unique,
 *      raw-ASCII sorted, and EXACTLY equal to proposal.cause_refs AND the
 *      sole Relationship delta provenance_refs (no subset/superset; arbitrary
 *      ref-only claims rejected); for interaction familiarity these are
 *      familiarity evidence RECEIPT refs, never raw episode refs
 *   4. operation classification (§17) — INITIALIZE / UPDATE / REINITIALIZE
 *      against the exact predecessor target and the trusted-history
 *      prior-authority lookup; removal and equal UPDATE rejected
 *   4.5 feature law (V1)           — the ONE interaction-familiarity accrual
 *      law: INITIALIZE derives exactly 1/32 from one receipt; UPDATE derives
 *      exactly (|R_prev|+1)/32 from R_prev plus one NEW receipt; saturation
 *      at 32 produces no proposal; REINITIALIZE is not authorized; no
 *      caller-supplied value bypasses the derivation
 *   5. authority epoch (§20)       — INITIALIZE/REINITIALIZE → current
 *      transition_id; UPDATE → inherited from the proven prior; a caller can
 *      never supply it
 *   6. policy receipt (§9)         — deterministic descriptor + `workflow:`
 *      ref; governed proposal external_refs law = exactly [receipt ref]
 *   7. positive terminal (§23)     — mint the opaque Runtime prepared-
 *      authority capability (WeakSet, deep frozen, fully bound)
 *
 * There is still NO product governed-write path: the service is internal, no
 * product API supplies governed values, and ordinary production V2 commits
 * keep writer_authority = null. The PipelineStageObserver.authorityPreparation
 * callback is NOT consumed — OBSERVATION_ONLY. This is NOT a Relationship-
 * specific commit pipeline: the commit path remains the ONE shared V2
 * production pipeline.
 */

import {
  detectReservedRelationshipTargetChangesV0,
  type ReservedRelationshipTargetChangeV0
} from "@characteros-next/subject-core";
import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  StateRevisionV0
} from "@characteros-next/subject-core";

import {
  RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
  RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  resolveRegisteredRelationshipFeatureDecisionSemanticsV0
} from "./relationship-feature-decision-semantics.js";
import { enforceInteractionFamiliarityLiveLawV0 } from "./relationship-interaction-familiarity-accrual-policy.js";
import {
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
  deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0,
  deriveRelationshipGovernedFeatureWritePolicyFingerprintV0
} from "../../authority/historical-writer-authority-registry.js";
import {
  deriveRelationshipGovernedWritePolicyReceiptRefV0,
  type RelationshipGovernedWritePolicyReceiptDescriptorV0
} from "../../authority/relationship-governed-write-policy-receipt.js";
import {
  lookupLatestRelationshipGovernedAuthorityV0,
  type RelationshipGovernedTrustedHistoryCapabilityV0
} from "../../authority/relationship-governed-trusted-history.js";
import type {
  RelationshipGovernedFeaturePreviousGovernedAuthorityV0,
  RelationshipGovernedFeaturePreviousValueV0,
  RelationshipGovernedWriterOperationKindV0
} from "./relationship-governed-writer-authority.js";

// ---- §18/§19 target derivation --------------------------------------------------------

export type RelationshipGovernedTargetDerivationV0 =
  | { readonly kind: "NO_GOVERNED_TARGET" }
  | {
      readonly kind: "GOVERNED_TARGET";
      readonly counterpart_ref: CanonicalRefV0;
      readonly dimension_id: IdentifierV0;
      readonly previous: RelationshipGovernedFeaturePreviousValueV0;
      readonly next: { readonly kind: "PRESENT"; readonly value: number };
    }
  | { readonly kind: "REJECTED"; readonly code: "REMOVAL_UNSUPPORTED" | "MULTIPLE_GOVERNED_TARGETS" | "UNREADABLE_RELATIONSHIPS"; readonly detail: string };

/**
 * Derive the single governed target from the EXACT predecessor vs candidate
 * canonical states (no text parsing). Non-reserved dimensions never appear;
 * more than one governed target or any governed removal fails closed.
 */
export function deriveRelationshipGovernedTargetV0(input: {
  readonly predecessor: Readonly<Record<string, unknown>>;
  readonly candidate: Readonly<Record<string, unknown>>;
}): RelationshipGovernedTargetDerivationV0 {
  const diff = detectReservedRelationshipTargetChangesV0(
    input.predecessor as never,
    input.candidate as never
  );
  if (!diff.ok) {
    return { kind: "REJECTED", code: "UNREADABLE_RELATIONSHIPS", detail: diff.detail };
  }
  if (diff.changes.length === 0) return { kind: "NO_GOVERNED_TARGET" };
  if (diff.changes.length > 1) {
    return {
      kind: "REJECTED",
      code: "MULTIPLE_GOVERNED_TARGETS",
      detail: `exactly ONE governed Relationship target is supported, got ${diff.changes.length}`
    };
  }
  const change = diff.changes[0] as ReservedRelationshipTargetChangeV0;
  if (change.kind === "REMOVED") {
    return {
      kind: "REJECTED",
      code: "REMOVAL_UNSUPPORTED",
      detail: `governed feature removal is unsupported (${change.counterpart_ref} ${change.dimension_id})`
    };
  }
  return {
    kind: "GOVERNED_TARGET",
    counterpart_ref: change.counterpart_ref as CanonicalRefV0,
    dimension_id: change.dimension_id as IdentifierV0,
    previous:
      change.kind === "ADDED"
        ? ({ kind: "ABSENT" } as const)
        : ({ kind: "PRESENT", value: change.previous_value as number } as RelationshipGovernedFeaturePreviousValueV0),
    next: { kind: "PRESENT", value: change.next_value as number }
  };
}

// ---- §23 Runtime prepared-authority capability (opaque, mint-internal) ----------------

export const RELATIONSHIP_PREPARED_AUTHORITY_CAPABILITY_SCHEMA_VERSION_V0 =
  "relationship-prepared-authority-capability-v0" as const;

/**
 * Opaque Runtime prepared-authority capability: deep frozen, WeakSet-admitted
 * (structural clone rejected), bound to the exact proposal/revision/head/
 * target/operation/semantics/gate/policy/receipt/evidence/prior/epoch facts.
 * Never serialized as authority. With zero admitted features this type is
 * UNREACHABLE from any product path.
 */
export interface RelationshipPreparedAuthorityCapabilityV0 {
  readonly schema_version: typeof RELATIONSHIP_PREPARED_AUTHORITY_CAPABILITY_SCHEMA_VERSION_V0;
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly expected_revision: StateRevisionV0;
  readonly history_head_commit_ref: CanonicalRefV0 | null;
  readonly counterpart_ref: CanonicalRefV0;
  readonly dimension_id: IdentifierV0;
  readonly operation_kind: RelationshipGovernedWriterOperationKindV0;
  readonly feature_semantics_contract_id: IdentifierV0;
  readonly feature_semantics_contract_fingerprint: HashV1;
  readonly authorization_gate_id: IdentifierV0;
  readonly authorization_gate_fingerprint: HashV1;
  readonly write_policy_id: IdentifierV0;
  readonly write_policy_fingerprint: HashV1;
  readonly write_policy_receipt_ref: CanonicalRefV0;
  readonly evidence_receipt_refs: readonly CanonicalRefV0[];
  readonly previous_governed_authority: RelationshipGovernedFeaturePreviousGovernedAuthorityV0;
  readonly authority_epoch_start_transition_id: IdentifierV0;
}

const preparedCapabilities = new WeakSet<object>();

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/** WeakSet admission: only service-minted capabilities are trusted. */
export function isRelationshipPreparedAuthorityCapabilityV0(value: unknown): boolean {
  return typeof value === "object" && value !== null && preparedCapabilities.has(value as object);
}

// ---- §17 operation classification ------------------------------------------------------

export type RelationshipGovernedOperationClassV0 =
  | "INITIALIZE"
  | "UPDATE"
  | "REINITIALIZE"
  | {
      readonly kind: "REJECTED";
      readonly code:
        | "REMOVAL_UNSUPPORTED"
        | "EQUAL_UPDATE_FORBIDDEN"
        | "UPDATE_WITHOUT_PROVEN_PRIOR"
        | "PRIOR_NOT_RESOLVED_VALID"
        | "INITIALIZE_WITH_LINEAGE"
        | "REINITIALIZE_WITH_UNRESOLVED_LINEAGE"
        | "NEXT_VALUE_MUST_BE_PRESENT";
      readonly detail: string;
    };

/**
 * §17 CharacterOS-owned deterministic operation classification. No text
 * parsing — exact structural facts only:
 *
 *   INITIALIZE    predecessor target ABSENT + next present + no contradictory
 *                 matching governed lineage in the COMPLETE trusted history
 *   UPDATE        predecessor target PRESENT + latest matching authority
 *                 RESOLVED_VALID + the proven prior's next value == the
 *                 current predecessor value + the next value differs
 *   REINITIALIZE  predecessor target PRESENT + the COMPLETE trusted history
 *                 proves NO matching authority exists + next present (an
 *                 equal next is lawful per the frozen architecture; the
 *                 policy explicitly permits the bootstrap)
 */
export function classifyRelationshipGovernedOperationV0(input: {
  readonly target: {
    readonly previous: RelationshipGovernedFeaturePreviousValueV0;
    readonly next: { readonly kind: "PRESENT"; readonly value: number };
  };
  readonly latest_lookup:
    | {
        readonly kind: "FOUND";
        readonly payload: { readonly next: { readonly value: number } };
        readonly status: string;
      }
    | { readonly kind: "NO_MATCHING_AUTHORITY" }
    | { readonly kind: "UNTRUSTED_CAPABILITY"; readonly detail: string };
}): RelationshipGovernedOperationClassV0 {
  if (input.target.next.kind !== "PRESENT") {
    return {
      kind: "REJECTED",
      code: "NEXT_VALUE_MUST_BE_PRESENT",
      detail: "removal is unsupported; next must be PRESENT"
    };
  }
  const targetAbsent = input.target.previous.kind === "ABSENT";
  const previousValue = input.target.previous.kind === "PRESENT" ? input.target.previous.value : null;
  const nextValue = input.target.next.value;

  if (targetAbsent) {
    if (input.latest_lookup.kind === "FOUND") {
      return {
        kind: "REJECTED",
        code: "INITIALIZE_WITH_LINEAGE",
        detail:
          "predecessor target is absent but canonical history carries a matching governed authority (contradictory lineage)"
      };
    }
    return "INITIALIZE";
  }

  // Predecessor target PRESENT.
  if (input.latest_lookup.kind === "UNTRUSTED_CAPABILITY") {
    return {
      kind: "REJECTED",
      code: "REINITIALIZE_WITH_UNRESOLVED_LINEAGE",
      detail: `trusted history unavailable for a present target: ${input.latest_lookup.detail}`
    };
  }
  if (input.latest_lookup.kind === "FOUND") {
    if (input.latest_lookup.status !== "RESOLVED_VALID") {
      return {
        kind: "REJECTED",
        code: "PRIOR_NOT_RESOLVED_VALID",
        detail: `latest matching governed authority is ${input.latest_lookup.status}; UPDATE requires RESOLVED_VALID`
      };
    }
    const provenPriorValue = input.latest_lookup.payload.next.value;
    if (previousValue === null || provenPriorValue !== previousValue) {
      return {
        kind: "REJECTED",
        code: "UPDATE_WITHOUT_PROVEN_PRIOR",
        detail: "the proven prior authority does not bind the current predecessor value"
      };
    }
    if (nextValue === provenPriorValue) {
      return { kind: "REJECTED", code: "EQUAL_UPDATE_FORBIDDEN", detail: "equal UPDATE is forbidden" };
    }
    return "UPDATE";
  }
  // COMPLETE trusted history proves NO matching authority exists → bootstrap.
  return "REINITIALIZE";
}

/** §20 authority epoch derivation. Caller-supplied epochs are impossible. */
export function deriveRelationshipGovernedAuthorityEpochV0(input: {
  readonly operation: "INITIALIZE" | "UPDATE" | "REINITIALIZE";
  readonly current_transition_id: IdentifierV0;
  readonly proven_prior_epoch: IdentifierV0 | null;
}): IdentifierV0 {
  if (input.operation === "UPDATE") {
    if (input.proven_prior_epoch === null) {
      throw new Error("authority epoch: UPDATE requires the proven prior epoch (fail closed)");
    }
    return input.proven_prior_epoch;
  }
  return input.current_transition_id;
}

// ---- evaluation surface -----------------------------------------------------------------

/** Exact binding facts the evaluator needs about the canonical proposal. */
export interface RelationshipGovernedProposalFactsV0 {
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly expected_revision: StateRevisionV0;
  readonly transition_id: IdentifierV0;
  readonly cause_refs: readonly CanonicalRefV0[];
  /** external_refs of the proposal (governed law: exactly [receipt ref]). */
  readonly external_refs: readonly CanonicalRefV0[];
  /** The sole Relationship delta's provenance_refs. */
  readonly relationship_delta_provenance_refs: readonly CanonicalRefV0[];
}

/** Exact target facts: the governed dimension and its previous/next values. */
export interface RelationshipGovernedTargetFactsV0 {
  readonly counterpart_ref: CanonicalRefV0;
  readonly dimension_id: IdentifierV0;
  readonly previous: RelationshipGovernedFeaturePreviousValueV0;
  readonly next: { readonly kind: "PRESENT"; readonly value: number };
}

/** Exact feature-semantic identity claimed for the write (must be ADMITTED). */
export interface RelationshipGovernedFeatureIdentityFactsV0 {
  readonly feature_semantics_contract_id: IdentifierV0;
  readonly feature_semantics_contract_fingerprint: HashV1;
}

export type RelationshipGovernedWriteEvaluationV0 =
  | {
      readonly kind: "DENIED";
      readonly code:
        | "FEATURE_NOT_ADMITTED"
        | "FEATURE_LAW_REJECTED"
        | "EVIDENCE_BINDING_MISMATCH"
        | "OPERATION_REJECTED"
        | "UNTRUSTED_HISTORY"
        | "RECEIPT_REF_MISMATCH";
      readonly detail: string;
    }
  | {
      readonly kind: "PREPARED";
      readonly operation: "INITIALIZE" | "UPDATE" | "REINITIALIZE";
      readonly receipt_descriptor: RelationshipGovernedWritePolicyReceiptDescriptorV0;
      readonly write_policy_receipt_ref: CanonicalRefV0;
      readonly authority_epoch_start_transition_id: IdentifierV0;
      readonly capability: RelationshipPreparedAuthorityCapabilityV0;
    };

function rawAsciiSortedUnique(refs: readonly CanonicalRefV0[]): boolean {
  for (let i = 0; i < refs.length; i++) {
    const current = refs[i] as string;
    if (i > 0) {
      const prior = refs[i - 1] as string;
      if (!(current > prior)) return false;
    }
  }
  return true;
}

function refsExactlyEqual(a: readonly CanonicalRefV0[], b: readonly CanonicalRefV0[]): boolean {
  return a.length === b.length && a.every((ref, index) => ref === b[index]);
}

/**
 * The ONE internal governed-write evaluation. Feature admission runs FIRST:
 * every identity except the ONE admitted real feature (interaction
 * familiarity) denies with FEATURE_NOT_ADMITTED before any receipt/capability
 * work, and the admitted feature's own accrual law must then derive the exact
 * transition (step 4.5).
 *
 * `expected_receipt_ref` lets the commit-time revalidation prove the
 * proposal's external_refs receipt is EXACTLY the recomputed deterministic
 * one (no caller-selected receipt identity).
 */
export async function evaluateRelationshipGovernedWriteV0(input: {
  readonly proposal: RelationshipGovernedProposalFactsV0;
  readonly target: RelationshipGovernedTargetFactsV0;
  readonly feature: RelationshipGovernedFeatureIdentityFactsV0;
  readonly evidence_receipt_refs: readonly CanonicalRefV0[];
  readonly history: {
    readonly capability: RelationshipGovernedTrustedHistoryCapabilityV0;
    readonly bundles: readonly Readonly<Record<string, unknown>>[];
  };
  readonly expected_receipt_ref?: CanonicalRefV0;
}): Promise<RelationshipGovernedWriteEvaluationV0> {
  // 1. Feature admission — exact registered binding, fail closed.
  try {
    resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
      domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
      source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
      dimension_id: input.target.dimension_id,
      feature_semantics_contract_id: input.feature.feature_semantics_contract_id,
      feature_semantics_contract_fingerprint: input.feature.feature_semantics_contract_fingerprint
    });
  } catch {
    return {
      kind: "DENIED",
      code: "FEATURE_NOT_ADMITTED",
      detail:
        "no positively admitted Relationship feature semantics exists for this governed target (registered: interaction familiarity only)"
    };
  }

  // 2. Evidence binding — nonempty, unique, raw-ASCII sorted, and EXACTLY
  // equal to proposal.cause_refs and the Relationship delta provenance_refs.
  const evidence = input.evidence_receipt_refs;
  if (
    evidence.length === 0 ||
    !rawAsciiSortedUnique(evidence) ||
    !refsExactlyEqual(evidence, input.proposal.cause_refs) ||
    !refsExactlyEqual(evidence, input.proposal.relationship_delta_provenance_refs)
  ) {
    return {
      kind: "DENIED",
      code: "EVIDENCE_BINDING_MISMATCH",
      detail: "evidence refs must be nonempty, unique, raw-ASCII sorted, and exactly equal to cause_refs and provenance_refs"
    };
  }

  // 3. Prior-authority lookup over the trusted history capability.
  const lookup = await lookupLatestRelationshipGovernedAuthorityV0({
    capability: input.history.capability,
    bundles: input.history.bundles as never,
    subject_id: input.proposal.subject_id,
    counterpart_ref: input.target.counterpart_ref,
    dimension_id: input.target.dimension_id
  });
  if (lookup.kind === "UNTRUSTED_CAPABILITY") {
    return { kind: "DENIED", code: "UNTRUSTED_HISTORY", detail: lookup.detail };
  }

  // 4. Operation classification.
  const operation = classifyRelationshipGovernedOperationV0({
    target: { previous: input.target.previous, next: input.target.next },
    latest_lookup: lookup
  });
  if (typeof operation !== "string") {
    return {
      kind: "DENIED",
      code: "OPERATION_REJECTED",
      detail: `${operation.code}: ${operation.detail}`
    };
  }

  // 4.5 Feature-specific law — exactly ONE admitted feature (interaction
  // familiarity), ONE law, ONE exact path. The caller's proposed next value
  // and cumulative receipt set are only accepted when they EXACTLY equal the
  // law derivation (INITIALIZE: one receipt → 1/32; UPDATE: R_prev plus one
  // new receipt → (|R_prev|+1)/32; saturation at 32 → no proposal);
  // REINITIALIZE is not authorized by ordinary familiarity V0. Any other
  // dimension fails closed (no feature-law hook is registered for it).
  if (input.target.dimension_id === INTERACTION_FAMILIARITY_DIMENSION_ID_V0) {
    const law = enforceInteractionFamiliarityLiveLawV0({
      operation,
      previous: input.target.previous,
      next: input.target.next,
      proposed_receipt_refs: evidence,
      prior:
        lookup.kind === "FOUND"
          ? { kind: "PRIOR", receipt_refs: lookup.payload.evidence_receipt_refs }
          : { kind: "NONE" }
    });
    if (!law.ok) {
      return {
        kind: "DENIED",
        code: "FEATURE_LAW_REJECTED",
        detail: `${law.code}: ${law.detail}`
      };
    }
  } else {
    return {
      kind: "DENIED",
      code: "FEATURE_LAW_REJECTED",
      detail: "no feature-specific law validator is registered for this admitted dimension (fail closed)"
    };
  }

  // 5. Authority epoch — derived, never caller-supplied.
  const provenPriorEpoch =
    operation === "UPDATE" && lookup.kind === "FOUND"
      ? lookup.payload.authority_epoch_start_transition_id
      : null;
  let epoch: IdentifierV0;
  try {
    epoch = deriveRelationshipGovernedAuthorityEpochV0({
      operation,
      current_transition_id: input.proposal.transition_id,
      proven_prior_epoch: provenPriorEpoch
    });
  } catch {
    return {
      kind: "DENIED",
      code: "OPERATION_REJECTED",
      detail: "UPDATE requires the proven prior epoch (fail closed)"
    };
  }

  // 6. Policy receipt — deterministic descriptor + ref.
  const [gateFingerprint, policyFingerprint] = await Promise.all([
    deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0(),
    deriveRelationshipGovernedFeatureWritePolicyFingerprintV0()
  ]);
  const receiptDescriptor: RelationshipGovernedWritePolicyReceiptDescriptorV0 = {
    schema_version: "relationship-governed-write-policy-receipt-v0",
    transition_id: input.proposal.transition_id,
    subject_id: input.proposal.subject_id,
    expected_revision: input.proposal.expected_revision,
    counterpart_ref: input.target.counterpart_ref,
    dimension_id: input.target.dimension_id,
    operation_kind: operation,
    previous: input.target.previous,
    next: input.target.next,
    feature_semantics_contract_id: input.feature.feature_semantics_contract_id,
    feature_semantics_contract_fingerprint: input.feature.feature_semantics_contract_fingerprint,
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
    authorization_gate_fingerprint: gateFingerprint,
    write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
    write_policy_fingerprint: policyFingerprint,
    evidence_receipt_refs: evidence,
    previous_governed_authority:
      operation === "UPDATE" && lookup.kind === "FOUND"
        ? ({
            kind: "PRIOR",
            commit_ref: lookup.commit_ref,
            authority_payload_hash: lookup.authority_payload_hash
          } as const)
        : ({ kind: "NONE" } as const),
    authority_epoch_start_transition_id: epoch
  };
  const receiptRef = await deriveRelationshipGovernedWritePolicyReceiptRefV0(receiptDescriptor);

  // Governed external_refs law: the proposal carries EXACTLY [receipt ref].
  if (input.expected_receipt_ref !== undefined) {
    if (
      input.proposal.external_refs.length !== 1 ||
      input.proposal.external_refs[0] !== input.expected_receipt_ref ||
      input.expected_receipt_ref !== receiptRef
    ) {
      return {
        kind: "DENIED",
        code: "RECEIPT_REF_MISMATCH",
        detail: "proposal external_refs must be exactly [recomputed write-policy receipt ref]"
      };
    }
  }

  // 7. Positive terminal — opaque prepared-authority capability (§23).
  const capability: RelationshipPreparedAuthorityCapabilityV0 = {
    schema_version: RELATIONSHIP_PREPARED_AUTHORITY_CAPABILITY_SCHEMA_VERSION_V0,
    proposal_ref: input.proposal.proposal_ref,
    payload_fingerprint: input.proposal.payload_fingerprint,
    subject_id: input.proposal.subject_id,
    expected_revision: input.proposal.expected_revision,
    history_head_commit_ref: null,
    counterpart_ref: input.target.counterpart_ref,
    dimension_id: input.target.dimension_id,
    operation_kind: operation,
    feature_semantics_contract_id: input.feature.feature_semantics_contract_id,
    feature_semantics_contract_fingerprint: input.feature.feature_semantics_contract_fingerprint,
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0 as IdentifierV0,
    authorization_gate_fingerprint: gateFingerprint,
    write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0 as IdentifierV0,
    write_policy_fingerprint: policyFingerprint,
    write_policy_receipt_ref: receiptRef,
    evidence_receipt_refs: evidence,
    previous_governed_authority: receiptDescriptor.previous_governed_authority,
    authority_epoch_start_transition_id: epoch
  };
  deepFreeze(capability);
  preparedCapabilities.add(capability);
  return {
    kind: "PREPARED",
    operation,
    receipt_descriptor: receiptDescriptor,
    write_policy_receipt_ref: receiptRef,
    authority_epoch_start_transition_id: epoch,
    capability
  };
}
