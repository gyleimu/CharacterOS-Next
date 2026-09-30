# DECISION_PROBE_V0_DESIGN

Status: **DESIGN FROZEN + MINIMAL INSTRUMENT IMPLEMENTED (offline-verified). NOT RUN.**
Repository: `D:\Documents\CharacterOS-Next` · branch `main` · HEAD `02b6c46`
Date: 2026-09-20
Lineage: `NORTH_STAR_EVIDENCE_AUDIT.md` → `CONTROLLED_BELIEF_INTERNALIZATION_V1_DESIGN.md`
(ruling `CURRENT_BELIEF_SEMANTICS_INSUFFICIENT_FOR_DECISIVE_V1`) → this document.

## Verdict

```
DECISION_PROBE_V0_READY_FOR_QUALIFICATION
```

Phase **D0 has not been executed.** The design is frozen, the minimal instrument is
implemented and offline-verified (41 offline tests, 0 model calls), the production seams it
depends on are confirmed present and exported, and a qualified local executor
(`qwen3.5:9b`, the same digest the affect experiments qualified) is available on this
machine. What remains before D0 can run is one binding: the **projection capture** step that
produces the production-built request the probe consumes. That binding is specified in
§11 and is work, not a blocker.

---

## 1. Repository Evidence

The design rests on six verified facts. Each was read from the tree at `02b6c46`.

**V1 — The production cognition contract has no decision atom.**
`conversation-cognition-provider-v8.ts`: the nested `cognition` wire object
(`COGNITION_WIRE_JSON_SCHEMA_V8`, `additionalProperties: false`) **requires** `action_intent`
(line 68) and types it `{ type: "null" }` (line 79). The decision is a required constant.

**V2 — The only live closed sets are response shapes.**
Top-level V8 proposal schema (7 required keys): `communication_directive.kind ∈
{CLARIFY_MISSING_CONTEXT, REALIZE_CURRENT_INTENT}`; `response_semantics.kind ∈
{PRIMARY_FACT, PRIMARY_STANCE, PRIMARY_CLARIFICATION, PRIMARY_CONVERSATIONAL_ACT}`.
Everything else is free text (`current_intent`, `subjective_selection.stance`).

**V3 — The belief→action relation surface is an unwired island.**
`state_action_relations` (`SUPPORTS|OPPOSES|IRRELEVANT`) exists in
`cognition-proposal-v1.ts`; `allowed_actions` has **zero** non-test references in
`packages/runtime/src/session/**`; `cognitive-prompt-projection-v1.ts:18-21` declares
*"no final action"* and that the prompt never instructs the model to *"prefer credence, or
choose any action"*; `belief-decision-influence-relation.ts:17` *"exposes ONLY relations"*;
`belief-proposition-admission.ts:41` *"decision = NONE"*; `selected_action` occurs only
inside `belief-decision-arbitration-policy.ts`.

**V4 — The information channel the probe must preserve is real and live.** *(Correction to a
narrower first reading: the belief projection IS carried by the production request.)*
The V8 renderer delegates up the chain `buildConversationSubjectDataV4` (v6:212) →
`buildConversationSubjectDataV3` (v3:29) → `buildConversationSubjectDataV2` (v2:183). **V2
renders `[SUBJECTIVE BELIEF STANCES …]` at v2:273** together with `[regulation]`,
`[relationships]`, `[interaction familiarity …]`, `[traits seed …]`. So the production V8
request carries the canonical belief surface (proposition id, label, exact credence) into
the executor. **The input channel exists; only the output contract lacks a decision.**

**V5 — The only prior belief-causality experiment used the best live closed set and could not
reach a verdict.** `belief-causal-validation-v0`: endpoint `communication_directive.kind`,
real DeepSeek, 104 scenes, 150 requests, 100/104 host-valid →
`BELIEF_CAUSAL_RESULT_INCONCLUSIVE`, blocked partly by a measured 30–40 % same-request flip
at temperature 0. Its powered successor is preregistered, PAUSED, 0 calls.

**V6 — The live closed sets are near-insensitive to a larger manipulation.**
`canonical-affect-communication-directive-causal-v0`: directive disagreement `0.167` under
**±0.25** valence, hard controls `0` → `…INPUT_EFFECT_ONLY`. Downstream language: directive
`0 %`.

**V7 — A production-faithful request can be captured without production change.**
`research/experiments/durable-life-history-future-behavior-divergence-v0/harness.ts:374`
`captureFutureProjection` injects a capturing `CognitionProviderV0` into the production
`CognitionActionTransitionExecutor` and reads back the exact projection the production path
built. The transport seam is one method, `ModelTransportV0.complete(request)`, with
`ModelTransportRequestV0 = { messages, structured_output?: { kind: "JSON_SCHEMA", schema } }`.

