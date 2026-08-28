/**
 * PersonalityState V0 — canonical transition executor.
 *
 * Authority boundary (frozen): PersonalityUpdateProposalV0 → validated
 * Personality transition → SubjectCore canonical commit → new
 * PersonalityStateV0. SubjectCore remains the SOLE canonical mutator; this
 * executor mints one domain delta (producer "personality") targeting the
 * registered writable path "/personality" and never writes memory, trace,
 * revisions, or traits_seed itself. No plasticity law exists here: the executor
 * consumes an already-valid proposal verbatim.
 */

import type {
  CanonicalTransitionProposalV1,
  AtomicCommitBundleV1,
  DomainDeltaV0,
  PersonalityStateV0
} from "@characteros-next/subject-core";

import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { ProducerAuthorizationIssuer } from "@characteros-next/subject-core";
import { proposalFingerprint } from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import {
  deriveEvidenceMemberSetFingerprint,
  derivePersonalityTransitionId,
  validatePersonalityUpdateProposal,
  type PersonalityUpdateProposalV0
} from "./personality-update-proposal.js";

export interface RuntimeContext {
  readonly subject_id: string;
  readonly current_logical_time: number;
  readonly state_revision: number;
}

export type PersonalityExecutionResult =
  | { readonly kind: "COMMITTED"; readonly bundle: AtomicCommitBundleV1; readonly personality: PersonalityStateV0 }
  | { readonly kind: "ALREADY_COMMITTED"; readonly bundle: AtomicCommitBundleV1 }
  | { readonly kind: "REJECTED_INVALID_PROPOSAL"; readonly detail: string }
  | { readonly kind: "REJECTED_UNKNOWN_DIMENSION"; readonly detail: string }
  | { readonly kind: "REJECTED_STALE_REVISION"; readonly detail: string }
  | { readonly kind: "REJECTED_FORGED_EVIDENCE_FINGERPRINT"; readonly detail: string }
  | { readonly kind: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER"; readonly detail: string }
  | { readonly kind: "REUSE_CONFLICT"; readonly detail: string };

function rejected(kind: Extract<PersonalityExecutionResult, { kind: `REJECTED_${string}` | "REUSE_CONFLICT" }>["kind"], detail: string): PersonalityExecutionResult {
  return { kind, detail } as PersonalityExecutionResult;
}

export class PersonalityTransitionExecutor {
  constructor(
    private readonly deps: {
      readonly subjectCore: SubjectCorePort;
      readonly issuer: ProducerAuthorizationIssuer;
      readonly memoryRepository: MemoryPreparationAuthority & {
        readManifest(revision: never): Promise<{ record_hashes: readonly { payload_hash: string }[] } | null>;
      };
    }
  ) {}

  async execute(
    ctx: RuntimeContext,
    proposalInput: PersonalityUpdateProposalV0
  ): Promise<PersonalityExecutionResult> {
    // ---- fail-closed proposal admission --------------------------------------
    const checked = validatePersonalityUpdateProposal(proposalInput);
    if (!checked.ok) {
      return rejected("REJECTED_INVALID_PROPOSAL", checked.error.detail);
    }
    const proposal = checked.value;

    // ---- authoritative state read (SubjectCore reads ITSELF) ------------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id as never);
    if (snapshot === null) {
      return rejected("REJECTED_INVALID_PROPOSAL", "canonical subject state unavailable");
    }

    // ---- registered-dimension membership: only EXISTING dimensions updatable ---
    const current = snapshot.personality;
    const registered = new Map<string, number>();
    for (const d of current.dimensions) registered.set(d.dimension_id, d.value);
    for (const u of proposal.updates) {
      if (!registered.has(u.dimension_id)) {
        return rejected(
          "REJECTED_UNKNOWN_DIMENSION",
          `dimension_id ${u.dimension_id} is not registered in the canonical personality state`
        );
      }
    }

    // ---- evidence fingerprint verification (forged fingerprint fails closed) ----
    const recomputedFingerprint = await deriveEvidenceMemberSetFingerprint(
      proposal.evidence_binding.member_refs
    );
    if (recomputedFingerprint !== proposal.evidence_binding.member_set_fingerprint) {
      return rejected(
        "REJECTED_FORGED_EVIDENCE_FINGERPRINT",
        "member_set_fingerprint does not match the deterministic recomputation over the member refs"
      );
    }

    // ---- evidence membership: every cited episode MUST exist in the memory
    // revision currently bound by the canonical SubjectState (repository head
    // is NOT an authority). Nonexistent / unbound-revision episodes fail closed.
    const boundRevisionForEvidence = snapshot.memory_state.repository_revision as string;
    const evidenceManifest = await this.deps.memoryRepository.readManifest(
      boundRevisionForEvidence as never
    );
    if (evidenceManifest === null) {
      return rejected(
        "REJECTED_UNVERIFIED_EVIDENCE_MEMBER",
        `missing manifest for bound revision ${boundRevisionForEvidence}`
      );
    }
    const boundEpisodeRefs = new Set(
      evidenceManifest.record_hashes.map((r) => r.ref as string)
    );
    for (const ref of proposal.evidence_binding.member_refs) {
      if (!boundEpisodeRefs.has(ref)) {
        return rejected(
          "REJECTED_UNVERIFIED_EVIDENCE_MEMBER",
          `evidence episode ${ref} is not present in the bound repository revision ${boundRevisionForEvidence}`
        );
      }
    }

    // ---- deterministic identity -------------------------------------------------
    const transitionId = await derivePersonalityTransitionId(proposal);

    // ---- build the single atomic personality delta -------------------------------
    const nextDimensions = current.dimensions.map((d) => {
      const u = proposal.updates.find((x: { dimension_id: string }) => x.dimension_id === d.dimension_id);
      return u === undefined ? d : { dimension_id: d.dimension_id, value: u.next_value };
    });
    const nextPersonality: PersonalityStateV0 = {
      schema_version: current.schema_version,
      dimensions: nextDimensions
    };
    const personalityDelta: DomainDeltaV0 = {
      producer: "personality",
      domain: "personality",
      expected_repository_revision: null,
      operations: [{ path: "/personality", value: nextPersonality }],
      provenance_refs: [...proposal.evidence_binding.member_refs]
    } as unknown as DomainDeltaV0;

    const canonicalProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: transitionId,
      subject_id: ctx.subject_id,
      transition_type: "Personality",
      expected_state_revision: proposal.expected_state_revision,
      time_input: {
        kind: "OCCURRENCE",
        occurrence_logical_time: ctx.current_logical_time
      },
      cause_refs: [...proposal.evidence_binding.member_refs],
      domain_deltas: [personalityDelta],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;

    // ---- SubjectCore canonical commit (sole mutator) ----------------------------
    const payloadFingerprint = await proposalFingerprint(canonicalProposal);
    // Whole-state validation requires the proposal to carry the CURRENT memory
    // binding set (the personality delta is binding-neutral but must prove it
    // does not silently rebase the repository binding).
    const boundRevision = snapshot.memory_state.repository_revision as string;
    const manifest = await this.deps.memoryRepository.readManifest(boundRevision as never);
    if (manifest === null) {
      return rejected("REJECTED_INVALID_PROPOSAL", `missing manifest for bound revision ${boundRevision}`);
    }
    const repositoryBindings = [
      {
        repository_revision: boundRevision,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      }
    ];
    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    if (reserved.kind === "ALREADY_COMMITTED") {
      return { kind: "ALREADY_COMMITTED", bundle: reserved.bundle };
    }
    if (reserved.kind === "REUSE_CONFLICT") {
      return rejected("REUSE_CONFLICT", "transition id reuse with a different fingerprint");
    }
    if (reserved.kind === "TERMINAL_NO_OP") {
      return rejected("REJECTED_INVALID_PROPOSAL", "terminal NO_OP reserved");
    }

    // ---- stale revision guard (after journal replay so replays are idempotent) --
    if (snapshot.runtime_metadata.state_revision !== proposal.expected_state_revision) {
      return rejected(
        "REJECTED_STALE_REVISION",
        `expected revision ${String(proposal.expected_state_revision)}, canonical is ${String(snapshot.runtime_metadata.state_revision)}`
      );
    }

    const committed = await this.deps.subjectCore.commitReserved({
      proposal: canonicalProposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.issuer.issue([
        { producer: "personality", domain: "personality" }
      ]),
      preparedBinding: {
        prepared_result_ref: `workflow:w-pers-${transitionId.replace("t-personality-", "")}` as never,
        transition_id: canonicalProposal.transition_id,
        subject_id: canonicalProposal.subject_id,
        transition_type: canonicalProposal.transition_type,
        payload_fingerprint: payloadFingerprint
      },
      repository_bindings: repositoryBindings as never
    });
    if (committed.kind !== "COMMITTED") {
      return rejected("REJECTED_INVALID_PROPOSAL", `commit outcome: ${committed.kind}`);
    }
    const bundle = (committed as { bundle: AtomicCommitBundleV1 }).bundle;
    return { kind: "COMMITTED", bundle, personality: nextPersonality };
  }
}
