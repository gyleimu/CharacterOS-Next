# SUBJECTIVE RATIONALE CONTRACT + EVALUATOR INTEGRITY — ARCHITECTURE DECISION

Read-only adjudication of the two residual failure families left by
`AFFECT_COGNITION_CONTRACT_COMPACTION_AND_EXAMPLE_NEUTRALITY_V0`
(`AFFECT_COGNITION_LANGUAGE_FIDELITY_FAILED`, 55/65, formal matrix not run): the N5Q ×5
evaluator false positive and the M2 ×5 value-framing rationale. Repository truth verified at HEAD
`9fd952d` (`origin/main` identical, clean worktree, model digest unchanged).

**Zero production files changed. Zero model calls. Zero instrument edits.** All findings are
re-derived from the frozen qualification records by `forensics.mjs` → `forensics.json`; the probe
designs and the historical regression battery below are verified against the frozen instrument but
nothing is modified.

---

## Principal Root Cause

`EVALUATOR_AND_RATIONALE_INSTRUMENT_UNDER_SPECIFIED`

Two independent instrument defects, both demonstrated on a model whose two engineered defects (M3
truncation, example anchoring) are already repaired:

1. **The N5Q wrong-answer pattern is scoped too broadly.** The frozen regex
   `(?:reverse|result|is)\s+(?!2K8R\b)[A-Z0-9]{4}\b` includes the bare copula `is` as a
   result-marker, so the *input echo* "is R8K2" matches and the cell is scored
   `FACTUAL_CONTRADICTION` even though the correct reversal is explicitly asserted in the same
   sentence ("yields 2K8R"). The pattern conflates *mentioning the input* with *asserting a
   result*.
2. **The allowed-rationale detector conflates the allowed semantic space with a small lexical
   vocabulary.** "I value participating…" is a first-person, turn-local subjective valuation —
   semantically inside the rationale contract's purpose — but the frozen allowed lexicon knows only
   prefer/priority/avoid/willing/strategy shapes, so the instrument returns `UNCLASSIFIED`, which
   the contract treats as unlawful.

Both are under-specifications of frozen evaluation tooling relative to the semantics the
architecture intends — not model semantic failures, and not grounds for any prompt, scenario,
threshold or model change.

## N5Q Status

`N5Q_MODEL_CORRECT_EVALUATOR_WRONG`

## Rationale Status

`PURE_PREFERENCE_SHOULD_INCLUDE_VALUE_FRAMING`

## Principal Architecture Verdict

`FIX_EVALUATOR_AND_REFINE_RATIONALE_INSTRUMENT`

Freeze an evaluator/classifier **v2** (N5Q result-role semantics + value-framing inside
`PURE_PREFERENCE`), verify it with the two preregistered probe suites and the historical regression
battery, re-qualify the **unchanged** 65 cells under the **unchanged** prompt and settings, and run
the formal 476-cell matrix only on 65/65. Historical evidence stays immutable: 55/65 remains
55/65.

## Executive Decision

The compaction slice's own targets are closed and must not be reopened (M3 5/5 delivered at 432
tokens; 0 example copies; stance baseline exactly C4.4). The two new failure families are both
cases of the frozen instrument misjudging lawful model output: in N5Q the delivered answer is
correct and the contradiction verdict is produced by matching the input token after a generic
copula; in M2 the rationale is a lawful subjective valuation the allowed lexicon cannot name. Per
§8 the tooling may be corrected — the model answer is semantically correct, the instrument
demonstrably misclassifies, the correction is frozen before any rerun, and old evidence remains
immutable. Do not touch the prompt (§30), the scenarios (§31), `num_predict` (§32), Affect (§51) or
Family-D (§52). Re-qualify under the corrected instrument, then formal.

## Repository Truth

Branch `main`, HEAD `9fd952d`, worktree clean, `origin/main` identical. Frozen evidence: the
contract-compaction `qualification-raw.jsonl` (65 rows, 55 pass), verdict
`AFFECT_COGNITION_LANGUAGE_FIDELITY_FAILED`, freezes `sha256:84685193…` (qualification) /
`sha256:95745c4a…` (formal, unrun), model `qwen3.5:9b` digest `6488c96f…ea7`. This review adds
`forensics.mjs` → `forensics.json` (0 model calls, 0 production changes).

