# DECISION_PROBE_V1_DESIGN

Status: **PROTOCOL FROZEN. NOT RUN.** `D0_V1_RUN_001_QWEN` is authorised to *begin* only after
this document is reviewed; no V1 call was made while designing it.
Repository: `D:\Documents\CharacterOS-Next` · branch `main` · HEAD `02b6c46`
Date: 2026-09-21
Lineage: `DECISION_PROBE_V0_DESIGN.md` → `D0Q_RUN_001` (`DECISION_INSTRUMENT_UNQUALIFIED`) →
observation-binding repair → `D0Q_RUN_002` (`INCONCLUSIVE_BY_MODE_DIVERGENCE`) → this document.

---

## Scientific Verdict

```
DECISION_PROBE_V1_REVISION_JUSTIFIED
```

The revision is justified **and** carries an explicit, falsifiable outcome-invariance argument
plus three new gates and two new falsification controls. It changes **no measurement parameter**:
the override text, the three definitions, the vocabulary, the JSON schema shape, the fixtures,
the expected decisions, `r_pilot`, the thresholds, the executor and every generation setting are
inherited byte-identically. What changes is *which mode is the measurement contract*, *what
counts as evidence*, and *what must be audited*. The evidentiary bar is **raised**, not lowered.

---

## Why V0 Remains Inconclusive

V0's frozen verdicts stand and are mechanically re-verified unchanged:

| Run | Verdict | Status |
|---|---|---|
| `D0Q_RUN_001` | `DECISION_INSTRUMENT_UNQUALIFIED` | preserved, `RUN_001_STATUS.json` added |
| `D0Q_RUN_002` | `INCONCLUSIVE_BY_MODE_DIVERGENCE` | preserved, diff report attached |

V0 is inconclusive **because its own frozen rule says so**: the measurement mode qualified and
the control mode did not, and the rule forbids selecting the favourable mode. That rule was
correct to fire. V0 remains inconclusive in V0's terms, permanently. V1 does not re-adjudicate
it — `DECISION_PROBE_V1_QUALIFICATION_RULE.applies_retrospectively_to_v0 === false`, and a test
asserts it.

---

## What RUN_002 Actually Established

With the observation binding repaired, and everything else frozen:

| Fixture | Measurement mode (`SUBSTITUTION_WITH_OVERRIDE`) | Control mode (`PURE_SUBSTITUTION`) |
|---|---|---|
| D0-A-OBVIOUS-ACCEPT | `ACCEPT` 3/3 | `ACCEPT` 3/3 |
| D0-B-OBVIOUS-REJECT | `REJECT` 3/3 | `REJECT` 3/3 |
| D0-C-AMBIGUOUS-VERIFY | **`VERIFY` 3/3** | `REJECT` 3/3 |

18/18 schema-valid, 0 transport failures, agreement 1.00 in every cell, binding verified,
O7 diff `OBSERVATION_BINDING_REPAIR_ONLY`.

**Established:** (a) the executor **honours a swapped JSON schema even when the production
system prompt demands a different output shape** — proven by the control mode, where `ACCEPT`
and `REJECT` are produced correctly from a request whose system prompt says nothing about the
three-token scale; (b) with the construct definitions present, all three categories are produced
correctly and stably; (c) the entire difference between the two modes is the presence of the
construct definitions.

**Not established:** whether the ambiguous case was answered by construct application or by
shallow lexical matching on the word "check" (the fixture mentions a cheap check; the `VERIFY`
definition mentions checking). This is the residual attack, and V1 adds a control that can
falsify it (§ Hostile Review Q3).

---

## Schema vs Construct Semantics

Two different objects were conflated in V0's control design:

| | Output Schema | Measurement Construct Definition |
|---|---|---|
| What it says | which byte strings are admissible | what each admissible string *means* |
| Sufficient to transmit a scale? | **No** | Yes |
| Present in `PURE_SUBSTITUTION`? | Yes | **No** |
| Present in `SUBSTITUTION_WITH_OVERRIDE`? | Yes | Yes |

A closed enum of three bare identifiers is a **transport format**. Without the definitions, an
executor receiving `ACCEPT | VERIFY | REJECT` has been told which strings are legal but not what
they denote; it must infer the scale from English. `PURE_SUBSTITUTION` therefore tests

