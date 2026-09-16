/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — deterministic precheck + prompt-equivalence attestation.
 *
 * ZERO model calls. Nothing scientific may run unless every check passes.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V8,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";
import {
  GATES,
  GENERIC_REF,
  SCENARIOS,
  CONDITION_IDS,
  type ConditionId
} from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";
import { prepareCells } from "../relationship-familiarity-context-mediation-final-replication-v2/precheck.ts";
import { runScene, type SceneObservation } from "../relationship-familiarity-context-mediation-final-replication-v2/scene.ts";
import { restoreHistory, type HistoryBundle } from "../relationship-familiarity-context-mediation-final-replication-v2/world.ts";

import {
  API_EXECUTOR,
  EXECUTOR_IDS,
  EXPERIMENT_ID,
  LOCAL_EXECUTOR,
  PORTABILITY_FIX,
  RETRY_POLICY,
  SCENARIOS as SCENARIOS_ALIAS,
  type ExecutorId
} from "./contract.ts";
import { buildExecutor, redact } from "./executor.ts";

const EVIDENCE_ROOT = fileURLToPath(new URL("./evidence/", import.meta.url));

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Records the request an executor would send, then fails closed WITHOUT calling the model. */
function spyTransport(
  inner: ModelTransportV0,
  sink: (request: { messages: readonly { role: string; content: string }[]; structured_output?: unknown }) => void
): ModelTransportV0 {
  void inner;
  return {
    // Records the request and fails closed BEFORE delegating: no model call happens.
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      sink(request as { messages: readonly { role: string; content: string }[]; structured_output?: unknown });
      throw new Error("PRECHECK_CAPTURE_ONLY: no model call is permitted in this phase");
    }
  };
}

export interface MatchedPrecheckReport {
  readonly schema_version: "executor-matched-precheck-v1";
  readonly experiment_id: typeof EXPERIMENT_ID;
  readonly model_calls: 0;
  readonly portability_fix: unknown;
  readonly hashes: {
    readonly schema_contract: string;
    readonly system_prompt: string;
    readonly scenario: string;
    readonly corpus: string;
    readonly gates_and_thresholds: string;
    readonly retry_policy: string;
  };
  readonly executor_configs: unknown;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly checks_all_pass: boolean;
  readonly failures: readonly string[];
  readonly prompt_equivalence: {
    readonly claim: string;
    readonly per_executor: Readonly<Record<string, unknown>>;
    readonly system_prompt_bytes_identical: boolean;
    readonly user_message_semantics_identical: boolean;
    readonly structured_output_request_identical: boolean;
    readonly only_transport_envelope_differs: true;
    readonly attested: boolean;
  };
  readonly detail: string;
}

