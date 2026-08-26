# SubjectState V0 — Formal Specification

**状态:** P1 Action 1（Formal Design）+ P2.1 Contract Freeze Incorporated。本文是正式规格设计，**不是**实现、不是实验、不是迁移。
**目标仓库:** `gyleimu/CharacterOS-Next` · 基线 `8c824bf`（本 spec 为该基线的下一增量）
**结论标签:** VERIFIED / DESIGN DECISION / HYPOTHESIS / UNKNOWN（沿用仓库纪律）
**关联:** `ARCHITECTURE.md`（宪法）、`NEXT_ACTIONS.md` #1（本任务）、`ROADMAP.md` P1/P1.5

---

## 1. Purpose

定义足以承载 **MICL（Minimal Internal Continuity Loop）** 的最小 canonical persistent subject state 的正式规格：

```text
SubjectState(t)
  → TimeTransition
  → Observation → Perception → Memory Retrieval
  → Subjective Interpretation → Appraisal → Affect Update
  → Experience Encoding（minimal learning handoff）
  → SubjectState(t+1)
```

本 spec 回答"状态是什么、谁能算、谁能提交、记忆归属、时间、持久化、可审计性"，不回答"transition 的阶段级契约"（那是 NEXT_ACTIONS #2）。

---

## 2. Scope / Non-Scope

**In scope（V0 必须支持）:** identity continuity、logical time、memory ownership、contextual retrieval references、persistent affect、mood baseline、regulation placeholder、working context、immutable/readonly trait seeds、trace/provenance、state revision、cross-session serialization。

**Out of scope（V0 明确不支持）:** full personality drift、belief evolution、relationship evolution、learned plasticity、autonomous world behavior、multi-agent、full cognition、full Action/World loop、dream/random thought、新 emotion dynamics 研究、任何 learned/COUNTER/INTENSITY/TED 机制。

> 规则（ARCHITECTURE § 未定，本 spec 重申）：若某字段不是 MICL / persistence / audit / future-safe boundary 必需，**优先不进入 V0**。

---

## 3. Design Invariants（不可违反）

| # | Invariant | 依据 |
|---|---|---|
| I1 | 单一 canonical SubjectState；唯一 canonical mutator = subject-core | P0-1 / 本任务 §5 |
| I2 | Domain 模块只计算 transition proposal/delta；**不直接 mutate** canonical state | 本任务 §5（Producer != Mutator） |
| I3 | MemoryState ∈ SubjectState（canonical）；MemoryRepository = infrastructure | P0-1 |
| I4 | SubjectState 绝不成功提交一个不存在/无效的 MemoryRepository revision | 本任务 §10 |
| I5 | logical time 是 canonical 时间权威；wall clock 只是元数据，不影响确定性 transition | 本任务 §17 |
| I6 | SubjectState 是 immutable snapshot；state_revision 单调递增 | 本任务 §20 |
| I7 | canonical commit 是 all-or-nothing，绝不部分 mutate | 本任务 §25 |
| I8 | LLM 不能直接写任何 canonical 层，只能 proposal | 约束 B / 本任务 §24 |
| I9 | 慢层与快层分离；快事件不直改慢层 | P0-7 / ARCHITECTURE §4 |
| I10 | 同一 canonical 字段只有一个 transition owner（MemoryState 按子域 partition，见 §9）；双写禁止 | 本任务 §22 |

---

## 4. Canonical Ownership Model

```text
Ownership:
  SubjectState            → owned by the subject；canonical authority
  SubjectState 的写入     → ONLY subject-core（canonical mutator）
  谁计算变化              → domain transition producers（memory/affect/regulation/context/...）

Who owns SubjectState?        subject-core（作为状态的单一权威载体与提交者）
Who may produce deltas?       domain packages（transition producers）
Who may commit mutations?     subject-core（唯一 canonical mutator）
```

---

## 5. Canonical Mutator vs Transition Producers（本 spec 最重要的裁定）

**术语拆分：**

| 旧术语 | 新术语 | 含义 |
|---|---|---|
| writer（笼统） | `transition_producer` | 领域模块计算"应该怎么变"，产出 delta/proposal |
| writer（笼统） | `canonical_mutator` | 只有 subject-core；校验 + 提交 + 版本推进 + trace |

```text
Domain packages calculate transitions.
Subject Core commits transitions.
        （Producer != Mutator）

memory    → MemoryDelta / MemoryTransitionProposal
affect    → AffectDelta / AffectTransitionProposal
regulation→ RegulationDelta
context   → ContextDelta
(future) belief/relationship/personality → 对应 proposal

subject-core（canonical mutator）:
  validate proposal/delta
  check preconditions
  check expected state_revision
  apply canonical transition
  increment state_revision
  update logical time（当适用）
  append provenance / cause trace
  produce immutable next SubjectState
```

