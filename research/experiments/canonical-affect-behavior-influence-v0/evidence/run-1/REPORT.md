# CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — evidence (research/experiments/canonical-affect-behavior-influence-v0/evidence/run-1)

- baseline commit: 2e369c1ddfa961a5598594e8871893c6e7ab2924
- phase: DETERMINISTIC_HARNESS_VALIDATION
- real model calls: 0
- real provider: OLLAMA_NATIVE qwen3.5:9b — reachable: false (OLLAMA_NATIVE server at 127.0.0.1:11434 unreachable (connection refused) at experiment time; Phase 2 not executed and no Phase-2 numbers fabricated.)
- scenarios: 5; conditions: 4 (A, B, ABLATED_A, ABLATED_B); trials: 20 (valid 20, failed 0)
- input audit: non_affect_provider_input_equal_all = true
- ablation: ablated_inputs_identical = true
- paired A/B output distance (deterministic fake): 0
- paired ablated output distance: 0
- restore control identical: true

## Deterministic-phase reading

The deterministic fake provider is a pure function of its input, so equal
outputs across arms are the EXPECTED harness-validation result, not a
causal answer. The causal question (does the model's output differ) is
deferred to the real-provider phase; with the OLLAMA_NATIVE server
unreachable the principal verdict is REAL_PROVIDER_UNAVAILABLE and no
Phase-2 numbers were fabricated.

## Principal verdict: REAL_PROVIDER_UNAVAILABLE