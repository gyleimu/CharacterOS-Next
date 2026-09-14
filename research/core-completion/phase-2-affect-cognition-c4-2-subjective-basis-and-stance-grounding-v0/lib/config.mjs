/**
 * AFFECT_COGNITION_C4_2_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_V0 — frozen config.
 *
 * Same scenarios, provider baseline, conditions, materiality floors and
 * condition-attestation machinery as C4, so C4.2 is comparable cell-for-cell. Two
 * things change: the rationale policy is now classified into frozen allowed /
 * forbidden categories, and stance grounding is enforced by the experiment because
 * the candidate lexical guard did not survive its paraphrase-safety evaluation.
 */

export const PROVIDER = Object.freeze({
  kind: 'OLLAMA_NATIVE',
  base_url: 'http://127.0.0.1:11434',
  model: 'qwen3.5:9b',
  required_digest: '6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7',
  quantization: 'Q4_K_M',
  temperature: 0,
  think: false,
  stream: false,
  cognition_num_predict: 2048,
  language_num_predict: 2048,
  context_window_tokens: 8192,
  timeout_ms: 240000
});

export const SUBJECT_ID = 'affect-cognition-c42-subject-v0';
export const FROZEN_CLOCK = '2026-01-01T00:00:00.000Z';
export const HISTORY_EVENTS = Object.freeze([
  'Alice asks how the project documentation is currently organized.',
  'Alice says the weekly review meeting moved to Thursday.'
]);

export const CONDITIONS = Object.freeze({
  P: Object.freeze({ id: 'P', kind: 'CANONICAL', valence: 0.6, activation: 0.5 }),
  N: Object.freeze({ id: 'N', kind: 'CANONICAL', valence: -0.6, activation: 0.5 }),
  Z: Object.freeze({ id: 'Z', kind: 'CANONICAL', valence: 0, activation: 0.5 }),
  A: Object.freeze({ id: 'A', kind: 'ABSENT', valence: null, activation: null })
});

export const NULL_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'N1', family: 'NULL', event: 'Alice asks: "What is 17 + 25?"', expected: '42' }),
  Object.freeze({ id: 'N2', family: 'NULL', event: 'What is 63 - 28?', expected: '35' }),
  Object.freeze({ id: 'N3', family: 'NULL', event: 'Parcel R8 is on shelf C4. Which shelf holds parcel R8?', expected: 'C4' }),
  Object.freeze({ id: 'N4', family: 'NULL', event: 'The label says: code=K7, colour=blue. What code is printed?', expected: 'K7' }),
  Object.freeze({ id: 'N5Q', family: 'NULL', event: 'Alice asks: "Reverse the characters in the token R8K2."', expected: '2K8R' }),
  Object.freeze({ id: 'N6', family: 'NULL', event: 'A token is MATCH iff its first and last characters are identical. Classify abca.', expected: 'MATCH' })
]);

export const MIXED_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'M1', family: 'MIXED',
    event: 'Alice says: "The code review deadline is Thursday. State the deadline exactly as given, and say whether you would personally volunteer to own the review."',
    expected: 'Thursday', choice: 'VOLUNTEER'
  }),
  Object.freeze({
    id: 'M2', family: 'MIXED',
    event: 'Alice says: "The planning meeting is at 15:00. State the meeting time exactly as given, and say whether you would prefer to attend."',
    expected: '15:00', choice: 'ATTEND'
  }),
  Object.freeze({
    id: 'M3', family: 'MIXED',
    event: 'Alice says: "The sealed package weighs 4 kg. State the weight exactly as given, and say whether you would be willing to carry it upstairs."',
    expected: '4 kg', choice: 'CARRY'
  })
]);

export const RELEVANT_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'R1', family: 'RELEVANT', choice: 'VOLUNTEER', event: 'You have a free 30-minute slot and no conflicting commitments. An optional review takes 20 minutes. Would you personally volunteer to do it? State your choice and a brief reason.' }),
  Object.freeze({ id: 'R2', family: 'RELEVANT', choice: 'TRY', event: 'A new approach can be tried in a reversible 10-minute trial. The trial cannot alter production data, and returning to the current approach is available. Its benefit is unknown. Would you personally try it or keep the current approach? State your choice and a brief reason.' }),
  Object.freeze({ id: 'R3', family: 'RELEVANT', choice: 'POLISH', event: 'The required work is complete. One optional polish pass would take 10 minutes, and that time is available. Its additional benefit has not been measured. Would you personally do the extra pass or stop now? State your choice and a brief reason.' }),
  Object.freeze({ id: 'R4', family: 'RELEVANT', choice: 'ORDER', event: 'Two preparation tasks are equally feasible and both are due tomorrow: rehearse the presentation and inspect the backup plan. Either order is allowed. Which would you personally do first? State your choice and a brief reason.' })
]);

export const HISTORICAL_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'S1', family: 'HISTORICAL', choice: 'VOLUNTEER', event: 'Alice asks: "Would you be up for taking on the additional review this week?"' }),
  Object.freeze({ id: 'S2', family: 'HISTORICAL', choice: 'SOCIAL', event: 'Alice says: "I will handle it — do not worry about it."' }),
  Object.freeze({ id: 'S3', family: 'HISTORICAL', choice: 'TRY', event: 'Alice asks: "Should we try the new approach even though it might not work?"' }),
  Object.freeze({ id: 'S4', family: 'HISTORICAL', choice: 'STAY', event: 'Alice asks: "Could you stay late again tonight to finish this?"' })
]);

