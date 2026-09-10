# Engineering conformance and evidence regression

**Status:** ACTIVE
**Verified baseline:** `d4503cc6fd3f93d9e88b39d7aa365c8ef456b441`

This directory contains executable offline Vitest gates, not a future-only skeleton. The verified baseline `d4503cc` carried 18 tracked `*.test.ts` files; the repository-governance realignment adds a 19th, `eslint-workspace-package-boundaries.test.ts`, which asserts that the ESLint package-boundary configuration rejects unauthorized workspace imports and still allows each package's declared dependencies. Those 19 files contain 182 direct `it(...)` declarations plus three `it.each(...)` declarations (8 parameterized rows in total).

The tests currently cover a mixture of:

- production/runtime contract and integration behavior;
- Subject session, Memory, restore, provider-input and authority invariants;
- Canonical Affect, cognition, language and behavior pathway checks;
- experiment-plan, evidence-integrity, denominator and claim-boundary regressions;
- honest preservation of failed, partial and supported frozen outcomes.

Examples include the long-horizon session, longitudinal multi-episode life, factual-memory provider surface, familiarity, affect retention/application, action-selection, language behavior, and behavior-to-Experience-to-Memory chain.

These tests make zero real model calls and may validate already committed evidence. Passing them does not itself establish scientific efficacy, production readiness, statistical significance, or complete coverage of every A1–A13 requirement. The normative acceptance design remains in `docs/evaluation/p1-5-engineering-acceptance-contract.md`; exact current repository totals and gate state live in `CURRENT_STATE.md`.

The other evaluation surfaces are distinct and currently reserved:

- `evals/baselines/`;
- `evals/longitudinal/`;
- `evals/ablation/`;
- `evals/regression/`.

Do not move experiment-local frozen evidence here merely to populate those directories.
