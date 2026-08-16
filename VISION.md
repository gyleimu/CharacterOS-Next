# VISION.md — CharacterOS-Next 愿景

**状态:** 骨架阶段文档。全部结论带标签（VERIFIED / DESIGN DECISION / HYPOTHESIS / UNKNOWN）。

---

## 1. 一句话愿景

> 在电脑里长期存在、由真实事件持续改变、拥有可跨会话延续的内部状态，并把这一状态一致地体现在语言、动作、表情、决策与记忆中的**长期人工主体**。

`[DESIGN DECISION — 依据约束 B（Emotion 审计重定义目标）+ 约束 A（旧仓库定位为 legacy/baseline/migration source）]`

---

## 2. 长期主体（long-lived agent）的可操作定义

本仓库对"长期主体"不做口号化定义，只接受可操作定义。长期主体必须同时满足以下**结构条件**（当前全部为设计目标，非现状声明）：

| # | 条件 | 状态 |
|---|---|---|
| L1 | 存在单一 canonical SubjectState，其权威在 LLM 之外 | `DESIGN DECISION`（约束 B：state authority 在 LLM 之外） |
| L2 | SubjectState 跨 session 持久化，且其演化历史可追溯 | `DESIGN DECISION`（修复约束 A 缺口 #3；跨 session 持久价值 = `HYPOTHESIS`，未经实验验证） |
| L3 | SubjectState 拥有 canonical MemoryState（记忆属于主体，不是外部 RAG） | `DESIGN DECISION`（架构修订 P0-1） |
| L4 | 主体演化由多类 canonical transition 构成（Time / Observation / Cognition-Action / Learning），Action 是 optional，不是每个 tick 强制发生 | `DESIGN DECISION`（架构修订 P0-2/P0-3） |
| L5 | 状态被多通道共享读取（语言/动作/表情/决策/记忆）且互不一致会被检测 | `DESIGN DECISION`；多模态通道的价值 = `HYPOTHESIS`（约束 B 明确 UNPROVEN） |
| L6 | LLM 只能以"提案 + 被 Core 规则批准/改写"的方式影响状态，不能直接写状态 | `DESIGN DECISION`（约束 B：LLM 是 appraisal/expression/understanding 组件） |
| L7 | 角色的长期变化（belief/relationship/plasticity）由经历经 Core 规则积累，不由 prompt 直接塑造 | `DESIGN DECISION`（约束 A 缺口 #6/#7 的修复方向） |

> **诚实声明（必读）**：以上 L1–L7 中，没有任何一条声称"已实现"。本仓库当前**没有**实现长期主体。L2/L5 的独特价值目前是产品假设 + 部分研究支持（Emotion 审计 B 的结论），不是已验证结论。`[VERIFIED — 约束 B]`

---

## 3. 核心架构主张（来自两个审计）

### 3.1 顺序主张（修复约束 A 缺口 #1）

```text
错误顺序（旧）:  Event → Emotion → Interpretation
正确顺序（新）:  Observation → Perception → Contextual Memory Retrieval
                 → Subjective Interpretation → Appraisal → Affective Dynamics → …
```

- `[VERIFIED — 约束 A 缺口 #1]`：旧仓库代码实际采用 Event → Emotion → Interpretation 顺序（这是一个**已观察事实**）。
- `[DESIGN DECISION]`：CharacterOS-Next **选择** Retrieval/Appraisal 先于 Affect（这是架构决策，不是"科学上已验证该顺序正确"）。

### 3.2 情感主张（继承约束 B 全部结论）

- 情感系统的目标是**持久内部状态**，不是"让单轮回复比 prompt 更有情绪感"。`[VERIFIED — 约束 B]`
- FAST+EMA 在产品侧 = **V0 reference persistence implementation**；在研究侧 = **BASELINE_ONLY**。它**不是** CharacterOS 的情绪理论，也不是科学上已证明最优的动力学。`[VERIFIED — 约束 B；措辞修正 P0-4]`
- 纯 Dynamics 研究暂停；任何重启必须命中 8 条产品触发条件之一。`[VERIFIED — 约束 B，触发条件见 RESEARCH_STATE.md]`
- 不再以"Emotion Dynamics 在语言质量上击败 LLM+Prompt"作为任何目标。`[DESIGN DECISION — 约束 B]`

