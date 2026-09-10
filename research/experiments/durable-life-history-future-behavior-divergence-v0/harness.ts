/* eslint-disable no-restricted-imports -- Isolated future-divergence experiment harness over frozen built production roots; deterministic downstream lifecycle, bounded real generation. */

import type {
  SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";
import { proposalFingerprint, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import {
  createEpisodeContentReaderV0,
  RepositoryBackedMemoryRetrievalServiceV0,
  type MemoryRetrievalQueryV0
} from "../../../packages/memory/dist/index.js";
import { FactualMemoryEvidenceResolverV0 } from "../../../packages/runtime/dist/transitions/cognition-action/factual-memory-evidence.js";
import { createExperienceReaderV0 } from "../../../packages/runtime/dist/transitions/conversation/experience-reader.js";
import {
  CognitionActionTransitionExecutor
} from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import { createMiclStageMinter } from "../../../packages/runtime/dist/micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../../packages/runtime/dist/micl/micl-workflow-store.js";
import { buildContextDelta } from "../../../packages/runtime/dist/ports/context-producer-port.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import { observationInput } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import {
  buildCharacterLanguageBehaviorV0,
  buildClarificationBehaviorV0
} from "../../../packages/behavior/dist/index.js";
import {
  buildWorld,
  currentBindings,
  readSnapshot,
  runCognitionCapture,
  type World
} from "../canonical-affect-behavior-influence-v1/harness.ts";
import {
  constructArmHistory,
  equalizeAffect,
  restoreWorld,
  runConsequenceChain
} from "../affect-driven-behavior-experience-memory-causal-chain-v0/harness.ts";
import { check, hashJson } from "./fixtures.ts";
import {
  EXPERIMENT_VERSION,
  FUTURE_SCENARIO,
  SUBJECT,
  type FutureArm,
  type LifeScenarioV0,
  type TreatmentArm
} from "./contract.ts";
import { generateRealBehavior } from "./real-generation.ts";

export {
  buildWorld,
  constructArmHistory,
  equalizeAffect,
  readSnapshot,
  restoreWorld,
  runConsequenceChain
};

export type RestoredRuntime = Awaited<ReturnType<typeof restoreWorld>>;

/** Life metadata captured at history-construction time (the trial identity
 * the frozen downstream stage requires). */
export interface LifeMetadata {
  readonly subject_state_hash: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: unknown;
  readonly history_proof: unknown;
}

export interface LifeArmBuild {
  readonly arm: TreatmentArm;
  readonly scenario: LifeScenarioV0;
  readonly world: World;
  readonly metadata: LifeMetadata;
  readonly provider_input: unknown;
  readonly record: Record<string, unknown>;
  readonly behavior_text: string;
  readonly full_behavior: unknown;
}

export interface LifeArmComplete {
  readonly arm: TreatmentArm;
  readonly scenario_id: string;
  readonly world: World;
  readonly metadata: LifeMetadata;
  readonly provider_input: unknown;
  readonly record: Record<string, unknown>;
  readonly behavior_text: string;
  readonly full_behavior: unknown;
  readonly chain: Awaited<ReturnType<typeof runConsequenceChain>>;
  readonly equalization: Awaited<ReturnType<typeof equalizeAffect>>;
}

/** §11/§12 — ONE life arm through the frozen chain-slice lifecycle: explicit-v4
 * world, lawful prior/current history, real cognition + real language (the
 * frozen two-stage downstream runner), full behavior re-derivation. */
export async function buildLifeArm(
  scenario: LifeScenarioV0,
  arm: TreatmentArm,
  realCalls: { cognition: number; language: number }
): Promise<LifeArmBuild> {
  const world: World = await buildWorld(scenario.current_task);
  const metadata = await constructArmHistory(world, arm, scenario) as LifeMetadata;
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
  const record = await generateRealBehavior(item as never) as unknown as Record<string, unknown>;
  const languageStatus = (record["language"] as { status: string } | undefined)?.status;
  if (languageStatus === "VALID") realCalls.language += 1;
  check(
    record["status"] === "VALID" || record["status"] === "DIRECTIVE_CLARIFY",
    `${scenario.scenario_id}/${arm}: generation failed: ${String(record["status"])} ${JSON.stringify((record["language"] as { failure?: unknown } | undefined)?.failure ?? (record["cognition"] as { failure?: unknown } | undefined)?.failure ?? {}).slice(0, 200)}`
  );
  const behaviorText = (record["behavior"] as { text?: string } | undefined)?.text ?? "";
  check(behaviorText.length > 0, `${scenario.scenario_id}/${arm}: behavior text empty`);
  const fullBehavior = await rederiveFullBehavior(record, providerInput, item.response_request_id, `${scenario.scenario_id}/${arm}`);
  return { arm, scenario, world, metadata, provider_input: providerInput, record, behavior_text: behaviorText, full_behavior: fullBehavior };
}

/** The downstream trial record stores a reduced behavior record; the full
 * CharacterLanguageBehaviorV0 artifact is lawfully re-derived through the
 * frozen production constructors (validated language draft for REALIZE; the
 * cognition proposal binding for CLARIFY). Same pattern as the frozen chain
 * slice cli. */
async function rederiveFullBehavior(
  record: Record<string, unknown>,
  providerInput: unknown,
  responseRequestId: string,
  label: string
): Promise<unknown> {
  const language = record["language"] as { validated_draft: Record<string, unknown> | null };
  const projection = providerInput as { state_revision: number; projection_hash: string };
  let fullBehavior: { ok: true; behavior: unknown } | { ok: false; detail: string };
  if (language.validated_draft !== null && language.validated_draft !== undefined) {
    fullBehavior = await buildCharacterLanguageBehaviorV0({
      subject_id: SUBJECT as never,
      source_revision: projection.state_revision as never,
      response_request_id: responseRequestId as never,
      draft: language.validated_draft as never
    });
  } else {
    const conversation = (record["cognition"] as { validated_conversation_proposal: Record<string, unknown> | null }).validated_conversation_proposal;
    if (conversation === null) throw new Error(`${label}: clarify arm without stored conversation proposal`);
    const proposalHash = await hashEnvelope("characteros-next/runtime/conversation-cognition-proposal/v1", conversation);
    fullBehavior = await buildClarificationBehaviorV0({
      subject_id: SUBJECT as never,
      source_revision: projection.state_revision as never,
      response_request_id: responseRequestId as never,
      cognition_projection_hash: projection.projection_hash as never,
      conversation_cognition_proposal_hash: proposalHash as never
    });
  }
  check(fullBehavior.ok, `${label}: behavior re-derivation failed: ${fullBehavior.ok ? "" : fullBehavior.detail}`);
  return fullBehavior.ok ? fullBehavior.behavior : null;
}

/** §13-§19 consequence chain + §23/§24 lawful equalization — deterministic
 * given (world, behaviorText, fullBehavior); no provider calls. Used both by
 * the live run and the checkpoint replay. */
export async function completeLife(
  life: LifeArmBuild,
  realCalls: { cognition: number; language: number }
): Promise<LifeArmComplete> {
  void realCalls;
  const chain = await runConsequenceChain(life.world, life.scenario, life.behavior_text, life.full_behavior);
  const equalization = await equalizeAffect(life.world);
  return {
    arm: life.arm,
    scenario_id: life.scenario.scenario_id,
    world: life.world,
    metadata: life.metadata,
    provider_input: life.provider_input,
    record: life.record,
    behavior_text: life.behavior_text,
    full_behavior: life.full_behavior,
    chain,
    equalization
  };
}

/** Rebuilds both lives from the persisted checkpoint with ZERO real calls:
 * world + history construction is deterministic; the delivered behavior and
 * the full behavior artifact come from the checkpoint. Hash-verified. */
export async function rebuildLifeFromCheckpoint(
  checkpoint: {
    readonly scenario: LifeScenarioV0;
    readonly arms: Readonly<Record<string, {
      readonly arm: TreatmentArm;
      readonly metadata: unknown;
      readonly provider_input: unknown;
      readonly record: Record<string, unknown>;
      readonly behavior_text: string;
      readonly full_behavior: unknown;
      readonly subject_state_hash: string;
    }>>;
  },
  arm: TreatmentArm
): Promise<LifeArmComplete> {
  const entry = checkpoint.arms[arm];
  check(entry !== undefined, `checkpoint arm ${arm} missing`);
  const world: World = await buildWorld(checkpoint.scenario.current_task);
  const metadata = await constructArmHistory(world, arm, checkpoint.scenario) as LifeMetadata;
  check(
    metadata.subject_state_hash === entry.subject_state_hash,
    `checkpoint replay ${arm}: subject_state_hash mismatch (deterministic rebuild violated)`
  );
  const life: LifeArmBuild = {
    arm,
    scenario: checkpoint.scenario,
    world,
    metadata: entry.metadata as LifeMetadata,
    provider_input: entry.provider_input,
    record: entry.record,
    behavior_text: entry.behavior_text,
    full_behavior: entry.full_behavior
  };
  return completeLife(life, { cognition: 0, language: 0 });
}

function ctxOf(snapshot: SubjectStateV4) {
  return {
    subject_id: SUBJECT as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
}

async function readSnapshotV4(assembly: RestoredRuntime["assembly"]): Promise<SubjectStateV4> {
  const snapshot = await assembly.facade.readCurrentSnapshot(SUBJECT as never);
  check(snapshot !== null, "snapshot must exist");
  return snapshot as SubjectStateV4;
}

/** §17 future observation through the SAME lawful composition as the frozen
 * chain slice's future observation, plus the governed scene-setting context
 * delta (the exact pattern the chain slice used for its life-scenario Context
 * commit): the future message text enters canonical context through the
 * context producer, and the life's feedback episode enters working refs via
 * the SAME production retrieval path (never a hand-pinned ref). */
export async function commitFutureContextObservation(
  restored: RestoredRuntime,
  scenario: { readonly current_factual_event: string; readonly current_task: string },
  futureEventId: string
): Promise<{
  readonly working_episode_refs: readonly string[];
  readonly observation_ref: string;
  readonly future_context_hash: string;
  readonly post_commit_revision: string;
}> {
  const retrievalService = new RepositoryBackedMemoryRetrievalServiceV0(restored.repo);
  const snapshot = await readSnapshotV4(restored.assembly);
  const observation = observationInput({
    observation_id: `observation:o-${futureEventId}`,
    source_refs: ["source:s-3"],
    entity_refs: ["entity:alice", "subject:s0"],
    occurrence_logical_time: snapshot.runtime_metadata.logical_time
  });
  const baseContextDelta = await buildContextDelta(observation, snapshot as never);
  const baseOp = baseContextDelta.operations[0] as { path: string; value: Record<string, unknown> };
  check(baseOp !== undefined && baseOp.path === "/context", "context delta shape");
  const contextDelta = {
    ...baseContextDelta,
    operations: [{
      ...baseOp,
      value: { ...baseOp.value, scene: scenario.current_factual_event, task: scenario.current_task }
    }]
  } as typeof baseContextDelta;
  const revision = snapshot.memory_state.repository_revision as never;
  const query: MemoryRetrievalQueryV0 = {
    schema_version: "memory-retrieval-query-v0" as never,
    subject_id: SUBJECT as never,
    repository_revision: revision,
    semantic_reference: snapshot.context.current_observation_ref as never,
    temporal: { now_logical_time: snapshot.runtime_metadata.logical_time as never, window_start: null },
    entity_refs: [...snapshot.context.active_entity_refs].sort() as never,
    relationship_refs: [] as never,
    current_context_refs: [...snapshot.context.focus_refs].sort() as never,
    salience_constraints: { min_declared_score: null, max_candidates: 8 }
  };
  const retrievalResult = await retrievalService.retrieve(query);
  const selected = [...retrievalResult.selected_memory_refs];
  const traceRefs = retrievalResult.retrieval_trace_ref === null ? [] : [retrievalResult.retrieval_trace_ref as string];
  const workingEpisodes = selected.filter((ref) => (ref as string).startsWith("episode:"));
  const memoryDelta = {
    producer: "memory",
    domain: "memory-retrieval",
    expected_repository_revision: snapshot.memory_state.repository_revision,
    // set-like ops sorted by path; the trace ring carries retrieval-trace refs
    // while working_refs carries the selected episodes.
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
  const reserved = await restored.assembly.facade.reserveAndRoute(proposal);
  check(reserved.kind === "CONTINUE", `future observation reservation: ${reserved.kind}`);
  const outcome = await restored.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: restored.issuer.issue([
      { producer: "context", domain: "context" },
      { producer: "memory", domain: "memory-retrieval" }
    ]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-future-obs-${futureEventId}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(restored.repo, snapshot) as never
  });
  check(outcome.kind === "COMMITTED", `future observation must commit: ${JSON.stringify(outcome).slice(0, 240)}`);
  const committedSnapshot = outcome.bundle.next_snapshot as SubjectStateV4;
  return {
    working_episode_refs: workingEpisodes.map((ref) => ref as string),
    observation_ref: observation.observation_id,
    future_context_hash: hashJson({ scene: committedSnapshot.context.scene, task: committedSnapshot.context.task }),
    post_commit_revision: committedSnapshot.memory_state.repository_revision as string
  };
}

/** §22 ablation seam: the PRODUCTION resolver always runs against the
 * restored repository; the experimental wrapper removes only the resolved
 * BEHAVIOR_OUTCOME entries before the executor builds the provider-facing
 * projection. Persisted Memory, retrieval, Experience, trusted history and
 * Affect are untouched. */
export function ablateEvidenceBundle(bundle: {
  readonly schema_version: string;
  readonly repository_revision: string;
  readonly entries: readonly { readonly kind: string }[];
}): unknown {
  return {
    schema_version: bundle.schema_version,
    repository_revision: bundle.repository_revision,
    entries: bundle.entries.filter((entry) => entry.kind !== "BEHAVIOR_OUTCOME")
  };
}

export interface FutureCapture {
  readonly projection: Record<string, unknown>;
  /** What the PRODUCTION resolver resolved (never ablated) — audit only. */
  readonly production_evidence_bundle: unknown;
  readonly ablated: boolean;
  readonly subject_state_hash: string;
}

/** §20/§25 — future cognition provider input through the frozen
 * CognitionAction executor with the PRODUCTION factual-evidence resolver
 * wired (optionally wrapped by the §22 ablation seam); the provider is a
 * capturing fake (zero real calls). */
export async function captureFutureProjection(
  restored: RestoredRuntime,
  opts: { readonly ablate: boolean }
): Promise<FutureCapture> {
  const productionResolver = new FactualMemoryEvidenceResolverV0({
    reader: createExperienceReaderV0({
      repository: restored.repo,
      deliveryLedger: restored.deliveryLedger
    }),
    episodeContentReader: createEpisodeContentReaderV0(restored.repo)
  } as never);
  const effectiveResolver = opts.ablate
    ? {
        resolve: async (input: unknown) =>
          ablateEvidenceBundle(await productionResolver.resolve(input) as never) as never
      }
    : productionResolver;
  const minter = createMiclStageMinter(restored.assembly.facade as never, new InMemoryMiclWorkflowStore(), {
    micl_id: "micl-dlfv0-future-cognition" as never,
    micl_request_fingerprint: "sha256:dlfv0-future-cognition" as never,
    stage_key: "OBSERVATION" as never
  });
  const captured: unknown[] = [];
  const executor = new CognitionActionTransitionExecutor({
    cognitionProvider: {
      propose: async (projection: unknown) => {
        captured.push(structuredClone(projection));
        return {
          schema_version: "cognition-proposal-v0",
          projection_hash: (projection as { projection_hash: string }).projection_hash,
          reasoning_summary: "dlfv0 future cognition capture",
          relevant_memory_refs: [],
          considered_context_refs: [],
          current_intent: null,
          confidence: 0.5,
          uncertainty: 0.5,
          action_intent: null,
          evidence_refs: []
        };
      }
    },
    subjectCore: minter.core() as never,
    retrieval: {
      retrieve: async () => {
        throw new Error("EXPERIMENT: future cognition must not call retrieval again");
      }
    },
    factualEvidenceResolver: effectiveResolver as never,
    producerAuthorizationIssuer: restored.issuer
  } as never);
  const snapshot = await readSnapshotV4(restored.assembly);
  const result = await executor.execute(
    ctxOf(snapshot),
    { cause_refs: [], allowed_actions: [] } as never,
    minter.capabilities(await currentBindings(restored.repo, snapshot) as never) as never
  );
  check(
    (result as { outcome: { kind: string } }).outcome.kind === "NO_OP" ||
      (result as { outcome: { kind: string } }).outcome.kind === "COMMITTED",
    `future cognition capture terminal outcome: ${(result as { outcome: { kind: string } }).outcome.kind}`
  );
  check(captured.length === 1, "future cognition provider input must be captured exactly once");
  const projection = captured[0] as Record<string, unknown>;
  // Audit: what production resolved for the same refs (never ablated).
  const candidateRefs = [...new Set<string>([
    ...((projection["memory_working_refs"] as readonly string[]) ?? []),
    ...((projection["recent_retrieval_refs"] as readonly string[]) ?? [])
  ])].filter((ref) => ref.startsWith("episode:")).sort();
  const productionBundle: unknown = await productionResolver.resolve({
    repository_revision: snapshot.memory_state.repository_revision,
    episode_refs: candidateRefs as never
  }).catch((error: unknown) => ({ resolve_failed: String(error).slice(0, 300) }));
  return {
    projection,
    production_evidence_bundle: productionBundle,
    ablated: opts.ablate,
    subject_state_hash: hashJson(snapshot)
  };
}

export interface FutureTrialResult {
  readonly future_arm: FutureArm;
  readonly life_arm: TreatmentArm;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
  readonly response_request_id: string;
  readonly working_episode_refs: readonly string[];
  readonly future_context_hash: string;
  readonly post_commit_revision: string;
  readonly capture: FutureCapture;
  readonly record: Record<string, unknown>;
  readonly behavior_text: string;
  readonly restored_affect: { readonly valence: number; readonly activation: number };
}

/** One future trial: FRESH authoritative restore → future observation with
 * production retrieval → evidence-resolved provider-facing projection
 * (ablated for MEM_ABL arms) → ONE real cognition call through the frozen
 * downstream stage → directive → real language call iff REALIZE. */
export async function runFutureTrial(
  world: World,
  lifeMeta: LifeMetadata,
  futureArm: FutureArm,
  trialOrdinal: number,
  executionOrder: number,
  withinUnitOrder: number
): Promise<FutureTrialResult> {
  const lifeArm: TreatmentArm = futureArm === "MEM_A" || futureArm === "MEM_ABL_A" ? "A" : "B";
  const ablate = futureArm.startsWith("MEM_ABL");
  const restored = await restoreWorld(world);
  // The future observation id is CONSTANT across trials and arms: every trial
  // is an independent replay of the SAME situation from a fresh restore, so
  // the provider-facing projection is byte-identical within an arm across
  // trials (deterministic temp-0 measurement).
  const future = await commitFutureContextObservation(
    restored,
    { current_factual_event: FUTURE_SCENARIO.current_factual_event, current_task: FUTURE_SCENARIO.current_task },
    FUTURE_SCENARIO.event_id
  );
  const capture = await captureFutureProjection(restored, { ablate });
  const item = {
    cell: {
      scenario: { scenario_id: FUTURE_SCENARIO.scenario_id, current_factual_event: FUTURE_SCENARIO.current_factual_event },
      provider_inputs: { [futureArm]: capture.projection },
      metadata: { [futureArm]: lifeMeta }
    },
    arm: futureArm,
    trial_ordinal: trialOrdinal,
    execution_order: executionOrder,
    within_unit_order: withinUnitOrder,
    trial_id: `${EXPERIMENT_VERSION}/${FUTURE_SCENARIO.scenario_id}/${trialOrdinal}/${futureArm}`,
    response_request_id: `response-dlfv0-t${trialOrdinal}-${futureArm}`
  };
  const record = await generateRealBehavior(item as never) as unknown as Record<string, unknown>;
  const behaviorText = (record["behavior"] as { text?: string } | undefined)?.text ?? "";
  const restoredSnapshot = (await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as SubjectStateV4;
  return {
    future_arm: futureArm,
    life_arm: lifeArm,
    trial_ordinal: trialOrdinal,
    execution_order: executionOrder,
    within_unit_order: withinUnitOrder,
    trial_id: item.trial_id,
    response_request_id: item.response_request_id,
    working_episode_refs: future.working_episode_refs,
    future_context_hash: future.future_context_hash,
    post_commit_revision: future.post_commit_revision,
    capture,
    record,
    behavior_text: behaviorText,
    restored_affect: {
      valence: restoredSnapshot.affect.valence,
      activation: restoredSnapshot.affect.activation
    }
  };
}

/** §26-style semantic diff helper reused for projection body comparisons. */
export function projectionBodyWithout(projection: Record<string, unknown>, omit: readonly string[]): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(projection)) {
    if (!omit.includes(key)) clone[key] = projection[key];
  }
  return clone;
}
