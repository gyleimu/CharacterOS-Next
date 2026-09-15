# AUDIT_REMEDIATION_AND_FREEZE_V0 — DECISION

Minimal Audit Remediation + Freeze slice following `CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0`
(verdict `CORE_GREEN_WITH_MINOR_DEFECTS`, repository conclusion `SAFE_TO_CONTINUE`).

**Real model calls: 0. New core capability: NONE. Product work: NONE.**
Baseline SHA: `ae0a6bf1b1b9d3ae7d4f9a5dcf608ce8d0e8dd91` (`main`, clean, HEAD == origin/main).

---

## 1. Re-confirmed current state (independently verified from the repository)

| Property | Verified value | How verified |
| --- | --- | --- |
| Storage-write / registered Relationship features | **1** | `REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0` = exactly `relationship-interaction-familiarity-semantics-v0`; asserted by test |
| The one admitted feature | **interaction familiarity** | `INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0` + pinned fingerprint |
| Decision-admissible Relationship features | **0** | `queryRelationshipFeatureDecisionAdmissionV0` returns `NOT_DECISION_ADMISSIBLE` for every dimension; asserted by test |
| Familiarity decision status | **NOT_DECISION_ADMISSIBLE** | same query, reason `NO_TYPED_ACTION_RELATION` |
| Production governed writer | **LIVE for the one storage-admitted feature** | `product/sandbox/src/cli.ts` wires `relationshipFamiliarityAdmissionProvider`; the session authority runs the real ingestion → `evaluateRelationshipGovernedWriteV0` → governed V2 commit; `relationship-interaction-familiarity-ingestion.test.ts` asserts `writer_authority` non-null |
| Generic Relationship writer still rejects `relationship_core_*` | **yes** | reserved-write guard + governed-write law suites unchanged and passing |
| Authority membrane structural-clone resistance | **unchanged** | `writer-authority-membrane.test.ts` unchanged assertions passing |
| Persistence / restore invariants | **unchanged** | restore-chain + v4 authority suites passing |
| Affect / Belief frozen semantics | **unchanged** | no production semantic change in this slice |

The two admission tracks are distinct and were kept distinct throughout:

- **REGISTERED / STORAGE-WRITE ADMISSION = 1**
- **DECISION ADMISSION = 0**

No lawful familiarity admission was removed.

## 2. TASK 1 — stale frozen declarations

The audit's `AUD-19` (stale constant) and `AUD-20` (wrong denial reason) were confirmed and
corrected. All changes are documentation/declaration accuracy only; **no production behavior,
fail-closed contract, or authority check was modified**.

| Location | Stale declaration (before) | Corrected statement (after) |
| --- | --- | --- |
| `packages/subject-core/src/commit/writer-authority-membrane.ts` | "registry at ZERO entries … no runtime path can lawfully reach the issuer … `PRODUCTION_NON_NULL_GOVERNED_WRITER_AUTHORITY_WITH_FEATURE_COUNT_ZERO = ZERO`" | explicit two-track block: storage-write admission = 1, decision admission = 0, and a production governed write for the one admitted feature carries non-null `writer_authority`; ordinary and unadmitted targets stay null |
| `packages/runtime/src/authority/historical-writer-authority-registry.ts` | `PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0 = "NONE"` | `= "STORAGE_ADMITTED_FEATURE_ONLY"` with the two-track doc |
| `packages/runtime/src/transitions/relationship/relationship-governed-write-authority-service.ts` | "There is still NO product governed-write path … ordinary production V2 commits keep writer_authority = null"; capability "UNREACHABLE from any product path" | accurate: internal service, caller never supplies the value, production ingestion lawfully reaches it for the one feature |
| `packages/runtime/src/transitions/relationship/relationship-feature-decision-semantics.ts` (`AUD-20`) | denial `reason: "UNREGISTERED_FEATURE"` even for the registered feature | closed reason vocabulary: `UNREGISTERED_FEATURE` vs `NO_TYPED_ACTION_RELATION`; verdict still always `NOT_DECISION_ADMISSIBLE` |
| test titles / comments in `historical-writer-authority-registry.test.ts`, `relationship-governed-write-authority.test.ts`, `writer-authority-membrane.test.ts` | "feature count stays ZERO", "features 0", "REAL_PRODUCTION_GOVERNED_WRITER_ROUNDTRIP = DEFERRED (feature count 0)" | accurate wording; new assertions pin storage admission = 1 and decision admission = 0 |

## 3. TASK 2 — forked-history adversarial negative test

`packages/runtime/src/authority/relationship-governed-forked-history.test.ts` (7 checks).

ONE genesis, TWO histories, each produced by the REAL production pipeline (facade → engine →
store; each branch's governed familiarity authority produced by the REAL experience-ingestion
workflow), both branches carrying a lawful resolvable governed authority over divergent commit
refs and state hashes. No production bypass was added.

Proven fail-closed: each branch is individually chain-VALID yet a fork cannot mint a
trusted-history capability against the canonical head (`HEAD_MISMATCH`); a boundary minted for
one branch cannot validate the other's bundles (`TRUSTED_HEAD_MISMATCH`, both directions); a
capability cannot read the other branch's governed authority (`UNTRUSTED_CAPABILITY`, both
directions, plus structural clone); the governed writer DENIES cross-branch evaluation
(`UNTRUSTED_HISTORY`, both directions); a predecessor-absent target over canonical governed
history is rejected (`INITIALIZE_WITH_LINEAGE`) while the same shape on a lineage-free
counterpart still initializes; a truncated prefix is not a shorter canonical history
(`TRUNCATED_HISTORY` / `CHAIN_INVALID`).

