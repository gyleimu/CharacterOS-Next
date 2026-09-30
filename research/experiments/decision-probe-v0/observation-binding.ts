/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV0 — CURRENT-OBSERVATION BINDING (D0Q_RUN_002 repair). RESEARCH-ONLY.
 *
 * DEFECT REPAIRED (D0Q_RUN_001): the binding put the fixture text into `context.task` and
 * never committed an observation, so the production request rendered
 *
 *     [context] scene="idle" task="<fixture text>"
 *     [current observation] (none)
 *
 * The executor therefore decided about an absent observation, and the model said so verbatim
 * ("the observation is empty"). That is a request-construction defect, not a vocabulary or
 * capability finding.
 *
 * PRODUCTION SEMANTICS (read from the tree, not invented):
 *   `[current observation]` renders `projection.context.current_observation_ref ?? "(none)"`
 *   (conversation-cognition-provider-v2.ts:262). It is a REF, never a text.
 *   The observation's CONTENT reaches the executor as `[context] scene=…` / `task=…`
 *   (`buildContextDelta` carries scene/task forward and sets
 *   `current_observation_ref = input.observation_id`).
 *
 * REPAIR (production mechanisms only):
 *   fixture.observation_text
 *     → `observationInput({ observation_id: "observation:o-<fixture_id>", ... })`   (production)
 *     → `buildContextDelta(observation, snapshot)`                                  (production)
 *     → `/context` value: scene = fixture text, task = null, current_observation_ref = the
 *        observation id  (the harness overrides ONLY scene/task, exactly as the
 *        durable-life-history harness does; `task` is null so the observation is NOT
 *        duplicated into it)
 *     → `buildObservationProposal` → `facade.reserveAndRoute` → `facade.commitReserved`
 *        with `issuer.issue([{producer:"context",domain:"context"}])`
 *     → canonical state now carries a REAL current observation and the fixture scene
 *
 * FORBIDDEN here: hand-writing a projection, hand-writing `[current observation]`, string
 * patching the request, faking an observation in the probe layer, duplicating the observation
 * into task AND observation, or adding any experiment-specific prompt.
 */

import { proposalFingerprint } from "../../../packages/subject-core/dist/index.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import { observationInput } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import { buildContextDelta } from "../../../packages/runtime/dist/ports/context-producer-port.js";

import {
  buildWorld,
  currentBindings,
  readSnapshot,
  type World
} from "../canonical-affect-behavior-influence-v1/harness.ts";
import type { DecisionProbeD0FixtureV0 } from "./fixtures.js";

export const OBSERVATION_BINDING_VERSION_V0 = "decision-probe-observation-binding-v1" as const;

export interface FixtureWorldV0 {
  readonly world: World;
  readonly observation_ref: string;
  readonly scene: string;
  readonly task: string | null;
  readonly post_commit_state_revision: number;
}

/**
 * Builds a genesis world and commits the fixture observation through the production
 * observation path. Deterministic in everything except the observation ref, which is derived
 * from the fixture id (so different fixtures produce different refs).
 */
export async function buildFixtureWorldWithObservationV0(
  fixture: DecisionProbeD0FixtureV0
): Promise<FixtureWorldV0> {
  // A neutral task: the observation is NOT the task, and must not be duplicated into it.
  const world = await buildWorld("");
  const snapshot = await readSnapshot(world);
  const subjectId = snapshot.identity.subject_id;

  const observation = observationInput({
    subject_id: subjectId,
    observation_id: `observation:o-${fixture.fixture_id.toLowerCase()}`,
    occurrence_logical_time: snapshot.runtime_metadata.logical_time,
    source_refs: ["source:s-3"],
    entity_refs: ["entity:alice", `subject:${subjectId}`]
  });

  // Production context delta: carries scene/task forward and sets current_observation_ref to
  // the observation id. The ONLY overrides are scene (the fixture text, the current event) and
  // task (null — not duplicated).
  const baseDelta = await buildContextDelta(observation, snapshot as never);
  const baseOperation = baseDelta.operations[0] as {
    path: string;
    value: Record<string, unknown>;
  };
  if (baseOperation.path !== "/context") {
    throw new Error(`OBSERVATION_BINDING_UNEXPECTED_DELTA_PATH: ${baseOperation.path}`);
  }
  const contextDelta = {
    ...baseDelta,
    operations: [
      {
        ...baseOperation,
        value: { ...baseOperation.value, scene: fixture.observation_text, task: null }
      }
    ]
  } as typeof baseDelta;

  const proposal = await buildObservationProposal({
    subjectId,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [contextDelta]
  });

  const reserved = await world.assembly.facade.reserveAndRoute(proposal as never);
  if ((reserved as { kind: string }).kind !== "CONTINUE") {
    throw new Error(`OBSERVATION_BINDING_RESERVATION_FAILED: ${(reserved as { kind: string }).kind}`);
  }
  const outcome = await world.assembly.facade.commitReserved({
    proposal,
    continuation: (reserved as { continuation: unknown }).continuation,
    producerAuthorization: world.issuer.issue([{ producer: "context", domain: "context" }]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-decision-probe-observation-${fixture.fixture_id}` as never,
      transition_id: (proposal as { transition_id: string }).transition_id,
      subject_id: (proposal as { subject_id: string }).subject_id,
      transition_type: (proposal as { transition_type: string }).transition_type,
      payload_fingerprint: await proposalFingerprint(proposal as never)
    },
    repository_bindings: (await currentBindings(world.repo, snapshot)) as never
  } as never);
  if ((outcome as { kind: string }).kind !== "COMMITTED") {
    throw new Error(
      `OBSERVATION_BINDING_COMMIT_FAILED: ${JSON.stringify(outcome).slice(0, 240)}`
    );
  }

  const committed = (outcome as unknown as {
    bundle: { next_snapshot: { context: { scene: string; task: string | null }; runtime_metadata: { state_revision: number } } };
  }).bundle.next_snapshot;
  const committedContext = committed.context;
  const committedMetadata = committed.runtime_metadata;

  return Object.freeze({
    world,
    observation_ref: observation.observation_id,
    scene: committedContext.scene,
    task: committedContext.task,
    post_commit_state_revision: committedMetadata.state_revision
  });
}
