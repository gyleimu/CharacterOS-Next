# P2.1 Subject Core Implementation Plan

**任务状态：** P2.1 Subject Core Implementation Planning — COMPLETE。

**实施状态：** NOT STARTED / REQUIRES EXPLICIT AUTHORIZATION。

**规划基线：** `cafab58e5e9003bbcf90768bd9fb57be720cb03c`

**交付边界：** 本文只定义未来实施顺序、职责、schema、validation、commit、revision、trace、hash、restore 与 conformance 计划；不包含 TypeScript/Python 实现、测试代码、依赖变更、运行时行为或实验。

---

## 1. Final Verdict and Authority

| 对象 | Verdict | 含义 |
|---|---|---|
| 本规划产物 | **PASS** | P2.1 的模块边界、schema catalog、commit 算法、error/restore 模型、acceptance slice 与实施阶段已完成分解；关闭 contract-freeze gates 且另获显式授权后方可执行 coding。 |
| P2.0 bootstrap | **COMPLETE** | TypeScript workspace、package boundary 与工具链已建立；这不等于 P2.1 contract details 已全部冻结。 |
| P2.1 coding readiness | **BLOCKED PENDING CONTRACT FREEZE** | §1.2 的 P1/P1.5 追踪、schema、hash、trace 与 restore 空白必须先由 contract owner 做 docs-only 封口。 |
| P2.1 implementation | **NOT STARTED** | 本文不是 coding authorization，不得据此创建 commit engine、mutation logic 或 storage adapter。 |
| P1/P1.5 architecture | **UNCHANGED** | 本文服从冻结设计；发现冲突时停止相关 slice，不为实现方便改写上游语义。 |

### 1.1 联合冻结权威与一致性处理

以下四份 P1/P1.5 文档共同构成冻结权威，不建立擅自推导的全局线性优先级：

- `docs/architecture/subjectstate-v0-spec.md`
- `docs/architecture/transition-contracts.md`
- `docs/architecture/micl-design.md`
- `docs/evaluation/p1-5-engineering-acceptance-contract.md`

若某份文档明确标注 consistency correction / replaces / supersedes 的具体条款，则该**局部修正**控制被点名的旧条款；这不构成整份文档的普遍优先级。其余冲突一律触发 blocking docs-only clarification，不允许实现者自行选择。

`docs/implementation/p2-runtime-plan.md` 与本文都是下游实施计划，只能分解上述联合权威，不能覆盖它们。本文不得用“更方便实现”作为裁决依据。

### 1.2 P2.1 coding entry gates

P2.1 第一行实现代码之前，必须先同时满足 `p2-runtime-plan.md` §15 的八项 umbrella gates：

1. P1.5 Engineering Acceptance Contract 状态明确为 PASS；
2. 人类对 **P2.1 implementation** 给出单独显式授权；
3. P1/P1.5 source docs 仍为冻结权威；
4. acceptance fixture catalog 已冻结；
5. A1–A13 requirement/fixture/oracle/evidence matrix 完整；
6. 无 unresolved MUST ambiguity；
7. scope 仍限于 MICL minimal runtime 的 P2.1 Subject Core slice；
8. NO research experiment / NO uncontrolled migration。

此外，下列 P2.1-specific gaps 必须由 contract owner 做 docs-only 封口并留下可审计产物：

| Gate | 当前空白/冲突 | 本计划规则 |
|---|---|---|
| G1 Requirement index | A1 正文存在 `TR-DET-001` 但 matrix 无独立 row；A11 正文为 `ATOMIC-001`，matrix 为 `TR-ATOMIC-001`；A4.1/A4.2、A5 无 leaf ID；`TIME-*`、`TRACE-*`、`HASH-*`、`FAIL-*`、`IDEM-*`、`MICL-*` 仍是 family | 不发明 ID；冻结 leaf catalog、matrix row 或正式 family expansion rule |
| G2 Golden S0 | P1.5 把 `schema_version` 写进 `runtime_metadata`，SubjectState spec 规定它只能在顶层 | fixture 必须 docs-only 修正为单一顶层来源 |
| G3 Schema closure | `RelationshipsPlaceholder.models` 的 `…minimal`、若干 metadata/config object、ref 格式、允许 enum/key 集仍未闭合 | 冻结 executable schema；不得由 coding agent 猜字段 |
| G4 Hash contract | hash algorithm、projection version、numeric normalization、数组语义、golden vectors及 `schema_version` 的 StateHash inclusion 未冻结 | 分别冻结 full persistence、StateHash、SnapshotHash；不得用普通 JSON 偶然行为充当规范 |
| G5 Trace contract | TraceWindow 结构、`trace_cursor` 位置/类型、窗口 N、offload/write-ahead、before/after hash 必选性未封口 | 冻结结构与 crash oracle；不得 commit 后补 trace |
| G6 Restore semantics | transient Context 是 canonical/hash-included 但不跨 session；materialize 原 snapshot 与 formal reset transition 未选择，Time 又没有 Context write authority | restore 不得静默 reset；contract owner 先冻结 owner、revision/hash/trace oracle |
| G7 Affect config shape | SubjectState 把 `affect_profile` 定为 enum/string；Transition Contract 使用 `affect_profile.timebase` object path | 先冻结唯一 schema path；subject-core 只验证，不扩 schema |
| G8 Error/status mapping | 用户规划词与冻结 error enum 不完全一致；`REBASE_REQUIRED` 尚未裁定为 status/code/reason | 冻结 wire-level mapping；内部 umbrella 不得冒充 canonical code |
| G9 Transition identity durability | committed ID 的同界 authoritative record 已要求；rejected/aborted ID+payload 跨重启如何记忆尚未完整定义 | 冻结 authoritative record/audit durability；不得依赖 bounded trace_window |
| G10 Atomic persistence | StateStore、MutationHistory/TraceStore、idempotency projection 与 publish recovery 的最小原子协议/文件策略未冻结 | 先冻结 port contract 与 crash cases，不选择数据库或分布式架构 |
| G11 Retrieval executor wording | Transition Contract §26 写“Memory Retrieval 由 core 执行”，但同文 §5 与 MICL §3 禁止 `subject-core` import/call memory | 明确此处 `core` 指 runtime/retrieval deterministic core，而非 `subject-core`；不得把 retrieval 放入 Subject Core |

上述 gate 只做文档/契约封口，不授权 domain logic、MICL 或 P2.1 coding。

---

## 2. Subject Core Position

Subject Core 是 CharacterOS-Next 的 **canonical state authority**。它是小型、确定性、领域无关的状态内核，不是“大脑”。

### 2.1 Subject Core owns

1. canonical SubjectState schema 与 immutable snapshot boundary；
2. CanonicalTransitionProposal / DomainDelta 的结构入口；
3. producer、transition owner、field authority 的 canonical catalog；
4. revision、logical-time、readonly 与 cross-field invariant；
5. deterministic candidate construction；
6. one-transition/one-atomic-commit boundary；
7. TraceEntry、MutationHistory linkage、trace_window projection；
8. canonical serialization、StateHash、SnapshotHash contracts；
9. persistence ports、commit record 与 fail-closed restore validation；
10. transition-level idempotency lookup/reconciliation。

“owns”表示 SubjectState 属于 subject，而 `subject-core` 是唯一 canonical authority/mutator；不表示 subject-core 拥有各领域如何计算变化的知识。

### 2.2 Subject Core validates

Subject Core 可以知道并验证：

