# ZERO-FACTUAL LANGUAGE AUTHORITY — ARCHITECTURE DECISION

Read-only adjudication of the single remaining Core-freeze blocker: the zero-authority Language path
(`NO_FACTUAL_PRIMARY_RESPONSE`). Repository truth verified at HEAD `3b313c9` (`origin/main` identical,
clean worktree).

**Zero production files changed. Zero model calls.** Evidence: `inventory.mjs` → `inventory.json`
(zero-model workload inventory across 36 zero-claim fixture files), the frozen closure/core-freeze
review records, and direct production-source inspection
(`language-realization-input.ts`, `conversation-cognition-proposal.ts`,
`conversation-text-response-executor-v1.ts`).

---

## Principal Root Cause

`REALIZATION_PLAN_UNDER_SPECIFIED`

The realization plan cannot express **what the model intends Language to realize**. It is
host-derived, so it has no channel for the one party that knows the user's intent, and it has no
primary-response designation. Two consequences, one defect:

1. **the zero-authority hole** — when Cognition asserts nothing (no claims, no stance), the plan has
   nothing to route and Language generates the primary response unsupervised
   (`LANGUAGE_AUTHORITY_ESCAPE_HATCH_REMAINS`); and
2. **the pure-quote false negative** — even when a verbatim quote *is* the correct answer, the plan
   cannot designate it as the primary response, so the turn fails closed.

No non-factual response authority exists as a distinct atom anywhere upstream, which is why the
defect surfaces as a missing authority family rather than a routing bug.

## Zero-Factual Authority Status

`ADD_EXPLICIT_CONVERSATIONAL_ACT_AUTHORITY`

## Pure-Quote Status

`ALLOW_AUTHORIZED_QUOTE_AS_PRIMARY_RESPONSE`

## Core Freeze Path

`ONE_NARROW_LANGUAGE_AUTHORITY_SLICE_THEN_FREEZE`

## Principal Architecture Verdict

`ADD_GENERAL_AUTHORITATIVE_REALIZATION_ATOM`

One construction delivers both required effects: Cognition must explicitly emit the response
semantics it intends Language to realize, as a **closed, model-proposed, host-validated atom** that
references only already-authorized content or a closed conversational/creative act with a bounded
target. The plan then carries that authorized atom as the single primary; Language realizes only it;
zero atoms fails closed.

## Executive Decision

Deny-by-default (ZA-A) is safe but wrong for this product: the workload inventory shows real
conversational turns — greetings, acknowledgements, and suggestion/creative requests — that the
runtime must answer, and denying them would turn ordinary conversation into typed failures. Upgrading
`current_intent` (ZA-C) is rejected outright: it is descriptive plan text with no authority, and
granting it authority would make free-form model prose answer content. Mode-only authority (ZA-D) is
insufficient: `mode = GREETING` still lets Language invent "I remember you from yesterday." A closed
act with a **bounded target** (ZA-E) plus a **primary-response designation** over authorized atoms is
the minimal unified model. It also removes the quote asymmetry without touching `SOURCE_QUOTE`
exactness, because the host still verifies the quote's bytes; it only permits the model to *designate*
which authorized claim is the answer.

## Repository Truth

`main` at `3b313c9`, clean, ahead/behind 0/0. Frozen: Phase-2 qualification-negative / causal
unresolved (`CLOSURE.md`), V7 factual authority (`627b943`), V9 language authority + request-id
isolation (`136f466`), core-freeze review verdict `CORE_FREEZE_BLOCKED_BY_LANGUAGE_AUTHORITY`
(`3b313c9`). Gates at HEAD: 2496 tests passed / 0 failed, typecheck/aux/build/lint/governance/diff
clean.

## Zero-Fact Production Inventory

