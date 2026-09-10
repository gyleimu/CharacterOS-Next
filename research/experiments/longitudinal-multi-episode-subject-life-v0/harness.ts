/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated longitudinal-life experiment harness over frozen built production roots; live/restored authority surfaces are selected and validated at each use site. */

/**
 * LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_V0 — harness.
 *
 * One subject, one continuing counterpart, four chronological episodes with an
 * authoritative restore between E3 and E4. Every episode runs the FROZEN
 * production lifecycle:
 *
 *   lawful interval (TimeTransition) → factual event ingress → current Appraisal
 *   → AffectApplication → governed context + production retrieval commit
 *   → evidence-resolved provider-facing projection → REAL cognition
 *   → REAL language behavior (or fixed clarification) → delivery ledger
 *   → deterministic behavior-aware counterpart → linked reply ingress
 *   → reply Observation → executeBehaviorOutcomeFeedback → Experience → Memory
 *
 * E1–E3 run that full lifecycle on the live explicit-v4 world. E4 runs AFTER an
 * authoritative restore, so it uses the §44 preferred post-restore endpoint:
 * lawful interval → production retrieval → evidence-resolved projection → REAL
 * cognition → REAL behavior → delivery → counterpart → reply Observation. It
 * applies no new Appraisal and commits no new Memory (the restored path was
 * frozen for observation/retrieval/cognition in prior slices); the restored
 * journal writers for appraisal/affect remain bound to the live world by
 * construction and are deliberately not re-bound here.
 *
 * Nothing is scripted, injected or patched: no manual Memory write, no manual
 * ref injection, no recap prompt, no transcript shortcut.
 */

import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import { hashEnvelope, proposalFingerprint } from "../../../packages/subject-core/dist/index.js";
import {
  buildCharacterLanguageBehaviorV0,
  buildClarificationBehaviorV0
} from "../../../packages/behavior/dist/index.js";
import type { AtomicCommitBundleAnyVersion } from "../../../packages/subject-core/dist/index.js";
import { createMemoryPreparationAuthority, RepositoryBackedMemoryRetrievalServiceV0 } from "../../../packages/memory/dist/index.js";
import { createConversationDeliveryLedgerAuthorityV0 } from "../../../packages/runtime/dist/index.js";
import type { ConversationDeliveryLedgerAuthority } from "../../../packages/runtime/dist/transitions/conversation/behavior-delivery-ledger.js";
import { LearningTransitionExecutor } from "../../../packages/runtime/dist/transitions/learning/learning-transition-executor.js";
import { observationInput, observationCauseRefOf } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import { buildContextDelta } from "../../../packages/runtime/dist/ports/context-producer-port.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import { BoundedAffectTimeProducerV0 } from "../../../packages/runtime/dist/producers/bounded-affect-time-producer-v0.js";
import { ReferenceRegulationV0Producer } from "../../../packages/runtime/dist/producers/reference-regulation-v0-producer.js";
import {
  admitEvent,
  appraiseAdmitted,
  applyAffect,
  buildWorld,
  currentBindings,
  readSnapshot,
  type World
} from "../canonical-affect-behavior-influence-v1/harness.ts";
import {
  captureFutureProjection,
  restoreWorld,
  type FutureCapture,
  type RestoredRuntime
} from "../durable-life-history-future-behavior-divergence-v0/harness.ts";
import {
  renderProviderRequest,
  type RenderedProviderRequest
} from "../durable-life-history-future-behavior-divergence-v0-remeasure/harness.ts";
import { generateRealBehavior } from "../durable-life-history-future-behavior-divergence-v0/real-generation.ts";
import { check, hashJson } from "../durable-life-history-future-behavior-divergence-v0/fixtures.ts";
import { ALICE, CONVERSATION_ID, EXPERIMENT_VERSION, REPLY_APPRAISAL, SUBJECT, type EpisodePlanV0 } from "./contract.ts";

/** The subject's own canonical ENTITY ref (distinct from its subject_id). */
const SUBJECT_ENTITY_REF = "subject:s0";

export { buildWorld, captureFutureProjection, readSnapshot, renderProviderRequest, restoreWorld };
export type { FutureCapture, RenderedProviderRequest, RestoredRuntime, World };

const ADAPTER = "longitudinal-life-adapter";

/** The environment's own explicit external task state (§26) — never subject Memory. */
export interface EnvironmentState {
  exchange_count: number;
  decision_recorded: string | null;
  open_item_raised: boolean;
}

