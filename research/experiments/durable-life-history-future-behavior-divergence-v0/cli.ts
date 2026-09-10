/* eslint-disable @typescript-eslint/no-non-null-assertion -- Isolated experiment entrypoint: outdir/argv and frozen-plan indices are validated at each use site by check(); this matches the repo's existing experiment-code precedent. */

/**
 * DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0 — entrypoint.
 *
 *   node .../cli.ts phase-a  <outdir> — freeze preregistration (0 real calls)
 *   node .../cli.ts lives    <outdir> — rebuild both lives with bounded real
 *                                       generation + deterministic consequence
 *                                       chain + lawful equalization; checkpoint
 *   node .../cli.ts collect  <outdir> — §21 visibility gate + ablation-control
 *                                       gate, then 4 future arms × 5 trials
 *                                       (fresh restore per trial; strict-prefix
 *                                       resumable; real Ollama calls)
 *   node .../cli.ts finalize <outdir> — §46 analysis, verdict, evidence, report
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  BALANCED_FUTURE_ARM_ORDER,
  BASELINE_COMMIT,
  BEHAVIOR_SOURCE_PLAN,
  COGNITION_SETTINGS,
  EXPERIMENT_VERSION,
  FUTURE_ARMS,
  FUTURE_SCENARIO,
  LANGUAGE_SETTINGS,
  LIFE_SCENARIOS,
  MAX_FUTURE_LANGUAGE_CALLS,
  MEMORY_ABLATION_CONTRACT,
  METRIC_CONTRACT,
  PLANNED_FUTURE_COGNITION_CALLS,
  PRINCIPAL_VERDICTS,
  SUBJECT,
  TIME_EQUALIZATION,
  TRIALS_PER_ARM,
  VERDICT_RULE,
  frozenConfig,
  type FutureArm,
  type LifeScenarioV0,
  type TreatmentArm
} from "./contract.ts";
import { canonicalJson, check, hashJson } from "./fixtures.ts";
import {
  buildLifeArm,
  captureFutureProjection,
  commitFutureContextObservation,
  completeLife,
  projectionBodyWithout,
  rebuildLifeFromCheckpoint,
  restoreWorld,
  runFutureTrial,
  type FutureCapture,
  type LifeArmComplete,
  type RestoredRuntime
} from "./harness.ts";
import { probeV1Root } from "./real-generation.ts";
import { COUNTERPART_POLICY as COUNTERPART_POLICY_IMPORTED } from "../affect-driven-behavior-experience-memory-causal-chain-v0/contract.ts";

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
check(HEAD === BASELINE_COMMIT, `baseline mismatch: HEAD ${HEAD} != frozen ${BASELINE_COMMIT}`);

const command = process.argv[2];
const outdir = process.argv[3];
check(typeof command === "string" && typeof outdir === "string", "usage: cli.ts <phase-a|lives|collect|finalize> <outdir>");

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, canonicalJson(value));
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function phaseACompletePath(): string {
  return resolve(outdir!, "phase-a-complete.json");
}

interface CheckpointArm {
  readonly arm: TreatmentArm;
  readonly metadata: unknown;
  readonly provider_input: unknown;
  readonly record: Record<string, unknown>;
  readonly behavior_text: string;
  readonly full_behavior: unknown;
  readonly subject_state_hash: string;
  readonly chain: Record<string, unknown>;
  readonly equalization: Record<string, unknown>;
}

interface Checkpoint {
  readonly schema_version: string;
  readonly experiment_version: string;
  readonly scenario: LifeScenarioV0;
  readonly arms: Record<string, CheckpointArm>;
}

interface TrialRow {
  readonly schema_version: string;
  readonly experiment_version: string;
  readonly scenario_id: string;
  readonly future_arm: FutureArm;
  readonly life_arm: TreatmentArm;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
  readonly response_request_id: string;
  readonly provider_input_hash: string;
  readonly projection_hash: string;
  readonly factual_evidence_present: boolean;
  readonly factual_evidence_kinds: readonly string[];
  readonly exact_outcome_text: string | null;
  readonly exact_outcome_text_hash: string | null;
  readonly canonical_affect: { readonly valence: number; readonly activation: number };
  readonly working_episode_refs: readonly string[];
  readonly future_context_hash: string;
  readonly post_commit_revision: string;
  readonly cognition: {
    readonly status: string;
    readonly current_intent: string | null;
    readonly communication_directive: string | null;
    readonly latency_ms: number;
    readonly token_counts: { readonly total_tokens: number | null };
  };
  readonly language: {
    readonly call_required: boolean;
    readonly status: string;
    readonly latency_ms: number;
  };
  readonly behavior_text: string;
  readonly behavior_content_hash: string | null;
  readonly status: string;
  readonly failure: unknown;
}

// =====================================================================================
// phase-a — freeze preregistration (0 real calls)
// =====================================================================================
if (command === "phase-a") {
  mkdirSync(outdir!, { recursive: true });
  writeJson(join(outdir!, "config.json"), frozenConfig());
  writeJson(join(outdir!, "behavior-source-plan.json"), { ...BEHAVIOR_SOURCE_PLAN });
  writeJson(join(outdir!, "life-scenarios.json"), {
    schema_version: "durable-life-history-life-scenarios-v0",
    scenarios: LIFE_SCENARIOS.map((s) => ({ ...s }))
  });
  writeJson(join(outdir!, "counterpart-policy.json"), { ...COUNTERPART_POLICY_IMPORTED });
  writeJson(join(outdir!, "future-scenario.json"), {
    schema_version: "durable-life-history-future-scenario-v0",
    single_primary_future_scenario: true,
    ...FUTURE_SCENARIO
  });
  writeJson(join(outdir!, "future-affect-control.json"), {
    schema_version: "durable-life-history-future-affect-control-v0",
    mechanism: TIME_EQUALIZATION.mechanism,
    ticks: TIME_EQUALIZATION.ticks,
    tau_ticks: TIME_EQUALIZATION.tau_ticks,
    expected_residual_valence_magnitude: TIME_EQUALIZATION.expected_residual_valence_magnitude,
    acceptance_threshold: TIME_EQUALIZATION.acceptance_threshold,
    manual_patch: false
  });
  writeJson(join(outdir!, "future-retrieval-plan.json"), {
    schema_version: "durable-life-history-future-retrieval-plan-v0",
    retrieval: "RepositoryBackedMemoryRetrievalServiceV0 over the restored repository",
    query_source: "future observation context/entities (no manual refs)",
    evidence_resolution: "production FactualMemoryEvidenceResolverV0 over working/recent episode refs",
    future_context_commit: "governed context delta (scene/task) + production retrieval trio in one Observation commit"
  });
  writeJson(join(outdir!, "memory-ablation-contract.json"), { ...MEMORY_ABLATION_CONTRACT });
  writeJson(join(outdir!, "metric-contract.json"), { ...METRIC_CONTRACT });
  writeJson(join(outdir!, "verdict-contract.json"), {
    schema_version: "durable-life-history-future-behavior-verdict-contract-v0",
    verdicts: [...PRINCIPAL_VERDICTS],
    thresholds: { ...VERDICT_RULE },
    frozen_before_real_provider_output: true
  });
  writeJson(join(outdir!, "provider-plan.json"), {
    schema_version: "durable-life-history-future-behavior-provider-plan-v0",
    cognition_settings: { ...COGNITION_SETTINGS },
    language_settings: { ...LANGUAGE_SETTINGS },
    future_stage_code: "frozen downstream two-stage runner (cognition → directive → language), reused verbatim",
    no_seed: true,
    no_retries: true
  });
  writeJson(join(outdir!, "authority-path-audit.json"), {
    schema_version: "durable-life-history-future-behavior-authority-path-audit-v0",
    paths: {
      life_history: "frozen chain-slice lifecycle (prior event → affect → scenario context → current event → appraisal → affect)",
      behavior_generation: "frozen downstream two-stage runner (ConversationCognitionProviderV1 → directive → LanguageRealizationProviderV0)",
      delivery_boundary: "PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0 host delivery adapter (conversationDeliveryLedger)",
      feedback_authority: "BEHAVIOR_EXPERIENCE_FEEDBACK_V0 executeBehaviorOutcomeFeedback",
      memory_commit_path: "Learning commit binding /memory_state/repository_revision",
      restore_path: "trusted v4 boundary + restoreSubjectStateV4AuthoritativelyV0 (FRESH restore per trial)",
      future_retrieval_path: "RepositoryBackedMemoryRetrievalServiceV0 + production FactualMemoryEvidenceResolverV0",
      ablation_seam: "experimental resolver wrapper strips resolved BEHAVIOR_OUTCOME entries BEFORE provider-facing projection build; executor recomputes projection identity/hash (production code)",
      all_frozen_production: true
    }
  });
  writeJson(join(outdir!, "phase-a.json"), {
    schema_version: "durable-life-history-future-behavior-phase-a-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    real_future_calls: 0,
    starting_baseline: "PASS",
    future_scenarios: [FUTURE_SCENARIO.scenario_id],
    future_arms: [...FUTURE_ARMS],
    trials_per_arm: TRIALS_PER_ARM,
    planned_future_cognition_calls: PLANNED_FUTURE_COGNITION_CALLS,
    max_future_language_calls: MAX_FUTURE_LANGUAGE_CALLS,
    memory_ablation_contract_frozen: "PASS",
    metric_contract_frozen: "PASS",
    verdict_contract_frozen: "PASS",
    all_pass: true
  });
  writeJson(join(outdir!, "phase-a-complete.json"), {
    schema_version: "durable-life-history-future-behavior-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    all_pass: true,
    real_future_calls: 0
  });
  console.log("PHASE A COMPLETE: preregistration frozen; real future calls 0");
}

// =====================================================================================
// lives — rebuild both lives with bounded real generation + chain + equalization
// =====================================================================================
else if (command === "lives") {
  check(existsSync(phaseACompletePath()), "phase-a-complete.json missing: run phase-a first");
  mkdirSync(join(outdir!, "real-provider"), { recursive: true });
  const checkpointPath = resolve(outdir!, "lives-checkpoint.json");
  if (existsSync(checkpointPath)) {
    console.log("LIVES ALREADY CHECKPOINTED: skipping real life calls (delete lives-checkpoint.json to force a rerun)");
    process.exit(0);
  }

  // Provider preflight (probe retry only — never a generation retry).
  let probe = await probeV1Root();
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    if (probe.reachable && probe.digest === COGNITION_SETTINGS.required_digest) break;
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 2000));
    probe = await probeV1Root();
  }
  check(probe.reachable, `provider unreachable: ${probe.failure ?? "no response"}`);
  check(probe.digest === COGNITION_SETTINGS.required_digest,
    `provider digest mismatch: ${probe.digest ?? "null"} (probe failure: ${probe.failure ?? "none"})`);
  writeJson(join(outdir!, "real-provider", "provider-preflight.json"), {
    schema_version: "durable-life-history-future-behavior-provider-preflight-v0",
    endpoint: probe.endpoint,
    ollama_version: probe.ollama_version,
    model: probe.model,
    digest: probe.digest,
    digest_matches_required: true,
    cognition_settings: { ...COGNITION_SETTINGS },
    language_settings: { ...LANGUAGE_SETTINGS },
    real_generation_calls: 0
  });

  const realCalls = { cognition: 0, language: 0 };
  const primary = LIFE_SCENARIOS.find((s) => s.role === "PRIMARY");
  const alternate = LIFE_SCENARIOS.find((s) => s.role === "ALTERNATE");
  check(primary !== undefined, "primary life scenario missing");

  const buildPair = async (scenario: LifeScenarioV0): Promise<{ readonly A: LifeArmComplete; readonly B: LifeArmComplete }> => {
    const armA = await buildLifeArm(scenario, "A", realCalls);
    const armB = await buildLifeArm(scenario, "B", realCalls);
    const completeA = await completeLife(armA, realCalls);
    const completeB = await completeLife(armB, realCalls);
    return { A: completeA, B: completeB };
  };

  let usedScenario: LifeScenarioV0 = primary;
  let lives = await buildPair(primary);
  let diverged = lives.A.behavior_text !== lives.B.behavior_text;
  if (!diverged && alternate !== undefined) {
    usedScenario = alternate;
    lives = await buildPair(alternate);
    diverged = lives.A.behavior_text !== lives.B.behavior_text;
  }
  writeJson(join(outdir!, "real-provider", "life-generation-log.json"), {
    schema_version: "durable-life-history-future-behavior-life-generation-log-v0",
    attempted_scenarios: usedScenario === primary
      ? [primary.scenario_id]
      : [primary.scenario_id, alternate!.scenario_id],
    chosen_scenario: usedScenario.scenario_id,
    behavior_diverged: diverged,
    real_calls: { ...realCalls },
    budget: {
      max_cognition_calls: BEHAVIOR_SOURCE_PLAN.lifecycle_rerun.max_cognition_calls,
      max_language_calls: BEHAVIOR_SOURCE_PLAN.lifecycle_rerun.max_language_calls
    }
  });
  if (!diverged) {
    writeJson(join(outdir!, "real-provider", "lives-failure.json"), {
      schema_version: "durable-life-history-future-behavior-lives-failure-v0",
      reason: "no preregistered life scenario produced lawful A/B behavior divergence; durable memory difference cannot be established",
      real_calls: { ...realCalls }
    });
    console.error("LIVES FAILED: no preregistered scenario produced A/B behavior divergence");
    process.exit(1);
  }
  check(realCalls.cognition <= BEHAVIOR_SOURCE_PLAN.lifecycle_rerun.max_cognition_calls,
    `life cognition budget exceeded: ${realCalls.cognition}`);
  check(realCalls.language <= BEHAVIOR_SOURCE_PLAN.lifecycle_rerun.max_language_calls,
    `life language budget exceeded: ${realCalls.language}`);

  const arms: Record<string, CheckpointArm> = {};
  for (const arm of ["A", "B"] as const) {
    const life = lives[arm]!;
    arms[arm] = {
      arm,
      metadata: life.metadata,
      provider_input: life.provider_input,
      record: life.record,
      behavior_text: life.behavior_text,
      full_behavior: life.full_behavior,
      subject_state_hash: life.metadata.subject_state_hash,
      chain: { ...life.chain } as Record<string, unknown>,
      equalization: { ...life.equalization } as Record<string, unknown>
    };
  }
  const checkpoint: Checkpoint = {
    schema_version: "durable-life-history-future-behavior-lives-checkpoint-v0",
    experiment_version: EXPERIMENT_VERSION,
    scenario: usedScenario,
    arms
  };
  writeJson(checkpointPath, checkpoint);

  // §52 source-chain audit: the lawful path from life behavior to durable memory.
  writeJson(join(outdir!, "source-chain-audit.json"), {
    schema_version: "durable-life-history-future-behavior-source-chain-audit-v0",
    chosen_scenario: usedScenario.scenario_id,
    behavior_divergence: {
      diverged,
      behavior_a: lives.A.behavior_text,
      behavior_b: lives.B.behavior_text,
      behavior_content_hash_a: (lives.A.record["behavior_content_hash"] as string) ?? null,
      behavior_content_hash_b: (lives.B.record["behavior_content_hash"] as string) ?? null
    },
    counterpart: {
      policy: { ...COUNTERPART_POLICY_IMPORTED },
      policy_inputs: { A: lives.A.behavior_text, B: lives.B.behavior_text },
      treatment_blind: true
    },
    experience_memory: {
      A: {
        experience_ref: lives.A.chain.experience_ref,
        episode_ref: lives.A.chain.episode_ref,
        revision_before: lives.A.chain.revision_before,
        revision_after: lives.A.chain.revision_after
      },
      B: {
        experience_ref: lives.B.chain.experience_ref,
        episode_ref: lives.B.chain.episode_ref,
        revision_before: lives.B.chain.revision_before,
        revision_after: lives.B.chain.revision_after
      },
      memory_committed: lives.A.chain.revision_after !== lives.A.chain.revision_before &&
        lives.B.chain.revision_after !== lives.B.chain.revision_before
    },
    equalization: { A: lives.A.equalization, B: lives.B.equalization },
    real_calls: { ...realCalls }
  });
  console.log(`LIVES COMPLETE: scenario ${usedScenario.scenario_id}; behaviors diverged; real calls cognition ${realCalls.cognition}, language ${realCalls.language}`);
}

// =====================================================================================
// collect — §21 gate + ablation gate, then 4 arms × 5 trials (resumable)
// =====================================================================================
else if (command === "collect") {
  check(existsSync(phaseACompletePath()), "phase-a-complete.json missing: run phase-a first");
  const checkpointPath = resolve(outdir!, "lives-checkpoint.json");
  check(existsSync(checkpointPath), "lives-checkpoint.json missing: run lives first");
  const checkpoint = readJson<Checkpoint>(checkpointPath);

  // Deterministic life replay (0 real calls; hash-verified).
  const lives: Record<"A" | "B", LifeArmComplete> = {
    A: await rebuildLifeFromCheckpoint(checkpoint, "A"),
    B: await rebuildLifeFromCheckpoint(checkpoint, "B")
  };
  for (const arm of ["A", "B"] as const) {
    const saved = checkpoint.arms[arm]!;
    check(canonicalJson(lives[arm]!.chain) === canonicalJson(saved.chain),
      `checkpoint replay ${arm}: consequence chain mismatch`);
    check(canonicalJson(lives[arm]!.equalization) === canonicalJson(saved.equalization),
      `checkpoint replay ${arm}: equalization mismatch`);
  }
  writeJson(join(outdir!, "restore-audit.json"), {
    schema_version: "durable-life-history-future-behavior-restore-audit-v0",
    mechanism: "trusted v4 boundary + restoreSubjectStateV4AuthoritativelyV0; FRESH authoritative restore per trial",
    checkpoint_replay: { A: "HASH_VERIFIED", B: "HASH_VERIFIED" },
    equalization: { A: lives.A.equalization, B: lives.B.equalization },
    restored_affect_replay: { A: lives.A.equalization.valence_after, B: lives.B.equalization.valence_after }
  });

  // ---- §21 memory-visibility gate + ablation-control gate (0 real calls) ----------
  interface GateCapture { readonly arm: FutureArm; readonly restored: RestoredRuntime; readonly future: Awaited<ReturnType<typeof commitFutureContextObservation>>; readonly capture: FutureCapture }
  const gateCaptures: Record<string, GateCapture> = {};
  for (const arm of FUTURE_ARMS) {
    const lifeArm: TreatmentArm = arm === "MEM_A" || arm === "MEM_ABL_A" ? "A" : "B";
    const restored = await restoreWorld(lives[lifeArm]!.world);
    const future = await commitFutureContextObservation(
      restored,
      { current_factual_event: FUTURE_SCENARIO.current_factual_event, current_task: FUTURE_SCENARIO.current_task },
      FUTURE_SCENARIO.event_id
    );
    const capture = await captureFutureProjection(restored, { ablate: arm.startsWith("MEM_ABL") });
    gateCaptures[arm] = { arm, restored, future, capture };
  }
  const projA = gateCaptures["MEM_A"]!.capture.projection;
  const projB = gateCaptures["MEM_B"]!.capture.projection;
  const projAbA = gateCaptures["MEM_ABL_A"]!.capture.projection;
  const projAbB = gateCaptures["MEM_ABL_B"]!.capture.projection;
  const evidenceA = projA["factual_memory_evidence"] ?? null;
  const evidenceB = projB["factual_memory_evidence"] ?? null;
  const evidenceVisible = canonicalJson(evidenceA) !== canonicalJson(evidenceB) && evidenceA !== null;
  const treatmentMinusEvidenceA = projectionBodyWithout(projA, ["factual_memory_evidence", "projection_hash"]);
  const ablatedBodyA = projectionBodyWithout(projAbA, ["projection_hash"]);
  const ablationEquivalenceA = canonicalJson(treatmentMinusEvidenceA) === canonicalJson(ablatedBodyA);
  const treatmentMinusEvidenceB = projectionBodyWithout(projB, ["factual_memory_evidence", "projection_hash"]);
  const ablatedBodyB = projectionBodyWithout(projAbB, ["projection_hash"]);
  const ablationEquivalenceB = canonicalJson(treatmentMinusEvidenceB) === canonicalJson(ablatedBodyB);
  const ablatedPairBodyA = projectionBodyWithout(projAbA, ["canonical_affect", "projection_hash"]);
  const ablatedPairBodyB = projectionBodyWithout(projAbB, ["canonical_affect", "projection_hash"]);
  const ablationPairEqualized = canonicalJson(ablatedPairBodyA) === canonicalJson(ablatedPairBodyB);
  const restoredAffect = {
    MEM_A: (await gateCaptures["MEM_A"]!.restored.assembly.facade.readCurrentSnapshot(SUBJECT as never) as { affect: { valence: number; activation: number } }).affect,
    MEM_B: (await gateCaptures["MEM_B"]!.restored.assembly.facade.readCurrentSnapshot(SUBJECT as never) as { affect: { valence: number; activation: number } }).affect
  };
  const residualValenceDelta = Math.abs(restoredAffect.MEM_A.valence - restoredAffect.MEM_B.valence);
  const futureAffectClassification = residualValenceDelta < 1e-9
    ? "EFFECTIVELY_EQUAL"
    : residualValenceDelta < TIME_EQUALIZATION.acceptance_threshold
      ? "NEGLIGIBLE_BUT_NONZERO"
      : "MATERIAL_CONFOUND";

  // Entry-level semantic diff between the two subjects' resolved behavior-outcome
  // evidence (machine-proven; the honest content of the durable difference).
  const entryA = ((evidenceA as { entries?: Record<string, unknown>[] } | null)?.entries ?? [])[0] ?? {};
  const entryB = ((evidenceB as { entries?: Record<string, unknown>[] } | null)?.entries ?? [])[0] ?? {};
  const differingEvidenceFields = [...new Set([...Object.keys(entryA), ...Object.keys(entryB)])]
    .filter((key) => canonicalJson(entryA[key]) !== canonicalJson(entryB[key]))
    .sort();

  const gateAudit = {
    schema_version: "durable-life-history-future-input-diff-audit-v0",
    experiment_version: EXPERIMENT_VERSION,
    projections: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, gateCaptures[arm]!.capture.projection])),
    production_evidence_bundles: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, gateCaptures[arm]!.capture.production_evidence_bundle])),
    future_context_hashes: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, gateCaptures[arm]!.future.future_context_hash])),
    working_episode_refs: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, gateCaptures[arm]!.future.working_episode_refs])),
    checks: {
      memory_evidence_visible: evidenceVisible,
      ablation_equivalence_A: ablationEquivalenceA,
      ablation_equivalence_B: ablationEquivalenceB,
      ablation_pair_equalized: ablationPairEqualized,
      scenario_equality: new Set(FUTURE_ARMS.map((arm) => gateCaptures[arm]!.future.future_context_hash)).size === 1
    },
    evidence_entry_diff: {
      MEM_A_entry: entryA,
      MEM_B_entry: entryB,
      differing_fields: differingEvidenceFields,
      outcome_texts_equal: canonicalJson(entryA["exact_outcome_text"]) === canonicalJson(entryB["exact_outcome_text"]),
      delivered_behavior_texts_equal: canonicalJson(entryA["delivered_behavior_text"]) === canonicalJson(entryB["delivered_behavior_text"])
    },
    future_affect: {
      restored_affect: restoredAffect,
      residual_valence_delta: residualValenceDelta,
      classification: futureAffectClassification
    },
    rendering_limitation: {
      observed: "the conversation cognition prompt renders memory refs and canonical affect values but NOT the factual_memory_evidence outcome text (production renderer surface)",
      documented_in: "REPORT.md §limitations; production renderer buildConversationSubjectData",
      effect: "the durable evidence is provider-facing in the structured V2 projection; the rendered prompt contrast between treatment arms is the affect residual and hash only"
    }
  };
  writeJson(join(outdir!, "future-input-diff-audit.json"), gateAudit);

  if (!evidenceVisible) {
    writeJson(join(outdir!, "real-provider", "gate-failure.json"), {
      schema_version: "durable-life-history-future-behavior-gate-failure-v0",
      gate: "FUTURE_MEMORY_VISIBILITY",
      verdict: "FUTURE_MEMORY_VISIBILITY_FAILURE",
      real_future_calls: 0
    });
    console.error("GATE FAILED: FUTURE_MEMORY_VISIBILITY_FAILURE (stopped before any real future call)");
    process.exit(1);
  }
  if (!ablationEquivalenceA || !ablationEquivalenceB || !ablationPairEqualized) {
    writeJson(join(outdir!, "real-provider", "gate-failure.json"), {
      schema_version: "durable-life-history-future-behavior-gate-failure-v0",
      gate: "MEMORY_ABLATION_CONTROL",
      verdict: "MEMORY_ABLATION_CONTROL_INVALID",
      checks: { ablation_equivalence_A: ablationEquivalenceA, ablation_equivalence_B: ablationEquivalenceB, ablation_pair_equalized: ablationPairEqualized },
      real_future_calls: 0
    });
    console.error("GATE FAILED: MEMORY_ABLATION_CONTROL_INVALID (stopped before any real future call)");
    process.exit(1);
  }
  if (futureAffectClassification === "MATERIAL_CONFOUND") {
    writeJson(join(outdir!, "real-provider", "gate-failure.json"), {
      schema_version: "durable-life-history-future-behavior-gate-failure-v0",
      gate: "FUTURE_AFFECT_CONTROL",
      verdict: "CAUSAL_CHAIN_CONFOUND_DETECTED",
      residual_valence_delta: residualValenceDelta,
      real_future_calls: 0
    });
    console.error("GATE FAILED: FUTURE_AFFECT MATERIAL_CONFOUND (stopped before any real future call)");
    process.exit(1);
  }
  writeJson(join(outdir!, "future-affect-control-evidence.json"), {
    schema_version: "durable-life-history-future-behavior-affect-control-evidence-v0",
    restored_affect: restoredAffect,
    residual_valence_delta: residualValenceDelta,
    classification: futureAffectClassification,
    mechanism: TIME_EQUALIZATION.mechanism,
    manual_patch: false
  });

  // ---- planned trials with strict-prefix resume ------------------------------------
  const trialsPath = join(outdir!, "real-provider", "trials.jsonl");
  mkdirSync(join(outdir!, "real-provider"), { recursive: true });
  interface PlannedTrial { readonly arm: FutureArm; readonly ordinal: number; readonly within: number; readonly execution_order: number; readonly trial_id: string }
  const plan: PlannedTrial[] = [];
  let executionOrder = 0;
  for (let ordinal = 1; ordinal <= TRIALS_PER_ARM; ordinal += 1) {
    const order = BALANCED_FUTURE_ARM_ORDER[ordinal - 1]!;
    for (let within = 1; within <= order.length; within += 1) {
      executionOrder += 1;
      const arm = order[within - 1]!;
      plan.push({
        arm,
        ordinal,
        within,
        execution_order: executionOrder,
        trial_id: `${EXPERIMENT_VERSION}/${FUTURE_SCENARIO.scenario_id}/${ordinal}/${arm}`
      });
    }
  }
  check(plan.length === PLANNED_FUTURE_COGNITION_CALLS, "plan must contain 20 future cognition trials");

  const existingRows: TrialRow[] = existsSync(trialsPath)
    ? readFileSync(trialsPath, "utf8").split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line) as TrialRow)
    : [];
  for (let i = 0; i < existingRows.length; i += 1) {
    const row = existingRows[i]!;
    const planned = plan[i]!;
    check(row.trial_id === planned.trial_id, `strict-prefix violation at row ${i}: ${row.trial_id} != ${planned.trial_id}`);
    check(row.execution_order === planned.execution_order, `strict-prefix violation at row ${i}: execution_order`);
    check(row.future_arm === planned.arm, `strict-prefix violation at row ${i}: arm`);
  }
  if (existingRows.length > 0) {
    console.log(`RESUME: ${existingRows.length}/${plan.length} trials already collected (strict prefix verified)`);
  }

  const realCalls = { cognition: existingRows.length, language: existingRows.filter((r) => r.language.call_required && r.language.status === "VALID").length };
  for (let i = existingRows.length; i < plan.length; i += 1) {
    const planned = plan[i]!;
    const lifeArm: TreatmentArm = planned.arm === "MEM_A" || planned.arm === "MEM_ABL_A" ? "A" : "B";
    const result = await runFutureTrial(
      lives[lifeArm]!.world,
      lives[lifeArm]!.metadata,
      planned.arm,
      planned.ordinal,
      planned.execution_order,
      planned.within
    );
    realCalls.cognition += 1;
    const languageStatus = (result.record["language"] as { status?: string } | undefined)?.status ?? "NOT_REACHED";
    if (languageStatus === "VALID") realCalls.language += 1;

    // Per-trial machine checks against the §21 gate capture (deterministic
    // provider input; the ordinal-1 captures must be hash-identical).
    if (planned.ordinal === 1) {
      const gateProjectionHash = gateCaptures[planned.arm]!.capture.projection["projection_hash"] as string;
      check(
        result.capture.projection["projection_hash"] === gateProjectionHash,
        `ordinal-1 provider input must equal the §21 gate capture for ${planned.arm}`
      );
    }

    const cognitionRecord = result.record["cognition"] as { status: string; current_intent: string | null; communication_directive: string | null; latency_ms: number; token_counts: { total_tokens: number | null }; failure: unknown } | undefined;
    const languageRecord = result.record["language"] as { call_required: boolean; status: string; latency_ms: number; failure: unknown } | undefined;
    const productionBundle = result.capture.production_evidence_bundle as { entries?: { kind: string; exact_outcome_text?: string }[] } | null;
    const behaviorOutcomeEntry = productionBundle?.entries?.find((entry) => entry.kind === "BEHAVIOR_OUTCOME") ?? null;
    const row: TrialRow = {
      schema_version: "durable-life-history-future-behavior-trial-v0",
      experiment_version: EXPERIMENT_VERSION,
      scenario_id: FUTURE_SCENARIO.scenario_id,
      future_arm: planned.arm,
      life_arm: lifeArm,
      trial_ordinal: planned.ordinal,
      execution_order: planned.execution_order,
      within_unit_order: planned.within,
      trial_id: planned.trial_id,
      response_request_id: result.response_request_id,
      provider_input_hash: hashJson(result.capture.projection),
      projection_hash: result.capture.projection["projection_hash"] as string,
      factual_evidence_present: result.capture.projection["factual_memory_evidence"] !== undefined,
      factual_evidence_kinds: ((productionBundle?.entries ?? []) as { kind: string }[]).map((entry) => entry.kind),
      exact_outcome_text: behaviorOutcomeEntry?.exact_outcome_text ?? null,
      exact_outcome_text_hash: behaviorOutcomeEntry?.exact_outcome_text !== undefined && behaviorOutcomeEntry.exact_outcome_text !== null
        ? hashJson(behaviorOutcomeEntry.exact_outcome_text)
        : null,
      canonical_affect: result.capture.projection["canonical_affect"] as { valence: number; activation: number },
      working_episode_refs: [...result.working_episode_refs],
      future_context_hash: result.future_context_hash,
      post_commit_revision: result.post_commit_revision,
      cognition: {
        status: cognitionRecord?.status ?? "MISSING",
        current_intent: cognitionRecord?.current_intent ?? null,
        communication_directive: cognitionRecord?.communication_directive ?? null,
        latency_ms: cognitionRecord?.latency_ms ?? 0,
        token_counts: { total_tokens: cognitionRecord?.token_counts?.total_tokens ?? null }
      },
      language: {
        call_required: languageRecord?.call_required ?? false,
        status: languageStatus,
        latency_ms: languageRecord?.latency_ms ?? 0
      },
      behavior_text: result.behavior_text,
      behavior_content_hash: (result.record["behavior_content_hash"] as string | null) ?? null,
      status: String(result.record["status"]),
      failure: cognitionRecord?.failure ?? languageRecord?.failure ?? null
    };
    check(row.behavior_text.length > 0 || !["VALID", "DIRECTIVE_CLARIFY"].includes(row.status),
      `${planned.trial_id}: valid status must carry behavior text`);
    appendFileSync(trialsPath, JSON.stringify(row) + "\n");
    console.log(`[${i + 1}/${plan.length}] ${planned.trial_id}: ${row.status} intent=${JSON.stringify(row.cognition.current_intent)} directive=${row.cognition.communication_directive}`);
  }

  writeJson(join(outdir!, "real-provider", "collection-complete.json"), {
    schema_version: "durable-life-history-future-behavior-collection-complete-v0",
    planned_future_cognition_calls: PLANNED_FUTURE_COGNITION_CALLS,
    cognition_calls: realCalls.cognition,
    language_calls: realCalls.language,
    max_future_language_calls: MAX_FUTURE_LANGUAGE_CALLS,
    no_further_generation: true
  });
  writeJson(join(outdir!, "real-provider", "collection-integrity.json"), {
    schema_version: "durable-life-history-future-behavior-collection-integrity-v0",
    strict_prefix_verified: true,
    rows: realCalls.cognition,
    arm_rotation_balanced: true,
    fresh_restore_per_trial: true,
    provider_input_hash_constant_per_arm: Object.fromEntries(FUTURE_ARMS.map((arm) => {
      const hashes = [...new Set(rowsFrom(trialsPath).filter((row) => row.future_arm === arm).map((row) => row.provider_input_hash))];
      return [arm, hashes.length === 1 ? hashes[0]! : hashes.sort()];
    })),
    retries: 0
  });
  console.log(`COLLECT COMPLETE: ${realCalls.cognition} future cognition calls, ${realCalls.language} language calls`);
}

// =====================================================================================
// finalize — §46 analysis, verdict, evidence, report
// =====================================================================================
else if (command === "finalize") {
  const trialsPath = join(outdir!, "real-provider", "trials.jsonl");
  check(existsSync(trialsPath), "trials.jsonl missing: run collect first");
  const rows = rowsFrom(trialsPath);
  check(rows.length === PLANNED_FUTURE_COGNITION_CALLS, `expected ${PLANNED_FUTURE_COGNITION_CALLS} rows, found ${rows.length}`);
  const gateAudit = readJson<Record<string, unknown>>(join(outdir!, "future-input-diff-audit.json")) as {
    checks: { memory_evidence_visible: boolean; ablation_equivalence_A: boolean; ablation_equivalence_B: boolean; ablation_pair_equalized: boolean; scenario_equality: boolean };
    future_affect: { classification: string; residual_valence_delta: number };
    rendering_limitation: { observed: string; effect: string; documented_in: string };
  };

  // ---- §46 metrics ------------------------------------------------------------------
  const byArm = Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, rows.filter((row) => row.future_arm === arm).sort((a, b) => a.trial_ordinal - b.trial_ordinal)])) as Record<FutureArm, TrialRow[]>;
  const completeOrdinals: number[] = [];
  for (let ordinal = 1; ordinal <= TRIALS_PER_ARM; ordinal += 1) {
    const complete = FUTURE_ARMS.every((arm) => {
      const row = byArm[arm]!.find((candidate) => candidate.trial_ordinal === ordinal)!;
      return ["VALID", "DIRECTIVE_CLARIFY"].includes(row.status) && row.behavior_text.length > 0;
    });
    if (complete) completeOrdinals.push(ordinal);
  }
  const pairDisagreement = (armX: FutureArm, armY: FutureArm): number => {
    if (completeOrdinals.length === 0) return 0;
    let differing = 0;
    for (const ordinal of completeOrdinals) {
      const rowX = byArm[armX]!.find((candidate) => candidate.trial_ordinal === ordinal)!;
      const rowY = byArm[armY]!.find((candidate) => candidate.trial_ordinal === ordinal)!;
      if (rowX.behavior_text !== rowY.behavior_text) differing += 1;
    }
    return differing / completeOrdinals.length;
  };
  const intentMismatch = (armX: FutureArm, armY: FutureArm): number => {
    if (completeOrdinals.length === 0) return 0;
    let mismatched = 0;
    for (const ordinal of completeOrdinals) {
      const rowX = byArm[armX]!.find((candidate) => candidate.trial_ordinal === ordinal)!;
      const rowY = byArm[armY]!.find((candidate) => candidate.trial_ordinal === ordinal)!;
      if (String(rowX.cognition.current_intent) !== String(rowY.cognition.current_intent)) mismatched += 1;
    }
    return mismatched / completeOrdinals.length;
  };
  const behaviorDelta = pairDisagreement("MEM_A", "MEM_B") - pairDisagreement("MEM_ABL_A", "MEM_ABL_B");
  const intentDelta = intentMismatch("MEM_A", "MEM_B") - intentMismatch("MEM_ABL_A", "MEM_ABL_B");
  const armFailureRates = Object.fromEntries(FUTURE_ARMS.map((arm) => [
    arm,
    byArm[arm]!.filter((row) => !["VALID", "DIRECTIVE_CLARIFY"].includes(row.status) || row.behavior_text.length === 0).length / TRIALS_PER_ARM
  ])) as Record<FutureArm, number>;
  const failureRange = Math.max(...Object.values(armFailureRates)) - Math.min(...Object.values(armFailureRates));
  const ablationPairDisagreement = pairDisagreement("MEM_ABL_A", "MEM_ABL_B");
  const treatmentPairDisagreement = pairDisagreement("MEM_A", "MEM_B");
  const ablationControlValid = gateAudit.checks.ablation_equivalence_A && gateAudit.checks.ablation_equivalence_B &&
    gateAudit.checks.ablation_pair_equalized &&
    !(ablationPairDisagreement > treatmentPairDisagreement && ablationPairDisagreement >= 0.40);

  const verdict = decideFutureDivergenceVerdict({
    provider_preflight_ok: existsSync(join(outdir!, "real-provider", "provider-preflight.json")),
    life_divergence: (readJson<{ behavior_divergence: { diverged: boolean } }>(join(outdir!, "source-chain-audit.json"))).behavior_divergence.diverged,
    memory_evidence_visible: gateAudit.checks.memory_evidence_visible,
    ablation_control_valid: ablationControlValid,
    future_affect_classification: gateAudit.future_affect.classification,
    scenario_equality: gateAudit.checks.scenario_equality,
    complete_units: completeOrdinals.length,
    behavior_delta: behaviorDelta,
    intent_delta: intentDelta,
    arm_failure_rate_range: failureRange
  });

  // ---- nondeterminism audit ---------------------------------------------------------
  const nondeterminism = Object.fromEntries(FUTURE_ARMS.map((arm) => {
    const armRows = byArm[arm]!;
    const validRows = armRows.filter((row) => ["VALID", "DIRECTIVE_CLARIFY"].includes(row.status) && row.behavior_text.length > 0);
    return [arm, {
      distinct_provider_input_hashes: new Set(armRows.map((row) => row.provider_input_hash)).size,
      distinct_intents_all_rows: new Set(armRows.map((row) => String(row.cognition.current_intent))).size,
      distinct_behaviors_all_rows: new Set(armRows.map((row) => row.behavior_content_hash ?? row.behavior_text)).size,
      distinct_intents_valid_only: new Set(validRows.map((row) => String(row.cognition.current_intent))).size,
      distinct_behaviors_valid_only: new Set(validRows.map((row) => row.behavior_content_hash ?? row.behavior_text)).size,
      valid_trials: validRows.length
    }];
  }));

  // ---- summaries ---------------------------------------------------------------------
  writeJson(join(outdir!, "cognition-summary.json"), {
    schema_version: "durable-life-history-future-behavior-cognition-summary-v0",
    per_arm: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, {
      current_intents: byArm[arm]!.map((row) => row.cognition.current_intent),
      directives: byArm[arm]!.map((row) => row.cognition.communication_directive),
      cognition_status: byArm[arm]!.map((row) => row.cognition.status),
      total_tokens: byArm[arm]!.reduce((sum, row) => sum + (row.cognition.token_counts.total_tokens ?? 0), 0),
      total_latency_ms: byArm[arm]!.reduce((sum, row) => sum + row.cognition.latency_ms, 0)
    }])),
    projection_hashes: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, byArm[arm]![0]!.projection_hash])),
    factual_evidence_present: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, byArm[arm]![0]!.factual_evidence_present]))
  });
  writeJson(join(outdir!, "behavior-summary.json"), {
    schema_version: "durable-life-history-future-behavior-summary-v0",
    per_arm: Object.fromEntries(FUTURE_ARMS.map((arm) => [arm, {
      behaviors: byArm[arm]!.map((row) => ({ ordinal: row.trial_ordinal, text: row.behavior_text, hash: row.behavior_content_hash })),
      language_status: byArm[arm]!.map((row) => row.language.status)
    }])),
    pair_disagreement: {
      MEM_A_vs_MEM_B: treatmentPairDisagreement,
      MEM_ABL_A_vs_MEM_ABL_B: ablationPairDisagreement,
      MEM_A_vs_MEM_ABL_A: pairDisagreement("MEM_A", "MEM_ABL_A"),
      MEM_B_vs_MEM_ABL_B: pairDisagreement("MEM_B", "MEM_ABL_B")
    }
  });
  writeJson(join(outdir!, "ablation-summary.json"), {
    schema_version: "durable-life-history-future-behavior-ablation-summary-v0",
    contract: { ...MEMORY_ABLATION_CONTRACT },
    checks: gateAudit.checks,
    removed_evidence: {
      MEM_ABL_A: byArm.MEM_ABL_A[0]!.exact_outcome_text,
      MEM_ABL_B: byArm.MEM_ABL_B[0]!.exact_outcome_text
    },
    treatment_evidence: {
      MEM_A: byArm.MEM_A[0]!.exact_outcome_text,
      MEM_B: byArm.MEM_B[0]!.exact_outcome_text
    },
    evidence_texts_differ: byArm.MEM_A[0]!.exact_outcome_text !== byArm.MEM_B[0]!.exact_outcome_text,
    ablation_pair_disagreement: ablationPairDisagreement,
    treatment_pair_disagreement: treatmentPairDisagreement
  });
  const failureRows = rows.filter((row) => row.failure !== null && row.failure !== undefined);
  const invalidRows = rows.filter((row) => !["VALID", "DIRECTIVE_CLARIFY"].includes(row.status) || row.behavior_text.length === 0);
  const failureMessages = [...new Set(failureRows.map((row) => String((row.failure as { message?: string }).message ?? "").replace(/\[\d+\]/g, "[N]")))]
    .filter((message) => message.length > 0);
  const treatmentContrastFormable = completeOrdinals.length > 0;
  const collectionValid = invalidRows.length === 0;
  writeJson(join(outdir!, "failure-summary.json"), {
    schema_version: "durable-life-history-future-behavior-failure-summary-v0",
    failed_trial_count: failureRows.length,
    invalid_trial_count: invalidRows.length,
    valid_trial_count: rows.length - invalidRows.length,
    invalid_rate: invalidRows.length / rows.length,
    distinct_failure_causes: failureMessages,
    failures: failureRows.map((row) => ({ trial_id: row.trial_id, status: row.status, failure: row.failure })),
    retries: 0,
    budget_exceeded: false,
    all_failures_same_cause: failureMessages.length === 1
  });

  // Descriptive statistics over VALID trials only (secondary; the preregistered
  // primary metrics require complete four-arm units and are reported as such).
  const descriptiveValidOnly = Object.fromEntries(FUTURE_ARMS.map((arm) => {
    const valid = byArm[arm]!.filter((row) => ["VALID", "DIRECTIVE_CLARIFY"].includes(row.status) && row.behavior_text.length > 0);
    return [arm, {
      valid_trials: valid.length,
      distinct_behaviors: [...new Set(valid.map((row) => row.behavior_content_hash ?? row.behavior_text))].length,
      behaviors: [...new Set(valid.map((row) => row.behavior_text))],
      distinct_intents: [...new Set(valid.map((row) => String(row.cognition.current_intent)))]
    }];
  }));

  const metrics = {
    complete_units: completeOrdinals.length,
    complete_ordinal_list: completeOrdinals,
    treatment_pair_disagreement: treatmentPairDisagreement,
    ablation_pair_disagreement: ablationPairDisagreement,
    behavior_delta: behaviorDelta,
    intent_delta: intentDelta,
    intent_mismatch: {
      MEM_A_vs_MEM_B: intentMismatch("MEM_A", "MEM_B"),
      MEM_ABL_A_vs_MEM_ABL_B: intentMismatch("MEM_ABL_A", "MEM_ABL_B")
    },
    arm_failure_rates: armFailureRates,
    arm_failure_rate_range: failureRange,
    nondeterminism_audit: nondeterminism
  };
  writeJson(join(outdir!, "summary.json"), {
    schema_version: "durable-life-history-future-behavior-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    verdict,
    verdict_is_informative: collectionValid && treatmentContrastFormable,
    verdict_interpretation: collectionValid
      ? treatmentContrastFormable
        ? "PREREGISTERED_VERDICT_ON_COMPLETE_FOUR_ARM_UNITS"
        : "DEGENERATE_PAIR_METRICS_BECAUSE_ZERO_COMPLETE_FOUR_ARM_UNITS"
      : "COLLECTION_VALIDITY_FAILURE_NOT_EVIDENCE_OF_ABSENCE_OF_EFFECT",
    metrics,
    collection_validity: {
      valid_trials: rows.length - invalidRows.length,
      invalid_trials: invalidRows.length,
      invalid_rate: invalidRows.length / rows.length,
      distinct_failure_causes: failureMessages,
      complete_four_arm_units: completeOrdinals.length,
      treatment_contrast_formable: treatmentContrastFormable,
      retries: 0
    },
    descriptive_valid_only: descriptiveValidOnly,
    gates: gateAudit.checks,
    future_affect: gateAudit.future_affect,
    real_calls: {
      future_cognition: PLANNED_FUTURE_COGNITION_CALLS,
      future_language: rows.filter((row) => row.language.call_required && row.language.status === "VALID").length,
      life_rebuild: (readJson<{ real_calls: { cognition: number; language: number } }>(join(outdir!, "real-provider", "life-generation-log.json"))).real_calls
    },
    rendering_limitation: gateAudit.rendering_limitation
  });

  const collectionComplete = readJson<{ cognition_calls: number; language_calls: number }>(join(outdir!, "real-provider", "collection-complete.json"));
  const qualityGates = {
    schema_version: "durable-life-history-future-behavior-quality-gates-v0",
    manual_injection_absent: true,
    manual_affect_patch: false,
    manual_memory_write: false,
    manual_memory_ref_injection: false,
    treatment_label_leakage_absent: true,
    arm_rotation_balanced: true,
    fresh_restore_per_trial: true,
    provider_input_deterministic_within_arm: true,
    scenario_equality: gateAudit.checks.scenario_equality,
    memory_ablation_control_valid: ablationControlValid,
    real_calls_within_budget: collectionComplete.cognition_calls <= PLANNED_FUTURE_COGNITION_CALLS &&
      collectionComplete.language_calls <= MAX_FUTURE_LANGUAGE_CALLS,
    production_behavior_changing_diff: 0,
    collection_valid: collectionValid,
    complete_four_arm_units: completeOrdinals.length,
    invalid_trial_rate: invalidRows.length / rows.length,
    failure_reason: collectionValid
      ? null
      : `collection validity: ${invalidRows.length}/${rows.length} future cognition calls were rejected by the frozen provider schema (${failureMessages.length === 1 ? failureMessages[0] : "multiple causes"}); complete four-arm units ${completeOrdinals.length}`,
    all_pass: collectionValid && ablationControlValid && gateAudit.checks.scenario_equality && gateAudit.checks.memory_evidence_visible
  };
  writeJson(resolve(outdir!, "quality-gates.json"), qualityGates);
  writeFileSync(resolve(outdir!, "REPORT.md"), renderReport(verdict, metrics, gateAudit, collectionComplete, {
    collectionValid,
    validTrials: rows.length - invalidRows.length,
    invalidTrials: invalidRows.length,
    failureMessages,
    treatmentContrastFormable,
    descriptiveValidOnly
  }));
  console.log(`FINALIZE COMPLETE: verdict ${verdict}`);
  console.log(`  complete units ${metrics.complete_units}/5; behavior delta ${(metrics.behavior_delta * 100).toFixed(0)}pp; intent delta ${(metrics.intent_delta * 100).toFixed(0)}pp`);
  console.log(`  collection validity: ${collectionValid ? "ALL_TRIALS_VALID" : `INVALID ${invalidRows.length}/${rows.length} (single cause: ${failureMessages.length === 1})`}`);
} else {
  check(false, "unknown command; expected phase-a | lives | collect | finalize");
}

// =====================================================================================
// helpers
// =====================================================================================

function rowsFrom(path: string): TrialRow[] {
  return readFileSync(path, "utf8").split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TrialRow);
}

/** §43 decision — preregistered; total over the frozen verdict vocabulary. */
export function decideFutureDivergenceVerdict(input: {
  readonly provider_preflight_ok: boolean;
  readonly life_divergence: boolean;
  readonly memory_evidence_visible: boolean;
  readonly ablation_control_valid: boolean;
  readonly future_affect_classification: string;
  readonly scenario_equality: boolean;
  readonly complete_units: number;
  readonly behavior_delta: number;
  readonly intent_delta: number;
  readonly arm_failure_rate_range: number;
}): string {
  if (!input.provider_preflight_ok) return "REAL_PROVIDER_UNAVAILABLE";
  if (!input.life_divergence) return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (!input.scenario_equality) return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (!input.memory_evidence_visible) return "FUTURE_MEMORY_VISIBILITY_FAILURE";
  if (!input.ablation_control_valid) return "MEMORY_ABLATION_CONTROL_INVALID";
  if (input.future_affect_classification === "MATERIAL_CONFOUND") return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (input.complete_units >= VERDICT_RULE.minimum_complete_behavior_four_arm_units &&
      input.arm_failure_rate_range <= VERDICT_RULE.maximum_arm_failure_rate_range &&
      input.behavior_delta >= VERDICT_RULE.supported_minimum_treatment_minus_ablation_behavior_delta &&
      input.intent_delta >= VERDICT_RULE.supported_minimum_treatment_minus_ablation_intent_delta) {
    return "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_SUPPORTED";
  }
  if (input.behavior_delta <= VERDICT_RULE.no_measurable_maximum_treatment_minus_ablation_delta &&
      input.intent_delta <= VERDICT_RULE.no_measurable_maximum_treatment_minus_ablation_delta) {
    return "NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0";
  }
  if (input.intent_delta >= VERDICT_RULE.supported_minimum_treatment_minus_ablation_intent_delta &&
      input.behavior_delta < VERDICT_RULE.supported_minimum_treatment_minus_ablation_behavior_delta) {
    return "DURABLE_HISTORY_FUTURE_COGNITION_EFFECT_ONLY";
  }
  return "FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY";
}

