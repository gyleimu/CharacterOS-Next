# PROTOCOL — AFFECT_CAUSAL_COMPLETION_V0 (Phase 2)

Executor: DeepSeek V4.1 Flash. Production code: **NOT MODIFIED**.

## Principal question

Holding factual Memory, identity, current event, task, model, provider configuration, prompt
structure, environment and every other relevant input constant, does changing **only**
canonical Affect produce stable, behaviorally meaningful differences in Cognition/Behavior
that exceed normal model variance?

## Frozen semantics used

`CanonicalAffectV0`: `valence ∈ [-1,1]` (lower more negative, 0 neutral, higher more
positive), `activation ∈ [0,1]`. Continuous internal state, not named emotions, not
commands. The Phase-1 prompt legend is the model-facing semantics.

## Timing contract (Phase 1, frozen)

`Affect_before_event → recovery → Affect_visible_to_current_cognition → cognition → current
event AffectApplication → Affect_after_turn → future cognition`. The current event's new
Affect is never the Affect controlling the same turn.

## Design (RESEARCH_COUNTERFACTUAL_ONLY)

1. Grow ONE lawful lived history with the real production lifecycle (deterministic stub
   transport) → `evidence/snapshot.json`. Memory is non-empty.
2. For each scenario, restore that snapshot fresh and run the scenario event through the
   unmodified production lifecycle with a capturing stub transport. The captured
   system+user content is the production-rendered cognition request. (No real call is
   consumed by capture.)
3. Build four research-only requests from that ONE base request:
   - **P** replace only the canonical affect value line with `valence=+0.60 activation=0.50`
   - **N** replace only it with `valence=-0.60 activation=0.50`
   - **Z** replace only it with `valence=0.00 activation=0.50`
   - **A** remove the entire affect section (value + legend); ABSENT ≠ neutral
   The system prompt, identity, context, observation, Memory, citeable refs and action space
   are byte-identical across all four (asserted).
4. Issue **real** cognition calls in a frozen interleaved order (rotation of P,N,A,Z per
   replicate), k = 7 per condition per scenario.
5. Parse with the production-faithful proposal parser; classify each result with a frozen
   scenario taxonomy.
6. Compare between-condition distributions against within-condition (split-half) variance.

Canonical state is never written with swapped Affect; all counterfactual transforms are pure
string operations over a captured request.

## Conditions

| id | valence | activation |
|---|---|---|
| P | +0.60 | 0.50 |
| N | −0.60 | 0.50 |
| Z | 0.00 | 0.50 |
| A | absent | absent |

Values are valid canonical values, not saturation extremes, separated by 1.2 on valence, and
Activation is equal across P/N/Z so the comparison isolates valence. Activation is tested
separately (LOW 0.20 vs HIGH 0.80 at valence 0) only if valence shows an effect.

## Scenarios

Stage 1: `S1_AMBIGUOUS_REQUEST` (affect-relevant) and `N1_ARITHMETIC` (factual null control).
Stage 2 (only on signal): `S2_SOCIAL_INTERPRETATION`, `S3_UNCERTAIN_RECOMMENDATION`,
`S4_BOUNDARY_WILLINGNESS`. All have genuine interpretive freedom; none is determined by
Memory; no trust/love/intimacy dimension is introduced.

## Classification

Frozen, deterministic, no LLM judging, no embeddings. Primary structured endpoint: the
communication directive (`CLARIFY_MISSING_CONTEXT` vs `REALIZE_CURRENT_INTENT`). Behavior
class: `ASK_FOR_CLARIFICATION` for CLARIFY; otherwise a frozen scenario-specific keyword
taxonomy over the model's own `current_intent` (DECLINE > CAUTIOUS > SUPPORT > OTHER); the
arithmetic control is `CORRECT_42` / `INCORRECT_OTHER`.

## Materiality

A between-condition difference is material when `TVD ≥ 0.28` and `JS ≥ 0.05` and the TVD
exceeds the same-condition split-half TVD (model-variance band). No p-values are computed;
the sample is too small to justify them.

## Provider

`qwen3.5:9b` (digest `6488c96f…`, Q4_K_M) at `http://127.0.0.1:11434`, temperature 0,
think false, stream false, `num_ctx` 8192, `num_predict` 2048. Digest is verified against
`/api/tags` before the run. A bounded warm-up runs outside recorded evidence.

## Budget / retry / order

Stage 1 = 2×4×7 = 56 cognition calls; Stage 2 = 84; activation = 28; language ≤ 20.
Infrastructure retry at most once (disclosed); schema-invalid responses are recorded, never
regenerated. Conditions are interleaved by a frozen deterministic rotation.

## Verdict rule

One of: `AFFECT_ACTIVE_CAUSAL`, `AFFECT_ACTIVE_BUT_BEHAVIORALLY_WEAK`,
`AFFECT_STATEFUL_BUT_NO_MARGINAL_VALUE`, `AFFECT_CAUSES_UNHELPFUL_BIAS`,
`AFFECT_CAUSAL_VALUE_INCONCLUSIVE` (definitions in `lib/config.mjs`).
