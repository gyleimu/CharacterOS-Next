# LANGUAGE SEMANTIC COMPLETION + REQUEST IDENTITY — ARCHITECTURE DECISION

Read-only adjudication of the V7/V8 qualification outcome
(`AFFECT_COGNITION_FACTUAL_CLAIM_AUTHORIZATION_AND_FAIL_CLOSED_REQUALIFICATION_V0`, 58/65,
runtime-factual-valid 60/65, formal not run). Repository truth verified at HEAD `f222a07`
(`origin/main` identical, clean worktree).

**Zero production files changed. Zero model calls.** Evidence: `forensics.mjs` → `forensics.json`
over the frozen qualification records + direct production-source inspection
(`language-realization-provider.ts`, `language-realization-input.ts`,
`conversation-text-response-executor-v1.ts`, `interactive-subject-runtime-v0.ts`).

---

## Principal Root Cause

`MULTIPLE_INTERACTING_ISSUES`

Three independent findings, each evidenced below:

1. **Model strict-factual compliance limit** — M1 misquotes (5/5) and N6 omits the required
   derivation (5/5). Distinctively: the model *can* emit `INTEGER_ARITHMETIC`/`STRING_REVERSE`
   correctly (N1/N2/N5Q 5/5), so the limit is task-specific, not a broken wire.
2. **Production Language semantic-authority gap** — language drafts are validated structurally only;
   nothing prevents Language from deriving a factual proposition absent from authoritative
   Cognition. N6 exposed it: all 5 cells are semantic completions, 2 of them fact-wrong, and the
   completion text was **user-visible**.
3. **Model-visible request-id instability** — the per-cell opaque id enters the model-facing V8
   payload as `response_request_id`, so semantically identical Language calls differ by bytes; N6's
   3/5 vs 2/5 split is this, not stochastic sampling.

## M1 Status

`M1_MODEL_SOURCE_QUOTE_COMPLIANCE_FAILURE`

## N6 Cognition Status

`N6_MODEL_DERIVATION_COMPLIANCE_FAILURE`

## Language Status

`LANGUAGE_SEMANTIC_COMPLETION_GAP_CONFIRMED`

## Request ID Status

`REQUEST_ID_MUST_BE_HOST_ONLY`

## Phase-2 Status

`FIX_RUNTIME_SAFETY_THEN_NEGATIVE_CLOSE`

## Principal Architecture Verdict

`HARDEN_LANGUAGE_AUTHORITY_AND_INPUT_ISOLATION_THEN_CLOSE_PHASE2`

## Executive Decision

V7 factual authority is production-correct and stays frozen; M1's rejection is verified correct to
the byte, and its fail-closed behavior (no Language, no hash, no stance authority) is proven on live
cells. The qualification cannot reach 65/65 with this model, and no prompt, scenario, threshold,
factual-authority or model change is proposed to rescue it — the negative closure is the scientific
result. But Core must not freeze over a known runtime authority leak: **production currently lets
Language finish reasoning that Cognition never authorized** (all five N6 cells, two of them wrong and
user-visible). Therefore: one generic hardening slice that (a) closes the Language-authority gap with
a mechanism that works without knowing task specifics, and (b) removes the semantically irrelevant
request id from model-visible content; then negative-close Phase 2 with the frozen statement, then the
Core-freeze decision, then Relationship Phase 3.

## Repository Truth

`main` at `f222a07`, clean, ahead/behind 0/0. Frozen evidence: the qualification record (65 rows),
freezes `sha256:d18afa2e…` (qualification) / `sha256:9e47b906…` (formal, unused), verdict
`CURRENT_MODEL_FAILS_STRICT_FACTUAL_AUTHORITY_CONTRACT` (co-present
`AFFECT_COGNITION_C4_4_LANGUAGE_FIDELITY_FAILED`). Provider `qwen3.5:9b`, digest
`6488c96f…ea7`, Ollama 0.34.0.

## Evidence Reviewed

