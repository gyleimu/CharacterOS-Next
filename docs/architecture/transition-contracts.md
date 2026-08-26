# Canonical Transition Contracts — Formal Specification

**状态:** P1 Action 2（Formal Design）+ P2.1 Contract Freeze Incorporated。本文是正式 transition contract 设计，**不是**实现、不是实验、不是迁移。
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
- 多个 domain producer 可参与一个 logical transition（如 TimeTransition = RegulationDelta + AffectDelta + MoodDelta；memory maintenance eligibility 是 **derived signal，非 canonical delta**，见 §13）。
- subject-core 必须：collect all deltas → validate all → **reject all if any invalid** → apply all to candidate next state → validate whole-state invariants → commit **once** → increment revision **once**。
- **禁止** partial domain commit；**禁止** domain-by-domain canonical commit inside one logical transition。

> 反例（禁止）：regulation commit rev 101、affect commit rev 102、mood commit rev 103 —— 这会产生"半个 TimeTransition 被提交"。

**Orchestration vs Canonical Mutation（`DESIGN DECISION`，防循环依赖）：**

```text
runtime / orchestrator
  → read SubjectState projection
  → invoke allowed domain producers
  → collect DomainDeltas
  → construct CanonicalTransitionProposal

subject-core（generic canonical commit engine）
  → generic validation
  → field ownership validation
  → revision validation
  → candidate state construction
  → atomic canonical commit
```

- subject-core **MAY** validate delta envelope + field authority；**MUST NOT** depend on / import domain implementations（不调用 memory/affect/regulation）。
- producer orchestration 属于 runtime / transition orchestrator，不属于 subject-core。

---

## 6. Multi-Domain Delta Aggregation

**CanonicalTransitionProposal（通用 envelope，取代单 producer/单 delta 模型）：**

```text
CanonicalTransitionProposal {
  schema_version                 // "canonical-transition-proposal-v1"
  transition_id
  subject_id
  transition_type               // Time / Observation / CognitionAction / Learning
  expected_state_revision       // optimistic concurrency
  time_input                    // transition-specific（见 §12）：
                                //   Time:   { kind: elapsed, elapsed_time: Duration }
                                //   others: { kind: occurrence, occurrence_logical_time }
  cause_refs[]
  domain_deltas: [              // 一个 transition 可有 N 个 domain delta
    { producer, domain, expected_repository_revision,
      operations:[{path,value}], provenance_refs[] }
  ]
  external_refs[]                // required set-like canonical refs
}
```

所有列出的 proposal/delta keys 均 required；空 refs 用 `[]`。两个 memory domain 的 `expected_repository_revision` 必须等于 current repository revision，其他 domain 必须 null；不存在 opaque `delta`、`expected_domain_revision?` 或 canonical metadata。Exact producer authentication、paths、values、ordering 与 fingerprint schema 见 freeze §7；observability metadata 在 proposal 外部。

**聚合语义：**
- **delta aggregation order**：deltas 应用于**互不重叠的字段分区**；顺序不依赖 Promise race / object key order / module registration order。
- **validation order**：使用 freeze §13.4 单一 precedence：syntax → subject/context → identity reservation → revision guards → producer capability → path/transition owner → conflicts/composition → value/range → repository refs → whole-state/bundle → CAS。
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
| context | context | Observation / CognitionAction | subject-core | NO | full snapshot persistence | conflict→reject |
| mechanism_config | —（config/init） | init | subject-core | NO | persistent | readonly（V0） |
| memory_state（content 子域） | memory | Learning | subject-core | NO | refs only | conflict→reject |
| memory_state（retrieval 子域） | memory | Observation | subject-core | NO | refs only | conflict→reject |
| trace_window | subject-core | all commits | subject-core | NO | window+cursor | rolling / bounded（core-managed eviction，非 append-only） |
| runtime_metadata | subject-core | all commits | subject-core | NO | persistent | monotonic |

**MemoryState 子域（见 §18）：**
- **content/encoding/consolidation 子域** = `active_episode_refs`、`repository_revision`、`autobiographical_index_revision`、`consolidation_cursor`、`pending_encoding_refs`、`lifecycle_metadata` → **LearningTransition**。
- **retrieval 子域** = `working_refs`、`recent_retrieval_trace`、`last_retrieval_at` → **ObservationTransition**（`retrieval_config` 属 config authority，init-only，MICL consistency correction）。

