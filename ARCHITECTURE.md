# ARCHITECTURE.md — CharacterOS-Next 架构宪法

**状态:** 骨架阶段文档。定义架构，不实现。全部结论带标签。
**本文件的层级:** 本文件是 CharacterOS-Next 的架构宪法；任何 ADR（docs/adr/）不得违反本文件，只能细化。

---

## 1. 架构原则（按优先级）

| # | 原则 | 依据 |
|---|---|---|
| P1 | **Single canonical SubjectState，单写入口**：所有状态变更只能经 Core transition rules | `DESIGN DECISION`（约束 B：state authority 在 LLM 之外） |
| P2 | **顺序不可逆**：Retrieval/Appraisal 先于 Affect（修复旧 Event→Emotion→Interpretation 错误） | `VERIFIED`（约束 A 缺口 #1） |
| P3 | **时间尺度分层**：九层状态各有独立 timescale、写规则与读写路径，禁止混层 | `DESIGN DECISION`（约束 A 缺口 #7） |
| P4 | **闭环强制**：每个行为必须经 Action → Environment → Outcome → Experience → Memory 回到状态 | `DESIGN DECISION`（约束 A 缺口 #4） |
| P5 | **LLM 是组件不是权威**：LLM 可理解/appraise/表达/推理，不拥有 canonical state，不直接写状态 | `DESIGN DECISION`（约束 B） |
| P6 | **Baseline 纪律**：任何新机制必须先证明优于 FAST+EMA、LINEAR-G 与 "Memory+LLM 每轮重算" 三个比较器之一对应的问题形态 | `VERIFIED`（约束 B；第三比较器为审计 B RED_TEAM 新增） |
| P7 | **不得 overclaim**：Level 2–4 集成、多模态价值、跨 session 持久价值均为 HYPOTHESIS/UNKNOWN，不得写成能力声明 | `VERIFIED`（约束 B） |

---

## 2. 顶层视图

```text
                    ┌────────────────────────────────────────────┐
                    │        CharacterOS-Next Runtime            │
                    │                                            │
  World/User ──► Perception ──► Core Causal Loop ──► Action ──► Environment
                    │   ▲              │                          │
                    │   │              ▼                          │
                    │ LLM (bounded)  SubjectState (canonical)     │
                    │ appraisal/     ← 唯一状态权威                │
                    │ expression/    ← 单写入口: Core rules       │
                    │ understanding  ← 九层 multi-timescale       │
                    └────────────────────────────────────────────┘
```

---

## 3. Canonical Causal Loop（权威因果环）

> 本环是 CharacterOS-Next 的**唯一合法 tick 语义**。任何包不得绕过本环直接连接两个阶段。

```text
(0)  Observation                       外部信号进入（事件/用户输入/环境读数）
(1)  Perception                        感知归一化（文本现在；多模态未来 = UNKNOWN）
(2)  Contextual Memory Retrieval       情境化、自传式记忆检索
(3)  Subjective Interpretation         主体视角解释（检索结果 × 当前状态 × 情境）
(4)  Appraisal                         评价：相关性/目标关系/因果归因/强度
(5)  Affective Dynamics                Appraisal 后产生/更新 affect（FAST episode + SLOW EMA = V0 唯一允许机制）
(6)  Cognition / Motivation            从状态推导关注点与动机
(7)  Behavior Policy                   行为选择策略（可含 LLM deep reasoning，但不写状态）
(8)  Action                            执行动作
(9)  Environment / Other Agent         环境与其他主体响应
(10) Outcome                           结果
(11) Experience Encoding               经历编码（事件+结果+当时状态）
(12) Memory Consolidation              记忆巩固（短期→长期、摘要、遗忘）
(13) Belief / Relationship / Plasticity 长期结构更新（经 Core 规则）
(14) Future SubjectState               形成下一 tick 的 SubjectState
```

