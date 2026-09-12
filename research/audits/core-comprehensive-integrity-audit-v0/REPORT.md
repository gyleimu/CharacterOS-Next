# REPORT — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

## Overall Verdict

`CORE_GREEN_WITH_MINOR_DEFECTS`

The canonical write/commit/restore spine is sound and the frozen contracts are implemented faithfully. The
audit found and **fixed** five confirmed defects (one projection feature that was inert in production, one
configuration flag that did not gate adaptation, one retrieval ref/content binding hole, one lawful-abstention
crash, one silent canonical rollback on restore) plus one subject-binding gap. Remaining findings are
persistence-durability gaps requiring a dedicated slice, projection/prompt semantic weaknesses, and one
confirmed duplicate-history defect (external observation replay) whose fix changes a frozen identity law.

## Executive Summary

- Zero P0 defects. One confirmed history-duplication defect (AUD-06) and one now-fixed rollback acceptance
  (AUD-05) are the highest-severity items.
- Six defects fixed in this slice, each with a regression test; all 492 targeted tests pass.
- Affect implementation is mathematically sound; its **projection is semantically under-specified** (raw
  valence/activation with no legend) and cognition sees affect from **before** the current event's
  AffectApplication. Those two facts, not the model, most plausibly explain the previous ablation's
  variance-dominated result.
- The strongest proven chain is event → Appraisal → Affect → persistence → restore → projection → behavior.
  The *marginal behavioral value of Affect beyond Memory* remains unproven.
- Belief adaptation is wired and called but can never change credence (no INSERT path, empty genesis);
  Personality is absent in the product; Relationship familiarity is genuinely active.

## Repository Baseline

Branch `main`, HEAD `442a5f515f8fb654dc30eaaf6c3411240a26d797`, clean worktree at audit start. Previous slice
`NON_MEMORY_STATE_VALUE_ABLATION_V0` present and audited.

## Final HEAD

See the final report fields at the end (audit commit + doc commit).

## Worktree

Clean after commits; only `research/audits/core-comprehensive-integrity-audit-v0/**` added plus the six
minimal production fixes and their regression tests.

## System Architecture Reconstructed

See `SYSTEM_MAP.md`. 15 workspaces; the production human turn order was verified empirically by `trace.mjs`,
not inferred from documentation.

## Current Production Causal Graph

See `CAUSAL_GRAPH.md`. Strongest proven chain:

```
event → Observation → Appraisal → Affect → persistence → restore → cognition projection → cognition → language
```

## Active vs Latent Systems

| Subsystem | Status |
|---|---|
| Memory, Appraisal, Affect, Regulation(constant), Cognition, Language, Learning, persistence, time | ACTIVE |
| Relationship familiarity | ACTIVE (counterpart hardcoded) |
| Belief adaptation | LATENT (wired+called, effect UNREACHABLE, data ABSENT) |
| Personality | ABSENT in product |
| ActionIntent / allowed actions | ABSENT (empty action space) |
| familiarity-selected retrieval evidence | ACTIVE after AUD-01 fix (was inert) |

## Canonical State Authority Table

See `AUTHORITY_TABLE.md` (per-field creator/updater/evidence/validation/persistence/restore/projection plus
the durable-field AUTHORITATIVE vs OBSERVATIONAL classification and the capability clone matrix).

## Highest-Risk Findings

1. **AUD-06 (confirmed, reported):** external observation replay creates duplicate durable experience.
2. **AUD-05 (confirmed, fixed):** stale/rolled-back store accepted on restore.
3. **AUD-07/08 (confirmed, reported):** identity journal not durable; `checkpoint_ref` never verified.
4. **AUD-11/12 (projection/lifecycle semantics):** affect line has no legend; cognition sees pre-event affect.
5. **AUD-16/21 (latent/absent surfaces):** belief adaptation inert; personality absent.

## P0 Findings

None.

## P1 Findings

- **AUD-02 (fixed):** `CHARACTEROS_DISABLE_ADAPTATION` did not disable belief/relationship adaptation — the
  operator-intended semantics were violated (adaptation ran while diagnostics reported it disabled).
- **AUD-04 (fixed):** a lawful appraisal abstention crashed mandatory pending lifecycle work, contradicting the
  documented terminal, no-Affect abstention contract.

## P2 Findings

