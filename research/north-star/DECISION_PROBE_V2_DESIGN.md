# DECISION_PROBE_V2_DESIGN — Transport-Aware Measurement Protocol

Status: **PROTOCOL FROZEN. NOT RUN. ZERO MODEL CALLS MADE IN THIS ROUND.**
Repository: `D:\Documents\CharacterOS-Next` · branch `main` · HEAD `02b6c46`
Date: 2026-09-21
Lineage: `DECISION_PROBE_V0_DESIGN.md` → `DECISION_PROBE_V1_DESIGN.md`
→ V1 DeepSeek run (`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`) → this document.

---

## Scientific Verdict

```
DECISION_PROBE_V2_REVISION_JUSTIFIED
```

V2 changes **zero bytes of the measurement contract** — mechanically proved: V2's primary
semantic contract hash is `sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53`,
byte-identical to the contract V1's runs used, and a test asserts request-level byte equality.
What V2 changes is protocol *interpretation* and *control structure*, and it **raises** the bar.

---

## Why V1 DeepSeek Verdict Remains Frozen

`D0_V1_RUN_002_DEEPSEEK` = **`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`**, permanently. The V1
frozen rule says a control that emits zero schema-valid decisions is a veto-equivalent outcome,
and it was applied as written. V2 declares `applies_retrospectively_to_v1: false` and
`applies_retrospectively_to_v0: false`; a test asserts both flags. No V0 verdict, no Qwen V1
qualification and no DeepSeek V1 verdict is reopened, upgraded or reinterpreted.

V1's handsome DeepSeek primary data (A/B/C all 3/3) and C3 data (A/B/C all 3/3) **may not** be
carried forward as a V2 pass. V2 is a protocol produced *after* observing V1's results, so it
requires fresh preregistered data on both executors (§14).

---

## What V1 Actually Falsified

Not the executor. V1 falsified a **design assumption**: that `PURE_SUBSTITUTION` is one control.

V1's control was designed and first validated on a **grammar-enforcing** transport, where
substituting only the schema genuinely tests schema compliance. On a transport that **never
transmits the schema**, the identical message bytes produce a completely different *effective
information state* in the executor. The control's name describes the mechanism at the message
level; its meaning depends on the transport. That is a validity defect in the control, and it
had to be exercised on a schema-less transport to become visible.

---

## Semantic Contract vs Structural Enforcement

| Layer | Contents | Cross-transport requirement |
|---|---|---|
| **A — Semantic Measurement Contract** | measurement task · output object shape · legal decision tokens · token meanings / construct anchors | **MUST be identical.** This *is* the instrument. |
| **B — Structural Enforcement** | provider-native JSON schema / grammar · prompt-only contract · host parser | **MAY differ.** It enforces FORM, never MEANING. Recorded in the manifest. |
| **C — Experimental Subject Information** | subject projection · current observation · belief state | What D1 will vary. Never touched by the instrument contract. |

**The governing rule:** a measurement contract may never depend on whether a transport supports
native schema. Layer B may help guarantee well-formed JSON; it may not be any executor's *only*
signal that a DecisionProbe is happening.

---

## Transport Confound Analysis

`PURE_SUBSTITUTION` across the two families:

| | Native-schema transport (Ollama) | Prompt-only transport (DeepSeek) |
|---|---|---|
| messages | production prompt, no override | production prompt, no override |
| schema delivered to provider | **yes** (grammar) | **no** (transport never sends `response_format`/`json_schema`) |
| executor knows the legal output **structure** | **yes** | **no** |
| executor knows the legal **tokens** | yes | **no** |
| executor knows it is a DecisionProbe | yes | **no** |
| observed | A→ACCEPT, B→REJECT, C→REJECT | 9/9 V8 proposals, truncated at 974 chars |
| what it measured | anchor-free but structure-known token recovery | absence of the probe entirely |

**Verdict: these are not the same scientific control. They are two different interventions.**
On the native transport the condition is a legitimate (if weak) probe of whether token names
alone recover the scale. On the prompt-only transport the condition tests nothing about the
probe at all. A control whose meaning is a function of the transport cannot serve as a
cross-transport veto.

---

## Primary Measurement Contract

**Inherited byte-identically from DecisionProbeV1's `SUBSTITUTION_WITH_OVERRIDE`.** V1's primary
mode is already a transport-independent semantic contract: the override block is **message-level**,
so both families receive the full measurement task, output object definition, legal tokens and
construct anchors.

