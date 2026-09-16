# RELATIONSHIP_FAMILIARITY_STAGE_CLOSURE_V0 — DECISION

**Status: RELATIONSHIP FAMILIARITY CURRENT STAGE CLOSED.**

**Executor-substitution falsification attempt (post-closure, recorded):**
`EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0` (see
`research/core-completion/executor-model-substitution-v0/DECISION.md`) tried to test whether this
closure's negative result was an artefact of the local executor by substituting a strong API
executor. It returned `MODEL_SUBSTITUTION_NOT_ISOLATED`: the frozen proposal schema reaches the
executor only through the provider's structured-output constraint, which Ollama grammar-enforces
and the API provider cannot, so the substituted variable could not be isolated to
`EXECUTOR_MODEL`. **This closure therefore stands; it was reopened only for that falsification
attempt, never for architecture iteration.**

This record closes the interaction-familiarity research stage. It is written after the third
and final familiarity experiment and applies whether or not the final replication was positive:
**decision admission stays 0 either way.**

Evidence base: `research/experiments/relationship-familiarity-history-causal-v0` (`bcf7e5d`),
`…-context-mediation-replication-v1` (`175102b`),
`…-context-mediation-final-replication-v2` (this slice).

---

## What is proven

1. **Familiarity is formed only through lived interaction.** Interaction experience → real
   episodic-memory verification → qualifying admission → deterministic evidence receipt →
   `processInteractionExperience` → real governed-writer evaluation → Atomic Commit V2 →
   durable canonical `relationship_core_interaction_familiarity_v0` state. Demonstrated in
   every cell of every execution; the seed trust-boundary gate
   (`seed_contains_governed_relationship_state = false`,
   `seeded_bundles_with_writer_authority = 0`, `unreadable_seed_shapes = 0`) passed everywhere.
2. **The accrual law holds deterministically.** Familiarity is exactly `k/32` for `k` lawful
   receipts, monotone, saturating at 32/32, never seeded, never caller-supplied.
3. **Familiarity deterministically controls counterpart-specific retrieval.** At
   `ordinal_level ≥ 2` the frozen influence flips to `COUNTERPART_CONTEXT_SEARCH_FIRST` and the
   orchestration issues **exactly one** counterpart-bound query; below the threshold it issues
   **none**. Proven with **0 model calls** in every deterministic precheck.
4. **That retrieval changes model-facing context availability.** With retrieval on, the
   counterpart items enter the model-facing evidence allowlist; with it off they do not. In the
   final slice the treatment and the context-equalized control exposed **identical source ids,
   identical order, identical rendered text and identical counts** — measured, not asserted.
5. **Familiarity is a counterpart-specific state**, not a global disposition: the only
   manipulated state is one counterpart's dimension, and a counterpart-bound query never
   selects the non-counterpart distractors.
6. **Semantic non-conflation holds.** Across all three experiments, no delivered behaviour
   contained trust / liking / friendship / safety / intimacy / dependence / affinity / loyalty
   / reliability vocabulary, and no unsupported relationship inference was recorded.

## What is not proven

1. **A replicated behavioural effect of context availability.** The final slice removed the
   host-validity problem completely (pilot 24/24, primary 40/40, replication 40/40 — **104/104
   host-valid scenes, zero failures, exact accounting**) and the preregistered contrasts were
   still **0/10 in both executions**: with the counterpart context fully readable in `B`/`D`
   (26/26 scenes each), the delivered behaviour was indistinguishable from the baseline.
2. **Any independent behavioural effect of the familiarity scalar.** Every generation is
   consistent: once model-facing context is equalized, high and low familiarity are
   indistinguishable. This is a *negative* finding and is reported as such — it is not proof
   that no such effect could exist under a different architecture or model.
3. **The mediation chain end-to-end in a positive direction.** The deterministic half
   (history → familiarity → retrieval → availability) is proven; the model-mediated half
   (availability → different behaviour) is **not** replicated. In 104 host-valid scenes the
   model answered from the generic default in every cell, never citing the counterpart items
   that were demonstrably readable.
4. **Generality.** Only single scenarios survived piloting; the measured endpoint is a
   host-validated citation class under `EXECUTOR_COMPOSITION`, never a product-session claim.

## Frozen familiarity semantics

Familiarity is the bounded, policy-defined degree to which one exact counterpart has become an
established participant in the subject's own admitted firsthand interaction history.
Directional, subject- and counterpart-specific, unsigned, longitudinal, persistent, on the
`k/32` credit grid. It is **not** trust, liking, affinity, safety, intimacy, dependence,
loyalty, closeness, relationship quality, objective knowledge, predictive accuracy, memory
availability or action utility. High familiarity stays fully compatible with low trust,
negative affinity, danger and hostility. `decision_role = MAGNITUDE_ONLY`,
`direct_numeric_mapping_authorized = false`, `cross_feature_comparability = DENY`,
`aggregation_eligibility = NONE_BY_DEFAULT`, `normalization_authority = NONE`.

