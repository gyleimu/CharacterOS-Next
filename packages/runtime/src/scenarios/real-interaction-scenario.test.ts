/**
 * Real Interaction Scenario V0 鈥?deterministic causal wiring proof.
 *
 * Concept: relationship-history-influences-future-action.
 *
 * THREE SEPARATE CLAIMS (never conflated):
 *
 * CLAIM A 鈥?LIFE HISTORY PERSISTENCE: past assistance episodes cause a
 * persistent canonical Relationship change through the REAL frozen
 * RelationshipAdaptationWorkflowV0 鈫?Plasticity 鈫?RelationshipTransitionExecutor
 * 鈫?SubjectCore chain (deterministic test-only semantic provider; zero real
 * model calls; no canonical state backdoor).
 *
 * CLAIM B 鈥?ROUTING: the changed canonical Relationship dimension value is
 * structurally visible in a later CognitiveContextProjectionV0 via the new
 * read-only `relationship_dimensions` projection edge, including a
 * relationship-isolated structural pair whose cognition-visible state differs
 * ONLY in the Relationship value.
 *
 * CLAIM C 鈥?BEHAVIORAL WIRING: a TEST-ONLY deterministic CognitionProviderV0
 * probe that READS that projection produces DIFFERENT existing lawful
 * ActionIntentV0s for the two worlds, and both flow through the existing
 * ActionExecutionRunner into real ActionOutcomeV0s.
 *
 * NOT claimed here: REAL_LLM_BEHAVIORAL_DIVERGENCE (separate later task).
 * ALL_MODEL numeric authority is NONE: the probe/LLM can read canonical
 * Relationship values but can never mutate them.
 */