| | Value |
|---|---|
| contract hash | `sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53` |
| V2 delta vs V1 | **none** (0 bytes) |
| V1 evidence | Qwen A/B/C 3/3 × 3; DeepSeek A/B/C 3/3 × 3; C3 stable on both |
| V2 action | interpret it as Layer A; byte-audit the inheritance; keep it |

No version-token change. V2's identity lives in the **protocol** (controls, rules, qualification),
not in the sent bytes — which is the strongest available answer to "did you quietly tune the
instrument?".

---

## FORMAT_ONLY Diagnostic

Replaces `PURE_SUBSTITUTION` as the anchor-necessity control. Constructed by removing **exactly
four lines** (the `Decision meanings (binding):` header and the three anchor definitions) from the
inherited contract and changing nothing else. Audited mechanically.

| | Primary | FORMAT_ONLY |
|---|---|---|
| measurement task | ✓ | ✓ |
| output object definition | ✓ | ✓ |
| legal token names | ✓ | ✓ |
| required schema-version member | ✓ | ✓ |
| **construct anchors** | ✓ | **withheld** |
| knows it is a DecisionProbe | ✓ (both transports) | ✓ (both transports) |

**Transport-symmetric by construction**: the manipulation is message-level, so both families
receive the same contract-minus-anchors. There is no transport on which the executor is
unaware that a DecisionProbe exists.

---

## Role of Native Schema

Layer B only. On the native transport, grammar guarantees that the answer is a well-formed probe
object; it **cannot** prefer `ACCEPT` over `VERIFY` — it constrains well-formedness, not choice.

**Assumption, declared and not asserted:** constrained decoding can shift token distributions, so
strict construct-equivalence across enforcement mechanisms is not provable *a priori*. V2
therefore measures the observable proxy instead of claiming equivalence: cross-transport
agreement on the primary contract plus parser acceptance rates. A directional disagreement is
recorded as `CROSS_TRANSPORT_DIVERGENCE` and caps the claim.

---

## Role of Host Parser

The host parser is Layer B and is **mandatory on every transport**. It is the only mechanism
that guarantees the closed set is respected when the provider does not enforce it:
`OpenAiCompatibleTransportV0` never sends `response_format`/`json_schema` (verified: zero
occurrences in the transport source; the body carries only optional `provider_request_options`,
`model`, `messages`, `temperature`, `max_tokens`).

Consequence, preregistered: on the cloud family, `schema compliance = model compliance + host
fail-closed parser`. A malformed or off-contract answer is `REJECTED` with a code, never repaired,
never retried. The frozen `max_schema_rejection_rate` threshold governs how much of that an
executor may exhibit and still be qualified.

---

## C3 Qualification Role

**Upgraded from diagnostic (V1) to a qualification REQUIREMENT (V2).**

V1 established that on both executors the three decisions survive a paraphrase that shares no
flagged term and no 6-gram with any fixture. Requiring it makes V2 **strictly stricter than V1**:
`DECISION_INSTRUMENT_V2_QUALIFIED` needs primary PASS **and** `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE`.
Requiring something already observed does not make a run easier; it makes the instrument's claim
stronger, and it prospectively rules out an instrument whose result is tied to one exact wording.

---

## Token-Name Confound Analysis

C3 varies the **anchors** while keeping the English tokens. It therefore does not address whether
the result depends on the *English meanings of the token names themselves* — a confound the
hostile review raises directly, and which cannot be answered by any control V1 had. Until it is
tested, V2 records the confound as **open**.

---

## Token-Remap Decision

**INCLUDED, as a preregistered, non-vetoing diagnostic.**

- Neutral labels `OPTION_A | OPTION_B | OPTION_C`, anchors preserved, mapping
  `OPTION_A=ACCEPT, OPTION_B=VERIFY, OPTION_C=REJECT` held **in the protocol for scoring only** —
  never stated in the prompt (audited: the prompt must not contain the mapping).
- Construction is **position-targeted**, not substring-based: a naive `replaceAll("ACCEPT", …)`
  would corrupt the REJECT anchor (which contains the word "accepted"). Audited.
- Exactly 5 lines change (enum line, anchor header, three anchor labels); line count unchanged.

