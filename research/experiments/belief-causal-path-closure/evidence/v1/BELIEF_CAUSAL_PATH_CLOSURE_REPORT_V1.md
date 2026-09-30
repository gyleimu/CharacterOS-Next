# `BELIEF_CAUSAL_PATH_EVIDENCE_CLOSURE_V1`

**`BELIEF_CAUSAL_PATH_D1_D2_D3_EVIDENCE_FROZEN`**
**`LINK_3B_LOCALIZATION_COMPLETE`**
**`LINK_4_REMAINS_LOCKED`**
**`NO_NEW_SCIENTIFIC_CLAIM_ADDED`**
**`MODEL_CALLS_THIS_ROUND = 0`** · no new experiment · no reinterpretation beyond frozen evidence.

---

## 1. EVERY IDENTITY WAS RECOMPUTED, NOT TRUSTED

`closure.ts` re-derives every authoritative hash **from the artifact bytes** and compares it against the
value the producing round recorded, then stops on any mismatch. All of them reproduce:

| verified | count | result |
| --- | --- | --- |
| datasets and schedules | 9 | all match |
| request-set identities (from the request bytes) | 7 | all match |
| frozen implementation sources | 13 | hashed |

The nine are: D1 core-treatment dataset, D2-A0/A1 state datasets, D3-B qualification/noise/target
datasets, and the D2-A0 / D2-A1 / D3-B schedules. The seven requests: both D2 arms' full sets and the
D3-B target request.

**A false alarm worth recording.** The first run reported `BELIEF_CAUSAL_PATH_EVIDENCE_INTEGRITY_FAILURE`
on the D1 dataset — because D1 hashes `{ dataset }` (its sorted records array) while D2/D3 hash
`{ name, content }` over the file text. My recomputation used the D2 convention and got a different hash.
**The wrong fix would have been to adjust the recorded value**, or the artifact, to make my
recomputation agree. The right fix was to reproduce each line's own producer convention. That near-miss is
recorded as a protocol lesson and the failure artifact was withdrawn.

## 2. THE AUTHORITATIVE LINK MAP

Every row carries an `evidence_class`, because the most damaging misreading this map exists to prevent is
taking an executor capability diagnostic for CharacterOS causal evidence.

| link | status | evidence | class |
| --- | --- | --- | --- |
| 1 canonical belief state exists / manipulable | ESTABLISHED | D1 offline state construction and isolation | `CHARACTEROS_STRUCTURAL` |
| 2 canonical state reaches the production projection | ESTABLISHED | D1 production projection and normalised isolation | `CHARACTEROS_PROJECTION` |
| **3A/3B1 canonical credence → canonical proposition stance** | **ESTABLISHED** | D2-A0 | `CHARACTEROS_STATE_READOUT` |
| **3B2 canonical ↔ paraphrase direct relation recognition** | **ESTABLISHED** | D3-B target | `EXECUTOR_STATE_BLIND_CAPABILITY` |
| **3B3 cross-wording stance transfer** | **NOT ESTABLISHED** | D2-A1 valid null | `VALID_NULL` |
| 4 epistemic appraisal | **NOT TESTED** | — | — |
| 5 structured decision | **SENSITIVITY NOT ESTABLISHED** | D1 valid null | `VALID_NULL` |

Observed counts, recomputed: D2-A0 HIGH `ENDORSES_STRONGLY` 6, LOW `DOUBTS_STRONGLY` 6. D2-A1 HIGH
`SUPPORTS` 6, LOW `SUPPORTS` 5 + `UNCERTAIN` 1. D3-B target `SEMANTICALLY_ALIGNED` 6. D1's five blocks all
`CONTRAST_NO_MOVEMENT` with the negative control `NEGATIVE_CONTROL_HELD`.

**Link 5 is written precisely.** Not "link 5 = false", which the brief forbids: what was measured is that
the **sensitivity** of the structured decision to the manipulated canonical belief state was not
established under the frozen D1 design.

**Link 4's reason is recorded, not implied:** D2's sequential preregistration required an A1 positive;
A1 was a valid null; **a D3-B positive does not substitute for an A1 positive.**

## 3. EVIDENCE-TYPE SEPARATION

Seven allowed classes: `CHARACTEROS_STRUCTURAL`, `CHARACTEROS_PROJECTION`,
`CHARACTEROS_STATE_READOUT`, `EXECUTOR_STATE_BLIND_CAPABILITY`, `CHARACTEROS_CAUSAL_ENDPOINT`,
`VALID_NULL`, `INCONCLUSIVE`. No row is left unclassified, and the D3-B row states in its own text that it
is **not** CharacterOS causal evidence — so a reader who takes only the link map still cannot conclude
that D3-B proves CharacterOS semantic transfer.

## 4. POSITIVE / NULL / INCONCLUSIVE REGISTRY

Eleven rows, each with planned calls, actual calls, invalid count, integrity, scorer identity, positive
predicate, actual verdict and class. Classes present: `POSITIVE` (D2-A0 state experiment, D3-B target),
`VALID_NULL` (D1 core treatment, D1 restart, D2-A1 state experiment), `QUALIFIED` (three qualifications),
`CALIBRATION` (two pilots), `STABILITY_PASS` (D3-B noise gate). **`null_is_not_inconclusive: true`**, and
no run in this ledger is inconclusive.

