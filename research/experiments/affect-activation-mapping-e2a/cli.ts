/**
 * ACTIVATION_MAPPING_ABLATION_E2A — command-line entrypoint.
 *
 *   node research/experiments/affect-activation-mapping-e2a/cli.ts run <outdir>
 *
 * Order: committed-clean baseline check -> engineering gates -> deterministic
 * selected corpus -> FREEZE manifest (before any trajectory) -> execute 108
 * runs -> persist evidence. No LLM; no network; deterministic.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASELINE_COMMIT, FAMILY_PURPOSE, SEED_SUBSET, VARIANTS } from "./contract.ts";
import { canonicalJson, sha256 } from "./fixtures.ts";
import {
  builtFingerprint, committedBaseline, freshDirectory, sourceFingerprint,
  writeJson, writeText
} from "./artifacts.ts";
import { dependencyFingerprints, E2_FROZEN_BINDINGS, protocol, protocolHash } from "./manifest.ts";
import { runEngineeringGates } from "./gates.ts";
import { buildSelectedCorpus, executeE2A } from "./runner.ts";
import { linePlot } from "../affect-state-retention-e1/plots.ts";

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "";
  if (mode !== "run") {
    throw new Error("usage: node research/experiments/affect-activation-mapping-e2a/cli.ts run <outdir>");
  }
  const outdir = process.argv[3] ?? "tmp/affect-activation-mapping-e2a-run";
  const head = committedBaseline();
  console.log(`baseline: ${head}`);

  console.log("== engineering gates ==");
  const engineering = await runEngineeringGates();

  const output = freshDirectory(outdir);
  console.log(`evidence: ${output}`);

  // ---- deterministic selected corpus + FREEZE the manifest ------------------------
  console.log("== corpus selection ==");
  const { corpus, sequenceHashes } = buildSelectedCorpus();
  const source = sourceFingerprint();
  const built = builtFingerprint();
  const manifestHash = protocolHash();
  const frozenManifest = {
    ...protocol(),
    freeze: {
      source_fingerprint: source,
      built_fingerprint: built,
      protocol_hash: manifestHash,
      dependencies: dependencyFingerprints(),
      e2_protocol_hash: E2_FROZEN_BINDINGS.e2_protocol_hash,
      e2_corpus_root: E2_FROZEN_BINDINGS.e2_corpus_root,
      sequence_hashes: Object.fromEntries(sequenceHashes),
      seed_subset: SEED_SUBSET,
      variants: VARIANTS,
      head,
      head_baseline_commit: BASELINE_COMMIT,
      engineering_gates_dir: engineering.output,
      frozen_before_results: true,
      run_identity: "run-r1",
      amendment_policy: "Never amended after observing results; a code/protocol change invalidates this run identity and requires a new one."
    }
  };
  writeJson(join(output, "manifest.json"), frozenManifest);

  // ---- execute ----------------------------------------------------------------------
  console.log("== execution ==");
  const execution = await executeE2A(manifestHash, E2_FROZEN_BINDINGS.e2_protocol_hash, E2_FROZEN_BINDINGS.e2_corpus_root);
  const result = execution.result;

  // ---- evidence ------------------------------------------------------------------------
  writeJson(join(output, "selected-corpus-index.json"), {
    families: Object.keys(FAMILY_PURPOSE),
    seed_subset: SEED_SUBSET,
    sequence_hashes: Object.fromEntries(sequenceHashes),
    lifetimes: corpus.length
  });
  const metricsJson: Record<string, unknown> = {};
  for (const [k, m] of execution.metricsByRun) metricsJson[k] = m;
  writeJson(join(output, "variant-metrics.json"), {
    per_run: metricsJson,
    comparison_table: result.comparison_table,
    effect_sizes: result.effect_sizes
  });
  for (const [k, outputs] of execution.representativeOutputs) {
    writeJson(join(output, `trajectories/${k.replaceAll("|", "__")}.json`), { key: k, outputs });
  }
  writeJson(join(output, "gates/probe-results.json"), {
    partition_probe: execution.partitionProbe,
    restore_proofs: execution.restoreProofs,
    replay_proofs: execution.replayProofs,
    valence_invariance_max_error: execution.valenceInvarianceMaxError,
    gain_identity_max_error: execution.gainIdentityMaxError
  });
  writeJson(join(output, "gates/decision-gates.json"), { gates: result.gates });
  writeJson(join(output, "result.json"), result);

  // ---- deterministic plots (§51) ---------------------------------------------------------
  mkdirSync(join(output, "plots"), { recursive: true });
  const plots = join(output, "plots");
  const seriesOf = (key: string): readonly (readonly number[])[] =>
    execution.representativeOutputs.get(key) ?? [];
  const activationSeries = (variant: string, color: string, dashed = false) => ({
    label: `${variant} activation`, color, dashed,
    points: seriesOf(`D6|E2-S00|${variant}`).map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number])
  });
  const writeSvg = (name: string, content: string): void =>
    writeFileSync(join(plots, name), content, { flag: "wx" });
  writeSvg("d6-activation-variants.svg", linePlot("D6-S00 alternating - activation by variant (identical axes)", "activation", 0, 1, 11999, [
    activationSeries("A0", "#7f8c8d"),
    activationSeries("A10", "#0b62a4"),
    activationSeries("A20", "#c0392b", true)
  ]));
  writeSvg("d2-chatter-activation.svg", linePlot("D2-S00 chatter - activation by variant (identical axes)", "activation", 0, 1, 11999, [
    { label: "A0", color: "#7f8c8d", points: seriesOf("D2|E2-S00|A0").map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) },
    { label: "A10", color: "#0b62a4", points: seriesOf("D2|E2-S00|A10").map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) },
    { label: "A20", color: "#c0392b", dashed: true, points: seriesOf("D2|E2-S00|A20").map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) }
  ]));
  writeSvg("d3-activation-response.svg", linePlot("D3-S00 ordinary - activation by variant (identical axes)", "activation", 0, 1, 11999, [
    { label: "A0", color: "#7f8c8d", points: seriesOf("D3|E2-S00|A0").map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) },
    { label: "A10", color: "#0b62a4", points: seriesOf("D3|E2-S00|A10").map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) },
    { label: "A20", color: "#c0392b", dashed: true, points: seriesOf("D3|E2-S00|A20").map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) }
  ]));
  writeSvg("d7-stress-recovery.svg", linePlot("D7-S00 stress - activation by variant (identical axes)", "activation", 0, 1, 11999, [
    { label: "A10", color: "#0b62a4", points: seriesOf("D7|E2-S00|A10").filter((_, i) => i % 6 === 0).map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) },
    { label: "A20", color: "#c0392b", dashed: true, points: seriesOf("D7|E2-S00|A20").filter((_, i) => i % 6 === 0).map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number]) }
  ]));

  // ---- SUMMARY ------------------------------------------------------------------------------
  const gateLines = result.gates.map((g) => `| ${g.id} | ${g.status} | ${g.evidence} |`).join("\n");
  writeText(join(output, "SUMMARY.md"),
    `# ACTIVATION_MAPPING_ABLATION_E2A — run summary\n\n` +
    `- Manifest: manifest.json (protocol_hash ${manifestHash}, frozen before results)\n` +
    `- E2 bindings: protocol ${E2_FROZEN_BINDINGS.e2_protocol_hash.slice(0, 16)}..., corpus root ${E2_FROZEN_BINDINGS.e2_corpus_root.slice(0, 16)}...\n` +
    `- Engineering gates: ${engineering.output}/gates.json (PASS)\n` +
    `- Run accounting: ${String(result.run_accounting.measured_total)}/108\n\n` +
    `## Comparison table\n\n\`\`\`json\n${JSON.stringify(result.comparison_table, null, 2)}\n\`\`\`\n\n` +
    `## Effect sizes\n\n\`\`\`json\n${JSON.stringify(result.effect_sizes, null, 2)}\n\`\`\`\n\n` +
    `## Decision gates\n\n| Gate | Status | Evidence |\n|---|---|---|\n${gateLines}\n\n` +
    `## Verdict\n\n**${result.verdict}**\n\n${result.verdict_rationale}\n`);

  console.log(`verdict: ${result.verdict}`);
  console.log(output);
}

function sha256OfEvents(events: readonly unknown[]): string {
  return sha256(canonicalJson(events));
}
void sha256OfEvents;

await main();
