/**
 * P2.3.3.1 — ObservationInputV0 (closed runtime input contract, refs-only).
 * Source: p2-runtime-plan.md §8.2 (text Perception normalization), §8.3 (controlled
 * projection); micl-design.md §10 (Observation/Perception boundary).
 *
 * This contract consumes the NORMALIZED OUTPUT of perception — objective facts as
 * content-addressed refs. It deliberately contains NO text field and NO natural
 * language understanding logic: raw text normalization is perception's job, and this
 * envelope only moves references forward.
 *
 * Closed shape, all keys required, immutable (deep-freeze is the caller's choice;
 * validators never mutate). Refs arrays are set-like: unique + lexicographically
 * sorted, with per-field kind allowlists.
 */

import type {
  CanonicalRefV0,
  IdentifierV0,
  LogicalTimeV0
} from "@characteros-next/subject-core";
import {
  isNumber,
  isRecord,
  isString,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateRefElement
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";

export const OBSERVATION_INPUT_SCHEMA_VERSION = "observation-input-v0" as const;

export interface ObservationInputV0 {
  readonly schema_version: typeof OBSERVATION_INPUT_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  /** Content address of THIS observation (kind `observation`). */
  readonly observation_id: CanonicalRefV0;
  /** Canonical occurrence time; equality with current authority is a later-stage guard. */
  readonly occurrence_logical_time: LogicalTimeV0;
  /** Objective fact sources; set-like refs of kinds observation|source|entity|event. */
  readonly source_refs: readonly CanonicalRefV0[];
  /** Entities the observation involves; set-like refs of kinds entity|subject. */
  readonly entity_refs: readonly CanonicalRefV0[];
}

const INPUT_KEYS: readonly string[] = [
  "schema_version",
  "subject_id",
  "observation_id",
  "occurrence_logical_time",
  "source_refs",
  "entity_refs"
];

/** Validates one closed ObservationInputV0. Pure; never mutates the input. */
export function validateObservationInput(v: unknown): ValidationResult<ObservationInputV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "observation input: expected object");
  for (const key of Object.keys(v)) {
    if (!INPUT_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `observation input.${key}: unknown key`);
    }
  }
  if (v["schema_version"] !== OBSERVATION_INPUT_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "observation input.schema_version");
  }
  if (!isString(v["subject_id"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "observation input.subject_id: expected identifier");
  }
  const subject = validateIdentifier(v["subject_id"], "observation input.subject_id");
  if (!subject.ok) return subject;
  const observationId = validateRefElement(v["observation_id"], "observation input.observation_id", [
    "observation"
  ]);
  if (!observationId.ok) return observationId;

  const occurrence = v["occurrence_logical_time"];
  if (!isNumber(occurrence)) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "observation input.occurrence_logical_time: expected number"
    );
  }
  const occurrenceChecked = validateLogicalTime(occurrence, "observation input.occurrence_logical_time");
  if (!occurrenceChecked.ok) return occurrenceChecked;

  const sources = validateRefArray(v["source_refs"], "observation input.source_refs", {
    kinds: ["observation", "source", "entity", "event"],
    sorted: true
  });
  if (!sources.ok) return sources;
  const entities = validateRefArray(v["entity_refs"], "observation input.entity_refs", {
    kinds: ["entity", "subject"],
    sorted: true
  });
  if (!entities.ok) return entities;

  return ok(v as unknown as ObservationInputV0);
}
