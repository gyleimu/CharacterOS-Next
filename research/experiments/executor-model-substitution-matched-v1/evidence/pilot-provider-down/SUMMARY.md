# EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — pilot

```
Phase: pilot.
  LOCAL_QWEN: EXECUTOR_HOST_VALIDITY_FAILURE | host-valid 0/24 = 0.000 (gate FAIL) | schema failures 0 | source-binding failures 0 | retries 72 | tokens 0 | cost NOT_APPLICABLE_LOCAL_EXECUTOR
    contrasts: C1 0/0; C2 0/0; C3 0/0; C4 0/0
    criteria: FAIL 1_A_vs_B_effect; FAIL 2_B_vs_C_effect; FAIL 3_B_vs_D_no_effect; FAIL 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; FAIL 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
  API_DEEPSEEK: API_HOST_VALIDITY_PILOT_PASS | host-valid 23/24 = 0.958 (gate PASS) | schema failures 1 | source-binding failures 0 | retries 0 | tokens 210292 | cost NOT_REPORTED_BY_PROVIDER
    contrasts: C1 5/5; C2 6/6; C3 1/6; C4 5/5
    criteria: FAIL 1_A_vs_B_effect; PASS 2_B_vs_C_effect; PASS 3_B_vs_D_no_effect; FAIL 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; PASS 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
```
