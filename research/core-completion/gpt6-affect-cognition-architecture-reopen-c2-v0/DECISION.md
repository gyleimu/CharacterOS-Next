# GPT6_AFFECT_COGNITION_ARCHITECTURE_REOPEN_C2 — ARCHITECTURE DECISION

Read-only architecture review of the C2 subjective-differentiation failure. Repository truth
verified at HEAD `6fa873f9ba5403f36f6da73a71ba1db8629a3ea8` (clean, `origin/main` identical).
Zero diagnostic model calls — the existing 65-run qualification evidence was sufficient.
No production files changed in this review.

## Principal Root Cause

`CURRENT_INTENT_SEMANTIC_COLLISION`

The directive enum value `REALIZE_CURRENT_INTENT` flowed verbatim into the free-text field named
`current_intent` in **65/65** qualification records — including the 29 that passed (they passed
only because null tasks are scored without a choice). The model produced excellent structured
factual assessments, ref bindings, directives and basis handling; the single field it never
populated with content is the one whose name reads as "the current intent (kind)". This is a
structural semantic collision, not random non-compliance.

Secondary findings: the host's selected-intent validator was structurally too weak (it rejected
null/empty and unresolved prefixes but could not distinguish an enum echo from a stance); the
choice carrier was an unconstrained free-text string embedded among mechanical fields; and a
model-specific compliance fragility exists for echoing long hash strings (M2, 5/5 cells,
missing `sha256:` prefix).

## Architecture Status

`C2_REQUIRES_EXPLICIT_SUBJECTIVE_CHOICE`

The factual machinery of C2 is proven (0/65 subject-state factual-source attempts; all six null
tasks correct in every cell; factual boundary held). What is missing is an explicit,
schema-prominent representation of the turn-local subject choice.

## Principal Architecture Verdict

`UPGRADE_TO_C3_EXPLICIT_SUBJECTIVE_CHOICE`

## Executive Decision

1. C2's factual substructure is retained exactly: `factual_assessment` with
   `SOURCE_QUOTE`/`DERIVED_RESULT` and source binding stays unchanged.
2. A new conversation wrapper version `ConversationCognitionProposalV4` adds a turn-local
   `subjective_choice: SubjectiveChoiceV0 | null` as a SIBLING of `factual_assessment`,
   `cognition`, `communication_directive` and `clarification_basis`.
3. `SubjectiveChoiceV0 = { stance: string }` only — no reason field, no evidence refs, no task
   enums. The stance is the selected fact-compatible stance itself; conditional stances state
   their condition; factual premises must ride in `factual_assessment` where source binding
   already governs them.
4. For V4, `CognitionProposalV0.current_intent` becomes DESCRIPTIVE ONLY (field and V0 schema
   unchanged); choice authority moves to `subjective_choice`. The unresolved-prefix gate moves
   from `current_intent` to `subjective_choice.stance`, plus a new structural rejection of
   directive-enum echoes.
5. `CommunicationDirectiveV0` is unchanged. CLARIFY ⇒ `subjective_choice` must be null. On
   REALIZE, non-null choice is a model obligation defined by the prompt and enforced by
   experiment qualification (which knows which scenarios are choice-bearing) — production keeps
   no task taxonomy.
6. `ClarificationBasis` is unchanged.
7. `projection_hash` becomes HOST-BOUND OUTSIDE MODEL OUTPUT for the V4 conversation protocol:
   the provider records the request identity at call time and binds the response to the
   outstanding request host-side (the exact pattern already proven by the Language provider's
   in-flight bindings). The frozen V0 field remains in the schema, but V4 does not gate on the
   model's echo — M2's 5/5 hash-prefix failures become impossible.
8. Language Input V5 replaces `selected_current_intent` with the authoritative
   `selected_subjective_choice`; the already-implemented
   `preserve_selected_intent`/`no_invented_justification` constraints carry over. Language may
   phrase; it may not decide, recompute, or invent factual justification.
9. Topology unchanged: ONE Cognition call + 0/1 Language call. No canonical state, no new
   ontology, nothing persisted.
10. Falsification: if the next qualification shows the model still emitting enum echoes or null
    choices on ≥3/5 cells of ≥2 choice scenarios under the V4 schema, single-stage Cognition is
    insufficient for this model class and Family D (two-stage) becomes justified per the stage
    design in §47 of the review.

