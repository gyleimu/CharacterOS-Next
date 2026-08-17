# MIGRATION_MAP.md — 旧资产迁移地图（只写计划，不执行）

**状态:** 设计文档（Formal Design）。本文件**不移动、不复制、不修改**任何旧文件；只定义分类与迁移计划。任何实际迁移必须逐项经 ROADMAP G3 门禁（单项审批 + 来源 SHA 记录）。

---

## 1. 迁移分类体系（六类）

| 分类 | 含义 | 进入本仓库的方式 |
|---|---|---|
| **KEEP** | 保持现状，不迁移（原地继续使用/维护） | 不进入；只在文档中记录引用关系 |
| **ADAPT** | 保留核心逻辑/结论，适配新架构后进入 | 未来：设计级引用或逐文件带 SHA 迁移（G3 门禁） |
| **REWRITE** | 结论保留、实现重写（缺口修复类） | 未来：新设计文档 → 新实现 |
| **BASELINE_ONLY** | 只作为评估基线/比较器保留 | 未来：进入 evals/baselines/ 或作为只读引用 |
| **RESEARCH_HYPOTHESIS** | 只保留假设与问题，不保留代码 | 进入 research/hypotheses/（文档级） |
| **ARCHIVE** | 只读归档，历史参考 | 停留在旧仓库（或未来 archive/ 只读快照；当前不移动） |

> 说明：单项资产可标注**混合分类**（如 `ADAPT + REWRITE`），表示"设计概念 ADAPT、旧语义/实现 REWRITE"。

---

## 2. 旧 CharacterOS（主仓库，deterministic kernel + 产品）迁移表

> 依据：约束 A（7 缺口 + 旧仓库定位）。本表基于审计 A 结论与已知目录结构；未经本会话逐文件核验的条目标注 `UNKNOWN`（细节待迁移时核验）。

| 旧资产（区域） | 内容 | 分类 | 去向 | 依据/理由 |
|---|---|---|---|---|
| 核心 deterministic kernel（emotion/时间/漂移/解释性模块） | 成熟的确定性心理模拟内核 | **ADAPT** | packages/ 设计参考 + mechanism library 笔记（未来逐模块迁移） | 约束 A：legacy implementation + mechanism library，不是废弃项目 |
| event-centric state transition 语义 | 事件驱动状态转移 | **REWRITE** | canonical transition system（ARCHITECTURE §3） | 约束 A 缺口 #1（顺序错误）与 #4（无闭环）；新体系用多 transition + TimeTransition |
| Emotion 模块（非持久） | 当前 emotion 非 persistent state | **REWRITE** | packages/affect（V0 = FAST+EMA-derived reference persistence implementation） | 约束 A 缺口 #2 + 约束 B（FAST+EMA reference identity，非理论） |
| **Memory 簇（MemoryState ownership / repository / retrieval / encoding / consolidation）** | 记忆检索不够 autobiographical/context-sensitive | **ADAPT + REWRITE**（拆分） | ① MemoryState ownership model = ADAPT 概念；② repository/存储 = ADAPT 基础设施经验；③ retrieval/encoding/consolidation = REWRITE | 约束 A 缺口 #5；架构修订 P0-1（MemoryState 属于 SubjectState，MemoryRepository 是基础设施） |
| Life state 持久化（prisma 等） | 未完整跨 tick 持久化 | **REWRITE**（设计级 ADAPT 持久化经验） | packages/subject-core 持久层设计（含 runtime_metadata/state_revision） | 约束 A 缺口 #3 |
| Behavior pipeline（src/character 等 Track A 侧） | 未形成 Action→World→Consequence→Experience 闭环 | **REWRITE** | packages/behavior + runtime（闭环由 transition 组合实现，Action optional） | 约束 A 缺口 #4 |
| Relationship 模块 | 尚非一等长期状态 | **REWRITE** | packages/relationship（十层状态之一） | 约束 A 缺口 #6 |
| Personality / trust / attachment / fear | 时间尺度混层 | **REWRITE**（分层设计） | packages/personality + 分层规则（Identity 不含自传历史） | 约束 A 缺口 #7；架构修订 P0-7 |
| **Determinism / replay / trace / audit 基础设施** | 确定性、重放、追溯、审计 | **ADAPT（强）/ KEEP-as-reference** | Subject Runtime 的核心基础设施资产（determinism A1、cause-trace A7） | 约束 A：deterministic kernel；这是新 runtime 的重要资产，不应丢失 |
| **Homeostasis / Recovery / Life Tick 概念** | 稳态/恢复/生命 tick | **ADAPT（设计概念）+ REWRITE（旧持久化/状态语义）** | TimeTransition（ARCHITECTURE §3.1）的设计参考 | 架构修订 P0-3：time 一等语义 |
| **WorldModel**（`src/core/worldmodel/worldModel.ts`） | 世界/情境模型：使用 beliefs、personality coordinate、meta state、psychological boundary、time perception，计算 threatBias、trustBias、ambiguity、subjective interpretation、interpretation frame | **ADAPT**（候选，`TO_BE_ASSESSED`） | Subjective Interpretation / Appraisal 的前置参考（概念级） | `VERIFIED`（独立复核确认该 legacy asset 存在）；是否适合迁移 = `TO_BE_ASSESSED / DESIGN REVIEW REQUIRED`（不复制源码） |
| 产品应用层（UI、render、mindspace 等） | 现有产品实现 | **KEEP**（当前不迁移，继续原地维护） | 不进入本仓库；未来产品决策单独裁定 | 约束 A：旧仓库非废弃；本阶段无产品开发 |
| tests / 测试资产 | 内核测试与验证资产 | **ADAPT**（作为回归资产引用；迁移需 SHA 记录） | evals/regression（未来） | 约束 A：test/evaluation asset |

