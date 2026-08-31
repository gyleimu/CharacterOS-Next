/**
 * RelationshipEvidenceChannelPolicyV0 — hidden host/config routing policy for
 * the Relationship semantic channel.
 *
 * ARCHITECTURE (frozen):
 * - This is CONFIG / RUNTIME authority only. It never mutates
 *   RelationshipState, never touches SubjectCore, and implements NO
 *   plasticity: no learning rate, no step formula, no next_value, no EMA,
 *   no momentum, no direction application.
 * - The policy is HIDDEN FROM THE MODEL. The provider-visible catalog exposes
 *   channel_id + criterion only; target_dimension_id and direction never
 *   cross the provider boundary.
 * - Channels are unique by channel_id and canonically ordered raw-ASCII
 *   ascending. 1..64 channels (a relationship semantic routing policy with no
 *   channels cannot route, so empty policies fail closed here).
 * - NO built-in production relationship psychology taxonomy is shipped with
 *   this module: no trust, closeness, attachment, love, hostility, or
 *   dominance channels. Everything is deterministic host configuration.
 * - No LLM, no embedding, no network, no wall clock, no randomness.
 */

import {
  fail,
  hashEnvelope,
  isRecord,
  ok,
  validateIdentifier,
  type HashV1,
  type IdentifierV0,
  type ValidationResult
} from "@characteros-next/subject-core";

export const RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION =
  "relationship-evidence-channel-policy-v0" as const;

/** Domain-separated projection for the closed policy fingerprint. */
export const RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_FINGERPRINT_PROJECTION =
  "characteros-next/relationship/evidence-channel-policy/v1" as const;

/** Explicit V0 admission bound; over-limit policies fail closed. */
export const RELATIONSHIP_EVIDENCE_CHANNEL_MAX_CHANNELS = 64 as const;

/** Relationship semantic route direction. Hidden config; never model-visible. */
export type RelationshipEvidenceChannelDirectionV0 = "INCREASE" | "DECREASE";

export const RELATIONSHIP_EVIDENCE_CHANNEL_DIRECTIONS: readonly RelationshipEvidenceChannelDirectionV0[] = [
  "INCREASE",
  "DECREASE"
];

/** One explicit semantic route: channel -> registered dimension + direction. */
export interface RelationshipEvidenceChannelRuleV0 {
  readonly channel_id: IdentifierV0;
  readonly target_dimension_id: IdentifierV0;
  readonly direction: RelationshipEvidenceChannelDirectionV0;
}

/**
 * Closed, versioned, host/config-supplied routing policy. The relationship
 * counterpart's registered dimension set owns membership; targets that are
 * not registered in the CURRENT canonical RelationshipState fail closed in
 * the runner preflight.
 */
export interface RelationshipEvidenceChannelPolicyV0 {
  readonly schema_version: typeof RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION;
  readonly policy_id: IdentifierV0;
  /** Unique by channel_id, canonically raw-ASCII ascending, 1..64 entries. */
  readonly channels: readonly RelationshipEvidenceChannelRuleV0[];
}

const POLICY_KEYS: readonly string[] = ["schema_version", "policy_id", "channels"];
const RULE_KEYS: readonly string[] = ["channel_id", "target_dimension_id", "direction"];

function rawAsciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Fail-closed policy admission: closed keys, exact schema literal, validated
 * identifiers, closed direction literals, unique channel_ids, canonical
 * raw-ASCII ascending channel order, and the 1..64 cardinality bound.
 */
export function validateRelationshipEvidenceChannelPolicy(
  v: unknown
): ValidationResult<RelationshipEvidenceChannelPolicyV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy: expected object");
  for (const key of Object.keys(v)) {
    if (!POLICY_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `policy.${key}: unknown key`);
    }
  }
  if (v["schema_version"] !== RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy.schema_version");
  }
  const policyIdRaw = v["policy_id"];
  if (typeof policyIdRaw !== "string") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy.policy_id: expected identifier");
  }
  const policyId = validateIdentifier(policyIdRaw, "policy.policy_id");
  if (!policyId.ok) return policyId;

  const channelsRaw = v["channels"];
  if (!Array.isArray(channelsRaw)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy.channels: expected array");
  }
  if (channelsRaw.length === 0 || channelsRaw.length > RELATIONSHIP_EVIDENCE_CHANNEL_MAX_CHANNELS) {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      `policy.channels: expected 1..${RELATIONSHIP_EVIDENCE_CHANNEL_MAX_CHANNELS} entries`
    );
  }

  const channels: RelationshipEvidenceChannelRuleV0[] = [];
  let previousId: string | undefined;
  for (let i = 0; i < channelsRaw.length; i++) {
    const label = `policy.channels[${i}]`;
    const item = channelsRaw[i];
    if (!isRecord(item)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: expected object`);
    }
    for (const key of Object.keys(item)) {
      if (!RULE_KEYS.includes(key)) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.${key}: unknown key`);
      }
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
    const targetRaw = item["target_dimension_id"];
    if (typeof targetRaw !== "string") {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `${label}.target_dimension_id: expected identifier`
      );
    }
    const target = validateIdentifier(targetRaw, `${label}.target_dimension_id`);
    if (!target.ok) return target;
    const directionRaw = item["direction"];
    if (
      typeof directionRaw !== "string" ||
      !RELATIONSHIP_EVIDENCE_CHANNEL_DIRECTIONS.includes(directionRaw as RelationshipEvidenceChannelDirectionV0)
    ) {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `${label}.direction: expected INCREASE or DECREASE`
      );
    }
    channels.push({
      channel_id: channelId.value,
      target_dimension_id: target.value,
      direction: directionRaw as RelationshipEvidenceChannelDirectionV0
    });
    previousId = channelId.value;
  }

  return ok({
    schema_version: RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
    policy_id: policyId.value,
    channels
  });
}

/** Deterministic policy fingerprint over the full closed policy. */
export async function deriveRelationshipEvidenceChannelPolicyFingerprint(
  policy: RelationshipEvidenceChannelPolicyV0
): Promise<HashV1> {
  return hashEnvelope(RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_FINGERPRINT_PROJECTION, {
    schema_version: policy.schema_version,
    policy_id: policy.policy_id,
    channels: policy.channels
  });
}

/** Pure policy lookup: the exact hidden route for one explicitly named channel. */
export function resolveRelationshipEvidenceChannel(
  policy: RelationshipEvidenceChannelPolicyV0,
  channelId: IdentifierV0
): RelationshipEvidenceChannelRuleV0 | null {
  return policy.channels.find((channel) => channel.channel_id === channelId) ?? null;
}
