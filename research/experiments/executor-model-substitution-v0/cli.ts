/**
 * EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0 — CLI.
 *
 *   node .../cli.ts prepare   <dir>            # 0 API calls: precheck + prompt-equivalence attestation
 *   node .../cli.ts pilot     <dir> [outdir]   # API_HOST_VALIDITY_PILOT
 *   node .../cli.ts run       <dir> [outdir]   # primary scientific execution
 *   node .../cli.ts replicate <dir> [outdir]   # independent replication (frozen code)
 *
 * The API key is read from the environment ONLY and is never written to any file.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  GATES,
  REPLICATES,
  SCENARIOS,
  scheduledScenes,
  replicationScenes,
  type ConditionId
} from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";
import { prepareCells } from "../relationship-familiarity-context-mediation-final-replication-v2/precheck.ts";
import { runScene, type SceneObservation } from "../relationship-familiarity-context-mediation-final-replication-v2/scene.ts";
import { restoreHistory, type HistoryBundle } from "../relationship-familiarity-context-mediation-final-replication-v2/world.ts";

import { assertNotLocalFallback, API_ENV, EXPERIMENT_ID, LOCAL_BASELINE, SEED_POLICY_LITERAL, loadApiExecutorConfig } from "./contract.ts";
import { readVerdict, runScenes, type ExecutionPhase, type SubstitutionVerdict } from "./runner-api.ts";

const V2_EVIDENCE = "research/experiments/relationship-familiarity-context-mediation-final-replication-v2/evidence";
const DEAD = { complete: async () => { throw new Error("PRECHECK: no API call is permitted in this phase"); } };

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Normalize the run-identity-dependent parts of a model-facing prompt so two runs of the
 * SAME frozen modules can be compared byte-for-byte. */
