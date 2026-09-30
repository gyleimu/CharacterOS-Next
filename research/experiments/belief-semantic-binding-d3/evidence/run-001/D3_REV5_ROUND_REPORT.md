# D3 REVISION 5 — CORRECTED STATE-BLIND TARGET REQUEST — ROUND REPORT

**`D3_PREREGISTRATION_FINALIZED_REV5`**
**`D3_B_TARGET_REQUEST_NOT_STATE_BLIND`**
**`D3_B_TARGET_STATE_BLIND_REQUEST_FROZEN`**
**`D3_B_TARGET_SCHEDULE_REFROZEN`**
**`D3_B_TARGET_AUTHORISED`**
**`D3_B_TARGET_NOT_EXECUTED`**
**`D3_MODEL_CALLS = 15`** — **0 calls this round.**

`contract-rev5-target-state-blind.ts`, manifest `sha256:76c9b99e8c85f361…`, preserving revision 4
(`sha256:b5f962f03ce6e33a…`).

---

## 1. THE VIOLATION, MEASURED ON ITS OWN CONSTRUCTION

The invalid target request was reproduced from its own construction to measure the defect:

| | invalid `70f69a1f…` | corrected `27fe6b99…` |
| --- | --- | --- |
| canonical CAUTION occurrences | **2** | **1** |
| … owned by STATEMENT A | 1 | 1 |
| … owned by the subject block | **1** | **0** |
| paraphrase occurrences | 1 | 1 |
| user content carries the belief block | **yes** | **no** |
| user content carries a credence field | **yes** | **no** |

D3-B's frozen role is `STATE-BLIND EXECUTOR CAPABILITY DIAGNOSTIC`, and its `must_not_contain` list names
CharacterOS subject state and a credence explicitly. The invalid request carried both: a second copy of
the proposition under test and a credence, so a result from it could not have been attributed to the
relation judgement alone. Verdict `D3_B_TARGET_REQUEST_NOT_STATE_BLIND`.

**The uncomfortable part, recorded rather than quietly fixed.** The violation was introduced and then
*certified* by the same audit. That round's check list recorded `target_subject_data_untouched: true` — a
check that asserted the defect was correct, because it encoded the wrong expectation: keeping the subject
block was treated as a desirable property when the frozen role forbids it. A second check in the same
list compared the schema to itself (`canonicalJsonString(x) === canonicalJsonString(x)`) and could never
fail. **A check is only as good as the expectation it encodes, and a check that cannot fail certifies
nothing.** Both defects are on the record.

## 2. THE INVALID ARTIFACT IS PRESERVED

`sha256:70f69a1f…` and the schedule referencing it are marked
`INVALID_FOR_EXECUTION_BY_STATE_BLINDNESS_CONTRACT` and `SUPERSEDED_BEFORE_ANY_TARGET_CALL`, retained as
failure evidence — not deleted, not silently overwritten, and **no provider call was ever made with
them** (`target_calls_before_correction = 0`, `target_outputs_seen_before_correction = false`). The old
schedule file is still on disk and still references the old hash; the invalidation lives in a new
artifact rather than a modification of the old one.

The correction reason is independent of the noise gate's outcome — it comes from the frozen state-blindness
law. The gate result merely happened to be known already.

## 3. NOTHING WAS RE-RUN

`D3_B_INSTRUMENT_QUALIFIED` and `D3_B_NOISE_STABILITY_GATE_PASS` both stand, `r_confirm_B = 6` unchanged,
qualification and noise not re-run, D3 model calls still 15. The noise request was already a state-blind
frozen synthetic request, so it needed no correction.

## 4. APPARENT-CONSTRUCTION AUDIT — APPLES TO APPLES

The corrected target is built on the **same state-blind base the qualification round already used and
froze**: the production V8 request with the belief block removed by the D1-frozen `stripBeliefBlockV0`.
No new base was designed, no target-only cleanup, no target-only context.

