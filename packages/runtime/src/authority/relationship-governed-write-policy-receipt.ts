/**
 * Relationship Governed Write Policy Receipt V0 — deterministic, purely
 * derivable policy-receipt projection
 * (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0 §9/§10, LEVEL_2).
 *
 * The receipt is a DESCRIPTOR + PROJECTION ONLY:
 *   - NO mutable receipt store (SEPARATE_POLICY_RECEIPT_STORE = NONE)
 *   - NO persistence beyond the canonical proposal that carries the derived
 *     receipt ref in external_refs — the receipt is PURELY_DERIVABLE from its
 *     exact preimage at any time
 *   - exact canonical JSON / hashEnvelope / deriveRef conventions already
 *     frozen in the repository; no duplicate serializer
 *
 * The receipt preimage binds, at minimum, the architecture-approved fields:
 * transition identity, subject, expected revision, target (counterpart +
 * governed dimension), operation kind, previous/next values, feature
 * semantics id/fingerprint, authorization gate id/fingerprint, write policy
 * id/fingerprint, evidence refs, the previous-governed-authority link, and
 * the authority epoch start.
 *
 * Determinism (§10): the same logical preimage yields the EXACT same
 * `workflow:` ref; ANY change to revision, target, previous/next, evidence,
 * feature semantics, gate, policy, prior authority, or epoch changes the ref.
 */

import type { HashV1, IdentifierV0, StateRevisionV0 } from "@characteros-next/subject-core";
import { deriveRef } from "@characteros-next/subject-core";
import type { CanonicalRefV0 } from "@characteros-next/subject-core";

import type {
  RelationshipGovernedFeaturePreviousGovernedAuthorityV0,
  RelationshipGovernedFeaturePreviousValueV0,
  RelationshipGovernedWriterOperationKindV0
} from "../transitions/relationship/relationship-governed-writer-authority.js";
import { RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0 } from "./historical-writer-authority-registry.js";
import { RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0 } from "./historical-writer-authority-registry.js";

export const RELATIONSHIP_GOVERNED_WRITE_POLICY_RECEIPT_SCHEMA_VERSION_V0 =
  "relationship-governed-write-policy-receipt-v0" as const;

export const RELATIONSHIP_GOVERNED_WRITE_POLICY_RECEIPT_PROJECTION =
  "characteros-next/runtime/relationship-governed-write-policy-receipt/v1" as const;

/** Exact receipt preimage: every field is bound; no optional fields. */
export interface RelationshipGovernedWritePolicyReceiptDescriptorV0 {
  readonly schema_version: typeof RELATIONSHIP_GOVERNED_WRITE_POLICY_RECEIPT_SCHEMA_VERSION_V0;

  readonly transition_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  readonly expected_revision: StateRevisionV0;

  readonly counterpart_ref: CanonicalRefV0;
  readonly dimension_id: IdentifierV0;
  readonly operation_kind: RelationshipGovernedWriterOperationKindV0;

  readonly previous: RelationshipGovernedFeaturePreviousValueV0;
  readonly next: { readonly kind: "PRESENT"; readonly value: number };

  readonly feature_semantics_contract_id: IdentifierV0;
  readonly feature_semantics_contract_fingerprint: HashV1;

  readonly authorization_gate_id: typeof RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0;
  readonly authorization_gate_fingerprint: HashV1;

  readonly write_policy_id: typeof RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0;
  readonly write_policy_fingerprint: HashV1;

  readonly evidence_receipt_refs: readonly CanonicalRefV0[];

  readonly previous_governed_authority: RelationshipGovernedFeaturePreviousGovernedAuthorityV0;
  readonly authority_epoch_start_transition_id: IdentifierV0;
}

/**
 * Deterministic receipt ref: `workflow:<sha256-hex>` under the frozen receipt
 * projection. Pure — depends only on the descriptor.
 */
export async function deriveRelationshipGovernedWritePolicyReceiptRefV0(
  descriptor: RelationshipGovernedWritePolicyReceiptDescriptorV0
): Promise<CanonicalRefV0> {
  return (await deriveRef(
    "workflow",
    RELATIONSHIP_GOVERNED_WRITE_POLICY_RECEIPT_PROJECTION,
    descriptor
  )) as CanonicalRefV0;
}
