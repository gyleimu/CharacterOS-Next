# AFFECT PHASE 2 NEGATIVE CLOSURE + CORE FREEZE — ARCHITECTURE DECISION

Read-only final Phase-2 / Core-readiness adjudication. Repository truth verified at HEAD `c4b088a`
(`origin/main` identical, clean worktree).

**Zero production files changed. Zero model calls.** Evidence: `forensics.mjs` → `forensics.json`
(zero-model construction of the V9 conversational payload and the N6-shape rejection), the frozen
qualification/closure records, and direct production-source inspection
(`conversation-cognition-proposal.ts`, `factual-claim-authorization.ts`,
`subjective-rationale-authorization.ts`, `language-realization-input.ts`,
`language-realization-provider.ts`, `conversation-text-response-executor-v1.ts`).

---

## Principal Root Cause Of Phase-2 Closure

`CURRENT_MODEL_STRICT_AUTHORITY_COMPLIANCE_LIMIT`

The frozen `qwen3.5:9b` configuration did not satisfy the strict factual-authority qualification:
M1 misquoted source bytes (5/5, `REJECTED_SOURCE_BINDING`) and N6 did not emit the required
`RULE_CLASSIFICATION` (5/5). No prompt, scenario, threshold, factual-authority or model change was
used to alter this result, and none is proposed.

## Affect Phase-2 Status

`AFFECT_PHASE2_QUALIFICATION_NEGATIVE_CAUSAL_UNRESOLVED`

## Affect Core Status

`AFFECT_IMPLEMENTED_CAUSAL_UNRESOLVED`

## V9 Language Status

`LANGUAGE_AUTHORITY_ESCAPE_HATCH_REMAINS`

## Core Freeze Status

`CORE_FREEZE_BLOCKED_BY_LANGUAGE_AUTHORITY`

## Relationship Phase-3 Readiness

`RELATIONSHIP_MUST_WAIT_FOR_CORE_HARDENING`

## Principal Core Verdict

`HARDEN_LANGUAGE_NO_FACTUAL_MODE_FIRST`

## Executive Decision

The negative closure is scientifically correct and stays frozen; the V7 factual authority, rationale
authorization, ask-fail-closed severity and request-id isolation are all verified closed from
production source, and the V9 gate demonstrably closes the N6-style *asserted-but-incomplete* path.
But the review's central question resolves against the mode introduced by the last slice: in
`NO_FACTUAL_PRIMARY_RESPONSE` Language receives **zero authoritative atoms** and composes the primary
response unsupervised — and the host cannot distinguish that case from a determined question the
model under-asserted. A known path therefore remains where "Language can invent a missing required
answer" (§29's blocking criterion), so Core must not freeze yet. Recommendation: exactly one narrow
production-hardening slice that gives the zero-atom conversational turn an explicit, host-validated
authority (or denies it), then Core freeze with documented limitations, then Relationship
Familiarity. No Affect reopening, no qualification rerun, no score recovery.

## Repository Truth

`main` at `c4b088a`, clean, ahead/behind 0/0. Frozen evidence: strict qualification 58/65
(`AUTHORITATIVE_RUNTIME_FACTUAL_VALID` 60/65), formal NOT RUN, verdict
`CURRENT_MODEL_FAILS_STRICT_FACTUAL_AUTHORITY_CONTRACT`; the negative-closure artifact
(`research/core-completion/phase-2-affect-negative-closure-v0/CLOSURE.md`); production commits
`627b943` (V7 factual authority) and `136f466` (V9 language authority + request-id isolation); gates
at HEAD: 2496 tests passed / 0 failed, typecheck/aux/build/lint/governance/diff all clean.

## Evidence Reviewed

