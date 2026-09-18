# CURRENT_STATE.md — CharacterOS-Next 当前状态

Status: ACTIVE
Authority: 本文件是仓库“现在是什么、做到哪里、下一步是什么”的唯一实时状态入口。
Last verified against commit: `ca097c5`（research commit；`REPLY_CRITICAL_LATENCY_FORENSIC_V0` 的 production 提交是其直接子提交。§2 的机器派生计数仍以 `d4503cc` 为准，未在本 slice 重新测量）
Workspace projects: 15
Purpose: 记录可执行代码、当前测试与已提交冻结证据共同支持的最小事实；历史计划不能覆盖这些事实。
Verified date: 2026-09-11

> 权威顺序：当前可执行代码与测试 → 已提交冻结证据 → Git 历史 → 仍与实现一致的架构契约 → 项目状态叙述。README、ROADMAP、RESEARCH_STATE 与 NEXT_ACTIONS 不再各自维护一份完整阶段状态。

## 1. CharacterOS-Next 现在是什么

CharacterOS-Next 是一个 strict-ESM TypeScript/pnpm workspace，也是一套长期人工主体研究运行时。它已经包含可复用的 canonical state/commit authority、Memory、Retrieval、Appraisal、Canonical Affect、Cognition、Language、Experience/Learning、持久化恢复与 subject-session orchestration。

它仍是研究型工程系统，不是已经证明具备通用长期主体能力的生产产品。真实模型结果只在各冻结实验的模型、场景、样本与判据边界内成立。

## 2. 机器派生的仓库快照

以下数字为 2026-09-10 在本治理修复 worktree 上实测所得。reality baseline（修复前的干净提交，也是本文件的机械核对起点）是 `d4503cc`；发生变化的行同时标注修复前的值。

| 项目 | 事实 |
|---|---|
| Workspace | 13 个 `packages/*` 包 + `product/sandbox`，共 14 个 workspace |
| 可复用 TypeScript | `packages/` 与 `product/` 中 234 个 tracked non-test `.ts` 文件 |
| TypeScript 覆盖 | 496 个 tracked `.ts`；487 个被 typecheck project 覆盖，9 个为书面理由 exclusion，0 uncovered（拆分见 2.1） |
| 测试源码 | 140 个 tracked `.test.ts` / `.spec.ts` 文件（修复前 139） |
| 测试结果 | Vitest：136 files passed、1 skipped；1963 tests passed、3 skipped（修复前 135/1958） |
| Build | 14/14 workspace 通过 |
| Typecheck | workspace source project 14/14 通过；evals/research/root-tooling auxiliary project 通过 |
| Lint | `pnpm lint`（`--max-warnings 0`）0 errors、0 warnings（修复前 8 errors、1 warning） |
| CI | `.github/workflows/ci.yml` 存在且执行真实 gate 命令；本地逐条通过；远程 GitHub Actions 执行未在本地验证 |
| 研究资产 | 17 个 `research/experiments/*` 目录、4 个 `research/diagnostics/*` 目录 |
| 研究文件 | 993 个 tracked experiment files、192 个 tracked diagnostic files |
| LICENSE | 未声明；属于用户/法律决策，本次不代选 |

这些是仓库现实计数，不等于生产成熟度或科学效力。

### 2.1 工程门禁现实

- `pnpm verify` 按固定顺序执行全部本地 gate：`governance → typecheck → build → typecheck:auxiliary → lint → test`。CI 执行同一顺序，并由 `pnpm governance` 断言两者都不遗漏、不错序。
- `pnpm typecheck` 是 source-mapped workspace project，在**冷树**（无任何 `dist/`）上即可通过；这是 R2-K / ATTACK I 回归所保护的性质，`scripts/cold-typecheck-regression.ps1` 会先删除全部 workspace `dist`，再运行 `typecheck:workspaces` 验证它。
- `pnpm typecheck:auxiliary` 覆盖 evals/research/root tooling，并解析各 workspace 已构建的 `dist` 声明，因此**必须在 `pnpm build` 之后运行**；它不参与冷树保证。
- 修复前的 lint 债务包含一个真实缺陷：某 experiment CLI 存在未终止字符串，导致该文件解析失败，从而掩盖了同一文件内 30 处既有规则违规（修复该字符串后实测 38 errors）。该文件按仓库既有惯例（隔离 experiment harness 的文件级 `eslint-disable` 加书面理由）处理，其余违规为逐条真实修复。
- **唯一的 typecheck exclusion 是 contract conflict 的结果**：四个 conformance 套件（`affect-state-retention-e1`、`affect-activation-mapping-e2a`、`affect-production-shaped-e2`、`familiarity-causal-behavior-v1`）以 durable law 强制 `research/experiments/familiarity-causal-behavior-v0/` 下每个 Git blob 与其冻结 baseline 逐字节相同。该实验冻结于更早的 production cognition-projection 类型面，其 `adapter.ts` 已无法接受当前 `CognitiveContextProjection` union。修文件会破坏冻结 blob law，修 law 会修改冻结 contract，因此 `tsconfig.auxiliary.json` 以书面理由排除该实验及其 conformance test；它仍在 vitest 中真实运行。修复 frozen experiment 与 production 类型演进之间的关系是未决的 research-infrastructure 决策，不在本 slice 内。覆盖率拆分：`tsconfig.workspaces.json` 352 个（`packages/` 351 + `product/` 1），`tsconfig.auxiliary.json` 135 个（research 116、evals 18、`vitest.config.ts` 1），exclusion 9 个（该实验 8 个模块 + 1 个 conformance test；其 `contract.ts` 因被 v1 测试引用而仍在覆盖内）。
- 同一 durable law 也拒绝在 `research/diagnostics/`、`research/hypotheses/`、`research/emotion/`、`research/memory/`、`research/plasticity/`、`research/appraisal/` 这些只含 `.gitkeep` 的占位目录下新增文件。因此 hypothesis registry 位于 `research/README.md`，而不是 `research/hypotheses/README.md`。

## 3. 当前能力与成熟度

