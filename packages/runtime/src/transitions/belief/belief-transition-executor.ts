/**
 * BeliefState V0 canonical transition executor.
 *
 * The executor validates an evidence-bound INSERT/UPDATE intent and mints one
 * `/beliefs` replacement delta. SubjectCore alone performs canonical mutation,
 * durable replay/NO_OP handling, revision, trace, hashing, and persistence.
 */

import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import {
  deriveBeliefPropositionId,
  parseRef,
  proposalFingerprint,
  validateIdentifier,
  type AtomicCommitBundleV1,
  type BeliefStateV0,
  type CanonicalTransitionProposalV1,
  type DomainDeltaV0,
  type IdentifierV0,
  type ProducerAuthorizationIssuer,
  type RepositoryRevisionBindingV1
} from "@characteros-next/subject-core";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import {
  deriveBeliefEvidenceMemberSetFingerprint,
  deriveBeliefTransitionId,
  validateBeliefMutationProposal
} from "./belief-mutation-proposal.js";

const BELIEF_PRODUCER_ID: IdentifierV0 = (() => {
  const checked = validateIdentifier("belief", "belief.producer");
  if (!checked.ok) {
    throw new Error(`BELIEF_PRODUCER_LITERAL: ${checked.error.reason} ${checked.error.detail}`);
  }
  return checked.value;
})();