Documented residual boundary (pre-existing, unchanged, reported by the audit as
"trusted caller only"): the lookup admits the caller-supplied array and re-binds it to the
capability's frozen head only once a matching authority candidate is found. The suite proves
the enforced fork rejection and does not claim a forged-array guarantee the architecture does
not make. See §6.

## 4. TASK 3 — cross-domain numeric mixing negative test

`packages/runtime/src/transitions/cognition-action/cross-domain-numeric-mixing-boundary.test.ts`
(8 checks). Uses ONLY the pre-existing default-deny mechanism — no new framework was created.

Covers belief credence/stance, affect numeric state and relationship familiarity: the three
domains genuinely collide numerically (`[0,1]` and `[-1,1]` families) and every cross-domain
operation is `DENY` for every pairing, arity and the fusion operations specifically
(`ADD`/`SUBTRACT_CANCEL`/`MEAN`/`MAX`/`APPLY_SHARED_THRESHOLD`). A structurally VALID
comparability contract confers no authorization, and widening `unlisted_operation_policy` to
`ALLOW` is rejected. The familiarity contract forbids numeric mapping, cross-feature
comparability, aggregation and normalization, and tampering any of those literals is rejected
by validation. Familiarity is not trust: the contract carries no trust/liking/quality field,
and a numeric familiarity value authorizes no operation (decision admission stays closed).
No generic blend/fuse/mix/weight/average helper exists on the surface.

## 5. TASK 4 — seed trust boundary minimal hardening

Documented in [`SEED_TRUST_BOUNDARY.md`](./SEED_TRUST_BOUNDARY.md).
`packages/subject-core/src/commit/seed-provenance-boundary.test.ts` (7 checks).

`SEED IS A TRUSTED FIXTURE / INITIALIZATION BOUNDARY — NOT LIVED HISTORY` is now stated on
`seedCommittedBundle`, `seedSnapshots`, `seedBundles` and
`createInMemorySubjectCoreFacadeForExplicitV4V0`, with the explicit frozen invariant that
seeded governed `relationship_core_*` state must not be presented as causal evidence that the
governed writer produced it (`SEED_WRITER_AUTHORITY_POLICY_V0 = MUST_BE_NULL`). The low-cost
read-only `observeSeededGovernedRelationshipStateV0` makes the invariant checkable using the
existing exact-prefix classifier; it mints nothing, grants nothing and carries no numeric
field. No authority subsystem was created, the seed was not rerouted into the production
writer, and no research experiment or fixture changed.

## 6. TASK 5 — cross-domain authorization decision

Recorded in [`CROSS_DOMAIN_AUTHORIZATION_DECISION.md`](./CROSS_DOMAIN_AUTHORIZATION_DECISION.md).
Pinned by `packages/personality/src/engineering-baseline-cross-domain-exemption.test.ts` (5 checks).

**Verdict: B — the `EVIDENCE_SCALE × mean_activation` transfer is authorized only by
module-header prose (`ENGINEERING_BASELINE` / `ENGINEERING_REFERENCE_V0`), not by a formal
comparability contract.** Decision: it is a **local explicit semantic authorization**, now
recorded formally and pinned by tests. No registry entry was added, because
`TendencyComparabilityContractV0` authorizes operations BETWEEN participant tendency scales
from the closed operation vocabulary, and this transfer is a bounded scalar→delta engineering
mapping — forcing it in would require inventing scales and registrations the frozen
architecture does not have. The tests pin the frozen constants, the non-widenable bound, the
bounded movement (including saturation and a caller-widened `evidence_scale`), that every
cross-domain operation still denies, and that the magnitude never becomes another domain's
value.

## 7. Verification

| Gate | Result |
| --- | --- |
| Targeted tests (15 files: writer authority, history/chain, restore, fork, cross-domain, familiarity, seed) | 171 passed |
| New fork-history negative test | 7 passed |
| New cross-domain negative tests (numeric mixing + exemption) | 8 + 5 passed |
| New seed-provenance test | 7 passed |
| `pnpm governance` | PASS (15 workspaces, 23 conformance test files) |
| `pnpm typecheck` | passed |
| `pnpm build` | passed (15/15) |
| `pnpm typecheck:auxiliary` | passed |
| `pnpm lint --max-warnings 0` | passed |
| `pnpm test` | see FINAL REPORT |
| `git diff --check` | clean |

## 8. What this slice did NOT do

No architecture redesign, no new Relationship feature, no familiarity re-admission, no
decision admission opened, no product work, no new V0.1/V0.2 infrastructure loop, no new
authority subsystem, no production semantic change, no experimental bypass.

## 9. Residual risks (carried forward, unchanged)

1. **Governed trusted-history lookup binds the terminal element only** (audit: "trusted caller
   only; no exploit path found"). A trusted internal caller that supplies a bundle array whose
   interior was replaced can make the lookup report `NO_MATCHING_AUTHORITY`; the capability
   itself is only mintable over a fully validated chain terminating at the exact current head,
   and the lookup is reachable only from trusted internal composition. Not changed in this
   slice (changing it is a behavior change outside this remediation's scope).
2. `previous_governed_authority` (prior `commit_ref` / `authority_payload_hash`) is
   shape-validated and lineage-kind-checked but not dereferenced against the chain by any
   consumer (same trusted-caller boundary).
3. Audit items still open and outside this slice: `AUD-06` (external-observation replay
   dedup), `AUD-07/08` (journal durability, `checkpoint_ref` verification), `AUD-11/12`
   (affect legend, one-turn affect lag), `AUD-16/21` (latent belief adaptation, absent
   personality), `AUD-10` (citeable-list divergence).
