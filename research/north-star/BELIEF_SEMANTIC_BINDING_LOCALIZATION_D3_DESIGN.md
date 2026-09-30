# `BELIEF_SEMANTIC_BINDING_LOCALIZATION_D3` — DESIGN / PREREGISTRATION

**`D3_DESIGN_BLOCKED`** — blocked on **one specific premise**: the proposed stage D3-A tests a link
that the frozen D2-A0 instrument already tested and already met.

**`D3_MODEL_CALLS = 0`.** D1 and D2 are frozen and untouched. Nothing in this round authorises a call.

The remainder of D3 — the part that *is* informative — is fully frozen and ready:
**D3-B (paraphrase relation recognition)**. Its instrument, fixtures, answer key, schema, contract text,
transformer contract, invalid policy and noise/treatment rules are all machine-readable in
`research/experiments/belief-semantic-binding-d3/contract.ts`.

---

## 1. WHY THE DESIGN IS BLOCKED, WITH THE EVIDENCE

The brief refined link 3B into 3B1 / 3B2 / 3B3 and proposed a new stage **D3-A** for 3B1 — "does the
executor bind the canonical credence's direction to the canonical proposition itself?" Its proposed
prediction: HIGH 0.80 → supports; LOW 0.20 → opposes.

The mechanical audit puts the proposal beside the frozen D2-A0 instrument, extracting both from the
frozen modules rather than restating them:

| | Proposed D3-A | Frozen D2-A0 |
| --- | --- | --- |
| measurement target | the exact canonical proposition itself | *"the proposition shown in the belief line"* — in the state experiment, the canonical CAUTION proposition |
| predicted direction | HIGH → supports canonical proposition; LOW → opposes it | *"the HIGH modal bucket lies in the endorsing set AND the LOW modal bucket lies in the doubting set AND the two modal buckets differ"* |
| bucket meanings | SUPPORTS / UNCERTAIN / OPPOSES of that proposition | *"treats the proposition as settled in its favour and would rely on it without reservation"* / *"…as settled against it and would rely on its denial without reservation"* |
| observed result | — | HIGH 6/6 `ENDORSES_STRONGLY`; LOW 6/6 `DOUBTS_STRONGLY` |

**Same measurement target. Same predicate. Already met, unanimously, at twelve trials.** The only
difference the proposal introduces is three buckets instead of five, with renamed tokens.

A0's verdict label reads `CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE`, which sounds like a claim
about *numeric readability*. Its instrument was never that narrow: its anchors define the buckets as the
subject's stance **on the proposition**, and its frozen directional requirement is 3B1's definition
under A0's names. **The verdict name understates what the instrument measured**, and that label is
precisely what made D3-A look like new work.

Running D3-A as specified would spend a full qualification + pilot + treatment cycle (27–55 calls)
re-measuring a settled link. The brief's own restriction forbids designing an experiment that cannot say
anything new; this one could not.

**What this finding does not claim.** It does not say D3-A would return the same result if it were run —
it would presumably return something similar, which is the point. It says the result would not be new
information. If a human believes D3-A differs in measurement target rather than only in token count, that
difference needs to be stated explicitly and it would change the design.

## 2. THE REFINED CAUSAL GRAPH, CORRECTED

```
canonical_belief → projection → structural_readout → canonical_stance_binding
      → paraphrase_relation_recognition → cross_wording_stance_transfer
      → epistemic_appraisal → structured_decision
```

| link | status | stage |
| --- | --- | --- |
| 1 canonical state | established | D1, no model calls |
| 2 projection | established | D1, no model calls |
| 3A structural readout | **ESTABLISHED** | D2-A0 |
| **3B1 canonical stance binding** | **ESTABLISHED — by D2-A0, not previously recognised as such** | D2-A0 |
| 3B2 paraphrase relation recognition | UNLOCALISED | **D3-B** |
| 3B3 cross-wording stance transfer | NOT ESTABLISHED (valid null) | D2-A1, frozen, **not re-run** |
| 4 epistemic appraisal | unlocalised, not authorised | D2-B |
| 5 structured decision | D1 null | D1, frozen |

