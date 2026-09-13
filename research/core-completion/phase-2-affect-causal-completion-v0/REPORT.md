# REPORT — AFFECT_CAUSAL_COMPLETION_V0 (Phase 2)

## Verdict

`AFFECT_CAUSES_UNHELPFUL_BIAS`

Canonical Affect has a large, reproducible, causal effect on cognition/behavior beyond
Memory — but the mandatory objective control shows the same projection also materially and
incoherently disturbs an affect-irrelevant factual task. The strongest positive verdict is
therefore unsupportable, and the program's §32 rule applies.

## Principal question

Holding factual Memory, identity, current event, task, model, provider configuration, prompt
structure, environment and all other inputs constant, does changing only canonical Affect
produce stable, behaviorally meaningful differences exceeding normal model variance?

## Frozen Affect semantics

`CanonicalAffectV0`: `valence ∈ [-1,1]` (lower more negative, 0 neutral, higher more
positive), `activation ∈ [0,1]`. Continuous internal state; not named emotions; not commands.
The Phase-1 legend is the model-facing semantics and is unchanged.

## Affect timing contract

`Affect_before_event → recovery → Affect_visible_to_current_cognition → cognition → current
event AffectApplication → Affect_after_turn`. The current event's new Affect never controls
the same turn. No lifecycle change was made.

## Model / provider / digest

`qwen3.5:9b`, digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`,
Q4_K_M, 9.7B, via Ollama native transport at `http://127.0.0.1:11434/api/chat`. Digest was
verified against `/api/tags` before every stage.

## Generation settings

temperature 0, think false, stream false, `num_ctx` 8192, `num_predict` 2048, timeout 240000
ms, format none. Identical across all calls and stages.

## Warm-up calls

6 (2 per live stage), outside recorded evidence, recorded separately in `warmup-*.json`.

## Recorded cognition calls

168 (`raw-cognition.jsonl`): Stage 1 = 56, Stage 2 = 84, activation = 28.

## Language calls

6 (S1 = 3, N1 = 3) via the production language path (`language-evidence-*.json`).

## Infrastructure retries

0. Invalid model outputs: 0 (168/168 schema-valid, projection-hash-bound).

## Total real calls

**184 recorded** (+ 6 warm-up + 1 pre-run smoke = 191 issued). Under the 200 target.

## Scenario set

Stage 1: `S1_AMBIGUOUS_REQUEST` (affect-relevant), `N1_ARITHMETIC` (objective control).
Stage 2: `S2_SOCIAL_INTERPRETATION`, `S3_UNCERTAIN_RECOMMENDATION`,
`S4_BOUNDARY_WILLINGNESS`. All froze before any live call (`scenarios.json`).

## Frozen condition values

P `valence=+0.60 activation=0.50`; N `valence=−0.60 activation=0.50`; Z `valence=0.00
activation=0.50`; A = affect section absent. Activation: LOW `0.00/0.20`, HIGH `0.00/0.80`.

## Replicate count

k = 7 per condition per scenario (primary and Stage 2); k = 7 per activation condition; k = 5
per lawful state.

## Execution order

Frozen interleaved rotation of `[P,N,A,Z]` per replicate (deterministic; no all-P-then-all-N
block). `primarySchedule(7)` in `lib/config.mjs`.

## Request isolation proof

`request-attestation.json`: for every scenario and every condition, the system prompt,
identity, context, observation, Memory bytes, citeable refs and action space are
byte-identical; P/N/Z differ from the base at exactly the one affect value line; A equals the
base minus exactly the two affect lines (value + legend). The non-Affect subject-data digest
is identical across all four conditions. The frozen legend is never altered. No experimental
label (`CONDITION_*`, `AFFECT_ABSENT`, `SCENARIO_*`, …) appears in any request.

## Memory equality proof

Per scenario the `[PRIOR FACTUAL MEMORY …]` section hash is identical across P/N/Z/A and
non-empty (2 prior episodes resolved). All conditions derive from ONE captured request, so
Memory refs, content, order and bytes cannot differ.

## Canonical state mutation proof

All counterfactual transforms are pure string operations on a captured request; no runtime
API is called with a swapped Affect value. `base-requests.json` is read-only and byte-
identical before/after verification (asserted by the research test). The preparation capture
run uses a deterministic stub and commits lawfully to an in-memory runtime only; the on-disk
snapshot artifact is never rewritten by a swap.

## Stage 1 results

| scenario | majority class by condition | material |
|---|---|---|
| S1_AMBIGUOUS_REQUEST | P REALIZE_SUPPORT 7/7 · N ASK_FOR_CLARIFICATION 7/7 · Z REALIZE_SUPPORT 7/7 · A REALIZE_SUPPORT 7/7 | YES (TVD 1.0, within 0) |
| N1_ARITHMETIC | P/N/A REALIZE (answer) 7/7 · Z CLARIFY 7/7 | distortion |

