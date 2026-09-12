# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `1b6c913`（research commit；`APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0` 的 production 提交是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0` — 同一 human turn 内「完全相同 model-facing request」的重复 Appraisal inference 复用（纯 product 层，无 canonical 变更）。

- PHASE A 独立审计 V1 证据：判定 `V1_AUDIT_CONFIRMS_PRODUCTIONIZATION`。V1 = 15/15 paired、32 次真实 inference（17 A + 15 B）、2 次 A 侧 schema violation（`goal_conuence` / `goal_conguence`，均未重试/修复，B 未调用）；V0 树哈希与冻结值一致、V0 evidence 未被改写（immutable-write guard 重跑 10/10 通过）；20/20 组合 pair 的 request identity 完全相等且 event identity 不同、candidate 精确相等、authority/canonical/Affect/downstream cognition 等价；失效防火墙（grounding/stale/prepare/commit/subject/context/evidence/scope/config/prompt/order/budget/hash-collision）全部 FAIL CLOSED；I 独立重算 V1 冗余 B inference：n=15、min 2.33 s、p50 2.65 s、mean 2.69 s、p90 3.19 s、max 3.38 s、total 40.42 s；V0 的 13.92 s 不具代表性（同 prompt 规模下 V0 的 provider eval 本身即 11–16 s，机器层面原因未记录 = UNKNOWN）；research commit `1b6c913`（130 files，含 V1 原始 calls.jsonl/evidence/verifier/gates）。
- PHASE B 实现：turn-local `AppraisalInferenceReuseV0` port（per bundle/process/subject），仅缓存 7 个 model-generated 且通过严格 parser 的候选字段；provider 在构造出完整 request 后按完整 identity（messages + provider fingerprint）比对，命中则复用、未命中正常独立 inference；B 的 authority 字段仍全部由 B 的可信 context 重建；
- `CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE`（严格 0/1，非法值 fail closed，默认 0=OFF，`/config` 显示值与来源）；`/diagnostics` 与 web 抽屉区分 semantic invocations / real inferences / reuse hits，命中阶段显示 `REUSED`（0 provider latency，不伪造 transport 调用）；
- P1–P10 全 PASS（含 P6 确定性 OFF/ON canonical 等价、P4 scope/turn/subject/restart/config 防火墙、P5 失败不缓存）；真实本地 A/B：OFF 3 real inferences / turn2 prior-reply 10.1 s；ON 3 semantic / 2 real / 1 hit / turn2 prior-reply 0 provider time；两轮重启后 logical time、state/repository revision、Affect、Regulation 完全一致；真实模型语言输出在无 reuse 参与的 turn 1 上存在正常采样差异；
- 判定 `APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_GREEN_DEFAULT_OFF`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE` 保持 FROZEN。

上一个产品里程碑：

`CHARACTEROS_VISUAL_PRODUCT_WORLD_AND_DIAGNOSTICS_DRAWER_V0` — 可视化产品新增隐藏式 World & Settings / Diagnostics 抽屉（纯 wiring，无 canonical 变更）。

- D1–D10 PASS：默认隐藏的次级抽屉（`World`：结构化 external observation / deterministic environment / explicit canonical ticks；`Settings`：只读 config + 只读 provider diagnostics），主界面仍是 Character/Conversation/Life/State；
- 复用既有 frozen 能力：`submitExternalObservationV0`（FIRST/REPLAY/CONFLICT 原样呈现，不升级真值、不映射 wall-clock、不产生 ActionIntent）、`ProductLifeOperationsV0.environment`、`life.time`（0 仍是 NO_OP，永不标注 seconds/minutes/hours/days）、`ProductConfigurationV0`（只读、来源标注、endpoint 凭据打码）、`ProviderDiagnosticsV0`；
- 新增 bounded API：`POST /api/observation`、`POST /api/environment`、`POST /api/time`、`GET /api/config`、`GET /api/diagnostics`；无 `/api/execute` 泛化命令入口；沿用 body limit 与产品错误形状；
- 每次变更后前端重新拉取 authoritative bootstrap/state/memory（无乐观写入）；browser 仍不持有任何 canonical 权威；
- diagnostics 阶段状态新增 `CONFIGURED`（已接线但尚未调用），与 `DISABLED`（未配置）严格区分；
- 真实 smoke：真实模型下 FIRST→REPLAY→CONFLICT 全部正确、external observation 与 environment 均进入 Life、ticks 30 使 logical time 2→32 且 Affect 变化、0 为 NO_OP、config 只读且无秘密、diagnostics 有界；fresh-process restart 后同一 `mira-14aa8fc5` RESTORED 且 world-originated 经历保留；浏览器截图确认抽屉/表单/结果/只读视图；
- 判定 `CHARACTEROS_VISUAL_PRODUCT_WORLD_AND_DIAGNOSTICS_DRAWER_GREEN`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE` 保持 FROZEN。

上一个产品里程碑：

`CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0` — 第一个真实可视化产品：本地 Node backend + HTTP/SSE product API + 无框架浏览器 UI，一个持久 subject。

