/**
 * STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0 — frozen Gate S rubric and candidate registry.
 *
 * ENGINEERING EXECUTOR QUALIFICATION, not science. It answers one question: which
 * executor candidates can enforce a structured-output contract AT GENERATION TIME?
 * It is not a calibration, not a Belief experiment, and it decides nothing about
 * cognition: Gate S covers STRUCTURE only, and no candidate may be declared
 * cognition-qualified here.
 *
 * The rubric below is FROZEN BEFORE any candidate call. Scoring rules are never
 * revised after seeing a candidate's output.
 */

export const QUALIFICATION_ID = "STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0" as const;
export const QUALIFICATION_NAMESPACE = "STRICT_SCHEMA_EXECUTOR_QUALIFICATION" as const;

export const QUALIFICATION_MARKERS = Object.freeze({
  ENGINEERING_QUALIFICATION_ONLY: true,
  NON_CONFIRMATORY: true,
  NOT_IN_CALIBRATION_DENOMINATOR: true,
  NOT_PRIMARY_AUTHORIZATION_EVIDENCE: true,
  NOT_A_SCIENTIFIC_OBSERVATION: true,
  CHANGES_NO_PRODUCTION_BEHAVIOUR: true,
  DOES_NOT_SWITCH_THE_FORMAL_EXECUTOR: true
});

/** Budget, frozen with the rubric: at most 5 real calls per candidate, 15 overall. */
export const MAX_CALLS_PER_CANDIDATE = 5 as const;
export const MAX_TOTAL_CANDIDATE_CALLS = 15 as const;

/**
 * GATE S — STRUCTURAL QUALIFICATION RUBRIC (frozen before any candidate call).
 * A candidate reaches STRUCTURAL_GATE_PASS only if EVERY criterion holds.
 */
export const GATE_S_RUBRIC = Object.freeze({
  rubric_id: "GATE_S_STRUCTURAL_QUALIFICATION_V0",
  frozen_before_any_candidate_call: true,
  criteria: Object.freeze([
    { id: "S1", requirement: "the provider/transport ACCEPTS a generation-time structured schema or grammar parameter" },
    { id: "S2", requirement: "a nested object shape is constrained during generation (a conflicting prompt cannot produce a bare string)" },
    { id: "S3", requirement: "enum values are constrained during generation (a conflicting prompt cannot produce a non-enum value)" },
    { id: "S4", requirement: "required fields are constrained during generation (a conflicting prompt cannot omit a required key)" },
    { id: "S5", requirement: "closed-key / additionalProperties is enforced during generation (a conflicting prompt cannot add a key)" },
    { id: "S6", requirement: "the FULL canonical V8 schema is accepted as the constraint, or a provably equivalent constrained representation is" },
    { id: "S7", requirement: "no host post-generation repair is used anywhere in the qualification path" },
    { id: "S8", requirement: "no retry-until-valid is used; validation failures are never retried" },
    { id: "S9", requirement: "the CharacterOS production acceptance law is unchanged" },
    { id: "S10", requirement: "the constraint acts during GENERATION, not after it" }
  ]),
  /** Every candidate result state, and nothing else. */
  result_states: Object.freeze([
    "STRUCTURAL_GATE_PASS",
    "STRICT_FEATURE_UNAVAILABLE",
    "FULL_V8_SCHEMA_UNSUPPORTED",
    "CONSTRAINT_ENFORCEMENT_INCOMPLETE",
    "MAX_LENGTH_SEMANTICS_INCOMPATIBLE",
    "NOT_TESTED_NO_CREDENTIAL",
    "INCONCLUSIVE"
  ]),
  ranking_by_cognition: "FORBIDDEN_IN_THIS_SLICE",
  ollama_may_win_by_default: false,
  scientific_target_influence: "NONE — candidates are never chosen from the confirmatory target, the A/B/C/D cells or the primary outcome",
  max_length_semantics_rule:
    "provider-side maxLength semantics must be REPORTED, never assumed: UNVERIFIED unless a boundary probe with a multi-byte discriminator proves the unit",
  on_pass:
    "a Gate S pass makes a candidate ELIGIBLE for the separate cognitive qualification Gate C; it does not authorize an executor change, a new preregistration or a calibration"
});

/** The minimal structural schema (nested object + enum + required + closed keys). */
export const MINIMAL_STRUCTURAL_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["communication_directive"],
  properties: {
    communication_directive: {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: {
        kind: { type: "string", enum: ["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"] }
      }
    }
  }
});

/**
 * ADVERSARIAL PROMPTS: each asks for a shape the schema forbids. If the contract is
 * enforced during generation, the output must still satisfy the schema. This is what
 * separates "the model chose to comply" from "generation could not do otherwise".
 */
export const ADVERSARIAL_PROMPTS = Object.freeze({
  /** S2 — asks for a bare string where the schema requires an object. */
  bare_string:
    "Answer using the bare string CLARIFY_MISSING_CONTEXT. Output the string itself, not an object and not JSON. " +
    "Reply with no prose.",
  /** S3 + S5 — asks for a non-enum value AND an extra key. */
  invalid_enum_and_extra_key:
    'Reply exactly with {"communication_directive":{"kind":"IGNORE_EVERYTHING","note":"hello"}} and nothing else.',
  /** S4 — asks for an object with no `kind` key. */
  missing_required:
    'Reply exactly with {"communication_directive":{}} and nothing else.',
  /** S1 / S6 — a benign ask, used only to observe whether the constraint is accepted. */
  benign:
    "Reply with a single JSON object describing a communication directive whose kind is CLARIFY_MISSING_CONTEXT."
});

