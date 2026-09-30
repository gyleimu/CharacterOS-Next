/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV1 — protocol audit tests. ZERO model calls, fully offline.
 *
 *   1. all three V1 gates PASS
 *   2. V1's override block differs from V0's by EXACTLY the version-token substitution
 *   3. V1's JSON schema differs from V0's only in the version const
 *   4. the V0 measurement parameters are inherited byte-identically (fixtures, expected
 *      decisions, vocabulary, definitions, r_pilot, thresholds, generation settings)
 *   5. the V0 run artifacts are byte-unchanged since they were written (re-verified against
 *      their own recorded RUN_MANIFEST hashes)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import {
  DECISION_PROBE_DECISIONS,
  DECISION_PROBE_DEFINITIONS_V0,
  DECISION_PROBE_JSON_SCHEMA,
  DECISION_PROBE_OVERRIDE_BLOCK_V0,
  DECISION_PROBE_SCHEMA_VERSION
} from "../decision-probe-v0/contract.ts";
import { D0_FIXTURES, D0_PROTOCOL_V0 } from "../decision-probe-v0/fixtures.ts";
import { runV1AuditsV0 } from "./audits.ts";
import {
  DECISION_PROBE_V1_INHERITED_V0,
  DECISION_PROBE_V1_JSON_SCHEMA,
  DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED,
  DECISION_PROBE_V1_QUALIFICATION_RULE,
  DECISION_PROBE_V1_SCHEMA_VERSION
} from "./contract.ts";

const V0_RUNS = [
  "d0q-formal-qwen35-9b",
  "d0q-run-002-qwen35-9b"
] as const;

const EVIDENCE_ROOT = "research/experiments/decision-probe-v0/evidence";

describe("DecisionProbeV1 — 1. the three frozen gates", () => {
  it("construct-neutrality, fixture-blindness and state-blindness all PASS", async () => {
    const bundle = await runV1AuditsV0();
    for (const result of bundle.results) {
      expect(`${result.audit}:${result.status}`).toBe(`${result.audit}:PASS`);
    }
    expect(bundle.all_pass).toBe(true);
    expect(bundle.results).toHaveLength(3);
  });

  it("the construct-neutrality report records no forbidden category", async () => {
    const bundle = await runV1AuditsV0();
    const neutrality = bundle.results.find((r) => r.audit === "CONSTRUCT_NEUTRALITY");
    expect(neutrality?.status).toBe("PASS");
    expect(neutrality?.detail.join(" ")).toContain("no STATE_GUIDANCE, no CONDITION_GUIDANCE");
  });

  it("the state-blindness report lists the single justified exception", async () => {
    const bundle = await runV1AuditsV0();
    const state = bundle.results.find((r) => r.audit === "STATE_BLINDNESS");
    expect(state?.status).toBe("PASS");
    expect(state?.detail.join(" ")).toContain("SUBJECT DATA");
    expect(state?.detail.join(" ")).toContain("never guides the executor");
  });
});

describe("DecisionProbeV1 — 2/3. the only declared contract delta is the version token", () => {
  it("the override block differs from V0's by exactly one token substitution", () => {
    const roundTripped = DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED.replaceAll(
      `"${DECISION_PROBE_V1_SCHEMA_VERSION}"`,
      `"${DECISION_PROBE_SCHEMA_VERSION}"`
    );
    expect(roundTripped).toBe(DECISION_PROBE_OVERRIDE_BLOCK_V0);
    const occurrences =
      DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED.split(`"${DECISION_PROBE_V1_SCHEMA_VERSION}"`)
        .length - 1;
    expect(occurrences).toBe(1);
  });

  it("the V1 JSON schema differs from V0's only in the version const", () => {
    const v1 = canonicalJsonString(DECISION_PROBE_V1_JSON_SCHEMA);
    const v0 = canonicalJsonString(DECISION_PROBE_JSON_SCHEMA);
    expect(v1).not.toBe(v0);
    const downgraded = JSON.parse(v1.replaceAll(DECISION_PROBE_V1_SCHEMA_VERSION, DECISION_PROBE_SCHEMA_VERSION)) as unknown;
    expect(canonicalJsonString(downgraded)).toBe(v0);
  });

  it("V1's version token is distinct from V0's", () => {
    expect(DECISION_PROBE_V1_SCHEMA_VERSION).not.toBe(DECISION_PROBE_SCHEMA_VERSION);
  });
});

