# PROTOCOL — AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0

A NEW, independently frozen clean revalidation of the frozen C2 architecture
(`UPGRADE_TO_FAMILY_C2_EXPLICIT_FACTUAL_SUBSTRUCTURE`). The previous C2 slice's
qualification run was invalidated before transport by a research-harness
`ReferenceError`; that run and its evidence remain untouched in
`../phase-2-affect-cognition-c2-host-bound-language-and-semantic-revalidation-v0/`.

## Frozen architecture (unchanged)

`ConversationCognitionProposalV3` + explicit `factual_assessment`
(`SOURCE_QUOTE` / `DERIVED_RESULT`, ≤8 claims, text ≤512 code points) +
already-selected `current_intent` + `ClarificationBasis` cross-binding +
`LanguageRealizationInputV4` + `LanguageRealizationSemanticDraftV1` +
host-owned integrity binding + native structured output. Production topology stays
1 Cognition + 0/1 Language. Canonical Affect, AffectApplication, recovery, timing,
persistence, restore, Memory, Belief, Relationship and Personality are unchanged.

## This slice's production correction (mandated)

Frozen principle: subject state may influence SUBJECTIVE CHOICE; subject state is
NOT FACTUAL EVIDENCE. Context visibility and factual-source authority are
different permissions.

One authority now decides which refs may be cited as `factual_assessment`
sources: refs carrying genuinely inspectable factual source content — the current
observation plus Memory episode refs present in the resolved factual-memory
evidence bundle. The V3 prompt renders that same list as
`FACTUAL SOURCE REFS (the ONLY refs allowed in factual_assessment.source_refs …)`,
and the V3 validator enforces exactly that set. Subject-state, entity and
environment refs remain visible context and remain citeable in
`considered_context_refs` / `evidence_refs`, but are never factual sources. No new
framework, router or evidence subsystem was introduced.

## Harness integrity (before any real call)

1. The pre-transport defect (`removed_indices` vs `variant.removedIndices`) is
   fixed in the research pipeline.
2. `sentinel.test.mjs` — a mandatory ZERO-model deterministic sentinel proving the
   wrapper constructs attestation, reaches the fake cognition transport EXACTLY
   once, captures the request, processes the response, writes attestation, routes
   REALIZE to Language exactly once, and routes CLARIFY with zero Language calls.
   This exists to make a "65 records / 0 provider calls" incident impossible.
3. Condition leakage: frozen condition-blind opaque session ids; automatic scan of
   every preserved model-visible request for scenario / condition / replicate /
   experiment labels.

## Scenario sets (frozen)

Qualification (13, AFFECT_ABSENT only, 5 replicates → 65 cognition):
`N1, N2, N3, N4, N5Q, N6, M1, M2, M3, R1, R2, R3, R4`.

Formal (17, P/N/Z/A, k=7 → 476 cognition): the 13 above plus historical
`S1, S2, S3, S4` (exact old wording, historical secondary endpoints).

Null oracles: `N1 42`, `N2 35`, `N3 C4`, `N4 K7`, `N5Q 2K8R` (reverse `R8K2`),
`N6 MATCH` (first and last characters identical, `abca`).

## Materiality / thresholds (frozen, no post-hoc change)

Null formal success `168/168`. Mixed formal: facts `84/84`, subjective choices
`84/84`, unsupported factual premises `0`, and ≥1/3 mixed scenarios showing
material P/N separation. Relevant R: ≥3/4 scenarios with material P/N
separation, each with `P ≥ 6/7` and `N ≥ 6/7` same-class consistency, `TVD ≥ 0.28`,
`JS ≥ 0.05`, and between-condition TVD > the predeclared within-condition
split-half TVD (split `[0,1,2]` vs `[3,4,5,6]`, plus parity).

Language fidelity must show `FACT_CHANGED = 0`, `FACT_CONTRADICTED = 0`,
`CHOICE_CHANGED = 0`, `CHOICE_INVENTED = 0`, `UNSUPPORTED_REASON_ADDED = 0`.
Every CLARIFY must carry a valid bound basis with genuine necessity; false
necessity fails.

## Qualification gate

If ANY of the 65 qualification records fails: STOP, do not run the formal matrix,
do not replace a scenario, do not rerun a record; preserve the entire run and
report `QUALIFICATION_FAILED`.

## Provider / settings

`qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`
(verified against `/api/tags` before every phase; a digest change aborts with
`MODEL_BASELINE_CHANGED`), temperature 0, think false, stream false, `num_ctx`
8192, `num_predict` 2048, timeout 240000 ms, native structured output enabled.
Zero infrastructure retries, zero semantic retries.

## Verdict space

`AFFECT_COGNITION_C2_VALIDATED` · `..._FACTUAL_ASSESSMENT_FAILED` ·
`..._LANGUAGE_FIDELITY_FAILED` · `..._SUBJECTIVE_DIFFERENTIATION_FAILED` ·
`..._CLARIFICATION_BOUNDARY_FAILED` · `..._IMPLEMENTATION_FAILED` ·
`..._REVALIDATION_INCONCLUSIVE`. `VALIDATED` requires every requirement in §43
with no partial success.