---

## 9. Transition Lifecycle（最小）

```text
RECEIVED → IDENTITY_RESERVED → VALIDATING → PREPARED
                                      → atomic authority point → COMMITTED
                                      ↘ REJECTED / ABORTED

COMMITTED → PublishObservation projection: PENDING | PUBLISHED
```

- **PREPARED ≠ canonical**；只有 **COMMITTED** 状态才是 canonical。
- PENDING/PUBLISHED 不是 canonical transition status，不进入 committed result/checksum。Publish 失败**不得**回滚 canonical commit；external observers 从 committed bundle 恢复。
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
- **P2.1 atomic port closure：** canonical write 只有 `AtomicCommitStore.compareAndCommit(expected_revision, identity_record_version_before, complete_bundle)` 一个概念能力；state snapshot、revision/hash、TraceEntry/MutationHistory、TraceWindow/Cursor、transition identity/result 同一 authority point。StateStore/TraceStore/index 均不得独立 commit。exact bundle/CAS/recovery oracle 见 freeze §15。

---

## 11. Trace / Audit Semantics（四概念拆分）

| 概念 | 定义 |
|---|---|
| **MutationHistory** | logical authoritative history；**append-only** |
| **TraceEntry** | immutable 单条 |
| **SubjectState.trace_window** | bounded projection / recent cache（**不是**完整历史） |
| **Atomic commit journal / MutationHistory** | 完整 authoritative committed history，与 state/trace/record 同 authority point |
| **TraceHistoryView** | optional read/offload projection；可由 commit journal 重建；不是 writer |
| **TransitionIdentityJournal / audit_event** | OPEN/NO_OP/rejected/aborted/reuse conflict；**不进** MutationHistory |

```text
FullMutationHistory:  A → B → C → D → E   (append-only)
SubjectState.trace_window: [C, D, E]       (bounded projection)
trace_cursor: points to full history / offload boundary
```

- 从 canonical bounded window 移出 entry **≠ 删除历史**（同一entry已在authoritative atomic commit journal / MutationHistory）。
- successful canonical change → MutationHistory；只有完整 proposal + known state context + durable reservation 后的 rejected/aborted attempt → `AuditEventV1` only。Admission/pre-proposal stage failure 的 `audit_ref(s)` 为空，只可有非规范 diagnostics。
- P2.1 freeze：每 commit 恰好一条 multi-domain `TraceEntryV1`；before/after StateHash required；TraceWindow capacity=64；exact cursor/eviction schema 见 freeze §10。

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

**时间值三源（`DESIGN DECISION`，消除双源）：**

| 值 | 来源 |
|---|---|
| `logical_time_before` | **read from** `SubjectState.runtime_metadata.logical_time`（调用方**不可覆盖**） |
| `elapsed_time` | **supplied input**（显式 `Duration{value, unit}`；仅 TimeTransition 需要） |
| `logical_time_after` | **derived output** = `logical_time_before + normalize(elapsed_time)` |

- 禁止调用方同时自由传 `logical_time_after` + `elapsed_time` 且互相矛盾（如 before=100、elapsed=5、target=200）。
- Other transition（Observation/Learning/CognitionAction）只携带 `occurrence_logical_time`（事件发生时刻），**不自行推进** logical_time。
- `INVALID_LOGICAL_TIME`：时间非单调 / 矛盾输入；`INVALID_TIMEBASE`：unit 未知或不匹配。

---

## 13. TimeTransition Contract

**Input:**
- subject_id
- expected_state_revision（must equal current）
- elapsed_time：`Duration{value, unit}`（required）
- mechanism_config（read）
- 当前 SubjectState 投影（read，含 `logical_time_before`）

**Domain producers:**
- regulation → RegulationDelta
- affect → AffectDelta + MoodDelta（**MoodDelta producer = affect domain；不存在独立 mood producer**）
- memory maintenance eligibility → **derived signal（非 canonical delta）**；V0 TimeTransition 不直接 mutate MemoryState（consolidation_cursor / repository_revision / active_episode_refs / lifecycle_metadata 均不动）

**Pipeline:** `SubjectState(t) → elapsed time →（regulation / affect / mood / eligibility signal）→ SubjectState(t+Δt)`

