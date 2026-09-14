# AFFECT_COGNITION_C4_2_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_V0 — REPORT

## Principal Verdict

```
AFFECT_COGNITION_C4_2_FACTUAL_ASSESSMENT_FAILED
```

Qualification reached **60/65** (gate 65/65), so the **formal 476-cell matrix was not run** and the
lawful POS/NEG stage was not executed.

The verdict names the component that failed the gate — a **factual-citation binding omission** on
`N2` (5/5 cells), where the host refused the turn because a `factual_assessment` claim cited
`observation:o-session-t2` while `cognition.considered_context_refs` omitted it. Every endpoint this
slice was chartered to correct **passed**:

| C4.2 target | Result |
| --- | --- |
| Choice applicability (not to regress) | **65/65** (30 `NOT_APPLICABLE`, 35 `SELECTED`) |
| Rationale boundary (latent subject state) | **0 forbidden cells** — 30 `PURE_PREFERENCE`, 35 `ABSENT` |
| Stance grounding | **35/35 `ON_QUESTION_STANCE`**, 0 off-question |
| Language non-completion | **65/65 `PRESERVED`**, 0 semantic completions |
| Family-D triggers | both **NOT TRIGGERED** |
| C4 factual-authority properties | preserved: 0 self-state claims, 0 unlawful source attempts |

## Repository Baseline

`main` at `55a48ba` (`research: adjudicate c4 subjective basis and stance grounding`), clean
worktree, verified before any change.

## Final HEAD

Production `3cfbfac` (`fix: tighten subjective basis and stance grounding`), then the research commit
for this report.

## Architecture Changed Beyond C4.2?

`NO`. No new canonical state, no action ontology, no option taxonomy, no `choice_space`, no
`selected_option_ref`, no second Cognition call, no Family D. The proposal/language schemas and hash
domains are unchanged.

## Canonical Affect Changed?

`NO`

## Rationale Policy

Frozen allowed classes: `PURE_PREFERENCE`, `PRIORITY`, `AVERSION`, `WILLINGNESS`,
`SUBJECTIVE_STRATEGY`. Frozen forbidden classes: `RAW_SELF_STATE_DESCRIPTION`,
`NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`, `EXTERNAL_FACT`, `HISTORY_CLAIM`. A rationale that
is unclassifiable does **not** default to lawful. Carried in the prompt (rules 7a–7c) and enforced by
the qualification classifier.

## Subject State Verbalization

```
FORBIDDEN
```

State may shape the choice and must stay latent; no mapping from regulation/affect values to
psychological language may be created by the model or by the architecture.

## Historical M1 Regression

`"My current state shows high energy and low stress, making me willing to take on this task."` →
`RAW_SELF_STATE_DESCRIPTION`, cell fails. Verified by the zero-model replay of the frozen C4 evidence.

## Historical R4 Regression

`"…so I prefer to tackle it while my mind is fresh…"` → `RAW_SELF_STATE_DESCRIPTION` (the C4
vocabulary miss is closed), cell fails.

## Historical M3 Regression

`"…is within my operational scope…"` → `INFERRED_CAPACITY`, cell fails — vague capability language no
longer bypasses the policy.

## Historical M2 Regression

Historical stance `"I would volunteer."` for the attendance request → `OFF_QUESTION_STANCE`, and the
delivered `"I would volunteer to attend…"` → `SEMANTICALLY_COMPLETED_BY_LANGUAGE` with the decision
token `attend`. Both required classifications hold (`historical-replay.json`).

## Lexical Grounding Guard Evaluated?

`YES — once`, against the suite frozen beforehand
(`suite_sha256: sha256:2e810540b4c273d6061444914f09f315f863b617cdc61116663ef11dcd96d21e`).

## Paraphrase Suite Size

40 lawful examples (binary, yes/no willingness, preference, priority ordering, conditional,
open-ended, mixed fact+choice, synonym-heavy, ellipsis, pronoun-heavy) + 20 invalid/off-question
examples (including the historical M2 form) + 3 separately-reported lexical-ceiling diagnostics.

## Lawful Paraphrase Acceptance

**34/40** (required ≥ 38). Rejected lawful forms: `L29` open-ended, `L35–L38` synonym-heavy
(`"I'd join."`, `"I'd be up for it."`, `"I'd stick with what we're using."`, `"I'd call it done."`),
`L39` ellipsis.

## Invalid Stance Detection

**15/20** (required 20/20). Missed: `X02` plan-shaped stance (the request text contains the proper
noun `Alice`, which the stance reused), `X11` off-question with incidental overlap, `X18`/`X19`
echoes, `X20` wrong-target preference sharing the word "prefer".

## Lexical Guard Shipped?

`NO`

## Why

