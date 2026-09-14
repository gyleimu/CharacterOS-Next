# AFFECT_COGNITION_C4_CHOICE_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 — BASELINE

## Repository

| Field | Value |
| --- | --- |
| Branch | `main` |
| Baseline commit | `6f19b32` — `fix: make subjective choice applicability explicit` |
| Parent | `12404f2` — `research: validate affect cognition c3` |
| Worktree at freeze time | clean except this new research directory |

## Provider

| Field | Value |
| --- | --- |
| Kind | Ollama native (`OllamaNativeCognitionTransportV0`, native JSON-schema structured output) |
| Endpoint | `http://127.0.0.1:11434` |
| Model | `qwen3.5:9b` |
| Digest (verified, required) | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| Quantization | `Q4_K_M` |
| Ollama version | 0.34.0 |
| Generation | temperature 0, think false, stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240 000 ms |

Digest verified identical to the C2 and C3 baselines, so C4 is comparable on the same model bytes.

## Production surfaces under test (frozen at `6f19b32`)

| Surface | Identity | Digest bound into the freeze |
| --- | --- | --- |
| Cognition protocol | `conversation-cognition-proposal-v5` | `proposal_v5_schema_sha256` |
| Cognition provider | `ConversationCognitionProviderV5` (`CognitionInvocationBindingV1`) | `cognition_prompt_sha256` (captured from a real request through a zero-model turn) |
| Language input | `language-realization-input-v6` | — |
| Language provider | `LanguageRealizationProviderV0` (C4 prompt) | `language_prompt_sha256` (same capture) |
| Language draft | `language-realization-semantic-draft-v1` | `semantic_draft_schema_sha256` |
| Runtime | `InteractiveSubjectRuntimeV0` → `ConversationTextResponseExecutorV1` | — |

Unchanged by C4: `CognitionProposalV0`, `CommunicationDirectiveV0`, `ClarificationBasisV0`,
`FactualAssessmentV0`, the factual-source authority (subject/entity/environment refs remain
non-factual), the host-bound projection hash, and every frozen V1–V4 conversation surface
(`ConversationCognitionProposalV4`, `LanguageRealizationInputV5` and their validators remain present
and tested so historical protocols stay frozen).

## Gates at this baseline

`pnpm governance` PASS · `pnpm typecheck` clean · `pnpm build` clean · `pnpm lint --max-warnings 0`
clean · `pnpm test` **2450 passed / 3 skipped / 0 failed** (196 files; three new C4 test suites) ·
`git diff --check` clean · `pnpm typecheck:auxiliary` fails with exactly 4 × TS2883 in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts:74` — **pre-existing and identical
to the pre-C4 baseline**. As in the C3 slice, one harness-only line in that experiment's
`observe.ts` extends an `Exclude` so the auxiliary program does not newly see
`LanguageRealizationInputV6` (without it the C4 union member would add 16 TS2339 errors there).

## Harness reuse

Scenarios, conditions, materiality floors, condition-attestation machinery, hashing helpers and the
frozen Family-D structure carry over from the C2/C3 harnesses, so C4 differs from C3 only by the
protocol under test plus the C4 endpoints and the two falsification triggers.
