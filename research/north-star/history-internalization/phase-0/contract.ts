/* eslint-disable no-restricted-imports -- Isolated research harness consuming frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * HISTORY_INTERNALIZATION_TEST_V1 — PHASE 0 contract, REV2 (outputs unseen).
 *
 * PHASE 0 answers exactly one question:
 *   does controlled LIVED evidence reach the PERSISTENT canonical belief state,
 *   in the pre-registered direction, differently for two identically-initialised subjects?
 *
 * It deliberately answers nothing about cognition, decision, behaviour, relationship,
 * personality or affect.
 *
 * REV2 corrects two defects found by the 0-call audit of the V1 preregistration:
 *   D1. the V1 call model ("1 cognition + 1 belief semantic = 2 calls/turn") is factually
 *       wrong. The production turn also runs language and factual-event appraisal, so the
 *       real cost is ~5 calls/turn. A budget built on 2 was not extractable.
 *   D2. V1 derived the trajectory length N from a calibration phase, so the Phase-0 total
 *       was not knowable before the first call. REV2 fixes N a priori and freezes the stop
 *       rule on TURNS, which removes every "decide when to stop while running" freedom.
 *
 * Neither defect touches the scientific question, the subjects, the evidence, or the
 * executor's authority; both are budget/design corrections made before any call.
 */

import { hashEnvelope } from "../../../../packages/subject-core/dist/index.js";

export const P0_HASH_PROJECTION_V0 = "characteros-next/research/history-internalization/phase-0/v1" as const;

export const P0_CREDENTIAL_ENV = "MODEL_API_KEY" as const;

// ---------------------------------------------------------------------------------------------
// §5 TARGET PROPOSITION (frozen before any call; the ONLY proposition Phase 0 tests)
// ---------------------------------------------------------------------------------------------

/**
 * Selection criteria satisfied: (a) an ordinary canonical proposition the production
 * adaptation path already handles as an EXISTING target, so no new mechanism is involved;
 * (b) lived conversational events bear on it naturally; (c) it is experiential, not an
 * identity claim; (d) it is NOT the D1 label — D1's proposition ("caution is warranted
 * when the conclusion rests on information I have not seen myself") is an epistemic
 * first-person stance that a conversation cannot lawfully support or contradict, so
 * reusing it would test a different arrow; Phase 0 reuses D1's canonical MACHINERY
 * (proposition identity + credence law + `stance(c) = 2c - 1`) instead, which is what
 * "connected to D1/D2" can mean here; (e) nothing ever tells the subject the conclusion.
 */
export const P0_TARGET_PROPOSITION_ID = "prop.nadia-keeps-commitments";
export const P0_TARGET_PROPOSITION_LABEL = "Nadia keeps the commitments she makes to me.";

/**
 * Baseline credence. NOT an invented number and NOT the outcome: it is the frozen
 * production first-formation credence (`BELIEF_PROPOSITION_FIRST_CREDENCE`), i.e. the
 * Belief domain's stance-zero point plus one frozen plasticity step. Both subjects receive
 * exactly this value, so it is a shared initial condition, never a treatment.
 */
export const P0_BASELINE_CREDENCE = 0.55;

/** Preregistered directions (the arrow this round tests, stated before the data). */
export const P0_PREDICTED_A_DIRECTION = "INCREASE" as const;
export const P0_PREDICTED_B_DIRECTION = "DECREASE" as const;

// ---------------------------------------------------------------------------------------------
// §3/§4 SUBJECT IDENTITY
// ---------------------------------------------------------------------------------------------

/**
 * §4 identity leakage. The production cognition prompt renders `subject_id` into SUBJECT DATA
 * (conversation-cognition-provider-v2.ts builds `[identity] subject_id=...`), and removing it
 * would be a production modification. The lawful resolution is therefore to make the exposed
 * identifier carry ZERO arm information: both ids are opaque, equal-length, non-semantic,
 * share the same stem, and differ only in a 4-digit suffix with no order or valence meaning.
 * Display names are IDENTICAL for both subjects. The leakage audit asserts these properties.
 */
export const P0_SUBJECT_A_ID = "subject-k7q2-4103";
export const P0_SUBJECT_B_ID = "subject-k7q2-8267";
export const P0_SUBJECT_DISPLAY_NAME = "Wren";
/** Qualification subject: a THIRD identity, non-target, discarded before the experiment. */
export const P0_QUAL_SUBJECT_ID = "subject-q0v8-3319";
export const P0_QUAL_PROPOSITION_ID = "prop.qual-floorboards";
export const P0_QUAL_PROPOSITION_LABEL = "The floorboards in the hallway are level.";
export const P0_QUAL_TURN_TEXT =
  "The carpenter looked at the hallway this morning and said the boards he laid last month are still level.";

