/**
 * P2.2.1 — EpisodicMemoryRecordV0 schema draft (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §5.1–§5.3 (global rules, refs),
 * §16 (memory owns episodic content; subject-state stays refs-only).
 *
 * DRAFT contract for the episodic payload a repository revision binds. It carries
 * metadata and references ONLY:
 * - occurrence logical time (canonical logical clock, never wall clock)
 * - provenance (owning transition + memory producer + cause refs)
 * - references (entity/event/observation-style refs, set-like unique+sorted)
 * - context (refs-only copy of the encoding scene; NOT SubjectState ownership)
 * - appraisal reference (grammar/kind only — NO emotion theory lives here)
 * - affect snapshot reference (grammar/kind only — NO affect computation here)
 * - salience metadata (DECLARED at encoding; NO ranking/retrieval algorithm here)
 *
 * Personality update / belief update / any state dynamics are out of scope forever at
 * record level: this object is inert content addressed by refs.
 */

import type {
  CanonicalRefV0,
  LogicalTimeV0,
  TransitionIdV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import {
  isNumber,
  isRecord,
  isString,
  validateCanonicalText,
  validateLogicalTime,
  validateRefArray,
  validateUnitInterval
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import {
  parseAffectSnapshotRef,
  parseAppraisalRef,
  parseEpisodeRef,
  type AffectSnapshotRef,
  type AppraisalRef,
  type EpisodeRef
} from "../refs.js";

export const EPISODIC_MEMORY_RECORD_SCHEMA_VERSION = "episodic-memory-record-v0" as const;

/** Salience provenance marker: scores are declared by the encoding stage in V0. */
export const SALIENCE_SOURCE_ENCODING_DECLARED = "ENCODING_DECLARED_V0" as const;

export interface EpisodicMemoryProvenanceV0 {
  /** Owning transition identity (opaque). */
  readonly transition_id: TransitionIdV0;
  /** Producing domain literal — always `memory` for episodic records. */
  readonly producer: "memory";
  /** Cause/evidence refs, set-like: unique and lexicographically sorted. */
  readonly cause_refs: readonly CanonicalRefV0[];
}

export interface EpisodicMemoryContextV0 {
  /** Nonempty canonical NFC copy of the encoding scene label. */
  readonly scene: string;
  /** Priority-ordered focus refs captured at encoding. */
  readonly focus_refs: readonly CanonicalRefV0[];
  /** Set-like environment refs captured at encoding. */
  readonly environment_refs: readonly CanonicalRefV0[];
}

export interface EpisodicMemorySalienceV0 {
  /** Declared [0,1] score frozen at encoding time; retrieval may read, never rewrite. */
  readonly declared_score: UnitIntervalV0;
  /** V0 literal: values are declared, not computed by any ranking algorithm. */
  readonly source: typeof SALIENCE_SOURCE_ENCODING_DECLARED;
}

export interface EpisodicMemoryRecordV0 {
  readonly schema_version: typeof EPISODIC_MEMORY_RECORD_SCHEMA_VERSION;
  /** Content-addressed ref of THIS record inside its repository revision. */
  readonly episode_ref: EpisodeRef;
  /** When the episode occurred on the canonical logical clock. */
  readonly occurrence_logical_time: LogicalTimeV0;
  /** When encoding recorded it; must be >= occurrence_logical_time. */
  readonly recorded_at_logical_time: LogicalTimeV0;
  readonly provenance: EpisodicMemoryProvenanceV0;
  /** Referenced entities/events/observations; set-like: unique and sorted. */
  readonly references: readonly CanonicalRefV0[];
  readonly context: EpisodicMemoryContextV0;
  /** Owning appraisal evidence ref, or null when none exists yet. */
  readonly appraisal_ref: AppraisalRef | null;
  /** Affect snapshot pointer, or null when none exists yet. */
  readonly affect_snapshot_ref: AffectSnapshotRef | null;
  readonly salience: EpisodicMemorySalienceV0;
}

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "episode_ref",
  "occurrence_logical_time",
  "recorded_at_logical_time",
  "provenance",
  "references",
  "context",
  "appraisal_ref",
  "affect_snapshot_ref",
  "salience"
];

const PROVENANCE_KEYS: readonly string[] = ["transition_id", "producer", "cause_refs"];
const CONTEXT_KEYS: readonly string[] = ["scene", "focus_refs", "environment_refs"];
const SALIENCE_KEYS: readonly string[] = ["declared_score", "source"];

function closedKeys(o: Record<string, unknown>, allowed: readonly string[], d: string): ValidationResult<void> {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${d}.${key}: unknown key`);
  }
  return ok(undefined);
}

/**
 * Validates one unknown value as a closed EpisodicMemoryRecordV0 draft.
 * Pure input -> narrowed record; no repair, no normalization.
 */
export function validateEpisodicMemoryRecord(v: unknown): ValidationResult<EpisodicMemoryRecordV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record: expected object");
  const shell = closedKeys(v, RECORD_KEYS, "record");
  if (!shell.ok) return shell;
  if (v["schema_version"] !== EPISODIC_MEMORY_RECORD_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.schema_version");
  }

  const episodeRef = parseEpisodeRef(v["episode_ref"], "record.episode_ref");
  if (!episodeRef.ok) return episodeRef;

  const occurrence = v["occurrence_logical_time"];
  if (!isNumber(occurrence)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.occurrence_logical_time: expected number");
  }
  const occurrenceChecked = validateLogicalTime(occurrence, "record.occurrence_logical_time");
  if (!occurrenceChecked.ok) return occurrenceChecked;

  const recordedAt = v["recorded_at_logical_time"];
  if (!isNumber(recordedAt)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.recorded_at_logical_time: expected number");
  }
  const recordedChecked = validateLogicalTime(recordedAt, "record.recorded_at_logical_time");
  if (!recordedChecked.ok) return recordedChecked;
  if ((recordedAt as number) < (occurrence as number)) {
    return fail(
      "INVARIANT_VIOLATION",
      "SS-SCHEMA-001",
      "record.recorded_at_logical_time must be >= occurrence_logical_time"
    );
  }

  const provenance = v["provenance"];
  if (!isRecord(provenance)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance: expected object");
  }
  const provKeys = closedKeys(provenance, PROVENANCE_KEYS, "record.provenance");
  if (!provKeys.ok) return provKeys;
  if (!isString(provenance["transition_id"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance.transition_id: expected identifier");
  }
  if (provenance["producer"] !== "memory") {
    return fail("UNAUTHORIZED_PRODUCER", "SS-AUTH-001", "record.provenance.producer must be `memory`");
  }
  const causeRefs = validateRefArray(provenance["cause_refs"], "record.provenance.cause_refs", { sorted: true });
  if (!causeRefs.ok) return causeRefs;

  const references = validateRefArray(v["references"], "record.references", { sorted: true });
  if (!references.ok) return references;

  const context = v["context"];
  if (!isRecord(context)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.context: expected object");
  }
  const ctxKeys = closedKeys(context, CONTEXT_KEYS, "record.context");
  if (!ctxKeys.ok) return ctxKeys;
  const scene = validateCanonicalText(context["scene"], "record.context.scene");
  if (!scene.ok) return scene;
  if (scene.value.length === 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "record.context.scene: must be nonempty");
  }
  const focus = validateRefArray(context["focus_refs"], "record.context.focus_refs");
  if (!focus.ok) return focus;
  const environment = validateRefArray(context["environment_refs"], "record.context.environment_refs");
  if (!environment.ok) return environment;

  let appraisalRef: AppraisalRef | null = null;
  if (v["appraisal_ref"] !== null) {
    const parsed = parseAppraisalRef(v["appraisal_ref"], "record.appraisal_ref");
    if (!parsed.ok) return parsed;
    appraisalRef = parsed.value;
  }

  let affectSnapshotRef: AffectSnapshotRef | null = null;
  if (v["affect_snapshot_ref"] !== null) {
    const parsed = parseAffectSnapshotRef(v["affect_snapshot_ref"], "record.affect_snapshot_ref");
    if (!parsed.ok) return parsed;
    affectSnapshotRef = parsed.value;
  }

  const salience = v["salience"];
  if (!isRecord(salience)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.salience: expected object");
  }
  const salienceKeys = closedKeys(salience, SALIENCE_KEYS, "record.salience");
  if (!salienceKeys.ok) return salienceKeys;
  const declaredScore = salience["declared_score"];
  if (!isNumber(declaredScore)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.salience.declared_score: expected number");
  }
  const scoreCheck = validateUnitInterval(declaredScore, "record.salience.declared_score");
  if (!scoreCheck.ok) return scoreCheck;
  if (salience["source"] !== SALIENCE_SOURCE_ENCODING_DECLARED) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.salience.source: invalid enum");
  }

  return ok({
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: episodeRef.value,
    occurrence_logical_time: occurrence as LogicalTimeV0,
    recorded_at_logical_time: recordedAt as LogicalTimeV0,
    provenance: {
      transition_id: provenance["transition_id"] as TransitionIdV0,
      producer: "memory",
      cause_refs: provenance["cause_refs"] as readonly CanonicalRefV0[]
    },
    references: v["references"] as readonly CanonicalRefV0[],
    context: {
      scene: scene.value,
      focus_refs: context["focus_refs"] as readonly CanonicalRefV0[],
      environment_refs: context["environment_refs"] as readonly CanonicalRefV0[]
    },
    appraisal_ref: appraisalRef,
    affect_snapshot_ref: affectSnapshotRef,
    salience: {
      declared_score: declaredScore as UnitIntervalV0,
      source: SALIENCE_SOURCE_ENCODING_DECLARED
    }
  });
}
