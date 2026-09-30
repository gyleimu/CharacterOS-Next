/* eslint-disable no-restricted-imports -- Isolated research harness composing frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * HISTORY_INTERNALIZATION_TEST_V1 — PHASE 0, EXECUTOR SWAP CONTRACT (frozen, 0 model calls).
 *
 * This file freezes the OPERATOR DECISION `OPTION_2_REPLACE_THE_EXECUTOR_AS_INFRASTRUCTURE` into
 * machine-readable constants, BEFORE any call of the swapped condition is made.
 *
 * What it is: an infrastructure change. The scientific design, the subjects' genesis, the frozen
 * trajectories, the valence table, the scorer, the primary predicate, the invalid policy and the
 * evidence-hierarchy ceiling are all REUSED BY REFERENCE from `../contract.ts` (REV2) — not
 * re-implemented, not paraphrased, not re-derived. Only the executor changes.
 *
 * Why it is needed (established, not assumed): `CONSTRAINED_OUTPUT_CANNOT_FAITHFULLY_ENFORCE_REPRODUCED_
 * FAILURE_CLASS`. The local provider accepts an `if/then` schema and silently ignores the conditional, so
 * the cross-field invariant `PRIMARY_STANCE => SELECTIVE stance` cannot be enforced at generation time,
 * and the prompt already states the rule in words (rule 17). A contract-equivalent enforcement therefore
 * does not exist on that provider, and §9 forbids prompt rescue.
 *
 * The honest consequence, frozen here so it cannot be softened later: run-4 is EXECUTOR-CONDITIONAL and
 * is NOT directly comparable to run-1/run-3. This does not silently reopen or overturn any prior result.
 */

import { hashEnvelope } from "../../../../../packages/subject-core/dist/index.js";

export const CS_HASH_PROJECTION_V0 =
  "characteros-next/research/history-internalization/phase-0/cloud-swap/v0" as const;

// ---------------------------------------------------------------------------------------------
// §1 THE DECISION
// ---------------------------------------------------------------------------------------------

export const CS_OPERATOR_DECISION = "OPTION_2_REPLACE_THE_EXECUTOR_AS_INFRASTRUCTURE" as const;
export const CS_OPERATOR_CONSTRAINT = "DO_NOT_USE_THE_LOCAL_QWEN_EXECUTOR_IN_THIS_CONDITION" as const;

// ---------------------------------------------------------------------------------------------
// §2 THE NEW EXECUTOR IDENTITY (recorded as data; NEVER baked into a verdict token)
// ---------------------------------------------------------------------------------------------

export const CS_PROVIDER_ID = "DEEPSEEK_OPENAI_COMPATIBLE" as const;
export const CS_PROVIDER_API_STYLE = "OPENAI_COMPATIBLE_CHAT_COMPLETIONS" as const;
export const CS_BASE_URL_DEFAULT = "https://api.deepseek.com" as const;
export const CS_MODEL_DEFAULT = "deepseek-flash" as const;
/** The credential comes from the environment ONLY (product convention). Never a file, never logged. */
export const CS_CREDENTIAL_ENV = "MODEL_API_KEY" as const;
export const CS_TEMPERATURE = 0 as const;
/**
 * No grammar-constrained decoding exists on this transport: `OpenAiCompatibleTransportV0` does not
 * read `request.structured_output` at all, and the provider exposes JSON syntax mode only. This is
 * recorded, not concealed — it is the whole reason the swap is untested until qualification.
 */
export const CS_SCHEMA_ENFORCEMENT_MODE = "OPENAI_COMPATIBLE_JSON_SYNTAX_MODE_ONLY" as const;

/**
 * Reasoning is disabled on the swapped condition, using the product's own cloud-family mechanism
 * (`deepSeekProviderRequestOptionsV0("DISABLED")`). Reason: the belief-semantic contract consumes
 * `message.content` as the FINAL answer and the local sibling disables reasoning for exactly the
 * same reason (`think: false`). Recorded as a request-policy fact of the cloud family.
 */
export const CS_PROVIDER_REQUEST_OPTIONS: Readonly<Record<string, unknown>> = Object.freeze({
  thinking: Object.freeze({ type: "disabled" })
});

/** The four provider families Phase 0 drives. ALL FOUR move; none stays on the local executor. */
export const CS_FAMILIES = Object.freeze(["cognition", "language", "appraisal", "belief_semantic"] as const);
export type CsFamilyV0 = (typeof CS_FAMILIES)[number];

