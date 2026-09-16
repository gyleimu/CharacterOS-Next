# RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_V0 — DECISION

Experiment: `research/experiments/relationship-familiarity-history-causal-v0/`
Frozen head at start: `226536148de77afe7e7859eb9f156f3614f38a79` (`main`, clean, HEAD == origin/main).

**North star**: different interaction history → real governed familiarity writer → different
familiarity state → same model/scenario/base prompt → systematic cognition/behavior difference,
and is that difference mediated by familiarity rather than by mere context availability?

---

## PHASE 0 — reality check (independently verified)

| Property | Verified |
| --- | --- |
| branch / sync | `main`, HEAD == origin/main, ahead/behind 0/0, worktree clean at slice start |
| Writer Authority freeze | unchanged (no production file touched by this slice) |
| storage-write admission | `1` — interaction familiarity only |
| decision admission | `0` — `queryRelationshipFeatureDecisionAdmissionV0` still `NOT_DECISION_ADMISSIBLE` / `NO_TYPED_ACTION_RELATION` |
| real provider | Ollama reachable, `qwen3.5:9b` digest `6488c96f…` **matches** the repository's frozen digest, server `0.34.0` |
| existing familiarity experiments | 5 predecessor directories found (v0, v1, real-provider-v0, causal-completion-v0, search-first-causal-v0); this slice REUSES the proven harness shape and continues the one channel the closure review left untested |
| external workstream | `tmp/vision-experiments/**` (not this slice) breaks `pnpm lint`; isolated, not modified — see GATES |

No frozen conclusion was reopened; no Writer Authority file was modified; no new Relationship
infrastructure, validator, membrane or registry was created; no product work.

## PHASE 1 — production causal path (source-traced, with the gap identified)

```
interaction experience
  → processInteractionExperience                      (real verification + admission + receipt)
  → evaluateRelationshipGovernedWriteV0               (real governed-writer evaluation)
  → Atomic Commit V2                                  (real pipeline)
  → durable canonical familiarity  k/32
  → deriveInteractionFamiliarityReadProjectionV0      → "presence=PRESENT level=k/32"
  → deriveInteractionFamiliarityCognitionInfluencesV0 → "context_resolution_strategy=…"
  → orchestrateInteractionFamiliarityRetrievalV0      → EXACTLY ONE priority query (k ≥ 2)
  → retrieved counterpart refs join the cognition evidence allowlist
  → Cognition V8 user turn  → Language V10 → delivered behavior
```

Answers to the PHASE 1 questions:

1. **How familiarity is seen**: as a read projection line and an influence line in the
   **user turn** of the Cognition V8 prompt, plus — via the influence — as a change in the
   **evidence allowlist**.
2. **What the cognition layer reads**: `presence` + `ordinal_level/k`, and
   `context_resolution_strategy` (`BASIC_CONTEXT_FIRST` / `COUNTERPART_CONTEXT_SEARCH_FIRST`).
3. **Explicit projection**: yes — `deriveInteractionFamiliarityReadProjectionV0`, with a
   `STATE_VISIBLE_NOT_CITEABLE` legend that explicitly denies trust/liking/safety readings.
4. **decision admission = 0** means familiarity can enter **model context** (and its
   lawfully-mediated retrieval) but **never** deterministic action arbitration. Confirmed: no
   production code path lets a familiarity value select or rank an action; the only
   deterministic consequence is the retrieval trigger.
5. **Downstream consumers**: the live `ConversationTextResponseExecutorV1` path
   (`CognitionActionTransitionExecutor`) for the projection, the influences and the retrieval
   orchestration. The V0/V1 prompt renderers are unit-tested only.

**The chain is NOT broken**: a lawful path from familiarity to a *different cognition input*
exists and is deterministic. What follows is whether a model turns that input difference into a
behavioral difference.

## PHASE 2/3 — history formation and state verification (0 real model calls)

All five cells were built **only** through real interaction experience → real ingestion → real
governed writer → Atomic Commit V2. Familiarity was never seeded, never assigned, never written
as `relationship_core_*` by the harness.

