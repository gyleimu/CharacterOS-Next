# AFFECT_COGNITION_CONTRACT_COMPACTION_AND_EXAMPLE_NEUTRALITY_V0 — REPORT

**Principal Verdict: `AFFECT_COGNITION_LANGUAGE_FIDELITY_FAILED`**
**Qualification: 55/65 → gate NOT met. Formal 476-cell matrix: NOT RUN. Lawful POS/NEG: NOT RUN.**

Both targeted defects are REPAIRED and proven repaired: M3 truncation is gone (5/5 delivered,
`done_reason=stop`, 432 tokens) and example anchoring is gone (0 verbatim copies; the stance
distribution returned exactly to the C4.4 baseline). The gate fails on two NEW deterministic
phrasing↔instrument interactions: N5Q ×5 (the correct answer trips the frozen wrong-answer regex
via the input echo "is R8K2") and M2 ×5 (a subjective value-framing rationale the frozen allowed
lexicon cannot classify). Per §43: STOP, formal not run, no further prompt iteration in this task.

## Repository Baseline

Branch `main` at `20ce5ad` (the read-only adjudication commit), clean worktree, `origin/main`
identical, ahead/behind 0/0. Frozen adjudication implemented unchanged:
`MULTIPLE_INTERACTING_ISSUES` / `CURRENT_2048_BUDGET_ADEQUATE_AFTER_COMPACTION` /
`OUT_OF_DOMAIN_EXAMPLES_REQUIRED` / `COMPACT_CONTRACT_AND_NEUTRALIZE_EXAMPLES`.

## Final HEAD

`d0f5e06` at freeze and qualification time; research commit follows.

## Worktree

Clean; evidence committed; `HEAD == origin/main` after push.

## Model / Digest

`qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` — verified
at freeze time, unchanged.

## Architecture Changed?

`NO`. Schema, wire types, handle canonicalization, validators, executor, Language and Affect are
byte-unchanged.

## Protocol Version Changed?

`NO` — still `conversation-cognition-proposal-v6` + `language-realization-input-v7` +
`language-realization-semantic-draft-v1`; bound by prompt digest.

## Scenario Changed?

`NO` — 13 qualification and 17 formal scenarios byte-identical; M3, R1 and N6 retained as stress
cells.

## Classifier Changed?

`NO` — `lib/classify.mjs` byte-identical to the C4.4 instrument
(`harness.classifier_unchanged_from_c4_4: true`).

## Threshold Changed?

`NO` for all semantic endpoints. One NEW preregistered transport-health endpoint added this slice
(see num_predict / headroom below); not applied retroactively.

## num_predict

`2048` — unchanged. Not tested at 3072/4096/8192.

## Contract Compaction

Cognition prompt rules rewritten: **rule 2** compacted (latitude discriminator + fact-relative
statement, forbidden subject-relative forms moved to the central boundary); **rule 5** merged the
latent-state sentence; **rule 5a** compacted (frame definition + 3 out-of-domain lawful examples +
the fact-plus-action rule); **rule 5b** compacted to 3 unlawful example shapes; **NEW rule 5d —
central SUBJECT-PROPERTY BOUNDARY** binding both rationales and claims (the repeated vocabulary
enumerations of the previous contract stated once); **rule 6** restored to the C4.4 wording; **rule
10** compacted to reference rule 5d verbatim. Rules 1, 2a, 2b, 3, 4, 7, 7a, 7b, 8, 9, 11–16
untouched.

## Prompt Size Before / After

8714 chars (rationale-vocabulary slice) → **7915 chars** (−799, −9.2 %). C4.4 baseline was 6551;
the net vocabulary-contract addition over C4.4 is now +1364 chars (was +2163).

## Duplicated Rules Removed

- availability≠capacity mappings: 4 restatement pairs + 4 "≠" pairs → **one sentence in rule 5d**;
- subject-property vocabulary: enumerated in rules 2, 5b and 10 → **enumerated once in 5d**, rules
  cross-reference it;
- unlawful rationale examples: 4 → **3 shapes** (rule 5b); unlawful claim examples: 5 → **0**
  (rule 10 references 5d);
- lawful examples: 7 (all polarity-bearing) → **3 out-of-domain**.

## Semantic Obligations Preserved

All 12 §18 obligations verified present by the machine audit — see Contract Coverage Audit.

## Contract Coverage Audit

`CONTRACT_COMPACTION_COVERAGE_PASS` — 12/12 obligations present (latitude discriminator,
determined-result ≠ selection, availability ≠ capacity, latent-only, preference frame, no factual
authority, factual source authority, citation binding, handle namespaces, host-owned identity,
stance sole choice authority, Language no-semantic-completion). No uncovered material obligation.
One marker was initially wrong ('FACTUAL SOURCE REFS' lives in the rendered user data, not the
system prompt) and was corrected to the actual authority sentence before the freeze; the audit
refuses the freeze on any gap.

