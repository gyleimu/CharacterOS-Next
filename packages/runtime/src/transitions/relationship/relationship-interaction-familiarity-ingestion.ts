/**
 * Interaction Familiarity Experience Ingestion V0
 * (INTERACTION_FAMILIARITY_EXPERIENCE_INGESTION_V0, LEVEL_2).
 *
 * The FIRST causal path from lived experience to canonical state:
 *
 *   canonical EpisodicMemoryRecordV0
 *   → trusted episode verification (repository-owned payload hash + subject
 *     memory-revision binding + counterpart binding; a caller-supplied record
 *     is only a CARRIER — equality with the repository's authoritative content
 *     hash is what makes it evidence)
 *   → qualifying interaction admission (closed provider boundary: the three
 *     frozen qualifying classes or ABSTAIN; a semantic candidate is NOT
 *     canonical authority)
 *   → deterministic familiarity evidence receipt (the FROZEN
 *     relationship-interaction-familiarity-evidence-receipt-v0, derived ONLY
 *     after verification + admission)
 *   → existing interaction-familiarity accrual law (one unique admitted
 *     receipt = one credit; saturation at 32/32 = NO proposal)
 *   → existing governed writer authority (the ONE internal evaluation service)
 *   → existing Atomic Commit Bundle V2 pipeline (the ONE shared production
 *     commit path through the facade; no second pipeline)
 *   → committed canonical Relationship familiarity state
 *
 * The caller supplies an EXPERIENCE IDENTITY ONLY (subject, registered
 * counterpart, candidate episode). The request can NEVER supply: the
 * dimension id, a familiarity value, an increment, an evidence receipt ref, a
 * writer authority payload, an authority epoch, a canonical next value, a
 * provenance set, or any qualifying magnitude.
 *
 * DUPLICATE / REPLAY LAW: the ingestion transition id is DETERMINISTICALLY
 * derived from the experience identity (subject × counterpart × episode ref),
 * so an exact workflow retry resolves through the facade's existing committed/
 * replay semantics (ALREADY_COMMITTED / committed-record replay) instead of
 * re-crediting, and a genuinely new attempt to reuse already-credited evidence
 * is refused by the DURABLE accrual law over the trusted canonical history
 * (never an in-memory set): the prior authority's cumulative receipt set
 * already contains the receipt, so |R_next| = |R_prev| yields no lawful update.
 *
 * TRANSACTION LAW: there is no partial canonical mutation — every failure
 * (verification, admission, duplicate check, accrual, preparation, validation,
 * CAS) happens BEFORE the single atomic governed commit; the existing atomic
 * commit behavior is reused, no compensating framework exists.
 *
 * SATURATION: at 1 the episode may still be a perfectly valid experience, but
 * familiarity produces NO proposal and NO governed commit
 * (QUALIFIED_BUT_SATURATED — not a failure of the experience).
 *
 * RESULT SURFACE: observation facts only (qualification, class, familiarity
 * before/after, commit/transition refs). NEVER an authority capability,
 * prepared token, trusted-history capability or payload construction handle.
 *
 * Real-model calls: ZERO by contract — the admission provider is dependency-
 * injected by trusted Runtime composition; tests use deterministic providers.
 */

