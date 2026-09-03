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
 *
 * Type authority: the executor consumes the canonical branded RuntimeContext
 * (types/runtime-context) and the authoritative MemoryPreparationAuthority
 * manifest contract (record_hashes expose {ref, payload_hash}); no narrowed
 * duplicates and no type escapes.
 */

import type {
  AtomicCommitBundleAnyVersion,
  CanonicalTransitionProposalV1,
  DomainDeltaV0,
  IdentifierV0,
  PersonalityStateV0,
  RepositoryRevisionBindingV1,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import type { ProducerAuthorizationIssuer } from "@characteros-next/subject-core";
import { parseRef, proposalFingerprint, validateIdentifier } from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash, type MemoryPreparationAuthority } from "@characteros-next/memory";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import {
  deriveEvidenceMemberSetFingerprint,
  derivePersonalityTransitionId,
  validatePersonalityUpdateProposal
} from "./personality-update-proposal.js";

/**
 * Producer literal as a repository-authoritative branded identifier, verified
 * once at module load through the canonical identifier validator.
 */
const PERSONALITY_PRODUCER_ID: IdentifierV0 = (() => {
  const checked = validateIdentifier("personality", "personality.producer");
  if (!checked.ok) {
    throw new Error(`PERSONALITY_PRODUCER_LITERAL: ${checked.error.reason} ${checked.error.detail}`);
  }
  return checked.value;
})();

export type PersonalityExecutionResult =
  | { readonly kind: "COMMITTED"; readonly bundle: AtomicCommitBundleAnyVersion; readonly personality: PersonalityStateV0 }
  | { readonly kind: "ALREADY_COMMITTED"; readonly bundle: AtomicCommitBundleAnyVersion }
  | { readonly kind: "REJECTED_INVALID_PROPOSAL"; readonly detail: string }
  | { readonly kind: "REJECTED_UNKNOWN_DIMENSION"; readonly detail: string }
  | { readonly kind: "REJECTED_STALE_REVISION"; readonly detail: string }
  | { readonly kind: "REJECTED_FORGED_EVIDENCE_FINGERPRINT"; readonly detail: string }
  | { readonly kind: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER"; readonly detail: string }
  | { readonly kind: "REUSE_CONFLICT"; readonly detail: string };

type PersonalityRejectionKind = Extract<
  PersonalityExecutionResult,
  { readonly kind: `REJECTED_${string}` | "REUSE_CONFLICT" }
>["kind"];

/** Exhaustive fail-closed rejection constructor — no assertion needed. */
function rejected(kind: PersonalityRejectionKind, detail: string): PersonalityExecutionResult {
  switch (kind) {
    case "REJECTED_INVALID_PROPOSAL":
    case "REJECTED_UNKNOWN_DIMENSION":
    case "REJECTED_STALE_REVISION":
    case "REJECTED_FORGED_EVIDENCE_FINGERPRINT":
    case "REJECTED_UNVERIFIED_EVIDENCE_MEMBER":
    case "REUSE_CONFLICT":
      return { kind, detail };
  }
}

export class PersonalityTransitionExecutor {
  constructor(
    private readonly deps: {
      readonly subjectCore: SubjectCorePort;
      readonly issuer: ProducerAuthorizationIssuer;
      /** Authoritative manifest read contract: record_hashes expose {ref, payload_hash}. */
      readonly memoryRepository: MemoryPreparationAuthority;
    }
  ) {}

  async execute(
    ctx: RuntimeContext,
    proposalInput: unknown
  ): Promise<PersonalityExecutionResult> {
    // ---- fail-closed proposal admission --------------------------------------
    const checked = validatePersonalityUpdateProposal(proposalInput);
    if (!checked.ok) {
      return rejected("REJECTED_INVALID_PROPOSAL", checked.error.detail);
    }
    const proposal = checked.value;

    // ---- authoritative state read (SubjectCore reads ITSELF) ------------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      return rejected("REJECTED_INVALID_PROPOSAL", "canonical subject state unavailable");
    }

    // ---- registered-dimension membership: only EXISTING dimensions updatable ---
    const current = snapshot.personality;
    const registered = new Map<string, UnitIntervalV0>();
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
    const boundRevisionForEvidence = snapshot.memory_state.repository_revision;
    const evidenceManifest = await this.deps.memoryRepository.readManifest(boundRevisionForEvidence);
    if (evidenceManifest === null) {
      return rejected(
        "REJECTED_UNVERIFIED_EVIDENCE_MEMBER",
        `missing manifest for bound revision ${boundRevisionForEvidence}`
      );
    }
    const boundEpisodeRefs = new Set<string>(
      evidenceManifest.record_hashes.map((r) => r.ref)
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
      const u = proposal.updates.find((x) => x.dimension_id === d.dimension_id);
      return u === undefined ? d : { dimension_id: d.dimension_id, value: u.next_value };
    });
    const nextPersonality: PersonalityStateV0 = {
      schema_version: current.schema_version,
      dimensions: nextDimensions
    };
    const personalityDelta: DomainDeltaV0 = {
      producer: PERSONALITY_PRODUCER_ID,
      domain: "personality",
      expected_repository_revision: null,
      operations: [{ path: "/personality", value: nextPersonality }],
      provenance_refs: [...proposal.evidence_binding.member_refs]
    };

    const canonicalProposal: CanonicalTransitionProposalV1 = {
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
    };

    // ---- SubjectCore canonical commit (sole mutator) ----------------------------
    const payloadFingerprint = await proposalFingerprint(canonicalProposal);
    // Whole-state validation requires the proposal to carry the CURRENT memory
    // binding set (the personality delta is binding-neutral but must prove it
    // does not silently rebase the repository binding).
    const boundRevision = snapshot.memory_state.repository_revision;
    const manifest = await this.deps.memoryRepository.readManifest(boundRevision);
    if (manifest === null) {
      return rejected("REJECTED_INVALID_PROPOSAL", `missing manifest for bound revision ${boundRevision}`);
    }
    const repositoryBindings: readonly RepositoryRevisionBindingV1[] = [
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

    const preparedResultRef = parseRef(
      `workflow:w-pers-${transitionId.slice("t-personality-".length)}`,
      "personality.prepared_result_ref"
    );
    if (!preparedResultRef.ok) {
      return rejected("REJECTED_INVALID_PROPOSAL", preparedResultRef.error.detail);
    }

    const committed = await this.deps.subjectCore.commitReserved({
      proposal: canonicalProposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.issuer.issue([
        { producer: "personality", domain: "personality" }
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
      return rejected("REJECTED_INVALID_PROPOSAL", `commit outcome: ${committed.kind}`);
    }
    return { kind: "COMMITTED", bundle: committed.bundle, personality: nextPersonality };
  }
}