- `AffectDelta` 只能触碰 affect/mood 的合法 canonical 字段，值满足公开 schema/range；
- `MemoryContentDelta` 与 `MemoryRetrievalMetadataDelta` 写入互不重叠的 MemoryState 子域；
- `repository_revision` 引用经倒置的 reference-validator capability 确认存在且有效；
- producer 是否有权在该 transition 写该 field path；
- identity/traits/beliefs/relationships/mechanism_config 是否被非法修改；
- revision、logical time、trace、hash 与 whole-state invariants 是否一致。

### 2.3 Subject Core does not know

Subject Core 不知道也不得实现：

- “生气应该增加多少”、FAST+EMA 如何计算、哪个 channel 应激活；
- 哪条 memory 更重要、retrieval 如何排名、如何编码 episodic content；
- Interpretation/Appraisal 如何生成或其心理学意义；
- regulation/homeostasis 如何演化；
- LLM prompt、provider、model、reasoning；
- MICL stage ordering、checkpoint/resume、Action/Behavior/World；
- personality/belief/relationship dynamics。

### 2.4 Dependency rule

```text
domain producer → proposal/delta → subject-core public contracts
                                  ↓
                         validate + atomic commit

subject-core → NO memory/affect/appraisal/regulation/runtime/micl/LLM import
```

Memory revision validation通过 subject-core 自己定义的最小 capability port 倒置依赖；未来 memory adapter 实现该 port。Subject Core 不 import MemoryRepository implementation，也不执行 retrieval。

---

## 3. Conceptual Module Responsibility Plan

以下是未来 `packages/subject-core` 内部责任分区，不是本任务创建目录或代码的授权：

| Conceptual module | 单一责任 | 明确禁止 |
|---|---|---|
| `state-schema` | SubjectState V0、nested canonical value、init/restore schema version | 不含 domain algorithms |
| `transition-contracts` | canonical envelope、DomainDelta data boundary、transition/producer identifiers | 不 orchestrate producer |
| `authority-catalog` | producer × transition × field-path allowlist、readonly partition、required/optional delta catalog | 不由 runtime 动态放宽 |
| `validation/schema` | type/required/default/range/canonicalizable-value validation | 不修复错误 payload |
| `validation/ownership` | producer/transition/field/multi-domain conflict checks | 不做 last-wins |
| `validation/references` | ref 形状、provenance linkage、倒置 capability 的 repository revision validity | 不 import memory/retrieval |
| `validation/invariants` | whole-state、revision、logical-time、readonly、cross-field invariants | 不计算 affect/memory meaning |
| `candidate` | 从 current snapshot + non-overlapping deltas 构造 deterministic candidate | 不 mutate current snapshot |
| `revision` | next revision、before/after lineage、CAS precondition | 不提供 rollback |
| `transition-identity` | transition ID + payload fingerprint lookup/reconciliation、idempotent result routing | 不依赖 bounded trace_window |
| `trace` | TraceEntry construction、MutationHistory linkage、trace_window/cursor projection | failure 不写 successful mutation trace |
| `serialization` | versioned full-persistence projection 与 canonical form | 不用普通 JSON 偶然顺序 |
| `hash` | StateHash/SnapshotHash projection orchestration | 不计算 RepositoryRevisionHash |
| `commit` | 组装 candidate/revision/trace/hash/identity record 并执行单一 atomic persist/publish | 不 domain-by-domain commit |
| `persistence-ports` | StateStore、TraceStore、reference validator、publish recovery 的能力契约 | 不选择 DB/vendor |
| `restore` | deserialize、schema/hash/revision/reference validation、immutable materialization | 不静默 default/reset/migrate |
| `errors` | stable rejection/status taxonomy 与 diagnostic details | 不泄漏随机 exception text 作为 contract |

所有模块只能沿内部单向依赖汇入 `commit`；domain/runtime 只依赖 subject-core 的 public contracts，不能访问 candidate/store internals。

---

## 4. SubjectState Schema Plan

### 4.1 Schema-wide rules

- 每个 canonical snapshot 必须完整包含 13 个顶层字段；不得为实现方便删除 readonly placeholder。
- canonical owner = subject；canonical mutator = subject-core，适用于全部字段。
- 表中 `Producer` 是“谁计算 delta”，不是 canonical writer。
- `StateHash IN` 表示当前 canonical logical value 进入 StateHash projection；repository payload 永不进入。
- trace cursor/ref/position 只进入 SnapshotHash；完整 trace content 同时排除于 StateHash 与 SnapshotHash。
- arbitrary object、map、array 只有在 executable schema、key/order/numeric canonicalization 冻结后才可实现。
- 初始化可应用冻结 default；restore 不得用 default 静默修补缺失/损坏的 persisted canonical field。

### 4.2 Top-level catalog

| Top-level field | Semantic producer / authority | Allowed mutation | Session persistence | Hash inclusion | Core validation |
|---|---|---|---|---|---|
| `schema_version` | subject-core init/schema authority | init only | full | **GATE:** full serialization IN；StateHash inclusion 待 projection freeze | 顶层唯一；不得复制进 runtime_metadata；仅接受支持版本 |
| `identity` | subject-core init | readonly after init | full | StateHash IN | subject_id stable；created_at 不得重复；禁止 memory/narrative 混入 |
| `traits_seed` | subject-core init | readonly after init | full | StateHash IN | dimensions finite 且 `[0,1]`；禁止 drift |
| `memory_state` | memory producer；partitioned transition owner | Observation retrieval 子域 / Learning content 子域 / config init | full（refs only） | StateHash IN；repository payload OUT | partition、revision、ref integrity、bounded retrieval trace |
| `beliefs` | subject-core init | readonly V0 | full | StateHash IN | source refs only；拒绝更新 delta |
| `relationships` | subject-core init | readonly V0 | full | StateHash IN | first-class read position；拒绝 dynamics |
| `mood` | affect producer | Observation / Time | full | StateHash IN | public schema/range/profile provenance；不计算值 |
| `affect` | affect producer | Observation / Time | full | StateHash IN | channel schema/range/phase/ref；不执行 FAST |
| `regulation` | regulation producer | Time / CognitionAction | full | StateHash IN | scalar ranges/logical timestamp；不执行 homeostasis |
| `context` | context producer | Observation / CognitionAction；reset 仍受 G6 | partial | StateHash IN for current canonical snapshot | persistent/transient partition、ref schema；restore 不静默 reset |
| `mechanism_config` | subject-core config/init authority | init/config only | full | StateHash IN | active profile 单一来源；不是 learned state |
| `trace_window` | subject-core | every committed transition, core-managed rolling projection | bounded window + cursor persistent | StateHash OUT；SnapshotHash cursor/ref IN | immutable entries、bounded projection、offload integrity |
| `runtime_metadata` | subject-core | every commit；Time only advances logical_time | full | canonical parts StateHash IN | revision/time monotonic、single created_at、canonical transition type |

### 4.3 Identity, traits and readonly placeholders

| Field path | Owner/producer | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `identity.subject_id` | subject-core init | full | IN | required stable string；proposal subject_id 必须一致；after init immutable |
| `identity.display_name` | subject-core init | full | IN | required string；default only at creation |
| `identity.origin_metadata` | subject-core init | full | IN | required canonicalizable closed object；禁止 wall-clock/random hidden values，具体 schema G3 |
| `identity.identity_anchors` | subject-core init | full | IN | optional ordered `array<string>`；字符串格式/顺序规则 G3 |
| `identity.self_schema_seed_refs` | subject-core init | full | IN | optional refs；不得内嵌 schema payload |
| `traits_seed.dimensions` | subject-core init | full | IN | required map；finite numbers `[0,1]`；key allowlist/unknown policy G3 |
| `beliefs.items` | subject-core init | full | IN | required refs-only array；V0 delta touching it = forbidden |
| `relationships.models` | subject-core init | full | IN | required read-model array；item 的 `…minimal` executable shape 必须先在 G3 冻结 |

