/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — command-line entrypoint.
 *
 *   node research/experiments/affect-production-shaped-e2/cli.ts run <outdir>
 *
 * Order: committed-clean baseline check -> engineering gates -> build
 * deterministic corpus -> FREEZE manifest (before any trajectory) ->
 * execute 1030 runs -> persist evidence. No LLM; no network; deterministic.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES } from "./contract.ts";
import { canonicalJson, round12, sha256 } from "./fixtures.ts";
import {
  builtFingerprint, committedBaseline, freshDirectory, sourceFingerprint,
  writeJson, writeText
} from "./artifacts.ts";
import { e1EvidenceFingerprint, e1LawFingerprint, protocol, protocolHash } from "./manifest.ts";
import { runEngineeringGates } from "./gates.ts";
import { corpusMerkleRoot, executeE2, historyOutputsSnapshot, type FamilyCorpusE2 } from "./runner.ts";
import { buildPrimaryCorpus, validateCorpusEvents } from "./generator.ts";
import { linePlot } from "../affect-state-retention-e1/plots.ts";

const PRODUCTION_SHAPED_DISCLAIMER_TEXT =
  "This is an engineering coverage distribution consistent with current canonical Appraisal contracts. It is NOT an observed, calibrated, representative, or provider-estimated production distribution.";

