# APPRAISAL_EXACT_INPUT_REUSE_SHADOW_VALIDATION_V1

## Verdict

`APPRAISAL_EXACT_INPUT_REUSE_VALIDATED_FOR_PRODUCTIONIZATION`

V1 reached its frozen target: **15 additional valid pairs from 32 real Appraisal inferences**. Two malformed A attempts failed their own turns and remain in the reliability record. Combined with immutable V0, **20/20 eligible pairs** have exact request/candidate equality and equivalent authority, canonical state, Affect and downstream cognition projection. This is sufficient for a bounded engineering implementation decision, not a mathematical determinism claim. No production reuse was implemented here.

## Final Engineering Judgment — YES / NO

**YES.** I would ship the scoped implementation behind an explicit rollout flag after its implementation tests pass, for five concrete reasons:

1. All 20 eligible pairs had equal complete effective requests despite independent event identities.
2. Real second-event validation, grounding, freshness, preparation and commit remained authoritative; failure injections did not bypass them.
3. All 20 pairs produced identical canonical/Affect/projection consequences, including the harder V1 cases.
4. Invalid A candidates never became reusable, and tested scope/cleanup rules prohibit cross-turn/subject/restart/config reuse.
5. Current measured B p50 is **2.651 s**: useful interactive latency for one transient entry and bounded wiring, even though V0's 13.916 s p50 is not representative now.

## Baseline

Verified before V1 changes: branch `main`, HEAD `4962e45c9ccfa199818b9c410467509068e80220`, local `origin/main` `ea7eb4bb6f9a1a652a65ad344591a0369179c39f`, clean worktree, ahead 1/behind 0. Node `v24.19.0`, pnpm `11.19.0`. V1 uses an adjacent directory; the complete V0 tree and production source remain unchanged. [freeze.json](freeze.json) records the baseline, prior tree identity, source hashes, provider identity and preregistration.

## V0 Evidence Carried Forward

The complete V0 report and artifacts were read and preserved. V0 contributes 5 valid pairs, 11 real inferences, one malformed A, zero paired candidate/canonical/projection differences, and measured B p50 13.916 s. It established the lawful same-request/different-event path and structural failure controls. It did not adequately cover difficult semantics or preserve a durable pre-B image when B fails. V1 fills those research infrastructure/coverage gaps; it does not rerun V0 model samples or rewrite V0 results.

## V1 Research Design

Twenty new realistic inputs were frozen in fixed order, aiming for 15 valid additional pairs within 40 Appraisal calls. A failure ends only that independent subject's turn, is retained, and proceeds to the next predeclared input. There are no repair/retry/replacement calls. Material paired divergence would stop collection **after** real isolated authority evaluation. The run consumed V101–V117 and stopped upon reaching 15 valid pairs; V118–V120 were never called.

The actual interactive runtime executes one fixed valid setup Appraisal and a deterministic validator-accepted CLARIFY Cognition fixture. A and B are real independent native Appraisal calls at their normal stages. Before B dispatch, the complete authoritative S is written to `evidence/V1xx-S.json.gz`, then `PRE_B_STATE_PERSISTED` is journaled. CONTROL(B) and SHADOW(A) restore separate identical copies. Disk writes, cloning and comparison are outside the inference timer. No real Cognition/Language/adaptation generation or optional full-turn benchmark was run.

## V0 Sixth-Sample Failure Classification

`MODEL_SCHEMA_VIOLATION`

V0's original native response contains `goal_conguence` instead of `goal_congruence`. The model-facing system prompt names the correct field; native transport reports success and `done_reason=stop`; stored `message.content` equals the string delivered to the product adapter. The strict adapter correctly rejects the key set. No fixture or parser changed the field. The observable origin is the model response; the internal reason for the model's typo cannot be inferred from these artifacts. V1's deterministic test checks this exact original evidence without repairing it.

## Live Provider

