/**
 * P2.1.2 — SubjectStateV0 schema validator (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §4.2 (golden S0), §5.1 (global
 * rules), §6.1–§6.3 (exact catalog), §10.3 (trace window frozen invariants).
 *
 * Enforced here: required fields, closed objects (unknown keys reject), scalar/range,
 * enum, branded identifier format, canonical NFC text, duplicate rejection, set-like
 * sortedness, §6.2 cross-field timestamp invariants relative to `logical_time`, and the
 * internal §10.3 trace window/cursor linkage invariants.
 *
 * Not enforced here (fail-closed boundaries): repository-reference existence and
 * envelope checksums/hash recomputation belong to restore/ReferenceValidator (P2.1.3+
 * capabilities), never to this pure layer.
 *
 * Deterministic order: `runtime_metadata` is admitted first because every §6.2
 * timestamp invariant of the other blocks is defined relative to its `logical_time`;
 * remaining blocks follow the §6.1 catalog order. On success the input is returned
 * narrowed to SubjectStateV0 via one guarded cast after full structural validation.
 * No mutation, no persistence, no domain logic.
 */

import type { SubjectStateV0 } from "../types/subject-state.js";
import type { TransitionType } from "../types/enums.js";
import type { RefKind } from "../types/enums.js";
import {
  isNumber,
  isRecord,
  isString,
  validateCanonicalText,
  validateHash,
  validateHistorySequence,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateRefElement,
  validateRepositoryRevision,
  validateStateRevision,
  validateUnitInterval
} from "./scalars.js";
import { fail, ok, type ValidationResult } from "./result.js";
import {
  RETRIEVAL_TRACE_CAPACITY,
  validateAffectShape,
  validateAutobiographicalIndexRevisionShape,
  validateConsolidationCursorShape,
  validateEmptyClosedObjectShape,
  validateLastRetrievalAtShape,
  validateMoodShape,
  validatePendingEncodingRefsShape,
  validateRegulationShape,
  validateRetrievalTraceShape,
  validateRepositoryRevisionShape,
  validateWorkingContextShape,
  validateWorkingRefsShape,
  validateActiveEpisodeRefsShape
} from "./values.js";

const SCHEMA = "SS-SCHEMA-001";
/** Frozen code + reason mapping for internal trace linkage violations (§13.3). */
const TRACE_CODE = "TRACE_INTEGRITY_FAILURE";
const TRACE_REASON = "TRACE-CONTENT-001";

const TRANSITION_TYPES: readonly TransitionType[] = [
  "Time",
  "Observation",
  "CognitionAction",
  "Learning",
  "Personality",
  "Relationship"
];

/** §10.2 exact lexicographically sorted constant rule_ids set for every V0 TraceEntry. */
const EXACT_RULE_IDS: readonly string[] = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

const TRACE_LAYERS: readonly string[] = [
  "mood",
  "affect",
  "regulation",
  "context",
  "memory_state",
  "personality",
  "relationships"
];
const DOMAIN_NAMES: readonly string[] = [
  "affect",
  "context",
  "memory-content",
  "memory-retrieval",
  "regulation",
  "personality",
  "relationship"
];

const TRAIT_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const FORBIDDEN_TRAIT_KEYS: readonly string[] = ["trust", "fear", "attachment"];

const BELIEF_REF_KINDS: readonly RefKind[] = ["memory", "episode", "observation", "source"];

type Check = ValidationResult<void>;

/** Narrows any typed success result to `void`, preserving the frozen failure payload. */
function asCheck(r: ValidationResult<unknown>): Check {
  return r.ok ? ok(undefined) : fail(r.error.error_code, r.error.reason, r.error.detail);
}

function reqRecord(v: unknown, d: string): ValidationResult<Record<string, unknown>> {
  return isRecord(v) ? ok(v) : fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
}

function reqArray(v: unknown, d: string): ValidationResult<unknown[]> {
  return Array.isArray(v) ? ok(v) : fail("INVALID_SCHEMA", SCHEMA, `${d}: expected array`);
}

function lit(v: unknown, want: string | number | boolean, d: string): Check {
  return v === want ? ok(undefined) : fail("INVALID_SCHEMA", SCHEMA, `${d}: expected ${String(want)}`);
}

function oneOf(v: unknown, set: readonly string[], d: string): Check {
  return typeof v === "string" && set.includes(v)
    ? ok(undefined)
    : fail("INVALID_SCHEMA", SCHEMA, `${d}: invalid enum`);
}

function closedKeys(o: Record<string, unknown>, allowed: readonly string[], d: string): Check {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: unknown key`);
  }
  return ok(undefined);
}

function scalarField(
  v: unknown,
  d: string,
  f: (value: number, detail: string) => ValidationResult<number>
): Check {
  if (!isNumber(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected number`);
  return asCheck(f(v, d));
}

