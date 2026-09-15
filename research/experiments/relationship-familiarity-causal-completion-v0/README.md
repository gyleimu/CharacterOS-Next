# RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0

The first concrete post-Core-freeze domain-completion experiment. It tests whether
`relationship_core_interaction_familiarity_v0` — accrued ONLY through the production
governed writer authority + Atomic Commit V2 path from canonical firsthand episodes —
causally changes current behavior under a matched present scene, model, prompt and
**matched raw Memory**, surviving restart/restore.

- Feature law (frozen, implemented exactly, nothing invented):
  `relationship-interaction-familiarity-accrual-policy.ts` — ABSENT → 1 credit = 1/32,
  then `(k+1)/32` on the k/32 grid (denominator 32), one unique admitted firsthand
  receipt = one credit, monotonic non-decreasing, saturation at 32/32 (no proposal),
  no decay, REINITIALIZE unsupported.
- Conditions (all from the SAME 16 canonical episodes; only the number of ADMITTED
  interactions differs, so repository payloads, episode refs and Memory are identical):
  - `LOW` — 1 admitted firsthand interaction → familiarity 1/32, `BASIC_CONTEXT_FIRST`
  - `HIGH` — 16 admitted firsthand interactions → 16/32, `COUNTERPART_CONTEXT_SEARCH_FIRST`
  - `HIGH_ABLATED` — the SAME restored HIGH runtime with the familiarity material
    replaced by the frozen ABSENT rendering before the model call (§36 projection-level
    ablation; canonical state untouched)
  - (`ABSENT` — zero admitted interactions — is used to MEASURE the frozen ABSENT
    rendering during preflight; it is not a qualification cell.)
- Memory-control policy (predeclared): the injected retrieval service returns an empty
  selection for every condition, so the `SEARCH_FIRST` priority query adds no evidence.
  Raw Memory (working refs, the shared convention episode, resolved factual evidence)
  is identical across conditions; the only model-visible difference is the familiarity
  material itself (plus revision/time metadata, enumerated by the attestation).
- Entry: the production `ConversationTextResponseExecutorV1` over an authoritative
  fresh-process restore — Cognition V8 (`conversation-cognition-proposal-v8` +
  response-semantics atom) and Language V10 (`language-realization-input-v10`). No
  historical protocol fallback.
- Primary endpoint (predeclared, protocol-level, not text similarity): the class of the
  HOST-VALIDATED response atom — `ESTABLISHED_CONVENTION_USED` (PRIMARY_FACT over the
  convention quote), `FRAMING_QUESTION` (PRIMARY_CLARIFICATION), `STANCE`,
  `CONVERSATIONAL_ACT`, `OTHER_FACT`, `UNCLASSIFIED`.
- Scenarios: `S1_CONVENTION_REUSE` (primary, 8 replicates per condition) and
  `S2_REDUNDANT_INTRODUCTION` (secondary).
- Budget: 40 scheduled scenes ⇒ at most 80 generation calls + 2 readiness calls, i.e.
  ≤ 82 of the preregistered maximum of 100. No retries, no repair, no tuning.

Run:

```
node research/experiments/relationship-familiarity-causal-completion-v0/cli.ts prepare research/experiments/relationship-familiarity-causal-completion-v0/evidence/readiness-v0
node research/experiments/relationship-familiarity-causal-completion-v0/cli.ts run research/experiments/relationship-familiarity-causal-completion-v0/evidence/qualification-v0
```

`prepare` runs the zero-model preflight, freezes the fixture/manifest and verifies the
provider model digest and server version without any generation call. `run` executes
the bounded qualification exactly once per scheduled scene in a fresh process, saving
raw observations before any scoring. The zero-model conformance suite lives at
`evals/conformance/relationship-familiarity-causal-completion-v0.test.ts`.

Prior art (context, not repeated): `familiarity-causal-behavior-v0`
(`INVALID_EXPERIMENT`), `familiarity-causal-behavior-v1` (`SAFETY_GROUNDING_FAIL` at
r3), `relationship-familiarity-behavior-real-provider-v0`
(`RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_INCOMPLETE`, canonical-state
intervention with an unusable directional evaluator). None of them isolated the
familiarity state from raw Memory; this experiment does.
