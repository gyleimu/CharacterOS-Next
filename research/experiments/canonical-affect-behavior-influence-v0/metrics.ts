/**
 * CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — measurement.
 *
 * Input-equality audit (§11/§26), structured output distance (§46), and the
 * paired A/B vs ablated contrast (§45). All metrics are direct
 * machine-verifiable functions over actual provider inputs and the actual
 * CognitionProposalV0 fields — no embeddings, no LLM-as-judge, no invented
 * scores.
 */

import { canonicalJson, equal, sha256 } from "./fixtures.ts";
import { ABLATION_NEUTRAL_AFFECT_SECTION } from "./contract.ts";

/** The fields whose difference is EXPECTED between arms (§11). */
export const EXPECTED_DIFFERING_FIELDS = Object.freeze(["canonical_affect", "projection_hash"]);

/** §26 — automated structural diff between the A and B provider inputs.
 * Aborts the causal interpretation unless the ONLY differing top-level
 * fields are canonical_affect and the projection_hash binding it. */
export function auditProviderInputPair(
  inputA: unknown,
  inputB: unknown
): { readonly non_affect_provider_input_equal: boolean; readonly differing_fields: readonly string[]; readonly expected_differing_fields: readonly string[] } {
  const a = inputA as Record<string, unknown>;
  const b = inputB as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const differing: string[] = [];
  for (const key of keys) {
    if (!equal(a[key], b[key])) differing.push(key);
  }
  differing.sort();
  const expected = [...EXPECTED_DIFFERING_FIELDS].sort();
  const nonAffectEqual = differing.length === expected.length && expected.every((f) => differing.includes(f));
  return { non_affect_provider_input_equal: nonAffectEqual, differing_fields: differing, expected_differing_fields: expected };
}

/** §25 — deterministic provider-input hash over the exact captured input. */
export function providerInputHash(providerInput: unknown): string {
  return sha256(canonicalJson(providerInput));
}

/** Ablated-input equality: with the EXPERIMENTAL_ABLATION_ONLY transform
 * applied, A-ablated and B-ablated provider inputs must be BYTE-IDENTICAL
 * (the provider cannot distinguish arms by any field, including the hash). */
export function ablatedInputsIdentical(ablatedA: unknown, ablatedB: unknown): boolean {
  return equal(ablatedA, ablatedB);
}

/** The neutral section substituted by the ablation (audit evidence). */
export function ablationSection(): unknown {
  return { ...ABLATION_NEUTRAL_AFFECT_SECTION };
}

export interface CognitionOutputEndpoints {
  readonly current_intent: string | null;
  readonly confidence: number;
  readonly uncertainty: number;
  readonly action_intent: string | null;
  readonly reasoning_summary_length: number;
}

/** §14/§15 — Level-1 structured endpoints from the actual proposal fields. */
export function cognitionEndpoints(proposal: unknown): CognitionOutputEndpoints {
  const p = proposal as Record<string, unknown>;
  const actionIntent = p["action_intent"] as Record<string, unknown> | null;
  return {
    current_intent: (p["current_intent"] as string | null) ?? null,
    confidence: p["confidence"] as number,
    uncertainty: p["uncertainty"] as number,
    action_intent: actionIntent === null || actionIntent === undefined ? null : String(actionIntent["action_type"]),
    reasoning_summary_length: String(p["reasoning_summary"] ?? "").length
  };
}

/** §46 — categorical distance over the structured endpoints (0 = identical). */
export function outputDistance(a: CognitionOutputEndpoints, b: CognitionOutputEndpoints): number {
  if (equal(a, b)) return 0;
  return 1;
}

/** Field-level paired disagreement (diagnostic detail for the report). */
export function endpointDisagreements(a: CognitionOutputEndpoints, b: CognitionOutputEndpoints): readonly string[] {
  const fields: string[] = [];
  if (a.current_intent !== b.current_intent) fields.push("current_intent");
  if (a.confidence !== b.confidence) fields.push("confidence");
  if (a.uncertainty !== b.uncertainty) fields.push("uncertainty");
  if (a.action_intent !== b.action_intent) fields.push("action_intent");
  if (a.reasoning_summary_length !== b.reasoning_summary_length) fields.push("reasoning_summary_length");
  return fields;
}
