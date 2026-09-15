/**
 * FACTUAL CLAIM AUTHORIZATION — production policy v0.
 *
 * Model prose is never factual authority merely because it cites a lawful source.
 * This module owns the closed V7 authority surface: exact source quotation and the
 * smallest host-recomputable derivation registry required by production workloads.
 * It has no model, transport, research, or persistence dependency.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import { isRecord, validateCanonicalText, validateRefArray } from "@characteros-next/subject-core";

export const FACTUAL_CLAIM_AUTHORIZATION_POLICY_VERSION_V0 =
  "factual-claim-authorization-policy-v0" as const;

export const HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0 = Object.freeze([
  "INTEGER_ARITHMETIC",
  "STRING_REVERSE",
  "RULE_CLASSIFICATION"
] as const);

export type HostVerifiableDerivationOperationV0 =
  (typeof HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0)[number];

export type FactualClaimAuthorizationRejectionCodeV0 =
  | "REJECTED_UNSUPPORTED_CLAIM_KIND"
  | "REJECTED_DERIVATION_OPERATION"
  | "REJECTED_DERIVATION_INPUT"
  | "REJECTED_DERIVATION_RESULT_MISMATCH"
  | "REJECTED_SOURCE_BINDING"
  | "REJECTED_CLAIM_STRUCTURE";

export interface SourceQuoteClaimV1 {
  readonly kind: "SOURCE_QUOTE";
  readonly text: string;
  readonly source_refs: readonly CanonicalRefV0[];
}

export interface IntegerArithmeticDerivationV0 {
  readonly source_expression: string;
  readonly operands: {
    readonly left: number;
    readonly operator: "ADD" | "SUBTRACT";
    readonly right: number;
  };
  readonly claimed_result: number;
}

export interface StringReverseDerivationV0 {
  readonly source_instruction: string;
  readonly input: string;
  readonly claimed_result: string;
}

export interface RuleClassificationDerivationV0 {
  readonly source_rule: string;
  readonly source_query: string;
  readonly claimed_result: string;
}

export type HostVerifiableDerivationInputV0 =
  | IntegerArithmeticDerivationV0
  | StringReverseDerivationV0
  | RuleClassificationDerivationV0;

export interface HostVerifiableDerivationClaimV1 {
  readonly kind: "HOST_VERIFIABLE_DERIVATION";
  readonly operation: HostVerifiableDerivationOperationV0;
  readonly source_refs: readonly CanonicalRefV0[];
  readonly derivation: HostVerifiableDerivationInputV0;
  /** Host-rendered canonical text; model prose never occupies this field. */
  readonly text: string;
}

export type FactualAssessmentClaimV1 = SourceQuoteClaimV1 | HostVerifiableDerivationClaimV1;

export interface FactualAssessmentV1 {
  readonly claims: readonly FactualAssessmentClaimV1[];
}

export type FactualClaimAuthorizationV0 =
  | {
      readonly status: "AUTHORIZED_SOURCE_QUOTE" | "AUTHORIZED_DERIVED_RESULT";
      readonly authoritative_claim: FactualAssessmentClaimV1;
    }
  | {
      readonly status: "REJECTED";
      readonly code: FactualClaimAuthorizationRejectionCodeV0;
      readonly detail: string;
    };

export interface FactualClaimAuthorizationTraceV0 {
  readonly policy_version: typeof FACTUAL_CLAIM_AUTHORIZATION_POLICY_VERSION_V0;
  readonly status: FactualClaimAuthorizationV0["status"];
  readonly rejection_code: FactualClaimAuthorizationRejectionCodeV0 | null;
  readonly claim_kind: string | null;
  readonly operation: string | null;
  readonly raw_claim: unknown;
  readonly canonical_source_refs: readonly CanonicalRefV0[];
}

export type FactualSourceTextResolverV0 = (
  ref: CanonicalRefV0
) => readonly string[] | null;