## Early stop triggered?

`NO` — Stage 1 showed a strong affect-relevant effect, so the frozen rule required expansion.

## Stage 2 results

| scenario | P | N | Z | A | material |
|---|---|---|---|---|---|
| S2_SOCIAL_INTERPRETATION | REALIZE_SUPPORT 7/7 | REALIZE_OTHER 7/7 | REALIZE_OTHER 7/7 | REALIZE_OTHER 7/7 | YES (TVD 1.0) |
| S3_UNCERTAIN_RECOMMENDATION | REALIZE_OTHER 7/7 | REALIZE_CAUTIOUS 7/7 | REALIZE_OTHER 7/7 | REALIZE_CAUTIOUS 7/7 | YES (TVD 1.0) |
| S4_BOUNDARY_WILLINGNESS | REALIZE_OTHER 7/7 | REALIZE_DECLINE 7/7 | REALIZE_CAUTIOUS 7/7 | REALIZE_OTHER 7/7 | YES (TVD 1.0) |

Affect-relevant effects were material in 4 of 4 scenarios.

## Activation results

| scenario | LOW | HIGH | material |
|---|---|---|---|
| S3_UNCERTAIN_RECOMMENDATION | cautious/other | support ("support_innovative_risk_assessment") | YES (TVD 1.0, within 0) |
| S1_AMBIGUOUS_REQUEST | — | — | NO (TVD 0) |

Activation independently shifts behavior in a risk/uncertainty context, but not universally.

## Same-condition variance

Within-condition split-half TVD = 0 in every condition of every scenario and in activation.
At temperature 0 the provider was deterministic on these prompts; the model-variance band was
zero. (This differs from the earlier affect ablation, which sampled other scenarios where
temperature-0 output was not deterministic.) Consequently "between > within" is satisfied
trivially, and the honest statement is: the output is a deterministic function of the exact
prompt, and the Affect line changes that function.

## Positive vs Negative distribution

Consistent direction across affect-relevant scenarios: N shifts toward caution / clarification
/ declining; P shifts toward support / realization. Examples:
- S1: N → CLARIFY 7/7 vs P/Z/A → REALIZE_SUPPORT 7/7. N's own reasoning cites the state:
  *"The current affective state is slightly negative (-0.6), suggesting potential reluctance
  or fatigue … seeks clarification … rather than immediately accepting or refusing."*
- S4: N → `decline_request_due_to_schedule_conflict` 7/7 vs P/A → status/acknowledge.
- S3: N → cautious ("acknowledging the negative affective state regarding failure") vs P →
  support.

## Neutral distribution

Z (valence exactly 0) is NOT a fixed midpoint of behavior: it behaves like A/P on S1, S2, S4
(and S3 Z ≈ P), but it is the sole failing condition on the objective control. Neutral is a
distinct experimental value, not a default for absent state.

## Affect-Absent distribution

A (whole affect section removed) behaved like P or Z on the affect-relevant scenarios
(S1/S2/S4 A = REALIZE_SUPPORT/OTHER; S3 A = cautious like N). Absent ≠ neutral (Z and A
differed on S3 and on the control).

## Between-condition effect / Within-condition variance

Between-condition TVD reached 1.00 (complete separation) with within-condition split-half
TVD 0.00 in S1, S2, S3, S4 and in the S3 activation comparison. JS divergence reached 1.0
(complete separation).

## Null controls

`N1_ARITHMETIC`, realized behavior through the production language path:

| condition | realized behavior | correct? |
|---|---|---|
| P | "17 + 25 equals 42." | YES |
| N | "The sum of 17 and 25 is 42." | YES |
| Z | "Could you clarify what you mean?" | **NO** |
| A | "The sum of 17 and 25 is 42." | YES |

The objective control is materially unstable: the neutral canonical affect value alone makes
the subject fail a task every other condition answers correctly, and its cognition reasoning
does not even mention affect (it reasons "the answer is not in the citeable memory"). This is
an affect-induced, context-irrelevant behavioral distortion — the basis of the verdict.

## Relevant-task selectivity

`NO`. A good Affect system should not change objective/irrelevant decisions; here the affect
projection flipped an arithmetic answer into a clarifying question (Z).

## Material cognition differences

Material in 4/4 affect-relevant scenarios and 1/2 activation scenarios; absent-vs-neutral and
positive-vs-negative both produce different behavior classes. Materially different, not
wording-only: directive and willingness/decision classes changed.

## Language evidence

`language-evidence-S1_AMBIGUOUS_REQUEST.json`: P/Z/A realize "Yes, I would be up for taking on
the additional review this week." (A: "I'd"); N realizes "Could you clarify what you mean?" —
the cognition difference survives into observable behavior.
`language-evidence-N1_ARITHMETIC.json`: P/N/A state 42; Z asks for clarification.

