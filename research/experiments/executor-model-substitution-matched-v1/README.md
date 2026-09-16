# EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1

The matched executor-substitution experiment, run **after** `PORTABILITY_FIX_APPROVED`.

## Core question

With CharacterOS history, governed familiarity, persistence, retrieval, context availability,
scenario, corpus, prompt, cognition contract, evaluation and thresholds ALL held equal, does
changing ONLY `COGNITIVE_EXECUTOR_MODEL` change the familiarity context-mediation result?

| | executor |
| --- | --- |
| A | `qwen3.5:9b` — local Ollama native |
| B | `deepseek-flash` — DeepSeek OpenAI-compatible API |

Primary scientific question: CharacterOS already implements
`History → Governed Familiarity → Retrieval Strategy → Counterpart-specific Context Availability`.
Can a **stronger executor** actually use that context so that
`Context Availability → Cognition → Behavior` shows a stable, reproducible causal difference?

## Isolation target

`SEMANTIC_INFORMATION_EQUAL`, **not** `PROVIDER_ENFORCEMENT_IDENTICAL`. Both executors receive the
same model-visible contract from the portability fix; they differ in how strongly the provider can
ENFORCE it. `provider_schema_enforcement_mode` is recorded per executor:

- `LOCAL_QWEN` → `OLLAMA_NATIVE_FORMAT_GRAMMAR_ENFORCED`
- `API_DEEPSEEK` → `OPENAI_COMPATIBLE_JSON_SYNTAX_MODE_ONLY`

## Nothing scientific was redefined

The frozen V2 modules are imported **verbatim** by path, so cells, familiarity values, corpus,
scenario, gates, thresholds, structured outcomes and contrasts cannot drift:
`contract.ts` (cells/corpus/scenario/gates), `world.ts` (governed familiarity history +
authoritative restore), `scene.ts` (prompt construction, evidence rendering, endpoint
classification), `precheck.ts` (`prepareCells`, which derives `D`'s context from `B`'s own
retrieval selection).

## Cells (frozen)

| cell | familiarity | counterpart context |
| --- | --- | --- |
| `A_LOW_NO_CONTEXT` | 1/32 | absent |
| `B_HIGH_CONTEXT` | 4/32 | present (the one priority retrieval) |
| `C_HIGH_CONTEXT_ABLATED` | 4/32, canonical history identical to B | ablated (research-only) |
| `D_LOW_CONTEXT_EQUALIZED` | 1/32 | exactly B's context (research-only) |

## Contrasts (frozen, computed independently per executor)

`C1 A↔B` pipeline effect · `C2 B↔C` context necessity · `C3 B↔D` direct scalar effect (expect none)
· `C4 A↔D` context sufficiency.

## Execution design

- **Paired interleaved schedule** (§18): for every (cell, index) the LOCAL scene runs and then the
  API scene, back to back, so provider/time drift cannot favour one executor. The deterministic
  schedule manifest is written before the first model call.
- **Fresh process per scene**: authoritative v4 restore (boundary mint → full chain validation →
  exact terminal head) in every scene; no shared live subject, no shared model conversation, no
  hidden state, no cross-executor leakage.
- **Trial identity** = `executor|phase|cell|index` — collision-free by construction.
- **Frozen retry policy**, one implementation shared by both executors: transport/provider failures
  only, max 3 attempts, byte-identical input, no local fallback (`localhost`/Ollama-port base URLs
  are rejected at configuration time).
- **`reasoning_content` is never read**: only the final protocol output is scored, and no reasoning
  text can enter CharacterOS state, prompts, counterpart context or the other executor.

## Phases

| phase | scenes per executor | scenes total |
| --- | --- | --- |
| pilot (host validity) | 24 | 48 |
| primary | 40 | 80 |
| replication | 40 | 80 |

Pilot gate: ≥ 20 valid AND host-valid rate ≥ 0.95, per executor. Thresholds are never lowered.

## Verdict spaces (frozen)

Per executor: `LOCAL_CONTEXT_MEDIATION_REPLICATED` / `_NOT_REPLICATED` / `LOCAL_EXPERIMENT_INVALID`
(and the `API_*` mirror). Cross executor: `EXECUTOR_CAPABILITY_DEPENDENCE_OBSERVED` ·
`CONTEXT_MEDIATION_EXECUTOR_ROBUST` · `NO_EXECUTOR_MEDIATED_EFFECT_DETECTED` ·
`EXECUTOR_COMPARISON_INCONCLUSIVE` · `MODEL_SUBSTITUTION_NOT_ISOLATED` · `EXPERIMENT_INVALID`.

## History preservation

The pre-portability local result
(`FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED`, commit `76b510b`) and
`MODEL_SUBSTITUTION_NOT_ISOLATED` (commit `6bf3f78`) are preserved untouched and are **not directly
comparable** to this experiment: they ran against the pre-portability prompt. This experiment
establishes BOTH baselines afresh under the portable contract.

## Run

```
export MODEL_API_BASE_URL=... MODEL_API_KEY=... MODEL_API_MODEL=...
node .../cli.ts prepare   <dir>   # 0 model calls: 23 checks + prompt-equivalence attestation
node .../cli.ts pilot     <dir>   # per-executor host validity pilots (interleaved)
node .../cli.ts run       <dir>   # paired primary
node .../cli.ts replicate <dir>   # paired replication, frozen code
```

The API credential is read from the environment only and is never written to any file, log,
manifest, evidence artifact or commit; only a sha256 fingerprint is recorded.

See [`SUMMARY.md`](./SUMMARY.md).
