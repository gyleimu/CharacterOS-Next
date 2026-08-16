# Canonical Transition Contracts — Formal Specification

**状态:** P1 Action 2（Formal Design）。本文件是正式 transition contract 设计，**不是**实现、不是实验、不是迁移。
**目标仓库:** `gyleimu/CharacterOS-Next` · 基线 `2b97ca1`
**上游约束:** `docs/architecture/subjectstate-v0-spec.md`（SubjectState V0 正式规格）、`ARCHITECTURE.md`（宪法）
**结论标签:** VERIFIED / DESIGN DECISION / HYPOTHESIS / UNKNOWN

---

## 1. Purpose

SubjectState V0 spec 回答了"状态是什么、谁能算、谁能提交"。本文件回答：

> **SubjectState 如何合法地从 S(t) 变成 S(t+1)？**

把四类 transition（Time / Observation / CognitionAction / Learning）从"概念名称"变成**正式 contract**，并明确 **Full Subject-World Lifecycle = 多个 transition 的组合**（不是每 tick 强制走全部阶段）。

---

## 2. Scope / Non-Scope

**In scope:** transition taxonomy、原子提交模型、multi-domain delta 聚合、commit 边界、trace 语义、timebase、四类 transition contract、field ownership、idempotency、failure、LLM 触点、external side-effect 边界、memory 归属。

**Out of scope（V0 明确不做）:** 分布式事务架构、Kafka/event bus、数据库 vendor、CQRS、完整 event sourcing 实现、微服务、multi-agent 并发、完整 action executor、完整 world simulator、learned transition policy、新 emotion dynamics、复杂 belief/relationship transitions。

> 只定义足够让 P2 能正确实现 MICL 的 contracts。

---

## 3. Constitutional Invariants（不可违反）

| # | Invariant |
|---|---|
| I1 | **One logical transition = one atomic canonical commit = at most one state_revision increment** |
| I2 | 多个 domain producer 可参与一个 logical transition，但禁止 domain-by-domain canonical commit |
| I3 | canonical commit 是 all-or-nothing；任一 delta 无效 → 全部拒绝 |
| I4 | canonical state mutation + state_revision increment + mutation_trace entry 属**同一** commit boundary |
| I5 | canonical_mutator = subject-core only；Producer != Mutator |
| I6 | logical time = canonical time authority；wall clock 不进 transition result，不影响 deterministic transition |
| I7 | SubjectState 是 immutable snapshot；state_revision 单调；无"原地 rollback" |
| I8 | 同一 canonical 字段只有一个 transition owner；双写禁止 |
| I9 | LLM 永不 direct canonical mutation；只能 proposal → validation → producer → subject-core commit |
| I10 | External side effect ≠ canonical SubjectState mutation；external Action 失败不得伪造 Outcome |

---

## 4. Transition Taxonomy

| Transition | 作用 | Action? | 无外部事件可发生? |
|---|---|---|---|
| **TimeTransition** | elapsed time → regulation / affect decay / mood settling / memory maintenance eligibility → 下一状态 | 否 | 是 |
| **ObservationTransition** | Observation → Perception → Retrieval → Interpretation → Appraisal → Affect update →（可选 Context delta） | 否 | 需 Observation |
| **CognitionActionTransition** | Cognition/Motivation/Policy → optional ActionIntent | 可选 | 是 |
| **LearningTransition** | Outcome/InternalExperience → Experience Encoding → MemoryRepository prepare → MemoryDelta → commit | 否 | 需 Outcome/InternalExperience |

---

## 5. One Transition = One Atomic Commit

```text
ONE logical transition
  =
ONE atomic canonical SubjectState commit
  =
ONE state_revision increment（at most one）
```

**规则：**
- 多个 domain producer 可参与一个 logical transition（如 TimeTransition = RegulationDelta + AffectDelta + MoodDelta + memory maintenance eligibility delta）。
- subject-core 必须：collect all deltas → validate all → **reject all if any invalid** → apply all to candidate next state → validate whole-state invariants → commit **once** → increment revision **once**。
- **禁止** partial domain commit；**禁止** domain-by-domain canonical commit inside one logical transition。

> 反例（禁止）：regulation commit rev 101、affect commit rev 102、mood commit rev 103 —— 这会产生"半个 TimeTransition 被提交"。

