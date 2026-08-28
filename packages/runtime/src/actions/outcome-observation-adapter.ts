/**
 * P2-next — OutcomeObservationAdapterV0 (task §5/§6/§7).
 *
 * Deterministic mapping of one AUTHORITATIVE ActionOutcomeV0 to the EXISTING
 * frozen ObservationTransition input (refs-only). No parallel observation
 * schema; no subjective meaning ("X hates me" is downstream interpretation —
 * never encoded here); no invented/repaired refs.
 *
 * Factual binding: the observation_id is a deterministic content-address of
 * the execution identity, so the same execution always reintegrates as the
 * SAME observation (replay-stable) and a different execution always maps to a
 * different observation.
 *
 * Effect/world refs are preserved in the adapter's provenance output. They are
 * NOT forced into the observation ref arrays because "world-effect:"/"world-
 * observation:" are not ref kinds the frozen Observation input accepts —
 * dropping them from the INPUT is not ref repair; the authoritative Outcome
 * (with its exact refs) remains the durable fact, and the observation_id
 * anchors back to it.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { ObservationInputV0 } from "../transitions/observation/types.js";
import type { ActionOutcomeV0 } from "./types.js";

export const OUTCOME_OBSERVATION_ID_PROJECTION =
  "characteros-next/actions/outcome-observation-id/v1" as const;

/** Provenance preserved alongside the observation input (NOT canonical). */
export interface OutcomeProvenanceV0 {
  readonly execution_id: string;
  readonly status: ActionOutcomeV0["status"];
  readonly effect_refs: readonly string[];
  readonly world_observation_refs: readonly string[];
}

export interface OutcomeObservationMappingV0 {
  readonly input: ObservationInputV0;
  readonly provenance: OutcomeProvenanceV0;
}

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/**
 * Deterministic adapter: authoritative Outcome → Observation input.
 * FACT ONLY: action identity, target, factual status wording, execution refs.
 * Never invents subjective interpretation.
 */
export async function adaptOutcomeToObservation(
  outcome: ActionOutcomeV0,
  subjectId: string
): Promise<OutcomeObservationMappingV0> {
  const digest = strip(
    await hashEnvelope(OUTCOME_OBSERVATION_ID_PROJECTION, {
      execution_id: outcome.execution_id
    })
  );
  const observationId = `observation:o-outcome-${digest}` as CanonicalRefV0;
  const sourceRef = `source:outcome-${digest}` as CanonicalRefV0;
  // entity_refs may only carry entity|subject-kind refs (frozen grammar).
  const entityRefs: CanonicalRefV0[] = [];
  if (
    outcome.target_ref !== null &&
    (outcome.target_ref.startsWith("entity:") || outcome.target_ref.startsWith("subject:"))
  ) {
    entityRefs.push(outcome.target_ref);
  }
  return {
    input: {
      schema_version: "observation-input-v0",
      subject_id: subjectId as never,
      observation_id: observationId,
      occurrence_logical_time: outcome.logical_time as never,
      // Factual provenance only: the outcome source ref + the typed target.
      source_refs: [sourceRef] as never,
      entity_refs: entityRefs as never
    },
    provenance: {
      execution_id: outcome.execution_id,
      status: outcome.status,
      effect_refs: [...outcome.effect_refs],
      world_observation_refs: [...outcome.world_observation_refs]
    }
  };
}

/**
 * §6 — the ONLY factual sentence the adapter may emit for a human-readable
 * summary. Pure template over executor-reported facts; never interpretation.
 */
export function factualOutcomeSummary(outcome: ActionOutcomeV0): string {
  const target = outcome.target_ref ?? "(no target)";
  return `${outcome.action_type} toward ${target} was ${outcome.status}.`;
}
