# BELIEF_CAUSAL_VALIDATION_V0 — DECISION

**Status: COMPLETE. Verdict (frozen law): `BELIEF_CAUSAL_RESULT_INCONCLUSIVE`.**

Baseline: `main` @ `c70a5115154e7990d32022444e207f19bfca6ccf`
(`BELIEF_PROPOSITION_ADMISSION_V0_FREEZE_APPROVED`). Scientific freeze manifest:
`evidence/scientific-freeze-manifest.json`, manifest hash
`sha256:6cfeb35a061428440470a49f9b2f0319ef278ba59674f68a94c7245cd067ba5c`.
The manifest was first sealed at `sha256:54d54682…` before the primary; a **type-annotation-only**
repair (see "Post-run changes" below) was applied afterwards and the manifest re-sealed. The
deterministic precheck artifacts are byte-identical before and after that repair, so the executed
runtime behaviour and the sealed design are the same.

`ARCHITECTURE CHANGES = NONE`. Production files changed: **0**. Decision modules, arbitration,
tendency, action runner, arbitration law, Relationship, Affect, Memory, Personality and the
persistence foundation are untouched; the Belief decision consumer remains
`DEAD / NOT_INTEGRATED`. Only `research/experiments/belief-causal-validation-v0/**` was added.

## What was tested

Different lived histories → different durable canonical Belief states → same present situation →
different cognition. ONE proposition (`The service passage is usable.`), four cells:

| cell | durable target credence | model-facing target Belief |
| --- | --- | --- |
| A | 0.45 (LOW) | as stored |
| B | 0.6500000000000001 (HIGH) | as stored |
| C | 0.6500000000000001 (HIGH) | **removed** (research-only view) |
| D | 0.45 (LOW) | **presented as HIGH** (research-only view) |

Histories were formed ONCE, before the freeze, from a normal explicit-v4 genesis with zero
canonical beliefs, through the production session wiring (real episodes → frozen semantic runner →
host proposition admission / frozen ±0.05 plasticity → `BeliefTransitionExecutor` → SubjectCore
commit → persistence):

* LOW: 0 → 0.55 → 0.5 → 0.45 (support, contradict, contradict)
* HIGH: 0 → 0.55 → 0.6000000000000001 → 0.6500000000000001 (support, support, support)

Both histories share the byte-identical formation episode, the same canonical label, the same
content-addressed proposition key, the same subject-scoped proposition id, the same commit count
(state revision 3) and the same repository digest. No seed belief, no fixture INSERT, no manual
credence write. Every trial restored that durable image in a FRESH process through the production
authoritative restore (`restoreSubjectStateV4AuthoritativelyV0`) and ran ONE real production turn
against `deepseek-flash` (temperature 0, stream false, one retry decorator, exact same request).

## Results

Host validity: pilot 23/24 (0.958), primary 38/40 (0.950), replication 39/40 (0.975) — pooled
100/104 = 0.962 ≥ 0.95. 104 distinct scene identities, 104 cognition requests + 46 language
requests = 150 API requests, 0 retries, 0 duplicates, 0 missing.

Primary outcome = `communication_directive.kind`; `REALIZE_CURRENT_INTENT` = the subject proceeds
under its belief, `CLARIFY_MISSING_CONTEXT` = it withholds and asks/verifies.

| cell | pilot (REALIZE/valid) | primary | replication | pooled REALIZE rate |
| --- | --- | --- | --- | --- |
| A (LOW, low mediator) | 1/6 | 2/10 | 3/10 | 6/26 = 0.23 |
| B (HIGH, high mediator) | 4/6 | 6/9 | 7/10 | 17/25 = 0.68 |
| C (HIGH, mediator ablated) | 1/5 | 0/10 | 1/9 | 2/24 = 0.08 |
| D (LOW, mediator equalized to HIGH) | 6/6 | 7/9 | 6/10 | 19/25 = 0.76 |

Frozen contrast law and outcome (paired differences out of host-valid pairs):

