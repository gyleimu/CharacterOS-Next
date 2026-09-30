# D4-C0a SCIENTIFIC TARGET — EXECUTION ROUND REPORT

**`EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED`**
**`D4_C0A_TARGET_EXECUTED`**
**`H_EXEC_COMPOSITION_STRONG_FORM_WEAKENED`**
**`CHARACTEROS_UNMODIFIED`** · **`D4_C0B_NOT_PREREGISTERED`** · **`LINK_4_REMAINS_LOCKED`**
**`D4_MODEL_CALLS_THIS_ROUND = 12`** (exactly twelve: no retry, no replacement, no thirteenth call) · **cumulative `D4_MODEL_CALLS = 27`**.

---

## 1. EXECUTION STATUS

The twelve frozen target calls ran in the frozen order and the frozen scorer returned **POSITIVE**.
`TARGET-012` ran even though the pattern was already clear from earlier trials — no interim
interpretation, no early stop.

## 2. FROZEN TARGET IDENTITIES

SUPPORT `sha256:0bad19fc3cd612db457615127ff79074f0e49c3f4bceab1b4b38d53b9d61549a`,
OPPOSE `sha256:bd195ef5ac12da286b0e7e8d401dc05a4ea7965506f52b41e00fea350d2dafb5`. **Both were recomputed
from the actual model-facing bytes before the first call** and matched the frozen values exactly.

## 3. FROZEN SCHEDULE IDENTITY

`sha256:d85ffc134a2e2a4c…`, recomputed from the file's bytes. Planned 12, SUPPORT 6, OPPOSE 6, identities
`TARGET-001..012` unique and complete, positions 1…12, duplicate/missing/extra all 0, **every trial
referencing its own arm's frozen hash**. Not reshuffled, not regenerated, not reordered after the noise
output.

## 4. TREATMENT ISOLATION

Re-proved on the actual bytes immediately before execution: **system messages byte-identical**, same
proposition A, same proposition B, same explicitly supplied alignment relation, same contract, same schema,
same anchors, same output vocabulary, same framing — and **exactly one differing user line**:

```
SUBJECT STANCE TOWARD A: SUPPORTS      (SUPPORT arm)
SUBJECT STANCE TOWARD A: OPPOSES       (OPPOSE arm)
```

`treatment_correlated_differences_beyond_the_stance: 0`, and after the frozen sentinel normalisation the
two requests are **byte-identical**.

**State-blindness re-verified:** zero forbidden-substring hits, no `SUPPORT_ARM`-style arm label, no
replicate ordinal, no schedule identity, no request hash. The stance line is the scientific treatment, not
a leak.

## 5. COLLECTION INTEGRITY

Planned 12, records 12, SUPPORT 6, OPPOSE 6, duplicate 0, missing 0, extra 0, every recorded arm matching
the frozen schedule, every request hash matching its arm identity, frozen ordering preserved. **0 invalid,
0 transport failures**, two distinct request hashes across the twelve.

## 6. THE TWELVE TRIALS

| # | trial | arm | token | ms |
| --- | --- | --- | --- | --- |
| 1 | `TARGET-001` | SUPPORT | `SUPPORTS_B` | 911 |
| 2 | `TARGET-002` | OPPOSE | `OPPOSES_B` | 461 |
| 3 | `TARGET-003` | OPPOSE | `OPPOSES_B` | 647 |
| 4 | `TARGET-004` | SUPPORT | `SUPPORTS_B` | 706 |
| 5 | `TARGET-005` | SUPPORT | `SUPPORTS_B` | 630 |
| 6 | `TARGET-006` | OPPOSE | `OPPOSES_B` | 390 |
| 7 | `TARGET-007` | OPPOSE | `OPPOSES_B` | 408 |
| 8 | `TARGET-008` | SUPPORT | `SUPPORTS_B` | 656 |
| 9 | `TARGET-009` | SUPPORT | `SUPPORTS_B` | 742 |
| 10 | `TARGET-010` | OPPOSE | `OPPOSES_B` | 732 |
| 11 | `TARGET-011` | OPPOSE | `OPPOSES_B` | 556 |
| 12 | `TARGET-012` | SUPPORT | `SUPPORTS_B` | 419 |

## 7. PER-ARM COUNTS AND DIRECTIONAL MAJORITY

| arm | `SUPPORTS_B` | `UNCERTAIN_B` | `OPPOSES_B` | unique modal | predicted count | ≥ 4 | criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **SUPPORT** | **6** | 0 | 0 | `SUPPORTS_B` | 6 | yes | **met** |
| **OPPOSE** | 0 | 0 | **6** | `OPPOSES_B` | 6 | yes | **met** |

