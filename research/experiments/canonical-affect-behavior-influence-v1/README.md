# Canonical Affect Behavior Influence Replication V1

Independent bounded replication of the frozen V0 canonical-valence causal
experiment. Production behavior-changing diff is zero: this harness imports
the built production authorities, history writers, AffectApplication,
cognition projection, prompt, validator, and Ollama transport unchanged.

The preregistered primary design is 8 new scenarios × 2 lawful symmetric
valence magnitudes × 4 matched arms × 5 trials = 320 qwen3.5:9b calls. LOW is
constructed with one prior Appraisal at relevance 1/intensity 0.5, yielding
final ±0.125 valence and matched activation 0.298. REFERENCE uses intensity 1,
yielding final ±0.25 valence and matched activation 0.348. The current event is
identical and contributes zero valence in every pair.

Run the zero-call gate first, then collection:

```text
node research/experiments/canonical-affect-behavior-influence-v1/cli.ts phase-a research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider
node research/experiments/canonical-affect-behavior-influence-v1/cli.ts collect research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider
```

Collection is prefix-resumable without repeating recorded calls. It never
changes the preregistered N, arm order, scenarios, magnitudes, prompt, or model
settings.
