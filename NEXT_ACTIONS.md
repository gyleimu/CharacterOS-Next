# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `8aaf9e47c06f79709eb1489ea841558ad91f84fc`（干净 baseline；本次 `INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0` — Appraisal provider 输入边界获得当前事件内容。

- 判定 `APPRAISAL_PORT_CONTENT_EXTENSION_REQUIRED`：在 appraisal provider input projection 上**追加式**新增 `current_observable_scene`（当前事件的 committed observable scene，对话中即 counterpart 语句的既有 framing）；
- Level 1（content availability）达成：不同事件内容 → 不同 provider input / `context_projection_hash`；相同内容 → 确定性相同 input；仅当前事件，无 transcript、无 Memory dump；
- Level 2（content-sensitive appraisal）**未达成**：产品 provider 仍是 content-insensitive 常量 profile（诚实记录，未伪造分类器）；
- canonical Appraisal record / proposal schema、dimensions、equations、Affect 路径全部不变；appraisal failure 仍 fail-closed，无 neutral substitution；
- 无 host sentiment/reward classifier；无新 model call（model calls = 0）。

此前能力保持 GREEN/FROZEN：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0              FROZEN / GREEN
INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0      FROZEN / GREEN
PERSISTENT_SUBJECT_CONFIGURATION_V0                    FROZEN / GREEN
REAL_COUNTERPART_FEEDBACK_INGESTION_V0                 FROZEN / GREEN
INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0               FROZEN / GREEN
long-horizon session                                   IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
provider diagnostic / repair / revalidation            COMPLETE / FROZEN
```

## CURRENT BLOCKER

当前没有已知的 interactive-runtime / configuration / feedback / memory-inspection / appraisal-content blocker。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 仍只有单一 subject 身份 per data root；无多 subject 选择、删除、克隆、重命名。
2. Appraisal provider 已能获得当前事件 scene，但产品 provider 仍是 content-insensitive 常量 profile（Level 2 未达成）。
3. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——冻结 feedback law 要求的真实对话后果。
4. `/memory` 仅暴露既有 durable episodes；无搜索、无 importance 排序、无编辑（未来产品能力）。

## NEXT EXACT SLICE

只启动：

`CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0`

问题边界：在 `current_observable_scene` 已可用、Appraisal dimensions/equations/canonical semantics 冻结的前提下，设计并实现一个 lawful 的 host appraisal provider，使相同的结构上下文 + 不同的事件内容可以产生不同的（受既有 validator 约束的）Appraisal proposal；不得引入 sentiment/positive-negative 分类器、named emotion、reward/importance 标量或 Affect shortcut；不得改变 Appraisal output schema 或 canonical Affect law。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0`：必须先确认其问题、边界与预算；
- GUI、Electron/Tauri、mobile、voice、vision、avatar、websocket、multi-user、accounts、cloud sync、auth、plugins、tool execution、autonomous world simulation、multi-character；
- 多 subject 选择器、subject 删除/克隆/重命名；
- sentiment/positive-negative/toxicity classifier、named emotion、mood、reward/importance/salience 标量、`/set-*` god-mode setter、memory editor、memory search、Memory 汇总模型；
- 新 Experience kind / Memory schema、retrieval semantics 或 persistence/restore authority；不得修改 appraisal dimensions/validation/equations 或 canonical Affect law；
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