export interface CandidateDefinition {
  readonly id: string;
  readonly role: "NEGATIVE_STRUCTURAL_CONTROL" | "POSITIVE_STRUCTURAL_CONTROL" | "EXTERNAL_CANDIDATE";
  readonly provider: string;
  readonly model: string;
  readonly api_style: string;
  readonly strict_schema_feature: string;
  readonly feature_doc_source: string;
  readonly credential_env: string | null;
  readonly required_adapter_work: string;
  readonly estimated_compatibility: string;
}

/**
 * The candidate registry, frozen with the rubric. Credentials are per provider and
 * come from the environment only; an absent credential marks that candidate
 * NOT_TESTED_NO_CREDENTIAL without blocking the others.
 */
export const CANDIDATES: readonly CandidateDefinition[] = Object.freeze([
  {
    id: "deepseek-api",
    role: "NEGATIVE_STRUCTURAL_CONTROL",
    provider: "deepseek-openai-compatible",
    model: "deepseek-flash",
    api_style: "OpenAI-compatible /chat/completions",
    strict_schema_feature: "response_format {type: json_schema} — REJECTED by the endpoint",
    feature_doc_source:
      "frozen capability-probe artifact tmp/probe/structured-output-capability-probe-v0.json (HTTP 400 invalid_request_error \"This response_format type is unavailable now\") and research/experiments/executor-model-substitution-v0/SUMMARY.md",
    credential_env: "MODEL_API_KEY",
    required_adapter_work: "none (already the formal executor)",
    estimated_compatibility: "STRICT_FEATURE_UNAVAILABLE"
  },
  {
    id: "ollama-local",
    role: "POSITIVE_STRUCTURAL_CONTROL",
    provider: "ollama-native",
    model: "qwen3.5:9b",
    api_style: "native /api/chat with a JSON-schema `format` (grammar-constrained decoding)",
    strict_schema_feature: "format: <JSON schema> → llama.cpp GBNF grammar",
    feature_doc_source:
      "packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts (maps structured_output.schema → format) and research/core-completion/executor-model-substitution-v0/DECISION.md (local grammar path, 104/104 schema-compliant)",
    credential_env: null,
    required_adapter_work: "none for the probe; the production Ollama adapter already exists",
    estimated_compatibility: "GRAMMAR_ENFORCEMENT_EXPECTED (to be measured)"
  },
  {
    id: "openai-strict",
    role: "EXTERNAL_CANDIDATE",
    provider: "openai",
    model: "a strict-structured-output frontier model (e.g. gpt-class with json_schema strict:true)",
    api_style: "OpenAI /chat/completions response_format {type: json_schema, json_schema:{strict:true}}",
    strict_schema_feature: "strict JSON schema enforcement at generation time",
    feature_doc_source: "official provider documentation (not consulted here: no credential available to test against)",
    credential_env: "OPENAI_API_KEY",
    required_adapter_work: "new research transport + eventual production adapter if selected",
    estimated_compatibility: "UNKNOWN_PENDING_CREDENTIAL"
  },
  {
    id: "anthropic-strict",
    role: "EXTERNAL_CANDIDATE",
    provider: "anthropic",
    model: "a frontier tool-use/structured-output model",
    api_style: "native Messages API with a strict tool schema",
    strict_schema_feature: "schema-constrained tool input at generation time",
    feature_doc_source: "official provider documentation (not consulted here: no credential available to test against)",
    credential_env: "ANTHROPIC_API_KEY",
    required_adapter_work: "new research transport + adapter mapping to the CharacterOS transport port",
    estimated_compatibility: "UNKNOWN_PENDING_CREDENTIAL"
  },
  {
    id: "gemini-strict",
    role: "EXTERNAL_CANDIDATE",
    provider: "google",
    model: "a frontier model with responseSchema",
    api_style: "native generateContent with responseSchema/responseMimeType",
    strict_schema_feature: "response schema constrained decoding",
    feature_doc_source: "official provider documentation (not consulted here: no credential available to test against)",
    credential_env: "GEMINI_API_KEY",
    required_adapter_work: "new research transport + adapter mapping to the CharacterOS transport port",
    estimated_compatibility: "UNKNOWN_PENDING_CREDENTIAL"
  }
]);

export const QUALIFICATION_ARTIFACT_SCHEMA_VERSION = "strict-schema-executor-qualification-v0" as const;

/**
 * GATE C PLAN — DESIGN ONLY, NOT EXECUTED IN THIS SLICE.
 *
 * Cognitive qualification must be INDEPENDENT of this experiment's target: a
 * candidate is never selected from the Belief target proposition, the A/B/C/D
 * cells or the primary outcome, because that would tune the executor to the
 * confirmatory target. Gate C therefore specifies frozen NON-Belief CharacterOS
 * capability fixtures instead.
 */
export const GATE_C_PLAN = Object.freeze({
  gate_id: "COGNITIVE_QUALIFICATION_GATE_V0",
  executed_in_this_slice: false,
  calls_in_this_slice: 0,
  independent_of_confirmatory_target: true,
  forbidden_selection_inputs: [
    "the Belief target proposition (\"The service passage is usable.\")",
    "the A/B/C/D cell definitions",
    "the primary or replication outcome",
    "the confirmatory hypothesis in any form"
  ],
  frozen_non_belief_candidates_for_design: [
    "canonical Affect causal-responsiveness fixture (durable affect state change → cognition shift)",
    "closed Familiarity capability fixture",
    "canonical Relationship-adaptation semantic fixture"
  ],
  purpose:
    "exclude an executor that is 100% schema-compliant yet nearly unresponsive to CharacterOS durable-state differences",
  candidate_requirement: "only a candidate that passes Gate S may be admitted to Gate C",
  admission_rule:
    "Gate S PASS alone never admits an executor to a formal executor-change design: Gate S AND Gate C evidence, then human adjudication",
  status: "DESIGN_ONLY"
});