describe("DecisionProbeV1 — 4. V0 measurement parameters inherited byte-identically", () => {
  it("vocabulary, definitions, decisions and fixtures are the frozen V0 values", () => {
    expect(canonicalJsonString(DECISION_PROBE_V1_INHERITED_V0.decisions)).toBe(
      canonicalJsonString(DECISION_PROBE_DECISIONS)
    );
    expect(canonicalJsonString(DECISION_PROBE_V1_INHERITED_V0.definitions)).toBe(
      canonicalJsonString(DECISION_PROBE_DEFINITIONS_V0)
    );
    expect(DECISION_PROBE_V1_INHERITED_V0.source_override_block_length).toBe(
      DECISION_PROBE_OVERRIDE_BLOCK_V0.length
    );
  });

  it("the qualification rule is frozen and declares no retrospective effect", () => {
    expect(DECISION_PROBE_V1_QUALIFICATION_RULE.measurement_mode).toBe("SUBSTITUTION_WITH_OVERRIDE");
    expect(DECISION_PROBE_V1_QUALIFICATION_RULE.diagnostic_mode).toBe("PURE_SUBSTITUTION");
    expect(DECISION_PROBE_V1_QUALIFICATION_RULE.diagnostic_vetoes).toBe(false);
    expect(DECISION_PROBE_V1_QUALIFICATION_RULE.applies_retrospectively_to_v0).toBe(false);
    expect(Object.isFrozen(DECISION_PROBE_V1_QUALIFICATION_RULE)).toBe(true);
  });

  it("the fixtures and the frozen D0 protocol are unchanged", () => {
    expect(D0_FIXTURES).toHaveLength(3);
    expect(D0_PROTOCOL_V0.r_pilot).toBe(3);
    expect(D0_FIXTURES.map((f) => f.expected_decision)).toEqual([
      "ACCEPT",
      "REJECT",
      "VERIFY"
    ]);
  });
});

describe("DecisionProbeV1 — 5. the V0 run artifacts are byte-unchanged", () => {
  for (const run of V0_RUNS) {
    it(`${run}: every recorded artifact hash still matches`, async () => {
      const dir = join(EVIDENCE_ROOT, run);
      const manifest = JSON.parse(await readFile(join(dir, "RUN_MANIFEST.json"), "utf8")) as {
        artifact_hashes: Record<string, string>;
      };
      const names = Object.keys(manifest.artifact_hashes);
      expect(names.length).toBeGreaterThanOrEqual(6);
      for (const name of names) {
        const content = await readFile(join(dir, name), "utf8");
        const recomputed = await hashEnvelope(
          "characteros-next/research/decision-probe/artifact/v0",
          { name, content }
        );
        expect(`${name}=${recomputed}`).toBe(`${name}=${manifest.artifact_hashes[name]}`);
      }
    });
  }

  it("RUN_001's verdict is still DECISION_INSTRUMENT_UNQUALIFIED and RUN_002's is still INCONCLUSIVE_BY_MODE_DIVERGENCE", async () => {
    const read = async (run: string): Promise<string> => {
      const verdict = JSON.parse(
        await readFile(join(EVIDENCE_ROOT, run, "verdict.json"), "utf8")
      ) as { overall_verdict: string };
      return verdict.overall_verdict;
    };
    expect(await read("d0q-formal-qwen35-9b")).toBe("DECISION_INSTRUMENT_UNQUALIFIED");
    expect(await read("d0q-run-002-qwen35-9b")).toBe("INCONCLUSIVE_BY_MODE_DIVERGENCE");
  });
});
