/**
 * P2.1.2 — Validation layer unit tests (pure; no runtime behavior, no commit engine,
 * no persistence, no domain logic).
 *
 * Required coverage: valid state, invalid schema, unauthorized producer, invalid
 * revision, invalid reference — plus the frozen closed-object/duplicate/cross-field/
 * trace-linkage rules enforced by this layer (docs/implementation/p2-1-contract-freeze.md
 * §§5–7, §10.3, §13).
 */

import { describe, expect, it } from "vitest";

import {
  assertCheckedLogicalTimeAdvance,
  assertLogicalTimeMonotonic,
  assertRevisionIncrement,
  validateHashFormat,
  validateOwnership,
  validateProposal,
  validateSubjectState,
  type ValidationResult
} from "./index.js";

// ----------------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------------

/** Golden S0 from docs/implementation/p2-1-contract-freeze.md §4.2. */
function s0(): Record<string, unknown> {
  return {
    schema_version: "subject-state-v0",
    identity: {
      subject_id: "subject-s0",
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: {} },
    memory_state: {
      working_refs: [],
      active_episode_refs: [],
      autobiographical_index_revision: null,
      repository_revision: "R0",
      consolidation_cursor: null,
      retrieval_config: {
        profile_id: "RETRIEVAL_V0",
        affect_congruence_enabled: false,
        recent_trace_capacity: 64
      },
      recent_retrieval_trace: [],
      lifecycle_metadata: {},
      pending_encoding_refs: [],
      last_retrieval_at: null
    },
    beliefs: { items: [] },
    relationships: { models: [] },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: "idle",
      task: null,
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: null
    },
    mechanism_config: {
      affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
      legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 },
      feature_flags: {},
      thresholds: {}
    },
    trace_window: {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    },
    runtime_metadata: {
      subject_version: "subject-v0",
      state_revision: 0,
      logical_time: 0,
      last_transition_time: null,
      last_transition_type: null,
      created_at: 0,
      updated_at: 0
    }
  };
}

const EXACT_RULE_IDS = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

function hashHex(n: number): string {
  const digits = n.toString().padStart(64, "0");
  return `sha256:${digits}`;
}

/** Fully valid TraceEntryV1 at history position `seq` (§10.2). */
function entry(seq: number): Record<string, unknown> {
  return {
    trace_schema_version: "trace-v1",
    trace_id: `trace:t${seq}`,
    history_sequence: seq,
    transition_id: `t-${seq}`,
    transition_type: "Observation",
    subject_id: "subject-s0",
    subject_revision_before: seq - 1,
    subject_revision_after: seq,
    logical_time: seq,
    rule_ids: [...EXACT_RULE_IDS],
    cause_refs: [],
    proposal_ref: `proposal:p${seq}`,
    domain_mutations: [
      {
        producer: "context",
        domain: "context",
        layers: ["context"],
        field_changes: [{ path: "/context", operation: "SET" }]
      }
    ],
    state_hash_before: hashHex(seq),
    state_hash_after: hashHex(seq * 10 + 1),
    memory_revision_before: "R0",
    memory_revision_after: "R0",
    outcome: "COMMITTED"
  };
}

function metadata(revision: number, logicalTime: number, transitionType: string | null): Record<string, unknown> {
  return {
    subject_version: "subject-v0",
    state_revision: revision,
    logical_time: logicalTime,
    last_transition_time: revision === 0 ? null : logicalTime,
    last_transition_type: transitionType,
    created_at: 0,
    updated_at: logicalTime
  };
}

function contextValue(scene: string): Record<string, unknown> {
  return {
    scene,
    task: null,
    focus_refs: [],
    active_entity_refs: [],
    environment_refs: [],
    current_observation_ref: null
  };
}

function baseProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-0001",
    subject_id: "subject-s0",
    transition_type: "Observation",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [],
    external_refs: [],
    ...overrides
  };
}

