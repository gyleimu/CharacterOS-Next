/**
 * EVIDENCE_AUTHORITY_BOUNDARY — focused regression suite
 * (RELATIONSHIP_FAMILIARY_RETRIEVED_EVIDENCE_COGNITION_INTEGRATION_V0 final
 * isolation check).
 *
 * Proves that the ROOT-EXPORTED cognitive projection builder is a single-
 * argument trust boundary: NO caller-supplied ref array can reach
 * recent_retrieval_refs → allowedEvidenceSet → citeable provider evidence.
 * The validated-evidence augmentation is module-private and populated ONLY by
 * the trusted executor from refs that already passed the existing Memory
 * retrieval validation law:
 *
 *   SERIALIZED_REF  != EVIDENCE_AUTHORITY
 *   CALLER_REF      != VALIDATED_MEMORY_EVIDENCE
 *
 * Preserved laws (regression-pinned here and in the integration suites):
 *   validated selected Memory evidence → citeable (same-execution suites)
 *   familiarity receipt refs           → NOT citeable
 *   writer/commit/workflow refs        → NOT citeable
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionV0 } from "../cognition-action/types.js";

// Import through the PUBLIC runtime root — exactly the surface a product
// caller would use — proving the boundary at its outermost reach.
import {
  allowedEvidenceSet,
  buildCognitiveContextProjection
} from "../../index.js";

const ALICE = "entity:alice-like";
const FAMILIARITY_DIM = "relationship_core_interaction_familiarity_v0";
const FAKE_EPISODE = "episode:e-fake-caller-injected";
const FAKE_RECEIPT = "appraisal:1111111111111111111111111111111111111111111111111111111111111111";

function seedWithFamiliarity(value: number | null): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: "subject-s0",
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: {} },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
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
    beliefs: { schema_version: "belief-state-v0", items: [] },
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions:
            value === null
              ? [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }]
              : [
                  { dimension_id: "arbitrary_host_dimension", value: 0.25 },
                  { dimension_id: FAMILIARITY_DIM, value }
                ]
        }
      ]
    },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: "idle",
      task: null,
      focus_refs: [],
      active_entity_refs: [ALICE as never],
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
      state_revision: 3,
      logical_time: 0,
      last_transition_time: null,
      last_transition_type: null,
      created_at: 0,
      updated_at: 0
    }
  } as unknown as SubjectStateV0;
}

describe("evidence authority boundary (root-exported builder)", () => {
  it("exposes NO caller-supplied ref-array parameter on the public surface", () => {
    // The public builder accepts EXACTLY the authoritative snapshot.
    expect(buildCognitiveContextProjection.length).toBe(1);
  });

  it("caller-supplied arbitrary refs cannot enter the citeable evidence set", async () => {
    const state = seedWithFamiliarity(16 / 32);
    // Injection attempt: force an extra-arguments call carrying structurally
    // valid-looking fake refs. TypeScript's public signature admits only one
    // argument; the cast models a hostile runtime caller.
    const injection = {
      additionalRecentRetrievalRefs: [FAKE_EPISODE, FAKE_RECEIPT]
    };
    const projection: CognitiveContextProjectionV0 = await (
      buildCognitiveContextProjection as unknown as (
        snapshot: SubjectStateV0,
        extra: unknown
      ) => Promise<CognitiveContextProjectionV0>
    )(state, injection);

    // the injected refs are NOWHERE in the projection evidence context
    expect(projection.recent_retrieval_refs).toStrictEqual([]);
    const allowed = allowedEvidenceSet(projection);
    expect(allowed.has(FAKE_EPISODE)).toBe(false);
    expect(allowed.has(FAKE_RECEIPT)).toBe(false);
  });

  it("familiarity state and receipt/authority refs never become citeable by projection alone", async () => {
    const projection = await buildCognitiveContextProjection(seedWithFamiliarity(16 / 32));
    const allowed = allowedEvidenceSet(projection);
    // the familiarity VALUE is state-visible, never a citeable ref
    expect(allowed.has("relationship_core_interaction_familiarity_v0")).toBe(false);
    expect(allowed.has("0.5")).toBe(false);
    // a receipt ref for that exact state is not part of any projection surface
    const serialized = JSON.stringify(projection);
    expect(serialized.includes("appraisal:")).toBe(false);
    expect(serialized.includes("commit:")).toBe(false);
    expect(serialized.includes("workflow:w-")).toBe(false);
  });
});