| check | result |
| --- | --- |
| same state-blind base path as qualification | yes |
| same production system prompt | yes |
| same transformer implementation | yes |
| same schema (and equal to the frozen schema) | yes |
| same contract and anchors | yes |
| same executor-facing structure | yes |
| corrected contract reproduces the frozen literal exactly | yes (0 line differences) |
| a fixture contract differs only on the two statement lines | yes (exactly 2) |
| target-only subject-state context | **false** |
| additional context added for the target | **false** |

The only difference from qualification is the STATEMENT A / STATEMENT B literal pair: the synthetic
frozen pair there, the canonical CAUTION proposition plus the frozen paraphrase here. That is the
relation-task content itself, not leakage.

## 5. OCCURRENCE AND OWNERSHIP AUDIT

Canonical CAUTION: **1** occurrence, owned by STATEMENT A. Paraphrase: **1** occurrence, owned by
STATEMENT B. Neither appears a second time from subject data. User content carries no belief block, no
credence field and no arm label. Verdict `D3_B_CORRECTED_TARGET_OCCURRENCE_AUDIT_HOLDS`.

## 6. FROZEN IDENTITIES AND THE REFROZEN SCHEDULE

Corrected target `sha256:27fe6b992b1d5b43…`, frozen with its base identity, transformer contract name,
contract hash, schema hash, anchors hash, both statement hashes, the expected relation, and
`target_outputs_seen: false`. From here the corrected bytes are immutable.

New schedule: **6 planned calls**, `TARGET-001..006`, all referencing the corrected hash; call count
unchanged at 6; expected relation unchanged; unanimity scorer and invalid policy unchanged; the old
schedule recorded as superseded and retained; `first_target_call_executed_this_round: false`.

## 7. THE FROZEN TARGET SCORER, RE-PROVED OFFLINE

Called, not re-implemented: 6× `ALIGNED` → positive; 5× `ALIGNED` + one legal dissent → **valid null**;
any invalid → inconclusive with no scientific scoring; integrity failure → inconclusive. Every outcome
carries `may_not_reopen_link_4: true`. **D2-B stays locked.**

## 8. SCIENTIFIC MEANING UNCHANGED

D3-B still asks one thing: can the executor directly recognise the semantic relation between the frozen
canonical proposition and the frozen paraphrase? It still does not ask about subject stance, credence,
transfer from subject state, appraisal or behaviour. D2-A1's frozen valid null is untouched. The only
correction in this revision is the target request's state-blindness and identity.

**One more slip, caught by its own gate:** a check asserted the fixture contract should differ from the
frozen literal by two lines *and* the corrected contract likewise — but the frozen literal **is** the
target pair, so the corrected contract must reproduce it exactly (0 differences). The gate stopped the
run; the expectation was corrected, not the artifact.

## 9. ARTIFACTS

`evidence/run-001/rev5/` — `d3-rev5-audit.json` (violation reproduction, shape audit, occurrence audit,
identity, scorer re-proof), `D3_B_CORRECTED_TARGET_REQUEST_MANIFEST.json`, `D3_B_TARGET_SCHEDULE.json`,
`d3-b-target-schedule-hash.json`, `d3-b-target-schedule-audit.json`, `contract-rev5-manifest.json`,
`D3_REV5_VERDICT.json`

Verified after: the noise dataset (`493156e3…`), the qualification dataset (`04f232f3…`), the old invalid
schedule (still present and untouched), D2-A0 (`eb8be177…`), D2-A1 (`2cacbf01…`) and D1 (`02bd7e31…`) all
still recompute. No credential in any artifact. `tsc -p tsconfig.auxiliary.json` and
`eslint --max-warnings 0` clean; `pnpm governance` PASS.

**Stopped here.** The next round may only: execute the six corrected target calls, freeze the dataset
before scoring, and classify with `scoreD3BTargetV0`. It may not use the invalid target request, re-run
qualification or the noise pilot, execute D3-A, execute D2-B, or modify any frozen artifact.
