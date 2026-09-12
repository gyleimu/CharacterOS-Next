# PERSISTENCE AUDIT — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

## Commit chain (SOUND)

`producer → issuer-minted capability verdict → reservation (identity/fingerprint/binding) → authorization-set
equality → commit engine (subject/revision guards, time resolution, composition) → repository binding +
memory-adoption gate → whole-state validation → reserved-write guard/token → bundle assembly → pre-CAS closed
validation → single CAS on state revision → chain validator on restore`.

Verified sound: forged producer capability blocked (WeakSet verifier), proposal cannot be swapped after
reservation, prepared binding bound to reserved identity, stale revision rejected, single CAS (no partial
write / last-write-wins), bundle checksum + commit_ref recomputed from unknown input, full chain replay on
restore (continuity, logical-time law, duplicate detection, repository-binding coherence), authoritative
restore revalidates genesis/envelope/boundary/terminal snapshot.

## Findings

| ID | Severity | Status | Issue |
|---|---|---|---|
| AUD-05 | P3 | FIXED | Stale/rolled-back store accepted on restore (silent canonical rollback). Confirmed by `adversarial.json` (durable revision 15, restored 6); now gated on durable head/revision |
| AUD-06 | P3 | REPORTED | External observation replay duplicates experience (identical observation_id → 2 distinct episodes). Confirmed by `adversarial.json` |
| AUD-07 | P3 | REPORTED | Identity journal not persisted → transition-id idempotency not durable across restart; no live misuse found |
| AUD-08 | P3 | REPORTED | `checkpoint_ref` computed but never verified on restore; environment/ledger state trusted |
| AUD-09 | P3 | FIXED | Long-horizon restore did not bind checkpoint subject to configured subject |
| AUD-13 | P3 | REPORTED | Generic Learning idempotency revision-bound, not event-addressed |
| AUD-22 | P6 | REPORTED | `durable.identity.affect` never verified; zero-tick reporting only |

## Restore round-trip (verified)

`trace.json`: JSON round-trip + fresh-process-style restore gives origin `SUBJECT_RESTORED`, equal
`state_revision`, equal `repository_revision`, equal affect (valence/activation), empty Belief/Relationship/
Personality, constant regulation, and a working subsequent turn. The previous ablation's `reattest.json`
independently proved byte-identical cognition requests after snapshot → fresh restore.

## Temporal (SOUND)

Logical time derives only from ticks/occurrence (`deriveRuntimeMetadata`); Time requires ticks ≥ 1 and
non-Time transitions require advance 0; chain validator enforces the branch. Affect recovery runs once per
positive interval. Wall clock appears only in non-canonical `created_at`/`saved_at` and transport metadata.

## Observation / environment

- Conversation ingress FIRST/REPLAY/CONFLICT is tamper-evident and re-derives refs on restore — SOUND.
- External structured observation deliberately bypasses the conversation ingress ledger and has no
  replay dedup — AUD-06.
- Human, environment and external-observation contexts write to the SAME canonical repository/revision
  lineage (no hidden fork). An environment/external episode is retrievable into human-context cognition with
  no channel label beyond scene/refs — a real confound surface for experiments, by design.

## Cross-subject

- Per-subject store head and per-subject facade; no module-level subject-keyed mutable cache found.
- Retrieval itself has no subject filter (episodes carry no subject_id); isolation relies on one repository
  per subject (AUD: design assumption, not enforced).