function contextDelta(scene: string): Record<string, unknown> {
  return {
    producer: "context",
    domain: "context",
    expected_repository_revision: null,
    operations: [{ path: "/context", value: contextValue(scene) }],
    provenance_refs: []
  };
}

function retrievalDelta(expectedRevision: string | null): Record<string, unknown> {
  return {
    producer: "memory",
    domain: "memory-retrieval",
    expected_repository_revision: expectedRevision,
    // Sorted by raw ASCII path: last_retrieval_at < recent_retrieval_trace < working_refs.
    operations: [
      { path: "/memory_state/last_retrieval_at", value: 5 },
      { path: "/memory_state/recent_retrieval_trace", value: [] },
      { path: "/memory_state/working_refs", value: [] }
    ],
    provenance_refs: []
  };
}

function contentDelta(operations: unknown[]): Record<string, unknown> {
  return {
    producer: "memory",
    domain: "memory-content",
    expected_repository_revision: "R1",
    operations,
    provenance_refs: []
  };
}

function moodDelta(baseline: unknown): Record<string, unknown> {
  return {
    producer: "affect",
    domain: "affect",
    expected_repository_revision: null,
    operations: [
      { path: "/mood", value: { baseline, generated_under_profile: null, last_update: null } }
    ],
    provenance_refs: []
  };
}

function regulationDelta(): Record<string, unknown> {
  return {
    producer: "regulation",
    domain: "regulation",
    expected_repository_revision: null,
    operations: [
      {
        path: "/regulation",
        value: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null }
      }
    ],
    provenance_refs: []
  };
}

function expectFail(r: ValidationResult<unknown>, code?: string): void {
  expect(r.ok).toBe(false);
  if (!r.ok && code !== undefined) {
    expect(r.error.error_code).toBe(code);
  }
}

function expectOk(r: ValidationResult<unknown>): void {
  if (!r.ok) {
    throw new Error(`expected ok, got ${r.error.error_code}: ${r.error.detail}`);
  }
  expect(r.ok).toBe(true);
}

// ----------------------------------------------------------------------------------
// SubjectStateV0 schema validation
// ----------------------------------------------------------------------------------

describe("validateSubjectState — valid states", () => {
  it("accepts golden S0", () => {
    expectOk(validateSubjectState(s0()));
  });

  it("accepts a revision-1 state with one contiguous trace entry", () => {
    const s = s0();
    s["runtime_metadata"] = metadata(1, 3, "Observation");
    s["trace_window"] = {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 1, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: [entry(1)]
    };
    expectOk(validateSubjectState(s));
  });

  it("accepts a revision-65 state whose window holds sequences 2..65 after eviction", () => {
    const s = s0();
    s["runtime_metadata"] = metadata(65, 65, "Observation");
    const entries: Record<string, unknown>[] = [];
    for (let i = 2; i <= 65; i++) entries.push(entry(i));
    s["trace_window"] = {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 65, offloaded_through_sequence: 1, offloaded_through_trace_ref: "trace:t1" },
      entries
    };
    expectOk(validateSubjectState(s));
  });

  it("accepts canonical set-like arrays sorted lexicographically", () => {
    const s = s0();
    (s["context"] as Record<string, unknown>)["active_entity_refs"] = ["entity:a", "entity:b"];
    expectOk(validateSubjectState(s));
  });
});