| 能力 | 当前判定 | 边界 |
|---|---|---|
| SubjectState 与 canonical commit authority | `IMPLEMENTED` / `MECHANICALLY_VERIFIED` | 单写入口、validation、hash/trace、atomic commit、restore 均有实现与测试 |
| Memory repository、revision 与 retrieval | `IMPLEMENTED` / `MECHANICALLY_VERIFIED` | 包含 durable revision、可验证引用、repository-backed retrieval 与 provider-readable factual-memory surface |
| Appraisal 与 Canonical Affect | `IMPLEMENTED` / `EXPERIMENTALLY_SUPPORTED` | 确定性校验与 reference affect path 已实现；不代表 canonical emotion theory 或心理学真实性 |
| Cognition provider pipeline | `IMPLEMENTED` | 模型只产生受校验 proposal，不能成为 canonical state authority |
| Language behavior | `IMPLEMENTED` / `PARTIALLY_VALIDATED` | current intent 到受校验 language behavior 的生产路径已接通；外部效度仍受模型与场景限制 |
| Behavior → Experience → Memory feedback | `IMPLEMENTED` / `EXPERIMENTALLY_SUPPORTED` | 已有冻结的端到端因果链证据；结论受对应实验契约约束 |
| Persistence、durable history 与 restore | `IMPLEMENTED` / `MECHANICALLY_VERIFIED` | 当前长程验证的两次 authority restore 均 exact |
| Longitudinal multi-episode life | `IMPLEMENTED` / `EXPERIMENTALLY_SUPPORTED` | 冻结的四 episode 验证支持多 episode retrieval 与一次 post-restore continuity；不是任意时长证明 |
| Long-horizon subject session orchestration | `IMPLEMENTED` / `EXPERIMENTALLY_SUPPORTED` | 真实 8-interaction run 在显式 context budget 修复后完成 8/8，2/2 authoritative restore exact；结论受该模型/配置边界约束，不代表任意时长可扩展 |
| Interactive persistent subject runtime | `IMPLEMENTED` / `SMOKE_VALIDATED` | `product/sandbox` 本地 CLI：真实用户文本经既有生产 lifecycle，completed turn 成为 durable lived history；真实进程重启后 authoritative restore 同一 subject（revision 连续），pre-restart factual Memory 经生产 retrieval 进入 post-restart provider-visible evidence。bounded real-provider smoke（`qwen3.5:9b`, 8192/2048），不代表长期可扩展或人格真实性 |
| First-turn / observation-sourced lived memory | `IMPLEMENTED` / `SMOKE_VALIDATED` | 全新 subject 的首条用户消息（无 delivered-behavior parent）经既有 generic Observation→Experience→Memory path 成为 durable lived history；无 fake delivery/behavior/reply parent，无 reward/learning 信号，无 appraisal/affect 重复；每个用户事件恰好编码一次；重启后 retrieval 命中并以 "user stated X" 形式进入 provider evidence |
| Persistent subject configuration | `IMPLEMENTED` / `SMOKE_VALIDATED` | `product/sandbox` CLI 首次运行交互式创建唯一持久 subject（确定性 filesystem-safe subject_id、canonical display_name/anchors）；原子 `subject-config.json` 仅作目标标识，canonical snapshot/restore 才是 authority；config/snapshot 冲突、malformed/unsupported、`PRESENT` 但 snapshot 缺失均 FAIL CLOSED；setup 不产生 Memory；display name 不进入 provider prompt |
| Explicit counterpart feedback ingestion | `CONFIRMED` / `SMOKE_VALIDATED` | 显式用户反馈（"that fixed it" / "that didn't solve it" / 纠正）经既有 BehaviorOutcomeFeedback 路径成为事实证据：绑定 DELIVERED delivery + delivered behavior 全文 + 精确 reply 文本 + 时间；closed schema 无 reward/sentiment/trust；不修改 Affect/Belief/Relationship/Personality；无新 Experience kind / Memory schema；无 `/feedback` 命令 |
| Read-only lived memory inspection | `IMPLEMENTED` / `SMOKE_VALIDATED` | `/memory` 输出 canonical durable episodes 的安全事实投影（复用既有 evidence resolver），按 occurrence 时序，默认最近 10 条（`/memory N`，上限 100）；observation 显示 counterpart 语句原文，behavior-outcome 同时显示 delivered behavior 文本与精确 user reply；严格只读（无写入、无 revision/index 变化、0 provider generation call）；不暴露内部 ref/payload/prompt；读取失败 fail safely |
| Appraisal content availability | `LEVEL_1` | provider input projection 追加式包含 `current_observable_scene`（当前事件 committed observable scene）；不同内容 → 不同 provider input/hash；仅当前事件，无 transcript/Memory dump |
| Content-sensitive appraisal | `IMPLEMENTED` / `SMOKE_VALIDATED` | model-backed host appraisal provider（frozen strict prompt）：每个 factual event 1 次本地 model call，只提出六个 canonical dimensions + confidence；adapter 从 trusted context 组装 authority 字段（模型无法伪造 identity/refs）；untrusted-data delimiter；malformed/out-of-range/invalid enum 由既有 validator fail-closed（无 clamp/repair/constant fallback）；Level 2 PASS（deterministic + real smoke 不同内容 → 不同 lawful proposal）；Level 3 PASS（既有 canonical Affect 方程产生不同 Affect）；appraisal/cognition/language 分开计数 |
| Lived-history → behavior differentiation | `CONFIRMED` / `CAUSALLY_VALIDATED` | 受控双历史（同 genesis/identity/model/task，仅经历不同）+ authoritative restart：Level 1 历史持久且不同；Level 2 相同 current event 下 cognition request identity 不同；Level 3 current_intent 与可观察 behavior 不同；Level 4 非 Memory 状态（canonical Affect）因果参与（common-event appraisal 相同、Affect 持久不同且被投影）。Belief/Relationship/traits UNCHANGED（无 lawful producer）。**production behavior change = 0** |
| Local persistent-subject product | `IMPLEMENTED` / `SMOKE_VALIDATED` | `product/sandbox` 本地 CLI 组合既有 frozen seams：一个持久 subject、一条 canonical life。同一 session 内 talk / observe（结构化外部观察）/ environment / time（显式 canonical ticks）/ state / life / memory；ONE shared canonical subject source 跨 context（human/environment/external observation），每次外部推进后 session re-adopt；真实进程重启恢复同一 subject。P1–P8 PASS；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE = FROZEN`（产品里程碑，无新 runtime authority）。自动化验收用 deterministic fakes（0 real provider calls） |
| Provider resilience & diagnostics | `IMPLEMENTED` / `SMOKE_VALIDATED` | 产品层 provider observability：per-stage `running/done (latency)` 进度、`/diagnostics`（model/timeout/每 stage 状态/延迟/失败类别）、失败分类（UNAVAILABLE/TIMEOUT/MALFORMED/REJECTED/INTERNAL）、失败 turn 的 stage + persistence SAFE/PARTIAL + revisions + pending + suggested action、model 缺失 preflight fail closed、`/exit` 在失败后仍安全、provider 独立 `/time` 在 outage 下可用；无 semantic fallback；不写入 canonical state（进程本地、重启重置）。D1–D8 PASS |

`FROZEN` 描述已提交协议/证据的不可变性，不自动提升其结论等级。

## 4. 已冻结但有边界的最新结果

两项真实运行都必须同时保留：

`LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0`（原始失败运行，永久不变）：

- real-provider validation：第 7 次 interaction fail closed，完成 6/8；
- durable Memory commits：6；authoritative restores：2/2 `EXACT`；
- principal verdict：`LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED`；
- 失败机制：隐式 Ollama `num_ctx = 4096`（prompt 3568 + generation 528 = 4096，provider `truncated = 1`）。

`LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0_REVALIDATION`（post-repair 运行）：

- 同一冻结 8-interaction plan（plan identity `SAME`，`alice-environment.ts` 逐字节相同）；
- 唯一变量：cognition provider 的显式 `context_window_tokens = 8192`（`num_predict` 仍为 2048）；
- 8/8 interactions 完成、8 次 durable Memory commits、2/2 restore `EXACT`；
- E7 prompt 与失败运行完全相同的 3568 tokens，但本次 generation 831 tokens、`done_reason = stop`、JSON 有效；
- E8 total sequence 4933 / 8192，无截断；
- principal verdict：`LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_REVALIDATED`；
- 已登录限制：该 run-of-record 的 session-level `provider_request_identity_match` 字段因 revalidation harness 的 trace wiring 缺陷全为 false；request identity 性质本身由 crash-safe per-call ledger 直接验证（16/16 rendered == native transport，含 `num_ctx`）。缺陷已修复，run 未重跑，raw evidence 未改写。

原始 6/8 失败证据不得被改写为完整成功；post-repair 8/8 也不得被外推为任意时长或跨模型能力。

## 5. 当前 blocker 与暂停项

原 blocker（隐式 4096 context 导致 E7 截断）已通过 `COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0` 修复并被上述 revalidation 正面关闭。当前没有已知的 session-capability blocker。

`BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 = PAUSED`（暂停，不是裁定）。

- 暂停理由：`frozen calibration readiness not met under the tested executor contract` —— 冻结协议要求 50 次 calibration 抽样中至少 48 次 host-valid；post-parity formal calibration 未达该下限，按既有 early-stop 规则终止（`STOP_EARLY`），结果已被 CONSUMED，因此 **Primary 仍未获授权**（`PRIMARY_AUTHORIZED = FALSE`）。
- 记录到的 formal 事实仅限：`FORMAL_INVALID_TRIALS = [43, 44, 49]`；`FAILURE_CLASS = MODEL_SCHEMA_INVALID`。
- `FORMAL_EXACT_FAILURE_RULE = UNKNOWN / NOT_PERSISTED`：trials 43/44/49 各自被生产 validator 判为 invalid 的**具体规则未被持久化**，因此 `CALIBRATION_FAILURE_ROOT_CAUSE = NOT_IDENTIFIED`。不得为本 formal calibration 指定任何具体 format/type 机制。
- 该暂停**不表示** Belief 命题无效、DeepSeek 不可用、CharacterOS 受阻，或产品 runtime 应当停止。它只是冻结协议与当前 executor contract 之间的 readiness 判定。冻结实验文件与 evidence 保持不可变，未改写任何历史结果。
- 产品侧现状（与上述科学记录分离）：产品 runtime 采用 `TOLERANT_EXTERNAL_OUTPUT + STRICT_INTERNAL_STATE`。这是 **PRODUCT ROBUSTNESS POLICY**，不是对本 formal protocol 的追溯性科学修改，也不能用来反推 43/44/49 的根因。任何未来的 confirmatory 重新执行都需要新的 preregistration 与新的批准点，本文件不授权启动。

以下两条是与 formal calibration **分离的** exploratory diagnostic 所捕获的机制。它们各自有自己的 authority、自己的 evidence 边界，**不得**被追溯归属于 formal calibration 的 trials 43/44/49：

1. 旧 authority 下的 exploratory diagnostic 捕获到：`clarification_basis.missing_information` 超过 256 Unicode code points。
2. post-parity exploratory diagnostic 捕获到：`communication_directive` 的 outer type invalid —— bare string 而非要求的 object。

```text
THESE ARE EXPLORATORY CAPTURED MECHANISMS.
THEY MUST NOT BE RETROACTIVELY ATTRIBUTED
TO FORMAL CALIBRATION TRIALS 43/44/49.
```

同样必须与前者分离的是一次独立的工程 capability probe，而不是 formal calibration 的组成部分：

- **Formal calibration** 使用 `response_format = {"type":"json_object"}`（即 OpenAI-compatible JSON object 模式），**没有**使用 strict `json_schema`。
- **Separate engineering capability probe**：在之后的一次独立 probe 中，`response_format.type = json_schema` 在当时被测 endpoint 上返回 HTTP 400 `This response_format type is unavailable now`。该观察的正确结论只能写作 `STRICT_JSON_SCHEMA_RESPONSE_FORMAT_UNAVAILABLE_ON_PROBED_ENDPOINT_AT_PROBE_TIME`；它是 probe 时点的 endpoint 特性，**不是** formal calibration `STOP_EARLY` 的直接原因，也不能作为其解释。

`BELIEF_LIVED_EXPERIENCE_CLOSED_LOOP_V0` 已在产品层完成（0 model calls），并修复一个真实 wiring gap：conversation-feedback episode 只记录 host scene label（`conversation-feedback-v0`），其事实存放在被引用的 experience/ingress record 中，因此 belief semantic provider 在 subject 第一轮之后只能看到常量 label，普通对话中的后续 lived evidence 无法被分类。现在 host 用**与 cognition 路径同一个已验证 resolver** 渲染该 episode 的 factual content（精确 delivered behavior text + 精确 outcome reply text），provider 据此分类内容而非 label；未提供 resolver 时行为与之前完全一致。产品层 A/B acceptance（`product/sandbox/src/belief-lived-experience-loop.test.ts`）：首次 lived evidence → canonical proposition admission（host 派生 identity、初始 credence 0.55）；第二次 lived evidence → 既有 frozen ±0.05 plasticity（A 相反证据 0.50，B 支持证据 0.60，同一 proposition identity）；restart 后精确恢复；后续 cognition 在相同 scene 下分别携带各自的 canonical belief；无跨 subject 泄漏；harness 0 直接 state mutation。这是产品集成结论，不构成 Belief 命题的科学确认。

`LONGITUDINAL_INTEGRATED_SUBJECT_TRAJECTORY_V0` 已完成（0 model calls，纯 acceptance，无新 core feature）：一个 subject（Alice，40 lived events、3 次 fresh restart）与一个 control（同 genesis、同 turn 数、同 doubles、同 final scene，仅关键事件内容不同）在同一个确定性 harness 中走过多个 state channel —— Memory（44 episodes：40 conversation + 4 structured observation）、Affect（79 次已提交 AffectApplication，valence 依法饱和到边界）、Belief（同一 proposition：admission 0.55 → Alice 3 次 CONTRADICTS 至 0.40，Control 3 次 SUPPORTS 至 0.70）、Relationship（同 counterpart 持续 accrual）、Personality（acquired dimension 依法上升）。restart 后 revision/repository/episodes/affect/beliefs/relationship/personality 精确恢复；belief transition 的 evidence refs 全部指向该 subject 自己的 durable episode（无 dangling provenance）；重复提交同一 source identity 得到 REPLAY 且 episode 数不变；working retrieval 有界（< episode 总数）；Alice/Control 的 final scene 行 byte-identical，但其 cognition 输入因各自 durable 历史而不同（affect 行、proposition identity、credence 均不同），0 cross-subject ref；同 scene 下 deterministic follower channel 交付文本不同（标注为 deterministic channel property，非模型结论）。**未发现需要修复的 core bug**；harness 自身两次被现有法律挡住（同一 data root 双 writer 的 CROSS_CONTEXT_STALE_WRITE 与 source-quote 必须绑定自身 source），均按法律修正测试而非绕过产品。

VISION MODALITY 已接入同一产品 session（camera only；`VISION_PRODUCT_SESSION_INTEGRATED` + `CAMERA_PERCEPTION_INTEGRATED`，`SCREEN_PERCEPTION_NOT_IMPLEMENTED`，0 model calls）：capture 为**按需单帧**（用户点击 Look，无连续视频、无 interval 模式）；frame 经可注入的 `VisualPerceptionPortV0`（默认 UNAVAILABLE；`CHARACTEROS_VISION_URL` 本地适配器，`POST /perceive`）得到**最小结构化 perception candidate**（scene / objects / visible_text / confidence），再经**既有** structured-observation ingress（`source: camera`、content-derived event ref 复用既有幂等，同一帧为 REPLAY）成为该 subject 的 lived experience，进入 Memory 与 `/life`。Provider 不是 authority：不写 Belief/Affect/Memory/Relationship；不识别身份（无 face recognition、无 biometrics）；不推断敏感属性；视觉不直接改 Affect。失败律：camera 权限失败、capture 失败、provider 失败、invalid perception 均 **0 subject mutation**；raw frame **不持久化**（仅在请求内存中）。

VOICE MODALITY 已接入同一产品 session（`VOICE_PRODUCT_SESSION_INTEGRATED`，0 model calls）：voice 只是 input/output modality —— 录音经 STT 成为文本候选，文本走与 typed 完全相同的 `submitHumanText` 路径（同一 subject、同一 life、同一 operational transcript，行内新增 additive 的 `input_mode: typed|voice`），TTS 只朗读本轮 FINAL delivered text（degraded 时朗读 host 固定安全句，绝不朗读被拒的模型输出）。边界为可注入端口：`CHARACTEROS_STT_URL` / `CHARACTEROS_TTS_URL`（可选 `CHARACTEROS_VOICE_TOKEN`）指向本地服务，未配置即 UNAVAILABLE 且不影响文本产品。失败律：STT 失败 = 0 subject mutation；TTS 失败 = 已完成 turn 不回滚、回复仍以文本可见。隐私：仅在用户主动点击后请求麦克风、停止即释放 stream、**不持久化 raw audio**；不做 voice identity/prosody 推断。Voice 不创建任何 voice-specific state/memory/authority。Vision 仍未接入。

`PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0` 已实现（product shell，0 core semantic change，0 model calls in tests）：视觉产品现在是**多 subject 的持久主体产品体验**。sandbox 的「一个 data root 一个 persistent subject」法律不变，产品 shell 为每个 subject 分配独立 data root（默认 `<CHARACTEROS_DATA_DIR>/subjects/<subject_id>/`）：创建走真实 genesis，打开走真实 restore，切换 subject 会关闭旧 runtime 并打开新 runtime。新增 HTTP 端点：`GET /api/subjects`（列表 + active）、`POST /api/subjects/create`、`POST /api/subjects/open`、`GET /api/life`（含 evolution projection）、`GET /api/transcript`。对话历史来自该 subject 自己的 append-only operational log（`subject-<id>.interactions.jsonl`，thin product transcript：仅 UI 视图，不是 identity/Memory authority，缺失或损坏不影响主体）。UI 增加 subject 列表/创建栏、对话历史、Life 面板（lived events + durable transitions + 当前进入 cognition 的来源）与 developer details 开关（refs/revision/executor）。验收 P1–P10 全绿，其中 P5/P6 用真实 runtime 跨进程重启证明同一 subject 被 RESTORED 并继续；Voice/Vision 未接入同一 session（如实记录，非本 slice 门槛）。

`SUBJECT_EVOLUTION_VIEW_V0` 已实现（read-only product projection，0 model calls）：在既有 `/life` 上增加两个只读区块 —— **Durable changes (source-bound)** 与 **Currently available to cognition (source identity only)**。它回答「为什么这个主体现在是这样」，全部来自既有 durable sources：Affect 用已提交的 AffectApplication transition 自身记录的 `cause_refs = [appraisal_ref, factual_event_ref, source_observation_ref]` 与其 `/affect` 值（before 取同一 lineage 上一个已记录应用值，无则 null）；Belief 用 durable belief workflow record 的 evidence bindings 与已提交 plasticity receipt（admission 路径取该 record 自己持久化的 proposal checkpoint：host canonical label / proposition key / initial credence，proposition id 由 host identity law 从 key 派生）；Relationship 与 Personality 的 canonical item 没有 provenance 字段、也没有可读 receipt，因此**如实显示 `source attribution: UNAVAILABLE` 并给出理由**，不猜测。严格只读：无 provider 调用、无 adaptation、无 pending 消费、无 revision 变化；删除该 projection 不影响核心行为。该 slice 不引入新 state、新 authority、新 durable schema 或 causal-graph engine；Belief confirmatory 仍 PAUSED。

`INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0` 已实现并通过 bounded real-provider smoke：真实用户消息 → 持久 subject session → 自动 retrieval → cognition → 可观察响应 → delivery/feedback → Experience → durable Memory → 关闭进程 → 新进程 authoritative restore → 继续同一 lived subject。该 slice 的 primary acceptance 全部满足。

已记录的 V0 限制（不是 blocker）：冻结 feedback 法只把「作为上一交付行为 counterpart reply 的用户消息」编码进 Experience/Memory，因此全新 subject 的第一条用户消息不会进入 Memory；host appraisal provider 使用固定最小 profile（Affect 不随内容变化）；某轮交付行为的 outcome Experience 在用户下一次发言时提交。

`INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0` 已实现并通过 bounded real-provider smoke：全新 subject 的第一条用户消息经既有 generic Learning path（Observation → EpisodicMemoryRecordV0 → Memory）成为 durable lived history；单次 pre-restart 交互即可在重启后被 retrieval 命中，并以 "user stated X" 的观测语义进入 provider-visible evidence。每个用户事件恰好编码一次；无 fake feedback。

`PERSISTENT_SUBJECT_CONFIGURATION_V0` 已实现并通过 bounded real-provider smoke：首次运行由 CLI 交互式创建唯一持久 subject（无 env/JSON 手改），配置只标识目标，canonical genesis/restore 仍是 subject reality；后续进程无 setup 询问、authoritative restore 同一 subject（identity 完全一致），first-turn Memory 仍可检索。

`REAL_COUNTERPART_FEEDBACK_INGESTION_V0` 已确认（`EXISTING_COUNTERPART_FEEDBACK_PATH_SUFFICIENT`）：显式用户反馈已由既有 BehaviorOutcomeFeedback 路径 lawful 表示为事实证据，无需新类型；真实 smoke 证明重启后 retrieval 将 delivered behavior 与精确用户回复一并暴露给 cognition。

`INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0` 已实现并通过 bounded real smoke（0 generation calls）：`/memory` 以只读方式暴露 subject durable lived history 的安全事实投影，输出前后 repository revision / state revision / interaction index / episode count 与 snapshot/log 字节完全一致。

`INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0` 已实现（Level 1 content availability）：appraisal provider input 现在携带当前事件的 committed observable scene，且确定、无 transcript/Memory 泄漏；产品 provider 仍 content-insensitive。

`CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0` 已实现并通过 bounded real smoke：不同事件内容经由既有 Appraisal→Affect authority 路径产生不同 lawful proposal 与不同 canonical Affect；appraisal / cognition / language 分开计数。

`PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0` 已完成并因果验证（无 production semantic 变更）：不同 lived history 经 authoritative restart 后，通过已存在的 Memory + canonical Affect → cognition projection，使同一 subject 在相同 current event 下产生不同的 cognition request、current_intent 与可观察 behavior；common-event appraisal 相同，排除 current-event 解释；Level 4 证明非 Memory 状态（Affect）因果参与。

`CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0` 已实现并通过真实本地 smoke：一个 CLI session 组合 talk/observe/environment/time/state/life/memory，ONE shared canonical subject 跨 context 连续，真实进程重启恢复同一 subject 的累积 life。`CHARACTEROS_CORE_V1_PRODUCT_BASELINE = FROZEN`（仅产品里程碑，不引入新 runtime authority）。

`CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0` 已实现并通过真实本地 smoke：turn 内每 stage 进度与延迟可见、`/diagnostics` 给出 model/timeout/stage 状态、model 缺失 preflight fail closed、失败后 inspection 与 `/exit` 仍可用；provider diagnostics 不进入 canonical state。

`CORE_V1_LONG_RUN_MONITORING_INFRASTRUCTURE_V0` 已实现并跑完第一批真实运行（`product/sandbox/src/long-run-checkpoint.test.ts`，默认 disabled，工程门禁仍为 0 model calls；`core_changes: []`）：harness 走**正常产品路径**（`createProductRuntimeV0` + 当前真实 executor configuration，无 substitution、无 benchmark），每 10 次交互一个 read-only checkpoint（revision / episode / affect / belief+credence / relationship / personality / retrieval / pending outcome / degradation / retry / restart），每 10 次交互一次 fresh restart 并在 restart 前后逐字段核对 durable state，另外在一次 fail-closed turn 之后做一次**有界**的 recovery restart（等价于 operator 重启 app），每次都记录 reason；每条交互后写 crash-safe progress artifact，批次结束写 `long-run-checkpoint-20`（summary，无 credential、无 hidden reasoning）。所有可疑现象按 `CORE_INTEGRITY / BEHAVIORAL / PRODUCT` × `BLOCKER / MAJOR / MINOR` 记录为 issue candidate，本 slice 不做任何修复。

第一批真实运行（subject `alice-longrun`，20 次真实交互、18 次 fresh restart、21 个 checkpoint、0 degradation、0 timeout）：前 4 次交互正常完成（latency 385–489 s），随后**连续 16 次**在同一个可复现的墙上 fail closed —— `MODEL_TRANSPORT_MODEL_OUTPUT_TRUNCATED`（`done_reason=length`、`prompt_eval_count` 7945–7953、`eval_count` 239–247、`num_ctx=8192`、`num_predict=2048`）。accumulated lived prompt 已经占满 8192 预算，只剩约 240 token 生成空间，proposal 写不完。root cause 是 **host context budget**（产品/executor 配置），不是 core 语义缺陷：frozen fail-closed 合同按规范工作并如实报告原因，没有写入任何 canonical state。可用的既有旋钮是 `CHARACTEROS_CONTEXT_WINDOW_TOKENS`（默认 8192）与 prompt/retrieval 预算，属于 product/config fix；本 slice 只记录，不修。

durable 完整性在本次运行中被正面证明：**健康** runtime 的 fresh restart 逐字段 EXACT（`restart_7`、`restart_18`），批次后独立 read-only restore 得到 `RESTORED` rev 71 / R23 / 8 episodes / affect 0.5329 / 1 belief 0.55 / relationship `entity:alice`，且 durable 文件 mtime 冻结在最后一次成功提交（09:02:43）—— 16 次 fail-closed turn **没有写入任何 durable state**，restore 本身也不写。运行中 16 条 `CORE_INTEGRITY / BLOCKER: restore mismatch` 经证据复核为**误分类**：mismatch 的 "before" 读的是刚 fail-closed 的 poisoned in-memory projection（rev 75 / R24 / 未提交的 affect），"after" 恢复到上一次健康提交（rev 71 / R23），两者相同的部分全部吻合；该 divergence 是失败轮未提交的 in-memory bookkeeping，restart 后被丢弃。分类修正记录在报告里，未改 core。另记录一个 long-run 观察：一次性 snapshot 随成功交互增长约 2 MB/turn（4 次成功交互期间 3.1 MB → 11.6 MB），属可扩展性观察、非缺陷。执行环境如实记录：本机 Ollama 0.34.1 的 CUDA payload 不完整（`cuda_v12/` 只有 2 个 DLL + 一个 `.tmp`）导致 `total_vram="0 B"`、模型 `size_vram=0`，全部真实调用跑在 CPU 上（prefill ~7950 token 约 200 s、decode ~5 tok/s，每轮 229–489 s）；app 自己已下载 0.34.2 更新但未安装（安装系统更新不在本 slice 授权内）。

`CORE_V1_FREEZE_STATUS = MAINTAIN`：本 slice 未修改 core，也未观察到可复现的 core 缺陷；长程运行暴露的是 host context budget 与 prompt 规模的问题，按 freeze law 走 product/executor/config fix。

`DEEPSEEK_EXECUTOR_LONG_RUN_V0`（Human decision：改用真实 DeepSeek API 作为产品 executor；只换 executor，不改 core）**已完成**：recon 确认产品已内建 cloud family（`CHARACTEROS_EXECUTOR=deepseek|ollama|auto`，既有 `OpenAiCompatibleTransportV0` → `POST {MODEL_API_BASE_URL}/chat/completions`，默认 model `deepseek-flash`、endpoint `https://api.deepseek.com`，credential **只**从环境变量 `MODEL_API_KEY` 读取且只暴露 presence），**未新增任何 provider**；credential 由 human 在运行时通过环境变量提供（仓库、artifact、log 中零出现，presence-only 记录）。`core_changes = []`，未改 context budget / retrieval / prompt。

