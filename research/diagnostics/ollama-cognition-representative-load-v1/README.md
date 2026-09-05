# OLLAMA_COGNITION_REPRESENTATIVE_LOAD_DIAGNOSTIC_V1

Manual, non-scientific diagnostic for one neutral production-sized cognition
request. It is not an experiment, has no canonical authority, and never writes
under `research/experiments/`.

The fixture follows the real production route:

```text
lawful CognitiveContextProjectionV0
→ LlmCognitionProviderV0 production prompt builder
→ OllamaNativeCognitionTransportV0
```

Its size comes from ordinary production projection fields and the frozen prompt
renderer. There is no repeated filler, copied experiment request, behavior
realization, evaluator, retry, warm-up, or model-residency manipulation.

Before a run, inspect the exact request offline without an inference call:

```powershell
node research/diagnostics/ollama-cognition-representative-load-v1/runner.ts --inspect-only
```

The deliberate run executes exactly four serial cognition calls and writes to a
new evidence run directory:

```powershell
node research/diagnostics/ollama-cognition-representative-load-v1/runner.ts
```

Validate the generated evidence with:

```powershell
node research/diagnostics/ollama-cognition-representative-load-v1/validate.ts <run-directory>
```

The runner imports only the built runtime public API. Run `pnpm build` before a
deliberate diagnostic if production sources have changed since the last build.
