# D4-C0a NOISE/STABILITY GATE — EXECUTION ROUND REPORT

**`D4_C0A_NOISE_STABILITY_GATE_PASS`**
**`r_confirm_C0A = 6`**
**`D4_C0A_TARGET_EXECUTION_AUTHORISED`**
**`D4_C0A_TARGET_NOT_EXECUTED`** · `D4_C0B_NOT_PREREGISTERED` · `LINK_4_REMAINS_LOCKED` · `CHARACTEROS_UNMODIFIED`
**`D4_MODEL_CALLS_THIS_ROUND = 6`** (exactly six: no retry, no replacement, no seventh call) · **cumulative `D4_MODEL_CALLS = 15`** · **target calls 0**.

---

## 1. EXECUTION STATUS

The six frozen noise calls ran in the frozen order and the gate PASSED. The dataset was frozen before
classification, the frozen classifier was **called** rather than re-implemented, and the target plan was
frozen and left unexecuted.

## 2. FROZEN NOISE REQUEST IDENTITY

`D4C0A-QF-A-SUPPORT-TRANSFER`, hash `sha256:f425b1425d3258ff2d8ab841da69a4e9e06c9b64257ef6fbcef9928154956e3e`.
Verified before the first call: the hash equals the revision-3/4 frozen identity **and** the
qualification-era artifact **and** the recorded implementation-manifest value, and a deterministic rebuild
reproduces the same bytes. The bytes came from the frozen qualification artifact — nothing was re-rendered.

## 3. FROZEN SCHEDULE IDENTITY

`sha256:00ebd3d10635091c908c02eca1b38f41da4067ddd506e0dfb81846cda719961f`, recomputed from the file's
bytes and equal to the recorded value. Planned trials 6, identities exactly `NOISE-001..006`, positions
1…6, duplicate 0, missing 0, extra 0, **one distinct request hash across all six**. Schedule not rebuilt at
runtime.

## 4. PRIOR QUALIFICATION EXPOSURE

The same request was called **3 times** during qualification. Those calls belong only to qualification
evidence: they do **not** enter this dataset, do **not** enter the stability count, do **not** alter the
denominator, and are **not** target evidence. The old three were **not** merged with the new six — the
denominator was 6 new calls. `prior_qualification_calls_included: false` is recorded in the dataset itself.

## 5. THE SIX TRIAL OUTCOMES

| # | trial | token | ms |
| --- | --- | --- | --- |
| 1 | `NOISE-001` | `SUPPORTS_B` | 927 |
| 2 | `NOISE-002` | `SUPPORTS_B` | 864 |
| 3 | `NOISE-003` | `SUPPORTS_B` | 748 |
| 4 | `NOISE-004` | `SUPPORTS_B` | 629 |
| 5 | `NOISE-005` | `SUPPORTS_B` | 729 |
| 6 | `NOISE-006` | `SUPPORTS_B` | 844 |

**`NOISE-006` ran even though the first five already agreed** — no interim interpretation, no early stop.
Executor unchanged from qualification: DeepSeek `deepseek-flash`, temperature 0, 256 output tokens,
thinking disabled, same transport, no fallback.

## 6. COLLECTION INTEGRITY

Planned 6, records 6, duplicate identities 0, missing 0, extra 0, **all request hashes exact**,
**target request hash present: 0**. No integrity path was entered.

## 7. INVALID / TRANSPORT FAILURES

**0 invalid, 0 transport failures.** One distinct request hash across the six records.

## 8. STABILITY PATTERN

All six tokens identical, unique modal `SUPPORTS_B` with count **6**, no tie.

## 9. FROZEN CLASSIFIER OUTPUT

`classifyD4C0ANoiseStabilityV0` was called on the re-read frozen dataset bytes:
outcome **PASS**, `gate_verdict: D4C0A_STABILITY_GATE_PASS`, `invalid_count: 0`, `integrity_ok: true`,
`scientific_stability_scoring_executed: true`, `target_authorised: true`, `r_after_the_gate: 6`,
`r_changed_by_the_gate: false`.

