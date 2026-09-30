# NORTH_STAR_EVIDENCE_MATRIX — CharacterOS-Next

Status: AUDIT RECORD (read-only; no core/product/test/frozen-evidence change)
Audit date: 2026-09-20 · HEAD `02b6c46` · branch `main` · clean tree
Companion documents:
`NORTH_STAR_EVIDENCE_AUDIT.md` (narrative), `NORTH_STAR_GAP_ANALYSIS.md` (gaps),
`HISTORY_INTERNALIZATION_TEST_V1_DESIGN.md` (next experiment).

Every path below is relative to `D:\Documents\CharacterOS-Next`. Paths were verified to
exist by direct read; verdict strings were read verbatim from the committed reports.
Where something could not be confirmed, it is marked `UNKNOWN / NOT VERIFIED`.

---

## 0. Evidence-level definitions used

| Level | Meaning |
|---|---|
| `E0 — ABSENT` | No mechanism. |
| `E1 — IMPLEMENTED` | Code exists; no credible experimental validation. |
| `E2 — FUNCTIONALLY_VALIDATED` | Unit/integration tests prove the mechanism runs. |
| `E3 — BEHAVIORALLY_VALIDATED` | A stable association between internal state and behaviour was observed. |
| `E4 — CAUSALLY_VALIDATED` | Intervention / ablation / controlled manipulation established causality. |
| `E5 — LONGITUDINALLY_REPLICATED` | Stable across long trajectories, multiple seeds/scenarios, restarts. |
| `E6 — BASELINE-DIFFERENTIATED` | Independent value demonstrated against Stateless / Persona / Summary / RAG / Long-context baselines. |

Levels are assigned per question and are not averaged. A question can hold two levels
when one leg of it is materially stronger than another; both are named.

Standing facts that bound every row:

- **`E6` is unreachable for every row.** `evals/baselines/README.md` states
  `Status: RESERVED / NOT IMPLEMENTED`; `llm-prompt/`, `fast-ema/`, `characteros-v1/` are
  empty subdirectories. No external baseline exists anywhere. `evals/ablation/`,
  `evals/longitudinal/`, `evals/regression/` are likewise `RESERVED / NOT IMPLEMENTED`.
- **`E5` is unreachable for any behavioural claim.** No experiment uses multiple seeds, and
  every longitudinal subject is a single subject (N=1). `RESEARCH_STATE.md` §4: "当前仓库不
  主张统计显著性、跨模型复现、跨人群外部效度".
- **All real-provider scientific suites are `skipIf`-gated and skipped in CI.** Default
  `pnpm test` runs zero real model calls.

---

## 1. The matrix

| Question | Mechanism | Implementation | Functional | Behavioral | Causal | Longitudinal | Baseline | **Evidence Level** | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| **Q1** Experience Internalization | YES — 4 evidence-bound paths | E1 | E2 | E3 (state values track lived evidence in production) | **E0** | E5 for *existence + persistence* only | E0 | **E2** (+E5 existence / +E0 causal) | High |
| **Q2** Personality Plasticity | YES in core; **DISABLED in product** | E1 (core) / **E0** (product) | E2 (kernel) | E0 | E0 | E0 | E0 | **E2 core / E0 product reality** | High |
| **Q3** Emotion Dynamics | YES — v4 BOUNDED_AFFECT_DYNAMICS_V0 | E1 | E2 | E4 → cognition content; **E0 → behaviour** | E4 (→cognition, 1 model) / E0 (→action) | E5 for *operation*, not for effect | E0 | **E4 (→cognition content) / E0 (→behaviour)** | High |
| **Q4** Memory Consolidation | **NO** | E0 | E0 | E0 | E0 | E0 | E0 | **E0** | High |
| **Q5** Belief Formation | YES — create/ reinforce/ weaken; no abandonment | E1 | E2 | E3 (directional, not authorized) | **E0** (INCONCLUSIVE) | E5 for *update+persist* | E0 | **E2** (+E5 existence / +E0 causal) | Medium-high |
| **Q6** Relationship Dynamics | PARTIAL — 1 monotone scalar only | E1 | E2 | **E0** (NOT_ESTABLISHED) | E0 | E2 | E0 | **E2 mechanism / E0 behavioural causality** | High |
| **Q7** Behavioral Causality | PARTIAL — no action endpoint | E1 | E2 | E4 → cognition content | **E0** state→decision→behaviour | E0 | E0 | **E4 (state→cognition content) / E0 (full chain)** | High |
| **Q8** Multi-timescale Dynamics | Heterogeneous rates; **no coupling (forbidden by law)**; SLOW layer inert | E1 | E2 | E0 | E0 | E0 | E0 | **E2 structural / E0 as an integrated system** | High |
| **Q9** Path Dependence | **NO** life-order test; affect-law property only | E1 (law) | E2 (law, 0 calls) | E0 | E0 | E0 | E0 | **E0** (life) / **E2** (affect-law property) | High |
| **Q10** Persistent Identity | YES — exact restore chain | E1 | E2 | E5 (restart exactness, real long-run) | E2 (rollback rejection) | E5 | E0 | **E2 mechanically + E5 real-restart observed / E0 across executor swap** | High |

---

## 2. Per-question evidence detail

### Q1 — Experience Internalization

**Claim audited:** experience becomes persistent internal state, without re-reading raw
history, and is present after restart.

**Mechanism / implementation**

- Experience record: `packages/memory/src/records/experience-record.ts` —
  `ExperienceRecordV0`, closed kind `EXPERIENCE_KIND_BEHAVIOR_OUTCOME`, header law
  "FACTS ONLY … NO approval, NO rejection label, NO sentiment, NO reward, NO trust, NO
  success/confidence semantics of any kind".
- **Storage-only path** (does *not* internalize):
  `packages/runtime/src/transitions/learning/learning-transition-executor.ts` encodes one
  `EpisodicMemoryRecordV0` and commits exactly one delta,
  `{ path: "/memory_state/repository_revision", value: … }`. Semantic state untouched.