**Why include it.** It is the only control that can falsify the token-name confound, it is cheap
(9 calls per executor), and it probes a failure mode orthogonal to C3. **Why it cannot veto:** it
withholds token priors on purpose; a change in behaviour is evidence that priors are load-bearing,
not that the instrument is broken. Cost and interpretation are stated, and the operator may record
an explicit decision to skip it — in which case the round reports `TOKEN_REMAP_DIAGNOSTIC_NOT_RUN`
and the confound stays open.

---

## Cross-Transport Equivalence Gate

`TRANSPORT_EQUIVALENCE_GATE` — a mechanical, offline gate that must PASS before any V2 call.

**Same across transports (audited at message level):** subject projection · fixture · observation ·
measurement task · legal token set · output object definition · parser · scoring · decision field ·
the model-facing semantic manipulation.

**Allowed to differ (recorded in the manifest, Layer B):** provider transport envelope · native
grammar availability · provider-specific request metadata.

**The gate's mechanical claim:** Layer A is carried in `messages`; `messages` are
transport-independent; the only member whose fate depends on the transport is `structured_output`,
which carries no construct text (asserted) and which the cloud transport drops. Therefore a
transport that drops the schema still delivers the full measurement contract, and a transport that
keeps it delivers the same contract plus grammar.

**Forbidden asymmetry, explicitly:** "Qwen knows it is doing a DecisionProbe / DeepSeek does not"
— this is the exact defect V1 exhibited and V2 exists to remove.

---

## Qualification Veto Rules

**Principle: a control may veto only if it observes the executor failing at a contract it was
ACTUALLY GIVEN.** A diagnostic that deliberately withholds information measures the *necessity* of
that information, not the viability of the instrument; a behavioural change is evidence the
withheld information is load-bearing — which *supports* including it.

| May veto | May NOT veto |
|---|---|
| production subject information contaminated | `FORMAT_ONLY_DIAGNOSTIC` behavioural change |
| fixture leakage | `TOKEN_REMAP_DIAGNOSTIC` behavioural change |
| state leakage | |
| protocol drift | |
| output parser unreliable | |
| executor cannot execute the **actual** measurement contract | |
| measurement contract itself highly unstable | |
| construct-wording sensitivity beyond the preregistered limit | |

---

## V2 Qualification Rule

`DECISION_INSTRUMENT_V2_QUALIFIED` requires **all** of:

1. primary: every frozen fixture modal == expected;
2. primary: agreement ≥ frozen `min_agreement_fraction` (2/3);
3. primary: schema-rejection rate ≤ frozen `max_schema_rejection_rate` (0.5);
4. primary: zero transport failures;
5. `CONSTRUCT_NEUTRALITY` PASS;
6. `FIXTURE_BLINDNESS` PASS;
7. `STATE_BLINDNESS` PASS;
8. `TRANSPORT_EQUIVALENCE_GATE` PASS;
9. **C3: `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE`** (upgraded to a requirement in V2).

`FORMAT_ONLY` and `TOKEN_REMAP` are diagnostics and **never veto**.
`applies_retrospectively_to_v1 = false`, `applies_retrospectively_to_v0 = false`.

---

## Exact Verdict Vocabulary

**Qualification:** `DECISION_INSTRUMENT_V2_QUALIFIED` · `DECISION_INSTRUMENT_V2_UNQUALIFIED` ·
`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE` · `INCONCLUSIVE_BY_DECISION_NOISE` ·
`INCONCLUSIVE_AUDIT_FAILED` · `INCONCLUSIVE_TRANSPORT_EQUIVALENCE_FAILED` ·
`CROSS_TRANSPORT_DIVERGENCE`

**Diagnostics:** `CONSTRUCT_RESPONSE_PARAPHRASE_STABLE` · `LEXICALLY_SENSITIVE` ·
`CONSTRUCT_ANCHORS_ARE_NECESSARY` · `CONSTRUCT_ANCHORS_NOT_NECESSARY` ·
`TOKEN_PRIORS_LOAD_BEARING` · `TOKEN_PRIORS_NOT_LOAD_BEARING` ·
`FORMAT_ONLY_DIAGNOSTIC_NOT_RUN` · `TOKEN_REMAP_DIAGNOSTIC_NOT_RUN`

