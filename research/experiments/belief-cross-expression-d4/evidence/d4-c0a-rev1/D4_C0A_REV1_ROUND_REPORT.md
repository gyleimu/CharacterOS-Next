# `D4-C0A REV1` — DIRECTIONAL MAJORITY — ROUND REPORT

**`D4_C0A_PREREGISTRATION_FINALIZED_REV1`**
**`D4_C0A_QUALIFICATION_IMPLEMENTATION_AUTHORISED`**
**`D4_C0B_NOT_PREREGISTERED`** · **`LINK_4_REMAINS_LOCKED`** · **`CHARACTEROS_UNMODIFIED`**
**`MODEL_CALLS_THIS_ROUND = 0`** · no production file touched (`git status packages/` empty).

`contract-rev1-directional-majority.ts`, manifest `sha256:66afec1d5b574aab…`, revision-0 manifest
preserved (`sha256:5bac6aa45dc5c3c9…`, verified equal).

---

## 1. THE MISMATCH, REPRODUCED ON THE OLD SCORER

Revision 0's written rationale said r = 6 was chosen because the criterion **"tolerates up to two
deviating trials"**. Its executable scorer required only that the predicted token be the **unique
modal**. The audit called the old scorer on each SUPPORT-arm pattern:

| SUPPORT pattern | non-predicted outputs | old scorer | allowed by the written rationale |
| --- | --- | --- | --- |
| 6-0-0 | 0 | POSITIVE | yes |
| 5-1-0 | 1 | POSITIVE | yes |
| 4-2-0 | 2 | POSITIVE | yes |
| **3-2-1** | **3** | **POSITIVE** | **no** |
| 3-3-0 | 3 | NULL | no |

**`D4_C0A_SCORER_RATIONALE_MISMATCH`** — the executable acceptance region was strictly **wider** than its
own written justification. Both rules are defensible designs; having one in prose and the other in code
is not. An acceptance region wider than its justification is a preregistration defect precisely because
it is the kind of difference that gets settled after seeing data.

**No output of any kind existed when this was corrected**: `qualification_outputs_seen_before_amendment:
false`, `target_outputs_seen_before_amendment: false`, `any_output_of_any_kind_existed: false`. So this is
a consistency fix, not outcome-based tuning.

## 2. THE AMENDMENT NARROWED THE CODE, NOT THE PROSE

The written tolerance became executable: **`max_non_predicted_per_arm = 2`**, i.e. per arm the predicted
token must be the unique modal **AND** its count must be at least `r − 2`. At r = 6:

- `ARM_SUPPORT`: `SUPPORTS_B ≥ 4 of 6` **and** unique modal
- `ARM_OPPOSE`: `OPPOSES_B ≥ 4 of 6` **and** unique modal

Named `PRE_REGISTERED_DIRECTIONAL_MAJORITY`. **No confidence interval, effect-size threshold, margin
threshold or significance test was added** — the amendment only makes the code say what was already
written down; it introduces no new inferential standard.

## 3. THE AMENDED SCORER, CALLED ON THIRTEEN SYNTHETIC CASES

| case | expected | observed |
| --- | --- | --- |
| 6-0-0 both arms | POSITIVE | POSITIVE |
| 5-1-0 each arm | POSITIVE | POSITIVE |
| 4-2-0 each arm | POSITIVE | POSITIVE |
| **3-2-1 predicted plurality** | **NULL** | **NULL** |
| 3-3 tie | NULL | NULL |
| constant SUPPORTS both arms | NULL | NULL |
| constant OPPOSES both arms | NULL | NULL |
| reversed direction | NULL | NULL |
| only one arm correct | NULL | NULL |
| UNCERTAIN dominates | NULL | NULL |
| one invalid / all invalid / out-of-vocabulary | INCONCLUSIVE | INCONCLUSIVE |
| integrity failure (5 records in an arm) | INCONCLUSIVE | INCONCLUSIVE |

**The decisive row is 3-2-1, and the reason matters.** Its predicted token **is still the unique modal** —
so the amendment rejects it on the **directional majority**, not on modal uniqueness. That is what makes
the test exercise what it claims: had the amendment merely tightened modal uniqueness, this row would not
have distinguished anything.

**3-2-1 may not be reinterpreted as a weak positive**, and a reversed direction remains a NULL, never an
"effect in the opposite direction".

