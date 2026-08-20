# P2 Minimal Runtime Implementation Plan

**任务状态：** P2 Runtime Implementation Planning — COMPLETE。

**实施状态：** NOT STARTED。本文是工程实施计划，不是 P2 启动授权，不包含实现、测试执行、依赖安装、实验或旧仓库迁移。

**规划基线：** `b59ed790377d2a8877baf354cd6ee975a6578ce5`

**目标：** 把已经冻结的 SubjectState V0、Canonical Transition Contracts、MICL Design 与 P1.5 Engineering Acceptance Contract 转换成工程团队可逐阶段执行、可由独立 reviewer 验收的 P2 Minimal Runtime Implementation 计划。

---

## 1. Final Verdict

| 对象 | Verdict | 含义 |
|---|---|---|
| 本规划产物 | **PASS** | P2 的技术栈、目录边界、范围、阶段、接口职责、验收映射、工作流、风险与完成标准均已定义。 |
| P2 coding-agent execution readiness | **BLOCKED PENDING ENTRY GATE** | §15 的 MUST 追踪/枚举冲突未封口，当前计划不能直接交给 coding agent 开工。 |
| P2 implementation | **NOT STARTED / CONDITIONAL** | 本文完成不等于实施开始；仍需显式 P2 授权、P1.5 contract PASS，并完成 §15 的 entry-gate 封口。 |
| P1 架构 | **UNCHANGED** | 本文只安排如何实现 P1，不重新设计、删减或放宽任何 P1/P1.5 约束。 |

### 1.1 权威来源与优先级

P2 实施必须逐字服从以下冻结文档：

1. `docs/architecture/subjectstate-v0-spec.md`
2. `docs/architecture/transition-contracts.md`
3. `docs/architecture/micl-design.md`
4. `docs/evaluation/p1-5-engineering-acceptance-contract.md`

`ARCHITECTURE.md`、`ROADMAP.md`、`MIGRATION_MAP.md`、`RESEARCH_STATE.md` 提供宪法、阶段与迁移边界。若实施者发现文档间存在真实冲突，不得自行选择方便的版本；必须停止相关 slice，提交 docs-only clarification，由 contract owner 封口后再继续。

### 1.2 P2 的准确定位

P2 要交付的是一个最小、确定性、可持久、可恢复、可审计的内部连续性运行时：

```text
SubjectState
  → TimeTransition
  → Observation / Perception
  → Memory Retrieval
  → Subjective Interpretation
  → Structured Appraisal
  → Affect / Mood Update
  → InternalExperience
  → LearningTransition / Experience Encoding
  → next SubjectState
```

它不是 AGI、autonomous agent、world simulator、behavior system、多模态角色、训练框架或 emotion science experiment。

---

## 2. Constitutional Implementation Guardrails

以下规则不是建议，而是 P2 的不可豁免约束：

1. **Single canonical SubjectState。** SubjectState 是唯一 canonical subject authority，采用 immutable snapshot；`state_revision` 单调递增。
2. **Producer != Mutator。** Domain 模块只计算 proposal/delta；`subject-core` 是唯一 canonical mutator。
3. **One logical transition = one atomic canonical commit。** 一个 transition 可聚合多个互不重叠的 domain delta，但最多只推进一次 revision；任一 delta 无效则全部拒绝。
4. **MICL != one commit。** MICL 是 Time、Observation、Learning 三个 logical transition 的可恢复 workflow，不是全局 ACID 事务。
5. **MemoryState belongs to the subject。** MemoryState 位于 SubjectState；MemoryRepository 只是 versioned infrastructure，payload/embedding/index payload 不进入 SubjectState。
6. **Retrieval precedes Appraisal；Appraisal precedes Affect。** Observation 不得预包装 emotion/appraisal truth，也不得直接连接 affect channel。
7. **Logical time is canonical。** wall clock 只能作 observability metadata，不驱动 transition、不进入 StateHash。
8. **LLM is a bounded proposal provider。** LLM 不拥有 state，不写 memory/revision/trace，不直接决定 affect。
9. **Slow layers remain read-only in V0。** identity、traits、beliefs、relationships 不因 P2 快事件发生漂移。
10. **Failure is fail-closed per transition。** 失败 proposal 只能产生 audit event；不得形成部分 canonical mutation 或伪造 successful TraceEntry。
11. **Successful trace is atomic with mutation。** state、revision、TraceEntry、trace cursor/hash refs 必须处于同一 canonical commit boundary。
12. **No architecture-by-convenience。** 实现困难不能成为修改 ownership、顺序、failure code、revision 或 recovery 语义的理由。

---

## 3. Technical Stack Decision

### 3.1 TypeScript vs Python

| 维度 | TypeScript | Python | P2 判断 |
|---|---|---|---|
| Runtime architecture | strict typing、readonly model、discriminated result/failure contracts、Node 异步 I/O 适合长期 runtime；仍需运行时 schema validation | dataclass/Pydantic 表达直观，但动态语言必须额外维持静态边界与一致的序列化纪律 | **TypeScript 更适合 canonical runtime** |
| Future productization | runtime、API、Web/desktop 产品可共享 contract，减少 DTO 漂移 | 后端成熟，但未来产品层大概率形成 TS/Python 双语言边界 | **TypeScript 优** |
| API/service integration | Node 对 JSON API、streaming、provider SDK、service composition 支持直接 | FastAPI 与 AI service 生态同样成熟 | 接近平手，P2 偏 TypeScript |
| AI ecosystem | 主流 LLM SDK 足够；训练与本地科学计算较弱 | 训练、数值分析、本地模型、notebook 生态明显更强 | Python 优势不对应 P2 核心任务 |
| Evaluation tooling | fixed fixture、exact/hash oracle、property testing、replay 足以覆盖 P1.5 | pytest/Hypothesis/pandas 更适合科学与数据分析 | P1.5 是工程 conformance，TypeScript 足够 |
| Developer experience | 单一 monorepo、IDE 重构、跨包类型检查、前后端 contract 复用更直接 | 原型快，但 typing、环境与产品 contract 可能分裂 | **TypeScript 优** |
| Maintainability | runtime/API/product 共用语言；较容易自动检查 import DAG | 双栈会增加 canonical schema、hash、failure code 的一致性成本 | **TypeScript 优** |

### 3.2 推荐栈

**推荐：TypeScript canonical runtime on a pinned Node.js LTS。** 选择依据是 CharacterOS-Next 属于 persistent subject runtime engine，而不是 model training framework。

未来 P2.0 在获得实施授权后冻结：

- 一个当时仍受支持的 Node.js LTS major；版本写入版本文件与 CI matrix。
- TypeScript strict mode + ESM；禁止用 `any` 绕过 canonical boundary。
- pnpm workspace monorepo；实际版本必须在 P2.0 一次性 pin，并提交 lockfile。
- schema-first runtime validation；canonical boundary 不能只依赖 TypeScript 编译期类型。
- 一套 versioned canonicalization rules 与底层 hash algorithm，但分别冻结 full persistence、StateHash、SnapshotHash、RepositoryRevisionHash projections；numeric normalization 和各自 golden vectors 在 P2.0 固定。
- Vitest 用于 unit/integration/conformance；版本在 P2.0 锁定，不建立第二套 Python oracle。
- Node 标准 crypto/filesystem 能力优先；P2 不引入数据库、消息队列、Web framework、vector DB 或 live LLM SDK 作为运行时必需依赖。

### 3.3 Python 的允许位置

Python 可在未来 P4 作为**非权威离线分析工具**读取 conformance/evaluation artifacts；它不得成为：

- P2 canonical SubjectState mutator；
- P2 StateHash oracle；
- MICL 必需运行时；
- 第二套 transition semantics；
- 绕过 acceptance contract 的“快速实现”。