---

## 6. Multi-Domain Delta Aggregation

**CanonicalTransitionProposal（通用 envelope，取代单 producer/单 delta 模型）：**

```text
CanonicalTransitionProposal {
  transition_id
  subject_id
  transition_type               // Time / Observation / CognitionAction / Learning
  expected_state_revision       // optimistic concurrency
  logical_time
  elapsed_time?                 // TimeTransition 用；Duration{value,unit}
  cause_refs[]
  domain_deltas: [              // 一个 transition 可有 N 个 domain delta
    { producer, domain, delta, expected_domain_revision? }
  ]
  external_refs?
  metadata?
}
```

**聚合语义：**
- **delta aggregation order**：deltas 应用于**互不重叠的字段分区**；顺序不依赖 Promise race / object key order / module registration order。
- **validation order**：先 schema/range 逐 delta，再字段冲突检测，再 whole-state 不变量，最后 MemoryRepository revision 引用校验。
- **conflict semantics**：两个 delta 触碰同一 canonical 字段 → `DOMAIN_DELTA_CONFLICT`（拒绝），**绝不 last-wins**。
- **duplicate domain delta**：同一 (producer, domain) 出现两次 → 拒绝（`DOMAIN_DELTA_CONFLICT`）。
- **missing required delta**：transition 类型声明的必需 domain delta 缺失 → `MISSING_REQUIRED_DELTA`。
- **optional delta**：可选 delta 缺失不阻止 commit。
- **deterministic ordering**：候选状态由 subject-core 用"分区合并 + 冲突预检"构造，不依赖隐式顺序。

---

## 7. Canonical Transition Envelope（正式）

见 §6 的 `CanonicalTransitionProposal`。关键语义：**一个 transition = 一个 proposal = N 个 domain delta = 一个 commit**。本 envelope 是 SubjectState V0 spec §24 的 multi-domain 修正（Action 2 consistency correction）。

---

## 8. Field Ownership Matrix

> 这张表是未来 coding agent 的核心安全边界。

| Canonical Field | Allowed Producer(s) | Allowed Transition(s) | Canonical Mutator | Direct LLM Write? | Persistence | Conflict Policy |
|---|---|---|---|---|---|---|
| identity | —（init） | init | subject-core | NO | persistent | readonly |
| traits_seed | —（init） | init | subject-core | NO | persistent | readonly |
| beliefs | —（V0 无） | — | subject-core | NO | persistent | readonly（V0） |
| relationships | —（V0 无） | — | subject-core | NO | persistent | readonly（V0） |
| mood | affect | Observation / Time | subject-core | NO | persistent | conflict→reject |
| affect | affect | Observation / Time | subject-core | NO | persistent | conflict→reject |
| regulation | regulation | Time / CognitionAction | subject-core | NO | persistent | conflict→reject |
| context | context | Observation / CognitionAction | subject-core | NO | partial | conflict→reject |
| mechanism_config | —（config/init） | init | subject-core | NO | persistent | readonly（V0） |
| memory_state（content 子域） | memory | Learning | subject-core | NO | refs only | conflict→reject |
| memory_state（retrieval 子域） | memory | Observation | subject-core | NO | refs only | conflict→reject |
| trace | subject-core | all commits | subject-core | NO | window+cursor | append-only |
| runtime_metadata | subject-core | all commits | subject-core | NO | persistent | monotonic |

**MemoryState 子域（见 §18）：**
- **content/encoding/consolidation 子域** = `active_episode_refs`、`repository_revision`、`autobiographical_index_revision`、`consolidation_cursor`、`pending_encoding_refs`、`lifecycle_metadata` → **LearningTransition**。
- **retrieval 子域** = `working_refs`、`recent_retrieval_trace`、`retrieval_config`、`last_retrieval_at` → **ObservationTransition**。

---

## 9. Transition Lifecycle（最小）

```text
RECEIVED → VALIDATING → PREPARED → COMMITTED → PUBLISHED
                    ↘ REJECTED / ABORTED
```

- **PREPARED ≠ canonical**；只有 **COMMITTED** 状态才是 canonical。
- PUBLISHED 失败**不得**回滚已成功的 canonical commit，除非另有明确恢复策略；external observers 应能从 committed state 恢复。
- 本文件只定义语义，不实现复杂分布式 FSM。

