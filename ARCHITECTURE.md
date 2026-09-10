# ARCHITECTURE.md — CharacterOS-Next 架构宪法

**状态:** ACTIVE ARCHITECTURE。记录当前架构边界、实现 ownership 与仍然有效的设计约束；不把历史 V0 草图当作当前实现状态。
**权威分工:** 当前仓库健康与门禁状态以 `CURRENT_STATE.md` 为唯一权威；本文件是 CharacterOS-Next 的架构宪法，任何 ADR（`docs/adr/`）不得违反本文件，只能细化。
**最近机械核对基线:** `d4503cc6fd3f93d9e88b39d7aa365c8ef456b441`（2026-09-10）；全部结论继续使用 VERIFIED / DESIGN DECISION / HYPOTHESIS / UNKNOWN 标签。
**修订:** P0-1 起，本文件采用 **canonical transition system（多 transition Subject Runtime）** 取代早期的"单一 15 阶段强制 tick"。修订记录见 `docs/architecture/p0-architecture-correction.md`。

---

## 1. 架构原则（按优先级）

| # | 原则 | 依据 |
|---|---|---|
| P1 | **Single canonical SubjectState，单写入口**：所有状态变更只能经owning producer proposal/delta + subject-core generic validation/atomic commit | `DESIGN DECISION`（约束 B：state authority 在 LLM 之外） |
| P2 | **顺序约束**：Retrieval/Appraisal 先于 Affect | `DESIGN DECISION`（依据 `VERIFIED` 约束 A 缺口 #1：旧代码实际为 Event→Emotion→Interpretation 顺序） |
| P3 | **时间尺度分层**：各状态层独立 timescale、写规则与读写路径，禁止混层 | `DESIGN DECISION`（约束 A 缺口 #7） |
| P4 | **闭环由 transition 组合实现，非每 tick 强制**：Action 是 optional；仅当外部动作真实发生时才有 Environment→Outcome→Learning 段 | `DESIGN DECISION`（约束 A 缺口 #4；架构修订 P0-2） |
| P5 | **LLM 是组件不是权威**：LLM 可理解/appraise/表达/推理，不拥有 canonical state，不直接写状态 | `DESIGN DECISION`（约束 B） |
| P6 | **Baseline 纪律**：任何新机制必须先证明优于 FAST+EMA、LINEAR-G 与 "Memory+LLM 每轮重算" 三者之一对应的问题形态 | `DESIGN DECISION`（依据 `VERIFIED` 约束 B；第三比较器为审计 B RED_TEAM 新增） |
| P7 | **不得 overclaim**：Level 2–4 集成、多模态价值、跨 session 持久价值均为 HYPOTHESIS/UNKNOWN，不得写成能力声明 | `DESIGN DECISION`（依据 `VERIFIED` 约束 B） |
| P8 | **Time 是一等语义**：无外部事件时主体仍可演化（TimeTransition），Appraisal 使用 time-normalized 当前状态 | `DESIGN DECISION`（架构修订 P0-3） |
| P9 | **Producer != Mutator**：domain 模块只计算 transition proposal/delta；唯一 canonical mutator = subject-core | `DESIGN DECISION`（SubjectState V0 spec §5） |

---

## 2. 顶层视图

```text
                    ┌──────────────────────────────────────────────┐
                    │        CharacterOS-Next Subject Runtime      │
                    │        （多 transition，非单一 15 阶段流水线） │
                    │                                              │
  World/User ──► Perception ──► Transition System ──► optional Action ──► Environment
                    │   ▲              │                              │
                    │   │              ▼                              │
                    │ LLM (bounded)  SubjectState (canonical)         │
                    │ appraisal/     ← 唯一状态权威                   │
                    │ expression/    ← 单写入口: Core rules           │
                    │ understanding  ← owns MemoryState               │
                    └──────────────────────────────────────────────┘
```

---

## 3. Canonical Transition System（权威 runtime 语义）

> CharacterOS-Next 的 Subject Runtime 由**多类合法 transition** 组成，不是"每个 tick 强制走唯一 15 阶段完整闭环"。
> 完整的 **Full Subject-World Lifecycle** 是多个 transition 串联后的宏观闭环，不是每个 runtime tick 的固定流水线。

### 3.1 四类 transition