No executor name is ever hardcoded into a verdict string; the qualification is bound to
(protocol, executor, model, generation settings, semantic contract hash) and the executor tag is
derived from the manifest.

---

## Hostile Review

**1. Is V2 just deleting a control it disliked after DeepSeek failed?**
No. The argument cites **no result**: `PURE_SUBSTITUTION` does not transmit Layer A at message
level, so its effective information content is a function of the transport, so it cannot be a
cross-transport veto. *Outcome-invariance:* had DeepSeek's control passed, V2 would still need a
transport-symmetric control to compare the two families on one basis. The control is not deleted —
its substance (anchor necessity) is **retained** as `FORMAT_ONLY`, and V2 raises the bar (C3 becomes
a requirement, plus a new diagnostic).
*Honest weakness:* formulated post-hoc. Declared as a post-hoc protocol revision with an
outcome-invariance argument, exactly as V1's revision was.

**2. Why is this a transport-confound correction rather than p-hacking?**
(i) zero sent bytes change — stronger than V1's own delta, and mechanically proved; (ii) all
historical verdicts stay frozen and are re-verified by test; (iii) V2 is a fresh preregistration
requiring **fresh data on both executors**; (iv) no selection among candidates — V2 keeps one
measurement mode and replaces a transport-dependent control with a transport-symmetric one, not a
menu; (v) the failed control's substance is retained; (vi) **the bar rises**.

**3. Is FORMAT_ONLY really transport-equivalent?**
At Layer A, yes — byte-identical message-level contract, so both families know a DecisionProbe is
happening and what the legal outputs are; only the anchors are withheld. At Layer B, no — native
gets grammar, prompt-only does not. That asymmetry is declared, bounded to form, and covered by the
cross-transport check above.

**4. Does native grammar still make the two families incomparable?**
Partly, at Layer B. The argument that it cannot alter the *construct*: grammar constrains
well-formedness, not the choice among legal tokens. The counter is real (constrained decoding can
shift token distributions), so V2 **measures** the proxy — cross-transport primary agreement — and
records `CROSS_TRANSPORT_DIVERGENCE` if it fails, rather than asserting equivalence.

**5. Why is structural-enforcement difference not a construct difference?**
Because Layer B carries no information *about the measurement*. An executor receiving the same
task, shape, tokens and anchors has the same measurement-relevant information; grammar only
prevents malformed output. Stated as an assumption with a measurable check, not as a claim.

**6. Is the primary override itself so strong that the model just executes DecisionProbe
instructions rather than reading SubjectState?**
**This is the sharpest attack, and it applies to V1 as well. The honest answer is: possibly, and
qualification cannot answer it — it is a D1 question.** The contract states *what to output*, not
*what to choose*; the choice must come from the subject data. But a salient instruction frame can
dominate. V2 does not assert otherwise; it registers **D1 prerequisites** (below) that can detect
it, including a frame-minimality arm. If D1 finds no state sensitivity, the correct first
hypothesis is frame dominance, not "the state does nothing".

**7. Is C3 stable enough to prove construct validity?**
No. It shows the result is not tied to one exact anchor wording. It does not show the construct is
*applied* rather than pattern-matched, and it says nothing about anchor necessity (FORMAT_ONLY) or
token priors (TOKEN_REMAP). The three together are evidence, not proof.

**8. Are token-name semantics still a potential confound?**
Yes. That is why TOKEN_REMAP exists. Until it runs, V2 records the confound as **open**.

**9. Does an executor passing qualification only prove instruction-following?**
In part, yes — and that is precisely what qualification is *for*. See the success boundary.

**10. What does D1 need to actually measure state rather than prompt compliance?**
Registered now as V2's handoff requirements (not executed): (i) a **state-sensitivity positive
control** — a large lawful state contrast must move the decision; (ii) a **same-request repeat
negative control** for the executor's own noise (the failure mode that killed earlier experiments);
(iii) a **frame-minimality arm** — the contract present but the decision instruction minimized, to
test whether the override frame dominates; (iv) the history-absence contract; (v) a lawful state
swap; (vi) restart. Plus a null-handling rule that cannot be gamed.

