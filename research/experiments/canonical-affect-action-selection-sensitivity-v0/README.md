# Canonical Affect Action Selection Sensitivity Experiment V0

Bounded action-selection experiment over the unchanged production cognition
pipeline. It tests whether the replicated canonical valence contrast changes
the exact validated `action_intent` tuple when both host-supplied actions are
defensible and their list order is counterbalanced.

The frozen design is four scenarios × two action orders × four matched arms ×
five trials = 160 `qwen3.5:9b` cognition calls. It performs no language calls,
no evaluator calls, no action execution, and no production behavior change.

Run Phase A before collection, using one new evidence directory per explicitly
preregistered execution:

```text
node research/experiments/canonical-affect-action-selection-sensitivity-v0/cli.ts phase-a research/experiments/canonical-affect-action-selection-sensitivity-v0/evidence/run-1-real-provider
node research/experiments/canonical-affect-action-selection-sensitivity-v0/cli.ts collect research/experiments/canonical-affect-action-selection-sensitivity-v0/evidence/run-1-real-provider
```

Collection is strict-prefix resumable. A completed collection refuses all
additional generation.

## Evidence runs

- `run-1-real-provider` is preserved as transport-invalid evidence: 160
  attempted records, 0 valid responses, 2 timeouts, and 158 connection
  failures after the local Ollama service stopped. It is excluded from the
  scientific result and was never edited or retried in place.
- `run-2-real-provider` is the conclusion-bearing transport-recovery run: all
  160 preregistered calls are valid with no failures.