### 4.4 MemoryState catalog

| Field path | Producer / transition owner | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `memory_state.working_refs` | memory / Observation retrieval | full；可经正式 delta reset | IN | refs belong to validated repository revision；不得承载 payload |
| `memory_state.active_episode_refs` | memory / Learning content | full | IN | refs valid under candidate repository revision；Observation 不得写 |
| `memory_state.autobiographical_index_revision` | memory / Learning content | full | IN | null 或有效 immutable revision ref |
| `memory_state.repository_revision` | memory / Learning content | full | IN | required；final reference-validator check 必须存在且有效 |
| `memory_state.consolidation_cursor` | memory / Learning content | full | IN | null 或 monotonic logical_time；Time 只可产 eligibility signal，不写该字段 |
| `memory_state.retrieval_config` | subject-core config/init | full | IN | 普通 Observation/Learning 都不得改；闭合 schema G3 |
| `memory_state.recent_retrieval_trace` | memory / Observation retrieval | full bounded ring | IN | refs-only、bounded；cap/order G3/G5 |
| `memory_state.lifecycle_metadata` | memory / Learning content | full | IN | canonicalizable object；不得变成 repository payload |
| `memory_state.pending_encoding_refs` | memory / Learning content | full | IN | refs-only；retry/rebase 语义由 Learning 层提供，core 只验证 candidate |
| `memory_state.last_retrieval_at` | memory / Observation retrieval | full | IN | null 或不晚于 canonical logical_time 的 logical_time |

Memory payload、embedding、ranking、episodic content 与 RepositoryRevisionHash 不属于 SubjectState schema。

### 4.5 Mood, Affect and Regulation catalog

| Field path | Producer | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `mood.baseline` | affect | full | IN | finite number，`[0, clamp]`；clamp authority 取自冻结 config；core 不计算 baseline |
| `mood.generated_under_profile` | affect | full | IN | null/string provenance；不得成为 active config authority |
| `mood.last_update` | affect | full | IN | null/logical_time；不得来自 wall clock |
| `affect.active_channels` | affect | full | IN | array of public AffectChannel；内部 FAST phase 不得泄漏 |
| `affect.generated_under_profile` | affect | full | IN | provenance schema only；历史生成 profile 可不同于当前 active profile，core 不重解释 |
| `affect.updated_at` | affect | full | IN | null/logical_time；不晚于 canonical logical_time |
| `affect.active_channels[].channel_id` | affect | full | IN | frozen enum/string policy；不由 LLM 直接写 |
| `affect.active_channels[].intensity` | affect | full | IN | finite `[0,1]` |
| `affect.active_channels[].phase` | affect | full | IN | 仅 `{INACTIVE, ACTIVE, RELEASING}` |
| `affect.active_channels[].started_at` | affect | full | IN | logical_time；不晚于 current logical_time |
| `affect.active_channels[].source_appraisal_ref` | affect | full | IN | required ref；core 校验格式/授权 capability，不判断 appraisal 科学性 |
| `regulation.energy` | regulation | full | IN | finite `[0,1]` |
| `regulation.stress` | regulation | full | IN | finite `[0,1]` |
| `regulation.arousal` | regulation | full | IN | finite `[0,1]` |
| `regulation.fatigue` | regulation | full | IN | finite `[0,1]` |
| `regulation.last_update` | regulation | full | IN | null/logical_time；不晚于 current logical_time |

Subject Core 验证“结构与权威”，不验证“情绪是否合理”或“调节公式是否科学”。

### 4.6 WorkingContext catalog

| Field path | Producer | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `context.scene` | context | persistent | IN | required string，creation default `idle` |
| `context.task` | context | persistent | IN | null/string |
| `context.focus_refs` | context | transient across session | IN while canonical | refs-only；reset owner/restore oracle G6 |
| `context.active_entity_refs` | context | persistent | IN | refs-only |
| `context.environment_refs` | context | transient across session | IN while canonical | refs-only；reset owner/restore oracle G6 |
| `context.current_observation_ref` | context | transient across session | IN while canonical | null/ref；reset owner/restore oracle G6 |

LLM context window 不是 WorkingContext；restore adapter 不得把 prompt 内容写入这些字段。

### 4.7 MechanismConfig and RuntimeMetadata catalog

| Field path | Authority | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `mechanism_config.affect_profile` | subject-core config/init | full | IN | required profile；enum/object timebase shape G7；唯一 active config truth |
| `mechanism_config.legacy_reference_defaults` | subject-core config/init | full | IN | canonicalizable readonly object；不宣称科学真值 |
| `mechanism_config.feature_flags` | subject-core config/init | full | IN | frozen closed keys；不允许 producer 私自注册 |
| `mechanism_config.thresholds` | subject-core config/init | full | IN | frozen closed schema/ranges |
| `runtime_metadata.subject_version` | subject-core | full | IN | required supported version；与 schema_version 分工需 G3 明确 |
| `runtime_metadata.state_revision` | subject-core | full | IN | integer monotonic；成功 commit 恰好 +1 |
| `runtime_metadata.logical_time` | subject-core | full | IN | monotonic integer tick；只有 TimeTransition 可推进 |
| `runtime_metadata.last_transition_time` | subject-core | full | IN | null/logical_time；canonical time only |
| `runtime_metadata.last_transition_type` | subject-core | full | IN | null/canonical transition enum；统一使用 Transition Contract 拼写 |
| `runtime_metadata.created_at` | subject-core init | full | IN | required logical_time；唯一 creation-time source |
| `runtime_metadata.updated_at` | subject-core | full | IN | required logical_time；不得调用 `Date()` 驱动 |

### 4.8 TraceWindow schema boundary

`trace_window` 是 canonical bounded projection，但不是 authoritative full history。未来 executable schema 必须至少表达：有序 recent TraceEntry refs/entries、offload boundary/cursor、projection version；精确字段名、cursor 位置与 N 属 G5，不由本文发明。

---

## 5. Canonical Snapshot Model

### 5.1 Snapshot lifecycle

```text
validated creation seed
  → immutable SubjectState revision 0
  → read-only current snapshot
  → validated CanonicalTransitionProposal
  → new immutable snapshot revision N+1
  → atomic authoritative record
  → publish/read
```

- Current snapshot 永不原地修改。
- Candidate 在 commit 前不是 canonical；失败即丢弃。
- 成功 commit 创建新 snapshot；旧 revision 保持可审计、不可重写。
- `previous_revision` **不是**新的 SubjectState 字段。lineage 由 TraceEntry 的 before/after revision、CanonicalCommitResult 与 authoritative commit record 表达。
- post-commit correction 必须是新 corrective transition；禁止把 revision N+1 回滚成 N。

### 5.2 Revision and logical time

- `state_revision` 是 subject canonical revision；每次成功 canonical commit恰好 `+1`。
- `logical_time` 是 canonical time authority；wall clock 仅可存在于外部 observability/audit。
- TimeTransition runtime/transition layer 按冻结 time contract 从 current logical time + normalized elapsed duration确定性派生 `logical_time_after`；subject-core 只验证并纳入 canonical commit，不自行解释或归一化 elapsed。
- Observation/Learning/CognitionAction 只携带 occurrence logical time，不自行推进 canonical logical time。
- 当 runtime/transition layer 按冻结 contract 把 elapsed=0 分类为 `NO_OP` 时，不创建 snapshot、不加 revision、不写 MutationHistory；subject-core 不自行判定该分类。

### 5.3 Creation and restore distinction

