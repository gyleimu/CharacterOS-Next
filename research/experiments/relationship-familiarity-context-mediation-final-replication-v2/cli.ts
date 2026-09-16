/**
 * RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2 — CLI.
 *
 *   node .../cli.ts prepare   <dir>            # 0 model calls: deterministic precheck + manifest
 *   node .../cli.ts pilot     <dir> [outdir]   # HOST_VALIDITY_PILOT_V2 (no scientific verdict)
 *   node .../cli.ts run       <dir> [outdir]   # primary scientific execution
 *   node .../cli.ts replicate <dir> [outdir]   # independent replication (frozen code)
 *
 * `prepare` writes the frozen cell bundles ONLY if every protocol §4 condition holds.
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
  PILOT_CALL_BUDGET,
  REPLICATION_CALL_BUDGET,
  REPLICATES,
  SCENARIOS,
  SUBJECT,
  TASK_CONTEXT_REF,
  scheduledCallMaximum,
  scheduledScenes
} from "./contract.ts";
import { HISTORY_LABEL, runPrecheck } from "./precheck.ts";
import { readVerdict, runScenes, type ExecutionPhase, type ExecutionVerdict } from "./runner.ts";
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
  const { report, bundles } = await runPrecheck();
  writeJson(join(directory, "precheck.json"), report);
  writeJson(join(directory, "histories.json"), bundles);
  const provider = await probeProvider();
  writeJson(join(directory, "provider.json"), provider);

  const manifest = {
    schema_version: "familiarity-final-replication-manifest-v2",
    experiment_id: EXPERIMENT_ID,
    hypotheses: {
      H1: "higher lawful familiarity activates counterpart-specific retrieval",
      H2: "that retrieval changes model-facing context availability",
      H3: "context availability changes structured cognition / behavior",
      H4: "when context availability is equalized, high vs low familiarity produces no meaningful independent behavioral difference",
      H5: "familiarity does not imply trust/liking/safety/intimacy/dependence/affinity/willingness to take risk"
    },
    subject: SUBJECT,
    counterpart: ALICE,
    task_context_ref: TASK_CONTEXT_REF,
    model: MODEL,
    cells: CONDITION_IDS,
    history_labels: HISTORY_LABEL,
    scenarios: SCENARIOS,
    replicates: REPLICATES,
    gates: GATES,
    frozen_outcomes: ["host_valid", "schema_valid", "factual_authority_pass", "counterpart_context_cited", "correct_counterpart_context_cited", "generic_only", "clarification_requested", "unsupported_context_claim", "assumes_shared_context", "continuation_success", "forbidden_relationship_inference"],
    call_budget: CALL_BUDGET,
    pilot_call_budget: PILOT_CALL_BUDGET,
    replication_call_budget: REPLICATION_CALL_BUDGET,
    scheduled_scenes: scheduledScenes().length,
    scheduled_calls_maximum: scheduledCallMaximum(),
    seed_contamination_gate: {
      required_fields: ["seed_contains_governed_relationship_state", "seeded_bundles_with_writer_authority", "unreadable_seed_shapes"],
      required_values: { seed_contains_governed_relationship_state: false, seeded_bundles_with_writer_authority: 0, unreadable_seed_shapes: 0 },
      per_cell: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, {
        seed_contains_governed_relationship_state: (bundle as HistoryBundle).seed_contamination.seed_contains_governed_relationship_state,
        seeded_bundles_with_writer_authority: (bundle as HistoryBundle).seed_contamination.seeded_bundles_with_writer_authority,
        unreadable_seed_shapes: (bundle as HistoryBundle).seed_contamination.unreadable_seed_shapes
      }])),
      all_clean: report.checks.all_seed_gates_clean
    },
    familiarity_values: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).familiarity_value])),
    governed_authority_records: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).governed_authority_records.length])),
    corpus_digest: report.cells[0]?.corpus_digest ?? null,
    corpus_identical: report.checks.corpus_identical,
    source_equality_b_vs_d: report.source_equality,
    b_retrieval_selected_refs: report.b_retrieval_selected_refs,
    d_working_refs: report.d_working_refs,
    precheck_checks: report.checks,
    precheck_all_pass: report.checks_all_pass,
    precheck_failures: report.failures,
    provider,
    model_run_authorized: report.checks_all_pass && provider.reachable && provider.digest_matches
  };
  writeJson(join(directory, "manifest.json"), manifest);

  process.stdout.write([
    `Prepared ${EXPERIMENT_ID}.`,
    `Precheck: ${report.checks_all_pass ? `ALL ${Object.keys(report.checks).length} CHECKS PASS` : `FAILED (${report.failures.join(", ")})`}.`,
    `Provider: ${provider.reachable ? `${provider.model} digest_match=${String(provider.digest_matches)} server=${String(provider.server_version)}` : `UNREACHABLE (${String(provider.error)})`}.`,
    `Model run authorized: ${String(manifest.model_run_authorized)}.`,
    ""
  ].join("\n"));
  if (!manifest.model_run_authorized) process.exitCode = 3;
}

function summarize(verdict: ExecutionVerdict): string {
  return [
    `Phase: ${verdict.phase}. Phase verdict: ${verdict.phase_verdict}${verdict.scientific_verdict === null ? " (no scientific verdict in this phase)" : ""}.`,
    `Host-valid: ${verdict.host_valid_scenes}/${verdict.call_accounting.actual_scenes} = ${verdict.host_valid_rate.toFixed(3)} (gate ${GATES.host_valid_rate_min}: ${verdict.host_valid_gate_pass ? "PASS" : "FAIL"}).`,
    `Seed clean: ${String(verdict.seed_clean)}; corpus identical: ${String(verdict.corpus_identical)}; manipulation ok: ${String(verdict.manipulation_ok)}; semantic non-conflation: ${String(verdict.semantic_non_conflation_pass)}; language authority: ${String(verdict.language_authority_clean)}.`,
    `Calls: ${verdict.call_accounting.total_calls} (cognition ${verdict.call_accounting.cognition_calls} + language ${verdict.call_accounting.language_calls}) / max ${verdict.call_accounting.scheduled_calls_maximum}; planned ${verdict.call_accounting.planned_scenes} actual ${verdict.call_accounting.actual_scenes} dup ${verdict.call_accounting.duplicate_scenes} missing ${verdict.call_accounting.missing_scenes} extra ${verdict.call_accounting.extra_scenes}.`,
    `Contrasts: ${verdict.contrasts.map((entry) => `${entry.id} ${entry.directional}/${entry.comparable_pairs} (${entry.expected})`).join("; ")}.`,
    `Criteria: ${Object.entries(verdict.criteria).map(([name, ok]) => `${ok ? "PASS" : "FAIL"} ${name}`).join("; ")}.`,
    `Failure classes: ${JSON.stringify(verdict.failure_classes)}.`,
    `Detail: ${verdict.detail}`,
    ""
  ].join("\n");
}

async function execute(directory: string, outputDirectory: string, phase: ExecutionPhase): Promise<void> {
  mkdirSync(outputDirectory, { recursive: true });
  const bundles = JSON.parse(readFileSync(join(directory, "histories.json"), "utf8")) as Record<string, HistoryBundle>;
  const primaryVerdict = phase === "replication"
    ? readVerdict(join(directory, "primary", "verdict-primary.json"))
    : undefined;
  if (phase === "replication" && primaryVerdict === undefined) {
    process.stderr.write("replication requires the primary verdict (run `run` first)\n");
    process.exitCode = 4;
    return;
  }
  const verdict = await runScenes({ phase, bundles, evidenceDir: outputDirectory, primaryVerdict });
  writeFileSync(join(outputDirectory, "SUMMARY.md"), [
    `# ${EXPERIMENT_ID} — ${phase}`,
    "",
    "```",
    summarize(verdict),
    "```",
    "",
    `verdict_hash: ${hashJson(verdict)}`,
    ""
  ].join("\n"));
  process.stdout.write(summarize(verdict));
  process.stdout.write(`${verdict.phase_verdict}\n`);
}

const [command, directory, outputDirectory] = process.argv.slice(2);
if (command === "prepare" && directory !== undefined) await prepare(directory);
else if (command === "pilot" && directory !== undefined) {
  await execute(directory, outputDirectory ?? join(directory, "pilot"), "pilot");
} else if (command === "run" && directory !== undefined) {
  await execute(directory, outputDirectory ?? join(directory, "primary"), "primary");
} else if (command === "replicate" && directory !== undefined) {
  await execute(directory, outputDirectory ?? join(directory, "replication"), "replication");
} else {
  process.stderr.write("usage: cli.ts prepare <dir> | pilot <dir> [outdir] | run <dir> [outdir] | replicate <dir> [outdir]\n");
  process.exitCode = 2;
}
