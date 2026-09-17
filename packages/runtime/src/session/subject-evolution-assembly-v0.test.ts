/**
 * SUBJECT_EVOLUTION_VIEW_V0 — tests.
 *
 * The projection is READ-ONLY and derived from durable records; every case here is
 * offline (0 model calls). The affect and belief transitions are attributed only
 * where the durable record itself carries the binding, and the two domains that
 * cannot be traced are reported as UNAVAILABLE rather than guessed.
 */

import { describe, expect, it } from "vitest";

import {
  affectTransitionsFromBundlesV0,
  beliefTransitionsFromRecordsV0,
  buildSubjectEvolutionViewV0,
  readAffectApplicationBundleV0,
  readBeliefWorkflowRecordV0,
  type AffectApplicationBundleViewV0,
  type BeliefWorkflowRecordViewV0
} from "./subject-evolution-assembly-v0.js";
import type { LivedMemoryInspectionV0 } from "./explicit-v4-session-authority-v0.js";

function bundle(input: {
  readonly transitionId: string;
  readonly revision: number;
  readonly causeRefs?: readonly string[];
  readonly valence?: number;
  readonly activation?: number;
}): Record<string, unknown> {
  return {
    transition_type: "AffectApplication",
    transition_id: input.transitionId,
    next_revision: input.revision,
    canonical_proposal: {
      cause_refs: [
        ...(input.causeRefs ?? [`appraisal:${input.transitionId}`, `event:${input.transitionId}`, `observation:${input.transitionId}`])
      ].sort(),
      domain_deltas: [
        {
          producer: "affect",
          domain: "affect",
          operations: [
            {
              path: "/affect",
              value: { schema_version: "canonical-affect-v0", valence: input.valence ?? 0.1, activation: input.activation ?? 0.5 }
            }
          ]
        }
      ]
    }
  };
}

function memory(entries: readonly LivedMemoryInspectionV0["entries"][number][]): LivedMemoryInspectionV0 {
  return {
    schema_version: "lived-memory-inspection-v0",
    repository_revision: "R7",
    total_episode_count: entries.length,
    displayed_count: entries.length,
    entries
  };
}

