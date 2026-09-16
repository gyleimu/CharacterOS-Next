# RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2

The FINAL familiarity replication slice. Its only purpose was to remove the host/model
compliance problem that left V1 inconclusive (host-valid 0.850 < 0.900) and then run one
decisive preregistered replication. It does not re-research familiarity.

Reuses the V1 harness (`familiarity-context-mediation-replication-v1`): governed familiarity
history construction, the seed contamination gate, the authoritative v4 restore path, the model
runner and the intervention cells are unchanged in shape.

## Preregistered hypotheses

H1 higher lawful familiarity activates counterpart-specific retrieval · H2 that retrieval
changes model-facing context availability · H3 context availability changes structured
cognition/behavior · H4 when context availability is equalized, high vs low familiarity
produces no meaningful independent behavioral difference · H5 familiarity does not imply
trust/liking/safety/intimacy/dependence/affinity/willingness to take risk.

## Cells (4, no further matrix growth)

| cell | history | canonical familiarity | counterpart context readable | priority queries |
| --- | --- | --- | --- | --- |
| `A_LOW_NO_CONTEXT` | 1 credited interaction | 1/32 | absent | 0 |
| `B_HIGH_CONTEXT` | 4 credited interactions | 4/32 | **present** | 1 |
| `C_HIGH_CONTEXT_ABLATED` | identical history to `B` | 4/32 | absent | 1 (contribution removed, research-only) |
| `D_LOW_CONTEXT_EQUALIZED` | 1 credited interaction + `B`'s exact retrieved refs | 1/32 | **present** | 0 |

`C`/`D` are research-only (`NOT_PRODUCTION_WRITE`); no canonical or production state is written.

## Corpus (protocol §2)

6 episodes — 4 counterpart-specific (`episode:alice-01..04`, two carrying shared context) plus
2 non-counterpart (`episode:generic-01` = the generic default; `episode:other-01` = an
unrelated distractor). Every cell uses the identical underlying corpus; only
familiarity-triggered retrieval decides which counterpart items enter the model-facing
evidence allowlist. Model-facing factual sources: `A`/`C` 2, `B`/`D` 6.

## Preregistered contrasts (protocol §7)

| id | contrast | expected |
| --- | --- | --- |
| C1 | `A_LOW_NO_CONTEXT` ↔ `B_HIGH_CONTEXT` | difference |
| C2 | `B_HIGH_CONTEXT` ↔ `C_HIGH_CONTEXT_ABLATED` | difference (mediator necessity) |
| C3 | `B_HIGH_CONTEXT` ↔ `D_LOW_CONTEXT_EQUALIZED` | **no meaningful difference** (direct scalar test) |
| C4 | `A_LOW_NO_CONTEXT` ↔ `D_LOW_CONTEXT_EQUALIZED` | difference (context sufficiency) |

## Frozen outcomes (protocol §6, exactly eleven)

`host_valid`, `schema_valid`, `factual_authority_pass`, `counterpart_context_cited`,
`correct_counterpart_context_cited`, `generic_only`, `clarification_requested`,
`unsupported_context_claim`, `assumes_shared_context`, `continuation_success`,
`forbidden_relationship_inference`. No outcome was added after the first model call.

## Endpoint

Host-determined only: the response-semantics atom plus the designated claim's **authorized
`source_refs`**. `CITES_COUNTERPART_CONTEXT` requires the claim to cite a counterpart ref — a
class unreachable by construction in `A`/`C` because those refs are not in the evidence
allowlist. No LLM judge.

## Verdict space (protocol §15) — exactly three values

`FAMILIARITY_CONTEXT_MEDIATION_REPLICATED` · `FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED` ·
`EXPERIMENT_INVALID`. There is no INCONCLUSIVE outcome: this slice exists to remove the
host-validity problem, so an unmet host-validity gate is reported as NOT_REPLICATED.

## Deterministic precheck (protocol §4, 0 model calls)

20 checks covering the familiarity ordering, `A`/`C` counterpart-context count = 0, `B`↔`D`
source **ids / order / text / count** equality, the seed trust boundary, familiarity
provenance from real governed records, corpus identity, B↔C byte-identical history, B↔D
distinct history, exact restored familiarity, the manipulation shape, and generation-free
probes. All must pass or the experiment is `EXPERIMENT_INVALID` and no model is invoked.

## Host validity pilot (4 rounds, pre-scientific, no verdict)

| round | scenario form | host-valid | contrast |
| --- | --- | --- | --- |
| R1 | question ("where should it go?") | 0.667 | context **used**, but the model echoed the question as a claim and failed handle binding |
| R2 | neutral statement | 1.000 | none — the context was never needed |
| R3 | statement containing the destination | 0.958 | none — the model agreed with alice's stated plan |
| **R4** | **request ("Please file the rollback checklist.")** | **1.000** | frozen for the scientific executions |

R4 was frozen because the protocol's mandatory host-validity gate (≥ 0.95 with ≥ 20 valid
scenes) takes precedence; the trade-off this exposes is reported as a scope limitation.

## Run

```
node .../cli.ts prepare   <dir>   # 0 model calls: precheck + manifest
node .../cli.ts pilot     <dir>   # HOST_VALIDITY_PILOT_V2 (no scientific verdict)
node .../cli.ts run       <dir>   # primary  (4 cells × 10)
node .../cli.ts replicate <dir>   # replication, frozen code, replicates 11..20
```

See [`SUMMARY.md`](./SUMMARY.md).
