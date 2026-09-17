/**
 * STRUCTURED_OUTPUT_CAPABILITY_PROBE_V0 — frozen capability-probe contract.
 *
 * ENGINEERING CAPABILITY PROBE ONLY. This asks one narrow question: can the
 * current provider/adapter enforce the V8 proposal schema at GENERATION time
 * (strict JSON schema / constrained decoding), or is the current mode syntax-only?
 *
 * It is NOT a calibration, NOT a rerun, NOT readiness or Belief evidence, and it
 * produces no scientific observation. It changes nothing: no production code, no
 * frozen contract, no calibration config, no executor.
 */

export const PROBE_ID = "STRUCTURED_OUTPUT_CAPABILITY_PROBE_V0" as const;
export const PROBE_NAMESPACE = "STRUCTURED_OUTPUT_CAPABILITY_PROBE" as const;

export const PROBE_MARKERS = Object.freeze({
  ENGINEERING_CAPABILITY_PROBE_ONLY: true,
  NON_CONFIRMATORY: true,
  NOT_IN_CALIBRATION_DENOMINATOR: true,
  NOT_PRIMARY_AUTHORIZATION_EVIDENCE: true,
  NOT_A_SCIENTIFIC_OBSERVATION: true,
  CHANGES_NO_PRODUCTION_BEHAVIOUR: true
});

/** Hard ceiling. The probe exists to observe ACCEPTANCE, not to collect samples. */
export const MAX_PROBE_CALLS = 3 as const;

/**
 * The MINIMAL test schema. It exists only to detect whether a nested object with a
 * required enum is enforced at generation time; it can never substitute for the
 * production contract.
 */
export const MINIMAL_NESTED_TEST_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["communication_directive"],
  properties: {
    communication_directive: {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: {
        kind: { enum: ["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"] }
      }
    }
  }
});

/**
 * A prompt that makes the WRONG shape the path of least resistance: it names the
 * enum value but never says "wrap it in an object with a `kind` key". If the
 * provider enforces the schema, generation cannot emit the bare string.
 */
export const MINIMAL_PROBE_PROMPT =
  "Reply with a single JSON object describing a communication directive whose kind is CLARIFY_MISSING_CONTEXT. " +
  "Output JSON only, no prose.";

export const PROBE_STOP_RULE = Object.freeze({
  rule_id: "CAPABILITY_PROBE_STOP_RULE_V0",
  frozen_before_first_call: true,
  max_calls: MAX_PROBE_CALLS,
  stop_after_feature_rejection: true,
  retry_unsupported_feature: false,
  estimates_any_rate: false,
  produces_scientific_evidence: false,
  rationale:
    "a capability question is answered by whether the endpoint ACCEPTS the request; a rejection ends the probe, and no further call is made"
});

/**
 * PRIOR IN-REPO CAPABILITY EVIDENCE. Recorded by an earlier slice that probed this
 * same provider with `response_format: {"type":"json_schema", …}`. Phase A reports
 * it as DOCUMENTED BUT RE-VERIFIABLE: provider capabilities can change, and this
 * probe exists to check today's endpoint rather than trust a past note.
 */
export const PRIOR_CAPABILITY_EVIDENCE = Object.freeze({
  source: "research/experiments/executor-model-substitution-v0/SUMMARY.md and research/core-completion/executor-model-substitution-v0/DECISION.md",
  recorded_finding:
    "response_format {\"type\":\"json_schema\", …} returns 400 \"This response_format type is unavailable now\"; json_object guarantees JSON syntax only",
  local_executor_finding:
    "the LOCAL Ollama transport maps the constraint to grammar-enforced `format`, which is why qwen3.5:9b was 104/104 schema-compliant",
  status: "DOCUMENTED_FROM_A_PRIOR_SLICE__RE_VERIFIABLE_BY_THIS_PROBE"
});

/** The response_format the formal calibration actually sends today. */
export const CURRENT_RESPONSE_FORMAT = Object.freeze({ type: "json_object" }) as Readonly<Record<string, unknown>>;

/**
 * The strict-schema request shape under test (OpenAI-compatible `json_schema`
 * mode). Nothing in this repository sends it today; that is the capability gap
 * the probe measures.
 */
export function strictJsonSchemaRequestFormat(schema: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze({
    type: "json_schema",
    json_schema: Object.freeze({
      name: "characteros_probe_schema",
      strict: true,
      schema
    })
  });
}

/**
 * `maxLength` semantics, disclosed rather than assumed: JSON Schema defines
 * maxLength in Unicode code points, which is the unit production counts, but a
 * provider-side grammar implementation is not bound by that spec text. The probe
 * therefore reports provider-side length semantics as UNVERIFIED unless a call
 * directly tests them, and never treats provider enforcement as equivalent to the
 * CharacterOS code-point law.
 */
export const MAX_LENGTH_SEMANTICS = Object.freeze({
  characteros_production: "UNICODE_CODE_POINTS",
  json_schema_spec: "UNICODE_CODE_POINTS",
  provider_side_implementation: "UNVERIFIED_BY_THIS_PROBE",
  equivalence_assumed: false,
  note:
    "no probe call in this slice exercises a multi-byte length boundary; provider-side maxLength semantics remain unverified and must not be assumed equal to the production code-point law"
});

export const PROBE_ARTIFACT_SCHEMA_VERSION = "structured-output-capability-probe-v0" as const;
