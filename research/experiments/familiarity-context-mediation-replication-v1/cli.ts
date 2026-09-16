/**
 * FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1 — CLI.
 *
 *   node .../cli.ts prepare   <dir>            # 0 real model calls: deterministic precheck + manifest
 *   node .../cli.ts pilot     <dir> [outdir]   # HOST VALIDITY PILOT (no scientific verdict)
 *   node .../cli.ts run       <dir> [outdir]   # primary scientific execution
 *   node .../cli.ts replicate <dir> [outdir]   # independent replication (frozen code)
 *
 * `prepare` writes the frozen cell bundles ONLY if all twelve preregistered structural
 * checks pass; otherwise it exits non-zero and no model run is authorized.
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
  scheduledCallMaximum,
  scheduledScenes
} from "./contract.ts";
import { HISTORY_LABEL, runPrecheck } from "./precheck.ts";
import { runScenes, type ExecutionPhase, type ExecutionVerdict } from "./runner.ts";
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
    schema_version: "familiarity-context-mediation-manifest-v1",
    experiment_id: EXPERIMENT_ID,
    hypotheses: {
      H1: "higher governed interaction familiarity causes counterpart-specific retrieval to activate",
      H2: "that retrieval changes model-facing context availability",
      H3: "the changed context availability causes reproducible cognition/behavior differences",
      H4: "when context availability is equalized, the familiarity scalar itself produces no detectable independent behavioral effect",
      H5: "no trust/liking/safety/intimacy semantics emerge from familiarity"
    },
    subject: SUBJECT,
    counterpart: ALICE,
    model: MODEL,
    cells: CONDITION_IDS,
    history_labels: HISTORY_LABEL,
    scenarios: SCENARIOS,
    endpoint_classes: ["CITES_COUNTERPART_CONTEXT", "CITES_GENERIC_ONLY", "ASKS_FOR_FRAMING", "GENERATIVE_ACT", "STANCE", "UNCLASSIFIED"],
    replicates: REPLICATES,
    gates: GATES,
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
      all_clean: report.checks.all_seed_clean
    },
    familiarity_values: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).familiarity_value])),
    governed_authority_records: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).governed_authority_records.length])),
    corpus_digest: report.cells[0]?.corpus_digest ?? null,
    corpus_identical: report.checks.corpus_identical,
    b_retrieval_selected_refs: report.b_retrieval_selected_refs,
    d_working_refs: report.d_working_refs,
    precheck_all_pass: report.checks_all_pass,
    precheck_failures: report.failures,
    provider,
    model_run_authorized: report.checks_all_pass && provider.reachable && provider.digest_matches
  };
  writeJson(join(directory, "manifest.json"), manifest);

  process.stdout.write([
    `Prepared ${EXPERIMENT_ID}.`,
    `Precheck: ${report.checks_all_pass ? "ALL 12 CHECKS PASS" : `FAILED (${report.failures.join(", ")})`}.`,
    `Provider: ${provider.reachable ? `${provider.model} digest_match=${String(provider.digest_matches)} server=${String(provider.server_version)}` : `UNREACHABLE (${String(provider.error)})`}.`,
    `Model run authorized: ${String(manifest.model_run_authorized)}.`,
    ""
  ].join("\n"));
  if (!manifest.model_run_authorized) process.exitCode = 3;
}

function summarize(verdict: ExecutionVerdict): string {
  return [
    `Phase: ${verdict.phase}. Verdict: ${verdict.principal_verdict}${verdict.scientific_verdict_authorized ? "" : " (NO scientific verdict)"}.`,
    `Host-valid rate: ${verdict.host_valid_rate.toFixed(3)}; seed clean: ${String(verdict.seed_clean)}; corpus identical: ${String(verdict.corpus_identical)}; manipulation ok: ${String(verdict.manipulation_ok)}; semantic non-conflation: ${String(verdict.semantic_non_conflation_pass)}.`,
    `Calls: cognition ${verdict.call_accounting.cognition_calls} + language ${verdict.call_accounting.language_calls} = ${verdict.call_accounting.total_calls} / max ${verdict.call_accounting.scheduled_calls_maximum}; planned ${verdict.call_accounting.planned_scenes} actual ${verdict.call_accounting.actual_scenes} dup ${verdict.call_accounting.duplicate_scenes} missing ${verdict.call_accounting.missing_scenes} extra ${verdict.call_accounting.extra_scenes}.`,
    `Criteria: ${Object.entries(verdict.criteria).map(([name, ok]) => `${ok ? "PASS" : "FAIL"} ${name}`).join("; ")}.`,
    `Contrasts: ${verdict.contrasts.map((entry) => `${entry.id}[${entry.scenario_id}] ${entry.left}↔${entry.right} ${entry.directional}/${entry.comparable_pairs}`).join("; ")}.`,
    `Failure classes: ${JSON.stringify(verdict.failure_classes)}.`,
    `Detail: ${verdict.detail}`,
    ""
  ].join("\n");
}

async function execute(directory: string, outputDirectory: string, phase: ExecutionPhase): Promise<void> {
  mkdirSync(outputDirectory, { recursive: true });
  const bundles = JSON.parse(readFileSync(join(directory, "histories.json"), "utf8")) as Record<string, HistoryBundle>;
  const verdict = await runScenes({ phase, bundles, evidenceDir: outputDirectory });
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
  process.stdout.write(`${verdict.principal_verdict}\n`);
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
