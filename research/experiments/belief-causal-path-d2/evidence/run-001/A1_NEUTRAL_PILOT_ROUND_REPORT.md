# D2 A1 — REQUEST FREEZE AND NEUTRAL SELF-NOISE PILOT — ROUND REPORT

**`D2_A1_NEUTRAL_PILOT_COMPLETED`**
**`r_confirm_A1 = 6`**
**`D2_A1_STATE_REQUEST_SET_FROZEN`**
**`D2_A1_STATE_EXPERIMENT_SCHEDULE_FROZEN`**
**`D2_A1_STATE_EXPERIMENT_NOT_STARTED`**
**`D2_MODEL_CALLS = 42`** (6 this round: zero retries, zero replacements, no seventh call).

---

## 1. THE THREE ARMS, BUILT OFFLINE THROUGH THE FROZEN CONTEXT

`a1-state-requests.ts` rebuilt the arms through production genesis → lawful materialisation →
production observation lifecycle → production projection → pristine V8 request, then applied
`buildD2SemanticReadoutRequestV0` once per arm. Nothing was hand-written, patched, or rewritten from an
A0 or qualification request.

**Context binding verified against REV1.1d, per arm:** subject identity
`d1-belief-sensitivity-subject` (read at `/identity/subject_id`), observation id
`observation:o-d1-p1-awaiting-inspection`, committed observation identity equal to the same id, probe
`D1-P1-AWAITING-INSPECTION`, observation and scene bytes equal to the D1 P1 literal, `task = null`,
canonical proposition equal to `D1_PROPOSITION_LABEL`, and each arm's credence equal to its REV1.1d
value. Verdict `D2_A1_CONTEXT_BINDING_VERIFIED`.

## 2. STATE ISOLATION — RE-PROVED, NO NEW CLASS

| Pair | Raw diff | Normalised diff |
| --- | --- | --- |
| HIGH vs NEUTRAL | exactly the four frozen Revision 4 paths | `["/beliefs/items/0/credence"]` |
| HIGH vs LOW | exactly the four frozen Revision 4 paths | `["/beliefs/items/0/credence"]` |
| NEUTRAL vs LOW | exactly the four frozen Revision 4 paths | `["/beliefs/items/0/credence"]` |

The trace bookkeeping was again **forward-recomputed** per arm (`state_hash_after` from the state
itself, `trace_id` re-derived from the entry body). No allowed difference class was added.

## 3. TRANSFORMER APPLICATION AND SEMANTIC STRUCTURE

Per arm: production prefix byte-identical, user content untouched, A1 measurement contract exactly
once, schema exactly the frozen A1 schema, contract hash exact, paraphrase exactly once, anchors exact,
DecisionProbeV2 / A0 / B all absent, and a second application rejected. The transformer **source hash
was re-verified against the qualification-time value** (`sha256:628c5094…`) — the implementation is
unchanged since it was qualified. The transformer introduced **no** arm word and **no** action token
(per-token deltas against the pristine prompt are all zero).

The semantic structure audit passed on all three arms, and it is the point of the whole stage:

| Requirement | Result |
| --- | --- |
| subject state carries the canonical CAUTION wording | yes |
| the belief line carries the arm credence | yes |
| the measurement side uses only the frozen paraphrase | yes |
| canonical wording is **not** copied into the measurement contract | yes |
| paraphrase is **not** written into the canonical belief state | yes |
| measurement contract offers no numeric→token lookup hint | yes |
| no arm labels in the measurement contract | yes |
| no expected token written into the stimulus | yes |
| canonical wording and paraphrase share no 4-gram | yes |
| canonical wording's 4-gram overlap with the contract | 0 |

So the real A1 request has the shape **canonical wording → different preregistered wording**, not the
qualification shape of same wording → same wording. That is what makes a later HIGH/LOW result
informative about transfer rather than about string matching.

## 4. CROSS-ARM MODEL-FACING ISOLATION

Using only the frozen REVISION 3 normalisation (no new exception): after normalisation the three
requests are **byte-identical**, one distinct normalised form, each with exactly one credence
replacement and one `[projection_hash]` replacement. Raw model-facing differences are recorded per pair
for the audit trail.

## 5. THE FROZEN REQUEST SET

