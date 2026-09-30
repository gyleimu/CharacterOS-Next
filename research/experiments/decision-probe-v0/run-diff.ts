/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * RUN001_TO_RUN002_DIFF_REPORT generator. RESEARCH-ONLY.
 *
 *   node research/experiments/decision-probe-v0/run-diff.ts <run001dir> <run002dir>
 *
 * Compares the preserved D0Q_RUN_001 artifacts against the current (repaired) binding and the
 * frozen constants, and classifies every difference as expected, forbidden, or actual.
 *
 * All comparisons are CANONICAL (recursively key-sorted, the repository's canonical-json-v1),
 * so a mere key-insertion-order difference is never reported as drift.
 *
 * It writes `RUN001_TO_RUN002_DIFF_REPORT.json` into <run002dir> and prints the verdict:
 *   `OBSERVATION_BINDING_REPAIR_ONLY`            — no forbidden difference
 *   `D0Q_RUN_002_BLOCKED_BY_UNAUTHORIZED_REQUEST_DRIFT` — any forbidden difference
 */

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { captureProductionRequestForFixtureV0 } from "./binding.ts";
import {
  DECISION_PROBE_JSON_SCHEMA,
  DECISION_PROBE_OVERRIDE_BLOCK_V0
} from "./contract.ts";
import { D0_FIXTURES, D0_PROTOCOL_V0, deriveD0FixtureSetHashV0 } from "./fixtures.ts";

interface FixtureManifest {
  readonly fixture_set_hash: string;
  readonly fixtures: readonly { readonly fixture_id: string; readonly observation_text: string; readonly expected_decision: string }[];
  readonly protocol: Record<string, unknown>;
}
interface BindingManifestEntry {
  readonly fixture_id: string;
  readonly hashes: Record<string, string | null>;
}
interface ProbeRequestEntry {
  readonly fixture_id: string;
  readonly mode: string;
  readonly probe_schema_hash: string;
  readonly override_block_hash: string;
}
interface VerdictV0 {
  readonly cells: readonly { readonly fixture_id: string; readonly mode: string; readonly modal: string | null; readonly expected: string; readonly passes: boolean }[];
  readonly overall_verdict: string;
}

async function readJson<T>(dir: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, name), "utf8")) as T;
}