Local `http://127.0.0.1:11434/api/chat`, `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, Ollama `0.33.3`, observed 9.7B/Q4_K_M model details. Effective product defaults supply endpoint/model/120000 ms timeout. Appraisal constants supply 256 output tokens and 4096 context tokens; temperature 0, thinking off, streaming off, no format/seed/keep-alive field. V1's complete observed provider/config identity equals V0's; it is rechecked before and after each sample. No download, cloud API or model switching.

## Real Provider Call Count

**V1: 32; V0+V1: 43.** V1 comprises 15 A/B pairs (30 calls) plus two failed A calls. Every attempt has START/END journal entries and raw response evidence. Main baseline reuse hits are zero: both eligible stages still inferred independently. Only isolated shadow branches reused candidates.

V1 baseline counters, independently checked in [verification.json](verification.json):

| Counter | Count |
|---|---:|
| Semantic Appraisal executor invocations | 81 |
| Already-completed event replay checks, no inference | 32 |
| Initial model-backed event evaluations | 49 |
| Fixed setup candidates | 17 |
| Real Appraisal inference | 32 |
| Eligible pairs / exact request matches | 15 / 15 |
| Isolated shadow reuse hits | 15 |
| Eligible-pair request misses / rejected shadow candidates | 0 / 0 |
| Invalid first candidates not reused | 2 |
| Shadow real inference | 0 |
| Real Cognition / Language / adaptation inference | 0 / 0 / 0 |

The 81 executor calls include setup and `ALREADY_COMPLETED` checks; they must not be displayed as 81 model calls. Adversarial deterministic tests and offline verification are excluded from empirical counters.

## V1 Samples

All required semantic categories were covered by valid pairs. Failed attempts and unused predeclared samples remain visible; they are not counted as successful pairs. Latencies are display-rounded seconds; full precision and all seven candidate fields/deltas are in each `V1xx-result.json`.

| Sample | Category | A s | B s | Candidate exact / dimension divergence | Canonical equivalent | Downstream |
|---|---|---:|---:|---|---|---|
| V101 | High emotional salience | 85.759 | 3.378 | YES / zero deltas | YES | EQUIVALENT |
| V102 | Low information | 2.468 | 2.329 | YES / zero deltas | YES | EQUIVALENT |
| V103 | Counterpart related | 3.208 | 2.665 | YES / zero deltas | YES | EQUIVALENT |
| V104 | Mixed valence | 3.158 | 2.676 | YES / zero deltas | YES | EQUIVALENT |
| V105 | Near plausible boundary: no urgent task | 3.014 | 2.587 | YES / zero deltas | YES | EQUIVALENT |
| V106 | Strong negative interpersonal | 3.020 | 2.534 | YES / zero deltas | YES | EQUIVALENT |
| V107 | Strong positive interpersonal | 3.096 | 2.651 | YES / zero deltas | YES | EQUIVALENT |
| V108 | Ambiguous / underspecified | 3.059 | 2.545 | YES / zero deltas | YES | EQUIVALENT |
| V109 | Request / question | 3.181 | 2.657 | YES / zero deltas | YES | EQUIVALENT |
| V110 | Neutral factual | 3.146 | 2.593 | YES / zero deltas | YES | EQUIVALENT |
| V111 | Salient relief plus fear | 3.127 | 2.731 | YES / zero deltas | YES | EQUIVALENT |
| V112 | Low information / uncertainty | 3.157 | 2.600 | YES / zero deltas | YES | EQUIVALENT |
| V113 | Counterpart boundary | 3.122 | 2.680 | YES / zero deltas | YES | EQUIVALENT |
| V114 | Mixed-valence practical difficulty | 3.090 | Not reached | A schema-invalid | Not reached | Not reached |
| V115 | Near plausible boundary: resolved error | 3.046 | 3.193 | YES / zero deltas | YES | EQUIVALENT |
| V116 | Predeclared ambiguous reserve | 3.203 | Not reached | A schema-invalid | Not reached | Not reached |
| V117 | Predeclared interpersonal repair | 3.086 | 2.600 | YES / zero deltas | YES | EQUIVALENT |

V114 emitted `goal_conuence`; V116 emitted `goal_conguence`. Both are preserved model schema violations, with no B call, no candidate repair and no canonical Appraisal commit for A. V117 was already in the frozen pool; it was not invented after these failures.

## Combined Sample Count

V0 5 + V1 15 = **20 complete valid/evaluated pairs**. Separate reliability denominator: V0 11 + V1 32 = **43 independent real inferences**, with 3 schema-invalid attempts, all at A. No failed A is treated as an equal pair. No original V0 input was rerun to increase N.

## Exact Request Equality

V1 15/15; combined 20/20. The retained V0 identity compares full normalized native endpoint/method/headers/body, ordered messages and actual prompt content, all supplied inference options, implementation source hash/name, installed digest, observed model template/system/parameters/details/capabilities/model_info, server version and timeout/format policy. Each actual wire-body hash also equals the unchanged native transport's terminal trace hash. Equality is not reduced to scene/task or a bare hash. Metadata checks show no observed mid-pair configuration drift; hidden hardware/scheduler state is not called deterministic.

## Event Identity Independence

Every V1 pair asserts different `factual_event_ref` and context hashes for A/B while their complete requests match. A's source is the current-primary Observation; B's source is the later reply Observation tied to the previous delivered behavior. Raw per-call trusted contexts retain event/payload/Observation/history identities and state/repository revisions. Both second-event comparison branches use the same B event in separate stores, never a shared mutable authoritative subject.

## Candidate Equality

V1 15/15; combined **20/20 (100% of eligible pairs)**. All dimensions (`relevance`, `goal_congruence`, `attribution`, `controllability`, `uncertainty`, `intensity`) and `assessment_confidence` agree exactly. Numeric absolute deltas are zero; attribution enums match; confidence deltas are zero. Validity checks cover field presence, closed key set, enum/range/finite numeric/type rules through the existing product parser and canonical validator.

## Candidate Divergence

Zero observed paired candidate divergences, in V0 and V1 separately. No material paired consequence difference was found. Each individual comparison retains its classification and complete difference lists; the valid pairs classify `NONE`. Invalid A attempts have no B and are reported as first-inference failures, not `NONE` paired results. A deterministic varied-valid-candidate control produces numerical/Affect/downstream effects, proving the comparison can detect a real change.

## Schema Reliability

V0: 1/11 invalid; V1: 2/32 invalid; combined **3/43 (6.98%)**. This is an observed attempt count, not an IID failure-rate estimate: B is reachable only after A succeeds. All invalid attempts are real misspelled fields, not repaired output. Eligible independent B attempts are 20/20 valid in the combined sample. Reuse is not a schema-reliability repair: failed A must still fail the turn and create no reusable entry.

## Trusted Metadata Rebinding

Only the seven model fields enter the slot. The original product adapter reconstructs B's subject, factual event ref, context hash and evidence refs from the trusted B context. The real executor reconstructs source Observation/payload/history grounding, freshness basis, proposal hash, transition/intent/appraisal identities, canonical record and Memory binding; real authorities issue reservations/receipts and Learning/Affect commits. No A event/hash/evidence/transition/receipt/record is reused.

## Validation Equivalence

15/15 V1 and 20/20 combined pairs pass both branches' existing parser/schema/range validator and commit. Successful lifecycle commits establish passage through the unchanged grounding/context/freshness gates, corroborated by independent failing controls. No simplified fake Appraisal evaluator or model judge was introduced.

## Authority Equivalence

**15/15 V1; 20/20 combined evaluated pairs.** Same admission/disposition, legal commit result, failure classification and transition trajectory. Exact pre-state hashes and complete trusted B contexts match between branches. Deliberately injected malformed independent B is excluded from empirical rates and discussed below; it is not silently called authority-equivalent.

## Canonical Equivalence

**15/15 V1; 20/20 combined.** Full canonical snapshot, Appraisal record/disposition, Learning provenance/bundles, repository image, revision progression, pending work and durable ledger/workflow image compare exactly. No numerical, identity, receipt, revision or hash field is removed between CONTROL and SHADOW; only object-key order is normalized. Independent offline replay reproduced every V1 comparison exactly.

The additional original-runtime-versus-restored-CONTROL check allows the pre-existing restore-local reservation counter and derived receipt/checksum differences, while demanding exact snapshots/repository equality. These exceptions never apply between the two restored treatment branches.

## Affect Equivalence

15/15 V1 and 20/20 combined Affect states are exactly equal, including unrounded canonical valence/activation. Both event-specific Affect consequences remain. The frozen Affect mapping was exercised, not modified or promoted into a psychological theory claim.

## Downstream Cognition Projection Equivalence

`DOWNSTREAM_EQUIVALENT` in all 15 V1 and all 20 combined pairs, through existing `buildCognitiveContextProjectionV2ForExplicitV4`. Full projection equality is checked, not just its hash. The deterministic sensitivity control reaches `DOWNSTREAM_COGNITION_INPUT_EFFECT` when valid numerical candidates differ. No claim is made about every possible future generated reply or arbitrary long-horizon trajectory.

## Failure / Stale / Grounding Tests

V1 explicitly tests malformed A and malformed independent B, native timeout/unavailable/truncation, bad subject/event/context/evidence binding, B grounding failure, stale head during both allowed attempts, repository preparation failure, commit conflict and automatic cleanup. B event-authority failures still fail without Appraisal commit; no rejected reuse triggers real inference.

For the **synthetic malformed B** control, S is saved first; CONTROL fails without Appraisal commit while valid SHADOW(A) can commit through B's unchanged authorities. This is explicitly `FAILURE_BOUNDARY_EFFECT`/`ADMISSION_EFFECT`, not evidence that the event validator was bypassed. Eliminating an independent inference also eliminates its opportunity to fail. The engineering decision accepts that operational consequence while requiring every B authority check to remain; it does **not** promise preservation of counterfactual B-only model/transport failures. No such paired live failure was observed. Synthetic results do not inflate empirical counts.

The existing single stale rebuild remains visible: two replay proposal deliveries, zero real model retries, then truthful session failure. Null-task pre-model abstention and lawful scene/task misses are covered by immutable V0 regressions. No failed transport result becomes abstention.

## Cross-Turn Firewall

An identical request under another turn misses. The first human turn still has one model-backed event and no reuse opportunity. Already-completed semantic checks are not inferred again. Future wiring must open the scope around the intended current-primary/reply pair, excluding unrelated pending work before that phase, and close it on every completion/failure path.

## Cross-Subject Firewall

Identical requests under another subject miss. Each research sample uses a separate in-memory subject and stores; no real product subject data is read or written. Same logical identifiers in comparison clones simplify equality, without sharing mutable authority.

## Restart Firewall

Different process/restart identities miss; success, thrown turn failure, runtime failure, shutdown and restart close the slot through `finally`. The private slot is absent from canonical/persistence images. Experimental insertion of recorded A into a new comparison scope is an explicit counterfactual, not an authorized operational cache transfer across restart. Future implementation must also reject late inference completion after scope closure.

## Configuration / Prompt Firewall

Tests cover provider instance, model/digest/config, endpoint, exact prompt content, message order, user task/scene text, response format, temperature, thinking/streaming and output/context budgets. Hash collisions with unequal normalized identities miss. Current transport settings are constructed once with no ordinary mid-turn setter; full effective identity must still be evaluated for each candidate request. Actual prompt bytes, not a manually maintained prompt version alone, bind reuse.

## V0 Latency

Redundant B: N=5, min 4.778 s, p50 **13.916 s**, mean 13.022 s, max 16.425 s, total 65.112 s. V0 did not report p90 at N=5. Prior values and raw timing methodology remain unchanged.

## V1 Latency

Redundant B: **N=15**, min **2.329 s**, p50 **2.651 s**, mean **2.695 s**, nearest-rank p90 **3.193 s**, max **3.378 s**, total **40.420 s**. Raw client monotonic time and measured synchronous observation overhead are both retained; reported V1 time subtracts the measured observer copy cost. S serialization, disk writes and shadow execution are excluded. Ollama durations independently corroborate native-call cost; residual wrapper scheduling cost is not precisely separable.

V1's initial A took 85.759 s, with server load 17.414 s, prompt evaluation 29.775 s and decode 38.527 s. It is not counted as removable B cost. Across all 17 A attempts, p50 is 3.122 s; mean 7.938 s is inflated by that first call. No machine configuration was changed to obtain these times.

## Combined Latency

Combined B: N=20, min 2.329 s, p50 **2.670 s**, mean **5.277 s**, nearest-rank p90 13.916 s, max 16.425 s, total **105.532 s**. This pooled result mixes two temporal runs and slightly different instrumentation accounting, so it is descriptive, not the preferred current deployment estimate.

**V0's 13.92 s median is not representative of current V1 B latency.** Use V1's approximately 2.65 s when judging today's practical value. Same model/config does not imply identical serving latency across sessions. No unmeasured cause for the timing change is asserted.

## Token Accounting

Actual Ollama counts:

| Redundant B tokens | V0 | V1 | Combined |
|---|---:|---:|---:|
| Prompt | 2432 | 7379 | 9811 |
| Completion | 273 | 824 | 1097 |

V1 per-B prompt min/p50/mean/max = 473/494/491.93/498; completion = 54/55/54.93/57. Per-call token/prefill/decode/load accounting remains in raw artifacts; no character-based estimate is substituted.

## Aggregate Evidence Table

| Evidence | V0 | V1 | Combined |
|---|---:|---:|---:|
| Complete valid / evaluated pairs | 5 / 5 | 15 / 15 | **20 / 20** |
| Real Appraisal inferences | 11 | 32 | 43 |
| Exact-request pairs | 5 | 15 | 20 |
| Candidate exact-equal | 5/5 | 15/15 | **20/20** |
| Divergent valid-candidate pairs | 0 | 0 | 0 |
| Schema-invalid attempts, all A | 1 | 2 | **3** |
| Authority-equivalent | 5/5 | 15/15 | 20/20 |
| Canonical-equivalent | 5/5 | 15/15 | 20/20 |
| Affect-equivalent | 5/5 | 15/15 | 20/20 |
| Downstream projection equivalent | 5/5 | 15/15 | 20/20 |
| B median seconds | 13.916 | **2.651** | 2.670 |
| B mean seconds | 13.022 | 2.695 | 5.277 |
| Total redundant B seconds measured | 65.112 | 40.420 | **105.532** |

Pair equality is conditional on the valid-A eligible path. All malformed attempts remain in the independent inference denominator. [aggregate.json](aggregate.json) contains full-precision machine-readable calculations.

## Production Complexity Cost

Approve only the bounded shape: **1 turn-local single-entry scope**, **1 complete normalized identity**, **1 seven-field candidate**, **1 exact hit/miss decision**, **6 diagnostic counters**, **1 explicit rollout flag**, approximately **10–15 focused test groups**, **0 persistent/canonical fields**, **0 new semantic domains**.

Concrete estimated changed-path boundary is 7 implementation files (plus focused tests and only necessary existing public type exports):

| Existing file | Smallest responsibility |
|---|---|
| `packages/runtime/src/providers/cognition/ollama-native-cognition-transport.ts` | Single source for the effective native request/identity; keep actual inference serialization unchanged |
| `product/sandbox/src/product-providers.ts` | Bind provider instance/config identity and Appraisal transport access |
| `product/sandbox/src/product-appraisal-provider.ts` | Narrow candidate extraction, exact lookup, and original trusted B rebinding |
| `packages/runtime/src/session/interactive-subject-runtime-v0.ts` | Non-canonical phase-aware begin/end hooks for the intended primary/reply pair; `finally` cleanup |
| `product/sandbox/src/interactive-subject-host.ts` | Own the per-turn controller and shutdown/runtime-failure cleanup for shared CLI/web composition |
| `product/sandbox/src/product-configuration.ts` | One explicit rollout switch with visible effective configuration |
| `product/sandbox/src/provider-diagnostics.ts` | Truthful semantic/inference/eligible/hit/miss/rejected counters and source invocation |

This is an implementation estimate, not a patch already written. It must not expand into Appraisal/Cognition/Language merging, a cache database, authority changes or new canonical state. Late completion after closure, initially pending unrelated events and diagnostic accuracy need focused implementation tests. A request identity helper should describe the actual serialized request, not duplicate a stale hand-maintained option list.

## Semantic Authority Changed?

`NO`

The model supplies a candidate; existing second-event authorities still decide. No first-event proposal/receipt/canonical record is reused. The synthetic B inference-failure distinction above is explicitly acknowledged.

## Transition Ordering Changed?

`NO`

Both semantic events/invocations and both commits/consequences remain. The second request is considered only when B's lawful Appraisal stage arrives. No early inference, commit, stage merger or hidden retry.

## Material Behavioral Risk

**LOW within the tested eligible request/model/config scope**, sufficient for the bounded engineering decision. Twenty real eligible pairs have no candidate, authority, canonical, Affect or downstream input divergence; difficult V1 cases and deterministic sensitivity/failure controls passed. This is not proof of determinism for all hardware, future prompts/configs or all utterances. Independent inference-only failure opportunities can disappear when that inference is removed; this operational effect is disclosed and must not be misrepresented as an event authority bypass or unconditional failure equivalence.

## Measured Performance Value

**MEASURED:** approximately 2.651 s median removable second Appraisal inference now, 40.420 s total across V1's 15 opportunities. **ESTIMATED:** against the user's historical 30–55 s turn range, approximately 4.8–8.8% contribution. That denominator was not remeasured, so this is not a controlled full-turn speedup claim. First turns, mismatches and failed A have no benefit. No optional end-to-end experiment was needed for this decision or started beyond the frozen scope.

## Why Ship / Why Reject

Ship the bounded scoped implementation because current request/authority/behavior evidence is adequate and a roughly 2.65 s saving is useful in an interactive system. The observed malformed first candidates make strict fail-closed admission and cleanup essential, not a reason to repair output. The conclusion does not depend on V0's larger latency estimate or endless additional sampling. The five concrete reasons are stated in the engineering judgment above.

## Productionize?

`YES`

## Recommended Next Slice

`APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0`

Implement only the boundary above, with rollout control and implementation tests. This next slice has not been started. No V2 research loop or alternative inference bundle is recommended.

## Research Tests

V1 **10/10 passed**; V0 unmodified regressions **10/10 passed** under the immutable-write guard. Offline verifier reproduced **15/15** CONTROL/SHADOW archives exactly and verified both failed A attempts had no B call. Real model/network calls during offline verification: **0**. Relevant product/runtime/Web regression subset: **5 files, 40 tests passed**. Research `.mjs` files are covered by Node executable tests and ESLint; they do not silently enter the TypeScript workspace program.

## Full Suite

`pnpm test`: **178 files passed, 1 skipped; 2318 tests passed, 3 skipped** (179 files / 2321 tests). Exit 0. No V1 full-suite timeout or failed test, so no timeout retry was needed. Logs and exit artifacts are retained. V0's older timed-out run is not rewritten.

## Build

`pnpm build` passed after the cold-tree check, rebuilding all 15 workspaces. Production source and lockfile are unchanged.

## Typecheck

`pnpm typecheck:workspaces` passed. The known auxiliary TS2883 issue remains explicitly out of scope as requested; this task neither modifies its source nor suppresses a compiler option. No claim is made that the whole repository's auxiliary program is now repaired.

## Cold Typecheck

Existing `scripts/cold-typecheck-regression.ps1` passed: it verified workspace output paths remain under the repository, removed their generated `dist` directories, and typechecked the source-mapped workspaces without them. A full rebuild followed. The V0 evidence directory was not removed or changed.

## Lint

Repository `pnpm lint` and V1 research lint passed with no warnings/errors.

## Governance

`pnpm governance` passed: 15 workspaces, 21 conformance test files.

## Diff Check

Staged `git diff --check` and V0/production immutability checks are performed before the research commit; final results and exact commit/worktree state are recorded in the delivery message. Frozen collector/harness/test/protocol and relevant production source hashes are checked again before committing.

## Changed Paths

Only `research/experiments/appraisal-exact-input-reuse-shadow-v1/`: frozen protocol, research harness/tests/collector, read-only V0 regression guard, raw inference journal and results, pre-B/branch snapshots, verifier/aggregates, reports and gate logs. V0 files unchanged; production/shared source modifications **0**; no visual product behavior, config flag, lockfile or canonical schema change.

## Commit

One research-only commit, `research: complete appraisal reuse validation`, after all required gates and scope checks. Its exact ID is reported in the delivery message; a report cannot embed the ID of its own containing commit.

## Push

No push. No production optimization commit exists in this task.

## Worktree

Started clean on `4962e45`; final post-commit HEAD, local origin relationship and clean-worktree proof are reported in the delivery message. No unrelated changes were reverted.