## 4. THE r = 6 RE-AUDIT — NOW CONSISTENT

| pattern | non-predicted | eligible | why |
| --- | --- | --- | --- |
| 6-0-0 | 0 | yes | |
| 5-1-0 | 1 | yes | |
| 4-2-0 | 2 | yes | |
| 3-3-0 | 3 | no | no unique modal |
| **3-2-1** | 3 | **no** | predicted token is the unique modal, but the directional majority is not met |

**"At most two non-predicted outputs per arm" is now the rule the code enforces**, not just the rule the
prose described. Target remains **2 arms × 6 = 12 calls**; total maximum remains **27**; **budget
unchanged**.

## 5. THE NOISE GATE AND THE TARGET SCORER DO DIFFERENT JOBS

Kept as-is, with the division of labour now explicit — this is worth stating because the two thresholds
look inconsistent until the tasks are separated:

- **The noise gate** checks that the **measurement path is self-consistent** on one byte-identical
  **non-target** request (6 calls, all six agreeing).
- **The target scorer** checks **treatment-sensitive directional composition** across the two stance
  arms.

**Why a demanding gate coexists with a two-deviation target tolerance:** the gate can only certify
determinism on **one fixed input**; the target's tolerance concerns variation across the two **treatment
arms**, which the gate cannot observe at all. They answer different questions, so their thresholds are
not in tension. The gate's modal identity may **not** be used to derive the target answer, and `r` may
**not** change dynamically — `reachable_r_values: [6]`, `sample_size_branches: 0`, unchanged.

## 6. THE POSITIVE CLAIM IS SCOPED TO POLAR STANCES

The target arms cover **SUPPORT and OPPOSE only**. The canonical interpretation is therefore
**`PREREGISTERED POLAR STANCE COMPOSITION`**, and the authoritative expansion is:

> Under the frozen state-blind explicit-relation task, the executor transferred preregistered SUPPORT and
> OPPOSE stances from proposition A to semantically aligned proposition B with the required
> directional-majority criterion.

**May not claim:** arbitrary stance transfer, **UNCERTAIN transfer established**, spontaneous composition,
implicit semantic composition, or CharacterOS causal capability. UNCERTAIN is excluded because **no arm
supplies an UNCERTAIN stance** — the design has no evidence about transferring it; `UNCERTAIN_B` appears
only as an output token and in the qualification negative control.

## 7. THE ARCHITECTURE GATE IS STRENGTHENED

**A C0a positive alone authorises nothing.** A future CharacterOS-vs-state-blind comparator must hold
**all ten** of these equal — same executor, same A literal, same B literal, same stance value, same
supplied semantic relation information, same measurement question, same anchors, same output vocabulary,
same surrounding research framing, same generation settings — and must **mechanically enumerate every
model-facing byte difference**. The **only** permitted scientific difference is the **source /
representation of the stance information**.

**If relation explicitness, instruction framing or measurement semantics also change, the result may not
be attributed to the CharacterOS representation.** That condition is what keeps H1/H4 (representation
binding), H5 (executor composition) and H6 (measurement framing) separately identifiable — without it, a
comparator could "find" a representation effect that was really a framing effect.

## 8. WHAT WAS NOT TOUCHED

A/B literals, the explicit alignment relation, the SUPPORT/OPPOSE arms, the state-blind construct, the
qualification fixtures, the executor, the base system text and the contract text all still come from
revision 0 by import — `preserved_elements_changed: false`. CharacterOS is untouched. D1/D2/D3 evidence
recomputes. `D4_C0B_NOT_PREREGISTERED` stands; link 4 remains locked.

## ARTIFACTS

`research/experiments/belief-cross-expression-d4/evidence/d4-c0a-rev1/` —
`scorer-rationale-mismatch-report.json`, `amended-scorer-audit.json`, `r6-eligibility-report.json`,
`contract-rev1-manifest.json`, `D4_C0A_REV1_VERDICT.json`

`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no
credential in any artifact.

**The next round may only:** implement the frozen transformer on the frozen minimal base, pass its offline
conformance gate at **zero** calls, freeze the implementation hashes, then execute **qualification only**.
It may not design or run C0b, modify CharacterOS, change the tokens, anchors, fixtures, arms or contract,
**widen the acceptance region back**, add a sample-size branch to the gate, or execute anything from D2-B
or link 4.
