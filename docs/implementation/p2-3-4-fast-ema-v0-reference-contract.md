# P2.3.4.0 — FAST_EMA_V0 Reference Dynamics Contract

**任务状态：** P2.3.4.0 — **COMPLETE**（docs-only）。

**交付性质：** 规范性工程参考契约文档。本文定义 `FAST_EMA_V0`（即 `mechanism_config.affect_profile.profile_id` 的既有字面值）这一**版本化参考 AffectProducer 实现**的内部确定性行为。不包含任何实现代码变更、测试变更或依赖变更。

**前置：** P2.3.4.1 实现存在但未提交；独立 provenance 审查判定 `BLOCKED_BY_UNFROZEN_DYNAMICS`。本文关闭该缺口：把此前 UNSPECIFIED 的公式/阈值/规则逐项冻结为 FAST_EMA_V0 reference policy，并移除无 provenance 的魔法数。

**权威基线：** `f6f26571eeffa3af6effa5c43d434fbbe0cf86f1`。联合冻结权威不变：`subjectstate-v0-spec.md`、`transition-contracts.md`、`micl-design.md`、`p1-5-engineering-acceptance-contract.md`、`p2-1-contract-freeze.md`、`p2-runtime-plan.md`、`p2-3-runtime-plan.md`。本文只对上述文档中 **UNSPECIFIED（未禁止）** 的 producer 内部行为做版本化裁定，不修改任何已冻结 schema、错误码、commit 协议、ownership 或验收 oracle。

---

## 1. Status / Scope

**STATUS: NORMATIVE（docs-only；P2.3.4.1 实现的合规基准）**

本契约管辖的范围**只有一个**：`ReferenceFastEmaAffectProducer`（或任何声称实现 `FAST_EMA_V0` profile 的 producer）在
Observation / Time 两种模式下的确定性计算语义。

本契约**不**管辖（保持冻结架构，逐字沿用上游）：

- SubjectState 所有权、SubjectCore 权威、transition 边界（p2-3-runtime-plan §2/§4/§5）
- memory / appraisal / regulation ownership 与 producer authorization 架构（freeze §7.1–§7.2）
- logical-time 权威与派生规则（transition-contracts §12）
- 任何 schema 字段、错误码、writable path、哈希/指纹协议（freeze §6–§8、§13）

## 2. Non-Scientific Disclaimer（禁止 overclaim）

`FAST_EMA_V0` **是**：

- deterministic engineering baseline
- replay reference
- integration fixture
- 可替换的 AffectProducer 实现

`FAST_EMA_V0` **不是**：

- 科学真值 / 验证过的心理学模型 / 人类情绪理论
- CharacterOS 研究身份 / 真实感证据 / 优于 LLM prompting

本文中所有"策略"（routing、容量替换、聚合、EMA）均为 **REFERENCE POLICY**：工程基线选择，可在未来被其他 producer 替换，且替换不应导致 CharacterOS-Next 核心架构变更（`Reference Model != Scientific Model`）。

## 3. Authoritative Inputs

`FAST_EMA_V0` 的输入 = `AffectProducerInputV0`（`packages/runtime/src/ports/affect-producer-port.ts`，P2.3.4.1 已补闭 `elapsed_ticks` 字段）。

**Observation 模式可读：**

- 当前 canonical affect 状态（`snapshot.affect`，只读）
- 当前 canonical mood 状态（`snapshot.mood`，只读）
- 已验证的 `AppraisalProposalDraftV0`（六字段；见 §4）
- canonical logical time（`context.current_logical_time`，只读锚定）
- `mechanism_config.affect_profile` 与 `legacy_reference_defaults`（只读）

**Time 模式可读：**

- 当前 canonical affect 状态（只读）
- 当前 canonical mood 状态（只读）
- `elapsed_ticks`（非负安全整数，即提案 `time_input` 的 elapsed 真值）
- canonical logical time（只读锚定）
- `mechanism_config.affect_profile` 与 `legacy_reference_defaults`（只读）

**禁止读取/调用（fail-closed，任意触碰即实现违规）：**

MemoryRepository、Retrieval、LLM、wall clock、随机源；personality / belief / relationship 的任何字段；任何 mutation 能力（不 commit、不写 memory、不调用 subject-core）。

**模式闭合规则（输入形状校验，违反即抛错）：**

