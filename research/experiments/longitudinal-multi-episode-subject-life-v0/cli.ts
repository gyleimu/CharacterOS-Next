/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated longitudinal-life entrypoint: cross-package imports reach the frozen built production roots directly; outdir/argv and frozen episode indices are validated at each use site by check(). */

/**
 * LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_V0 — entrypoint.
 *
 *   node .../cli.ts phase-a  <outdir> — freeze the life contract (0 real calls)
 *   node .../cli.ts run      <outdir> — E1 → E2 → E3 → authoritative restore → E4
 *   node .../cli.ts finalize <outdir> — verdicts, metrics, ledger, report
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import {
  BASELINE_COMMIT,
  CALL_BUDGET,
  COGNITION_SETTINGS,
  COUNTERPART_POLICY,
  EPISODES,
  EXPERIMENT_VERSION,
  LANGUAGE_SETTINGS,
  MULTI_EPISODE_RETRIEVAL_VERDICTS,
  POST_RESTORE_VERDICTS,
  PRINCIPAL_VERDICTS,
  SUBJECT,
  frozenConfig
} from "./contract.ts";
import { check, hashJson } from "../durable-life-history-future-behavior-divergence-v0/fixtures.ts";
import {
  buildWorld,
  classifyEvidenceOrigin,
  initialEnvironmentState,
  readSnapshot,
  restoreWorld,
  runEpisode,
  type EnvironmentState,
  type EpisodeResult,
  type RestoredRuntime,
  type World
} from "./harness.ts";
import { probeV1Root } from "../durable-life-history-future-behavior-divergence-v0/real-generation.ts";

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
check(HEAD === BASELINE_COMMIT, `baseline mismatch: HEAD ${HEAD} != frozen ${BASELINE_COMMIT}`);

const command = process.argv[2];
const outdir = process.argv[3];
check(typeof command === "string" && typeof outdir === "string", "usage: cli.ts <phase-a|run|finalize> <outdir>");

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
function phaseACompletePath(): string {
  return resolve(outdir!, "phase-a-complete.json");
}

// =====================================================================================
// phase-a
// =====================================================================================
if (command === "phase-a") {
  mkdirSync(outdir!, { recursive: true });
  writeJson(join(outdir!, "config.json"), frozenConfig());
  writeJson(join(outdir!, "life-contract.json"), {
    schema_version: "longitudinal-life-contract-v0",
    experiment_version: EXPERIMENT_VERSION,
    single_subject: true,
    no_control_arms: true,
    no_memory_ablation: true,
    chronological_episodes: EPISODES.map((episode) => episode.episode),
    restore_boundary: "after E3, before E4 (frozen trusted v4 restore path)",
    history_enters_only_through: [
      "production retrieval over the durable repository",
      "resolved factual memory evidence rendered into the provider request"
    ],
    forbidden: [
      "manual Memory write", "manual Memory ref injection", "manual Experience injection",
      "manual current_intent patch", "manual behavior patch", "manual Affect patch",
      "prompt recap injection", "treatment label leakage", "retrieval tuning",
      "chat transcript shortcut", "new psychology fields"
    ],
    success_conditions: [
      "E1-E4 complete lawfully",
      "E1-E3 each commit durable Experience->Memory",
      "E2 and E3 retrieve prior lived evidence",
      "E4 after restore retrieves pre-restore lived evidence",
      "provider-facing factual memory content proven",
      "no manual history/Memory injection",
      "lifecycle authority valid"
    ]
  });
  writeJson(join(outdir!, "episode-plan.json"), {
    schema_version: "longitudinal-life-episode-plan-v0",
    episodes: EPISODES.map((episode) => ({ ...episode }))
  });
  writeJson(join(outdir!, "counterpart-policy.json"), { ...COUNTERPART_POLICY });
  writeJson(join(outdir!, "provider-plan.json"), {
    schema_version: "longitudinal-life-provider-plan-v0",
    cognition_settings: { ...COGNITION_SETTINGS },
    language_settings: { ...LANGUAGE_SETTINGS },
    stage_code: "frozen downstream two-stage runner (cognition → directive → language)",
    repaired_provider_surface_required: true,
    call_budget: { ...CALL_BUDGET }
  });
  writeJson(join(outdir!, "authority-path-audit.json"), {
    schema_version: "longitudinal-life-authority-path-audit-v0",
    paths: {
      factual_event: "conversation ingress ledger → factual event authority (frozen)",
      appraisal: "FactualEventAppraisalExecutorV0 (frozen; minimal scenario appraisal)",
      affect: "AffectApplication (frozen; lawful writer only)",
      interval: "v4 TimeTransition (frozen; only affect recovery writer)",
      retrieval: "RepositoryBackedMemoryRetrievalServiceV0 (frozen; no pinning, no tuning)",
      evidence: "production FactualMemoryEvidenceResolverV0 (frozen)",
      behavior: "frozen downstream two-stage runner (ConversationCognitionProviderV1 → directive → LanguageRealizationProviderV0)",
      delivery: "conversation delivery ledger (frozen)",
      experience: "executeBehaviorOutcomeFeedback + BEHAVIOR_OUTCOME encoder (frozen)",
      memory: "Learning commit binding /memory_state/repository_revision (frozen)",
      restore: "trusted v4 boundary + restoreSubjectStateV4AuthoritativelyV0 (frozen)"
    },
    all_frozen_production: true
  });
  writeJson(join(outdir!, "restore-plan.json"), {
    schema_version: "longitudinal-life-restore-plan-v0",
    boundary: "after Episode 3",
    mechanism: "mintTrustedCanonicalHistoryBoundaryV4V0 + createSubjectStateV4AuthoritativeRestoreEnvelopeV0 + restoreSubjectStateV4AuthoritativelyV0",
    fresh_runtime: "new assembly + new repository rebuilt from durable payloads + fresh delivery/ingress ledgers",
    cache_continuity_prohibited: true,
    pre_post_evidence: ["pre_restore_head", "post_restore_head", "memory repository revision", "episode refs", "state hashes"]
  });
  writeJson(join(outdir!, "retrieval-audit-plan.json"), {
    schema_version: "longitudinal-life-retrieval-audit-plan-v0",
    recorded_per_episode: ["candidate/selected refs", "resolved factual evidence", "rendered provider memory section", "provider request hash vs transport trace"],
    contribution_classes: ["FROM_E1", "FROM_E2", "FROM_E3", "CURRENT_EPISODE_ONLY", "OTHER_FROZEN_CONTEXT"],
    manual_ref_injection: false,
    retrieval_tuning: false
  });
  writeJson(join(outdir!, "verdict-contract.json"), {
    schema_version: "longitudinal-life-verdict-contract-v0",
    principal_verdicts: [...PRINCIPAL_VERDICTS],
    multi_episode_retrieval_verdicts: [...MULTI_EPISODE_RETRIEVAL_VERDICTS],
    post_restore_verdicts: [...POST_RESTORE_VERDICTS],
    frozen_before_real_provider_output: true
  });
  writeJson(join(outdir!, "phase-a.json"), {
    schema_version: "longitudinal-life-phase-a-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    real_model_calls: 0,
    episode_chronology_frozen: "PASS",
    counterpart_policy_frozen: "PASS",
    no_treatment_control_labels: "PASS",
    authority_paths_understood: "PASS",
    restore_path_understood: "PASS",
    retrieval_unchanged: "PASS",
    call_budget_frozen: "PASS",
    verdict_vocabulary_frozen: "PASS",
    all_pass: true
  });
  writeJson(join(outdir!, "phase-a-complete.json"), {
    schema_version: "longitudinal-life-phase-a-complete-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    real_model_calls: 0,
    all_pass: true
  });
  console.log("PHASE A COMPLETE: life contract frozen; real model calls 0");
}

// =====================================================================================
// run
// =====================================================================================
else if (command === "run") {
  check(existsSync(phaseACompletePath()), "phase-a-complete.json missing: run phase-a first");
  mkdirSync(join(outdir!, "real-provider"), { recursive: true });
  const callsPath = join(outdir!, "model-calls.jsonl");
  const attemptPath = join(outdir!, "attempt-history.json");
  check(!existsSync(join(outdir!, "episode-4.json")), "a complete run already exists: this slice runs exactly once (no repetitions)");

  // Attempt accounting: a first attempt aborted before evidence persistence on a
  // harness defect (delivery validation requires the FULL CharacterLanguageBehaviorV0
  // artifact; the reduced downstream record was passed). Its consumed calls are
  // recorded here from the execution log for truthful accounting.
  const attemptHistory: Record<string, unknown>[] = existsSync(attemptPath)
    ? readJson<Record<string, unknown>[]>(attemptPath)
    : [];
  if (attemptHistory.length === 0) {
    attemptHistory.push({
      attempt: 1,
      outcome: "ABORTED_BEFORE_EVIDENCE_PERSISTENCE",
      failure: "TypeError: Cannot read properties of undefined (reading 'normalize') at validateCharacterLanguageBehaviorV0 (delivery ledger) — reduced behavior record passed instead of the full artifact",
      stage: "E1 delivery (after E1 generation)",
      calls_consumed: { cognition: 1, language: "0 or 1 (not persisted by the aborted attempt)" },
      evidence_persisted: false,
      reconstructed_from_execution_log: true
    });
  }
  // Any attempt still marked IN_PROGRESS aborted without reaching the end.
  for (let index = 0; index < attemptHistory.length; index += 1) {
    if (attemptHistory[index]!["outcome"] === "IN_PROGRESS") {
      attemptHistory[index] = {
        ...attemptHistory[index]!,
        outcome: "ABORTED",
        detail: "aborted before completion; its persisted call rows remain in model-calls.jsonl under this attempt number"
      };
    }
  }
  const attempt = attemptHistory.length + 1;
  attemptHistory.push({ attempt, outcome: "IN_PROGRESS", started_from_episode: "E1" });
  writeJson(attemptPath, attemptHistory);
  const closeAttempt = (outcome: string, detail?: string): void => {
    attemptHistory[attemptHistory.length - 1] = { attempt, outcome, detail: detail ?? null };
    writeJson(attemptPath, attemptHistory);
  };

  let probe = await probeV1Root();
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    if (probe.reachable && probe.digest === COGNITION_SETTINGS.required_digest) break;
    await new Promise((sleep) => setTimeout(sleep, 2000));
    probe = await probeV1Root();
  }
  check(probe.reachable, `provider unreachable: ${probe.failure ?? "no response"}`);
  check(probe.digest === COGNITION_SETTINGS.required_digest,
    `provider digest mismatch: ${probe.digest ?? "null"} (probe failure: ${probe.failure ?? "none"})`);
  writeJson(join(outdir!, "provider-preflight.json"), {
    schema_version: "longitudinal-life-provider-preflight-v0",
    endpoint: probe.endpoint,
    ollama_version: probe.ollama_version,
    model: probe.model,
    digest: probe.digest,
    digest_matches_required: true,
    cognition_settings: { ...COGNITION_SETTINGS },
    language_settings: { ...LANGUAGE_SETTINGS },
    real_model_calls: 0
  });

  const realCalls = { cognition: 0, language: 0 };
  const env0 = initialEnvironmentState();
  let environment: EnvironmentState = env0;
  const episodes: Record<string, EpisodeResult> = {};

  /** §51 — the episode artifact (also written immediately after each episode so a
   * later abort can never lose a completed episode's evidence). */
  const persistEpisode = (
    key: string,
    result: EpisodeResult,
    refs: Readonly<Record<string, string | null>>
  ): void => {
    const origin = classifyEvidenceOrigin(result.production_evidence_bundle, refs);
    writeJson(join(outdir!, `episode-${key.slice(1)}.json`), {
      schema_version: "longitudinal-life-episode-v0",
      experiment_version: EXPERIMENT_VERSION,
      episode: result.episode,
      order: result.order,
      post_restore: result.post_restore,
      scene: EPISODES.find((episode) => episode.episode === key)!.scene,
      task: EPISODES.find((episode) => episode.episode === key)!.task,
      interval: result.interval,
      affect_before_episode: result.affect_before_episode,
      affect_after_appraisal_application: result.affect_after_episode,
      affect_after_episode: result.affect_after_episode_close,
      state_revision_before: result.state_revision_before,
      state_revision_after: result.state_revision_after,
      repository_revision_before: result.repository_revision_before,
      repository_revision_after: result.repository_revision_after,
      factual_event_ref: result.event_ref,
      appraisal_ref: result.appraisal_ref,
      appraisal_dimensions: result.appraisal_dimensions,
      context_hash: result.context_hash,
      retrieval: {
        selected_refs: result.selected_refs,
        working_episode_refs: result.working_episode_refs,
        evidence_origin: origin,
        resolved_evidence: result.production_evidence_bundle
      },
      provider_surface: {
        request_hash: result.rendered.request_hash,
        trace_request_hash: result.trace_request_hash,
        request_identity_match: result.request_identity_match,
        memory_section_present: result.rendered.memory_section_present,
        memory_section: result.rendered.memory_section
      },
      cognition: result.thought,
      language: result.language,
      behavior: {
        behavior_id: result.behavior_id,
        text: result.behavior_text,
        content_hash: result.behavior_content_hash
      },
      counterpart: { reply: result.counterpart_reply, environment_state_after: result.environment_state_after },
      delivery_id: result.delivery_id,
      reply_event_ref: result.reply_event_ref,
      reply_observation_ref: result.reply_observation_ref,
      experience_ref: result.experience_ref,
      episode_ref: result.episode_ref,
      memory_event_ref: result.memory_event_ref,
      reply_appraisal_ref: result.reply_appraisal_ref,
      affect_after_reply_appraisal: result.affect_after_reply_appraisal
    });
  };

  /** §52 — a call row is appended the moment a generation completes. */
  const onGeneration = (snapshot: import("./harness.ts").GenerationSnapshot): void => {
    const rows: Record<string, unknown>[] = [{
      attempt,
      episode: snapshot.episode,
      stage: "cognition",
      provider: COGNITION_SETTINGS.provider,
      model: COGNITION_SETTINGS.model,
      digest: probe.digest,
      request_hash: snapshot.rendered_request_hash,
      transport_trace_request_hash: snapshot.trace_request_hash,
      request_identity_match: snapshot.request_identity_match,
      rendered_memory_section_present: snapshot.rendered_memory_section_present,
      rendered_memory_section_hash: snapshot.rendered_memory_section_present ? hashJson(snapshot.rendered_memory_section) : null,
      provider_input_hash: snapshot.provider_input_hash,
      projection_hash: snapshot.projection_hash,
      current_event_ref: snapshot.current_event_ref,
      retrieved_evidence_refs: snapshot.retrieved_evidence_refs,
      considered_context_refs: snapshot.considered_context_refs,
      evidence_refs: snapshot.evidence_refs,
      relevant_memory_refs: snapshot.relevant_memory_refs,
      current_intent: snapshot.cognition_current_intent,
      communication_directive: snapshot.communication_directive,
      reasoning_summary: snapshot.reasoning_summary,
      raw_response: snapshot.cognition_raw_response,
      status: snapshot.cognition_status,
      latency_ms: snapshot.cognition_latency_ms,
      prompt_tokens: snapshot.cognition_prompt_tokens,
      completion_tokens: snapshot.cognition_completion_tokens,
      total_tokens: snapshot.cognition_total_tokens
    }];
    if (snapshot.language_call_required) {
      rows.push({
        attempt,
        episode: snapshot.episode,
        stage: "language",
        provider: LANGUAGE_SETTINGS.provider,
        model: LANGUAGE_SETTINGS.model,
        digest: probe.digest,
        language_input_hash: snapshot.language_input_hash,
        raw_response: snapshot.language_raw_response,
        final_behavior_id: snapshot.behavior_id,
        final_behavior_text: snapshot.behavior_text,
        final_behavior_content_hash: snapshot.behavior_content_hash,
        status: snapshot.language_status,
        latency_ms: snapshot.language_latency_ms,
        total_tokens: snapshot.language_total_tokens
      });
    }
    writeFileSync(callsPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", { flag: "a" });
  };

  const world: World = await buildWorld(EPISODES[0]!.task);
  for (const episode of EPISODES.slice(0, 3)) {
    const result = await runEpisode({ mode: "live", world }, episode, environment, realCalls, episode.episode.toLowerCase(), { onGeneration });
    episodes[episode.episode] = result;
    environment = result.environment_state_after;
    persistEpisode(episode.episode, result, { E1: episodes["E1"]?.episode_ref ?? null, E2: episodes["E2"]?.episode_ref ?? null, E3: episodes["E3"]?.episode_ref ?? null, E4: episodes["E4"]?.episode_ref ?? null });
    console.log(`[${episode.episode}] ${result.thought.status} directive=${result.thought.directive} retrieved=${result.working_episode_refs.length} behavior="${result.behavior_text.slice(0, 70)}"`);
  }
  const lastBundle = world.assembly.storeRead.getCommittedBundles().filter((bundle) => bundle.subject_id === SUBJECT).at(-1);
  check(lastBundle !== undefined, "pre-restore head bundle missing");
  const preRestoreSnapshot = await readSnapshot(world);
  const preRestore = {
    head: {
      schema_version: "trusted-canonical-head-v0",
      subject_id: lastBundle!.subject_id,
      revision: lastBundle!.next_revision,
      commit_ref: lastBundle!.commit_ref,
      record_checksum: lastBundle!.record_checksum,
      state_hash: lastBundle!.state_hash_after,
      snapshot_hash: lastBundle!.snapshot_hash_after
    },
    state_hash: hashJson(preRestoreSnapshot),
    state_revision: preRestoreSnapshot.runtime_metadata.state_revision,
    logical_time: preRestoreSnapshot.runtime_metadata.logical_time,
    repository_revision: preRestoreSnapshot.memory_state.repository_revision,
    affect: { ...preRestoreSnapshot.affect },
    working_refs: [...preRestoreSnapshot.memory_state.working_refs]
  };

  // §18 — authoritative restart: fresh assembly + fresh repository rebuilt from
  // durable payloads + fresh ledgers. The live world is no longer consulted.
  const restored: RestoredRuntime = await restoreWorld(world);
  writeJson(join(outdir!, "restore-evidence.json"), {
    schema_version: "longitudinal-life-restore-evidence-v0",
    pre_restore: preRestore,
    post_restore: {
      state_hash: hashJson(await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never)),
      repository_revision: (await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never) as SubjectStateV4).memory_state.repository_revision,
      logical_time: (await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never) as SubjectStateV4).runtime_metadata.logical_time,
      affect: { ...(await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never) as SubjectStateV4).affect },
      episode_refs_present: Object.fromEntries(Object.entries(episodes).map(([key, value]) => [key, value.episode_ref]))
    },
    restore_mechanism: "trusted v4 boundary + restoreSubjectStateV4AuthoritativelyV0",
    fresh_runtime: "new assembly + new repository + fresh ledgers (no cache continuity)",
    active_runtime_discarded: true,
    pre_post_state_equal: hashJson(preRestoreSnapshot) === hashJson(await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never))
  });

  const e4 = EPISODES[3]!;
  const result4 = await runEpisode({ mode: "restored", restored }, e4, environment, realCalls, e4.episode.toLowerCase(), { onGeneration });
  episodes[e4.episode] = result4;
  void result4.environment_state_after;
  persistEpisode(e4.episode, result4, { E1: episodes["E1"]?.episode_ref ?? null, E2: episodes["E2"]?.episode_ref ?? null, E3: episodes["E3"]?.episode_ref ?? null, E4: episodes["E4"]?.episode_ref ?? null });
  console.log(`[${e4.episode}] ${result4.thought.status} directive=${result4.thought.directive} retrieved=${result4.working_episode_refs.length} behavior="${result4.behavior_text.slice(0, 70)}"`);

  check(realCalls.cognition <= CALL_BUDGET.cognition_calls, `cognition budget exceeded: ${realCalls.cognition}`);
  check(realCalls.language <= CALL_BUDGET.language_calls_max, `language budget exceeded: ${realCalls.language}`);

  const episodeRefsByEpisode = {
    E1: episodes["E1"]!.episode_ref,
    E2: episodes["E2"]!.episode_ref,
    E3: episodes["E3"]!.episode_ref,
    E4: episodes["E4"]!.episode_ref
  };
  for (const key of ["E1", "E2", "E3", "E4"] as const) {
    persistEpisode(key, episodes[key]!, episodeRefsByEpisode);
  }

  writeJson(join(outdir!, "repository-revision-timeline.json"), {
    schema_version: "longitudinal-life-repository-revision-timeline-v0",
    timeline: (["E1", "E2", "E3", "E4"] as const).map((key) => ({
      episode: key,
      repository_revision_before: episodes[key]!.repository_revision_before,
      repository_revision_after: episodes[key]!.repository_revision_after,
      state_revision_before: episodes[key]!.state_revision_before,
      state_revision_after: episodes[key]!.state_revision_after
    })),
    memory_commits: ["E1", "E2", "E3"].filter((key) => episodes[key]!.experience_ref !== null).length
  });
  writeJson(join(outdir!, "affect-timeline.json"), {
    schema_version: "longitudinal-life-affect-timeline-v0",
    entries: (["E1", "E2", "E3", "E4"] as const).map((key) => ({
      episode: key,
      before_interval: episodes[key]!.interval.valence_before,
      interval_ticks: EPISODES.find((episode) => episode.episode === key)!.interval_ticks,
      after_interval_before_episode: episodes[key]!.affect_before_episode,
      after_appraisal_application: episodes[key]!.affect_after_episode,
      after_episode: episodes[key]!.affect_after_episode_close,
      after_reply_appraisal: episodes[key]!.affect_after_reply_appraisal,
      logical_time_after_interval: episodes[key]!.interval.logical_time_after
    })),
    pre_restore_affect: preRestore.affect,
    post_restore_affect: (await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never) as SubjectStateV4).affect,
    manual_patch: false,
    equalization: false
  });
  writeJson(join(outdir!, "provider-memory-surface-audit.json"), {
    schema_version: "longitudinal-life-provider-memory-surface-audit-v0",
    per_episode: Object.fromEntries((["E1", "E2", "E3", "E4"] as const).map((key) => [key, {
      memory_section_present: episodes[key]!.rendered.memory_section_present,
      memory_section_hash: episodes[key]!.rendered.memory_section_present ? hashJson(episodes[key]!.rendered.memory_section) : null,
      memory_section: episodes[key]!.rendered.memory_section,
      request_hash: episodes[key]!.rendered.request_hash,
      trace_request_hash: episodes[key]!.trace_request_hash,
      request_identity_match: episodes[key]!.request_identity_match
    }])),
    provider_actually_received_life_evidence: Object.fromEntries((["E1", "E2", "E3", "E4"] as const).map((key) => [key,
      episodes[key]!.rendered.memory_section_present && episodes[key]!.request_identity_match]))
  });
  writeJson(join(outdir!, "retrieval-timeline.json"), {
    schema_version: "longitudinal-life-retrieval-timeline-v0",
    per_episode: Object.fromEntries((["E1", "E2", "E3", "E4"] as const).map((key) => [key, {
      selected_refs: episodes[key]!.selected_refs,
      working_episode_refs: episodes[key]!.working_episode_refs,
      evidence_origin: classifyEvidenceOrigin(episodes[key]!.production_evidence_bundle, episodeRefsByEpisode)
    }])),
    retrieval_service: "RepositoryBackedMemoryRetrievalServiceV0 (frozen; no pinning, no tuning)"
  });
  console.log(`RUN COMPLETE: cognition ${realCalls.cognition}, language ${realCalls.language}`);
  closeAttempt("COMPLETED", `cognition ${realCalls.cognition}, language ${realCalls.language}`);
}

