/**
 * Belief Decision Influence Relation Foundation V0 — create-once provider
 * outcome workflow acceptance suite (§80-§84, §63, §76, §39): first run makes
 * exactly ONE provider call, replay performs ZERO provider calls and reproduces
 * the byte-stable projection, REUSE_CONFLICT / PROVIDER_OUTCOME_UNKNOWN fail
 * closed, concurrent invocations share ONE claim, request fingerprints never
 * bind workflow_id, and checkpoints detect tampering.
 *
 * Fully OFFLINE: deterministic fake provider + test-private in-memory store —
 * no model, no transport, no persistence dependency.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../observation/observation-fixtures.js";
import { buildCognitiveContextProjection } from "./cognition-action-transition-executor.js";
import type { AllowedActionV0, CognitiveContextProjectionV0 } from "./types.js";
import type {
  CognitionRelationProviderInputV1,
  CognitionRelationProviderV1
} from "../../ports/cognition-relation-port.js";
import {
  CognitionRelationRejectionErrorV1,
  deriveCognitionActionSpaceFingerprintV1,
  validateAllowedActionSpaceV1
} from "./cognition-proposal-v1.js";
import {
  BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION,
  BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_SCHEMA_VERSION,
  BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_RECORD_SCHEMA_VERSION,
  deriveBeliefDecisionInfluenceRelationRequestFingerprintV0,
  deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0,
  runBeliefDecisionInfluenceRelationWorkflowV0,
  type BeliefDecisionInfluenceRelationProviderOutcomeV0,
  type BeliefDecisionInfluenceRelationRequestV0,
  type BeliefDecisionInfluenceRelationWorkflowRecordV0,
  type BeliefDecisionInfluenceRelationWorkflowStoreV0
} from "./belief-decision-influence-relation-workflow.js";

// ---- deterministic fixtures ----------------------------------------------------

const BELIEFS = [
  { proposition_id: "prop.bob-trustworthy", proposition_label: "Bob is trustworthy", credence: 0.9 },
  { proposition_id: "prop.alex-trustworthy", proposition_label: "Alex is trustworthy", credence: 0.5 }
];

const HOST_ACTIONS = [{ action_type: "TRY_EAST_ENTRANCE", target_ref: null }];

async function buildProjection(): Promise<CognitiveContextProjectionV0> {
  const base = s0() as unknown as SubjectStateV0;
  const snapshot = {
    ...base,
    beliefs: { schema_version: "belief-state-v0", items: BELIEFS },
    memory_state: {
      ...(base.memory_state as unknown as Record<string, unknown>),
      working_refs: ["episode:e1", "episode:e2"]
    }
  } as unknown as SubjectStateV0;
  return buildCognitiveContextProjection(snapshot);
}

/** Deterministic fake provider: payload is a pure function of the host input. */
class FakeWorkflowProvider implements CognitionRelationProviderV1 {
  calls = 0;
  constructor(private readonly payloadFactory: (input: CognitionRelationProviderInputV1) => unknown) {}
  async propose(input: CognitionRelationProviderInputV1): Promise<unknown> {
    this.calls += 1;
    return this.payloadFactory(input);
  }
}

