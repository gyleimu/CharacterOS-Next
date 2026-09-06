# ACTIVATION_MAPPING_ABLATION_E2A — run summary

- Manifest: manifest.json (protocol_hash 5eced9519fe0b47951e78dec7831cfc99c9df71b0f57482502824dbbcc87b583, frozen before results)
- E2 bindings: protocol 686b26f74992537b..., corpus root 4999910c98fcebc8...
- Engineering gates: D:\Documents\CharacterOS-Next\tmp\affect-activation-mapping-e2a-gates/gates.json (PASS)
- Run accounting: 108/108

## Comparison table

```json
{
  "A0": {
    "D2_Q95_strong_debt": 0,
    "D2_Q95_Q99_activation": 0.2,
    "D6_Q95_strong_debt": 0,
    "D6_cancellation_occupancy": 0,
    "D3_response_at_least_005": 0,
    "D3_response_all_at_least_002": 0,
    "strong_q025_median_delta_a": 0,
    "D7_O_a_plus": 0,
    "quiet_debt_max": 0
  },
  "A10": {
    "D2_Q95_strong_debt": 0,
    "D2_Q95_Q99_activation": 0.295638819451,
    "D6_Q95_strong_debt": 0.00133333333333,
    "D6_cancellation_occupancy": 0,
    "D3_response_at_least_005": 1,
    "D3_response_all_at_least_002": 0.92578125,
    "strong_q025_median_delta_a": 0.043579239136,
    "D7_O_a_plus": 0.0373125,
    "quiet_debt_max": 0
  },
  "A20": {
    "D2_Q95_strong_debt": 0.0045,
    "D2_Q95_Q99_activation": 0.391277638903,
    "D6_Q95_strong_debt": 0.312583333333,
    "D6_cancellation_occupancy": 0.00133333333333,
    "D3_response_at_least_005": 1,
    "D3_response_all_at_least_002": 1,
    "strong_q025_median_delta_a": 0.0871584782719,
    "D7_O_a_plus": 0.119020833333,
    "quiet_debt_max": 0
  }
}
```

## Effect sizes

```json
{
  "D6_debt_reduction_ratio_A10_over_A20": 0.00426552919222,
  "response_retention_ratio_median_strong": 0.5
}
```

## Decision gates

| Gate | Status | Evidence |
|---|---|---|
| G1 | PASS | frozen manifest 5eced9519fe0b479... binds E2 protocol hash 686b26f74992537b... and E2 corpus root 4999910c98fcebc8...; seed subset exactly S00-S07; accounting 108/108; zero model calls; production diff empty |
| G2 | PASS | 32 sequence hashes persisted; all variants consume the byte-identical sequences per family+seed |
| G3 | PASS | 0 bound/finite violations across all variant runs (incl. a >= .2 - 1e-12) |
| G4 | PASS | max |v_A0 - v_A10|, |v_A10 - v_A20| over all family/seed/common timestamps: 0 <= 1e-12 |
| G5 | PASS | all variants/quiet windows: max model error 3.9968028886505635e-15 <= 1e-12; quiet_debt = 0 |
| G6a | PASS | A0: D6 Q95(debt)=0, D2 Q95(debt)=0, D2 Q95(Q99(a))=0.2, D6 Q95(cancel)=0 => PASS |
| G6b | PASS | A10: D6 Q95(debt)=0.00133333333333, D2 Q95(debt)=0, D2 Q95(Q99(a))=0.295638819451, D6 Q95(cancel)=0 => PASS |
| G6c | FAIL | A20: D6 Q95(debt)=0.312583333333, D2 Q95(debt)=0.0045, D2 Q95(Q99(a))=0.391277638903, D6 Q95(cancel)=0.00133333333333 => FAIL |
| G6 | PASS | per-variant debt gate results recorded as G6a (A0) / G6b (A10) / G6c (A20); see also G7/G8 |
| G7 | PASS | per-variant D2 debt results recorded in G6a/G6b/G6c |
| G8 | PASS | per-variant D6 cancellation results recorded in G6a/G6b/G6c |
| G9a | FAIL | A0 D3 responsiveness: unsaturated MID/STRONG/EDGE fraction(Delta_a >= .005)=0 >= .75; pooled all-q>0 fraction(Delta_a >= .002)=0 >= .25 |
| G10a | FAIL | A0 strong event response: median Delta_a over D3/D7 unsaturated q>=.25 events = 0 >= .02 |
| G9b | PASS | A10 D3 responsiveness: unsaturated MID/STRONG/EDGE fraction(Delta_a >= .005)=1 >= .75; pooled all-q>0 fraction(Delta_a >= .002)=0.92578125 >= .25 |
| G10b | PASS | A10 strong event response: median Delta_a over D3/D7 unsaturated q>=.25 events = 0.0353030599994 >= .02 |
| G9c | PASS | A20 D3 responsiveness: unsaturated MID/STRONG/EDGE fraction(Delta_a >= .005)=1 >= .75; pooled all-q>0 fraction(Delta_a >= .002)=1 >= .25 |
| G10c | PASS | A20 strong event response: median Delta_a over D3/D7 unsaturated q>=.25 events = 0.0596001347047 >= .02 |
| G9 | PASS | per-variant responsiveness recorded as G9a/G9b/G9c |
| G10 | PASS | per-variant strong event response recorded as G10a/G10b/G10c |
| G11 | PASS | D6-S00 all variants tick1/tick10/direct: max_abs_error 1.33226762955e-15 <= 1e-12 (both axes) |
| G12 | PASS | A0=0, A10=0, A20=0 <= 1e-12, no historical replay |
| G13 | PASS | A0=REPLAY/conflict=CONFLICT/differentId=APPLIED, A10=REPLAY/conflict=CONFLICT/differentId=APPLIED, A20=REPLAY/conflict=CONFLICT/differentId=APPLIED |
| G14 | PASS | A20 D6 subset strong_debts: E2-S00=0.227666666667, E2-S01=0.1955, E2-S02=0.294166666667, E2-S03=0.312583333333, E2-S04=0.242833333333, E2-S05=0.2805, E2-S06=0.156916666667, E2-S07=0.27675; seeds > .05: 8 (E2 risk REPRODUCED) |
| G15 | PASS | unsaturated identical events: max |Delta_a(A0)| and |Delta_a(A10) - .5*Delta_a(A20)| = 5.551115123125783e-17 <= 1e-12 |

## Verdict

**ACTIVATION_GAIN_REDUCTION_SUPPORTED**

Case A: A10 passes all debt + responsiveness gates while A20 fails debt; candidate u_a = 0.10q.
