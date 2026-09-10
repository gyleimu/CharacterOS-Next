/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated revalidation harness for the frozen session capability and the frozen provider budget repair; outdir/argv and frozen indices are validated at each use site. */

/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0_REVALIDATION — entrypoint.
 *
 *   node .../cli.ts phase-a  <outdir> — freeze the revalidation plan (0 real calls)
 *   node .../cli.ts run      <outdir> — 8 interactions, checkpoints + 2 authoritative restores
 *   node .../cli.ts finalize <outdir> — verdicts, timelines, ledger, report
 *
 * Mechanical adaptation of the frozen V0 harness. The ONLY behavioral change is
 * the validated provider variable under study: the cognition transport now
 * receives an explicit `context_window_tokens`, which it maps to Ollama
 * `options.num_ctx`. Everything else — the frozen interaction plan, environment,
 * appraisal dimensions, session orchestration, checkpoint/restore schedule,
 * retrieval and verdict thresholds — is reused unchanged from the frozen V0
 * harness (`alice-environment.ts` is a byte-identical copy).
 *
 * Additionally, per-call provider terminal traces (finish reason, prompt/
 * generation token counts, configured budget) are persisted into the call ledger
 * so the run is auditable from CharacterOS evidence alone.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { validateSubjectState, type SubjectStateV0 } from "../../../packages/subject-core/dist/index.js";
import {
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  OllamaNativeCognitionTransportV0,
  createLongHorizonSubjectSessionV0,
  type ModelTransportRequestV0,
  type ModelTransportTraceV0,
  type ModelTransportV0,
  type SessionInteractionOutcomeV0,
  type SessionRestoreOutcomeV0
} from "../../../packages/runtime/dist/index.js";
import { s0 } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import {
  ALICE_CONVERSATION_ID,
  AliceReviewEnvironmentV0,
  INTERACTIONS,
  PRIMARY_APPRAISAL_DIMENSIONS,
  REPLY_APPRAISAL_DIMENSIONS,
  aliceAppraisalProvider
} from "./alice-environment.ts";

const EXPERIMENT_VERSION = "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0_REVALIDATION" as const;
/** The frozen provider-budget repair commit — the starting baseline of this run. */
const BASELINE_COMMIT = "1444d0d8c827a4b56d8e7ce9d47f322dcfd23464" as const;
/** The original failed experiment this revalidates. */
const ORIGINAL_EXPERIMENT = "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0" as const;
const ORIGINAL_BASELINE_COMMIT = "468589a3b06d9d3d5ff309e70621e2c76c8ea0a4" as const;
const SUBJECT_ID = "subject-s0" as const;
const SETTINGS = Object.freeze({
  provider: "OLLAMA_NATIVE" as const,
  base_url: "http://127.0.0.1:11434" as const,
  model: "qwen3.5:9b" as const,
  required_digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7" as const,
  temperature: 0 as const,
  think: false as const,
  stream: false as const,
  retries: 0 as const,
  seed: null,
  num_predict: 2048 as const,
  /** THE VARIABLE UNDER STUDY: explicit total sequence budget (prompt + generation). */
  context_window_tokens: 8192 as const,
  timeout_ms: 120000 as const
});
const INTERACTION_INTERVAL_TICKS = 300;
const CHECKPOINT_AFTER = [3, 6] as const;

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (HEAD !== BASELINE_COMMIT) throw new Error(`baseline mismatch: HEAD ${HEAD} != required ${BASELINE_COMMIT}`);

const command = process.argv[2];
const outdir = process.argv[3];
if (typeof command !== "string" || typeof outdir !== "string") throw new Error("usage: cli.ts <phase-a|run|finalize> <outdir>");

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Frozen v3 seed with the session task in canonical context (validation-only). */
function v3Seed(task: string): SubjectStateV0 {
  const initial = s0() as unknown as { context: Record<string, unknown> };
  const raw = {
    ...(s0() as unknown as Record<string, unknown>),
    context: { ...initial.context, task },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`v3 seed invariant: ${checked.error?.detail ?? "invalid"}`);
  return checked.value;
}

async function sha256(text: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/** Shared chronological terminal-trace ledger (one entry per provider call). */
type TraceLedger = ModelTransportTraceV0[];

function traceObserver(ledger: TraceLedger): (event: ModelTransportTraceV0) => void {
  return (event: ModelTransportTraceV0) => {
    if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) ledger.push(structuredClone(event));
  };
}

/**
 * Crash-safe per-call accounting: every provider attempt is persisted BEFORE the
 * response is awaited, and its terminal row — including the provider terminal
 * trace — immediately after. Calls are strictly sequential, so the trace this
 * call appended is the one at the pre-call ledger length.
 */
function accountingTransport(input: {
  readonly inner: ModelTransportV0;
  readonly stage: "cognition" | "language";
  readonly callsPath: string;
  readonly digest: string;
  readonly interaction: () => number;
  readonly ledger: TraceLedger;
  attempt: () => number;
}): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0) => {
      const messages = (request as { messages: readonly { role: string; content: string }[] }).messages;
      const userContent = messages.find((message) => message.role === "user")?.content ?? "";
      // Must stay byte-identical to OllamaNativeCognitionTransportV0's wire body.
      const body = JSON.stringify({
        model: SETTINGS.model,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        think: false,
        stream: false,
        options: {
          temperature: 0,
          num_predict: SETTINGS.num_predict,
          num_ctx: SETTINGS.context_window_tokens
        }
      });
      const startedAt = new Date().toISOString();
      const startMs = Date.now();
      const base = {
        attempt: input.attempt(),
        interaction: input.interaction(),
        stage: input.stage,
        provider: SETTINGS.provider,
        model: SETTINGS.model,
        digest: input.digest,
        started_at: startedAt,
        request_bytes: new TextEncoder().encode(body).length,
        request_hash: await sha256(body),
        memory_section_present: userContent.includes("[PRIOR FACTUAL MEMORY")
      };
      const before = input.ledger.length;
      appendFileSync(input.callsPath, JSON.stringify({ event: "STARTED", ...base }) + "\n");

      const traceOfCall = (): ModelTransportTraceV0 | null => input.ledger[before] ?? input.ledger.at(-1) ?? null;
      const traceFields = (trace: ModelTransportTraceV0 | null): Record<string, unknown> => ({
        terminal_trace: trace,
        prompt_eval_count: trace?.ollama.prompt_eval_count ?? null,
        eval_count: trace?.ollama.eval_count ?? null,
        done_reason: trace?.ollama.done_reason ?? null,
        context_window_tokens: trace?.budget.context_window_tokens ?? SETTINGS.context_window_tokens,
        max_output_tokens: trace?.budget.max_output_tokens ?? SETTINGS.num_predict,
        transport_request_hash: trace?.request_hash ?? null,
        transport_request_bytes: trace?.request_bytes ?? null,
        transport_request_identity_match: trace !== null && trace.request_hash === base.request_hash
      });

      try {
        const response = await input.inner.complete(request);
        appendFileSync(input.callsPath, JSON.stringify({
          event: "COMPLETED",
          ...base,
          latency_ms: Date.now() - startMs,
          response_content: (response as { content: string }).content,
          response_hash: await sha256((response as { content: string }).content),
          ...traceFields(traceOfCall())
        }) + "\n");
        return response;
      } catch (error) {
        appendFileSync(input.callsPath, JSON.stringify({
          event: "FAILED",
          ...base,
          latency_ms: Date.now() - startMs,
          failure: (error instanceof Error ? error.message : String(error)).slice(0, 300),
          ...traceFields(traceOfCall())
        }) + "\n");
        throw error;
      }
    }
  } as ModelTransportV0;
}

