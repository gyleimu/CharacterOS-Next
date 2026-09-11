# NEXT_ACTIONS.md — Immediate execution boundary

Status: ACTIVE
Authority: 只定义眼前执行边界；仓库能力与成熟度以 [`CURRENT_STATE.md`](CURRENT_STATE.md) 为准。
Last verified against commit: `2e6460355a2dfbec24850d84f04322fc8cbb75bc`（干净 baseline；本次 `PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0` 是其直接子提交）
Purpose: 指定 current baseline、blocker、next exact slice、禁止项与升级条件。

## CURRENT BASELINE

CharacterOS-Next 有 14 个 workspace、可复用 runtime、完整工程门禁与大量冻结实验/诊断证据。

已完成并冻结的当前 slice：

`PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0` — 受控双历史因果验证（无新 production semantics）。

- 判定 `EXISTING_LIVED_HISTORY_BEHAVIOR_CAUSAL_CHAIN_PRESENT`：**production behavior changes = 0**；
- Phase A 因果表确认 cognition projection 已包含 `canonical_affect`（V2，exact committed VA）、Memory factual evidence、`belief_items`、relationship dims、traits；Affect 与 Memory 均已 lawful 到达 cognition；
- Level 1 PASS：两条受控历史（positive vs negative lived events）经 authoritative restart 后仍不同（state_hash/affect/repository content 不同）；
- Level 2 PASS：相同 current event 下 cognition request 不同（real: `fea…` vs `ef6f…`；请求 identity match true）；
- Level 3 PASS：相同 model/current event 下 current_intent 与 observable behavior 不同（A 建议继续采用，B 警告会使情况更糟）；
- Level 4 PASS（non-Memory state causal contribution）：common-event appraisal 在两分支完全相同（rel 1 / goal 0.5 / int 0.6 / conf 0.9），但 canonical Affect 持久不同（valence +0.545 vs -0.371）且该 Affect 被投影进 cognition；offline 测试额外证明 `[affect (canonical)]` 行本身不同；
- Belief / Relationship / traits：UNCHANGED（本 slice 内无 lawful producer 触发，不强行制造）。

此前能力保持 GREEN/FROZEN：

```text
INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0              FROZEN / GREEN
INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0      FROZEN / GREEN
PERSISTENT_SUBJECT_CONFIGURATION_V0                    FROZEN / GREEN
REAL_COUNTERPART_FEEDBACK_INGESTION_V0                 FROZEN / GREEN
INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0               FROZEN / GREEN
INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0      FROZEN / GREEN
CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0                FROZEN / GREEN
long-horizon session                                   IMPLEMENTED / EXPERIMENTALLY_SUPPORTED
provider diagnostic / repair / revalidation            COMPLETE / FROZEN
```

## CURRENT BLOCKER

当前没有已知的 lived-history causal blocker：Memory + Affect 已证明能持久地改变同一 subject 的后续 cognition/behavior。

已记录的 V0 限制（不是 blocker，不得在未授权时顺手修复）：

1. 仍只有单一 subject 身份 per data root；无多 subject 选择、删除、克隆、重命名。
2. Appraisal 为 content-sensitive（model-backed），每个 factual event 1 次本地 model call；appraisal 输入限于 identity hashes + current_task + current_observable_scene（不含 Memory/Belief/Relationship，属有意边界）；common-event appraisal 因此不随历史变化。
3. Belief 与 traits/personality-like state 已被投影进 cognition，但本 slice 内没有任何 lawful producer 使其随 lived evidence 变化 → 长期信念/倾向尚未由经历驱动。
4. 某轮交付行为的 outcome Experience 会在用户下一次发言时提交（包括重启后）——冻结 feedback law 要求的真实对话后果。
5. `/memory` 仅暴露既有 durable episodes；无搜索、无 importance 排序、无编辑（未来产品能力）。

## NEXT EXACT SLICE

只启动：

`BELIEF_CHANGE_THROUGH_LIVED_EVIDENCE_V0`

问题边界：在 Affect + Memory → cognition 的因果链已被证明、Belief infrastructure 已存在且已被投影进 cognition 的前提下，判定是否存在既有 lawful 的 belief-update producer/authority：若存在则最小接线，使 lived evidence 能（经既有 canonical 语义）改变 `beliefs.items`；若不存在，则精确记录缺失的 belief-admission boundary 与最小方案。不得发明新的信仰语义、不得用 host 直接写 belief、不得把 Affect/Memory 数值映射成 credence、不得改变 retrieval/appraisal/Affect 语义。

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
