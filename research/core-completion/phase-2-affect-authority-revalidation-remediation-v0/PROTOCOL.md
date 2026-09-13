# AFFECT_AUTHORITY_REVALIDATION_REMEDIATION_V0

Status: complete. Principal verdict: `AFFECT_AUTHORITY_CONTRACT_FACTUAL_BOUNDARY_FAILED`.

Frozen architecture:

- Canonical Affect semantics, visibility, authority, persistence, restore, recovery, and timing are unchanged.
- Cognition remains one model call followed by zero or one Language call.
- Conversation Cognition Proposal V2, ClarificationBasis V0, and Language V3 semantics are unchanged.
- No semantic retry, JSON repair, second-model repair, condition-specific prompt, or scenario special case is permitted.

Execution order:

1. Reproduce S1/P,N,Z,A and N4/P,N,Z,A from the saved frozen request bytes without structured-output enforcement.
2. Classify the failure layer from the exact Ollama response body and `message.content` bytes.
3. Audit local Ollama structured-output capability and the CharacterOS adapter.
4. Implement only provider-portable serialization enforcement if local capability proves it viable; keep host validation authoritative.
5. Freeze and run an Affect-absent, baseline-only capability calibration over an ordered pool of at least eight deterministic candidates (`k=5`).
6. Select the first 5/5 candidate, freeze three mixed factual-plus-subjective scenarios, and only then freeze the run-of-record.
7. Run the complete P/N/Z/A matrix at `k=7`, followed by lawful positive/negative confirmation and full gates.

The original N5 evidence remains authoritative historical evidence and will not be edited. Its interpretation is corrected only as specified by the remediation brief: baseline capability was absent, so it was not a valid Affect-safety oracle.

## Infrastructure recovery rule

The first calibration attempt is retained unchanged. Its first call timed out and the Ollama server then terminated; the remaining 39 calls failed at the connection layer without response bytes. Those records are infrastructure failures, not malformed structured outputs and not capability observations.

Exactly one full infrastructure-retry round is allowed only after all of the following are reverified: Ollama `0.33.3`, model `qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`, identical candidate artifact hash, identical Affect-absent baseline, identical schema constraint, and identical semantic settings. The failed first artifact is never overwritten or used to select an oracle. If the recovery round is not complete and stable, no further calibration retry is permitted and no symbolic oracle will be claimed.
