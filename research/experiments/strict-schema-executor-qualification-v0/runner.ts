/* eslint-disable no-restricted-imports -- Research harness: imports the frozen production schema by relative dist path. */
import { createHash } from "node:crypto";

import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

import {
  ADVERSARIAL_PROMPTS,
  GATE_S_RUBRIC,
  CANDIDATES,
  GATE_C_PLAN,
  MAX_CALLS_PER_CANDIDATE,
  MAX_TOTAL_CANDIDATE_CALLS,
  MINIMAL_STRUCTURAL_SCHEMA,
  QUALIFICATION_ARTIFACT_SCHEMA_VERSION,
  QUALIFICATION_ID,
  QUALIFICATION_MARKERS,
  QUALIFICATION_NAMESPACE,
  type CandidateDefinition
} from "./contract.ts";
import type { QualificationTransport } from "./transport.ts";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function hashJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

/** The rubric hash a reviewer can recompute from the frozen descriptor. */
export const QUALIFICATION_RUBRIC_HASH = hashJson({
  rubric: GATE_S_RUBRIC_SNAPSHOT(),
  minimal_schema: MINIMAL_STRUCTURAL_SCHEMA,
  adversarial_prompts: ADVERSARIAL_PROMPTS,
  candidates: CANDIDATES.map((candidate) => candidate.id),
  budget: { per_candidate: MAX_CALLS_PER_CANDIDATE, total: MAX_TOTAL_CANDIDATE_CALLS }
});

function GATE_S_RUBRIC_SNAPSHOT(): Record<string, unknown> {
  return {
    rubric_id: GATE_S_RUBRIC.rubric_id,
    criteria: GATE_S_RUBRIC.criteria.map((entry) => entry.id),
    result_states: GATE_S_RUBRIC.result_states,
    max_length_semantics_rule: GATE_S_RUBRIC.max_length_semantics_rule
  };
}

export type CaseId =
  | "S1_MINIMAL_SCHEMA_ACCEPTANCE"
  | "S2_NESTED_OBJECT_VS_BARE_STRING"
  | "S3_ENUM_AND_CLOSED_KEYS"
  | "S4_REQUIRED_KEY"
  | "S6_FULL_V8_SCHEMA_ACCEPTANCE";

export interface StructuralCaseResult {
  readonly case_id: CaseId;
  readonly prompt: string;
  readonly criterion: string;
  readonly http_status: number | null;
  readonly accepted: boolean;
  readonly content: string | null;
  readonly content_json_valid: boolean | null;
  /**
   * Raw observations only. NO repair is applied: a bare string stays a bare string,
   * a missing key stays missing.
   */
  readonly observed: {
    readonly directive_type: string | null;
    readonly kind_value: string | null;
    readonly kind_is_enum_member: boolean | null;
    readonly kind_present: boolean | null;
    readonly extra_keys: readonly string[] | null;
  };
  readonly constraint_satisfied: boolean | null;
  readonly error_class: string | null;
  readonly error_message: string | null;
  readonly elapsed_ms: number;
}

export interface CandidateQualificationResult {
  readonly candidate: CandidateDefinition;
  readonly credential_available: boolean;
  readonly calls: number;
  readonly structural_cases: readonly StructuralCaseResult[];
  readonly criteria: Readonly<Record<string, boolean | null>>;
  readonly full_v8_schema_accepted: boolean | null;
  readonly max_length_semantics: "UNVERIFIED" | "COMPATIBLE" | "INCOMPATIBLE";
  readonly host_repair_used: false;
  readonly retries: number;
  readonly structural_gate: string;
  readonly note: string;
}

const ENUM_MEMBERS = ["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"] as const;