| Transition | 签名（概念） | 职责 | Action 是否发生 |
|---|---|---|---|
| **TimeTransition** | `SubjectState(t) → elapsed time → SubjectState(t+Δt)` | regulation 推进、affect settling/decay、mood settling、memory consolidation eligibility（derived signal，非 canonical delta）、baseline 调整、恢复过程；**无外部事件也能演化** | 否 |
| **ObservationTransition** | `Observation → Perception → Retrieval → Interpretation → Appraisal → Affect update → SubjectState'` | 处理外部/内部信号，更新主观状态 | 否 |
| **Cognition/ActionTransition** | `SubjectState → Cognition/Motivation → Policy/Decision → optional Action` | 决策与可选动作；Action **optional** | 可选 |
| **LearningTransition** | `Outcome / Internal Experience → Experience Encoding → Memory Consolidation → Belief/Relationship/Plasticity update → Future SubjectState` | 从结果与经历中学习，更新慢层 | 否（是 Outcome 之后） |

> 未来如需要，可引入 `InternalEventTransition`，但本次不扩张。

**时间语义（P0-3，一等语义）：**

```text
Previous SubjectState
    → TimeTransition          （fatigue/stress/affect decay/mood settling/recovery）
    → Current SubjectState     （time-normalized）
    → Observation
    → Retrieval → Appraisal    （使用 time-normalized 状态，而非事件来时才顺便计算）
```

> Regulation 可以在 Appraisal 被求值**之前**影响 Appraisal。`[DESIGN DECISION — P0-3]`

### 3.2 硬性不变量

- Retrieval 先于 Appraisal；Appraisal 先于 Affect。`[DESIGN DECISION]`
- Canonical写只经owning producer delta + subject-core generic authority/invariant validation/atomic commit；LLM不能直接改状态。`[DESIGN DECISION]`
- 慢层变化必须 bounded + traced；快事件不直接改慢层。`[DESIGN DECISION]`
- Action 是 optional。`[DESIGN DECISION]`
- Environment/Outcome 段**仅当**外部动作真实执行后才必需。`[DESIGN DECISION]`
- 时间推进不要求外部事件。`[DESIGN DECISION]`
- SubjectState 恢复必须保持 revision/trace 一致性。`[DESIGN DECISION]`

### 3.3 Full Subject-World Lifecycle（15 阶段参考，非唯一 tick 语义）

> 以下 15 阶段是"完整主体-世界生命周期"的**参考分解**，是 §3.1 四类 transition 的串联展开；**不是每个 runtime tick 都必须全部走完**。

```text
(0)  Observation                       外部信号进入（事件/用户输入/环境读数）
(1)  Perception                        感知归一化（文本现在；多模态未来 = UNKNOWN）
(2)  Contextual Memory Retrieval       情境化、自传式记忆检索
(3)  Subjective Interpretation         主体视角解释（检索结果 × 当前状态 × 情境）
(4)  Appraisal                         评价：相关性/目标关系/因果归因/强度
(5)  Affective Dynamics                Appraisal 后更新 affect（V0 = FAST+EMA-derived reference persistence）
(6)  Cognition / Motivation            从状态推导关注点与动机
(7)  Behavior Policy                   行为选择策略（可含 LLM deep reasoning，但不写状态）
(8)  Action                            执行动作（optional）
(9)  Environment / Other Agent         环境与其他主体响应（仅当 (8) 发生）
(10) Outcome                           结果（仅当 (8) 发生）
(11) Experience Encoding               经历编码（事件+结果+当时状态）
(12) Memory Consolidation              记忆巩固（短期→长期、摘要、遗忘）
(13) Belief / Relationship / Personality 长期结构更新（当前 owning producer 产 bounded delta；subject-core 仅通用校验/提交）
(14) Future SubjectState               形成下一状态的 SubjectState
```

**关键顺序约束（不变量，非"每阶段每 tick 必执行"）：**
- (4) Appraisal 先于 (5) Affective Dynamics。`[DESIGN DECISION]`（依据 `VERIFIED` 约束 A 缺口 #1）
- (2) 先于 (4)：先检索相关记忆，再评价。`[DESIGN DECISION]`（约束 A 缺口 #5）
- (8)–(10) 仅在 Action 真实发生时展开；没有 Outcome 的 Action 是缺口（旧仓库缺口 #4）。`[VERIFIED — 约束 A 缺口 #4 的观察；本架构将 Action 设为 optional = DESIGN DECISION]`
- (13) 只允许累积式、有界、可解释的更新；不允许 LLM 直接改写。`[DESIGN DECISION — 约束 B]`

