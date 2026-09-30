# D3-B TARGET — ROUND REPORT

**`D3_B_TARGET_EXECUTED`**
**`PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED`** — the frozen unanimity criterion is met
**`SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED`**
**`D2_B_STILL_LOCKED`**
**D3_MODEL_CALLS = 21** (6 this round: exactly six, no retry, no replacement, no seventh call).

---

## 1. CORRECTED TARGET REQUEST IDENTITY

**One honest note about how the frozen request was read.** Revision 5 froze the corrected target's *hash*
and its *derivation* but did not store the bytes as an artifact. This runner therefore reconstructed the
request from exactly those frozen pieces — the production base with the belief block removed by the
D1-frozen `stripBeliefBlockV0`, the frozen statement pair, the frozen transformer — and asserted the hash
**before** using it, then persisted the bytes. The frozen identity is the hash; a reconstruction that did
not reproduce it would have stopped the run. It did: `sha256:27fe6b992b1d5b43…`.

Pre-execution identity gate, all holding: uses the frozen state-blind base; no CharacterOS belief block;
no credence; no HIGH/LOW/NEUTRAL; no subject-state treatment; no A1 experimental output; canonical CAUTION
appears **exactly once**, owned by STATEMENT A; the frozen paraphrase appears **exactly once**, owned by
STATEMENT B; schema exact; anchors exact; transformer source hash unchanged (`9daa5521…`); contract hash
unchanged; contract present exactly once.

## 2. OLD INVALID TARGET ARTIFACT STATUS

`sha256:70f69a1f…` was **never loaded, never verified against and never called** — it remains marked
`INVALID_FOR_EXECUTION_BY_STATE_BLINDNESS_CONTRACT`, its schedule untouched on disk, and the executable
schedule contains **0** references to it.

## 3. FROZEN TARGET PAIR

STATEMENT A: *"Caution is warranted when the conclusion rests on information I have not seen myself."*
STATEMENT B: *"the view that a finding depending mainly on secondhand report is to be held with reserve"*
Expected relation: `SEMANTICALLY_ALIGNED`. Neither reworded.

## 4. SCHEDULE AND COLLECTION INTEGRITY

Schedule verified, not rebuilt: identities `TARGET-001..006` matching exactly, positions 1…6, duplicate 0,
missing 0, every entry referencing the corrected hash, old invalid hash in executable entries **0**.

Collection: planned 6, records 6, duplicate 0, missing 0, extra 0, every record referencing the corrected
hash, invalid **0**, transport failures **0**, frozen ordering preserved.

## 5. THE SIX TRIALS

| # | trial | relation | ms |
| --- | --- | --- | --- |
| 1 | `TARGET-001` | `SEMANTICALLY_ALIGNED` | 696 |
| 2 | `TARGET-002` | `SEMANTICALLY_ALIGNED` | 433 |
| 3 | `TARGET-003` | `SEMANTICALLY_ALIGNED` | 658 |
| 4 | `TARGET-004` | `SEMANTICALLY_ALIGNED` | 748 |
| 5 | `TARGET-005` | `SEMANTICALLY_ALIGNED` | 499 |
| 6 | `TARGET-006` | `SEMANTICALLY_ALIGNED` | 564 |

One distinct request hash across the six; executor unchanged (DeepSeek `deepseek-flash`, temperature 0,
256 output tokens, thinking disabled, same transport, no fallback). The sixth call was executed even
though the first five already agreed — no interim interpretation, no early stop.

The dataset was written with `scored: false` and hashed **first**
(`sha256:8fee6b2655db6638…`, independently recomputed from the file's bytes), and only then was the frozen
`scoreD3BTargetV0` **called** — never re-implemented, and the six tokens were never read by hand first.

## 6. FROZEN SCORER OUTPUT

Counts `{"SEMANTICALLY_ALIGNED": 6}` → outcome class **POSITIVE**,
verdict `PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED`, `invalid_count` 0, scientific scoring executed,
`may_not_reopen_link_4: true`.

## 7. D3-B SCIENTIFIC VERDICT

Under the preregistered direct **state-blind** relation diagnostic, the executor consistently recognized
the canonical CAUTION proposition and the frozen A1 paraphrase as semantically aligned — 6 of 6, on a
request carrying no subject state, no credence and no arm.

## 8. COMBINED D2-A0 / D3-B / D2-A1 LOCALIZATION

**`SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED`**

| component | status |
| --- | --- |
| D2-A0 — canonical credence → canonical proposition stance binding | **ESTABLISHED** |
| D3-B — canonical proposition ↔ frozen paraphrase direct relation recognition | **ESTABLISHED** |
| D2-A1 — cross-wording stance transfer | **NOT ESTABLISHED** (frozen valid null) |

Stated in full: *canonical proposition stance binding and direct canonical↔paraphrase relation recognition
were separately established, while the frozen A1 cross-wording stance-transfer experiment remained a valid
null.*

**What this does not say.** It is **not** an observation that an internal integration mechanism failed; an
integration failure is one explanation of the pattern and stays an **architectural hypothesis**, never an
observational verdict. It is not proof of semantic integration failure, not a licence to reopen D2-B or
link 4, and not a claim about CharacterOS cognition or appraisal.

## 9. D2-B LOCK STATUS

`d2_b_authorised: false`, `link_4_reopened: false`. D2's frozen sequential rule authorises B only after an
A1 **positive**; the frozen A1 result is a valid null, and **a D3 result — including this positive —
cannot substitute for it**. The lock reason is recorded in the combined verdict itself, not just implied.

## 10. ARTIFACTS

`evidence/run-001/d3-b-target/` — `pre-execution-target-audit.json`, `target-schedule-verification.json`,
`target-request.json`, `trial-001..006.json`, `collection-integrity-report.json`,
`target-dataset.json` (`scored: false`), `target-dataset-hash.json`, `relation-counts.json`,
`target-scorer-output.json`, `d3-b-scientific-verdict.json`, `combined-localization-verdict.json`,
`D3_B_TARGET_MANIFEST.json`

Verified after: the target dataset (`8fee6b26…`), the noise dataset (`493156e3…`), the qualification
dataset (`04f232f3…`), the old invalid schedule (still present and untouched), D2-A0 (`eb8be177…`), D2-A1
(`2cacbf01…`) and D1 (`02bd7e31…`) all still recompute. No credential in any artifact. `tsc -p
tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.

**One check had to be made falsifiable again:** two identity assertions were rejected by TypeScript as
having no possible overlap — the compiler proving they could not fail. They were widened to `string`, and a
new check was added that the corrected and invalid hash constants differ, so an accidental re-pointing of a
constant would fail loudly instead of silently passing.

**Stopped here.** D3 is complete through link 3B. Link 4 remains unauthorised, and no result of D3 reopens
it.