import { describe, expect, it } from "vitest";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import {
  createInMemorySubjectCoreFacade,
  RELATIONSHIP_STATE_SCHEMA_VERSION,
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";
import { ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY } from "@characteros-next/memory-influence";
import { s0 } from "../transitions/observation/observation-fixtures.js";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import {
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  type RelationshipEvidenceChannelPolicyV0
} from "../transitions/relationship/relationship-evidence-channel-policy.js";
import {
  RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
  RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type RelationshipSemanticChannelCatalogV0,
  type RelationshipSemanticChannelProviderV0
} from "../transitions/relationship/relationship-semantic-channel.js";
import {
  RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION,
  runRelationshipAdaptationWorkflowV0,
  type RelationshipAdaptationTerminalV0,
  type RelationshipAdaptationWorkflowDepsV0,
  type RelationshipAdaptationWorkflowRecordV0,
  type RelationshipAdaptationWorkflowStoreV0
} from "../transitions/relationship/relationship-adaptation-workflow.js";
import { buildCognitiveContextProjection } from "../transitions/cognition-action/cognition-action-transition-executor.js";
import type { CognitiveContextProjectionV0 } from "../transitions/cognition-action/types.js";
import {
  actionIntentAllowed,
  validateCognitionProposal,
  type AllowedActionV0,
  type CognitionProposalV0
} from "../transitions/cognition-action/types.js";
import type { CognitionProviderV0 } from "../ports/cognition-port.js";
import { ActionExecutionRunner } from "../actions/action-runner.js";
import { InMemoryActionExecutionLedger } from "../actions/action-executor-port.js";
import { DeterministicSandboxWorldV0 } from "../actions/sandbox-world.js";
import { renderCognitiveSubjectData } from "../providers/cognition/cognitive-prompt-projection.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice";
const DIMENSION_ID = "relationship_test_dimension_v0";
const CHANNEL_ID = "ch_test_consistent_assistance";
const WORKFLOW_ID = "wf_scenario_life_history_v0";
const BASE_LOGICAL_TIME = 10;
const INITIAL_DIMENSION_VALUE = 0.4;

/** Deterministic in-memory adaptation workflow store (test-only, atomic semantics preserved). */
class InMemoryRelationshipAdaptationWorkflowStoreV0 implements RelationshipAdaptationWorkflowStoreV0 {
  private readonly records = new Map<string, RelationshipAdaptationWorkflowRecordV0>();

  private mutableObject(workflow_id: string): RelationshipAdaptationWorkflowRecordV0 {
    const record = this.records.get(workflow_id);
    if (record === undefined) throw new Error("store misuse: record missing");
    return record;
  }

  async load(workflow_id: string): Promise<RelationshipAdaptationWorkflowRecordV0 | null> {
    return this.records.get(workflow_id) ?? null;
  }

  async createIfAbsent(record: RelationshipAdaptationWorkflowRecordV0): Promise<"CREATED" | "EXISTING"> {
    if (this.records.has(record.workflow_id)) return "EXISTING";
    this.records.set(record.workflow_id, record);
    return "CREATED";
  }

  async claimProviderCall(workflow_id: string, request_fingerprint: string): Promise<"CLAIMED" | "ALREADY_CLAIMED"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.external_provider_call_count === 1) return "ALREADY_CLAIMED";
    this.records.set(workflow_id, {
      ...record,
      external_provider_call_count: 1,
      stage: "A2_SEMANTIC_PROVIDER_CALL"
    });
    return "CLAIMED";
  }

  async saveProviderCandidate(
    workflow_id: string,
    request_fingerprint: string,
    candidate: RelationshipAdaptationWorkflowRecordV0["provider_output_candidate"],
    candidate_fingerprint: string
  ): Promise<"SAVED" | "CANDIDATE_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.provider_output_candidate !== null) {
      return JSON.stringify(record.provider_output_candidate) === JSON.stringify(candidate)
        ? "SAVED"
        : "CANDIDATE_CONFLICT";
    }
    this.records.set(workflow_id, {
      ...record,
      provider_output_candidate: candidate,
      provider_output_candidate_fingerprint: candidate_fingerprint as never,
      stage: "A3_SEMANTIC_ACCEPTED"
    });
    return "SAVED";
  }

  async appendProposalAttempt(
    workflow_id: string,
    request_fingerprint: string,
    checkpoint: RelationshipAdaptationWorkflowRecordV0["proposal_attempts"][number]
  ): Promise<"APPENDED" | "ORDINAL_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    const existing = record.proposal_attempts.find(
      (attempt) => attempt.rebuild_ordinal === checkpoint.rebuild_ordinal
    );
    if (existing !== undefined) {
      return JSON.stringify(existing) === JSON.stringify(checkpoint) ? "APPENDED" : "ORDINAL_CONFLICT";
    }
    this.records.set(workflow_id, {
      ...record,
      proposal_attempts: [...record.proposal_attempts, checkpoint],
      plasticity_rebuild_ordinal:
        checkpoint.rebuild_ordinal === 1 ? 1 : record.plasticity_rebuild_ordinal,
      stage: "A6_PROPOSAL_READY"
    });
    return "APPENDED";
  }

  async compareAndSetStage(
    workflow_id: string,
    request_fingerprint: string,
    from: RelationshipAdaptationWorkflowRecordV0["stage"],
    to: RelationshipAdaptationWorkflowRecordV0["stage"]
  ): Promise<"SET" | "STAGE_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.stage !== from) return "STAGE_CONFLICT";
    this.records.set(workflow_id, { ...record, stage: to });
    return "SET";
  }

  async setRebuildOrdinal(workflow_id: string, request_fingerprint: string): Promise<"SET" | "ORDINAL_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.plasticity_rebuild_ordinal === 1) return "ORDINAL_CONFLICT";
    this.records.set(workflow_id, { ...record, plasticity_rebuild_ordinal: 1 });
    return "SET";
  }

  async saveTerminalResult(
    workflow_id: string,
    request_fingerprint: string,
    terminal: RelationshipAdaptationTerminalV0
  ): Promise<"SAVED" | "TERMINAL_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.terminal_result !== null) {
      return JSON.stringify(record.terminal_result) === JSON.stringify(terminal)
        ? "SAVED"
        : "TERMINAL_CONFLICT";
    }
    this.records.set(workflow_id, { ...record, terminal_result: terminal, stage: "A8_COMPLETE" });
    return "SAVED";
  }
}

/** Deterministic offline semantic provider (NON_SCIENTIFIC_TEST_FIXTURE; CHANNEL only). */
class DeterministicChannelProvider implements RelationshipSemanticChannelProviderV0 {
  calls = 0;

