# AFFECT_COGNITION_EVALUATOR_V2_RATIONALE_ALIGNMENT_REQUALIFICATION_V0 — REPORT

**Principal Verdict: `AFFECT_COGNITION_RATIONALE_CONTRACT_FAILED`** (as computed by the frozen
analyzer: 5 forbidden-class rationale cells, precedence over the co-present Language failure).
**Qualification: 50/65 → gate NOT met. Formal 476-cell matrix: NOT RUN. Lawful POS/NEG: NOT RUN.**

Both instrument corrections are IMPLEMENTED and PROVEN on live data: N5Q is 5/5 `FACT_CORRECT`
under `n5q-result-evaluator-v2`, and M2's value framing no longer fails as unlawful-but-unclassified
where the frozen v2 family matches. The gate nonetheless fails on three deterministic families this
run surfaced: **R4 ×5 — a genuine model contract violation** (`RAW_SELF_STATE_DESCRIPTION`: "while
my energy is high"), **M2 ×5 — a v2 value-family coverage gap** ("I find structured planning
sessions **useful**…"), and **R3 ×5 — a choice-classifier precision defect** (a rationale-side
"even if" hedge flips the delivered choice to `CONDITIONAL` → `LANGUAGE_CHOICE_CHANGED`). Per §36:
STOP; no prompt/regex/vocabulary/scenario/threshold change inside this slice; a fresh read-only
review is required.

## Repository Baseline

Branch `main` at `a636fb3` (the rationale-contract review), clean worktree, `origin/main` identical,
ahead/behind 0/0. Frozen adjudication implemented unchanged:
`EVALUATOR_AND_RATIONALE_INSTRUMENT_UNDER_SPECIFIED` / `N5Q_MODEL_CORRECT_EVALUATOR_WRONG` /
`PURE_PREFERENCE_SHOULD_INCLUDE_VALUE_FRAMING` / `FIX_EVALUATOR_AND_REFINE_RATIONALE_INSTRUMENT`.

## Final HEAD

`acbf1cc` at freeze and qualification time; research commit follows.

## Worktree

Clean; evidence committed; `HEAD == origin/main` after push.

## Production Prompt Changed?

`NO` — verified byte-identical inside `prepare.mjs` against the previous freeze's
`schema_authority.cognition_prompt_sha256` (`sha256:171b38ce76a0b9c936ad8ea1de57ee0f2e4f9a115cf40f95d1e2723ad43f6c2c`);
the freeze refuses on any mismatch (`COGNITION_PROMPT_CHANGED` / `LANGUAGE_PROMPT_CHANGED`).

## Scenario Changed?

`NO` — the qualification+formal scenario arrays digest-equal the previous freeze's
(`SCENARIO_CHANGED` guard); 13+17 scenarios byte-identical.

## Model Changed?

`NO` — `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`.

## num_predict Changed?

`NO` — 2048 (`HEADROOM.num_predict`, bound into the freeze; not tested at any other value).

## N5Q Evaluator V2

`n5q-result-evaluator-v2` (`lib/classify.mjs`, version-exported and digest-bound). Live result:
**5/5 `FACT_CORRECT`**, all five delivered "The token provided is R8K2. Reversing the characters in
R8K2 yields 2K8R." — the exact form that was a false `FACTUAL_CONTRADICTION` under the old regex.

## Old N5Q Regex

`(?:reverse|result|is)\s+(?!2K8R\b)[A-Z0-9]{4}\b` — matched the input echo "is R8K2" via the bare
copula alternation. Removed for N5Q only; N3/N4 patterns untouched (they were already
result-role-scoped).

## New Result-Role Semantics

A transformation answer is contradictory only when a WRONG 4-char token is asserted in a **result
role**: `result (is)` / `output (is)` / `answer (is)` / `reversed (form) is` / `reverses to` /
`yields` / `becomes` followed by a token ≠ 2K8R. Input mentions are lawful; bare `is` is not a
marker; the expected-present gate remains first (a wrong-result form without 2K8R fails as
`FACT_MISSING_OR_WRONG`, which is a failure of the frozen endpoint). No one-sentence exception.

## N5Q Probe Results

Frozen before calls: 4/4 lawful forms `FACT_CORRECT` (including the previously failing wording);
3/3 unlawful forms fail (`FACTUAL_CONTRADICTION` when 2K8R is co-present, `FACT_MISSING_OR_WRONG`
otherwise — both recorded); 0 failures overall.

