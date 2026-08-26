# P2.3 Trust-Boundary Closure Round 2 Report

## 1. Final Verdict

**PASS_WITH_NOTES**

All nine red-team attacks (A–I) are closed with REGRESSION-FIRST evidence;
the clean-checkout gate chain passes cold; no fail-open integrity callback and
no structurally forgeable producer authority remain. The single note is a
documentation conflict on the appraisal `attribution` field (§15 of the task),
reported as **CONTRACT_CLARIFICATION_REQUIRED** — deliberately left unresolved
per instruction ("If documents conflict: STOP that sub-item"), with no code or
representation change.

## 2. Baseline / Final HEAD

| | SHA |
|---|---|
| Baseline (task start) | `bb0a3a3` |
| Final HEAD | `65a5386` |
| Commits in range | 9 (all explicit file-listed; `git add .` never used) |

## 3. Attack Reproduction Before Fix

Every attack was reproduced with a failing regression test BEFORE its fix
(§2 REGRESSION FIRST), then closed minimally.

| ATTACK | ACTUAL BEFORE | REGRESSION TEST | FIX | ACTUAL AFTER |
|---|---|---|---|---|
| A — continuation/proposal swap | `commitReserved` accepted a different proposal under a reserved continuation; binding verified only against continuation | `adversarial-regression.test.ts` "A1", "A1b" | Facade recomputes proposal_ref + fingerprint from the submitted proposal and compares against the journal record before any prepared/producer/hash work (`403af28`) | REJECTED `COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001`, zero CAS, zero mutation |
| B — head/identity version conflation | Store CAS keyed on the transition identity `record_version`, so an honest second transition lost with `COMMIT_CONFLICT` | "B1" | CAS keys on subject `state_revision` only; identity record lifecycle stays journal-local (`e2f6884`) | T1→rev 1, T2→rev 2 committed; replay never increments |
| C — prepared result fail-open | Missing `preparedResultValidator` returned `true`; foreign bindings accepted | "C1", "C2" | Validator REQUIRED when a prepared binding is carried; facade verifies identity tuple verdict-only; missing capability throws at assembly (`403af28`) | All fabricated/mismatched bindings rejected; honest path commits |
| D — structural producer authority | Any plain `{producer, domain}` object acted as authorization | "D1" | Issuer-minted opaque capability (`createProducerAuthorizationIssuer`); facade verifies issuer-backed identity verdict-only; structural JSON imitation refused (`7fdcee6`) | Forged set → `UNAUTHORIZED_PRODUCER`; issued set accepted |
| E — restore without history proof | `revision > 0` restore succeeded with optional/absent `commitChainVerifier` (fail-open) | "E1", "E2", "E-happy", "E0" | revision>0 restore REQUIRES a trusted chain verifier receiving subject/revision/head/checksum facts; missing or denying verifier → `COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001`; genesis unaffected (`a83ce41`) | Forged head rejected; confirmed chain restores |
| F — memory immutability/adoption | Same-ref payload overwrite possible; raw `prepareRevision` exposed as Learning-facing authority; any schema-valid R999 adoptable | "H1", "H2", "H-stale", "H-happy" + memory package tests | CAS payload store rejects same-ref different-content; `MemoryPreparationAuthority` intent API split from internal store; adoption requires a trusted validator (fail-closed) with parent/staleness proof (`d7a145e`) | Overwrite conflict; raw prepare not sanctioned; fake/stale adoption rejected; honest adoption commits |
| G — unvalidated retrieval output | Provider retrieval result used without validation; raw host exception strings leaked | `observation-transition-executor.test.ts` fixture matrix (8 malformed classes + legal empty) | Full `MemoryRetrievalResultV0` contract validation at the trust boundary immediately after retrieve (schema, refs/evidence alignment, set-like ordering, subject/revision cross-checks); all provider calls wrapped into canonical `TransitionStageFailure` (`95a7653`) | All malformed results rejected before interpretation; legal empty passes |
| H — candidate validation order | hash/trace authority work ran BEFORE whole-state and reference validation: multi-defect input reported layer 10 before layer 9, and invalid candidates received authoritative-looking projections | "J1", "J2", "J-order" with `PipelineStageObserver` spies | Engine reordered to frozen §13.4: reference/adoption (9) → FULL `validateSubjectState` with `preTraceWindowRevision` (10) → hash/trace/bundle (11) → CAS (12), plus defensive post-trace re-validation (`932c5c2`) | J1 reports `INVALID_MEMORY_REVISION/MEM-REV-001`; events `reference-gate → whole-state → authority`; zero authority work on rejection |
| I — cold-start typecheck | Clean checkout: `pnpm typecheck` FAIL (workspace deps resolve only to `dist`), then PASS only after `pnpm build` | `scripts/cold-typecheck-regression.ps1` (removes all `dist`, runs `pnpm typecheck`) | Per-package `tsconfig.typecheck.json` with `paths` mapping workspace deps to sibling `src/index.ts`; typecheck script switched; no build-in-typecheck, no committed dist (`7dc480b`) | Cold typecheck exit 0 on fresh worktree |