---

## 3. 旧 CharacterOS emotion（研究仓库）资产迁移表

> 依据：约束 B（Emotion 全路线审计）+ EXPERIMENT_INDEX/E01–E39 谱系。

| 资产 | 内容 | 分类 | 去向 | 依据/理由 |
|---|---|---|---|---|
| `experiments/emotion-plasticity/`（FAST+EMA、COUNTER、INTENSITY） | minimal core 与基线族 | **ADAPT**（V0 reference implementation）+ **BASELINE_ONLY**（研究侧身份） | packages/affect（reference persistence 设计参考）+ evals/baselines/fast-ema | 约束 B：FAST+EMA = reference persistence + BASELINE_ONLY；**不是** canonical affect theory |
| `experiments/b2-discovery/`（P-A/P-A2/FSM-SLOW/SOFT-FSM-SLOW） | DROP_ATTRACTOR 决策链 | **ARCHIVE**（机制）；结论 → mechanism library 笔记（FAST/SLOW 分离、简单机制优先） | archive/（只读引用；当前不移动） | 约束 B：attractor 必要性已证伪，VALIDLY_DROPPED |
| A 系列（A1→A1-R1→A2.1→A2.2→A2.3/b→A2.4/A2.5） | 吸引子 sandbox | **ARCHIVE**；A2.2 反模式存储几何教训 → ADAPT 为存储设计笔记 | archive/ + docs/theory 设计教训 | 约束 B：ARCHIVED/OPTIONAL；A2.4/A2.5 存储几何结论保留 |
| `experiments/ted-v0/`（含 200 轨迹冻结产物） | 首个 learned candidate（有效阴性） | **ARCHIVE**（冻结产物只读）；失败机制 → RESEARCH_HYPOTHESIS（Q18 objective-design） | archive/ + research/hypotheses | 约束 B：Route D candidate-scoped；learned line STOP unless Q18 |
| `experiments/emotion-plasticity/ted-successor-phase0/`（TED 失败机制审计 + SANDBOX-V2） | 归因结论 | **ADAPT**（结论级：负锁=learned-plasticity 共享属性等） | research/hypotheses + docs/theory | 约束 B：三因子归因闭环 |
| Appraisal 线（phase1/2 历史 + benchmark-v1 修复版） | appraisal 基准 | **BASELINE_ONLY**（修复后 benchmark 为 evals 资产）+ RESEARCH_HYPOTHESIS（E5 机制） | evals/ + research/appraisal | 约束 B：E37 PARTIALLY_RECONFIRMED；Phase 3 未授权 |
| Phase 4.10.1x / 4.11 / 4.12（残差校准、放大、动态吸引子候选） | 早期机制探索 | **ARCHIVE**；8 条科学教训 → ADAPT 为设计笔记 | archive/ + docs/theory | 约束 B：多数 INVALID/NO-GO，仅教训有效 |
| Phase 5（5.0–5.2 因果链基准） | 事件→记忆→状态→行为链 | **ADAPT**（链本体结论）+ **BASELINE_ONLY**（5.2 基准测量待修复） | transition system 设计（LearningTransition 组合）+ evals/regression | 约束 A/B：链本体 90–100% 通过；测量设计产物待修 |
| `research/emotion/` 状态文档（CURRENT_STATE、EXPERIMENT_INDEX、GRAPH、OPEN_QUESTIONS） | 研究状态索引 | **ADAPT**（结论级）→ 已并入本仓库 RESEARCH_STATE；原件 ARCHIVE | research/emotion 指针文档（未来） | 约束 B |
| CERH DEV_001 / DEV_002 / DEV_003 worktree（协议/证据/cerh store） | CERH 实验记录 | **ARCHIVE**（证据与协议只读；结论已并入约束 B） | 原地只读；本仓库只保留结论引用 | 约束 B |
| CERH v0.1（工具与 release） | 实验生命周期工具 | **KEEP**（外部工具，不迁移；未来实验沿用其纪律） | 不进入本仓库 | 约束 B：未来实验走独立 CERH workspace |
| v0.1 引擎早期资产（E01–E09） | 开发期引擎 | **ARCHIVE** | archive/ 引用 | 无科研结论，工程历史 |

