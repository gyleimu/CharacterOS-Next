# PROTOCOL — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0

Phase 1 of `CHARACTEROS_CORE_COMPLETION`. Executor: DeepSeek V4.1 Flash (default).

## Scope

Remove known integrity / projection defects before any additional psychological causal
experiment. **No new psychology, no new ontology, no new personality/belief semantics.**

Targets (from the program §10–§20):

| Target | Finding | Disposition in this slice |
|---|---|---|
| A | AUD-11 affect numeric legend | FIXED (prompt legend, shared constant) |
| B | AUD-12 pre-current-event affect | FROZEN + documented (no lifecycle change) |
| C | AUD-06 external observation replay | FIXED (durable canonical-history dedup at the session authority) |
| D | AUD-07 transition-identity journal durability | FIXED (journal rebuilt from committed bundles on restore) |
| E | AUD-08 `checkpoint_ref` verification | FIXED (fail-closed ref verification) |
| F | restore / subject binding re-audit | verified + adverse matrix; new fail-closed guards tested |
| G | verify six prior fixes | verified via their regression tests |
| H | projection consistency | verified after the legend patch |
| I | AUD-10 citeable list vs validator | FIXED (one authority: `allowedEvidenceSet`) |
| J | dead retrieval channels | CLASSIFIED / DEFERRED (documentation only) |

Out of scope by program instruction: Belief completion (Phase 4), Personality/Tendency
(Phase 5), Relationship expansion (only familiarity), the Affect causal experiment
(Phase 2), the longitudinal/final ablations (Phases 6–7).

## Method

1. Freeze baseline (HEAD, clean worktree, full gates).
2. Read the audit artifacts and re-verify each finding against current code (do not trust
   the report).
3. Fix only confirmed defects; each fix is minimal, root-caused, contract-referenced, and
   carries a regression test.
4. Produce a deterministic end-to-end trace (`trace.mjs` → `TRACE.json`, 0 real model calls).
5. Re-run all gates.

## Escalation rule

GPT-6 / GPT-5.6 Sol are not directly invocable from this environment. Per the program §4/§5,
any design portion that genuinely required a new semantic decision would STOP and emit a
handoff prompt. No such gate was hit: every Phase-1 item resolves against semantics already
frozen in code or explicitly specified by the program (§13/§24).

## Change discipline

Baseline frozen first; no cleanup refactors, no renames, no formatting churn. Each fix lists
root cause, violated contract, minimal patch, and regression.
