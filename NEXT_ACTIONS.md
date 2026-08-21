# NEXT_ACTIONS.md — P1 三个最高优先级动作（历史）与当前阶段交接

**规则:** 本文件保留三个已完成 P1 设计动作作为审计记录；当前执行/授权状态以末节为准。P2.0 只搭工程骨架，P2.1 planning 只定义实施计划；两者都不构成 runtime implementation、实验或迁移授权。

---

## 动作 1 — SubjectState V0 正式规格（spec）· COMPLETE

**状态:** ✅ COMPLETE（2026-08-17）——产物 `docs/architecture/subjectstate-v0-spec.md`。

**优先级理由:** 所有包、所有 transition 契约、所有迁移目标都锚定在 SubjectState 上；没有正式 spec，后续一切设计都会漂移。

**产出（设计文档，写入 `docs/architecture/subjectstate-v0-spec.md`）:**
- 十层状态的 V0 字段清单：每层字段名、类型、值域、缺省值、时间尺度、transition producer、canonical mutator、读取者（在 `ARCHITECTURE.md` §4/§5 的概念模型上裁定正式版本）
- **MemoryState ownership**：canonical MemoryState 字段（working refs / active episode refs / autobiographical index / store revision / consolidation cursor / retrieval config / recent retrieval trace / lifecycle metadata）与 MemoryRepository（infrastructure）的边界
- **runtime_metadata**：subject version / logical time / last transition time / state revision 的正式字段与语义
- **transition 兼容的时间语义**：哪层随 TimeTransition 演化、哪层仅随 Observation/Learning 演化（对应 ARCHITECTURE §3）
- V0 写规则表：允许的状态转换全集（FAST 状态机转换、EMA 更新/衰减、上下文更新、记忆引用/revision/cursor 更新）+ 每条规则的 cause-trace 记录格式
- cause-trace 格式：`{transition, layer, rule, cause_ref, from, to}` 的正式字段与不变量
- 序列化与持久化边界：哪些层跨 session 持久、哪些每 transition 重置、哪些仅内存（对应约束 A 缺口 #3）
- **storage reference vs canonical state ownership**：明确哪些内容属于 canonical state、哪些属于 storage
- 明确标注每一条是 `DESIGN DECISION` / `HYPOTHESIS` / `UNKNOWN`

**禁止:** 写实现代码；定义 V0 之外的层动态（Traits 漂移、Belief 更新等）；引入任何新机制（COUNTER/INTENSITY/TED/learned 均禁止——V0 动态 = FAST+EMA-derived reference persistence，参数标记为 legacy reference defaults）。

**验收:** spec 完成且每条字段/转换可追溯到 ARCHITECTURE.md 与两个约束；无实现产物。

---

## 动作 2 — Canonical Transition Contracts · COMPLETE（CONSISTENCY CLOSED）

**状态:** ✅ COMPLETE / CONSISTENCY CLOSED（2026-08-17）——产物 `docs/architecture/transition-contracts.md`（含 Action 2 Consistency Closure 封口修订）。

**优先级理由:** transition system 目前只有四类名称；没有每类的输入/输出/不变量契约，MICL（动作 3）无法开工，后续包边界也会模糊。

**产出（设计文档，写入 `docs/architecture/transition-contracts.md`）:**
- 四类 transition 逐一定义：输入（类型/来源）、输出（类型/去向）、前置条件、后置条件、失败语义（阶段不可用时如何降级）
  - **TimeTransition**（elapsed time → regulation / affect decay / mood settling / consolidation eligibility → 下一状态；无外部事件也可发生）
  - **ObservationTransition**（Observation → Perception → Retrieval → Interpretation → Appraisal → Affect update）
  - **Cognition/ActionTransition**（Cognition/Motivation → Policy → optional Action）
  - **LearningTransition**（Outcome/Experience → Encoding → Consolidation → Belief/Relationship/Plasticity update）
- **Full Subject-World Lifecycle 的组合语义**：15 阶段 reference 如何由四类 transition 串联；哪些边是硬性（Appraisal 先于 Affect；Retrieval 先于 Appraisal），哪些边 optional（Action/Environment/Outcome 仅当外部动作发生）
- LLM 触点清单：哪些 transition 可调用 LLM（Observation 的 interpretation/appraisal 提案、Cognition 的 reasoning、Action 的 policy 生成、表达），每个触点的提案协议字段（概念级，对应 ARCHITECTURE §6.3）
- **时间语义契约**：Appraisal 使用 time-normalized 当前状态（TimeTransition 先于 Appraisal 求值）
- **failure / rollback 语义**：失败的 LLM 提案不得损坏 canonical state；rollback 边界

