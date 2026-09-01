/**
 * Belief Semantic Candidate / Target Resolution V0 — runtime-only contract.
 *
 * Decides, from (a) VERIFIED episodic evidence and (b) a CharacterOS-supplied
 * bounded proposition catalog built from the canonical BeliefState, exactly one
 * of:
 *
 *   EXISTING_PROPOSITION: SUPPORTS | CONTRADICTS
 *   NEW_PROPOSITION_CANDIDATE: proposed_label only
 *   NO_BEARING
 *
 * AUTHORITY (frozen):
 *  - proposition candidate universe: CHARACTEROS (caller supplies explicit
 *    proposition ids; labels come exclusively from canonical BeliefState)
 *  - evidence universe: CHARACTEROS (validated against the exact bound
 *    repository revision; the provider sees the entire validated set and can
 *    never widen it)
 *  - model/provider: NO canonical mutation authority, NO numeric authority,
 *    NO proposition identity authority, NO proposition-key authority, NO
 *    initial-credence authority
 *  - canonical mutation: SUBJECT_CORE_ONLY (this runner touches NO canonical
 *    state at all — read-only semantic layer)
 *
 * NEW_PROPOSITION_CANDIDATE policy: MODEL_PROPOSES_LABEL_ONLY. The accepted
 * candidate is NON-CANONICAL, NON-PERSISTENT, and is NOT a
 * BeliefMutationProposalV0 INSERT (no proposition_key, no initial_credence, no
 * identity authority). NO code path exists from a semantic result to
 * BeliefTransitionExecutor.
 *
 * Provider call semantics: AT MOST ONCE per run (EXACTLY ONCE for valid
 * preconditions). No retry, no fallback, no repair. Provider exceptions remain
 * provider failures and are NEVER converted into NO_BEARING.
 *
 * Capability: an accepted resolution is trusted only through a module-private,
 * process-local WeakSet. A JSON clone or structural reconstruction of a
 * resolution FAILS the capability check even when byte-identical.
 */

import type {
  EpisodicMemoryRecordV0,
  MemoryPreparationAuthority
} from "@characteros-next/memory";
import { computeMemoryRecordPayloadHash, validateEpisodicMemoryRecord } from "@characteros-next/memory";
import type { HashV1, IdentifierV0, SubjectStateV0 } from "@characteros-next/subject-core";
import {
  hashEnvelope,
  isRecord,
  validateBeliefPropositionLabel,
  validateIdentifier
} from "@characteros-next/subject-core";
import {
  deriveBeliefEvidenceMemberSetFingerprint,
  type BeliefEvidenceBindingV0
} from "./belief-mutation-proposal.js";

export const BELIEF_SEMANTIC_PROPOSITION_CATALOG_SCHEMA_VERSION =
  "belief-semantic-proposition-catalog-v0" as const;
export const BELIEF_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION =
  "belief-semantic-evidence-projection-v0" as const;
export const BELIEF_SEMANTIC_PROVIDER_INPUT_SCHEMA_VERSION =
  "belief-semantic-provider-input-v0" as const;
export const BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION =
  "belief-semantic-provider-output-v0" as const;
export const BELIEF_SEMANTIC_TARGET_RESOLUTION_SCHEMA_VERSION =
  "belief-semantic-target-resolution-v0" as const;

export const BELIEF_SEMANTIC_PROPOSITION_CATALOG_FINGERPRINT_PROJECTION =
  "characteros-next/belief/semantic-proposition-catalog/v1" as const;
export const BELIEF_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION =
  "characteros-next/belief/semantic-context/v1" as const;

export const BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS = 64 as const;
export const BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES = 32 as const;

export const BELIEF_SEMANTIC_RELATIONS = ["SUPPORTS", "CONTRADICTS"] as const;
export type BeliefSemanticRelationV0 = (typeof BELIEF_SEMANTIC_RELATIONS)[number];

/** Episode ref exactly as bound by the frozen Foundation evidence binding. */
type BeliefSemanticEpisodeRef = BeliefEvidenceBindingV0["member_refs"][number];

