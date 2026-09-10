# DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0_REMEASURE — evidence

## Principal verdict: FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY
## Informative: true
## Complete behavior four-arm units: 5/5

## Denominators (§29)
- complete cognition four-arm units: 5/5
- stage-valid pairs (MEM_A/MEM_B): [1,2,3,4,5]
- stage-valid pairs (MEM_ABL_A/MEM_ABL_B): [1,2,3,4,5]

## Primary metrics (over complete behavior four-arm units)
- treatment_pair_disagreement: 100pp
- ablation_pair_disagreement: 20pp
- treatment_intent_disagreement: 100pp
- ablation_intent_disagreement: 100pp
- treatment_directive_disagreement: 0pp
- ablation_directive_disagreement: 20pp
- treatment_cognition_disagreement: 100pp
- ablation_cognition_disagreement: 100pp
- behavior delta (treatment − ablation): 80pp
- intent delta (treatment − ablation): 0pp

## Stage-valid pair report (secondary denominator)
{"MEM_A/MEM_B":{"behavior":1,"intent":1,"directive":0},"MEM_ABL_A/MEM_ABL_B":{"behavior":0.2,"intent":1,"directive":0.2}}

## Schema acceptance vs original V0
- remeasure invalid trials: 0/20 (original V0: 13/20)
- per arm: {"MEM_A":{"valid":5,"invalid":0,"error_codes":[],"validation_fields":[]},"MEM_B":{"valid":5,"invalid":0,"error_codes":[],"validation_fields":[]},"MEM_ABL_A":{"valid":5,"invalid":0,"error_codes":[],"validation_fields":[]},"MEM_ABL_B":{"valid":5,"invalid":0,"error_codes":[],"validation_fields":[]}}
- ordering-related rejections (regression): 0

## Controls
- future affect: FUTURE_AFFECT_NEGLIGIBLE_BUT_NONZERO (residual valence delta 0.000022699964881242424)
- gates: {"ablation_equivalence_A":true,"ablation_equivalence_B":true,"ablation_pair_body_equal_except_affect":true,"ablation_target_evidence_absent":true,"memory_evidence_visible":true,"memory_factual_content_provider_visible":true,"repair_regression_pass":true,"scenario_equality":true}

## Tokens / cost (§49)
{"life_reconstruction_cognition_tokens":2521,"life_reconstruction_language_tokens":2611,"future_cognition_tokens":35398,"future_language_tokens":15220,"total_tokens":55750,"external_api_cost":"0 (local Ollama; no external API calls)"}