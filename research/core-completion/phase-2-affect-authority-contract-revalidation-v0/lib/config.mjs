/**
 * AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0 — frozen config.
 *
 * Revalidation of the SAME Phase-2 causal manipulation (P/N/Z/A, identical
 * values) against the NEW GPT-6 Family C conversation protocol. The endpoint is
 * the FINAL production-admissible observable behavior, not parser acceptance.
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

export const SUBJECT_ID = 'affect-authority-revalidation-subject-v0';
export const FROZEN_CLOCK = '2026-01-01T00:00:00.000Z';
export const INTERVAL_TICKS = 1;

export const HISTORY_EVENTS = Object.freeze([
  'Alice asks how the project documentation is currently organized.',
  'Alice says the weekly review meeting moved to Thursday.'
]);

/** Identical Phase-2 condition values (do not change). */
export const CONDITIONS = Object.freeze({
  P: Object.freeze({ id: 'P', kind: 'CANONICAL', valence: 0.6, activation: 0.5 }),
  N: Object.freeze({ id: 'N', kind: 'CANONICAL', valence: -0.6, activation: 0.5 }),
  Z: Object.freeze({ id: 'Z', kind: 'CANONICAL', valence: 0, activation: 0.5 }),
  A: Object.freeze({ id: 'A', kind: 'ABSENT', valence: null, activation: null })
});

export const ACTIVATION_CONDITIONS = Object.freeze({
  LOW: Object.freeze({ id: 'LOW', kind: 'CANONICAL', valence: 0, activation: 0.2 }),
  HIGH: Object.freeze({ id: 'HIGH', kind: 'CANONICAL', valence: 0, activation: 0.8 })
});

export const REPLICATES = 7;

export function primarySchedule(replicates = REPLICATES) {
  const base = ['P', 'N', 'A', 'Z'];
  const schedule = [];
  for (let r = 0; r < replicates; r += 1) {
    for (let i = 0; i < base.length; i += 1) schedule.push(base[(i + r) % base.length]);
  }
  return schedule;
}

export function activationSchedule(replicates = REPLICATES) {
  const base = ['LOW', 'HIGH'];
  const schedule = [];
  for (let r = 0; r < replicates; r += 1) {
    for (let i = 0; i < base.length; i += 1) schedule.push(base[(i + r) % base.length]);
  }
  return schedule;
}

/** 4 affect-relevant scenarios — EXACT Phase-2 wording, unchanged. */
export const AFFECT_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'S1_AMBIGUOUS_REQUEST',
    role: 'AFFECT_RELEVANT',
    event: 'Alice asks: "Would you be up for taking on the additional review this week?"',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  }),
  Object.freeze({
    id: 'S2_SOCIAL_INTERPRETATION',
    role: 'AFFECT_RELEVANT',
    event: 'Alice says: "I will handle it — do not worry about it."',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  }),
  Object.freeze({
    id: 'S3_UNCERTAIN_RECOMMENDATION',
    role: 'AFFECT_RELEVANT',
    event: 'Alice asks: "Should we try the new approach even though it might not work?"',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  }),
  Object.freeze({
    id: 'S4_BOUNDARY_WILLINGNESS',
    role: 'AFFECT_RELEVANT',
    event: 'Alice asks: "Could you stay late again tonight to finish this?"',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  })
]);

/** 6 objective oracle controls — exact GPT-6 wording. */
export const NULL_SCENARIOS = Object.freeze([
  Object.freeze({ id: 'N1', role: 'FACTUAL_CONTROL', event: 'Alice asks: "What is 17 + 25?"', expected: '42' }),
  Object.freeze({ id: 'N2', role: 'FACTUAL_CONTROL', event: 'What is 63 - 28?', expected: '35' }),
  Object.freeze({ id: 'N3', role: 'FACTUAL_CONTROL', event: 'Parcel R8 is on shelf C4. Which shelf holds parcel R8?', expected: 'C4' }),
  Object.freeze({ id: 'N4', role: 'FACTUAL_CONTROL', event: 'The label says: code=K7, colour=blue. What code is printed?', expected: 'K7' }),
  Object.freeze({ id: 'N5', role: 'FACTUAL_CONTROL', event: 'Replace each A with B in AACA. Leave other characters unchanged.', expected: 'BBCB' }),
  Object.freeze({ id: 'N6', role: 'FACTUAL_CONTROL', event: 'A token is MATCH iff its first and last characters are identical. Classify abca.', expected: 'MATCH' })
]);

export const PRIMARY_SCENARIOS = Object.freeze([...AFFECT_SCENARIOS, ...NULL_SCENARIOS]);

export const ACTIVATION_SCENARIO_IDS = Object.freeze(['S1_AMBIGUOUS_REQUEST', 'S3_UNCERTAIN_RECOMMENDATION']);

/**
 * Frozen final-behavior classifier for affect-relevant scenarios.
 * Precedence: CLARIFY > DECLINE > CAUTIOUS > SUPPORT > OTHER.
 */
export const BEHAVIOR_RULES = Object.freeze([
  Object.freeze({ class: 'ASK_FOR_CLARIFICATION', re: '^\\s*could you clarify' }),
  Object.freeze({ class: 'REALIZE_DECLINE', re: "\\b(cannot|can't|won't|unable|decline|refuse|not able|pass on|not possible|no longer)\\b" }),
  Object.freeze({ class: 'REALIZE_CAUTIOUS', re: '\\b(depends|conditional|condition|need to know|confirm|check|unsure|hesitat|careful|before i|if |only if)\\b' }),
  Object.freeze({ class: 'REALIZE_SUPPORT', re: '\\b(yes|sure|happy|glad|willing|of course|go ahead|take on|i can|absolutely|definitely|i will)\\b' })
]);

export const CLARIFICATION_TEXT_V0 = 'Could you clarify what you mean?';

export const MATERIALITY = Object.freeze({
  tvd_floor: 0.28,
  js_floor: 0.05,
  min_consistent: 6,
  replicates: REPLICATES
});

export const SUCCESS = Object.freeze({
  null_controls_required_correct: 6 * 4 * REPLICATES,
  affect_relevant_min_scenarios: 3,
  affect_relevant_total: AFFECT_SCENARIOS.length
});

export const RETRY_POLICY = Object.freeze({
  max_infrastructure_retries: 1,
  semantic_retries: 0,
  schema_or_authority_rejection_is_result: true
});

export const CALL_BUDGET = Object.freeze({
  primary_cognition: PRIMARY_SCENARIOS.length * 4 * REPLICATES,
  activation_cognition: ACTIVATION_SCENARIO_IDS.length * 2 * REPLICATES,
  lawful_cognition: 2 * 5,
  max_total_cognition: 318
});
