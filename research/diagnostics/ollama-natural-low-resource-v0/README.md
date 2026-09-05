# OLLAMA_NATURAL_LOW_RESOURCE_REPRODUCTION_V0

Diagnostic-only observation of the frozen Representative V1 cognition request
while an independently occurring user workload leaves the Windows host with
less than approximately 1 GiB of available physical RAM.

The diagnostic never creates artificial memory pressure, changes the user
workload, mutates model residency, preloads the model, sends a warm-up request,
retries, or changes production transport configuration. If Ollama is absent,
the runner may start the normal local Ollama application and records that
intervention before making any request.

Offline fixture inspection performs no model inference:

```powershell
node research/diagnostics/ollama-natural-low-resource-v0/runner.ts --inspect-only
```

A deliberate run first enforces the natural-window gate and may then execute at
most four strictly serial cognition calls:

```powershell
node research/diagnostics/ollama-natural-low-resource-v0/runner.ts
```
