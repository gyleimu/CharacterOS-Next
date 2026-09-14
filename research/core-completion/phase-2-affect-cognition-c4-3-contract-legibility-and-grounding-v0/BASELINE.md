# AFFECT_COGNITION_C4_3_CONTRACT_LEGIBILITY_AND_GROUNDING_V0 — BASELINE

## Repository

| Field | Value |
| --- | --- |
| Branch | `main` |
| Baseline commit | `1db080e` — `research: revalidate affect cognition c4 grounding` |
| Production commit | `5721517` — `fix: restore cognition evidence-binding contract` |
| Worktree at freeze time | clean except this research directory |

## Provider

| Field | Value |
| --- | --- |
| Kind | Ollama native (`OllamaNativeCognitionTransportV0`, native JSON-schema structured output) |
| Endpoint | `http://127.0.0.1:11434` |
| Model | `qwen3.5:9b` |
| Digest (verified) | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| Quantization | `Q4_K_M` |
| Generation | temperature 0, think false, stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240 000 ms |

Digest verified identical to the C2/C3/C4/C4.2 baselines.

## Production surfaces under test (frozen at `5721517`)

| Surface | Identity | Bound into the freeze |
| --- | --- | --- |
| Cognition protocol | `conversation-cognition-proposal-v5` (unchanged) | `proposal_v5_schema_sha256` |
| Cognition prompt | C4.2 policy **plus** C4.3 rule 2a (citation binding) | `cognition_prompt_sha256: sha256:cbde0b7f…` |
| Language input | `language-realization-input-v6` (unchanged) | — |
| Language prompt | C4.2 revision (rule 4a, unchanged) | `language_prompt_sha256: sha256:d9260458…` |
| Language draft | `language-realization-semantic-draft-v1` | `semantic_draft_schema_sha256` |
| Grounding guard | NOT SHIPPED (`LEXICAL_GROUNDING_GUARD_TOO_BRITTLE`, frozen in C4.2, not re-evaluated) | config `GROUNDING` block |
| Contract legibility | `CONTRACT_LEGIBILITY_OK`, 13/13 obligations covered | `contract_legibility` block + `audit_sha256` |

## Gates at this baseline

`pnpm governance` PASS · `pnpm typecheck` clean · `pnpm build` clean · `pnpm lint --max-warnings 0`
clean · `pnpm test` **2458 passed / 3 skipped / 0 failed** (199 files) · `git diff --check` clean ·
`pnpm typecheck:auxiliary` fails with exactly 4 × TS2883 in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts:74` — pre-existing and identical to
the pre-C4.3 baseline.

## Version policy

No schema or protocol version bump. The repair is prompt text (**rule 2a**) only; the proposal (V5)
and language-input (V6) schemas, validators and hash domains are byte-identical. The changed prompt is
bound into this freeze by digest, so no frozen hash domain is silently mutated and no historical
artifact is rewritten.