- **Internalization paths** (each consumes committed episodes as evidence and commits
  canonical state):
  - Belief — `packages/runtime/src/transitions/belief/belief-adaptation-workflow.ts` →
    `belief-plasticity-producer.ts` → `/beliefs` credence update.
  - Personality — `packages/personality/src/personality-adaptation-wiring-v0.ts` →
    `PersonalityTransitionExecutor` → `/personality`.
  - Relationship familiarity —
    `packages/runtime/src/transitions/relationship/relationship-interaction-familiarity-ingestion.ts`
    → `/relationships` (+1/32 per admitted receipt).
  - Affect — `.../affect-application/affect-application-executor-v0.ts` applies an impulse
    from a committed Appraisal of a factual event. **Event-driven, not episode-driven.**
- Wiring into the production session: `packages/runtime/src/session/interactive-subject-runtime-v0.ts:683`
  (`runLivedEvidenceBeliefAdaptation`), `:694` (`runLivedEvidencePersonalityAdaptation`),
  `:700` (`runLivedEvidenceRelationshipFamiliarity`).

**Tests / experiments / artifacts**

- `packages/runtime/src/transitions/belief/belief-adaptation-e2e-proof.test.ts` —
  "verified episode → CONTRADICTS → frozen plasticity 0.60 → 0.5499999999999999 →
  exactly one canonical commit".
- `packages/runtime/src/transitions/relationship/relationship-adaptation-e2e-proof.test.ts`.
- `packages/personality/src/personality-adaptation-wiring-v0.test.ts` — "accumulates
  distinct historical episodes, commits at ≥3 members, and does not replay".
- `packages/runtime/src/session/interactive-belief-adaptation.test.ts` — "lived evidence
  reaches the frozen plasticity chain and changes canonical belief through authority".
- Real production evidence (human-run, machine-local, **not committed**):
  `CURRENT_STATE.md` §5 records Alice's belief credence `0.55 → 0.70 → 0.80 → 0.95 → 1.0`
  through lawful ±0.05 steps with a stable proposition identity, classified by a real
  model, across ≥216 episodes and dozens of fresh restarts.

**Command used** (read-only inspection): `pnpm verify` executed the whole gate;
the suites above ran inside it. No experiment CLI was re-run.

**Key metrics:** `BELIEF_PLASTICITY_STEP = 0.05`; familiarity `1/32` per admitted receipt,
saturating at `32/32`, "No downward transition"; personality `max_step 0.05`,
eligibility `{minMemberCount: 3, minTotalActivation: 1.5}`.

**Known limitations**

- Internalization **existence and persistence** are established (E5-shaped). Internalization
  **consequence** is not: no experiment shows the internalized state (as opposed to
  retrieved text) causing cognition or behaviour. Graded E2, not E3+, because the E3 leg
  rests on production observation without a controlled comparison.
- `experience-encoder-v0.ts` sets `affect_snapshot_ref: null` — "no committed V0 source
  exists — fixed null, never invented". Affective traces are not internalized as memory
  content.
- Belief/personality/relationship paths are DISABLED when no semantic provider is injected
  ("Null disables personality adaptation entirely"). Two of the three are ON by default in
  the product; personality is not (see Q2).

---

### Q2 — Personality Plasticity

**Claim audited:** personality is a slow, accumulating, path-dependent plasticity — not a
static config.

**Mechanism / implementation**

- Static registry: `packages/runtime/src/transitions/personality/personality-dimension-registry-v0.ts`
  (agreeableness, conscientiousness, extraversion, openness; `plasticity_admissible: true`;
  no default values, no 0.5 fallback).
- Kernel: `packages/personality/src/personality-plasticity-producer.ts`
  `step = min(max_step, round4(evidence_scale × mean_activation))`,
  `next = clamp(current ± step, 0, 1)`,
  `ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY = { eligibility_policy: {minMemberCount: 3,
  minTotalActivation: 1.5, minLogicalSpan: 0}, max_step: 0.05, evidence_scale: 1 }`.
  Direction is an explicit host `INCREASE | DECREASE`; one dimension per invocation;
  write-once evidence-set ledger (`personality-adaptation-store-v0.ts`).
- Init: `packages/personality/.../personality-init.ts` —
  `initializeEmptyPersonalityState()` returns `{ dimensions: [] }` and is described as
  "Empty registered container: the legal V0 default (no dimensions registered)".
  `initializePersonalityFromTraitsSeed` maps `traits_seed` → dimensions **only when a
  caller explicitly requests it**.

**Decisive product finding**

`product/sandbox/src/product-provider-bundle.ts:192-195`:

```
turnPlan: {
  belief_adaptation_enabled: !adaptationDisabled,
  relationship_adaptation_enabled: !adaptationDisabled,
  personality_adaptation_enabled: false
}
```

`false` is a **literal, unconditional** — `adaptationDisabled` only derives from
`CHARACTEROS_DISABLE_ADAPTATION` (`resolveFlagSettingV0`, default `false`). So belief and
relationship adaptation are ON by default while personality adaptation is OFF always.

Additionally `personality_genesis_prior` is optional
(`product/sandbox/src/interactive-subject-host.ts:65`) and is supplied **only by tests**
(`longitudinal-integrated-trajectory.test.ts:381`, `personality-genesis-prior.test.ts`);
no product entry point (`cli.ts`, `product-runtime.ts`) supplies it. With an empty
container the wiring states "an empty Personality fails closed: no dimensions are ever
created".

`packages/runtime/src/session/explicit-v4-session-authority-v0.ts:1748`:

```ts
async runLivedEvidencePersonalityAdaptation(episodeRefs) {
  if (this.personalityAdaptation === null) { return { status: "DISABLED" }; }
  ...
}
```

No `personalitySemanticProvider` / `PersonalitySemanticChannel` is accepted by the session
options at all (repo-wide search over `packages/runtime/src` returns nothing outside tests).

**Empirical confirmation:** every long-run leg records "personality 仍未 acquire（合法）"
(persistent, stable, no acquired dimension) across 216 episodes.

**Experiments**

- `research/experiments/personality-behavioral-differentiation-real-provider-v0/` —
  `LEVEL_6_NOT_DEMONSTRATED`; all 3 scenarios `DIFFERENCE_NOT_CLEARLY_PERSONALITY_RELATED`;
  6 calls; no evidence directory.
