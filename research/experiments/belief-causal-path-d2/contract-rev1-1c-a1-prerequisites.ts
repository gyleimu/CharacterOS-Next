/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 REVISION 1.1c — A1 EXECUTION PREREQUISITES. FROZEN. ZERO MODEL CALLS.
 *
 * WHY THIS FILE EXISTS
 *   A0 completed with a directional positive, which authorised A1. Before spending any A1 call this
 *   round ran a 0-call audit of the A1 prerequisites against the authoritative contracts. Five things
 *   that the A1 stage needs were NOT actually frozen:
 *
 *     1. the A1 qualification fixtures existed only as KINDS
 *        (["obvious support of the paraphrased principle", "obvious uncertainty about it", "obvious
 *        opposition to it"]), never as literal stimulus bytes;
 *     2. no fixture -> expected-token mapping existed anywhere, although the qualification rule is
 *        stated in terms of "the fixture's pre-registered expected token";
 *     3. `buildD2SemanticReadoutRequestV0` was only NAMED (in D2_TRANSFORMER_LAWS and in the stage
 *        gating table), never specified and never implemented;
 *     4. no invalid-output rule existed for qualification trials anywhere in the D2 contracts — and
 *        different treatments of an invalid trial can flip a PASS into a FAIL, so the rule had to be
 *        fixed BEFORE the first call rather than chosen after seeing an invalid;
 *     5. the A1 token meanings ("anchors") did not exist: D2A1_ANCHORS is absent while the A0
 *        contract carries D2A0_ANCHORS, so the A1 measurement contract could not be rendered at all.
 *
 *   Running the 9 A1 calls in that state would have meant writing the stimuli, the answer key, the
 *   instrument contract and the failure rule at execution time. This file freezes all five first.
 *
 * SCOPE: A1 measurement execution prerequisites ONLY — qualification fixtures, their expected tokens,
 * the A1 anchors and contract text, the transformer contract, and the invalid rule. The scientific
 * design is unchanged: the causal graph, A0/A1/B contracts, closed sets, r_confirm mapping, the
 * localisation matrix, the verdict vocabulary and the claim scope are untouched, the A1 paraphrase
 * literal is byte-identical to D2A1_PARAPHRASE, and REVISION 1 / 1.1 / 1.1a / 1.1b hashes are
 * preserved. This amendment does not read, depend on, or derive anything from the A0 token pattern;
 * the only A0 fact it uses is the preregistered one that A1 is now unlocked.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import { D2_HASH_PROJECTION_V0, D2A1_PARAPHRASE, D2A1_TOKENS, type D2A1Token } from "./contract-rev1.ts";
import { D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";

export const D2_VERSION_REV1_1C = "belief-causal-path-d2-rev1.1c" as const;

export const D2_REVISION_1_1B_MANIFEST_HASH =
  "sha256:f40d1f56b52b213e09a9a85d0892f29a4870f5c5b3ac8792775314177bcd230a" as const;

// =============================================================================================
// GAP 5 — A1 TOKEN ANCHORS (previously absent: D2A1_ANCHORS does not exist)
// =============================================================================================

/**
 * State-blind by construction: each entry says what a token MEANS, never which credence maps to it,
 * never a HIGH/LOW/arm/treatment word. Frozen here, before the first A1 call, with no A1 output seen.
 */
export const D2A1_ANCHORS_FROZEN_V0 = Object.freeze({
  SUPPORTS_PARAPHRASED_PRINCIPLE:
    "the subject treats the principle as correct and would rely on it",
  UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE:
    "the subject holds no settled position on the principle",
  OPPOSES_PARAPHRASED_PRINCIPLE:
    "the subject treats the principle as incorrect and would rely on its denial"
});

export const D2A1_READOUT_SCHEMA_VERSION = "d2-a1-semantic-readout-v0" as const;

const A1_READOUT_QUESTION =
  "State the subject's stance toward the PRINCIPLE as worded above. The subject data may word the same idea differently; report the stance on the principle as it is worded here.";

/**
 * The frozen A1 measurement contract text. It never states a target token for any state, never
 * contains a credence number, never uses an arm word, never repeats the canonical CAUTION label, and
 * contains no action token. The paraphrase below is D2A1_PARAPHRASE, byte-identical.
 */
export const D2A1_CONTRACT_TEXT: string = [
  "",
  "--- DECISION PROBE SEMANTIC READOUT CONTRACT (research instrument; binding for THIS invocation) ---",
  "The output-format rules above are SUPERSEDED for this invocation. Nothing else changes:",
  "every SUBJECT DATA law, every untrusted-content law and every evidence law above still binds.",
  "Respond with EXACTLY ONE JSON object and nothing else. No prose, no code fences.",
  "Required members:",
  '  "d2_readout_schema_version": "d2-a1-semantic-readout-v0"',
  '  "stance": one of "SUPPORTS_PARAPHRASED_PRINCIPLE" | "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE" | "OPPOSES_PARAPHRASED_PRINCIPLE"',
  "PRINCIPLE (binding wording; the stance to report is the stance toward THIS wording):",
  `  ${D2A1_PARAPHRASE}`,
  "Token meanings (binding):",
  `  SUPPORTS_PARAPHRASED_PRINCIPLE — ${D2A1_ANCHORS_FROZEN_V0.SUPPORTS_PARAPHRASED_PRINCIPLE}`,
  `  UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE — ${D2A1_ANCHORS_FROZEN_V0.UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE}`,
  `  OPPOSES_PARAPHRASED_PRINCIPLE — ${D2A1_ANCHORS_FROZEN_V0.OPPOSES_PARAPHRASED_PRINCIPLE}`,
  A1_READOUT_QUESTION,
  "--- END DECISION PROBE SEMANTIC READOUT CONTRACT ---"
].join("\n");

export const D2A1_JSON_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["d2_readout_schema_version", "stance"],
  properties: {
    d2_readout_schema_version: { const: D2A1_READOUT_SCHEMA_VERSION },
    stance: { enum: [...D2A1_TOKENS] },
    explanation: { type: "string", minLength: 1, maxLength: 240 }
  }
});

// =============================================================================================
// GAP 1 + 2 — FROZEN A1 QUALIFICATION FIXTURES (literal bytes) AND THEIR EXPECTED TOKENS
// =============================================================================================

/**
 * A1's mechanism: the canonical CAUTION proposition AND its canonical credence stay in the request —
 * they must, or the HIGH/LOW manipulation would not exist. What A1 removes is the measurement-side
 * numeric shortcut: the contract must not restate the canonical proposition, must not carry a
 * credence, must not explain what any number maps to, and must not name an arm. The paraphrase is the
 * frozen near-semantic target, and it shares no four-word sequence with the canonical label.
 *
 * A qualification fixture presents a synthetic belief line whose proposition IS the paraphrase, so
 * the instrument can be checked on state-blind stimuli that contain no CharacterOS canonical state,
 * no arm and no treatment. Experimental credences 0.80 / 0.20 / 0.50 never appear.
 */
export interface D2A1QualificationFixtureV0 {
  readonly fixture_id: string;
  readonly kind: string;
  readonly belief_line: string;
  readonly expected_token: D2A1Token;
}

export const D2A1_QUALIFICATION_FIXTURES: readonly D2A1QualificationFixtureV0[] = Object.freeze([
  Object.freeze({
    fixture_id: "A1-QF-A-SUPPORT",
    kind: "obvious support of the paraphrased principle",
    belief_line:
      `showing 1 of 1 canonical belief item(s)\n  {"proposition_id":"fixture:a1-qf-a","proposition_label":"${D2A1_PARAPHRASE}","credence":0.95}`,
    expected_token: "SUPPORTS_PARAPHRASED_PRINCIPLE"
  }),
  Object.freeze({
    fixture_id: "A1-QF-B-UNCERTAIN",
    kind: "obvious uncertainty about it",
    belief_line:
      `showing 1 of 1 canonical belief item(s)\n  {"proposition_id":"fixture:a1-qf-b","proposition_label":"${D2A1_PARAPHRASE}","credence":0.49}`,
    expected_token: "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE"
  }),
  Object.freeze({
    fixture_id: "A1-QF-C-OPPOSE",
    kind: "obvious opposition to it",
    belief_line:
      `showing 1 of 1 canonical belief item(s)\n  {"proposition_id":"fixture:a1-qf-c","proposition_label":"${D2A1_PARAPHRASE}","credence":0.06}`,
    expected_token: "OPPOSES_PARAPHRASED_PRINCIPLE"
  })
]);

/** The explicit fixture -> expected-token map. The runner may not infer this from the stimuli. */
export const D2A1_EXPECTED_TOKEN_MAP: Readonly<Record<string, D2A1Token>> = Object.freeze(
  Object.fromEntries(D2A1_QUALIFICATION_FIXTURES.map((f) => [f.fixture_id, f.expected_token]))
) as Readonly<Record<string, D2A1Token>>;

export const D2A1_QUALIFICATION_INVARIANTS = Object.freeze({
  all_fixtures_share_one_proposition: true,
  proposition_is_the_frozen_paraphrase: true,
  only_the_credence_varies_between_fixtures: true,
  uses_characteros_canonical_state: false,
  contains_treatment: false,
  experimental_credences_0_80_0_20_0_50_present: false,
  fixture_credences: [0.95, 0.49, 0.06],
  each_of_the_three_tokens_is_expected_exactly_once: true
});

// =============================================================================================
// GAP 3 — THE A1 TRANSFORMER CONTRACT (the name existed; the specification did not)
// =============================================================================================

export const D2A1_TRANSFORMER_CONTRACT = Object.freeze({
  name: "buildD2SemanticReadoutRequestV0",
  input: "a pristine production V8 cognition request (production system prompt, production user content, V8 structured-output declaration)",
  substitution: "structured_output.schema is replaced by D2A1_JSON_SCHEMA exactly once",
  append: "D2A1_CONTRACT_TEXT is appended to the system message exactly once, the production content surviving as a byte-exact prefix",
  preserves_production_prefix_byte_for_byte: true,
  fails_on_already_transformed_request: true,
  transformer_on_transformer: false,
  decision_probe_v2_used: false,
  decision_probe_v2_transformer_reused: false,
  a0_transformer_reused: false,
  contract_text_hash_projection: D2_HASH_PROJECTION_V0,
  implementation_status_at_freeze_time: "NOT YET IMPLEMENTED — the contract is frozen here; the implementation and its offline conformance gate are the first steps of the next round, before any call"
});

// =============================================================================================
// GAP 4 — THE QUALIFICATION INVALID RULE, FROZEN BEFORE THE FIRST A1 CALL
// =============================================================================================

/**
 * The most conservative rule available, chosen before any A1 output exists. It is frozen now because
 * post-hoc choices about invalid trials can flip a PASS into a FAIL.
 */
export const D2A1_QUALIFICATION_INVALID_RULE = Object.freeze({
  rule: "any_invalid_qualification_trial_fails_that_instrument_qualification",
  counts_as_invalid: [
    "parser rejection (output not one JSON object, unknown members, schema-version mismatch)",
    "stance outside the frozen closed set",
    "empty or malformed content",
    "transport failure, including timeout"
  ],
  denominator: "always the full nine planned trials (3 fixtures x 3 replicates)",
  retry_allowed: false,
  replacement_allowed: false,
  extra_call_allowed: false,
  invalid_trials_may_be_deleted: false,
  one_invalid_trial_is_enough_to_fail: true,
  verdict_if_any_invalid: "D2_INSTRUMENT_UNQUALIFIED",
  applies_to: ["D2_A1", "D2_B"],
  applied_retroactively_to_a0: false,
  rationale:
    "A0 qualified with 0 invalid trials, so this rule changes no past result. Fixing it now means the treatment of an invalid trial cannot be chosen after seeing one."
});

// =============================================================================================
// MECHANICAL SELF-CHECKS (fail closed) + MANIFEST
// =============================================================================================

const ACTION_TOKENS = ["ACCEPT", "VERIFY", "REJECT", "proceed", "choose", "decide", "should", "must act"];

function ngrams(text: string, n: number): string[] {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  for (let index = 0; index + n <= words.length; index += 1) out.push(words.slice(index, index + n).join(" "));
  return out;
}

export interface D2Rev11cManifestV0 {
  readonly version: typeof D2_VERSION_REV1_1C;
  readonly fixtures: readonly D2A1QualificationFixtureV0[];
  readonly expected_token_map: Readonly<Record<string, D2A1Token>>;
  readonly invariants: typeof D2A1_QUALIFICATION_INVARIANTS;
  readonly anchors: typeof D2A1_ANCHORS_FROZEN_V0;
  readonly contract_text: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly transformer_contract: typeof D2A1_TRANSFORMER_CONTRACT;
  readonly invalid_rule: typeof D2A1_QUALIFICATION_INVALID_RULE;
  readonly paragraph_unchanged: string;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly supersedes_scope: readonly string[];
  readonly model_calls_before_amendment_for_a1: 0;
  readonly a0_results_already_known: true;
  readonly amendment_uses_a0_token_pattern: false;
  readonly amendment_scope: "A1 measurement execution prerequisites only";
  readonly a1_paraphrase_literal_unchanged: true;
  readonly a1_prediction_unchanged: true;
  readonly a1_scientific_claims_unchanged: true;
  readonly design_changed: false;
  readonly revision_1_1b_manifest_hash_preserved: string;
  readonly fixture_manifest_hash: HashV1;
  readonly contract_text_hash: HashV1;
  readonly manifest_hash: HashV1;
}

export async function deriveD2Rev11cManifestV0(): Promise<D2Rev11cManifestV0> {
  // 1. lexical laws, mechanically
  const contractNgrams = new Set(ngrams(D2A1_CONTRACT_TEXT, 4));
  const canonicalOverlap = ngrams(D1_PROPOSITION_LABEL, 4).filter((g) => contractNgrams.has(g));
  const paraphraseOverlap = ngrams(D2A1_PARAPHRASE, 4).filter((g) => ngrams(D1_PROPOSITION_LABEL, 4).includes(g));
  const credenceNumbers = ["0.8", "0.2", "0.5", "0.95", "0.49", "0.06", "0.80", "0.20", "0.50"].filter(
    (n) => D2A1_CONTRACT_TEXT.includes(n) || D2A1_PARAPHRASE.includes(n)
  );
  const actionHits = ACTION_TOKENS.filter((t) => new RegExp(`\\b${t}\\b`).test(D2A1_CONTRACT_TEXT));
  const armWords = ["HIGH", "LOW", "arm", "treatment", "credence"].filter((w) => D2A1_CONTRACT_TEXT.includes(w));
  const containsCanonical = D2A1_CONTRACT_TEXT.includes(D1_PROPOSITION_LABEL);
  const fixtureTokens = D2A1_QUALIFICATION_FIXTURES.map((f) => f.expected_token);
  const eachTokenOnce = new Set(fixtureTokens).size === D2A1_TOKENS.length;
  const fixturePropositionUnshared = D2A1_QUALIFICATION_FIXTURES.every((f) => f.belief_line.includes(D2A1_PARAPHRASE));
  const experimentalCredencesAbsent = !D2A1_QUALIFICATION_FIXTURES.some((f) =>
    ["0.8", "0.2", "0.5"].some((n) => new RegExp(`"credence":${n}[,}]`).test(f.belief_line))
  );
  const problems: string[] = [];
  if (canonicalOverlap.length > 0) problems.push(`contract shares 4-grams with the canonical label: ${canonicalOverlap.join(" | ")}`);
  if (paraphraseOverlap.length > 0) problems.push(`paraphrase shares 4-grams with the canonical label: ${paraphraseOverlap.join(" | ")}`);
  if (credenceNumbers.length > 0) problems.push(`credence numbers present: ${credenceNumbers.join(",")}`);
  if (actionHits.length > 0) problems.push(`action tokens present: ${actionHits.join(",")}`);
  if (armWords.length > 0) problems.push(`arm words present: ${armWords.join(",")}`);
  if (containsCanonical) problems.push("contract contains the canonical proposition label");
  if (!eachTokenOnce) problems.push("the three tokens are not each expected exactly once");
  if (!fixturePropositionUnshared) problems.push("a fixture does not carry the frozen paraphrase");
  if (!experimentalCredencesAbsent) problems.push("an experimental credence appears in a fixture");
  if (problems.length > 0) {
    throw new Error(`D2_A1_PREREQUISITES_NONCONFORMANT: ${problems.join(" ; ")}`);
  }
  const tests = {
    contract_4gram_overlap_with_canonical_label: canonicalOverlap.length,
    paraphrase_4gram_overlap_with_canonical_label: paraphraseOverlap.length,
    credence_numbers_present: credenceNumbers.length,
    action_tokens_present: actionHits.length,
    arm_words_present: armWords.length,
    contract_contains_the_canonical_proposition: containsCanonical,
    each_of_the_three_tokens_expected_exactly_once: eachTokenOnce,
    every_fixture_carries_the_frozen_paraphrase: fixturePropositionUnshared,
    experimental_credences_absent_from_fixtures: experimentalCredencesAbsent,
    fixture_count: D2A1_QUALIFICATION_FIXTURES.length,
    replicates_per_fixture: 3,
    verification_cost: 0
  };

  const body = {
    version: D2_VERSION_REV1_1C,
    fixtures: D2A1_QUALIFICATION_FIXTURES,
    expected_token_map: D2A1_EXPECTED_TOKEN_MAP,
    invariants: D2A1_QUALIFICATION_INVARIANTS,
    anchors: D2A1_ANCHORS_FROZEN_V0,
    contract_text: D2A1_CONTRACT_TEXT,
    schema: D2A1_JSON_SCHEMA,
    transformer_contract: D2A1_TRANSFORMER_CONTRACT,
    invalid_rule: D2A1_QUALIFICATION_INVALID_RULE,
    paragraph_unchanged: D2A1_PARAPHRASE,
    tests,
    supersedes_scope: [
      "frozen A1 qualification fixture bytes (previously only fixture kinds)",
      "frozen A1 fixture -> expected-token map (previously absent)",
      "frozen A1 token anchors and measurement contract text (previously absent)",
      "frozen A1 transformer specification (previously only a name)",
      "frozen qualification invalid rule (previously absent)"
    ] as const,
    model_calls_before_amendment_for_a1: 0 as const,
    a0_results_already_known: true as const,
    amendment_uses_a0_token_pattern: false as const,
    amendment_scope: "A1 measurement execution prerequisites only" as const,
    a1_paraphrase_literal_unchanged: true as const,
    a1_prediction_unchanged: true as const,
    a1_scientific_claims_unchanged: true as const,
    design_changed: false as const,
    revision_1_1b_manifest_hash_preserved: D2_REVISION_1_1B_MANIFEST_HASH
  };
  return Object.freeze({
    ...body,
    fixture_manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, { fixtures: D2A1_QUALIFICATION_FIXTURES }),
    contract_text_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, { contract_text: D2A1_CONTRACT_TEXT }),
    manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body)
  });
}