| Arm | Final request hash |
| --- | --- |
| HIGH | `sha256:4ada729e349e1633…` |
| NEUTRAL | `sha256:cc417f778cb0cf90…` |
| LOW | `sha256:0bbd6c81b40c1e39…` |

Manifest `sha256:5be552f3c0d76ebd…`, recording
`a1_characteros_outputs_seen_before_request_freeze: false`,
`scheduled_high_low_replicates: "not yet known"`, the context-binding identity, the transformer and
contract hashes, the paraphrase hash and the normalisation identity. From that moment the three
request byte strings are immutable.

## 6. THE SIX NEUTRAL CALLS

One frozen NEUTRAL request, six times — **one distinct model-facing request hash**, so the replicate
ordinal never entered the payload. Trials `d2-a1-neutral-001…006`, all written to disk immediately.
Tokens: `UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE` ×6. Invalid 0, transport failures 0, latencies
518–948 ms.

The dataset was written with `scored: false` and hashed **first**
(`sha256:4a28b57f98c5c4ba8…`, independently recomputed from the file's bytes), and classification ran
afterwards over those frozen bytes. Classification was produced by **calling** the frozen
`classifyA1NeutralPilotV0` — not by re-implementing it — and the counts were derived by re-reading the
frozen dataset.

## 7. WHAT THE RESULT DOES AND DOES NOT SAY

`modal_count = 6` → **`r_confirm_A1 = 6`**, which authorises nothing beyond a 12-call treatment run at
six replicates per arm.

**The neutral token is not evidence of anything.** Six `UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE` answers
to a 0.50-credence request say the endpoint is stable, and that is all they say. The frozen policy is
explicit that the token's *identity* cannot influence `r`: six `SUPPORTS` and six `UNCERTAIN` are
equivalent for noise calibration, both being `modal_count = 6`. The tempting reading — "0.50 should
read as uncertain, so the instrument works" — is exactly the correctness claim this pilot was designed
not to make, and it was never pre-registered.

This round establishes **A1 endpoint self-noise under one byte-identical NEUTRAL CharacterOS request**.
It does **not** establish semantic transfer, proposition understanding, cognition use, appraisal effect
or behavioural effect. Real LINK 3B evidence can only come from the frozen HIGH vs LOW A1 state
experiment.

## 8. THE FROZEN SCHEDULE — NOT EXECUTED

`2r = 12` calls, six per arm. The ordering is a pure function of `r` alone — pairs alternate
`HIGH, LOW` then `LOW, HIGH` — and the audit confirms it: arms equal (6/6), maximum consecutive run 2,
regeneration from `r` alone reproduces it byte-for-byte, and `ordering_did_not_depend_on` explicitly
names the neutral modal token identity, the A0 token pattern, human choice, the timestamp and provider
output. Schedule hash and its audit are frozen.

**No HIGH or LOW call was made.** `first_high_low_call_executed_this_round: false`.

## 9. ARTIFACTS

`evidence/run-001/a1-characteros-request-freeze/` — `context-binding-verification.json`,
`state-isolation-report.json`, `transformer-application-report.json`, `semantic-structure-audit.json`,
`pristine-{high,neutral,low}.json`, `final-{high,neutral,low}.json`, `request-isolation-report.json`,
`A1_CHARACTEROS_REQUEST_SET_MANIFEST.json`

`evidence/run-001/a1-neutral-pilot/` — `trial-001..006.json`, `neutral-request-hash.json`,
`pilot-dataset.json` (`scored: false`), `pilot-dataset-hash.json`, `pilot-counts.json`,
`pilot-classification.json`, `r-confirm-a1.json`, `A1_STATE_EXPERIMENT_SCHEDULE.json`,
`schedule-audit.json`, `schedule-hash.json`, `A1_NEUTRAL_PILOT_MANIFEST.json`

**One bug of mine, found by its own gate and fixed:** the semantic structure audit's first run reported
a failure while every boolean in it was `true` — a count field (`4-gram overlap = 0`) had been placed
inside a row whose predicate is "every value must be `true`". The count is now a separate informational
field and the boolean `..._is_zero` carries the check. A predicate must test the property it names.

Verified after: the A1 request set, the A0 request set, the A0 state dataset and the A1 qualification
dataset all still recompute; D1 untouched (`02bd7e31…`). No credential appears in any artifact
(scanned). `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.

**Stopped here**, as the brief requires: the first HIGH/LOW call belongs to the next round.
