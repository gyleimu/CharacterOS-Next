# CharacterOS-Next

Status: ACTIVE ENTRY POINT
Authority: 项目介绍与使用入口；实时仓库状态以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `d4503cc6fd3f93d9e88b39d7aa365c8ef456b441`
Purpose: 解释项目、架构不变量、目录、研究证据边界与本地工程门禁。

CharacterOS-Next is a strict-ESM TypeScript/pnpm workspace for building and evaluating a long-lived artificial subject whose canonical state remains outside the language model. The repository combines reusable runtime packages, a sandbox composition, conformance tests, research harnesses, diagnostics, and immutable evidence from bounded experiments. It is an implemented research runtime, but not yet a production-mature long-lived agent.

## Current frontier

The repository already implements SubjectState/commit authority, Memory and retrieval, Appraisal, Canonical Affect, cognition and language providers, behavior-to-experience-to-memory feedback, persistence/restore, longitudinal episodes, and a reusable long-horizon subject session.

The latest real-provider session validation did **not** fully pass: it completed 6/8 interactions, preserved 6 durable Memory commits, and restored authority exactly at 2/2 boundaries, then failed closed at interaction 7 on deterministically reproduced truncated/invalid cognition JSON under accumulated context.

`SUBJECT_SESSION_PROVIDER_OUTPUT_BUDGET_DIAGNOSTIC_V0` is the next technical slice after repository-governance alignment is GREEN. It is paused during the governance repair. Exact maturity labels, gate counts, and blocker state live only in [`CURRENT_STATE.md`](CURRENT_STATE.md).

## Architectural invariants

1. `SubjectState` is canonical; core transition/commit authority is its only write boundary.
2. `MemoryState` belongs to the subject. A `MemoryRepository` is storage infrastructure, not a second subject-state authority.
3. Time may change valid state without an external observation.
4. An interaction need not produce an external action.
5. Model output is an untrusted proposal until deterministic validation; the model cannot directly mutate canonical state.
6. Retrieval and Appraisal precede Canonical Affect application on the relevant observation path.
7. FAST+EMA is a bounded reference persistence mechanism and research baseline, not a canonical emotion theory.

The detailed contract remains in [`ARCHITECTURE.md`](ARCHITECTURE.md) and its referenced specifications. Current implementation takes precedence over stale phase prose; frozen evidence takes precedence over retrospective summaries of an experiment.

## Repository layout

- `packages/` — 13 reusable workspaces: `subject-core`, `runtime`, `memory`, `appraisal`, `affect`, `behavior`, `belief`, `relationship`, `regulation`, `personality`, `influence-evidence`, `memory-influence`, and `long-term-state-domain`.
- `product/sandbox/` — reference CLI composition boundary (`pnpm interactive`): reference product, developer and debug tool.
- `product/web/` — the fifteenth workspace: local visual product (`pnpm web`), a framework-free browser UI over a local Node backend that owns ONE persistent subject.
- `evals/conformance/` — active offline conformance and frozen-evidence regression tests.
- `evals/baselines/`, `evals/longitudinal/`, `evals/ablation/`, `evals/regression/` — reserved evaluation surfaces; currently not implemented.
- `research/experiments/` — tracked experiment harnesses, contracts, reports, and experiment-local frozen evidence.
- `research/diagnostics/` — tracked provider/environment diagnostics and their evidence.
- `research/README.md` — the research tree guide, the artifact-isolation law, and the prospective hypothesis registry.
- `research/appraisal/`, `research/emotion/`, `research/memory/`, `research/plasticity/`, `research/hypotheses/` — deliberately empty placeholders for future domain-research documents; the artifact-isolation law refuses additions there.
- `docs/architecture/` and `docs/implementation/` — architecture and historical implementation contracts.
- `docs/adr/` — prospective architecture-decision records; no retrospective ADR history is implied.
- `tmp/` — ignored local/generated state, never frozen evidence.

At the verified baseline the repository contains 14 workspaces. Exact current counts for TypeScript files, tests, experiments, and diagnostics live in [`CURRENT_STATE.md`](CURRENT_STATE.md); they are evidence of repository size, not scientific or production readiness.

## Research and evidence policy

Committed experiment/diagnostic evidence is a first-class repository asset and remains immutable after its run is frozen. New summaries may clarify the current interpretation but must not rewrite raw outputs or enlarge an experiment's allowed claim.

Most model-backed studies here are bounded engineering/research experiments. A repository-local Phase-A or pre-call freeze is not an external preregistration service; temperature zero without an exposed seed is not a universal determinism guarantee; a blinded same-model evaluator is not independent human ground truth; and statistical significance or cross-model/general-population validity is not implied unless a frozen contract explicitly establishes it. See [`RESEARCH_STATE.md`](RESEARCH_STATE.md).

## Local gates

Requirements are pinned in `package.json`, `.node-version`, and `pnpm-lock.yaml`. The ordered gate sequence is:

```text
pnpm install --frozen-lockfile
pnpm governance           # repository invariants: docs, package boundaries, gate wiring
pnpm typecheck            # cold, source-mapped workspace typecheck
pnpm build                # all workspaces
pnpm typecheck:auxiliary  # evals/research/root tooling, against built workspace roots
pnpm lint                 # eslint --max-warnings 0
pnpm test                 # vitest run
```

`pnpm verify` runs that whole sequence in order, and `pnpm governance` fails if either `pnpm verify` or `.github/workflows/ci.yml` omits a gate or reorders it. `pnpm typecheck` must pass on a tree with no `dist/` output — the cold-start property that `scripts/cold-typecheck-regression.ps1` protects — while `pnpm typecheck:auxiliary` resolves built workspace roots and therefore runs after `pnpm build`. Current pass/fail state for every gate is recorded in [`CURRENT_STATE.md`](CURRENT_STATE.md).

## Document authority

- [`CURRENT_STATE.md`](CURRENT_STATE.md) — current repository truth, blocker, and next slice.
- [`ROADMAP.md`](ROADMAP.md) — historical milestones and future direction.
- [`NEXT_ACTIONS.md`](NEXT_ACTIONS.md) — immediate execution boundary only.
- [`RESEARCH_STATE.md`](RESEARCH_STATE.md) — current research claims, limitations, and open questions.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture and dependency intent.
- [`MIGRATION_MAP.md`](MIGRATION_MAP.md) — historical migration classifications; not current-state authority.

Historical P0/P1/P2 planning documents remain audit records. Their pre-implementation status language describes an earlier repository moment and does not override current code, tests, Git history, or frozen evidence.

## License

No public license is currently declared. Choosing one is a user/legal decision and is outside this governance repair.