---

## 4. Repository Structure Plan

### 4.1 目录决策

保留 P1 已冻结的包拓扑，不为目录美观建立平行 ownership。用户要求的 `transition` 与 `micl` 落在现有 `packages/runtime` 内；conformance 落在已有顶层 `evals/`。未来 P2 目标结构如下：

```text
packages/
  subject-core/
    state/
    commit/
    revision/
    trace/
    serialization/
    hash/
    persistence-ports/

  memory/
    repository/
    retrieval/
    encoding/
    episodic-record/
    deltas/

  appraisal/
    projection/
    interpretation/
    appraisal/
    proposal-validation/

  affect/
    appraisal-bridge/
    fast-ema-reference/
    deltas/

  regulation/
    time-reference-producer/

  runtime/
    perception/
    context/
      observation-delta-producer/
    transitions/
      time/
      observation/
      learning/
    micl/
      workflow/
      checkpoint/
      resume/
    composition-ports/

  belief/                 # 保留只读骨架；P2 不实现更新
  personality/            # 保留只读骨架；P2 不实现漂移
  relationship/           # 保留只读骨架；P2 不实现更新
  behavior/               # 保留骨架；P2 不实现

product/
  sandbox/                # P2 最小 composition root；不是产品或部署

evals/
  conformance/
    fixtures/
    oracles/
    requirements/
    adversarial/
    evidence-schemas/
```

目录名是规划，不在本次任务中创建。P2.0 只能在显式授权后初始化这些路径。

### 4.2 模块责任

| 模块 | 唯一责任 | 明确不负责 |
|---|---|---|
| `subject-core` | SubjectState runtime model、generic validation、field authority、delta conflict detection、candidate construction、revision、atomic commit、TraceEntry、canonical serialization/hash、restore validation、immutable snapshot publish | 不调用/导入 memory、affect、appraisal、regulation、runtime、MICL 或 LLM provider；不编排 stages |
| `memory` | MemoryRepository abstraction、immutable versioned in-memory reference repository、deterministic retrieval、EpisodicMemoryRecord encoding、Memory delta production | 不拥有 SubjectState；不 canonical commit；不把 payload 塞进 SubjectState |
| `appraisal` | controlled projection、Interpretation/Appraisal provider ports、proposal schema/evidence/range validation | 不写 canonical state；不直接产 AffectDelta；不把 emotion label 当 appraisal |
| `affect` | Appraisal→Affect engineering bridge、FAST+EMA reference persistence、AffectDelta + MoodDelta production | 不宣称科学情绪理论；不直接 commit；不拥有 active config authority |
| `regulation` | TimeTransition 所需的最小 deterministic RegulationDelta producer | 不实现完整 homeostasis，不扩张调节模型 |
| `runtime/context` | producer identity=`context`；根据 Perception/Interpretation 与 current WorkingContext 生成 Observation 可写的 ContextDelta | 不 commit；不写 memory/affect/slow layers；不隐式取得 TimeTransition reset 权限 |
| `runtime/transitions` | 编排 Time/Observation/Learning，调用 producers，聚合 domain deltas，构造一个 CanonicalTransitionProposal 后调用 subject-core | 不取得 domain ownership；不做 domain-by-domain commit；不实现 CognitionAction/Behavior |
| `runtime/micl` | MICL request/result、stage ordering、workflow ledger、checkpoint/resume/idempotency、partial completion、InternalExperience handoff | 不把三次 transition 合成一个 commit；不回滚已提交 stage；不进入 Action |
| `product/sandbox` | 装配 reference adapters、fixed providers 与 MICL，提供最小本地 runnable composition | 不部署、不提供产品 UI/API、不成为第二个状态权威 |
| `evals/conformance` | A1–A13 + P1.5 §§25–31 cross-cutting fixtures/oracles、negative cases、requirement matrix、evidence artifact schema/runner | 不承载 scientific benchmark；production 包不得依赖它 |

### 4.3 Import DAG

```text
product/sandbox → runtime

runtime → memory + appraisal + affect + regulation + subject-core
appraisal → memory public retrieval contracts + subject-core readonly contracts
memory / affect / regulation → subject-core readonly contracts

evals/conformance → public package APIs + product/sandbox test composition
```

硬性 import rules：

- `subject-core` 不得 import 任何 domain package、runtime/MICL 或 provider SDK。
- Domain package 可依赖 subject-core 的 readonly contracts/projections，不得依赖 runtime。
- `appraisal` 可依赖 `memory` 的 public RetrievalResult/evidence contracts；不得读取 repository internals。
- Runtime 可依赖 subject-core 与 domain public ports；domain 不得反向依赖 runtime。
- `product/sandbox` 是 concrete wiring 的唯一 P2 composition root。
- Production packages 永不依赖 `evals/conformance`。
- P2.0 必须加入自动 import-boundary check；发现反向边即 phase gate FAIL。

---

## 5. P2 Scope Definition

### 5.1 必须实现

1. **SubjectState runtime**：冻结 V0 schema、immutable snapshot、validation、serialization、persist/restore boundary。
2. **Canonical commit engine**：multi-domain proposal、authority/conflict/precondition validation、all-or-nothing commit、revision/trace/hash 同边界。
3. **MemoryRepository abstraction + mock/in-memory reference implementation**：immutable revisions、reference validation、prepare/orphan semantics、deterministic export/import for restore fixtures。
4. **Retrieval abstraction**：semantic/context/recency/salience/entity/relationship evidence；fixed config 下 deterministic；empty retrieval 合法；affect congruence 关闭。
5. **TimeTransition**：显式 Duration、logical time normalization、minimal regulation/affect/mood evolution、zero elapsed NO_OP。
6. **ObservationTransition**：text observation、Perception、Retrieval、Interpretation、Appraisal、Affect/Mood、Context、retrieval metadata 的单次原子提交。
7. **Interpretation interface**：proposal port、controlled projection、evidence-ref validation；fixed provider 可用于 conformance。
8. **Appraisal interface**：冻结 AppraisalV0 六字段、schema/range/evidence validation；Appraisal 与 Affect 分离。
9. **Reference affect implementation**：FAST+EMA-derived persistence + deterministic Appraisal bridge，只作为 engineering reference/baseline。
10. **LearningTransition**：InternalExperience、EpisodicMemoryRecord、repository prepare、MemoryContentDelta、stale rebase safety。
11. **MICL workflow**：run/resume、stage checkpoint、partial completion、idempotency、failure recovery、session restore。
12. **Conformance integration**：A1–A13 全部 MUST、P1.5 §§25–31 normative clauses、fixed proposal fixtures、evidence artifacts。

第 5、11、12 项虽未全部出现在用户的十项简表中，但由冻结 MICL/P1.5 contract 强制要求，属于完成这十项所必需的工程能力，不是范围扩张。

### 5.2 明确不做

- personality drift
- relationship update
- belief update
- behavior / policy / CognitionAction runtime
- action executor
- tools / tool calling
- world model / world simulator
- multimodal perception
- vector database optimization or vendor binding
- real deployment、distributed system、microservices、queue/outbox
- production API/UI
- model training、RL、learned plasticity、new emotion dynamics
- live LLM provider integration as a required P2 dependency
- emotion science validation、benchmark superiority claim、DEV experiment
- direct migration/copy of the old CharacterOS runtime

P2 保留 CognitionActionTransition 的 P1 contract，不删除、不重写；只是本阶段不实现。

---

## 6. Canonical Runtime Execution Plan

### 6.1 SubjectState V0 implementation checklist