/**
 * Per-family request timeouts. NOT one shared number: the local condition did not use one.
 *
 *   cognition / language / appraisal  120,000 ms — the value `execute.ts` passes to all three
 *                                      `OllamaNativeCognitionTransportV0` constructions verbatim
 *                                      (`execute.ts:78, :85, :92`), and the local readiness gate's
 *                                      frozen `READINESS_TIMEOUT_MS`.
 *   belief_semantic                    60,000 ms — `OLLAMA_BELIEF_SEMANTIC_PROVIDER_TIMEOUT_MS`, the
 *                                      frozen default the local provider applies when the caller does
 *                                      not pin one (and `execute.ts` does not).
 *
 * Collapsing these onto one number would have been an undeclared change to two families.
 */
export const CS_FAMILY_TIMEOUTS_MS: Readonly<Record<CsFamilyV0, number>> = Object.freeze({
  cognition: 120_000,
  language: 120_000,
  appraisal: 120_000,
  belief_semantic: 60_000
});

// ---------------------------------------------------------------------------------------------
// §3 CHANGED vs UNCHANGED — the honest diff, declared before the first call
// ---------------------------------------------------------------------------------------------

/**
 * Everything here MUST be declared changed. A swap that quietly kept one of these unchanged while
 * reporting "only the executor changed" would be a false invariance claim.
 */
export const CS_CHANGED_CONDITIONS: Readonly<Record<string, string>> = Object.freeze({
  provider: `Ollama -> ${CS_PROVIDER_ID}`,
  model: "qwen3.5:9b -> deepseek-flash",
  transport_class:
    "OllamaNativeCognitionTransportV0 + OllamaBeliefSemanticProviderV0 -> OpenAiCompatibleTransportV0 (all four families)",
  schema_enforcement_mode: `OLLAMA_NATIVE_FORMAT_GRAMMAR_ENFORCED -> ${CS_SCHEMA_ENFORCEMENT_MODE}`,
  reasoning_policy: "ollama-native think:false -> provider-level thinking.type=disabled",
  context_allocation:
    "explicit num_ctx (8192 cognition/language, 4096 appraisal) -> provider-managed; NOT transferable (see §5)",
  execution_identity: "new opaque subject ids + a new run identity; the swapped condition is a new condition"
});

/** Everything here MUST remain identical. The swap buys the executor and nothing else. */
export const CS_UNCHANGED_CONDITIONS: Readonly<Record<string, string>> = Object.freeze({
  scientific_question: "unchanged (Phase 0: does controlled LIVED evidence reach canonical belief?)",
  target_proposition_id: "unchanged (reused by reference from ../contract.ts)",
  target_proposition_label: "unchanged (reused by reference from ../contract.ts)",
  baseline_credence: "unchanged (reused by reference from ../contract.ts)",
  predicted_directions: "unchanged (reused by reference from ../contract.ts)",
  turn_templates: "unchanged (reused by reference from ../contract.ts)",
  valence_table: "unchanged (reused by reference from ../contract.ts)",
  turns_per_arm: "unchanged (reused by reference from ../contract.ts)",
  model_visible_prompt_text:
    "unchanged for every family — the prompt bytes are built by the PRODUCTION providers, not by the transport; the belief-semantic family reuses the exported frozen builder verbatim",
  scorer: "unchanged (scorePhase0V0 imported by reference from ../contract.ts; not re-implemented)",
  primary_predicate: "unchanged (P0_PRIMARY_PREDICATE, imported by reference)",
  invalid_policy: "unchanged (any required invalid trial => INCONCLUSIVE; no retry, no replacement, no extension)",
  inconclusive_conditions: "unchanged (P0_INCONCLUSIVE_CONDITIONS, imported by reference)",
  evidence_hierarchy_ceiling: "unchanged (L1 -> L2 at most; P0_L2_MEANING imported by reference)",
  subject_genesis: "unchanged construction path (fixtures.ts buildPhase0SourceV0), new opaque ids only"
});

// ---------------------------------------------------------------------------------------------
// §4 WHAT THIS SWAP DOES NOT DO
// ---------------------------------------------------------------------------------------------

export const CS_NOT_AUTHORISED: readonly string[] = Object.freeze([
  "a phrase of the trajectory text being optimised, softened or re-authored",
  "the target proposition, baseline credence or predicted direction being changed",
  "the scorer, predicate or invalid policy being edited",
  "the qualification turn being skipped or reduced",
  "run-4 being scored on, or merged with, run-1/run-3 evidence",
  "any packages/ change (the swapped condition is host-side research code)",
  "any claim that the local executor is 'broken' or that DeepSeek is 'better'"
]);

