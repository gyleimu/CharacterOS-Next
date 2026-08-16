# RESEARCH_STATE.md — CharacterOS-Next 研究状态

**状态:** 骨架阶段文档。本文件合并两个已完成审计的结论，并定义本仓库的研究纪律。**本仓库当前没有、也不授权任何进行中的实验。**

---

## 1. 两个最高约束的来源

| 审计 | 位置 | 在本仓库的效力 |
|---|---|---|
| A — CharacterOS 现有仓库审计 | 外部已完成审计（结论作为本仓库给定输入） | 架构缺口清单 + 旧仓库定位（legacy/baseline/migration source） |
| B — CharacterOS Emotion 全路线审计 | `C:\Users\AL\Documents\CharacterOS-Research-Direction-Audit\`（六个审计文档 + evidence/ 135 文件 SHA 清单） | Emotion 研究方向总裁决 + 研究纪律 + 触发条件 |

---

## 2. Emotion 研究状态（继承约束 B，逐条）

| 条目 | 结论 | 标签 |
|---|---|---|
| 最终路线状态 | B — DIRECTION_VALID_BUT_REFRAMED | `VERIFIED`（审计 B） |
| Pure Dynamics 研究 | PAUSE_UNTIL_PRODUCT_EVIDENCE | `VERIFIED`（审计 B） |
| DEV_004 | NO_DEV_004_JUSTIFIED | `VERIFIED`（审计 B） |
| FAST+EMA 研究身份 | BASELINE_ONLY | `VERIFIED`（审计 B） |
| FAST+EMA 产品身份 | minimal state persistence implementation | `VERIFIED`（审计 B） |
| "Dynamics 击败 LLM+Prompt"目标 | 错误框架，废弃 | `VERIFIED`（审计 B） |
| 目标重定义 | 长期存在、由真实事件持续改变、可被语言/动作/表情/决策/记忆共享的内部状态系统 | `VERIFIED`（审计 B） |
| state authority | 必须位于 LLM 之外 | `VERIFIED`（审计 B） |
| LLM 角色 | appraisal / semantic understanding / expression / deep reasoning component | `VERIFIED`（审计 B） |
| Level 2–4 集成 | 价值无充分证据；不得 overclaim；Level 3 另有 §28 gate（规则非科学结论） | `VERIFIED`（审计 B） |

**关键历史裁决（防遗忘，全部来自审计 B 的六文档）：**
- 没有任何路线因"输给 LLM+Prompt"被砍（Attractor 被 FSM-SLOW/SOFT-FSM-SLOW 证伪必要性；TED 被 EMA/LINEAR-G + 三因子归因闭环关闭）。`[VERIFIED]`
- DEV_003 只证伪"中性数值状态读数 → deepseek-v4-pro"的传导路径；六层 claim 中仅 Claim 1 SUPPORTED，Claim 2–6 NOT TESTED。`[VERIFIED]`
- 词句/verbalizer 通道（A 形态）强；"dynamics 在 verbalizer 中的边际贡献"因缺 A_static 对照而 UNKNOWN。`[VERIFIED]`
- 引用纪律：`DYNAMICS_VALUE_NOT_SUPPORTED` 必须限定为 numeric adapter 通道；禁止"dynamics 无价值/attractor 不可能/learned 线已死"三种表述。`[VERIFIED — 审计 B RESEARCH_CLAIM_CORRECTIONS]`

---

## 3. 旧仓库状态（继承约束 A）

- 旧 CharacterOS = 成熟的 deterministic psychological simulation kernel，**不是废弃项目**。`[VERIFIED — 约束 A]`
- 7 个架构缺口（顺序错误 / Emotion 非持久 / Life state 跨 tick 不全 / 行为无闭环 / 记忆检索不自传 / Relationship 非一等 / 时间尺度混层）是本仓库的设计修复清单。`[VERIFIED — 约束 A]`
- 旧仓库用途：legacy implementation + baseline + mechanism library + test/evaluation asset + migration source。`[VERIFIED — 约束 A]`
- 迁移只写计划（`MIGRATION_MAP.md`），不移动文件。`[DESIGN DECISION]`

---

## 4. 本仓库的开放问题（只记录，不研究）

| # | 问题 | 状态 |
|---|---|---|
| O1 | SubjectState V0 的正式 spec（字段/写规则/cause-trace 格式） | 待 NEXT_ACTIONS #1 |
| O2 | causal loop 各阶段的最小契约（输入/输出/不变量） | 待 NEXT_ACTIONS #2 |
| O3 | Memory Retrieval + Appraisal + persistent Affect 最小闭环的设计 | 待 NEXT_ACTIONS #3 |
| O4 | LLM appraisal 提案协议的具体字段与校验规则 | `HYPOTHESIS` |
| O5 | 跨 session 持久性 / 多通道一致性 / 权威抗注入的价值 | `HYPOTHESIS`（触发条件 T1/T4/T6） |
| O6 | 旧 Phase 5.2 测量修复（bias 消融/特异性）后的重测设计 | 继承自旧线，`HYPOTHESIS`（产品侧触发） |
| O7 | appraisal E5 全有或全无机制（旧 E37 遗留） | 继承自旧线，`UNKNOWN`（未授权继续） |
| O8 | A2.1 正式 R1 逐条结果 | `UNKNOWN`（旧 zip 未展开核验；迁移时如需引用必须先核验） |

---

## 5. 研究纪律（本仓库宪法级）

1. **实验 = 最后手段**：只有产品证据触发的具体机制问题（T1–T8）才能进入 Phase 0。
2. **Phase 0 先于一切**：任何研究问题必须先有 Phase 0（问题可证伪性 + baseline 策略 + 预注册计划），人类批准后才允许后续步骤。
3. **三比较器纪律**：新机制必须声明其比较器（FAST+EMA / LINEAR-G / Memory+LLM 每轮重算）与问题形态。
4. **CERH 纪律继承**：任何未来实验在独立 workspace 中经 CERH 生命周期执行（旧 DEV_001/002/003 的纪律：冻结协议、无静默重试、证据密封）；本仓库自身不存放实验运行态。
5. **证据等级**：沿用 OBSERVED/STORED 等旧线标准；DEV 规模结论不得表述为确认性结论。
6. **禁止表述**："dynamics 无价值"、"attractor 不可能"、"learned 线已死"、"CharacterOS-Next 已实现长期主体"。

---

## 6. 研究目录的使用规则（research/）

- `research/{emotion,memory,appraisal,plasticity}/` — 只放**设计文档与假设记录**，标注标签；不放实验产物。
- `research/hypotheses/` — 可证伪假设目录（每条假设必须写：命题、证伪条件、触发重测条件、比较器）。
- `research/experiments/` — **占位**。目录存在不代表任何实验被授权；未来实验产物必须留在独立 workspace（CERH 模式），本目录仅存指针与索引。

---

## 7. 一句话研究状态

> 架构修复清单来自约束 A（7 缺口）；情感机制裁决来自约束 B（持久状态 + LLM 边界 + FAST+EMA 最小实现）；研究本身处于冻结态——下一步的三个动作（SubjectState V0 / Causal Loop / 最小闭环设计）全部是**设计动作**，不是研究动作，不是实现动作。
