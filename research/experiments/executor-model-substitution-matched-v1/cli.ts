/**
 * EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — CLI.
 *
 *   node .../cli.ts prepare   <dir>            # 0 model calls: precheck + prompt equivalence + manifest
 *   node .../cli.ts pilot     <dir> [outdir]   # per-executor host validity pilots (interleaved)
 *   node .../cli.ts run       <dir> [outdir]   # paired primary (40 scenes per executor)
 *   node .../cli.ts replicate <dir> [outdir]   # paired replication (40 scenes per executor)
 *
 * The API credential is read from the environment ONLY and is never written to any file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { GATES } from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";
import type { HistoryBundle } from "../relationship-familiarity-context-mediation-final-replication-v2/world.ts";

import {
  API_EXECUTOR,
  EXECUTOR_IDS,
  EXPERIMENT_ID,
  INTERLEAVE_ORDER,
  LOCAL_EXECUTOR,
  PORTABILITY_FIX,
  PRE_PORTABILITY_LOCAL_RESULT,
  PRIMARY_REPLICATES,
  REPLICATION_REPLICATES,
  RETRY_POLICY,
  pilotSchedule,
  primarySchedule,
  replicationSchedule
} from "./contract.ts";
import { runMatchedPrecheck } from "./precheck.ts";
import { readPhase, runPhase, type ExecutionPhase, type PhaseResult } from "./runner.ts";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function prepare(directory: string): Promise<void> {
  mkdirSync(directory, { recursive: true });
  const { report, bundles } = await runMatchedPrecheck();
  writeJson(join(directory, "precheck.json"), report);
  writeJson(join(directory, "histories.json"), bundles);

  const manifest = {
    schema_version: "executor-matched-manifest-v1",
    experiment_id: EXPERIMENT_ID,
    core_question: "with every CharacterOS scientific input held equal, does changing ONLY the executor model (local qwen3.5:9b vs API deepseek-flash) change the familiarity context-mediation result?",
    independent_variable: "COGNITIVE_EXECUTOR_MODEL",
    isolation_target: "SEMANTIC_INFORMATION_EQUAL (NOT provider enforcement strength)",
    portability_fix: PORTABILITY_FIX,
    pre_portability_local_result: PRE_PORTABILITY_LOCAL_RESULT,
    executors: { LOCAL_QWEN: LOCAL_EXECUTOR, API_DEEPSEEK: API_EXECUTOR },
    interleave_order: INTERLEAVE_ORDER,
    execution_order_policy: "PAIRED_INTERLEAVED_LOCAL_THEN_API_PER_CELL_AND_INDEX",
    scientific_setup_source: "reused verbatim by import from relationship-familiarity-context-mediation-final-replication-v2",
    cells: ["A_LOW_NO_CONTEXT", "B_HIGH_CONTEXT", "C_HIGH_CONTEXT_ABLATED", "D_LOW_CONTEXT_EQUALIZED"],
    familiarity_law_unchanged: true,
    governance_fix_source: "github.com/gyleimu/CharacterOS-Next",
    schedules: {
      pilot_scenes_per_executor: pilotSchedule().length,
      primary_scenes_per_executor: primarySchedule().length,
      replication_scenes_per_executor: replicationSchedule().length,
      total_scientific_scenes_both_executors: (primarySchedule().length + replicationSchedule().length) * EXECUTOR_IDS.length,
      primary_replicates: PRIMARY_REPLICATES,
      replication_replicates: REPLICATION_REPLICATES
    },
    gates: GATES,
    retry_policy: RETRY_POLICY,
    seed_contamination_gate: {
      per_cell: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, {
        seed_contains_governed_relationship_state: (bundle as HistoryBundle).seed_contamination.seed_contains_governed_relationship_state,
        seeded_bundles_with_writer_authority: (bundle as HistoryBundle).seed_contamination.seeded_bundles_with_writer_authority,
        unreadable_seed_shapes: (bundle as HistoryBundle).seed_contamination.unreadable_seed_shapes
      }])),
      all_clean: Object.values(bundles).every((entry) => entry.seed_contamination.clean)
    },
    familiarity_values: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).familiarity_value])),
    hashes: report.hashes,
    prompt_equivalence_attested: report.prompt_equivalence.attested,
    precheck_all_pass: report.checks_all_pass,
    precheck_failures: report.failures,
    run_authorized: report.checks_all_pass
  };
  writeJson(join(directory, "manifest.json"), manifest);

  process.stdout.write([
    `Prepared ${EXPERIMENT_ID}.`,
    `Precheck: ${report.checks_all_pass ? `ALL ${Object.keys(report.checks).length} CHECKS PASS` : `FAILED (${report.failures.join(", ")})`}.`,
    `Prompt equivalence: ${report.prompt_equivalence.attested ? "ATTESTED (semantic information equal across executors)" : "NOT ATTESTED"}.`,
    `Planned: ${String(manifest.schedules.pilot_scenes_per_executor)} pilot scenes per executor, ${String(manifest.schedules.total_scientific_scenes_both_executors)} scientific scenes total.`,
    `Run authorized: ${String(manifest.run_authorized)}.`,
    ""
  ].join("\n"));
  if (!manifest.run_authorized) process.exitCode = 3;
}

function summarize(result: PhaseResult): string {
  const lines = [`Phase: ${result.phase}.`];
  for (const executor of EXECUTOR_IDS) {
    const verdict = result.verdicts[executor];
    lines.push(
      `  ${executor}: ${verdict.phase_verdict}${verdict.scientific_verdict === null ? "" : ` → ${verdict.scientific_verdict}`}`
      + ` | host-valid ${verdict.host_valid_scenes}/${verdict.total_scenes} = ${verdict.host_valid_rate.toFixed(3)} (gate ${verdict.host_valid_gate_pass ? "PASS" : "FAIL"})`
      + ` | schema failures ${verdict.schema_failures} | source-binding failures ${verdict.source_binding_failures} | retries ${verdict.retry_count}`
      + ` | tokens ${verdict.accounting.total_tokens} | cost ${verdict.accounting.api_cost}`
    );
    lines.push(`    contrasts: ${verdict.contrasts.map((entry) => `${entry.id} ${entry.directional}/${entry.comparable_pairs}`).join("; ")}`);
    lines.push(`    criteria: ${Object.entries(verdict.criteria).map(([name, ok]) => `${ok ? "PASS" : "FAIL"} ${name}`).join("; ")}`);
  }
  if (result.cross !== null) lines.push(`  CROSS: ${result.cross.cross_verdict} — ${result.cross.detail}`);
  lines.push("");
  return lines.join("\n");
}

async function execute(directory: string, outputDirectory: string, phase: ExecutionPhase): Promise<void> {
  mkdirSync(outputDirectory, { recursive: true });
  const bundles = JSON.parse(readFileSync(join(directory, "histories.json"), "utf8")) as Record<string, HistoryBundle>;
  const priorPrimary = phase === "replication" ? readPhase(join(directory, "primary", "verdict-primary.json")) : undefined;
  if (phase === "replication" && priorPrimary === undefined) {
    process.stderr.write("replication requires the primary phase result (run `run` first, or place verdict-primary.json under <dir>/primary/)\n");
    process.exitCode = 4;
    return;
  }
  const result = await runPhase({ phase, bundles, evidenceDir: outputDirectory, priorPrimary });
  writeFileSync(join(outputDirectory, "SUMMARY.md"), `# ${EXPERIMENT_ID} — ${phase}\n\n\`\`\`\n${summarize(result)}\`\`\`\n`);
  process.stdout.write(summarize(result));
}

const [command, directory, outputDirectory] = process.argv.slice(2);
if (command === "prepare" && directory !== undefined) await prepare(directory);
else if (command === "pilot" && directory !== undefined) await execute(directory, outputDirectory ?? join(directory, "pilot"), "pilot");
else if (command === "run" && directory !== undefined) await execute(directory, outputDirectory ?? join(directory, "primary"), "primary");
else if (command === "replicate" && directory !== undefined) await execute(directory, outputDirectory ?? join(directory, "replication"), "replication");
else {
  process.stderr.write("usage: cli.ts prepare <dir> | pilot <dir> [outdir] | run <dir> [outdir] | replicate <dir> [outdir]\n");
  process.exitCode = 2;
}