**宪法级决定（`DESIGN DECISION`）:** 任何 domain package 不得直接 mutate canonical SubjectState object。`canonical_mutator = subject-core only`。该决定与 ARCHITECTURE §1 同步为原则 P9。

---

## 6. SubjectStateV0 Top-Level Schema

```text
SubjectStateV0
{
  schema_version        : "subject-state-v0"              // 顶层唯一 schema 版本

  identity              : Identity                        // immutable seed
  traits_seed           : TraitsSeed                      // readonly initial seed

  memory_state          : MemoryState                     // canonical memory state
  beliefs               : BeliefsPlaceholder              // readonly read-model
  relationships         : RelationshipsPlaceholder        // first-class read position（V0 不更新）

  mood                  : Mood                            // FAST+EMA-derived reference persistence
  affect                : CurrentAffect                   // 当前情绪 episode（公开稳定 schema）
  regulation            : RegulatoryState                 // 最小标量，支持 TimeTransition
  context               : WorkingContext                  // 快层工作上下文

  mechanism_config      : MechanismConfig                 // （原 plasticity_config，改名见 §18）

  trace_window         : TraceWindow                     // bounded projection（非完整 history；见 §21）
  runtime_metadata      : RuntimeMetadata                 // version / revision / logical time
}
```

> 说明：`schema_version` 只放在顶层（envelope 版本），不重复放进 runtime_metadata（避免双源）。`runtime_metadata` 承载 subject 级版本/修订/时间。

**P2.1 executable closure：** creation input 与 canonical snapshot 分离。初始化可应用冻结 default；产出的 canonical/persisted `SubjectStateV0` 必须全量物化 13 个顶层字段及所有已列 nested keys，所有 object closed、unknown key reject。restore 不补 default。精确 scalar/ref/order/schema catalog 由已纳入本文的 `docs/implementation/p2-1-contract-freeze.md` §5–§7 控制。

**字段裁定通用符号：** 每字段标注 `type`（string/number/integer/array/object/ref/enum）、`req`（required/optional）、`default`、`range/invariant`、`producer`、`persistence`（见 §22 矩阵）。

---

## 7. Identity（immutable seed）

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| subject_id | string | required | — | 稳定唯一标识；不变 |
| display_name | string | required | `""` | 展示名 |
| origin_metadata | closed object | required | `{creation_source:null, seed_version:null}` | 两个值均为 IdentifierV0/null；禁止额外 key |
| identity_anchors | array<string> | required | `[]` | NFC unique ordered 稳定锚点 |
| self_schema_seed_refs | array<seed-schema ref> | required | `[]` | lexicographic unique typed refs，不是 schema 本体 |

**裁定：**
- V0 Identity **默认 immutable**；不实现任何高门槛修改（未来可引入独立 IdentityTransition，V0 不做）。
- **禁止**把 autobiographical history / episodic memories / current self-narrative 混进 Identity。`[DESIGN DECISION]`
- Autobiographical history → MemoryState / MemoryRepository。
- Narrative Identity / Self Model → 未来独立慢变量，V0 不实现。
- **created_at 唯一源 = `runtime_metadata.created_at`**；Identity 不重复保存 created_at（Action 2 一致性修正）。`[DESIGN DECISION]`

---

## 8. Traits Seed（readonly initial seed）

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| dimensions | pattern map | required | `{}` | key=`^[a-z][a-z0-9_]{0,63}$`；finite value `[0,1]`；keys canonical sorted |

**裁定：**
- V0 traits 只是 readonly 初始特质种子，**不是持续动态人格系统**；**禁止 personality drift**。
- 允许 Big Five 维度（openness/conscientiousness/extraversion/agreeableness/neuroticism）作为**约定俗成**，但**可选**，不强制。
- 允许 temperament-like 参数。
- **禁止**把 trust / fear / attachment 混进 traits：这些要么归层到别的慢层（belief/relationship/regulation，V0 不实现），要么标 `UNKNOWN / DEFERRED`。`[DESIGN DECISION]`
- 不得为了兼容旧代码把无法明确归层的字段硬塞进 traits。

---

## 9. MemoryState（canonical memory state）

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| working_refs | array<memory/episode/event ref> | required | `[]` | 当前工作记忆引用，保留 retrieval rank（非 payload） |
| active_episode_refs | array<episode ref> | required | `[]` | 活跃 episode 引用，保留 chronology |
| autobiographical_index_revision | RepositoryRevisionId/null | required | `null` | 指向 MemoryRepository 自传索引 revision |
| repository_revision | string | required | — | **canonical 引用的记忆仓库 revision**（见 §11 原子性） |
| consolidation_cursor | logical_time/null | required | `null` | 巩固已运行到的 logical time；nondecreasing |
| retrieval_config | closed object | required | `{profile_id:"RETRIEVAL_V0", affect_congruence_enabled:false, recent_trace_capacity:64}` | config authority，init-only |
| recent_retrieval_trace | array<retrieval-trace ref> | required | `[]` | oldest→newest unique ring，capacity 64 |
| lifecycle_metadata | EmptyClosedObjectV0 | required | `{}` | V0 禁止任何 key |
| pending_encoding_refs | array<experience ref> | required | `[]` | unique insertion queue |
| last_retrieval_at | logical_time/null | required | `null` | 最近检索时间，不晚于 logical_time |

