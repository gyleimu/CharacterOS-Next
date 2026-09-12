# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `a9ffc20382660e5a1ed70372c547120bb99c8841`（干净 baseline；本次 `CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_UX_V0` — 产品内只读有效配置与首跑引导（无第二配置权威、无 canonical 变更）。

- C1–C8 PASS：`/config` 只读呈现 effective model / endpoint / timeout / data root / subject id+name，并为每个值标注来源（`ENVIRONMENT` 变量名 / `DEFAULT` / `PERSISTED_PRODUCT_CONFIG` / `DERIVED`）；输出由显式 allow-list 构造，不 dump 环境，endpoint 凭据打码；
- 首跑输出紧凑 startup summary 与简短 actionable guidance；restored subject 呈现为「延续同一 subject」而非新建；provider READY 由已有 metadata preflight 得出（不额外生成）；
- provider unavailable / model missing / data root 不可用分别给出明确可执行指引（含「绝不自动下载/安装 model」）；malformed 数值与 endpoint 在启动时 fail closed 并给出 setting / received / expected / source，不再静默强转；
- `/config` 不改变任何设置或 canonical state；`/help` 同时列出 `/config` 与 `/diagnostics` 并交叉引用；README 含 prerequisites、配置表与 troubleshooting；
- 判定 `CHARACTEROS_PRODUCT_CONFIGURATION_AND_ONBOARDING_GREEN`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE` 保持 FROZEN。

上一个产品里程碑：

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
CHARACTEROS_CORE_V1_PRODUCT_BASELINE                          FROZEN (product milestone)
```

## CURRENT BLOCKER

当前没有已知的 product blocker：P1–P8 与 D1–D8 全部满足。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. provider 不可用时 CLI 在 preflight fail closed（含 model 缺失）；turn 级失败 fail closed 并给出分类与安全摘要；无云 fallback、无自动切换、无自动重试。
2. 慢机器上单次 turn 需要 appraisal + cognition + language（+ lived-evidence adaptation）多次串行本地调用；已有 stage 进度与延迟，但无总量预算/预计耗时提示。
3. 品牌-new subject 在第一个 lived event 之前没有 durable canonical state，因此 observe/time/environment 会先拒绝并给出提示。
4. Personality/Belief/Relationships 仅在对应 adaptation provider 被配置且 lawful 改变后显示；否则 `ABSENT`（不伪造默认值）。
5. 配置只读：`/config` 能查看 effective 值与来源，但修改 model/endpoint/timeout/data dir 仍需设置环境变量并重启（V0 明确不提供 `/config set`、不提供多 subject 选择）。
6. 无 Need/Goal、无 action execution、无 wall-clock 自动时间、无 camera/audio 原生解释。

## NEXT EXACT SLICE

只启动：

`CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0`

问题边界：单次 turn 需要 appraisal + cognition + language（+ lived-evidence adaptation）多次串行本地调用，目前只有 per-stage 延迟，没有整轮的量级预期与调用计数；让用户在等待前就知道大概会发生几次调用、目前进行到第几步，且不改变任何 canonical semantics、不改变既有调用预算语义、不新增 retry/fallback/router。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0`：必须先确认其问题、边界与预算；
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
