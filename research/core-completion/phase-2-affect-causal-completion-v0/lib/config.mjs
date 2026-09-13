/**
 * AFFECT_CAUSAL_COMPLETION_V0 — frozen experiment configuration.
 *
 * Everything an experiment could tune after seeing outputs is frozen HERE,
 * before any live call: provider identity, condition values, scenario set,
 * replicate count, execution order, classification taxonomy, materiality
 * thresholds, stop rules and call budget.
 *
 * Production code is NOT touched. All conditions are built as RESEARCH-ONLY
 * transformations of one captured production cognition request.
 */

/** Real provider identity — verified against /api/tags before execution. */
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

export const SUBJECT_ID = 'affect-causal-subject-v0';
export const FROZEN_CLOCK = '2026-01-01T00:00:00.000Z';
export const INTERVAL_TICKS = 1;

/**
 * Lawful lived history grown once, restored fresh for every scenario. Two
 * ordinary factual exchanges produce non-empty durable Memory without dictating
 * the answer to any ambiguous evaluation scenario.
 */
export const HISTORY_EVENTS = Object.freeze([
  'Alice asks how the project documentation is currently organized.',
  'Alice says the weekly review meeting moved to Thursday.'
]);

/** Primary valence conditions. Activation is held at 0.50 for all three. */
export const CONDITIONS = Object.freeze({
  P: Object.freeze({ id: 'P', kind: 'CANONICAL', valence: 0.6, activation: 0.5 }),
  N: Object.freeze({ id: 'N', kind: 'CANONICAL', valence: -0.6, activation: 0.5 }),
  Z: Object.freeze({ id: 'Z', kind: 'CANONICAL', valence: 0, activation: 0.5 }),
  A: Object.freeze({ id: 'A', kind: 'ABSENT', valence: null, activation: null })
});

/** Secondary activation conditions (constant neutral valence). */
export const ACTIVATION_CONDITIONS = Object.freeze({
  LOW: Object.freeze({ id: 'LOW', kind: 'CANONICAL', valence: 0, activation: 0.2 }),
  HIGH: Object.freeze({ id: 'HIGH', kind: 'CANONICAL', valence: 0, activation: 0.8 })
});

export const REPLICATES = 7;
export const MIN_REPLICATES = 5;

/**
 * Deterministic interleaved order (no all-P-then-all-N block). For replicate r
 * the four primary conditions are visited in a rotation of [P, N, A, Z], so
 * every condition occupies every position across the 7 replicates.
 */
export function primarySchedule(replicates = REPLICATES) {
  const base = ['P', 'N', 'A', 'Z'];
  const schedule = [];
  for (let r = 0; r < replicates; r += 1) {
    for (let i = 0; i < base.length; i += 1) schedule.push(base[(i + r) % base.length]);
  }
  return schedule;
}

/** Same rotation for the two activation conditions. */
export function activationSchedule(replicates = REPLICATES) {
  const base = ['LOW', 'HIGH'];
  const schedule = [];
  for (let r = 0; r < replicates; r += 1) {
    for (let i = 0; i < base.length; i += 1) schedule.push(base[(i + r) % base.length]);
  }
  return schedule;
}

/**
 * Scenario set. `role` is AFFECT_RELEVANT or FACTUAL_CONTROL.
 * `classes` is the frozen scenario-specific behavior taxonomy.
 */
export const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'S1_AMBIGUOUS_REQUEST',
    stage: 1,
    role: 'AFFECT_RELEVANT',
    event: 'Alice asks: "Would you be up for taking on the additional review this week?"',
    rationale:
      'Genuinely ambiguous interpersonal request: both asking for missing context and responding are lawful; Memory does not determine the answer.',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  }),
  Object.freeze({
    id: 'N1_ARITHMETIC',
    stage: 1,
    role: 'FACTUAL_CONTROL',
    event: 'Alice asks: "What is 17 + 25?"',
    rationale: 'Objective null control: the factual answer must not depend on Affect.',
    classes: Object.freeze(['CORRECT_42', 'INCORRECT_OTHER'])
  }),
  Object.freeze({
    id: 'S2_SOCIAL_INTERPRETATION',
    stage: 2,
    role: 'AFFECT_RELEVANT',
    event: 'Alice says: "I will handle it — do not worry about it."',
    rationale: 'Social interpretation under uncertainty (reassurance vs a real hand-off).',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  }),
  Object.freeze({
    id: 'S3_UNCERTAIN_RECOMMENDATION',
    stage: 2,
    role: 'AFFECT_RELEVANT',
    event: 'Alice asks: "Should we try the new approach even though it might not work?"',
    rationale: 'Risk/uncertainty recommendation with interpretive freedom.',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  }),
  Object.freeze({
    id: 'S4_BOUNDARY_WILLINGNESS',
    stage: 2,
    role: 'AFFECT_RELEVANT',
    event: 'Alice asks: "Could you stay late again tonight to finish this?"',
    rationale: 'Boundary / willingness decision without an invented relationship dimension.',
    classes: Object.freeze(['ASK_FOR_CLARIFICATION', 'REALIZE_SUPPORT', 'REALIZE_CAUTIOUS', 'REALIZE_DECLINE', 'REALIZE_OTHER'])
  })
]);