**每阶段的包归属：**

| 阶段 | 包（packages/） | V0 状态 |
|---|---|---|
| (1) Perception | runtime | **当前实现**：文本 observation / conversation ingress；多模态仍为 UNKNOWN |
| (2) Memory Retrieval | memory + runtime | **当前实现**：repository-backed retrieval 与 runtime orchestration |
| (3) Interpretation | appraisal + runtime | **当前实现**：proposal/validation 与受控 projection/orchestration |
| (4) Appraisal | appraisal + runtime | **当前实现**：Experience 与 factual-event appraisal lifecycle |
| (5) Affective Dynamics | affect + runtime | **当前实现**：bounded canonical affect dynamics、application 与 time advance |
| (6)–(7) Cognition/Motivation/Policy | behavior + runtime | **当前实现**：纯 behavior contracts 位于 behavior；provider、policy 与 trusted execution 位于 runtime |
| (8)–(10) Action/Environment/Outcome | runtime + product/sandbox | **当前实现（host-bounded）**：action runner、sandbox world、outcome reintegration 与薄产品适配；外部世界集成由 host 提供 |
| (11)–(12) Experience/Memory | memory + runtime | **当前实现**：Experience encoding、repository/revision、feedback 与 retrieval；不等同于完整长期记忆理论 |
| (13) Personality/Belief/Relationship plasticity | personality + runtime + memory-influence + influence-evidence + long-term-state-domain | **当前实现（bounded engineering contracts）**：见 §7 的实际 ownership；不构成心理学外部有效性声明 |
| (14) SubjectState | subject-core | **当前实现**：versioned canonical SubjectState、validation、atomic commit、persistence/restore |

---

## 4. Multi-Timescale State（十层状态）

每层定义：内容、时间尺度、transition producer（域模块）、读取者、V0 范围（canonical mutator 恒为 subject-core）。

| 层 | 内容 | 时间尺度 | transition producer（域模块） | 主要读取者 | V0 |
|---|---|---|---|---|---|
| **Identity** | 我是谁：subject_id、名字、origin metadata、identity anchors、稳定 self-schema 种子（**不含**自传历史） | 终身（几乎不变） | subject-core init only；V0 无更新 producer | 全部 | 静态种子（只读） |
| **Traits / temperament** | `traits_seed`（先天气质种子，只读）与独立的 acquired `personality` state | 年（慢变量） | `traits_seed` 无更新 producer；personality 包产生 evidence-bound bounded proposal，runtime 执行受控 transition | Appraisal、Policy、Expression | **当前实现**：seed 只读；acquired personality 可受控更新 |
| **MemoryState** | 主体的 canonical 记忆状态：working memory references、active episode references、autobiographical index state、long-term store revision、consolidation cursor、retrieval bias/config、recent retrieval trace、memory lifecycle metadata | 混合（index 长期、working 短期） | memory 包产 partition-authorized delta；subject-core generic validation/commit | Retrieval、Interpretation、Appraisal | **V0 实现（reference/index/working set）** |
| **Beliefs / values** | 信念与价值观 | 月–年 | runtime 中的 evidence-bound belief proposal / plasticity / transition workflow | Interpretation、Appraisal、Policy | **当前实现（bounded engineering contract）** |
| **Relationship models** | 对他人/群体的关系模型（一等状态） | 周–年 | runtime 中的 counterpart registration、familiarity、bounded relationship proposal / transition workflow | Retrieval、Interpretation、Appraisal | **当前实现（bounded engineering contract）** |
| **Mood / affective baseline** | 情绪基线（慢变量） | 小时–天 | affect 包（经 ObservationTransition/TimeTransition） | Appraisal、Expression、Policy | **V0 实现（FAST+EMA-derived slow）** |
| **Current affect** | 当前情绪 episode（快变量） | 秒–分钟 | affect 包（经 ObservationTransition） | Expression、Policy、Verbalizer | **V0 实现（FAST episode）** |
| **Regulatory state** | 调节状态（energy / stress / arousal / fatigue） | 分钟–小时 | runtime 的 `RegulationProducerPort` / `ReferenceRegulationV0Producer`，经 TimeTransition orchestration | Policy、Appraisal | **当前实现（reference producer）**；regulation 同名包仍为兼容壳 |
| **Working context** | 当前任务/场景/焦点 | 秒–小时 | context producer（经 Observation/CognitionAction）；subject-core commit | 全部 | **V0 实现（上下文切片）** |
| **Mechanism config（机制配置，原 plasticity）** | 学习率/衰减率/阈值/特性开关等元参数 | 参数（偶尔调整） | subject-core init/config authority；V0 readonly | Affect、Memory、Belief | **V0 实现（常量配置）** |

