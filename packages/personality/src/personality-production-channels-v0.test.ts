/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — production channel catalog.
 *
 * The catalog is closed over exactly the four frozen registered dimensions ×
 * two directions, carries no numeric authority, and admits no foreign-domain
 * semantics.
 */

import { describe, expect, it } from "vitest";

import { PERSONALITY_DIMENSION_IDS_V0 } from "@characteros-next/runtime";
import {
  PERSONALITY_PRODUCTION_CHANNEL_POLICY_ID,
  PERSONALITY_PRODUCTION_SEMANTIC_CATALOG_ID,
  buildPersonalityProductionChannelPolicyV0,
  buildPersonalityProductionSemanticCatalogV0
} from "./personality-production-channels-v0.js";
import {
  derivePersonalityEvidenceChannelPolicyFingerprint,
  validatePersonalityEvidenceChannelPolicy
} from "./personality-evidence-channel.js";
import { validatePersonalitySemanticChannelCatalog } from "./personality-semantic-channel.js";

const EXPECTED_DIMENSIONS = ["agreeableness", "conscientiousness", "extraversion", "openness"];
const FORBIDDEN = ["trust", "attachment", "fear", "control", "neuroticism", "resilience", "self_control", "emotional_sensitivity"];

describe("PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — production channel catalog", () => {
  it("is closed, frozen, unique, deterministically ordered, and exactly 4×2", async () => {
    const policy = buildPersonalityProductionChannelPolicyV0();
    expect(validatePersonalityEvidenceChannelPolicy(policy).ok).toBe(true);
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.channels)).toBe(true);
    expect(policy.policy_id).toBe(PERSONALITY_PRODUCTION_CHANNEL_POLICY_ID);
    expect(policy.channels).toHaveLength(8);
    const ids = policy.channels.map((c) => c.channel_id as string);
    expect(new Set(ids).size).toBe(8);
    expect([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(ids);
    const dimensions = new Set(policy.channels.map((c) => c.target_dimension_id as string));
    expect([...dimensions].sort()).toEqual([...EXPECTED_DIMENSIONS].sort());
    for (const dimension of dimensions) {
      const directions = policy.channels
        .filter((c) => c.target_dimension_id === dimension)
        .map((c) => c.direction)
        .sort();
      expect(directions).toEqual(["DECREASE", "INCREASE"]);
    }
    // Closed over the frozen registry only.
    expect([...dimensions].sort()).toEqual([...PERSONALITY_DIMENSION_IDS_V0].sort());
    for (const foreign of FORBIDDEN) expect(dimensions.has(foreign)).toBe(false);

    const catalog = await buildPersonalityProductionSemanticCatalogV0();
    expect(validatePersonalitySemanticChannelCatalog(catalog).ok).toBe(true);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(catalog.catalog_id).toBe(PERSONALITY_PRODUCTION_SEMANTIC_CATALOG_ID);
    expect(catalog.channel_policy_id).toBe(policy.policy_id);
    expect(catalog.channels.map((c) => c.channel_id)).toEqual(ids);
    expect(catalog.channel_policy_fingerprint).toBe(
      await derivePersonalityEvidenceChannelPolicyFingerprint(policy)
    );
    for (const channel of catalog.channels) {
      expect(channel.criterion.length).toBeGreaterThan(0);
      for (const value of Object.values(channel)) expect(typeof value).not.toBe("number");
    }
  });
});