- **AUD-01 (fixed):** explicit-v4 projection silently dropped familiarity-selected evidence (frozen integration
  inert on the production path).
- **AUD-16 (reported):** belief adaptation is wired and called but its effect is unreachable.
- **AUD-21 (reported):** personality is absent/unbootstrappable in the product while adaptation surfaces exist.
- **AUD-10 (reported, P5/P2 borderline):** conversation prompt citeable list diverges from the validator
  allowlist.

## P3 Findings

- **AUD-03 (fixed):** retrieval selected a payload's self-declared `episode_ref` instead of its manifest binding.
- **AUD-05 (fixed):** silent canonical rollback accepted on restore.
- **AUD-09 (fixed):** long-horizon restore did not bind checkpoint subject to configured subject.
- **AUD-06 (reported):** external observation replay duplicates experience (confirmed by probe).
- **AUD-07 (reported):** identity journal not persisted.
- **AUD-08 (reported):** `checkpoint_ref` unverified.
- **AUD-13 (reported):** generic Learning idempotency revision-bound, not event-addressed.
- **AUD-17 (reported):** `BeliefTransitionExecutor` root-exported, bypasses the plasticity capability.
- **AUD-18 (reported):** relationship counterpart hardcoded to `entity:alice`.
- **AUD-25 (reported):** language episode read uses the pre-appraisal repository revision.

## P4 Findings

See `TEST_GAP_AUDIT.md`: subset-tolerant assertion masking the citeable divergence; v3-only coverage of a v4
production feature (how AUD-01 escaped); fixture-only personality tests; tolerated restore classification; no
tests for external-observation replay, journal durability, `checkpoint_ref`, or cross-subject restore binding.

## P5 Findings

- **AUD-19:** stale constant `PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0 = "NONE"`.
- **AUD-20:** `NOT_DECISION_ADMISSIBLE` reason literal `UNREGISTERED_FEATURE` for a registered feature.
- **AUD-23:** affect dynamics declares gains/bounds it does not consume.
- **AUD-24:** language prompt references an undefined `LAWFUL MEMORY EVIDENCE` label; enforcement broader.
- **AUD-10/15:** citeable-list divergence; permanently-empty `recent_retrieval_trace`.

## P6 Findings

- **AUD-11:** canonical affect line has no interpretation legend.
- **AUD-12:** cognition sees affect before the current event's AffectApplication (one-turn lag).
- **AUD-14:** retrieval's semantic anchor is the fresh current-observation ref (dimension effectively dead).
- **AUD-22:** `durable.identity.affect` never verified.
- **AUD-26:** raw scene/task interpolation (format-injection surface).
- **AUD-27:** language text is not semantically grounded (false statements possible; no memory creation).
- **AUD-28:** belief arbitration/tendency chain unreachable in product.
- **AUD-29:** `projection_hash` does not bind the allowed action space on V0/V1.

## Affect Audit

See `AFFECT_AUDIT.md`. Equations, validation, recovery, persistence, restore and projection exactness are
**sound**. Two issues remain: the projection carries no semantic legend, and cognition sees the pre-current-
event affect. Verdict: `AFFECT_MULTIPLE_ISSUES`.

### Affect semantics
Two axes only, closed validator, consistent meaning across the chain. SOUND.

### Appraisal → Affect mapping
`uV = 0.25*q*(2c-1)`, `uA = 0.1*q`, clamp after add, one application per event with receipt + idempotent CAS.
SOUND (no sign inversion, double application, wrong coefficient, or cross-wiring).

### Update math
Bounded, contractive, no unbounded accumulation; `-0` normalized; NaN/±Inf rejected. SOUND.

### Recovery/regulation
`exp(-elapsed/150)` toward `(0,0.2)`, once per positive interval, reachable in product. Regulation is
byte-exact zero-dynamics and does not feed affect. SOUND.

### Persistence
Canonical affect lives in the commit bundle; checkpoint copy is observational (AUD-22).

### Restore
Authoritative from the canonical head; `trace.json` proves exact affect round-trip. SOUND (after AUD-05 gate).

### Cognition projection
Raw byte-exact VA copy, hash-bound. SOUND mechanically.

### Prompt semantics
No legend (AUD-11) — the single most likely cause of weak model use of affect.

