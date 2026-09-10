# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `f9021567c30769cf2b7b33a4f9a71d9a7f94f880`（干净 baseline；本次 `INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0` — 本地交互式持久主体运行时（`product/sandbox`）。

- 真实用户文本经既有生产 lifecycle：ingress → Appraisal → Canonical Affect → retrieval → cognition → directive → language → delivery → feedback → Experience/Memory → commit；
- 真实 OS 进程重启后 authoritative restore 同一 subject（`SUBJECT_RESTORED`），restore revision 连续；
- pre-restart lived history 经既有 retrieval 进入 post-restart cognition 的 provider-visible factual evidence；
- 离线确定性测试与 bounded real-provider smoke 均通过（criteria 见该 slice 报告）。

相关前置能力同样处于冻结状态：

```text
provider diagnostic            COMPLETE / FROZEN
provider budget repair         COMPLETE / FROZEN
8-interaction revalidation     REVALIDATED / FROZEN
long-horizon session           IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
```

## CURRENT BLOCKER

当前没有已知的 interactive-runtime blocker；该 slice 的 primary acceptance 全部满足。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 冻结 feedback 法只把「作为上一交付行为 counterpart reply 的用户消息」编码进 Experience/Memory；因此一个全新 subject 的**第一条**用户消息（没有 prior delivery 作为 parent）不会进入 Memory。此后每一轮正常往返都会被记住。
2. 产品 V0 的 host appraisal provider 对每个事实事件使用同一最小 profile；Affect 经 canonical dynamics 变化，不随内容变化。
3. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——这是冻结 feedback 法要求的真实对话后果，不存在 delivery-receipt-only 路径。

## NEXT EXACT SLICE

只启动：

`INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0`

问题边界：在不修改 frozen Appraisal、Affect、Memory、retrieval、Cognition、Language、Restore semantics 的前提下，判定「一个没有 prior delivered-behavior parent 的 bare user factual event」能否、以及如何经既有权威被 lawful 地编码为 Experience/Memory；若现有 ingress/feedback 契约根本无法表达，则记录该架构缺口并给出最小边界方案。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0`：必须先确认其问题、边界与预算；
- GUI、Electron/Tauri、mobile、voice、vision、avatar、websocket、multi-user、accounts、cloud sync、auth、plugins、tool execution、autonomous world simulation、multi-character；
- `/set-personality`、`/set-emotion`、`/set-belief`、`/set-relationship` 等 god-mode setter，或 memory editor；
- 新 dynamics、named-emotion、Mood、ActionTendency、PersonalityScore、NarrativeSelf、learned-psychology 机制；
- 新 Memory schema、retrieval semantics 或 persistence/restore authority；
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
