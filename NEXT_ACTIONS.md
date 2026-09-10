# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `00e978bebc5c3ffdd27e56b5a246b4842a495cb3`（干净 baseline；本次 `REAL_COUNTERPART_FEEDBACK_INGESTION_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`REAL_COUNTERPART_FEEDBACK_INGESTION_V0` — 显式真实用户反馈（"That fixed it, thanks." / "That didn't solve it." / "No, I meant the blue one."）已被现有 BehaviorOutcomeFeedback 路径 lawful 表示为**事实证据**，无需新类型。

- 判定：`EXISTING_COUNTERPART_FEEDBACK_PATH_SUFFICIENT` —— 未新增 production semantics；
- 现有 `ExperienceRecordV0(BEHAVIOR_OUTCOME)` 已绑定：delivered behavior 全文 artifact + `behavior_delivery_id`(DELIVERED) + 精确 counterpart reply 文本 + reply ingress event + delivered/outcome logical time；
- 无 reward/score/sentiment/trust/punish 字段（closed schema），不修改 Affect/Belief/Relationship/Personality；
- 每个 linked reply 恰好一次 durable admission（role-based single-admission 法不变）；当前 reply 不进入其自身轮次 retrieval；
- 重启后 retrieval 将 delivered behavior 与精确用户回复一并作为 provider-visible factual evidence 暴露。

此前能力保持 GREEN/FROZEN：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0          FROZEN / GREEN
INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0  FROZEN / GREEN
PERSISTENT_SUBJECT_CONFIGURATION_V0                FROZEN / GREEN
long-horizon session                               IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
provider diagnostic / repair / revalidation        COMPLETE / FROZEN
```

## CURRENT BLOCKER

当前没有已知的 interactive-runtime / subject-configuration / counterpart-feedback blocker。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 仍只有单一 subject 身份 per data root；无多 subject 选择、删除、克隆、重命名。
2. host appraisal provider 对每个事实事件使用同一最小 profile；Affect 经 canonical dynamics 变化，不随内容变化。
3. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——冻结 feedback law 要求的真实对话后果。
4. 用户无法查看 subject 记住了什么；没有 read-only 的 lived-memory 汇总入口。

## NEXT EXACT SLICE

只启动：

`INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0`

问题边界：让用户/operator 能以 read-only、安全的方式查看 subject 当前 durable lived memory 的事实摘要（例如经既有 factual evidence resolver 的投影），从而验证「subject 记住了什么」，而不暴露内部 authority、原始 payload、hidden reasoning 或 provider prompt；不得引入 memory editor、importance 阈值、retrieval 改写或 GUI。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0`：必须先确认其问题、边界与预算；
- GUI、Electron/Tauri、mobile、voice、vision、avatar、websocket、multi-user、accounts、cloud sync、auth、plugins、tool execution、autonomous world simulation、multi-character；
- 多 subject 选择器、subject 删除/克隆/重命名；
- `/feedback`、rating UI、reward/sentiment/trust 标量，或任何 Affect/Belief/Relationship/Personality setter；
- personality/relationship/belief/mood 配置、memory editor、backstory generation；
- 新 Experience kind / Memory schema、retrieval semantics 或 persistence/restore authority；
- 对 frozen experiment source、raw output、result、report 或 evidence 的改写；
- 把 bounded V0 smoke 包装成通用长期主体、任意时长可扩展或人格真实性证明。

## ESCALATION CONDITIONS

停止并请求裁定，仅当：

1. 当前 executable behavior 与仍然有效的 frozen semantic contract 无法同时成立；
2. 修复必须改变 Affect、Appraisal、Memory、Retrieval、Cognition、Language、Behavior、Belief、Relationship、Persistence、Restore 或 Session semantics；
3. frozen raw evidence 必须被修改才能让门禁通过；
4. 新 slice 需要改变既有生产模型、prompt、retrieval 或调用预算，而不是单纯测量/编排；
5. license、外部发布、付费 provider 或其他用户/法律决策成为必要前提。

普通 stale documentation、lint debt、CI 缺失或命名冲突不构成语义升级理由。