P2 不重新裁剪 SubjectState。实现与 restore 必须保留以下 canonical 顶层字段：`schema_version`、`identity`、`traits_seed`、`memory_state`、`beliefs`、`relationships`、`mood`、`affect`、`regulation`、`context`、`mechanism_config`、`trace_window`、`runtime_metadata`。

额外单一权威与持久化规则：

- `schema_version` 只允许位于顶层；不得在 `runtime_metadata` 建立第二来源。
- `runtime_metadata.created_at` 是 subject creation time 唯一权威；Identity 不重复保存。
- `mechanism_config.affect_profile` 是 active affect config 唯一权威；Mood/Affect 的 `generated_under_profile` 只是 provenance。
- canonical affect public phase 保持 `{INACTIVE, ACTIVE, RELEASING}`；FAST internal phases 不得泄漏成永久 schema。
- Identity/Traits/Beliefs/Relationships 在 P2 readonly；`mechanism_config` 是配置，不是 learned plasticity state。
- `scene`、`task`、`active_entity_refs` 属 persistent Context；`focus_refs`、`current_observation_ref`、`environment_refs` 属 transient Context。restore adapter 不得静默改写这些 canonical fields；reset 语义须先完成 §15 ownership 封口。
- `TraceEntry` immutable、`MutationHistory` append-only、`trace_window` rolling/bounded、AuditStore/TraceStore 保存完整历史；window eviction 不等于删除历史。

### 6.2 Subject-core commit sequence

未来 commit engine 的概念顺序固定为：

1. 读取 current immutable snapshot 与 current `state_revision`。
2. 校验 transition envelope、payload identity 与 idempotency key。
3. 校验 `expected_state_revision`；Learning 同时校验 repository base/revision。
4. 逐 delta 做 schema/range validation。
5. 校验 producer、transition owner 与 canonical field authority。
6. 在 apply 前检测 overlapping field / duplicate domain delta。
7. 按不重叠 partition 构造 candidate next state；顺序不得依赖 Promise race、object key order 或 registration order。
8. 校验 whole-state invariants 与 referenced MemoryRepository revision。
9. 构造 next revision、immutable TraceEntry、trace window/cursor、三类 hash refs 与确定性的 TransitionResult content。
10. 将 state + revision + trace + cursor/hash refs 作为一个 canonical commit；committed transition ID、payload hash 与 result ref 必须可从同一 authoritative record 恢复。
11. 发布/返回 TransitionResult。若另设 IdempotencyRegistry，它只能是上述 authoritative record 的同界 index 或可确定性重建的 projection，禁止 commit 后再孤立补写。重复 committed ID 返回原结果，不再次推进 revision。

任何一步失败：candidate 丢弃，canonical snapshot 不变，只写外部 audit event。post-commit correction 必须是一个新的 corrective transition，禁止原地 rollback。

### 6.3 Memory ownership partition

| 子域 | 字段 | Transition owner | Canonical mutator |
|---|---|---|---|
| retrieval metadata | `working_refs`、`recent_retrieval_trace`、`last_retrieval_at` | ObservationTransition | subject-core |
| content/encoding/consolidation | `active_episode_refs`、`repository_revision`、`autobiographical_index_revision`、`consolidation_cursor`、`pending_encoding_refs`、`lifecycle_metadata` | LearningTransition | subject-core |
| config authority | `retrieval_config` | init/config only | subject-core |

TimeTransition 的 memory maintenance eligibility 只是 derived signal，不得写 MemoryState。Observation 不得 encode episodic content。Learning 不得回写 retrieval metadata。DOUBLE MEMORY WRITE FORBIDDEN。

### 6.4 Reference persistence strategy

P2 采用足以满足本地 conformance 的最小策略，不引入生产数据库：

- SubjectState persistence 通过 subject-core 定义的 store port；sandbox 提供 deterministic local reference adapter，以证明跨 process/session restore。
- MemoryRepository P2 concrete adapter 以 in-memory immutable revision model 为主，并提供确定性 snapshot export/import，使新 repository instance 能模拟真实 session boundary。
- Learning 先 prepare immutable repository revision，再由 subject-core 校验引用后提交 SubjectState。
- repository prepare 成功、canonical commit 失败时，prepared revision 成为 orphan/pending；SubjectState 继续指旧 revision。
- retry 必须复用同一 prepared revision；stale 时 reload + revalidate + rebase/rebuild，不能只改 expected revision。
- commit 成功但 publish 失败时，committed snapshot 仍是 authority；恢复 publish，不回滚 revision。
- authoritative TraceEntry 不得因 TraceStore/offload 故障丢失；P2 reference adapter采用 write-ahead/prepare-commit 等价语义，具体文件原子策略在 P2.0 冻结。
- stage commit 成功但 WorkflowStore checkpoint 失败时，resume 必须先用稳定 stage ID 对 authoritative transition result/MutationHistory 做 reconciliation，重建 checkpoint 后再判断下一 stage；不得重跑已提交 mutation。
- restore adapter 不得在 deserialization 时静默 reset transient Context。若 contract 最终选择 materialize 同一 snapshot，则 StateHash 必须相同；若选择 reset 形成新 canonical state，则必须通过正式 transition、`revision +1` 与 TraceEntry，并有冻结 oracle。

这只是本地 reference persistence，不是 real deployment 或 distributed transaction design。

### 6.5 Serialization, hashes, time and determinism

P2 必须区分四个相关但不等价的对象：

| 对象 | 语义 |
|---|---|
| Full persistence serialization | 持久化完整 canonical snapshot，包含 persistent `trace_window`/cursor；不等于 StateHash projection |
| StateHash | 覆盖 canonical logical state；排除 wall clock、repository payload 与 trace content |
| SnapshotHash | StateHash + trace cursor/ref，用于 snapshot/trace position 一致性 |
| RepositoryRevisionHash | 由 memory/repository boundary 对一个 immutable repository revision 计算 |

四者可以共享底层 canonicalization/hash algorithm，但必须有独立 versioned projection 与 golden vectors，禁止用“一个 hash”混写语义。

- `Observation.occurrence_logical_time` 是 occurrence time 唯一 authority。
- occurrence > current：MICL 先执行 TimeTransition；occurrence == current：不做非法额外推进；occurrence < current：`OUT_OF_ORDER_OBSERVATION`，V0 不回滚。
- `logical_time_before` 从 current SubjectState 读取；`elapsed_time` 是显式 input；`logical_time_after` 确定性派生。
- elapsed value = 0：`NO_OP`，不 commit、不加 revision。
- FAST+EMA durations 必须带 `tick`/`legacy_tick` timebase；裸 `60`/`150` 不可跨系统解释。
- 各 canonical projection 必须稳定 key order、numeric form、enum form；StateHash projection 排除 wall clock、random order、repository payload 与 trace content，full persistence serialization 则保留 contract 要求的 trace window/cursor。

---

## 7. Interface Design Plan

以下只定义职责与信息流，不规定 TypeScript/Python 语法。

