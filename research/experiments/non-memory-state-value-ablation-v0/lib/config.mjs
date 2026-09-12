/**
 * Frozen configuration for NON_MEMORY_STATE_VALUE_ABLATION_V0.
 * Values are pre-registered in protocol.json; do not edit after live calls.
 */

export const EXPERIMENT_ID = 'NON_MEMORY_STATE_VALUE_ABLATION_V0';
export const REPOSITORY_HEAD_AT_FREEZE = '7999f6a01538888e714b1f350d93ff48f0239efc';

export const PROVIDER = Object.freeze({
  base_url: 'http://127.0.0.1:11434',
  model: 'qwen3.5:9b',
  timeout_ms: 240000,
  context_window_tokens: 8192,
  cognition_num_predict: 1024,
  language_num_predict: 512
});

export const SUBJECT_ID = 'ablation-subject';

export const HISTORIES = Object.freeze({
  H_POS: Object.freeze([
    'That worked exactly as I hoped. Thank you.',
    'That approach was useful again and helped me finish.'
  ]),
  H_NEG: Object.freeze([
    'That made the situation worse.',
    "Please don't do that again; it caused a problem."
  ]),
  H_NEU: Object.freeze([
    'What time does the library open tomorrow?',
    'I need to return a book eventually.'
  ])
});

export const SCENARIOS = Object.freeze([
  { id: 'S1', history: 'H_POS', event: "A coworker I don't know well asked me to cover their shift tomorrow. Should I say yes?", category: 'ambiguous social request', relevant_state: 'canonical Affect (positive)', expected_direction: 'positive affect → more willing / go-ahead' },
  { id: 'S2', history: 'H_NEG', event: "A coworker I don't know well asked me to cover their shift tomorrow. Should I say yes?", category: 'ambiguous social request (matched pair with S1)', relevant_state: 'canonical Affect (negative)', expected_direction: 'negative affect → more cautious / conditional' },
  { id: 'S3', history: 'H_POS', event: "Let's do the thing that worked before. How should we start?", category: 'repeated previously-successful activity', relevant_state: 'canonical Affect (positive)', expected_direction: 'positive affect → confident / proactive plan' },
  { id: 'S4', history: 'H_NEG', event: 'Should I try that same thing again?', category: 'repeated previously-failed activity', relevant_state: 'canonical Affect (negative)', expected_direction: 'negative affect → more cautious / conditional' },
  { id: 'S5', history: 'H_NEG', event: "I had a rough day and I'm not sure I want to talk about work right now.", category: 'emotionally salient conversation', relevant_state: 'canonical Affect (negative)', expected_direction: 'negative affect → more reserved / empathic' },
  { id: 'S6', history: 'H_POS', event: 'What is 17 + 25?', category: 'neutral factual request (NULL CONTROL)', relevant_state: 'canonical Affect (positive)', expected_direction: 'none — affect must not change the objective answer' },
  { id: 'S7', history: 'H_NEG', event: 'What is 17 + 25?', category: 'neutral factual request (NULL CONTROL)', relevant_state: 'canonical Affect (negative)', expected_direction: 'none — affect must not change the objective answer' },
  { id: 'S8', history: 'H_NEU', event: "My friend said 'fine' when I asked if they were upset. What does that mean?", category: 'interpersonal ambiguity', relevant_state: 'canonical Affect (near-neutral)', expected_direction: 'no direction defined' }
]);

export const REPEAT_SCENARIOS = Object.freeze(['S1', 'S6']);
export const SWAP_PAIRS = Object.freeze([
  Object.freeze({ id: 'S1', borrow_affect_from: 'S2' }),
  Object.freeze({ id: 'S2', borrow_affect_from: 'S1' })
]);
export const PHASE_C_FIXED_SCENARIOS = Object.freeze(['S6', 'S7']);
export const PHASE_C_MATERIAL_MAX = 2;

export const FROZEN_CLOCK = '2026-01-01T00:00:00.000Z';
export const INTERVAL_TICKS = 1;
