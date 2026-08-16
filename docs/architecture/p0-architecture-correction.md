# P0 Architecture Correction — 修订记录

**日期:** 2026-08-17
**类型:** 架构宪法修订（非实现、非实验、非迁移）
**状态:** 已完成（本文件是修订的可追溯记录）
**影响文档:** README.md / VISION.md / ARCHITECTURE.md / ROADMAP.md / RESEARCH_STATE.md / MIGRATION_MAP.md / NEXT_ACTIONS.md

---

## 1. 问题清单（为何修订）

早期 P0 骨架方向正确，但存在七类结构性矛盾，需要修正：

| # | 问题 | 严重性 |
|---|---|---|
| P0-1 | SubjectState 声称是唯一长期权威，但没有 memory 字段；memory 被隐含当成外部 RAG → 破坏"主体拥有记忆" | 高 |
| P0-2 | "每个 tick 强制走唯一 15 阶段完整闭环"与"V0 最小闭环不含 Action/World"互相矛盾 | 高 |
| P0-3 | 无 Time Advance 一等语义 → 仍偏 event-centric（事件来了才计算状态） | 高 |
| P0-4 | 把 FAST+EMA 的 legacy baseline 参数写成"canonical 参数 / V0 唯一允许机制"→ 把 baseline 误写成理论真值 | 中 |
| P0-5 | "旧代码顺序错误"与"新架构必须 X 顺序"都被标 VERIFIED → 证据标签过强 | 中 |
| P0-6 | Evaluation contract 排在 Implementation 之后 → 先实现后定判据 | 中 |
| P0-7 | Identity 定义包含"历史/自我叙事"→ 与 MemoryState 混淆 | 中 |
| P0-8 | "current affect/mood 参与检索"被写成 V0 检索键 → 把 mood-congruent retrieval 假设置入 canonical | 中 |
| P0-9 | "最小闭环"名称与事实不符（不含 Action→Environment→Outcome） | 低 |
| P0-10 | 公开仓库泄露本地绝对路径 | 低（隐私） |

---

## 2. 修改内容（逐项）

| # | 修改 | 落点 |
|---|---|---|
| P0-1 | SubjectState 拥有 MemoryState；MemoryRepository 是基础设施；MemoryState 字段概念化 | ARCHITECTURE §4/§5；VISION L3；NEXT_ACTIONS #1；MIGRATION_MAP Memory 簇 |
| P0-2 | "唯一合法 tick 语义" → "canonical transition system（四类 transition）"；15 阶段降为 Full Subject-World Lifecycle reference；Action optional | ARCHITECTURE §3；VISION L4；ROADMAP；NEXT_ACTIONS #2 |
| P0-3 | 定义 TimeTransition 为一等语义；Appraisal 使用 time-normalized 状态 | ARCHITECTURE §3.1；ROADMAP A8；NEXT_ACTIONS #2/#3 |
| P0-4 | FAST+EMA → "V0 reference persistence implementation / reference baseline"；参数 → "legacy reference defaults"（来源 VERIFIED，采用=DESIGN DECISION） | ARCHITECTURE §5；RESEARCH_STATE；MIGRATION_MAP；NEXT_ACTIONS |
| P0-5 | 证据标签拆分："审计观察"=VERIFIED、"架构采用"=DESIGN DECISION | 全部文档 |
| P0-6 | 新增 P1.5 Engineering Acceptance Contract（A1–A10），先于 P2 实现 | ROADMAP §5；NEXT_ACTIONS |
| P0-7 | Identity 移除"历史/自我叙事"；自传历史归 MemoryState | ARCHITECTURE §4；MIGRATION_MAP |
| P0-8 | affect/mood-congruent retrieval 降级为 HYPOTHESIS，非 V0 强制键 | RESEARCH_STATE；NEXT_ACTIONS #3 |
| P0-9 | "最小闭环" → "MICL（Minimal Internal Continuity Loop）" | 全部文档 |
| P0-10 | 本地绝对路径 → `<external-audit-workspace>/` | README；RESEARCH_STATE |

---

## 3. Before → After（架构摘要）

**旧（event-centric，单一流水线）：**

```text
每个 tick 强制:
  Observation → …15 阶段… → Future SubjectState
  （Action/World 段每 tick 必走）
  Memory 是 SubjectState 之外的外部 RAG
```

**新（multi-transition Subject Runtime）：**

```text
Time → SubjectState → Observation/Internal Trigger
    → Subjective Processing（Retrieval → Interpretation → Appraisal → Affect）
    → optional Cognition/Action
    → optional Environment Outcome
    → Learning/Consolidation
    → Future SubjectState
    → Time …

四类 transition: Time / Observation / Cognition-Action / Learning
SubjectState owns MemoryState; MemoryRepository = infrastructure
Action = optional; Time advance 不需要外部事件
```

---

## 4. SubjectState Ownership（修订后）

```text
SubjectState（canonical，单写入口 = Core transition rules）
├── Identity（不含自传历史）
├── Traits
├── MemoryState          ← 属于主体：references/index/revision/cursor/config/trace/metadata
├── Beliefs
├── Relationship Models
├── Mood
├── Current Affect
├── Regulatory State
├── Working Context
├── Plasticity Config
├── Trace
└── Runtime Metadata

MemoryRepository        ← infrastructure：episodic payload/embedding/索引
```

---

## 5. Runtime Transitions（修订后）

| Transition | 无外部事件可否发生 | Action |
|---|---|---|
| TimeTransition | 可 | 否 |
| ObservationTransition | 需 Observation | 否 |
| Cognition/ActionTransition | 可 | optional |
| LearningTransition | 需 Outcome/Experience | 否 |

---

## 6. FAST+EMA Status（修订后，防 overclaim）

| 面 | 判定 |
|---|---|
| research identity | BASELINE_ONLY（`VERIFIED`） |
| V0 product identity | reference persistence implementation（`DESIGN DECISION`） |
| 是否 canonical affect theory | **否** |
| 参数 tHold=60/α=0.06/τ=150/clamp=0.25 | legacy reference defaults（来源 `VERIFIED`；采用 = `DESIGN DECISION`/`HYPOTHESIS`） |
| 是否引入新机制（COUNTER/INTENSITY/TED/learned） | **否**（research freeze） |

---

## 7. Unresolved Items（未决，明确留给后续）

- SubjectState V0 正式字段 schema（已由 `docs/architecture/subjectstate-v0-spec.md` 解决，P1 Action 1）
- transition 的阶段级输入/输出/失败语义（留给 NEXT_ACTIONS #2）
- MICL 的检索键最终集与 appraisal 维度集（留给 NEXT_ACTIONS #3）
- A1–A10 的具体判据与 fixture（留给 ROADMAP P1.5）
- affect-congruent retrieval 是否启用（= HYPOTHESIS，研究触发前不实验）
- WorldModel 旧资产是否适合迁移到新架构（existence = `VERIFIED` legacy asset `src/core/worldmodel/worldModel.ts`；migration suitability = `TO_BE_ASSESSED / DESIGN REVIEW REQUIRED`）

---

## 8. 结论

本次修订**没有重新设计 CharacterOS**，而是把已正确的大方向（单一权威状态、LLM 边界、时间尺度分层、无 overclaim、研究冻结）从 event-centric 表述修正为能承载 long-lived subject 的 **state + time + memory + transition constitution**。修订后，仓库能一致回答五个问题（见 ARCHITECTURE §8）。
