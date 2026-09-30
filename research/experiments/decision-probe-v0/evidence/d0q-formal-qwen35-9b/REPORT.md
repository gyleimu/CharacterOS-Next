# D0 RUN REPORT — DECISION_PROBE_V0 + NOISE_PROTOCOL

Run: `research/experiments/decision-probe-v0/evidence/d0q-formal-qwen35-9b`
Phase: **D0-Q (formal qualification)**
Date: 2026-09-20/21 · HEAD `02b6c46`
Status: **PERMANENT — do not edit. Verdict as produced by the frozen protocol.**

## Verdict

```
DECISION_INSTRUMENT_UNQUALIFIED
```

Both modes independently produce this verdict, so the mode-divergence rule
(`INCONCLUSIVE_BY_MODE_DIVERGENCE`) does **not** apply.

| Field | Value |
|---|---|
| `overall_verdict` | `DECISION_INSTRUMENT_UNQUALIFIED` |
| `primary_mode_verdict` (`SUBSTITUTION_WITH_OVERRIDE`) | `DECISION_INSTRUMENT_UNQUALIFIED` |
| `fidelity_control_mode_verdict` (`PURE_SUBSTITUTION`) | `DECISION_INSTRUMENT_UNQUALIFIED` |
| `declares_primary_executor` | `false` |
| `d1_unlock_eligible` | `false` |

**No fixture, expected token, definition, prompt, temperature or retry setting was changed at
any point, before or after seeing these results.**

## Executor

| Field | Value |
|---|---|
| family | `ollama` |
| model | `qwen3.5:9b` |
| model_digest | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| endpoint | `http://127.0.0.1:11434` |
| transport | `OllamaNativeCognitionTransportV0` |
| temperature | `0` |
| cognition num_predict | `256` |
| context_window_tokens | `8192` |
| think | `false` |
| **declares_primary_executor** | **`false` — this is NOT the project's primary executor run** |

This run is a **non-primary** qualification. It does not and cannot unlock D1.

## Results — SUBSTITUTION_WITH_OVERRIDE (primary mode)

| Fixture | ACCEPT | VERIFY | REJECT | Reject/Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 / 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 / 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 0 | 3 | 0 / 0 | `REJECT` | 1.00 | `VERIFY` | ❌ |

## Results — PURE_SUBSTITUTION (fidelity control mode)

| Fixture | ACCEPT | VERIFY | REJECT | Reject/Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 / 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 / 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 0 | 3 | 0 / 0 | `REJECT` | 1.00 | `VERIFY` | ❌ |

Both modes are **identical**. `PURE_SUBSTITUTION` — where `messages` are byte-identical to the
production request and only `structured_output.schema` differs — produces the same decisions as
the override mode.

## Qualification calculation (frozen rules applied literally)

Frozen rule: *qualified requires every fixture's modal decision to equal its pre-registered
expectation in the primary mode, at agreement ≥ 2/3.*

1. D0-A: modal `ACCEPT` == expected `ACCEPT`, agreement `3/3` → pass.
2. D0-B: modal `REJECT` == expected `REJECT`, agreement `3/3` → pass.
3. D0-C: modal `REJECT` != expected `VERIFY` → **contradiction**.
4. Frozen rule: *any fixture's modal decision contradicting its expectation →
   `DECISION_INSTRUMENT_UNQUALIFIED`.*
5. Control mode yields the same contradiction → no mode divergence.

**Result: `DECISION_INSTRUMENT_UNQUALIFIED`.**

## Noise observations

- **18/18 calls returned a schema-valid closed-set decision.** Zero rejections, zero transport
  failures, zero truncations.
- **Agreement is 1.00 in every cell** (3/3 identical decisions at temperature 0). The
  executor's self-noise on this instrument is **not** the limiting factor.
- The instrument therefore works mechanically: the closed set is expressible, the executor
  honours it, and `ACCEPT` vs `REJECT` are cleanly discriminated (100 % of replicates,
  both modes, two independent fixtures).
- **`VERIFY` was never selected — 0 of 18 calls.**

## Failures / rejections

No schema rejections and no transport failures occurred. The single failure is a **decision
contradiction**, not an instrument error:

