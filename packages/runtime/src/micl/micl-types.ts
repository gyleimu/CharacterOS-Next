/**
 * P2.4 — MICL V0 workflow types (micl-design.md §5–§8, §31–§33; freeze §7.5/§7.6;
 * p2-runtime-plan.md §11 P2.4).
 *
 * MICL is a MULTI-TRANSITION WORKFLOW: Time → Observation → Learning, each with
 * its own canonical commit boundary. It is NOT one atomic SubjectCore commit and
 * NOT a canonical mutator (Producer != Mutator intact; §16 of the P2.4 task).
 *
 * Failure statuses are the four frozen MICLResult statuses; MICL_ID_REUSE never
 * enters a MICLResult — it uses the separate frozen MICLAdmissionErrorResultV1
 * (subject-core §7.5). No PARTIAL_COMPLETION status exists (§31).
 *
 * All MICLResult keys are required; absent refs are explicit null (§8).
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  MiclStageKey,
  StateRevisionV0
} from "@characteros-next/subject-core";
import type { ObservationInputV0 } from "../transitions/observation/types.js";
import { fail, isRecord, isString, ok, validateIdentifier, validateRefArray, validateUnitInterval, type ValidationResult } from "@characteros-next/subject-core";

export const MICL_REQUEST_SCHEMA_VERSION = "micl-request-v0" as const;

/**
 * Closed V0 MICL request. Semantic authority: the complete Observation input
 * (its `occurrence_logical_time` is the single occurrence-time authority), the
 * expected initial revision declaration, cause refs, and the host-declared
 * encoding salience (ENCODING_DECLARED_V0 — refs/metadata only, never values
 * computed by MICL).
 */
export interface MICLRequestV0 {
  readonly schema_version: typeof MICL_REQUEST_SCHEMA_VERSION;
  readonly micl_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  /** Host declaration bound into the request fingerprint; never a stale read. */
  readonly expected_initial_state_revision: StateRevisionV0;
  /** Complete objective observation (occurrence time authority; §9). */
  readonly observation: ObservationInputV0;
  /** Cause refs of the workflow (may be empty). */
  readonly cause_refs: readonly CanonicalRefV0[];
  /** Host-declared [0,1] encoding salience for the Learning handoff. */
  readonly declared_salience: number;
}

const MICL_REQUEST_KEYS: readonly string[] = [
  "schema_version",
  "micl_id",
  "subject_id",
  "expected_initial_state_revision",
  "observation",
  "cause_refs",
  "declared_salience"
];

/** Frozen MICL failure stage names (§8: failure_stage = TIME|OBSERVATION|LEARNING|null). */
export type MiclFailureStage = MiclStageKey | null;

/** Frozen four-status MICLResult discriminator (freeze §7 status table). */
export type MiclResultStatus =
  | "COMPLETED"
  | "FAILED_BEFORE_STATE_CHANGE"
  | "FAILED_AFTER_TIME"
  | "FAILED_AFTER_OBSERVATION";

/**
 * §8 MICLResult: all keys required; absent refs explicit null. Refs only — no
 * SubjectState snapshot copies (§15). Logical times/revisions are null only on
 * pre-proposal failures where no authoritative read existed.
 */
export interface MiclResultV0 {
  readonly micl_id: IdentifierV0;
  readonly status: MiclResultStatus;
  readonly initial_state_revision: StateRevisionV0 | null;
  readonly final_state_revision: StateRevisionV0 | null;
  readonly initial_logical_time: LogicalTimeV0 | null;
  readonly final_logical_time: LogicalTimeV0 | null;
  readonly time_transition_ref: string | null;
  readonly observation_transition_ref: string | null;
  readonly learning_transition_ref: string | null;
  readonly retrieval_result_ref: CanonicalRefV0 | null;
  readonly interpretation_result_ref: CanonicalRefV0 | null;
  readonly appraisal_result_ref: CanonicalRefV0 | null;
  readonly internal_experience_ref: CanonicalRefV0 | null;
  readonly final_state_hash: HashV1 | null;
  readonly failure_stage: MiclFailureStage;
  /** Nested stage error_code; the ONLY literal `REBASE_REQUIRED` for unsafe rebuild. */
  readonly failure_reason: string | null;
  readonly audit_refs: readonly CanonicalRefV0[];
}

/** Per-stage durable checkpoint owned by the workflow store (never canonical). */
export interface MiclStageCheckpointV0 {
  readonly stage_key: MiclStageKey;
  readonly transition_id: string;
  readonly logical_status: "COMMITTED" | "NO_OP";
  readonly next_revision: StateRevisionV0 | null;
  readonly logical_time_after: LogicalTimeV0;
  readonly snapshot_hash_after: HashV1 | null;
  readonly result_ref: CanonicalRefV0 | null;
  readonly trace_ref: CanonicalRefV0 | null;
}

/** Durable workflow ledger record (workflow-owned; NOT canonical SubjectState). */
export interface MiclWorkflowRecordV0 {
  readonly micl_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  readonly request_fingerprint: HashV1;
  readonly initial_state_revision: StateRevisionV0;
  readonly initial_logical_time: LogicalTimeV0;
  readonly stages: Readonly<Partial<Record<MiclStageKey, MiclStageCheckpointV0>>>;
  readonly terminal_result: MiclResultV0 | null;
}

function failRequest(detail: string): ValidationResult<never> {
  return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `micl request: ${detail}`);
}

/** Closed-shape runtime validation of an UNKNOWN value as a MICLRequestV0. */
export function validateMiclRequest(v: unknown): ValidationResult<MICLRequestV0> {
  if (!isRecord(v)) return failRequest("expected object");
  for (const key of Object.keys(v)) {
    if (!MICL_REQUEST_KEYS.includes(key)) return failRequest(`unknown key ${key} (closed shape)`);
  }
  if (v["schema_version"] !== MICL_REQUEST_SCHEMA_VERSION) {
    return failRequest("schema_version must be micl-request-v0");
  }
  if (!isString(v["micl_id"])) return failRequest("micl_id: expected identifier");
  const miclId = validateIdentifier(v["micl_id"], "micl request.micl_id");
  if (!miclId.ok) return miclId;
  if (!isString(v["subject_id"])) return failRequest("subject_id: expected identifier");
  const subject = validateIdentifier(v["subject_id"], "micl request.subject_id");
  if (!subject.ok) return subject;
  if (typeof v["expected_initial_state_revision"] !== "number") {
    return failRequest("expected_initial_state_revision: expected number");
  }
  if (!Number.isInteger(v["expected_initial_state_revision"]) || v["expected_initial_state_revision"] < 0) {
    return failRequest("expected_initial_state_revision: nonnegative integer required");
  }
  const observation = v["observation"];
  if (!isRecord(observation) || observation["schema_version"] !== "observation-input-v0") {
    return failRequest("observation: observation-input-v0 required");
  }
  if (!Array.isArray(v["cause_refs"])) {
    return failRequest("cause_refs: expected array");
  }
  const causes = validateRefArray(v["cause_refs"], "micl request.cause_refs", { sorted: true });
  if (!causes.ok) return causes;
  if (typeof v["declared_salience"] !== "number") return failRequest("declared_salience: expected number");
  const salience = validateUnitInterval(v["declared_salience"], "micl request.declared_salience");
  if (!salience.ok) return salience;
  return ok(v as unknown as MICLRequestV0);
}