**禁止:** 写实现代码；决定具体模型/框架；把 UNKNOWN 阶段（多模态感知、Belief 更新规则）伪造成有契约。

**验收:** 四类 transition 契约表完整；硬性顺序不变量显式列出；时间语义契约明确；LLM 触点与 B1–B6 边界一致。

---

## 动作 3 — MICL 设计（Minimal Internal Continuity Loop）· COMPLETE

**状态:** ✅ COMPLETE（2026-08-17）——产物 `docs/architecture/micl-design.md`。

**优先级理由:** 这是两个审计共同指向的最小增量：约束 A 缺口 #1/#5（Retrieval/Appraisal 先于 Affect + 自传式检索）与约束 B（FAST+EMA reference persistence）的交点。它是 P2（sandbox 实现）的唯一前置。

**MICL 定义（内部连续性环，不是 agent-environment 完整闭环）：**

```text
SubjectState(t)
  → TimeTransition           （time normalization）
  → Observation
  → Perception
  → Memory Retrieval
  → Subjective Interpretation
  → Appraisal
  → Affect Update
  → Experience Encoding
  → SubjectState(t+1)
```

**产出（设计文档，写入 `docs/architecture/micl-design.md`）:**
- MICL 范围声明：**不含** world simulation、**不含** external action requirement；只验证内部状态连续性（对应架构五问 Q3/Q4）
- Memory Retrieval 设计问题：V0 检索基础特征 = semantic relevance、context relevance、recency、salience、entity/relationship relevance；检索结果进入 Interpretation（不进入 canonical state，只作输入）
  - **affect/mood congruence 明确降级为 `HYPOTHESIS`，不是 V0 强制检索键**（避免 sad→negative→sadder 自激风险）
- Appraisal 设计问题：结构化评价维度（相关性/目标关系/归因/强度）的 V0 最小集；LLM 提案 + Core 校验边界（哪些维度必须 Core 决定，哪些允许 LLM 提案）
- persistent Affect 设计问题：FAST+EMA-derived reference persistence 的 V0 语义（legacy reference defaults：tHold=60、α=0.06、τ=150、clamp=0.25）与跨 session 恢复语义；明确这些是 reference baseline，**不是** canonical affect theory
- 不变量：状态单写入口、cause-trace 全覆盖、慢层不被快事件直改、TimeTransition 先于 Appraisal
- 标注 baseline 策略：任何机制选择必须声明与 FAST+EMA（以及未来与 Memory+LLM 每轮重算）的比较关系
- **Engineering Acceptance Contract 可测性**：设计必须能被 ROADMAP §5 的 A1–A10 契约检验（determinism / memory ownership / retrieval relevance / appraisal dependency / affect continuity / state authority / cause trace / time semantics / optional action / failure semantics）

**禁止:** 写实现代码；引入 COUNTER/INTENSITY/learned 机制；把设计文档写成实验协议（不预注册、不开 CERH、不跑任何测量）；把 affect-congruent retrieval 写成 V0 要求。

**验收:** MICL 设计文档完成，数据流、写规则、时间语义、LLM 边界闭环可读；与 SubjectState V0 spec（动作 1）和 transition contracts（动作 2）一致；无实现产物。

---

## 当前阶段交接

- P1 动作 1–3、P1.5 与 P2 runtime plan 均 **COMPLETE**。
- P2.0 Runtime Bootstrap **COMPLETE**；工程骨架不包含 domain/runtime behavior。
- P2.1 Subject Core Implementation Planning **COMPLETE**；产物为 `docs/implementation/p2-1-subject-core-plan.md`，未创建 commit engine、mutation logic 或测试。
- **NEXT STEP = P2.1 Subject Core Implementation — NOT STARTED / REQUIRES EXPLICIT AUTHORIZATION**；不得自动开始，且必须先满足 P2 runtime plan §15 与 P2.1 plan §1.2 的 applicable coding entry gates。
- P3、P4、研究触发与旧代码迁移保持未授权。