function validPayload(input: CognitionRelationProviderInputV1): Record<string, unknown> {
  return {
    schema_version: "cognition-proposal-v1",
    projection_hash: input.projection.projection_hash,
    action_space_fingerprint: input.action_space_fingerprint,
    reasoning_summary: "workflow fixture",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: null,
    confidence: 0.6,
    uncertainty: 0.4,
    state_action_relations: [
      {
        state_locator: { domain: "BELIEF", proposition_id: "prop.bob-trustworthy" },
        action: { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
        relation: "SUPPORTS"
      }
    ],
    evidence_refs: []
  };
}

function makeRequest(
  projection: CognitiveContextProjectionV0,
  workflowId: string,
  actions: readonly { action_type: string; target_ref: string | null }[] = HOST_ACTIONS
): BeliefDecisionInfluenceRelationRequestV0 {
  return {
    workflow_id: workflowId as never,
    subject_id: projection.subject_id,
    state_revision: projection.state_revision,
    current_logical_time: projection.current_logical_time,
    projection,
    allowed_actions: actions as unknown as readonly AllowedActionV0[]
  };
}

/**
 * TEST-PRIVATE in-memory linearizable store implementing the frozen port.
 * Claim/outcome writes recompute the exact checkpoint fingerprint; load returns
 * deep copies so tests can tamper with the durable copy independently.
 */
class InMemoryRelationWorkflowStore implements BeliefDecisionInfluenceRelationWorkflowStoreV0 {
  private readonly records = new Map<string, BeliefDecisionInfluenceRelationWorkflowRecordV0>();

  async load(workflowId: string): Promise<BeliefDecisionInfluenceRelationWorkflowRecordV0 | null> {
    const record = this.records.get(workflowId);
    return record === undefined ? null : (JSON.parse(JSON.stringify(record)) as BeliefDecisionInfluenceRelationWorkflowRecordV0);
  }

  async createIfAbsent(record: BeliefDecisionInfluenceRelationWorkflowRecordV0): Promise<"CREATED" | "EXISTING"> {
    if (this.records.has(record.workflow_id)) return "EXISTING";
    this.records.set(record.workflow_id, JSON.parse(JSON.stringify(record)));
    return "CREATED";
  }

  async claimProviderCall(workflowId: string, requestFingerprint: string): Promise<
    "CLAIMED" | "ALREADY_CLAIMED" | "NOT_FOUND" | "FINGERPRINT_CONFLICT"
  > {
    const record = this.records.get(workflowId);
    if (record === undefined) return "NOT_FOUND";
    if (record.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (record.external_provider_call_count !== 0) return "ALREADY_CLAIMED";
    const base = {
      ...record,
      stage: "R2_PROVIDER_CLAIMED" as const,
      external_provider_call_count: 1 as const
    };
    const checkpointFingerprint = await deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(base);
    // Linearization point: synchronous re-check + write after the async hash,
    // so two concurrent claimers can never both observe count 0.
    const current = this.records.get(workflowId);
    if (current === undefined) return "NOT_FOUND";
    if (current.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (current.external_provider_call_count !== 0) return "ALREADY_CLAIMED";
    this.records.set(workflowId, { ...base, checkpoint_fingerprint: checkpointFingerprint });
    return "CLAIMED";
  }

  async saveProviderOutcome(
    workflowId: string,
    requestFingerprint: string,
    outcome: BeliefDecisionInfluenceRelationProviderOutcomeV0
  ): Promise<"SAVED" | "NOT_FOUND" | "FINGERPRINT_CONFLICT" | "OUTCOME_CONFLICT"> {
    const record = this.records.get(workflowId);
    if (record === undefined) return "NOT_FOUND";
    if (record.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (record.provider_outcome !== null) return "OUTCOME_CONFLICT";
    const base = {
      ...record,
      stage: "R3_PROVIDER_OUTCOME_CHECKPOINTED" as const,
      provider_outcome: outcome
    };
    const checkpointFingerprint = await deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(base);
    // Linearization point: synchronous re-check + write after the async hash.
    const current = this.records.get(workflowId);
    if (current === undefined) return "NOT_FOUND";
    if (current.request_fingerprint !== requestFingerprint) return "FINGERPRINT_CONFLICT";
    if (current.provider_outcome !== null) return "OUTCOME_CONFLICT";
    this.records.set(workflowId, { ...base, checkpoint_fingerprint: checkpointFingerprint });
    return "SAVED";
  }

  get size(): number {
    return this.records.size;
  }

  /** Test hook: mutate the durable record WITHOUT refreshing its checkpoint. */
  tamper(workflowId: string, mutate: (record: Record<string, unknown>) => void): void {
    const record = this.records.get(workflowId);
    if (record === undefined) throw new Error(`no record for ${workflowId}`);
    // Apply the mutation to the live record while keeping its old fingerprint.
    const live = { ...record } as unknown as Record<string, unknown>;
    mutate(live);
    this.records.set(workflowId, live as unknown as BeliefDecisionInfluenceRelationWorkflowRecordV0);
  }
}

// ---- frozen constants ------------------------------------------------------------

describe("Relation Foundation V0 — workflow frozen constants", () => {
  it("pins the exact schema versions and fingerprint namespaces", () => {
    expect(BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_SCHEMA_VERSION).toBe(
      "belief-decision-influence-relation-request-v0"
    );
    expect(BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_RECORD_SCHEMA_VERSION).toBe(
      "belief-decision-influence-relation-workflow-record-v0"
    );
    expect(BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION).toBe(
      "belief-decision-influence-relation-provider-outcome-v0"
    );
    expect(BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/belief-decision-influence-relation-request/v1"
    );
    expect(BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION).toBe(
      "characteros-next/runtime/belief-decision-influence-relation-workflow-checkpoint/v1"
    );
  });
});

// ---- first run / replay (§80) -----------------------------------------------------

describe("Relation Foundation V0 — workflow first run + zero-call replay", () => {
  it("§80 first run claims exactly ONE provider call; replay recalls ZERO and reproduces the projection", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const deps = { store, provider };
    const request = makeRequest(projection, "wf-rdi-1");

    const first = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(first.kind).toBe("ACCEPTED");
    if (first.kind === "ACCEPTED") {
      expect(first.provider_calls).toBe(1);
      expect(first.replayed).toBe(false);
      expect(first.projection.relations).toHaveLength(1);
    }
    expect(provider.calls).toBe(1);

    const record = await store.load("wf-rdi-1");
    expect(record?.stage).toBe("R3_PROVIDER_OUTCOME_CHECKPOINTED");
    expect(record?.external_provider_call_count).toBe(1);
    expect(record?.provider_outcome?.kind).toBe("ACCEPTED");

    const replay = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(replay.kind).toBe("ACCEPTED");
    if (replay.kind === "ACCEPTED" && first.kind === "ACCEPTED") {
      expect(replay.provider_calls).toBe(0);
      expect(replay.replayed).toBe(true);
      expect(replay.projection.output_fingerprint).toBe(first.projection.output_fingerprint);
      expect(JSON.stringify(replay.projection.relations)).toBe(JSON.stringify(first.projection.relations));
    }
    expect(provider.calls).toBe(1);
  });

  it("§76 request fingerprint is deterministic and NEVER binds workflow_id", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const deps = { store, provider };

    const anchorFingerprint = await deriveBeliefDecisionInfluenceRelationRequestFingerprintV0({
      subject_id: projection.subject_id,
      state_revision: projection.state_revision,
      current_logical_time: projection.current_logical_time,
      projection_hash: projection.projection_hash,
      action_space_fingerprint: await deriveCognitionActionSpaceFingerprintV1(
        (() => {
          const space = validateAllowedActionSpaceV1(HOST_ACTIONS);
          if (!space.ok) throw new Error("fixture");
          return space.value;
        })()
      )
    });
    expect(anchorFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);

    await runBeliefDecisionInfluenceRelationWorkflowV0(makeRequest(projection, "wf-rdi-a"), deps);
    await runBeliefDecisionInfluenceRelationWorkflowV0(makeRequest(projection, "wf-rdi-b"), deps);
    const recordA = await store.load("wf-rdi-a");
    const recordB = await store.load("wf-rdi-b");
    expect(recordA?.request_fingerprint).toBe(recordB?.request_fingerprint);
    expect(recordA?.request_fingerprint).toBe(anchorFingerprint);
    expect(provider.calls).toBe(2);
  });

  it("§63 duplicate host action tuples fail BEFORE any store write or provider call", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const result = await runBeliefDecisionInfluenceRelationWorkflowV0(
      makeRequest(projection, "wf-rdi-dup", [
        { action_type: "WAIT", target_ref: null },
        { action_type: "WAIT", target_ref: null }
      ]),
      { store, provider }
    );
    expect(result).toEqual(expect.objectContaining({ kind: "FAILED", code: "INVALID_ACTION_SPACE", provider_calls: 0 }));
    expect(provider.calls).toBe(0);
    expect(store.size).toBe(0);
  });
});

// ---- fail-closed branches (§81-§82, §39) -------------------------------------------

describe("Relation Foundation V0 — workflow fail-closed branches", () => {
  it("§81 workflow_id reuse with a DIFFERENT request fingerprint is REUSE_CONFLICT (no call, no overwrite)", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const deps = { store, provider };
    const request = makeRequest(projection, "wf-rdi-reuse");
    const first = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(first.kind).toBe("ACCEPTED");
    const recordBefore = await store.load("wf-rdi-reuse");

    // Different allowed actions → different action-space fingerprint → different
    // request fingerprint under the SAME workflow identity.
    const conflicting = makeRequest(projection, "wf-rdi-reuse", [
      { action_type: "TRY_WEST_ENTRANCE", target_ref: null }
    ]);
    const second = await runBeliefDecisionInfluenceRelationWorkflowV0(conflicting, deps);
    expect(second).toEqual(expect.objectContaining({ kind: "FAILED", code: "REUSE_CONFLICT", provider_calls: 0 }));
    expect(provider.calls).toBe(1);

    // The original record is untouched: no overwrite, no rebase, no repair.
    const recordAfter = await store.load("wf-rdi-reuse");
    expect(JSON.stringify(recordAfter)).toBe(JSON.stringify(recordBefore));
  });

  it("§82 a claimed record with no durable outcome fails closed PROVIDER_OUTCOME_UNKNOWN (zero recall)", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const request = makeRequest(projection, "wf-rdi-crashed");

    const space = validateAllowedActionSpaceV1(HOST_ACTIONS);
    if (!space.ok) throw new Error("fixture");
    const actionSpaceFingerprint = await deriveCognitionActionSpaceFingerprintV1(space.value);
    const requestFingerprint = await deriveBeliefDecisionInfluenceRelationRequestFingerprintV0({
      subject_id: projection.subject_id,
      state_revision: projection.state_revision,
      current_logical_time: projection.current_logical_time,
      projection_hash: projection.projection_hash,
      action_space_fingerprint: actionSpaceFingerprint
    });
    const base = {
      schema_version: BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_RECORD_SCHEMA_VERSION,
      workflow_id: "wf-rdi-crashed" as never,
      request_fingerprint: requestFingerprint,
      subject_id: projection.subject_id,
      state_revision: projection.state_revision,
      current_logical_time: projection.current_logical_time,
      projection_hash: projection.projection_hash,
      action_space_fingerprint: actionSpaceFingerprint,
      stage: "R1_PROVIDER_READY" as const,
      external_provider_call_count: 0 as const,
      provider_outcome: null
    };
    const checkpointFingerprint = await deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0(base);
    await store.createIfAbsent({ ...base, checkpoint_fingerprint: checkpointFingerprint });
    expect(await store.claimProviderCall("wf-rdi-crashed", requestFingerprint)).toBe("CLAIMED");

    // Simulated crash after claim, before any durable outcome checkpoint.
    const result = await runBeliefDecisionInfluenceRelationWorkflowV0(request, { store, provider });
    expect(result).toEqual(
      expect.objectContaining({ kind: "FAILED", code: "PROVIDER_OUTCOME_UNKNOWN", provider_calls: 0 })
    );
    expect(provider.calls).toBe(0);
  });

  it("§39/§84 provider failures checkpoint as stable REJECTED and replay byte-stably with zero calls", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(() => {
      throw new CognitionRelationRejectionErrorV1("MODEL_MALFORMED_JSON", "direct JSON.parse failed");
    });
    const deps = { store, provider };
    const request = makeRequest(projection, "wf-rdi-rejected");

    const first = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(first).toEqual(
      expect.objectContaining({ kind: "PROVIDER_REJECTED", code: "MODEL_MALFORMED_JSON", provider_calls: 1, replayed: false })
    );
    expect(provider.calls).toBe(1);

    const replay = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(replay).toEqual(
      expect.objectContaining({ kind: "PROVIDER_REJECTED", code: "MODEL_MALFORMED_JSON", provider_calls: 0, replayed: true })
    );
    expect(provider.calls).toBe(1);
  });

  it("§39 generic provider (transport) failures are stable PROVIDER_REJECTED checkpoints", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(() => {
      throw new Error("MODEL_TRANSPORT_MODEL_CONNECTION_FAILURE: offline");
    });
    const deps = { store, provider };
    const request = makeRequest(projection, "wf-rdi-transport");

    const first = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(first).toEqual(
      expect.objectContaining({ kind: "PROVIDER_REJECTED", code: "PROVIDER_REJECTED", provider_calls: 1 })
    );
    const replay = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(replay).toEqual(
      expect.objectContaining({ kind: "PROVIDER_REJECTED", code: "PROVIDER_REJECTED", provider_calls: 0, replayed: true })
    );
    expect(provider.calls).toBe(1);
  });

  it("detects checkpoint tampering at load time (fail-closed error, no silent rebase)", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const deps = { store, provider };
    const request = makeRequest(projection, "wf-rdi-tamper");
    const first = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps);
    expect(first.kind).toBe("ACCEPTED");

    store.tamper("wf-rdi-tamper", (record) => {
      record["stage"] = "R1_PROVIDER_READY";
      record["external_provider_call_count"] = 0;
    });
    const error = await runBeliefDecisionInfluenceRelationWorkflowV0(request, deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("checkpoint fingerprint mismatch");
    expect(provider.calls).toBe(1);
  });
});