| Boundary / Port | 概念操作 | 输入 | 输出 | 责任与限制 |
|---|---|---|---|---|
| SubjectCore | create / restore / read snapshot | validated seed 或 persisted snapshot + repository validator | immutable SubjectState / fail-closed result | 保证 schema、revision、repository ref 与 persistent/transient 语义；不调用 domain |
| CanonicalCommitEngine | commit | CanonicalTransitionProposal（含 N 个 domain deltas） | TransitionResult + next snapshot 或 rejection | 唯一 canonical mutation path；不是 `commit(single delta)` |
| CanonicalSerializationAndHash | persist / hash state / hash snapshot | canonical snapshot + versioned projection rule | full persisted form、StateHash、SnapshotHash | 区分 persistence 与 hash projections；不包含 repository revision content |
| IdempotencyRegistry | lookup / rebuild index | transition ID + payload hash + authoritative transition history | original result、retry permission 或 reuse rejection | 只作同界 index/可重建 projection；不得成为 post-commit 单点 authority |
| SubjectStateStore | load / atomic persist / publish recovery | subject ID、candidate snapshot、expected revision、trace bundle | persisted snapshot/ref 或 conflict | concrete adapter 在 sandbox；store 不计算 domain delta |
| TraceStore | prepare / commit / read history | TraceEntry、cursor、transition ref | authoritative mutation history/ref | successful trace 与 mutation 同边界；audit event 独立 |
| MemoryRepository | get revision / retrieve / prepare / validate / hash revision / export-import | repository revision、query、EpisodicMemoryRecord candidate | RetrievalResult、RepositoryRevisionHash 或 immutable prepared revision | repository 是 infrastructure；不得写 SubjectState |
| RetrievalService | retrieve | controlled query + fixed config + repository revision | selected refs + ranking evidence + trace ref | deterministic、explainable；empty result 合法；read failure 不伪装为空 |
| PerceptionNormalizer | normalize | objective text Observation | PerceptionResult | 不生成 emotion/appraisal，不预写主观意义 |
| ProjectionBuilder | build interpretation/appraisal projection | allowed SubjectState read model + retrieval + observation facts | projection ref/hash + minimum necessary context | 不 dump whole state/raw repository，不私藏 prompt history |
| InterpretationProvider | propose | InterpretationContextProjection | InterpretationProposal | 可由 fixed provider 或未来 LLM 实现；只提案 |
| InterpretationValidator | validate | proposal + projection + selected refs | accepted InterpretationResult 或 rejection | unsupported memory ref 必须 reject |
| AppraisalProvider | propose | AppraisalContextProjection | AppraisalProposal | 只输出六维 appraisal proposal，不输出 canonical affect |
| AppraisalValidator | validate | proposal + evidence/ranges | AppraisalResult 或 rejection | 不伪装 scientifically correct formula |
| AffectProducer | produce | AppraisalResult + current affect/mood/regulation/config/time | AffectDelta + MoodDelta | FAST+EMA reference semantics；不 commit |
| RegulationProducer | produce for elapsed time | current regulation + explicit Duration | RegulationDelta | minimal deterministic producer；不调用 LLM |
| ContextDeltaProducer | produce for Observation | Perception/Interpretation + current WorkingContext | ContextDelta | producer identity=`context`；只写 Observation 允许字段；不 commit、不写 memory/affect/slow layers |
| TimeTransitionExecutor | execute | current snapshot + elapsed Duration | TransitionResult | 聚合 regulation/affect/mood，一次 commit；memory eligibility 仅 signal |
| ObservationTransitionExecutor | execute | normalized current state + Observation + repository/provider ports | retrieval/interpretation/appraisal refs + TransitionResult | 原子提交 affect/mood/context/retrieval metadata；不 encode content |
| InternalExperienceBuilder | build | committed Observation result refs + affect/mood before/after refs | refs-only InternalExperience | 不复制整个 state，不伪造 Action/Outcome/future result |
| SalienceNormalizer | normalize | traceable appraisal intensity/novelty/relationship evidence | bounded deterministic salience + provenance | LLM 不得任意写 importance/salience |
| EpisodicMemoryEncoder | encode | InternalExperience + bounded salience | EpisodicMemoryRecord candidate | 不更新 belief/personality/relationship；P2 不调用 LLM summarization |
| LearningTransitionExecutor | execute / rebase | InternalExperience + current revisions | prepared memory ref + TransitionResult 或 contract-frozen stale/rebase result | 只写 memory content 子域；stale 必须 reload/revalidate；不自行新增 `REBASE_REQUIRED` enum |
| MICLRuntime | run / resume | MICLRequest 或 checkpoint | MICLResult + final snapshot | 复用已 committed stages；不回滚、不重复 affect/memory |
| WorkflowStore | checkpoint / load / reconcile | micl ID、stable stage IDs/results、payload hash、failure/audit refs + authoritative transition results | resumable workflow record | 不是 canonical state；checkpoint 丢失后先 reconciliation，不得重跑 committed stage |
| ConformanceRunner | execute requirement fixtures | frozen fixture catalog + runtime composition | PASS/FAIL + six evidence artifacts | 只用客观 oracle；不以语言质量豁免 |

---

## 8. LLM Integration Boundary

### 8.1 允许的未来职责

LLM 可作为可替换 provider：

- interpretation proposal；
- structured appraisal proposal；
- semantic reasoning / reasoning memo；
- 未来非 P2 的 expression/policy candidate。

P2 的核心 conformance 使用 fixed proposal providers，不依赖 live LLM、不依赖网络、不依赖 stochastic decoding。

### 8.2 Stage authority matrix

| Stage | P2 是否允许 LLM | P2 语义 |
|---|---|---|
| TimeTransition | **NO** | elapsed time、regulation、affect/mood evolution 全部 deterministic |
| text Perception normalization | **NO** | 只把 objective text 规范化为 facts/entities/ambiguity |
| Memory Retrieval | **NO** | repository/config 驱动的 deterministic retrieval；LLM 不选记忆 |
| Subjective Interpretation | **YES, proposal only** | P2 conformance 用 fixed provider；未来 live provider 仍须 evidence validation |
| Appraisal | **YES, proposal only** | 只产六维 structured proposal；不能产 AffectDelta |
| Affect bridge / FAST+EMA | **NO** | deterministic engineering bridge/reference producer |
| InternalExperience / salience / Experience Encoding | **NO** | refs-only builder、bounded normalization、deterministic encoding |
| Learning summarization | **NO in V0** | 不因“随后还会 validation”而偷偷引入 LLM |
| Cognition/Policy reasoning | **future, non-P2** | P1 contract 保留；本阶段不实现 |

P2 fixed providers 只实现 InterpretationProposal/AppraisalProposal boundary。Retrieval、Time、Affect、salience normalization、Experience Encoding 与 Learning summarization 都不得调用 LLM。

### 8.3 Controlled Context Projection

```text
allowed SubjectState read model
  + objective observation facts
  + selected MemoryRepository evidence
  ↓
minimum necessary projection + projection_ref/hash
  ↓
LLM / fixed proposal provider
  ↓
proposal
  ↓
schema → evidence-ref → range → allowed-field → ownership validation
  ↓
accepted domain result
  ↓
domain producer delta
  ↓
subject-core canonical commit
```

Projection 可包含相关 memory summaries、relationship readonly summary、selected trait seeds、regulation、mood、working context；不得包含 raw repository internals、任意 future knowledge 或整个 SubjectState dump。

### 8.4 绝对禁止

LLM 不得：

- mutate/serialize/overwrite SubjectState；
- set `state_revision` 或 `repository_revision`；
- write memory / insert canonical memories；
- create TraceEntry；
- change beliefs、relationships、personality；
- directly set affect/channel/intensity；
- 用 `{emotion: anger}` 代替 AppraisalV0；
- 引用未被 RetrievalResult 选择的 memory evidence；
- 把 system prompt/history window 当 canonical MemoryRepository；
- 通过 prompt injection 获得 canonical authority。

LLM unavailable 或 proposal invalid 时，Observation stage pre-commit abort/reject；V0 不虚构 deterministic appraisal fallback。

---

## 9. Evaluation and Requirement Integration

### 9.1 Module-to-contract mapping

