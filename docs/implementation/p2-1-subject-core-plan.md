# P2.1 Subject Core Implementation Plan

**任务状态：** P2.1 Subject Core Implementation Planning — COMPLETE。

**Contract freeze：** COMPLETE（`docs/implementation/p2-1-contract-freeze.md`）。

**Coding readiness：** READY FOR EXPLICIT AUTHORIZATION。

**实施状态：** NOT STARTED / REQUIRES EXPLICIT AUTHORIZATION。

**规划基线：** `cafab58e5e9003bbcf90768bd9fb57be720cb03c`

**交付边界：** 本文只定义未来实施顺序、职责、schema、validation、commit、revision、trace、hash、restore 与 conformance 计划；不包含 TypeScript/Python 实现、测试代码、依赖变更、运行时行为或实验。

---

## 1. Final Verdict and Authority

| 对象 | Verdict | 含义 |
|---|---|---|
| 本规划产物 | **PASS** | P2.1 模块边界与实施阶段已完成分解；contract freeze 也已完成，仍需单独显式 coding authorization。 |
| P2.0 bootstrap | **COMPLETE** | TypeScript workspace、package boundary 与工具链已建立。 |
| P2.1 contract freeze | **COMPLETE** | §1.2 G1–G11 全部由 docs-only freeze 关闭。 |
| P2.1 coding readiness | **READY FOR EXPLICIT AUTHORIZATION** | machine schema、requirement/fixture/hash/trace/restore/status/identity/port contracts 均已冻结；尚未授权/启动。 |
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

P2.1-specific gate result：

| Gate | Status | Frozen result |
|---|---|---|
| G1 | **CLOSED** | 49 unique MUST leaf；P2.1 denominator 28；no wildcard/dual ID |
| G2 | **CLOSED** | fully materialized 13-field S0；schema_version top-level only |
| G3 | **CLOSED** | exact closed schema/ref/delta/result catalog |
| G4 | **CLOSED** | RFC 8785 JCS + SHA-256 + projections + golden vectors |
| G5 | **CLOSED** | one multi-domain trace/commit；capacity 64；exact cursor；hashes required |
| G6 | **CLOSED** | exact full snapshot/context restore；no silent reset |
| G7 | **CLOSED** | affect_profile closed object；MechanismConfig sole authority |
| G8 | **CLOSED** | exact code/status/reason/layer mapping |
| G9 | **CLOSED** | durable fingerprint/identity/attempt journal across restart |
| G10 | **CLOSED** | one atomic compare-and-commit port + CAS/recovery oracle |
| G11 | **CLOSED** | retrieval = runtime-orchestrated memory service；never subject-core |

The authoritative exact values are in `docs/implementation/p2-1-contract-freeze.md`. Gate closure does not authorize domain logic, MICL or P2.1 coding；umbrella gate #2 (explicit authorization) remains unsatisfied。

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
| `persistence-ports` | `StateReader`（current snapshot + authoritative bundle-chain read）、`TransitionRecordReader`、`TransitionIdentityJournal`、memory-only `ReferenceValidator`、prepared-record verdict-only `PreparedResultValidator`、唯一 `AtomicCommitStore`、`PublishSink`、只读 `TraceHistoryView` 的概念能力 | 不选择 DB/vendor；不拆分 canonical writer；validator capability 不暴露 owning-domain payload |
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
| `schema_version` | subject-core init/schema authority | init only | full | StateHash IN | exact `subject-state-v0`；顶层唯一；restore unknown version fail closed |
| `identity` | subject-core init | readonly after init | full | StateHash IN | subject_id stable；created_at 不得重复；禁止 memory/narrative 混入 |
| `traits_seed` | subject-core init | readonly after init | full | StateHash IN | dimensions finite 且 `[0,1]`；禁止 drift |
| `memory_state` | memory producer；partitioned transition owner | Observation retrieval 子域 / Learning content 子域 / config init | full（refs only） | StateHash IN；repository payload OUT | partition、revision、ref integrity、bounded retrieval trace |
| `beliefs` | subject-core init | readonly V0 | full | StateHash IN | source refs only；拒绝更新 delta |
| `relationships` | subject-core init | readonly V0 | full | StateHash IN | first-class read position；拒绝 dynamics |
| `mood` | affect producer | Observation / Time | full | StateHash IN | public schema/range/profile provenance；不计算值 |
| `affect` | affect producer | Observation / Time | full | StateHash IN | channel schema/range/phase/ref；不执行 FAST |
| `regulation` | regulation producer | Time / CognitionAction | full | StateHash IN | scalar ranges/logical timestamp；不执行 homeostasis |
| `context` | context producer | Observation / CognitionAction | full | StateHash IN | all six fields exact restored；observation-scoped fields only changed by authorized delta |
| `mechanism_config` | subject-core config/init authority | init/config only | full | StateHash IN | active profile 单一来源；不是 learned state |
| `trace_window` | subject-core | every committed transition, core-managed rolling projection | bounded window + cursor persistent | StateHash OUT；SnapshotHash cursor/ref IN | immutable entries、bounded projection、offload integrity |
| `runtime_metadata` | subject-core | every commit；Time only advances logical_time | full | canonical parts StateHash IN | revision/time monotonic、single created_at、canonical transition type |

### 4.3 Identity, traits and readonly placeholders