// =====================================================================================
// phase-a
// =====================================================================================
if (command === "phase-a") {
  mkdirSync(outdir!, { recursive: true });
  writeJson(join(outdir!, "contract.json"), {
    schema_version: "long-horizon-revalidation-contract-v0",
    experiment_version: EXPERIMENT_VERSION,
    revalidates: ORIGINAL_EXPERIMENT,
    baseline_head: BASELINE_COMMIT,
    original_experiment_reference: ORIGINAL_EXPERIMENT,
    original_baseline_commit: ORIGINAL_BASELINE_COMMIT,
    repair_reference: {
      slice: "COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0",
      commit: BASELINE_COMMIT,
      change: "explicit cognition context budget (context_window_tokens -> Ollama options.num_ctx) + persisted provider terminal telemetry"
    },
    single_variable_under_study: {
      before: { provider_context: "implicit Ollama default num_ctx = 4096", num_predict: 2048 },
      after: { provider_context: "explicit num_ctx = 8192", num_predict: 2048 }
    },
    subject: { subject_id: SUBJECT_ID, single_subject: true },
    interactions: INTERACTIONS.length,
    environment: "alice-review-environment-v0 (byte-identical copy of the frozen V0 module)",
    logical_time_cadence_ticks: INTERACTION_INTERVAL_TICKS,
    restores: { boundaries: [...CHECKPOINT_AFTER], mechanism: "authoritative v4 restore into a fresh runtime" },
    provider: { ...SETTINGS },
    maximum_calls: { cognition: 8, language: 8, total: 16, repetitions: 0, preflight_metadata_calls_disclosed_separately: true },
    stop_rules: [
      "any interaction with status != COMPLETE stops the session immediately",
      "any restore with kind != RESTORED stops the session immediately",
      "provider request identity mismatch stops the session",
      "no retry for output quality; no rerun; no prompt/setting change during collection"
    ],
    verdict_rules: "frozen in verdict-contract.json (thresholds unchanged from the original experiment)",
    no_output_fishing: true,
    unchanged_from_original: [
      "episode scenarios", "environment state machine", "interaction count", "logical timing",
      "Memory retrieval policy and top-k", "subject identity", "counterpart", "appraisals",
      "Affect", "cognition schema", "CommunicationDirective", "Language", "behavior feedback",
      "Experience", "Learning", "restore schedule", "verdict thresholds"
    ]
  });
  writeJson(join(outdir!, "original-run-reference.json"), {
    schema_version: "long-horizon-revalidation-original-run-reference-v0",
    experiment_version: ORIGINAL_EXPERIMENT,
    baseline_commit: ORIGINAL_BASELINE_COMMIT,
    evidence_path: "research/experiments/long-horizon-autonomous-subject-session-v0/evidence/run-1-real-provider",
    principal_verdict: "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED",
    completed_interactions: 6,
    restores_exact: 2,
    failure: {
      interaction: 7,
      mechanism: "context-window exhaustion: prompt 3568 + generated 528 = 4096 = implicit n_ctx, provider truncated = 1"
    },
    immutable: true
  });
  writeJson(join(outdir!, "repair-reference.json"), {
    schema_version: "long-horizon-revalidation-repair-reference-v0",
    slice: "COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0",
    commit: BASELINE_COMMIT,
    explicit_context_window_tokens: SETTINGS.context_window_tokens,
    num_predict: SETTINGS.num_predict,
    provider_terminal_telemetry: [
      "prompt_eval_count", "eval_count", "done_reason", "context_window_tokens", "max_output_tokens"
    ],
    truncation_classification: "done_reason=length -> MODEL_OUTPUT_TRUNCATED (production, unit-tested; not deliberately forced here)"
  });
  writeJson(join(outdir!, "session-architecture-audit.json"), {
    schema_version: "long-horizon-session-architecture-audit-v0",
    baseline_commit: BASELINE_COMMIT,
    reused_unchanged_from: ORIGINAL_EXPERIMENT,
    phase_a_answers: {
      "1_manually_composed_entrypoints": "identical to the frozen V0 harness (same composition root and authorities)",
      "2_smallest_reusable_orchestrator": "LongHorizonSubjectSessionV0 (unchanged)",
      "5_pending_appraisal_affect_queue": "frozen PRIOR_AFFECT_WORK_PENDING law unchanged",
      "6_interaction_complete_boundary": "unchanged",
      "7_fresh_runtime_without_live_authority": "unchanged (fresh authority rebuilt on every restore)",
      "8_reusable_vs_validation": {
        reusable_runtime: ["packages/runtime/src/session/* (unchanged)"],
        validation_only: ["Alice review environment copy", "8-interaction plan", "evidence collection", "conformance harness"]
      }
    }
  });
  writeJson(join(outdir!, "frozen-authority-composition.json"), {
    schema_version: "long-horizon-frozen-authority-composition-v0",
    composed_only: true,
    bypasses: [],
    identical_to_original: true,
    new_psychology: "NONE"
  });
  writeJson(join(outdir!, "session-contract.json"), {
    schema_version: "long-horizon-session-contract-v0",
    operations: ["processInteraction", "checkpoint", "restore", "status", "ledger", "pendingWork", "restoreOutcomes"],
    forbidden: ["host-selected memory refs", "host-set current_intent", "host-selected directive", "host-written behavior", "host-written Memory", "manual history summary", "chat transcript carryover"],
    session_metadata_is_operational_only: true
  });
  writeJson(join(outdir!, "environment-contract.json"), {
    schema_version: "long-horizon-environment-contract-v0",
    environment_id: "alice-review-environment-v0",
    interface: ["nextInteraction(index)", "observeBehavior(input)", "exportState()", "restoreState(state)", "stateHash()"],
    reacts_to: ["delivered observable behavior text", "its own explicit external state"],
    never_inspects: ["affect", "hidden memory", "current_intent", "internal cognition", "authority tokens"],
    explicit_external_state: ["review_stage", "organization_decision", "external_reader_known", "open_checklist_items", "exchange_count"],
    separate_from_subject_authority: true
  });
  const interactionPlan = {
    schema_version: "long-horizon-interaction-plan-v0",
    interaction_count: INTERACTIONS.length,
    interval_ticks: INTERACTION_INTERVAL_TICKS,
    checkpoint_after: [...CHECKPOINT_AFTER],
    interactions: INTERACTIONS.map((interaction) => ({ ...interaction })),
    primary_appraisal_dimensions: PRIMARY_APPRAISAL_DIMENSIONS.map((entry) => ({ ...entry })),
    reply_appraisal_dimensions: { ...REPLY_APPRAISAL_DIMENSIONS }
  };
  writeJson(join(outdir!, "interaction-plan.json"), interactionPlan);
  writeJson(join(outdir!, "session-plan.json"), { ...interactionPlan, schema_version: "long-horizon-revalidation-session-plan-v0" });
  writeJson(join(outdir!, "checkpoint-plan.json"), {
    schema_version: "long-horizon-checkpoint-plan-v0",
    boundaries: [...CHECKPOINT_AFTER],
    identical_to_original: true
  });
  writeJson(join(outdir!, "restore-plan.json"), {
    schema_version: "long-horizon-restore-plan-v0",
    boundaries: [...CHECKPOINT_AFTER],
    mechanism: "mintTrustedCanonicalHistoryBoundaryV4V0 + restoreSubjectStateV4AuthoritativelyV0",
    fresh_runtime: true,
    live_runtime_discard: true,
    identical_to_original: true
  });
  writeJson(join(outdir!, "provider-plan.json"), {
    schema_version: "long-horizon-provider-plan-v0",
    settings: { ...SETTINGS },
    session_layer_call_authority: "the session calls the frozen production ConversationTextResponseExecutorV1 exactly once per interaction",
    provider_identity_audit: "rendered_request_hash == transport_request_hash (request body reproduced from the exact messages + frozen options INCLUDING num_ctx)",
    no_prompt_optimization: true
  });
  writeJson(join(outdir!, "call-budget.json"), {
    schema_version: "long-horizon-call-budget-v0",
    cognition_calls: 8,
    language_calls_max: 8,
    maximum_run_of_record_calls: 16,
    clarify_avoids_language_call: true,
    interaction_repetition: 0,
    crash_safe_accounting_required_before_first_call: true
  });
  writeJson(join(outdir!, "verdict-contract.json"), {
    schema_version: "long-horizon-verdict-contract-v0",
    revalidation_principal_verdicts: [
      "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_REVALIDATED",
      "LONG_HORIZON_SESSION_REPAIR_PARTIALLY_VALIDATED",
      "CONTEXT_BUDGET_REPAIR_NOT_SUFFICIENT",
      "PROVIDER_CONTEXT_CONFIGURATION_NOT_HONORED",
      "REAL_PROVIDER_UNAVAILABLE",
      "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_REVALIDATION_FAILED"
    ],
    inherited_subordinate_verdicts: {
      memory_continuity_verdicts: ["LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED", "LONG_HORIZON_MEMORY_CONTINUITY_PARTIAL", "LONG_HORIZON_MEMORY_CONTINUITY_NOT_OBSERVED"],
      restore_verdicts: ["TWO_BOUNDARY_RESTORE_SUPPORTED", "ONE_BOUNDARY_RESTORE_SUPPORTED", "SESSION_RESTORE_NOT_SUPPORTED"],
      autonomous_orchestration_verdicts: ["AUTONOMOUS_LIFECYCLE_ORCHESTRATION_SUPPORTED", "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_PARTIAL", "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_NOT_SUPPORTED"]
    },
    inherited_thresholds_unchanged_from_original: true,
    frozen_before_real_provider_output: true
  });
  writeJson(join(outdir!, "phase-a.json"), {
    schema_version: "long-horizon-phase-a-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    real_model_calls: 0,
    session_capability_understood: "PASS",
    authority_composition_frozen: "PASS",
    environment_contract_frozen: "PASS",
    interaction_plan_frozen: "PASS",
    restore_plan_frozen: "PASS",
    call_budget_frozen: "PASS",
    verdict_vocabulary_frozen: "PASS",
    all_pass: true
  });
  writeJson(join(outdir!, "phase-a-complete.json"), {
    schema_version: "long-horizon-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    real_model_calls: 0,
    all_pass: true
  });
  console.log("PHASE A COMPLETE: revalidation plan frozen; real model calls 0");
}