| Module | Requirement IDs / groups | Acceptance groups | Required evidence |
|---|---|---|---|
| subject-core | `HASH-DET-001`、`TR-DET-001`、`TR-ATOMIC-001`、`TRACE-*`、`HASH-*`、`FAIL-*`、`IDEM-*` | A1、A6、A7、A10、A11、A12 | state hash、trace、failure、fixture manifests |
| memory | `MEM-REV-001`、`MEM-OWN-001`、`MEM-RET-001`、`LLM-EVID-001`、`REBASE-STALE-001` | A2、A3、A4、A10、A13 | repository revision、fixture、failure manifests |
| appraisal | `LLM-EVID-001`、`LLM-AUTH-001`；A4.1/A4.2 contract semantics | A4、A6 | projection hash、fixture results、failure summary |
| affect | `LLM-AUTH-001`、`TIME-*`；A5 contract semantics | A5、A6、A8 | state hash、transition trace、fixture results |
| runtime/transitions | `TR-DET-001`、`TR-ATOMIC-001`、`TIME-*`、`FAIL-*`、`IDEM-*` | A1、A8、A10、A11、A12 | transition trace、failure、fixture manifests |
| runtime/micl | `MICL-*`、`IDEM-*`、`REBASE-STALE-001` | A5、A9、A10、A12、A13 | conformance report、fixture/failure evidence |

`MICL-RESUME` 是用户示例标签，不是当前 P1.5 已冻结的精确 Requirement ID；现有 resume contract 由 `IDEM-*` + `MICL-*` 覆盖。P2 不自行发明新的 ID。

### 9.2 A1–A13 implementation gates

| Acceptance | P2 必须证明 | 最迟 phase |
|---|---|---|
| A1 Determinism | 同 state/repository/observation/time/config/fixed proposals 重放得到相同 transitions、selected refs、appraisal、deltas、final state/StateHash/RepositoryRevisionHash 与 trace semantic content | P2.5 |
| A2 Memory ownership/restore | restore 引用相同有效 repo revision；R999 fail closed；orphan 不自动 canonical；payload 不进入 SubjectState | P2.2 |
| A3 History-dependent retrieval | H1/H2 的受控相关历史能改变 selection/evidence；H3 无关数量不扰动 relevant set | P2.2 |
| A4 Retrieval/Appraisal dependency | RetrievalResult 是 Appraisal 前置；input hash 随 controlled retrieval 变化；无有效 result=`INVALID_STAGE_DEPENDENCY`；unsupported ref reject | P2.3 |
| A5 Persistent affect continuity | observation 后 persist/restart/restore/time advance 连续，不因 restart neutral reset | P2.4 |
| A6 State authority outside LLM | direct mutation、fake memory/revision/trace、prompt injection 全部 reject | P2.3 |
| A7 Cause trace | 每次 canonical commit 有完整 trace；MICL 全因果链可从 refs 重建 | P2.4 |
| A8 Time semantics | elapsed、zero NO_OP、future/equal/past occurrence、wall-clock invariance 全符合 contract | P2.3 |
| A9 Optional Action | Time→Observation→Learning 无 Action/Outcome 仍 `COMPLETED`，且 `external_effects=[]` | P2.4 |
| A10 Failure semantics | 所列 read/provider/producer/prepare/stale/commit/duplicate failure 都有正确 revision/orphan/retry/audit/status | P2.4 |
| A11 Atomic multi-domain | 一个 invalid ContextDelta 使 Affect/Mood/Context/RetrievalMetadata 全部不提交 | P2.3 |
| A12 Idempotency/resume | duplicate/reuse 正确；resume 不重跑 committed stages、不重复 affect/memory/revision | P2.4 |
| A13 Learning stale rebase | prepare 后 stale 不能原样重交；必须 reload/revalidate/rebase/rebuild，并返回 contract 最终冻结的 stale/rebase status/code 映射（当前 oracle 用语为 `REBASE_REQUIRED`） | P2.4 |

### 9.3 Frozen fixtures and oracles

P2.0 必须在 §15 的 S0/schema 与 requirement-index gaps 封口后，导入/冻结 P1.5 定义的：

- Golden SubjectState `S0`；
- memory histories `H0`–`H3`；
- objective observations `O1`–`O5`；
- fixed Interpretation/Appraisal proposal fixtures，包含 `projection_hash`、proposal data、evidence refs；
- oracle types：Exact/Hash/Set Equality、Range Constraint、Forbidden Mutation、Required Trace、Expected Failure Code、Revision Delta、Reference Integrity、Workflow Status；
- Retrieval、Appraisal schema、Affect bridge、salience、restore、crash window、serialization 与 adversarial catalogs。

### 9.4 Evidence artifacts

每次完整 conformance run 至少生成：

- `conformance-report.json`
- `fixture-results.json`
- `state-hash-manifest.json`
- `transition-trace-manifest.json`
- `repository-revision-manifest.json`
- `failure-summary.json`

所有 A1–A13 都是 MUST；P1.5 §§25–31 的 Retrieval、Appraisal schema、Affect bridge、Salience、Session Restore、Crash Window、StateHash/Serialization 规范性条款也必须全部 PASS。至少还要证明：Affect bridge mapping provenance 与 mechanism profile ref 存在；salience bounded/deterministic/traceable；Mood 不被每次 Observation 直接设成 current emotion；restore/hash/crash-window 符合 contract。

任何 MUST/cross-cutting normative clause 失败即整体 FAIL。不存在 90%/95% 合格，也不能用 LLM 输出质量或主观“看起来合理”豁免。

---

## 10. Testing Strategy

本节描述未来 P2 的测试计划；本次规划任务不创建或运行测试。

### 10.1 Unit tests

- SubjectState schema/default/range/readonly layers、full persistence/StateHash/SnapshotHash vectors。
- commit validation order、field authority、delta overlap、revision、idempotency、TraceEntry construction。
- MemoryRepository immutable revision、reference integrity、orphan/pending、export/import。
- retrieval ranking/evidence/empty-result/read-failure distinction。
- projection/evidence-ref/AppraisalV0 validation。
- FAST+EMA reference timebase、phase mapping、bounded affect/mood output、mapping provenance/profile ref。
- ContextDelta field authority、InternalExperience refs-only、EpisodicMemoryRecord、bounded deterministic salience。
- Time/Observation/Learning executor 的 pre/postconditions 与 failure codes。

### 10.2 Integration tests

- 多 producer → one proposal → one subject-core commit。
- repository prepare → MemoryContentDelta → canonical repo ref update。
- Observation read/interpret/appraise/affect/context/retrieval-metadata 原子链。
- MICL Time→Observation→Learning、partial completion、checkpoint/resume。
- process/session restart、restore validation、publish recovery、TraceStore failure injection。
- stale/interleaving/rebase 与 duplicate transition/MICL。
- `commit✓ / idempotency-index record✗ / retry` reconciliation：不得重复 revision。
- `stage commit✓ / workflow checkpoint✗ / resume` reconciliation：不得重复 affect/memory/revision。

### 10.3 Conformance tests

- 逐项实现 A1–A13 fixed fixtures/oracles，并覆盖 P1.5 §§25–31 的全部 normative cross-cutting clauses。
- conformance runner 只通过 public runtime composition，避免白盒测试掩盖 wiring 越权。
- full run 必须从干净 workspace 可重复，并生成 §9.4 六类 artifacts。

### 10.4 测试优先级

1. state correctness
2. memory ownership
3. transition semantics
4. MICL workflow
5. LLM boundary
6. failure recovery

每个 phase 先通过对应 unit/integration/requirement slice，才进入下一 phase；P2.5 是全量 gate，不是第一次接触 conformance。

---

## 11. Implementation Phases

### P2.0 — Project Bootstrap and Contract Freeze

**目标**

在显式授权后建立最小 TypeScript workspace、package boundary 与可执行 requirement/fixture index；不实现 runtime behavior。

