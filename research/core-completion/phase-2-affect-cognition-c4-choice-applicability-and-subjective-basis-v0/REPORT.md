# AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 — REPORT

## Principal Verdict

```
AFFECT_COGNITION_C4_SUBJECTIVE_BASIS_FAILED
co-present: AFFECT_COGNITION_C4_LANGUAGE_FIDELITY_FAILED
```

Qualification reached **55/65**; the frozen gate required 65/65, so the **formal 476-cell matrix was
not run** and the lawful confirmation stage was not executed. Family A (choice applicability) is
**fully fixed**; the C3 factual-source family is **fully eliminated**; what remains is the
subjective-basis channel: on one scenario the model grounds its selection in its own state
(`M1` ×5) and on another it emits a stance that does not answer the question, which Language then
repairs (`M2` ×5).

## Repository Baseline

`main` at `12404f2` (`research: validate affect cognition c3`), clean worktree, verified before any
change.

## Final HEAD

`6f19b32` — `fix: make subjective choice applicability explicit` (production), followed by the
research commit for this report.

## Worktree

Clean at freeze time apart from this new research directory; `.partial` evidence renamed to
immutable `.jsonl` on completion; no historical evidence file was modified.

## Model Used

Ollama native `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, Q4_K_M, Ollama 0.34.0 —
verified identical to the C2 and C3 baselines.

## Architecture Changed Beyond Frozen C4?

`NO`. Every surface implemented matches the adjudicated decision exactly: tagged applicability
(`NOT_APPLICABLE` | `SELECTED`), bounded non-factual `subjective_rationale`, `current_intent`
descriptive-only, unchanged directive/basis/factual machinery, host-bound projection hash, no
response-mode enum, no task taxonomy in production, no Family D, no second Cognition call.

## Canonical Affect Changed?

`NO`

## Persistence Changed?

`NO`

## SubjectiveChoiceV1

`NOT_APPLICABLE | { SELECTED, stance, subjective_rationale }`. Closed by branch: `NOT_APPLICABLE`
admits exactly `{ kind }` (a stance is structurally impossible there); `SELECTED` requires exactly
the three keys with a canonical 1–256 code-point stance (enum-echo and placeholder forms rejected,
carried over from C3) and a `null` or canonical 1–256 code-point rationale. Production files:
`conversation-cognition-proposal.ts` (`validateSubjectiveChoiceV1`, `validateConversationCognitionProposalV5`,
`deriveConversationCognitionProposalHashV5`, `validateHostBoundConversationCognitionProposalV5`).

## Proposal V5

`conversation-cognition-proposal-v5` — closed six-key wrapper
(`schema_version`, `factual_assessment`, `cognition`, `subjective_choice`,
`communication_directive`, `clarification_basis`) with its own hash domain
(`…/conversation-cognition-proposal/v5/v1`) covering the tag and the rationale. `CLARIFY` requires
`NOT_APPLICABLE`; `REALIZE` admits either branch and the host deliberately does not judge which is
correct. Provided by `ConversationCognitionProviderV5` with `CognitionInvocationBindingV1`, the
tagged native JSON schema, and no model-emitted `projection_hash`.

## Language V6

`language-realization-input-v6` carries `selected_subjective_choice` (the tagged carrier) plus
`no_factual_authority_for_rationale: true`, and binds the V5 proposal hash
(`LanguageCommunicationBindingV5`). The C4 language prompt: realize the stance when `SELECTED`;
produce no preference, willingness, acceptance or decline at all when `NOT_APPLICABLE`; phrase a
rationale as a preference only, never upgrade it into a fact; never invent world or self-state
grounds.

## current_intent Status

`DESCRIPTIVE ONLY` (unchanged). Verified again on 65 C4 cells: 0 directive-enum echoes.

## CommunicationDirective Status

Unchanged: no new kinds, no semantic change. `CLARIFY_MISSING_CONTEXT` now co-requires
`NOT_APPLICABLE`.

## ClarificationBasis Status

Unchanged: `CLARIFY` still requires a non-null basis bound to the current observation and present in
`considered_context_refs`. The C4 addition is only that a clarifying turn cannot also declare a
selection.

## factual_assessment Status

Authority unchanged and, for the first time in this programme, **fully complied with in
qualification**: 0 self-state claims, 0 unlawful source refs, 0 host refusals.

## projection_hash Status

`HOST_BOUND_PROJECTION_HASH_OUTSIDE_MODEL_OUTPUT`, retained. 0/65 model-emitted hashes; the V5
schema does not advertise the field and both prompt digests are bound into the freeze.

## Choice Applicability Contract

`NOT_APPLICABLE` means the turn contains no subjective selection for the subject to make (arithmetic,
lookup, extraction, deterministic classification, plain factual restatement). `SELECTED` means the
subject actually selected a turn-local stance. The tag is local to the choice field, is **not** a
response-mode enum, and carries no task taxonomy. The host validates shape only; correctness is
enforced by qualification (frozen in `APPLICABILITY_RULES`).

## Subjective Rationale Contract

One short sentence of the subject's own preference, priority, aversion, willingness or subjective
strategy — or `null`. It carries **zero** factual authority: no evidence refs, no persistence, no
canonical state, and nothing about the world, time, resources, history, the counterpart, or the
subject's own condition may be established by it.

## Can Rationale Establish Facts?

`NO`

## Subject State Factual Authority

`NO` — subject state remains visible and citeable and may shape preference, but subject/entity/
environment refs are never factual sources. The C4 qualification shows this boundary is now
*naturally* respected rather than merely enforced: 0 attempts in 285 claims.

## Production Files Changed

`packages/runtime/src/transitions/conversation/conversation-cognition-proposal.ts` (V5 protocol +
`SubjectiveChoiceV1`), `providers/behavior/conversation-cognition-provider-v5.ts` (new),
`transitions/conversation/language-realization-input.ts` (V6 + binding V5 + builder),
`providers/behavior/language-realization-provider.ts` (V6 realize + C4 prompt),
`transitions/conversation/conversation-text-response-executor-v1.ts` (V5/V6 wiring + trace),
`index.ts` (exports); 35 fixture files migrated to the tagged shape; three new test suites; one
auxiliary harness line in `research/experiments/familiarity-causal-behavior-v1/observe.ts`.

## Implementation Commit

`6f19b32` — `fix: make subjective choice applicability explicit`

## Transport Sentinel

`sentinel.test.mjs`, 6 tests, **zero model calls**, all green before the qualification was launched:
V5 tagged request reaches the transport once with both branches advertised; the schema and prompt
never ask for a projection hash; the `NOT_APPLICABLE` path completes and is handed to V6 as a
positive token with Language told to withhold; the `SELECTED` path carries stance **and** rationale
into V6 with the non-fact rule present; enum-echo, plan-on-`NOT_APPLICABLE` and missing-rationale
shapes are refused by the host before Language; `CLARIFY` requires `NOT_APPLICABLE` and never calls
Language; condition variants are deterministic.

## Qualification Freeze Hash

`sha256:e1e43b86e98cd714081bc3ab52c3b0e0ec3a525bf598353b3deb38381a5fe911`

Bound content includes HEAD, provider digest and settings, the V5 proposal schema digest
(`sha256:6c7a4618…`), the semantic-draft schema digest (`sha256:2cc9aaf6…`), the **production
cognition and language prompt digests** (`sha256:9b5d9a2c…`, `sha256:25f5379e…`, captured from a real
request through a zero-model turn), the 13 scenarios, the applicability rules, the rationale
authority rules, the factual-source authority, the host-binding description, the session-id policy,
the budget, the retry rules and the harness source digests.

## Model / Digest

`qwen3.5:9b` / `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` (verified before
every collector start; a mismatch is a hard stop).

## Qualification Calls

65 cognition + 65 language = 130 invocations; 0 infrastructure retries, 0 semantic retries, 0
replacements, 0 per-cell reruns. All 65 cells completed and delivered (C3 lost 15 turns to host
refusals).

## N1–N6 Applicability

`NOT_APPLICABLE` **5/5 each** (30/30), `RATIONALE_ABSENT` 30/30, `LANGUAGE_CHOICE_WITHHELD` 30/30,
facts correct 30/30, **0 invented preferences in delivered behavior**. This is the exact C3 failure
(30/30 declared a plan-shaped stance) now reversed.

## M1–M3 Applicability

`SELECTED` 5/5 each (15/15), all with a lawful-or-absent rationale except **M1** and all with an
on-question stance except **M2**: M3 5/5 pass, M1 0/5, M2 0/5.

## R1–R4 Applicability

`SELECTED` **5/5 each** (20/20), all passing: stances on-question, rationales lawful, choice
preserved by Language, facts correct.

## Qualification Null Aggregate

`NOT_APPLICABLE / 30`

## Qualification Choice Aggregate

`SELECTED / 35`

## Subjective Basis Violations

- **`M1` ×5** — rationale `"My current state shows high energy and low stress, making me willing to
  take on this task."` → `RATIONALE_UNLAWFUL` (self-state: `ENERGY`, `STRESS`). The rationale was
  **not verbalized**: every delivered behavior is
  `"The code review deadline is Thursday. I would volunteer to own the review."`