**裁定：**
- `producer = memory package`；`canonical mutator = subject-core`。
- `recent_retrieval_trace`：canonical + persistent，但**有界**（capacity 64，ring），不是全量检索历史（全量历史属 audit/repository）。`[DESIGN DECISION]`
- **禁止**把 MemoryState 变成"把整个 vector DB 搬进 SubjectState"——payload 一律在 MemoryRepository。
- **MemoryState 子域 partition（Action 2 一致性修正，消除双写）** `[DESIGN DECISION]`：
  - **content/encoding/consolidation 子域**（`active_episode_refs`、`repository_revision`、`autobiographical_index_revision`、`consolidation_cursor`、`pending_encoding_refs`、`lifecycle_metadata`）→ **LearningTransition** 唯一 owner。
  - **retrieval 子域**（`working_refs`、`recent_retrieval_trace`、`last_retrieval_at`）→ **ObservationTransition** 唯一 owner。（`retrieval_config` 属 config authority，init-only，见 MICL consistency correction）

---

## 10. MemoryRepository Boundary（infrastructure）

```text
MemoryRepository（infrastructure，NOT canonical SubjectState）
  ├── episodic payload（事件/经历内容）
  ├── embeddings
  ├── index（自传/语义索引）
  └── immutable versioned revisions（Rn）
```

- MemoryRepository 的 revision 是 **immutable / versioned**。
- SubjectState.MemoryState 只持有 revision 引用与索引/游标/配置/痕迹，不持有 payload。
- **关系一句话:** `MemoryRepository is infrastructure; MemoryState belongs to the subject.`

---

## 11. State–Memory Atomicity & Revision Consistency（本任务关键）

**问题：** SubjectState 可能引用 `repository_revision=r8`，而 MemoryRepository 仍停在 r7；或反向（仓库已写 r8，SubjectState commit 崩溃仍指 r7）。

**模型（V0 只设计，不实现）：**

1. `SubjectState.state_revision`（canonical 状态修订）
2. `MemoryState.repository_revision`（引用的记忆仓库修订）
3. `MemoryRepository` revision 语义 = **immutable / versioned**（`Rn` 一旦 seal 不可变）
4. commit 顺序 = prepare → validate → commit → publish（见下）
5. crash/failure 语义 = 允许**孤立 immutable revision**，之后 GC；**不允许** SubjectState 引用不存在/无效 revision
6. stale revision 检测 = `expected_state_revision` + `expected_repository_revision` 双重校验
7. restore consistency check = 恢复时校验 `repository_revision` 在仓库中存在且有效

**概念流程：**

```text
prepare new MemoryRepository revision Rn
  → validate payload / index
  → construct MemoryDelta（含 repository_revision=Rn）
  → build candidate next state（引用 Rn）
  → build TraceEntry + trace_window / cursor 更新
  → subject-core validate（expected_state_revision + expected_repository_revision + whole-state）
        ↓
  ONE atomic canonical commit（state mutation + state_revision + TraceEntry + trace/hash/cursor，同界）
        ↓
  publish new SubjectState
```

**若无法实现真正跨存储 atomic transaction（V0 很可能如此），采用其一：**
- write-ahead / prepare-commit 语义，或
- immutable orphan revision 容忍 + 稍后 GC，或
- transaction coordinator（future）

**核心不变量（`DESIGN DECISION`）:** SubjectState **绝不能**成功提交一个不存在/无效的 MemoryRepository revision。孤立但未被 SubjectState 引用的 immutable memory revision 可以存在，但**不能**成为 canonical subject memory。

**crash 语义裁定：**
- MemoryRepository 写成功、SubjectState commit 失败 → 产生孤儿 revision Rn（无 SubjectState 引用）→ 容忍 + GC。SubjectState 仍指向旧 Rn-1，一致。
- SubjectState 尝试提交不存在的 Rn → `INVALID_MEMORY_REVISION`，拒绝，不写 trace 为 mutation（写 audit_event）。

---

## 12. Beliefs Placeholder（readonly）

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| items | array<{ ref, summary }> | required | `[]` | closed item；typed source ref + NFC string/null；unique/sorted by ref |

