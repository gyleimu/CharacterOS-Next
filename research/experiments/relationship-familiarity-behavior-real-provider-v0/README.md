# RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0

Preregistered, single-run behavioral experiment. Research-only: **no production
change** to Relationship semantics, familiarity thresholds, cognition
projection, provider prompt, writer authority or session wiring.

## Estimand

```text
canonical relationship_core_interaction_familiarity_v0 state
→ observable behavior through the production cognition + language pipeline
```

NOT `different lived histories → behavior`, and NOT `lived experience →
familiarity → behavior` (that upstream path is already proven at the cognition
projection level only).

## Strict causal isolation

Both arms are canonical `subject-state-v3` states built from the SAME base, the
SAME shared Memory repository revision and the SAME canonical convention episode
(`episode:alice-08`), which is present in BOTH arms via
`memory_state.working_refs`. The ONLY difference is the canonical familiarity
value:

```text
LOW  = 1/32  → BASIC_CONTEXT_FIRST                (frozen influence threshold is k >= 2)
HIGH = 2/32  → COUNTERPART_CONTEXT_SEARCH_FIRST
```

1/32 vs 2/32 is the MINIMAL lawful crossing of the ONLY influence boundary; any
higher HIGH would not change the influence surface (no extra semantic distance).

Arm state is a `CANONICAL_RESEARCH_INTERVENTION_STATE`: valid SubjectState,
registered relationship feature, lawful k/32 value, accepted normally by the
production cognition projection. No renderer patching, no prompt-only
familiarity text, no natural-history contrast (the V1 confound).

HIGH's one familiarity-priority retrieval attempt is rehearsed EMPTY
(`ATTEMPTED_EMPTY`) so it adds no evidence ref LOW lacks. Deterministic
preflight proves the rendered production cognition input differs ONLY on the
derived context-resolution influence line and the derived projection-hash line;
Memory/evidence/context/identity lines are byte-identical.

## Behavioral endpoint

`ConversationTextResponseExecutorV0` → production cognition
(`LlmCognitionProviderV0`) → production language realization → validated
`CharacterLanguageBehaviorV0` → `behavior.text`. No experiment-only
`{cognition, reply}` envelope.

## Design (frozen before any real call)

- 4 scenarios × 2 counterbalanced repetitions = 8 paired trials = 16 arm
  executions (`AB`/`BA` frozen in `contract.ts`).
- Each arm: exactly ONE cognition + ONE language call if cognition succeeds; no
  retries, no seed search, no fallback, no timeout retry.
- One blinded evaluator call per pair only when BOTH arms produced valid
  behavior; evaluator sees `Response X`/`Response Y` with no LOW/HIGH labels.
- Rubric classes derived only from the frozen influence contract.
- Threshold: complete run AND ≥ 6/8 familiarity-consistent pairs AND 0 reverse.
- Model: Ollama native `qwen3.5:9b`, digest
  `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`,
  temperature 0, think/stream false, num_predict 2048, timeout 120000 ms,
  `seed = unavailable` (transport exposes none), no retries.

## Commands

```text
node research/experiments/relationship-familiarity-behavior-real-provider-v0/cli.ts preflight <outDir>
node research/experiments/relationship-familiarity-behavior-real-provider-v0/cli.ts run <outDir>
```

`preflight` makes 0 real calls and must return
`STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_PASS` before the formal run.

## Files

- `contract.ts` — frozen scenarios, arm values, pair plan, rubric, model config, threshold.
- `fixtures.ts` — strict-isolation canonical arm construction.
- `observe.ts` — exact production behavioral endpoint + observations.
- `preflight.ts` — deterministic isolation proof (0 real calls).
- `runner.ts` — bounded no-retry formal run + adjudication.
- `cli.ts` — entrypoints.
- `evals/conformance/relationship-familiarity-behavior-real-provider-v0.test.ts` — offline conformance.

## Results

See `evidence/formal-run/` after the formal run. One experiment; then STOP. No
V0.1/V1, no prompt/scenario/threshold tuning.
