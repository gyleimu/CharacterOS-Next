# D3-B NON-TARGET NOISE STABILITY GATE — ROUND REPORT

**`D3_B_NOISE_STABILITY_GATE_PASS`**
**`r_confirm_B = 6`**
**`D3_B_TARGET_AUTHORISED`**
**`D3_B_TARGET_NOT_EXECUTED`**
**`D3_MODEL_CALLS = 15`** (6 this round: exactly six, zero retries, zero replacements, no seventh call).

---

## 1. PRE-EXECUTION REQUEST AUDIT — BEFORE THE FIRST NEW CALL

The frozen noise request was re-read from the qualification artifact and verified on its bytes:

| check | result |
| --- | --- |
| hash equals the revision-3/4 frozen identity | `sha256:82a8678e044fd802…` — equal |
| fixture reselected | **false** |
| a newly rendered calibration stimulus substituted | **false** |
| contains the canonical CAUTION proposition | **no** |
| contains the frozen A1 paraphrase | **no** |
| contains CharacterOS subject state | **no** |
| contains a credence | **no** |
| contains HIGH / LOW / NEUTRAL | **no** |
| contains an A1 token | **no** |
| is the D3-B target request | **no** |
| `D3_B_TARGET_CALLS` | **0** |

Verdict `D3_B_NOISE_REQUEST_VERIFIED`. Had any check failed the runner wrote a blocked report and stopped
at zero calls, with no repair-and-continue path.

## 2. PRIOR EXPOSURE — HISTORICAL ONLY

The same request was called **3 times** during qualification. Those records belong only to qualification
evidence: they do **not** enter this dataset, do **not** enter the modal count, are **not** target
evidence, and do **not** alter the planned denominator. The current batch is exactly six new scheduled
calibration calls — the old three were **not** merged to make a nine-call stability estimate. The frozen
limitation stands as written: the calibration stimulus has been seen before and must not be described as
never-before-seen.

## 3. THE SIX CALLS

Six pre-frozen identities, all pointing at the same frozen request hash, with the replicate ordinal
absent from the model-facing bytes. Executor identical to qualification: DeepSeek `deepseek-flash`,
temperature 0, 256 output tokens, thinking disabled, same transport, no fallback.

| trial | relation | ms |
| --- | --- | --- |
| `NOISE-001` | `SEMANTICALLY_ALIGNED` | 964 |
| `NOISE-002` | `SEMANTICALLY_ALIGNED` | 700 |
| `NOISE-003` | `SEMANTICALLY_ALIGNED` | 392 |
| `NOISE-004` | `SEMANTICALLY_ALIGNED` | 799 |
| `NOISE-005` | `SEMANTICALLY_ALIGNED` | 364 |
| `NOISE-006` | `SEMANTICALLY_ALIGNED` | 516 |

One distinct request hash across the six; invalid 0; transport failures 0.

The dataset was written with `scored: false` and hashed **first**
(`sha256:493156e3edc2bc46…`, independently recomputed), and only then was the frozen
`classifyD3BNoiseStabilityV0` **called** — never re-implemented, and the six tokens were never read by
hand before the classifier ran.

## 4. THE GATE'S OUTPUT

Counts `{"SEMANTICALLY_ALIGNED": 6}` → unique modal `SEMANTICALLY_ALIGNED`, modal count 6 →
**`D3_B_NOISE_STABILITY_GATE_PASS`**, `r_confirm_B = 6`, target authorised.

**One reading to resist.** The modal token happens to equal the fixture's pre-registered expected
relation, but the gate does **not** ask for that — it asks whether the six calls agree *with each other*.
This batch is a stability measurement, not a second correctness test, and the counts artifact says so.
Reading this as "the instrument got the fixture right again" would be re-running qualification by
implication.

## 5. THE TARGET PLAN, FROZEN BUT NOT EXECUTED

On PASS the target execution plan was frozen from one thing only — the gate's outcome:

- planned calls **6**, all six referencing the **same** target request bytes
- target request hash `sha256:70f69a1f131166d9…`
- target pair confirmed: the canonical CAUTION proposition versus the frozen A1 paraphrase; expected
  relation still `SEMANTICALLY_ALIGNED`
- target subject data **untouched** (the production subject block survives — unlike the qualification
  base, the target request keeps it)
- generation did **not** depend on the noise modal token identity, qualification outputs, latency,
  provider metadata, the timestamp or human choice
- `first_target_call_executed_this_round: false`

**Stated plainly: this round created the target request bytes for the first time.** They did not exist as
an artifact before — the qualification round built only the three fixture requests — so the schedule
could not reference pre-existing bytes. The derivation is fully pinned instead: the production base with
unmodified subject data, the frozen target pair, and the frozen transformer whose source hash was frozen
at qualification. From here the target request hash is frozen, which is a property the next round gets
for free.

**No target call was made.** `D3_B_TARGET_NOT_EXECUTED` and `target_calls = 0` both hold.

## 6. ARTIFACTS

`evidence/run-001/d3-b-noise-stability/` — `pre-execution-request-audit.json`, `noise-trial-manifest.json`,
`trial-001..006.json`, `noise-dataset.json` (`scored: false`), `noise-dataset-hash.json`,
`noise-counts.json`, `noise-stability-classifier-output.json`, `D3_B_NOISE_STABILITY_MANIFEST.json`,
`D3_B_TARGET_SCHEDULE.json`, `d3-b-target-schedule-hash.json`, `d3-b-target-schedule-audit.json`

Verified after: the noise dataset (`493156e3…`), the target schedule, the D3-B qualification dataset
(`04f232f3…`), D2-A0 (`eb8be177…`), D2-A1 (`2cacbf01…`) and D1 (`02bd7e31…`) all still recompute. No
credential in any artifact. `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean;
`pnpm governance` PASS.

**Stopped before the target, as required.** The next round is the D3-B target run: six calls of the frozen
target request, dataset frozen before scoring, classified by `scoreD3BTargetV0` — whose positive demands
unanimity, so any single dissent yields the frozen valid null and any invalid yields the frozen
inconclusive.