describe("validateSubjectState — invalid schema", () => {
  it("rejects a missing required top-level field", () => {
    const s = s0();
    delete s["mood"];
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects an unknown top-level key (closed object)", () => {
    const s = s0();
    s["wall_clock"] = "2026-01-01T00:00:00Z";
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects an unknown nested key (closed object)", () => {
    const s = s0();
    (s["identity"] as Record<string, unknown>)["narrative"] = "backstory";
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects a non-subject-state schema_version", () => {
    const s = s0();
    s["schema_version"] = "wrong-v9";
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects an unknown affect channel enum value", () => {
    const s = s0();
    (s["affect"] as Record<string, unknown>)["active_channels"] = [
      { channel_id: "rage", intensity: 1, phase: "ACTIVE", started_at: 0, source_appraisal_ref: "appraisal:a1" }
    ];
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects an out-of-range regulation scalar", () => {
    const s = s0();
    (s["regulation"] as Record<string, unknown>)["energy"] = 5;
    expectFail(validateSubjectState(s), "INVALID_VALUE_RANGE");
  });

  it("rejects a mood baseline above the frozen clamp range", () => {
    const s = s0();
    (s["mood"] as Record<string, unknown>)["baseline"] = 0.3;
    expectFail(validateSubjectState(s), "INVALID_VALUE_RANGE");
  });

  it("rejects a malformed ref string", () => {
    const s = s0();
    (s["context"] as Record<string, unknown>)["focus_refs"] = ["not-a-ref"];
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects a ref whose kind is not allowlisted for the field", () => {
    const s = s0();
    (s["memory_state"] as Record<string, unknown>)["working_refs"] = ["appraisal:a1"];
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects non-NFC text (decomposed display_name)", () => {
    const s = s0();
    (s["identity"] as Record<string, unknown>)["display_name"] = "\u006e\u0301";
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects NUL inside canonical text", () => {
    const s = s0();
    (s["context"] as Record<string, unknown>)["scene"] = "id\u0000le";
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects duplicate identity anchors", () => {
    const s = s0();
    (s["identity"] as Record<string, unknown>)["identity_anchors"] = ["anchor", "anchor"];
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects an unsorted set-like active_entity_refs array", () => {
    const s = s0();
    (s["context"] as Record<string, unknown>)["active_entity_refs"] = ["entity:b", "entity:a"];
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects duplicate set-like environment_refs", () => {
    const s = s0();
    (s["context"] as Record<string, unknown>)["environment_refs"] = ["environment:x", "environment:x"];
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects forbidden trait keys trust/fear/attachment", () => {
    const s = s0();
    (s["traits_seed"] as Record<string, unknown>)["dimensions"] = { trust: 0.5 };
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects nonempty lifecycle_metadata (EmptyClosedObjectV0)", () => {
    const s = s0();
    (s["memory_state"] as Record<string, unknown>)["lifecycle_metadata"] = { started: true };
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });

  it("rejects a retrieval ring longer than the schema capacity 64", () => {
    const s = s0();
    const ring: string[] = [];
    for (let i = 0; i < 65; i++) ring.push(`retrieval-trace:r${i}`);
    (s["memory_state"] as Record<string, unknown>)["recent_retrieval_trace"] = ring;
    expectFail(validateSubjectState(s), "INVALID_VALUE_RANGE");
  });
});