/** Unique ordered array of canonical NFC strings (§6.2 identity_anchors). */
function validateAnchorArray(v: unknown, d: string): Check {
  const a = reqArray(v, d);
  if (!a.ok) return a;
  let prev: string | undefined;
  for (let i = 0; i < a.value.length; i++) {
    const label = `${d}[${i}]`;
    const s = validateCanonicalText(a.value[i], label);
    if (!s.ok) return s;
    if (prev !== undefined && s.value === prev) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}: duplicate anchor`);
    }
    prev = s.value;
  }
  return ok(undefined);
}

interface RuntimeMetadataValues {
  readonly state_revision: number;
  readonly logical_time: number;
}

function validateRuntimeMetadata(v: unknown, d: string): ValidationResult<RuntimeMetadataValues> {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(
    o,
    [
      "subject_version",
      "state_revision",
      "logical_time",
      "last_transition_time",
      "last_transition_type",
      "created_at",
      "updated_at"
    ],
    d
  );
  if (!c.ok) return c;
  const sv = lit(o["subject_version"], "subject-v0", `${d}.subject_version`);
  if (!sv.ok) return sv;
  const rev = scalarField(o["state_revision"], `${d}.state_revision`, validateStateRevision);
  if (!rev.ok) return rev;
  const lt = scalarField(o["logical_time"], `${d}.logical_time`, validateLogicalTime);
  if (!lt.ok) return lt;
  const ca = scalarField(o["created_at"], `${d}.created_at`, validateLogicalTime);
  if (!ca.ok) return ca;
  const ua = scalarField(o["updated_at"], `${d}.updated_at`, validateLogicalTime);
  if (!ua.ok) return ua;
  const lastT = o["last_transition_time"];
  if (lastT !== null) {
    const t = scalarField(lastT, `${d}.last_transition_time`, validateLogicalTime);
    if (!t.ok) return t;
  }
  if (o["last_transition_type"] !== null) {
    const ty = oneOf(o["last_transition_type"], TRANSITION_TYPES, `${d}.last_transition_type`);
    if (!ty.ok) return ty;
  }

  // §6.2 cross-field invariants over the captured scalars.
  const revision = o["state_revision"] as number;
  const logicalTime = o["logical_time"] as number;
  const createdAt = o["created_at"] as number;
  const updatedAt = o["updated_at"] as number;
  if (!(createdAt <= updatedAt && updatedAt <= logicalTime)) {
    return fail(
      "INVARIANT_VIOLATION",
      SCHEMA,
      `${d}: requires created_at <= updated_at <= logical_time`
    );
  }
  if (revision === 0) {
    if (lastT !== null) {
      return fail("INVARIANT_VIOLATION", SCHEMA, `${d}.last_transition_time must be null at revision 0`);
    }
  } else {
    if (lastT === null) {
      return fail(
        "INVARIANT_VIOLATION",
        SCHEMA,
        `${d}.last_transition_time must be non-null after revision 0`
      );
    }
    if ((lastT as number) > logicalTime) {
      return fail("INVARIANT_VIOLATION", SCHEMA, `${d}.last_transition_time after logical_time`);
    }
  }
  return ok({ state_revision: revision, logical_time: logicalTime });
}

function validateIdentity(v: unknown, d: string): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(
    o,
    ["subject_id", "display_name", "origin_metadata", "identity_anchors", "self_schema_seed_refs"],
    d
  );
  if (!c.ok) return c;
  if (!isString(o["subject_id"])) return fail("INVALID_SCHEMA", SCHEMA, `${d}.subject_id: expected identifier`);
  const sid = validateIdentifier(o["subject_id"], `${d}.subject_id`);
  if (!sid.ok) return sid;
  const dn = validateCanonicalText(o["display_name"], `${d}.display_name`);
  if (!dn.ok) return dn;
  const om = reqRecord(o["origin_metadata"], `${d}.origin_metadata`);
  if (!om.ok) return om;
  const omc = closedKeys(om.value, ["creation_source", "seed_version"], `${d}.origin_metadata`);
  if (!omc.ok) return omc;
  if (om.value["creation_source"] !== null) {
    if (!isString(om.value["creation_source"])) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.origin_metadata.creation_source: expected identifier or null`);
    }
    const cs = validateIdentifier(om.value["creation_source"], `${d}.origin_metadata.creation_source`);
    if (!cs.ok) return cs;
  }
  if (om.value["seed_version"] !== null) {
    if (!isString(om.value["seed_version"])) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.origin_metadata.seed_version: expected identifier or null`);
    }
    const se = validateIdentifier(om.value["seed_version"], `${d}.origin_metadata.seed_version`);
    if (!se.ok) return se;
  }
  const anchors = validateAnchorArray(o["identity_anchors"], `${d}.identity_anchors`);
  if (!anchors.ok) return anchors;
  return validateRefArray(o["self_schema_seed_refs"], `${d}.self_schema_seed_refs`, {
    kinds: ["seed-schema"],
    sorted: true
  });
}

function validateTraitsSeed(v: unknown, d: string): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["dimensions"], d);
  if (!c.ok) return c;
  const dims = reqRecord(o["dimensions"], `${d}.dimensions`);
  if (!dims.ok) return dims;
  for (const key of Object.keys(dims.value)) {
    const label = `${d}.dimensions.${key}`;
    if (FORBIDDEN_TRAIT_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}: reserved key`);
    }
    if (!TRAIT_KEY_RE.test(key)) return fail("INVALID_SCHEMA", SCHEMA, `${label}: key format`);
    const val = dims.value[key];
    if (!isNumber(val)) return fail("INVALID_SCHEMA", SCHEMA, `${label}: expected number`);
    const u = validateUnitInterval(val, label);
    if (!u.ok) return u;
  }
  return ok(undefined);
}

