# NORTH_STAR_EVIDENCE_AUDIT — CharacterOS-Next

Status: AUDIT RECORD (read-only audit; no core, product, test, or frozen-evidence change)
Audit date: 2026-09-20
Repository: `D:\Documents\CharacterOS-Next`
Branch / HEAD at audit: `main` / `02b6c46e348d0187f4a28a6720f56cdb964031be`
Worktree at audit: clean (`git status --porcelain` = 0 lines)
North Star authority: **not present as a file in this repository.** No `NORTH STAR` or
`CharacterOS North Star Research Constitution` file exists anywhere in the tree
(verified by `find` for `*north*star*` and `*constitution*`). The audit therefore uses
the Q1–Q10 / E0–E6 framework supplied in the audit brief as the highest strategic
constraint, and treats it as an external authority layered on top of the repository.
The repository's own nearest equivalents are `VISION.md` (L1–L7 long-lived-subject
conditions, all marked `DESIGN DECISION` / `HYPOTHESIS`, with the explicit statement
"本仓库当前**没有**实现长期主体") and `RESEARCH_STATE.md` (claim taxonomy +
methodology limits). **`VISION.md` and the North Star brief are compatible; where this
audit says `ABSENT`, the repository's own documents agree.**

Method: working code → runnable experiment → test → committed artifact → git history →
documentation, in that order. Every claim below is traceable to a path in
`NORTH_STAR_EVIDENCE_MATRIX.md`. Nothing was fabricated; unknowns are marked
`UNKNOWN / NOT VERIFIED`.

---

## Verdict

`NORTH_STAR_EVIDENCE_AUDIT_COMPLETE`

**One-line finding:** CharacterOS-Next has built and mechanically verified an
exceptionally disciplined *state machine with a memory*, and it has genuinely proved
that a numeric line rendered from that state machine into a model request changes the
model's structured output. It has **not** proved that a lived history changes the
*subject* in a way that survives the removal of the history text from the prompt. The
only real-provider measurement of durable-history → future-behaviour difference
attributes **80 of its 100 percentage points to the retrieved memory text** and
**0 points to the structured intent**, and its own verdict label is
`FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY`.

---

## Repository State

| Item | Fact |
|---|---|
| cwd / git root | `D:\Documents\CharacterOS-Next` (identical — not a subdirectory) |
| Branch / HEAD | `main` / `02b6c46` |
| Working tree | clean, 0 modified / 0 untracked at audit start |
| Remote | `origin` = `https://github.com/gyleimu/CharacterOS-Next.git`; `origin/main` present |
| Branches | local `main`, `visual`, `voice`; remote `origin/main` |
| Other work in progress | none in this worktree. `\`voice\`` and `\`visual\`` worktrees exist but were not inspected and were not touched. |
| Candidate path from the brief | `D:\Documents\CharacterOS-Next-recovery` **does not exist** on this machine |
| Historical branch from the brief | `wave1/foundational-integration` **does not exist** (local or remote) |
| Workspaces | 15 (`pnpm-workspace.yaml`: `packages/*`, `product/sandbox`, `product/web`) |
| Packages | `affect`, `appraisal`, `behavior`, `belief`, `influence-evidence`, `long-term-state-domain`, `memory`, `memory-influence`, `personality`, `regulation`, `relationship`, `runtime`, `subject-core` |
| Research tree | 3325 files under `research/`; 39 experiment directories; 4 diagnostics directories |
| Test surface | 262 tracked `*.test.ts`; the enforced vitest `include` list covers packages, product, evals/conformance, measurement-protocols, and 5 named research suites |
| Gate command | `pnpm verify` = `governance → typecheck → build → typecheck:auxiliary → lint → test` |

### Gate result measured in this audit

Command: `pnpm verify` (full, not a subset). Log: `tmp/north-star-verify.log` (gitignored).

| Stage | Result |
|---|---|
| `pnpm governance` | PASS (15 workspaces, 23 conformance test files) |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| `pnpm typecheck:auxiliary` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | **FAIL — 252 files passed, 2 failed, 3 skipped (257); 3101 tests passed, 4 failed, 6 skipped (3111)** |

Failing files and cause:

- `product/sandbox/src/query-aware-retrieval.test.ts` (2 tests)
- `product/sandbox/src/recall-evidence-selector-wiring.test.ts` (2 tests)

All four fail with `ProductRuntimeStartupErrorV0: fetch failed` raised from
`createProductRuntimeV0` (`product/sandbox/src/product-runtime.ts:635`, via
`startupError` at `:571`). `product-runtime.ts` imports `probeOllamaV0` from
`./product-providers.js`; startup preflights the executor endpoint. On this machine
`curl http://127.0.0.1:11434/api/tags` returns **connection refused** — no local Ollama
is running. The tests replace the cognition / language / appraisal / recall-selector
*transports* with stubs, but do **not** stub the startup provider probe, and unlike the
three other real-provider suites they carry **no `skipIf` environment gate**
(`real-language-smoke.test.ts`, `long-run-checkpoint.test.ts`,
`relationship-adaptation-real-model-smoke.test.ts` are all `skipIf`-gated and correctly
skipped).

Reconciliation of the recorded green baseline, for the record: the last documented green
gate run is cited in commit `fef2e77` as "254 files / 3101 tests". This audit measured
254 non-skipped files and 3101 *passing* tests; `fef2e77` itself added exactly 4 tests
(the file environment-checkpoint store under R2), which accounts for the 3101 → 3105
total-test delta. So the earlier green run is consistent with a machine where **Ollama
was running**.

**Conclusion: this is a test-infrastructure defect, not a core defect.**
`pnpm test` is not green on a clean checkout without a live local Ollama, and
`.github/workflows/ci.yml` runs the same `pnpm test` on `ubuntu-latest` with no Ollama
service and no secrets, so CI is very likely red at HEAD. *CI status is inferred from
the workflow file and the local failure; CI was not executed — `UNKNOWN / NOT VERIFIED`.*
This audit did not modify any test to make it pass (the audit brief forbids it, and
doing so would destroy the finding).

