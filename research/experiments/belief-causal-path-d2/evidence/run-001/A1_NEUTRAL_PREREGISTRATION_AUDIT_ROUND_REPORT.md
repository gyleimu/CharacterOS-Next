# D2 A1 NEUTRAL PILOT — PREREGISTRATION AUDIT — ROUND REPORT

**`D2_A1_NEUTRAL_INVALID_HANDLING_NOT_PREREGISTERED`**
**0 model calls this round.** `D2_MODEL_CALLS = 36` (unchanged).
No amendment was written and no rule was invented: the brief's §1 authorises exactly two branches —
execute the frozen rule, or stop and report the gap — and this is the second.

---

## 1. §1 — THE GATE FIRED, AND THE GAP IS SPECIFIC

`D2_NOISE_RULE` was introspected field by field. What it does specify:

| Required item | Present |
| --- | --- |
| planned neutral trials = 6 (`pilot_shape: "6 byte-identical NEUTRAL requests…"`) | yes |
| mapping `6 → r = 6` | yes |
| mapping `5 → r = 14` | yes |
| `≤ 4 → STOP` | yes |

What it does **not** specify — the string is absent from the entire frozen rule:

| Required item | Present |
| --- | --- |
| `no_retry` | **no** |
| `no_replacement` | **no** |
| `modal_count` calculation (the frozen text never even uses the word *modal*, and never says *what* is being counted) | **no** |
| invalid trial handling (parser invalid / malformed output / transport failure) | **no** |

The `deterministic_mapping` keys are bare counts `"0"…"6"`, so the rule is a function of a number whose
definition the same rule never supplies.

## 2. THE ONLY INVALID RULE IN THE CONTRACT SET DOES NOT REACH THE PILOT

`D2A1_QUALIFICATION_INVALID_RULE` (REV1.1c) is the sole invalid rule anywhere in the D2 contracts. It
says `any_invalid_qualification_trial_fails_that_instrument_qualification`, is scoped by name and by
`applies_to: ["D2_A1", "D2_B"]` to **qualification** trials, and its verdict is
`D2_INSTRUMENT_UNQUALIFIED` — a statement about whether an instrument is qualified, which is not
definable for a pilot whose instrument is already qualified. It has no bearing on a neutral pilot's
denominator or modal count.

## 3. THE AMBIGUITY IS MATERIAL — SHOWN, NOT ASSERTED

Three readings a careful reader can take from the frozen text were enumerated, and each was applied
mechanically to the same four possible observed pilots. None of the readings is adopted; the point is
that they disagree:

| Observed pilot | invalids excluded | invalids are ordinary keys | any invalid stops |
| --- | --- | --- | --- |
| all six agree | 6 | 6 | 6 |
| five agree, one transport failure | **14** | **14** | **STOP** |
| three agree, three invalid | STOP | UNDEFINED | STOP |
| **all six invalid** | STOP | **6** | STOP |

Two of these are the ones that matter. A single transport failure turns `r = 14` into "stop the whole
A1 stage", depending on which reading is used. And a pilot in which **every call failed** would, under
the second reading, return `modal_count = 6` → `r = 6` → authorise a twelve-call treatment run on no
evidence at all.

That is the shape of a preregistration hole worth stopping for: the ambiguity is widest exactly where a
failed pilot would otherwise authorise an experiment. It is not pedantry about wording — it is a
run/no-run decision and a factor-of-fourteen budget decision, taken by a rule that does not exist yet.

## 4. §3 — THE PRODUCTION CONTEXT: RESOLVED, BUT BY INFERENCE RATHER THAN BY A FIELD

The audit also asked whether the A1 state experiment's observation, task and production context are
uniquely bound, so they cannot be chosen after seeing outputs. Conclusion: **yes, and it is the same
frozen production context A0 used** — but A1 reaches this by inference, and that is worth recording:

- `D2_TRANSFORMER_LAWS.each_requires_pristine_production_v8_input` makes the A1 stimulus a pristine
  production request, not a hand-written scene;
- the causal graph puts A0 (link 3A) and A1 (link 3B) on the **same chain**, so a different production
  context would make the localisation matrix incoherent;
- the D1 handoff carries LINK 1 and LINK 2 forward as established without any model call — the
  0.80/0.20 credence materialising through production genesis authoring as the only canonical state
  difference, and the production V2 projection carrying the belief line — which binds the state and
  projection path, and the projection contains the world's own observation;
- the A1 transformer appends a measurement contract and nothing else, so it cannot introduce a context;
- the frozen P1 observation is itself a secondhand-report scenario (*"a colleague remarks…"*) — the
  exact antecedent the CAUTION proposition and its paraphrase are about — so the context is
  construct-aligned, not arbitrary.

**Residual weakness, stated plainly:** A0 had an explicit field for this
(`D2A_INSTRUMENT_LAWS.same_projection_path`). A1 has no equivalent, so the binding rests on inference
from the causal chain and the D1 handoff. That inference is sound, but an explicit A1 context binding
would remove it and belongs in the revision that closes §1. `D2_A1_STATE_CONTEXT_NOT_FULLY_PREREGISTERED`
was therefore **not** emitted.

## 5. WHAT WAS NOT DONE

No A1 neutral pilot call was made. No A1 HIGH/LOW call was made. No production state was materialised,
no request built, no schedule frozen — §1 gates the round before §2, and freezing a request set while
the noise rule is undefined would have produced artifacts whose validity depends on an unresolved rule.
D2-B and every D1/D2-A stage were untouched.

`D2A1_PREDICTION` remains frozen and unchanged: HIGH 0.80 → `SUPPORTS_PARAPHRASED_PRINCIPLE`, LOW 0.20
→ `OPPOSES_PARAPHRASED_PRINCIPLE`, with `buildD2SemanticReadoutRequestV0` as the instrument.

## 6. WHAT THE NEXT ROUND NEEDS

A revision that freezes, with `model_calls_before_amendment_for_the_a1_pilot = 0`:

1. the pilot's invalid handling — how an invalid/malformed/transport-failed trial enters the
   denominator and the modal count, and the retry/replacement policy for the six planned trials;
2. an explicit A1 production-context binding, so §3 stops depending on inference.

Then the six neutral calls, then the deterministic schedule freeze.

## 7. ARTIFACTS

`evidence/run-001/a1-neutral-preregistration-audit/` — `a1-neutral-preregistration-audit.json` (the
per-item presence table, the invalid-rule inventory, the three-reading divergence proof, and the §3
context-binding analysis), `A1_NEUTRAL_PREREGISTRATION_VERDICT.json`

No credential appears in any artifact (scanned). D1 untouched (`02bd7e31…`). `tsc -p
tsconfig.auxiliary.json` and `eslint --max-warnings 0` clean; `pnpm governance` PASS. This round added
no amendment and modified no frozen artifact.