- Creation 从 validated seed 产生初始 snapshot；S0 以 revision 0/logical_time 0 为 acceptance fixture 基线。
- Restore materialize 同一 snapshot 时，revision/StateHash 不变，不生成虚假 transition。
- 任何会改变 canonical field 的“restore repair/reset/migration”都不是 materialization，必须是冻结的 formal transition，带 revision +1 + TraceEntry；G6 未封口前不得实现。

---

## 6. Domain Delta Model

### 6.1 Formal input boundary

Subject Core 不接受裸 `DomainDelta[]` 作为随意 patch API。唯一入口是冻结的 CanonicalTransitionProposal，概念字段为：

```text
transition identity
subject identity
transition type
expected state revision
transition-specific time input
cause references
domain deltas whose cardinality follows the frozen transition contract
optional external references / metadata
```

每个冻结 DomainDelta 只明确包含：producer、domain、delta payload、optional expected domain revision。

### 6.2 Requested metadata without schema invention

用户要求的概念责任按如下方式满足，但不擅自扩展 envelope：

| Concept | Plan |
|---|---|
| source producer | 使用冻结 `producer` + `domain`；不能由 payload 覆盖 |
| target fields | 由 delta schema + authority catalog **派生**；不信任 producer 自报 `target_fields` |
| expected revision | proposal 的 `expected_state_revision`；domain delta 可带冻结的 `expected_domain_revision?` |
| validation metadata | 使用 versioned schema/catalog identity 与 deterministic payload fingerprint；确切 wire field/algorithm 由 G4/G9 冻结 |
| provenance | proposal `cause_refs`、`external_refs?`、`metadata?` 与 accepted producer result refs；TraceEntry 由 core 构造，producer 不得伪造 |

若未来确需显式 `target_fields` 或 per-delta provenance 字段，必须先修改冻结 contract；coding agent 不得直接添加。

### 6.3 Allowed P2 delta partitions

| Delta concept | Producer | Allowed transition | Allowed target partition |
|---|---|---|---|
| AffectDelta | affect | Observation / Time | `affect` |
| MoodDelta | affect | Observation / Time | `mood` |
| RegulationDelta | regulation | Time / CognitionAction | `regulation` |
| ContextDelta | context | Observation / CognitionAction | `context`；reset 特例受 G6 |
| MemoryRetrievalMetadataDelta | memory | Observation | `working_refs`、`recent_retrieval_trace`、`last_retrieval_at` |
| MemoryContentDelta | memory | Learning | content/encoding/consolidation fields |

Identity、TraitsSeed、Beliefs、Relationships、MechanismConfig 在 V0 不接受普通 domain delta。TraceWindow 与 RuntimeMetadata 只能由 subject-core 在成功 commit 中产生。

### 6.4 Conflict rules

- 两个 delta 触碰同一 canonical field path → `DOMAIN_DELTA_CONFLICT`。
- 同一 `(producer, domain)` 重复出现 → `DOMAIN_DELTA_CONFLICT`。
- required delta 缺失 → `MISSING_REQUIRED_DELTA`。
- optional delta 缺失合法。
- 禁止 last-wins、Promise race order、object key order 或 registration order 决定结果。

---

## 7. Canonical Commit Algorithm

### 7.1 Inputs

- authoritative current immutable SubjectState snapshot；
- one CanonicalTransitionProposal containing `domain_deltas[]`；
- versioned schema/authority/hash contracts；
- inverted capabilities：StateStore CAS/atomic persist、reference validator、TraceStore prepare/read、authoritative transition-record lookup。

### 7.2 Pipeline

1. **Check transition identity and envelope**：验证 subject/transition identity、transition type、time-input shape、payload identity；查询 authoritative transition record。
2. **Resolve idempotency before apply**：same committed ID + same payload fingerprint → `ALREADY_COMMITTED` + original result ref；same ID + different payload → `TRANSITION_ID_REUSE`；previously rejected/aborted + same payload 可按冻结语义重试，changed payload 必须使用新 ID；已提交分支不得进入 candidate construction。
3. **Check expected revision**：`expected_state_revision == current.state_revision`；否则 `STALE_STATE_REVISION`。Learning 所需 repository base/revision precondition 作为 domain revision guard 校验。
4. **Validate delta schema/ranges/reference syntax**：逐 delta 验证 required fields、canonicalizable values、ranges、producer/domain identity、ref 形状、cause/proposal linkage，并拒绝内嵌 repository payload；不执行 domain formula，也不在此信任外部 ref 存在性。
5. **Preflight aggregation conflicts**：overlap、duplicate `(producer,domain)`、missing required delta 全部在 apply 前检测。
6. **Validate producer/transition/field ownership**：使用 frozen authority catalog；readonly field、wrong transition、direct LLM/core impersonation 全部拒绝。步骤 5–6 属同一 pre-apply validation stage，不允许借顺序掩盖 conflict 或越权。
7. **Construct deterministic provisional candidate**：按不重叠 partition 把 delta 应用于 current 的结构共享/深不可变副本，并从冻结、已 normalized 的 transition time result 派生或验证 provisional core-owned `revision +1`、canonical logical-time/transition metadata；subject-core 不自行 normalize elapsed。current snapshot 不变，candidate 仍非 canonical。
8. **Validate whole-state invariants**：验证 provisional candidate 的完整 schema、identity/readonly、revision/time、memory partition、ranges/config authority 与 cross-field invariants。
9. **Validate final references**：按 Transition Contract 冻结顺序，在 whole-state 后通过倒置 capability 校验 candidate `repository_revision` 及必要 refs 属于有效 immutable revision。
10. **Build hash/trace dependency bundle**：provisional logical state → StateHash；用 revision/cause/producer 与 G5 冻结的 optional/required hash-ref 规则构造 immutable TraceEntry；TraceEntry → final trace_window/cursor；StateHash + trace cursor/ref → SnapshotHash；构造 deterministic TransitionResult 与 final snapshot。
11. **Validate final snapshot and bundle**：再次验证 final snapshot 的 trace_window/cursor、revision/hash lineage、TraceEntry dependency、transition identity/result linkage 与所有 atomic-bundle required fields；不得只验证 domain candidate。
12. **Prepare authoritative atomic bundle**：final snapshot、revision、TraceEntry/MutationHistory linkage、trace cursor/hash refs、transition ID、payload fingerprint、result ref 与 store precondition 必须同界。
13. **Single atomic commit**：CAS current revision；任一持久化/trace precondition失败则 none committed。成功后 authoritative state 一次前进。
14. **Publish/recover result**：发布 immutable snapshot/result。publish 失败不回滚已 committed history；从 authoritative record 恢复发布。

步骤 4 只做 reference syntax/provenance schema；步骤 9 保留 P1 冻结的“whole-state 后最终 MemoryRepository revision validation”顺序，两者不得合并成提前信任外部 ref。

### 7.3 Failure rule

在步骤 13 的 atomic commit 成功前的任何失败：

```text
candidate discarded
current snapshot unchanged
state_revision unchanged
StateHash/SnapshotHash authority unchanged
no successful TraceEntry / MutationHistory append
external audit_event only
```

禁止把 audit_event 当作 canonical mutation trace。禁止 post-commit 补写 trace、idempotency record 或 revision。

步骤 14 的 publish failure 是 post-commit failure：已提交 snapshot/revision/TraceEntry 保持 authoritative，必须走 publish recovery，绝不回滚或重复提交。

---

## 8. Atomicity, Revision and Transition Identity

### 8.1 Atomicity model

禁止：

```text
commit Affect → commit Context → commit Memory metadata
```

必须：

```text
all deltas
  → conflict-free candidate
  → whole-state/reference validation
  → trace/hash/identity bundle
  → ONE canonical commit
```

