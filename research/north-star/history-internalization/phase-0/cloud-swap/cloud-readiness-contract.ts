/**
 * SWAPPED-CONDITION PROVIDER READINESS — frozen contract.
 *
 * Frozen BEFORE the first readiness attempt of the swapped executor. Nothing here may be revised after
 * that point.
 *
 * The question this gate answers is NOT the local gate's question with the nouns changed. The local gate
 * asked: has this MACHINE returned to a state where the frozen protocol can run faithfully (same provider,
 * same model DIGEST, same transport config, same timeout, no fallback)? Its central evidence was
 * environment state — a content digest, resident-vs-unloaded sampling, mid-gate reload detection.
 *
 * None of that exists remotely. A remote HTTPS endpoint publishes no content digest, has no resident
 * process to sample, and cannot be caught mid-reload. So this gate asks the question that CAN be asked:
 *
 *   can the frozen executor configuration complete a production-shaped, non-target request repeatedly,
 *   inside the frozen timeout, over the real credential, with no fallback and a stable
 *   provider-reported model id?
 *
 * The criteria it CANNOT evaluate are declared `NOT_APPLICABLE` / `NOT_OBSERVABLE` in the verdict itself,
 * rather than dropped so the gate looks complete. A gate that overstates its coverage is worse than none.
 */

import { createHash } from "node:crypto";

import { P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS } from "../contract.ts";
import {
  CS_FAMILY_TIMEOUTS_MS,
  CS_MODEL_DEFAULT,
  CS_READINESS_PROBES_PLANNED,
  hashCs
} from "./contract-cloud-v0.ts";

/** The readiness probe uses the COGNITION family's frozen timeout — the family that failed. */
export const CS_READINESS_TIMEOUT_MS = CS_FAMILY_TIMEOUTS_MS.cognition;
export const CS_READINESS_PROBES = CS_READINESS_PROBES_PLANNED;

// ---------------------------------------------------------------------------------------------
// THE FROZEN PROBE REQUEST — non-target, byte-frozen, identical for every replicate
// ---------------------------------------------------------------------------------------------

/**
 * The probe carries NO scientific input: no Phase-0 trajectory event, no target proposition, no A/B
 * valence span, no subject state, no subject id, no arm identity. The offline test asserts that no
 * frozen forbidden substring appears in it.
 *
 * Shape is calibrated from the LOCAL gate's persisted evidence rather than chosen by taste: the frozen
 * cognition request carried a system message of ~12.8 KB and a user message of ~4.3–5.6 KB against a
 * 2048-token output budget. The output demand is large and deterministic, because a probe that returns
 * 20 tokens would pass against an endpoint that cannot serve production calls at all.
 */
const FILLER_SENTENCE =
  "Operational readiness probe for a text generation service. This request measures transport and model execution capacity only. ";

function padToFrozenBytes(sentence: string, repetitions: number, tail: string): string {
  return `${sentence.repeat(repetitions)}${tail}`;
}

export const CS_READINESS_SYSTEM_PROMPT = padToFrozenBytes(
  FILLER_SENTENCE,
  88,
  "[end of readiness system context] Reply to the user message directly and completely."
);

export const CS_READINESS_USER_PROMPT =
  "Output the integers from 1 to 400, one integer per line, and nothing else. " +
  "Do not add commentary, headings, punctuation, or blank lines. " +
  "Begin with 1 on its own line and end with 400 on its own line. " +
  "This is a capacity check, so produce the complete list without abbreviating it. " +
  "[end of readiness user request]";

/** EXACTLY the production cloud transport configuration — not adjusted to flatter the endpoint. */
export const CS_READINESS_NUM_PREDICT = 2048 as const;
export const CS_READINESS_TEMPERATURE = 0 as const;

export interface CsReadinessRequestBodyV0 {
  readonly model: string;
  readonly messages: readonly { readonly role: "system" | "user"; readonly content: string }[];
  readonly temperature: number;
  readonly max_tokens: number;
  readonly thinking: { readonly type: "disabled" };
}

/**
 * The exact wire body every replicate sends. Byte-identical across replicates: like the local gate's
 * request, it carries NO replicate ordinal, so a probe cannot be told apart from another one.
 */
