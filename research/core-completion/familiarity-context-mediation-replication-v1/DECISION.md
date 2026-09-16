# FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1 — DECISION

Baseline SHA: `bcf7e5d98766e8de3ff43d3c93ab13196435e7d0` (`main`, clean, HEAD == origin/main).
Experiment: `research/experiments/familiarity-context-mediation-replication-v1/`.

## Verdict

**`FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE`** — the preregistered host-valid-rate criterion
(≥ 0.900) was not met in either scientific execution (0.850 both times), so no behavioural claim
is authorized by the frozen criteria. **No threshold, gate, endpoint or metric was changed after
seeing results.** Every other preregistered criterion passed, and the four mediation contrasts
reproduced the full predicted pattern in the replication.

The substantive result — that familiarity's behavioural influence is **fully context-mediated**
and carries **no independent scalar effect** — is reported as the scope-limited finding it is,
and is not promoted into the verdict.

## Frozen conclusions respected (not reopened)

Writer Authority unchanged; no production file touched; familiarity storage/write admission still
1; decision admission still 0 (`NOT_DECISION_ADMISSIBLE`, `NO_TYPED_ACTION_RELATION`); no new
Relationship infrastructure; no new trust/liking/safety/intimacy/affinity/dependence semantics;
no product work; `voice`/`vision` untouched.

## What was built (minimal increment)

Reused from `RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0`: governed familiarity history
construction, the seed contamination gate (`observeSeededGovernedRelationshipStateV0`), the
authoritative v4 restore path, the model runner shape, the source/evidence instrumentation and the
research-intervention cell shape. Added or changed, each with a recorded reason:

| change | reason |
| --- | --- |
| corpus 18 → 8 episodes (4 counterpart, 1 generic, 1 distractor) | §4 symmetry; predecessor exposed ~36 sources and lost model compliance |
| 4 cells `A/B/C/D` replacing the predecessor's 6 | §5; `D` now equalizes context by construction rather than by a projection rewrite |
| `D`'s working refs derived from `B`'s own retrieval selection | makes equalization measured, not asserted (precheck check 6) |
| new verdict vocabulary (`FAMILIARITY_CONTEXT_MEDIATION_*`) | §2: the predecessor's "causal influence" wording is not reused |
| `precheck.ts` with twelve structural checks | §9: refuses to authorize any model run unless every condition holds |
| host validity pilot phase with distinct identities, no scoring | §3: the predecessor's primary scenario died on model compliance |
| readability detected from evidence-allowlist membership | a prompt-substring test was fooled by the scenario utterance quoting the content (found in pilot R2) |

## Host validity pilot — seven rounds, all pre-scientific

Full log in `SUMMARY.md`. Compliance and signal were fixed together: open questions produced
multi-claim handle-binding slips; a confirmation form was answerable by mere agreement so the
readable context was never USED; content-naming woke an observation-echo claim that broke every
cell; nested quotes in the shared item broke exact-substring quoting. The final configuration
(single validated scenario, 4-cell corpus, orthogonal generic item, quote-free shared items)
reached **1.000 (8/8)** with the full predicted pattern, and the design was frozen there.

## Deterministic precheck — 12/12 PASS, 0 model calls

A familiarity 1/32 < B 4/32; B == C (byte-identical canonical history); A == D (1/32);
B history ≠ D history; B context == D context (same 5 refs); A context ≠ B context (0 vs 5);
B↔C same familiarity representation with different availability; B↔D different familiarity with
same availability; all seed gates clean; corpus byte-identical; probes generated nothing.

## Scientific executions (frozen code, distinct identities)

| | primary | replication |
| --- | --- | --- |
| scenes / accounting | 20/20, 0/0/0 | 20/20, 0/0/0 |
| calls | 30 | 30 |
| host-valid | 0.850 | 0.850 |
| C1 `A↔B` | 2/2 | 4/4 |
| C2 `B↔C` | 5/5 | 3/3 |
| C3 `B↔D` | **0/5** | **0/5** |
| C4 `A↔D` | 2/2 | 4/4 |
| verdict | INCONCLUSIVE | INCONCLUSIVE |

Per-cell behaviour is identical in all three executions (pilot included): `A_LOW` and
`C_HIGH_RETRIEVAL_ABLATED` always ask for framing (18/18 valid); `B_HIGH` and
`D_LOW_CONTEXT_EQUALIZED` always cite the counterpart context (15/15 valid).

## The one gate miss

Six failures across the two executions, all 9B schema slips in the CLARIFY path
(`current_observation_ref: no kind prefix`, `missing_information: exceeds 256 code points`,
`CLARIFY requires NO_SUBJECTIVE_SELECTION`, one unbound claim source). The frozen host laws were
not weakened to rescue them.

## Persistence / restore

Every scene of every execution ran in a fresh process performing a full authoritative v4 restore
(boundary mint → chain validation → exact terminal head) before the matched scene. The precheck
additionally verified exact restored familiarity and state revision per cell. No scene ever
observed a live in-memory history.

## Residual risks

1. **Model-boundary dependence.** The measured effect is a host-validated citation class; the 9B
   model's compliance is scenario-sensitive, and one scenario survived piloting. Generality across
   question forms is not established.
2. **`D`'s availability scope.** `D` exposes exactly the refs `B`'s retrieval selected, delivered
   as canonical working refs. The sets are equal by measurement, but the delivery path differs
   (working ref vs retrieval), so "same context" is a set-level, not byte-level, equality of the
   intermediate mechanism.
3. **Revision covariate.** `B`/`C` carry state revision 5 while `A`/`D` carry revision 2. `C3`
   (0/5 twice) shows higher familiarity *and* higher revision together produce no difference once
   context is equal, so revision is excluded as a driver of the measured contrast, but it is not
   independently manipulated.
4. **Baseline cell compliance.** The CLARIFY-path schema slip concentrates in the baseline cell,
   which is what keeps the host-valid rate at 0.850; a more compliant model would likely clear
   criterion 7 without any design change.