36 test/fixture files contain zero-factual-claim REALIZE turns (31 live `v7` wire, 5 legacy). Message
classification: `OTHER_NONFACTUAL_CONTINUATION` 101, `INSTRUCTIONAL_HOST_COMMAND` 27,
`GREETING` 13, `QUESTION_MAYBE_FACTUAL` 15 (suggestion/advice-style in this corpus),
`ACKNOWLEDGEMENT` 4. Concrete examples: "Hello there.", "Hello, remember this.", "Thanks, noted.",
"Thank you, that really helped.", "Got it, that works.", "How should I organize my desk?", "Which
notebook should I use?", "Can you suggest a simple way to organize my desk?", "/memory", "/status".

## Current Zero-Fact Modes

Today all of these fall into one undifferentiated mode: `REALIZE_CURRENT_INTENT` +
`clarification_basis = null` + `NO_SUBJECTIVE_SELECTION` + zero claims → `NO_FACTUAL_PRIMARY_RESPONSE`
with **zero authoritative atoms** in the model-facing payload. Nothing distinguishes a greeting from
an acknowledgement from an under-asserted factual question.

## Greeting Path

13 real messages. The runtime must reply socially; under the current mode the reply is unsupervised.
Required authority: a closed act (greet) tied to the current turn. Host cannot classify "Hello
there." itself (no task classifier, and none is permitted).

## Acknowledgement Path

Real messages exist ("Thanks, noted.", "Got it, that works."). Same requirement as greetings but a
different realization (acknowledging/closing rather than opening). A host-rendered fixed text would be
lawful by construction but user-hostile and architecture-leaking; an authorized act is the honest
representation.

## Creative Path

Suggestion/advice requests ("Which notebook should I use?", "Any color suggestions?") — the corpus has
15 such turns and zero pure "write a poem"-style turns, but §11's case is architecturally the same:
the user's request itself grants bounded generative latitude. This is **generation permission**, not
semantic authority: the host cannot verify that the request asked for a poem, and must not try (no
task classifier). The atom records the latitude explicitly and bounds it to the current turn reference.

## Instructional Path

`/memory`, `/status`, `/help`, `/exit` are host commands handled at the CLI layer and never reach the
turn pipeline; "instructional" turns inside the pipeline are ordinary conversational continuations.
No additional mode is required by this workload.

## Existing Directive Authority

`REALIZE_CURRENT_INTENT` / `CLARIFY_MISSING_CONTEXT` are **execution routing**, not semantic
authority: the clarification branch is bounded by the independently authorized
`clarification_basis`, and the realize branch is bounded by the proposal's atoms. Adding directive
kinds such as `REALIZE_CONVERSATIONAL_ACT` would conflate routing with semantics and multiply the
branch space; the new authority belongs in the response-semantics atom, not the directive enum.

## current_intent Authority

`CURRENT_INTENT_IS_PLAN_ONLY_NOT_SEMANTIC_AUTHORITY` — and it is not even model-visible to Language:
the V7/V8/V9 binding carries only `schema_version`, `proposal_hash`, `directive`,
`clarification_basis`. It remains descriptive cognition metadata.

## Can current_intent Become Authority Safely?

**No.** It is free-form prose; making it authoritative grandfathers arbitrary model prose into answer
content, silently rewrites a frozen semantic ("descriptive response plan") and mixes planning with
authority. Rejected without further consideration.

## User-Granted Generative Latitude

Supported as an explicit, bounded act: the model proposes a generative act whose `target_ref` is the
current authorized turn reference; the host validates the reference and the closed kind. What the
host cannot do — and must not pretend to do — is verify that the user's text actually requested
fiction. The guarantee is that novelty is *declared and bounded to the turn*, never that it is
fact-checked.

## Factual vs Nonfactual Novelty

Frozen distinction preserved: "Hello!" or a fictional name is harmless intentional novelty under an
authorized act; "Paris has 12 million residents." remains a factual assertion requiring V7 authority.
The host cannot deterministically separate them in generated text (§14) — so the boundary is
enforced by *what Language is given*, not by inspecting what it wrote.

## ZA-A