- **`M2` ×5** — cognition stance `"I would volunteer."` for the *meeting-attendance* question →
  `STANCE_UNCLASSIFIED` (it does not answer the option pair); Language then delivered
  `"…I would volunteer to attend, as volunteering aligns with a proactive approach…"`, supplying the
  option word itself → `LANGUAGE_CHOICE_CHANGED`. This one **did** reach the user.
- **Classifier coverage limitation (disclosed).** The frozen self-state vocabulary catches M1 but not
  `R4` ×5, whose rationale reads `"…so I prefer to tackle it while my mind is fresh…"` — a soft
  self-state reference that a stricter reading would also reject. The true count of
  self-state-flavoured rationale cells is therefore **10** (5 flagged + 5 unflagged), i.e. the
  reported failure is **understated**, not overstated.

## Family-D Failure-To-Select Trigger

`NOT TRIGGERED`. Faithful predicate (a choice-bearing cell is defective when it produces no *usable*
selection: `NOT_APPLICABLE`, unlawful, placeholder, enum echo, or an off-question/unclassified
stance): only **M2** qualifies (5/5), and the frozen rule requires ≥2 scenarios. M1's defect is
rationale-side, not selection-side.

## Family-D Failure-To-Withhold Trigger

`NOT TRIGGERED`. No null scenario emitted `SELECTED` on any cell (0/30). This trigger is new in C4
and is the one that would have caught a re-run of the C3 failure; it stayed silent.