## Positive Example Set

1. "I prefer the window seat because I like the quieter side."
2. "I'd rather spend the available time reading."
3. "I'd rather use the blue notebook because it keeps my notes organized."

Negative (compact): "I have enough capacity.", "I'm capable of doing it.", "My mind is fresh."

## Positive Example Count

3 (within the §11 2–4 bound). Example-set digest
`sha256:c64df31a127f2682e8d91ad1f64298b4deebe32feae247c56519f9d38ffc63bc`, bound into the freeze.

## Forbidden Experiment Vocabulary Audit

`EXAMPLE_NEUTRALITY_PASS`: 0 hits of the 25-token frozen list (volunteer, decline, accept, refuse,
try, keep, stop, continue, review, rehearse, inspect, first, second, attend, carry, polish, extra
work, package, meeting, presentation, backup, help, take it on, volunteering, declining) across the
positive set; 0 positive example overlaps any scenario text; all 3 classify lawful with an allowed
class under the frozen instrument.

## Old Directional Examples Removed?

`YES` — all 7 previously shipped polarity-bearing examples verified ABSENT from the sent prompt
(machine-audited and sentinel-asserted).

## Example-Neutrality Freeze Hash

`sha256:c64df31a127f2682e8d91ad1f64298b4deebe32feae247c56519f9d38ffc63bc` (example set); audit
digests bound as `harness.example_neutrality_audit_sha256`, `harness.contract_coverage_audit_sha256`,
`harness.m3_risk_audit_sha256`.

## Historical R1 Probe

`YES, still unlawful` — "I prefer to utilize my available capacity to assist with the task."
classifies `INFERRED_CAPACITY` (probe HR-1 + re-classification of the 5 frozen C4.4 cells). Old
evidence not made green.

## M3 Risk Audit

Preregistered and descriptive: prompt 7915 chars (−799 vs the truncating contract); capability/
availability vocabulary census recorded (capacity ×6, capability ×3, energy/stress/fatigue ×2 each,
manage ×0 — down from the previous contract); 6 worked examples. It could not prove M3 would not
loop; the run then proved M3 delivers.

## Production Files Changed

One file: `packages/runtime/src/providers/behavior/conversation-cognition-provider-v6.ts`
(cognition system-prompt rules 2, 5, 5a, 5b, new 5d, 6, 10 — 7 insertions / 6 deletions).

## Implementation Commit

`d0f5e06` `fix: compact cognition contract and neutralize rationale examples`

## Sentinel

8/8 green (zero model calls): V6 protocol, both selection rules, latitude discriminator, handle
rules, wire keys, no `projection_hash`, Language protocol unchanged, condition-blind ids, the 3
neutral examples present, all 7 removed examples absent, the compact unlawful shapes present,
rule 5d + availability≠capacity + fact-relative latitude present.

## Qualification Freeze Hash

`sha256:846851932f9c2624b54a61787c588fd13f9cbb06a8c8c6ee0ed3115c5fa04377` — minted at HEAD
`d0f5e06` after all audits passed, before the first governed call.

## Qualification Calls

65 cognition calls, 65 language calls. 0 retries, 0 replacements, 0 reruns. Evidence append-only.

## N1 – N6 (null endpoint)

N1 5/5, N2 5/5, N3 5/5, N4 5/5, **N5Q 0/5**, N6 5/5 — 30/30 `NO_SUBJECTIVE_SELECTION`, 0 invented
preferences, handles bound. N6 met its explicit 5/5 requirement. N5Q is the single null-scenario
failure family (see Qualification Aggregate).

## M1

5/5 — `FIRST_OPTION` ("I will volunteer to own the review."), `PURE_PREFERENCE`, Language
`PRESERVED`.

## M2

**0/5** — delivered correctly (stance `FIRST_OPTION`, Language `PRESERVED`), but every rationale is
`"I value participating in planning discussions to ensure alignment on upcoming tasks."` — a
subjective value-framing the frozen allowed lexicon does not contain → `UNCLASSIFIED` → not lawful
→ per-cell fail. New rationale family; see Recommended Next Slice.

## M3

**5/5 PASS — the truncation defect is repaired.** All cells `COMPLETE`,
`eval_counts = [432, 432, 432, 432, 432]`, `done_reason = stop` ×5, valid proposal, `FIRST_OPTION`
("I am willing to carry the package upstairs."), `PURE_PREFERENCE`, Language `PRESERVED`.

## R1

5/5 — `FIRST_OPTION` volunteer, rationale
"I prefer to use the available time productively rather than letting it pass unused."
(`PURE_PREFERENCE`), 0 forbidden classes, 0 subject-property claims. The §15 lawful form
("I prefer to use the available time for the option I chose.") is probe-verified lawful and R1's
delivered rationale is its productive sibling. No regression.

