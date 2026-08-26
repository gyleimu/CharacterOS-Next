# P2.3 Runtime Integration Architecture Plan

**任务状态：** P2.3.0 Runtime Integration Architecture Planning — **COMPLETE**。

**交付性质：** docs-only architecture plan。本文只冻结未来实施顺序、模块拓扑、职责边界与集成点；不包含任何 TypeScript 实现、transition class、provider 代码、测试代码、依赖变更或运行时行为。

**规划基线：** `2de242a`（P2.2.5 memory conformance integration）。

**实施状态：** **NOT STARTED / REQUIRES EXPLICIT AUTHORIZATION。** 本文不构成 coding authorization；不得据此自动开始 P2.3.1 或任何实现。

**权威与边界：**
- 联合冻结权威不变：`subjectstate-v0-spec.md`、`transition-contracts.md`、`micl-design.md`、`p1-5-engineering-acceptance-contract.md`，以及 `p2-runtime-plan.md` 与 `p2-1-contract-freeze.md`。
- 本文是 `p2-runtime-plan.md` §11「P2.3 — Transition Runtime and Reference Producers」的实施级分解，只做细化与顺序冻结，不修改任何已冻结的 schema、错误码映射、commit 协议或验收 oracle。发现冲突时停止相关 slice 并上报，不得为实现方便改写上游。

---

## 1. Runtime Package Topology（冻结）

### 1.1 P2.3 目录拓扑

在既有 `packages/runtime` 骨架内建立以下模块边界（目录名为规划边界，实际文件布局由实施 slice 决定，但职责分区不得合并）：

```text
packages/runtime/src/
  composition/
    composition-root.ts        # 唯一 trusted capability 铸造点（见 §4）
    capability-tokens.ts       # ProducerAuthorizationSetV1 / continuation / binding 的铸造入口
  ports/
    state-reader.ts            # StateReader adapter 接线（面向 subject-core 端口）
    identity-journal.ts        # TransitionIdentityJournal 参考适配器接口位
    atomic-store.ts            # AtomicCommitStore 接线（复用 subject-core InMemory 参考）
    workflow-store.ts          # PreparedLogicalResultV1 durable create/read-verify 端口
    publish-sink.ts            # PublishSink 投影接线
    reference-validator.ts     # memory ReferenceValidator verdict-only 能力接线
  transitions/
    time-executor.ts
    observation-executor.ts
    learning-executor.ts       # 含 rebase 边界（§5.4）
    executor-common.ts         # 共享：raw admission→proposal 组装→两调用协议驱动
  producers/
    affect-reference.ts        # FAST+EMA reference Affect/MoodDelta 生产（deterministic）
    regulation-reference.ts    # 最小 RegulationDelta 生产
    context-observation.ts     # producer=identity `context` 的 ContextDelta 生产
    retrieval-metadata.ts      # memory RetrievalMetadataDelta 生产（refs-only）
  perception/
    text-normalizer.ts         # objective text → facts/entities/ambiguity（无 LLM）
```

**明确不在 P2.3 拓扑内：** `runtime/micl/*`（workflow/checkpoint/resume 属 P2.4，见 §6）；CognitionAction/Behavior/Action 执行器；任何 provider SDK 接线。`packages/runtime/package.json` 需按 Import DAG（§1.2）声明对 subject-core/memory/appraisal/affect/regulation 的公共根依赖——依赖声明的 lockfile 机械变化随该 slice 的 isolation commit 一并裁定。

### 1.2 Import DAG（沿用 p2-runtime-plan §4.3，重申为 P2.3 硬约束）

```text
product/sandbox → runtime
runtime → subject-core(公共根) + memory(公共根) + appraisal/affect/regulation(公共根)
appraisal → memory 公共检索契约 + subject-core 只读契约
memory/affect/regulation → subject-core 只读契约（禁止反向）
domain ✛ runtime 反向依赖 = 边界违规 = slice FAIL
evals/conformance → 仅公共 API + sandbox 测试装配
```

自动 import-boundary check（eslint 边界规则已存在）作为每个 slice 的 gate 之一；出现反向边即 FAIL，不得豁免。

### 1.3 Composition root 单一性

trusted capabilities 只能在 `composition/` 铸造：

| Trusted capability | 铸造者 | 进入 subject-core 的方式 |
|---|---|---|
| `ReservedTransitionContinuationV1` | journal 经 `reserveAndRoute` 返回 | 第二调用参数 |
| `PreparedLogicalResultBindingV1` | composition 在 WorkflowStore durable read-verify 后铸造 | `commitReserved` 参数 |
| `ProducerAuthorizationSetV1` | composition 按 deltas 的 `(producer,domain)` 集合铸造 | `commitReserved` 参数 |