const SOURCE_QUOTE_KEYS = Object.freeze(["kind", "text", "source_refs"]);
const DERIVATION_KEYS = Object.freeze(["kind", "operation", "source_refs", "derivation"]);
const INTEGER_KEYS = Object.freeze(["source_expression", "operands", "claimed_result"]);
const INTEGER_OPERAND_KEYS = Object.freeze(["left", "operator", "right"]);
const REVERSE_KEYS = Object.freeze(["source_instruction", "input", "claimed_result"]);
const CLASSIFICATION_KEYS = Object.freeze(["source_rule", "source_query", "claimed_result"]);

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function rejected(
  code: FactualClaimAuthorizationRejectionCodeV0,
  detail: string
): FactualClaimAuthorizationV0 {
  return { status: "REJECTED", code, detail };
}

function canonicalText(value: unknown, detail: string): string | null {
  const checked = validateCanonicalText(value, detail);
  if (!checked.ok || checked.value.trim().length === 0 || [...checked.value].length > 512) return null;
  return checked.value;
}

function canonicalRefs(value: unknown): readonly CanonicalRefV0[] | null {
  const checked = validateRefArray(value, "factual claim.source_refs", { sorted: true });
  if (!checked.ok || !Array.isArray(value) || value.length === 0) return null;
  return Object.freeze([...(value as readonly CanonicalRefV0[])]);
}

function presentInEverySource(
  exactText: string,
  refs: readonly CanonicalRefV0[],
  sourceTexts: FactualSourceTextResolverV0
): boolean {
  return refs.every((ref) => {
    const texts = sourceTexts(ref);
    return texts !== null && texts.some((source) => source.includes(exactText));
  });
}

function parseIntegerExpression(expression: string): {
  readonly left: number;
  readonly operator: "ADD" | "SUBTRACT";
  readonly right: number;
} | null {
  const match = /^(-?(?:0|[1-9]\d*))\s*([+-])\s*(-?(?:0|[1-9]\d*))$/u.exec(expression);
  if (match === null) return null;
  const left = Number(match[1]);
  const right = Number(match[3]);
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) return null;
  return { left, operator: match[2] === "+" ? "ADD" : "SUBTRACT", right };
}

function authorizeIntegerArithmetic(
  derivation: Record<string, unknown>,
  refs: readonly CanonicalRefV0[],
  sourceTexts: FactualSourceTextResolverV0
): FactualClaimAuthorizationV0 {
  if (!exactKeys(derivation, INTEGER_KEYS) || !isRecord(derivation["operands"])) {
    return rejected("REJECTED_DERIVATION_INPUT", "INTEGER_ARITHMETIC requires closed source_expression/operands/claimed_result");
  }
  const operands = derivation["operands"] as Record<string, unknown>;
  if (!exactKeys(operands, INTEGER_OPERAND_KEYS)) {
    return rejected("REJECTED_DERIVATION_INPUT", "INTEGER_ARITHMETIC operands must be left/operator/right");
  }
  const expression = canonicalText(derivation["source_expression"], "INTEGER_ARITHMETIC.source_expression");
  const parsed = expression === null ? null : parseIntegerExpression(expression);
  const left = operands["left"];
  const operator = operands["operator"];
  const right = operands["right"];
  const claimed = derivation["claimed_result"];
  if (
    expression === null ||
    parsed === null ||
    !Number.isSafeInteger(left) ||
    (operator !== "ADD" && operator !== "SUBTRACT") ||
    !Number.isSafeInteger(right) ||
    !Number.isSafeInteger(claimed) ||
    parsed.left !== left ||
    parsed.operator !== operator ||
    parsed.right !== right
  ) {
    return rejected("REJECTED_DERIVATION_INPUT", "INTEGER_ARITHMETIC structured operands do not exactly match the cited expression");
  }
  // The compound guard above proves both values are present; keep the narrowed
  // canonical expression explicit for strict-null TypeScript configurations.
  const canonicalExpression = expression as string;
  if (!presentInEverySource(canonicalExpression, refs, sourceTexts)) {
    return rejected("REJECTED_SOURCE_BINDING", "INTEGER_ARITHMETIC source_expression is not an exact substring of every cited source");
  }
  const recomputed = operator === "ADD" ? left + right : left - right;
  if (!Number.isSafeInteger(recomputed) || claimed !== recomputed) {
    return rejected("REJECTED_DERIVATION_RESULT_MISMATCH", "INTEGER_ARITHMETIC claimed_result does not equal the host result");
  }
  const text = `${left} ${operator === "ADD" ? "+" : "-"} ${right} = ${recomputed}.`;
  return {
    status: "AUTHORIZED_DERIVED_RESULT",
    authoritative_claim: Object.freeze({
      kind: "HOST_VERIFIABLE_DERIVATION",
      operation: "INTEGER_ARITHMETIC",
      source_refs: refs,
      derivation: Object.freeze({
        source_expression: canonicalExpression,
        operands: Object.freeze({ left, operator, right }),
        claimed_result: recomputed
      }),
      text
    })
  };
}

