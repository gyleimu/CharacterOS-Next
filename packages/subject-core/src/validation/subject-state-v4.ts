/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — closed v4 snapshot validation.
 *
 * Strict closed schema: no coercion, no defaults, no repair, no extra fields.
 * Mirrors the v3 validator's failure style but validates the v4 shape exactly
 * (mood absent; affect = CanonicalAffectV0; mechanism = MechanismConfigV1).
 * Reuses the v3 block validators for shared structures — their behavior is
 * unchanged. Returns the validated input as SubjectStateV4 (same pattern as
 * the v3 validator which returns `ok(v as unknown as SubjectStateV0)`).
 */

import { ok, type ValidationResult } from "./result.js";
import type { SubjectStateV4 } from "../types/subject-state-v4.js";
import { v4ValidationHelpers } from "./subject-state-v4-internal.js";

const TOP_LEVEL_KEYS: readonly string[] = [
  "schema_version",
  "identity",
  "traits_seed",
  "personality",
  "memory_state",
  "beliefs",
  "relationships",
  "affect",
  "regulation",
  "context",
  "mechanism_config",
  "trace_window",
  "runtime_metadata"
];

/**
 * Validates an unknown input as a complete closed SubjectStateV4 snapshot.
 * Pure: input -> ValidationResult. No repair, no defaults, no normalization.
 * preTraceWindowRevision has the same R2-J semantics as the v3 validator.
 */
export function validateSubjectStateV4(
  v: unknown,
  options?: { readonly preTraceWindowRevision?: number }
): ValidationResult<SubjectStateV4> {
  const helpers = v4ValidationHelpers;
  const root = helpers.reqRecord(v, "subjectState");
  if (!root.ok) return root;
  const o = root.value;
  const closed = helpers.closedKeys(o, TOP_LEVEL_KEYS, "subjectState");
  if (!closed.ok) return closed;
  const sv = helpers.lit(o["schema_version"], "subject-state-v4", "subjectState.schema_version");
  if (!sv.ok) return sv;

  const rt = helpers.validateRuntimeMetadataV4(o["runtime_metadata"], "runtime_metadata");
  if (!rt.ok) return rt;
  const logicalTime = rt.value.logical_time;
  const stateRevision = rt.value.state_revision;

  const id = helpers.validateIdentity(o["identity"], "identity");
  if (!id.ok) return id;
  const ts = helpers.validateTraitsSeed(o["traits_seed"], "traits_seed");
  if (!ts.ok) return ts;
  const ps = helpers.validatePersonalityState(o["personality"], "personality");
  if (!ps.ok) return ps;
  const ms = helpers.validateMemoryState(o["memory_state"], "memory_state", logicalTime);
  if (!ms.ok) return ms;
  const bl = helpers.validateBeliefState(o["beliefs"], "beliefs");
  if (!bl.ok) return bl;
  const rel = helpers.validateRelationshipState(o["relationships"], "relationships");
  if (!rel.ok) return rel;

  const affect = helpers.validateCanonicalAffect(o["affect"], "affect");
  if (!affect.ok) return affect;

  const regulation = helpers.validateRegulationShape(o["regulation"], "regulation", { logical_time: logicalTime });
  if (!regulation.ok) return regulation;
  const context = helpers.validateWorkingContext(o["context"], "context");
  if (!context.ok) return context;
  const mech = helpers.validateMechanismConfigV1(o["mechanism_config"], "mechanism_config");
  if (!mech.ok) return mech;

  const preRevision = options?.preTraceWindowRevision ?? stateRevision;
  const tw = helpers.validateTraceWindow(o["trace_window"], "trace_window", preRevision);
  if (!tw.ok) return tw;

  return ok(v as SubjectStateV4);
}