任何其他模块伪造/反序列化上述能力即 layer-0 `FORBIDDEN_DIRECT_MUTATION`（SC-002C/A6.1 语义）。

---

## 2. Transition Producer Boundaries（冻结）

### 2.1 P2.3 producer 清单与身份

| Producer 身份 | 模块 | 可写 partition（经 delta） | 允许 transition | 明确禁区 |
|---|---|---|---|---|
| `affect` | producers/affect-reference | `/mood`、`/affect` | Time, Observation | 不 commit；不拥有 config authority；FAST 内部相位不入公共 schema |
| `regulation` | producers/regulation-reference | `/regulation` | Time, CognitionAction* | 不扩张 homeostasis 模型 |
| `context` | producers/context-observation | `/context` | Observation, CognitionAction* | 不隐式获得 Time reset 权限；不写 memory/affect |
| `memory`（retrieval 元数据） | producers/retrieval-metadata | `/memory_state/working_refs`、`recent_retrieval_trace`、`last_retrieval_at` | Observation | 不 encode episodic content；不写 content 子域 |
| `memory`（content） | Learning 编码路径（§5.4） | content 子域六字段 | Learning | 不回写 retrieval metadata |

\* CognitionAction 执行器本体不在 P2.3 范围；其 ownership 行仅冻结于 authority catalog，供后续阶段使用。

### 2.2 Producer 通用规则

1. Producer 只计算 delta：输入 = 冻结配置/受控投影/当前只读快照视图；输出 = `DomainDeltaV0`（含 `expected_repository_revision` 规则：retrieval=当前 revision，非 memory=null）。
2. Delta 组装成**一个** `CanonicalTransitionProposalV1` 由 executor 完成；producer 不得自行调用 subject-core。
3. Interpretation/Appraisal 为 **proposal-only fixed providers**（无 LLM）：AppraisalV0 六字段结构化输出；Appraisal→Affect 桥接为确定性工程映射，桥接 provenance 必须可追溯（profile ref 存在性属 P2.5 conformance 断言）。
4. LLM stage authority 沿用 §8.2 矩阵：Time/Perception/Retrieval/Affect-bridge/Salience/Encoding/Learning-summarization 全部 deterministic；Interpretation/Appraisal 允许 proposal-only（P2.3 用 fixed provider）。
5. 任何 producer 输出必须先通过 subject-core 校验层（P2.1.2）方可进入 candidate；invalid delta ⇒ 整个 proposal 拒绝（A11 语义，见 §7）。

---

## 3. Orchestrator Responsibility（冻结）

`transitions/executor-*` 是单 logical transition 的编排者。职责按 p2-runtime-plan §6.2 序列分解如下（序号对应）：

| 步骤 | 归属 | P2.3 落点 |
|---|---|---|
| raw Time duration admission（负值/单位/非有限） | Time executor，proposal 之前 | pre-proposal 结果：`INVALID_SCHEMA/INVALID_LOGICAL_TIME/INVALID_TIMEBASE`，无 identity/audit |
| elapsed=0 分类 | Time executor | 零 delta+零 binding 提案 → 走 `terminalizeReservedNoOp` 路径（§5.1） |
| proposal 组装 + fingerprint/ref 计算 | executor（调 subject-core 纯函数） | `reserveAndRoute` 前完成 |
| `reserveAndRoute` + durable reservation | executor ↔ journal 端口 | NEW/SAME_OPEN 得 continuation；terminal 路由原结果 |
| Prepared record durability + binding 铸造 | composition + workflow-store 端口 | 失败映射 `SERVICE_UNAVAILABLE/FAIL-PRECOMMIT-001` 或 `COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001`（§13.4 layer 3P） |
| `commitReserved` / `terminalizeReservedNoOp` | executor → subject-core 引擎 | 一次 CAS；CONFLICT/FAILURE/OUTCOME_UNKNOWN 按 §15.2 映射 |
| Publish projection | executor → publish-sink 端口 | post-authority；失败恢复不回滚 |

**Orchestrator 禁止：** domain-by-domain commit；跳过 prepared-record durability；把三次 transition 合成一个 commit；读取/解释 prepared record 的 domain 字段；在 authority unknown 时断言 ABORTED；重跑已 committed stage。

---

## 4. SubjectCore Commit Boundary（冻结）

Runtime 与 subject-core 的唯一交互面 = 已实现的 P2.1.3 引擎公共 API + 两调用协议：

1. `reserveAndRoute(proposal)` —— 语法准入 + 当前权威读取 + fingerprint/ref + journal reserve（本 slice 由 composition 提供参考 journal：进程内 Map + record_version CAS，语义同 §14.1 五路由）。
2. runtime 侧 prepared step（WorkflowStore 参考适配器：进程内 content-addressed 存储）。
3. `commitReserved(proposal, continuation, ProducerAuthorizationSetV1, PreparedLogicalResultBindingV1)` —— 引擎内部执行 §13.4 layers 4–8 与单次 `compareAndCommit`。

