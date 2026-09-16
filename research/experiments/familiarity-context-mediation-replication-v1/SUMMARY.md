# RESULTS — FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1

Real model calls: **72** (48 cognition + 24 language) across pilot + primary + replication.
Zero LLM judges. Model: `qwen3.5:9b`, digest `6488c96f…`, server `0.34.0`, temperature 0.

## Deterministic precheck (0 model calls) — 12/12 PASS

| check | result |
| --- | --- |
| A familiarity < B familiarity | PASS (1/32 vs 4/32) |
| B familiarity == C familiarity | PASS (4/32) |
| A familiarity == D familiarity | PASS (1/32) |
| B canonical history ≠ D canonical history | PASS |
| B canonical history == C canonical history | PASS (byte-identical bundles) |
| B model-facing counterpart context == D's | PASS (same 5 refs) |
| A model-facing counterpart context ≠ B's | PASS (0 vs 5 refs) |
| B vs C same familiarity representation, different availability | PASS |
| B vs D different familiarity, same availability | PASS |
| all seed gates clean | PASS |
| corpus byte-identical | PASS (`sha256:98811792…`) |
| probe generated nothing | PASS |

D's working refs were **derived from B's own retrieval selection**
(`episode:alice-01..04`, `episode:generic-habit-01`) — the equalization is measured, not asserted.
The system prompt hash is identical in all four cells (1 distinct hash per cell).

## Executions

| execution | scenes | dup/missing/extra | cognition | language | host-valid | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| pilot | 8/8 | 0/0/0 | 8 | 4 | **1.000 (8/8)** | `PILOT_NO_SCIENTIFIC_VERDICT` |
| primary | 20/20 | 0/0/0 | 20 | 10 | 0.850 (17/20) | `FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE` |
| replication | 20/20 | 0/0/0 | 20 | 10 | 0.850 (17/20) | `FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE` |

Seed clean, corpus identical, manipulation check passed, semantic non-conflation passed
(forbidden vocabulary empty) and language authority clean in all three executions.

## Per-cell behaviour (host-valid scenes only)

| cell | pilot | primary | replication |
| --- | --- | --- | --- |
| `A_LOW` | `ASKS_FOR_FRAMING` 2/2 | `ASKS_FOR_FRAMING` 2/2 | `ASKS_FOR_FRAMING` 4/4 |
| `B_HIGH` | **`CITES_COUNTERPART_CONTEXT` 2/2** | **5/5** | **5/5** |
| `C_HIGH_RETRIEVAL_ABLATED` | `ASKS_FOR_FRAMING` 2/2 | `ASKS_FOR_FRAMING` 5/5 | `ASKS_FOR_FRAMING` 3/3 |
| `D_LOW_CONTEXT_EQUALIZED` | **`CITES_COUNTERPART_CONTEXT` 2/2** | **5/5** | **5/5** |

Zero cross-cell contamination: **15/15** host-valid scenes in `B_HIGH`/`D` cite the counterpart
context; **18/18** in `A_LOW`/`C` ask for framing.

## Preregistered contrasts

| id | pilot | primary | replication | expected | met |
| --- | --- | --- | --- | --- | --- |
| C1 `A↔B` treatment | 2/2 | 2/2 (2 comparable) | **4/4** | difference | yes (replication) |
| C2 `B↔C` mediator removal | 2/2 | **5/5** | **3/3** | effect vanishes | **yes** |
| C3 `B↔D` scalar, context equalized | **0/2** | **0/5** | **0/5** | no effect | **yes** |
| C4 `A↔D` context reproduces | 2/2 | 2/2 (2 comparable) | **4/4** | reproduces | yes (replication) |

Criteria 1–6, 9, 10 pass in the replication; **criterion 7 (host-valid rate ≥ 0.900) fails in
both scientific executions at 0.850.**

## Cause of the single gate miss

All six failures across the two scientific executions are 9B **model schema slips concentrated
in the CLARIFY path** of the two framing-producing cells, verbatim:

- `clarification_basis.current_observation_ref: no kind prefix` (3× in the primary, all `A_LOW`)
- `clarification_basis.missing_information: exceeds 256 code points` (`C`)
- `subjective_selection: CLARIFY requires NO_SUBJECTIVE_SELECTION` (`C`)
- `claims[0].source_refs: observation:… is not bound in cognition considered/evidence refs` (`A_LOW`)

The host laws are the frozen production laws, are fail-closed, and were **not** weakened. The
failures reduced `C1`/`C4` comparability in the primary (2 pairs instead of 5); the replication's
distinct identities happened to clear the ≥3 comparability gate for both.

## What this establishes

1. **H1/H2 — retrieval activation and context availability are real and deterministic.** The
   precheck proves with 0 model calls that familiarity 4/32 flips the strategy to
   `COUNTERPART_CONTEXT_SEARCH_FIRST` and triggers exactly ONE retrieval, which puts the
   counterpart refs into the model-facing evidence allowlist; at 1/32 that never happens.
2. **H3 — the changed availability changes behaviour, reproducibly.** Identical `A_LOW` and
   `C_HIGH_RETRIEVAL_ABLATED` both ask for framing (18/18 valid scenes across executions);
   identical availability in `B_HIGH` and `D_LOW_CONTEXT_EQUALIZED` both cite the counterpart
   context (15/15). C2 = 5/5 and 3/3.
3. **H4 — the familiarity scalar has no independent behavioural effect.** `B_HIGH` (4/32) and
   `D_LOW_CONTEXT_EQUALIZED` (1/32) expose the SAME context and are **indistinguishable**
   (C3 = 0/5 in the primary and 0/5 in the replication, and 0/2 in the pilot).
4. **H5 — semantic non-conflation holds.** Forbidden trust/liking/safety/intimacy/dependence
   vocabulary empty in every execution; no unsupported relationship inference recorded.

## What this does not establish

- A **verdict-level** replicated claim: the preregistered host-valid-rate gate failed (0.850 vs
  0.900) in both scientific executions, so no behavioural claim is authorized by the frozen
  criteria and the recorded verdict is `INCONCLUSIVE`. The gate was **not** relaxed.
- Anything beyond `EXECUTOR_COMPOSITION`; the delivered product session was not modified.
- Generality across scenarios: piloting showed the topic/style of the question materially changes
  model compliance, and only ONE scenario survived; that is a scope limitation, not a
  demonstration of generality.
- Any psychological reading of "familiarity": the endpoint is a host-validated citation class.