  async propose(input: { semantic_context_fingerprint: unknown; catalog_fingerprint: unknown }): Promise<unknown> {
    this.calls += 1;
    return {
      schema_version: RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      kind: "CHANNEL",
      channel_id: identifier(CHANNEL_ID),
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
  }
}

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

/** TEST-ONLY hidden host policy: CHANNEL -> test dimension -> INCREASE. */
function policyFixture(): RelationshipEvidenceChannelPolicyV0 {
  return {
    schema_version: RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
    policy_id: identifier("scenario_policy"),
    channels: [
      { channel_id: identifier(CHANNEL_ID), target_dimension_id: identifier(DIMENSION_ID), direction: "INCREASE" }
    ]
  };
}

async function catalogFixture(): Promise<RelationshipSemanticChannelCatalogV0> {
  const policy = policyFixture();
  return {
    schema_version: RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: identifier("scenario_catalog"),
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: await deriveRelationshipEvidenceChannelPolicyFingerprint(policy),
    channels: [
      {
        channel_id: identifier(CHANNEL_ID),
        criterion: "Evidence matches the synthetic adaptation test condition."
      }
    ]
  };
}

function recordFixture(episodeRef: string, scene: string, occurrenceLogicalTime: number): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: episodeRef as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time: occurrenceLogicalTime as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time: (occurrenceLogicalTime + 1) as EpisodicMemoryRecordV0["recorded_at_logical_time"],
    provenance: {
      transition_id: identifier(`learning_${episodeRef.replace(/[^a-z0-9]/gi, "_")}`) as never,
      producer: "memory",
      cause_refs: []
    },
    references: [ALICE] as unknown as EpisodicMemoryRecordV0["references"],
    context: { scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

function assistanceEpisodes(): EpisodicMemoryRecordV0[] {
  return [
    recordFixture("episode:scenario-a", "Alice helped during task A.", 7),
    recordFixture("episode:scenario-b", "Alice helped during task B.", 8),
    recordFixture("episode:scenario-c", "Alice helped during task C.", 9)
  ];
}

/** Canonical baseline fixture: alice registered with the test dimension at 0.4. */
function subjectStateFixture(repositoryRevision: string, dimensionValue = INITIAL_DIMENSION_VALUE): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    relationships: {
      schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [{ dimension_id: identifier(DIMENSION_ID), value: unit(dimensionValue) }]
        }
      ]
    },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: BASE_LOGICAL_TIME,
      state_revision: 0
    }
  };
  return state as unknown as SubjectStateV0;
}

interface ExperiencedWorld {
  port: SubjectCorePort;
  adaptedSnapshot: SubjectStateV0;
}

/** PHASE A: run the REAL frozen adaptation workflow end-to-end (no backdoor). */
async function buildExperiencedWorld(): Promise<ExperiencedWorld> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] });
  const records = assistanceEpisodes();
  const hashes = [];
  for (const record of records) {
    hashes.push({
      ref: record.episode_ref,
      payload_hash: await repository.storePayload(record.episode_ref, record)
    });
  }
  await repository.prepareRevision({ parent_revision: "R0" as never, records: hashes as never });
  const state = subjectStateFixture("R1");
  const facade = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, state]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async () => true,
    memoryAdoptionValidator: async () => false
  });
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => facade.facade.reserveAndRoute(proposal),
    commitReserved: (input) => facade.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => facade.facade.terminalizeReservedNoOp(input),
    reconcile: (transitionId, subjectId, fingerprint) =>
      facade.facade.reconcile(transitionId, subjectId, fingerprint),
    readCurrentSnapshot: async (subjectId) => {
      const bundle = facade.storeRead.readCurrentBundle(subjectId);
      return bundle === null ? state : bundle.next_snapshot;
    }
  };
  const deps: RelationshipAdaptationWorkflowDepsV0 = {
    subjectCore: port,
    memoryRepository: repository,
    producerAuthorizationIssuer: facade.producerAuthorizationIssuer,
    semanticProvider: new DeterministicChannelProvider(),
    workflowStore: new InMemoryRelationshipAdaptationWorkflowStoreV0(),
    readCommittedBundle: async () => null
  };
  const request = {
    schema_version: RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: identifier(WORKFLOW_ID),
    subject_id: identifier(SUBJECT_ID),
    expected_initial_state_revision: state.runtime_metadata.state_revision,
    expected_initial_logical_time: state.runtime_metadata.logical_time,
    expected_repository_revision: state.memory_state.repository_revision,
    counterpart_ref: ALICE,
    cause_refs: [],
    selected_records: records,
    semantic_catalog: await catalogFixture(),
    channel_policy: policyFixture(),
    memory_influence_policy: ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY
  };
  const result = await runRelationshipAdaptationWorkflowV0(deps, request);
  expect(result.kind).toBe("COMPLETE_COMMITTED");
  if (result.kind !== "COMPLETE_COMMITTED") throw new Error(`adaptation failed: ${result.kind}`);
  const adaptedSnapshot = await port.readCurrentSnapshot(identifier(SUBJECT_ID));
  if (adaptedSnapshot === null) throw new Error("adapted canonical snapshot missing");
  return { port, adaptedSnapshot };
}