export type BeliefExecutionResult =
  | {
      readonly kind: "COMMITTED";
      readonly bundle: AtomicCommitBundleV1;
      readonly beliefs: BeliefStateV0;
    }
  | { readonly kind: "ALREADY_COMMITTED"; readonly bundle: AtomicCommitBundleV1 }
  | { readonly kind: "NO_OP"; readonly beliefs: BeliefStateV0 }
  | { readonly kind: "REJECTED_INVALID_PROPOSAL"; readonly detail: string }
  | { readonly kind: "REJECTED_ALREADY_REGISTERED"; readonly detail: string }
  | { readonly kind: "REJECTED_UNKNOWN_PROPOSITION"; readonly detail: string }
  | { readonly kind: "REJECTED_STALE_REVISION"; readonly detail: string }
  | { readonly kind: "REJECTED_FORGED_EVIDENCE_FINGERPRINT"; readonly detail: string }
  | { readonly kind: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER"; readonly detail: string }
  | { readonly kind: "REUSE_CONFLICT"; readonly detail: string };

type BeliefRejectionKind = Extract<
  BeliefExecutionResult,
  { readonly kind: `REJECTED_${string}` | "REUSE_CONFLICT" }
>["kind"];

function rejected(kind: BeliefRejectionKind, detail: string): BeliefExecutionResult {
  return { kind, detail };
}

function compareRaw(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export class BeliefTransitionExecutor {
  constructor(
    private readonly deps: {
      readonly subjectCore: SubjectCorePort;
      readonly issuer: ProducerAuthorizationIssuer;
      readonly memoryRepository: MemoryPreparationAuthority;
    }
  ) {}

  async execute(ctx: RuntimeContext, proposalInput: unknown): Promise<BeliefExecutionResult> {
    const checked = validateBeliefMutationProposal(proposalInput);
    if (!checked.ok) {
      return rejected("REJECTED_INVALID_PROPOSAL", checked.error.detail);
    }
    const proposal = checked.value;
    if (proposal.subject_id !== ctx.subject_id) {
      return rejected("REJECTED_INVALID_PROPOSAL", "proposal subject does not match runtime context");
    }

    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      return rejected("REJECTED_INVALID_PROPOSAL", "canonical subject state unavailable");
    }

    const recomputedFingerprint = await deriveBeliefEvidenceMemberSetFingerprint(
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
    if (manifest.repository_revision !== boundRevision) {
      return rejected(
        "REJECTED_UNVERIFIED_EVIDENCE_MEMBER",
        `manifest revision ${manifest.repository_revision} does not match bound revision ${boundRevision}`
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

    let nextBeliefs: BeliefStateV0;
    let duplicateInsert = false;
    let sameValueUpdate = false;
    if (proposal.mutation.kind === "INSERT") {
      const propositionId = await deriveBeliefPropositionId(
        proposal.subject_id,
        proposal.mutation.proposition_key
      );
      duplicateInsert = snapshot.beliefs.items.some(
        (item) => item.proposition_id === propositionId
      );
      const insertedItem = {
        proposition_id: propositionId,
        proposition_label: proposal.mutation.proposition_label,
        credence: proposal.mutation.initial_credence
      };
      nextBeliefs = {
        schema_version: snapshot.beliefs.schema_version,
        items: [
          ...snapshot.beliefs.items.filter((item) => item.proposition_id !== propositionId),
          insertedItem
        ].sort((a, b) => compareRaw(a.proposition_id, b.proposition_id))
      };
    } else {
      const update = proposal.mutation;
      const currentItem = snapshot.beliefs.items.find(
        (item) => item.proposition_id === update.proposition_id
      );
      if (currentItem === undefined) {
        return rejected(
          "REJECTED_UNKNOWN_PROPOSITION",
          `proposition ${update.proposition_id} is not registered in canonical BeliefState`
        );
      }
      sameValueUpdate = currentItem.credence === update.next_credence;
      nextBeliefs = {
        schema_version: snapshot.beliefs.schema_version,
        items: snapshot.beliefs.items.map((item) =>
          item.proposition_id === update.proposition_id
            ? {
                proposition_id: item.proposition_id,
                proposition_label: item.proposition_label,
                credence: update.next_credence
              }
            : item
        )
      };
    }

    const transitionId = await deriveBeliefTransitionId(proposal);
    const beliefDelta: DomainDeltaV0 = {
      producer: BELIEF_PRODUCER_ID,
      domain: "belief",
      expected_repository_revision: null,
      operations: [{ path: "/beliefs", value: nextBeliefs }],
      provenance_refs: [...proposal.evidence_binding.member_refs]
    };
    const canonicalProposal: CanonicalTransitionProposalV1 = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: transitionId,
      subject_id: proposal.subject_id,
      transition_type: "Belief",
      expected_state_revision: proposal.expected_state_revision,
      time_input: {
        kind: "OCCURRENCE",
        occurrence_logical_time: snapshot.runtime_metadata.logical_time
      },
      cause_refs: [...proposal.evidence_binding.member_refs],
      domain_deltas: [beliefDelta],
      external_refs: []
    };
    const payloadFingerprint = await proposalFingerprint(canonicalProposal);
    const preparedResultRef = parseRef(
      `workflow:w-belief-${transitionId.slice("t-belief-".length)}`,
      "belief.prepared_result_ref"
    );
    if (!preparedResultRef.ok) {
      return rejected("REJECTED_INVALID_PROPOSAL", preparedResultRef.error.detail);
    }
    const preparedBinding = {
      prepared_result_ref: preparedResultRef.value,
      transition_id: canonicalProposal.transition_id,
      subject_id: canonicalProposal.subject_id,
      transition_type: canonicalProposal.transition_type,
      payload_fingerprint: payloadFingerprint
    };

    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    if (reserved.kind === "ALREADY_COMMITTED") {
      return { kind: "ALREADY_COMMITTED", bundle: reserved.bundle };
    }
    if (reserved.kind === "REUSE_CONFLICT") {
      return rejected("REUSE_CONFLICT", "transition id reuse with a different payload");
    }
    if (reserved.kind === "TERMINAL_NO_OP") {
      return { kind: "NO_OP", beliefs: snapshot.beliefs };
    }

    if (duplicateInsert) {
      return rejected(
        "REJECTED_ALREADY_REGISTERED",
        "derived proposition_id is already registered in canonical BeliefState"
      );
    }
    if (snapshot.runtime_metadata.state_revision !== proposal.expected_state_revision) {
      return rejected(
        "REJECTED_STALE_REVISION",
        `expected revision ${proposal.expected_state_revision}, canonical is ${snapshot.runtime_metadata.state_revision}`
      );
    }

    if (sameValueUpdate) {
      const noOp = await this.deps.subjectCore.terminalizeReservedNoOp({
        proposal: canonicalProposal,
        continuation: reserved.continuation,
        producerAuthorization: this.deps.issuer.issue([
          { producer: "belief", domain: "belief" }
        ]),
        preparedBinding
      });
      if (noOp.kind === "NO_OP") {
        return { kind: "NO_OP", beliefs: snapshot.beliefs };
      }
      if (noOp.kind === "REJECTED" && noOp.failure.error_code === "STALE_STATE_REVISION") {
        return rejected("REJECTED_STALE_REVISION", noOp.failure.detail);
      }
      if (noOp.kind === "REJECTED") {
        return rejected(
          "REJECTED_INVALID_PROPOSAL",
          `NO_OP rejected: ${noOp.failure.error_code} ${noOp.failure.detail}`
        );
      }
      return rejected("REJECTED_INVALID_PROPOSAL", `NO_OP outcome: ${noOp.kind}`);
    }

    const repositoryBindings: readonly RepositoryRevisionBindingV1[] = [
      {
        repository_revision: boundRevision,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      }
    ];
    const committed = await this.deps.subjectCore.commitReserved({
      proposal: canonicalProposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.issuer.issue([
        { producer: "belief", domain: "belief" }
      ]),
      preparedBinding,
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
    return { kind: "COMMITTED", bundle: committed.bundle, beliefs: nextBeliefs };
  }
}
