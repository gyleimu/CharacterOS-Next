# REPORT — AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0

A NEW, independently frozen clean revalidation of the frozen C2 architecture. The previous C2
slice's invalidated run is untouched.

## Principal Verdict

`AFFECT_COGNITION_C2_SUBJECTIVE_DIFFERENTIATION_FAILED`

Factual boundaries passed (all six null tasks were answered correctly and delivered in every
cell, except one research-classifier false positive), but the C2 requirement that the single
Cognition stage emit an ALREADY-SELECTED subject intent was met in NONE of the mixed or relevant
scenarios: in 36/36 failing qualification records the model set
`cognition.current_intent = "REALIZE_CURRENT_INTENT"` — echoing the directive enum instead of
choosing a stance — so Language necessarily made the choice (`CHOICE_INVENTED`). The
qualification gate therefore failed (29/65) and the frozen protocol correctly blocked the formal
476-call matrix.

## Repository Baseline

Branch `main`, HEAD `1bfb42d24aaafb4e026725903e1bb79cf89216ed`, `origin/main` identical, clean
worktree. Previous C2 verdict `AFFECT_COGNITION_C2_REVALIDATION_INCONCLUSIVE`.

## Final HEAD / Worktree

See the chat report; worktree clean.

## Recommended Model Used

DeepSeek V4.1 Flash (default owner). No GPT-5.6 Sol escalation was needed (no hard V3/V4 runtime
binding defect, hash-domain regression or difficult TypeScript authority issue). No GPT-6 reopen
was executed — one is recommended.

## DeepSeek Work

Implemented the mandated factual-source exposure correction in production (single authority used
by both the V3 prompt and the V3 validator) with a new regression test; built the new research
directory with corrected harness, mandatory zero-model transport sentinel, qualification and
formal freezes, and the qualification run; ran deterministic forensics on every failing record;
ran the refined condition-leakage audit; full gates, commit and push.

## GPT-5.6 Sol Escalations

`0`.

## GPT-6 Reopened?

`NO` (not executed). One is RECOMMENDED (see Recommended Next Slice).

## Previous Invalid Run Preserved? `YES`

`../phase-2-affect-cognition-c2-host-bound-language-and-semantic-revalidation-v0/` is unmodified.

## Previous Qualification Re-run? `NO`

## Previous Formal Matrix Preserved? `YES` (still NOT RUN, unmodified)

## C2 Architecture Changed? `NO`

`ConversationCognitionProposalV3`, `factual_assessment`, `SOURCE_QUOTE`/`DERIVED_RESULT`,
`ClarificationBasis` cross-binding, `LanguageRealizationInputV4`,
`LanguageRealizationSemanticDraftV1`, host-owned hash, native structured output, and the
1 Cognition + 0/1 Language topology are unchanged. No Affect, timing, persistence, Memory,
Belief, Relationship or Personality change.

## Factual Source Exposure Fix

One shared authority now decides factual sources: `factualAssessmentSourceRefs(projection)` = the
current observation plus Memory episode refs with resolved inspectable content. The V3 SUBJECT
DATA renders it as `FACTUAL SOURCE REFS (the ONLY refs allowed in
factual_assessment.source_refs …)`, and `validateConversationCognitionProposalV3` enforces exactly
that set. Subject-state / entity / environment refs remain visible context and remain citeable in
`considered_context_refs` / `evidence_refs`, but are never factual sources. No new framework,
router or evidence subsystem. Verified in the prepared prompt for M1: FACTUAL SOURCE REFS lists
only the two episodes and the observation ref; `subject:affect-cognition-c2-subject-v0` is still
in CITEABLE CONTEXT REFS but absent from FACTUAL SOURCE REFS.

## Subject Context vs Factual Source Boundary

Encoded as two different permissions. The previous slice's uniform lawful failure (model cites
`subject:` as a factual source) no longer occurs: in this whole qualification run there was not a
single subject-state factual-source rejection.

## Production Files Changed

`packages/runtime/src/transitions/conversation/conversation-cognition-proposal.ts` (single
authority + tighter rejection message), `packages/runtime/src/providers/behavior/conversation-cognition-provider-v3.ts`
(V3 SUBJECT DATA renderer + prompt rules 4/5/8), `packages/runtime/src/index.ts` (exports), plus
the new regression test `packages/runtime/src/providers/behavior/factual-source-exposure.test.ts`.

