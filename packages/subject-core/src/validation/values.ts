/**
 * P2.1.2 — Canonical value shapes for the 13 writable field paths (pure functions only).
 * Source: docs/implementation/p2-1-contract-freeze.md §6.2 (exact nested types),
 * §6.3 (array semantics), §7.2 (FieldReplacementV0 "value must match the exact path type").
 *
 * One validator per canonical block, shared by SubjectState schema validation and
 * proposal delta-value validation so both accept exactly the same shapes. When a
 * `ShapeContext.logical_time` is supplied (whole-state admission), the §6.2 timestamp
 * invariants relative to canonical logical time are enforced; proposal deltas omit the
 * context because expected-revision/time guards against current state belong to the
 * commit engine (P2.1.3).
 */

import type { AffectChannelId, AffectPhase, RefKind } from "../types/enums.js";
import { fail, ok, type ValidationResult } from "./result.js";
import { validatePersonalityState } from "./subject-state.js";
import {
  isNumber,
  isRecord,
  isString,
  validateCanonicalText,
  validateLogicalTime,
  validateRefArray,
  validateRefElement,
  validateRepositoryRevision,
  validateUnitInterval
} from "./scalars.js";

const SCHEMA = "SS-SCHEMA-001";

/** Frozen code + reason for whole-state cross-field invariant failures (§13.3). */
const INVARIANT_CODE = "INVARIANT_VIOLATION";
const SCHEMA_REASON = "SS-SCHEMA-001";

const AFFECT_CHANNEL_ORDER: readonly AffectChannelId[] = ["anger", "fear", "sadness", "joy"];
const AFFECT_PHASES: readonly AffectPhase[] = ["INACTIVE", "ACTIVE", "RELEASING"];

const FOCUS_REF_KINDS: readonly RefKind[] = ["entity", "subject", "memory", "episode", "observation", "environment"];
const ENTITY_SUBJECT_REF_KINDS: readonly RefKind[] = ["entity", "subject"];

/** Retrieval ring capacity is the schema constant 64 (§6.2), not runtime config. */
export const RETRIEVAL_TRACE_CAPACITY = 64;

export interface ShapeContext {
  /**
   * Canonical `runtime_metadata.logical_time` of the enclosing state. When present,
   * §6.2 "not after logical time" invariants are enforced; absent for delta values.
   */
  readonly logical_time?: number;
}

type Check = ValidationResult<void>;

/** Narrows any typed success result to `void`, preserving the frozen failure payload. */
function asCheck(r: ValidationResult<unknown>): Check {
  return r.ok ? ok(undefined) : fail(r.error.error_code, r.error.reason, r.error.detail);
}

function closedKeys(o: Record<string, unknown>, allowed: readonly string[], d: string): Check {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: unknown key`);
  }
  return ok(undefined);
}

function reqRecord(v: unknown, d: string): ValidationResult<Record<string, unknown>> {
  return isRecord(v) ? ok(v) : fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
}

function lit(v: unknown, want: string | number | boolean, d: string): Check {
  return v === want ? ok(undefined) : fail("INVALID_SCHEMA", SCHEMA, `${d}: expected ${String(want)}`);
}

/** null | FAST_EMA_V0 provenance literal (§6.2). */
function fastEmaOrNull(v: unknown, d: string): Check {
  if (v === null) return ok(undefined);
  return lit(v, "FAST_EMA_V0", d);
}

function unitIntervalField(v: unknown, d: string): Check {
  if (!isNumber(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected number`);
  return asCheck(validateUnitInterval(v, d));
}

function logicalTimeOrNull(v: unknown, d: string, ctx?: ShapeContext, invariantLabel?: string): Check {
  if (v === null) return ok(undefined);
  if (!isNumber(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected logical time or null`);
  const r = validateLogicalTime(v, d);
  if (!r.ok) return r;
  if (ctx?.logical_time !== undefined && invariantLabel !== undefined && v > ctx.logical_time) {
    return fail(INVARIANT_CODE, SCHEMA_REASON, `${d}: ${invariantLabel} after logical_time`);
  }
  return ok(undefined);
}

/**
 * §6.2 MoodV0 — closed `{baseline:[0,0.25], generated_under_profile:"FAST_EMA_V0"|null,
 * last_update:LogicalTime|null}`.
 */
export function validateMoodShape(v: unknown, detail: string, ctx?: ShapeContext): Check {
  const r = reqRecord(v, detail);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["baseline", "generated_under_profile", "last_update"], detail);
  if (!c.ok) return c;
  const baseline = o["baseline"];
  if (!isNumber(baseline)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}.baseline: expected number`);
  if (!Number.isFinite(baseline) || baseline < 0 || baseline > 0.25) {
    return fail("INVALID_VALUE_RANGE", SCHEMA, `${detail}.baseline: not in [0,0.25]`);
  }
  const p = fastEmaOrNull(o["generated_under_profile"], `${detail}.generated_under_profile`);
  if (!p.ok) return p;
  return logicalTimeOrNull(o["last_update"], `${detail}.last_update`, ctx, "mood.last_update");
}

function validateAffectChannel(v: unknown, detail: string, ctx?: ShapeContext): Check {
  const r = reqRecord(v, detail);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(
    o,
    ["channel_id", "intensity", "phase", "started_at", "source_appraisal_ref"],
    detail
  );
  if (!c.ok) return c;
  const cid = o["channel_id"];
  if (!(AFFECT_CHANNEL_ORDER as readonly string[]).includes(cid as string)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}.channel_id: invalid enum`);
  }
  const intensity = unitIntervalField(o["intensity"], `${detail}.intensity`);
  if (!intensity.ok) return intensity;
  if (!(AFFECT_PHASES as readonly string[]).includes(o["phase"] as string)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}.phase: invalid enum`);
  }
  const started = logicalTimeOrNull(o["started_at"], `${detail}.started_at`, ctx, "started_at");
  if (!started.ok) return started;
  return asCheck(
    validateRefElement(o["source_appraisal_ref"], `${detail}.source_appraisal_ref`, ["appraisal"])
  );
}