## 3. D3-B — THE STAGE THAT IS READY

A **state-blind semantic relation diagnostic**: it contains no subject state, no credence, no arm and no
A1 output, so its result is a statement about the executor's relation judgement and is **not CharacterOS
causal evidence**. Its inputs are exactly two frozen literals — the canonical CAUTION proposition and the
frozen A1 paraphrase — and its question is which relation holds between them.

Closed set, with state-blind anchors: `SEMANTICALLY_ALIGNED` (accepting one gives reason to accept the
other), `SEMANTICALLY_UNRELATED` (accepting one gives no reason either way), `SEMANTICALLY_OPPOSED`
(accepting one gives reason to reject the other). Expected relation: `SEMANTICALLY_ALIGNED`.

**One design point that must be stated so a later audit cannot mistake it for a leak:** a D3-B request is
*always allowed* to contain the canonical proposition, because that proposition is one of the two inputs
to a relation question. The "do not restate the canonical proposition" law that governed A0 and A1 is
**not applicable here**, and the contract records that explicitly.

### Qualification (frozen now — the D2 "fixture kinds only" gap is not repeated)

Three literal fixture pairs on a synthetic workshop proposition unrelated to CAUTION, with an explicit
expected-relation map:

| fixture | statement A | statement B | expected |
| --- | --- | --- | --- |
| `D3B-QF-A-ALIGNED` | A clamp should always be used when gluing a joint. | Clamping a joint while the glue sets is always the right thing to do. | `SEMANTICALLY_ALIGNED` |
| `D3B-QF-B-UNRELATED` | A clamp should always be used when gluing a joint. | The workshop's saw blade needs sharpening this month. | `SEMANTICALLY_UNRELATED` |
| `D3B-QF-C-OPPOSED` | A clamp should always be used when gluing a joint. | Clamping a joint while the glue sets does more harm than good. | `SEMANTICALLY_OPPOSED` |

9 calls (3 × 3). Rule: each fixture's modal relation must equal its pre-registered expected relation,
exactly, with no tolerance and no similarity substitution. Invalid rule: **any** invalid qualification
trial fails the qualification.

### Noise and measurement (frozen, scope-explicit)

- 6 byte-identical calls of the frozen *real* diagnostic → `r_confirm_B ∈ {6, 14}`, else
  `INCONCLUSIVE_BY_DECISION_NOISE`; any invalid → no `r` is computed.
- Measurement: `r_confirm_B` byte-identical calls. **Positive requires every one to return
  `SEMANTICALLY_ALIGNED`** — a state-blind capability claim about a single fixed question has no
  between-arm contrast to absorb noise, so a single dissenting trial means the capability is not
  reliable. Any invalid → inconclusive, never a null and never a positive.

Every scope is machine-readable and nothing is inherited by implication: qualification, noise,
measurement and invalid handling are each their own frozen object with its own `scope`.

## 4. THE CORRECTED LOCALIZATION MATRIX

3B1 being established, the matrix has no D3-A row. The informative rows cross D3-B with the frozen A1 null:

| D3-B | condition | verdict | breakpoint |
| --- | --- | --- | --- |
| null | the executor does not reliably recognise the canonical/paraphrase relation | `PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED` | canonical proposition → preregistered paraphrase relation |
| **positive** | relation recognised, A1 a valid null | **`SEMANTIC_COMPONENTS_PRESENT_BUT_CROSS_WORDING_STANCE_INTEGRATION_FAILED`** | **semantic binding / integration across wordings** |
| inconclusive | collection integrity or invalid data | `D3_B_INCONCLUSIVE_*` | — (inconclusive is not null) |

The middle row is the one that would matter: the two components are separately available — stance
binding per D2-A0, relation recognition per D3-B — yet the stance does not travel across the wording
change. That localises the A1 null to **integration**, not to numeric readability and not to basic
language understanding.

