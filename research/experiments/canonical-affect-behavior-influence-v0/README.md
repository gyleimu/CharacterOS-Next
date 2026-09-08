# Canonical Affect Cognition Behavior Influence Experiment V0 (`CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0`)

Bounded causal experiment over the FROZEN production pipeline. **Production
code changes: 0** — the harness imports the committed production build
(explicit-v4 genesis, factual-event authority, canonical Appraisal,
AffectApplication, RAW_CANONICAL_VA V2 cognition projection, zero-delta
CognitionAction NO_OP) exactly as shipped.

## Primary question

> Holding the model/provider, current event, current Appraisal, personality,
> beliefs, relationships, memory, pipeline, prompt structure and all other
> current-state inputs constant, does a different durable canonical Affect
> state causally change cognition and/or behavior output?

## Conditions

- **A** — one prior factual event appraised with `goal_congruence = 1` →
  durable valence **+0.25** (activation 0.348 after the current event).
- **B** — identical prior event with `goal_congruence = 0` → durable valence
  **−0.25** (activation 0.348, equal to A).
- **ABLATED_A / ABLATED_B** — EXPERIMENTAL_ABLATION_ONLY: the same captured
  provider inputs with `canonical_affect` replaced by the neutral baseline
  (0, 0.2) and the projection hash recomputed over the ablated body, making
  the ablated arm inputs byte-identical. Production projection code, state
  and AffectApplication are untouched.

The current event's `goal_congruence = 0.5` gives it exactly zero valence
impulse, so the final A/B contrast is a pure ±0.25 valence gap with equal
activation (a built-in §34 valence/activation decomposition).

## Phases

- **Phase 1 (this evidence)** — deterministic harness validation, real model
  calls **0**. Fixed fake provider (a pure function of its input); all
  §42 matrix gates asserted.
- **Phase 2** — real provider through the already-configured OLLAMA_NATIVE
  seam (`qwen3.5:9b` at `127.0.0.1:11434`, temperature 0) — the
  familiarity-causal-behavior-v1 convention. **Not executed**: the server was
  unreachable (connection refused) at experiment time. Principal verdict:
  `REAL_PROVIDER_UNAVAILABLE`. No Phase-2 numbers were fabricated.

## Result (evidence/run-1)

- 5 scenarios × 4 condition-arms = **20 trials, 20 valid, 0 failed**.
- Paired input audit: `non_affect_provider_input_equal_all = true` — the ONLY
  differing top-level fields across arms are `canonical_affect` and its
  `projection_hash` binding.
- Ablation: `ablated_inputs_identical = true`.
- Restore control (S1, arm A): cognition input identical after authoritative
  v4 restore.
- Paired A/B output distance (deterministic fake): 0 — **expected**: a fake
  provider that is a pure function of its input cannot show downstream
  differences; the causal answer belongs to Phase 2.

## Reproduce

```
node research/experiments/canonical-affect-behavior-influence-v0/cli.ts run research/experiments/canonical-affect-behavior-influence-v0/evidence/run-1
```

CI gate: `evals/conformance/canonical-affect-behavior-influence-v0.test.ts`
(runs the deterministic phase and asserts the §42 matrix).