import type {
  AtomicCommitBundleAnyVersion,
  CanonicalRefV0,
  CanonicalTransitionProposalV1,
  HashV1,
  IdentifierV0,
  InMemoryFacadeAssembly,
  RepositoryRevisionBindingV1,
  SubjectStateV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import { createPersistenceEnvelope, hashEnvelope, proposalFingerprint, proposalRef } from "@characteros-next/subject-core";
import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import {
  computeMemoryRecordPayloadHash,
  validateEpisodicMemoryRecord,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";

import {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0
} from "./relationship-feature-decision-semantics.js";
import {
  deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0
} from "./relationship-interaction-familiarity-evidence-receipt.js";
import {
  deriveInteractionFamiliarityInitializationV0,
  deriveInteractionFamiliarityUpdateV0
} from "./relationship-interaction-familiarity-accrual-policy.js";
import {
  evaluateRelationshipGovernedWriteV0
} from "./relationship-governed-write-authority-service.js";
import {
  mintRelationshipGovernedTrustedHistoryCapabilityV0,
  lookupLatestRelationshipGovernedAuthorityV0
} from "../../authority/relationship-governed-trusted-history.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "../../authority/trusted-canonical-history-boundary.js";
import {
  deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0,
  deriveRelationshipGovernedFeatureWritePolicyFingerprintV0,
  deriveRelationshipGovernedWriterSchemaFingerprintV0,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0
} from "../../authority/historical-writer-authority-registry.js";
import {
  deriveRelationshipGovernedWritePolicyReceiptRefV0,
  type RelationshipGovernedWritePolicyReceiptDescriptorV0
} from "../../authority/relationship-governed-write-policy-receipt.js";
import {
  validateRelationshipGovernedFeatureWriterAuthorityPayloadV0,
  type RelationshipGovernedFeaturePreviousValueV0
} from "./relationship-governed-writer-authority.js";

export const RELATIONSHIP_INTERACTION_FAMILIARITY_INGESTION_SCHEMA_VERSION_V0 =
  "relationship-interaction-familiarity-experience-ingestion-v0" as const;

/** Deterministic transition-id projection for experience-derived ingests. */
const INGESTION_TRANSITION_ID_PROJECTION =
  "characteros-next/runtime/relationship-interaction-familiarity-ingestion-transition/v1" as const;

// ---- semantic admission provider boundary (closed) -----------------------------------

/** Closed admission outcomes: the three frozen qualifying classes or ABSTAIN. */
export const RELATIONSHIP_INTERACTION_QUALIFYING_ADMISSION_CLASSES_V0 = Object.freeze([
  "DIRECT_COMMUNICATION",
  "SHARED_ACTIVITY",
  "DIRECTLY_OBSERVED_COUNTERPART_ACTION",
  "ABSTAIN"
] as const);

export type RelationshipInteractionQualifyingAdmissionClassV0 =
  (typeof RELATIONSHIP_INTERACTION_QUALIFYING_ADMISSION_CLASSES_V0)[number];

/**
 * Minimum provider input: verified episode identity + semantic content ONLY.
 * The provider NEVER receives or emits the current/next familiarity value, an
 * increment, the relationship dimension id, writer authority, an authority
 * epoch, utility, a confidence-derived magnitude, or arbitrary evidence refs.
 * Its output is a semantic CANDIDATE ONLY — never canonical authority.
 */
export interface RelationshipInteractionQualifyingAdmissionInputV0 {
  readonly subject_id: IdentifierV0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly episode: EpisodicMemoryRecordV0;
}

export type RelationshipInteractionQualifyingAdmissionV0 =
  | {
      readonly kind: "QUALIFYING";
      readonly qualifying_class: Exclude<RelationshipInteractionQualifyingAdmissionClassV0, "ABSTAIN">;
    }
  | { readonly kind: "ABSTAIN" };

export interface RelationshipInteractionQualifyingAdmissionProviderV0 {
  admit(
    input: RelationshipInteractionQualifyingAdmissionInputV0
  ): Promise<RelationshipInteractionQualifyingAdmissionV0>;
}

// ---- request / deps / outcome ----------------------------------------------------------

/** The narrowest real ingestion request: an EXPERIENCE identity, nothing more. */
export interface ProcessInteractionExperienceRequestV0 {
  readonly subject_id: IdentifierV0;
  readonly counterpart_ref: CanonicalRefV0;
  /**
   * Candidate canonical episodic record. NOT trusted as authority: it is only
   * the carrier; the workflow proves byte-equality with the repository-owned
   * immutable payload before any admission runs.
   */
  readonly episode: EpisodicMemoryRecordV0;
}

/** Trusted Runtime composition deps. Never chosen by the request. */
export interface InteractionFamiliarityIngestionDepsV0 {
  /** Canonical memory authority (repository-owned payload hashes + verdicts). */
  readonly memory: MemoryPreparationAuthority;
  /** Sanctioned SubjectCore assembly (facade + read handle + trusted issuers). */
  readonly assembly: InMemoryFacadeAssembly;
  /** Closed qualifying-admission provider (deterministic in tests; zero model calls). */
  readonly admissionProvider: RelationshipInteractionQualifyingAdmissionProviderV0;
  /** Repository revision bindings used by governed commits (composition-owned). */
  readonly repositoryBindings: readonly RepositoryRevisionBindingV1[];
  /** Genesis (revision-0) snapshot reader for the trusted-history boundary. */
  readonly readGenesisSnapshot: (subjectId: string) => Promise<SubjectStateV0 | null>;
}

export type InteractionFamiliarityIngestionOutcomeV0 =
  | {
      readonly kind: "QUALIFIED_AND_COMMITTED";
      readonly transition_id: IdentifierV0;
      readonly commit_ref: CanonicalRefV0;
      readonly replayed: boolean;
      readonly qualifying_class: Exclude<RelationshipInteractionQualifyingAdmissionClassV0, "ABSTAIN">;
      readonly familiarity: {
        readonly previous: { readonly kind: "ABSENT" } | { readonly kind: "PRESENT"; readonly value: number };
        readonly next: number;
      };
      /** Cumulative admitted receipt set R_next (observation fact, not authority). */
      readonly evidence_receipt_refs: readonly CanonicalRefV0[];
    }
  | {
      readonly kind: "QUALIFIED_BUT_SATURATED";
      readonly qualifying_class: Exclude<RelationshipInteractionQualifyingAdmissionClassV0, "ABSTAIN">;
      readonly familiarity_current: number;
    }
  | { readonly kind: "NOT_QUALIFIED_ABSTAINED" }
  | {
      readonly kind: "REJECTED";
      readonly code: InteractionFamiliarityIngestionRejectionCodeV0;
      readonly detail: string;
    };

export type InteractionFamiliarityIngestionRejectionCodeV0 =
  | "EPISODE_MALFORMED"
  | "EPISODE_NOT_FOUND"
  | "EPISODE_PAYLOAD_HASH_MISMATCH"
  | "EPISODE_NOT_BOUND_TO_SUBJECT_MEMORY"
  | "EPISODE_DOES_NOT_REFERENCE_COUNTERPART"
  | "UNKNOWN_SUBJECT"
  | "COUNTERPART_NOT_REGISTERED"
  | "ADMISSION_PROVIDER_INVALID_OUTPUT"
  | "FAMILIARITY_STATE_UNLAWFUL"
  | "FAMILIARITY_DUPLICATE_RECEIPT"
  | "FAMILIARITY_SATURATED_NO_PROPOSAL"
  | "FAMILIARITY_REINITIALIZE_UNSUPPORTED"
  | "FAMILIARITY_PRIOR_NOT_RESOLVED_VALID"
  | "FAMILIARITY_DIMENSION_MISMATCH"
  | "FAMILIARITY_EVIDENCE_NOT_RECEIPT_REF"
  | "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH"
  | "FAMILIARITY_OFF_GRID_VALUE"
  | "FAMILIARITY_PRIOR_VALUE_MISMATCH"
  | "FAMILIARITY_VALUE_LAW_MISMATCH"
  | "FAMILIARITY_PRIOR_LINEAGE_MISMATCH"
  | "FAMILIARITY_PRIOR_LINEAGE_MALFORMED"
  | "CANONICAL_HISTORY_UNAVAILABLE"
  | "GOVERNED_WRITE_DENIED"
  | "COMMIT_REJECTED";

function rejected(
  code: InteractionFamiliarityIngestionRejectionCodeV0,
  detail: string
): InteractionFamiliarityIngestionOutcomeV0 {
  return { kind: "REJECTED", code, detail };
}

// ---- internal helpers --------------------------------------------------------------------

function isQualifyingAdmission(value: unknown): value is RelationshipInteractionQualifyingAdmissionV0 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v["kind"] === "ABSTAIN") return Object.keys(v).length === 1;
  if (v["kind"] === "QUALIFYING") {
    return (
      Object.keys(v).length === 2 &&
      typeof v["qualifying_class"] === "string" &&
      (RELATIONSHIP_INTERACTION_QUALIFYING_ADMISSION_CLASSES_V0 as readonly string[]).includes(
        v["qualifying_class"]
      ) &&
      v["qualifying_class"] !== "ABSTAIN"
    );
  }
  return false;
}

