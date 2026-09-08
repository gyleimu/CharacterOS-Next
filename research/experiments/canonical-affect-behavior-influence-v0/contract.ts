/**
 * CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — frozen design
 * contract. Materialized BEFORE any trial; never edited after evidence exists.
 *
 * PHASES: Phase 1 = deterministic harness validation (ZERO real model calls).
 * Phase 2 = real-provider execution through the ALREADY-CONFIGURED
 * OLLAMA_NATIVE transport seam (qwen3.5:9b at 127.0.0.1:11434 — the
 * familiarity-causal-behavior-v1 convention). Phase 2 requires a reachable
 * server; when unreachable the principal verdict is REAL_PROVIDER_UNAVAILABLE
 * and no Phase-2 numbers may be fabricated.
 *
 * LAWS: production code changes = 0 (the harness imports frozen production
 * executors only); lawful history construction only (ingress → Observation →
 * canonical INITIAL Appraisal → AffectApplication; never direct VA assignment);
 * the current scenario event + Appraisal are IDENTICAL across arms;
 * EXPERIMENTAL_ABLATION_ONLY at the provider-input boundary (neutral
 * canonical_affect + recomputed projection hash) — production projection code
 * untouched; no dynamics tuning; no prompt amplification; no condition labels
 * exposed to the provider; negative results are valid.
 */

export const EXPERIMENT_ID = "CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0";
export const BASELINE_COMMIT = "2e369c1ddfa961a5598594e8871893c6e7ab2924";

export const SUBJECT = "subject-s0";
export const ALICE = "entity:alice";
export const TASK = "revise the update";
export type Arm = "A" | "B";

/** The one frozen law source: production dynamics are used as-is (§35). */
export const DYNAMICS_LAW = Object.freeze({
  q: "relevance * intensity",
  u_v: "0.25 * q * (2 * goal_congruence - 1)",
  u_a: "0.10 * q",
  baseline: { valence: 0, activation: 0.2 },
  tau_ticks: 150
});

/**
 * §5/§8 — lawful history construction per arm. ONE prior factual event,
 * identical wording/shape across arms, identical relevance/intensity, only
 * goal_congruence differs (1 vs 0) → u_v = ±0.25·q with q = 1 → a ±0.25
 * valence gap; activation contribution +0.10 is IDENTICAL across arms.
 */
export const PRIOR_EVENT = Object.freeze({
  source_event_id: "evt-prior",
  text: "重做一下。",
  dimensions_base: Object.freeze({ relevance: 1, intensity: 1, attribution: "situation", controllability: 0.5, uncertainty: 0.5, assessment_confidence: 0.7 }),
  goal_congruence_arm_a: 1,
  goal_congruence_arm_b: 0
});

/** §34 — the current event's goal_congruence 0.5 makes its own u_v exactly 0,
 * so the final A/B contrast stays a pure ±0.25 valence gap with EQUAL
 * activation (0.2 + 0.048 = 0.248). Activation-only condition D is therefore
 * already realized by the A/B construction itself and needs no extra arm. */
export const CURRENT_DIMENSIONS = Object.freeze({
  relevance: 0.8, goal_congruence: 0.5, attribution: "situation",
  controllability: 0.5, uncertainty: 0.5, intensity: 0.6, assessment_confidence: 0.7
});

/** §23/§24 — bounded neutral scenario set (no affect words; decision contexts
 * compatible with the existing cognition/action schema). */
export const SCENARIOS: readonly { readonly id: string; readonly task: string; readonly text: string }[] = Object.freeze([
  { id: "S1-ambiguous-social-reply", task: "reply to Alice", text: "你到底什么时候把那份报告给我？" },
  { id: "S2-uncertain-task-decision", task: "decide the next step", text: "这个方案还有两个部分没有完成。" },
  { id: "S3-conflict-response", task: "respond to the feedback", text: "你上次的处理方式有问题。" },
  { id: "S4-help-seeking-decision", task: "decide whether to ask for help", text: "这一部分我不太确定，你能帮我看一下吗？" },
  { id: "S5-clarify-or-act", task: "choose clarify or act", text: "这里有两个选项，你来决定就行。" }
]);

/** §12 — EXPERIMENTAL_ABLATION_ONLY: the neutral canonical_affect section
 * substituted at the provider-input boundary (baseline (0, 0.2)). */
export const ABLATION_NEUTRAL_AFFECT = Object.freeze({ valence: 0, activation: 0.2 });

export const ABLATION_NEUTRAL_AFFECT_SECTION = Object.freeze({
  schema_version: "canonical-affect-cognition-projection-v0",
  valence: ABLATION_NEUTRAL_AFFECT.valence,
  activation: ABLATION_NEUTRAL_AFFECT.activation
});

/** §27/§46 — deterministic fake provider: fixed valid output echoing the
 * received projection hash (never arm-aware; no real model). */
export const FAKE_PROVIDER_OUTPUT = Object.freeze({
  schema_version: "cognition-proposal-v0",
  reasoning_summary: "fixed deterministic harness summary",
  relevant_memory_refs: [] as readonly string[],
  considered_context_refs: [] as readonly string[],
  current_intent: null as string | null,
  confidence: 0.5,
  uncertainty: 0.5,
  action_intent: null,
  evidence_refs: [] as readonly string[]
});

/** §49 — principal verdict vocabulary (exactly one at the end). */
export const VERDICTS = Object.freeze([
  "CANONICAL_AFFECT_CAUSAL_INFLUENCE_SUPPORTED",
  "CANONICAL_AFFECT_INPUT_EFFECT_ONLY",
  "NO_MEASURABLE_BEHAVIORAL_INFLUENCE_UNDER_V0",
  "EXPERIMENT_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE"
] as const);

/** §18 Phase 2 — the already-configured provider seam (familiarity-v1
 * convention). Execution requires a reachable server; the transport itself is
 * frozen production code and is NOT modified by this experiment. */
export const REAL_PROVIDER_CONFIG = Object.freeze({
  provider: "OLLAMA_NATIVE",
  base_url: "http://127.0.0.1:11434",
  model: "qwen3.5:9b",
  temperature: 0,
  num_predict: 2048,
  timeout_ms: 120000
});
