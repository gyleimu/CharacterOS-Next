# CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — Phase 2 real-provider report

## Verdict

CANONICAL_AFFECT_CAUSAL_INFLUENCE_SUPPORTED

## Baseline

Starting HEAD = origin/main = 1151313661ccbfd7484644a7575085027a8c80f4; branch main; initial worktree clean was verified before experiment-local collection code/evidence was created.

## Provider Availability

PASS — http://127.0.0.1:11434; model available = true; checked 2026-09-08T05:23:49.198Z.

## Provider

OLLAMA_NATIVE qwen3.5:9b; Ollama 0.33.3; digest 6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7; 9.7B Q4_K_M.

## Model Settings

temperature=0; seed=null (not exposed by frozen native transport); think=false; stream=false; format=null; num_predict=2048; timeout_ms=120000; retries=0; requested context window unset (model metadata context_length=262144).

## Phase-1 Revalidation

PASS — ablation_isolation=PASS, conformance_gate=PASS, input_isolation=PASS, measurement_pipeline=PASS, restore_invariance=PASS.

## Experimental Arms

A, B, ABLATED_A, ABLATED_B. The two ablated provider inputs are byte-identical within every scenario; persisted canonical state was not mutated by ablation.

## Affect Values

A=(0.25, 0.34800000000000003); B=(-0.25, 0.34800000000000003); ABLATED_A=(0, 0.2); ABLATED_B=(0, 0.2). Runtime serialization preserves the production floating-point activation; nominal treatment activation is 0.348.

## Input Confound Audit

PASS — ablation_identity=PASS, current_appraisal_equality=PASS, hidden_arm_leakage=PASS, input_isolation=PASS, provider_consistency=PASS, retry_fairness=PASS.

## Scenarios

- S1-ambiguous-social-reply
- S2-uncertain-task-decision
- S3-conflict-response
- S4-help-seeking-decision
- S5-clarify-or-act

## Execution Plan

Sequential paired execution in frozen scenario order and trial ordinal order; within each paired unit: A → B → ABLATED_A → ABLATED_B. Ollama requests are stateless, all settings are identical, no arm labels are sent, and no retries occur.

## Sample Size

scenarios=5; arms=4; trials_per_arm_per_scenario=10; attempted_calls=200; valid_calls=190; failed_calls=10; treatment_valid_pairs=40; ablation_valid_pairs=50; complete_four_arm_valid_paired_units=40/50.

## Failure Rates

- A: 0/50 (0.0%); INVALID_SCHEMA=0, OTHER_RUNTIME_FAILURE=0, PROVIDER_ERROR=0, STALE=0, TIMEOUT=0, VALID=50, VALIDATION_REJECTED=0
- B: 10/50 (20.0%); INVALID_SCHEMA=0, OTHER_RUNTIME_FAILURE=0, PROVIDER_ERROR=0, STALE=0, TIMEOUT=0, VALID=40, VALIDATION_REJECTED=10
- ABLATED_A: 0/50 (0.0%); INVALID_SCHEMA=0, OTHER_RUNTIME_FAILURE=0, PROVIDER_ERROR=0, STALE=0, TIMEOUT=0, VALID=50, VALIDATION_REJECTED=0
- ABLATED_B: 0/50 (0.0%); INVALID_SCHEMA=0, OTHER_RUNTIME_FAILURE=0, PROVIDER_ERROR=0, STALE=0, TIMEOUT=0, VALID=50, VALIDATION_REJECTED=0

## Primary Structured Endpoints

current_intent, confidence, uncertainty, action_intent, reasoning_summary_length

## A/B Result

40/40 paired disagreements (100.0%). Field counts: action_intent=0, confidence=0, current_intent=20, reasoning_summary_length=40, uncertainty=10.

## Ablation Result

0/50 paired disagreements (0.0%). Field counts: action_intent=0, confidence=0, current_intent=0, reasoning_summary_length=0, uncertainty=0.

## Treatment-vs-Ablation Contrast

count delta=40; rate delta=1; scenarios treatment>ablation=4, equal=0, treatment<ablation=0.

## Scenario-Level Results

| Scenario | A/B valid | Ablation valid | Common valid | A/B | Ablated | Common-unit rate delta |
|---|---:|---:|---:|---:|---:|---:|
| S1-ambiguous-social-reply | 0 | 10 | 0 | 0/0 (N/A) | 0/10 (0.0%) | N/A |
| S2-uncertain-task-decision | 10 | 10 | 10 | 10/10 (100.0%) | 0/10 (0.0%) | 1 |
| S3-conflict-response | 10 | 10 | 10 | 10/10 (100.0%) | 0/10 (0.0%) | 1 |
| S4-help-seeking-decision | 10 | 10 | 10 | 10/10 (100.0%) | 0/10 (0.0%) | 1 |
| S5-clarify-or-act | 10 | 10 | 10 | 10/10 (100.0%) | 0/10 (0.0%) | 1 |

## Aggregate Results

A/B valid pairs=40, disagreements=40; ablation valid pairs=50, disagreements=0. Complete four-arm denominator=40; on common units treatment=40, ablation=0, delta=40.