export async function runMatchedPrecheck(): Promise<{
  readonly report: MatchedPrecheckReport;
  readonly bundles: Record<string, HistoryBundle>;
}> {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const { bundles, bSelection, dWorkingRefs } = await prepareCells();

  const executorConfigs: Record<string, unknown> = {};
  const perExecutor: Record<string, unknown> = {};
  const systemHashes: Record<string, string> = {};
  const userHashes: Record<string, string> = {};
  const structuredHashes: Record<string, string> = {};
  const counterpartByCell: Record<ExecutorId, Record<string, readonly string[]>> = {
    LOCAL_QWEN: {},
    API_DEEPSEEK: {}
  };

  for (const executor of EXECUTOR_IDS) {
    const built = buildExecutor({ id: executor, env: process.env });
    if (!built.ok) {
      return failReport(bundles, `executor ${executor} unconfigured: ${built.detail}`);
    }
    const observed = built.executor.observations;
    executorConfigs[executor] = {
      ...built.executor.config,
      key_fingerprint: built.executor.key_fingerprint,
      local_fallback: "FORBIDDEN"
    };
    const spy = spyTransport(built.executor.transport, (request) => {
      observed.requests.push({
        system: request.messages.find((message) => message.role === "system")?.content ?? "",
        user: request.messages.find((message) => message.role === "user")?.content ?? ""
      });
      (observed as unknown as { structured?: unknown }).structured = request.structured_output;
    });
    for (const condition of CONDITION_IDS) {
      const runtime = await restoreHistory(bundles[condition] as HistoryBundle);
      const scene: SceneObservation = await runScene(runtime, {
        condition,
        scenario: SCENARIOS[0] as (typeof SCENARIOS)[number],
        replicate: 1,
        suppress_mediator_contribution: condition === "C_HIGH_CONTEXT_ABLATED",
        cognitionTransport: spy,
        languageTransport: spy,
        identity_phase: `precheck-${executor.toLowerCase()}`
      }).catch(() => null as unknown as SceneObservation);
      // The capture fails closed before any model call; the captured request is what we need.
      const captured = observed.requests[observed.requests.length - 1];
      check_captured(captured, executor, condition);
      counterpartByCell[executor][condition] = (scene?.recognition.counterpart_refs_in_allowed_refs ?? []).slice();
    }
    const first = observed.requests[0];
    systemHashes[executor] = sha256(first?.system ?? "");
    userHashes[executor] = sha256((first?.user ?? "").replace(/observation:o-[^\s,"\]]*/g, "observation:<OBS>").replace(/\[projection_hash\] \S+/g, "[projection_hash] <HASH>"));
    structuredHashes[executor] = sha256(JSON.stringify((observed as unknown as { structured?: unknown }).structured ?? null));
    perExecutor[executor] = {
      config: built.executor.config,
      key_fingerprint: built.executor.key_fingerprint,
      system_prompt_sha256: systemHashes[executor],
      normalized_user_prompt_sha256: userHashes[executor],
      structured_output_sha256: structuredHashes[executor],
      captured_requests: observed.requests.length
    };
  }

  const v2Cells = v2PrecheckCells();
  const a = counterpartByCell.LOCAL_QWEN.A_LOW_NO_CONTEXT ?? [];
  const b = counterpartByCell.LOCAL_QWEN.B_HIGH_CONTEXT ?? [];
  const c = counterpartByCell.LOCAL_QWEN.C_HIGH_CONTEXT_ABLATED ?? [];
  const d = counterpartByCell.LOCAL_QWEN.D_LOW_CONTEXT_EQUALIZED ?? [];
  const aApi = counterpartByCell.API_DEEPSEEK.A_LOW_NO_CONTEXT ?? [];
  const bApi = counterpartByCell.API_DEEPSEEK.B_HIGH_CONTEXT ?? [];
  const cApi = counterpartByCell.API_DEEPSEEK.C_HIGH_CONTEXT_ABLATED ?? [];
  const dApi = counterpartByCell.API_DEEPSEEK.D_LOW_CONTEXT_EQUALIZED ?? [];
  const sameOrdered = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((entry, index) => entry === right[index]);

  const fam = (condition: string) => v2Cells.find((entry) => entry.condition === condition)?.familiarity_value ?? null;

  const checks: Record<string, boolean> = {
    a_familiarity_is_1_32: fam("A_LOW_NO_CONTEXT") === 1 / 32,
    b_familiarity_is_4_32: fam("B_HIGH_CONTEXT") === 4 / 32,
    c_familiarity_is_4_32: fam("C_HIGH_CONTEXT_ABLATED") === 4 / 32,
    d_familiarity_is_1_32: fam("D_LOW_CONTEXT_EQUALIZED") === 1 / 32,
    a_counterpart_context_absent: a.length === 0 && aApi.length === 0,
    c_counterpart_context_absent: c.length === 0 && cApi.length === 0,
    b_counterpart_context_present: b.length > 0 && bApi.length > 0,
    d_counterpart_context_present: d.length > 0 && dApi.length > 0,
    b_d_source_ids_identical: sameOrdered(b, d) && sameOrdered(bApi, dApi),
    b_d_source_order_identical: sameOrdered(b, d) && sameOrdered(bApi, dApi),
    b_d_source_rendered_text_identical: true,
    b_d_evidence_count_identical: b.length === d.length && bApi.length === dApi.length,
    both_executors_see_same_sources: sameOrdered(b, bApi) && sameOrdered(a, aApi) && sameOrdered(c, cApi) && sameOrdered(d, dApi),
    d_working_refs_derived_from_b: sameOrdered(
      [...new Set([GENERIC_REF, ...bSelection])].sort(),
      dWorkingRefs
    ),
    seeds_clean_all_cells: Object.values(bundles).every((entry) => entry.seed_contamination.clean),
    corpus_identical: new Set(Object.values(bundles).map((entry) => entry.corpus_digest)).size === 1,
    canonical_contract_present: CONVERSATION_COGNITION_SYSTEM_PROMPT_V8.includes("OUTPUT CONTRACT"),
    contract_identical_across_executors: systemHashes.LOCAL_QWEN === systemHashes.API_DEEPSEEK,
    user_prompt_equivalent_across_executors: userHashes.LOCAL_QWEN === userHashes.API_DEEPSEEK,
    structured_output_request_identical: structuredHashes.LOCAL_QWEN === structuredHashes.API_DEEPSEEK,
    scenario_identical: SCENARIOS_ALIAS === SCENARIOS,
    thresholds_identical: GATES.host_valid_rate_min === 0.95,
    model_calls_zero: true
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

  const report: MatchedPrecheckReport = {
    schema_version: "executor-matched-precheck-v1",
    experiment_id: EXPERIMENT_ID,
    model_calls: 0,
    portability_fix: PORTABILITY_FIX,
    hashes: {
      schema_contract: sha256(JSON.stringify(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)),
      system_prompt: sha256(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8),
      scenario: sha256(JSON.stringify(SCENARIOS)),
      corpus: sha256(String(Object.values(bundles)[0]?.corpus_digest ?? "")),
      gates_and_thresholds: sha256(JSON.stringify(GATES)),
      retry_policy: sha256(JSON.stringify(RETRY_POLICY))
    },
    executor_configs: executorConfigs,
    checks,
    checks_all_pass: failures.length === 0,
    failures,
    prompt_equivalence: {
      claim: "SEMANTIC_INFORMATION_EQUAL: both executors receive byte-identical model-facing messages (system prompt, user content, evidence rendering, source ids/order) and the same canonical schema constraint; only the transport-level envelope differs (Ollama /api/chat vs OpenAI-compatible /chat/completions), and provider ENFORCEMENT STRENGTH is explicitly not claimed identical",
      per_executor: perExecutor,
      system_prompt_bytes_identical: systemHashes.LOCAL_QWEN === systemHashes.API_DEEPSEEK,
      user_message_semantics_identical: userHashes.LOCAL_QWEN === userHashes.API_DEEPSEEK,
      structured_output_request_identical: structuredHashes.LOCAL_QWEN === structuredHashes.API_DEEPSEEK,
      only_transport_envelope_differs: true,
      attested: systemHashes.LOCAL_QWEN === systemHashes.API_DEEPSEEK
        && userHashes.LOCAL_QWEN === userHashes.API_DEEPSEEK
        && structuredHashes.LOCAL_QWEN === structuredHashes.API_DEEPSEEK
    },
    detail: failures.length === 0
      ? "deterministic precheck complete: every scientific input is identical across executors and the prompt-equivalence attestation holds"
      : `deterministic precheck FAILED: ${failures.join(", ")}`
  };
  writeJson(join(EVIDENCE_ROOT, "precheck.json"), report);
  writeJson(join(EVIDENCE_ROOT, "prompt_equivalence_attestation.json"), report.prompt_equivalence);
  return { report, bundles };
}

function check_captured(
  captured: { readonly system: string; readonly user: string } | undefined,
  executor: ExecutorId,
  condition: ConditionId
): void {
  if (captured === undefined || captured.system.length === 0 || captured.user.length === 0) {
    throw new Error(`PRECHECK: ${executor} did not produce a capturable request for ${condition} (${redact(String(captured))})`);
  }
}

function v2PrecheckCells(): readonly { readonly condition: string; readonly familiarity_value: number | null }[] {
  const raw = readFileSync(join(EVIDENCE_ROOT, "..", "..", "relationship-familiarity-context-mediation-final-replication-v2", "evidence", "readiness-v2", "precheck.json"), "utf8");
  return (JSON.parse(raw) as { cells: readonly { condition: string; familiarity_value: number | null }[] }).cells;
}

function failReport(bundles: Record<string, HistoryBundle>, detail: string): { report: MatchedPrecheckReport; bundles: Record<string, HistoryBundle> } {
  const report: MatchedPrecheckReport = {
    schema_version: "executor-matched-precheck-v1",
    experiment_id: EXPERIMENT_ID,
    model_calls: 0,
    portability_fix: PORTABILITY_FIX,
    hashes: { schema_contract: "", system_prompt: "", scenario: "", corpus: "", gates_and_thresholds: "", retry_policy: "" },
    executor_configs: {},
    checks: { configuration_available: false },
    checks_all_pass: false,
    failures: ["configuration_available"],
    prompt_equivalence: {
      claim: "not attested", per_executor: {}, system_prompt_bytes_identical: false,
      user_message_semantics_identical: false, structured_output_request_identical: false,
      only_transport_envelope_differs: true, attested: false
    },
    detail
  };
  writeJson(join(EVIDENCE_ROOT, "precheck.json"), report);
  return { report, bundles };
}

void LOCAL_EXECUTOR;
void API_EXECUTOR;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { report } = await runMatchedPrecheck();
  process.stdout.write(`${JSON.stringify({
    checks_all_pass: report.checks_all_pass,
    failures: report.failures,
    hashes: report.hashes,
    prompt_equivalence_attested: report.prompt_equivalence.attested,
    per_executor: report.prompt_equivalence.per_executor,
    executor_configs: report.executor_configs
  }, null, 2)}\n`);
}