---

## 2. Why Production V8 Is Not Modified

**Decision: DecisionProbeV0 lives entirely in research space. `COGNITION_WIRE_
JSON_SCHEMA_V8` and every production cognition file are byte-unchanged.**

The justification is not convenience — it is that a research-only probe is **strictly more
informative** for this question than a production change, for four reasons:

1. **The information channel is already production-equivalent.** V4 shows the production
   request already carries the belief projection. The probe therefore needs to change only
   the *output demand*; changing the production schema would additionally change the
   production contract, every preregistered request pin, and the frozen experiments'
   byte-identity law — for no additional scientific resolution.
2. **A production change would confound the measurement with a capability change.** Wiring a
   decision atom into V8 changes what the live product asks of the model, invalidating
   comparisons with every committed result (including the affect family and
   `belief-causal-validation-v0`). A research-only endpoint can be compared against the
   production request byte-for-byte.
3. **The brief forbids it.** "默认不得修改 `COGNITION_WIRE_JSON_SCHEMA_V8`"; a production
   change is permitted only on explicit evidence that a research-only probe cannot
   scientifically measure the existing projection. That evidence does not exist — V7 shows
   the request is capturable and the substitution is a single member.
4. **Reversibility.** A research instrument can be deleted; a schema change cannot.

The one thing a research-only probe *cannot* claim is that the decision is a production
capability. That limitation is recorded as an explicit non-claim (§9) and is the price of
not corrupting the frozen comparison surface.

**Therefore no production contract change is proposed, and none is executed.**

---

## 3. DecisionProbeV0 Contract

### 3.1 Vocabulary

The brief's default was `ACCEPT | VERIFY | REJECT`. It is **adopted unchanged**, after
checking it against the experiment's proposition and the existing system semantics:

| Requirement | Assessment |
|---|---|
| closed set | yes — exactly three tokens, `enum` in the schema |
| mutually understandable | yes |
| low semantic ambiguity | yes, **given** the frozen definitions block (below). Bare "VERIFY" is ambiguous; the frozen text binds it to "check against an independent source before acting" |
| action-like, not style-like | yes — each token is a stance toward a claim, not a phrasing choice |
| stable across executors | untested; that is exactly what D0 measures |
| schema-validated | yes — `additionalProperties: false`, `const` schema version, `enum` decision |
| easy to score mechanically | yes — one string field, exact equality |
| no freeform primary outcome | yes — the primary field is an enum; free text is confined to an optional, ignored member |

**Alternatives considered and rejected:**
`communication_directive.kind` (2-valued, response-shaped, measured near-insensitive — V6);
`response_semantics.kind` (4-valued, still response-shaped); `state_action_relations`
(a sparse relation *report*, unwired, free-string action space — V3).

### 3.2 The output object

```json
{
  "decision_probe_schema_version": "decision-probe-v0",
  "decision": "ACCEPT" | "VERIFY" | "REJECT",
  "explanation": "<optional, 1..240 code points, NON-PRIMARY>"
}
```

Frozen definitions rendered to the executor (and hashed):

- `ACCEPT` — the available information is sufficient and the claim should be acted on without further checking
- `VERIFY` — the claim should be checked against an independent source before it is acted on
- `REJECT` — the claim should not be accepted and should not be acted on

### 3.3 Laws

| Law | Statement |
|---|---|
| L1 INPUT FIDELITY | The instrument **never renders subject data**. It consumes an already-production-built request. |
| L2 DECLARED-ONLY DIFF | The only permitted change is `structured_output`. In `SUBSTITUTION_WITH_OVERRIDE` the only other change is the frozen block appended to the system message, which must survive as a byte-exact production prefix. |
| L3 NON-MUTATION | The input request object is never mutated; a new frozen object is returned (proved by deep-equality test). |
| L4 CLOSED SET | Exactly three tokens. The `explanation` member is validated for well-formedness and then **discarded** — it cannot reach the scorer. |
| L5 FAIL CLOSED | Malformed / unknown key / missing / wrong version / out-of-set / bad explanation → an explicit rejection code. No repair, no retry, no default. |
| L6 NO PRODUCTION CHANGE | Imported by nothing in `packages/` or `product/`. Research asset only. |