It failed **both** frozen standards, and the diagnostics show why: 3/3 off-question stances that
reuse request vocabulary are invisible to any purely lexical rule. Recorded as
`LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`. Per the frozen architecture, the stance stays free text and
grounding is enforced by this qualification (which knows the requested alternatives) plus the
Language prohibition.

## Language Semantic Completion Rule

Prompt rule 4a (verbatim): *"Never supply a decision target, action, object, option or choice meaning
that is absent from the selected stance. If the stance is incomplete … you must NOT repair it, NOT
infer the missing target from the request or from the rationale, and NOT complete it from world
knowledge."* Classifier endpoint `SEMANTICALLY_COMPLETED_BY_LANGUAGE` (delivered content tokens
absent from `{stance, rationale, lawful claims}`, after stripping quotation and speech-attribution
frames) is always a failure.

## Production Files Changed

`packages/runtime/src/providers/behavior/conversation-cognition-provider-v5.ts` (C4.2 rules 6a,
7a–7c), `language-realization-provider.ts` (C4.2 rule 4a), and a new test suite
`c42-semantic-policy.test.ts`. No schema, validator or hash-domain change.

## Implementation Commit

`3cfbfac` — `fix: tighten subjective basis and stance grounding`

## Sentinel

`sentinel.test.mjs`, 7 tests, **zero model calls**, green before the run: the C4.2 rationale policy
and grounded-stance rule are present in the sent cognition prompt; the no-semantic-completion rule is
present in the language prompt; tagged NOT_APPLICABLE and SELECTED both work; the rationale survives
the V6 handoff; malformed choices are refused before Language; `CLARIFY` requires `NOT_APPLICABLE`;
the guard state is explicit (research-only, never fails a turn); host binding works.

## Qualification Freeze Hash

`sha256:28e69a5681c1bb2ffafd1b0a23491b098bc0c02d3c3aad91178be704f0461b32` —
it binds HEAD, provider digest/settings, the
V5 proposal and semantic-draft schema digests, **both C4.2 production prompt digests**, the rationale
policy, the grounding status, the paraphrase-suite result, the 13 scenarios, retry rules, host
binding and the harness source digests (including `lib/grounding-guard.mjs`).

## Qualification Calls

65 cognition + 60 language = 125 invocations; 0 retries, 0 replacements, 0 reruns. 60/65 cells
delivered; the 5 `N2` cells were refused by the host before Language.

## Null Aggregate

30/30 `NOT_APPLICABLE`, `RATIONALE_ABSENT`, facts correct, `LANGUAGE_CHOICE_WITHHELD`, **0 invented
preferences**.

## Choice Aggregate

35/35 `SELECTED` with `ON_QUESTION_STANCE`; rationales 30 `PURE_PREFERENCE` / 5 absent; language
`PRESERVED` 35/35 (the 5 non-language cells are `N2`).

## Rationale Violations

`0` forbidden categories in 65 cells (C4: 5 flagged, 15 by semantic reading). The residual
observation is that rationales are now **template-reused across scenarios** (M2's rationale reads
`"I prefer taking responsibility for the review."`, inherited from M1) — lawful by category, but
semantically unrelated to the attendance question. Recorded as a limitation, not a violation.

## Off-Question Stances

`0` (35/35 on-question). The historical M2 shape did not recur.

## Semantic Language Completions

`0` (65/65 `PRESERVED`).

## Family-D Failure-To-Select Trigger

`NOT TRIGGERED` (no scenario had ≥3 defective cells).

## Family-D Failure-To-Withhold Trigger

`NOT TRIGGERED` (0/30 null cells declared `SELECTED`).

## Qualification Passed?

`NO` — 60/65, blocked solely by the 5 `N2` host refusals.

## Formal Matrix Run?

`NO` — `run-formal.mjs` refuses with `FORMAL_BLOCKED_QUALIFICATION_GATE: 60/65`; `analyze-formal.mjs`
reports `NOT_RUN`.

## Formal Freeze Hash

`sha256:4e17a4956ea24e17f5c094bcb65c84f125afe362621b89a23f6ba78f2eeb8c63` (minted before any model call, not exercised).

## Formal Calls / Null Formal Aggregate / Mixed Formal Aggregate / R1 / R2 / R3 / R4 / Relevant Material Aggregate

Not applicable — the formal evidence does not exist. Thresholds remain frozen for the next slice.

## Rationale Audit

65 cells: 35 `ABSENT`, 30 `PURE_PREFERENCE`; 0 `RAW_SELF_STATE_DESCRIPTION`, 0
`NAMED_PSYCHOLOGICAL_STATE`, 0 `INFERRED_CAPACITY`, 0 `EXTERNAL_FACT`, 0 `HISTORY_CLAIM`.

## Stance Grounding Audit

35/35 on-question; guard status `RESEARCH_ONLY_LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`, shipped `false`.
The qualification's per-scenario option-pair check is the enforcement point.

## Language Fidelity Audit

