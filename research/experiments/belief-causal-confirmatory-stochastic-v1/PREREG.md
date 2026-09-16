# BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — PREREGISTRATION

A **new confirmatory experiment**, preregistered before its first model call. It is not a V0 rerun,
not a V0 patch and not a pooled extension: V0's scientific observations contribute **0** to any
confirmatory count. The measurement law, gate semantics, retry law, host-validity law, manifest law
and report-hash law are **imported** from the frozen
`STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0` — none is copied and none is retuned.

**Model calls in this preregistration slice: 0.** Preregistration commit: recorded in
`evidence/freeze-manifest.json` (`preregistration_commit_sha`) and in the final report.

## 1. Scientific claim

> Do different lived histories, through their effect on a durable canonical Belief state, causally
> change the distribution of later cognition under an otherwise matched present situation?

Claim scope: **`Belief → Cognition`** only. Forbidden: `Belief → production Decision`,
`Belief → action execution`, `Belief → delivered natural-language behavior`, human-like belief,
objective truth tracking.

## 2. Outcome and model

* Primary outcome: `communication_directive.kind` ∈ {`REALIZE_CURRENT_INTENT`,
  `CLARIFY_MISSING_CONTEXT`} — the frozen production field. No free-text scoring, keyword scoring,
  LLM judge or manual labelling.
* Executor: `deepseek-flash`, temperature 0, `stream: false`, `response_format: json_object`,
  max_tokens 16384, timeout 240 s, no model fallback and no seed fallback. Retry only on
  429 / 5xx / timeout / transport reset, at most 3 attempts with the byte-identical request.
* **Cognition-only scenes**: one cognition request per scientific trial; no utterance generation and
  no delivered-language evaluation, so the conclusion can only be about cognition.

## 3. Target proposition

`The service passage is usable.` — kept from the frozen planning design. V0's evidence is used for
**planning only** (it showed the production formation can form this proposition, the current scenario
isolates raw history, cognition responds to it, and the historical separation justified viability
planning). No pooling, no prior weighting, no confirmatory denominator, no replication evidence.

## 4. Histories (frozen)

Both branches start from a **normal empty genesis** (`beliefs.items = []`) and are formed through the
production path only: real Memory episodes → `BeliefAdaptationWiringV0` → frozen semantic runner →
host proposition admission / frozen ±0.05 plasticity → `BeliefTransitionExecutor` → SubjectCore
commit → durable state. A deterministic research-side semantic provider supplies **semantic
interpretation only** (a label for the first episode; an existing target plus relation afterwards) and
holds no identity, numeric or write authority.

| branch | progression | final credence |
| --- | --- | --- |
| LOW | 0 → 0.55 → 0.5 → 0.45 | 0.45 |
| HIGH | 0 → 0.55 → 0.6000000000000001 → 0.6500000000000001 | 0.6500000000000001 |

The first episode is byte-identical in both branches; they share the same subject id, the same
canonical label **and the same content-addressed proposition key and proposition id**, so the only
difference is the credence trajectory from episode 2 onward. No rounding is ever applied.

**Branch isolation**: two independent Memory repositories (distinct content digests), two genesis
envelopes, two commit chains. The single shared canonical transition identity is the first formation —
intentionally identical — and every later transition is disjoint (`evidence/branch-isolation.json`).

## 5. Cells

| cell | durable | model-facing mediator |
| --- | --- | --- |
| `A_LOW` | LOW | as stored |
| `B_HIGH` | HIGH | as stored |
| `C_HIGH_ABLATED` | HIGH | target item removed (research-only view) |
| `D_LOW_EQUALIZED` | LOW | target presented with the HIGH credence (research-only view) |

`C` and `D` never write: the durable belief items are hashed before and after the intervention and
must be identical (`production_write = false`).

## 6. Statistical law (frozen, imported)

Per cell a **Wilson** interval; per contrast a **Newcombe** difference interval; superiority
(`ΔAB`, `ΔBC`, `ΔDA`) as a one-sided minimum-effect test (97.5 % lower bound > `Δ_min = 0.20`); the
B/D control as **TOST** equivalence (90 % interval inside `(−ε, +ε)`, `ε = 0.15`). The success claim
is the **conjunction** of all four constraints plus every hard gate — no p-value shopping, no
post-hoc verdicts from a frozen menu of 11.