### Behavioral interpretability
Numeric-only; no named emotions (correct by design); null controls clean; one-turn lag (AUD-12) is
load-bearing and undocumented at experiment level.

### Affect Verdict
`AFFECT_MULTIPLE_ISSUES`

## Appraisal Audit

Producer paths enumerated (current primary, prior reply, experience/feedback, external-observation and
explicit-time are fail-closed non-producers). All share the same six-dimension validator; no differing
defaults; abstention is a separate closed schema. Exact-input reuse is turn-local, keyed on full request
identity + provider fingerprint, reuses ONLY the model-generated candidate dimensions, rebuilds all
authority/event/evidence fields from the current event, and re-validates + stale-rechecks before commit.
SOUND. `goal_conguence`/`goal_conuence` appear only as malformed test input; no misspelled-key acceptance.

## Memory Audit

Two admission paths are strictly exclusive per turn; the current event never enters its own retrieval.
Feedback replay is event-addressed and idempotent; episode refs are subject-bound and collision-resistant for
distinct content; manual ref injection is fail-closed at every adaptation boundary. Findings: generic Learning
is not event-addressed (AUD-13); external observation replay duplicates experience (AUD-06).

## Retrieval Audit

Deterministic total order with `episode_ref` tie-break; payload is authority; malformed/tampered entries
ignored; ref/content binding now enforced (AUD-03); evidence rendered as untrusted data with refs outside the
citeable set failing closed. Findings: semantic anchor dead (AUD-14), no subject scoping, trace channel dead
(AUD-15), recency-dominated top-K by declared precedence.

## Belief Audit

Contracts verified exactly: subjective-endorsement credence, `stance = 2c-1`, `UNIQUE_POSITIVE_MAX` with
ties/≤0 → `NO_SELECTION`; empty genesis with no fabricated credence; no fake neutral. Production reality:
wiring ACTIVE, effect UNREACHABLE, data ABSENT (AUD-16). Authority surface: root-exported executor can commit
arbitrary evidence-bound credence without the plasticity capability (AUD-17). Arbitration chain unreachable
(AUD-28). No production path was found that writes Belief without any authority, but the executor is reachable
by a trusted caller with an issuer.

## Relationship Audit

Reserved familiarity feature is `NOT_DECISION_ADMISSIBLE`, filtered out of `relationship_dimensions`, and never
reinterpreted as trust; governed-write epoch/history proofs fail closed; capability tokens are non-cloneable
WeakSets; restore re-derives receipts from canonical history. SOUND. Findings: hardcoded counterpart (AUD-18),
stale writer-authority constant (AUD-19), wrong reason literal (AUD-20), and the governed trusted-history
lookup binds only the terminal bundle (design weakness, trusted caller only).

## Personality Audit

Genesis prior P0 is explicit-only with no default/0.5; traits_seed stays immutable while P(t) is a mutable copy;
cognition renders them distinctly with explicit "0.5 is NOT neutral" semantics. Production: absent and
unbootstrappable, provider not wired (AUD-21); salience/isolation tests prove renderer semantics only.

## Cognition Projection Audit

See `PROJECTION_AUDIT.md`. Only real inconsistencies: citeable-list divergence (AUD-10) and the missing affect
legend (AUD-11); plus the now-fixed v4 retrieval-evidence drop (AUD-01).

## Prompt Audit

System prompts are strict, closed, and explicitly declare SUBJECT DATA untrusted. Real semantic risks: the
affect line is uninterpretable without a legend (AUD-11); the language prompt names an undefined evidence
section (AUD-24); "SUBJECT STATE values are not citeable" coexists with a validator that admits the current
observation ref (AUD-10). No named-emotion or reward language anywhere.

## Cognition Output Audit

Outer schema closed (exactly three keys), directive is a closed two-kind enum, `action_intent` must be null on
the conversation path, `projection_hash` binding enforced, refs canonicalized then validated; unknown keys,
missing fields, NaN/±Inf, out-of-range confidence all fail closed. Free-form `current_intent`/`reasoning_summary`
are never parsed into authoritative classification (belief policies explicitly exclude them), so label verbosity
cannot change the directive. SOUND.

## Language Audit

