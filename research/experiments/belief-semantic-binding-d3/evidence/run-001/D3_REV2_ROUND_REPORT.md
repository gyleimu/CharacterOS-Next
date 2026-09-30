# D3 REVISION 2 — D3-A REMOVED, D3-B-ONLY DESIGN FROZEN — ROUND REPORT

**`D3_PREREGISTRATION_FINALIZED`**
**`D3_A_REDUNDANT_WITH_D2_A0`**
**`D3_B_QUALIFICATION_AUTHORISED`**
**`D3_B_TARGET_NOT_EXECUTED`**
**`D3_MODEL_CALLS = 0`** — this round made no calls, and no D3-A call may be made in any future round.

`contract-rev2-d3b-only.ts`, manifest `sha256:f860575614ce180c…`, preserving the revision-1 manifest
hash `sha256:adcb3212726a9723…`.

---

## 1. THE REDUNDANCY, RE-DERIVED FROM THE FROZEN MODULES

The audit does not assert the finding; it reads the frozen D2 modules and the frozen A0 dataset and
recomputes the conclusion:

| extracted from the frozen artifacts | value |
| --- | --- |
| A0 measurement target | *"the subject's stance on the proposition shown in the belief line"* |
| A0 primary criterion | *"the HIGH modal bucket lies in the endorsing set AND the LOW modal bucket lies in the doubting set AND the two modal buckets differ"* |
| A0 vocabulary size | 5 |
| A0 observed | HIGH `{"ENDORSES_STRONGLY": 6}`; LOW `{"DOUBTS_STRONGLY": 6}` |
| A0 dataset hash | recomputed and matched to `sha256:eb8be177c7954147…` |
| criterion already met | **true** |

Against which the proposed D3-A would add **"three buckets with different names, and nothing else."**
Verdict `D3_A_REDUNDANT_WITH_D2_A0`, D3-A execution path deleted, `d3a_calls_authorised: 0`.

The removal is recorded as `d3_a_removed_because_redundant: true` and
`d3_a_removed_due_to_outcome: false` — the stage is deleted because it cannot produce new information,
not because anything about D3 came out a particular way.

## 2. THE CORRECTED GRAPH

```
canonical_belief → production_projection → canonical_proposition_stance_binding
  → canonical_paraphrase_relation_recognition → cross_wording_stance_transfer
  → epistemic_appraisal → structured_decision
```

| link | status |
| --- | --- |
| 1 canonical state | established by D1 offline production-state evidence |
| 2 production projection | established by D1 production-projection evidence |
| **3B1 canonical proposition stance binding** | **ESTABLISHED BY D2-A0 — do not retest** |
| 3B2 canonical/paraphrase relation recognition | **UNTESTED — D3-B** |
| 3B3 cross-wording stance transfer | not established, by the frozen D2-A1 valid null — do not re-run |
| 4 epistemic appraisal | **not authorised** (D2-B locked) |
| 5 structured decision | D1 null remains frozen |

D3 tests exactly one link, 3B2.

## 3. D3-B: ROLE, VOCABULARY, AND WHAT IT IS NOT

A **state-blind executor capability diagnostic**. Its inputs are only two frozen expressions — the
canonical CAUTION proposition and the frozen A1 paraphrase. It must not contain a subject state, a
credence, an arm label, A1 outputs, D1 outputs or a behaviour endpoint. **It is not CharacterOS causal
evidence**: it checks only whether the executor can identify the semantic relation between those two
literal texts in a direct relation task.

Vocabulary unchanged: `SEMANTICALLY_ALIGNED` / `SEMANTICALLY_UNRELATED` / `SEMANTICALLY_OPPOSED`, target
pair unchanged, no new paraphrase, and the design did not use the specific
`LOW = 5 SUPPORTS + 1 UNCERTAIN` pattern.

## 4. THE GAP I FOUND IN MY OWN REVISION 1, AND CLOSED HERE