// ---------------------------------------------------------------------------------------------
// §7 CONTROLLED TRAJECTORY (matched; the ONLY difference is the outcome span of a commitment)
// ---------------------------------------------------------------------------------------------

/**
 * Every turn is the SAME template in both arms; only `{OUT}` is substituted from
 * P0_VALENCE_TABLE. Turn 0 carries NO outcome span, so it is byte-identical across arms:
 * the two trajectories share a common opening and diverge only where a commitment's
 * outcome is reported. The isolation audit proves the diff is exactly these spans.
 */
export const P0_TURN_TEMPLATES: readonly string[] = Object.freeze([
  "I've told you I'll pick up the replacement key on Wednesday, so you know where I'll be.",
  "About the key: {OUT} And I've told you I'll bring the ladder back to the shed before the weekend.",
  "About the ladder: {OUT} And I've told you I'll send the deposit form to the landlord on Monday.",
  "About the form: {OUT} And I've told you I'll collect the repaired lamp on Friday.",
  "About the lamp: {OUT} And I've told you I'll water the plants while you're away."
]);

/**
 * The frozen valence table. OUTCOME_KEPT and OUTCOME_BROKEN are matched: same length
 * (43 characters), same two-clause shape, same commitment, same consequence magnitude,
 * and the BROKEN span adds NO cause or excuse — it states non-completion only, so no
 * external attribution is introduced as a confound.
 */
export const P0_OUTCOME_KEPT = "I did it, and I did it when I said I would.";
export const P0_OUTCOME_BROKEN = "I did not do it, and the day I named passed.";

export const P0_VALENCE_TABLE: readonly { readonly turn_index: number; readonly arm_A: string; readonly arm_B: string }[] =
  Object.freeze([
    { turn_index: 1, arm_A: P0_OUTCOME_KEPT, arm_B: P0_OUTCOME_BROKEN },
    { turn_index: 2, arm_A: P0_OUTCOME_KEPT, arm_B: P0_OUTCOME_BROKEN },
    { turn_index: 3, arm_A: P0_OUTCOME_KEPT, arm_B: P0_OUTCOME_BROKEN },
    { turn_index: 4, arm_A: P0_OUTCOME_KEPT, arm_B: P0_OUTCOME_BROKEN }
  ]);

export const P0_TURN_COUNT = P0_TURN_TEMPLATES.length;

/** Renders one arm's turn text from the frozen template + valence table. */
export function renderPhase0TurnTextV0(arm: "A" | "B", turnIndex: number): string {
  const template = P0_TURN_TEMPLATES[turnIndex];
  if (template === undefined) throw new Error(`P0_TURN_INDEX_OUT_OF_RANGE: ${turnIndex}`);
  const row = P0_VALENCE_TABLE.find((entry) => entry.turn_index === turnIndex);
  if (row === undefined) {
    if (!template.includes("{OUT}")) return template;
    throw new Error(`P0_VALENCE_ROW_MISSING: turn ${turnIndex} has an outcome span but no table row`);
  }
  if (!template.includes("{OUT}")) throw new Error(`P0_VALENCE_ROW_UNUSED: turn ${turnIndex} has a row but no span`);
  return template.replace("{OUT}", arm === "A" ? row.arm_A : row.arm_B);
}

// ---------------------------------------------------------------------------------------------
// §4 FORBIDDEN MODEL-VISIBLE CONTENT
// ---------------------------------------------------------------------------------------------

/**
 * Frozen forbidden substrings for the model-visible leakage audit. Case-insensitive.
 * The arm labels and the experiment's own vocabulary must never appear in any request
 * the executor sees, in any trajectory text, or in any subject display name.
 */
export const P0_FORBIDDEN_MODEL_VISIBLE_SUBSTRINGS: readonly string[] = Object.freeze([
  "subject-k7q2-4103",
  "subject-k7q2-8267",
  "subject-q0v8-3319",
  "positive arm",
  "negative arm",
  "arm a",
  "arm b",
  "trusted",
  "betrayed",
  "high belief",
  "low belief",
  "expected direction",
  "phase 0",
  "phase-0",
  "history internalization",
  "credence",
  "proposition_id",
  "plasticity"
]);

