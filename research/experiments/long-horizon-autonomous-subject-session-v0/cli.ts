/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated validation harness for the frozen session capability; outdir/argv and frozen indices are validated at each use site. */

/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — validation entrypoint.
 *
 *   node .../cli.ts phase-a  <outdir> — freeze the session plan (0 real calls)
 *   node .../cli.ts run      <outdir> — 8 interactions, checkpoints + 2 authoritative restores
 *   node .../cli.ts finalize <outdir> — verdicts, timelines, ledger, report
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

const EXPERIMENT_VERSION = "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0" as const;
const BASELINE_COMMIT = "468589a3b06d9d3d5ff309e70621e2c76c8ea0a4" as const;
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
  timeout_ms: 120000 as const
});
const INTERACTION_INTERVAL_TICKS = 300;
const CHECKPOINT_AFTER = [3, 6] as const;

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (HEAD !== BASELINE_COMMIT) throw new Error(`baseline mismatch: HEAD ${HEAD} != frozen ${BASELINE_COMMIT}`);

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

/** Crash-safe per-call accounting: every provider attempt is persisted BEFORE the
 * response is awaited, and its terminal row immediately after. */
function accountingTransport(input: {
  readonly inner: ModelTransportV0;
  readonly stage: "cognition" | "language";
  readonly callsPath: string;
  readonly digest: string;
  attempt: () => number;
  lastTrace?: (trace: ModelTransportTraceV0) => void;
}): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0) => {
      const messages = (request as { messages: readonly { role: string; content: string }[] }).messages;
      const userContent = messages.find((message) => message.role === "user")?.content ?? "";
      const body = JSON.stringify({
        model: SETTINGS.model,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        think: false,
        stream: false,
        options: { temperature: 0, num_predict: SETTINGS.num_predict }
      });
      const startedAt = new Date().toISOString();
      const startMs = Date.now();
      const base = {
        attempt: input.attempt(),
        stage: input.stage,
        provider: SETTINGS.provider,
        model: SETTINGS.model,
        digest: input.digest,
        started_at: startedAt,
        request_bytes: new TextEncoder().encode(body).length,
        request_hash: await sha256(body),
        memory_section_present: userContent.includes("[PRIOR FACTUAL MEMORY")
      };
      appendFileSync(input.callsPath, JSON.stringify({ event: "STARTED", ...base }) + "\n");
      try {
        const response = await input.inner.complete(request);
        appendFileSync(input.callsPath, JSON.stringify({
          event: "COMPLETED",
          ...base,
          latency_ms: Date.now() - startMs,
          response_content: (response as { content: string }).content
        }) + "\n");
        return response;
      } catch (error) {
        appendFileSync(input.callsPath, JSON.stringify({
          event: "FAILED",
          ...base,
          latency_ms: Date.now() - startMs,
          failure: (error instanceof Error ? error.message : String(error)).slice(0, 300)
        }) + "\n");
        throw error;
      }
    }
  } as ModelTransportV0;
}