// ---------------------------------------------------------------------------------------------
// §5 PARAMETERS THAT DO NOT TRANSFER (declared, never silently dropped)
// ---------------------------------------------------------------------------------------------

/**
 * The Ollama-native stack carried three parameters that a remote OpenAI-compatible endpoint has no
 * equivalent for. They are recorded here as NON-TRANSFERRED, in the open, rather than being omitted
 * from the declaration so that the condition looks smaller than it is.
 */
export const CS_OLLAMA_PARAMETERS_NOT_TRANSFERRED: readonly {
  readonly parameter: string;
  readonly local_value: string;
  readonly status: string;
  readonly consequence: string;
}[] = Object.freeze([
  {
    parameter: "num_ctx (context_window_tokens)",
    local_value: "8192 cognition/language, 4096 appraisal",
    status: "NOT_TRANSFERABLE",
    consequence:
      "the remote endpoint manages its own context window; no equivalent field exists on the frozen OpenAI-compatible transport, so the allocation cannot be held equal and is not claimed to be"
  },
  {
    parameter: "model digest",
    local_value: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
    status: "NOT_OBSERVABLE_REMOTELY",
    consequence:
      "a remote endpoint publishes no content digest. A provider-reported model id can be observed, and it is strictly weaker: it cannot detect a silent revision change behind a stable id"
  },
  {
    parameter: "provider residency / mid-gate reload",
    local_value: "resident-vs-unloaded, one initial load allowed",
    status: "NOT_APPLICABLE",
    consequence:
      "there is no resident process to sample. The criterion is NOT substituted by a look-alike; it is declared inapplicable and the readiness verdict says so"
  }
]);

// ---------------------------------------------------------------------------------------------
// §6 PROVIDER READINESS — the CLOUD gate's own criteria (different question, stated honestly)
// ---------------------------------------------------------------------------------------------

export const CS_READINESS_PROBES_PLANNED = 3 as const;
export const CS_READINESS_MODELS_PATH = "/models" as const;
export const CS_READINESS_COMPLETIONS_PATH = "/chat/completions" as const;

/**
 * The swapped condition's readiness gate answers: can the frozen executor configuration complete a
 * production-SHAPED request inside the frozen timeout, repeatedly, over the real credential, with no
 * fallback and a stable provider-reported model id?
 *
 * It is NOT the local gate with the names changed: the local gate's central criteria (digest identity,
 * residency, mid-gate reload) have no remote meaning, and §5 says so instead of pretending otherwise.
 */
export const CS_READINESS_GATING_CRITERIA: readonly string[] = Object.freeze([
  "credential_present_and_accepted",
  "configured_model_is_served_by_the_endpoint",
  "all_probes_completed_normally",
  "all_probes_completed_within_the_frozen_timeout",
  "all_probes_used_the_same_frozen_request_hash",
  "provider_reported_model_identical_across_all_probes",
  "no_fallback_configured_or_used"
]);

/** Recorded but NOT gating, exactly as the local gate recorded descriptive metrics. */
export const CS_READINESS_DESCRIPTIVE_NOT_GATING: readonly string[] = Object.freeze([
  "wall-clock latency per probe",
  "completion tokens per probe",
  "prompt tokens per probe",
  "provider-reported finish_reason per probe",
  "provider-reported model id (also gating: stability only, never an identity proof)"
]);

/** The stated limitation of a PASS. A gate that overstates itself is not a gate. */
export const CS_READINESS_PASS_MEANS =
  "the swapped executor configuration can complete a frozen, non-target, production-shaped request repeatedly, inside the frozen timeout, over the real credential, with no fallback and without the provider-reported model id changing. It is NOT evidence about any scientific question, and it does NOT establish that the provider's model revision is unchanged (no digest exists remotely).";

// ---------------------------------------------------------------------------------------------
// §7 CONTRACT QUALIFICATION (the gate that actually decides whether the swap is usable)
// ---------------------------------------------------------------------------------------------

/**
 * A PASS at readiness authorises qualification and NOTHING ELSE. Qualification is the only step that
 * can show the swapped executor satisfies the production cognition contract whose violation caused the
 * two frozen inconclusive runs. It runs on STATE-BLIND, NON-TARGET fixtures and contributes no science.
 */
export const CS_QUALIFICATION_TURNS = 6 as const;
export const CS_QUALIFICATION_IS_SCIENTIFIC = false as const;
export const CS_QUALIFICATION_MUST_PRECEDE_THE_SCIENTIFIC_RUN = true as const;

/**
 * The two REV2 qualification subjects. Fresh, non-target, non-arm, opaque. The suffixes are
 * non-sequential on purpose: a replicate ordinal baked into an identity would be ordering information,
 * and while this gate is non-scientific and computes no endpoint, there is no reason to introduce the
 * possibility. (REV1, superseded, used six single-turn subjects.)
 */