Corpus (byte-identical across every cell): `digest sha256:ea8db0fa05c58a84a748c9de6740c511c5d0d74958c758acc281e8e26fa1f6da`,
18 episodes (16 alice interactions incl. the mediator, 1 generic, 1 bob distractor).

| cell | credits | canonical familiarity | governed authority records | state revision | working refs |
| --- | --- | --- | --- | --- | --- |
| `A_LOW` | 1 | **1/32** (0.03125) | 1 | 2 | `[generic-habit-01]` |
| `B_HIGH` | 16 | **16/32** (0.5) | 16 | 17 | `[generic-habit-01]` |
| `C_MEDIATOR_ABLATED` | 16 | 16/32 | 16 | 17 | `[generic-habit-01]` |
| `D_FAMILIARITY_EQUALIZED` | 16 | 16/32 | 16 | 17 | `[generic-habit-01]` |
| `E_LOW_WITH_MEDIATOR` | 1 | 1/32 | 1 | 2 | `[generic-habit-01, alice-08]` |

Each cell's governed authority records were read back from the committed history
(`writer_family = RELATIONSHIP_GOVERNED_FEATURE`, exact dimension, `commit_ref`,
`authority_payload_hash`, `evidence_receipt_refs`); the count asserted equals the credited
interaction count. Fresh-process **authoritative restore** reproduced the exact familiarity value
and state revision in every cell.

### Seed trust-boundary gate (required)

`observeSeededGovernedRelationshipStateV0` over the **initialization seeds** for every cell:

```
seed_contains_governed_relationship_state = false   (5/5 cells)
seeded_bundles_with_writer_authority      = 0       (5/5 cells)
unreadable_seed_shapes                    = 0       (5/5 cells)
```

### Mediation pre-check (deterministic, before any spend)

| cell | model-facing familiarity | strategy | priority queries | mediator reachable |
| --- | --- | --- | --- | --- |
| `A_LOW` | `level=1/32` | `BASIC_CONTEXT_FIRST` | 0 | **no** |
| `B_HIGH` | `level=16/32` | `COUNTERPART_CONTEXT_SEARCH_FIRST` | 1 | **yes** (`episode:alice-08` in the evidence allowlist) |
| `C_MEDIATOR_ABLATED` | `level=16/32` | `SEARCH_FIRST` | 1 | no |
| `D_FAMILIARITY_EQUALIZED` | `level=1/32` | `BASIC_CONTEXT_FIRST` | 1 (contribution discarded) | no |
| `E_LOW_WITH_MEDIATOR` | `level=1/32` | `BASIC_CONTEXT_FIRST` | 0 | **yes** (via canonical working ref) |

Prompt-equality measurement over the real model-facing user turn:

- `A_LOW` vs `D_FAMILIARITY_EQUALIZED`: **2 differing lines** — `[current state] … state_revision`
  and `[projection_hash]`. The effective familiarity representation and the evidence allowlist are
  identical.
- `A_LOW` vs `C_MEDIATOR_ABLATED`: **4 differing lines** — revision, the two familiarity lines,
  projection hash (availability identical, familiarity text differs).
- `A_LOW` vs `B_HIGH`: 136 differing lines (availability differs — this IS the mediator).

## PHASE 1b — harness defect found and repaired BEFORE the primary run

The inherited predecessor harness called `admitObservation` **without** an observable situation,
so the committed `context.scene` stayed at the generic seeded task and **the counterpart's message
never reached the model**: a scoping smoke call showed the model reasoning about
*"Respond to the user's latest message."* instead of alice's utterance. The predecessor's
"behavior" was therefore not a response to its scenario at all.

Repaired by mirroring the production mechanism
(`ExplicitV4SessionAuthorityV0.admitFactualEvent`'s `observableSituation` — the same path the
product uses for first-turn memory): the subject now receives
`alice says: "How do you want these status updates written?"` as its current observable scene while
`task` remains the frozen generic task in every cell.

Two further pre-run declarations (both recorded in `contract.ts`, neither changes any gate):