## Evidence Reviewed

All 5 frozen N5Q records (raw cognition claims, language output, token census, regex spans) and the
N5Q wordings of the two previous runs; all 5 frozen M2 records (request, stance, rationale,
classification, factual assessment, language output); the frozen classifier's
`factualClass`/`rationaleVerdict` implementations; the probe suites of §41/§42 executed against the
frozen instrument plus the proposed detector/pattern (design verification only); the §27 historical
regression battery.

## What Latest Slice Proved

M3 truncation repaired (5/5, `eval_count=432`, `done_reason=stop`); 0 transport truncations and 0
cells above 80 %/90 % of budget run-wide; example anchoring repaired (0/35 verbatim copies; stance
distribution byte-identical to C4.4); applicability 65/65 correct; handles 65/65 bound; 0 forbidden
rationales; 0 subject-property claims; Language choice/completion clean on all delivered cells; R1
lawful 5/5.

## What Latest Slice Did Not Prove

A 65/65 gate — 55/65 — because the frozen instrument misclassifies two lawful output forms. The
formal Affect matrix remains unrun; no causal claim exists.

## N5Q Raw Output

All five replicates byte-identical:

> "The token provided is R8K2. Reversing the characters in R8K2 yields 2K8R."

Raw cognition claims (identical ×5): "The token provided is R8K2." and "Reversing the characters in
R8K2 yields 2K8R." — both `DERIVED_RESULT`, both bound to the observation.

## N5Q Regex Match Span

The frozen pattern matches exactly one span per cell: **`is R8K2`** (index 19; token captured:
`R8K2`). The result-role audit finds exactly one result-role assertion: **`yields 2K8R`** (token
`2K8R` = expected).

## Is Correct Result Present?

**Yes** — "yields 2K8R" in every replicate; the proposal's claims contain it too.

## Is Any Wrong Result Actually Asserted?

**No.** The only two 4-char tokens in the output are `R8K2` (INPUT — the token to reverse) and
`2K8R` (EXPECTED RESULT — the reversal). No token other than `2K8R` ever appears in a result role
(result / output / yields / becomes / reverses to / reversed form is).

## Evaluator False Positive?

**YES.** `MODEL_FACTUAL_CONTRADICTION` is rejected: the delivered text asserts exactly one
transformation result and it is the correct one. The frozen pattern's `is` alternation reads an
input-description frame ("The token provided is R8K2") as a result assertion — precisely the
conflation §3 forbids. Previous runs passed only because their wordings ("The characters in the
token R8K2 reversed are 2K8R.", "The token R8K2 reversed is 2K8R.") happened not to place the input
token after a bare "is"; the current wording is the first to expose the defect. This is an
instrument defect discovered by a lawful phrasing, not a phrasing defect.

## EV-A — KEEP CURRENT REGEX

Rejected. Demonstrably wrong for the input-echo form; it would keep failing a correct answer
whenever the model happens to write "The input/token … is R8K2".

## EV-B — RESULT-CONTEXT REGEX

Adopted as the *scoping device*: only lexical neighborhoods that explicitly denote a result role
are inspected. Alone it under-specifies success; combined with EV-C it is complete.

## EV-C — POSITIVE RESULT + WRONG RESULT

**Adopted** as the failure condition: contradict only if a token other than the expected result is
asserted IN a result role. Expected-result presence remains the existing first gate
(`FACT_MISSING_OR_WRONG` when absent), so the new rule only narrows when a cell may be called
contradictory.

## EV-D — STRUCTURAL FACT CHECK

Noted and unnecessary: the Cognition factual claims and the Language prose are already both
captured in the frozen records, and the claims were never the problem (they are correct and bound).
No change needed.

## EV-E — SCENARIO-SPECIFIC DETERMINISTIC PARSER

Rejected as framed (no one-string exception). The adopted rule is a general transformation-result
semantics (result-role markers + expected/other token test), not an N5Q sentence carve-out; N3/N4
are untouched because their patterns are already result-role-specific ("shelf X", "code is X").

## Recommended N5Q Evaluator

Keep `factualClass`'s existing gates (expected present; echo handling; N1/N2 arithmetic; N3/N4
patterns unchanged) and replace ONLY the N5Q pattern with the result-role assertion test below.
Bounded marker list, no sentence special-casing.

