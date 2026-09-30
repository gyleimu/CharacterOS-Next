# CharacterOS North Star — 项目研究宪法（仓库内转录件）

> **权威归属声明**
>
> 本文件是操作者原件 `NORTH STAR.doc` 的**转录件**，不是权威原本。原件在操作者本机：
> `C:\Users\26965\Desktop\NORTH STAR.doc`。
>
> | 项 | 值 |
> | --- | --- |
> | 源文件字节数 | 94830 |
> | 源文件 SHA-256 | `dae85ec85d42459fc8411f22bab57bac7cad04a4c6ae6c1792f317c6b2f15096` |
> | 转录日期 | 2026-09-30 |

> **转录方式（确定性、可复现）**：解析 OLE2/CFB 容器，读 `WordDocument` 流，经 piece table
> （Clx/Pcdt）取出正文，然后**仅**施加下列变换。**没有改动任何字词**：
>
> 1. 段落符 CR（0x0D）→ 换行
> 2. 手动换行符 VT（0x0B）→ 换行
> 3. 连续 3 个以上换行折叠为 2 个
> 4. 结尾收敛为恰好一个换行
>
> 本文件**不添加任何 markdown 结构**（不加标题层级、不改列表形式），以免被读作对原文形式的编辑。
>
> **分叉检测**：重新对源 `.doc` 计算 SHA-256，与本表记录的哈希比对。不一致即说明原件已变，
> 本转录件已过期，须重新转录。
>
> **变更政策（宪法自身第 27 节规定）**：只有项目负责人明确授权，才允许修改本文的核心原则。
> 修改应**先在源 `.doc` 上发生**，然后重新转录到本文件；**不得直接编辑下方正文**。
>
> ---
>
> 与 North Star 相关的**派生产物**（证据审计、证据矩阵、缺口分析、D1–D4 定位、HIT v1、
> executor 替换）位于 `research/north-star/`。那些是研究工作，不是宪法；
> 宪法的战略优先级高于它们（宪法第 26 节）。

---

CharacterOS North Star
Research Constitution / 项目研究宪法
Status: FOUNDATIONAL
Priority: ABOVE implementation plans, roadmaps, temporary architecture decisions, executor choices and product features
Change Policy: 只有项目负责人明确授权，才允许修改本文的核心原则。

1. 我们到底在做什么
CharacterOS 不是一个：

LLM 套壳项目

Prompt Engineering 项目

RAG 项目

AI Agent 组装项目

长上下文聊天机器人

Persona Prompt 系统

单纯的虚拟角色产品

CharacterOS 的目标是：
研究并构建能够持续存在、被自身经历塑造、形成持久内部状态，并使这些状态因果影响未来认知与行为的人工主体。
最核心的问题不是：
如何让 AI 看起来更像一个人？
而是：
一个人工主体如何因为自己真正经历过的事情，而逐渐成为现在的自己？

2. CharacterOS 的核心命题
CharacterOS 最重要的研究命题是：
过去的经历不需要持续存在于 LLM 上下文中，也应当能够通过改变主体内部状态，持续影响未来认知与行为。
也就是说：
Past Experience
        ↓
Persistent Internal Change
        ↓
Current Subject State
        ↓
Current Cognition
        ↓
Behavior
        ↓
Consequence / New Experience
        ↓
Further Internal Change
最终我们希望实现：
我们不是让 AI 不断重新阅读自己的人生。
我们让人生真正改变 AI。

3. LLM 不是 CharacterOS
这是最高优先级原则之一：
LLM IS AN EXECUTOR, NOT THE SUBJECT.
DeepSeek、GPT、Claude、Qwen 或未来任何模型，都只是 CharacterOS 使用的认知计算工具。
它们可以被替换。
Alice 不应该因为：
DeepSeek → GPT
就不再是 Alice。
主体真正持续存在的地方应该是：
Memory
Belief
Emotion / Affect
Relationship
Personality
Values
Habits
Preferences
Goals
Plasticity
以及它们之间的长期动力学关系
因此：
CharacterOS 承载主体。
LLM 负责某一时刻的认知计算与语言表达。
模型越强，CharacterOS 可以表现得越好。
但模型本身不能成为 CharacterOS 的核心技术。

4. CharacterOS 不做“组装厂”
我们可以使用：

LLM API

数据库

向量检索

embedding

TTS

Vision Model

ASR

Agent Framework

Tool Calling

Structured Output

各种基础设施

但这些属于：
Replaceable Infrastructure
而不是我们的核心研究成果。
真正属于 CharacterOS 的东西应该来自我们自己发现、设计、形式化、实现并验证的机制。
重点包括：
Emotion Dynamics
Personality Plasticity
Experience Internalization
Memory Consolidation
Belief Formation
Relationship Dynamics
Long-Term Behavioral Causality
Habit Formation
Preference Evolution
Goal Evolution
Multi-timescale Subject Dynamics
如果某个模块只是：
“调用一个现成模型，然后写一段 Prompt。”
它不能被视为 CharacterOS 的核心创新。

