# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `c7b2b005d4095c021f246d963260ad18c05ba7ab`（干净 baseline；本次 `INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0` — `/memory` read-only lived-memory 检视。

- 判定 `MINIMAL_USER_MEMORY_PROJECTION_REQUIRED`：在 runtime 新增只读 `LivedMemoryInspectionV0` 投影，复用既有 `FactualMemoryEvidenceResolverV0` + `ExperienceReaderV0`/`EpisodeContentReaderV0`；
- 内容仅来自 canonical durable episode（repository visible refs），按 occurrence logical time 时序；默认显示最近 10 条（可 `/memory N`，上限 100），纯展示边界、不删除/不改 retrieval；
- observation 显示存储的 counterpart 语句原文；behavior-outcome 同时显示 delivered behavior 文本与精确 user reply；保持 "user said X" ≠ "X 为客观事实"，无 reward/sentiment 解释；
- 严格只读：无 ingress/Observation/Experience/Memory 写入，不改 Affect/Belief/Relationship，不推进 revision/interaction index，不改变 working retrieval refs，0 provider generation call；
- 不显示内部 ref/payload/prompt/reasoning（debug 可选显示 episode ref）；读取失败 fail safely（"Memory inspection failed."）。

此前能力保持 GREEN/FROZEN：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0              FROZEN / GREEN
INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0      FROZEN / GREEN
PERSISTENT_SUBJECT_CONFIGURATION_V0                    FROZEN / GREEN
REAL_COUNTERPART_FEEDBACK_INGESTION_V0                 FROZEN / GREEN
long-horizon session                                   IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
provider diagnostic / repair / revalidation            COMPLETE / FROZEN
```

## CURRENT BLOCKER

当前没有已知的 interactive-runtime / configuration / feedback / memory-inspection blocker。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 仍只有单一 subject 身份 per data root；无多 subject 选择、删除、克隆、重命名。
2. host appraisal provider 对每个事实事件使用同一最小 profile；Appraisal provider 的输入 context 不含事件文本，因此 Affect 只能经 canonical dynamics 变化，不能随内容变化。
3. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——冻结 feedback law 要求的真实对话后果。
4. `/memory` 仅暴露既有 durable episodes；无搜索、无 importance 排序、无编辑（未来产品能力）。

## NEXT EXACT SLICE

只启动：

`INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0`

问题边界：判定 host appraisal provider 的输入 context（当前只含 ordinal、projection hash、subject_state、current_task，不含事件文本）能否、以及如何在不修改 frozen Appraisal/Affect 方程与 canonical 语义的前提下 lawful 地感知事件内容，从而让不同事件产生不同的（仍由 canonical dynamics 决定的）Affect；若该 port 有意保持 content-free，则记录架构理由与最小边界方案。不得引入 named emotion、sentiment model、importance 阈值或 Affect shortcut。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0`：必须先确认其问题、边界与预算；
- GUI、Electron/Tauri、mobile、voice、vision、avatar、websocket、multi-user、accounts、cloud sync、auth、plugins、tool execution、autonomous world simulation、multi-character；
- 多 subject 选择器、subject 删除/克隆/重命名；
- named-emotion、sentiment/reward/trust 标量、`/set-*` god-mode setter、memory editor、importance 排序、memory search、Memory 汇总模型；
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
