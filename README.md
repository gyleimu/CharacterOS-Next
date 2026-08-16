# CharacterOS-Next

**状态: DESIGN-ONLY（P1 FORMAL DESIGN）** — 本仓库当前包含架构宪法、正式规格（SubjectState V0 + transition contracts）、研究状态、路线图与迁移计划。**不含任何实现代码、不含任何实验资产、不包含任何从旧仓库复制的源码。**

CharacterOS-Next 是 CharacterOS 从"旧单项目 / 单研究线"升级为**长期人工主体（long-lived agent）总工程体系**的伞形仓库，统一承载：

- **core engine**（`packages/`：subject-core、memory、appraisal、affect、belief、personality、relationship、regulation、behavior、runtime）
- **research / experiments**（`research/`：仅假设与设计，当前禁止实验）
- **evaluation / benchmarks**（`evals/`：llm-prompt / fast-ema / characteros-v1 三组 baseline + longitudinal / ablation / regression）
- **product development**（`product/`：sandbox、prototypes）
- **architecture / docs / roadmap**（`docs/`：vision、theory、architecture、adr、roadmap）
- **legacy migration**（`archive/` + 根目录 `MIGRATION_MAP.md`：只写计划，不移动文件）

---

## 1. 最高约束（Constitution，不可被本仓库任何后续文档覆盖）

本仓库的一切设计与决策以**两个已完成审计**的结论为最高约束：

### 约束 A — CharacterOS 现有仓库审计结论（外部已完成审计，本仓库直接继承为给定输入）

> 旧 CharacterOS 是成熟的 deterministic psychological simulation kernel，不是废弃项目。其核心当前仍偏 event-centric state transition。
> 主要架构缺口（必须在新体系中修复）：
> 1. Event → Emotion → Interpretation 顺序错误，应转为 **Retrieval/Appraisal 后再 Affect**；
> 2. Emotion 不是 persistent state；
> 3. Life state 未完整跨 tick 持久化；
> 4. Behavior 未形成 **Action → World → Consequence → Experience** 闭环；
> 5. Memory retrieval 不够 autobiographical / context-sensitive；
> 6. Relationship 尚非一等长期状态；
> 7. Personality / trust / attachment / fear 等存在时间尺度混层。
>
> 旧仓库定位：legacy implementation + baseline + mechanism library + test/evaluation asset + migration source。

### 约束 B — CharacterOS Emotion 全路线审计结论（审计产物位于 `<external-audit-workspace>/CharacterOS-Research-Direction-Audit`，六个文档）

> - 最终路线状态：**B — DIRECTION_VALID_BUT_REFRAMED**
> - Pure Dynamics 研究：**PAUSE_UNTIL_PRODUCT_EVIDENCE**（8 条具体产品触发条件见 `RESEARCH_STATE.md`）
> - **DEV_004：NO_DEV_004_JUSTIFIED**
> - FAST+EMA：research identity = **BASELINE_ONLY**；product identity = **minimal state persistence implementation**
> - 不再要求 Emotion Dynamics 在语言质量上击败 LLM+Prompt
> - 核心目标改为：**长期存在、由真实事件持续改变、可被语言/动作/表情/决策/记忆共享的内部状态系统**
> - **state authority 必须位于 LLM 之外**
> - LLM 仅作为 appraisal / semantic understanding / expression / deep reasoning component
> - Level 2–4（learned adapter / hidden steering / modified architecture）价值仍无充分证据，不得 overclaim
> - 不得启动新 Dynamics 实验，除非未来满足已定义 trigger 条件

---

## 2. 架构宪法五问（本仓库全部文档必须一致回答）

| # | 问题 | 一致答案 |
|---|---|---|
| Q1 | 这个"人"的权威状态在哪里？ | **SubjectState**（canonical，单写入口 = Core transition rules） |
| Q2 | 记忆属于谁？ | **MemoryState 属于 SubjectState**；MemoryRepository 只是持久化/存储设施 |
| Q3 | 没有外部事件时，这个人会不会继续变化？ | **会**，经 TimeTransition（regulation / decay / settling / baseline） |
| Q4 | 每个 tick 必须行动吗？ | **不必须**。Action 是 optional；无外部动作的 tick 合法 |
| Q5 | FAST+EMA 是 CharacterOS 的情绪理论吗？ | **不是**。它是 V0 reference persistence implementation + research baseline，不是 canonical affect theory |