| Field path | Owner/producer | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `identity.subject_id` | subject-core init | full | IN | required stable string；proposal subject_id 必须一致；after init immutable |
| `identity.display_name` | subject-core init | full | IN | required string；default only at creation |
| `identity.origin_metadata` | subject-core init | full | IN | closed `{creation_source:Identifier|null,seed_version:Identifier|null}` |
| `identity.identity_anchors` | subject-core init | full | IN | required unique ordered NFC `array<string>`；default `[]` |
| `identity.self_schema_seed_refs` | subject-core init | full | IN | required typed set-like refs；creation default `[]`；不得内嵌 schema payload |
| `traits_seed.dimensions` | subject-core init | full | IN | pattern-key scalar map；exact rule freeze §6.2 |
| `beliefs.items` | subject-core init | full | IN | required refs-only array；V0 delta touching it = forbidden |
| `relationships.models` | subject-core init | full | IN | closed `{relationship_id,target_ref}` array；unique/sorted；readonly |

### 4.4 MemoryState catalog

| Field path | Producer / transition owner | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `memory_state.working_refs` | memory / Observation retrieval | full；可经正式 delta reset | IN | refs belong to validated repository revision；不得承载 payload |
| `memory_state.active_episode_refs` | memory / Learning content | full | IN | refs valid under candidate repository revision；Observation 不得写 |
| `memory_state.autobiographical_index_revision` | memory / Learning content | full | IN | null 或有效 immutable revision ref |
| `memory_state.repository_revision` | memory / Learning content | full | IN | required；final reference-validator check 必须存在且有效 |
| `memory_state.consolidation_cursor` | memory / Learning content | full | IN | null 或 monotonic logical_time；Time 只可产 eligibility signal，不写该字段 |
| `memory_state.retrieval_config` | subject-core config/init | full | IN | exact `RETRIEVAL_V0/false/64` closed object；readonly |
| `memory_state.recent_retrieval_trace` | memory / Observation retrieval | full bounded ring | IN | typed refs；oldest→newest；capacity 64 |
| `memory_state.lifecycle_metadata` | memory / Learning content | full | IN | exact zero-key closed object `{}`；V0 不接受任何 lifecycle key |
| `memory_state.pending_encoding_refs` | memory / Learning content | full | IN | refs-only；retry/rebase 语义由 Learning 层提供，core 只验证 candidate |
| `memory_state.last_retrieval_at` | memory / Observation retrieval | full | IN | null 或不晚于 canonical logical_time 的 logical_time |

Memory payload、embedding、ranking、episodic content 与 RepositoryRevisionHash 不属于 SubjectState schema。

### 4.5 Mood, Affect and Regulation catalog

| Field path | Producer | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `mood.baseline` | affect | full | IN | finite number，`[0, clamp]`；clamp authority 取自冻结 config；core 不计算 baseline |
| `mood.generated_under_profile` | affect | full | IN | exact `FAST_EMA_V0|null` provenance；不得成为 active config authority |
| `mood.last_update` | affect | full | IN | null/logical_time；不得来自 wall clock |
| `affect.active_channels` | affect | full | IN | array of public AffectChannel；内部 FAST phase 不得泄漏 |
| `affect.generated_under_profile` | affect | full | IN | provenance schema only；历史生成 profile 可不同于当前 active profile，core 不重解释 |
| `affect.updated_at` | affect | full | IN | null/logical_time；不晚于 canonical logical_time |
| `affect.active_channels[].channel_id` | affect | full | IN | exact enum `anger|fear|sadness|joy`；不由 LLM 直接写 |
| `affect.active_channels[].intensity` | affect | full | IN | finite `[0,1]` |
| `affect.active_channels[].phase` | affect | full | IN | 仅 `{INACTIVE, ACTIVE, RELEASING}` |
| `affect.active_channels[].started_at` | affect | full | IN | logical_time；不晚于 current logical_time |
| `affect.active_channels[].source_appraisal_ref` | affect | full | IN | required `appraisal` ref；core 只校验 grammar/kind 与 affect producer/path authority，不调用 appraisal capability、不验证 appraisal object 存在或语义 |
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
| `context.focus_refs` | context | full；observation-scoped | IN | typed priority order；exact restore；Observation may replace |
| `context.active_entity_refs` | context | persistent | IN | refs-only |
| `context.environment_refs` | context | full；observation-scoped | IN | typed set-like refs；exact restore；Observation may replace |
| `context.current_observation_ref` | context | full；observation-scoped | IN | observation ref/null；exact restore；Observation may replace |

LLM context window 不是 WorkingContext；restore adapter 不得把 prompt 内容写入这些字段。

### 4.7 MechanismConfig and RuntimeMetadata catalog

| Field path | Authority | Persistence | StateHash | Validation plan |
|---|---|---|---|---|
| `mechanism_config.affect_profile` | subject-core config/init | full | IN | closed `{profile_id:"FAST_EMA_V0",timebase:"legacy_tick"}`；唯一 active config truth |
| `mechanism_config.legacy_reference_defaults` | subject-core config/init | full | IN | exact closed `{tHold:60,alpha:0.06,tau:150,clamp:0.25}`；readonly；不宣称科学真值 |
| `mechanism_config.feature_flags` | subject-core config/init | full | IN | exact zero-key closed `{}`；不允许 producer 私自注册 |
| `mechanism_config.thresholds` | subject-core config/init | full | IN | exact zero-key closed `{}` |
| `runtime_metadata.subject_version` | subject-core | full | IN | exact `subject-v0`；schema_version remains top-level only |
| `runtime_metadata.state_revision` | subject-core | full | IN | integer monotonic；成功 commit 恰好 +1 |
| `runtime_metadata.logical_time` | subject-core | full | IN | monotonic integer tick；只有 TimeTransition 可推进 |
| `runtime_metadata.last_transition_time` | subject-core | full | IN | null/logical_time；canonical time only |
| `runtime_metadata.last_transition_type` | subject-core | full | IN | null/canonical transition enum；统一使用 Transition Contract 拼写 |
| `runtime_metadata.created_at` | subject-core init | full | IN | required logical_time；唯一 creation-time source |
| `runtime_metadata.updated_at` | subject-core | full | IN | required logical_time；不得调用 `Date()` 驱动 |