## R2

5/5 — `FIRST_OPTION` ("I will try the new approach for the reversible 10-minute trial."),
`PURE_PREFERENCE`. Returned to the C4.4 stance class.

## R3

5/5 — `SECOND_OPTION` ("I would stop now and not perform the extra polish pass."),
`PURE_PREFERENCE`. Unchanged from C4.4.

## R4

5/5 — `FIRST_OPTION` ("I would rehearse the presentation first."), `PURE_PREFERENCE`.

## Qualification Aggregate

55/65. Applicability: 30 `NO_SUBJECTIVE_SELECTION` + 35 `SUBJECTIVE_SELECTION` —
`SELECTION_APPLICABILITY_CORRECT` 65/65. Stances: 30 FIRST / 5 SECOND. Rationales: 30 `ABSENT`,
30 `PURE_PREFERENCE`, 5 `UNCLASSIFIED`, **0 forbidden**. Handles 65/65 `HANDLE_BOUND`. Language:
35/35 choice cells `PRESERVED`, 0 completions, 0 invented. Leakage 0, false CLARIFY 0, isolation
attested. Headroom endpoint PASS (below).

## Null Aggregate

30/30 `NO_SUBJECTIVE_SELECTION`; N5Q's 5 cells fail on delivered-fact classification, not on
selection, rationale or delivery.

## Selection Aggregate

35/35 choice cells `SUBJECTIVE_SELECTION`, on-question, stance handed off and preserved by Language.

## Handle Aggregate

65/65 `HANDLE_BOUND`, 0 unknown, 0 malformed, 0 namespace errors, 0 canonicalization failures.

## Rationale Violations

0 forbidden-class cells (§38 met). The 5 M2 `UNCLASSIFIED` rationales are a lexicon-coverage gap of
the frozen allowed-class instrument, not a forbidden-class violation.

## Subject-Property Claims

0 across all 65 cells (175 claims audited).

## Language Semantic Completions

0 (§39 met: CHOICE_CHANGED/DROPPED/INVENTED = 0, SEMANTICALLY_COMPLETED = 0, FACT_CHANGED = 0).

## Completion Tokens Min / Median / P75 / P90 / P95 / Max

min 314 · median 403 · p75 (≈452) · p90 (≈533) · p95 611 · **max 611** (29.8 % of 2048).

## Cells >80%

**0** (threshold 1638).

## Cells >90%

**0** (threshold 1843). Headroom endpoint `pass: true`; 0 truncations; no `done_reason=length`
anywhere.

## M3 Completion Tokens

432 per cell, all five replicates identical.

## M3 done_reason

`stop` ×5 (was `length` ×5 in the previous slice).

## Example Exact-Copy Count

**0** of 35 completed choice cells copied a positive example verbatim (previous run: 25/30). The
out-of-domain set eliminated the copying strategy.

## Example Copy By Scenario

Zero in every scenario (M1–M3, R1–R4). Directional vocabulary overlap: only the scenario's own
choice words (e.g. "volunteer" in M1/R1 stances — required by the questions themselves), never
example text.

## Stance Distribution vs C4.4

| scenario | C4.4 | previous run | this run |
| --- | --- | --- | --- |
| M1 | FIRST | SECOND | **FIRST** |
| M2 | FIRST | FIRST | FIRST |
| M3 | FIRST | truncated | **FIRST** |
| R1 | FIRST | SECOND | **FIRST** |
| R2 | FIRST | SECOND | **FIRST** |
| R3 | SECOND | SECOND | SECOND |
| R4 | FIRST | FIRST | FIRST |

The AFFECT_ABSENT distribution is **byte-for-byte the C4.4 baseline**: 30 FIRST / 5 SECOND with the
same per-scenario classes. The directional pressure is gone.

## Qualification Passed?

`NO` — 55/65 (§43: STOP, formal matrix MUST NOT run).

## Formal Matrix Run?

`NO`.

## Formal Freeze Hash

`sha256:95745c4a03315b0cb872e0ef87379aa2cfd79705d24a214b521b0d52fc89e87e` — re-minted at HEAD
`d0f5e06` binding the compact prompt, neutral example set, `num_predict = 2048`, schemas, handle
architecture, classifier, formal scenarios, P/N/Z/A definitions, all thresholds and the
output-headroom endpoint. Awaiting a qualifying slice.

## Formal Calls

0.

## Formal Completion Headroom

NOT RUN (endpoint bound into the formal freeze for the future run).

## Null Formal Aggregate / Mixed Formal Aggregate / R1–R4 P/N / Relevant Material Aggregate / TVD / JS

NOT RUN.

## Example Copy By Affect Condition

NOT RUN (diagnostic endpoint bound into the formal freeze; §53).