> **canonical mutator 恒为 subject-core**：上表 "producer" 列是计算 delta 的域模块；真正的 canonical 提交永远由 subject-core 执行（见 §1 P9 / SubjectState V0 spec §5）。任何域模块不得直接 mutate SubjectState。`[DESIGN DECISION]`

**分层纪律（约束 A 缺口 #7 的修复）：**
- 慢层绝不与快层同写：一次事件不能直接改 Traits/Beliefs，只能改 Current affect / Working context，并经 LearningTransition 累积为慢层候选变化。`[DESIGN DECISION]`
- 每层变化必须携带 cause-trace（哪个事件/哪条规则在哪次 transition 造成），可解释性强制。`[DESIGN DECISION]`
- 层间依赖单向：慢层约束快层（Traits 调制 Appraisal），快层不直接改写慢层。`[DESIGN DECISION]`
- **Identity ≠ 自传历史**：自传历史属于 MemoryState；narrative identity/self-model 未来可作为独立慢变量，不与 immutable Identity 混写。`[DESIGN DECISION — P0-7]`

---

## 5. 历史 SubjectState V0 概念模型（非当前实现状态）

> 本节保留最初 V0 设计边界及其演进依据，供追溯而非宣告当前能力。当前精确 schema、validator、transition 与 ownership 以 production source、`docs/architecture/subjectstate-v0-spec.md`、后续 contract-freeze 文档及 §7 为准。最初 V0 的唯一目的，是支撑 **MICL（Minimal Internal Continuity Loop）**——Memory Retrieval + Appraisal + persistent Affect；当时明确不包含完整十层动态或 Action/World 闭环。

### 5.1 MemoryState 与 MemoryRepository（P0-1）

```text
SubjectState.MemoryState   （属于主体，canonical）
  ├── working memory references
  ├── active episode references
  ├── autobiographical index state
  ├── long-term store version / revision
  ├── consolidation cursor
  ├── retrieval bias / config state
  ├── recent retrieval trace
  └── memory lifecycle metadata

MemoryRepository           （infrastructure，不属于 canonical state）
  └── 存储设施：episodic payload、embedding、索引、向量库等
```

> 原则：**MemoryRepository is infrastructure；MemoryState belongs to the subject。** `[DESIGN DECISION — P0-1]`
> 这**不**要求把长文本 memory payload 塞进一个巨大 JSON；payload 存 MemoryRepository，canonical 状态只存引用/索引/版本/游标/配置/检索痕迹。

### 5.2 历史 V0 范围决策

| 层 | V0 形态 | 说明 |
|---|---|---|
| Identity / Traits | 静态种子配置（只读） | `DESIGN DECISION`：V0 不实现漂移 |
| MemoryState | canonical references/index/revision/working set；**不实现完整长期记忆算法** | `DESIGN DECISION — P0-1` |
| Beliefs / Values / Relationship | 只定义结构（占位字段 + 读取接口），无更新规则 | `DESIGN DECISION`：留给后续阶段 |
| Mood baseline / Current affect | **FAST+EMA-derived reference persistence implementation** | `DESIGN DECISION`（采用）；`VERIFIED`（来源：审计 B / Plasticity Phase 1） |
| Regulatory state | 最小中性标量/结构，**必须支持未来 TimeTransition** | `DESIGN DECISION — P0-3` |
| Working context | 结构化上下文切片（场景/任务/焦点引用） | `DESIGN DECISION` |
| Mechanism config | 常量配置表，**不能冒充 learned plasticity** | `DESIGN DECISION` |
| Trace | 强制 provenance | `DESIGN DECISION` |
| Runtime metadata | subject version、logical time / last transition time、state revision | `DESIGN DECISION — P0-3` |

