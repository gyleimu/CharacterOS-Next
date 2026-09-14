# REPORT — AFFECT_COGNITION_C2_HOST_BOUND_LANGUAGE_AND_SEMANTIC_REVALIDATION_V0

DeepSeek V4.1 Flash continuation after the GPT-5.6 Sol quota was exhausted. The slice was
RESUMED from the existing repository/evidence state; no work was restarted, no frozen run was
repeated, and no new experiment was created.

## Principal Verdict

`AFFECT_COGNITION_C2_REVALIDATION_INCONCLUSIVE`

Rationale (allowed-verdict space §18): the C2 production implementation is sound enough on
every gate that can run, but the frozen qualification run is invalid because of a pre-transport
RESEARCH HARNESS defect (no model was ever called), so no qualification semantic evidence
exists; the formal 476-call matrix therefore remains not run; and the independent lawful
confirmation completed with real provider calls but failed closed uniformly at one deterministic
factual-assessment evidence boundary. No confirmed C2 production defect was found, so
`..._IMPLEMENTATION_FAILED` is not supported.

## Repository Baseline

Branch `main`. At takeover: HEAD `40c9df1` (`fix: bind cognition facts and intent through
language`), `origin/main` `45f0e0a` (`research: remediate affect authority revalidation`) — main
ahead of origin by 1 commit. Worktree clean except the untracked C2 research directory.

## Takeover HEAD

`40c9df10baa35a04229b3ed09abfd2926b9fba74`

## Existing GPT-5.6 Sol Production Commit

`40c9df1` — `fix: bind cognition facts and intent through language` (42 files, +1524/−225:
Proposal V3, factual assessment, Language Input V4, semantic draft, V1/V2/V3 compatibility,
executor/scene integration, fixture migrations). Not amended, not duplicated.

## Worktree At Takeover

Clean except `research/core-completion/phase-2-affect-cognition-c2-.../` (untracked research).

## DeepSeek Continuation Work

Verified the Sol implementation against repository truth; verified the frozen qualification
evidence; wrote and ran a deterministic lawful-failure forensic re-validation; wrote and ran a
deterministic condition-leakage audit; fixed lint defects in the C2 research harness; applied a
minimal TYPE-ONLY narrowing in the frozen `familiarity-causal-behavior-v1` consumer so the
auxiliary typecheck returns to its pre-existing state; ran the full gate set; committed and
pushed the finished slice.

## Architecture Changed? `NO` · GPT-6 Reopened? `NO` · Canonical Affect Changed? `NO` · Affect Timing Changed? `NO` · Persistence Changed? `NO`

## Proposal V3 Status

Implemented and verified: `ConversationCognitionProposalV3` = `{schema_version, factual_assessment, cognition, communication_directive, clarification_basis}`, closed schema, distinct V3 hash domain binding every field including null, `clarification_basis` cross-bound to `considered_context_refs` and to the current observation, and a structural "selected intent" gate (`UNRESOLVED_INTENT_PREFIXES_V0`). Tests: `conversation-cognition-proposal-v3.test.ts` + provider V3 pass (21/21 in the C2 protocol set).

## Factual Assessment Status

Implemented: ≤8 claims, each `{kind: SOURCE_QUOTE|DERIVED_RESULT, text ≤512 code points, source_refs non-empty/unique/sorted}`; source refs must be lawful, bound in cognition considered/evidence refs, and have inspectable source content; SOURCE_QUOTE must be an exact case-sensitive substring of every cited inspectable source.

## Language V4 Status

Implemented: `LanguageRealizationInputV4` + `buildLanguageRealizationInputV4` + `language-realization-input-v4.test.ts`; the executor dispatches to V4 on the v4 production path.

## Host-Owned Hash Status

`HOST_BOUND_HASH_OUTSIDE_MODEL_OUTPUT` verified: `LanguageRealizationSemanticDraftV1` is exactly `{schema_version, text, evidence_refs}` (no integrity hash), and the provider attaches `input_hash` from the host request only after every validation gate passes.

## ClarificationBasis Cross-Binding Status

Verified: CLARIFY requires a non-null basis whose `current_observation_ref` equals the current projection observation and appears in `considered_context_refs`; REALIZE requires exactly null.

## V1/V2/V3 Compatibility

V1 and V2 remain frozen and independently valid; the V3 validator is a new closed version. Language input V1/V2/V3 remain valid alongside V4.