一个 logical transition 最多产生一个 revision increment；MICL 是多个 transition 的 workflow，不得被 subject-core 合并成一个 global commit。

### 8.2 Revision outcome table

| Outcome | Revision | Snapshot | MutationHistory | Audit |
|---|---:|---|---|---|
| valid committed transition | `+1` exactly | new immutable snapshot | one immutable TraceEntry | optional observability only |
| schema/ownership/reference/invariant failure | unchanged | unchanged | none | rejection audit_event |
| stale expected revision | unchanged | unchanged | none | `STALE_STATE_REVISION` audit |
| runtime/transition 已按冻结 Time contract 判定 elapsed=0 `NO_OP` | unchanged | unchanged；不产生 canonical commit request | none | `NO_OP` 由 runtime/transition 返回；subject-core 不计算 elapsed |
| committed duplicate, same payload | unchanged | return authoritative original | none new | status `ALREADY_COMMITTED` |
| previously rejected/aborted, same ID + same payload | retry attempt 自身尚无预提交 revision；后续结果按正常 validation | unchanged until a later successful commit | none before success | same ID 可重试；跨重启识别受 G9 |
| same ID, different payload | unchanged | unchanged | none | `TRANSITION_ID_REUSE` audit |
| commit CAS conflict | unchanged by this attempt | reload authority | none by this attempt | `COMMIT_CONFLICT`/stale mapping per G8 |
| commit success, publish failure | already `+1` | committed snapshot remains authority | already appended | recover publish; no rollback |

### 8.3 Transition identity storage

`transition_id` 不新增为 SubjectState 顶层字段，也不能只存于 bounded `trace_window`。未来 authoritative commit record 必须与 commit 同界保存：

- transition ID；
- deterministic payload fingerprint；
- subject ID、before/after revision；
- committed TransitionResult ref；
- TraceEntry/StateHash/SnapshotHash refs；
- commit status required for recovery。

IdempotencyRegistry 只能是该 authoritative record 的同界 index 或可确定性重建 projection。commit✓/index-write✗ 后 retry 必须先 reconciliation，不能重复 AffectDelta 或 revision。

Previously rejected/aborted + same payload 可按冻结 contract 复用同一 ID 重试；changed payload 必须新 ID，复用旧 ID 则 `TRANSITION_ID_REUSE`。Rejected/aborted transition ID + payload 的跨重启 durability 仍属 G9；在未冻结前不得假定 bounded audit/trace 可以永久判定 reuse。

---

## 9. Validation Layers

| Layer | Responsibility | Representative checks | Failure semantics |
|---|---|---|---|
| L1 Schema | envelope、snapshot、delta、value shape/range/canonicalizability、ref syntax/provenance | required/type/default-at-init、finite number、enum、ref shape/linkage、no embedded payload/no undefined/random order | concrete schema/range code；no candidate authority |
| L2 Conflict and ownership | overlap/duplicate/missing delta、producer、transition owner、field partition、readonly/direct mutation | affect→affect/mood only；Observation vs Learning memory partition；LLM no writer | `DOMAIN_DELTA_CONFLICT` / `UNAUTHORIZED_PRODUCER` / `INVALID_TRANSITION_OWNER` |
| L3 Final reference integrity | whole-state 后的 infrastructure reference validity | candidate repository revision exists/valid；necessary refs belong to immutable revision | existing reference/revision code per G8；no mutation |
| L4 Cross-field invariant | full candidate consistency | identity unchanged；revision/time monotonic；config single authority；all top-level fields present | internal invariant category mapped by G8；no mutation |
| L5 Commit | idempotency、CAS、trace/hash bundle、atomic persistence/publish recovery | duplicate/reuse；revision precondition；trace prepared；authoritative record complete | status/rejection；never partial commit |

执行顺序必须满足 P1：per-delta schema/range → conflict/ownership → candidate → whole-state → final repository reference integrity → atomic commit。Layer 编号是职责分区，不允许借编号把最终 ref 校验提前或跳过。

### 9.1 Whole-state invariant catalog

至少验证：

- 13 个顶层 canonical fields 完整，`schema_version` 单一；
- `subject_id` 与 proposal/current 一致，Identity/Traits/Beliefs/Relationships/MechanismConfig 未越权变更；
- next revision 恰好 current +1，logical time 单调且来源合法；
- MemoryState retrieval/content/config partitions 无交叉写，repository revision/ref 形状与 candidate 内部一致；外部存在性在 L3 校验；
- Mood/Affect/Regulation/Context 值域与 logical timestamps 合法；
- generated profile 只是 provenance，active profile 唯一权威在 mechanism_config；
- candidate 不含 wall-clock/random/logging metadata 或 repository payload；
- deterministic serialization/hash projection可生成且版本受支持。

L5 final bundle validation 另外验证：TraceEntry 的 before/after revision、transition identity、cause refs、result linkage 与 final snapshot 一致；trace cursor/ref、StateHash/SnapshotHash 与 authoritative transition record 完整一致。TraceEntry 内的 `before_hash`/`after_hash` 是否为 required field 仍由 G5 冻结，不能因 bundle 需要 hash refs 而提前改成必选 wire field。

---

## 10. Trace Model

### 10.1 Four distinct objects

| Object | Authority | Mutability | Trigger |
|---|---|---|---|
| MutationHistory | authoritative logical history | append-only | every successful canonical commit |
| TraceEntry | one canonical mutation record | immutable | built before the matching commit |
| SubjectState.trace_window | bounded recent projection | core-managed rolling | updated in the same commit |
| AuditEvent | external audit infrastructure | append-only policy outside canonical state | failed/rejected/unauthorized attempt |

TraceStore/AuditStore 是 infrastructure；trace_window eviction 不是 history deletion。

### 10.2 TraceEntry planned content

每次成功 commit 的 immutable entry 必须包含冻结语义：trace ID、transition ID/type、revision before/after、logical time、mutated layer、rule ID、cause refs、optional proposal ref、producer/domain、field-level mutation summary、必要 memory revision before/after、outcome=`committed`。`before_hash`/`after_hash` 仅在 G5 冻结为 required 时才成为必填；在此之前保留为上游规格的 optional trace fields。

P2.1 不保存整份 before/after snapshot 到每条 trace；使用 field delta、refs 与按 G5 规则采用的 optional hash fields。atomic bundle 本身仍必须保留所需 StateHash/SnapshotHash refs。

### 10.3 Atomic trace sequence

1. candidate logical state确定；
2. StateHash before/after确定为 atomic-bundle data；
3. TraceEntry 使用 revision/cause/producer 构造并验证；only if G5 requires it, include before/after hash fields；
4. TraceStore/offload precondition满足；
5. trace_window/cursor projection更新；
6. snapshot + revision + TraceEntry/history linkage + cursor/hash refs 同一 commit。

TraceStore unavailable 时，不允许“state commit成功但 authoritative TraceEntry 丢失”。失败 proposal 只产生 AuditEvent，不得伪造成 outcome=`committed`。

---

## 11. Serialization and Hash Model

### 11.1 Distinct projections

| Projection | Includes | Excludes | Owner/use |
|---|---|---|---|
| Full persistence serialization | full canonical snapshot；persistent trace_window/cursor；所有 contract-required canonical fields | external logs、repository payload | subject-core persistence/restore |
| StateHash | canonical logical state，包括 canonical runtime_metadata；memory refs/revisions而非 payload | wall clock、random/log metadata、repository payload、trace content | equality、deterministic replay、integrity |
| SnapshotHash | StateHash + trace cursor/ref/position | full trace content、external logs | snapshot-to-history position integrity |
| RepositoryRevisionHash | one immutable MemoryRepository revision | SubjectState content | memory infrastructure；core只接收/验证 ref |