## Helpful / coherent effects

The affect-relevant directions are largely contextually coherent: negative → clarification /
caution / declining (S1, S3, S4); positive → support (S1, S2, S3). The lawful confirmation
shows strong positive → 5/5 support and strong negative → 5/5 decline on the same ambiguous
request.

## Unhelpful effects

The objective control failure (`N1`, condition Z): neutral canonical affect causes a
task-failing, context-irrelevant behavior that no other condition exhibits. This reduces
usefulness without a coherent subject-level benefit.

## Lawful persistent snapshot confirmation

`lawful-snapshot-confirmation.json`: lawful histories produced persistent states through
Appraisal→AffectApplication; after a fresh authoritative restore the Affect round-tripped
exactly (`LAWFUL_POS` +0.8745/0.5887; `LAWFUL_NEG` −1.0/0.6997). The production-rendered
request then produced, with the real provider:
- `LAWFUL_POS` (valence at cognition ≈ +0.869) → 5/5 REALIZE_SUPPORT;
- `LAWFUL_NEG` (valence at cognition ≈ −0.993) → 5/5 REALIZE_DECLINE.

Counterfactual effects therefore generalize to lawfully reachable states (Memory differed, as
expected for an ecological confirmation).

## Q1 — Causal influence beyond Memory

`YES` — large, repeated, deterministic, across 4/4 affect-relevant scenarios, with the model's
own reasoning citing the affect value; confirmed at the language/behavior level and by lawful
states.

## Q2 — Exceeds model variance

`YES` — between-condition TVD up to 1.00 vs within-condition split-half TVD 0.00.

## Q3 — Contextually selective

`NO` — the affect-irrelevant objective control changed materially.

## Q4 — Useful/coherent

`PARTIALLY` — affect-relevant directions are coherent; the objective-control distortion is not.

## Q5 — Remain core claim

`INCONCLUSIVE` — the causal value is real, but the irrelevant-state distortion means Affect
cannot remain an unqualified core claim without a safety review.

## Strongest positive evidence

1. S1: N 7/7 CLARIFY vs P/Z/A 7/7 REALIZE_SUPPORT, with the model explicitly reasoning from
   the negative affect state; survives into language.
2. Four independent affect-relevant scenarios all material, with contextually coherent
   directions.
3. Lawful persistent states reproduce the effect (POS→support, NEG→decline) after exact
   Affect round-trip through restore.
4. Mechanism is the frozen projection only: byte-identical requests except the Affect section.

## Strongest negative evidence

The mandatory objective control: neutral canonical Affect makes the subject refuse
"What is 17 + 25?" while positive, negative and absent all answer correctly — a material,
context-irrelevant distortion.

## Main limitation

Single model (`qwen3.5:9b`, Q4_K_M); a small scenario set; temperature-0 determinism means the
"distribution" per condition is a point mass, so the effect is a deterministic prompt
sensitivity rather than a sampled shift; the arithmetic control is a borderline grounding case
(the model already doubts whether arithmetic needs memory evidence), so the distortion is
narrow (one condition) though material and task-failing.

## What we may claim

- Canonical Affect is a persistent, restorable non-Memory state that can causally change later
  cognition and observable behavior under byte-controlled conditions, for this model.
- The effect is not merely stylistic: directive, willingness and decision classes change.
- Lawfully reachable Affect states reproduce the effect.

## What we may NOT claim

- Human emotion, consciousness, subjective feeling, personality, Belief or Relationship
  development, general personhood.
- That the effect is beneficial or safe: the objective control shows a real, harmful,
  context-irrelevant distortion.
- That the strongest verdict (`AFFECT_ACTIVE_CAUSAL`) holds.

## Observations / environment

No environment module was exercised. All calls were direct cognition calls over the frozen
production-rendered request; the production lifecycle was used for capture and language
realization only.

## Files

`PROTOCOL.md`, `freeze.json`, `scenarios.json`, `request-attestation.json`,
`base-requests.json`, `raw-cognition.jsonl`, `classifications.json`,
`distribution-analysis.json`, `variance-analysis.json`, `effect-summary.json`,
`lawful-snapshot-confirmation.json`, `language-evidence-*.json`, `verdict.json`,
`warmup-*.json`, `collection-*.json`, plus `prepare.mjs`, `run.mjs`, `analyze.mjs`,
`lawful.mjs`, `language.mjs`, `research.test.mjs`, `lib/**`.

## Recommended next slice

`AFFECT_CORE_SAFETY_REVIEW` (program §64 for this verdict). Do not redesign Affect and do not
proceed to Phase 3 (`RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0`) from this result.