Rejection codes: `EMPTY_CONTENT`, `NOT_JSON`, `NOT_OBJECT`, `UNKNOWN_KEY`,
`MISSING_REQUIRED`, `SCHEMA_VERSION_MISMATCH`, `DECISION_NOT_IN_CLOSED_SET`,
`EXPLANATION_INVALID`. Outcome kinds: `DECIDED`, `REJECTED`, `TRANSPORT_FAILED` —
a transport failure is **never** a decision.

---

## 4. Placement / Architecture

```
production session / executor  ── builds and renders the request ──┐
                                                                  │  (captured, unmodified)
                                                                  ▼
                          ┌──────────────────────── DecisionProbeV0 ───────────────────────┐
                          │ 1. keep messages (byte-exact, or production-prefix + frozen    │
                          │    override block)                                             │
                          │ 2. substitute structured_output.schema                          │
                          │ 3. ONE transport.complete() call, no retry                      │
                          │ 4. validate against the closed set, fail closed                 │
                          │ 5. emit a hash-carrying record                                  │
                          └────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
                                                     DecisionProbeRunRecordV0
```

**Module layout** (`research/experiments/decision-probe-v0/`, 4 files + README):

| File | Responsibility |
|---|---|
| `contract.ts` | frozen vocabulary, definitions, JSON Schema, override block, strict parser, request builder + fidelity audit |
| `probe.ts` | one call, one record; hashes; no mutation; fail-closed outcomes |
| `fixtures.ts` | the three frozen D0 fixtures and the frozen D0 protocol constants |
| `decision-probe-v0.test.ts` | 41 offline tests (8 required categories) |

**Imports reused** (all pre-existing, all exported): `ModelTransportV0`,
`ModelTransportRequestV0`, `ModelTransportResponseV0` from
`packages/runtime/dist/transports/model-transport.js`; `hashEnvelope`, `canonicalJsonString`
from `packages/subject-core/dist/index.js`; `CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA`
from the V8 provider (used in tests to prove the substituted-away contract is the *real* one).

**Gate integration:** one line added to `vitest.config.ts`'s explicit include list, matching
the repository's existing pattern for research suites. The tests are fully offline
(stub transports), so `pnpm test` stays runnable on a machine without any executor.

**Not built, deliberately:** no CLI, no evidence writer, no scoring aggregator, no D1 runner.
Those are added when qualification is actually attempted, so that nothing in the tree
pretends to have produced results it has not produced.

---

## 5. D0 Instrument Qualification

**Question:** can this instrument discriminate the three decisions at all?
**Independence:** every fixture's expected decision is derivable from the observation text
alone, so a **GENESIS** subject suffices. No formation, no belief adaptation, no lived
history is used or required.

| ID | Fixture | Determinant (from the observation alone) | Pre-registered expected |
|---|---|---|---|
| `D0-A-OBVIOUS-ACCEPT` | a colleague's claim agrees with a fact the subject can directly inspect | available fact agrees ⇒ no further checking can change the decision | `ACCEPT` |
| `D0-B-OBVIOUS-REJECT` | a colleague's claim contradicts a fact the subject can directly inspect | available fact contradicts ⇒ the claim should not be acted on | `REJECT` |
| `D0-C-AMBIGUOUS-VERIFY` | the claim is undetermined by anything available, and an independent check is stated to be available and cheap | nothing determines the claim + a cheap check exists ⇒ check before acting | `VERIFY` |

The three expectations are the three **distinct** closed-set tokens (tested), so a run that
returns one constant token fails qualification by construction.

**Two modes, both measured:**

- `SUBSTITUTION_WITH_OVERRIDE` (**primary**) — the production system prompt is preserved as a
  byte-exact prefix and the frozen override block is appended. Needed because the production
  prompt otherwise demands a V8 proposal shape that contradicts the probe's schema.
- `PURE_SUBSTITUTION` (**fidelity control**) — messages byte-identical; only
  `structured_output.schema` differs. This is the strongest possible fidelity claim and it
  directly **measures** whether the production prompt's format instruction wins over the
  schema declaration. Whichever way it comes out is a finding, not a design failure.

---

## 6. D0 Noise Protocol

1. **Pilot only.** `r_pilot = 3` replicates per (fixture, mode), same fixture, same subject
   state, same executor, same generation settings, byte-identical probe requests except the
   replicate ordinal (which is **not** in the request).
2. **Cap.** If the pilot is unstable, extend to `r_pilot_max = 6`. Never beyond, and never
   silently — an extension is recorded with its reason.
3. **Total D0 cost:** 3 fixtures × 2 modes × 3 replicates = **18 calls** at the minimum,
   36 at the cap. Small on purpose.
4. **Self-noise statistic:** per (fixture, mode), the modal decision and the agreement
   fraction; pooled, the schema-rejection rate and the `TRANSPORT_FAILED` rate.
