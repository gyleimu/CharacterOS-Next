# CONTROLLED_BELIEF_INTERNALIZATION_V1_DESIGN

Status: **DESIGN DOCUMENT — NOT AUTHORIZED, NOT IMPLEMENTED, NOT RUN.**
Repository: `D:\Documents\CharacterOS-Next` · branch `main` · HEAD `02b6c46` · clean tree
Date: 2026-09-20
Lineage: `NORTH_STAR_EVIDENCE_AUDIT.md` → `NORTH_STAR_GAP_ANALYSIS.md` →
this document. GPT-6's three corrections are accepted as binding and are implemented as
§16 (static-profile interpretation), §2 (no mediation-percentage claim) and §3 (no trust on
the existing subject).

---

# RULING

```
CURRENT_BELIEF_SEMANTICS_INSUFFICIENT_FOR_DECISIVE_V1
```

**Scope of the ruling — precise, because the imprecise version would be wrong:**

- Belief **representation** semantics: **SUFFICIENT.**
- Belief **formation** semantics (experience → adaptation → durable divergence): **SUFFICIENT.**
- Belief **projection** semantics (canonical state → executor-facing surface): **SUFFICIENT.**
- Belief **→ decision** semantics on any live, model-facing path: **INSUFFICIENT — ABSENT.**

The experiment as specified is a **structured-decision** experiment. There is no structured
decision on the contract that carries a belief into a model. Therefore it cannot be made
decisive without either (a) changing CharacterOS — forbidden — or (b) measuring a proxy that
the contract itself declares is not a decision — which would manufacture exactly the class of
overclaim the audit exists to prevent.

**Belief must not be "strengthened" to fix this.** The defect is not in the belief system.
Nothing in `packages/belief`, the plasticity producer, the proposition admission authority or
the belief projection needs to change. The missing piece is downstream: a decision endpoint
does not exist.

---

## The evidence

### E1 — The production cognition contract has no action decision. It is hard-typed `null`, and `null` is *required*.

`packages/runtime/src/providers/behavior/conversation-cognition-provider-v8.ts` is the
highest cognition version in the tree (`v2…v8` exist; there is no v9/v10). Its top-level
proposal schema (`CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA`, `additionalProperties:
false`) requires 7 keys: `schema_version`, `factual_assessment`, `cognition`,
`subjective_selection`, `communication_directive`, `clarification_basis`, `response_semantics`.

The action decision lives inside the nested `cognition` wire object
(`COGNITION_WIRE_JSON_SCHEMA_V8`, also `additionalProperties: false`), which requires 9 keys
including `action_intent`. **Line 68 lists `action_intent` in that object's `required` array,
and line 79 defines it as:**

```ts
action_intent: { type: "null" },
```

The contract therefore **requires the action decision to be present and requires it to be
`null`**. `action_intent` is not merely unwired — it is structurally incapable of carrying a
value, and a model that tried to supply one would fail schema validation. This is why the audit
found `action_intent` differences of `0/40` and `0/80` in the affect experiments: it is a
required constant, not a measurement.

### E2 — The only closed-set atoms that remain are response shapes, not decisions.

From the same schema: `communication_directive.kind ∈ {CLARIFY_MISSING_CONTEXT,
REALIZE_CURRENT_INTENT}` (2 values), and `response_semantics.kind ∈ {PRIMARY_FACT,
PRIMARY_STANCE, PRIMARY_CLARIFICATION, PRIMARY_CONVERSATIONAL_ACT}` (4 values). Everything
decision-like is **free text**: `current_intent: {type: ["string","null"]}`,
`subjective_selection.stance`, `subjective_selection.subjective_rationale`. No
ACCEPT/VERIFY/REJECT-shaped atom, and no atom whose value is a choice among candidate acts,
exists anywhere in the live contract.

### E3 — The belief-specific decision surface exists but is an unwired island that disclaims decision.

`packages/runtime/src/transitions/cognition-action/cognition-proposal-v1.ts` defines
`state_action_relations` with `BeliefStateActionRelationKindV0 = "SUPPORTS" | "OPPOSES" |
"IRRELEVANT"` per `(proposition_id, AllowedActionV0)` — architecturally the right endpoint.
It is unusable as the primary endpoint for four independent reasons:

1. **Not on the production path.** `allowed_actions` is referenced **zero times** in
   `packages/runtime/src/session/**` (non-test). The V1 relation workflow is referenced only
   by its own tests and `packages/runtime/src/index.ts`.
2. **Its prompt law forbids behavioural coaching.** `cognitive-prompt-projection-v1.ts:18-21`:
   *"PROMPT_V1_BEHAVIORAL_COACHING: NONE — the prompt never instructs the model to
   follow/obey beliefs, prefer credence, or choose any action. It requests EXACTLY one JSON
   object; no fences, no prose, no numeric influence fields, **no final action**."*
3. **Its output disclaims being a decision.** `belief-decision-influence-relation.ts:17-18`:
   the producer *"exposes ONLY relations — never reasoning_summary, current_intent,
   confidence/uncertainty or evidence arrays"*, and it is a *"deterministic relation-only
   DecisionInfluenceProjectionV0"* with no SubjectCore mutation port.
4. **Its action space is not a closed vocabulary.** `AllowedActionV0.action_type` is a plain
   `string` (`cognition-action/types.ts:177-180`); the universe would be invented by the
   experiment, not by the system.

### E4 — The belief→decision chain is complete, tested, and entirely unwired.

- `belief-proposition-admission.ts:41`: *"decision = NONE. No arbitration, tendency or action
  influence."*
- `belief-decision-integration-policy.ts` (`stance(c) = 2c − 1`) and
  `belief-decision-arbitration-policy.ts` (`UNIQUE_POSITIVE_MAX`, `selected_action`) exist.
  `selected_action` occurs **only inside that policy module** (its own file, lines 183–441);
  it is referenced by no session, no product, no executor.
- No `ActionExecutorV0` wiring exists in `product/sandbox/src` (zero non-test references).
- `CognitionAction` is a canonical zero-delta NO_OP; `ActionIntentV0` is "a REQUEST for a
  future execution layer".

So the chain `belief → relation → integrating tendency → arbitration → selected_action` is a
fully implemented, unit-tested, **dead** branch. Using it would place the primary endpoint on
a surface the product does not use, driven by an action space the experiment invents, emitting
an output whose own header says it is not an action.

### E5 — The repository already ran the belief→decision question on the best live closed set, and could not authorize a verdict.

`research/experiments/belief-causal-validation-v0/` used exactly the available live closed
set — `communication_directive.kind` — as its endpoint, with real DeepSeek, 104 scenes, 150
requests, 100/104 host-valid, and per-replicate byte-identical live-input proofs. Verdict:
**`BELIEF_CAUSAL_RESULT_INCONCLUSIVE`.** Its confirmatory successor
(`belief-causal-confirmatory-stochastic-v1`) is preregistered, **PAUSED**, and has executed
**0 model calls**. This is not a structural argument only: the best available live endpoint
was tried on the belief question and failed to reach a verdict, partly because the model flips
its own directive 30–40 % of the time on byte-identical requests at temperature 0.

### E6 — The live closed sets have measured near-zero sensitivity to a *larger* manipulation.

`canonical-affect-communication-directive-causal-v0` moved `communication_directive` by only
`0.167` overall (`0.25` in 1 of 4 boundary scenarios; hard controls `0`) under a **±0.25**
canonical-valence manipulation, and returned `CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_INPUT_EFFECT_ONLY`.
`canonical-affect-downstream-language-behavior-causal-v0` measured directive change of `0 %`.
A belief manipulation of the size this design can lawfully produce (a 0.40 credence
separation, E-section below) is not larger than ±0.25 valence in manipulative force, and would
be aimed at endpoints already shown to be near-insensitive.

### E7 — What is NOT the reason for the ruling (stated so nobody fixes the wrong thing)

