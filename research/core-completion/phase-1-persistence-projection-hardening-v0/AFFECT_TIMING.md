# AFFECT TIMING CONTRACT — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0 (AUD-12)

## Verdict

`AFFECT_LIFECYCLE_CHANGED = NO`

The current ordering is a deliberate, load-bearing design property of the production turn.
It is now explicitly FROZEN and documented. No lifecycle reorder was performed (the program
forbids silent reordering and no frozen requirement was found that contradicts it).

## Production turn order (verified by `trace.mjs`, not inferred from docs)

```
submitUserText(text)
 1. advanceTime(interval_ticks)          -> Time: affect recovery + regulation pass-through
 2. completePendingLifecycleWork()       -> PRIOR event: Appraisal + AffectApplication
 3. admitFactualEvent + enqueuePending   -> current event Observation
 4. commitObservableContext + resolveWorkingEvidence
 5. respond()
      a. pre-cognition Appraisal of the CURRENT event (canonical INITIAL; may abstain)
      b. familiarity-priority retrieval + factual-memory evidence resolution
      c. cognition projection build (V2) + provider call   <-- AFFECT IS READ HERE
      d. directive: CLARIFY (host template) | REALIZE (Language provider call)
 6. completePendingLifecycleWork()       -> CURRENT event: AffectApplication  <-- AFTER (c)
 7. recordDelivery(behavior)
 8. memory admission exactly once
 9. adaptation (belief wired/latent, personality disabled, relationship familiarity wired)
```

## Observable timing facts (from `TRACE.json`)

| Turn | affect before turn | affect visible to THIS turn's cognition | affect after this turn | affect visible to NEXT turn's cognition |
|---|---|---|---|---|
| 0 | `(0, 0.2)` | `(0, 0.2)` | `(0.126, 0.256)` | `(0.12516…, 0.25562…)` (after time recovery) |
| 1 | `(0.126, 0.256)` | `(0.12516…, 0.25562…)` | `(-0.1988, 0.3996)` | — (next turn; one-turn lag) |

Precise statement:

```
Affect_visible_to_Cognition(t)
    = recovery( Affect_after_turn(t-1) )          // time recovery already applied this turn
      ... and the current event's AffectApplication has NOT yet run

Affect_after_turn(t)
    = clamp( Affect_visible_to_Cognition(t) + impulse(appraisal_of_event(t)) )
```

The current event's own affective consequence therefore first reaches cognition on the
**following** turn. Consequences for experiment design:
- A same-turn affect swap experiment must supply the swapped state at the *pre-event* value;
  the current event's impulse will not appear until the next cognition call.
- Any design assuming "current event affect is visible to its own cognition" is
  mis-specified (this was the AUD-12 hazard).

## Contract status

FROZEN. Appraisal is pre-cognition by frozen design; `AffectApplication` for the current
event is post-cognition by frozen design. Documented here and in `FINDINGS.md`. Any future
change to this ordering is an architecture decision (GPT-6 gate) and was NOT made.
