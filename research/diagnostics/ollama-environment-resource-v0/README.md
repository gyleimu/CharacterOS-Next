# OLLAMA_ENVIRONMENT_RESOURCE_DIAGNOSTIC_V0

Manual diagnostic-only comparison of the frozen representative cognition request
under three bounded host-RAM conditions. It is not a CharacterOS behavior
experiment and has no canonical authority.

Fixed levels are 0, 512 and 1024 MiB of helper-owned host RAM. Allocation occurs
in touched 16 MiB chunks. The helper refuses a configured safety floor below
768 MiB, monitors that floor every 250 ms, has an independent PID and exits
automatically after at most ten minutes. Closing its parent channel also releases
the reservation.

The diagnostic never stresses GPU memory deliberately, changes the Windows
pagefile, changes model residency, preloads a model, sends a warm-up request,
changes timeout/configuration, or retries.

Offline fixture verification performs no inference:

```powershell
node research/diagnostics/ollama-environment-resource-v0/runner.ts --inspect-only
```

A deliberate run may execute at most six serial cognition calls:

```powershell
node research/diagnostics/ollama-environment-resource-v0/runner.ts
```
