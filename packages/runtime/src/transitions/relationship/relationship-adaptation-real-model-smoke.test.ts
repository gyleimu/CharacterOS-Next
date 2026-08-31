/**
 * Relationship Adaptation — Real Model Smoke V0 (OPT-IN, never runs by default).
 *
 * Gate: CHARACTEROS_REAL_LLM_TEST=1 + CHARACTEROS_LLM_BASE_URL + CHARACTEROS_LLM_MODEL
 * (Ollama native root, e.g. http://127.0.0.1:11434; no API key needed).
 *
 * NON_SCIENTIFIC_TEST_FIXTURE: channels, scenes, and criteria are synthetic test
 * scaffolding only; no production psychology is encoded.
 *
 * The ONLY difference from the sealed offline E2E proof is the semantic
 * provider: the REAL production OllamaRelationshipSemanticChannelProviderV0
 * (native /api/chat, think=false explicitly, temperature 0, num_predict 512,
 * ONE request, no retry, no JSON repair) against the local Ollama endpoint.
 * Everything after the provider output is the exact frozen production chain:
 * semantic runner → workflow-internal MemoryInfluence → frozen Plasticity →
 * proposal → frozen RelationshipTransitionExecutor → SubjectCore.
 *
 * Legal outcomes: CHANNEL → COMPLETE_COMMITTED (mutation receipt asserted) or
 * ABSTAIN → COMPLETE_ABSTAIN (zero canonical delta asserted). Malformed /
 * rejected / transport-failed output surfaces as the exact frozen typed
 * failure code — never repaired, never retried.
 * REAL_MODEL_NUMERIC_PLASTICITY_AUTHORITY = NONE: the model never sees or
 * determines dimension, direction, value, step, or next_value.
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
import { s0 } from "../observation/observation-fixtures.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import {
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  type RelationshipEvidenceChannelPolicyV0
} from "./relationship-evidence-channel-policy.js";
import {
  RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
  type RelationshipSemanticChannelCatalogV0,
  type RelationshipSemanticChannelProviderV0
} from "./relationship-semantic-channel.js";
import { OllamaRelationshipSemanticChannelProviderV0 } from "./relationship-semantic-ollama-provider.js";
import {
  RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION,
  runRelationshipAdaptationWorkflowV0,
  type RelationshipAdaptationTerminalV0,
  type RelationshipAdaptationWorkflowDepsV0,
  type RelationshipAdaptationWorkflowRecordV0,
  type RelationshipAdaptationWorkflowStoreV0
} from "./relationship-adaptation-workflow.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice";
const DIMENSION_ID = "relationship_test_dimension_v0";
const CHANNEL_ID = "ch_test_consistent_assistance";
const WORKFLOW_ID = "wf_rel_real_smoke_ollama_cross_runtime_v0";
const BASE_LOGICAL_TIME = 10;
const INITIAL_DIMENSION_VALUE = 0.4;

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
    policy_id: identifier("real_smoke_policy"),
    channels: [
      { channel_id: identifier(CHANNEL_ID), target_dimension_id: identifier(DIMENSION_ID), direction: "INCREASE" }
    ]
  };
}

async function catalogFixture(): Promise<RelationshipSemanticChannelCatalogV0> {
  const policy = policyFixture();
  return {
    schema_version: RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: identifier("real_smoke_catalog"),
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: await deriveRelationshipEvidenceChannelPolicyFingerprint(policy),
    channels: [
      {
        channel_id: identifier(CHANNEL_ID),
        criterion:
          "The evidence consistently describes the target counterpart providing direct help or assistance to the subject."
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

/** Three short, clear, non-adversarial synthetic episodes matching the criterion. */
function smokeRecords(): EpisodicMemoryRecordV0[] {
  return [
    recordFixture("episode:smoke-a", "Alice directly helped the subject complete a blocked task.", 7),
    recordFixture("episode:smoke-b", "Alice later provided useful assistance with a different problem.", 8),
    recordFixture("episode:smoke-c", "Alice voluntarily helped resolve another task the subject could not finish alone.", 9)
  ];
}

function subjectStateFixture(repositoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    relationships: {
      schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: identifier(DIMENSION_ID), value: unit(INITIAL_DIMENSION_VALUE) }
          ]
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

/** Call-counting wrapper around the REAL production Ollama provider. */
class CountingOllamaProvider implements RelationshipSemanticChannelProviderV0 {
  calls = 0;

  constructor(private readonly inner: OllamaRelationshipSemanticChannelProviderV0) {}

  async propose(input: Parameters<RelationshipSemanticChannelProviderV0["propose"]>[0]): Promise<unknown> {
    this.calls += 1;
    return this.inner.propose(input);
  }
}

