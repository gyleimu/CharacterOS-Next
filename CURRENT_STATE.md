# CURRENT_STATE.md — CharacterOS-Next 当前状态

Status: ACTIVE
Authority: 本文件是仓库“现在是什么、做到哪里、下一步是什么”的唯一实时状态入口。
Last verified against commit: `d4503cc6fd3f93d9e88b39d7aa365c8ef456b441`（修复前的干净 baseline；本治理修复是其直接子提交，表内数字在该子提交的 worktree 上实测）
Workspace projects: 14
Purpose: 记录可执行代码、当前测试与已提交冻结证据共同支持的最小事实；历史计划不能覆盖这些事实。
Verified date: 2026-09-10

> 权威顺序：当前可执行代码与测试 → 已提交冻结证据 → Git 历史 → 仍与实现一致的架构契约 → 项目状态叙述。README、ROADMAP、RESEARCH_STATE 与 NEXT_ACTIONS 不再各自维护一份完整阶段状态。

## 1. CharacterOS-Next 现在是什么

CharacterOS-Next 是一个 strict-ESM TypeScript/pnpm workspace，也是一套长期人工主体研究运行时。它已经包含可复用的 canonical state/commit authority、Memory、Retrieval、Appraisal、Canonical Affect、Cognition、Language、Experience/Learning、持久化恢复与 subject-session orchestration。

它仍是研究型工程系统，不是已经证明具备通用长期主体能力的生产产品。真实模型结果只在各冻结实验的模型、场景、样本与判据边界内成立。

## 2. 机器派生的仓库快照

以下数字为 2026-09-10 在本治理修复 worktree 上实测所得。reality baseline（修复前的干净提交，也是本文件的机械核对起点）是 `d4503cc`；发生变化的行同时标注修复前的值。

| 项目 | 事实 |
|---|---|
| Workspace | 13 个 `packages/*` 包 + `product/sandbox`，共 14 个 workspace |
| 可复用 TypeScript | `packages/` 与 `product/` 中 234 个 tracked non-test `.ts` 文件 |
| TypeScript 覆盖 | 496 个 tracked `.ts`；487 个被 typecheck project 覆盖，9 个为书面理由 exclusion，0 uncovered（拆分见 2.1） |
| 测试源码 | 140 个 tracked `.test.ts` / `.spec.ts` 文件（修复前 139） |
| 测试结果 | Vitest：136 files passed、1 skipped；1963 tests passed、3 skipped（修复前 135/1958） |
| Build | 14/14 workspace 通过 |
| Typecheck | workspace source project 14/14 通过；evals/research/root-tooling auxiliary project 通过 |
| Lint | `pnpm lint`（`--max-warnings 0`）0 errors、0 warnings（修复前 8 errors、1 warning） |
| CI | `.github/workflows/ci.yml` 存在且执行真实 gate 命令；本地逐条通过；远程 GitHub Actions 执行未在本地验证 |
| 研究资产 | 17 个 `research/experiments/*` 目录、4 个 `research/diagnostics/*` 目录 |
| 研究文件 | 993 个 tracked experiment files、192 个 tracked diagnostic files |
| LICENSE | 未声明；属于用户/法律决策，本次不代选 |

这些是仓库现实计数，不等于生产成熟度或科学效力。

### 2.1 工程门禁现实

- `pnpm verify` 按固定顺序执行全部本地 gate：`governance → typecheck → build → typecheck:auxiliary → lint → test`。CI 执行同一顺序，并由 `pnpm governance` 断言两者都不遗漏、不错序。
- `pnpm typecheck` 是 source-mapped workspace project，在**冷树**（无任何 `dist/`）上即可通过；这是 R2-K / ATTACK I 回归所保护的性质，`scripts/cold-typecheck-regression.ps1` 会先删除全部 workspace `dist`，再运行 `typecheck:workspaces` 验证它。
- `pnpm typecheck:auxiliary` 覆盖 evals/research/root tooling，并解析各 workspace 已构建的 `dist` 声明，因此**必须在 `pnpm build` 之后运行**；它不参与冷树保证。
- 修复前的 lint 债务包含一个真实缺陷：某 experiment CLI 存在未终止字符串，导致该文件解析失败，从而掩盖了同一文件内 30 处既有规则违规（修复该字符串后实测 38 errors）。该文件按仓库既有惯例（隔离 experiment harness 的文件级 `eslint-disable` 加书面理由）处理，其余违规为逐条真实修复。
- **唯一的 typecheck exclusion 是 contract conflict 的结果**：四个 conformance 套件（`affect-state-retention-e1`、`affect-activation-mapping-e2a`、`affect-production-shaped-e2`、`familiarity-causal-behavior-v1`）以 durable law 强制 `research/experiments/familiarity-causal-behavior-v0/` 下每个 Git blob 与其冻结 baseline 逐字节相同。该实验冻结于更早的 production cognition-projection 类型面，其 `adapter.ts` 已无法接受当前 `CognitiveContextProjection` union。修文件会破坏冻结 blob law，修 law 会修改冻结 contract，因此 `tsconfig.auxiliary.json` 以书面理由排除该实验及其 conformance test；它仍在 vitest 中真实运行。修复 frozen experiment 与 production 类型演进之间的关系是未决的 research-infrastructure 决策，不在本 slice 内。覆盖率拆分：`tsconfig.workspaces.json` 352 个（`packages/` 351 + `product/` 1），`tsconfig.auxiliary.json` 135 个（research 116、evals 18、`vitest.config.ts` 1），exclusion 9 个（该实验 8 个模块 + 1 个 conformance test；其 `contract.ts` 因被 v1 测试引用而仍在覆盖内）。
- 同一 durable law 也拒绝在 `research/diagnostics/`、`research/hypotheses/`、`research/emotion/`、`research/memory/`、`research/plasticity/`、`research/appraisal/` 这些只含 `.gitkeep` 的占位目录下新增文件。因此 hypothesis registry 位于 `research/README.md`，而不是 `research/hypotheses/README.md`。