describe("validateSubjectState — cross-field and trace-window invariants", () => {
  it("rejects last_retrieval_at after logical_time", () => {
    const s = s0();
    (s["memory_state"] as Record<string, unknown>)["last_retrieval_at"] = 9;
    expectFail(validateSubjectState(s), "INVARIANT_VIOLATION");
  });

  it("rejects created_at > updated_at", () => {
    const s = s0();
    const rm = metadata(0, 0, null) as Record<string, unknown>;
    rm["created_at"] = 2;
    rm["updated_at"] = 1;
    s["runtime_metadata"] = rm;
    expectFail(validateSubjectState(s), "INVARIANT_VIOLATION");
  });

  it("rejects a nonzero revision with null last_transition_time", () => {
    const s = s0();
    const rm = metadata(5, 5, "Time") as Record<string, unknown>;
    rm["last_transition_time"] = null;
    s["runtime_metadata"] = rm;
    expectFail(validateSubjectState(s), "INVARIANT_VIOLATION");
  });

  it("rejects a cursor last_history_sequence differing from state_revision", () => {
    const s = s0();
    const tw = s["trace_window"] as Record<string, unknown>;
    tw["cursor"] = { last_history_sequence: 1, offloaded_through_sequence: 0, offloaded_through_trace_ref: null };
    expectFail(validateSubjectState(s), "TRACE_INTEGRITY_FAILURE");
  });

  it("rejects non-contiguous trace entries", () => {
    const s = s0();
    s["runtime_metadata"] = metadata(2, 2, "Observation");
    s["trace_window"] = {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 2, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: [entry(1), entry(3)]
    };
    expectFail(validateSubjectState(s), "TRACE_INTEGRITY_FAILURE");
  });

  it("rejects a revision-65 window whose offload position did not advance", () => {
    const s = s0();
    s["runtime_metadata"] = metadata(65, 65, "Observation");
    const entries: Record<string, unknown>[] = [];
    for (let i = 2; i <= 65; i++) entries.push(entry(i));
    s["trace_window"] = {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 65, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries
    };
    expectFail(validateSubjectState(s), "TRACE_INTEGRITY_FAILURE");
  });

  it("rejects a trace entry whose rule_ids are not the exact sorted constant set", () => {
    const s = s0();
    s["runtime_metadata"] = metadata(1, 1, "Observation");
    const e = entry(1);
    e["rule_ids"] = [...EXACT_RULE_IDS].reverse();
    s["trace_window"] = {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 1, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: [e]
    };
    expectFail(validateSubjectState(s), "INVALID_SCHEMA");
  });
});

// ----------------------------------------------------------------------------------
// Producer -> writable path ownership (Producer != Mutator)
// ----------------------------------------------------------------------------------

describe("validateOwnership", () => {
  it("allows the affect producer on /mood via Observation", () => {
    expectOk(validateOwnership("affect", "affect", "/mood", "Observation", "t"));
  });

  it("forbids a memory producer modifying affect", () => {
    expectFail(validateOwnership("memory", "memory-retrieval", "/affect", "Observation", "t"), "INVALID_TRANSITION_OWNER");
  });

  it("forbids an affect producer modifying memory content", () => {
    expectFail(
      validateOwnership("affect", "affect", "/memory_state/repository_revision", "Learning", "t"),
      "INVALID_TRANSITION_OWNER"
    );
  });

  it("forbids a runtime producer on canonical state (unregistered)", () => {
    expectFail(validateOwnership("runtime", "context", "/context", "Observation", "t"), "UNAUTHORIZED_PRODUCER");
  });

  it("forbids writing a readonly path even by its own producer", () => {
    expectFail(validateOwnership("context", "context", "/identity", "Observation", "t"), "FORBIDDEN_DIRECT_MUTATION");
  });
});

// ----------------------------------------------------------------------------------
// CanonicalTransitionProposalV1 validation
// ----------------------------------------------------------------------------------

describe("validateProposal — valid proposals", () => {
  it("accepts a minimal valid Observation proposal (zero deltas)", () => {
    expectOk(validateProposal(baseProposal()));
  });

  it("accepts a complete context delta owned by the context producer", () => {
    expectOk(
      validateProposal(baseProposal({ domain_deltas: [contextDelta("lab")] }))
    );
  });

  it("accepts a memory-retrieval delta on Observation with expected repository revision", () => {
    expectOk(
      validateProposal(baseProposal({ domain_deltas: [retrievalDelta("R1")] }))
    );
  });

  it("accepts a memory-content delta on Learning", () => {
    expectOk(
      validateProposal(
        baseProposal({
          transition_type: "Learning",
          domain_deltas: [
            contentDelta([{ path: "/memory_state/repository_revision", value: "R2" }])
          ]
        })
      )
    );
  });

  it("accepts a Time proposal with affect and regulation deltas in canonical order", () => {
    expectOk(
      validateProposal(
        baseProposal({
          transition_type: "Time",
          time_input: { kind: "ELAPSED", elapsed_time: { value: 5, unit: "tick" } },
          domain_deltas: [moodDelta(0.2), regulationDelta()]
        })
      )
    );
  });
});