四者不可混写成“一个 hash”。

### 11.2 StateHash content rules

StateHash 必须覆盖 identity、traits_seed、MemoryState canonical refs/config/metadata、beliefs、relationships、mood、affect、regulation、current canonical context、mechanism_config 与 runtime_metadata canonical parts。顶层 `schema_version` 是否纳入 StateHash 明细存在文档空白，必须由 G4 冻结；full persistence 无条件包含它。

### 11.3 Canonicalization requirements

未来 ADR/golden vectors 必须冻结：

- projection name + version；
- hash algorithm/version；
- stable field/key order；
- number normalization（含负零、整数/小数、非有限数拒绝）；
- enum/string normalization；
- array order/set semantics逐字段裁定；
- null/optional/absent 表达；禁止 undefined；
- UTF/string normalization；
- excluded wall-clock/log/random metadata policy；
- StateHash/SnapshotHash/full persistence golden vectors。

same semantic state 必须得到相同 canonical bytes 与 StateHash；不同 wall clock、logging timestamp、execution duration 不得改变结果。

---

## 12. Persistence and Restore Boundary

### 12.1 Persistence responsibility

Subject Core 负责：

- versioned canonical snapshot serialization contract；
- StateStore/TraceStore/reference-validator/publish-recovery ports；
- expected revision CAS 与 atomic bundle语义；
- persisted snapshot/commit record/trace/hash 的一致性验证；
- fail-closed restore。

Subject Core 不负责：数据库选择、vector DB、MemoryRepository payload/index、distributed transaction、deployment durability claim。未来 concrete local adapter 属 sandbox composition，不得反向进入 subject-core。

### 12.2 Crash semantics

| Crash case | Required result |
|---|---|
| MemoryRepository prepare成功，canonical commit失败 | prepared revision成为 orphan/pending；SubjectState 仍指旧 revision |
| candidate引用不存在/损坏 repo revision | `INVALID_MEMORY_REVISION`；none committed |
| canonical commit成功，publish失败 | committed snapshot仍是 authority；recover publish；不回滚 |
| TraceStore/offload不可用 | 不允许成功 mutation 丢 authoritative TraceEntry；precommit abort/prepare-commit recovery |
| commit成功，idempotency index写失败 | authoritative commit record重建 index；retry返回 original result，不重复 revision |

### 12.3 Restore pipeline

1. 读取 versioned persisted envelope，不应用 silent defaults；
2. 校验顶层 `schema_version` 与 supported subject version；未知/损坏版本 fail closed；
3. 校验完整 canonical schema、required fields、ranges与readonly shape；
4. 校验 revision/logical-time/created-at/last-transition consistency；
5. 使用同版本 canonicalization 重算 StateHash/SnapshotHash，并与 persisted manifest/commit record比较；
6. 通过倒置 reference validator校验 `repository_revision` 存在且有效，refs不指向未知 revision；
7. 校验 trace_window/cursor 与 authoritative MutationHistory/commit record位置一致；
8. 校验 transition identity/idempotency projection可由 authoritative records重建；
9. materialize immutable snapshot；同一 snapshot restore不增加 revision、不生成 TraceEntry；
10. 任一失败返回 fail-closed result + audit evidence，不自动 repair/reset/migrate。

### 12.4 Transient Context rule

在 G6 关闭前，restore adapter必须保留输入 canonical snapshot并验证 hash，或直接拒绝不明确的 reset request；不得私自清空 `focus_refs/current_observation_ref/environment_refs`。若 contract最终定义 reset形成新 state，则必须由正式授权 transition执行，revision +1 + TraceEntry + new hash。

---

## 13. Error and Result Model

### 13.1 Frozen core-relevant codes/statuses

| Code/status | Meaning | Canonical mutation? |
|---|---|---|
| `INVALID_SCHEMA` | envelope/state/delta schema无效 | no |
| `INVALID_VALUE_RANGE` | canonical value/range无效 | no |
| `STALE_STATE_REVISION` | expected revision与current不一致 | no |
| `INVALID_LOGICAL_TIME` / `INVALID_TIMEBASE` | canonical time input无效 | no |
| `INVALID_MEMORY_REVISION` | candidate引用不存在/无效 repository revision | no |
| `FORBIDDEN_DIRECT_MUTATION` | 绕过 proposal/producer/core path | no |
| `UNKNOWN_SUBJECT` | subject不存在/identity mismatch | no |
| `PROPOSAL_REJECTED` | proposal未通过已冻结 validation | no |
| `DOMAIN_DELTA_CONFLICT` | overlap或duplicate producer/domain delta | no |
| `MISSING_REQUIRED_DELTA` | transition所需 delta缺失 | no |
| `UNAUTHORIZED_PRODUCER` | producer无权写目标 | no |
| `INVALID_TRANSITION_COMPOSITION` | transition composition不合法 | no |
| `INVALID_TRANSITION_OWNER` | transition无权写该 canonical field | no |
| `COMMIT_CONFLICT` | authoritative commit precondition/CAS conflict | no by this attempt |
| `TRANSITION_ID_REUSE` | same ID + different payload | no |
| `ALREADY_COMMITTED` | same committed ID + same payload 的 idempotent result status | no new mutation |

### 13.2 Requested names that are not frozen codes

| Requested concept | Planning coverage | Wire-level rule |
|---|---|---|
| `INVALID_REVISION` | malformed revision与stale revision都覆盖 | malformed映射 schema/range；mismatch用 `STALE_STATE_REVISION`；不得新增同义 code |
| `INVALID_MEMORY_REFERENCE` | repository revision/ref integrity失败覆盖 | repository revision使用 `INVALID_MEMORY_REVISION`；其他 ref-specific code需 G8 |
| `INVALID_DELTA` | delta shape/range/overlap/missing/owner失败全部覆盖 | 只是内部 umbrella；对外使用具体 frozen code |
| `INVARIANT_VIOLATION` | whole-state invariant failure覆盖 | 尚非 frozen canonical code；G8必须冻结具体 mapping |

`ALREADY_COMMITTED` 不是 ordinary error；它返回 authoritative original result ref，revision不变。Error detail可以包含 deterministic path/rule/cause信息，但不得用随机 exception text、stack或wall-clock作为 contract truth。

---

## 14. P1.5 Acceptance Mapping

### 14.1 Ownership classification

| Acceptance | Subject Core responsibility | Classification |
|---|---|---|
| A1 Determinism | deterministic candidate merge、serialization、StateHash/trace semantic content | **SHARED**；完整 MICL/retrieval/appraisal determinism不归 core |
| A2 Memory Ownership | MemoryState属于SubjectState；ref-only schema；restore用validator fail closed | **SHARED**；repository existence/content属memory infrastructure |
| A3 Retrieval | 无 retrieval/ranking责任 | **NOT OWNED** |
| A4 Retrieval/Appraisal Dependency | 只提供通用 authority/ref guard | **NOT OWNED**；stage dependency属runtime/appraisal |
| A5 Affect Continuity | 保真persist/restore Mood/Affect | **PREREQUISITE ONLY**；不做affect/time evolution |
| A6 State Authority | 唯一mutator、field/producer authority、direct mutation rejection | **PRIMARY** |
| A7 Trace | 每次成功commit原子产生TraceEntry/MutationHistory/trace_window | **SHARED/PRIMARY CORE SLICE**；MICL全链refs属runtime/domains |
| A8 Time | 守logical-time/revision invariant与wall-clock hash exclusion | **PREREQUISITE ONLY**；不算elapsed、不orchestrate Time |
| A9 Optional Action | 无workflow/action责任 | **NOT OWNED** |
| A10 Failure | precommit reject、state/revision/hash unchanged、audit semantics | **SHARED**；provider/repository/MICL status在外部 |
| A11 Atomic Commit | one candidate + one state/revision/trace/hash commit | **PRIMARY** |
| A12 Idempotency/Resume | transition ID/payload fingerprint/duplicate/reuse/reconciliation | **SHARED**；MICL resume与episode dedup不归core |
| A13 Stale Rebase | stale reject且零canonical mutation | **GUARD ONLY**；reload/revalidate/rebase/rebuild属Learning/runtime/memory |