- V0 不实现 belief 更新规则。仅为未来 Interpretation/Appraisal 保留合法读取位置。`[DESIGN DECISION]`

## 13. Relationships Placeholder（first-class read position）

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| models | array<{ relationship_id, target_ref }> | required | `[]` | closed item；IdentifierV0 + entity/subject ref；unique/sorted by relationship_id |

- Relationship 仍是**一等长期状态**，即使 V0 不更新。`[DESIGN DECISION]`
- 现在**不**设计 trust engine / attachment engine / relationship dynamics；只保证未来 Appraisal/Retrieval 有合法读取位置。

---

## 14. Mood（affective baseline）

| 字段 | type | req | default | range/invariant |
|---|---|---|---|---|
| baseline | number | required | `0.0` | `[0, clamp]` |
| generated_under_profile | `FAST_EMA_V0`/null | required | `null` | provenance，**不是** active config 权威 |
| last_update | logical_time/null | required | `null` | 不晚于 canonical logical_time |

- **身份裁定（防 overclaim）:** FAST+EMA-derived reference persistence；**NOT canonical affect theory**。`[DESIGN DECISION]`
- **参数 `tHold=60 / alpha=0.06 / tau=150 / clamp=0.25` = `legacy reference defaults`**（来源 `VERIFIED`：Plasticity Phase 1）；是否作为 CharacterOS-Next 默认 = `DESIGN DECISION`/`HYPOTHESIS`，不是 VERIFIED 科学真值。
- **profile 权威单一化（Action 2 一致性修正）**：active affect profile 的唯一真值源 = `mechanism_config.affect_profile`；`generated_under_profile` 只是 provenance。`[DESIGN DECISION]`
- `producer = affect`；`canonical mutator = subject-core`。
- TimeTransition decay eligibility：mood 属于 TimeTransition 可演化层（decay/settling）。

---

## 15. Current Affect（公开稳定 schema，与 reference implementation 解耦）

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| active_channels | array<AffectChannel> | required | `[]` | 当前活跃情绪通道 |
| generated_under_profile | `FAST_EMA_V0`/null | required | `null` | provenance，**不是** active config 权威 |
| updated_at | logical_time/null | required | `null` | 不晚于 canonical logical_time |

```text
AffectChannel {
  channel_id          : enum                 // {anger,fear,sadness,joy}
  intensity           : number               // [0,1]
  phase               : enum                 // {INACTIVE, ACTIVE, RELEASING}（归一化）
  started_at          : logical_time
  source_appraisal_ref: appraisal ref        // 触发 appraisal 引用
}
```

**关键裁定（future-proof schema）：**
- 公开 canonical schema 使用**归一化 phase** `{INACTIVE, ACTIVE, RELEASING}`；FAST 内部 `UNFORMED/HOLD/RELEASE/NEUTRAL` 是 **reference profile 的实现语义**（映射：UNFORMED/NEUTRAL→INACTIVE，HOLD→ACTIVE，RELEASE→RELEASING），**不是** SubjectState schema 的永久依赖。`[DESIGN DECISION]`
- 未来 FAST+EMA 被替换，**不应**导致整个 SubjectState schema 报废。
- `producer = affect`；`canonical mutator = subject-core`。

---

## 16. Regulatory State（minimal，支持 TimeTransition）

| 字段 | type | req | default | range |
|---|---|---|---|---|
| energy | number | required | `1.0` | `[0,1]` |
| stress | number | required | `0.0` | `[0,1]` |
| arousal | number | required | `0.5` | `[0,1]` |
| fatigue | number | required | `0.0` | `[0,1]` |
| last_update | logical_time/null | required | `null` | 不晚于 canonical logical_time |

- V0 不实现完整 homeostasis；只保留最小标量，目标是确保 **Appraisal 可读取 time-normalized regulatory context**。`[DESIGN DECISION]`
- `RegulationDelta producer ≠ canonical mutator`（producer = regulation 域；mutator = subject-core）。
- 不因为旧 CharacterOS 有很多 regulation 参数就全部搬进来。

---

## 17. Working Context（快层）

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| scene | string | required | `"idle"` | 场景标签 |
| task | string/null | required | `null` | 任务标签 |
| focus_refs | array<ref> | required | `[]` | 焦点引用（transient） |
| active_entity_refs | array<ref> | required | `[]` | 活跃实体引用 |
| environment_refs | array<ref> | required | `[]` | 环境/上下文引用 |
| current_observation_ref | observation ref/null | required | `null` | 当前 observation 引用（observation-scoped） |

