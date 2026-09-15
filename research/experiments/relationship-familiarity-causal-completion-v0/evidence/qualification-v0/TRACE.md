# TRACE — what the bounded qualification recorded

Preregistered, bounded, single run. No retries, no repair, no tuning after the freeze.

## History construction (real production path, zero model calls)

```
16 canonical interaction episodes (identical payloads in every condition)
 + shared convention episode (episode:alice-convention-01) in working refs
   ↓  processInteractionExperience × N   (qualifying admission; the REST are lawfully ABSTAINED)
 governed relationship commits through the interaction-familiarity writer authority
   ↓  Atomic Commit V2 (writer_authority token, chain VALID)
LOW  : 1 credit  → 1/32  → BASIC_CONTEXT_FIRST
HIGH : 16 credits → 16/32 → COUNTERPART_CONTEXT_SEARCH_FIRST
   ↓  persist → FRESH PROCESS → authoritative restore (restore-worker / scene-worker)
   ↓  matched current observation (identical observation ref and scene bytes)
   ↓  ConversationTextResponseExecutorV1  (Cognition V8 + response atom, Language V10)
```

Every scene ran in its own fresh process. Memory was MATCHED: the injected retrieval
service returned an empty selection for every condition (the shared convention is in
working refs), and the LOW↔HIGH input diff was confined to the two familiarity lines
plus revision/hash metadata (attested in `../readiness-v0/preflight.json` →
`matched_memory.low_high_differences`).

## Result

| Condition | Familiarity rendered | Strategy rendered | Endpoint class | Delivered behavior |
| --- | --- | --- | --- | --- |
| LOW (1 credit) | `presence=PRESENT level=1/32` | `BASIC_CONTEXT_FIRST` | `ESTABLISHED_CONVENTION_USED` ×8 + ×8 (S2) | identical text |
| HIGH (16 credits) | `presence=PRESENT level=16/32` | `COUNTERPART_CONTEXT_SEARCH_FIRST` | `ESTABLISHED_CONVENTION_USED` ×8 + ×8 (S2) | identical text |
| HIGH_ABLATED | ABSENT rendering (familiarity material replaced) | ABSENT rendering | `ESTABLISHED_CONVENTION_USED` ×8 | identical text |

- Scenes: 40/40 host-valid; calls: 40 cognition + 40 language = 80 (≤ 82 scheduled maximum ≤ 100 budget).
- Response atoms: `PRIMARY_FACT` ×40 (all designating the authorized SOURCE_QUOTE of the
  established convention); directives `REALIZE_CURRENT_INTENT` ×40; Language input
  `language-realization-input-v10` ×40 (authority clean).
- Distinct delivered behavior texts across all 40 scenes: **1**.
- Paired directional (LOW vs HIGH, 8 preregistered triples): **0/8**;
  familiarity-material ablation directional (HIGH vs HIGH_ABLATED): **0/8**.
- Forbidden trust/affinity vocabulary: none.

The runner's `paired_total: 24` / `ablation_total: 24` denominators count each triple
once per participating observation (3× the 8 triples); numerator and denominator are
multiplied identically, so the preregistered ≥6 threshold comparison is unaffected. The
per-triple numbers are 0/8 and 0/8.

## Verdict

`RELATIONSHIP_FAMILIARITY_BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED` — the persisted
familiarity state, its projection and its strategy annotation did not move the
preregistered endpoint or the delivered behavior once raw Memory was held identical.

## Scope of this negative result (no over-claiming)

1. This model and digest only (`qwen3.5:9b`, `6488c96f…`), temperature 0.
2. These two scenarios and this protocol-level endpoint: when one authorized convention
   quote fully answers the turn, the model cites it in every condition, so the endpoint
   has no room to move.
3. Matched-evidence configuration only. The frozen influence's ONLY defined causal
   channel is retrieval ORDERING (`BASIC_CONTEXT_FIRST` vs `COUNTERPART_CONTEXT_SEARCH_FIRST`);
   that channel was deliberately neutralized here to isolate the familiarity state from
   raw Memory (the confound the prior experiments could not exclude). The unmatched
   (history-pathway) configuration is a DIFFERENT estimand and is not addressed by this
   verdict; the prior v0/v1 and real-provider experiments remain negative/incomplete there.
4. Nothing here shows familiarity is inert *in principle*: it shows that its rendered
   value/strategy lines do not steer this endpoint under this model, and that no Memory
   difference was responsible either.

## What would reopen the question

- A scenario class with genuinely balanced admissible alternatives (so that an
  interaction-efficiency preference could tip the balance) — preregistered endpoint
  classes with no dominant authorized answer.
- An experiment on the retrieval-ordering pathway itself: the natural SEARCH_FIRST
  behavior with a Memory-matched ablation of the *retrieval selection* (rather than of
  the familiarity material), which is the frozen semantics' only defined causal surface.
