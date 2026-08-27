/**
 * P2.3.5.3a — LearningExperienceCandidateV0: the closed V0 trusted-input shape
 * frozen by docs/implementation/p2-3-5-learning-v0-reference-contract.md §4.1
 * (commit 0e11e62), plus closed-shape RUNTIME validation (TypeScript types alone
 * are not the trust boundary).
 *
 * The candidate is a host-resupplied, refs-and-metadata-only description of an
 * experience. Being typed, parseable or caller-asserted makes it NOTHING: it
 * becomes trusted only through durable same-Observation source verification
 * (learning-source-authority.ts). This module therefore validates shape/grammar
 * only — semantic provenance authority lives at the source-authority boundary.
 *
 * Slice scope (P2.3.5.3a): trusted input ONLY. No encoding, no episode_ref, no
 * cause_refs/references composition, no prepare intent, no Learning transition
 * identity, no memory write, no canonical mutation.
 */

import type { CanonicalRefV0, IdentifierV0, LogicalTimeV0, TransitionIdV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import {
  isRecord,
  isString,
  validateCanonicalText,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateRefElement,
  validateUnitInterval,
  refKind
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";

const SCHEMA_REASON = "SS-SCHEMA-001";

/** Exact closed candidate key set (contract §4.1 — 11 fields, nothing else). */
const CANDIDATE_KEYS: readonly string[] = [
  "subject_id",
  "source_transition_id",
  "observation_ref",
  "entity_refs",
  "event_refs",
  "occurrence_logical_time",
  "appraisal_ref",
  "scene",
  "focus_refs",
  "environment_refs",
  "declared_salience"
];

/**
 * Closed V0 learning input (contract §4.1): refs-and-metadata only. It carries
 * NO appraisal/affect/mood values, NO full SubjectState/MemoryState/context
 * snapshot, NO retrieval result, NO free-form narrative or LLM output.
 */
export interface LearningExperienceCandidateV0 {
  /** Must equal the Learning subject (triple-checked at source authority). */
  readonly subject_id: IdentifierV0;
  /** The committed source Observation transition identity. */
  readonly source_transition_id: TransitionIdV0;
  /** The source observation ref (`observation:<id>`). */
  readonly observation_ref: CanonicalRefV0;
  /** Sorted unique entity refs of the source input. */
  readonly entity_refs: readonly CanonicalRefV0[];
  /** Sorted unique event refs of the source input (may be empty). */
  readonly event_refs: readonly CanonicalRefV0[];
  /** The source Observation occurrence logical time. */
  readonly occurrence_logical_time: LogicalTimeV0;
  /** Appraisal provenance REF ONLY (never appraisal values), or null. */
  readonly appraisal_ref: CanonicalRefV0 | null;
  /** Nonempty NFC encoding-scene label of the source scene. */
  readonly scene: string;
  /** Priority-ordered focus refs of the source scene. */
  readonly focus_refs: readonly CanonicalRefV0[];
  /** Set-like (sorted unique) environment refs of the source scene. */
  readonly environment_refs: readonly CanonicalRefV0[];
  /** Declared [0,1] salience (ENCODING_DECLARED_V0 semantics; never computed). */
  readonly declared_salience: UnitIntervalV0;
}

function failCandidate(detail: string): ValidationResult<never> {
  return fail("INVALID_SCHEMA", SCHEMA_REASON, `learning candidate: ${detail}`);
}

function closedKeys(o: Record<string, unknown>, allowed: readonly string[]): ValidationResult<void> {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return failCandidate(`unknown key ${key} (closed shape)`);
  }
  return ok(undefined);
}

/**
 * Closed-shape runtime validation of an UNKNOWN value as a V0 learning
 * candidate. Fail-closed; no coercion, trimming, lowercasing, alias
 * normalization or ref repair. Grammar only — semantic source authority is a
 * separate boundary (validateTrustedLearningExperience).
 */
export function validateLearningExperienceCandidate(
  v: unknown
): ValidationResult<LearningExperienceCandidateV0> {
  if (!isRecord(v)) return failCandidate("expected object");
  const shell = closedKeys(v, CANDIDATE_KEYS);
  if (!shell.ok) return shell;

  if (!isString(v["subject_id"])) return failCandidate("subject_id: expected string");
  const subject = validateIdentifier(v["subject_id"], "learning candidate.subject_id");
  if (!subject.ok) return subject;

  if (!isString(v["source_transition_id"])) return failCandidate("source_transition_id: expected string");
  const transition = validateIdentifier(v["source_transition_id"], "learning candidate.source_transition_id");
  if (!transition.ok) return transition;

  const observation = validateRefElement(v["observation_ref"], "learning candidate.observation_ref", ["observation"]);
  if (!observation.ok) return observation;
  if (refKind(observation.value) !== "observation") {
    return failCandidate("observation_ref: expected observation ref");
  }

  const entity = validateRefArray(v["entity_refs"], "learning candidate.entity_refs", { sorted: true });
  if (!entity.ok) return entity;

  const event = validateRefArray(v["event_refs"], "learning candidate.event_refs", { sorted: true });
  if (!event.ok) return event;

  if (typeof v["occurrence_logical_time"] !== "number") {
    return failCandidate("occurrence_logical_time: expected number");
  }
  const occurrence = validateLogicalTime(v["occurrence_logical_time"], "learning candidate.occurrence_logical_time");
  if (!occurrence.ok) return occurrence;

  let appraisalRef: CanonicalRefV0 | null = null;
  if (v["appraisal_ref"] !== null) {
    const appraisal = validateRefElement(v["appraisal_ref"], "learning candidate.appraisal_ref", ["appraisal"]);
    if (!appraisal.ok) return appraisal;
    if (refKind(appraisal.value) !== "appraisal") {
      return failCandidate("appraisal_ref: expected appraisal ref");
    }
    appraisalRef = appraisal.value;
  }

  const scene = validateCanonicalText(v["scene"], "learning candidate.scene");
  if (!scene.ok) return scene;
  if (scene.value.length === 0) return failCandidate("scene: must be nonempty");

  // Priority-ordered (order significant; not lexicographically sorted).
  const focus = validateRefArray(v["focus_refs"], "learning candidate.focus_refs");
  if (!focus.ok) return focus;

  // Set-like: unique + lexicographically sorted.
  const environment = validateRefArray(v["environment_refs"], "learning candidate.environment_refs", { sorted: true });
  if (!environment.ok) return environment;

  if (typeof v["declared_salience"] !== "number") {
    return failCandidate("declared_salience: expected number");
  }
  const salience = validateUnitInterval(v["declared_salience"], "learning candidate.declared_salience");
  if (!salience.ok) return salience;

  return ok({
    subject_id: subject.value,
    source_transition_id: transition.value as unknown as TransitionIdV0,
    observation_ref: observation.value,
    entity_refs: v["entity_refs"] as readonly CanonicalRefV0[],
    event_refs: v["event_refs"] as readonly CanonicalRefV0[],
    occurrence_logical_time: occurrence.value,
    appraisal_ref: appraisalRef,
    scene: scene.value,
    focus_refs: v["focus_refs"] as readonly CanonicalRefV0[],
    environment_refs: v["environment_refs"] as readonly CanonicalRefV0[],
    declared_salience: salience.value
  });
}
