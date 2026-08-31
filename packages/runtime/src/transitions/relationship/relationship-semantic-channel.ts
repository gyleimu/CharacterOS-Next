/**
 * Relationship Semantic Channel V0 — evidence semantics runner.
 *
 * SEMANTIC BOUNDARY (frozen):
 * - TARGET: exactly one explicit host-supplied counterpart_ref that must
 *   already be registered in the CURRENT canonical RelationshipState. No
 *   scene inference, no name extraction, no auto-registration, no call into
 *   counterpart registration.
 * - EVIDENCE: caller-supplied EpisodicMemoryRecordV0 records (1..32), each
 *   host-reverified against the CURRENT bound manifest (schema, canonical
 *   ordering, duplicate rejection, existence, exact payload-hash equality via
 *   the frozen memory hash authority). Input order carries no authority.
 * - STRUCTURED PRESENCE: every admitted record must structurally reference
 *   the counterpart (counterpart_ref in record.references). This proves
 *   structural referencing ONLY — never trust, betrayal, closeness, hostility
 *   or any relationship-changing meaning.
 * - HIDDEN POLICY: target_dimension_id and direction are host CONFIG hidden
 *   from the model; preflight requires every catalog channel's target to be
 *   registered on the CURRENT counterpart. The model sees channel_id +
 *   criterion only.
 * - OUTPUT: closed CHANNEL/ABSTAIN wire schema; the model structurally cannot
 *   emit counterpart, evidence refs, dimension, direction, value, confidence
 *   or reasoning fields. ABSTAIN is a first-class successful result.
 * - EVIDENCE SET: host-derived and exact; the provider never selects a subset.
 * - CAPABILITY: accepted results are minted deep-frozen by this module and
 *   trusted through a module-private WeakSet; plain JSON, structuredClone and
 *   field-perfect reconstructions are rejected as capabilities.
 * - CANONICAL AUTHORITY: NONE. This runner ends at the host-minted validated
 *   semantic result. It holds no RelationshipUpdateProposal, executor,
 *   registration, SubjectCore-commit, Memory-write or Belief path, and
 *   persists nothing: results are RUNTIME_ONLY.
 */

