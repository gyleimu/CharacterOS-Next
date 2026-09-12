/**
 * CORE_INTEGRITY_AUDIT_V0 regression — CHARACTEROS_DISABLE_ADAPTATION must gate
 * the adaptation DEPENDENCIES, not merely their diagnostics.
 *
 * The host contract treats a null belief/relationship provider as DISABLED (no
 * provider calls). The flag previously only changed the diagnostics/progress
 * display while both providers were still constructed and passed to the
 * session, so adaptation ran even when the operator disabled it.
 *
 * Constructing the bundle performs no provider calls.
 */

import { describe, expect, it } from "vitest";

import { environmentFromRecordV0, resolveProductConfigurationV0, type ProductConfigurationV0 } from "./product-configuration.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";

function configuration(record: Readonly<Record<string, string | undefined>>): ProductConfigurationV0 {
  return resolveProductConfigurationV0({
    environment: environmentFromRecordV0(record),
    default_data_root: "/tmp/characteros-audit",
    default_data_root_origin: "audit"
  });
}

function bundle(record: Readonly<Record<string, string | undefined>>) {
  return createProductProviderBundleV0({ configuration: configuration(record), write: () => {} });
}

describe("CHARACTEROS_DISABLE_ADAPTATION gating", () => {
  it("wires belief and relationship adaptation providers by default", () => {
    const built = bundle({});
    expect(built.beliefSemanticProvider).not.toBeNull();
    expect(built.relationshipFamiliarityAdmissionProvider).not.toBeNull();
    expect(built.turnPlan.belief_adaptation_enabled).toBe(true);
    expect(built.turnPlan.relationship_adaptation_enabled).toBe(true);
  });

  it("resolves both adaptation providers to null (DISABLED) when adaptation is disabled", () => {
    const built = bundle({ CHARACTEROS_DISABLE_ADAPTATION: "1" });
    expect(built.beliefSemanticProvider).toBeNull();
    expect(built.relationshipFamiliarityAdmissionProvider).toBeNull();
    expect(built.turnPlan.belief_adaptation_enabled).toBe(false);
    expect(built.turnPlan.relationship_adaptation_enabled).toBe(false);
  });
});
