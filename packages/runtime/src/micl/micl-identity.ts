/**
 * P2.4 — MICL request identity (micl-design.md §8, §32).
 *
 * MICL request fingerprint = SHA-256/JCS over the frozen domain-separated
 * projection `characteros-next/micl/request-fingerprint/v1` of the SEMANTIC
 * request WITHOUT micl_id (subject, expected initial revision, complete
 * Observation, cause refs, declared salience). Excludes request metadata, wall
 * clock, logs and transport (§8 note).
 *
 * Same micl_id + same fingerprint ⇒ resume/replay. Same micl_id + different
 * fingerprint ⇒ frozen MICL_ID_REUSE / MICL-RESUME-001 admission error (never a
 * MICLResult status). No randomUUID / Math.random / wall clock.
 */

import type { HashV1 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { MICLRequestV0 } from "./micl-types.js";

export const MICL_REQUEST_FINGERPRINT_PROJECTION =
  "characteros-next/micl/request-fingerprint/v1" as const;

/**
 * The semantic fingerprint body: the complete request WITHOUT micl_id and
 * schema_version transport framing. Field order here is fixed by construction.
 */
export function miclSemanticRequestBody(request: MICLRequestV0): Record<string, unknown> {
  return {
    subject_id: request.subject_id,
    expected_initial_state_revision: request.expected_initial_state_revision,
    observation: {
      schema_version: request.observation.schema_version,
      subject_id: request.observation.subject_id,
      observation_id: request.observation.observation_id,
      occurrence_logical_time: request.observation.occurrence_logical_time,
      source_refs: [...request.observation.source_refs],
      entity_refs: [...request.observation.entity_refs]
    },
    cause_refs: [...request.cause_refs],
    declared_salience: request.declared_salience
  };
}

/** Frozen §8 derivation — the micl request fingerprint (HashV1). */
export async function deriveMiclRequestFingerprint(request: MICLRequestV0): Promise<HashV1> {
  return hashEnvelope(MICL_REQUEST_FINGERPRINT_PROJECTION, miclSemanticRequestBody(request));
}