真实运行（同一 `alice-longrun`，从 rev 71 / R23 / 8 episodes restore 后继续）：**20 interactions attempted / 13 COMPLETE / 7 fail-closed / 0 degradation / 0 timeout / 10 fresh restarts**（3 次 scheduled restart 与 FINAL_RESTORE 全部 EXACT；失败轮后的 recovery restart 里的 "mismatch" 是 poisoned in-memory projection，durable 未受影响 —— fail-closed 轮不写 durable state，独立批次后只读 restore 得到 RESTORED rev 191 / R62 / 21 episodes / affect 0.5354 / belief 0.70 / relationship `entity:alice`，与批次末状态逐字段一致）。状态变化全部由既有语义决定：episodes 8→21（每个完成轮恰一条），affect 0.5329→0.5354（累计 41 条已提交 AffectApplication），**belief credence 0.55→0.70**（4 条 durable transition，同一 proposition identity，真实模型分类），relationship 稳定单一 counterpart，personality 未新增（合法）；**context wall 0 次** → `DEEPSEEK_LONGRUN_CONTEXT_WALL_NOT_OBSERVED_AT_20_TURNS`（措辞严格：只说明该 cloud executor 在本 horizon 未撞同一堵墙，**不是** `CONTEXT_WALL_FIXED`）。

