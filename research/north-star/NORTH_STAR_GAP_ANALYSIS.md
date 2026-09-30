# NORTH_STAR_GAP_ANALYSIS — CharacterOS-Next

Status: AUDIT RECORD (read-only; no core/product/test/frozen-evidence change)
Audit date: 2026-09-20 · HEAD `02b6c46` · branch `main` · clean tree
Companions: `NORTH_STAR_EVIDENCE_AUDIT.md`, `NORTH_STAR_EVIDENCE_MATRIX.md`,
`HISTORY_INTERNALIZATION_TEST_V1_DESIGN.md`.

Purpose: rank the gaps between the current system and proof of the North Star claim, select
exactly **one** primary gap, and justify that selection against the alternatives — including
against the option the audit brief pre-suggested (History Internalization Test), which this
audit **accepts but re-centres on a different arm than the brief's headline framing**.

---

## 0. What has to be proved

The North Star claim, decomposed into four independently falsifiable propositions:

| # | Proposition | Status today |
|---|---|---|
| P1 | A life leaves persistent internal change (not only stored retrievable episodes). | **Established for state values** — belief, familiarity and affect change from lived evidence and survive exact restart. |
| P2 | That change is available *without re-reading the raw history*. | **Structurally true** (state is separate from episodes) **but never tested as a behavioural pathway.** |
| P3 | That change **causally and explainably** alters future cognition, judgment and behaviour. | **Not established.** The only real-provider history→behaviour measurement attributes 80 of 100 pp to the retrieved memory text and shows 0 pp movement in the structured intent. |
| P4 | That the resulting difference is attributable to CharacterOS rather than to "some self-referential text was present". | **Not established.** No baseline exists at all. |

The gap analysis is about P2/P3/P4. P1 is the part that works.

---

## 1. Ranked gap inventory

Ranked by *how much proof of P1–P4 each gap blocks, per unit of cost to close*. Cost is
graded in the repository's own currency: model calls, new code, new risk of overclaim.

| Rank | Gap | Blocks | Cost | Current evidence |
|---|---|---|---|---|
| **1** | **No measurement of the internalized-state channel with history removed** (state-only vs genesis twin, and vs retrieval-only) | P2, P3, P4 — all three | Low: read-only, disposable copy, existing ablation seam, ~tens of model calls | none |
| **2** | **No baseline family (B0/B1/B2/B4)** | P4 | Medium: 3–4 new request variants over the same fixture; no new mechanism | `evals/baselines/` = `RESERVED / NOT IMPLEMENTED` |
| **3** | **Internalized state is saturated and low-dimensional in the real subject** | P2, P3 — a state-contrast test has nothing to contrast | Medium: requires a trajectory chosen to produce non-saturated differentiated state | Alice: belief credence `1.0`, affect activation `1.0` (50/50 end-of-turn), one monotone familiarity counterpart |
| **4** | **No decision/action endpoint** | P3 | Medium-high: must pick and justify a measurable decision proxy (validated directive, action_intent among host-legal actions, or a research action executor) | `CognitionAction` is a canonical NO_OP; `ActionIntent` is "a REQUEST for a future execution layer"; the sole executor is a deterministic sandbox |
| **5** | **Personality plasticity is disabled by construction in the product** (`personality_adaptation_enabled: false`, no genesis prior, empty container) | Q2, Q8 — the SLOW timescale does not exist | Low technically, **high evidentially**: enabling it would be building a mechanism before any evidence justifies it | never fired in 216 episodes |
| **6** | **No consolidation** (`consolidation_cursor` never written; no semantic memory; no forgetting) | Q4, and the *scale* argument for internalization | High: a new mechanism | absent |
| **7** | **No path-dependence experiment** (A→B→C vs C→B→A) | Q9 | Medium | only the affect *law*'s path dependence, synthetic |
| **8** | **Stale strongest negative**: the non-memory ablation ran when Belief/Relationship/Personality were ABSENT | the repository's own self-assessment | Low: same design, current HEAD, disposable copy | `7999f6a`; "Belief ABSENT / Relationship ABSENT / Personality ABSENT / Regulation constant" |
| **9** | **Real-provider evidence is outside the gate**; the 216-episode corpus is gitignored and machine-local | reproducibility of every P2/P3 claim | Low-medium: commit bounded derived tables | only 2 files (8.7 KB) committed |
| **10** | **`pnpm test` is red at HEAD without a local Ollama** (2 ungated product test files) | the honesty of the closure gate | Very low: add the same `skipIf` gate the other 3 suites use | measured: `ProductRuntimeStartupErrorV0: fetch failed` |
| **11** | **No independent/human evaluator**; two evaluator instruments were shown invalid | external validity of every semantic judgement | High | same-model judges; self-disclosed |
| **12** | **No multi-seed / multi-scenario replication** for the longitudinal claims | E5 for anything | High (real calls) | N=1 subject or N=3 scenarios nearly everywhere |

---

## 2. The primary gap

