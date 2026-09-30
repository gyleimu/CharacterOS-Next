# D4-C1 2×2 REPRESENTATION COMPARATOR — EXECUTION ROUND REPORT

**`CHARACTEROS_BELIEF_RECORD_SUPPORTS_STATE_BLIND_CROSS_EXPRESSION_COMPOSITION`** (Case A: both representations positive)
**`D4_C1_COMPARATOR_TARGET_EXECUTED`** · `CHARACTEROS_UNMODIFIED` · `LINK_4_REMAINS_LOCKED` · `D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN`
**`MODEL_CALLS_THIS_ROUND = 24`** (exactly twenty-four) · **`C1_MODEL_CALLS = 30`** (6 stability + 24 target, requalification 0) · target completion: all 24 attempts, no retry, no replacement, no twenty-fifth call.

---

## 1. EXECUTION STATUS

All twenty-four frozen calls ran in the frozen order and **every cell met its criterion**. `trial-024` ran even though the pattern was already clear by the midpoint — no interim interpretation, no early stop. The dataset was frozen before any scoring, and the frozen scorer was **called** (once per representation) rather than re-implemented.

## 2. THE FOUR FROZEN REQUEST IDENTITIES

| cell | identity |
| --- | --- |
| `E-SUPPORT` | `sha256:0bad19fc…` — **matches the frozen C0a SUPPORT hash**, system and user bytes identical |
| `E-OPPOSE` | `sha256:bd195ef5…` — **matches the frozen C0a OPPOSE hash**, system and user bytes identical |
| `R-SUPPORT` | carries the production record bytes with `credence: 0.8` |
| `R-OPPOSE` | carries the production record bytes with `credence: 0.2` |

`semantic_equivalence_accepted_as_sufficient: false` — the explicit cells were checked as bytes.

## 3. EXPLICIT BYTE IDENTITY TO C0a

The contemporaneous explicit reference **is** the frozen C0a request, byte for byte, in both stances. This is what lets the contrast be attributed rather than assumed.

## 4. RECORD PRODUCTION-BYTE FIDELITY

Both record cells carry bytes produced by the frozen production-faithful renderer
(`{"proposition_id":…,"proposition_label":…,"credence":…}` in production field order), differing from each other only in the credence digits.

## 5. FOUR-CELL ISOLATION

Every one of the six cell pairs differs on **exactly one line**, every difference is the stance value, the four requests collapse to **one** normalised form, and `unexpected_treatment_correlated_differences: 0`. Only two axes are allowed: **stance polarity** and **representation form**.

## 6. TEMPORAL SCHEDULE INTEGRITY

24 entries, six blocks of four, each block holding every cell exactly once, per-cell totals **6/6/6/6**, ordering **unchanged**, `max_consecutive_same_representation: 3` matching the frozen design and `reordered_to_improve_the_metric: false`.

## 7. THE 24 TRIAL OUTCOMES

| block | order and tokens |
| --- | --- |
| 1 | E-SUPPORT `SUPPORTS_B`, E-OPPOSE `OPPOSES_B`, R-OPPOSE `OPPOSES_B`, R-SUPPORT `SUPPORTS_B` |
| 2 | E-OPPOSE `OPPOSES_B`, R-SUPPORT `SUPPORTS_B`, E-SUPPORT `SUPPORTS_B`, R-OPPOSE `OPPOSES_B` |
| 3 | R-SUPPORT `SUPPORTS_B`, R-OPPOSE `OPPOSES_B`, E-OPPOSE `OPPOSES_B`, E-SUPPORT `SUPPORTS_B` |
| 4 | R-OPPOSE `OPPOSES_B`, E-SUPPORT `SUPPORTS_B`, R-SUPPORT `SUPPORTS_B`, E-OPPOSE `OPPOSES_B` |
| 5 | E-SUPPORT `SUPPORTS_B`, E-OPPOSE `OPPOSES_B`, R-OPPOSE `OPPOSES_B`, R-SUPPORT `SUPPORTS_B` |
| 6 | E-OPPOSE `OPPOSES_B`, R-SUPPORT `SUPPORTS_B`, E-SUPPORT `SUPPORTS_B`, R-OPPOSE `OPPOSES_B` |

**Every single trial landed on its cell's predicted token — 24 out of 24.** No invalid, no transport failure, and no dissent of any kind.

## 8. COLLECTION INTEGRITY

Planned 24, records 24, per cell 6/6/6/6, duplicates 0, missing 0, extra 0, recorded cell equals the frozen schedule cell for every record, every request hash equals its frozen request, frozen ordinal order preserved, invalid **0**, transport failures **0**.

## 9. THE FOUR CELL COUNTS AND MODALS