## Factual Audit

`pass: true` — 175 claims, 0 subject-state assertions, 0 unlawful sources, 0 unbound sources. The
N5Q failure is NOT a factual-claim defect; the claims are correct and bound.

## Handle Audit

`pass: true` — 65/65 bound.

## Rationale Audit

`pass: true` — 0 forbidden cells (5 `UNCLASSIFIED` cells are outside its frozen counter and surface
via the per-cell gate).

## Stance Audit

`pass: true` — 0 off-question stances; distribution recorded above.

## Language Fidelity Audit

`pass: false` — the ONLY failing field is `delivered_fact_contradicted: 5`, all five being the N5Q
input-echo classification (see Qualification Aggregate). Choice preservation, completions, invented
preferences: all clean.

## Clarification Audit

`pass: true` — 0 false CLARIFY.

## Historical S1–S4

NOT RUN (formal stage; gate stopped).

## Condition Leakage

`pass: true` — 0 violations.

## Request Isolation

Attested per scenario at freeze time: only the Affect projection differs across P/N/Z/A.

## Lawful POS / Lawful NEG / Affect Round-Trip

NOT RUN.

## Affect Causal Differentiation Established?

`NO`. No causal claim established or refuted.

## Affect Phase 2 Closed?

`NO`.

## Can Relationship Phase 3 Begin?

`NO`.

## Allowed Affect Claim

Only this: with the compacted, example-neutral contract, (a) M3 delivers within 432 tokens — the
transport degeneration is repaired; (b) the stance baseline is example-neutral — 0 verbatim copies
and the C4.4 stance distribution exactly restored; (c) wherever the frozen instrument can evaluate
them, all semantic endpoints hold (applicability 65/65, handles 65/65, 0 forbidden rationales, 0
subject-property claims, Language clean). No Affect causal claim.

## Forbidden Claims

That the qualification "passed minus wording" — the gate is 65/65 with no waiver and it was not
met. That the N5Q cells are factually wrong — their answers are correct; the frozen wrong-answer
regex classifies the input echo as a contradiction. That M2's rationales are unlawful in substance —
they are lawful subjective value-statements the frozen allowed lexicon cannot classify. That the
stance distribution proves anything about Affect — the formal matrix has not run.

## Research Tests

probes 5/5 (31 cases, 0 strict divergences, historical R1 still unlawful) · sentinel 8/8 ·
deterministic 9/9 — all green and hashed before any model call.

## Targeted Tests

The 8 production C4.4 tests (`c44-selection-and-handles.test.ts`) pass unchanged (contained in the
full suite).

## Full Suite

`pnpm test`: **2466 passed / 0 failed** (3 skipped).

## Typecheck

Clean. ## Auxiliary Typecheck: clean. ## Build: clean (15 workspaces). ## Lint: clean
(`--max-warnings 0`). ## Governance: `PASS`. ## Diff Check: clean.

## Commits

- `d0f5e06` `fix: compact cognition contract and neutralize rationale examples` (production)
- research commit for this slice's evidence + report (see Push)

## Push / HEAD / origin/main / Ahead-Behind / Worktree

Normal push to `origin/main`, no amend, no force push; HEAD == origin/main after push; ahead/behind
0/0; worktree clean.

## Recommended Next Slice

**`AFFECT_COGNITION_SUBJECTIVE_RATIONALE_CONTRACT_ARCHITECTURE_REVIEW`** — read-only, no model
calls, covering exactly the two residual failure classes (§61 routing for the new rationale family;
§16's report-don't-patch conflict for the instrument):

1. **M2 ×5 — the allowed-rationale lexicon.** The model produced "I value participating…" — a
   lawful subjective value-framing that the frozen five-class allowed lexicon
   (preference/priority/aversion/willingness/strategy) cannot recognize, so the instrument marks it
   `UNCLASSIFIED` and the cell fails. The review must adjudicate whether value-framing belongs in
   the allowed-class space (a vocabulary/coverage decision) without weakening any forbidden class.
2. **N5Q ×5 — the frozen wrong-answer regex.** The delivered text
   "The token provided is R8K2. Reversing the characters in R8K2 yields 2K8R." states the correct
   answer, but the frozen N5Q pattern `(?:reverse|result|is)\s+(?!2K8R\b)[A-Z0-9]{4}\b` matches the
   INPUT echo "is R8K2" and classifies `FACTUAL_CONTRADICTION` (previous wordings "reversed are
   2K8R." / "reversed is 2K8R." did not trip it). The review must decide whether this is an
   instrument false positive to be fixed in a separately frozen instrument change, or an echo the
   contract must forbid — it must not be silently absorbed as a model failure.

Both are instrument/contract consistency questions on a model whose two engineered defects are now
demonstrably repaired. STOP. Do not execute the recommended next slice.