### 5.3 V0 结构（概念示意，非实现契约）

```text
SubjectStateV0 {
  identity        : { subject_id, name, origin, anchors, self_schema_seed }  // 只读种子
  traits_seed     : { ... }                                                   // 只读种子
  memory_state    : { working_refs, active_episode_refs, autobiographical_index,
                      store_revision, consolidation_cursor, retrieval_config,
                      recent_retrieval_trace, lifecycle_metadata }
  beliefs         : { items: [] }        // 占位，只读
  relationships   : { models: [] }       // 占位，只读
  mood            : { baseline }         // FAST+EMA-derived slow（reference baseline）
  affect          : { per_channel FAST_episode, active_channel, intensity }
  regulation      : { energy }           // 占位（支持未来 TimeTransition）
  context         : { scene, task, focus[] }
  mechanism_config : { affect_profile: { profile_id: FAST_EMA_V0, timebase: legacy_tick }, legacy_reference_defaults }
  trace_window    : { capacity: 64, cursor, entries[] }  // bounded projection（非完整 history，见 spec §21）
  runtime_metadata: { subject_version, logical_time, last_transition_time, state_revision }
}
```

**历史概念示意（JSON 形态，仅用于沟通；禁止作为 schema/fixture/implementation input）：**

```jsonc
{
  "identity": { "subject_id": "s-0001", "name": "示例主体",
                "traits_seed": { "agreeableness": 0.6 } },
  "memory_state": { "working_refs": ["evt#41"], "store_revision": "r7",
                    "consolidation_cursor": "t1040" },
  "mood": { "baseline": 0.034 },
  "affect": { "channels": { "anger": "NEUTRAL", "joy": "NEUTRAL" },
              "active": "joy", "progress": 0.5 },
  "context": { "scene": "work", "task": "review", "focus": ["evt#42"] },
  "mechanism_config": { "affect_profile": { "profile_id": "FAST_EMA_V0", "timebase": "legacy_tick" },
                          "legacy_reference_defaults": { "tHold": 60, "alpha": 0.06, "tau": 150, "clamp": 0.25 } },
  "trace_window": [ { "transition": "Observation", "layer": "affect", "rule": "appraisal->affect",
                "cause": "evt#41(anger,0.7)", "from": "NEUTRAL", "to": "HOLD" } ],
  "runtime_metadata": { "subject_version": "v0", "logical_time": 1042,
                        "state_revision": "r-1042" }
}
```

> 上图仅为概念沟通示意；正式字段/命名/编码已由 `docs/architecture/subjectstate-v0-spec.md` 裁定（P1 Action 1）。
> P2.1 exact schema/hash/trace closure 见 `docs/implementation/p2-1-contract-freeze.md`；上图中的旧 profile string、trace array 和简写字段不再是可实现 schema。
> `legacy_reference_defaults`（tHold=60/α=0.06/τ=150/clamp=0.25）来源 `VERIFIED`（Plasticity Phase 1），但"是否适合作为 CharacterOS-Next 默认参数"是 `DESIGN DECISION`/`HYPOTHESIS`，不是 VERIFIED 科学真值。

### 5.4 历史 V0 写规则（单写入口的 V0 版本）

| 变化 | 唯一允许路径 |
|---|---|
| 事件 → affect | appraisal package验证 → affect包计算Affect/Mood delta → subject-core通用schema/authority/invariant校验并commit |
| episode 完成 → mood | affect producer按reference persistence计算delta → subject-core只校验/commit |
| 时间推进 → decay | affect/regulation producers消费normalized duration并计算delta → subject-core只校验/commit |
| 记忆引用/revision/cursor | memory producer产生partition-authorized delta（payload写MemoryRepository）→ subject-core只校验/commit |
| 任何其他层 | 在该历史 V0 scope 中禁止写（只读种子/占位）；这不是当前实现状态声明 |
| LLM 直接写任何层 | **禁止**（见 §6） |

> 说明：上表"写入"= 域模块（producer）产出 delta 后，由 **subject-core（canonical mutator）** 校验并提交；域模块不直接 mutate 状态。`[DESIGN DECISION — Producer != Mutator]`

---

## 6. LLM Boundary（LLM 边界，宪法级）

### 6.1 边界规则