- Working Context 是快层。`[DESIGN DECISION]`
- **裁定（persistence，P2.1 G6 closure）:** 六个 Context 字段全部 canonical、full-persistent、StateHash-included、restore 原样恢复。`focus_refs`/`current_observation_ref`/`environment_refs` 的 “transient” 只表示 observation-scoped / 预期短生命周期；下一次有权 ObservationTransition 可用正常 ContextDelta 替换，restore/TimeTransition 不得静默 reset。
- **LLM context window ≠ canonical Working Context。** `[DESIGN DECISION]`

---

## 18. MechanismConfig（原 plasticity_config，正式改名）

> 原概念名 `plasticity_config` 会被误读为"角色正在学习出的 plasticity state"。**正式改名 `mechanism_config`**，避免误导。`[DESIGN DECISION]`

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| affect_profile | closed object | required | `{profile_id:"FAST_EMA_V0", timebase:"legacy_tick"}` | **唯一 active affect config 权威** |
| legacy_reference_defaults | closed object | required | `{tHold:60, alpha:0.06, tau:150, clamp:0.25}` | exact readonly legacy reference parameters |
| feature_flags | EmptyClosedObjectV0 | required | `{}` | V0 禁止任何 key |
| thresholds | EmptyClosedObjectV0 | required | `{}` | V0 禁止任何 key |

- `mechanism_config` 是**配置**，不是 learned plasticity state。`[DESIGN DECISION]`
- learned plasticity **不在** V0；未来若引入，才需要独立的 plasticity state（另议）。
- 根文档同步：ARCHITECTURE §5 的概念块由 `plasticity_config` 改为 `mechanism_config`（本任务同步）。

---

## 19. Runtime Metadata

| 字段 | type | req | default | 说明 |
|---|---|---|---|---|
| subject_version | literal | required | `"subject-v0"` | subject 版本，不是 build semver |
| state_revision | safe integer | required | `0` | 单调递增，见 §20 |
| logical_time | safe integer | required | `0` | canonical 逻辑时间 |
| last_transition_time | logical_time/null | required | `null` | 上次 transition 的 logical time |
| last_transition_type | enum/null | required | `null` | Time/Observation/CognitionAction/Learning |
| created_at | logical_time | required | `0` | immutable subject creation logical time |
| updated_at | logical_time | required | `0` | `created_at<=updated_at<=logical_time` |

`state_revision`、`logical_time` 与 trace history sequence 的可表示域均为 `0..9007199254740991`。所有 successor/addition 必须 checked：revision/history successor overflow=`INVARIANT_VIOLATION/SS-REVISION-001`；canonical Time addition overflow=`INVALID_LOGICAL_TIME/TIME-ADVANCE-001`。不得 saturate、wrap、round 或依赖 JavaScript 非安全整数。

- `schema_version` 只在顶层（envelope），此处不重复。
- **`created_at` 唯一 source of truth = `runtime_metadata.created_at`**（subject creation logical time）；Identity 已移除 created_at（Action 2 一致性修正）。`[DESIGN DECISION]`
- **logical time vs wall clock（`DESIGN DECISION`）:** canonical transition 消费**显式 logical time / elapsed time**；wall clock 可记录为 observability metadata，但**绝不**偷偷影响 deterministic transition。`new Date()` 禁止作为 canonical time authority。

---

## 20. Logical Time Model

```text
logical_time : monotonic（不要求连续，但必须单调）
unit         : opaque logical tick（V0 用整数）
驱动         : TimeTransition 消费显式 elapsed_time → logical_time 前进
              Observation/Learning 不自行推进 logical time，只携带其发生时刻
wall clock   : 仅 metadata / audit；不进 StateHash；不影响 deterministic transition
```

**不变量（`DESIGN DECISION`）:** 同一 logical state + 同一 input + 同一 elapsed time → 同一 transition 结果（deterministic replay）。`last_transition_time`/`updated_at` 是 logical time，不是 `Date()`。

---

## 21. Trace / Provenance

**术语拆分（Action 2 一致性修正，四概念 + audit_event）`[DESIGN DECISION]`：**

| 概念 | 定义 |
|---|---|
| **MutationHistory** | logical authoritative history；append-only |
| **TraceEntry** | immutable 单条 |
| **SubjectState.trace_window** | bounded projection / recent cache（**不是**完整历史） |
| **Atomic commit journal / MutationHistory** | 完整 authoritative committed history；与 canonical bundle 同 authority point |
| **TraceHistoryView** | 可选、只读、可由 commit journal 重建的 offload/read projection |
| **TransitionIdentityJournal / audit_event** | OPEN/NO_OP/rejected/aborted/reuse-conflict identity/audit；不进 MutationHistory |

**两个不同对象（`DESIGN DECISION`）：**