**关键顺序约束（不可违反）：**
- (4) Appraisal 必须发生在 (5) Affective Dynamics 之前。`[VERIFIED — 约束 A 缺口 #1]`
- (2) 必须先于 (4)：先检索相关记忆，再评价。`[DESIGN DECISION — 约束 A 缺口 #5]`
- (5) 的输出写入 SubjectState 的 current affect / mood baseline 层，且只经 Core 规则。`[DESIGN DECISION]`
- (9)–(10) 必须真实存在：没有 Outcome 的 Action 是缺口（旧仓库缺口 #4）。`[VERIFIED — 约束 A 缺口 #4]`
- (13) 只允许累积式、有界、可解释的更新；不允许 LLM 直接改写。`[DESIGN DECISION — 约束 B]`

**每阶段的包归属：**

| 阶段 | 包（packages/） | V0 状态 |
|---|---|---|
| (1) Perception | runtime | 设计占位（文本输入）；多模态 = UNKNOWN |
| (2) Memory Retrieval | memory | 核心三件套之一（见 NEXT_ACTIONS） |
| (3) Interpretation | subject-core | 设计占位 |
| (4) Appraisal | appraisal | 核心三件套之一 |
| (5) Affective Dynamics | affect | 核心三件套之一（V0 = FAST+EMA，BASELINE_ONLY 身份） |
| (6)–(7) Cognition/Motivation/Policy | behavior (+subject-core) | 设计占位 |
| (8)–(10) Action/Environment/Outcome | runtime (+product sandbox) | 设计占位 |
| (11)–(12) Experience/Memory | memory | 设计占位 |
| (13) Belief/Relationship/Plasticity | belief / relationship / affect | 设计占位 |
| (14) SubjectState | subject-core | 核心（SubjectState V0） |

---

## 4. Multi-Timescale State（九层状态）

每层定义：内容、时间尺度、写入者（唯一）、读取者、V0 范围。

| 层 | 内容 | 时间尺度 | 写入者（唯一） | 主要读取者 | V0 |
|---|---|---|---|---|---|
| **Identity** | 我是谁：名字、历史、核心自我叙事 | 终身（几乎不变） | Core（初始化 + 极罕见生命事件，需高阈值规则） | 全部 | 静态种子（只读） |
| **Traits / temperament** | 气质与稳定特质 | 年（缓慢漂移） | Core（仅经 (13) 长期更新） | Appraisal、Policy、Expression | 静态种子（只读） |
| **Beliefs / values** | 信念与价值观 | 月–年 | Core（经 (13)，证据累积式更新） | Interpretation、Appraisal、Policy | 结构定义，无更新规则 |
| **Relationship models** | 对他人/群体的关系模型（一等状态） | 周–年 | Core（经 (13) 关系事件更新） | Retrieval、Interpretation、Appraisal | 结构定义，无更新规则 |
| **Mood / affective baseline** | 情绪基线（慢变量） | 小时–天 | Affect 包（经 (5)） | Appraisal、Expression、Policy | **V0 实现（EMA slow）** |
| **Current affect** | 当前情绪 episode（快变量） | 秒–分钟 | Affect 包（经 (5)） | Expression、Policy、Verbalizer | **V0 实现（FAST episode）** |
| **Regulatory state** | 调节状态（能量/压力/注意力预算） | 分钟–小时 | Regulation 包（经 (6)） | Policy、Appraisal | 结构定义（标量占位） |
| **Working context** | 当前任务/场景/焦点 | 秒–小时 | subject-core（经 (3)/(6)） | 全部 | **V0 实现（上下文切片）** |
| **Plasticity parameters** | 学习率/衰减率/阈值等元参数 | 参数（偶尔调整） | Core（配置或长期规则） | Affect、Memory、Belief | **V0 实现（常量配置）** |

**分层纪律（约束 A 缺口 #7 的修复）：**
- 慢层绝不与快层同写：一次事件不能直接改 Traits，只能改 Current affect / Working context，并经 (13) 累积为慢层候选变化。`[DESIGN DECISION]`
- 每层变化必须携带 cause-trace（哪个事件/哪条规则在哪个 tick 造成），可解释性强制。`[DESIGN DECISION]`
- 层间依赖单向：慢层约束快层（Traits 调制 Appraisal），快层不直接改写慢层。`[DESIGN DECISION]`