| # | 规则 | 状态 |
|---|---|---|
| B1 | LLM 可理解（semantic understanding）、appraise（产出结构化评价提案）、生成表达（语言/语气）、进行 deep reasoning（行为候选生成） | `DESIGN DECISION`（约束 B） |
| B2 | LLM **不拥有** canonical subject state；SubjectState（含 MemoryState）存储在 Core 中 | `DESIGN DECISION`（约束 B） |
| B3 | LLM **不可直接任意写** personality / belief / affect / memory：只可向owning domain提交提案；domain负责schema/evidence validation并产delta，subject-core只做generic authority/invariant validation与commit | `DESIGN DECISION`（约束 B） |
| B4 | 所有状态变更必须经过owning producer delta + subject-core atomic commit；LLM输出永远不是状态的直接来源 | `DESIGN DECISION` |
| B5 | LLM读取状态只经runtime controlled projection（verbalizer / structured readout）；subject-core不构造prompt或执行projection orchestration | `DESIGN DECISION`（约束 B） |
| B6 | prompt注入/越权文本不得改写状态：proposal先经owning domain validation，再经subject-core field authority/invariants；只有atomic commit可推进canonical state | `DESIGN DECISION` |

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
处理链:      appraisal package deterministic validation → AppraisalResult
             → affect package reference mapping → AffectDelta/MoodDelta
             → subject-core generic validation + atomic commit
