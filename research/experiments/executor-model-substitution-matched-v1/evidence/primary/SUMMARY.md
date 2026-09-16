# EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — primary

```
Phase: primary.
  LOCAL_QWEN: LOCAL_PRIMARY_CRITERIA_NOT_MET | host-valid 40/40 = 1.000 (gate PASS) | schema failures 0 | source-binding failures 0 | retries 0 | tokens 0 | cost NOT_APPLICABLE_LOCAL_EXECUTOR
    contrasts: C1 0/10; C2 0/10; C3 0/10; C4 0/10
    criteria: FAIL 1_A_vs_B_effect; FAIL 2_B_vs_C_effect; PASS 3_B_vs_D_no_effect; FAIL 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; PASS 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
  API_DEEPSEEK: API_PRIMARY_AWAITING_REPLICATION | host-valid 38/40 = 0.950 (gate PASS) | schema failures 2 | source-binding failures 0 | retries 0 | tokens 347572 | cost NOT_REPORTED_BY_PROVIDER
    contrasts: C1 8/8; C2 10/10; C3 1/10; C4 8/8
    criteria: PASS 1_A_vs_B_effect; PASS 2_B_vs_C_effect; PASS 3_B_vs_D_no_effect; PASS 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; PASS 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
```
