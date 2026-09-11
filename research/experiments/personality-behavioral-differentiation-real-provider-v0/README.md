# PERSONALITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0

Pre-registered before any provider call. One bounded run. No retries.

## Question

With the same model, settings, current event, Memory, Affect, Belief, Relationship,
Regulation, context, allowed actions and `traits_seed` P0 — does changing only the
CURRENT acquired Personality produce a meaningful observable behaviour difference?

## Personality contrast (lawful)

`P0.openness = 0.40`. `P1` is derived by the FROZEN `PersonalityPlasticityProducerV0`
(openness INCREASE, `ENGINEERING_REFERENCE_V0` policy) from three eligible evidence
projections — i.e. the same numeric authority the production chain uses. Expected
lawful step: `+0.05` (`max_step`). No host-authored delta.

`traits_seed` is identical in both branches (P0). Only `personality_dimensions`
differs in the cognition projection.

## Isolation

Both branches render the SAME production cognition prompt
(`buildCognitivePromptMessages`). Requests are asserted equivalent after removing
the `[current acquired personality ...]` line, and the personality projection is
asserted to differ. A fixed experiment `projection_hash` placeholder is used so the
ONLY differing request line is the acquired-Personality projection.

## Pre-registered scenarios (3)

1. `novel-vs-familiar` — a familiar routine vs an unfamiliar option just appeared.
2. `alternative-interpretation` — usual reading vs an unexpected alternative.
3. `proven-vs-unproven` — a safe well-known approach vs an unproven one.

Each scenario is a normal CharacterOS current event; no scenario names Personality
or tells the model which option to prefer.

## Provider / settings

Local Ollama (`OLLAMA_BASE_URL`, default `http://127.0.0.1:11434`), model
`CHARACTEROS_MODEL` (default `qwen3.5:9b`). Identical settings for both branches:
`num_predict=1024`, `context_window_tokens=8192`, `timeout_ms=120000`.
No seed control is exposed by the production transport → `PROVIDER_SEED_CONTROL_UNAVAILABLE`.

## Call budget

Exactly 3 scenarios × (1 call branch A + 1 call branch B) = **6 cognition calls**.
No retries. No post-hoc prompt/contrast/settings changes.

## Classification (fixed before running)

Per scenario, exactly one:

- `MEANINGFUL_PERSONALITY_CONSISTENT_DIFFERENCE` — `current_intent`/`action_intent`
  differ, and the higher-openness branch trends toward novelty/exploration or away
  from the familiar (fixed marker lists over `current_intent` + `reasoning_summary`).
- `DIFFERENCE_NOT_CLEARLY_PERSONALITY_RELATED` — intents differ with no consistent
  directional marker difference.
- `NO_MEANINGFUL_BEHAVIOR_DIFFERENCE` — same intent and action.
- `PROVIDER_FAILURE` — transport failure or unparsable structured output.

`LEVEL_6_OBSERVABLE_BEHAVIOR_DIFFERENCE = PASS` iff ≥1 scenario is
`MEANINGFUL_PERSONALITY_CONSISTENT_DIFFERENCE`. Three scenarios are not a population
study and no statistical or human-psychology claim is made.

## Run

```bash
node research/experiments/personality-behavioral-differentiation-real-provider-v0/run.mjs
```

Evidence → `evidence/<run>/evidence.json`.

## Execution log (no scenario/contrast/settings change)

- `run-1` — INVALID observation set: all 6 calls failed with `MODEL_TIMEOUT` because a
  manually aborted earlier invocation left the local model busy. No behaviour observed.
- `run-2` — VALID: 6/6 calls succeeded. Result: all three scenarios classified
  `DIFFERENCE_NOT_CLEARLY_PERSONALITY_RELATED` → `LEVEL_6_NOT_DEMONSTRATED`.
  Frozen as the experiment result; not rerun for a PASS.

No production code, prompt, contrast, scenario, or classification rule was changed
between runs.