| cell | `SUPPORTS_B` | `UNCERTAIN_B` | `OPPOSES_B` | unique modal | predicted count | ≥ 4 | criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `E-SUPPORT` | **6** | 0 | 0 | `SUPPORTS_B` | 6 | yes | **met** |
| `E-OPPOSE` | 0 | 0 | **6** | `OPPOSES_B` | 6 | yes | **met** |
| `R-SUPPORT` | **6** | 0 | 0 | `SUPPORTS_B` | 6 | yes | **met** |
| `R-OPPOSE` | 0 | 0 | **6** | `OPPOSES_B` | 6 | yes | **met** |

Both representations show a clean opposite-direction contrast.

## 10. THE TWO VERDICTS

- **`EXPLICIT_REFERENCE_POSITIVE`** — the contemporaneous reference reproduced: the composition works with the explicit polar stance representation, in this session, on this executor.
- **`CHARACTEROS_RECORD_CONDITION_POSITIVE`** — the composition also works with the current three-field CharacterOS belief record, **in a matched state-blind research frame**.

## 11. COMPARATOR-LEVEL VERDICT

**`CHARACTEROS_BELIEF_RECORD_SUPPORTS_STATE_BLIND_CROSS_EXPRESSION_COMPOSITION`**

> Under the same composition framing, the same executor, the same proposition A and B, the same explicitly supplied semantic-alignment relation and the same measurement instrument, the current three-field CharacterOS belief record is enough to support the preregistered polar stance composition.

## 12. H_REPRESENTATION UPDATE

**`H_REPRESENTATION_FORM: SUBSTANTIALLY_WEAKENED`** — the representation-form hypothesis is no longer the leading explanation, and the priorities recorded are now **production framing, placement, A1's H6, and the broader executor-facing interface**.

**What it does not mean**, recorded explicitly: not that the production belief path works; not that A1's null is explained; not that H6 is closed; not that the production framing is cleared. The record condition is
**"CURRENT CHARACTEROS BELIEF-RECORD REPRESENTATION IN A MATCHED STATE-BLIND RESEARCH FRAME"** — describing it as "the production CharacterOS condition" remains forbidden, because production placement, the full subject state, the production observation and A1's framing are all absent by design.

## 13. H_FRAMING AND H6 STATUS

`H_FRAMING` is **raised in priority**, particularly given that the frozen A1 null stands. **H6 remains fully open** and no C1 result can close it: C1 deliberately uses C0a's clear composition framing, while A1 used its own internally tenser frozen wording. Even a full four-cell positive does not license "CharacterOS belief path works" — only that the record representation form is not, by itself, a sufficient explanation of the A1 null.

## 14. ARCHITECTURE GATE, C0b, LINK 4

- **CharacterOS production modification remains CLOSED.** Nothing is authorised by this result, and the immediate changes stay forbidden: removing `proposition_id`, converting credence to stance text, adding semantic IDs, embeddings or a relation graph, rewriting the production prompt.
- **`D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN`** stands; C0b is not reopened.
- **`LINK_4_REMAINS_LOCKED`** — C1 is not an A1-positive replacement inside the D2 sequential chain and authorises no appraisal work.

## 15. DATASET HASH

`D4_C1_COMPARATOR_TARGET_DATASET_SHA256` — frozen with `scored: false` **before** any cell or comparator scoring, independently recomputed from the file's bytes.

## 16. MODEL CALLS

24 this round; **30 cumulative for C1** (6 stability + 24 target, 0 requalification). Recorded as **not interchangeable observations** — the six stability calls are an instrument-stability gate, and only the 24 target calls bear on the comparator.

## 17. TESTS / GOVERNANCE

`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no credential in any artifact; `git status packages/` empty. Prior evidence recomputes: D4-C0a target `8a6ca2c8…`, D4-C0a noise `d7f969ca…`, D4-C0a qualification `e41b2f49…`, C1 record stability unchanged; the revision chain holds.

## 18. EXPLICIT NON-CLAIMS

The record condition is **not** the production CharacterOS condition. Nothing here says the production belief path works, that A1's null is explained, that H6 is closed, or that the production framing is cleared. No claim is made about *which* component of the record form mattered — none needed to, since every cell passed. No spontaneous or implicit composition is claimed, no CharacterOS production modification is authorised, C0b is not reopened, and link 4 stays locked.

## 19. ARTIFACTS

`research/experiments/belief-representation-comparator-d4-c1/evidence/comparator-target/` —
`pre-execution-evidence-audit.json`, `target-schedule-verification.json`, `temporal-balance-report.json`,
`four-request-identity-audit.json`, `four-cell-isolation-audit.json`, `trial-001..024.json`,
`collection-integrity-report.json`, `comparator-target-dataset.json` (`scored: false`),
`comparator-target-dataset-hash.json`, `E-SUPPORT-counts.json`, `E-OPPOSE-counts.json`,
`R-SUPPORT-counts.json`, `R-OPPOSE-counts.json`, `four-cell-scorer-output.json`,
`comparator-level-scorer-output.json`, `hypothesis-update.json`, `architecture-gate-status.json`,
`D4_C1_COMPARATOR_TARGET_MANIFEST.json`

**Stopped here.** No new experiment was designed, CharacterOS was not modified, C0b and link 4 were not
reopened.