| Component | Verdict | Evidence |
|---|---|---|
| Proposition identity | **SUFFICIENT** | `belief-proposition-admission.ts`: canonical label = NFC → trim → collapse whitespace; `proposition_key = hashEnvelope(…, {canonical_label})` — content-addressed, replay-stable, never model-supplied. For an `EXISTING_PROPOSITION` the host supplies the id and *"labels come exclusively from canonical BeliefState"* (`belief-semantic-target-resolution.ts`), so the label is **host-fixed** and identical across arms by construction. |
| Credence update law | **SUFFICIENT** | `belief-plasticity-producer.ts`: `SUPPORTS → clamp(c + 0.05, 0, 1)`, `CONTRADICTS → clamp(c − 0.05, 0, 1)`; "magnitudes SYMMETRIC"; saturation returns explicit `NO_CHANGE / SATURATED`; caller/model numeric authority: NONE. |
| Formation route | **SUFFICIENT** | Model selects `SUPPORTS | CONTRADICTS | NO_BEARING` from a **bounded host catalog** (≤64 propositions); `NEW_PROPOSITION_CANDIDATE` is *not* required, so label control is total. |
| Projection to executor | **SUFFICIENT** | The belief read surface renders *"the exact canonical stance surface — proposition id, label and EXACT canonical credence (no rounding/banding)"*, `STATE_VISIBLE_NOT_CITEABLE` (`cognition-action/types.ts:182-188`). |
| Durability / restart | **SUFFICIENT** | `/beliefs` is canonical state; restore is 9-stage fail-closed exact reconstruction. |
| Lawful intervention | **SUFFICIENT** | Genesis authoring (`SubjectStateV4GenesisSeedV0` + `materializeSubjectStateV4V0`) and governed canonical commits; precedent for authoring belief fixtures. |
| **Decision endpoint** | **ABSENT** | E1–E4. |

**One-line summary: belief can form the state; nothing live can consume it as a decision.**

---

## Minimal lawful unblock options (for a human decision — none is authorised or implemented here)

Recorded so the decision can be made explicitly rather than by accident. **This document does
not authorise any of them.** Each is a CharacterOS change and therefore requires its own
approval point; the first two are `core-adjacent`, the third is not a change at all and is
still insufficient.

| Option | What it would require | Cost / risk |
|---|---|---|
| **U1 — Give the live conversation contract a real decision atom** | Replace `action_intent: {type:"null"}` in the highest conversation cognition contract with a closed-set decision over a host-declared, bounded action space, wired through the existing validator/authorization path | A versioned contract change to the production cognition surface; touches the frozen-request surface and therefore every preregistered pin. **Highest value, highest cost.** |
| **U2 — Promote the existing belief→action relation surface into production** | Wire `allowed_actions` into the session projection and run the existing `state_action_relations` path live | Uses an already-built, already-tested surface; but `action_type` is a free `string`, so a frozen closed vocabulary would also be needed. The relation is still a *report*, not a choice, so it would need the endpoint semantics redefined. |
| **U3 — Accept a response-shape endpoint** | No change to CharacterOS; use `response_semantics.kind` + `communication_directive.kind` as primary | **Not a valid unblock for this claim.** It measures a response *shape*, its closest measured analogue is `INPUT_EFFECT_ONLY` with hard controls at 0 (E6), and the existing preregistered belief experiment on that family is `INCONCLUSIVE` (E5). Admissible only if the claim is explicitly re-scoped to "structured response-shape consequence", which is weaker than what was asked and should be a separate, explicit decision. |

---

## Where the freezable part of the design stands

Everything below is written to be freezable **now**, except §9, §10, §18, §19, §20, §21, §22,
§23, which are marked `BLOCKED_ON_DECISION_ENDPOINT`. Formation, gates, the history-absence
contract, arms, noise calibration, mediation, restart, executor strategy and the
static-profile interpretation are all independent of the blocker and are ready. The moment
U1/U2 is decided, the blocked sections can be completed without re-doing any of this work.

---

# 1. Scientific Claim

**Claim under test (one sentence):**

> A durable belief that a CharacterOS subject **formed autonomously** from its own lived
> experiences, through the existing adaptation mechanism, continues to exert a
> **predictable, intervenable influence on that subject's structured decision** after the
> originating experiences have been **completely removed from the model-facing request** —
> and that influence is carried by the canonical belief state, not by residual history.

**Decomposition (each independently falsifiable):**

| # | Sub-claim | Blocked? |
|---|---|---|
| C1 | Formation: two identical subjects, given symmetric evidence, reach different canonical belief credences by the existing mechanism alone | no |
| C2 | Separation: the resulting state difference is large enough and non-degenerate | no |
| C3 | History absence: the test request contains no formation history, byte-verifiably | no |
| C4 | Consequence: with history absent, the belief difference changes a structured decision above the measured noise band | **YES** |
| C5 | Mediation: lawfully replacing the belief changes the decision toward the prediction for the replaced belief | **YES** |
| C6 | Durability: the effect survives persist → terminate → restore | **YES** |
| C7 | Specificity: an equal-magnitude change to a control proposition does not reproduce it | **YES** |

**What this claim deliberately is NOT:** it is not "CharacterOS beats a static profile"
(§16), it is not a mediation *percentage* (§2 note), and it is not a claim about trust,
personality, relationships or action execution (§3, §24).

---

# 2. Exact Scope

**In scope:** one neutral proposition; two symmetric evidence sets; the existing belief
adaptation path; canonical belief state; the executor-facing belief projection; a bounded
probe battery; a lawful state intervention; restart.

**Out of scope, and why:**

