# HISTORY INTERNALIZATION — EVIDENCE GAP MAP (§28 / §29)

**`MODEL_CALLS_THIS_ROUND = 0`** · built from frozen D1–D4 artifacts plus the mechanical production audit
`evidence/v1/CURRENT_EXPERIENCE_INTERNALIZATION_PATHS.json`.

The table separates what is **already established** from what is **still missing**. A row is
`ALREADY_ESTABLISHED` only when a frozen artifact or a verified production law supports the *specific*
proposition named — not a neighbouring one.

| link | proposition | status | basis / what is missing |
| --- | --- | --- | --- |
| **1. Experience → State** | lived experience is recorded and offered to the adaptation chains each turn | `ALREADY_ESTABLISHED` (wiring) | `interactive-subject-runtime-v0.ts:633` records the observational experience; `:678-681` builds `beliefEpisodeRefs`; `:683-685` calls the adaptation. **Missing: no measured evidence that this MOVES credence.** |
| **2. Lived evidence → credence change** | lived evidence actually changes the canonical credence | **`STILL_MISSING`** | the chain is durable, write-once and idempotent (`belief-adaptation-wiring-v0.ts`) but its *effect size on credence* has never been measured. D1 established only that an **authored** credence difference is lawful and isolated. |
| **3. State persistence** | the resulting canonical state survives a session and is restored | `ALREADY_ESTABLISHED` (mechanism) | canonical `SubjectStateV4` commit authority, atomic bundles, fail-closed restore, durable adaptation store keyed one workflow id per (subject, evidence set). **Missing: never measured across a *lived* trajectory.** |
| **4. State → Cognition** | the canonical state is projected into the executor's context and is legible | `ALREADY_ESTABLISHED` | D2-A0 `CANONICAL_PROPOSITION_STANCE_BINDING_ESTABLISHED`, 6/6 both arms, on real production state (`CANONICAL_PROPOSITION_STANCE_BINDING`). |
| **5. State → Decision / Behavior** | a canonical state difference changes what the subject decides | **`STILL_MISSING` — and D1 is a measured null** | D1 `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` on a lawful isolated credence difference. Any v1 behaviour claim must be scoped against this. |
| **6. State intervention → Behavior change** | changing only the state changes the cognition/behaviour with history absent | **`STILL_MISSING`** | no intervention arm has ever been run. This is the strongest available causal control and has never been exercised. |
| **7. Restart persistence of the effect** | the effect survives process restart with history still absent | **`STILL_MISSING`** | restore is fail-closed and tested for *state fidelity*; the *behavioural* survival of an effect has never been tested. |
| **8. Cross-scenario generalization** | the state difference influences a **new** scenario, characters and topic | **`STILL_MISSING`** | every D1–D4 measurement reused its own fixed material; no generalization across scenario has been measured. |
| **9. Ablation** | resetting the target component removes the difference | **`STILL_MISSING`** | the natural ablation of the belief component has never been run. |
| **10. Baseline separation** | CharacterOS beats stateless (B0) and profile-summary (B1) in carrying the trajectory's effect | **`STILL_MISSING`** | no baseline comparison exists. |
| **— additional wired-but-unmeasured channels —** | | | |
| relationship familiarity | driven per turn (`:705`) | `CODE_WITHOUT_EXPERIMENTAL_EVIDENCE` | wiring verified; effect unmeasured. Phase 0 observed NO observable change (no counterpart registered → nothing to update against), which is not evidence about the chain |
| personality adaptation | factory optional and **unsupplied** in production (`explicit-v4-session-authority-v0.ts:597`) | `NOT_DRIVEN_IN_CURRENT_PRODUCTION` | the port is `null` — no experiment can be run on it without a production change, which is not authorised |
| affect application | **driven every turn through the appraisal / affect-application path inside the turn loop** | `DRIVEN_AND_OBSERVED_TO_MOVE_PER_TURN` | **CORRECTED by Phase 0.** The original row read `PRESENT_BUT_NOT_WIRED_TO_TURNS`, inferred from an *export-surface* fact (the executor is not exported from the runtime index) and a module-boundary fact. Neither implies the executor is not invoked. Phase 0 observed valence move from `{0, 0.2}` to `{1.0, 0.723}` (arm A) and `{0.407, 0.418}` (arm B). Out of Phase 0's scope, but the factual claim is fixed |

## The two gaps that decide whether v1 is worth running

**Gap 2 (does lived evidence move state at all?)** is a *precondition*. If lived evidence does not move
credence, no downstream measurement can be positive and the experiment must stop with
`HISTORY_INTERNALIZATION_V1_BLOCKED_BY_ARCHITECTURAL_GAP` rather than proceed to an expensive null.

**Gap 5 (state → decision is a measured null)** is a *scope limit*. v1 must therefore take its primary
observable at the **cognition** level — what the subject attends to, expects and says in a new scenario —
and treat decision/behaviour as a **secondary, explicitly pre-registered as at-risk-of-null** observable.
Designing v1 as if the D1 null did not exist would repeat a known null at greater cost.

## What this map does NOT license

Nothing above authorises a new mechanism. Every row that matters for v1 is a **measurement** gap on an
**already-wired** path, not a capability gap. Gaps on the personality and affect channels are recorded and
deliberately left out of v1's scope, because closing them would require production changes that this round
does not authorise.