function sha256Of(life: FamilyCorpusE2): string {
  return sha256(canonicalJson({
    family: life.family, seed: life.seed, T: life.T, quiet: life.quiet, events: life.events
  }));
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "";
  if (mode !== "run") {
    throw new Error("usage: node research/experiments/affect-production-shaped-e2/cli.ts run <outdir>");
  }
  const outdir = process.argv[3] ?? "tmp/affect-production-shaped-e2-run";
  const head = committedBaseline();
  console.log(`baseline: ${head}`);

  console.log("== engineering gates ==");
  const engineering = await runEngineeringGates();

  const output = freshDirectory(outdir);
  console.log(`evidence: ${output}`);

  // ---- deterministic corpus + FREEZE the manifest BEFORE any trajectory ----------
  console.log("== corpus generation ==");
  const { corpus, lifetimes, events: corpusEvents } = buildPrimaryCorpus();
  validateCorpusEvents(corpus);
  const corpusRoot = corpusMerkleRoot(corpus);

  const source = sourceFingerprint();
  const built = builtFingerprint();
  const manifestHash = protocolHash();
  const frozenManifest = {
    ...protocol(),
    freeze: {
      source_fingerprint: source,
      built_fingerprint: built,
      protocol_hash: manifestHash,
      e1_law_fingerprint: e1LawFingerprint(),
      e1_evidence_fingerprint: e1EvidenceFingerprint(),
      corpus_merkle_root: corpusRoot,
      corpus_lifetimes: lifetimes,
      corpus_events: corpusEvents,
      head,
      engineering_gates_dir: engineering.output,
      frozen_before_results: true,
      run_identity: "run-r1",
      amendment_policy: "Never amended after observing results; a code/protocol change invalidates this run identity and requires a new one."
    }
  };
  writeJson(join(output, "manifest.json"), frozenManifest);

  // ---- execute the 1030 runs ------------------------------------------------------
  console.log("== execution ==");
  const execution = await executeE2(manifestHash, corpusRoot, corpus);
  const result = execution.result;

  // ---- corpus evidence ----------------------------------------------------------------
  for (const life of execution.corpus) {
    writeJson(join(output, `corpus/${life.family}/${life.seed}.json`), {
      family: life.family, seed: life.seed, T: life.T, quiet: life.quiet,
      balanced_weighted_signed_sum: round12(life.balanced_weighted_signed_sum),
      events: life.events
    });
  }
  writeJson(join(output, "corpus/index.json"), {
    corpus_merkle_root: corpusRoot,
    lifetimes,
    events: corpusEvents,
    per_file_sha256: execution.corpus.map((life) => ({ file: `${life.family}/${life.seed}.json`, sha256: sha256Of(life) }))
  });

  // ---- metrics evidence --------------------------------------------------------------------
  const metricsJson: Record<string, unknown> = {};
  for (const [k, m] of execution.metricsByRun) metricsJson[k] = m;
  writeJson(join(output, "metrics/per-run.json"), metricsJson);
  writeJson(join(output, "metrics/history-pairs.json"), execution.historyPairResults);
  writeJson(join(output, "metrics/partition-probes.json"), execution.partitionProbe);
  writeJson(join(output, "metrics/c4c5.json"), { max_abs_error: execution.c4c5_max_abs_error });
  writeJson(join(output, "metrics/d4d5-symmetry.json"), execution.d4d5_symmetry_max_error);

  // ---- representative trajectories + B2 native checkpoints ----------------------------------
  for (const [k, outputs] of execution.representativeOutputs) {
    writeJson(join(output, `trajectories/${k.replaceAll("|", "__")}.json`), { key: k, outputs });
  }
  for (const [k, outputs] of historyOutputsSnapshot()) {
    writeJson(join(output, `trajectories/history-${k.replaceAll("|", "__")}.json`), { key: k, outputs });
  }
  for (const [k, run] of execution.b2Representative) {
    writeJson(join(output, `b2/${k.replaceAll("|", "__")}.json`), {
      corpus_id: run.corpus_id, counts: run.counts, routed_counts: run.routed_counts,
      outputs: run.outputs.map((o) => o.map(round12))
    });
  }

  // ---- gates + result ---------------------------------------------------------------------------
  writeJson(join(output, "gates/decision-gates.json"), {
    gates: result.gates,
    structural_note: "B3/B3_RESET differ only in event-state retention: the engine is imported from frozen E1, whose conformance suite machine-checks the structural law (B1==B3_RESET, identical event records, common baseline). E2's C4/C5 invariant proves the ignored-field law end-to-end."
  });
  writeJson(join(output, "result.json"), result);

  // ---- deterministic plots (§72) -------------------------------------------------------------------
  mkdirSync(join(output, "plots"), { recursive: true });
  const plots = join(output, "plots");
  const seriesOf = (key: string): readonly (readonly number[])[] =>
    execution.representativeOutputs.get(key) ?? [];
  const plotSeries = (key: string, column: number, label: string, color: string, dashed = false) => ({
    label, color, dashed,
    points: seriesOf(key).map((o) => [o[0] ?? 0, o[column] ?? 0] as [number, number])
  });
  const writeSvg = (name: string, content: string): void =>
    writeFileSync(join(plots, name), content, { flag: "wx" });
  const tOf = (family: string): number => FAMILIES.find((f) => f.id === family)?.T ?? 12000;

  writeSvg("d2-activation-chatter.svg", linePlot("D2-S00 chatter (all LOW, 1080 events) - B3 activation", "activation", 0, 1, tOf("D2") - 1, [
    plotSeries("D2|E2-S00|B3", 2, "B3 activation", "#0b62a4")
  ]));
  writeSvg("d3-ordinary.svg", linePlot("D3-S00 ordinary (192 events) - B3 valence/activation", "state", -1, 1, tOf("D3") - 1, [
    plotSeries("D3|E2-S00|B3", 1, "valence", "#0b62a4"),
    plotSeries("D3|E2-S00|B3", 2, "activation", "#7d3c98", true)
  ]));
  writeSvg("d4-d5-mirrored-burst.svg", linePlot("D4/D5-S00 mirrored bursts - B3 valence", "valence", -1, 1, 3999, [
    { label: "D4 (negative burst)", color: "#c0392b", points: seriesOf("D4|E2-S00|B3").filter((_, i) => i % 10 === 0).map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "D5 (positive burst)", color: "#117a65", dashed: true, points: seriesOf("D5|E2-S00|B3").filter((_, i) => i % 10 === 0).map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) }
  ]));
  writeSvg("d6-alternating.svg", linePlot("D6-S00 alternating cancellation - B3 valence/activation", "state", -1, 1, tOf("D6") - 1, [
    { label: "valence", color: "#0b62a4", points: seriesOf("D6|E2-S00|B3").filter((_, i) => i % 6 === 0).map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "activation", color: "#7d3c98", dashed: true, points: seriesOf("D6|E2-S00|B3").filter((_, i) => i % 6 === 0).map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) }
  ]));
  writeSvg("d7-stress.svg", linePlot("D7-S00 high density stress - B3 valence/activation", "state", -1, 1, tOf("D7") - 1, [
    { label: "valence", color: "#0b62a4", points: seriesOf("D7|E2-S00|B3").filter((_, i) => i % 6 === 0).map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "activation", color: "#7d3c98", dashed: true, points: seriesOf("D7|E2-S00|B3").filter((_, i) => i % 6 === 0).map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) }
  ]));
  writeSvg("d8-long-run-overview.svg", linePlot("D8-S00 long run (100k ticks, 2520 events) - B3 (every 50th tick)", "state", -1, 1, tOf("D8") - 1, [
    { label: "valence", color: "#0b62a4", points: seriesOf("D8|E2-S00|B3").filter((_, i) => i % 50 === 0).map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "activation", color: "#7d3c98", dashed: true, points: seriesOf("D8|E2-S00|B3").filter((_, i) => i % 50 === 0).map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) }
  ]));
  writeSvg("history-H00.svg", linePlot("H00 history pair - B3 valence (identical final event at t=1500)", "valence", -1, 1, 2700, [
    { label: "history A", color: "#0b62a4", points: (historyOutputsSnapshot().get("H00A|B3") ?? []).map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "history B", color: "#117a65", dashed: true, points: (historyOutputsSnapshot().get("H00B|B3") ?? []).map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) }
  ]));

  // ---- SUMMARY ----------------------------------------------------------------------------------------
  const gateLines = result.gates.map((g) => `| ${g.id} | ${g.status} | ${g.evidence} |`).join("\n");
  writeText(join(output, "SUMMARY.md"),
    `# PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — run summary\n\n` +
    `- Manifest: manifest.json (protocol_hash ${manifestHash}, frozen before results)\n` +
    `- Corpus: ${String(lifetimes)} lifetimes, ${String(corpusEvents)} events, Merkle root ${corpusRoot.slice(0, 16)}...\n` +
    `- Engineering gates: ${engineering.output}/gates.json (PASS)\n` +
    `- Run accounting: ${String(result.run_accounting.measured_total)}/1030\n\n` +
    `${PRODUCTION_SHAPED_DISCLAIMER_TEXT}\n\n` +
    `## Decision gates\n\n| Gate | Status | Evidence |\n|---|---|---|\n${gateLines}\n\n` +
    `## Verdict\n\n**${result.verdict}**\n\n${result.verdict_rationale}\n` +
    (result.mapping_risks.length > 0 ? `\nSub-risks: ${result.mapping_risks.join(", ")}\n` : ""));

  console.log(`verdict: ${result.verdict}`);
  console.log(output);
}

await main();