function rawAsciiSortUnique(refs: readonly CanonicalRefV0[]): CanonicalRefV0[] {
  return [...new Set<string>(refs as readonly string[])].sort().map((ref) => ref as CanonicalRefV0);
}

interface FamiliarityDimensionFacts {
  readonly present: boolean;
  readonly value: number | null;
}

function readFamiliarityDimension(
  state: SubjectStateV0,
  counterpartRef: string
): FamiliarityDimensionFacts | null {
  const relationships = (state as unknown as Record<string, unknown>)["relationships"];
  if (typeof relationships !== "object" || relationships === null) return null;
  const counterparts = (relationships as Record<string, unknown>)["counterparts"];
  if (!Array.isArray(counterparts)) return null;
  for (const counterpart of counterparts) {
    if (typeof counterpart !== "object" || counterpart === null) return null;
    const record = counterpart as Record<string, unknown>;
    if (record["counterpart_ref"] !== counterpartRef) continue;
    const dimensions = record["dimensions"];
    if (!Array.isArray(dimensions)) return { present: false, value: null };
    for (const dimension of dimensions) {
      if (typeof dimension !== "object" || dimension === null) return null;
      const dimRecord = dimension as Record<string, unknown>;
      if (dimRecord["dimension_id"] === INTERACTION_FAMILIARITY_DIMENSION_ID_V0) {
        return { present: true, value: dimRecord["value"] as number };
      }
    }
    return { present: false, value: null };
  }
  return null;
}