**Preconditions:**
- subject exists；expected_state_revision 匹配
- raw duration 在 canonical proposal 形成前由 Time runtime 准入：value 必须是 finite signed safe integer，unit 必须是 well-formed Identifier；malformed=`INVALID_SCHEMA`，unit 非 `tick`=`INVALID_TIMEBASE`，value<0=`INVALID_LOGICAL_TIME`。这些 pre-proposal failure 不创建 transition identity、AuditEvent 或 trace。
- subject-core 只接收 normalized `{value: nonnegative safe integer, unit:"tick"}`；`logical_time_after = logical_time_before + value` 使用 checked safe-integer addition。超出 `0..9007199254740991`=`INVALID_LOGICAL_TIME/TIME-ADVANCE-001`，不得 saturate、wrap、round 或丢失精度。
- successful commit 的 `state_revision/history_sequence` successor 也必须可表示；max revision 尝试 commit=`INVARIANT_VIOLATION/SS-REVISION-001`，revision/hash unchanged，audit yes，trace none。

**Postconditions:**
- 若 commit：`state_revision +1` 恰好一次；`logical_time` 单调 → `logical_time_after`
- 不要求 external Observation；不要求 Action；**Appraisal 不在其中运行**
- V0 不直接 mutation Belief / Relationship / MemoryState content
- deterministic time decay 不要求 LLM

**NO_OP（`DESIGN DECISION`）:** `elapsed_time.value == 0` → `NO_OP`：无 canonical commit、`state_revision` 不变，返回 `TransitionResult{status: NO_OP}`。

**Failure / Degrade:** TimeTransition 失败**不得**部分更新 regulation/mood/affect（all-or-nothing）。无 LLM / 无外部依赖 → 无 degrade 语义。

**Idempotency:** 同 `transition_id` 重复提交 → `ALREADY_COMMITTED`（见 §22）。

**LogicalTransitionResultV1:** 按freeze §7.6携带required logical-time/hash/snapshot-hash、`domain_result_refs[]`（含eligibility signal result ref，非canonical state）、outcome/audit refs；不使用optional-field bag。

---

## 14. ObservationTransition Contract

**Input:**
- subject_id
- expected_state_revision（must equal current）
- Observation（schema-valid）
- observation logical occurrence time
- 当前 SubjectState 投影（read）
- retrieval access（MemoryState / MemoryRepository，read）
- mechanism_config（read）
- required `external_refs[]` key（可为空数组）

**Pipeline:**
```text
Observation → Perception → Memory Retrieval → Subjective Interpretation
            → Appraisal → Affect/Mood delta → Context delta
            → optional Memory retrieval-metadata delta
            → one canonical commit（subject-core）
```

**Preconditions:** subject exists；expected revision 匹配；Observation schema 有效；occurrence time 有效；producer permissions 有效。

**Output:**
- ObservationTransitionResult（interpretation result ref、appraisal result ref、retrieval result ref、optional InternalExperience ref）
- canonical TransitionResult

**Postconditions:**
- Experience / episodic content **NOT encoded here**；Memory content 子域 untouched
- affect / mood / context / retrieval-metadata 仅在允许字段分区内变更
- exactly one or zero canonical commit

**Failure / Degrade（`DESIGN DECISION`）：**
- **A. no relevant memories** → `LEGAL EMPTY RETRIEVAL`：`retrieval_result = []`，继续 Interpretation/Appraisal（**不是** transition failure）。
- **B. LLM unavailable**（interpretation/appraisal 依赖 LLM 时）→ pre-commit abort/reject（`SERVICE_UNAVAILABLE`），canonical state 不变。V0 **没有** deterministic appraisal fallback，故**不假装 fallback 存在**。
- **C. invalid LLM proposal** → `PROPOSAL_REJECTED`，无 canonical mutation。
- **D. MemoryRepository read failure** → pre-commit failure（`SERVICE_UNAVAILABLE`），canonical state 不变（V0 不把读失败静默降级为空检索——可能误导 Interpretation）。

**Memory ownership（精确版）：**
- ObservationTransition **不写** Experience Encoding / episodic memory content（那是 LearningTransition）。
- ObservationTransition **可写** MemoryState 的 **retrieval 子域**（working_refs / recent_retrieval_trace / last_retrieval_at）——见 §18（`retrieval_config` 非此域）。

---

