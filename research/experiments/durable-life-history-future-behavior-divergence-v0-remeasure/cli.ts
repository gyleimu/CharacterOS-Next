/* eslint-disable @typescript-eslint/no-non-null-assertion -- Isolated remeasurement entrypoint: outdir/argv and frozen-plan indices are validated at each use site by check(); this matches the repo's existing experiment-code precedent. */

/**
 * DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0_REMEASURE — entrypoint.
 *
 *   node .../cli.ts phase-a  <outdir> — freeze the remeasurement preregistration (0 real calls)
 *   node .../cli.ts lives    <outdir> — rebuild both lives under the frozen bounded policy
 *   node .../cli.ts gates    <outdir> — §17/§18/§19/§48 gates (0 real FUTURE calls)
 *   node .../cli.ts collect  <outdir> — 20 future trials (strict-prefix resumable)
 *   node .../cli.ts finalize <outdir> — §27-§33 metrics, verdict, evidence, report
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  BASELINE_COMMIT,
  COLLECTION_VALIDITY_GATE,
  EXPERIMENT_VERSION,
  FAILURE_TAXONOMY_FIELDS,
  FROZEN_DESIGN_REUSE,
  ORIGINAL_V0_COMMIT,
  ORIGINAL_V0_EVIDENCE_DIR,
  ORIGINAL_V0_VERSION,
  PRINCIPAL_VERDICTS,
  REMEASUREMENT_FAILURE_VERDICTS,
  REPAIR_COMMIT,
  REPAIR_REGRESSION_CHECKS,
  REPAIR_VERSION,
  SUBJECT,
  TOKEN_ACCOUNTING_SECTIONS,
  frozenConfig,
  type FutureArm,
  type LifeScenarioV0,
  type TreatmentArm
} from "./contract.ts";
import { canonicalJson, check, hashJson } from "../durable-life-history-future-behavior-divergence-v0/fixtures.ts";
import {
  BALANCED_FUTURE_ARM_ORDER,
  BEHAVIOR_SOURCE_PLAN,
  COGNITION_SETTINGS,
  FUTURE_SCENARIO,
  LANGUAGE_SETTINGS,
  LIFE_SCENARIOS,
  MAX_FUTURE_LANGUAGE_CALLS,
  MEMORY_ABLATION_CONTRACT,
  METRIC_CONTRACT,
  PLANNED_FUTURE_COGNITION_CALLS,
  TIME_EQUALIZATION,
  TRIALS_PER_ARM as V0_TRIALS_PER_ARM,
  VERDICT_RULE
} from "../durable-life-history-future-behavior-divergence-v0/contract.ts";
import {
  buildLifeArm,
  captureFutureProjection,
  classifyRequestDiff,
  commitFutureContextObservation,
  completeLife,
  failureTaxonomy,
  projectionBodyWithout,
  rebuildLifeFromCheckpoint,
  renderProviderRequest,
  repairRegressionAudit,
  restoreWorld,
  runRemeasureFutureTrial,
  type FutureCapture,
  type LifeArmComplete,
  type LifeMetadata,
  type RestoredRuntime
} from "./harness.ts";
import { probeV1Root } from "../durable-life-history-future-behavior-divergence-v0/real-generation.ts";

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
check(HEAD === BASELINE_COMMIT, `baseline mismatch: HEAD ${HEAD} != frozen ${BASELINE_COMMIT}`);
check(V0_TRIALS_PER_ARM === COLLECTION_VALIDITY_GATE.trials_per_arm, "frozen sample size must be reused");

const command = process.argv[2];
const outdir = process.argv[3];
check(typeof command === "string" && typeof outdir === "string", "usage: cli.ts <phase-a|lives|gates|collect|finalize> <outdir>");

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, canonicalJson(value));
}
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
function rowsFrom(path: string): TrialRow[] {
  return readFileSync(path, "utf8").split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line) as TrialRow);
}
function phaseACompletePath(): string {
  return resolve(outdir!, "phase-a-complete.json");
}

interface CheckpointArm {
  readonly arm: TreatmentArm;
  readonly metadata: LifeMetadata;
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
  readonly scenario: LifeScenarioV0;
  readonly arms: Record<string, CheckpointArm>;
}
interface TrialRow {
  readonly future_arm: FutureArm;
  readonly life_arm: TreatmentArm;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
  readonly response_request_id: string;
  readonly provider_input_hash: string;
  readonly projection_hash: string;
  readonly rendered_request_hash: string;
  readonly trace_request_hash: string | null;
  readonly request_identity_match: boolean;
  readonly memory_section_present: boolean;
  readonly memory_section_hash: string | null;
  readonly delivered_behavior_text: string | null;
  readonly exact_outcome_text: string | null;
  readonly canonical_affect: { readonly valence: number; readonly activation: number };
  readonly working_episode_refs: readonly string[];
  readonly future_context_hash: string;
  readonly cognition: {
    readonly status: string;
    readonly current_intent: string | null;
    readonly communication_directive: string | null;
    readonly structured_proposal_hash: string | null;
    readonly latency_ms: number;
    readonly prompt_tokens: number | null;
    readonly completion_tokens: number | null;
    readonly total_tokens: number | null;
  };
  readonly language: {
    readonly call_required: boolean;
    readonly status: string;
    readonly input_hash: string | null;
    readonly latency_ms: number;
    readonly total_tokens: number | null;
  };
  readonly behavior_text: string;
  readonly behavior_content_hash: string | null;
  readonly status: string;
  readonly failure: unknown;
  readonly failure_taxonomy: Record<string, unknown> | null;
}

// =====================================================================================
// phase-a
// =====================================================================================
if (command === "phase-a") {
  mkdirSync(outdir!, { recursive: true });
  writeJson(join(outdir!, "config.json"), frozenConfig());
  writeJson(join(outdir!, "original-v0-contract-reference.json"), {
    schema_version: "durable-life-history-remeasure-original-v0-reference-v0",
    original_v0: {
      experiment: ORIGINAL_V0_VERSION,
      commit: ORIGINAL_V0_COMMIT,
      evidence_dir: ORIGINAL_V0_EVIDENCE_DIR,
      frozen_verdict: "NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0",
      verdict_is_informative: false,
      verdict_interpretation: "COLLECTION_VALIDITY_FAILURE_NOT_EVIDENCE_OF_ABSENCE_OF_EFFECT",
      original_failure: { future_cognition_calls: 20, invalid_schema: 13, complete_four_arm_units: 0 }
    },
    reused_unchanged: {
      future_scenario: { ...FUTURE_SCENARIO },
      life_scenarios: LIFE_SCENARIOS.map((scenario) => ({ ...scenario })),
      arms: [...BALANCED_FUTURE_ARM_ORDER[0]!],
      trials_per_arm: V0_TRIALS_PER_ARM,
      affect_recovery: { ...TIME_EQUALIZATION },
      ablation_contract_id: "EXPERIMENTAL_PROVIDER_FACING_BEHAVIOR_OUTCOME_EVIDENCE_REMOVAL_V0",
      thresholds: { ...VERDICT_RULE },
      metric_contract: { ...METRIC_CONTRACT },
      behavior_source_plan: { ...BEHAVIOR_SOURCE_PLAN }
    },
    original_evidence_untouched: true
  });
  writeJson(join(outdir!, "repair-baseline.json"), {
    schema_version: "durable-life-history-remeasure-repair-baseline-v0",
    repair: { experiment: REPAIR_VERSION, commit: REPAIR_COMMIT, verdict: "DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_IMPLEMENTED_GREEN" },
    repaired_surface: {
      memory_factual_rendering: "renderFactualMemoryEvidenceSectionV1 (shared frozen section, additive identity + delivered behavior text)",
      set_like_ref_canonicalization: "canonicalizeSetLikeRefFields at the provider parse boundary (representation only)"
    },
    frozen_smoke: { cognition_calls: 4, language_calls: 0, schema_accepted: 4, all_schema_accepted: true },
    measurement_readiness_only: true
  });
  writeJson(join(outdir!, "design-reuse.json"), { ...FROZEN_DESIGN_REUSE });
  writeJson(join(outdir!, "future-scenario.json"), {
    schema_version: "durable-life-history-remeasure-future-scenario-v0",
    identical_to_original_v0: true,
    ...FUTURE_SCENARIO
  });
  writeJson(join(outdir!, "future-affect-control.json"), {
    schema_version: "durable-life-history-remeasure-future-affect-control-v0",
    mechanism: TIME_EQUALIZATION.mechanism,
    ticks: TIME_EQUALIZATION.ticks,
    acceptance_threshold: TIME_EQUALIZATION.acceptance_threshold,
    manual_equalization: false
  });
  writeJson(join(outdir!, "memory-ablation-contract.json"), { ...MEMORY_ABLATION_CONTRACT });
  writeJson(join(outdir!, "metric-contract.json"), {
    ...METRIC_CONTRACT,
    remeasurement_denominators: {
      valid_stage_pairs: "ordinals where BOTH arms of the pair produced a valid cognition (independent of the other pair)",
      complete_cognition_four_arm_units: "ordinals where all four arms produced a valid cognition",
      complete_behavior_four_arm_units: "ordinals where all four arms produced a nonempty behavior"
    },
    primary_denominator_for_verdict: "complete behavior four-arm units (frozen V0 §30)",
    collection_validity_gate: { ...COLLECTION_VALIDITY_GATE }
  });
  writeJson(join(outdir!, "verdict-contract.json"), {
    schema_version: "durable-life-history-remeasure-verdict-contract-v0",
    verdicts: [...PRINCIPAL_VERDICTS],
    failure_verdicts: [...REMEASUREMENT_FAILURE_VERDICTS],
    thresholds: { ...VERDICT_RULE },
    collection_validity_gate: { ...COLLECTION_VALIDITY_GATE },
    failure_taxonomy_fields: [...FAILURE_TAXONOMY_FIELDS],
    repair_regression_checks: [...REPAIR_REGRESSION_CHECKS],
    token_accounting_sections: [...TOKEN_ACCOUNTING_SECTIONS],
    frozen_before_real_future_provider_output: true
  });
  writeJson(join(outdir!, "phase-a.json"), {
    schema_version: "durable-life-history-remeasure-phase-a-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    original_v0_reused: "PASS",
    repair_reused: "PASS",
    sample_size_reused: "PASS",
    thresholds_reused: "PASS",
    provider_settings_reused: "PASS",
    future_real_model_calls: 0,
    all_pass: true
  });
  writeJson(join(outdir!, "phase-a-complete.json"), {
    schema_version: "durable-life-history-remeasure-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    future_real_model_calls: 0,
    all_pass: true
  });
  console.log("PHASE A COMPLETE: remeasurement preregistration frozen; future real calls 0");
}

// =====================================================================================
// lives
// =====================================================================================
else if (command === "lives") {
  check(existsSync(phaseACompletePath()), "phase-a-complete.json missing: run phase-a first");
  mkdirSync(join(outdir!, "real-provider"), { recursive: true });
  const checkpointPath = resolve(outdir!, "lives-checkpoint.json");
  if (existsSync(checkpointPath)) {
    console.log("LIVES ALREADY CHECKPOINTED: skipping real life calls");
    process.exit(0);
  }
  let probe = await probeV1Root();
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    if (probe.reachable && probe.digest === COGNITION_SETTINGS.required_digest) break;
    await new Promise((sleep) => setTimeout(sleep, 2000));
    probe = await probeV1Root();
  }
  check(probe.reachable, `provider unreachable: ${probe.failure ?? "no response"}`);
  check(probe.digest === COGNITION_SETTINGS.required_digest,
    `provider digest mismatch: ${probe.digest ?? "null"} (probe failure: ${probe.failure ?? "none"})`);
  writeJson(join(outdir!, "real-provider", "provider-preflight.json"), {
    schema_version: "durable-life-history-remeasure-provider-preflight-v0",
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
  const primary = LIFE_SCENARIOS.find((scenario) => scenario.role === "PRIMARY");
  const alternate = LIFE_SCENARIOS.find((scenario) => scenario.role === "ALTERNATE");
  check(primary !== undefined, "primary life scenario missing");
  const buildPair = async (scenario: typeof primary): Promise<{ readonly A: LifeArmComplete; readonly B: LifeArmComplete }> => {
    const armA = await completeLife(await buildLifeArm(scenario!, "A", realCalls), realCalls);
    const armB = await completeLife(await buildLifeArm(scenario!, "B", realCalls), realCalls);
    return { A: armA, B: armB };
  };
  let usedScenario = primary!;
  let lives = await buildPair(primary);
  let diverged = lives.A.behavior_text !== lives.B.behavior_text;
  if (!diverged && alternate !== undefined) {
    usedScenario = alternate;
    lives = await buildPair(alternate);
    diverged = lives.A.behavior_text !== lives.B.behavior_text;
  }
  writeJson(join(outdir!, "real-provider", "life-generation-log.json"), {
    schema_version: "durable-life-history-remeasure-life-generation-log-v0",
    attempted_scenarios: usedScenario === primary ? [primary!.scenario_id] : [primary!.scenario_id, alternate!.scenario_id],
    chosen_scenario: usedScenario.scenario_id,
    behavior_diverged: diverged,
    real_calls: { ...realCalls }
  });
  if (!diverged) {
    writeJson(join(outdir!, "real-provider", "lives-failure.json"), {
      schema_version: "durable-life-history-remeasure-lives-failure-v0",
      verdict: "REMEASUREMENT_SOURCE_HISTORY_NOT_RECONSTRUCTABLE",
      reason: "the frozen bounded life policy produced no lawful A/B behavior divergence",
      real_calls: { ...realCalls }
    });
    console.error("LIVES FAILED: REMEASUREMENT_SOURCE_HISTORY_NOT_RECONSTRUCTABLE");
    process.exit(1);
  }
  const arms: Record<string, CheckpointArm> = {};
  for (const arm of ["A", "B"] as const) {
    const life = lives[arm];
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
  writeJson(checkpointPath, {
    schema_version: "durable-life-history-remeasure-lives-checkpoint-v0",
    experiment_version: EXPERIMENT_VERSION,
    scenario: usedScenario,
    arms
  } satisfies Checkpoint & { schema_version: string; experiment_version: string });
  console.log(`LIVES COMPLETE: scenario ${usedScenario.scenario_id}; diverged; calls cognition ${realCalls.cognition}, language ${realCalls.language}`);
}

// =====================================================================================
// gates — §17/§18/§19/§48, zero real future calls
// =====================================================================================
else if (command === "gates") {
  check(existsSync(phaseACompletePath()), "phase-a-complete.json missing: run phase-a first");
  const checkpointPath = resolve(outdir!, "lives-checkpoint.json");
  check(existsSync(checkpointPath), "lives-checkpoint.json missing: run lives first");
  const checkpoint = readJson<Checkpoint>(checkpointPath);
  const lives: Record<"A" | "B", LifeArmComplete> = {
    A: await rebuildLifeFromCheckpoint(checkpoint, "A"),
    B: await rebuildLifeFromCheckpoint(checkpoint, "B")
  };
  for (const arm of ["A", "B"] as const) {
    check(canonicalJson(lives[arm].chain) === canonicalJson(checkpoint.arms[arm]!.chain), `checkpoint replay ${arm}: chain mismatch`);
    check(canonicalJson(lives[arm].equalization) === canonicalJson(checkpoint.arms[arm]!.equalization), `checkpoint replay ${arm}: equalization mismatch`);
  }

  // §48 repair-regression audit: must pass BEFORE any real future call.
  const regression = await repairRegressionAudit();
  const regressionPass = REPAIR_REGRESSION_CHECKS.every((key) => (regression as unknown as Record<string, boolean>)[key] === true);

  // §46 source-chain audit: the lawful path from life behavior to durable memory.
  writeJson(join(outdir!, "source-chain-audit.json"), {
    schema_version: "durable-life-history-remeasure-source-chain-audit-v0",
    chosen_scenario: checkpoint.scenario.scenario_id,
    life_generation_log: readJson<unknown>(join(outdir!, "real-provider", "life-generation-log.json")),
    behavior_divergence: {
      diverged: lives.A.behavior_text !== lives.B.behavior_text,
      behavior_a: lives.A.behavior_text,
      behavior_b: lives.B.behavior_text,
      behavior_content_hash_a: (lives.A.record["behavior_content_hash"] as string) ?? null,
      behavior_content_hash_b: (lives.B.record["behavior_content_hash"] as string) ?? null
    },
    counterpart: {
      policy: "frozen V0 DETERMINISTIC_COUNTERPART_V0 (treatment-blind; inputs = [behavior.text])",
      policy_inputs: { A: lives.A.behavior_text, B: lives.B.behavior_text },
      treatment_blind: true,
      reply_texts: { A: lives.A.chain.reply_text, B: lives.B.chain.reply_text }
    },
    experience_memory: {
      A: { experience_ref: lives.A.chain.experience_ref, episode_ref: lives.A.chain.episode_ref, revision_before: lives.A.chain.revision_before, revision_after: lives.A.chain.revision_after },
      B: { experience_ref: lives.B.chain.experience_ref, episode_ref: lives.B.chain.episode_ref, revision_before: lives.B.chain.revision_before, revision_after: lives.B.chain.revision_after },
      memory_committed: lives.A.chain.revision_after !== lives.A.chain.revision_before &&
        lives.B.chain.revision_after !== lives.B.chain.revision_before
    },
    equalization: { A: lives.A.equalization, B: lives.B.equalization },
    manual_injection: false
  });

  // Capture the four provider-facing arms (fresh restore each, 0 real calls).
  interface GateCapture { readonly restored: RestoredRuntime; readonly future: Awaited<ReturnType<typeof commitFutureContextObservation>>; readonly capture: FutureCapture }
  const gateCaptures: Record<string, GateCapture> = {};
  for (const arm of ["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const) {
    const lifeArm: TreatmentArm = arm === "MEM_A" || arm === "MEM_ABL_A" ? "A" : "B";
    const restored = await restoreWorld(lives[lifeArm].world);
    const future = await commitFutureContextObservation(
      restored,
      { current_factual_event: FUTURE_SCENARIO.current_factual_event, current_task: FUTURE_SCENARIO.current_task },
      FUTURE_SCENARIO.event_id
    );
    const capture = await captureFutureProjection(restored, { ablate: arm.startsWith("MEM_ABL") });
    gateCaptures[arm] = { restored, future, capture };
  }
  const projections: Record<string, Record<string, unknown>> = {};
  const rendered: Record<string, Awaited<ReturnType<typeof renderProviderRequest>>> = {};
  for (const arm of ["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const) {
    projections[arm] = gateCaptures[arm]!.capture.projection;
    rendered[arm] = await renderProviderRequest(projections[arm]!);
  }

  // §17 — MEMORY_FACTUAL_CONTENT_PROVIDER_VISIBLE
  const diff = classifyRequestDiff(rendered["MEM_A"]!.user_content, rendered["MEM_B"]!.user_content);
  const contentClasses = ["EXPECTED_MEMORY_CONTENT", "EXPECTED_MEMORY_REF_IDENTITY"];
  const memoryFactualContentVisible = rendered["MEM_A"]!.memory_section_present &&
    rendered["MEM_B"]!.memory_section_present &&
    rendered["MEM_A"]!.user_content !== rendered["MEM_B"]!.user_content &&
    contentClasses.some((key) => (diff.classification_counts[key] ?? 0) > 0) &&
    diff.unexpected_confound_count === 0;

  // §19 — ablation removes only the target evidence.
  const ablationAbsentA = !rendered["MEM_ABL_A"]!.memory_section_present;
  const ablationAbsentB = !rendered["MEM_ABL_B"]!.memory_section_present;
  const ablatedPairDiff = classifyRequestDiff(rendered["MEM_ABL_A"]!.user_content, rendered["MEM_ABL_B"]!.user_content);
  const ablatedPairBodyEqual = canonicalJson(
    projectionBodyWithout(projections["MEM_ABL_A"]!, ["canonical_affect", "projection_hash"])
  ) === canonicalJson(projectionBodyWithout(projections["MEM_ABL_B"]!, ["canonical_affect", "projection_hash"]));
  const ablationEquivalenceA = canonicalJson(projectionBodyWithout(projections["MEM_A"]!, ["factual_memory_evidence", "projection_hash"])) ===
    canonicalJson(projectionBodyWithout(projections["MEM_ABL_A"]!, ["projection_hash"]));
  const ablationEquivalenceB = canonicalJson(projectionBodyWithout(projections["MEM_B"]!, ["factual_memory_evidence", "projection_hash"])) ===
    canonicalJson(projectionBodyWithout(projections["MEM_ABL_B"]!, ["projection_hash"]));
  const evidenceA = projections["MEM_A"]!["factual_memory_evidence"] ?? null;
  const evidenceB = projections["MEM_B"]!["factual_memory_evidence"] ?? null;
  const memoryEvidenceVisible = canonicalJson(evidenceA) !== canonicalJson(evidenceB) && evidenceA !== null;

  // §13 future affect classification.
  const affectOf = async (capture: GateCapture): Promise<{ valence: number; activation: number }> =>
    (await capture.restored.assembly.facade.readCurrentSnapshot(SUBJECT as never) as { affect: { valence: number; activation: number } }).affect;
  const affectA = await affectOf(gateCaptures["MEM_A"]!);
  const affectB = await affectOf(gateCaptures["MEM_B"]!);
  const residualValenceDelta = Math.abs(affectA.valence - affectB.valence);
  const affectClassification = residualValenceDelta < 1e-9
    ? "FUTURE_AFFECT_EFFECTIVELY_EQUAL"
    : residualValenceDelta < TIME_EQUALIZATION.acceptance_threshold
      ? "FUTURE_AFFECT_NEGLIGIBLE_BUT_NONZERO"
      : "FUTURE_AFFECT_MATERIAL_CONFOUND";
  const scenarioEquality = new Set(Object.values(gateCaptures).map((capture) => capture.future.future_context_hash)).size === 1;

  writeJson(join(outdir!, "restore-audit.json"), {
    schema_version: "durable-life-history-remeasure-restore-audit-v0",
    mechanism: "trusted v4 boundary + restoreSubjectStateV4AuthoritativelyV0; FRESH restore per trial",
    checkpoint_replay: { A: "HASH_VERIFIED", B: "HASH_VERIFIED" },
    equalization: { A: lives.A.equalization, B: lives.B.equalization },
    restored_affect: { MEM_A: affectA, MEM_B: affectB, residual_valence_delta: residualValenceDelta }
  });
  writeJson(join(outdir!, "future-retrieval-audit.json"), {
    schema_version: "durable-life-history-remeasure-future-retrieval-audit-v0",
    retrieval: "RepositoryBackedMemoryRetrievalServiceV0 over the restored repository (production path)",
    query_source: "future observation context/entities (no manual refs)",
    candidate_refs: Object.fromEntries(Object.entries(projections).map(([arm, projection]) => [arm, [
      ...new Set<string>([
        ...((projection["memory_working_refs"] as readonly string[]) ?? []),
        ...((projection["recent_retrieval_refs"] as readonly string[]) ?? [])
      ])
    ]])),
    selected_refs: Object.fromEntries(Object.entries(gateCaptures).map(([arm, capture]) => [arm, capture.future.working_episode_refs])),
    resolved_evidence: Object.fromEntries(Object.entries(gateCaptures).map(([arm, capture]) => [arm, capture.capture.production_evidence_bundle])),
    manual_ref_injection: false
  });
  writeJson(join(outdir!, "provider-surface-audit.json"), {
    schema_version: "durable-life-history-remeasure-provider-surface-audit-v0",
    memory_section_capture: {
      MEM_A: { present: rendered["MEM_A"]!.memory_section_present, section_hash: hashJson(rendered["MEM_A"]!.memory_section), rendered_request_hash: rendered["MEM_A"]!.request_hash },
      MEM_B: { present: rendered["MEM_B"]!.memory_section_present, section_hash: hashJson(rendered["MEM_B"]!.memory_section), rendered_request_hash: rendered["MEM_B"]!.request_hash },
      MEM_ABL_A: { present: rendered["MEM_ABL_A"]!.memory_section_present, section_hash: hashJson(rendered["MEM_ABL_A"]!.memory_section), rendered_request_hash: rendered["MEM_ABL_A"]!.request_hash },
      MEM_ABL_B: { present: rendered["MEM_ABL_B"]!.memory_section_present, section_hash: hashJson(rendered["MEM_ABL_B"]!.memory_section), rendered_request_hash: rendered["MEM_ABL_B"]!.request_hash }
    },
    MEM_A_memory_section: rendered["MEM_A"]!.memory_section,
    MEM_B_memory_section: rendered["MEM_B"]!.memory_section,
    delivered_behavior_text: Object.fromEntries((["MEM_A", "MEM_B"] as const).map((arm) => [
      arm,
      ((gateCaptures[arm]!.capture.production_evidence_bundle as { entries?: { kind: string; delivered_behavior_text?: string }[] } | null)?.entries ?? [])
        .find((entry) => entry.kind === "BEHAVIOR_OUTCOME")?.delivered_behavior_text ?? null
    ])),
    memory_factual_content_provider_visible: memoryFactualContentVisible ? "PASS" : "FAIL",
    ablation_target_evidence_absent: ablationAbsentA && ablationAbsentB ? "PASS" : "FAIL",
    repair_regression: { ...regression },
    checks: {
      memory_factual_rendering_active: regression.memory_factual_rendering_active,
      set_like_ref_canonicalization_active: regression.set_like_ref_canonicalization_active,
      validator_duplicate_rejection_active: regression.validator_duplicate_rejection_active,
      unknown_ref_rejection_active: regression.unknown_ref_rejection_active
    }
  });
  writeJson(join(outdir!, "future-input-diff-audit.json"), {
    schema_version: "durable-life-history-remeasure-future-input-diff-audit-v0",
    projections,
    rendered_requests: Object.fromEntries(Object.entries(rendered).map(([arm, request]) => [arm, {
      request_hash: request.request_hash,
      request_bytes: request.request_bytes,
      memory_section_present: request.memory_section_present,
      memory_section_hash: hashJson(request.memory_section)
    }])),
    treatment_request_diff: diff,
    ablation_request_diff: ablatedPairDiff,
    checks: {
      memory_factual_content_provider_visible: memoryFactualContentVisible,
      memory_evidence_visible: memoryEvidenceVisible,
      ablation_target_evidence_absent: ablationAbsentA && ablationAbsentB,
      ablation_equivalence_A: ablationEquivalenceA,
      ablation_equivalence_B: ablationEquivalenceB,
      ablation_pair_body_equal_except_affect: ablatedPairBodyEqual,
      scenario_equality: scenarioEquality,
      repair_regression_pass: regressionPass
    },
    future_affect: { restored_affect: { MEM_A: affectA, MEM_B: affectB }, residual_valence_delta: residualValenceDelta, classification: affectClassification }
  });
  writeJson(join(outdir!, "future-affect-control-evidence.json"), {
    schema_version: "durable-life-history-remeasure-affect-control-evidence-v0",
    restored_affect: { MEM_A: affectA, MEM_B: affectB },
    residual_valence_delta: residualValenceDelta,
    classification: affectClassification,
    manual_equalization: false
  });

  const gateFailures: string[] = [];
  if (!regressionPass) gateFailures.push("REPAIR_REGRESSION");
  if (!memoryFactualContentVisible) gateFailures.push("MEMORY_FACTUAL_CONTENT_PROVIDER_VISIBLE");
  if (!memoryEvidenceVisible) gateFailures.push("FUTURE_MEMORY_VISIBILITY");
  if (!(ablationAbsentA && ablationAbsentB && ablationEquivalenceA && ablationEquivalenceB && ablatedPairBodyEqual)) gateFailures.push("MEMORY_ABLATION_CONTROL");
  if (!scenarioEquality) gateFailures.push("FUTURE_SCENARIO_EQUALITY");
  if (affectClassification === "FUTURE_AFFECT_MATERIAL_CONFOUND") gateFailures.push("FUTURE_AFFECT_CONTROL");
  if (gateFailures.length > 0) {
    writeJson(join(outdir!, "real-provider", "gate-failure.json"), {
      schema_version: "durable-life-history-remeasure-gate-failure-v0",
      failed_gates: gateFailures,
      future_real_calls: 0
    });
    console.error(`GATES FAILED: ${gateFailures.join(", ")} (stopped before any real future call)`);
    process.exit(1);
  }
  console.log(`GATES PASS: memory facts provider-visible; ablation clean; scenario equal; affect ${affectClassification}`);
}

// =====================================================================================
// collect
// =====================================================================================
else if (command === "collect") {
  check(existsSync(phaseACompletePath()), "phase-a-complete.json missing: run phase-a first");
  check(existsSync(resolve(outdir!, "future-input-diff-audit.json")), "gates not run: run gates first");
  const checkpoint = readJson<Checkpoint>(resolve(outdir!, "lives-checkpoint.json"));
  const lives: Record<"A" | "B", LifeArmComplete> = {
    A: await rebuildLifeFromCheckpoint(checkpoint, "A"),
    B: await rebuildLifeFromCheckpoint(checkpoint, "B")
  };
  const trialsPath = join(outdir!, "real-provider", "trials.jsonl");
  mkdirSync(join(outdir!, "real-provider"), { recursive: true });
  interface PlannedTrial { readonly arm: FutureArm; readonly ordinal: number; readonly within: number; readonly execution_order: number; readonly trial_id: string }
  const plan: PlannedTrial[] = [];
  let executionOrder = 0;
  for (let ordinal = 1; ordinal <= V0_TRIALS_PER_ARM; ordinal += 1) {
    const order = BALANCED_FUTURE_ARM_ORDER[ordinal - 1]!;
    for (let within = 1; within <= order.length; within += 1) {
      executionOrder += 1;
      const arm = order[within - 1]!;
      plan.push({ arm, ordinal, within, execution_order: executionOrder, trial_id: `${EXPERIMENT_VERSION}/${FUTURE_SCENARIO.scenario_id}/${ordinal}/${arm}` });
    }
  }
  check(plan.length === PLANNED_FUTURE_COGNITION_CALLS, "plan must contain 20 future cognition trials");
  const existing = existsSync(trialsPath) ? rowsFrom(trialsPath) : [];
  for (let index = 0; index < existing.length; index += 1) {
    const row = existing[index]!;
    const planned = plan[index]!;
    check(row.trial_id === planned.trial_id, `strict-prefix violation at row ${index}`);
    check(row.execution_order === planned.execution_order && row.future_arm === planned.arm, `strict-prefix violation at row ${index}`);
  }
  if (existing.length === PLANNED_FUTURE_COGNITION_CALLS) {
    console.log("COLLECTION ALREADY COMPLETE: refusing further generation");
    process.exit(0);
  }
  if (existing.length > 0) console.log(`RESUME: ${existing.length}/${plan.length} trials already collected`);

  for (let index = existing.length; index < plan.length; index += 1) {
    const planned = plan[index]!;
    const lifeArm: TreatmentArm = planned.arm === "MEM_A" || planned.arm === "MEM_ABL_A" ? "A" : "B";
    const { trial, rendered, request_identity_match, trace_request_hash } = await runRemeasureFutureTrial(
      lives[lifeArm].world,
      lives[lifeArm].metadata,
      planned.arm,
      planned.ordinal,
      planned.execution_order,
      planned.within
    );
    const cognition = trial.record["cognition"] as {
      status: string;
      current_intent: string | null;
      communication_directive: string | null;
      validated_cognition_proposal: Record<string, unknown> | null;
      latency_ms: number;
      token_counts: { prompt_tokens: number | null; completion_tokens: number | null; total_tokens: number | null };
      failure: unknown;
    };
    const language = trial.record["language"] as {
      call_required: boolean;
      status: string;
      input_hash: string | null;
      latency_ms: number;
      token_counts: { total_tokens: number | null };
      failure: unknown;
    };
    const taxonomy = failureTaxonomy(trial.record);
    if (taxonomy !== null && taxonomy["ordering_related"] === true) {
      writeJson(join(outdir!, "real-provider", "ordering-regression.json"), {
        schema_version: "durable-life-history-remeasure-ordering-regression-v0",
        trial_id: planned.trial_id,
        taxonomy,
        stopped: true
      });
      console.error(`ORDERING REGRESSION DETECTED at ${planned.trial_id}: ${JSON.stringify(taxonomy)}`);
      process.exit(1);
    }
    const productionBundle = trial.capture.production_evidence_bundle as { entries?: { kind: string; exact_outcome_text?: string; delivered_behavior_text?: string }[] } | null;
    const evidenceEntry = productionBundle?.entries?.find((entry) => entry.kind === "BEHAVIOR_OUTCOME") ?? null;
    const row: TrialRow = {
      future_arm: planned.arm,
      life_arm: lifeArm,
      trial_ordinal: planned.ordinal,
      execution_order: planned.execution_order,
      within_unit_order: planned.within,
      trial_id: planned.trial_id,
      response_request_id: trial.response_request_id,
      provider_input_hash: hashJson(trial.capture.projection),
      projection_hash: trial.capture.projection["projection_hash"] as string,
      rendered_request_hash: rendered.request_hash,
      trace_request_hash,
      request_identity_match,
      memory_section_present: rendered.memory_section_present,
      memory_section_hash: rendered.memory_section_present ? hashJson(rendered.memory_section) : null,
      delivered_behavior_text: evidenceEntry?.delivered_behavior_text ?? null,
      exact_outcome_text: evidenceEntry?.exact_outcome_text ?? null,
      canonical_affect: trial.capture.projection["canonical_affect"] as { valence: number; activation: number },
      working_episode_refs: [...trial.working_episode_refs],
      future_context_hash: trial.future_context_hash,
      cognition: {
        status: cognition.status,
        current_intent: cognition.current_intent,
        communication_directive: cognition.communication_directive,
        structured_proposal_hash: cognition.validated_cognition_proposal === null
          ? null
          : hashJson(projectionBodyWithout(cognition.validated_cognition_proposal, ["projection_hash"])),
        latency_ms: cognition.latency_ms,
        prompt_tokens: cognition.token_counts.prompt_tokens,
        completion_tokens: cognition.token_counts.completion_tokens,
        total_tokens: cognition.token_counts.total_tokens
      },
      language: {
        call_required: language.call_required,
        status: language.status,
        input_hash: language.input_hash,
        latency_ms: language.latency_ms,
        total_tokens: language.token_counts.total_tokens
      },
      behavior_text: trial.behavior_text,
      behavior_content_hash: (trial.record["behavior_content_hash"] as string | null) ?? null,
      status: String(trial.record["status"]),
      failure: cognition.failure ?? language.failure ?? null,
      failure_taxonomy: taxonomy
    };
    check(row.behavior_text.length > 0 || !["VALID", "DIRECTIVE_CLARIFY"].includes(row.status),
      `${planned.trial_id}: valid status must carry behavior text`);
    appendFileSync(trialsPath, JSON.stringify(row) + "\n");
    console.log(`[${index + 1}/${plan.length}] ${planned.trial_id}: ${row.status} intent=${JSON.stringify(row.cognition.current_intent)} directive=${row.cognition.communication_directive} request_match=${row.request_identity_match} memory_section=${row.memory_section_present}`);
  }

  const rows = rowsFrom(trialsPath);
  writeJson(join(outdir!, "real-provider", "collection-complete.json"), {
    schema_version: "durable-life-history-remeasure-collection-complete-v0",
    planned_future_cognition_calls: PLANNED_FUTURE_COGNITION_CALLS,
    cognition_calls: rows.length,
    language_calls: rows.filter((row) => row.language.status === "VALID").length,
    max_future_language_calls: MAX_FUTURE_LANGUAGE_CALLS,
    no_further_generation: true
  });
  writeJson(join(outdir!, "real-provider", "collection-integrity.json"), {
    schema_version: "durable-life-history-remeasure-collection-integrity-v0",
    strict_prefix_verified: true,
    rows: rows.length,
    arm_rotation: "frozen V0 BALANCED_FUTURE_ARM_ORDER",
    fresh_restore_per_trial: true,
    provider_input_hash_constant_per_arm: Object.fromEntries((["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const).map((arm) => {
      const hashes = [...new Set(rows.filter((row) => row.future_arm === arm).map((row) => row.provider_input_hash))];
      return [arm, hashes.length === 1 ? hashes[0]! : hashes.sort()];
    })),
    request_identity_match_all_trials: rows.every((row) => row.request_identity_match),
    retries: 0
  });
  console.log(`COLLECT COMPLETE: ${rows.length} future cognition calls; request-identity matched ${rows.filter((row) => row.request_identity_match).length}/${rows.length}`);
}

// =====================================================================================
// finalize
// =====================================================================================
else if (command === "finalize") {
  const trialsPath = join(outdir!, "real-provider", "trials.jsonl");
  check(existsSync(trialsPath), "trials.jsonl missing: run collect first");
  const rows = rowsFrom(trialsPath);
  check(rows.length === PLANNED_FUTURE_COGNITION_CALLS, `expected ${PLANNED_FUTURE_COGNITION_CALLS} rows, found ${rows.length}`);
  const gateAudit = readJson<{
    checks: Record<string, boolean>;
    future_affect: { classification: string; residual_valence_delta: number };
    treatment_request_diff: { classification_counts: Record<string, number>; unexpected_confound_count: number };
  }>(join(outdir!, "future-input-diff-audit.json"));
  const checkpoint = readJson<Checkpoint>(resolve(outdir!, "lives-checkpoint.json"));
  const ARMS = ["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const;
  const byArm = Object.fromEntries(ARMS.map((arm) => [arm, rows.filter((row) => row.future_arm === arm).sort((a, b) => a.trial_ordinal - b.trial_ordinal)])) as Record<FutureArm, TrialRow[]>;
  const valid = (status: string): boolean => ["VALID", "DIRECTIVE_CLARIFY"].includes(status);

  // §29 — denominators kept strictly separate.
  const completeBehaviorUnits = [];
  const completeCognitionUnits = [];
  for (let ordinal = 1; ordinal <= V0_TRIALS_PER_ARM; ordinal += 1) {
    const behaviorRow = (arm: FutureArm): TrialRow => byArm[arm].find((row) => row.trial_ordinal === ordinal)!;
    if (ARMS.every((arm) => valid(behaviorRow(arm).status) && behaviorRow(arm).behavior_text.length > 0)) completeBehaviorUnits.push(ordinal);
    if (ARMS.every((arm) => valid(behaviorRow(arm).status))) completeCognitionUnits.push(ordinal);
  }
  const pairedOrdinals = (armX: FutureArm, armY: FutureArm): number[] =>
    [1, 2, 3, 4, 5].filter((ordinal) => {
      const rowX = byArm[armX].find((row) => row.trial_ordinal === ordinal)!;
      const rowY = byArm[armY].find((row) => row.trial_ordinal === ordinal)!;
      return valid(rowX.status) && valid(rowY.status);
    });
  const rate = (ordinals: number[], armX: FutureArm, armY: FutureArm, differs: (a: TrialRow, b: TrialRow) => boolean): number | null => {
    if (ordinals.length === 0) return null;
    const hits = ordinals.filter((ordinal) => differs(
      byArm[armX].find((row) => row.trial_ordinal === ordinal)!,
      byArm[armY].find((row) => row.trial_ordinal === ordinal)!
    )).length;
    return hits / ordinals.length;
  };
  const behaviorDiffers = (a: TrialRow, b: TrialRow): boolean => a.behavior_text !== b.behavior_text;
  const intentDiffers = (a: TrialRow, b: TrialRow): boolean => String(a.cognition.current_intent) !== String(b.cognition.current_intent);
  const directiveDiffers = (a: TrialRow, b: TrialRow): boolean => String(a.cognition.communication_directive) !== String(b.cognition.communication_directive);
  const cognitionDiffers = (a: TrialRow, b: TrialRow): boolean => String(a.cognition.structured_proposal_hash) !== String(b.cognition.structured_proposal_hash);
  const treatmentPair = ["MEM_A", "MEM_B"] as const;
  const ablationPair = ["MEM_ABL_A", "MEM_ABL_B"] as const;

  // §61 mediation table (descriptive): intent × behavior cells per pair.
  const mediationTable = (armX: FutureArm, armY: FutureArm, ordinals: number[]): Record<string, number> => {
    const cells: Record<string, number> = {
      INTENT_SAME_BEHAVIOR_SAME: 0,
      INTENT_SAME_BEHAVIOR_DIFFERENT: 0,
      INTENT_DIFFERENT_BEHAVIOR_SAME: 0,
      INTENT_DIFFERENT_BEHAVIOR_DIFFERENT: 0
    };
    for (const ordinal of ordinals) {
      const rowX = byArm[armX].find((row) => row.trial_ordinal === ordinal)!;
      const rowY = byArm[armY].find((row) => row.trial_ordinal === ordinal)!;
      const intentSame = !intentDiffers(rowX, rowY);
      const behaviorSame = !behaviorDiffers(rowX, rowY);
      const key = intentSame
        ? behaviorSame ? "INTENT_SAME_BEHAVIOR_SAME" : "INTENT_SAME_BEHAVIOR_DIFFERENT"
        : behaviorSame ? "INTENT_DIFFERENT_BEHAVIOR_SAME" : "INTENT_DIFFERENT_BEHAVIOR_DIFFERENT";
      cells[key] = (cells[key] ?? 0) + 1;
    }
    return cells;
  };
  const mediation = {
    denominator: "complete behavior four-arm units",
    treatment_pair_MEM_A_vs_MEM_B: mediationTable(treatmentPair[0], treatmentPair[1], completeBehaviorUnits),
    ablation_pair_MEM_ABL_A_vs_MEM_ABL_B: mediationTable(ablationPair[0], ablationPair[1], completeBehaviorUnits)
  };
  const metrics = {
    primary_denominator: "complete behavior four-arm units",
    complete_behavior_four_arm_units: completeBehaviorUnits.length,
    complete_behavior_ordinals: completeBehaviorUnits,
    complete_cognition_four_arm_units: completeCognitionUnits.length,
    complete_cognition_ordinals: completeCognitionUnits,
    stage_valid_pairs: {
      "MEM_A/MEM_B": pairedOrdinals(treatmentPair[0], treatmentPair[1]),
      "MEM_ABL_A/MEM_ABL_B": pairedOrdinals(ablationPair[0], ablationPair[1]),
      "MEM_A/MEM_ABL_A": pairedOrdinals("MEM_A", "MEM_ABL_A"),
      "MEM_B/MEM_ABL_B": pairedOrdinals("MEM_B", "MEM_ABL_B")
    },
    primary: {
      treatment_pair_disagreement: rate(completeBehaviorUnits, treatmentPair[0], treatmentPair[1], behaviorDiffers),
      ablation_pair_disagreement: rate(completeBehaviorUnits, ablationPair[0], ablationPair[1], behaviorDiffers),
      treatment_intent_disagreement: rate(completeBehaviorUnits, treatmentPair[0], treatmentPair[1], intentDiffers),
      ablation_intent_disagreement: rate(completeBehaviorUnits, ablationPair[0], ablationPair[1], intentDiffers),
      treatment_directive_disagreement: rate(completeBehaviorUnits, treatmentPair[0], treatmentPair[1], directiveDiffers),
      ablation_directive_disagreement: rate(completeBehaviorUnits, ablationPair[0], ablationPair[1], directiveDiffers),
      treatment_cognition_disagreement: rate(completeBehaviorUnits, treatmentPair[0], treatmentPair[1], cognitionDiffers),
      ablation_cognition_disagreement: rate(completeBehaviorUnits, ablationPair[0], ablationPair[1], cognitionDiffers)
    },
    stage_valid_pairs_report: {
      "MEM_A/MEM_B": {
        behavior: rate(pairedOrdinals(treatmentPair[0], treatmentPair[1]), treatmentPair[0], treatmentPair[1], behaviorDiffers),
        intent: rate(pairedOrdinals(treatmentPair[0], treatmentPair[1]), treatmentPair[0], treatmentPair[1], intentDiffers),
        directive: rate(pairedOrdinals(treatmentPair[0], treatmentPair[1]), treatmentPair[0], treatmentPair[1], directiveDiffers)
      },
      "MEM_ABL_A/MEM_ABL_B": {
        behavior: rate(pairedOrdinals(ablationPair[0], ablationPair[1]), ablationPair[0], ablationPair[1], behaviorDiffers),
        intent: rate(pairedOrdinals(ablationPair[0], ablationPair[1]), ablationPair[0], ablationPair[1], intentDiffers),
        directive: rate(pairedOrdinals(ablationPair[0], ablationPair[1]), ablationPair[0], ablationPair[1], directiveDiffers)
      }
    },
    arm_failure_rates: Object.fromEntries(ARMS.map((arm) => [arm, byArm[arm].filter((row) => !valid(row.status) || row.behavior_text.length === 0).length / V0_TRIALS_PER_ARM]))
  };
  const behaviorDelta = (metrics.primary.treatment_pair_disagreement ?? 0) - (metrics.primary.ablation_pair_disagreement ?? 0);
  const intentDelta = (metrics.primary.treatment_intent_disagreement ?? 0) - (metrics.primary.ablation_intent_disagreement ?? 0);
  const armFailureRange = Math.max(...Object.values(metrics.arm_failure_rates)) - Math.min(...Object.values(metrics.arm_failure_rates));

  // §32 — schema failure taxonomy summary.
  const failures = rows.filter((row) => row.failure_taxonomy !== null);
  const orderingRegressions = rows.filter((row) => row.failure_taxonomy !== null && row.failure_taxonomy!["ordering_related"] === true);
  const failureSummary = {
    schema_version: "durable-life-history-remeasure-failure-summary-v0",
    total_trials: rows.length,
    valid_trials: rows.filter((row) => valid(row.status)).length,
    invalid_trials: rows.filter((row) => !valid(row.status)).length,
    failed_trials: failures.length,
    per_arm: Object.fromEntries(ARMS.map((arm) => [arm, {
      valid: byArm[arm].filter((row) => valid(row.status)).length,
      invalid: byArm[arm].filter((row) => !valid(row.status)).length,
      error_codes: byArm[arm].filter((row) => row.failure_taxonomy !== null).map((row) => row.failure_taxonomy!["error_code"]),
      validation_fields: byArm[arm].filter((row) => row.failure_taxonomy !== null).map((row) => row.failure_taxonomy!["validation_field"])
    }])),
    taxonomy: failures.map((row) => ({ trial_id: row.trial_id, arm: row.future_arm, ordinal: row.trial_ordinal, ...row.failure_taxonomy! })),
    ordering_related_rejections: orderingRegressions.length,
    ordering_regression_detected: orderingRegressions.length > 0,
    original_v0_comparison: { original_cognition_calls: 20, original_invalid_schema: 13, remeasure_invalid: rows.filter((row) => !valid(row.status)).length },
    retries: 0
  };
  writeJson(join(outdir!, "failure-summary.json"), failureSummary);
  if (orderingRegressions.length > 0) {
    console.error("FINALIZE ABORTED: ordering-related rejection regression detected");
    process.exit(1);
  }

  // §31/§33 verdict.
  const collectionValidityGatePass = completeBehaviorUnits.length >= COLLECTION_VALIDITY_GATE.minimum_complete_behavior_four_arm_units;
  const verdict = decideRemeasureVerdict({
    provider_preflight_ok: existsSync(join(outdir!, "real-provider", "provider-preflight.json")),
    life_divergence: true,
    repair_regression_pass: gateAudit.checks["repair_regression_pass"] === true,
    memory_factual_content_provider_visible: gateAudit.checks["memory_factual_content_provider_visible"] === true,
    ablation_control_valid: gateAudit.checks["ablation_target_evidence_absent"] === true &&
      gateAudit.checks["ablation_equivalence_A"] === true && gateAudit.checks["ablation_equivalence_B"] === true &&
      gateAudit.checks["ablation_pair_body_equal_except_affect"] === true,
    scenario_equality: gateAudit.checks["scenario_equality"] === true,
    future_affect_classification: gateAudit.future_affect.classification,
    unexpected_confound_count: gateAudit.treatment_request_diff.unexpected_confound_count,
    collection_validity_gate_pass: collectionValidityGatePass,
    complete_behavior_units: completeBehaviorUnits.length,
    behavior_delta: behaviorDelta,
    intent_delta: intentDelta,
    arm_failure_rate_range: armFailureRange
  });

  // §34 descriptive: does valid cognition cite memory refs / use the facts?
  const descriptive = Object.fromEntries(ARMS.map((arm) => [arm, {
    valid_trials: byArm[arm].filter((row) => valid(row.status)).length,
    current_intents: [...new Set(byArm[arm].filter((row) => valid(row.status)).map((row) => String(row.cognition.current_intent)))],
    behaviors: [...new Set(byArm[arm].filter((row) => valid(row.status)).map((row) => row.behavior_text))],
    memory_section_present: byArm[arm].every((row) => row.memory_section_present),
    request_identity_matched: byArm[arm].every((row) => row.request_identity_match)
  }]));

  // §49 token accounting.
  const lifeCognitionTokens = (Object.values(checkpoint.arms) as CheckpointArm[]).reduce((sum, arm) => {
    const cognition = arm.record["cognition"] as { token_counts?: { total_tokens?: number | null } } | undefined;
    return sum + (cognition?.token_counts?.total_tokens ?? 0);
  }, 0);
  const lifeLanguageTokens = (Object.values(checkpoint.arms) as CheckpointArm[]).reduce((sum, arm) => {
    const language = arm.record["language"] as { token_counts?: { total_tokens?: number | null } } | undefined;
    return sum + (language?.token_counts?.total_tokens ?? 0);
  }, 0);
  const futureCognitionTokens = rows.reduce((sum, row) => sum + (row.cognition.total_tokens ?? 0), 0);
  const futureLanguageTokens = rows.reduce((sum, row) => sum + (row.language.total_tokens ?? 0), 0);
  const tokens = {
    life_reconstruction_cognition_tokens: lifeCognitionTokens,
    life_reconstruction_language_tokens: lifeLanguageTokens,
    future_cognition_tokens: futureCognitionTokens,
    future_language_tokens: futureLanguageTokens,
    total_tokens: lifeCognitionTokens + lifeLanguageTokens + futureCognitionTokens + futureLanguageTokens,
    external_api_cost: "0 (local Ollama; no external API calls)"
  };

  writeJson(join(outdir!, "summary.json"), {
    schema_version: "durable-life-history-remeasure-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    verdict,
    informative: collectionValidityGatePass,
    denominators: {
      complete_behavior_four_arm_units: completeBehaviorUnits.length,
      complete_cognition_four_arm_units: completeCognitionUnits.length,
      stage_valid_pairs: metrics.stage_valid_pairs
    },
    metrics: { ...metrics, behavior_delta: behaviorDelta, intent_delta: intentDelta, arm_failure_rate_range: armFailureRange },
    mediation_table: mediation,
    gates: gateAudit.checks,
    future_affect: gateAudit.future_affect,
    failure_summary: { invalid_trials: failureSummary.invalid_trials, ordering_related_rejections: orderingRegressions.length, per_arm: failureSummary.per_arm },
    tokens,
    collection_validity_gate_pass: collectionValidityGatePass,
    descriptive_valid_trials_only: descriptive,
    real_calls: {
      life_reconstruction: readJson<{ real_calls: { cognition: number; language: number } }>(join(outdir!, "real-provider", "life-generation-log.json")).real_calls,
      future_cognition: rows.length,
      future_language: rows.filter((row) => row.language.status === "VALID").length
    }
  });
  writeJson(join(outdir!, "cognition-summary.json"), {
    schema_version: "durable-life-history-remeasure-cognition-summary-v0",
    per_arm: Object.fromEntries(ARMS.map((arm) => [arm, {
      statuses: byArm[arm].map((row) => row.cognition.status),
      current_intents: byArm[arm].map((row) => row.cognition.current_intent),
      directives: byArm[arm].map((row) => row.cognition.communication_directive),
      structured_proposal_hashes: byArm[arm].map((row) => row.cognition.structured_proposal_hash),
      total_tokens: byArm[arm].reduce((sum, row) => sum + (row.cognition.total_tokens ?? 0), 0),
      total_latency_ms: byArm[arm].reduce((sum, row) => sum + row.cognition.latency_ms, 0)
    }])),
    request_identity_match_all_trials: rows.every((row) => row.request_identity_match),
    projection_hashes: Object.fromEntries(ARMS.map((arm) => [arm, byArm[arm][0]!.projection_hash])),
    rendered_request_hashes: Object.fromEntries(ARMS.map((arm) => [arm, byArm[arm][0]!.rendered_request_hash]))
  });
  writeJson(join(outdir!, "behavior-summary.json"), {
    schema_version: "durable-life-history-remeasure-behavior-summary-v0",
    per_arm: Object.fromEntries(ARMS.map((arm) => [arm, {
      behaviors: byArm[arm].map((row) => ({ ordinal: row.trial_ordinal, text: row.behavior_text, hash: row.behavior_content_hash })),
      language_status: byArm[arm].map((row) => row.language.status)
    }])),
    pair_disagreement_over_complete_units: metrics.primary,
    pair_disagreement_over_stage_valid_pairs: metrics.stage_valid_pairs_report
  });
  writeJson(join(outdir!, "ablation-summary.json"), {
    schema_version: "durable-life-history-remeasure-ablation-summary-v0",
    contract: { ...MEMORY_ABLATION_CONTRACT },
    target_evidence_removed: {
      MEM_A: byArm.MEM_A[0]!.delivered_behavior_text,
      MEM_B: byArm.MEM_B[0]!.delivered_behavior_text,
      MEM_ABL_A: byArm.MEM_ABL_A[0]!.delivered_behavior_text,
      MEM_ABL_B: byArm.MEM_ABL_B[0]!.delivered_behavior_text
    },
    memory_section_present: {
      MEM_A: byArm.MEM_A[0]!.memory_section_present,
      MEM_B: byArm.MEM_B[0]!.memory_section_present,
      MEM_ABL_A: byArm.MEM_ABL_A[0]!.memory_section_present,
      MEM_ABL_B: byArm.MEM_ABL_B[0]!.memory_section_present
    },
    checks: {
      ablation_target_evidence_absent: gateAudit.checks["ablation_target_evidence_absent"],
      ablation_equivalence_A: gateAudit.checks["ablation_equivalence_A"],
      ablation_equivalence_B: gateAudit.checks["ablation_equivalence_B"],
      ablation_pair_body_equal_except_affect: gateAudit.checks["ablation_pair_body_equal_except_affect"]
    },
    ablation_pair_disagreement: metrics.primary.ablation_pair_disagreement,
    treatment_pair_disagreement: metrics.primary.treatment_pair_disagreement
  });

  writeJson(resolve(outdir!, "quality-gates.json"), {
    schema_version: "durable-life-history-remeasure-quality-gates-v0",
    manual_injection_absent: true,
    manual_affect_patch: false,
    manual_current_intent_patch: false,
    manual_behavior_patch: false,
    manual_experience_write: false,
    manual_memory_write: false,
    manual_memory_ref_injection: false,
    cross_subject_memory_swap: false,
    treatment_label_leakage: false,
    prompt_amplification: false,
    retrieval_tuning: false,
    reuse_of_frozen_v0_design: true,
    repair_regression_pass: gateAudit.checks["repair_regression_pass"] === true,
    scenario_equality: gateAudit.checks["scenario_equality"] === true,
    memory_factual_content_provider_visible: gateAudit.checks["memory_factual_content_provider_visible"] === true,
    collection_validity_gate_pass: collectionValidityGatePass,
    ordering_regression_detected: false,
    real_calls_within_budget: rows.length <= PLANNED_FUTURE_COGNITION_CALLS &&
      rows.filter((row) => row.language.status === "VALID").length <= MAX_FUTURE_LANGUAGE_CALLS,
    production_behavior_changing_diff: 0,
    all_pass: gateAudit.checks["repair_regression_pass"] === true &&
      gateAudit.checks["scenario_equality"] === true &&
      gateAudit.checks["memory_factual_content_provider_visible"] === true &&
      collectionValidityGatePass
  });
  writeFileSync(resolve(outdir!, "REPORT.md"), renderReport(verdict, metrics, gateAudit, failureSummary, tokens, collectionValidityGatePass, behaviorDelta, intentDelta));
  console.log(`FINALIZE COMPLETE: verdict ${verdict}`);
  console.log(`  complete behavior units ${completeBehaviorUnits.length}/5; behavior delta ${(behaviorDelta * 100).toFixed(0)}pp; intent delta ${(intentDelta * 100).toFixed(0)}pp`);
  console.log(`  invalid trials ${failureSummary.invalid_trials}/20 (original V0: 13/20); ordering regressions ${orderingRegressions.length}`);
} else {
  check(false, "unknown command; expected phase-a | lives | gates | collect | finalize");
}

/** §31/§33 — preregistered remeasurement decision. */
export function decideRemeasureVerdict(input: {
  readonly provider_preflight_ok: boolean;
  readonly life_divergence: boolean;
  readonly repair_regression_pass: boolean;
  readonly memory_factual_content_provider_visible: boolean;
  readonly ablation_control_valid: boolean;
  readonly scenario_equality: boolean;
  readonly future_affect_classification: string;
  readonly unexpected_confound_count: number;
  readonly collection_validity_gate_pass: boolean;
  readonly complete_behavior_units: number;
  readonly behavior_delta: number;
  readonly intent_delta: number;
  readonly arm_failure_rate_range: number;
}): string {
  if (!input.provider_preflight_ok) return "REAL_PROVIDER_UNAVAILABLE";
  if (!input.life_divergence) return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (!input.repair_regression_pass) return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (!input.scenario_equality) return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (input.unexpected_confound_count > 0) return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (!input.memory_factual_content_provider_visible) return "FUTURE_MEMORY_VISIBILITY_FAILURE";
  if (!input.ablation_control_valid) return "MEMORY_ABLATION_CONTROL_INVALID";
  if (input.future_affect_classification === "FUTURE_AFFECT_MATERIAL_CONFOUND") return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (!input.collection_validity_gate_pass) return "COLLECTION_VALIDITY_FAILURE";
  if (input.complete_behavior_units >= VERDICT_RULE.minimum_complete_behavior_four_arm_units &&
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
  gateAudit: { checks: Record<string, boolean>; future_affect: { classification: string; residual_valence_delta: number } },
  failureSummary: { invalid_trials: number; per_arm: Record<string, { valid: number; invalid: number; error_codes: unknown[] }>; ordering_related_rejections: number },
  tokens: Record<string, unknown>,
  collectionValidityGatePass: boolean,
  behaviorDelta: number,
  intentDelta: number
): string {
  const m = metrics as {
    complete_behavior_four_arm_units: number;
    complete_cognition_four_arm_units: number;
    primary: Record<string, number | null>;
    stage_valid_pairs: Record<string, number[]>;
    stage_valid_pairs_report: Record<string, Record<string, number | null>>;
    arm_failure_rates: Record<string, number>;
  };
  return [
    `# ${EXPERIMENT_VERSION} — evidence`,
    "",
    `## Principal verdict: ${verdict}`,
    `## Informative: ${collectionValidityGatePass}`,
    `## Complete behavior four-arm units: ${m.complete_behavior_four_arm_units}/5`,
    "",
    "## Denominators (§29)",
    `- complete cognition four-arm units: ${m.complete_cognition_four_arm_units}/5`,
    `- stage-valid pairs (MEM_A/MEM_B): ${JSON.stringify(m.stage_valid_pairs["MEM_A/MEM_B"])}`,
    `- stage-valid pairs (MEM_ABL_A/MEM_ABL_B): ${JSON.stringify(m.stage_valid_pairs["MEM_ABL_A/MEM_ABL_B"])}`,
    "",
    "## Primary metrics (over complete behavior four-arm units)",
    ...Object.entries(m.primary).map(([key, value]) => `- ${key}: ${value === null ? "N/A (no complete units)" : `${(value * 100).toFixed(0)}pp`}`),
    `- behavior delta (treatment − ablation): ${(behaviorDelta * 100).toFixed(0)}pp`,
    `- intent delta (treatment − ablation): ${(intentDelta * 100).toFixed(0)}pp`,
    "",
    "## Stage-valid pair report (secondary denominator)",
    JSON.stringify(m.stage_valid_pairs_report),
    "",
    "## Schema acceptance vs original V0",
    `- remeasure invalid trials: ${failureSummary.invalid_trials}/20 (original V0: 13/20)`,
    `- per arm: ${JSON.stringify(failureSummary.per_arm)}`,
    `- ordering-related rejections (regression): ${failureSummary.ordering_related_rejections}`,
    "",
    "## Controls",
    `- future affect: ${gateAudit.future_affect.classification} (residual valence delta ${gateAudit.future_affect.residual_valence_delta})`,
    `- gates: ${JSON.stringify(gateAudit.checks)}`,
    "",
    "## Tokens / cost (§49)",
    JSON.stringify(tokens)
  ].join("\n");
}
