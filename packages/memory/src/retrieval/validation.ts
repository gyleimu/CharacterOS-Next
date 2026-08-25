/**
 * P2.2.3 — Retrieval contract shape validators (pure).
 * Source: freeze §5.1–§5.3 (closed objects, sets, kinds), §16, plan §3.3 oracles.
 *
 * These validators enforce CONTRACT CONFORMANCE of query/result/evidence shapes only.
 * They contain no relevance logic: accepting a query says nothing about which episodes
 * match it. Result validation additionally enforces the deterministic-metadata
 * invariants checkable without an algorithm: selection/evidence order alignment,
 * normalized reason ranges, metadata ranges and query-fingerprint recomputation.
 */

import type { RefKind } from "@characteros-next/subject-core";
import {
  isNumber,
  isRecord,
  isString,
  validateHash,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateRefElement,
  validateRepositoryRevision,
  validateUnitInterval
} from "@characteros-next/subject-core";

import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import { parseEpisodeRef } from "../refs.js";
import {
  MEMORY_RETRIEVAL_CONFIG_V0,
  MEMORY_RETRIEVAL_QUERY_SCHEMA_VERSION,
  MEMORY_RETRIEVAL_RESULT_SCHEMA_VERSION,
  RETRIEVAL_REASON_DIMENSIONS,
  retrievalQueryFingerprint,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0,
  type RetrievalEvidenceV0
} from "./types.js";

const SCHEMA_REASON = "SS-SCHEMA-001";

function closedKeys(o: Record<string, unknown>, allowed: readonly string[], d: string): ValidationResult<void> {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("INVALID_SCHEMA", SCHEMA_REASON, `${d}.${key}: unknown key`);
  }
  return ok(undefined);
}

/** Set-like ref array: unique + lexicographically sorted, optional kind allowlist. */
function uniqueSortedRefs(v: unknown, d: string, kinds?: readonly RefKind[]): ValidationResult<void> {
  return kinds === undefined
    ? validateRefArray(v, d, { sorted: true })
    : validateRefArray(v, d, { kinds, sorted: true });
}

const QUERY_KEYS: readonly string[] = [
  "schema_version",
  "subject_id",
  "repository_revision",
  "semantic_reference",
  "temporal",
  "entity_refs",
  "relationship_refs",
  "current_context_refs",
  "salience_constraints"
];

/**
 * Validates one closed MemoryRetrievalQueryV0 draft. Pure input -> narrowed query;
 * acceptance carries no statement about which episodes match.
 */
export function validateMemoryRetrievalQuery(v: unknown): ValidationResult<MemoryRetrievalQueryV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA_REASON, "query: expected object");
  const shell = closedKeys(v, QUERY_KEYS, "query");
  if (!shell.ok) return shell;
  if (v["schema_version"] !== MEMORY_RETRIEVAL_QUERY_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.schema_version");
  }
  if (!isString(v["subject_id"])) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.subject_id: expected identifier");
  }
  const subject = validateIdentifier(v["subject_id"], "query.subject_id");
  if (!subject.ok) return subject;
  if (!isString(v["repository_revision"])) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.repository_revision: expected identifier");
  }
  const revision = validateRepositoryRevision(v["repository_revision"], "query.repository_revision");
  if (!revision.ok) return revision;
  if (v["semantic_reference"] !== null) {
    const anchor = validateRefElement(v["semantic_reference"], "query.semantic_reference");
    if (!anchor.ok) return anchor;
  }

  const temporal = v["temporal"];
  if (!isRecord(temporal)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.temporal: expected object");
  }
  const tKeys = closedKeys(temporal, ["now_logical_time", "window_start"], "query.temporal");
  if (!tKeys.ok) return tKeys;
  const now = temporal["now_logical_time"];
  if (!isNumber(now)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.temporal.now_logical_time: expected number");
  }
  const nowChecked = validateLogicalTime(now, "query.temporal.now_logical_time");
  if (!nowChecked.ok) return nowChecked;
  const windowStart = temporal["window_start"];
  if (windowStart !== null) {
    if (!isNumber(windowStart)) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.temporal.window_start: expected number or null");
    }
    const windowChecked = validateLogicalTime(windowStart, "query.temporal.window_start");
    if (!windowChecked.ok) return windowChecked;
  }

  const entities = uniqueSortedRefs(v["entity_refs"], "query.entity_refs", ["entity", "subject"]);
  if (!entities.ok) return entities;
  const relationships = uniqueSortedRefs(v["relationship_refs"], "query.relationship_refs", [
    "relationship"
  ]);
  if (!relationships.ok) return relationships;
  const contextRefs = validateRefArray(v["current_context_refs"], "query.current_context_refs", {
    sorted: true
  });
  if (!contextRefs.ok) return contextRefs;

  const salience = v["salience_constraints"];
  if (!isRecord(salience)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.salience_constraints: expected object");
  }
  const sKeys = closedKeys(
    salience,
    ["min_declared_score", "max_candidates"],
    "query.salience_constraints"
  );
  if (!sKeys.ok) return sKeys;
  const minScore: unknown = salience["min_declared_score"];
  if (minScore !== null) {
    if (!isNumber(minScore)) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, "query.salience_constraints.min_declared_score: expected number or null");
    }
    const minCheck = validateUnitInterval(minScore as number, "query.salience_constraints.min_declared_score");
    if (!minCheck.ok) return minCheck;
  }
  const maxCandidates = salience["max_candidates"];
  if (!isNumber(maxCandidates) || !Number.isSafeInteger(maxCandidates) || maxCandidates < 1) {
    return fail("INVALID_VALUE_RANGE", SCHEMA_REASON, "query.salience_constraints.max_candidates: positive safe integer required");
  }

  return ok(v as unknown as MemoryRetrievalQueryV0);
}

