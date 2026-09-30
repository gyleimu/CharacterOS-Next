# D3 REVISION 3 — NOISE PILOT REQUEST IDENTITY — ROUND REPORT

**`D3_PREREGISTRATION_FINALIZED_REV3`**
**`D3_B_TARGET_AND_NOISE_REQUEST_IDENTITY_CONFLICT`**
**`D3_B_NON_TARGET_NOISE_PILOT_AUTHORISED`**
**`D3_B_TARGET_NOT_EXECUTED`**
**`D3_MODEL_CALLS = 9`** — **0 calls this round.** No target call, no pilot call, no D3-A call, no D2-B call.

`contract-rev3-noise-identity.ts`, manifest `sha256:07e6a52a8eec4ec3…`, preserving revision 2
(`sha256:f860575614ce180c…`).

---

## 1. THE CONFLICT, AND WHY ITS SECOND HALF IS THE DANGEROUS ONE

Revisions 1–2 defined the D3-B noise pilot as *"6 byte-identical calls of the frozen real diagnostic"* —
that is, of the **target** request: canonical CAUTION versus the frozen A1 paraphrase. That design is
internally inconsistent in two independent ways.

**Half A — identity.** The first "pilot" call would itself *be* target evidence. So
"the target request has been called" and "`D3_B_TARGET_NOT_EXECUTED`" cannot both be true; the pilot
would silently consume target trials, and the target's own trial count would be wrong.

**Half B — the unanimity interaction, which is worse.** The frozen target scorer requires **every** one
of `r_confirm_B` trials to return the expected relation. Had the six pilot calls on the target request
come back five expected plus one dissent, the unanimity positive would be **already impossible before
the target stage began** — and the mapping's `5 → r = 14` branch, whose whole purpose is to buy more
trials when the endpoint is noisy, could not restore eligibility. It would fund fourteen further calls
for a run that can no longer succeed. **Under the old design the extension branch was a formality, not a
remedy: the pilot's noise estimate could only ever disqualify the target, never repair it.**

Found at `d3_b_target_calls_before_amendment = 0` — no target call was spent discovering this, and no
pilot call either.

## 2. THE FIX: A NON-TARGET FROZEN REQUEST, CHOSEN OUTCOME-BLIND

No fourth fixture was written. The noise request is selected from the **already frozen** qualification
manifest by a rule that is a pure function of that manifest:

> `noise_fixture_id = qualification_fixture_manifest[0]`, equivalently the lexicographically smallest
> frozen `fixture_id`

Both formulations were checked and **agree**: `D3B-QF-A-ALIGNED`. They are recorded together so neither
can be argued about later. The rule reads no qualification output, no modal token, no correctness signal,
no latency, no provider metadata and no target output.

**The request is reused, never re-rendered.** The audit proves this rather than declaring it:

| check | result |
| --- | --- |
| selected fixture existed in the frozen manifest | yes |
| recomputed request hash equals the recorded qualification hash | `sha256:82a8678e044fd802…` — equal |
| the frozen request ends with the rendered contract for that pair | yes |
| a fresh render of the same pair reproduces the frozen contract section | yes |
| re-rendered at pilot time | **false** |
| statement pair modified | **false** |

The fresh-render check matters: it shows that even if someone re-rendered, the bytes would be the same —
so "reuse" is verifiable, not merely promised.

**Containment, verified on the frozen bytes:** the noise request contains no canonical CAUTION, no target
paraphrase, no A1 token, no arm label, no credence, no belief line in its subject data, and is not the
target request. Contaminating fields: none.

## 3. WHAT THE PILOT MEASURES — AND THE LIMITATION IT ACCEPTS

It measures **instrument-level identical-request self-noise on one preregistered synthetic non-target
relation request**. It does not measure the canonical/paraphrase relation, target-specific difficulty,
CharacterOS state or cross-wording transfer. Its sole use is to choose the target replicate count through
the frozen mapping.

**The residual limitation is recorded rather than hidden:** the calibration is now *instrument-level*
rather than *target-specific*, so a target whose difficulty differs from the synthetic fixture could
carry different noise. That is accepted because the alternative — calibrating on the target — both
consumes the target's trials and can pre-empt its unanimity requirement. What still makes the estimate
meaningful is what the pilot and the target share: the same executor, the same measurement contract, the
same three-token closed set and the same request shape. Only the two statements differ.

## 4. PRESERVED, WITH THE NOISE RULE UNCHANGED

Target pair, expected target relation, vocabulary, anchors, transformer, qualification result, target
scorer, unanimity requirement, the `6 → 6 / 5 → 14 / ≤ 4 → STOP` mapping, the unique-modal definition,
the tie verdict `D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED` and all D1/D2 evidence are untouched — all
recorded as explicit `*_changed: false` fields. **Only the noise pilot's request identity changed.**

## 5. BUDGET, WITH THE TARGET'S EXACT PLANNED COUNT

The brief's §9 asked for a mechanical re-check of the target call count, on the ground that D3-B has no
HIGH/LOW arms:

> **target formula = `r_confirm_B`, i.e. exactly 6 or exactly 14 — *not* `2r`.**

Re-checking revision 1's budget shows it **already** used `r`: `d3b_formula: "r_confirm_B"` with an
authorised maximum of 29 = 9 + 6 + 14. So the budget is unchanged by this revision and
`budget_changed_by_this_revision: false` — the mechanical re-check confirmed the frozen value rather than
correcting it. Totals: qualification 9 (done) + noise 6 + target r → **21 minimum, 29 maximum**. D3-A 0,
D2-B 0.

## 6. TARGET ISOLATION

`target_calls_before_noise_pilot = 0`; the pilot will make **0** target calls; noise trials may not enter
the target counts, the target unanimity scorer, the target dataset hash or the target scientific verdict.
The two evidence sets are fully separated, and the target remains the only source of target evidence.
`D3_B_TARGET_NOT_EXECUTED` stays a true fact on both sides of the pilot.

## 7. ARTIFACTS

`evidence/run-001/rev3/` — `d3-rev3-audit.json` (selection, request identity, containment, conflict and
isolation), `contract-rev3-manifest.json`, `D3_REV3_VERDICT.json`

Verified after: the D3-B qualification dataset (`04f232f3…`), fixture A's frozen request (`82a8678e…`),
D2-A0 (`eb8be177…`), D2-A1 (`2cacbf01…`) and D1 (`02bd7e31…`) all still recompute. No credential in any
artifact. `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.

**Stopped here.** The next round may only: run the 6-call non-target noise pilot on the frozen noise
request, freeze its dataset before scoring, classify with the frozen noise classifier, and — if it
authorises — freeze the target schedule. It may not call the D3-B target request, execute D3-A, execute
D2-B, or modify any frozen artifact.