5. **No belief, no formation, no state manipulation is involved in D0.** Any D0 number is a
   property of the instrument and the executor, never of CharacterOS state.

---

## 7. D0 Verdict Rules

| Verdict | Condition |
|---|---|
| `DECISION_INSTRUMENT_QUALIFIED` | in the **primary** mode, every fixture's modal decision equals its pre-registered expectation, and every fixture reaches agreement ≥ `2/3` |
| `DECISION_INSTRUMENT_UNQUALIFIED` | any fixture's modal decision contradicts its expectation (the instrument cannot express the intended decision) |
| `EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE` | schema-rejection rate over D0 exceeds `max_schema_rejection_rate = 0.5`, or `TRANSPORT_FAILED` prevents the pilot |
| `INCONCLUSIVE_BY_DECISION_NOISE` | all calls yield valid decisions, but no fixture has a modal major mode (self-noise swallows the signal) |
| `INCONCLUSIVE_BY_MODE_DIVERGENCE` | the primary and fidelity-control modes disagree on qualification (reported with both mode tables) |

**Hard interpretation rule (from the brief, adopted verbatim):** `EXECUTOR_UNQUALIFIED_FOR_
DECISION_PROBE` means *this executor cannot use this measurement contract*. It **must never**
be read as "CharacterOS state has no effect". The same applies to
`INCONCLUSIVE_BY_DECISION_NOISE`. Only `DECISION_INSTRUMENT_QUALIFIED` opens D1.

---

## 8. D1 State Sensitivity Test

**Precondition:** `DECISION_INSTRUMENT_QUALIFIED`. D1 is a **measurement-sensitivity** test,
not the belief experiment. It uses a genesis-authorized lawful counterfactual state — **no
lived-history formation, no belief adaptation**.

Held fixed: same subject identity, same observation, same retrieval, same request structure,
same executor, same generation settings, same probe bytes. **Only one belief credence
differs**, and only for a proposition the fixtures show to be probe-relevant.

| Arm | Canonical belief state | Construction |
|---|---|---|
| `STATE_HIGH` | `P1` credence high (e.g. `0.75`) | lawful authored counterfactual state via `SubjectStateV4GenesisSeedV0` + `materializeSubjectStateV4V0`, with a full-state diff proving **only** `/beliefs/<P1>/credence` differs |
| `STATE_LOW` | `P1` credence low (e.g. `0.35`) | same, mirrored |
| `STATE_NEUTRAL` | `P1` at the stance-zero fork value | same, for the dose midpoint |
| `STATE_SWAP` | if a lawful swap is available: the two states exchanged | same construction, roles reversed |

**Pre-registered directions:** `STATE_HIGH` favors `VERIFY` over `STATE_LOW` on the
verify-relevant probes; `STATE_LOW` favors `ACCEPT`/`REJECT` (i.e. acting without checking)
over `STATE_HIGH`. `STATE_NEUTRAL` lies between. Every direction is registered before any call.

**Saturation and validity guards carried over from the belief design:** neither arm at a
bound; credences compared against a **float-replayed** prediction (the plasticity law's own
header warns `0.6 − 0.05` lawfully stays `0.5499999999999999`, so decimal arithmetic is not a
valid gate); the projection must differ and the only differing rendered line must be the
belief credence line; `proposition_id` must be identical across arms so it cannot leak the arm.

**Critical early-stop (from the brief, adopted verbatim):** if the belief difference is large
but the probe choice does not move beyond self-noise, return

```
DECISION_PROBE_NOT_SENSITIVE_TO_BELIEF_STATE
```

and **stop**. Do not proceed to the full V1 and do not spend its hundreds of calls.

### 8.1 D1 may not claim

D1 is a sensitivity test. Even a positive D1 does **not** prove history internalization,
because the belief difference was **constructed**, not lived. The only licensed claim is:

> the current executor + projection + DecisionProbeV0 are able to detect
> belief-state-dependent structured decision changes.

---

## 9. Unlock Criteria for Full V1

`CONTROLLED_BELIEF_INTERNALIZATION_V1` unlocks only when **both** hold:

```
D0 = DECISION_INSTRUMENT_QUALIFIED
AND
D1 = STATE_SENSITIVE   (i.e. not DECISION_PROBE_NOT_SENSITIVE_TO_BELIEF_STATE)
```

Then, and only then, the full sequence runs: `Experience → naturally formed Belief A/B →
history removal → structured decision → state swap → restart`, exactly as specified in
`CONTROLLED_BELIEF_INTERNALIZATION_V1_DESIGN.md` (whose §9/§14/§15 were previously blocked on
the endpoint and are unblocked by this instrument).