function aliceDimension(projection: CognitiveContextProjectionV0): number {
  const entry = projection.relationship_dimensions.find(
    (r: { counterpart_ref: string; dimension_id: string; value: number }) =>
      r.counterpart_ref === ALICE && r.dimension_id === DIMENSION_ID
  );
  if (entry === undefined) throw new Error("alice relationship dimension missing from projection");
  return entry.value;
}

/** The shared future event: identical observation + identical action space. */
const FUTURE_ALLOWED_ACTIONS: readonly AllowedActionV0[] = [
  { action_type: "REQUEST_EVIDENCE", target_ref: identifier(ALICE) },
  { action_type: "WAIT", target_ref: null }
];

/**
 * TEST-ONLY deterministic cognition probe (NOT production policy): reads the
 * relationship projection and chooses a lawful intent from the supplied
 * action space. It can never mutate anything.
 */
class RelationshipAwareProbeProvider implements CognitionProviderV0 {
  async propose(projection: CognitiveContextProjectionV0): Promise<CognitionProposalV0> {
    const alice = projection.relationship_dimensions.find(
      (r: { counterpart_ref: string; dimension_id: string; value: number }) =>
        r.counterpart_ref === ALICE && r.dimension_id === DIMENSION_ID
    );
    const intent =
      alice !== undefined && alice.value >= 0.45
        ? { action_type: "REQUEST_EVIDENCE", target_ref: identifier(ALICE) }
        : { action_type: "WAIT", target_ref: null };
    return {
      schema_version: "cognition-proposal-v0",
      projection_hash: projection.projection_hash,
      reasoning_summary: "deterministic relationship-aware probe",
      relevant_memory_refs: [],
      considered_context_refs: [],
      current_intent: null,
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: intent,
      evidence_refs: []
    };
  }
}