**Review conclusion:** all ten answered; three answers are imperfect (#1 post-hoc timing, #4/#5
Layer-B equivalence, #6 frame dominance) and each is answered with a **falsification mechanism**
rather than a rebuttal. None alters a measurement parameter, and all three are testable inside V2
or its D1 handoff.

---

## Call Budget

Per executor: **primary 9 + C3 9 + FORMAT_ONLY 9 = 27**, plus **TOKEN_REMAP 9 = 36**.

| Executor | Cost |
|---|---|
| Qwen (local) | 27–36 calls, no API cost |
| DeepSeek (cloud) | 27–36 calls |

No control was added for the sake of completeness: each of the three non-primary conditions
answers a distinct, named question (anchor necessity, wording sensitivity, token priors), and the
budget is dominated by the three fixtures × three replicates minimum that the frozen agreement rule
already requires.

---

## Versioning / Artifact Plan

- `research/experiments/decision-probe-v2/` — `contract.ts` (frozen protocol, inherited contract,
  the two diagnostics' contracts, veto rules, qualification rule, verdict vocabulary),
  `audits.ts` (`TRANSPORT_EQUIVALENCE_GATE` + construction audits + the inherited V1 gates),
  `audit.test.ts` (12 offline tests), `README.md`.
- V0 and V1 directories are **untouched**; a test re-verifies that their recorded verdicts still
  read as originally frozen.
- Runs will write to `evidence/d0-v2-run-001-<executor>/` with a preregistration record, per-mode
  trials with raw outputs, per-cell distributions, and `RUN_MANIFEST.json`. The semantic contract
  hash and the protocol hash are recorded **separately**, so a future reader can see that the
  instrument did not move while the protocol did.

---

## Files Created

| Path | Change |
|---|---|
| `research/experiments/decision-probe-v2/contract.ts` | new — frozen V2 protocol |
| `research/experiments/decision-probe-v2/audits.ts` | new — transport-equivalence gate + construction audits |
| `research/experiments/decision-probe-v2/audit.test.ts` | new — 12 offline tests |
| `research/experiments/decision-probe-v2/README.md` | new |
| `research/north-star/DECISION_PROBE_V2_DESIGN.md` | new — this document |
| `vitest.config.ts` | one include line |

**Zero** `packages/**`, zero `product/**`, zero frozen evidence touched. No model call made.

---

## Tests

`npx vitest run research/experiments/decision-probe-v2/` → **12 passed**, 0 model calls:
contract inheritance is byte-identical; V2 sends **zero new bytes** vs V1's primary mode (request
hash equality); FORMAT_ONLY removes exactly the four anchor lines and retains Layer A; TOKEN_REMAP
swaps exactly five lines, keeps anchors, drops the English tokens from the legal set, and keeps the
mapping out of the prompt; the transport gate passes with `messages` as the Layer-A carrier and no
construct text in the schema member; every V2 audit PASSes; diagnostics are explicitly non-vetoing;
the verdict vocabulary is frozen and contains the transport-specific inconclusive outcomes; the
three contract hashes are deterministic, mutually distinct, and the semantic hash equals V1's
recorded value; the historical V0/V1 verdicts still read as frozen.
Plus `tsc -p tsconfig.auxiliary.json` → exit 0 · `eslint --max-warnings 0` → clean.

---

## Git Diff

```
 M vitest.config.ts                              (+1 include line)
?? research/experiments/decision-probe-v2/       (contract.ts, audits.ts, audit.test.ts, README.md)
?? research/experiments/decision-probe-v0/       (untouched)
?? research/experiments/decision-probe-v1/       (untouched)
?? research/north-star/                          (+ this document)
```

---

## Final Next Gate

```
READY_TO_RUN_D0_V2_QWEN
```

Frozen call plan, per executor, in this order:
`primary 9` → `C3 9` → `FORMAT_ONLY 9` → `TOKEN_REMAP 9` (36; 27 if the operator records an
explicit decision to skip TOKEN_REMAP). Qwen first, then DeepSeek as a separate numbered run.

**D1 remains LOCKED.** D1 unlocks only when one executor holds `DECISION_INSTRUMENT_V2_QUALIFIED`
with `declares_primary_executor = true` — and even then, D1 must satisfy the six prerequisites in
Hostile Review #10 before it can claim to measure state rather than prompt compliance.

Not performed in this round, and not authorised by it: any model call, D1, belief manipulation,
history internalization, any change to production V8, any change to the DeepSeek transport, and
any addition of `response_format`/`json_schema` to the cloud transport.
