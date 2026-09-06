# Activation mapping ablation experiment E2A (`ACTIVATION_MAPPING_ABLATION_E2A`)

Deterministic Emotion Dynamics research experiment. **Production is frozen** at
`bf6c2fe761a0ed5eee7e53d4b6697297e0271e1c`; only this directory and
`evals/conformance/affect-activation-mapping-e2a.test.ts` may change (plus the
mechanical isolation-guard authorizations in the E1/E2 harness files,
documented in the manifest). E1 and E2 are FROZEN prior evidence; no E1/E2
evidence is edited or reinterpreted.

## Why E2A exists

E2 concluded `SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK` with exactly one risk:
`ACTIVATION_MAPPING_RISK` — D6 alternating input produced
`Q95_seed(strong_debt) = 0.320` against the preregistered `<= .05`, while
valence cancellation itself passed. E2A isolates the ONE factor:

> Is the activation risk caused by the magnitude of the positive activation
> gain, or by the deeper structural assumption that every relevant event
> contributes only positive activation?

## Single factor (§3/§4)

Variants: **A0** (`u_a = 0`), **A10** (`u_a = 0.10q`), **A20** (`u_a = 0.20q` —
the exact frozen E2 mapping, control). Everything else is byte-identical and
machine-checked: baseline (0, 0.2), tau = 150, q = r·i, u_v = .25q(2g−1), B3
retention `clamp(x_before + u)`, exponential recovery, bounds. No signed /
contextual / nonlinear activation, no habituation, no parameter search
(§37-§41).

## Corpus reuse (§5/§6/§7/§8)

The E2 frozen generator and sequence definitions are imported — never
regenerated. Families exactly D2 (chatter), D3 (ordinary), D6 (alternating —
where E2 found the risk), D7 (high density stress); seeds exactly
`E2-S00..S07`. The manifest binds the E2 protocol hash
(`686b26f7…`), the E2 corpus root (`4999910c…`), per-source fingerprints
(E1 law, E2 generator, E2 metrics, E1/E2 evidence trees) and the per-lifetime
sequence hashes asserted identical across variants (§10).

## Run accounting (§9/§46)

96 primary (4 families × 8 seeds × 3 variants) + 6 partition (D6-S00 × 3
variants × tick10/direct) + 3 restore (D6-S00 × 3 variants at the frozen tick
9000) + 3 replay = **108**, machine-checked.

## Gates and selection (§26-§32)

Per-variant debt gates (D6 `Q95_seed(strong_debt) <= .05`; D2 debt + D2
`Q95_seed(Q99(a)) <= .75`), D6 cancellation occupancy, D3 responsiveness
(unused-by-A0 by construction), strong-event response (median Δ_a ≥ .02 for
q ≥ .25), quiet recovery, bounds, valence invariance (hard protocol gate),
partition/restore/replay integrity, A20 reproduction requirement (the E2 risk
must reproduce on the subset, else `INVALID_EXPERIMENT`), and the gain-identity
check (Δ_a(A10) ≈ .5·Δ_a(A20), Δ_a(A0) = 0). Selection follows the exact Case
A-F precedence.

## Zero-model integrity

Real model calls: **0**. No random values anywhere. Results bind the manifest
hash, the E2 protocol hash, the E2 corpus root and all dependency
fingerprints.

## Files

- `contract.ts`: frozen protocol (variants, law, seeds, families, gates,
  selection logic, accounting).
- `mechanisms.ts`: variant runner over the frozen E1 primitives (recover,
  clampState, impulseOf, registry) — A20 identity with the E1/E2 engine
  machine-checked.
- `corpus.ts`: E2 generator reuse (import, never copied).
- `runner.ts`: execution, metrics, gates, §32 selection.
- `manifest.ts`/`gates.ts`/`artifacts.ts`/`fixtures.ts`/`cli.ts`/`tsconfig.json`:
  frozen manifest, engineering gates, fingerprints/IO, entrypoint, shared
  helpers.
- `evals/conformance/affect-activation-mapping-e2a.test.ts`: §45 conformance.
- `evidence/run-r1/`: manifest.json, selected-corpus-index.json,
  variant-metrics.json, trajectories/, gates/, plots/, result.json, SUMMARY.md.

## Reproduce

```text
node research/experiments/affect-activation-mapping-e2a/cli.ts run research/experiments/affect-activation-mapping-e2a/evidence/run-r1
```

Requires a clean committed main equal to origin/main at the frozen baseline.

## Claim boundary (§53)

If A10 wins, the only allowed claim is: within the frozen E2A corpus and B3
dynamics, reducing the event activation gain from `.20q` to `.10q` removed the
preregistered activation-debt failure while retaining the preregistered minimum
event-driven activation response. NOT allowed: `.10` is psychologically
correct, globally optimal, or solves production activation; Mood unnecessary;
real providers will match the synthetic corpus.
