# RESULTS — RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0

Frozen head at start: `226536148de77afe7e7859eb9f156f3614f38a79`.
Real model calls: **126** (80 cognition + 46 language) across three executions. Zero LLM judges.

## Design executed (all cells built ONLY through the real governed writer)

| cell | history | canonical familiarity | model-facing familiarity | counterpart corpus readable | priority queries |
| --- | --- | --- | --- | --- | --- |
| `A_LOW` | 1 credited interaction | 1/32 | `level=1/32`, `BASIC` | no | 0 |
| `B_HIGH` | 16 | 16/32 | `level=16/32`, `SEARCH_FIRST` | **yes** | 1 |
| `C_MEDIATOR_ABLATED` | 16 | 16/32 | `level=16/32`, `SEARCH_FIRST` | no | 1 |
| `D_FAMILIARITY_EQUALIZED` | 16 | 16/32 | `level=1/32`, `BASIC` | no | 1 (discarded) |
| `E_LOW_WITH_MEDIATOR` | 1 | 1/32 | `level=1/32`, `BASIC` | mediator item only | 0 |
| `F_LOW_FULL_CORPUS` (control) | 1 | 1/32 | `level=1/32`, `BASIC` | **yes (full)** | 0 |

Seed gate (required) passed in every cell and every execution:
`seed_contains_governed_relationship_state = false`, `seeded_bundles_with_writer_authority = 0`,
`unreadable_seed_shapes = 0`. Entity corpus identical across all cells
(`sha256:ea8db0fa05c58a84a748c9de6740c511c5d0d74958c758acc281e8e26fa1f6da`).

## Executions

| execution | scenes planned/actual | dup/missing/extra | cognition | language | recorded verdict |
| --- | --- | --- | --- | --- | --- |
| primary | 40/40 | 0/0/0 | 40 | 24 | `FAMILIARITY_EFFECT_INCONCLUSIVE` |
| control | 24/24 | 0/0/0 | 24 | 13 | `FAMILIARITY_EFFECT_INCONCLUSIVE` |
| replication | 16/16 | 0/0/0 | 16 | 9 | `FAMILIARITY_EFFECT_INCONCLUSIVE` |

`seed_clean`, `manipulation_ok`, `corpus_identical`, `language_authority_clean` are `true` in all
three; `forbidden_vocabulary` is empty in all three (`SEMANTIC_NON_CONFLATION` holds — no trust /
liking / intimacy / safety vocabulary was ever delivered).

All three verdicts are `INCONCLUSIVE` because the preregistered **primary scenario `S1`** produced
too few host-valid treatment scenes (`host_complete = false`). The decisive **secondary scenario
`S2`** contrasts are recorded in the same artifacts and are reproduced below.

## S2 results (host-valid scenes, three independent executions)

| execution | `A_LOW` | `B_HIGH` | `F_LOW_FULL_CORPUS` |
| --- | --- | --- | --- |
| primary | `CITES_OTHER_EVIDENCE` ×4 | `CITES_COUNTERPART_MEDIATOR` ×3 | — |
| control | `CITES_OTHER_EVIDENCE` ×4 | `CITES_COUNTERPART_MEDIATOR` ×3 | `CITES_COUNTERPART_MEDIATOR` ×4 |
| replication | `CITES_OTHER_EVIDENCE` ×4 | `CITES_COUNTERPART_MEDIATOR` ×3 | — |

Within-cell consistency 100%; treatment direction identical in all three executions
(`A↔B` = 3/3 each). Primary-execution cell detail (S2): `C_MEDIATOR_ABLATED`
`CITES_OTHER_EVIDENCE` ×4, `D_FAMILIARITY_EQUALIZED` `CITES_OTHER_EVIDENCE` ×4,
`E_LOW_WITH_MEDIATOR` `CITES_OTHER_EVIDENCE` ×4.

## Contrasts (S2)

| contrast | result | reading |
| --- | --- | --- |
| `A↔B` treatment | 3/3 ×3 executions | effect present and **replicated** |
| `B↔C` mediator channel | 3/3 | effect carried by the familiarity-retrieved context (identical familiarity text and revision) |
| `C↔D` direct familiarity-text channel | 0/4 | the familiarity **prompt text alone does nothing** |
| `A↔D` revision-only | 0/4 | history length / `state_revision` artefact **excluded** |
| `A↔E` mediator item only, no familiarity | 0/4 | a single readable item is insufficient |
| `A↔F` **full corpus readable, no familiarity** | **4/4** | availability WITHOUT familiarity **reproduces** the treatment |
| `B↔F` treatment vs availability-only | **0/3** | treatment is **indistinguishable** from availability-only |

## What the experiment establishes

1. **A lawful, deterministic path from history to a different cognition input exists** and is
   proven without any model: real interaction experience → real governed writer → durability →
   familiarity (1/32 vs 16/32) → strategy flip → exactly one counterpart retrieval → the
   counterpart corpus enters the model-facing evidence allowlist (`A` never exposes it; `B` always
   does). The `decision admission = 0` boundary is respected: nothing but context/retrieval changes.
2. **The behavioural difference is reproducible and directionally consistent** (100% within-cell,
   3/3 treatment in three independent executions) on the secondary scenario, and it is **not**
   attributable to the direct familiarity text (`C↔D` 0/4) or to history length (`A↔D` 0/4).
3. **The behavioural sensitivity is to context availability, not to the familiarity scalar.**
   Providing the same counterpart corpus without any familiarity reproduces the treatment exactly
   (`A↔F` 4/4, `B↔F` 0/3). Familiarity's causal role in the frozen architecture is therefore to
   **trigger the retrieval that makes the context readable** — a genuine mediated influence, but
   not an independent scalar effect on behaviour.

## What the experiment does NOT establish

- A **familiarity-scalar** behavioural effect (the adversarial control refutes it).
- Anything about the preregistered **primary scenario `S1`**: its treatment cell was 0/4 host-valid
  in both executions, so no primary-scenario claim is authorized.
- Any claim beyond `EXECUTOR_COMPOSITION`; the delivered product session was not modified.
- Any psychological or semantic reading of "familiarity": the endpoint is a host-validated
  citation class, and the delivered behaviour never contained trust/affection vocabulary.

## Model boundary encountered (documented, not worked around)

On `S1` the treatment cell repeatedly failed the **frozen** factual-authority laws, verbatim:

- `factual_assessment.claims[1]: REJECTED_SOURCE_BINDING SOURCE_QUOTE is not an exact substring of
  every cited source`
- `clarification_basis.current_observation_ref: no kind prefix`
- `conversation proposal.subjective_selection: CLARIFY requires NO_SUBJECTIVE_SELECTION`
- one `MODEL_TRANSPORT_MODEL_CONNECTION_FAILURE: fetch failed`

These are the `M1`/`N6` model-compliance classes the Core freeze manifest already records. The host
law is correct and fail-closed and was **not** weakened; the experiment reports the resulting
`host_complete = false` rather than relaxing a gate.

## Reproduce

```
node research/experiments/relationship-familiarity-history-causal-v0/cli.ts prepare   <dir>   # 0 model calls
node research/experiments/relationship-familiarity-history-causal-v0/cli.ts run       <dir>   # primary
node research/experiments/relationship-familiarity-history-causal-v0/cli.ts control   <dir>   # adversarial control
node research/experiments/relationship-familiarity-history-causal-v0/cli.ts replicate <dir>   # replication
```