- the primary scenario was re-phrased to elicit ONE convention from ONE source, because the host's
  frozen factual authority requires a `SOURCE_QUOTE` to be an exact substring of **every** cited
  source and the 9B model fails that law when it cites several at once;
- the transport timeout was raised `240000 → 480000` ms because the treatment cell lawfully exposes
  17 factual sources instead of 2 and the model's `reasoning_summary` grows with it.

## PHASE 4-8 — primary execution (real model)

40/40 scheduled scenes ran in fresh processes; `planned == actual == unique`, duplicates 0,
missing 0, extra 0. Real model calls: **40 cognition + 24 language = 64** (≤ 82 scheduled max).
Seed clean, corpus identical, manipulation check passed, language authority clean, forbidden
vocabulary **none**.

Preregistered principal verdict: **`FAMILIARITY_EFFECT_INCONCLUSIVE`** — `host_complete = false`.
No gate was relaxed and no standard was changed after seeing results.

### Per-cell results (valid = host-validated `OUTPUT_READY`; classes counted over valid scenes)

| cell | S1 valid | S1 classes | S2 valid | S2 classes |
| --- | --- | --- | --- | --- |
| `A_LOW` | 2/4 | `CITES_OTHER_EVIDENCE` ×2 | 4/4 | `CITES_OTHER_EVIDENCE` ×4 |
| `B_HIGH` | 0/4 | — | 3/4 | **`CITES_COUNTERPART_MEDIATOR` ×3** |
| `C_MEDIATOR_ABLATED` | 0/4 | — | 4/4 | `CITES_OTHER_EVIDENCE` ×4 |
| `D_FAMILIARITY_EQUALIZED` | 3/4 | `CITES_OTHER_EVIDENCE` ×3 | 4/4 | `CITES_OTHER_EVIDENCE` ×4 |
| `E_LOW_WITH_MEDIATOR` | 0/4 | — | 4/4 | `CITES_OTHER_EVIDENCE` ×4 |

### Contrasts

| contrast | S1 (preregistered primary) | S2 |
| --- | --- | --- |
| `A↔B` treatment | 0/0 comparable | **3/3 directional** (`CITES_OTHER_EVIDENCE` → `CITES_COUNTERPART_MEDIATOR`) |
| `B↔C` mediator channel | 0/0 | **3/3 directional** (same familiarity text and revision; availability differs) |
| `C↔D` direct familiarity-text channel | 0/0 | 0/4 |
| `A↔D` revision-only | 0/1 | 0/4 |
| `A↔E` availability without familiarity | 0/0 | 0/4 |

Interpretation of the S2 decomposition (all at matched corpus and matched state revision):

- the effect is present (`A↔B` 3/3) and is carried by the **familiarity-mediated retrieval
  presence** (`B↔C` 3/3 at *identical* familiarity text and revision);
- the **direct familiarity-text channel is inert** (`C↔D` 0/4) — consistent with the closure
  review's direct-channel negative;
- the **revision confound is excluded** (`A↔D` 0/4: same model-facing familiarity, different
  history length and revision → no difference);
