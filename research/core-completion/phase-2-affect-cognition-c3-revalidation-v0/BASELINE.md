# AFFECT_COGNITION_C3_REVALIDATION_V0 — BASELINE

## Repository

| Field | Value |
| --- | --- |
| Branch | `main` |
| Baseline commit | `b47a326` — `fix: make subjective choice explicit in conversation cognition` |
| Parent | `f062353` — `research: adjudicate c2 architecture reopen` |
| Worktree at freeze time | clean (only this research directory is added afterwards) |

## Provider

| Field | Value |
| --- | --- |
| Kind | Ollama native (`OllamaNativeCognitionTransportV0`, native JSON-schema structured output) |
| Endpoint | `http://127.0.0.1:11434` |
| Model | `qwen3.5:9b` |
| Digest (verified, required) | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| Quantization | `Q4_K_M` |
| Size | 6 594 474 711 bytes |
| Ollama version | 0.34.0 |
| Generation | temperature 0, think false, stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240 000 ms |

A digest mismatch at any collector start is a hard `MODEL_BASELINE_CHANGED` stop. The digest was
verified identical to the C2 clean-revalidation baseline, so the C3 result is comparable to the C2
result on the same model bytes.

## Production surfaces under test (all frozen at `b47a326`)

| Surface | Version / identity |
| --- | --- |
| Cognition protocol | `conversation-cognition-proposal-v4` |
| Cognition provider | `ConversationCognitionProviderV4` (host-bound invocation binding) |
| Language input | `language-realization-input-v5` |
| Language provider | `LanguageRealizationProviderV0` (`language-realization-semantic-draft-v1`) |
| Runtime entry | `InteractiveSubjectRuntimeV0.create/restore` → `ConversationTextResponseExecutorV1` |

Unchanged by C3: `CognitionProposalV0`, `CommunicationDirectiveV0`, `ClarificationBasisV0`,
`FactualAssessmentV0`, and every frozen V1/V2/V3 conversation/language surface.

## Gates at this baseline

`pnpm governance` PASS · `pnpm typecheck` clean · `pnpm build` clean · `pnpm lint --max-warnings 0`
clean · `pnpm test` 2426 passed / 3 skipped / 0 failed (193 files) · `git diff --check` clean.

`pnpm typecheck:auxiliary` fails with exactly 4 × TS2883 in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts:74` (`fixedLanguage` inferred
type cannot be named). This debt is **pre-existing and byte-identical to the pre-C3 baseline** —
verified by rebuilding and re-running the auxiliary program on the stashed pre-C3 tree. One
harness-only line in `research/experiments/familiarity-causal-behavior-v1/observe.ts` was updated
so its `Exclude` also drops the newly added `LanguageRealizationInputV5` union member; without it
the C3 union member would have introduced 16 new TS2339 errors in that auxiliary program.

## Harness reuse

Scenarios, conditions, materiality floors, condition-attestation machinery and hashing helpers are
carried over unchanged from
`research/core-completion/phase-2-affect-cognition-c2-clean-revalidation-v0` and
`research/core-completion/phase-2-affect-causal-completion-v0/lib`, so that C3 differs from C2 only
by the protocol under test plus the N1 classifier fix.
