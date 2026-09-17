/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — evidence-driven taxonomy.
 *
 * Classification runs ONLY on captured validator output. Nothing here guesses a
 * root cause, predicts the likely failure family, or promotes a candidate
 * mechanism to a conclusion: a category is emitted when a captured production
 * string, rejection code or stage outcome supports it, and every emitted category
 * carries the verbatim evidence that produced it.
 */
import type { ValidationTrace } from "./validation-trace.ts";

export type DiagnosticClassification =
  | "PASS"
  | "TRANSPORT_FAILURE"
  | "ENVELOPE_JSON_INVALID"
  | "JSON_SYNTAX_INVALID"
  | "SCHEMA_CONTRACT_VIOLATION"
  | "HOST_AUTHORITY_REJECTED"
  | "RESPONSE_SEMANTICS_REJECTED"
  | "DIRECTIVE_NOT_ADMISSIBLE"
  | "OTHER_SCHEMA_FAILURE";

export interface ClassifiedFailure {
  readonly taxonomy: readonly string[];
  readonly evidence: readonly string[];
}

export interface Classification {
  readonly classification: DiagnosticClassification;
  readonly taxonomy: readonly string[];
  readonly evidence: readonly string[];
}

/** Mechanical keyword tests over the VERBATIM production detail string. */
function taxonomyFromProductionDetail(detail: string): ClassifiedFailure {
  const taxonomy: string[] = [];
  const evidence: string[] = [];
  const add = (category: string, why: string): void => {
    if (!taxonomy.includes(category)) taxonomy.push(category);
    evidence.push(`${category} <- ${why}`);
  };
  if (/unexpected keys/i.test(detail)) add("UNEXPECTED_KEY", "production detail reports unexpected keys");
  if (/expected exactly \[/i.test(detail)) add("CLOSED_KEY_SET_VIOLATION", "production detail enumerates the closed key set");
  if (/schema_version/i.test(detail) && /expected conversation-cognition-proposal/i.test(detail)) {
    add("SCHEMA_VERSION_INVALID", "production detail rejects schema_version");
  }
  if (/projection_hash/i.test(detail)) add("PROJECTION_BINDING_INVALID", "production detail reports a projection binding problem");
  if (/required/i.test(detail) && /(missing|expected)/i.test(detail)) add("REQUIRED_FIELD_MISSING", "production detail mentions a required field");
  if (/expected one of|must be one of|invalid enum/i.test(detail)) add("ENUM_INVALID", "production detail reports an enum violation");
  if (/expected (string|number|integer|boolean|array|object|value)/i.test(detail)) add("TYPE_INVALID", "production detail reports a type expectation");
  if (/source_(handle|ref)|UNKNOWN_SOURCE|SOURCE_QUOTE/i.test(detail)) add("SOURCE_HANDLE_INVALID", "production detail references source binding");
  if (/derivation|claimed_result|operand/i.test(detail)) add("DERIVATION_INVALID", "production detail references derivation verification");
  if (/SEMANTIC_COMPLETENESS_FAILED/i.test(detail)) add("RESPONSE_SEMANTICS_INCOMPLETE", "production semantics marker");
  return { taxonomy, evidence };
}

/**
 * The taxonomy for ONE response, derived from its stage outcomes and from the
 * verbatim production output attached to them.
 */
export function classifyResponse(trace: ValidationTrace): Classification {
  if (trace.STAGE_A_TRANSPORT === "FAIL") {
    return {
      classification: "TRANSPORT_FAILURE",
      taxonomy: ["TRANSPORT_FAILURE"],
      evidence: [`STAGE_A_TRANSPORT=FAIL <- ${String(trace.stage_details.transport)}`]
    };
  }
  if (trace.STAGE_B_ENVELOPE_JSON === "FAIL") {
    return {
      classification: "ENVELOPE_JSON_INVALID",
      taxonomy: ["JSON_SYNTAX_INVALID"],
      evidence: [`STAGE_B_ENVELOPE_JSON=FAIL <- ${String(trace.stage_details.envelope.error)}`]
    };
  }
  if (trace.STAGE_C_CONTENT_JSON === "FAIL") {
    return {
      classification: "JSON_SYNTAX_INVALID",
      taxonomy: ["JSON_SYNTAX_INVALID"],
      evidence: [`STAGE_C_CONTENT_JSON=FAIL <- ${String(trace.stage_details.content_json.error)}`]
    };
  }

  const verdict = trace.production_pipeline_verdict;
  const detail = trace.stage_details.production_schema.detail ?? trace.stage_details.production_host_authority.detail;
  const detailTaxonomy = detail === null ? { taxonomy: [], evidence: [] } : taxonomyFromProductionDetail(detail.raw);
  const factualCodes = trace.stage_details.production_host_authority.factual_rejection_codes;

  if (verdict.threw) {
    if (verdict.code === "FACTUAL_AUTHORIZATION_REJECTED") {
      return {
        classification: "HOST_AUTHORITY_REJECTED",
        taxonomy: [...new Set([...detailTaxonomy.taxonomy, "HOST_AUTHORITY_INVALID", ...(factualCodes.length > 0 ? ["SOURCE_HANDLE_INVALID"] : [])])],
        evidence: [
          `production verdict FACTUAL_AUTHORIZATION_REJECTED <- ${verdict.message ?? ""}`,
          ...factualCodes.map((code) => `factual rejection_code=${code}`),
          ...detailTaxonomy.evidence
        ]
      };
    }
    if (verdict.code === "RESPONSE_SEMANTICS_REJECTED") {
      return {
        classification: "RESPONSE_SEMANTICS_REJECTED",
        taxonomy: [...new Set([...detailTaxonomy.taxonomy, "RESPONSE_SEMANTICS_INCOMPLETE"])],
        evidence: [`production verdict RESPONSE_SEMANTICS_REJECTED <- ${verdict.message ?? ""}`, ...detailTaxonomy.evidence]
      };
    }
    if (verdict.code === "MODEL_SCHEMA_INVALID") {
      const taxonomy = detailTaxonomy.taxonomy.length > 0 ? detailTaxonomy.taxonomy : ["OTHER_SCHEMA_FAILURE"];
      return {
        classification: "SCHEMA_CONTRACT_VIOLATION",
        taxonomy,
        evidence: [`production verdict MODEL_SCHEMA_INVALID <- ${verdict.message ?? ""}`, ...detailTaxonomy.evidence]
      };
    }
    return {
      classification: "OTHER_SCHEMA_FAILURE",
      taxonomy: [...new Set([...detailTaxonomy.taxonomy, "OTHER_SCHEMA_FAILURE"])],
      evidence: [`production verdict ${String(verdict.code)} <- ${verdict.message ?? ""}`, ...detailTaxonomy.evidence]
    };
  }

  if (trace.STAGE_F_DIRECTIVE_ADMISSIBILITY === "FAIL") {
    return {
      classification: "DIRECTIVE_NOT_ADMISSIBLE",
      taxonomy: ["DIRECTIVE_NOT_ADMISSIBLE"],
      evidence: [`STAGE_F=FAIL <- directive ${String(trace.stage_details.directive_admissibility.directive)} not in ${trace.stage_details.directive_admissibility.allowed_atoms.join("|")}`]
    };
  }
  return { classification: "PASS", taxonomy: [], evidence: [] };
}

export interface TaxonomySummary {
  readonly categories_observed: readonly string[];
  readonly counts: Readonly<Record<string, number>>;
  readonly classifications: Readonly<Record<string, number>>;
  readonly examples_by_category: Readonly<Record<string, readonly number[]>>;
  readonly categories_declared_but_unobserved: readonly string[];
}

export function summarizeTaxonomy(
  records: readonly { readonly trial: number; readonly classification: Classification }[],
  declared: readonly string[]
): TaxonomySummary {
  const counts: Record<string, number> = {};
  const classifications: Record<string, number> = {};
  const examples: Record<string, number[]> = {};
  for (const record of records) {
    classifications[record.classification.classification] = (classifications[record.classification.classification] ?? 0) + 1;
    for (const category of record.classification.taxonomy) {
      counts[category] = (counts[category] ?? 0) + 1;
      examples[category] = [...(examples[category] ?? []), record.trial];
    }
  }
  return {
    categories_observed: Object.keys(counts).sort(),
    counts,
    classifications,
    examples_by_category: examples,
    categories_declared_but_unobserved: declared.filter((category) => !(category in counts)).sort()
  };
}
