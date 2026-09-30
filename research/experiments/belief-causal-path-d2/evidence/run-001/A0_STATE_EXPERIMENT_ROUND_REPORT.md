# D2 A0 STATE EXPERIMENT — ROUND REPORT

**`D2_A0_STATE_EXPERIMENT_COMPLETED`**
**`STRUCTURAL_DIRECTION_LEGIBLE`**
**`CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE`**
**`STRUCTURAL_MAGNITUDE_CALIBRATED`** (secondary diagnostic)
**`D2_A1_AUTHORISED`**
**Model calls this round: exactly 12.** Zero retries, zero replacements, no thirteenth call, no changed denominator. Cumulative D2 calls: **27**.

---

## 1. THE RUNNER REBUILT NOTHING

The brief restricted this round to reading frozen artifacts. The runner
(`a0-state-experiment.ts`) constructs no world, no subject state, no observation, no projection, no
pristine V8 request and no transformed request. Its entire loop is
`schedule entry → frozen request from disk → hash check → one call → persist immediately`.

## 2. PRE-EXECUTION INTEGRITY (before the first call)

| Check | Result |
| --- | --- |
| schedule entries | 12 |
| HIGH entries / LOW entries | 6 / 6 |
| NEUTRAL or unknown arm entries | 0 |
| duplicate trial identities | 0 |
| positions are 1…12 in order | true |
| schedule hash recomputed vs recorded | exact |
| HIGH request hash vs manifest vs payload | exact |
| LOW request hash vs manifest vs payload | exact |
| every schedule entry joins to a frozen request | 12/12 |
| credences | HIGH 0.80, LOW 0.20 |
| rebuilt anything at runtime | **false** |

## 3. FROZEN IDENTITIES

- HIGH request `sha256:8c0c4ccb5fe068e2c0de803e5c33421861ee2d0dd1f89d640d4f99885d8293ac`
- LOW request `sha256:dc6203bf73aab5e7bc95a9f67d5749070a199e59e3a6404c4e9fadab2e403e6d`
- A0 contract `sha256:5778f97ec048110f…`; request-set manifest `sha256:289b52c30923440b…`
- schedule `sha256:20220b27bab67cd063bb121b980048c93308718b32c7e1b94370d13d7924df2d`
- ordering executed verbatim: `HIGH LOW LOW HIGH HIGH LOW LOW HIGH HIGH LOW LOW HIGH`

## 4. THE TWELVE TRIALS

| # | pos | arm | rep | token | transport | ms |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | 1 | HIGH | 1 | `ENDORSES_STRONGLY` | OK | 903 |
| 002 | 2 | LOW | 1 | `DOUBTS_STRONGLY` | OK | 533 |
| 003 | 3 | LOW | 2 | `DOUBTS_STRONGLY` | OK | 340 |
| 004 | 4 | HIGH | 2 | `ENDORSES_STRONGLY` | OK | 564 |
| 005 | 5 | HIGH | 3 | `ENDORSES_STRONGLY` | OK | 438 |
| 006 | 6 | LOW | 3 | `DOUBTS_STRONGLY` | OK | 524 |
| 007 | 7 | LOW | 4 | `DOUBTS_STRONGLY` | OK | 337 |
| 008 | 8 | HIGH | 4 | `ENDORSES_STRONGLY` | OK | 426 |
| 009 | 9 | HIGH | 5 | `ENDORSES_STRONGLY` | OK | 543 |
| 010 | 10 | LOW | 5 | `DOUBTS_STRONGLY` | OK | 568 |
| 011 | 11 | LOW | 6 | `DOUBTS_STRONGLY` | OK | 388 |
| 012 | 12 | HIGH | 6 | `ENDORSES_STRONGLY` | OK | 392 |

Invalid trials **0**; transport failures **0**; planned 12 / observed 12 / duplicates 0 / missing 0 /
extra 0; the frozen ordering was preserved entry-for-entry.

## 5. SCORING (after the freeze, from the frozen bytes)