## 3. 当前能力与成熟度

| 能力 | 当前判定 | 边界 |
|---|---|---|
| SubjectState 与 canonical commit authority | `IMPLEMENTED` / `MECHANICALLY_VERIFIED` | 单写入口、validation、hash/trace、atomic commit、restore 均有实现与测试 |
| Memory repository、revision 与 retrieval | `IMPLEMENTED` / `MECHANICALLY_VERIFIED` | 包含 durable revision、可验证引用、repository-backed retrieval 与 provider-readable factual-memory surface |
| Appraisal 与 Canonical Affect | `IMPLEMENTED` / `EXPERIMENTALLY_SUPPORTED` | 确定性校验与 reference affect path 已实现；不代表 canonical emotion theory 或心理学真实性 |
| Cognition provider pipeline | `IMPLEMENTED` | 模型只产生受校验 proposal，不能成为 canonical state authority |
| Language behavior | `IMPLEMENTED` / `PARTIALLY_VALIDATED` | current intent 到受校验 language behavior 的生产路径已接通；外部效度仍受模型与场景限制 |
| Behavior → Experience → Memory feedback | `IMPLEMENTED` / `EXPERIMENTALLY_SUPPORTED` | 已有冻结的端到端因果链证据；结论受对应实验契约约束 |
| Persistence、durable history 与 restore | `IMPLEMENTED` / `MECHANICALLY_VERIFIED` | 当前长程验证的两次 authority restore 均 exact |
| Longitudinal multi-episode life | `IMPLEMENTED` / `EXPERIMENTALLY_SUPPORTED` | 冻结的四 episode 验证支持多 episode retrieval 与一次 post-restore continuity；不是任意时长证明 |
| Long-horizon subject session orchestration | `IMPLEMENTED` / `PARTIAL` | 离线能力与测试存在；真实长程运行只完成 6/8，不能标为全面支持 |

`FROZEN` 描述已提交协议/证据的不可变性，不自动提升其结论等级。

## 4. 已冻结但有边界的最新结果

`LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0` 的真实运行结果：

- reusable session capability：`IMPLEMENTED`；
- offline deterministic tests：green；
- real-provider validation：第 7 次 interaction fail closed，完成 6/8；
- durable Memory commits：6；
- authoritative restores：2/2 `EXACT`；
- principal verdict：`LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED`；
- subordinate verdicts：Memory continuity 与 autonomous orchestration 均为 `PARTIAL`。

失败机制是累计 session context 下 cognition provider 返回确定性复现的截断/无效 JSON。失败证据被保留，不得把 6/8 改写为完整成功。

## 5. 当前 blocker 与暂停项

当前技术 blocker：

`deterministic cognition-provider truncated/invalid JSON under accumulated session context`

对应的下一项技术诊断是：

`SUBJECT_SESSION_PROVIDER_OUTPUT_BUDGET_DIAGNOSTIC_V0`

该诊断在 `REPOSITORY_GOVERNANCE_AND_ENGINEERING_REALITY_ALIGNMENT_V0` 期间明确暂停。治理修复只有在文档、工程门禁、CI、diff、commit/push 与 clean-worktree 验证全部封口后，才可判定 GREEN 并进入该诊断。

同时不得在本 slice 中继续 `INTERACTIVE_SUBJECT_PRODUCT_RUNTIME_V0`、扩张 autonomous session、修改冻结心理/语义架构，或启动新的模型实验。

## 6. 研究与证据现实

实验、诊断和其已提交 evidence 是本仓库的一等 tracked assets，主要位于：

- `research/experiments/**`；
- `research/diagnostics/**`；
- 各实验自己的 `evidence/**`。

不存在仓库根级 `evidence/`。`tmp/` 与生成中间物不属于冻结证据。历史 evidence 保持不可变；当前研究主张与方法限制由 `RESEARCH_STATE.md` 汇总，每个实验的精确允许结论仍以其冻结 contract/report 为准。

## 7. 文档职责

| 文档 | 唯一职责 |
|---|---|
| `CURRENT_STATE.md` | 当前仓库状态、成熟度、blocker 与下一项工作 |
| `README.md` | 项目入口、核心原则、目录和运行命令 |
| `ROADMAP.md` | 历史里程碑与未来路线，不复制实时阶段表 |
| `RESEARCH_STATE.md` | 当前研究主张、限制、失败与开放问题 |
| `NEXT_ACTIONS.md` | 当前 baseline、blocker、下一 exact slice、禁止项与升级条件 |
| `ARCHITECTURE.md` | 当前/目标架构与依赖边界；不承担进度播报 |

若这些文档对“当前实现到哪里”说法冲突，以本文件和可执行证据为准，并修正文档，不回退已验证实现。