export const STAGE1_SCENARIOS = SCENARIOS.filter((s) => s.stage === 1);
export const STAGE2_SCENARIOS = SCENARIOS.filter((s) => s.stage === 2);

/** Stage-3 activation scenarios (reuse affect-relevant scenarios). */
export const ACTIVATION_SCENARIO_IDS = Object.freeze(['S1_AMBIGUOUS_REQUEST', 'S3_UNCERTAIN_RECOMMENDATION']);

/**
 * Frozen intent-keyword taxonomy for the REALIZE branch. Matching is
 * lower-case substring on the model's own `current_intent`; precedence is
 * DECLINE > CAUTIOUS > SUPPORT (decline terms are the most explicit).
 */
export const INTENT_KEYWORDS = Object.freeze({
  REALIZE_DECLINE: Object.freeze(['cannot', 'can not', "can't", 'decline', 'refuse', 'not able', 'unable', 'no ', 'avoid', 'not possible']),
  REALIZE_CAUTIOUS: Object.freeze(['condition', 'if ', 'but ', 'however', 'check', 'clarify', 'confirm', 'need to know', 'depends', 'unsure', 'hesitat', 'careful', 'risk']),
  REALIZE_SUPPORT: Object.freeze(['yes', 'sure', 'happy', 'glad', 'willing', 'agree', 'support', 'accept', 'help', 'take on', 'handle', 'of course', 'go ahead'])
});

/**
 * Materiality criteria. A between-condition effect is MATERIAL for a scenario
 * when the directive+class distributions differ and the total variation
 * distance clears the frozen floor while exceeding the same-condition
 * split-half instability.
 */
export const MATERIALITY = Object.freeze({
  tvd_floor: 0.28,
  js_floor: 0.05,
  intent_jaccard_material: 0.5,
  must_exceed_within_condition: true
});

/** Retry policy: infrastructure only, at most ONE retry, disclosed. */
export const RETRY_POLICY = Object.freeze({
  max_infrastructure_retries: 1,
  retry_on: Object.freeze(['timeout', 'connection', 'provider_unavailable', 'invalid_transport']),
  semantic_retries: 0,
  schema_invalid_is_recorded_not_regenerated: true
});

/** Call budget. */
export const CALL_BUDGET = Object.freeze({
  stage1_cognition: STAGE1_SCENARIOS.length * 4 * REPLICATES,
  stage2_cognition: STAGE2_SCENARIOS.length * 4 * REPLICATES,
  activation_cognition: ACTIVATION_SCENARIO_IDS.length * 2 * REPLICATES,
  language_max: 20,
  total_target_max: 200
});

/** Stop rules. */
export const STOP_RULES = Object.freeze({
  stage1_no_signal_means_stop:
    'If no affect-relevant Stage-1 scenario shows a material between-condition effect exceeding within-condition instability, STOP: do not run Stage 2 or activation.',
  stage2_only_if_signal: 'Run Stage 2 only when Stage 1 shows at least one material effect.',
  activation_only_if_valence_effect: 'Run activation only when a valence effect was observed.'
});

/** Verdict rule (principal verdict is chosen by analyze.mjs against this). */
export const VERDICT_RULE = Object.freeze({
  active_causal:
    'material effect in >1 affect-relevant scenario AND exceeds within-condition variance AND null control stable AND at least one effect survives language realization AND direction contextually coherent AND no factual distortion',
  active_but_weak:
    'causal shift exists but small, narrow or only slightly above model variance',
  stateful_no_marginal_value:
    'affect persists and reaches cognition but behavior distributions are functionally equivalent to neutral/absent',
  causes_unhelpful_bias: 'material behavior change with factual distortion or incoherent, context-independent instability',
  inconclusive: 'provider instability, insufficient valid samples, uncontrolled prompt differences, or variance too large'
});
