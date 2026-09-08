# Phase 2 run-2 — pre-analysis void attempt

This execution attempt is preserved for auditability but excluded from every
causal metric and from the principal verdict.

- attempted real-provider calls: 200
- valid calls: 90
- failed calls: 110
- transport failures: 0
- structural failure: 100/100 ablation calls ended `STALE` with
  `MODEL_PROJECTION_MISMATCH`
- independent observed failure: 10/10 S1 arm-B calls ended
  `VALIDATION_REJECTED` with `MODEL_ACTION_NOT_ALLOWED`

Root cause: the experiment-only `ablateProviderInput()` called the asynchronous
production `cognitiveProjectionHash()` without `await`. The ablated provider
input therefore carried a Promise instead of a hash string; JSON evidence
serialized the expected value as `{}`, and prompt rendering exposed
`[object Promise]`. This violated the intended ablation projection binding
before endpoint analysis.

The raw 200-call JSONL and traces are intentionally retained. No response was
used to tune treatment, scenarios, model settings, sample size, or endpoint
scoring. The minimum experiment-local hash-await repair was made, Phase 1 was
revalidated, and the corrected predeclared execution is `../run-3-real-provider/`.