## 5. THE FROZEN COMBINED STATEMENT

**`SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED`**,
expanded mechanically: (1) canonical credence can be read as a stance toward the canonical proposition;
(2) the executor can directly recognise the canonical proposition and the frozen paraphrase as
semantically aligned; (3) the frozen CharacterOS A1 experiment did not establish transfer of that stance
to the paraphrased expression. **This is the maximum observational claim.**

## 6. ARCHITECTURAL HYPOTHESIS REGISTRY

`CROSS_WORDING_STANCE_BINDING_OR_COMPOSITION_PROBLEM`, status **`HYPOTHESIS`**, supporting pattern
3B1 positive / 3B2 positive / 3B3 null. The registry explicitly forbids the words *proven*,
*established* and *observed mechanism failure*, and lists the permitted wording: *consistent with*,
*suggests investigating*, *candidate architectural explanation*.

## 7. NON-CLAIMS

Nine entries. Global ineffectiveness of the belief module and global absence of semantic understanding:
**not claimed**. "The executor cannot understand paraphrases": **contradicted by D3-B target**. "The
canonical credence is unreadable": **contradicted by D2-A0**. Belief is cognitively inert: **not
established** — the term would require A0 positive + A1 positive + B null, and D2 never reached an A1
positive. Appraisal link failed: **not tested** (not "failed"). Integration mechanism failed: **not
observed**. D1 overturned: **false**. D2-B reopened: **false**.

## 8. HISTORICAL NAMING AUDIT

| historical verdict | instrument actually measured | map interpretation |
| --- | --- | --- |
| `CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE` | the subject's stance **on the proposition**, i.e. credence → stance | `CANONICAL_PROPOSITION_STANCE_BINDING_ESTABLISHED` |
| `..._STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED` | transfer of that stance to one preregistered paraphrase | `CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED_ON_PREREGISTERED_PARAPHRASE` |
| `D3_B_INSTRUMENT_QUALIFIED` | whether the relation instrument realises its own vocabulary | instrument evidence only |
| `PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED` | a state-blind relation judgement between two literals | `EXECUTOR_STATE_BLIND_CAPABILITY` |

**`STRUCTURALLY_LEGIBLE` is the important row:** the name reads as raw numeric visibility, while D2-A0's
anchors define its buckets as the proposition being settled in the subject's favour or against it and its
frozen criterion is exactly that directional stance criterion — so the instrument established more than
the name says. **No historical artifact is renamed**; the map carries the corrected reading alongside the
historical name.

## 9. PROTOCOL LESSONS

Thirteen governance lessons, recorded separately from scientific evidence, with
`retrospective_effect: NONE` — **every affected run was invalidated or corrected before the affected calls
were made, so no scientific output was altered.** They include: a self-comparison check; a literal-typed
comparison the compiler proves cannot fail; an audit that encoded the defective state as a PASS; a request
that carried forbidden subject state; a noise pilot identical to its target; sample-size logic
incompatible with a unanimity scorer; a verdict name narrower than its instrument; a missing invalid
policy; an undefined modal count; a "tamper" test that did not actually tamper; a lexical law scoped too
broadly to be satisfiable; and the false integrity failure from a wrong hash convention.

## 10. MODEL-CALL LEDGER

| line | total | qualification | calibration | scientific target |
| --- | --- | --- | --- | --- |
| D1 | 66 | — | — | 60 core + 6 pilot/design |
| D2 | 54 | 18 | 12 | 24 |
| D3 | 21 | 9 | 6 | 6 |
| **grand total** | **141** | | | |

With the accounting rule stated in the artifact: **these categories are not interchangeable.** Only
scientific-target calls produce evidence about the frozen causal links; qualification calls test an
instrument on state-blind fixtures and calibration calls measure self-noise. Summing all 141 as though
each were an independent scientific observation is explicitly forbidden.

## 11. ARTIFACTS

`research/experiments/belief-causal-path-closure/evidence/v1/` — `BELIEF_CAUSAL_PATH_EVIDENCE_MAP_V1.json`,
`BELIEF_CAUSAL_PATH_CLAIM_REGISTRY_V1.json`, `BELIEF_CAUSAL_PATH_NONCLAIMS_V1.json`,
`BELIEF_CAUSAL_PATH_PROTOCOL_LESSONS_V1.json`, `BELIEF_CAUSAL_PATH_HASH_LEDGER_V1.json`,
`BELIEF_CAUSAL_PATH_COMBINED_STATEMENT_V1.json`, `BELIEF_CAUSAL_PATH_HYPOTHESIS_REGISTRY_V1.json`,
`BELIEF_CAUSAL_PATH_HISTORICAL_NAMING_AUDIT_V1.json`, `BELIEF_CAUSAL_PATH_CALL_LEDGER_V1.json`,
`CLOSURE_VERDICT.json`

These are required inputs for any future D4 or belief-architecture modification. No credential in any
artifact (scanned). `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean;
`pnpm governance` PASS.

**Stopped here.** D4 was not designed in this round; link 4 remains locked; no new scientific claim was
added.
