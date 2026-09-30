# RUN-5 PREREGISTRATION — SOURCE_QUOTE COMPLIANCE CONDITION

**`RUN5_PREREGISTRATION_FROZEN`** · **`RUN5_NOT_EXECUTED`** · **`PACKAGES_UNMODIFIED`**
`INVALID_POLICY_UNCHANGED` · `NO_RETRY_NO_TOLERANCE` · `PHASE_1_NOT_AUTHORISED`

Frozen before run-5's first scientific call. Machine-readable constants in [`contract-run5.ts`](contract-run5.ts);
the augmentation text in [`run5-augmentation.ts`](run5-augmentation.ts).

---

## 1. EXACTLY ONE CHANGE, PLUS FRESH IDENTITIES

| | run-4 | run-5 |
| --- | --- | --- |
| executor | `deepseek-flash` (cloud) | **unchanged** |
| trajectories / valence / target / baseline / scorer / predicate / budgets | REV2 | **unchanged, reused by reference** |
| **invalid policy** | no retry; one failed turn ⇒ INCONCLUSIVE | **UNCHANGED** |
| identities | `subject-r4h6-2903` / `-7514`, qual `subject-r4q7-6128` | fresh: `subject-r5b3-4187` / `-7260`, qual `subject-r5u9-3952` |
| cognition request | production text | production text **+ the citation-discipline augmentation** |

The augmentation is applied at the **research transport boundary** and appended to the end of the
existing system message. **Production prompt text, the product's request bytes, the frozen validator and
every historical pin are untouched.** The prior "COPIED BYTE-FOR-BYTE" strengthening was reverted
because it changed production request bytes and historical request identity is immutable; this
condition does not repeat that mistake.

## 2. WHY RUN-5 IS WORTH RUNNING

Run-4's sole blocking failure was the authoritative SOURCE_QUOTE rule
(`factual-claim-authorization.ts:315`, `presentInEverySource`): a SOURCE_QUOTE claim's text must appear
verbatim in **every** source it cites. The rule is **already stated** in the production prompt (rule 9 —
verbatim, exact case and punctuation, every cited source) and the model violated it anyway.

The augmentation therefore does two things a bare restatement does not: it names the **every-cited-source**
requirement explicitly, and it supplies the **constructive way out** (if the span occurs in only one
source, cite only that source). It addresses both failure modes — paraphrase and multi-source citation —
because without the raw payload we could not tell which one run-4 hit.

**Why one change and not two.** I considered also adding a pre-registered engineering-failure tolerance.
I did not, deliberately: it is a change to the **invalid policy**, i.e. a scientific-protocol change, and
the frozen design's integrity is worth more than a higher completion probability. One targeted change
keeps run-5 a clean measurement of one question.

## 3. EVERY OUTCOME IS INFORMATIVE

The raw-response recorder (`ed79dae`) now preserves the executor's actual payload on every call, valid or
invalid, so run-5 cannot repeat run-4's undiagnosability.

| outcome | what it establishes |
| --- | --- |
| **clean run** | the executor + augmentation survive the scientific request shape; the hypothesis can finally be measured |
| **FAILURE_A** | lived evidence did not move credence in the preregistered direction on this condition — a scientific null |
| **contract rejection, payload preserved** | the exact mechanism: a paraphrase, or a multi-source citation. Either way the failure stops being a guess |
| **contract rejection, same shape as run-4** | **stating this rule harder does not buy compliance.** That closes the whole "word the rule more emphatically" family and escalates the question to the contract's semantics — which is not a change this round may make |

The last row is the most valuable negative result available here, and it is only available because the
recorder now exists.

## 4. BUDGET AND STOP RULES

```
schedule   1 qualification turn + 5 arm A + 5 arm B = 11 turns
ceiling    66 model calls (P0_MAX_TOTAL_MODEL_CALLS, reused)
run-1 measured 39; run-4 measured 49
```

1. The in-run qualification turn is a pre-flight gate; a failure stops the round before any scientific turn.
2. **Any scientific turn that does not reach `COMPLETE` makes the run `INCONCLUSIVE`. No retry, no
   substitution, no extension, no tolerance.** Unchanged from run-1/run-3/run-4.
3. The schedule runs exactly once, in the frozen order.
4. Pre/post state frozen with `scored: false` and hashed **before** the scorer runs; scoring is separate.
5. **The augmentation is applied to cognition ONLY** and must never appear in a language or appraisal request.
6. **If the augmentation cannot be applied, the turn fails closed** — a silently unaugmented run must never
   be scored as the declared condition. The run also writes a self-check artifact and stops if any recorded
   cognition request lacks the augmentation.

## 5. FORBIDDEN CLAIMS

The standard ceiling applies unchanged, plus: **run-5 is not comparable to run-1/run-3/run-4** (different
executor AND different request bytes), **the augmentation fixed the SOURCE_QUOTE failure** (that is what
run-5 measures, not what it assumes), and any re-opening of D1.

**A clean run raises the evidence hierarchy to `L2` and no further.** `L2` means exactly: lived experience
changed canonical state. It does not mean history internalization works; `L3` (the change alters cognition
in a new scenario with the raw history absent) remains untested.

## 6. WHAT RUN-5 DOES NOT AUTHORISE

No `PHASE_1`. No CharacterOS or `packages/` change. No change to the invalid policy, the scorer, the
predicate, the trajectories or the target proposition. No re-opening of the belief micro-line's
`DEFERRED_LOCALIZATION_HYPOTHESES`. No claim about the model's internal dispositions.
