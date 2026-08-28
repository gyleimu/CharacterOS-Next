/**
 * PersonalityEvidenceChannelPolicyV0 — explicit semantic routing policy +
 * deterministic resolver between host/domain intent and the frozen
 * PersonalityPlasticityProducerV0.
 *
 * ARCHITECTURE:
 *   explicit channel_id (caller input; NEVER inferred)
 *     ↓ resolvePersonalityEvidenceChannel(...)      (THIS module, pure lookup)
 *   PersonalityEvidenceChannelDecisionV0            (target dimension + direction)
 *     ↓ producePersonalityPlasticityFromChannel(...) (THIS module, thin bridge)
 *   frozen PersonalityPlasticityProducerV0          (sole numeric plasticity owner)
 *     → PersonalityUpdateProposalV0
 *     → frozen PersonalityTransitionExecutor → SubjectCore
 *
 * SEMANTIC BOUNDARY (frozen):
 * - AUTOMATIC_CHANNEL_SELECTION = ABSENT. The caller explicitly chooses the
 *   channel_id; this module answers ONLY "given an explicitly declared channel,
 *   which registered dimension and direction does the configured engineering
 *   policy route it to?". It never answers "which channel does this experience
 *   belong to?".
 * - EVIDENCE_TO_CHANNEL_INFERENCE = ABSENT. The resolver never inspects
 *   episodic memory content, MemoryInfluenceProjection values, aggregate
 *   metrics, free text, or LLM output. Resolution is a pure policy lookup.
 * - CALLER_TARGET_OVERRIDE = ABSENT and CALLER_DIRECTION_OVERRIDE = ABSENT:
 *   the caller supplies channel_id only; the policy chooses the exact route.
 * - DIMENSION_REGISTRATION_AUTHORITY = PERSONALITY_STATE_ONLY: the resolved
 *   target must already be registered in the CURRENT canonical
 *   PersonalityStateV0; unknown targets fail closed. No registration, no
 *   traits_seed fallback, no state mutation.
 * - CHANNEL_LAYER_NUMERIC_PLASTICITY = ABSENT: this layer computes no step,
 *   activation, eligibility, or next_value — the frozen producer remains the
 *   only numeric owner, and a supplied evidence set passes through unchanged.
 * - CHANNEL_LAYER_IS_MUTATOR = NO: no SubjectCore, no executor execution, no
 *   memory write of any kind.
 * - CHANNEL_DECISION_AUDITABILITY = RUNTIME_LEVEL_V0: the frozen
 *   PersonalityUpdateProposalV0 does not persist channel provenance, so the
 *   decision is runtime-level audit data, NOT canonical durable provenance.
 *   The policy fingerprint proves configuration identity only — never
 *   semantic correctness.
 *
 * The policy is host/config supplied; there are NO built-in production
 * channels or psychological taxonomy. Everything here is deterministic
 * configuration resolution: no LLM, no embedding, no network, no wall clock.
 */

import type {
  HashV1,
  IdentifierV0,
  PersonalityStateV0
} from "@characteros-next/subject-core";
import {
  fail,
  hashEnvelope,
  isRecord,
  ok,
  validateIdentifier,
  type ValidationResult
} from "@characteros-next/subject-core";
import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";

import {
  proposePersonalityPlasticityV0,
  type PersonalityPlasticityContextV0,
  type PersonalityPlasticityDirectionV0,
  type PersonalityPlasticityPolicyV0,
  type PersonalityPlasticityResultV0
} from "./personality-plasticity-producer.js";

export const PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION =
  "personality-evidence-channel-policy-v0" as const;
export const PERSONALITY_EVIDENCE_CHANNEL_DECISION_SCHEMA_VERSION =
  "personality-evidence-channel-decision-v0" as const;

/** Domain-separated projection for the closed policy fingerprint. */
export const PERSONALITY_EVIDENCE_CHANNEL_POLICY_FINGERPRINT_PROJECTION =
  "characteros-next/personality/evidence-channel-policy/v1" as const;

/** One explicit semantic route: channel → registered dimension + direction. */
export interface PersonalityEvidenceChannelRuleV0 {
  readonly channel_id: IdentifierV0;
  readonly target_dimension_id: IdentifierV0;
  readonly direction: PersonalityPlasticityDirectionV0;
}

