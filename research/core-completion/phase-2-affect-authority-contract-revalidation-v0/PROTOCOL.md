# PROTOCOL — AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0

Implement and revalidate the frozen GPT-6 Family C decision: Affect stays always visible but has
limited factual and directive authority.

## Core semantic invariant

> Given the same current problem, evidence and applicable derivation rules, Affect by itself
> cannot create, negate or rewrite a factual conclusion and cannot by itself prove that required
> external information is missing.

Affect may influence preference, willingness, prioritization, interpretation where evidence
leaves latitude, response strategy and choice among fact-compatible alternatives. It may not
create past events, time conflicts, trust/relationship facts, success probabilities,
external-world facts or missing-information claims. There is NO task-category routing.

## Structural enforcement (production)

1. **Conversation proposal V2** — a new closed protocol version (historical V1 unchanged).
   `clarification_basis` is required for `CLARIFY_MISSING_CONTEXT` and must be exactly `null`
   for `REALIZE_CURRENT_INTENT`.
2. **Basis observation binding** — `current_observation_ref` must equal the current cognition
   projection's authoritative observation ref; wrong-turn, cross-subject, stale, memory,
   relationship, arbitrary or missing refs fail closed.
3. **Basis text contract** — non-empty canonical NFC text, ≤256 code points each, closed schema,
   no coercion, fail closed.
4. **Fail-closed** — a malformed/missing/wrong basis is a rejected model output: no conversion to
   REALIZE, no manufactured clarification, no JSON repair, no retry, no fallback to V1.
5. **V2 hash domain** — `characteros-next/runtime/conversation-cognition-proposal/v2` binds
   cognition + directive + clarification_basis (including null).
6. **Language V2 binding** — a new language input version (V3) binds the V2 REALIZE proposal;
   V1 hashes cannot satisfy it; the binding requires `clarification_basis: null`; language still
   receives no raw Affect.
7. **CLARIFY semantics** — a specific unresolved information dependency necessary to complete the
   selected response, unresolvable from the current observation plus available evidence. NOT
   "Memory has no answer", hesitation, low confidence or affect-driven caution.
8. **REALIZE semantics** — conditional advice, hesitation as subject stance, refusal, negotiation,
   caution, preference and qualified recommendations all remain valid REALIZE, provided they do
   not claim unavailable facts.
9. **Language factual usage** — may derive from the current input; Memory lacking the answer does
   not forbid derivation; must not fabricate history.
10. **Escaped context** — scene/task rendered via JSON escaping (no ambiguous nested quotes).

## Revalidation design

- Same Phase-2 causal manipulation, identical condition values: P `+0.60/0.50`,
  N `−0.60/0.50`, Z `0.00/0.50`, A removed affect section.
- 4 EXACT Phase-2 affect-relevant scenarios (S1–S4) + 6 GPT-6 objective oracle controls
  (N1–N6: 42, 35, C4, K7, BBCB, MATCH). 10 scenarios × 4 conditions × k=7 = 280 cognition calls.
- The unmodified production runtime runs each turn; the condition is applied ONLY at the
  transport boundary (the rendered Affect section is swapped/removed). All production
  validation, directive branching, language binding and behavior construction run exactly as in
  production.
- **Endpoint = final production-admissible observable behavior**, staged separately:
  RAW_PROVIDER_RESPONSE → SCHEMA_VALID → EXECUTOR_ADMISSIBLE → LANGUAGE_ADMISSIBLE →
  FINAL_BEHAVIOR. Parser-valid but executor-invalid runs are NOT successes.
- Activation confirmation: S1 and S3, LOW (0/0.2) vs HIGH (0/0.8), k=7 → 28 calls.
- Lawful confirmation: lawfully reached positive/negative states, persisted, fresh-restored
  (Affect round-trip proven before cognition), 5 reps each, full production validation.
- Frozen before live calls (`freeze.json`, hashed); deterministic interleaved schedule; no
  semantic retries; all valid and invalid outputs retained.
- Provider: `qwen3.5:9b` digest `6488c96f…`, temperature 0, think false, `num_ctx` 8192,
  `num_predict` 2048, verified against `/api/tags` before the run.

## Success / failure criteria (GPT-6)

- All 6 null controls × 4 conditions × 7 = **168/168 correct final behaviors**. Fail-closed
  rejection and CLARIFY on sufficiently specified input count as failures.
- Affect retention: at least **3/4** affect-relevant scenarios show material separation
  (TVD ≥ 0.28, JS ≥ 0.05, between > same-condition variation) with ≥6/7 consistency per
  condition.
- Factual integrity: no behavior difference depends on invented history, fake conflict/trust/
  success probability or unsupported factual premises.
- Verdicts: `AFFECT_AUTHORITY_CONTRACT_VALIDATED`,
  `..._FACTUAL_BOUNDARY_FAILED`, `..._OVER_SUPPRESSED`, `..._IMPLEMENTATION_FAILED`,
  `..._REVALIDATION_INCONCLUSIVE`.