P2.1 不得声称单独通过 A3/A4/A5/A8/A9/A13，也不得把 core-level stale rejection冒充完整 A13。

### 14.2 Requirement/fixture/oracle/evidence mapping

| A | Frozen ID/family | P2.1 slice | Oracle | Evidence |
|---|---|---|---|---|
| A1 | `HASH-DET-001`, `TR-DET-001` | same state/proposal→same candidate/hash/trace semantics | Exact + Hash Equality | state-hash + transition-trace manifests |
| A2 | `MEM-REV-001`, `MEM-OWN-001` | R999 fail closed；payload不进state；restore同ref | Reference Integrity + Failure Code | repository-revision + state-hash manifests |
| A6 | `LLM-AUTH-001` | fake revision/affect/memory/trace/direct mutation reject | Forbidden Mutation + Failure Code | failure-summary |
| A7 | `TRACE-*` family | every commit has atomic trace；window eviction不丢history | Required Trace + Reference Integrity | transition-trace-manifest |
| A10 | `FAIL-*` family | all core rejections keep revision/state/hash unchanged | Failure Code + Revision Delta | failure-summary |
| A11 | `ATOMIC-001` body / `TR-ATOMIC-001` matrix（G1） | invalid one-of-N delta→none committed | Forbidden Mutation + Revision Delta 0 | failure-summary |
| A12 | `IDEM-*` family | same/different payload duplicate semantics；crash reconciliation | Revision Delta + Failure/Status | fixture-results |
| A13 | `REBASE-STALE-001` | core仅证明stale no-mutation guard | Forbidden Mutation + Revision Delta | failure-summary；workflow status属后续phase |

P2.1 还必须支持 P1.5 §29 Session Restore、§30 Crash Window、§31 StateHash/Serialization 的 core-owned normative clauses。正式全量 conformance仍需六类 evidence：`conformance-report.json`、`fixture-results.json`、`state-hash-manifest.json`、`transition-trace-manifest.json`、`repository-revision-manifest.json`、`failure-summary.json`。

---

## 15. Conceptual Fixture Plan

以下 `SC-*` 仅是 P2.1 本地 conceptual fixture labels，不是新 P1.5 Requirement IDs。本任务不创建或执行测试。

| Fixture | Setup / stimulus | Expected | Acceptance/oracle |
|---|---|---|---|
| SC-001 Valid delta commit and deterministic replay | two isolated identical current snapshots + same authorized non-overlapping delta bundle | both runs exactly revision +1；same immutable next-state canonical bytes/StateHash/trace semantic content/result；each old snapshot unchanged | A1/A7 core slice；Exact/Hash/Required Trace |
| SC-002A Invalid producer | proposal reaches core but declares an unlisted/unauthorized producer identity for its target field | exact `UNAUTHORIZED_PRODUCER`；none committed；audit only | A6/A10；Forbidden Mutation + Failure Code + Revision Delta 0 |
| SC-002B Invalid transition owner | otherwise valid producer 在错误 transition 写受限 canonical field | exact `INVALID_TRANSITION_OWNER`；none committed；audit only | A6/A10；Forbidden Mutation + Failure Code + Revision Delta 0 |
| SC-002C Direct canonical-write bypass | attempt bypasses CanonicalTransitionProposal/subject-core commit boundary to write state, revision, trace, or memory reference | exact `FORBIDDEN_DIRECT_MUTATION`；none committed；audit only | A6/A10；Forbidden Mutation + Failure Code + Revision Delta 0 |
| SC-003 Stale revision | expected N，authority已是N+1 | `STALE_STATE_REVISION`；state/revision/hash/trace unchanged | A10 + A13 guard only；Revision Delta 0 |
| SC-004 Duplicate transition | case A same ID/same payload after commit；case B same ID/different payload；case C prior rejected/aborted with unchanged payload retry | A=`ALREADY_COMMITTED` + original result；B=`TRANSITION_ID_REUSE`；C may retry through normal validation；A/B no increment | A12；Revision Delta + Expected Status/Code |
| SC-005 Atomic failure | multi-domain bundle中一个 ContextDelta invalid | exact frozen failure code；Affect/Mood/Context/Memory retrieval metadata全部不变；no trace append | A11/A10；Forbidden Mutation + Failure Code + Revision Delta 0 |
| SC-006 Invalid memory revision | candidate引用R999；validator capability reports不存在/损坏 | exact `INVALID_MEMORY_REVISION`；none committed；core无memory import | A2/A10/Crash C2；Reference Integrity + Failure Code + Revision Delta 0 |
| SC-007 Deterministic hash | semantic-equivalent state with controlled key/wall-clock/log variations | canonical bytes/StateHash相同；excluded values无影响；SnapshotHash按cursor变化规则 | A1 + §31；Hash Equality/golden vectors |
| SC-008 Restore validation | valid roundtrip + corrupt schema/hash/revision/repo ref variants | valid materialize same revision/hash；每个corrupt variant fail closed，无repair | A2 + §29/§31；Hash/Reference/Failure |
| SC-009 Readonly field attack | a valid proposal attempts identity/traits/beliefs/relationships/config through an ordinary domain delta | none committed；exact owner/producer code follows the G8 frozen field/actor scenario matrix | A6/A10；Forbidden Mutation + Failure Code + Revision Delta 0 |
| SC-010 Delta overlap | two deltas触碰同field或duplicate producer/domain | `DOMAIN_DELTA_CONFLICT`；order变化不改变结果 | A1/A11；Exact + Revision 0 |
| SC-011 Trace crash window | TraceStore prepare/offload unavailable | canonical commit不发生；revision delta 0；authoritative trace不丢 | A7/A10/Crash C4；Required Trace + Revision Delta 0 |
| SC-012 Publish recovery | atomic commit成功后publish失败，再retry/recover | original commit exactly `+1` and has required trace/reference bundle；recovery retry `+0`；committed revision保持authority，无rollback/duplicate，原result可恢复 | A10/A12/Crash C3；Revision Delta + Required Trace + Reference Integrity |
| SC-013 Idempotency index loss | commit record成功，derived index缺失，same ID retry | 从authoritative record reconciliation；不重复AffectDelta/revision | A12；Revision Delta 0 |
| SC-014A Canonical wall-clock injection | persisted canonical field expects logical_time but receives wall-clock string | exact `INVALID_SCHEMA`；fail closed；revision delta 0 | A1/A10/§31；Failure Code + Revision Delta 0 |
| SC-014B Noncanonical observability variation | identical canonical state with different external logging/wall-clock observability metadata | canonical bytes/StateHash/result semantic content equal；external metadata not stored in canonical projection | A1/§31；Hash Equality |

每个 fixture 在实施时必须关联 frozen requirement、oracle、before/after revision/hash、trace/audit expectation 与证据文件；不能只断言“抛错了”。

---

## 16. Implementation Phases

### Entry Gate — Contract Freeze（非 coding phase）

**输入：** 四份冻结 P1/P1.5 文档、P2 plan §15、本计划 §1.2。

**输出：** leaf requirement index、executable schema catalog、error/status mapping、hash/serialization ADR+golden vectors、trace/restore/transition-identity/persistence port decisions。