| 对象 | 归属 | 触发 | 语义 |
|---|---|---|---|
| TraceEntry（写入 `SubjectState.trace_window`，rolling bounded 窗口） | canonical；**TraceEntry immutable**（MutationHistory append-only；trace_window 本身 rolling，见 §21 裁定） | 每次成功 canonical commit | 状态变更溯源 |
| `audit_event` | identity/audit journal（infrastructure） | 仅完整 proposal + known state context + durable reservation 后的拒绝/中止/ID reuse；Admission/pre-proposal failure 无该记录 | 审计，**不是** canonical mutation |

**P2.1 Trace closure：** 每次 successful canonical commit 恰好一个 `TraceEntryV1`；multi-domain 变化聚合在同一 entry 的 `domain_mutations[]`。`state_hash_before` / `state_hash_after`、deterministic `proposal_ref` 与 before/after repository revision 均 required/non-null。`TraceEntryV1` 使用 `trace_schema_version="trace-v1"`；`TraceWindowV1` exact fields = `trace_window_schema_version="trace-window-v1"`、`capacity=64`、`cursor={last_history_sequence,offloaded_through_sequence,offloaded_through_trace_ref}`、ordered `entries[]`。嵌套 trace 版本键不得复用顶层 SubjectState `schema_version`。完整 machine schema 与 cursor/eviction invariants 见 `docs/implementation/p2-1-contract-freeze.md` §10。

**裁定：**
- **MutationHistory**（authoritative logical history）是 append-only + immutable；**TraceEntry** 是 immutable 单条。大状态**不**保存整份 from/to snapshot，用 field delta / hash / references。`[DESIGN DECISION]`
- durable post-reservation rejected/aborted proposal 写 `audit_event`，**不**写 `mutation_trace`；Admission/pre-proposal failure 不伪造 audit。`[DESIGN DECISION]`
- 规模：`SubjectState.trace_window` 固定持有最近 **64** 条 + logical cursor 指向 offloaded boundary。全量历史 = authoritative MutationHistory / commit journal。
- **从 `trace_window` 移出 entry ≠ 删除历史**：同一 TraceEntry 已在 authoritative atomic commit journal / MutationHistory；任何 TraceHistoryView 均可重建且不是 writer。

---

## 22. Serialization / Persistence Matrix

| Layer | Canonical? | Persistent across session? | Repository-backed? | Resettable? | Derived/Recomputable? | Producer | Mutator |
|---|---|---|---|---|---|---|---|
| Identity | yes | yes | no（seed） | no | no | — | subject-core（init） |
| Traits Seed | yes | yes | no（seed） | no | no | — | subject-core（init） |
| MemoryState | yes | yes | **refs only**（payload 在 repo） | partial（working refs 可重置） | no | memory | subject-core |
| Beliefs | yes（readonly） | yes | no | no | no | —（V0 无） | subject-core（init） |
| Relationships | yes（readonly） | yes | no | no | no | —（V0 无） | subject-core（init） |
| Mood | yes | yes | no | no | no | affect | subject-core |
| Current Affect | yes | yes | no | no | no | affect | subject-core |
| Regulation | yes | yes | no | partial（per TimeTransition） | no | regulation | subject-core |
| Working Context | yes | **yes（全部六字段）** | no | 仅由授权 transition delta 替换；restore 不 reset | no | context | subject-core |
| MechanismConfig | yes | yes | no | no | no | —（config） | subject-core |
| TraceWindow（trace_window） | yes（bounded rolling window） | yes（窗口 + trace_cursor） | authoritative entry 在 atomic commit journal；可选 TraceHistoryView 可重建；AuditStore 不保存 committed history | no（core-managed eviction，非 append-only） | no | subject-core | subject-core |
| RuntimeMetadata | yes | yes | no | no | no | subject-core | subject-core |

> `Repository-backed` 列：只有 MemoryState 的**引用**指向 MemoryRepository；payload/embedding/index 永远在 repository，不在 canonical state。

---

## 23. Immutability / Revision Semantics

```text
SubjectState(t)  = immutable snapshot
transition        → 产生新的 SubjectState(t+1)（旧 snapshot 不变）
state_revision    : monotonic（每次 canonical commit +1）
optimistic concurrency: CanonicalTransitionProposal.expected_state_revision
stale rejection  : expected != current → STALE_STATE_REVISION（拒绝，audit_event）
```

- 不采用 mutable global object。`[DESIGN DECISION]`
- 这为并发、replay、rollback、audit、persistence 提供基础。

---

## 24. Generic Transition Proposal Envelope（最小通用 envelope）

> 完整 Transition Contracts 见 `docs/architecture/transition-contracts.md`（P1 Action 2，已完成）；本 spec 只定义**状态 mutation 的最小通用 envelope**，不越界定义 Observation/Appraisal 详细 schema。