// ---- concurrency + zero canonical effects (§83) -------------------------------------

describe("Relation Foundation V0 — workflow concurrency + immutability", () => {
  it("§83 concurrent invocations of the SAME request share exactly ONE provider call", async () => {
    const projection = await buildProjection();
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const deps = { store, provider };
    const request = makeRequest(projection, "wf-rdi-concurrent");

    const [a, b] = await Promise.all([
      runBeliefDecisionInfluenceRelationWorkflowV0(request, deps),
      runBeliefDecisionInfluenceRelationWorkflowV0(request, deps)
    ]);
    expect(provider.calls).toBe(1);
    expect(a.kind).toBe("ACCEPTED");
    expect(b.kind).toBe("ACCEPTED");
    if (a.kind === "ACCEPTED" && b.kind === "ACCEPTED") {
      expect(a.projection.output_fingerprint).toBe(b.projection.output_fingerprint);
      expect(a.provider_calls + b.provider_calls).toBe(1);
    }
    const record = await store.load("wf-rdi-concurrent");
    expect(record?.external_provider_call_count).toBe(1);
  });

  it("workflow execution leaves the request projection + action list byte-identical", async () => {
    const projection = await buildProjection();
    const actions = [...HOST_ACTIONS];
    const projectionSnapshot = JSON.stringify(projection);
    const actionsSnapshot = JSON.stringify(actions);
    const store = new InMemoryRelationWorkflowStore();
    const provider = new FakeWorkflowProvider(validPayload);
    const request = makeRequest(projection, "wf-rdi-immutable", actions);

    const first = await runBeliefDecisionInfluenceRelationWorkflowV0(request, { store, provider });
    const replay = await runBeliefDecisionInfluenceRelationWorkflowV0(request, { store, provider });
    expect(first.kind).toBe("ACCEPTED");
    expect(replay.kind).toBe("ACCEPTED");
    expect(JSON.stringify(projection)).toBe(projectionSnapshot);
    expect(JSON.stringify(actions)).toBe(actionsSnapshot);
    expect(Object.isFrozen(projection)).toBe(true);
  });
});
