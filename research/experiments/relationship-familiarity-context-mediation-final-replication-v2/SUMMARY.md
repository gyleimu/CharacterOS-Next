# RESULTS — RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2

Model: `qwen3.5:9b`, digest `6488c96f…`, server `0.34.0`, temperature 0, `num_predict` 2048,
timeout 480000 ms. Real model calls: **72 pilot + 80 primary + 80 replication = 232**.
Zero LLM judges.

## Deterministic precheck — 20/20 PASS, 0 model calls

A 1/32 < B 4/32 · B == C (byte-identical canonical history) · A == D (1/32) · A counterpart
context count 0 · C counterpart context count 0 · B↔D counterpart context set equal · B↔D
**source ids equal, order equal, rendered text equal, counts equal** · B context non-empty ·
task-context ref exposed in both B and D · all seed gates clean · familiarity from real
governed records (1/4/4/1) · corpus byte-identical (`sha256:98811792…` → V2 corpus) · B↔C
history identical, B↔D history distinct · restored familiarity exact · manipulation shape
exact · probes generated nothing.

D's working refs were DERIVED from B's own retrieval selection
(`episode:alice-01..04`, `episode:generic-01`), so the equalization is measured, not asserted.

## Host validity pilot — 4 rounds, no scientific verdict

| round | scenario form | host-valid | behaviour |
| --- | --- | --- | --- |
| R1 | question | 0.667 | context **used** (the model reached the agreement) but it echoed the question as claim[0] and failed handle binding |
| R2 | neutral statement | 1.000 | context never needed — no contrast |
| R3 | statement with the destination | 0.958 | model agreed with alice's stated plan — no contrast |
| **R4** | request form | **1.000 (24/24)** | frozen for the scientific executions |

## Scientific executions

| | primary | replication |
| --- | --- | --- |
| scenes planned/actual | 40/40 | 40/40 |
| duplicate / missing / extra | 0 / 0 / 0 | 0 / 0 / 0 |
| calls | 80 | 80 |
| host-valid | **40/40 = 1.000** | **40/40 = 1.000** |
| failure classes | `{}` | `{}` |
| C1 `A↔B` | 0/10 | 0/10 |
| C2 `B↔C` | 0/10 | 0/10 |
| C3 `B↔D` | 0/10 | 0/10 |
| C4 `A↔D` | 0/10 | 0/10 |
| criteria 3,5,6,7,9,10 | PASS | PASS |
| criteria 1,2,4 | FAIL | FAIL |
| verdict | `PRIMARY_CRITERIA_NOT_MET` | **`FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED`** |

Seed clean, corpus identical, manipulation check passed, semantic non-conflation passed,
language authority clean, accounting exact in both executions. The two executions agree
perfectly on every contrast.

## Per-cell behaviour (pilot + primary + replication = 104 host-valid scenes, 0 failures)

| cell | counterpart context readable | `CITES_COUNTERPART_CONTEXT` | `CITES_GENERIC_ONLY` | `continuation_success` | `clarification_requested` |
| --- | --- | --- | --- | --- | --- |
| `A_LOW_NO_CONTEXT` | 0/26 | 0 | **26** | 0 | 0 |
| `B_HIGH_CONTEXT` | **26/26** | **0** | **26** | 0 | 0 |
| `C_HIGH_CONTEXT_ABLATED` | 0/26 | 0 | **26** | 0 | 0 |
| `D_LOW_CONTEXT_EQUALIZED` | **26/26** | **0** | **26** | 0 | 0 |

`unsupported_context_claim = 0` and `forbidden_relationship_inference = 0` in every cell.

## What this establishes

1. **The host-validity problem is solved.** 104/104 host-valid scenes across three executions
   with zero failures and exact accounting — the explicit purpose of this slice, and the reason
   its verdict space has no INCONCLUSIVE outcome.
2. **The deterministic mediation chain is untouched and fully proven**: familiarity 4/32 flips
   the strategy and triggers exactly one counterpart retrieval, which puts the counterpart refs
   into the model-facing allowlist; at 1/32 it never happens. `B` and `D` expose identical
   sources by measurement.
3. **The behavioural link is NOT replicated.** With the counterpart context fully readable in
   `B`/`D` (26/26 scenes), the delivered behaviour is indistinguishable from the baseline: no
   counterpart citation, no clarification, no change in the structured endpoint. `C1`, `C2` and
   `C4` are 0/10 in both executions; `C3` (0/10) is consistent with H4 but is not evidence for
   it, because the treatment itself produced no effect.
4. **Semantic non-conflation holds**: zero forbidden vocabulary, zero unsupported claims in 104
   host-valid scenes.

## Why the effect is absent — documented trade-off (not hidden)

Pilot evidence shows a strict model-capability trade-off on the frozen contract:

- Forms in which the stored context is actually **used** (question forms) make the model emit an
  echo claim quoting the user turn; that claim's handle binding fails and the whole proposal is
  rejected (host validity 0.667, below the gate).
- Forms that are **host-valid** (statement/request forms) are answered from the generic default;
  the model never consults the counterpart items even though they are readable.

The protocol's mandatory host-validity gate therefore had to be satisfied by the second family,
under which no behavioural difference exists. **The null is therefore bounded by the model, and
is not evidence that context availability can never change behaviour.**

## What this does not establish

- That familiarity can never mediate behaviour under any implementation or model.
- Anything beyond `EXECUTOR_COMPOSITION` or the single frozen scenario.
- A positive scalar effect of familiarity — nowhere observed in any generation.
