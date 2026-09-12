# BASELINE — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0

Captured before any change (worktree clean).

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD | `be722b63b6aa5c8b572df6bde6c8cd1a942dff0e` |
| Audit baseline | `research/audits/core-comprehensive-integrity-audit-v0/` (audit HEAD `442a5f5`) |
| Audit verdict | `CORE_GREEN_WITH_MINOR_DEFECTS` |
| Full suite | 183 files passed, 1 skipped; 2340 tests passed, 3 skipped (exit 0) |
| Typecheck (`tsc -p tsconfig.workspaces.json`) | passed (exit 0) |
| Governance | PASS (15 workspaces, 21 conformance test files) |
| Build | 14/14 workspaces |
| Auxiliary typecheck | pre-existing 3× TS2883 in `research/experiments/familiarity-causal-behavior-v1/preflight.ts` (unchanged) |
| Real model calls | 0 |

## Program-truth status at baseline (audit)

```
Memory        ACTIVE_CAUSAL
Affect        ACTIVE_CAUSAL, marginal value beyond Memory not yet proven
Relationship  familiarity active; behavioral causal value not proven
Belief        contracts + wiring exist; production effect latent
Personality   product behavior path absent
```

## Phase-1 findings carried in

Confirmed defects: AUD-06 (external observation replay duplicates experience), AUD-07
(identity journal not durable), AUD-08 (`checkpoint_ref` unverified), AUD-10 (citeable list
diverges from validator), AUD-11 (no affect numeric legend), AUD-12 (pre-event affect
visibility undocumented). Already-fixed in the audit slice and re-verified here: AUD-01,
AUD-02, AUD-03, AUD-04, AUD-05, AUD-09.