新增 monitoring（observability，非 core change）：`product/sandbox/src/provider-request-observer.ts`（fetch 层，精确 HTTP 请求数 / status / 耗时 / 字节数 / output budget / provider usage；**不记录 header、body、prompt、memory 内容或模型输出**，官方离线单测 4/4）+ harness 升级（命名 checkpoint、EXECUTOR/PRODUCT/CORE 失败分类、失败轮 durable 不变律、连续 2 次同类 context failure 即 STOP、cloud artifact 命名）。本批实测：**98 次 provider HTTP 请求 = 85 次 cloud `/chat/completions` + 13 次本地 `/api/chat`**（belief/relationship semantic 按产品设计仍走本地模型）；usage **input 214,414 + output 11,990 = 226,404 tokens**（85 次响应含 usage；本地响应不提供 usage → 如实 `NOT_AVAILABLE`）；每轮 wall latency min 3.6 s / median 10.6 s / p95 17.0 s / max 18.1 s（对照上一批 CPU 本地 Qwen 229–489 s/turn，仅作事实记录，不作模型比较结论）。

本轮记录、**未修**的两个真实 product findings（§32 OBSERVE FIRST）：(1) `deepseek-flash` 是 thinking-first 模型：在产品当前 output budgets 下每次调用把 completion budget 全部花在 reasoning 上并返回 **empty `content`**，frozen cloud transport 按设计 fail closed（第一次尝试 5/5 turns、8 次请求 100% 命中）；endpoint 原生支持 `thinking:{type:"disabled"}`，本批通过一个 operator 层的本机 pass-through proxy（`tmp/`，仅注入该字段，无 repo 改动）完成运行 —— 建议作为显式 product executor setting 并写进文档，或改用足够大的输出预算。(2) **6/20** 轮在 language 阶段被 frozen validator 拒绝（`semantic draft.evidence_refs[i]: refs not lexicographically sorted`，fail closed，无 bounded tolerance 路径），另 **1/20** 轮在 cognition 阶段被 `SOURCE_QUOTE is not an exact substring of every cited source` 拒绝；合计约 35% 的真实轮次因模型输出与冻结契约的格式/绑定规则不符而 fail closed（分类 PRODUCT/OUTPUT_CONTRACT，绝不归入 core），可复现，建议方向是 language 阶段获得与 cognition 阶段同类的有界容错，或在 prompt 中显式声明排序/绑定规则。行为观察（仅事实）：delivered replies 连贯且跟随上下文，thinking 关闭时 realized language 常近乎逐字复述用户话语。

