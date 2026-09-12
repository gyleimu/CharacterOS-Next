# AFFECT PROJECTION — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0 (AUD-11)

## Frozen numeric semantics (source of truth)

`CanonicalAffectV0` (`packages/subject-core/src/types/subject-state-v4.ts`), enforced by the
closed validator (`validation/subject-state-v4-values.ts`):

```
valence    ∈ [-1, 1]   lower = more negative, 0 = neutral, higher = more positive
activation ∈ [ 0, 1]   lower = lower activation, higher = higher activation
```

No third axis. No named emotions anywhere in the system. No number→emotion mapping is added.

## Final model-facing semantics

Rendered immediately after the canonical value line, identically on both V2 surfaces
(cognition-action prompt and conversation cognition prompt), from one shared constant
(`CANONICAL_AFFECT_LEGEND_V0`):

```
[affect (canonical)] valence=<value> activation=<value>
[affect (canonical) legend] Canonical affect is a continuous internal state (not a named emotion, not a behavioral instruction). valence range [-1,1]: lower is more negative, 0 is neutral, higher is more positive. activation range [0,1]: lower is lower activation, higher is higher activation.
```

Safety properties (asserted by regression test):
- contains the exact ranges `[-1,1]` and `[0,1]` and the explicit `0 is neutral`;
- contains no named emotion (`angry`, `sad`, `happy`, `afraid`, `anxious`) and no behavioral
  instruction (`should`, `must`);
- rendered exactly once, only on the canonical V2 surface (legacy V0/V1 render neither the
  canonical line nor the legend);
- the value line itself is unchanged: a byte-exact copy, no rounding/binning/transform.

## Production projection trace (deterministic, 0 real model calls)

From `TRACE.json` (`trace.mjs`), captured from the actual production cognition transport:

| Turn | State affect at projection | Rendered affect section (model-facing) | Cognition request sha256 |
|---|---|---|---|
| 0 | `valence=0, activation=0.2` | `[affect (canonical)] valence=0 activation=0.2` + legend | `sha256:a9dbff66…d6eed0` |
| 1 | `valence=0.1251627937881343, activation=0.25562790835028193` | `[affect (canonical)] valence=0.1251627937881343 activation=0.25562790835028193` + legend | `sha256:540a7598…438bfd` |

The rendered value equals `canonical_affect.valence/activation` byte-for-byte (raw IEEE-754
copy). The only semantic transformation is the approved legend line. The legend is present on
every production cognition call in the trace.
