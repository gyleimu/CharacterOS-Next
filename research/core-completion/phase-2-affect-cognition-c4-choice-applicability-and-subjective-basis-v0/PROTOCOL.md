# AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 — PROTOCOL

Implements the already-adjudicated C4 architecture
(`C3_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_ARCHITECTURE_REVIEW_V0`:
`MULTIPLE_INTERACTING_ISSUES` → `C3_REQUIRES_CHOICE_APPLICABILITY_AND_SUBJECTIVE_RATIONALE` →
`UPGRADE_C3_TAGGED_CHOICE_AND_SUBJECTIVE_RATIONALE`). **No architecture redesign occurs here.**

## Question

With the choice carrier made explicitly tagged (`NOT_APPLICABLE` | `SELECTED`) and given a lawful
non-factual slot for subject-side reasoning (`subjective_rationale`), does the model

1. mark pure factual turns `NOT_APPLICABLE` (the 30/30 C3 failure), and
2. ground a selection in its own preference instead of manufacturing a subject-state fact
   (the 15/65 C3 failure)

while preserving every C3 success property (explicit choice, host-bound projection hash,
descriptive-only `current_intent`, non-choosing Language, factual-source authority)?

## Studied production surfaces at `6f19b32`

| Stage | Frozen surface |
| --- | --- |
| Cognition protocol | `conversation-cognition-proposal-v5` (`SubjectiveChoiceV1` tagged applicability + bounded rationale) |
| Cognition provider | `ConversationCognitionProviderV5` (tagged native schema, `CognitionInvocationBindingV1`, no model-emitted `projection_hash`) |
| Language input | `language-realization-input-v6` (`selected_subjective_choice`, `no_factual_authority_for_rationale`) |
| Language provider | `LanguageRealizationProviderV0` (C4 prompt: withhold on `NOT_APPLICABLE`, never upgrade a rationale into a fact) |
| Runtime | `InteractiveSubjectRuntimeV0` → `ConversationTextResponseExecutorV1` (unmodified) |

Unchanged: `CognitionProposalV0`, `CommunicationDirectiveV0`, `ClarificationBasisV0`,
`FactualAssessmentV0`, the factual-source authority, and every frozen V1–V4 surface.

## Conditions

Identical to C3: the Affect condition is applied at the transport boundary against the unmodified
runtime — `P` (+0.60, 0.50), `N` (−0.60, 0.50), `Z` (0.00, 0.50) by rewriting the single
`[affect (canonical)]` line, and `A` by removing the affect value line and its legend (verified as
base-minus-affect). Per scenario/condition the subject-data invariant digest is byte-identical and
only the Affect projection differs.

## Cost and stop rules

Provider: Ollama native `qwen3.5:9b`, digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, temperature 0, think false,
stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240 000 ms. Digest mismatch ⇒
`MODEL_BASELINE_CHANGED` stop. No infrastructure retries, no semantic retries, no replacement, no
per-cell rerun, no prompt or schema edits after the freeze. Budget: 65 + 476 + 10 = 551 maximum.

## Stage 1 — Qualification (13 scenarios × 5 = 65 calls, condition `AFFECT_ABSENT`)

Gate: **65/65**. Per cell:

| Requirement | N1–N6 (30 cells) | M/R (35 cells) |
| --- | --- | --- |
| applicability tag | `NOT_APPLICABLE` | `SELECTED` |
| stance | none exists | lawful, non-placeholder |
| rationale | none exists | `null` or lawful (no external fact, no self-state) |
| fact | correct where applicable | correct where applicable |
| Language | no invented preference | stance preserved |

Also required on every cell: protocol-valid and fully delivered, `factual_assessment` carries no
self-state claim and no `subject:`/`entity:`/`environment:` source ref, no unsupported premise, no
false CLARIFY, request-isolation attestation intact, no condition leakage into either prompt.

### Frozen Family-D falsification triggers (both mandatory)

- **failure-to-select**: ≥3/5 cells on ≥2 choice-bearing scenarios emit `NOT_APPLICABLE` or an
  unlawful stance ⇒ `FAMILY_D_FAILURE_TO_SELECT_TRIGGERED`.
- **failure-to-withhold**: ≥3/5 cells on ≥2 null scenarios emit `SELECTED` ⇒
  `FAMILY_D_FAILURE_TO_WITHHOLD_TRIGGERED`.

If either fires, the formal matrix does not run and Family D becomes the recommended review. No
C4.1 prompt-tuning loop.

### Subjective-basis routing rule

If ≥2 choice-bearing scenarios systematically (≥3/5 cells) keep routing subject-side reasoning into
`factual_assessment` (self-state claims or unlawful source refs) or into an unlawful rationale ⇒
`SUBJECTIVE_BASIS_ROUTING_FAILED`. Factual authority must **not** be widened to accommodate it.

## Stage 2 — Formal matrix (17 scenarios × 4 conditions × 7 replicates = 476 calls)

Only on 65/65. Adds `S1–S4` (historical, diagnostic only, no causal claim). Conditions rotate
`P,N,A,Z` by replicate; one shared snapshot is restored per cell; opaque condition-blind session
ids. Primary causal endpoint for `R1–R4` read directly from Cognition: *same task/facts/Memory +
different Affect → different `SELECTED` stance* (P vs N).

Success: 168/168 null cells `NOT_APPLICABLE` with correct facts and no invented preference; 84/84
mixed facts and 84/84 `SELECTED` choices; ≥1/3 mixed and ≥3/4 relevant scenarios materially
separated at the choice level (TVD ≥ 0.28, JS ≥ 0.05, between-condition > frozen within-condition
variance, ≥6/7 consistent per condition); 0 unlawful sources, 0 self-state facts, 0 unsupported
rationale facts, 0 false CLARIFY, 0 Language mutations/inventions, request isolation and condition
leakage PASS.

## Stage 3 — Lawful persistent-state confirmation (2 histories × 5 = 10 calls)

Ecological only (Memory differs by design): a lawfully accumulated POS vs NEG history must
round-trip through persistence and restore exactly and still yield a lawful tagged choice.
Governed by its own freeze, hashed before its first call.

## Determinism and evidence integrity

Raw evidence is append-only (`.partial.jsonl` → immutable `.jsonl`); no cell is ever re-run. Every
freeze is hashed before the first call it governs and covers the harness source digests
(`lib/classify.mjs`, `lib/pipeline.mjs`, `lib/config.mjs`), the production V5 schema digest, the
semantic-draft schema digest and **both production prompt digests**, captured through a zero-model
turn. Classification is deterministic and rule-based; no LLM judge. A zero-model sentinel
(`sentinel.test.mjs`) proves the tagged request/refusal paths before any call, and
`deterministic.test.mjs` pins the classifier semantics including the historical C3 failure shapes.

## Verdict space (precedence as frozen)

`AFFECT_COGNITION_C4_VALIDATED` → `..._CHOICE_APPLICABILITY_FAILED` → `..._SUBJECTIVE_BASIS_FAILED`
→ `..._FACTUAL_ASSESSMENT_FAILED` → `..._LANGUAGE_FIDELITY_FAILED` →
`..._SUBJECTIVE_DIFFERENTIATION_FAILED` → `..._CLARIFICATION_BOUNDARY_FAILED` →
`..._IMPLEMENTATION_FAILED` → `..._REVALIDATION_INCONCLUSIVE`.