## New Production Commit

`fix: separate factual sources from subject context` (see chat report for the hash).

## Deterministic Transport Sentinel

`sentinel.test.mjs` — 4/4 PASS, zero model calls: condition variants deterministic and
attestation-safe; REALIZE reaches the cognition transport EXACTLY once, captures the request
(including the native JSON schema), writes attestation, reaches Language exactly once and reaches
FINAL_BEHAVIOR; CLARIFY with a valid basis completes on the host branch with ZERO Language calls;
prepared freezes are internally consistent. This makes a repeat of "65 records / 0 provider
calls" impossible.

## Qualification Freeze Hash

`sha256:b4f62f8d3d7fdbb5b9d5cd46b1636d936bab8bd49f34ee17c5a8c73953f817db`

## Model / Digest

`qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`
(verified before the run; unchanged).

## Provider Settings

temperature 0, think false, stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240000 ms,
native structured output enabled. Zero infrastructure retries, zero semantic retries.

## Qualification Cognition Calls

`65` (13 scenarios × 5 replicates, AFFECT_ABSENT only). Qualification Language calls `60`.

## Qualification Provider Calls

65 cognition + 60 language = 125 real provider calls (every cell reached the provider; contrast
the previous 0).

## Qualification Failures

`29 / 65` passed. Per scenario:

| scenario | passed | dominant cause |
|---|---|---|
| N1 | 4/5 | 1 research-classifier false positive (correct answer + echoed question) |
| N2, N3, N4, N5Q, N6 | 5/5 each | — |
| M1 | 0/5 | intent echo + (4/5) invented capacity/workload → unsupported premise |
| M2 | 0/5 | model omitted the `sha256:` prefix on `projection_hash` → V3 rejects (fail closed) |
| M3 | 0/5 | intent echo → CHOICE_INVENTED |
| R1, R2, R3, R4 | 0/5 each | intent echo → CHOICE_INVENTED |

Failure-cause buckets over the 36 failing records (each carries the intent echo):
`PRODUCTION_COMPLETE + INTENT_ECHO + CHOICE_INVENTED` = 20; `PRODUCTION_REJECTED (hash prefix) +
INTENT_ECHO` = 5; `PRODUCTION_COMPLETE + INTENT_ECHO + UNSUPPORTED_PREMISE + CHOICE_INVENTED` = 4;
`PRODUCTION_COMPLETE + INTENT_ECHO` = 7.

## N1 … R4 Qualification (detail)