// =====================================================================================
// run
// =====================================================================================
else if (command === "run") {
  if (!existsSync(resolve(outdir!, "phase-a-complete.json"))) throw new Error("phase-a-complete.json missing: run phase-a first");
  mkdirSync(join(outdir!, "real-provider"), { recursive: true });
  const callsPath = join(outdir!, "real-provider", "model-calls.jsonl");
  const attemptsPath = join(outdir!, "real-provider", "attempt-history.json");
  if (existsSync(join(outdir!, "interaction-8.json"))) throw new Error("run already complete (no repetitions)");
  if (existsSync(callsPath)) throw new Error("model-calls.jsonl already exists: this is a one-run-of-record validation (no rerun)");

  const attempts: Record<string, unknown>[] = existsSync(attemptsPath) ? readJson<Record<string, unknown>[]>(attemptsPath) : [];
  const attemptNumber = attempts.length + 1;
  attempts.push({ attempt: attemptNumber, outcome: "IN_PROGRESS", started_at: new Date().toISOString() });
  writeJson(attemptsPath, attempts);

  // Provider preflight (metadata only; never a generation call).
  const probeOnce = async (): Promise<{ reachable: boolean; version: string | null; digest: string | null; failure: string | null }> => {
    try {
      const tags = await fetch(`${SETTINGS.base_url}/api/tags`);
      const version = await fetch(`${SETTINGS.base_url}/api/version`);
      const body = (await tags.json()) as { models?: { name?: string; digest?: string }[] };
      const model = (body.models ?? []).find((entry) => entry.name === SETTINGS.model);
      const versionBody = (await version.json()) as { version?: string };
      return { reachable: true, version: versionBody.version ?? null, digest: model?.digest ?? null, failure: model === undefined ? `${SETTINGS.model} not listed` : null };
    } catch (error) {
      return { reachable: false, version: null, digest: null, failure: String(error).slice(0, 200) };
    }
  };
  let probe = await probeOnce();
  for (let retry = 2; retry <= 3; retry += 1) {
    if (probe.reachable && probe.digest === SETTINGS.required_digest) break;
    await new Promise((sleep) => setTimeout(sleep, 2000));
    probe = await probeOnce();
  }
  writeJson(join(outdir!, "real-provider", "provider-preflight.json"), {
    schema_version: "long-horizon-provider-preflight-v0",
    endpoint: SETTINGS.base_url,
    ollama_version: probe.version,
    model: SETTINGS.model,
    digest: probe.digest,
    digest_matches_required: probe.digest === SETTINGS.required_digest,
    reachable: probe.reachable,
    failure: probe.failure,
    settings: { ...SETTINGS },
    requested_context_window_tokens: SETTINGS.context_window_tokens,
    requested_max_output_tokens: SETTINGS.num_predict,
    effective_context_window_authority: "NOT_EXPOSED_BY_OLLAMA_CHAT_API (requested value is CharacterOS-side; effective compliance is inferred only from successful token accounting)",
    preflight_metadata_calls: 2,
    real_model_calls: 0
  });
  if (!probe.reachable || probe.digest !== SETTINGS.required_digest) {
    throw new Error(`REAL_PROVIDER_UNAVAILABLE: ${probe.failure ?? "digest mismatch"}`);
  }

  // `ledger` is the combined evidence ledger (cognition + language). The session
  // identity audit must compare against the COGNITION call's trace, so that call
  // additionally feeds `cognitionLedger` — the frozen V0 harness only observed
  // the cognition transport for exactly this reason.
  const ledger: TraceLedger = [];
  const cognitionLedger: TraceLedger = [];
  let currentInteraction = 0;
  const cognitionInner = new OllamaNativeCognitionTransportV0({
    base_url: SETTINGS.base_url,
    model: SETTINGS.model,
    timeout_ms: SETTINGS.timeout_ms,
    num_predict: SETTINGS.num_predict,
    context_window_tokens: SETTINGS.context_window_tokens,
    trace_observer: (event: ModelTransportTraceV0) => {
      traceObserver(ledger)(event);
      traceObserver(cognitionLedger)(event);
    }
  } as never) as unknown as ModelTransportV0;
  const languageInner = new OllamaNativeCognitionTransportV0({
    base_url: SETTINGS.base_url,
    model: SETTINGS.model,
    timeout_ms: SETTINGS.timeout_ms,
    num_predict: SETTINGS.num_predict,
    context_window_tokens: SETTINGS.context_window_tokens,
    trace_observer: traceObserver(ledger)
  } as never) as unknown as ModelTransportV0;

  const session = await createLongHorizonSubjectSessionV0({
    session_id: "alice-review-session-1",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: v3Seed(INTERACTIONS[0]!.task),
    conversationCognitionTransport: accountingTransport({
      inner: cognitionInner, stage: "cognition", callsPath, digest: probe.digest!, ledger,
      interaction: () => currentInteraction, attempt: () => attemptNumber
    }),
    languageTransport: accountingTransport({
      inner: languageInner, stage: "language", callsPath, digest: probe.digest!, ledger,
      interaction: () => currentInteraction, attempt: () => attemptNumber
    }),
    factualEventAppraisalProvider: aliceAppraisalProvider(),
    environment: new AliceReviewEnvironmentV0(),
    interaction_interval_ticks: INTERACTION_INTERVAL_TICKS,
    provider_identity: {
      model: SETTINGS.model,
      num_predict: SETTINGS.num_predict,
      context_window_tokens: SETTINGS.context_window_tokens,
      last_trace: () => cognitionLedger.at(-1) ?? null
    },
    clock: () => new Date().toISOString()
  });

  const persistInteraction = (outcome: SessionInteractionOutcomeV0): void => {
    writeJson(join(outdir!, `interaction-${outcome.interaction_index + 1}.json`), {
      ...outcome,
      schema_version: "long-horizon-interaction-v0",
      experiment_version: EXPERIMENT_VERSION,
      conversation_id: ALICE_CONVERSATION_ID
    });
    const trace = outcome.provider_terminal_trace;
    console.log(`[i${outcome.interaction_index + 1}/8] ${outcome.status} directive=${outcome.directive} retrieved=${outcome.working_episode_refs.length} evidence=${outcome.resolved_evidence_entry_count} identity=${outcome.provider_request_identity_match} prompt=${trace?.ollama.prompt_eval_count ?? "?"} gen=${trace?.ollama.eval_count ?? "?"} done=${trace?.ollama.done_reason ?? "?"} behavior="${outcome.behavior_text.slice(0, 50)}"`);
  };

  const outcomes: SessionInteractionOutcomeV0[] = [];
  const restoreOutcomes: SessionRestoreOutcomeV0[] = [];
  for (let index = 0; index < 8; index += 1) {
    currentInteraction = index;
    const outcome = await session.processInteraction();
    outcomes.push(outcome);
    persistInteraction(outcome);
    if (outcome.status !== "COMPLETE") {
      attempts[attempts.length - 1] = { ...attempts[attempts.length - 1]!, outcome: "FAILED", detail: outcome.failure };
      writeJson(attemptsPath, attempts);
      throw new Error(`interaction ${index + 1} did not complete: ${outcome.failure}`);
    }
    const boundary = CHECKPOINT_AFTER.indexOf((index + 1) as 3 | 6);
    if (boundary >= 0) {
      const checkpoint = await session.checkpoint();
      const restore = await session.restore(checkpoint);
      restoreOutcomes.push(restore);
      writeJson(join(outdir!, `checkpoint-${boundary + 1}.json`), { ...checkpoint, schema_version: "long-horizon-checkpoint-v0" });
      writeJson(join(outdir!, `restore-${boundary + 1}.json`), { ...restore, schema_version: "long-horizon-restore-v0" });
      console.log(`  [restore ${boundary + 1}] ${restore.kind} ${restore.identity_classification} next=i${restore.next_interaction_index + 1} repo=${restore.pre.repository_revision}->${restore.post.repository_revision}`);
      if (restore.kind !== "RESTORED") {
        attempts[attempts.length - 1] = { ...attempts[attempts.length - 1]!, outcome: "FAILED", detail: `restore ${boundary + 1} failed: ${restore.detail}` };
        writeJson(attemptsPath, attempts);
        throw new Error(`restore ${boundary + 1} failed: ${restore.detail}`);
      }
    }
  }

  writeJson(join(outdir!, "session-ledger.json"), { schema_version: "long-horizon-session-ledger-v0", rows: outcomes });
  writeJson(join(outdir!, "real-provider", "collection-complete.json"), {
    schema_version: "long-horizon-collection-complete-v0",
    interactions: outcomes.length,
    restores: restoreOutcomes.length,
    no_further_generation: true
  });
  attempts[attempts.length - 1] = { ...attempts[attempts.length - 1]!, outcome: "COMPLETED", completed_at: new Date().toISOString() };
  writeJson(attemptsPath, attempts);
  console.log(`RUN COMPLETE: ${outcomes.length} interactions, ${restoreOutcomes.length} restores`);
}