`CORE_V1_FREEZE_STATUS = MAINTAIN`：本 slice 未改 core，未观察到需要重开 core 的 corruption / authority bypass / restore failure / cross-subject leak；两个 finding 均为 executor 输出质量与 product 契约容忍度问题。

`DEEPSEEK_PRODUCT_EXECUTOR_HARDENING_V0` 已完成（executor / product-output hardening，**core semantic changes = 0**；Memory/Affect/Belief/Relationship/Personality/Experience/Persistence/Authority 均未改动）：**F1** — thinking 开关成为正式产品 executor 能力：既有通用 OpenAI-compatible transport 新增 host-owned `provider_request_options`（在冻结字段**之前**展开，因此不可能改写 model/messages/temperature/max_tokens；缺省即不发送，其他 OpenAI-compatible provider 的请求字节完全不变，本地 native family 本来就有 `think: false` 且未受影响），产品配置以 `CHARACTEROS_DEEPSEEK_THINKING = disabled（默认）| provider-default | enabled` 拥有该设置且只作用于 cloud family，并在 `/config` 只读暴露；**不再需要任何 local proxy**，不改 credential、不硬编码 key、DeepSeek 专有逻辑不进入 core。**F2** — 语言阶段 `evidence_refs` 是 **set-like**（唯一 + 按字典序排序，repo 法律原文为 set-like ref array），因此唯一允许的结构化规范化是**表示层排序**：在冻结 validator 之前对声明字段做确定性 canonical sort，**不增、不删、不替换、不去重**（重复项仍保留并被 validator 拒绝），validator 之后照常运行；语言 prompt（v0/v1 与生产 v7–v10 的 prompt）显式写明升序字典序规则并给出 valid/invalid 例子，让模型知道规则而不是依赖 host 修复。SOURCE_QUOTE 保持语义化 fail-closed：validator 未改、无 fuzzy match、无 host 合成 quote、无新 retry；**对该 clause 的模型侧强化被尝试后回滚** —— 它改变了冻结 preregistered 请求字节（17381 → 17897），而历史 request identity 不可变（`research/experiments/**` 的 pin 全部恢复绿色），因此作为**未决 product decision 记录**，不静默生效。离线测试 E1–E8（0 model calls）：thinking 开关经真实产品路径发出、其他 provider 字节不变、空 content（即使带 reasoning_content）仍 fail closed、表示层排序不改变 ref 多重集且重复仍被拒、任何可能“修复”内容的路径都未被触碰、prompt 法律、无 credential 泄漏 —— 全绿；full gates 全绿（240 files / 2958 tests，0 model calls）。