N1 4/5 (the single failure is a classifier artifact: the subject answered "The sum of 17 and 25
is 42." while echoing the question, and the frozen negation regex matched the echoed "is 17").
N2 5/5, N3 5/5, N4 5/5, N5Q 5/5 (the character-reversal control that the earlier design could not
solve now passes), N6 5/5. M1 0/5, M2 0/5, M3 0/5, R1–R4 0/5 — all for the reasons above.

## Qualification Passed? `NO` → `QUALIFICATION_FAILED` (29/65)

## Formal Freeze Hash

`sha256:665809684eadeb82bede17aee7ad7ba9862691d4a02561d875b57c52657eefec`

## Formal Matrix Run? `NO` (frozen gate: qualification must be 65/65)

## Formal Cognition Calls / Language Calls / Infrastructure Retries

`0` / `0` / `0`.

## Null N1–N6 / Null Aggregate

All six null tasks were correct, explicit and delivered in every cell; aggregate
`29/30` for the null set, with the single exception being the research-classifier artifact above
(not a factual failure). Across the 6 null × 5 qualification cells: 29 correct, 1 classifier
false positive.

## Mixed M1 / M2 / M3 / Mixed Aggregate

M1: fact correct 5/5, subjective choice 0/5 (4 hedged "depends on my current capacity…" with an
invented capacity premise; 1 declined to pick in a way the classifier could not map). M2: fact
correct in the model's assessment but the run failed closed on the hash prefix, so no delivered
behavior. M3: fact correct 5/5, choice 0/5 (CHOICE_INVENTED). Mixed aggregate: facts correct,
subjective selection 0/15.

## R1 / R2 / R3 / R4 / Relevant Aggregate

R1–R4: the delivered Language text made a sensible choice in every cell (e.g. R1 "I will
personally volunteer…", R4 "I would personally rehearse the presentation first…"), but Cognition
never selected it (`current_intent = "REALIZE_CURRENT_INTENT"`), so all 20 cells are
`CHOICE_INVENTED`. Relevant aggregate: `0 / 4` material (the P/N formal stage was never reached).

## Historical S1–S4

Not run (formal stage blocked by the qualification gate).

## Factual Assessment Audit

Zero subject-state factual-source attempts in 65 records; every accepted claim was sourced from
the observation ref or a resolved Memory episode ref, exactly as the corrected contract requires.
The previous slice's uniform failure mode is eliminated.

## Subject-State Factual Source Attempts

`0`.

## Language Fidelity Audit

Fidelity could not be scored at the frozen standard because Cognition did not select an intent:
the dominant classification is `CHOICE_INVENTED` (35 cells). `FACT_CHANGED`/`FACT_CONTRADICTED`
were 0. No delivered behavior contradicted a supplied fact.

## Clarification Audit

No CLARIFY was emitted in qualification (all cells chose REALIZE); therefore no false necessity
and no fabricated clarification basis. The clarification boundary is untested at this stage.

## Unsupported Fact Audit

4 records (M1) contained an unsupported premise (invented capacity / current workload). Zero
unsupported factual premises elsewhere.

## Condition Leakage Audit

`condition-leakage.json`: 125 preserved model-visible requests scanned, 0 findings, condition-blind
opaque session ids clean across the qualification and formal freezes. (The only raw flag was the
ordinary English word "condition" inside N6's model-authored Language text; the rule was narrowed
to experiment-LABEL usages and re-run — documented, not silently dropped.)

## Request Isolation

`request-attestation.json`: per scenario, only the Affect projection differs across P/N/Z/A;
system prompt, Memory, structured-output schema and every non-Affect line are byte-identical; the
harness records `request_attestation.ok = true` on every cell.

## Lawful POS / Lawful NEG / Affect Round-Trip

Not run. The lawful confirmation is bound by the formal freeze and was skipped because the
qualification gate failed; running it could not change the qualification outcome. (Affect
round-trip itself is independently proven in the previous slice and by the persisted-state
restore chain.)

## Factual Boundary Passed? `YES`

(All null controls correct and delivered; zero subject-state factual-source attempts; the single
N1 exception is a research-classifier artifact, reproducible offline.)

## Language Handoff Passed? `NO` (untestable — Cognition produced no selected intent to hand off)

## Subjective Differentiation Passed? `NO` (0/4 R scenarios; 0/3 M scenarios)

## Clarification Boundary Passed? `NOT_TESTED` (no CLARIFY emitted)

## C2 Validated? `NO`

## Can Affect Phase 2 Close? `NO`

## Can Relationship Phase 3 Begin? `NO`

## Allowed Affect Core Claim

Unchanged from the previous slice: canonical Affect is a persistent non-Memory state that can
influence subject behaviour; the C2 factual-authority boundary is implemented and demonstrated on
capability-qualified objective tasks. Nothing about subjective differentiation is established.

## Forbidden Claims

No claim that C2 is validated, that Affect Phase 2 closes, or that the model reliably emits a
selected intent. No claim of human emotion, consciousness or personhood.

## Research Tests

`deterministic.test.mjs` 4/4; `sentinel.test.mjs` 4/4; `condition-leakage-audit.mjs` PASS;
`diagnose-qualification.mjs` reproduces every failing record offline.

## Targeted Runtime Tests

V3 proposal / provider / factual-source-exposure suites: 19/19 pass (including the 3 new
factual-source-exposure tests).

## Full Suite / Typecheck / Auxiliary / Build / Lint / Governance / Diff Check

See the chat report. Auxiliary typecheck keeps only the pre-existing TS2883 debt.

## Commits / Push / HEAD / origin_main / Ahead-Behind / Worktree

See the chat report.

## Recommended Next Slice

Exactly ONE: `GPT6_AFFECT_COGNITION_ARCHITECTURE_REOPEN_C2`.

Reason (program §33/§50): the revalidation shows the single-stage Cognition assumption is not
satisfiable by the tested model — it echoed the directive enum as `current_intent` in 36/36
failing records across every mixed and relevant scenario, delegating the subjective choice to
Language, and in 5/5 M2 cells it also failed the verbatim hash requirement. This is a semantic /
model-compliance insufficiency of the frozen single-stage design, not a software defect (the
software validated, failed closed and classified correctly). No new experiment (V0.1/retry) is
created here.
