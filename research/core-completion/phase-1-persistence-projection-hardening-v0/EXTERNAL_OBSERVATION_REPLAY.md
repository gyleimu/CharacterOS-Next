# EXTERNAL OBSERVATION REPLAY — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0 (AUD-06)

## Contract

An external structured observation has a stable identity (`observation_id`). Its
FIRST/REPLAY/CONFLICT semantics are now enforced by the SESSION AUTHORITY itself, resolved
from authoritative canonical committed history:

| Case | Condition | Result |
|---|---|---|
| FIRST | no committed Observation for the identity | commit Observation → Experience/Memory as before |
| REPLAY | same identity, SAME content fingerprint | return the SAME transition id / observation ref / episode ref; commit nothing |
| CONFLICT | same identity, DIFFERENT content fingerprint | typed fail-closed error (`EXTERNAL_OBSERVATION_CONFLICT`); no mutation |

Identity is **not** a parallel ledger and not process-local: the prior observation is found
in the committed canonical bundles, and its fingerprint is recomputed from the committed
payload. This is exactly what authoritative restore rebuilds, so the contract is durable
across process death.

The frozen transition-id law (which binds `expected_state_revision`) is UNCHANGED: the gate
runs before any proposal or commit.

Content fingerprint covers: `observation_id`, sorted `source_refs`, sorted `external_refs`,
sorted `entity_refs`, `scene`, `task`, sorted `focus_refs`, sorted `environment_refs`.
`declared_salience` is deliberately excluded (it is a Learning parameter; a replay never
re-encodes).

## Results (deterministic, 0 real model calls)

Session-authority regression (`external-observation-replay.test.ts`) and end-to-end trace
(`TRACE.json`):

| Check | Result |
|---|---|
| FIRST commits one Observation + one lived episode | PASS (`t-obs-9e112e2f…`, `episode:aca5dbab…`, 2 bundles) |
| REPLAY returns identical transition id and episode ref | PASS |
| REPLAY creates no new bundle (and no new episode) | PASS |
| CONFLICT (same identity, changed scene) fails closed | PASS (`ExternalObservationReplayConflictErrorV0`) |
| CONFLICT mutates nothing | PASS |
| REPLAY after a fresh-process restore (`restoreFromDurableState`) | PASS (identical refs, +0 bundles) |
| REPLAY after restore with changed content still CONFLICTs | PASS |

## Product layer

`product/sandbox/src/external-observation-ingress.ts` already derived FIRST/REPLAY/CONFLICT
from canonical history for the product `/observe` path (across-revision replay, concurrent
writer resolution). That behaviour is unchanged; the runtime primitive is now independently
safe for any direct caller, closing the confirmed AUD-06 defect where the audit's adversarial
probe called the session authority directly and produced duplicate experience.