export function initialEnvironmentState(): EnvironmentState {
  return { exchange_count: 0, decision_recorded: null, open_item_raised: false };
}

/** §25 — deterministic counterpart: inputs are the delivered behavior text and
 * the environment's own explicit state ONLY. */
export function counterpartReply(behaviorText: string, state: EnvironmentState): { readonly reply: string; readonly next_state: EnvironmentState } {
  const trimmed = behaviorText.trim();
  check(trimmed.length > 0, "counterpart policy received an empty behavior");
  const firstSentence = trimmed.split(/(?<=[.!?。！？])\s/)[0] ?? trimmed;
  const topic = firstSentence.slice(0, 80).replace(/[.!?。！？]$/, "");
  const asks = trimmed.includes("?") || trimmed.includes("？");
  const reply = asks
    ? `Sure — about "${topic}": I have noted the open item on the shared checklist and will confirm it before the review.`
    : `Thanks — about "${topic}": I have recorded that on the shared checklist and left one follow-up item for the review.`;
  return {
    reply,
    next_state: {
      exchange_count: state.exchange_count + 1,
      decision_recorded: asks ? state.decision_recorded : firstSentence.slice(0, 120),
      open_item_raised: asks || state.open_item_raised
    }
  };
}

interface IntervalResult {
  readonly valence_before: number;
  readonly valence_after: number;
  readonly activation_after: number;
  readonly logical_time_after: number;
}

/** §22 — lawful interval: one v4 TimeTransition (the only recovery writer), on
 * either the live world or the restored authoritative runtime. */
export async function advanceInterval(
  target: { readonly world?: World; readonly restored?: RestoredRuntime },
  ticks: number,
  tag: string
): Promise<IntervalResult> {
  const assembly = target.world !== undefined ? target.world.assembly : target.restored!.assembly;
  const repo = target.world !== undefined ? target.world.repo : target.restored!.repo;
  const issuer = target.world !== undefined ? target.world.issuer : target.restored!.issuer;
  const snapshot = (await assembly.facade.readCurrentSnapshot(SUBJECT as never)) as SubjectStateV4;
  check(snapshot !== null, "interval snapshot must exist");
  if (ticks === 0) {
    return {
      valence_before: snapshot.affect.valence,
      valence_after: snapshot.affect.valence,
      activation_after: snapshot.affect.activation,
      logical_time_after: snapshot.runtime_metadata.logical_time as number
    };
  }
  const affectDelta = await new BoundedAffectTimeProducerV0().produceCanonicalAffectTimeDelta({
    current_affect: snapshot.affect,
    elapsed_ticks: ticks
  });
  const regulationDelta = await new ReferenceRegulationV0Producer().produceRegulationDelta({
    context: {
      subject_id: SUBJECT as never,
      current_logical_time: snapshot.runtime_metadata.logical_time as never,
      state_revision: snapshot.runtime_metadata.state_revision as never
    },
    regulation: snapshot.regulation,
    elapsed_ticks: ticks
  });
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: `t-life-interval-${tag}-r${snapshot.runtime_metadata.state_revision}`,
    subject_id: snapshot.identity.subject_id,
    transition_type: "Time",
    expected_state_revision: snapshot.runtime_metadata.state_revision,
    time_input: { kind: "ELAPSED", elapsed_time: { value: ticks, unit: "tick" } },
    cause_refs: [],
    domain_deltas: [affectDelta, regulationDelta],
    external_refs: []
  } as unknown as Parameters<typeof assembly.facade.reserveAndRoute>[0];
  const reserved = await assembly.facade.reserveAndRoute(proposal);
  check(reserved.kind === "CONTINUE", `interval reservation failed: ${reserved.kind}`);
  const outcome = await assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: issuer.issue([
      { producer: "affect", domain: "affect" },
      { producer: "regulation", domain: "regulation" }
    ]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-interval-${tag}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(repo, snapshot) as never
  });
  check(outcome.kind === "COMMITTED", `interval must commit: ${outcome.kind}`);
  const after = outcome.bundle.next_snapshot as SubjectStateV4;
  return {
    valence_before: snapshot.affect.valence,
    valence_after: after.affect.valence,
    activation_after: after.affect.activation,
    logical_time_after: after.runtime_metadata.logical_time as number
  };
}

/** Governed episode context commit + production retrieval in ONE Observation
 * commit (§13/§15): the episode scene/task enter canonical context through the
 * context producer, and frozen retrieval selects prior lived episodes. */