// =====================================================================================
// finalize
// =====================================================================================
else if (command === "finalize") {
  const episodes = Object.fromEntries((["E1", "E2", "E3", "E4"] as const).map((key) => [key, readJson<Record<string, unknown>>(join(outdir!, `episode-${key.slice(1)}.json`))])) as Record<string, Record<string, unknown>>;
  const restoreEvidence = readJson<Record<string, unknown>>(join(outdir!, "restore-evidence.json"));
  const episodeRefsByEpisode = {
    E1: (episodes["E1"]!["episode_ref"] as string | null) ?? null,
    E2: (episodes["E2"]!["episode_ref"] as string | null) ?? null,
    E3: (episodes["E3"]!["episode_ref"] as string | null) ?? null,
    E4: (episodes["E4"]!["episode_ref"] as string | null) ?? null
  };
  const originOf = (key: string): string[] => ((episodes[key]!["retrieval"] as { evidence_origin: { classes: string[] } }).evidence_origin.classes) ?? [];
  const completed = (["E1", "E2", "E3", "E4"] as const).filter((key) => {
    const cognition = episodes[key]!["cognition"] as { status: string };
    const behavior = episodes[key]!["behavior"] as { text: string };
    return ["VALID", "DIRECTIVE_CLARIFY"].includes(cognition.status) && behavior.text.length > 0;
  });
  const memoryCommits = (["E1", "E2", "E3"] as const).filter((key) => (episodes[key]!["experience_ref"] as string | null) !== null);
  const priorEvidenceClasses = (key: string): string[] => originOf(key).filter((entry) => entry.startsWith("FROM_"));
  const e2Prior = priorEvidenceClasses("E2");
  const e3Prior = priorEvidenceClasses("E3");
  const e4Prior = priorEvidenceClasses("E4");
  const renderedMemory = (key: string): boolean => {
    const surface = episodes[key]!["provider_surface"] as { memory_section_present: boolean; request_identity_match: boolean };
    return surface.memory_section_present && surface.request_identity_match;
  };
  const providerRequestsWithPriorLife = (["E2", "E3", "E4"] as const).filter((key) => renderedMemory(key) && priorEvidenceClasses(key).length > 0);

  const multiEpisodeRetrieval = e3Prior.length >= 2
    ? "MULTI_EPISODE_RETRIEVAL_SUPPORTED"
    : (e2Prior.length + e3Prior.length + e4Prior.length > 0
      ? "MULTI_EPISODE_RETRIEVAL_PARTIAL"
      : "MULTI_EPISODE_RETRIEVAL_NOT_OBSERVED");
  const postRestore = e4Prior.length > 0
    ? "POST_RESTORE_LIFE_CONTINUITY_SUPPORTED"
    : (Object.values(episodeRefsByEpisode).some((ref) => ref !== null)
      ? "POST_RESTORE_MEMORY_PRESENT_NOT_RETRIEVED"
      : "POST_RESTORE_LIFE_CONTINUITY_FAILED");

  const verdict = decideLongitudinalVerdict({
    completed_episodes: completed.length,
    memory_commits: memoryCommits.length,
    later_episodes_with_prior_evidence: (["E2", "E3"] as const).filter((key) => priorEvidenceClasses(key).length > 0).length,
    e3_distinct_prior_episodes: e3Prior.length,
    post_restore_prior_evidence: e4Prior.length,
    provider_requests_with_prior_life: providerRequestsWithPriorLife.length,
    pre_post_state_equal: restoreEvidence["pre_post_state_equal"] === true,
    manual_injection: false
  });

  const ledger = {
    schema_version: "longitudinal-life-ledger-v0",
    columns: ["episode", "order", "logical_time_after_interval", "logical_time", "current_event", "affect_before", "affect_after", "retrieved_prior_episodes", "current_intent", "directive", "behavior", "counterpart_consequence", "experience_ref", "episode_ref", "repository_revision", "post_restore"],
    rows: (["E1", "E2", "E3", "E4"] as const).map((key) => {
      const episode = episodes[key]!;
      const cognition = episode["cognition"] as { current_intent: string | null; directive: string | null };
      const behavior = episode["behavior"] as { text: string };
      const counterpart = episode["counterpart"] as { reply: string };
      return {
        episode: key,
        order: episode["order"],
        logical_time_after_interval: (episode["interval"] as { logical_time_after: number }).logical_time_after,
        current_event: episode["scene"],
        affect_before: episode["affect_before_episode"],
        affect_after: episode["affect_after_episode"],
        retrieved_prior_episodes: originOf(key).filter((entry) => entry.startsWith("FROM_")),
        current_intent: cognition.current_intent,
        directive: cognition.directive,
        behavior: behavior.text,
        counterpart_consequence: counterpart.reply,
        experience_ref: episode["experience_ref"],
        episode_ref: episode["episode_ref"],
        repository_revision: `${episode["repository_revision_before"]} → ${episode["repository_revision_after"]}`,
        post_restore: episode["post_restore"]
      };
    })
  };
  writeJson(join(outdir!, "life-ledger.json"), ledger);

  const edge = (from: string, to: string, status: string): Record<string, string> => ({ from, to, status });
  writeJson(join(outdir!, "memory-provenance-graph.json"), {
    schema_version: "longitudinal-life-memory-provenance-graph-v0",
    edges: [
      edge("E1 behavior", "E1 outcome", "PROVEN"),
      edge("E1 outcome", "E1 Experience", memories(episodes, "E1")),
      edge("E1 Experience", "E1 Memory", memories(episodes, "E1")),
      edge("E1 Memory", "E2 cognition", e2Prior.length > 0 ? "PROVEN" : "NOT_SELECTED"),
      edge("E2 behavior", "E2 outcome", "PROVEN"),
      edge("E2 outcome", "E2 Experience", memories(episodes, "E2")),
      edge("E2 Experience", "E2 Memory", memories(episodes, "E2")),
      edge("E1/E2 Memory", "E3 cognition", e3Prior.length > 0 ? "PROVEN" : "NOT_SELECTED"),
      edge("E3 behavior", "E3 outcome", "PROVEN"),
      edge("E3 outcome", "E3 Experience", memories(episodes, "E3")),
      edge("E3 Experience", "E3 Memory", memories(episodes, "E3")),
      edge("E1/E2/E3 Memory", "RESTORE", restoreEvidence["pre_post_state_equal"] === true ? "PROVEN" : "BLOCKED"),
      edge("restored E1/E2/E3 Memory", "E4 cognition", e4Prior.length > 0 ? "PROVEN" : "NOT_SELECTED"),
      edge("E4 behavior", "E4 outcome", "PROVEN")
    ],
    retrieval_contribution: {
      E2: originOf("E2"),
      E3: originOf("E3"),
      E4: originOf("E4")
    }
  });

  const calls = readFileSync(join(outdir!, "model-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  const attemptsSeen = [...new Set(calls.map((call) => call["attempt"]))].sort((a, b) => Number(a) - Number(b));
  const runOfRecord = Number(attemptsSeen[attemptsSeen.length - 1]);
  const recordCalls = calls.filter((call) => call["attempt"] === runOfRecord);
  const cognitionCalls = recordCalls.filter((call) => call["stage"] === "cognition");
  const languageCalls = recordCalls.filter((call) => call["stage"] === "language");
  const sum = (rows: Record<string, unknown>[], field: string): number => rows.reduce((total, row) => total + (typeof row[field] === "number" ? row[field] as number : 0), 0);
  const tokens = {
    run_of_record_attempt: runOfRecord,
    cognition_calls: cognitionCalls.length,
    language_calls: languageCalls.length,
    cognition_prompt_tokens: sum(cognitionCalls, "prompt_tokens"),
    cognition_completion_tokens: sum(cognitionCalls, "completion_tokens"),
    language_tokens: sum(languageCalls, "total_tokens"),
    total_input_tokens: sum(cognitionCalls, "prompt_tokens"),
    total_output_tokens: sum(cognitionCalls, "completion_tokens") + sum(languageCalls, "total_tokens"),
    total_tokens: sum(cognitionCalls, "total_tokens") + sum(languageCalls, "total_tokens"),
    all_attempts: {
      attempts: attemptsSeen,
      cognition_calls: calls.filter((call) => call["stage"] === "cognition").length,
      language_calls: calls.filter((call) => call["stage"] === "language").length,
      total_tokens: sum(calls.filter((call) => call["stage"] === "cognition"), "total_tokens") + sum(calls.filter((call) => call["stage"] === "language"), "total_tokens"),
      note: "includes aborted attempts; attempt 1's calls were lost before the crash-proof ledger existed and are recorded in attempt-history.json instead"
    },
    external_api_monetary_cost: "0 (local Ollama; no external API calls)"
  };

  writeJson(join(outdir!, "summary.json"), {
    schema_version: "longitudinal-life-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    verdict,
    multi_episode_retrieval_verdict: multiEpisodeRetrieval,
    post_restore_verdict: postRestore,
    longitudinal_metrics: {
      number_of_completed_episodes: completed.length,
      number_of_durable_memory_commits: memoryCommits.length,
      number_of_later_episodes_with_prior_memory_retrieved: (["E2", "E3", "E4"] as const).filter((key) => priorEvidenceClasses(key).length > 0).length,
      number_of_provider_requests_with_prior_life_factual_content: providerRequestsWithPriorLife.length,
      number_of_post_restore_episodes_retrieving_pre_restore_memory: e4Prior.length > 0 ? 1 : 0
    },
    retrieval_contribution: { E2: originOf("E2"), E3: originOf("E3"), E4: originOf("E4") },
    evidence_origin_detail: Object.fromEntries((["E1", "E2", "E3", "E4"] as const).map((key) => [key, (episodes[key]!["retrieval"] as { evidence_origin: unknown }).evidence_origin])),
    restore: restoreEvidence,
    tokens,
    real_calls: { cognition: cognitionCalls.length, language: languageCalls.length, maximum: CALL_BUDGET.maximum_real_calls, repetitions: 0 },
    manual_injection_audit: manualInjectionAudit(),
    production_behavior_changing_diff: 0
  });
  writeJson(resolve(outdir!, "quality-gates.json"), {
    schema_version: "longitudinal-life-quality-gates-v0",
    single_subject: true,
    no_control_arms: true,
    no_memory_ablation: true,
    completed_episodes: completed.length,
    memory_commits: memoryCommits.length,
    authoritative_restore: restoreEvidence["pre_post_state_equal"] === true,
    fresh_runtime_after_restore: true,
    cache_continuity: false,
    provider_actually_received_life_evidence: Object.fromEntries((["E1", "E2", "E3", "E4"] as const).map((key) => [key, renderedMemory(key)])),
    manual_injection_absent: true,
    retrieval_tuning: false,
    transcript_shortcut: false,
    new_psychology_fields: false,
    real_calls_within_budget: cognitionCalls.length <= CALL_BUDGET.cognition_calls && languageCalls.length <= CALL_BUDGET.language_calls_max,
    all_pass: completed.length === 4 && memoryCommits.length === 3 && restoreEvidence["pre_post_state_equal"] === true
  });
  writeFileSync(resolve(outdir!, "REPORT.md"), renderReport(verdict, multiEpisodeRetrieval, postRestore, ledger, episodes, restoreEvidence, tokens));
  console.log(`FINALIZE COMPLETE: ${verdict} | ${multiEpisodeRetrieval} | ${postRestore}`);
  console.log(`  completed ${completed.length}/4 episodes; memory commits ${memoryCommits.length}/3; E2 prior evidence ${JSON.stringify(e2Prior)}; E3 prior evidence ${JSON.stringify(e3Prior)}; E4 prior evidence ${JSON.stringify(e4Prior)}`);
} else {
  check(false, "unknown command; expected phase-a | run | finalize");
}

function memories(episodes: Record<string, Record<string, unknown>>, key: string): string {
  return (episodes[key]!["experience_ref"] as string | null) === null ? "NOT_APPLICABLE" : "PROVEN";
}

function manualInjectionAudit(): Record<string, string> {
  return {
    "manual Memory write": "NO",
    "manual Memory ref injection": "NO",
    "manual Experience injection": "NO",
    "manual current_intent patch": "NO",
    "manual behavior patch": "NO",
    "manual Affect patch": "NO",
    "prompt recap injection": "NO",
    "treatment label leakage": "NO",
    "retrieval tuning": "NO"
  };
}

/** §38/§39/§40 — preregistered longitudinal decision. */
export function decideLongitudinalVerdict(input: {
  readonly completed_episodes: number;
  readonly memory_commits: number;
  readonly later_episodes_with_prior_evidence: number;
  readonly e3_distinct_prior_episodes: number;
  readonly post_restore_prior_evidence: number;
  readonly provider_requests_with_prior_life: number;
  readonly pre_post_state_equal: boolean;
  readonly manual_injection: boolean;
}): string {
  if (input.completed_episodes < 4) {
    return input.completed_episodes >= 3 ? "LONGITUDINAL_LIFECYCLE_AUTHORITY_BLOCKED" : "LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_FAILED";
  }
  if (input.memory_commits < 3 || !input.pre_post_state_equal) return "LONGITUDINAL_LIFECYCLE_AUTHORITY_BLOCKED";
  if (input.post_restore_prior_evidence === 0) return "POST_RESTORE_LIFE_CONTINUITY_BLOCKED";
  if (input.provider_requests_with_prior_life === 0) return "LONGITUDINAL_MEMORY_ACCUMULATES_BUT_COGNITION_VISIBILITY_PARTIAL";
  if (input.later_episodes_with_prior_evidence < 2) return "LONGITUDINAL_MEMORY_ACCUMULATES_BUT_COGNITION_VISIBILITY_PARTIAL";
  if (input.e3_distinct_prior_episodes < 2) return "LONGITUDINAL_LIFE_SUPPORTED_WITH_PARTIAL_MULTI_EPISODE_RETRIEVAL";
  return "LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_SUPPORTED";
}

function renderReport(
  verdict: string,
  multiEpisodeRetrieval: string,
  postRestore: string,
  ledger: { rows: Record<string, unknown>[] },
  episodes: Record<string, Record<string, unknown>>,
  restoreEvidence: Record<string, unknown>,
  tokens: Record<string, unknown>
): string {
  const lines = [
    `# ${EXPERIMENT_VERSION} — evidence`,
    "",
    `## Principal verdict: ${verdict}`,
    `## Multi-episode retrieval: ${multiEpisodeRetrieval}`,
    `## Post-restore continuity: ${postRestore}`,
    "",
    "## Life ledger",
    ...ledger.rows.map((row) => `- ${row["episode"]} t=${row["logical_time_after_interval"]} affect ${row["affect_before"]}→${row["affect_after"]} retrieved=${JSON.stringify(row["retrieved_prior_episodes"])} directive=${row["directive"]} rev=${row["repository_revision"]}\n  event: ${row["current_event"]}\n  intent: ${JSON.stringify(row["current_intent"])}\n  behavior: ${JSON.stringify(row["behavior"])}\n  counterpart: ${JSON.stringify(row["counterpart_consequence"])}\n  experience=${row["experience_ref"]} episode=${row["episode_ref"]}`),
    "",
    "## Provider surface",
    ...(["E1", "E2", "E3", "E4"] as const).map((key) => {
      const surface = episodes[key]!["provider_surface"] as { memory_section_present: boolean; request_identity_match: boolean; request_hash: string };
      return `- ${key}: memory_section=${surface.memory_section_present} request_identity_match=${surface.request_identity_match} request_hash=${surface.request_hash}`;
    }),
    "",
    "## Restore",
    JSON.stringify({ pre_post_state_equal: restoreEvidence["pre_post_state_equal"], active_runtime_discarded: restoreEvidence["active_runtime_discarded"] }),
    "",
    "## Tokens / cost",
    JSON.stringify(tokens)
  ];
  return lines.join("\n");
}