export const CS_QUALIFICATION_REV2_SUBJECT_IDS: readonly string[] = Object.freeze([
  "subject-qcf-5213",
  "subject-qcf-7748"
]);

/**
 * The failure class the local executor reproduced twice, byte-identically, on two independent runs.
 * It is what this gate is looking for: if the swapped executor emits it too, the swap does not fix the
 * problem and the scientific run must not be attempted.
 */
export const CS_REPRODUCED_FAILURE_CLASS = "CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED" as const;
export const CS_REPRODUCED_FAILURE_MARKER =
  "PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance" as const;

/**
 * REV2 — WHY A SINGLE-TURN QUALIFICATION WAS NOT A GATE AT ALL.
 *
 * The reproduced failure occurred at `B:turn_2` in run-1 and at `A:turn_1` in run-3 — never at turn 0.
 * The production ordering law is the reason: from turn 1 onward the evidence offered to belief
 * adaptation includes the PREVIOUS turn's behaviour-outcome feedback. The frozen single qualification
 * turn never reaches that shape, and the frozen evidence proves it does not discriminate: run-1's
 * `qualification.json` records `turn_status: COMPLETE` and `lawful_terminal_observed: true` — **the
 * LOCAL executor passed the very fixture that was supposed to filter it out.**
 *
 * REV1's PASS was therefore a real result about runnability and a NON-RESULT about the failure class.
 * REV2 replaces it with a THREE-turn non-target mini-trajectory, three turns being the shortest shape
 * that reaches the multi-turn evidence-feedback path.
 *
 * Discrimination is argued STRUCTURALLY, not measured: proving that this fixture would fail on the local
 * executor would require running the local executor, which the operator's constraint forbids. That
 * limitation is recorded rather than hidden.
 */
export const CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT = 3 as const;
export const CS_QUALIFICATION_REV2_SUBJECTS = 2 as const;
/** 3 turns x 2 subjects = 6, matching the frozen N = 6 qualification size. */
export const CS_QUALIFICATION_REV2_TOTAL_TURNS =
  CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT * CS_QUALIFICATION_REV2_SUBJECTS;

/** Frozen non-target mini-trajectory on the qualification proposition. Turn 0 carries no outcome span. */
export const CS_QUALIFICATION_REV2_TURN_TEXTS: readonly string[] = Object.freeze([
  "I told the carpenter I would keep the hallway clear today, so the floor is free for him to work.",
  "About the hallway: I did keep it clear as I said, and he told me he would bring the long level tomorrow.",
  "About the level: he brought it and ran it along the whole hallway, and the boards are still level under it."
]);

export type CsQualificationFailureKindV0 = "REPRODUCED_FAILURE_CLASS" | "OTHER_FAILURE" | "NONE";

/**
 * Classifies one turn's outcome text. Total, and able to return every branch — the offline suite feeds
 * it the FROZEN run-1 failure string and asserts it fires, so the detector cannot be a check that
 * never fires.
 */
export function classifyCsQualificationFailureV0(text: string | null | undefined): CsQualificationFailureKindV0 {
  if (text === null || text === undefined || text.trim().length === 0) return "NONE";
  if (text.includes(CS_REPRODUCED_FAILURE_MARKER)) return "REPRODUCED_FAILURE_CLASS";
  if (text.includes(CS_REPRODUCED_FAILURE_CLASS)) return "REPRODUCED_FAILURE_CLASS";
  return "OTHER_FAILURE";
}

// ---------------------------------------------------------------------------------------------
// §8 BUDGET (frozen before the first call of the swapped condition)
// ---------------------------------------------------------------------------------------------

/**
 * Readiness is 3 probes plus 1 identity request. A failed readiness costs 3 probes at most and stops
 * the round. Qualification is a separate, separately-authorised gate.
 */
export const CS_BUDGET_READINESS_PROBES = CS_READINESS_PROBES_PLANNED;
export const CS_BUDGET_READINESS_IDENTITY_REQUESTS = 1 as const;
export const CS_BUDGET_READINESS_MAX = CS_BUDGET_READINESS_PROBES + CS_BUDGET_READINESS_IDENTITY_REQUESTS;
export const CS_BUDGET_QUALIFICATION_CALLS = CS_QUALIFICATION_TURNS;
export const CS_BUDGET_STOPS_AT = Object.freeze([
  "readiness FAIL => the round stops; the scientific run is NOT attempted",
  "qualification FAIL => the round stops and the swap is reported as unusable; the scientific run is NOT attempted"
]);