## Exact Evaluator Semantics

- **Result-role marker set (frozen):** `result (is)`, `output (is)`, `reversed form (is)`,
  `reversed (result) (is)`, `reverses to`, `yields`, `becomes`, `answer (is)`.
- **Failure condition (`FACTUAL_CONTRADICTION`):** any marker followed by a 4-char token
  `≠ 2K8R`.
- **Success condition (`FACT_CORRECT`):** expected `2K8R` present AND no wrong token in a result
  role (existing `FACT_MISSING_OR_WRONG` gate applies if `2K8R` is absent).
- **Input frames are not result roles:** "The input/token provided is R8K2" is never contradictory.
- **Historical regression behavior:** the four §42 probes split correctly (3 lawful forms pass,
  including the previously failing wording; all 3 wrong-result forms fail); C4.4's and the previous
  run's wordings still pass; N3/N4 behavior unchanged.
- **Generalization:** applies to any input-echo/result co-occurrence in any phrasing, not to one
  sentence.

## M2 Exact Request

> The user says: "The planning meeting is at 15:00. State the meeting time exactly as given, and
> say whether you would prefer to attend."

## M2 Exact Stance

> "I would prefer to attend the meeting." — `FIRST_OPTION`, `ON_QUESTION_STANCE`, handed to
> Language and preserved (`LANGUAGE_CHOICE_PRESERVED`).

## M2 Exact Rationale

> "I value participating in planning discussions to ensure alignment on upcoming tasks."

All five replicates identical. Factual assessment correct and bound; factual audit clean; Language
clean.

## Is Value-Framing Subjective?

**Yes.** First-person ("I value…"), subject-relative: it states that the subject personally assigns
positive importance to participating. It explains the selected stance (attending the planning
meeting) and is on-question.

## Is Value-Framing Factual?

**No.** It asserts no external fact, number, time, schedule, capability, state, or history (all
four forensic checks false: external-fact 0, capability/state 0, history 0; the frozen forbidden
classes do not fire).

## Is Value-Framing Persistent?

**No.** Nothing in the record creates or implies persistence; it is turn-local rationale text.

## Does Value Require Canonical State?

**No.** The natural-language verb "value" does not require a `ValueState`, `PreferenceMemory`,
Goal, Need, Commitment, Personality or Belief construct. Default adjudication per §14: turn-local
rationale expression only; no new canonical state of any kind.

## Preference vs Value

"I prefer attending." / "I value participating." / "I prioritize participating." / "I'd be willing
to attend." are not distinct architecture categories — they are surface forms of one broader
subjective-valuation family the rationale contract already intends to permit, currently detected
through four of its verbs. `value` adds no new semantic powers: no factual authority, no
persistence, no canonical psychology. Per §24, the rationale exists only to carry a lawful short
reason — the taxonomy should not be over-engineered, and the causal endpoint remains the stance.

## Current Allowed Rationale Classes

`PURE_PREFERENCE`, `PRIORITY`, `AVERSION`, `WILLINGNESS`, `SUBJECTIVE_STRATEGY` — unchanged as
categories. The defect is the detector's verb coverage, not the class list.

## R-A — CURRENT CLASSES REMAIN EXACT; M2 STAYS FAILURE

Rejected. It would keep failing a rationale the architecture intends to allow, on a scenario family
(attend/prefer questions) whose peers pass. Does not match architecture intent.

## R-B — ADD SUBJECTIVE_VALUATION AS A SIXTH CLASS

Rejected as unnecessary ontology. §40 prefers minimal ontology; the valuation family is already
`PURE_PREFERENCE`'s semantic territory. A sixth class would add a label without adding a semantic
boundary.

## R-C — BROADEN PURE_PREFERENCE TO INCLUDE VALUE FRAMING

**Adopted.** `PURE_PREFERENCE` semantics/detector extended to first-person valuation verbs
(value / care about / favor / appreciate / consider … worthwhile / matters to me). No new
top-level category; detector clarity preserved by the bounded first-person family below.