The dataset was written with `scored: false` and hashed **first**
(`a0-state-dataset.json` → `sha256:eb8be177c7954147ef71a0b8b465a4551809d99ad2c7449a99e3b45c7bb17287`,
independently recomputed from the file's bytes and confirmed identical). Only then were counts derived
by re-reading that file.

- HIGH counts `{"ENDORSES_STRONGLY": 6}` — modal `ENDORSES_STRONGLY`, in the frozen endorsing set
- LOW counts `{"DOUBTS_STRONGLY": 6}` — modal `DOUBTS_STRONGLY`, in the frozen doubting set
- modals differ

Primary criterion (direction) met → **`STRUCTURAL_DIRECTION_LEGIBLE`** →
**`CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE`**.
Secondary diagnostic: HIGH = `ENDORSES_STRONGLY` and LOW = `DOUBTS_STRONGLY` →
**`STRUCTURAL_MAGNITUDE_CALIBRATED`**, reported separately and not allowed to substitute for the
primary. Individual calls were never used to override the modal.

Neutral noise context: the endpoint's own frozen pilot gave modal_count 6 → `r_confirm_A0 = 6`,
observed self-noise 0. The pilot's `UNDECIDED` token is executor-stability evidence and was **not**
used as a correctness criterion for these arms.

## 6. WHAT THIS RESULT DOES AND DOES NOT MEAN

**It means one thing only:** on the real production canonical projection of a real committed
CharacterOS state, the executor distinguishes credence 0.80 from credence 0.20 at the frozen
structural/numeric readout, unanimously across six independent replicates per arm. Nothing in the
production rendering path obscured the belief representation from the model — link 3A is established,
so the interesting question moves to A1.

**What it does not mean** — and the honest caution belongs here rather than after it:

- **This is the outcome the instrument was built to produce, not a surprise.** The qualification round
  already showed the same transformer mapping hand-written credences 0.95 / 0.49 / 0.06 onto
  `ENDORSES_STRONGLY` / `UNDECIDED` / `DOUBTS_STRONGLY` 3/3 each. Combined with the pilot, the three
  credences now read as a clean point-for-point mapping: 0.50 → `UNDECIDED`, 0.80 →
  `ENDORSES_STRONGLY`, 0.20 → `DOUBTS_STRONGLY`. It is exactly what a **numeric-to-bucket lookup**
  produces, and A0's construct is named *structural/numeric* legibility — that is the designed target,
  not an anomaly.
- **Therefore A0 cannot distinguish understanding from arithmetic.** The readout line names the
  proposition label and its numeric credence together; a model that reads the digit and applies the
  anchors passes A0 with no semantic grasp of what the proposition says. A1 exists precisely because
  A0 is passable by lookup: its paraphrase instrument removes the number and asks whether the
  *meaning* of the proposition survives.
- The `D2_LOCALIZATION_MATRIX` already names this row — `A0_positive_A1_null` →
  `BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED`, with the instruction
  *do not run B; do not call this cognitively inert*. That is the boundary this round sits on.

No claim is made here of proposition-semantic uptake, cognition use, appraisal effect,
structured-decision effect, history internalization or autonomous belief formation; nothing here says
D1 was wrong. D1's decision null stands independently.

## 7. A1 UNLOCK DECISION

`D2_A1_AUTHORISED`. **A1 was not run** — this round executed exactly the twelve frozen A0 calls and
stopped. A1's own 9-call instrument qualification is its first gated step.

## 8. ARTIFACTS

`evidence/run-001/a0-state-experiment/` — `trial-001.json` … `trial-012.json`,
`collection-integrity-report.json`, `a0-state-dataset.json` (`scored: false`),
`a0-state-dataset-hash.json`, `arm-counts.json`, `modal-report.json`, `direction-scoring.json`,
`magnitude-diagnostic.json`, `a0-scientific-verdict.json`, `A0_STATE_EXPERIMENT_MANIFEST.json`

No credential appears in any artifact (scanned). D1 untouched (`02bd7e31…`). Executor unchanged:
DeepSeek `deepseek-flash`, temperature 0, 256 output tokens, thinking disabled, same transport path,
no fallback. `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance`
PASS.