// ---------------------------------------------------------------------------------------------
// §9 FORBIDDEN CLAIMS (unchanged ceiling, plus the swap-specific ones)
// ---------------------------------------------------------------------------------------------

export const CS_FORBIDDEN_CLAIMS: readonly string[] = Object.freeze([
  "history internalization works",
  "the subject has been shaped by its life",
  "persistent belief influences cognition",
  "persistent belief influences decision or behaviour",
  "the CharacterOS north star is established",
  "personality or affect channels contribute",
  "the local executor was the only cause of the null (the swap has not been run)",
  "the swapped executor is compliant (no qualification has run)",
  "run-4 is comparable to run-1 or run-3 (different executor condition)",
  "the D1 null is overturned or re-opened (different executor condition; D1 is untouched)"
]);

// ---------------------------------------------------------------------------------------------
// §10 FAIL-CLOSED CONFIGURATION (no silent fallback, ever)
// ---------------------------------------------------------------------------------------------

const LOCAL_HOST_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/i;

export interface CsExecutorConfigV0 {
  readonly base_url: string;
  readonly model: string;
  readonly api_key: string | null;
  readonly temperature: number;
  readonly provider_request_options?: Readonly<Record<string, unknown>> | undefined;
}

export class CsExecutorConfigErrorV0 extends Error {
  readonly code: "CS_INVALID_CONFIG" | "CS_LOCAL_FALLBACK_FORBIDDEN" | "CS_CREDENTIAL_ABSENT";

  constructor(code: CsExecutorConfigErrorV0["code"], detail: string) {
    super(`${code}: ${detail}`);
    this.name = "CsExecutorConfigErrorV0";
    this.code = code;
  }
}

/**
 * Resolves the swapped executor configuration from explicit values only. There is no default base URL
 * fallback and no local endpoint fallback: a missing credential is a STOP, not a downgrade. The
 * process builds exactly ONE endpoint, so "no fallback" is true by construction rather than by policy.
 *
 * There is deliberately NO timeout knob here. Timeouts come only from the frozen per-family table, so a
 * caller cannot silently retune one — the same reason the local gate froze its timeout before running.
 */
export function resolveCloudExecutorConfigV0(input: {
  readonly base_url?: string | undefined;
  readonly model?: string | undefined;
  readonly api_key: string | null;
}): CsExecutorConfigV0 {
  const baseUrl = (input.base_url ?? CS_BASE_URL_DEFAULT).trim();
  const model = (input.model ?? CS_MODEL_DEFAULT).trim();
  if (baseUrl.length === 0) throw new CsExecutorConfigErrorV0("CS_INVALID_CONFIG", "base_url is required");
  if (model.length === 0) throw new CsExecutorConfigErrorV0("CS_INVALID_CONFIG", "model is required");
  if (LOCAL_HOST_PATTERN.test(baseUrl) || baseUrl.includes(":11434")) {
    throw new CsExecutorConfigErrorV0(
      "CS_LOCAL_FALLBACK_FORBIDDEN",
      `base_url ${baseUrl} resolves to a LOCAL endpoint; the local fallback is FORBIDDEN for this condition (fail closed)`
    );
  }
  if (input.api_key === null || input.api_key.trim().length === 0) {
    throw new CsExecutorConfigErrorV0(
      "CS_CREDENTIAL_ABSENT",
      `credential is required from the environment (${CS_CREDENTIAL_ENV}); absence is a STOP, never a downgrade to the local executor`
    );
  }
  return Object.freeze({
    base_url: baseUrl.replace(/\/$/, ""),
    model,
    api_key: input.api_key,
    temperature: CS_TEMPERATURE,
    provider_request_options: CS_PROVIDER_REQUEST_OPTIONS
  });
}

/** Fingerprints the credential (never the value) so artifacts can prove WHICH key was used. */
export async function credentialFingerprintV0(apiKey: string): Promise<string> {
  return String(await hashEnvelope(CS_HASH_PROJECTION_V0, { name: "MODEL_API_KEY", content: apiKey })).slice(0, 23);
}

/** Redaction applied to EVERY string that can reach an artifact, a log or an error message. */
export function redactCsV0(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]{6,}/gi, "Bearer <redacted>")
    .replace(/"?(authorization|api_key|apiKey|api-key)"?\s*[:=]\s*"?[^"',}\s]+/gi, "$1: <redacted>");
}

export async function hashCs(content: string, name: string): Promise<string> {
  return String(await hashEnvelope(CS_HASH_PROJECTION_V0, { name, content }));
}