function authorizeStringReverse(
  derivation: Record<string, unknown>,
  refs: readonly CanonicalRefV0[],
  sourceTexts: FactualSourceTextResolverV0
): FactualClaimAuthorizationV0 {
  if (!exactKeys(derivation, REVERSE_KEYS)) {
    return rejected("REJECTED_DERIVATION_INPUT", "STRING_REVERSE requires closed source_instruction/input/claimed_result");
  }
  const instruction = canonicalText(derivation["source_instruction"], "STRING_REVERSE.source_instruction");
  const input = canonicalText(derivation["input"], "STRING_REVERSE.input");
  const claimed = canonicalText(derivation["claimed_result"], "STRING_REVERSE.claimed_result");
  if (instruction === null || input === null || claimed === null) {
    return rejected("REJECTED_DERIVATION_INPUT", "STRING_REVERSE fields must be bounded canonical text");
  }
  const parsed = /^Reverse the characters in the token (.+)\.$/u.exec(instruction);
  if (parsed === null || parsed[1] !== input) {
    return rejected("REJECTED_DERIVATION_INPUT", "STRING_REVERSE input does not exactly match the supplied instruction");
  }
  if (!presentInEverySource(instruction, refs, sourceTexts)) {
    return rejected("REJECTED_SOURCE_BINDING", "STRING_REVERSE source_instruction is not an exact substring of every cited source");
  }
  const recomputed = [...input].reverse().join("");
  if (claimed !== recomputed) {
    return rejected("REJECTED_DERIVATION_RESULT_MISMATCH", "STRING_REVERSE claimed_result does not equal the host result");
  }
  return {
    status: "AUTHORIZED_DERIVED_RESULT",
    authoritative_claim: Object.freeze({
      kind: "HOST_VERIFIABLE_DERIVATION",
      operation: "STRING_REVERSE",
      source_refs: refs,
      derivation: Object.freeze({ source_instruction: instruction, input, claimed_result: recomputed }),
      text: `The reverse of ${JSON.stringify(input)} is ${JSON.stringify(recomputed)}.`
    })
  };
}

function authorizeRuleClassification(
  derivation: Record<string, unknown>,
  refs: readonly CanonicalRefV0[],
  sourceTexts: FactualSourceTextResolverV0
): FactualClaimAuthorizationV0 {
  if (!exactKeys(derivation, CLASSIFICATION_KEYS)) {
    return rejected("REJECTED_DERIVATION_INPUT", "RULE_CLASSIFICATION requires closed source_rule/source_query/claimed_result");
  }
  const rule = canonicalText(derivation["source_rule"], "RULE_CLASSIFICATION.source_rule");
  const query = canonicalText(derivation["source_query"], "RULE_CLASSIFICATION.source_query");
  const claimed = canonicalText(derivation["claimed_result"], "RULE_CLASSIFICATION.claimed_result");
  if (rule === null || query === null || claimed === null) {
    return rejected("REJECTED_DERIVATION_INPUT", "RULE_CLASSIFICATION fields must be bounded canonical text");
  }
  const ruleMatch = /^A token is (\S+) iff its first and last characters are identical\.$/u.exec(rule);
  const queryMatch = /^Classify (\S+)\.$/u.exec(query);
  if (ruleMatch === null || queryMatch === null) {
    return rejected("REJECTED_DERIVATION_INPUT", "RULE_CLASSIFICATION requires the admitted explicit first/last-character rule and query forms");
  }
  if (!presentInEverySource(rule, refs, sourceTexts) || !presentInEverySource(query, refs, sourceTexts)) {
    return rejected("REJECTED_SOURCE_BINDING", "RULE_CLASSIFICATION rule/query is not an exact substring of every cited source");
  }
  const input = queryMatch[1] as string;
  const points = [...input];
  if (points.length === 0 || points[0] !== points.at(-1)) {
    return rejected("REJECTED_DERIVATION_INPUT", "the admitted rule does not define a result for this non-matching input");
  }
  const recomputed = ruleMatch[1] as string;
  if (claimed !== recomputed) {
    return rejected("REJECTED_DERIVATION_RESULT_MISMATCH", "RULE_CLASSIFICATION claimed_result does not equal the host result");
  }
  return {
    status: "AUTHORIZED_DERIVED_RESULT",
    authoritative_claim: Object.freeze({
      kind: "HOST_VERIFIABLE_DERIVATION",
      operation: "RULE_CLASSIFICATION",
      source_refs: refs,
      derivation: Object.freeze({ source_rule: rule, source_query: query, claimed_result: recomputed }),
      text: `The supplied first/last-character rule classifies ${JSON.stringify(input)} as ${JSON.stringify(recomputed)}.`
    })
  };
}