- W1–W10 PASS：`pnpm web` 启动本地产品（默认 `127.0.0.1:4188`，`node:http`，零新增第三方依赖），`product/sandbox` 保持 REFERENCE_PRODUCT/DEBUG_TOOL 不变；
- 复用面：新增 `createProductRuntimeV0` facade（配置解析 → preflight → open/restore → life ops → 串行 turn → shutdown）与共享 `createProductProviderBundleV0`（CLI 与 web 共用同一 provider 语义，杜绝分叉）；`ProviderDiagnosticsV0` 增加可选结构化 `observer`（与既有 `write` 同一 stage 真相）；
- 浏览器只持有 presentation state（草稿、会话消息、最近一次读取的 view、SSE 连接），Memory/Belief/Personality/Relationship/Affect/canonical Time/identity/revision 全部来自 backend，且不使用 localStorage/sessionStorage/IndexedDB；
- API 仅有 `/api/bootstrap`、`/api/status`、`/api/state`、`/api/memory?limit=N`、`/api/talk`、`/api/events`(SSE)、`/api/health`；静态文件为显式 allowlist（无路径穿越面），请求体上限 64 KiB，无 CORS；
- 真实 smoke：真实本地模型两轮对话（含 prior-reply stage）、SSE 进度、Life/State 更新、真实进程重启后同一 `mira-14aa8fc5` RESTORED 且 4 条 lived episodes 保留；浏览器截图确认 UI 渲染与 live stage strip；
- 判定 `CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_GREEN`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE` 保持 FROZEN。

上一个产品里程碑：

`CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0` — 产品层 turn 进度与本地延迟预期（纯 observability/presentation，无 canonical 变更、无 provider policy 变更）。

- T1–T8 PASS：turn 开始前打印一行 expectation（reply path 阶段数、language 条件性、optional adaptation、基于本进程成功样本的 rough reply estimate）；运行中按 group 编号 `[reply i/N stage]` / `[adaptation i/M stage]`；首次运行无样本时明确 `reply estimate unavailable (no successful local sample yet)`，从不把 configured timeout 当作预计时长；
- 从第二个 turn 起，runtime 会在本 turn 内 appraise 上一 turn 已交付的 reply（behavior-outcome closing）；该调用被如实编号为 `[prior-reply 1/1 appraisal]`，不会伪装成第二个 reply slot；完成行区分 total wall time 与 provider time，并拆分 reply / prior-reply / adaptation；
- language 为条件阶段（cognition 返回 CLARIFY 时 0 次调用）：header 明示可能跳过，跳过状态写入 `/diagnostics` 并出现在完成行，不在 live stream 中虚假预告；
- `/diagnostics` 扩展为 per-stage 状态/延迟 + 进程内 latency samples + last turn timing；personality（未配置）显示 DISABLED 且从不计入 pending/ETA；restart 重置所有样本；
- provider 顺序、eligibility、timeout、budgets、retry、selection 全部不变；latency 仅显示，不驱动任何语义，也不与 canonical Time 交互；
- 判定 `CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_GREEN`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE` 保持 FROZEN。

上一个产品里程碑：

`CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0` — 产品内只读有效配置与首跑引导（无第二配置权威、无 canonical 变更）。

- C1–C8 PASS：`/config` 只读呈现 effective model / endpoint / timeout / data root / subject id+name，并为每个值标注来源（`ENVIRONMENT` 变量名 / `DEFAULT` / `PERSISTED_PRODUCT_CONFIG` / `DERIVED`）；输出由显式 allow-list 构造，不 dump 环境，endpoint 凭据打码；
- 首跑输出紧凑 startup summary 与简短 actionable guidance；restored subject 呈现为「延续同一 subject」而非新建；provider READY 由已有 metadata preflight 得出（不额外生成）；
- provider unavailable / model missing / data root 不可用分别给出明确可执行指引（含「绝不自动下载/安装 model」）；malformed 数值与 endpoint 在启动时 fail closed 并给出 setting / received / expected / source，不再静默强转；
- `/config` 不改变任何设置或 canonical state；`/help` 同时列出 `/config` 与 `/diagnostics` 并交叉引用；README 含 prerequisites、配置表与 troubleshooting；
- 判定 `CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_GREEN`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE` 保持 FROZEN。

更早的产品里程碑：

`CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0` — 产品层 provider 韧性/诊断（纯 observability，无 canonical 变更）。

- D1–D8 PASS：每个 model-backed stage 打印 `[stage] running... / done (latency)`；`/diagnostics`（别名 `/provider`）显示 model、configured timeout、每 stage 状态/延迟/失败类别；失败按 `PROVIDER_UNAVAILABLE / TIMEOUT / MALFORMED / REJECTED / INTERNAL` 分类；失败 turn 打印 stage + persistence SAFE/PARTIAL + revisions + pending work + reason + suggested action；失败后 `/status /state /life /memory /diagnostics /exit` 仍可用；provider 独立的 `/time` 在 provider outage 下仍可用；无任何 semantic fallback；
- preflight 对「endpoint 可达但配置 model 缺失」fail closed（exit 1，给出 model id 与本地安装提示，绝不自动下载）；
- `/exit` 在失败 turn 留下 pending work 时仍立即安全退出，并明确报告未持久化的 partial work 会被丢弃；
- 判定 `CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_GREEN`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE` 保持 FROZEN。

