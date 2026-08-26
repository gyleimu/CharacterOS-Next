/**
 * P2.3.3 (P0-6 §19/§20) — runtime proposal schema validation + unified evidence
 * validator (pure). Fixed providers and the executor must pass every proposal through
 * here: schema conformance, projection-hash binding, and evidence ownership — no
 * provider can invent memory refs (A4.3 / UNSUPPORTED_EVIDENCE_REF).
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import {
  isRecord,
  isString,
  validateRefArray,
  validateUnitInterval
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import type {
  InterpretationProposalDraftV0
} from "../../ports/interpretation-port.js";
import type { AppraisalProposalDraftV0 } from "../../ports/appraisal-port.js";

const SCHEMA_REASON = "SS-SCHEMA-001";

function closedKeys(o: Record<string, unknown>, allowed: readonly string[], d: string): ValidationResult<void> {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("INVALID_SCHEMA", SCHEMA_REASON, `${d}.${key}: unknown key`);
  }
  return ok(undefined);
}

/** Validates the closed interpretation proposal draft (§19). */
export function validateInterpretationProposal(v: unknown): ValidationResult<InterpretationProposalDraftV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA_REASON, "interpretation: expected object");
  const shell = closedKeys(
    v,
    ["schema_version", "interpretation_ref", "projection_hash", "evidence_refs"],
    "interpretation"
  );
  if (!shell.ok) return shell;
  if (v["schema_version"] !== "interpretation-proposal-v0") {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "interpretation.schema_version");
  }
  if (!isString(v["interpretation_ref"])) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "interpretation.interpretation_ref");
  }
  if (!isString(v["projection_hash"]) || !/^sha256:[0-9a-f]{64}$/.test(v["projection_hash"])) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "interpretation.projection_hash");
  }
  const evidence = validateRefArray(v["evidence_refs"], "interpretation.evidence_refs", { sorted: true });
  if (!evidence.ok) return evidence;
  return ok(v as unknown as InterpretationProposalDraftV0);
}

const APPRAISAL_FIELDS = [
  "relevance",
  "goal_congruence",
  "attribution",
  "controllability",
  "uncertainty",
  "intensity"
] as const;

/** Validates the closed six-field AppraisalV0 (§19) — no extra fields accepted. */
export function validateAppraisalV0(v: unknown): ValidationResult<AppraisalProposalDraftV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA_REASON, "appraisal: expected object");
  const shell = closedKeys(
    v,
    ["schema_version", "appraisal_ref", "evidence_refs", ...APPRAISAL_FIELDS],
    "appraisal"
  );
  if (!shell.ok) return shell;
  if (v["schema_version"] !== "appraisal-v0") {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "appraisal.schema_version");
  }
  if (!isString(v["appraisal_ref"])) {
    return fail("INVALID_SCHEMA", SCHEMA_REASON, "appraisal.appraisal_ref");
  }
  for (const field of APPRAISAL_FIELDS) {
    const value = v[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      return fail("INVALID_VALUE_RANGE", SCHEMA_REASON, `appraisal.${field}: UnitIntervalV0 required`);
    }
    const checked = validateUnitInterval(value, `appraisal.${field}`);
    if (!checked.ok) return checked;
  }
  const evidence = validateRefArray(v["evidence_refs"], "appraisal.evidence_refs", { sorted: true });
  if (!evidence.ok) return evidence;
  return ok(v as unknown as AppraisalProposalDraftV0);
}

export interface EvidenceSet {
  /** Observation fact refs (observation_id + source_refs + entity_refs). */
  readonly canonical_refs: readonly CanonicalRefV0[];
  /** Retrieval-selected memory refs (empty for LEGAL EMPTY RETRIEVAL). */
  readonly retrieval_selected: readonly CanonicalRefV0[];
}

/** The allowed evidence set for one observation run (§20). */
export function allowedEvidenceSet(input: {
  readonly observation_id: CanonicalRefV0;
  readonly source_refs: readonly CanonicalRefV0[];
  readonly entity_refs: readonly CanonicalRefV0[];
}, retrievalSelected: readonly CanonicalRefV0[]): ReadonlySet<string> {
  const set = new Set<string>();
  set.add(input.observation_id);
  for (const ref of [...input.source_refs, ...input.entity_refs, ...retrievalSelected]) {
    set.add(ref);
  }
  return set;
}

/**
 * Unified evidence validator: every cited ref must belong to the allowed evidence set
 * (retrieval-selected refs + canonical observation facts). Anything else →
 * UNSUPPORTED_EVIDENCE_REF / LLM-EVID-001 semantics. Returns the offending ref.
 */
export function findUnsupportedEvidenceRef(
  citedRefs: readonly CanonicalRefV0[],
  allowed: ReadonlySet<string>
): CanonicalRefV0 | null {
  for (const ref of citedRefs) {
    if (!allowed.has(ref)) return ref;
  }
  return null;
}
