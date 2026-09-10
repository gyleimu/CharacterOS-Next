# RESEARCH_STATE.md — CharacterOS-Next research state

Status: ACTIVE RESEARCH SUMMARY
Authority: 汇总当前研究主张、限制、失败与开放问题；不维护工程进度。当前实现与 blocker 见 [`CURRENT_STATE.md`](CURRENT_STATE.md)。
Last verified against commit: `d4503cc6fd3f93d9e88b39d7aa365c8ef456b441`
Purpose: 给出当前 claim taxonomy、evidence policy、methodology limits 与 open questions。

## 1. Claim taxonomy

当前与未来 summary 使用以下词汇，不回写历史冻结 verdict：

| 标签 | 含义 |
|---|---|
| `IMPLEMENTED` | 能力存在于当前可执行代码；不自动表示效果有效 |
| `MECHANICALLY_VERIFIED` | deterministic test/contract/gate 验证了工程性质 |
| `EXPERIMENTALLY_SUPPORTED` | 冻结实验在其模型、场景、样本和判据内支持主张 |
| `PARTIAL / SCENARIO-SENSITIVE` | 只支持部分路径、场景、阶段或 subordinate outcome |
| `NON-INFORMATIVE` | 运行因设计、transport、schema、样本或 gate 问题不能裁定目标主张 |
| `NOT_SUPPORTED` | 有效运行按预先定义判据未支持目标主张 |
| `HYPOTHESIS` | 可证伪但尚未得到足够证据的命题 |
| `OPEN` | 尚未形成可裁定答案的问题 |

工程测试量、可重放性和 schema correctness 不得被升级为心理学真实性、产品有效性或外部效度。

## 2. Evidence policy now

CharacterOS-Next 的实际政策是：实验、诊断及其已提交 evidence 是本仓库的一等 tracked assets。

- experiment harness/contract/report/evidence 位于 `research/experiments/**`；
- provider/environment diagnostics 及 evidence 位于 `research/diagnostics/**`；
- 每个冻结 artifact 保留其历史身份与 claim boundary；
- `tmp/`、运行中输出和未 seal 的中间状态不是 frozen evidence；
- 仓库根目录不存在统一 `evidence/` authority；
- 新 summary 可以收窄或澄清主张，不能篡改 raw evidence 或把失败改写成成功。

旧文档所写“所有实验必须在独立 CERH workspace 运行、本仓库只存 pointer”已被实际、长期且有提交历史的仓库实践取代，不再是当前政策。未来是否迁移到外部系统是独立治理决策，本次不移动现有资产。

## 3. Current supported knowledge

### Implemented and mechanically verified

- canonical SubjectState、single commit authority、trace/hash、atomic publish 与 restore contracts 已实现并有测试；
- Memory repository/revision、retrieval、provider-readable factual evidence、Experience encoding 与 Learning feedback 已实现并有测试；
- Appraisal validation、Canonical Affect reference application、cognition/language behavior 与 subject-session orchestration 已实现；
- deterministic/synthetic affect retention experiments support only the behavior of their frozen mathematical laws and corpora, not psychological correctness。

这些是工程事实。其精确成熟度在 `CURRENT_STATE.md`，不在本文件重复维护。

### Experimentally supported, bounded

- 冻结 Canonical Affect experiments support that controlled canonical valence differences can change validated cognition outputs for the tested provider/configuration and scenario sets；replication evidence broadens those tested scenarios/magnitudes but does not establish cross-model or universal behavior。
- 冻结 behavior → Experience → Memory work supports the tested end-to-end feedback path and durable factual-memory surface under its exact contract。
- `LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_V0` supports four chronological episodes, retrieval of prior lived evidence, and post-restore continuity in its single bounded real-provider scenario。

每项主张的正式 wording、denominator、failure handling 与 allowed inference 仍以对应 frozen report/contract 为准。

### Partial or scenario-sensitive

- downstream action/language effects remain model-, prompt-, schema-, action-space- and scenario-sensitive；不同实验中的 support、ambiguity 或 null outcome 不得合并成一个普遍效果。
- `LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0` implemented the reusable capability, completed 6/8 real interactions and achieved 2/2 exact restores, but failed at interaction 7；Memory continuity 与 autonomous orchestration 只能标为 `PARTIAL`。
- same-model semantic evaluation can support a bounded rubric classification but is not independent human ground truth。

