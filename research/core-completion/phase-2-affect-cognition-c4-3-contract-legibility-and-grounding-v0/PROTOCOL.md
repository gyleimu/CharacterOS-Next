# AFFECT_COGNITION_C4_3_CONTRACT_LEGIBILITY_AND_GROUNDING_V0 — PROTOCOL

One documented contract-legibility repair, then a fresh qualification, then the formal Affect matrix
**only** on 65/65. No architecture redesign.

## The repaired defect

C4.2 failed 5 `N2` cells because a `factual_assessment` claim cited `observation:o-session-t2` while
`cognition.considered_context_refs` omitted it. The host has always enforced that binding; the V3-era
prompt stated it and the V4/V5 rewrite dropped the sentence.

## Exact host requirement (read from the production validator, not assumed)

For every `factual_assessment.claims[i].source_refs[j] = ref`, the host requires:

1. `ref ∈ factualAssessmentSourceRefs(projection)` — the advertised **FACTUAL SOURCE REFS** set
   (subject / entity / environment refs are never factual sources);
2. **`ref ∈ cognition.considered_context_refs` AND `ref ∈ cognition.evidence_refs`** ← the dropped
   requirement;
3. `factualSourceTexts(projection, ref) !== null` — inspectable source content exists;
4. for `SOURCE_QUOTE`: the claim text is an exact substring of the cited source content.

## Exact prompt repair (prompt → host, never host → prompt)

Cognition prompt rule 2a (verbatim):

> **CITATION BINDING (C4.3):** every ref you list in any
> `factual_assessment.claims[*].source_refs` must ALSO be listed in
> `cognition.considered_context_refs` AND in `cognition.evidence_refs`. The host binds a cited source
> into BOTH of those cognition arrays; a claim whose source appears only in `factual_assessment`, or
> in only one of the two arrays, is rejected and the whole turn is refused. Cite nothing you have not
> bound in both arrays.

The host validator is **unchanged**.

## Contract-legibility audit

`audit-contract-legibility.mjs` compares 13 host-enforced obligations against the model-facing
contract (system prompt, request-rendered data block, or JSON schema). Result:
**`CONTRACT_LEGIBILITY_OK`** — no material obligation unstated. One non-material gap is recorded and
deliberately not changed in this slice: the 256-code-point stance/rationale bound is implied by the
prompt's "ONE short sentence" wording but not stated numerically.

## Frozen surfaces (unchanged from C4.2)

Tagged `SubjectiveChoiceV1` (`NOT_APPLICABLE` / `SELECTED` + bounded rationale), the C4.2 rationale
policy (allowed: `PURE_PREFERENCE`, `PRIORITY`, `AVERSION`, `WILLINGNESS`, `SUBJECTIVE_STRATEGY`;
forbidden: `RAW_SELF_STATE_DESCRIPTION`, `NAMED_PSYCHOLOGICAL_STATE`, `INFERRED_CAPACITY`,
`EXTERNAL_FACT`, `HISTORY_CLAIM`), stance as sole choice authority, the Language
no-semantic-completion rule, `current_intent` descriptive only, unchanged directive / clarification
basis / factual-source authority / host-bound projection hash. The lexical grounding guard stays
**NOT SHIPPED** (`LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`, evaluated once in C4.2 and not re-evaluated).
No schema or version bump: the repair is prompt text only, bound into the freeze by digest.

## Qualification (13 scenarios × 5 = 65 calls, `AFFECT_ABSENT`)

Gate **65/65**: 30/30 null cells `NOT_APPLICABLE` with correct facts, lawful citation binding,
`RATIONALE_ABSENT`, no invented preference, full delivery (**N2 must be 5/5**); 35/35 choice cells
`SELECTED` on-question with a lawful-or-null rationale, unchanged by Language; 0 forbidden rationale
classes; 0 off-question stances; 0 semantic completions; 0 citation-binding violations; 0
self-state factual claims; 0 unlawful source attempts; 0 false CLARIFY; isolation intact.

Family-D triggers unchanged: ≥3/5 on ≥2 choice-bearing scenarios failing to select or ground;
≥3/5 on ≥2 null scenarios declaring `SELECTED`.

## Formal matrix (only on 65/65)

17 scenarios × P(+0.60,0.50) / N(−0.60,0.50) / Z(0.00,0.50) / A(absent) × k=7 = 476 cognition calls.
Primary causal endpoint: the **Cognition-level `SELECTED` stance** (P vs N), never rationale wording.
Null 168/168; mixed 84/84 facts and 84/84 valid choices with ≥1/3 material P/N separation; R ≥3/4
material separation (≥6/7 per-condition class consistency, TVD ≥ 0.28, JS ≥ 0.05, between > frozen
within-condition split-half variance). Then lawful POS×5 / NEG×5 fresh-restore as ecological
confirmation only.

## Verdict space (precedence as frozen)

`AFFECT_COGNITION_C4_3_VALIDATED` → `..._CONTRACT_LEGIBILITY_FAILED` →
`..._RATIONALE_BOUNDARY_FAILED` → `..._STANCE_GROUNDING_FAILED` → `..._LANGUAGE_FIDELITY_FAILED` →
`..._FACTUAL_ASSESSMENT_FAILED` → `..._SUBJECTIVE_DIFFERENTIATION_FAILED` →
`..._CLARIFICATION_BOUNDARY_FAILED` → `..._IMPLEMENTATION_FAILED` →
`..._REVALIDATION_INCONCLUSIVE`. An N2-style binding failure again ⇒
`..._CONTRACT_LEGIBILITY_FAILED` and STOP (no further prompt tuning).