describe("validateProposal — envelope syntax", () => {
  it("rejects an invalid transition_type", () => {
    expectFail(validateProposal(baseProposal({ transition_type: "Bogus" })), "INVALID_SCHEMA");
  });

  it("rejects a negative expected_state_revision", () => {
    expectFail(validateProposal(baseProposal({ expected_state_revision: -1 })), "INVALID_SCHEMA");
  });

  it("rejects an unknown top-level proposal key (closed object)", () => {
    expectFail(validateProposal(baseProposal({ provider_latency_ms: 12 })), "INVALID_SCHEMA");
  });

  it("rejects a malformed transition_id", () => {
    expectFail(validateProposal(baseProposal({ transition_id: "!!bad" })), "INVALID_SCHEMA");
  });

  it("rejects a canonical elapsed unit other than tick", () => {
    expectFail(
      validateProposal(
        baseProposal({
          transition_type: "Time",
          time_input: { kind: "ELAPSED", elapsed_time: { value: 5, unit: "seconds" } }
        })
      ),
      "INVALID_SCHEMA"
    );
  });

  it("rejects malformed elements in cause_refs", () => {
    expectFail(validateProposal(baseProposal({ cause_refs: ["bogus"] })), "INVALID_SCHEMA");
  });

  it("rejects unsorted cause_refs", () => {
    expectFail(
      validateProposal(baseProposal({ cause_refs: ["observation:b", "observation:a"] })),
      "INVALID_SCHEMA"
    );
  });
});

describe("validateProposal — producer identity and ownership", () => {
  it("rejects a well-formed but unregistered producer (LLM cannot mint deltas)", () => {
    const llmDelta = {
      producer: "llm-writer",
      domain: "context",
      expected_repository_revision: null,
      operations: [{ path: "/context", value: contextValue("hijacked") }],
      provenance_refs: []
    };
    expectFail(
      validateProposal(baseProposal({ domain_deltas: [llmDelta] })),
      "UNAUTHORIZED_PRODUCER"
    );
  });

  it("rejects a context producer targeting /context under Time (wrong transition owner)", () => {
    expectFail(
      validateProposal(
        baseProposal({
          transition_type: "Time",
          time_input: { kind: "ELAPSED", elapsed_time: { value: 1, unit: "tick" } },
          domain_deltas: [contextDelta("time-write")]
        })
      ),
      "INVALID_TRANSITION_OWNER"
    );
  });

  it("rejects an operation on the readonly /identity path", () => {
    const attack = {
      producer: "context",
      domain: "context",
      expected_repository_revision: null,
      operations: [
        {
          path: "/identity",
          value: s0()["identity"]
        }
      ],
      provenance_refs: []
    };
    expectFail(validateProposal(baseProposal({ domain_deltas: [attack] })), "FORBIDDEN_DIRECT_MUTATION");
  });

  it("rejects an unknown field path", () => {
    const weird = {
      producer: "context",
      domain: "context",
      expected_repository_revision: null,
      operations: [{ path: "/context/scene", value: "deep-partial-write" }],
      provenance_refs: []
    };
    expectFail(validateProposal(baseProposal({ domain_deltas: [weird] })), "INVALID_SCHEMA");
  });
});

