# NEXT_ACTIONS.md — 接下来的 3 个最高优先级动作

**规则:** 本文件只允许列 3 个动作。完成或修订本文件需更新全部七个根文档保持一致。三个动作全部是**设计动作**：不实现、不实验、不迁移。

---

## 动作 1 — SubjectState V0 正式规格（spec）

**优先级理由:** 所有包、所有阶段契约、所有迁移目标都锚定在 SubjectState 上；没有正式 spec，后续一切设计都会漂移。

**产出（设计文档，写入 `docs/architecture/subjectstate-v0-spec.md`）:**
- 九层状态的 V0 字段清单：每层字段名、类型、值域、缺省值、时间尺度、写入者、读取者（在 `ARCHITECTURE.md` §4/§5 的概念模型上裁定正式版本）
- V0 写规则表：允许的状态转换全集（FAST 状态机转换、EMA 更新/衰减、上下文更新）+ 每条规则的 cause-trace 记录格式
- cause-trace 格式：`{tick, layer, rule, cause_ref, from, to}` 的正式字段与不变量
- 序列化与持久化边界：哪些层跨 session 持久、哪些每 tick 重置、哪些仅内存（对应约束 A 缺口 #3）
- 明确标注每一条是 `DESIGN DECISION` / `HYPOTHESIS` / `UNKNOWN`

**禁止:** 写实现代码；定义 V0 之外的层动态（Traits 漂移、Belief 更新等）；引入任何新机制（COUNTER/INTENSITY/learned 均禁止——V0 动态 = FAST+EMA canonical 参数）。

**验收:** spec 完成且每条字段/转换可追溯到 ARCHITECTURE.md 与两个约束；无实现产物。

---

## 动作 2 — Causal Loop 阶段契约（stage contracts）

**优先级理由:** 15 阶段环目前只有名称；没有每阶段的输入/输出/不变量契约，最小闭环（动作 3）无法开工，后续包边界也会模糊。

**产出（设计文档，写入 `docs/architecture/causal-loop-contracts.md`）:**
- 对 15 个阶段逐一定义：输入（类型/来源）、输出（类型/去向）、前置条件、后置条件、失败语义（阶段不可用时 tick 如何降级）
- 顺序约束的形式化：哪些边是硬性（Appraisal 必须先于 Affect；Retrieval 先于 Appraisal），哪些边允许 V0 直通（Identity/Traits 只读旁路）
- LLM 触点清单：哪些阶段可调用 LLM（(3) interpretation 提案、(4) appraisal 提案、(6) reasoning、(7) policy 生成、(11) 表达）、每个触点的提案协议字段（概念级，对应 ARCHITECTURE §6.3）
- tick 模型：tick 边界、事件与时间推进的关系、跨 session 恢复语义（概念级）

**禁止:** 写实现代码；决定具体模型/框架；把 UNKNOWN 阶段（多模态感知、Belief 更新规则）伪造成有契约。

**验收:** 15 阶段契约表完整；硬性顺序约束显式列出；LLM 触点与 B1–B6 边界一致。

---

## 动作 3 — 最小闭环设计：Memory Retrieval + Appraisal + persistent Affect

**优先级理由:** 这是两个审计共同指向的最小增量：约束 A 缺口 #1/#5（Retrieval/Appraisal 先于 Affect + 自传式检索）与约束 B（FAST+EMA minimal persistence）的交点。它是 P2（sandbox 实现）的唯一前置。

**产出（设计文档，写入 `docs/architecture/minimal-closed-loop-design.md`）:**
- 最小闭环范围声明：Observation → Perception(text) → Memory Retrieval → Interpretation → Appraisal → Affect(FAST+EMA) → 状态投影 →（表达/行为留给后续阶段）→ Experience Encoding → 下一 tick。明确**不含**动作执行与世界模拟（那是 P2+ 的范围）
- Memory Retrieval 的设计问题：检索键 = 事件语义 × 当前 context × 当前 affect 基线（对应缺口 #5 的 autobiographical/context-sensitive 方向）；检索结果如何进入 Interpretation（不进入 canonical state，只作输入）
- Appraisal 的设计问题：结构化评价维度（相关性/目标关系/归因/强度）的 V0 最小集；LLM 提案 + Core 校验的边界（哪些维度必须 Core 决定，哪些允许 LLM 提案）
- persistent Affect 的设计问题：FAST+EMA 的 V0 参数（canonical 缺省：tHold=60、α=0.06、τ=150、clamp=0.25）与跨 session 恢复语义
- 不变量：状态单写入口、cause-trace 全覆盖、慢层不被快事件直改
- 标注 baseline 策略：任何机制选择必须声明与 FAST+EMA（以及未来与 Memory+LLM 每轮重算）的比较关系

**禁止:** 写实现代码；引入 COUNTER/INTENSITY/learned 机制；把设计文档写成实验协议（不预注册、不开 CERH、不跑任何测量）。

**验收:** 设计文档完成，三个子系统的数据流、写规则、LLM 边界闭环可读；与 SubjectState V0 spec（动作 1）和阶段契约（动作 2）一致；无实现产物。

---

## 三个动作之外的一切

- 迁移执行（P3）、实现（P2）、评估建设（P4）、研究触发（T1–T8）全部保持未授权。
- 三个动作完成后，本文件将被重写为下一组动作；在此之前不得加第 4 条。