export async function commitEpisodeObservation(
  assembly: World["assembly"] | RestoredRuntime["assembly"],
  repo: World["repo"] | RestoredRuntime["repo"],
  issuer: World["issuer"] | RestoredRuntime["issuer"],
  episode: EpisodePlanV0,
  episodeTag: string
): Promise<{ readonly working_episode_refs: readonly string[]; readonly selected_refs: readonly string[]; readonly observation_ref: string; readonly context_hash: string }> {
  const retrievalService = new RepositoryBackedMemoryRetrievalServiceV0(repo as never);
  const snapshot = (await assembly.facade.readCurrentSnapshot(SUBJECT as never)) as SubjectStateV4;
  check(snapshot !== null, "episode snapshot must exist");
  const observation = observationInput({
    observation_id: `observation:o-${episodeTag}`,
    source_refs: ["source:s-3"],
    entity_refs: [ALICE, SUBJECT_ENTITY_REF],
    occurrence_logical_time: snapshot.runtime_metadata.logical_time
  });
  const baseContextDelta = await buildContextDelta(observation, snapshot as never);
  const baseOp = baseContextDelta.operations[0] as { path: string; value: Record<string, unknown> };
  check(baseOp !== undefined && baseOp.path === "/context", "context delta shape");
  const contextDelta = {
    ...baseContextDelta,
    operations: [{ ...baseOp, value: { ...baseOp.value, scene: episode.scene, task: episode.task } }]
  } as typeof baseContextDelta;
  const query = {
    schema_version: "memory-retrieval-query-v0" as never,
    subject_id: SUBJECT as never,
    repository_revision: snapshot.memory_state.repository_revision as never,
    semantic_reference: snapshot.context.current_observation_ref as never,
    temporal: { now_logical_time: snapshot.runtime_metadata.logical_time as never, window_start: null },
    entity_refs: [...snapshot.context.active_entity_refs].sort() as never,
    relationship_refs: [] as never,
    current_context_refs: [...snapshot.context.focus_refs].sort() as never,
    salience_constraints: { min_declared_score: null, max_candidates: 8 }
  };
  const retrievalResult = await retrievalService.retrieve(query as never);
  const selected = [...retrievalResult.selected_memory_refs] as unknown as readonly string[];
  const traceRefs = retrievalResult.retrieval_trace_ref === null ? [] : [retrievalResult.retrieval_trace_ref as string];
  const memoryDelta = {
    producer: "memory",
    domain: "memory-retrieval",
    expected_repository_revision: snapshot.memory_state.repository_revision,
    operations: [
      { path: "/memory_state/last_retrieval_at", value: snapshot.runtime_metadata.logical_time as never },
      { path: "/memory_state/recent_retrieval_trace", value: traceRefs },
      { path: "/memory_state/working_refs", value: selected }
    ],
    provenance_refs: []
  } as never;
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [contextDelta, memoryDelta]
  });
  const reserved = await assembly.facade.reserveAndRoute(proposal);
  check(reserved.kind === "CONTINUE", `episode observation reservation: ${reserved.kind}`);
  const outcome = await assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: (issuer as RestoredRuntime["issuer"]).issue([
      { producer: "context", domain: "context" },
      { producer: "memory", domain: "memory-retrieval" }
    ]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-episode-obs-${episodeTag}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(repo as never, snapshot) as never
  });
  check(outcome.kind === "COMMITTED", `episode observation must commit: ${JSON.stringify(outcome).slice(0, 240)}`);
  const committed = outcome.bundle.next_snapshot as SubjectStateV4;
  return {
    working_episode_refs: selected.filter((ref) => ref.startsWith("episode:")),
    selected_refs: selected,
    observation_ref: observation.observation_id,
    context_hash: hashJson({ scene: committed.context.scene, task: committed.context.task })
  };
}

/** The frozen downstream trial record stores a REDUCED behavior record; the full
 * CharacterLanguageBehaviorV0 artifact is lawfully re-derived through the frozen
 * production constructors (validated language draft for REALIZE; the cognition
 * proposal binding for CLARIFY) so the host delivery authority can validate it. */
