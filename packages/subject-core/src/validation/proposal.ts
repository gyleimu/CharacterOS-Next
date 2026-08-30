/**
 * P2.1.2 — CanonicalTransitionProposalV1 validator (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §7.1–§7.2 (proposal/delta schema),
 * §13.4 (deterministic validation precedence).
 *
 * Pure input -> ValidationResult: no commit engine, no state mutation, no persistence,
 * no runtime, no transition execution. Guards implemented here, in §13.4 order:
 *   L1  parse/closed-envelope syntax (closed objects, literals, ID/enum/scalar shapes,
 *       ref grammar incl. unique/sorted ref sets, per-domain expected_repository_revision
 *       null/non-null shape);
 *   L5  authenticated registered (producer,domain) binding;
 *   L6  read-only vs writable path classification and transition ownership;
 *   L7  duplicate/overlap conflicts and canonical ordering form;
 *   L8  path-specific value/range shape (shared value validators from ./values.js).
 *
 * Deliberate P2.1.3 boundaries (need current authority or journal state, never inputs
 * alone): subject_id equality, expected_state_revision/repository-revision equality
 * against current snapshots, required-delta composition, transition-id uniqueness and
 * ProducerAuthorizationSetV1 capability verification.
 *
 * Members of list-valued layers are evaluated in lexicographically sorted
 * `(domain,producer,path)` order so the reported failure is deterministic (§13.4).
 */

import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { TransitionType } from "../types/enums.js";
import { fail, ok, type ValidationResult } from "./result.js";
import {
  isNumber,
  isRecord,
  isString,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateStateRevision
} from "./scalars.js";
import {
  isReadonlyPath,
  isRegisteredBinding,
  isRegisteredDomain,
  isRegisteredProducer,
  isWritablePath,
  validateOwnership
} from "./ownership.js";
import { validateFieldValueForPath } from "./values.js";

const SCHEMA = "SS-SCHEMA-001";
const SS_AUTH = "SS-AUTH-001";
/** Frozen code + reason for duplicate/overlap delta conflicts (§13.3, SC-010). */
const CONFLICT_CODE = "DOMAIN_DELTA_CONFLICT";
const CONFLICT_REASON = "TR-CONFLICT-001";

const TRANSITIONS: readonly TransitionType[] = [
  "Time",
  "Observation",
  "CognitionAction",
  "Learning",
  "Personality",
  "Relationship"
];

const PROPOSAL_KEYS: readonly string[] = [
  "schema_version",
  "transition_id",
  "subject_id",
  "transition_type",
  "expected_state_revision",
  "time_input",
  "cause_refs",
  "domain_deltas",
  "external_refs"
];

const DELTA_KEYS: readonly string[] = [
  "producer",
  "domain",
  "expected_repository_revision",
  "operations",
  "provenance_refs"
];

