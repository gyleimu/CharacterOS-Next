# AFFECT_COGNITION_RATIONALE_VOCABULARY_AND_LATITUDE_LEGIBILITY_V0 — REPORT

**Principal Verdict: `AFFECT_COGNITION_IMPLEMENTATION_FAILED`**
**Qualification: 60/65 → gate NOT met. Formal matrix: NOT RUN. Lawful POS/NEG: NOT RUN.**

The target failure family is fully repaired — R1 is 5/5 lawful with zero forbidden classes and
zero subject-property claims — but the refined contract caused a new deliverability failure on
M3 ×5: the model's cognition JSON now exceeds the frozen 2048-token output budget
(`done_reason=length`), the transport refuses (`MODEL_TRANSPORT_MODEL_OUTPUT_TRUNCATED`), and the
host correctly fails closed. Per §35 the gate stops; per §36 this is the final vocabulary repair
and no further word-level patch is permitted; the evidence is preserved and the failure class is
routed to a read-only review.

## Principal Verdict

`AFFECT_COGNITION_IMPLEMENTATION_FAILED` — as computed by the frozen analysis
(`unreached = 5` → `implementation_intact = false`). The precise mechanism, recorded for the
review: **not** a host defect and **not** a contract-semantics violation — the host validator,
canonicalization and executor behaved correctly (fail-closed on truncated JSON). The change under
test (the longer model-facing contract) made the model's output exceed the frozen
`num_predict = 2048` budget on M3 in all 5 replicates identically (temperature 0), so no semantic
evaluation of those cells is possible. `AFFECT_COGNITION_REVALIDATION_INCONCLUSIVE` would understate
it: the previously-passing M3 was rendered undeliverable by this slice's own change.

## Repository Baseline

Branch `main` at `106712a` (the review commit), clean worktree, `origin/main` identical. Prior
slice: C4.4 `AFFECT_COGNITION_C4_4_RATIONALE_BOUNDARY_FAILED`, 60/65, R1 ×5 the only failure
family, formal matrix not run. Frozen review verdict implemented here unchanged:
`MULTIPLE_INTERACTING_ISSUES` / `AVAILABILITY_MUST_BE_DISTINGUISHED_FROM_CAPABILITY` /
`R1_SCENARIO_VALID_AS_IS` / `KEEP_C4_4_AND_REFINE_VOCABULARY`.

## Final HEAD

`7042202` at freeze and qualification time; research commit follows this report.

## Worktree

Clean; all evidence committed; `HEAD == origin/main` after push.

## Model / Digest

`qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` — verified
at freeze time and unchanged. No `MODEL_BASELINE_CHANGED`.

## Architecture Changed?

`NO`. Selection semantics, handle architecture, canonicalization, validators, executor, Language
and Affect are byte-unchanged.

## Protocol Version Changed?

`NO`. Still `conversation-cognition-proposal-v6` + `language-realization-input-v7` +
`language-realization-semantic-draft-v1`; the change is model-facing contract text, bound into the
freeze by `cognition_prompt_sha256`.

## Scenario Changed?

`NO` — all 13 qualification and 17 formal scenarios byte-identical (`lib/config.mjs` carries the
frozen scenario bytes; only slice-identity strings and protocol notes differ from the C4.4 copy).

## Classifier Changed?

`NO` — `lib/classify.mjs` byte-identical to C4.4, proven inside the freeze
(`harness.classifier_unchanged_from_c4_4: true`). No relaxation, no R1 special-case, no
availability special-case.

## Threshold Changed?

`NO` — qualification 65/65, formal 168/168 + 84/84 + materiality floors, Family-D rules: all
byte-identical.

## Vocabulary-Legibility Repair

One production file changed:
`packages/runtime/src/providers/behavior/conversation-cognition-provider-v6.ts`, cognition rules
2, 5a, 5b, 6, 10 (5 lines replaced). Content exactly as adjudicated:

- **Rule 2 — Latitude Rule:** latitude is fact-relative; lawful "the supplied facts permit either
  volunteering or declining"; forbidden "the subject has capacity/capable of/can manage either
  response".
- **Rule 5a — positive worked examples** (see below).
- **Rule 5b — Availability Rule + Capacity Rule:** AVAILABILITY IS NOT CAPACITY — a supplied
  availability fact establishes only that fact; no free-time→capacity/capability/energy or
  low-stress→capability mapping; never restate a situational fact as a subject property (free slot
  ≠ subject capacity; no conflict ≠ subject capability; available time ≠ subject bandwidth;
  20-minute fit ≠ subject energy). Adds the fact-plus-action rule: "I have time available, so I
  would help." is not a rationale; the fact belongs in `factual_assessment`.
