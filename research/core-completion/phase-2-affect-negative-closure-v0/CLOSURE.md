# AFFECT PHASE 2 — NEGATIVE QUALIFICATION CLOSURE

Recorded after `AFFECT_COGNITION_LANGUAGE_AUTHORITY_HARDENING_AND_INPUT_ISOLATION_V0`
(production commit `136f466`, closure commit follows). This artifact closes the strict Phase-2
qualification negatively and records the production safety result separately. No historical
evidence is rewritten and no score is reinterpreted.

## 1. Qualification result (frozen)

| item | value |
| --- | --- |
| Strict Phase-2 qualification (65 cells, frozen V7/V8 contract) | **FAILED — 58/65** |
| `AUTHORITATIVE_RUNTIME_FACTUAL_VALID` | 60/65 |
| Formal 476-cell causal matrix | **NOT RUN** (never eligible: qualification gate unmet) |
| Configuration | `qwen3.5:9b`, digest `6488c96f…ea7`, temperature 0, `num_predict` 2048 |
| Freeze | `sha256:d18afa2e…` (qualification), `sha256:9e47b906…` (formal, unused) |
| Verdict | `CURRENT_MODEL_FAILS_STRICT_FACTUAL_AUTHORITY_CONTRACT` (co-present `…LANGUAGE_FIDELITY_FAILED`) |

### Why it failed — model compliance, exactly two families

1. **M1 ×5 — exact `SOURCE_QUOTE` compliance failure.** The model quoted
   `Alice says: "The code review deadline is Thursday."` while the canonical source contains no
   closing quotation mark at that position; the fabricated byte makes the claim a non-substring.
   The host rejected it (`REJECTED_SOURCE_BINDING`), the whole proposal failed, Language was not
   called (0/5), no authoritative hash was minted (0/5) and the stance was never scored (5/5).
   The rejection is verified byte-correct; `SOURCE_QUOTE` exactness was NOT weakened.
2. **N6 — required `RULE_CLASSIFICATION` emission failure.** Cognition emitted only two
   `SOURCE_QUOTE` claims (rule + query) and no classification result in 5/5 cells.

No prompt, scenario, threshold, factual-authority, model or Affect/Regulation change was made or is
proposed to alter this result. The formal matrix must not be used to compensate.

### Not a conclusion about Affect

> The current model/runtime configuration failed prerequisite authority qualification, so the
> planned causal Affect matrix was not executed and **no positive or negative
> causal-differentiation conclusion was drawn.**

Phase-2 closure is negative at the *strict qualification / current-model compliance* level. It is
**not** evidence that Affect cannot influence behavior, and it is not a claim that Affect had no
causal effect.

## 2. Production safety result (proven, not reinterpreted)

| gap | status | proving evidence |
| --- | --- | --- |
| V7 factual authority (quotes + closed derivation registry; invalid fact fails the whole proposal) | **CLOSED** | `factual-claim-authorization.test.ts` (12 tests), M1 live cells (0 Language calls, no hash, no stance) |
| Subjective rationale authority (field-local null drop) | **CLOSED** | `subjective-rationale-authorization.test.ts` (7 tests), live 65-cell run (0 unlawful authoritative rationales) |
| Language missing-authority completion (Language finishing reasoning Cognition never authorized) | **CLOSED** by the V9 pre-Language realization completeness gate | `language-authority-completeness.test.ts` (10 tests) + executor proofs in `canonical-affect-cognition-integration-v0.test.ts`: the N6 shape now fails closed (`SEMANTIC_COMPLETENESS_FAILED`) **before** Language with 0 language calls and no behavior minted; complete derivations, authoritative stances and ordinary conversational realization still deliver |
| Nonsemantic `response_request_id` model leakage | **CLOSED** by host-only carrier (RI-D) | Same suites: two semantically identical V9 inputs with different request ids produce identical model-facing payloads, identical model-facing payload hashes and identical provider-serialized bytes; the id is absent from model-visible content while remaining bound in the host carrier/binding |

V9 contract additions: `language-realization-input-v9` with `language-realization-plan-v0`
(references to already-authorized atoms only: designated host-verifiable derivations, or the
authoritative stance; ordinary conversational realization carries no references). No new derivation
operation, no paraphrase/generic inference, no host auto-classification, no fuzzy quotation, no
prompt change, no model change, no Affect/Regulation change. V1–V8 remain readable; the live path
does not fall back to an older semantic contract.

### Known bound (disclosed, not hidden)

A determined-content turn whose assertions are only verbatim quotes (no host-verifiable derivation)
now fails closed as semantically incomplete. This is the deliberate conservative reading of the
frozen requirement "a determined-content turn needs an authorized host-verifiable derivation as its
primary response"; the closed registry currently offers no host-verifiable way to certify a quote as
*the answer* rather than source material. The architect may later authorize a host-owned
span-selection mechanism or an explicit response-role designation; until then, fail-closed is the
safe default. Nothing in this closure claims perfect semantic containment of Language output.

## 3. Roadmap consequence

1. This closure (done).
2. **`AFFECT_PHASE2_NEGATIVE_CLOSURE_AND_CORE_FREEZE_REVIEW`** — READ-ONLY: decides whether the
   current Core is sufficiently safe/stable to move to Relationship Familiarity despite the unrun
   Affect causal matrix.
3. Only after that review: Relationship work. Do not begin it inside the closure slice.

No further Affect prompt-loop work. The Affect infrastructure produced by this program (V7 factual
authority, V8/V9 language carriers, handle canonicalization, fail-closed paths, dual endpoints,
input-identity and provider-instance controls) is validated and remains frozen.