function closedKeys(o: Record<string, unknown>, allowed: readonly string[], d: string): ValidationResult<void> {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: unknown key`);
  }
  return ok(undefined);
}

function lit(v: unknown, want: string, d: string): ValidationResult<void> {
  return v === want ? ok(undefined) : fail("INVALID_SCHEMA", SCHEMA, `${d}: expected ${want}`);
}

interface RawOperation {
  readonly index: number;
  readonly path: string;
  readonly value: unknown;
}

interface RawDelta {
  readonly index: number;
  readonly producer: string;
  readonly domain: string;
  readonly operations: readonly RawOperation[];
}

function deltaKey(d: RawDelta): string {
  return `${d.domain}\u0000${d.producer}`;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Validate one proposal envelope. On success the input is returned narrowed to
 * CanonicalTransitionProposalV1 (single guarded cast after full validation).
 */
export function validateProposal(v: unknown): ValidationResult<CanonicalTransitionProposalV1> {
  // ---- L1: parse / closed-envelope syntax ------------------------------------------
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, "proposal: expected object");
  const o = v;
  const topClosed = closedKeys(o, PROPOSAL_KEYS, "proposal");
  if (!topClosed.ok) return topClosed;

  const sv = lit(o["schema_version"], "canonical-transition-proposal-v1", "proposal.schema_version");
  if (!sv.ok) return sv;

  if (!isString(o["transition_id"])) {
    return fail("INVALID_SCHEMA", SCHEMA, "proposal.transition_id: expected identifier");
  }
  const tid = validateIdentifier(o["transition_id"], "proposal.transition_id");
  if (!tid.ok) return tid;

  if (!isString(o["subject_id"])) {
    return fail("INVALID_SCHEMA", SCHEMA, "proposal.subject_id: expected identifier");
  }
  const sid = validateIdentifier(o["subject_id"], "proposal.subject_id");
  if (!sid.ok) return sid;

  const ttValue = o["transition_type"];
  if (!(TRANSITIONS as readonly string[]).includes(ttValue as string)) {
    return fail("INVALID_SCHEMA", SCHEMA, "proposal.transition_type: invalid enum");
  }
  const transitionType = ttValue as TransitionType;

  const revInput = o["expected_state_revision"];
  if (!isNumber(revInput)) {
    return fail("INVALID_SCHEMA", SCHEMA, "proposal.expected_state_revision: expected number");
  }
  const rev = validateStateRevision(revInput, "proposal.expected_state_revision");
  if (!rev.ok) return rev;

  // time_input — exactly one canonical shape per transition class (§7.1).
  const ti = o["time_input"];
  if (!isRecord(ti)) return fail("INVALID_SCHEMA", SCHEMA, "proposal.time_input: expected object");
  const kind = ti["kind"];
  if (kind === "ELAPSED") {
    const tc = closedKeys(ti, ["kind", "elapsed_time"], "proposal.time_input");
    if (!tc.ok) return tc;
    const et = ti["elapsed_time"];
    if (!isRecord(et)) {
      return fail("INVALID_SCHEMA", SCHEMA, "proposal.time_input.elapsed_time: expected object");
    }
    const etc = closedKeys(et, ["value", "unit"], "proposal.time_input.elapsed_time");
    if (!etc.ok) return etc;
    const val = et["value"];
    if (!isNumber(val)) {
      return fail("INVALID_SCHEMA", SCHEMA, "proposal.time_input.elapsed_time.value: expected number");
    }
    const lv = validateLogicalTime(val, "proposal.time_input.elapsed_time.value");
    if (!lv.ok) return lv;
    const unit = lit(et["unit"], "tick", "proposal.time_input.elapsed_time.unit");
    if (!unit.ok) return unit;
  } else if (kind === "OCCURRENCE") {
    const tc = closedKeys(ti, ["kind", "occurrence_logical_time"], "proposal.time_input");
    if (!tc.ok) return tc;
    const oc = ti["occurrence_logical_time"];
    if (!isNumber(oc)) {
      return fail("INVALID_SCHEMA", SCHEMA, "proposal.time_input.occurrence_logical_time: expected number");
    }
    const lv = validateLogicalTime(oc, "proposal.time_input.occurrence_logical_time");
    if (!lv.ok) return lv;
  } else {
    return fail("INVALID_SCHEMA", SCHEMA, "proposal.time_input.kind: invalid enum");
  }

  // cause_refs / external_refs: set-like, unique, lexicographically sorted (§7.1);
  // every enumerated ref kind accepted here (semantic relevance belongs to stages).
  const cause = validateRefArray(o["cause_refs"], "proposal.cause_refs", { sorted: true });
  if (!cause.ok) return cause;
  const external = validateRefArray(o["external_refs"], "proposal.external_refs", { sorted: true });
  if (!external.ok) return external;

  const deltasInput = o["domain_deltas"];
  if (!Array.isArray(deltasInput)) {
    return fail("INVALID_SCHEMA", SCHEMA, "proposal.domain_deltas: expected array");
  }

  const rawDeltas: RawDelta[] = [];
  for (let i = 0; i < deltasInput.length; i++) {
    const label = `proposal.domain_deltas[${i}]`;
    if (!isRecord(deltasInput[i])) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}: expected object`);
    }
    const d = deltasInput[i];
    const dc = closedKeys(d, DELTA_KEYS, label);
    if (!dc.ok) return dc;

    if (!isString(d["producer"])) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.producer: expected identifier`);
    }
    const prod = validateIdentifier(d["producer"], `${label}.producer`);
    if (!prod.ok) return prod;
    if (!isString(d["domain"])) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.domain: expected domain literal`);
    }

    // expected_repository_revision: non-null valid revision id for both memory
    // domains, null otherwise (§7.2). Equality with current state is a P2.1.3 guard.
    const err = d["expected_repository_revision"];
    const isMemoryDomain = d["domain"] === "memory-content" || d["domain"] === "memory-retrieval";
    if (isMemoryDomain) {
      if (!isString(err)) {
        return fail(
          "INVALID_SCHEMA",
          SCHEMA,
          `${label}.expected_repository_revision: memory domain requires a repository revision`
        );
      }
      const rv = validateIdentifier(err, `${label}.expected_repository_revision`);
      if (!rv.ok) return rv;
    } else if (err !== null) {
      return fail(
        "INVALID_SCHEMA",
        SCHEMA,
        `${label}.expected_repository_revision: non-memory domain requires null`
      );
    }

    const opsInput = d["operations"];
    if (!Array.isArray(opsInput)) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.operations: expected array`);
    }
    if (opsInput.length === 0) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.operations: nonempty`);
    }
    const rawOps: RawOperation[] = [];
    for (let j = 0; j < opsInput.length; j++) {
      const opLabel = `${label}.operations[${j}]`;
      if (!isRecord(opsInput[j])) {
        return fail("INVALID_SCHEMA", SCHEMA, `${opLabel}: expected object`);
      }
      const op = opsInput[j];
      const opc = closedKeys(op, ["path", "value"], opLabel);
      if (!opc.ok) return opc;
      if (!isString(op["path"])) {
        return fail("INVALID_SCHEMA", SCHEMA, `${opLabel}.path: expected field path`);
      }
      if (!Object.prototype.hasOwnProperty.call(op, "value")) {
        return fail("INVALID_SCHEMA", SCHEMA, `${opLabel}.value: required`);
      }
      rawOps.push({ index: j, path: op["path"], value: op["value"] });
    }

    const prov = validateRefArray(d["provenance_refs"], `${label}.provenance_refs`, { sorted: true });
    if (!prov.ok) return prov;

    rawDeltas.push({ index: i, producer: d["producer"], domain: d["domain"], operations: rawOps });
  }

  // ---- L5/L6: registered binding + path classification + transition ownership ------
  // Evaluated in lexicographic (domain,producer,path) order (§13.4).
  const authorizationOrder = [...rawDeltas].sort((a, b) => compareStrings(deltaKey(a), deltaKey(b)));
  for (const delta of authorizationOrder) {
    const base = `proposal.domain_deltas[${delta.index}]`;
    if (!isRegisteredProducer(delta.producer)) {
      return fail("UNAUTHORIZED_PRODUCER", SS_AUTH, `${base}: producer ${delta.producer} not registered`);
    }
    if (!isRegisteredDomain(delta.domain)) {
      return fail("UNAUTHORIZED_PRODUCER", SS_AUTH, `${base}: domain ${delta.domain} not registered`);
    }
    if (!isRegisteredBinding(delta.producer, delta.domain)) {
      return fail(
        "UNAUTHORIZED_PRODUCER",
        SS_AUTH,
        `${base}: (${delta.producer},${delta.domain}) is not a registered binding`
      );
    }
    const opOrder = [...delta.operations].sort((a, b) => compareStrings(a.path, b.path));
    for (const op of opOrder) {
      const opBase = `${base}.operations[${op.index}]`;
      if (!isWritablePath(op.path) && !isReadonlyPath(op.path)) {
        return fail("INVALID_SCHEMA", SCHEMA, `${opBase}.path: unknown field path ${op.path}`);
      }
      if (isReadonlyPath(op.path)) {
        return fail("FORBIDDEN_DIRECT_MUTATION", SS_AUTH, `${opBase}: readonly/core-derived path ${op.path}`);
      }
      const ow = validateOwnership(delta.producer, delta.domain, op.path, transitionType, opBase);
      if (!ow.ok) return ow;
    }
  }

  // ---- L7: duplicate/overlap conflicts and canonical ordering form ------------------
  const seenPairs = new Set<string>();
  for (const delta of rawDeltas) {
    const pairKey = `${delta.producer}|${delta.domain}`;
    if (seenPairs.has(pairKey)) {
      return fail(
        CONFLICT_CODE,
        CONFLICT_REASON,
        `proposal.domain_deltas[${delta.index}]: duplicate (producer,domain) delta`
      );
    }
    seenPairs.add(pairKey);
  }
  let prevDelta: RawDelta | undefined;
  for (const delta of rawDeltas) {
    if (prevDelta !== undefined && compareStrings(deltaKey(delta), deltaKey(prevDelta)) < 0) {
      return fail(
        "INVALID_SCHEMA",
        SCHEMA,
        "proposal.domain_deltas: must be unique and sorted by (domain,producer)"
      );
    }
    prevDelta = delta;
  }
  const pathOwner = new Map<string, number>();
  for (const delta of rawDeltas) {
    const seenPaths = new Set<string>();
    let prevPath: string | undefined;
    for (const op of delta.operations) {
      if (seenPaths.has(op.path)) {
        return fail(
          CONFLICT_CODE,
          CONFLICT_REASON,
          `proposal.domain_deltas[${delta.index}].operations[${op.index}]: duplicate path ${op.path}`
        );
      }
      seenPaths.add(op.path);
      const existingOwner = pathOwner.get(op.path);
      if (existingOwner !== undefined && existingOwner !== delta.index) {
        return fail(
          CONFLICT_CODE,
          CONFLICT_REASON,
          `proposal.domain_deltas[${delta.index}].operations[${op.index}]: overlapping path ${op.path}`
        );
      }
      pathOwner.set(op.path, delta.index);
      if (prevPath !== undefined && compareStrings(op.path, prevPath) < 0) {
        return fail(
          "INVALID_SCHEMA",
          SCHEMA,
          `proposal.domain_deltas[${delta.index}].operations: must be unique and sorted by path`
        );
      }
      prevPath = op.path;
    }
  }

  // ---- L8: path-specific value/range shapes -----------------------------------------
  for (const delta of authorizationOrder) {
    const opOrder = [...delta.operations].sort((a, b) => compareStrings(a.path, b.path));
    for (const op of opOrder) {
      // No ShapeContext: delta values carry no canonical logical time; timestamp
      // expectations against current state are commit-engine (P2.1.3) guards.
      const res = validateFieldValueForPath(
        op.path,
        op.value,
        `proposal.domain_deltas[${delta.index}].operations[${op.index}].value`
      );
      if (!res.ok) return res;
    }
  }

  return ok(v as unknown as CanonicalTransitionProposalV1);
}