- Observation ⇒ `appraisal ≠ null` 且 `elapsed_ticks == null`
- Time ⇒ `appraisal == null` 且 `elapsed_ticks` 为非负安全整数

## 4. Attribution Conflict（已知契约冲突，本契约不解决）

上游已提交的冲突标记保持不动：`AppraisalV0.attribution: UnitIntervalV0` vs `self | other | situation`，
标记 `MUST_RESOLVE_BEFORE_P2_3_5`。

**`FAST_EMA_V0` MUST NOT depend on attribution：**

- `attribution` 字段被 `FAST_EMA_V0` **显式忽略**：不读取、不校验、不参与任何分支或数值。
- 本契约的通道路由（§6）不消费 attribution，也不通过其他字段间接编码其分类语义。
- 本裁定**不解决**上游契约冲突；标记保持原样。

> **Status update（P2.3.5.0a，语义层已解决）：** 上游表示法冲突已由
> `docs/implementation/p2-3-5-appraisal-attribution-resolution.md` 在语义契约层解决
> （Appraisal V0 attribution ∈ {"self","other","situation"} 闭集；数值表示退役；当前状态
> `RESOLVED_PENDING_RUNTIME_ALIGNMENT`）。本节的 normative 盲性要求不变且永久成立：
> `FAST_EMA_V0` 对 `attribution` 不读取、不校验、不参与任何分支或数值。

## 5. Observation Bridge（Appraisal → FAST）

架构冻结了"确定性工程桥接必须存在"（p2-runtime-plan §4.2/§5.1-9；micl-design §22），但未冻结映射。
本契约将其定义为 **FAST_EMA_V0 VERSIONED REFERENCE POLICY**：

### 5.1 Activation strength

```text
strength = clamp01(relevance * intensity)
```

- `relevance`、`intensity` 为已验证的 `UnitIntervalV0`（`[0,1]` 有限数）。
- `clamp01(x) = normalize(min(1, max(0, x)))`，`normalize` 见 §12（-0 → 0）。
- 由于输入已在 `[0,1]` 内，`clamp01` 恒等于原值；它是数值卫生规则而非行为分支。

这是工程基线选择，**不是**继承的科学语义。

### 5.2 Activation predicate

- `strength == 0` ⇒ 无通道激活（不调用路由）。
- `strength > 0` ⇒ 进入 §6 路由。

## 6. Channel Routing Policy（REFERENCE POLICY）

精确路由表（分支优先级自上而下，命中即止；`FAST_EMA_V0` 规范唯一形式）：

```text
goal_congruence > 0.5                                        → joy
goal_congruence == 0.5                                       → 无新通道激活
goal_congruence < 0.5  AND uncertainty > 0.5                 → fear
goal_congruence < 0.5  AND uncertainty <= 0.5
                       AND controllability < 0.5             → anger
否则（goal_congruence < 0.5，其余条件均不满足）               → sadness
```

规范性声明：

- **0.5 阈值 = FAST_EMA_V0 reference-policy constants**（FROZEN CONFIG 之外，见 §15 表）。
- 分支优先级**仅对 FAST_EMA_V0 规范**；不是验证过的评价理论。
- 未来 producer 可替换本映射。
- 已核查（§18）：现有冻结契约对本映射**未禁止**（仅 UNSPECIFIED），可合法采纳为 reference policy。
- `goal_congruence == 0.5` 与 `strength == 0` 均不激活；两者互斥（后者在 §5.2 先于路由）。

## 7. Hold / Release Lifecycle（状态机）

仅使用冻结相名 `ACTIVE` / `RELEASING`（以及 schema 允许的 `INACTIVE` 语义位——见 §14 容量）。

```text
新激活 / 同通道再激活（upsert） →  phase = ACTIVE
                                intensity = strength
                                started_at = 当前逻辑时间
                                source_appraisal_ref = appraisal_ref
```

- **ACTIVE 持续时间只按 canonical logical ticks 计量**：`age(c) = 当前逻辑时间 - c.started_at`。
- 当 `age >= tHold` 时：`ACTIVE → RELEASING`（转换发生在推进后的 tick 边界，见 §8 的精确公式）。
- 无 wall-clock 语义；`started_at` 一旦设置不再改变（再激活时整体重置为当前时刻）。
- 同通道再激活 = 完全重置（强度、相位、起始时刻、来源 ref 全部替换），不叠加。