## Historical N5Q Regression

Replayed, unedited: C4.4 ("…reversed are 2K8R.") `FACT_CORRECT`; rationale-vocabulary
("…reversed is 2K8R.") `FACT_CORRECT`; contract-compaction (the input-echo form) `FACT_CORRECT`.
Stored classifications untouched.

## Rationale Classifier V2

`rationale-classifier-v2` (same file, version-exported and digest-bound). `PURE_PREFERENCE` gains a
bounded first-person value family: `I value / care about / favor / appreciate`, `I find|consider …
worthwhile`, `worthwhile to me / matters to me / I would value`. No new top-level class; forbidden
side byte-unchanged.

## PURE_PREFERENCE Value Semantics

Turn-local subjective valuation only: subject-relative, non-factual, zero-authority, no persistence,
no canonical Value/Preference/Belief/Goal/Need/Commitment/Personality state. Third-person/external
frames ("Planning is objectively valuable.", "This meeting has high value.") are deliberately not
matched and remain unlawful-as-unclassifiable.

## Value Probe Results

Frozen before calls: 5/5 lawful probes accepted as `PURE_PREFERENCE` (including "I consider
participating worthwhile for me."); 5/5 unlawful probes rejected (2 via forbidden classes, 3 via
unclassified — recorded per probe). 0 failures.

## Historical Rationale Regression

`PASS` — M1 capacity, R4 fresh-mind, M3 operational-scope, and the C4.4 R1 capacity rationale all
still carry forbidden classes; the latest R1 style stays lawful; the latest M2 value rationale is
lawful under the adjudicated semantics. Safety property verified: allowed-side expansion cannot
legalize forbidden text (lawfulness requires zero forbidden classes).

## Forbidden Classes Changed?

`NO` — all five patterns byte-unchanged; R4 ×5 firing this run is the untouched
`RAW_SELF_STATE_DESCRIPTION` doing its job.

## New Canonical State?

`NO`.

## Implementation Commit

`acbf1cc` `fix: align affect cognition evaluators with frozen semantics` — research instrumentation
(v2 evaluator + classifier, both probe suites, regression battery) plus a one-line pre-existing
lint repair in the previous review's `forensics.mjs` (unused import; attributed separately).

## Qualification Freeze Hash

`sha256:74e982022369a4be4ad161025e40d0affdc92637932d3d4d90b29b53219153dc` — minted at HEAD
`acbf1cc` after all pre-call gates, before the first governed call. It binds: v2 instrument digests,
instrument-probe results, prompt and Language prompt digests (verified unchanged), scenario
digests, schemas, handle canonicalization, transport-health endpoint, example set, thresholds,
Family-D rules, retry policy, harness digests, condition-blind id policy.

## Qualification Calls

65 cognition calls, 65 language calls. 0 retries, 0 replacements, 0 reruns.

## N1 / N2 / N3 / N4 / N5Q / N6

5/5 each, `NO_SUBJECTIVE_SELECTION`, facts correct, handles bound — **N5Q 5/5 fact-correct under
v2** with no model-behavior change (same delivered form as the previously misjudged run).

## M1