> can the executor reverse-engineer the scale from token names under whatever the production
> prompt happens to condition on?

and **not**

> can DecisionProbe reliably measure the three-category decision construct?

Those are different questions. Only the second is the instrument's scientific question.

---

## Role of Override Block

The override block is the **construct carrier**. Its admissible content is exactly:

- the measurement purpose (which question the decision answers),
- `ACCEPT` / `VERIFY` / `REJECT` semantics,
- the required structured output contract,
- the minimal instruction needed to resolve the conflict with the production prompt's own
  output-format demands.

It must be **state-agnostic** and **condition-blind**: identical bytes in every arm, every
state, every condition, for every subject. It may not name a fixture, an expected answer, a
threshold, a policy, a belief, a credence, a history, or any CharacterOS-specific behaviour.

Mechanically, V1 inherits V0's block with **one** substitution — the version token — and a test
proves the round-trip: substituting `decision-probe-v1` back to `decision-probe-v0` reproduces
V0's block exactly. That is the whole contract delta.

---

## Construct-Neutrality Audit

`OVERRIDE_CONSTRUCT_NEUTRALITY_REPORT` — **PASS**.

All 16 lines of the block are classified against a frozen, index-aligned table:

| Category | Lines | Admissible in V1 |
|---|---|---|
| `VOCABULARY_DEFINITION` | 4 (the "Decision meanings" header + the three definitions) | yes |
| `OUTPUT_CONTRACT` | 9 (header, format rules, required/optional members, footer) | yes |
| `MEASUREMENT_INSTRUCTION` | 3 (supersede the format rules; preserve all existing laws; choose exactly one decision for the claim in the observation) | yes, minimal |
| `STATE_GUIDANCE` | **0** | **forbidden** |
| `CONDITION_GUIDANCE` | **0** | **forbidden** |
| `OTHER` | 1 (blank separator line) | non-normative |

Audit output, verbatim: *"all 16 lines classified; categories used: MEASUREMENT_INSTRUCTION,
OTHER, OUTPUT_CONTRACT, VOCABULARY_DEFINITION; no STATE_GUIDANCE, no CONDITION_GUIDANCE"*.
The audit also asserts each decision token is defined **exactly once** and that the block's line
count matches the frozen classification — so any future edit breaks the gate rather than passing
silently.

The closest call is the `ACCEPT` definition's phrase *"the available information is
sufficient"*: it refers to the **stimulus** (the same for every arm), not to subject state. It
is classified `VOCABULARY_DEFINITION` and is reported here as the boundary case rather than
buried.

---

## Fixture-Blindness Audit

**PASS**, byte level, across all three frozen fixtures:

- no fixture's `observation_text` appears verbatim;
- no fixture id (`D0-A-…`/`D0-B-…`/`D0-C-…`) or marker (`OBVIOUS-ACCEPT`, `OBVIOUS-REJECT`,
  `AMBIGUOUS-VERIFY`) appears;
- no `fixture_id → expected_decision` mapping appears;
- **no 6-word window of any fixture appears** (n-gram paraphrase check over every window);
- no fixture is described or paraphrased.

Audit output, verbatim: *"no fixture text, id, marker, expected-token mapping or 6-gram present
across 3 frozen fixtures"*.

---

## State-Blindness Audit

**PASS**, with one individually justified exception.

Frozen forbidden-term list — `belief`, `credence`, `relationship`, `personality`, `affect`,
`mood`, `valence`, `history`, `memory`, `episodic`, `characteros`, `interaction familiarity` —
none of which appear.

One occurrence of `SUBJECT DATA` is retained and justified on record:

> Uppercase reference to the PRODUCTION prompt's own section name, occurring only inside the
> clause that BINDS the existing SUBJECT DATA / untrusted-content / evidence laws for this
> invocation. It constrains the override; it never guides the executor toward any state value,
> and it never varies with condition or arm. Removing it would let the override appear to void
> safety and evidence laws, which would be worse.

This is the narrow path the round's brief permits ("除非某词属于无法避免的通用测量描述，并给出明确理由"),
and it is recorded as an exception rather than smoothed over. The clause is a **restriction**,
not guidance: it preserves laws instead of adding any.