## 8. Time Decay Equation（精确释放规则）

与已冻结契约 `exp(-elapsed_ticks / tau_ticks)`（transition-contracts §12 R6 裁定）**形态对齐**，采用闭式规则，避免逐 tick 浮点乘法。

**记号：** 设 Time 推进 `e` 个 tick，推进前逻辑时间 `T`，通道 `c`：

```text
age_before(c)  = T            - c.started_at
age_after(c)   = (T + e)      - c.started_at

release_ticks(c) = max(0, age_after(c) - tHold) - max(0, age_before(c) - tHold)
```

**通道更新（每通道独立，一次应用）：**

```text
若 release_ticks(c) > 0：
    phase     ← RELEASING            （若原为 ACTIVE；已 RELEASING 则保持）
    intensity ← intensity * exp(-release_ticks(c) / tau)
若 release_ticks(c) == 0：
    相位与强度不变
```

**性质（自洽性证明要点，写入实现注释）：**

- 对已 RELEASING 通道：`age_before(c) >= tHold` 恒成立 ⇒ `release_ticks(c) == e`（每 tick 衰减一步的数学闭式）。
- 对 ACTIVE 通道跨过 tHold 的多 tick 推进：只有**超出** hold 区间的 tick 数参与衰减（hold 区间与 release 区间的划分由上式精确完成）。
- `started_at` 参与年龄计算但永不被推进改写。
- 无新常数：除冻结参数 `tHold`/`tau` 外，本公式不含任何数值字面量。

## 9. FAST Aggregation for Mood Input（REFERENCE POLICY）

```text
fast_level = max(intensity of all active/releasing channels, 0)
```

- 空通道集 ⇒ `fast_level = 0`。
- 确定性、有界、简单；**REFERENCE POLICY ONLY**。
- **限制声明：** `MoodV0.baseline` 是**非负标量**（`[0, clamp]`），无 valence 符号维度。因此 `fast_level` 只表达情绪载荷强度，不表达正负向；mood 无法区分"积极的 joy"与"消极的 anger"的极性。这是**冻结 schema 的既有限制**，不是缺陷；本契约**不得**发明带符号 mood 字段或绕过该限制。

## 10. EMA Equation（精确递推）

```text
Observation（单步，事件后）：
    mood_next = clamp_mood(mood_current + alpha * (fast_level - mood_current))

Time（elapsed = e > 0）——采用离散递推（选项 A）：
    记 fast_level 为 §8 推进后的聚合值（常量）
    对 i = 1 .. e（严格顺序）：
        mood := clamp_mood(mood + alpha * (fast_level - mood))
    递推 e 次后即为 mood_next
```

- `alpha` 来自冻结的 `legacy_reference_defaults.alpha`。
- `clamp_mood(x) = normalize(min(config.clamp, max(0, x)))`，`normalize` 见 §12。
- **选项 A 为规范执行形式**（与 `legacy_tick` 离散世界观一致；浮点运算序列固定 ⇒ byte-for-byte 可复现）。不采用闭式等价形式作为执行语义。
- **更新顺序是契约的一部分**（§11）：Time 模式下先完成全部通道的 §8 衰减，再以**推进后的常量 fast_level** 递推 e 次。不允许在每次 EMA 迭代之间重新计算 fast_level。
- Observation 模式不推进时间（时间归一化由 TimeTransition 先行完成，见 transition-contracts §13/§14 语义），故无跨 tick 衰减；事件步直接作用于当前快照状态。
- 若 `strength == 0` 或路由判定不激活（§5.2/§6）：**不执行 EMA 步**（mood 保持），但仍按 §15 产出恒等 delta。

## 11. Update Ordering（冻结执行顺序）

**Observation：**

1. 校验输入形状（§3 闭合规则）与配置（§12 数值规则）
2. 计算 `strength = clamp01(relevance * intensity)`；若 `strength == 0` 跳至 6
3. 按 §6 路由选择参考通道
4. upsert 通道（§7）
5. 计算 `fast_level`（§9，事件后）
6. 执行一次 EMA 观察步（§10）
7. 产出 `/affect` + `/mood` 替换 delta（§13 排序/时间戳/provenance）

**Time：**

