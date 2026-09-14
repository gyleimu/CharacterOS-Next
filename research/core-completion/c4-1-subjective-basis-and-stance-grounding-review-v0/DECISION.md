# C4.1 SUBJECTIVE BASIS & STANCE GROUNDING — ARCHITECTURE DECISION

Read-only review of the two defects left by `AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0`
(`AFFECT_COGNITION_C4_SUBJECTIVE_BASIS_FAILED` + co-present `..._LANGUAGE_FIDELITY_FAILED`,
qualification 55/65, formal matrix not run). Repository truth verified at HEAD `ff91def`
(`origin/main` identical, clean worktree). **Zero production files changed. Zero model calls.**

The frozen historical verdict is not reinterpreted.

## Principal Root Cause

`MULTIPLE_INTERACTING_ISSUES`

Two independent mechanisms, each with its own fix, verified by the fix-coverage test in both
directions:

1. **`SUBJECTIVE_RATIONALE_SEMANTICS_TOO_PERMISSIVE`** — the rationale contract excluded *facts* but
   never excluded *subject-condition descriptions*, so the model grounds a choice in its own state
   (`M1` ×5, frozen `RATIONALE_UNLAWFUL`) or in a self-attributed condition/capability
   (`R4` ×5 `"while my mind is fresh"`, `M3` ×5 `"within my operational scope"`, both passed the
   frozen keyword vocabulary). Fixing stance grounding does not fix this.
2. **`STANCE_NOT_BOUND_TO_REQUESTED_CHOICE`** — a stance can be structurally lawful, correctly
   tagged, and still off-question (`M2` ×5: `"I would volunteer."` for a meeting-attendance
   question). Fixing rationale semantics does not fix this.

`LANGUAGE_HAS_EXCESS_SEMANTIC_FREEDOM` is the **enabling** condition that turned (2) into a
delivered violation: Language supplied the missing decision target (`"I would volunteer to attend"`).
It is a consequence of (2), not a third independent mechanism — with a grounded stance there is
nothing to complete.

## Subject-State Policy Verdict

`SUBJECT_STATE_MAY_INFLUENCE_CHOICE_BUT_NOT_BE_VERBALIZED` (SB-C)

Subject state remains visible to cognition and may lawfully shape the stance; it must stay **latent**
in the rationale. Rationale content is limited to preference / priority / aversion / willingness /
subjective strategy, including conditional and comparative forms over the turn's own alternatives.

Why not SB-A (identical in force, narrower in framing): SB-C states the *epistemic* rule (influence
without narration), which is what the architecture actually wants and what the prompt can state
unambiguously.

Why not SB-B (`ONLY_RAW_STATE_VALUES_MAY_BE_REFERENCED`): §33 of the review asks for a robust line
between "non-factual self-description" and "unsupported physiological fact". That line **cannot be
drawn robustly**, and the C4 evidence is the proof: `"high energy and low stress"` is a value
restatement, `"my mind is fresh"` is a metaphor about the same values, `"within my operational
scope"` is a capability inference, and `"I am capable of performing a 10-minute task given current
energy and stress levels"` (C3) is all three. Any lexical boundary admits one of these.

Why not SB-D: a `basis_kind: "SUBJECT_STATE_INFLUENCED"` token would be a new generic psychology
vocabulary and is not needed — the north star (`different persistent state → different present
choice`) is satisfied by influence alone, and the rationale's purpose is a lawful explanation the
user asked for, not a report of internal state.

## Stance-Grounding Status

`STANCE_FREE_TEXT_PLUS_EXPERIMENT_VALIDATION_SUFFICIENT`

The stance stays free text. No option enum, no structured target, no second stage. Grounding is
enforced by **deterministic turn-local validation**, measured to discriminate exactly on the
observed evidence (see §Feasibility below):

- **Cognition boundary (primary):** on `REALIZE` + `SELECTED`, the stance must share at least one
  *content token* with the turn's own material — the user-facing request text
  (`projection.context.scene`) plus the lawful claim texts in `factual_assessment`. Content token =
  lowercase `[a-z0-9]{4,}`, excluding a frozen stopword/connector list. Otherwise the turn fails
  closed with a structural code. This is what closes the `M2` loophole at the authority boundary:
  Language never receives a stance that does not answer the turn.
- **Language boundary (detector, not production gate):** the experiment scores
  `SEMANTICALLY_COMPLETED_BY_LANGUAGE` as a failure — any content token in the delivered text that is
  absent from `{stance, rationale, lawful claims}` is an addition by Language (connectors excluded).

