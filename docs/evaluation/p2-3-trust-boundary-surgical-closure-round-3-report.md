# P2.3 Trust Boundary Surgical Closure Round 3 Report

## 1. Verdict

**PASS_WITH_NOTES**

All five authoritative items from the independent Codex re-audit are closed
with REGRESSION-FIRST executable evidence (B1–B4 fixes + B5 evidence closure),
the full cold gate chain passes on a fresh detached worktree, and no
architecture was reopened. The single note is the pre-existing appraisal
`attribution` **CONTRACT_CONFLICT**, left untouched per instruction and marked
**MUST_RESOLVE_BEFORE_P2_3_5**; it does not block P2.3.4.

## 2. Baseline / Final HEAD / origin-main

| | SHA |
|---|---|
| Round-3 baseline (expected local HEAD) | `359813d0408a30d30e20c3f26dd721f815e24ff6` ✔ matched |
| origin/main at start | `bb0a3a32a23d30ec9b1427ecb422e6c66ad28369` |
| Round-3 final code HEAD | `ac3d5bc` (B5) |
| Final HEAD (incl. report + push-result record) | `e1d88f0` (report commit; the record commit follows it) |
| Commits this round | 5 code commits + docs commits; all explicit file-listed, `git add .` never used |

Baseline check at start: `git status --short` clean, `HEAD == 359813d…`, no
reset performed; the 10 unpushed local commits were preserved and pushed at the
end (§11 below).

## 3. B1 Prepared Fingerprint Closure

- **BEFORE attack:** `commitReserved`/`terminalizeReservedNoOp` bound
  `PreparedLogicalResultBindingV1` to the reserved `(transition_id, subject_id,
  transition_type)` triple but never compared `binding.payload_fingerprint`
  against the authoritative reservation fingerprint — an all-zero or foreign
  fingerprint committed while host validator and identity matched (violates
  frozen §7.6 "compares the binding's ref/identity/fingerprint").
- **RED test:** `subject-core/src/commit/round3-b1.test.ts` B1.1–B1.5, harness
  wired with a WIDE-OPEN `preparedResultValidator` so only SubjectCore-owned
  checks can pass. Confirmed RED against `359813d` (B1.2/B1.3/B1.4/B1.5 all
  committed/terminalized instead of rejecting).
- **Fix (`ce8cb5a`):** both consumers now require
  `binding.payload_fingerprint === record.payload_fingerprint` in the
  SubjectCore-owned `bindingBound` gate — before verdict, candidate, hash,
  trace, bundle and CAS; frozen taxonomy reused
  (`COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001`). Invariant enforced:
  `reservedFingerprint == submittedProposalFingerprint == binding.payload_fingerprint`.
  Test fixtures/adapters updated to mint honest bindings from the exact
  proposal (`capabilitiesFor(proposal)` recomputes `proposalFingerprint`).
- **GREEN evidence:** B1.1 correct fingerprint commits; B1.2 all-zero rejected;
  B1.3 foreign-proposal fingerprint rejected; B1.4 correct triple + wrong
  fingerprint rejected before any authority work (record stays OPEN, zero
  attempts, zero bundles); B1.5 NO_OP terminalization enforces the same bind
  both ways. Validator cannot weaken the equality (wide-open validator in the
  harness).

## 4. B2 Runtime Memory Authority Closure

- **BEFORE (runtime surface):** `RuntimeCompositionRoot` stored
  `memory: { repository: options.memoryRepository }` — typed as
  `MemoryPreparationAuthority` but AT RUNTIME the original concrete object, so
  `dependencies().memory.repository.prepareRevision` was reachable, bypassing
  intent identity/fingerprint/idempotency.
- **AFTER (runtime surface):** `memory.repository` is a NEW frozen projection
  from `createMemoryPreparationAuthority(...)` (memory package). Actual JS
  checks in `runtime/src/composition/memory-authority-isolation.test.ts`:
  `Object.keys(handle)` = exactly `[payloadHashOf, prepareRevisionForIntent,
  readManifest, storePayload, validateRefsBelong, validateRevisionBinding]`;
  `"prepareRevision" in handle === false`; `typeof handle.prepareRevision ===
  "undefined"`; `handle !== concreteRepository`; `Object.isFrozen(handle) === true`.
- **Public memory API re-audit:** `InMemoryMemoryRepository` is classification
  **A — infrastructure-only reference implementation**. It remains publicly
  exported for host/infrastructure duties (genesis minting, infrastructure
  tests — not broken to hide a symbol), but runtime composition can never
  expose it as the Learning-facing authority.
- **RED→GREEN:** B2.1 RED at `359813d` (`"prepareRevision" in handle === true`);
  after `046df46` all four regressions pass: B2.2 honest intent prepare works
  through the handle and lands in the underlying repository; B2.3 same intent +
  same fingerprint idempotent (same revision); B2.4 same intent + changed
  fingerprint → `MEMORY_PREPARE_CONFLICT`.

## 5. B3 Journal Import Semantic Closure