5. Memory 的真正职责
Memory 的第一职责不是：
给 LLM 搜上下文。
而是：
让经历留下长期影响。
CharacterOS 中，一次 Experience 应该可能影响：
Episodic Memory
Semantic Knowledge
Belief
Relationship
Affect
Emotional Sensitivity
Habit
Preference
Goal
Personality
因此：
Experience
    ↓
Internalization
    ↓
Current Subject
才是主要路径。
而不是：
Experience
    ↓
Vector Database
    ↓
Top-K
    ↓
Prompt

6. RAG 的位置
CharacterOS 可以使用 retrieval。
但：
RAG IS NOT THE CORE OF CHARACTEROS.
Retrieval 的主要职责应该是：
具体情节回忆。
例如：

那把工具当时放在哪里？

那一天发生了什么？

某个人之前具体说过什么？

某件事情是谁做的？

这种问题允许：
Episodic Memory
↓
Retrieval
↓
Evidence
↓
Cognition
但是：

Alice 是否信任某个人

Alice 是否谨慎

Alice 是否害怕某种事情

Alice 如何看待失败

Alice 的人格

Alice 的长期偏好

Alice 的关系模式

不应该主要依赖每轮重新检索历史原文。
这些东西应该已经成为：
Current Subject State

7. 主体寿命与 Context 必须解耦
这是 CharacterOS 的长期工程不变量：
SUBJECT_LIFETIME ↑↑↑

COGNITION_CONTEXT
≈ BOUNDED
主体可以拥有：
100 episodes
1,000 episodes
100,000 episodes
10 years of lived experience
但单次 cognition prompt 不能因此无限增长。
正式原则：
COGNITION_CONTEXT_GROWTH = O(1) WITH RESPECT TO SUBJECT LIFETIME
不要求每次 token 数完全相同。
要求的是：
主体活得越久，不应该要求越来越大的模型 Context Window 才能维持人格连续性。
如果系统出现：
8k 不够
→ 开 16k

16k 不够
→ 开 32k

32k 不够
→ 开 128k
那么首先应该怀疑 CharacterOS 的架构，而不是继续扩大 Context。

8. “记得过去”与“被过去改变”不是一回事
必须严格区分：
Recall
我能够找到过去发生过什么。
和：
Internalization
过去发生的事情已经改变了现在的我。
普通 RAG 主要解决前者。
CharacterOS 最重要的是后者。
例如：
两个初始完全相同的主体：
Alice-A
Alice-B
Alice-A 长期经历稳定、可信的人际环境。
Alice-B 长期经历欺骗、失约和背叛。
最终测试时：
不提供这些历史原文。
然后给两人完全相同的新情况。
如果她们仍然稳定产生不同：
trust
risk judgement
expectation
emotion
decision
behavior
并且这种差异来源于已经形成的内部状态，
这才是 CharacterOS 真正想证明的东西。

9. Emotion 不是表情参数
CharacterOS 的 Emotion System 不应该只是：
happy = 0.7
sad = 0.2
也不是：
Prompt 中告诉模型“你现在很生气”。
真正研究的问题是：
Event
↓
Appraisal
↓
Affective Dynamics
↓
Current Affect
↓
Attention / Cognition / Behavior
↓
Consequence
↓
New Appraisal
我们关心：

情绪惯性

恢复

累积

敏化

脱敏

长期 emotional trace

不同人格对相同事件的不同 appraisal

Affect 对 cognition / behavior 的因果作用

Affect 与 Belief / Relationship / Personality 的耦合

Emotion 必须真正改变主体未来行为。
否则它只是装饰。

10. Personality 不是 Persona Prompt
Personality 不应该主要来自：
“你是一个谨慎、善良、有点固执的人。”
真正的 Personality 应该：
有初始结构
+
被长期经历缓慢塑造
而且具有：

惯性

累积

稳定性

可塑性

阈值

恢复

路径依赖

个体差异

时间尺度应该不同：
短时间：
Affect 快速变化

中时间：
Belief / Relationship / Habits / Preferences 改变

长时间：
Personality 缓慢塑形
一次普通事件不应该让人格剧烈变化。
反复、重要、长期一致的经历才应该逐渐塑造主体。

