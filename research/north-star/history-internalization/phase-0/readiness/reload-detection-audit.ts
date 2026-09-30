/**
 * §4 SYNTHETIC FALSIFIABILITY AUDIT for mid-gate reload detection — 0 provider calls.
 *
 *   npx tsx phase-0/readiness/reload-detection-audit.ts <outdir>
 *
 * Every case mutates the OBSERVATION TIMELINE (the actual input the detector reads), not a copy of
 * the detector's own output. A mutation that mutates nothing proves nothing, so each row asserts
 * that the mutated timeline DIFFERS from the baseline before its expected verdict is checked.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { buildReloadTimelineV0, detectMidGateReloadV0, type ReloadObservationV0 } from "./reload-detection.ts";

const DIGEST = "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7";
const OTHER_DIGEST = "1111111111111111111111111111111111111111111111111111111111111111";

interface SampleV0 {
  readonly ordinal: number;
  readonly loadedBefore: boolean;
  readonly loadedAfter: boolean;
  readonly digestBefore: string | null;
  readonly digestAfter: string | null;
}

type Kind = "FALSIFYING" | "POSITIVE_CONTROL";

interface CaseV0 {
  readonly id: string;
  readonly kind: Kind;
  /** Human description of the REAL mutation applied to the baseline timeline. */
  readonly mutation: string;
  readonly samples: readonly SampleV0[];
  readonly expectMidGateReload: boolean;
  readonly expectFailure?: boolean;
}

/**
 * Baseline = CASE A: the model starts unloaded, the first planned probe causes one initial load,
 * and the same resident model serves probes 2 and 3.
 */
const CASE_A: readonly SampleV0[] = [
  { ordinal: 1, loadedBefore: false, loadedAfter: true, digestBefore: null, digestAfter: DIGEST },
  { ordinal: 2, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST },
  { ordinal: 3, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST }
];

/** CASE D: the same process/model is resident from the start and stays resident throughout. */
const CASE_D: readonly SampleV0[] = [
  { ordinal: 1, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST },
  { ordinal: 2, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST },
  { ordinal: 3, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST }
];

/** CASE B: probe 1 runs, then the model is explicitly unloaded before probe 2. */
const CASE_B: readonly SampleV0[] = [
  { ordinal: 1, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST },
  { ordinal: 2, loadedBefore: false, loadedAfter: true, digestBefore: null, digestAfter: DIGEST },
  { ordinal: 3, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST }
];

/** CASE C: the digest changes between probe 1 and probe 2. */
const CASE_C: readonly SampleV0[] = [
  { ordinal: 1, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST },
  { ordinal: 2, loadedBefore: true, loadedAfter: true, digestBefore: OTHER_DIGEST, digestAfter: OTHER_DIGEST },
  { ordinal: 3, loadedBefore: true, loadedAfter: true, digestBefore: OTHER_DIGEST, digestAfter: OTHER_DIGEST }
];

/** A second load transition inside the planned sequence — the model was loaded, then loaded AGAIN. */
const SECOND_LOAD: readonly SampleV0[] = [
  { ordinal: 1, loadedBefore: false, loadedAfter: true, digestBefore: null, digestAfter: DIGEST },
  { ordinal: 2, loadedBefore: false, loadedAfter: true, digestBefore: null, digestAfter: DIGEST },
  { ordinal: 3, loadedBefore: true, loadedAfter: true, digestBefore: DIGEST, digestAfter: DIGEST }
];

