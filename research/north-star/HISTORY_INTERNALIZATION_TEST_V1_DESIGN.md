# HISTORY_INTERNALIZATION_TEST_V1_DESIGN

Status: **DESIGN ONLY — NOT AUTHORIZED, NOT IMPLEMENTED, NOT RUN.**
This document defines an experiment. It authorises nothing. Starting it requires its own
approval point, call budget and evidence path (the repository's standing rule).
Audit basis: `NORTH_STAR_EVIDENCE_AUDIT.md`, `NORTH_STAR_EVIDENCE_MATRIX.md`,
`NORTH_STAR_GAP_ANALYSIS.md` (all 2026-09-20, HEAD `02b6c46`).

### Constraint inherited from the audit brief

**NO NEW CORE FEATURE.** This design adds no mechanism. Every instrument it uses already
exists and is listed in §12 with its path. If an arm cannot be built from existing seams, it
is marked `REQUIRES NEW MECHANISM — OUT OF SCOPE` rather than invented here.

### What this experiment is for

It answers exactly one question, and it is designed so that a **negative** answer is as
useful as a positive one:

> Does a life change the **subject** — such that the change is visible in what the subject
> does when the life's text is no longer in front of it — or does the life merely remain
> **retrievable**?

The audit established that the repository currently demonstrates the second and not the
first: in the only real-provider measurement of durable-history divergence, removing the
memory-evidence text removed **80 of 100 percentage points** of the effect, the structured
intent moved **0 pp**, and the residual internalized-state difference was **2.27e-05**
(`durable-life-history-future-behavior-divergence-v0-remeasure`). This design is built to
put the first claim on trial.

---

## 1. Hypothesis

**H1 (primary, falsifiable).**

> Two subjects grown from **one identical genesis** in two different long-term environments
> hold **different internalized persistent states**, and that difference — *with the raw
> history removed from the model-facing request* — produces a **reproducible difference in
> the subject's validated decision outputs** on a **shared, never-before-seen test scenario
> set**, exceeding the executor's measured same-request noise band.

**H1-specificity (secondary, falsifiable).**

> The difference is **attributable to a named internal state**: intervening on that state
> alone moves the outputs predictably, and intervening on an unrelated state does not.

**H0 (null).**

> With the raw history removed, the lived subject and its genesis twin are
> indistinguishable on the test scenario set at a rate inside the executor's measured
> same-request noise band. Under H0, the durable history is retrievable but not internalized
> in any behaviourally consequential sense.

**Directional sub-hypothesis (falsifiable).**

> A TRUST-trajectory subject, tested after history removal, differs from its genesis twin in
> the pre-registered *reliance/cooperation* direction; a BETRAYAL-trajectory subject
> differs in the pre-registered *caution/withholding* direction; a NEUTRAL-trajectory
> subject differs from its twin by less than the mean of the two.

H1 is falsified by H0 holding. H1-specificity is falsified if a non-target intervention
produces the same movement as the target intervention (no specificity), or if the target
intervention produces no movement (no causal role).

**Explicit non-hypotheses.** This experiment does **not** test consciousness, human-like
emotion, personality realism, or external validity beyond the tested executor. Those are
outside the repository's claim boundary already (`VISION.md` non-goal 1;
`RESEARCH_STATE.md` §4).

---

## 2. Independent Variable

**IV = long-term lived environment**, applied as a **scripted counterpart/environment policy**
over the production turn path.

- `TRUST` — the environment is **reliable**: statements made by the counterpart are later
  confirmed by delivered outcomes; commitments are kept; the subject's delivered help is
  followed by an explicit success outcome.
- `BETRAYAL` — the environment is **unreliable**: the same *kind* and *number* of statements
  are made, but they are later contradicted by delivered outcomes; commitments are broken;
  the subject's delivered help is followed by explicit failure outcomes.