### 3.3 状态主张

- 时间尺度必须分层（Identity > Traits > Beliefs > Relationships > Mood > Affect > Working Context），层间不得混用写规则。`[DESIGN DECISION — 修复约束 A 缺口 #7]`
- Relationship 是一等长期状态。`[DESIGN DECISION — 修复约束 A 缺口 #6]`
- **SubjectState 拥有 MemoryState**；MemoryRepository 只是持久化/存储设施。`[DESIGN DECISION — 架构修订 P0-1]`
- 所有状态变更必须经过 Core transition rules（单写入口）。`[DESIGN DECISION — 约束 B：LLM 不可直接写状态]`

---

## 4. 非目标（Non-Goals，明确不做）

1. **不追求意识/人格拟真理论** — 不做"真实情绪"的哲学承诺；只做可操作、可检验的状态系统。`[VERIFIED — 约束 B：历史实验从未声称人格/人类情绪/意识]`
2. **不把 LLM 当作状态存储** — 上下文窗口不是 canonical state。`[DESIGN DECISION]`
3. **不追求"情绪动力学击败 LLM+Prompt"** — 该目标已被审计 B 判定为错误框架。`[VERIFIED — 约束 B]`
4. **不提前投入 Level 2–4 LLM 集成**（learned adapter / hidden steering / modified architecture）— 无证据支持，Level 1（deterministic verbalizer）是当前默认。`[VERIFIED — 约束 B；层级判定见 RESEARCH_STATE.md]`
5. **不做"为了研究感而研究"** — 研究只回应产品证据触发的具体机制问题。`[VERIFIED — 约束 B：NO_DEV_004_JUSTIFIED]`
6. **不复制旧代码** — 旧仓库是 baseline / mechanism library / 迁移源，不是新仓库的起点。`[DESIGN DECISION — 约束 A]`

---

## 5. 判断"我们走对了"的远期标准（检验愿景，不检验信仰）

以下每条都是**未来**可检验的判据；今天全部为 UNKNOWN/HYPOTHESIS，不得提前宣称满足：

| # | 判据 | 状态 |
|---|---|---|
| C1 | 同一角色跨两个 session 的行为连续性显著高于无状态 baseline（llm-prompt / context-only） | `HYPOTHESIS`（依赖产品数据出现） |
| C2 | 事件→记忆→状态→行为的闭环在修复测量后重新通过因果/特异性检验（旧 Phase 5.2 链本体已 90–100% 通过，测量设计待修） | `HYPOTHESIS`（部分依据 `VERIFIED`：Phase 5 链本体） |
| C3 | 注入/prompt 越权无法改写 canonical state（LLM boundary 有效） | `HYPOTHESIS` |
| C4 | 多通道（语言/动作/表情）状态读数一致，不一致时系统可检测并收敛 | `HYPOTHESIS`（多模态 = UNPROVEN，约束 B） |
| C5 | 长期关系/belief 演化由经历驱动且可解释（可回溯到事件序列） | `HYPOTHESIS` |
| C6 | 比"Memory + LLM 每轮重算"（第三比较器，审计 B RED_TEAM 新增）在 C1/C2/C3/C4 上可测量地更优 | `HYPOTHESIS`（从未比较过，`UNKNOWN`） |

---

## 6. 本阶段愿景交付

本阶段只交付**定义与承诺**，不交付行为：
- SubjectState V0 概念模型（`ARCHITECTURE.md` §5）
- canonical transition system（`ARCHITECTURE.md` §3）
- LLM boundary（`ARCHITECTURE.md` §6）
- 迁移计划（`MIGRATION_MAP.md`）
- 三个下一动作（`NEXT_ACTIONS.md`）
