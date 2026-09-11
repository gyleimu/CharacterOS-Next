/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — minimal closed production
 * channel catalog.
 *
 * Exactly the four frozen registered dimensions × two directions. Each channel
 * binds only: channel_id → target_dimension_id → direction, plus the qualitative
 * criterion the semantic provider may reason over. There is NO numeric delta, NO
 * target value, and NO cross-domain weight. Routing/direction mapping is trusted
 * configuration; the provider may only select one allowlisted channel or ABSTAIN.
 */

import { validateIdentifier, type IdentifierV0 } from "@characteros-next/subject-core";

import {
  derivePersonalityEvidenceChannelPolicyFingerprint,
  type PersonalityEvidenceChannelPolicyV0,
  type PersonalityEvidenceChannelRuleV0
} from "./personality-evidence-channel.js";
import {
  PERSONALITY_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
  type PersonalitySemanticChannelCatalogV0,
  type PersonalitySemanticChannelDefinitionV0
} from "./personality-semantic-channel.js";

export const PERSONALITY_PRODUCTION_CHANNEL_POLICY_ID =
  "personality_production_channels_v0" as const;
export const PERSONALITY_PRODUCTION_SEMANTIC_CATALOG_ID =
  "personality_production_semantic_catalog_v0" as const;

interface RawProductionChannelV0 {
  readonly channel_id: string;
  readonly target_dimension_id: string;
  readonly direction: "INCREASE" | "DECREASE";
  readonly criterion: string;
}

function id(value: string): IdentifierV0 {
  const checked = validateIdentifier(value, "personality_production_channel.id");
  if (!checked.ok) {
    throw new Error(`PERSONALITY_PRODUCTION_CHANNEL_INVALID: ${checked.error.detail}`);
  }
  return checked.value;
}

/**
 * ENGINEERING_REFERENCE_V0 production channels. Criteria are semantic
 * descriptions of the kind of lived evidence that constitutes pressure toward a
 * registered stable disposition; they carry no numeric authority.
 */
const RAW_PRODUCTION_CHANNELS_V0: readonly RawProductionChannelV0[] = Object.freeze([
  {
    channel_id: "personality.agreeableness.decrease",
    target_dimension_id: "agreeableness",
    direction: "DECREASE",
    criterion:
      "Lived evidence consistently shows the subject holding a hard line, contesting rather than accommodating, or escalating interpersonal friction."
  },
  {
    channel_id: "personality.agreeableness.increase",
    target_dimension_id: "agreeableness",
    direction: "INCREASE",
    criterion:
      "Lived evidence consistently shows the subject cooperating, accommodating, or softening interpersonal friction rather than escalating it."
  },
  {
    channel_id: "personality.conscientiousness.decrease",
    target_dimension_id: "conscientiousness",
    direction: "DECREASE",
    criterion:
      "Lived evidence consistently shows the subject abandoning intended action, leaving things unfinished, or acting without order."
  },
  {
    channel_id: "personality.conscientiousness.increase",
    target_dimension_id: "conscientiousness",
    direction: "INCREASE",
    criterion:
      "Lived evidence consistently shows the subject sustaining intended action, following through on commitments, or maintaining order."
  },
  {
    channel_id: "personality.extraversion.decrease",
    target_dimension_id: "extraversion",
    direction: "DECREASE",
    criterion:
      "Lived evidence consistently shows the subject withholding outward initiative or limiting expressive and social output."
  },
  {
    channel_id: "personality.extraversion.increase",
    target_dimension_id: "extraversion",
    direction: "INCREASE",
    criterion:
      "Lived evidence consistently shows the subject initiating outward expression or actively seeking social engagement."
  },
  {
    channel_id: "personality.openness.decrease",
    target_dimension_id: "openness",
    direction: "DECREASE",
    criterion:
      "Lived evidence consistently shows the subject preferring familiar interpretations, resisting novelty, or narrowing to what is already known."
  },
  {
    channel_id: "personality.openness.increase",
    target_dimension_id: "openness",
    direction: "INCREASE",
    criterion:
      "Lived evidence consistently shows the subject engaging novel experiences or reinterpreting what is already known."
  }
]);

/**
 * The closed production channel policy. Channels are canonically ordered
 * raw-ASCII ascending by channel_id (frozen repository convention).
 */
export function buildPersonalityProductionChannelPolicyV0(): PersonalityEvidenceChannelPolicyV0 {
  const channels: PersonalityEvidenceChannelRuleV0[] = RAW_PRODUCTION_CHANNELS_V0.map((channel) => ({
    channel_id: id(channel.channel_id),
    target_dimension_id: id(channel.target_dimension_id),
    direction: channel.direction
  })).sort((a, b) => (a.channel_id < b.channel_id ? -1 : a.channel_id > b.channel_id ? 1 : 0));
  return Object.freeze({
    schema_version: "personality-evidence-channel-policy-v0",
    policy_id: id(PERSONALITY_PRODUCTION_CHANNEL_POLICY_ID),
    channels: Object.freeze(channels)
  });
}

/**
 * The semantic catalog bound to the production channel policy identity. Criteria
 * are unique and raw-ASCII sorted by channel_id (frozen catalog convention).
 */
export async function buildPersonalityProductionSemanticCatalogV0(): Promise<PersonalitySemanticChannelCatalogV0> {
  const policy = buildPersonalityProductionChannelPolicyV0();
  const byId = new Map(RAW_PRODUCTION_CHANNELS_V0.map((channel) => [channel.channel_id, channel]));
  const channels: PersonalitySemanticChannelDefinitionV0[] = policy.channels.map((rule) => {
    const raw = byId.get(rule.channel_id as string);
    if (raw === undefined) {
      throw new Error(`PERSONALITY_PRODUCTION_CHANNEL_INVALID: missing criterion for ${rule.channel_id}`);
    }
    return { channel_id: rule.channel_id, criterion: raw.criterion };
  });
  return Object.freeze({
    schema_version: PERSONALITY_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: id(PERSONALITY_PRODUCTION_SEMANTIC_CATALOG_ID),
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: await derivePersonalityEvidenceChannelPolicyFingerprint(policy),
    channels: Object.freeze(channels)
  });
}