**Rollback / Correction 语义（无"原地 rollback"，`DESIGN DECISION`）：**
- SubjectState 是 immutable + revisioned，**没有原地 rollback**。
- pre-commit failure → abort candidate state（不产生 canonical mutation）。
- MemoryRepository orphan revision → 稍后 GC（见 §19）。
- stale proposal → reject（见 §24）。
- **post-commit 错误 → new corrective transition**（新 transition 产生新 revision），**绝不** mutate history、绝不 "rollback state_revision 42 back to 41"（那会破坏 append-only revision history）。

---

## 10. Commit Boundary（原子边界）

```text
build candidate next state
  + build mutation trace entry
  + validate both
        ↓
atomic canonical commit（state + revision + trace + hash/cursor 同界）
        ↓
publish next snapshot
```

- **正式禁止**：canonical commit → later append mutation_trace（会导致 state_revision=42 但 rev42 的 trace 不存在）。
- `audit_event` 可以是外部 audit infrastructure；但 successful canonical mutation_trace **必须**与对应 state mutation 原子一致。

---

## 11. Trace / Audit Semantics（四概念拆分）

| 概念 | 定义 |
|---|---|
| **MutationHistory** | logical authoritative history；**append-only** |
| **TraceEntry** | immutable 单条 |
| **SubjectState.trace_window** | bounded projection / recent cache（**不是**完整历史） |
| **AuditStore / TraceStore** | 完整 offloaded history（infrastructure） |
| **audit_event** | failed/rejected proposal 的审计记录（**不进** MutationHistory） |

```text
FullMutationHistory:  A → B → C → D → E   (append-only)
SubjectState.trace_window: [C, D, E]       (bounded projection)
trace_cursor: points to full history / offload boundary
```

- 从 canonical bounded window 移出 entry **≠ 删除历史**（历史仍在 authoritative trace/audit store）。
- successful canonical change → MutationHistory；failed/rejected proposal → audit_event only。

---

## 12. Timebase / Duration Model

**正式定义（`DESIGN DECISION`）：**

| 维度 | 定义 |
|---|---|
| `logical_time` | monotonic integer，单位 = **`tick`**（opaque） |
| `elapsed_time` | `Duration{ value, unit }`；V0 unit = `tick` |
| `mechanism duration` | profile 参数（tHold/tau 等）必须携带 unit/timebase |
| `wall clock` | 仅 metadata/audit，不进 transition result / StateHash |
| `persisted timestamps` | logical_time（不是 `Date()`） |
| `event occurrence time` | logical_time（事件发生时刻） |

**裁定（解决 R6：tHold/tau 单位）：**
- 裸数字 `60` / `150` **不得**当作可跨系统解释的时间。
- V0 采用：`mechanism_config.affect_profile.timebase = "legacy_tick"`，确定性转换 `1 canonical_tick == 1 legacy_tick`（`DESIGN DECISION`，**不是**科学真值）。
- 因此 V0 下 `tHold = 60 ticks`、`tau = 150 ticks`；`exp(-elapsed_ticks / tau_ticks)` 维度一致。
- 未来若引入真实秒级时间，必须经显式 `timebase` + 确定性 adapter（`elapsed_runtime → mechanism_elapsed_units`），不得隐式换算。

---

## 13. TimeTransition Contract

**Input:** subject_id、expected_state_revision、current logical_time、elapsed_time、mechanism_config、当前 SubjectState 投影。

**Producers:** regulation、affect、mood、memory maintenance eligibility。

**Output:** multi-domain deltas、next logical_time、mutation trace。

**硬性前置：** `elapsed_time >= 0`；`target_logical_time >= current_logical_time`。

**硬性后置：**
- 若 commit：`state_revision +1` 恰好一次；`logical_time` 单调。
- 不要求 external Observation；不要求 Action。
- **Appraisal 不在 TimeTransition 内运行**。
- V0 不直接 mutation Belief/Relationship。
- 确定性 time decay 不要求 LLM。

**NO_OP 语义（`DESIGN DECISION`）：** `elapsed_time == 0` → `NO_OP`：不产生 canonical commit、`state_revision` 不变，返回 `TransitionResult{status: NO_OP}`。

