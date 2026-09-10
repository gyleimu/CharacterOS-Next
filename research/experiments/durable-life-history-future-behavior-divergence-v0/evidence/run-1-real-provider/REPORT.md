# DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0 — evidence

## Principal verdict: NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0
## Verdict is informative: false
- COLLECTION VALIDITY FAILURE: 13 of 20 future cognition calls were rejected by the frozen provider schema. The verdict label therefore reflects a collection-validity outcome, NOT evidence of absence of a durable-history effect.

## Design
- Two subjects (life arms A/B) rebuilt through the frozen chain-slice lifecycle with real bounded generation; their behavior-linked feedback produced differing durable Experience/Memory under differing behavior.
- One frozen future scenario; four provider-facing arms (MEM_A, MEM_B, MEM_ABL_A, MEM_ABL_B) × 5 trials; FRESH authoritative restore per trial; lawful 1500-tick Time equalization before the future event.
- Ablation arms remove only the resolved BEHAVIOR_OUTCOME factual evidence at the provider-facing seam (production retrieval and persisted Memory untouched).

## Real calls
- future cognition: 20/20; future language: 7/20 (max 40 total)

## §46 metrics
- complete four-arm units: 0/5
- treatment pair (MEM_A vs MEM_B) behavior disagreement: 0pp
- ablation pair (MEM_ABL_A vs MEM_ABL_B) behavior disagreement: 0pp
- behavior delta (treatment − ablation): 0pp
- intent delta (treatment − ablation): 0pp
- arm failure rates: {"MEM_A":0.4,"MEM_B":1,"MEM_ABL_A":1,"MEM_ABL_B":0.2} (range 80pp)

## Collection validity
- valid trials: 7; invalid trials: 13
- distinct failure causes: 1 (uniform)
  - CONVERSATION_COGNITION_MODEL_SCHEMA_INVALID: conversation proposal.cognition: cognition proposal.considered_context_refs[N]: refs not lexicographically sorted
- descriptive statistics over VALID trials only (secondary, not the preregistered primary metric): {"MEM_A":{"valid_trials":3,"distinct_behaviors":1,"behaviors":["Yes, everything on my side is ready to go for the review."],"distinct_intents":["Respond to Alice's question about review readiness."]},"MEM_B":{"valid_trials":0,"distinct_behaviors":0,"behaviors":[],"distinct_intents":[]},"MEM_ABL_A":{"valid_trials":0,"distinct_behaviors":0,"behaviors":[],"distinct_intents":[]},"MEM_ABL_B":{"valid_trials":4,"distinct_behaviors":1,"behaviors":["Yes, everything on my side is ready to go for the review."],"distinct_intents":["Respond to Alice's question about review readiness."]}}
- All valid trials produced the SAME current_intent and the SAME behavior text; no memory-dependent variation appears anywhere in the valid subset, but the preregistered treatment contrast pairs could not be formed at all (MEM_B and MEM_ABL_A produced zero valid trials).
- The per-arm validity split does not follow the treatment: it inverts between subjects (for subject A the treatment prompt mostly validated while its ablation did not; for subject B the reverse), so it is prompt-level stochastic acceptance, not evidence of a memory-content effect.

## Controls
- future affect: NEGLIGIBLE_BUT_NONZERO (residual valence delta 0.000022699964881242424)
- memory-visibility gate, ablation-equivalence and ablation-pair equalization: see future-input-diff-audit.json checks

## Nondeterminism audit (temp 0)
{"MEM_A":{"distinct_provider_input_hashes":1,"distinct_intents_all_rows":2,"distinct_behaviors_all_rows":2,"distinct_intents_valid_only":1,"distinct_behaviors_valid_only":1,"valid_trials":3},"MEM_B":{"distinct_provider_input_hashes":1,"distinct_intents_all_rows":1,"distinct_behaviors_all_rows":1,"distinct_intents_valid_only":0,"distinct_behaviors_valid_only":0,"valid_trials":0},"MEM_ABL_A":{"distinct_provider_input_hashes":1,"distinct_intents_all_rows":1,"distinct_behaviors_all_rows":1,"distinct_intents_valid_only":0,"distinct_behaviors_valid_only":0,"valid_trials":0},"MEM_ABL_B":{"distinct_provider_input_hashes":1,"distinct_intents_all_rows":2,"distinct_behaviors_all_rows":2,"distinct_intents_valid_only":1,"distinct_behaviors_valid_only":1,"valid_trials":4}}

## Limitations (documented per §9)
- the conversation cognition prompt renders memory refs and canonical affect values but NOT the factual_memory_evidence outcome text (production renderer surface)
- the durable evidence is provider-facing in the structured V2 projection; the rendered prompt contrast between treatment arms is the affect residual and hash only
- The conversation cognition prompt renders memory refs only; the durable outcome text reaches the provider solely through the structured factual_memory_evidence field of the V2 projection (CognitiveContextProjectionV2), which the production conversation renderer does not render.
- Provider-input determinism holds (one distinct provider input hash per arm) while model outputs vary run-to-run at temperature 0, so the five trials per arm sample the model's output distribution, not a fixed output.
- The frozen provider schema rejects proposals whose cited refs are not lexicographically sorted; with the durable-memory citation surface present (episode + retrieval-trace refs among entity refs) this rule produced the observed rejection rate.