describe("validateProposal — delta conflicts and ordering", () => {
  it("rejects duplicate paths inside one delta", () => {
    const dup = {
      producer: "context",
      domain: "context",
      expected_repository_revision: null,
      operations: [
        { path: "/context", value: contextValue("a") },
        { path: "/context", value: contextValue("b") }
      ],
      provenance_refs: []
    };
    expectFail(validateProposal(baseProposal({ domain_deltas: [dup] })), "DOMAIN_DELTA_CONFLICT");
  });

  it("rejects duplicate (producer,domain) deltas", () => {
    expectFail(
      validateProposal(
        baseProposal({ domain_deltas: [contextDelta("a"), contextDelta("b")] })
      ),
      "DOMAIN_DELTA_CONFLICT"
    );
  });

  it("rejects domain_deltas not sorted by (domain,producer)", () => {
    expectFail(
      validateProposal(
        baseProposal({
          transition_type: "Time",
          time_input: { kind: "ELAPSED", elapsed_time: { value: 5, unit: "tick" } },
          domain_deltas: [regulationDelta(), moodDelta(0.2)]
        })
      ),
      "INVALID_SCHEMA"
    );
  });

  it("rejects operations not sorted by path", () => {
    expectFail(
      validateProposal(
        baseProposal({
          transition_type: "Learning",
          domain_deltas: [
            contentDelta([
              { path: "/memory_state/repository_revision", value: "R2" },
              { path: "/memory_state/consolidation_cursor", value: null }
            ])
          ]
        })
      ),
      "INVALID_SCHEMA"
    );
  });

  it("rejects an empty operations array", () => {
    expectFail(
      validateProposal(baseProposal({ domain_deltas: [contentDelta([])] })),
      "INVALID_SCHEMA"
    );
  });
});

describe("validateProposal — revision expectations and value shapes", () => {
  it("requires a non-null expected_repository_revision for memory-retrieval", () => {
    expectFail(
      validateProposal(baseProposal({ domain_deltas: [retrievalDelta(null)] })),
      "INVALID_SCHEMA"
    );
  });

  it("requires null expected_repository_revision for non-memory domains", () => {
    const bad = contextDelta("lab");
    bad["expected_repository_revision"] = "R1";
    expectFail(validateProposal(baseProposal({ domain_deltas: [bad] })), "INVALID_SCHEMA");
  });

  it("rejects a delta value of the wrong type for its path", () => {
    expectFail(
      validateProposal(baseProposal({ domain_deltas: [moodDelta("high")] })),
      "INVALID_SCHEMA"
    );
  });

  it("rejects a delta value outside the frozen range for its path", () => {
    expectFail(
      validateProposal(baseProposal({ domain_deltas: [moodDelta(0.9)] })),
      "INVALID_VALUE_RANGE"
    );
  });
});

// ----------------------------------------------------------------------------------
// Invariant validators
// ----------------------------------------------------------------------------------

describe("invariants", () => {
  it("revision increment: rejects equality and accepts the exact successor", () => {
    expect(assertRevisionIncrement(5 as never, 5 as never).ok).toBe(false);
    expect(assertRevisionIncrement(6 as never, 5 as never).ok).toBe(true);
  });

  it("revision increment: rejects a non-representable successor", () => {
    const max = 9007199254740991;
    expectFail(assertRevisionIncrement((max + 1) as never, max as never), "INVARIANT_VIOLATION");
  });

  it("logical time monotonic: rejects decrease and accepts equality", () => {
    expect(assertLogicalTimeMonotonic(4 as never, 5 as never).ok).toBe(false);
    expect(assertLogicalTimeMonotonic(5 as never, 5 as never).ok).toBe(true);
  });

  it("checked logical time advance: rejects safe-integer overflow", () => {
    const max = 9007199254740991;
    expectFail(assertCheckedLogicalTimeAdvance(max as never, 1 as never), "INVALID_LOGICAL_TIME");
    const advanced = assertCheckedLogicalTimeAdvance(3 as never, 5 as never);
    expectOk(advanced);
  });

  it("hash format: enforces sha256:<64 lowercase hex>", () => {
    expect(validateHashFormat(`sha256:${"a".repeat(64)}`).ok).toBe(true);
    expect(validateHashFormat("not-a-hash").ok).toBe(false);
    expect(validateHashFormat(`sha256:${"A".repeat(64)}`).ok).toBe(false);
  });
});
