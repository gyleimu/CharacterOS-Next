# D2 A0 — STATE REQUEST FREEZE AND NEUTRAL SELF-NOISE PILOT — ROUND REPORT

**`D2_A0_NEUTRAL_PILOT_COMPLETED`**
**`r_confirm_A0 = 6`**
**`D2_A0_STATE_REQUEST_SET_FROZEN`**
**`D2_A0_STATE_EXPERIMENT_SCHEDULE_FROZEN`**
**`D2_A0_STATE_EXPERIMENT_NOT_STARTED`**
**Model calls this round: 6 of 6 permitted.** Zero retries, zero replacements, no fallback, no seventh call.

---

## 0. THE §3 GATE, RESOLVED BEFORE ANY CALL

The brief permitted the round to continue only if the authoritative contracts already froze enough
literal context to construct the A0 state-experiment request uniquely; otherwise the required output
was `D2_A0_STATE_REQUEST_NOT_FULLY_PREREGISTERED` at 0 calls, with no stimulus written here.

The check came back positive, and it is worth stating exactly why rather than asserting it. **A0 binds
no probe family at all.** `probe_family` appears only in the D2-B laws (`contract.ts:140`,
`contract-rev1.ts:182`); A0 instead carries `D2A_INSTRUMENT_LAWS.same_projection_path` — *"the stimulus
is the unmodified production canonical projection; no hand-written subject data"*. That closes the
question the missing probe binding would otherwise open: A0 has no second context to choose between,
because its stimulus is the projection itself. Every literal byte of that stimulus therefore comes from
an artifact frozen before this round:

| Literal | Frozen source |
| --- | --- |
| canonical CAUTION proposition label | D1 `contract.ts` (`D1_PROPOSITION_LABEL`, D1 sealed) |
| P1 observation text, probe id | D1 `contract.ts` (`D1_P1`) |
| observation id | D1 `world-a1.ts` (`D1_OBSERVATION_ID`) |
| task | `null`, set by the observation commit (D1 `world-a1.ts:160`) |
| scene | the observation commit's own scene — not written here |
| credences 0.80 / 0.50 / 0.20 | `D1_STATE_LEVELS` / `D2A_STATES` |
| world construction path | production genesis materialisation + production facade (D1 frozen) |
| projection | production `buildCognitiveContextProjectionV2ForExplicitV4` |
| instrument | `buildD2StructuralReadoutRequestV0` (REV1.1b frozen contract) |

This round composed those parts; it authored nothing. Qualification fixture bytes were not used and
credences 0.95 / 0.49 / 0.06 appear nowhere in the three requests (checked in the builder, which fails
closed on their presence).

## 1. STATE ISOLATION — RE-PROVED, NOT REUSED

D1's Revision 4 allow-list was applied unchanged; **no new allowed difference class was added**.

| Pair | Raw canonical diff | Normalised diff |
| --- | --- | --- |
| HIGH vs LOW | exactly the 4 frozen paths | `["/beliefs/items/0/credence"]` |
| HIGH vs NEUTRAL | exactly the 4 frozen paths | `["/beliefs/items/0/credence"]` |
| LOW vs NEUTRAL | exactly the 4 frozen paths | `["/beliefs/items/0/credence"]` |

The three trace paths (`state_hash_before`, `state_hash_after`, `trace_id`) are **derived, not
assumed**: all three were reproduced by forward recomputation from each arm's own states and the
frozen production algorithms — `before` matches, `after` matches, `trace_id` matches, for all three
arms. Consequently the three states are identical in identity, proposition id and label, personality,
affect, relationships, memory/history, environment and instrument; the sole experimental variable is
the credence. Verdict: `D2_A0_STATE_ISOLATION_HOLDS`.

## 2. CROSS-ARM REQUEST ISOLATION (completed before the first neutral call)

Built through the real production V8 path over the three real committed states, then transformed once
each. No hand-written subject data, no belief-line patch, no scene patch, no fixture substitution, no
DecisionProbeV2 anywhere.

- System messages: **byte-identical across all three arms.** (The A0 contract is appended to the
  system message, so this is the property that matters for this transformer — and it holds.)
- User content: differs in exactly **two** lines — the belief credence line and the `[projection_hash]`
  line — which are precisely the two classes D1 REVISION 3 froze.
- After applying the frozen `normalizeArmSpecificBytes` unchanged: **one distinct normalised form**,
  byte-identical across HIGH / LOW / NEUTRAL, all three hashing to `sha256:f26f4894c64c05d3…`.

Verdict: `D2_A0_CROSS_ARM_REQUEST_ISOLATION_HOLDS`. No normalisation exception was added.

## 3. THE FROZEN REQUEST SET