此前能力保持 GREEN/FROZEN（product local product + belief/personality/relationship lived-evidence adaptation、external observation ingress、explicit canonical time、environment + cross-context continuity）：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0                    FROZEN / GREEN
INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0            FROZEN / GREEN
PERSISTENT_SUBJECT_CONFIGURATION_V0                          FROZEN / GREEN
REAL_COUNTERPART_FEEDBACK_INGESTION_V0                       FROZEN / GREEN
INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0                     FROZEN / GREEN
INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0            FROZEN / GREEN
CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0                      FROZEN / GREEN
PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0 FROZEN / GREEN
belief / personality / relationship lived-evidence adaptation FROZEN / GREEN
external structured observation ingress                       FROZEN / GREEN
explicit canonical time advance                               FROZEN / GREEN
environment + cross-context continuity                        FROZEN / GREEN
CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0               FROZEN / GREEN
CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0   FROZEN / GREEN
CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0        FROZEN / GREEN
CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0    FROZEN / GREEN
CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0                       FROZEN / GREEN
CHARACTEROS_VISUAL_PRODUCT_WORLD_AND_DIAGNOSTICS_DRAWER_V0    FROZEN / GREEN
APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0                     FROZEN / GREEN (DEFAULT_OFF)
CHARACTEROS_CORE_V1_PRODUCT_BASELINE                          FROZEN (product milestone)
```

## CURRENT BLOCKER

当前没有已知的 product blocker：P1–P8 与 D1–D8 全部满足。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. provider 不可用时 CLI 在 preflight fail closed（含 model 缺失）；turn 级失败 fail closed 并给出分类与安全摘要；无云 fallback、无自动切换、无自动重试。
2. 单次 turn 仍需 appraisal + cognition + language（+ 第二 turn 起的 prior-reply appraisal + lived-evidence adaptation）多次串行本地调用，实测约 31–55 s。当前唯一的 latency bottleneck 是 **reply-critical 的 Appraisal → Cognition 串行链**：本机实测两者合计约 30–32 s，占 reply path 的绝大部分；重复的 prior-reply Appraisal inference 已由 `APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0`（DEFAULT_OFF）消除，但该链仍不可压缩（无并行、无 fast mode、无 router，且 streaming/early-reply 未授权）。
3. 品牌-new subject 在第一个 lived event 之前没有 durable canonical state，因此 observe/time/environment 会先拒绝并给出提示。
4. Personality/Belief/Relationships 仅在对应 adaptation provider 被配置且 lawful 改变后显示；否则 `ABSENT`（不伪造默认值）。
5. 配置只读：`/config` 能查看 effective 值与来源，但修改 model/endpoint/timeout/data dir 仍需设置环境变量并重启（V0 明确不提供 `/config set`、不提供多 subject 选择）。
6. 无 Need/Goal、无 action execution、无 wall-clock 自动时间、无 camera/audio 原生解释。

## NEXT EXACT SLICE

只启动：

`CHARACTEROS_VISUAL_PRODUCT_SUBJECT_ONBOARDING_V0`

问题边界：可视化产品在首次运行时会用固定默认名（Mira）自动创建 subject，用户无法在 UI 内为自己的持久 subject 命名（CLI 可以）；下一步在浏览器内提供首次运行命名/确认（复用既有 `resolvePersistentSubjectV0` / `buildSubjectConfigForCreationV0` 与 subject-config.json 语义），不改 canonical 语义、不新增第二配置权威、不做多 subject 管理。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `CHARACTEROS_VISUAL_PRODUCT_SUBJECT_ONBOARDING_V0`：必须先确认其问题、边界与预算；
- 多 subject / multi-agent / shared world / GUI / voice / camera / avatar / tools / autonomous task execution；
- accounts / cloud sync / provider router / 自动模型切换 / 自动重试编排 / 云 fallback；
- `/set-*` god-mode setter、memory editor、memory search、Memory 汇总模型、personality/belief/relationship 编辑器；
- sentiment/positive-negative/toxicity classifier、named emotion、mood、reward/importance/salience 标量、cross-domain generic score；
- 新 Experience kind / Memory schema、retrieval semantics 或 persistence/restore authority；不得修改 appraisal dimensions/validation/equations 或 canonical Affect law；
- 对 frozen experiment source、raw output、result、report 或 evidence 的改写。

## ESCALATION CONDITIONS

停止并请求裁定，仅当：

1. 当前 executable behavior 与仍然有效的 frozen semantic contract 无法同时成立；
2. 修复必须改变 Affect、Appraisal、Memory、Retrieval、Cognition、Language、Behavior、Belief、Relationship、Persistence、Restore 或 Session semantics；
3. frozen raw evidence 必须被修改才能让门禁通过；
4. 新 slice 需要改变既有生产模型、prompt、retrieval 或调用预算，而不是单纯测量/编排；
5. license、外部发布、付费 provider 或其他用户/法律决策成为必要前提。

普通 stale documentation、lint debt、CI 缺失或命名冲突不构成语义升级理由。