---

## Existing Core Mechanisms

Condensed from a full read of `packages/*/src/**`. The single most important structural
distinction in this audit is **storage+retrieval vs internalization (persistent state
change)**; the two are kept separate throughout.

**Present and implemented**

- **Canonical subject state** — `SubjectStateV0` ("subject-state-v3", 14 top-level
  fields) and `SubjectStateV4` ("exactly 13 top-level fields (mood REMOVED vs v3)").
  Single write entry, validation, hash/trace, atomic commit, fail-closed restore.
- **Experience representation** — `ExperienceRecordV0`
  (`packages/memory/src/records/experience-record.ts`), closed kind set
  (`EXPERIENCE_KIND_BEHAVIOR_OUTCOME`), with the header law "FACTS ONLY … NO approval,
  NO rejection label, NO sentiment, NO reward, NO trust, NO success/confidence
  semantics of any kind".
- **Episodic memory + retrieval** — content-addressed revisions
  (`packages/memory/src/repository/*`), deterministic comparator, IDF-style lexical
  relevance (`weight = log2(1 + candidateCount / df)`), explicit fallback law.
- **Affect dynamics** — two laws coexist. v3 `FAST_EMA` (channels + EMA mood,
  `alpha 0.06`, `tau 150`, `clamp 0.25`, `tHold 60`); v4
  `BOUNDED_AFFECT_DYNAMICS_V0` is the production one:
  `q = relevance * intensity`, `u_v = 0.25*q*(2*goal_congruence-1)`,
  `u_a = 0.10*q`, event `x_after = clamp(x_before + u)`, time
  `x(t+dt) = b + (x(t)-b)*exp(-dt/150)`, `b = (0, 0.2)`.
- **Belief** — creation via host-derived content-addressed proposition key
  (`BELIEF_PROPOSITION_STANCE_ZERO_CREDENCE = 0.5`, `FIRST_CREDENCE = 0.55`), symmetric
  update `next = clamp(current ± 0.05, 0, 1)`, saturation returns explicit
  `NO_CHANGE / SATURATED`. Header law: "NO evidence-count scaling, NO inertia, NO
  cross-domain modulation".
- **Relationship** — exactly one governed feature, interaction familiarity:
  "First lawful credited interaction: ABSENT → 1/32; Subsequent … k/32 → (k+1)/32 …
  Saturation: |R| >= 32 → NO_PROPOSAL", "No downward transition. No equal-value
  update." The feature semantics explicitly disclaim that this "is NOT trust, liking,
  affinity, safety, intimacy, dependence, loyalty, relationship quality".
- **Personality** — frozen static registry (agreeableness, conscientiousness,
  extraversion, openness; `plasticity_admissible: true`) plus a slow plasticity kernel
  `step = min(max_step, round4(evidence_scale × mean_activation))`,
  `next = clamp(current ± step, 0, 1)`, eligibility
  `{ minMemberCount: 3, minTotalActivation: 1.5, minLogicalSpan: 0 }`, `max_step: 0.05`,
  write-once evidence ledger.
- **Experience → persistent state internalization** — four evidence-bound paths exist
  and are wired into the production session
  (`packages/runtime/src/session/interactive-subject-runtime-v0.ts:683–704`):
  belief adaptation, personality adaptation, relationship familiarity ingestion, and
  (separately, event-driven rather than episode-driven) affect application.