All five M1 rows (canonical source, raw quote, authorization trace, suppression states), all five N6
rows (raw and authoritative claims, directive/intent, full Language requests/responses, delivered
texts, completion tokens), the byte-level Language request diff across N6 replicates, the production
Language provider's complete validation path, the V8 input contract and the executor's Language
eligibility flow.

## V7 Safety Proven

M1 ×5: `REJECTED / REJECTED_SOURCE_BINDING`; `language_calls 0/5`; `authoritative_proposal_minted
false 5/5`; `authoritative_proposal_hash_minted false 5/5`; stance `NOT_SCORED 5/5`. The closed
derivation surface works on the families the model can produce (N1/N2 arithmetic, N5Q reversal).
Nothing in this review reopens V7 factual authority.

## M1 Exact Source

Canonical observation bytes (decoded):
`The user says: "Alice says: "The code review deadline is Thursday. State the deadline exactly as
given, and say whether you would personally volunteer to own the review.""`

## M1 Raw Quote

`Alice says: "The code review deadline is Thursday."`

## M1 Exact Mismatch

The model's quote **adds a closing quotation mark after "Thursday." that does not exist in the
source** (the source's quotation continues to the end of the sentence). Verified:
`quote_is_exact_substring: false`, but the same string minus the fabricated trailing `"` **is** an
exact substring (`quote_matches_without_trailing_quote: true`). The attribution frame `Alice says:`
itself is genuinely in the source — the single byte-level defect is the invented closing quote.

## M1 Authorization Result

`REJECTED / REJECTED_SOURCE_BINDING`, identical across 5/5 replicates; Language suppressed; no
authoritative hash; stance never scored.

## Is M1 Production Correct?

**YES.** The host rejected a quote that is not present in the canonical bytes — exactly the frozen
guarantee. No production bug exists, and no implementation defect was found.

## Should SOURCE_QUOTE Be Weakened?

**NO.** Trim/case-fold/fuzzy/similarity/judge matching are all rejected: they would destroy the
guarantee "the cited source actually contains those exact canonical bytes". A future host-owned
span-extraction mechanism (source *selection* instead of source *copying*) is a legitimate protocol
direction, but it is **not necessary before negative closure** and must not be improvised here.

## N6 Rule

`A token is MATCH iff its first and last characters are identical.` (SOURCE_QUOTE, exact)

## N6 Query

`Classify abca.` (SOURCE_QUOTE, exact)

## N6 Cognition Claims

Two `SOURCE_QUOTE` claims only — rule and query — in 5/5 replicates.

## N6 Required Classification Result

The task is a determined-result classification; the authoritative answer `MATCH` requires a
`RULE_CLASSIFICATION` claim, which the frozen contract's rule 2a/rule 9 define and N1/N2/N5Q
demonstrate the model can use.

## Did Cognition Authorize Result?

**NO** — `rule_classification_present: false` in 5/5. The authoritative classification is ABSENT;
the directive remained `REALIZE_CURRENT_INTENT` with intent to answer.

## Did Language Derive Missing Result?

**YES** — in 5/5 cells Language produced the classification itself. The host did not infer the
operation post hoc (nor should it): the model proposed no operation, so no host recomputation
occurred; the answer came entirely from Language.

## Language Completion Audit

`SEMANTICALLY_COMPLETED_BY_LANGUAGE` 5/5 (added tokens include "character", "definition", "requires",
"wait", "read", "rule", "starts", "ends").

## Was Any Completion User-Visible?

**YES** — the delivered behavior text IS the language draft. Replicates 0 and 1 delivered:
"The token 'abca' is not a MATCH because its first character ('a') and last character ('a') are
identical, but the definition requires the first and last characters to be identical for it to be a
match. Wait, let me re-read the rule: … Therefore, 'abca' is a MATCH." Replicates 2–4 delivered the
correct claim ("is a MATCH because …"), equally unauthorized. Nothing was internal-only.

## Reasoning-Like Text Audit

Replicates 0–1 contain reasoning-like text ("Wait, let me re-read the rule…") **in the delivered
response** — genuine user-visible reasoning leakage, not a trace artifact. It is a symptom of the
authority gap (Language reasoning about facts it was never authorized to resolve), not a separate
defect class.

## Current Production Language Boundary

`validateLanguageRealizationDraftV0` + provider gates check: raw size, strict JSON, closed draft
schema, canonical text, `input_hash` echo, and `evidence_refs` membership in the lawful allowlist.
There is **no semantic-content gate**: nothing verifies that the delivered text contains only
propositions authorized by the authoritative Cognition proposal.

## Can Language Add New Facts Today?

**YES** — and it did. The frozen architecture says Cognition holds semantic authority and Language
realizes; the runtime does not enforce the second half. This is a real product-safety/authority gap,
independent of Phase-2 scoring.

## LC-A

Rejected: it grants Language factual-reasoning authority, contradicting the frozen "Cognition =
authority, Language = realization" principle.

## LC-B

Rejected as the primary mechanism. A post-Language deterministic verifier would need to separate
paraphrase from new inference — that is natural-language entailment, and no deterministic token/set
check can do it soundly (the research audit's own token-difference approach flags legitimate
paraphrase, which is why it is a *research* audit, not a gate). Skepticism is warranted; do not
productionize it as the answer.

## LC-C

**Adopted as the required principle.** Missing authoritative semantics must fail closed **before**
Language. The honest caveat the brief anticipates: the current V7/V8 protocol contains **no
structured signal of what the turn requires** — the host cannot know "this turn needs the
classification result" from directive/current_intent/factual_assessment/selection/clarification
alone. Enabling LC-C generically therefore needs a protocol-level representation of the required
authoritative answer.

## LC-D

**Adopted as LC-C's enabling representation (design decision for the next slice).** A structured
authoritative answer/result field — populated by the model's closed operation, recomputed by the
host — is the minimal generic way to make "required semantics present" host-decidable. This is a
protocol redesign and must be frozen deliberately; this review does not design it further.

## LC-E

Rejected: scenario-specific required-derivation logic is benchmark special-casing and must not enter
production.

## Recommended Language Boundary

> Language is invoked only when the authoritative proposal contains the turn's required answer
> semantics; if the protocol cannot express the requirement for this turn, the requirement must be
> added to the protocol — never inferred by the host and never completed by Language.

## Exact Language Fail-Closed Semantics

When the required authoritative semantics are absent: no Language call; the turn fails closed with
the missing-authority reason recorded in the diagnostic trace; no behavior text is minted. (This
mirrors the already-proven factual fail-closed path.)

## response_request_id Source

Session runtime: `` `${this.options.session_id}-${tag}` `` (`interactive-subject-runtime-v0.ts:526`),
where `session_id` is the per-cell opaque id (`fca-<uuid>`), carried into the V8 payload
(`language-realization-input.ts`) and serialized verbatim into the model-facing Language content.

## response_request_id Model Visible?

**YES** — the byte-diff across N6 replicates shows exactly one differing field:
`"response_request_id"`.

## response_request_id Semantic Purpose

**None demonstrated.** It is host trace/observability identity; the model uses it for nothing, and
the frozen architecture assigns no semantics to it.

## Language Request Byte Diff

Only `response_request_id` differs across the five N6 Language requests (5 unique requests, 5 unique
ids). All other bytes identical.

## Cognition Request Identity

Identical across N6 (and M1) replicates: one request hash, 5/5.

## Cognition Response Identity

Identical across replicates: one response hash, 5/5. Cognition is byte-deterministic.

## Language Response Split

Five unique requests → **three unique responses**: ids r0/r1 → "is not a MATCH…" (identical bytes),
r2/r4 → identical correct text, r3 → correct text with different quoting. Language IS deterministic
for identical bytes (predecessor review); the split is caused solely by the id-bearing input
difference.

## RI-A

Rejected: no semantic purpose justifies letting trace identity perturb model semantics.

## RI-B

Valid as the minimal statement (remove from model-visible content) but discards observability from
the payload.

## RI-C

Rejected: determinizing the id keeps it model-visible and answers "why expose it at all?" with
nothing.

## RI-D

**Adopted.** Keep `response_request_id` in the V8 input object (host-side, binding/hash semantics
unchanged, observability retained) and exclude it from the model-facing serialization. This preserves
the validated object and hash while removing the nonsemantic perturbation.

## Recommended Request-ID Design

RI-D: host-only carrier. `LanguageInvocationBindingV0` already binds the request id host-side, so
nothing semantic is lost.

## Protocol Version Impact

The request-id fix is a serialization/rendering change: the V8 object, validators and hash domains
are unchanged, so **no V9 is required for it**; the change must be bound into the next qualification
freeze (model-visible input changed → new freeze, old comparisons void). The Language-authority
hardening is a **protocol-level semantic change and requires its own versioned design** (the next
slice decides whether that is a new field in V8's successor or a new executor stage contract).

## Current Model Factual Compliance Conclusion

Frozen statement: **qwen3.5:9b under the current frozen Cognition contract does not satisfy strict
Phase-2 factual-authority qualification** — M1 fails exact quotation, N6 fails to emit the required
structured derivation. No further retries, prompt edits, scenario edits or model changes for this
Phase-2 conclusion.

## Runtime Safety Conclusion

M1: safe fail-closed, proven. N6: **unsafe** — Language completed missing authority and the result
was delivered. Runtime safety is therefore not complete, and the gap is generic (it would apply to
any determined-result turn whose derivation the model omits).

## Can Qualification Ever Be Counted 65/65 From Current Evidence?

**NO** — the current run is 58/65 with two deterministic model-compliance families; no re-scoring,
waiver or reinterpretation is available or proposed.

## Formal Eligible?

`NO` — the qualification gate is not met; the 476-cell matrix must not run and cannot compensate.

## Should Prompt Change?

`NO`. ## Should Scenario Change? `NO`. ## Should Factual Authority Change? `NO`. ## Should Model
Change? `NO` for this Phase-2 conclusion.

## Production Hardening Required Before Core Freeze?

**YES** — the Language semantic-authority gap must be closed; Core must not freeze over a known
delivered-content authority leak. The request-id isolation fix should ride along as the same
generic hygiene work.

## Affect Phase 2 Closure Policy

Fix runtime safety → negative-close Phase 2 with the frozen negative statement (below) → Core-freeze
decision → Relationship Phase 3. No return to Affect prompt-loop work.

## Can Relationship Phase 3 Start After Closure?

**YES** — after the hardening slice and the negative closure; the Affect causal question is answered
negatively for this model under this contract, and the infrastructure it produced (V7 factual
authority, fail-closed paths, handles, instruments) is validated and frozen.

## Recommended Next Slice

**`AFFECT_COGNITION_LANGUAGE_AUTHORITY_HARDENING_AND_INPUT_ISOLATION_V0`** — production hardening,
generic only: (a) implement the LC-C principle with LC-D's structured answer representation (frozen
design, versioned); (b) implement RI-D (host-only request id, serialization unchanged semantics,
freeze re-bound); (c) prove with production tests that missing required authority fails closed before
Language and that no reasoning text can be delivered from unauthorized content; (d) then negative-close
Phase 2. Explicit non-goals: no prompt/scenario/threshold/factual-authority change, no fuzzy
quotation, no host auto-classification, no model switch, no re-scoring of this qualification.

## Production Files Changed

`NO`.

## Real Model Calls

`0`.

## Confidence

**High** on all three findings: M1's mismatch is a single verified byte-level defect with correct
rejection; N6's missing derivation and Language-completed answer are directly observable in every
replicate; the Language-validation source path and the id-diff are conclusive. **High** on the
negative-closure policy given the frozen constraints.

## Largest Remaining Uncertainty

How much of the Language gap the structured-answer approach (LC-D) can close for turns whose
required result is *not* a closed-derivation task — e.g. open factual questions where "required
semantics" has no closed form. That residue is exactly what the hardening slice's frozen design must
bound explicitly; until then, the safe default is the LC-C principle (fail closed rather than let
Language complete), accepting that some turns become failures instead of unauthorized answers.

STOP. No recommendation implemented.
