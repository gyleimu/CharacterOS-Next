# Canonical Affect Downstream Language Behavior Causal Experiment V0

Bounded four-arm real-provider experiment over the frozen Option C path:

```text
lawful history → Canonical Affect → cognition/current_intent → language realization → CharacterLanguageBehaviorV0
```

Commands from the repository root:

```text
node research/experiments/canonical-affect-downstream-language-behavior-causal-v0/cli.ts phase-a research/experiments/canonical-affect-downstream-language-behavior-causal-v0/evidence/run-1-real-provider
node research/experiments/canonical-affect-downstream-language-behavior-causal-v0/cli.ts collect research/experiments/canonical-affect-downstream-language-behavior-causal-v0/evidence/run-1-real-provider
node research/experiments/canonical-affect-downstream-language-behavior-causal-v0/cli.ts gates research/experiments/canonical-affect-downstream-language-behavior-causal-v0/evidence/run-1-real-provider
node research/experiments/canonical-affect-downstream-language-behavior-causal-v0/cli.ts finalize research/experiments/canonical-affect-downstream-language-behavior-causal-v0/evidence/run-1-real-provider
```

`collect` is strict-prefix resumable. It checkpoints every completed cognition
attempt before any required language call, so resuming does not duplicate that
cognition identity. A complete collection refuses further generation.

This experiment does not execute actions, deliver externally, run behavior
feedback, use an LLM judge, or alter production semantics.