真实 acceptance（同 `alice-longrun`，**真实 DeepSeek API、无 proxy、无 Ollama 作 executor**，`CHARACTEROS_EXECUTOR=deepseek` + `deepseek-flash`，10 次交互、5 与 10 处各一次 fresh restart）：**attempted 10 / COMPLETE 9 / FAILED 1 / degradation 0 / timeout 0 / rate limit 0**；失败分类 `failure_kinds = {SOURCE_QUOTE: 1}` —— **THINKING_EMPTY_CONTENT_FAILURES = 0**（F1 目标达成，且无 proxy），**EVIDENCE_REFS_ORDER_FAILURES = 0**（上一批 6/20），SOURCE_QUOTE 1 次（与上一批同量级），总 output-contract 失败率 **1/10 vs 上一批 7/20**。durable：rev 191→274 / R62→R89 / episodes 21→30（每个完成轮恰一条）/ affect 0.5354→0.7302 / belief 0.70→**0.80**（真实模型分类，proposition identity 稳定）/ relationship 单一稳定 counterpart / personality 未新增；restart 中 scheduled 全部逐字段 EXACT，独立的批次后只读 restore 得到 RESTORED rev 274 / R89 / 30 episodes，与批次末一致；fail-closed 轮未污染 durable（唯一 MISMATCH 仍是 poisoned in-memory projection）。counter 与成本：**56 次 provider 请求 = 47 次 cloud `/chat/completions`（全部 200，usage 可用）+ 9 次本地 `/api/chat`**（belief/relationship semantic 按产品设计仍走本地模型）；**input 107,974 + output 5,895 = 113,869 tokens**；每轮 wall latency min 3.4 s / median 12.6 s / p95 19.5 s / max 19.5 s。观察（**只记录未修**）：context wall 0 次、output truncation 0 次（`DEEPSEEK_LONGRUN_CONTEXT_WALL_NOT_OBSERVED_AT_10_TURNS`，仍非 `CONTEXT_WALL_FIXED`）；snapshot 45.6 → 69.0 MB（≈2.6 MB/completed turn，与上一批一致）；**affect.activation 触到上界 1.0（POTENTIAL_DYNAMIC_SATURATION 候选，valence 0.7302 仍在界内）**；delivered replies 连贯并跟随已积累的生活史，thinking 关闭后 realized language 仍会较贴近用户话语。

