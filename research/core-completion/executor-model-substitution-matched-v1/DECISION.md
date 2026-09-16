# EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — DECISION

Baseline SHA: `1f4776a6807ea98f49d25246c186e9a3537bbbee` (`main`, clean, HEAD == origin/main).
Experiment: `research/experiments/executor-model-substitution-matched-v1/`.

## Verdict

**Cross-executor: `EXECUTOR_CAPABILITY_DEPENDENCE_OBSERVED`.**

- `LOCAL_CONTEXT_MEDIATION_NOT_REPLICATED` — `qwen3.5:9b` (Ollama), 80/80 host-valid scenes, every
  contrast 0/10 in both phases.
- `API_CONTEXT_MEDIATION_REPLICATED` — `deepseek-flash` (DeepSeek API), all four preregistered
  criteria PASS in both phases.

Same protocol, same corpus, same scenario, same prompt bytes, same cognition contract, same
metrics, same thresholds. The only changed variable is `COGNITIVE_EXECUTOR_MODEL`.

## Isolation

`SEMANTIC_INFORMATION_EQUAL` was demonstrated, not assumed: with 0 model calls, both executors were
made to emit the request they would send, and the attestation confirmed **byte-identical system
prompt**, **equivalent user prompt** (after normalizing only the run-identity tokens) and an
**identical `structured_output` request**. 23/23 deterministic precheck checks passed, including the
familiarity values (1/32, 4/32, 4/32, 1/32), context presence/absence per cell, and `B ↔ D` source
id / order / count equality with `D`'s refs derived from `B`'s own retrieval selection.

`PROVIDER_ENFORCEMENT_IDENTICAL` is explicitly **not** claimed: Ollama grammar-enforces the schema
while the API provider offers JSON syntax mode only. That difference is recorded per executor as
`provider_schema_enforcement_mode` and is a property of the executor, not of the protocol.

## Execution integrity

Paired interleaved schedule (LOCAL then API per cell and index) with a deterministic schedule
manifest written before the first call; fresh process and full authoritative v4 restore for every
scene; collision-free trial identity `executor|phase|cell|index`; one shared retry implementation
(transport/provider failures only, byte-identical input, no local fallback); `reasoning_content`
never read. Accounting exact in every phase for both executors: planned == actual == unique,
duplicates/missing/extra = 0.

## Frozen conclusions respected (not reopened)

Writer Authority unchanged; no production file touched in this experiment; decision admission stays
**0** (`NOT_DECISION_ADMISSIBLE`, `NO_TYPED_ACTION_RELATION`); familiarity law, thresholds, values,
retrieval logic, corpus, scenario, prompts, metrics and success thresholds unchanged; no new
Relationship architecture; no Belief/Affect/Memory/persistence change.

## What this changes in the scientific record

Before this experiment the strongest available statement was that the deterministic chain
`history → governed familiarity → retrieval → context availability` holds while the mediated
behavioural half had never been observed under a compliant executor. That gap is now closed in the
positive direction **for the API executor**, and the negative is confirmed again for the local one.

The Relationship stage closure (`RELATIONSHIP_FAMILIARITY_STAGE_CLOSED`) is **not** reopened by this
result: it remains closed for architecture and decision purposes. What changes is the *scientific
interpretation*, which is now:

> Familiarity is a counterpart-specific **context-access / retrieval-control** state. A sufficiently
> capable executor uses the retrieved context to produce a reproducible cognition/behavior
> difference. The familiarity scalar itself carries no independent behavioural effect, and this
> result grants no decision authority.

## What must NOT be concluded

- That familiarity is inherently stronger, or is a preference/decision weight.
- That the local executor can never use context in principle — it did not under this protocol.
- That `UNEXPECTED_SCALAR_ASSOCIATION` occurred: `B ↔ D` showed 1/10 and 1/8 directional, i.e. the
  expected "no meaningful difference" holds; no scalar association is recorded.
- That decision admission may move. It stays 0, and any change would require a typed
  feature×action×counterpart relation contract that does not exist.

## Residual risks

1. **Host-validity margin.** The API executor sat exactly at the 0.950 gate (38/40) in both phases;
   two-to-three schema slips per 40 scenes are near the limit, so the API verdict is more
   compliance-fragile than the local one (40/40).
2. **Single scenario and single corpus**, both frozen from V2. Generality across tasks is not
   established, and the scenario was deliberately NOT tuned for either executor.
3. **Provider-capability confound.** The executors differ not only in model quality but in
   enforcement strength; a future experiment could try to separate "stronger model" from "stronger
   grammar", but within this protocol they travel together.
4. **Local executor token accounting is unavailable** in the frozen native transport, so no
   token-level comparison is possible; only request counts and host-validity rates are comparable.
5. **Terminal surface.** `GENERATIVE_ACT` versus `CITES_COUNTERPART_CONTEXT` is a host-validated
   atom class, not a semantic quality judgement; the local executor's outputs were never inspected
   for whether a human would consider them adequate.
6. The API credential is supplied via the environment only; a repository-wide scan confirms the key
   literal appears in zero files.
