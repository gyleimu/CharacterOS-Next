/**
 * RelationshipState V0 canonical counterpart-registration executor.
 *
 * EXPLICIT_ONLY runtime registration of one NEW counterpart into canonical
 * RelationshipState. The executor verifies the counterpart is not already
 * registered and that the bound evidence exists in the CURRENT canonical
 * SubjectState's memory repository revision, then mints one `relationship`
 * delta that appends the counterpart in canonical raw-ref order. SubjectCore
 * alone performs the atomic canonical write, revision increment, trace
 * creation, hashing, persistence, and journal replay.
 *
 * Evidence existence proves only that the episode is bound — it does NOT
 * semantically justify the counterpart or its initial dimension values.
 */

import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import {
  parseRef,
  proposalFingerprint,
  validateIdentifier,
  type AtomicCommitBundleAnyVersion,
  type CanonicalTransitionProposalV1,
  type DomainDeltaV0,
  type IdentifierV0,
  type ProducerAuthorizationIssuer,
  type RelationshipStateV0,
  type RepositoryRevisionBindingV1
} from "@characteros-next/subject-core";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import {
  deriveCounterpartRegistrationEvidenceMemberSetFingerprint,
  deriveRelationshipCounterpartRegistrationTransitionId,
  validateRelationshipCounterpartRegistrationProposal
} from "./relationship-counterpart-registration-proposal.js";
import { isReservedRelationshipCoreDimensionIdV0 } from "./relationship-governed-dimension-namespace.js";

const RELATIONSHIP_PRODUCER_ID: IdentifierV0 = (() => {
  const checked = validateIdentifier("relationship", "relationship.producer");
  if (!checked.ok) {
    throw new Error(
      `RELATIONSHIP_PRODUCER_LITERAL: ${checked.error.reason} ${checked.error.detail}`
    );
  }
  return checked.value;
})();