---

## Role of PURE_SUBSTITUTION in V1

**Reclassified from `qualification control` (veto) to `FORMAT/SEMANTIC-CONTRACT DIAGNOSTIC
CONTROL` (non-veto) — while keeping a real, narrower load-bearing claim.**

It is still run, still stored, and still mandatory to report. What changes is what its outcomes
are allowed to mean:

| Control outcome | V0 meaning | V1 meaning |
|---|---|---|
| Passes (scale produced from bare tokens) | qualified | `SCHEMA_SUBSTITUTION_HONORED` **plus** the observation that the executor could recover a *partially specified* scale. It does **not** become evidence for the construct. |
| Fails on the ambiguous fixture | **veto**: instrument unqualified | `CONSTRUCT_NOT_INSTANTIATED_BY_SCHEMA_ALONE` — a statement about the control's specification, not about the measurability of the construct. Reported; does not veto. |
| Fails to emit *any* schema-valid decision | veto (executor cannot follow a swapped schema) | **still a veto-equivalent finding**: `EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE` |

So the control is not discarded — its claim is **narrowed to the part it can actually support**
(schema-substitution compliance), which is precisely what its request bytes can test.

---

## Hostile Review

Eight attacks, answered. Where an answer is imperfect, the imperfection is stated.

**Q1 — Is this demoting a disliked control after it failed?**
The reclassification rests on a property independent of the result: `PURE_SUBSTITUTION` does not
transmit the construct definitions, therefore it cannot test construct measurability, therefore
its outcome — pass or fail — is uninformative for that question. *Outcome-invariance
demonstration:* in the counterfactual where the control had also returned `VERIFY` 3/3, the two
modes would agree, the overall verdict would read qualified, and the reclassification would
still be required, because the argument cites no decision value. **Falsification invitation:** if
a reader can produce a reading of this argument that depends on any RUN_002 quantity, the
revision must be rejected.
*Honest weakness:* the argument was articulated **after** the observation. It is a declared
**post-hoc protocol revision with an outcome-invariance proof**, not a pre-registered control.
That is recorded in `contract.ts` and here, not hidden. The remedy available to a sceptic is the
one V1 itself requires: a fresh run under a newly frozen protocol with its own hashes.

**Q2 — Why is this not p-hacking?**
Six separating facts: (i) no measurement parameter changes — audited byte-level; (ii) the
historical verdicts are frozen, mechanically re-verified unchanged by test, and V1 declares no
retrospective effect; (iii) the change is disclosed in a pre-registration for a **new** protocol
that will produce its own independent run; (iv) no selection among many candidates occurred —
V0 had exactly two modes, and the revision does not simply crown the winner; (v) the loser is
**kept** with a narrowed but real claim and a mandatory report; (vi) **the bar rises**: V1 adds
three gates V0 lacked and two falsification controls. A p-hack lowers the bar; this raises it.

**Q3 — Might the override itself induce `VERIFY`?**
Yes, plausibly: the `VERIFY` definition contains "checked", and the D0-C fixture states that a
check is available and cheap. A shallow lexical match is a live hypothesis and V1 does **not**
dismiss it. What the block demonstrably cannot do is quote the answer: it is fixture-blind (no
text, id, marker, mapping, or 6-gram). But blindness is not sufficient, so V1 registers:

- **V1-C3 `DEFINITION_PARAPHRASE_CONTROL` (mandatory, pre-registered, diagnostic).** Re-run the
  three frozen fixtures with a paraphrased definition set that preserves each construct while
  sharing no content word with any fixture (byte-audited), everything else identical.
  *Prediction:* if the instrument measures construct application, decisions are unchanged; if
  D0-C was lexically driven, it changes.
  *Pre-declared consequence:* if D0-C changes, the D0-C cell is reported
  `LEXICALLY_SENSITIVE` and the qualification is capped at the two polarity categories.
- Independent evidence already against the simplest lexical story: the **longest** definition is
  `ACCEPT` (15 words / 97 chars vs `VERIFY` 14/79 and `REJECT` 12/59), yet the ambiguous fixture
  produced `VERIFY` — so "the most detailed definition wins" is excluded by the data.