## 15. Subjective Interpretation / Appraisal Boundary

> 本文件不重设计 appraisal 科学模型，只定义 interface boundary。

- `SubjectiveInterpretationResult` 与 `AppraisalProposal` 是**不同对象**。
- Interpretation 可引用：observation、retrieved memories、beliefs、relationships、traits、regulation、mood、context。
- Appraisal 产出结构化 proposal。
- LLM 可参与 Interpretation proposal / Appraisal proposal，但：
  ```text
  LLM proposal → schema validation → appraisal package deterministic validation
                → Affect producer → AffectDelta → subject-core canonical commit
  ```
- **LLM output ≠ canonical affect delta。**

---

## 16. CognitionActionTransition Contract

**Input:**
- subject_id
- expected_state_revision（must equal current）
- subject state projection（read）
- optional cognition trigger
- current logical time

**Pipeline:**
```text
SubjectState → Cognition/Motivation → Policy → NO_ACTION（合法结束）
                                        ↘ ActionIntent → external action execution
```

**Preconditions:** valid subject revision；permitted policy/reasoning input。

**Output:**
- `NO_ACTION`（valid policy result）
- 或 `ActionIntent` / `ActionCommand` + `external_effect_refs[]`
- optional context / internal state delta
- canonical TransitionResult

**Postconditions:**
- Action optional；no fake Outcome
- external world side effect **不属于** canonical SubjectState commit
- no direct behavior → memory write

**Failure / Degrade（`DESIGN DECISION`）：**
- **LLM reasoning unavailable**（且 Action generation 依赖 LLM 时）→ `ACTION_UNAVAILABLE`（runtime failure），**不是** `NO_ACTION`。
- **严格区分**：`NO_ACTION` = valid policy result；`ACTION_UNAVAILABLE` / `TRANSITION_REJECTED` = runtime failure。**不得把技术故障误当成角色决定 NO_ACTION。**

- 外部 side effect 的 exactly-once / at-least-once 本阶段不设计。
- external Action 失败 → **不得伪造 Outcome**。

---

## 17. LearningTransition Contract

**Input:**
- Outcome OR InternalExperience（valid experience source）
- expected_state_revision（must equal current）
- source transition / result refs
- current memory repository revision
- logical occurrence time

**Pipeline:**
```text
Experience → Encode → prepare immutable MemoryRepository revision → validate
           → MemoryDelta（content 子域）→ subject-core atomic commit
```

**Output:**
- LearningTransitionResult（new repository revision ref if committed、ExperienceRef、MemoryDelta result）
- canonical TransitionResult

**Preconditions:** valid experience source；valid current repository revision；state revision 匹配；content field ownership 有效。

**Postconditions:**
- V0 只 mutation Memory **content** 子域
- no Belief evolution / no Relationship evolution / no Plasticity evolution
- orphan revision allowed（precommit failure after prepare）
- invalid repository revision **never** committed

**Failure（`DESIGN DECISION`）：**
- encoding failure → pre-commit abort（no canonical mutation）
- repository prepare failure → pre-commit abort
- repository validation failure → pre-commit abort
- commit conflict → reject

**Learning stale after prepare（`DESIGN DECISION`，P1 final sync C2）：**
- prepared repository revision → **orphan / pending candidate**（不被自动 canonical）。
- 禁止简单 `expected_revision = latest` 然后原样重提交旧 MemoryDelta（rev103 可能已改 MemoryState/Context/regulation/affect/repository_revision）。
- core stale attempt先精确返回 `REJECTED + error_code=STALE_STATE_REVISION + reason=SS-REVISION-001`；随后以 Learning rebase 语义处理：
  1. 保持当前 canonical commit rejected / none committed
  2. load 最新 canonical SubjectState
  3. verify 源 InternalExperience 仍有效
  4. verify repository base revision
  5. revalidate field ownership
  6. revalidate prepared memory revision 是否仍可 attach
  7. 安全则使用**新 transition ID/fingerprint** rebuild/rebase MemoryDelta；不安全则返回 Learning `status=REBASE_REQUIRED,error_code=STALE_STATE_REVISION,reason=REBASE-STALE-001`

**核心原则：`STALE != 仅改 expected revision`；retry 必须 re-read + revalidate。**