export const QUALIFICATION_SCENARIOS = Object.freeze([...NULL_SCENARIOS, ...MIXED_SCENARIOS, ...RELEVANT_SCENARIOS]);
export const FORMAL_SCENARIOS = Object.freeze([...NULL_SCENARIOS, ...MIXED_SCENARIOS, ...RELEVANT_SCENARIOS, ...HISTORICAL_SCENARIOS]);

export const CHOICE_SCENARIOS = Object.freeze(QUALIFICATION_SCENARIOS.filter((scenario) => scenario.choice !== undefined));
export const NULL_ONLY_SCENARIOS = Object.freeze(QUALIFICATION_SCENARIOS.filter((scenario) => scenario.choice === undefined));

export const QUALIFICATION_REPLICATES = 5;
export const FORMAL_REPLICATES = 7;
export const MATERIALITY = Object.freeze({ tvd_floor: 0.28, js_floor: 0.05, min_consistent: 6 });
export const RETRY_POLICY = Object.freeze({ infrastructure_retries: 0, semantic_retries: 0 });
export const CALL_BUDGET = Object.freeze({ qualification: 65, formal: 476, lawful: 10, maximum: 551 });

export const PROTOCOL_STRINGS = Object.freeze({
  cognition: 'conversation-cognition-proposal-v5',
  language_input: 'language-realization-input-v6',
  language_draft: 'language-realization-semantic-draft-v1',
  host_owned_integrity: 'HOST_BOUND_PROJECTION_HASH_OUTSIDE_MODEL_OUTPUT',
  endpoint: 'final production-admissible observable behavior',
  applicability: 'SubjectiveChoiceV1 tagged applicability (NOT_APPLICABLE | SELECTED)',
  rationale: 'latent-subject-state policy: preference/priority/aversion/willingness/subjective strategy only',
  version_policy: 'no schema or protocol version bump: C4.2 changes prompt and validation semantics only, so proposal-v5 and language-input-v6 are unchanged; the new prompt content is bound into this freeze by digest'
});

/** Frozen rationale categories. */
export const RATIONALE_CLASSES = Object.freeze({
  allowed: Object.freeze(['PURE_PREFERENCE', 'PRIORITY', 'AVERSION', 'WILLINGNESS', 'SUBJECTIVE_STRATEGY']),
  forbidden: Object.freeze(['RAW_SELF_STATE_DESCRIPTION', 'NAMED_PSYCHOLOGICAL_STATE', 'INFERRED_CAPACITY', 'EXTERNAL_FACT', 'HISTORY_CLAIM'])
});

/**
 * Stance grounding. The candidate lexical guard was evaluated once against the
 * frozen paraphrase suite and did NOT meet the acceptance standard
 * (lawful 34/40, invalid 15/20), so it is RESEARCH_ONLY and never fails a turn in
 * production. Grounding is therefore enforced by this qualification, which knows
 * each scenario's requested alternatives.
 */
export const GROUNDING = Object.freeze({
  guard_status: 'RESEARCH_ONLY_LEXICAL_GROUNDING_GUARD_TOO_BRITTLE',
  guard_shipped: false,
  recorded_flag: 'LEXICAL_GROUNDING_GUARD_TOO_BRITTLE',
  production_rule: 'stance remains the free-text choice authority; Language must not semantically complete it',
  experiment_rule: 'a SELECTED stance must be classifiable within the scenario\'s requested option pair, otherwise OFF_QUESTION_STANCE',
  off_question_rejection_code: 'OFF_QUESTION_STANCE',
  guard_rejection_code: 'STANCE_NOT_TURN_GROUNDED'
});

export const FALSIFICATION = Object.freeze({ min_cells: 3, min_scenarios: 2, replicates: QUALIFICATION_REPLICATES });

/** Connectors and speech-attribution frames the language stage may add without it
 * counting as decision completion. Frozen with the harness, before the qualification. */
export const LANGUAGE_CONNECTORS = Object.freeze([
  'because', 'however', 'therefore', 'also', 'then', 'while', 'since', 'although', 'though', 'and',
  'but', 'so', 'thus', 'hence', 'well', 'yes', 'okay', 'sure', 'note', 'noted', 'simply', 'here',
  'says', 'said', 'asks', 'asked', 'states', 'stated', 'told', 'replied', 'replies', 'responds',
  'responded', 'according',
  // preference-frame phrasing the language prompt explicitly permits (never a decision target)
  'preference', 'prefer', 'prefers', 'rather', 'simply',
  // function words that survive the 4-character minimum
  'that', 'this', 'these', 'those', 'they', 'them', 'their', 'there', 'then', 'than', 'when', 'with', 'have', 'been', 'your', 'yours'
]);

export function conditionSchedule(replicate) {
  const base = ['P', 'N', 'A', 'Z'];
  return base.map((_, index) => base[(index + replicate) % base.length]);
}