One call, no retry/fallback/repair; raw-size gate; strict closed draft; input_hash derived and equality-enforced;
evidence allowlist enforced in provider and executor; CLARIFY never calls the provider; behavior identity
re-derived against tampering; language cannot mutate cognition or canonical state. Findings: undefined evidence
section (AUD-24); insufficient grounding of text (AUD-27); stale repository revision on the episode read
(AUD-25); non-V2 projections deliberately null the realization intent (documented).

## Feedback Loop Audit

Delivery ledger re-derives ids and treats genuine replays idempotently; ingress ledger re-derives event refs and
conflicts on changed content; the previous-reply appraisal/AffectApplication runs in pending lifecycle work
before the next cognition; feedback episodes and observation episodes cannot both encode one event in the same
turn. No self-reinforcing double-application found. The one ordering caveat is AUD-12 (current-event affect
lands after its own cognition).

## Persistence Audit

See `PERSISTENCE_AUDIT.md`. Commit spine SOUND; rollback gate added (AUD-05); durability gaps AUD-06/07/08
reported.

## Restore Audit

`trace.json` proves an exact round-trip (revision, repository revision, affect, constants) and continuity after
restore. Rollback is now rejected (AUD-05 regression test). Subject binding added for the long-horizon seam
(AUD-09). Journals/adoption markers are not durable (AUD-07); `checkpoint_ref` unverified (AUD-08).

## Temporal Audit

Logical time is tick/occurrence-derived only; no wall clock in canonical state; one recovery per positive
interval; no off-by-one or double recovery found; restore does not reset time. SOUND.

## Observation / Environment Audit

Conversation ingress FIRST/REPLAY/CONFLICT SOUND. External observation deliberately performs no appraisal/affect
but has no replay dedup and duplicates experience on identical `observation_id` (AUD-06, confirmed). Environment
state round-trips and is bound into `checkpoint_ref`, which is unverified (AUD-08). One canonical revision
lineage per subject; external/environment episodes are retrievable into human cognition without a channel label.

## Authority / Capability Audit

All WeakSet capabilities reject JSON/spread/structuredClone and are fresh-minted on restore; self-minted
producer authorization is ineffective because the facade verifier is closure-private. Exceptions:
`BeliefTransitionExecutor` is root-exported (AUD-17) and affect consumption authority is a plain injected
reader (design weakness, trusted composition only).

## Legacy Reachability Audit

No attractor/particle/galaxy/momentum/drift paths exist in production; terms appear only in comments asserting
their absence. Legacy v3 affect channels/mood are rejected by the v4 validator. Verdict: DEAD / not reachable.

## Absence / Fake Neutral Audit

No fabricated defaults found in identity, affect, regulation, belief, relationship, personality or traits.
Absent states render honest ABSENT/`(none)`/`{}` markers; personality explicitly states "0.5 is NOT neutral".
Genesis Belief and Personality are empty by construction. SOUND.

## Model Variance Assumption Audit

The previous ablation proved temperature-0 output is not deterministic (identical request → directive flip).
No production authority or validator assumes determinism — every provider result is validated fail-closed, and
replay/idempotency is keyed on request/transition identity, not model output. The unsound assumption exists only
in causal-experiment interpretation, which must use replication. Flagged, not a code defect.

## Schema Robustness Audit

All model-facing schemas are strict, closed-key, finite-range, enum-exact, with no coercion/repair/retry; NaN
and ±Infinity rejected; numeric strings not coerced; unknown keys rejected. Malformed appraisal reuse input is
rejected. SOUND.

## Real End-to-End Trace

`trace.json` (0 real model calls): three turns captured with per-turn state revisions, repository revisions,
affect before/at-cognition/after, directive, intent and memory-section presence, followed by JSON round-trip +
restore (EXACT) and a post-restore turn. It empirically confirms the turn order, the exact affect round-trip,
and the one-turn affect-visibility lag (AUD-12).

## Architecture vs Runtime Mismatches

- "One user event encoded exactly once" holds per turn via exclusive branches, but generic Learning is not
  event-addressed (AUD-13) and external observation has no replay dedup (AUD-06).
- "Adaptation can be disabled" was false (AUD-02, fixed).
- "Validated familiarity evidence joins cognition" was false on the production v4 path (AUD-01, fixed).
- "Checkpoint identity is a binding" was only a label (AUD-05, fixed).
- "Belief adaptation is active" is true as wiring, false as effect (AUD-16).
- Prompt-documented citeable set ≠ enforced validator set (AUD-10).