function validateMemoryState(v: unknown, d: string, logicalTime: number): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(
    o,
    [
      "working_refs",
      "active_episode_refs",
      "autobiographical_index_revision",
      "repository_revision",
      "consolidation_cursor",
      "retrieval_config",
      "recent_retrieval_trace",
      "lifecycle_metadata",
      "pending_encoding_refs",
      "last_retrieval_at"
    ],
    d
  );
  if (!c.ok) return c;
  const ctx = { logical_time: logicalTime };
  const checks: readonly [string, unknown, (vv: unknown, dd: string, cc?: typeof ctx) => Check][] = [
    ["working_refs", o["working_refs"], (vv, dd) => validateWorkingRefsShape(vv, dd)],
    [
      "active_episode_refs",
      o["active_episode_refs"],
      (vv, dd) => validateActiveEpisodeRefsShape(vv, dd)
    ],
    [
      "autobiographical_index_revision",
      o["autobiographical_index_revision"],
      (vv, dd) => validateAutobiographicalIndexRevisionShape(vv, dd)
    ],
    [
      "repository_revision",
      o["repository_revision"],
      (vv, dd) => validateRepositoryRevisionShape(vv, dd)
    ],
    [
      "consolidation_cursor",
      o["consolidation_cursor"],
      (vv, dd, cc) => validateConsolidationCursorShape(vv, dd, cc)
    ],
    [
      "recent_retrieval_trace",
      o["recent_retrieval_trace"],
      (vv, dd) => validateRetrievalTraceShape(vv, dd)
    ],
    [
      "lifecycle_metadata",
      o["lifecycle_metadata"],
      (vv, dd) => validateEmptyClosedObjectShape(vv, dd)
    ],
    [
      "pending_encoding_refs",
      o["pending_encoding_refs"],
      (vv, dd) => validatePendingEncodingRefsShape(vv, dd)
    ],
    [
      "last_retrieval_at",
      o["last_retrieval_at"],
      (vv, dd, cc) => validateLastRetrievalAtShape(vv, dd, cc)
    ]
  ];
  for (const [name, value, fn] of checks) {
    const res = fn(value, `${d}.${name}`, ctx);
    if (!res.ok) return res;
  }
  // retrieval_config — closed init-only object (§6.2).
  const rc = reqRecord(o["retrieval_config"], `${d}.retrieval_config`);
  if (!rc.ok) return rc;
  const rcc = closedKeys(
    rc.value,
    ["profile_id", "affect_congruence_enabled", "recent_trace_capacity"],
    `${d}.retrieval_config`
  );
  if (!rcc.ok) return rcc;
  const p = lit(rc.value["profile_id"], "RETRIEVAL_V0", `${d}.retrieval_config.profile_id`);
  if (!p.ok) return p;
  const a = lit(rc.value["affect_congruence_enabled"], false, `${d}.retrieval_config.affect_congruence_enabled`);
  if (!a.ok) return a;
  return lit(rc.value["recent_trace_capacity"], 64, `${d}.retrieval_config.recent_trace_capacity`);
}

function validateBeliefs(v: unknown, d: string): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["items"], d);
  if (!c.ok) return c;
  const items = reqArray(o["items"], `${d}.items`);
  if (!items.ok) return items;
  let prevRef: string | undefined;
  for (let i = 0; i < items.value.length; i++) {
    const label = `${d}.items[${i}]`;
    const ir = reqRecord(items.value[i], label);
    if (!ir.ok) return ir;
    const ic = closedKeys(ir.value, ["ref", "summary"], label);
    if (!ic.ok) return ic;
    const refR = validateRefElement(ir.value["ref"], `${label}.ref`, BELIEF_REF_KINDS);
    if (!refR.ok) return refR;
    if (prevRef !== undefined) {
      if (refR.value === prevRef) return fail("INVALID_SCHEMA", SCHEMA, `${label}.ref: duplicate belief item`);
      if (refR.value < prevRef) {
        return fail("INVALID_SCHEMA", SCHEMA, `${label}.ref: items not sorted by ref`);
      }
    }
    prevRef = refR.value;
    if (ir.value["summary"] !== null) {
      const s = asCheck(validateCanonicalText(ir.value["summary"], `${label}.summary`));
      if (!s.ok) return fail("INVALID_SCHEMA", SCHEMA, `${label}.summary: expected canonical text or null`);
    }
  }
  return ok(undefined);
}

