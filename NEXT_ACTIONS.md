# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `b0e503de63adfd5532e8a46fa30b1c5a84c668b6`（干净 baseline；本次 `INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0` — 全新 subject 的首条用户消息可 lawful 形成 observational Experience → durable Memory。

- 现有 generic Learning path（Observation → EpisodicMemoryRecordV0 → Memory，生产 MICL Learning stage 已在用）被交互式 runtime 正式接线；
- 无 behavior/delivery/reply parent、无 fake feedback、无 reward/learning signal、无 appraisal/affect 重复；
- 每个用户事件恰好编码一次：有 behavior-outcome 角色时走反馈路径，否则走 observational 路径；
- 当前消息不会进入其自身轮次的 retrieval；
- 真实进程重启（仅一次 pre-restart 交互）后 retrieval 命中该 observational episode，provider-visible evidence 呈现 "user stated X"。

同时保持 GREEN/FROZEN：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0     FROZEN / GREEN
long-horizon session                          IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
provider diagnostic / repair / revalidation   COMPLETE / FROZEN
```

## CURRENT BLOCKER

当前没有已知的 interactive-runtime blocker；first-turn memory boundary 已关闭。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 产品仍只有单一 subject 身份（每 data dir 一个，经 env 传入），没有 in-product 的 subject 创建/配置surface。
2. host appraisal provider 对每个事实事件使用同一最小 profile；Affect 经 canonical dynamics 变化，不随内容变化。
3. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——冻结 feedback law 要求的真实对话后果。

## NEXT EXACT SLICE

只启动：

`PERSISTENT_SUBJECT_CONFIGURATION_V0`

问题边界：让用户能以 lawful、产品化的方式创建/配置唯一持久 subject（身份、显示名、identity anchors、storage 位置），而不是仅靠环境变量；不得引入任意人格编辑、god-mode 状态 setter、Memory editor 或 GUI。必须保持现有 genesis/restore authority、单一 subject per storage 的语义。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `PERSISTENT_SUBJECT_CONFIGURATION_V0`：必须先确认其问题、边界与预算；
- GUI、Electron/Tauri、mobile、voice、vision、avatar、websocket、multi-user、accounts、cloud sync、auth、plugins、tool execution、autonomous world simulation、multi-character；
- `/set-personality`、`/set-emotion`、`/set-belief`、`/set-relationship` 等 god-mode setter，或 memory editor；
- 新 dynamics、named-emotion、Mood、ActionTendency、PersonalityScore、NarrativeSelf、learned-psychology 机制；
- 新 Experience kind / Memory schema、retrieval semantics 或 persistence/restore authority；不得把 observational admission 放宽为「所有观察都必须记住」或加入 importance/salience 阈值；
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