---

## 3. 结论标注纪律（本仓库全部文档强制）

所有结论必须携带以下四类标签之一，不得混用：

| 标签 | 含义 |
|---|---|
| `VERIFIED` | 已观察事实 / 已有实验结果 / 已完成审计确认的历史结论 / 旧仓库代码实际结构（注明来源：Audit A / Audit B / legacy evidence） |
| `DESIGN DECISION` | CharacterOS-Next **选择的架构**（注明约束依据，不冒充科学结论）：如 state authority 在 LLM 外、Retrieval 先于 Appraisal、MemoryState 归属、transition 模型、时间尺度分离 |
| `HYPOTHESIS` | 可证伪但尚无证据的命题（注明证伪条件与触发重测条件）：如"外部状态提升长期连续性"、"affect-congruent retrieval 有价值" |
| `UNKNOWN` | 未被验证、也未形成明确假设的事实 |

> 纪律：**"审计 B 说应该这样做" ≠ "科学上已 VERIFIED 这就是正确架构"。** 审计结论记为 `VERIFIED: Audit B concluded X`；架构采用则另记为 `DESIGN DECISION: CharacterOS-Next adopts X`。

---

## 4. 本阶段边界（硬性禁止）

本阶段（骨架阶段）**只做**：仓库骨架、架构宪法、研究状态、迁移地图。

- ❌ NO DEV_004（以及任何新实验编号）
- ❌ NO new dynamics experiment
- ❌ NO bulk code migration（迁移只写计划）
- ❌ NO product feature development
- ❌ NO claim that CharacterOS-Next already achieves long-lived agency（本仓库当前**没有**实现长期主体，只有定义与计划）
- ❌ 禁止修改以下任何旧仓库：`CharacterOS`、`CharacterOS emotion`、`CharacterOS-CERH-DEV-001/002/003`、外部审计 workspace
- ❌ 禁止实现代码（`packages/*` 当前为空骨架，仅 `.gitkeep`）

---

## 5. 核心文档索引

| 文档 | 内容 |
|---|---|
| `VISION.md` | 总愿景、非目标、长期主体的可操作定义 |
| `ARCHITECTURE.md` | canonical transition system（Time/Observation/Cognition-Action/Learning）、multi-timescale state、**SubjectState V0 概念模型**、LLM boundary、包映射 |
| `ROADMAP.md` | 阶段划分（含 P0.5/P1.5）、门禁、研究触发条件 |
| `RESEARCH_STATE.md` | 两个审计结论的合并状态、开放问题、研究纪律 |
| `MIGRATION_MAP.md` | 迁移分类体系（KEEP/ADAPT/REWRITE/BASELINE_ONLY/RESEARCH_HYPOTHESIS/ARCHIVE）+ 旧资产迁移表（只写计划） |
| `NEXT_ACTIONS.md` | 仅 3 个下一动作（SubjectState V0 / Transition Contracts / MICL） |
| `docs/architecture/p0-architecture-correction.md` | P0 架构修订记录（问题清单 + 修改 + 前后对照） |
| `docs/architecture/subjectstate-v0-spec.md` | SubjectState V0 正式规格（P1 Action 1 · COMPLETE） |
| `docs/architecture/transition-contracts.md` | Canonical transition contracts（P1 Action 2 · COMPLETE） |

---

## 6. 目录说明（当前状态）

- `docs/` — vision / theory / architecture / adr / roadmap（architecture 下已有 `p0-architecture-correction.md`、`subjectstate-v0-spec.md`、`transition-contracts.md`；adr/theory 待后续）
- `research/` — emotion / memory / appraisal / plasticity / hypotheses / experiments（当前为空骨架；**experiments 目录仅为未来形态占位，不代表任何实验被授权**）
- `evals/` — baselines（llm-prompt、fast-ema、characteros-v1）+ longitudinal / ablation / regression（未来评估资产，当前为空）
- `packages/` — 十个包目录（未来实现；当前空骨架）
- `product/` — sandbox / prototypes（未来产品试验场；当前空骨架）
- `archive/` — 未来接收归档资产；**本阶段不移动任何旧文件进来**

> 说明：目录骨架本身不构成"开始实现"或"开始实验"的授权。任何目录内的实际内容必须通过 `ROADMAP.md` 对应阶段的门禁。
