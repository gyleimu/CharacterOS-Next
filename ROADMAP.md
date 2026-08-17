# ROADMAP.md — CharacterOS-Next 路线图

**状态:** 设计文档（Formal Design）。本路线图只定义阶段与门禁，不授权任何实现/实验在当前阶段发生。

---

## 1. 阶段总览

| 阶段 | 名称 | 内容 | 状态 |
|---|---|---|---|
| **P0** | Architecture Foundation | 骨架、架构宪法、研究状态、迁移地图、SubjectState V0 概念模型、canonical transition system | **COMPLETE** |
| **P0.5** | Architecture Correction | P0 宪法修订（MemoryState ownership、transition runtime、time 一等语义、FAST+EMA 身份、证据标签、MICL 术语） | **COMPLETE** |
| **P1** | Formal Design | SubjectState V0 spec + transition contracts + MICL 设计（NEXT_ACTIONS #1–3，纯设计） | **IN PROGRESS（CURRENT）** |
| **P1.5** | Engineering Acceptance / Evaluation Contract | 定义 A1–A10 工程行为契约；不运行科学实验 | 未开始（P2 实现前强制门禁） |
| **P2** | Minimal Runtime Implementation | 在 product/sandbox 内实现 MICL 的最小可运行版本；无研究实验 | 未授权 |
| **P3** | Controlled Migration | 按 MIGRATION_MAP 逐项执行（每项独立审批） | 未授权 |
| **P4** | Empirical Evaluation / Benchmarks | evals/ 三组 baseline + longitudinal/ablation/regression | 未授权 |
| **P5+** | Triggered Research | 仅当研究触发条件命中（§3）才开放对应研究/实验 | 未授权 |

---

## 2. P0 / P0.5 完成标准（当前阶段的验收）

1. 七个根文档（README/VISION/ARCHITECTURE/ROADMAP/RESEARCH_STATE/MIGRATION_MAP/NEXT_ACTIONS）完整且互相一致。`[DESIGN DECISION]`
2. SubjectState V0 概念模型已定义（含 MemoryState ownership + runtime metadata；不做实现）。`[DESIGN DECISION]`
3. canonical transition system 已定义（Time / Observation / Cognition-Action / Learning 四类 transition + 不变量）。`[DESIGN DECISION]`
4. LLM boundary 已定义为宪法规则（B1–B6）。`[DESIGN DECISION]`
5. 迁移分类体系 + 迁移表完成（只写计划）。`[DESIGN DECISION]`
6. 全部结论带 VERIFIED / DESIGN DECISION / HYPOTHESIS / UNKNOWN 标签。
7. 未创建任何实现代码、未启动任何实验、未移动任何旧文件。

---

## 3. 研究触发条件（Emotion 审计 B 的 8 条，逐字继承）

以下任何一条真实产品现象出现，才允许为对应机制问题开放研究（Phase 0 + 预注册 + 审批链）；在此之前，纯 Dynamics 研究保持 PAUSE。

| # | 产品现象 | 对应研究问题 |
|---|---|---|
| T1 | state resets across sessions | 外部状态 vs 内存检索重算的连续性质 |
| T2 | history compression destroys emotion continuity | 状态在压缩下的不变量；Emotion × Memory |
| T3 | one event overwrites long history | 冲突历史结构（替代单标量 EMA） |
| T4 | multimodal behavior inconsistency | 多通道共享状态的因果价值 |
| T5 | memory/state divergence | 状态↔记忆同步机制 |
| T6 | prompt injection overrides state | 外部状态权威的增量价值 |
| T7 | long-horizon instability | 多时间尺度 |
| T8 | context distinction demand | context 区分 |

`[VERIFIED — 约束 B / Emotion 审计 NEXT_DIRECTION_DECISION §3]`

---

## 4. 硬性门禁（违反即 STOP/REPORT）

| 门禁 | 内容 |
|---|---|
| G1 | **NO DEV_004**：禁止任何新实验编号，直到 T1–T8 之一被产品证据触发且独立 Phase 0 完成 |
| G2 | **NO new dynamics experiment**：本仓库不产生任何新动力学实验 |
| G3 | **NO bulk code migration**：任何旧代码进入本仓库必须按 MIGRATION_MAP 单项审批 + 来源 SHA 记录 |
| G4 | **NO product feature development**：P0/P0.5/P1 阶段不开发产品功能 |
| G5 | **NO claim of achieved long-lived agency**：长期主体是愿景，不是现状 |
| G6 | 任何机制进入实现前必须声明其 baseline 策略（FAST+EMA / LINEAR-G / Memory+LLM 每轮重算，择对应问题形态） |
| G7 | **Evaluation/Acceptance contract 先于实现**：P2 实现前必须完成 P1.5（A1–A10） |

---

## 5. P1.5 Engineering Acceptance Contract（A1–A10）

> 这是**工程行为契约**，不是研究 benchmark。它在 P2 实现前强制完成，且不运行科学实验。

| # | 契约 | 含义 |
|---|---|---|
| A1 | Determinism | same state + same input + same time → same transition result |
| A2 | Memory ownership | restored subject references same canonical memory revision |
| A3 | Retrieval relevance | different relevant memory histories can produce different retrieved context |
| A4 | Appraisal dependency | Appraisal cannot bypass Retrieval / Current SubjectState inputs |
| A5 | Persistent affect continuity | session restore / time advance preserves valid persistent affect semantics |
| A6 | State authority | LLM output cannot directly mutate canonical state |
| A7 | Cause trace | all canonical writes have trace/provenance |
| A8 | Time semantics | state can evolve through time without requiring an external observation |
| A9 | Optional action | tick can legally complete with no external action |
| A10 | Failure semantics | a failed LLM proposal does not corrupt canonical state |

`[DESIGN DECISION — P0-6：evaluation/acceptance contract 前移到 implementation 之前]`

---

## 6. 每阶段的准入证据

- **P0.5 准入** = P0 骨架完成。
- **P1 准入** = P0.5 验收完成（§2）。
- **P1.5 准入** = P1 设计文档（SubjectState V0 spec + transition contracts + MICL design）完成。
- **P2 准入** = P1.5 完成（A1–A10 契约）+ 人类批准（实现不得先于设计 + 不得先于 acceptance contract）。
- **P3 准入** = P2 MICL 在 sandbox 可运行 + 每项迁移单独审批。
- **研究触发（T1–T8）准入** = 真实产品现象证据 + 独立 Phase 0 + 预注册 + 审批链（继承 CERH 纪律）。

---

## 7. 路线图与两个审计的关系

- 约束 A（旧仓库 7 缺口）→ 全部进入 P1/P2 设计范围（顺序、持久化、闭环由 transition 组合实现、自传记忆、关系一等状态、时间尺度分层）。
- 约束 B（Emotion 审计）→ P0/P0.5 已固化（目标重定义、FAST+EMA reference identity、LLM 边界、no-overclaim）；T1–T8 决定未来研究是否重开。