/** Deterministic in-memory workflow store (test-only, frozen atomic semantics preserved). */
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

describe.skipIf(process.env["CHARACTEROS_REAL_LLM_TEST"] !== "1")(
  "OPTIONAL relationship adaptation real-model smoke (requires CHARACTEROS_REAL_LLM_TEST=1 + endpoint env)",
  () => {
    it("real local Qwen decision travels the full frozen workflow to its lawful terminal", { timeout: 120_000 }, async () => {
      const baseUrl = process.env["CHARACTEROS_LLM_BASE_URL"];
      const model = process.env["CHARACTEROS_LLM_MODEL"];
      if (baseUrl === undefined || model === undefined) {
        throw new Error("real-model smoke requires CHARACTEROS_LLM_BASE_URL and CHARACTEROS_LLM_MODEL");
      }

      // ---- isolated in-memory canonical world (no persistent subject state) ----
      const repository = new InMemoryMemoryRepository();
      await repository.prepareRevision({ parent_revision: null, records: [] });
      const records = smokeRecords();
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
      const provider = new CountingOllamaProvider(
        new OllamaRelationshipSemanticChannelProviderV0({ base_url: baseUrl, model })
      );
      const store = new InMemoryRelationshipAdaptationWorkflowStoreV0();
      const deps: RelationshipAdaptationWorkflowDepsV0 = {
        subjectCore: port,
        memoryRepository: repository,
        producerAuthorizationIssuer: facade.producerAuthorizationIssuer,
        semanticProvider: provider,
        workflowStore: store,
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

      // ---- BEFORE receipt -------------------------------------------------------
      const before = await port.readCurrentSnapshot(identifier(SUBJECT_ID));
      if (before === null) throw new Error("canonical before snapshot missing");
      const beforeRevision = before.runtime_metadata.state_revision;
      const beforeTraceCount = before.trace_window.entries.length;

      // ---- ONE workflow, ONE real model call ------------------------------------
      const result = await runRelationshipAdaptationWorkflowV0(deps, request);
      expect(provider.calls).toBe(1);

      const after = await port.readCurrentSnapshot(identifier(SUBJECT_ID));
      if (after === null) throw new Error("canonical after snapshot missing");
      const afterValue = after.relationships.counterparts
        .find((entry) => entry.counterpart_ref === ALICE)
        ?.dimensions.find((entry) => entry.dimension_id === DIMENSION_ID)?.value;

      if (result.kind === "COMPLETE_COMMITTED") {
        // CHANNEL path: full canonical mutation receipt.
        expect(after.runtime_metadata.state_revision).toBe(beforeRevision + 1);
        expect(after.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
        expect(afterValue).not.toBe(INITIAL_DIMENSION_VALUE);
        expect(afterValue).toBeGreaterThan(INITIAL_DIMENSION_VALUE);
        expect((afterValue as number) - INITIAL_DIMENSION_VALUE).toBeLessThanOrEqual(0.05);
        expect(after.trace_window.entries).toHaveLength(beforeTraceCount + 1);
        expect(after.trace_window.entries[after.trace_window.entries.length - 1]?.transition_type).toBe(
          "Relationship"
        );
        expect(after.trace_window.entries[after.trace_window.entries.length - 1]?.transition_id).toBe(
          result.transition_id
        );
      } else if (result.kind === "COMPLETE_ABSTAIN") {
        // Legal abstain path: zero canonical delta.
        expect(after.runtime_metadata.state_revision).toBe(beforeRevision);
        expect(afterValue).toBe(INITIAL_DIMENSION_VALUE);
        expect(after.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
        expect(after.trace_window.entries).toHaveLength(beforeTraceCount);
      } else {
        // Malformed / rejected / transport failure: the exact frozen typed code is
        // the real finding — surfaced truthfully, never repaired or retried.
        throw new Error(`REAL_MODEL_SMOKE_FROZEN_FAILURE ${result.kind}: ${JSON.stringify(result)}`);
      }

      // ---- no-recall replay of the same workflow (never contacts the model) ----
      const replay = await runRelationshipAdaptationWorkflowV0(deps, request);
      expect(replay).toEqual(result);
      expect(provider.calls).toBe(1);
      const afterReplay = await port.readCurrentSnapshot(identifier(SUBJECT_ID));
      if (afterReplay === null) throw new Error("canonical replay snapshot missing");
      expect(afterReplay.runtime_metadata.state_revision).toBe(after.runtime_metadata.state_revision);
      expect(afterReplay.trace_window.entries).toHaveLength(after.trace_window.entries.length);
    });
  }
);