/** Deep-clones the canonical relationships and sets the familiarity dimension. */
function withFamiliarityValue(
  state: SubjectStateV0,
  counterpartRef: string,
  value: number
): Record<string, unknown> {
  const relationships = structuredClone(
    (state as unknown as Record<string, unknown>)["relationships"]
  ) as { counterparts: { counterpart_ref: string; dimensions: { dimension_id: string; value: unknown }[] }[] };
  const counterpart = relationships.counterparts.find(
    (candidate) => candidate.counterpart_ref === counterpartRef
  );
  if (counterpart === undefined) {
    throw new Error("ingestion: target counterpart disappeared from canonical relationships");
  }
  const dimensions = counterpart.dimensions.filter(
    (dimension) => dimension.dimension_id !== INTERACTION_FAMILIARITY_DIMENSION_ID_V0
  );
  dimensions.push({ dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0, value });
  // canonical projection law: dimensions are set-like, raw-ASCII sorted
  dimensions.sort((a, b) => (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0));
  counterpart.dimensions = dimensions;
  return relationships as unknown as Record<string, unknown>;
}

function headFactsOf(bundle: AtomicCommitBundleAnyVersion) {
  return {
    subject_id: bundle.subject_id,
    state_revision: bundle.next_revision,
    commit_ref: bundle.commit_ref,
    record_checksum: bundle.record_checksum,
    state_hash: bundle.state_hash_after,
    snapshot_hash: bundle.snapshot_hash_after
  };
}

async function deriveIngestionTransitionId(input: {
  readonly subject_id: string;
  readonly counterpart_ref: string;
  readonly episode_ref: string;
}): Promise<IdentifierV0> {
  const hash = await hashEnvelope(INGESTION_TRANSITION_ID_PROJECTION, {
    subject_id: input.subject_id,
    counterpart_ref: input.counterpart_ref,
    episode_ref: input.episode_ref
  });
  return `t-fam-ingest-${hash.replace("sha256:", "")}` as IdentifierV0;
}

// ---- the ONE ingestion workflow ------------------------------------------------------------

/**
 * Processes one experienced event. The caller asks CharacterOS to derive a
 * lawful familiarity transition from a canonical experience; it never asks
 * CharacterOS to set a Relationship scalar.
 */