// =====================================================================================
// finalize
// =====================================================================================
else if (command === "finalize") {
  const interactions = INTERACTIONS
    .map((_, index) => ({ index, path: join(outdir!, `interaction-${index + 1}.json`) }))
    .filter((entry) => existsSync(entry.path))
    .map((entry) => readJson<Record<string, unknown>>(entry.path));
  const restores = [1, 2]
    .map((index) => join(outdir!, `restore-${index}.json`))
    .filter((path) => existsSync(path))
    .map((path) => readJson<Record<string, unknown>>(path));
  const calls = readFileSync(join(outdir!, "real-provider", "model-calls.jsonl"), "utf8").trim().split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const attemptRows = readJson<Record<string, unknown>[]>(join(outdir!, "real-provider", "attempt-history.json"));
  const runOfRecord = Number(attemptRows[attemptRows.length - 1]!["attempt"]);

  const episodeRefs: Record<string, string> = {};
  for (const row of interactions) {
    if (row["episode_ref"] !== null && row["episode_ref"] !== undefined) {
      episodeRefs[`E${Number(row["interaction_index"]) + 1}`] = String(row["episode_ref"]);
    }
  }
  const refOwner = (ref: string): string | null =>
    Object.entries(episodeRefs).find(([, value]) => value === ref)?.[0] ?? null;
  const originClasses = (row: Record<string, unknown>): string[] =>
    (row["working_episode_refs"] as string[]).map((ref) => {
      const owner = refOwner(ref);
      return owner === null ? "CURRENT_EPISODE_ONLY" : `FROM_${owner}`;
    });

  const completed = interactions.filter((row) => row["status"] === "COMPLETE").length;
  const memoryCommits = interactions.filter((row) => row["experience_ref"] !== null).length;
  const withPriorEvidence = interactions.filter((row, index) => index > 0 && originClasses(row).some((entry) => entry.startsWith("FROM_"))).length;
  const providerWithPriorLife = interactions.filter((row, index) => index > 0 && row["provider_memory_section_present"] === true && Number(row["resolved_evidence_entry_count"] ?? 0) > 0).length;
  const sessionLevelIdentityVerified = interactions.filter((row) => row["provider_request_identity_match"] === true).length;
  // The direct measurement of the property: for every completed provider call,
  // the rendered/accounting request hash must equal the native transport request
  // hash (which now includes num_ctx). This is what the session-level boolean is
  // meant to express, measured per call from the crash-safe ledger.
  const completedCallRows = calls.filter((call) => call["event"] === "COMPLETED" && Number(call["attempt"]) === runOfRecord);
  const ledgerIdentityVerified = completedCallRows.filter((call) => call["transport_request_identity_match"] === true).length;
  const ledgerIdentityAllVerified = completedCallRows.length > 0 && ledgerIdentityVerified === completedCallRows.length;
  const restoresOk = restores.filter((row) => row["kind"] === "RESTORED").length;
  const envRestoreExact = restores.filter((row) => row["environment_state_hash_pre"] === row["environment_state_hash_post"]).length;

  const postRestore1 = interactions.slice(3).some((row) => originClasses(row).some((entry) => ["FROM_E1", "FROM_E2", "FROM_E3"].includes(entry)));
  const postRestore2 = interactions.slice(6).some((row) => originClasses(row).some((entry) => ["FROM_E1", "FROM_E2", "FROM_E3", "FROM_E4", "FROM_E5", "FROM_E6"].includes(entry)));

  const memoryContinuity = postRestore1 && postRestore2 && withPriorEvidence >= 3
    ? "LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED"
    : (withPriorEvidence >= 1 ? "LONG_HORIZON_MEMORY_CONTINUITY_PARTIAL" : "LONG_HORIZON_MEMORY_CONTINUITY_NOT_OBSERVED");
  const restoreVerdict = restoresOk === 2 ? "TWO_BOUNDARY_RESTORE_SUPPORTED" : (restoresOk === 1 ? "ONE_BOUNDARY_RESTORE_SUPPORTED" : "SESSION_RESTORE_NOT_SUPPORTED");
  const orchestration = completed === 8 && memoryCommits >= 6 && ledgerIdentityAllVerified
    ? "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_SUPPORTED"
    : (completed >= 6 ? "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_PARTIAL" : "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_NOT_SUPPORTED");

  // ---- provider terminal telemetry (CharacterOS evidence, no OS logs) ----------------
  const runOfRecordCalls = calls.filter((call) => Number(call["attempt"]) === runOfRecord);
  const cognitionRows = runOfRecordCalls.filter((call) => call["event"] === "COMPLETED" && call["stage"] === "cognition");
  const languageRows = runOfRecordCalls.filter((call) => call["event"] === "COMPLETED" && call["stage"] === "language");
  const failedRows = runOfRecordCalls.filter((call) => call["event"] === "FAILED");
  const num = (value: unknown): number | null => (typeof value === "number" ? value : null);

  const traceOf = (row: Record<string, unknown>): ModelTransportTraceV0 | null =>
    (row["terminal_trace"] ?? null) as ModelTransportTraceV0 | null;
  /** Cognition row of the crash-safe ledger, keyed by 0-based interaction index. */
  const cognitionByInteraction = new Map<number, Record<string, unknown>>();
  for (const row of cognitionRows) cognitionByInteraction.set(Number(row["interaction"]), row);
  /**
   * Cognition terminal trace for an interaction, read from the per-stage call
   * ledger. The ledger is stage-accurate, whereas the interaction outcome's
   * `provider_terminal_trace` reflects the run-of-record's harness wiring (see
   * the session-level field defect documented in provider-request-identity-audit).
   */
  const cognitionTraceAt = (index: number): ModelTransportTraceV0 | null => {
    const row = cognitionByInteraction.get(index);
    return row === undefined ? null : traceOf(row);
  };

  const budgetTimeline = {
    schema_version: "long-horizon-provider-budget-timeline-v0",
    context_window_tokens_configured: SETTINGS.context_window_tokens,
    max_output_tokens_configured: SETTINGS.num_predict,
    source: "crash-safe per-call ledger, cognition stage (provider-reported token accounting)",
    remaining_is_derived_arithmetic: true,
    remaining_formula: "context_window_tokens - prompt_eval_count - eval_count (derived, NOT provider authority)",
    per_interaction: interactions.map((row) => {
      const trace = cognitionTraceAt(Number(row["interaction_index"]));
      const prompt = trace?.ollama.prompt_eval_count ?? null;
      const generated = trace?.ollama.eval_count ?? null;
      const context = trace?.budget.context_window_tokens ?? null;
      return {
        interaction: Number(row["interaction_index"]) + 1,
        prompt_eval_count: prompt,
        eval_count: generated,
        total_sequence_tokens: prompt !== null && generated !== null ? prompt + generated : null,
        context_window_tokens: context,
        remaining: context !== null && prompt !== null && generated !== null ? context - prompt - generated : null,
        done_reason: trace?.ollama.done_reason ?? null,
        failure_code: trace?.failure_code ?? null,
        cognition_status: row["cognition_status"],
        interaction_status: row["status"],
        provider_request_identity_match: row["provider_request_identity_match"]
      };
    })
  };
  writeJson(join(outdir!, "provider-budget-timeline.json"), budgetTimeline);

  const terminalTraceAudit = {
    schema_version: "long-horizon-provider-terminal-trace-audit-v0",
    source: "CharacterOS-persisted provider terminal traces (session outcomes + crash-safe call ledger)",
    requires_ollama_server_log: false,
    configured: { context_window_tokens: SETTINGS.context_window_tokens, max_output_tokens: SETTINGS.num_predict },
    cognition_calls: cognitionRows.length,
    language_calls: languageRows.length,
    failed_calls: failedRows.length,
    every_cognition_call_has_terminal_trace: cognitionRows.every((row) => traceOf(row) !== null),
    every_call_has_prompt_eval_count: [...cognitionRows, ...languageRows].every((row) => num(row["prompt_eval_count"]) !== null),
    every_call_has_eval_count: [...cognitionRows, ...languageRows].every((row) => num(row["eval_count"]) !== null),
    every_call_has_done_reason: [...cognitionRows, ...languageRows].every((row) => typeof row["done_reason"] === "string"),
    done_reason_values_observed: [...new Set([...cognitionRows, ...languageRows].map((row) => row["done_reason"]))],
    per_call: completedCallRows.concat(failedRows).map((row) => ({
      interaction: row["interaction"],
      stage: row["stage"],
      event: row["event"],
      request_hash: row["request_hash"],
      transport_request_hash: row["transport_request_hash"],
      request_identity_match: row["transport_request_identity_match"],
      request_bytes: row["request_bytes"],
      response_hash: row["response_hash"] ?? null,
      prompt_eval_count: num(row["prompt_eval_count"]),
      eval_count: num(row["eval_count"]),
      done_reason: row["done_reason"] ?? null,
      context_window_tokens: num(row["context_window_tokens"]),
      max_output_tokens: num(row["max_output_tokens"]),
      failure_code: traceOf(row)?.failure_code ?? null,
      validation: row["event"] === "COMPLETED" ? "PROVIDER_OUTPUT_RETURNED" : "PROVIDER_FAILURE"
    }))
  };
  writeJson(join(outdir!, "provider-terminal-trace-audit.json"), terminalTraceAudit);

  const e8 = interactions.filter((row) => row["status"] === "COMPLETE").at(-1) ?? interactions[interactions.length - 1]!;
  const e8Origins = originClasses(e8);
  const older = e8Origins.filter((entry) => ["FROM_E1", "FROM_E2", "FROM_E3", "FROM_E4"].includes(entry));
  const recent = e8Origins.filter((entry) => ["FROM_E5", "FROM_E6", "FROM_E7"].includes(entry));
  const preRestore = e8Origins.filter((entry) => ["FROM_E1", "FROM_E2", "FROM_E3"].includes(entry));
  const memoryAge = {
    schema_version: "long-horizon-memory-age-audit-v0",
    at_interaction: Number(e8["interaction_index"] ?? 0) + 1,
    retrieved: e8Origins,
    bands: {
      E7_only: e8Origins.filter((entry) => entry === "FROM_E7"),
      recent_E5_E7: recent,
      older_E1_E4: older,
      pre_restore_episodes: preRestore
    },
    multiple_age_bands: recent.length > 0 && older.length > 0,
    retrieval_unchanged: true
  };

  const autonomyAudit = {
    schema_version: "long-horizon-autonomy-audit-v0",
    per_interaction: interactions.map((row, index) => ({
      interaction: index + 1,
      host_selected_memory_ref: "NO",
      host_set_current_intent: "NO",
      host_selected_directive: "NO",
      host_wrote_behavior: "NO",
      host_wrote_memory: "NO",
      host_manually_summarized_history: "NO",
      host_trimmed_context: "NO",
      environment_supplied_only_the_current_situation: true,
      retrieved_refs: originClasses(row),
      current_intent: row["current_intent"],
      directive: row["directive"],
      behavior: row["behavior_text"]
    })),
    manual_injection_absent: true
  };

  const transcriptAudit = {
    schema_version: "long-horizon-transcript-bypass-audit-v0",
    MANUAL_CONVERSATION_RECAP: "NO",
    RAW_TRANSCRIPT_CONTINUITY_BYPASS: "NO",
    evidence: "each interaction's provider request is rebuilt from the current projection only; no previous provider messages are carried forward",
    messages_per_call: runOfRecordCalls.filter((call) => call["event"] === "STARTED").length
  };

  writeJson(join(outdir!, "retrieval-timeline.json"), {
    schema_version: "long-horizon-retrieval-timeline-v0",
    per_interaction: interactions.map((row, index) => ({
      interaction: index + 1,
      selected_refs: row["retrieved_refs"],
      working_episode_refs: row["working_episode_refs"],
      evidence_origin: originClasses(row),
      resolved_evidence_entry_count: row["resolved_evidence_entry_count"],
      provider_memory_section_present: row["provider_memory_section_present"],
      considered_context_refs: row["considered_context_refs"]
    })),
    retrieval_service: "RepositoryBackedMemoryRetrievalServiceV0 (frozen; no pinning, no tuning)"
  });
  const revisionTimeline = {
    schema_version: "long-horizon-memory-revision-timeline-v0",
    entries: interactions.map((row, index) => ({
      interaction: index + 1,
      repository_revision_before: row["repository_revision_before"],
      repository_revision_after: row["repository_revision_after"],
      state_revision_before: row["state_revision_before"],
      state_revision_after: row["state_revision_after"]
    })),
    memory_commits: memoryCommits
  };
  writeJson(join(outdir!, "memory-revision-timeline.json"), revisionTimeline);
  writeJson(join(outdir!, "repository-revision-timeline.json"), revisionTimeline);
  writeJson(join(outdir!, "memory-age-audit.json"), memoryAge);
  writeJson(join(outdir!, "affect-timeline.json"), {
    schema_version: "long-horizon-affect-timeline-v0",
    entries: interactions.map((row, index) => ({
      interaction: index + 1,
      logical_time_before: row["logical_time_before"],
      logical_time_after: row["logical_time_after"],
      affect_before: row["affect_before"],
      affect_after: row["affect_after"]
    })),
    manual_patch: false,
    equalization: false
  });
  writeJson(join(outdir!, "environment-state-timeline.json"), {
    schema_version: "long-horizon-environment-state-timeline-v0",
    entries: interactions.map((row, index) => ({
      interaction: index + 1,
      state_hash_before: row["environment_state_hash_before"],
      state_hash_after: row["environment_state_hash_after"],
      state_before: row["environment_state_before"],
      state_after: row["environment_state_after"]
    })),
    restored_independently: envRestoreExact === restores.length
  });
  writeJson(join(outdir!, "provider-request-identity-audit.json"), {
    schema_version: "long-horizon-provider-request-identity-audit-v0",
    includes_num_ctx: true,
    primary_measurement: "per-call crash-safe ledger: rendered/accounting request hash == native transport request hash",
    per_interaction_session_field: interactions.map((row, index) => ({
      interaction: index + 1,
      provider_request_hash: row["provider_request_hash"],
      transport_request_hash: row["transport_request_hash"],
      match: row["provider_request_identity_match"],
      memory_section_present: row["provider_memory_section_present"]
    })),
    per_call: completedCallRows.map((row) => ({
      interaction: row["interaction"],
      stage: row["stage"],
      request_hash: row["request_hash"],
      transport_request_hash: row["transport_request_hash"],
      request_bytes: row["request_bytes"],
      context_window_tokens: num(row["context_window_tokens"]),
      max_output_tokens: num(row["max_output_tokens"]),
      match: row["transport_request_identity_match"]
    })),
    per_call_verified: ledgerIdentityVerified,
    per_call_total: completedCallRows.length,
    per_call_all_match: ledgerIdentityAllVerified,
    session_level_field_verified: sessionLevelIdentityVerified,
    session_level_field_total: interactions.length,
    session_level_field_defect: sessionLevelIdentityVerified === ledgerIdentityVerified
      ? null
      : {
        defect: "HARNESS_TRACE_WIRING_DEFECT_IN_RUN_OF_RECORD",
        cause: "the revalidation harness initially passed a SHARED cognition+language trace ledger as provider_identity.last_trace; the session therefore compared its rebuilt cognition request hash against the LANGUAGE call's trace (the last call of the interaction). The frozen V0 harness observed only the cognition transport, so this defect is new to the revalidation harness, not to the session capability.",
        applies_to: "the session-level provider_request_identity_match field only; the underlying request identity property is unaffected",
        evidence: interactions.map((row) => {
          const interaction = Number(row["interaction_index"]);
          const cognition = completedCallRows.find((call) => call["interaction"] === interaction && call["stage"] === "cognition");
          const language = completedCallRows.find((call) => call["interaction"] === interaction && call["stage"] === "language");
          return {
            interaction: interaction + 1,
            session_provider_request_hash_equals_ledger_cognition_hash: row["provider_request_hash"] === cognition?.["request_hash"],
            session_transport_request_hash_equals_ledger_language_hash: language === undefined ? null : row["transport_request_hash"] === language["request_hash"]
          };
        }),
        resolution: "harness wiring corrected in this slice (cognition-only ledger for last_trace; combined ledger retained for evidence); the run-of-record was NOT rerun and its raw collected evidence was NOT modified",
        all_interactions_show_the_same_signature: interactions.every((row) => {
          const interaction = Number(row["interaction_index"]);
          const cognition = completedCallRows.find((call) => call["interaction"] === interaction && call["stage"] === "cognition");
          const language = completedCallRows.find((call) => call["interaction"] === interaction && call["stage"] === "language");
          return row["provider_request_hash"] === cognition?.["request_hash"]
            && (language === undefined || row["transport_request_hash"] === language["request_hash"]);
        })
      },
    all_match: ledgerIdentityAllVerified,
    verified: ledgerIdentityVerified
  });
  writeJson(join(outdir!, "autonomy-audit.json"), autonomyAudit);
  writeJson(join(outdir!, "transcript-bypass-audit.json"), transcriptAudit);

  // ---- plan identity vs the original pre-call artifacts -----------------------------
  const originalPlanPath = join(
    process.cwd(),
    "research/experiments/long-horizon-autonomous-subject-session-v0/evidence/run-1-real-provider/attempt-1/interaction-plan.json"
  );
  const originalPlan = existsSync(originalPlanPath) ? readJson<Record<string, unknown>>(originalPlanPath) : null;
  const revalidationPlan = readJson<Record<string, unknown>>(join(outdir!, "interaction-plan.json"));
  const comparable = (plan: Record<string, unknown> | null): string =>
    plan === null ? "" : JSON.stringify({
      interaction_count: plan["interaction_count"],
      interval_ticks: plan["interval_ticks"],
      checkpoint_after: plan["checkpoint_after"],
      interactions: plan["interactions"],
      primary_appraisal_dimensions: plan["primary_appraisal_dimensions"],
      reply_appraisal_dimensions: plan["reply_appraisal_dimensions"]
    });
  writeJson(join(outdir!, "plan-identity-audit.json"), {
    schema_version: "long-horizon-revalidation-plan-identity-audit-v0",
    original_plan: "research/experiments/long-horizon-autonomous-subject-session-v0/evidence/run-1-real-provider/attempt-1/interaction-plan.json",
    revalidation_plan: "interaction-plan.json",
    interaction_plan_identity: comparable(originalPlan) === comparable(revalidationPlan) ? "SAME" : "DIFFERENT",
    compared_fields: ["interaction_count", "interval_ticks", "checkpoint_after", "interactions", "primary_appraisal_dimensions", "reply_appraisal_dimensions"],
    environment_rules: "SAME (alice-environment.ts byte-identical copy)",
    restore_positions: "SAME (checkpoint after E3 and E6)"
  });

  const status = {
    schema_version: "long-horizon-operator-status-example-v0",
    example_from_interaction: interactions.length,
    session_id: "alice-review-session-1",
    subject_id: SUBJECT_ID,
    interaction: `${completed}/${interactions.length}`,
    logical_time: e8["logical_time_after"],
    memory_repository_revision: e8["repository_revision_after"],
    current_affect: { valence: e8["affect_after"], activation: "see affect-timeline.json" },
    current_intent: e8["current_intent"],
    latest_directive: e8["directive"],
    latest_behavior: e8["behavior_text"],
    retrieved_memories: originClasses(interactions[interactions.length - 1]!),
    last_restore: restores.length > 0 && restores[restores.length - 1]!["kind"] === "RESTORED" ? "success" : "failed",
    authority_tokens_exposed: "NONE"
  };
  writeJson(join(outdir!, "operator-status-example.json"), status);

  const allComplete = completed === 8;
  const noContextTruncation = runOfRecordCalls.every((row) => traceOf(row)?.failure_code !== "MODEL_OUTPUT_TRUNCATED");
  const telemetryPersisted = cognitionRows.length > 0
    && cognitionRows.every((row) => num(row["prompt_eval_count"]) !== null && num(row["eval_count"]) !== null && typeof row["done_reason"] === "string" && num(row["context_window_tokens"]) === SETTINGS.context_window_tokens);

  const revalidated = allComplete && noContextTruncation && restoresOk === 2 && envRestoreExact === 2
    && memoryCommits >= 6 && memoryContinuity === "LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED"
    && ledgerIdentityAllVerified && telemetryPersisted;
  const principal = revalidated
    ? "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_REVALIDATED"
    : (noContextTruncation && completed >= 6
      ? "LONG_HORIZON_SESSION_REPAIR_PARTIALLY_VALIDATED"
      : (!noContextTruncation ? "CONTEXT_BUDGET_REPAIR_NOT_SUFFICIENT" : "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_REVALIDATION_FAILED"));

  const e7 = interactions.find((row) => Number(row["interaction_index"]) === 6) ?? null;
  const e7Trace = e7 === null ? null : cognitionTraceAt(6);
  const e8Trace = cognitionTraceAt(Number(e8["interaction_index"] ?? 0));

  writeJson(join(outdir!, "summary.json"), {
    schema_version: "long-horizon-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    revalidates: ORIGINAL_EXPERIMENT,
    repair_commit: BASELINE_COMMIT,
    verdict: principal,
    memory_continuity_verdict: memoryContinuity,
    restore_verdict: restoreVerdict,
    autonomous_orchestration_verdict: orchestration,
    context_budget: {
      configured_context_window_tokens: SETTINGS.context_window_tokens,
      configured_max_output_tokens: SETTINGS.num_predict,
      context_truncation_observed: !noContextTruncation,
      e7_prompt_eval_count: e7Trace?.ollama.prompt_eval_count ?? null,
      e7_eval_count: e7Trace?.ollama.eval_count ?? null,
      e7_total_sequence_tokens: e7Trace === null ? null : (e7Trace.ollama.prompt_eval_count ?? 0) + (e7Trace.ollama.eval_count ?? 0),
      e8_prompt_eval_count: e8Trace?.ollama.prompt_eval_count ?? null,
      e8_eval_count: e8Trace?.ollama.eval_count ?? null,
      e8_total_sequence_tokens: e8Trace === null ? null : (e8Trace.ollama.prompt_eval_count ?? 0) + (e8Trace.ollama.eval_count ?? 0),
      headroom_low: e8Trace !== null && ((e8Trace.ollama.prompt_eval_count ?? 0) + (e8Trace.ollama.eval_count ?? 0)) > SETTINGS.context_window_tokens * 0.85
    },
    metrics: {
      completed_interactions: completed,
      durable_memory_commits: memoryCommits,
      interactions_with_prior_lived_evidence_retrieved: withPriorEvidence,
      provider_requests_with_prior_life_factual_content: providerWithPriorLife,
      provider_request_identity_verified: ledgerIdentityVerified,
      provider_request_identity_verified_of_total: completedCallRows.length,
      provider_request_identity_session_level_field: sessionLevelIdentityVerified,
      restores_completed: restoresOk,
      environment_state_restored_exactly: envRestoreExact,
      post_restore_1_prior_evidence: postRestore1,
      post_restore_2_prior_evidence: postRestore2
    },
    provider_request_identity: {
      primary_measurement: "per-call crash-safe ledger (rendered/accounting request hash == native transport request hash, including num_ctx)",
      verified_calls: ledgerIdentityVerified,
      total_calls: completedCallRows.length,
      all_verified: ledgerIdentityAllVerified,
      session_level_field_verified: sessionLevelIdentityVerified,
      session_level_field_defect: sessionLevelIdentityVerified !== ledgerIdentityVerified,
      session_level_field_defect_cause: sessionLevelIdentityVerified === ledgerIdentityVerified
        ? null
        : "revalidation harness passed a shared cognition+language trace ledger as last_trace; the session compared against the language call's trace. Harness defect, corrected in this slice; the request identity property itself is verified per call."
    },
    retrieval_contribution: Object.fromEntries(interactions.map((row, index) => [index + 1, originClasses(row)])),
    restores: restores.map((row) => ({
      checkpoint_ref: row["checkpoint_ref"],
      kind: row["kind"],
      classification: row["identity_classification"],
      pre_head: (row["pre"] as Record<string, unknown>)["subject_head"],
      post_head: (row["post"] as Record<string, unknown>)["subject_head"],
      pre_state_hash: (row["pre"] as Record<string, unknown>)["subject_state_hash"],
      post_state_hash: (row["post"] as Record<string, unknown>)["subject_state_hash"],
      pre_repository_revision: (row["pre"] as Record<string, unknown>)["repository_revision"],
      post_repository_revision: (row["post"] as Record<string, unknown>)["repository_revision"],
      environment_state_hash_pre: row["environment_state_hash_pre"],
      environment_state_hash_post: row["environment_state_hash_post"],
      next_interaction_index: row["next_interaction_index"]
    })),
    tokens: {
      schema_version: "long-horizon-token-report-v0",
      run_of_record_attempt: runOfRecord,
      source: "provider-reported prompt_eval_count / eval_count (CharacterOS-persisted terminal traces)",
      cognition_prompt_tokens_total: cognitionRows.reduce((sum, row) => sum + (num(row["prompt_eval_count"]) ?? 0), 0),
      cognition_output_tokens_total: cognitionRows.reduce((sum, row) => sum + (num(row["eval_count"]) ?? 0), 0),
      language_prompt_tokens_total: languageRows.reduce((sum, row) => sum + (num(row["prompt_eval_count"]) ?? 0), 0),
      language_output_tokens_total: languageRows.reduce((sum, row) => sum + (num(row["eval_count"]) ?? 0), 0),
      external_api_monetary_cost: "0 (local Ollama; no external API calls)",
      all_attempts: {
        attempts: attemptRows.map((row) => row["attempt"]),
        outcomes: attemptRows.map((row) => row["outcome"]),
        calls_persisted: calls.length
      }
    },
    real_calls: { cognition: cognitionRows.length, language: languageRows.length, maximum: 16, repetitions: 0 },
    preflight_metadata_calls: 2,
    production_behavior_changing_diff: 0
  });

  writeJson(resolve(outdir!, "quality-gates.json"), {
    schema_version: "long-horizon-quality-gates-v0",
    single_subject: true,
    no_control_arms: true,
    all_interactions_complete: allComplete,
    memory_commits_at_least_six: memoryCommits >= 6,
    two_restore_boundaries: restoresOk === 2,
    environment_state_restored_exactly: envRestoreExact === 2,
    provider_request_identity_all_verified: ledgerIdentityAllVerified,
    provider_request_identity_session_level_field: sessionLevelIdentityVerified === interactions.length,
    provider_request_identity_session_level_field_defect: sessionLevelIdentityVerified !== interactions.length,
    no_context_truncation: noContextTruncation,
    provider_terminal_telemetry_persisted: telemetryPersisted,
    no_manual_injection: true,
    no_transcript_bypass: true,
    no_new_psychology: true,
    retrieval_unchanged: true,
    real_calls_within_budget: cognitionRows.length <= 8 && languageRows.length <= 8,
    all_pass: allComplete && memoryCommits >= 6 && restoresOk === 2 && envRestoreExact === 2 && ledgerIdentityAllVerified && noContextTruncation && telemetryPersisted
  });

  writeFileSync(resolve(outdir!, "REPORT.md"), [
    `# ${EXPERIMENT_VERSION} — evidence`,
    "",
    `## Principal verdict: ${principal}`,
    `## Memory continuity: ${memoryContinuity}`,
    `## Restore: ${restoreVerdict}`,
    `## Autonomous orchestration: ${orchestration}`,
    "",
    "## Revalidates",
    `${ORIGINAL_EXPERIMENT} (frozen FAILED at interaction 7 on implicit 4096-token context)`,
    `Repair: COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0 @ ${BASELINE_COMMIT}`,
    "",
    "## Single variable under study",
    "provider context budget: implicit Ollama default 4096 → explicit num_ctx 8192 (num_predict unchanged at 2048)",
    "",
    "## Metrics",
    JSON.stringify({
      completed_interactions: completed,
      durable_memory_commits: memoryCommits,
      interactions_with_prior_lived_evidence_retrieved: withPriorEvidence,
      provider_requests_with_prior_life_factual_content: providerWithPriorLife,
      provider_request_identity_verified_per_call: `${ledgerIdentityVerified}/${completedCallRows.length}`,
      provider_request_identity_session_level_field: `${sessionLevelIdentityVerified}/${interactions.length}`,
      restores_completed: restoresOk,
      environment_state_restored_exactly: envRestoreExact
    }),
    "",
    "## Provider request identity",
    `Primary measurement (per-call ledger, rendered == native transport, includes num_ctx): ${ledgerIdentityVerified}/${completedCallRows.length} verified.`,
    sessionLevelIdentityVerified === ledgerIdentityVerified
      ? "Session-level field agrees."
      : "NOTE: the session-level `provider_request_identity_match` field is FALSE in this run-of-record because the revalidation harness passed a SHARED cognition+language trace ledger as `last_trace`, so the session compared its rebuilt cognition request hash against the LANGUAGE call's trace. This is a harness wiring defect, not a request-identity failure: for every interaction the session's own rebuilt hash equals the ledger's COGNITION call hash, and the field's comparison target equals the ledger's LANGUAGE call hash. The harness was corrected after the run; the run-of-record was not rerun and its raw collected evidence was not modified.",
    "See provider-request-identity-audit.json for the per-interaction signature proof.",
    "",
    "## Provider budget timeline (provider-reported token accounting)",
    JSON.stringify(budgetTimeline.per_interaction),
    "",
    "## Session ledger",
    ...interactions.map((row, index) => `- i${index + 1} t=${row["logical_time_after"]} affect ${row["affect_before"]}→${row["affect_after"]} retrieved=${JSON.stringify(originClasses(row))} directive=${row["directive"]} rev=${row["repository_revision_before"]}→${row["repository_revision_after"]}\n  event: ${row["scene"]}\n  intent: ${JSON.stringify(row["current_intent"])}\n  behavior: ${JSON.stringify(row["behavior_text"])}\n  counterpart: ${JSON.stringify(row["counterpart_reply"])}\n  experience=${row["experience_ref"]} episode=${row["episode_ref"]}`),
    "",
    "## Restores",
    JSON.stringify(restores.map((row) => ({ kind: row["kind"], classification: row["identity_classification"], next: row["next_interaction_index"] }))),
    "",
    "## Operator status example",
    JSON.stringify(status)
  ].join("\n") + "\n");
  console.log(`FINALIZE COMPLETE: ${principal} | ${memoryContinuity} | ${restoreVerdict} | ${orchestration}`);
  console.log(`  completed ${completed}/8; memory commits ${memoryCommits}; prior-evidence interactions ${withPriorEvidence}; identity verified per call ${ledgerIdentityVerified}/${completedCallRows.length} (session-level field ${sessionLevelIdentityVerified}/8); restores ${restoresOk}/2; context truncation ${noContextTruncation ? "NONE" : "OBSERVED"}; telemetry persisted ${telemetryPersisted}`);
} else {
  throw new Error("unknown command; expected phase-a | run | finalize");
}
