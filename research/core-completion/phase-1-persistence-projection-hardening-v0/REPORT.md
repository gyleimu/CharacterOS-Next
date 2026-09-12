# REPORT — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0

Phase 1 of `CHARACTEROS_CORE_COMPLETION`. Program: `CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0`.

## Verdict

`CORE_PHASE_1_GREEN_WITH_DEFERRED_NONBLOCKERS`

All required Phase-1 targets (A–J) were resolved or formally classified. Five confirmed
defects were fixed with minimal patches and regressions (AUD-06, AUD-07, AUD-08, AUD-10,
AUD-11). Two targets are documented freezes (AUD-12 timing; retrieval dead channels).
Deferred items are non-blocking documentation/design nits that belong to later phases.

## Baseline → Final

| Baseline | Final |
|---|---|
| HEAD | `be722b6` | see chat report |
| Full suite | 183 files / 2340 tests | 184 files / 2350 passed, 3 skipped |
| Real model calls | 0 | 0 |

## Gates (final)

- `pnpm test`: PASS — 184 files passed, 1 skipped; 2350 tests passed, 3 skipped (exit 0)
- `pnpm typecheck`: PASS
- `pnpm typecheck:auxiliary`: fails with the PRE-EXISTING 3× TS2883 in
  `research/experiments/familiarity-causal-behavior-v1/preflight.ts` (identical to baseline;
  reproduced and attributed, unrelated to this slice, which adds no `research/**/*.ts`).
- `pnpm build`: PASS (14/14 workspaces)
- `pnpm lint --max-warnings 0`: PASS (0 errors, 0 warnings)
- `pnpm governance`: PASS (15 workspaces, 21 conformance test files)
- `git diff --check`: clean

## Phase 1 scope

Persistence + projection hardening only. No new psychology, no new ontology, no new
personality/belief/relationship semantics, no lifecycle reorder.

## Explicitly deferred core-completion work

- Affect causal validation (`AFFECT_CAUSAL_COMPLETION_V0`) — Phase 2, not run.
- Relationship familiarity causal validation — Phase 3.
- Belief lived-evidence completion — Phase 4 (GPT-6 gate).
- Personality / Tendency completion — Phase 5 (GPT-6 gate).
- Cross-domain longitudinal subject experiment — Phase 6.
- Full CharacterOS vs baselines ablation — Phase 7.

## Model routing

DEEPSEEK WORK PERFORMED: repository exploration, defect verification, all patches,
regressions, deterministic traces, gates, this report.

GPT-6 ESCALATIONS: **0**. No new ontology or semantic decision was required; every fix
resolved against semantics already frozen in code (CanonicalAffectV0 ranges, existing
transition identity/journal laws) or explicitly specified by the program (§13/§24).

GPT-5.6 SOL ESCALATIONS: **0**. Implementation was straightforward and stayed within
existing authority patterns (canonical-history resolution, journal rebuild, content-addressed
verification). No new authority primitive was invented.

## Defects fixed

### AUD-11 — canonical affect legend
See `AFFECT_PROJECTION.md`. One shared constant rendered on both V2 surfaces with the exact
frozen ranges; no named emotions, no directives.

### AUD-10 — citeable list vs validator
The conversation renderer now derives its CITEABLE CONTEXT REFS from `allowedEvidenceSet`,
the same executable authority the validator enforces. The subset-tolerant assertion was
replaced with exact equality.

### AUD-06 — external observation replay
FIRST/REPLAY/CONFLICT now enforced at the session authority from canonical committed
history; durable across restore; CONFLICT fails closed. See `EXTERNAL_OBSERVATION_REPLAY.md`.

### AUD-07 — journal durability
`restoreFromDurableState` rebuilds the transition-identity journal from committed bundles.

### AUD-08 — checkpoint_ref verification
One derivation authority + fail-closed verification before any state rebuild; `created_at`
remains observational. The product environment host derives a self-consistent ref for its
reconstructed checkpoint and verifies the persisted sidecar.

## Affect numeric legend (final model-facing semantics)

```
[affect (canonical)] valence=<value> activation=<value>
[affect (canonical) legend] Canonical affect is a continuous internal state (not a named emotion, not a behavioral instruction). valence range [-1,1]: lower is more negative, 0 is neutral, higher is more positive. activation range [0,1]: lower is lower activation, higher is higher activation.
```

## Affect timing contract

`AFFECT_LIFECYCLE_CHANGED = NO`. Cognition sees the pre-current-event affect (after time
recovery and prior pending work); the current event's AffectApplication runs after its own
cognition, so its impulse first reaches cognition next turn. Frozen and documented
(`AFFECT_TIMING.md`).

## External observation contract

FIRST commits exactly one Observation + one lived episode; REPLAY returns the identical
transition id / episode ref and commits nothing; CONFLICT fails closed with no mutation.
Durable across a fresh-process restore.

## Transition identity durability

The journal is rebuilt from committed canonical bundles on restore; an already-consumed
transition resolves as its terminal result rather than as new. Only committed semantic
evidence is reconstructed — capabilities remain non-serializable.

## checkpoint_ref contract

`checkpoint_ref` binds `{session_id, subject_id, next_interaction_index,
completed_interactions, environment_state, durable}`; `created_at` is excluded. It is
verified fail-closed before any state is rebuilt.

## Restore authority matrix / rollback / cross-subject

See `RESTORE_MATRIX.md`. Rollback rejection (AUD-05) and cross-subject binding (AUD-09)
remain green; no observational field was promoted to authority.

## Cognition projection consistency / citeable consistency / retrieval channels

See `FINDINGS.md` (`TARGET H/I/J`). One authority truth for citeability; the retrieval
`recent_retrieval_trace` and semantic anchor are classified
INTENTIONALLY_EMPTY/LEGACY and deferred without redesign.

## Recent audit fix regression

AUD-01, AUD-02, AUD-03, AUD-04, AUD-05, AUD-09 — all regression tests re-run green.

## Production semantic changes

No new psychological semantics. Behavioural deltas are integrity/projection only:
- the canonical affect line gains an interpretation legend (prompt bytes);
- the conversation prompt now declares the same citeable set the validator already enforced;
- external observation replay/conflict is now enforced at the primitive;
- restore now verifies `checkpoint_ref` and rebuilds the identity journal.

## Real end-to-end trace

`TRACE.json` (0 real model calls): two human turns with lawful affect change and exact
restore round-trip, plus external observation FIRST → REPLAY → CONFLICT → restore → REPLAY.
Every production cognition call carries the canonical line and the legend.

## Is Phase 2 Affect experiment now valid?

`YES`

The two blockers named by the audit are resolved: the affect line is now interpretable
(AUD-11) and the one-turn visibility lag is documented and frozen (AUD-12). A replicated
same-Memory swap experiment with k≥5 repeats is now well-specified, provided the design uses
the pre-event affect as the controlled variable and does not assume same-turn visibility.
No code blocker remains.

## Recommended next slice

`AFFECT_CAUSAL_COMPLETION_V0` (Phase 2), using the frozen timing contract.

## Gates

Full-suite and gate results are recorded in the final report section below.

## Final gate summary

See "Gates (final)" above.