Revision 1 froze the D3-B pilot's mapping (`6 → 6`, `5 → 14`, `≤ 4 → STOP`) and the six-valid
precondition, but **never said in so many words what the counted quantity is** — the same class of
omission that stopped the D2 A1 pilot, where the mapping's keys were bare counts and the rule never
supplied their definition.

Closed at zero calls, before any D3-B call exists:

> **modal_count** = the number of the six valid pilot trials carrying the single most frequent relation
> token.

And the tie case, which a bare count cannot express: with a tie at the top there is **no unique modal
token**, so the mapping has no defined input → `D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED`. A tie may not
be resolved permissively. Six invalid trials can never yield `modal_count = 6`.

## 5. EXECUTABILITY AUDIT — WHAT THE NEXT ROUND MUST CLOSE

Every D3-B rule, classified by whether the **decision** is frozen and whether an **executable form**
exists:

| rule | decision frozen | executable form | blocking |
| --- | --- | --- | --- |
| qualification fixtures + expected-relation map | yes | **yes** (literal bytes + explicit map) | no |
| qualification rule + invalid policy | yes | no | no |
| transformer contract | yes | no | no |
| pilot noise mapping + modal-count definition | yes | no | no |
| measurement rule (unanimity) + invalid handling | yes | no | no |
| call budget | yes | **yes** (frozen integers) | no |

**0 decisions missing, 4 implementations pending, 0 blocking gaps.** The distinction this table exists
to make, learned the hard way in D2: *a frozen decision whose implementation is pending is closed by the
next round's offline step; a missing decision is a preregistration gap and stops that round before any
call.* Nothing here is a missing decision.

## 6. THE INTERPRETATION MATRIX, CORRECTED

- **D3-B valid positive** → `PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED`, and combined with the frozen
  evidence the statement is
  **`SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED`**.
  The earlier wording — `..._INTEGRATION_FAILED` — is **forbidden as an unconditional mechanism
  verdict**: an integration failure is one explanation of the pattern, not something this design can
  observe. It may appear in discussion only when explicitly labelled a hypothesis or architectural
  interpretation.
- **D3-B valid null** → `PREREGISTERED_PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED`; the A1 null may
  **not** be further attributed to cross-wording integration. Strongest permitted conclusion: stance
  binding is established, relation recognition for the preregistered paraphrase was not established in
  the direct diagnostic, and A1 cross-wording transfer was also not established.
- **D3-B inconclusive** → produces **no** new localisation verdict; the D2-A1 valid null is retained and
  the diagnostic is marked inconclusive.

## 7. D2-B REMAINS LOCKED, ABSOLUTELY

`d2_b_authorised: false`, `even_if_d3_b_is_positive: true`. D2's frozen sequential rule authorises B only
after an A1 **positive**; the frozen A1 result is a valid null, and **a D3-B positive cannot substitute
for an A1 positive**. `any_result_of_d3_reopens_link_4: false`. D2 remains permanently stopped at A1.
Link 4 is not reopened by any outcome of D3.

## 8. ARTIFACTS

`research/experiments/belief-semantic-binding-d3/contract-rev2-d3b-only.ts` and
`evidence/run-001/rev2/` — `d3-rev2-audit.json` (the re-derived redundancy finding, the executability
table, and the unchanged-element checks), `contract-rev2-manifest.json`, `D3_REV2_VERDICT.json`

Verified after: the D3-B contract text is byte-identical to revision 1 (`b2bbeb6a…`), its fixture
manifest and anchors unchanged, the target pair still the canonical proposition and the frozen
paraphrase, and no fixture carries the CAUTION wording. D1 (`02bd7e31…`) and D2 (A0 request set and
dataset `eb8be177…`, A1 request set, schedule `d49962e7…`, dataset `2cacbf01…`) all still recompute.
No credential in any artifact. `tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean;
`pnpm governance` PASS.

**Stopped here.** The next round may only: implement the D3-B transformer and the three frozen scorers,
run their conformance gates at **zero** calls, freeze the implementation hashes, then run D3-B
qualification. It may not execute a D3-A call, re-run D1 or D2, execute D2-B, or modify any frozen
artifact.
