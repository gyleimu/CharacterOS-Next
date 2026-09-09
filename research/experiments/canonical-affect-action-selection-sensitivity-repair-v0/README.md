# Canonical Affect Action Selection Sensitivity Repair V0

Final, bounded identifiability repair for the frozen action-selection
sensitivity experiment. Phase R0 deterministically localizes the five prior
treatment disagreements before the design is frozen. The selected repair uses
neutral machine labels, equal null targets, symmetric scenario tradeoffs, two
reversed action orders, and Latin-style cross-scenario presentation balance.

The frozen design is four scenarios × two action orders × four matched arms ×
five trials = 160 `qwen3.5:9b` cognition calls. It performs no language calls,
no evaluator calls, no action execution, and no production code change.

Prepare one new evidence directory with zero generation calls:

```text
node research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/cli.ts phase-a research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/evidence/run-1-real-provider
```

Then run collection manually while the frozen Ollama provider remains online:

```text
node research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/cli.ts collect research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/evidence/run-1-real-provider
```

Collection is strict-prefix resumable: rerun the same `collect` command after
an interruption. Never run two collectors concurrently. A completed
collection refuses further generation.

After `COLLECTION_COMPLETE`, run quality gates and finalization through the
experiment closeout workflow. Finalization performs zero provider calls. The
loop-breaker forbids another experiment repair iteration after this result.