`importState` now enforces frozen §14.2/§14.3 SEMANTICS on top of shape
(`f158dfa`); one invalid record still rejects the whole batch. Enforced
invariants:

- Attempt status invariants (§14.3): COMMITTED ⇒ `revision_after =
  revision_before + 1`, non-null trace, null audit/error/reason; NO_OP ⇒ equal
  revisions/hashes, null trace/audit/error, `reason == TIME-NOOP-001`;
  REJECTED/ABORTED ⇒ equal revisions/hashes, null trace, non-null
  audit/error/reason.
- Terminal semantics (§14.2): attempts empty ONLY while OPEN; terminal
  COMMITTED/NO_OP requires a non-empty attempt list whose LAST attempt has the
  same status; `terminal_result_ref` must equal that attempt's `result_ref`;
  no earlier attempt may already be terminal; OPEN records never carry
  terminal attempts.
- Fingerprint/identity consistency: a reuse conflict can never replay the
  record's own reserved `(proposal_ref, payload_fingerprint)` tuple (reuse
  exists only for a DIFFERING identity); header fields stay single-source.
- `record_version` journal-history floor: `>= 1 + attempts + reuse_conflicts`.
- Sequence recovery: first-seen counter restored as `max(existing, all imported
  first_seen_sequence)` (unchanged from Round 2, re-pinned).

Attacks: B3.1 forged COMMITTED + `attempts: []` rejected; B3.2 terminal ref ≠
last attempt ref rejected; B3.3 impossible conflict replay rejected; forged
attempt invariants / short record_version rejected. Honest paths: B3.4/B3.5/B3.6
honest COMMITTED/NO_OP/OPEN export→import byte-equal (`round3-b3.test.ts`
drives real `reserveAndRoute → commitReserved / terminalizeReservedNoOp`);
B3.7 replay after import → `ALREADY_COMMITTED`; B3.8 changed payload after
import → durable `TRANSITION_ID_REUSE/IDEM-REUSE-001` conflict.

## 6. B4 Observation Transition Identity Closure

- **Exact old collision pair** (both legal under frozen IdentifierV0 /
  CanonicalRefV0 grammar; separator ambiguity, not just the colon replace):
  - A: subject `subject-s0`, revision `0`, observation `observation:x-r0-oobservation-y`
  - B: subject `subject-s0-r0-oobservation-x`, revision `0`, observation `observation:y`
  - old algorithm: both → `t-obs-subject-s0-r0-oobservation-x-r0-oobservation-y` (pinned in `round3-b4.test.ts`)
  - new IDs: different (pinned).
- **Fix (`4e62f7f`):** `observationTransitionId` is now a domain-separated
  canonical hash — `hashEnvelope("characteros-next/runtime/observation-transition-id/v1",
  {subject_id, expected_state_revision, observation_id})` → `t-obs-<64 hex>`
  (70 chars, valid under `^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$`). No
  Date.now/randomUUID/Math.random; same tuple ⇒ same ID; different
  subject/revision/observation ⇒ different IDs (all pinned).
- **TimeTransition checked, NOT changed:** `timeTransitionId` interpolates only
  opaque scalars with no separator-bearing sanitization; the same-class
  collision regression passes as-is (no demonstrable flaw ⇒ untouched per
  instruction).

## 7. B5 A11 Atomic Regression

Fixture repair: `buildObservationHarness` now ACTUALLY honors the
`contextProducer` override (previously declared and silently ignored).

| | invalid ContextDelta (B5 attack) | valid ContextDelta (inverse control) |
|---|---|---|
| proposal | complete multi-domain, invalid delta INSIDE | complete multi-domain |
| admission | REJECTED `INVALID_SCHEMA/SS-SCHEMA-001` | COMMITTED |
| bundle count | 0 | 1 |
| revision | unchanged (`currentRevision` null) | 1 |
| state hash / bytes | unchanged (frozen snapshot byte-identical before/after) | single authoritative successor |
| trace | no successful append (`trace_window.entries` empty) | exactly one trace entry |
| partial mutation | none: affect/mood/context byte-identical, memory prepare/read = 0, no retrieval-metadata mutation | both domains atomic in one commit |

The invalid delta genuinely enters assembly: the overriding producer RUNS
(`contextDeltaCalls === 1`) and returns the bad delta — the rejection comes
from canonical admission, not an early producer throw (`round3-b5.test.ts`).

## 8. Regression Matrix