## Tests Giving False Confidence

See `TEST_GAP_AUDIT.md` (six patterns).

## Confirmed Bugs

| ID | Severity | File | Contract violated | Root cause | Evidence | Fix | Test |
|---|---|---|---|---|---|---|---|
| AUD-01 | P2 | cognition-action-transition-executor.ts | familiarity-retrieved evidence joins cognition | v4 builder omitted the ref parameter | trace/agent + v3-only test | thread + merge refs | canonical-affect...test.ts |
| AUD-02 | P1 | product-provider-bundle.ts | null provider = DISABLED | flag wired to display | code | resolve to null when disabled | product-provider-bundle.test.ts |
| AUD-03 | P3 | repository-backed-retrieval-service.ts | manifest binding is selection authority | payload identity selected | code | skip on ref mismatch | repository-backed...test.ts |
| AUD-04 | P1 | explicit-v4-session-authority-v0.ts | abstention is terminal, non-fatal | missing NOT_ELIGIBLE branch | code | skip NOT_ELIGIBLE | lifecycle-abstention.test.ts |
| AUD-05 | P3 | explicit-v4-session-authority-v0.ts | checkpoint head binds restore | head derived only from supplied store | adversarial.json | gate on durable head/revision | restore-rollback.test.ts |
| AUD-09 | P3 | subject-session-v0.ts | one checkpoint = one subject | missing subject guard | code | fail closed on mismatch | subject-session suite |
| AUD-06 | P3 | explicit-v4-session-authority-v0.ts + observation-transition-executor.ts | external observation FIRST/REPLAY | revision-bound id + no ledger | adversarial.json | reported (needs frozen-law slice) | probe only |

## Suspected But Unproven Issues

- Governed trusted-history lookup binding only the terminal bundle (trusted caller only; no exploit path found).
- Affect consumption authority not an opaque capability (trusted composition only).
- Retrieval subject scoping assumption (single repository per subject).
- Adoption markers not durable (safe-adoption memory lost across restart).

## Fixes Applied

AUD-01, AUD-02, AUD-03, AUD-04, AUD-05, AUD-09 — six minimal fixes, each with a regression test, no new
ontology, no frozen-contract change. All 492 targeted tests pass.

## Production Semantic Changes

AUD-02, AUD-03, AUD-04, AUD-05, AUD-09 are behaviour-correcting but only on paths that were previously wrong
or unreachable (disabled adaptation; mismatched/tampered payloads; lawfully abstained events; rolled-back
restores; mismatched subjects). AUD-01 additionally re-activates an already-designed frozen integration on the
production v4 path: familiarity-selected evidence now reaches cognition when familiarity retrieval selects
usable evidence. Net: no new semantics or state fields; one dormant designed feature restored.

## Is CharacterOS Implementing What We Think It Is?

`MOSTLY`

Every major causal edge and contract exists and is enforced, and the canonical spine is sound. It is not `YES`
because: the familiarity-retrieval integration was inert (fixed), the adaptation-disable flag did not disable
(fixed), restore accepted rollbacks (fixed), Belief adaptation is called but cannot act, Personality is absent,
and one prompt surface contradicts its own declared citeability contract.

## Current Behavioral Contribution Table

| State | Status |
|---|---|
| Memory | ACTIVE_CAUSAL (retrieval → PRIOR FACTUAL MEMORY → cognition) |
| Affect | ACTIVE_CAUSAL (reaches cognition byte-exactly) / marginal value beyond Memory UNPROVEN |
| Belief | LATENT (wired+called, effect unreachable, data absent) |
| Relationship | ACTIVE_NOT_PROVEN (familiarity accrues; behavioral value unproven; retrieval evidence now reaches cognition) |
| Personality | ABSENT in product |

## Strongest Proven Causal Chain

```
event → Appraisal → Affect (canonical) → persistence → restore → cognition projection → cognition → language
```
All edges PROVEN at plumbing level; real-model semantic differentiation PROVEN for the lived-history slice;
marginal Affect-vs-Memory value NOT proven.

## Weakest Core Area

Persistence durability/idempotency of non-chain infrastructure: the transition-identity journal, adoption
markers, `checkpoint_ref` verification, and external-observation replay identity. These are the only places
where the system can silently diverge from its own history.

