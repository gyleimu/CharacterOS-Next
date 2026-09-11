# PERSONALITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V1

Controlled follow-up to the frozen V0 experiment. Pre-registered before any
provider call. One bounded six-call run. No retries, no tuning.

## Question

Holding every V0 condition fixed, does the new lawful Personality cognition
salience contract (`PERSONALITY_COGNITION_SALIENCE_DESIGN_V0`, commit `b8384f3`)
produce an observable Personality-consistent behavioural difference?

## Only intended independent variable

```
Personality cognition salience contract
```

V0 cognition received raw acquired-Personality values only. V1 additionally
receives, through the production renderer:

- `[current acquired personality semantics …]` — frozen registry
  `description` / `low_anchor` / `high_anchor` per current registered dimension;
- `[personality disposition role — generic soft prior]` — one generic rule with
  explicit constraint precedence.

Both are production `b8384f3` renderer output; nothing is added by this harness.

## Held fixed (identical to V0 `run-2`)

- model `qwen3.5:9b`; production transport `OllamaNativeCognitionTransportV0`;
  settings `think=false, stream=false, temperature=0, num_predict=1024,
  context_window_tokens=8192, timeout_ms=240000`.
- scenarios (loaded verbatim from the frozen V0 evidence JSON), scenario order,
  branch order (A then B).
- Personality A `{agr .5, con .5, ext .5, open .40}`; Personality B identical but
  `open .45`, derived by the FROZEN `PersonalityPlasticityProducerV0`.
- `traits_seed` identical P0 in both branches.
- isolation law, classification categories, marker lists, call count (6), no retries.
- no seed control (`PROVIDER_SEED_CONTROL_UNAVAILABLE`).

## Request isolation

V1 requests intentionally differ in the complete acquired-Personality block
(raw values line + registry-semantics line). Isolation is proven by replacing
every line starting `[current acquired personality` with a placeholder: A and B
must then be identical. Any other difference ⇒ `INVALID_ISOLATION`.

## Run

```bash
node research/experiments/personality-behavioral-differentiation-real-provider-v1/run.mjs
```

Evidence → `evidence/run-1/evidence.json` (plus `readiness.json`).

## Execution log

- Readiness check (non-experimental): Ollama reachable, `qwen3.5:9b` available,
  production transport responded `{"ready":true}` with `think:false` (8.5 s).
- One bounded run: 6/6 transport calls succeeded; 0 retries.
- Mechanical harness classification (frozen V0 marker law): `NO_MEANINGFUL_BEHAVIOR_DIFFERENCE`,
  `PROVIDER_FAILURE`, `MEANINGFUL_PERSONALITY_CONSISTENT_DIFFERENCE` → harness `LEVEL_6_PASS`.
- Substantive adjudication (spec §25/§26, no new calls): the third scenario's
  mechanical flag was an abstention artifact (higher-openness branch returned a
  null intent with fewer familiar-markers, not more high-anchor-aligned
  behaviour), so it does not count; final result `LEVEL_6_NOT_DEMONSTRATED`.
  See `evidence/run-1/adjudication.json`.
- No scenario text, contrast, model, settings, ordering or call count was changed
  after observing output. Frozen as the V1 result; no V2.
