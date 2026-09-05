# OLLAMA_COGNITION_REPRESENTATIVE_LOAD_DIAGNOSTIC_V1

Run id: `representative-v1-2026-09-05T09-39-45-454Z`

Starting HEAD: `982397aee7442af9d990c0e5b4bd454f277398db`

Result: **REPRESENTATIVE_DIAGNOSTIC_NORMAL**

Root-cause update: **ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED / MEDIUM**

Next slice: **READY_FOR_ENVIRONMENT_RESOURCE_DIAGNOSTIC**

This is a non-scientific product transport diagnostic. It has no canonical,
behavioral, or experimental authority.

## Representative fixture

The fixture was constructed as a lawful neutral `CognitiveContextProjectionV0`
containing an ordinary informational-document request, normal regulation,
affect and traits state, two current context refs, no historical Memory claims,
no counterpart state and an empty external action space. Its exact path was:

```text
CognitiveContextProjectionV0
→ LlmCognitionProviderV0 production prompt construction
→ OllamaNativeCognitionTransportV0
```

The pre-run request was captured through the real provider using an offline
capture transport. No inference call was made during inspection. No padding,
repeated filler, old experiment request, behavior realization or evaluator was
used.

## Request shape

- POST body: **4522 bytes**
- Messages: **2**
- System content: **1746 bytes**
- User/projection-rendered content: **2515 bytes**
- Projection JSON: **1235 bytes**
- Pre-run estimate: **1065 tokens** (`UTF-8 content bytes / 4` heuristic)
- Server-observed full prompt: **1068 tokens on every call**
- Request hash: `sha256:4f86bb8094756a96bc8639d33e8b635a4bfb16223629a9a1c8ece05e6e31648d`

The request is naturally comparable to R3's 4234–4280 bytes and 980–997
tokens. All four traces exactly matched the offline bytes and hash.

## Provider lock

- Ollama: `0.33.2`
- Model: `qwen3.5:9b`
- Digest: `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`
- `temperature=0`, `think=false`, `stream=false`
- `num_predict=2048`, `timeout_ms=120000`, retry count `0`
- No `seed` field and no `keep_alive` field

The version and digest matched before the first inference.

## Calls

Exactly four strictly serial cognition calls were executed. Language calls: 0.
Evaluator calls: 0. There was no warm-up, retry, fifth call, preload, unload or
resource-pressure manipulation.

| Call | Initial residency | Available RAM | GPU used / total; util; temp | Total / fetch / body ms | Abort | Stage / status | Load / prompt / eval ms | Prompt processing | Generated |
|---:|---|---:|---|---|---|---|---|---|---:|
| 1 | NOT_RESIDENT | 3,793,547,264 B | 949 / 8188 MiB; 40%; 69 C | 21224 / 21224 / 0 | false | COMPLETED / 200 | 7042.77 / 937.09 / 13214.76 | 1068 tokens | 271 |
| 2 | RESIDENT | 2,431,074,304 B | 7118 / 8188 MiB; 2%; 79 C | 6792 / 6792 / 0 | false | COMPLETED / 200 | 1.78 / 61.12 / 6705.82 | 4 tokens executed from 1068-token prompt cache state | 271 |
| 3 | RESIDENT | 2,431,803,392 B | 7121 / 8188 MiB; 0%; 81 C | 7261 / 7261 / 0 | false | COMPLETED / 200 | 2.06 / 58.16 / 7185.77 | 4 tokens executed from 1068-token prompt cache state | 271 |
| 4 | RESIDENT | 2,418,184,192 B | 7130 / 8188 MiB; 5%; 82 C | 7318 / 7318 / 0 | false | COMPLETED / 200 | 1.05 / 62.32 / 7226.47 | 4 tokens executed from 1068-token prompt cache state | 271 |

The final snapshot recorded 2,520,887,296 available RAM and 7089/8188 MiB GPU
memory used. Ollama PID `93560` and app PID `88160` remained unchanged across
the run. All four provider results passed the production schema, projection,
evidence and action-space gates.

Ollama's response envelope reports `prompt_eval_count=1068` on warm calls; the
runner log separately shows that prompt-cache reuse reduced actual warm prompt
execution to 4 tokens. The two measurements describe different views and are
not treated as contradictory.

## Server log window

The exact `server.log` slice covers offsets 50994 through 95787 (44793 bytes),
without truncation or rotation. It records:

- exactly 4 `POST /api/chat` requests and 4 slot releases;
- one natural cold model load, completed in about 6.33 seconds;
- 34/34 layers offloaded, 4717.38 MiB CUDA model buffer and 545.63 MiB host buffer;
- one 0.01 ms prompt-cache update;
- zero cancellation events and zero unload/reload cycles;
- zero GPU-discovery-watchdog warnings;
- zero free-memory-refresh warnings;
- 3.5 GiB free system RAM reported at load.

## Cross-diagnostic comparison

| Evidence | Request / prompt | Initial call | Resident calls | Relevant environment signal |
|---|---|---|---|---|
| R3 historical | 4234–4280 B / 980–997 tok | first 9 calls timed out at 120 s | later cognition calls 16.08–35.54 s | about 449 MiB free RAM at load; watchdog/free-memory warnings; 53.37 s partial prefill and 58.16 s cache update |
| V0 run 1 | 229 B / about 29 tok | 23.663 s | 0.115–0.121 s | about 398.5 MiB free RAM; watchdog/free-memory warnings |
| V0 run 2 | 229 B / about 29 tok | 8.152 s | 0.110–0.172 s | about 3.5 GiB free RAM; warnings absent |
| Representative V1 | 4522 B / 1068 tok | 21.224 s, including load and 271-token generation | 6.792–7.318 s, also 271-token generation | about 3.5 GiB free RAM at load; warnings absent |

Unlike tiny V0, V1's warm latency includes generation of 271 output tokens.
Its cold prompt processing was only 0.937 seconds and cached prompt processing
was about 0.058–0.062 seconds. Production-sized prompt input did not approach
the 120-second boundary under this observed environment.

## Interpretation boundary

This run proves that a neutral 4522-byte/1068-token production cognition request
can complete normally through the exact provider and transport on this machine,
both cold and resident. It materially weakens request size alone as the cause of
R3's nine initial timeouts.

It does not prove that Ollama is universally reliable, that R3's exact root
mechanism was identified, or that RAM pressure caused the historical failure.
It does not justify a timeout change, retry, warm-up, production repair, or a
scientific claim. The historical contrast still makes environmental resource
state the strongest current suspect, so the next separately authorized slice is
`READY_FOR_ENVIRONMENT_RESOURCE_DIAGNOSTIC`.