**输入**

- 四份冻结 P1/P1.5 文档与本文；
- clean `main` baseline；
- 明确 P2 start authorization；
- §15 traceability gaps 的 docs-only resolution。

**输出**

- pinned Node/TypeScript/package manager/test runner/toolchain；
- workspace、strict config、package manifests、lockfile；
- import DAG enforcement；
- canonical schema、full persistence serialization、StateHash/SnapshotHash/RepositoryRevisionHash implementation decisions 的 ADR；
- A1–A13 + P1.5 §§25–31 normative cross-cutting requirement/fixture/oracle/evidence index；
- 空的 phase test harness 与 sandbox composition boundary。

**验收条件**

- no unresolved MUST ambiguity；family wildcard 已展开为 leaf catalog 或正式 expansion rule；Requirement ID 一一对应 fixture/oracle/evidence；
- subject-core zero-domain-import rule 可自动检查；
- toolchain 在 clean environment 可解析，但无 runtime claim；
- 未引入 DB、vector store、live LLM、Web framework 或 Python runtime。

**禁止事项**

- 不借 bootstrap 写 domain logic；
- 不修改 P1 semantics；
- 不复制旧 runtime；
- 不通过宽松 compiler/lint exception 预留绕过路径。

### P2.1 — Subject Core

**目标**

实现唯一 canonical authority：SubjectState、revision、commit、trace、serialization、hash、persistence ports 与 restore validation。

**输入**

- SubjectState V0 spec；
- Transition Contracts §5–§12、§21–§28；
- A1/A2/A6/A7/A10/A11/A12 的 subject-core requirements。

**输出**

- validated immutable SubjectState snapshots；
- generic CanonicalTransitionProposal/Result boundary；
- all-or-nothing multi-domain commit engine；
- full persistence serialization、StateHash/SnapshotHash、TraceEntry/MutationHistory/trace window/audit distinction；
- SubjectState store ports + sandbox in-memory/local reference adapters；
- idempotency registry 与 fail-closed restore。

**验收条件**

- state + revision + TraceEntry + cursor/hash refs 同 atomic boundary；
- invalid/stale/conflicting/unauthorized delta 均不改变 state；
- same semantic state 得到 same serialization/hash；
- full persistence 保留 persistent trace window/cursor；StateHash 与 SnapshotHash projections 不混写；
- restore 不静默 reset canonical Context；materialize 或 formal reset transition 的 revision/hash/trace oracle 已冻结并通过；
- subject-core import graph 无任何 domain/runtime/provider edge；
- 对应 requirement slice 全 PASS。

**禁止事项**

- 不调用 affect/memory/appraisal/regulation；
- 不拥有 workflow orchestration；
- 不把 failed proposal 写成 mutation history；
- 不用 wall clock 驱动 canonical fields。

### P2.2 — Memory Layer

**目标**

实现 P2 最小 versioned memory infrastructure、deterministic retrieval 与 current experience encoding boundary。

**输入**

- SubjectState MemoryState/revision contracts；
- MICL Retrieval/Encoding design；
- A2/A3/A4/A10/A13 requirements。

**输出**

- MemoryRepository port + immutable in-memory reference adapter；
- revision validation、RepositoryRevisionHash、prepare、orphan/pending、deterministic export/import；
- RetrievalQuery/Result/evidence；
- H0–H3 fixed retrieval behavior；
- EpisodicMemoryRecord encoder、bounded SalienceNormalizer 与 retrieval/content delta producers。

**验收条件**

- selected refs 属于指定 repository revision，unknown refs fail closed；
- empty retrieval 与 read failure 严格区分；
- fixed repo/config 下 retrieval deterministic + explainable；
- restore R999 失败、orphan 不 canonical；
- RepositoryRevisionHash golden vectors 与 A1 equality oracle 可重复；salience bounded/deterministic/traceable；
- content 与 retrieval subdomain 无重叠写；
- A2/A3 及相关 negative slice PASS。

**禁止事项**

- 不接 vector DB；
- 不启用 affect/mood congruence；
- 不把 repository payload/embedding 塞进 SubjectState；
- 不直接 commit canonical state；
- 不复制旧 memory runtime。

### P2.3 — Transition Runtime and Reference Producers

**目标**

实现 text Perception、Interpretation/Appraisal ports、reference Affect/Regulation producers，以及 Time/Observation/Learning logical transition executors。

**输入**

- P2.1 subject-core public boundary；
- P2.2 memory public boundary；
- Transition Contracts 与 MICL stage contracts；
- fixed proposal fixtures。

**输出**

- TimeTransition executor；
- ObservationTransition executor；
- LearningTransition executor/rebase boundary；
- controlled projection + fixed Interpretation/Appraisal providers/validators；
- Appraisal→Affect deterministic bridge；
- FAST+EMA reference producer + minimal regulation producer；
- producer identity=`context` 的 Observation ContextDeltaProducer。

**验收条件**

- Retrieval→Interpretation→Appraisal→Affect 顺序不可绕过；
- AppraisalV0 只有六个冻结字段；
- Observation atomic commit 可聚合 Affect/Mood/Context/RetrievalMetadata，任一 invalid 则全部拒绝；
- invalid ContextDelta 的 A11 fixture 能证明所有 domain deltas 均未提交；
- Time zero NO_OP、future/equal/past occurrence 与 timebase 符合 A8；
- Learning 只写 content 子域，stale 不得原样重交；
- A4/A6/A8/A11 及相关 failure slice PASS。

**禁止事项**

- 不接 live LLM；
- 不让 LLM/proposal provider 产 canonical delta；
- 不写 CognitionAction/behavior/action；
- 不把 FAST internal phases 固化进 public SubjectState schema；
- 不声称 appraisal/affect bridge 科学正确。

### P2.4 — MICL Workflow, Resume and Sandbox

**目标**

把三个 logical transition 组合成可 checkpoint、可 resume、跨 session 连续的最小 runnable MICL。

**输入**

- P2.1–P2.3 public APIs；
- MICL Request/Result、failure matrix、resume/idempotency contracts；
- A5/A7/A9/A10/A12/A13。

**输出**

- MICL run/resume；
- workflow ledger/checkpoint + authoritative transition-result reconciliation；
- refs-only InternalExperienceBuilder handoff；
- stage-specific failure result；
- publish/session restore recovery；
- `product/sandbox` reference composition。

**验收条件**

- Time→Observation→Learning 无 Action 仍 COMPLETED；
- Learning 失败不回滚 Time/Observation；resume 只执行未完成 stage；
- same micl ID/same payload 不重复 affect/memory/revision；changed payload reject；
- stage commit 后 checkpoint 丢失可从 stable IDs + authoritative results 重建，不重跑 committed stage；
- restart 后 affect/mood/memory revision/trace 连续；
- restore 不静默 reset transient Context；具体 materialize/reset transition 语义服从 §15 封口；
- stale after prepare 走 reload/revalidate/rebase/rebuild，并返回 contract 冻结的 stale/rebase result mapping；
- A5/A7/A9/A10/A12/A13 slice 全 PASS。

**禁止事项**

- 不把 MICL 包装成单一 commit/global transaction；
- 不重跑已 committed stage；
- 不原地 rollback；
- 不伪造 Action/Outcome；
- 不把 workflow store 当 canonical SubjectState。

### P2.5 — Full Conformance and Review Gate

**目标**

执行完整 A1–A13 与 P1.5 §§25–31 normative cross-cutting conformance，产出可复核证据，并决定 P2 PASS/FAIL。

**输入**

- frozen S0、H0–H3、O1–O5、fixed proposals；
- 完整 requirement matrix、oracles、negative/adversarial catalog 与 P1.5 §§25–31 normative cross-cutting catalog；
- clean build of the P2 sandbox。

