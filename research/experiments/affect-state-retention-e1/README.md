# Affect state retention experiment E1 (`STATE_RETENTION_AND_RECOVERY_E1`)

Deterministic Emotion Dynamics research experiment. **Production is frozen** at
`d96803997803ab94caeb3e841dd39d926ad6473b`: this experiment does not modify any
production Affect semantics (SubjectState schema, FAST_EMA, Mood, Observation
Affect path, canonical Appraisal, Affect event authority, ownership, transition
enums, restore authority, Memory, Relationship, Belief, Personality) and adds
no `AffectApplication`, no canonical Affect writer, and no valence/activation
production migration.

## Primary question

> When a new Appraisal arrives, should Affect retain the still-unrecovered
> previous state and accumulate from it (B3), or should the new event
> overwrite/reset the state (B3-reset)?

Primary causal comparison: **B3 vs B3_RESET** — identical state representation,
impulse mapping, baseline, recovery equation, bounds, timing and parameters;
they differ ONLY in whether event application preserves the current pre-event
Affect state. The structural law is verified per run (§38): B1 == B3_RESET
byte-equal, identical event records/impulses, common baseline start, B0
constant; anything else differing accidentally invalidates the experiment.

## Frozen protocol (never amended after results)

Everything is frozen in `contract.ts` + `manifest.ts` and hashed into
`manifest.json` before any trajectory exists:

- State: `AffectStateE1 { valence ∈ [-1,1], activation ∈ [0,1] }` — experimental
  only, never a production schema.
- Baseline `b = (0, 0.2)` (engineering test baseline, not a human-neutral
  claim); recovery `tau = 150` ticks (engineering parameter only).
- Impulse mapping (frozen, never tuned): `q = relevance*intensity`,
  `signed_goal = 2*goal_congruence − 1`, `u_v = 0.25*q*signed_goal`,
  `u_a = 0.20*q`.
- Recovery: `x(t+dt) = b + (x(t) − b) * exp(−dt/tau)` per axis; deterministic,
  finite, monotonic, no wall clock, no randomness.
- Bounds: deterministic clamp to `[-1,1] × [0,1]`; every saturation recorded.
- Event order law: advance by recovery → capture pre-event state → apply
  impulse → clamp → capture post-event state → record trace.
- Zero-impulse application law (§27/G4): an appraisal with `q = 0` produces
  exactly zero impulse and triggers NO event application in any mechanism —
  recorded, state-neutral. Only events WITH an impulse trigger the
  retain-vs-reset application; this is the protocol's own stated expectation
  for S6 and is frozen before the evidence run.
- Mechanisms: B0 (constant baseline), B1 (direct-mapping control,
  `clamp(b+u)`; timing semantics documented in the contract; never used to
  infer retention), B2 (frozen production FAST_EMA_V0 in its NATIVE
  representation — contextual only, no cross-representation numeric
  inference), B3_RESET (`clamp(b+u)`, primary control), B3 (`clamp(x_before+u)`,
  candidate).
- Sequences: S1 single impulse; S2 weak same-direction event + matched control;
  S3 repeated small events + matched control; S4 alternating events; S5 history
  divergence (byte-identical final event); S6 zero relevance vs S1 control;
  S7 sustained maximum input (t=0..199) + 1200 recovery ticks. Sensitivity:
  half/double impulse on unsaturated S2/S3/S5 (never used for tuning).
- Partition law: 1-tick / 10-tick / direct closed-form advance must agree
  within `1e-12`; sampling is read-only and never advances time.
- Settling tolerance `1e-3` (frozen before results); saturation epsilon
  `1e-12`; recovery horizon 1200 ticks after the last event.
- Application identity (experiment-local exactly-once): `event_id` +
  `payload_hash`; same id + same payload → REPLAY (no second impulse); same id
  + changed payload → CONFLICT; different ids → distinct events. The
  production Affect event authority is NOT reused and NOT modified.
- Restore branch: S5 serialized at t=30 (anchored state + registry), restored
  into a fresh instance, continued with identical future inputs, no
  recomputation of historical events; must match the uninterrupted run within
  `1e-12`.

## Decision gates and verdict

G1 boundedness, G2 recovery (monotone + `d0*exp(−8)` at last_event+1200),
G3 time consistency, G4 zero relevance, G5 state retention, G6 repeated
accumulation, G7 history divergence, G8 saturation recovery, G9 replay —
evaluated mechanically by `runner.ts`. Verdict classes: 
`SUPPORTED_FOR_NEXT_STAGE` / `MECHANISM_NOT_SUPPORTED` / 
`INVALID_EXPERIMENT` / `BLOCKED` (§45). Larger AUC, longer excursions or
bigger accumulation never count as success by themselves (§37).

Success does NOT authorize production changes (§46). If B3 passes, the next
question would be the single-fast-timescale vs independent-slow-Mood question —
which is explicitly NOT started by this experiment.

## Zero-LLM integrity

Real model calls: **0**. No OpenAI/Ollama/DeepSeek/evaluator calls anywhere.
No random seeds (there are no random values). Results embed the manifest hash
and source/built fingerprints so every number is attributable to the exact
experiment code that produced it.

## Files

- `contract.ts` / `manifest.ts`: frozen protocol + manifest (§42).
- `fixtures.ts`: canonical JSON/hash helpers, B2 native snapshot fixture.
- `mechanisms.ts`: impulse mapping, recovery/clamp, application registry,
  B-family engine (partition variants + restore resume), B2 native driver.
- `metrics.ts`: deterministic metrics (§34).
- `runner.ts`: execution, §38 comparison table, gates G1–G9, verdict.
- `plots.ts`: deterministic SVG plots (§40).
- `gates.ts`: engineering gates (v1 conventions; full lint must equal the
  current zero-debt baseline).
- `artifacts.ts`: fingerprints, git integrity (production frozen), evidence I/O.
- `cli.ts`: `node research/experiments/affect-state-retention-e1/cli.ts run <outdir>`.
- `evals/conformance/affect-state-retention-e1.test.ts`: offline deterministic
  conformance tests.
- `evidence/run-r1/`: manifest.json, gates.json (reference), trajectories/,
  metrics.json, comparison.json, restore-replay.json, partition-errors.json,
  sensitivity.json, decision-gates.json, result.json, plots/, SUMMARY.md.

## Reproduce

```text
node research/experiments/affect-state-retention-e1/cli.ts run research/experiments/affect-state-retention-e1/evidence/run-r1
```

Requires a clean committed main equal to origin/main at the frozen baseline.