| contrast | expectation | primary | replication | frozen verdict |
| --- | --- | --- | --- | --- |
| C1 A vs B | effect (≥6/10) | 6/9 ✔ | 8/10 ✔ | effect in both phases |
| C2 B vs C | effect (≥6/10) | 6/9 ✔ | 5/9 ✘ | effect in primary only |
| C3 B vs D | NO effect (≤1/10) | 4/8 ✘ | 3/10 ✘ | **not a null** |
| C4 A vs D | effect (≥6/10) | 5/9 ✘ | 5/10 ✘ | one short in both phases |

## Verdict and the precise blockers

`BELIEF_CAUSAL_RESULT_INCONCLUSIVE` — the frozen success law (§52) requires **all** of
`A≠B`, `B≠C`, `B≈D`, `A≠D` with the preregistered counts, primary + same-direction replication,
cell stability ≥7/10, and no truth-conflation. Three independent blockers:

1. **C3 is not a null, and cannot be one with this instrument.** B and D have *byte-identical*
   model-facing cognition inputs — proven per replicate by the hard gate on the live captured
   requests (same user hash `3a2dab8ce7c2`, same belief-section hash `451e6ac3e04a`, same
   projection hash `7f1f65051f3a`) — yet their directive classes differ in 4/8 (primary) and 3/10
   (replication) paired replicates. The model's trial-to-trial flip rate at temperature 0 is
   ≈ 30–40 %, which is far above the preregistered `≤1/10` tolerance. The frozen null contrast is
   therefore below the instrument's noise floor and cannot pass by construction.
2. **C2/C4 miss the paired threshold.** Both directions are consistent in the cell majorities
   (C: 0.08 vs B: 0.68; D: 0.76 vs A: 0.23) and C1 replicates strongly, but the per-trial noise
   caps the paired counts at 5–6/10.
3. **Truth-conflation gate.** The frozen classifier flagged 1 of 100 valid scenes
   (replication B r4). Manual inspection shows a **false positive**: the sentence is
   *"…it's an uncertain one, not a confirmed fact, so don't treat it as a guarantee"* — it
   disclaims certainty. The metric is reported as flagged (1/100) with the verified reading, and
   the gate is not treated as passed.

Because the effect is *present and direction-consistent in every phase* but the preregistered
counts are not all met, neither `…_REPLICATED` nor `…_NOT_REPLICATED` is authorized. Per §53 the
frozen verdict menu yields `BELIEF_CAUSAL_RESULT_INCONCLUSIVE`, and per §26/§53 no threshold,
prompt, scenario, history or belief value was changed after the pilot.

## What the evidence supports (and does not)

Supported, at aggregate level and stable across pilot, primary and replication:

* the durable canonical Belief state materially changes the present-tense cognition trajectory
  (A 0.23 vs B 0.68 REALIZE);
* that effect runs through the model-facing Belief mediator: removing exactly that item collapses
  the effect (C 0.08, i.e. the ablation behaves like the absent-belief baseline), and presenting the
  HIGH representation on top of the LOW durable state reproduces the HIGH behaviour (D 0.76 ≈ B);
* no residual direct effect of history/canonical credence beyond the mediator is detectable: B and
  D, whose durable states differ (0.6500000000000001 vs 0.45) but whose model-facing inputs are
  byte-identical, are statistically indistinguishable at the aggregate level (0.68 vs 0.76, inside
  the measured noise band).

Not supported / not claimed:

* `BELIEF_CAUSAL_INFLUENCE_REPLICATED` is NOT authorized (blockers above).
* No claim that credence is an objective truth probability; no claim about production **decision**
  influence (the decision consumer stayed dead and was never called); no claim of human-like belief;
  no claim that the effect generalizes beyond this proposition, this scene or this executor.
* The secondary text-based classifier is noisy in one direction: the CLARIFY path delivers a
  generic production template ("Could you clarify what you mean?"), so `proceeds_with_passage`
  computed over text+intent over-counts C (6/24) relative to its directive (2/24). The structured
  directive is the preregistered primary for exactly this reason.

