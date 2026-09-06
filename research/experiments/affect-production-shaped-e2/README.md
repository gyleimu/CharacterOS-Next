# Production-shaped appraisal dynamics experiment E2 (`PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2`)

Deterministic Emotion Dynamics research experiment. **Production is frozen** at
`1925bf465fc3d4e02b94384734a44f96b0568cbd`; only this directory and
`evals/conformance/affect-production-shaped-e2.test.ts` may change. E1 is
FINAL/FROZEN (`SUPPORTED_FOR_NEXT_STAGE`); E2 imports the E1 B3 law (recovery,
impulse, clamp, event order law) from the frozen E1 experiment modules — never
reimplemented, never modified, never retuned. No B1 (E1 established its
equivalence with B3_RESET for this purpose).

## Primary question

> Does the E1-supported B3 bounded state-retention mechanism remain stable,
> recoverable, useful as a recent-history carrier, and free from pathological
> accumulation when driven by contract-valid synthetic Appraisal sequences
> shaped more like plausible CharacterOS inputs?

## Production-shaped status (§10 — claim discipline)

This is an engineering coverage distribution consistent with current canonical
Appraisal contracts. It is NOT an observed, calibrated, representative, or
provider-estimated production distribution.

## Protocol (frozen in `contract.ts` + `manifest.ts` before any result)

- Law: `b = (0, 0.2)`, `tau = 150`, `q = r*i`, `u_v = .25*q*(2g-1)`,
  `u_a = .20*q`, B3 `clamp(x_before+u)`, B3_RESET `clamp(b+u)`, exponential
  recovery, deterministic clamp with recorded saturation, §19 event order law.
- Mechanisms: B0 (constant baseline), B2 (frozen production
  `ReferenceFastEmaAffectProducer`, imported lawfully, NATIVE reporting only —
  anger/fear/sadness/joy/phase/mood, no VA translation, cannot decide the
  verdict), B3_RESET (primary comparator), B3 (candidate).
- Canonical shape (§9/§19): every synthetic event carries relevance,
  goal_congruence, attribution, controllability, uncertainty, intensity,
  assessment_confidence; every generated event passes the REAL production
  `validateExperienceAppraisalProposalV0`; complete synthetic canonical record
  fixtures pass `validateExperienceAppraisalRecordV0`. INSUFFICIENT_CONTEXT is
  represented as no accepted event (no fabricated dimensions).
- Generator (§11-§17): hash-counter `U(F,S,K) = int(first_13_hex(SHA256(...)))/2^52`,
  stateless, call-order independent, no PRNG, no wall clock; Uniform/TriMid
  helpers; amplitude classes LOW/MID/STRONG/EDGE with frozen mixtures; goal
  mixtures with balanced pairs (machine-checked `|sum(q*(2g-1))| <= 1e-12`);
  hash-based tick selection (at most one event per tick).
- Families (§20-§27): D1 quiet (18 events/12000), D2 chatter (1080 LOW events),
  D3 ordinary (192), D4 negative burst + D5 positive burst (exact mirror pair,
  `goal_D5 = 1 - goal_D4`), D6 alternating cancellation (588), D7 high density
  stress (2700), D8 long run (10 cycles x 10000 ticks, 2520 events, mirrored
  even/odd bursts). Seeds: `E2-S00..S31` (D1-D7), `E2-S00..S07` (D8) — frozen,
  none added/dropped/replaced.
- Cases: C1/C2 exact production integration-test fixtures; C3 neutral ladder;
  C4/C5 ignored-field invariant (attribution/controllability/uncertainty/
  assessment_confidence never read by B3; B2 native may differ).
- History pairs (§34): H00-H15, 40 shared event times + byte-identical common
  final appraisal at t=1500, end t=2700, B3/B3_RESET only.
- Probes: partition (tick1/tick10/direct <= 1e-12), restore (6 continuations
  <= 1e-12, no historical rerun), replay/conflict/different-ID (per mechanism).
- Run accounting (§38): 232 lifetimes x 4 mechanisms = 928 primary + 20 cases +
  64 history + 8 partition + 6 restore + 4 replay = **1030**, machine-checked.
  Probe sub-steps (references/variants) are not separate probe executions.

## Gates and verdict (§54-§68)

G1 protocol integrity; G2 finite/bounded (B3 additionally `a >= .2-1e-12` so
`O_a- = 0`); G3 time consistency; G4 restore/replay; G5 ignored fields; G6
quiet recovery (model error <= 1e-12, monotone, exp(-4)/exp(-8) thresholds,
quiet_debt = 0, boundary exit); G7 ordinary saturation; G8 micro-event
accumulation; G9 balanced valence drift + D4/D5 symmetry; G10 under-response;
G11 history retention (>= 15/16 qualified pairs; instantaneous-retention
failure is CORE, too-few-qualified is mapping risk); G12 cancellation
activation; G13 D8 per-seed long-run bounds; G14 D7 stress (no saturation
ceiling). Verdict order: INVALID_EXPERIMENT →
MECHANISM_NOT_SUPPORTED_UNDER_PRODUCTION_SHAPED_INPUT →
SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK (with sub-risk codes) →
SUPPORTED_FOR_PRODUCTION_ARCHITECTURE_DESIGN.

A mapping-risk verdict is FINAL evidence (§69): no coefficient, tau, q rule,
baseline, corpus or gate may change inside E2. E2A (§70) is documented in the
manifest and NOT implemented or run.

## Zero-model integrity

Real model calls: **0**. No OpenAI/Ollama/DeepSeek/Qwen/evaluator calls
anywhere. No random values anywhere. Results bind the manifest hash, the
corpus Merkle root, the E1 law fingerprint and the E1 evidence fingerprint.

## Files

- `contract.ts`/`manifest.ts`: frozen protocol + manifest (§54/§73).
- `generator.ts`: hash counter, mixtures, families D1-D8, cases, history
  pairs, canonical fixture builders + validation.
- `metrics.ts`: §39-§53 metrics (nearest-rank quantiles, occupancies,
  sensitivity buckets, gain checks, debts, saturation episodes, recovery
  windows, activation reconstruction, path dependence).
- `b2.ts`: E2-local native B2 driver (phase/upsert/routed classification) over
  the frozen production producer.
- `runner.ts`: execution, accounting, gates G1-G14, verdict.
- `gates.ts`/`artifacts.ts`/`cli.ts`/`fixtures.ts`/`tsconfig.json`: engineering
  gates (E1 conventions), fingerprints/IO, entrypoint, shared helpers.
- `evals/conformance/affect-production-shaped-e2.test.ts`: §74 conformance.
- `evidence/run-r1/`: manifest.json, corpus/, metrics/, trajectories/, b2/,
  gates/, plots/, result.json, SUMMARY.md.

## Reproduce

```text
node research/experiments/affect-production-shaped-e2/cli.ts run research/experiments/affect-production-shaped-e2/evidence/run-r1
```

Requires a clean committed main equal to origin/main at the frozen baseline.