**失败语义：** TimeTransition 失败**不得**部分更新 regulation/mood/affect（all-or-nothing）。

---

## 14. ObservationTransition Contract

```text
Observation input
  → Perception
  → Memory Retrieval（读 MemoryState / MemoryRepository）
  → Subjective Interpretation
  → Appraisal
  → Affect proposal
  → optional Context delta
  → canonical commit（subject-core）
```

- ObservationTransition **不写** Experience Encoding / episodic memory content（那是 LearningTransition）。
- ObservationTransition **可写** MemoryState 的 **retrieval 子域**（working_refs / recent_retrieval_trace / retrieval_config / last_retrieval_at）——这是对"LearningTransition = single memory owner"的精确化（见 §18）。

---

## 15. Subjective Interpretation / Appraisal Boundary

> 本文件不重设计 appraisal 科学模型，只定义 interface boundary。

- `SubjectiveInterpretationResult` 与 `AppraisalProposal` 是**不同对象**。
- Interpretation 可引用：observation、retrieved memories、beliefs、relationships、traits、regulation、mood、context。
- Appraisal 产出结构化 proposal。
- LLM 可参与 Interpretation proposal / Appraisal proposal，但：
  ```text
  LLM proposal → schema validation → Core/domain appraisal validation
                → Affect producer → AffectDelta → subject-core canonical commit
  ```
- **LLM output ≠ canonical affect delta。**

---

## 16. CognitionActionTransition Contract

```text
SubjectState → Cognition/Motivation → Policy → NO_ACTION   （合法结束）
                                        ↘ ActionIntent → external action execution
```

- Action **optional**；`NO_ACTION` 是合法 canonical 结果。
- CognitionActionTransition 的 canonical effect 可只更新必要的 internal policy/context trace，并输出 **external side-effect intent**。
- 真正 Environment/Outcome 通常**不属于**同一个 local canonical commit（不把外部世界塞进事务）。
- 外部 side effect 的 exactly-once / at-least-once 问题**本阶段不设计**，只明确：
  - external side effect ≠ canonical SubjectState mutation；
  - 若 external Action 执行失败，**不得伪造 Outcome**。

---

## 17. LearningTransition Contract

```text
V0:
  Outcome OR InternalExperience
    → Experience Encoding
    → MemoryRepository prepare（immutable revision Rn）
    → MemoryDelta（content 子域）
    → subject-core canonical commit
```

- V0 **禁止** belief evolution / relationship evolution / learned plasticity。
- 未来可扩展为 `MemoryDelta + BeliefDelta + RelationshipDelta + PlasticityDelta`，但依然 **ONE LearningTransition = ONE atomic canonical commit**。
- MemoryRepository prepare 可发生在 commit 前；继承 State–Memory atomicity：**orphan revision allowed；invalid reference forbidden**。
- **InternalExperience 来源（`DESIGN DECISION`）：** `ObservationTransitionResult` 可作为 InternalExperience source，即使没有 external Outcome——这样 MICL 能 `Observation → Affect → Learning → memory encode` 而不要求世界动作。

---

## 18. Memory Mutation Ownership

**正式 partition（`DESIGN DECISION`，消除双写）：**

```text
LearningTransition = sole owner of memory CONTENT/ENCODING/CONSOLIDATION mutation
  fields: active_episode_refs, repository_revision,
          autobiographical_index_revision, consolidation_cursor,
          pending_encoding_refs, lifecycle_metadata

ObservationTransition = owner of memory RETRIEVAL METADATA mutation only
  fields: working_refs, recent_retrieval_trace, retrieval_config, last_retrieval_at
```

- 两子域字段**互不相交** → 无 double-write。
- 旧表述"LearningTransition = single memory owner"修正为上述精确版本（Action 2 consistency correction）。
- **DOUBLE MEMORY WRITE FORBIDDEN** 无条件成立。

---

## 19. State–Memory Revision Interaction

继承 SubjectState V0 spec §11：