- `.../v1/` — `LEVEL_6_NOT_DEMONSTRATED`; the one mechanical flag was adjudicated an
  abstention artifact; 6 calls, 0 retries, 5 files total.

**Known limitations**

- No inertia, no thresholds beyond the eligibility gate, no recovery, no repeated-experience
  sensitivity, no individual differences. Update is a bounded fixed step per eligible set.
- Both real-provider differentiation experiments are N=3 scenarios / 6 calls in each
  version — far too small for either a positive or a negative reading. For the North Star
  question ("does a single ordinary event violently change personality?"), the answer is
  architectural: it cannot, because the step is `≤ 0.05` and requires 3 members with
  activation ≥1.5; but the question "does personality ever move at all in reality?" is
  answered negatively *by construction*, not by measurement.

---

### Q3 — Emotion Dynamics

**Claim audited:** an event → appraisal → affect dynamics → current affect → cognition /
behaviour → consequence loop, with inertia, recovery, accumulation, sensitisation,
emotional traces, individual appraisal differences, and affect→behaviour causality.

**Mechanism / implementation**

- Production law v4: `packages/affect/src/bounded-affect-dynamics-v0.ts`, header verbatim:
  ```
  q   = relevance * intensity
  u_v = 0.25 * q * (2*goal_congruence - 1)
  u_a = 0.10 * q
  event:  x_after = clamp(x_before + u)   — retains current state
  time:   x(t+dt) = b + (x(t)-b) * exp(-dt/150), b = (0, 0.2)
  ```
- Legacy law v3: `packages/runtime/src/producers/reference-fast-ema-affect-producer.ts`
  (`tHold 60`, `alpha 0.06`, `tau 150`, `clamp 0.25`); mood exists only in v3 and was
  REMOVED in v4.
- State: `SubjectStateV4.affect = CanonicalAffectV0 (valence ∈ [-1,1], activation ∈ [0,1])`;
  `mechanism_config` pairs v3↔FAST_EMA and v4↔BOUNDED_AFFECT_DYNAMICS_V0, "Invalid pairings
  fail closed".
- Traces: none. `experience-encoder-v0.ts` → `affect_snapshot_ref: null` (fixed).

**What is present:** explicit accumulation across events; exponential recovery; boundedness
(clamp + baseline).
**What is absent:** inertia as a distinct term; sensitisation / desensitisation;
expectation / anticipation; per-subject appraisal-difference learning (appraisal is
content-sensitive but the *dynamics constants* are frozen and identical for every subject).

**Experiments (real provider)**

| Directory | Verdict (verbatim) | Design | N |
|---|---|---|---|
| `canonical-affect-behavior-influence-v0` | `CANONICAL_AFFECT_CAUSAL_INFLUENCE_SUPPORTED` | ±0.25 valence, equal activation, 4 arms, ablation neutral (0, 0.2), byte-identical inputs | 200 attempted / 190 valid / 40 four-arm units |
| `canonical-affect-behavior-influence-v1` | `CANONICAL_AFFECT_CAUSAL_INFLUENCE_REPLICATED`; Q3 `NOT_DETECTED_BEYOND_COGNITION_CONTENT`; Q4 `SECOND_MODEL_UNAVAILABLE` | ±0.125 / ±0.25 × 8 scenarios × 4 matched arms × 5 trials | **320/320 valid** |
| `canonical-affect-communication-directive-causal-v0` | `CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_INPUT_EFFECT_ONLY` | ±0.25 → directive kind | 120 cognition calls / 25 four-arm units |
| `canonical-affect-downstream-language-behavior-causal-v0` | `CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_INPUT_EFFECT_ONLY` | ±0.25 → intent → V2 language text | 120 cognition + 75 language / 25 units |
| `canonical-affect-action-selection-sensitivity-v0` | `ACTION_SELECTION_SENSITIVITY_INCONCLUSIVE` | ±0.25 → action_intent tuple, 2 action orders | run-2 160/160 valid |
| `...-repair-v0` | `ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED` | repaired design, same endpoint | 160/160 |

**Experiments (deterministic, 0 model calls)**