**输出**

- 六类 conformance evidence artifacts；
- requirement-level PASS/FAIL report；
- import-boundary/scope audit；
- independent reviewer sign-off；
- remaining SHOULD/INFORMATIONAL findings（不得混入 MUST PASS）。

**验收条件**

- A1–A13 所有 MUST + P1.5 §§25–31 所有 normative cross-cutting clauses = 100% PASS；
- evidence 可从 clean checkout 重现；
- 无 live LLM/random/wall-clock dependency；
- 无 out-of-scope package behavior；
- P2 milestone criteria §16 全满足。

**禁止事项**

- 不 waiver MUST；
- 不用人工观感覆盖 oracle；
- 不运行 scientific benchmark/experiment；
- 不因 conformance 困难修改 frozen architecture；
- 不宣称完整人工生命或完整长期主体。

---

## 12. Development Workflow

### 12.1 Branch and review model

- `main` 保持受保护、可重复；P2 每个 phase/module 使用 bounded feature branch/PR。
- Codex 环境默认示例：`codex/p2.1-subject-core`、`codex/p2.2-memory`；其他 agent 使用其环境规定前缀，但 phase/scope 名称保持一致。
- 一个 PR 只覆盖一个明确 requirement slice；禁止“顺便”加入 behavior、personality、deployment 等。
- 每次合并前必须完成：implementation → relevant unit/integration conformance → scope/dependency review → human/independent review。
- P2.5 full conformance 通过前，任何中间 branch 不得称为 MICL V0 conformant。

### 12.2 每个 module 的交付包

1. 关联 P1/P1.5 source sections 与 Requirement IDs。
2. 明确 public boundary、owned fields、forbidden imports/mutations。
3. 实现与最小 supporting adapters。
4. unit/integration tests 与 relevant A-slice evidence。
5. failure/negative cases。
6. dependency graph 与 scope diff。
7. reviewer checklist 与 PASS/FAIL。

### 12.3 Codex / Claude Code / DeepSeek Harness 规则

每个 AI coding agent 的 task packet 必须包含：

- frozen source documents；
- 本 phase 的输入/输出/禁止事项；
- exact requirement slice；
- allowed paths 与 forbidden paths；
- required commands/evidence；
- “不能通过修改 acceptance 来修测试”的明确规则。

AI agent 不允许：

- 绕过/删除/skip MUST tests；
- 使用 `any`、unvalidated cast、mock success 或 hard-coded hash 掩盖 contract；
- 修改 P1 ownership/field partition/failure semantics；
- 把 live LLM 输出当 acceptance oracle；
- 直接向 `main` 推送未审阅 implementation；
- 读取旧源码后直接复制进新 runtime；
- 因 token/time budget 宣称 partial work complete。

发现 ambiguity、scope expansion 或 frozen-doc conflict 时，agent 必须 STOP/REPORT，并将问题交给 contract owner，而不是自行创新架构。

---

## 13. Migration Decision

### 13.1 结论

**P2 不直接迁移旧 CharacterOS runtime；采用 architecture-first clean implementation。** Controlled Migration 是 P3，且需要逐项审批、来源 SHA 与独立 review。

### 13.2 P2 可使用

- 经审计的设计思想与历史结论；
- determinism/replay/trace/audit 的工程经验；
- FAST+EMA 的冻结 reference semantics；
- 历史实验与文档作为只读 evidence/context；
- MIGRATION_MAP 已明确允许的未来参考分类。

### 13.3 P2 不可使用

- 直接复制旧 event-centric runtime；
- 移植旧 Emotion 非持久写路径；
- 复用旧 product/UI/behavior pipeline；
- 把旧 tests 当成新 conformance 已通过；
- 未经 P3/G3 单项审批复制任何 legacy source；
- 修改 `CharacterOS`、`CharacterOS emotion`、CERH 或外部审计 workspace。

旧架构 prototype-oriented / event-centric；CharacterOS-Next architecture-first / contract-driven。可参考 ideas，不继承不兼容的 ownership 或 write path。

---

## 14. Risk Analysis

| ID | 风险 | 影响 | 早期信号 | 缓解与 gate |
|---|---|---|---|---|
| R1 | 设计过度导致实现困难 | package/abstraction 膨胀，P2 无法闭环 | 新增未被 MICL/A1–A13要求的层、框架、ports | 只实现最小 public boundary；每项能力必须映射 requirement；无映射即 defer |
| R2 | MICL workflow 被误做成复杂全局事务 | retry/partial completion 语义错误 | 尝试一次锁住 Time/Observation/Learning 或回滚 rev | 明确 stage ledger；per-transition atomic；failure injection + A10/A12 |
| R3 | LLM nondeterminism 污染核心验收 | replay/hash 不稳定，authority 越权 | conformance 依赖网络/model/temperature | fixed providers；live LLM 非 P2 必需；projection/proposal 全可审计 |
| R4 | Memory retrieval abstraction 太弱或过早绑定 vector DB | 无法解释 selection 或后续替换困难 | interface 暴露 vendor query/embedding internals | versioned repository + evidence-based retrieval port；in-memory adapter；A3/A4 |
| R5 | 过早加入人格、关系、信念、行为 | 范围膨胀并违反 readonly layers | PR 出现 slow-layer delta/ActionExecutor | path/scope allowlist；field authority test；review checklist |
| R6 | subject-core 吸收 domain orchestration | 核心循环依赖、Producer=Mutator | subject-core import memory/affect/appraisal/provider | automated import DAG gate；subject-core zero-domain rule |
| R7 | state-memory crash window 处理错误 | SubjectState 引用无效 repo revision | commit 前未 validate；retry 生成无限 orphan | immutable prepare + ref validation + orphan policy + A2/A10/A13 |
| R8 | Requirement ID/状态/schema 枚举漂移 | 实现与 reviewer 使用不同 oracle | A11/partial/rebase status、timebase/S0 shape 不一致 | §15 docs-only normalization；机器可读 leaf requirement index；禁止自行造 ID/schema |
| R9 | persistence/StateHash/SnapshotHash/RepositoryRevisionHash 混写 | A1、restore、replay 全失真或 trace window 丢失 | 普通 JSON order、wall clock、numeric edge、projection 未定义 | P2.0 分别冻结 projections/algorithm/version/golden vectors；单一底层 oracle rules |
| R10 | resume 重复应用 affect/memory | revision、体验记录重复 | retry 重跑 Time/Observation；commit 后 index/checkpoint 丢失；prepared revision 不复用 | stable IDs/payload hash；authoritative history reconciliation；A12 + crash-window fixtures |
| R11 | FAST+EMA 或 bridge 被过度宣称 | 研究/产品结论失真，未来 schema 被锁死 | internal FAST phase 泄漏 public schema；出现“情绪理论”措辞 | public normalized phases；provenance；文档/reviewer wording gate |
| R12 | local reference persistence 被误当 production readiness | 提前部署、忽略 durability limits | sandbox adapter 被产品层直接复用 | 明确 adapter label/limitations；deployment remains non-scope |

---

## 15. P2 Entry Gate and Traceability Gaps

P2 第一条 implementation commit 之前必须同时满足：

1. P1.5 Engineering Acceptance Contract 状态明确为 PASS；
2. 人类显式授权 P2 start；
3. P1/P1.5 source docs 仍为冻结权威；
4. acceptance fixture catalog 冻结；
5. A1–A13 requirement/fixture/oracle/evidence matrix 完整；
6. 无 unresolved MUST ambiguity；
7. P2 scope 仍限于 MICL minimal runtime；
8. NO research experiment / NO uncontrolled migration。