- `state_revision`（canonical 状态修订）、`repository_revision`（引用的记忆修订）分离。
- prepare → validate → construct MemoryDelta → subject-core 校验 expected revisions → atomic commit 引用 Rn → publish。
- crash：MemoryRepository 写成功但 SubjectState commit 失败 → **孤儿 revision 容忍 + GC**；SubjectState 仍指旧 Rn-1。
- SubjectState 提交不存在的 Rn → `INVALID_MEMORY_REVISION`。

---

## 20. Transition Composition

**合法组合（`DESIGN DECISION`）：**

```text
Time → Observation → Learning
Time → CognitionAction
Observation → CognitionAction
CognitionAction → external Action → later Outcome → Learning
Observation → Learning            （InternalExperience）
```

**禁止默认假设：** 每个 Observation 必须 Action；Learning 必须依赖 external Action Outcome。

**Chaining 追踪：** 用 `transition_id` + `result_ref` + `cause_refs` 保持可追踪。

---

## 21. TransitionResult

```text
TransitionResult {
  transition_id
  transition_type
  status                        // NO_OP / COMMITTED / REJECTED / ABORTED / ALREADY_COMMITTED
  previous_state_revision
  next_state_revision?
  logical_time_before
  logical_time_after
  state_hash_before?
  state_hash_after?
  mutation_trace_ref?
  domain_results[]
  external_effects[]
  rejection_reason?
  audit_event_ref?
}
```

---

## 22. Idempotency / Retry

- `transition_id` 唯一。
- 同一 `transition_id` 重复提交：
  - 已 committed → **不得**再次 `state_revision +1`；返回 `ALREADY_COMMITTED` + 原 `TransitionResult` ref。
  - 之前 aborted/rejected → 若 payload 不变可同 ID 重试（idempotent）；内容变化 → 必须新 `transition_id`。
- `same transition_id + same payload hash → idempotent result`；`same id + different payload → TRANSITION_ID_REUSE`（拒绝）。
- Memory prepare 重试应复用已 prepared revision，避免无限孤儿 revision。

---

## 23. Failure Semantics

继承 SubjectState V0 spec §25，另补 transition 级：

| 错误 | pre/post-commit | canonical mutation? | audit_event? |
|---|---|---|---|
| INVALID_SCHEMA / INVALID_VALUE_RANGE | pre | no | yes |
| STALE_STATE_REVISION | pre | no | yes |
| INVALID_LOGICAL_TIME / INVALID_TIMEBASE | pre | no | yes |
| INVALID_MEMORY_REVISION | pre | no | yes |
| FORBIDDEN_DIRECT_MUTATION | pre | no | yes |
| UNKNOWN_SUBJECT | pre | no | yes |
| PROPOSAL_REJECTED | pre | no | yes |
| DOMAIN_DELTA_CONFLICT | pre | no | yes |
| MISSING_REQUIRED_DELTA | pre | no | yes |
| UNAUTHORIZED_PRODUCER | pre | no | yes |
| INVALID_TRANSITION_COMPOSITION | pre | no | yes |
| INVALID_TRANSITION_OWNER | pre | no | yes |
| COMMIT_CONFLICT | pre | no | yes |
| TRANSITION_ID_REUSE | pre | no | yes |
| EXTERNAL_ACTION_FAILED | runtime result | no | yes（runtime） |

**核心语义：** failure 绝不部分 mutate canonical SubjectState（all-or-nothing）。

---

## 24. Concurrency / Stale Revision

- optimistic concurrency：`expected_state_revision`。
- stale → `STALE_STATE_REVISION`（拒绝 + audit_event），不产生 canonical mutation。
- 单写者模型（subject-core 串行化 canonical commit）使 V0 无需分布式锁；仅定义语义。

---

## 25. External Side Effects Boundary

- `external_effects[]`（在 TransitionResult 中）记录 ActionIntent/ActionCommand。
- external side effect **不是** canonical SubjectState mutation。
- external Action 失败 → 不伪造 Outcome；记录 runtime failure（audit_event，非 canonical）。
- exactly-once / at-least-once / outbox 语义 = `DEFERRED`（不在 V0）。

---

## 26. LLM Touchpoint Matrix

