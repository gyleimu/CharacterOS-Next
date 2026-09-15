# RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0

The bounded experiment that tests the LAST frozen familiarity channel — retrieval
mediation — after the direct-projection channel was closed as a scoped negative
(`research/core-completion/relationship-familiarity-causal-closure-v0/DECISION.md`).

Estimand:

```
familiarity → interaction_familiarity_cognition_influence
  → COUNTERPART_CONTEXT_SEARCH_FIRST → retrieval orchestration
  → retrieved counterpart context → Cognition (V8 + atom) → Language (V10) → behavior
```

**Scope (frozen):** the production executor (`ConversationTextResponseExecutorV1`) composed
with the PRODUCTION retrieval service (`RepositoryBackedMemoryRetrievalServiceV0`) behind
the existing `RuntimeDependencyContainer.retrieval` seam. The delivered session
composition is deliberately NOT modified (its port is inert and its own query is
familiarity-blind); a positive result is therefore a capability-level, retrieval-mediated
finding under `EXECUTOR_COMPOSITION`, never a product-session `ACTIVE_CAUSAL` claim.

**Same-corpus invariant:** all conditions expose the identical repository revision — 18
canonical episodes: 16 alice interaction items (index 7 = the counterpart convention, the
mediator), one generic item (also the only canonical working ref, so it is visible in every
condition), one bob distractor that a counterpart-bound query must never select. Only the
number of admitted familiarity receipts differs (LOW = 1 → 1/32 `BASIC_CONTEXT_FIRST`;
HIGH = 16 → 16/32 `COUNTERPART_CONTEXT_SEARCH_FIRST`), accrued through the real producer +
governed writer authority + Atomic Commit V2 path.

**Conditions:** `LOW_FULL`, `HIGH_FULL`, `HIGH_SEARCH_ABLATED` (same restored HIGH state and
corpus; the priority query still fires but its contribution is suppressed by returning the
validated production result with an empty selection — a `RETRIEVAL_MEDIATOR_ABLATION`, never
a state mutation).

**Scenarios (latitude-preserving):** `S1_STATUS_UPDATE_REQUEST` (primary) and
`S2_FORMAT_CHECK`. Without counterpart context a framing question or a generic answer is
lawful; with it, using the established convention is lawful too. No unique quote
mechanically determines the answer.

**Endpoint (frozen before calls):** classes over the host-validated response atom —
`USES_RETRIEVED_COUNTERPART_CONTEXT` (PRIMARY_FACT quoting the retrieved counterpart
episode), `ASKS_FOR_FRAMING` (PRIMARY_CLARIFICATION), `GENERATIVE_ACT`, `STANCE`,
`OTHER_FACT`, `UNCLASSIFIED`. No LLM judge, no free-text similarity.

**Budget:** 2 scenarios × 3 conditions × 8 replicates = 48 scenes ⇒ ≤ 96 generation calls
(+ ≤ 2 readiness) ≤ 100. No retries, no replacement, no repair.

**Gates:** host-complete; manipulation check per condition (§22); same-corpus digest
equality; LOW/HIGH internal stability ≥ 6/8; LOW ≠ HIGH ≥ 6/8 pairs; the ablation returns
toward LOW ≥ 6/8; language authority clean; no forbidden trust/affinity vocabulary; no
condition labels. Failure of the manipulation check yields
`RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_MECHANISM_FAILED` (never a behavioral-negative);
a corpus mismatch yields `RELATIONSHIP_FAMILIARITY_MEMORY_CONFOUNDED`.

Run:

```
node research/experiments/relationship-familiarity-search-first-causal-v0/cli.ts prepare research/experiments/relationship-familiarity-search-first-causal-v0/evidence/readiness-v0
node research/experiments/relationship-familiarity-search-first-causal-v0/cli.ts run research/experiments/relationship-familiarity-search-first-causal-v0/evidence/readiness-v0 research/experiments/relationship-familiarity-search-first-causal-v0/evidence/qualification-v0
```

`prepare` runs the zero-model preflight (same-corpus proof, manipulation check for all three
conditions, retrieval specificity, fresh-process restore, isolation) and freezes the fixture
+ manifest after verifying the provider model digest and server version without any
generation call. `run` executes the bounded qualification exactly once per scheduled scene
in a fresh process, saving raw observations before scoring. The zero-model conformance suite
lives at `evals/conformance/relationship-familiarity-search-first-causal-v0.test.ts`.