- **Rule 6:** the rationale may reference an external premise only inside a preference frame.
- **Rule 10 — Subject-Property Rule:** claims state situation-side facts, never subject-side
  properties; lawful and unlawful claim examples given verbatim.

## Positive Worked Examples

Lawful: "I'd rather stop here.", "I prefer the reversible option.", "I'd rather avoid extra work
whose benefit is unknown.", "I'd rather help.", "I prefer to use the free time to help.",
"I'd be willing to spend the available time on the review.", "I'd prefer to decline."
Unlawful: "I have enough capacity", "I am capable", "within my operational scope", "I can manage
it", "I have available capacity.", "My energy is high enough.", "My mind is fresh.",
"I can manage the workload."

## Availability Rule

A supplied fact that time or resources are available establishes only that fact. It is lawful as a
sourced factual claim; it does not establish capacity, capability, ability, energy, readiness,
workload tolerance or any other subject-side condition.

## Capacity Rule

`capacity` is a subject-side property term. It may not appear in `subjective_rationale` and may not
be the subject of a factual claim. Availability does not imply capacity.

## Capability Rule

Same prohibition as capacity ("capable", "ability", "able to", "bandwidth", "readiness",
"workload tolerance", "resilience"). Not licensed by availability.

## Latitude Rule

Behavioral latitude is a relation between the supplied facts/rules and the available responses,
stated fact-relative — never a newly inferred canonical property of the subject.

## Subject-Property Rule

Claims may state supplied world facts; they may never assert subject-side properties. This
formalizes the C4.4 rule 10 as an explicitly named, nameable defect class.

## Zero-Model Probe Freeze Hash

- `probes.mjs` → `sha256:d32caf02f85b513985f71fb3df2a3aed0ca5122e631f8fca206b2d44a4ef49ee`
- `probe-results.json` →
  `sha256:b806eac162135f4134a232cac874c125db4fcb46be8f1c27e98cec761dc992ba` (bound into the
  freeze as `harness.probe_results_sha256`)

## Probe Results

27/27 pass, 0 strict divergences, 0 class-expectation misses. One declared lenient gap (not
repaired): the frozen classifier does not police "workload tolerance" in claims (`FU-4`); the
contract forbids it, the instrument is silent — recorded, never patched. Coverage: lawful
rationales 5/5 lawful; forbidden rationales 10/10 unlawful; fact-plus-action not a rationale;
availability claims lawful; subject-property claims unlawful; fact-relative latitude lawful,
subject-relative latitude and latitude-as-rationale unlawful.

## Historical R1 Still Fails Old Contract?

`YES` — the frozen C4.4 rationale "I prefer to utilize my available capacity to assist with the
task." still classifies `INFERRED_CAPACITY` (probe `HR-1` and re-classification of all 5 frozen R1
cells from `qualification-raw.jsonl`). Old evidence was not made green.

## Production Files Changed

One file, 5 lines: `packages/runtime/src/providers/behavior/conversation-cognition-provider-v6.ts`
(cognition system-prompt rules 2, 5a, 5b, 6, 10). Schema, wire types, handle types,
canonicalization, validator, executor, Language schema, Affect: untouched.

## Implementation Commit

`7042202` `fix: clarify rationale availability and capability semantics`

## Sentinel

7 sentinel tests + 1 new frozen-mechanics test + 5 probe tests green (zero model calls): V6
selection protocol unchanged, both selection rules unchanged, latitude discriminator unchanged,
handle rules and wire keys unchanged, no `projection_hash`, Language protocol unchanged,
condition-blind ids, all refined contract strings present (3 lawful examples, 5 unlawful examples,
availability≠capacity, no-mapping rule, fact-relative latitude example, forbidden subject-relative
form, lawful fact-relative claim).

## Qualification Freeze Hash

`sha256:f0ac408082d9b501e729230519b2d90799dd69cb703255f898ceefd1ba4d036d` — minted at HEAD
`7042202` after probes were green, before the first governed call; harness digests re-checked by
the collector.

## Qualification Calls

65 cognition calls, 60 language calls. 0 retries, 0 replacements, 0 per-cell reruns. Evidence
append-only (`qualification-raw.jsonl`).

## N1

5/5 `NO_SUBJECTIVE_SELECTION`, fact correct, handles bound, full delivery.

## N2