function current() {
  return {
    affect: { valence: 0.1, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    beliefs: [{ proposition_id: "belief-1", proposition_label: "Label one", credence: 0.5 }],
    relationships: [{ counterpart_ref: "entity:alice", dimensions: [{ dimension_id: "familiarity", value: 0.25 }] }],
    personality: [{ dimension_id: "openness", value: 0.6 }]
  };
}

function viewOf(overrides: Partial<Parameters<typeof buildSubjectEvolutionViewV0>[0]> = {}) {
  return buildSubjectEvolutionViewV0({
    subject_id: "alice",
    state_revision: 9,
    logical_time: 12,
    repository_revision: "R7",
    memory: memory([
      { kind: "OBSERVATION", occurrence_logical_time: 3, scene: 'The user says: "hello"', episode_ref: "episode:a" },
      {
        kind: "BEHAVIOR_OUTCOME",
        occurrence_logical_time: 4,
        delivered_behavior_text: "Noted.",
        outcome_reply_text: "thanks",
        episode_ref: "episode:b"
      }
    ]),
    affect_bundles: [],
    belief_records: [],
    current: current(),
    cognition_memory_episode_refs: ["episode:b", "episode:a", "episode:a"],
    ...overrides
  });
}

describe("SUBJECT_EVOLUTION_VIEW_V0", () => {
  it("O1: a subject with no lived events and no transitions reports empty sections honestly", () => {
    const view = viewOf({ memory: memory([]), current: { ...current(), beliefs: [], relationships: [], personality: [] } });
    expect(view.schema_version).toBe("subject-evolution-view-v0");
    expect(view.recent_lived_events).toEqual([]);
    expect(view.durable_effects.affect).toEqual([]);
    expect(view.durable_effects.belief).toEqual([]);
    expect(view.attribution.affect.status).toBe("UNAVAILABLE");
    expect(view.attribution.belief.status).toBe("UNAVAILABLE");
    expect(view.attribution.relationship.status).toBe("UNAVAILABLE");
    expect(view.attribution.personality.status).toBe("UNAVAILABLE");
    expect(view.current.beliefs).toEqual([]);
  });

  it("O2: lived events appear, newest first, with their exact refs and texts", () => {
    const view = viewOf();
    expect(view.recent_lived_events.map((event) => event.episode_ref)).toEqual(["episode:b", "episode:a"]);
    const [newest] = view.recent_lived_events;
    expect(newest?.kind).toBe("BEHAVIOR_OUTCOME");
    expect(newest?.delivered_behavior_text).toBe("Noted.");
    expect(newest?.outcome_reply_text).toBe("thanks");
  });

  it("O3: an affect transition is attributed to the transition's OWN recorded cause chain", () => {
    const parsed = readAffectApplicationBundleV0(bundle({ transitionId: "t1", revision: 5, valence: -0.15 }));
    expect(parsed).not.toBeNull();
    const transitions = affectTransitionsFromBundlesV0([parsed as AffectApplicationBundleViewV0]);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.appraisal_ref).toBe("appraisal:t1");
    expect(transitions[0]?.event_ref).toBe("event:t1");
    expect(transitions[0]?.observation_ref).toBe("observation:t1");
    expect(transitions[0]?.valence_after).toBe(-0.15);
    // No recorded predecessor: before is null, never invented.
    expect(transitions[0]?.valence_before).toBeNull();
    const view = viewOf({ affect_bundles: [parsed as AffectApplicationBundleViewV0] });
    expect(view.attribution.affect.status).toBe("UPDATED_FROM");
  });

  it("O3b: a second affect transition carries the previous recorded value as its before", () => {
    const first = readAffectApplicationBundleV0(bundle({ transitionId: "t1", revision: 5, valence: 0.1 }));
    const second = readAffectApplicationBundleV0(bundle({ transitionId: "t2", revision: 7, valence: -0.2 }));
    const transitions = affectTransitionsFromBundlesV0([
      second as AffectApplicationBundleViewV0,
      first as AffectApplicationBundleViewV0
    ]);
    expect(transitions.map((transition) => transition.next_revision)).toEqual([5, 7]);
    expect(transitions[1]?.valence_before).toBe(0.1);
    expect(transitions[1]?.valence_after).toBe(-0.2);
  });

  it("O3c: an affect transition whose recorded cause chain is incomplete is SKIPPED, never guessed", () => {
    const partial = readAffectApplicationBundleV0(
      bundle({ transitionId: "t3", revision: 9, causeRefs: ["event:t3", "observation:t3"] })
    );
    expect(affectTransitionsFromBundlesV0([partial as AffectApplicationBundleViewV0])).toEqual([]);
  });

  it("O4: a belief transition carries the durable receipt's relation and credences", () => {
    const record = readBeliefWorkflowRecordV0({
      workflow_id: "wf-1",
      subject_id: "alice",
      evidence_bindings: [{ episode_ref: "episode:a", payload_hash: "sha256:x" }],
      semantic_candidate: { kind: "EXISTING_PROPOSITION" },
      terminal_result: { kind: "COMPLETE_COMMITTED" },
      plasticity_receipt: {
        proposition_id: "belief-1",
        relation: "CONTRADICTS",
        current_credence: 0.55,
        outcome: { kind: "CREDENCE_CHANGE", next_credence: 0.5 }
      }
    });
    expect(record?.route).toBe("EXISTING_PROPOSITION");
    expect(record?.relation).toBe("CONTRADICTS");
    const transitions = beliefTransitionsFromRecordsV0(
      [record as BeliefWorkflowRecordViewV0],
      new Map([["belief-1", "The storage room is usually locked."]])
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.proposition_label).toBe("The storage room is usually locked.");
    expect(transitions[0]?.prior_credence).toBe(0.55);
    expect(transitions[0]?.next_credence).toBe(0.5);
    expect(transitions[0]?.evidence_episode_refs).toEqual(["episode:a"]);
    expect(viewOf({ belief_records: [record as BeliefWorkflowRecordViewV0] }).attribution.belief.status).toBe(
      "UPDATED_FROM"
    );
  });

  it("O4b: a workflow that changed no state is NOT reported as a durable effect", () => {
    const noBearing = readBeliefWorkflowRecordV0({
      workflow_id: "wf-nb",
      subject_id: "alice",
      evidence_bindings: [{ episode_ref: "episode:z", payload_hash: "sha256:x" }],
      semantic_candidate: { kind: "NO_BEARING" },
      terminal_result: { kind: "COMPLETE_NO_BEARING" },
      plasticity_receipt: null
    });
    expect(beliefTransitionsFromRecordsV0([noBearing as BeliefWorkflowRecordViewV0], new Map())).toEqual([]);
    expect(viewOf({ belief_records: [noBearing as BeliefWorkflowRecordViewV0] }).attribution.belief.status).toBe(
      "UNAVAILABLE"
    );
  });

  it("O5: current values are the canonical ones, verbatim", () => {
    const view = viewOf();
    expect(view.current.affect).toEqual({ valence: 0.1, activation: 0.5 });
    expect(view.current.beliefs[0]?.credence).toBe(0.5);
    expect(view.current.relationships[0]?.dimensions[0]?.value).toBe(0.25);
    expect(view.current.personality[0]?.value).toBe(0.6);
    expect(view.subject.state_revision).toBe(9);
  });

  it("O8: untraceable domains are reported as UNAVAILABLE with a reason, never attributed", () => {
    const view = viewOf();
    expect(view.attribution.relationship).toEqual({
      status: "UNAVAILABLE",
      reason: expect.stringContaining("no provenance field")
    });
    expect(view.attribution.personality.status).toBe("UNAVAILABLE");
    // The values are still shown as CURRENT_STATE.
    expect(view.current.relationships).toHaveLength(1);
    expect(view.current.personality).toHaveLength(1);
  });

  it("the projection is detached, frozen, JSON-safe data with no live handles", () => {
    const view = viewOf();
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.current)).toBe(true);
    expect(JSON.parse(JSON.stringify(view)) as unknown).toEqual(JSON.parse(JSON.stringify(view)));
  });
});
