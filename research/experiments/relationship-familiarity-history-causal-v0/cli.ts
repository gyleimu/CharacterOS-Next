/**
 * RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0 — CLI.
 *
 *   node .../cli.ts prepare   <dir>            # 0 real model calls (deterministic phase)
 *   node .../cli.ts run       <dir> [outdir]   # primary execution (real model)
 *   node .../cli.ts replicate <dir> [outdir]   # replication execution (real model)
 *
 * `prepare` refuses to authorize a model run unless the deterministic phase passes:
 * seeds clean, corpus identical, every cell constructed as preregistered, and the
 * treatment cell actually exposing the counterpart mediator. No retries anywhere.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  ALICE,
  CALL_BUDGET,
  CONDITION_IDS,
  EXPERIMENT_ID,
  GATES,
  MODEL,
  REPLICATION_CALL_BUDGET,
  REPLICATES,
  SCENARIOS,
  SUBJECT,
  replicationScenes,
  scheduledCallMaximum,
  scheduledScenes
} from "./contract.ts";
import { runScenes, type ExecutionVerdict } from "./runner.ts";
import { runDeterministicPhase } from "./verify-deterministic.ts";
import { hashJson, type HistoryBundle } from "./world.ts";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

interface ProviderProbe {
  readonly reachable: boolean;
  readonly model: string;
  readonly digest_matches: boolean;
  readonly server_version: string | null;
  readonly error: string | null;
}

async function probeProvider(): Promise<ProviderProbe> {
  try {
    const tags = await fetch(`${MODEL.base_url}/api/tags`).then(async (response) => await response.json()) as {
      readonly models?: readonly { readonly name?: string; readonly digest?: string }[];
    };
    const version = await fetch(`${MODEL.base_url}/api/version`).then(async (response) => await response.json()) as {
      readonly version?: string;
    };
    const entry = (tags.models ?? []).find((candidate) => candidate.name === MODEL.model);
    return {
      reachable: true,
      model: MODEL.model,
      digest_matches: entry?.digest === MODEL.digest,
      server_version: version.version ?? null,
      error: null
    };
  } catch (error) {
    return {
      reachable: false,
      model: MODEL.model,
      digest_matches: false,
      server_version: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function prepare(directory: string): Promise<void> {
  mkdirSync(directory, { recursive: true });
  const { report, bundles } = await runDeterministicPhase();
  writeJson(join(directory, "deterministic.json"), report);
  writeJson(join(directory, "histories.json"), bundles);
  const provider = await probeProvider();
  writeJson(join(directory, "provider.json"), provider);
  const manifest = {
    schema_version: "familiarity-history-causal-manifest-v0",
    experiment_id: EXPERIMENT_ID,
    question:
      "different interaction history → real governed familiarity writer → different familiarity state → systematic cognition/behavior difference under the same model, scenario and base prompt — and is the difference mediated by familiarity?",
    subject: SUBJECT,
    counterpart: ALICE,
    model: MODEL,
    conditions: CONDITION_IDS,
    scenarios: SCENARIOS,
    replicates: REPLICATES,
    gates: GATES,
    call_budget: CALL_BUDGET,
    replication_call_budget: REPLICATION_CALL_BUDGET,
    scheduled_scenes: scheduledScenes().length,
    scheduled_calls_maximum: scheduledCallMaximum(),
    replication_scenes: replicationScenes().length,
    seed_contamination_gate: {
      required_fields: [
        "seed_contains_governed_relationship_state",
        "seeded_bundles_with_writer_authority",
        "unreadable_seed_shapes"
      ],
      required_values: { seed_contains_governed_relationship_state: false, seeded_bundles_with_writer_authority: 0, unreadable_seed_shapes: 0 },
      per_cell: Object.fromEntries(
        Object.entries(bundles).map(([condition, bundle]) => [condition, {
          seed_contains_governed_relationship_state: (bundle as HistoryBundle).seed_contamination.seed_contains_governed_relationship_state,
          seeded_bundles_with_writer_authority: (bundle as HistoryBundle).seed_contamination.seeded_bundles_with_writer_authority,
          unreadable_seed_shapes: (bundle as HistoryBundle).seed_contamination.unreadable_seed_shapes
        }])
      ),
      all_clean: report.all_seed_clean
    },
    familiarity_values: Object.fromEntries(
      Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).familiarity_value])
    ),
    governed_authority_records: Object.fromEntries(
      Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).governed_authority_records.length])
    ),
    corpus_digest: report.corpus_digests[0] ?? null,
    corpus_identical: report.corpus_identical,
    deterministic_gate_passed: report.all_seed_clean && report.all_manipulations_ok && report.corpus_identical && report.mediation_precheck_ok,
    provider,
    model_run_authorized: report.all_seed_clean && report.all_manipulations_ok && report.corpus_identical && report.mediation_precheck_ok && provider.reachable && provider.digest_matches,
    hypothesis_tested: "HISTORY_PLUS_REAL_GOVERNED_FAMILIARITY_VS_BASELINE_SAME_MODEL_SCENARIO_PROMPT"
  };
  writeJson(join(directory, "manifest.json"), manifest);
  process.stdout.write([
    `Prepared ${EXPERIMENT_ID}.`,
    `Seed gate clean: ${String(report.all_seed_clean)}; corpus identical: ${String(report.corpus_identical)}; manipulations ok: ${String(report.all_manipulations_ok)}; mediation precheck: ${String(report.mediation_precheck_ok)}.`,
    `Provider: ${provider.reachable ? `${provider.model} digest_match=${String(provider.digest_matches)} server=${String(provider.server_version)}` : `UNREACHABLE (${String(provider.error)})`}.`,
    `Model run authorized: ${String(manifest.model_run_authorized)}.`,
    ""
  ].join("\n"));
  if (!manifest.model_run_authorized) process.exitCode = 3;
}

function summarize(verdict: ExecutionVerdict): string {
  return [
    `Phase: ${verdict.phase}. Principal verdict: ${verdict.principal_verdict}.`,
    `Host complete: ${String(verdict.host_complete)}; seed clean: ${String(verdict.seed_clean)}; corpus identical: ${String(verdict.corpus_identical)}; manipulation ok: ${String(verdict.manipulation_ok)}.`,
    `Calls: cognition ${verdict.call_accounting.cognition_calls} + language ${verdict.call_accounting.language_calls} = ${verdict.call_accounting.total_calls} / max ${verdict.call_accounting.scheduled_calls_maximum}; planned ${verdict.call_accounting.planned_scenes} actual ${verdict.call_accounting.actual_scenes} duplicates ${verdict.call_accounting.duplicate_scenes} missing ${verdict.call_accounting.missing_scenes} extra ${verdict.call_accounting.extra_scenes}.`,
    `Contrasts: ${verdict.mediation.detail}.`,
    `Mediation supported: ${String(verdict.mediation.mediation_supported)}. Forbidden vocabulary: ${verdict.forbidden_vocabulary.join(", ") || "none"}.`,
    `Detail: ${verdict.detail}`,
    ""
  ].join("\n");
}

async function execute(directory: string, outputDirectory: string, phase: "primary" | "replication" | "control"): Promise<void> {
  mkdirSync(outputDirectory, { recursive: true });
  const bundles = JSON.parse(readFileSync(join(directory, "histories.json"), "utf8")) as Record<string, HistoryBundle>;
  const verdict = await runScenes({ phase, bundles, evidenceDir: outputDirectory });
  writeFileSync(join(outputDirectory, "SUMMARY.md"), [
    `# ${EXPERIMENT_ID} — ${phase} execution`,
    "",
    "```",
    summarize(verdict),
    "```",
    "",
    `verdict_hash: ${hashJson(verdict)}`,
    ""
  ].join("\n"));
  process.stdout.write(summarize(verdict));
  process.stdout.write(`${verdict.principal_verdict}\n`);
}

const [command, directory, outputDirectory] = process.argv.slice(2);
if (command === "prepare" && directory !== undefined) await prepare(directory);
else if (command === "run" && directory !== undefined) {
  await execute(directory, outputDirectory ?? join(directory, "primary"), "primary");
} else if (command === "replicate" && directory !== undefined) {
  await execute(directory, outputDirectory ?? join(directory, "replication"), "replication");
} else if (command === "control" && directory !== undefined) {
  await execute(directory, outputDirectory ?? join(directory, "control"), "control");
} else {
  process.stderr.write("usage: cli.ts prepare <dir> | run <dir> [outdir] | replicate <dir> [outdir] | control <dir> [outdir]\n");
  process.exitCode = 2;
}
