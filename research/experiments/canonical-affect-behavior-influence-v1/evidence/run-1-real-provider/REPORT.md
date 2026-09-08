# CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_REPLICATION_V1 — run-1 real-provider report

## Verdict

CANONICAL_AFFECT_CAUSAL_INFLUENCE_REPLICATED

## Baseline

Starting branch main; HEAD = origin/main = c2977b78f6f46442d1fcce179a1815eabec83423; ahead/behind 0/0; initial worktree clean.

## Collection Integrity

PASS — planned calls=320; actual trials=320; unique trial identities=320; collection-complete marker valid; duplicate=0; missing=0; extra=0; scenario/magnitude/arm manifests match; execution-order schedule matches preregistration; trials sha256=72f2d945185a9aad7d2596659ee99b69c71c198d13d50d3399f664ac91cd0311. additional real-provider generation calls during finalization = 0.

## V0 Reference

Frozen V0: qwen3.5:9b at ±0.25 valence / activation 0.348, 200 attempted, 190 valid, 40 common four-arm units, treatment 40/40 versus ablation 0/40; action_intent 0/40; S1 negative arm 10/10 MODEL_ACTION_NOT_ALLOWED.

## V1 Design

8 new scenarios × 2 lawful magnitudes × 4 matched arms × 5 trials. LOW A/B=(+0.125/-0.125, activation 0.298); REFERENCE A/B=(+0.25/-0.25, activation 0.348); ablations=(0, 0.2). Balanced order rotates A/B/ABL_A/ABL_B; B/A/ABL_B/ABL_A; ABL_A/ABL_B/A/B; ABL_B/ABL_A/B/A, with trial 5 repeating rotation 1. Q1 — Scenario replication: SUPPORTED. Q2 — Magnitude robustness: SUPPORTED_AT_BOTH_MAGNITUDES. Q3 — Action propagation: NOT_DETECTED_BEYOND_COGNITION_CONTENT. Q4 — Model robustness: SECOND_MODEL_UNAVAILABLE.

## Provider / Model

OLLAMA_NATIVE qwen3.5:9b; Ollama 0.33.3; digest 6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7; quantization Q4_K_M; parameter size 9.7B; V0 digest match=true. Settings: temperature=0; seed=null; think=false; stream=false; format=null; num_predict=2048; timeout_ms=120000; retries=0.

## Second Model Status

SECOND_MODEL_UNAVAILABLE — no second suitable local completion model was present; none was downloaded. This does not count against the Qwen replication.

## Exact Sample Size

8 scenarios × 2 magnitudes × 4 arms × 5 trials × 1 model(s). attempted=320; valid=320; failed=0; provider responses=320; primary treatment valid pairs=80; ablation valid pairs=80; full four-arm valid=80/80.

## LOW Magnitude Results

Final VA: A=(+0.125, 0.298), B=(-0.125, 0.298), activation equality=PASS; ablations=(0, 0.2). A/B valid matched pairs=40; ABL_A/ABL_B valid matched pairs=40; full four-arm units=40/40; treatment=40/40 (100.0%); ablation=0/40 (0.0%); treatment-minus-ablation delta=100.0%. Action-intent treatment=0/40, ablation=0/40, delta=0.0%. MODEL_ACTION_NOT_ALLOWED A/B/ABL_A/ABL_B=0/0/0/0; negative-minus-positive=0.0%; negative-minus-ablated-background=0.0%.

## REFERENCE Magnitude Results

Final VA: A=(+0.25, 0.348), B=(-0.25, 0.348), activation equality=PASS; ablations=(0, 0.2). A/B valid matched pairs=40; ABL_A/ABL_B valid matched pairs=40; full four-arm units=40/40; treatment=40/40 (100.0%); ablation=0/40 (0.0%); treatment-minus-ablation delta=100.0%. Action-intent treatment=0/40, ablation=0/40, delta=0.0%. MODEL_ACTION_NOT_ALLOWED A/B/ABL_A/ABL_B=0/0/0/0; negative-minus-positive=0.0%; negative-minus-ablated-background=0.0%.