const cases: readonly CaseV0[] = [
  {
    id: "A_cold_start_then_resident",
    kind: "POSITIVE_CONTROL",
    mutation: "baseline: unloaded → one initial load during probe 1 → resident for probes 2 and 3",
    samples: CASE_A,
    expectMidGateReload: false
  },
  {
    id: "B_explicit_unload_between_probes",
    kind: "FALSIFYING",
    mutation: "probe 2's BEFORE sample is flipped to unloaded, modelling an unload between probe 1 and probe 2",
    samples: CASE_B,
    expectMidGateReload: true,
    expectFailure: true
  },
  {
    id: "C_digest_change_between_probes",
    kind: "FALSIFYING",
    mutation: "probes 2 and 3 carry a DIFFERENT model digest",
    samples: CASE_C,
    expectMidGateReload: true,
    expectFailure: true
  },
  {
    id: "D_resident_throughout",
    kind: "POSITIVE_CONTROL",
    mutation: "baseline: resident from before probe 1 and never unloaded",
    samples: CASE_D,
    expectMidGateReload: false
  },
  {
    id: "E_second_load_transition",
    kind: "FALSIFYING",
    mutation: "probe 2's BEFORE sample is flipped to unloaded, modelling a second load",
    samples: SECOND_LOAD,
    expectMidGateReload: true,
    expectFailure: true
  }
];

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("RELOAD_AUDIT_USAGE: usage: reload-detection-audit.ts <outdir>");
  mkdirSync(outdir, { recursive: true });

  const baselineTimeline = buildReloadTimelineV0(CASE_A);
  const baselineSerialized = JSON.stringify(baselineTimeline);
  const rows: Record<string, unknown>[] = [];

  for (const testCase of cases) {
    const timeline: ReloadObservationV0[] = buildReloadTimelineV0(testCase.samples);
    const serialized = JSON.stringify(timeline);
    // A mutation must have actually changed the input the detector reads.
    const inputActuallyMutated = serialized !== baselineSerialized;
    const result = detectMidGateReloadV0(timeline);
    const verdictMatches = result.mid_gate_reload === testCase.expectMidGateReload;
    const midGateReloadIsNotVacuous = testCase.expectMidGateReload ? result.mid_gate_reload === true : true;
    rows.push({
      case: testCase.id,
      kind: testCase.kind,
      mutation: testCase.mutation,
      input_actually_mutated: inputActuallyMutated,
      expected_mid_gate_reload: testCase.expectMidGateReload,
      observed_mid_gate_reload: result.mid_gate_reload,
      reason: result.reason,
      transitions: result.transitions_observed,
      unloads: result.unloads_observed,
      loads: result.loads_observed,
      digest_changes: result.digest_changes_observed,
      verdict_matches_expected: verdictMatches,
      row_ok:
        verdictMatches &&
        midGateReloadIsNotVacuous &&
        // the baseline row is the only one permitted to be un-mutated, because it IS the baseline
        (testCase.id === "A_cold_start_then_resident" ? true : inputActuallyMutated)
    });
  }

  // The decisive property: a MID-GATE reload can NEVER be reported as clean, and the allowed
  // cold-start can never be reported as a reload.
  const neverCleanWhenForbidden = rows
    .filter((row) => (row["kind"] as Kind) === "FALSIFYING")
    .every((row) => row["observed_mid_gate_reload"] === true);
  const neverFlaggedWhenAllowed = rows
    .filter((row) => (row["kind"] as Kind) === "POSITIVE_CONTROL")
    .every((row) => row["observed_mid_gate_reload"] === false);
  const everyRowOk = rows.every((row) => row["row_ok"] === true);

  const artifact = {
    artifact: "RELOAD_DETECTION_SYNTHETIC_AUDIT",
    model_calls: 0,
    purpose:
      "falsifiability audit for the mid-gate reload detector, before the corrected implementation is used in a real gate run",
    mutation_method:
      "each case mutates the OBSERVATION TIMELINE the detector reads, and the row asserts the mutation actually changed those bytes before checking the verdict",
    baseline: "case A",
    rows,
    every_row_ok: everyRowOk,
    falsifying_rows_reported_a_reload: neverCleanWhenForbidden,
    positive_control_rows_reported_clean: neverFlaggedWhenAllowed,
    detector_is_falsifiable: everyRowOk && neverCleanWhenForbidden && neverFlaggedWhenAllowed,
    known_limit:
      "a silent unload-and-reload completing entirely between two sample points while ending resident is not observable by this detector; that limit is recorded in the detector's own detection_scope field"
  };
  const manifest = {
    artifact: "READINESS_IMPLEMENTATION_MANIFEST",
    correction: {
      scientific_content_changed: false,
      readiness_predicate_changed: false,
      request_bytes_changed: false,
      provider_config_changed: false,
      implementation_conformance_changed: true,
      what_changed:
        "`no_provider_reload_midway` no longer compares every probe's pre-state against probe 1's. It now implements the frozen semantics: one initial load caused by the first planned probe is ALLOWED; any unload, second load, digest change or provider restart within the planned sequence is FORBIDDEN."
    },
    frozen_by_this_round: [
      "reload-detection.ts source hash",
      "the synthetic audit result",
      "this manifest"
    ],
    prior_gates: {
      gate_1: "FAIL (immutable)",
      gate_2: "FAIL (immutable)",
      note:
        "a correction made after gate 2 does NOT retroactively change gate 2, and must not. Gate 2 already failed on unambiguous primary conditions: 3 planned probes, 0 completed within the frozen timeout, 3 timeouts."
    }
  };
  writeFileSync(join(outdir, "RELOAD_DETECTION_SYNTHETIC_AUDIT.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const detectorSource = JSON.stringify(detectMidGateReloadV0.toString());
  writeFileSync(
    join(outdir, "READINESS_IMPLEMENTATION_MANIFEST.json"),
    `${JSON.stringify(
      {
        ...manifest,
        source_hashes: {
          "reload-detection.ts#detectMidGateReloadV0": `sha256:${createHash("sha256").update(detectorSource).digest("hex")}`,
          "RELOAD_DETECTION_SYNTHETIC_AUDIT.json": `sha256:${createHash("sha256").update(JSON.stringify(artifact)).digest("hex")}`
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`RELOAD DETECTION SYNTHETIC AUDIT (0 model calls) — ${rows.filter((r) => r["row_ok"] === true).length}/${rows.length} rows ok`);
  for (const row of rows) {
    console.log(
      `  ${String(row["kind"]).padEnd(16)} ${String(row["case"]).padEnd(36)} expected=${String(row["expected_mid_gate_reload"]).padEnd(5)} observed=${String(row["observed_mid_gate_reload"]).padEnd(5)} mutated=${String(row["input_actually_mutated"])}`
    );
  }
  console.log(`  falsifiable: ${String(artifact.detector_is_falsifiable)}`);
  if (!artifact.detector_is_falsifiable) process.exitCode = 1;
}

await main();