/**
 * RelationshipState V0 validation for SubjectState V2. The container is closed,
 * counterpart membership is explicit and canonical-ref sorted, and dimensions
 * are registered, unique, raw-ASCII sorted UnitInterval values.
 */
export function validateRelationshipState(v: unknown, d: string): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["schema_version", "counterparts"], d);
  if (!c.ok) return c;
  const sv = lit(o["schema_version"], "relationship-state-v0", `${d}.schema_version`);
  if (!sv.ok) return sv;
  const counterparts = reqArray(o["counterparts"], `${d}.counterparts`);
  if (!counterparts.ok) return counterparts;
  let previousCounterpartRef: string | undefined;
  for (let i = 0; i < counterparts.value.length; i++) {
    const label = `${d}.counterparts[${i}]`;
    const counterpart = reqRecord(counterparts.value[i], label);
    if (!counterpart.ok) return counterpart;
    const counterpartKeys = closedKeys(
      counterpart.value,
      ["counterpart_ref", "dimensions"],
      label
    );
    if (!counterpartKeys.ok) return counterpartKeys;
    const counterpartRef = validateRefElement(
      counterpart.value["counterpart_ref"],
      `${label}.counterpart_ref`,
      ["entity", "subject"]
    );
    if (!counterpartRef.ok) return counterpartRef;
    if (previousCounterpartRef !== undefined) {
      if (counterpartRef.value === previousCounterpartRef) {
        return fail("INVALID_SCHEMA", SCHEMA, `${label}.counterpart_ref: duplicate counterpart`);
      }
      if (counterpartRef.value < previousCounterpartRef) {
        return fail(
          "INVALID_SCHEMA",
          SCHEMA,
          `${label}.counterpart_ref: counterparts not raw-canonical-ref sorted`
        );
      }
    }
    previousCounterpartRef = counterpartRef.value;

    const dimensions = reqArray(counterpart.value["dimensions"], `${label}.dimensions`);
    if (!dimensions.ok) return dimensions;
    let previousDimensionId: string | undefined;
    for (let j = 0; j < dimensions.value.length; j++) {
      const dimensionLabel = `${label}.dimensions[${j}]`;
      const dimension = reqRecord(dimensions.value[j], dimensionLabel);
      if (!dimension.ok) return dimension;
      const dimensionKeys = closedKeys(
        dimension.value,
        ["dimension_id", "value"],
        dimensionLabel
      );
      if (!dimensionKeys.ok) return dimensionKeys;
      if (!isString(dimension.value["dimension_id"])) {
        return fail(
          "INVALID_SCHEMA",
          SCHEMA,
          `${dimensionLabel}.dimension_id: expected identifier`
        );
      }
      const dimensionId = validateIdentifier(
        dimension.value["dimension_id"],
        `${dimensionLabel}.dimension_id`
      );
      if (!dimensionId.ok) return dimensionId;
      if (previousDimensionId !== undefined) {
        if (dimensionId.value === previousDimensionId) {
          return fail("INVALID_SCHEMA", SCHEMA, `${dimensionLabel}.dimension_id: duplicate dimension`);
        }
        if (dimensionId.value < previousDimensionId) {
          return fail(
            "INVALID_SCHEMA",
            SCHEMA,
            `${dimensionLabel}.dimension_id: dimensions not raw-ASCII-sorted`
          );
        }
      }
      previousDimensionId = dimensionId.value;
      if (!isNumber(dimension.value["value"])) {
        return fail("INVALID_SCHEMA", SCHEMA, `${dimensionLabel}.value: expected number`);
      }
      const value = validateUnitInterval(
        dimension.value["value"],
        `${dimensionLabel}.value`
      );
      if (!value.ok) return value;
    }
  }
  return ok(undefined);
}

function validateMechanismConfig(v: unknown, d: string): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(
    o,
    ["affect_profile", "legacy_reference_defaults", "feature_flags", "thresholds"],
    d
  );
  if (!c.ok) return c;
  const ap = reqRecord(o["affect_profile"], `${d}.affect_profile`);
  if (!ap.ok) return ap;
  const apc = closedKeys(ap.value, ["profile_id", "timebase"], `${d}.affect_profile`);
  if (!apc.ok) return apc;
  const p1 = lit(ap.value["profile_id"], "FAST_EMA_V0", `${d}.affect_profile.profile_id`);
  if (!p1.ok) return p1;
  const p2 = lit(ap.value["timebase"], "legacy_tick", `${d}.affect_profile.timebase`);
  if (!p2.ok) return p2;
  const lrd = reqRecord(o["legacy_reference_defaults"], `${d}.legacy_reference_defaults`);
  if (!lrd.ok) return lrd;
  const lrdc = closedKeys(
    lrd.value,
    ["tHold", "alpha", "tau", "clamp"],
    `${d}.legacy_reference_defaults`
  );
  if (!lrdc.ok) return lrdc;
  const d1 = lit(lrd.value["tHold"], 60, `${d}.legacy_reference_defaults.tHold`);
  if (!d1.ok) return d1;
  const d2 = lit(lrd.value["alpha"], 0.06, `${d}.legacy_reference_defaults.alpha`);
  if (!d2.ok) return d2;
  const d3 = lit(lrd.value["tau"], 150, `${d}.legacy_reference_defaults.tau`);
  if (!d3.ok) return d3;
  const d4 = lit(lrd.value["clamp"], 0.25, `${d}.legacy_reference_defaults.clamp`);
  if (!d4.ok) return d4;
  const ff = validateEmptyClosedObjectShape(o["feature_flags"], `${d}.feature_flags`);
  if (!ff.ok) return ff;
  return validateEmptyClosedObjectShape(o["thresholds"], `${d}.thresholds`);
}