Not `EXPLICIT_OPTION_BINDING_REQUIRED_WHEN_AVAILABLE`: the Observation/projection exposes **no option
structure at all** (verified: only `[context] scene` raw text, `task`, refs, regulation, memory
sections). The alternatives live only inside the user's sentence, so deterministic binding would
require natural-language extraction — a task taxonomy or a second LLM call, both forbidden by §12 and
§16.

Not `GENERAL_STRUCTURED_CHOICE_TARGET_REQUIRED`: a free-text `target` merely relocates the ambiguity
and the host still cannot validate it (SG-D's own objection).

Not `SINGLE_STAGE_INSUFFICIENT`: both mechanisms are resolved by deterministic, single-stage means.

## Principal Architecture Verdict

`KEEP_C4_TIGHTEN_SEMANTIC_POLICY`

The package is exactly the two cheapest tiers of the review's minimality order — semantic-policy
clarification plus a small Language restriction — with one deterministic validator rule:

1. rationale policy = SB-C (latent-only), stated in the prompt with allowed/forbidden classes;
2. a deterministic turn-local stance-grounding rule in the V5 validator (fail closed);
3. one explicit Language prohibition (never supply a decision target/action absent from the stance),
   plus the experiment's `SEMANTICALLY_COMPLETED_BY_LANGUAGE` endpoint.

No new protocol field, no option binding, no new model stage, no new ontology. `KEEP_C4_AND_FAIL_CLOSED_LANGUAGE_REPAIR`
was the runner-up label; it is rejected only because it leaves mechanism (1) — the rationale
permission — unaddressed, and mechanism (1) is half the evidence.

## Feasibility measurements (deterministic, from the frozen C4 evidence, 0 model calls)

Reproducible via the two committed probes (`measure-stance-grounding.mjs`,
`measure-rationale-and-language-tokens.mjs`).

**Stance grounding, as specified (share ≥1 content token with request ∪ lawful claims):**

| Result | Cells |
| --- | --- |
| grounded | 30/35 |
| ungrounded | **5/35 — exactly `M2` ×5**, and nothing else |

Zero false rejections on this sample. `M2`'s stance tokens are `{volunteer}`; the M2 request material
contains `{planning, meeting, ..., prefer, attend, ...}` and shares nothing with it.

**Language lexical addition, as specified (tokens beyond `{stance, rationale, claims}`):**

| Result | Cells |
| --- | --- |
| no addition | 55/65 |
| addition | `M2` ×5 → `["attend"]` (the decision-semantic completion); `N6` ×5 → `["because"]` (connector, excluded by the frozen stopword list) |

So both mechanisms discriminate the observed defect class with zero false positives on 65 records.

## Exact Rationale Policy

Allowed (each is a *preference-shaped* ground, no factual authority):

- `PURE_PREFERENCE` — "I'd rather finish the required work and stop."
- `PRIORITY` — "I'd rather rehearse first and verify afterwards."
- `AVERSION` — "I prefer not to spend more effort on an unmeasured improvement."
- `WILLINGNESS` — "I'm glad to take this one on."
- `SUBJECTIVE_STRATEGY` — "I'd take the reversible route first."

Forbidden (all are grounds about the subject or the world, not preferences):

- `RAW_SELF_STATE_DESCRIPTION` — "high energy", "low stress", "not tired", any restatement of
  supplied `regulation` values or of `state_revision`.
- `NAMED_PSYCHOLOGICAL_STATE` — "calm", "energized", "stressed", "anxious", "fresh".
- `INFERRED_CAPACITY` — "I have capacity", "I am capable", "within my operational scope",
  "I can manage it".
- `EXTERNAL_FACT` / `HISTORY_CLAIM` — time, resources, deadline, counterpart traits, "last time".
  Such a premise may be *referenced* only if the same premise is a lawfully sourced claim in
  `factual_assessment`; it may never be asserted newly in the rationale.

Reasons, stated semantically rather than lexically:

1. CharacterOS has **no frozen mapping** from regulation/affect values to psychological predicates
   (`stress=0 → "calm"`). Any verbalization creates that mapping implicitly, in the model, per turn.
2. A state description inside a rationale is unfalsifiable *from the subject's own perspective* and
   invites the capacity/capability inference that the C3 host had to refuse 15 times.
3. The north star is `different persistent state → different choice`; narration is not required.
4. Latent-only is robustly checkable (any ground that refers to the subject's condition or to an
   unsourced world fact is a violation); a value-restatement allowance is not (§33).

Detector design (no LLM judge): a pre-frozen predicate family (state nouns, self-predicate patterns,
capability verbs, regulation/state-revision restatements) *plus* scenario-specific audit for
ambiguous cases; the audit must treat unclassifiable grounds as **fail**, and the C4 miss
(`"fresh"`, `"operational scope"`) must be added to the family. The classifier must not silently
default to lawful.

## Exact Stance-Grounding Policy

- `SELECTED` on `REALIZE` ⇒ the stance must be turn-grounded as defined above; else the turn fails
  closed before Language (`STANCE_NOT_TURN_GROUNDED`).
- `NOT_APPLICABLE` ⇒ unchanged (no stance exists; 30/30 held in C4).
- `CLARIFY` ⇒ unchanged (`NOT_APPLICABLE` required).
- `stance` remains the **single choice authority**; rationale is optional explanation and must never
  be needed to determine what was selected.
- Open-ended requests are covered automatically: the rule is lexical overlap with the turn's own
  text, not membership in an enumerated option set.
- Mixed factual + choice turns are unaffected: the shared-token set includes the lawful claim texts.

Known cost, disclosed: a lawful synonym-only stance that reuses no content token of the turn
("I'd be up for it.") would be refused. That is the price of a deterministic grounding rule; it is
measurable (the next qualification must show 35/35 grounded) and it is preferable to Language being
the thing that decides what was selected.

## If option binding were recommended (not recommended)

`NONE` — no `selected_option_ref`, no `choice_space`, no option labels. Rationale: no option
structure exists anywhere in the Observation/projection for these turns, extracting one deterministically
is impossible without a taxonomy, and a free-text target relocates rather than removes the ambiguity.

## Host Validation

| Level | Adopted | Content |
| --- | --- | --- |
| structural | yes (C4, unchanged) | tagged branches, stance/rationale bounds, enum-echo and placeholder rejection |
| structural + turn-lexical grounding | **yes (new)** | the stance shares ≥1 content token with the turn's request ∪ lawful claims |
| semantic free-text validation | **no, and not pretended** | the host cannot judge whether a stance is *semantically* the right answer |

## Model Authority / Language Authority

Model: proposes the tag, the stance and (optionally) a preference-shaped rationale; may not verbalize
subject state, may not assert a world fact outside `factual_assessment`, may not answer off-question.
Language: phrases facts, the stance, and a lawful rationale; may not choose, recompute, invent, or
**supply a decision target the stance does not contain**. With the grounding rule in place, Language
never receives an underspecified stance, so its remaining duty is unchanged.

## Dispositions (unchanged surfaces)

`current_intent` descriptive only · `CommunicationDirective` unchanged · `ClarificationBasis`
unchanged · `factual_assessment` authority frozen (0 violations in C4) · `projection_hash`
host-bound outside model output · no response-mode enum · no new canonical state, nothing persisted.

## Cost

Additional model calls: **0**. Expected latency: unchanged. New ontology: **NONE**. New protocol
field: **NONE**.

## Family D Justified?

`NO`. Both frozen triggers stayed silent in C4, and both remaining mechanisms are solvable with
deterministic single-stage means. Family D has no experimental justification.

## Next Qualification Design (not run here)

Same shape as C4 (13 scenarios × 5 = 65, `AFFECT_ABSENT`, frozen before the first call, harness
digests + prompt digests bound, no retries/replacements):

- **Null endpoint:** 30/30 `NOT_APPLICABLE`, correct facts, no invented preference (must not regress).
- **Choice endpoint:** 35/35 `SELECTED`, lawful stance, and **35/35 turn-grounded** (the new rule).
- **Rationale endpoint:** pre-frozen category scheme; every rationale `null` or in
  `{PURE_PREFERENCE, PRIORITY, AVERSION, WILLINGNESS, SUBJECTIVE_STRATEGY}`; zero
  `RAW_SELF_STATE_DESCRIPTION`, `NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`, `EXTERNAL_FACT`,
  `HISTORY_CLAIM`; ambiguous cases audited as failures, not passed.
- **Language endpoint:** `PRESERVED` vs `SEMANTICALLY_COMPLETED_BY_LANGUAGE` (the latter is failure);
  0 choice changes, 0 inventions, 0 fact changes.
- **Family-D rule:** unchanged dual triggers (failure-to-select; failure-to-withhold), plus the new
  failure-to-ground counted as failure-to-select.
- Formal matrix only on 65/65; primary causal endpoint remains the Cognition-level `SELECTED` stance
  under different Affect — **never rationale wording**.

## Recommended Next Slice

Exactly one:

`AFFECT_COGNITION_C4_2_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_V0`

Implement the SB-C rationale policy, the deterministic turn-local stance-grounding rule, and the
Language prohibition; freeze; qualify 65; run the 476-cell formal matrix only on 65/65.

## Real Diagnostic Model Calls

`0` — every claim above is a re-derivation from the frozen C4 qualification evidence plus repository
truth.

## Production Files Changed

`NO` — this review changed no production file.