1. 校验输入形状与配置
2. 按 §8 一次性推进所有通道相位与强度（闭式）
3. 计算 `fast_level`（§9，推进后）
4. 按 §10 递推 e 次 EMA
5. 产出 `/affect` + `/mood` 替换 delta

顺序是 replay 确定性的组成部分；实现与测试必须逐字节匹配上述顺序。

## 12. Numeric Determinism Rules

- **finite-only**：任何中间结果出现 NaN / ±Infinity ⇒ fail-closed 抛错（不产出 delta）。
- `normalize(x) = (x === 0 ? 0 : x)`（-0 → 0；所有**产出**数值必须经过 normalize）。
- 强度恒在冻结合法域 `[0,1]`（构造经 `clamp01`）。
- mood baseline 恒在 `[0, config.clamp]`（`clamp_mood`）。
- **不引入十进制舍入**（无 toFixed / round / 位运算截断）。
- 工程假设声明：**P2 参考执行模型 = IEEE-754 double（JS Number）算术**；`Math.exp` 为平台确定函数（V8 内确定性）。同一输入在同一执行模型下产生逐字节相同输出；跨执行模型（不同引擎）的位级一致性不在本契约承诺范围。
- 输入校验（fail-closed，先于任何计算）：四参数有限且合法（`tHold` 为正安全整数、`alpha ∈ (0,1]`、`tau > 0` 有限、`clamp ∈ [0, 0.25]`——0.25 为冻结 schema 硬界，见 §15）；profile 必须为 `FAST_EMA_V0` / `legacy_tick`。

## 13. NO_OP / Zero-Effect Behavior

**Time `elapsed_ticks == 0`：**

- TimeTransitionExecutor 走既有 **durable NO_OP** 路径（`TIME-NOOP-001`），**不调用 producer**；producer 无需发明任何 transition。本契约不改变该语义。

**Observation 零激活（`strength == 0` 或路由不激活）：**

- `FAST_EMA_V0` **必须产出恒等 delta**：`/affect`、`/mood` 的值与当前快照**逐字节相同**（含 `generated_under_profile`、时间戳原值）。
- 理由：Observation 契约要求 affect domain delta 存在（p2-3-runtime-plan §5.2 Required deltas）；恒等 delta 保持原子提案组合的合法性，同时不伪造 provenance 戳。
- **不允许**返回"无 delta"。

**Time `elapsed > 0` 但动力学无变化：**

- 仍产出合法 delta（值可能逐字节等于快照，即恒等）；是否 `+1` 由 Time 契约决定，producer 无权决定。

## 14. Channel Capacity Behavior（确定性，REFERENCE POLICY）

冻结 schema 上限：`active_channels` 唯一且有序，全集 = 冻结枚举 `anger, fear, sadness, joy` ⇒ 容量 = **4**。

**新激活时的确定性规则（优先级自上而下）：**

1. **同通道更新**：目标通道已存在 ⇒ §7 upsert（不增加数量）。
2. **空槽填充**：目标通道不存在且当前数量 < 4 ⇒ 追加（输出按冻结顺序排序：`anger < fear < sadness < joy`）。
3. **确定性替换**：当前数量 == 4 且目标通道不存在 ⇒ 移除 **intensity 最小**的通道后填入新通道；**并列时**按冻结通道顺序取最先者（`anger` 优先于 `fear`，依此类推）。

替换规则显式标注：**FAST_EMA_V0 reference policy，非科学语义**；不使用随机性；被替换通道完全移除（其历史由 trace 保留，不影响本规则）。

**无 0.01 release floor（关键裁定）：**

- 上一实现中的 `intensity < 0.01 → remove channel` **不存在 provenance**，被本契约 **PROHIBITED / REMOVED**。
- RELEASING 通道以数学衰减后的强度**无限期保留**，仅受 §12 数值规则与 schema 界约束。
- `exp(-x / tau)` 对有限 `x` 恒 > 0，因此数学上**不会**达到精确 0，容量不会被衰减路径耗尽。
- 若未来数值路径产生精确 `0`（规范算术下仅构造/异常可达）：通道按精确零处理移除（不引入新 epsilon；该规则与 schema 的 `[0,1]` 界兼容）。
- 若未来 schema 出现新的容量/保留约束，必须走契约修订流程；**不得**以 epsilon 静默解决。

## 15. Parameter Provenance Table