| Arm | Final request hash |
| --- | --- |
| HIGH | `sha256:8c0c4ccb5fe068e2c0de803e5c33421861ee2d0dd1f89d640d4f99885d8293ac` |
| LOW | `sha256:dc6203bf73aab5e7bc95a9f67d5749070a199e59e3a6404c4e9fadab2e403e6d` |
| NEUTRAL | `sha256:9938d540e5a44882bae74ca7846c25987409f5a8170068e704753e5cc080dfc0` |

A0 contract hash `sha256:5778f97ec048110f…`; request-set manifest hash
`sha256:289b52c30923440b…`. The manifest records
`a0_characteros_outputs_seen_before_request_freeze: false`, `scheduled_high_low_replicates: "not yet
known"`, reason *waiting for neutral self-noise pilot*. From that moment no request byte changed.

## 4. THE NEUTRAL PILOT IS NOT A CORRECTNESS TEST

No authoritative contract ever froze "credence 0.50 must read as UNDECIDED", so this round did not
require it, did not pre-register it, and does not score it. The pilot measures one thing: the
endpoint's own **self-noise on six byte-identical requests**. All six calls carried the same request
hash (distinct hashes: 1), the replicate ordinal never entered the request, and no retry, replacement,
fallback or seventh call was made.

| Trial | Token | Transport | Latency |
| --- | --- | --- | --- |
| d2-a0-neutral-001 … 006 | `UNDECIDED` ×6 | OK ×6 | 587 / 382 / 698 / 458 / 614 / 581 ms |

Counts `{"UNDECIDED": 6}`; modal count 6; disagreement rate 0.000; invalid trials 0; transport
failures 0. The raw dataset was written trial-by-trial, then frozen (`scored: false`), and the counts
were derived by **re-reading those frozen bytes**, not from the in-memory array — the number that
becomes `r_confirm` is a function of the artifact that was hashed.

Applying `D2_NOISE_RULE.deterministic_mapping` (`"6" → 6`, `"5" → 14`, else `STOP`) mechanically:
**`r_confirm_A0 = 6`**. The mapping was not modified, and the modal token was not interpreted as
evidence of anything — the model happened to answer `UNDECIDED` six times, which is a fact about the
executor's stability, not about CharacterOS.

## 5. THE FROZEN HIGH/LOW SCHEDULE — NOT EXECUTED

`2r = 12` calls, 6 per arm. Ordering is a pure function of `r` alone, so the neutral modal token could
not reach it: pairs alternate `HIGH, LOW` then `LOW, HIGH` and so on —

`HIGH LOW | LOW HIGH | HIGH LOW | LOW HIGH | HIGH LOW | LOW HIGH`

Deterministic, counterbalanced, outcome-blind. Schedule hash
`sha256:20220b27bab67cd063bb121b980048c93308718b32c7e1b94370d13d7924df2d`.

**No HIGH or LOW call was made.** `d2_a0_state_experiment_not_started: true`.

## 6. EXPLICIT NON-CLAIMS

This round establishes none of the following, and the artifacts record them as `false`:

- that the canonical belief is readable — only a HIGH-vs-LOW state experiment may emit
  `STRUCTURAL_DIRECTION_LEGIBLE`, and its secondary diagnostic `STRUCTURAL_MAGNITUDE_CALIBRATED`
- that CharacterOS state is legible, that semantic uptake occurred, that cognition used the belief
- any structural-readout result whatsoever

`may_be_used_as_characteros_evidence_for_a_legibility_claim: false`. The A0 qualification artifact
remains instrument evidence only, as the previous round recorded.

## 7. ARTIFACTS

`evidence/run-001/a0-characteros-request-freeze/` — `state-manifest.json`,
`state-isolation-report.json`, `transformer-application-report.json`, `pristine-{high,low,neutral}.json`,
`final-{high,low,neutral}.json`, `request-isolation-report.json`,
`A0_CHARACTEROS_REQUEST_SET_MANIFEST.json`

`evidence/run-001/a0-neutral-pilot/` — `trial-001..006.json`, `neutral-request-hash.json`,
`pilot-dataset.json` (`scored: false`), `pilot-dataset-hash.json`
(`frozen_before_noise_calculation: true`), `pilot-counts.json`, `pilot-noise-report.json`,
`r-confirm-a0.json`, `A0_STATE_EXPERIMENT_SCHEDULE.json`, `schedule-hash.json`,
`A0_NEUTRAL_PILOT_MANIFEST.json`

No credential appears in any artifact (scanned). The transformer was extracted from
`a0-qualification.ts` into `transformer-a0.ts` so one implementation serves both rounds; the
extraction was verified behaviour-preserving — the three qualification request hashes are unchanged
(`3827e171…`, `f963c3bf…`, `f2ed1750…`) and the conformance gate re-run clean. D1 untouched
(`02bd7e31…`). `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance`
PASS.