/** Provider-visible proposition candidate: NO credence, NO evidence history. */
export interface BeliefSemanticPropositionCandidateV0 {
  readonly proposition_id: IdentifierV0;
  readonly proposition_label: string;
}

export interface BeliefSemanticPropositionCatalogV0 {
  readonly schema_version: typeof BELIEF_SEMANTIC_PROPOSITION_CATALOG_SCHEMA_VERSION;
  readonly propositions: readonly BeliefSemanticPropositionCandidateV0[];
}

/** Provider-visible evidence entry: content fields only, no scores/hashes. */
export interface BeliefSemanticEvidenceEntryV0 {
  readonly episode_ref: BeliefSemanticEpisodeRef;
  readonly occurrence_logical_time: number;
  readonly scene: string;
}

export interface BeliefSemanticEvidenceProjectionV0 {
  readonly schema_version: typeof BELIEF_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION;
  readonly evidence: readonly BeliefSemanticEvidenceEntryV0[];
}

export interface BeliefSemanticTargetResolutionProviderInputV0 {
  readonly schema_version: typeof BELIEF_SEMANTIC_PROVIDER_INPUT_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly evidence: BeliefSemanticEvidenceProjectionV0;
  readonly catalog: BeliefSemanticPropositionCatalogV0;
  readonly semantic_context_fingerprint: HashV1;
  readonly candidate_catalog_fingerprint: HashV1;
}

export interface BeliefSemanticTargetResolutionProviderV0 {
  propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown>;
}

/** Provider output: closed three-branch union; untrusted until fully validated. */
export type BeliefSemanticProviderOutputV0 =
  | {
      readonly schema_version: typeof BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION;
      readonly kind: "EXISTING_PROPOSITION";
      readonly proposition_id: IdentifierV0;
      readonly relation: BeliefSemanticRelationV0;
      readonly semantic_context_fingerprint: HashV1;
      readonly candidate_catalog_fingerprint: HashV1;
    }
  | {
      readonly schema_version: typeof BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION;
      readonly kind: "NEW_PROPOSITION_CANDIDATE";
      readonly proposed_label: string;
      readonly semantic_context_fingerprint: HashV1;
      readonly candidate_catalog_fingerprint: HashV1;
    }
  | {
      readonly schema_version: typeof BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION;
      readonly kind: "NO_BEARING";
      readonly semantic_context_fingerprint: HashV1;
      readonly candidate_catalog_fingerprint: HashV1;
    };

/** Frozen decision branch of an accepted resolution. */
export type BeliefSemanticTargetDecisionV0 =
  | {
      readonly kind: "EXISTING_PROPOSITION";
      readonly proposition_id: IdentifierV0;
      readonly relation: BeliefSemanticRelationV0;
    }
  | { readonly kind: "NEW_PROPOSITION_CANDIDATE"; readonly proposed_label: string }
  | { readonly kind: "NO_BEARING" };

/** Accepted host result: exact state/catalog/evidence binding, deeply frozen. */
export interface BeliefSemanticTargetResolutionV0 {
  readonly schema_version: typeof BELIEF_SEMANTIC_TARGET_RESOLUTION_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly semantic_context_fingerprint: HashV1;
  readonly candidate_catalog_fingerprint: HashV1;
  readonly evidence_binding: BeliefEvidenceBindingV0;
  readonly decision: BeliefSemanticTargetDecisionV0;
}

export type BeliefSemanticTargetResolutionRunResultV0 =
  | { readonly ok: true; readonly resolution: BeliefSemanticTargetResolutionV0; readonly providerCalls: 1 }
  | { readonly ok: false; readonly code: string; readonly detail: string; readonly providerCalls: 0 | 1 };

/** Module-private, process-local capability store (NEVER serialized). */
const acceptedCapabilities = new WeakSet<object>();