```

> 以上仅是早期概念草图，不是当前 wire schema。当前可执行 proposal schema、validator 与 transition contract 位于 `packages/appraisal`、`packages/behavior`、`packages/runtime` 及其对应 contract-freeze 文档；字段是否具有心理学外部有效性仍为 `HYPOTHESIS`。

---

## 7. 当前工作区映射与依赖规则

> **现实快照：** 本表由 `pnpm-workspace.yaml` 与各 workspace `package.json` 在基线
> `d4503cc6fd3f93d9e88b39d7aa365c8ef456b441` 机械核对。当前共有 **13 个
> `packages/*` workspace + 1 个 `product/sandbox` workspace**。表中的依赖是当前
> `package.json` 声明，不把理想化未来 ownership 伪装成已经完成的迁移。

| Workspace | 分类 / authority level | 当前责任 | 当前声明的 workspace 依赖 |
|---|---|---|---|
| `@characteros-next/subject-core` | production / **唯一 canonical commit authority** | versioned SubjectState schema、generic validation/invariants、identity、revision/trace/hash、atomic commit、persistence/restore；不拥有 domain formula 或 orchestration | 无（最底层） |
| `@characteros-next/memory` | production / domain + infrastructure | memory records、refs、repository/revision、retrieval contracts 与实现；产生/准备 memory 数据但不直接 canonical mutate SubjectState | `subject-core` |
| `@characteros-next/memory-influence` | production / evidence infrastructure | 对 immutable episodic records 的 domain-neutral、read-only influence projection 与显式 policy；无 canonical write、LLM 或 wall clock | `memory`, `subject-core` |
| `@characteros-next/influence-evidence` | production / evidence infrastructure | 对显式 MemoryInfluence projection 集合做 domain-neutral aggregation/eligibility；不选择语义分组，不获得写 authority | `memory-influence`, `subject-core` |
| `@characteros-next/appraisal` | production / domain | Experience 与 factual-event appraisal proposal、schema/evidence validation；runtime 负责 lifecycle orchestration；无 canonical mutation | `memory`, `subject-core` |
| `@characteros-next/affect` | production / domain | bounded canonical affect impulse/time dynamics 与纯 delta computation；无 canonical mutation | `subject-core` |
| `@characteros-next/behavior` | production / domain contracts | LanguageRealization、CommunicationDirective、CharacterLanguageBehavior 的纯 contracts/validators/identity；trusted executor 在 runtime | `subject-core` |
| `@characteros-next/long-term-state-domain` | production / domain boundary contract | 明确 PERSONALITY/BELIEF/RELATIONSHIP 的 applicability 与 target grammar；本身不授权 update | `subject-core` |
| `@characteros-next/personality` | production / domain producer | evidence channel、semantic routing 与 bounded personality plasticity proposal production；canonical transition executor 当前仍在 runtime | `influence-evidence`, `memory`, `memory-influence`, `runtime`, `subject-core` |
| `@characteros-next/belief` | compatibility shell / deferred package ownership | 当前 public surface 为空；canonical schema 在 subject-core，实际 belief producer/executor/semantic workflow 在 runtime | 无 |
| `@characteros-next/relationship` | compatibility shell / deferred package ownership | 当前 public surface 为空；canonical schema 在 subject-core，实际 relationship producer/executor/semantic/familiarity workflow 在 runtime | 无 |
| `@characteros-next/regulation` | compatibility shell / type marker | 仅保留 placeholder type surface；canonical schema 在 subject-core，实际 RegulationProducerPort、reference producer 与 Time orchestration 在 runtime | 无 |
| `@characteros-next/runtime` | production / trusted orchestration + transition implementation | composition root、ports、Observation/Time/Cognition/Action/Learning transitions、providers、authority adapters，以及当前 belief/relationship/regulation transition 实现；只 mint/route domain deltas，最终 canonical commit 仍由 subject-core 执行 | `affect`, `appraisal`, `behavior`, `influence-evidence`, `memory`, `memory-influence`, `subject-core` |
| `@characteros-next/sandbox` | product / thin adapter | conversation response、delivery/ingress receipt 与 feedback 的薄 host-facing adapter；不绕过 runtime/subject-core authority | `runtime` |

**当前依赖纪律：** workspace import 必须走 public package root，并同时满足 `package.json`
声明与 `eslint.config.mjs` 的 per-package allowlist。`subject-core` 不依赖其他 workspace；
evaluation/research 资产不得成为 production source dependency。`[DESIGN DECISION]`

**Producer != Mutator（P9）：** 非 `subject-core` 模块可以验证 proposal、计算 delta 或执行
orchestration，但不得直接 mutate canonical SubjectState；canonical commit 永远由
`subject-core` 执行。`[DESIGN DECISION — SubjectState V0 spec §5 / transition-contracts §5]`

### 7.1 当前 ownership drift（记录现实，不在本 slice 搬迁）

- **Belief：** `@characteros-next/belief` 是空壳；production transition、plasticity、semantic
  target resolution/provider 与 workflow 当前位于 `runtime/src/transitions/belief/`。
- **Relationship：** `@characteros-next/relationship` 是空壳；production transition、plasticity、
  semantic/familiarity 与 governed-write orchestration 当前位于
  `runtime/src/transitions/relationship/` 和 `runtime/src/authority/`。
- **Regulation：** `@characteros-next/regulation` 仅暴露 placeholder types；实际 port、reference
  producer 与 TimeTransition integration 当前位于 `runtime`。

以上是 **CURRENT IMPLEMENTATION**，不是理想化 dependency direction。将实现移动到同名 domain
package、改变 public exports/dependency graph、或改变 Belief/Relationship/Regulation 语义均属于未来
cleanup，**NOT AUTHORIZED IN THIS GOVERNANCE SLICE**。

**Memory 拆分：** `memory` 承载 records/repository/revision/retrieval；`memory-influence` 只做
read-time influence projection；`influence-evidence` 只做显式集合 aggregation/eligibility。
三者均无 canonical SubjectState mutation authority。边界见 §5.1 与 transition-contracts §18。

---

## 8. 五个权威答案（一致性锚点）

本仓库全部文档必须对这五问给出一致答案：

1. **权威状态在哪里？** → SubjectState（canonical，单写入口 = subject-core generic validation + atomic commit；domain rule不在core）。
2. **记忆属于谁？** → MemoryState 属于 SubjectState；MemoryRepository 只是存储设施。
3. **没有外部事件时会继续变化吗？** → 会，经 TimeTransition。
4. **每个 tick 必须行动吗？** → 不必须，Action 是 optional。
5. **FAST+EMA 是情绪理论吗？** → 不是，只是 V0 reference persistence implementation + research baseline。

---

## 9. 与旧仓库的关系（架构层面）

- 旧 CharacterOS（deterministic kernel）与 CharacterOS emotion（研究线）都是**外部只读源**：本仓库不复制其代码，只引用其结论（见 `MIGRATION_MAP.md`）。
- 旧仓库的机制（FAST+EMA 规则、Phase 5 因果链、B2 的 FSM 结论）以**文档级引用**进入本仓库的 `VERIFIED` 依据，不以代码进入。
- 任何未来实现若需复用旧机制代码，必须走 MIGRATION_MAP 的 ADAPT 流程并记录来源 SHA。