---

## 4. 迁移执行规则（未来，本阶段不执行）

1. 每项迁移 = 一个独立审批单元：写明 分类 / 来源路径 / 来源 SHA256 / 目标路径 / 理由 / 与哪个约束结论对应。
2. 任何实现代码进入 packages/ 之前必须：完成对应设计文档 → 人类批准 → 记录来源 SHA。
3. 冻结产物（zip/sealed evidence）**永不消费科学输入**（继承 CERH 纪律）；只能引用其结论。
4. 迁移顺序由 ROADMAP P3 决定；**当前禁止任何批量迁移**。

---

## 5. 迁移状态总览（本阶段快照）

```text
KEEP         : 旧产品应用层、CERH v0.1 工具、determinism/replay/trace/audit 基础设施（KEEP-as-reference）
ADAPT        : kernel 机制库、FAST+EMA（reference implementation）、Phase 5 链结论、TED 归因结论、
               8 条教训、appraisal benchmark、MemoryState ownership 概念、Homeostasis/Life Tick 设计概念
REWRITE      : 事件语义、emotion 持久化、life state 持久化、行为闭环（transition 组合）、
               memory retrieval/encoding/consolidation、关系、时间尺度分层
BASELINE_ONLY: FAST+EMA、appraisal benchmark、Phase 5.2（测量修复后）
RESEARCH_HYPOTHESIS: TED Q18 objective-design、E5 机制、affect-congruent retrieval、T1–T8 触发问题
ARCHIVE      : attractor 全系列、TED-v0、4.10–4.12、DEV_001/002/003 记录、v0.1 引擎早期资产
```