## Production Structured Output Status

Preserved: no JSON repair, no hidden retries, one Cognition call + 0/1 Language.

## Frozen Qualification Hash

`sha256:2c6ac50e62f73ac0d1b9483f0e32b66df80620ff2d2b13dc1f70001e2c4c75fc`

## Frozen Formal Matrix Hash

`sha256:d2e4b5b930d46b46e821b477d068712597ae2d7fcef11392e1a854f4b9080ffa`

## Qualification Run Result (verified from preserved evidence)

```text
planned:        65
records:        65
real provider calls: 0   (0 raw provider responses, 0 transport traces)
Language calls: 0
failure:        pre-transport research harness ReferenceError
```

Every one of the 65 preserved records is `FAILED` / `TURN_FAILED_CLOSED` with
`SERVICE_UNAVAILABLE/FAIL-SERVICE-001`, zero provider responses and zero language calls.

## Qualification Harness Root Cause (exact)

- File: `research/core-completion/phase-2-affect-cognition-c2-.../lib/pipeline.mjs`, inside the
  cognition wrapper's per-call attestation construction.
- Bad reference: an unbound identifier `removed_indices` (snake_case) used where the variant
  object's field `removedIndices` (camelCase) was required — `variant.removedIndices`.
- Effect: the `ReferenceError` was thrown synchronously while building the request attestation,
  i.e. BEFORE `cognitionTransport.complete(...)` was ever invoked, so the underlying provider
  call count was 0 and every runtime turn saw a failed cognition provider.
- Production impact: none — the defect is confined to the research wrapper; no production file
  references that identifier, and production workspaces typecheck, build and test green.

## Harness Fix

Corrected to `variant.removedIndices ?? []` (research-only). The fix is present for future runs
and does NOT retroactively validate or replace the frozen 65-call qualification run.

## Was Qualification Re-run? `NO` · Formal 476 Matrix Run? `NO`

Because the frozen protocol specifies zero semantic retry / no replacement run, and
qualification was invalidated before transport. The invalid run and the not-run matrix are
preserved as the scientific result.

## Lawful Run Status

COMPLETED before takeover (10/10 records present in `lawful-confirmation.json`); no lawful
process was running at takeover, so nothing was relaunched or replaced.

## Lawful POS / NEG (from preserved evidence)

| field | LAWFUL_POS | LAWFUL_NEG |
|---|---|---|
| planned | 5 | 5 |
| completed | 5 | 5 |
| real provider calls | 5 (HTTP 200, `done_reason=stop`) | 5 |
| schema-valid (V3 JSON) | 5 | 5 |
| proposal-valid | 5 | 5 |
| executor-valid | 0 | 0 |
| Language-valid | 0 | 0 (never reached) |
| delivered | 0 | 0 |
| Affect round-trip (persist → fresh restore) | `+0.8744929211883331 / 0.5886635205281481`, exact equality | `−1 / 0.6997102406790476`, exact equality |

### Exact failure stage(s)

All 10: `EVIDENCE_VALIDATION` on the factual assessment —
`conversation proposal.factual_assessment.claims[N].source_refs:
subject:affect-cognition-c2-subject-v0 has no inspectable source content`
(N = 2 for POS, 6 for NEG). The claim is a `DERIVED_RESULT` describing the subject's own state,
sourced solely from the `subject:` ref.

## Lawful Root-Cause Analysis

Deterministic offline re-validation (`forensics-lawful.mjs` → `evidence/lawful-forensics.json`)
reconstructs the projection from the preserved request bytes and re-runs the production V3
validator; it reproduces the identical rejection for all 10 records with zero model calls. The
`subject:` ref IS advertised as citeable in the rendered CITEABLE CONTEXT REFS (it arrives via
focus/active-entity refs) and IS accepted by the factual-assessment lawful set, but it carries no
inspectable source text, so a factual claim sourced only from subject state is rejected. This is
a model-vs-contract boundary: subject state is deliberately not a factual authority in C2, while
the prompt's citeability surface still lists the subject ref.

## Production Bug Found?

`NO` — no confirmed C2 production defect that contradicts the frozen architecture was
established. The validator's rejection is precise and deliberate; the mismatch is between the
model's factual sourcing and the C2 factual-authority boundary, and resolving it either way
(accepting subject state as a factual source, or steering the model off it) would be a C2
semantic/prompt decision, which this slice must not improvise.