`NOT_REPLICATED` is the frozen law: a genuine null requires that **no** superiority contrast reaches
`Δ_min` under a valid protocol; anything else that is not a full conjunction is `INCONCLUSIVE`.

## 7. Sample size (frozen, imported)

`N = 200` draws per cell per phase; primary 800 cognition calls, replication 800, calibration 50;
potential total 1650 after future authorization. **This preregistration makes 0 calls.**
Planning values (not results): single-phase joint ≈ 0.87894 at a true separation of 0.40, ≈ 0.82553 at
the 90 % host-validity floor, two-phase approximation ≈ 0.7725 (floor ≈ 0.6815).

## 8. Isolation law

* Raw LOW/HIGH formation episodes (refs, text, bearing labels, source ids): **0 occurrences** in any
  model-facing request (precheck P7).
* Retrieved historical memory exposure: **0** — the model-facing memory-evidence section must read
  `(none)` in every cell (precheck P8).
* Affect, relationship, personality, regulation, environment, context and identity: matched between
  branches (P6, P9–P11). If any diverged, the preregistration would fail with
  `NON_BELIEF_STATE_ISOLATION_FAILED` rather than be repaired by a research-side erasure.
* `A` and `B` differ **only** in the target Belief representation (P14); `B` and `D` are
  **byte-identical** including the projection hash (P13).
* Host-side cell labels are allowed; model-facing labels (`A_LOW`, `B_HIGH`, `treatment`, `control`,
  …) are forbidden and scanned for (P7).

## 9. Exact cognition text scan surface (§18–§20 residual closed)

The freeze audit of the measurement protocol left a non-blocking MAJOR: the declared five-path
conflation surface was a *declared subset*. This preregistration closes it by **walking the real
production schema** (`CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA`) and classifying every leaf:
`A` model-authored semantic text (scanned), `B` opaque refs, `C` enums, `D` host-verifiable
structural values. The derived surface is a closed list of **12** paths and
`UNSCANNED_MODEL_AUTHORED_SEMANTIC_TEXT = []` (precheck P18, `evidence/scan-surface.json`).

## 10. Truth-conflation gate

The frozen deterministic classifier is reused unchanged; threshold 0 flags. A pass means
`NO_DETERMINISTIC_CLASSIFIER_FLAG` — **not** the semantic absence of objective-truth conflation. Both
classifier error directions remain disclosed and pinned by the frozen protocol's tests.

## 11. Trial identities and schedule

`experiment_id | phase | cell | replicate`: primary replicates 1–200, replication 201–400, a separate
`CALIBRATION` namespace. 1600 confirmatory identities, all unique, none reusing V0, pilot or
calibration namespaces (P20, P21). The execution order is a deterministic balanced rotation
(`A B C D`, rotated by replicate); the schedule hash is frozen in `evidence/trial-schedule.json` and
bound into the manifest.

## 12. Calibration (future, gated)

The calibration input is frozen now: a cognition-only scene over a frozen calibration subject in the
normal empty genesis, using the same current-scene text and the same system prompt, outside every
confirmatory count (`CALIBRATION_INPUT`, hashed into the manifest). After an approved audit the first
authorized calls are 50 byte-identical draws; calibration may only decide **RUN or STOP** and may not
modify N, `Δ_min`, `ε`, the treatment, the scenario, the evaluator or the statistics. This
preregistration performs **0** calibration calls.

## 13. Hard gates (17, all machine-readable and consumed by the verdict)

`PREREG_SHA_MATCH` · `MANIFEST_VALID` · `SEED_BELIEF_EMPTY` · `FORMATION_ATTESTATION` ·
`RAW_HISTORY_ZERO` · `MEMORY_RETRIEVAL_ZERO` · `NON_BELIEF_STATE_EQUAL` ·
`A_B_ONLY_BELIEF_DIFFERENCE` · `B_D_FULL_INPUT_IDENTITY` · `INTERVENTION_NO_PRODUCTION_WRITE` ·
`TRUTH_CONFLATION_ZERO_FLAGS` · `HOST_VALIDITY` · `CELL_INVALID_IMBALANCE` · `CALL_ACCOUNTING` ·
`SECRET_SAFETY` · `PRIMARY_FULL_CONJUNCTION` · `REPLICATION_FULL_CONJUNCTION`.