// ---------------------------------------------------------------------------------------------
// §22 EXECUTOR (recorded, never hardcoded into a verdict)
// ---------------------------------------------------------------------------------------------

/**
 * The REAL production executor configuration. The interactive runtime's transports and the
 * belief semantic provider are the production Ollama-native ones; NO transport is substituted,
 * so Phase 0 runs the shipped production stack. The model identity is recorded as data and
 * reported with the result — it is never baked into a verdict token.
 */
export const P0_OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
export const P0_EXECUTOR_MODEL = process.env["CHARACTEROS_MODEL"] ?? "qwen3.5:9b";
export const P0_COGNITION_NUM_PREDICT = 2048 as const;
export const P0_COGNITION_CONTEXT_TOKENS = 8192 as const;
export const P0_APPRAISAL_NUM_PREDICT = 256 as const;
export const P0_APPRAISAL_CONTEXT_TOKENS = 4096 as const;

// ---------------------------------------------------------------------------------------------
// §24 PHASE-0 BUDGET (exact, frozen before the first call)
// ---------------------------------------------------------------------------------------------

/**
 * The stop rule is frozen on TURNS, not calls, because the per-turn auxiliary call count is a
 * mechanical property of the production turn loop (cognition + language + appraisal, measured
 * in the qualification turn) rather than a scientific degree of freedom. The belief-semantic
 * call count — the only calls that can move the endpoint — is exact and fixed at one per turn.
 */
export const P0_QUALIFICATION_TURNS = 1 as const;
export const P0_TURNS_PER_ARM = P0_TURN_COUNT;
export const P0_SCIENTIFIC_TURNS = 2 * P0_TURNS_PER_ARM;
export const P0_TOTAL_TURNS = P0_QUALIFICATION_TURNS + P0_SCIENTIFIC_TURNS;
export const P0_BELIEF_SEMANTIC_CALLS_PER_TURN = 1 as const;
export const P0_EXACT_BELIEF_SEMANTIC_CALLS = P0_TOTAL_TURNS * P0_BELIEF_SEMANTIC_CALLS_PER_TURN;
/** Frozen upper bound on auxiliary calls per turn (cognition 1 + language 1 + appraisal <= 3). */
export const P0_MAX_AUXILIARY_CALLS_PER_TURN = 5 as const;
export const P0_MAX_TOTAL_MODEL_CALLS = P0_TOTAL_TURNS * (P0_MAX_AUXILIARY_CALLS_PER_TURN + 1);
export const P0_V1_BUDGET_WAS = 115 as const;

// ---------------------------------------------------------------------------------------------
// §13/§18 FROZEN SCORER (pure; frozen before the first call)
// ---------------------------------------------------------------------------------------------

export const P0_PRIMARY_PREDICATE =
  "delta_A > 0 AND delta_B < 0 AND credence_A_post != credence_B_post" as const;

export type Phase0FailureSubkindV0 =
  | "A_ABSTAINED_NO_MOVEMENT"
  | "B_ABSTAINED_NO_MOVEMENT"
  | "BOTH_ABSTAINED_NO_MOVEMENT"
  | "WRONG_DIRECTION_A"
  | "WRONG_DIRECTION_B"
  | "SAME_DIRECTION_BOTH"
  | "BOTH_MOVED_IN_PREDICTED_DIRECTIONS_BUT_VALUES_EQUAL";

export type Phase0VerdictV0 =
  | { readonly outcome: "POSITIVE"; readonly verdict: "LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED" }
  | { readonly outcome: "FAILURE_A"; readonly verdict: "HISTORY_INTERNALIZATION_V1_FAILURE_A_EXPERIENCE_TO_STATE_NOT_ESTABLISHED"; readonly subkind: Phase0FailureSubkindV0 }
  | { readonly outcome: "INCONCLUSIVE"; readonly verdict: "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE"; readonly reason: string };

/** Frozen integrity gate: INCONCLUSIVE is reserved for engineering failure, never for a null. */
export const P0_INCONCLUSIVE_CONDITIONS: readonly string[] = Object.freeze([
  "qualification turn did not reach status COMPLETE",
  "any scientific turn did not reach status COMPLETE",
  "any turn reported a belief-adaptation wiring failure",
  "a canonical state artifact is missing or unreadable",
  "the frozen schedule was not followed (turn count or order mismatch)",
  "the pre-state equivalence audit failed"
]);

