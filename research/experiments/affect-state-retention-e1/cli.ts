/**
 * STATE_RETENTION_AND_RECOVERY_E1 — command-line entrypoint.
 *
 *   node research/experiments/affect-state-retention-e1/cli.ts run <outdir>
 *
 * Order: committed-clean baseline check -> engineering gates -> FREEZE
 * manifest (before any result) -> execute experiment -> persist evidence.
 * Determinstic; no LLM; no network.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPERIMENT_PATH, SEQUENCES, type SequenceE1
} from "./contract.ts";
import { round12 } from "./fixtures.ts";
import { builtFingerprint, committedBaseline, freshDirectory, sourceFingerprint, writeJson } from "./artifacts.ts";
import { protocol, protocolHash } from "./manifest.ts";
import { runEngineeringGates } from "./gates.ts";
import { executeExperiment, runKey, tEndOf, type RunSet } from "./runner.ts";
import { linePlot } from "./plots.ts";

function persistSequence(pathOf: (p: string) => string, seq: SequenceE1, set: RunSet): void {
  const runs: unknown[] = [];
  for (const [k, run] of [...set.valence, ...set.b2]) {
    runs.push({
      key: k, mechanism: run.mechanism, impulse_scale: run.impulse_scale, partition: run.partition,
      outputs: run.outputs.map((o) => o.map((x) => round12(x))),
      events: run.events
    });
  }
  writeJson(pathOf(`trajectories/${seq.id}.json`), {
    sequence_id: seq.id, purpose: seq.purpose, control_of: seq.control_of, t_end: tEndOf(seq), runs
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "";
  if (mode !== "run") {
    throw new Error("usage: node research/experiments/affect-state-retention-e1/cli.ts run <outdir>");
  }
  const outdir = process.argv[3] ?? `tmp/${EXPERIMENT_PATH.split("/").at(-1)}-run`;
  const head = committedBaseline();
  console.log(`baseline: ${head}`);

  console.log("== engineering gates ==");
  const engineering = await runEngineeringGates();

  const output = freshDirectory(outdir);
  console.log(`evidence: ${output}`);

  // ---- FREEZE the manifest BEFORE any trajectory exists (§42) ---------------------
  const source = sourceFingerprint();
  const built = builtFingerprint();
  const frozenManifest = {
    ...protocol(),
    freeze: {
      source_fingerprint: source,
      built_fingerprint: built,
      protocol_hash: protocolHash(),
      head,
      engineering_gates_dir: engineering.output,
      frozen_before_results: true,
      amendment_policy: "Never amended after observing results; a correction requires a new experiment revision/run identity."
    }
  };
  writeJson(join(output, "manifest.json"), frozenManifest);
  const manifestHash = protocolHash();

  // ---- execute ----------------------------------------------------------------------
  const { result, runSets, valenceMetrics } = await executeExperiment(manifestHash, source, built);

  for (const seq of SEQUENCES) {
    const set = runSets.get(seq.id);
    if (set === undefined) throw new Error(`missing run set ${seq.id}`);
    persistSequence((p) => join(output, p), seq, set);
  }

  const metricsJson: Record<string, unknown> = {};
  for (const [k, m] of valenceMetrics) metricsJson[k] = m;
  writeJson(join(output, "metrics.json"), metricsJson);
  writeJson(join(output, "comparison.json"), result.comparison);
  writeJson(join(output, "restore-replay.json"), { restore_proofs: result.restore_proofs, replay_proof: result.replay_proof });
  writeJson(join(output, "partition-errors.json"), result.partition_errors);
  writeJson(join(output, "sensitivity.json"), result.sensitivity);
  writeJson(join(output, "decision-gates.json"), { structural_law: result.structural_law, gates: result.gates, verdict: result.verdict, verdict_rationale: result.verdict_rationale });

  // ---- deterministic plots (§40) ------------------------------------------------------
  mkdirSync(join(output, "plots"), { recursive: true });
  const plots = join(output, "plots");
  const runOf = (mechanism: string, seqId: string, partition = "tick1", scale = 1): { outputs: readonly (readonly number[])[] } => {
    const set = runSets.get(seqId);
    if (set === undefined) throw new Error(`missing run set ${seqId}`);
    const seq = SEQUENCES.find((s) => s.id === seqId);
    if (seq === undefined) throw new Error(`missing sequence ${seqId}`);
    const run = set.valence.get(runKey(mechanism, seq, partition, scale));
    if (run === undefined) throw new Error(`missing run ${mechanism}/${seqId}/${partition}/${scale}`);
    return run;
  };
  const b2Of = (seqId: string, partition = "tick1"): { outputs: readonly (readonly number[])[] } => {
    const set = runSets.get(seqId);
    if (set === undefined) throw new Error(`missing run set ${seqId}`);
    const seq = SEQUENCES.find((s) => s.id === seqId);
    if (seq === undefined) throw new Error(`missing sequence ${seqId}`);
    const run = set.b2.get(runKey("B2", seq, partition, 1));
    if (run === undefined) throw new Error(`missing B2 run ${seqId}/${partition}`);
    return run;
  };
  const valenceSeries = (mechanism: string, seqId: string, color: string, dashed = false) => ({
    label: `${mechanism} valence`, color, dashed,
    points: runOf(mechanism, seqId).outputs.map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number])
  });
  const activationSeries = (mechanism: string, seqId: string, color: string, dashed = false) => ({
    label: `${mechanism} activation`, color, dashed,
    points: runOf(mechanism, seqId).outputs.map((o) => [o[0] ?? 0, o[2] ?? 0] as [number, number])
  });
  const writeSvg = (name: string, content: string): void =>
    writeFileSync(join(plots, name), content, { flag: "wx" });

  writeSvg("s1-recovery-valence.svg", linePlot("S1 single impulse (t=0: N(0.8)) - valence", "valence", -1, 0.5, tEndOf(SEQUENCES[0] as SequenceE1), [
    valenceSeries("B3", "S1", "#0b62a4"), valenceSeries("B3_RESET", "S1", "#c0392b", true)
  ]));
  writeSvg("s1-recovery-activation.svg", linePlot("S1 single impulse (t=0: N(0.8)) - activation", "activation", 0, 0.5, tEndOf(SEQUENCES[0] as SequenceE1), [
    activationSeries("B3", "S1", "#0b62a4"), activationSeries("B3_RESET", "S1", "#c0392b", true)
  ]));
  writeSvg("s2-weak-event.svg", linePlot("S2 weak same-direction event (t=0: N(0.8), t=10: N(0.2)) - valence", "valence", -1, 0.5, tEndOf(SEQUENCES[1] as SequenceE1), [
    valenceSeries("B3", "S2", "#0b62a4"), valenceSeries("B3_RESET", "S2", "#c0392b", true)
  ]));
  writeSvg("s3-repeated.svg", linePlot("S3 repeated small events (t=0..40: N(0.2) x5) - valence", "valence", -1, 0.5, tEndOf(SEQUENCES[3] as SequenceE1), [
    valenceSeries("B3", "S3", "#0b62a4"), valenceSeries("B3_RESET", "S3", "#c0392b", true)
  ]));
  writeSvg("s5-divergence.svg", linePlot("S5 history divergence (identical N(0.2) at t=60) - valence", "valence", -1, 0.5, tEndOf(SEQUENCES[6] as SequenceE1), [
    { label: "B3 history A (N,N,N)", color: "#0b62a4", points: runOf("B3", "S5_A").outputs.map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "B3 history B (P,P,P)", color: "#117a65", points: runOf("B3", "S5_B").outputs.map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "B3_RESET history A", color: "#c0392b", dashed: true, points: runOf("B3_RESET", "S5_A").outputs.map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) },
    { label: "B3_RESET history B", color: "#e67e22", dashed: true, points: runOf("B3_RESET", "S5_B").outputs.map((o) => [o[0] ?? 0, o[1] ?? 0] as [number, number]) }
  ]));
  writeSvg("s7-saturation.svg", linePlot("S7 sustained maximum input (N(1) every tick t=0..199) then recovery", "state", -1, 1, tEndOf(SEQUENCES[9] as SequenceE1), [
    valenceSeries("B3", "S7", "#0b62a4"), activationSeries("B3", "S7", "#7d3c98", true)
  ]));
  const b2Series = (seqId: string, column: number, label: string, color: string, dashed = false) => ({
    label, color, dashed,
    points: b2Of(seqId).outputs.map((o) => [o[0] ?? 0, o[column] ?? 0] as [number, number])
  });
  writeSvg("b2-s2-native.svg", linePlot("B2 frozen FAST_EMA (S2) - native axes", "intensity / mood", 0, 1, tEndOf(SEQUENCES[1] as SequenceE1), [
    b2Series("S2", 2, "anger intensity", "#c0392b"), b2Series("S2", 1, "mood baseline (x4 scale)", "#7d3c98", true)
  ]));
  writeSvg("b2-s7-native.svg", linePlot("B2 frozen FAST_EMA (S7) - native axes", "intensity / mood", 0, 1, tEndOf(SEQUENCES[9] as SequenceE1), [
    b2Series("S7", 2, "anger intensity", "#c0392b"), b2Series("S7", 1, "mood baseline (x4 scale)", "#7d3c98", true)
  ]));

  writeJson(join(output, "result.json"), result);

  const gateLines = result.gates.map((g) => `| ${g.id} | ${g.status} | ${g.evidence} |`).join("\n");
  writeFileSync(join(output, "SUMMARY.md"),
    `# STATE_RETENTION_AND_RECOVERY_E1 — run summary\n\n` +
    `- Manifest: manifest.json (protocol_hash ${manifestHash}, frozen before results)\n` +
    `- Engineering gates: ${engineering.output}/gates.json (PASS)\n` +
    `- Structural law (§38): ${result.structural_law.holds ? "HOLDS" : "VIOLATED"} — ${result.structural_law.detail}\n` +
    `- Restore proofs: ${JSON.stringify(result.restore_proofs)}\n` +
    `- Replay proof: pass=${String(result.replay_proof.pass)}\n\n` +
    `## Decision gates\n\n| Gate | Status | Evidence |\n|---|---|---|\n${gateLines}\n\n` +
    `## Verdict\n\n**${result.verdict}**\n\n${result.verdict_rationale}\n`, { flag: "wx" });

  console.log(`verdict: ${result.verdict}`);
  console.log(output);
}

await main();