import {
  computeMemoryRecordPayloadHash,
  validateEpisodicMemoryRecord,
  validateRepositoryManifest,
  type EpisodeRef,
  type EpisodicMemoryRecordV0,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import {
  fail,
  hashEnvelope,
  isRecord,
  ok,
  validateCanonicalText,
  validateHash,
  validateIdentifier,
  validateRefElement,
  validateSubjectState,
  type CanonicalRefV0,
  type HashV1,
  type IdentifierV0,
  type LogicalTimeV0,
  type RepositoryRevisionIdV0,
  type SubjectStateV0,
  type ValidationResult
} from "@characteros-next/subject-core";

import {
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  validateRelationshipEvidenceChannelPolicy
} from "./relationship-evidence-channel-policy.js";

export const RELATIONSHIP_SEMANTIC_CONTEXT_PROJECTION_SCHEMA_VERSION =
  "relationship-semantic-context-projection-v0" as const;
export const RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION =
  "relationship-semantic-channel-catalog-v0" as const;
export const RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION =
  "relationship-semantic-provider-output-v0" as const;
export const RELATIONSHIP_SEMANTIC_CHANNEL_RESULT_SCHEMA_VERSION =
  "relationship-semantic-channel-result-v0" as const;
export const RELATIONSHIP_SEMANTIC_CHANNEL_AUDIT_SCHEMA_VERSION =
  "relationship-semantic-channel-audit-v0" as const;

export const RELATIONSHIP_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION =
  "characteros-next/relationship/semantic-evidence-context/v1" as const;
export const RELATIONSHIP_SEMANTIC_CATALOG_FINGERPRINT_PROJECTION =
  "characteros-next/relationship/semantic-channel-catalog/v1" as const;

/** Explicit V0 admission bounds; all over-limit inputs fail closed. */
export const RELATIONSHIP_SEMANTIC_MAX_EVIDENCE_RECORDS = 32 as const;
export const RELATIONSHIP_SEMANTIC_MAX_CHANNELS = 64 as const;
export const RELATIONSHIP_SEMANTIC_MAX_CRITERION_LENGTH = 2048 as const;
export const RELATIONSHIP_SEMANTIC_MAX_SCENE_LENGTH = 8192 as const;

export interface RelationshipSemanticEvidenceItemV0 {
  readonly episode_ref: EpisodeRef;
  readonly occurrence_logical_time: LogicalTimeV0;
  /** The only human-readable semantic field in EpisodicMemoryRecordV0. */
  readonly scene: string;
}

/**
 * Controlled semantic projection: the ONLY model-visible shape. It contains
 * no SubjectState, revisions, manifests, hashes, personality, traits, beliefs,
 * affect, regulation, relationship dimensions/values, or any hidden policy
 * field (target_dimension_id, direction).
 */
export interface RelationshipSemanticContextProjectionV0 {
  readonly schema_version: typeof RELATIONSHIP_SEMANTIC_CONTEXT_PROJECTION_SCHEMA_VERSION;
  readonly counterpart_ref: CanonicalRefV0;
  /** Unique and canonically raw-ASCII sorted by episode_ref. */
  readonly evidence: readonly RelationshipSemanticEvidenceItemV0[];
}

export interface RelationshipSemanticChannelDefinitionV0 {
  readonly channel_id: IdentifierV0;
  readonly criterion: string;
}

export interface RelationshipSemanticChannelCatalogV0 {
  readonly schema_version: typeof RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION;
  readonly catalog_id: IdentifierV0;
  readonly channel_policy_id: IdentifierV0;
  readonly channel_policy_fingerprint: HashV1;
  /** Unique and canonically raw-ASCII sorted by channel_id. */
  readonly channels: readonly RelationshipSemanticChannelDefinitionV0[];
}

/** Least-authority provider view: no policy ids, fingerprints, targets or directions. */
export interface RelationshipSemanticChannelProviderCatalogV0 {
  readonly catalog_id: IdentifierV0;
  readonly channels: readonly RelationshipSemanticChannelDefinitionV0[];
}

export interface RelationshipSemanticChannelProviderInputV0 {
  readonly semantic_context: RelationshipSemanticContextProjectionV0;
  readonly semantic_catalog: RelationshipSemanticChannelProviderCatalogV0;
  readonly semantic_context_fingerprint: HashV1;
  readonly catalog_fingerprint: HashV1;
}

/** Raw return is deliberately unknown until the host validates its closed shape. */
export interface RelationshipSemanticChannelProviderV0 {
  propose(input: RelationshipSemanticChannelProviderInputV0): Promise<unknown>;
}

export type RelationshipSemanticProviderOutputV0 =
  | {
      readonly kind: "CHANNEL";
      readonly channel_id: IdentifierV0;
      readonly semantic_context_fingerprint: HashV1;
      readonly catalog_fingerprint: HashV1;
    }
  | {
      readonly kind: "ABSTAIN";
      readonly semantic_context_fingerprint: HashV1;
      readonly catalog_fingerprint: HashV1;
    };

/**
 * Host-minted accepted semantic result. Runtime audit information ONLY — it is
 * never persisted into canonical state, trace, journal or memory. The bound
 * identity/evidence fields are exactly what a FUTURE plasticity bridge needs
 * to verify semantic-evidence == plasticity-evidence alignment.
 */
export interface RelationshipSemanticChannelResultV0 {
  readonly schema_version: typeof RELATIONSHIP_SEMANTIC_CHANNEL_RESULT_SCHEMA_VERSION;
  readonly kind: "CHANNEL" | "ABSTAIN";
  readonly channel_id: IdentifierV0 | null;
  readonly subject_id: IdentifierV0;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly channel_policy_id: IdentifierV0;
  readonly channel_policy_fingerprint: HashV1;
  readonly semantic_context_fingerprint: HashV1;
  readonly catalog_fingerprint: HashV1;
  /** Exact sorted evidence member set shown to the provider; host-derived. */
  readonly evidence_refs: readonly EpisodeRef[];
}

export type RelationshipSemanticChannelRejectionCodeV0 =
  | "INVALID_SEMANTIC_TARGET"
  | "UNREGISTERED_SEMANTIC_COUNTERPART"
  | "UNREGISTERED_TARGET_DIMENSION"
  | "INVALID_SEMANTIC_CATALOG"
  | "SEMANTIC_CATALOG_POLICY_MISMATCH"
  | "UNVERIFIED_SEMANTIC_EVIDENCE"
  | "COUNTERPART_NOT_STRUCTURALLY_REFERENCED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_TRANSPORT_FAILURE"
  | "PROVIDER_MALFORMED_JSON"
  | "INVALID_PROVIDER_OUTPUT"
  | "UNKNOWN_SEMANTIC_CHANNEL"
  | "STALE_SEMANTIC_CONTEXT"
  | "STALE_SEMANTIC_CATALOG";

/**
 * Typed live-provider failure carrier. Truthful error mapping: the runner
 * preserves these codes and NEVER converts a provider failure into ABSTAIN.
 */
export type RelationshipSemanticProviderFailureCodeV0 =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_TRANSPORT_FAILURE"
  | "PROVIDER_MALFORMED_JSON";

export class RelationshipSemanticProviderErrorV0 extends Error {
  constructor(
    readonly code: RelationshipSemanticProviderFailureCodeV0,
    detail: string
  ) {
    super(`RELATIONSHIP_SEMANTIC_PROVIDER_${code}: ${detail}`);
    this.name = "RelationshipSemanticProviderErrorV0";
  }
}

export type RelationshipSemanticChannelRunResultV0 =
  | {
      readonly kind: "ACCEPTED";
      readonly result: RelationshipSemanticChannelResultV0;
      /** Runtime audit projection only; never canonical SubjectState. */
      readonly semantic_context: RelationshipSemanticContextProjectionV0;
    }
  | {
      readonly kind: "REJECTED";
      readonly code: RelationshipSemanticChannelRejectionCodeV0;
      readonly detail: string;
    };

/** The runner needs one immutable manifest read and has no memory-write capability. */
export type RelationshipSemanticEvidenceRepositoryV0 = Pick<
  MemoryPreparationAuthority,
  "readManifest"
>;

export interface RelationshipSemanticChannelRunnerInputV0 {
  readonly subject_state: SubjectStateV0;
  /** Exactly one explicit host-selected target counterpart. */
  readonly counterpart_ref: unknown;
  /** Caller-selected exact records; the runner never searches for more memory. */
  readonly selected_records: readonly unknown[];
  readonly repository: RelationshipSemanticEvidenceRepositoryV0;
  readonly channel_policy: unknown;
  readonly semantic_catalog: unknown;
  readonly provider: RelationshipSemanticChannelProviderV0;
}

const CATALOG_KEYS: readonly string[] = [
  "schema_version",
  "catalog_id",
  "channel_policy_id",
  "channel_policy_fingerprint",
  "channels"
];
const DEFINITION_KEYS: readonly string[] = ["channel_id", "criterion"];
const CHANNEL_OUTPUT_KEYS: readonly string[] = [
  "schema_version",
  "kind",
  "channel_id",
  "semantic_context_fingerprint",
  "catalog_fingerprint"
];
const ABSTAIN_OUTPUT_KEYS: readonly string[] = [
  "schema_version",
  "kind",
  "semantic_context_fingerprint",
  "catalog_fingerprint"
];

function rawAsciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function containsDisallowedCriterionControl(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code <= 0x1f || code === 0x7f)) return true;
  }
  return false;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function rejected(
  code: RelationshipSemanticChannelRejectionCodeV0,
  detail: string
): RelationshipSemanticChannelRunResultV0 {
  return deepFreeze({ kind: "REJECTED", code, detail });
}