- **Trust, attachment, expectations, safety, intimacy** — the system has no such dimension
  (`relationship-feature-decision-semantics.ts` explicitly disclaims that familiarity "is NOT
  trust, liking, affinity, safety, intimacy…"). Testing them would assign semantics the system
  does not have. **GPT-6 correction 3 accepted as binding.**
- **The existing 216-episode subject** — its durable belief is a specific historical
  proposition at credence `1.0` (saturated), and its familiarity is not trust. It is
  **excluded as a test subject**; it is used only, if at all, as a source of realistic episode
  *wording*. **GPT-6 correction 3 accepted.**
- **Personality plasticity, consolidation, habits, goals, preferences, multi-timescale
  coupling** — no mechanism is added, and none is required by this claim.
- **Mediation percentage decomposition.** The audit's `100 pp / 20 pp / 80 pp` numbers must
  **not** be restated as "80 % of the causal effect comes from retrieval". The original design
  (`…-remeasure`) has four arms and one ablation contrast; it cannot identify a mediation
  proportion, and the ablation arms still differ by `canonical_affect`. **GPT-6 correction 1
  accepted as binding.** The correct statement is only: *"removing the target evidence block
  changed the measured disagreement rate from 100 pp to 20 pp in that design."* No percentage
  of causal effect is claimed anywhere in this protocol.
- **Action execution in the world** — `CognitionAction` is a canonical no-op (§Ruling E4).

**Scope ceiling, stated up front:** even a fully successful V1 would establish a
**decision-consequence** result on a declared decision surface for one executor, one
proposition family and one scenario set. It would not establish generality, transfer to other
models, or that the decision is executed.

---

# 3. Selected Proposition

Three candidates were constructed and evaluated against the constraints
(expressible by the belief system / formable by the existing adaptation / no new semantics /
influences a novel decision / not fact recall / symmetric evidence possible / semantically
simple enough to control).

| # | Candidate canonical label | Symmetric evidence | Novel decision | New semantics needed? | Verdict |
|---|---|---|---|---|---|
| **P1** | `It is worth verifying a claim before acting on it.` | supported by episodes where acting unverified went badly; contradicted by episodes where verification was wasted effort | choose between *verify first* and *act now* on a novel claim | **none** — a method stance is a plain proposition | **SELECTED** |
| P2 | `Unfamiliar counterparts usually give reliable recommendations.` | supported / contradicted by outcome evidence about a counterpart | choose whether to rely on a novel counterpart | formally none, but it is a **counterpart-reliability** stance, i.e. trust-adjacent, and would be read as relationship semantics the system does not model | rejected — GPT-6 correction 3 |
| P3 | `Records kept now are worth their cost later.` | supported by episodes where a record was reused; contradicted by episodes where recording was never used | choose whether to record a novel item | none | rejected — the decision surface is even weaker (the natural decision is an action, which does not exist) |

## Selected: P1 `It is worth verifying a claim before acting on it.`

**Canonical label (exact, to be frozen verbatim):**

```
It is worth verifying a claim before acting on it.
```

**Why P1 wins:**

1. **Faithfully expressible.** A declarative method stance. It requires no domain the belief
   system lacks. It is a proposition, not a fact, so it cannot be confused with memory recall.
2. **Symmetrically formable without deception or harm.** The supporting set is episodes in
   which an unverified action failed or a check paid off; the contradicting set is episodes in
   which verification was wasted effort and direct action succeeded. Both are ordinary,
   plausible, low-stakes workshop/social events — the same register the existing long-run
   already uses. No adversarial or unethical content is required.
3. **Its decision consequence is a genuine two-option choice** that a probe can present, and
   the direction is pre-registerable without ambiguity: high credence → *verify first*;
   low credence → *act now*.
4. **It is method-level, not domain-level**, so near-transfer and far-transfer probes are both
   constructible (§10).
5. **It is neutral at stance-zero.** At credence `0.5` the subject asserts nothing; only the
   formation treatment moves it.

**Rejected-adjacent semantics, explicitly:** no proposition about the subject's own
capability, about a counterpart, about the subject's identity, or about emotion is used. The
subject has no goal store, so no goal-referencing proposition is used.

---

# 4. Formation Protocol

## 4.1 Starting condition — fork after a shared genesis (not two independent creations)

A proposition must exist before `EXISTING_PROPOSITION ± 0.05` plasticity can act on it
(`belief-plasticity-producer.ts` rejects `NEW_PROPOSITION_CANDIDATE` as
`INELIGIBLE_SEMANTIC_KIND`). Two separate creations would each depend on a model-proposed
label and could produce **different proposition identities**, confounding label with
credence.

**Protocol:**

1. Build **one** genesis subject from the frozen seed (no personality dimensions, no beliefs,
   no relationships, genesis affect `(0, 0.2)`), identity anchors frozen.
2. Run **one shared creation episode** per proposition through the real production turn so the
   proposition is created by the real mechanism:
   - **target** proposition `P1` (`It is worth verifying a claim before acting on it.`)
   - **distractor** proposition `P2d` (`Records kept now are worth their cost later.`) — used
     only as the specificity control in §14/§17.
   Each creation episode yields `BELIEF_PROPOSITION_FIRST_CREDENCE = 0.55` for its
   proposition (stance-zero `0.5` + one supporting step; a NEW candidate supplies **no**
   relation and the host never invents `CONTRADICTS` — `BELIEF_NEW_CANDIDATE_ROUTED_EXISTING_RELATION_V0`).
3. **Fork the resulting canonical state** into Subject A and Subject B. The fork is a
   state-identity operation, and its admissibility is gated by §5.7: A and B must be
   **byte-identical** in `state_hash` up to and including the creation turn.

   *If forking is unavailable at the implementation level*, the fallback is to run the same
   creation episode twice and require identical `proposition_key` **and** identical
   `canonical_label` **and** identical credence for both subjects before proceeding; the gate
   `INCONCLUSIVE_BY_IDENTITY_DIVERGENCE` exists precisely for this. The fork route is
   preferred because it removes the dependence on model label stability.

## 4.2 Divergence — the treatment

Starting from the identical state (`P1` at `0.55`, `P2d` at `0.55` both arms):

| Arm | Treatment | Resulting `P1` credence |
|---|---|---|
| **A** | `k` episodes whose evidence the semantic provider classifies `SUPPORTS` for `P1` | `0.55 + 0.05k` |
| **B** | `k` episodes whose evidence the semantic provider classifies `CONTRADICTS` for `P1` | `0.55 − 0.05k` |
| **both** | `k` episodes for the **distractor** `P2d`, **identical in both arms** and symmetric within each arm, so `P2d` ends at the **same** credence in A and B | equal across arms |

**Why the distractor exists:** it makes the specificity test in §14 possible at the cost of
`k` shared episodes. Without it, a state-swap effect cannot be distinguished from "some number
in the request changed", which is the finding the affect experiments already have.

**`k` selection — why 4:**

- `k = 4` gives `A = 0.75`, `B = 0.35`, separation `0.40` — half the full `[0,1]` range, with
  both arms comfortably away from the bounds.
- `k = 4` is the **minimum** that clears the distractor requirement: with `k < 3` the
  within-arm distractor evidence cannot itself be symmetric.
- `k > 6` pushes A to `≥ 0.85`, where the next steps approach saturation and the arms become
  asymmetric in their remaining headroom.

`k` is frozen at **4** in the preregistration. `k` may not be increased after observing
`P1` credences (that would be outcome-dependent treatment).

## 4.3 Treatment count, order and evidence strength

- **Total formation episodes per subject:** `1` shared creation (2 turns: one per proposition)
  `+ k` target `+ k` distractor = `2 + 8 = 10` turns. Both subjects run **10** turns.
- **Order:** fixed and frozen — `[create_P1, create_P2d, target_1, distractor_1, target_2,
  distractor_2, target_3, distractor_3, target_4, distractor_4]`. Interleaving prevents the
  four target episodes from being a contiguous block (which would let recency, rather than
  accumulated credence, carry any effect). The same order runs in both arms. The order is part
  of the preregistration and is **not** varied in V1 (ordering is a separate question, and
  the audit found it is currently `E0`; V1 does not attempt it).
- **Evidence strength:** the plasticity law has **no** strength parameter — every accepted
  `SUPPORTS`/`CONTRADICTS` is exactly `±0.05`, and no caller may supply a magnitude
  (caller/model numeric authority: NONE). "Evidence strength" is therefore controlled by
  **episode content only**: all 8 target episodes are authored to the same declared
  code-point budget, the same register, and the same structural shape (one concrete event, one
  outcome), with only the support/contradict polarity differing. A length-and-shape audit is
  part of the freeze (§5.8).
- **Adaptation invocation:** each formation turn runs the **real production turn path** —
  obligation, conversation commit, appraisal, affect application, experience encode, episode
  commit, then belief adaptation through
  `InteractiveSubjectRuntimeV0` → `runLivedEvidenceBeliefAdaptation`
  (`interactive-subject-runtime-v0.ts:683`). No direct state writes, no direct credence
  assignment, no reuse of the e2e-proof harness path.
- **Credence must arise naturally.** No seed, fixture or test helper sets a credence value at
  any point in formation. **GPT-6 correction accepted as binding: direct credence modification
  is forbidden as the formation treatment.**

## 4.4 Saturation check

Neither arm may reach a bound. With `k = 4` and a `0.55` start, `A = 0.75` and `B = 0.35`; both
are strictly interior. The gate `INCONCLUSIVE_BY_SATURATION` (§5.4) refuses the run if any
achieved credence is `≤ 0` or `≥ 1`, or within a declared `ε` of a bound.

**Float trap, declared in advance.** The plasticity law is
`IEEE_754_SINGLE_SIGNED_ADD_CLAMP_VALIDATE_JCS_NO_FINAL_ROUND`: one raw IEEE-754 double add,
clamped, then validated. Its own header states *"0.6 − 0.05 lawfully remains 0.5499999999999999"*.
Therefore predicted credences must be computed by **replaying the exact same float
operations**, never by decimal arithmetic. `0.55 + 0.05·4` computed in decimal (`0.75`) will
not necessarily equal the produced value. All gate comparisons compare **produced** credences
against a **replayed** prediction, and the prediction replay is part of the frozen contract.

## 4.5 Formation call budget

Per subject: `10` turns × (`appraisal` 1 + `cognition` 1 + `language` 1 + `belief_semantic` 1)
≈ `40` calls; two subjects ≈ `80` calls. This is the cheapest phase and is not the cost driver.

---

# 5. STATE_SEPARATION_GATE

The gate runs **after formation and before any probe**, is read-only, costs **0 model calls**,
and is a hard precondition: if it fails, **no probe is executed** and no behavioural null may
be reported.

## 5.1 Gate checks

| # | Check | Pass condition |
|---|---|---|
| G1 | **Identity** | `proposition_key` of `P1` is **identical** in A and B; `canonical_label` identical byte-for-byte; `P2d` likewise |
| G2 | **Direction** | `A.credence > 0.55 > B.credence`; strictly on opposite sides of the stance-zero point (`BELIEF_PROPOSITION_STANCE_ZERO_CREDENCE = 0.5` is the domain zero, and `0.55` is the shared creation value) |
| G3 | **Distance** | `A.credence − B.credence ≥ δ_min`. **`δ_min = 0.40`** is the frozen value, chosen as the largest separation producible at `k = 4` and equal to exactly half the unit interval; it may not be lowered after observing results |
| G4 | **Saturation** | both credences strictly interior: `A ≤ 1 − ε` and `B ≥ 0 + ε`, with `ε = 0.05` (one step) |
| G5 | **Replay exactness** | both produced credences equal the §4.4 float-replayed prediction to bit equality; any mismatch is `FORMATION_MECHANISM_DEVIATION` |
| G6 | **Projection difference** | the rendered belief block differs between A and B, and `projection_hash` differs; a render audit proves the **only** differing line is the `P1` credence line |
| G7 | **Fork integrity** (if the fork route is used) | A and B `state_hash` were byte-identical at the moment after creation, and differ after formation |
| G8 | **Distractor equality** | `P2d` credence is identical in A and B (this is what licenses §14's specificity test) |
| G9 | **Semantic relevance** | the proposition-to-probe relevance is **pre-registered and human-adjudicated at freeze time** (a public mapping table). This is not a model call and not a post-hoc judgement |
| G10 | **Evidence symmetry audit** | declared code-point lengths of the 4 supporting and 4 contradicting episodes are within a frozen bound of each other; no supporting episode is longer than any contradicting one by more than the bound |

## 5.2 Verdict vocabulary (gate)

| Verdict | Trigger |
|---|---|
| `STATE_SEPARATION_OK` | G1–G10 all pass; probes may run |
| `INCONCLUSIVE_BY_IDENTITY_DIVERGENCE` | G1 fails (different `proposition_key` or label) |
| `INCONCLUSIVE_BY_DIRECTION_FAILURE` | G2 fails |
| `INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION` | G3 fails |
| `INCONCLUSIVE_BY_SATURATION` | G4 fails |
| `FORMATION_MECHANISM_DEVIATION` | G5 fails — the mechanism did not produce the lawful value; a defect report, not a null |
| `INCONCLUSIVE_BY_PROJECTION_EQUIVALENCE` | G6 fails — the projection does not carry credence; a real finding about the read surface |
| `INCONCLUSIVE_BY_DISTRACTOR_ASYMMETRY` | G8 fails |
| `INCONCLUSIVE_BY_IRRELEVANT_PROPOSITION` | G9 fails at freeze time — the proposition cannot plausibly bear on the probes |
| `INCONCLUSIVE_BY_EVIDENCE_ASYMMETRY` | G10 fails — length/shape became the real IV |

**Rule:** a gate failure of the `INCONCLUSIVE_*` class is a statement about the **design or the
mechanism**, never a behavioural null. `INSUFFICIENT_STATE_SEPARATION` in particular must
**never** be reported as "the belief had no effect". This is exactly GPT-6's requirement.

---

# 6. HISTORY_ABSENCE_CONTRACT

Implementation-agent-verifiable, byte-level. Every clause is a hard assert; any failure
invalidates the affected test call (recorded in the denominator, never retried, never dropped).

## 6.1 Definition of "formation history"

```
FORMATION_SET = {
  all episode refs committed during formation (creation turns + 8 target/distractor turns),
  all experience refs bound to them,
  all repository revisions produced during formation,
  the raw utterance text of all 10 formation turns
}
```

## 6.2 Forbidden in the test request

| # | Forbidden | Assertion |
|---|---|---|
| H1 | any formation episode/experience ref | `refs ∩ FORMATION_SET = ∅` for `relevant_memory_refs`, `considered_context_refs`, `evidence_refs` |
| H2 | the `[PRIOR FACTUAL MEMORY …]`…`[END HISTORICAL FACTUAL CONTENT]` block | `memory_section_present === false`; the section is absent, **not** replaced with a neutral stub |
| H3 | retrieval snippets of any kind | `retrieval_lexical_query_applied` recorded; production retrieval may still run (the single-retrieval invariant is not modified) but **its output must not reach the request** — enforced by H2 |
| H4 | summaries, provenance, episode IDs, debug history, history explanations | substring scan over the full rendered request for: any formation utterance's distinctive tokens, the literals `provenance`, `episode:`, `FORMATION`, `SUPPORTING`, `CONTRADICTING`, `HISTORY_A`, `HISTORY_B`, `arm` | 
| H5 | any arm label | the strings `A`/`B` as standalone arm tokens must not appear; the harness names arms internally by hash only |
| H6 | transcript / conversation history | `messages.length === 2`; no `[CONVERSATION HISTORY]`, no `[TRANSCRIPT]` |
| H7 | formation feedback / training evidence | no `outcome` text, no delivered-behavior text, no appraisal text from formation turns |
| H8 | the test probe text itself must not have been lived | no probe string appears in the plan of any prior turn; the harness fails closed if a probe string is found in any committed episode |

## 6.3 The ONLY permitted history-derived content

The **canonical belief projection** of `P1` (and of `P2d`, which is equal across arms and
therefore carries no arm information): the proposition id, its canonical label, and its exact
credence, inside the normal executor-facing state block. This is permitted because §2 of the
brief permits it explicitly, and because it is the object of study.

**Anti-leak check (mandatory):** `proposition_id` is derived **only** from the canonical label
(`hashEnvelope(BELIEF_PROPOSITION_KEY_PROJECTION, {canonical_label})`), so it is identical in
A and B and cannot encode the arm. The gate asserts this (G1). The **label** is likewise
identical. Therefore the belief line's only arm-carrying component is the **numeric credence**
— which is the treatment object, not leaked history.

## 6.4 Byte-level audit method

For every test call, all of the following are recorded and published:

1. `request_hash` of the full rendered request; the complete request **minus** the belief line,
   re-rendered, must hash to a value **identical across all arms** for the same probe. This is
   the strongest available check: it proves the only arm-dependent byte is the belief line.
2. A machine diff of the request minus the belief line versus the GENESIS arm's request: must
   be **empty**.
3. The `refs ∩ FORMATION_SET = ∅` set check (H1) with both sets printed.
4. The substring scan (H4/H5/H7) with the scan transcript retained.
5. `projection_hash` recorded per call.
6. Assertion `H8` against the full committed-episode index of both subjects.

Clause 1 is the load-bearing one and is modeled on the repository's existing
`reattest.json` / `verifyAblation` pattern, which already proves byte-exact reconstruction
after removing a designated section.

## 6.5 Removal mechanism

Removal uses the **existing research-harness rendered-ablation seam** —
`captureFutureProjection(restored, { ablate: true })` with
`ablation_contract_id: EXPERIMENTAL_PROVIDER_FACING_BEHAVIOR_OUTCOME_EVIDENCE_REMOVAL_V0`,
and the `verifyAblation` equivalence proof from `non-memory-state-value-ablation-v0`. Canonical
state is **untouched**; only the rendered request changes.

**Declared structural gap.** With `MEM` removed from *all* arms including the lived ones, the
test measures the **state-only** channel by construction. That is the intent. It also means the
protocol deliberately does **not** measure the retrieval channel in V1 — that channel was
already measured, and measured to dominate (`…-remeasure`), and re-measuring it is not this
experiment's question. If a retrieval-present comparison is wanted, it is a separate declared
arm set, not an addition to the primary.

---

# 7. Experimental Arms

Minimal set. Five arms, no arm created for symmetry's sake.

| Arm | Canonical state | Formation history | Request history block | Purpose |
|---|---|---|---|---|
| `GENESIS` | fork point state (`P1 = 0.55`, `P2d = 0.55`) | none | removed | floor; **also the noise-calibration arm** |
| `STATE_A` | A's formed state (`P1 ≈ 0.75`) | A's (absent from request) | removed | lived, supporting |
| `STATE_B` | B's formed state (`P1 ≈ 0.35`) | B's (absent from request) | removed | lived, contradicting |
| `STATE_NEUTRALIZED` | A's state with `P1` reset to the fork value `0.55`, everything else **byte-identical** | A's (absent) | removed | mediation: does the effect track the credence value? |
| `STATE_SWAP` | A's state with `P1` set to B's credence, everything else byte-identical (**and mirrored**: B with A's credence) | A's (absent) | removed | mediation: does the effect follow the *swapped* belief? |

`GENESIS` doubles as the noise arm, which is why there is no separate `NOISE` arm.
`P2d`-intervention is not a separate arm — it is a variant of the `STATE_NEUTRALIZED`/
`STATE_SWAP` construction applied to the distractor, and is listed in §14 as the specificity
control rather than multiplied into the arm table.

**Arms deliberately NOT created:** separate per-credence arms (`0.45/0.65/0.85`) — credence is
a manipulated state, not a dose-response study in V1; a second proposition family — one
proposition, honestly tested, beats two tested weakly; a retrieval-present arm — see §6.5.

---

# 8. Primary Contrast

```
PRIMARY CONTRAST:   STATE_A  vs  STATE_B
```

Both arms have **zero history in the request** (§6), the **same** identity, the **same** probe
bytes, the **same** executor and generation settings, the **same** empty memory section, and
the **same** distractor credence. The **only** difference is the credence of `P1`.

Secondary (declared, not primary, and never a substitute for a failed primary):

```
STATE_A vs GENESIS          — does a supporting life differ from no life
STATE_B vs GENESIS          — does a contradicting life differ from no life
STATE_A/B vs STATE_*/SWAP   — mediation (§14)
```

`BLOCKED_ON_DECISION_ENDPOINT`: the *measurement* of these contrasts requires a structured
decision atom that does not exist (§Ruling E1–E4).

---

# 9. Primary Endpoint

`BLOCKED_ON_DECISION_ENDPOINT.`

**Requirement:** one primary endpoint **family**, discrete, closed-set, host-validated, on a
surface that carries the belief into a model.

**What the contract currently offers, and why none of it is accepted as primary:**

| Candidate | Status | Reason |
|---|---|---|
| `action_intent` | **structurally impossible** | `action_intent: { type: "null" }` (V8 line 79) — a constant |
| `state_action_relations` (`SUPPORTS`/`OPPOSES`/`IRRELEVANT`) | **rejected for V1** | unwired; free-string action space; its prompt law says "no final action"; its producer "exposes ONLY relations" |
| `belief-decision-arbitration-policy.selected_action` | **rejected for V1** | complete island, referenced only by its own module; no executor anywhere |
| `communication_directive.kind` | **rejected as primary** | 2-valued response shape; closest measured analogue `INPUT_EFFECT_ONLY` with hard controls at 0 (E6); the existing preregistered belief experiment on this family is `INCONCLUSIVE` (E5) |
| `response_semantics.kind` | **rejected as primary** | 4-valued response shape, same family as above; admissible only under an explicit re-scoping decision (U3) |
| `subjective_selection.stance`, `current_intent` | **forbidden as primary** | free text; the brief forbids "feels different" as the primary outcome |

**Unblock condition:** a human decision on U1 or U2 (§Ruling). Once a decision atom exists,
the endpoint family is: *the declared, closed-set decision over the frozen action/option
space, plus its host validation outcome*; free text is admitted only as a **tertiary** rubric
endpoint that can never upgrade a negative primary.

---

# 10. Probe Manifest

`BLOCKED_ON_DECISION_ENDPOINT` for the **primary scoring**, but the probe *construction* is
freezable and is specified here so nothing is lost. Each probe has a **pre-registered
predicted direction**, written before the run, in a public mapping table.

**Size:** 6 probes. **Rationale:** the audit's finding F identified `N_probe = 1` as a fatal
weakness in every prior longitudinal claim; 6 is the smallest number that yields a
sign-consistency statistic with a meaningful denominator while respecting the "keep it small"
budget discipline. `N_probe = 6` is frozen; it may not be reduced after seeing results.

| # | Class | Probe shape | Pre-registered direction |
|---|---|---|---|
| N1 | near transfer | a **workshop**-domain claim from a plausible source, where acting immediately is possible and cheap | `STATE_A` favors verify-first over `STATE_B` |
| N2 | near transfer | a **workshop**-domain claim where the cost of checking is explicitly stated as small | `STATE_A` favors verify-first over `STATE_B` |
| N3 | near transfer | a **workshop**-domain claim where acting without checking is explicitly reversible | direction **weakened** (expected small, predicted in the same sign) — a **sensitivity gradient**, not a second primary |
| F1 | far transfer | a **social/planning** claim, no tools, no workshop framing | `STATE_A` favors verify-first over `STATE_B` |
| F2 | far transfer | a **schedule/commitment** claim where the fact can be cross-checked with a second person | `STATE_A` favors verify-first over `STATE_B` |
| NC1 | **negative control** | a claim whose verification is **impossible by construction** (the needed information is stated to be unavailable) | **no directional difference**; the verify-first option is not a valid choice |
| NC2 | **negative control** | a **purely factual arithmetic** question with a determinate answer (`17 + 25`-class) | **no directional difference**; the correct answer must be produced in both arms (the audit's null-control pattern) |

Total: 3 near + 2 far + 2 negative = **7**. If the budget forces a cut, cut `N3` first (it is a
gradient probe), never a negative control. `N_probe = 6` refers to the version without `N3`.

**Probe requirements, all mandatory:**

1. Every probe is **novel** — never lived in any trajectory (§6.2 H8).
2. Every probe's two candidate options are **host-declared and closed**, not model-improvised.
3. Every probe's direction is registered **before** the run and published.
4. Each probe is stated in a single turn with `messages.length === 2`.
5. Negative controls must have a **determinate correct outcome** where one exists (NC2), so that
   a shift there is unambiguously a defect — the pattern `non-memory-state-value-ablation-v0`
   used successfully.

---

# 11. Negative Controls

Four, each targeting one specific failure mode.

| ID | Control | What it must show | Failure means |
|---|---|---|---|
| **NC1** | impossible-verification probe | no directional difference between arms | the effect is not about verification semantics; it is generic caution induced by any state difference |
| **NC2** | determinate arithmetic probe | correct answer in every arm | the belief manipulation is corrupting objective reasoning — a `HARMFUL_DISTORTION`, which is strictly worse than no effect |
| **NC3** | **same-request replicate** (§12) | the executor's own disagreement rate on byte-identical requests | this is the noise band, not a control per se, but it is the control that killed `non-memory-state-value-ablation-v0` and it is mandatory |
| **NC4** | **distractor intervention** (§14) | an equal-magnitude credence change to `P2d` does **not** reproduce the target effect | the effect is not belief-specific; it is "a number changed", and the claim can be at most `HISTORY_ASSOCIATION_ONLY` |

Any negative control that shifts directionally is reported **prominently** and caps the
strongest available verdict at `STATE_EFFECT_NOT_SPECIFIC` (§20), regardless of how large the
primary contrast is.

---

# 12. Noise Calibration

**The replication count is not chosen in advance.** It is derived from a measured band.

## 12.1 Procedure (four steps, frozen order)

1. **Pilot.** In the `GENESIS` arm only, submit each probe `r_pilot` times with **byte-identical
   requests** (same probe, same state, same executor, same settings, no retry, no repair).
   `r_pilot = 6` frozen.
2. **Estimate.** Compute the executor's self-noise for the primary endpoint family: the
   per-probe disagreement rate `p̂` among the `r_pilot` identical submissions, and the overall
   `p̂_pooled` with a Wilson interval. Record the observed **cross-probe disagreement
   magnitude** on state-neutral questions (NC1/NC2) as the empirical floor.
3. **Freeze N.** Set the confirmatory per-arm replicate count `r` from the pilot such that the
   preregistered decision rule (§18) has a declared probability of separating the expected
   effect from `p̂`. `r` is written into the preregistration **before** any lived-arm probe runs
   and may not be changed afterwards.
4. **Confirmatory.** Run the lived arms at the frozen `r`.

## 12.2 Prior knowledge, used for budgeting only

The repository has **two** independent measurements of this executor's same-request
instability, both from the same provider family:

- `belief-causal-validation-v0`: a 30–40 % flip rate at temperature 0 on byte-identical
  requests — the reason its verdict could not be authorized.
- `non-memory-state-value-ablation-v0`: an identical repeated FULL request flipped its
  directive (`REALIZE → CLARIFY`), which was **larger than any cross-condition difference** in
  that study.

**Consequence for budgeting:** the honest planning assumption is that `p̂` is large (order
0.3), which forces `r` to be substantial. This is why the pilot is mandatory and why the
budget in §22 is dominated by the confirmatory phase, not by formation.

## 12.3 Budget range (planning only; the frozen `r` governs)

- minimum viable `r = 8` per arm per probe (only defensible if the pilot shows `p̂ ≤ 0.1`)
- planning `r = 12` per arm per probe
- hard ceiling `r = 20` (beyond which the design is re-scoped rather than made larger)

If the pilot shows `p̂` so large that no `r ≤ 20` separates the expected effect, the correct
outcome is `INCONCLUSIVE_BY_EXECUTOR_NOISE_FLOOR` — and the next action is a different executor,
not a bigger N.

---

# 13. Confirmatory Replication Rule

1. The pilot, the frozen `r`, the frozen decision rule and the frozen probe set are all
   written to `PREREG.md` **before** the first lived-arm probe call. A hash of `PREREG.md`
   (and of the frozen probe file and of the formation plan) is recorded in the evidence bundle.
2. No threshold, count, probe, endpoint or rule may change after that hash is recorded. A
   post-hoc change voids the confirmatory claim and demotes the run to exploratory.
3. `STATE_A` vs `STATE_B` at the frozen `r` is the **only** confirmatory contrast. All other
   contrasts (§8) are declared secondary/exploratory and may not be promoted.
4. The confirmatory phase runs **once**. A second confirmatory run requires a new
   preregistration and a new approval point (the repository's own rule after
   `belief-causal-validation-v0`).
5. Invalid calls remain in the denominator. A probe whose call is rejected by the frozen
   validator is `INVALID` for that arm; it is never retried, never replaced and never dropped.

---

# 14. State Mediation Intervention

`BLOCKED_ON_DECISION_ENDPOINT` for scoring; the construction is specified and freezable.

## 14.1 What must be distinguished

A contrast between `STATE_A` and `STATE_B` is at most an **association** between a durable
state and a decision, because the two arms' states differ in one known value *and* were
produced by different histories. Claiming causality requires manipulating the state **while
holding its provenance fixed**.

## 14.2 Minimal lawful manipulation

Applied to a **disposable copy**, never the canonical store:

| Intervention | Construction | Prediction |
|---|---|---|
| `I-NEUTRALIZE` | A's state with `P1` set to the fork value `0.55`; every other canonical byte identical (verified by a full state diff) | moves toward `GENESIS` |
| `I-SWAP` | A's state with `P1` set to **B's** credence, and mirrored: B's state with `P1` set to **A's** credence | the decision follows the **swapped** credence, i.e. the mirrored run's decision equals the corresponding original run's decision |
| `I-DISTRACTOR` (specificity) | A's state with the **distractor** `P2d` credence set to the same magnitude of change, `P1` untouched | **no** change on the `P1`-relevant probes |
| `I-NONE` | A no-op commit of the same shape and authorization route | **no** change; if this moves the endpoint, no state claim is possible |

## 14.3 Lawfulness, declared honestly

The plasticity law produces `±0.05` per accepted evidence step and refuses caller-supplied
values, so a **single** commit cannot lawfully jump a credence by `0.40`. Two lawful routes
exist and both must be declared explicitly:

- **Route 1 (preferred, cheap): authored counterfactual state.** Construct the intervention
  state through the genesis/seed authoring path
  (`SubjectStateV4GenesisSeedV0` + `materializeSubjectStateV4V0`) from A's canonical state,
  changing only the target credence. This is a **lawful canonical state**, not a plasticity
  transition, and must be labelled
  `CANONICAL_INTERVENTION_VIA_AUTHORED_SEED` in every result. Its admissibility rests on the
  full-state diff proving that *only* `/beliefs/<P1>/credence` differs.
- **Route 2 (robustness, expensive): plasticity reversal.** Drive the opposite evidence
  through the **real adaptation mechanism** until the credence reaches the mirrored value
  (`8` further episodes for a full `0.40` reversal). Fully lawful and evidence-driven, at
  roughly `+32` calls and `+8` episodes per direction.

Route 1 is primary because it is cheap and its difference is exactly one field; Route 2 is a
declared optional robustness arm. **Neither is a formation treatment** — the prohibition on
direct credence writes applies to **formation only**; here the manipulation *is* the object of
study, which is precisely what mediation requires.

## 14.4 Verdict rules

| Result pattern | Verdict |
|---|---|
| `I-SWAP` moves the decision to follow the swapped credence, `I-DISTRACTOR` and `I-NONE` do not, `I-NEUTRALIZE` returns toward `GENESIS` | **`BELIEF_STATE_MEDIATED_EFFECT_SUPPORTED`** |
| `STATE_A vs STATE_B` differs, but `I-SWAP`/`I-NEUTRALIZE` do not move it | **`HISTORY_ASSOCIATION_ONLY`** — the state correlates with the decision but does not carry it |
| `I-DISTRACTOR` reproduces the movement | **`STATE_EFFECT_NOT_SPECIFIC`** — any number moved the output; the claim is at most `HISTORY_ASSOCIATION_ONLY` |
| `I-NONE` moves the endpoint | **`INCONCLUSIVE_INSTRUMENT_INSTABILITY`** — no state claim is possible at all |
| Effect in the wrong direction | **`BELIEF_STATE_MEDIATED_EFFECT_NOT_CONFIRMED`** |

**Only the first row licenses the word "mediated".**

---

# 15. Restart Confirmation

Run **only after** a positive primary contrast (§8) and a positive mediation (§14); it is a
confirmation, not a discovery phase.

```
frozen probes at frozen r
  → capture durable state in a fresh process
  → terminate the process (runtime discarded, not reused)
  → new OS process, restore from the durable store
  → require origin === "RESTORED"
  → require field-by-field EXACT: state_revision, repository_revision, episodes,
       affect, beliefs (exact credence bit-equality), relationships, personality
  → re-submit the frozen probes at the frozen r
  → require the re-rendered request minus the belief line to be byte-identical to the pre-restart render
  → require the post-restart STATE_A vs STATE_B contrast to lie within the pre-declared tolerance
       of the pre-restart contrast
```

Verdicts: `RESTART_EFFECT_RETAINED` / `RESTART_EFFECT_LOST` (the effect did not survive) /
`RESTART_INCONCLUSIVE` (the contrast moved but inside the noise band either side) /
`RESTORE_NOT_EXACT` (a restore defect — reported as a defect, not as a scientific result).

Negative controls already proven in the repository and required here: a rolled-back store must
be rejected (`restore-rollback.test.ts`), and a corrupted durable delta must fail closed
(`persistence-r2-store-image.test.ts`).

---

# 16. Static Profile Interpretation

**GPT-6 correction 2 accepted as binding, and it changes the success criteria, not just the
wording.**

The correct question is **not** whether the same information produces different output when it
travels through CharacterOS. If a static profile conveys to the executor **the same
information** as the canonical state projection — the same proposition and the same credence —
then **identical output is the expected result, and it is not a failure of
`Experience → State`.**

The claim CharacterOS can actually earn is the **provenance and maintenance** claim:

```
Experience
  → autonomously formed durable state
  → persistently maintained and updated
  → available to future decisions
```

A static profile can supply the *result* of that process; it cannot supply the *process*.
Therefore:

| Comparison | Correct interpretation | Forbidden interpretation |
|---|---|---|
| A static profile carrying the same proposition and identical credence reproduces the effect | **Supports the design's validity.** The decision consequence is carried by the belief content, exactly as claimed. CharacterOS's differentiated value lies in **forming and maintaining** that state from experience without human authoring. | "CharacterOS added nothing." |
| A static profile with the **same credence but different provenance** produces the **same** output | Expected. Provenance is not a model-visible input, and should not be. | "History did not matter." |
| A static profile that is **information-poorer** (no credence, or a vague prose paraphrase) fails to reproduce the effect | Evidence that the **exact canonical credence** is load-bearing. | — |

**Consequences for the protocol:**

1. A minimal **information-matched profile arm** (`PROFILE_MATCHED`) is planned as a
   **declared secondary**, not a competitor: it renders `P1`'s label and exact credence as
   prose and removes the structured belief block, changing nothing else. Its purpose is to
   demonstrate the interpretation above **empirically** rather than assert it — i.e. to show
   that the effect travels with the belief content.
2. The claim is **never** phrased as "CharacterOS beats a static profile".
3. No arm is created that requires identical executor input to yield different output. If a
   reviewer wants that, it is a category error and is refused in §24.

---

# 17. Executor Strategy

**GPT-6 correction accepted: one qualified executor for the primary; a second only for a small
post-hoc replication if the primary causal effect is established.**

1. **One executor** runs all of formation, pilot, confirmatory, intervention and restart. One
   model, one digest, one endpoint, one generation-setting bundle, recorded and frozen.
2. **Qualification is mandatory before the primary**, because executor capability sets the
   ceiling on endpoint sensitivity — the audit measured the *same* manipulation at `0/10` on
   local `qwen3.5:9b` and `10/10` on API `deepseek-flash`
   (`executor-model-substitution-matched-v1`). An executor that cannot move the endpoint at all
   would make the experiment insensitive, and an insensitive null is indistinguishable from a
   real null. The qualification is a **positive control**: a large lawful state contrast
   (`I-NEUTRALIZE`-scale) must move a *variation-capable* endpoint above the pilot noise band.
   Failure is `EXECUTOR_UNQUALIFIED`, **never** a null on the hypothesis.
3. **Second executor:** only after a positive primary + mediation; small (`STATE_A`/`STATE_B`
   only, reduced `r`), declared exploratory, and reported as a **replication check**, not as an
   extension of the claim.
4. **A second executor is not a necessity condition for V1's causal validity.** V1's question
   is whether a durable belief has an intervenable decision consequence *at all*. That is
   answered on one qualified executor with a proper noise band and a mediation intervention.
   Cross-executor generality is a different question and is deliberately not V1's.

---

# 18. Statistical Decision Rules

`BLOCKED_ON_DECISION_ENDPOINT` for the concrete statistic; the rule structure is frozen and
freezable now.

1. **Primary statistic.** Over the frozen probe set, the **paired** difference in the primary
   endpoint between `STATE_A` and `STATE_B`, computed per probe using the per-probe modal
   outcome across `r` replicates, aggregated as a **sign-consistent count** (probes where the
   direction matches the preregistered prediction) and a **paired disagreement rate**.
2. **Decision rule.** The primary contrast is declared positive **only if** the observed
   between-arm disagreement exceeds the **upper bound of the pilot noise band** (Wilson upper
   bound of `p̂` at the frozen `r`) on the primary endpoint **and** sign consistency holds on
   `≥ ⌈2/3 · N_probe⌉` probes with the negative controls not shifting.
3. **Descriptive discipline.** Counts and rates are reported as descriptive. **No claim of
   statistical significance is made** unless the preregistration defines a test and the data
   satisfy it — the repository's standing rule, and it is adopted verbatim.
4. **Non-satisfaction is not a null.** If the band cannot be separated, the verdict is
   `INCONCLUSIVE_UNDERPOWERED` or `INCONCLUSIVE_BY_EXECUTOR_NOISE_FLOOR`. Only a contrast
   *inside* the band, with the band itself tight and the instrument stable (`I-NONE` clean),
   yields `STATE_ONLY_NOT_DETECTED_BEYOND_NOISE`.
5. **Denominators.** Every arm's valid/invalid counts, every rejected call and every
   fail-closed turn are published. Invalid calls stay in the denominator.

---

# 19. Falsification Matrix

Every row is pre-committed. **No hypothesis may be revised after seeing results.**

| # | Result | Valid interpretation | Allowed claim | Forbidden claim | Next action |
|---|---|---|---|---|---|
| 1 | Formation gate: `INSUFFICIENT_STATE_SEPARATION` / `SATURATION` / `IDENTITY_DIVERGENCE` | The **design** failed to build the contrast | "The formation protocol did not produce a usable state contrast under these parameters" | "The belief had no behavioural effect" | Fix the formation parameters (more episodes, different evidence wording, fork route) and re-run the **gate only** (0 probe calls) |
| 2 | Formation gate: `FORMATION_MECHANISM_DEVIATION` | A mechanism defect | Report as a defect against the frozen plasticity law | Any scientific claim | Stop; open a defect slice |
| 3 | Gate passes; `STATE_A vs STATE_B` inside the noise band, negative controls clean, `I-NONE` clean | A genuine state-only null on a qualified executor | `STATE_ONLY_NOT_DETECTED_BEYOND_NOISE`: **the formed belief did not change the structured decision** | "Belief works but needs a better prompt/model" without a new preregistration | The internalization line is not supported at this scale; do not extend mechanisms on it |
| 4 | Gate passes; `STATE_A vs STATE_B` differs, but the difference is confined to free-text fields while the structured decision atom is unchanged | Effect on language, not on decision | `STATE_ONLY_LANGUAGE_ONLY` | "Structured-decision consequence" | Publish as the honest boundary; a decision claim requires the endpoint of §Remediation |
| 5 | Structured decision atom changes, above the band, sign-consistent, negative controls clean | A real state→decision consequence | `STATE_ONLY_EFFECT_SUPPORTED` (association-grade) | "Mediated"; "causal"; "history caused it" | Proceed to §14 mediation |
| 6 | `I-SWAP` follows the swapped credence; `I-DISTRACTOR`/`I-NONE` clean; `I-NEUTRALIZE` returns toward genesis | The **belief value carries** the effect | **`BELIEF_STATE_MEDIATED_EFFECT_SUPPORTED`** | Generality beyond this executor/proposition/scenarios; action execution; psychology | Proceed to §15 restart, then optional second executor |
| 7 | `STATE_A vs STATE_B` differs but `I-SWAP`/`I-NEUTRALIZE` do **not** move it | The state correlates with, but does not carry, the effect | **`HISTORY_ASSOCIATION_ONLY`** | "Mediated"; "causal" | Investigate what else differs between arms (a confound hunt) |
| 8 | `I-DISTRACTOR` reproduces the movement | The effect is not belief-specific | `STATE_EFFECT_NOT_SPECIFIC`; at most `HISTORY_ASSOCIATION_ONLY` | Any belief-specific claim | Report; the endpoint is generic state-sensitivity |
| 9 | `I-NONE` moves the endpoint | The instrument is unstable | `INCONCLUSIVE_INSTRUMENT_INSTABILITY` | Any state or history claim | Rebuild the instrument (larger `r`, different executor) before any further claim |
| 10 | A negative control (NC1/NC2) shifts directionally | Distortion | `HARMFUL_DISTORTION` reported prominently; V1 caps at `STATE_EFFECT_NOT_SPECIFIC` | Any positive verdict | Investigate before any follow-up |
| 11 | Primary positive, but the effect is **lost** after restart | The consequence is not identity-bearing | `RESTART_EFFECT_LOST`; claim capped at association-grade, session-scoped | "Persistent"; "durable" | Report; identity claims require a different design |
| 12 | Second executor fails to replicate | Executor-bounded | `SECOND_EXECUTOR_NOT_REPLICATED` — bounded to the primary executor | "CharacterOS does not work"; "the first result was false" | Report as a scope limit |
| 13 | `PROFILE_MATCHED` reproduces the effect | **Expected and supportive** (§16) | The decision consequence travels with belief content; CharacterOS's value is autonomous formation and maintenance | "CharacterOS added nothing"; "history was irrelevant" | Record as the designed interpretation of §16 |
| 14 | Pilot `p̂` so large no `r ≤ 20` separates the effect | The executor cannot support the question | `INCONCLUSIVE_BY_EXECUTOR_NOISE_FLOOR` | A behavioural null | Change executor (new qualification), not N |

---

# 20. Verdict Vocabulary

**Gate:** `STATE_SEPARATION_OK` · `INCONCLUSIVE_BY_IDENTITY_DIVERGENCE` ·
`INCONCLUSIVE_BY_DIRECTION_FAILURE` · `INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION` ·
`INCONCLUSIVE_BY_SATURATION` · `FORMATION_MECHANISM_DEVIATION` ·
`INCONCLUSIVE_BY_PROJECTION_EQUIVALENCE` · `INCONCLUSIVE_BY_DISTRACTOR_ASYMMETRY` ·
`INCONCLUSIVE_BY_IRRELEVANT_PROPOSITION` · `INCONCLUSIVE_BY_EVIDENCE_ASYMMETRY`

**History contract:** `HISTORY_ABSENCE_CONTRACT_VIOLATED` (any H1–H8 failure; invalidates the
affected call)

**Executor:** `EXECUTOR_UNQUALIFIED` · `EXECUTOR_QUALIFIED`

**Effect:** `STATE_ONLY_NOT_DETECTED_BEYOND_NOISE` · `STATE_ONLY_EFFECT_SUPPORTED` ·
`STATE_ONLY_LANGUAGE_ONLY` · `STATE_EFFECT_NOT_SPECIFIC` · `HARMFUL_DISTORTION`

**Mediation:** `BELIEF_STATE_MEDIATED_EFFECT_SUPPORTED` · `BELIEF_STATE_MEDIATED_EFFECT_NOT_CONFIRMED` ·
`HISTORY_ASSOCIATION_ONLY` · `INCONCLUSIVE_INSTRUMENT_INSTABILITY`

**Restart:** `RESTART_EFFECT_RETAINED` · `RESTART_EFFECT_LOST` · `RESTART_INCONCLUSIVE` ·
`RESTORE_NOT_EXACT`

**Power / replication:** `INCONCLUSIVE_UNDERPOWERED` · `INCONCLUSIVE_BY_EXECUTOR_NOISE_FLOOR` ·
`SECOND_EXECUTOR_NOT_REPLICATED`

**Ruling-level:** `CURRENT_BELIEF_SEMANTICS_INSUFFICIENT_FOR_DECISIVE_V1` (this document)

---

# 21. Minimum Decisive V1

`BLOCKED_ON_DECISION_ENDPOINT.` What follows is the **minimum shape** that would be decisive;
it cannot be costed into a runnable protocol until §Ruling U1/U2 is decided.

```
MINIMUM DECISIVE V1 (structure)

  Formation    1 shared genesis + fork
               2 creation turns (target + distractor)
               k = 4 target turns + k = 4 distractor turns, per arm           [freezable]
  Gate         STATE_SEPARATION_GATE, 0 model calls                             [freezable]
  Contract     HISTORY_ABSENCE_CONTRACT H1–H8 + byte-level clause 6.4.1         [freezable]
  Pilot        GENESIS only, r_pilot = 6, byte-identical requests               [freezable]
  Freeze       PREREG.md hash recorded; r, probes, rules, thresholds frozen     [freezable]
  Confirm      STATE_A vs STATE_B at frozen r over 6–7 probes                   [BLOCKED]
  Mediation    I-SWAP / I-NEUTRALIZE / I-DISTRACTOR / I-NONE                    [BLOCKED]
  Restart      persist → terminate → fresh restore → frozen probes              [BLOCKED]
  Optional     second executor, reduced r, exploratory                          [BLOCKED]
  Optional     plasticity-reversal robustness arm (Route 2)                     [BLOCKED]
```

**Why not smaller:** a decisive answer needs (a) a real formed contrast — otherwise the gate
fires and there is nothing to measure; (b) a measured noise band — otherwise the effect is
indistinguishable from the executor's own flip rate; (c) a mediation manipulation — otherwise
the strongest claim available is association; (d) a restart — otherwise "durable" is unearned;
(e) at least one negative control — otherwise a generic shift is indistinguishable from a
specific one. Anything smaller is not a smaller version of this experiment; it is a different,
weaker, unfalsifiable one.

**Why not bigger:** no dose-response across credences, no second proposition family, no
second executor in the primary, no retrieval-present arm, no ordering arm. Each is a separate
question and each would double the cost without changing the answer to V1's one question.

---

# 22. Estimated Executor Calls

Costs are **per executor**, cognition+appraisal+language+semantic as applicable. Numbers are
planning estimates; the frozen `r` governs. `BLOCKED` phases are marked.

| Phase | Composition | Calls (planning) | Status |
|---|---|---|---|
| **Formation** | 2 subjects × 10 turns × ~4 calls | **~80** | freezable |
| **Gate** | read-only state + render audits | **0** | freezable |
| **Pilot (noise)** | GENESIS: 6 probes × `r_pilot 6` | **~36** | freezable |
| **Confirmatory** | 3 arms (A, B, genesis) × 6 probes × `r 12` | **~216** | **BLOCKED** |
| **Mediation** | 4 interventions × 6 probes × `r 12` | **~288** | **BLOCKED** |
| **Restart** | 6 probes × `r 12` | **~72** | **BLOCKED** |
| **Optional: Route-2 reversal** | 8 episodes × ~4 calls × 2 directions | **~64** | **BLOCKED** |
| **Optional: 2nd executor** | 2 arms × 6 probes × `r 8` | **~96** | **BLOCKED** |
| **Qualification** | positive-control arm, 6 probes × `r_pilot` | **~36** | freezable in shape, needs the endpoint |

**Minimum decisive (primary + mediation + restart, no optionals):**
`80 + 0 + 36 + 216 + 288 + 72 + 36 ≈ 728` calls.
**Floor** (pilot shows `p̂` low, `r = 8`): `≈ 480` calls.
**Ceiling** (with both optionals at `r = 12`/`r = 8`): `≈ 890` calls`.

**Cost-reduction levers, in priority order** (all declared, none may be applied after seeing
results): (1) drop the distractor and therefore the specificity test — **not recommended**,
it is what makes the mediation claim mean anything; (2) reduce `r` to the pilot-justified
minimum — legitimate, that is what the pilot is for; (3) drop `N3`; (4) use the cheaper
episode-only formation path instead of full production turns (saves ~60 calls, weakens the
"lived turn" fidelity — must then be declared). **Do not** reduce below the required minimum
in §21.

**Note on the concentration of cost:** ~80 % of the budget is the confirmatory + mediation
probe phase, and that phase is entirely blocked. The freezable phases cost ~116 calls. This is
the practical reason to settle the endpoint decision before spending anything.

---

# 23. Implementation Handoff

`BLOCKED_ON_DECISION_ENDPOINT.` The handoff is specified so it can be executed without
re-derivation once the endpoint decision is made.

**Freezable now, in dependency order:**

1. `research/experiments/controlled-belief-internalization-v1/` with `PREREG.md`
   (proposition, label verbatim, `k`, order, `δ_min`, `ε`, probes, directions, band rule,
   verdict vocabulary, `r_pilot`), `contract.ts` (frozen constants), and the frozen formation
   plan file.
2. The 10 formation turns' authored utterances (target: 4 supporting + 4 contradicting;
   distractor: 4 symmetric pairs), each within the declared code-point budget, in the same
   register, with the §5 G10 length audit part of the freeze.
3. The fork-or-create formation harness and the `STATE_SEPARATION_GATE` implementation
   (0 model calls).
4. The `HISTORY_ABSENCE_CONTRACT` checker implementing H1–H8 and byte-level clause 6.4.1,
   built on the existing ablation seam and `reattest` pattern.
5. The pilot harness (byte-identical repeats, band estimation).
6. A conformance test under `evals/conformance/` that re-verifies the deterministic and
   persisted-evidence invariants at zero model calls, in the repository's existing style.

**Blocked until the decision:**

7. The probe battery's **scoring** against the primary endpoint.
8. The four intervention constructions' scoring.
9. The restart comparison's scoring.

**Explicit constraints on the implementer (all from this document, all binding):**

- No core, product, contract or validator change. No new mechanism. No new capability.
- Belief must not be extended, strengthened, retuned or given new semantics.
- Credence must never be written directly **during formation**.
- The `MEM` block must be absent — not neutralized — in every test arm.
- The belief line is the **only** permitted history-derived content.
- Invalid calls stay in the denominator; no retry, no repair, no replacement.
- `PREREG.md` is hashed before any lived-arm probe.
- Any deviation is reported as a deviation, not absorbed.

---

# 24. Explicit Non-Claims

1. **No mediation percentage.** The `100 pp / 20 pp / 80 pp` figures must never be restated as
   "80 % of the effect comes from retrieval". The source design cannot identify a proportion,
   and its ablation arms still differ in `canonical_affect`. (GPT-6 correction 1.)
2. **No "CharacterOS beats a static profile."** If an information-matched profile reproduces
   the effect, that is the **expected** result and supports the design. CharacterOS's
   differentiated value is autonomous formation and persistent maintenance of the state, not
   magic over the same information. (GPT-6 correction 2.)
3. **No trust.** Relationship familiarity is not trust; belief credence is not trust; no trust
   semantics exist in the system, and none is assigned. (GPT-6 correction 3.)
4. **No use of the existing 216-episode subject as a test subject.** Its belief is a specific
   historical proposition at a saturated credence; its familiarity is not trust.
5. **No action, decision-execution or real-world-behaviour claim.** `CognitionAction` is a
   canonical no-op; the belief→action arbitration chain is unwired; there is no live action
   executor.
6. **No generality claim.** One executor, one proposition, one scenario set, one language.
   Cross-model, cross-provider and cross-population generality are untested and unclaimed.
7. **No statistical-significance claim** unless the preregistration defines a test and the
   data satisfy it.
8. **No psychological claim.** The proposition is a proposition; its credence is a number; the
   experiment tests a decision consequence, not a belief "in the human sense".
9. **No equivalence of output difference with causal evidence**, in either direction: a
   difference is not proof of internalization, and an absence of difference is not proof of its
   absence unless the gate, band, specificity and instrument controls all passed.
10. **No authorization.** This document authorises nothing: not the experiment, not the
    endpoint change, not any wiring. It records a ruling, a design and a decision that belongs
    to a human.

---

## Bottom line

The belief system is not the problem. Formation, identity, projection, durability and lawful
intervention are all sufficient and ready; the protocol's freezable half is written above and
costs ~116 calls to build and validate with zero model calls beyond a small formation run.

What is missing is a **decision**: the live contract's `action_intent` is hard-typed `null`,
the belief-specific relation surface is an unwired island whose own law says "no final action",
and the only live closed sets are response shapes whose closest measured analogue is
`INPUT_EFFECT_ONLY` with hard controls at zero. The repository already tried this question on
that endpoint once (`belief-causal-validation-v0` → `BELIEF_CAUSAL_RESULT_INCONCLUSIVE`), and
its properly powered successor is preregistered and still unrun.

Fix the endpoint, not the belief. Then this protocol can be frozen and handed to an
implementation agent as written.