**验收：** 无 applicable unresolved MUST ambiguity；独立 reviewer确认未修改 domain semantics。

**禁止：** 在 gate 未闭合时开始 Phase 1 coding；由 coding agent自行选 schema/hash/status。

### Phase 1 — Schema Types and Public Contracts

**输入：** closed SubjectState schema、canonical envelope、authority catalog、error/status mapping。

**输出：** SubjectState/nested value、CanonicalTransitionProposal/DomainDelta/Result、port与diagnostic contracts；只包含canonical data boundary。

**验收：** 13个顶层字段无遗漏；readonly/partition/public phase/metadata单一来源可追踪；subject-core import graph仍零domain/runtime/provider edge。

**禁止：** commit function、domain formula、LLM/provider、new schema field、`any`绕过。

### Phase 2 — Validation

**输入：** Phase 1 contracts、field authority matrix、runtime schemas、reference-validator capability。

**输出：** L1–L4 validators与deterministic diagnostic model；schema/ownership/reference/whole-state slices。

**验收：** SC-002/003/006/009/010/014 conceptual cases可被具体fixture覆盖；所有失败state/revision/hash unchanged；无domain import。

**禁止：** silent coercion/repair、last-wins、调用memory/affect/appraisal/regulation。

### Phase 3 — Candidate State Construction

**输入：** validated current snapshot + authorized non-overlapping deltas。

**输出：** pure deterministic candidate builder与change summary；old snapshot保持immutable。

**验收：** delta input order/race/registration order不改变candidate；overlap在apply前reject；revision/trace/hash尚未publish。

**禁止：** 原地mutation、store write、partial domain candidate publish。

### Phase 4 — Commit Engine Boundary

**输入：** validators、candidate builder、revision/idempotency/store port contracts。

**输出：** precommit coordinator、CAS/atomic bundle state machine、authoritative transition-record/reconciliation boundary。

**验收：** SC-001/003/004/005/010/013 的 precommit/revision/idempotency semantics 可在 future fixtures 验证；本阶段 coordinator 只能 dry-run/precommit，canonical persistence/publish 必须硬禁用。

**禁止：** canonical persistence/publish、state-only commit、commit后另写idempotency record、domain-by-domain commit、rollback revision。

### Phase 5 — Trace

**输入：** candidate/commit metadata、frozen TraceEntry/TraceWindow/cursor/offload contract。

**输出：** immutable TraceEntry builder、MutationHistory linkage、trace_window projection、AuditEvent separation、TraceStore prepare/recovery boundary。

**验收：** TraceEntry/window/history builder 与 precommit bundle validation 可被 future fixtures 验证；在 Phase 6 integrated publish 启用后，每个成功 canonical commit 必须有同界 trace，failure 无 mutation trace，window eviction 保留 authoritative history；SC-011通过。

**禁止：** canonical persistence/publish、post-commit trace、把AuditEvent混进MutationHistory、TraceStore失败时丢trace仍提交。

### Phase 6 — Hash, Persistence and Restore

**输入：** frozen canonicalization/hash ADR、golden vectors、trace cursor contract、StateStore/restore ports。

**输出：** full serialization、StateHash、SnapshotHash、atomic persisted bundle、fail-closed restore与publish recovery；仅当 Phase 1–5 的全部 atomic-bundle component 已集成并通过 final-bundle validation 后，本阶段才可首次启用 canonical commit/publish；sandbox reference adapter位于subject-core之外。

**验收：** SC-007/008/012/014；same semantic state hash equality；trace/payload/wall-clock exclusions正确；unknown/corrupt snapshot fail closed；no silent Context reset。

**禁止：** database/vendor耦合、一个hash混写三种projection、deserialize auto-repair/migration。

### Phase 7 — Conformance Slice and Independent Review

**输入：** P2.1 public APIs、SC fixture catalog、P1.5 A1/A2/A6/A7/A10/A11/A12 core slices及§29–§31条款。

**输出：** unit/integration/conformance tests与所需evidence artifacts（未来实施时）；independent dependency/scope/security review。

**验收：** P2.1 owned/shared slice 100% MUST PASS；no waiver by language quality；不声称A3/A4/A5/A8/A9/A13全量完成。

**禁止：** live LLM、scientific benchmark、P2.2 memory implementation、MICL orchestration、主观“看起来合理”oracle。

---

## 17. Explicit Non-Scope

P2.1 Subject Core 不实现：

- memory retrieval、ranking、encoding、repository payload/index；
- affect/emotion calculation、FAST+EMA、appraisal bridge；
- Interpretation、Appraisal、LLM/provider/prompt；
- regulation/homeostasis；
- personality drift、belief update、relationship update；
- Behavior、Action executor、World Model、tools、agent；
- MICL orchestration、workflow checkpoint/resume；
- database、vector DB、embedding、API、Web UI、deployment；
- scientific experiment、emotion validation、benchmark superiority；
- old CharacterOS runtime migration/copy。

---

## 18. Red Team Review

| Attack | Verdict | Evidence / mitigation |
|---|---|---|
| R1 Subject Core 是否变成 God Object？ | **PASS** | 只拥有canonical mechanics；domain calculation、orchestration、storage adapter均在外部；内部按单责模块分区。 |
| R2 是否依赖 domain？ | **PASS** | 零domain/runtime/provider import；Memory ref validation使用倒置 capability。 |
| R3 是否包含 emotion logic？ | **PASS** | 只验证CurrentAffect/Mood schema/range/authority；不计算channel/intensity/FAST。 |
| R4 是否包含 memory logic？ | **PASS** | 只持有MemoryState refs/partition并验证revision；不retrieve/rank/encode。 |
| R5 是否允许 LLM mutation？ | **PASS** | LLM无producer/mutator权限；direct revision/affect/memory/trace写入必须reject。 |
| R6 是否存在 partial commit？ | **PASS** | candidate + revision + trace + hash/cursor + identity result同一atomic bundle；任一delta invalid→none。 |
| R7 hash 是否包含随机字段？ | **PASS, GATED** | wall-clock/random/log/repo payload/trace content排除；算法/normalization/golden vectors在G4关闭后才可coding。 |
| R8 restore 是否偷偷修复？ | **PASS, GATED** | fail closed；same snapshot hash/revision不变；任何reset/migration必须formal transition，G6先封口。 |
| R9 是否偷偷修改P1 error/schema？ | **PASS** | 非冻结用户术语只作umbrella/mapping；不新增wire code/field/ID。 |
| R10 transition identity是否依赖bounded trace？ | **PASS, GATED** | authoritative commit record同界；trace_window不作永久ledger；rejected-ID durability由G9封口。 |
| R11 是否把core-level guard冒充全量A1–A13？ | **PASS** | acceptance明确分PRIMARY/SHARED/NOT OWNED；A13只承担stale no-mutation guard。 |
| R12 是否提前实现P2.1？ | **PASS** | 本文仅Markdown计划；无code/class/commit engine/mutation/test/依赖变更。 |

---

## 19. Safety and Authorization Check

本规划交付确认：

- **NO CODE**
- **NO IMPLEMENTATION**
- **NO COMMIT ENGINE CREATED**
- **NO STATE MUTATION LOGIC**
- **NO TEST CREATED OR RUN**
- **NO P2.1 START**
- **NO ARCHITECTURE/EVALUATION DOC CHANGE**
- **NO EXPERIMENT**
- **NO OLD REPOSITORY CHANGE**

唯一允许的下一步候选是：

> **P2.1 Subject Core Implementation — REQUIRES EXPLICIT AUTHORIZATION**

且授权前必须先关闭 §1.2 applicable entry gates。本文完成不构成任何自动开工权限。