## Aggregate Treatment-vs-Ablation

A/B valid matched pairs=80; ABL_A/ABL_B valid matched pairs=80; full four-arm units=80/80; treatment=80/80 (100.0%); ablation=0/80 (0.0%); treatment-minus-ablation delta=100.0%.

## Scenario-Level Results

| Scenario | Magnitude | Full four-arm | Treatment | Ablation | Delta | Action intent T vs ABL | Invalid A/B/ABL_A/ABL_B |
|---|---|---:|---:|---:|---:|---:|---:|
| V1-S1-ambiguous-handoff | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S1-ambiguous-handoff | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S2-coordination-choice | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S2-coordination-choice | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S3-missing-inputs | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S3-missing-inputs | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S4-constraint-dispute | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S4-constraint-dispute | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S5-undocumented-requirement | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S5-undocumented-requirement | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S6-deployment-commitment | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S6-deployment-commitment | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S7-diagnostic-help | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S7-diagnostic-help | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S8-additional-request | LOW | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |
| V1-S8-additional-request | REFERENCE | 5/5 | 5/5 (100.0%) | 0/5 (0.0%) | 100.0% | 0/5 vs 0/5 | 0/0/0/0 |

## Cognition Effects

Structured cognition disagreement: treatment=80/80 (100.0%), ablation=0/80 (0.0%), delta=100.0%. Exact endpoint counts (treatment vs ablation, denominator 80 each): current_intent=60 vs 0; confidence=25 vs 0; uncertainty=35 vs 0; reasoning_summary_length=80 vs 0. Paired numeric distributions={"ablation":{"confidence_a_minus_b":{"max":0,"mean":0,"median":0,"min":0,"n":80},"reasoning_summary_length_a_minus_b":{"max":0,"mean":0,"median":0,"min":0,"n":80},"uncertainty_a_minus_b":{"max":0,"mean":0,"median":0,"min":0,"n":80}},"treatment":{"confidence_a_minus_b":{"max":0.09999999999999998,"mean":0,"median":0,"min":-0.050000000000000044,"n":80},"reasoning_summary_length_a_minus_b":{"max":167,"mean":-8.1875,"median":10.5,"min":-186,"n":80},"uncertainty_a_minus_b":{"max":0.05,"mean":-0.00625,"median":0,"min":-0.1,"n":80}}}.

## Action Intent Effects

Treatment=0/80 (0.0%); ablation=0/80 (0.0%); delta=0.0%. Cognition differences therefore did not propagate to action_intent in this run.

