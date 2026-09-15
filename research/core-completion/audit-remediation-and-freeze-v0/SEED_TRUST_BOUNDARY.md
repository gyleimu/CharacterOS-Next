# SEED_TRUST_BOUNDARY — TASK 4

`AUDIT_REMEDIATION_AND_FREEZE_V0`. Minimal hardening of the seed surface.
**Real model calls: 0. Production semantic changes: NONE.**

Baseline HEAD: `ae0a6bf1b1b9d3ae7d4f9a5dcf608ce8d0e8dd91` (`main`, clean).

---

## The seed surface (independently confirmed)

| Surface | Location | Behavior |
| --- | --- | --- |
| `seedCommittedBundle(bundle)` | `packages/subject-core/src/commit/store.ts:78` | pushes a bundle into the committed list and sets the subject head **without CAS** |
| `InMemoryFacadeOptions.seedSnapshots` | `packages/subject-core/src/commit/reference.ts:43` | read verbatim by `stateReader.readCurrentSnapshot` when no bundle exists |
| `InMemoryFacadeOptions.seedBundles` | `reference.ts:49` | each element passed to `seedCommittedBundle` before any new commit |
| `createInMemorySubjectCoreFacadeForExplicitV4V0` | `reference.ts:113` | the same internal assembly with the v4 state projection |

Confirmed properties:

- The seed path performs **no canonical validation**: a seeded snapshot is returned as-is by
  `readCurrentState`/`readCurrentSnapshot`. It is host-authored fixture data, not a
  production product.
- The seed path **never runs the production writer path**: no CAS, no governed-authority
  evaluation, no producer authorization.
- The seed path can therefore place a governed `relationship_core_*` value into canonical
  state that no governed writer ever produced.

The capability is **retained deliberately**: initialization and research depend on it.

## What was done (documentation + explicit invariant + tests)

The brief's preferred minimal option (A), plus the optional low-cost observation because one
could be added without expanding the architecture.

1. **Contract documentation** on every seed surface — `seedCommittedBundle`,
   `seedSnapshots`, `seedBundles`, `createInMemorySubjectCoreFacadeForExplicitV4V0` — stating
   `SEED IS A TRUSTED FIXTURE / INITIALIZATION BOUNDARY — NOT LIVED HISTORY` and its causal
   consequence.

2. **Explicit frozen invariant** in `reference.ts`:

   > Seeded governed `relationship_core_*` state MUST NOT be presented as causal evidence
   > that the governed familiarity writer produced it. Only a committed bundle carrying a
   > non-null `writer_authority` of family `RELATIONSHIP_GOVERNED_FEATURE` is that evidence,
   > and seeding never mints one (`SEED_WRITER_AUTHORITY_POLICY_V0 = MUST_BE_NULL`).

3. **Low-cost read-only observation** — `observeSeededGovernedRelationshipStateV0(input)` —
   that makes the invariant checkable. It reuses the EXISTING exact-prefix classifier
   `isReservedRelationshipCoreDimensionIdV0` (no second classifier, no fuzzy matching) and
   reports:

   - `provenance = TRUSTED_FIXTURE_SEED_BOUNDARY`
   - `causal_status = NOT_GOVERNED_WRITER_EVIDENCE`
   - `writer_authority_policy = MUST_BE_NULL`
   - the exact reserved `relationship_core_*` dimension ids present in the seeds
   - the count of seeded bundles carrying a non-null writer authority (contract violations)
   - the count of unreadable seed shapes, so an unreadable shape can never silently hide
     governed state behind a "nothing found" answer

   It is explicitly **not** an authority surface: pure, total, non-throwing, non-mutating,
   mints nothing, carries no capability and no numeric decision field.

## What was deliberately NOT done

- No new authority subsystem, no capability, no gate, no registry.
- The seed was **not** rerouted through the production writer — seeding remains a fixture
  boundary by design, which is precisely why it must stay marked rather than legitimized.
- No existing research experiment or fixture was modified; all seed-dependent suites still
  pass unchanged.

## Pinned by

`packages/subject-core/src/commit/seed-provenance-boundary.test.ts` (7 checks: no canonical
validation on the seed path; detection + exact provenance tagging; non-reserved state not
flagged; the observation is non-authoritative/non-numeric and pure; seeded governed state is
not governed-writer evidence while an authority-bearing seed is reported as a violation;
unreadable shapes counted; both v3 and explicit-v4 seeding still work).
