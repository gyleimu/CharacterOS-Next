# `D4-C0A` — STATE-BLIND EXPLICIT-STANCE COMPOSITION BASELINE — PREREGISTRATION

**`D4_C0A_PREREGISTRATION_READY`**
**`D4_C0B_NOT_PREREGISTERED`** · **`LINK_4_REMAINS_LOCKED`** · **`CHARACTEROS_UNMODIFIED`**
**`MODEL_CALLS_THIS_ROUND = 0`** · 0 production changes.

Immutable contract: `research/experiments/belief-cross-expression-d4/contract.ts`, manifest
`sha256:5bac6aa45dc5c3c9…`.

---

## 1. THE ONE QUESTION

> With CharacterOS entirely absent, and with proposition A, a semantically aligned proposition B, the
> relation between them, and the subject's **explicit stance** toward A all supplied, can the frozen
> executor project that stance onto B — `stance(A) + aligned(A,B) → stance(B)`?

Evidence class `EXECUTOR_STATE_BLIND_CAPABILITY`. **Not** CharacterOS causal evidence.

**Why it is the right next call.** D2-A0 established `credence → canonical proposition stance`; D3-B
established `canonical ↔ paraphrase relation recognition`; D2-A1's cross-wording transfer is a valid
null. Nothing yet answers whether this executor can perform the composition **at all** when everything it
needs is handed to it. If it cannot, the A1 null is at least largely an executor-level limitation and
CharacterOS representation must not be blamed. **C0a exists mainly to test whether `H_EXEC_COMPOSITION`
alone explains the A1 null.**

## 2. COMPETING EXPLANATIONS, KEPT

| id | claim | after C0a |
| --- | --- | --- |
| `H_CHAR_BINDING` | CharacterOS representation or executor-facing binding blocks cross-wording use of the stance | not decided by C0a; C0a can only remove it as the *sole* explanation |
| `H_EXEC_COMPOSITION` | the executor does not stably compose even when every fact is explicit | **this is what C0a tests** |
| `H_MEASUREMENT_FRAME` | A1's framing induced a local-wording reading | partially separable: C0a removes the A1 framing entirely |

**Permitted wording:** *projection information-loss hypothesis strongly weakened*.
**Forbidden wording:** *projection/interface hypothesis eliminated*, *projection is not the problem* — the
only conclusion drawn from the direct-copy finding is that the production projection does not *lose*
information, while executor-facing framing, placement and surrounding instructions remain an open
interface hypothesis that C0a does not touch.

## 3. THE REQUEST IS STATE-BLIND BY CONSTRUCTION

The contract's base is a **deliberate departure from the D2/D3 convention, frozen here**: D2/D3
transformers took a pristine *production* request because those instruments measured production reading;
C0a's construct requires the production frame to be **absent**, so its base is a frozen minimal research
frame.

Mechanically verified (`state-blindness-report.json`, 14 forbidden substrings checked):
**zero hits.** No `CharacterOS`, no belief block, no `proposition_id`, no `credence`, no
`projection_hash`, no `HIGH`/`LOW`, no A1 token. The frozen pair appears — it is the stimulus — and
nothing CharacterOS-specific does.

The frozen stimulus: A = *"Caution is warranted when the conclusion rests on information I have not seen
myself."*, B = *"the view that a finding depending mainly on secondhand report is to be held with
reserve"*, relation supplied as an **input** (`A and B express the same underlying view.`), and
`SUBJECT STANCE TOWARD A: SUPPORTS | OPPOSES`.

## 4. TWO ARMS, WITH PROVEN ISOLATION

**Both arms are required**: a single-arm positive cannot show the output is sensitive to the stance
intervention, because a constant answer would look positive in whichever arm matched it.

Isolation is proven in `treatment-isolation-report.json`: the two arms differ on **exactly one line** —
`SUBJECT STANCE TOWARD A: SUPPORTS` versus `… OPPOSES` — and after the frozen normalisation (replace that
one value with the sentinel `__D4C0A_STANCE__`) the requests are **byte-identical**, with exactly one
replacement per arm. No arm label, request hash, expected token, replicate ordinal or schedule
information appears in the model-facing bytes.

## 5. THE CONTRACT REMOVES A1'S AMBIGUITY

A1's frozen contract contained two clauses pulling opposite ways (*"may word the same idea differently"*
and *"the stance to report is the stance toward **THIS** wording"*). C0a's contract carries **neither** —
verified mechanically: `invites_equivalence: false`, `binds_to_this_wording: false`,
`copy_instruction: false`. It states where the stance belongs (the underlying view A expresses), what the
relation line means, and what to report; it never states the mapping and never writes the expected token
into the instruction.

**A calibration decision, frozen so its consequence is not discovered later.** Because the contract lays
out the task's *structure* explicitly, the two outcomes are deliberately **asymmetric**: a **null is very
strong** (failing even with the structure spelled out is decisive), while a **positive is deliberately
weak** (it shows the executor *can* compose when told, not that it composes spontaneously). A C0a
positive may therefore **never** be reported as evidence of unaided cross-expression composition. For a
baseline whose job is to rule out the simplest executor-level explanation, that is the right asymmetry.
It is **not** a prompt rescue: a rescue modifies the CharacterOS request to make it succeed, whereas C0a
is a different, state-blind task that modifies no CharacterOS artifact.

## 6. INSTRUMENT QUALIFICATION

