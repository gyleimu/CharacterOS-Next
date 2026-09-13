# Structured-output forensics

## Root cause

The defect is at `MODEL_RAW_TEXT`.

The live replay used the exact prior frozen system prompt and the prior saved base user request, transformed by the same frozen P/N/Z/A projection-level intervention. With `format` absent, both known cells reproduced byte-for-byte:

- `S1_AMBIGUOUS_REQUEST / Z`: malformed at character 846; the opening quote before `relevant_memory_refs` is absent.
- `N4 / A`: malformed at character 1274; the opening quote before `relevant_memory_refs` is absent.

Each new malformed `message.content` string is byte-identical to all seven prior instances in its cell. Adjacent returned cells were valid JSON. S1/P had two transport timeouts before response bytes and therefore has no new semantic or serialization result; the saved prior S1/P output remains valid historical evidence.

## Failure-layer classification

| Layer | Result |
|---|---|
| `REQUEST_RENDERING` | Valid; exact saved request reconstruction and condition isolation attestations retained. |
| `OLLAMA_REQUEST` | Valid HTTP JSON envelope; `format` absent in the forensic replay. |
| `MODEL_RAW_TEXT` | **Failure origin.** Ollama response envelope is valid, but `message.content` contains invalid JSON bytes. |
| `PROVIDER_ADAPTER` | Pass-through; returns `message.content` unchanged. |
| `JSON_EXTRACTION` | No extraction, fence stripping, substring selection, or repair exists. |
| `SCHEMA_PARSE` | Fails closed at strict `JSON.parse`. |
| `PROPOSAL_VALIDATION` | Not reached for malformed bytes. |
| `EXECUTOR_VALIDATION` | Not reached for malformed bytes. |

## Transport reality before remediation

- Endpoint: Ollama native `POST /api/chat`.
- Structured-output field: none.
- JSON compliance mechanism: prompt text only.
- Grammar-constrained decoding: none requested.
- Arbitrary free-text parsing: no; exact full `message.content` is parsed.
- Markdown-fence stripping: no.
- Substring extraction: no.
- Post-hoc repair: no.
- Schema-invalid retry: no.
- Host validation after JSON parsing: yes, closed V2 schema plus projection, evidence, action, clarification-basis, and executor relationships.

The first live replay attempt and two early cells encountered current-provider warm-up/throughput timeouts before any response bytes. Those are classified separately as infrastructure failures; they do not change the byte-level root-cause result.