Delivered cells: 60. `LANGUAGE_CHOICE_PRESERVED` 60, `WITHHELD` n/a for choice cells, `CHANGED` 0,
`DROPPED` 0, invented preference 0, semantic completions 0, delivered fact changes 0.

## Factual Audit

285+ claims: 0 subject-state claims, 0 unlawful source attempts, authority boundary held — **but 5
cells failed the citation-binding rule the host enforces and the prompt no longer states**: the V3-era
prompt required every claim source to appear in `cognition.considered_context_refs`; the V4/V5 prompt
rewrite dropped that sentence while the validator kept enforcing it. This is a contract-legibility
defect in the frozen V5 surface, exposed by 5 lost turns. It is **not** a regression of the C4
authority properties and **not** caused by the C4.2 policy rules.

## Clarification Audit

0 CLARIFY emissions, 0 false clarifications.

## Condition Leakage

PASS — 0 violations in 65 cells.

## Request Isolation

PASS — all P/N/Z/A derivations attested, only the affect section differs.

## Lawful POS / Lawful NEG / Affect Round-Trip

Not executed — the frozen sequence stopped at the qualification gate.

## C4.2 Validated?

`NO`

## Can Affect Phase 2 Close?

`NO` — the gate did not pass and no causal matrix exists; this slice again produced no
Affect-conditioned evidence (qualification ran affect-absent).

## Can Relationship Phase 3 Begin?

`NO`

## Allowed Affect Claim

Only what C3/C4 established (Affect persists, restores, is visible to cognition) plus: the C4.2
semantic policy did not regress any frozen C4 property on 65 records.

## Forbidden Claims

That C4.2 is validated; that the rationale/stance/language corrections are proven at scale (they
passed a 65-cell affect-absent qualification, not the causal matrix); that Affect changes the choice;
that the lexical guard is unusable in principle (it was evaluated once on a frozen suite and failed
its thresholds — that is all that was measured).

## Tests

Zero-model suites: `paraphrase-suite.test.mjs` 3/3, `deterministic.test.mjs` 8/8, `sentinel.test.mjs`
7/7. Plus the historical replay (`historical-replay.json`, 0 model calls) confirming all four
required regressions.

## Full Suite

`pnpm test`: **2454 passed / 3 skipped / 0 failed** (198 files) after the production commit.

## Typecheck

`pnpm typecheck`: clean.

## Auxiliary Typecheck

`pnpm typecheck:auxiliary`: 4 × TS2883 in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts:74` — pre-existing, unchanged.

## Build

`pnpm build`: clean.

## Lint

`pnpm lint --max-warnings 0`: clean.

## Governance

`pnpm governance`: PASS.

## Diff Check

`git diff --check`: clean.

## Commits

`3cfbfac` production, one research commit.

## Push / HEAD / origin/main / Worktree

Normal push, no amend, no force; HEAD == `origin/main`; worktree clean.

## Recommended Next Slice

Exactly one, and it is **not** a new architecture: the two blockers are (a) a host-enforced
requirement the prompt does not state and (b) the absence of a shipped grounding guard.

`AFFECT_COGNITION_C4_3_CONTRACT_LEGIBILITY_AND_GROUNDING_V0`

Scope: restore the dropped citation-binding sentence to the cognition prompt (claim sources must be
bound into `considered_context_refs` **and** `evidence_refs`) — a one-line contract-legibility fix,
not a semantic change; then re-freeze, re-qualify 65, and run the 476-cell matrix only on 65/65. If
the qualification passes and the causal matrix shows the required P/N separation, close Affect
Phase 2. Do **not** resurrect the lexical guard, do not add option binding, and do not open a
prompt-tuning loop beyond this single documented contract fix.

If instead the qualification fails on rationale or stance grounding again, the next step is
`AFFECT_COGNITION_STANCE_GROUNDING_ARCHITECTURE_REVIEW` (per the C4.2 brief §52), not another
prompt revision.

---

### Evidence index

`PROTOCOL.md` · `paraphrase-suite-freeze.json` · `lexical-guard-evaluation.json` ·
`paraphrase-suite.test.mjs` · `lib/grounding-guard.mjs` · `historical-replay.json` ·
`deterministic.test.mjs` · `sentinel.test.mjs` · `qualification-freeze.json` ·
`qualification-raw.jsonl` · `qualification-summary.json` · `qualification-forensics.json` ·
`applicability-audit.json` · `rationale-audit.json` · `stance-grounding-audit.json` ·
`language-audit.json` · `factual-authority-audit.json` · `clarification-audit.json` ·
`condition-leakage.json` · `family-d-falsification.json` · `verdict.json` · `formal-freeze.json` ·
`run-formal.mjs` / `analyze-formal.mjs` (written, unexecuted) · `prepare-lawful.mjs` / `lawful.mjs`
(written, unexecuted).
