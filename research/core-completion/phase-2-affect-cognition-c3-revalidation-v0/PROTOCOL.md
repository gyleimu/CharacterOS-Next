# AFFECT_COGNITION_C3_REVALIDATION_V0 — PROTOCOL (frozen before model calls)

Implements the already-adjudicated C3 architecture
(`research/core-completion/gpt6-affect-cognition-architecture-reopen-c2-v0/DECISION.md`,
`UPGRADE_TO_C3_EXPLICIT_SUBJECTIVE_CHOICE`). **No architecture redesign occurs in this slice.**

## Question

Under the C3 protocol — where the subject's selection is an explicit schema sibling
(`subjective_choice: SubjectiveChoiceV0 | null`) and the projection hash is host-bound outside
model output — does the production Cognition stage select a lawful stance for every
choice-bearing turn (primary endpoint `CHOICE_SELECTED_AT_COGNITION`), preserve the supplied
facts, and does Language preserve (never change, never invent) that selection?

The C2 failure this replaces: 65/65 records echoed the directive enum `REALIZE_CURRENT_INTENT`
into the free-text `current_intent`, which the host then passed to Language as if a stance had
been selected.

## Studied production surfaces (unchanged during the experiment)

| Stage | Frozen surface |
| --- | --- |
| Cognition protocol | `conversation-cognition-proposal-v4` (`ConversationCognitionProposalV4`, `SubjectiveChoiceV0`) |
| Cognition provider | `ConversationCognitionProviderV4` (host-bound invocation binding; V4 JSON schema has no `projection_hash`) |
| Language input | `language-realization-input-v5` (`selected_subjective_choice`) |
| Language provider | `LanguageRealizationProviderV0` (`semantic-draft-v1`, host-owned `input_hash`) |
| Runtime | `InteractiveSubjectRuntimeV0` → `ConversationTextResponseExecutorV1` (unmodified) |

`CognitionProposalV0`, `CommunicationDirectiveV0`, `ClarificationBasisV0`,
`FactualAssessmentV0` and every frozen V1/V2/V3 surface are unchanged. The C3 change is a wrapper
protocol plus a host-owned identity binding.

## Conditions

The Affect condition is applied at the **transport boundary** against the unmodified production
runtime, exactly as in the C2 clean revalidation:

- `P` canonical valence `+0.6`, `N` canonical valence `-0.6`, `Z` canonical valence `0`
  (all activation `0.5`), each by rewriting the single `[affect (canonical)]` line;
- `A` ABSENT, by removing the affect value line and its legend (verified as base minus affect);
- the Affect projection the runtime is restored with is likewise `P/N/Z/A`, so the cognition lag
  (cognition sees the pre-current-event affect) is exercised identically.

Attestation per scenario/condition: only the Affect projection differs; the subject-data
invariant digest (identity/scene/task/observation/citeable refs/action space) is byte-identical;
no experimental label is present; the factual Memory section is untouched.

## Cost and stop rules

- Provider: Ollama native `qwen3.5:9b`, digest
  `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, temperature 0, think false,
  stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240000 ms. A digest mismatch is a hard
  `MODEL_BASELINE_CHANGED` stop.
- `RETRY_POLICY`: no infrastructure retries, no semantic retries, no replacement, no per-cell
  rerun, no prompt tuning after the freeze.
- Budget: qualification 65, formal 476, lawful 10, maximum 551 cognition/language invocations.

## Stage 1 — Qualification (13 scenarios × 5 replicates = 65 calls, condition `AFFECT_ABSENT`)

Scenarios: `N1–N6` (null: no subjective selection exists), `M1–M3` (mixed: exact supplied fact +
explicit personal choice), `R1–R4` (relevant: choice between feasible options).

Gate: **65/65** must satisfy the record predicate — protocol-valid, fully delivered, fact-correct
where applicable, `CHOICE_SELECTED_AT_COGNITION` where a choice is required and exactly null where
none exists, `CHOICE_PRESERVED` by Language, no unsupported premise, no false CLARIFY, isolation
attestation intact.

Family-D falsification (frozen threshold): if ≥3 of 5 cells on ≥2 choice-bearing scenarios still
produce a null choice, a directive-enum echo, or another non-choice placeholder, single-stage
Cognition is insufficient for this model class and the formal matrix **must not run**.

The formal matrix runs only if qualification is 65/65.

## Stage 2 — Formal matrix (17 scenarios × 4 conditions × 7 replicates = 476 calls)

Scenarios add `S1–S4` (historical, diagnostic only: they test whether the choice is grounded in
the subject's own recorded history, and are reported without a causal claim).

Conditions rotate round-robin `P,N,A,Z` by replicate. A single shared snapshot is restored per
cell, so persistent Affect cannot cross cells; session ids are opaque UUIDs carrying no scenario
or condition identity.

Record scoring (per the adjudicated decision): `FACT_VALID`, `CHOICE_SELECTED_AT_COGNITION`,
`CHOICE_FACT_COMPATIBLE` (the stance is a lawful stance and its factual premises, if any, ride in
`factual_assessment`), `CHOICE_PRESERVED_BY_LANGUAGE`, `NO_UNSUPPORTED_REASON`, `FINAL_DELIVERED`.

Success thresholds:

| Component | Threshold |
| --- | --- |
| Null facts | 168/168 correct, no false CLARIFY, no unsupported premise |
| Mixed facts | 84/84 correct |
| Mixed choices | 84/84 selected at cognition and preserved by Language |
| Mixed materiality | ≥1/3 scenarios with choice-level TVD(P,N) ≥ 0.28 and JS ≥ 0.05 |
| Relevant materiality | ≥3/4 scenarios materially affected at the choice level |
| Language fidelity | `CHOICE_CHANGED = 0`, `CHOICE_INVENTED = 0`, `FACT_CHANGED = 0` |
| Authority | 0 subject-state factual sources, 0 request-isolation violations |

## Stage 3 — Lawful persistent-state confirmation (2 histories × 5 = 10 calls)

An ecological confirmation that a lawfully accumulated positive vs negative history round-trips
through persistence and restore exactly, and still yields a lawful explicit choice. Because Memory
differs by design, this is **not** causal isolation and is reported as such.

## Determinism and evidence integrity

- Raw evidence is append-only (`.partial.jsonl` → immutable `.jsonl`); completed artifacts are
  never rewritten. No cell is ever re-run.
- Freezes (qualification, formal, lawful) are hashed before the first model call they govern and
  verified by re-hash on load.
- Classification is deterministic and rule-based; **no LLM judge is used**.
- The N1 classifier artifact reported by the C3 decision is fixed before the freeze
  (see `deterministic.test.mjs`): a correct answer plus an echoed question is no longer scored as
  a contradiction.
- A zero-model transport sentinel (`sentinel.test.mjs`) proves the harness reaches the V4
  transport, requests the closed native schema, never asks for a projection hash, rejects an
  enum-echo stance before Language, and carries `selected_subjective_choice` into V5.

## Verdict space (precedence as frozen)

`AFFECT_COGNITION_C3_VALIDATED` → `..._FACTUAL_ASSESSMENT_FAILED` →
`..._CHOICE_PRODUCTION_FAILED` → `..._LANGUAGE_FIDELITY_FAILED` →
`..._SUBJECTIVE_DIFFERENTIATION_FAILED` → `..._CLARIFICATION_BOUNDARY_FAILED` →
`..._IMPLEMENTATION_FAILED` → `..._REVALIDATION_INCONCLUSIVE`.
