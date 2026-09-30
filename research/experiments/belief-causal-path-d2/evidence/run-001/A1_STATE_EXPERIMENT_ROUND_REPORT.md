# D2 A1 STATE EXPERIMENT — ROUND REPORT

**`D2_A1_STATE_EXPERIMENT_COMPLETED`**
**`BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED`** — a **valid null**
**`D2_EXECUTION_STOPPED_AT_A1`** · **`D2_B_NOT_AUTHORISED`**
**`D2_MODEL_CALLS = 54`** (12 this round; zero retries, zero replacements, no thirteenth call).

---

## 1. EXECUTION

Frozen inputs only — the runner rebuilt nothing: no world, state, observation, projection, pristine or
transformed request, paraphrase or schedule. Its whole loop was
`schedule entry → frozen payload → hash assertion → one provider attempt → persist`.

Pre-execution integrity passed before the first call: 12 entries, positions exactly 1…12, HIGH 6 / LOW 6,
NEUTRAL 0, duplicate identities 0, missing 0, HIGH and LOW request hashes exact against both the manifest
and the payloads, **every identity carrying its frozen arm and its frozen request hash**, schedule hash
exact (`d49962e7…`), transformer source hash unchanged since qualification (`628c5094…`), A1 contract hash
unchanged, and the semantic structure re-asserted on the frozen bytes (canonical wording in the subject
state, paraphrase absent from it, paraphrase once in the contract, canonical wording absent from the
contract, anchors present, no A0/B/DecisionProbeV2 contract, zero 4-gram overlap).

The twelve calls ran in the frozen order, exactly as written, with no regroup, reorder, sort or skip.
Executor unchanged: DeepSeek `deepseek-flash`, temperature 0, 256 output tokens, thinking disabled.

## 2. FROZEN IDENTITIES

- HIGH request `sha256:4ada729e349e1633…`; LOW request `sha256:0bbd6c81b40c1e39…`; request-set manifest
  `sha256:5be552f3c0d76ebd…`
- schedule `sha256:d49962e73ed44995…`, ordering `HIGH LOW LOW HIGH HIGH LOW LOW HIGH HIGH LOW LOW HIGH`,
  `r_confirm_A1 = 6`, 12 calls

## 3. COLLECTION INTEGRITY

planned identities 12 · trial records 12 · HIGH 6 · LOW 6 · duplicate 0 · missing 0 · extra 0 ·
recorded arm equals the frozen arm for every identity · recorded request hash equals the frozen schedule
hash for every identity · invalid trials **0** · transport failures **0** · frozen ordering preserved.
The planned denominator was used, never a count of successful provider calls.

## 4. THE TWELVE TRIALS

| # | pos | arm | rep | token | ms |
| --- | --- | --- | --- | --- | --- |
| 001 | 1 | HIGH | 1 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 675 |
| 002 | 2 | LOW | 1 | `UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE` | 443 |
| 003 | 3 | LOW | 2 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 505 |
| 004 | 4 | HIGH | 2 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 574 |
| 005 | 5 | HIGH | 3 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 809 |
| 006 | 6 | LOW | 3 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 390 |
| 007 | 7 | LOW | 4 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 585 |
| 008 | 8 | HIGH | 4 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 417 |
| 009 | 9 | HIGH | 5 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 418 |
| 010 | 10 | LOW | 5 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 426 |
| 011 | 11 | LOW | 6 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 598 |
| 012 | 12 | HIGH | 6 | `SUPPORTS_PARAPHRASED_PRINCIPLE` | 522 |

Two distinct request hashes across the twelve (one per arm), so no replicate ordinal entered a payload.

## 5. THE FROZEN SCORER'S OUTPUT

