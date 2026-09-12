# SYSTEM MAP — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

Reconstructed from code + runtime behavior at HEAD `442a5f5` (not from docs).
Every status is traceable to a production composition root or executor.

## Workspace shape

15 workspaces: `packages/{subject-core, memory, memory-influence, influence-evidence, appraisal,
affect, regulation, runtime, belief, personality, relationship, long-term-state-domain, behavior}`,
`product/{sandbox, web}`.

## One production turn (actual order, verified by `trace.mjs`)

```
submitUserText(text)
 1. advanceTime(interval_ticks)            -> Time transition: affect recovery + regulation pass-through
 2. completePendingLifecycleWork()         -> PRIOR pending event: Appraisal + AffectApplication
 3. admitFactualEvent + enqueuePending(PRIMARY)
 4. commitObservableContext + resolveWorkingEvidence
 5. respond()
      a. pre-cognition Appraisal of CURRENT event  (canonical commit; may abstain)
      b. familiarity-priority retrieval -> (with the AUD-01 fix) selected refs join the projection
      c. factual memory evidence resolution -> PRIOR FACTUAL MEMORY
      d. cognition projection build (V2 on explicit-v4) + provider call
      e. directive: CLARIFY (host template) | REALIZE (Language provider call)
 6. completePendingLifecycleWork()         -> CURRENT event: Appraisal (already done) + AffectApplication
 7. recordDelivery(behavior)
 8. memory admission exactly once: prior-pending == null ? observation-sourced Learning
                                   : recordReply + BehaviorOutcomeFeedback
 9. adaptation: belief (wired, effect unreachable) | personality (DISABLED) | relationship familiarity (wired)
```

Load-bearing semantic: the current event's AffectApplication (step 6) happens **after** its own
cognition (step 5d). Cognition sees affect after time recovery and prior pending work, but before
the current event's impulse. See `trace.json`, finding AUD-12.

## Subsystem status

| Subsystem | Status | Evidence |
|---|---|---|
| Identity / genesis | ACTIVE | canonical v4 genesis + authoritative restore |
| Observation ingress (conversation) | ACTIVE | ingress ledger FIRST/REPLAY/CONFLICT |
| External structured observation | ACTIVE (product `/observe`) | `commitExternalObservation`; no appraisal/affect by design; no replay dedup (AUD-06) |
| Appraisal | ACTIVE | pre-cognition canonical INITIAL; exact-input reuse |
| Affect | ACTIVE | only live mutable non-Memory psychological state by default |
| Regulation | ACTIVE_BUT_CONSTANT | reference producer, zero dynamics |
| Memory / episodes | ACTIVE | feedback + observation-sourced Learning |
| Retrieval | ACTIVE_BUT_LIMITED | deterministic; semantic dimension effectively dead (AUD-14); trace channel dead (AUD-15) |
| Belief | LATENT (wiring ACTIVE, effect UNREACHABLE, data ABSENT) | no INSERT path; empty genesis (AUD-16) |
| Relationship familiarity | ACTIVE | product wires admission provider; counterpart hardcoded (AUD-18) |
| Personality / traits | ABSENT in product (machinery ACTIVE only with a supplied prior) | no genesis prior, no semantic provider (AUD-21) |
| Cognition | ACTIVE | ConversationCognitionProviderV1, strict validation |
| current_intent / directive | ACTIVE | validated enum + free-form intent (never parsed into classification) |
| Language | ACTIVE | LanguageRealizationProviderV0, strict binding |
| ActionIntent / actions | ABSENT in product | `allowed_actions` empty every turn (`NO_ACTION`) |
| Learning / feedback | ACTIVE | one path per turn; idempotency caveats AUD-06/07/13 |
| Environment / time | ACTIVE | external environment state + explicit canonical ticks |
| Persistence / commit chain | ACTIVE / MECHANICALLY_VERIFIED | CAS, checksum, full chain replay |
| Restore | ACTIVE (rollback gate added by AUD-05) | EXACT round-trip in `trace.json` |
| Session / runtime orchestration | ACTIVE | `InteractiveSubjectRuntimeV0`, `LongHorizonSubjectSessionV0` |
| Provider layer | ACTIVE | Ollama native transport, temp 0, think false, shared num_ctx |
| Prompt projection | ACTIVE_BUT_LIMITED | V0/V1/V2; citeable-list divergence AUD-10; affect legend missing AUD-11 |
| Product web / CLI | ACTIVE | sandbox host + web server |

## Active vs latent summary

- Truly causal today: Memory, Appraisal, Affect, Regulation (constant), Language, Learning/feedback,
  persistence/restore, explicit time, environment/external observation.
- Wired but behaviorally inert: Belief adaptation (no INSERT), familiarity-retrieved-evidence before
  AUD-01, `recent_retrieval_trace`, V0 familiarity read projection.
- Dormant/absent in product: Personality adaptation, ActionIntent/actions, belief decision/arbitration.
