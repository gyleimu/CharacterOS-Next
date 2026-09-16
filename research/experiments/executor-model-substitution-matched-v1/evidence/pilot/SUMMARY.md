# EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — pilot

```
Phase: pilot.
  LOCAL_QWEN: LOCAL_HOST_VALIDITY_PILOT_PASS | host-valid 24/24 = 1.000 (gate PASS) | schema failures 0 | source-binding failures 0 | retries 0 | tokens 0 | cost NOT_APPLICABLE_LOCAL_EXECUTOR
    contrasts: C1 0/6; C2 0/6; C3 0/6; C4 0/6
    criteria: FAIL 1_A_vs_B_effect; FAIL 2_B_vs_C_effect; PASS 3_B_vs_D_no_effect; FAIL 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; PASS 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
  API_DEEPSEEK: API_HOST_VALIDITY_PILOT_PASS | host-valid 24/24 = 1.000 (gate PASS) | schema failures 0 | source-binding failures 0 | retries 0 | tokens 212133 | cost NOT_REPORTED_BY_PROVIDER
    contrasts: C1 6/6; C2 6/6; C3 0/6; C4 6/6
    criteria: PASS 1_A_vs_B_effect; PASS 2_B_vs_C_effect; PASS 3_B_vs_D_no_effect; PASS 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; PASS 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
```