## Evidence Reviewed

- `research/core-completion/phase-2-affect-cognition-c2-clean-revalidation-v0/`
  (qualification-raw.jsonl — 65 records; qualification-summary.json; qualification-forensics.json;
  condition-leakage.json; request-attestation.json; REPORT.md)
- `research/core-completion/phase-2-affect-cognition-c2-host-bound-language-and-semantic-revalidation-v0/`
  (preserved invalid run; untouched)
- Production: `conversation-cognition-proposal.ts` (V3 validator, factual sources,
  selected-intent gate), `conversation-cognition-provider-v3.ts` (V3 JSON schema + prompt),
  `language-realization-input.ts` (V4), `language-realization-provider.ts` (host-bound in-flight
  binding precedent), `conversation-text-response-executor-v1.ts`, `cognition-action/types.ts`
  (CognitionProposalV0), `communication-directive.ts`.

## Key verified facts

- 65/65 records: `cognition.current_intent === "REALIZE_CURRENT_INTENT"` (including all 29
  passing records — they passed only because null tasks need no choice).
- 0/65 subject-state factual-source attempts (the factual-source boundary fix worked).
- Null tasks N2, N3, N4, N5Q, N6: 5/5 correct each; N1 4/5 with the single failure a research
  classifier artifact (correct answer plus echoed question).
- M1: 4/5 records invented capacity/workload rationale.
- M2: 5/5 rejected on `projection_hash` missing the `sha256:` prefix.
- 0 CLARIFY emissions; all cells REALIZE.
- `LanguageRealizationInputV4` already carries `selected_current_intent` and
  `preserve_selected_intent: true` — the downstream preservation machinery exists; upstream
  never supplied a real selection.

## Why 36/36 (indeed 65/65) echoed REALIZE_CURRENT_INTENT

The field name `current_intent` and the directive value `REALIZE_CURRENT_INTENT` are
semantically adjacent; the JSON schema types `current_intent` as a plain string among mechanical
fields (hash, refs, numbers) with no structural marker that it IS the decision; and under native
structured output the model fills the nearest valid-looking token — the directive enum it just
emitted. Prompt rule 6 explicitly ordered the opposite behavior and was ignored in every call,
which is why this is not primarily a prompt-wording problem. The host validator then accepted the
echo (it only rejected null/empty/unresolved prefixes), so the echo flowed to Language as if a
stance had been selected — Language chose (`CHOICE_INVENTED`).

## Recommended Architecture (exact turn-local schema)

```ts
type SubjectiveChoiceV0 = {
  readonly stance: string; // non-empty canonical NFC text, 1..256 code points
};

type ConversationCognitionProposalV4 = {
  readonly schema_version: "conversation-cognition-proposal-v4";
  readonly factual_assessment: FactualAssessmentV0;        // unchanged C2 machinery
  readonly cognition: CognitionProposalV0;                  // unchanged shape; current_intent descriptive only
  readonly subjective_choice: SubjectiveChoiceV0 | null;    // NEW: turn-local choice authority
  readonly communication_directive: CommunicationDirectiveV0; // unchanged
  readonly clarification_basis: ClarificationBasisV0 | null;   // unchanged
};
```

Host validation (structural only):
- closed keys; `stance` canonical text, trimmed non-empty, ≤256 code points;
- `stance` must NOT equal (case-insensitive) `REALIZE_CURRENT_INTENT` or
  `CLARIFY_MISSING_CONTEXT` (enum echo rejected);
- `stance` must not start with an unresolved prefix (express a preference / decide whether /
  consider whether / determine whether / choose whether) — a conditional stance states its
  condition and is lawful;
- CLARIFY ⇒ `subjective_choice === null` (required);
- REALIZE ⇒ `subjective_choice` null (factual answer) or a valid non-null stance
  (choice-bearing answer); presence is the model's obligation, enforced by experiment
  qualification — the host keeps no task taxonomy;
- no reason field, no evidence refs on the choice: factual premises must appear in
  `factual_assessment` (source binding already applies); a preference-flavored reason needs no
  factual claim and may be phrased by Language.

Host CANNOT validate that a stance is psychologically "correct"; it validates only that a
stance-shaped artifact exists and is structurally lawful. Causality is validated by experiment.