```text
CanonicalTransitionProposal {
  schema_version             // "canonical-transition-proposal-v1"
  transition_id
  subject_id
  expected_state_revision     // optimistic concurrency
  transition_type             // Time/Observation/CognitionAction/Learning
  time_input                  // transition-specific（见 transition-contracts §12）：
                               //   Time:   { kind: elapsed, elapsed_time: Duration }
                               //   others: { kind: occurrence, occurrence_logical_time }
  cause_refs[]
  domain_deltas[]             // exact closed DomainDeltaV0；一个 transition 可有 N 个
  external_refs[]             // required；set-like canonical refs
}
// 每个 domain_delta: closed { producer, domain, expected_repository_revision,
//                             operations:[{path,value}], provenance_refs[] }

CanonicalCommitResult {
  schema_version
  status                     // COMMITTED only；ALREADY is a separate derived response
  subject_id
  transition_id
  payload_fingerprint
  previous_revision
  next_revision
  trace_ref
  state_hash_before
  state_hash_after
  snapshot_hash_after
  commit_ref
  result_ref
}
```

> 本 envelope 是 Action 2 对 §6/§24 的 multi-domain 修正：一个 transition = 一个 proposal = N 个 domain delta = 一个 atomic canonical commit（详见 `transition-contracts.md` §5–§6）。

Exact field-path/value/result/error contracts are frozen in `docs/implementation/p2-1-contract-freeze.md` §7. Noncanonical observability metadata is outside the canonical proposal and all fingerprints/hashes.

Publish state belongs to post-authority rebuildable `PublishObservationV1`; it never enters immutable CanonicalCommitResult, AtomicCommitBundle checksum, StateHash or SnapshotHash。`AlreadyCommittedResultV1`、`NoOpTransitionResultV1`、`CanonicalErrorResultV1` 与 `AdmissionErrorResultV1` are separate discriminated schemas；不得把 optional fields 拼成一个含糊 result。

---

## 25. Failure Semantics

**最小失败类别（`DESIGN DECISION`）：**

```text
INVALID_SCHEMA
INVALID_VALUE_RANGE
STALE_STATE_REVISION
INVALID_LOGICAL_TIME
INVALID_MEMORY_REVISION
INVALID_MEMORY_REFERENCE
FORBIDDEN_DIRECT_MUTATION
UNKNOWN_SUBJECT
PROPOSAL_REJECTED
INVARIANT_VIOLATION
COMMIT_CONFLICT
TRANSITION_ID_REUSE
```

**核心语义：** failure 绝不部分 mutate canonical SubjectState；**canonical commit 是 all-or-nothing**。只有 identity/state context 已建立且 journal durable 的 rejected/aborted attempt 才产生 CanonicalErrorResult + audit_event。缺失/非法 transition ID、UNKNOWN_SUBJECT、state read前 infrastructure failure与restore corruption使用独立AdmissionErrorResult，不伪造 revision/hash/audit。精确映射见freeze §§7.5/13。

---

## 26. Determinism / Replay Requirements

**三种 hash（`DESIGN DECISION`，P2.1 G4 closure）：** SHA-256，wire=`sha256:` + 64 lowercase hex；serialization=`canonical-json-v1`（RFC 8785 JCS/I-JSON）；每个 hash 使用 versioned projection envelope。

| Hash | 覆盖 | 排除 |
|---|---|---|
| `StateHash` | 顶层 `schema_version` + 全部 canonical 逻辑字段（identity/traits/memory refs/beliefs/relationships/mood/affect/regulation/完整 context/mechanism_config/runtime_metadata） | entire trace_window、wall clock、MemoryRepository payload、external audit/log |
| `SnapshotHash` | StateHash + subject_id + state_revision + exact trace cursor + last trace ref | full TraceEntry/MutationHistory、physical store ref |
| `RepositoryRevisionHash` | versioned immutable repository manifest（record refs + payload hashes + index manifest hash） | SubjectState 与外部 observability |

- canonical serialization exact rules/golden vectors = `docs/implementation/p2-1-contract-freeze.md` §8–§9；raw JSON stringify 禁止。
- 不变量：same logical state → same canonical serialized form → same StateHash。普通 JSON key ordering / wall clock 不得影响 hash。

---

## 27. MICL Ownership Constraints

**Transition ownership（`DESIGN DECISION`，Action 2 后最终定义）：**

```text
ObservationTransition:
  可能产出:
    AffectDelta
    MoodDelta
    ContextDelta
    MemoryRetrievalMetadataDelta（retrieval 子域）

LearningTransition（V0）:
  可能产出:
    MemoryContentDelta（content 子域）

Memory subdomains: non-overlapping（见 §9）
Canonical mutator: always subject-core
（未来扩展 LearningTransition → Belief / Relationship / Plasticity）
```

