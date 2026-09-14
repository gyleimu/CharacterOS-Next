# AFFECT_COGNITION_C4_2_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_V0 — PROTOCOL

Implements the adjudicated C4.2 semantic-policy correction
(`AFFECT_COGNITION_C4_1_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_REVIEW`:
`MULTIPLE_INTERACTING_ISSUES` → `SUBJECT_STATE_MAY_INFLUENCE_CHOICE_BUT_NOT_BE_VERBALIZED` /
`STANCE_FREE_TEXT_PLUS_EXPERIMENT_VALIDATION_SUFFICIENT` →
`KEEP_C4_TIGHTEN_SEMANTIC_POLICY`). **No architecture redesign.**

## Two chartered corrections

1. **Rationale policy (latent subject state).** `subjective_rationale` may contain only
   preference / priority / aversion / willingness / subjective strategy. Describing the subject's
   own condition is forbidden, as is inventing a mapping from regulation/affect values to
   psychological language.
2. **Stance grounding + Language non-completion.** The stance must answer the choice the user
   actually requested and stand on its own; Language must never supply a decision target, action,
   object, option or choice meaning absent from the stance.

## Candidate lexical guard: evaluated once, NOT shipped

The brief's candidate rule (a `SELECTED` stance must share ≥1 content token with the turn request
text ∪ lawful claim texts) was frozen **with** a 40-lawful / 20-invalid paraphrase suite *before*
evaluation, then evaluated exactly once, with no tuning:

| Standard | Required | Observed |
| --- | --- | --- |
| lawful paraphrase acceptance | ≥ 38/40 | **34/40** |
| invalid / off-question detection | 20/20 | **15/20** |
| lexical-ceiling diagnostics (reported separately) | — | 3/3 undetectable |

Recorded as `LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`; **not added to production** (no
`STANCE_NOT_TURN_GROUNDED` rejection exists in the runtime). Off-question stances are therefore
detected by this qualification, which knows each scenario's requested alternatives.

## Frozen surfaces (unchanged)

`conversation-cognition-proposal-v5` and `language-realization-input-v6` are byte-identical in
schema, validator and hash domain. C4.2 changes **prompt content and validation semantics only**;
the revised prompts are bound into the freeze by digest (`cognition_prompt_sha256`,
`language_prompt_sha256`). `current_intent` stays descriptive only; `CommunicationDirective`,
`ClarificationBasis`, the factual-source authority and the host-bound projection hash are untouched.

## Qualification (13 scenarios × 5 = 65 calls, condition `AFFECT_ABSENT`)

Gate: **65/65**. Endpoints: 30/30 `NOT_APPLICABLE` with `RATIONALE_ABSENT` and no invented
preference; 35/35 `SELECTED` on-question with a lawful-or-absent rationale; 0 forbidden rationale
categories; 0 off-question stances; 0 `SEMANTICALLY_COMPLETED_BY_LANGUAGE`; 0 self-state factual
claims; 0 unlawful source attempts; 0 false CLARIFY; isolation attestation intact.

Family-D triggers (both mandatory, unchanged): ≥3/5 cells on ≥2 choice-bearing scenarios emitting
`NOT_APPLICABLE`, an invalid stance or an ungrounded/off-question stance ⇒ failure-to-select;
≥3/5 cells on ≥2 null scenarios emitting `SELECTED` ⇒ failure-to-withhold.

## Formal matrix

Only on 65/65: 17 scenarios × P/N/Z/A × k=7 = 476 cognition cells. Primary causal endpoint remains
the **Cognition-level `SELECTED` stance** under different Affect (P vs N) — never rationale wording.

## Verdict space (precedence as frozen)

`AFFECT_COGNITION_C4_2_VALIDATED` → `..._RATIONALE_BOUNDARY_FAILED` →
`..._STANCE_GROUNDING_FAILED` → `..._LANGUAGE_FIDELITY_FAILED` →
`..._FACTUAL_ASSESSMENT_FAILED` → `..._SUBJECTIVE_DIFFERENTIATION_FAILED` →
`..._CLARIFICATION_BOUNDARY_FAILED` → `..._IMPLEMENTATION_FAILED` →
`..._REVALIDATION_INCONCLUSIVE`. Because the space names no applicability verdict, an applicability
regression (a frozen C4 property) is reported as `..._IMPLEMENTATION_FAILED`.
