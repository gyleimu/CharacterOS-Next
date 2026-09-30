# D2 REVISION 1.1d — A1 NEUTRAL INVALID POLICY + A1 CONTEXT BINDING — ROUND REPORT

**`D2_PREREGISTRATION_FINALIZED_REV1_1D`**
**`D2_A1_NEUTRAL_PILOT_AUTHORISED`**
**`D2_A1_STATE_CONTEXT_FROZEN`**
**`D2_A1_STATE_EXPERIMENT_NOT_STARTED`**
**`D2_MODEL_CALLS = 36`** — **0 calls this round.** The A1 neutral pilot was not executed.

---

## 1. WHAT WAS CLOSED

`contract-rev1-1d-a1-neutral-and-context.ts` (manifest `sha256:24e5707ad31d7381…`), superseding
exactly two things and nothing else:

```
supersedes_scope = [
  "A1 neutral pilot invalid handling",
  "A1 production-context explicit binding"
]
```

`scientific_prediction_changed: false`, `measurement_contract_changed: false`,
`revision_1_1c_manifest_hash_preserved: sha256:170a97cea01727b5…`,
`a1_model_calls_before_amendment: 9` (A1 qualification only),
`a1_neutral_calls_before_amendment: 0`, `a1_state_experiment_calls_before_amendment: 0`.

## 2. AMENDMENT 1 — THE INVALID POLICY

Six planned trial identities are fixed before the first call; one trial is one attempt; retry,
replacement, deletion, extra replicate, a seventh call and executor substitution are all forbidden.
An invalid trial (transport failure, timeout classified as a failed provider attempt, malformed output,
parser invalid, or a token outside the frozen A1 vocabulary) is **not** a stance token, and several
invalids may not be grouped as one modal category.

The sentence whose absence made `r` ambiguous is now frozen:

> the noise mapping is reachable **only** when all six scheduled trials produce legal A1 stance tokens.

Zero invalid → legal token counts, then modal token and modal_count → `6 → r = 6`, `5 → r = 14`,
`≤ 4 → INCONCLUSIVE_BY_DECISION_NOISE`. **Any** invalid → immediately
`D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS`, with no `r` computed and no HIGH/LOW run.
`planned_denominator = 6`, `valid_required_for_noise_scoring = 6`, `invalid_is_not_modal_token = true`.

Scope is explicit and narrow: **A1 neutral pilot only**, applied retroactively to nothing, not extended
to D2-B, which must use its own authoritative preregistration when reached.

## 3. AMENDMENT 2 — THE CONTEXT BINDING

Every value is **read** from an artifact frozen before this round — the D1 contract, the D1 world
builder, the A0 freeze — never re-authored:

| Element | Bound value | Frozen source |
| --- | --- | --- |
| identity | `/identity/subject_id` = `d1-belief-sensitivity-subject` | D1 `world-a1.ts :: D1_SUBJECT_ID` |
| observation probe | `D1-P1-AWAITING-INSPECTION` | D1 `contract.ts :: D1_P1` |
| observation id / committed identity | `observation:o-d1-p1-awaiting-inspection` | D1 `world-a1.ts :: D1_OBSERVATION_ID` |
| observation bytes and scene bytes | the P1 literal | D1 `contract.ts :: D1_P1.observation_text` |
| task | `null` | D1 `world-a1.ts:160` |
| environment / current context | byte-exact reuse of the A0-frozen production context | verified by rebuild, §5 |
| experimental variable | `/beliefs/items/0/credence` = 0.80 / 0.50 / 0.20 | D1 `D1_STATE_LEVELS` |
| derived bookkeeping | D1 REVISION 4 normalisation only, no new diff class | frozen |

Provenance is recorded so the choice cannot be mistaken for a post-hoc one:
`a0_results_known_before_context_binding: true` **and**
`context_selection_depended_on_a0_token_pattern: false`,
`a1_outputs_seen_before_context_binding: false`. The stimulus family is unchanged —
`observation_wording_changed: false`, `probe_swapped: false`, `new_context_added: false`,
`proposition_changed: false`, `paraphrase_changed: false`, `high_low_prediction_changed: false`.

## 4. AUDIT A — THE INVALID POLICY, PROVED BY CALLING THE FROZEN PROCEDURE

The audit calls `classifyA1NeutralPilotV0` itself rather than re-implementing it, so it cannot pass
while the shipped rule disagrees (`frozen_procedure_was_called_not_reimplemented: true`):

| Synthetic pilot | modal_count | r | invalid | pass |
| --- | --- | --- | --- | --- |
| six identical valid | 6 | **6** | 0 | yes |
| five identical + one other legal | 5 | **14** | 0 | yes |
| four identical + two other legal | 4 | null (noise STOP) | 0 | yes |
| five identical + one transport invalid | **null** | **null** | 1 | yes |
| five identical + one out-of-vocabulary token | **null** | **null** | 1 | yes |
| three identical + three invalid | null | null | 3 | yes |
| **six invalid** | **null** | **null** | 6 | yes |

`any_invalid_trial_that_yielded_an_r_value: 0`. **Six invalid trials produce `modal_count = null`, not
6** — the exact hazard the audit was written to exclude. The seventh call and a duplicate trial
identity are both refused by the procedure itself.

## 5. AUDIT B — THE CONTEXT BINDING, PROVED BY REBUILD

The three states were rebuilt offline through the frozen production path and compared against the
A0-frozen pristine requests:

| Arm | pristine request reproduces byte-for-byte | system bytes | user bytes | normalised form equal |
| --- | --- | --- | --- | --- |
| HIGH | yes | yes | yes | yes |
| LOW | yes | yes | yes | yes |
| NEUTRAL | yes | yes | yes | yes |

Cross-arm: raw state diff = the four frozen REVISION 4 paths for every pair, and after the frozen
normalisation the A0-frozen requests are **byte-identical** across all three arms.
`context_diff_after_frozen_normalisation: ["/beliefs/items/0/credence"]`,
`new_diff_classes_added: false`. Verdict `D2_A1_CONTEXT_BINDING_PROVEN`.

**One defect in a prior artifact, recorded rather than quietly worked around:** the frozen A0
`state-manifest.json` stores `identity_parity.subject_ids` as `["undefined","undefined","undefined"]`,
because that round read `state.subject_id` instead of the real `state.identity.subject_id`. It changed
no A0 result — A0's isolation was proved by `diffPathsOf` over the states and its identity came from
`D1_SUBJECT_ID` — but the identity binding here is therefore verified against `D1_SUBJECT_ID` and
`state.identity.subject_id`, not against that broken field. The defect is recorded inside the audit.

## 6. ARTIFACTS

`evidence/run-001/a1-rev11d-audit/` — `a1-invalid-policy-audit.json` (the seven synthetic cases and
the denial checks), `a1-context-binding-audit.json` (per-arm parity plus cross-arm),
`contract-rev1-1d-manifest.json`, `A1_REV11D_MANIFEST.json`

Verified after: the A0 request set, the A0 state dataset (`eb8be177…`) and the A1 qualification dataset
(`d6e446c6…`) all still recompute; D1 untouched (`02bd7e31…`). No credential appears in any artifact
(scanned). `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.

**Stopped here.** The six A1 neutral calls were not made, no A1 HIGH/LOW call was made, and D2-B was
untouched — the brief's §"Final Gate" ends at `STOP`.
