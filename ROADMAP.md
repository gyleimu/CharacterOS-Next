# ROADMAP.md — CharacterOS-Next 路线图

Status: ACTIVE ROADMAP
Authority: 只记录历史里程碑与未来方向；当前实现、blocker 与下一 exact slice 以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为唯一权威。
Last verified against commit: `d4503cc6fd3f93d9e88b39d7aa365c8ef456b441`
Purpose: 保存阶段历史并定义未来工作的准入顺序，不复制实时状态。

## 1. 如何阅读本路线图

早期 `P0`–`P5+` 编号是仓库建立时的规划语言，不是当前实现状态机。实现已经依法越过旧文档所写的“P2.1 NOT STARTED”。本文件保留这些阶段作为历史，不用新的数字夸大进度，也不要求回退有效代码来匹配旧计划。

实时状态只在 `CURRENT_STATE.md` 更新。本文件仅在历史归档发生变化或未来路线改变时更新。

## 2. 历史阶段

| 历史阶段 | 原始意图 | 当前历史判定 |
|---|---|---|
| P0 / P0.5 | 架构基础与纠偏 | COMPLETE；形成 SubjectState ownership、transition、time、LLM boundary 与证据标签 |
| P1 | SubjectState、transition contracts、MICL formal design | COMPLETE；保留为架构历史 |
| P1.5 | A1–A13 engineering acceptance contract | COMPLETE；后续实现/测试已使用这些约束，但不等于所有未来 evaluation 已实现 |
| P2.0 | TypeScript/pnpm workspace 与 package-boundary bootstrap | COMPLETE |
| P2.1 Plan / Freeze | Subject Core 计划与 `FREEZE-G1`–`FREEZE-G11` contract freeze | COMPLETE；是历史 implementation contract，不是当前进度 |
| P2.1–P2.5 原计划 | Subject Core、Memory、MICL 与 minimal runtime | 原来的 “NOT STARTED” 已被后续实现与测试取代 |
| P3 原计划 | controlled legacy migration | 未作为一次 bulk migration 执行；任何未来迁移仍需单项来源与范围审查 |
| P4 原计划 | baselines、longitudinal、ablation、regression evaluation | 目录仍为 reserved/not implemented；实验目录中的专项验证不等同于完整 P4 infrastructure |
| P5+ 原计划 | product-evidence-triggered research | 不作为任意实验授权；新研究仍需明确问题、边界、批准与冻结协议 |

## 3. 已交付的实现里程碑

以下使用具体能力与 Git 历史，不再创造新的阶段编号：

- SubjectState schema、validation、canonical commit、trace/hash 与 restore authority；
- versioned Memory repository、retrieval、Experience encoding 与 Learning path；
- MICL runtime workflow 与 runtime composition；
- Appraisal、Canonical Affect、Time/Regulation reference producers；
- cognition provider、language realization 与 behavior delivery；
- behavior → Experience → Memory feedback；
- provider-readable factual Memory 与 durable life history；
- longitudinal multi-episode subject life；
- reusable long-horizon subject-session orchestration。

这些里程碑的当前成熟度与最新失败边界见 `CURRENT_STATE.md`，对应实验的允许结论见其冻结 report/contract。

## 4. Gate namespace

仓库历史上存在两个不同的 `G*` 命名空间。今后在 active 文档中必须写全名：

- `ROADMAP-G1`–`ROADMAP-G7`：早期路线图的阶段/研究门禁；
- `FREEZE-G1`–`FREEZE-G11`：`docs/implementation/p2-1-contract-freeze.md` 的机器级 Subject Core freeze gates。

历史冻结文档中的短名保持不变；不得为了消歧重写 frozen contracts 或 evidence。裸写 `G3`、`G6` 等不再允许出现在新的 active governance prose 中。

早期 `ROADMAP-G1`–`ROADMAP-G7` 的主题分别是：DEV_004/新 dynamics 实验限制、禁止 bulk migration、早期产品开发范围、long-lived-agency no-overclaim、baseline 声明和 acceptance-before-implementation。它们说明当时的治理背景，不构成“当前仓库仍无实现/实验”的事实陈述。仍适用的研究限制由 `RESEARCH_STATE.md` 表述，当前执行禁止项由 `NEXT_ACTIONS.md` 表述。

## 5. 未来路线

### Repository governance seal

对齐 live docs、package/command truth、dependency-boundary guard、CI 与 lint，并以完整本地 gates、clean diff、commit/push 结果封口。只有所有要求通过，`REPOSITORY_GOVERNANCE_AND_ENGINEERING_REALITY_ALIGNMENT_V0` 才可判定 GREEN。

### Provider output-budget diagnostic

治理 GREEN 后的下一 exact slice 是：

`SUBJECT_SESSION_PROVIDER_OUTPUT_BUDGET_DIAGNOSTIC_V0`

目标仅是定位长程累计上下文下的 provider truncated/invalid JSON；它不是新心理机制实验。治理 slice 内不得执行。

### Subject-session continuation

只有诊断给出可验证结果后，才决定是否恢复 `INTERACTIVE_SUBJECT_PRODUCT_RUNTIME_V0` 或进一步 long-horizon validation。不得把当前 6/8 partial run 当作产品扩张授权。

### Evaluation infrastructure

`evals/baselines`、`evals/longitudinal`、`evals/ablation` 与 `evals/regression` 保持 `RESERVED / NOT IMPLEMENTED`，直到一个具体 evaluation slice 定义 comparator、fixtures、metrics、claim boundary 与 cost。禁止用空目录或无意义 fixture 宣称 infrastructure 完成。

### Triggered research

新的研究必须来自具体产品/机制问题，并先声明可证伪命题、比较器、评价方法、外部效度边界、调用预算和批准点。repository-local pre-call freeze 不得称为外部 preregistration。未命中这些条件时，不自动开新实验线。

## 6. 路线变更原则

未来路线只能因以下事实改变：当前能力的新可执行证据、冻结实验的新结论、明确的产品需求、已批准的架构决策，或已证明的治理/工程缺口。单纯更新阶段编号、填充空目录或复述旧授权不构成进展。