| Transition | Stage | LLM Allowed? | LLM Output Type | Canonical Write? | Validation Required? |
|---|---|---|---|---|---|
| Time | （全部） | NO（V0） | — | NO | — |
| Observation | Perception/Semantic Interpretation | YES | interpretation proposal | NO | schema + domain |
| Observation | Appraisal | YES | appraisal proposal | NO | schema + appraisal |
| Observation | Memory Retrieval | NO（retrieval 由 core 执行） | — | NO | — |
| CognitionAction | Reasoning / Policy | YES | reasoning memo / policy candidate | NO | schema |
| Learning | Experience summarization | V0 NO（谨慎） | — | NO | — |
| 任何 | — | — | — | **NEVER** | — |

**不变量：** LLM direct canonical mutation = **NEVER**（任何阶段）。

---

## 27. Deterministic Ordering

- multi-domain delta 应用于**独立字段分区**；冲突在 apply 前检测。
- 不依赖 Promise race / object key order / module registration order。
- subject-core 构造候选状态；两个 delta 触碰同字段 → 冲突拒绝。
- StateHash 计算使用 canonical serialization（stable field order，无 wall clock）。

---

## 28. Hash / Replay Interaction

- `StateHash` 覆盖 canonical 逻辑字段；排除 wall clock / repository payload / trace 内容。
- TransitionResult 携带 `state_hash_before/after`。
- 同一 logical state + 同一 input + 同一 elapsed_time → 同一 transition result（deterministic replay）。

---

## 29. Deferred Decisions

| # | 未决 | 留给 |
|---|---|---|
| D1 | external side-effect exactly-once / at-least-once / outbox | P2+ 实现前 |
| D2 | MICL 检索键最终集（affect-congruence = HYPOTHESIS） | NEXT_ACTIONS #3 |
| D3 | A1–A10 具体判据与 fixture | ROADMAP P1.5 |
| D4 | trace_window 大小 N / offload 策略 / before/after hash 是否 V0 必选 | P1.5 可加 |
| D5 | Experience summarization 是否允许 LLM（当前 V0=NO） | 未来 evidence |
| D6 | belief/relationship/plasticity 的 Learning 扩展 delta | 未来阶段 |
| D7 | 真实秒级 timebase + 确定性 adapter | 产品需求触发 |

---

## 30. Acceptance Checklist（对应最终验收 10 问）

| # | 问题 | 回答位置 |
|---|---|---|
| 1 | TimeTransition 改 mood/affect/regulation 是一次 commit 还是三次？ | §5/§13：一次 atomic commit |
| 2 | 一个 delta 无效，其余是否提交？ | §5/§6：否，reject all |
| 3 | mutation_trace 与 state mutation 同原子边界？ | §10：是 |
| 4 | trace_window 截断后完整历史去哪？ | §11：MutationHistory / AuditStore |
| 5 | affect mechanism config 唯一真值源？ | §12 + 一致性修正：mechanism_config.affect_profile |
| 6 | tHold=60 / tau=150 单位？ | §12：60 ticks / 150 ticks（legacy_tick timebase，1:1） |
| 7 | Observation/Learning 谁能写哪部分 MemoryState？ | §8/§18：retrieval 子域 vs content 子域 |
| 8 | 同 transition retry 会重复 +1？ | §22：不会，ALREADY_COMMITTED |
| 9 | 两 domain 改同一字段？ | §6/§27：DOMAIN_DELTA_CONFLICT 拒绝 |
| 10 | LLM 输出如何最终影响 canonical state？ | §26：proposal → validation → producer → subject-core commit |

---

## 附：Action 2 Consistency Corrections（对 SubjectState V0 spec 的最小修订，记录在此）

1. **Profile authority 单一化**：`mechanism_config.affect_profile` = 唯一 active config 权威；Mood/Affect 的 `reference_profile` 改为 provenance 字段 `generated_under_profile`（历史溯源，非 config 权威）。
2. **created_at 单一源**：`runtime_metadata.created_at` = 唯一 subject creation logical time；移除 `identity.created_at`。
3. **Trace 术语拆分**：MutationHistory / TraceEntry / trace_window / AuditStore / audit_event（见 §11）。
4. **Proposal envelope multi-domain**：`CanonicalTransitionProposal.domain_deltas[]`（见 §6）。
5. **Memory retrieval metadata ownership**：ObservationTransition owns retrieval 子域；LearningTransition owns content 子域（见 §18）。

上述修订已同步进 `subjectstate-v0-spec.md`（本任务）。