| Semantic | Source Class | 来源 |
|---|---|---|
| `tHold = 60` | **FROZEN** | freeze §4.2/§12 literals；spec §18；transition-contracts §12（60 ticks） |
| `alpha = 0.06` | **FROZEN** | freeze §12 literals；RESEARCH_STATE §2（legacy reference default，非科学真值） |
| `tau = 150` | **FROZEN** | freeze §4.2/§12 literals；transition-contracts §12（150 ticks） |
| `clamp = 0.25` | **FROZEN**（双重身份） | ① schema 硬界：`MoodV0.baseline ∈ [0, 0.25]`（freeze §6.3；spec §14 写作 `[0, clamp]`）；② reference coefficient：`legacy_reference_defaults.clamp` 字面量 |
| `strength = clamp01(relevance × intensity)` | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §5；micl §22 仅冻结 `{channel, strength}` 概念 |
| 路由阈值 `0.5` 与分支优先级 | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §6 |
| `goal_congruence == 0.5` 不激活 | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §6 |
| hold → release 规则（age ≥ tHold） | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §7/§8（相名映射冻结于 spec §15） |
| `exp(-release_ticks / tau)` 闭式应用 | **FROZEN SHAPE + V0 exact application** | 形态：transition-contracts §12；精确应用方式：本契约 §8 |
| `fast_level = max(intensity, 0)` | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §9 |
| EMA 递推（选项 A，e 次离散步） | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §10（alpha 值 FROZEN） |
| 容量替换规则（最低强度 + 冻结序 tie-break） | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §14 |
| release floor `0.01` | **PROHIBITED / REMOVED** | 无任何已提交来源；本契约明确禁止 |
| 恒等 delta（零激活 Observation） | **FAST_EMA_V0 REFERENCE POLICY** | 本契约 §13 |

**FROZEN CONFIG（仅读自 `mechanism_config`）：** `tHold`、`alpha`、`tau`、`clamp`。
**REFERENCE POLICY CONSTANTS：** `0.5` 路由阈值（×3 处比较 + 1 处 `==` 判定）、容量 4。
**PROHIBITED HIDDEN CONSTANT：** `0.01` release floor。
**无其他影响轨迹的数值字面量。** 实现中任何轨迹魔法数（除本表所列）即契约违规。

## 16. Explicitly Deferred Research Questions（不属 FAST_EMA_V0）

- 极性（valence）缺失问题：MoodV0 非负标量无符号维度，如何表达正负情绪方向（§9 限制声明）。
- 多通道并行对 mood 的聚合是否应为加权/求和而非 max。
- 衰减指数形式是否应替换为其他核（sigmoid、piecewise linear）。
- `attribution` 冲突解决（`MUST_RESOLVE_BEFORE_P2_3_5`，上游问题）。
- 真实秒级 timebase 的确定性适配（transition-contracts §12：未来显式 `timebase` + adapter）。
- 容量替换策略是否应为"最老优先"等替代规则。

以上全部是研究/设计问题；FAST_EMA_V0 冻结当前裁定，不等待这些问题。

## 17. Conformance Test Requirements（P2.3.4.1 回归基准）

测试必须逐字节匹配本契约（每项对应既有 A1–A13 矩阵的映射已在实现测试中落位）：

- 确定性/重放：同输入双跑与 ≥4 次隔离运行序列化全等（A1/A10）。
- Observation：`strength = clamp01(relevance × intensity)`；路由表全分支（含 `== 0.5` 不激活、strength 0 不激活）；upsert 重置语义；单步 EMA 值精确等于 `mood + alpha × (fast_level − mood)`（同序浮点）。（A2/A3/A4）
- Time：闭式释放——对跨 tHold 推进，`release_ticks` 按 §8 公式逐通道验证；强度等于 `intensity × exp(-release_ticks / tau)`（同序浮点）；EMA 按 e 次递推验证（A5/A12）。
- 恒等 delta：零激活 Observation 与 `elapsed == 0`（producer 级）产出逐字节快照值（A6）。
- 容量：4 通道全满 + 新通道 ⇒ 替换 intensity 最小者（并列按冻结序）；不产生第 5 个通道（A7 边界）。
- 数值卫生：无 NaN/Infinity/-0；mood 恒在 `[0, clamp]`（A7）。
- fail-closed：非法配置（NaN/Infinity/越界）、形状失配（Observation 无 appraisal、Time 带 appraisal、非整数/负 elapsed）⇒ 抛错不产出（A8）。
- 无突变：深冻结输入字节不变（A9）。
- 边界：producer 不触碰 memory/retrieval/LLM/clock（A13）；Time 集成零检索调用、零 memory 写入（A13）。
- 积分：Observation 恰好一次原子提交、单 trace、domains `[affect, context]`（A11）；Time 合法 `+1` 提交（A12）。

