import { ABLATION_NEUTRAL_AFFECT } from "./contract.ts";
import { equal, hashJson } from "./fixtures.ts";

export const EXPECTED_DIFFERING_FIELDS = Object.freeze(["canonical_affect", "projection_hash"] as const);

export interface CognitionEndpoints {
  readonly current_intent: string | null;
  readonly confidence: number;
  readonly uncertainty: number;
  readonly action_intent: string | null;
  readonly reasoning_summary_length: number;
}

export interface NumericDistribution {
  readonly n: number;
  readonly mean: number | null;
  readonly median: number | null;
  readonly min: number | null;
  readonly max: number | null;
}

export function auditProviderInputPair(inputA: unknown, inputB: unknown): {
  readonly non_affect_provider_input_equal: boolean;
  readonly differing_fields: readonly string[];
  readonly expected_differing_fields: readonly string[];
} {
  const a = inputA as Record<string, unknown>;
  const b = inputB as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const differing = [...keys].filter((key) => !equal(a[key], b[key])).sort();
  const expected = [...EXPECTED_DIFFERING_FIELDS].sort();
  return {
    non_affect_provider_input_equal: equal(differing, expected),
    differing_fields: differing,
    expected_differing_fields: expected
  };
}

export function providerInputHash(input: unknown): string {
  return hashJson(input);
}

export function cognitionEndpoints(proposal: unknown): CognitionEndpoints {
  const row = proposal as Record<string, unknown>;
  const action = row["action_intent"] as Record<string, unknown> | null;
  return {
    current_intent: typeof row["current_intent"] === "string" ? row["current_intent"] : null,
    confidence: Number(row["confidence"]),
    uncertainty: Number(row["uncertainty"]),
    action_intent: action === null || action === undefined ? null : String(action["action_type"]),
    reasoning_summary_length: String(row["reasoning_summary"] ?? "").length
  };
}

export function fullOutputDistance(a: CognitionEndpoints, b: CognitionEndpoints): 0 | 1 {
  return equal(a, b) ? 0 : 1;
}

export function cognitionContentDistance(a: CognitionEndpoints, b: CognitionEndpoints): 0 | 1 {
  return a.current_intent === b.current_intent &&
    a.confidence === b.confidence &&
    a.uncertainty === b.uncertainty &&
    a.reasoning_summary_length === b.reasoning_summary_length ? 0 : 1;
}

export function actionIntentDistance(a: CognitionEndpoints, b: CognitionEndpoints): 0 | 1 {
  return a.action_intent === b.action_intent ? 0 : 1;
}

export function endpointDisagreements(a: CognitionEndpoints, b: CognitionEndpoints): readonly (keyof CognitionEndpoints)[] {
  const fields: (keyof CognitionEndpoints)[] = [];
  if (a.current_intent !== b.current_intent) fields.push("current_intent");
  if (a.confidence !== b.confidence) fields.push("confidence");
  if (a.uncertainty !== b.uncertainty) fields.push("uncertainty");
  if (a.action_intent !== b.action_intent) fields.push("action_intent");
  if (a.reasoning_summary_length !== b.reasoning_summary_length) fields.push("reasoning_summary_length");
  return fields;
}

export function actionLabel(proposal: Record<string, unknown>): string {
  const action = proposal["action_intent"] as Record<string, unknown> | null;
  if (action === null || action === undefined) return "NO_ACTION";
  const target = action["target_ref"];
  return `${String(action["action_type"])}@${target === null ? "null" : String(target)}`;
}

export function distribution(values: readonly number[]): NumericDistribution {
  if (values.length === 0) return { n: 0, mean: null, median: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? 0;
  return {
    n: sorted.length,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median,
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null
  };
}

export function neutralAffectSection(): Record<string, unknown> {
  return { ...ABLATION_NEUTRAL_AFFECT };
}
