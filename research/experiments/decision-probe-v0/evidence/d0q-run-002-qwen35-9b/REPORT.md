# D0 RUN REPORT — D0Q_RUN_002

Run: `research/experiments/decision-probe-v0/evidence/d0q-run-002-qwen35-9b`
Phase: **D0-Q (formal qualification), second numbered run**
Date: 2026-09-21 · HEAD `02b6c46`
Predecessor: `D0Q_RUN_001` (`evidence/d0q-formal-qwen35-9b`, marked
`d0q-run-001-observation-binding-defect`), preserved unmodified.
Status: **PERMANENT — do not edit.**

## Verdict

```
INCONCLUSIVE_BY_MODE_DIVERGENCE
```

| Field | Value |
|---|---|
| `overall_verdict` | `INCONCLUSIVE_BY_MODE_DIVERGENCE` |
| `primary_mode_verdict` (`SUBSTITUTION_WITH_OVERRIDE`) | `DECISION_INSTRUMENT_QUALIFIED` |
| `fidelity_control_mode_verdict` (`PURE_SUBSTITUTION`) | `DECISION_INSTRUMENT_UNQUALIFIED` |
| `declares_primary_executor` | `false` |
| `d1_unlock_eligible` | `false` |

The frozen rule applies literally: when the two modes disagree on qualification, the result is
`INCONCLUSIVE_BY_MODE_DIVERGENCE` and **the favourable mode is not selected**. The primary mode
alone would have qualified; that is reported, not claimed.

## RUN_001 preservation

`evidence/d0q-formal-qwen35-9b/` is untouched. Every artifact it contains is byte-unchanged; the
only addition is `RUN_001_STATUS.json`, which records the run identity, the preserved
`DECISION_INSTRUMENT_UNQUALIFIED` verdict, and the defect it exposed. No rename, no rewrite, no
reinterpretation. Its `REPORT.md` and all hashes still describe exactly what was run.

## Observation binding root cause

`[current observation]` renders `projection.context.current_observation_ref ?? "(none)"`
(`conversation-cognition-provider-v2.ts:262`) — it is a **ref**, never a text. RUN_001's binding
put the fixture text into `context.task`, never committed an observation, and left
`scene="idle"`, producing:

```
[context] scene="idle" task="<fixture text>"
[current observation] (none)
```

The executor was asked to decide about an observation that was, from its point of view, absent,
and it said so verbatim: *"the observation is empty; no evidence supports acceptance."*
That is a request-construction defect in the research binding — not a vocabulary limitation, not
an executor-capability finding.

## Observation binding repair

Production mechanisms only (`observation-binding.ts`):

```
fixture.observation_text
  → observationInput({ observation_id: "observation:o-<fixture_id>", ... })   production
  → buildContextDelta(observation, snapshot)                                  production
  → /context value: scene = fixture text, task = null,
                    current_observation_ref = the observation id
  → buildObservationProposal → facade.reserveAndRoute → facade.commitReserved
     with issuer.issue([{ producer: "context", domain: "context" }])
  → canonical state carries a REAL current observation and the fixture scene
```

Forbidden in the repair and confirmed absent: hand-written projection, hand-written
`[current observation]`, request string patching, probe-layer observation fabrication,
duplication into task, experiment-specific prompt, any production file change.

## Production semantics of task vs current observation

Confirmed from the tree, not assumed:

| Slot | Production meaning | After the repair |
|---|---|---|
| `[current observation]` | `context.current_observation_ref` — an observation **ref**, the thing the host may name in `clarification_basis.current_observation_ref` | `observation:o-<fixture_id>` (real committed ref) |
| `[context] scene=` | the current event's scene — the operative description of what is happening now | the fixture `observation_text` |
| `[context] task=` | a standing task, distinct from the current event | `null` — the observation is **not** duplicated into it (the fixture represents only the current observation, and the production protocol does not require both) |

