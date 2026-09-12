/**
 * CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0 (AUD-06) — external structured
 * observation FIRST/REPLAY/CONFLICT at the SESSION AUTHORITY level.
 *
 * Proves the durable dedup is not only a product-wrapper convenience: the
 * primitive itself resolves identity from authoritative canonical committed
 * history, so a repeated identical observation creates ZERO additional lived
 * experience (before and after a full restore), and changed content under the
 * same observation identity fails closed. Fully offline: 0 real model calls
 * (the cognition/language transports and the appraisal provider throw if
 * invoked — an external observation must never reach them).
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import { ExplicitV4SessionAuthorityV0 } from "./explicit-v4-session-authority-v0.js";
import { createInteractiveSubjectSeedV0 } from "./interactive-subject-runtime-v0.js";
import { ExternalObservationReplayConflictErrorV0 } from "./external-observation-identity.js";
import type { ModelTransportV0 } from "../transports/model-transport.js";

const SUBJECT_ID = "extobs-replay-subject";

const neverTransport = {
  complete: async () => {
    throw new Error("external observation must not invoke a model transport");
  }
} as unknown as ModelTransportV0;

const neverAppraisal = {
  proposeFactualEventAppraisal: async () => {
    throw new Error("external observation must not invoke appraisal");
  }
} as unknown as FactualEventAppraisalProviderV0;

function options() {
  return {
    subject: { subject_id: SUBJECT_ID, display_name: "Observer", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID, "Observer") as SubjectStateV0,
    conversationCognitionTransport: neverTransport,
    languageTransport: neverTransport,
    factualEventAppraisalProvider: neverAppraisal,
    clock: () => "2026-01-01T00:00:00.000Z"
  } as never;
}

function observationInput(scene: string) {
  return {
    observation_id: "observation:extobs-replay-1",
    source_refs: ["source:sensor-a"],
    external_refs: ["event:door-open-1"],
    entity_refs: ["entity:alice"],
    scene,
    task: null,
    focus_refs: ["entity:alice"],
    environment_refs: [] as string[],
    declaredSalience: 0.5
  };
}

describe("CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0 — external observation identity", () => {
  it("FIRST commits one Observation + one lived episode; REPLAY is +0; CONFLICT fails closed", async () => {
    const authority = await ExplicitV4SessionAuthorityV0.createFresh(options());

    const first = await authority.commitExternalObservation(observationInput("Front door opened."));
    expect(first.observation_transition_id).toMatch(/^t-obs-/);
    expect(first.episode_ref).toMatch(/^episode:/);
    const bundlesAfterFirst = authority.durableSource().bundles.length;

    // REPLAY: identical semantic content under the same observation identity.
    const replay = await authority.commitExternalObservation(observationInput("Front door opened."));
    expect(replay.observation_transition_id).toBe(first.observation_transition_id);
    expect(replay.episode_ref).toBe(first.episode_ref);
    expect(replay.repository_revision).toBe(first.repository_revision);
    expect(authority.durableSource().bundles.length).toBe(bundlesAfterFirst);

    // CONFLICT: same identity, changed content ⇒ fail closed, +0 mutations.
    await expect(
      authority.commitExternalObservation(observationInput("Front door was forced open."))
    ).rejects.toBeInstanceOf(ExternalObservationReplayConflictErrorV0);
    expect(authority.durableSource().bundles.length).toBe(bundlesAfterFirst);
  });

  it("REPLAY stays +0 across a full fresh-process restore (durable identity)", async () => {
    const authority = await ExplicitV4SessionAuthorityV0.createFresh(options());
    const first = await authority.commitExternalObservation(observationInput("Front door opened."));
    const durable = await authority.captureDurableState([first.episode_ref]);
    const source = authority.durableSource();

    const { authority: restored } = await ExplicitV4SessionAuthorityV0.restoreFromDurableState(
      options(),
      durable,
      source
    );
    const bundlesBeforeReplay = restored.durableSource().bundles.length;
    const replay = await restored.commitExternalObservation(observationInput("Front door opened."));
    expect(replay.observation_transition_id).toBe(first.observation_transition_id);
    expect(replay.episode_ref).toBe(first.episode_ref);
    expect(restored.durableSource().bundles.length).toBe(bundlesBeforeReplay);

    await expect(
      restored.commitExternalObservation(observationInput("Front door was forced open."))
    ).rejects.toBeInstanceOf(ExternalObservationReplayConflictErrorV0);
  });
});