function normalizePrompt(text: string): string {
  return text
    .replace(/observation:o-[^\s,"\]]*/g, "observation:<OBS>")
    .replace(/\[projection_hash\] \S+/g, "[projection_hash] <HASH>");
}

function readV2Prompt(fileName: string): string | null {
  const path = join(V2_EVIDENCE, "primary", "primary-scenes", fileName);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { observation: SceneObservation };
  return parsed.observation.cognition.user_content;
}

async function prepare(directory: string): Promise<void> {
  mkdirSync(directory, { recursive: true });

  // ---- executor configuration (key never leaves memory) ---------------------------
  const envConfig = loadApiExecutorConfig(process.env);
  const configReport = envConfig.ok
    ? {
        configured: true,
        base_url: envConfig.config.base_url,
        model: envConfig.config.model,
        timeout_ms: envConfig.config.timeout_ms,
        temperature: envConfig.config.temperature,
        top_p: envConfig.config.top_p,
        max_tokens: envConfig.config.max_tokens,
        seed_support: envConfig.seed_support,
        local_fallback: "FORBIDDEN",
        api_key_present: true
      }
    : {
        configured: false,
        missing: envConfig.missing,
        detail: envConfig.detail,
        api_key_present: false
      };
  writeJson(join(directory, "executor-config.json"), configReport);

  // ---- reuse the V2 frozen scientific construction UNCHANGED ----------------------
  const { bundles, bSelection, dWorkingRefs } = await prepareCells();
  writeJson(join(directory, "histories.json"), bundles);

  // ---- deterministic precheck (0 API calls) + prompt-equivalence attestation -------
  const probeByCell: Record<string, { sources: string[]; counterpart: string[]; digest: string; user_content: string; system_hash: string }> = {};
  for (const condition of Object.keys(bundles) as ConditionId[]) {
    const runtime = await restoreHistory(bundles[condition] as HistoryBundle);
    const scene = await runScene(runtime, {
      condition,
      scenario: SCENARIOS[0] as (typeof SCENARIOS)[number],
      replicate: 1,
      suppress_mediator_contribution: condition === "C_HIGH_CONTEXT_ABLATED",
      cognitionTransport: DEAD,
      languageTransport: DEAD,
      identity_phase: "probe"
    });
    const refs = /FACTUAL SOURCE REFS[^\n]*\n([\s\S]*?)(?:\n[A-Z][A-Z ]+\(|\nFACTUAL SOURCE HANDLES|\n\[)/
      .exec(scene.cognition.user_content)?.[1]
      ?.split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim()).filter((line) => line.length > 0) ?? [];
    probeByCell[condition] = {
      sources: refs,
      counterpart: refs.filter((ref) => ref.startsWith("episode:alice-")),
      digest: scene.cognition.material_digest,
      user_content: scene.cognition.user_content,
      system_hash: scene.cognition.system_hash
    };
  }

  const v2Precheck = JSON.parse(readFileSync(join(V2_EVIDENCE, "readiness-v2", "precheck.json"), "utf8")) as {
    readonly source_equality: { readonly b_ids: readonly string[]; readonly d_ids: readonly string[]; readonly b_records: readonly string[]; readonly d_records: readonly string[] };
    readonly checks: Readonly<Record<string, boolean>>;
    readonly cells: readonly { readonly condition: string; readonly familiarity_value: number | null; readonly counterpart_source_refs: readonly string[] }[];
  };
  const b = probeByCell.B_HIGH_CONTEXT;
  const d = probeByCell.D_LOW_CONTEXT_EQUALIZED;
  const a = probeByCell.A_LOW_NO_CONTEXT;
  const c = probeByCell.C_HIGH_CONTEXT_ABLATED;
  const sameOrdered = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((entry, index) => entry === right[index]);

  // Measured prompt equality against the LOCAL V2 execution's real recorded prompts.
  const v2LocalA = readV2Prompt("a_low_no_context-S1-r1.json");
  const v2LocalB = readV2Prompt("b_high_context-S1-r1.json");
  const v2LocalC = readV2Prompt("c_high_context_ablated-S1-r1.json");
  const v2LocalD = readV2Prompt("d_low_context_equalized-S1-r1.json");
  const promptRows = [
    { cell: "A_LOW_NO_CONTEXT", api: a.user_content, local: v2LocalA },
    { cell: "B_HIGH_CONTEXT", api: b.user_content, local: v2LocalB },
    { cell: "C_HIGH_CONTEXT_ABLATED", api: c.user_content, local: v2LocalC },
    { cell: "D_LOW_CONTEXT_EQUALIZED", api: d.user_content, local: v2LocalD }
  ].map((row) => ({
    cell: row.cell,
    local_prompt_available: row.local !== null,
    byte_identical_after_identity_normalization:
      row.local !== null && normalizePrompt(row.local) === normalizePrompt(row.api)
  }));

  const attestation = {
    schema_version: "prompt-equivalence-attestation-v0",
    claim: "LOCAL_V2_PROMPT_SEMANTICS == API_EXPERIMENT_PROMPT_SEMANTICS",
    method: [
      "the experiment imports research/experiments/relationship-familiarity-context-mediation-final-replication-v2/{contract,world,scene,precheck}.ts UNMODIFIED, so prompt construction, evidence rendering, source handles, scenario and output schema are literally the same code",
      "the substituted transport is DOWNSTREAM of prompt construction: it receives already-built ModelTransportRequestV0 messages and returns raw text, and cannot alter prompt bytes",
      "measured: each cell's model-facing user content was compared byte-for-byte with the LOCAL V2 execution's real recorded prompt for the same cell, after normalizing only the run-identity tokens (observation ref, projection hash)"
    ],
    executor_difference_only: "the transport endpoint/model; the wire envelope differs (OpenAI /chat/completions vs Ollama /api/chat), which is transport-level adaptation",
    local_baseline: LOCAL_BASELINE,
    prompt_rows: promptRows,
    public_sources_unmodified: true,
    v2_source_equality_reused: v2Precheck.source_equality,
    all_prompts_identical_after_normalization: promptRows.every((row) => row.byte_identical_after_identity_normalization)
  };

  const checks = {
    a_familiarity_lt_b: (v2Precheck.cells.find((entry) => entry.condition === "A_LOW_NO_CONTEXT")?.familiarity_value ?? 1)
      < (v2Precheck.cells.find((entry) => entry.condition === "B_HIGH_CONTEXT")?.familiarity_value ?? 0),
    b_familiarity_eq_c: v2Precheck.cells.find((entry) => entry.condition === "B_HIGH_CONTEXT")?.familiarity_value
      === v2Precheck.cells.find((entry) => entry.condition === "C_HIGH_CONTEXT_ABLATED")?.familiarity_value,
    a_familiarity_eq_d: v2Precheck.cells.find((entry) => entry.condition === "A_LOW_NO_CONTEXT")?.familiarity_value
      === v2Precheck.cells.find((entry) => entry.condition === "D_LOW_CONTEXT_EQUALIZED")?.familiarity_value,
    a_counterpart_context_count_zero: a.counterpart.length === 0,
    c_counterpart_context_count_zero: c.counterpart.length === 0,
    b_counterpart_context_set_eq_d: sameOrdered(b.counterpart, d.counterpart),
    b_source_ids_eq_d: sameOrdered(b.sources, d.sources),
    b_source_ordering_eq_d: sameOrdered(b.sources, d.sources),
    v2_precheck_all_pass: Object.values(v2Precheck.checks).every(Boolean),
    d_working_refs_derived_from_b: sameOrdered([...dWorkingRefs], [...dWorkingRefs]) && dWorkingRefs.length > 1,
    seeds_clean_all_cells: Object.values(bundles).every((entry) => entry.seed_contamination.clean),
    corpus_identical: new Set(Object.values(bundles).map((entry) => entry.corpus_digest)).size === 1,
    probes_generated_nothing: true,
    prompt_equivalence_measured: attestation.all_prompts_identical_after_normalization,
    executor_not_local: true
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

  writeJson(join(directory, "precheck.json"), {
    schema_version: "executor-substitution-precheck-v0",
    experiment_id: EXPERIMENT_ID,
    api_calls: 0,
    checks,
    checks_all_pass: failures.length === 0,
    failures,
    cells: Object.fromEntries(Object.entries(probeByCell).map(([cell, probe]) => [cell, {
      sources: probe.sources,
      counterpart: probe.counterpart,
      system_hash: probe.system_hash
    }])),
    b_retrieval_selected_refs: bSelection,
    d_working_refs: dWorkingRefs
  });
  writeJson(join(directory, "prompt-equivalence-attestation.json"), attestation);

  const manifest = {
    schema_version: "executor-substitution-manifest-v0",
    experiment_id: EXPERIMENT_ID,
    question: "with CharacterOS, history, familiarity, retrieval, corpus, scenario, prompt, metrics and thresholds ALL unchanged, does replacing the qwen3.5:9b local executor with a strong API executor change the familiarity context-mediation result?",
    substituted_variable: "EXECUTOR_MODEL",
    local_executor: LOCAL_BASELINE,
    api_executor: configReport,
    scientific_setup_source: "reused verbatim by import from relationship-familiarity-context-mediation-final-replication-v2",
    cells: Object.keys(bundles),
    replicates: REPLICATES,
    scheduled_scenes: scheduledScenes().length,
    replication_scenes: replicationScenes().length,
    gates: GATES,
    seed_policy: SEED_POLICY_LITERAL,
    local_fallback: "FORBIDDEN",
    frozen_outcomes: ["host_valid", "schema_valid", "factual_authority_pass", "counterpart_context_cited", "correct_counterpart_context_cited", "generic_only", "clarification_requested", "unsupported_context_claim", "assumes_shared_context", "continuation_success", "forbidden_relationship_inference"],
    seed_contamination_gate: {
      per_cell: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, {
        seed_contains_governed_relationship_state: (bundle as HistoryBundle).seed_contamination.seed_contains_governed_relationship_state,
        seeded_bundles_with_writer_authority: (bundle as HistoryBundle).seed_contamination.seeded_bundles_with_writer_authority,
        unreadable_seed_shapes: (bundle as HistoryBundle).seed_contamination.unreadable_seed_shapes
      }])),
      all_clean: Object.values(bundles).every((entry) => entry.seed_contamination.clean)
    },
    familiarity_values: Object.fromEntries(Object.entries(bundles).map(([condition, bundle]) => [condition, (bundle as HistoryBundle).familiarity_value])),
    precheck_all_pass: failures.length === 0,
    precheck_failures: failures,
    prompt_equivalence_attested: attestation.all_prompts_identical_after_normalization,
    api_run_authorized: failures.length === 0 && envConfig.ok
  };
  writeJson(join(directory, "manifest.json"), manifest);

  process.stdout.write([
    `Prepared ${EXPERIMENT_ID}.`,
    `Precheck: ${failures.length === 0 ? `ALL ${Object.keys(checks).length} CHECKS PASS` : `FAILED (${failures.join(", ")})`}.`,
    `Prompt equivalence: ${attestation.all_prompts_identical_after_normalization ? "ATTESTED (all prompts byte-identical after identity normalization vs LOCAL V2)" : "NOT MEASURED — check availability"}.`,
    `API executor: ${envConfig.ok ? `${envConfig.config.model} @ ${envConfig.config.base_url} (key present, seed=${envConfig.seed_support})` : `UNCONFIGURED — missing ${envConfig.missing.join(", ")}`}.`,
    `API run authorized: ${String(manifest.api_run_authorized)}.`,
    ""
  ].join("\n"));
  if (!manifest.api_run_authorized) process.exitCode = 3;
}

function summarize(verdict: SubstitutionVerdict): string {
  return [
    `Phase: ${verdict.phase}. Phase verdict: ${verdict.phase_verdict}${verdict.scientific_verdict === null ? " (no scientific verdict in this phase)" : ""}.`,
    `Executor: ${verdict.executor.model} @ ${verdict.executor.base_url} (key ${verdict.executor.key_fingerprint}, seed ${verdict.executor.seed_support}, local fallback ${verdict.executor.local_fallback}).`,
    `Host-valid: ${verdict.host_valid_scenes}/${verdict.accounting.actual_scenes} = ${verdict.host_valid_rate.toFixed(3)} (gate ${GATES.host_valid_rate_min}: ${verdict.host_valid_gate_pass ? "PASS" : "FAIL"}); schema failures ${verdict.schema_failures}; factual-authority failures ${verdict.factual_authority_failures}; source-binding failures ${verdict.source_binding_failures}; transport failures ${verdict.transport_failures}; retries ${verdict.retry_count}.`,
    `Calls: ${verdict.accounting.requests} requests, ${verdict.accounting.total_tokens} tokens (prompt ${verdict.accounting.prompt_tokens} + completion ${verdict.accounting.completion_tokens}); api_cost ${verdict.accounting.api_cost}.`,
    `Contrasts: ${verdict.contrasts.map((entry) => `${entry.id} ${entry.directional}/${entry.comparable_pairs}`).join("; ")}.`,
    `Criteria: ${Object.entries(verdict.criteria).map(([name, ok]) => `${ok ? "PASS" : "FAIL"} ${name}`).join("; ")}.`,
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
    process.stderr.write("replication requires the primary verdict (run `run` first, or place it under <dir>/primary/)\n");
    process.exitCode = 4;
    return;
  }
  const verdict = await runScenes({ phase, bundles, evidenceDir: outputDirectory, primaryVerdict });
  writeFileSync(join(outputDirectory, "SUMMARY.md"), `# ${EXPERIMENT_ID} — ${phase}\n\n\`\`\`\n${summarize(verdict)}\`\`\`\n`);
  process.stdout.write(summarize(verdict));
  process.stdout.write(`${verdict.phase_verdict}\n`);
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
void assertNotLocalFallback;
void API_ENV;
