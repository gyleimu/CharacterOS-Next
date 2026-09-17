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

The only formal execution entry points are the two tracked CLI commands
`calibration-preflight --approved-prereg-sha <SHA> --manifest <PATH>` (0 network calls) and
`calibration-run --approved-prereg-sha <SHA> --manifest <PATH> --evidence-out <PATH>`. They take the
authorization value as an external argument, compute every integrity fact themselves, read the
credential from `MODEL_API_KEY` in the environment only, and **stop after calibration**:
`PRIMARY_AUTHORIZED = FALSE` — a RUN verdict never enters the primary, replication or A/B/C/D path.

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
statistical-law hash, model-config hash, calibration-input hash, calibration-law hash, the five
frozen calibration-request hashes, the authoritative serialization scheme, the proposition identity
and the trial-schedule hash.
Future report: `report_core = report − {report_hash}`, `report_hash = sha256(canonicalJson(report_core))`.

`code_blob_hashes` binds **all 16 tracked execution artefacts including this document**
(`PREREG.md`), so the prose that describes the execution path is frozen under the same hash as the
code that implements it — a change to either invalidates the manifest.

## 17. Deterministic prechecks (all PASS, 0 model calls)

P1 seed belief count 0 · P2/P3 exact LOW/HIGH progressions · P4 same proposition key/label/id ·
P5 branch isolation · P6 non-belief canonical equality · P7 raw-history leakage 0 ·
P8 retrieval exposure 0 · P9 relationship equality · P10 affect equality · P11 personality equality ·
P12 current-scene byte equality · P13 B/D mediator byte equality · P14 A/B only-belief difference ·
P15/P16 C/D durable states unchanged · P17 no production write during any intervention (execution
closure ENUMERATED from disk, writer tokens scanned in executable code only, durable immutability
MEASURED) · P18 full truth-scan schema coverage · P19 missing-blob verifier regression ·
P20 trial identities unique · P21 schedule complete · P22 V0 confirmatory contribution 0 (every
non-test source scanned with statement-aware literal classification) · P23 model calls 0 ·
P24 verdict law consumes the hard-gate registry.

## 18. What this preregistration does NOT do

It makes no model call, no calibration draw, no pilot draw, no primary or replication draw. It does
**not** run the treatment-development pilot (not authorized in this slice; if a future audit requires
one, it needs explicit human authorization). It does not modify production code, the frozen
measurement protocol, the Belief formation or plasticity code, the cognition schema, or any decision
module. `git diff` for `packages/**` and `product/**`: empty.

## 19. Preregistration history and the calibration execution path (append-only)

```text
76bcbad6e0b175e50faacb0c2d8f0dd3092fcf09
= SUPERSEDED_PRECALL_NO_SCIENTIFIC_CALLS

f8e29068b591b5ab6d36ff5770a81bd902923c41
= REJECTED_AS_FROZEN_BY_INDEPENDENT_AUDIT
= ZERO_SCIENTIFIC_CALLS
= SUPERSEDED

NEW_PREREGISTRATION_COMMIT
= CURRENT CALIBRATION-EXECUTABLE PREREG CANDIDATE
= RECORDED IN evidence/freeze-manifest.json (preregistration_commit_sha) AND IN THE FINAL REPORT

SCIENTIFIC_CALLS_UNDER_EVERY_PRECEDING_PREREG
= 0
```

Neither superseded commit ever produced a scientific call, so the lawful path is a NEW
preregistration commit (append-only history: nothing was deleted and nothing was rewritten).

The second audit found the calibration EXECUTION ENFORCEMENT incomplete: the integrity gates were
caller-supplied booleans, the transport funnelled an HTTP-200-non-JSON envelope into a generic catch
and retried it, the manifest-bound request hash was not the byte stream actually sent, no per-trial
drift gate existed, and the formal execution path lived in an untracked scratch driver. Every one of
those is repaired in this commit and pinned by tests below.