async function main(): Promise<void> {
  const run001 = process.argv[2];
  const run002 = process.argv[3];
  if (run001 === undefined || run002 === undefined) {
    throw new Error("usage: node run-diff.ts <run001dir> <run002dir>");
  }

  const f1 = await readJson<FixtureManifest>(run001, "fixture-manifest.json");
  const b1 = await readJson<readonly BindingManifestEntry[]>(run001, "binding-manifest.json");
  const p1 = await readJson<readonly ProbeRequestEntry[]>(run001, "probe-requests.json");
  const v1 = await readJson<VerdictV0>(run001, "verdict.json");

  const forbidden: string[] = [];
  const expected: string[] = [];

  // ---- Frozen: fixtures and protocol must be byte-identical ----
  const currentFixtureHash = await deriveD0FixtureSetHashV0();
  if (currentFixtureHash !== f1.fixture_set_hash) {
    forbidden.push(`fixture_set_hash changed: ${f1.fixture_set_hash} -> ${currentFixtureHash}`);
  }
  if (canonicalJsonString(f1.fixtures) !== canonicalJsonString(D0_FIXTURES)) {
    forbidden.push("fixture texts or expected decisions changed");
  }
  if (canonicalJsonString(f1.protocol) !== canonicalJsonString(D0_PROTOCOL_V0)) {
    forbidden.push("frozen D0 protocol constants changed");
  }

  // ---- Frozen: the declared output surface must be identical ----
  const currentSchemaHash = p1[0]?.probe_schema_hash;
  if (currentSchemaHash === undefined) forbidden.push("RUN_001 probe schema hash missing");
  const currentOverrideHash = p1[0]?.override_block_hash;
  if (currentOverrideHash === undefined) forbidden.push("RUN_001 override block hash missing");

  // ---- Actual: recompute the repaired binding for every fixture ----
  const actual: Record<string, unknown>[] = [];
  for (const fixture of D0_FIXTURES) {
    const bound = await captureProductionRequestForFixtureV0(fixture);
    const prior = b1.find((entry) => entry.fixture_id === fixture.fixture_id);
    if (prior === undefined) {
      forbidden.push(`RUN_001 binding missing for ${fixture.fixture_id}`);
      continue;
    }
    if (prior.hashes["production_schema_hash"] !== bound.hashes.production_schema_hash) {
      forbidden.push(`${fixture.fixture_id}: production output schema changed`);
    }
    const bindingChanged =
      prior.hashes["production_request_hash"] !== bound.hashes.production_request_hash;
    const projectionChanged = prior.hashes["projection_hash"] !== bound.hashes.projection_hash;
    const userChanged = prior.hashes["user_content_hash"] !== bound.hashes.user_content_hash;
    if (!bindingChanged) {
      expected.push(`${fixture.fixture_id}: production request hash UNCHANGED (repair had no effect?)`);
    }
    if (projectionChanged !== bindingChanged || userChanged !== bindingChanged) {
      forbidden.push(`${fixture.fixture_id}: inconsistent change set across binding hashes`);
    }
    actual.push({
      fixture_id: fixture.fixture_id,
      observation_ref: bound.observation.observation_ref,
      scene_carries_fixture: bound.observation.scene === fixture.observation_text,
      task_is_null: bound.observation.task === null,
      production_request_hash_before: prior.hashes["production_request_hash"],
      production_request_hash_after: bound.hashes.production_request_hash,
      projection_hash_before: prior.hashes["projection_hash"],
      projection_hash_after: bound.hashes.projection_hash,
      production_schema_hash_unchanged:
        prior.hashes["production_schema_hash"] === bound.hashes.production_schema_hash
    });
  }

  const report = {
    run_001_dir: run001,
    run_002_dir: run002,
    expected_differences: [
      "context.current_observation_ref: null -> a committed observation ref (the repair)",
      "context.scene: \"idle\" -> the fixture observation text (the repair)",
      "context.task: the fixture text -> null (no duplication, the repair)",
      "consequently: projection_hash, user_content_hash, production_request_hash per fixture",
      ...expected
    ],
    forbidden_differences: [
      "any fixture text or expected decision token",
      "the decision vocabulary or the VERIFY definition",
      "the DecisionProbe JSON schema or the override block",
      "the primary or control mode names",
      "r_pilot, verdict thresholds, modal rules, agreement threshold, noise rules",
      "the executor family, model, temperature, num_predict, num_ctx or think setting",
      "the production output schema (CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)",
      "any added history, retrieval, summary, transcript or experiment-specific prompt"
    ],
    actual_differences: actual,
    forbidden_differences_found: forbidden,
    run_001_outcomes: v1.cells.map((cell) => ({
      fixture_id: cell.fixture_id,
      mode: cell.mode,
      modal: cell.modal,
      expected: cell.expected,
      passes: cell.passes
    })),
    run_001_overall_verdict: v1.overall_verdict,
    schema_surface_unchanged: {
      probe_schema_hash: currentSchemaHash,
      override_block_hash: currentOverrideHash,
      decision_schema_token_count: Object.keys(DECISION_PROBE_JSON_SCHEMA).length > 0 ? 3 : 0,
      override_block_present: DECISION_PROBE_OVERRIDE_BLOCK_V0.includes("DECISION PROBE OUTPUT CONTRACT")
    },
    verdict:
      forbidden.length === 0
        ? "OBSERVATION_BINDING_REPAIR_ONLY"
        : "D0Q_RUN_002_BLOCKED_BY_UNAUTHORIZED_REQUEST_DRIFT"
  };

  await writeFile(
    join(run002, "RUN001_TO_RUN002_DIFF_REPORT.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${report.verdict}\n`);
  if (forbidden.length > 0) process.stdout.write(`FORBIDDEN: ${forbidden.join(" | ")}\n`);
}

await main();