- A residual sensitivity limitation is acknowledged regardless: D0-C may be strongly suggestive
  and therefore weakly discriminative. That matters for the belief experiment's probe design, not
  for V1's validity, and it is recorded as a known limitation.

**Q4 — How do you show the override defines a construct rather than specifying an answer?**
Three mechanical properties, each audited: fixture-blind (byte level, incl. n-grams),
state-blind (no subject-state vocabulary except one justified section-name reference), and
condition-blind (single frozen constant, no branch, no conditional, no arm reference). Plus a
symmetric-register property: all three tokens are defined in the same grammatical form and
comparable word counts (12–15 words).

**Q5 — Why do `ACCEPT`/`REJECT` not need the override while `VERIFY` does?**
They all receive it — none is exempt. The observed asymmetry is in *recoverability from bare
tokens*: `ACCEPT` and `REJECT` carry polarity that survives being read as ordinary procedure
vocabulary; `VERIFY` is a **procedural middle option** whose status as a decision category is not
derivable from the token. The correct statement is therefore that the bare-token instrument is
**partially specified** — it happens to work for two of three points. A scale that works for two
of its three points is not a valid instrument. (Registered prediction, not a claim: under
paraphrase, the two polarity tokens should prove more stable than the middle token.)

**Q6 — Should a real decision instrument include decision semantics?**
Yes, definitionally. An instrument is its scale plus its anchors. Validated response formats —
Likert, visual analogue, labelled discrete choice — all transmit anchor definitions. A bare enum
is the wire format, not the instrument. Asking whether the executor can guess the scale measures
the model's English priors, not the construct.

**Q7 — Could the override interact with state once the belief / static-profile experiments run?**
It cannot *vary* with state: it is one constant, identical in every arm. But "constant" must be
proved per run rather than assumed, so V1 requires:
- **V1-C4 `OVERRIDE_IDENTITY_ACROSS_ARMS` (mandatory in any downstream experiment).** A
  byte-identity proof that the block and the definitions are identical across every arm, state,
  condition and subject. Any variation is a protocol violation and voids the run.
Residual, stated plainly: a constant can still interact *statistically* with state — e.g. if the
block raises `VERIFY` propensity in all arms, between-arm signal compresses. That is a
**sensitivity** interaction, not a validity one, and its guard is the belief experiment's
existing mandatory noise-floor procedure (its §12), not a change to this instrument.

**Q8 — Is a neutral-prompt control needed to detect that interaction?**
Two are required, both registered above (V1-C3 for lexical sensitivity, V1-C4 for cross-arm
identity). One further control is registered as **optional and diagnostic-only**:
**V1-C5 `CONSTRUCT_ONLY_PROMPT_CONTROL`** — the request built with only the probe output
contract and no production system prompt, to check the construct is executable independently of
the production prompt's conditioning. It can never be a qualification input, because dropping
the production prompt destroys the production-equivalence of the information channel.

**Review conclusion:** every attack receives an answer; two answers (Q1's post-hoc timing, Q3's
residual lexical sensitivity) are imperfect and are answered with a falsification control rather
than a rebuttal. Neither imperfection blocks a valid V1, because both are *testable within V1*
and neither alters a measurement parameter.

---

## V1 Qualification Rule

`DECISION_INSTRUMENT_V1_QUALIFIED` requires, **in the measurement mode
(`SUBSTITUTION_WITH_OVERRIDE`)**:

1. every frozen fixture's modal decision equals its pre-registered expectation;
2. agreement ≥ the frozen `min_agreement_fraction` (2/3);
3. schema-rejection rate ≤ the frozen `max_schema_rejection_rate` (0.5);
4. zero transport failures on qualification cells;
5. `CONSTRUCT_NEUTRALITY` audit **PASS**;
6. `FIXTURE_BLINDNESS` audit **PASS**;
7. `STATE_BLINDNESS` audit **PASS**.

`PURE_SUBSTITUTION` is reported as a diagnostic and **never vetoes**. Its only veto-equivalent
outcome is a total failure to emit schema-valid decisions, which is an executor finding
(`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`).