## 10. CORRECTNESS-VS-STABILITY SEPARATION

The modal **happens** to equal the fixture's expected token (`noise_modal_matches_fixture_expected: true`),
and the classifier records `modal_token_identity_used_as_a_pass_condition: **false**`. The identity is
descriptive metadata; the gate's output does not depend on it. This matters because the demonstration in
the implementation round was built on the *other* two tokens — six identical `OPPOSES_B` and six identical
`UNCERTAIN_B` rows both PASS — so the separation is a property of the gate, not an accident of this
outcome.

## 11. TARGET AUTHORISATION

`D4_C0A_TARGET_EXECUTION_AUTHORISED`. The authorisation comes from the frozen procedural rule — PASS
authorises, every other reachable outcome does not — and from nothing about which token appeared.

## 12. TARGET CALL COUNT

**0.** No SUPPORT call, no OPPOSE call. The frozen target plan is 12 calls (6 per arm) and was **not**
executed.

## 13. THE FROZEN TARGET PLAN (12 CALLS, UNEXECUTED)

- SUPPORT request `sha256:0bad19fc3cd612db…`, OPPOSE request `sha256:bd195ef5ac12da28…`
- schedule `sha256:d85ffc134a2e2a4c…`, 12 trials, **6 SUPPORT / 6 OPPOSE**
- ordering is a **pure function of the planned count** (pairs alternate arms) and did not depend on the
  noise modal token identity, the noise counts, qualification outputs, latency, the timestamp or human
  choice
- **treatment isolation re-verified on the target pair** while nothing was called: system messages
  identical, user content differing on **exactly one line**, byte-identical after the frozen sentinel
  normalisation, with no replicate ordinal or schedule identity in the model-facing bytes

## 14. DATASET HASH

`D4_C0A_NOISE_DATASET_SHA256` — frozen with `scored: false` before classification and independently
recomputed from the file's bytes.

## 15. MODEL CALLS

6 this round; **15 cumulative** (9 qualification + 6 noise); target 0.

## 16. CHARACTEROS MODIFICATION STATUS

**Unmodified.** `git status packages/` is empty; no belief storage, projection, prompt, proposition
identity, semantic ID, relation graph, embedding or extra model pass was touched. No credential appears in
any artifact.

## 17. LINK 4 LOCK STATUS

**Locked.** `link_4_reopened: false`. Nothing in this round touches link 4, and C0b remains
`D4_C0B_NOT_PREREGISTERED`.

## 18. EXPLICIT NON-CLAIMS

The gate says **nothing** about composition, treatment sensitivity or the target. The six identical tokens
are **not** evidence about `SUPPORTS_B` or `OPPOSES_B` transfer — they are a statement about the
measurement path's self-consistency on one fixed non-target input. No CharacterOS claim of any kind is
made, and no claim about what the 12-call target run will show.

## 19. ARTIFACTS

`evidence/d4-c0a-noise-execution/` — `pre-execution-identity-audit.json`, `trial-001..006.json`,
`collection-integrity-report.json`, `D4_C0A_NOISE_DATASET.json` (`scored: false`),
`d4-c0a-noise-dataset-hash.json`, `frozen-noise-classifier-output.json`,
`target-treatment-isolation.json`, `D4_C0A_TARGET_SCHEDULE.json`, `d4-c0a-target-schedule-hash.json`,
`D4_C0A_NOISE_EXECUTION_MANIFEST.json`

Prior evidence recomputes (D4-C0a qualification `e41b2f49…`, D3-B target `8fee6b26…`, D2-A0
`eb8be177…`). `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance`
PASS.

**Stopped here.** The next round may only execute the 12 frozen target calls, freeze the dataset before
scoring, and classify with `scoreD4C0ARev1V0`. It may not run C0b, change `r`, add adaptive replication,
modify CharacterOS, or modify the classifier or the scorers.