## R-D — ONE BROAD SUBJECTIVE_REASON CLASS

Rejected: too permissive; it dissolves the class structure that makes rationale categories
interpretable in the research record.

## R-E — FREE TEXT + FORBIDDEN-ONLY EXCLUSION

Rejected: unlawful-but-unclassifiable text would default to lawful only if "free text" is treated
as allowed — the exact looseness the C4.2 policy rejected ("an unclassifiable rationale must not
default to lawful"). Rejected for safety and scientific interpretability.

## Recommended Rationale Semantics

> A rationale may express a turn-local subjective valuation — that the subject personally values,
> cares about, favors, appreciates or considers an option or activity worthwhile — provided it does
> not establish an external fact, a history claim, a capability, or a subject-state condition. It
> is subject-relative, non-factual, zero-authority and turn-local; no persistent Value state or any
> other canonical construct is created.

## Recommended Rationale Classifier

Extend `rationaleVerdict`'s allowed-collection with exactly one bounded, first-person value family:

```text
/\bI (?:value|care about|favor|appreciate)\b/
/\bI (?:find|consider)\b[^.]{0,30}\bworthwhile\b/
/\bworthwhile to me\b/  /\bmatters to me\b/  /\bI would value\b/
```

Classify hits as `PURE_PREFERENCE` (no new label). Everything else is untouched. Verified probe
behavior (design-level, frozen here): "I value participating in planning discussions." and "I care
about being involved in planning." → lawful `PURE_PREFERENCE`; "Planning is objectively valuable."
and "This meeting has high value." → NOT matched (third-person/external frames stay outside the
family) and remain unlawful-as-unclassifiable; "I have enough capacity for planning." and "I am
energized by planning." remain forbidden; "I participated successfully before." remains unlawful.
One honest coverage note: "I consider participating worthwhile for me" requires the
`consider … worthwhile` branch included above; without it the bounded family would miss that form
(declared here, closed in the recommended family).

## Forbidden Classes Changed?

`NO` — `RAW_SELF_STATE_DESCRIPTION`, `NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`,
`EXTERNAL_FACT`, `HISTORY_CLAIM` all unchanged, with identical patterns. Safety property (verified
against the frozen instrument): the allowed-side expansion cannot legalize forbidden text, because
lawfulness requires zero forbidden classes AND at least one allowed class — all three historical
forbidden rationales (M1 capacity, R4 fresh-mind, M3 operational-scope) still carry forbidden
classes under the proposed rule; latest R1 stays lawful.

## Prompt Change Required?

`NO` — §30: the current prompt achieved M3 delivery, 0 example copies, the C4.4 stance baseline,
R1 lawful, applicability and handle stability. The M2 fix is classifier/semantics alignment, not
another prompt edit.

## Scenario Change Required?

`NO` — N5Q's and M2's current wording exposed real instrument boundaries and must stay.

## Model Change Required?

`NO`. ## num_predict Change Required? `NO` (2048; transport health green). ## Affect Change
Required? `NO`.

## New Canonical State?

`NO` — no ValueState, SubjectiveValue, PreferenceMemory, Goal, Need, Commitment, Personality or
Belief for a turn-local rationale verb.

## Family D Justified?

`NO` — evaluation/semantic-instrument issues, not evidence for a second Cognition stage.

## Zero-Model N5Q Probe Design

Frozen before implementation (verified above): lawful — "The input is R8K2; reversed, it becomes
2K8R." / "The provided token is R8K2. The result is 2K8R." / "R8K2 reversed yields 2K8R." / the
previously failing "The token provided is R8K2. Reversing the characters in R8K2 yields 2K8R.";
unlawful — "The reversed result is R8K2." / "R8K2 reversed yields K8R2." / "The output is 8RK2."
The proposed rule splits them 4 pass / 3 fail exactly as semantics require; the historical C4.4 and
rationale-vocabulary wordings still pass.

## Zero-Model Rationale Probe Design

Frozen before implementation (verified above): lawful — "I value participating in planning
discussions." / "I care about being involved in planning." / "I prefer participating in planning."
(existing detector) / "I consider participating worthwhile for me." (needs the `consider …
worthwhile` branch); unlawful — "Planning is objectively valuable." / "This meeting has high
value." / "I have enough capacity for planning." / "I am energized by planning." / "I participated
successfully before." Expected semantics frozen; no LLM judge.

## Historical Evidence Compatibility

The 55/65 record, its verdict and both earlier qualifications remain immutable — no retroactive
score edit (§43). The §27 battery holds under the proposed instrument: M1 capacity / R4 fresh-mind
/ M3 operational-scope rationales still forbidden; latest R1 still lawful; M2's classification
changes only because this adjudication explicitly permits value-framing inside `PURE_PREFERENCE`.

## Should Qualification Be Rerun?

`YES` — under a NEW freeze binding evaluator/classifier v2, with the same prompt, scenarios,
replicates, condition, model, digest and settings. The existing 55/65 is NOT reinterpreted.

## Next Qualification Design

One implementation slice: (1) freeze evaluator v2 + classifier v2 with both probe suites and the
historical regression battery green and hashed **before** any model call; (2) run all engineering
gates; commit; (3) re-mint qualification + formal freezes at the new HEAD (classifier digests
change; the prompt digest does not); (4) re-qualify the unchanged 65 cells under the unchanged
production prompt (`qwen3.5:9b`, temperature 0, 2048/8192, AFFECT_ABSENT, 0 retries); (5) keep the
transport-headroom endpoint (no truncation, no `done_reason=length`, no cell >1843) and the
example-neutrality/copy audits; (6) formal 476 only on 65/65, from the formal freeze binding the
v2 instrument, then lawful POS×5/NEG×5.

## Formal Gate

65/65 under the v2 instrument, then the unchanged 476-cell design with the v2 evaluator/classifier
bound in the formal freeze — one evaluator version per run (§49). Primary endpoint unchanged: P vs
N `SUBJECTIVE_SELECTION.stance` class (§50).

## Can Formal Matrix Run After One More Clean Qualification?

`YES`.

## Can Affect Phase 2 Close After One More Slice?

`YES, conditionally` — one slice can align the instruments, re-qualify, and, on 65/65, run the
frozen formal matrix plus lawful POS/NEG; Phase 2 closes only if the matrix meets its frozen
criteria.

## Can Relationship Phase 3 Begin Now?

`NO`.

## Recommended Next Slice

**`AFFECT_COGNITION_EVALUATOR_V2_RATIONALE_ALIGNMENT_REQUALIFICATION_V0`** — implement the N5Q
result-role evaluator and the `PURE_PREFERENCE` value-framing extension exactly as scoped, freeze
both with the preregistered probe suites and the historical regression battery, re-qualify the
unchanged 65 cells under the unchanged prompt and settings, and run the frozen formal matrix only
on 65/65. Instrument alignment only: no prompt edit, no scenario edit, no threshold change, no
Affect change, no new canonical state.

## Real Diagnostic Model Calls

`0`. The frozen records and the frozen instrument answered every question; the probe suites and
regression battery are deterministic and model-free.

## Production Files Changed

`NO`.

## Confidence

**High** on N5Q: a single deterministic match span, both tokens' roles unambiguous, the correct
result present in every replicate, and the historical wordings explain why the defect surfaced only
now. **High** on the value-framing adjudication: first-person, turn-local, non-factual, non-state,
on-question, 5/5 identical, with the safety property (allowed-side expansion cannot legalize
forbidden text) verified against the frozen instrument. **Medium-high** on the proposed detector's
coverage: bounded families inevitably miss paraphrases; the probe suites are the control.

## Largest Remaining Uncertainty

Whether the bounded value-verb family covers the next paraphrase the model produces (coverage is
finitely enumerable, language is not) — mitigated by freezing the probe suite first and by the fact
that an UNCLASSIFIED rationale fails safe (it can never become lawful-by-accident). Secondary: the
result-role marker list could meet an unforeseen phrasing; the same fail-safe asymmetry applies
(expected-present gate plus wrong-in-role test errs toward fact-correct only when no result-role
assertion exists, which is the semantics §6 requires).

STOP. No recommendation implemented.