### 4.8 TraceWindow schema boundary

`trace_window` 是 canonical bounded projection，但不是 authoritative full history。Exact schema=`trace-window-v1`、capacity=64、three-field logical cursor、ordered latest entries；每 commit 一条 multi-domain TraceEntry，before/after StateHash required（freeze §10）。

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
- TimeTransition runtime/transition layer 在 canonical proposal 形成前准入并归一化 raw duration；unknown unit/negative raw value 的失败不创建 transition identity 或 AuditEvent。Subject-core 只接收 `{value: nonnegative safe integer, unit:"tick"}`，以 checked safe-integer addition 派生并验证 `logical_time_after` 后纳入 canonical commit，不解释其他 unit；overflow=`INVALID_LOGICAL_TIME/TIME-ADVANCE-001`，不得 saturate/wrap/round。
- Observation/Learning/CognitionAction 只携带 occurrence logical time，不自行推进 canonical logical time。
- 当 runtime/transition layer 按冻结 contract 把 elapsed=0 分类为 `NO_OP` 时，不创建 snapshot、不加 revision、不写 MutationHistory；subject-core 不自行判定该分类。

### 5.3 Creation and restore distinction

- Creation 是 freeze §4.1 的 pure `materializeSeed`：从 exact closed seed + R0 binding 产生 `SubjectCreationResultV1` 与初始 snapshot，不持久化、不 upsert/overwrite；S0 以 revision 0/logical_time 0 为 acceptance fixture 基线。
- Restore materialize 同一 snapshot 时，revision/StateHash 不变，不生成虚假 transition。
- restore 只 exact materialize complete canonical snapshot。repair/reset/migration 都不是 restore；不得自动执行或授权。

---

## 6. Domain Delta Model

### 6.1 Formal input boundary

Subject Core 不接受裸 `DomainDelta[]` 作为随意 patch API。唯一入口是冻结的 CanonicalTransitionProposal，概念字段为：

```text
schema_version
transition_id
subject_id
transition_type
expected_state_revision
time_input
cause_refs
domain_deltas
external_refs
```

九个 key 全部 required；空 refs 用 `[]`；没有 canonical metadata object。每个 `DomainDeltaV0` 的 required keys 唯一为 `producer`、`domain`、`expected_repository_revision`、`operations`、`provenance_refs`。`expected_repository_revision` 在两个 memory domain 必须等于 current repository revision，其他 domain 必须 null；不存在 opaque delta payload 或 `expected_domain_revision?`。

Commit protocol 是freeze §14.1的exact two-call boundary。第一调用`reserveAndRoute(proposal)`只在NEW/SAME_OPEN时mint trusted noncanonical `ReservedTransitionContinuationV1`。runtime随后durable/read-verify prepared record并mint `PreparedLogicalResultBindingV1`。第二调用`commitReserved(same proposal,continuation,ProducerAuthorizationSetV1,PreparedLogicalResultBindingV1)`才进入semantic validation/candidate/commit；它不得再次reserve或调用WorkflowStore。三种trusted capabilities都不进入proposal/fingerprint/StateHash。Subject-core只比较continuation/binding的ref/subject/transition/type/fingerprint与journal header，并把`workflow` ref绑定进atomic bundle；它看不到/不解释prepared record的MICL/domain fields，也不import/call WorkflowStore/runtime/MICL。

### 6.2 Requested metadata without schema invention

用户要求的概念责任按如下方式满足，但不擅自扩展 envelope：

| Concept | Plan |
|---|---|
| source producer | 使用冻结 `producer` + `domain`；不能由 payload 覆盖 |
| target fields | 由 delta schema + authority catalog **派生**；不信任 producer 自报 `target_fields` |
| expected revision | proposal 的 `expected_state_revision`；memory delta 的 required `expected_repository_revision`；无其他 domain revision 字段 |
| validation metadata | exact `canonical-transition-proposal-v1` + SHA-256/JCS `proposal-fingerprint-v1`；observability metadata excluded |
| provenance | required proposal `cause_refs` / `external_refs` 与 per-delta `provenance_refs`；TraceEntry 由 core 构造，producer 不得伪造 |

若未来确需额外 `target_fields` 或 metadata 字段，必须先修改冻结 contract；coding agent 不得直接添加。

### 6.3 Allowed P2 delta partitions