## Storage/write status

**DONE.** `REGISTERED / STORAGE-WRITE ADMISSION = 1` — interaction familiarity is the only
storage-admitted Relationship feature; governed writes are live in production and reachable
only for that one feature, with the value derived by the frozen law and revalidated at commit.

## Decision admission status

**`0` — unchanged and still closed.** `queryRelationshipFeatureDecisionAdmissionV0` returns
`NOT_DECISION_ADMISSIBLE` with reason `NO_TYPED_ACTION_RELATION` for the admitted feature and
`UNREGISTERED_FEATURE` otherwise. No typed feature×action×counterpart relation provider exists,
and none was created. Familiarity never selects or arbitrates an action.

## Causal evidence status

`CONTEXT_MEDIATION_NOT_REPLICATED`. The deterministic causal chain is established; the
model-mediated behavioural link is not. The three experiments together give the same picture:
the direct-projection channel was a scoped negative; the V1 effect tracked context availability
rather than the familiarity value but never cleared its host-validity gate; and the final slice
cleared that gate completely (104/104 host-valid, 0 failures) while finding no behavioural
difference at all — the counterpart context was readable in 26/26 treatment scenes and was
never used.

## Retrieval mediation status

**Established as a mechanism, negative as a behavioural effect.** Familiarity is the sole
lawful trigger of the one counterpart-bound retrieval and therefore the sole lawful cause of
counterpart context availability — proven with zero model calls in every precheck, and in the
final slice with `B`/`D` exposing identical source ids, order, text and counts. Whether that
availability can measurably change behaviour was not reproduced: with a fully host-valid
configuration the model answered from the generic default in every cell.

## Direct scalar effect status

**Not supported, and never observed in any generation.** When model-facing context is
equalized, high and low familiarity produce the same structured outcome. A scalar direct
effect remains an unsupported hypothesis, not a refuted impossibility.

## Persistence status

**Proven.** Every scientific scene of every execution ran in a fresh process performing a full
authoritative v4 restore (boundary mint → full chain validation → exact terminal head) before
the matched scene; deterministic checks confirmed exact restored familiarity and state
revision. No scene ever relied on live in-memory subject state.

## Remaining risks

1. **Model-capability coupling.** The endpoint depends on a 9B model satisfying the frozen
   factual-authority contract. Pilot evidence in the final slice shows a strict trade-off:
   question forms in which the stored context is actually *used* make the model echo the user
   turn as a claim and fail handle binding (host validity 0.667, below the gate), while
   statement/request forms that are host-valid (1.000) lead the model to ignore the stored
   context entirely. The negative is therefore bounded by the model and the frozen contract, not
   proven to be a property of the architecture. This is the single most important limitation of
   the whole familiarity stage.
2. **Single-scenario scope.** Only one scenario form survived piloting, so scenario generality
   is unestablished.
3. **Availability-scope asymmetry.** The context-equalized control delivers the same ref *set*
   through a different delivery path (canonical working ref vs retrieval), so equality is
   set-level rather than byte-level at the mechanism level.
4. **Revision covariate.** Higher-familiarity cells carry more committed state revisions;
   controls exclude revision as the driver of the measured contrasts but do not manipulate it
   independently.
5. No production architecture gap was found; `ARCHITECTURE_CHANGES = NONE` throughout.

## Why Relationship work stops here

- The storage/write and accrual questions are answered and frozen.
- The decision-admission question is answered: it stays `0`, and the evidence base now shows
  there is no measured independent behavioural effect that would justify opening it.
- The retrieval-mediation mechanism is proven deterministically; its behavioural consequence is
  not replicated, and repeating the same experiment would only re-measure the same model
  boundary rather than produce new knowledge.
- Two independent remediation attempts (V1 pilot + V2 pilot, eleven pilot rounds total) plus
  three execution generations all converge on the same model-capability ceiling. Continuing
  would be a V3/V4 infrastructure loop, which is explicitly out of scope.

## Conditions required to reopen Relationship research

Reopening requires **all** of:

1. A model demonstrably able to satisfy the frozen factual-authority contract on a
   context-dependent scenario at ≥ 0.95 host validity **while** actually using the retrieved
   counterpart context — evidenced by a host-validity pilot before any scientific execution.
2. A scenario in which the counterpart context is provably *necessary* to answer correctly,
   preregistered with the endpoint chosen before the first call.
3. A demonstrated lawful need for decision authority: a typed
   feature×action×counterpart relation contract that does not exist today. Absent that, decision
   admission must remain `0` regardless of any behavioural finding.
4. Explicit authorization to reopen the frozen Writer Authority / decision-admission boundary.
   Until then this stage stays closed and familiarity keeps **no** decision authority.