export async function processInteractionExperience(
  deps: InteractionFamiliarityIngestionDepsV0,
  request: ProcessInteractionExperienceRequestV0
): Promise<InteractionFamiliarityIngestionOutcomeV0> {
  // 1. Closed-record validation of the candidate carrier.
  const record = validateEpisodicMemoryRecord(request.episode);
  if (!record.ok) {
    return rejected("EPISODE_MALFORMED", `candidate episode is not a closed EpisodicMemoryRecordV0: ${record.error.detail}`);
  }
  const episode = record.value;

  // 2. Counterpart reference binding: the verified episode must structurally
  //    reference the exact requested registered counterpart.
  if (!(episode.references as readonly string[]).includes(request.counterpart_ref)) {
    return rejected(
      "EPISODE_DOES_NOT_REFERENCE_COUNTERPART",
      `episode ${episode.episode_ref} does not reference counterpart ${request.counterpart_ref}`
    );
  }

  // 3. Trusted episode verification against the canonical memory authority.
  //    The caller-supplied record object is NEVER authority: the repository's
  //    authoritative content hash must EXACTLY equal the carrier's canonical
  //    payload hash (any divergence — forged, stale or mutated clone — fails).
  const authoritativeHash = await deps.memory.payloadHashOf(episode.episode_ref);
  if (authoritativeHash === null) {
    return rejected("EPISODE_NOT_FOUND", `episode ${episode.episode_ref} does not exist in the canonical memory source`);
  }
  const carrierHash = await computeMemoryRecordPayloadHash(episode);
  if (carrierHash !== authoritativeHash) {
    return rejected(
      "EPISODE_PAYLOAD_HASH_MISMATCH",
      "candidate episode payload does not match the repository-owned immutable record (a caller-supplied object is not evidence)"
    );
  }

  // 4. Current canonical state (read-only, facade-authoritative).
  const currentState = await deps.assembly.storeRead.readCurrentState(request.subject_id);
  if (currentState === null) {
    return rejected("UNKNOWN_SUBJECT", `subject ${request.subject_id} has no canonical state`);
  }

  // 5. Counterpart registration law: registration first, familiarity as a
  //    separate governed commit. No auto-registration, no multi-effect op.
  const counterparts = (currentState as unknown as Record<string, unknown>)["relationships"] as
    | { counterparts: readonly { counterpart_ref: string }[] }
    | undefined;
  const registered = counterparts?.counterparts.some(
    (candidate) => candidate.counterpart_ref === request.counterpart_ref
  );
  if (registered !== true) {
    return rejected(
      "COUNTERPART_NOT_REGISTERED",
      `counterpart ${request.counterpart_ref} is not canonically registered; registration must precede familiarity ingestion`
    );
  }

  // 6. Subject binding: the episode must belong to the subject's CURRENT bound
  //    canonical memory revision (durable verdict, not caller prose).
  const memoryRevision = ((currentState as unknown as Record<string, unknown>)["memory_state"] as
    | { repository_revision: string }
    | undefined)?.repository_revision;
  if (typeof memoryRevision !== "string") {
    return rejected("FAMILIARITY_STATE_UNLAWFUL", "current canonical state carries no memory repository revision");
  }
  const belongsToSubject = await deps.memory.validateRefsBelong(
    memoryRevision as never,
    [episode.episode_ref]
  );
  if (!belongsToSubject) {
    return rejected(
      "EPISODE_NOT_BOUND_TO_SUBJECT_MEMORY",
      `episode ${episode.episode_ref} is not bound to the subject's current canonical memory revision`
    );
  }

  // 7. Qualifying interaction admission (closed provider boundary).
  let admission: RelationshipInteractionQualifyingAdmissionV0;
  try {
    const providerOutput = await deps.admissionProvider.admit({
      subject_id: request.subject_id,
      counterpart_ref: request.counterpart_ref,
      episode
    });
    if (!isQualifyingAdmission(providerOutput)) {
      return rejected(
        "ADMISSION_PROVIDER_INVALID_OUTPUT",
        "the admission provider returned a value outside the closed qualifying/ABSTAIN vocabulary"
      );
    }
    admission = providerOutput;
  } catch (error) {
    return rejected(
      "ADMISSION_PROVIDER_INVALID_OUTPUT",
      `the admission provider failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (admission.kind === "ABSTAIN") {
    return { kind: "NOT_QUALIFIED_ABSTAINED" };
  }
  const qualifyingClass = admission.qualifying_class;

  // 8. Deterministic familiarity evidence receipt — derived ONLY after
  //    authoritative verification + qualifying admission. Binds the
  //    REPOSITORY-authoritative payload hash (never the carrier's claim).
  const receiptRef = await deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0({
    schema_version: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0,
    subject_id: request.subject_id,
    counterpart_ref: request.counterpart_ref,
    episode_ref: episode.episode_ref,
    episode_payload_hash: authoritativeHash,
    qualifying_class: qualifyingClass,
    evidence_admission_policy_id: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0
  });

  // 9. Deterministic workflow identity: subject × counterpart × episode.
  const transitionId = await deriveIngestionTransitionId({
    subject_id: request.subject_id,
    counterpart_ref: request.counterpart_ref,
    episode_ref: episode.episode_ref
  });

  // 10. Existing committed/replay semantics: an exact workflow retry resolves
  //     to the original authoritative outcome instead of re-crediting.
  const existing = deps.assembly.storeRead.readCommittedByTransitionId(transitionId);
  if (existing !== null) {
    return committedOutcomeFromBundle(existing, transitionId, qualifyingClass, true);
  }

  // 11. Current familiarity facts (grid-exact or fail closed).
  const familiarity = readFamiliarityDimension(currentState, request.counterpart_ref);
  if (familiarity === null) {
    return rejected("FAMILIARITY_STATE_UNLAWFUL", "canonical relationships are not readable for the target counterpart");
  }
  if (familiarity.present) {
    const grid = familiarity.value !== null && Number.isFinite(familiarity.value) ? familiarity.value * 32 : Number.NaN;
    if (!Number.isInteger(grid) || (familiarity.value as number) < 0 || (familiarity.value as number) > 1) {
      return rejected("FAMILIARITY_STATE_UNLAWFUL", "current familiarity value is not on the k/32 credit grid");
    }
  }

  // 12. Trusted canonical history capability (frozen mint path: boundary +
  //     full chain VALID + exact terminal head).
  const bundles = deps.assembly.storeRead.getCommittedBundles();
  const head = bundles[bundles.length - 1];
  if (head === undefined) {
    return rejected(
      "CANONICAL_HISTORY_UNAVAILABLE",
      "the trusted-history capability requires a positive canonical head; no commit exists yet"
    );
  }
  const genesis = await deps.readGenesisSnapshot(request.subject_id);
  if (genesis === null) {
    return rejected("CANONICAL_HISTORY_UNAVAILABLE", "the genesis snapshot is unavailable for the trusted-history boundary");
  }
  const genesisEnvelope = await createPersistenceEnvelope({
    snapshot: genesis,
    repository_bindings: deps.repositoryBindings,
    commit_head: null
  });
  if (!genesisEnvelope.ok) {
    return rejected("CANONICAL_HISTORY_UNAVAILABLE", "genesis envelope creation failed");
  }
  const boundary = await mintTrustedCanonicalHistoryBoundaryV0({
    genesis: genesisEnvelope.value,
    head: {
      schema_version: "trusted-canonical-head-v0",
      subject_id: head.subject_id,
      revision: head.next_revision,
      commit_ref: head.commit_ref,
      record_checksum: head.record_checksum,
      state_hash: head.state_hash_after,
      snapshot_hash: head.snapshot_hash_after
    } as never
  });
  if (boundary.kind !== "MINTED") {
    return rejected("CANONICAL_HISTORY_UNAVAILABLE", `trusted-history boundary mint failed: ${boundary.detail}`);
  }
  const capabilityMint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
    trusted_boundary: boundary.receipt,
    bundles,
    current_head: headFactsOf(head)
  });
  if (capabilityMint.kind !== "MINTED") {
    return rejected("CANONICAL_HISTORY_UNAVAILABLE", `trusted-history capability mint failed: ${capabilityMint.detail}`);
  }
  const capability = capabilityMint.capability;

  // 13. Accrual law: derive the ONE lawful transition.
  const targetPrevious: RelationshipGovernedFeaturePreviousValueV0 =
    familiarity.present && familiarity.value !== null
      ? { kind: "PRESENT", value: familiarity.value as UnitIntervalV0 }
      : { kind: "ABSENT" };
  let operation: "INITIALIZE" | "UPDATE";
  let nextReceiptRefs: readonly CanonicalRefV0[];
  let nextValue: number;
  let priorAuthority:
    | { readonly kind: "NONE" }
    | { readonly kind: "PRIOR"; readonly commit_ref: CanonicalRefV0; readonly authority_payload_hash: HashV1 };
  let priorEpoch: IdentifierV0 | null = null;
  if (!familiarity.present) {
    const derived = deriveInteractionFamiliarityInitializationV0({ evidence_receipt_refs: [receiptRef] });
    if (!derived.ok) return rejected(derived.code, derived.detail);
    operation = "INITIALIZE";
    nextReceiptRefs = derived.receipt_refs;
    nextValue = derived.next_value;
    priorAuthority = { kind: "NONE" };
  } else {
    const lookup = await lookupLatestRelationshipGovernedAuthorityV0({
      capability,
      bundles,
      subject_id: request.subject_id,
      counterpart_ref: request.counterpart_ref,
      dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0
    });
    if (lookup.kind === "UNTRUSTED_CAPABILITY") {
      return rejected("CANONICAL_HISTORY_UNAVAILABLE", lookup.detail);
    }
    if (lookup.kind === "NO_MATCHING_AUTHORITY") {
      return rejected(
        "FAMILIARITY_REINITIALIZE_UNSUPPORTED",
        "a present familiarity target without a proven prior authority cannot bootstrap (REINITIALIZE is not authorized by ordinary familiarity V0)"
      );
    }
    if (lookup.status !== "RESOLVED_VALID") {
      return rejected(
        "FAMILIARITY_PRIOR_NOT_RESOLVED_VALID",
        `latest matching familiarity authority is ${lookup.status}; UPDATE requires RESOLVED_VALID`
      );
    }
    const priorReceiptRefs = lookup.payload.evidence_receipt_refs;
    const proposed = rawAsciiSortUnique([...priorReceiptRefs, receiptRef]);
    const derived = deriveInteractionFamiliarityUpdateV0({
      prior_receipt_refs: priorReceiptRefs,
      proposed_receipt_refs: proposed,
      previous_value: familiarity.value as number
    });
    if (!derived.ok) {
      if (derived.code === "FAMILIARITY_SATURATED_NO_PROPOSAL") {
        return {
          kind: "QUALIFIED_BUT_SATURATED",
          qualifying_class: qualifyingClass,
          familiarity_current: familiarity.value as number
        };
      }
      return rejected(derived.code, derived.detail);
    }
    operation = "UPDATE";
    nextReceiptRefs = derived.receipt_refs;
    nextValue = derived.next_value;
    priorAuthority = {
      kind: "PRIOR",
      commit_ref: lookup.commit_ref,
      authority_payload_hash: lookup.authority_payload_hash
    };
    priorEpoch = lookup.payload.authority_epoch_start_transition_id;
  }

  // 14. Deterministic write-policy receipt (bound into proposal external_refs
  //     per the frozen governed external_refs law: exactly [receipt ref]).
  const [gateFingerprint, policyFingerprint] = await Promise.all([
    deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0(),
    deriveRelationshipGovernedFeatureWritePolicyFingerprintV0()
  ]);
  const receiptDescriptor: RelationshipGovernedWritePolicyReceiptDescriptorV0 = {
    schema_version: "relationship-governed-write-policy-receipt-v0",
    transition_id: transitionId,
    subject_id: request.subject_id,
    expected_revision: currentState.runtime_metadata.state_revision,
    counterpart_ref: request.counterpart_ref,
    dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
    operation_kind: operation,
    previous: targetPrevious,
    next: { kind: "PRESENT", value: nextValue },
    feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
    feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
    authorization_gate_fingerprint: gateFingerprint,
    write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
    write_policy_fingerprint: policyFingerprint,
    evidence_receipt_refs: nextReceiptRefs,
    previous_governed_authority: priorAuthority,
    authority_epoch_start_transition_id:
      operation === "UPDATE" && priorEpoch !== null ? priorEpoch : transitionId
  };
  const writePolicyReceiptRef = await deriveRelationshipGovernedWritePolicyReceiptRefV0(receiptDescriptor);

  // 15. Canonical governed proposal (the ONE shared V2 pipeline input).
  const proposal: CanonicalTransitionProposalV1 = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: request.subject_id,
    transition_type: "Relationship",
    expected_state_revision: currentState.runtime_metadata.state_revision,
    time_input: {
      kind: "OCCURRENCE",
      occurrence_logical_time: currentState.runtime_metadata.logical_time
    },
    cause_refs: nextReceiptRefs,
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [
          { path: "/relationships", value: withFamiliarityValue(currentState, request.counterpart_ref, nextValue) }
        ],
        provenance_refs: nextReceiptRefs
      }
    ],
    external_refs: [writePolicyReceiptRef]
  } as unknown as CanonicalTransitionProposalV1;

  // 16. The ONE internal governed-write evaluation (admission, evidence
  //     binding, prior lookup, operation classification, familiarity law,
  //     receipt re-derivation, prepared capability).
  const [proposalRefValue, proposalFingerprintValue] = await Promise.all([
    proposalRef(proposal),
    proposalFingerprint(proposal)
  ]);
  const evaluation = await evaluateRelationshipGovernedWriteV0({
    proposal: {
      proposal_ref: proposalRefValue,
      payload_fingerprint: proposalFingerprintValue,
      subject_id: request.subject_id,
      expected_revision: currentState.runtime_metadata.state_revision,
      transition_id: transitionId,
      cause_refs: nextReceiptRefs,
      external_refs: [writePolicyReceiptRef],
      relationship_delta_provenance_refs: nextReceiptRefs
    },
    target: {
      counterpart_ref: request.counterpart_ref,
      dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
      previous: targetPrevious,
      next: { kind: "PRESENT", value: nextValue }
    },
    feature: {
      feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
      feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
    },
    evidence_receipt_refs: nextReceiptRefs,
    history: { capability, bundles: bundles as never },
    expected_receipt_ref: writePolicyReceiptRef
  });
  if (evaluation.kind === "DENIED") {
    return rejected("GOVERNED_WRITE_DENIED", `${evaluation.code}: ${evaluation.detail}`);
  }

  // 17. Prepare the existing governed writer authority (17-field payload →
  //     membrane token via the trusted assembly issuer).
  const authorityPayload = {
    schema_version: "relationship-governed-feature-writer-authority-payload-v0",
    operation_kind: evaluation.operation,
    subject_id: request.subject_id,
    expected_revision: currentState.runtime_metadata.state_revision,
    counterpart_ref: request.counterpart_ref,
    dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
    previous: targetPrevious,
    next: { kind: "PRESENT", value: nextValue },
    relationship_state_schema_version: "relationship-state-v0",
    feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
    feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
    write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
    write_policy_fingerprint: policyFingerprint,
    evidence_receipt_refs: nextReceiptRefs,
    write_policy_receipt_ref: evaluation.write_policy_receipt_ref,
    authority_epoch_start_transition_id: evaluation.authority_epoch_start_transition_id,
    previous_governed_authority: priorAuthority
  };
  const payloadChecked = validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(authorityPayload);
  if (!payloadChecked.ok) {
    return rejected("GOVERNED_WRITE_DENIED", `authority payload invalid: ${payloadChecked.error.detail}`);
  }
  const token = deps.assembly.preparedGovernedWriterAuthorityIssuer.issue({
    proposal_ref: proposalRefValue,
    payload_fingerprint: proposalFingerprintValue,
    subject_id: request.subject_id as never,
    expected_revision: currentState.runtime_metadata.state_revision,
    history_head_commit_ref: head.commit_ref,
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    writer_class: evaluation.operation as never,
    writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0 as never,
    writer_schema_fingerprint: await deriveRelationshipGovernedWriterSchemaFingerprintV0(),
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0 as never,
    authorization_gate_fingerprint: gateFingerprint,
    authority_payload: authorityPayload
  });

  // 18. Existing production V2 pipeline: reserve → commit (single atomic
  //     mutation; no partial familiarity advance is possible).
  const reserved = await deps.assembly.facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") {
    if (reserved.kind === "ALREADY_COMMITTED") {
      return committedOutcomeFromBundle(reserved.bundle, transitionId, qualifyingClass, true);
    }
    return rejected(
      "COMMIT_REJECTED",
      `reservation did not continue: ${reserved.kind}`
    );
  }
  const committed = await deps.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: deps.assembly.producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: transitionId as never,
      subject_id: request.subject_id as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: `workflow:w-${transitionId}` as never
    },
    repository_bindings: deps.repositoryBindings,
    prepared_governed_writer_authority: token
  });
  if (committed.kind !== "COMMITTED") {
    const failure = (committed as { failure?: { detail?: string } }).failure;
    return rejected("COMMIT_REJECTED", failure?.detail ?? `commit outcome: ${committed.kind}`);
  }
  return committedOutcomeFromBundle(committed.bundle, transitionId, qualifyingClass, false);
}

function committedOutcomeFromBundle(
  bundle: AtomicCommitBundleAnyVersion,
  transitionId: IdentifierV0,
  qualifyingClass: Exclude<RelationshipInteractionQualifyingAdmissionClassV0, "ABSTAIN">,
  replayed: boolean
): InteractionFamiliarityIngestionOutcomeV0 {
  const authority = (bundle as { writer_authority?: unknown }).writer_authority as
    | {
        authority_payload?: {
          previous?: { kind: string; value?: number };
          next?: { value: number };
          evidence_receipt_refs?: readonly string[];
        };
      }
    | null
    | undefined;
  const payload = authority?.authority_payload;
  const previous =
    payload?.previous?.kind === "ABSENT"
      ? ({ kind: "ABSENT" } as const)
      : ({ kind: "PRESENT", value: payload?.previous?.value as number } as const);
  return {
    kind: "QUALIFIED_AND_COMMITTED",
    transition_id: transitionId,
    commit_ref: bundle.commit_ref,
    replayed,
    qualifying_class: qualifyingClass,
    familiarity: {
      previous,
      next: payload?.next?.value as number
    },
    evidence_receipt_refs: (payload?.evidence_receipt_refs ?? []) as readonly CanonicalRefV0[]
  };
}