当前规划审查发现以下**追踪/枚举封口项**。它们不改变架构，但在实施前必须由 contract owner 做 docs-only clarification：

| Gap | 当前证据 | P2 处理规则 |
|---|---|---|
| A11 ID | 正文 `ATOMIC-001`；Conformance Matrix `TR-ATOMIC-001` | 计划映射暂引用 matrix 的 `TR-ATOMIC-001` 并保留 alias 记录；实施前冻结唯一 ID |
| A4.1/A4.2 ID | 有 fixture/oracle，matrix 未给单独稳定 ID | 不删 fixture、不自行造 ID；实施前补 requirement index |
| A5 ID | 有完整 MUST 语义，matrix 无单独稳定 ID | 按 A5 全量实现；实施前补 requirement index |
| Requirement family wildcards | `TIME-*`、`TRACE-*`、`HASH-*`、`FAIL-*`、`IDEM-*`、`MICL-*` 仍是 family，不是完整 leaf catalog | 实施前冻结 leaf IDs，或正式定义 family→fixture/oracle/evidence expansion rule |
| `MICL-RESUME` | 用户示例名；冻结 contract 实际为 `IDEM-*` + `MICL-*` | 不发明新 ID；除非正式 contract clarification 明确新增 |
| Learning stale / `REBASE_REQUIRED` | MICL failure table 简写与 P1.5 A13 的 rebase 要求不完全一致；TransitionResult/MICLResult status enum 又都未定义 `REBASE_REQUIRED` | 执行以 A13 的 reload/revalidate/rebase 语义为硬约束；contract owner 冻结它是 transition status、MICL status、failure code/reason 或映射，并同步 schemas/oracle |
| MICL failure status | `PARTIAL_COMPLETION` 与 `FAILED_AFTER_OBSERVATION` 的唯一选择未封口；Time NO_OP 后 Observation failure 也未唯一分类 | contract owner 冻结状态选择表后再实现 workflow enum |
| Transient Context reset ownership | SubjectState/MICL 要求 transient fields 在下一次 Time/Observation 重置；Transition ownership matrix/Time contract 未授权 Time 写 Context | contract owner 决定受限 Time ContextResetDelta 或 Observation/显式 reset transition 语义，并同步 ownership、Time contract、restore/fixtures；实现者不得自行选 |
| Affect profile/timebase shape | SubjectState 把 `mechanism_config.affect_profile` 定义为 enum/string；Transition contract 使用 `affect_profile.timebase` object path | schema freeze 前由 contract owner 固定 affect profile 类型与 `legacy_tick` 唯一字段路径；实现层不得扩 schema |
| Golden S0 `schema_version` | SubjectState spec 规定顶层唯一源；P1.5 S0 描述把它列入 `runtime_metadata` | S0 materialization 前做 docs-only correction；不得由 fixture builder 猜测或建立双源 |
| MEM-OWN source reference | Conformance Matrix 引用 `spec §5.1/§9`，当前 spec 实际为 §5/§9 | docs-only 修正 source pointer；Requirement 语义不变 |
| A1–A10 vs A1–A13 | MICL 原文仍是 P1.5 前置映射 | P2 一律按最终 P1.5 A1–A13；不丢 A11–A13 |

在这些项封口、P1.5 contract PASS 且获得显式授权之前，coding-agent execution readiness 保持 **BLOCKED**，P2 implementation status 保持 **NOT STARTED / CONDITIONAL**。这不影响本规划产物的 PASS。

---

## 16. P2 Milestone Definition

P2 只有在以下条件全部满足时才算 COMPLETE：

1. 可从 validated seed 创建一个 SubjectState。
2. SubjectState 可持久化、重启、fail-closed restore，persistence/StateHash/SnapshotHash/repository ref 正确，且 deserializer 不静默 reset canonical fields。
3. 可接收 objective text observation，并先完成 logical-time normalization。
4. 可从指定 immutable memory revision 检索 relevant history，并产出 traceable ranking evidence；empty history 合法。
5. 可通过 fixed/provider interface 形成 evidence-bound Interpretation 与六维 Appraisal。
6. Appraisal 经 deterministic engineering bridge 驱动 FAST+EMA reference Affect/Mood producer，而非 emotion label 直写。
7. ObservationTransition 将 affect/mood/context/retrieval metadata 一次原子提交。
8. 可构造 InternalExperience、编码 EpisodicMemoryRecord、prepare repository revision，并由 LearningTransition 更新 memory content subdomain。
9. failure、duplicate、stale、orphan、publish、idempotency-index/checkpoint crash、session restore、resume 均符合 frozen semantics。
10. MICL 可在无 Action/Outcome 情况下完成 Time→Observation→Learning，并可从 stage checkpoint 恢复。
11. A1–A13 全部 MUST 与 P1.5 §§25–31 normative cross-cutting clauses 100% PASS，六类 evidence artifacts 可从 clean checkout 重现。
12. import DAG、scope audit、independent review PASS；没有 belief/relationship/personality/behavior/tools/world/multimodal/deployment/training/experiment 实现。

P2 完成后只允许声称：

> CharacterOS-Next 已具备一个通过 P1.5 工程 conformance 的 MICL V0 minimal runtime implementation。

不得声称：完整人工生命、完整长期主体、AGI、意识、科学正确的情绪系统、优于 LLM+Prompt 或已验证 personality。

---

## 17. Red Team Review

| 问题 | 审查结果 | 证据/修正 |
|---|---|---|
| R1 是否偷偷修改 P1 架构？ | **NO** | 保留单一 SubjectState、Producer!=Mutator、memory partition、transition atomicity、MICL multi-transition 与 P1 package map；歧义只进入 clarification gate。 |
| R2 是否提前实现？ | **NO** | 本文只规划未来目录/接口/阶段；未创建 packages、runtime、config、dependency 或 test。 |
| R3 是否把 LLM 当状态核心？ | **NO** | LLM 仅 proposal provider；controlled projection + validation + producer + subject-core commit 是唯一影响路径。 |
| R4 是否把 emotion 简化成 label？ | **NO** | 冻结 Interpretation 与六维 Appraisal，Affect 是 downstream；禁止 Observation/LLM emotion label 直连。 |
| R5 是否范围膨胀？ | **NO** | Behavior/Action/World/slow-layer dynamics/vector DB/deployment/training/research 明确排除；必要增加项均来自 P1/P1.5 MUST。 |
| R6 是否可被 coding agent 执行？ | **YES, CONDITIONAL** | 每 phase 有目标、输入、输出、验收、禁止事项与 requirement slice；但实施前须完成 §15 gate 并获得显式授权。 |

### 17.1 Additional attack checks

- subject-core 不负责 orchestration，也不 import domain。
- MoodDelta producer 属 affect，不新增独立 mood authority。
- Time memory eligibility 只是 signal。
- Retrieval read failure 不降级成 empty result。
- Learning stale 不只更新 expected revision。
- trace window eviction 不删除 MutationHistory。
- commit 后 publish failure 不回滚 canonical history。
- P2.5 是工程 conformance，不是 scientific evaluation。

---

## 18. Safety Check

本规划交付确认：

- **NO CODE**
- **NO IMPLEMENTATION**
- **NO RUNTIME CREATED**
- **NO PACKAGE CREATED**
- **NO DEPENDENCY INSTALLED**
- **NO TEST EXECUTED**
- **NO EXPERIMENT**
- **NO P2 START**
- **NO OLD REPO CHANGE**
- **NO MIGRATION**
- **NO ARCHITECTURE REWRITE**

本文的唯一作用，是将已冻结 P1/P1.5 转换为未来工程团队可执行、可停止、可审计、可验收的 P2 实施路线。