- **Persistence / restart** — `PersistedSubjectEnvelopeV1` ("the only accepted restore
  input"), 9 fail-closed restore stages ("EXACT RECONSTRUCTION ONLY … no defaults, no
  reset, no repair, no migration"), v4 chain replay, `SessionStoreImageV0`, and the R1/R2
  product file codecs.
- **Executor abstraction** — one-method port `ModelTransportV0`
  (`packages/runtime/src/transports/model-transport.ts:108`), two real implementations
  (`OllamaNativeCognitionTransportV0`, `OpenAiCompatibleTransportV0`), one construction
  site per family, "no stage above this line knows which is in use".
- **Cognition projection** — versioned `CognitiveContextProjectionV0/V1/V2` +
  `cognitive-prompt-projection-v1.ts`. State reaches the model as **structured read-only
  data lines**: `[affect (canonical)] valence=…`, `[SUBJECTIVE BELIEF STANCES …]`,
  `[relationships]`, `[interaction familiarity …]`, personality dimensions. Belief items
  are `STATE_VISIBLE_NOT_CITEABLE`.

**Present but inert / partial**

- **Personality plasticity is disabled in the product.** `product-provider-bundle.ts`
  hardcodes `personality_adaptation_enabled: false` in the turn plan (lines 192–195;
  belief and relationship are `!adaptationDisabled`, i.e. ON by default, while
  personality is a literal `false`). Additionally `personality_genesis_prior` is an
  *optional* host field that no product entry point supplies (only tests do), and the
  wiring header states "an empty Personality fails closed: no dimensions are ever
  created". Combined: in the running product the SLOW timescale cannot exist.
  The canonical long-run confirms it empirically — across 216 episodes the record is
  repeatedly "personality 仍未 acquire（合法）".
- **Consolidation is absent.** `MemoryStateV0.consolidation_cursor` exists and
  `/memory_state/consolidation_cursor` is an allowed transition path, but no producer
  anywhere writes it; `learning-transition-executor.test.ts` asserts it *stays unchanged*.
  No semantic-memory store, no offline/replay/sleep pass.
- **Belief → decision is implemented but unwired.**
  `belief-decision-integration-policy.ts` (`stance(c) = 2c - 1`) and
  `belief-decision-arbitration-policy.ts` (`UNIQUE_POSITIVE_MAX`) exist; their own headers
  say "No action execution, no execution runner integration, no production switchover".
- **CognitionAction is a canonical no-op** — "a zero-delta durable NO_OP"; `ActionIntent`
  is "a REQUEST for a future execution layer". The only action executor is a deterministic
  sandbox.

**Absent entirely**

Habits · Goals (only the appraisal axis `goal_congruence`) · Preferences (per-turn model
text only; "Never convert a subjective preference into a factual claim") · Trust /
attachment / expectations · Forgetting / decay / belief retraction (mutations are INSERT
and UPDATE only) · Affect traces as memory content (`affect_snapshot_ref` is a fixed
`null`: "no committed V0 source exists — fixed null, never invented") · embeddings /
vector search · ablation/intervention product API · schema migration between v3 and v4
("V3 STAYS FROZEN").

**Cross-domain coupling is explicitly forbidden, not merely missing** — belief: "NO
cross-domain modulation"; personality and relationship carry isolation tests; there is
no scheduler above the logical clock.

---

## Q1–Q10 Evidence Matrix

Full source/test/experiment/artifact/command/metric/limitation detail is in
`NORTH_STAR_EVIDENCE_MATRIX.md`. Summary:

| Question | Evidence Level | Confidence | One-line basis |
|---|---|---|---|
| Q1 Experience Internalization | **E2** | High | Four evidence-bound experience→state paths implemented, wired, unit+e2e tested, and observed changing real production state across restarts — but no experiment shows the internalized state (as opposed to retrieved text) causing anything. |
| Q2 Personality Plasticity | **E2 (core kernel) / E0 (product reality)** | High | Kernel is unit-verified with an e2e proof; in the product it is hardcoded OFF with an empty container, so it has never fired in 216 real episodes. Real-provider differentiation experiments are null and N=3. |
| Q3 Emotion Dynamics | **E4 (→cognition content) / E0 (→behaviour)** | High on the positive leg / High on the negative leg | `canonical-affect-behavior-influence-v0/v1` is a genuine intervention+ablation with 320/320 valid units. `action_intent` disagreements are 0/40 and 0/80. |
| Q4 Memory Consolidation | **E0** | High | No mechanism. A `consolidation_cursor` field exists and is never written; a test asserts it is never written. |
| Q5 Belief Formation | **E2 (mechanism) / E5 for existence-and-persistence / E0 causal** | Medium-high | Real production belief moved 0.55→1.0 by lawful ±0.05 steps over 216 episodes with a stable proposition identity. The causal experiment is `BELIEF_CAUSAL_RESULT_INCONCLUSIVE`; its confirmatory successor is PREREGISTERED-**PAUSED**, 0 calls run. |
| Q6 Relationship Dynamics | **E2 (familiarity accrual) / E0 (structure) / E0 (behavioural causality)** | High | One monotone scalar. Trust/attachment/expectations do not exist by design. The causal family's own decomposition shows behaviour tracks **context availability**, not the familiarity scalar. |
| Q7 Behavioral Causality | **E4 for state→cognition content / E0 for state→decision→behaviour** | High | Strongest: affect arm ablations, 320/320, one model. Weakest: no action/decision endpoint ever moved; the decisive ablation says the marginal value beyond memory is `NOT_PROVEN`. |
| Q8 Multi-timescale Dynamics | **E2 (heterogeneous update laws) / E0 (as an integrated system)** | High | Different rates genuinely exist per domain, but coupling is forbidden by law and the SLOW layer does not run. Empirically the system is *saturated*, not multi-scale. |
| Q9 Path Dependence | **E0** (life-trajectory order) / **E2** (affect-law property) | High | No A→B→C vs C→B→A experiment exists. `affect-state-retention-e1` proves path dependence of the *equations* (1e-12 tolerance, synthetic, 0 model calls) — not of a life. |
| Q10 Persistent Identity | **E2 mechanically / real long-run exactness observed / E0 across executor swap** | High | Every restart check is EXACT field-by-field, including dozens in real long-run operation. Behaviour, however, is demonstrably executor-dependent (context mediation 0/10 local vs 10/10 API). |

**No question reaches E6. `evals/baselines/` is `RESERVED / NOT IMPLEMENTED`
(`llm-prompt/`, `fast-ema/`, `characteros-v1/` are empty directory names).** No B0
Stateless, B1 Persona/Profile, B2 Summary-Memory, B3 CharacterOS comparison exists
anywhere in the repository, for any question. `evals/ablation/`,
`evals/longitudinal/`, `evals/regression/` are likewise `RESERVED / NOT IMPLEMENTED`.

---

## Strongest Existing Evidence

1. **`canonical-affect-behavior-influence-v1`** — a real intervention/ablation:
   ±0.125 and ±0.25 canonical valence, activation matched, four matched arms, 8 scenarios
   × 5 trials, 320/320 valid, randomized arm order, byte-level input-diff audits, restore
   controls, preregistered. Verdict `CANONICAL_AFFECT_CAUSAL_INFLUENCE_REPLICATED`.
   **What it proves:** for `qwen3.5:9b`, changing only the canonical affect values in an
   otherwise identical request changes structured cognition content. **What it does not:**
   anything about action selection (0/80), other models (*"SECOND_MODEL_UNAVAILABLE"*), or
   generality beyond the two tested magnitudes.
2. **Restart/persistence engineering** — `PersistedSubjectEnvelopeV1` exact-reconstruction
   restore, fail-closed corruption rejection, `restore-rollback.test.ts` ("accepts a
   faithful store and rejects a rolled-back store"), plus **real** long-run operation with
   dozens of scheduled fresh-process restarts all reported field-by-field `EXACT`, and an
   independent post-batch read-only restore binding `RESTORED rev 1909 / R632 / 211
   episodes`. The R2 codec reaches `308,081,968 B → 17,971,887 B` with the decoded store
   JSON hash identical (`e9e8434c…`).
3. **`executor-model-substitution-matched-v1`** — the only controlled cross-executor
   comparison: both executors rebuilt under a portable contract, ≥0.95 host validity both
   sides, 207 API requests, two independent phases agreeing. Verdict
   `EXECUTOR_CAPABILITY_DEPENDENCE_OBSERVED` (local `NOT_REPLICATED`, API `REPLICATED`).
4. **The deterministic affect families** (`affect-state-retention-e1`,
   `affect-activation-mapping-e2a`, `affect-production-shaped-e2`) — 0 model calls, but
   232 lifetimes / 170,496 events / 1030 of 1030 accounting checks, restore and replay
   proofs at 1e-12, evidence protected by a durable conformance law. Strong *for the
   equations*.
5. **`belief-causal-validation-v0`** — a well-built instrument even though its verdict is
   negative: 104 scenes, 150 real DeepSeek requests, 100/104 host-valid, per-replicate
   byte-identical B-vs-D live-input proofs, fresh-process authoritative restore, full
   invalid-scene ledger, and a refusing verdict that quantifies its own noise floor
   (30–40 % same-request flip at temperature 0).
6. **`non-memory-state-value-ablation-v0`** — the most methodologically serious negative in
   the corpus: machine-verified ablation reconstruction, byte-identical memory proof,
   fresh-process restore with byte-identical replay, and a same-request repeat that
   *killed its own apparent effect*. Its product answer is `INCONCLUSIVE` and its
   recommendation is `Should CharacterOS Core Continue Expanding? NO`.
7. **The live production recall path** — `CURRENT_TURN_QUERY_AWARE_RETRIEVAL_V0` +
   `RECALL_EVIDENCE_SELECTOR_PRODUCT_AUTHORITY_V0` achieved the program's first genuine
   end-to-end memory→delivery chain: retrieval query fixed, 3/3 clean cases answered
   verbatim from stored evidence, and later 2 natural long-run recalls
   (age ≈66 and ≈172 episodes) delivered the stored text itself.

---

## Weakest / Missing Evidence

1. **No baseline comparison of any kind (E6 = ABSENT for all ten questions).**
2. **No proof that internalized non-memory state changes a decision or an action.**
   `action_intent` differences: 0/40, 0/80, and the affect→action-selection family is a
   clean null (`ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED`, ablation 0,
   order-invariant scenarios 0).
3. **Personality never runs** (hardcoded OFF + empty container) and its only real-provider
   differentiation attempts are `LEVEL_6_NOT_DEMONSTRATED` at 3 scenarios / 6 calls.
4. **Consolidation, habits, goals, preferences, trust, forgetting** — absent.
5. **Path dependence across life trajectories** — absent; the only order experiments are
   about presentation order of two actions.
6. **No multi-seed / multi-scenario replication for the longitudinal claims.** The
   history-divergence line rests on 1 scenario × 5 trials; the long-horizon line on 8
   interactions of 1 subject; the longitudinal line on 4 episodes of 1 subject.
7. **No independent evaluator.** Same-provider models judge; the one blinded evaluator was
   shown to be tracking presentation position and was therefore unusable
   (`relationship-familiarity-behavior-real-provider-v0`).
8. **The canonical long-run corpus is not independently verifiable from the repository.**
   Only two files are committed (`canonical-211-216-stop.json` 5.8 KB and
   `lr-002-003-monitoring-adjudication.json` 2.9 KB). The 216-episode Alice store, the
   turn records, the retrieval-replay 0/7→6/7 measurement and the 6 natural recall
   callbacks live in `tmp/` and `product/sandbox/.data/` — both gitignored. The richest
   longitudinal observation in the program cannot be audited from a clean checkout.
9. **The last non-memory ablation is stale in the way that matters.** It ran at
   `7999f6a` with Belief / Relationship / Personality `ABSENT` ("0 items; no lawful
   producer configured"). Those three are configured now. The repository's strongest
   negative result therefore does not describe the current system.

---

## False Positives / Overclaims Found

Checked against the nine named patterns. Nothing here is an accusation of dishonesty —
the corpus self-discloses most of it, and that self-disclosure is its best property.
These are the places where a reader could still be misled.

**A. Prompt leakage — NOT FOUND as illegitimate leakage; but the channel claim needs care.**
There is no persona/character prompt. The V8 system prompt is a pure contract document
(field bounds, rule 19 on memory usage, etc.). State values are hash-bound to canonical
state and rendered as `STATE_VISIBLE_NOT_CITEABLE`. Frozen experiments pin byte-exact
preregistered requests and the repo actively reverted a prompt reinforcement that changed
those bytes (17381 → 17897) rather than absorb the drift. **However:** every demonstrated
state→behaviour path in this repository is 100 % prompt-textual — no weights, no hidden
state. So "the subject's internal state influences its answer" is, mechanically,
"a numeric line in the input influences the output". That is real, but it is the *same
channel* a persona profile or a rolling summary would use. Without a baseline, the
numbers' provenance is not yet shown to matter more than the fact that *some*
self-referential text was present.

**B. History leakage — NOT FOUND.**
`lived-history-differentiation.test.ts` explicitly asserts no `[CONVERSATION HISTORY]`, no
`[TRANSCRIPT]`, no `HISTORY_A|HISTORY_B` in the request, and includes a same-history
control that must produce byte-identical requests (it does). Where a run genuinely could
not measure its endpoint, the repository says so: `affect-driven-behavior-experience-memory-causal-chain-v0`
recorded `real_calls: {cognition: 2, language: 1, future: 0}` — the "future" leg is a
host input diff, never an observed future response.

**C. Retrieval leakage — FOUND, and it is the dominant demonstrated mechanism.**
This is the single most important finding of the audit.
`durable-life-history-future-behavior-divergence-v0-remeasure` (real provider, 5/5
complete four-arm units) reports `treatment_pair_disagreement: 100pp` versus
`ablation_pair_disagreement: 20pp`, i.e. **80 pp of the behaviour difference disappears
the moment the memory-evidence text is removed from the provider request.** Worse for the
"internalization" reading: in the ablated arms the only remaining difference between the
two lives is `canonical_affect` (the harness proves this:
`ablation_pair_body_equal_except_affect: true`), and that residual affect delta is
`0.000022699964881242424` — negligible. So the observed 20 pp ablation background is more
plausibly model variance than affect. Independent corroboration: in
`relationship-familiarity-history-causal-v0`'s decisive secondary analysis, behaviour
tracks **context availability** rather than the familiarity scalar (`A↔F 4/4` with the
full corpus added to the low-familiarity arm, versus `B↔F 0/3`). And
`non-memory-state-value-ablation-v0` measured the marginal value of non-memory state
beyond Memory as `NOT_PROVEN`.
In other words: the repository has demonstrated the chain
`history → stored episode → retrieval → retrieved text in prompt → different output text`.
That is precisely the chain the North Star brief identifies as **not** internalization.

**D. Executor dependence — FOUND.**
Subject *state* is executor-independent (no model/provider/endpoint field exists in
`SubjectStateV4`; provider identity is not part of any identity hash). Observed *behaviour*
is not: `executor-model-substitution-matched-v1` shows the same Protocol, same prompts,
same familiarity manipulation producing context mediation `0/10` on `qwen3.5:9b` (Ollama)
and `10/10` on `deepseek-flash` (API), twice. Relatedly, with thinking disabled the
realized language "常近乎逐字复述用户话语" (near-verbatim mirroring, 3/19, 5/16, 11/50
across legs). Complementing this, `EXECUTOR_INDEPENDENT_COGNITION_USAGE_FAILURE` shows the
*recall-usage* miss is executor-independent (three configs, all 0/3) — so at least one
failure is not a model artifact. Both directions of leakage are documented; the point is
that "the subject's demeanour" does not currently survive an executor swap.

**E. Evaluation leakage — mostly controlled; two instruments were invalid and are
self-disclosed.**
Byte-identical live-input proofs (B vs D) and blinded-field inventories are genuine
controls. Against that: `relationship-familiarity-behavior-real-provider-v0`'s blinded
evaluator "tracked presentation position, not arm" (Response X was always judged as having
used context) — the instrument is unusable; and
`relationship-familiarity-search-first-causal-v0`'s frozen class rule accepted any
≥20-code-point `SOURCE_QUOTE`, so the LOW arm's observation quotes classified identically
to the HIGH arm's convention quotes — "could not discriminate the conditions by
construction" (post-hoc `SECONDARY_ANALYSIS.md`). There is still **no independent human or
heterogeneous evaluator** anywhere; `RESEARCH_STATE.md` says so itself.

**F. Seed / scenario dependence — FOUND and widespread.**
The principal claims rest on very thin N. Q9's nearest analogue: 1 scenario × 5 trials.
Long-horizon: 8 interactions, 1 subject, no control arm. Longitudinal: 1 subject, 4
episodes, "run of record = attempt 3", and episode 4 produced no new experience. Personality:
3 scenarios, 6 calls, twice. The long-run recall evidence: "8 个计划探针中实际问到 2 个",
against the repository's own statement "样本过小，**不主张**纵向召回结论". Only one
experiment in the entire corpus reaches 8 scenarios × 5 trials × 4 arms.

**G. State coupling confound — well controlled in the ablation designs, structurally
unavoidable in the history designs.**
The non-memory ablation machine-verifies that only designated sections were removed and
that the memory section is byte-identical; the affect experiments match activation and
prove byte-difference only in the intended fields. But the A-vs-B *history* designs
necessarily change memory **and** affect **and** (now) belief **and** familiarity at once,
so a "history" effect cannot be attributed to a named state without the ablation arm — and
that arm, where it exists, points at memory (finding C).

**H. Serialization ≠ identity — the repository is unusually rigorous here, with two caveats.**
R2 is verified by value-level round-trip, backward compatibility, and fail-closed
corruption handling, and it is applied to **product file boundaries only** — "no
sidecar/blob/database, no semantic replay or reconstruction guessing". Caveats:
(i) "lossless" is **value-level, not byte-level** — the committed tests assert
`toEqual`/hash equality, not byte equality of the JSON text (canonical JCS key sorting is
what makes this safe, but nothing pins the text round-trip); (ii) the real-scale
308 MB → 18 MB evidence exists in `CURRENT_STATE.md` prose and was produced on disposable
copies — the committed tests use tiny synthetic fixtures. The gate does not reproduce the
scalability claim.

**I. Tests ≠ science — the repository says this explicitly, which is a strength, but the
ratio deserves stating.**
`evals/conformance/README.md`: "Passing them does not itself establish scientific efficacy,
production readiness, statistical significance, or complete coverage." Of 3101 passing
tests, the overwhelming majority are deterministic mechanism math and wiring; the
real-provider scientific evidence is not in the gate at all — all four real-executor
suites are `skipIf`-gated and skipped in CI. Nine of the 23 conformance suites merely
re-read committed evidence JSON. **The strongest scientific asset in this repository
(prompt recall 3/3, recall 2/2, belief 0.55→1.0, dozens of EXACT restarts) is human-run
and machine-local, and is not protected by the gate.**

**Additional findings (drift, not leakage)**

- `packages/README.md` is stale and misleading: it still calls `belief`, `personality`,
  `relationship`, `behavior` "deferred empty packages" although all four contain
  substantial implementations.
- `evals/conformance/README.md` says "19 files … 182 direct `it(...)`" while the tree now
  holds 23 files / 214 anchored declarations.
- `CURRENT_STATE.md` §3 labels `Lived-history → behavior differentiation` as
  `CONFIRMED / CAUSALLY_VALIDATED` while the same row ends "**production behavior change =
  0**", and the underlying artifact (`lived-history-differentiation.test.ts`) declares in
  its own header "Providers are deterministic fakes (no Ollama); this proves the
  ARCHITECTURE transmits history into cognition, not real semantic intelligence." The
  artifact is honest; the table label over-reads it by one grade.

---

## Historical Research Assets Worth Keeping

**Keep as load-bearing:**

- `canonical-affect-behavior-influence-v0` / `-v1` — the cleanest causal design in the
  repo. Keep as the **template** for any future intervention experiment (matched arms,
  byte-diff proofs, restore controls, preregistered verdict vocabulary).
- `non-memory-state-value-ablation-v0` — keep twice over: as the methodological model for
  honest underpowered nulls, **and** as an open question that is now stale (see Gaps).
- `belief-causal-validation-v0` **plus** the `belief-causal-confirmatory-stochastic-v1`
  preregistration — the instrument and the prereg are assets. The prereg is unrun; it is
  the only design in the repo explicitly built to sit **above** the measured 30–40 %
  same-request noise floor.
- `executor-model-substitution-matched-v1` — the only cross-executor control, and the
  source of the executor-dependence finding.
- `durable-life-history-future-behavior-divergence-v0-remeasure` — the only real-provider
  history→future-behaviour *measurement*, with the admirably honest `INPUT_EFFECT_ONLY`
  label and a clean 4-arm ablation decomposition.
- `long-horizon-autonomous-subject-session-v0` + `-revalidation` — the only
  multi-boundary, restart-spanning product-loop evidence, with a precisely diagnosed
  failure (truncated JSON at `num_ctx = 4096`) and a single-variable repair.
- The deterministic affect families — keep as **regression/conformance assets for the
  equations**. Stop citing them as emotion evidence.
- The persistence R1/R2 work — verified representation engineering with hash-level
  equality proof, and the R2 canonical conversion was validated in the wild ("首个合法
  save 即自然完成 R1→R2 转换…**无任何手工迁移**").
- The recall chain (`9dc9989`, `e7a90ff`) and the retrieval remediation — the program's
  first genuine memory→delivery pipeline, with a documented causal-focus refusal that
  correctly refused to over-authorize.

**Assets that no longer support the North Star:**

- `affect-driven-behavior-experience-memory-causal-chain-v0` — its name and verdict promise
  a behavioral causal chain; the frozen budget allowed **0 future calls**, the future leg
  is a host input diff, and N = 1 scenario × 1 trial. Retire the name for North Star
  purposes.
- `durable-life-history-future-behavior-divergence-v0` (original) — labelled
  `NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0`, but the report itself prints
  `Verdict is informative: false` (0/5 complete units, 13/20 cognition calls schema-rejected).
  **Citing it as evidence of absence contradicts the report.** The remeasure then found
  100 pp divergence on the same design — the original "null" was an interface failure.
- `belief-change-lived-evidence-v0` — aborted; `history-b.json` is `TURN_FAILED_CLOSED`,
  `summary.json` has `"commonB": null`; no contract, no report, no verdict.
- `executor-model-substitution-v0` — `MODEL_SUBSTITUTION_NOT_ISOLATED`, **0 scientific
  executions**; its own SUMMARY warns its runs are not comparable with post-portability runs.
- `familiarity-causal-behavior-v0` (`INVALID_EXPERIMENT`) and `-v1`
  (`SAFETY_GROUNDING_FAIL`, `complete: false`, 3 `UNSUPPORTED_SHARED_CONTEXT` claims in the
  low-history arm) — these cannot carry any familiarity claim.
- `personality-behavioral-differentiation-real-provider-v0/v1` — too underpowered to carry
  a positive *or* a negative reading; both are `LEVEL_6_NOT_DEMONSTRATED` at 3 scenarios.
- Three directories with no evidence at all (`executor-schema-failure-diagnostic-v0`,
  `post-parity-schema-failure-diagnostic-v0`, `structured-output-capability-probe-v0`) and
  one with a 5-file deterministic diff (`durable-memory-cognition-provider-surface-repair-v0`).
- **Staleness, repo-wide:** every memory-visibility experiment predates the Sept 19–20
  retrieval/recall and context-budget work. Their frozen evidence remains valid *for its
  commit*, but conclusions about *current* product behaviour must be remeasured.

---

## Baseline Coverage

`ABSENT — 0 of the required baselines exist.`

| Baseline | Status | Evidence |
|---|---|---|
| B0 Stateless LLM | NOT IMPLEMENTED | `evals/baselines/` contains only a README stating `Status: RESERVED / NOT IMPLEMENTED` |
| B1 Persona / Profile prompt | NOT IMPLEMENTED | reserved as `llm-prompt/` (empty) |
| B2 Summary memory | NOT IMPLEMENTED | no summary mechanism exists anywhere in `packages/` or `product/` |
| B3 CharacterOS | implemented, but **never compared** | — |
| B4 RAG / long-context | NOT IMPLEMENTED | reserved names only |

The nearest thing to a comparator in the entire corpus is the *internal* MEMORY_ONLY arm
of `non-memory-state-value-ablation-v0` — an ablation of CharacterOS's own request, not an
external baseline. Its answer to "is current CharacterOS meaningfully more than an LLM +
persistent factual Memory/RAG system?" is `INCONCLUSIVE`. `VISION.md` criterion **C6**
("比『Memory + LLM 每轮重算』…可测量地更优") is marked `HYPOTHESIS` and "从未比较过，
`UNKNOWN`" — the repository already knows this and has not closed it.

---

## Longitudinal Coverage

**Genuine, and better than most research systems — but almost entirely uncontrolled.**

- Real production long-run on one canonical subject: **216 durable episodes**, hundreds of
  completed real-provider turns, ~20+ scheduled fresh-process restarts all field-by-field
  `EXACT`, zero durable pollution from fail-closed turns ("fail-closed 轮不写入任何
  canonical state", verified by file mtime/size identity on three failing turns).
- Real provider cost recorded: e.g. `input 561,146 + output 30,251 = 591,397 tokens`
  across one 50-turn leg; `207 cloud + 43 local` requests in the 158→201 leg.
- Controlled longitudinal evidence is much thinner: `longitudinal-multi-episode-subject-life-v0`
  = 4 episodes, 1 subject, no control arm, E4 produced no new experience;
  `long-horizon-autonomous-subject-session-v0` = 8 interactions, 1 subject, no control.
- The single-subject design means there is no population, no seed variation, and no
  possibility of a statistical claim. The repository states this: "当前仓库不主张统计显著性、
  跨模型复现、跨人群外部效度".

**Coverage verdict:** longitudinal *operation* is strong (E5-shaped evidence for
"the system survives and remains coherent over hundreds of real turns"). Longitudinal
*experiment* is effectively absent (no baseline, no control, no seed, no multi-scenario).

---

## Restart / Persistence Coverage

**This is the most solid engineering pillar in the repository.**

- `packages/subject-core/src/restore/restore.ts` — 9 fail-closed stages; revision > 0
  requires commit-chain proof; "no defaults, no reset, no repair, no migration".
- `restore-v4.ts` + `runtime/src/authority/restore-chain-authority-v4.ts` — v4 chain replay
  through an "opaque explicit-v4 genesis boundary plus the complete V2 history".
- Real process restart is exercised in many suites: `long-run-checkpoint.test.ts`'s
  `restart()` (fresh `createProductRuntimeV0`, requires `origin === "RESTORED"`, classifies
  `EXACT` / `MISMATCH` / `RESTORED_UNVERIFIED`), `interactive-subject.test.ts` "§43-equivalent
  file restart", `environment-continuity.test.ts` LEVEL 3, `cross-context-continuity.test.ts`
  LEVEL 3+4 (including an R2-decoded checksum-mismatch fail-closed at line 369 added by
  `b367b49`), `restore-rollback.test.ts`, `belief-lived-experience-loop.test.ts`.
- Rollback resistance: "accepts a faithful store and rejects a rolled-back store".
- Deferred work survives: "The prior turn's deferred behavior outcome is committed
  post-restart".
- Corruption is rejected: corrupt R2 delta, truncated JSON, unknown encoding, canonical
  record checksum mismatch, corrupt checkpoint, wrong subject identity — all fail closed.

**Gaps in coverage:** no crash-during-write / kill -9 test; no automated test at real store
scale (hundreds of bundles); R2's byte-level round-trip is not asserted; the long-run
harness's own resume logic is operator-driven and its only hard assertions are
"attempted > 0" and "artifact exists".

**Executor-swap identity: `E0`.** State survives an executor swap by construction; behaviour
does not (finding D). "LLM 更换以后主体状态语义是否仍然存在" — the *state* semantics
trivially survive (the LLM never held them). Whether the *subject* is recognisably the same
subject across a swap is **untested and currently contradicted** by the
executor-capability-dependence result.

---

## Primary North Star Gap

See `NORTH_STAR_GAP_ANALYSIS.md` for the full ranked analysis and the rejected alternatives.

**ONE PRIMARY GAP:**

> There is no evidence that anything a subject **internalized** from its life changes what
> it **does or decides** — as opposed to what text sits in front of the model — and there is
> no baseline against which such a change could be attributed to CharacterOS at all.

Stated as the North Star asks it:

> `History changed the subject rather than merely remaining retrievable.`

The repository's honest position today is: history is *stored* excellently, *retrieved*
well, and *rendered* faithfully; the persistent state genuinely *changes*; but the only
measured behaviour difference attributable to a durable history survives ablation at
**20 of 100 percentage points**, on 5 units, in one scenario, with a negligible (2e-5)
residual state difference — and the decisive endpoint (`action_intent`) moved **0 times in
0 of 80 trials**. The repository's own verdict on the non-memory state's marginal value is
`NOT_PROVEN`, and its own recommendation was `Should CharacterOS Core Continue Expanding? NO`.

**Why this and not something else.** Three candidate gaps were considered and rejected as
*primary*: (i) *consolidation is absent* — real, but consolidation is a means; proving it is
worth building requires first knowing that internalized state has behavioural consequence;
(ii) *baselines are absent* — real and serious, but a baseline is an inference aid, and it is
folded into the primary gap because without it even a positive internalization result is
unattributable; (iii) *the SLOW personality layer never runs* — real, but fixing it is
implementation, and the brief forbids building mechanisms before the evidence warrants them.
The chosen gap is the one that decides whether the entire north-star direction has value.

**The concrete missing experiment** is `HISTORY_INTERNALIZATION_TEST_V1`
(`HISTORY_INTERNALIZATION_TEST_V1_DESIGN.md`), whose decisive arm is not the "different
trajectories" part — the repository already has different trajectories — but the
**state-isolation arm**: a subject whose state was shaped by a life, measured while the
history text is removed from its input, compared against a genesis twin.

---

## Baseline / Longitudinal / Restart one-line summary

- Baseline: **absent** (0/5).
- Longitudinal: **operationally strong, experimentally absent** (1 subject everywhere).
- Restart: **strong and mechanically verified** (E2 + real exactness), with byte-level and
  scale-level caveats; executor-swap identity **untested**.

---

## Final answers

### 1. Do we have evidence that `History changed the subject rather than merely remaining retrievable`?

**PARTIAL — with these exact limitations:**

1. The *storing* half is proved: experience is committed as canonical state, survives
   fresh-process restarts exactly, and three production adaptation channels
   (belief, relationship familiarity, affect) demonstrably change canonical values from
   lived evidence. Belief moved `0.55 → 1.0` by lawful ±0.05 steps on a stable proposition
   identity over 216 real episodes.
2. The *changing* half is proved for state values, and **not** proved for consequences:
   - `durable-life-history-…-remeasure` (real provider, 5/5 units): treatment-pair
     behaviour disagreement **100 pp**, ablation-pair **20 pp** → **80 pp of the effect is
     the retrieved memory text**;
   - in the ablated arms the only residual state difference is canonical affect, magnitude
     **2.27e-05**, i.e. effectively zero;
   - `treatment_intent_disagreement 100 pp` but `behavior delta (treatment − ablation)
     80 pp` with `intent delta 0 pp` — the frozen verdict is
     `FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY`;
   - affect → cognition content is genuinely causal (`REPLICATED`, 320/320) but
     affect → action selection is 0/80 and the repair experiment is a clean null;
   - `non-memory-state-value-ablation-v0`: marginal value of non-memory state beyond
     Memory = `NOT_PROVEN`; "is CharacterOS more than LLM + Memory/RAG" = `INCONCLUSIVE`;
   - belief causation = `INCONCLUSIVE`, confirmatory successor preregistered and **never
     run** (PAUSED, 0 calls);
   - relationship behavioural causality = `NOT_ESTABLISHED`, and the best decomposition
     shows behaviour follows *context availability*, not the relationship scalar;
   - personality plasticity is disabled by construction in the product and has **never
     fired**;
   - no baseline exists, so even a positive result would currently be unattributable.
3. What is therefore demonstrated is exactly the shape the North Star brief names as
   insufficient: `Experience → store → Top-K → prompt → different text`.

### 2. If the next round may do only ONE thing

**Run the decisive arm of `HISTORY_INTERNALIZATION_TEST_V1` as a bounded, read-only,
disposable-copy measurement — the State-Isolation Differential — before building any new
trajectory or mechanism.**

Concretely, in one bounded slice: take the existing 216-episode canonical Alice on a
disposable copy; construct a genesis twin with identical identity anchors and the identical
current observation; then measure, under the byte-diff-verified provider seam the repo
already has, whether the two subjects' structured cognition differs **with the memory
evidence section removed from both requests** (retrieval ablated → state-only), and whether
it differs with state neutralized and retrieval intact (retrieval-only). Add the
`MEMORY_ONLY` / `GENESIS` baselines in the same request-matrix. Everything needed already
exists — `captureFutureProjection(restored, {ablate})` with its equivalence proofs, exact
restore, `projection_hash`, byte-identical request identity.

Why this one: it is a measurement, not a mechanism; it is bounded and cheap; it can *fail*,
and it is designed so that its failure is informative (it would say the internalization line
has no behavioural signature and should not be extended). If it *passes*, it converts the
repository's largest unproven claim into a baseline-differentiated causal result, and if it
fails it saves the cost of building consolidation, habits, goals and multi-timescale
coupling on an unproven foundation. Doing the full two-trajectory life experiment first
would spend the same budget on a longer path to the same question — and, as the long-run
record already shows, Alice's internalized state is currently **saturated** (belief at
credence 1.0, affect activation pinned at 1.0, familiarity monotone at one counterpart),
so a fresh long trajectory would first have to be shown to produce *non-saturated,
differentiated* state before it could test anything.

---

## Files Created

All new; nothing modified, deleted, or moved. Only `.md` files, so
`tsconfig.auxiliary.json` (`research/**/*.ts`) is unaffected, and `research/north-star/`
is not among the placeholder directories guarded by the frozen artifact-isolation law
(that law covers `research/diagnostics/`, `research/hypotheses/`, `research/emotion/`,
`research/memory/`, `research/plasticity/`, `research/appraisal/`). The directory choice
follows the brief's instruction; `research/README.md` is the repository's only convention
document for this tree and does not define a conflicting layout — **`research/README.md`
was deliberately not modified**, because its "Frozen evidence and the artifact-isolation
law" and "Hypothesis registry" sections are load-bearing governance text and editing it is
not this audit's mandate.

- `research/north-star/NORTH_STAR_EVIDENCE_AUDIT.md` (this file)
- `research/north-star/NORTH_STAR_EVIDENCE_MATRIX.md`
- `research/north-star/NORTH_STAR_GAP_ANALYSIS.md`
- `research/north-star/HISTORY_INTERNALIZATION_TEST_V1_DESIGN.md`

## Tests Executed

- `pnpm verify` (full gate). Log `tmp/north-star-verify.log` (gitignored; `tmp/` is ignored
  by `.gitignore` so this creates no repository change).
  Result: `governance` PASS · `typecheck` PASS · `build` PASS · `typecheck:auxiliary` PASS ·
  `lint` PASS · `test` **FAIL** — `252 files passed | 2 failed | 3 skipped (257)`,
  `3101 tests passed | 4 failed | 6 skipped (3111)`, duration 270.81 s.
- Cause of the 4 failures, verified independently: `curl -m 4 http://127.0.0.1:11434/api/tags`
  → **connection refused** (no local Ollama). The 4 tests are the 2 ungated files listed
  above; the 3 `skipIf`-gated real-provider suites skipped correctly.
- No test was modified, skipped, or deleted to change any result.
- Diagnostic commands used (read-only): `git rev-parse/status/log/branch -a`, `git ls-files`,
  `git grep`, `find`, `wc`, `curl` (local only), `Get-ChildItem Env:`.
- No model call was made by this audit; no provider credential was required or used.

## Git Diff

Before the audit: clean tree at `02b6c46` (`git status --porcelain` → 0 lines).
After the audit: **4 new untracked files under `research/north-star/`**, plus gitignored
`tmp/` output (`dist/` build artifacts and `tmp/north-star-verify.log`). **Zero modified
tracked files. Zero deletions. No `reset`, `checkout`, `clean`, `stash`, commit, or push.**
Core, product, tests, experiment contracts and all frozen evidence are byte-unchanged —
the audit's own reading of the frozen-evidence law ("no baseline-relative change may MODIFY
or DELETE any experiment's frozen evidence") is respected.

## Final Recommendation

Do not build. Measure.

The repository has one asset no other system in this space has: a real, long-lived,
restart-proven subject with 216 lived episodes, an exact restore chain, a byte-diff-verified
provider seam, and a culture of honest negative reporting. It also has a decade of
mechanism built on a consequence that was never demonstrated. The highest-value next
action is to point that instrumentation at the one question it was built to answer:
*does the internalized state, with the history text taken away, still make the subject a
different subject?*

If the answer is no, the repository should treat consolidation, habits, goals, personality
plasticity and multi-timescale coupling as **unjustified additions**, and should instead
invest in whichever channel *is* shown to carry consequence. If the answer is yes, the
repository will for the first time hold an `E4`+`E6`-shaped result for the North Star
claim, and every further mechanism will be buildable on measured ground.

Before that experiment runs, two cheap repairs are worth folding into the same slice
(neither is a core change, both are already understood): give the two ungated product test
files a real provider-availability gate so `pnpm verify` is honest on a clean checkout; and
re-run the `non-memory-state-value-ablation` design now that Belief and Relationship are
live, so the repository's strongest negative statement about itself describes the system it
actually has.