The rendered scene is a JSON string literal
(`conversation-cognition-provider-v2.ts:259` interpolates via `JSON.stringify`), so the prompt
contains the escaped form while the canonical state holds the raw text. Verification decodes
before comparing.

## Binding verification V2 (O1–O6, offline, 0 model calls)

| # | Property | Result |
|---|---|---|
| O1 | `[current observation]` is a real ref, never `(none)`, for every fixture | PASS |
| O1b | the ref is derived from the fixture id, not fabricated | PASS |
| O2 | the committed scene equals the frozen `observation_text` byte-for-byte; the projection agrees with the committed state | PASS |
| O3 | three fixtures → three distinct observation refs and three distinct scenes | PASS |
| O4 | `task` is `(none)`; the fixture text appears **exactly once** in SUBJECT DATA; no history / retrieval / summary / transcript section in the user message | PASS |
| O5 | the production provider still emits a byte-identical request for the same projection | PASS |
| O6 | the probe transformation still changes only `structured_output.schema` (plus the frozen override block in override mode) | PASS |

Full instrument suite: **61 tests pass** (41 contract + 10 binding + 10 binding-v2).

## RUN001_TO_RUN002_DIFF_REPORT

Written to `RUN001_TO_RUN002_DIFF_REPORT.json` in this directory. Verdict:

```
OBSERVATION_BINDING_REPAIR_ONLY
```

- **Forbidden differences found: none.** Fixture texts, expected decisions, the frozen protocol
  constants (including `r_pilot`, thresholds, modal and agreement rules, mode names) and the
  production output schema are unchanged. The frozen `fixture_set_hash` and the RUN_001
  `probe_schema_hash` / `override_block_hash` all still match.
- **Expected differences (the repair):** `context.current_observation_ref` `null` → a committed
  ref; `context.scene` `"idle"` → the fixture text; `context.task` → `null`; and consequently
  the per-fixture `projection_hash`, `user_content_hash` and `production_request_hash`.
- **Actual differences:** exactly that set — each fixture shows
  `production_schema_hash_unchanged: true`, `scene_carries_fixture: true`, `task_is_null: true`.

One false positive was produced by an early revision of the diff tool and is disclosed rather
than hidden: it compared with `JSON.stringify`, whose key-insertion order differs between the
canonical-sorted frozen file and the live constants, and therefore reported fixture/protocol
drift that did not exist. The tool now compares canonically. The confirming check was
independent: `fixture_set_hash` — a content-addressed hash — is equal.

## Smoke result

`evidence/d0s-run-002-smoke` — D0-S, `r = 1`, primary mode only, 3 calls:
`ACCEPT`, `REJECT`, **`VERIFY`**. The observation slot is non-empty, the request builds, the
schema validates and the transport succeeds. Per protocol, the smoke carries **no** qualification
verdict; the `DECISION_INSTRUMENT_QUALIFIED` it printed is informational only and is not claimed.

## D0Q_RUN_002 executor manifest

| Field | Value |
|---|---|
| family / transport | `ollama` / `OllamaNativeCognitionTransportV0` |
| model | `qwen3.5:9b` |
| model_digest | `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7` |
| endpoint | `http://127.0.0.1:11434` |
| temperature | `0` |
| cognition num_predict | `256` |
| context_window_tokens | `8192` |
| think | `false` |
| **declares_primary_executor** | **`false`** |

Identical to RUN_001 in every field. No unavoidable deviation.

## Primary mode results (SUBSTITUTION_WITH_OVERRIDE)

| Fixture | ACCEPT | VERIFY | REJECT | Reject/Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 / 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 / 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 3 | 0 | 0 / 0 | `VERIFY` | 1.00 | `VERIFY` | ✅ |

## Control mode results (PURE_SUBSTITUTION)