**InternalExperience 来源（`DESIGN DECISION`）:** `ObservationTransitionResult` 可作为 InternalExperience source，即使没有 external Outcome——使 MICL 能 `Observation → Affect → Learning → memory encode` 而不要求世界动作。

**Idempotency:** Memory prepare 重试应复用已 prepared revision，避免无限孤儿 revision（见 §22）。

---

## 18. Memory Mutation Ownership

**正式 partition（`DESIGN DECISION`，消除双写）：**

```text
LearningTransition = sole owner of memory CONTENT/ENCODING/CONSOLIDATION mutation
  fields: active_episode_refs, repository_revision,
          autobiographical_index_revision, consolidation_cursor,
          pending_encoding_refs, lifecycle_metadata

ObservationTransition = owner of memory RETRIEVAL METADATA mutation only
  fields: working_refs, recent_retrieval_trace, last_retrieval_at
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
TransitionOutcomeV1 =
    CanonicalCommitResultV1
  | AlreadyCommittedResultV1
  | NoOpTransitionResultV1
  | CanonicalErrorResultV1
  | LearningRebaseRequiredResultV1

LogicalTransitionResultV1 = closed runtime wrapper over one outcome plus
  required revision/time/hash fields, domain_result_refs[],
  external_effect_refs[] and audit_refs[]
```

Subject-core emits only commit/already/canonical-error members；Time runtime emits NO_OP and Learning runtime emits rebase. Admission/restore failures use separate `AdmissionErrorResultV1` and never pretend to be a logical transition attempt. `LearningRebaseRequiredResultV1` has exact `status=REBASE_REQUIRED,error_code=STALE_STATE_REVISION,reason=REBASE-STALE-001`; it follows an underlying core stale rejection. Exact required keys/cross-rules for both outcome union and logical wrapper are freeze §§7.3–7.6/13；no implementation may reconstruct the former optional-field bag。

每个 complete proposal 的 exact domain/external refs 先进入 freeze §7.6 content-addressed `PreparedLogicalResultV1` 并在 authority 前 durable/read-verified；NO_OP attempt 或 `AtomicCommitBundleV1` 绑定其 `workflow` ref。COMMITTED 后即使 terminal WorkflowStore checkpoint 丢失，runtime 也必须从 authoritative bundle + prepared record 重建 byte-identical `LogicalTransitionResultV1`；不得重跑 stage 或改用 retry-current values。subject-core 仅通过 runtime-owned、verdict-only `PreparedResultValidator` 验证绑定并携带 ref；该端口不暴露 prepared payload/domain data，subject-core 不 import/call WorkflowStore。

---

## 22. Idempotency / Retry

- `transition_id` 唯一；NO_OP identity/result 也必须跨 restart durable。
- syntax-valid input先计算fingerprint并通过`TransitionIdentityJournal` durable first-seen reservation；OPEN reservation允许`attempts=[]`以表达reservation后崩溃。
- changed-fingerprint reuse 采用 freeze §14.1 的显式 `recordReuseConflict`：caller 必须传入已加载的 revision/logical-time/StateHash/SnapshotHash；journal 不隐式读取 canonical state，并以 stable attempted proposal/ref/fingerprint 幂等追加 conflict/audit/result；首次观察 position 被保留供 response-loss replay。
- 同一 `transition_id` 重复提交：
  - 已 committed → **不得**再次 `state_revision +1`；返回 `ALREADY_COMMITTED` + 原 `TransitionResult` ref。
  - 已 NO_OP、same fingerprint → 返回原 `NO_OP` result；不改 revision，不冒充 `ALREADY_COMMITTED`。
  - 之前 aborted/rejected或OPEN → same fingerprint可进入新的append-only attempt并重新执行完整validation；不保证返回原失败或隐式成功。
  - 任意状态下different fingerprint → `TRANSITION_ID_REUSE`，并用original+attempted identity/fingerprint生成conflict audit；original record不变。
- Memory prepare 重试应复用已 prepared revision，避免无限孤儿 revision。
- payload fingerprint = versioned SHA-256/JCS `proposal-fingerprint-v1` over the semantic proposal without transition_id/observability metadata；expected revision is included。
- transition identity/fingerprint header and rejected/aborted attempts are durable across restart in the authoritative identity/attempt journal；committed record is in the atomic bundle。bounded trace_window and derived idempotency indexes are never identity authority。

---

