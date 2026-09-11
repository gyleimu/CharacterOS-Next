# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `e30e27ac16d090564c8a7baf38a45cee263dd45a`（干净 baseline；本次 `CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0` — 内容敏感 Appraisal producer。

- 判定 `MODEL_BACKED_APPRAISAL_PROVIDER_REQUIRED`：任意自然语言事件无法用诚实的确定性算法 appraisal，按 §8 选择 model-backed；
- 新增 frozen strict appraisal prompt（`product-appraisal-prompt.ts`）：模型只提出六个 canonical dimensions + assessment_confidence；adapter 从 trusted context 组装全部 authority 字段（subject/event ref/context hash/evidence refs），模型无法伪造身份/refs；
- 当前事件作为 untrusted data 明确 delimiter；无 transcript、无 Memory dump；malformed / out-of-range / invalid enum 由既有 validator fail-closed，无 clamp、无 JSON repair、无 constant fallback；
- 每个 factual event 恰好 1 次 appraisal model call（executor durable disposition 短路重放）；appraisal / cognition / language 分开计数；
- Level 1 PASS（前一 slice）；Level 2 PASS（deterministic pipeline + real smoke：不同内容 → 不同 lawful proposal）；Level 3 PASS（既有 canonical Affect 方程在受控对比下产生不同 Affect）。

此前能力保持 GREEN/FROZEN：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0              FROZEN / GREEN
INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0      FROZEN / GREEN
PERSISTENT_SUBJECT_CONFIGURATION_V0                    FROZEN / GREEN
REAL_COUNTERPART_FEEDBACK_INGESTION_V0                 FROZEN / GREEN
INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0               FROZEN / GREEN
INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0      FROZEN / GREEN
long-horizon session                                   IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
provider diagnostic / repair / revalidation            COMPLETE / FROZEN
```

## CURRENT BLOCKER

当前没有已知的 interactive-runtime / configuration / feedback / memory-inspection / appraisal blocker。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 仍只有单一 subject 身份 per data root；无多 subject 选择、删除、克隆、重命名。
2. Appraisal 现为 content-sensitive（model-backed），但每个 factual event 增加 1 次本地 model call；appraisal 输入仍限于 identity hashes + current_task + current_observable_scene（不含 Memory/Belief/Relationship，属有意边界）。
3. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——冻结 feedback law 要求的真实对话后果。
4. `/memory` 仅暴露既有 durable episodes；无搜索、无 importance 排序、无编辑（未来产品能力）。
5. 每个 data root 仍然只支持一个 persistent subject；创建/列出/切换多个 subject 尚无产品 surface。

## NEXT EXACT SLICE

只启动：

`MULTI_SUBJECT_LIFECYCLE_V0`

问题边界：在保持 single-active-subject 会话语义、canonical genesis/restore authority、现有 `subject-config.json` 存储约定不变的前提下，让用户能在一个 data root 下 lawful 地创建/列出/选择一个持久 subject；不得引入账号系统、云同步、GUI、subject 删除/克隆/重命名，也不得让 config 取代 canonical SubjectState authority。

该 slice 需自带有界预算与批准点。本文件不授权提前运行它。

## DO NOT START

- 自动开始 `MULTI_SUBJECT_LIFECYCLE_V0`：必须先确认其问题、边界与预算；
- GUI、Electron/Tauri、mobile、voice、vision、avatar、websocket、multi-user accounts、cloud sync、auth、plugins、tool execution、autonomous world simulation、multi-character；
- accounts / per-subject provider 或 model 配置；`/set-*` god-mode setter、memory editor、memory search、Memory 汇总模型；
- sentiment/positive-negative/toxicity classifier、named emotion、mood、reward/importance/salience 标量；
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