/**
 * Closed, versioned, host/config-supplied routing policy. Channels are unique
 * by channel_id and canonically ordered raw-ASCII ascending (frozen repository
 * convention). NO built-in production taxonomy is shipped with this module.
 */
export interface PersonalityEvidenceChannelPolicyV0 {
  readonly schema_version: typeof PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION;
  readonly policy_id: IdentifierV0;
  readonly channels: readonly PersonalityEvidenceChannelRuleV0[];
}

const POLICY_KEYS: readonly string[] = ["schema_version", "policy_id", "channels"];
const RULE_KEYS: readonly string[] = ["channel_id", "target_dimension_id", "direction"];

/**
 * Fail-closed policy admission: closed keys, exact schema literal, validated
 * identifiers, closed direction literals, unique channel_ids, canonical
 * raw-ASCII ascending channel order. Empty channels is structurally valid
 * (a host may configure no routing yet); every resolve against it then
 * deterministically yields UNKNOWN_CHANNEL.
 */
export function validatePersonalityEvidenceChannelPolicy(
  v: unknown
): ValidationResult<PersonalityEvidenceChannelPolicyV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy: expected object");
  for (const key of Object.keys(v)) {
    if (!POLICY_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `policy.${key}: unknown key`);
    }
  }
  if (v["schema_version"] !== PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION) {
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
  const channels: PersonalityEvidenceChannelRuleV0[] = [];
  let prevId: string | undefined;
  for (let i = 0; i < channelsRaw.length; i++) {
    const label = `policy.channels[${i}]`;
    const item = channelsRaw[i];
    if (!isRecord(item)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: expected object`);
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
    if (prevId !== undefined) {
      if (channelId.value === prevId) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: duplicate channel_id`);
      }
      if (channelId.value < prevId) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: channel_ids not raw-ASCII-sorted`);
      }
    }
    prevId = channelId.value;
    const targetRaw = item["target_dimension_id"];
    if (typeof targetRaw !== "string") {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.target_dimension_id: expected identifier`);
    }
    const target = validateIdentifier(targetRaw, `${label}.target_dimension_id`);
    if (!target.ok) return target;
    const direction = item["direction"];
    if (direction !== "INCREASE" && direction !== "DECREASE") {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.direction: INCREASE or DECREASE required`);
    }
    channels.push({
      channel_id: channelId.value,
      target_dimension_id: target.value,
      direction
    });
  }
  return ok({
    schema_version: PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
    policy_id: policyId.value,
    channels
  });
}

/**
 * Policy fingerprint over the exact closed policy content (schema version,
 * policy id, all canonical channel rules). Deterministic: same canonical
 * policy ⇒ same fingerprint; any changed route ⇒ different fingerprint. It
 * proves CONFIGURATION IDENTITY only — never semantic correctness.
 */
export async function derivePersonalityEvidenceChannelPolicyFingerprint(
  policy: PersonalityEvidenceChannelPolicyV0
): Promise<HashV1> {
  return hashEnvelope(PERSONALITY_EVIDENCE_CHANNEL_POLICY_FINGERPRINT_PROJECTION, {
    schema_version: policy.schema_version,
    policy_id: policy.policy_id,
    channels: policy.channels
  });
}

/** Pure routing decision — no evidence metrics, no next_value, no reasoning. */
export interface PersonalityEvidenceChannelDecisionV0 {
  readonly schema_version: typeof PERSONALITY_EVIDENCE_CHANNEL_DECISION_SCHEMA_VERSION;
  readonly policy_id: IdentifierV0;
  readonly policy_fingerprint: HashV1;
  readonly channel_id: IdentifierV0;
  readonly target_dimension_id: IdentifierV0;
  readonly direction: PersonalityPlasticityDirectionV0;
}

export type PersonalityEvidenceChannelResolutionV0 =
  | { readonly kind: "RESOLVED"; readonly decision: PersonalityEvidenceChannelDecisionV0 }
  | { readonly kind: "INVALID_POLICY"; readonly detail: string }
  | { readonly kind: "INVALID_CHANNEL_ID"; readonly detail: string }
  | { readonly kind: "UNKNOWN_CHANNEL"; readonly detail: string }
  | { readonly kind: "UNKNOWN_TARGET_DIMENSION"; readonly detail: string };

/**
 * Deterministically resolve ONE explicitly declared channel against the
 * configured policy and the CURRENT canonical PersonalityStateV0. Pure policy
 * lookup: the resolver accepts no evidence input of any kind, cannot be
 * overridden to a different target/direction by the caller, and mutates
 * nothing. Unknown channel or unregistered target dimension fails closed;
 * there is no default route and no fallback.
 */
export async function resolvePersonalityEvidenceChannel(
  policy: unknown,
  channelId: unknown,
  currentPersonality: PersonalityStateV0
): Promise<PersonalityEvidenceChannelResolutionV0> {
  const policyChecked = validatePersonalityEvidenceChannelPolicy(policy);
  if (!policyChecked.ok) {
    return { kind: "INVALID_POLICY", detail: policyChecked.error.detail };
  }
  const activePolicy = policyChecked.value;

  if (typeof channelId !== "string") {
    return { kind: "INVALID_CHANNEL_ID", detail: "channel_id: expected identifier string" };
  }
  const channelIdChecked = validateIdentifier(channelId, "channel_id");
  if (!channelIdChecked.ok) {
    return { kind: "INVALID_CHANNEL_ID", detail: channelIdChecked.error.detail };
  }

  const rule = activePolicy.channels.find((c) => c.channel_id === channelIdChecked.value);
  if (rule === undefined) {
    return {
      kind: "UNKNOWN_CHANNEL",
      detail: `channel_id ${channelIdChecked.value} is not configured in policy ${activePolicy.policy_id}`
    };
  }

  const dimension = currentPersonality.dimensions.find(
    (d) => d.dimension_id === rule.target_dimension_id
  );
  if (dimension === undefined) {
    return {
      kind: "UNKNOWN_TARGET_DIMENSION",
      detail: `target_dimension_id ${rule.target_dimension_id} is not registered in the canonical personality state`
    };
  }

  const decision: PersonalityEvidenceChannelDecisionV0 = {
    schema_version: PERSONALITY_EVIDENCE_CHANNEL_DECISION_SCHEMA_VERSION,
    policy_id: activePolicy.policy_id,
    policy_fingerprint: await derivePersonalityEvidenceChannelPolicyFingerprint(activePolicy),
    channel_id: rule.channel_id,
    target_dimension_id: rule.target_dimension_id,
    direction: rule.direction
  };
  return { kind: "RESOLVED", decision };
}

export type PersonalityEvidenceChannelPlasticityResultV0 =
  | {
      readonly kind: "RESOLVED";
      readonly decision: PersonalityEvidenceChannelDecisionV0;
      /** Verbatim frozen producer outcome (PROPOSED / NOT_ELIGIBLE / NO_CHANGE / ...). */
      readonly producerResult: PersonalityPlasticityResultV0;
    }
  | { readonly kind: "INVALID_POLICY"; readonly detail: string }
  | { readonly kind: "INVALID_CHANNEL_ID"; readonly detail: string }
  | { readonly kind: "UNKNOWN_CHANNEL"; readonly detail: string }
  | { readonly kind: "UNKNOWN_TARGET_DIMENSION"; readonly detail: string };

/**
 * Thin additive bridge: resolve the explicitly declared channel, then delegate
 * verbatim to the frozen PersonalityPlasticityProducerV0. The exact supplied
 * evidence array passes through unchanged (no adding, dropping, filtering,
 * deduping, regrouping); the bridge computes no plasticity numbers itself and
 * mutates no canonical state. The frozen producer outcome is surfaced as-is.
 */
export async function producePersonalityPlasticityFromChannel(
  policy: unknown,
  channelId: unknown,
  ctx: PersonalityPlasticityContextV0,
  evidence: readonly MemoryInfluenceProjectionV0[],
  plasticityPolicy: PersonalityPlasticityPolicyV0
): Promise<PersonalityEvidenceChannelPlasticityResultV0> {
  const resolved = await resolvePersonalityEvidenceChannel(policy, channelId, ctx.current_personality);
  if (resolved.kind !== "RESOLVED") {
    return resolved;
  }
  const producerResult = await proposePersonalityPlasticityV0(
    ctx,
    evidence,
    {
      dimension_id: resolved.decision.target_dimension_id,
      direction: resolved.decision.direction
    },
    plasticityPolicy
  );
  return { kind: "RESOLVED", decision: resolved.decision, producerResult };
}
