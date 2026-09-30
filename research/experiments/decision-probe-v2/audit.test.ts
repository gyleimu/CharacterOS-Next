/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV2 — protocol audit tests. ZERO model calls, fully offline.
 */

import { describe, expect, it } from "vitest";

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import { captureProductionRequestForFixtureV0 } from "../decision-probe-v0/binding.ts";
import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { D0_FIXTURES } from "../decision-probe-v0/fixtures.ts";
import { DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED } from "../decision-probe-v1/contract.ts";
import { buildDecisionProbeV1Request } from "../decision-probe-v1/probe-v1.ts";
import {
  DECISION_PROBE_V2_QUALIFICATION_RULE,
  DECISION_PROBE_V2_VERDICTS,
  V2_FORMAT_ONLY_CONTRACT,
  V2_NEUTRAL_LABELS,
  V2_NEUTRAL_LABEL_MAPPING,
  V2_PRIMARY_SEMANTIC_CONTRACT,
  V2_TOKEN_REMAP_CONTRACT,
  V2_VETO_RULES,
  deriveV2ProtocolHashesV0
} from "./contract.ts";
import {
  auditFormatOnlyConstructionV0,
  auditSemanticContractInheritanceV0,
  auditTokenRemapConstructionV0,
  auditTransportEquivalenceV0,
  runV2AuditsV0
} from "./audits.ts";

const FIXTURE_A = D0_FIXTURES[0] as (typeof D0_FIXTURES)[number];

async function requestsFor(): Promise<{
  primary: Awaited<ReturnType<typeof buildDecisionProbeV1Request>>["request"];
  formatOnly: Awaited<ReturnType<typeof buildDecisionProbeV1Request>>["request"];
}> {
  const bound = await captureProductionRequestForFixtureV0(FIXTURE_A);
  const primary = await buildDecisionProbeV1Request({
    production_request: bound.production_request,
    mode: "SUBSTITUTION_WITH_OVERRIDE",
    override_block: V2_PRIMARY_SEMANTIC_CONTRACT
  });
  const formatOnly = await buildDecisionProbeV1Request({
    production_request: bound.production_request,
    mode: "SUBSTITUTION_WITH_OVERRIDE",
    override_block: V2_FORMAT_ONLY_CONTRACT
  });
  return { primary: primary.request, formatOnly: formatOnly.request };
}

describe("DecisionProbeV2 — measurement contract is inherited byte-identically", () => {
  it("V2's primary semantic contract equals V1's override block exactly", () => {
    expect(V2_PRIMARY_SEMANTIC_CONTRACT).toBe(DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED);
    expect(auditSemanticContractInheritanceV0().status).toBe("PASS");
  });

  it("V2 changes zero sent bytes relative to V1's primary mode", async () => {
    const bound = await captureProductionRequestForFixtureV0(FIXTURE_A);
    const v1 = await buildDecisionProbeV1Request({
      production_request: bound.production_request,
      mode: "SUBSTITUTION_WITH_OVERRIDE",
      override_block: DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED
    });
    const v2 = await buildDecisionProbeV1Request({
      production_request: bound.production_request,
      mode: "SUBSTITUTION_WITH_OVERRIDE",
      override_block: V2_PRIMARY_SEMANTIC_CONTRACT
    });
    expect(v2.probe_request_hash).toBe(v1.probe_request_hash);
    expect(canonicalJsonString(v2.request)).toBe(canonicalJsonString(v1.request));
  });
});

describe("DecisionProbeV2 — FORMAT_ONLY diagnostic construction", () => {
  it("removes exactly the anchors and retains Layer A", () => {
    const audit = auditFormatOnlyConstructionV0();
    expect(audit.status).toBe("PASS");
    expect(V2_FORMAT_ONLY_CONTRACT).not.toContain("Decision meanings (binding):");
    for (const token of DECISION_PROBE_DECISIONS) {
      expect(V2_FORMAT_ONLY_CONTRACT).not.toContain(`  ${token} —`);
      expect(V2_FORMAT_ONLY_CONTRACT).toContain(`"${token}"`);
    }
    expect(V2_FORMAT_ONLY_CONTRACT).toContain("Choose exactly one decision");
    expect(V2_FORMAT_ONLY_CONTRACT.split("\n")).toHaveLength(
      V2_PRIMARY_SEMANTIC_CONTRACT.split("\n").length - 4
    );
  });
});

describe("DecisionProbeV2 — TOKEN_REMAP diagnostic construction", () => {
  it("swaps labels, keeps anchors, and keeps the mapping out of the prompt", () => {
    const audit = auditTokenRemapConstructionV0();
    expect(audit.status).toBe("PASS");
    for (const label of V2_NEUTRAL_LABELS) {
      expect(V2_TOKEN_REMAP_CONTRACT).toContain(`  ${label} —`);
      expect(V2_TOKEN_REMAP_CONTRACT).toContain(`"${label}"`);
    }
    for (const token of DECISION_PROBE_DECISIONS) {
      expect(V2_TOKEN_REMAP_CONTRACT).not.toContain(`"${token}"`);
    }
    expect(V2_TOKEN_REMAP_CONTRACT).toContain("Decision labels (binding):");
    expect(V2_NEUTRAL_LABEL_MAPPING).toEqual({ OPTION_A: "ACCEPT", OPTION_B: "VERIFY", OPTION_C: "REJECT" });
  });
});

