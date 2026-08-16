# ROADMAP.md — CharacterOS-Next 路线图

**状态:** 骨架阶段文档。本路线图只定义阶段与门禁，不授权任何实现/实验在当前阶段发生。

---

## 1. 阶段总览

| 阶段 | 名称 | 内容 | 状态 |
|---|---|---|---|
| **P0** | 工程骨架（当前） | 骨架、架构宪法、研究状态、迁移地图、SubjectState V0 概念模型、causal loop 定义 | **进行中（本阶段）** |
| P1 | 最小闭环设计 | Memory Retrieval + Appraisal + persistent Affect 的**设计文档**（非实现） | 未开始（NEXT_ACTIONS #3） |
| P2 | 最小闭环实现（产品 sandbox） | 在 product/sandbox 内实现 P1 设计的最小可运行版本；无研究实验 | 未授权 |
| P3 | 迁移执行 | 按 MIGRATION_MAP 逐项执行 ADAPT/BASELINE 迁移（每项独立审批） | 未授权 |
| P4 | 评估资产建设 | evals/ 三组 baseline + longitudinal/ablation/regression 骨架 | 未授权 |
| P5+ | 触发式扩展 | 仅当研究触发条件命中（§3）才开放对应研究/实验 | 未授权 |

---

## 2. P0 完成标准（当前阶段的验收）

1. 七个根文档（README/VISION/ARCHITECTURE/ROADMAP/RESEARCH_STATE/MIGRATION_MAP/NEXT_ACTIONS）完整且互相一致。`[DESIGN DECISION]`
2. SubjectState V0 概念模型已定义（不做实现）。`[DESIGN DECISION]`
3. canonical causal loop 已定义（15 阶段 + 顺序约束）。`[DESIGN DECISION]`
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
| G4 | **NO product feature development**：P0/P1 阶段不开发产品功能 |
| G5 | **NO claim of achieved long-lived agency**：长期主体是愿景，不是现状 |
| G6 | 任何机制进入实现前必须声明其 baseline 策略（FAST+EMA / LINEAR-G / Memory+LLM 每轮重算，择对应问题形态） |

---

## 5. 每阶段的准入证据

- **P1 准入** = P0 验收完成（§2）。
- **P2 准入** = P1 设计文档完成 + 人类批准（实现不得先于设计）。
- **P3 准入** = P2 最小闭环在 sandbox 可运行 + 每项迁移单独审批。
- **研究触发（T1–T8）准入** = 真实产品现象证据 + 独立 Phase 0 + 预注册 + 审批链（继承 CERH 纪律）。

---

## 6. 路线图与两个审计的关系

- 约束 A（旧仓库 7 缺口）→ 全部进入 P1/P2 设计范围（顺序、持久化、闭环、自传记忆、关系一等状态、时间尺度分层）。
- 约束 B（Emotion 审计）→ P0 已固化（目标重定义、FAST+EMA 身份、LLM 边界、no-overclaim）；T1–T8 决定未来研究是否重开。