Every gate has an executable evaluator and a negative test proving it can block a success verdict. A
declared-but-report-only gate is impossible.

## 14. V0 firewall

Static: the confirmatory evaluator, harness and precheck read **no** V0 outcome file (no
`primary`, `replication` or `pilot` artefact). V0 may be cited in design documentation as
`PLANNING_ONLY`. Confirmatory count contribution: **0** (precheck P22).

## 15. Preregistration timeline (frozen protocol §11)

offline design → *(optional exploratory treatment-development pilot — **NOT RUN** here:
`TREATMENT_DEVELOPMENT_PILOT = NOT_RUN`, basis `V0_PLANNING_ONLY`)* → finalize → deterministic
prechecks → **PREREGISTRATION_COMMIT** → tree/HEAD verification → immutable manifest → executor
calibration (RUN/STOP only) → primary → replication → result/evidence → `RESULT_COMMIT`.

The freeze is **BYTE-level**: any byte change to a bound path — comments, formatting, type-only edits,
dead-code cleanup — changes the git blob and invalidates the manifest. There is no type-fix exemption.
If a bound byte must change after the first formal call, the run is invalid: new preregistration
commit → new manifest → start from zero.

## 16. Manifest and report hash

`manifest_core = {schema_version, protocol_id, experiment_id, preregistration_commit_sha,
code_blob_hashes (git blobs at that commit), design}` with `manifest_hash = sha256(canonicalJson(core))`;
the core contains no manifest hash, no wall clock, no current HEAD and no worktree state. `design`
binds: history hashes, scenario hash, intervention-law hash, scan-surface hash, evaluator hash,
statistical-law hash, model-config hash, calibration-input hash and trial-schedule hash.
Future report: `report_core = report − {report_hash}`, `report_hash = sha256(canonicalJson(report_core))`.

## 17. Deterministic prechecks (all PASS, 0 model calls)

P1 seed belief count 0 · P2/P3 exact LOW/HIGH progressions · P4 same proposition key/label/id ·
P5 branch isolation · P6 non-belief canonical equality · P7 raw-history leakage 0 ·
P8 retrieval exposure 0 · P9 relationship equality · P10 affect equality · P11 personality equality ·
P12 current-scene byte equality · P13 B/D mediator byte equality · P14 A/B only-belief difference ·
P15/P16 C/D durable states unchanged · P17 no production write during any intervention ·
P18 full truth-scan schema coverage · P19 missing-blob verifier regression · P20 trial identities
unique · P21 schedule complete · P22 V0 confirmatory contribution 0 · P23 model calls 0 ·
P24 verdict law consumes the hard-gate registry.


## 19. Preregistration history and the calibration execution path (remediation)

\
The superseded commit was scientifically clean but operationally incomplete: it
contained no calibration runner and no model transport, and the frozen protocol
defined calibration purposes without programmatic RUN/STOP criteria. Because no
scientific call was ever made under it, the lawful path is a NEW preregistration
commit (append-only history; nothing was deleted or rewritten).

### Calibration execution path (now tracked and frozen)

| artefact | role |
| --- | --- |
|  | builds the ACTUAL model-facing calibration request through the frozen production rendering path over a normal EMPTY-genesis calibration subject |
|  |  — machine-readable operational readiness law |
|  | minimal experiment-local OpenAI-compatible transport (timeout + frozen retry law + usage); the ONLY network surface, never invoked in this slice |
|  | executes the 50 logical trials: frozen body, fresh provider per draw, production validation, no illegal retry, deterministic early stop, integrity gates |
|  | frozen evidence schema; written to an untracked scratch location until a review approves a result commit |
|  | the FROZEN actual request (hashes + law + body bytes) bound into the manifest design |

### Calibration RUN/STOP law (derived, not invented)

\
### Actual frozen request (0 model calls to produce)

system hash  · user hash  · schema hash  ·
model-config hash  · **model-facing request hash ** (16 085 bytes).
The request carries no trial id, timestamp, counter or prior output; the credential never enters
the body, the hash or any evidence.