## 23. Failure Semantics

继承 SubjectState V0 spec §25，另补 transition 级：

| 错误 | pre/post-commit | canonical mutation? | `AuditEventV1`? |
|---|---|---|---|
| INVALID_SCHEMA / INVALID_VALUE_RANGE | pre | no | CanonicalError yes；Admission syntax no |
| STALE_STATE_REVISION | pre | no | yes |
| INVALID_LOGICAL_TIME / INVALID_TIMEBASE | pre | no | durable canonical attempt yes；pre-proposal owning-runtime failure no |
| INVALID_MEMORY_REVISION | pre/restore | no | CanonicalError yes；restore Admission no |
| INVALID_MEMORY_REFERENCE | pre/restore | no | CanonicalError yes；restore Admission no |
| FORBIDDEN_DIRECT_MUTATION | pre | no | classified readonly-path canonical attempt yes；layer-0 direct bypass Admission no |
| UNKNOWN_SUBJECT | pre | no | no（Admission） |
| PROPOSAL_REJECTED | pre-proposal owner | no | no（no canonical attempt） |
| DOMAIN_DELTA_CONFLICT | pre | no | yes |
| MISSING_REQUIRED_DELTA | pre | no | yes |
| UNAUTHORIZED_PRODUCER | pre | no | yes |
| INVALID_TRANSITION_COMPOSITION | pre | no | canonical attempt yes；pre-proposal runtime no |
| INVALID_TRANSITION_OWNER | pre | no | yes |
| INVARIANT_VIOLATION | pre | no | yes |
| COMMIT_CONFLICT | pre | no | yes，only after reconciliation proves loser not committed |
| TRANSITION_ID_REUSE | pre | no | yes |
| EXTERNAL_ACTION_FAILED | runtime result | no | no `AuditEventV1`; noncanonical runtime diagnostics only |

**核心语义：** failure 绝不部分 mutate canonical SubjectState（all-or-nothing）。`AuditEventV1` 的唯一 admission boundary、null rules 与 exact result mapping 见 freeze §§7.5/13.3；本表的 “no” 不禁止非规范日志。

---

## 24. Concurrency / Stale Revision

- optimistic concurrency：`expected_state_revision`。
- stale → `STALE_STATE_REVISION`（拒绝 + audit_event），不产生 canonical mutation。
- precheck 已匹配但 authority-point CAS 失败 → `COMMIT_CONFLICT`；loser 零 mutation 并 reload。
- store definite pre-authority failure可在durable attempt后返回`ABORTED/SERVICE_UNAVAILABLE`。authority outcome unknown不得直接断言ABORTED；必须按transition ID/fingerprint reconcile：发现committed bundle则返回原commit，证明未publish后才允许retry/abort。
- 单写者/compare-and-commit 模型使 V0 无需分布式锁；仅定义语义，不声明跨进程/生产 durability。

---

## 25. External Side Effects Boundary

- `external_effect_refs[]`（在 `LogicalTransitionResultV1` 中）只记录 ActionIntent/ActionCommand 的非 canonical 引用；P2/MICL V0 固定为空数组。
- external side effect **不是** canonical SubjectState mutation。
- external Action 失败 → 不伪造 Outcome；只记录非规范 runtime diagnostic，不伪造 `AuditEventV1` 或 canonical mutation。
- exactly-once / at-least-once / outbox 语义 = `DEFERRED`（不在 V0）。

---

## 26. LLM Touchpoint Matrix

| Transition | Stage | LLM Allowed? | LLM Output Type | Canonical Write? | Validation Required? |
|---|---|---|---|---|---|
| Time | （全部） | NO（V0） | — | NO | — |
| Observation | Perception/Semantic Interpretation | YES | interpretation proposal | NO | schema + domain |
| Observation | Appraisal | YES | appraisal proposal | NO | schema + appraisal |
| Observation | Memory Retrieval | NO（由 memory package deterministic RetrievalService 执行，runtime/orchestrator 调用） | — | NO | deterministic query/result validation |
| CognitionAction | Reasoning / Policy | YES | reasoning memo / policy candidate | NO | schema |
| Learning | Experience summarization | V0 NO（谨慎） | — | NO | — |
| 任何 | — | — | — | **NEVER** | — |

