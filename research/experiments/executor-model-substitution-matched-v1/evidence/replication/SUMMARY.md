# EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — replication

```
Phase: replication.
  LOCAL_QWEN: LOCAL_CONTEXT_MEDIATION_NOT_REPLICATED → LOCAL_CONTEXT_MEDIATION_NOT_REPLICATED | host-valid 40/40 = 1.000 (gate PASS) | schema failures 0 | source-binding failures 0 | retries 0 | tokens 0 | cost NOT_APPLICABLE_LOCAL_EXECUTOR
    contrasts: C1 0/10; C2 0/10; C3 0/10; C4 0/10
    criteria: FAIL 1_A_vs_B_effect; FAIL 2_B_vs_C_effect; PASS 3_B_vs_D_no_effect; FAIL 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; PASS 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
  API_DEEPSEEK: API_CONTEXT_MEDIATION_REPLICATED → API_CONTEXT_MEDIATION_REPLICATED | host-valid 38/40 = 0.950 (gate PASS) | schema failures 1 | source-binding failures 0 | retries 0 | tokens 341399 | cost NOT_REPORTED_BY_PROVIDER
    contrasts: C1 10/10; C2 10/10; C3 1/8; C4 8/8
    criteria: PASS 1_A_vs_B_effect; PASS 2_B_vs_C_effect; PASS 3_B_vs_D_no_effect; PASS 4_A_vs_D_effect; PASS 5_semantic_non_conflation; PASS 6_seed_contamination; PASS 7_host_valid_rate; PASS 9_accounting_exact; PASS 10_language_authority
  CROSS: EXECUTOR_CAPABILITY_DEPENDENCE_OBSERVED — CharacterOS familiarity lawfully changes context access, and the stronger API executor can use the retrieved context to produce a reproducible cognition/behavior difference, while the local executor does not under the same protocol
```