**Still forbidden after unlock:** modifying the belief update law; strengthening belief;
adding trust / personality / relationship semantics / consolidation / goals / preferences /
habits; treating the relation surface as a final action; editing a hypothesis to chase a
positive result; and any large change to the production cognition schema.

---

## 10. Explicit Non-Claims

1. **Not a production capability.** A `DECIDED` record proves a decision can be measured over
   the production request. It does not add a decision to the product, and the product still
   has none (`action_intent` remains a required `null`).
2. **Not subject semantics.** The probe creates no belief, appraisal, relationship,
   personality, goal, plan, preference, utility or memory, and mutates nothing.
3. **Not evidence about CharacterOS state.** Every D0 number is a property of the instrument
   and the executor. D0 has no belief, no formation and no history in it at all.
4. **Not a mediation or causal claim.** D1 manipulates a constructed credence; causality about
   lived experience requires the full V1 with its history-absence contract and swap
   intervention.
5. **Not a cross-executor claim.** One executor, one model digest, one language.
6. **Not a statistical claim.** D0/D1 report counts and rates; no significance is claimed
   unless a preregistered test is satisfied.
7. **Not a resolved endpoint conflict.** The override block leaves the production prompt's
   format rules in the request while superseding them. Whether the executor honours the
   override is measured by D0 and by the mode comparison in §5 — not assumed.

---

## 11. Files, Tests, and the One Remaining Binding

**Files changed**

| Path | Change |
|---|---|
| `research/experiments/decision-probe-v0/contract.ts` | new — frozen contract, schema, parser, request builder + fidelity audit |
| `research/experiments/decision-probe-v0/probe.ts` | new — one-call driver, hash-carrying record |
| `research/experiments/decision-probe-v0/fixtures.ts` | new — 3 frozen D0 fixtures + frozen D0 protocol |
| `research/experiments/decision-probe-v0/decision-probe-v0.test.ts` | new — 41 offline tests |
| `vitest.config.ts` | **one line added** to the explicit include list |
| `research/north-star/DECISION_PROBE_V0_DESIGN.md` | new — this document |

**Zero** production files, zero `packages/**`, zero `product/**`, zero frozen evidence.

**Tests** — `npx vitest run research/experiments/decision-probe-v0/` → **41 passed**, 0 model
calls. Coverage of the eight required categories:

| # | Required | Implemented as |
|---|---|---|
| 1 | schema rejects invalid decision | 13 rejection cases (not-JSON, non-object, unknown token, case variant, free text, missing member, wrong version, extra member, non-string, empty/over-long explanation) |
| 2 | valid closed-set decision accepted | all three tokens, with and without explanation; explanation proved absent from the validated output |
| 3 | same subject projection reused | user message byte-identical in both modes; belief projection survives verbatim; `PURE_SUBSTITUTION` messages deep-equal |
| 4 | history / retrieval not accidentally added | message count and roles unchanged; forbidden-section scan; system message grew by **exactly** the frozen block length |
| 5 | request construction deterministic | stable probe hash, stable production hash, stable record hash |
| 6 | qualification fixtures correct | exactly 3 fixtures, 3 distinct expected tokens covering the set, determinants present, frozen, no history dependence, fixture-set hash deterministic |
| 7 | artifacts carry hashes | decided / rejected / transport-failed records all carry `sha256:` request, schema and record hashes |
| 8 | no Core semantics changed | non-mutation deep-equality; only `structured_output.schema` differs; the substituted-away contract is proved to be the **real** V8 schema; module export surface pinned |

**The one remaining binding before D0 can run.** The probe consumes a production-built
request; it does not build one. D0 therefore needs a binding that produces, for a genesis
subject and a D0 fixture observation, the exact `ModelTransportRequestV0` the production path
would send. The mechanism is known and precedent-backed (V7:
`captureFutureProjection`'s capturing-provider injection into the production executor, or the
session runtime's recording transport), but the binding itself must be written and verified
against the real V8 renderer (`cognitionSystemPromptForV8` + `cognitionUserContentForV8` /
`buildConversationSubjectDataV4`) before a single qualification call is spent. Until that
binding exists and is byte-audited, no D0 verdict can be honest — and an unverified
qualification verdict is exactly the class of claim this programme forbids.

**Environment note for the qualification run:** the host that failed `pnpm test` earlier this
session did so only because no local Ollama was running; Ollama is now up and serves
`qwen3.5:9b` (digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`), the
executor the affect experiments already qualified for cognition-content sensitivity.