---

## 5. SubjectState V0 概念模型（只定义，不实现）

> V0 的唯一目的：支撑最小闭环（Memory Retrieval + Appraisal + persistent Affect）。V0 明确**不包含**完整九层动态。

### 5.1 V0 范围决策

| 层 | V0 形态 | 说明 |
|---|---|---|
| Identity / Traits | 静态种子配置（只读） | `DESIGN DECISION`：V0 不实现漂移 |
| Beliefs / Values / Relationship | 只定义结构（占位字段 + 读取接口），无更新规则 | `DESIGN DECISION`：留给后续阶段 |
| Mood baseline | 单标量 EMA（τ、α、clamp） | `VERIFIED`（约束 B：FAST+EMA minimal persistence，BASELINE_ONLY 身份） |
| Current affect | FAST episode 状态机（UNFORMED→HOLD→RELEASE→NEUTRAL，cyclic） | 同上 |
| Regulatory state | 单标量（可选，缺省中性） | `DESIGN DECISION` |
| Working context | 结构化上下文切片（场景/任务/焦点引用） | `DESIGN DECISION` |
| Plasticity params | 常量配置表（τ/α/clamp/tHold） | `VERIFIED`（沿用 Plasticity Phase 1 canonical 参数为缺省） |

### 5.2 V0 结构（概念示意，非实现契约）

```text
SubjectStateV0 {
  identity   : { seed: readOnly }                      // Identity/Traits 静态种子
  beliefs    : { items: [] }                            // 占位，只读
  relationships : { models: [] }                        // 占位，只读
  mood       : { baseline: scalar,                      // EMA slow（V0 唯一慢动态）
                 tau, alpha, clamp }
  affect     : { per_channel: FAST_episode,             // V0 唯一快动态
                 active_channel, intensity }
  regulation : { energy: scalar }                       // 占位
  context    : { scene, task, focus[] }                 // 工作上下文
  plasticity : { params: const }                        // 常量配置
  trace      : { log[] }                                // cause-trace：每条变化可回溯
}
```

**概念示意（JSON 形态，仅用于沟通，不是 schema 契约）：**

```jsonc
{
  "identity": { "name": "示例主体", "traits_seed": { "agreeableness": 0.6 } },
  "mood":   { "baseline": 0.034, "tau": 150, "alpha": 0.06, "clamp": 0.25 },
  "affect": { "channels": { "anger": "NEUTRAL", "joy": "NEUTRAL" },
              "active": "joy", "progress": 0.5 },
  "context": { "scene": "work", "task": "review", "focus": ["event#42"] },
  "trace":  [ { "tick": 1042, "layer": "affect", "rule": "appraisal->affect",
                "cause": "event#41(anger,0.7)", "from": "NEUTRAL", "to": "HOLD" } ]
}
```

> 上图仅为概念沟通示意。字段、命名、编码均为 `HYPOTHESIS`，将在 NEXT_ACTIONS #1（SubjectState V0 spec）中正式裁定。

### 5.3 V0 写规则（单写入口的 V0 版本）

| 变化 | 唯一允许路径 |
|---|---|
| 事件 → affect | Appraisal 产出 → Affect 包经 Core 规则写入（FAST 状态机转换） |
| episode 完成 → mood | Affect 包经 Core 规则：`slow ← min(clamp, slow+α)` |
| 时间推进 → decay | Affect 包经 Core 规则：`slow ← slow·exp(-1/τ)` |
| 任何其他层 | V0 禁止写（只读种子/占位） |
| LLM 直接写任何层 | **禁止**（见 §6） |

---

## 6. LLM Boundary（LLM 边界，宪法级）

### 6.1 边界规则