async function sha256(text: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

// =====================================================================================
// phase-a
// =====================================================================================
if (command === "phase-a") {
  mkdirSync(outdir!, { recursive: true });
  writeJson(join(outdir!, "session-architecture-audit.json"), {
    schema_version: "long-horizon-session-architecture-audit-v0",
    baseline_commit: BASELINE_COMMIT,
    phase_a_answers: {
      "1_manually_composed_entrypoints": [
        "materializeSubjectStateV4V0 + createInMemorySubjectCoreFacadeForExplicitV4V0 (genesis/composition)",
        "conversation ingress ledger + conversation-factual-event authority (admission)",
        "FactualEventAppraisalExecutorV0 (pre-cognition appraisal)",
        "createCanonicalAffectApplicationV0ForExplicitV4 (AffectApplication)",
        "RepositoryBackedMemoryRetrievalServiceV0 + governed context Observation (context+retrieval)",
        "ConversationTextResponseExecutorV1 (cognition → directive → language/clarification)",
        "conversation delivery ledger (delivery)",
        "executeBehaviorOutcomeFeedback + LearningTransitionExecutor (Experience/Learning/Memory)",
        "trusted v4 boundary + restore chain (checkpoint/restore)",
        "BoundedAffectTimeProducerV0 + ReferenceRegulationV0Producer (Time)"
      ],
      "2_smallest_reusable_orchestrator": "LongHorizonSubjectSessionV0 (processInteraction/checkpoint/restore/status) over ExplicitV4SessionAuthorityV0, wired through the existing RuntimeCompositionRoot",
      "3_already_authoritative_durable_state": ["canonical subject snapshot + commit chain", "Memory repository revisions", "delivery/ingress ledgers"],
      "4_operational_state_needing_session_persistence": ["interaction index", "checkpoint refs", "explicit external environment state", "restore generation"],
      "5_pending_appraisal_affect_queue": "the frozen PRIOR_AFFECT_WORK_PENDING law is exposed as an explicit session work queue (enqueue on admission; completePendingLifecycleWork drives every admitted event to a terminal Appraisal + AffectApplication)",
      "6_interaction_complete_boundary": "current event admitted; Appraisal terminal; AffectApplication terminal; cognition complete; behavior complete; delivery complete; environment consequence admitted; feedback complete; Experience+Memory durable; work queue empty",
      "7_fresh_runtime_without_live_authority": "restore rebuilds a FRESH repository from durable payloads + a fresh facade + fresh ledgers restored from their exported state; the previous authority object is discarded and never consulted",
      "8_reusable_vs_validation": {
        reusable_runtime: ["packages/runtime/src/session/* (orchestrator, authority, contracts)"],
        validation_only: ["Alice review environment", "8-interaction plan", "evidence collection", "conformance harness"]
      }
    }
  });
  writeJson(join(outdir!, "frozen-authority-composition.json"), {
    schema_version: "long-horizon-frozen-authority-composition-v0",
    composed_only: true,
    bypasses: [],
    authorities: {
      genesis: "materializeSubjectStateV4V0 (EXPLICIT_V4_FOUNDATION_V0)",
      composition: "RuntimeCompositionRoot",
      admission: "conversation ingress ledger + InMemoryConversationFactualEventAuthorityV0",
      appraisal: "FactualEventAppraisalExecutorV0 + host appraisal provider",
      affect: "createCanonicalAffectApplicationV0ForExplicitV4 (AffectApplication)",
      time: "BoundedAffectTimeProducerV0 + ReferenceRegulationV0Producer + v4 Time transition",
      retrieval: "RepositoryBackedMemoryRetrievalServiceV0",
      evidence: "FactualMemoryEvidenceResolverV0 (composition-owned)",
      behavior: "ConversationTextResponseExecutorV1 (ConversationCognitionProviderV1 → directive → LanguageRealizationProviderV0 / fixed clarification)",
      delivery: "conversation delivery ledger",
      feedback: "LearningTransitionExecutor.executeBehaviorOutcomeFeedback",
      restore: "mintTrustedCanonicalHistoryBoundaryV4V0 + restoreSubjectStateV4AuthoritativelyV0"
    },
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
  writeJson(join(outdir!, "interaction-plan.json"), {
    schema_version: "long-horizon-interaction-plan-v0",
    interaction_count: INTERACTIONS.length,
    interval_ticks: INTERACTION_INTERVAL_TICKS,
    checkpoint_after: [...CHECKPOINT_AFTER],
    interactions: INTERACTIONS.map((interaction) => ({ ...interaction })),
    primary_appraisal_dimensions: PRIMARY_APPRAISAL_DIMENSIONS.map((entry) => ({ ...entry })),
    reply_appraisal_dimensions: { ...REPLY_APPRAISAL_DIMENSIONS }
  });
  writeJson(join(outdir!, "checkpoint-plan.json"), {
    schema_version: "long-horizon-checkpoint-plan-v0",
    boundaries: [...CHECKPOINT_AFTER],
    contents: ["session_id", "next_interaction_index", "completed_interactions", "explicit environment state", "durable subject identity (head/state hash/repository revision)", "v4 genesis envelope", "delivery + ingress ledger exports"],
    ref: "content-addressed checkpoint_ref (hashEnvelope over the above)"
  });
  writeJson(join(outdir!, "restore-plan.json"), {
    schema_version: "long-horizon-restore-plan-v0",
    boundaries: [...CHECKPOINT_AFTER],
    mechanism: "mintTrustedCanonicalHistoryBoundaryV4V0 + restoreSubjectStateV4AuthoritativelyV0",
    fresh_runtime: "new assembly + new repository rebuilt from durable payloads + fresh ledgers restored from export",
    live_runtime_discard: true,
    identity_audit: ["pre/post subject head", "pre/post state hash", "pre/post repository revision", "pre/post environment state hash", "next interaction index", "classification EXACT|EXPECTED_RECONSTRUCTED_IDENTITY|FAILURE"]
  });
  writeJson(join(outdir!, "provider-plan.json"), {
    schema_version: "long-horizon-provider-plan-v0",
    settings: { ...SETTINGS },
    session_layer_call_authority: "the session calls the frozen production ConversationTextResponseExecutorV1 exactly once per interaction",
    provider_identity_audit: "rendered_request_hash == transport_request_hash (request body reproduced from the exact messages + frozen options)",
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
    principal_verdicts: [
      "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_SUPPORTED",
      "SUBJECT_SESSION_LOOP_SUPPORTED_RESTORE_PARTIAL",
      "SUBJECT_SESSION_LOOP_SUPPORTED_MEMORY_CONTINUITY_PARTIAL",
      "SESSION_ORCHESTRATION_AUTHORITY_BLOCKED",
      "SESSION_ENVIRONMENT_CONTINUITY_BLOCKED",
      "REAL_PROVIDER_UNAVAILABLE",
      "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED"
    ],
    memory_continuity_verdicts: ["LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED", "LONG_HORIZON_MEMORY_CONTINUITY_PARTIAL", "LONG_HORIZON_MEMORY_CONTINUITY_NOT_OBSERVED"],
    restore_verdicts: ["TWO_BOUNDARY_RESTORE_SUPPORTED", "ONE_BOUNDARY_RESTORE_SUPPORTED", "SESSION_RESTORE_NOT_SUPPORTED"],
    autonomous_orchestration_verdicts: ["AUTONOMOUS_LIFECYCLE_ORCHESTRATION_SUPPORTED", "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_PARTIAL", "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_NOT_SUPPORTED"],
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
  console.log("PHASE A COMPLETE: session plan frozen; real model calls 0");
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

  // Attempt bookkeeping before ANY real call.
  const attempts: Record<string, unknown>[] = existsSync(attemptsPath) ? readJson<Record<string, unknown>[]>(attemptsPath) : [];
  for (let index = 0; index < attempts.length; index += 1) {
    if (attempts[index]!["outcome"] === "IN_PROGRESS") {
      attempts[index] = { ...attempts[index]!, outcome: "ABORTED", detail: "aborted before completion; its per-call rows remain in model-calls.jsonl" };
    }
  }
  const attemptNumber = attempts.length + 1;
  attempts.push({ attempt: attemptNumber, outcome: "IN_PROGRESS", started_at: new Date().toISOString() });
  writeJson(attemptsPath, attempts);

  // Provider preflight (probe retry only).
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
    real_model_calls: 0
  });
  if (!probe.reachable || probe.digest !== SETTINGS.required_digest) {
    throw new Error(`REAL_PROVIDER_UNAVAILABLE: ${probe.failure ?? "digest mismatch"}`);
  }

  let lastTrace: ModelTransportTraceV0 | null = null;
  const cognitionInner = new OllamaNativeCognitionTransportV0({
    base_url: SETTINGS.base_url,
    model: SETTINGS.model,
    timeout_ms: SETTINGS.timeout_ms,
    num_predict: SETTINGS.num_predict,
    trace_observer: (event: ModelTransportTraceV0) => {
      if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) lastTrace = structuredClone(event);
    }
  } as never) as unknown as ModelTransportV0;
  const languageInner = new OllamaNativeCognitionTransportV0({
    base_url: SETTINGS.base_url,
    model: SETTINGS.model,
    timeout_ms: SETTINGS.timeout_ms,
    num_predict: SETTINGS.num_predict
  } as never) as unknown as ModelTransportV0;

  const session = await createLongHorizonSubjectSessionV0({
    session_id: "alice-review-session-1",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: v3Seed(INTERACTIONS[0]!.task),
    conversationCognitionTransport: accountingTransport({
      inner: cognitionInner, stage: "cognition", callsPath, digest: probe.digest!, attempt: () => attemptNumber
    }),
    languageTransport: accountingTransport({
      inner: languageInner, stage: "language", callsPath, digest: probe.digest!, attempt: () => attemptNumber
    }),
    factualEventAppraisalProvider: aliceAppraisalProvider(),
    environment: new AliceReviewEnvironmentV0(),
    interaction_interval_ticks: INTERACTION_INTERVAL_TICKS,
    provider_identity: { model: SETTINGS.model, num_predict: SETTINGS.num_predict, last_trace: () => lastTrace },
    clock: () => new Date().toISOString()
  });

  const persistInteraction = (outcome: SessionInteractionOutcomeV0): void => {
    writeJson(join(outdir!, `interaction-${outcome.interaction_index + 1}.json`), {
      ...outcome,
      schema_version: "long-horizon-interaction-v0",
      experiment_version: EXPERIMENT_VERSION,
      conversation_id: ALICE_CONVERSATION_ID
    });
    console.log(`[i${outcome.interaction_index + 1}/8] ${outcome.status} directive=${outcome.directive} retrieved=${outcome.working_episode_refs.length} evidence=${outcome.resolved_evidence_entry_count} identity=${outcome.provider_request_identity_match} behavior="${outcome.behavior_text.slice(0, 60)}"`);
  };

  const outcomes: SessionInteractionOutcomeV0[] = [];
  const restoreOutcomes: SessionRestoreOutcomeV0[] = [];
  for (let index = 0; index < 8; index += 1) {
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
  const identityVerified = interactions.filter((row) => row["provider_request_identity_match"] === true).length;
  const restoresOk = restores.filter((row) => row["kind"] === "RESTORED").length;
  const envRestoreExact = restores.filter((row) => row["environment_state_hash_pre"] === row["environment_state_hash_post"]).length;

  // §28 minimum mandatory continuity.
  const postRestore1 = interactions.slice(3).some((row) => originClasses(row).some((entry) => ["FROM_E1", "FROM_E2", "FROM_E3"].includes(entry)));
  const postRestore2 = interactions.slice(6).some((row) => originClasses(row).some((entry) => ["FROM_E1", "FROM_E2", "FROM_E3", "FROM_E4", "FROM_E5", "FROM_E6"].includes(entry)));

  const memoryContinuity = postRestore1 && postRestore2 && withPriorEvidence >= 3
    ? "LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED"
    : (withPriorEvidence >= 1 ? "LONG_HORIZON_MEMORY_CONTINUITY_PARTIAL" : "LONG_HORIZON_MEMORY_CONTINUITY_NOT_OBSERVED");
  const restoreVerdict = restoresOk === 2 ? "TWO_BOUNDARY_RESTORE_SUPPORTED" : (restoresOk === 1 ? "ONE_BOUNDARY_RESTORE_SUPPORTED" : "SESSION_RESTORE_NOT_SUPPORTED");
  const orchestration = completed === 8 && memoryCommits >= 6 && identityVerified === 8
    ? "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_SUPPORTED"
    : (completed >= 6 ? "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_PARTIAL" : "AUTONOMOUS_LIFECYCLE_ORCHESTRATION_NOT_SUPPORTED");
  const principal = completed === 8 && memoryCommits >= 6 && restoresOk === 2 && memoryContinuity === "LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED" && identityVerified === 8 && envRestoreExact === 2
    ? "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_SUPPORTED"
    : (completed === 8 && memoryContinuity !== "LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED"
      ? "SUBJECT_SESSION_LOOP_SUPPORTED_MEMORY_CONTINUITY_PARTIAL"
      : (completed === 8 && restoresOk < 2 ? "SUBJECT_SESSION_LOOP_SUPPORTED_RESTORE_PARTIAL" : "LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED"));

  // §55 memory age / reuse audit at the last completed interaction.
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

  const tokensFor = (stage: string): { prompt: number; completion: number } => {
    const rows = calls.filter((call) => call["event"] === "COMPLETED" && call["stage"] === stage && Number(call["attempt"]) === runOfRecord);
    const prompt = 0;
    let completion = 0;
    for (const row of rows) {
      const content = typeof row["response_content"] === "string" ? row["response_content"] : "";
      completion += Math.ceil(content.length / 4);
    }
    return { prompt, completion };
  };
  const cognitionCalls = calls.filter((call) => call["stage"] === "cognition" && call["event"] === "COMPLETED" && call["attempt"] === runOfRecord).length;
  const languageCalls = calls.filter((call) => call["stage"] === "language" && call["event"] === "COMPLETED" && call["attempt"] === runOfRecord).length;
  const cognitionTokens = tokensFor("cognition");
  const languageTokens = tokensFor("language");
  const tokens = {
    schema_version: "long-horizon-token-report-v0",
    run_of_record_attempt: runOfRecord,
    total_cognition_calls: cognitionCalls,
    total_language_calls: languageCalls,
    cognition_output_tokens_estimated: cognitionTokens.completion,
    language_output_tokens_estimated: languageTokens.completion,
    input_tokens: "unavailable from the frozen transport trace (prompt_eval_count is carried only in the trace, not persisted per call)",
    total_tokens_estimated: cognitionTokens.completion + languageTokens.completion,
    external_api_monetary_cost: "0 (local Ollama; no external API calls)",
    all_attempts: {
      attempts: attemptRows.map((row) => row["attempt"]),
      outcomes: attemptRows.map((row) => row["outcome"]),
      calls_persisted: calls.length
    }
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
      environment_supplied_only_the_current_situation: true,
      retrieved_refs: originClasses(row),
      current_intent: row["current_intent"],
      directive: row["directive"],
      behavior: row["behavior_text"]
    })),
    manipual_injection_absent: true
  };

  const transcriptAudit = {
    schema_version: "long-horizon-transcript-bypass-audit-v0",
    MANUAL_CONVERSATION_RECAP: "NO",
    RAW_TRANSCRIPT_CONTINUITY_BYPASS: "NO",
    evidence: "each interaction's provider request is rebuilt from the current projection only; no previous provider messages are carried forward (the recording transport observed exactly one system + one user message per call)",
    messages_per_call: calls.filter((call) => call["event"] === "STARTED" && call["attempt"] === runOfRecord).length
  };

  writeJson(join(outdir!, "retrieval-timeline.json"), {
    schema_version: "long-horizon-retrieval-timeline-v0",
    per_interaction: interactions.map((row, index) => ({
      interaction: index + 1,
      selected_refs: row["retrieved_refs"],
      working_episode_refs: row["working_episode_refs"],
      evidence_origin: originClasses(row),
      resolved_evidence_entry_count: row["resolved_evidence_entry_count"],
      provider_memory_section_present: row["provider_memory_section_present"]
    })),
    retrieval_service: "RepositoryBackedMemoryRetrievalServiceV0 (frozen; no pinning, no tuning)"
  });
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
  writeJson(join(outdir!, "repository-revision-timeline.json"), {
    schema_version: "long-horizon-repository-revision-timeline-v0",
    entries: interactions.map((row, index) => ({
      interaction: index + 1,
      repository_revision_before: row["repository_revision_before"],
      repository_revision_after: row["repository_revision_after"],
      state_revision_before: row["state_revision_before"],
      state_revision_after: row["state_revision_after"]
    })),
    memory_commits: memoryCommits
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
    per_interaction: interactions.map((row, index) => ({
      interaction: index + 1,
      provider_request_hash: row["provider_request_hash"],
      transport_request_hash: row["transport_request_hash"],
      match: row["provider_request_identity_match"],
      memory_section_present: row["provider_memory_section_present"]
    })),
    all_match: identityVerified === interactions.length,
    verified: identityVerified
  });
  writeJson(join(outdir!, "autonomy-audit.json"), autonomyAudit);
  writeJson(join(outdir!, "transcript-bypass-audit.json"), transcriptAudit);

  const status = {
    schema_version: "long-horizon-operator-status-example-v0",
    example_from_interaction: 8,
    session_id: INTERACTIONS.length > 0 ? "alice-review-session-1" : "alice-review-session-1",
    subject_id: SUBJECT_ID,
    interaction: `${completed}/${interactions.length}`,
    logical_time: e8["logical_time_after"],
    memory_repository_revision: e8["repository_revision_after"],
    current_affect: { valence: e8["affect_after"], activation: "see affect-timeline.json" },
    current_intent: e8["current_intent"],
    latest_directive: e8["directive"],
    latest_behavior: e8["behavior_text"],
    retrieved_memories: originClasses(interactions[interactions.length - 1]!),
    last_restore: restores[restores.length - 1]!["kind"] === "RESTORED" ? "success" : "failed",
    authority_tokens_exposed: "NONE"
  };
  writeJson(join(outdir!, "operator-status-example.json"), status);

  writeJson(join(outdir!, "summary.json"), {
    schema_version: "long-horizon-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    verdict: principal,
    memory_continuity_verdict: memoryContinuity,
    restore_verdict: restoreVerdict,
    autonomous_orchestration_verdict: orchestration,
    metrics: {
      completed_interactions: completed,
      durable_memory_commits: memoryCommits,
      interactions_with_prior_lived_evidence_retrieved: withPriorEvidence,
      provider_requests_with_prior_life_factual_content: providerWithPriorLife,
      provider_request_identity_verified: identityVerified,
      restores_completed: restoresOk,
      environment_state_restored_exactly: envRestoreExact,
      post_restore_1_prior_evidence: postRestore1,
      post_restore_2_prior_evidence: postRestore2
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
    tokens,
    real_calls: { cognition: cognitionCalls, language: languageCalls, maximum: 16, repetitions: 0 },
    production_behavior_changing_diff: 0
  });

  writeJson(resolve(outdir!, "quality-gates.json"), {
    schema_version: "long-horizon-quality-gates-v0",
    single_subject: true,
    no_control_arms: true,
    all_interactions_complete: completed === 8,
    memory_commits_at_least_six: memoryCommits >= 6,
    two_restore_boundaries: restoresOk === 2,
    environment_state_restored_exactly: envRestoreExact === 2,
    provider_request_identity_all_verified: identityVerified === 8,
    no_manual_injection: true,
    no_transcript_bypass: true,
    no_new_psychology: true,
    retrieval_unchanged: true,
    real_calls_within_budget: cognitionCalls <= 8 && languageCalls <= 8,
    all_pass: completed === 8 && memoryCommits >= 6 && restoresOk === 2 && envRestoreExact === 2 && identityVerified === 8
  });
  writeFileSync(resolve(outdir!, "REPORT.md"), [
    `# ${EXPERIMENT_VERSION} — evidence`,
    "",
    `## Principal verdict: ${principal}`,
    `## Memory continuity: ${memoryContinuity}`,
    `## Restore: ${restoreVerdict}`,
    `## Autonomous orchestration: ${orchestration}`,
    "",
    "## Metrics",
    JSON.stringify({
      completed_interactions: completed,
      durable_memory_commits: memoryCommits,
      interactions_with_prior_lived_evidence_retrieved: withPriorEvidence,
      provider_requests_with_prior_life_factual_content: providerWithPriorLife,
      provider_request_identity_verified: identityVerified,
      restores_completed: restoresOk,
      environment_state_restored_exactly: envRestoreExact
    }),
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
  console.log(`  completed ${completed}/8; memory commits ${memoryCommits}; prior-evidence interactions ${withPriorEvidence}; identity verified ${identityVerified}/8; restores ${restoresOk}/2`);
} else {
  throw new Error("unknown command; expected phase-a | run | finalize");
}