export interface Phase0ScoreInputV0 {
  readonly credence_pre_A: number;
  readonly credence_post_A: number;
  readonly credence_pre_B: number;
  readonly credence_post_B: number;
  readonly turns_executed_A: number;
  readonly turns_executed_B: number;
  readonly integrity_failures: readonly string[];
}

export interface Phase0ScoreResultV0 {
  readonly delta_A: number;
  readonly delta_B: number;
  readonly between_subject_divergence: number;
  readonly directional_match_A: boolean;
  readonly directional_match_B: boolean;
  readonly values_differ: boolean;
  readonly primary_predicate: string;
  readonly primary_predicate_satisfied: boolean;
  readonly verdict: Phase0VerdictV0;
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/** Pure, total, and able to reach every outcome class on constructed input. */
export function scorePhase0V0(input: Phase0ScoreInputV0): Phase0ScoreResultV0 {
  const deltaA = round6(input.credence_post_A - input.credence_pre_A);
  const deltaB = round6(input.credence_post_B - input.credence_pre_B);
  const divergence = round6(input.credence_post_A - input.credence_post_B);
  const matchA = P0_PREDICTED_A_DIRECTION === "INCREASE" ? deltaA > 0 : deltaA < 0;
  const matchB = P0_PREDICTED_B_DIRECTION === "DECREASE" ? deltaB < 0 : deltaB > 0;
  const valuesDiffer = input.credence_post_A !== input.credence_post_B;
  const base = {
    delta_A: deltaA,
    delta_B: deltaB,
    between_subject_divergence: divergence,
    directional_match_A: matchA,
    directional_match_B: matchB,
    values_differ: valuesDiffer,
    primary_predicate: P0_PRIMARY_PREDICATE
  };

  // Integrity first: engineering failure is never reported as a scientific null.
  if (input.integrity_failures.length > 0) {
    return {
      ...base,
      primary_predicate_satisfied: false,
      verdict: {
        outcome: "INCONCLUSIVE",
        verdict: "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE",
        reason: input.integrity_failures.join("; ")
      }
    };
  }

  if (matchA && matchB && valuesDiffer) {
    return {
      ...base,
      primary_predicate_satisfied: true,
      verdict: { outcome: "POSITIVE", verdict: "LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED" }
    };
  }

  let subkind: Phase0FailureSubkindV0;
  if (deltaA === 0 && deltaB === 0) subkind = "BOTH_ABSTAINED_NO_MOVEMENT";
  else if (deltaA === 0) subkind = "A_ABSTAINED_NO_MOVEMENT";
  else if (deltaB === 0) subkind = "B_ABSTAINED_NO_MOVEMENT";
  else if (!matchA && matchB) subkind = "WRONG_DIRECTION_A";
  else if (matchA && !matchB) subkind = "WRONG_DIRECTION_B";
  else if (deltaA > 0 && deltaB > 0) subkind = "SAME_DIRECTION_BOTH";
  else if (deltaA < 0 && deltaB < 0) subkind = "SAME_DIRECTION_BOTH";
  else subkind = "BOTH_MOVED_IN_PREDICTED_DIRECTIONS_BUT_VALUES_EQUAL";

  return {
    ...base,
    primary_predicate_satisfied: false,
    verdict: {
      outcome: "FAILURE_A",
      verdict: "HISTORY_INTERNALIZATION_V1_FAILURE_A_EXPERIENCE_TO_STATE_NOT_ESTABLISHED",
      subkind
    }
  };
}

// ---------------------------------------------------------------------------------------------
// §16/§23 EVIDENCE HIERARCHY (L1 -> L2 only; never a skip)
// ---------------------------------------------------------------------------------------------

export const P0_HIERARCHY_BEFORE = "L1" as const;
export const P0_HIERARCHY_AFTER_POSITIVE = "L2" as const;
export const P0_HIERARCHY_AFTER_NULL = "L1" as const;
export const P0_L2_MEANING =
  "LIVED experience changes canonical state. It does NOT mean history internalization works: L3 (the change alters cognition in a NEW scenario with the raw history absent) has not been tested." as const;

export const P0_FORBIDDEN_POSITIVE_CLAIMS: readonly string[] = Object.freeze([
  "history internalization works",
  "the subject has been shaped by its life",
  "persistent belief influences cognition",
  "persistent belief influences decision or behaviour",
  "the CharacterOS north star is established",
  "personality or affect channels contribute"
]);

export async function hashPhase0(content: string, name: string): Promise<string> {
  return String(await hashEnvelope(P0_HASH_PROJECTION_V0, { name, content }));
}