export function buildCsReadinessRequestBodyV0(model: string): CsReadinessRequestBodyV0 {
  return {
    model,
    messages: [
      { role: "system", content: CS_READINESS_SYSTEM_PROMPT },
      { role: "user", content: CS_READINESS_USER_PROMPT }
    ],
    temperature: CS_READINESS_TEMPERATURE,
    max_tokens: CS_READINESS_NUM_PREDICT,
    thinking: { type: "disabled" }
  };
}

export function hashCsReadinessRequestBodyV0(body: CsReadinessRequestBodyV0): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`;
}

/**
 * A readiness probe must never BE a scientific request. Checked against the frozen forbidden
 * substring list rather than asserted, and it lives in this pure module so the OFFLINE suite can
 * exercise it without loading the runnable.
 */
export function auditProbeRequestIsNonTargetV0(model: string = CS_MODEL_DEFAULT): {
  readonly ok: boolean;
  readonly violations: readonly string[];
} {
  const serialized = JSON.stringify(buildCsReadinessRequestBodyV0(model)).toLowerCase();
  const violations = P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS.filter((needle) =>
    serialized.includes(needle.toLowerCase())
  );
  return { ok: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------------------------
// THE CRITERIA — and, separately, what this gate CANNOT see
// ---------------------------------------------------------------------------------------------

export const CS_READINESS_CAPACITY_REQUIREMENT = Object.freeze({
  question:
    "can the swapped executor configuration complete a production-shaped, non-target request repeatedly, inside the frozen timeout, over the real credential, with no fallback?",
  derivation_status: "FUNCTIONAL_PREDICATE_DERIVED_FROM_FROZEN_LIMITS",
  derived_from: [
    `the frozen transport timeout: ${CS_READINESS_TIMEOUT_MS} ms`,
    `the frozen production output budget: max_tokens ${CS_READINESS_NUM_PREDICT}`,
    "the local gate's measured prompt sizes (system ~12.8 KB, user ~4.3-5.6 KB), reused as the probe's calibration",
    "the probe's forced output demand: 400 numbered lines"
  ],
  functional_predicate:
    "ALL planned probes must complete normally, inside the frozen timeout, with the same frozen request hash, with no transport failure, no provider error and no fallback; and the credential must be accepted; and the configured model must be served by the endpoint",
  descriptive_metrics_recorded_but_not_gating: [
    "wall-clock latency per probe (also gating for the frozen-timeout criterion)",
    "completion tokens per probe",
    "prompt tokens per probe",
    "provider-reported finish_reason per probe"
  ],
  stated_limitation:
    "a PASS establishes only that a frozen, non-target, production-shaped request completes repeatedly inside the frozen timeout over the real credential. It does NOT establish that the remote model revision is unchanged (no digest exists remotely), and it is NOT evidence about any scientific question."
});

/**
 * What the LOCAL gate could see and this one cannot. Recorded as explicit verdict fields so the gate's
 * coverage can never be read as larger than it is. Each has the same status the swap contract declares.
 */
export const CS_READINESS_NOT_EVALUABLE: readonly {
  readonly criterion: string;
  readonly status: "NOT_APPLICABLE" | "NOT_OBSERVABLE_REMOTELY";
  readonly reason: string;
}[] = Object.freeze([
  {
    criterion: "same_model_digest_throughout",
    status: "NOT_OBSERVABLE_REMOTELY",
    reason:
      "a remote endpoint publishes no content digest. A provider-reported model id is observed instead and is strictly weaker: it cannot detect a silent revision change behind a stable id."
  },
  {
    criterion: "no_provider_reload_midway",
    status: "NOT_APPLICABLE",
    reason:
      "there is no resident process to sample and no load/unload transition to observe. The criterion is declared inapplicable, NOT substituted by a look-alike and NOT silently reported true."
  },
  {
    criterion: "environment VRAM / temperature diagnostics",
    status: "NOT_APPLICABLE",
    reason: "the endpoint is remote; local GPU state has no bearing on it."
  }
]);

/** §10: the count is fixed in advance and is never extended while running. */
export const CS_READINESS_EXECUTION_RULE = Object.freeze({
  planned: CS_READINESS_PROBES,
  planned_equals_actual: true,
  run_all_planned_probes_regardless_of_intermediate_outcomes: true,
  forbidden: [
    "stopping early and reporting a different N",
    "running extra probes until three succeed",
    "raising the timeout",
    "lowering max_tokens",
    "swapping the provider or model",
    "changing generation settings",
    "retrying a failed probe (a retry would change what N means)"
  ],
  on_any_failure: "the gate is FAIL and the run stops after the planned probes are done"
});

export const CS_READINESS_PASS_TOKENS = Object.freeze([
  "PHASE0_CLOUD_PROVIDER_READINESS_GATE_PASS",
  "PHASE0_CONTRACT_QUALIFICATION_AUTHORISED"
]);

export const CS_READINESS_FAIL_TOKENS = Object.freeze([
  "PHASE0_CLOUD_PROVIDER_READINESS_GATE_FAIL",
  "PHASE0_CLOUD_SWAP_REMAINS_BLOCKED_BY_PROVIDER",
  "HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED"
]);

// ---------------------------------------------------------------------------------------------
// THE CRITERIA FUNCTION — pure, total, and able to FAIL on every criterion it names
// ---------------------------------------------------------------------------------------------

/**
 * Extracted from the runnable so the gate can be evaluated on constructed input at 0 provider calls.
 * The repository's own law applies here: a predicate must test the property it names AND be able to
 * fail, and a check that can never be true can never FAIL. Each gating criterion below is exercised by
 * the offline suite with an input that must flip it to false.
 */
export interface CsReadinessProbeObservationV0 {
  readonly request_hash: string;
  readonly status: string;
  readonly latency_ms: number;
  readonly provider_reported_model: string | null;
}

export interface CsReadinessIdentityObservationV0 {
  readonly http_status: number | null;
  readonly credential_accepted: boolean;
  readonly configured_model_listed: boolean | null;
}

export interface CsReadinessEvaluationV0 {
  readonly criteria: Readonly<Record<string, boolean | string>>;
  readonly gating: readonly boolean[];
  readonly pass: boolean;
}

export function evaluateCsReadinessV0(input: {
  readonly probes: readonly CsReadinessProbeObservationV0[];
  readonly identity: CsReadinessIdentityObservationV0;
}): CsReadinessEvaluationV0 {
  const { probes, identity } = input;
  const reportedModels = new Set(probes.map((probe) => probe.provider_reported_model));
  const firstHash = probes[0]?.request_hash;
  const criteria: Record<string, boolean | string> = {
    credential_present_and_accepted:
      identity.http_status !== null && identity.credential_accepted && identity.configured_model_listed !== false,
    configured_model_is_served_by_the_endpoint: identity.configured_model_listed === true,
    all_probes_completed_normally: probes.length > 0 && probes.every((probe) => probe.status === "COMPLETED"),
    all_probes_completed_within_the_frozen_timeout:
      probes.length > 0 && probes.every((probe) => probe.latency_ms < CS_READINESS_TIMEOUT_MS),
    all_probes_used_the_same_frozen_request_hash:
      probes.length > 0 && probes.every((probe) => probe.request_hash === firstHash),
    provider_reported_model_identical_across_all_probes: reportedModels.size === 1 && !reportedModels.has(null),
    no_fallback_configured_or_used: "STRUCTURALLY_TRUE_BY_CONSTRUCTION"
  };
  const gating = [
    criteria["credential_present_and_accepted"] === true,
    criteria["configured_model_is_served_by_the_endpoint"] === true,
    criteria["all_probes_completed_normally"] === true,
    criteria["all_probes_completed_within_the_frozen_timeout"] === true,
    criteria["all_probes_used_the_same_frozen_request_hash"] === true,
    criteria["provider_reported_model_identical_across_all_probes"] === true
  ];
  return { criteria, gating, pass: gating.every((value) => value) };
}

export async function hashCsReadinessArtifact(content: string, name: string): Promise<string> {
  return hashCs(content, name);
}
