# REPLY_CRITICAL_LATENCY_FORENSIC_V0

Baseline: `ad058e2792b87ac98ef42679ea0ff17a4ae2866d` (main). Local Ollama 0.33.3,
`qwen3.5:9b` (digest `6488c96f…`, 9.7B Q4_K_M), RTX 4060 Laptop, 8 GiB VRAM.
`CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE=1` for all reply-critical measurements
(the previous-reply duplicate Appraisal is a solved, independent optimization).

No production code was modified to obtain this evidence; every number comes from
Ollama's own per-call timing metadata captured by `harness.mjs` / `ctx-probe.mjs`
plus the product's own turn timing.

## Method

`harness.mjs` drives the REAL product runtime (`createProductRuntimeV0`) against
the local provider, patching `globalThis.fetch` to capture, per model call: the
wire options, prompt/output token counts, and Ollama's
`total/load/prompt_eval/eval` durations. It records only sizes, counts, hashes
and timings — never prompt or Memory text. `ctx-probe.mjs` and
`runner-switch-probe.mjs` isolate the provider option effect with fixed prompts.

## Cold vs warm

- **COLD** (model evicted): one Appraisal call took 35.25 s, of which
  **30.93 s was `load_duration`** (weight load), 2.01 s prefill (498 tokens),
  2.25 s decode (55 tokens).
- **WARM**: `ollama ps` reports one resident runner (`5.6 GB, 100% GPU`,
  CONTEXT 8192). No CPU offload was ever observed. Warm calls pay
  `load_duration` only when the option set changes (below).

## Stage breakdown (warm, product turn, pre-fix)

| Stage | ctx | prompt tok | output tok | total | load | prefill | decode | prefill tok/s | decode tok/s |
|---|---|---|---|---|---|---|---|---|---|
| Appraisal | 4096 | 498 | 55 | 9.74 s | **8.04 s** | 0.35 s | 1.34 s | 1424 | 41.0 |
| Cognition | 8192 | 1188 | 227 | 26.05 s | **12.28 s** | 4.53 s | 9.21 s | 262 | 24.6 |
| Language | 8192 | 1165 | 145 | 7.27 s | 0.00 s | 0.85 s | 6.31 s | 1367 | 23.0 |
| Relationship | 8192 | 406 | 23 | 6.32 s | 0.00 s | 2.74 s | 3.32 s | 148 | 6.9 |

Reply-critical path (Appraisal + Cognition + Language) = **43.06 s provider
time**, of which **20.32 s (47%) was pure model reload**, not computation.
Full turn: wall 49.53 s, provider 49.43 s, adaptation 6.34 s;
**CharacterOS host + canonical work = 101.8 ms (0.2%)**.

Prompt sizes are small: cognition 1188–1499 tokens against a 8192 allocation, and
the context audit showed the cognition prompt is dominated by fixed instruction
text plus refs, not Memory prose (memory appears only as allowed refs).

## The bottleneck: mixed `num_ctx` rebuilds the Ollama runner

The product sent the same model with two option sets: Appraisal
`{temperature:0, num_predict:256, num_ctx:4096}`, Cognition/Language/Relationship
`{temperature:0, num_predict:2048, num_ctx:8192}`. Ollama keys its resident runner
by model + generation options, so every Appraisal↔Cognition switch rebuilt the
runner.

Controlled probe (`ctx-probe.mjs`; identical prompt, 110 prompt / 55 output
tokens in every call):

```text
CTX_8192_a   total=2.1 s   LOAD=0.00 s
CTX_8192_b   total=1.7 s   LOAD=0.00 s
CTX_4096_a   total=12.8 s  LOAD=10.96 s   ← switch
CTX_4096_b   total=1.7 s   LOAD=0.00 s
CTX_8192_c   total=10.7 s  LOAD=8.91 s    ← switch
```

`ollama ps` flips `CONTEXT 8192 ↔ 4096` with the switch. So each avoided
alternation saves **~9–11 s**, and the pre-fix product paid it twice per turn
(Appraisal before Cognition, and Appraisal again on the next turn's prior-reply
path) — matching the 8.04 s + 12.28 s observed in one product turn.

## Fix and its measured effect

All four product transports now share the ONE configured context budget
(`CHARACTEROS_CONTEXT_WINDOW_TOKENS`, default 8192); the Appraisal output budget
stays 256 and no prompt, schema, sampling option or canonical semantics change.
Post-fix the Appraisal call carries `num_ctx 8192` and `load_duration` collapsed
from **8.04 s to 0.028 s** (one captured call in a later, contended window); the
wire-level test `product-transport-options.test.ts` pins that every transport
sends the same `num_ctx` and that Appraisal keeps `num_predict 256`.

Projected reply-critical latency on a free GPU: **43.06 s → 22.74 s**, the
residual being decode (≈16.9 s) and prefill (≈5.7 s) of the same tokens.

## Environment caveat (measurement honesty)

Later windows collapsed to **~1.1 tok/s decode with 120–239 s client timeouts**
while unrelated GPU applications saturated the device (99% utilization, 88 °C,
40 W, 7492/8188 MiB, sustained for minutes even after `ollama ps` was unloaded).
The same workload had run at 23–41 tok/s minutes earlier. This blocks a clean
end-to-end before/after A/B in this session and, together with the earlier
V0 (13.92 s) / V1 (2.65 s) / production (10.1 s) Appraisal spread, is fully
explained by device throughput variation (`BACKGROUND_LOAD`, `GPU_THROTTLING`,
possible `MODEL_EVICTION`) — not by prompt, model or harness differences
(identical model digest, prompt tokens and option sets were verified). The exact
external workload is **not attributable** from these artifacts.

## Verdict

Dominant reply-critical bottleneck #1 = model **load/eviction caused by mixed
`num_ctx`** (≈47% of the pre-fix reply-critical path), now fixed and
semantically neutral. Bottleneck #2 = **decode** (23–25 tok/s for
cognition/language), which is local model serving and not addressable without a
model/semantic change. CharacterOS host overhead is immaterial (~100 ms/turn).