describe("Real Interaction Scenario V0 鈥?relationship-history-influences-future-action", () => {
  it("past experience persists through the real adaptation chain and routes into future cognition and action", async () => {
    // ---- PHASE A: full life history through the REAL frozen chain ----------------
    const world = await buildExperiencedWorld();
    const adapted = world.adaptedSnapshot;
    const adaptedValue = adapted.relationships.counterparts
      .find((entry) => entry.counterpart_ref === ALICE)
      ?.dimensions.find((entry) => entry.dimension_id === DIMENSION_ID)?.value;
    // PAST_EXPERIENCE_PERSISTED + PERSISTENT_RELATIONSHIP_CHANGED
    expect(adaptedValue).toBe(0.45);
    expect(adapted.runtime_metadata.state_revision).toBe(1);
    expect(adapted.trace_window.entries).toHaveLength(1);
    expect(adapted.trace_window.entries[0]?.transition_type).toBe("Relationship");

    // ---- PHASE B: future cognition projection (same future event, two worlds) ----
    const controlSnapshot = subjectStateFixture("R1");
    const experiencedProjection = await buildCognitiveContextProjection(adapted);
    const controlProjection = await buildCognitiveContextProjection(controlSnapshot);

    // EXPERIENCED exposes the adapted canonical value; CONTROL the baseline.
    expect(aliceDimension(experiencedProjection)).toBe(0.45);
    expect(aliceDimension(controlProjection)).toBe(0.4);
    // RELATIONSHIP_TO_COGNITION_ROUTING: VERIFIED (structural field inspection,
    // NOT inferred from hashes alone).

    // Every other cognition-visible field the two futures share is IDENTICAL
    // (memory refs, traits, affect, mood, regulation, context, belief count).
    expect(experiencedProjection.traits_dimensions).toEqual(controlProjection.traits_dimensions);
    expect(experiencedProjection.affect_channels).toEqual(controlProjection.affect_channels);
    expect(experiencedProjection.mood_baseline).toBe(controlProjection.mood_baseline);
    expect(experiencedProjection.regulation).toEqual(controlProjection.regulation);
    expect(experiencedProjection.context).toEqual(controlProjection.context);
    expect(experiencedProjection.memory_working_refs).toEqual(controlProjection.memory_working_refs);
    expect(experiencedProjection.recent_retrieval_refs).toEqual(controlProjection.recent_retrieval_refs);
    expect(experiencedProjection.belief_item_count).toBe(controlProjection.belief_item_count);
    expect(experiencedProjection.relationship_counterpart_count).toBe(
      controlProjection.relationship_counterpart_count
    );
    // Known unrelated difference, reported separately: state_revision (1 vs 0).
    expect(experiencedProjection.state_revision).toBe(1);
    expect(controlProjection.state_revision).toBe(0);

    // PROMPT projection renders relationship STATE DATA (no hidden policy).
    const experiencedPrompt = renderCognitiveSubjectData(experiencedProjection);
    expect(experiencedPrompt).toContain(`- ${ALICE}: ${DIMENSION_ID}=0.45`);
    expect(experiencedPrompt).not.toContain("INCREASE");
    expect(experiencedPrompt).not.toContain("DECREASE");
    expect(experiencedPrompt).not.toContain("next_value");
    expect(experiencedPrompt).not.toContain("max_step");
  });

  it("relationship routing causal isolation: cognition-visible state differs ONLY in the relationship value", async () => {
    // Lawful fixture pair: identical in every cognition-asserted field except
    // the Relationship dimension value. Structural isolation of the new edge.
    const projectionA = await buildCognitiveContextProjection(subjectStateFixture("R1", 0.4));
    const projectionB = await buildCognitiveContextProjection(subjectStateFixture("R1", 0.45));

    expect(aliceDimension(projectionA)).toBe(0.4);
    expect(aliceDimension(projectionB)).toBe(0.45);
    expect(projectionA.relationship_dimensions).toHaveLength(1);
    expect(projectionB.relationship_dimensions).toHaveLength(1);

    // All other asserted cognition fields equal.
    expect(projectionA.state_revision).toBe(projectionB.state_revision);
    expect(projectionA.current_logical_time).toBe(projectionB.current_logical_time);
    expect(projectionA.traits_dimensions).toEqual(projectionB.traits_dimensions);
    expect(projectionA.affect_channels).toEqual(projectionB.affect_channels);
    expect(projectionA.mood_baseline).toBe(projectionB.mood_baseline);
    expect(projectionA.regulation).toEqual(projectionB.regulation);
    expect(projectionA.context).toEqual(projectionB.context);
    expect(projectionA.memory_working_refs).toEqual(projectionB.memory_working_refs);
    expect(projectionA.recent_retrieval_refs).toEqual(projectionB.recent_retrieval_refs);
    expect(projectionA.belief_item_count).toBe(projectionB.belief_item_count);
    expect(projectionA.relationship_counterpart_count).toBe(projectionB.relationship_counterpart_count);

    // Deterministic ordering authority: the hash differs exactly because of the
    // relationship value; the projection itself stays deterministically ordered.
    expect(projectionA.projection_hash).not.toBe(projectionB.projection_hash);
    // RELATIONSHIP_ROUTING_CAUSAL_ISOLATION: PASS.
  });

  it("deterministic cognition probe routes the relationship difference into different lawful actions", async () => {
    const projectionControl = await buildCognitiveContextProjection(subjectStateFixture("R1", 0.4));
    const projectionExperienced = await buildCognitiveContextProjection(
      subjectStateFixture("R1", 0.45)
    );
    const probe = new RelationshipAwareProbeProvider();

    // proposals pass the EXISTING frozen cognition validation gates.
    const proposalControl = await probe.propose(projectionControl);
    const proposalExperienced = await probe.propose(projectionExperienced);
    expect(validateCognitionProposal(proposalControl).ok).toBe(true);
    expect(validateCognitionProposal(proposalExperienced).ok).toBe(true);
    expect(proposalControl.projection_hash).toBe(projectionControl.projection_hash);
    expect(proposalExperienced.projection_hash).toBe(projectionExperienced.projection_hash);

    // action-space compatibility through the existing authority.
    expect(proposalControl.action_intent).not.toBeNull();
    expect(proposalExperienced.action_intent).not.toBeNull();
    expect(
      actionIntentAllowed(proposalControl.action_intent as AllowedActionV0, FUTURE_ALLOWED_ACTIONS)
    ).toBe(true);
    expect(
      actionIntentAllowed(proposalExperienced.action_intent as AllowedActionV0, FUTURE_ALLOWED_ACTIONS)
    ).toBe(true);

    // CONTROL (0.4) 鈫?baseline posture; EXPERIENCED (0.45) 鈫?Alice-oriented.
    expect(proposalControl.action_intent).toEqual({ action_type: "WAIT", target_ref: null });
    expect(proposalExperienced.action_intent).toEqual({
      action_type: "REQUEST_EVIDENCE",
      target_ref: identifier(ALICE)
    });
    // FUTURE_ACTION_INTENT_DIFFERS: VERIFIED (deterministic consumer).
    expect(proposalControl.action_intent).not.toEqual(proposalExperienced.action_intent);

    // ---- REAL action path: existing ActionExecutionRunner 鈫?ActionOutcomeV0 ----
    const sandboxControl = new DeterministicSandboxWorldV0();
    const ledgerControl = new InMemoryActionExecutionLedger();
    const outcomeControl = await new ActionExecutionRunner(sandboxControl.executor(), ledgerControl).run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: "t-cog-scenario-control",
      proposal: proposalControl as never,
      logicalTime: 0 as never
    });
    const sandboxExperienced = new DeterministicSandboxWorldV0();
    const ledgerExperienced = new InMemoryActionExecutionLedger();
    const outcomeExperienced = await new ActionExecutionRunner(sandboxExperienced.executor(), ledgerExperienced).run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: "t-cog-scenario-experienced",
      proposal: proposalExperienced as never,
      logicalTime: 0 as never
    });

    expect(outcomeControl.kind).toBe("EXECUTED");
    expect(outcomeExperienced.kind).toBe("EXECUTED");
    if (outcomeControl.kind !== "EXECUTED" || outcomeExperienced.kind !== "EXECUTED") return;
    // CURRENT_BEHAVIOR_OBSERVABLE: ACTION_INTENT_AND_ACTION_OUTCOME.
    expect(outcomeControl.outcome.action_type).toBe("WAIT");
    expect(outcomeExperienced.outcome.action_type).toBe("REQUEST_EVIDENCE");
    expect(outcomeExperienced.outcome.status).toBe("EXECUTED");
    expect(outcomeControl.outcome.status).toBe("EXECUTED");
    expect(outcomeExperienced.outcome.effect_refs.length).toBeGreaterThan(0);
    expect(outcomeControl.outcome.effect_refs).not.toEqual(outcomeExperienced.outcome.effect_refs);
    // ACTION_EXECUTION_PATH: VERIFIED.
  });

  it("empty relationship state projects as an explicit empty list (deterministic)", async () => {
    const base = s0() as unknown as SubjectStateV0;
    const empty = base; // s0 has zero counterparts by construction.
    const projection = await buildCognitiveContextProjection(empty);
    expect(projection.relationship_dimensions).toEqual([]);
    expect(projection.relationship_counterpart_count).toBe(0);
  });
});
