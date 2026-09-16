# EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0

Replaces the LOCAL familiarity-experiment executor (`qwen3.5:9b` on `127.0.0.1:11434`) with an
API executor and asks whether the familiarity context-mediation result changes when CharacterOS,
history, familiarity, retrieval, corpus, scenario, prompt, metrics and thresholds are ALL
unchanged.

**Result: `MODEL_SUBSTITUTION_NOT_ISOLATED`** — see [`SUMMARY.md`](./SUMMARY.md). The exact closed
proposal schema reaches the executor only through the provider's structured-output constraint,
which Ollama grammar-enforces and the API provider cannot; both available API models therefore
fail the frozen schema, and both permitted repairs are forbidden. No scientific execution ran.

## The only substituted variable

`EXECUTOR_MODEL`. The scientific setup is **imported unmodified** from
`../relationship-familiarity-context-mediation-final-replication-v2/` — `contract.ts` (cells,
credits, corpus, scenario, gates, thresholds, frozen outcomes), `world.ts` (governed familiarity
history + authoritative restore), `scene.ts` (prompt construction, evidence rendering, endpoint
classification) and `precheck.ts` (`prepareCells`, which derives `D`'s context from `B`'s own
retrieval selection). Nothing scientific is redefined here.

## Configuration (environment only — never a file)

| variable | required | meaning |
| --- | --- | --- |
| `MODEL_API_BASE_URL` | yes | OpenAI-compatible base URL (e.g. `https://api.deepseek.com`) |
| `MODEL_API_KEY` | yes | credential; sent only in the outbound `Authorization` header |
| `MODEL_API_MODEL` | yes | model id |
| `MODEL_API_TIMEOUT_MS` | no | default 480000 |
| `MODEL_API_TEMPERATURE` | no | default 0 (the only scientific temperature) |
| `MODEL_API_TOP_P` | no | default unset |
| `MODEL_API_MAX_TOKENS` | no | default 2048 |
| `MODEL_API_SEED` | no | unset ⇒ `SEED_UNSUPPORTED_BY_PROVIDER`; no determinism claim |

### Security properties (verified)

- The key is read from `process.env` only. It is never written to a manifest, log, evidence file,
  README or commit. Only `key_fingerprint = sha256(key)[0:16]` is recorded.
- All transport error text passes through mandatory redaction (`sk-…`, `Bearer …`,
  `authorization: …`).
- **No local fallback**: `assertNotLocalFallback` rejects any `localhost`/`127.0.0.1`/`0.0.0.0`
  base URL and the Ollama port `11434` at configuration time, failing closed.
- Verified by scan: the key literal appears nowhere in the repository or artifacts.

## Run

```
export MODEL_API_BASE_URL=... MODEL_API_KEY=... MODEL_API_MODEL=...
node .../cli.ts prepare   <dir>   # 0 API calls: precheck + prompt-equivalence attestation
node .../cli.ts pilot     <dir>   # API_HOST_VALIDITY_PILOT (>= 20 scenes, >= 0.95)
node .../cli.ts run       <dir>   # primary  (4 cells × 10)
node .../cli.ts replicate <dir>   # replication, frozen code
```

`prepare` exits `3` and refuses to authorize any API call unless all precheck checks pass, the
prompt-equivalence attestation holds and the executor is configured.

## Verdict space (frozen)

`FAMILIARITY_CONTEXT_MEDIATION_REPLICATED_WITH_STRONGER_EXECUTOR` ·
`FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED_WITH_API_EXECUTOR` ·
`MODEL_SUBSTITUTION_NOT_ISOLATED` · `EXPERIMENT_INVALID`

A positive result would mean: familiarity controls counterpart context ACCESS, and a sufficiently
capable executor uses that context to change cognition/behavior. It would **not** mean the
familiarity scalar directly changes behaviour, and it would not open decision admission.
