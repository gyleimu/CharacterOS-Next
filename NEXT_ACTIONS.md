# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `ee6ffa65f20c8e529e6708444acbee0e96bbd904`（干净 baseline；本次 `CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_V0` — ONE 本地 CLI 产品：一个持久 subject、一条 canonical life。

- P1–P8 PASS：单一可用 subject；一个 session 内统一 talk/observe/environment/time/state/life/memory；observe/time 可见地改变 canonical state；真实进程重启后同一 subject 恢复；Memory 含 human / external-observation / environment 三种来源；显式 canonical tick 与 Affect 演化可见；累积 history 进入后续 cognition input；全部由 composition/read surface 构成，无新 canonical ontology；
- 判定 `CHARACTEROS_PERSISTENT_SUBJECT_LOCAL_PRODUCT_GREEN`；`CHARACTEROS_CORE_V1_PRODUCT_BASELINE = FROZEN`（仅产品里程碑标记，不引入新 runtime authority）；
- 真实本地 smoke（qwen3.5:9b）：`/demo` → talk + observe FIRST + environment 1 + time 30；fresh process restart → `/life` 恢复同一 `mira-14aa8fc5`（logical_time 32、state revision 19、repository R6、shared revision 4、3 episodes）。

此前能力保持 GREEN/FROZEN（含此前 slice 已冻结的 belief/personality/relationship lived-evidence adaptation、external observation ingress、explicit canonical time、environment + cross-context continuity）：

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
CHARACTEROS_CORE_V1_PRODUCT_BASELINE                          FROZEN (product milestone)
```

## CURRENT BLOCKER

当前没有已知的 product blocker：P1–P8 全部满足。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 产品依赖本地 Ollama 模型；无离线/降级模式，provider 不可用时 CLI 在 preflight fail closed。
2. 慢机器上单次 turn 需要 appraisal + cognition + language（+ lived-evidence adaptation）多次串行本地调用，缺少进度/耗时可见性与超时提示分级。
3. 品牌-new subject 在第一个 lived event 之前没有 durable canonical state，因此 observe/time/environment 会先拒绝并给出提示。
4. Personality/Belief/Relationships 仅在对应 adaptation provider 被配置且 lawful 改变后显示；否则 `ABSENT`（不伪造默认值）。
5. 无 Need/Goal、无 action execution、无 wall-clock 自动时间、无 camera/audio 原生解释。

## NEXT EXACT SLICE

只启动：

`CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0`

问题边界：让本地产品在 provider 慢/不可用/超时时仍然可理解、可诊断、可安全退出：分级超时提示、per-call 进度与耗时可见性（operator/debug）、provider 不可用时的清晰降级/拒绝路径、以及不改变任何 canonical 语义的 provider 诊断 surface。不得引入云 provider、新 canonical state 或 action execution。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `BELIEF_CHANGE_THROUGH_LIVED_EVIDENCE_V0`：必须先确认其问题、边界与预算；
- 多 subject / multi-agent / shared world / GUI / voice / camera / avatar / tools / autonomous task execution；
- accounts / cloud sync / per-subject provider 配置；`/set-*` god-mode setter、memory editor、memory search、Memory 汇总模型；
- sentiment/positive-negative/toxicity classifier、named emotion、mood、reward/importance/salience 标量、cross-domain generic score；
- 新 Experience kind / Memory schema、retrieval semantics 或 persistence/restore authority；不得修改 appraisal dimensions/validation/equations 或 canonical Affect law；
- 对 frozen experiment source、raw output、result、report 或 evidence 的改写；
- 把 bounded V0 causal validation 包装成任意时长可扩展、人格真实或通用长期主体证明。

## ESCALATION CONDITIONS

停止并请求裁定，仅当：

1. 当前 executable behavior 与仍然有效的 frozen semantic contract 无法同时成立；
2. 修复必须改变 Affect、Appraisal、Memory、Retrieval、Cognition、Language、Behavior、Belief、Relationship、Persistence、Restore 或 Session semantics；
3. frozen raw evidence 必须被修改才能让门禁通过；
4. 新 slice 需要改变既有生产模型、prompt、retrieval 或调用预算，而不是单纯测量/编排；
5. license、外部发布、付费 provider 或其他用户/法律决策成为必要前提。

普通 stale documentation、lint debt、CI 缺失或命名冲突不构成语义升级理由。