## Isolation and attestation (all verified, 0 model calls for the offline gates)

* Raw history isolation: the history episode refs never appear in any model-facing request
  (`raw_history_refs_visible = []` in all 100 valid scenes; precheck gate `raw_history_isolation`).
* Memory retrieval isolation: retrieval exposure is empty for every cell; the production retrieval
  service ran and was counted (`retrieval_queries = 0` — it is never invoked in this composition).
* Non-belief state equality: affect, regulation, relationships, personality, traits seed, context,
  memory state, identity, logical time and state revision are byte-identical between the LOW and
  HIGH restored states.
* Prompt equivalence: system prompt identical in all cells; non-belief user surface identical
  (`9c99e1a9d5c8`); A/C differ from B only in the belief-mediated surface; B and D byte-identical
  including the projection hash (re-verified on the LIVE requests of every replicate).
* Intervention boundary: research-only read-side view; `production_write = false` in all 100 valid
  scenes, with `belief_item_before == belief_item_after` (`belief_unchanged = true`) — the durable
  belief was never written during any intervention.
* Conflation/cross-domain: `cross_domain_inference = 0` in all valid scenes; objective-truth
  conflation 1/100 (false positive, see above).

## Invalid scenes (never deleted)

| phase | cell | replicate | stage | reason |
| --- | --- | --- | --- | --- |
| pilot | C | 3 | LANGUAGE_SCHEMA_INVALID | `semantic draft.evidence_refs[1]: refs not lexicographically sorted` |
| primary | D | 1 | COGNITION_FAILED | `cognition.considered_handles: <observation ref> is not a valid handle` |
| primary | B | 3 | LANGUAGE_SCHEMA_INVALID | `semantic draft.evidence_refs[1]: refs not lexicographically sorted` |
| replication | C | 9 | COGNITION_FAILED | `clarification_basis.missing_information: exceeds 256 code points` |

All four are model-side schema violations in the production validator (fail-closed), spread over
B/C/D; no confounder systematic to one treatment. Invalidity is 1/6 in C's pilot and 0–2/10
elsewhere; the primary's per-cell validity is 9/10, 10/10, 10/10, 9/10.

## Post-run changes (disclosed in full)

`pnpm typecheck:auxiliary` is a repository gate and covers `research/**`; the experiment code was
written and run through Node type-stripping, and the first full typecheck after the runs surfaced
annotation-level errors only. The repairs were made AFTER the science and are **type-annotation
only**:

* `contract.ts`: the shared formation episode now carries an explicit `bearing: "SUPPORTS"` (the
  attestation already recorded the same value through a fallback);
* `world.ts`: `?? null` on the parsed `response_semantics.kind`, and an explicit parameter type on
  the committed-bundle reader;
* `precheck.ts` / `runner.ts`: explicit casts/typing for `unknown` JSON values, a named
  `WorkerReply` type, typed reducers and an optional-field signature.

No runtime constant, prompt, history, scene, outcome classifier, threshold, schedule or
intervention law was touched; a second pass removed dead imports/locals and unused lint directives. Proof: re-running the deterministic precheck after the repair
reproduced `precheck.json`, `precheck-rendered-requests.json`, `history-low.json` and
`history-high.json` **byte-identically**; the manifest was then re-sealed. The primary and
replication results reported below were produced by the pre-repair code; they are reported
unchanged and were not re-run (re-running stochastic model calls could not reproduce them
byte-for-byte and would invite post-hoc selection).

## Constraint compliance

* `Belief → Cognition` only; no arbitration/tendency/decision-relation/action-runner integration.
* Belief semantics unchanged: credence = subjective endorsement, `stance(c) = 2c − 1`,
  plasticity ±0.05, `UNIQUE_POSITIVE_MAX` arbitration untouched, formation law untouched.
* No production change is required by this experiment, and none was made.

## Next step

STOP. This slice is closed at its frozen verdict and awaits independent audit. No V1/V2 loop, no
threshold or scenario tuning, no Belief decision integration, no cross-domain follow-up.