| # | 规则 | 状态 |
|---|---|---|
| B1 | LLM 可理解（semantic understanding）、appraise（产出结构化评价提案）、生成表达（语言/语气）、进行 deep reasoning（行为候选生成） | `DESIGN DECISION`（约束 B） |
| B2 | LLM **不拥有** canonical subject state；SubjectState 存储在 Core 中 | `DESIGN DECISION`（约束 B） |
| B3 | LLM **不可直接任意写** personality / belief / affect / memory：只能提交提案，由 Core transition rules 校验、批准、拒绝或改写后写入 | `DESIGN DECISION`（约束 B） |
| B4 | 所有状态变更必须经过 Core transition rules；LLM 输出永远不是状态的直接来源 | `DESIGN DECISION` |
| B5 | LLM 读取状态只经受控投影（verbalizer / structured readout），投影由 Core 生成 | `DESIGN DECISION`（约束 B：State Communication 结论——词句通道强、中性数值通道在 deepseek-v4-pro 上惰性） |
| B6 | prompt 注入/越权文本不得改写状态：状态变更只接受经解析的结构化提案，且提案内容受 Core 规则约束 | `DESIGN DECISION` |

### 6.2 通道层级现状（继承约束 B，防止 overclaim）

| Level | 定义 | 判定 |
|---|---|---|
| 0 | LLM + Prompt | SUPPORTED_NOW · PRODUCT_WORTHY |
| 1 | External State → deterministic verbalizer → LLM | SUPPORTED_NOW（通道）· 产品默认；dynamics 驱动 verbalizer 的边际贡献 = `UNKNOWN`（缺 A_static 对照） |
| 2 | External Dynamics → learned semantic adapter → LLM | `UNKNOWN`（从未构建；numeric adapter 失败不可传导到此层） |
| 3 | Dynamics → hidden/residual steering | `UNKNOWN` + 当前 BLOCKED（DEV_003 §28 gate 规则，非科学结论） |
| 4 | modified LLM architecture | `UNKNOWN` · 当前无投入正当性 |

### 6.3 LLM 提案协议（概念，V0 最小形态）

```text
LLM 可产出:  { type: "appraisal_proposal", event_ref, dimensions: {relevance, goal_relation, attribution, intensity}, confidence }
             { type: "expression_plan", affect_ref, style_hints }        // 表达计划，不写状态
             { type: "reasoning_memo" }                                   // 决策备忘，不写状态
Core 处理:   appraisal_proposal → 校验范围 → Core 规则换算 → 写入 affect/mood（唯一写入路径）
```

`[DESIGN DECISION — 提案协议的具体字段为 HYPOTHESIS，待 NEXT_ACTIONS #2/#3 裁定]`

---

## 7. 包映射与依赖规则

| 包 | 责任（未来实现） | 依赖 |
|---|---|---|
| subject-core | SubjectState 结构、tick 驱动、cause-trace、写规则引擎 | 无（最底层） |
| memory | 检索、体验编码、巩固 | subject-core（只读投影） |
| appraisal | 结构化评价（LLM 提案 + Core 校验） | subject-core、memory |
| affect | FAST episode + EMA slow + 写规则实现 | subject-core |
| belief / personality / relationship / regulation | 对应状态层的 Core 更新规则（V0 之后） | subject-core |
| behavior | Cognition/Motivation/Policy、动作生成（可调用 LLM deep reasoning） | 全部只读 |
| runtime | Perception、Action/Environment 适配、调度 | behavior、subject-core |

**依赖纪律：** 只允许"上层读下层投影"，不允许反向依赖；subject-core 不依赖任何其他包。`[DESIGN DECISION]`

---

## 8. 与旧仓库的关系（架构层面）

- 旧 CharacterOS（deterministic kernel）与 CharacterOS emotion（研究线）都是**外部只读源**：本仓库不复制其代码，只引用其结论（见 `MIGRATION_MAP.md`）。
- 旧仓库的机制（FAST+EMA 规则、Phase 5 因果链、B2 的 FSM 结论）以**文档级引用**进入本仓库的 `VERIFIED` 依据，不以代码进入。
- 任何未来实现若需复用旧机制代码，必须走 MIGRATION_MAP 的 ADAPT 流程并记录来源 SHA。
