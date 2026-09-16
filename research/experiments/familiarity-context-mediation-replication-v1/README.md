# FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1

Bounded real-model experiment testing the **context-mediation** hypothesis for governed
interaction familiarity, and testing explicitly that the **familiarity scalar itself has no
independent behavioural effect**.

Continues [`relationship-familiarity-history-causal-v0`](../relationship-familiarity-history-causal-v0/)
(commit `bcf7e5d`) with a minimal increment. The governed-history construction, the seed
contamination gate, the authoritative restore path, the model runner, the source/evidence
instrumentation and the intervention-cell shape are REUSED; what changed is the corpus size,
the scenario form, the cell set and the verdict vocabulary — each for a stated reason recorded
in `contract.ts`.

## Preregistered hypotheses

| # | Hypothesis |
| --- | --- |
| H1 | higher governed interaction familiarity causes counterpart-specific retrieval to activate |
| H2 | that retrieval changes model-facing context availability |
| H3 | the changed context availability causes reproducible cognition/behavior differences |
| H4 | when context availability is equalized, the familiarity scalar itself produces no detectable independent behavioural effect |
| H5 | no trust / liking / safety / intimacy semantics emerge from familiarity |

## Production causal path exercised

```
interaction experience
  → processInteractionExperience                       (real verification/admission/receipt)
  → evaluateRelationshipGovernedWriteV0                (real governed-writer evaluation)
  → Atomic Commit V2 → durable familiarity k/32
  → deriveInteractionFamiliarityReadProjectionV0       → "presence=PRESENT level=k/32"
  → deriveInteractionFamiliarityCognitionInfluencesV0  → "context_resolution_strategy=…"
  → orchestrateInteractionFamiliarityRetrievalV0       → EXACTLY ONE priority query (k ≥ 2)
  → retrieved counterpart refs join the model-facing evidence allowlist
  → Cognition V8 → Language V10 → delivered behaviour
```

`decision admission = 0` is unchanged: familiarity never selects or arbitrates an action.

## Cells

| cell | history (real governed writes) | canonical familiarity | counterpart context readable | priority queries |
| --- | --- | --- | --- | --- |
| `A_LOW` | 1 credited interaction | 1/32 | no | 0 |
| `B_HIGH` | 4 credited interactions | 4/32 | **yes** (the one retrieval) | 1 |
| `C_HIGH_RETRIEVAL_ABLATED` | identical history to `B_HIGH` | 4/32 | no | 1 (contribution suppressed) |
| `D_LOW_CONTEXT_EQUALIZED` | 1 credited interaction, plus `B_HIGH`'s exact retrieved refs as canonical working refs | 1/32 | **yes** | 0 |

`C` and `D` are research-only (`NOT_PRODUCTION_WRITE`, `production_write: false`); no cell writes
familiarity directly, and no governed history is fabricated.

## Preregistered contrasts (primary scenario)

| id | contrast | question | expected |
| --- | --- | --- | --- |
| C1 | `A_LOW` ↔ `B_HIGH` | does real familiarity-triggered retrieval accompany a behaviour difference? | difference |
| C2 | `B_HIGH` ↔ `C_HIGH_RETRIEVAL_ABLATED` | with familiarity held equal, does removing the retrieval mediator remove the effect? | effect vanishes |
| C3 | `B_HIGH` ↔ `D_LOW_CONTEXT_EQUALIZED` | with context equalized, does the familiarity scalar still have an effect? | **no effect** |
| C4 | `A_LOW` ↔ `D_LOW_CONTEXT_EQUALIZED` | does providing the treatment context to a low-familiarity subject reproduce the treatment behaviour? | reproduces |

## Endpoint

Host-determined only — the response-semantics atom plus the designated claim's **authorized
`source_refs`**. `CITES_COUNTERPART_CONTEXT` requires the claim to cite a counterpart ref; in
`A_LOW`/`C` that ref set is not in the evidence allowlist, so the class is unreachable there by
construction. No LLM judge is used. Structured outcomes recorded per scene: host_valid,
schema_valid, factual_authority_pass, counterpart_context_cited, correct_counterpart_context_cited,
generic_context_only, clarification_requested, redundant_context_query, assumes_shared_context,
continuation_directness, unsupported_relationship_inference.

## Host validity pilot (7 rounds, all before any scientific execution)

The pilot exists because the predecessor failed its primary scenario on model compliance. It
scored model compliance ONLY — no scientific verdict, distinct identities, no threshold touched.

| round | change under test | host-valid |
| --- | --- | --- |
| R1 | 6-item corpus, open question | 0.500 |
| R2 | 6→4-item corpus, content-naming scenario | 0.250 (detector defect found) |
| R3 | confirmation ("the way we agreed"), ref-based readability detector | 0.500 |
| R4 | orthogonal generic item | 0.625 |
| R5 | content-asking scenarios | 0.500 |
| R6 | nested quotes removed from the shared-context item | 0.500 |
| **R7** | **single validated scenario, 4 cells** | **1.000 (8/8)** |

R7 also showed the full preregistered pattern (C1 2/2, C2 2/2, C3 0/2, C4 2/2). Design frozen.

## Seed trust boundary (required)

`observeSeededGovernedRelationshipStateV0` over the initialization seeds, recorded per cell in
`manifest.json`: `seed_contains_governed_relationship_state = false`,
`seeded_bundles_with_writer_authority = 0`, `unreadable_seed_shapes = 0` — clean in every cell.

## Run

```
node .../cli.ts prepare   <dir>   # 0 model calls: 12/12 deterministic precheck + manifest
node .../cli.ts pilot     <dir>   # host validity pilot (no scientific verdict)
node .../cli.ts run       <dir>   # primary
node .../cli.ts replicate <dir>   # replication, frozen code, distinct identities
```

See [`SUMMARY.md`](./SUMMARY.md) for results.