function validateEvidenceEntry(entry: unknown, label: string): ValidationResult<RetrievalEvidenceV0> {
  if (!isRecord(entry)) return fail("INVALID_SCHEMA", SCHEMA_REASON, `${label}: expected object`);
  const keys = closedKeys(entry, ["episode_ref", "reasons"], label);
  if (!keys.ok) return keys;
  const ref = parseEpisodeRef(entry["episode_ref"], `${label}.episode_ref`);
  if (!ref.ok) return ref;
  const reasons = entry["reasons"];
  if (!Array.isArray(reasons)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, `${label}.reasons: expected array`);
  }
  let prevDimension: string | undefined;
  for (let i = 0; i < reasons.length; i++) {
    const rLabel = `${label}.reasons[${i}]`;
    if (!isRecord(reasons[i])) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, `${rLabel}: expected object`);
    }
    const r = reasons[i] as Record<string, unknown>;
    const rk = closedKeys(r, ["dimension", "score"], rLabel);
    if (!rk.ok) return rk;
    const dimension = r["dimension"];
    if (!(RETRIEVAL_REASON_DIMENSIONS as readonly string[]).includes(dimension as string)) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, `${rLabel}.dimension: invalid enum`);
    }
    if (prevDimension !== undefined) {
      if (dimension === prevDimension) {
        return fail("INVALID_SCHEMA", SCHEMA_REASON, `${rLabel}.dimension: duplicate dimension`);
      }
      if ((dimension as string) < prevDimension) {
        return fail("INVALID_SCHEMA", SCHEMA_REASON, `${rLabel}.dimension: reasons not raw-ASCII-sorted`);
      }
    }
    prevDimension = dimension as string;
    const score = r["score"];
    if (!isNumber(score)) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, `${rLabel}.score: expected number`);
    }
    const scoreCheck = validateUnitInterval(score, `${rLabel}.score`);
    if (!scoreCheck.ok) return scoreCheck;
  }
  return ok(entry as unknown as RetrievalEvidenceV0);
}

/**
 * Validates one closed MemoryRetrievalResultV0: selection/evidence alignment, reason
 * normalization, deterministic-metadata ranges and — when `expectedQuery` is given —
 * recomputation of the embedded query fingerprint against that exact query.
 */