Contrast holds: the two arm modals differ.

## 8. FROZEN SCORER OUTPUT

`scoreD4C0ARev1V0` was called on the re-read frozen dataset bytes: outcome **POSITIVE**,
`collection_integrity: true`, `invalid_count: 0`, `scientific_scoring_executed: true`,
`contrast_holds: true`, `arm_meets_directional_majority: {ARM_SUPPORT: true, ARM_OPPOSE: true}`.
The dataset was written with `scored: false` and hashed **first** — recomputed independently from the
file's bytes.

Note what made this possible: **the `>= 4` requirement was added by revision 1 precisely because the
earlier acceptance region was wider than its own justification.** This result satisfies the stricter rule,
not the looser one.

## 9. SCIENTIFIC VERDICT

**`EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED`**, scoped to
**`PREREGISTERED POLAR STANCE COMPOSITION`**:

> Under the frozen state-blind task with explicit polar stance and an explicitly supplied
> semantic-alignment relation, the executor transferred SUPPORT and OPPOSE stances from proposition A to
> proposition B in the preregistered directions.

## 10. H_EXEC_COMPOSITION UPDATE

**`H_EXEC_COMPOSITION_STRONG_FORM_WEAKENED`.** The claim that the executor would not perform stance
composition *even with every required fact supplied explicitly* is **no longer a good standalone
explanation** — it is refuted at the item level by this run.

**Forbidden even on this positive:** spontaneous composition established, implicit composition
established, arbitrary stance transfer established, UNCERTAIN transfer established, CharacterOS
representation proven defective, projection broken, semantic ID required, integration mechanism failed.

## 11. H1/H4/H6 REMAINING STATUS

**H6 remains fully open, and this result does not touch it.** C0a's contract is a *deliberately explicit*
composition baseline — that design choice was recorded in advance as making a null strong and a positive
weak. A C0a positive plus the frozen A1 null therefore **cannot separate** CharacterOS
representation/binding from executor-facing framing from A1's measurement-contract ambiguity. H1/H4 remain
open for the same reason.

## 12. CHARACTEROS ARCHITECTURE GATE

**`CLOSED`. `characteros_architecture_may_be_modified: false`.** A C0a positive authorises **nothing** on
its own. A future comparator must hold all ten conditions equal — executor, A, B, stance value, supplied
relation information, measurement question, anchors, output vocabulary, surrounding framing, generation
settings — and must **mechanically enumerate every model-facing byte difference**, with the
**stance-information source/representation** as the only permitted scientific difference. Until then:
no projection change, no semantic IDs, no embedding, no proposition graph, no relation propagation, no
extra model pass, no prompt rescue.

## 13. C0b STATUS

**`D4_C0B_NOT_PREREGISTERED`.** Not designed in this round, as required.

## 14. LINK 4 STATUS

**`LINK_4_REMAINS_LOCKED`.** `link_4_reopened: false`. Nothing here reaches toward link 4.

## 15. DATASET HASH

`D4_C0A_TARGET_DATASET_SHA256` — frozen with `scored: false` before any scientific scoring, independently
recomputed.

## 16. MODEL CALLS

12 this round; **27 cumulative** (9 qualification + 6 noise + 12 target).

## 17. TESTS / GOVERNANCE

`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no credential
in any artifact; `git status packages/` empty. Prior evidence recomputes (D4-C0a qualification
`e41b2f49…`, D4-C0a noise `d7f969ca…`, D3-B target `8fee6b26…`, D2-A1 `2cacbf01…`).

## 18. EXPLICIT NON-CLAIMS

No spontaneous or implicit composition is claimed; no arbitrary or UNCERTAIN stance transfer is claimed;
no CharacterOS representation or projection defect is claimed; no CharacterOS change is authorised. A
reverse direction, a 3-2-1 plurality and a tie would have been NULLs, never effects — that rule was frozen
before this run and this run happened to satisfy the stricter criterion instead. **A1's framing ambiguity
(H6) remains open regardless of this result**, and the A1 null is not explained away by it.

## 19. ARTIFACTS

`evidence/d4-c0a-target/` — `pre-execution-target-audit.json`, `target-schedule-verification.json`,
`treatment-isolation-audit.json`, `trial-001..012.json`, `collection-integrity-report.json`,
`target-dataset.json` (`scored: false`), `target-dataset-hash.json`, `support-arm-counts.json`,
`oppose-arm-counts.json`, `scorer-output.json`, `scientific-verdict.json`, `hypothesis-update.json`,
`architecture-gate-status.json`, `D4_C0A_TARGET_MANIFEST.json`

**Stopped here.** No comparator was designed. C0b was not designed. CharacterOS was not modified.
