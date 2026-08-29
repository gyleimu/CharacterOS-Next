/**
 * Personality Semantic Channel Proposal V0.
 *
 * The semantic provider has exactly one authority: select one allowlisted
 * channel identity, or abstain, for an exact host-selected set of authoritative
 * episodic records. Repository binding, policy routing, numeric plasticity and
 * canonical mutation remain host-owned boundaries.
 */

import {
  computeMemoryRecordPayloadHash,
  validateEpisodicMemoryRecord,
  validateRepositoryManifest,
  type EpisodeRef,
  type EpisodicMemoryRecordV0,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";
import {
  fail,
  hashEnvelope,
  isRecord,
  ok,
  validateCanonicalText,
  validateHash,
  validateIdentifier,
  validateSubjectState,
  type HashV1,
  type IdentifierV0,
  type LogicalTimeV0,
  type RepositoryRevisionIdV0,
  type SubjectStateV0,
  type ValidationResult
} from "@characteros-next/subject-core";

import {
  derivePersonalityEvidenceChannelPolicyFingerprint,
  producePersonalityPlasticityFromChannel,
  validatePersonalityEvidenceChannelPolicy,
  type PersonalityEvidenceChannelPlasticityResultV0,
  type PersonalityEvidenceChannelPolicyV0
} from "./personality-evidence-channel.js";
import type {
  PersonalityPlasticityContextV0,
  PersonalityPlasticityPolicyV0
} from "./personality-plasticity-producer.js";

export const PERSONALITY_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION =
  "personality-semantic-evidence-projection-v0" as const;
export const PERSONALITY_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION =
  "personality-semantic-channel-catalog-v0" as const;
export const PERSONALITY_SEMANTIC_CHANNEL_PROPOSAL_SCHEMA_VERSION =
  "personality-semantic-channel-proposal-v0" as const;
export const PERSONALITY_SEMANTIC_CHANNEL_AUDIT_SCHEMA_VERSION =
  "personality-semantic-channel-audit-v0" as const;

export const PERSONALITY_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION =
  "characteros-next/personality/semantic-evidence-context/v1" as const;
export const PERSONALITY_SEMANTIC_CATALOG_FINGERPRINT_PROJECTION =
  "characteros-next/personality/semantic-channel-catalog/v1" as const;

/** Explicit V0 admission bounds; all over-limit inputs fail closed. */
export const PERSONALITY_SEMANTIC_MAX_SELECTED_RECORDS = 32 as const;
export const PERSONALITY_SEMANTIC_MAX_CHANNELS = 64 as const;
export const PERSONALITY_SEMANTIC_MAX_CRITERION_LENGTH = 2048 as const;
export const PERSONALITY_SEMANTIC_MAX_SCENE_LENGTH = 8192 as const;

export interface PersonalitySemanticEvidenceItemV0 {
  readonly episode_ref: EpisodeRef;
  readonly occurrence_logical_time: LogicalTimeV0;
  /** The only human-readable semantic field in EpisodicMemoryRecordV0. */
  readonly scene: string;
}

export interface PersonalitySemanticEvidenceProjectionV0 {
  readonly schema_version: typeof PERSONALITY_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION;
  /** Unique and canonically raw-ASCII sorted by episode_ref. */
  readonly evidence: readonly PersonalitySemanticEvidenceItemV0[];
}

export interface PersonalitySemanticChannelDefinitionV0 {
  readonly channel_id: IdentifierV0;
  readonly criterion: string;
}

export interface PersonalitySemanticChannelCatalogV0 {
  readonly schema_version: typeof PERSONALITY_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION;
  readonly catalog_id: IdentifierV0;
  readonly channel_policy_id: IdentifierV0;
  readonly channel_policy_fingerprint: HashV1;
  /** Unique and canonically raw-ASCII sorted by channel_id. */
  readonly channels: readonly PersonalitySemanticChannelDefinitionV0[];
}

/** Least-authority provider view: no policy targets, directions or state. */
export interface PersonalitySemanticChannelProviderCatalogV0 {
  readonly catalog_id: IdentifierV0;
  readonly channels: readonly PersonalitySemanticChannelDefinitionV0[];
}

export interface PersonalitySemanticChannelProviderInputV0 {
  readonly semantic_context: PersonalitySemanticEvidenceProjectionV0;
  readonly semantic_catalog: PersonalitySemanticChannelProviderCatalogV0;
  readonly semantic_context_fingerprint: HashV1;
  readonly catalog_fingerprint: HashV1;
}

/** Raw return is deliberately unknown until the host validates its closed shape. */
export interface PersonalitySemanticChannelProviderV0 {
  propose(input: PersonalitySemanticChannelProviderInputV0): Promise<unknown>;
}

export type DeterministicReferenceSemanticChannelDecisionV0 =
  | { readonly kind: "CHANNEL"; readonly channel_id: IdentifierV0 }
  | { readonly kind: "ABSTAIN" };

/** Deterministic fixture provider for offline CI; it owns no routing authority. */
export class DeterministicReferenceSemanticChannelProviderV0
  implements PersonalitySemanticChannelProviderV0
{
  constructor(
    private readonly decision: DeterministicReferenceSemanticChannelDecisionV0
  ) {}

  async propose(input: PersonalitySemanticChannelProviderInputV0): Promise<unknown> {
    if (this.decision.kind === "ABSTAIN") {
      return {
        kind: "ABSTAIN",
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        catalog_fingerprint: input.catalog_fingerprint
      };
    }
    return {
      kind: "CHANNEL",
      channel_id: this.decision.channel_id,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
  }
}

export type PersonalitySemanticChannelProposalV0 =
  | {
      readonly schema_version: typeof PERSONALITY_SEMANTIC_CHANNEL_PROPOSAL_SCHEMA_VERSION;
      readonly kind: "CHANNEL";
      readonly channel_id: IdentifierV0;
      readonly semantic_context_fingerprint: HashV1;
      readonly catalog_fingerprint: HashV1;
      /** Exact full member set shown to the provider; host-derived, never model-derived. */
      readonly evidence_refs: readonly EpisodeRef[];
    }
  | {
      readonly schema_version: typeof PERSONALITY_SEMANTIC_CHANNEL_PROPOSAL_SCHEMA_VERSION;
      readonly kind: "ABSTAIN";
      readonly semantic_context_fingerprint: HashV1;
      readonly catalog_fingerprint: HashV1;
      /** Exact full member set shown to the provider; host-derived, never model-derived. */
      readonly evidence_refs: readonly EpisodeRef[];
    };

export interface PersonalitySemanticChannelAuditV0 {
  readonly schema_version: typeof PERSONALITY_SEMANTIC_CHANNEL_AUDIT_SCHEMA_VERSION;
  readonly repository_revision: RepositoryRevisionIdV0;
  readonly channel_policy_id: IdentifierV0;
  readonly channel_policy_fingerprint: HashV1;
  readonly semantic_context_fingerprint: HashV1;
  readonly catalog_fingerprint: HashV1;
  readonly evidence_refs: readonly EpisodeRef[];
}

export type PersonalitySemanticChannelRejectionCodeV0 =
  | "INVALID_SEMANTIC_CATALOG"
  | "SEMANTIC_CATALOG_POLICY_MISMATCH"
  | "UNVERIFIED_SEMANTIC_EVIDENCE"
  | "UNKNOWN_SEMANTIC_CHANNEL"
  | "INVALID_PROVIDER_OUTPUT"
  | "STALE_SEMANTIC_CONTEXT"
  | "STALE_SEMANTIC_CATALOG";

export interface PersonalitySemanticChannelAcceptedV0 {
  readonly kind: "ACCEPTED";
  readonly proposal: PersonalitySemanticChannelProposalV0;
  readonly audit: PersonalitySemanticChannelAuditV0;
  /** Runtime audit projection only; it is never canonical SubjectState. */
  readonly semantic_context: PersonalitySemanticEvidenceProjectionV0;
}

export type PersonalitySemanticChannelRunResultV0 =
  | PersonalitySemanticChannelAcceptedV0
  | {
      readonly kind: "REJECTED";
      readonly code: PersonalitySemanticChannelRejectionCodeV0;
      readonly detail: string;
    };

/** The runner needs one immutable manifest read and has no memory-write capability. */
export type PersonalitySemanticEvidenceRepositoryV0 = Pick<
  MemoryPreparationAuthority,
  "readManifest"
>;

export interface PersonalitySemanticChannelRunnerInputV0 {
  readonly subject_state: SubjectStateV0;
  /** Caller-selected exact records; the runner never searches for additional memory. */
  readonly selected_records: readonly unknown[];
  readonly repository: PersonalitySemanticEvidenceRepositoryV0;
  readonly channel_policy: unknown;
  readonly semantic_catalog: unknown;
  readonly provider: PersonalitySemanticChannelProviderV0;
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
  "kind",
  "channel_id",
  "semantic_context_fingerprint",
  "catalog_fingerprint"
];
const ABSTAIN_OUTPUT_KEYS: readonly string[] = [
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
  code: PersonalitySemanticChannelRejectionCodeV0,
  detail: string
): PersonalitySemanticChannelRunResultV0 {
  return deepFreeze({ kind: "REJECTED", code, detail });
}

export function validatePersonalitySemanticChannelCatalog(
  value: unknown
): ValidationResult<PersonalitySemanticChannelCatalogV0> {
  if (!isRecord(value)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog: expected object");
  }
  if (!exactKeys(value, CATALOG_KEYS)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog: unknown or missing key");
  }
  if (value["schema_version"] !== PERSONALITY_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION) {
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
  const fingerprint = validateHash(
    fingerprintRaw,
    "semantic_catalog.channel_policy_fingerprint"
  );
  if (!fingerprint.ok) return fingerprint;

  const channelsRaw = value["channels"];
  if (!Array.isArray(channelsRaw)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic_catalog.channels: expected array");
  }
  if (channelsRaw.length === 0 || channelsRaw.length > PERSONALITY_SEMANTIC_MAX_CHANNELS) {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      `semantic_catalog.channels: expected 1..${PERSONALITY_SEMANTIC_MAX_CHANNELS} entries`
    );
  }

  const channels: PersonalitySemanticChannelDefinitionV0[] = [];
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
      const reason = channelId.value === previousId ? "duplicate channel_id" : "channels not sorted";
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.channel_id: ${reason}`);
    }

    const criterionRaw = item["criterion"];
    const criterion = validateCanonicalText(criterionRaw, `${label}.criterion`);
    if (!criterion.ok) return criterion;
    if (
      criterion.value.trim().length === 0 ||
      criterion.value.length > PERSONALITY_SEMANTIC_MAX_CRITERION_LENGTH ||
      containsDisallowedCriterionControl(criterion.value)
    ) {
      return fail(
        "INVALID_VALUE_RANGE",
        "SS-SCHEMA-001",
        `${label}.criterion: must be nonempty, control-free and <= ${PERSONALITY_SEMANTIC_MAX_CRITERION_LENGTH} characters`
      );
    }
    channels.push({ channel_id: channelId.value, criterion: criterion.value });
    previousId = channelId.value;
  }

  return ok({
    schema_version: PERSONALITY_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: catalogId.value,
    channel_policy_id: policyId.value,
    channel_policy_fingerprint: fingerprint.value,
    channels
  });
}

export async function derivePersonalitySemanticContextFingerprint(
  projection: PersonalitySemanticEvidenceProjectionV0
): Promise<HashV1> {
  return hashEnvelope(PERSONALITY_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION, projection);
}

export async function derivePersonalitySemanticCatalogFingerprint(
  catalog: PersonalitySemanticChannelCatalogV0
): Promise<HashV1> {
  return hashEnvelope(PERSONALITY_SEMANTIC_CATALOG_FINGERPRINT_PROJECTION, {
    schema_version: catalog.schema_version,
    catalog_id: catalog.catalog_id,
    channel_policy_id: catalog.channel_policy_id,
    channel_policy_fingerprint: catalog.channel_policy_fingerprint,
    channels: catalog.channels
  });
}

function evidenceRefsOf(
  projection: PersonalitySemanticEvidenceProjectionV0
): readonly EpisodeRef[] {
  return projection.evidence.map((item) => item.episode_ref);
}

async function verifyAndProjectEvidence(
  input: PersonalitySemanticChannelRunnerInputV0
): Promise<
  | {
      readonly ok: true;
      readonly projection: PersonalitySemanticEvidenceProjectionV0;
      readonly repository_revision: RepositoryRevisionIdV0;
    }
  | { readonly ok: false; readonly detail: string }
> {
  if (
    !Array.isArray(input.selected_records) ||
    input.selected_records.length === 0 ||
    input.selected_records.length > PERSONALITY_SEMANTIC_MAX_SELECTED_RECORDS
  ) {
    return {
      ok: false,
      detail: `selected_records: expected 1..${PERSONALITY_SEMANTIC_MAX_SELECTED_RECORDS} records`
    };
  }

  const stateChecked = validateSubjectState(input.subject_state);
  if (!stateChecked.ok) {
    return { ok: false, detail: `current subject state invalid: ${stateChecked.error.detail}` };
  }
  const repositoryRevision = stateChecked.value.memory_state.repository_revision;
  let manifestRaw: Awaited<ReturnType<PersonalitySemanticEvidenceRepositoryV0["readManifest"]>>;
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
    if (checked.value.context.scene.length > PERSONALITY_SEMANTIC_MAX_SCENE_LENGTH) {
      return {
        ok: false,
        detail: `selected_records[${i}].context.scene exceeds ${PERSONALITY_SEMANTIC_MAX_SCENE_LENGTH} characters`
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

  return {
    ok: true,
    repository_revision: repositoryRevision,
    projection: deepFreeze({
      schema_version: PERSONALITY_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION,
      evidence: verified.map((record) => ({
        episode_ref: record.episode_ref,
        occurrence_logical_time: record.occurrence_logical_time,
        scene: record.context.scene
      }))
    })
  };
}

function validateRawProviderOutput(
  raw: unknown,
  providerInput: PersonalitySemanticChannelProviderInputV0,
  allowedChannels: ReadonlySet<string>
):
  | { readonly ok: true; readonly kind: "CHANNEL"; readonly channel_id: IdentifierV0 }
  | { readonly ok: true; readonly kind: "ABSTAIN" }
  | {
      readonly ok: false;
      readonly code: PersonalitySemanticChannelRejectionCodeV0;
      readonly detail: string;
    } {
  if (!isRecord(raw)) {
    return { ok: false, code: "INVALID_PROVIDER_OUTPUT", detail: "provider output: expected object" };
  }
  const kind = raw["kind"];
  const expectedKeys = kind === "CHANNEL" ? CHANNEL_OUTPUT_KEYS : kind === "ABSTAIN" ? ABSTAIN_OUTPUT_KEYS : null;
  if (expectedKeys === null || !exactKeys(raw, expectedKeys)) {
    return {
      ok: false,
      code: "INVALID_PROVIDER_OUTPUT",
      detail: "provider output: unknown kind or non-closed keys"
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
      detail: !contextHash.ok ? contextHash.error.detail : catalogHash.ok ? "invalid catalog hash" : catalogHash.error.detail
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

export async function runPersonalitySemanticChannelProposalV0(
  input: PersonalitySemanticChannelRunnerInputV0
): Promise<PersonalitySemanticChannelRunResultV0> {
  const policyChecked = validatePersonalityEvidenceChannelPolicy(input.channel_policy);
  if (!policyChecked.ok) {
    return rejected(
      "SEMANTIC_CATALOG_POLICY_MISMATCH",
      `channel policy invalid: ${policyChecked.error.detail}`
    );
  }
  const policy = policyChecked.value;

  const catalogChecked = validatePersonalitySemanticChannelCatalog(input.semantic_catalog);
  if (!catalogChecked.ok) {
    return rejected("INVALID_SEMANTIC_CATALOG", catalogChecked.error.detail);
  }
  const catalog = catalogChecked.value;
  const actualPolicyFingerprint = await derivePersonalityEvidenceChannelPolicyFingerprint(policy);
  if (
    catalog.channel_policy_id !== policy.policy_id ||
    catalog.channel_policy_fingerprint !== actualPolicyFingerprint
  ) {
    return rejected(
      "SEMANTIC_CATALOG_POLICY_MISMATCH",
      "semantic catalog is not bound to the supplied frozen channel policy identity"
    );
  }
  const policyChannelIds = new Set(policy.channels.map((channel) => channel.channel_id));
  const absentCatalogChannel = catalog.channels.find(
    (channel) => !policyChannelIds.has(channel.channel_id)
  );
  if (absentCatalogChannel !== undefined) {
    return rejected(
      "SEMANTIC_CATALOG_POLICY_MISMATCH",
      `semantic catalog channel ${absentCatalogChannel.channel_id} is absent from the channel policy`
    );
  }

  const evidence = await verifyAndProjectEvidence(input);
  if (!evidence.ok) {
    return rejected("UNVERIFIED_SEMANTIC_EVIDENCE", evidence.detail);
  }
  const semanticContextFingerprint = await derivePersonalitySemanticContextFingerprint(
    evidence.projection
  );
  const catalogFingerprint = await derivePersonalitySemanticCatalogFingerprint(catalog);
  const evidenceRefs = evidenceRefsOf(evidence.projection);

  const providerInput: PersonalitySemanticChannelProviderInputV0 = deepFreeze({
    semantic_context: evidence.projection,
    semantic_catalog: {
      catalog_id: catalog.catalog_id,
      channels: catalog.channels.map((channel) => ({ ...channel }))
    },
    semantic_context_fingerprint: semanticContextFingerprint,
    catalog_fingerprint: catalogFingerprint
  });

  let raw: unknown;
  try {
    raw = await input.provider.propose(providerInput);
  } catch (error) {
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

  const common = {
    schema_version: PERSONALITY_SEMANTIC_CHANNEL_PROPOSAL_SCHEMA_VERSION,
    semantic_context_fingerprint: semanticContextFingerprint,
    catalog_fingerprint: catalogFingerprint,
    evidence_refs: [...evidenceRefs]
  } as const;
  const proposal: PersonalitySemanticChannelProposalV0 =
    rawChecked.kind === "CHANNEL"
      ? { ...common, kind: "CHANNEL", channel_id: rawChecked.channel_id }
      : { ...common, kind: "ABSTAIN" };
  const audit: PersonalitySemanticChannelAuditV0 = {
    schema_version: PERSONALITY_SEMANTIC_CHANNEL_AUDIT_SCHEMA_VERSION,
    repository_revision: evidence.repository_revision,
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: actualPolicyFingerprint,
    semantic_context_fingerprint: semanticContextFingerprint,
    catalog_fingerprint: catalogFingerprint,
    evidence_refs: [...evidenceRefs]
  };
  const accepted: PersonalitySemanticChannelAcceptedV0 = deepFreeze({
    kind: "ACCEPTED",
    proposal,
    audit,
    semantic_context: evidence.projection
  });
  acceptedSemanticResults.add(accepted);
  return accepted;
}

export type PersonalitySemanticPlasticityBridgeRejectionCodeV0 =
  | "UNVERIFIED_SEMANTIC_PROPOSAL"
  | "SEMANTIC_CATALOG_POLICY_MISMATCH"
  | "EVIDENCE_SET_MISMATCH";

export type PersonalitySemanticPlasticityBridgeResultV0 =
  | {
      readonly kind: "DELEGATED";
      readonly semantic_proposal: Extract<PersonalitySemanticChannelProposalV0, { kind: "CHANNEL" }>;
      readonly audit: PersonalitySemanticChannelAuditV0;
      readonly channel_result: PersonalityEvidenceChannelPlasticityResultV0;
    }
  | {
      readonly kind: "ABSTAIN";
      readonly semantic_proposal: Extract<PersonalitySemanticChannelProposalV0, { kind: "ABSTAIN" }>;
      readonly audit: PersonalitySemanticChannelAuditV0;
    }
  | {
      readonly kind: "REJECTED";
      readonly code: PersonalitySemanticPlasticityBridgeRejectionCodeV0;
      readonly detail: string;
    };

function sortedEvidenceProjectionRefs(
  evidence: readonly MemoryInfluenceProjectionV0[]
): readonly EpisodeRef[] {
  return evidence
    .map((item) => item.memory_ref)
    .sort((a, b) => rawAsciiCompare(a, b));
}

function sameRefs(a: readonly EpisodeRef[], b: readonly EpisodeRef[]): boolean {
  return a.length === b.length && a.every((ref, index) => ref === b[index]);
}

/**
 * Thin, non-mutating bridge. It verifies exact evidence and current policy
 * identity, then delegates routing and all numeric work to the frozen channel
 * resolver / PersonalityPlasticityProducer.
 */
export async function producePersonalityPlasticityFromSemanticChannelProposal(
  semanticResult: PersonalitySemanticChannelAcceptedV0,
  policy: PersonalityEvidenceChannelPolicyV0,
  context: PersonalityPlasticityContextV0,
  evidence: readonly MemoryInfluenceProjectionV0[],
  plasticityPolicy: PersonalityPlasticityPolicyV0
): Promise<PersonalitySemanticPlasticityBridgeResultV0> {
  if (!acceptedSemanticResults.has(semanticResult)) {
    return deepFreeze({
      kind: "REJECTED",
      code: "UNVERIFIED_SEMANTIC_PROPOSAL",
      detail: "semantic proposal was not minted by this runner instance"
    });
  }
  if (semanticResult.proposal.kind === "ABSTAIN") {
    return deepFreeze({
      kind: "ABSTAIN",
      semantic_proposal: semanticResult.proposal,
      audit: semanticResult.audit
    });
  }

  const policyChecked = validatePersonalityEvidenceChannelPolicy(policy);
  if (!policyChecked.ok) {
    return deepFreeze({
      kind: "REJECTED",
      code: "SEMANTIC_CATALOG_POLICY_MISMATCH",
      detail: `channel policy invalid: ${policyChecked.error.detail}`
    });
  }
  const currentPolicyFingerprint = await derivePersonalityEvidenceChannelPolicyFingerprint(
    policyChecked.value
  );
  if (
    policyChecked.value.policy_id !== semanticResult.audit.channel_policy_id ||
    currentPolicyFingerprint !== semanticResult.audit.channel_policy_fingerprint
  ) {
    return deepFreeze({
      kind: "REJECTED",
      code: "SEMANTIC_CATALOG_POLICY_MISMATCH",
      detail: "channel policy changed after semantic proposal validation"
    });
  }

  const projectionRefs = sortedEvidenceProjectionRefs(evidence);
  if (!sameRefs(semanticResult.proposal.evidence_refs, projectionRefs)) {
    return deepFreeze({
      kind: "REJECTED",
      code: "EVIDENCE_SET_MISMATCH",
      detail: "semantic and plasticity evidence member sets are not exactly equal"
    });
  }

  const channelResult = await producePersonalityPlasticityFromChannel(
    policyChecked.value,
    semanticResult.proposal.channel_id,
    context,
    evidence,
    plasticityPolicy
  );
  return deepFreeze({
    kind: "DELEGATED",
    semantic_proposal: semanticResult.proposal,
    audit: semanticResult.audit,
    channel_result: channelResult
  });
}