Three state-blind synthetic fixtures (clamp/workshop topic, unrelated to CAUTION), each 3 replicates = 9
calls, covering all three tokens exactly once, **including an internal negative control**: an *unrelated*
pair where no transfer is defined, so the instrument must be able to express `UNCERTAIN_B`. No fixture
uses the CAUTION wording or the frozen A/B pair (verified). Rule: each fixture's modal must equal its
pre-registered expected token, exactly; **any** invalid trial fails qualification. Qualification proves
only that the instrument can express the three tokens — it is not composition evidence.

## 7. NOISE / STABILITY — DERIVED FROM THE SCORER, WITH A PROVABLE COMPATIBILITY ARGUMENT

The scorer is **per-arm unique modal + between-arm contrast** — neither a proportion endpoint (D1) nor a
unanimity endpoint (D2-A1/D3-B), so neither of those noise designs transfers.

**The compatibility argument, stated so it can be checked: the gate has exactly two reachable outcomes —
PASS and STOP — and NO BRANCH THAT SETS A SAMPLE SIZE.** There is therefore no function from the noise
result to `r`; `r` is a frozen constant identical on every path (`reachable_r_values: [6]`,
`sample_size_branches: 0`). The D2 failure mode — a `5 → r = 14` branch paired with a unanimity scorer,
where buying trials *raised* the bar — is not merely avoided but **inexpressible** here.

The gate runs 6 byte-identical calls of one frozen **non-target** qualification fixture (the D3 REV3
lesson applied prospectively: the gate must not consume treatment trials), and passes only if all six
agree with each other. It is on **agreement, not correctness** — the token need not match the fixture's
expected token, because agreement is the executor's property and correctness belongs to qualification.

## 8. THE SCIENTIFIC SCORER

Positive requires all three: `ARM_SUPPORT` unique modal = `SUPPORTS_B`, `ARM_OPPOSE` unique modal =
`OPPOSES_B`, and the two modals differ. A tie at the top of an arm means there is no unique modal, and the
criterion **fails closed to NULL**. Called on ten synthetic vectors, the frozen function rejects every
forbidden pattern — a constant answer (both `SUPPORTS_B`, both `OPPOSES_B`, both `UNCERTAIN_B`), the
**reversed** direction, and a tied arm — while one invalid and an integrity failure both yield
INCONCLUSIVE with **no scientific scoring executed**. **A reversed direction is a NULL, not an
"effect in the opposite direction".**

## 9. BUDGET — DERIVED, NOT INHERITED

1. The criterion is a per-arm unique modal **plus** a between-arm contrast, so both arms must be measured.
2. Therefore **target = 2r**, with `r` per arm — `r` is not the total.
3. **`r = 6`**, because at `r = 6` the criterion tolerates **up to two deviating trials** without losing
   modal uniqueness (6-0, 5-1 and 4-2 all leave a unique modal; only 3-3 ties) — confirmed by the
   `two_deviations_modal_still_unique` case.
4. No r-extension branch exists, so the derivation stops at the smallest `r` that survives a two-trial
   deviation.

**Total: 9 qualification + 6 gate + 12 target = 27.** The number is a *consequence* of the frozen scorer,
qualification rule and gate shape; it was not assumed and then justified.

## 10. RESULT SEMANTICS

| outcome | output | means | does **not** mean |
| --- | --- | --- | --- |
| **C0a POSITIVE** | `EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED` | in an explicit-stance, explicit-relation state-blind setting, the executor carries the stance onto an aligned re-wording in the preregistered direction | **CharacterOS is at fault**; the projection or prompt is wrong; that the executor composes unaided |
| **C0a VALID NULL** | `EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_NOT_ESTABLISHED` | even with CharacterOS removed and both the relation and the stance explicit, the composition did not occur stably in the preregistered direction → **`CharacterOS architecture modification NOT AUTHORISED BY THIS LINE`** | that a stronger prompt should be tried; that a re-run with friendlier wording is warranted |
| **C0a INCONCLUSIVE** | `D4C0A_INCONCLUSIVE_*` | nothing is localized | that it is a null; that a re-run to force a result is warranted |

## 11. ARCHITECTURE GATE (unchanged, now with a first condition that can actually be met)

CharacterOS belief architecture **may not be modified**. Minimum requirements:

1. **D4-C0a positive**;
2. a later comparator shows the **same** executor, the **same** proposition pair and equivalent stance
   information positive on a state-blind representation;
3. the CharacterOS-representation counterpart remains a valid null;
4. the information difference between the two requests is **enumerated item by item**.

Until then semantic IDs, embeddings, proposition graphs, relation propagation, extra model passes, prompt
rescues and projection rewrites are **HYPOTHESES / CANDIDATES ONLY**.

## 12. `D4_C0B_NOT_PREREGISTERED`

C0b is **not** designed here. D2-A0 already established `credence → canonical proposition stance` on the
real production representation; introducing a new synthetic credence representation before the C0a result
is known would add a second possible source of measurement ambiguity. Whether C0b still offers independent
information gain is reconsidered **only after a C0a positive**.

## ARTIFACTS

`research/experiments/belief-cross-expression-d4/evidence/d4-c0a-preregistration/` —
`treatment-isolation-report.json`, `state-blindness-report.json`, `contract-framing-report.json`,
`qualification-fixture-report.json`, `scorer-audit.json`, `noise-compatibility-report.json`,
`contract-manifest.json`, `D4_C0A_VERDICT.json`

`tsc -p tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS; no
credential in any artifact; no CharacterOS file touched.

**The next round may only:** implement the frozen transformer on the frozen minimal base, pass its offline
conformance gate at **zero** calls, freeze the implementation hashes, then run qualification. It may not
design or run C0b, modify CharacterOS, change the tokens, anchors, fixtures, arms or contract, add a
sample-size branch to the gate, or execute anything from D2-B or link 4.
