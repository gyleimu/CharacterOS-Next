# CORE FREEZE MANIFEST — V0

**Slice**: `AFFECT_COGNITION_RESPONSE_SEMANTICS_ATOM_V0` (the last generic Language-authority
hardening slice before Core freeze).
**Frozen head**: `fe4467182821799e0c4f57d4e81d27578a147d90` (`fix: require an authoritative response
semantics atom`).
**Status**: `CORE_FREEZE_READY_WITH_DOCUMENTED_LIMITATIONS`.
**Real model calls**: `0` (this slice and this manifest).

The machine-readable companion is [`manifest.json`](./manifest.json); the deterministic
verification is [`verify.mjs`](./verify.mjs) → [`verify-results.json`](./verify-results.json)
(19/19 checks passed, 0 model calls); the honest live-fixture migration record is
[`fixture-migration.json`](./fixture-migration.json).

---

## 1. Frozen authority hierarchy

The host authorizes; models propose. No model output is authority by itself.

| Layer | Contract | Given by |
| --- | --- | --- |
| Factual claims | `factual-claim-authorization-policy-v0`: `SOURCE_QUOTE` (case-sensitive NFC exact substring of **every** cited source's trusted text) or `HOST_VERIFIABLE_DERIVATION` (host re-computes; host renders the claim text) | host |
| Derivation operations | frozen closed registry: `INTEGER_ARITHMETIC`, `STRING_REVERSE`, `RULE_CLASSIFICATION` | host |
| Subjective stance | `SUBJECTIVE_SELECTION` / `NO_SUBJECTIVE_SELECTION`; stance text is authoritative only when the model selected one | host validates |
| Subjective rationale | `subjective-rationale-authorization-policy-v0`, **field-local**: forbidden content ⇒ authoritative `rationale = null`; raw violation is diagnostic-only and is never generalized to claims | host |
| Communication directive | `REALIZE_CURRENT_INTENT` or `CLARIFY_MISSING_CONTEXT` (+ authorized basis) | host |
| Response semantics | exactly one host-validated **atom** per turn designates the primary response; the atom itself creates no authority | host |
| Language | realizes **only** the routed atom; never completes missing semantics, never adds factual authority | host routes, model renders |

Fail-closed law: an invalid factual claim, an invalid atom, or a zero-atom `REALIZE` turn makes the
**entire** proposal invalid — no proposal hash is minted, Language is not invoked, no behavior is
delivered and nothing is persisted.

## 2. Live protocol versions (the only versions the live path accepts)

| Protocol | Version | Notes |
| --- | --- | --- |
| Cognition proposal | `conversation-cognition-proposal-v8` | adds the single `response_semantics` atom |
| Cognition invocation binding | `cognition-invocation-binding-v4` | binds proposal V8; duplicate/foreign invocation rejected |
| Cognition proposal hash projection | `characteros-next/runtime/conversation-cognition-proposal/v8` | |
| Language realization input | `language-realization-input-v10` | carries the plan; `response_request_id` is a host carrier only |
| Language realization plan | `language-realization-plan-v1` | `primary` = the routed atom (`PRIMARY_FACT{claim_index,claim_kind}` / `PRIMARY_STANCE` / `PRIMARY_CONVERSATIONAL_ACT{act,target_ref}`) |
| Language semantic draft | `language-realization-semantic-draft-v1` | unchanged |
| Factual policy | `factual-claim-authorization-policy-v0` | unchanged |
| Rationale policy | `subjective-rationale-authorization-policy-v0` | unchanged |

Live path selection: the conversation executor uses `ConversationCognitionProviderV8` for canonical
(V2) projections. There is **no** V6/V7 fallback on the live path; a V7 wire is rejected
(`conversation proposal.schema_version: expected conversation-cognition-proposal-v8`) — verified in
`verify-results.json` (`contract.live_rejects_v7_wire`, `live.executor.provider_v8`,
`live.executor.no_v7_provider`).

## 3. Historical compatibility range (readable, never live)

- Cognition proposals **V1–V7** — validators `validateConversationCognitionProposalV1..V7` remain
  exported and the V6/V7 canonicalizers remain readable. Historical semantics are **not**
  reinterpreted under V7/V8 authority rules.
- Language realization inputs **V1–V9** — any-version validation/hash remain available; the V9
  realization-plan semantics (including the retired live `NO_FACTUAL_PRIMARY_RESPONSE` mode) are
  retained as verified history (`language-authority-completeness.test.ts`, marked HISTORICAL).
- Historical fixtures were not rewritten: the V6/V7/V9-era protocol tests are unchanged.

## 4. Response semantics contract (this slice)

- **Single atom per turn**, closed kinds: `PRIMARY_FACT{claim_index}` (must reference an *already
  authorized* claim — a verbatim `SOURCE_QUOTE` or a host-verified derivation), `PRIMARY_STANCE`
  (requires an authoritative stance; rationale optional/null), `PRIMARY_CLARIFICATION` (requires the
  authorized clarification basis; never builds a Language input), `PRIMARY_CONVERSATIONAL_ACT{act}`
  with the frozen closed registry `GREET`, `ACKNOWLEDGE`, `GENERATIVE` (requires `REALIZE`, no
  authoritative stance, and a host-stamped current-turn `target_ref`; a model-supplied target is
  rejected).
- **Zero-authority invariant**: `REALIZE` + zero valid atoms ⇒ `SEMANTIC_COMPLETENESS_FAILED`; no
  proposal hash, no Language call, no behavior, no persistence. The former live
  `NO_FACTUAL_PRIMARY_RESPONSE` escape hatch no longer exists (historical parsing may remain).
- **Plan routing**: the host routes the authorized atom verbatim; it never synthesizes semantics.
- **Request-id isolation (RI-D)**: two inputs differing only in `response_request_id` produce
  byte-identical model-facing payloads and hashes; the id is host-only and model-invisible.
- **§8 alignment**: a pure exact `SOURCE_QUOTE` may be the primary response (the earlier conservative
  false negative is removed) with **no** weakening of exact-substring, case-sensitive NFC matching.

## 5. Affect semantics

Affect semantics are frozen as implemented (canonical Affect channels, regulation, projection
visibility, persistence and restore). **Causal status: `UNRESOLVED`.** Affect Phase-2 strict
qualification closed **negatively** at 58/65 with the formal matrix **NOT RUN**; no causal claim
about Affect is made or implied, and this slice changed **no** Affect code, thresholds, scenarios or
prompts.

## 6. Memory epistemic boundary (audit §18) and residual limitation

Audited path: delivered behavior → `BehaviorOutcomeFeedbackEncoderV0` (records the exact behavior
artifact + payload hash + cognition lineage) → `FactualMemoryEvidenceResolverV0` (closed evidence
union: `BEHAVIOR_OUTCOME` carries `delivered_behavior_text` + `exact_outcome_text`, every hash/ref
re-verified; `EPISODE_SCENE` carries the scene copy) → `factualSourceTexts` → claim authorization.
No reward/sentiment/objective-truth interpretation is representable.

Verified downstream property: a delivered generative surface is **a record of what was said**
(`verify-results.json` → `memory.delivery_record_quote_only_verbatim`): the verbatim delivery text is
lawful inspectable evidence, while any reinterpretation/paraphrase of it is refused by factual
authorization. The generative turn itself asserts nothing (`factual_assessment.claims = []` for
`PRIMARY_CONVERSATIONAL_ACT`).

**Residual limitation (documented, not new)**: quoting an earlier *delivery record* remains a lawful
`SOURCE_QUOTE` (frozen pre-slice semantics: the source set is "what was actually said/observed").
Generative output can therefore reappear later as a verbatim quote of the record; it cannot be
paraphrased, generalized or promoted. `GENERATIVE_OUTPUT_CAN_CONTAMINATE_FACTUAL_MEMORY` is **not**
triggered — no path converts generated wording into factual authority — but the reopen condition in
§9 covers the case where a future review judges delivery-record quoting itself insufficiently
bounded.

## 7. Known current-model limitations and conservative false negatives

- Known current-model failures (unchanged, from the qualification record): **M1** source-quote
  compliance failure and **N6** derivation-compliance failure — the model does not reliably obey the
  strict factual-authority contract; **M3** truncation was observed earlier under a larger contract.
- Conservative false negatives retained on purpose: `GENERATIVE` is exercised only by dedicated
  tests (no live fixture is exclusively a novel-content request); `PRIMARY_FACT` requires an
  *already authorized* claim, so a determined-content turn whose claim fails authorization still
  fails the entire proposal.
- No benchmark special-casing, no per-cell fixtures, no prompt tuning exists in this slice.

## 8. Engineering gates (all green at the frozen head)

| Gate | Result |
| --- | --- |
| `pnpm governance` | PASS (15 workspaces, 21 conformance test files) |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm typecheck:auxiliary` | PASS (research harness narrowing extended to V10) |
| `pnpm lint` (`--max-warnings 0`) | PASS |
| `pnpm test` | PASS — 203 files, 2518 passed, 3 pre-existing skipped |
| `git diff --check` | clean |
| `verify.mjs` (this manifest) | 19/19 checks, 0 model calls |

## 9. Reopen conditions

Core may be reopened only by explicit review, and only for:

1. a fourth conversational act, a fourth derivation operation, or any general task ontology /
   natural-language entailment / LLM judge — each requires a new architecture review;
2. any change to the factual or rationale authorization contracts, the atom closed kinds, or the
   zero-authority invariant;
3. any new persistent canonical state, Affect/Regulation/Belief/Relationship change, or
   `current_intent` promotion;
4. delivery-record quoting being judged insufficiently bounded (§6 residual limitation);
5. a model or model-digest change (requires re-qualification from scratch; a changed digest is a
   hard `MODEL_BASELINE_CHANGED` stop).

## 10. What may and may not be claimed

**Allowed**: persistent internal-state architecture exists; Affect persistence/projection exists;
host factual authority is closed and verifiable (exact quotes + host-recomputed closed derivations);
Language can no longer complete missing response semantics (zero-authority fails closed); the
non-factual conversational act is a bounded, closed, host-validated permission; nonsemantic request
identity does not perturb model-visible Language semantics; hidden rationale state is rejected before
realization.

**Forbidden**: Affect has been shown to causally alter behavior; Affect causal differentiation
failed/succeeded in a formal matrix (formal NOT RUN); the base model obeys all CharacterOS authority
contracts; Language output is generally semantically verified; all model hallucination is prevented;
generative output is extensively NL-verified (it is not — verification is structural only).