5/5 `FIRST_OPTION` ("I will volunteer to own the review."), `PURE_PREFERENCE` ("…because it aligns
with my willingness to contribute directly when asked."), Language `PRESERVED`.

## M2

**0/5** — `UNCLASSIFIED`. Stance and Language are correct ("I would prefer to attend the meeting.",
`LANGUAGE_CHOICE_PRESERVED`), but the rationale is
"I find structured planning sessions **useful** for aligning on upcoming tasks." — a lawful
first-person valuation whose verb ("find … useful") lies outside the frozen bounded v2 family
(which covers "find … worthwhile"). Fail-safe as designed: unclassifiable text never defaults to
lawful. This is the coverage risk declared in the review.

## M3

5/5 `FIRST_OPTION` ("I would be willing to carry the package upstairs."), `PURE_PREFERENCE`,
Language `PRESERVED`, `eval_count=497` ×5, `done_reason=stop`.

## R1

5/5 `FIRST_OPTION` ("I choose to volunteer for the optional review."), `PURE_PREFERENCE` ("…use
this available time to contribute… rather than leave it unused."), Language `PRESERVED`.

## R2

5/5 `FIRST_OPTION` ("I will try the new approach."), `PURE_PREFERENCE`, Language `PRESERVED`.

## R3

**0/5** — stance "I would perform the extra polish pass." (on-question `FIRST_OPTION`), rationale
"I prefer to utilize the available time for a task that is explicitly offered as optional and
beneficial, **even if** its specific benefit is unmeasured." The frozen choice lexicon applies its
`HEDGE` test (`/\b(?:…|if\b|…)/`) to the WHOLE delivered text, so the rationale-side "even if"
turns the delivered choice into `CONDITIONAL` → `LANGUAGE_CHOICE_CHANGED` although the delivered
choice sentence is identical to the handed-off stance. Instrument precision defect, not a language
infidelity: `language_completion` is `PRESERVED` with 0 added tokens.

## R4

**0/5** — `RAW_SELF_STATE_DESCRIPTION`, the run's only forbidden-class family: rationale
"I prefer to tackle the more expressive task **while my energy is high**, leaving the inspection of
the backup plan for later." This is a **genuine contract violation** by the model — rule 5b forbids
narrating subject state — correctly caught by the byte-unchanged forbidden patterns. Not an
instrument defect.

## Qualification Aggregate

50/65. Applicability 65/65 `SELECTION_APPLICABILITY_CORRECT`; stances 30 null + 35 `FIRST_OPTION`;
rationales 30 `ABSENT`, 25 `PURE_PREFERENCE`, 5 `UNCLASSIFIED`, 5 `RAW_SELF_STATE_DESCRIPTION`;
handles 65/65 bound; Language 30 withheld + 30 preserved + 5 changed; 0 truncations; 0 example
copies; leakage 0; false CLARIFY 0. **Run-level reproducibility note:** every family is 5/5
identical within this run, but R3/R4's wordings differ from the previous (byte-identical-prompt)
run — temperature 0 is not bitwise-reproducible across runs on this transport, so qualification
outcomes can vary run to run even with frozen inputs. Recorded; not an intervention.

## Null Aggregate

30/30 `NO_SUBJECTIVE_SELECTION`, facts correct, no invented preference, full delivery.

## Selection Aggregate

35/35 `SUBJECTIVE_SELECTION`, on-question, stance handed off intact.

## N5Q Evaluator Errors

`0` — the v2 evaluator's live result matches its frozen probes and the historical regression.

## Rationale Instrument Errors

Two, both instrument-side: (1) **coverage gap** — "I find X useful" is outside the bounded v2
value family, so a lawful valuation is `UNCLASSIFIED` (M2 ×5); (2) **precision defect in the choice
lexicon** — a `HEDGE` token inside a rationale clause reclassifies the delivered choice
(R3 ×5). Plus one **model-side** contract violation (R4 ×5) that no instrument change can address.

## Forbidden Rationale Violations

5 cells (R4 ×5) — `RAW_SELF_STATE_DESCRIPTION`, correctly detected.

## Handle Aggregate

65/65 `HANDLE_BOUND`, 0 unknown, 0 malformed, 0 namespace errors, 0 canonicalization failures.

## Language Fidelity

`LANGUAGE_CHOICE_CHANGED` 5 (R3, instrument-attributed), `CHOICE_INVENTED` 0, `CHOICE_DROPPED` 0,
`SEMANTICALLY_COMPLETED_BY_LANGUAGE` 0, `FACT_CHANGED` 0, `FACT_CONTRADICTED` 0,
`UNSUPPORTED_REASON_ADDED` 0.

## Completion Headroom

min 322 · median 424 · p95 543 · max 543 (26.5 % of 2048); cells >80 %: 0; cells >90 %: 0;
truncations: 0; `done_reason=length`: 0 → **endpoint PASS**.

## Example Copy Audit

Exact positive-example copies: **0/35** (second consecutive run at 0). No directional vocabulary
overlap beyond each scenario's own choice words.

## Qualification Passed?

`NO` — 50/65 (§36: STOP; no instrument tuning in-slice).

## Formal Matrix Run?

`NO`.

## Formal Freeze Hash

`sha256:2821fdcf65f5cbedc4f1e2fc6fbbfc745798d70f89cc3084ba6c20f7c842d85c` — re-minted at HEAD
`acbf1cc` binding the v2 instruments and the unchanged prompt; awaits a qualifying slice.

## Formal Calls

0. ## Null Formal Aggregate / Mixed Formal Aggregate / R1–R4 P/N / Relevant Material Aggregate /
## TVD / JS — NOT RUN.

## Evaluator Audit

v2 live-validated (N5Q 5/5 correct; 0 false positives; 0 false negatives on the frozen probe set).

## Rationale Audit

`rationale_pass: false` — 5 forbidden cells (R4). 5 additional cells are instrument-side
unclassified (M2); 25 lawful.

## Factual Audit / Handle Audit / Stance Audit / Clarification Audit

`pass: true` each — 0 subject-state claims, 0 unlawful/unbound sources, 0 off-question stances,
0 false CLARIFY.

## Language Fidelity Audit

`pass: false` — solely the 5 instrument-attributed `LANGUAGE_CHOICE_CHANGED` cells (R3).

## Historical S1–S4

NOT RUN (formal stage; gate stopped).

## Transport Health

PASS across qualification: no truncation, no `done_reason=length`, no completed cell above 1843
tokens; per-scenario max 543 (R4).

## Example Copy By Affect Condition

NOT RUN (formal stage).

## Condition Leakage / Request Isolation

0 leakage violations; isolation attested per scenario at freeze time (only the Affect projection
differs across P/N/Z/A).

## Lawful POS / Lawful NEG / Affect Round-Trip

NOT RUN.

## Affect Causal Differentiation Established?

`NO`.

## Affect Phase 2 Closed?

`NO`.

## Can Relationship Phase 3 Begin?

`NO`.

## Allowed Affect Claim

Only instrument-level claims: the v2 evaluator and value family are validated on live data (N5Q
5/5, M2's earlier wording now lawful), the two engineered defects remain repaired, transport health
is green, and the example baseline stays clean (0 copies). No Affect causal claim.

## Forbidden Claims

That the gate "nearly passed" — it is 50/65. That R4 is an instrument problem — it is the model
narrating subject state, correctly caught. That R3 is a Language fidelity failure — Language
preserved the choice; the choice lexicon misfires on a rationale-side hedge. That the qualification
is reproducible run-to-run — it is not, demonstrably (same prompt, different wordings).

## Tests

Instrument probes 0 failures (N5Q 4+3, value 5+5, historical 6+3) · probes 5/5 · sentinel 8/8 ·
deterministic 9/9 — all green and hashed before any model call.

## Full Suite

`pnpm test`: **2466 passed / 0 failed** (3 skipped). ## Typecheck: clean. ## Auxiliary Typecheck:
clean. ## Build: clean. ## Lint: clean after repairing one pre-existing unused import in the
previous review's forensics script (attributed separately). ## Governance: `PASS`. ## Diff Check:
clean.

## Commits

- `acbf1cc` `fix: align affect cognition evaluators with frozen semantics` (research instrumentation
  v2 + probes + regression battery + the pre-existing lint repair)
- research commit for this slice's evidence + report (see Push)

## Push / HEAD / origin/main / Ahead-Behind / Worktree

Normal push to `origin/main`; no amend, no force push; HEAD == origin/main after push; ahead/behind
0/0; worktree clean.

## Recommended Next Slice

**`AFFECT_COGNITION_SUBJECTIVE_RATIONALE_CONTRACT_ARCHITECTURE_REVIEW`** — read-only, zero model
calls, adjudicating exactly the three families this qualification surfaced, and nothing else:

1. **Instrument coverage (M2 ×5):** is the bounded first-person value family the right device at
   all, given that the model paraphrases it run-to-run ("find worthwhile" → "find useful")? Decide
   between a principled semantic detector, a declared wider bounded family, or accepting
   fail-safe unclassified as the contract's intended behavior — without vocabulary whack-a-mole.
2. **Instrument precision (R3 ×5):** the frozen choice lexicon's `HEDGE` test runs over the whole
   delivered text, so a rationale clause ("even if…") reclassifies the choice. Decide the correct
   scoping (choice-sentence vs whole-delivery) as a strictly frozen instrument change, with probes.
3. **Model contract violation (R4 ×5):** "while my energy is high" is a real rule-5b violation the
   contract forbids and the model produced deterministically this run. This is not an instrument
   defect; the review must decide whether it is contract-legibility (again) or a scenario-model
   interaction — without prompt edits by default.

Plus the new cross-cutting finding the review must account for: **run-to-run non-reproducibility at
temperature 0** (per-run 5/5 self-consistent, cross-run divergent). Any future qualification design
must state how it treats that. STOP. Do not execute the recommended next slice.