/** Observe the raw shape. Nothing is coerced, filled, trimmed or corrected. */
function observeShape(content: string | null): StructuralCaseResult["observed"] {
  if (content === null) {
    return { directive_type: null, kind_value: null, kind_is_enum_member: null, kind_present: null, extra_keys: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { directive_type: null, kind_value: null, kind_is_enum_member: null, kind_present: null, extra_keys: null };
  }
  const record = parsed as { communication_directive?: unknown };
  const directive = record?.communication_directive;
  const directiveType = Array.isArray(directive) ? "array" : directive === null ? "null" : typeof directive;
  const directiveKeys = typeof directive === "object" && directive !== null && !Array.isArray(directive)
    ? Object.keys(directive as Record<string, unknown>).sort()
    : [];
  const kind = typeof directive === "object" && directive !== null
    ? (directive as { kind?: unknown }).kind
    : undefined;
  return {
    directive_type: directiveType,
    kind_value: typeof kind === "string" ? kind : kind === undefined ? null : JSON.stringify(kind),
    kind_is_enum_member: typeof kind === "string" ? (ENUM_MEMBERS as readonly string[]).includes(kind) : null,
    kind_present: typeof directive === "object" && directive !== null ? "kind" in (directive as Record<string, unknown>) : null,
    extra_keys: directiveKeys.filter((key) => key !== "kind")
  };
}

async function runCase(input: {
  readonly transport: QualificationTransport;
  readonly caseId: CaseId;
  readonly criterion: string;
  readonly prompt: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly satisfies: (observed: StructuralCaseResult["observed"], accepted: boolean) => boolean | null;
}): Promise<StructuralCaseResult> {
  const outcome = await input.transport.complete({ prompt: input.prompt, schema: input.schema });
  const observed = observeShape(outcome.content);
  let contentJsonValid: boolean | null = null;
  if (outcome.content !== null) {
    try {
      JSON.parse(outcome.content);
      contentJsonValid = true;
    } catch {
      contentJsonValid = false;
    }
  }
  return {
    case_id: input.caseId,
    prompt: input.prompt,
    criterion: input.criterion,
    http_status: outcome.http_status,
    accepted: outcome.ok,
    content: outcome.content,
    content_json_valid: contentJsonValid,
    observed,
    constraint_satisfied: input.satisfies(observed, outcome.ok),
    error_class: outcome.error_class,
    error_message: outcome.error_message,
    elapsed_ms: outcome.elapsed_ms
  };
}

/**
 * Runs Gate S for ONE candidate. Cases execute CONDITIONALLY: a rejected feature
 * ends the candidate immediately (no further calls), and each case makes at most one
 * logical generation with no retry of a constraint failure.
 */
export async function runCandidateQualification(input: {
  readonly candidate: CandidateDefinition;
  readonly transport: QualificationTransport | null;
  readonly credentialAvailable: boolean;
  readonly priorEvidence?: { readonly strictFeatureUnavailable: boolean; readonly note: string } | undefined;
  readonly maxCalls?: number | undefined;
}): Promise<CandidateQualificationResult> {
  const { candidate } = input;
  const budget = Math.min(input.maxCalls ?? MAX_CALLS_PER_CANDIDATE, MAX_CALLS_PER_CANDIDATE);

  // --- negative control: reuse frozen evidence, make NO call ------------------
  if (input.transport === null || candidate.role === "NEGATIVE_STRUCTURAL_CONTROL") {
    return {
      candidate,
      credential_available: input.credentialAvailable,
      calls: 0,
      structural_cases: [],
      criteria: { S1: false, S2: null, S3: null, S4: null, S5: null, S6: null, S7: true, S8: true, S9: true, S10: false },
      full_v8_schema_accepted: null,
      max_length_semantics: "UNVERIFIED",
      host_repair_used: false,
      retries: 0,
      structural_gate: "STRICT_FEATURE_UNAVAILABLE",
      note:
        input.priorEvidence?.note ??
        "no credential or transport available; not tested in this slice"
    };
  }

  const cases: StructuralCaseResult[] = [];
  const call = async (
    caseId: CaseId,
    criterion: string,
    prompt: string,
    schema: Readonly<Record<string, unknown>>,
    satisfies: (observed: StructuralCaseResult["observed"], accepted: boolean) => boolean | null
  ): Promise<StructuralCaseResult> => {
    if (cases.length >= budget) throw new Error("QUALIFICATION_BUDGET_EXHAUSTED");
    const result = await runCase({ transport: input.transport as QualificationTransport, caseId, criterion, prompt, schema, satisfies });
    cases.push(result);
    return result;
  };

  // S1 — feature acceptance (benign prompt).
  const s1 = await call(
    "S1_MINIMAL_SCHEMA_ACCEPTANCE",
    "S1",
    ADVERSARIAL_PROMPTS.benign,
    MINIMAL_STRUCTURAL_SCHEMA,
    (_observed, accepted) => (accepted ? true : false)
  );
  if (!s1.accepted) {
    return {
      candidate,
      credential_available: input.credentialAvailable,
      calls: cases.length,
      structural_cases: cases,
      criteria: { S1: false, S2: null, S3: null, S4: null, S5: null, S6: null, S7: true, S8: true, S9: true, S10: false },
      full_v8_schema_accepted: null,
      max_length_semantics: "UNVERIFIED",
      host_repair_used: false,
      retries: 0,
      structural_gate: "STRICT_FEATURE_UNAVAILABLE",
      note: `the constraint was rejected: http ${String(s1.http_status)} ${String(s1.error_message).slice(0, 200)}`
    };
  }

  // S2 — a prompt demanding a bare string must not defeat the object shape.
  const s2 = await call(
    "S2_NESTED_OBJECT_VS_BARE_STRING",
    "S2",
    ADVERSARIAL_PROMPTS.bare_string,
    MINIMAL_STRUCTURAL_SCHEMA,
    (observed) => observed.directive_type === "object"
  );
  // S3 + S5 — a prompt demanding a non-enum value and an extra key.
  const s3 = await call(
    "S3_ENUM_AND_CLOSED_KEYS",
    "S3/S5",
    ADVERSARIAL_PROMPTS.invalid_enum_and_extra_key,
    MINIMAL_STRUCTURAL_SCHEMA,
    (observed) =>
      observed.kind_is_enum_member === true && Array.isArray(observed.extra_keys) && observed.extra_keys.length === 0
  );
  // S4 — a prompt demanding an object with no `kind`.
  const s4 = await call(
    "S4_REQUIRED_KEY",
    "S4",
    ADVERSARIAL_PROMPTS.missing_required,
    MINIMAL_STRUCTURAL_SCHEMA,
    (observed) => observed.kind_present === true
  );
  // S6 — the FULL canonical V8 schema must be accepted as the constraint.
  const s6 = await call(
    "S6_FULL_V8_SCHEMA_ACCEPTANCE",
    "S6",
    ADVERSARIAL_PROMPTS.benign,
    CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as Readonly<Record<string, unknown>>,
    (_observed, accepted) => (accepted ? true : false)
  );

  const criteria: Record<string, boolean | null> = {
    S1: s1.constraint_satisfied === true,
    S2: s2.constraint_satisfied === true,
    S3: s3.observed.kind_is_enum_member === true,
    S4: s4.observed.kind_present === true,
    S5: Array.isArray(s3.observed.extra_keys) && s3.observed.extra_keys.length === 0,
    S6: s6.accepted,
    S7: true,
    S8: true,
    S9: true,
    S10: s2.constraint_satisfied === true && s3.constraint_satisfied === true && s4.constraint_satisfied === true
  };
  const gate =
    criteria.S1 === true &&
    criteria.S2 === true &&
    criteria.S3 === true &&
    criteria.S4 === true &&
    criteria.S5 === true
      ? criteria.S6 === true
        ? "STRUCTURAL_GATE_PASS"
        : "FULL_V8_SCHEMA_UNSUPPORTED"
      : "CONSTRAINT_ENFORCEMENT_INCOMPLETE";

  return {
    candidate,
    credential_available: input.credentialAvailable,
    calls: cases.length,
    structural_cases: cases,
    criteria,
    full_v8_schema_accepted: s6.accepted,
    max_length_semantics: "UNVERIFIED",
    host_repair_used: false,
    retries: 0,
    structural_gate: gate,
    note:
      gate === "STRUCTURAL_GATE_PASS"
        ? "every Gate S criterion held; the candidate is ELIGIBLE for the separate Gate C cognitive qualification, which this slice does not run"
        : "at least one Gate S criterion did not hold under adversarial prompting; no repair, coercion or retry was applied to change that"
  };
}

export interface QualificationArtifact {
  readonly schema_version: typeof QUALIFICATION_ARTIFACT_SCHEMA_VERSION;
  readonly qualification_id: typeof QUALIFICATION_ID;
  readonly namespace: typeof QUALIFICATION_NAMESPACE;
  readonly markers: typeof QUALIFICATION_MARKERS;
  readonly rubric: {
    readonly hash: string;
    readonly frozen_before_any_candidate_call: true;
    readonly criteria: readonly string[];
    readonly result_states: readonly string[];
    readonly budget: { readonly per_candidate: number; readonly total: number };
  };
  readonly minimal_structural_schema: Readonly<Record<string, unknown>>;
  readonly adversarial_prompts: typeof ADVERSARIAL_PROMPTS;
  readonly candidates: readonly CandidateQualificationResult[];
  readonly total_candidate_calls: number;
  readonly full_v8_schema_hash: string;
  readonly gate_c_plan: typeof GATE_C_PLAN;
  readonly limitations: readonly string[];
  readonly artifact_hash?: string;
}

export function assembleArtifact(results: readonly CandidateQualificationResult[]): QualificationArtifact {
  return {
    schema_version: QUALIFICATION_ARTIFACT_SCHEMA_VERSION,
    qualification_id: QUALIFICATION_ID,
    namespace: QUALIFICATION_NAMESPACE,
    markers: QUALIFICATION_MARKERS,
    rubric: {
      hash: QUALIFICATION_RUBRIC_HASH,
      frozen_before_any_candidate_call: true,
      criteria: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"],
      result_states: GATE_S_RESULT_STATES(),
      budget: { per_candidate: MAX_CALLS_PER_CANDIDATE, total: MAX_TOTAL_CANDIDATE_CALLS }
    },
    minimal_structural_schema: MINIMAL_STRUCTURAL_SCHEMA,
    adversarial_prompts: ADVERSARIAL_PROMPTS,
    candidates: results,
    total_candidate_calls: results.reduce((total, result) => total + result.calls, 0),
    full_v8_schema_hash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
    gate_c_plan: GATE_C_PLAN,
    limitations: [
      "ENGINEERING EXECUTOR QUALIFICATION ONLY: not a calibration, not a Belief experiment, not readiness evidence and not a scientific observation.",
      "Gate S covers STRUCTURE only. Passing it says nothing about cognition, and no candidate is ranked by model name, size or reputation here.",
      "The local Ollama path is a POSITIVE STRUCTURAL CONTROL that validates the harness; it is never an automatic winner and its small local model is not a cognition claim.",
      "The DeepSeek API is a NEGATIVE STRUCTURAL CONTROL: its frozen capability evidence is reused and the endpoint is NOT re-probed in this slice.",
      "Provider-side maxLength semantics are UNVERIFIED for every candidate: the unit (code points vs bytes vs code units) was not established by a boundary probe, and compatibility is never assumed.",
      "No candidate is switched into the formal executor, no preregistration is created and no calibration is authorized by this artifact."
    ]
  };
}

function GATE_S_RESULT_STATES(): readonly string[] {
  return GATE_S_RUBRIC.result_states;
}
