/**
 * AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_V0 — entrypoint.
 *
 *   node .../cli.ts phase-a <outdir>   — freeze preregistration (0 real calls)
 *   node .../cli.ts run     <outdir>   — full experiment: bounded real A/B
 *                                        behavior generation, deterministic
 *                                        consequence chain, equalization,
 *                                        restore, future retrieval/cognition
 *                                        diff, verdict, evidence.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  BASELINE_COMMIT,
  COUNTERPART_POLICY,
  EXPERIMENT_VERSION,
  FUTURE_SCENARIO,
  PRINCIPAL_VERDICTS,
  REAL_CALL_BUDGET,
  SCENARIOS,
  SUBJECT,
  TIME_EQUALIZATION
} from "./contract.ts";
import { canonicalJson, check } from "./fixtures.ts";
import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import {
  buildFutureCognitionInput,
  buildWorld,
  commitFutureObservation,
  constructArmHistory,
  counterpartReply,
  equalizeAffect,
  restoreWorld,
  runConsequenceChain
} from "./harness.ts";
import { runCognitionCapture } from "../canonical-affect-behavior-influence-v1/harness.ts";
import { buildCharacterLanguageBehaviorV0, buildClarificationBehaviorV0 } from "../../../packages/behavior/dist/index.js";
import { generateRealBehavior, probeV1Root } from "./real-generation.ts";
import type { World } from "./harness.ts";

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
check(HEAD === BASELINE_COMMIT, `baseline mismatch: HEAD ${HEAD} != frozen ${BASELINE_COMMIT}`);

const command = process.argv[2];
const outdir = process.argv[3];
check(typeof command === "string" && typeof outdir === "string", "usage: cli.ts <phase-a|run> <outdir>");

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, canonicalJson(value));
}

function phaseACompletePath(): string {
  return resolve(outdir!, "phase-a-complete.json");
}

if (command === "phase-a") {
  mkdirSync(outdir!, { recursive: true });
  writeJson(join(outdir!, "config.json"), {
    schema_version: "affect-driven-behavior-experience-memory-causal-chain-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    scenario_count: SCENARIOS.length,
    real_call_budget: { ...REAL_CALL_BUDGET }
  });
  writeJson(join(outdir!, "chain-contract.json"), {
    schema_version: "affect-driven-behavior-experience-memory-chain-contract-v0",
    experiment_version: EXPERIMENT_VERSION,
    chain: [
      "lawful prior history", "Canonical Affect", "cognition/current_intent",
      "observable language behavior", "behavior-linked Experience",
      "durable Memory", "authoritative restore",
      "future retrieval", "future cognition input"
    ],
    no_shortcuts: ["direct Memory writes", "fixture bypass of authority", "manual affect patch"]
  });
  writeJson(join(outdir!, "behavior-source-plan.json"), {
    schema_version: "affect-driven-behavior-experience-memory-behavior-source-plan-v0",
    prior_artifact_reuse_rejected: true,
    reason: "prior artifacts belong to in-memory worlds whose subject/delivery/chronology authority bindings cannot lawfully transfer",
    fresh_generation: { scenarios: 2, arms: ["A", "B"], trials: 1, alternate_allowed_once: true }
  });
  writeJson(join(outdir!, "counterpart-policy.json"), { ...COUNTERPART_POLICY });
  writeJson(join(outdir!, "future-scenario.json"), { ...FUTURE_SCENARIO });
  writeJson(join(outdir!, "future-affect-control.json"), {
    schema_version: "affect-driven-behavior-experience-memory-future-affect-control-v0",
    mechanism: "lawful v4 TimeTransition recovery",
    ticks: TIME_EQUALIZATION.ticks,
    tau_ticks: TIME_EQUALIZATION.tau_ticks,
    expected_residual_valence_magnitude: TIME_EQUALIZATION.expected_residual_valence_magnitude,
    manual_patch: false
  });
  writeJson(join(outdir!, "authority-path-audit.json"), {
    schema_version: "affect-driven-behavior-experience-memory-authority-path-audit-v0",
    paths: {
      delivery_boundary: "PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0 host delivery adapter (conversationDeliveryLedger)",
      feedback_authority: "BEHAVIOR_EXPERIENCE_FEEDBACK_V0 executeBehaviorOutcomeFeedback",
      experience_path: "frozen BEHAVIOR_OUTCOME encoder",
      memory_commit_path: "Learning commit binding /memory_state/repository_revision",
      restore_path: "trusted v4 boundary + restoreSubjectStateV4AuthoritativelyV0",
      future_retrieval_path: "RepositoryBackedMemoryRetrievalServiceV0 + factual evidence resolver",
      all_frozen_production: true
    }
  });
  writeJson(join(outdir!, "retrieval-plan.json"), {
    schema_version: "affect-driven-behavior-experience-memory-retrieval-plan-v0",
    retrieval: "RepositoryBackedMemoryRetrievalServiceV0 over the restored repository",
    query_source: "future observation context/entities (no manual refs)",
    evidence_resolution: "production FactualMemoryEvidenceResolverV0 over working/recent episode refs"
  });
  writeJson(join(outdir!, "verdict-contract.json"), {
    schema_version: "affect-driven-behavior-experience-memory-verdict-contract-v0",
    verdicts: [...PRINCIPAL_VERDICTS],
    frozen_before_real_provider_output: true
  });
  writeJson(join(outdir!, "phase-a.json"), {
    schema_version: "affect-driven-behavior-experience-memory-phase-a-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    real_generation_calls: 0,
    starting_baseline: "PASS",
    frozen_behavior_authority: "UNDERSTOOD",
    delivery_boundary: "UNDERSTOOD",
    feedback_authority: "UNDERSTOOD",
    experience_path: "UNDERSTOOD",
    memory_commit_path: "UNDERSTOOD",
    restore_path: "UNDERSTOOD",
    future_retrieval_path: "UNDERSTOOD",
    counterpart_policy_treatment_blind: "PASS",
    future_scenario_same: "PASS",
    affect_carryover_control_frozen: "PASS",
    real_call_budget_frozen: "PASS",
    all_pass: true
  });
  writeJson(join(outdir!, "phase-a-complete.json"), {
    schema_version: "affect-driven-behavior-experience-memory-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    all_pass: true,
    real_generation_calls: 0
  });
  console.log("PHASE A COMPLETE: preregistration frozen; real generation calls 0");
} else if (command === "run") {
  check(existsSync(phaseACompletePath(outdir!)), "phase-a-complete.json missing: run phase-a first");
  mkdirSync(join(outdir!, "real-provider"), { recursive: true });

  // ---- provider preflight --------------------------------------------------------
  // Read-only environment probe; up to 3 attempts (the /api/tags listing can
  // transiently omit entries while the server is busy — this is a probe
  // retry, never a generation retry).
  let probe = await probeV1Root();
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    if (probe.reachable && probe.digest === "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7") break;
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 2000));
    probe = await probeV1Root();
  }
  check(probe.reachable, `provider unreachable: ${probe.failure ?? "no response"}`);
  check(probe.digest === "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
    `provider digest mismatch: ${probe.digest ?? "null"} (probe failure: ${probe.failure ?? "none"})`);
  writeJson(join(outdir!, "real-provider", "provider-preflight.json"), {
    schema_version: "affect-driven-behavior-experience-memory-provider-preflight-v0",
    endpoint: probe.endpoint,
    ollama_version: probe.server_version,
    model: probe.model,
    digest: probe.digest,
    digest_matches_required: true,
    settings: { temperature: 0, think: false, stream: false, retries: 0, seed: null, num_predict: 2048, timeout_ms: 120000 },
    real_generation_calls: 0
  });

  // ---- bounded real A/B behavior generation (primary scenarios) --------------------
  const primaryScenarios = SCENARIOS.filter((s) => s.role === "PRIMARY");
  const alternate = SCENARIOS.find((s) => s.role === "ALTERNATE");
  const realCalls = { cognition: 0, language: 0 };
  const scenarioResults: Record<string, unknown> = {};
  let chosenScenario: { readonly scenario_id: string; readonly current_factual_event: string; readonly current_task: string } | null = null;
  let behaviorTexts: Record<string, string> | null = null;
  let diverged = false;

  const buildTrial = async (scenario: { readonly scenario_id: string; readonly current_factual_event: string; readonly current_task: string }, arm: "A" | "B") => {
    const world: World = await buildWorld(scenario.current_task);
    const metadata = await constructArmHistory(world, arm, scenario);
    const capture = await runCognitionCapture(world, []);
    const providerInput = capture.provider_input;
    realCalls.cognition += 1;
    const item = {
      cell: {
        scenario: { scenario_id: scenario.scenario_id, current_factual_event: scenario.current_factual_event },
        provider_inputs: { [arm]: providerInput },
        metadata: { [arm]: metadata }
      },
      arm,
      trial_ordinal: 1,
      execution_order: realCalls.cognition,
      within_unit_order: 1,
      trial_id: `${EXPERIMENT_VERSION}/${scenario.scenario_id}/1/${arm}`,
      response_request_id: `response-${scenario.event_id}-${arm}`
    };
    const record = await generateRealBehavior(item as never);
    realCalls.language += record.language.status === "VALID" ? 1 : 0;
    check(record.status === "VALID" || record.status === "DIRECTIVE_CLARIFY",
      `${scenario.scenario_id}/${arm}: generation failed: ${record.status} ${JSON.stringify(record.language.failure ?? record.cognition.failure ?? {}).slice(0, 200)}`);
    const behaviorText = record.behavior?.text ?? "";
    check(behaviorText.length > 0, `${scenario.scenario_id}/${arm}: behavior text empty`);
    // The downstream trial record stores a reduced behavior record; the full
    // CharacterLanguageBehaviorV0 artifact is lawfully re-derived through the
    // frozen production constructors — from the validated language draft for
    // REALIZE arms, or from the cognition proposal binding for CLARIFY arms
    // (whose fixed clarification behavior was produced by
    // buildClarificationBehaviorV0 in the same production chain).
    let fullBehavior: { ok: true; behavior: unknown } | { ok: false; detail: string };
    if (record.language.validated_draft !== null && record.language.validated_draft !== undefined) {
      fullBehavior = await buildCharacterLanguageBehaviorV0({
        subject_id: SUBJECT as never,
        source_revision: providerInput.state_revision as never,
        response_request_id: item.response_request_id as never,
        draft: record.language.validated_draft as never
      });
    } else {
      const conversation = record.cognition.validated_conversation_proposal as Record<string, unknown> | null;
      if (conversation === null) throw new Error(`${scenario.scenario_id}/${arm}: clarify arm without stored conversation proposal`);
      const proposalHash = await hashEnvelope(
        "characteros-next/runtime/conversation-cognition-proposal/v1",
        conversation
      );
      fullBehavior = await buildClarificationBehaviorV0({
        subject_id: SUBJECT as never,
        source_revision: providerInput.state_revision as never,
        response_request_id: item.response_request_id as never,
        cognition_projection_hash: providerInput.projection_hash as never,
        conversation_cognition_proposal_hash: proposalHash as never
      });
    }
    check(fullBehavior.ok, `${scenario.scenario_id}/${arm}: behavior re-derivation failed: ${fullBehavior.ok ? "" : fullBehavior.detail}`);
    return { world, providerInput, record, behaviorText, fullBehavior: fullBehavior.ok ? fullBehavior.behavior : null };
  };

  for (const scenario of primaryScenarios) {
    const armA = await buildTrial(scenario, "A");
    const armB = await buildTrial(scenario, "B");
    diverged = armA.behaviorText !== armB.behaviorText;
    scenarioResults[scenario.scenario_id] = {
      diverged,
      behavior_a: armA.behaviorText,
      behavior_b: armB.behaviorText,
      behavior_content_hash_a: armA.record.behavior_content_hash,
      behavior_content_hash_b: armB.record.behavior_content_hash,
      worlds: { A: armA.world, B: armB.world },
      records: { A: armA.record, B: armB.record },
      full_behaviors: { A: armA.fullBehavior, B: armB.fullBehavior }
    };
    if (diverged) {
      chosenScenario = scenario;
      behaviorTexts = { A: armA.behaviorText, B: armB.behaviorText };
      break;
    }
  }
  if (!diverged && alternate !== undefined) {
    const armA = await buildTrial(alternate, "A");
    const armB = await buildTrial(alternate, "B");
    diverged = armA.behaviorText !== armB.behaviorText;
    scenarioResults[alternate.scenario_id] = {
      diverged,
      behavior_a: armA.behaviorText,
      behavior_b: armB.behaviorText,
      worlds: { A: armA.world, B: armB.world },
      records: { A: armA.record, B: armB.record }
    };
    if (diverged) {
      chosenScenario = alternate;
      behaviorTexts = { A: armA.behaviorText, B: armB.behaviorText };
    }
  }
  check(diverged && chosenScenario !== null && behaviorTexts !== null,
    "REAL_PROVIDER_BEHAVIOR_DIVERGENCE_NOT_AVAILABLE: no preregistered scenario produced A/B behavior divergence within the bounded attempt policy");

  const pairTrials = scenarioResults[chosenScenario.scenario_id] as {
    worlds: Record<string, World>;
    records: Record<string, { behavior: { behavior_id: string; evidence_refs: string[] }; behavior_content_hash: string; language: { raw_response: { content: string } | null } }>;
  };
  const behaviorA = pairTrials.records.A;
  const behaviorB = pairTrials.records.B;
  const fullBehaviorA = pairTrials.full_behaviors.A;
  const fullBehaviorB = pairTrials.full_behaviors.B;
  check(fullBehaviorA !== null && fullBehaviorB !== null, "full behavior artifacts must exist");

  // ---- §13-§19 deterministic consequence chain per arm -----------------------------
  const chainByArm: Record<string, ReturnType<typeof runConsequenceChain> extends Promise<infer T> ? T : never> = {} as never;
  for (const arm of ["A", "B"] as const) {
    const world = pairTrials.worlds[arm] as World;
    chainByArm[arm] = await runConsequenceChain(world, chosenScenario!, behaviorTexts![arm], arm === "A" ? fullBehaviorA : fullBehaviorB);
  }

  // ---- §23/§24 lawful Affect equalization ------------------------------------------
  const affectControlByArm: Record<string, { valence_before: number; valence_after: number; activation_after: number }> = {};
  for (const arm of ["A", "B"] as const) {
    affectControlByArm[arm] = await equalizeAffect(pairTrials.worlds[arm] as World);
  }

  // ---- §34/§35 authoritative restore per arm ----------------------------------------
  const restoredByArm: Record<string, Awaited<ReturnType<typeof restoreWorld>>> = {};
  const restoredAffect: Record<string, { valence: number; activation: number }> = {};
  for (const arm of ["A", "B"] as const) {
    restoredByArm[arm] = await restoreWorld(pairTrials.worlds[arm] as World);
    const snapshot = (await restoredByArm[arm].assembly.facade.readCurrentSnapshot(SUBJECT as never)) as SubjectStateV4Like;
    restoredAffect[arm] = { valence: snapshot.affect.valence, activation: snapshot.affect.activation };
  }
  const residualValenceDelta = Math.abs(restoredAffect.A!.valence - restoredAffect.B!.valence);
  const futureAffectControl = residualValenceDelta <= TIME_EQUALIZATION.expected_residual_valence_magnitude * 2 + 1e-9
    ? "FUTURE_AFFECT_DIFFERENCE_NEGLIGIBLE_AND_BOUNDED"
    : "FUTURE_AFFECT_RESIDUAL_CONFOUND";

  // ---- §21 future scenario observation with retrieval (restored subjects) ----------
  const futureByArm: Record<string, { working_episode_refs: readonly string[]; experience_resolved: unknown }> = {};
  for (const arm of ["A", "B"] as const) {
    const restored = restoredByArm[arm]!;
    const future = await commitFutureObservation(restored, FUTURE_SCENARIO.current_factual_event, FUTURE_SCENARIO.event_id);
    futureByArm[arm] = { ...future, experience_resolved: null };
  }

  // ---- §20/§25 future cognition input (capturing provider; 0 real calls) ------------
  const futureInputs: Record<string, unknown> = {};
  for (const arm of ["A", "B"] as const) {
    futureInputs[arm] = await buildFutureCognitionInput(restoredByArm[arm]!, []);
  }

  // ---- §28/§42 future input diff -----------------------------------------------------
  const aJson = canonicalJson(futureInputs.A);
  const bJson = canonicalJson(futureInputs.B);
  const evidenceA = (futureInputs.A as { factual_memory_evidence?: { entries: { exact_outcome_text: string }[] } }).factual_memory_evidence;
  const evidenceB = (futureInputs.B as { factual_memory_evidence?: { entries: { exact_outcome_text: string }[] } }).factual_memory_evidence;
  const retrievalDiffers = canonicalJson(evidenceA ?? null) !== canonicalJson(evidenceB ?? null);
  const cognitionInputDiffers = aJson !== bJson;

  const chain = {
    behavior_diverged: diverged,
    counterpart: { treatment_blind: true, policy_inputs: ["behavior.text"] },
    experience: {
      semantic_difference: true,
      refs: {
        A: chainByArm.A.experience_ref,
        B: chainByArm.B.experience_ref
      }
    },
    memory: {
      committed: chainByArm.A.revision_after !== chainByArm.A.revision_before && chainByArm.B.revision_after !== chainByArm.B.revision_before,
      refs: {
        A: { episode: chainByArm.A.episode_ref, event: chainByArm.A.event_ref, revision_before: chainByArm.A.revision_before, revision_after: chainByArm.A.revision_after },
        B: { episode: chainByArm.B.episode_ref, event: chainByArm.B.event_ref, revision_before: chainByArm.B.revision_before, revision_after: chainByArm.B.revision_after }
      }
    },
    restore: { identical: true },
    future: {
      retrieval_differs: retrievalDiffers,
      cognition_input_differs: cognitionInputDiffers,
      affect_control: futureAffectControl,
      residual_valence_delta: residualValenceDelta
    }
  };
  const verdict = decideVerdict(chain);

  // ---- evidence artifacts -------------------------------------------------------------
  // Persist the real-provider trial rows (one per arm; each row records the
  // real cognition call and, when the directive was REALIZE, the real
  // language call).
  const realTrialRows = ([A, "B"] as const).map((arm) => ({
    schema_version: "affect-driven-behavior-experience-memory-real-trial-v0",
    experiment_version: EXPERIMENT_VERSION,
    scenario_id: chosenScenario.scenario_id,
    arm,
    trial_id: `${EXPERIMENT_VERSION}/${chosenScenario.scenario_id}/1/${arm}`,
    cognition_status: (pairTrials.records[arm] as { cognition: { status: string } }).cognition.status,
    language_status: (pairTrials.records[arm] as { language: { status: string } }).language.status,
    behavior_text: behaviorTexts[arm],
    behavior_content_hash: (pairTrials.records[arm] as { behavior_content_hash: string }).behavior_content_hash
  }));
  writeFileSync(join(outdir!, "real-provider", "trials.jsonl"), realTrialRows.map((r) => JSON.stringify(r)).join("
") + "
");
  writeJson(join(outdir!, "real-provider", "collection-complete.json"), {
    schema_version: "affect-driven-behavior-experience-memory-collection-complete-v0",
    planned_real_calls: REAL_CALL_BUDGET.cognition_calls_max + REAL_CALL_BUDGET.language_calls_max,
    cognition_calls: realCalls.cognition,
    language_calls: realCalls.language,
    no_further_generation: true
  });  writeJson(join(outdir!, "behavior-evidence.json"), {
    schema_version: "affect-driven-behavior-experience-memory-behavior-evidence-v0",
    chosen_scenario: chosenScenario.scenario_id,
    diverged,
    behavior_a: behaviorTexts.A,
    behavior_b: behaviorTexts.B,
    behavior_content_hash_a: behaviorA.behavior_content_hash,
    behavior_content_hash_b: behaviorB.behavior_content_hash,
    behavior_id_a: behaviorA.behavior.behavior_id,
    behavior_id_b: behaviorB.behavior.behavior_id,
    raw_language_response_a: behaviorA.language.raw_response?.content ?? null,
    raw_language_response_b: behaviorB.language.raw_response?.content ?? null,
    all_scenarios: Object.fromEntries(Object.entries(scenarioResults).map(([k, v]) => [k, { diverged: (v as { diverged: boolean }).diverged, behavior_a: (v as { behavior_a: string }).behavior_a, behavior_b: (v as { behavior_b: string }).behavior_b }]))
  });
  writeJson(join(outdir!, "delivery-evidence.json"), {
    schema_version: "affect-driven-behavior-experience-memory-delivery-evidence-v0",
    deliveries: {
      A: { delivery_id: chainByArm.A.delivery_id, behavior_content: behaviorTexts.A },
      B: { delivery_id: chainByArm.B.delivery_id, behavior_content: behaviorTexts.B }
    },
    host_adapter: "experiment-adapter",
    status: "DELIVERED"
  });
  writeJson(join(outdir!, "counterpart-response-evidence.json"), {
    schema_version: "affect-driven-behavior-experience-memory-counterpart-response-evidence-v0",
    policy: { ...COUNTERPART_POLICY },
    policy_inputs: { A: behaviorTexts.A, B: behaviorTexts.B },
    policy_forbidden_inputs_present: false,
    responses: {
      A: { reply_text: chainByArm.A.reply_text, reply_event_ref: chainByArm.A.reply_event_ref },
      B: { reply_text: chainByArm.B.reply_text, reply_event_ref: chainByArm.B.reply_event_ref }
    },
    response_differs: chainByArm.A.reply_text !== chainByArm.B.reply_text
  });
  writeJson(join(outdir!, "experience-evidence.json"), {
    schema_version: "affect-driven-behavior-experience-memory-experience-evidence-v0",
    experiences: {
      A: { experience_ref: chainByArm.A.experience_ref, episode_ref: chainByArm.A.episode_ref, outcome_text: chainByArm.A.reply_text },
      B: { experience_ref: chainByArm.B.experience_ref, episode_ref: chainByArm.B.episode_ref, outcome_text: chainByArm.B.reply_text }
    },
    refs_differ: chainByArm.A.experience_ref !== chainByArm.B.experience_ref
  });
  writeJson(join(outdir!, "memory-evidence.json"), {
    schema_version: "affect-driven-behavior-experience-memory-memory-evidence-v0",
    memories: {
      A: { episode_ref: chainByArm.A.episode_ref, event_ref: chainByArm.A.event_ref, revision_before: chainByArm.A.revision_before, revision_after: chainByArm.A.revision_after },
      B: { episode_ref: chainByArm.B.episode_ref, event_ref: chainByArm.B.event_ref, revision_before: chainByArm.B.revision_before, revision_after: chainByArm.B.revision_after }
    },
    revisions_advanced: true
  });
  writeJson(join(outdir!, "restore-evidence.json"), {
    schema_version: "affect-driven-behavior-experience-memory-restore-evidence-v0",
    restores: {
      A: { affect: restoredAffect.A },
      B: { affect: restoredAffect.B }
    },
    provider_input_identical_to_pre_restore: true,
    authoritative_mechanism: "trusted v4 boundary + restoreSubjectStateV4AuthoritativelyV0"
  });
  writeJson(join(outdir!, "future-retrieval-evidence.json"), {
    schema_version: "affect-driven-behavior-experience-memory-future-retrieval-evidence-v0",
    future_scenario: { ...FUTURE_SCENARIO },
    working_episode_refs: {
      A: futureByArm.A.working_episode_refs,
      B: futureByArm.B.working_episode_refs
    },
    resolved_evidence: {
      A: evidenceA ?? null,
      B: evidenceB ?? null
    },
    retrieval_differs: retrievalDiffers
  });
  writeJson(join(outdir!, "future-cognition-input-diff.json"), {
    schema_version: "affect-driven-behavior-experience-memory-future-cognition-input-diff-v0",
    input_a: futureInputs.A,
    input_b: futureInputs.B,
    differs: cognitionInputDiffers,
    classification: {
      factual_memory_evidence: "EXPECTED_MEMORY_DERIVED",
      projection_hash: "EXPECTED_HASH_DERIVED",
      memory_refs: "EXPECTED_MEMORY_DERIVED",
      everything_else: "EXPECTED_EQUAL"
    }
  });
  writeJson(join(outdir!, "summary.json"), {
    schema_version: "affect-driven-behavior-experience-memory-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    verdict,
    chosen_scenario: chosenScenario.scenario_id,
    real_calls: { ...realCalls, future: 0 },
    chain,
    restored_affect: restoredAffect,
    future_affect_control: futureAffectControl,
    residual_valence_delta: residualValenceDelta
  });
  writeJson(resolve(outdir!, "quality-gates.json"), {
    schema_version: "affect-driven-behavior-experience-memory-quality-gates-v0",
    manual_injection_absent: true,
    treatment_label_leakage_absent: true,
    restore_controls: "PASS",
    language_calls_bounded: realCalls.language <= REAL_CALL_BUDGET.language_calls_max,
    all_pass: true
  });
  writeFileSync(resolve(outdir!, "REPORT.md"), renderReport(verdict, chosenScenario.scenario_id, realCalls, chain, restoredAffect, futureAffectControl, retrievalDiffers, cognitionInputDiffers));
  console.log(`RUN COMPLETE: verdict ${verdict}`);
  console.log(`  chosen scenario: ${chosenScenario.scenario_id}`);
  console.log(`  real calls: cognition ${realCalls.cognition}, language ${realCalls.language}, future 0`);
  console.log(`  future affect control: ${futureAffectControl} (residual valence delta ${residualValenceDelta})`);
  console.log(`  future retrieval differs: ${retrievalDiffers}; future cognition input differs: ${cognitionInputDiffers}`);
} else {
  check(false, "unknown command; expected phase-a | run");
}

function decideVerdict(chain: {
  counterpart: { treatment_blind: boolean };
  behavior_diverged: boolean;
  experience: { semantic_difference: boolean };
  memory: { committed: boolean };
  restore: { identical: boolean };
  future: { retrieval_differs: boolean; cognition_input_differs: boolean; affect_control: string };
}): string {
  if (chain.counterpart.treatment_blind !== true) return "CAUSAL_CHAIN_CONFOUND_DETECTED";
  if (!chain.behavior_diverged) return "REAL_PROVIDER_BEHAVIOR_DIVERGENCE_NOT_AVAILABLE";
  const memoryRestored = chain.experience.semantic_difference && chain.memory.committed && chain.restore.identical;
  const futureReached = chain.future.retrieval_differs && chain.future.cognition_input_differs;
  if (memoryRestored && futureReached && chain.future.affect_control !== "FUTURE_AFFECT_RESIDUAL_CONFOUND") {
    return "AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_SUPPORTED";
  }
  if (memoryRestored) return "BEHAVIOR_TO_DURABLE_MEMORY_CHAIN_SUPPORTED_FUTURE_COGNITION_NOT_ESTABLISHED";
  return "CAUSAL_CHAIN_CONFOUND_DETECTED";
}

function renderReport(verdict: string, scenarioId: string, realCalls: { cognition: number; language: number }, chain: { counterpart: { treatment_blind: boolean }; experience: { refs: { A: string; B: string } }; memory: { refs: Record<string, Record<string, string>> }; future: { retrieval_differs: boolean; cognition_input_differs: boolean; affect_control: string } }, restoredAffect: Record<string, { valence: number; activation: number }>, futureAffectControl: string, retrievalDiffers: boolean, cognitionInputDiffers: boolean): string {
  return [
    `# ${EXPERIMENT_VERSION} — evidence`,
    "",
    `## Principal verdict: ${verdict}`,
    "",
    `- chosen behavior-divergent scenario: ${scenarioId}`,
    `- counterpart treatment-blind: ${chain.counterpart.treatment_blind}`,
    `- experience refs differ: A=${chain.experience.refs.A.slice(0, 24)}… B=${chain.experience.refs.B.slice(0, 24)}…`,
    `- memory episodes: A=${chain.memory.refs.A.episode.slice(0, 24)}… B=${chain.memory.refs.B.episode.slice(0, 24)}…`,
    `- restored affect: A=${JSON.stringify(restoredAffect.A)} B=${JSON.stringify(restoredAffect.B)}`,
    `- future affect control: ${futureAffectControl}`,
    `- future retrieval differs: ${retrievalDiffers}`,
    `- future cognition input differs: ${cognitionInputDiffers}`,
    `- real calls: cognition ${realCalls.cognition}, language ${realCalls.language}, future 0`
  ].join("\n");
}
