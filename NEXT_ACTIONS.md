# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `63fde7b3d7c8800c15e9443daa7b21983a6d3e1c`（干净 baseline；本次 `PERSISTENT_SUBJECT_CONFIGURATION_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`PERSISTENT_SUBJECT_CONFIGURATION_V0` — 用户无需 env/JSON 手改即可经 CLI 创建并配置唯一持久 subject。

- 首次运行交互式要求 display name → 确定性派生 filesystem-safe `subject_id` → 现有 explicit-v4 genesis → 原子写 `subject-config.json` → 交互；
- 后续运行读取 config → authoritative restore 同一 subject，不再询问 setup；
- config 只是“目标标识”，canonical snapshot/restore 才是 subject reality；config/snapshot 身份冲突、config malformed/unsupported、`durable_state PRESENT` 但 snapshot 缺失均 FAIL CLOSED；
- snapshot 存在而 config 缺失时按 canonical identity 确定性恢复 config；
- setup 不产生任何 Memory，display name 不进入 provider prompt，无 psychology setter / rename / delete。

此前能力保持 GREEN/FROZEN：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0          FROZEN / GREEN
INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0  FROZEN / GREEN
long-horizon session                               IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
provider diagnostic / repair / revalidation        COMPLETE / FROZEN
```

## CURRENT BLOCKER

当前没有已知的 interactive-runtime / subject-configuration blocker。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 仍只有单一 subject 身份 per data root；无多 subject 选择、删除、克隆、重命名。
2. host appraisal provider 对每个事实事件使用同一最小 profile；Affect 经 canonical dynamics 变化，不随内容变化。
3. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——冻结 feedback law 要求的真实对话后果。
4. 用户只能以“事实回复”参与；没有 explicit feedback ingestion，subject 无法把「这次回答是否有帮助」作为 lawful 证据接收。

## NEXT EXACT SLICE

只启动：

`REAL_COUNTERPART_FEEDBACK_INGESTION_V0`

问题边界：在不发明 sentiment/reward、不修改 frozen Experience/Learning semantics 的前提下，判定用户能否、以及如何把**显式反馈**（如「这次回答有帮助 / 没帮助」）作为 lawful factual evidence 交给 subject；若现有 ingress/feedback 契约不能表达，则记录架构缺口并给出最小边界方案。不得引入 `/set-*`、rating UI、sentiment model 或 importance 阈值。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `REAL_COUNTERPART_FEEDBACK_INGESTION_V0`：必须先确认其问题、边界与预算；
- GUI、Electron/Tauri、mobile、voice、vision、avatar、websocket、multi-user、accounts、cloud sync、auth、plugins、tool execution、autonomous world simulation、multi-character；
- 多 subject 选择器、subject 删除/克隆/重命名；
- personality/relationship/belief/mood/memory 配置或 `/set-*` god-mode setter、memory editor、backstory generation；
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