### ONE PRIMARY GAP

> **There is no measurement of whether anything the subject *internalized* changes what it
> does when the *history text is taken away* — and no baseline against which such a change
> could be attributed to CharacterOS rather than to the mere presence of self-referential
> context.**

Restated in the North Star's own words:

> `History changed the subject rather than merely remaining retrievable.`

### The evidence that fixes this as the primary gap

1. **The repository's own decisive decomposition attributes the effect to retrieval, not to
   internalization.** `durable-life-history-future-behavior-divergence-v0-remeasure`, 5/5
   complete four-arm units: `treatment_pair_disagreement: 100pp` versus
   `ablation_pair_disagreement: 20pp`; `behavior delta (treatment − ablation): 80pp`. The
   harness proves the ablated arms differ **only** in `canonical_affect`
   (`ablation_pair_body_equal_except_affect: true`) and that the residual affect delta is
   `0.000022699964881242424`. So the durable-history effect is a *memory-text* effect with a
   numerically negligible state contribution.
2. **The decision endpoint never moved.** `intent delta (treatment − ablation): 0pp`;
   `action_intent` differences `0/40` (v0) and `0/80` (v1); the dedicated action-selection
   family ends `ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED` with ablation `0` and
   order-invariant scenarios `0`. The measured divergence lives in the *wording*.
3. **The repository's only direct test of non-memory state's marginal value says
   `NOT_PROVEN`.** `non-memory-state-value-ablation-v0`: "Affect Value Beyond Memory:
   `NOT_PROVEN`", "is current CharacterOS meaningfully more than an LLM + persistent factual
   Memory/RAG system? `INCONCLUSIVE`", "Should CharacterOS Core Continue Expanding? `NO`".
4. **The internalization that does work has never been connected to a consequence.**
   Belief: `BELIEF_CAUSAL_RESULT_INCONCLUSIVE`; its confirmatory successor is
   preregistered, PAUSED, and has run **0 model calls**. Relationship:
   `RELATIONSHIP_FAMILIARITY_BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED`, with the best
   decomposition showing behaviour tracks *context availability* (`A↔F 4/4`, `B↔F 0/3`), not
   the relationship scalar. Personality: never fires.
5. **Without a baseline, even a positive result would be unattributable.** The influence
   channel is 100 % prompt-textual (`[affect (canonical)] valence=…`,
   `[SUBJECTIVE BELIEF STANCES …]`, `[interaction familiarity …]`). A persona profile or a
   rolling summary would use the same channel. So "state shapes behaviour" is
   indistinguishable from "self-referential text shapes behaviour" until a comparator exists.

### Why the alternatives were rejected as *primary*

- **"Consolidation is absent" (rank 6)** — real and consequential, but consolidation is a
  *means*. Building episodic→semantic abstraction before knowing that internalized state has
  any behavioural consequence is exactly the pattern the brief forbids: adding mechanism to
  make the story look complete. If the primary gap closes *negative*, consolidation becomes
  unjustified.
- **"No baselines" (rank 2)** — serious, and folded into the primary gap rather than
  competing with it, because the decisive measurement is uninterpretable without a
  comparator and the comparator is part of the same request matrix.
- **"Personality plasticity is disabled" (rank 5)** — the most tempting-looking gap, and the
  most dangerous to fix first. It is *implementation*, and the repository's own recommendation
  is `Should CharacterOS Core Continue Expanding? NO`. Enabling a dormant slow layer to make
  the multi-timescale story true would be building on an unproven foundation.
- **"No decision/action endpoint" (rank 4)** — a genuine blocker for the full chain
  `state → cognition → decision → behaviour`, but it is a *design choice to be made inside*
  the primary experiment, not a separate gap: the experiment must select a measurable
  decision proxy. It is therefore a required clause of the design, not a competing priority.
- **"Personality differentiation is not demonstrated" (part of Q2)** — the experiments are
  null at N=3 scenarios / 6 calls, which is too small to carry either reading. Not primary;
  it is a power problem inside a question the primary gap will re-open anyway.
- **"`pnpm test` is red" (rank 10) and the two doc-drift findings** — real, cheap, and
  worth folding into the next slice, but they are hygiene; they block no proposition.

### Why the brief's History Internalization Test is *accepted but re-centred*

The brief's sketched design — identical initial subjects → different long-term life
trajectories → **remove raw history** → same novel test environment → compare → intervene →
restart → baseline — is the right instrument. Two amendments are required by the evidence:

1. **The repository already has different trajectories.** It has 216 episodes of a real
   subject, and a two-trajectory (A/B) real-provider measurement. Re-running "different
   trajectories" without the removal arm would reproduce exactly the result that already
   exists and would measure retrieval again.
2. **Therefore the decisive part is the *history-removal* arm, and the shortest path to it
   is to run it against the subject that already exists**, before spending a new long
   trajectory — especially because the existing subject's internalized state is *saturated*
   (P3 rank 3), so a fresh trajectory would first have to be shown to produce non-saturated
   differentiated state. The cheapest decisive measurement is the **State-Isolation
   Differential** on a disposable copy of the existing Alice plus a genesis twin.