## Dispositions

- **CognitionProposalV0 changes:** NONE (frozen; V4 is a wrapper-level change).
- **current_intent verdict:** `CURRENT_INTENT_BECOMES_DESCRIPTIVE_ONLY` (for V4).
- **CommunicationDirective changes:** NONE. **ClarificationBasis changes:** NONE.
- **factual_assessment changes:** NONE.
- **projection_hash verdict:** `HOST_BOUND_PROJECTION_HASH_OUTSIDE_MODEL_OUTPUT` (V4 gates on
  host-side request association, mirroring the Language provider's proven in-flight binding; the
  frozen V0 field stays in the schema but is not authoritative in V4).
- **Language protocol:** `language-realization-input-v5` replaces `selected_current_intent` with
  `selected_subjective_choice` (+ null for factual-only turns); semantic draft shape unchanged;
  host-owned hash retained.
- **Does Language ever choose?** NO. **Does it recompute facts?** NO.
- **Additional model calls:** 0. **Expected latency:** unchanged (~20 s cognition, ~3 s language).
- **New ontology:** NONE. Not canonical, not persisted, not a Goal/Need/Commitment/Action/
  Relationship state; it is turn-local protocol output only.
- **Future Belief/Relationship/Personality compatibility:** the boundary "facts constrain the
  feasible decision space; subject state shapes selection within that space" generalizes, but no
  generic framework is created now.

## Next validation design (not run here)

Qualification (affect-absent ×5, 13 scenarios N1–N6, M1–M3, R1–R4, 65 calls) must pass 65/65 with
the new PRIMARY endpoint `CHOICE_SELECTED_AT_COGNITION` (non-null valid stance on every M/R cell;
null on N cells). Only then the formal 476-call P/N/Z/A k=7 matrix runs, scoring per record:
`FACT_VALID`, `CHOICE_SELECTED_AT_COGNITION`, `CHOICE_FACT_COMPATIBLE`,
`CHOICE_PRESERVED_BY_LANGUAGE`, `NO_UNSUPPORTED_REASON`, `FINAL_DELIVERED`. Success: 168/168 null
correct; mixed 84/84 facts and 84/84 choices with 0 unsupported premises and ≥1/3 material P/N at
the CHOICE level; R ≥3/4 material P/N at the CHOICE level; Language fidelity CHOICE_CHANGED = 0,
CHOICE_INVENTED = 0, FACT_CHANGED = 0; 0 false CLARIFY; 0 subject-state factual sources; request
isolation and condition-blind ids; lawful POS/NEG ×5 restore confirmation (ecological, not
causal). Falsification: persistent echo/null choice under V4 ⇒ two-stage Family D.

## Implementation ownership

- **GPT-5.6 Sol:** V4 wrapper protocol + host-bound projection identity + choice authority
  binding + Language V5 + V1/V2/V3/V4 compatibility + hard TypeScript migration.
- **DeepSeek V4.1 Flash:** fixtures, research harness, qualification, bulk formal matrix,
  statistics, reports. Also fix the N1 research-classifier artifact (echoed-question false
  positive) before the next freeze — harness-only, not architecture.
- **GPT-6 reopen conditions:** the recommended architecture itself encounters semantic
  contradiction; factual_assessment becomes Affect-contaminated; Language cannot preserve the
  explicit handoff under correct implementation.

## Answers to binary questions

- Is this primarily prompt wording? `PARTIALLY` (wording already ordered the right behavior and
  was ignored 65/65; a structural field is required, clearer wording accompanies it).
- Is current_intent semantically adequate? `NO`.
- Is CommunicationDirective colliding with subject intent? `YES`.
- Is single Cognition call still viable? `YES`.
- Can Affect Phase 2 close after one more slice? `YES` (conditional on C3 validation passing).
- Can Relationship Phase 3 begin now? `NO`.
- Real diagnostic model calls in this review: `0`. Production files changed: `NO`.
- GPT-6 confidence: `MEDIUM`.
- Largest remaining uncertainty: whether qwen3.5:9b will reliably populate `subjective_choice`
  with genuine stances under the V4 schema rather than echoing or nulling — only the next
  qualification can answer; the two-stage fallback is defined.

## Recommended next slice

Exactly ONE: `AFFECT_COGNITION_C3_REVALIDATION_V0`