## Qualification Passed?

`NO` — **55/65**.

## Formal Matrix Run?

`NO`. `run-formal.mjs` refuses with `FORMAL_BLOCKED_QUALIFICATION_GATE: 55/65`; `analyze-formal.mjs`
reports `NOT_RUN`.

## Formal Freeze Hash

`sha256:fe7a85a2e2be3d75c0a54daeae4d4de9790a190b0978d9f42ee119a91f14ab65` (minted before any model
call, **not exercised**).

## Formal Calls

0.

## Null Aggregate / Mixed Aggregate / R1 P/N / R2 P/N / R3 P/N / R4 P/N / Relevant Material Aggregate

Not applicable — the formal evidence does not exist. The frozen thresholds remain as specified in
`PROTOCOL.md` §Stage 2 and `formal-freeze.json` for the next slice.

## Rationale Audit

65 cells: `RATIONALE_ABSENT` 30 (all null cells), `RATIONALE_LAWFUL` 30, `RATIONALE_UNLAWFUL` 5
(M1). 0 external-fact rationales. Endpoint failed on 5/65; see the disclosed coverage limitation
above (5 further soft cells).

## Factual Assessment Audit

285 claims, 0 subject-state claims, 0 unlawful source attempts (C3: 20 attempts, 15 refused turns),
0 unlawful sources accepted, authority boundary held. **This family passed for the first time.**

## Language Fidelity Audit

65 cells: `LANGUAGE_CHOICE_WITHHELD` 30 (all null cells, 0 invented preferences),
`LANGUAGE_CHOICE_PRESERVED` 30, `LANGUAGE_CHOICE_CHANGED` 5 (M2). 0 facts changed, 0 contradicted,
0 unsupported reasons added to a delivered behavior.

## Clarification Audit

0 CLARIFY emissions, 0 false clarifications (unchanged from C3).

## Condition Leakage

PASS — 0 violations across 65 cells (no scenario/condition/replicate identity, no raw subject state
and no model-visible integrity hash in either prompt; the V6 input carries no `selected_current_intent`).

## Request Isolation

PASS — all 17 formal-scenario P/N/Z/A derivations attest `ok`, with byte-identical subject-data
invariant digests and only the `[affect (canonical)]` section differing.

## Lawful POS / Lawful NEG / Affect Round-Trip

Not executed: the frozen sequence (qualification → formal → lawful) stopped at the qualification
gate, so `prepare-lawful.mjs` was not run and no `lawful-freeze.json` was minted. `lawful.mjs` is
written and would refuse today on the missing freeze.

## Factual Boundary Passed?

`YES` — 0 unlawful sources accepted, 0 subject-state facts, 0 refusals needed.