export async function validateMemoryRetrievalResult(
  v: unknown,
  expectedQuery?: unknown
): Promise<ValidationResult<MemoryRetrievalResultV0>> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA_REASON, "result: expected object");
  const KEYS: readonly string[] = [
    "schema_version",
    "subject_id",
    "selected_memory_refs",
    "evidence",
    "retrieval_trace_ref",
    "deterministic_metadata"
  ];
  const shell = closedKeys(v, KEYS, "result");
  if (!shell.ok) return shell;
  if (v["schema_version"] !== MEMORY_RETRIEVAL_RESULT_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.schema_version");
  }
  if (!isString(v["subject_id"])) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.subject_id: expected identifier");
  }
  const subject = validateIdentifier(v["subject_id"], "result.subject_id");
  if (!subject.ok) return subject;

  const selections = v["selected_memory_refs"];
  if (!Array.isArray(selections)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.selected_memory_refs: expected array");
  }
  let previousSelection: string | undefined;
  for (let i = 0; i < selections.length; i++) {
    const parsed = parseEpisodeRef(selections[i], `result.selected_memory_refs[${i}]`);
    if (!parsed.ok) return parsed;
    if (previousSelection !== undefined && parsed.value === previousSelection) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, `result.selected_memory_refs[${i}]: duplicate selection`);
    }
    previousSelection = parsed.value;
  }

  const evidence = v["evidence"];
  if (!Array.isArray(evidence)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.evidence: expected array");
  }
  if (evidence.length !== selections.length) {
    return fail(
      "INVALID_SCHEMA",
      SCHEMA_REASON,
      "result.evidence must be order-aligned with selected_memory_refs"
    );
  }
  for (let i = 0; i < evidence.length; i++) {
    const label = `result.evidence[${i}]`;
    const checked = validateEvidenceEntry(evidence[i], label);
    if (!checked.ok) return checked;
    const alignedRef = (evidence[i] as Record<string, unknown>)["episode_ref"];
    if (alignedRef !== selections[i]) {
      return fail("INVALID_SCHEMA", SCHEMA_REASON, `${label}: not aligned with selection ${i}`);
    }
  }

  const trace = v["retrieval_trace_ref"];
  if (trace !== null) {
    const traceCheck = validateRefElement(trace, "result.retrieval_trace_ref", ["retrieval-trace"]);
    if (!traceCheck.ok) return traceCheck;
  }

  const meta = v["deterministic_metadata"];
  if (!isRecord(meta)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.deterministic_metadata: expected object");
  }
  const mKeys = closedKeys(
    meta,
    ["repository_revision", "candidate_count", "computed_under_config", "query_fingerprint"],
    "result.deterministic_metadata"
  );
  if (!mKeys.ok) return mKeys;
  if (!isString(meta["repository_revision"])) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.deterministic_metadata.repository_revision: expected identifier");
  }
  const revCheck = validateRepositoryRevision(
    meta["repository_revision"],
    "result.deterministic_metadata.repository_revision"
  );
  if (!revCheck.ok) return revCheck;
  const count = meta["candidate_count"];
  if (!isNumber(count) || !Number.isSafeInteger(count) || count < 0) {
    return fail("INVALID_VALUE_RANGE", SCHEMA_REASON, "result.deterministic_metadata.candidate_count: nonnegative safe integer required");
  }
  if (meta["computed_under_config"] !== MEMORY_RETRIEVAL_CONFIG_V0) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.deterministic_metadata.computed_under_config");
  }
  const fingerprint = meta["query_fingerprint"];
  if (!isString(fingerprint)) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "result.deterministic_metadata.query_fingerprint: expected hash string");
  }
  const fingerprintCheck = validateHash(fingerprint, "result.deterministic_metadata.query_fingerprint");
  if (!fingerprintCheck.ok) return fingerprintCheck;
  if (expectedQuery !== undefined) {
    const queryCheck = validateMemoryRetrievalQuery(expectedQuery);
    if (!queryCheck.ok) return queryCheck;
    const recomputed = await retrievalQueryFingerprint(queryCheck.value);
    if (recomputed !== fingerprint) {
      return rejectionMismatch();
    }
  }
  return ok(v as unknown as MemoryRetrievalResultV0);

  function rejectionMismatch(): ValidationResult<MemoryRetrievalResultV0> {
    return fail(
      "INVALID_SCHEMA",
      SCHEMA_REASON,
      "result.deterministic_metadata.query_fingerprint does not match expectedQuery"
    );
  }
}
