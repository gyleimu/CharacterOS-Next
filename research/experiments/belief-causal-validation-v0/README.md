# BELIEF_CAUSAL_VALIDATION_V0 — preregistration

**Primary question.** Does a governed canonical Belief exert a *persistent causal influence*
on cognition — i.e. do different lived histories produce different durable canonical Belief
states that, under an otherwise byte-identical present situation, produce different cognition?

**Scope.** `Belief → Cognition` ONLY. The production Belief decision consumer is
`DEAD / NOT_INTEGRATED` and stays so: no arbitration, tendency, decision relation or action
runner is touched, and no new Belief decision feature was created for this experiment.

**Architecture changes: NONE.** Everything below lives under
`research/experiments/belief-causal-validation-v0/`; no production file was modified (verified by
the change-scope audit in `DECISION.md`).

## Frozen design

| item | value |
| --- | --- |
| executor | `deepseek-flash` (DeepSeek OpenAI-compatible `/chat/completions`), temperature 0, stream false, max_tokens 16384, one retry decorator (429/5xx/timeout/transport only, identical request) |
| subject | `subject-belief-causal` (same subject id in every condition, so every id-scoped field is identical) |
| target proposition | `The service passage is usable.` (single, binary, scene-relevant, no Relationship/Affect dependence) |
| formation | normal explicit-v4 genesis with **zero** canonical beliefs → three real lived episodes → the PRODUCTION session wiring (`BeliefAdaptationWiringV0` → frozen semantic runner → host proposition admission / frozen ±0.05 plasticity → `BeliefTransitionExecutor` → SubjectCore commit) |
| LOW history | support (0.55) → contradict (0.5) → contradict (0.45) |
| HIGH history | support (0.55) → support (0.6000000000000001) → support (0.6500000000000001) |
| shared episode | episode 1 is byte-identical in both histories (same formation evidence, same proposition identity) |
| current scene | ONE frozen user message, identical in all four cells, underdetermined about the proposition |
| cells | A = LOW durable; B = HIGH durable; C = HIGH durable + target REMOVED from the model-facing belief view; D = LOW durable + target PRESENTED with the HIGH credence |
| intervention | research-only model-facing belief view at the restored subject's read boundary; `production_write = false`, durable belief verified unchanged per scene |
| primary outcome | `communication_directive.kind` ∈ {`CLARIFY_MISSING_CONTEXT`, `REALIZE_CURRENT_INTENT`} |
| secondary outcomes | `proceeds_with_passage`, `proposes_alternative_route`, `seeks_verification`, `asserts_current_truth`, `objective_truth_conflation`, `cross_domain_inference`, target visibility/credence |
| contrasts | C1 A↔B (effect), C2 B↔C (mediator necessity), C3 B↔D (NO effect — history identity control), C4 A↔D (mediator sufficiency) |
| thresholds | host validity ≥ 0.95; cell stability ≥ 7/10; effect ≥ 6/10 paired differences; null ≤ 1/10 paired differences |
| schedule | balanced `A B C D` per replicate, 10 replicates per cell in primary and again in replication, each scene in a FRESH process over an authoritative restore of the frozen durable state |
| history re-formation | never per trial: the two durable histories are formed ONCE, before the freeze, and every trial restores from them |

## Isolation law

* **Raw history** never enters any model-facing request: verified for all four cells with zero
  model calls (`raw_history_isolation`, `no_experiment_label_leakage`).
* **Memory retrieval** exposure is disabled for every cell (research-side empty selection; the
  production retrieval service still runs and is counted) — `memory_retrieval_isolation`.
* **Non-belief state**: affect, regulation, relationships, personality, context, memory state,
  identity, logical time and state revision are byte-identical between the LOW and HIGH restored
  states (`non_belief_state_equality`).
* **Prompt equivalence**: system prompt identical; the non-belief user surface (belief section and
  the belief-derived `projection_hash` token normalized out) identical in all four cells; A and C
  differ from B ONLY in the belief-mediated surface; B and D are byte-identical including the
  projection hash (`b_d_full_input_equality`, re-verified on the LIVE captured requests of every
  replicate).

## Anti-confounder posture

* No seed belief, no fixture INSERT, no direct mutation, no manual credence write, no prompt
  narration: the histories are the real formation path (`FORMATION ATTESTATION` in
  `evidence/precheck/precheck.json`).
* The Belief semantics stay `subjective endorsement` (`stance(c) = 2c − 1`); nothing in the
  experiment reads credence as an objective probability, and objective-truth conflation in the
  delivered behaviour is scored as a failure mode.
* Invalid scenes are never deleted: each one is recorded with cell, phase, failure stage and
  reason, and the verdict degrades if invalidity is cell-dependent.

## Phases

```
precheck  (0 model calls, all hard gates)      -> evidence/precheck/
pilot     24 scenes, host validity >= 0.95      -> evidence/pilot/
freeze    scientific freeze manifest            -> evidence/scientific-freeze-manifest.json
primary   40 scenes                             -> evidence/primary/
replication 40 scenes                           -> evidence/replication/
report    verdict + interpretation              -> evidence/report.json, DECISION.md
```

Exploratory (protocol-validation) calls made before the frozen pilot are recorded in
`evidence/exploratory-calls.json`; they are not part of any scientific result.