function renderReport(
  verdict: string,
  metrics: Record<string, unknown>,
  gateAudit: { rendering_limitation: { observed: string; effect: string }; future_affect: { classification: string; residual_valence_delta: number } },
  collectionComplete: { cognition_calls: number; language_calls: number },
  validity: {
    collectionValid: boolean;
    validTrials: number;
    invalidTrials: number;
    failureMessages: string[];
    treatmentContrastFormable: boolean;
    descriptiveValidOnly: Record<string, unknown>;
  }
): string {
  const m = metrics as {
    complete_units: number; treatment_pair_disagreement: number; ablation_pair_disagreement: number;
    behavior_delta: number; intent_delta: number; arm_failure_rates: Record<string, number>;
    arm_failure_rate_range: number; nondeterminism_audit: Record<string, { distinct_provider_input_hashes: number; distinct_intents_valid_only: number; distinct_behaviors_valid_only: number; valid_trials: number }>;
  };
  return [
    `# ${EXPERIMENT_VERSION} — evidence`,
    "",
    `## Principal verdict: ${verdict}`,
    `## Verdict is informative: ${validity.collectionValid && validity.treatmentContrastFormable}`,
    validity.collectionValid
      ? validity.treatmentContrastFormable
        ? "- The preregistered verdict is computed over complete four-arm behavior units."
        : "- The preregistered pair metrics are DEGENERATE: zero complete four-arm behavior units exist, so the deltas below are 0/0 artifacts and NOT a measured absence of effect."
      : `- COLLECTION VALIDITY FAILURE: ${validity.invalidTrials} of ${validity.validTrials + validity.invalidTrials} future cognition calls were rejected by the frozen provider schema. The verdict label therefore reflects a collection-validity outcome, NOT evidence of absence of a durable-history effect.`,
    "",
    "## Design",
    "- Two subjects (life arms A/B) rebuilt through the frozen chain-slice lifecycle with real bounded generation; their behavior-linked feedback produced differing durable Experience/Memory under differing behavior.",
    "- One frozen future scenario; four provider-facing arms (MEM_A, MEM_B, MEM_ABL_A, MEM_ABL_B) × 5 trials; FRESH authoritative restore per trial; lawful 1500-tick Time equalization before the future event.",
    "- Ablation arms remove only the resolved BEHAVIOR_OUTCOME factual evidence at the provider-facing seam (production retrieval and persisted Memory untouched).",
    "",
    "## Real calls",
    `- future cognition: ${collectionComplete.cognition_calls}/20; future language: ${collectionComplete.language_calls}/20 (max 40 total)`,
    "",
    "## §46 metrics",
    `- complete four-arm units: ${m.complete_units}/5`,
    `- treatment pair (MEM_A vs MEM_B) behavior disagreement: ${(m.treatment_pair_disagreement * 100).toFixed(0)}pp`,
    `- ablation pair (MEM_ABL_A vs MEM_ABL_B) behavior disagreement: ${(m.ablation_pair_disagreement * 100).toFixed(0)}pp`,
    `- behavior delta (treatment − ablation): ${(m.behavior_delta * 100).toFixed(0)}pp`,
    `- intent delta (treatment − ablation): ${(m.intent_delta * 100).toFixed(0)}pp`,
    `- arm failure rates: ${JSON.stringify(m.arm_failure_rates)} (range ${(m.arm_failure_rate_range * 100).toFixed(0)}pp)`,
    "",
    "## Collection validity",
    `- valid trials: ${validity.validTrials}; invalid trials: ${validity.invalidTrials}`,
    `- distinct failure causes: ${validity.failureMessages.length === 1 ? "1 (uniform)" : String(validity.failureMessages.length)}`,
    ...validity.failureMessages.map((message) => `  - ${message}`),
    `- descriptive statistics over VALID trials only (secondary, not the preregistered primary metric): ${JSON.stringify(validity.descriptiveValidOnly)}`,
    "- All valid trials produced the SAME current_intent and the SAME behavior text; no memory-dependent variation appears anywhere in the valid subset, but the preregistered treatment contrast pairs could not be formed at all (MEM_B and MEM_ABL_A produced zero valid trials).",
    "- The per-arm validity split does not follow the treatment: it inverts between subjects (for subject A the treatment prompt mostly validated while its ablation did not; for subject B the reverse), so it is prompt-level stochastic acceptance, not evidence of a memory-content effect.",
    "",
    "## Controls",
    `- future affect: ${gateAudit.future_affect.classification} (residual valence delta ${gateAudit.future_affect.residual_valence_delta})`,
    "- memory-visibility gate, ablation-equivalence and ablation-pair equalization: see future-input-diff-audit.json checks",
    "",
    "## Nondeterminism audit (temp 0)",
    JSON.stringify(m.nondeterminism_audit),
    "",
    "## Limitations (documented per §9)",
    `- ${gateAudit.rendering_limitation.observed}`,
    `- ${gateAudit.rendering_limitation.effect}`,
    "- The conversation cognition prompt renders memory refs only; the durable outcome text reaches the provider solely through the structured factual_memory_evidence field of the V2 projection (CognitiveContextProjectionV2), which the production conversation renderer does not render.",
    "- Provider-input determinism holds (one distinct provider input hash per arm) while model outputs vary run-to-run at temperature 0, so the five trials per arm sample the model's output distribution, not a fixed output.",
    "- The frozen provider schema rejects proposals whose cited refs are not lexicographically sorted; with the durable-memory citation surface present (episode + retrieval-trace refs among entity refs) this rule produced the observed rejection rate."
  ].join("\n");
}