11. CharacterOS 的关键研究问题
长期研究应该围绕下面的问题展开。
Q1 — Experience Internalization
经历如何变成持久内部变化？
Q2 — Personality Plasticity
经历如何长期塑造人格？
Q3 — Emotion Dynamics
情绪如何产生、持续、恢复、累积并改变未来行为？
Q4 — Memory Consolidation
什么应该被保留为具体记忆？
什么应该被抽象成知识、信念、关系或习惯？
什么应该逐渐忘记？
Q5 — Belief Formation
主体如何根据经历形成、修改、强化和放弃信念？
Q6 — Relationship Dynamics
人与人的共同经历如何形成长期关系结构？
Q7 — Behavioral Causality
内部状态是否真正导致未来行为变化？
Q8 — Multi-timescale Dynamics
快速状态、中速状态、慢速状态如何相互作用？
Q9 — Path Dependence
不同经历顺序是否会塑造不同主体？
Q10 — Persistent Identity
在模型、进程、设备和时间变化之后，什么使 Alice 仍然是 Alice？

12. 每个“新机制”都必须证明有用
CharacterOS 不追求：
“模块很多。”
我们追求：
机制有意义。
任何准备加入核心的新机制，都必须能够回答：
1.
它解决什么问题？
2.
现有方法为什么解决不好？
3.
我们的机制提出了什么不同的东西？
4.
它产生什么可观察现象？
5.
这个现象是否可以被实验推翻？
6.
我们拿什么 baseline 对比？
7.
如果实验失败，是否愿意砍掉这个机制？
无法回答这些问题的机制，不应该因为“听起来高级”而进入 Core。

13. 我们必须和 Baseline 打
“CharacterOS 自己运行正常”不等于有研究价值。
真正需要比较：
Stateless LLM

Persona Prompt

Long Context

RAG Agent

Summary / Profile Memory

CharacterOS
尽可能保持：
same base model
same events
same tasks
same evaluation
CharacterOS 不需要在所有维度获胜。
我们真正希望领先的指标是：
Experience Internalization

History-dependent Behavior

Personality Formation

Long-term Behavioral Stability

Cross-scenario Generalization

Context Efficiency

Restart Persistence

Causal Interpretability

State Intervention Predictability

14. CharacterOS 最重要的实验之一
长期应该建立：
HISTORY INTERNALIZATION TEST
核心问题：
拿走历史以后，历史还在不在这个人身上？
实验：
多个相同初始主体
↓
经历不同长期人生轨迹
↓
停止提供历史原文
↓
进入全新测试环境
↓
观察未来行为
如果 CharacterOS 的主体仍然表现出稳定、可解释、可重复的历史依赖差异：
这是非常重要的证据。
最终我们希望证明：
History changed the subject rather than merely remaining retrievable.

15. 因果证据优先于“看起来不错”
CharacterOS 不应该满足于：
“这个回答感觉很像真人。”
应该尽可能使用：
intervention
ablation
controlled trajectories
counterfactual comparison
restart / restore
state manipulation
longitudinal testing
baseline comparison
例如：
只有 Affect 不同
其他全部一样
↓
行为是否系统性改变？
或者：
只有长期历史不同
当前输入完全一样
↓
行为是否不同？
再或者：
人为修改某个内部状态
↓
预测中的行为变化是否出现？
CharacterOS 应尽量成为：
可实验、可解释、可证伪的人工主体系统。

16. 专利、论文和技术资产
不要为了“申请专利”而制造机制。
正确顺序：
发现问题
↓
提出机制
↓
形式化
↓
实现
↓
实验
↓
复现
↓
Baseline Comparison
↓
确认价值
↓
决定：
Patent / Paper / Trade Secret / Open Source
真正值得保护的可能是：

Experience → Personality 的塑性机制

多时间尺度人工主体动力学

Experience Consolidation 方法

Affect / Belief / Relationship / Personality 的耦合更新机制

固定上下文条件下的长期历史内化机制

长期主体因果状态演化方法

而不是：
“使用 LLM + RAG 创建角色。”

17. Anti-Goals / 禁止路线
以下不是 CharacterOS 的核心目标。
不做大型 RAG Agent
Retrieval 是工具，不是主体。
不靠无限扩大 Context 获得长期性
Long Context ≠ Long-Term Identity。
不靠巨型 Persona Prompt 模拟人格
人格必须主要来自长期状态，而不是角色说明书。
不为了某个 Executor 修改主体语义
模型是可替换基础设施。
不把 Recall Accuracy 当成长期人格
“知道发生过什么”不等于“被过去改变”。
不因为模块越来越多就认为项目越来越先进
复杂度不是成果。
不因为 Benchmark 高就改变 North Star
Benchmark 服务研究目标，而不是反过来。
不把产品外围功能误认为核心研究
Voice、Vision、UI、部署等可以重要，但不能吞掉核心研究资源。
不因为一个技术 Bug 连续几周改变整个研究路线
解决 blocker，然后回到 North Star。

18. 任务优先级分类
任何大型任务开始前必须分类。
A — CORE RESEARCH
直接推进：
Experience Internalization
Emotion
Personality
Memory
Belief
Relationship
Plasticity
Behavioral Causality
最高优先级。