function validateDomainMutationSummary(v: unknown, d: string): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["producer", "domain", "layers", "field_changes"], d);
  if (!c.ok) return c;
  if (!isString(o["producer"])) return fail("INVALID_SCHEMA", SCHEMA, `${d}.producer: expected identifier`);
  const prod = validateIdentifier(o["producer"], `${d}.producer`);
  if (!prod.ok) return prod;
  const dom = oneOf(o["domain"], DOMAIN_NAMES, `${d}.domain`);
  if (!dom.ok) return dom;
  const layers = reqArray(o["layers"], `${d}.layers`);
  if (!layers.ok) return layers;
  if (layers.value.length === 0) return fail("INVALID_SCHEMA", SCHEMA, `${d}.layers: nonempty`);
  let prevLayer: string | undefined;
  for (let i = 0; i < layers.value.length; i++) {
    const label = `${d}.layers[${i}]`;
    if (!isString(layers.value[i]) || !(TRACE_LAYERS as readonly string[]).includes(layers.value[i] as string)) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}: invalid trace layer`);
    }
    const layer = layers.value[i] as string;
    if (prevLayer !== undefined) {
      if (layer === prevLayer) return fail("INVALID_SCHEMA", SCHEMA, `${label}: duplicate layer`);
      if (layer < prevLayer) return fail("INVALID_SCHEMA", SCHEMA, `${label}: layers not raw-ASCII-sorted`);
    }
    prevLayer = layer;
  }
  const fcs = reqArray(o["field_changes"], `${d}.field_changes`);
  if (!fcs.ok) return fcs;
  if (fcs.value.length === 0) return fail("INVALID_SCHEMA", SCHEMA, `${d}.field_changes: nonempty`);
  let prevPath: string | undefined;
  for (let i = 0; i < fcs.value.length; i++) {
    const label = `${d}.field_changes[${i}]`;
    const fr = reqRecord(fcs.value[i], label);
    if (!fr.ok) return fr;
    const fc = closedKeys(fr.value, ["path", "operation"], label);
    if (!fc.ok) return fc;
    const path = fr.value["path"];
    if (typeof path !== "string" || !isWritablePathLiteral(path)) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.path: unknown writable path`);
    }
    const op = lit(fr.value["operation"], "SET", `${label}.operation`);
    if (!op.ok) return op;
    if (prevPath !== undefined) {
      if (path === prevPath) return fail("INVALID_SCHEMA", SCHEMA, `${label}.path: duplicate field change`);
      if (path < prevPath) return fail("INVALID_SCHEMA", SCHEMA, `${label}.path: changes not sorted by path`);
    }
    prevPath = path;
  }
  return ok(undefined);
}

/** The 15 writable FieldReplacementV0 literals (V2: +relationship authority). */
const WRITABLE_PATHS: readonly string[] = [
  "/mood",
  "/affect",
  "/regulation",
  "/context",
  "/personality",
  "/relationships",
  "/memory_state/working_refs",
  "/memory_state/recent_retrieval_trace",
  "/memory_state/last_retrieval_at",
  "/memory_state/active_episode_refs",
  "/memory_state/autobiographical_index_revision",
  "/memory_state/repository_revision",
  "/memory_state/consolidation_cursor",
  "/memory_state/lifecycle_metadata",
  "/memory_state/pending_encoding_refs"
];

function isWritablePathLiteral(p: string): boolean {
  return WRITABLE_PATHS.includes(p);
}

