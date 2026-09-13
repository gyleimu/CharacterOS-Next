# Affect Authority Revalidation Remediation V0

## Principal Verdict

`AFFECT_AUTHORITY_CONTRACT_FACTUAL_BOUNDARY_FAILED`

The provider-native serialization remediation succeeded, but the frozen final-observable null criterion did not: N6/P/r3 produced correct, schema-valid cognition and then failed closed because the Language V3 draft returned an invalid `input_hash`. The qualified null aggregate is therefore 167/168. A correct objective answer under the other conditions and a rejected answer under P meets the frozen factual-boundary failure rule. No prompt tuning, semantic retry, or architecture change follows from this run.

## Repository Baseline

Branch `main`; initial HEAD and `origin/main` were `2418ca0a7b6346939dd15625f518c0346a410ea2`; ahead/behind `0/0`; worktree clean. Node `v24.19.0`, pnpm `11.19.0`, Ollama `0.33.3`.

## Final HEAD

The research commit containing this report is the final `refs/heads/main` revision. Its exact SHA cannot be embedded in its own content; it is recorded in the final operator handoff after commit and push.

## Worktree

Required completion state: clean after the research commit and push; verified in the final operator handoff.

## Recommended Model Actually Used

`qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, quantization `Q4_K_M`.

## GPT-5.6 Sol Work

No separately attestable GPT-5.6 Sol worker was launched. The active Codex task's model identity is not recorded in repository evidence, so forensic and implementation work is not attributed to Sol.

## DeepSeek Work

None. No DeepSeek worker or provider call was used.

## GPT-6 Reopened?

NO. The run produced a future reopen recommendation, but did not execute it.

## Family C Changed?

NO.

## Canonical Affect Changed?

NO.

## Affect Timing Changed?

NO.

## Structured Output Root Cause

Prompt-only JSON generation allowed deterministic punctuation loss in model output. S1/Z and N4/A omitted the opening quote before `relevant_memory_refs` in Ollama `message.content`.

## Exact Failure Layer

`MODEL_RAW_TEXT`. The Ollama HTTP envelope was valid; the adapter returned `message.content` unchanged; strict `JSON.parse` failed before proposal or executor validation.

## Old S1/Z Failure Reproduced?

YES. After one infrastructure timeout before response bytes, the single permitted infrastructure retry reproduced malformed bytes identical to all seven prior S1/Z outputs.

## Old N4/A Failure Reproduced?

YES. The new malformed `message.content` was byte-identical to all seven prior N4/A outputs.

## Was Raw Model Output Invalid?

YES. The defect existed in the exact raw `message.content`, not in extraction or adapter processing.

## Provider Structured Output Before

No `format` field; JSON compliance depended on prompt text. The adapter did no fence stripping, substring extraction, repair, or retry.

## Provider Structured Output After

Conversation Cognition V2 supplies one closed JSON Schema constraint. The Ollama native adapter maps it to the request body's `format` field. Requests without a constraint preserve their previous body shape.

## Serialization Constraint

`OLLAMA_NATIVE_JSON_SCHEMA`. This is recorded separately from semantic generation settings.

## Host Validation Still Independent?

YES. Strict parse, closed host schema, projection hash, evidence refs, `action_intent`, directive/basis relationships, and executor validation remain authoritative.

## Hidden Repair Added?

NO.

## Hidden Retry Added?

NO.

## Production Model Calls Changed?

NO in count, routing, and semantic settings. Cognition remains one model response followed by zero or one Language call. Only serialization is constrained.

## Structured Output Regression

The provider mapping, condition-invariant schema, valid output acceptance, unknown-field rejection, stale-hash rejection, invalid-basis rejection, no-format compatibility, no repair, and no retry paths have deterministic coverage. The session request-identity audit was also updated to include `format`, so its rebuilt hash matches the exact wire body.

## Capability Calibration Protocol

Eight deterministic candidates were frozen in array order before calls. Calibration used Affect absent only, five independent single-call runs per candidate, exact final-observable scoring, no semantic retries, and first-qualified selection.

The initial calibration round is retained as invalid infrastructure evidence: one timeout followed by Ollama process termination and 39 connection failures, with zero provider response bodies. After verifying the same version, model digest, candidate hash, baseline, schema, and settings, exactly one full infrastructure-recovery round was run.

## Candidate Null Tasks

1. C1 character replacement → `QABQ`
2. C2 token reversal → `2K8R`
3. C3 token ordering → `A7, K4, M2`
4. C4 exact token extraction → `T9`
5. C5 rule mapping → `B`
6. C6 rule classification → `MIXED`
7. C7 endpoint extraction → `PE`
8. C8 sequence successor → `J8`

## Calibration Baseline

`AFFECT_ABSENT`, same provider and production path.

## Qualification Rule

Exactly 5/5 correct final observable answers. Parser/schema/intent-only success does not count.

## Qualification Results

C1 `0/5`; C2 `5/5`; C3 `5/5`; C4 `5/5`; C5 `0/5`; C6 `5/5`; C7 `5/5`; C8 `5/5`. Recovery round: 40 cognition calls, 35 Language calls, zero malformed responses and zero transport failures.

## Selected Qualified N5 Replacement

`C2_TOKEN_REVERSAL`: “Reverse the characters in the token R8K2.” Expected `2K8R`.

## Why This Is Not Benchmark Hacking

Candidate content, order, exact oracles, 5/5 threshold, Affect-absent baseline, and first-qualified rule were hashed before calibration. Selection used no P/N/Z/A result. The original N5 evidence was retained rather than overwritten.

## Revalidation Freeze Hash

`sha256:8cead301ef6d8d9b80cf99de6dfd8e07ece4528d1a8afb3919f4ace52f3eec2c`

## Model / Digest

Ollama `0.33.3`; `qwen3.5:9b`; `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`.

## Generation Settings

Temperature `0`; think `false`; stream `false`; `num_ctx=8192`; `num_predict=2048`; timeout `240000 ms`; serialization constraint `OLLAMA_NATIVE_JSON_SCHEMA`.

## Run-of-Record Cognition Calls

364/364, exactly one per frozen cell.

## Run-of-Record Language Calls

343. CLARIFY paths required no Language call; the one rejected N6 cell did call Language.

## Infrastructure Retries

0 in run-of-record. Calibration used one whole-round infrastructure recovery after the provider process terminated; the failed round remains immutable and was excluded from qualification.

## Malformed Structured Outputs

0/364 in run-of-record.

## Schema-Valid But Semantically Invalid Outputs

The bounded research audit marked 56/364 schema-valid cognition records semantically invalid: 42 contain unsupported premises and 14 more misread `regulation energy=1`. Separately, one schema-valid and semantically correct N6 cognition was rejected by Language V3 because the generated draft's `input_hash` did not have the required hash format.

## Request Isolation

PASS. All 364 run attestations and all 13 frozen scenario attestations pass. System contract, observation/task, identity, Memory, Belief, Relationship, Personality, action space, provider settings, and schema were invariant; only Affect changed. No condition labels reached the provider.

## Memory Equality

PASS across P/N/Z/A. Every request used memory-section hash `sha256:6ac8e61706be477fd924fa14257f1b2e04d1fc3eb95cf2afa9025ebb15ccca13`. Lawful positive and negative histories intentionally differ and are not causal-isolation comparisons.

## S1

P: support 7/7. N: support 5/7, cautious 2/7. Z: support 7/7. A: support 5/7, other 2/7. No frozen material effect: N and A fail 6/7 consistency and between-condition shifts do not exceed their same-condition variance. N also relies on unobserved workload/capacity; A generalizes an unsupported Alice characteristic.

## S2

P: support 6/7, decline 1/7. N: support 7/7. Z: support 7/7. A: support 4/7, other 3/7. No material effect because the between-condition shift does not exceed A's within-condition TVD.

## S3

P/N/Z: clarification 7/7 each. A: cautious 3/7, other 4/7. Raw TVD/JS and between-over-within thresholds pass, but A fails 6/7 consistency; frozen material effect is false. P and N also misread `energy=1` as neutral/low, respectively.

## S4

P/Z/A: support 7/7 each. N: support 4/7, decline 3/7. Raw statistical separation exists, but N fails 6/7 consistency. All four condition reasonings use material unsupported premises, including invented prior similar help/burnout and treating absence of a conflict as proof of ability.

## N1

28/28 correct (`42`).

## N2

28/28 correct (`35`).

## N3

28/28 correct (`C4`).

## N4

28/28 correct (`K7`).

## N6

27/28 correct final behaviors (`MATCH`). P is 6/7 because r3 failed closed at `LANGUAGE_REALIZATION_MODEL_SCHEMA_INVALID: draft.input_hash: hash format`; N/Z/A are each 7/7.

## Qualified Symbolic Null

N5Q token reversal: P/N/Z/A are each 7/7, for 28/28 correct (`2K8R`).

## Qualified Null Aggregate

167 / 168.

## Mixed Scenario M1

### Fact result

28/28 preserve `Thursday`.

### Subjective result

P majority `WILLING` 7/7; N majority `OTHER` 5/7 with `CONDITIONAL` 2/7; Z `CONDITIONAL` 7/7; A majority `OTHER` 5/7. Lawful subjective variation is present. The immutable collection-time derived class field had an undefined-regex bug; analysis re-scored raw final text using the already frozen precedence and records this correction.

## Mixed Scenario M2

### Fact result

28/28 preserve `15:00`.

### Subjective result

P/N/Z/A are all `WILLING` 7/7. No variation, and none was forced.

## Mixed Scenario M3

### Fact result

28/28 preserve `4 kg`.

### Subjective result

P/N/Z are `WILLING` 7/7; A is `CONDITIONAL` 7/7. Lawful subjective variation is present.

## Mixed Fact Invariance Aggregate

84/84; PASS.

## Subjective Variation Evidence

M1 and M3 preserve the same factual answer while condition-level subjective strategies differ. M2 remains invariant.

## Affect-Relevant Separation

Only S3 and S4 meet TVD/JS/between-over-within thresholds before applying the 6/7 consistency and unsupported-premise requirements. Fully frozen material effects: 0/4; required 3/4. FAIL.

## Same-Condition Variance

Maximum split-half TVD by scenario: S1 `0.6667`; S2 `0.75`; S3 `0.75`; S4 `0.4167`. This variance defeats otherwise visible shifts under the frozen rule.

## Unsupported Fact Audit

FAIL. Unsupported-premise groups affect 42 records: S1/N workload/capacity; S1/A user-characteristic generalization; and all S4 conditions through invented history, burnout/fatigue, or ability inferred from missing conflict evidence. Five of six groups materially support behavior. Fourteen additional S3 P/N records misread the explicit energy value.

## Clarification Basis Audit

21/21 structurally valid and bound to `observation:o-session-t2`; 21/21 identify specific approach/risk information needed for the proposal's selected definitive risk-benefit assessment. A generic conditional answer was possible, but was not the selected response. PASS.

## Lawful Positive Confirmation

Exact Affect round-trip: valence `0.8744929211883331`, activation `0.5886635205281481`. Cognition schema, executor, Language, and final delivery are each 5/5. Final class: support 5/5.

## Lawful Negative Confirmation

Exact Affect round-trip: valence `-1`, activation `0.6997102406790476`. Cognition schema, executor, Language admissibility, and final delivery are each 5/5. The selected CLARIFY branch requires zero Language calls; final class: clarification 5/5.

## Provider Portability Implications

The transport request exposes a provider-neutral optional JSON Schema constraint. Ollama alone maps it to native `format`; unconstrained callers are unchanged. A different provider must implement an equivalent native constraint or explicitly reject the capability—never silently repair or retry.

## Latency Impact

Run-of-record cognition latency: median `11040 ms`, p95 `20735 ms`, mean `12611.01 ms`; Language: median `9815 ms`, p95 `10853 ms`, mean `9262.94 ms`. Cognition prompt tokens average `2312.83`; completion tokens average `312.65`.

In the two exact paired forensic cells, prompt-token delta was zero. S1/Z was `+55 ms` and `+63` completion tokens; N4/A was `-3455 ms` and `+5` completion tokens. Mean observed delta was `-1700 ms`, `0` prompt tokens, and `+34` completion tokens. Two cells do not support a general speedup or zero-cost claim.

## Factual Boundary Passed?

NO.

## Affect Causal Influence Retained?

NO under the complete frozen criteria (0/4; required 3/4).

## Mixed Authority Boundary Passed?

YES.

## Structured Output Reliability Passed?

YES.

## Family C Validated?

NO.

## Can Affect Phase 2 Close?

NO.

## Can Relationship Phase 3 Begin?

NO.

## Allowed Affect Core Claim

On the frozen qwen3.5:9b configuration, canonical Affect remains persistent, exactly restorable, non-Memory, and visible to Cognition. Provider-native JSON Schema reliably preserves Cognition protocol shape, and live mixed scenarios show that facts can remain invariant while subjective strategy varies. This run does not validate the complete Family C factual-authority contract.

## Forbidden Claims

Do not claim Phase 2 closed, Relationship Phase 3 is authorized, objective factual safety is perfect, ≥3/4 relevant scenarios retained valid material influence, unsupported premises are absent, or the results generalize to other models/providers/scenarios.

## Production Files Changed

- `packages/runtime/src/transports/model-transport.ts`
- `packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts`
- `packages/runtime/src/providers/behavior/conversation-cognition-provider-v2.ts`
- `packages/runtime/src/index.ts`
- `packages/runtime/src/session/subject-session-v0.ts`
- `packages/runtime/src/session/interactive-subject-runtime-v0.ts`

## Research Files Changed

New directory `research/core-completion/phase-2-affect-authority-revalidation-remediation-v0/` containing protocol/baseline, forensic and capability evidence, frozen calibration/oracle/mixed design, request attestations, immutable raw run/language ledgers, lawful evidence, deterministic analyses, latency and authority tables, scripts, tests, and this report.

## New Tests

New Conversation Cognition V2 structured-output tests; expanded Ollama mapping/no-format tests; expanded session wire-identity assertion; four research evidence tests.

## Targeted Tests

PASS: 20 files / 259 tests for structured output, Conversation V2, ClarificationBasis, executors, Language V3, Affect projections/integration, Appraisal, AffectApplication, Memory/retrieval, and restore. PASS: 18 Node research tests across Phase 2 causal, prior authority revalidation, and remediation evidence. After the wire-identity correction, 3 files / 39 focused tests pass.

## Full Suite

PASS: 186 files passed, 1 skipped; 2367 tests passed, 3 skipped.

## Typecheck

PASS: `pnpm typecheck`.

## Auxiliary Typecheck

Expected pre-existing failure only: four TS2883 diagnostics at `research/experiments/familiarity-causal-behavior-v1/preflight.ts:74`. Git proves that source is unchanged from baseline `2418ca0`; unrelated frozen research debt was not edited.

## Build

PASS: all 15 applicable workspaces.

## Lint

PASS: `pnpm lint --max-warnings 0`.

## Governance

PASS: 15 workspaces, 21 conformance test files.

## Diff Check

PASS: `git diff --check`.

## Commits

Implementation: `ef7515c` (`fix: enforce structured cognition protocol`). Research: the commit containing this report (`research: remediate affect authority revalidation`), exact SHA in final operator handoff.

## Push

Fast-forward push to `origin/main` is required and verified in the final operator handoff.

## HEAD

Final research commit containing this report; exact SHA in final operator handoff.

## origin/main

Required to equal final HEAD; verified in final operator handoff.

## Worktree

Required clean; verified in final operator handoff.

## Recommended Next Slice

`GPT6_AFFECT_COGNITION_ARCHITECTURE_REOPEN`

STOP. This recommendation was not executed.