/**
 * §6.2 AffectV0 — channels unique and ordered by the frozen channel order
 * anger,fear,sadness,joy.
 */
export function validateAffectShape(v: unknown, detail: string, ctx?: ShapeContext): Check {
  const r = reqRecord(v, detail);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["active_channels", "generated_under_profile", "updated_at"], detail);
  if (!c.ok) return c;
  const channels = o["active_channels"];
  if (!Array.isArray(channels)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}.active_channels: expected array`);
  }
  let prevIndex = -1;
  for (let i = 0; i < channels.length; i++) {
    const label = `${detail}.active_channels[${i}]`;
    const ch = validateAffectChannel(channels[i], label, ctx);
    if (!ch.ok) return ch;
    const channelId = (channels[i] as Record<string, unknown>)["channel_id"];
    const index = AFFECT_CHANNEL_ORDER.indexOf(channelId as AffectChannelId);
    if (index <= prevIndex) {
      return fail(
        "INVALID_SCHEMA",
        SCHEMA,
        `${label}: channels must be unique in frozen order anger,fear,sadness,joy`
      );
    }
    prevIndex = index;
  }
  const p = fastEmaOrNull(o["generated_under_profile"], `${detail}.generated_under_profile`);
  if (!p.ok) return p;
  return logicalTimeOrNull(o["updated_at"], `${detail}.updated_at`, ctx, "affect.updated_at");
}

/** §6.2 RegulatoryStateV0 — four `[0,1]` scalars + optional logical timestamp. */
export function validateRegulationShape(v: unknown, detail: string, ctx?: ShapeContext): Check {
  const r = reqRecord(v, detail);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["energy", "stress", "arousal", "fatigue", "last_update"], detail);
  if (!c.ok) return c;
  for (const f of ["energy", "stress", "arousal", "fatigue"] as const) {
    const u = unitIntervalField(o[f], `${detail}.${f}`);
    if (!u.ok) return u;
  }
  return logicalTimeOrNull(o["last_update"], `${detail}.last_update`, ctx, "regulation.last_update");
}

/** §6.2 WorkingContextV0 — all six fields, exact restore semantics. */
export function validateWorkingContextShape(v: unknown, detail: string): Check {
  const r = reqRecord(v, detail);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(
    o,
    ["scene", "task", "focus_refs", "active_entity_refs", "environment_refs", "current_observation_ref"],
    detail
  );
  if (!c.ok) return c;
  const sceneR = validateCanonicalText(o["scene"], `${detail}.scene`);
  if (!sceneR.ok) return sceneR;
  // SC-005: an empty scene violates the frozen nonempty range -> INVALID_VALUE_RANGE.
  if (sceneR.value.length === 0) {
    return fail("INVALID_VALUE_RANGE", SCHEMA, `${detail}.scene: must be nonempty`);
  }
  if (o["task"] !== null) {
    const t = asCheck(validateCanonicalText(o["task"], `${detail}.task`));
    if (!t.ok) return fail("INVALID_SCHEMA", SCHEMA, `${detail}.task: expected canonical text or null`);
  }
  const focus = validateRefArray(o["focus_refs"], `${detail}.focus_refs`, { kinds: FOCUS_REF_KINDS });
  if (!focus.ok) return focus;
  const activeEntities = validateRefArray(o["active_entity_refs"], `${detail}.active_entity_refs`, {
    kinds: ENTITY_SUBJECT_REF_KINDS,
    sorted: true
  });
  if (!activeEntities.ok) return activeEntities;
  const env = validateRefArray(o["environment_refs"], `${detail}.environment_refs`, {
    kinds: ["environment"],
    sorted: true
  });
  if (!env.ok) return env;
  if (o["current_observation_ref"] !== null) {
    return asCheck(
      validateRefElement(o["current_observation_ref"], `${detail}.current_observation_ref`, [
        "observation"
      ])
    );
  }
  return ok(undefined);
}

/** §6.2 memory_state.working_refs — ordered retrieval rank, kinds memory|episode|event. */
export function validateWorkingRefsShape(v: unknown, detail: string): Check {
  return validateRefArray(v, detail, { kinds: ["memory", "episode", "event"] });
}

/** §6.2 recent_retrieval_trace — oldest->newest ring of retrieval-trace refs, length <= 64. */
export function validateRetrievalTraceShape(v: unknown, detail: string): Check {
  const arr = validateRefArray(v, detail, { kinds: ["retrieval-trace"] });
  if (!arr.ok) return arr;
  if (Array.isArray(v) && v.length > RETRIEVAL_TRACE_CAPACITY) {
    return fail("INVALID_VALUE_RANGE", SCHEMA, `${detail}: ring length exceeds ${RETRIEVAL_TRACE_CAPACITY}`);
  }
  return ok(undefined);
}

/** §6.2 last_retrieval_at — LogicalTime|null, not after canonical logical time. */
export function validateLastRetrievalAtShape(v: unknown, detail: string, ctx?: ShapeContext): Check {
  return logicalTimeOrNull(v, detail, ctx, "last_retrieval_at");
}

/** §6.2 active_episode_refs — ordered chronology of episode refs. */
export function validateActiveEpisodeRefsShape(v: unknown, detail: string): Check {
  return validateRefArray(v, detail, { kinds: ["episode"] });
}

/** §6.2 autobiographical_index_revision — RepositoryRevisionIdV0|null. */
export function validateAutobiographicalIndexRevisionShape(v: unknown, detail: string): Check {
  if (v === null) return ok(undefined);
  if (!isString(v)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}: expected repository revision or null`);
  }
  return asCheck(validateRepositoryRevision(v, detail));
}