**精确表述（不得再用绝对句）：**
- ObservationTransition **不写 memory CONTENT**（不写 episodic content / Experience Encoding），但 **owns retrieval metadata 子域**（working_refs / recent_retrieval_trace / last_retrieval_at；`retrieval_config` 属 config authority）。
- LearningTransition **owns content / encoding / consolidation 子域**（active_episode_refs / repository_revision / autobiographical_index_revision / consolidation_cursor / pending_encoding_refs / lifecycle_metadata）。

**不变量:** **DOUBLE MEMORY WRITE FORBIDDEN** —— 两子域字段互不相交，无重叠写。transition ownership 是"谁产 delta"；**canonical write authority 始终是 subject-core**。

---

## 28. LLM Boundary（SubjectState 层）

**LLM cannot（`DESIGN DECISION`，继承约束 B）：**
- hold canonical SubjectState
- directly serialize / overwrite SubjectState
- set state_revision
- commit MemoryState
- directly modify Affect
- directly modify Belief
- directly modify Relationship
- 把"我现在很开心"直接写进 canonical state

**LLM may：**
- produce proposals
- produce semantic interpretation
- produce appraisal proposal
- produce expression plan
- produce reasoning memo

**任何进入 canonical state 的值必须：** proposal → validation → transition producer/domain rule → subject-core canonical commit。

---

## 29. Deferred Decisions（真正未决）

| # | 未决 | 留给 |
|---|---|---|
| D1 | ~~transition 阶段级输入/输出/失败/rollback 契约~~ **RESOLVED by Action 2** → `docs/architecture/transition-contracts.md` | — |
| D2 | MICL 检索键最终集（affect-congruence 是否启用 = HYPOTHESIS） | NEXT_ACTIONS #3 |
| D3 | ~~A1–A13 具体判据与 fixture~~ **RESOLVED by P1.5 + P2.1 contract freeze** | — |
| D4 | ~~Experience Encoding 精确阶段归属~~ **RESOLVED**：memory content mutation owner = LearningTransition（transition-contracts §18） | — |
| D5 | ~~trace window / cursor / hashes~~ **RESOLVED**：capacity=64；logical cursor；before/after StateHash required；见 freeze §10 | — |
| D6 | trust/fear/attachment 等旧字段的归层 | `DEFERRED`（不硬塞 traits） |
| D7 | WorldModel 迁移适配评估 | `TO_BE_ASSESSED`（迁移 P3 前） |
| D8 | Narrative Identity / Self Model | 未来慢变量（V0 不做） |

---

## 30. Acceptance Checklist（对应最终验收 8 问）

| # | 问题 | 本 spec 回答位置 |
|---|---|---|
| 1 | SubjectState 到底包含什么？ | §6 + §7–§19 |
| 2 | 谁能计算状态变化？ | §4/§5：domain transition producers |
| 3 | 谁能真正提交 canonical 状态变化？ | §5：subject-core（唯一 canonical mutator） |
| 4 | MemoryState 和 MemoryRepository 是什么关系？ | §9/§10 |
| 5 | MemoryRepository 写成功但 SubjectState commit 失败怎么办？ | §11 crash 语义：孤儿 revision 容忍 + GC，SubjectState 仍指旧 Rn-1 |
| 6 | logical time 如何驱动状态，而非系统时间？ | §19/§20：显式 elapsed_time，wall clock 仅 metadata |
| 7 | session restore 后哪些必须仍存在？ | §22 + freeze §11：完整 canonical snapshot，包括全部 Context 与 TraceWindow/Cursor，原样恢复 |
| 8 | LLM 为何无法直接写"我现在很开心"？ | §28：proposal → validation → subject-core commit，LLM 无 canonical mutator 路径 |

---

## 附：本 spec 的宪法级新增决定（需与根文档同步）

1. `canonical_mutator = subject-core only`（Producer != Mutator）→ ARCHITECTURE §1 新增 P9。
2. `plasticity_config` → `mechanism_config` 改名 → ARCHITECTURE §5 同步。
3. WorldModel existence = `VERIFIED` legacy asset；migration = `TO_BE_ASSESSED` → MIGRATION_MAP 已同步。
4. MICL memory ownership = partitioned（Observation→retrieval 子域；Learning→content 子域）；DOUBLE MEMORY WRITE FORBIDDEN。

### P2.1 Contract Freeze Incorporation

`docs/implementation/p2-1-contract-freeze.md` 是本 spec 对 implementation-level ambiguity 的规范附录，正式关闭 G1–G11。它冻结：`subject-state-v0` fully-materialized closed schema、CanonicalRefV0、Golden S0、JCS/SHA-256 hash projections/vectors、TraceEntry/Window/Cursor capacity 64、exact restore、MechanismConfig object、result/error/identity 与 atomic persistence port。本文中旧的 optional/arbitrary/ellipsis、partial Context restore、trace N/hash optional 或 profile string 示意均由上述 exact clauses 取代；其余 P1 architecture 不变。