- D0-C, both modes: `REJECT` where `VERIFY` was pre-registered.

### Root-cause diagnosis (diagnosis only — no revision performed)

The D0-C replicate-1 raw output explains itself verbatim:

> `"explanation": "The claim lacks factual source handles and the observation is empty; no
> evidence supports acceptance."`

And the production request this run measured renders:

```
[context] scene="idle" task="Workshop note. A colleague says their plane iron takes a 25 degree bevel. …"
[current observation] (none)
```

**The binding delivers the fixture text as `task` and leaves `[current observation]` empty.**
A genesis subject has no committed observation, so the slot renders `(none)`, and the executor
was asked to decide about an observation that is, from its point of view, absent. D0-A and
D0-B still passed because their texts state an explicit agreement/disagreement with a visible
fact that the executor could act on from the `task` slot alone; D0-C's "check before acting"
reading depends on there being a *current* observation to defer on.

**This is a request-construction defect in the binding, not a decision-vocabulary failure and
not an executor failure.** The binding was built to feed "the current observation (user turn)"
(the frozen fixture specification) and it does not.

Two readings must be kept apart, and only the re-run can separate them:

- **(i) binding defect (supported by the raw output and the rendered request):** with a real
  current observation, the executor may select `VERIFY`.
- **(ii) decision-vocabulary/capability limit (not yet supported but not excluded):** the
  executor may still never select the middle option even with a correct observation.

## Artifacts

| File | Contents |
|---|---|
| `fixture-manifest.json` | fixture set + `sha256` fixture-set hash + frozen D0 protocol |
| `executor-manifest.json` | provider, model, digest, endpoint, generation settings, primary declaration |
| `binding-manifest.json` | per fixture: subject, state revision, provenance chain, production request / projection / content hashes |
| `probe-requests.json` | per (fixture, mode): probe request hash, schema hash, override-block hash, full fidelity audit |
| `trials.jsonl` | one row per call: fixture, mode, replicate, outcome, decision, rejection, transport status, **raw executor output**, all hashes, latency |
| `verdict.json` | per-cell distributions, per-mode verdicts, overall verdict, unlock eligibility |
| `RUN_MANIFEST.json` | `sha256` hash of every artifact above + the fixture-set hash + executor record |

Every replicate of a given (fixture, mode) carries the **same** `probe_request_hash`; the
request is built once per cell and reused, so replicate bytes are identical by construction.

## Smoke run (separate directory, preserved)

`evidence/d0s-smoke-local/` — D0-S, `r = 1`, primary mode only, 3 calls:
`ACCEPT`, `REJECT`, `REJECT`. It reported `DECISION_INSTRUMENT_UNQUALIFIED` from the same
D0-C contradiction. Two unrelated accounting defects in the smoke artifact were found and are
disclosed rather than silently rewritten:

1. The smoke run computed a verdict for the fidelity-control mode even though that mode did
   not run; the driver now reports `NOT_RUN` for an unrun mode. This was fixed **after** the
   smoke and **before** D0-Q; it affects reporting only and no frozen rule.
2. The smoke run was executed with an earlier driver revision that lacked per-call raw output
   capture; `raw_output` is present for all D0-Q rows.

## What this run does NOT establish

- It does **not** qualify the instrument (`DECISION_INSTRUMENT_UNQUALIFIED`).
- It does **not** qualify the project's primary executor (none was configured for this run).
- It is **not** evidence about CharacterOS state: D0 contains no belief, no formation and no
  lived history.
- It does **not** license the interpretation "the executor cannot make decisions" — it made 18
  valid decisions and discriminated two of the three categories perfectly.
- It does **not** license D1. **D1 is LOCKED.**

## Next action (not performed in this round)

A **second, separately-labeled D0-Q run on a corrected binding** that commits the fixture text
through the production observation path so that `[current observation]` is populated, keeping
the fixtures, expected tokens, decision definitions, vocabulary, mode set, replica count and
generation settings **byte-identical**. That is a harness/binding fix of the class the round's
protocol explicitly authorises; it is not a fixture or expectation change. Its outcome decides
between readings (i) and (ii) above. A revised instrument contract version would be a separate
discussion after this round's review.