/** §6.2 repository_revision — required RepositoryRevisionIdV0 (capability-valid via L3). */
export function validateRepositoryRevisionShape(v: unknown, detail: string): Check {
  if (!isString(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: expected repository revision`);
  return asCheck(validateRepositoryRevision(v, detail));
}

/** §6.2 consolidation_cursor — LogicalTime|null, monotonic and not after logical time. */
export function validateConsolidationCursorShape(v: unknown, detail: string, ctx?: ShapeContext): Check {
  return logicalTimeOrNull(v, detail, ctx, "consolidation_cursor");
}

/** §6.2 lifecycle_metadata / feature_flags / thresholds — EmptyClosedObjectV0 (zero keys). */
export function validateEmptyClosedObjectShape(v: unknown, detail: string): Check {
  const r = reqRecord(v, detail);
  if (!r.ok) return r;
  if (Object.keys(r.value).length !== 0) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}: EmptyClosedObjectV0 must have zero keys`);
  }
  return ok(undefined);
}

/** §6.2 pending_encoding_refs — ordered insertion queue of experience refs. */
export function validatePendingEncodingRefsShape(v: unknown, detail: string): Check {
  return validateRefArray(v, detail, { kinds: ["experience"] });
}

/**
 * §7.2 FieldReplacementV0 dispatch: the `value` of an operation must match the exact
 * type registered for its writable path. Unknown paths are rejected before this
 * dispatcher by ownership classification.
 */
export function validateFieldValueForPath(
  path: string,
  v: unknown,
  detail: string,
  ctx?: ShapeContext
): Check {
  switch (path) {
    case "/mood":
      return validateMoodShape(v, detail, ctx);
    case "/affect":
      return validateAffectShape(v, detail, ctx);
    case "/regulation":
      return validateRegulationShape(v, detail, ctx);
    case "/context":
      return validateWorkingContextShape(v, detail);
    case "/memory_state/working_refs":
      return validateWorkingRefsShape(v, detail);
    case "/memory_state/recent_retrieval_trace":
      return validateRetrievalTraceShape(v, detail);
    case "/memory_state/last_retrieval_at":
      return validateLastRetrievalAtShape(v, detail, ctx);
    case "/memory_state/active_episode_refs":
      return validateActiveEpisodeRefsShape(v, detail);
    case "/memory_state/autobiographical_index_revision":
      return validateAutobiographicalIndexRevisionShape(v, detail);
    case "/memory_state/repository_revision":
      return validateRepositoryRevisionShape(v, detail);
    case "/memory_state/consolidation_cursor":
      return validateConsolidationCursorShape(v, detail, ctx);
    case "/personality":
      return validatePersonalityState(v, detail);
    case "/memory_state/lifecycle_metadata":
      return validateEmptyClosedObjectShape(v, detail);
    case "/memory_state/pending_encoding_refs":
      return validatePendingEncodingRefsShape(v, detail);
    default:
      return fail("INVALID_SCHEMA", SCHEMA, `${detail}: unknown writable path ${path}`);
  }
}
