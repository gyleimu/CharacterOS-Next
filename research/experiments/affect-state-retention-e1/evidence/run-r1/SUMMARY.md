# STATE_RETENTION_AND_RECOVERY_E1 — run summary

- Manifest: manifest.json (protocol_hash 243b23142b158d7d0fa7f2d0fbd5c46baddf803816f73abba20249ad0b0f305f, frozen before results)
- Engineering gates: D:\Documents\CharacterOS-Next\tmp\affect-state-retention-e1-gates/gates.json (PASS)
- Structural law (§38): HOLDS — B1==B3_RESET byte-equal; identical event records; common baseline start; B0 constant
- Restore proofs: [{"mechanism":"B3","sequence_id":"S5_A","restore_time":30,"max_abs_error":0,"tolerance":1e-12,"pass":true},{"mechanism":"B3_RESET","sequence_id":"S5_A","restore_time":30,"max_abs_error":0,"tolerance":1e-12,"pass":true}]
- Replay proof: pass=true

## Decision gates

| Gate | Status | Evidence |
|---|---|---|
| G1 | PASS | all B3 outputs finite and within [-1,1]x[0,1] across 10 sequences (incl. sensitivity + partitions) |
| G2 | PASS | post-event distance non-increasing and <= d0*exp(-8)+1e-12 at last_event+1200 for every B3 run |
| G3 | PASS | B3 max partition error across all sequences and strategies: 8.881784197e-16 <= 1e-12; per-mechanism/sequence errors recorded in partition_errors. |
| G4 | PASS | Z impulse exactly 0 and S6 == S1 control within 1e-12 (B3, B3_RESET, B2 native) |
| G5 | PASS | B3 post-event == pre+u exactly (-0.2371013970063236), B3_RESET post-event == clamp(b+u) (-0.05), retention difference 0.1871013970063236, unsaturated=true |
| G6 | PASS | B3 repeated post=-0.219766969776 < B3 single-event control post=-0.05 < 0, unsaturated=true |
| G7 | PASS | pre-common-event |dv|=0.231142170344, post-common-event |dv|=0.231142170344, end-of-recovery |dv|=0.0000775395598828, B3_RESET post-common |dv|=0 (overwrite by construction), unsaturated=true |
| G8 | PASS | saturated during input=true, left boundary after input stopped=true, d0=1, dEnd=0.000335462627903 <= d0*exp(-8)+1e-12=0.000335462628903, finite=true |
| G9 | PASS | same id+payload -> REPLAY (impulse null, delta 0, trajectory unchanged=true); same id+changed payload -> CONFLICT; distinct ids same payload -> both APPLIED=true |
| RESTORE | PASS | B3: max_abs_error=0 <= 1e-12; B3_RESET: max_abs_error=0 <= 1e-12 |

## Verdict

**SUPPORTED_FOR_NEXT_STAGE**

All hard stability/integrity gates (G1-G4, G8, G9) PASS and all retention/accumulation/path-dependence gates (G5-G7) PASS.