The closure artifact; the frozen qualification records (M1 ×5, N6 ×5) and the review that adjudicated
them; the V9 construction of a conversational turn and of the N6 shape (this review's forensics);
the full production validation chain; the language provider's serialization and gates; the executor's
realize path; the language test suites (`language-authority-completeness.test.ts`,
`canonical-affect-cognition-integration-v0.test.ts` V9 proofs) and the sandbox/stub fixtures that
exercise the conversational path.

## Phase-2 Historical Qualification

`58/65` overall; `AUTHORITATIVE_RUNTIME_FACTUAL_VALID` 60/65; failure families exactly M1 ×5
(exact-quote compliance) and N6 (missing derivation, 2/5 additionally Language-contradicted before
the hardening). 0 retries, 0 replacements, frozen freezes `sha256:d18afa2e…` / `sha256:9e47b906…`.

## Formal Matrix Status

`NOT RUN` and not eligible: the qualification gate was never met, and the matrix must not be used to
compensate.

## Correct Scientific Interpretation

> The frozen qwen3.5:9b CharacterOS configuration did not satisfy the strict factual-authority
> qualification required to enter the planned Affect causal matrix; therefore no positive or negative
> causal-differentiation conclusion was drawn and the causal question is UNRESOLVED.

## Incorrect Scientific Interpretations

"Forbidden conclusions": that Affect does not influence behavior; that Affect causal differentiation
failed; that the 58/65 result is evidence about Affect at all. The causal matrix never ran.

## V7 Factual Authority Status

`CLOSED` — model claims become authority only as exact `SOURCE_QUOTE` or a closed host-verifiable
derivation; any unauthorized claim invalidates the entire proposal (no stance authority, no
authoritative hash, no Language), proven on live M1 cells (0/5 Language calls, 0/5 hashes, 5/5 stance
suppressed) and in `factual-claim-authorization.test.ts`.

## SOURCE_QUOTE Status

`CLOSED, UNCHANGED` — case-sensitive, NFC, exact-substring matching against every cited source's
inspectable content; no trim/case-fold/fuzzy/judge relaxation. M1 remains legitimate historical
evidence of a model compliance failure, not of a protocol defect.

## Structured Derivation Status

`CLOSED` — structured, closed-operation, host-recomputed: `INTEGER_ARITHMETIC`,
`STRING_REVERSE`, `RULE_CLASSIFICATION`; authoritative claim `text` is host-rendered. No paraphrase,
no generic inference, no semantic derivation, no host auto-classification.

## Rationale Authorization Status

`CLOSED` — `subjective-rationale-authorization-policy-v0` (frozen, not generalized to claims): an
unlawful rationale becomes `rationale = null` in the authoritative proposal while otherwise-lawful
fields survive; the raw violation stays diagnostic-only; Language never sees the raw text and never
repairs it.

## V9 Realization Topology

Verified from source: Cognition V7 wire → host canonicalization (handle resolution → structural
validation → **factual authorization** → **rationale authorization**) → authoritative proposal →
authoritative proposal hash → executor realize branch → **V9 build** (host-derived realization plan →
**semantic completeness gate**) → Language V9 (model-facing payload with the request id stripped) →
validated draft → behavior delivery. The realization plan and the completeness gate both run strictly
before the Language transport call.

## Realization Plan Authority

Constructed by the **HOST** (`deriveLanguageRealizationPlanV0`), never by the model and never by
Language. It may reference only already-authoritative atoms: indices of authorized
`HOST_VERIFIABLE_DERIVATION` claims, or the authoritative stance; the conversational mode carries no
references. It cannot create a new fact, choice, rationale or derivation — it holds only closed
references, and the validator rejects out-of-range indices, kind mismatches and mode/reference
mismatches.

## response_request_id Isolation

`CLOSED` (RI-D) — the id remains in the host carrier/binding and is bound by `input_hash`, but is
excluded from the model-facing serialization: tests prove two semantically identical V9 inputs with
different ids produce identical model-facing payloads, identical model-facing payload hashes and
identical provider-serialized bytes, with the id absent from the model-visible text. This review's
forensics re-confirms absence in the conversational payload.

## NO_FACTUAL_PRIMARY_RESPONSE Exact Predicate

Exact conditions to enter the mode (source-verified, all must hold):
`communication_directive = REALIZE_CURRENT_INTENT`; `clarification_basis = null`;
`subjective_selection.kind = NO_SUBJECTIVE_SELECTION`; `factual_assessment.claims.length = 0`. Any
asserted claim changes the branch: with ≥1 claim, at least one must be a host-verifiable derivation
(`FACTUAL_DERIVATION_RESPONSE`) or the turn fails `SEMANTIC_COMPLETENESS_FAILED`.

## NO_FACTUAL_PRIMARY_RESPONSE Model Input

Constructed zero-model representative payload (conversational turn). Model-visible keys:
`schema_version`, `subject_id`, `source_revision`, `current_turn_ref`, `cognition_projection_hash`,
`communication_binding` (proposal hash + directive only), `current_user_request` (scene/task),
`factual_assessment` (**0 claims**), `selected_subjective_selection` (`NO_SUBJECTIVE_SELECTION`),
`supporting_evidence` (lawful refs; episode contents), `constraints`, `realization_plan`
(mode `NO_FACTUAL_PRIMARY_RESPONSE`, **0 references**). `response_request_id` is absent.
Authoritative atoms available to Language in this mode: **none**.

## current_intent Authority

`CURRENT_INTENT_IS_PLAN_ONLY_NOT_SEMANTIC_AUTHORITY` — and in fact **not even present**: the
V7/V8/V9 `LanguageCommunicationBindingV7` carries only `schema_version`, `proposal_hash`,
`directive`, `clarification_basis`. `current_intent` is descriptive cognition metadata that never
reaches the Language payload and carries no authority.

## Ordinary Conversation Fixtures Reviewed

The conversational path is exercised by test/stub fixtures (sandbox and research stubs) that emit
zero claims + `NO_SUBJECTIVE_SELECTION` for arbitrary messages (greetings, acknowledgements,
continuations), with fixed fake language transports in tests. Those fixtures prove the plumbing stays
functional; they do **not** constrain what a real Language model composes, which is exactly the
question below.

## Does Zero-Factual Mode Introduce New Facts?

Structurally **yes, unconstrained**: with zero authoritative atoms and the user's message as the only
content, Language's draft is the primary response and nothing host-side bounds its factual content.
§14's legitimate case ("Sure.", "Okay.") is not distinguished from an invented world fact.

## Does Zero-Factual Mode Introduce New Choice?

**Not as authority** — the plan carries no stance reference and the selection is
`NO_SUBJECTIVE_SELECTION`, so any preference-shaped text Language produced would be an unauthorized
choice; the language-side completion audit flags it in research, but production has no post-Language
content gate. The mode does not *create* choice authority; it fails to *prevent* unauthorized choice
text.

## Does Zero-Factual Mode Invent New Reason?

**Unbounded, same mechanism** — with no rationale and no facts, any reason Language writes is
invented; nothing in production blocks it in this mode.

## NF-A

Rejected as the verdict: safe conversational realization requires an already-authorized conversational
act, and in this mode no such act exists in the payload (zero atoms, zero references). The mode
*assumes* the act rather than authorizing it.

## NF-B

Partially true and worth recording — the mode is the deliberate product trade that keeps ordinary
conversation alive — but "under-specified" understates the §29 test: the blocking criterion "Language
can invent a missing required answer" is structurally satisfiable here.

## NF-C

**Adopted.** The mode admits Language to construct primary response semantics with no authoritative
upstream answer atom, and the host **cannot** distinguish a genuinely conversational turn from a
determined question the model under-asserted (both are zero-claim `NO_SUBJECTIVE_SELECTION` REALIZE
turns — proven by construction in this review's forensics: the under-asserted zero-claim turn is
admitted as `NO_FACTUAL_PRIMARY_RESPONSE`). This is a known authority path, so Core Freeze is blocked
until it is closed.

## NF-D

Rejected: the predicate, the payload and the admission path are all directly constructed and
verified.

## NO_FACTUAL_PRIMARY_RESPONSE Verdict

`LANGUAGE_AUTHORITY_ESCAPE_HATCH_REMAINS` — scoped precisely: not "Language may say anything always"
(the asserted-claim path is closed, and every other mode is bounded by authorized atoms), but "when
Cognition asserts nothing, Language may generate the primary response, including a missing answer".
Paired finding: the same conversational turn **with** a quote assertion now fails closed
(`SEMANTIC_COMPLETENESS_FAILED`) — so the model's own asserting behavior decides which side of the
gate a greeting lands on, which is product-inconsistent as well as unsafe in one branch.

## V9 Exact Guarantee

Supported statement: **CharacterOS now prevents Language from being invoked to complete a missing
primary factual derivation or a missing subjective stance** — for asserted claims, a host-verifiable
derivation must exist; for a subjective selection, the stance must exist; otherwise the turn fails
closed before Language.

## What V9 Does Not Guarantee

It does **not** guarantee that Language can never produce semantic novelty. It is not general natural
language entailment verification, it does not constrain drafts in the zero-atom conversational mode,
and it does not verify that a delivered sentence is authorized — only that the required primary atoms
were present for the modes it gates.

## Pure-Quote False-Negative Limitation

A determined-content turn whose only assertions are verbatim quotes now fails closed (the N3/N4-shaped
case). Cause: the closed registry offers no host-verifiable way to certify a quote as *the answer*
rather than source material, and §13/§28 require the quote-only N6 shape to fail.

## Is Pure-Quote Limitation Safe?

`SAFE_FALSE_NEGATIVE` — it fails closed (no unauthorized answer is delivered) and is not a product
blocker by itself. It must, however, be resolved together with the zero-atom gap, because the two
together make conversational/determined handling inconsistent (assert-a-quote → blocked;
assert-nothing → unsupervised).

## Remaining Generic Authority Gaps

Exactly one generic gap remains: the **zero-atom Language path** (no authoritative conversational act
exists, so Language's primary response is unsupervised, and the host cannot distinguish it from
under-asserted determinism). Everything else audited (§6 A–C, E and the asserted shapes of D) is
closed from source.

## Blocking Gaps

`1` — the zero-atom Language authority path (`NO_FACTUAL_PRIMARY_RESPONSE`), per §29's
"Language can invent a missing required answer".

## Non-Blocking Limitations

`qwen3.5:9b` exact-quote compliance weakness; `qwen3.5:9b` structured-derivation emission weakness;
pure-quote false negatives; Language containment is not general NL entailment; Affect causal matrix
unrun and Affect causality unresolved. None of these is an unsafe *infrastructure* property.

## Future Improvements

Host-owned span selection (source *selection* instead of source *copying*) to remove the quote
false-negative while preserving exactness; a structured answer/realization protocol for
determined-content turns; an explicitly authorized conversational-act atom if phatic conversation is
to be supported generically.

## Core Freeze Criteria

From §27: (1) authority boundaries explicit; (2) invalid authoritative data fails closed; (3) raw
model output never implicitly trusted; (4) production/research semantics aligned where authority
matters; (5) historical compatibility preserved; (6) known limitations documented; (7) no known
authority bypass remains; (8) remaining gaps are domain/model limits, not generic unsafe
infrastructure.

## Criterion-by-Criterion Result

1. **Partly fails** — the zero-atom conversational act has no explicit authority.
2. Pass — factual/selection invalidity and missing completeness all fail closed.
3. Pass — handles, canonical refs, textual canonicalization, rationale nulling, host-rendered
   derivation text; nothing model-authored is trusted implicitly.
4. Pass — the research audit consumes the production authorization surface (single implementation).
5. Pass — V1–V8 remain readable/dispatchable; live is V9; no downgrade.
6. Pass — the closure artifact and the test suites document the limitations.
7. **Fails** — the zero-atom Language path.
8. **Fails** — the remaining gap is generic infrastructure (authority modeling), not a domain/model
   capability limit.

Result: **Core freeze is blocked by Language authority** (criteria 1/7/8).

## Can Affect Be ACTIVE_CAUSAL?

`NO` — behavioral causal evidence was never produced (formal matrix not run). Affect's correct status
is **implemented, causally unresolved**; the `ACTIVE_CAUSAL` label requires the behavioral evidence
that does not exist. The negative qualification closure is *not* causal evidence either way.

## Affect Reopen Conditions

Only for a concrete reason: a new primary model configuration, a materially different cognition
architecture, a product requirement demanding causal Affect evidence, or a new experiment designed to
answer the unresolved causal question — never because 58/65 "feels unfinished". No Affect prompt loop,
no qualification retry, no `SOURCE_QUOTE` relaxation, no N6 host auto-classification, no model swap
merely to obtain Phase-2 green.

## Does Relationship Depend On Affect Validation?

**No logically.** Verified: familiarity has its own producer/persistence/restore/projection/influence
surfaces (relationship state, familiarity read projection, cognition influence refs), and the
familiarity experiment machinery exists independently of Affect. Roadmap sequence is not a code
dependency, and this review does not impose one.

## Relationship Familiarity Independence

Familiarity can persist, restore, project and influence Cognition independently of the Affect causal
question; its experimental variation is its own manipulation. Affect's unresolved causal status does
not block it.

## Can Relationship Familiarity Begin?

**Not yet** — blocked by the *Core* verdict (Language authority), not by Affect. Once the
zero-atom Language authority gap is closed and Core freezes with documented limitations, Relationship
Familiarity can begin (`RELATIONSHIP_FAMILIARITY_CAN_BEGIN_WITH_AFFECT_CAUSAL_UNRESOLVED` becomes
available).

## Core Freeze Manifest Requirements

Record (future artifact, not created here): frozen authority hierarchy (host authorizes: facts via
exact quotes/closed derivations; rationale field-local; stance; directive; Language realizes only
authorized atoms); live protocol versions (Cognition V7, binding V3, Language V9, plan V0, factual
policy v0, rationale policy v0); historical compatibility range (V1–V6 cognition, V1–V8 language);
the factual and rationale authorization contracts; the Language realization contract including the
gated modes; Affect semantics as frozen and Affect **causal status = unresolved**; known current-model
failures (M1, N6); known conservative false negatives (pure-quote determined turns); future reopen
conditions.

## Allowed CharacterOS Claims

Persistent internal-state architecture exists; Affect persistence/projection exists; host factual
authority is closed and verifiable (exact quotes + host-recomputed closed derivations); Language is
not permitted to fill a missing required factual derivation or missing subjective stance; hidden
rationale state is rejected before realization; nonsemantic request identity does not perturb model
semantics.

## Forbidden CharacterOS Claims

Affect has been shown to causally alter behavior; Affect causal differentiation failed; the base model
obeys all CharacterOS authority contracts; Language output is generally semantically verified; all
model hallucination is prevented; zero-factual conversational mode is authority-safe (it is the open
gap).

## Recommended Next Slice

**`AFFECT_COGNITION_LANGUAGE_ZERO_FACTUAL_AUTHORITY_HARDENING_V0`** — exactly one narrow production
slice, addressing ONLY the proven zero-atom Language authority gap, with the decision space limited
to: (a) deny-by-default — zero authoritative atoms ⇒ Language is not invoked and the host renders a
minimal lawful acknowledgement or CLARIFY behavior; or (b) an explicitly authorized, host-validated
conversational act (a closed kind the model proposes and the host authorizes as non-factual) required
before Language may run in this mode; together with resolving the pure-quote false negative so that
assert-a-quote and assert-nothing behave consistently. Non-goals: no Affect reopening, no
qualification rerun, no prompt/scenario/threshold/factual-authority change, no derivation-registry
extension, no model swap. Then: Core freeze with the manifest, then Relationship Familiarity.

## Production Files Changed

`NO`.

## Real Model Calls

`0`.

## Confidence

**High** on the closure and on every §6 audit: all are source-verified and, where behavioral,
proven by live cells or production tests. **High** on the zero-atom finding: the predicate, the
zero-atom payload and the admission path were constructed deterministically in this review.
**Medium-high** on the exact remedy shape — deny-by-default vs authorized conversational act is an
architecture choice with product-behavior consequences, which is why the recommendation is one narrow
slice with the decision space bounded rather than a design imposed.

## Largest Remaining Uncertainty

Whether the deployed model, under the hardened contract, actually under-asserts determined questions
often enough for the zero-atom path to be hit in practice (the frozen run showed claims asserted in
all null cells; the path is proven reachable structurally, not observed in production traffic). That
affects urgency, not the verdict: a known authority path exists, so Core freeze waits until it is
closed — and, symmetrically, whether a real model-facing conversational turn normally arrives with a
quote assertion (currently blocked) or with none (currently unsupervised), which the hardening slice
must make consistent either way.

STOP. No recommendation implemented.