## Numeric Endpoints

confidence A-B {"max":0,"mean":0,"median":0,"min":0,"n":40}; ablation {"max":0,"mean":0,"median":0,"min":0,"n":50}.
uncertainty A-B {"max":0,"mean":-0.024999999999999998,"median":0,"min":-0.1,"n":40}; ablation {"max":0,"mean":0,"median":0,"min":0,"n":50}.
reasoning_summary_length A-B {"max":84,"mean":-20.75,"median":-26.5,"min":-114,"n":40}; ablation {"max":0,"mean":0,"median":0,"min":0,"n":50}.

## Textual Observations

No cherry-picked anecdotal examples are used in the verdict. Every bounded raw final response is preserved beside its validated structured proposal in trials.jsonl; free text is secondary evidence only.

## Restore Control

PASS — S1-ambiguous-social-reply arm A, pre/post-restore provider-facing treatment input identical=true.

## Confound Audit

PASS.

## Causal Interpretation

The frozen raw canonical valence contrast produced a reproducible structured cognition-output difference materially above the identical-input ablation background under this provider and scenario set.

## Claim Boundary

Supports only the tested +0.25 versus -0.25 canonical valence contrast with equal activation under qwen3.5:9b and these five scenarios. It does not establish activation effects, named emotions, psychological realism, all-task generality, or production-cutover readiness.

## Token / Cost

Corrected primary run: prompt_tokens=199280; completion_tokens=48160; total_tokens=247440; calls_with_metadata=200; external API cost=0; latency_ms={"max":11978,"mean":8163.875,"median":8035.5,"min":6107,"n":200}. Preserved void attempt: prompt_tokens=193680; completion_tokens=41940; total_tokens=235620; calls=200. Task-total local inference: 400 calls, 392960 prompt tokens, 90100 completion tokens, 483060 total tokens, 0 external API cost.

## Production Isolation

production behavior-changing diff=0. Collection/finalization changes are confined to the experiment and its evidence. Recorded check: {"status":"PASS","production_behavior_changing_diff":0,"production_paths_changed":[],"scope":"experiment-local harness/runner, its conformance test, and evidence only"}.

## Evidence Artifacts

Primary: research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/trials.jsonl; input-diff-audit.json; summary.json; REPORT.md; execution-plan.json; provider-preflight.json; collection-complete.json; quality-gates.json. Preserved excluded attempt: research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/VOID.md; void.json; trials.jsonl and companion artifacts.

## Tests

{"status":"PASS","command":"pnpm exec vitest run evals/conformance/canonical-affect-behavior-influence-v0.test.ts packages/runtime/src/transitions/cognition-action/canonical-affect-cognition-integration-v0.test.ts packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.test.ts packages/runtime/src/transitions/affect-application/affect-application-v0.test.ts packages/runtime/src/authority/restore-chain-authority.test.ts packages/subject-core/src/restore/restore.test.ts packages/runtime/src/authority/subject-state-v4-atomic-authority-v0.test.ts","test_files_passed":7,"tests_passed":94,"failed":0}

## Full Suite

{"status":"PASS","command":"pnpm test","test_files_passed":120,"test_files_skipped":1,"tests_passed":1879,"tests_skipped":3,"failed":0}

## Build

{"status":"PASS","command":"pnpm build","workspace_projects_in_scope":"14 of 15","exit_code":0}

## Typecheck

{"status":"PASS","workspace_command":"pnpm typecheck","workspace_projects_in_scope":"14 of 15","experiment_command":"pnpm exec tsc -p research/experiments/canonical-affect-behavior-influence-v0/tsconfig.json","exit_code":0}

## Lint / Diff

lint={"status":"PASS","command":"pnpm lint","warnings":0,"errors":0,"exit_code":0}; diff_check={"status":"PASS","command":"git diff --check","errors":0,"exit_code":0}.

## Changed Paths

["evals/conformance/canonical-affect-behavior-influence-v0.test.ts","research/experiments/canonical-affect-behavior-influence-v0/contract.ts","research/experiments/canonical-affect-behavior-influence-v0/harness.ts","research/experiments/canonical-affect-behavior-influence-v0/runner.ts","research/experiments/canonical-affect-behavior-influence-v0/phase2-cli.ts","research/experiments/canonical-affect-behavior-influence-v0/phase2-runner.ts","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/VOID.md","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/collection-complete.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/execution-plan.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/input-diff-audit.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/provider-preflight.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/summary.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/trials.jsonl","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-2-real-provider/void.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/REPORT.md","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/collection-complete.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/execution-plan.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/input-diff-audit.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/provider-preflight.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/quality-gates.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/summary.json","research/experiments/canonical-affect-behavior-influence-v0/evidence/run-3-real-provider/trials.jsonl"]

## Commit

Message: experiment: run canonical affect behavior influence v0 phase 2. Exact result commit is reported after Git assigns the immutable object ID.

## Push

Performed after this report is committed; exact local/origin equality is reported in the task closeout.

## Worktree

Final clean/dirty state is reported after commit and push in the task closeout.

## Scientific Adjudication

NOT_NEEDED

## Recommended Next Slice

CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_REPLICATION_V1
