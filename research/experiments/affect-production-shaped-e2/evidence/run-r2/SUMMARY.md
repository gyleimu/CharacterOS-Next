# PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — run summary

- Manifest: manifest.json (protocol_hash 686b26f74992537bf2b676cd0ba867e517d141792a8e27d3de8501acb1227dc5, frozen before results)
- Corpus: 232 lifetimes, 170496 events, Merkle root 4999910c98fcebc8...
- Engineering gates: D:\Documents\CharacterOS-Next\tmp\affect-production-shaped-e2-gates/gates.json (PASS)
- Run accounting: 1030/1030

This is an engineering coverage distribution consistent with current canonical Appraisal contracts. It is NOT an observed, calibrated, representative, or provider-estimated production distribution.

## Decision gates

| Gate | Status | Evidence |
|---|---|---|
| G1 | PASS | frozen manifest 686b26f74992537b... binds corpus root 4999910c98fcebc8...; 232 lifetimes validated by the canonical proposal validator; run accounting exact (1030); zero model calls; production diff empty |
| G2 | PASS | 0 bound/finite violations across 464 B3/B3_RESET runs (incl. B3 a >= .2 - 1e-12, so O_a- = 0 and N_a- = 0). |
| G3 | PASS | partition probes D2/D3/D7/D8 (B3, tick1/tick10/direct): max_abs_error 4.10782519111e-15 <= 1e-12 |
| G4 | PASS | restore: D2@6000/B3=0, D2@6000/B3_RESET=0, D7@6000/B3=0, D7@6000/B3_RESET=0, D8@50000/B3=0, D8@50000/B3_RESET=0; replay: B0=REPLAY/conflict=CONFLICT/differentId=APPLIED, B3_RESET=REPLAY/conflict=CONFLICT/differentId=APPLIED, B3=REPLAY/conflict=CONFLICT/differentId=APPLIED, B2=REPLAY/conflict=CONFLICT/differentId=APPLIED |
| G5 | PASS | C4 vs C5 B3 max_abs_error 0 <= 1e-12 (attribution/controllability/uncertainty/assessment_confidence never read) |
| G6 | PASS | 352 quiet windows across 232 lifetimes (B3): max model error 4.66293670343e-15 <= 1e-12; monotone d; +600 exp(-4) / +1200 exp(-8) thresholds true; D4/D5/D7 boundary exit true; quiet_debt = 0 |
| G7 | PASS | D1/D2/D3: Q95_seed(O_v-+O_v+) <= .005, Q95_seed(O_a+) <= .005, Q95_seed(N_v) <= .020, Q95_seed(N_a+) <= .020 |
| G8 | PASS | D2: Q95_seed(Q99_time(a))=0.384356981718 <= .75; Q95_seed(O_a+)=0 <= .001; Q95_seed(strong_debt)=0.00425 <= .05 |
| G9 | PASS | input |sum(q(2g-1))| <= 1e-12 for every balanced lifetime: true; output drift: all six balanced families within thresholds; D4/D5 symmetry max |v4+v5|=2.220446049250313e-16, |a4-a5|=0 <= 1e-12: true |
| G10 | PASS | D3 pooled: fraction(J>=.02)=0.450846354167 >= .25; fraction(J<.005)=0.113606770833 <= .70; unsaturated MID/STRONG/EDGE fraction(J>=.02)=0.998558038933 >= .75; seeds with B_.05 > .95: 0 <= 3 |
| G11 | PASS | qualified pairs 16/16 (>= 15 required; qualification = unsaturated AND D_pre >= .05); qualified-pair instantaneous retention |D_post-D_pre| <= 1e-12 and reset D_post <= 1e-12: true; B3 recovery at 2100/2700 within exp(-4)/exp(-8) bounds: true. Instantaneous-retention failure is CORE; too few qualifying histories is a mapping/coverage risk. |
| G12 | FAIL | D6: Q95_seed(mean(|v|<=.05 AND a>=.6))=0.003 <= .05; Q95_seed(strong_debt)=0.320083333333 <= .05 |
| G13 | PASS | every D8 seed: O_v-+O_v+ <= .02, O_a+ <= .02, N_v <= .10, N_a+ <= .10, B_.05 >= .20 (per-seed enforcement) |
| G14 | PASS | D7 stress: finite/bounded=true; saturation recorded=true; quiet recovery gate PASS; no saturation ceiling imposed |

## Verdict

**SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK**

Core dynamics pass; mapping risks: ACTIVATION_MAPPING_RISK.

Sub-risks: ACTIVATION_MAPPING_RISK
