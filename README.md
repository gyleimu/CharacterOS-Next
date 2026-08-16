# CharacterOS-Next

**状态: SKELETON ONLY（工程骨架阶段）** — 本仓库当前只包含架构宪法、研究状态、路线图与迁移计划。**不含任何实现代码、不含任何实验资产、不包含任何从旧仓库复制的源码。**

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

### 约束 B — CharacterOS Emotion 全路线审计结论（审计产物位于 `C:\Users\AL\Documents\CharacterOS-Research-Direction-Audit`，六个文档）

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

## 2. 结论标注纪律（本仓库全部文档强制）

所有结论必须携带以下四类标签之一，不得混用：

| 标签 | 含义 |
|---|---|
| `VERIFIED` | 已被某个已完成审计或旧仓库内证据验证（注明来源：Audit A / Audit B / legacy evidence） |
| `DESIGN DECISION` | CharacterOS-Next 的架构/产品决策（注明约束依据，不冒充证据） |
| `HYPOTHESIS` | 可证伪但尚无证据的命题（必须注明其证伪条件与触发重测的条件） |
| `UNKNOWN` | 未被验证、也未形成明确假设的事实 |

示例格式：`[DESIGN DECISION — 依据约束 B §"state authority 在 LLM 之外"]`。

---

## 3. 本阶段边界（硬性禁止）

本阶段（骨架阶段）**只做**：仓库骨架、架构宪法、研究状态、迁移地图。

- ❌ NO DEV_004（以及任何新实验编号）
- ❌ NO new dynamics experiment
- ❌ NO bulk code migration（迁移只写计划）
- ❌ NO product feature development
- ❌ NO claim that CharacterOS-Next already achieves long-lived agency（本仓库当前**没有**实现长期主体，只有定义与计划）
- ❌ 禁止修改以下任何旧仓库：`CharacterOS`、`CharacterOS emotion`、`CharacterOS-CERH-DEV-001/002/003`、`CharacterOS-Research-Direction-Audit`
- ❌ 禁止实现代码（`packages/*` 当前为空骨架，仅 `.gitkeep`）

---

## 4. 核心文档索引

| 文档 | 内容 |
|---|---|
| `VISION.md` | 总愿景、非目标、长期主体的可操作定义 |
| `ARCHITECTURE.md` | canonical causal loop、multi-timescale state、**SubjectState V0 概念模型**、LLM boundary、包映射 |
| `ROADMAP.md` | 阶段划分、门禁、研究触发条件 |
| `RESEARCH_STATE.md` | 两个审计结论的合并状态、开放问题、研究纪律 |
| `MIGRATION_MAP.md` | 迁移分类体系（KEEP/ADAPT/REWRITE/BASELINE_ONLY/RESEARCH_HYPOTHESIS/ARCHIVE）+ 旧资产迁移表（只写计划） |
| `NEXT_ACTIONS.md` | 仅 3 个下一动作（SubjectState V0 / Causal Loop / 最小闭环） |

---

## 5. 目录说明（当前状态）

- `docs/` — vision / theory / architecture / adr / roadmap（本阶段仅创建目录；adr/theory 为空，待后续 ADR）
- `research/` — emotion / memory / appraisal / plasticity / hypotheses / experiments（当前为空骨架；**experiments 目录仅为未来形态占位，不代表任何实验被授权**）
- `evals/` — baselines（llm-prompt、fast-ema、characteros-v1）+ longitudinal / ablation / regression（未来评估资产，当前为空）
- `packages/` — 十个包目录（未来实现；当前空骨架）
- `product/` — sandbox / prototypes（未来产品试验场；当前空骨架）
- `archive/` — 未来接收归档资产；**本阶段不移动任何旧文件进来**

> 说明：目录骨架本身不构成"开始实现"或"开始实验"的授权。任何目录内的实际内容必须通过 `ROADMAP.md` 对应阶段的门禁。