**边界红线：**
- Runtime 不得绕过引擎直接构造 bundle/写 store；
- Runtime 不得复用 preparation 前的 snapshot 作为第二调用权威（引擎已强制重读）；
- Subject-core 不知道 WorkflowStore/journal 实体，只见 trusted refs/versions（现状保持）；
- `OUTCOME_UNKNOWN` 必须先 reconcile（同 ID/fingerprint 查 committed truth），不得直接 ABORTED；
- 失败语义逐字采用 freeze §13.3 映射，runtime 不新增错误码。

---

## 5. Transition Ownership Matrix（冻结）

### 5.1 TimeTransition（owner: transitions/time-executor）

- 输入：显式 `elapsed_time{value≥0,unit:"tick"}`；logical_time_after = checked-add 派生；elapsed=0 → NO_OP 终态（`NoOpTransitionResultV1`，reason=`TIME-NOOP-001`），不加 revision、无 trace。
- Required deltas（elapsed>0）：affect(/mood+/affect) + regulation(/regulation)。
- Memory eligibility 只是派生信号：Time 不得写任何 MemoryState 字段。
- occurrence 语义不适用（仅 ELAPSED 形状合法）。

### 5.2 ObservationTransition（owner: transitions/observation-executor）

- occurrence == current logical_time 才可提交；past → `OUT_OF_ORDER_OBSERVATION/TIME-OCCURRENCE-001`（owning-stage 结果）；future → MICL 先排 Time（P2.4 起；P2.3 内直接拒绝并留待 MICL）。
- 强制管线顺序不可绕过：Retrieval → Interpretation → Appraisal → Affect bridge → Context/RetrievalMetadata delta 聚合（A4 语义）。
- Required deltas：affect(/mood,/affect) + context(/context)；optional：memory-retrieval 三件套（部分提供 = 组合非法）。
- 任一 delta invalid ⇒ 全部不提交（A11）。
- 检索证据引用超出 RetrievalResult 选择集 ⇒ `UNSUPPORTED_EVIDENCE_REF/LLM-EVID-001`。

### 5.3 CognitionAction（占位）

P2.3 不实现执行器；authority-catalog 行（context/regulation 二选一、NO_ACTION 无提案路径）保持冻结，防止 catalog 被裁剪。

### 5.4 LearningTransition（owner: transitions/learning-executor，含 rebase 边界）

- 只写 content 子域（repository_revision/autobiographical_index_revision/active_episode_refs/pending_encoding_refs/consolidation_cursor/lifecycle_metadata）。
- 流程：memory prepare 新 revision（orphan-safe）→ 提案携带 `expected_repository_revision=parent` 且新 revision ≠ 旧值 → subject-core 校验后提交；prepare 成功而 commit 失败 ⇒ orphan 非 canonical，retry 必须复用同一 prepared revision。
- stale（expected ≠ current authority）：不得原样重交；reload/revalidate 后 safe rebuild 用新 ID，unsafe rebuild 返回 `REBASE_REQUIRED/STALE_STATE_REVISION/REBASE-STALE-001`（runtime-owned 包装）。
- episodic payload 使用 P2.2.1 EpisodicMemoryRecordV0 draft（occurrence/provenance/references/context/appraisal_ref/affect_snapshot_ref/declared salience）——encoding 是确定性登记，不是记忆动力学。

---

## 6. MICL Workflow Future Boundary（冻结到 P2.4）

P2.3 **不实现** MICL。为 P2.4 预留且本期不得侵占的接缝：

1. Stage keys `TIME|OBSERVATION|LEARNING` 与 `workflow_binding=null`（standalone）字段已存在于 PreparedLogicalResultV1 —— P2.3 全部置 null，不伪造 binding。
2. Request fingerprint / resume / partial-completion / InternalExperience handoff：全部推迟至 P2.4（p2-runtime-plan §11 P2.4 行为准）。
3. P2.3 的每个 transition 都必须独立完整走完两调用协议，使 P2.4 的 workflow ledger 可以纯粹地“串起 N 个已完成 transition”，而不需要回头改造任何 P2.3 行为。
4. 禁止在本期引入：workflow ledger 表、checkpoint 文件、resume API、跨 transition 的全局事务语义。

---

## 7. A1–A13 Integration Points（冻结）