export type RelationshipCounterpartRegistrationResult =
  | {
      readonly kind: "COMMITTED";
      readonly bundle: AtomicCommitBundleAnyVersion;
      readonly relationships: RelationshipStateV0;
    }
  | { readonly kind: "ALREADY_COMMITTED"; readonly bundle: AtomicCommitBundleAnyVersion }
  | { readonly kind: "REJECTED_INVALID_PROPOSAL"; readonly detail: string }
  | { readonly kind: "REJECTED_ALREADY_REGISTERED"; readonly detail: string }
  | { readonly kind: "REJECTED_GOVERNED_DIMENSION"; readonly detail: string }
  | { readonly kind: "REJECTED_STALE_REVISION"; readonly detail: string }
  | { readonly kind: "REJECTED_FORGED_EVIDENCE_FINGERPRINT"; readonly detail: string }
  | { readonly kind: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER"; readonly detail: string }
  | { readonly kind: "REUSE_CONFLICT"; readonly detail: string };

type RegistrationRejectionKind = Extract<
  RelationshipCounterpartRegistrationResult,
  { readonly kind: `REJECTED_${string}` | "REUSE_CONFLICT" }
>["kind"];

function rejected(
  kind: RegistrationRejectionKind,
  detail: string
): RelationshipCounterpartRegistrationResult {
  return { kind, detail };
}

export class RelationshipCounterpartRegistrationExecutor {
  constructor(
    private readonly deps: {
      readonly subjectCore: SubjectCorePort;
      readonly issuer: ProducerAuthorizationIssuer;
      readonly memoryRepository: MemoryPreparationAuthority;
    }
  ) {}

  async execute(
    ctx: RuntimeContext,
    proposalInput: unknown
  ): Promise<RelationshipCounterpartRegistrationResult> {
    const checked = validateRelationshipCounterpartRegistrationProposal(proposalInput);
    if (!checked.ok) {
      return rejected("REJECTED_INVALID_PROPOSAL", checked.error.detail);
    }
    const proposal = checked.value;
    if (proposal.subject_id !== ctx.subject_id) {
      return rejected("REJECTED_INVALID_PROPOSAL", "proposal subject does not match runtime context");
    }
    // Defense in depth: generic counterpart registration must never seed a
    // reserved relationship_core_* initial dimension, even if proposal
    // validation were ever refactored.
    for (const dimension of proposal.dimensions) {
      if (isReservedRelationshipCoreDimensionIdV0(dimension.dimension_id)) {
        return rejected(
          "REJECTED_GOVERNED_DIMENSION",
          `dimension ${dimension.dimension_id} is in the reserved relationship_core_* namespace and cannot be introduced by generic counterpart registration`
        );
      }
    }

    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      return rejected("REJECTED_INVALID_PROPOSAL", "canonical subject state unavailable");
    }

    const recomputedFingerprint = await deriveCounterpartRegistrationEvidenceMemberSetFingerprint(
      proposal.evidence_binding.member_refs
    );
    if (recomputedFingerprint !== proposal.evidence_binding.member_set_fingerprint) {
      return rejected(
        "REJECTED_FORGED_EVIDENCE_FINGERPRINT",
        "member_set_fingerprint does not match its canonical episode member set"
      );
    }

    const boundRevision = snapshot.memory_state.repository_revision;
    const manifest = await this.deps.memoryRepository.readManifest(boundRevision);
    if (manifest === null) {
      return rejected(
        "REJECTED_UNVERIFIED_EVIDENCE_MEMBER",
        `missing manifest for bound revision ${boundRevision}`
      );
    }
    const boundRefs = new Set(manifest.record_hashes.map((record) => record.ref));
    for (const evidenceRef of proposal.evidence_binding.member_refs) {
      if (!boundRefs.has(evidenceRef)) {
        return rejected(
          "REJECTED_UNVERIFIED_EVIDENCE_MEMBER",
          `evidence ${evidenceRef} is not present in bound revision ${boundRevision}`
        );
      }
    }

    const transitionId = await deriveRelationshipCounterpartRegistrationTransitionId(proposal);
    const registeredCounterpart = {
      counterpart_ref: proposal.counterpart_ref,
      dimensions: proposal.dimensions.map((dimension) => ({
        dimension_id: dimension.dimension_id,
        value: dimension.value
      }))
    };
    // Replay-safe construction. On the first-commit path the counterpart is
    // absent and this is a pure append in canonical raw-ref order. On journal
    // ALREADY_COMMITTED / REUSE_CONFLICT routes the same proposal must remain
    // schema-admissible even though the counterpart now exists, so a
    // pre-existing entry with the same ref is replaced; the delta is never
    // applied on those routes.
    const nextRelationships: RelationshipStateV0 = {
      schema_version: snapshot.relationships.schema_version,
      counterparts: [
        ...snapshot.relationships.counterparts.filter(
          (candidate) => candidate.counterpart_ref !== proposal.counterpart_ref
        ),
        registeredCounterpart
      ].sort((a, b) => (a.counterpart_ref < b.counterpart_ref ? -1 : a.counterpart_ref > b.counterpart_ref ? 1 : 0))
    };
    const relationshipDelta: DomainDeltaV0 = {
      producer: RELATIONSHIP_PRODUCER_ID,
      domain: "relationship",
      expected_repository_revision: null,
      operations: [{ path: "/relationships", value: nextRelationships }],
      provenance_refs: [...proposal.evidence_binding.member_refs]
    };
    const canonicalProposal: CanonicalTransitionProposalV1 = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: transitionId,
      subject_id: ctx.subject_id,
      transition_type: "Relationship",
      expected_state_revision: proposal.expected_state_revision,
      time_input: {
        kind: "OCCURRENCE",
        occurrence_logical_time: ctx.current_logical_time
      },
      cause_refs: [...proposal.evidence_binding.member_refs],
      domain_deltas: [relationshipDelta],
      external_refs: []
    };

    const payloadFingerprint = await proposalFingerprint(canonicalProposal);
    const repositoryBindings: readonly RepositoryRevisionBindingV1[] = [
      {
        repository_revision: boundRevision,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      }
    ];
    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    if (reserved.kind === "ALREADY_COMMITTED") {
      // Journal-first: an exact replay of a committed registration is
      // ALREADY_COMMITTED even though the counterpart is now registered.
      return { kind: "ALREADY_COMMITTED", bundle: reserved.bundle };
    }
    if (reserved.kind === "REUSE_CONFLICT") {
      return rejected("REUSE_CONFLICT", "transition id reuse with a different payload");
    }
    if (reserved.kind === "TERMINAL_NO_OP") {
      return rejected("REJECTED_INVALID_PROPOSAL", "terminal NO_OP reserved");
    }
    if (
      snapshot.relationships.counterparts.some(
        (candidate) => candidate.counterpart_ref === proposal.counterpart_ref
      )
    ) {
      return rejected(
        "REJECTED_ALREADY_REGISTERED",
        `counterpart ${proposal.counterpart_ref} is already registered in canonical RelationshipState`
      );
    }
    if (snapshot.runtime_metadata.state_revision !== proposal.expected_state_revision) {
      return rejected(
        "REJECTED_STALE_REVISION",
        `expected revision ${proposal.expected_state_revision}, canonical is ${snapshot.runtime_metadata.state_revision}`
      );
    }

    const preparedResultRef = parseRef(
      `workflow:w-reg-${transitionId.slice("t-relationship-registration-".length)}`,
      "relationship.registration.prepared_result_ref"
    );
    if (!preparedResultRef.ok) {
      return rejected("REJECTED_INVALID_PROPOSAL", preparedResultRef.error.detail);
    }
    const committed = await this.deps.subjectCore.commitReserved({
      proposal: canonicalProposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.issuer.issue([
        { producer: "relationship", domain: "relationship" }
      ]),
      preparedBinding: {
        prepared_result_ref: preparedResultRef.value,
        transition_id: canonicalProposal.transition_id,
        subject_id: canonicalProposal.subject_id,
        transition_type: canonicalProposal.transition_type,
        payload_fingerprint: payloadFingerprint
      },
      repository_bindings: repositoryBindings
    });
    if (committed.kind !== "COMMITTED") {
      if (committed.kind === "REJECTED" && committed.failure.error_code === "STALE_STATE_REVISION") {
        return rejected("REJECTED_STALE_REVISION", committed.failure.detail);
      }
      if (committed.kind === "REJECTED") {
        return rejected(
          "REJECTED_INVALID_PROPOSAL",
          `commit rejected: ${committed.failure.error_code} ${committed.failure.detail}`
        );
      }
      return rejected("REJECTED_INVALID_PROPOSAL", `commit outcome: ${committed.kind}`);
    }
    return {
      kind: "COMMITTED",
      bundle: committed.bundle,
      relationships: nextRelationships
    };
  }
}