export function validateRelationshipSemanticChannelCatalog(
  value: unknown
): ValidationResult<RelationshipSemanticChannelCatalogV0> {
  if (!isRecord(value)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog: expected object");
  }
  if (!exactKeys(value, CATALOG_KEYS)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog: unknown or missing key");
  }
  if (value["schema_version"] !== RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog.schema_version");
  }

  const catalogIdRaw = value["catalog_id"];
  if (typeof catalogIdRaw !== "string") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog.catalog_id: expected identifier");
  }
  const catalogId = validateIdentifier(catalogIdRaw, "semantic_catalog.catalog_id");
  if (!catalogId.ok) return catalogId;

  const policyIdRaw = value["channel_policy_id"];
  if (typeof policyIdRaw !== "string") {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "semantic_catalog.channel_policy_id: expected identifier"
    );
  }
  const policyId = validateIdentifier(policyIdRaw, "semantic_catalog.channel_policy_id");
  if (!policyId.ok) return policyId;

  const fingerprintRaw = value["channel_policy_fingerprint"];
  if (typeof fingerprintRaw !== "string") {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "semantic_catalog.channel_policy_fingerprint: expected hash"
    );
  }
  const fingerprint = validateHash(fingerprintRaw, "semantic_catalog.channel_policy_fingerprint");
  if (!fingerprint.ok) return fingerprint;

  const channelsRaw = value["channels"];
  if (!Array.isArray(channelsRaw)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog.channels: expected array");
  }
  if (channelsRaw.length === 0 || channelsRaw.length > RELATIONSHIP_SEMANTIC_MAX_CHANNELS) {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      `semantic_catalog.channels: expected 1..${RELATIONSHIP_SEMANTIC_MAX_CHANNELS} entries`
    );
  }

  const channels: RelationshipSemanticChannelDefinitionV0[] = [];
  let previousId: string | undefined;
  for (let i = 0; i < channelsRaw.length; i++) {
    const label = `semantic_catalog.channels[${i}]`;
    const item = channelsRaw[i];
    if (!isRecord(item) || !exactKeys(item, DEFINITION_KEYS)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: invalid closed definition`);
    }
    const channelIdRaw = item["channel_id"];
    if (typeof channelIdRaw !== "string") {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.channel_id: expected identifier`);
    }
    const channelId = validateIdentifier(channelIdRaw, `${label}.channel_id`);
    if (!channelId.ok) return channelId;
    if (previousId !== undefined && rawAsciiCompare(channelId.value, previousId) <= 0) {
      const reason = channelId.value === previousId ? "duplicate channel_id" : "channels not raw-ASCII-sorted";
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.channel_id: ${reason}`);
    }

    const criterionRaw = item["criterion"];
    const criterion = validateCanonicalText(criterionRaw, `${label}.criterion`);
    if (!criterion.ok) return criterion;
    if (
      criterion.value.trim().length === 0 ||
      criterion.value.length > RELATIONSHIP_SEMANTIC_MAX_CRITERION_LENGTH ||
      containsDisallowedCriterionControl(criterion.value)
    ) {
      return fail(
        "INVALID_VALUE_RANGE",
        "SS-SCHEMA-001",
        `${label}.criterion: must be nonempty, control-free and <= ${RELATIONSHIP_SEMANTIC_MAX_CRITERION_LENGTH} characters`
      );
    }
    channels.push({ channel_id: channelId.value, criterion: criterion.value });
    previousId = channelId.value;
  }

  return ok({
    schema_version: RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: catalogId.value,
    channel_policy_id: policyId.value,
    channel_policy_fingerprint: fingerprint.value,
    channels
  });
}

export async function deriveRelationshipSemanticContextFingerprint(
  projection: RelationshipSemanticContextProjectionV0
): Promise<HashV1> {
  return hashEnvelope(RELATIONSHIP_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION, projection);
}

/** Hashes the FULL canonical host catalog, including policy identity/fingerprint. */
export async function deriveRelationshipSemanticCatalogFingerprint(
  catalog: RelationshipSemanticChannelCatalogV0
): Promise<HashV1> {
  return hashEnvelope(RELATIONSHIP_SEMANTIC_CATALOG_FINGERPRINT_PROJECTION, {
    schema_version: catalog.schema_version,
    catalog_id: catalog.catalog_id,
    channel_policy_id: catalog.channel_policy_id,
    channel_policy_fingerprint: catalog.channel_policy_fingerprint,
    channels: catalog.channels
  });
}

function evidenceRefsOf(
  projection: RelationshipSemanticContextProjectionV0
): readonly EpisodeRef[] {
  return projection.evidence.map((item) => item.episode_ref);
}

async function verifyEvidence(
  input: RelationshipSemanticChannelRunnerInputV0
): Promise<
  | {
      readonly ok: true;
      readonly verified: readonly EpisodicMemoryRecordV0[];
      readonly repository_revision: RepositoryRevisionIdV0;
    }
  | { readonly ok: false; readonly detail: string }
> {
  if (
    !Array.isArray(input.selected_records) ||
    input.selected_records.length === 0 ||
    input.selected_records.length > RELATIONSHIP_SEMANTIC_MAX_EVIDENCE_RECORDS
  ) {
    return {
      ok: false,
      detail: `selected_records: expected 1..${RELATIONSHIP_SEMANTIC_MAX_EVIDENCE_RECORDS} records`
    };
  }

  const stateChecked = validateSubjectState(input.subject_state);
  if (!stateChecked.ok) {
    return { ok: false, detail: `current subject state invalid: ${stateChecked.error.detail}` };
  }
  const repositoryRevision = stateChecked.value.memory_state.repository_revision;
  let manifestRaw: Awaited<ReturnType<RelationshipSemanticEvidenceRepositoryV0["readManifest"]>>;
  try {
    manifestRaw = await input.repository.readManifest(repositoryRevision);
  } catch (error) {
    return {
      ok: false,
      detail: `bound repository manifest read failed: ${error instanceof Error ? error.message : "unknown failure"}`
    };
  }
  if (manifestRaw === null) {
    return { ok: false, detail: `bound repository revision ${repositoryRevision} does not exist` };
  }
  const manifestChecked = validateRepositoryManifest(manifestRaw);
  if (!manifestChecked.ok) {
    return { ok: false, detail: `bound repository manifest invalid: ${manifestChecked.error.detail}` };
  }
  const manifest = manifestChecked.value;
  if (manifest.repository_revision !== repositoryRevision) {
    return {
      ok: false,
      detail: `manifest revision ${manifest.repository_revision} does not match bound revision ${repositoryRevision}`
    };
  }
  const hashes = new Map(manifest.record_hashes.map((entry) => [entry.ref, entry.payload_hash]));

  const verified: EpisodicMemoryRecordV0[] = [];
  for (let i = 0; i < input.selected_records.length; i++) {
    const checked = validateEpisodicMemoryRecord(input.selected_records[i]);
    if (!checked.ok) {
      return { ok: false, detail: `selected_records[${i}]: ${checked.error.detail}` };
    }
    if (checked.value.context.scene.length > RELATIONSHIP_SEMANTIC_MAX_SCENE_LENGTH) {
      return {
        ok: false,
        detail: `selected_records[${i}].context.scene exceeds ${RELATIONSHIP_SEMANTIC_MAX_SCENE_LENGTH} characters`
      };
    }
    verified.push(checked.value);
  }
  verified.sort((a, b) => rawAsciiCompare(a.episode_ref, b.episode_ref));

  let previousRef: string | undefined;
  for (const record of verified) {
    if (record.episode_ref === previousRef) {
      return { ok: false, detail: `duplicate selected episode_ref ${record.episode_ref}` };
    }
    previousRef = record.episode_ref;
    const expectedHash = hashes.get(record.episode_ref);
    if (expectedHash === undefined) {
      return {
        ok: false,
        detail: `episode_ref ${record.episode_ref} is absent from bound revision ${repositoryRevision}`
      };
    }
    let suppliedHash: HashV1;
    try {
      suppliedHash = await computeMemoryRecordPayloadHash(record);
    } catch (error) {
      return {
        ok: false,
        detail: `episode_ref ${record.episode_ref} is not canonically hashable: ${
          error instanceof Error ? error.message : "unknown failure"
        }`
      };
    }
    if (suppliedHash !== expectedHash) {
      return {
        ok: false,
        detail: `episode_ref ${record.episode_ref} payload hash does not match bound revision ${repositoryRevision}`
      };
    }
  }

  // Structured counterpart presence is enforced by the runner against these
  // verified records; verification here stops at hash-level truth.
  return {
    ok: true,
    verified,
    repository_revision: repositoryRevision
  };
}

function validateRawProviderOutput(
  raw: unknown,
  providerInput: RelationshipSemanticChannelProviderInputV0,
  allowedChannels: ReadonlySet<string>
):
  | { readonly ok: true; readonly kind: "CHANNEL"; readonly channel_id: IdentifierV0 }
  | { readonly ok: true; readonly kind: "ABSTAIN" }
  | {
      readonly ok: false;
      readonly code: RelationshipSemanticChannelRejectionCodeV0;
      readonly detail: string;
    } {
  if (!isRecord(raw)) {
    return { ok: false, code: "INVALID_PROVIDER_OUTPUT", detail: "provider output: expected object" };
  }
  const kind = raw["kind"];
  const expectedKeys =
    kind === "CHANNEL" ? CHANNEL_OUTPUT_KEYS : kind === "ABSTAIN" ? ABSTAIN_OUTPUT_KEYS : null;
  if (expectedKeys === null || !exactKeys(raw, expectedKeys)) {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      detail: "provider output: unknown kind or non-closed keys"
    };
  }
  if (raw["schema_version"] !== RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      detail: "provider output.schema_version"
    };
  }

  const contextRaw = raw["semantic_context_fingerprint"];
  const catalogRaw = raw["catalog_fingerprint"];
  if (typeof contextRaw !== "string" || typeof catalogRaw !== "string") {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      detail: "provider output: fingerprints must be strings"
    };
  }
  const contextHash = validateHash(contextRaw, "provider.semantic_context_fingerprint");
  const catalogHash = validateHash(catalogRaw, "provider.catalog_fingerprint");
  if (!contextHash.ok || !catalogHash.ok) {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      detail: !contextHash.ok
        ? contextHash.error.detail
        : catalogHash.ok
          ? "invalid catalog hash"
          : catalogHash.error.detail
    };
  }
  if (contextHash.value !== providerInput.semantic_context_fingerprint) {
    return {
      ok: false,
      code: "STALE_SEMANTIC_CONTEXT",
      detail: "provider output is bound to a different semantic context"
    };
  }
  if (catalogHash.value !== providerInput.catalog_fingerprint) {
    return {
      ok: false,
      code: "STALE_SEMANTIC_CATALOG",
      detail: "provider output is bound to a different semantic catalog"
    };
  }

  if (kind === "ABSTAIN") return { ok: true, kind: "ABSTAIN" };
  const channelRaw = raw["channel_id"];
  if (typeof channelRaw !== "string") {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      detail: "provider output channel_id: expected identifier"
    };
  }
  const channel = validateIdentifier(channelRaw, "provider.channel_id");
  if (!channel.ok) {
    return { ok: false, code: "INVALID_PROVIDER_OUTPUT", detail: channel.error.detail };
  }
  if (!allowedChannels.has(channel.value)) {
    return {
      ok: false,
      code: "UNKNOWN_SEMANTIC_CHANNEL",
      detail: `provider output channel_id ${channel.value} is not in the semantic catalog`
    };
  }
  return { ok: true, kind: "CHANNEL", channel_id: channel.value };
}

const acceptedSemanticResults = new WeakSet<object>();

/** Trust check for a FUTURE plasticity bridge; minting stays module-private. */
export function isHostMintedRelationshipSemanticResult(value: unknown): boolean {
  return typeof value === "object" && value !== null && acceptedSemanticResults.has(value);
}

export async function runRelationshipSemanticChannelV0(
  input: RelationshipSemanticChannelRunnerInputV0
): Promise<RelationshipSemanticChannelRunResultV0> {
  // ---- Target authority (before policy/catalog/evidence, before provider) ----
  const targetChecked = validateRefElement(input.counterpart_ref, "counterpart_ref", [
    "entity",
    "subject"
  ]);
  if (!targetChecked.ok) {
    return rejected("INVALID_SEMANTIC_TARGET", targetChecked.error.detail);
  }
  const counterpartRef = targetChecked.value;

  // ---- Hidden policy + catalog binding (host-only, before provider) ----
  const policyChecked = validateRelationshipEvidenceChannelPolicy(input.channel_policy);
  if (!policyChecked.ok) {
    return rejected(
      "SEMANTIC_CATALOG_POLICY_MISMATCH",
      `channel policy invalid: ${policyChecked.error.detail}`
    );
  }
  const policy = policyChecked.value;

  const catalogChecked = validateRelationshipSemanticChannelCatalog(input.semantic_catalog);
  if (!catalogChecked.ok) {
    return rejected("INVALID_SEMANTIC_CATALOG", catalogChecked.error.detail);
  }
  const catalog = catalogChecked.value;
  const actualPolicyFingerprint = await deriveRelationshipEvidenceChannelPolicyFingerprint(policy);
  if (
    catalog.channel_policy_id !== policy.policy_id ||
    catalog.channel_policy_fingerprint !== actualPolicyFingerprint
  ) {
    return rejected(
      "SEMANTIC_CATALOG_POLICY_MISMATCH",
      "semantic catalog is not bound to the supplied frozen channel policy identity"
    );
  }
  const policyChannels = new Map(policy.channels.map((channel) => [channel.channel_id, channel]));
  const absentCatalogChannel = catalog.channels.find(
    (channel) => !policyChannels.has(channel.channel_id)
  );
  if (absentCatalogChannel !== undefined) {
    return rejected(
      "SEMANTIC_CATALOG_POLICY_MISMATCH",
      `semantic catalog channel ${absentCatalogChannel.channel_id} is absent from the channel policy`
    );
  }

  // ---- Current-state authority preflight (before provider) ----
  const stateChecked = validateSubjectState(input.subject_state);
  if (!stateChecked.ok) {
    return rejected("UNVERIFIED_SEMANTIC_EVIDENCE", `current subject state invalid: ${stateChecked.error.detail}`);
  }
  const counterpart = stateChecked.value.relationships.counterparts.find(
    (candidate) => candidate.counterpart_ref === counterpartRef
  );
  if (counterpart === undefined) {
    return rejected(
      "UNREGISTERED_SEMANTIC_COUNTERPART",
      `counterpart ${counterpartRef} is not registered in canonical RelationshipState`
    );
  }
  const registeredDimensions = new Set(
    counterpart.dimensions.map((dimension) => dimension.dimension_id)
  );
  for (const catalogChannel of catalog.channels) {
    const policyChannel = policyChannels.get(catalogChannel.channel_id);
    const target = policyChannel?.target_dimension_id;
    if (target !== undefined && !registeredDimensions.has(target)) {
      return rejected(
        "UNREGISTERED_TARGET_DIMENSION",
        `channel ${catalogChannel.channel_id} targets unregistered dimension ${target}`
      );
    }
  }

  // ---- Evidence re-verification + structured presence (before provider) ----
  const evidence = await verifyEvidence(input);
  if (!evidence.ok) {
    return rejected("UNVERIFIED_SEMANTIC_EVIDENCE", evidence.detail);
  }
  // Structured counterpart presence: exact CanonicalRef equality against the
  // hash-covered authoritative references set of EVERY admitted record.
  for (const record of evidence.verified) {
    if (!record.references.includes(counterpartRef)) {
      return rejected(
        "COUNTERPART_NOT_STRUCTURALLY_REFERENCED",
        `episode_ref ${record.episode_ref} does not structurally reference counterpart ${counterpartRef}`
      );
    }
  }
  const projection: RelationshipSemanticContextProjectionV0 = deepFreeze({
    schema_version: RELATIONSHIP_SEMANTIC_CONTEXT_PROJECTION_SCHEMA_VERSION,
    counterpart_ref: counterpartRef,
    evidence: evidence.verified.map((record) => ({
      episode_ref: record.episode_ref,
      occurrence_logical_time: record.occurrence_logical_time,
      scene: record.context.scene
    }))
  });

  const semanticContextFingerprint = await deriveRelationshipSemanticContextFingerprint(
    projection
  );
  const catalogFingerprint = await deriveRelationshipSemanticCatalogFingerprint(catalog);
  const evidenceRefs = evidenceRefsOf(projection);

  const providerInput: RelationshipSemanticChannelProviderInputV0 = deepFreeze({
    semantic_context: projection,
    semantic_catalog: {
      catalog_id: catalog.catalog_id,
      channels: catalog.channels.map((channel) => ({ ...channel }))
    },
    semantic_context_fingerprint: semanticContextFingerprint,
    catalog_fingerprint: catalogFingerprint
  });

  // ---- EXACTLY ONE provider call; no retry, no fallback, no repair ----
  let raw: unknown;
  try {
    raw = await input.provider.propose(providerInput);
  } catch (error) {
    if (error instanceof RelationshipSemanticProviderErrorV0) {
      return rejected(error.code, `semantic provider failed: ${error.message}`);
    }
    return rejected(
      "INVALID_PROVIDER_OUTPUT",
      `semantic provider failed: ${error instanceof Error ? error.message : "unknown failure"}`
    );
  }
  let rawChecked: ReturnType<typeof validateRawProviderOutput>;
  try {
    rawChecked = validateRawProviderOutput(
      raw,
      providerInput,
      new Set(catalog.channels.map((channel) => channel.channel_id))
    );
  } catch (error) {
    return rejected(
      "INVALID_PROVIDER_OUTPUT",
      `provider output validation failed: ${error instanceof Error ? error.message : "unknown failure"}`
    );
  }
  if (!rawChecked.ok) {
    return rejected(rawChecked.code, rawChecked.detail);
  }

  const result: RelationshipSemanticChannelResultV0 = deepFreeze({
    schema_version: RELATIONSHIP_SEMANTIC_CHANNEL_RESULT_SCHEMA_VERSION,
    kind: rawChecked.kind,
    channel_id: rawChecked.kind === "CHANNEL" ? rawChecked.channel_id : null,
    subject_id: stateChecked.value.identity.subject_id,
    repository_revision: evidence.repository_revision,
    counterpart_ref: counterpartRef,
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: actualPolicyFingerprint,
    semantic_context_fingerprint: semanticContextFingerprint,
    catalog_fingerprint: catalogFingerprint,
    evidence_refs: [...evidenceRefs]
  });
  const accepted: RelationshipSemanticChannelRunResultV0 = deepFreeze({
    kind: "ACCEPTED",
    result,
    semantic_context: projection
  });
  acceptedSemanticResults.add(accepted);
  return accepted;
}