### §39 precheck remediation (no longer degenerate)

 is a real set difference between an independent schema enumeration (18 string
leaves) and the declared coverage (12 scanned + 5 opaque refs + 1 host-verified result);
 now audits the intervention/render bodies for writer tokens, enumerates writer call sites
and MEASURES durable immutability before/after;  scans every source in this experiment for
reads or imports of V0 outcome artifacts. Negative-control tests prove each can fail.

## 19. Preregistration history and the calibration execution path (remediation)

```text
SUPERSEDED_PREREGISTRATION_COMMIT
= 76bcbad6e0b175e50faacb0c2d8f0dd3092fcf09

SUPERSEDE_REASON
= CALIBRATION_EXECUTION_PATH_NOT_FROZEN
  + CALIBRATION_RUN_STOP_LAW_UNRESOLVED

SCIENTIFIC_CALLS_UNDER_SUPERSEDED_PREREG
= 0
```

The superseded commit was scientifically clean but operationally incomplete: it contained no
calibration runner and no model transport, and the frozen protocol defined calibration purposes
without programmatic RUN/STOP criteria. Because no scientific call was ever made under it, the
lawful path is a NEW preregistration commit (append-only history; nothing deleted, nothing rewritten).

### Calibration execution path (now tracked and frozen)

| artefact | role |
| --- | --- |
| `calibration-request.ts` | builds the ACTUAL model-facing calibration request through the frozen production rendering path over a normal EMPTY-genesis calibration subject |
| `calibration-law.ts` | `CALIBRATION_RUN_STOP_LAW_V1` — machine-readable operational readiness law |
| `calibration-transport.ts` | minimal experiment-local OpenAI-compatible transport (timeout + frozen retry law + usage); the ONLY network surface, never invoked in this slice |
| `calibration-runner.ts` | executes the 50 logical trials: frozen body, fresh provider per draw, production validation, no illegal retry, deterministic early stop, integrity gates |
| `calibration-evidence.ts` | frozen evidence schema; written to an untracked scratch location until a review approves a result commit |
| `evidence/calibration-request.json` | the FROZEN actual request (hashes + law + body bytes + payloads) bound into the manifest design |

### Calibration RUN/STOP law (derived from the frozen floor, not invented)

```text
scheduled logical trials      = 50
MINIMUM_HOST_VALID_COUNT      = ceil(50 x 0.95) = 48     # frozen overall host-validity floor
MAXIMUM_NON_HOST_VALID_COUNT  = 2                        # 47/50 = 0.94 fails, 48/50 = 0.96 passes
outcome diversity gate        = NONE (50/50 REALIZE and 50/50 CLARIFY are both lawful RUN)
stochasticity / conflation    = DIAGNOSTIC ONLY
early stop                    = deterministic on the 3rd non-host-valid (floor unreachable)
invalid trials                = never replaced; the scheduled denominator stays 50
```

### The actual frozen request (produced with 0 model calls)

system hash `9241794b…` · user hash `55d27d60…` · schema hash `e9da721b…` · model-config hash
`0ed9df37…` · **model-facing request hash `db8d8993…`** (16,085 bytes). It carries no trial id,
timestamp, counter or prior output; the credential never enters the body, the hash or any evidence.

### §39 precheck remediation (no longer degenerate)

`UNSCANNED` is now a REAL set difference between an independent schema enumeration (18 string
leaves) and the declared coverage (12 scanned + 5 opaque refs + 1 host-verified result); `P17`
audits the intervention/render bodies for writer tokens, enumerates writer call sites and MEASURES
durable immutability before/after; `P22` scans every source in this experiment for reads or imports
of V0 outcome artifacts. Negative-control tests prove each repaired check can fail.

## 18. What this preregistration does NOT do

It makes no model call, no calibration draw, no pilot draw, no primary or replication draw. It does
**not** run the treatment-development pilot (not authorized in this slice; if a future audit requires
one, it needs explicit human authorization). It does not modify production code, the frozen
measurement protocol, the Belief formation or plasticity code, the cognition schema, or any decision
module. `git diff` for `packages/**` and `product/**`: empty.