export async function rederiveFullBehavior(
  record: Record<string, unknown>,
  projection: Record<string, unknown>,
  responseRequestId: string,
  label: string
): Promise<unknown> {
  const language = record["language"] as { validated_draft: Record<string, unknown> | null };
  const sourceRevision = projection["state_revision"] as number;
  const projectionHash = projection["projection_hash"] as string;
  let fullBehavior: { ok: true; behavior: unknown } | { ok: false; detail: string };
  if (language.validated_draft !== null && language.validated_draft !== undefined) {
    fullBehavior = await buildCharacterLanguageBehaviorV0({
      subject_id: SUBJECT as never,
      source_revision: sourceRevision as never,
      response_request_id: responseRequestId as never,
      draft: language.validated_draft as never
    });
  } else {
    const conversation = (record["cognition"] as { validated_conversation_proposal: Record<string, unknown> | null }).validated_conversation_proposal;
    check(conversation !== null, `${label}: clarify arm without stored conversation proposal`);
    const proposalHash = await hashEnvelope("characteros-next/runtime/conversation-cognition-proposal/v1", conversation as never);
    fullBehavior = await buildClarificationBehaviorV0({
      subject_id: SUBJECT as never,
      source_revision: sourceRevision as never,
      response_request_id: responseRequestId as never,
      cognition_projection_hash: projectionHash as never,
      conversation_cognition_proposal_hash: proposalHash as never
    });
  }
  check(fullBehavior.ok, `${label}: behavior re-derivation failed: ${fullBehavior.ok ? "" : fullBehavior.detail}`);
  return fullBehavior.behavior;
}

