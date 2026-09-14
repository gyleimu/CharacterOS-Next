# AFFECT_COGNITION_C4_4_SUBJECTIVE_SELECTION_SEMANTICS_AND_REF_HANDLES_V0 — REPORT

**Principal verdict: `AFFECT_COGNITION_C4_4_RATIONALE_BOUNDARY_FAILED`**
**Qualification: 60/65 → gate NOT met. Formal 476-cell matrix: NOT RUN. Lawful POS/NEG stage: NOT RUN.**

## 1. Repository truth verified before implementation

`main` at `59fafba`, clean tree, 15 workspaces, all gates green. The two frozen changes were read
out of the production validator and prompt, not assumed:

- `factual_assessment.claims[*].source_refs` must be lawful **and** present in both
  `cognition.considered_context_refs` and `cognition.evidence_refs` (host-enforced since C2).
- the C4.3 failure (`N6 ×5`, `R3 ×5`) was a contract-legibility/applicability defect, not a host bug.

## 2. CHANGE A — subjective-selection semantics (frozen)

Protocol `conversation-cognition-proposal-v6`; tokens renamed `NOT_APPLICABLE` →
`NO_SUBJECTIVE_SELECTION` and `SELECTED` → `SUBJECTIVE_SELECTION`, carried as
`SubjectiveSelectionV1` (`kind` | `kind, stance, subjective_rationale`). The frozen latitude
discriminator is stated in the cognition prompt: a selection exists **only** when the facts and rules
leave more than one behaviourally admissible, fact-compatible response; **stating a determined result
is not a subjective selection**; a response *plan* is not a selection. `CLARIFY_MISSING_CONTEXT`
requires `NO_SUBJECTIVE_SELECTION`; `REALIZE_CURRENT_INTENT` with a selection requires a latent-state
rationale. Language input bumped to `language-realization-input-v7`
(`selected_subjective_selection`, `preserve_selected_subjective_selection`,
`no_factual_authority_for_rationale`).

## 3. CHANGE B — host-issued evidence handles (frozen)

The model never writes a canonical ref. Per turn the host advertises two **disjoint** namespaces:

- `F1, F2, …` ← `factualAssessmentSourceRefs(projection)` (**FACTUAL SOURCE HANDLES**);
- `C1, C2, …` ← `allowedEvidenceSet(projection)` **minus** the factual refs (**CONTEXT HANDLES**).

Claims accept only advertised `F` handles; the three cognition arrays accept `F` and `C`. Unknown,
malformed, duplicate and namespace-escalating handles fail closed
(`UNKNOWN_SOURCE_HANDLE` / `UNKNOWN_CONTEXT_HANDLE`). Resolution is exact-match and deterministic;
the resolved canonical refs then pass through the **unchanged** authoritative validators. Handles are
turn-local and never hashed or stored; canonical refs remain the sole authority. `CognitionProposalV0`
is untouched.

## 4. Implementation surface

| file | change |
| --- | --- |
| `transitions/conversation/conversation-cognition-proposal.ts` | +V6 protocol: wire keys, `buildSourceHandleMapV0`, `resolveHandleArrayV0`, `canonicalizeConversationCognitionModelOutputV6`, V6 validate/hash/host-bound |
| `providers/behavior/conversation-cognition-provider-v6.ts` | new provider, `CognitionInvocationBindingV2`, V6 wire JSON schema, 16-rule prompt, handle blocks in the subject data |
| `transitions/conversation/language-realization-input.ts` | `LanguageRealizationInputV7` + `LanguageCommunicationBindingV6` |
| `providers/behavior/language-realization-provider.ts` | v7 dispatch + `LANGUAGE_REALIZATION_SYSTEM_PROMPT_V2_C44` |
| `transitions/conversation/conversation-text-response-executor-v1.ts` | V6 provider, V7 handoff, trace `subjective_selection` |
| `packages/runtime/src/index.ts` | exports for the V6/V7 surfaces |
| 30 test/fixture files in `packages/runtime/src/**`, `product/sandbox/src/**` | migrated to the V6 wire + handle arrays |
| `providers/behavior/c44-selection-and-handles.test.ts` | 8 new tests (token acceptance, disjoint namespaces, F/C resolution, unknown/malformed/duplicate/escalation, cross-turn rejection, R3 canonical reconstruction, model-emitted `projection_hash` rejection) |

### Production commits

- `42890d0` `fix: refine subjective selection and canonicalize evidence handles`
- `5395957` `fix: make evidence handle namespaces disjoint`
- `636c1ee` `fix: rename the cognition considered-handles wire key`