The dataset was written with `scored: false` and hashed **first**
(`sha256:2cacbf0159af95d9…`, independently recomputed from the file's bytes); only then was the frozen
`classifyA1StateExperimentV0` **called** — never re-implemented, never pre-empted by hand.

| | SUPPORTS | UNCERTAIN | OPPOSES | unique modal |
| --- | --- | --- | --- | --- |
| **HIGH** (0.80) | **6** | 0 | 0 | `SUPPORTS_PARAPHRASED_PRINCIPLE` |
| **LOW** (0.20) | **5** | 1 | 0 | `SUPPORTS_PARAPHRASED_PRINCIPLE` |

`positive_predicate: false` · `scientific_scoring_executed: true` · `d2_b_authorised: false`.
Both arms carry the **same** unique modal, and LOW's is not the predicted `OPPOSES_PARAPHRASED_PRINCIPLE`.
Collection integrity held and `invalid_count = 0`, so this is a **valid null** — not an inconclusive run,
and not a null produced by a provider or parser failure.

## 6. WHAT THIS MEANS, AND WHAT IT DOES NOT

A0 established that the canonical belief representation is structurally legible: the executor
distinguishes 0.80 from 0.20 at the structural/numeric readout. A1 asked the next question and answered
it in the negative: **the canonical stance did not transfer to the preregistered paraphrase's
direction** — a subject whose canonical CAUTION stance is at 0.20 (doubting) still reads as *endorsing*
the paraphrase five times out of six.

Per the frozen localisation matrix this is the `A0_positive_A1_null` row: representation is structurally
legible, but semantic uptake was not established on the preregistered near-semantic-transfer paraphrase.
The matrix's own instruction is explicit and is honoured here: **do not run B; do not call this
cognitively inert.** "Cognitively inert" remains licensed only by A0 positive + A1 positive + B null.

**One descriptive observation, offered as post-hoc and not as a preregistered finding.** Combining this
round's counts with the frozen neutral pilot, which used the same production context:

| canonical credence | readout |
| --- | --- |
| 0.20 | `SUPPORTS` 5/6 (+ `UNCERTAIN` 1/6) |
| 0.50 | `UNCERTAIN` 6/6 |
| 0.80 | `SUPPORTS` 6/6 |

The readout is not constant across credences — so this is not a dead instrument — but it is not
directionally faithful either: both a strong endorsement and a strong doubt map onto the *same* endorsing
bucket. A plausible reading is that the measurement layer responds to "a belief with a nonzero credence is
present" and reserves `UNCERTAIN` for the stance-zero value, but **that is a hypothesis this design
cannot test** and it is recorded as such, after the fact, with no preregistered status. This also cannot
be attributed to the paraphrase being unrelated to the belief: the paraphrase is the frozen near-semantic
transfer target the whole A1 stage was built around, and the semantic structure audit verified that the
subject state carried the canonical wording while the contract carried only the paraphrase.

**Non-claims.** This does not show the proposition is globally unreadable, that no semantics exist in the
system, that the belief is behaviourally inert, or that D1 was overturned. D1's decision null stands
independently and was not reopened. A1's scope is exactly: *semantic uptake was not established on the
preregistered near-semantic-transfer paraphrase.*

## 7. ARTIFACTS

`evidence/run-001/a1-state-experiment/` — `pre-execution-integrity-report.json`, `trial-001..012.json`,
`collection-integrity-report.json`, `a1-state-dataset.json` (`scored: false`),
`a1-state-dataset-hash.json`, `arm-counts.json`, `unique-modal-report.json`, `scorer-output.json`,
`a1-scientific-verdict.json`, `d2-b-unlock-decision.json`, `A1_STATE_EXPERIMENT_MANIFEST.json`

Verified after: the A1 request set, the A1 schedule (`d49962e7…`), the A1 pilot dataset (`4a28b57f…`)
and the A0 request set all still recompute; D1 untouched (`02bd7e31…`). No credential appears in any
artifact (scanned). `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean;
`pnpm governance` PASS.

**Stopped here.** D2-B was not executed and is not authorised. The whole D2 chain now reads:
link 1 and 2 established by D1 without model calls; **3A (structural readout) ESTABLISHED**;
**3B (semantic uptake) NOT ESTABLISHED — this round's valid null**; 4 (appraisal) untouched;
5 (structured decision) D1's independent null.