`CORE_V1_DEEPSEEK_LONG_RUN_CHECKPOINT_50` leg 已完成（real long-run operation，**core changes = 0**，只观察）：同一 `alice-longrun` 从 rev 274 / R89 / 30 episodes 成功 RESTORE 后，用真实 DeepSeek API（无 proxy、无本地 executor 替换、`CHARACTEROS_DEEPSEEK_THINKING=disabled` 走正式产品配置）继续 **20 次真实文本交互**（新的自然生活场景集：邻居的 gate、朋友的 bandsaw 建议及其被确认的后果、一次轻微分歧、日常与回忆），**5 / 10 / 15 / 20 各一次 fresh restart**：attempted 20 / **COMPLETE 19** / FAILED 1 / degradation 0 / timeout 0 / rate limit 0 / empty content 0 / output truncation 0 / context wall 0；失败分类 `{SOURCE_QUOTE: 1}`（§13 的 0–2 记录区间，未触发 `REPEATED_SOURCE_QUOTE_PRODUCT_ISSUE`），`EVIDENCE_REFS_ORDER_FAILURES = 0`（无 regression），其他 contract failure 0。所有 SCHEDULED restart 与 FINAL_RESTORE **逐字段 EXACT**（唯一 MISMATCH 仍是 fail-closed 轮后的 poisoned in-memory projection，durable 未被写入）；独立批次后只读 restore 得到 RESTORED rev 447 / R146 / 49 episodes，与批次末一致。durable：episodes 30→**49**（每个完成轮恰一条）、rev 274→447 / R89→R146、affect valence 0.7302→**0.8971**、belief 0.80→0.85→0.80（lawful ±0.05，同一 proposition identity，无重复/振荡）、relationship 单一稳定 counterpart、personality 仍未 acquire（合法）。**AFFECT ACTIVATION 观察（§8/§9）**：19 个 completed turns 的 activation **全部恰为 1.000**（START 前也已是 1.0），valence 在 0.73–0.90 间自然移动 —— 依确定性规则分类为 **`PERSISTENT_BOUND_SATURATION_CANDIDATE`**；但未观察到可归因的明显异常交付行为（回复连贯、跟随生活史），因此**只记录、不进入 adjudication、不改 Affect dynamics**。其他观察（只记录）：obvious near-verbatim mirroring 3/19（偶发）；snapshot 69.0 → **118.0 MB**，19 个完成轮共 +49.0 MB ≈ **2.58 MB/completed turn**，与上一批 2.6 MB/turn 同斜率 → `LINEAR_OBSERVED`（未做 persistence 改动）；provider 计数 **116 次请求 = 97 次 cloud `/chat/completions`（全部 200，usage 可用）+ 19 次本地 `/api/chat`**（adaptation providers 仍按产品设计走本地），**input 221,361 + output 12,653 = 234,014 tokens**，每轮 latency min 2.7 s / median 15.5 s / p95 19.0 s / max 23.4 s。SOURCE_QUOTE 的 prompt/validator 本轮未做任何改动（§28：不碰 frozen preregistered request bytes）。

