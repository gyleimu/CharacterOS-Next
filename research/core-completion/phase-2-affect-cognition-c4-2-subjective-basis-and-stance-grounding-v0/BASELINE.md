# AFFECT_COGNITION_C4_2_SUBJECTIVE_BASIS_AND_STANCE_GROUNDING_V0 — BASELINE

## Repository

| Field | Value |
| --- | --- |
| Branch | `main` |
| Baseline commit | `55a48ba` — `research: adjudicate c4 subjective basis and stance grounding` |
| Production commit | `3cfbfac` — `fix: tighten subjective basis and stance grounding` |
| Worktree at freeze time | clean except this research directory |
| Qualification freeze HEAD | `3cfbfacd83d62d2678437f969b226b06288e4313` |

## Provider

| Field | Value |
| --- | --- |
| Kind | Ollama native (`OllamaNativeCognitionTransportV0`, native JSON-schema structured output) |
| Endpoint | `http://127.0.0.1:11434` |
| Model | `qwen3.5:9b` |
| Digest (verified, required) | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| Quantization | `Q4_K_M` |
| Generation | temperature 0, think false, stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240 000 ms |

Digest verified identical to the C2/C3/C4 baselines, so C4.2 is comparable on the same model bytes.

## Production surfaces under test (frozen at `3cfbfac`)

| Surface | Identity | Bound into the freeze |
| --- | --- | --- |
| Cognition protocol | `conversation-cognition-proposal-v5` (unchanged by C4.2) | `proposal_v5_schema_sha256` |
| Cognition prompt | C4.2 revision (rules 6a, 7a–7c) | `cognition_prompt_sha256: sha256:e8191ea4…` |
| Language input | `language-realization-input-v6` (unchanged) | — |
| Language prompt | C4.2 revision (rule 4a) | `language_prompt_sha256: sha256:d9260458…` |
| Language draft | `language-realization-semantic-draft-v1` | `semantic_draft_schema_sha256` |
| Grounding guard | `RESEARCH_ONLY_LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`, `guard_shipped: false` | `grounding_guard_sha256` |

## Gates at this baseline

`pnpm governance` PASS · `pnpm typecheck` clean · `pnpm build` clean · `pnpm lint --max-warnings 0`
clean · `pnpm test` **2454 passed / 3 skipped / 0 failed** (198 files) · `git diff --check` clean ·
`pnpm typecheck:auxiliary` fails with exactly 4 × TS2883 in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts:74` — pre-existing and identical to
the pre-C4.2 baseline.

## Version policy

No schema or protocol version bump: C4.2 changes prompt and validation semantics only. The proposal
(V5) and language-input (V6) schemas, validators and hash domains are byte-identical; the revised
prompt content is bound into this freeze by digest, so no frozen hash domain is silently mutated.

## Harness reuse

Scenarios, conditions, materiality floors, condition-attestation machinery, hashing helpers and the
dual Family-D triggers carry over from the C2/C3/C4 harnesses. C4.2 differs by the classifier's
rationale-category scheme, the off-question stance endpoint, the language semantic-completion
endpoint, and the frozen paraphrase-suite evaluation of the candidate grounding guard.