Deny zero-authority Language: safe and minimal, but it converts 30+ real conversational workloads
(greetings, acknowledgements, suggestions) into typed failures and leaves the host with no honest
reply. A host-authored fixed message is lawful by construction (host-rendered behavior precedent: the
CLARIFY branch) but should **not** be the primary answer — it either leaks architecture ("I can't
produce an authorized response") or manufactures a conversational act the model never claimed.
Verdict: adopt **as the safety invariant**, reject **as the product architecture**.

## ZA-B

Explicit conversational-act authority: correct direction, but as stated (a freestanding act family)
it duplicates the primary-response question — Language still needs to know the act is *the answer*.
Folded into the general atom below rather than adopted standalone.

## ZA-C

Rejected (see `current_intent` analysis).

## ZA-D

Mode-only authority: insufficient. `mode = GREETING` does not bound content, so Language can invent
history inside a lawful mode. Rejected as the sole mechanism; retained only as the atom's `kind`.

## ZA-E

Mode + bounded content: the defensible core. The act carries a closed kind and a bounded target
reference, and Language may only realize that act. Adopted as the conversational/creative component
of the general atom.

## Primary Response Role Analysis

Adding a host-validated `PRIMARY_RESPONSE` role to realization references solves all five answer
shapes uniformly — exact quote, host-verified derivation, stance, clarification (existing branch), and
conversational/creative act — **without** making unsupported content authoritative, because the role
points only at atoms that already passed their own authorization. The role answers "what is the
answer", not "is the answer true".

## Who Selects Primary Response?

**The model selects; the host validates structurally.** The host cannot know what answers the user
without natural-language task understanding, which is forbidden and unavailable. The residual risk is
bounded by construction: a model that designates the wrong *authorized* atom produces a
wrong-but-authorized answer — a model-compliance/relevance failure, exactly the same class as a wrong
stance among lawful alternatives — never an unauthorized assertion. Designating nonexistent,
unauthorized or wrong-kind atoms fails closed.

## Pure-Quote Analysis

`ALLOW_AUTHORIZED_QUOTE_AS_PRIMARY_RESPONSE`. `SOURCE_QUOTE` exactness is untouched: the bytes are
still verified against the source. Only the *designation* is new. This removes the asymmetry "0 claims
→ allowed, 1 quote → rejected" without weakening authority, and it makes the N6-shaped turn honest:
if the model designates the rule/query quote as its answer, the turn becomes a quote realization of
authorized text (a relevance defect the research endpoint can flag), not a Language-invented answer.

## Recommended Authority Model

> Cognition must explicitly emit the response semantics it intends Language to realize. The host
> authorizes only closed kinds that reference already-authorized content — an authorized claim
> (quote or host-verified derivation) as `PRIMARY_RESPONSE`, the authoritative stance, or a closed
> conversational/creative act with a bounded target reference. Language realizes the authorized atom
> and nothing else. Zero authorized response semantics ⇒ fail closed; Language is never invoked.

## Exact Zero-Authority Fail-Closed Rule

Confirmed and frozen as an invariant: a `REALIZE_CURRENT_INTENT` turn with `clarification_basis =
null` and **no authorized response-semantics atom** (no primary designation over an authorized claim,
no stance, no authorized conversational/creative act) **must fail closed** — no Language call, no
behavior minted, typed diagnostic. There must never again be an unbounded zero-authority Language
path.

## Language Eligibility Rule

Language is invoked iff the authoritative proposal contains exactly one authorized response-semantics
atom and the realization plan's primary designation resolves to it. The atom must be of a kind
admissible for the mode (factual/stance/conversational/creative), and every reference must resolve to
an atom that already passed V7 factual authorization, stance validation, or the act's own closed
validation.

## Versioning Requirement

Next live versions required (names per repository convention): `conversation-cognition-proposal-v8`
(the model emits the response-semantics atom) and `language-realization-input-v10` (the authorized
atom + primary designation as the realization contract). `language-realization-plan-v0` is superseded
for live use with a versioned successor. No canonical-state version changes.

## Historical Compatibility

V1–V7 cognition proposals and V1–V9 language inputs remain readable/verifiable under their frozen
validators and hash domains; no historical output is reinterpreted; the live path moves forward only
and has no fallback to the unsafe zero-atom semantics.

## Model-Visible Input

The language payload contains the authorized response-semantics atom plus the supporting authorized
claims/stance it may draw on, the user request scene/task (as input content, never as answer
authority), the constraints, and the plan's primary designation. In the conversational/creative mode
the model sees the authorized act kind and target ref — never free-form authority prose. The
`response_request_id` remains host-only.

## Hash / Binding Consequence

The authorized response-semantics atom is part of the authoritative proposal and therefore covered by
the authoritative proposal hash; the language input binds it through the proposal hash as today. The
raw model-authored atom before host validation is never hashed. Same-authority-same-hash semantics
are preserved.

## Does This Require New Canonical State?

`NO` — the atom is turn-local proposal content like factual claims and the selection; nothing
persistent is added.

## Does This Reopen Affect?

`NO`.

## Does This Reopen Factual Authority?

`NO` — `SOURCE_QUOTE` exactness, the derivation registry and the whole-proposal fail-closed severity
are untouched; the atom gains a designation role, not new inference power.

## Does This Require General NL Verification?

`NO` — no entailment checker, no factuality judge, no task classifier. The boundary is enforced
upstream (what Language is given and what it is told to realize), with the residual clearly documented
below.

## Core Freeze After One Slice?

`YES, conditionally` — one narrow slice implementing the atom + primary designation + the
zero-authority fail-closed invariant, with tests (greeting/acknowledgement/creative/quote-answer
eligibility, zero-atom rejection, request-id isolation preserved, V7 factual non-regression, rationale
non-regression), then the freeze manifest. It does not require perfect semantic containment.

## Relationship After Freeze?

`YES` — once the zero-authority path is closed and Core freezes with the manifest (and Affect
documented as causal-unresolved), Relationship Familiarity can begin without Affect Phase-2 causal
validation; familiarity persists/restores/projects/influences independently.

## Recommended Next Slice

**`AFFECT_COGNITION_RESPONSE_SEMANTICS_ATOM_V0`** — exactly one implementation slice:
(a) add the closed, model-proposed, host-validated `response_semantics` atom to the next cognition
protocol version, with kinds limited to what the inventory proves necessary: authorized claim as
primary (quote or derivation), authoritative stance, and closed conversational act
(`GREET` / `ACKNOWLEDGE`) or generative act (`GENERATIVE`, target-bounded to the current turn);
(b) carry it as the realization plan's primary in the next language input version;
(c) enforce the zero-authority fail-closed invariant;
(d) mechanically upgrade live-producer fixtures (historical fixtures untouched);
(e) prove with production tests, then freeze Core with the manifest. Non-goals: no task ontology, no
NL entailment, no LLM judge, no new factual inference, no new canonical state, no Affect/Relationship
change, no prompt tuning beyond the mechanical advertisement of the new closed field, no benchmark
special cases. The future executor must STOP if implementation requires any of those.

## Production Files Changed

`NO`.

## Real Model Calls

`0`.

## Confidence

**High** on the diagnosis and the invariant: both gaps are source-verified and were constructed
mechanically in the prior review; the workload inventory grounds the required act kinds in real
fixtures rather than hypotheticals. **Medium-high** on the exact atom shape: the boundary between
"closed act with bounded target" and "generative act" is an architecture choice with product-visible
consequences, which is why the recommendation fixes the mechanism and the minimal kind set while
leaving naming/shape details to the frozen slice design.

## Largest Remaining Uncertainty

Whether a bounded conversational/generative act is sufficient for the product's real conversational
range once deployed — the inventory proves greetings, acknowledgements and suggestion requests, but a
live model may produce turns that fit no closed act and would then fail closed. That is a conservative
failure mode (no unauthorized answer), and the mitigation is to extend the closed kind set only when
a real workload demonstrably requires it — never a general dialogue ontology.

STOP. No implementation performed.