`CORE_V1_DEEPSEEK_LONG_RUN_CHECKPOINT_100` leg 已完成（real long-run operation，**core changes = 0**，只观察；分两阶段 staged）：同一 `alice-longrun` 连续两批各 25 次真实交互（Stage A 用新的自然生活集 B、Stage B 用生活集 C —— 邻居的 gate、bandsaw 进给建议及其被确认的后果、oak 凳子项目、邻居的建议、垫片修稳、手酸提前收工、旧 workshop 聚会来信等），真实 DeepSeek API + 已 hardened 产品路径（无 proxy、thinking 由产品配置关闭、evidence_refs 仅表示层排序、SOURCE_QUOTE 严格）。**合计：50 次交互 attempted 且 50 次 COMPLETE、0 FAILED、0 degradation、0 timeout、0 rate limit、0 empty content、0 output truncation、0 context wall**；8 次 scheduled fresh restart（每 10 轮一次 + 每批末次）**全部逐字段 EXACT**，独立批次后只读 restore 得到 RESTORED rev 927 / R305 / 102 episodes，与批次末一致（fail-closed 轮 0 次，因此无 durable 污染）。durable：episodes **49 → 102**、rev 274→927 / R89→R305、belief 0.80→**0.95**（lawful ±0.05 三步，同一 proposition identity）、relationship 单一稳定 counterpart、personality 仍未 acquire（合法）、valence 0.7302→0.9934（Stage B 内在 0.941–1.000 间真实来回，**并非**贴死）；Stage A 结束时按 §25 判定 **CONTINUE_TO_100 = YES**（无 BLOCKER、无 repeated MAJOR、executor stable、persistence 可管理、subject coherent）。

**APPRAISAL PRESSURE 观察（本轮新增 monitoring，只读扫描 subject 自己的 durable snapshot，按 appraisal ref 与已提交 AffectApplication 精确 join）**：累计 203 个已提交应用全部 join 成功；`q = relevance × intensity` 分布 min 0.03 / median 0.105 / p90 0.35 / max 0.54；相对 1-tick cadence break-even `q* ≈ 0.0532` 为 **31 below / 172 at-or-above**（约 85% 在 break-even 之上）→ 与既有 `APPRAISAL_BIAS_SUSPECTED（NOT PROVEN）` 判断一致，本轮未新增 evidence 也不改 appraisal。**activation 内部序列**：end-of-turn 50/50 均为 1.000（bound contact 147/203 个应用），但 durable applied series 显示每次应用之间**真实跌破边界并回升**（例如 1 → 0.9976844 → 1，净变化 ±0.0023；1 → 0.9984344 → 1，±0.0016）—— 即 Time recovery 真实发生、只是常见 q ≥ break-even 使 impulse 补回边界。因此本轮 Affect 分类为 **`HEALTHY`**（intermediate recovery 真实存在、q 分布解释了贴边、无任何行为症状）；`activation_after_time`（decay 后中间值）与 clamp 原始值**未持久化**，如实记 `NOT_AVAILABLE`，不做重建。**无 AFFECT BEHAVIORAL SYMPTOM**（无 calm 场景过激、无 urgency/agitation、无 state-行为失配）。

其他观察（只记录）：snapshot 118.0 → **254.2 MB**（53 个完成轮共 +136.2 MB ≈ **2.57 MB/completed turn**，与前三批同斜率 → `LINEAR_OBSERVED`，未达 300 MB review 阈值，未改 persistence）；provider 计数 **299 次请求 = 249 次 cloud `/chat/completions`（全部 200，usage 可用）+ 50 次本地 `/api/chat`**（adaptation providers 按设计走本地）；**input 561,146 + output 30,251 = 591,397 tokens**；每轮 latency 随 episode 增长而上升（Stage A median 40.5 s → Stage B median 63.2 s / p95 117.3 s / max 122.1 s，单次调用 timeout 120 s 未触发）——记录为 latency watch；obvious near-verbatim mirroring 11/50（偶发）；SOURCE_QUOTE_FAILURES 0/50、EVIDENCE_REFS_ORDER_FAILURES 0（无 regression）；Stage A 开始时因 scanner 正则不容忍缩进 JSON 而作废的 3 轮交互仍作为真实生活保留在 durable history 中。环境记录：本地 provider 在批次结束后曾退出、为独立 restore 验证重启（期间升级到 ollama 0.34.2）；DeepSeek executor 与批次证据不受影响。

下一个产品 slice 是 `CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0`：read-only `/config`、首次运行引导与失败后可操作指引，不引入新 canonical state。该 slice 未启动，也不由本文件授权启动。

长程可扩展性（更长 horizon、context/记忆管理）是独立的未来产品问题；`8192` 只是本次验证的显式预算，不是永久充分性声明 —— 该预算不足如今已被真实 long-run 观察**证实**（见上：accumulated lived prompt 约 7950 token 时生成空间耗尽，subject 无法继续），修复方向是 host 显式提高 context 预算或收敛 prompt/retrieval 规模。

本文件不授权启动上述任一 frontier slice；它只记录状态。启动新 slice 需要其自身的问题、边界、调用预算与批准点。

## 6. 研究与证据现实

实验、诊断和其已提交 evidence 是本仓库的一等 tracked assets，主要位于：

- `research/experiments/**`；
- `research/diagnostics/**`；
- 各实验自己的 `evidence/**`。

不存在仓库根级 `evidence/`。`tmp/` 与生成中间物不属于冻结证据。历史 evidence 保持不可变；当前研究主张与方法限制由 `RESEARCH_STATE.md` 汇总，每个实验的精确允许结论仍以其冻结 contract/report 为准。

## 7. 文档职责

| 文档 | 唯一职责 |
|---|---|
| `CURRENT_STATE.md` | 当前仓库状态、成熟度、blocker 与下一项工作 |
| `README.md` | 项目入口、核心原则、目录和运行命令 |
| `ROADMAP.md` | 历史里程碑与未来路线，不复制实时阶段表 |
| `RESEARCH_STATE.md` | 当前研究主张、限制、失败与开放问题 |
| `NEXT_ACTIONS.md` | 当前 baseline、blocker、下一 exact slice、禁止项与升级条件 |
| `ARCHITECTURE.md` | 当前/目标架构与依赖边界；不承担进度播报 |

若这些文档对“当前实现到哪里”说法冲突，以本文件和可执行证据为准，并修正文档，不回退已验证实现。
