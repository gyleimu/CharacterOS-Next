# AUTHORITY TABLE — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

## Canonical state authority

| State | Creator | May update | Evidence required | Validated | Persisted | Restored | Projected to cognition | Host can write directly? | Stale can overwrite? | Invalid via restore? | Test-only bypass? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| identity | genesis (`createInteractiveSubjectSeedV0`) | genesis only | validated seed | `validateSubjectState` | canonical snapshot | authoritative head | yes (`[identity]`) | no | no (CAS) | no (hash-checked envelope) | no |
| logical_time | genesis + Time transition | Time transition | ticks ≥ 1 | runtime metadata law | canonical | from head | yes (`[current state]`) | no | no | no | no |
| state_revision | commit engine | every commit | single CAS | engine guards | canonical | from head | yes | no | no (CAS) | no | no |
| affect (valence/activation) | genesis + AffectApplicationExecutor | AffectApplication only | committed INITIAL appraisal + receipt | `CanonicalAffectV0` + history validator | canonical (+ observational copy in checkpoint identity) | from canonical head | yes (`[affect (canonical)]`) | no (needs verified history) | no | no | no |
| regulation | genesis + Time | Time | elapsed ticks ≥ 1 | `RegulatoryStateV0` [0,1] | canonical | from head | yes (`[regulation]`) | no | no | no | no |
| memory / episodes | LearningTransitionExecutor | append-only | trusted learning source | record payload hash + schema + membership | repository revisions | rebuilt in order | yes (`PRIOR FACTUAL MEMORY`) | no | no (revision-bound) | no | no |
| working_refs / recent_retrieval_trace | retrieval metadata producer | per turn | validated retrieval result | `validateMemoryRetrievalResult` | canonical | from head | yes | no | no | no |
| beliefs | genesis (empty) | BeliefTransitionExecutor | evidence-bound mutation proposal | schema + subject + evidence visibility | canonical | from head | yes (V2) | **yes via root-exported executor (AUD-17)** | no | no | no |
| relationships / familiarity | registration + governed ingestion | governed write only | epoch + trusted history + qualifying admission | governed-write authority + membrane | canonical | from head | yes | no (governed token) | no | no | no |
| traits_seed / personality | genesis prior (explicit only) | personality adaptation | semantic channel + plasticity | registry + closed values | canonical | from head | yes (V2) | no | no | no |
| environment state | environment module | environment observation | environment law | environment validators | checkpoint sidecar | `restoreState` (unverified ref, AUD-08) | no (separate context) | host-owned | n/a | n/a | no |
| current_intent / directive | cognition provider proposal | per turn (non-canonical output) | validated proposal vs projection hash | `validateCognitionProposal` + directive validator | not canonical | not restored | n/a | no | n/a | no |
| commit chain metadata | commit engine | every commit | bundle validation | checksum + commit_ref recompute + chain replay | canonical bundles | full chain replay | no | no | no | no |

## Durable-state field classification on restore

`SessionDurableStateV0` (capture `explicit-v4-session-authority-v0.ts:1267`; restore `:389`).

| Field | Classification | Notes |
|---|---|---|
| `genesis_envelope` | AUTHORITATIVE | hash-verified genesis; drives boundary minting |
| `store.revisions[]` | AUTHORITATIVE | revision ids recomputed; mismatch fails |
| `store.committed_bundles` | AUTHORITATIVE | full chain re-validated on restore |
| `delivery_ledger_state` | AUTHORITATIVE-INFRASTRUCTURE | re-derives id/hash on restore |
| `ingress_ledger_state` | AUTHORITATIVE-INFRASTRUCTURE | re-derives event refs |
| `belief_workflow_store_state` | AUTHORITATIVE-INFRASTRUCTURE (optional) | workflow idempotency |
| `personality_adaptation_state` | AUTHORITATIVE-INFRASTRUCTURE (optional) | adaptation idempotency |
| `identity.state_revision` | BINDING (after AUD-05) | was observational; now gates rollback |
| `identity.subject_head.commit_ref` | BINDING (after AUD-05) | was observational; now gates rollback |
| `identity.subject_state_hash` | OBSERVATIONAL | classification label only |
| `identity.repository_revision` | OBSERVATIONAL | classification label only |
| `identity.logical_time` | OBSERVATIONAL | never read |
| `identity.affect` | OBSERVATIONAL | zero-tick reporting only (AUD-22) |
| `identity.episode_refs` | OBSERVATIONAL | never read |
| TransitionIdentityJournal | ABSENT | not persisted (AUD-07) |
| repository adoption markers (`intents`) | ABSENT | recreated not-adopted (AUD-07 family) |

## Capability / clone matrix

| Capability | Admission | JSON/spread clone rejected | Externally mintable | Verdict |
|---|---|---|---|---|
| ProducerAuthorizationSetV1 | WeakSet + structural | yes | issuer exported but facade verifier is closure-private | SOUND |
| PreparedGovernedWriterAuthorityTokenV0 | WeakSet + structural | yes | no | SOUND |
| TrustedCanonicalHistoryBoundaryReceiptV0 | WeakSet | yes | no | SOUND |
| RelationshipGovernedTrustedHistoryCapabilityV0 | WeakSet | yes | mint needs admitted boundary + full chain + exact head | SOUND (lookup binds terminal only — AUD risk noted) |
| RelationshipPreparedAuthorityCapabilityV0 | WeakSet | yes | no | SOUND |
| TrustedLearningExperienceV0 / TrustedBehaviorOutcomeFeedbackV0 | WeakSet | yes | only via validator | SOUND |
| Belief semantic/plasticity results | WeakSet + shape | yes | only via exported runners | SOUND |
| Affect consumption status | **no opaque capability** | n/a | arbitrary reader injectable in composition | DESIGN WEAKNESS (trusted-composition only) |

Restore mints fresh authority each time; no pre-restart capability survives serialization.