## 4. Two-Call Identity Protocol

`reserveAndRoute(proposal)` → trusted continuation; `commitReserved(...)`
re-reads the latest authority, recomputes proposal_ref/fingerprint from the
submitted proposal, and compares against the authoritative journal record
before prepared verification, producer work, candidate building, hash or CAS.
The continuation is never the sole source of truth (A1/A1b pin this).

## 5. Sequential Transition Store Semantics

Subject canonical head (`subject_id`, `state_revision`, `state_hash`,
`commit_head`) is the only CAS key. Transition identity journal records
(`record_version`, attempts, terminal status) live a separate lifecycle; a new
transition starts its own record without conflicting with the previous
transition's record version (B1 pins three sequential commits; replay never
increments).

## 6. Prepared Result Fail-Closed Verification

A non-null prepared binding REQUIRES a trusted verifier capability; the
reference assembly throws if the port is omitted. The facade binds the binding
to the reserved identity tuple (transition_id, subject_id, transition_type,
payload fingerprint) itself before consulting the verdict-only capability
(C1/C2 pin closure; honest commits unaffected).

## 7. Producer Capability Issuance

- **Who issues:** the trusted capability issuer
  (`createProducerAuthorizationIssuer`) held by the composition root.
- **Why plain objects cannot forge it:** issued sets carry an issuer-backed
  opaque capability; `verify` checks issuer identity at runtime, so a
  structurally identical JSON imitation fails (D1 pins this; a capability for
  `affect` cannot authorize `context` because the binding set must equal
  exactly the proposal's `(producer,domain)` pairs).
- **How SubjectCore verifies:** the facade calls the injected
  `producerAuthorizationVerifier` verdict-only; anything not issuer-minted →
  `UNAUTHORIZED_PRODUCER` before candidate construction.

## 8. Restore History Proof

`restoreFromEnvelope`: revision 0 keeps genesis semantics; revision > 0
requires `commitChainVerifier` receiving subject, state revision, commit head,
record checksum and snapshot facts. Missing or denying verifier →
`COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001`. No silent structural-restore
fallback exists (E1/E2/E-happy/E0 pin all four quadrants).

## 9. Memory Immutability / Prepare / Adoption

- Immutable payloads: same ref + changed content → conflict; original payload
  and revision bindings untouched.
- Authority split: `MemoryPreparationAuthority` (intent identity, payload
  fingerprint, parent revision, repository-owned payloads) is the sanctioned
  runtime-facing prepare surface; raw prepare remains internal-only.
- Adoption: binding-changing proposals REQUIRE a trusted adoption validator
  proving existence/hashes/parentage/ref-membership/integrity/staleness;
  missing validator fails closed; binding-neutral proposals never touch the
  gate (H1/H2/H-stale/H-happy pin closure without over-blocking).

## 10. Observation Retrieval Validation

Immediately after `RetrievalPort` returns, the executor validates the complete
`MemoryRetrievalResultV0` contract (schema_version, selected refs, evidence
alignment, deterministic metadata, repository_revision cross-check against the
query, retrieval_trace_ref, set-like raw-ASCII ordering, reference kinds)
before any interpretation/appraisal use. Malformed fixtures (missing schema
version, missing evidence, length mismatch, invalid kind, wrong revision,
duplicates, unsorted refs, invalid metadata) all reject before interpretation;
the legal empty result still passes. Provider failures map to stable
`TransitionStageFailure { stage, error_code: SERVICE_UNAVAILABLE, reason:
FAIL-SERVICE-001 }` regardless of arbitrary host exception messages (two
different throwing providers produce identical canonical classification).

## 11. Candidate Validation Ordering

Frozen §13.4 precedence implemented exactly: (9) repository reference
validation + adoption boundary → (10) FULL whole-state validation of the
pre-trace candidate (`preTraceWindowRevision` ties §10.3 linkage to the prior
revision) → (11) StateHash/TraceEntry/window projection → defensive FULL
re-validation of the frozen successor (now including §10.3 successor linkage)
→ SnapshotHash both sides → bundle → single CAS. `PipelineStageObserver` spies
make the precedence observable: no invalid candidate ever receives an
authoritative-looking hash/trace/bundle, and multi-defect inputs report the
earliest failing layer.

## 12. Journal Restart Semantics

`exportState` returns a deep-frozen snapshot; every stored record is frozen at
its single storage point. `importState` FULLY validates every record (closed
shape, branded scalars, terminal status/ref pairing, contiguous attempt and
conflict sequences) before applying anything — one invalid record rejects the
whole batch, and invalid terminal records can never be injected. The
first-seen sequence counter is recovered deterministically so restarted
journals never collide with pre-restart identities. Restart preserves OPEN
reservations, COMMITTED replay, terminal NO_OP replay and reuse-conflict
semantics (A15 suite + `journal.test.ts` pin all of it).

## 13. Cold Typecheck Repair

Each of the 11 workspace projects now typechecks via
`tsconfig.typecheck.json` (`noEmit`, workspace dependencies mapped with
`paths` to sibling `src/index.ts`). No build-in-typecheck, no committed dist,
no disabled checks. Regression `scripts/cold-typecheck-regression.ps1` removes
all `dist` artifacts and requires `pnpm typecheck` exit 0.

## 14. Regression Test Matrix

| # | Requirement | Test(s) | Location |
|---|---|---|---|
| A1 | old continuation + changed proposal rejected | "A1", "A1b" | subject-core adversarial suite |
| A2 | two different transitions commit sequentially | "B1" | subject-core adversarial suite |
| A3 | fabricated prepared result rejected | "C1" | subject-core adversarial suite |
| A4 | missing prepared verifier fails closed | "C2" | subject-core adversarial suite |
| A5 | forged producer capability rejected | "D1" | subject-core adversarial suite |
| A6 | real issued producer capability accepted | "A-happy", "H-happy" | subject-core adversarial suite |
| A7 | revision>0 restore without verifier rejected | "E1", "E2" | subject-core adversarial suite |
| A8 | memory payload overwrite rejected | repository immutability tests | `memory/src/repository/in-memory-memory-repository.test.ts` |
| A9 | unsafe raw prepare not exposed through sanctioned port | port-surface conformance tests | `memory/src/conformance.test.ts`, `memory/src/contract.test.ts` |
| A10 | fake R999 adoption rejected | "H1", "H2" | subject-core adversarial suite |
| A11 | stale prepared revision adoption rejected | "H-stale" | subject-core adversarial suite |
| A12 | malformed retrieval result rejected | 8-fixture malformed matrix | `runtime .../observation-transition-executor.test.ts` |
| A13 | legal empty retrieval still accepted | legal-empty test | same file |
| A14 | invalid candidate rejected before hash/trace | "J1", "J2", "J-order" (stage spies) | subject-core adversarial suite |
| A15 | journal restart preserves transition identity | "A15" x3 + journal hardening suite | adversarial suite + `identity/journal.test.ts` |
| A16 | cold-start typecheck passes | `scripts/cold-typecheck-regression.ps1` | repo root script |

Final suite: **18 test files, 267 tests, 0 skipped, 0 failed.**

## 15. Clean Verification Results

Fresh detached worktree at final HEAD (`65a5386`), no reused dist artifacts:

| Step | Command | Exit code |
|---|---|---|
| install | `pnpm install --offline --frozen-lockfile` | 0 |
| 1 | `pnpm typecheck` (COLD, no dist present) | 0 |
| 2 | `pnpm build` | 0 |
| 3 | `pnpm test` — 18 files, 267 tests, 0 skipped, 0 failed | 0 |
| 4 | `pnpm lint` (`--max-warnings 0`) | 0 |

Final self red-team (R1–R13), each answered by executable evidence above:
R1 BLOCKED (A1) · R2 both COMMITTED (B1) · R3 BLOCKED (C2/C1) · R4 BLOCKED
(D1) · R5 BLOCKED (E1/E2) · R6 BLOCKED (A8) · R7 BLOCKED (H1) · R8 BLOCKED
(H-stale, validator denies stale parent) · R9 BLOCKED (A12) · R10 ALLOWED
(A13) · R11 NO (J1/J2 stage spies) · R12 NO (A15 + journal suite) · R13 PASS
(A16 clean worktree).

## 16. Commits

| SHA | Message | Files |
|---|---|---|
| `403af28` | fix: bind continuations and prepared bindings to reserved proposal identity (ATTACK A/C) | subject-core `facade.ts`, `reference.ts`, adversarial suite; runtime observation/time fixtures+tests, composition-root test |
| `e2f6884` | fix: key atomic store CAS on state revision only, not identity record version (ATTACK B) | subject-core `store.ts`, adversarial suite |
| `7fdcee6` | fix: issuer-backed producer authorization capability (ATTACK D) | subject-core `producer-authorization.ts`, `facade.ts`, `reference.ts`, `index.ts`, tests; runtime composition root, ports, executors, fixtures |
| `a83ce41` | fix: restore requires commit-chain history proof for revision > 0 (ATTACK E) | subject-core `restore.ts`, restore tests, adversarial suite |
| `d7a145e` | fix: memory payload immutability, intent-only preparation authority, adoption validator (ATTACK F) | memory repository+contract tests/index; runtime memory port, composition root, time executor test; subject-core engine/facade/reference/index/adversarial |
| `95a7653` | fix: validate retrieval results at trust boundary + canonical provider failure mapping (ATTACK G) | memory retrieval `validation.ts` + tests; runtime observation executor + fixtures + tests |
| `932c5c2` | fix: frozen section 13.4 pipeline precedence — reference/adoption and whole-state gates before hash/trace (ATTACK H) | subject-core `engine.ts`, `facade.ts`, `index.ts`, `subject-state.ts`, adversarial suite |
| `7dc480b` | fix: cold-start typecheck independent of dist artifacts via per-package typecheck configs (ATTACK I) | 11× `tsconfig.typecheck.json` + `package.json` script switch + `scripts/cold-typecheck-regression.ps1` |
| `65a5386` | fix: harden transition journal restoration — frozen exports, validated imports, sequence recovery (§16) | subject-core `journal.ts`, `journal.test.ts`, adversarial suite (A15) |

## 17. Remaining P1/P2

Not hidden, not promoted:

1. **CONTRACT_CLARIFICATION_REQUIRED — appraisal `attribution` (§15).**
   Runtime `AppraisalProposalDraftV0` types `attribution` as `UnitIntervalV0`
   ("exactly the six frozen fields, all UnitIntervalV0"); `docs/architecture/
   micl-design.md` specifies `attribution // self / other / situation` and the
   P1.5 acceptance contract uses enum-style examples (`attribution=other`);
   `p2-1-contract-freeze.md` does not define the field at all. Documents
   conflict → sub-item stopped per task instruction; no hybrid invented.
   Needs an authoritative ruling before Learning work touches appraisal.
2. **OUTCOME_UNKNOWN resolution** remains intentionally unresolved at the
   engine boundary per frozen §15.2 (reconciliation is a host duty); unchanged
   by this round.
3. **LearningTransition runtime executor** remains unimplemented by design
   (§18 prohibition); Learning-typed proposals are exercised only at the
   facade/type surface.

## 18. Learning Readiness

**READY_FOR_INDEPENDENT_REAUDIT**

## 19. Safety Confirmation

- NO LearningTransition runtime executor
- NO MICL execution
- NO LLM integration
- NO retrieval algorithm changes (validation only)
- NO scientific affect changes
- NO legacy repo modifications