---

## 18. Contract Consistency Review（§20 要求）

对照六份冻结文档逐项核对（本契约不引入新 schema 字段、新错误码、新 writable path、新 producer 身份）：

| 冻结文档 | 相关条款 | 核对结论 |
|---|---|---|
| `subjectstate-v0-spec.md` | §14（mood 字段/值域）、§15（相名与映射）、§18（四参数/闭空 thresholds） | 一致：本契约只用冻结字段与相名；`[0, clamp]` 硬界遵守；未向 `thresholds` 写入任何 key |
| `transition-contracts.md` | §12（`exp(-elapsed_ticks / tau_ticks)` 形态、tick 语义）、§13（Time NO_OP/逐项演化） | 一致：§8 采用其闭式形态；`elapsed=0` 语义原样保留 |
| `micl-design.md` | §22（bridge 概念 + illustrative 映射，非规范）、§23（mood 慢 baseline、不直设） | 一致：bridge 具体化为 VERSIONED REFERENCE POLICY；mood 只经 EMA 推导；attribution 零依赖 |
| `p1-5-engineering-acceptance-contract.md` | §16（A5 持久/衰减连续性）、A8（时间语义） | 一致：无 schema 变化；确定性/持久语义兼容 |
| `p2-1-contract-freeze.md` | §6.3（Affect/Mood/Channel 字段与界）、§7.2（writable paths）、§12（配置字面量） | 一致：仅产出 `/affect` + `/mood`；四参数 literal 只读 |
| `p2-3-runtime-plan.md` | §2.1（affect 域 `/mood`+`/affect`、Time+Observation）、§2.2（producer 规则）、§5（Time/Observation 必需 delta） | 一致：producer 身份、分区、delta 组装、恒等 delta 语义均符合 |

**结论：无 CONFLICT。** 此前所有 BLOCKING 项均为 UNSPECIFIED（未禁止），本契约已将其逐项裁定为 FAST_EMA_V0 reference policy 或直接移除（0.01）。

## 19. Required Implementation Changes（CONTRACT_READY 附带的差距清单）

现有未提交实现（`packages/runtime/src/producers/reference-fast-ema-affect-producer.ts`）在提交前必须变更，以逐字节符合本契约：

1. **移除 `RELEASE_FLOOR = 0.01`**：删除该常数、其过滤逻辑（`intensity >= RELEASE_FLOOR` 分支）及相关测试断言（"长时程后通道移除"类断言改为"通道保留、强度按闭式衰减"）。
2. **释放衰减改为闭式**：把"逐 tick `× exp(-1/tau)` 迭代"替换为 §8 的 `release_ticks` 一次应用公式（`exp(-release_ticks / tau)`）。
3. **EMA 多 tick 语义对齐**：Time 模式改为"先闭式衰减全部通道 → 计算推进后 fast_level → 以常量 fast_level 离散递推 e 次"，替代现实现的"逐 tick 衰减与 EMA 交错"。
4. **补齐容量替换策略**：现实现 upsert + 追加，4 通道全满时新通道会构造出第 5 个通道（提交时被 schema 拒绝）；必须实现 §14 规则 3（最低强度 + 冻结序 tie-break），并补容量测试。
5. **数值卫生对齐**：显式 `clamp01`（语义等价，但需与契约文本一致）；`normalize` 用于所有产出值（现状已隐含等价，需形式化）。
6. **更新测试镜像**：`mirrorTimeEvolution` 等测试镜像函数必须按 §8/§10 新语义改写（闭式 + 常量 fast_level 递推），并新增 §17 容量/替换测试。

**本契约文档之外零改动**：无 runtime 代码修改、无测试修改（本轮只交付契约；实现对齐留待隔离指令）。

---

**FINAL PRINCIPLE：** 我们不是在冻结一种人类情绪理论；我们在对一个确定性工程基线做版本化。`FAST_EMA_V0` 必须可以在不改变 CharacterOS-Next 核心架构的前提下被替换。