- `affect-state-retention-e1` — 10 sequences; gates G1–G9; retention/accumulation/**path
  dependence** gates G5–G7 PASS; restore `max_abs_error = 0` at 1e-12.
- `affect-activation-mapping-e2a` — `ACTIVATION_GAIN_REDUCTION_SUPPORTED`; 108/108 accounting.
- `affect-production-shaped-e2` — `SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK` (G12 FAIL);
  232 lifetimes / 170,496 events / 1030 of 1030 checks.

**Command used:** `pnpm verify` ran the four conformance suites that re-execute the
deterministic phases in-process (`evals/conformance/affect-*.test.ts`,
`canonical-affect-*.test.ts`). The real-provider CLIs were not re-run.

**Key metrics:** v0 — `40/40` treatment pairs disagreed, `0/50` ablation pairs disagreed;
`action_intent` differences **0/40**. v1 — `action_intent` differences **0/80**.
Downstream language: `60 %` exact `CharacterLanguageBehaviorV0` text disagreement vs `4 %`
ablation (56 pp), intent disagreement `100 %`, directive `0 %`.

**Known limitations**

- **The strongest causal result in the repository is about *cognition content*, not
  behaviour.** The directory names say "behavior-influence"; v1 itself reports Q3 as
  `NOT_DETECTED_BEYOND_COGNITION_CONTENT` and both reports state there is no action
  difference.
- One model (`qwen3.5:9b`), one provider, two magnitudes. No activation contrast, no
  emotion-specific claim, no monotonicity claim, no generality claim.
- Real long-run observation shows the affect state is **saturated**: 19 consecutive
  completed turns with activation exactly `1.000`; valence drifting `0.73 → 0.8971 →
  0.9934`. Classified `PERSISTENT_BOUND_SATURATION_CANDIDATE` then adjudicated `HEALTHY`
  (intermediate recovery genuinely occurs — `1 → 0.9976844 → 1`) because 85 % of
  appraisals sit above the 1-tick break-even `q* ≈ 0.0532`. **Consequence: the fast layer
  has very little room left to vary in the real subject; a future state-contrast experiment
  cannot rely on it carrying much signal.**

---

### Q4 — Memory Consolidation

**Claim audited:** episodic experience becomes semantic knowledge / belief / relationship /
affective trace / habits / preferences / goals / personality influence through a
consolidation process.

**Finding: `E0 — ABSENT`.**

- `packages/subject-core/src/types/subject-state.ts` declares
  `MemoryStateV0.consolidation_cursor: LogicalTimeV0 | null`, and
  `packages/subject-core/src/types/transition.ts` allows
  `/memory_state/consolidation_cursor` as a transition path. **No producer or executor
  anywhere writes it** (repo-wide search: only type declarations and tests).
- `packages/runtime/src/transitions/learning/learning-transition-executor.test.ts`
  explicitly asserts `next.memory_state.consolidation_cursor` **equals the seed snapshot
  value (unchanged)**.
- `packages/memory/src/repository/in-memory-memory-repository.ts`:
  "no embedding, no retrieval/search/ranking, no consolidation".
- `packages/memory/src/conformance.test.ts`: "NO consolidation/auto-encoding".
- No semantic-memory record, store, or abstraction process exists in `packages/memory`.
  Its retrieval is lexical + ref-overlap only.
- There is no offline / sleep / replay pass anywhere.
- Never-written persistent fields (dead surface): `active_episode_refs`,
  `pending_encoding_refs`, `autobiographical_index_revision`, `lifecycle_metadata`,
  `consolidation_cursor`.

**Narrow partial credit (not consolidation):** belief **proposition admission** converts an
episode into a canonical proposition. `belief-proposition-admission.ts` — "model/provider →
semantic proposal only: `NEW_PROPOSITION_CANDIDATE` + `proposed_label`. HOST → evidence
admission, proposition identity, canonical label, initial numeric state". This is a
single-step, LLM-gated, one-proposition-per-invocation path — it does not generalise over
multiple episodes, does not abstract, does not count evidence, and has no decay. It is
graded `E1` at most, and it is already accounted for under Q5.

**Recall vs internalization (the required distinction):**

| | Recall | Internalization |
|---|---|---|
| Where it lives | `packages/memory/src/retrieval/*`, `repository-backed-retrieval-service.ts` | the four adaptation paths of Q1 |
| Mechanism | store → rank → render retrieved text into the request | episode → evidence gate → canonical numeric delta |
| Evidence level | `E2` mechanically; real success observed (recall 3/3 live, 2/2 natural long-run) | `E2` (+E5 existence) |
| Does it require re-reading history? | **YES — by definition; top-K = 8 episodes read per turn** | no |

**Known limitations:** with consolidation absent, there is no mechanism by which 216 lived
episodes could become anything other than 216 retrievable episodes plus a handful of
scalars. "What is forgotten" has no answer: nothing is forgotten; no decay, no salience
revision (`ENCODING_DECLARED_V0` — "salience … frozen at encoding time; retrieval may read,
never rewrite").

---

### Q5 — Belief Formation

**Claim audited:** experience → evidence accumulation → belief creation → reinforcement →
weakening → revision → abandonment, persisted, bounded, interpretable, causally used.

**Mechanism / implementation**

- Creation: `packages/runtime/src/transitions/belief/belief-proposition-admission.ts` —
  `BELIEF_PROPOSITION_STANCE_ZERO_CREDENCE = 0.5`,
  `BELIEF_PROPOSITION_FIRST_CREDENCE = 0.55` ("stance-zero point … plus the frozen
  `BELIEF_PLASTICITY_STEP`"); host-derived content-addressed proposition key; exact
  duplicate labels route to the existing proposition; "near duplicates = OUT OF SCOPE V0".
- Update: `.../belief-plasticity-producer.ts` —
  `EXISTING_PROPOSITION + SUPPORTS → next = clamp(current + 0.05, 0, 1)`,
  `CONTRADICTS → clamp(current - 0.05, 0, 1)`; saturation → explicit `NO_CHANGE / SATURATED`;
  "NO evidence-count scaling, NO inertia, NO cross-domain modulation".
- Persisted: `/beliefs`.
- Read surface: rendered into cognition as
  `[SUBJECTIVE BELIEF STANCES — read-only subject state; … credence is subject endorsement
  strength, NOT world truth; proposition IDs are STATE LOCATORS ONLY, never refs]`, marked
  `STATE_VISIBLE_NOT_CITEABLE`.
- Decision consumer: `belief-decision-integration-policy.ts` (`stance(c) = 2c - 1`) and
  `belief-decision-arbitration-policy.ts` (`UNIQUE_POSITIVE_MAX`) exist and are tested, but
  their own headers say "No action execution, no execution runner integration, no
  production switchover". **The decision consumer is unwired.**

**Causal experiment (the required scrutiny)**

`research/experiments/belief-causal-validation-v0/` — real DeepSeek, 104 scenes, 150
requests, 100/104 host-valid; manipulation = durable credence `0.45` vs `0.65`, plus a
removal cell C and a low-durable-but-presented-high cell D; measured
`communication_directive.kind`.

- Verdict: **`BELIEF_CAUSAL_RESULT_INCONCLUSIVE`**.
- Controls that are real: byte-identical B-vs-D live inputs proven per replicate;
  fresh-process authoritative restore per scene; full invalid-scene ledger preserved.
- Explicit blockers: cell C3 (B vs D) "is not a null and cannot be one because the model
  flips 30–40 % of the time at temperature 0", far above the ≤1/10 tolerance; C2/C4 miss
  paired thresholds; 1/100 classifier false positive.
- Aggregate direction supports the mediator story (A 0.23 vs B 0.68 REALIZE; C 0.08;
  D 0.76) but the preregistered verdict is not authorized.
- **It does not prove production decision influence, truth tracking, or generalisation.**

`research/experiments/belief-causal-confirmatory-stochastic-v1/` — the successor designed to
sit above that noise floor (n=200/cell/phase, 50 calibration draws). State:
**preregistered and prechecked only.** `PREREG.md`: "Model calls in this preregistration
slice: 0". `CURRENT_STATE.md` §5: `BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 = PAUSED`,
`PRIMARY_AUTHORIZED = FALSE`, calibration readiness not met
(`FORMAL_INVALID_TRIALS = [43, 44, 49]`), and the exact failing validation rule is
`UNKNOWN / NOT_PERSISTED` → `CALIBRATION_FAILURE_ROOT_CAUSE = NOT_IDENTIFIED`.
**Do not cite this as belief evidence.**

`research/experiments/belief-change-lived-evidence-v0/` — **aborted**. `history-a.json`
(842 KB) exists; `history-b.json` records `TURN_FAILED_CLOSED` on an appraisal schema error;
`summary.json` has `"commonB": null`. No contract, no report, no verdict. Dead evidence.

**Real production evidence:** Alice's belief credence `0.55 → 0.70 → 0.80 → 0.95 → 1.0`
(one proposition, stable identity, real model classification, lawful ±0.05, across restarts).

**Known limitations**

- **Saturated at the ceiling.** Credence reached `1.0`; no further dynamics are possible in
  the current subject. This is a live obstacle to any future state-contrast experiment.
- No abandonment / retraction / forgetting: `BeliefMutationProposalV0` supports UPDATE and
  INSERT only.
- "Revision" and "weakening" are the same symmetric step as reinforcement; there is no
  evidence-count scaling, so 1 contradicting episode and 50 contradicting episodes have
  identical effect.

---

### Q6 — Relationship Dynamics

**Claim audited:** shared experience produces trust, familiarity, expectations,
attachment/avoidance, relationship-specific state; the same event against different people
produces different relationship state; the state affects later decisions.

**Mechanism / implementation**

- State shape: `RelationshipStateV0` is a generic "registered container" (counterpart →
  dimensions) in `packages/subject-core/src/types/subject-state.ts`.
- **Exactly one governed feature exists: interaction familiarity.**
  `packages/runtime/src/transitions/relationship/relationship-interaction-familiarity-accrual-policy.ts`
  — "First lawful credited interaction: ABSENT → 1/32; Subsequent lawful updates: k/32 →
  (k+1)/32 … Saturation: |R| >= 32 → NO_PROPOSAL", "No downward transition. No equal-value
  update.", and "monotonic non-decreasing — … decay, forgetting and retrieval failure are
  NOT familiarity decrements".
- **Explicit disclaimers** in `relationship-feature-decision-semantics.ts`: the feature
  "is NOT trust, liking, affinity, safety, intimacy, dependence, loyalty, relationship
  quality"; trust is a rejected/deferred dimension. `personality-dimension-registry-v0.ts`
  contains the comment "trust / attachment (counterpart-specific → RELATIONSHIP)" with no
  implementation behind it.
- A generic bounded ±0.05 `relationship-plasticity-producer.ts` +
  `relationship-adaptation-workflow.ts` exists and is e2e-tested, but is **not wired into
  the interactive session** (the session wires only familiarity ingestion).
- **Per-person differentiation is structurally untestable in the product:** the session uses
  one counterpart, `SESSION_COUNTERPART_REF_V0`.

**What is demonstrated (deterministically, zero model calls)**

The familiarity → retrieval-strategy → context-availability leg is machine-proven:
`relationship-interaction-familiarity-cognition-influence.ts` selects
`COUNTERPART_CONTEXT_SEARCH_FIRST` at credited level ≥ 2 else `BASIC_CONTEXT_FIRST`; the
conformance suites (`relationship-familiarity-causal-completion-v0.test.ts`,
`search-first-causal-v0.test.ts`) re-verify the governed writer/commit chain with zero model
calls. This is genuine causal plumbing.

**What is NOT demonstrated — eight experiment directories:**

| Directory | Verdict (verbatim) |
|---|---|
| `familiarity-causal-behavior-v0` | `INVALID_EXPERIMENT` (arm A produced 0 classified outcomes, `complete=false`) |
| `familiarity-causal-behavior-v1` | `SAFETY_GROUNDING_FAIL`, `complete: false`, paired directional 0, **3 `UNSUPPORTED_SHARED_CONTEXT` claims in the low-history arm** |
| `relationship-familiarity-behavior-real-provider-v0` | `RELATIONSHIP_FAMILIARITY_REAL_PROVIDER_BEHAVIOR_INCOMPLETE` (2/16 arms schema-failed; blinded evaluator tracked presentation position) |
| `relationship-familiarity-causal-completion-v0` | `RELATIONSHIP_FAMILIARITY_BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED` (paired directional 0/8, ablation directional 0) |
| `relationship-familiarity-search-first-causal-v0` | `RELATIONSHIP_FAMILIARITY_REVALIDATION_INCONCLUSIVE` (14/48 invalid); post-hoc: the frozen class rule "could not discriminate the conditions by construction" |
| `relationship-familiarity-history-causal-v0` | `FAMILIARITY_EFFECT_INCONCLUSIVE` in all three executions (primary S1 cell 0/4 host-valid) |
| `familiarity-context-mediation-replication-v1` | `FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE` (host-valid 0.850 < 0.900 gate; gate not relaxed) |
| `relationship-familiarity-context-mediation-final-replication-v2` | `FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED` (all contrasts 0/10 despite 104/104 host-valid) |

**The decisive decomposition** is `relationship-familiarity-history-causal-v0`'s secondary
S2: `A↔B 3/3` (three separate executions), `B↔C 3/3`, `C↔D 0/4`, `A↔D 0/4`, `A↔E 0/4`, and
critically **`A↔F 4/4` and `B↔F 0/3`** — where F is the full-corpus control. Behaviour tracks
**context availability**, not the familiarity scalar. This is the strongest causal
decomposition in the family; at verdict level it remains INCONCLUSIVE and is not
conformance-guarded.

**Executor dependence:** the context→behaviour leg is executor-dependent — `0/10` local
`qwen3.5:9b` vs `10/10` API `deepseek-flash` in `executor-model-substitution-matched-v1`.

**Known limitations:** trust/attachment/expectations do not exist, so "relationship
structure" is absent; one monotone scalar saturating at 32 credits; one counterpart; and the
behavioural leg is either null or executor-limited.

---

### Q7 — Behavioral Causality (highest-attention item)

**Claim audited:** state → cognition → decision → behaviour, established by intervention,
ablation, state manipulation, controlled trajectories, counterfactual comparison.

**What is causally established**

| Design | Intervention | Endpoint | Result |
|---|---|---|---|
| `canonical-affect-behavior-influence-v1` | ±0.125 / ±0.25 valence, activation matched, 4 arms, ablations | structured cognition fields | `REPLICATED`, 320/320, ablations 0 |
| `canonical-affect-behavior-influence-v0` | ±0.25 valence, byte-identical inputs | structured cognition fields | `SUPPORTED`, 40/40 treatment vs 0/50 ablation |
| `durable-life-history-…-remeasure` | two lived histories A/B × memory-outcome-evidence removal at the provider seam | `current_intent` + realized language text | `FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY`, 5/5 units |
| `non-memory-state-value-ablation-v0` | remove all non-Memory sections (B) / affect line only (C) / same-request repeat (R) / counterfactual affect swap (X) | cognition + realized language | `NON_MEMORY_STATE_EFFECT_UNSTABLE_OR_MODEL_VARIANCE_DOMINATED` |
| `executor-model-substitution-matched-v1` | executor swap under one portable contract | context mediation criteria | `EXECUTOR_CAPABILITY_DEPENDENCE_OBSERVED` |
| `belief-causal-validation-v0` | credence 0.45 vs 0.65, removal, equalized presentation | `communication_directive.kind` | `BELIEF_CAUSAL_RESULT_INCONCLUSIVE` |
| `lived-history-differentiation.test.ts` | two counterfactual histories of the SAME genesis, restored | cognition request bytes | levels 1/2/4 proven — **with deterministic fake providers** |

**The single most important number in this audit**

`durable-life-history-future-behavior-divergence-v0-remeasure` primary metrics:

```
treatment_pair_disagreement:      100pp
ablation_pair_disagreement:        20pp
treatment_directive_disagreement:   0pp
behavior delta (treatment − ablation): 80pp
intent delta (treatment − ablation):    0pp
future affect residual valence delta: 0.000022699964881242424
gates: {ablation_pair_body_equal_except_affect: true, ablation_target_evidence_absent: true, ...}
```

Reading: with the memory evidence present, the two lives produce different realized
behaviour text in 100 % of units; with the memory evidence removed, only 20 % still differ —
and the only remaining difference between the two lives is canonical affect at a magnitude
of **2.27e-05**, i.e. numerically negligible. **80 of the 100 percentage points are the
retrieved memory text.** Meanwhile the structured intent ("what the subject decided to do")
moved **0 pp** — so the divergence surfaced in the *wording*, not the decision.

**CORRELATION vs CAUSAL, explicitly**

- `state → cognition content`: **CAUSAL** (E4). Genuine intervention + matched ablation +
  byte-diff verification + balanced arm order + restore controls, replicated.
- `state → decision / action selection`: **NOT CAUSAL — null.** `action_intent` differences
  are `0/40` (v0), `0/80` (v1); the dedicated action-selection family ends
  `ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED` with ablation `0` and
  order-invariant scenarios `0`.
- `state → directive / delivered behaviour`: **INPUT_EFFECT_ONLY** — directive disagreement
  `0.167` overall (`0.25` in 1 of 4 boundary scenarios, hard controls 0); downstream language
  text disagreement 60 % vs 4 % ablation; the frozen label is
  `CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_INPUT_EFFECT_ONLY`.
- `history → future behaviour`: **PARTIAL, small-N, and dominated by the retrieval channel**
  (5 units, 1 scenario, 80 pp of 100 pp ablation-explained).
- `internalized non-memory state → behaviour, beyond Memory`: **`NOT_PROVEN`**
  (the repository's own phrase) with its own recommendation `Should CharacterOS Core
  Continue Expanding? NO`.

**Structural ceiling on behavioural causality**

`CognitionAction` is a canonical **zero-delta durable NO_OP** — "NO_ACTION and ActionIntent
are both legal, both leave canonical state byte-unchanged". `ActionIntentV0` is "a REQUEST
for a future execution layer". The only `ActionExecutorV0` implementation is a deterministic
sandbox world. Therefore even a perfectly successful state→`action_intent` effect would not
currently reach an executed action in the product: the action/decision endpoint is
architecturally unused. Any future North Star experiment must choose a *measurable* decision
proxy (validated directive kind, action_intent selection among host-legal actions, or an
explicit research action executor) and state that choice up front.

**Known limitations:** one model for every affect result; N=1 per (scenario, condition) for
the non-memory ablation with repeats on only 2 scenarios; the decisive history experiment is
5 units; no evaluation by an independent or human judge anywhere.

---

### Q8 — Multi-timescale Dynamics

**Claim audited:** FAST (affect) / MEDIUM (belief, relationship, habits, preferences) / SLOW
(personality), with different update speeds, coupling, stabilising mechanisms, and no
simultaneous violent change of everything.

**What genuinely exists — heterogeneous frozen update laws, per domain:**

| Layer | Intended role | Law | Time argument |
|---|---|---|---|
| Affect (v4) | FAST | `x_after = clamp(x_before + u)`; `x(t+dt) = b + (x(t)-b)*exp(-dt/150)` | explicit `dt`, `tau = 150` |
| Affect (v3) | FAST + mood | `intensity *= exp(-release_ticks/tau)` (`tau 150`, hold 60); `mood += alpha*(fast - mood)`, `alpha 0.06`, `clamp 0.25` | explicit ticks |
| Belief | MEDIUM | `next = clamp(current ± 0.05, 0, 1)` per evidence event | **no time argument at all** |
| Relationship familiarity | MEDIUM | one `k/32` credit per admitted receipt, monotone, saturating at 32 | **no time argument** |
| Personality | SLOW | `step = min(0.05, round4(1 × mean_activation))` per eligible evidence set | **no time argument; and disabled in product** |
| Memory influence | — | `value × exp(-rate × age)`, `baseDecayRate = 0.03` per logical tick | explicit age |

**Coupling: forbidden by law, not merely absent.** Belief: "NO cross-domain modulation".
Personality and relationship carry isolation tests (`personality-cognition-isolation.test.ts`,
`relationship-cognition-isolation.test.ts`). Relationship/personality headers assert "no
cross-domain arithmetic".

**Stabilising mechanisms:** present per domain — clamp in affect; clamp + saturation in
belief; monotone cap in familiarity; clamp + eligibility in personality.
**Scheduler:** none beyond the logical clock and the `Time` transition.

**Empirical reality (this is the part a reader must not infer from the table):** the system
does not exhibit visibly layered multi-timescale dynamics. It exhibits **saturation**:

- affect activation: `1.000` on 19 consecutive completed turns and on `50/50` end-of-turn
  readings (`activation_after_time` intermediate values are `NOT_AVAILABLE`, not persisted);
- belief credence: reached the ceiling `1.0`;
- relationship familiarity: single monotone counterpart;
- personality: never moves;
- regulation: `energy_next = energy_current`, i.e. byte-exact zero dynamics.

So FAST saturates, MEDIUM saturates, and SLOW does not exist.

**Grading:** `E2` structurally (distinct laws exist, are unit-verified, and are enforced
uncoupled) / **`E0` as an integrated multi-timescale system** (no coupling, no shared time
argument across layers, SLOW layer inoperative).

**Known limitations:** "different variables exist" is explicitly *not* accepted here as
evidence of multi-timescale dynamics. Three of the four live layers have no time argument in
their update law at all — they are event-counted, not time-scaled. A claim of layered
timescales would need at least: a shared time base, non-degenerate state ranges, and an
observation that the layers move on measurably different horizons.

---

### Q9 — Path Dependence

**Claim audited:** the same event set in different orders (A→B→C vs C→B→A), or different
early lives under a shared later environment, yields a different final subject.

**Finding: `E0 — ABSENT` for life trajectories.**

Searches performed: repo-wide grep for `path.depend`, `order.effect`, `ORDER_REVERS`,
`counterfactual order`, `permutation` over `research/experiments/**`; and a scan of every
experiment `contract.ts` for order/permutation designs. The only hits are:

- `affect-state-retention-e1` — path dependence of the **equations**: gates G5–G7 PASS,
  e.g. `B3 post-event == pre+u exactly (-0.2371013970063236)` vs
  `B3_RESET post-event == clamp(b+u) (-0.05)`, retention difference `0.1871013970063236`;
  and `G7` end-of-recovery `|dv| = 0.0000775395598828` vs `B3_RESET post-common |dv| = 0`.
  Synthetic fixed corpus, **0 model calls**, tolerance 1e-12. This proves the *retention
  law* is path-dependent. It says nothing about a life.
- `affect-production-shaped-e2`, `affect-activation-mapping-e2a` — the same family.
- `canonical-affect-action-selection-sensitivity-v0` — "order" there means **presentation
  order of two candidate actions** inside one turn, not life order. Its own finding is that
  first-position bias is a confound (`R2`: 87.5 % vs 43.75 %).
- `packages/runtime/src/authority/relationship-governed-forked-history.test.ts` — a forked
  relationship history exists as a **test fixture** (7 tests). It forks one governed
  relationship write, not a life.

The nearest real-provider evidence is `durable-life-history-…-remeasure`: two histories
(A = goal-congruent life, B = goal-incongruent life). That is a **content** difference, not
an **order** difference, and its effect is 80 % explained by retrieved memory text.

**What a real Q9 experiment would require (and none exists):** the same multiset of episodes
delivered in two different orders, with the same total exposure, then history removed at
test time and the resulting internalized states compared. Not designed, not preregistered,
not run.

**Grading:** `E0` (life-trajectory path dependence) / `E2` (affect-law path-dependence
property, deterministic).

---

### Q10 — Persistent Identity

**Claim audited:** identity survives process restart, persistence restore, model restart,
executor swap, time, and device/runtime boundary; state semantics survive an LLM swap; the
executor is genuinely replaceable.

**Process restart / restore — the strongest pillar in the repository (`E2` mechanically,
`E5`-shaped from real operation).**

- `packages/subject-core/src/types/persistence.ts` — `PersistedSubjectEnvelopeV1`
  ("the only accepted restore input").
- `packages/subject-core/src/restore/restore.ts` — 9 fail-closed stages,
  "EXACT RECONSTRUCTION ONLY … no defaults, no reset, no repair, no migration"; revision > 0
  requires commit-chain proof.
- `packages/subject-core/src/restore/restore-v4.ts` +
  `packages/runtime/src/authority/restore-chain-authority-v4.ts` — "Positive revisions are
  admitted only through the opaque explicit-v4 genesis boundary plus the complete V2 history
  replayed by the shared chain validator".
- `packages/subject-core/src/canonical/json.ts` — `canonical-json-v1` (RFC 8785 JCS,
  recursive key sort), which is why value-level equality implies hash equality.
- `packages/runtime/src/session/session-store-image-v0.ts` — repository revisions (manifests
  + payloads) + committed bundles; reconstruction "must reproduce revision ids exactly or
  fail closed".
- Real restart exercised by: `product/sandbox/src/long-run-checkpoint.test.ts` `restart()`
  (fresh `createProductRuntimeV0`, requires `origin === "RESTORED"`, classifies
  `EXACT`/`MISMATCH`/`RESTORED_UNVERIFIED`, compares `state_revision`, `repository_revision`,
  `shared_revision`, `episodes`, `pending_behavior_outcome`, `affect`, `beliefs`,
  `relationships`, `personality`);
  `product/sandbox/src/interactive-subject.test.ts:232` ("§43-equivalent file restart: new
  host restores same subject and retrieves pre-restart Memory":
  `SUBJECT_RESTORED`, same repository revision, next turn retrieves working episode refs,
  prior deferred outcome committed, no transcript bypass);
  `environment-continuity.test.ts:186` LEVEL 3; `cross-context-continuity.test.ts:186`
  LEVEL 3+4 (plus an R2-decoded canonical bundle checksum-mismatch fail-closed at line 369);
  `packages/runtime/src/session/restore-rollback.test.ts` ("accepts a faithful store and
  rejects a rolled-back store"); `belief-lived-experience-loop.test.ts:203`;
  `subject-evolution-view.test.ts:257`; `product-runtime.test.ts:237`.
- Corruption rejection: corrupt R2 delta, truncated JSON, unknown encoding, canonical record
  checksum mismatch, corrupt environment checkpoint, wrong subject identity — all fail closed
  with typed errors.
- Real scale: `308,081,968 B → 17,971,887 B` (R2) with `state rev 1909 / R632 / 211 episodes`
  and the decoded store JSON hash identical (`e9e8434cdd457bc225d289e701bd1b9252b8af1b78356e96116392eb157d33cb`);
  fresh restore `10.29 s / heap 178 MiB / RSS 347 MiB` versus R1 `20.25 s / 2.26 GB / 2.42 GB`.

**Model restart:** trivially satisfied — the LLM holds no state; all state is host-side.

**Executor swap — the honest gap (`E0`).**

- *State* semantics survive: `SubjectStateV4` contains no model / provider / endpoint /
  executor field; provider identity is not part of any identity or state hash. Verified by
  schema read and by a repo-wide search of `packages/subject-core/src` (the only `executor`
  hit is a comment). So "LLM 更换以后主体状态语义是否仍然存在" — yes, because the LLM never
  held them.
- *Behavioural* identity does not: `executor-model-substitution-matched-v1` —
  `LOCAL_CONTEXT_MEDIATION_NOT_REPLICATED` (`qwen3.5:9b`, 80/80 host-valid, every contrast
  0/10 in both phases) versus `API_CONTEXT_MEDIATION_REPLICATED` (`deepseek-flash`, all four
  criteria PASS in both phases, 207 API requests). The report's own residual risks include
  "Provider-capability confound" (model quality and grammar strength travel together) and it
  explicitly declines to claim `PROVIDER_ENFORCEMENT_IDENTICAL`.
- Reinforcing observation: with thinking disabled, realized language is "常近乎逐字复述用户话语"
  (near-verbatim mirroring), recorded at 3/19, 5/16 and 11/50 across long-run legs.
- Counterweight worth keeping: `EXECUTOR_INDEPENDENT_COGNITION_USAGE_FAILURE` shows the
  recall-usage miss is executor-**in**dependent (three configurations, all 0/3), so at least
  one capability gap is not a model artifact.

**Device / runtime boundary:** `E0` / `UNKNOWN`. R2 is representation-only and was validated
on one machine. No cross-device or cross-runtime identity test exists.

**Time:** `E5`-shaped operationally (216 episodes retained, restarts EXACT, no drift), with
no controlled retention experiment at life scale.

---

## 3. Cross-cutting artifact index

| Artifact | Path | What it is | Reproducible by `pnpm test`? |
|---|---|---|---|
| Full gate log | `tmp/north-star-verify.log` | this audit's `pnpm verify` output | n/a (gitignored, produced here) |
| Long-run stop record | `product/sandbox/docs/long-run-monitoring/canonical-211-216-stop.json` | the only committed long-run evidence (5.8 KB) | no (read by a conformance test's scope? **no** — it is not referenced by any suite; `UNKNOWN / NOT VERIFIED` whether any test reads it) |
| Monitoring re-adjudication | `product/sandbox/docs/long-run-monitoring/lr-002-003-monitoring-adjudication.json` | false-positive correction record (2.9 KB) | no |
| Conformance law suites | `evals/conformance/*.test.ts` (23 files) | offline gates; 9 read committed evidence JSON | **yes** |
| Deterministic affect evidence | `research/experiments/affect-{state-retention-e1,activation-mapping-e2a,production-shaped-e2}/evidence/**` | 60–102 files each, 11–33 MB, re-executed in-process by conformance suites | partly |
| Real-provider affect evidence | `research/experiments/canonical-affect-*/evidence/**` | 26–38 files each, ~1–2 MB | no (CLIs need `MODEL_API_KEY` / Ollama) |
| Belief evidence | `research/experiments/belief-causal-validation-v0/evidence/**` (23 files, 1.65 MB) | 104 scenes, 100/104 valid | no |
| Belief confirmatory prereg | `research/experiments/belief-causal-confirmatory-stochastic-v1/PREREG.md` + precheck | **0 model calls** | partly (3 test files are in the vitest include list) |
| History divergence (original) | `.../durable-life-history-future-behavior-divergence-v0/evidence/run-1-real-provider/REPORT.md` | `informative: false` | conformance test reads persisted tables |
| History divergence (remeasure) | `.../…-v0-remeasure/evidence/run-1-real-provider/REPORT.md` | the decisive 100 pp vs 20 pp decomposition | conformance test reads persisted tables |
| Non-memory ablation | `research/experiments/non-memory-state-value-ablation-v0/REPORT.md` (443 lines) | the strongest negative, at `7999f6a` | `research.test.mjs` (node, 8/8) is **not** in the vitest include list |
| Long-lived subject store | `product/sandbox/.data/subjects/alice-longrun/**` | 216 episodes, hundreds of real turns | **no — gitignored, machine-local** |

**Verifiability conclusion:** the deterministic, law-level evidence is well protected by the
gate. The **real-provider and long-run evidence — which is the evidence that matters for the
North Star claim — is human-run, machine-local and outside the gate.** A third party can
read the frozen reports and re-read committed JSON tables, but cannot reproduce the runs or
inspect the 216-episode subject.

---

## 4. Matrix caveats

1. Evidence levels describe **what the artifact shows**, not the directory's name. Several
   directory names and verdict labels are stronger than their measurements
   (`canonical-affect-behavior-influence-*` measured cognition only; `...-causal-chain-v0`
   made 0 future calls; `durable-life-history-…-divergence-v0`'s null is self-declared
   non-informative; `longitudinal-multi-episode-…` is 4 episodes of 1 subject).
2. `E2` here never means "the science works". `evals/conformance/README.md` states this
   itself for its own suites.
3. Same-model semantic evaluation supports a bounded rubric classification only; it is not
   independent ground truth, and `RESEARCH_STATE.md` §4.4 says so.
4. Frozen experiments measured the retrieval/recall surface of their own commit. Every
   memory-visibility experiment predates the Sept 19–20 retrieval, selector and
   context-budget work; their evidence is valid for their commit and does not describe the
   current product.
5. No number in this matrix was produced by this audit except the gate result and the
   Ollama-unreachable diagnosis. Everything else is quoted from committed artifacts.