Explicitly forbidden extrapolations: global semantic unreadability, cognition use, appraisal or
behaviour claims, history internalization, and the term *cognitively inert* (still requiring A0+ / A1+ /
B-null in the D2 sense, which D2 never reached).

## 5. CLAIM BOUNDARIES

D3 answers at most **which candidate explanation of the frozen A1 null is better supported**: a
paraphrase-relation recognition problem at the measurement layer, or a cross-wording integration failure
with both components separately present. It does not answer cognition use, appraisal, behaviour, history
internalization or autonomous belief formation. Link 4 may be reconsidered only after link 3B is fully
adjudicated — and D3 alone cannot do that, because 3B3's null is already frozen and is not re-run.

## 6. DESIGN-INTEGRITY DECLARATION

D3's design was triggered **only by the fact that D2-A1 produced a valid null** — not by the specific
`LOW = 5 SUPPORTS + 1 UNCERTAIN` pattern. That pattern was not used to choose tokens, wording,
thresholds or expected directions. D3-B's fixtures use a synthetic workshop proposition unrelated to
CAUTION, their relations are unambiguous by construction, and no element of D3-B was selected to
produce, explain away, or be consistent with that count pattern. These are recorded as explicit fields
in `D3_DESIGN_INTEGRITY`, not left implicit.

## 7. CALL BUDGET

| path | calls |
| --- | --- |
| D3-B qualification fails | **9** (minimum) |
| D3-B fully run at `r_confirm_B = 6` | 9 + 6 + 6 = **21** |
| D3-B fully run at `r_confirm_B = 14` | 9 + 6 + 14 = **29** (authorised maximum) |
| **D3-A** | **0 — not authorised, subsumed by D2-A0** |
| D2-B | 0 — not authorised |

For completeness only: running D3-A despite the subsumption would cost 9 + 6 + 2r, i.e. 27–55 further
calls, for information D2-A0 already carries. Recorded, **not authorised**.

## 8. IMMUTABLE PREREGISTRATION

`research/experiments/belief-semantic-binding-d3/contract.ts` — manifest hash
`sha256:adcb3212726a9723…`, D3-B contract text `sha256:b2bbeb6a28ae6a4f…`, fixture manifest
`sha256:ffbd62411035a41d…`. The module carries the handoff, the refined graph, the subsumption audit,
the fully frozen D3-B instrument, the corrected matrix, the claim boundaries, the design-integrity
declaration and the budget, and it fails closed on any internal inconsistency (24 self-checks, all
passing at 0 calls).

The D3-B transformer is frozen **as a contract only** —
`implementation_status_at_freeze_time: "NOT YET IMPLEMENTED"` — because the D2 lesson is that a name in a
frozen contract is a specification, not a callable: the implementation and its offline conformance gate
belong to the execution round, before any call.

## 9. WHAT A HUMAN HAS TO DECIDE

1. **Authorise D3-B alone.** It is fully frozen and answers the only question D3 can still answer: is the
   frozen A1 null better explained by a paraphrase-relation recognition problem, or by a cross-wording
   integration failure with both components separately present?
2. **Or explain how D3-A would differ from D2-A0 in its measurement target** rather than only in its
   token count. If it would not, D3-A should be dropped from the design rather than run for
   confirmation.

## ARTIFACTS

`research/experiments/belief-semantic-binding-d3/evidence/run-001/preregistration/` —
`d3-preregistration-audit.json` (the side-by-side subsumption evidence, extracted from the frozen
modules, plus the D3-B integrity and leak checks), `contract-manifest.json`,
`D3_PREREGISTRATION_VERDICT.json`

D1 and D2 untouched: D1 dataset `02bd7e31…`, D2-A0 request set and dataset `eb8be177…`, D2-A1 request
set, schedule `d49962e7…` and dataset `2cacbf01…` all still recompute. No credential in any artifact.
`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS.