| Fixture | ACCEPT | VERIFY | REJECT | Reject/Error | Modal | Agreement | Expected | Pass |
|---|---|---|---|---|---|---|---|---|
| D0-A-OBVIOUS-ACCEPT | 3 | 0 | 0 | 0 / 0 | `ACCEPT` | 1.00 | `ACCEPT` | ✅ |
| D0-B-OBVIOUS-REJECT | 0 | 0 | 3 | 0 / 0 | `REJECT` | 1.00 | `REJECT` | ✅ |
| D0-C-AMBIGUOUS-VERIFY | 0 | 0 | 3 | 0 / 0 | `REJECT` | 1.00 | `VERIFY` | ❌ |

## Qualification calculation

Primary mode: A `ACCEPT`==`ACCEPT` ✓, B `REJECT`==`REJECT` ✓, C `VERIFY`==`VERIFY` ✓, all at
agreement `3/3` ≥ `2/3` → `DECISION_INSTRUMENT_QUALIFIED`.
Control mode: C modal `REJECT` != `VERIFY` → contradiction → `DECISION_INSTRUMENT_UNQUALIFIED`.
Frozen rule: the two modes disagree → **`INCONCLUSIVE_BY_MODE_DIVERGENCE`**.

## Comparison with RUN_001 (descriptive only)

| Fixture | RUN_001 primary | RUN_001 control | RUN_002 primary | RUN_002 control |
|---|---|---|---|---|
| D0-A | `ACCEPT` | `ACCEPT` | `ACCEPT` | `ACCEPT` |
| D0-B | `REJECT` | `REJECT` | `REJECT` | `REJECT` |
| D0-C | `REJECT` | `REJECT` | **`VERIFY`** | `REJECT` |

Descriptive reading, with **no unregistered causal decomposition**: the repair changed exactly
one cell — D0-C in the primary mode — from `REJECT` to a stable `VERIFY 3/3`, while every other
cell is unchanged. In the control mode D0-C stayed `REJECT`, which is why the two modes now
diverge. Mechanically this is consistent with the override block being load-bearing for the
ambiguous case: under `PURE_SUBSTITUTION` the request carries the production system prompt's own
proposal-format demands with only the schema swapped, and that configuration still does not
surface the middle option. This is recorded as an observation; the round registers no hypothesis
about it and performs no decomposition.

## Noise

18/18 calls schema-valid, zero rejections, zero transport failures; agreement `1.00` in every
cell. Self-noise is not the limiting factor in this run.

## Artifact paths

| Path | Contents |
|---|---|
| `evidence/d0q-run-002-qwen35-9b/` | `fixture-manifest.json`, `executor-manifest.json`, `binding-manifest.json`, `probe-requests.json`, `trials.jsonl` (raw outputs), `verdict.json`, `RUN_MANIFEST.json`, `RUN001_TO_RUN002_DIFF_REPORT.json`, this `REPORT.md` |
| `evidence/d0s-run-002-smoke/` | the 3-call smoke run |
| `evidence/d0q-formal-qwen35-9b/` | RUN_001, preserved, plus `RUN_001_STATUS.json` |

## What this run does NOT establish

- It does **not** qualify the instrument overall (`INCONCLUSIVE_BY_MODE_DIVERGENCE`).
- It does **not** qualify the project's primary executor (none configured;
  `declares_primary_executor: false`).
- It is **not** evidence about CharacterOS state: D0 contains no belief, no formation and no
  lived history.
- It does **not** license selecting the primary mode's favourable result.
- It does **not** license D1. **D1 is LOCKED.**

## Next action (not performed here)

The mode divergence is the open question: determine, without changing fixtures, expected tokens,
vocabulary, definitions, schema, modes, `r` or generation settings, whether the control-mode
`REJECT` on D0-C is a property of (a) the production prompt's competing output-format demands
under a schema-only substitution, or (b) the ambiguous fixture's phrasing. This requires a new
preregistration; a revised instrument version is a separate decision after review.
