# RESTORE AUTHORITY MATRIX — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0

Expected outcome is classified BEFORE running; each row maps to the test that enforces it.

| # | Scenario | Expected | Where enforced | Test |
|---|---|---|---|---|
| 1 | Valid exact restore (checkpoint + same store) | ACCEPT | full chain replay + binding gates | `subject-session-v0.test.ts` §51.6/§51.7; `restore-rollback.test.ts` (faithful) |
| 2 | Older store / rolled-back head | REJECT | AUD-05 gate: restored revision/commit must equal checkpoint identity | `restore-rollback.test.ts` |
| 3 | Future / mismatched checkpoint | REJECT | AUD-08 `checkpoint_ref` re-derivation | `subject-session-v0.test.ts` (tampered body) |
| 4 | Wrong subject checkpoint | REJECT | AUD-09 subject guard (after ref verification) | `subject-session-v0.test.ts` (different subject) |
| 5 | Modified checkpoint state | REJECT | AUD-08 `checkpoint_ref` mismatch | `subject-session-v0.test.ts` (tampered `environment_state`) |
| 6 | Same valid commit, changed observational metadata (`created_at`) | ACCEPT | `created_at` excluded from the hashed body | `subject-session-v0.test.ts` (retimestamped) |
| 7 | Missing optional observational copy (legacy snapshot with no optional key) | ACCEPT | body and ref agree; optional infrastructure state defaults empty | `subject-session-v0.test.ts` (legacy key-less checkpoint) |
| 8 | Forked / truncated / divergent commit lineage | REJECT | chain validator: `TRUNCATED_HISTORY` / `INVALID_CHAIN`, envelope/terminal binding | `restore-chain-authority.test.ts` (truncated history; envelope mismatch negatives) |
| 9 | Replayed external observation after restart | REPLAY (+0), no duplicate experience | AUD-06 canonical-history gate | `external-observation-replay.test.ts`; `TRACE.json` |
| 10 | Same external identity, changed payload after restart | CONFLICT (fail closed) | AUD-06 fingerprint mismatch | `external-observation-replay.test.ts`; `TRACE.json` |
| 11 | Tampered persisted environment sidecar | REJECT | sidecar `checkpoint_ref` verification | `environment-subject-host.ts` guard; environment continuity tests |
| 12 | Already-consumed transition re-offered at the same revision after restart | terminal result, not new | AUD-07 journal rebuilt from committed bundles | `journal.test.ts` (rebuild test) |

## Authority classification preserved (program §28)

- AUTHORITATIVE: canonical bundle state, revision/commit head, ledger states, genesis
  envelope, belief/personality infrastructure state.
- BINDING: `identity.state_revision`, `identity.subject_head.commit_ref`, and now
  `checkpoint_ref`.
- OBSERVATIONAL (NOT promoted): `identity.subject_state_hash`, `identity.repository_revision`,
  `identity.logical_time`, `identity.affect`, `identity.episode_refs`, `created_at`.

No observational field was silently promoted to authority (avoids split-brain authority).

## Rollback protection

Restore rejects a supplied store whose head is older or different from the checkpoint's
recorded head (AUD-05), verified still green. `checkpoint_ref` verification now runs first,
so a stale/tampered checkpoint is rejected before any state is read.

## Cross-subject protection

`restoreFromSource` rejects a checkpoint whose `subject_id` differs from the configured
subject (AUD-09). Because `subject_id` is part of the hashed body, a cross-subject checkpoint
still verifies its own ref first and then fails the subject binding — preserving both gates
without merging them.