Verdict vocabulary: `DECISION_INSTRUMENT_V1_QUALIFIED`, `DECISION_INSTRUMENT_V1_UNQUALIFIED`,
`EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE`, `INCONCLUSIVE_BY_DECISION_NOISE`,
`INCONCLUSIVE_AUDIT_FAILED` (any gate above fails).

---

## Executor-Specific Qualification Rule

A qualification is bound to **(executor, model + digest, generation settings, DecisionProbe
version)** and is not transferable. Therefore:

- `qwen3.5:9b` passing V1 yields exactly **`DECISION_INSTRUMENT_V1_QUALIFIED_ON_QWEN35_9B`**;
- it **does not** unlock formal D1;
- the project's primary executor still requires its own `D0-V1` qualification, and only both
  together can yield `D1 UNLOCKED`.

---

## Versioning Plan

- `research/experiments/decision-probe-v0/` — **untouched**. Contract, artifacts, evidence and
  the RUN_001 status marker remain byte-identical. A test re-verifies every recorded artifact
  hash in both V0 runs.
- `research/experiments/decision-probe-v1/` — new, independent protocol namespace:
  `contract.ts` (V1 constants, inheritance ledger, frozen qualification rule), `audits.ts` (the
  three gates), `audit.test.ts` (12 offline tests), `README.md`.
- **Implementation reuse is permitted; identity is not shared.** V1 has its own schema version
  token (`decision-probe-v1` ≠ `decision-probe-v0`), therefore its own override block bytes, its
  own JSON schema bytes, and therefore different request/schema hashes by construction. V0's
  constants remain recoverable: V1 imports them and the audit proves the exact round-trip.
- V1 artifacts will be written under `research/experiments/decision-probe-v1/evidence/` and
  labelled with the V1 version token and V1 hashes.

---

## Files Created / Modified

| Path | Change |
|---|---|
| `research/experiments/decision-probe-v1/contract.ts` | new — V1 constants, inheritance ledger, frozen qualification rule |
| `research/experiments/decision-probe-v1/audits.ts` | new — the three gates + frozen per-line classification |
| `research/experiments/decision-probe-v1/audit.test.ts` | new — 12 offline tests |
| `research/experiments/decision-probe-v1/README.md` | new |
| `research/north-star/DECISION_PROBE_V1_DESIGN.md` | new — this document |
| `vitest.config.ts` | one line added for the V1 audit suite |

V0 is unmodified. **Zero** `packages/**`, zero `product/**`, zero frozen evidence touched.

---

## Tests

- `npx vitest run research/experiments/decision-probe-v1/` → **12 passed**, 0 model calls:
  three gates PASS; the contract delta is exactly the version token; V0 parameters inherited
  byte-identically; **every recorded artifact hash of both V0 runs still matches**;
  `RUN_001`'s verdict is still `DECISION_INSTRUMENT_UNQUALIFIED` and `RUN_002`'s still
  `INCONCLUSIVE_BY_MODE_DIVERGENCE`.
- `npx vitest run research/experiments/decision-probe-v0/` → 61 passed (unchanged).
- `npx tsc -p tsconfig.auxiliary.json` → exit 0. `eslint --max-warnings 0` → clean.
- `node scripts/governance-check.mjs` → PASS.

---

## Git Diff

```
 M vitest.config.ts                            (+1 include line for the V1 audit suite)
?? research/experiments/decision-probe-v1/     (contract.ts, audits.ts, audit.test.ts, README.md)
?? research/experiments/decision-probe-v0/     (unchanged since RUN_002, incl. V1 imports reading it)
?? research/north-star/                        (+ this document)
```

---

## Next Gate

```
READY_TO_RUN_D0_V1_QWEN
```

The V1 protocol is frozen and may now be run as `D0_V1_RUN_001_QWEN` (3 fixtures × 2 modes ×
`r_pilot = 3` = 18 calls, `qwen3.5:9b`, temperature 0, num_predict 256, num_ctx 8192, think
false), together with the mandatory diagnostic controls `V1-C3` and `V1-C4`. **D1 remains
LOCKED** until the primary executor holds its own V1 qualification.

Not performed in this round, and not authorised by it: D1, belief manipulation, history
internalization, belief formation, static-profile baseline, restart experiment, any DeepSeek
experiment, and any modification to production V8.