- `NEUTRAL` (control) — the same kind and number of interaction events with outcomes that are
  **mixed and non-predictive** (a fixed alternating pattern not derivable from the
  counterpart's statements), so the subject cannot form a directional stance. Purpose: to
  separate "any history at all" from "a *valenced* history".

**What is held byte-identical across trajectories** (see §3) includes the event count, event
kinds, event timing/ticks, prompt/schema bytes, and the *lexical length budget* of the
environment's utterances. **What differs is only the truth-value relation between what the
environment says and what later happens.**

**Not an independent variable in V1 — Personality.** Personality plasticity is
`personality_adaptation_enabled: false` by literal constant in
`product/sandbox/src/product-provider-bundle.ts:192-195`, the product supplies no
`personality_genesis_prior`, and the wiring refuses to create dimensions from an empty
container. Turning it on to make the experiment instructive would be *building a mechanism so
the study passes*, which the audit brief forbids and which the repository's own evidence
disclaims (`Should CharacterOS Core Continue Expanding? NO`). **V1 therefore declares the
SLOW layer out of scope and reports it as a known absence**, not as a tested non-effect.

---

## 3. Controlled Variables

All of the following must be identical across the three trajectories, and their identity
must be **machine-verified and published**, not asserted.

| # | Controlled variable | Verification method |
|---|---|---|
| 1 | Same genesis: identical `SubjectStateV4` seed (identity, identity anchors, empty personality, empty beliefs, no relationships, genesis affect baseline `(0, 0.2)`, same `mechanism_config`) | genesis `state_hash` printed and required equal across subjects before episode 1 |
| 2 | Same executor: one provider family, one model, one digest, one endpoint | model digest recorded; `MODEL_API_MODEL` / `CHARACTEROS_EXECUTOR` pinned; digest printed |
| 3 | Same generation settings | temperature, `top_p`, `num_ctx`, per-stage `num_predict` (appraisal 256, cognition 3072 local / shared on cloud, language shared, selector 64) recorded from the transport-layer observer |
| 4 | Same tool/action space | `action-space fingerprint` and `allowed_actions` set equal across arms (the projection already carries this) |
| 5 | Same context budget and retrieval permissions | identical `context_window_tokens`; identical top-K (8); identical retrieval configuration; identical flag state for every relevant switch — **all flags recorded per run** |
| 6 | Same final test inputs | the frozen test scenario set, byte-identical per probe across all arms; request identity hashed per call |
| 7 | Same episode count, kinds and logical times | the life plan is one frozen file with three outcome scripts; counts and tick sequence printed and required equal |
| 8 | Same lexical budget for environment utterances | per-utterance code-point bounds chosen at freeze time and enforced; the *distribution* of lengths must not differ systematically between TRUST and BETRAYAL (this is the control that stops "longer/more emotional text" from being the real IV) |
| 9 | Same number of provider calls per arm | call ledger per stage; any arm exceeding its budget is `INVALID`, not truncated |
| 10 | Same wall-clock/tick equalization before test | a fixed `Time` transition run to a common logical time so affect recovery is comparable |
| 11 | No test-phase peeking | the test scenario set and its probes are frozen before any life episode runs; the harness fails closed if a test probe appears inside a life episode |

**The single permitted difference is the outcome script of the environment** (§2). The audit's
confound-G warning (state coupling) is handled by §6's ablation matrix and §7's specificity
intervention, not by pretending the states are uncoupled — they genuinely are coupled by
design, which is why attribution requires the intervention, not just the trajectory contrast.

---

## 4. Trajectories

**Life plan.** One frozen plan file: `N_life` episodes (recommended floor **N_life ≥ 60** per
trajectory, on the basis that the repository's existing 216-episode subject is the only
subject in the programme with a non-trivial life, and that the audit found every prior
longitudinal claim underpowered at N=4 and N=8). Each episode runs the **real production
turn path** — no substitution, no direct state writes — so that all four live adaptation
channels are exercised:

```
episode → Observation/Conversation commit
        → Appraisal (real model) → AffectApplication (canonical commit)
        → Experience encode → Episode commit
        → Belief adaptation (semantic provider → canonical ±0.05 step)
        → Relationship familiarity ingestion (canonical +1/32 per admitted receipt)
        → Personality adaptation: DECLARED OUT OF SCOPE (disabled by construction)
```

**Three arms in the primary run:** `TRUST`, `BETRAYAL`, `NEUTRAL`.
**Genesis twins:** one twin per trajectory, materialised from the same seed and **never
exposed to any episode**. The twin is not a fourth subject with a life; it is the
counterfactual "same subject, no life", and it is the comparison that makes "the life
changed the subject" meaningful.

**Nested ordering control (Q9's requirement, included because it is nearly free).** Spend a
**fourth** trajectory on the *reversal*: the same multiset of episodes as `TRUST` delivered
in the reverse order. This is not the primary endpoint; it exists so the design can report
whether trajectory *order* matters at all, which the audit found is currently `E0`. If call
budget cannot fund it, it is dropped explicitly rather than silently — and the design then
states that Q9 remains `E0`.

---

## 5. History removal — the decisive instrument

Two distinct removal classes. They are **not** interchangeable and must never be reported as
one number.

**HR-1 — rendered removal (measurement tool).**
The provider-facing request is re-rendered with the designated history content removed, with
canonical state **untouched**. This is exactly the precedent set by
`durable-life-history-future-behavior-divergence-v0-remeasure`
(`captureFutureProjection(restored, { ablate: true })`,
`ablation_contract_id: EXPERIMENTAL_PROVIDER_FACING_BEHAVIOR_OUTCOME_EVIDENCE_REMOVAL_V0`)
and by `non-memory-state-value-ablation-v0` (`verifyAblation`, which machine-checks that
every removed line matches a designated section prefix, that reinsertion reconstructs the
request **byte-exactly**, and that the memory section is unchanged).

Designated removable blocks, each independently verifiable:

| Block | Rendered as | Removal is verified by |
|---|---|---|
| `MEM` — retrieved factual memory | `[PRIOR FACTUAL MEMORY …]` … `[END HISTORICAL FACTUAL CONTENT]` | `memory_section_present === false`; whole-request byte-diff equals the removed block |
| `STATE` — non-memory persistent state | `[affect (canonical)] valence=…`, `[SUBJECTIVE BELIEF STANCES …]`, `[relationships]`, `[interaction familiarity …]` | `state_block_present === false`; reinsertion byte-exact |
| `ID` — identity | `[identity] subject_id=…` | must **never** be removed in any arm; its presence is asserted in every request |

**HR-2 — structural removal (robustness check).**
The test turn runs with the retrieval stage producing an empty working set (no second
retrieval, no top-K merge — the repository's single-retrieval-per-turn invariant must hold;
`CURRENT_TURN_QUERY_AWARE_RETRIEVAL_V0`'s own invariant test is the precedent). HR-2 must
produce the same conclusion as HR-1; if the two disagree, the primary result is reported as
`INCONCLUSIVE` and the disagreement is the finding.

**Forbidden.** No history may enter through any other channel: the harness asserts the
request contains no `[CONVERSATION HISTORY]`, no `[TRANSCRIPT]`, no life-plan text, no arm
label, and that `messages.length === 2` — the same assertions
`lived-history-differentiation.test.ts` already makes and passes.

---

## 6. The decisive matrix

The four core cells. **B vs D is the primary contrast.**

| | Retrieval/`MEM` **present** | Retrieval/`MEM` **removed** |
|---|---|---|
| **STATE = lived** | **A** = full production CharacterOS | **B ← PRIMARY: state-only** |
| **STATE = genesis twin** | **C** = retrieval-only | **D** = stateless (≈ B0) |

- **B vs D = the internalization test.** Both requests carry no history text. The only
  difference is the internalized state. If B ≈ D, the life changed nothing that survives the
  removal of its text → **H0**, the primary gap closes negative, and the internalization
  line is declared unjustified.
- **A vs C = the marginal-value question**, re-run properly. This is
  `non-memory-state-value-ablation-v0`'s product question, now with Belief, Relationship and
  Affect all live (that experiment ran at `7999f6a` when all three were ABSENT, which the
  audit flagged as gap rank 8).
- **A vs B = how much the state contributes on top of retrieval**; **C vs D = how much
  retrieval contributes with no life state**.
- Each cell must satisfy `ablation_equivalence`: the cell's body must be canonical-JSON-equal
  to its source cell with only the designated block removed (`projection_hash` recomputed).

**Executor qualification gate (mandatory, pre-registered).** The audit found the SAME
manipulation producing `0/10` context mediation on local `qwen3.5:9b` and `10/10` on API
`deepseek-flash` (`executor-model-substitution-matched-v1`). An executor that cannot use a
state line at all makes this experiment **insensitive**, and an insensitive null would be
indistinguishable from a real null. Therefore, before the primary run, the chosen executor
must pass a **state-sensitivity qualification** on the *same* construction: a positive
control arm in which a large, lawful, non-life state contrast is injected and must move the
validated endpoint above the noise band. `qwen3.5:9b` already holds such a qualification for
cognition content (`canonical-affect-behavior-influence-v0/v1`, 320/320, ablations 0) and may
be reused with that citation; any other executor must earn its own. The qualification result
is published before the primary run, and a **failed qualification is reported as
`EXECUTOR_UNQUALIFIED` — not as a null result.**

**Noise-floor calibration (mandatory, from the repository's own lesson).**
`non-memory-state-value-ablation-v0` was killed by an identical repeated request flipping its
directive (`REALIZE → CLARIFY`), and `belief-causal-validation-v0` was unable to authorise a
positive verdict because the model flips 30–40 % at temperature 0. Both reports recommend the
same remedy: build a variance band. Therefore: **k ≥ 5 byte-identical same-request replicates
per cell**, interleaved in randomized order, before any between-cell claim. The primary
decision rule is that a between-cell effect must **exceed the measured same-request band**.

---

## 7. Internal state measurements (pre-test gate)

Measured on the durable state, before any test probe runs, per trajectory and per twin:

| State | Field | Reported as | Non-degeneracy requirement |
|---|---|---|---|
| Belief | `/beliefs` items: proposition identity, canonical label, credence | count, label, credence per item | **not at a bound** (`0 < credence < 1`) for at least one item, else `INCONCLUSIVE_BY_SATURATION` |
| Relationship | `/relationships`: counterpart refs, familiarity credits | credits per counterpart, saturation flag | below the `32/32` cap |
| Affect | `/affect`: `valence`, `activation` | both values | activation **not pinned at 1.0**; the audit found 19/19 and 50/50 end-of-turn readings at exactly `1.000` on the existing subject |
| Memory | episode count, revisions | counts | — (reported, not gated) |
| Personality | `/personality` dimensions | "NONE — disabled by construction" | reported as an absence, never as a null result |
| Regulation | `energy/stress/arousal/fatigue` | values | expected byte-exact zero dynamics; recorded to document that it is inert |

**State-distance gate (the clause the audit's finding #3 forces).** Let `δ_state` be the
declared distance between a trajectory's state and its twin's state over the named
dimensions. **The test phase may run only if `δ_state ≥ δ_min` for the declared target
dimension AND no target dimension is at a bound.** If the gate fails, the run is recorded as
`INCONCLUSIVE_BY_SATURATION` — a statement about the trajectory design, **not** evidence
against H1. This is a design requirement, not an optional check: the existing subject's
saturated state is direct evidence that an ungated run would be uninterpretable.

All state reads are read-only projections over an exact historical revision
(`refsBelongToRevision`, the existing authority passthrough). Zero model calls.

---

## 8. Behavioral probes

The audit's structural ceiling must be respected: `CognitionAction` is a **canonical
zero-delta NO_OP**, `ActionIntentV0` is "a REQUEST for a future execution layer", and the only
`ActionExecutorV0` is a deterministic sandbox. So the endpoints below are the **validated
closed sets that actually exist**, and each brief-required probe is mapped onto one of them.
No probe may be scored by an unvalidated free-text judgement in the primary endpoint.

| Brief-required probe | Primary endpoint (validated, closed set) | Secondary endpoint |
|---|---|---|
| trust judgment | `communication_directive.kind` ∈ {REALIZE, CLARIFY, …} on a reliability-assessment scenario | rubric on realized text |
| risk judgment | `action_intent` tuple chosen from the host-legal action set on a caution-required scenario | rubric |
| expectation | `action_intent` on a "what will happen next" scenario where two host-legal actions encode contradictory expectations | rubric |
| information reliance | `communication_directive.kind` + whether the subject's proposal cites a specific evidence handle (`FACTUAL_AUTHORIZATION` outcome is a host-computed boolean — not a judgement) | whether delivered text reproduces the cited span |
| cooperation choice | `action_intent` between a cooperative and a withholding host-legal action | rubric |
| uncertainty handling | `CLARIFY` vs `REALIZE` on an underdetermined scenario; plus `confidence`/`uncertainty` fields already in the structured proposal | rubric |
| decision/action preference | the whole `action_intent` tuple, compared against a pre-registered preferred tuple per probe | directive kind |

**Endpoint hierarchy (declared before the run).**
1. **Primary:** `action_intent` tuple equality/inequality per probe, and
   `communication_directive.kind` — both host-validated closed sets, both already used as
   endpoints in committed experiments.
2. **Secondary:** realized `CharacterLanguageBehaviorV0` text, measured as exact-text
   disagreement against the ablation background (precedent:
   `canonical-affect-downstream-language-behavior-causal-v0`, 60 % vs 4 %).
3. **Tertiary:** per-probe rubric classification by a **blinded** evaluator that sees only
   the two candidate outputs in randomized, counterbalanced order, with the presentation
   position of the "lived" arm randomized — because the audit found one prior blinded
   evaluator degenerated into a position tracker
   (`relationship-familiarity-behavior-real-provider-v0`: "Response X always judged as used
   context"). The tertiary endpoint can never upgrade a negative primary endpoint.

**Scenario set.** `N_probe ≥ 12` frozen, novel scenarios (never seen in any trajectory, and
the harness fails closed if a probe string appears in the life plan), balanced across the
seven probe families, each with a pre-registered "preferred action tuple" written before the
run. `N_probe = 1` was the audit's finding F; 12 is the floor chosen so that a paired
sign-consistent result is meaningful at the replicate counts below.

---

## 9. Intervention

Two mechanisms, deliberately distinguished. Conflating them is exactly confound G
(state coupling) and confound A (prompt leakage).

**(i) Rendered ablation — measurement (§5 HR-1).** Request-side, machine-verified, canonical
state untouched. Defines cells A–D. Never reported as an intervention on the subject.

**(ii) Canonical intervention — causation.** A **lawful canonical commit on a disposable
copy**, so the state hash genuinely changes. Precedent exists: `SubjectStateV4GenesisSeedV0`
+ `materializeSubjectStateV4V0` lets a host construct lawful initial state, and tests already
author `/affect`, `/beliefs`, `/personality`, `/relationships` fixtures. Every intervention
records the before/after `state_hash`, the transition identity and the producer
authorisation. **The frozen fail-closed single-writer law is used as designed, not bypassed.**

| ID | Intervention on the lived subject | Target | Pre-registered prediction |
|---|---|---|---|
| `I-AFF` | set `/affect` to the twin's genesis value `(0, 0.2)`; retrieval untouched | affect | affect-sensitive probes move toward C; belief-sensitive probes do **not** |
| `I-BEL` | set every belief credence to the stance-zero value `0.5`; retrieval untouched | belief | belief-sensitive probes move toward C; affect-sensitive probes do **not** |
| `I-REL` | reduce familiarity credits to the pre-life value (the accrual law has no downward transition, so this is a **research-only canonical fixture**, explicitly flagged as such); retrieval untouched | relationship | familiarity-mediated probes move toward C |
| `I-NONE` | a **no-op commit** of the same shape | control | no movement; if this moves the endpoint, the endpoint is not measuring state |
| `I-FREEZE` | disable further adaptation from the pre-test revision (`CHARACTEROS_DISABLE_ADAPTATION`), re-run the same probes | adaptation | **no** movement across two successive test rounds (the state is what it is) |

`I-NONE` and `I-FREEZE` are the specificity controls. Without them, "the state did it" is
unfalsifiable, because any perturbation of the request moves a non-deterministic model.

---

## 10. Restart test

Mandatory, and it is the cheapest way to separate "identity" from "a cached projection".

```
life rounds complete
  → capture durable state (fresh process)
  → hard shutdown (process exits; the runtime is discarded, not reused)
  → new OS process, restore from the durable store
  → require origin === "RESTORED"
  → require field-by-field EXACT vs pre-shutdown
       (state_revision, repository_revision, episodes, affect, beliefs, relationships, personality)
  → re-submit the frozen probes
  → require the post-restart request identity to equal the pre-restart request identity
       (re-render equality, the precedent is reattest.json: "Phase C's replay projection is
        byte-identical to Phase B's")
  → PRIMARY: the B-vs-D differential after restart must lie inside a pre-declared tolerance
       of the pre-restart differential
```

This arm is where the repository is strongest and it should be exploited: the exact-reconstruction
restore chain (`PersistedSubjectEnvelopeV1`, 9 fail-closed stages) regularly achieves
field-by-field `EXACT` across dozens of real fresh-process restarts. If the differential
**does not** survive restart, that is a finding about identity persistence, independent of H1.

Additional negative controls already proven and required here: a rolled-back store must be
rejected (`restore-rollback.test.ts`), and a corrupted durable delta must fail closed
(`persistence-r2-store-image.test.ts`).

---

## 11. Baselines

| Arm | Name | Construction | Purpose |
|---|---|---|---|
| **B0** | Stateless LLM | genesis subject, `MEM` and `STATE` both removed | the floor; identical to cell D |
| **B1** | Persona / Profile prompt | the lived subject's **pre-test state rendered as prose**, information-matched to the `STATE` block (same facts, same granularity, no additional detail), replacing the structured state lines; retrieval untouched | **the prompt-leakage control.** Because every demonstrated state→behaviour path in this repository is 100 % prompt-textual, B1 is the comparator that decides whether the *provenance* of a self-referential line matters or only its presence |
| **B2** | Summary memory | a prose summary of the same episodes, produced **once** by the same model under a declared budget, replacing the structured `MEM` + `STATE` blocks; length- and fact-matched as closely as possible, with the residual mismatch reported | the "Memory + LLM 每轮重算" comparator — `VISION.md` criterion **C6**, marked `HYPOTHESIS`, "从未比较过" |
| **B3** | CharacterOS | cell A (full production) | the system under test |
| **B4** (declared future) | RAG / retrieval-only | cell C | isolates the retrieval channel as a standalone product |
| **B5** (declared future) | Long context | the full episode transcript rendered into the context window at the maximum defended budget, with retrieval and state lines removed | the long-context comparator the brief asks for |

**B1's information-matching is a hard requirement, not a nicety.** If B1 performs like B3, the
correct conclusion is that CharacterOS's advantage is currently indistinguishable from a
well-chosen profile paragraph — which is a publishable, valuable, negative result and must be
allowed to appear.

---

## 12. Existing seams used (no new mechanism)

| Need | Existing instrument | Path |
|---|---|---|
| Genesis / counterfactual subject | `SubjectStateV4GenesisSeedV0`, `materializeSubjectStateV4V0` | `packages/subject-core/src/genesis/subject-state-v4-genesis.ts` |
| Lawful canonical intervention | atomic commit engine + producer authorisation | `packages/subject-core/src/commit/*`, `packages/subject-core/src/commit/engine.ts` |
| Exact restore | `PersistedSubjectEnvelopeV1`, 9 fail-closed stages, v4 chain replay | `packages/subject-core/src/restore/restore.ts`, `restore-v4.ts`, `packages/runtime/src/authority/restore-chain-authority-v4.ts` |
| Durable store image + R2 codec | `captureSessionStoreImageV0`, `encodeSessionStoreImageR2V0` | `packages/runtime/src/session/session-store-image-v0.ts`, `product/sandbox/src/persistence-r2-store-image.ts` |
| Rendered ablation with equivalence proof | `captureFutureProjection(restored, {ablate})`, `verifyAblation` | `research/experiments/durable-life-history-future-behavior-divergence-v0-remeasure/cli.ts:393-430`, `research/experiments/non-memory-state-value-ablation-v0/lib/ablation.mjs` |
| Request identity / byte-diff | `projection_hash`, request-identity hashing, `reattest.json` pattern | `packages/runtime/src/providers/cognition/*`, `.../non-memory-state-value-ablation-v0/reattest.mjs` |
| Live adaptation channels | belief / relationship / affect adaptation wiring | `packages/runtime/src/session/interactive-subject-runtime-v0.ts:683-704` |
| Adaptation kill switch (for `I-FREEZE`) | `CHARACTEROS_DISABLE_ADAPTATION` | `product/sandbox/src/product-configuration.ts:409`, `product-provider-bundle.ts:142` |
| Retrieval confinement | single-retrieval-per-turn invariant + retrieve-count assertion | `product/sandbox/src/query-aware-retrieval.test.ts` (Q2/Q9/Q14 invariant) |
| Credential policy | `MODEL_API_KEY` from environment only, presence-only logging | `product/sandbox/src/` credential handling |
| Verdict discipline | preregistered verdict vocabulary + frozen-precedence runner | `research/experiments/*/contract.ts`, e.g. `belief-causal-confirmatory-stochastic-v1/PREREG.md` |

Marked `REQUIRES NEW MECHANISM — OUT OF SCOPE`: any executed action beyond the deterministic
sandbox executor; any consolidation/forgetting; any personality plasticity. None is used.

---

## 13. Falsification criteria

H1 is **falsified** — and the audit's primary gap closes negative — if any holds:

1. **B ≈ D.** With `MEM` removed from both requests, the lived subject and its genesis twin
   are indistinguishable across the frozen probes at a rate inside the measured same-request
   noise band, in both HR-1 and HR-2 removal, on both the primary and secondary endpoints.
2. **A ≈ C.** The lived state contributes nothing beyond retrieval (the re-run of the
   non-memory ablation's question reproduces `NOT_PROVEN` on a properly powered design).
3. **`I-NONE` moves the endpoint.** The specificity controls fail, so no state-attributable
   claim can be made at all.
4. **`I-FREEZE` moves the endpoint.** The measured difference is not carried by the frozen
   pre-test state.
5. **Baseline camouflage.** `A − B1` and `A − B2` are inside the noise band while `A − B0`
   exceeds it — the advantage is generic self-referential context, not governed state.
6. **Restart erasure.** The differential does not survive `persist → shutdown → restore`.
7. **`EXECUTOR_UNQUALIFIED`.** The state-sensitivity qualification fails. Reported as a
   capability limit of the executor, **never** as a null on H1.

H1 is **supported** only if none of 1–7 holds and §14 is satisfied.

## 14. Success criteria

All thresholds are preregistered before any life episode runs; none may be adjusted after
observing outputs. No claim of statistical significance is made unless the protocol defines
the test and the observed data satisfies it (`RESEARCH_STATE.md` §4.5).

**Primary (mandatory, all of them)**

1. `P(primary endpoint differs | B vs D) ≥ θ_primary` over `N_probe ≥ 12` probes × `r ≥ 5`
   interleaved replicates, where **`θ_primary` is set at freeze time above the upper bound of
   the measured same-request noise band** (not a round number chosen for convenience). The
   observed effect must exceed that band; otherwise the result is `INCONCLUSIVE`, not
   positive.
2. **Sign consistency:** the TRUST subject moves in the pre-registered reliance direction and
   the BETRAYAL subject in the pre-registered caution direction on ≥ ⅔ of the probe families,
   with the NEUTRAL subject's movement strictly between them. A sign-inconsistent positive is
   reported as `INCONCLUSIVE_NO_DIRECTION`.
3. **Specificity:** `I-BEL` moves belief-sensitive probes and leaves affect-sensitive probes
   inside the noise band; `I-AFF` does the converse. A generic "every perturbation moves
   everything" outcome falsifies specificity and caps the result at `E3`.
4. **Durability:** the post-restart B-vs-D differential lies inside the pre-declared tolerance
   of the pre-restart differential, with the restore recorded `EXACT` field-by-field.
5. **Baseline differentiation:** `A − B0` and `A − B1` both exceed the noise band on the
   primary endpoint. If only `A − B0` exceeds it, the result is capped at "better than
   stateless" and **`E6` is not claimed**.
6. **Reporting completeness:** every arm's denominators, every invalid/schema-rejected call,
   every fail-closed turn, the full call ledger per stage, and the token cost are published,
   including preserved invalid runs. Failure semantics: a schema/transport/contract-invalid
   turn makes its arm `INVALID` for the affected probe; it is never silently retried, never
   dropped from the denominator, and never replaced.

**Explicitly not a success criterion**

- "The answers look reasonable", "the replies feel different", "the subject seems more
  cautious", or any human impression without the paired statistics above.
- A single scenario, a single seed, or a single probe family.
- Any result that requires the freed-text judgement of the same model that generated the
  output (the audit's finding E stands: same-provider judging is not independent ground
  truth).

---

## 15. Evidence path, budget, failure semantics, approval

**Evidence path** (follows the repository's frozen-artifact convention):
`research/experiments/history-internalization-v1/`
with `contract.ts` (frozen protocol), `PREREG.md` (hypotheses, thresholds, verdict
vocabulary, decision rule, written before the run), `evidence/run-*/` (raw per-call ledgers
with request identities and hashes), `REPORT.md`, and a conformance test under
`evals/conformance/` that re-verifies the deterministic and persisted-evidence invariants at
zero model calls. Long-run artifacts that the repository intends to be auditable must be
**committed** (the audit's rank-9 gap): per-turn metric rows, probe outcomes and restart
comparison rows — no prompts, no credentials, no raw transcripts.

**Call budget:** declared per arm before the run and enforced by a ledger; a stage that
exceeds its budget stops the run and the shortfall is reported rather than absorbed.
Recommended shape, to be finalised at authorisation:
`3 (or 4 with the ordering arm) × N_life episodes × (appraisal + cognition + language +
adaptation calls)` **plus** `4 cells × N_probe × r` test calls **plus** the qualification and
`I-*` arms. With `N_life = 60`, `N_probe = 12`, `r = 5` the test phase alone is ~240 calls per
cell and the life phase is the dominant cost — which is why the design deliberately makes
**Phase 0 executable without any new life**.

**Phasing — and the audit's recommendation is Phase 0 only.**

| Phase | What runs | Cost | Why it exists |
|---|---|---|---|
| **0 — State-Isolation Differential** | On a **disposable copy of the existing 216-episode subject** plus a genesis twin: cells A/B/C/D over the frozen probe set, with the noise-floor band, the qualification gate and the state-distance gate | Zero new life episodes; bounded test calls; read-only on the canonical store | It can decide the primary question **now**, using an existing non-saturated-if-anything subject, before any new trajectory is funded |
| 1 — Two-trajectory life | TRUST / BETRAYAL / NEUTRAL (+ genesis twins) per §4 | Dominant | Required only if Phase 0 is `INCONCLUSIVE` rather than negative |
| 2 — Intervention + restart | `I-AFF`/`I-BEL`/`I-REL`/`I-NONE`/`I-FREEZE` + the restart arm | Moderate | Converts an association into a causal, identity-bearing result |
| 3 — Baselines | B1 Persona, B2 Summary, B4 retrieval-only, B5 long context | Moderate | The only route to `E6` |

**Phase 0 honesty clause.** The existing subject's state is known to be **saturated**
(belief credence `1.0`, affect activation pinned at `1.000`, one monotone familiarity
counterpart). Phase 0 must therefore publish the state-distance gate result *first*: if
`δ_state` between the lived subject and its twin is below `δ_min` on the target dimension,
Phase 0 returns `INCONCLUSIVE_BY_SATURATION` and **Phase 1 is required** — Phase 0 must not
be reported as a null in that case.

**Approval:** this document authorises nothing. Phase 0 requires its own approval point,
budget and evidence path, per the repository's standing rule that a new experiment enters only
with "具体问题、baseline、falsification rule、call budget、evidence path、failure semantics
与批准点全部明确" (`RESEARCH_STATE.md` §7).

---

## 16. What this experiment will not prove

- Nothing about models, providers, temperatures, prompts or horizons other than those tested.
  A second executor is a **separate authorised slice**, not an extension of this one.
- Nothing about human-like psychology, consciousness, or "real" emotion.
- Nothing about personality plasticity or multi-timescale coupling — those are declared out of
  scope in V1 and reported as absences.
- Nothing about executed behaviour in the world: `CognitionAction` is a canonical no-op and the
  only action executor is a sandbox. The strongest available claim is about **validated
  decision outputs**, and the report must say so in exactly those words.
- Nothing about statistical significance beyond what the preregistered rule actually
  establishes; descriptive counts and rates are reported as such when the rule is not
  satisfied.