function validateTraceEntry(v: unknown, d: string): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(
    o,
    [
      "trace_schema_version",
      "trace_id",
      "history_sequence",
      "transition_id",
      "transition_type",
      "subject_id",
      "subject_revision_before",
      "subject_revision_after",
      "logical_time",
      "rule_ids",
      "cause_refs",
      "proposal_ref",
      "domain_mutations",
      "state_hash_before",
      "state_hash_after",
      "memory_revision_before",
      "memory_revision_after",
      "outcome"
    ],
    d
  );
  if (!c.ok) return c;
  const sv = lit(o["trace_schema_version"], "trace-v1", `${d}.trace_schema_version`);
  if (!sv.ok) return sv;
  const tid = validateRefElement(o["trace_id"], `${d}.trace_id`, ["trace"]);
  if (!tid.ok) return tid;
  const hs = scalarField(o["history_sequence"], `${d}.history_sequence`, validateHistorySequence);
  if (!hs.ok) return hs;
  if (!isString(o["transition_id"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_id: expected identifier`);
  }
  const trid = validateIdentifier(o["transition_id"], `${d}.transition_id`);
  if (!trid.ok) return trid;
  const tt = oneOf(o["transition_type"], TRANSITION_TYPES, `${d}.transition_type`);
  if (!tt.ok) return tt;
  if (!isString(o["subject_id"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.subject_id: expected identifier`);
  }
  const sid = validateIdentifier(o["subject_id"], `${d}.subject_id`);
  if (!sid.ok) return sid;
  const rb = scalarField(o["subject_revision_before"], `${d}.subject_revision_before`, validateStateRevision);
  if (!rb.ok) return rb;
  const ra = scalarField(o["subject_revision_after"], `${d}.subject_revision_after`, validateStateRevision);
  if (!ra.ok) return ra;
  const lt = scalarField(o["logical_time"], `${d}.logical_time`, validateLogicalTime);
  if (!lt.ok) return lt;
  // §10.2: after = before + 1 and history_sequence equals subject_revision_after in V0.
  if ((o["subject_revision_after"] as number) !== (o["subject_revision_before"] as number) + 1) {
    return fail("INVARIANT_VIOLATION", SCHEMA, `${d}: subject_revision_after must equal before + 1`);
  }
  if ((o["history_sequence"] as number) !== (o["subject_revision_after"] as number)) {
    return fail("INVARIANT_VIOLATION", SCHEMA, `${d}: history_sequence must equal subject_revision_after`);
  }
  // §10.2: rule_ids is exactly the sorted constant set.
  const ruleIds = o["rule_ids"];
  if (!Array.isArray(ruleIds) || ruleIds.length !== EXACT_RULE_IDS.length) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.rule_ids: must be the exact V0 constant set`);
  }
  for (let i = 0; i < ruleIds.length; i++) {
    if (ruleIds[i] !== EXACT_RULE_IDS[i]) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.rule_ids: must be the exact sorted constant set`);
    }
  }
  const cause = validateRefArray(o["cause_refs"], `${d}.cause_refs`, { sorted: true });
  if (!cause.ok) return cause;
  const pref = validateRefElement(o["proposal_ref"], `${d}.proposal_ref`, ["proposal"]);
  if (!pref.ok) return pref;
  const muts = reqArray(o["domain_mutations"], `${d}.domain_mutations`);
  if (!muts.ok) return muts;
  if (muts.value.length === 0) return fail("INVALID_SCHEMA", SCHEMA, `${d}.domain_mutations: nonempty`);
  let prevKey: string | undefined;
  let sawMemoryDomain = false;
  for (let i = 0; i < muts.value.length; i++) {
    const label = `${d}.domain_mutations[${i}]`;
    const m = validateDomainMutationSummary(muts.value[i], label);
    if (!m.ok) return m;
    const rec = muts.value[i] as Record<string, unknown>;
    const domain = rec["domain"] as string;
    if (domain === "memory-content" || domain === "memory-retrieval") sawMemoryDomain = true;
    // §10.2: summaries sort by raw ASCII (domain, producer); pairs are unique.
    const key = `${domain}\u0000${rec["producer"] as string}`;
    if (prevKey !== undefined) {
      if (key === prevKey) {
        return fail("DOMAIN_DELTA_CONFLICT", "TR-CONFLICT-001", `${label}: duplicate (domain,producer) summary`);
      }
      if (key < prevKey) {
        return fail("INVALID_SCHEMA", SCHEMA, `${label}: summaries not sorted by (domain,producer)`);
      }
    }
    prevKey = key;
  }
  if (!isString(o["state_hash_before"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.state_hash_before: expected hash string`);
  }
  const hb = validateHash(o["state_hash_before"], `${d}.state_hash_before`);
  if (!hb.ok) return hb;
  if (!isString(o["state_hash_after"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.state_hash_after: expected hash string`);
  }
  const ha = validateHash(o["state_hash_after"], `${d}.state_hash_after`);
  if (!ha.ok) return ha;
  if (!isString(o["memory_revision_before"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.memory_revision_before: expected repository revision`);
  }
  const mrb = validateRepositoryRevision(o["memory_revision_before"], `${d}.memory_revision_before`);
  if (!mrb.ok) return mrb;
  if (!isString(o["memory_revision_after"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.memory_revision_after: expected repository revision`);
  }
  const mra = validateRepositoryRevision(o["memory_revision_after"], `${d}.memory_revision_after`);
  if (!mra.ok) return mra;
  if (!sawMemoryDomain && o["memory_revision_before"] !== o["memory_revision_after"]) {
    return fail("INVARIANT_VIOLATION", SCHEMA, `${d}: memory revisions must be equal for non-memory commits`);
  }
  return lit(o["outcome"], "COMMITTED", `${d}.outcome`);
}

function validateTraceWindow(v: unknown, d: string, stateRevision: number): Check {
  const r = reqRecord(v, d);
  if (!r.ok) return r;
  const o = r.value;
  const c = closedKeys(o, ["trace_window_schema_version", "capacity", "cursor", "entries"], d);
  if (!c.ok) return c;
  const v1 = lit(o["trace_window_schema_version"], "trace-window-v1", `${d}.trace_window_schema_version`);
  if (!v1.ok) return v1;
  const cap = lit(o["capacity"], 64, `${d}.capacity`);
  if (!cap.ok) return cap;
  const cursorR = reqRecord(o["cursor"], `${d}.cursor`);
  if (!cursorR.ok) return cursorR;
  const cu = cursorR.value;
  const cuc = closedKeys(
    cu,
    ["last_history_sequence", "offloaded_through_sequence", "offloaded_through_trace_ref"],
    `${d}.cursor`
  );
  if (!cuc.ok) return cuc;
  const lastSeq = scalarField(
    cu["last_history_sequence"],
    `${d}.cursor.last_history_sequence`,
    (n: number, dd: string) =>
      n >= 0 && Number.isSafeInteger(n) ? ok(n) : fail("INVALID_SCHEMA", SCHEMA, `${dd}: safe integer`)
  );
  if (!lastSeq.ok) return lastSeq;
  const offSeq = scalarField(
    cu["offloaded_through_sequence"],
    `${d}.cursor.offloaded_through_sequence`,
    (n: number, dd: string) =>
      n >= 0 && Number.isSafeInteger(n) ? ok(n) : fail("INVALID_SCHEMA", SCHEMA, `${dd}: safe integer`)
  );
  if (!offSeq.ok) return offSeq;
  const offRef = cu["offloaded_through_trace_ref"];
  if (offRef !== null) {
    const orf = validateRefElement(offRef, `${d}.cursor.offloaded_through_trace_ref`, ["trace"]);
    if (!orf.ok) return orf;
  }
  const entries = reqArray(o["entries"], `${d}.entries`);
  if (!entries.ok) return entries;

  // §10.3 invariant 3: cursor.last_history_sequence == runtime_metadata.state_revision.
  if ((cu["last_history_sequence"] as number) !== stateRevision) {
    return fail(
      TRACE_CODE,
      TRACE_REASON,
      `${d}.cursor.last_history_sequence must equal runtime_metadata.state_revision`
    );
  }

  // §10.3 invariant 6: entries empty iff revision 0.
  if (entries.value.length === 0) {
    if (stateRevision !== 0) {
      return fail(TRACE_CODE, TRACE_REASON, `${d}.entries must be nonempty for revision > 0`);
    }
    if (
      (cu["last_history_sequence"] as number) !== 0 ||
      (cu["offloaded_through_sequence"] as number) !== 0 ||
      cu["offloaded_through_trace_ref"] !== null
    ) {
      return fail(TRACE_CODE, TRACE_REASON, `${d}.cursor must be exactly 0/0/null at revision 0`);
    }
    return ok(undefined);
  }

  // §10.3 invariant 4: bounded newest window, strictly ascending contiguous sequences.
  const capacityBound = Math.min(stateRevision, 64);
  if (entries.value.length !== capacityBound) {
    return fail(
      TRACE_CODE,
      TRACE_REASON,
      `${d}.entries must contain exactly min(state_revision, 64) committed entries`
    );
  }
  let prevSeq = cu["offloaded_through_sequence"] as number;
  for (let i = 0; i < entries.value.length; i++) {
    const e = validateTraceEntry(entries.value[i], `${d}.entries[${i}]`);
    if (!e.ok) return e;
    const seq = (entries.value[i] as Record<string, unknown>)["history_sequence"] as number;
    if (seq !== prevSeq + 1) {
      return fail(
        TRACE_CODE,
        TRACE_REASON,
        `${d}.entries must be strictly ascending and contiguous by history sequence`
      );
    }
    prevSeq = seq;
  }
  if (prevSeq !== stateRevision) {
    return fail(TRACE_CODE, TRACE_REASON, `${d} last entry sequence must equal state_revision`);
  }

  // §10.3 invariant 5: offload position follows the capacity bound.
  if (stateRevision <= 64) {
    if (
      (cu["offloaded_through_sequence"] as number) !== 0 ||
      cu["offloaded_through_trace_ref"] !== null
    ) {
      return fail(
        TRACE_CODE,
        TRACE_REASON,
        `${d}.cursor offload must be 0/null for revision <= ${RETRIEVAL_TRACE_CAPACITY}`
      );
    }
  } else {
    if ((cu["offloaded_through_sequence"] as number) !== stateRevision - 64) {
      return fail(TRACE_CODE, TRACE_REASON, `${d}.cursor offloaded sequence must equal state_revision - 64`);
    }
    if (cu["offloaded_through_trace_ref"] === null) {
      return fail(TRACE_CODE, TRACE_REASON, `${d}.cursor offloaded ref required after eviction`);
    }
  }
  return ok(undefined);
}

/**
 * PersonalityState V0 validation (schema v1). Closed keys, schema literal,
 * unique + raw-ASCII-sorted dimension_ids (IdentifierV0), bounded [0,1] values.
 * Registered-dimension container: membership is owned by the initial canonical
 * state; proposals may only target existing dimensions.
 */
export function validatePersonalityState(v: unknown, d: string): Check {
  const rec = reqRecord(v, d);
  if (!rec.ok) return rec;
  const o = rec.value;
  const closed = closedKeys(o, ["schema_version", "dimensions"], d);
  if (!closed.ok) return closed;
  const sv = lit(o["schema_version"], "personality-state-v0", `${d}.schema_version`);
  if (!sv.ok) return sv;
  const dims = reqArray(o["dimensions"], `${d}.dimensions`);
  if (!dims.ok) return dims;
  let prevId: string | undefined;
  for (let i = 0; i < dims.value.length; i++) {
    const label = `${d}.dimensions[${i}]`;
    const item = reqRecord(dims.value[i], label);
    if (!item.ok) return item;
    const ic = closedKeys(item.value, ["dimension_id", "value"], label);
    if (!ic.ok) return ic;
    const idRaw = item.value["dimension_id"];
    if (!isString(idRaw)) return fail("INVALID_SCHEMA", SCHEMA, `${label}.dimension_id: expected identifier`);
    const id = validateIdentifier(idRaw, `${label}.dimension_id`);
    if (!id.ok) return id;
    if (prevId !== undefined) {
      const cur = idRaw as string;
      if (cur === prevId) return fail("INVALID_SCHEMA", SCHEMA, `${label}: duplicate dimension_id`);
      if (cur < prevId) return fail("INVALID_SCHEMA", SCHEMA, `${label}: dimension_ids not raw-ASCII-sorted`);
    }
    prevId = item.value["dimension_id"] as string;
    const val = scalarField(item.value["value"], `${label}.value`, validateUnitInterval);
    if (!val.ok) return val;
  }
  return ok(undefined);
}

/**
 * Validate an unknown input as a complete closed SubjectStateV0 snapshot.
 * Pure: input -> ValidationResult. No repair, no defaults, no normalization.
 *
 * `preTraceWindowRevision` (R2-J / §13.4 precedence): lets the commit engine run
 * whole-state validation BEFORE the trace-window projection exists, by tying the
 * §10.3 cursor/entry invariants to the prior revision instead of the candidate's
 * already-derived successor. Omitted (restore/admission paths) ties them to the
 * snapshot's own `runtime_metadata.state_revision`.
 */
export function validateSubjectState(
  v: unknown,
  options?: { readonly preTraceWindowRevision?: number }
): ValidationResult<SubjectStateV0> {
  const root = reqRecord(v, "subjectState");
  if (!root.ok) return root;
  const o = root.value;
  const TOP_LEVEL_KEYS: readonly string[] = [
    "schema_version",
    "identity",
    "traits_seed",
    "personality",
    "memory_state",
    "beliefs",
    "relationships",
    "mood",
    "affect",
    "regulation",
    "context",
    "mechanism_config",
    "trace_window",
    "runtime_metadata"
  ];
  const closed = closedKeys(o, TOP_LEVEL_KEYS, "subjectState");
  if (!closed.ok) return closed;
  const sv = lit(o["schema_version"], "subject-state-v2", "subjectState.schema_version");
  if (!sv.ok) return sv;

  // Admitted first: §6.2 timestamp invariants of other blocks are relative to this.
  const rt = validateRuntimeMetadata(o["runtime_metadata"], "runtime_metadata");
  if (!rt.ok) return rt;
  const logicalTime = rt.value.logical_time;
  const stateRevision = rt.value.state_revision;

  const id = validateIdentity(o["identity"], "identity");
  if (!id.ok) return id;
  const ts = validateTraitsSeed(o["traits_seed"], "traits_seed");
  if (!ts.ok) return ts;
  const ps = validatePersonalityState(o["personality"], "personality");
  if (!ps.ok) return ps;
  const ms = validateMemoryState(o["memory_state"], "memory_state", logicalTime);
  if (!ms.ok) return ms;
  const bl = validateBeliefs(o["beliefs"], "beliefs");
  if (!bl.ok) return bl;
  const rel = validateRelationshipState(o["relationships"], "relationships");
  if (!rel.ok) return rel;
  const mood = validateMoodShape(o["mood"], "mood", { logical_time: logicalTime });
  if (!mood.ok) return mood;
  const affect = validateAffectShape(o["affect"], "affect", { logical_time: logicalTime });
  if (!affect.ok) return affect;
  const regulation = validateRegulationShape(o["regulation"], "regulation", {
    logical_time: logicalTime
  });
  if (!regulation.ok) return regulation;
  const context = validateWorkingContextShape(o["context"], "context");
  if (!context.ok) return context;
  const mech = validateMechanismConfig(o["mechanism_config"], "mechanism_config");
  if (!mech.ok) return mech;
  const tw = validateTraceWindow(
    o["trace_window"],
    "trace_window",
    options?.preTraceWindowRevision ?? stateRevision
  );
  if (!tw.ok) return tw;

  return ok(v as unknown as SubjectStateV0);
}