| Delta concept | Producer | Allowed transition | Allowed target partition |
|---|---|---|---|
| AffectDelta | affect | Observation / Time | `affect` |
| MoodDelta | affect | Observation / Time | `mood` |
| RegulationDelta | regulation | Time / CognitionAction | `regulation` |
| ContextDelta | context | Observation / CognitionAction | exact `/context` replacement；no restore/Time reset special case |
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
- first call: one CanonicalTransitionProposal containing `domain_deltas[]`；second call: the same proposal + trusted `ReservedTransitionContinuationV1` + `ProducerAuthorizationSetV1` + `PreparedLogicalResultBindingV1`；
- versioned schema/authority/hash contracts；
- inverted capabilities：`StateReader`、`TransitionRecordReader`、`TransitionIdentityJournal` durable reservation/attempt、memory-only `ReferenceValidator`、prepared-record verdict-only `PreparedResultValidator`、唯一 `AtomicCommitStore.compareAndCommit`、post-authority `PublishSink`。

### 7.2 Pipeline

1. **First call — admit envelope syntax**：`reserveAndRoute(proposal)`只验证parse/closed shape、ID/enum/pointer/value shape并读取current；失败使用freeze §7.5 AdmissionError。
2. **First call — fingerprint and reserve**：计算proposal fingerprint/ref；`TransitionIdentityJournal.reserveIdentity` durable create-if-absent。OPEN reservation允许attempts为空。Changed-fingerprint routing本身不写conflict；core把已加载的exact revision/logical-time/StateHash/SnapshotHash显式传给幂等`recordReuseConflict`，journal禁止隐式读canonical state。
3. **First call — route or pause**：terminal COMMITTED→`ALREADY_COMMITTED`；terminal NO_OP→original NO_OP route；different fingerprint→`TRANSITION_ID_REUSE` conflict audit；NEW/SAME_OPEN只mint `ReservedTransitionContinuationV1`并返回。不得在第一调用做semantic validation/candidate或调用WorkflowStore。
4. **Runtime-owned prepared step**：runtime以continuation durable create/read-verify `PreparedLogicalResultV1`并mint trusted `PreparedLogicalResultBindingV1`；subject-core不在调用链上。unavailable与invalid分别使用freeze §13.3 exact Admission mapping。
5. **Second call — continue reserved**：`commitReserved`重算proposal ref/fingerprint，验证continuation、producer authorization与prepared binding，重读同一journal header，并重新读取最新current authority。same-header OPEN successor可有更高record version；捕获其exact current version作为CAS input。terminal race路由原结果；missing/corrupt/regressed/mismatched continuation/record/binding=`COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001`，无attempt/audit。第二调用不得再次reserve或调用WorkflowStore。Time zero-delta由runtime `terminalizeReservedNoOp`消费同一continuation/binding、重读latest authority并执行相同revision/time guards，不进入subject-core commit status。
6. **Check expected revisions**：proposal state revision必须等于第二调用重新读取的current；两个memory domain guard必须等于current repository revision；否则exact stale/reference error。
7. **Validate authenticated producer binding and ownership**：用trusted `ProducerAuthorizationSetV1`；readonly path、wrong transition、LLM/provider impersonation按freeze §13.4 precedence拒绝。
8. **Validate aggregation/composition/value syntax**：overlap、duplicate `(producer,domain)`、missing required delta、path-specific type/range全部在apply前确定性检测。
9. **Construct deterministic provisional candidate**：按不重叠partition应用于current的深不可变副本；按freeze §6.2 exact table派生core-owned revision/logical metadata。current snapshot不变，candidate仍非canonical。
10. **Validate final repository references**：candidate构造后、whole-state invariant前，通过倒置`ReferenceValidator`校验exact revision bindings/parent linkage/bound refs；不执行retrieval或domain formula。
11. **Validate whole-state invariants**：验证完整schema、identity/readonly、revision/time、memory partition、ranges/config authority与cross-field invariants。
12. **Build hash/trace dependency bundle**：按freeze §14.4无环顺序构造StateHash、TraceEntry/ref、TraceWindow、SnapshotHash、commit ref、result ref。
13. **Build exact transition-record successor**：OPEN record + prior attempts + one COMMITTED attempt；record version恰好+1；terminal fields单赋值。
14. **Validate complete AtomicCommitBundleV1**：逐项验证freeze §15.2 cross-field equality/checksum；不得只验证domain candidate。
15. **Single atomic commit**：只调用一次`AtomicCommitStore.compareAndCommit(expected_revision,identity_record_version_before,complete_bundle)`；不得调用StateStore/TraceStore分拆写入。
16. **Resolve store outcome**：CONFLICT经reconciliation映射；DEFINITE_NOT_COMMITTED可记录abort；OUTCOME_UNKNOWN必须按transition ID/fingerprint reconcile，不能直接声称ABORTED。
17. **Publish/recover projection**：authority point后驱动PublishSink。publish失败只改变可重建PublishObservation，不修改committed result/checksum，不回滚或重复提交。

步骤1只做入站syntax；步骤4是明确的runtime pause，不是subject-core调用；步骤10在candidate构造后、whole-state invariant前执行repository reference validation，与freeze §13.4的唯一precedence一致；不得提前信任外部ref，也不得把该校验推迟到bundle/CAS后。

### 7.3 Failure rule

在步骤 13 的 atomic commit authority point 成功前且已证明 definite-not-committed 的任何失败：

```text
candidate discarded
current snapshot unchanged
state_revision unchanged
StateHash/SnapshotHash authority unchanged
no successful TraceEntry / MutationHistory append
post-context durable attempt creates AuditEvent；AdmissionError has no fabricated attempt/audit
```