Hence the recommended single action is Phase 0 of `HISTORY_INTERNALIZATION_TEST_V1`, with
the full two-trajectory design retained as the authorised follow-on if Phase 0 is
inconclusive rather than negative.

---

## 3. Falsification conditions for the primary gap

The gap is closed *negatively* — and the internalization line must then be declared
unjustified — if any of the following holds under the Phase 0 protocol:

1. **State-isolation null.** With the memory evidence section removed from both requests
   (machine-verified removal, `ablation_target_evidence_absent: true`), the lived subject's
   structured cognition is indistinguishable from the genesis twin's across the frozen
   scenario set, at a rate inside the measured same-request noise floor.
2. **Retrieval-only sufficiency.** With the state lines neutralized but retrieval intact, the
   lived subject is still fully separated from the genesis twin — i.e. all discriminating
   signal is retrievable text.
3. **Saturation erasure.** The state-isolation differential is non-zero but the *paired*
   comparison is dominated by same-request variance (the failure mode that killed
   `non-memory-state-value-ablation-v0`), and no state contrast can be produced that exceeds
   that band even after a purpose-built trajectory.
4. **Baseline camouflage.** The lived subject's advantage over B0/B1/B2 is not larger than
   the genesis twin's advantage over the same baselines — i.e. the "CharacterOS" identity
   adds nothing over the generic self-referential-context effect.

The gap is closed *positively* if the state-isolation differential is stable, exceeds the
measured same-request noise band, survives an intervention on a named state, survives
`persist → shutdown → restore → retest`, and exceeds the corresponding difference for
B0/B1/B2.

---

## 4. What must NOT be done next (explicit non-authorisations)

Recorded because the temptation is real and the repository's own rules forbid it:

- Do **not** enable `personality_adaptation_enabled` to make the multi-timescale story true.
- Do **not** build consolidation, habits, goals, preferences or trust.
- Do **not** add cross-domain coupling to manufacture layered timescale behaviour; the
  isolation law is a deliberate design decision and no evidence asks for it to be relaxed.
- Do **not** relax a frozen verdict, judge threshold or host-validity gate to obtain a
  positive result. The `0.850 < 0.900` refusal in `familiarity-context-mediation-replication-v1`
  is the correct precedent.
- Do **not** re-run the belief-causal confirmatory V1 outside a new preregistration and a
  new authorisation point.
- Do **not** cite `durable-life-history-…-divergence-v0` as evidence of absence, or
  `affect-driven-behavior-experience-memory-causal-chain-v0` as a behavioural chain.
- Do **not** treat the 216-episode durable store as an evidence artifact anyone else can
  audit until bounded derived tables are committed.

---

## 5. Secondary actions worth folding into the same slice (none is a core change)

Ordered; all are cheap and none competes with the primary gap:

1. **Gate the two ungated product test files** (`query-aware-retrieval.test.ts`,
   `recall-evidence-selector-wiring.test.ts`) on provider availability, exactly as the other
   three real-provider suites do, so `pnpm verify` tells the truth on a clean checkout.
2. **Re-run the `non-memory-state-value-ablation` design at current HEAD**, now that Belief,
   Relationship and Personality are configured, so the repository's strongest negative
   statement about itself describes the system it actually has.
3. **Commit the bounded derived tables** from the existing long-run (per-turn metric rows,
   recall-probe outcomes, restart comparison rows — no prompts, no credentials, no raw
   transcripts), so the longitudinal claims become auditable from a clone.
4. **Correct two documentation over-reads**: `packages/README.md`'s "deferred empty packages"
   claim about `belief`/`personality`/`relationship`/`behavior`, and
   `CURRENT_STATE.md` §3's `CONFIRMED / CAUSALLY_VALIDATED` label on
   `Lived-history → behavior differentiation`, whose own row already ends
   "production behavior change = 0" and whose artifact declares "Providers are deterministic
   fakes (no Ollama)".

---

## 6. Summary

| | |
|---|---|
| Primary gap | No measurement of the internalized-state channel with history removed, and no baseline to attribute it to CharacterOS. |
| Why not consolidation | Means, not end; unjustified until the primary gap reports. |
| Why not baselines alone | Folded into the primary gap's request matrix. |
| Why not personality | Implementation on an unproven foundation; the repository's own recommendation is not to expand. |
| Next experiment | `HISTORY_INTERNALIZATION_TEST_V1`, Phase 0 = State-Isolation Differential on a disposable copy of the existing 216-episode subject + genesis twin. |
| Expected cost | Read-only, disposable copies, existing ablation seam, bounded real-provider calls. No core change, no new mechanism. |
| If it fails | The internalization line is declared unjustified; investment moves to whichever channel is shown to carry consequence. |
| If it passes | First `E4`+`E6`-shaped result for the North Star claim. |