```text
M1 TRANSPORT CLASSIFICATION
= HTTP 200 + non-JSON envelope  -> TRANSPORT_ENVELOPE_JSON_PARSE_ERROR, ONE raw attempt, NOT retried
= empty completion              -> TRANSPORT_EMPTY_RESPONSE, ONE raw attempt, NOT retried
= retryable                     -> 429/500/502/503/504/timeout/real network error ONLY (frozen law)
= every attempt ledger carries an EXPLICIT failure class (never null)

M2 ONE AUTHORITATIVE REQUEST BYTE STREAM
= serialized_body = canonicalJson(body); request_hash = hashText(serialized_body)
= the transport sends that EXACT string and a retry reuses it
= FROZEN HASHED BYTES == RUNTIME VERIFIED BYTES == ACTUAL HTTP BODY BYTES
= a second serialization is forbidden anywhere in the execution path

M3 EXECUTION AUTHORITY (calibration-authority.ts)
= the runner reads git HEAD and the TRACKED worktree state itself
= the approved preregistration SHA is an EXTERNAL CLI value, never hardcoded here
= THREE-WAY LAW: CURRENT_GIT_HEAD == MANIFEST.preregistration_commit_sha == APPROVED_PREREG_SHA
= any mismatch: SCIENTIFIC_CODE_STATE_MISMATCH with 0 network calls

M4 REAL DESIGN RE-DERIVATION
= 12 items recomputed from the real sources and compared item by item against manifest.design:
  scenario · intervention-law · scan-surface · evaluator · statistical-law · model-config ·
  calibration-request · trial-schedule · LOW history · HIGH history · proposition identity ·
  seed belief count
= histories are RE-FORMED through the production path, not read back from evidence

M5 PER-TRIAL HASH GATES
= before EVERY logical trial: SYSTEM / USER / SCHEMA / MODEL_CONFIG / REQUEST hashes recomputed
  from real runtime objects and compared to the manifest-frozen values
= no hardcoded true and no constant unique_count: every unique count is computed from the
  executed trial records

M6 IMMEDIATE DRIFT STOP
= all pre-call drift (code state, manifest, design, request, system, user, schema, config) stops the
  run BEFORE the drifted call: a schema change seen at trial 25 allows network calls only to trial 24
= response-model drift at trial k is recorded and trial k+1 is never sent

M7 TRACKED FORMAL CLI
= cli.ts calibration-preflight --approved-prereg-sha <SHA> --manifest <PATH>   (0 network calls)
= cli.ts calibration-run       --approved-prereg-sha <SHA> --manifest <PATH> --evidence-out <PATH>
= the credential is read from the MODEL_API_KEY environment variable ONLY: it is never a CLI
  parameter and never appears in a body, hash, manifest, evidence, stdout or error dump
= NO AUTO-PRIMARY: PRIMARY_AUTHORIZED = FALSE; a RUN verdict stops before the primary phase

CALLER BOOLEAN AUTHORITY
= REMOVED: prereg_sha_match / manifest_valid / design_rederivation / tracked_tree_clean /
  config_hash_identity / schema_hash_identity / system_hash_identity / user_hash_identity
= the runner computes every one of those facts itself

P17 WRITE SURFACE
= the calibration EXECUTION closure is ENUMERATED from disk (calibration-*.ts + cli.ts), never a
  hardcoded file list; it must contain no writer/commit token in executable code (string literals
  are data, the ${ } of a template stays in scope)
= the before/after durable belief-item hashes are MEASURED and must be identical

P22 V0 FIREWALL
= every non-test source of this experiment is scanned; each string literal is classified by its
  enclosing statement, so static import, MULTILINE import, dynamic import(, require(, readFile,
  readFileSync, fs.promises.readFile and bare path literals are all covered
= the ONLY permitted occurrence is the declared firewall list in contract.ts
= disclosed limitation: a path assembled from non-literal pieces at run time cannot be caught by a
  static scan; this audit is not a sandbox
```

### Calibration execution path (tracked and frozen)

| artefact | role |
| --- | --- |
| `calibration-request.ts` | builds the ACTUAL model-facing calibration request through the frozen production rendering path over a normal EMPTY-genesis calibration subject; owns the ONE authoritative serialization |
| `calibration-authority.ts` | the execution authority: git HEAD / tracked-tree / approved-SHA three-way law, the 12-item design re-derivation, the per-trial request binding and the P17/P22/secret audits |
| `calibration-law.ts` | `CALIBRATION_RUN_STOP_LAW_V1` — machine-readable operational readiness law |
| `calibration-transport.ts` | minimal experiment-local OpenAI-compatible transport (timeout + frozen retry law + usage + explicit failure classification); the ONLY network surface, never invoked in this slice |
| `calibration-runner.ts` | executes the 50 logical trials: frozen body, per-trial authority gate, fresh provider per draw, production validation, no illegal retry, deterministic early stop, real integrity gates |
| `calibration-evidence.ts` | frozen evidence schema; written to an untracked scratch location until a review approves a result commit |
| `calibration-cli.ts` + `cli.ts` | the formal tracked CLI: `calibration-preflight` and `calibration-run` |
| `source-audit.ts` | the P17/P22 scanners (string-aware comment stripping, statement-aware literal classification, executable-code token scan) |
| `evidence/calibration-request.json` | the FROZEN actual request (hashes + law + authoritative bytes + payloads) bound into the manifest design |

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
`0ed9df37…` · **model-facing request hash `db8d8993…`** (16,085 authoritative `canonicalJson` bytes).
It carries no trial id, timestamp, counter or prior output; the credential never enters the body,
the hash or any evidence. The dead `observation` construction removed in this remediation did not
change one byte: the hash was recomputed and is unchanged.

