/**
 * CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0 (AUD-06) — durable identity and
 * content fingerprint for EXTERNAL structured observations.
 *
 * The frozen transition-id law binds `expected_state_revision`, so the SAME
 * external observation re-offered after a revision advance would derive a new
 * transition id and duplicate lived experience. This module does NOT change that
 * law. Instead it derives ONE content-addressed fingerprint over the exact
 * semantic observation content and resolves the prior state from AUTHORITATIVE
 * CANONICAL COMMITTED HISTORY (the committed Observation bundles) — never a
 * parallel ledger and never process-local memory. That makes
 *
 *   FIRST     no committed external Observation for `observation_id`
 *   REPLAY    same `observation_id`, SAME content fingerprint  ⇒ +0 everything
 *   CONFLICT  same `observation_id`, DIFFERENT content          ⇒ fail closed
 *
 * durable across process death and fresh restore, because the committed bundles
 * are exactly what authoritative restore rebuilds.
 *
 * `declared_salience` is deliberately NOT part of the observation identity: it
 * is a Learning parameter, not observable observation content, and a replay
 * never re-encodes.
 */

import { hashEnvelope } from "@characteros-next/subject-core";

export const EXTERNAL_OBSERVATION_CONTENT_PROJECTION_V0 =
  "characteros-next/runtime/external-observation-content/v0" as const;

export interface ExternalObservationContentV0 {
  readonly observation_id: string;
  readonly source_refs: readonly string[];
  readonly external_refs: readonly string[];
  readonly entity_refs: readonly string[];
  readonly scene: string;
  readonly task: string | null;
  readonly focus_refs: readonly string[];
  readonly environment_refs: readonly string[];
}

function sortedUnique(refs: readonly string[]): string[] {
  return [...new Set(refs)].sort();
}

/** Deterministic fingerprint of the exact semantic observation content. */
export async function deriveExternalObservationContentFingerprintV0(
  content: ExternalObservationContentV0
): Promise<string> {
  return hashEnvelope(EXTERNAL_OBSERVATION_CONTENT_PROJECTION_V0, {
    observation_id: content.observation_id,
    source_refs: sortedUnique(content.source_refs),
    external_refs: sortedUnique(content.external_refs),
    entity_refs: sortedUnique(content.entity_refs),
    scene: content.scene,
    task: content.task,
    focus_refs: sortedUnique(content.focus_refs),
    environment_refs: sortedUnique(content.environment_refs)
  });
}

/** Fail-closed signal: the same observation identity carried different content. */
export class ExternalObservationReplayConflictErrorV0 extends Error {
  readonly code = "EXTERNAL_OBSERVATION_CONFLICT" as const;
  constructor(
    readonly observationId: string,
    detail: string
  ) {
    super(`EXTERNAL_OBSERVATION_CONFLICT: ${detail}`);
    this.name = "ExternalObservationReplayConflictErrorV0";
  }
}

/** Narrow canonical-history view of one committed Observation. */
export interface CommittedObservationIdentityViewV0 {
  readonly transition_id: string;
  readonly cause_refs: readonly string[];
  readonly external_refs: readonly string[];
  readonly context: {
    readonly scene: string;
    readonly task: string | null;
    readonly focus_refs: readonly string[];
    readonly environment_refs: readonly string[];
    readonly active_entity_refs: readonly string[];
  };
}

/**
 * Resolves the FIRST committed external Observation carrying `observationId`
 * and recomputes its content fingerprint from the committed payload. Returns
 * null when this observation identity has never been committed (FIRST).
 */
export async function findPriorExternalObservationFingerprintV0(
  candidates: readonly CommittedObservationIdentityViewV0[],
  observationId: string
): Promise<{ readonly transition_id: string; readonly fingerprint: string } | null> {
  for (const candidate of candidates) {
    if (!candidate.cause_refs.includes(observationId)) continue;
    const sourceRefs = candidate.cause_refs.filter((ref) => ref.startsWith("source:"));
    const fingerprint = await deriveExternalObservationContentFingerprintV0({
      observation_id: observationId,
      source_refs: sourceRefs,
      external_refs: candidate.external_refs,
      entity_refs: candidate.context.active_entity_refs,
      scene: candidate.context.scene,
      task: candidate.context.task,
      focus_refs: candidate.context.focus_refs,
      environment_refs: candidate.context.environment_refs
    });
    return { transition_id: candidate.transition_id, fingerprint };
  }
  return null;
}