| Arm | Valid action_intent distribution |
|---|---|
| A | {"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10} |
| B | {"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10} |
| ABL_A | {"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10} |
| ABL_B | {"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10} |

## Action Validity Effects

| Arm | Attempted | Provider responses | Valid | MODEL_ACTION_NOT_ALLOWED | Other validation rejection |
|---|---:|---:|---:|---:|---:|
| A | 80 | 80 | 80 | 0/80 (0.0%) | 0/80 (0.0%) |
| B | 80 | 80 | 80 | 0/80 (0.0%) | 0/80 (0.0%) |
| ABL_A | 80 | 80 | 80 | 0/80 (0.0%) | 0/80 (0.0%) |
| ABL_B | 80 | 80 | 80 | 0/80 (0.0%) | 0/80 (0.0%) |

## V0 S1 Anomaly Replication

NOT_SUPPORTED — negative arm=0.0%; positive arm=0.0%; ablated background=0.0%; negative-minus-positive=0.0%; negative-minus-ablated-background=0.0%; supporting scenario×magnitude cells=0. This is a secondary finding, not the principal verdict.

## Restore Controls

PASS — LOW restore input equality=true; before/after hash=sha256:0d3c11cf05db8dfaf89e58e489eaeba88f1a1338ed1f846f45fb229ae3ee5fcc. REFERENCE restore input equality=true; before/after hash=sha256:7f518cfb7d1df770662105f8e934b3308709eccbac3b059334ddbfea6a934bca.

## Input / Confound Audit

PASS — non-Affect A/B equality=PASS; ABL_A/ABL_B equality=PASS; activation matching=PASS; current-event equality=PASS; current-Appraisal dimensions equality=PASS; action-space equality=PASS; provider/model/settings equality=PASS; async projection-hash regression=PASS; arm-label leakage=PASS_NO_LEAKAGE; retry symmetry=PASS_ZERO_RETRIES. 16 matched input audits and 32 canonical history proofs persisted. Content-addressed Appraisal provenance refs are arm-specific as in frozen V0 but are not provider-facing.

## Magnitude Robustness

SUPPORTED_AT_BOTH_MAGNITUDES — LOW and REFERENCE each show treatment 100.0%, ablation 0.0%, delta 100.0%. The claim is bounded to lawful final valence magnitudes 0.125 and 0.25; no monotonicity claim is made.

## Scenario Generalization

Q1=SUPPORTED; strong=8; weak=0; no-effect=0; invalid-action-dominated=0. All 8 preregistered new scenarios replicated at both magnitudes; no scenario was removed. Generalization remains bounded to these scenarios.

## Model Generalization

Q4=SECOND_MODEL_UNAVAILABLE. {"status":"SECOND_MODEL_UNAVAILABLE"}. No cross-model generalization claim is made.

## Production Isolation

PASS — production behavior-changing diff=0; production paths changed=[]; scope=V1 experiment-local harness, conformance test, derived reports, and frozen real-provider evidence only.

## Token / Runtime / Cost

prompt_tokens=326410; completion_tokens=86555; total_tokens=412965; calls_with_metadata=320; latency_ms={"max":18645,"mean":8433.51875,"median":8272.5,"min":5839,"n":320}; external API cost=0.

## Evidence Artifacts

research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/scenario-manifest.json, config.json, trials.jsonl, collection-complete.json, collection-integrity.json, input-diff-audit.json, summary.json, scenario-summary.json, magnitude-summary.json, failure-summary.json, REPORT.md, quality-gates.json, history-construction.json, restore-controls.json, phase-a.json, provider-preflight.json.

## Tests

{"status":"PASS","command":"pnpm exec vitest run evals/conformance/canonical-affect-behavior-influence-replication-v1.test.ts evals/conformance/canonical-affect-behavior-influence-v0.test.ts packages/runtime/src/transitions/affect-application/affect-application-v0.test.ts packages/runtime/src/transitions/cognition-action/canonical-affect-cognition-projection-v0.test.ts packages/runtime/src/transitions/cognition-action/canonical-affect-cognition-integration-v0.test.ts packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.test.ts packages/runtime/src/authority/restore-chain-authority.test.ts packages/subject-core/src/restore/restore.test.ts packages/runtime/src/authority/subject-state-v4-atomic-authority-v0.test.ts","test_files_passed":9,"tests_passed":104,"failed":0,"exit_code":0}

## Full Suite

{"status":"PASS","command":"pnpm test","test_files_passed":121,"test_files_skipped":1,"tests_passed":1882,"tests_skipped":3,"failed":0,"exit_code":0,"duration_seconds":166.9,"prior_attempt":{"status":"FAIL","reason":"two V1 zero-provider Phase A tests exceeded Vitest's default 5000 ms timeout under full-suite load; all other 120 files and 1880 tests passed","correction":"set an explicit 20000 ms timeout on only those two test cases; no experiment, metric, evidence, or production behavior changed"}}

## Build

{"status":"PASS","command":"pnpm build","actual_command":"pnpm --recursive --workspace-concurrency=1 --if-present run build","workspace_projects_in_scope":"14 of 15","exit_code":0}

## Typecheck

workspace={"status":"PASS","command":"pnpm typecheck","actual_command":"pnpm --recursive --workspace-concurrency=1 --if-present run typecheck","workspace_projects_in_scope":"14 of 15","exit_code":0}; experiment={"status":"PASS","command":"pnpm exec tsc -p research/experiments/canonical-affect-behavior-influence-v1/tsconfig.json","exit_code":0}.

## Lint / Diff

lint={"status":"PASS","command":"pnpm lint","actual_command":"eslint . --max-warnings 0","warnings":0,"errors":0,"exit_code":0}; diff={"status":"PASS","commands":["git diff --check","git diff --cached --check"],"errors":0,"exit_code":0}.

## Changed Paths

["evals/conformance/canonical-affect-behavior-influence-replication-v1.test.ts","research/experiments/canonical-affect-behavior-influence-v1/README.md","research/experiments/canonical-affect-behavior-influence-v1/cli.ts","research/experiments/canonical-affect-behavior-influence-v1/contract.ts","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/REPORT.md","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/collection-complete.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/collection-integrity.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/config.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/failure-summary.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/history-construction.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/input-diff-audit.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/magnitude-summary.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/phase-a-complete.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/phase-a.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/provider-preflight.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/quality-gates.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/restore-controls.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/scenario-manifest.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/scenario-summary.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/summary.json","research/experiments/canonical-affect-behavior-influence-v1/evidence/run-1-real-provider/trials.jsonl","research/experiments/canonical-affect-behavior-influence-v1/fixtures.ts","research/experiments/canonical-affect-behavior-influence-v1/harness.ts","research/experiments/canonical-affect-behavior-influence-v1/metrics.ts","research/experiments/canonical-affect-behavior-influence-v1/phase-a.ts","research/experiments/canonical-affect-behavior-influence-v1/real-runner.ts","research/experiments/canonical-affect-behavior-influence-v1/tsconfig.json"]

## Commit

Message: experiment: replicate canonical affect behavior influence v1. The immutable commit hash is reported after Git assigns it in the task closeout (a commit cannot contain its own hash).

## Push

Performed after this report is committed; exact local/origin equality is reported in the task closeout.

## Worktree

Final clean/dirty truth is reported after commit and push in the task closeout.

## Scientific Adjudication

NOT_NEEDED

## Claim Boundary

{"action_intent_influence":{"ablation_disagreements_on_common_units":0,"ablation_rate_on_common_units":0,"treatment_disagreements_on_common_units":0,"treatment_minus_ablation_rate_delta":0,"treatment_rate_on_common_units":0,"valid_action_distribution_by_arm":{"A":{"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10},"ABL_A":{"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10},"ABL_B":{"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10},"B":{"ACCEPT_ADDITIONAL_TASK@entity:alice":10,"ASK_HANDOFF_TIME@entity:alice":10,"COORDINATE_SHARED_PLAN@entity:alice":10,"REQUEST_DIAGNOSTIC_HELP@entity:alice":10,"REQUEST_MISSING_FIELDS@entity:alice":10,"RUN_REVERSIBLE_VERIFICATION@null":10,"SEEK_CONSTRAINT_ALIGNMENT@entity:alice":10,"VERIFY_REQUIREMENT_SOURCE@entity:alice":10}}},"action_validity_influence":{"ablated_background_rate":0,"negative_arm_rate":0,"negative_minus_ablated_background":0,"negative_minus_positive":0,"positive_arm_rate":0,"secondary_finding":null,"status":"NOT_SUPPORTED","supporting_scenario_magnitude_cells":0},"cognition_causal_influence":{"ablation_disagreements_on_common_units":0,"ablation_rate_on_common_units":0,"treatment_disagreements_on_common_units":80,"treatment_minus_ablation_rate_delta":1,"treatment_rate_on_common_units":1},"magnitude_robustness":"bounded to lawful final valence magnitudes 0.125 and 0.25","model_generalization":"not tested; SECOND_MODEL_UNAVAILABLE","scenario_generalization":"bounded to the eight preregistered new scenarios"}

## Recommended Next Slice

CANONICAL_AFFECT_ACTION_TENDENCY_MECHANISM_EXPERIMENT_V0
