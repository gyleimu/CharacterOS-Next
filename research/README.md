# research/ — tracked research assets

Everything under `research/` is a tracked research asset. Nothing here is a
production dependency, and nothing here authorizes product change.

- `research/experiments/` — experiment harnesses, contracts, reports, and experiment-local frozen evidence.
- `research/diagnostics/` — provider/environment diagnostics and their evidence.
- `research/appraisal/`, `research/emotion/`, `research/memory/`, `research/plasticity/`, `research/hypotheses/` — deliberately empty placeholders (tracked `.gitkeep` only). They are reserved homes for future domain-research documents, not implemented research lines.

## Frozen evidence and the artifact-isolation law

An experiment's evidence is immutable once its run is frozen. Four conformance
suites enforce that mechanically as a durable law:

- `evals/conformance/affect-state-retention-e1.test.ts`
- `evals/conformance/affect-activation-mapping-e2a.test.ts`
- `evals/conformance/affect-production-shaped-e2.test.ts`
- `evals/conformance/familiarity-causal-behavior-v1.test.ts`

The law refuses any baseline-relative modification or deletion of files under
`*/evidence/`, and it refuses *any* addition, modification, or deletion inside
the placeholder directories `research/diagnostics/`, `research/hypotheses/`,
`research/emotion/`, `research/memory/`, `research/plasticity/`, and
`research/appraisal/`. This file — and not a file inside one of those
directories — therefore carries the hypothesis-registration policy below.

That law also means a frozen experiment is never edited to satisfy a newer
tooling gate. `research/experiments/familiarity-causal-behavior-v0/` is frozen
against an earlier production cognition-projection surface and no longer
typechecks against the current one; it is excluded from
`tsconfig.auxiliary.json` rather than repaired, and it still runs for real
under vitest. Reconciling frozen experiments with production type evolution is
an open research-infrastructure decision.

## Hypothesis registry

**Status: ACTIVE REGISTRY / NO REGISTERED ENTRIES**

Historical hypotheses recorded within `research/experiments/` remain
experiment-local frozen records. This registry does not restate, migrate, or
revise them. New hypotheses should be registered here.

Each new entry must provide:

- a stable identifier and title;
- a falsifiable proposition;
- explicit falsification conditions;
- the conditions that trigger testing or retesting;
- the applicable comparator or baseline; and
- its evidence status and links to any authorized protocol or evidence.

Adding an entry records a hypothesis; it does not authorize an experiment and
does not establish a verified result.