## Components Most Likely To Be Complexity Without Value

1. **Belief adaptation (per-turn semantic provider call)** — can never change credence; pure cost. KEEP the
   contracts, DEFER the product wiring, or add the lawful INSERT path.
2. **Personality adaptation surfaces** — dormant, unbootstrappable, advertised. FREEZE/DEFER.
3. **`recent_retrieval_trace` / `recent_retrieval_refs` channel** — permanently empty (now partially fed by
   AUD-01). KEEP only if a trace ref is implemented.
4. **Retrieval SEMANTIC dimension** — anchored on an impossible ref; ranking is recency+salience. FREEZE/patch.
5. **Belief decision/arbitration chain** — unreachable foundation. FREEZE.

## Affect Replicated Swap Experiment Ready?

`NO`

## Exact Blocker If NO

The canonical affect prompt line has no interpretation legend (AUD-11) and cognition sees affect from before the
current event's AffectApplication (AUD-12). A replicated swap experiment run against an uninterpretable numeric
line measures the model's numeric convention, not CharacterOS semantics. Define/fix those two projection
semantics (and add k≥5 repeats per condition to bound temperature-0 variance) first.

## Should Core Development Reopen?

`NO`

No confirmed P0 exists, and the P1/P3 defects found are fixed or have a clear dedicated-slice remedy. Core
development should not reopen for new psychology; it should schedule one bounded hardening slice.

## Recommended Next Step

Exactly ONE: `CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0` — (a) persistence/idempotency: persist or rebuild the
transition-identity journal, verify `checkpoint_ref`, add external-observation replay/conflict dedup keyed on
(subject, observation_id) via a new ledger (not by changing the frozen transition-id derivation), and add the
deferred regressions; (b) projection semantics: give the canonical affect line the frozen numeric legend and
document the pre-current-event affect visibility. Then re-run the replicated affect swap with k≥5 repeats.

## Real Provider Calls

**0** — the entire audit used source analysis, deterministic tests, `trace.mjs` and `adversarial.mjs`
(deterministic fakes only).

## Targeted Tests

492 passed across `packages/runtime/src/session`, `packages/memory/src/retrieval`, `product/sandbox/src`,
`packages/runtime/src/transitions/cognition-action` (49 files).

## Full Suite

`pnpm test`: **183 files passed, 1 skipped; 2340 tests passed, 3 skipped** (exit 0). The six regression tests
added by this audit are included.

## Typecheck

`pnpm typecheck` (`tsc -p tsconfig.workspaces.json`): **passed** (exit 0) with all production fixes.

## Auxiliary Typecheck

`pnpm typecheck:auxiliary`: **fails (exit 2)** with 3 × `TS2883` in the pre-existing tracked file
`research/experiments/familiarity-causal-behavior-v1/preflight.ts`. Verified pre-existing at clean HEAD in the
previous slice (reproduced with the experiment directory removed); unrelated to this audit, which adds no
`research/**/*.ts` files.

## Build

`pnpm build`: **passed** (14/14 workspaces, exit 0).

## Lint

`pnpm lint --max-warnings 0`: **passed** (0 errors, 0 warnings, exit 0), including the audit harness files.

## Governance

`pnpm governance`: **PASS** (15 workspaces, 21 conformance test files, exit 0).

## Diff Check

`git diff --check`: clean.

## Changed Paths

Production fixes: `packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.ts`,
`packages/runtime/src/session/explicit-v4-session-authority-v0.ts`,
`packages/runtime/src/session/subject-session-v0.ts`,
`packages/memory/src/retrieval/repository-backed-retrieval-service.ts`,
`product/sandbox/src/product-provider-bundle.ts`.
Regression tests: `packages/runtime/src/session/lifecycle-abstention.test.ts`,
`packages/runtime/src/session/restore-rollback.test.ts`,
`product/sandbox/src/product-provider-bundle.test.ts`, plus additions to
`packages/memory/src/retrieval/repository-backed-retrieval-service.test.ts` and
`packages/runtime/src/transitions/cognition-action/canonical-affect-cognition-integration-v0.test.ts`.
Audit artifacts: `research/audits/core-comprehensive-integrity-audit-v0/**`.

## Commit

See final report.

## Push

See final report.

## HEAD

See final report.

## origin/main

See final report.

## Worktree

See final report.