5/5 — same. (C4.4's original citation-binding family remains fixed.)

## N3

5/5 — same.

## N4

5/5 — same.

## N5Q

5/5 — same.

## N6

5/5 — same. (§28 explicitly requires N6 5/5: met.)

## M1

5/5 `SUBJECTIVE_SELECTION`, on-question, `PURE_PREFERENCE`, Language `PRESERVED`, handles bound.
Stance class shifted to `SECOND_OPTION` (decline) — see Stance Audit.

## M2

5/5 — `FIRST_OPTION` (attend), unchanged from C4.4.

## M3

**0/5 — `FAILED` before Language.** All 5 replicates identical:
`ModelTransportErrorV0: MODEL_TRANSPORT_MODEL_OUTPUT_TRUNCATED` — ollama native generation
truncated by the provider token budget (`done_reason=length, prompt_eval_count=3684,
eval_count=2048, num_ctx=8192, num_predict=2048`). The transport refused; the host failed closed
(`SERVICE_UNAVAILABLE/FAIL-SERVICE-001`); 0 language calls. C4.4's M3 was 5/5 COMPLETE. The refined
contract (≈400 additional prompt tokens) is the only delta; the model's JSON now exhausts the
frozen 2048-token output budget on this scenario. Not a semantic violation; not evaluable.
Generation settings are frozen — no tuning permitted — so the cells stand as failures.

## R1

**5/5 pass — the target family is repaired.** Each cell: `SUBJECTIVE_SELECTION`, on-question
`SECOND_OPTION` ("I would decline to volunteer for the review."), rationale
`"I'd rather avoid extra work whose benefit is unknown."` (`PURE_PREFERENCE`/aversion frame),
claims include the fact-relative latitude statement
("The supplied facts permit either volunteering or declining, as both are behaviourally admissible
and fact-compatible responses."), handles bound, Language `PRESERVED`.

## R2

5/5 — `SECOND_OPTION`, `PURE_PREFERENCE`, clean.

## R3

5/5 — `SECOND_OPTION`, `PURE_PREFERENCE`, clean (unchanged from C4.4).

## R4

5/5 — `FIRST_OPTION`, `PURE_PREFERENCE`, clean.

## Qualification Aggregate

60/65. Applicability: 30 `NO_SUBJECTIVE_SELECTION` + 30 `SUBJECTIVE_SELECTION` + 5 `UNLAWFUL`
(the refused M3 cells). Rationale: 35 `ABSENT`, 30 `PURE_PREFERENCE`, **0 forbidden**.
Stances: 35 null, 20 `SECOND_OPTION`, 10 `FIRST_OPTION`. Handle binding: **65/65 `HANDLE_BOUND`**.
Language: 60/60 `PRESERVED` where reached; 0 completions, 0 invented preferences.

## R1 Rationale Audit

5/5 lawful-or-null: all 5 `PURE_PREFERENCE` (aversion frame), 0 forbidden classes, 0 off-question.
No specific wording was required; the model chose an aversion-frame preference.

## R1 Factual Audit

0 subject-property assertions (C4.4 had 5). Claims are situation-side: the free slot, the
20-minute task, the request for a personal choice, and the fact-relative latitude statement. All
sources bound (`F3` = the observation).

## Null Aggregate

30/30 `NO_SUBJECTIVE_SELECTION` — §28 met, no regression.

## Selection Aggregate

30/30 reached choice cells `SUBJECTIVE_SELECTION` on-question (35/35 excluding the 5 refused M3
cells, which never produced a proposal). §29 met for every evaluable cell.

## Handle Aggregate

65/65 `HANDLE_BOUND`, 0 unknown, 0 malformed, 0 namespace escalation, 0 canonicalization failures
(§32–§33 met).

## Rationale Violations

0 across all 65 cells (§31 met). The C4.4 `INFERRED_CAPACITY` family is gone.

## Subject-Property Claims

0 across all 65 cells (§32 met). C4.4 had 5.

## Language Semantic Completions

0 (§34 met for every cell that reached Language).

## Qualification Passed?

`NO` — 60/65. M3 ×5 refused on transport truncation. Gate stopped per §35.

## Formal Matrix Run?

`NO` — §35: "If qualification fails: STOP. Do NOT run the formal matrix."

## Formal Freeze Hash

`sha256:db93a6e6430a3fc132e16155da5e965d0e36550739ca7afbd9994ee3b78ef6aa` — re-minted at HEAD
`7042202` with the new `cognition_prompt_sha256` (per §39), before the qualification; the matrix
itself was not executed and this freeze now waits on a future qualifying slice.

## Formal Calls

0.

## Null Formal Aggregate

NOT RUN.

## Mixed Formal Aggregate

NOT RUN.

## R1 P/N

NOT RUN.

## R2 P/N

NOT RUN.

## R3 P/N

NOT RUN.

## R4 P/N

NOT RUN.

## Relevant Material Aggregate

NOT RUN.

## TVD / JS

NOT RUN.

## Factual Audit

Qualification: 130 claims total, 0 subject-state assertions, 0 unlawful source attempts, 0 unbound
claim sources → `pass: true`.

## Handle Audit

65/65 `HANDLE_BOUND` → `pass: true`.

## Rationale Audit

0 forbidden-class cells → `pass: true`.

## Stance Audit

0 off-question stances → `pass: true`. **Recorded observation for the review:** under `AFFECT_ABSENT`
the stance distribution shifted versus C4.4 — M1 and R1 and R2 moved from `FIRST_OPTION`
(volunteer/try) to `SECOND_OPTION` (decline/keep), M2 and R4 unchanged, R3 unchanged. The added
lawful example "I'd prefer to decline." is the only new decline-shaped text in the contract; at
temperature 0 the shift is deterministic and could reflect example anchoring. Lawful for this
qualification (any on-question stance passes), but material for the causal matrix, where the stance
class is the endpoint: an example-induced anchor could mask or mimic an Affect effect.

## Language Fidelity Audit

60/60 reached cells `PRESERVED`; 0 `CHOICE_CHANGED`, 0 dropped, 0 invented, 0 semantic completions,
0 fact changes/contradictions → `pass: true`.

## Clarification Audit

0 false CLARIFY → `pass: true`.

## Historical S1–S4

NOT RUN (formal-matrix stage; gate stopped).

## Condition Leakage

0 violations → `pass: true` (§47 met).

## Request Isolation

Attested per scenario at freeze time: only the Affect projection differs across P/N/Z/A; prompts,
schemas, handle maps and settings identical (§46 met for the qualification; formal isolation was
not exercised).

## Lawful POS

NOT RUN.

## Lawful NEG

NOT RUN.

## Affect Round-Trip

NOT RUN.

## Affect Causal Differentiation Established?

`NO`. No causal claim is established or refuted by this slice.

## Affect Phase 2 Closed?

`NO`.

## Can Relationship Phase 3 Begin?

`NO`.

## Allowed Affect Claim

Only this: with the refined vocabulary contract, wherever the model's output was deliverable, the
rationale boundary and subject-property boundary hold (0 violations in 60/65 cells), R1 is repaired
5/5, and every C4.4 semantic property is preserved. No Affect causal claim.

## Forbidden Claims

That the availability≠capacity contract "fixed" the model (the M3 deliverability failure is caused
by the same change); that Affect differentiation was tested; that the stance shift toward decline is
or is not an Affect effect (it occurred under `AFFECT_ABSENT`, so it is contract-induced, not
Affect-induced); that C4.4's formal-freeze remains valid (it does not — the prompt digest changed).

## Tests

Zero-model suites this slice: probes 5/5, sentinel 8/8, deterministic 9/9, plus the probe CLI
(27 cases) green and hashed before any model call.

## Full Suite

`pnpm test`: **2466 passed / 0 failed** (3 skipped).

## Typecheck

Clean (`tsc -p tsconfig.workspaces.json`).

## Auxiliary Typecheck

Clean (`tsconfig.auxiliary.json`), exit 0.

## Build

Clean (15 workspaces).

## Lint

Clean (`eslint . --max-warnings 0`).

## Governance

`PASS` (15 workspaces, 21 conformance test files).

## Diff Check

`git diff --check` clean.

## Commits

- `7042202` `fix: clarify rationale availability and capability semantics` (production, 1 file,
  5 lines)
- research commit for this slice's evidence + report (see Push)

## Push

Normal push to `origin/main`; no amend, no force push.

## HEAD

See Push section — final HEAD after the research commit.

## origin/main

Identical to HEAD after push.

## Ahead / Behind

`0 / 0`.

## Worktree

Clean.

## Recommended Next Slice

**`AFFECT_COGNITION_CONTRACT_SIZE_AND_EXAMPLE_NEUTRALITY_ARCHITECTURE_REVIEW`** — read-only, no
model calls, no implementation. The remaining failure class is not a rationale-vocabulary variant
(§37's `..._SUBJECTIVE_RATIONALE_CONTRACT_ARCHITECTURE_REVIEW` route does not apply: the rationale
endpoint is 0/65 violations). It has two parts, both caused by the same change and both requiring
adjudication, not another word patch:

1. **Contract size vs frozen generation budget:** the refined contract (~400 extra prompt tokens)
   pushed the model's M3 JSON past the frozen `num_predict = 2048`, failing delivery 5/5. The
   review must decide the lawful remedy space (contract compression, claim-budget guidance, or a
   generation-setting change as an explicitly frozen, separately justified baseline change) without
   tuning to green.
2. **Worked-example neutrality:** the decline-shaped example correlates with a deterministic stance
   shift on M1/R1/R2 under `AFFECT_ABSENT`. Before any formal Affect matrix runs, the review must
   judge whether the positive examples are stance-neutral enough that the causal endpoint
   (stance class) measures Affect rather than example anchoring.

STOP. Do not execute the recommended next slice.