禁止把 audit_event 当作 canonical mutation trace。禁止 post-commit 补写 trace、idempotency authority 或 revision；derived journal/index view只能从authoritative bundle重建。

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
  → repository-reference validation
  → whole-state validation
  → trace/hash/identity bundle
  → ONE canonical commit
```

一个 logical transition 最多产生一个 revision increment；MICL 是多个 transition 的 workflow，不得被 subject-core 合并成一个 global commit。

### 8.2 Revision outcome table

| Outcome | Revision | Snapshot | MutationHistory | Audit |
|---|---:|---|---|---|
| valid committed transition | `+1` exactly | new immutable snapshot | one immutable TraceEntry | no `AuditEventV1`; separate noncanonical observability allowed |
| post-reservation schema/ownership/reference/invariant failure | unchanged | unchanged | none | one rejection `AuditEventV1` |
| Admission/pre-proposal failure | unchanged or no subject context | unchanged/not loaded | none | no `AuditEventV1`; `audit_ref=null` |
| stale expected revision | unchanged | unchanged | none | `STALE_STATE_REVISION` audit |
| runtime/transition 已按冻结 Time contract 判定 elapsed=0 `NO_OP` | unchanged | unchanged；不产生 canonical commit request | none | `NO_OP` 由 runtime/transition 返回；subject-core 不计算 elapsed |
| committed duplicate, same stored `proposal-fingerprint-v1` | unchanged | return authoritative original | none new | status `ALREADY_COMMITTED` |
| previously rejected/aborted, same ID + same fingerprint | retry attempt自身无canonical change；后续按正常validation | unchanged until later successful commit | AuditEvent attempt only | durable identity/attempt journal permits retry across restart |
| same ID, different stored `proposal-fingerprint-v1` | unchanged | unchanged | none | `TRANSITION_ID_REUSE` audit |
| commit CAS conflict | unchanged by this attempt | reload authority | none by this attempt | exact `REJECTED/COMMIT_CONFLICT`；reload/rebuild |
| commit success, publish failure | already `+1` | committed snapshot remains authority | already appended | recover publish; no rollback |

### 8.3 Transition identity storage

`transition_id` 不新增为 SubjectState 顶层字段，也不能只存于 bounded `trace_window`。未来 authoritative commit record 必须与 commit 同界保存：

- transition ID；
- deterministic stored `proposal-fingerprint-v1` over the semantic canonical proposal excluding transition_id and observability；never a raw payload byte/hash surrogate；
- subject ID、before/after revision；
- committed TransitionResult ref；
- TraceEntry/StateHash/SnapshotHash refs；
- commit status required for recovery。

IdempotencyRegistry 只能是该 authoritative record 的同界 index 或可确定性重建 projection。commit✓/index-write✗ 后 retry 必须先 reconciliation，不能重复 AffectDelta 或 revision。

Previously rejected/aborted + same stored `proposal-fingerprint-v1` 可复用同一 ID 重新 validation；changed semantic proposal produces a different stored fingerprint and 必须新 ID，复用旧 ID=`TRANSITION_ID_REUSE`。Durable identity header + append-only attempt journal跨 restart；bounded trace/window/index均非 authority（freeze §14）。

---

## 9. Validation Layers

| Layer | Responsibility | Representative checks | Failure semantics |
|---|---|---|---|
| L1 Schema | envelope、snapshot、delta、value shape/range/canonicalizability、ref syntax/provenance | required/type/default-at-init、finite number、enum、ref shape/linkage、no embedded payload/no undefined/random order | concrete schema/range code；no candidate authority |
| L2 Conflict and ownership | overlap/duplicate/missing delta、producer、transition owner、field partition、readonly/direct mutation | affect→affect/mood only；Observation vs Learning memory partition；LLM no writer | `DOMAIN_DELTA_CONFLICT` / `UNAUTHORIZED_PRODUCER` / `INVALID_TRANSITION_OWNER` |
| L3 Final reference integrity | candidate 构造后的 infrastructure reference validity | candidate repository revision exists/valid；necessary refs belong to immutable revision | `INVALID_MEMORY_REVISION` / `INVALID_MEMORY_REFERENCE`；no mutation |
| L4 Cross-field invariant | full candidate consistency | identity unchanged；revision/time monotonic；config single authority；all top-level fields present | `INVARIANT_VIOLATION` + stable Requirement ID；no mutation |
| L5 Commit | idempotency、CAS、trace/hash bundle、atomic persistence/publish recovery | duplicate/reuse；revision precondition；trace prepared；authoritative record complete | status/rejection；never partial commit |

执行顺序必须满足 freeze §13.4：per-delta schema/range → conflict/ownership → candidate → final repository reference integrity → whole-state invariants → atomic commit。Layer 编号是职责分区，不允许把 ref 校验提前到 candidate 前、推迟到 whole-state 后或跳过。

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

L5 final bundle validation 另外验证：TraceEntry 的 before/after revision/hash、transition identity、cause refs、result linkage 与 final snapshot 一致；trace cursor/ref、StateHash/SnapshotHash 与 authoritative transition record 完整一致。before/after StateHash均 required。

---

## 10. Trace Model

### 10.1 Four distinct objects

| Object | Authority | Mutability | Trigger |
|---|---|---|---|
| MutationHistory | authoritative logical history | append-only | every successful canonical commit |
| TraceEntry | one canonical mutation record | immutable | built before the matching commit |
| SubjectState.trace_window | bounded recent projection | core-managed rolling | updated in the same commit |
| AuditEvent | external audit infrastructure | append-only policy outside canonical state | failed/rejected/unauthorized attempt |

Authoritative MutationHistory 是 `AtomicCommitStore` committed journal 的组成部分。`TraceHistoryView` 只是可重建只读 projection；`TransitionIdentityJournal`/Audit infrastructure 只保存 non-commit outcomes。trace_window eviction 不是 history deletion。

### 10.2 TraceEntry planned content

每次成功 commit 恰好一个 immutable multi-domain `TraceEntryV1`，包含 freeze §10 的 exact required keys；proposal/memory refs用显式 null；before/after StateHash必填；outcome=`COMMITTED`。

P2.1 不保存整份 before/after snapshot 到每条 trace；使用 sorted path summaries、refs 与 required StateHash fields。atomic bundle保留StateHash/SnapshotHash/complete snapshot。

### 10.3 Atomic trace sequence

1. candidate logical state确定；
2. StateHash before/after确定为 atomic-bundle data；
3. TraceEntry 使用 revision/cause/producer构造并验证，包含 required before/after StateHash；
4. AtomicCommitBundle 的 trace/history component preparation 与 validation 满足；
5. trace_window/cursor projection更新；
6. snapshot + revision + TraceEntry/history linkage + cursor/hash refs 同一 commit。

Atomic trace/history component preparation失败时none committed；派生TraceHistoryView不可用不得丢authoritative TraceEntry，也不得成为第二写入口。post-context失败proposal只产生AuditEvent，不得伪造成outcome=`committed`。

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

StateHash uses SHA-256/JCS versioned projection，覆盖顶层 `schema_version`、identity、traits_seed、MemoryState canonical refs/config/metadata、beliefs、relationships、mood、affect、regulation、完整 current canonical context、mechanism_config 与 runtime_metadata；排除 entire trace_window。Golden vectors见freeze §9。

### 11.3 Canonicalization requirements

Contract freeze §8–§9 已固定：

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
- `StateReader` / `TransitionRecordReader` / `TransitionIdentityJournal` / `ReferenceValidator` / verdict-only `PreparedResultValidator` / unique `AtomicCommitStore` / `PublishSink` ports；
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
| atomic trace/history component preparation失败 | none committed；派生TraceHistoryView不可用不得丢authoritative history或触发第二次commit |
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
10. 任一失败返回 fail-closed result；仅 post-reservation canonical attempt 附 `AuditEventV1` evidence，Admission/pre-proposal failure 的 audit ref 为 null；不自动 repair/reset/migrate。

### 12.4 Transient Context rule

Restore exact materializes every persisted canonical field including all Context fields；same revision/hash，no transition/trace/default/reset。任何 corruption/unknown version/reference mismatch fail closed（freeze §11）。

---

## 13. Error and Result Model

### 13.1 Frozen core-relevant codes/statuses

| Code/status | Meaning | Canonical mutation? |
|---|---|---|
| `INVALID_SCHEMA` | envelope/state/delta schema无效 | no |
| `INVALID_VALUE_RANGE` | canonical value/range无效 | no |
| `STALE_STATE_REVISION` | expected revision与current不一致 | no |
| `INVALID_LOGICAL_TIME` / `INVALID_TIMEBASE` | raw Time admission failure由 owning runtime 在 proposal 前返回且无 identity/audit；normalized canonical Time 的 checked-add overflow 由 core 返回 `INVALID_LOGICAL_TIME` | no |
| `INVALID_MEMORY_REVISION` | candidate引用不存在/无效 repository revision | no |
| `INVALID_MEMORY_REFERENCE` | valid repository revision内具体ref不存在/不属于该revision | no |
| `FORBIDDEN_DIRECT_MUTATION` | 绕过 proposal/producer/core path | no |
| `UNKNOWN_SUBJECT` | subject不存在/identity mismatch | no |
| `PROPOSAL_REJECTED` | proposal未通过已冻结 validation | no |
| `DOMAIN_DELTA_CONFLICT` | overlap或duplicate producer/domain delta | no |
| `MISSING_REQUIRED_DELTA` | transition所需 delta缺失 | no |
| `UNAUTHORIZED_PRODUCER` | producer无权写目标 | no |
| `INVALID_TRANSITION_COMPOSITION` | transition composition不合法 | no |
| `INVALID_TRANSITION_OWNER` | transition无权写该 canonical field | no |
| `INVARIANT_VIOLATION` | fields individually valid but cross-field rule fails | no |
| `COMMIT_CONFLICT` | authoritative commit precondition/CAS conflict | no by this attempt |
| `TRANSITION_ID_REUSE` | same ID + different stored `proposal-fingerprint-v1`；never raw payload comparison | no |
| `ALREADY_COMMITTED` | same committed ID + same stored `proposal-fingerprint-v1` 的 idempotent result status | no new mutation |
| `REBASE_REQUIRED` | only Learning logical status after core `REJECTED/STALE_STATE_REVISION`; unsafe rebuild returns `error_code=STALE_STATE_REVISION, reason=REBASE-STALE-001`；not a core code | no |

Exact discriminated commit/already/no-op/canonical-error/admission envelopes, restore integrity codes and primary reason mapping are freeze §§7.3–7.5/13；本计划不另建第二套 result schema。

### 13.2 Requested names that are not frozen codes

| Requested concept | Planning coverage | Wire-level rule |
|---|---|---|
| `INVALID_REVISION` | malformed revision与stale revision都覆盖 | malformed映射 schema/range；mismatch用 `STALE_STATE_REVISION`；不得新增同义 code |
| `INVALID_MEMORY_REFERENCE` | validated repository revision内具体ref不存在/不属于该revision | frozen canonical code；与 `INVALID_MEMORY_REVISION` 区分 |
| `INVALID_DELTA` | delta shape/range/overlap/missing/owner失败全部覆盖 | 只是内部 umbrella；对外使用具体 frozen code |
| `INVARIANT_VIOLATION` | individual fields合法但cross-field rule失败 | frozen canonical code；reason=stable Requirement ID |

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

| A | Frozen leaf IDs | P2.1 slice | Oracle | Evidence |
|---|---|---|---|---|
| A1 | `HASH-DET-001`, `HASH-SER-001`, `TR-DET-001` | same state/proposal→same candidate/hash/trace semantics | Exact Equality + Hash Equality | state-hash-manifest.json + transition-trace-manifest.json |
| A2 | `MEM-REV-001`, `MEM-OWN-001`, `MEM-ORPHAN-001`, `SS-RESTORE-001` | R999 fail closed；payload不进state；orphan noncanonical；restore same ref | Reference Integrity + Expected Failure Code | repository-revision-manifest.json + state-hash-manifest.json |
| A6 | `SS-AUTH-001`, `LLM-AUTH-001` | fake revision/affect/memory/trace/direct mutation reject | Forbidden Mutation + Expected Failure Code | failure-summary.json |
| A7 | `TRACE-ATOMIC-001`, `TRACE-CONTENT-001`, `TRACE-HISTORY-001`, `TRACE-REJECT-001` | every commit has atomic trace；window eviction不丢history；failure audit only | Required Trace + Reference Integrity | transition-trace-manifest.json + failure-summary.json |
| A10 | `FAIL-PRECOMMIT-001`, `FAIL-CAS-001`, `FAIL-PUBLISH-001`, `TRACE-REJECT-001` | all core failure/recovery cases follow exact status and keep authority correct | Expected Failure Code + Revision Delta + Workflow Status | failure-summary.json |
| A11 | `TR-ATOMIC-001`, `TR-CONFLICT-001`, `TRACE-ATOMIC-001` | invalid one-of-N delta→none committed | Forbidden Mutation + Revision Delta | failure-summary.json |
| A12 | `IDEM-COMMIT-001`, `IDEM-REUSE-001`, `IDEM-RETRY-001`, `IDEM-RECOVERY-001` | same/different stored `proposal-fingerprint-v1` duplicate semantics；crash reconciliation | Revision Delta + Expected Failure Code + Workflow Status | fixture-results.json + failure-summary.json |
| A13 | `SS-REVISION-001`, `FAIL-PRECOMMIT-001` | core仅证明stale no-mutation guard | Forbidden Mutation + Revision Delta + Expected Failure Code | failure-summary.json；`REBASE-STALE-001`属后续phase |

P2.1 还必须支持 P1.5 §29 Session Restore、§30 Crash Window、§31 StateHash/Serialization 的 core-owned normative clauses。正式全量 conformance仍需六类 evidence：`conformance-report.json`、`fixture-results.json`、`state-hash-manifest.json`、`transition-trace-manifest.json`、`repository-revision-manifest.json`、`failure-summary.json`。

---

## 15. Conceptual Fixture Plan

以下 `SC-*` 仅是 P2.1 本地 conceptual fixture overview，不是 Requirement IDs。本表的 exact 24-case expansion、Requirement IDs 与 evidence columns 已由 `p2-1-contract-freeze.md` §17.2 冻结（adds SC-003B/006B/006C/008B/011B and splits SC-004A/B/C）。本任务不创建或执行测试。

| Fixture | Setup / stimulus | Expected | Acceptance/oracle |
|---|---|---|---|
| SC-001 Valid delta commit and deterministic replay | two isolated identical current snapshots + same authorized non-overlapping delta bundle | both runs exactly revision +1；same immutable next-state canonical bytes/StateHash/trace semantic content/result；each old snapshot unchanged | A1/A7 core slice；Exact Equality + Hash Equality + Required Trace |
| SC-002A Invalid producer | proposal reaches core but declares an unlisted/unauthorized producer identity for its target field | exact `UNAUTHORIZED_PRODUCER`；none committed；audit only | A6/A10；Forbidden Mutation + Expected Failure Code + Revision Delta |
| SC-002B Invalid transition owner | otherwise valid producer 在错误 transition 写受限 canonical field | exact `INVALID_TRANSITION_OWNER`；none committed；audit only | A6/A10；Forbidden Mutation + Expected Failure Code + Revision Delta |
| SC-002C Direct canonical-write bypass | attempt bypasses CanonicalTransitionProposal/subject-core commit boundary to write state, revision, trace, or memory reference | exact `FORBIDDEN_DIRECT_MUTATION`；none committed；audit only | A6/A10；Forbidden Mutation + Expected Failure Code + Revision Delta |
| SC-003 Stale revision | expected N，authority已是N+1 | `STALE_STATE_REVISION`；state/revision/hash/trace unchanged | A10 + A13 guard only；Expected Failure Code + Revision Delta |
| SC-004 Duplicate transition | case A same ID/same stored `proposal-fingerprint-v1` after commit；case B same ID/different stored fingerprint；case C prior rejected/aborted with unchanged stored fingerprint retry | A=`ALREADY_COMMITTED` + original result；B=`TRANSITION_ID_REUSE`；C may retry through normal validation；A/B no increment | A12；Revision Delta + Workflow Status + Expected Failure Code |
| SC-005 Atomic failure | multi-domain bundle中一个 ContextDelta invalid | exact frozen failure code；Affect/Mood/Context/Memory retrieval metadata全部不变；no trace append | A11/A10；Forbidden Mutation + Expected Failure Code + Revision Delta |
| SC-006 Invalid memory revision | candidate引用R999；validator capability reports不存在/损坏 | exact `INVALID_MEMORY_REVISION`；none committed；core无memory import | A2/A10/Crash C2；Reference Integrity + Expected Failure Code + Revision Delta |
| SC-007 Deterministic hash | semantic-equivalent state with controlled key/wall-clock/log variations | canonical bytes/StateHash相同；excluded values无影响；SnapshotHash按cursor变化规则 | A1 + §31；Hash Equality |
| SC-008 Restore validation | valid roundtrip + corrupt schema/hash/revision/repo ref variants | valid materialize same revision/hash；每个corrupt variant fail closed，无repair | A2 + §29/§31；Hash Equality + Reference Integrity + Expected Failure Code |
| SC-009 Readonly field attack | a valid proposal uses the classified readonly `/identity` path with an exact IdentityV0 value | exact `FORBIDDEN_DIRECT_MUTATION` / reason `SS-AUTH-001`；none committed；audit only | A6/A10；Forbidden Mutation + Expected Failure Code + Revision Delta |
| SC-010 Delta overlap | two deltas触碰同field或duplicate producer/domain | `DOMAIN_DELTA_CONFLICT`；order变化不改变结果 | A1/A11；Exact Equality + Revision Delta |
| SC-011 Trace crash window | atomic bundle trace/history component preparation unavailable | canonical commit不发生；revision delta 0；authoritative trace不丢；派生TraceHistoryView不是writer | A7/A10/Crash C4；Required Trace + Revision Delta |
| SC-012 Publish recovery | atomic commit成功后publish失败，再retry/recover | original commit exactly `+1` and has required trace/reference bundle；recovery retry `+0`；committed revision保持authority，无rollback/duplicate，原result可恢复 | A10/A12/Crash C3；Revision Delta + Required Trace + Reference Integrity |
| SC-013 Idempotency index loss | commit record成功，derived index缺失，same ID retry | 从authoritative record reconciliation；不重复AffectDelta/revision | A12；Revision Delta |
| SC-014A Canonical wall-clock injection | persisted canonical field expects logical_time but receives wall-clock string | exact `INVALID_SCHEMA`；fail closed；revision delta 0 | A1/A10/§31；Expected Failure Code + Revision Delta |
| SC-014B Noncanonical observability variation | identical canonical state with different external logging/wall-clock observability metadata | canonical bytes/StateHash/result semantic content equal；external metadata not stored in canonical projection | A1/§31；Hash Equality |

每个 fixture 在实施时必须关联 frozen requirement、oracle、before/after revision/hash、trace/audit expectation 与证据文件；不能只断言“抛错了”。

---

## 16. Implementation Phases

### Entry Gate — Contract Freeze（非 coding phase）— COMPLETE

**输入：** 四份冻结 P1/P1.5 文档、P2 plan §15、本计划 §1.2。

**输出：** `docs/implementation/p2-1-contract-freeze.md`：49 leaf requirements、65 fixtures、executable schema、error/status、JCS/SHA-256 vectors、trace/restore/identity/atomic-port decisions。

**验收：** **PASS**；G1–G11 CLOSED，无 applicable unresolved MUST ambiguity；independent red-team R1–R12 PASS。

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

**输出：** immutable TraceEntry builder、MutationHistory linkage、trace_window projection、AuditEvent separation、AtomicCommitBundle trace/history component builder；不创建TraceStore writer。

**验收：** TraceEntry/window/history builder 与 precommit bundle validation 可被 future fixtures 验证；在 Phase 6 integrated publish 启用后，每个成功 canonical commit 必须有同界 trace，failure 无 mutation trace，window eviction 保留 authoritative history；SC-011通过。

**禁止：** canonical persistence/publish、post-commit trace、把AuditEvent混进MutationHistory、另建TraceStore writer或丢trace仍提交。

### Phase 6 — Hash, Persistence and Restore

**输入：** frozen canonicalization/hash ADR、golden vectors、trace cursor contract、`AtomicCommitStore` / `StateReader` / `TransitionRecordReader` / restore ports。

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
| R7 hash 是否包含随机字段？ | **PASS** | JCS/SHA-256 projection/golden vectors frozen；wall-clock/random/log/repo payload/trace content排除。 |
| R8 restore 是否偷偷修复？ | **PASS** | exact full snapshot materialization；same hash/revision；no reset/default/migration。 |
| R9 是否偷偷修改P1 error/schema？ | **PASS** | 非冻结用户术语只作umbrella/mapping；不新增wire code/field/ID。 |
| R10 transition identity是否依赖bounded trace？ | **PASS** | durable identity/attempt journal + atomic committed record；trace_window/index均非ledger。 |
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

§1.2 G1–G11 已关闭；当前唯一开工缺口是 **P2.1 implementation 的单独显式授权**。本文与 contract freeze 均不构成该授权。