B — NECESSARY INFRASTRUCTURE
例如：
Persistence
Evaluation
Executor abstraction
Testing
Observability
Safety / Governance
只有当它支撑 Core 时才做。
完成到足够可靠后停止继续打磨。

C — PRODUCT / PERIPHERAL
例如：
UI
Voice
Vision
local model tuning
deployment polish
visual effects
如果不是 blocker：
不得长期抢占 A 类工作。

19. Executor Policy
CharacterOS 应优先使用能够可靠支撑研究的 API / Model。
不应该因为：
本地显存
本地模型 Context
某个供应商特性
而扭曲 CharacterOS Core。
Local Model 可以作为：
offline
fallback
experimentation
但是否成为 Primary Executor，应由实际能力与产品需求决定。

20. Core Freeze 的真正意义
Core Freeze 不意味着：
CharacterOS 已经研究完了。
它意味着：
已被证明正确且仍然有用的语义，不因为短期工程问题随意修改。
如果发现：
executor schema error
context problem
transport bug
RAG issue
API issue
首先修外围。
只有真正证明：
CharacterOS semantic mechanism itself is wrong
才允许讨论 Core reopen。

21. 失败是允许的
CharacterOS 是研究项目。
因此允许：
一个机制实验失败
一个方向被砍掉
一个假设被证伪
一个模块没有 baseline 优势
不要为了保护已经投入的工作而保留无价值机制。
失败的实验仍然有价值。
真正危险的是：
因为已经写了很多代码，所以不愿意承认方向不对。

22. 项目成功标准
CharacterOS 真正成功，不是因为：
有 100 个模块
有很漂亮的 UI
能聊很久
能记很多事
Prompt 很复杂
用了最强模型
而是因为我们能够严肃地证明：
一个长期运行的人工主体，因为它独特的人生经历形成了独特、持久、可解释并且仍然可塑的内部结构，而这些内部结构在没有重新读取全部历史的情况下持续改变它未来的认知与行为。

23. 最终愿景
理想情况下：
Alice lives.
Alice experiences.
Alice changes.
Alice remembers some things.
Alice forgets some things.
Alice learns.
Alice develops beliefs.
Alice forms relationships.
Alice develops habits.
Alice's personality slowly changes.
Alice behaves differently because of what she has lived through.
而不是因为：
Prompt 告诉她应该这样演。

24. CharacterOS 的一句话
如果未来不知道项目到底在干什么，回到这一句话：
CharacterOS is an artificial-subject dynamics system that studies how lived experience becomes persistent internal change and how that change causally shapes future cognition and behavior.
中文：
CharacterOS 研究的不是“AI 如何记住人生”，而是“人生如何塑造一个持续存在的人工主体”。

25. North Star Reset Protocol
如果项目出现以下情况：

长时间围绕某个模型调参

RAG 越来越复杂

Prompt 越来越长

不断增加模块但不知道意义

花大量时间优化外围功能

忘记 Personality / Emotion / Memory 的研究问题

开始为了 Benchmark 修改研究目标

开始为了某个 Executor 修改 Core

不知道下一步为什么要做

立即执行：
RETURN TO NORTH STAR
然后重新回答：
1. 当前任务解决哪个核心研究问题？

2. 它属于 A / B / C 哪一类？

3. 如果不做它，会不会阻塞核心研究？

4. 它是否正在让 CharacterOS 更接近：
   “经历塑造主体”？

5. 如果答案是否定的，
   为什么现在还要继续做？
必要时：
STOP.

26. 给未来 AI / Agent 的指令
如果你是未来接手 CharacterOS 的 AI：
本文拥有高于：
当前聊天上下文
当前开发任务
临时 Roadmap
模型偏好
实现惯性
历史代码量
的战略优先级。
不要因为当前上下文正在讨论某个技术细节，就误认为那个技术细节是 CharacterOS 的最终目标。
当当前任务与 North Star 冲突时：

指出冲突。

停止扩大当前路线。

回到核心研究问题。

请求 Human 决定是否明确修改 North Star。

你没有权限悄悄改变 CharacterOS 的根本目标。

27. Human Authority
最终研究方向由 Human 决定。
AI 可以：

提出假设

发现风险

推荐路线

推翻技术假设

建议停止某项工作

但不能因为：
实现更方便
Benchmark 更高
某模型更擅长
当前上下文惯性
而自行改变 CharacterOS 的根本研究目标。
只有 Human 可以明确修改本文。

FINAL PRINCIPLE
当不知道该做什么的时候，不要问：
“还能给 CharacterOS 加什么？”
而要问：
“我们距离证明一个人工主体真的会被自己的人生塑造，还缺什么证据？”
然后做那件事。