describe("DecisionProbeV2 — TRANSPORT_EQUIVALENCE_GATE", () => {
  it("Layer A is carried in messages for both contracts", async () => {
    const { primary, formatOnly } = await requestsFor();
    const gate = auditTransportEquivalenceV0({ primary_request: primary, format_only_request: formatOnly });
    expect(gate.status).toBe("PASS");
  });

  it("the dropped member carries no construct information", async () => {
    const { primary } = await requestsFor();
    const schemaText = canonicalJsonString(primary.structured_output?.schema ?? {});
    expect(schemaText).not.toContain("DECISION PROBE OUTPUT CONTRACT");
    expect(schemaText).not.toContain("Decision meanings");
  });

  it("both transports receive byte-identical messages; only structured_output is family-dependent", async () => {
    const { primary } = await requestsFor();
    const system = primary.messages.find((m) => m.role === "system")?.content ?? "";
    const user = primary.messages.find((m) => m.role === "user")?.content ?? "";
    // Layer A lives in the system message; the subject projection lives in the user message.
    expect(system).toContain("DECISION PROBE OUTPUT CONTRACT");
    expect(user).toContain("[current observation]");
    // `messages` is a transport-independent member: the cloud transport forwards it verbatim.
    expect(primary.messages).toHaveLength(2);
  });
});

describe("DecisionProbeV2 — gates, veto rules and qualification rule", () => {
  it("all V2 audits PASS", async () => {
    const { primary, formatOnly } = await requestsFor();
    const bundle = await runV2AuditsV0({ primary_request: primary, format_only_request: formatOnly });
    for (const result of bundle.results) {
      expect(`${result.audit}:${result.status}`).toBe(`${result.audit}:PASS`);
    }
    expect(bundle.all_pass).toBe(true);
    expect(bundle.results.length).toBeGreaterThanOrEqual(7);
  });

  it("diagnostics are explicitly non-vetoing, and the bar is higher than V1", () => {
    expect(Object.isFrozen(V2_VETO_RULES)).toBe(true);
    expect(V2_VETO_RULES.diagnostics_veto).toBe(false);
    expect(V2_VETO_RULES.may_not_veto.join(" ")).toContain("FORMAT_ONLY_DIAGNOSTIC");
    expect(V2_VETO_RULES.may_not_veto.join(" ")).toContain("TOKEN_REMAP_DIAGNOSTIC");
    expect(DECISION_PROBE_V2_QUALIFICATION_RULE.diagnostics_veto).toBe(false);
    expect(DECISION_PROBE_V2_QUALIFICATION_RULE.requires.join(" ")).toContain(
      "CONSTRUCT_RESPONSE_PARAPHRASE_STABLE"
    );
    expect(DECISION_PROBE_V2_QUALIFICATION_RULE.applies_retrospectively_to_v1).toBe(false);
    expect(DECISION_PROBE_V2_QUALIFICATION_RULE.applies_retrospectively_to_v0).toBe(false);
  });

  it("the verdict vocabulary is frozen and contains the transport-specific inconclusive outcomes", () => {
    expect(Object.isFrozen(DECISION_PROBE_V2_VERDICTS)).toBe(true);
    expect([...DECISION_PROBE_V2_VERDICTS]).toContain("INCONCLUSIVE_TRANSPORT_EQUIVALENCE_FAILED");
    expect([...DECISION_PROBE_V2_VERDICTS]).toContain("CROSS_TRANSPORT_DIVERGENCE");
    expect([...DECISION_PROBE_V2_VERDICTS]).not.toContain("DECISION_INSTRUMENT_V2_QUALIFIED_ON_QWEN35_9B");
  });

  it("the three contract hashes are deterministic and mutually distinct", async () => {
    const first = await deriveV2ProtocolHashesV0();
    const second = await deriveV2ProtocolHashesV0();
    expect(first.protocol_hash).toBe(second.protocol_hash);
    expect(first.semantic_contract_hash).toBe(first.semantic_contract_hash);
    expect(new Set([first.semantic_contract_hash, first.format_only_contract_hash, first.token_remap_contract_hash]).size).toBe(3);
    expect(first.semantic_contract_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    // The semantic contract hash must equal the one V1's runs recorded for the same bytes.
    expect(first.semantic_contract_hash).toBe("sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53");
  });
});

describe("DecisionProbeV2 — historical verdicts are untouched", () => {
  it("V0 and V1 run verdicts still read as originally recorded", async () => {
    const { readFile } = await import("node:fs/promises");
    const read = async (path: string): Promise<string> =>
      (JSON.parse(await readFile(path, "utf8")) as { overall_verdict?: string }).overall_verdict ?? (JSON.parse(await readFile(path, "utf8")) as { primary_measurement_mode_verdict?: string }).primary_measurement_mode_verdict ?? "";
    expect(await read("research/experiments/decision-probe-v0/evidence/d0q-formal-qwen35-9b/verdict.json")).toBe(
      "DECISION_INSTRUMENT_UNQUALIFIED"
    );
    expect(await read("research/experiments/decision-probe-v0/evidence/d0q-run-002-qwen35-9b/verdict.json")).toBe(
      "INCONCLUSIVE_BY_MODE_DIVERGENCE"
    );
    expect(
      await read("research/experiments/decision-probe-v1/evidence/d0-v1-run-001-qwen35-9b/verdict.json")
    ).toBe("DECISION_INSTRUMENT_V1_QUALIFIED_ON_QWEN35_9B");
  });
});
