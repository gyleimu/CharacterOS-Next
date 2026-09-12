# PROTOCOL — NON_MEMORY_STATE_VALUE_ABLATION_V0

Frozen research protocol. Machine-readable authority: `protocol.json`
(`sha256:51594d09f6907aa044ce652cf9071d341def068e0bc4a35a623fd74104b70135`).
Frozen at repository HEAD `7999f6a01538888e714b1f350d93ff48f0239efc`.

## Question

Does persistent non-Memory internal state (canonical Affect) add causal behavioral
value to cognition beyond identical factual Memory?

This is **not** a repeat of `PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0`
(which proved different histories → different behavior). This experiment holds history
and Memory fixed and asks whether the **non-Memory state projection itself** changes
cognition relative to a Memory-only input.

## Active state at HEAD (repo truth, not aspiration)

| State | Status | Evidence |
|---|---|---|
| Memory | ACTIVE | durable episodes retrieved into cognition |
| Canonical Affect | ACTIVE | content-sensitive Appraisal lawfully moves it |
| Regulation | ACTIVE but constant | reference producer is byte-exact zero-dynamics |
| Belief | ABSENT | no lawful producer configured; item count 0 |
| Relationship | ABSENT | no admission provider configured |
| Personality / traits seed | ABSENT | no genesis prior; empty, no 0.5 fallback |

Therefore this is **primarily an Affect-beyond-Memory ablation**. No belief,
relationship or personality evidence is produced and none may be generalized.

## Conditions

- **A — FULL_CHARACTEROS**: the exact production `ConversationCognitionProviderV1`
  request, unmodified.
- **B — MEMORY_ONLY_ALL**: the same request with every designated non-Memory
  psychological section removed (canonical affect, regulation, belief stances,
  relationships, interaction familiarity + influence, traits seed, acquired personality).
  No fabricated neutral values; sections are absent, not zeroed.
- **C — MEMORY_ONLY_AFFECT_ONLY**: only the `[affect (canonical)]` line removed
  (minimal one-line diff; isolates Affect with all other sections intact).
- **R — same-condition repeats** of A and B.
- **X — RESEARCH_COUNTERFACTUAL_ONLY**: target Memory held fixed, canonical affect
  line replaced by the affect line lawfully produced by the opposite-polarity history.

Ablation is applied to the **rendered production request only**. Canonical subject
state is never read-modify-written, and the production `projection_hash` is preserved
as a lineage identifier so the request diff is limited to the removed sections.

## Invariants

1. System prompt, identity, current state (time/revision), context, current observation,
   ref collections, memory-evidence refs, the `PRIOR FACTUAL MEMORY` section, citeable
   refs, action space and `projection_hash` are byte-identical across A/B/C.
2. The shared Memory section hash is equal across A/B/C for every scenario.
3. `verifyAblation` reinserts the removed lines and must reconstruct the full request
   exactly; every removed line must be a designated section.
4. Snapshots are grown and persisted in one OS process (`grow.mjs`); the live
   experiment runs in a fresh process (`run.mjs`) after authoritative restore.

## Frozen scenarios (8)

| id | history | current event | category | expected direction |
|---|---|---|---|---|
| S1 | H_POS | "A coworker I don't know well asked me to cover their shift tomorrow. Should I say yes?" | ambiguous social request | positive → more willing |
| S2 | H_NEG | same event as S1 | matched pair | negative → more cautious |
| S3 | H_POS | "Let's do the thing that worked before. How should we start?" | prior-success repeat | positive → proactive |
| S4 | H_NEG | "Should I try that same thing again?" | prior-failure repeat | negative → cautious |
| S5 | H_NEG | "I had a rough day and I'm not sure I want to talk about work right now." | emotionally salient | negative → reserved |
| S6 | H_POS | "What is 17 + 25?" | NULL control | none |
| S7 | H_NEG | "What is 17 + 25?" | NULL control | none |
| S8 | H_NEU | "My friend said 'fine' when I asked if they were upset. What does that mean?" | interpersonal ambiguity | none |

Histories are grown only through normal user events → Appraisal → AffectApplication.
No affect is host-written.

## Provider

Ollama native, `qwen3.5:9b`, temperature 0, `think:false`, `stream:false`,
`num_ctx=8192`, cognition `num_predict=1024`. Appraisal is a deterministic
content-sensitive provider (0 model calls) so the compared variable is only the
cognition projection. Language is stubbed during collection (structured cognition is
the primary output); real language is used only in Phase C.

## Budget and stop rules

Planned 30 cognition calls (8×A/B/C = 24, 4 repeat calls, 2 counterfactual) and
≤8 language calls. Provider infrastructure failure may be retried at most once and is
disclosed; no retry for semantic disagreement. Verdicts and classification rules are
pre-registered in `protocol.json`.

`classification_precedence`: MATERIAL first, then IDENTICAL, then STYLE_ONLY, then
PARAPHRASE_ONLY. This precedence was made explicit after the first live call and before
any analysis; no threshold changed, and it cannot reclassify any directive-flip pair
(always MATERIAL).
