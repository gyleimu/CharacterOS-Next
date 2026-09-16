# RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0

Bounded experiment answering the familiarity north star:

> different interaction history → **real governed familiarity writer** → different
> familiarity state → **same model, same current scenario, same base prompt** → systematic
> cognition / behavior difference — and is that difference **mediated by familiarity itself**
> rather than by mere context availability?

## Production causal path exercised (PHASE 1, source-traced)

```
interaction experience
  → processInteractionExperience (real verification + admission + receipt)
  → evaluateRelationshipGovernedWriteV0 (real governed-writer evaluation service)
  → Atomic Commit V2 (real pipeline) → durable canonical familiarity (k/32)
  → deriveInteractionFamiliarityReadProjectionV0   ┐
  → deriveInteractionFamiliarityCognitionInfluencesV0 ┤→ Cognition V8 user turn
  → orchestrateInteractionFamiliarityRetrievalV0   ┘   (the ONE priority retrieval)
  → Language V10 → delivered behavior
```

`decision admission = 0` is **unchanged and respected**: familiarity reaches cognition only
through the existing lawful projection / influence / retrieval seams. It never selects or
arbitrates an action deterministically. The one deterministic consequence available today is
the frozen influence: at `ordinal_level >= 2` the strategy becomes
`COUNTERPART_CONTEXT_SEARCH_FIRST`, which triggers **exactly one** counterpart-bound retrieval
whose validated contribution joins the cognition evidence context.

## Cells (2 scenarios × 5 cells × 4 replicates = 40 scenes, ≤ 82 calls)

| cell | history | canonical familiarity | model-facing familiarity | mediator available | intervention |
| --- | --- | --- | --- | --- | --- |
| `A_LOW` | 1 credited interaction | 1/32 | `level=1/32`, `BASIC_CONTEXT_FIRST` | no | — |
| `B_HIGH` | 16 credited interactions | 16/32 | `level=16/32`, `SEARCH_FIRST` | **yes** (1 priority query) | — |
| `C_MEDIATOR_ABLATED` | 16 | 16/32 | `level=16/32`, `SEARCH_FIRST` | no | `RETRIEVAL_MEDIATOR_ABLATION` |
| `D_FAMILIARITY_EQUALIZED` | 16 | 16/32 | `level=1/32`, `BASIC_CONTEXT_FIRST` | no | `FAMILIARITY_REPRESENTATION_EQUALIZATION` |
| `E_LOW_WITH_MEDIATOR` | 1 | 1/32 | `level=1/32`, `BASIC_CONTEXT_FIRST` | yes (working ref) | `CANONICAL_WORKING_REF_AVAILABILITY` |

`C`, `D` and `E` are **research-only** interventions (`NOT_PRODUCTION_WRITE`); none writes
canonical state. `D` replaces ONLY the two familiarity lines in the model-facing user turn and
the runner asserts minimality (`only_familiarity_lines_changed`).

## Contrast decomposition (verified offline, `evidence/readiness-v0/prompts.json`)

| contrast | meaning |
| --- | --- |
| `A↔B` | overall treatment contrast (history + familiarity + availability + revision) |
| `B↔C` | **mediator channel** at matched familiarity text and matched revision |
| `C↔D` | **direct familiarity-text channel** at matched revision and matched availability |
| `A↔D` | **revision-only** effect (identical model-facing familiarity, different revision) |
| `A↔E` | **availability without familiarity** (confound probe) |

Measured prompt equality: `A_LOW` vs `D` differ on exactly **2 lines** (`state_revision` and
`projection_hash`); `A_LOW` vs `C` differ on **4** (`state_revision`, the two familiarity
lines, `projection_hash`). `state_revision` is a co-effect of history length and is reported
per cell rather than hidden.

## Endpoint — instrument repair over the predecessor run

The predecessor (`relationship-familiarity-search-first-causal-v0`) classified
`USES_RETRIEVED_COUNTERPART_CONTEXT` for ANY designated `SOURCE_QUOTE` of ≥ 20 characters, so
its endpoint matched the baseline and the treatment by construction
(`evidence/qualification-v0/SECONDARY_ANALYSIS.md`).

This experiment classifies from **host-validated** facts only — the response-semantics atom plus
the designated claim's **authorized `source_refs`**:

- `CITES_COUNTERPART_MEDIATOR` requires the designated claim to cite the exact counterpart
  mediator ref `episode:alice-08`. In `A_LOW` that ref is not in the evidence allowlist, so the
  class is unreachable by construction; in `B_HIGH` it is reachable.
- `CITES_OTHER_EVIDENCE`, `ASKS_FOR_FRAMING`, `GENERATIVE_ACT`, `STANCE`, `UNCLASSIFIED`
  otherwise.

No LLM judge is used anywhere.

## Required seed trust-boundary gate

`prepare` records `observeSeededGovernedRelationshipStateV0` over the **initialization seeds**
(genesis snapshot + `seedBundles`) for every cell and fails the experiment unless:

```
seed_contains_governed_relationship_state === false
seeded_bundles_with_writer_authority      === 0
unreadable_seed_shapes                    === 0
```

Familiarity is never seeded and never assigned: it accrues only through real interaction
experience → real ingestion → real governed writer. Restore legitimately re-seeds the REAL
committed bundles (durability replay); that path is reported separately and is not the
initialization gate.

## Harness defect found and repaired before the primary run

The inherited predecessor harness called `admitObservation` **without** an observable situation,
so the committed `context.scene` stayed at the generic seeded task and **the counterpart's
message never reached the model** — the model had no user turn to respond to. Repaired by
mirroring the production mechanism (`ExplicitV4SessionAuthorityV0.admitFactualEvent`
`observableSituation`), which is the same path the product uses for first-turn memory. With the
repair the subject receives `alice says: "…"` as its current observable scene; `task` remains the
frozen generic task in every cell.

## Run commands

```
node research/experiments/relationship-familiarity-history-causal-v0/cli.ts prepare   <dir>   # 0 model calls
node research/experiments/relationship-familiarity-history-causal-v0/cli.ts run       <dir>   # primary
node research/experiments/relationship-familiarity-history-causal-v0/cli.ts replicate <dir>   # replication
```

`prepare` exits `3` and refuses to authorize a model run if the deterministic gate or the
provider probe fails. No retries, no repair, no prompt/threshold tuning anywhere.