### §39 precheck remediation (no longer degenerate)

`UNSCANNED` is now a REAL set difference between an independent schema enumeration (18 string
leaves) and the declared coverage (12 scanned + 5 opaque refs + 1 host-verified result); `P17`
audits the intervention/render bodies for writer tokens, enumerates writer call sites and MEASURES
durable immutability before/after; `P22` scans every source in this experiment for reads or imports
of V0 outcome artifacts. Negative-control tests prove each repaired check can fail.

## 20. Post-parity authority history (append-only)

```text
917d5d107cc29033b036682875b69be9d02d34f2
= VALID HISTORICAL PREREG
= CALIBRATION AUTHORIZATION CONSUMED
= TERMINAL RESULT: EXECUTOR_CALIBRATION_RESULT_APPROVED_STOP_EARLY
= NEVER RE-RUN, NEVER COMPLETED, NEVER RE-ISSUED

452dc6852501c6958c0add78387a4aa6432942c1
= CONTRACT PARITY REMEDIATION BASELINE
= MODEL_VISIBLE_CONTRACT_PARITY_REMEDIATION_COMPLETE

NEW_PREREGISTRATION_COMMIT
= POST-PARITY CALIBRATION AUTHORITY CANDIDATE
= RECORDED IN evidence/freeze-manifest.json (preregistration_commit_sha) AND IN THE FINAL REPORT
```

### How this authority came to exist

The consumed calibration stopped early because 3 of 17 draws were rejected as
`MODEL_SCHEMA_INVALID`, and the frozen evidence schema stored only the rejection
code. An exploratory, non-confirmatory diagnostic (≤30 calls, its own namespace,
never part of any denominator) then captured the mechanism: the production
validator had always enforced `clarification_basis.missing_information` at 256
Unicode code points while the model-facing schema declared a bare
`{"type":"string"}` and the system prompt named no bound — the executor was held
to a law it could not see. Human design adjudication selected option A + B: keep
the production semantics and the bound, keep the executor, and expose the existing
contract in both visible layers. That remediation is commit `452dc685`; it changed
only what the executor can see.

### The post-parity model-visible contract (frozen by this authority)

| layer | hash |
| --- | --- |
| system prompt | `sha256:044bfe7b7641cb9cadcf9f02005560fd6b9332576bcfb3c8a0cd40ae4a91f121` |
| cognitive schema | `sha256:54ac7977f3b9e7f2e422fd6dc5f218fe34e82ffc368ebec68a58b4e634feec35` |
| user (subject) payload | `sha256:55d27d60fe3087537e66c1075dbe43677160ddbc0d8569207577b46962a219f3` (unchanged) |
| model configuration | `sha256:0ed9df37fb4b2981ae5ff69bbe37c0858ea82cec200bb87249f66478927810d5` (unchanged) |
| **model-facing request** | **`sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35`** (17,381 canonical bytes) |

The superseded request hash `sha256:db8d8993…` belongs to the consumed calibration
and is never the authority for a future run.

### Contract-parity binding (bound into the manifest design)

The authority binds a `contract_parity` record: the remediation commit, the five
hashes above, the canonical-JSON serialization, the code-point metric, and the
parity inventory hash with `PRODUCTION_ONLY` model-authored deterministic
constraints **= 0**. The production validator remains the acceptance authority:
accept/reject semantics and the 256-code-point bound are unchanged, and no text is
ever truncated, repaired or coerced.

### What a future RUN would and would not prove

A RUN would attest transport, provider, schema and host readiness for the frozen
**EMPTY-genesis** calibration request only. It could not establish that
projection-bearing A/B/C/D scenes are equally schema-stable, and it would say
nothing about whether the executor now complies with the advertised bounds:
contract visibility is a property of the instrument, not evidence about the
executor. Only a real calibration answers that, and none is authorized here.
