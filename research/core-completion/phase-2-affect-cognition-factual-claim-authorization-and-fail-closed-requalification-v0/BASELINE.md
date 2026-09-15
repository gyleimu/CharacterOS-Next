# AFFECT_COGNITION_FACTUAL_CLAIM_AUTHORIZATION_AND_FAIL_CLOSED_REQUALIFICATION_V0 — BASELINE

## Repository

| Field | Value |
| --- | --- |
| Branch | `main` |
| Production commit | `627b943` — `fix: close factual claim authority to host-verifiable derivations` |
| Predecessor slice | field-local rationale authorization (research commit `b7dba73`) |
| Worktree at freeze time | clean except this research directory |

## Provider

| Field | Value |
| --- | --- |
| Kind | Ollama native (`OllamaNativeCognitionTransportV0`, native JSON-schema structured output) |
| Endpoint | `http://127.0.0.1:11434` (Ollama 0.34.0) |
| Model | `qwen3.5:9b` |
| Digest (verified) | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| Generation | temperature 0, think false, stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240 000 ms, no seed |

## Production surfaces under test (frozen at `627b943`)

| Surface | Identity |
| --- | --- |
| Cognition protocol (live) | `conversation-cognition-proposal-v7` |
| Cognition invocation binding | `cognition-invocation-binding-v3` |
| Language input (live) | `language-realization-input-v8` |
| Factual claim authorization policy | `factual-claim-authorization-policy-v0` |
| Subjective rationale authorization policy | `subjective-rationale-authorization-policy-v0` (frozen, unchanged, rationale-field only) |
| Closed derivation registry | `INTEGER_ARITHMETIC`, `STRING_REVERSE`, `RULE_CLASSIFICATION` |
| Frozen subject id | `affect-phase2-frozen-subject-v1` |

## Historical surfaces (untouched)

`conversation-cognition-proposal-v1…v6` validators/hash domains and
`language-realization-input-v1…v7` remain byte-identical for read/verify compatibility; the V7/V8
additions are pure additions (zero removed lines in `conversation-cognition-proposal.ts`). Historical
V6 verification fixtures stay on V6; only fixtures representing the current live producer/output were
mechanically upgraded.

## Gates at this baseline

`pnpm governance` PASS · `pnpm typecheck` clean · `pnpm build` clean · `pnpm typecheck:auxiliary`
clean · `pnpm lint --max-warnings 0` clean · `pnpm test` **2486 passed / 3 skipped / 0 failed**
(202 files) · `git diff --check` clean. Research zero-model suites green: sentinel 8/8,
deterministic 7/7.

## Version policy

V7/V8 are the live protocol pair; V1–V6 are historical and there is no V7→V6 fallback. The live
prompt is V6's contract text with the frozen mechanical substitutions only; `prepare.mjs` refuses to
freeze if the transformation drifts. Handles, applicability semantics, rationale authorization,
Affect and Regulation are unchanged from the predecessor slices.