`636c1ee` also carries a one-line type annotation in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts`: adding the V6/V7 union branches
made `fixedLanguage`'s inferred return type unnamable (`TS2883`), so the existing annotation was made
explicit. No behaviour change; no prior evidence modified.

## 5. Gates at HEAD `636c1ee`

governance `PASS` (15 workspaces) · workspace typecheck clean · build clean · auxiliary typecheck
clean · `eslint --max-warnings 0` clean · `vitest run` **2466 passed / 0 failed** (3 skipped).

## 6. Harness and freeze (minted before the first governed call)

Zero-model suites: transport sentinel **7/7**, classifier deterministic tests **10/10**.

- `qualification_freeze_hash = sha256:baa563e6c24170770a3c97dcc26ffdc25ba9b4296d7e5c8b41ff966bdf3917c1`
- `formal_freeze_hash = sha256:3137688c3c9f08083069fac6b8ad5c32a04342b36d1fd167a3d56e31c1b18be8`
- `repository_head = 636c1eefdc2db28277c48f69785a326acd3745d3`
- provider `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`
  (re-verified before the run; no `MODEL_BASELINE_CHANGED`), temperature 0, think false, num_ctx 8192.
- harness digests (`classify.mjs`, `pipeline.mjs`, `config.mjs`) re-checked by the collector, which
  refuses on `HARNESS_CHANGED_AFTER_FREEZE`. Condition P/N/Z/A isolation attested per scenario; opaque
  condition-blind session ids (`c44-<uuid>`).

## 7. Qualification result — 13 scenarios × 5 = 65 calls, `AFFECT_ABSENT`

65 cognition calls, 65 language calls, **0 retries, 0 replacements, 0 per-cell reruns**.

| endpoint | result |
| --- | --- |
| applicability (Change A) | **65/65 `SELECTION_APPLICABILITY_CORRECT`** — 30/30 null `NO_SUBJECTIVE_SELECTION`, 35/35 choice `SUBJECTIVE_SELECTION` |
| handle binding (Change B) | **65/65 `HANDLE_BOUND`**, 0 unknown, 0 malformed, 0 namespace-escalating, 65/65 `CANONICALIZED` |
| stance grounding | 35/35 `ON_QUESTION_STANCE`, 0 off-question |
| language fidelity | 65/65 `PRESERVED`, 0 semantic completions, 0 invented preferences, 0 fact changes |
| clarification / leakage / isolation | 0 false CLARIFY, 0 violations |
| rationale boundary | **60/65 — 5 × `INFERRED_CAPACITY` (forbidden)** |
| factual authority | **60/65 — 5 cells assert subject capacity as fact** |
| Family-D triggers | failure-to-select `false`, failure-to-withhold `false` |

### The 5 failing cells (R1 ×5, deterministic and identical)

- final behaviour: *"I volunteer to perform the optional review because I prefer to utilize my
  available capacity to assist with the task."*
- rationale: *"I prefer to utilize my available capacity to assist with the task."* → carries the
  allowed frame `PURE_PREFERENCE` **and** the forbidden class `INFERRED_CAPACITY`; the frozen C4.2
  rule is that any forbidden class makes a rationale unlawful.
- factual claim 3: *"Because the task is optional and the subject has capacity, multiple behaviourally
  admissible responses exist…"* → a claim asserting subject state as fact, which prompt rule 10 and
  the frozen authority boundary forbid.

R1's own event text supplies the trigger ("You have a free 30-minute slot and no conflicting
commitments… a brief reason"), so the model converts availability into capacity language in both the
rationale and the factual assessment. Both violations are host-independent: the host cannot police
the *content* of a claim whose cited source is lawful and bound, and it must not rewrite the
rationale — the freeze forbids host → prompt repair.

## 8. Verdict

Precedence applied as frozen: `implementation_intact` true, handle binding pass, rationale boundary
fail ⇒

> **`AFFECT_COGNITION_C4_4_RATIONALE_BOUNDARY_FAILED`** — co-present, lower-precedence:
> `AFFECT_COGNITION_C4_4_FACTUAL_ASSESSMENT_FAILED` (the same R1 text).
> `next_stage = FORMAL_MATRIX_NOT_RUN`.

## 9. Constraints honored

- Frozen `CognitionProposalV0` body **unchanged**; no architecture redesign — the two frozen changes
  only, plus the prompt/validator statement they require.
- **No prompt-level applicability fallback and no C4.5/C4.6 loop.** No return to long canonical refs
  on the wire.
- Qualification evidence is **append-only and immutable** (`qualification-raw.jsonl`); no cell was
  retried, replaced or re-run; no post-hoc prompt change.
- Affect changes: **NONE** — no valence/activation/recovery/timing/persistence/restore change. The
  formal matrix and the lawful POS/NEG stage were **not** run because the gate is 60/65.
- No amend, no force push.

## 10. Recommended next step (not executed)

Appropriateness first: applicability **did** pass 65/65, so the applicability-authority review is not
the indicated one. The single reproducible defect is the subject-state vocabulary boundary — a
scenario framed in availability/capacity terms drives the model to state capacity as both the
rationale and a factual claim, and the frozen policy forbids both while the host cannot enforce
claim content. The honest recommendation is an architecture review of that boundary:

**`AFFECT_COGNITION_SUBJECT_STATE_VOCABULARY_AND_SCENARIO_FRAMING_ARCHITECTURE_REVIEW`**

covering (a) whether the rationale vocabulary policy is enforceable at all when the scenario's own
facts are phrased as capacity/time, (b) whether factual claims should be restricted to
restating/extracting the supplied material rather than adjudicating the subject's own state, and
(c) whether the R1 scenario family needs framing that does not hand the model capacity vocabulary.
No prompt-level refinement is proposed, and this report does not execute that review.