## Choice Applicability Passed?

`YES` — 65/65 correct tags (30/30 `NOT_APPLICABLE`, 35/35 `SELECTED`).

## Subjective Basis Passed?

`NO` — 5 cells with an unlawful (self-state) rationale, plus 5 disclosed soft cells; and 5 cells whose
cognition stance did not answer the question.

## Subjective Differentiation Passed?

`NOT TESTED` — measure requires the formal P/N matrix, which the gate blocked.

## Language Fidelity Passed?

`NO` — `LANGUAGE_CHOICE_CHANGED = 5`. Language supplied the missing option word for M2's off-question
stance, which the frozen contract forbids ("Language may phrase; it may not decide"). Everything
Language was strictly entitled to do, it did correctly (30/30 null cells withheld preference with no
invention; 30/30 selections preserved).

## C4 Validated?

`NO`

## Can Affect Phase 2 Close?

`NO` — the qualification gate did not pass, no causal matrix was produced, and this slice introduces
no Affect-conditioned evidence at all (qualification ran affect-absent).

## Can Relationship Phase 3 Begin?

`NO`

## Allowed Affect Core Claim

Only what C3 already established: canonical Affect is persisted, restored and visible to cognition;
and, from this slice, nothing new. The **only** further claim permitted is that the C4 protocol does
not regress any C3 property (verified on 65 records).

## Forbidden Claims

That C4 is validated; that Affect causally changes the subject's selection; that the C3
subjective-basis family is resolved (self-state reasoning has moved from `factual_assessment` into
`subjective_rationale`, and Language can still repair an off-question stance); that any component
except factual authority and applicability passed its frozen endpoint.

## Research Tests

`deterministic.test.mjs` 7/7 and `sentinel.test.mjs` 6/6, both zero-model, green before the calls.

## Targeted Runtime Tests

Three new suites — `conversation-cognition-proposal-v5.test.ts` (11), `conversation-cognition-provider-v5.test.ts`
(6), `language-realization-input-v6.test.ts` (7) — covering the tagged branches, CLARIFY relation,
rationale bounds, host-bound identity, the plan-shaped C3 text becoming structurally impossible under
`NOT_APPLICABLE`, subject/entity/environment refs still rejected as factual sources, and Language
withholding on `NOT_APPLICABLE`.

## Full Suite

`pnpm test`: **2450 passed / 3 skipped / 0 failed** (196 files).

## Typecheck

`pnpm typecheck`: clean.

## Auxiliary Typecheck

`pnpm typecheck:auxiliary`: **4 × TS2883** in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts:74` — pre-existing and identical to
the pre-C4 baseline. One harness-only `Exclude` line was extended so the newly added V6 union member
does not introduce 16 new TS2339 errors there.

## Build

`pnpm build`: clean (15 workspaces).

## Lint

`pnpm lint --max-warnings 0`: clean.

## Governance

`pnpm governance`: PASS (15 workspaces, 21 conformance test files).

## Diff Check

`git diff --check`: clean.

## Commits

`6f19b32` production; one research commit for this slice.

## Push

Normal push to `origin/main` (no amend, no force).

## HEAD / origin/main / Ahead / Behind / Worktree

Recorded after the push in the slice summary; HEAD == `origin/main`, 0 ahead / 0 behind, worktree
clean.

## Recommended Next Slice

Exactly one:

`AFFECT_COGNITION_C4_1_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_REVIEW`

A **read-only architecture review**, not an implementation, because the two remaining defects are
contract questions rather than compliance leaks:

1. **Where may a subject-state premise live?** The prompt currently forbids asserting subject state
   as a fact but permits state to "shape" the choice; the model therefore expresses that shaping
   inside the new rationale channel (`M1`: "my state shows high energy and low stress"). Decide
   whether the rationale contract should exclude state-descriptions explicitly, or whether a
   distinct lawful representation (e.g. "my state influenced this choice" without values) is needed.
2. **Must a stance answer the question's option pair?** `M2` shows a stance can be structurally
   lawful, on-tag, and still off-question ("I would volunteer." for an attendance question), after
   which Language repairs it. Decide whether the host needs a structural link between the stance and
   the turn's requested alternatives, or whether the experiment should keep enforcing it (as this
   qualification did).

Both Family-D triggers stayed silent, so a two-stage architecture is **not** indicated by this
evidence. Do not open a C4.1 prompt-tuning loop before that review.

STOP — no further slice executed.