export interface EpisodeResult {
  readonly episode: string;
  readonly order: number;
  readonly post_restore: boolean;
  readonly interval: IntervalResult;
  readonly affect_before_episode: number;
  readonly affect_after_episode: number;
  readonly affect_after_episode_close: number;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
  readonly event_ref: string | null;
  readonly appraisal_ref: string | null;
  readonly appraisal_dimensions: unknown;
  readonly context_hash: string;
  readonly selected_refs: readonly string[];
  readonly working_episode_refs: readonly string[];
  readonly production_evidence_bundle: unknown;
  readonly projection: Record<string, unknown>;
  readonly rendered: RenderedProviderRequest;
  readonly trace_request_hash: string | null;
  readonly request_identity_match: boolean;
  readonly record: Record<string, unknown>;
  readonly thought: {
    readonly status: string;
    readonly current_intent: string | null;
    readonly directive: string | null;
    readonly considered_context_refs: readonly string[] | null;
    readonly evidence_refs: readonly string[] | null;
    readonly relevant_memory_refs: readonly string[] | null;
    readonly reasoning_summary: string | null;
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
  readonly behavior_id: string | null;
  readonly full_behavior: unknown;
  readonly counterpart_reply: string;
  readonly environment_state_after: EnvironmentState;
  readonly delivery_id: string;
  readonly reply_event_ref: string;
  readonly reply_observation_ref: string;
  readonly experience_ref: string | null;
  readonly episode_ref: string | null;
  readonly memory_event_ref: string | null;
  readonly reply_appraisal_ref: string | null;
  readonly affect_after_reply_appraisal: number | null;
}

export interface GenerationSnapshot {
  readonly episode: string;
  readonly order: number;
  readonly post_restore: boolean;
  readonly cognition_status: string;
  readonly cognition_current_intent: string | null;
  readonly communication_directive: string | null;
  readonly considered_context_refs: readonly string[] | null;
  readonly evidence_refs: readonly string[] | null;
  readonly relevant_memory_refs: readonly string[] | null;
  readonly reasoning_summary: string | null;
  readonly cognition_latency_ms: number;
  readonly cognition_prompt_tokens: number | null;
  readonly cognition_completion_tokens: number | null;
  readonly cognition_total_tokens: number | null;
  readonly cognition_raw_response: string | null;
  readonly language_call_required: boolean;
  readonly language_status: string;
  readonly language_input_hash: string | null;
  readonly language_latency_ms: number;
  readonly language_total_tokens: number | null;
  readonly language_raw_response: string | null;
  readonly behavior_id: string | null;
  readonly behavior_text: string;
  readonly behavior_content_hash: string | null;
  readonly rendered_request_hash: string;
  readonly trace_request_hash: string | null;
  readonly request_identity_match: boolean;
  readonly rendered_memory_section_present: boolean;
  readonly rendered_memory_section: string;
  readonly provider_input_hash: string;
  readonly projection_hash: string;
  readonly current_event_ref: string | null;
  readonly retrieved_evidence_refs: readonly string[];
}

export interface EpisodeTarget {
  readonly mode: "live" | "restored";
  readonly world?: World;
  readonly restored?: RestoredRuntime;
}

export async function runEpisode(
  target: EpisodeTarget,
  episode: EpisodePlanV0,
  environment: EnvironmentState,
  realCalls: { cognition: number; language: number },
  episodeTag: string,
  hooks: { readonly onGeneration?: (snapshot: GenerationSnapshot) => void } = {}
): Promise<EpisodeResult> {
  const live = target.mode === "live";
  const world = target.world ?? null;
  const runtime = target.restored ?? null;
  const assembly = live ? world!.assembly : runtime!.assembly;
  const repo = live ? world!.repo : runtime!.repo;
  const issuer = live ? world!.issuer : runtime!.issuer;
  const deliveryLedger: ConversationDeliveryLedgerAuthority = live
    ? (() => {
        const holder = world as unknown as { deliveryLedger?: ConversationDeliveryLedgerAuthority };
        if (holder.deliveryLedger === undefined) holder.deliveryLedger = createConversationDeliveryLedgerAuthorityV0();
        return holder.deliveryLedger;
      })()
    : runtime!.deliveryLedger;
  const ingressLedger = live ? world!.ingressLedger : runtime!.ingressLedger;

  const readCurrent = async (): Promise<SubjectStateV4> => {
    const snapshot = await assembly.facade.readCurrentSnapshot(SUBJECT as never);
    check(snapshot !== null, "episode snapshot must exist");
    return snapshot as SubjectStateV4;
  };

  const interval = await advanceInterval(live ? { world: world! } : { restored: runtime! }, episode.interval_ticks, episodeTag);
  const snapshotBefore = await readCurrent();
  const affectBefore = snapshotBefore.affect.valence;
  const revisionBefore = snapshotBefore.runtime_metadata.state_revision as number;
  const repositoryRevisionBefore = snapshotBefore.memory_state.repository_revision as string;

  // §23 — lawful current Appraisal + AffectApplication (live episodes only).
  let eventRef: string | null = null;
  let appraisalRef: string | null = null;
  if (live) {
    const admitted = await admitEvent(world!, `life-${episodeTag}`, episode.scene);
    world!.dimensionOverrides.set(admitted.event_ref, { ...episode.appraisal });
    appraisalRef = await appraiseAdmitted(world!, `life-${episodeTag}`, admitted);
    await applyAffect(world!, admitted.event_ref);
    eventRef = admitted.event_ref;
  }
  const affectAfterEpisode = (await readCurrent()).affect.valence;

  const observation = await commitEpisodeObservation(assembly, repo, issuer, episode, episodeTag);
  const capture: FutureCapture = await captureFutureProjection(
    { assembly, repo, issuer, deliveryLedger, ingressLedger } as never,
    { ablate: false }
  );
  const rendered = await renderProviderRequest(capture.projection);

  const metadata = {
    subject_state_hash: hashJson(snapshotBefore),
    current_event_ref: eventRef ?? `episode:${episodeTag}`,
    current_appraisal_ref: appraisalRef ?? `appraisal:${episodeTag}`,
    current_appraisal_dimensions: { ...episode.appraisal },
    history_proof: { episode: episode.episode, order: episode.order, post_restore: !live }
  };
  realCalls.cognition += 1;
  const item = {
    cell: {
      scenario: { scenario_id: `${EXPERIMENT_VERSION}/${episode.episode}`, current_factual_event: episode.scene },
      provider_inputs: { S: capture.projection },
      metadata: { S: metadata }
    },
    arm: "S",
    trial_ordinal: episode.order,
    execution_order: realCalls.cognition,
    within_unit_order: 1,
    trial_id: `${EXPERIMENT_VERSION}/${episode.episode}`,
    response_request_id: `response-${episodeTag}`
  };
  const record = await generateRealBehavior(item as never) as unknown as Record<string, unknown>;
  const cognitionRecord = record["cognition"] as {
    status: string;
    current_intent: string | null;
    communication_directive: string | null;
    validated_cognition_proposal: Record<string, unknown> | null;
    latency_ms: number;
    token_counts: { prompt_tokens: number | null; completion_tokens: number | null; total_tokens: number | null };
    transport_trace: { request_hash?: string } | null;
    failure: unknown;
  };
  const languageRecord = record["language"] as {
    call_required: boolean;
    status: string;
    input_hash: string | null;
    latency_ms: number;
    token_counts: { total_tokens: number | null };
    failure: unknown;
  };
  if (languageRecord.status === "VALID") realCalls.language += 1;
  check(
    ["VALID", "DIRECTIVE_CLARIFY"].includes(String(record["status"])),
    `${episode.episode}: generation failed: ${String(record["status"])} ${JSON.stringify(cognitionRecord.failure ?? languageRecord.failure ?? {}).slice(0, 300)}`
  );
  const behaviorText = (record["behavior"] as { text?: string } | undefined)?.text ?? "";
  check(behaviorText.length > 0, `${episode.episode}: behavior text empty`);
  const fullBehavior = await rederiveFullBehavior(record, capture.projection, item.response_request_id, episode.episode);
  const validated = cognitionRecord.validated_cognition_proposal;
  const traceRequestHash = cognitionRecord.transport_trace?.request_hash ?? null;

  // §52 — call records are emitted IMMEDIATELY after generation, before any
  // later lifecycle step, so no abort can ever lose call accounting.
  hooks.onGeneration?.({
    episode: episode.episode,
    order: episode.order,
    post_restore: !live,
    cognition_status: cognitionRecord.status,
    cognition_current_intent: cognitionRecord.current_intent,
    communication_directive: cognitionRecord.communication_directive,
    considered_context_refs: (validated?.["considered_context_refs"] as readonly string[] | undefined) ?? null,
    evidence_refs: (validated?.["evidence_refs"] as readonly string[] | undefined) ?? null,
    relevant_memory_refs: (validated?.["relevant_memory_refs"] as readonly string[] | undefined) ?? null,
    reasoning_summary: (validated?.["reasoning_summary"] as string | undefined) ?? null,
    cognition_latency_ms: cognitionRecord.latency_ms,
    cognition_prompt_tokens: cognitionRecord.token_counts.prompt_tokens,
    cognition_completion_tokens: cognitionRecord.token_counts.completion_tokens,
    cognition_total_tokens: cognitionRecord.token_counts.total_tokens,
    cognition_raw_response: ((cognitionRecord as unknown as { raw_response?: { content?: string } | null }).raw_response?.content) ?? null,
    language_call_required: languageRecord.call_required,
    language_status: languageRecord.status,
    language_input_hash: languageRecord.input_hash,
    language_latency_ms: languageRecord.latency_ms,
    language_total_tokens: languageRecord.token_counts.total_tokens,
    language_raw_response: ((languageRecord as unknown as { raw_response?: { content?: string } | null }).raw_response?.content) ?? null,
    behavior_id: (fullBehavior as { behavior_id?: string } | undefined)?.behavior_id ?? null,
    behavior_text: behaviorText,
    behavior_content_hash: (record["behavior_content_hash"] as string | null) ?? null,
    rendered_request_hash: rendered.request_hash,
    trace_request_hash: traceRequestHash,
    request_identity_match: traceRequestHash !== null && traceRequestHash === rendered.request_hash,
    rendered_memory_section_present: rendered.memory_section_present,
    rendered_memory_section: rendered.memory_section,
    provider_input_hash: hashJson(capture.projection),
    projection_hash: capture.projection["projection_hash"] as string,
    current_event_ref: eventRef,
    retrieved_evidence_refs: observation.working_episode_refs
  });

  // §14/§27 — delivery → counterpart → linked ingress → reply Observation.
  const deliveryOutcome = await deliveryLedger.recordConversationDelivery({
    subject_id: SUBJECT,
    conversation_id: CONVERSATION_ID,
    behavior: fullBehavior as never,
    delivered_logical_time: (await readCurrent()).runtime_metadata.logical_time as never,
    status: "DELIVERED",
    host_adapter: ADAPTER
  });
  check(deliveryOutcome.ok, `delivery must record: ${deliveryOutcome.ok ? "" : deliveryOutcome.detail}`);
  const counterpart = counterpartReply(behaviorText, environment);
  const replyIngress = await ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: CONVERSATION_ID,
    actor_ref: ALICE,
    text: counterpart.reply,
    logical_time: (await readCurrent()).runtime_metadata.logical_time as never,
    source_event_id: `${episodeTag}-reply`,
    in_reply_to_delivery_id: deliveryOutcome.record.delivery_id,
    host_adapter: ADAPTER
  });
  check(replyIngress.kind === "RECORDED", `reply ingress must record: ${replyIngress.kind}`);
  const replySnapshot = await readCurrent();
  const replyObservation = observationInput({
    observation_id: `observation:o-${episodeTag}-reply`,
    source_refs: [replyIngress.record.event_ref as string, "source:s-3"],
    entity_refs: [ALICE, SUBJECT_ENTITY_REF],
    occurrence_logical_time: replySnapshot.runtime_metadata.logical_time
  });
  const replyContextDelta = await buildContextDelta(replyObservation, replySnapshot as never);
  const replyProposal = await buildObservationProposal({
    subjectId: SUBJECT,
    stateRevision: replySnapshot.runtime_metadata.state_revision as number,
    observation: replyObservation,
    deltas: [replyContextDelta]
  });
  const replyReserved = await assembly.facade.reserveAndRoute(replyProposal);
  check(replyReserved.kind === "CONTINUE", `reply observation reservation: ${replyReserved.kind}`);
  const replyOutcome = await assembly.facade.commitReserved({
    proposal: replyProposal,
    continuation: replyReserved.continuation,
    producerAuthorization: (issuer as RestoredRuntime["issuer"]).issue([{ producer: "context", domain: "context" }]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-reply-${episodeTag}` as never,
      transition_id: replyProposal.transition_id,
      subject_id: replyProposal.subject_id,
      transition_type: replyProposal.transition_type,
      payload_fingerprint: await proposalFingerprint(replyProposal)
    },
    repository_bindings: await currentBindings(repo as never, replySnapshot) as never
  });
  check(replyOutcome.kind === "COMMITTED", `reply observation must commit: ${JSON.stringify(replyOutcome).slice(0, 200)}`);

  // §27/§28 — Experience + durable Memory through the frozen feedback authority.
  // E4 (post-restore) intentionally stops at the §44 preferred endpoint.
  let experienceRef: string | null = null;
  let episodeRef: string | null = null;
  let memoryEventRef: string | null = null;
  let replyAppraisalRef: string | null = null;
  let affectAfterReplyAppraisal: number | null = null;
  if (live) {
    const feedbackExecutor = new LearningTransitionExecutor(
      buildFeedbackContainer(assembly, repo, issuer, deliveryLedger, ingressLedger) as never
    );
    const feedbackSnapshot = await readCurrent();
    const feedbackOutcome = await feedbackExecutor.executeBehaviorOutcomeFeedback(
      {
        subject_id: SUBJECT as never,
        current_logical_time: feedbackSnapshot.runtime_metadata.logical_time as never,
        state_revision: feedbackSnapshot.runtime_metadata.state_revision as never
      } as never,
      {
        candidate: {
          subject_id: SUBJECT,
          conversation_id: CONVERSATION_ID,
          source_event_id: `${episodeTag}-reply`,
          observation_transition_id: replyOutcome.bundle.transition_id,
          observation_ref: observationCauseRefOf(replyOutcome.bundle),
          declared_salience: 0.5,
          host_adapter: ADAPTER
        }
      } as never
    );
    check(feedbackOutcome.kind === "COMMITTED", `feedback must commit: ${JSON.stringify(feedbackOutcome).slice(0, 260)}`);
    experienceRef = feedbackOutcome.refs.experience_ref;
    episodeRef = feedbackOutcome.refs.episode_ref;
    memoryEventRef = feedbackOutcome.refs.event_ref;

    // Lawful affect-work-queue completion: the counterpart reply is a factual
    // event the subject lived through; appraising and applying it keeps every
    // earlier admitted event terminal so the NEXT episode can lawfully appraise
    // its own current event (frozen `PRIOR_AFFECT_WORK_PENDING` law).
    const replyAdmission = {
      event_ref: replyIngress.record.event_ref as string,
      observation_transition_id: replyOutcome.bundle.transition_id as string,
      observation_ref: observationCauseRefOf(replyOutcome.bundle)
    };
    world!.dimensionOverrides.set(replyAdmission.event_ref, { ...REPLY_APPRAISAL });
    replyAppraisalRef = await appraiseAdmitted(world!, `${episodeTag}-reply`, replyAdmission);
    await applyAffect(world!, replyAdmission.event_ref);
    affectAfterReplyAppraisal = (await readCurrent()).affect.valence;
  }

  const afterSnapshot = await readCurrent();
  return {
    episode: episode.episode,
    order: episode.order,
    post_restore: !live,
    interval,
    affect_before_episode: affectBefore,
    affect_after_episode: affectAfterEpisode,
    affect_after_episode_close: afterSnapshot.affect.valence,
    state_revision_before: revisionBefore,
    state_revision_after: afterSnapshot.runtime_metadata.state_revision as number,
    repository_revision_before: repositoryRevisionBefore,
    repository_revision_after: afterSnapshot.memory_state.repository_revision as string,
    event_ref: eventRef,
    appraisal_ref: appraisalRef,
    appraisal_dimensions: live ? { ...episode.appraisal } : null,
    context_hash: observation.context_hash,
    selected_refs: observation.selected_refs,
    working_episode_refs: observation.working_episode_refs,
    production_evidence_bundle: capture.production_evidence_bundle,
    projection: capture.projection,
    rendered,
    trace_request_hash: traceRequestHash,
    request_identity_match: traceRequestHash !== null && traceRequestHash === rendered.request_hash,
    record,
    thought: {
      status: cognitionRecord.status,
      current_intent: cognitionRecord.current_intent,
      directive: cognitionRecord.communication_directive,
      considered_context_refs: (validated?.["considered_context_refs"] as readonly string[] | undefined) ?? null,
      evidence_refs: (validated?.["evidence_refs"] as readonly string[] | undefined) ?? null,
      relevant_memory_refs: (validated?.["relevant_memory_refs"] as readonly string[] | undefined) ?? null,
      reasoning_summary: (validated?.["reasoning_summary"] as string | undefined) ?? null,
      latency_ms: cognitionRecord.latency_ms,
      prompt_tokens: cognitionRecord.token_counts.prompt_tokens,
      completion_tokens: cognitionRecord.token_counts.completion_tokens,
      total_tokens: cognitionRecord.token_counts.total_tokens
    },
    language: {
      call_required: languageRecord.call_required,
      status: languageRecord.status,
      input_hash: languageRecord.input_hash,
      latency_ms: languageRecord.latency_ms,
      total_tokens: languageRecord.token_counts.total_tokens
    },
    behavior_text: behaviorText,
    behavior_content_hash: (record["behavior_content_hash"] as string | null) ?? null,
    behavior_id: (fullBehavior as { behavior_id?: string } | undefined)?.behavior_id ?? null,
    full_behavior: fullBehavior,
    counterpart_reply: counterpart.reply,
    environment_state_after: counterpart.next_state,
    delivery_id: deliveryOutcome.record.delivery_id,
    reply_event_ref: replyIngress.record.event_ref as string,
    reply_observation_ref: observationCauseRefOf(replyOutcome.bundle),
    experience_ref: experienceRef,
    episode_ref: episodeRef,
    memory_event_ref: memoryEventRef,
    reply_appraisal_ref: replyAppraisalRef,
    affect_after_reply_appraisal: affectAfterReplyAppraisal
  };
}

function buildFeedbackContainer(
  assembly: World["assembly"] | RestoredRuntime["assembly"],
  repo: World["repo"] | RestoredRuntime["repo"],
  issuer: World["issuer"] | RestoredRuntime["issuer"],
  deliveryLedger: ConversationDeliveryLedgerAuthority,
  ingressLedger: World["ingressLedger"] | RestoredRuntime["ingressLedger"]
): Record<string, unknown> {
  return {
    subjectCore: assembly.facade,
    producerAuthorizationIssuer: issuer,
    memoryRepository: repo,
    memory: { repository: createMemoryPreparationAuthority(repo as never) },
    experiencePayloadRepository: repo,
    learningSourceAuthority: {
      readCommittedBundle: async (id: string) =>
        assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null
    } as never,
    learningAdoptionAuthority: {
      markAdopted: (ref: never) => void (repo as unknown as { markAdopted: (r: never) => void }).markAdopted(ref),
      isAdopted: (ref: never) => (repo as unknown as { isAdopted: (r: never) => boolean }).isAdopted(ref)
    } as never,
    conversationDeliveryLedger: deliveryLedger,
    conversationIngressLedger: ingressLedger,
    retrieval: {
      retrieve: async () => {
        throw new Error("EXPERIMENT: episode feedback must not call retrieval");
      }
    }
  };
}

/** §37 — classify each provider-visible factual evidence entry by its origin episode. */
export function classifyEvidenceOrigin(
  productionBundle: unknown,
  episodeRefsByEpisode: Readonly<Record<string, string | null>>
): { readonly classifications: readonly { readonly episode_ref: string; readonly class: string }[]; readonly classes: readonly string[] } {
  const bundle = productionBundle as { entries?: readonly { episode_ref?: string }[] } | null;
  const entries = bundle?.entries ?? [];
  const classifications = entries.map((entry) => {
    const ref = entry.episode_ref ?? "";
    const owner = Object.entries(episodeRefsByEpisode).find(([, value]) => value !== null && value === ref);
    return { episode_ref: ref, class: owner === undefined ? "OTHER_FROZEN_CONTEXT" : `FROM_${owner[0]}` };
  });
  return { classifications, classes: [...new Set(classifications.map((entry) => entry.class))] };
}