## Production Fixes After Takeover

None. (The only post-takeover code changes are research-harness lint fixes and a type-only
narrowing in the frozen `familiarity-causal-behavior-v1` consumer, described below.)

## Semantic Architecture Conflict Found? `NO`

## Condition Leakage Audit

`condition-leakage-audit.mjs` → `evidence/condition-leakage-audit.json`: 10 preserved
model-visible requests scanned (the 65 qualification records carry no request because the wrapper
threw before capture), 0 findings; opaque session ids across all three freezes (qualification,
formal, lawful) contain no scenario id or condition-like letter. PASS.

## Historical Replay Status

`historical-replay.json`: 6 historical failure cases (N6 bad language hash, N6 contradictory
answer, N4 question repetition, M1 incomplete subjective answer, M2 Language-selected
preference, S1 unsupported capacity/reason) re-classified deterministically; `diagnostic_only:
true`, `historical_outputs_rewritten: false`. Old evidence untouched.

## Research Tests

`node --test deterministic.test.mjs`: 4/4 pass. `condition-leakage-audit.mjs`: PASS.
`forensics-lawful.mjs`: reproduces the uniform lawful rejection.

## Proposal V3 Tests / Language V4 Tests

`conversation-cognition-proposal-v3.test.ts`, `conversation-cognition-provider-v3.test.ts`,
`language-realization-input-v4.test.ts`: 21/21 pass.

## Targeted Runtime Tests

`packages/runtime/src/transitions/conversation` + `providers` + `session`: 281 passed, 1 skipped.

## Full Suite

`pnpm test`: 189 files passed, 1 skipped; **2388 tests passed, 3 skipped, 0 failed**.

## Typecheck

`pnpm typecheck` (`tsc -p tsconfig.workspaces.json`): PASS.

## Auxiliary Typecheck

`pnpm typecheck:auxiliary`: exit 2 with **only the pre-existing TS2883** in
`research/experiments/familiarity-causal-behavior-v1/preflight.ts:74` (4 messages, same
pre-existing `fixedLanguage` inference debt). The C2 change had introduced NEW TS2339 breakage in
that frozen consumer (Language input V4 added to the union lacks `scene` /
`memory_episode_contents` / `cognition_proposal_binding`); this was resolved by a two-line,
TYPE-ONLY narrowing at the source declaration in `observe.ts` (`Exclude<..., {schema_version:
"language-realization-input-v4"}>` plus one cast), restoring the gate to its pre-existing state.
No behavior changed.

## Build / Lint / Governance / Diff Check

Build: PASS. Lint (`--max-warnings 0`): PASS. Governance: PASS (15 workspaces, 21 conformance
test files). `git diff --check`: clean.

## Production Files Changed During DeepSeek Takeover

None. (Only the frozen research consumer `research/experiments/familiarity-causal-behavior-v1/observe.ts`
was type-narrowed; it is not production code.)

## Research Files Changed During DeepSeek Takeover

C2 slice: added `forensics-lawful.mjs`, `condition-leakage-audit.mjs`, `REPORT.md`,
`evidence/lawful-forensics.json`, `evidence/condition-leakage-audit.json`; lint fixes in
`lawful.mjs`, `lib/pipeline.mjs`, `prepare.mjs`.

## Commits Already Present

`40c9df1` fix: bind cognition facts and intent through language (Sol, unpushed at takeover);
`45f0e0a` research: remediate affect authority revalidation; `ef7515c` fix: enforce structured
cognition protocol.

## New Commits / Push

See the chat report. New commits: one narrow fix commit for the type-only narrowing (if kept
separate) and one research commit recording the C2 interruption and continuation.

## HEAD / origin/main / Ahead-Behind / Worktree

See the chat report; target: `HEAD == origin/main`, ahead/behind 0/0, clean worktree.

## Can Affect Phase 2 Close? `NO`

Formal validation did not run; qualification is invalid; the lawful confirmation failed closed
uniformly. C2 cannot be validated from this slice.

## Can Relationship Phase 3 Begin? `NO`

## Recommended Next Slice

Exactly one: `AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0` — a NEW freeze and a NEW qualification
run with the harness defect corrected, addressing in its design the one forensic finding (a
`subject:` ref is advertised as citeable but carries no inspectable factual source content).
This is not executed here.