/** Only resolutions minted by THIS module's runner pass this check. */
export function isAuthorizedBeliefSemanticTargetResolutionV0(
  candidate: unknown
): candidate is BeliefSemanticTargetResolutionV0 {
  return (
    isRecord(candidate) &&
    acceptedCapabilities.has(candidate) &&
    candidate["schema_version"] === BELIEF_SEMANTIC_TARGET_RESOLUTION_SCHEMA_VERSION
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

function rawAsciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const EXISTING_KEYS = [
  "schema_version",
  "kind",
  "proposition_id",
  "relation",
  "semantic_context_fingerprint",
  "candidate_catalog_fingerprint"
];
const NEW_KEYS = [
  "schema_version",
  "kind",
  "proposed_label",
  "semantic_context_fingerprint",
  "candidate_catalog_fingerprint"
];
const NO_BEARING_KEYS = ["schema_version", "kind", "semantic_context_fingerprint", "candidate_catalog_fingerprint"];

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function isHashV1(v: unknown): v is HashV1 {
  return typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v);
}

export interface BeliefSemanticTargetResolutionRunnerInputV0 {
  /** Exact canonical snapshot binding: catalog + repository revision come from THIS state. */
  readonly subjectState: SubjectStateV0;
  /** Explicit CharacterOS-owned candidate universe (0..64 unique registered ids). */
  readonly proposition_ids: readonly IdentifierV0[];
  /** Exact selected evidence set (1..32 unique episode records of the bound revision). */
  readonly selected_episodes: readonly EpisodicMemoryRecordV0[];
  readonly provider: BeliefSemanticTargetResolutionProviderV0;
}

export interface BeliefSemanticTargetResolutionRunnerDepsV0 {
  readonly memoryRepository: MemoryPreparationAuthority;
}

/**
 * Runs the semantic target resolution. Fail-closed at every gate; the provider
 * is called AT MOST ONCE and only after all pre-provider validation passes.
 */
export async function runBeliefSemanticTargetResolutionV0(
  deps: BeliefSemanticTargetResolutionRunnerDepsV0,
  input: BeliefSemanticTargetResolutionRunnerInputV0
): Promise<BeliefSemanticTargetResolutionRunResultV0> {
  const reject = (code: string, detail: string, providerCalls: 0 | 1 = 0) =>
    ({ ok: false as const, code, detail, providerCalls });
  const snapshot = input.subjectState;

  // ---- 1. proposition candidate universe (CharacterOS-owned) ------------------
  if (!Array.isArray(input.proposition_ids)) {
    return reject("INVALID_CANDIDATE_IDS", "proposition_ids: expected array");
  }
  if (input.proposition_ids.length > BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS) {
    return reject(
      "INVALID_CANDIDATE_IDS",
      `proposition_ids: exceeds ${BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS}`
    );
  }
  const seenIds = new Set<string>();
  for (const id of input.proposition_ids) {
    const checked = validateIdentifier(id, "proposition_ids[]");
    if (!checked.ok) return reject("INVALID_CANDIDATE_IDS", checked.error.detail);
    if (seenIds.has(checked.value)) {
      return reject("INVALID_CANDIDATE_IDS", `proposition_ids: duplicate ${checked.value}`);
    }
    seenIds.add(checked.value);
  }
  // Labels come EXCLUSIVELY from canonical BeliefState; unknown ids reject
  // BEFORE any provider call.
  const canonicalItems = new Map(
    snapshot.beliefs.items.map((item) => [item.proposition_id as string, item])
  );
  const candidates: { proposition_id: IdentifierV0; proposition_label: string }[] = [];
  for (const id of input.proposition_ids) {
    const item = canonicalItems.get(id as string);
    if (item === undefined) {
      return reject(
        "UNREGISTERED_PROPOSITION_ID",
        `proposition_ids: ${id as string} is not registered in canonical BeliefState`
      );
    }
    candidates.push({
      proposition_id: item.proposition_id,
      proposition_label: item.proposition_label
    });
  }
  candidates.sort((a, b) => rawAsciiCompare(a.proposition_id as string, b.proposition_id as string));
  const catalog = deepFreeze({
    schema_version: BELIEF_SEMANTIC_PROPOSITION_CATALOG_SCHEMA_VERSION,
    propositions: candidates
  });
  const catalogIds = new Set(candidates.map((candidate) => candidate.proposition_id as string));

  // ---- 2. evidence universe (validated against the exact bound revision) ------
  if (!Array.isArray(input.selected_episodes)) {
    return reject("INVALID_EVIDENCE", "selected_episodes: expected array");
  }
  if (
    input.selected_episodes.length === 0 ||
    input.selected_episodes.length > BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES
  ) {
    return reject(
      "INVALID_EVIDENCE",
      `selected_episodes: 1..${BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES} required`
    );
  }
  const repositoryRevision = snapshot.memory_state.repository_revision as string;
  const manifest = await deps.memoryRepository.readManifest(repositoryRevision as never);
  if (manifest === null) {
    return reject("INVALID_EVIDENCE", `missing manifest for bound revision ${repositoryRevision}`);
  }
  if (manifest.repository_revision !== repositoryRevision) {
    return reject(
      "INVALID_EVIDENCE",
      `manifest revision ${manifest.repository_revision} does not match bound revision ${repositoryRevision}`
    );
  }
  const manifestHashes = new Map(
    manifest.record_hashes.map((entry) => [entry.ref as string, entry.payload_hash as string])
  );
  const sortedRecords = [...input.selected_episodes].sort((a, b) =>
    rawAsciiCompare(a.episode_ref as string, b.episode_ref as string)
  );
  const seenEpisodes = new Set<string>();
  for (const record of sortedRecords) {
    const checked = validateEpisodicMemoryRecord(record);
    if (!checked.ok) return reject("INVALID_EVIDENCE", checked.error.detail);
    const ref = checked.value.episode_ref as string;
    if (seenEpisodes.has(ref)) return reject("INVALID_EVIDENCE", `duplicate episode_ref ${ref}`);
    seenEpisodes.add(ref);
    if (!manifestHashes.has(ref)) {
      return reject("INVALID_EVIDENCE", `evidence ${ref} is not present in bound revision ${repositoryRevision}`);
    }
    const suppliedHash = await computeMemoryRecordPayloadHash(checked.value);
    if (suppliedHash !== manifestHashes.get(ref)) {
      return reject("INVALID_EVIDENCE", `evidence ${ref} payload hash does not match the bound manifest`);
    }
  }
  const evidenceProjection = deepFreeze({
    schema_version: BELIEF_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION,
    evidence: sortedRecords.map(
      (record): BeliefSemanticEvidenceEntryV0 => ({
        episode_ref: record.episode_ref as BeliefSemanticEpisodeRef,
        occurrence_logical_time: record.occurrence_logical_time,
        scene: record.context.scene
      })
    )
  });

  // ---- 3. fingerprints over the exact provider-visible structures -------------
  const semanticContextFingerprint = await hashEnvelope(
    BELIEF_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION,
    evidenceProjection
  );
  const candidateCatalogFingerprint = await hashEnvelope(
    BELIEF_SEMANTIC_PROPOSITION_CATALOG_FINGERPRINT_PROJECTION,
    catalog
  );

  // ---- 4. frozen provider input (deep freeze before the single call) ----------
  const providerInput = deepFreeze({
    schema_version: BELIEF_SEMANTIC_PROVIDER_INPUT_SCHEMA_VERSION,
    subject_id: snapshot.identity.subject_id,
    state_revision: snapshot.runtime_metadata.state_revision,
    repository_revision: repositoryRevision,
    evidence: evidenceProjection,
    catalog,
    semantic_context_fingerprint: semanticContextFingerprint,
    candidate_catalog_fingerprint: candidateCatalogFingerprint
  });

  // ---- 5. EXACTLY ONE provider call; no retry, no fallback, no repair ---------
  let raw: unknown;
  try {
    raw = await input.provider.propose(providerInput);
  } catch (error) {
    return reject(
      "PROVIDER_FAILURE",
      `belief semantic provider failed: ${error instanceof Error ? error.message : "unknown failure"}`,
      1
    );
  }

  // ---- 6. closed-shape validation of the untrusted output ----------------------
  if (!isRecord(raw)) {
    return reject("INVALID_PROVIDER_OUTPUT", "provider output: expected object", 1);
  }
  if (raw["schema_version"] !== BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION) {
    return reject("INVALID_PROVIDER_OUTPUT", "provider output.schema_version", 1);
  }
  const kind = raw["kind"];
  const contextEcho = raw["semantic_context_fingerprint"];
  const catalogEcho = raw["candidate_catalog_fingerprint"];
  if (!isHashV1(contextEcho) || contextEcho !== semanticContextFingerprint) {
    return reject("STALE_SEMANTIC_CONTEXT", "provider output is bound to a different semantic context", 1);
  }
  if (!isHashV1(catalogEcho) || catalogEcho !== candidateCatalogFingerprint) {
    return reject("STALE_CANDIDATE_CATALOG", "provider output is bound to a different candidate catalog", 1);
  }

  let decision: BeliefSemanticTargetDecisionV0;
  if (kind === "EXISTING_PROPOSITION") {
    if (!exactKeys(raw, EXISTING_KEYS)) {
      return reject("INVALID_PROVIDER_OUTPUT", "provider output: EXISTING_PROPOSITION closed keys", 1);
    }
    const rawId = raw["proposition_id"];
    if (typeof rawId !== "string") {
      return reject("INVALID_PROVIDER_OUTPUT", "provider output.proposition_id: expected identifier", 1);
    }
    const idChecked = validateIdentifier(rawId, "provider output.proposition_id");
    if (!idChecked.ok) return reject("INVALID_PROVIDER_OUTPUT", idChecked.error.detail, 1);
    const relation = raw["relation"];
    if (relation !== "SUPPORTS" && relation !== "CONTRADICTS") {
      return reject("INVALID_PROVIDER_OUTPUT", "provider output.relation: must be SUPPORTS or CONTRADICTS", 1);
    }
    if (!catalogIds.has(idChecked.value)) {
      return reject(
        "INVENTED_PROPOSITION_ID",
        `provider output.proposition_id ${idChecked.value} is not in the supplied candidate catalog`,
        1
      );
    }
    decision = {
      kind: "EXISTING_PROPOSITION",
      proposition_id: idChecked.value,
      relation
    };
  } else if (kind === "NEW_PROPOSITION_CANDIDATE") {
    if (!exactKeys(raw, NEW_KEYS)) {
      return reject("INVALID_PROVIDER_OUTPUT", "provider output: NEW_PROPOSITION_CANDIDATE closed keys", 1);
    }
    // Frozen Belief label semantics: reject, never normalize/repair.
    const labelChecked = validateBeliefPropositionLabel(
      raw["proposed_label"],
      "provider output.proposed_label"
    );
    if (!labelChecked.ok) return reject("INVALID_PROPOSED_LABEL", labelChecked.error.detail, 1);
    decision = { kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: labelChecked.value };
  } else if (kind === "NO_BEARING") {
    if (!exactKeys(raw, NO_BEARING_KEYS)) {
      return reject("INVALID_PROVIDER_OUTPUT", "provider output: NO_BEARING closed keys", 1);
    }
    decision = { kind: "NO_BEARING" };
  } else {
    return reject("INVALID_PROVIDER_OUTPUT", "provider output.kind: unknown decision kind", 1);
  }

  // ---- 7. accepted host result with exact frozen bindings ----------------------
  const memberRefs = sortedRecords.map(
    (record) => record.episode_ref
  ) as BeliefSemanticEpisodeRef[];
  const memberSetFingerprint = await deriveBeliefEvidenceMemberSetFingerprint(memberRefs);
  const resolution = deepFreeze({
    schema_version: BELIEF_SEMANTIC_TARGET_RESOLUTION_SCHEMA_VERSION,
    subject_id: snapshot.identity.subject_id,
    state_revision: snapshot.runtime_metadata.state_revision,
    repository_revision: repositoryRevision,
    semantic_context_fingerprint: semanticContextFingerprint,
    candidate_catalog_fingerprint: candidateCatalogFingerprint,
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint: memberSetFingerprint
    },
    decision
  }) as BeliefSemanticTargetResolutionV0;
  acceptedCapabilities.add(resolution);
  return { ok: true, resolution, providerCalls: 1 };
}