/** Authorize one already handle-canonicalized V7 claim. */
export function authorizeFactualClaimV1(
  value: unknown,
  sourceTexts: FactualSourceTextResolverV0
): FactualClaimAuthorizationV0 {
  if (!isRecord(value)) return rejected("REJECTED_CLAIM_STRUCTURE", "factual claim must be an object");
  const refs = canonicalRefs(value["source_refs"]);
  if (refs === null) return rejected("REJECTED_CLAIM_STRUCTURE", "factual claim requires nonempty canonical sorted source_refs");

  if (value["kind"] === "SOURCE_QUOTE") {
    if (!exactKeys(value, SOURCE_QUOTE_KEYS)) {
      return rejected("REJECTED_CLAIM_STRUCTURE", "SOURCE_QUOTE requires exactly kind/text/source_refs");
    }
    const text = canonicalText(value["text"], "SOURCE_QUOTE.text");
    if (text === null) return rejected("REJECTED_CLAIM_STRUCTURE", "SOURCE_QUOTE text is invalid");
    if (!presentInEverySource(text, refs, sourceTexts)) {
      return rejected("REJECTED_SOURCE_BINDING", "SOURCE_QUOTE is not an exact substring of every cited source");
    }
    return {
      status: "AUTHORIZED_SOURCE_QUOTE",
      authoritative_claim: Object.freeze({ kind: "SOURCE_QUOTE", text, source_refs: refs })
    };
  }

  if (value["kind"] !== "HOST_VERIFIABLE_DERIVATION") {
    return rejected("REJECTED_UNSUPPORTED_CLAIM_KIND", "only SOURCE_QUOTE or HOST_VERIFIABLE_DERIVATION may become factual authority");
  }
  if (!exactKeys(value, DERIVATION_KEYS) || !isRecord(value["derivation"])) {
    return rejected("REJECTED_CLAIM_STRUCTURE", "HOST_VERIFIABLE_DERIVATION requires exactly kind/operation/source_refs/derivation");
  }
  const operation = value["operation"];
  if (!HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0.includes(operation as HostVerifiableDerivationOperationV0)) {
    return rejected("REJECTED_DERIVATION_OPERATION", `unsupported host-verifiable operation ${String(operation)}`);
  }
  if (operation === "INTEGER_ARITHMETIC") {
    return authorizeIntegerArithmetic(value["derivation"], refs, sourceTexts);
  }
  if (operation === "STRING_REVERSE") {
    return authorizeStringReverse(value["derivation"], refs, sourceTexts);
  }
  return authorizeRuleClassification(value["derivation"], refs, sourceTexts);
}

export function factualAuthorizationTraceV0(
  rawClaim: unknown,
  canonicalSourceRefs: readonly CanonicalRefV0[],
  authorization: FactualClaimAuthorizationV0
): FactualClaimAuthorizationTraceV0 {
  const claim = isRecord(rawClaim) ? rawClaim : null;
  return Object.freeze({
    policy_version: FACTUAL_CLAIM_AUTHORIZATION_POLICY_VERSION_V0,
    status: authorization.status,
    rejection_code: authorization.status === "REJECTED" ? authorization.code : null,
    claim_kind: typeof claim?.["kind"] === "string" ? claim["kind"] as string : null,
    operation: typeof claim?.["operation"] === "string" ? claim["operation"] as string : null,
    raw_claim: rawClaim,
    canonical_source_refs: Object.freeze([...canonicalSourceRefs])
  });
}