**不变量：** LLM direct canonical mutation = **NEVER**（任何阶段）。表中的 retrieval executor 绝不指 subject-core；subject-core 不 import/call memory 或 retrieval。

---

## 27. Deterministic Ordering

- multi-domain delta 应用于**独立字段分区**；冲突在 apply 前检测。
- 不依赖 Promise race / object key order / module registration order。
- subject-core 构造候选状态；两个 delta 触碰同字段 → 冲突拒绝。
- StateHash 计算使用 canonical serialization（stable field order，无 wall clock）。

---

## 28. Hash / Replay Interaction

- `StateHash` = SHA-256 over `canonical-json-v1` JCS versioned projection；包含顶层 schema_version 与完整 canonical Context，排除 entire trace_window / wall clock / repository payload / audit/log。
- TransitionResult 携带 `state_hash_before/after`。
- 同一 logical state + 同一 input + 同一 elapsed_time → 同一 transition result（deterministic replay）。
- SnapshotHash adds subject/revision/exact trace cursor/last trace ref only；golden vectors 见 freeze §9。

---

## 29. Deferred Decisions

| # | 未决 | 留给 |
|---|---|---|
| D1 | external side-effect exactly-once / at-least-once / outbox | P2+ 实现前 |
| D2 | MICL 检索键最终集（affect-congruence = HYPOTHESIS） | NEXT_ACTIONS #3 |
| D3 | ~~A1–A13 具体判据与 fixture~~ **RESOLVED**：freeze §17 的 40-case exact matrix | — |
| D4 | ~~trace window / cursor / hashes~~ **RESOLVED**：capacity=64；logical cursor；before/after StateHash required；见 freeze §10 | — |
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
| 4 | trace_window 截断后完整历史去哪？ | §11：authoritative atomic commit journal / MutationHistory；TraceHistoryView only |
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
3. **Trace 术语拆分**：atomic commit journal / MutationHistory / TraceEntry / trace_window / TraceHistoryView / identity audit_event（见 §11）。
4. **Proposal envelope multi-domain**：`CanonicalTransitionProposal.domain_deltas[]`（见 §6）。
5. **Memory retrieval metadata ownership**：ObservationTransition owns retrieval 子域；LearningTransition owns content 子域（见 §18）。

上述修订已同步进 `subjectstate-v0-spec.md`（本任务）。

### Action 2 Consistency Closure（封口修订，本任务追加）

跨文档 consistency residuals 的封口，不影响已接受的总体架构：

1. **Memory ownership 精确化**：消除"ObservationTransition 不写 MemoryState"与"LearningTransition = single memory owner"的过时绝对表述；统一为 partition（Observation→retrieval 子域；Learning→content 子域）。canonical write authority 仍 = subject-core。
2. **TimeTransition memory signal**：`memory maintenance eligibility` 定为 **derived signal（非 canonical delta）**；TimeTransition 不直接 mutate MemoryState。
3. **消除独立 mood producer**：MoodDelta producer = affect domain（不引入独立 mood package）。
4. **时间三源消除双源**：`logical_time_before`（read from canonical）、`elapsed_time`（supplied）、`logical_time_after`（derived）。
5. **Orchestrator vs subject-core**：subject-core 不调用/不 import domain package；orchestration 属 runtime。
6. **四类 transition contract 补全**：Observation/CognitionAction/Learning 补齐 Input/Output/Preconditions/Postconditions/Failure/Degrade。
7. **trace_window 命名统一**：SubjectState 顶层 `trace` → `trace_window`（bounded projection，非完整 history）。
8. **SubjectState Deferred D1/D4 → RESOLVED**（transition-contracts 已完成）。

**Action 2 状态 = COMPLETE / CONSISTENCY CLOSED。**

### P2.1 Contract Freeze Incorporation

`docs/implementation/p2-1-contract-freeze.md` 是本文 implementation-level contract 的规范附录。G1–G11 已全部关闭：exact proposal/delta/result schema、JCS/SHA-256 projections/vectors、one-commit/one multi-domain TraceEntry、capacity 64、durable identity/fingerprint/attempt journal、error/status/reason 与唯一 atomic write port 均已冻结。本文任何旧的 opaque metadata/delta、trace N/hash optional、bounded-window identity ledger 或 “retrieval 由 core 执行” 表述均由上述 exact clauses 取代；subject-core 仍只负责 generic validation/atomic canonical commit。