### Failed, null or non-informative evidence

- 长程 session 的 principal verdict 是 `LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED`，不能因 subordinate restore/memory gates 通过而改名为 supported。
- transport-invalid、schema-invalid、incomplete 或 gate-invalid runs 保持失败/无信息证据；不能从 valid subset、replacement run 或 anecdote 推导被原协议禁止的 efficacy claim。
- 当前仓库不主张统计显著性、跨模型复现、跨人群外部效度或 psychologically correct emotion dynamics。

## 4. Methodology limits

1. 许多研究是 small-N、scenario-bounded 的工程/机制实验，不是确认性科学研究。
2. `phase-a` / `pre-call freeze` 表示仓库内在真实 generation 前固定计划并记录零调用；它不等于外部注册服务上的正式 preregistration。只有存在独立、可验证的外部记录时才能使用后者含义。
3. deterministic code、fixed corpus 和 exact replay 可以被机械验证；真实 provider 在 `temperature=0` 且 transport 不暴露 seed 时仍不能被宣称为普遍确定性。
4. blinded evaluator input 只说明特定字段未暴露。使用同一模型/供应商的 evaluator 不是 evaluator independence，也不是 human ground truth。
5. 除非 frozen protocol 明确定义并满足统计检验，否则只报告 descriptive counts/rates，不声称 statistical significance。
6. external validity 默认限制在实际测试的 model digest、provider version、prompt/schema、scenario、sample 和 runtime path；第二模型不可用意味着 cross-model generalization 未测试。
7. 失败、无效和不利结果必须与成功结果同样保存；不得静默重试、删样本或在观察输出后改变 N/metric/verdict rule。

## 5. Historical external inputs

两个早期审计仍是架构与研究历史输入，但不是当前可执行现实之上的超权威来源：

- CharacterOS legacy audit：提供旧内核能力与七类架构缺口的历史判断；
- `CharacterOS-Research-Direction-Audit`：独立于本仓库保存的六文档研究方向审计，带 135-entry evidence manifest；提供 FAST+EMA identity、no-overclaim 与 research-trigger 等历史裁决。

外部 bundle 的机器本地绝对路径不是可移植 repository contract，因此 active docs 不再使用合成的 workspace placeholder。需要逐字引用外部结论时，必须先重新验证可访问 bundle 与 manifest，而不是仅凭本文件转述。

## 6. Open questions

| 问题 | 状态 |
|---|---|
| 累计 session context 为什么使 cognition provider 在 interaction 7 返回截断/无效 JSON？ | `OPEN`；下一诊断为 `SUBJECT_SESSION_PROVIDER_OUTPUT_BUDGET_DIAGNOSTIC_V0`，治理 slice 内暂停 |
| long-horizon session 能否稳定完成 8/8 及更长 horizon？ | `OPEN`；不能由当前 6/8 外推 |
| 当前效果能否跨模型、provider version、prompt/schema 与更广场景复现？ | `OPEN` |
| 独立 human/heterogeneous evaluator 是否复核现有 semantic judgments？ | `OPEN` |
| llm-prompt、FAST+EMA、CharacterOS-v1 baselines 与通用 longitudinal/ablation/regression infrastructure 如何实现？ | `OPEN`；相关 evals 目录仍 reserved |
| affect-congruent retrieval 是否有净价值且不会形成自激偏差？ | `HYPOTHESIS`；不是当前 retrieval requirement |
| learned adapter、hidden steering 或 modified-model integration 是否有增量价值？ | `HYPOTHESIS`；现有证据不足 |

## 7. Current research boundary

本次 `REPOSITORY_GOVERNANCE_AND_ENGINEERING_REALITY_ALIGNMENT_V0` 不运行 provider diagnostic、不启动新实验、不重写 frozen evidence，也不改变 Affect/Appraisal/Memory/Retrieval/Cognition/Language/Behavior/Persistence/Restore/Session semantics。

新研究只有在具体问题、baseline、falsification rule、call budget、evidence path、failure semantics 与批准点全部明确后才能进入独立 slice。待注册的新假设使用 `research/README.md` 中的 hypothesis registry；历史假设继续留在其冻结 experiment contract 中。`research/hypotheses/` 本身是只含 `.gitkeep` 的保留占位目录——frozen artifact-isolation law 拒绝在其中新增任何文件。