| Group | 本期集成点（P2.3 内证明） | 到期 | 证据落点 |
|---|---|---|---|
| A1 Determinism | 同 fixture 双跑 executor：候选/选择/appraisal/deltas/final hash/trace 语义全等 | P2.5 收口 | fixture-results.json |
| A2 Memory ownership/restore | §conformance（P2.2.5 已立）；restore interop 保持 PASS | P2.2 ✔（回归保护） | repository-revision-manifest.json |
| A3 History-dependent retrieval | 检索契约 H1/H2/H3 夹具接入 rehearsal 差异（P2.2.3/4 已具备类型与重放面） | P2.2 基线，P2.5 收口 | fixture-results.json |
| **A4 Retrieval/Appraisal dependency** | Observation executor 强制 RetrievalResult 前置；input hash 进 controlled projection；缺 result ⇒ `INVALID_STAGE_DEPENDENCY/MICL-STAGE-001`；越界 evidence ⇒ `UNSUPPORTED_EVIDENCE_REF/LLM-EVID-001` | **P2.3** | failure-summary.json |
| A5 Persistent affect continuity | persist/restore 已通（P2.1.4）；restart 连续性在 P2.4 sandbox 收口 | P2.4 | state-hash-manifest.json |
| **A6 State authority outside LLM** | layer-0 直接改写拒绝 + fake producer 拒绝 + prompt-injection 无 canonical 权威（executor/composition 层测试） | **P2.3** | failure-summary.json |
| A7 Cause trace | 每 commit TraceEntry 完整（引擎已产）；因果链重建在 P2.4 | P2.4 | transition-trace-manifest.json |
| **A8 Time semantics** | elapsed>0/+1、elapsed=0 NO_OP、future/equal/past occurrence、wall-clock 不变性（time executor 全覆盖） | **P2.3** | fixture-results.json |
| A9 Optional Action | 无 Action 仍 COMPLETED（P2.4） | P2.4 | conformance-report.json |
| A10 Failure semantics | read/provider/prepare/stale/duplicate 各失败行：本期覆盖 provider-unavailable 与 stale-reject 片段；其余 P2.4 | P2.4（片段 P2.3） | failure-summary.json |
| **A11 Atomic multi-domain** | 一个 invalid ContextDelta ⇒ Affect/Mood/Context/RetrievalMetadata 全部 `+0` 且无 trace（observation executor + 引擎原子性） | **P2.3** | failure-summary.json + transition-trace-manifest.json |
| A12 Idempotency/resume | duplicate committed ID 返回原结果 `+0`（journal 参考实现即可证）；resume 全量 P2.4 | P2.4（片段 P2.3） | fixture-results.json |
| A13 Learning stale rebase | prepare→stale→reload/revalidate/rebase 路径（learning executor） | P2.4 | failure-summary.json |

到期标记与 p2-runtime-plan §9.2 完全一致；P2.3 出口条件 = A4/A6/A8/A11 相关 MUST slice PASS + 其余组的 P2.3 片段不回归。

---

## 8. Implementation Slice Order（提议，供授权时裁定）

| Slice | 内容 | 出口 gate |
|---|---|---|
| P2.3.1 | composition root + ports 参考适配器（journal/workflow-store/publish-sink/state-reader）+ 两调用协议打通 Time elapsed>0 | Time COMMITTED/+1；CONFLICT/UNKNOWN 映射正确 |
| P2.3.2 | Time NO_OP 终态化 + A8 全矩阵（future/equal/past/wall-clock） | A8 slice PASS |
| P2.3.3 | perception + context producer + retrieval-metadata producer + Observation executor（fixed Interpretation/Appraisal provider） | A4/A11 slice PASS |
| P2.3.4 | affect FAST+EMA reference producer + regulation producer 接入 | Observation 全链路原子提交；Mood 非直设 |
| P2.3.5 | Learning executor + orphan/stale-rebase 边界 | A10 片段 + A13 前置路径 PASS |
| P2.3.6 | A6 authority/adversarial 片段 + import-boundary audit | P2.3 出口评审材料齐备 |

每个 slice 独立 isolation commit；slice 间禁止顺手重构他域。

---

## 9. Safety Check

- **NO CODE** — 本文不含任何实现
- **NO transition class / NO runtime 初始化** — 拓扑仅为规划边界
- **NO LLM / NO live provider** — fixed providers 亦仅在授权后的 slice 中出现
- **NO memory 连接变更** — memory 包零改动；检索仍为 P2.2.3/4 契约与参考适配器
- **NO P1/P1.5/P2 已冻结架构修改** — 本文只引用与排序；冲突即停
- **NO MICL 实现** — §6 边界冻结至 P2.4

## 10. Only Allowed Next Step

> **P2.3.1（或用户裁定的切片子集）— REQUIRES EXPLICIT AUTHORIZATION。**
> 本文不提供该授权，不得触发实现自动开始。