| # | Scenario | Result | Evidence |
|---|---|---|---|
| RT1 | reserve A + commit continuation_A with proposal B | **BLOCKED** | adversarial suite "A1"/"A1b" (Round-2, still green) |
| RT2 | binding correct id/subject/type but wrong fingerprint | **BLOCKED** | `round3-b1.test.ts` B1.2/B1.3/B1.4 |
| RT3 | binding correct fingerprint | **allowed** | B1.1 + B1.5 honest half; full suite commits |
| RT4 | runtime deps expose raw prepareRevision | **NO** | `memory-authority-isolation.test.ts` B2.1 (plain JS `in`/`typeof`) |
| RT5 | runtime safe intent prepare | **works** | B2.2 |
| RT6 | import fake COMMITTED terminal with zero attempts | **BLOCKED** | `journal.test.ts` B3.1 |
| RT7 | honest COMMITTED export/import | **works** | `round3-b3.test.ts` B3.4/B3.7 |
| RT8 | honest NO_OP export/import | **works** | `round3-b3.test.ts` B3.5 |
| RT9 | two distinct old-collision Observation tuples | **different IDs** | `round3-b4.test.ts` collision pair |
| RT10 | same Observation tuple replay | **same transition ID** | `round3-b4.test.ts` determinism |
| RT11 | invalid ContextDelta inside complete proposal | **zero commit / zero partial state** | `round3-b5.test.ts` |
| RT12 | valid equivalent Observation proposal | **one atomic commit** | `round3-b5.test.ts` inverse control |

## 9. Cold Verification

Fresh detached worktree at final code HEAD (`ac3d5bc`), no reused dist:

| Step | Command | Exit code |
|---|---|---|
| install | `pnpm install --offline --frozen-lockfile` | 0 |
| 1 (cold, before build) | `pnpm typecheck` | 0 |
| 2 | `pnpm build` | 0 |
| 3 | `pnpm test` | 0 — **23 test files, 295 tests, 0 skipped, 0 failed** |
| 4 | `pnpm lint --max-warnings 0` | 0 |

## 10. Commits

| SHA | Message | Files |
|---|---|---|
| `ce8cb5a` | fix: bind prepared result fingerprint to the authoritative reservation (blocker B1) | subject-core `facade.ts`, `facade.test.ts`, `adversarial-regression.test.ts`, `round3-b1.test.ts` (new); runtime time+observation executors/fixtures/tests |
| `046df46` | fix: isolate runtime memory preparation authority behind a frozen projection (blocker B2) | memory `repository/memory-repository.ts`, `index.ts`; runtime `runtime-composition-root.ts`, `memory-authority-isolation.test.ts` (new) |
| `f158dfa` | fix: validate imported transition journal semantics, not just shape (blocker B3) | subject-core `identity/journal.ts`, `journal.test.ts`, `round3-b3.test.ts` (new) |
| `4e62f7f` | fix: make observation transition identity collision-safe via domain-separated hash (blocker B4) | runtime observation executor + fixtures + conformance/executor tests + `round3-b4.test.ts` (new) |
| `ac3d5bc` | test: close observation A11 atomicity regression and honor contextProducer override (blocker B5) | runtime observation fixtures + `round3-b5.test.ts` (new) |
| (docs) | docs: round-3 attribution conflict marker + this report | `docs/evaluation/*` (`a7e4822`, `e1d88f0`) |

## 11. Remote Sync

- Local HEAD before push: `e1d88f0` (round-3 report commit), `git status` clean.
- Push result: **SUCCESS** — `git push origin main` →
  `bb0a3a3..e1d88f0  main -> main` (exit 0). All 17 previously-unpushed local
  commits (Round 2 + Round 3) are now on origin/main; nothing was reset.
- Post-push verification: `git rev-parse HEAD` == `git rev-parse origin/main`
  == `e1d88f0fb03a813f5b66cb839879b7003155d903` (the push-result record commit
  in `docs` follows and is pushed immediately after).

## 12. Remaining P1/P2

Not hidden, not promoted:

1. **Producer capability transition/subject scoping** — capability is
   producer/domain-scoped but not transition/subject-scoped (independent audit
   classification P1/PARTIAL; unchanged this round by instruction).
2. **Optional referenceValidator policy** — remains an optional port; policy
   hardening deferred (no demonstrated blocker).
3. **Raw journal support surface** — `InMemoryTransitionIdentityJournal` is
   infrastructure (as with B2's repository classification A): export/import are
   host persistence seams; runtime code only reaches the journal through the
   facade/composition.
4. **Stale ROADMAP/NEXT_ACTIONS** — workspace docs not refreshed this round
   (surgical scope); flagged for the next planning slice.
5. **REBASE_REQUIRED future Learning path** — LearningTransition runtime
   executor remains unimplemented by prohibition; Learning-typed proposals stay
   at the facade/type surface; any future Learning work must rebase onto this
   closure.

## 13. Appraisal Attribution

**CONTRACT_CONFLICT** — runtime `attribution: UnitIntervalV0` vs MICL/acceptance
`self | other | situation` vs silent contract-freeze. No representation chosen,
no appraisal code changed. Marker: **MUST_RESOLVE_BEFORE_P2_3_5** (recorded in
the Round-2 report §17 item 1 update). Does NOT block P2.3.4.

## 14. Exact Next Phase

**P2.3.4 — Affect FAST+EMA reference producer + Regulation producer
integration.** NOT implemented in this round (prohibition respected); final
state is readiness only.

## 15. Readiness

**READY_FOR_INDEPENDENT_REAUDIT**