- **availability of the mediator without familiarity is insufficient** (`A↔E` 0/4, and the `E`
  prompt verifiably carries the mediator's full text).

### Why S1 is underpowered — a documented model boundary, not a harness defect

The successor scenario S1's treatment cell produced 0/4 host-valid scenes. The failures are
model-compliance failures of the **frozen** factual-authority contract, recorded verbatim in the
evidence:

- `factual_assessment.claims[1]: REJECTED_SOURCE_BINDING SOURCE_QUOTE is not an exact substring of
  every cited source` — the model emits a second claim citing two sources at once;
- `clarification_basis.current_observation_ref: no kind prefix` — the model drops the canonical
  ref kind prefix;
- `conversation proposal.subjective_selection: CLARIFY requires NO_SUBJECTIVE_SELECTION`;
- one `MODEL_TRANSPORT_MODEL_CONNECTION_FAILURE: fetch failed`.

The host law is correct and fail-closed; the 9B model does not reliably satisfy it when the
evidence set is large (17 sources in the treatment cell). This is the same `M1`/`N6`
model-compliance class the Core freeze manifest already records. It is **not** repairable by
weakening the host contract, and this slice did not weaken it.

## PHASE 7 — replication and the adversarial availability control

Both use the frozen `readiness-v1` bundles; `A_LOW` and `B_HIGH` are **byte-identical** to the
primary execution's bundles (verified), so the executions are comparable. Neither execution
relaxed a gate or changed an endpoint.

### Cross-execution agreement — S2, host-valid scenes only

| execution | `A_LOW` | `B_HIGH` | `F_LOW_FULL_CORPUS` (control only) |
| --- | --- | --- | --- |
| primary (40 scenes) | `CITES_OTHER_EVIDENCE` ×4 | **`CITES_COUNTERPART_MEDIATOR` ×3** | — |
| control (24 scenes) | `CITES_OTHER_EVIDENCE` ×4 | **`CITES_COUNTERPART_MEDIATOR` ×3** | **`CITES_COUNTERPART_MEDIATOR` ×4** |
| replication (16 scenes) | `CITES_OTHER_EVIDENCE` ×4 | **`CITES_COUNTERPART_MEDIATOR` ×3** | — |

Within-cell consistency is **100%** in every cell of every execution; the treatment effect
direction is identical in all three independent executions (`A↔B`: 3/3, 3/3, 3/3). Accounting in
each execution: `planned == actual == unique`, duplicates 0, missing 0, extra 0. Total real model
calls across all three executions: 64 + 37 + 25 = **126**.

### The adversarial control **refuted** the familiarity-scalar reading

`F_LOW_FULL_CORPUS` has minimal familiarity (1/32, `BASIC_CONTEXT_FIRST`, **0** priority queries)
but the entire counterpart corpus readable:

| S2 contrast | result |
| --- | --- |
| `A↔F` availability-only | **4/4 directional** (`CITES_OTHER_EVIDENCE` → `CITES_COUNTERPART_MEDIATOR`) |
| `B↔F` treatment vs availability-only | **0/3 — indistinguishable** |

So making the same counterpart context readable **without any familiarity** reproduces the
treatment behaviour exactly, and the treatment is statistically indistinguishable from it. The
proximal cause of the behavioural difference is the **readability of the counterpart corpus in the
cognition context** — not the familiarity scalar. Conversely `C`, `D` and `E` show that neither
high familiarity alone (without its retrieval consequence) nor the mediator item alone is
sufficient.

**Mechanism conclusion.** In the frozen architecture `decision admission = 0`, familiarity has
exactly one lawful route to behaviour: at `ordinal_level >= 2` it triggers the single
counterpart-bound retrieval, which is what makes the counterpart corpus readable. The experiment
confirms that route is **real and reproducible**, and simultaneously shows that the behavioural
sensitivity is to the *availability the retrieval produces*, not to the familiarity value itself.
A "familiarity scalar changes behaviour" claim is therefore **not** supported; a
"familiarity-triggered retrieval availability changes behaviour" claim **is**.

### Verdicts as recorded

All three executions recorded the preregistered principal verdict
`FAMILIARITY_EFFECT_INCONCLUSIVE`, because the primary scenario `S1` produced too few host-valid
treatment scenes (`host_complete = false`) for the gate. The decisive S2 contrasts are recorded in
the same artifacts (`contrasts[]`), so the finding is auditable without re-scoring. The
control execution's verdict field was short-circuited by the same host-completeness gate before
its dedicated control branch could run; the control's preregistered `A↔F` / `B↔F` contrasts are
recorded in `verdict-control.json` and are unambiguous. This limitation is reported rather than
worked around, and no post-hoc verdict was manufactured.

## PHASE 9 — persistence / restore

Every scene of all three executions ran in a **fresh process** that performed a full authoritative
v4 restore of the persisted history before the matched current scene (boundary mint → chain
validation → exact terminal head → restore). The deterministic phase additionally asserted per
cell that the restored familiarity value and state revision are exact
(`restored_familiarity_equal = true`, 6/6 cells). No scene ever observed a live in-memory history,
so the effect is demonstrated through authoritative persistence + restore by construction.
