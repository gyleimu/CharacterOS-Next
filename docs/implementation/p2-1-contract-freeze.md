# P2.1 Subject Core Contract Freeze

**状态：** P2.1 Contract Freeze — **COMPLETE**。

**Coding readiness：** **READY FOR EXPLICIT AUTHORIZATION**。

**Implementation：** **NOT STARTED**。

**冻结基线：** `ecad40d7d31ae5b1d5245b487ce73afd919e82f2`

**交付性质：** docs-only contract closure。本文不包含 TypeScript/Python、validator、hash function、store adapter、test、runtime、Memory、Affect、MICL 或 LLM 实现。

---

## 1. Authority and closure rule

本文是 P1/P1.5 对 `p2-1-subject-core-plan.md` §1.2 G1–G11 的机器级冻结附录。四份上游权威文档均通过各自的 “P2.1 Contract Freeze Incorporation” 条款纳入本文；本文只裁定原文明确留待 implementation 前关闭的空白，不改变 SubjectState、四类 transition、MICL、Producer != Mutator、Memory ownership 或 affect/appraisal 因果顺序。

若旧示意与本文的 exact wire/schema/hash 值冲突，仅被点名的旧示意由本文取代；架构语义仍以上游 P1/P1.5 为最高约束。未来 coding agent 不得修改本文或上游 acceptance 来适配实现。

| Gate | Verdict | 冻结位置 |
|---|---|---|
| G1 Requirement index | **CLOSED** | §3：49 个唯一 MUST leaf；无 wildcard、无双 ID |
| G2 Golden S0 | **CLOSED** | §4：13 个顶层字段、全量物化、revision/time=0 |
| G3 Executable schema | **CLOSED** | §5–§7：closed object、typed ref、path/value、result schema |
| G4 Serialization/hash | **CLOSED** | §8–§9：JCS、SHA-256、projection、golden vectors |
| G5 Trace | **CLOSED** | §10：TraceEntry/Window/Cursor/History，capacity=64 |
| G6 Restore/context | **CLOSED** | §11：精确恢复完整 canonical snapshot，不静默 reset |
| G7 Affect config | **CLOSED** | §12：唯一 object schema 与 active authority |
| G8 Error/status | **CLOSED** | §13：code/status/reason 与 layer mapping |
| G9 Transition identity | **CLOSED** | §14：durable identity/attempt journal/fingerprint |
| G10 Atomic persistence | **CLOSED** | §15：唯一 atomic write port、CAS、recovery |
| G11 Retrieval executor | **CLOSED** | §16：runtime orchestration + memory service；非 subject-core |

全部 gate 均已关闭；没有 `TBD`、`UNKNOWN` 或 “implementation decides” 的 P2.1 MUST。

---

## 2. Frozen names and interpretation

| Concept | Frozen identifier |
|---|---|
| Subject schema | `subject-state-v0` |
| Subject version | `subject-v0` |
| Subject seed input schema | `subject-seed-input-v0` |
| Subject creation result schema | `subject-creation-result-v1` |
| Canonical serialization | `canonical-json-v1` |
| StateHash projection | `state-hash-v1` |
| SnapshotHash projection | `snapshot-hash-v1` |
| RepositoryRevisionHash projection | `repository-revision-hash-v1` |
| Proposal fingerprint | `proposal-fingerprint-v1` |
| Proposal schema | `canonical-transition-proposal-v1` |
| Persistence envelope schema | `subject-persistence-envelope-v1` |
| Committed result schema | `canonical-commit-result-v1` |
| Already-committed response schema | `already-committed-result-v1` |
| NO_OP result schema | `no-op-transition-result-v1` |
| Canonical error schema | `canonical-error-result-v1` |
| Creation/commit/restore admission error schema | `admission-error-result-v1` |
| Learning rebase result schema | `learning-rebase-result-v1` |
| Logical transition result schema | `logical-transition-result-v1` |
| Publish projection schema | `publish-observation-v1` |
| Trace entry schema | `trace-v1` |
| Trace window schema | `trace-window-v1` |
| Transition record schema | `transition-record-v1` |
| Atomic bundle schema | `atomic-commit-v1` |

Version strings are exact and case-sensitive. A future incompatible change requires a new version; adapters must not silently reinterpret or upgrade V0 bytes.

---

## 3. G1 — Authoritative requirement catalog

### 3.1 Catalog rules and counts

- **Total stable leaf Requirement IDs: 49.**
- **Severity: 49 MUST, 0 SHOULD in this catalog.**
- **P2.1 completion denominator: 28 MUST**（§3.2）。
- **Later-phase A1–A13 denominator: 21 MUST**（§3.3）；这些 ID 现在冻结，但不要求 P2.1 实现其 domain/workflow behavior。
- `ATOMIC-001` 是历史文本别名，唯一 ID 为 `TR-ATOMIC-001`；别名不得出现在 result/evidence/matrix。
- `TIME-*`、`TRACE-*`、`HASH-*`、`FAIL-*`、`IDEM-*`、`MICL-*` 只可作为文档搜索前缀，不是 requirement。
- `Oracle` 只能使用 P1.5 §33 的十个 exact token：`Exact Equality`、`Hash Equality`、`Set Equality`、`Range Constraint`、`Forbidden Mutation`、`Required Trace`、`Expected Failure Code`、`Revision Delta`、`Reference Integrity`、`Workflow Status`。`+` 表示同一 fixture 必须同时满足各 token；不得发明同义 oracle 名称。
- `Expected` 冻结 oracle 比较的具体方向、status/code 或状态变化；它不是自由文本判分规则。
- Evidence 使用 P1.5 §34 的完整文件名；本任务不创建 evidence 或 test。

### 3.2 P2.1 applicable MUST catalog（28）

| Requirement ID | Source | Sev. | Exact fixture IDs | Oracle | Expected | Evidence |
|---|---|---:|---|---|---|---|
| `SS-SCHEMA-001` | SubjectState §6–§19；本文件 §5–§7 | MUST | S0, SC-006B, SC-008, SC-014A | Exact Equality + Expected Failure Code | S0/valid restore equals the closed schema；invalid shape=`INVALID_SCHEMA` | fixture-results.json + failure-summary.json |
| `SS-IMMUTABLE-001` | SubjectState §23 | MUST | SC-001 | Exact Equality | pre-commit snapshot bytes remain unchanged | fixture-results.json |
| `SS-REVISION-001` | SubjectState §23；Transition §5 | MUST | SC-001, SC-003, SC-003B, SC-004A, SC-005, A10.6, A13.1 | Revision Delta | commit `+1`；non-commit `+0` | fixture-results.json + failure-summary.json |
| `SS-AUTH-001` | SubjectState §5；Transition §3/§8 | MUST | SC-002A, SC-002B, SC-002C, SC-009, A6.1, A6.2 | Forbidden Mutation + Expected Failure Code | no unauthorized canonical field changes；exact code per fixture | failure-summary.json |
| `SS-RESTORE-001` | SubjectState §22/§26；本文件 §11/§14 | MUST | SC-008, SC-011, A2.1, A2.2 | Hash Equality + Expected Failure Code | valid envelope restores exact hashes；invalid envelope or trusted commit-continuation/prepared binding fails closed | state-hash-manifest.json + failure-summary.json |
| `SS-RESTORE-002` | SubjectState §17/§22；本文件 §11 | MUST | SC-008B, A5.1 | Exact Equality + Hash Equality | all six Context fields and affect/mood restore exactly | state-hash-manifest.json |
| `TR-DET-001` | Transition §27 | MUST | SC-001, SC-010, SC-014B, A1.1, A1.2 | Exact Equality | admitted semantic outputs equal across replay/order variants | fixture-results.json |
| `TR-ATOMIC-001` | Transition §3/§5/§10 | MUST | SC-001, SC-005, SC-006C, SC-010, SC-011, A11.1 | Forbidden Mutation + Revision Delta | all domains commit together `+1` or all remain unchanged | transition-trace-manifest.json + failure-summary.json |
| `TR-CONFLICT-001` | Transition §6/§27 | MUST | SC-010, A11.1 | Expected Failure Code + Revision Delta | `DOMAIN_DELTA_CONFLICT` or fixture-specific invalid delta；loser `+0` | failure-summary.json |
| `MEM-REV-001` | SubjectState §11 | MUST | SC-006, SC-008, A2.1, A2.2 | Reference Integrity + Expected Failure Code | every bound revision/ref validates；R999=`INVALID_MEMORY_REVISION` | repository-revision-manifest.json + failure-summary.json |
| `MEM-OWN-001` | SubjectState §5/§9/§10 | MUST | SC-006B, A2.1 | Forbidden Mutation + Reference Integrity | only refs/config enter SubjectState；repository payload never does | state-hash-manifest.json + failure-summary.json |
| `MEM-ORPHAN-001` | SubjectState §11；Transition §19 | MUST | SC-006C, A2.1, A10.8 | Reference Integrity + Revision Delta | failed canonical adoption leaves prepared revision noncanonical and state on prior revision | repository-revision-manifest.json |
| `LLM-AUTH-001` | SubjectState §28；Transition §26 | MUST | SC-002C, A6.1, A6.2 | Forbidden Mutation + Expected Failure Code | LLM text/proposal has no producer capability and cannot mutate state | failure-summary.json |
| `TRACE-ATOMIC-001` | Transition §10/§11；本文件 §10 | MUST | SC-001, SC-011, SC-012, A7.1, A7.2, A11.1 | Required Trace + Revision Delta | exactly one trace with each commit；none without commit | transition-trace-manifest.json |
| `TRACE-CONTENT-001` | SubjectState §21；本文件 §10 | MUST | SC-001, SC-011B, A7.1, A7.2 | Exact Equality + Reference Integrity | TraceEntry equals §10 schema and cross-field bindings | transition-trace-manifest.json |
| `TRACE-HISTORY-001` | SubjectState §21；Transition §11 | MUST | SC-011B, A7.2 | Required Trace + Reference Integrity | 65/65 committed entries reconstruct after window eviction | transition-trace-manifest.json |
| `TRACE-REJECT-001` | SubjectState §21/§25 | MUST | SC-002A, SC-002B, SC-002C, SC-003, SC-005, SC-006, SC-009, A7.1, A10.1, A10.2, A10.3, A10.4, A10.5, A10.6, A10.7, A10.8, A10.9, A10.10, A10.11 | Exact Equality + Forbidden Mutation + Expected Failure Code | no TraceEntry；durable AuditEvent only where §7.5 admits an attempt | failure-summary.json |
| `HASH-DET-001` | SubjectState §26；本文件 §8 | MUST | SC-001, SC-007, SC-008, SC-014B, A1.1, A1.2 | Hash Equality | equal admitted projections produce equal hashes | state-hash-manifest.json |
| `HASH-PROJ-001` | SubjectState §26；本文件 §8.3 | MUST | SC-007, SC-008, SC-008B, SC-014A, SC-014B | Hash Equality + Expected Failure Code | included changes alter stated projection；excluded data does not；corrupt input rejects | state-hash-manifest.json + failure-summary.json |
| `HASH-SER-001` | SubjectState §26；本文件 §8.2 | MUST | SC-007, SC-008, A1.1, A1.2 | Exact Equality + Hash Equality | canonical bytes and SHA-256 equal their golden values | state-hash-manifest.json |
| `HASH-SNAPSHOT-001` | SubjectState §26；本文件 §8.4 | MUST | SC-007, SC-008 | Hash Equality + Expected Failure Code | exact StateHash/trace position gives exact SnapshotHash；mismatch rejects | state-hash-manifest.json + failure-summary.json |
| `FAIL-PRECOMMIT-001` | SubjectState §25；Transition §23 | MUST | SC-002A, SC-002B, SC-002C, SC-003, SC-005, SC-006, SC-009, SC-011, SC-014A, A10.6, A10.8, A13.1 | Expected Failure Code + Revision Delta | exact fixture code；attempted commit contributes `+0` | failure-summary.json |
| `FAIL-CAS-001` | Transition §24；本文件 §15 | MUST | SC-003B, A10.9 | Expected Failure Code + Revision Delta | `COMMIT_CONFLICT`；losing attempt contributes `+0` | failure-summary.json |
| `FAIL-PUBLISH-001` | Transition §9/§25；本文件 §15 | MUST | SC-012, A10.10 | Workflow Status + Revision Delta | canonical `COMMITTED/+1` remains authority；publish projection recovers | fixture-results.json + failure-summary.json |
| `IDEM-COMMIT-001` | Transition §22；本文件 §14 | MUST | SC-004A, SC-013, A10.10, A12.1, A12.4 | Workflow Status + Revision Delta | `ALREADY_COMMITTED` returns original refs；retry `+0` | fixture-results.json |
| `IDEM-REUSE-001` | Transition §22；本文件 §14 | MUST | SC-004B, A10.10, A12.2 | Expected Failure Code + Revision Delta | `TRANSITION_ID_REUSE`；identity/attempt/terminal fields unchanged，conflict successor appended；`+0` | failure-summary.json |
| `IDEM-RETRY-001` | Transition §22；本文件 §14 | MUST | SC-004C, A12.3 | Workflow Status + Revision Delta | same rejected/aborted fingerprint or stable pre-proposal stage retry follows its frozen identity domain；no implicit duplicate commit | fixture-results.json |
| `IDEM-RECOVERY-001` | Transition §22；本文件 §14/§15 | MUST | SC-012, SC-013, A12.3 | Reference Integrity + Revision Delta | authoritative chain/workflow record rebuilds derived views；no duplicate revision/trace | fixture-results.json |

### 3.3 Remaining A1–A13 leaf catalog（21，已冻结，后续 phase 实现）

These IDs share the same 49-ID namespace but are **NOT_DUE / NOT_EXECUTED** during P2.1; neither label means PASS or N/A. P2.5 still requires 49/49 MUST PASS.

| Requirement ID | Source | Sev. | Exact fixture IDs | Oracle | Expected | Evidence | Owner | Earliest phase / current status |
|---|---|---:|---|---|---|---|---|---|
| `MEM-RET-DET-001` | MICL §12–§15 | MUST | A1.1, A3.1, A3.2 | Set Equality + Exact Equality + Range Constraint | fixed revision/query/config gives exact refs/order/scores/evidence；`candidate_count` is a nonnegative safe integer；each normalized ranking-evidence reason is `UnitIntervalV0`；final score is finite and equals its golden value | fixture-results.json | memory | P2.2 / NOT_DUE |
| `MICL-DET-001` | MICL §5–§9 | MUST | A1.1, A1.2 | Exact Equality + Hash Equality | exact stage sequence and semantic outputs across replay | conformance-report.json | runtime/micl | P2.4 / NOT_DUE |
| `MEM-RET-HISTORY-001` | P1.5 A3 | MUST | A3.1 | Set Equality + Reference Integrity | H1/H2 equal their own frozen expected sets and those sets differ | fixture-results.json | memory | P2.2 / NOT_DUE |
| `MEM-RET-CONTROL-001` | P1.5 A3 | MUST | A3.2 | Set Equality | irrelevant-history control preserves selected relevant set | fixture-results.json | memory | P2.2 / NOT_DUE |
| `MICL-RETRIEVAL-001` | MICL §13/§16–§19 | MUST | A4.1 | Exact Equality + Hash Equality | each controlled input equals its golden appraisal-input hash；the two golden values differ | fixture-results.json | runtime/appraisal | P2.3 / NOT_DUE |
| `MICL-STAGE-001` | MICL §7/§18 | MUST | A4.2 | Expected Failure Code + Workflow Status | `REJECTED/INVALID_STAGE_DEPENDENCY` | failure-summary.json | runtime/appraisal | P2.3 / NOT_DUE |
| `LLM-EVID-001` | MICL §18 | MUST | A4.3 | Expected Failure Code + Forbidden Mutation | `REJECTED/UNSUPPORTED_EVIDENCE_REF`；no canonical write | failure-summary.json | appraisal | P2.3 / NOT_DUE |
| `SS-AFFECT-001` | SubjectState §14–§16/§22 | MUST | A5.1, A5.2, A5.3 | Exact Equality + Hash Equality | affect/mood restore byte-for-byte and hash-for-hash；later evolution uses that persisted state | state-hash-manifest.json | affect/runtime | P2.4 / NOT_DUE |
| `TIME-AFFECT-001` | Transition §12/§13；MICL §23 | MUST | A5.2, A5.3 | Exact Equality + Hash Equality | frozen elapsed/config/current state gives exact next affect/mood/hash | fixture-results.json | affect/transition | P2.3 / NOT_DUE |
| `TIME-NOOBS-001` | Transition §4/§13 | MUST | A5.3, A8.1 | Revision Delta + Workflow Status | positive elapsed can commit `+1` without Observation | transition-trace-manifest.json | transition | P2.3 / NOT_DUE |
| `TRACE-CHAIN-001` | MICL §35；P1.5 A7 | MUST | A7.2 | Required Trace + Reference Integrity | all seven MICL semantic links reconstruct from authoritative records | transition-trace-manifest.json | runtime/micl | P2.4 / NOT_DUE |
| `TIME-ADVANCE-001` | Transition §12/§13 | MUST | A8.1 | Revision Delta + Exact Equality | logical time advances exact elapsed ticks and revision `+1` | fixture-results.json | transition | P2.3 / NOT_DUE |
| `TIME-NOOP-001` | Transition §13 | MUST | A8.2 | Workflow Status + Revision Delta | durable `NO_OP`；revision/logical time/hash/trace unchanged | fixture-results.json | transition | P2.3 / NOT_DUE |
| `TIME-OCCURRENCE-001` | MICL §8/§9 | MUST | A8.3, A8.4, A8.5 | Exact Equality + Expected Failure Code + Workflow Status | future/equal/past occurrence follows §17.3 exact sequence/status | transition-trace-manifest.json + failure-summary.json | runtime/transition | P2.3 / NOT_DUE |
| `TIME-WALL-001` | SubjectState §20/§26 | MUST | SC-014B, A1.2, A8.6 | Hash Equality | wall-clock/log variation leaves canonical bytes/hash unchanged | state-hash-manifest.json | transition/core | P2.3 / NOT_DUE |
| `MICL-ACTION-001` | MICL §6/§7 | MUST | A9.1 | Workflow Status + Set Equality | `COMPLETED` with `external_effect_refs=[]` and no Action/Outcome | conformance-report.json | runtime/micl | P2.4 / NOT_DUE |
| `FAIL-SERVICE-001` | Transition §14/§23；MICL §33 | MUST | A10.1, A10.2, A10.3, A10.4, A10.5 | Expected Failure Code + Revision Delta + Workflow Status | exact §17.3 failure row；failed stage contributes `+0` | failure-summary.json | runtime/domain | P2.4 / NOT_DUE |
| `FAIL-PREPARE-001` | Transition §17/§19 | MUST | A10.7 | Expected Failure Code + Revision Delta + Reference Integrity | `ABORTED/SERVICE_UNAVAILABLE`；no canonical adoption or orphan revision | repository-revision-manifest.json + failure-summary.json | memory/runtime | P2.4 / NOT_DUE |
| `MICL-RESUME-001` | MICL §31/§32 | MUST | A10.11, A12.3 | Workflow Status + Revision Delta | completed duplicate returns original；incomplete retry resumes only incomplete stage | conformance-report.json | runtime/micl | P2.4 / NOT_DUE |
| `MEM-IDEM-001` | MICL §26/§28/§32 | MUST | A12.4 | Set Equality + Reference Integrity | retry leaves exactly one episodic record/ref | repository-revision-manifest.json | memory/runtime | P2.4 / NOT_DUE |
| `REBASE-STALE-001` | Transition §17；P1.5 A13 | MUST | A10.8, A13.1 | Forbidden Mutation + Revision Delta + Workflow Status | safe rebuild uses new ID or returns `REBASE_REQUIRED`；never edits only expected revision | failure-summary.json | runtime/learning | P2.4 / NOT_DUE |

### 3.4 A1–A13 exact membership

| Acceptance | Exact Requirement IDs |
|---|---|
| A1 | `HASH-DET-001`, `HASH-SER-001`, `TR-DET-001`, `MEM-RET-DET-001`, `MICL-DET-001`, `TIME-WALL-001` |
| A2 | `MEM-REV-001`, `MEM-OWN-001`, `MEM-ORPHAN-001`, `SS-RESTORE-001` |
| A3 | `MEM-RET-DET-001`, `MEM-RET-HISTORY-001`, `MEM-RET-CONTROL-001` |
| A4 | `MICL-RETRIEVAL-001`, `MICL-STAGE-001`, `LLM-EVID-001` |
| A5 | `SS-AFFECT-001`, `SS-RESTORE-002`, `TIME-AFFECT-001`, `TIME-NOOBS-001` |
| A6 | `SS-AUTH-001`, `LLM-AUTH-001` |
| A7 | `TRACE-ATOMIC-001`, `TRACE-CONTENT-001`, `TRACE-HISTORY-001`, `TRACE-REJECT-001`, `TRACE-CHAIN-001` |
| A8 | `TIME-ADVANCE-001`, `TIME-NOOP-001`, `TIME-OCCURRENCE-001`, `TIME-WALL-001`, `TIME-NOOBS-001` |
| A9 | `MICL-ACTION-001` |
| A10 | `FAIL-PRECOMMIT-001`, `FAIL-CAS-001`, `FAIL-PUBLISH-001`, `FAIL-SERVICE-001`, `FAIL-PREPARE-001`, `TRACE-REJECT-001`, `SS-REVISION-001`, `MEM-ORPHAN-001`, `REBASE-STALE-001`, `IDEM-COMMIT-001`, `IDEM-REUSE-001`, `MICL-RESUME-001` |
| A11 | `TR-ATOMIC-001`, `TR-CONFLICT-001`, `TRACE-ATOMIC-001` |
| A12 | `IDEM-COMMIT-001`, `IDEM-REUSE-001`, `IDEM-RETRY-001`, `IDEM-RECOVERY-001`, `MICL-RESUME-001`, `MEM-IDEM-001` |
| A13 | `SS-REVISION-001`, `FAIL-PRECOMMIT-001`, `REBASE-STALE-001` |

The A tables contain 57 membership occurrences and 45 unique IDs；shared leaf IDs intentionally serve more than one acceptance group. Four global cross-cutting P2.1 MUSTs are not assigned to a single A group: `SS-SCHEMA-001`, `SS-IMMUTABLE-001`, `HASH-PROJ-001`, `HASH-SNAPSHOT-001`. Therefore `45 + 4 = 49`; this is not a missing-requirement gap.

---

## 4. G2 — Golden SubjectState S0

### 4.1 Materialization rule

`SubjectSeedInputV0` is a noncanonical closed creation input. Its only allowed keys are:

| Key | Presence | Exact type / absent default |
|---|---|---|
| `schema_version` | required | literal `subject-seed-input-v0` |
| `subject_id` | required | `IdentifierV0` |
| `display_name` | optional | NFC string；absent → `""` |
| `creation_source` | optional | `IdentifierV0|null`；absent → null |
| `seed_version` | optional | `IdentifierV0|null`；absent → null |
| `identity_anchors` | optional | exact ordered unique NFC string array；absent → `[]` |
| `self_schema_seed_refs` | optional | exact set-like seed-schema refs；absent → `[]` |
| `trait_dimensions` | optional | exact §6.2 pattern map；absent → `{}` |

No canonical container (`identity`, `memory_state`, `mechanism_config`, `trace_window`, `runtime_metadata`, etc.), repository revision, hash or core-derived field is accepted in this seed. Initialization copies the admitted seed values into Identity/Traits, materializes every other field with the §4.2 defaults (`R0` and frozen MechanismConfig included), validates the injected R0 binding, and emits `SubjectStateV0`, a fully materialized immutable revision-0 snapshot. Golden S0 is the result for `subject_id="subject-s0"` with every optional seed key absent. Every top-level and listed nested key in `SubjectStateV0` is required；there is no `undefined` or absent/default equivalence after creation.

P2.1 creation is the pure, non-persisting operation `materializeSeed(seed,R0Binding)`. Its success value is one closed `SubjectCreationResultV1`:

| Key | Exact contract |
|---|---|
| `schema_version` | literal `subject-creation-result-v1` |
| `status` | literal `CREATED`（creation-only status；not a transition/MICL status） |
| `subject_id` | admitted seed subject ID |
| `snapshot` | exact fully materialized revision-0 `SubjectStateV0` |
| `state_hash` | exact §8.3 hash of snapshot |
| `snapshot_hash` | exact §8.4 hash of snapshot |
| `persistence_envelope` | exact §11 `PersistedSubjectEnvelopeV1` with R0 binding and null commit head |

Success creates no transition identity, revision increment, TraceEntry, MutationHistory or AuditEvent. Invalid seed shape/value returns `AdmissionErrorResultV1(operation=CREATE,error_code=INVALID_SCHEMA,reason=SS-SCHEMA-001)`；missing/corrupt R0 returns `INVALID_MEMORY_REVISION/MEM-REV-001`；validator unavailable returns `SERVICE_UNAVAILABLE/FAIL-SERVICE-001`. Persistent subject-ID uniqueness, genesis adoption and store collision are deliberately **not** hidden inside this pure operation and require a separately frozen persistence workflow before any adapter may expose them；P2.1 code may not invent overwrite/upsert semantics.

Restore is different: it accepts only a fully materialized persisted `SubjectStateV0`. Missing, extra, unknown-version or invalid fields are `INVALID_SCHEMA`; restore never supplies defaults.

### 4.2 Exact S0 fixture（13 top-level fields）

```json
{
  "schema_version": "subject-state-v0",
  "identity": {
    "subject_id": "subject-s0",
    "display_name": "",
    "origin_metadata": { "creation_source": null, "seed_version": null },
    "identity_anchors": [],
    "self_schema_seed_refs": []
  },
  "traits_seed": { "dimensions": {} },
  "memory_state": {
    "working_refs": [],
    "active_episode_refs": [],
    "autobiographical_index_revision": null,
    "repository_revision": "R0",
    "consolidation_cursor": null,
    "retrieval_config": {
      "profile_id": "RETRIEVAL_V0",
      "affect_congruence_enabled": false,
      "recent_trace_capacity": 64
    },
    "recent_retrieval_trace": [],
    "lifecycle_metadata": {},
    "pending_encoding_refs": [],
    "last_retrieval_at": null
  },
  "beliefs": { "items": [] },
  "relationships": { "models": [] },
  "mood": {
    "baseline": 0,
    "generated_under_profile": null,
    "last_update": null
  },
  "affect": {
    "active_channels": [],
    "generated_under_profile": null,
    "updated_at": null
  },
  "regulation": {
    "energy": 1,
    "stress": 0,
    "arousal": 0.5,
    "fatigue": 0,
    "last_update": null
  },
  "context": {
    "scene": "idle",
    "task": null,
    "focus_refs": [],
    "active_entity_refs": [],
    "environment_refs": [],
    "current_observation_ref": null
  },
  "mechanism_config": {
    "affect_profile": { "profile_id": "FAST_EMA_V0", "timebase": "legacy_tick" },
    "legacy_reference_defaults": { "tHold": 60, "alpha": 0.06, "tau": 150, "clamp": 0.25 },
    "feature_flags": {},
    "thresholds": {}
  },
  "trace_window": {
    "trace_window_schema_version": "trace-window-v1",
    "capacity": 64,
    "cursor": {
      "last_history_sequence": 0,
      "offloaded_through_sequence": 0,
      "offloaded_through_trace_ref": null
    },
    "entries": []
  },
  "runtime_metadata": {
    "subject_version": "subject-v0",
    "state_revision": 0,
    "logical_time": 0,
    "last_transition_time": null,
    "last_transition_type": null,
    "created_at": 0,
    "updated_at": 0
  }
}
```

`schema_version` appears exactly once in the complete S0 tree and only at the top level. Nested trace components use the distinct keys `trace_window_schema_version` and `trace_schema_version`, so they cannot become a second SubjectState schema authority. `R0` is the frozen empty immutable repository revision in §9.3. Empty `{}` values above are instances of named **zero-key closed object types**, not arbitrary objects.

---

## 5. G3 — Schema primitives and reference model

### 5.1 Global schema rules

1. Every object is closed (`additionalProperties=false` conceptually); unknown keys reject.
2. Canonical numbers are finite IEEE-754 binary64 values. Integer fields are safe integers `0..9007199254740991`.
3. Canonical text must already be Unicode NFC, contain no NUL and no unpaired surrogate. Validation rejects rather than normalizes.
4. Identifier fields use ASCII and are case-sensitive.
5. Arrays reject duplicates; no validator silently deduplicates or reorders ordered arrays.
6. Canonical state, persisted envelopes and result records always carry nullable keys with explicit `null` when empty. The sole absent/default exception is the explicitly optional noncanonical `SubjectSeedInputV0` keys in §4.1；its materialized output uses explicit nulls.
7. `EmptyClosedObjectV0` has exactly zero keys. Its JSON value is `{}`, but no key can be added under V0.
8. Every “sorted/lexicographic” schema rule means ascending raw unsigned UTF-16 code-unit order (ASCII fields therefore use byte/code-point order), tuple components compared left-to-right. Canonical-byte tie-breakers use unsigned UTF-8 bytewise order. Locale collation, case folding and runtime registration order are forbidden.
9. A string/array/map without an explicit length/capacity bound has no additional canonical V0 count limit beyond its stated grammar and uniqueness rules；transport/resource limits are outside semantic admission and cannot silently change a conformant value.

### 5.2 Scalars

| Name | Exact contract |
|---|---|
| `IdentifierV0` | ASCII regex `^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$` |
| `TransitionIdV0` | globally unique `IdentifierV0`; opaque, no semantic parsing |
| `LogicalTimeV0` / `StateRevisionV0` / `HistorySequenceV0` | safe integer `0..9007199254740991` |
| `UnitIntervalV0` | finite number `[0,1]` |
| `ProfileIdV0` | exact `FAST_EMA_V0` for affect provenance/config |
| `RepositoryRevisionIdV0` | `IdentifierV0`; verified through injected `ReferenceValidator` capability |
| `HashV1` | `^sha256:[0-9a-f]{64}$` |
| `RequirementIdV1` | one of the 49 literals in §3; no unregistered ID |
| `FieldPathV0` | one exact classified literal from §7.2；not arbitrary JSON Pointer；`WritableFieldPathV0` is its explicit writable subset |

Successor arithmetic is always checked before candidate construction. A commit at `state_revision=9007199254740991` cannot produce a representable revision/history sequence and returns canonical `REJECTED/INVARIANT_VIOLATION`, reason `SS-REVISION-001`, with revision/hash unchanged, one rejection audit and no trace. Time addition never saturates, wraps, rounds or loses precision；`logical_time_before + elapsed_time.value` outside the safe-integer domain returns canonical `REJECTED/INVALID_LOGICAL_TIME`, reason `TIME-ADVANCE-001`, before candidate construction.

### 5.3 CanonicalRefV0

One wire grammar is used with field-specific kind allowlists:

```text
CanonicalRefV0 = <kind>:<id>

kind = audit | appraisal | commit | entity | environment | episode | event |
       experience | memory | observation | outcome | proposal | relationship |
       result | retrieval-trace | seed-schema | snapshot | source | subject | trace |
       workflow

id = [A-Za-z0-9][A-Za-z0-9._~-]{0,127}
```

Exact regex:

```text
^(audit|appraisal|commit|entity|environment|episode|event|experience|memory|observation|outcome|proposal|relationship|result|retrieval-trace|seed-schema|snapshot|source|subject|trace|workflow):[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$
```

| Field | Allowed ref kinds | Array semantics |
|---|---|---|
| `identity.self_schema_seed_refs` | `seed-schema` | set-like, lexicographic |
| `memory_state.working_refs` | `memory`, `episode`, `event` | ordered retrieval rank |
| `memory_state.active_episode_refs` | `episode` | ordered chronology |
| `memory_state.recent_retrieval_trace` | `retrieval-trace` | ordered oldest→newest ring |
| `memory_state.pending_encoding_refs` | `experience` | ordered insertion queue |
| `beliefs.items[].ref` | `memory`, `episode`, `observation`, `source` | items sorted by ref |
| `relationships.models[].target_ref` | `entity`, `subject` | models sorted by relationship_id |
| `affect.active_channels[].source_appraisal_ref` | `appraisal` | channels use fixed enum order |
| `context.focus_refs` | `entity`, `subject`, `memory`, `episode`, `observation`, `environment` | ordered priority |
| `context.active_entity_refs` | `entity`, `subject` | set-like, lexicographic |
| `context.environment_refs` | `environment` | set-like, lexicographic |
| `context.current_observation_ref` | `observation` or null | scalar |
| proposal `cause_refs` / `external_refs` / `provenance_refs` | `CanonicalRefV0`; all §5.3 enumerated kinds accepted, then owning stage validates semantic relevance | set-like, lexicographic |
| trace/audit/result linkage | matching `trace`, `audit`, `result`, `proposal`, `commit` | scalar or set-like as declared |
| prepared logical-result linkage | matching `workflow` | scalar |

Subject Core validates grammar/kind. Repository-bound refs are exactly `memory_state.working_refs` kinds memory/episode/event, `memory_state.active_episode_refs`, `memory_state.pending_encoding_refs`, and `beliefs.items[].ref` when kind is memory/episode；all validate against `memory_state.repository_revision` (the immutable current manifest must contain them). `memory_state.recent_retrieval_trace` and entity/environment/observation/source/appraisal refs receive grammar/kind validation only；their semantic existence belongs to the owning stage. `repository_revision` and non-null `autobiographical_index_revision` each require their own binding/hash validation. No entity/appraisal capability or domain dependency enters subject-core.

---

## 6. G3 — Executable SubjectState V0 catalog

### 6.1 Top-level authority and projection

All 13 fields are required in a canonical snapshot.

| Field | Producer/authority | Mutation | Persist | StateHash |
|---|---|---|---|---|
| `schema_version` | subject-core schema authority | init only | full | IN |
| `identity` | subject-core init | readonly | full | IN |
| `traits_seed` | subject-core init | readonly | full | IN |
| `memory_state` | memory producer, partitioned owner | Observation retrieval / Learning content | refs/config full | IN |
| `beliefs` | subject-core init | readonly V0 | full | IN |
| `relationships` | subject-core init | readonly V0 | full | IN |
| `mood` | affect producer | Time / Observation | full | IN |
| `affect` | affect producer | Time / Observation | full | IN |
| `regulation` | regulation producer | Time / CognitionAction | full | IN |
| `context` | context producer | Observation / CognitionAction | **full** | IN |
| `mechanism_config` | subject-core config/init | readonly V0 | full | IN |
| `trace_window` | subject-core | every commit | full bounded projection | **OUT** |
| `runtime_metadata` | subject-core | every commit | full | IN |

### 6.2 Exact nested types

| Type/field | Required type, creation default and validation |
|---|---|
| `schema_version` | literal `subject-state-v0`; no default on restore |
| `IdentityV0.subject_id` | `IdentifierV0`, required seed value, immutable |
| `IdentityV0.display_name` | NFC string, default `""` |
| `IdentityV0.origin_metadata` | closed `{creation_source: IdentifierV0|null, seed_version: IdentifierV0|null}`, defaults both null |
| `IdentityV0.identity_anchors` | unique NFC strings, ordered, default `[]` |
| `IdentityV0.self_schema_seed_refs` | typed set-like refs, default `[]` |
| `TraitsSeedV0.dimensions` | pattern map: key `^[a-z][a-z0-9_]{0,63}$`, value `UnitIntervalV0`, default empty; keys `trust`, `fear`, `attachment` forbidden |
| `MemoryStateV0.working_refs` | ordered typed refs, default `[]` |
| `MemoryStateV0.active_episode_refs` | ordered typed refs, default `[]` |
| `MemoryStateV0.autobiographical_index_revision` | `RepositoryRevisionIdV0|null`, default null, capability-valid when non-null |
| `MemoryStateV0.repository_revision` | required capability-valid `RepositoryRevisionIdV0`; S0=`R0` |
| `MemoryStateV0.consolidation_cursor` | `LogicalTimeV0|null`, default null; when non-null `<= logical_time` and nondecreasing |
| `MemoryStateV0.retrieval_config` | closed `{profile_id:"RETRIEVAL_V0", affect_congruence_enabled:false, recent_trace_capacity:64}`; init-only |
| `MemoryStateV0.recent_retrieval_trace` | typed ring, oldest→newest, length `<=64`, default `[]` |
| `MemoryStateV0.lifecycle_metadata` | `EmptyClosedObjectV0`, default `{}`; V0 adds no lifecycle fields |
| `MemoryStateV0.pending_encoding_refs` | typed insertion queue, default `[]` |
| `MemoryStateV0.last_retrieval_at` | `LogicalTimeV0|null`, default null; when non-null `<=logical_time` |
| `BeliefsV0.items` | array of closed `{ref,summary}`; `ref` typed, `summary` NFC string or null; unique/sorted by ref; default `[]`; readonly |
| `RelationshipsV0.models` | array of closed `{relationship_id:IdentifierV0,target_ref:EntityOrSubjectRef}`; unique/sorted by relationship_id; default `[]`; readonly |
| `MoodV0.baseline` | finite `[0,0.25]`, default `0` |
| `MoodV0.generated_under_profile` | `FAST_EMA_V0|null`, default null; provenance only |
| `MoodV0.last_update` | `LogicalTimeV0|null`, default null; `<=logical_time` |
| `AffectV0.active_channels` | array of `AffectChannelV0`, unique and ordered `anger,fear,sadness,joy`, default `[]` |
| `AffectV0.generated_under_profile` | `FAST_EMA_V0|null`, default null; provenance only |
| `AffectV0.updated_at` | `LogicalTimeV0|null`, default null; `<=logical_time` |
| `AffectChannelV0.channel_id` | exact enum `anger|fear|sadness|joy` |
| `AffectChannelV0.intensity` | finite `[0,1]` |
| `AffectChannelV0.phase` | exact enum `INACTIVE|ACTIVE|RELEASING` |
| `AffectChannelV0.started_at` | `LogicalTimeV0`, `<=logical_time` |
| `AffectChannelV0.source_appraisal_ref` | typed `appraisal` ref |
| `RegulatoryStateV0.energy/stress/arousal/fatigue` | each finite `[0,1]`; defaults `1/0/0.5/0` |
| `RegulatoryStateV0.last_update` | `LogicalTimeV0|null`, default null; `<=logical_time` |
| `WorkingContextV0.scene` | nonempty NFC string, default `idle` |
| `WorkingContextV0.task` | NFC string or null, default null |
| `WorkingContextV0.focus_refs` | typed ordered priority refs, default `[]` |
| `WorkingContextV0.active_entity_refs` | typed set-like refs, default `[]` |
| `WorkingContextV0.environment_refs` | typed set-like refs, default `[]` |
| `WorkingContextV0.current_observation_ref` | typed observation ref or null, default null |
| `MechanismConfigV0` | exact schema in §12; readonly after init |
| `TraceWindowV1` | exact schema in §10; default S0 value in §4 |
| `RuntimeMetadataV0.subject_version` | literal `subject-v0` |
| `RuntimeMetadataV0.state_revision` | `StateRevisionV0`, creation `0`; successful commit exactly +1 |
| `RuntimeMetadataV0.logical_time` | `LogicalTimeV0`, creation `0`; only TimeTransition advances |
| `RuntimeMetadataV0.last_transition_time` | `LogicalTimeV0|null`, creation null; null iff revision 0, else `<=logical_time` |
| `RuntimeMetadataV0.last_transition_type` | `Time|Observation|CognitionAction|Learning|null`, creation null |
| `RuntimeMetadataV0.created_at` | `LogicalTimeV0`, creation `0`, immutable |
| `RuntimeMetadataV0.updated_at` | `LogicalTimeV0`, creation `0`; `created_at<=updated_at<=logical_time` |

`frustration`, `disappointment` and `anxiety` remain Interpretation/Appraisal descriptions; V0 canonical affect channels are the four already named by P1. This closes an ellipsis without adding emotion logic. Subject Core validates only structure/range/authority and never decides which channel or intensity is appropriate.

Runtime metadata derivation on every successful commit is exact:

| Transition | `state_revision` | `logical_time` | `last_transition_time` | `last_transition_type` | `created_at` | `updated_at` |
|---|---|---|---|---|---|---|
| Time with elapsed `d>0` | previous + 1 | previous logical time + `d` | next logical time | `Time` | unchanged | next logical time |
| Observation | previous + 1 | unchanged；proposal occurrence must equal current logical time | current logical time | `Observation` | unchanged | current logical time |
| CognitionAction | previous + 1 | unchanged；proposal occurrence must equal current logical time | current logical time | `CognitionAction` | unchanged | current logical time |
| Learning | previous + 1 | unchanged；proposal occurrence must equal current logical time | current logical time | `Learning` | unchanged | current logical time |

Elapsed zero never reaches candidate construction and uses `NoOpTransitionResultV1`; therefore it changes none of these fields. A non-Time proposal with unequal occurrence logical time is `INVALID_LOGICAL_TIME`. No implementation may substitute wall clock or execution duration.

### 6.3 Array semantics before serialization

| Ordered arrays（preserve） | Set-like arrays（validate unique, sort lexicographically before state admission） |
|---|---|
| identity anchors, working refs, active episodes, retrieval trace ring, pending encoding queue, focus refs, trace entries | self-schema refs, belief items by ref, relationship models by relationship_id, affect channels by frozen channel order, active entity refs, environment refs, proposal cause/external/provenance refs, trace rule/cause sets |

The serializer never guesses array semantics; normalization occurs during schema admission. Duplicates reject rather than silently disappear.

---

## 7. G3 — Proposal, delta and result schema catalog

### 7.1 CanonicalTransitionProposalV1

Every key is required; no semantic metadata object exists inside the canonical proposal.

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `canonical-transition-proposal-v1` |
| `transition_id` | globally unique `TransitionIdV0` |
| `subject_id` | `IdentifierV0`, must equal current subject |
| `transition_type` | `Time|Observation|CognitionAction|Learning` |
| `expected_state_revision` | `StateRevisionV0` |
| `time_input` | Time canonical form: closed `{kind:"ELAPSED",elapsed_time:{value:nonnegative safe integer,unit:"tick"}}`; others: closed `{kind:"OCCURRENCE",occurrence_logical_time:LogicalTimeV0}` |
| `cause_refs` | unique lexicographically sorted `CanonicalRefV0[]` |
| `domain_deltas` | `DomainDeltaV0[]`, unique and sorted by `(domain, producer, canonical delta bytes)` |
| `external_refs` | unique lexicographically sorted `CanonicalRefV0[]` |

Wall-clock, logging, correlation ID, provider duration, stack, physical path and transport headers belong to a separate noncanonical observability envelope. They never enter proposal fingerprint, state, trace semantic content or result truth.

The Time runtime owns raw-duration admission before a canonical proposal or fingerprint exists. Its raw value must be a finite signed safe integer and its raw unit a well-formed `IdentifierV0`; a non-integer/non-finite/out-of-safe-range value or malformed unit is pre-proposal `INVALID_SCHEMA`, an admitted unit other than `tick` is `INVALID_TIMEBASE`, and a negative value is `INVALID_LOGICAL_TIME`. These pre-proposal failures create no transition identity, canonical result, AuditEventV1 or trace (`audit_refs=[]`), and retry uses the MICL request fingerprint plus stable Time stage key. Subject-core therefore sees only the normalized canonical Time form above. A canonical nonnegative Time whose checked addition overflows remains a post-reservation canonical `INVALID_LOGICAL_TIME` case under §5.2.

`ProducerAuthorizationSetV1` is a trusted invocation capability supplied by the composition root, not a proposal field and not hash/persistence data. Its logical shape is closed `{bindings:[{producer,domain}]}`；each entry uses the registered producer and domain literals below, entries are unique/sorted by `(producer,domain)`, and only the host composition can construct the capability instance. For one request, `bindings` must equal exactly the distinct `(producer,domain)` set in `domain_deltas`；missing or extra bindings are `UNAUTHORIZED_PRODUCER`. LLM/provider text cannot mint this capability；a payload merely claiming `producer="affect"` without the matching authenticated binding is `UNAUTHORIZED_PRODUCER`.

### 7.2 DomainDeltaV0 and writable paths

`DomainDeltaV0` is a closed object:

| Field | Exact type / rule |
|---|---|
| `producer` | well-formed `IdentifierV0`; registered values are exactly `affect|context|memory|regulation`; any other well-formed value reaches ownership validation and is `UNAUTHORIZED_PRODUCER` |
| `domain` | `affect|context|memory-content|memory-retrieval|regulation` |
| `expected_repository_revision` | `RepositoryRevisionIdV0|null`; for both memory domains it is non-null and must equal `current.memory_state.repository_revision`; for other domains it is null |
| `operations` | nonempty `FieldReplacementV0[]`, unique/sorted by path |
| `provenance_refs` | unique/sorted `CanonicalRefV0[]` |

`FieldReplacementV0` is closed `{path,value}`. Replacement is the only V0 operation; `value` must match the exact path type:

Registered producer/domain bindings are exactly `affect/affect`, `context/context`, `memory/memory-content`, `memory/memory-retrieval`, and `regulation/regulation`. Any other individually well-formed tuple is `UNAUTHORIZED_PRODUCER` before path ownership evaluation.

| Path | Exact value type | Producer/domain | Allowed transitions |
|---|---|---|---|
| `/mood` | `MoodV0` | affect/affect | Time, Observation |
| `/affect` | `AffectV0` | affect/affect | Time, Observation |
| `/regulation` | `RegulatoryStateV0` | regulation/regulation | Time, CognitionAction |
| `/context` | `WorkingContextV0` | context/context | Observation, CognitionAction |
| `/memory_state/working_refs` | matching ref array | memory/memory-retrieval | Observation |
| `/memory_state/recent_retrieval_trace` | matching ring | memory/memory-retrieval | Observation |
| `/memory_state/last_retrieval_at` | `LogicalTimeV0|null` | memory/memory-retrieval | Observation |
| `/memory_state/active_episode_refs` | matching ref array | memory/memory-content | Learning |
| `/memory_state/autobiographical_index_revision` | revision or null | memory/memory-content | Learning |
| `/memory_state/repository_revision` | repository revision | memory/memory-content | Learning |
| `/memory_state/consolidation_cursor` | logical time or null | memory/memory-content | Learning |
| `/memory_state/lifecycle_metadata` | `EmptyClosedObjectV0` | memory/memory-content | Learning |
| `/memory_state/pending_encoding_refs` | matching ref queue | memory/memory-content | Learning |
| `/schema_version` | literal `subject-state-v0` | **readonly input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |
| `/identity` | exact `IdentityV0` | **readonly input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |
| `/traits_seed` | exact `TraitsSeedV0` | **readonly input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |
| `/beliefs` | exact `BeliefsV0` | **readonly input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |
| `/relationships` | exact `RelationshipsV0` | **readonly input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |
| `/mechanism_config` | exact `MechanismConfigV0` | **readonly input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |
| `/trace_window` | exact `TraceWindowV1` | **core-derived input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |
| `/runtime_metadata` | exact `RuntimeMetadataV0` | **core-derived input classification** | none；`FORBIDDEN_DIRECT_MUTATION` |

`FieldPathV0` is the union of every literal in this table. `WritableFieldPathV0` is only the first thirteen writable rows. This two-stage classification lets a structurally valid readonly-field attack receive the ownership error required by SC-009; an unlisted pointer is `INVALID_SCHEMA`. No admitted delta may target identity, traits, beliefs, relationships, mechanism config, trace window, schema version or runtime metadata. Subject-core derives revision/logical metadata/trace/hash; producers cannot supply them.

Required composition for a commit-producing V0 proposal:

| Transition | Required delta content | Optional delta content |
|---|---|---|
| Time with elapsed>0 | affect domain containing `/mood` and `/affect`; regulation domain containing `/regulation` | none |
| Observation | affect domain containing `/mood` and `/affect`; context domain containing `/context` | memory-retrieval domain containing all three retrieval fields |
| CognitionAction | at least one of context or regulation when a canonical commit is requested | the other allowed domain; a valid `NO_ACTION`/no-change path sends no commit proposal |
| Learning | memory-content domain containing `/memory_state/repository_revision` and every other changed content field | unchanged content fields omitted |

Time with `elapsed_time.value=0` is the sole exact no-commit proposal case: `domain_deltas=[]` and `ProducerAuthorizationSetV1.bindings=[]` are required；`cause_refs` and `external_refs` remain valid sorted proposal inputs and participate in identity/fingerprint. Syntax, subject, identity reuse and expected-state-revision guards run before terminal `NO_OP`. A nonempty delta set first remains subject to §13.4 layers 5–6: bad binding=`UNAUTHORIZED_PRODUCER`, readonly path=`FORBIDDEN_DIRECT_MUTATION`, and wrong transition owner=`INVALID_TRANSITION_OWNER`. Only an otherwise schema/auth/ownership-valid nonempty set with exactly matching bindings reaches layer 7 and rejects as `INVALID_TRANSITION_COMPOSITION` / reason `TR-ATOMIC-001`. None of these paths creates a NO_OP record；terminal `NO_OP` is reached only after all required zero-delta/zero-binding checks pass.

Duplicate `(producer,domain)`, duplicate path, overlapping path or missing required delta rejects before candidate application; there is no last-wins behavior.

For `memory-retrieval`, candidate `repository_revision` is unchanged and all new memory-bound refs must belong to that current revision. For `memory-content`, the required new repository revision must differ from the current revision, its `RepositoryRevisionManifestV1.parent_revision` must equal `expected_repository_revision`, and all candidate memory-bound refs must validate against the new revision. Merely changing an expected revision without rebuilding the manifest/delta is forbidden.

### 7.3 CanonicalCommitResultV1

Closed original committed-result envelope; this exact object is stored in `AtomicCommitBundleV1`:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `canonical-commit-result-v1` |
| `status` | literal `COMMITTED` |
| `transition_id` | `TransitionIdV0` |
| `subject_id` | exact committed subject ID |
| `payload_fingerprint` | exact `proposal-fingerprint-v1` hash |
| `previous_revision` / `next_revision` | safe integers；next=previous+1 |
| `state_hash_before` / `state_hash_after` | required `HashV1` |
| `snapshot_hash_after` | required `HashV1` |
| `trace_ref` | required `trace` ref |
| `commit_ref` | required deterministic `commit` ref from §14.4 |
| `result_ref` | required deterministic `result` ref from §14.4 |

Publish state is not a field of this result. `PublishObservationV1` is a rebuildable, noncanonical closed projection `{schema_version:"publish-observation-v1",commit_ref,status:PENDING|PUBLISHED,attempt_sequence}` maintained after the authority point. `attempt_sequence` is a safe integer starting 0 at PENDING and increments for each publish attempt；PUBLISHED requires at least 1. It is excluded from result ref, record checksum, StateHash, SnapshotHash and MutationHistory and may change without changing committed truth.

### 7.4 AlreadyCommittedResultV1 and NoOpTransitionResultV1

`AlreadyCommittedResultV1` is a closed derived response, never a second committed record:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `already-committed-result-v1` |
| `status` | literal `ALREADY_COMMITTED` |
| `transition_id` / `subject_id` | exact stored identity |
| `payload_fingerprint` | exact stored fingerprint |
| `previous_revision` / `next_revision` | original committed pair |
| `state_hash_before` / `state_hash_after` / `snapshot_hash_after` | original committed hashes |
| `trace_ref` / `commit_ref` | original refs |
| `original_result_ref` | original `CanonicalCommitResultV1.result_ref` |

`NoOpTransitionResultV1` is produced only by the logical Time transition before the commit port and is durably terminal in the transition identity journal:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `no-op-transition-result-v1` |
| `status` | literal `NO_OP` |
| `transition_id` / `subject_id` | valid frozen identity |
| `transition_type` | literal `Time` |
| `payload_fingerprint` | exact stored fingerprint |
| `previous_revision` / `next_revision` | required and equal |
| `logical_time_before` / `logical_time_after` | required and equal |
| `state_hash_before` / `state_hash_after` | required and equal |
| `snapshot_hash_before` / `snapshot_hash_after` | required and equal |
| `trace_ref` | required null |
| `prepared_result_ref` | required `workflow` ref from the durable §7.6 prepared record |
| `result_ref` | deterministic stable `result` ref from §14.4 |
| `reason` | literal `TIME-NOOP-001` |

NO_OP creates no snapshot, revision, TraceEntry, MutationHistory entry or AuditEvent. Same ID/fingerprint returns this original object, not `ALREADY_COMMITTED`.

`LearningRebaseRequiredResultV1` is a closed runtime-owned wrapper produced only after an underlying durable core stale rejection and unsafe rebuild:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `learning-rebase-result-v1` |
| `status` | literal `REBASE_REQUIRED` |
| `transition_id` / `subject_id` / `payload_fingerprint` | exact underlying attempted identity |
| `previous_revision` | latest authoritative revision loaded during revalidation |
| `next_revision` | required null |
| `state_hash_before` / `state_hash_after` | required and equal to that latest authority |
| `error_code` | literal `STALE_STATE_REVISION` |
| `reason` | literal `REBASE-STALE-001` |
| `trace_ref` | required null |
| `audit_ref` | underlying core stale-attempt audit ref |
| `result_ref` | deterministic §14.4 ref over this body |

It does not terminalize the original transition identity as COMMITTED/NO_OP and creates no canonical mutation. A later safe rebuild requires a new transition ID/fingerprint.

### 7.5 CanonicalErrorResultV1 and AdmissionErrorResultV1

`CanonicalErrorResultV1` applies only after envelope syntax, a valid transition identity, an existing subject/current snapshot and durable identity reservation are available:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `canonical-error-result-v1` |
| `status` | `REJECTED|ABORTED` |
| `transition_id` | `TransitionIdV0` |
| `subject_id` | exact existing subject ID |
| `payload_fingerprint` | fingerprint of this attempted proposal |
| `previous_revision` | current authoritative revision |
| `next_revision` | required null |
| `state_hash_before` / `state_hash_after` | required and equal |
| `error_code` | exact enum in §13.2 |
| `reason` | one exact `RequirementIdV1` selected by §13.3, not free text |
| `trace_ref` | required null |
| `audit_ref` | required stable `audit` ref after durable attempt recording |
| `result_ref` | required deterministic stable `result` ref from §14.4 |

`AdmissionErrorResultV1` is the closed pre-attempt/restore envelope for facts that cannot satisfy the preceding context:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `admission-error-result-v1` |
| `operation` | `CREATE|COMMIT|RESTORE` |
| `status` | `REJECTED|ABORTED` |
| `transition_id` | valid parsed ID or null |
| `subject_id` | valid parsed/extracted ID or null |
| `current_revision` / `state_hash` | both known values or both null |
| `error_code` | for CREATE: `INVALID_SCHEMA|INVALID_MEMORY_REVISION|SERVICE_UNAVAILABLE`；for COMMIT: `INVALID_SCHEMA|FORBIDDEN_DIRECT_MUTATION|UNKNOWN_SUBJECT|COMMIT_CHAIN_INTEGRITY_FAILURE|SERVICE_UNAVAILABLE`；for RESTORE: `INVALID_SCHEMA|INVALID_MEMORY_REVISION|INVALID_MEMORY_REFERENCE|FULL_SNAPSHOT_CHECKSUM_MISMATCH|STATE_HASH_MISMATCH|SNAPSHOT_HASH_MISMATCH|TRACE_INTEGRITY_FAILURE|COMMIT_CHAIN_INTEGRITY_FAILURE|SERVICE_UNAVAILABLE` |
| `reason` | exact §13.3 Requirement ID |
| `audit_ref` / `result_ref` | both required null |

Admission context fields follow this fixed derivation; implementations never salvage values from a malformed/untrusted subtree:

| Operation / first failing boundary | `transition_id` | `subject_id` | `current_revision` / `state_hash` |
|---|---|---|---|
| CREATE seed parse/closed-schema failure | null | null | both null |
| CREATE admitted seed, then R0 binding invalid/unavailable | null | admitted seed subject ID | both null |
| COMMIT layer-0 direct bypass；or parse/closed-envelope `INVALID_SCHEMA` | null | null | both null |
| COMMIT fully admitted envelope, subject lookup returns `UNKNOWN_SUBJECT` | admitted ID | admitted subject ID | both null |
| COMMIT fully admitted envelope, state read unavailable before a snapshot exists | admitted ID | admitted subject ID | both null |
| COMMIT known snapshot, identity/audit journal unavailable before durable reservation/attempt | admitted ID | admitted subject ID | exact loaded pair |
| COMMIT trusted reservation continuation or prepared record/binding fails integrity before an attempt | admitted stored ID | admitted stored subject ID | exact loaded current authority pair |
| COMMIT committed identity/bundle or terminal NO_OP record found, but its prepared-result ref is missing/corrupt during ALREADY/original-NO_OP recovery | admitted stored ID | admitted stored subject ID | exact latest authority pair loaded for recovery |
| RESTORE parse/version/closed-envelope/schema failure；or service failure before schema admission | null | null | both null |
| RESTORE after the complete envelope and embedded SubjectState schema are admitted, then checksum/hash/reference/trace/chain/service validation fails | null | admitted snapshot subject ID | both null |

For COMMIT, “admitted ID” means the complete proposal has passed layer 1, not merely that one token resembles an ID. CREATE has no transition identity. RESTORE never reports the candidate persisted revision/hash as “current authority”；therefore its pair stays null on every Admission error.

It is not transition identity truth and is never stored as a terminal attempt. If the identity/audit journal cannot durably record a known-subject rejected/aborted result, no `CanonicalErrorResultV1` may be claimed；the caller receives `AdmissionErrorResultV1(status=ABORTED,error_code=SERVICE_UNAVAILABLE,reason=FAIL-PRECOMMIT-001)` or a transport failure and reconciles/retries. Stack traces, exception messages and wall clocks are noncanonical diagnostics.

`MICL_ID_REUSE` never enters any transition or the four-status `MICLResultV1`. It uses one separate closed `MICLAdmissionErrorResultV1` with every key required:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `micl-admission-error-result-v1` |
| `status` | literal `REJECTED` |
| `micl_id` / `subject_id` | exact existing workflow identity |
| `stored_request_fingerprint` / `attempted_request_fingerprint` | distinct `HashV1` values under MICL request-fingerprint-v1 |
| `error_code` | literal `MICL_ID_REUSE` |
| `reason` | literal `MICL-RESUME-001` |
| `audit_refs` | exact `[]`；this is workflow admission, not a transition attempt |
| `result_ref` | deterministic `result:<hex>` over `{projection:"characteros-next/micl/admission-result-id/v1",value:BODY_WITHOUT_RESULT_REF}` |

It is a derived fail-closed response and does not append a transition identity, AuditEvent, TraceEntry or canonical/workflow mutation. Same attempted fingerprint against the same stored workflow reproduces the same result bytes/ref.

### 7.6 LogicalTransitionResultV1 wrapper

After an exact `CanonicalTransitionProposalV1` and proposal fingerprint exist, runtime transition executors preserve the P1 domain-result/eligibility boundary with one closed wrapper；subject-core itself emits only the §7.3–§7.5 core envelopes.

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `logical-transition-result-v1` |
| `transition_id` / `subject_id` / `transition_type` | exact request identity |
| `payload_fingerprint` | exact §8.6 CanonicalTransitionProposal fingerprint |
| `status` | `COMMITTED|ALREADY_COMMITTED|NO_OP|REJECTED|ABORTED|REBASE_REQUIRED` |
| `previous_revision` | exact status-derived value below；not implicitly retry-current |
| `next_revision` | `StateRevisionV0|null` by status rules below |
| `logical_time_before` / `logical_time_after` | required status-derived logical integers |
| `state_hash_before` / `state_hash_after` | required status-derived hashes |
| `snapshot_hash_before` / `snapshot_hash_after` | required status-derived hashes |
| `trace_ref` | trace ref only for COMMITTED/ALREADY；otherwise null |
| `outcome_result_ref` | required matching §7 commit/error/NO_OP/rebase result ref |
| `domain_result_refs` | unique/sorted refs of kind `result|retrieval-trace|appraisal|experience` for eligibility/retrieval/interpretation/appraisal/experience evidence |
| `external_effect_refs` | required `[]` in MICL V0/P2；future action support requires a new schema version |
| `error_code` | §13.2 code or null |
| `reason` | `RequirementIdV1|null` |
| `audit_refs` | unique/sorted audit refs；empty when no audit exists |

Before a NEW/SAME_OPEN complete proposal can be terminalized as NO_OP or reach semantic validation/commit, runtime must durably create one content-addressed `PreparedLogicalResultV1`. Every key is required:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `prepared-logical-result-v1` |
| `prepared_result_ref` | deterministic `workflow` ref defined below |
| `transition_id` / `subject_id` / `transition_type` | exact proposal identity |
| `payload_fingerprint` | exact §8.6 proposal fingerprint |
| `workflow_binding` | null for standalone transition；otherwise closed `{micl_id:IdentifierV0,micl_request_fingerprint:HashV1,stage_key:TIME\|OBSERVATION\|LEARNING}` |
| `domain_result_refs` | exact unique/sorted refs of kind `result\|retrieval-trace\|appraisal\|experience` selected by the owning transition stage |
| `external_effect_refs` | exact `[]` in MICL V0/P2 |

`prepared_result_ref = workflow:<hex>` where hex is SHA-256/JCS of `{projection:"characteros-next/runtime/prepared-logical-result/v1",value:PREPARED_BODY_WITHOUT_PREPARED_RESULT_REF}`. The runtime-owned WorkflowStore performs durable content-addressed create/read verification before terminal NO_OP or `AtomicCommitStore` invocation；same ref with different bytes is corruption. An acknowledged record may remain a harmless noncanonical orphan if validation/commit later fails. WorkflowStore unavailability before this durability point leaves the identity OPEN and returns Admission `ABORTED/SERVICE_UNAVAILABLE/FAIL-PRECOMMIT-001` with no AuditEvent/attempt/trace.

After durable create/read verification, WorkflowStore mints one trusted `PreparedLogicalResultBindingV1` capability: closed `{prepared_result_ref:workflow ref,transition_id:TransitionIdV0,subject_id:IdentifierV0,transition_type:TransitionTypeV0,payload_fingerprint:HashV1}`. For a commit path, composition passes this binding beside `ProducerAuthorizationSetV1` and the §14.1 trusted reservation continuation to `commitReserved`, never inside the canonical proposal. Subject-core compares only the binding's ref/identity/fingerprint and carries the ref into the atomic bundle；it neither knows the prepared record's workflow/domain fields nor imports/calls WorkflowStore/runtime/MICL. Only the trusted composition may mint the binding. For a NO_OP path, Time runtime verifies the complete prepared record and consumes the same reservation continuation/binding before journal terminalization.

COMMITTED requires next=previous+1, the original stage before/after time/hash/snapshot values, outcome result and trace, and null error/reason. NO_OP requires next=previous, equal times/hashes, null trace/error, and reason=`TIME-NOOP-001`. Ordinary post-reservation REJECTED/ABORTED outcomes require next=null, equal before/after time/hash/snapshot values, null trace, non-null error/reason, the matching durable CanonicalError result, and domain/external refs from that attempt's prepared record. `TRANSITION_ID_REUSE` is the sole no-new-attempt exception：identity routing occurs before prepared-record creation, so its logical wrapper has `domain_result_refs=[]`, `external_effect_refs=[]`, the conflict AuditEvent ref and the conflict record's first-observed time/snapshot position. REBASE_REQUIRED requires next=null, equal before/after values, null trace, a `learning-rebase-result-v1` outcome_result_ref, error=`STALE_STATE_REVISION`, reason=`REBASE-STALE-001`, and reuses the underlying stale attempt's prepared domain/external refs plus audit ref.

The original COMMITTED logical result is a uniquely reproducible persisted truth, never a view of retry-time authority. It is assembled only from the immutable prepared record named by the authoritative bundle plus that bundle's original canonical result/revision/time/hash/trace fields. WorkflowStore terminal checkpoint is a rebuildable projection, not the sole source. On first response and recovery, the same assembly produces byte-identical `LogicalTransitionResultV1`. An ALREADY response changes only `status` from COMMITTED to ALREADY；`transition_id`, subject/type/fingerprint, previous/next revisions, both logical times, all four state/snapshot hashes, trace ref, original canonical `outcome_result_ref`, prepared `domain_result_refs`/`external_effect_refs`, error/reason and `audit_refs` are byte-for-byte the original values. A terminal NO_OP is reconstructed from its immutable `TransitionAttemptV1`/NoOp result plus the bound prepared record and returns the original byte-identical NO_OP logical wrapper. No current retry revision/time/hash or newly generated domain ref may enter. If either recovery path finds the content-addressed prepared record absent/corrupt, it returns `AdmissionErrorResultV1(operation=COMMIT,status=REJECTED,error_code=COMMIT_CHAIN_INTEGRITY_FAILURE,reason=SS-RESTORE-001,audit_ref=null,result_ref=null)` and must restore that record；committed authority or the terminal NO_OP identity remains unchanged and the stage never reruns. Subject-core itself still returns only `AlreadyCommittedResultV1` on successful committed recovery and does not import/call WorkflowStore；the Time runtime returns the stored NO_OP wrapper on successful NO_OP recovery.

A provider, retrieval, appraisal, affect or repository-prepare failure **before** a complete CanonicalTransitionProposal exists creates no `LogicalTransitionResultV1`, transition ID, proposal ref/fingerprint, identity-journal record or `AuditEventV1`. MICL records only its own exact failure status/reason, leaves that stage transition ref null, uses the existing `micl_id` + MICL request fingerprint + stable stage key for retry, and has `audit_refs=[]`; noncanonical diagnostics are allowed. Once a canonical proposal exists, retry/idempotency switches to §14 transition identity semantics. These two identity domains must never be conflated.

---

## 8. G4 — Canonical serialization and hash contract

### 8.1 Algorithm and wire format

- `canonical-json-v1` = RFC 8785 JSON Canonicalization Scheme over the I-JSON subset, after schema validation/admission.
- Hash algorithm = **SHA-256**.
- Wire form = lowercase `sha256:` plus 64 hexadecimal characters.
- Domain separation is provided by a required `projection` member inside every hashed JCS envelope. Raw `JSON.stringify(state)` is never a valid hash input.

### 8.2 Canonical JSON rules

1. UTF-8, no BOM, no whitespace or trailing newline.
2. Object member names recursively sorted by raw UTF-16 code units as required by JCS.
3. Arrays are emitted in admitted order; field schema, not serializer, decides ordered vs set-like semantics.
4. Duplicate object keys, unknown keys, `undefined`, NaN, infinities and lone surrogates reject.
5. Nullable and absent are distinct; a canonical snapshot has every required key, using explicit null/empty array/closed empty object.
6. IEEE-754 finite numbers use the JCS/ECMAScript shortest round-trip representation; `-0` serializes as `0`. Integer fields must also satisfy the safe-integer schema.
7. Enum case is exact; no case folding.
8. Canonical strings must already be NFC. Serialization does not normalize or repair them.
9. Logical times/durations/revisions are JSON integers, never ISO dates or wall-clock strings.
10. Pattern maps are schema-admitted and their keys are sorted by JCS. No arbitrary map is allowed.

### 8.3 StateHash

Hash input is the JCS encoding of:

```json
{"projection":"characteros-next/subject-state/state-hash/v1","value":STATE_PROJECTION}
```

`STATE_PROJECTION` contains these 12 top-level values exactly: `schema_version`, identity, traits_seed, memory_state refs/config, beliefs, relationships, mood, affect, regulation, the **entire current canonical context**, mechanism_config and runtime_metadata. It excludes the entire `trace_window` to avoid trace self-reference.

It also excludes wall-clock/logging/random metadata, repository payload/index content, external audit data and physical storage metadata. Top-level `schema_version` is **IN** StateHash.

### 8.4 SnapshotHash

Hash input is the JCS encoding of a closed envelope containing:

```text
projection     = characteros-next/subject-state/snapshot-hash/v1
state_hash     = StateHash
subject_id     = canonical subject ID
state_revision = canonical state revision
trace_cursor   = exact TraceCursorV1
last_trace_ref = last window TraceEntry ref, or null for S0
```

SnapshotHash never includes full TraceEntry/MutationHistory content or a physical file/database reference. Therefore StateHash equality means equal logical state; SnapshotHash additionally binds the state to its logical trace position.

### 8.5 RepositoryRevisionHash

The memory package owns this computation. Subject-core only validates the supplied immutable revision/hash/reference through `ReferenceValidator`.

`RepositoryRevisionManifestV1` is closed:

| Field | Exact type / order |
|---|---|
| `schema_version` | literal `repository-revision-manifest-v1` |
| `repository_revision` | `RepositoryRevisionIdV0` |
| `parent_revision` | `RepositoryRevisionIdV0|null` |
| `record_hashes` | array of closed entries with both keys required: `{ref:CanonicalRefV0(kind memory|episode|event|experience),payload_hash:HashV1}`；entry refs unique；sorted by `ref` |
| `index_manifest_hash` | `HashV1|null` |

Hash envelope projection is `characteros-next/memory/repository-revision-hash/v1`. Repository payload bytes are represented only by the manifest payload hashes and never enter SubjectState.

### 8.6 ProposalFingerprint

Fingerprint envelope projection is `characteros-next/transition/proposal-fingerprint/v1` and `value` is the canonical semantic proposal **without `transition_id`**. Included: proposal schema version, subject, transition type, expected state revision, time input, cause refs, domain deltas and external refs. Excluded: observability/transport data and physical storage refs.

`expected_state_revision` is semantic and included. A stale Learning rebuild with a new expected revision or changed delta is a new payload and therefore requires a new `transition_id`; a stable MICL stage key is separate from attempt transition IDs.

`proposal_ref` is separately derived from the complete admitted proposal **including** `transition_id`: SHA-256/JCS of `{projection:"characteros-next/transition/proposal-ref/v1",value:PROPOSAL}`, encoded as `proposal:<64 lowercase hex>`. Every committed TraceEntry has this non-null ref. Proposal fingerprint and proposal ref are intentionally different projections.

---

## 9. G4 — Golden vectors

The following lowercase SHA-256 values were independently calculated over the exact UTF-8 strings shown/derived below. The calculation was one-off documentation verification; no repository hash implementation or test was created.

| Vector | Exact value |
|---|---|
| `HASH-V1-EMPTY` (`{}` bytes) | `sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a` |
| `HASH-V1-S0-FULL-CHECKSUM` | `sha256:247d069c04ade99cf8ece4c1d3dd314e534cbde43e1fec76de1101bf87241146` |
| `HASH-V1-S0-STATE` | `sha256:ee565db175773cc61024096afbbe42bbb5379a136842c583e869e085384693a5` |
| `HASH-V1-S0-SNAPSHOT` | `sha256:46edf45e84a38631748b034f625a7a772f9d20349b9680ad914918f7f53a7c37` |
| `HASH-V1-R0-REPOSITORY` | `sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00` |
| `HASH-V1-SIMPLE-PROPOSAL` | `sha256:7fbf85ce972c8a140af6432990a65584e7d246743a326427beb579e427b51911` |
| `HASH-V1-SIMPLE-DELTA` (S1 StateHash) | `sha256:cc0fdab6987c000dbb8a062ea267c86d3beca63c5117ce050bf510ef9da5ecff` |

`HASH-V1-S0-FULL-CHECKSUM` is the JCS integrity checksum of the full canonical snapshot projection, not the pretty-printed code-block bytes and not a fourth public hash type. Its envelope projection is `characteros-next/subject-state/full-persistence/v1` and its value is the complete S0 in §4, including trace_window.

### 9.1 Exact S0 StateHash input（1474 UTF-16 ASCII code units / UTF-8 bytes）

```json
{"projection":"characteros-next/subject-state/state-hash/v1","value":{"affect":{"active_channels":[],"generated_under_profile":null,"updated_at":null},"beliefs":{"items":[]},"context":{"active_entity_refs":[],"current_observation_ref":null,"environment_refs":[],"focus_refs":[],"scene":"idle","task":null},"identity":{"display_name":"","identity_anchors":[],"origin_metadata":{"creation_source":null,"seed_version":null},"self_schema_seed_refs":[],"subject_id":"subject-s0"},"mechanism_config":{"affect_profile":{"profile_id":"FAST_EMA_V0","timebase":"legacy_tick"},"feature_flags":{},"legacy_reference_defaults":{"alpha":0.06,"clamp":0.25,"tHold":60,"tau":150},"thresholds":{}},"memory_state":{"active_episode_refs":[],"autobiographical_index_revision":null,"consolidation_cursor":null,"last_retrieval_at":null,"lifecycle_metadata":{},"pending_encoding_refs":[],"recent_retrieval_trace":[],"repository_revision":"R0","retrieval_config":{"affect_congruence_enabled":false,"profile_id":"RETRIEVAL_V0","recent_trace_capacity":64},"working_refs":[]},"mood":{"baseline":0,"generated_under_profile":null,"last_update":null},"regulation":{"arousal":0.5,"energy":1,"fatigue":0,"last_update":null,"stress":0},"relationships":{"models":[]},"runtime_metadata":{"created_at":0,"last_transition_time":null,"last_transition_type":null,"logical_time":0,"state_revision":0,"subject_version":"subject-v0","updated_at":0},"schema_version":"subject-state-v0","traits_seed":{"dimensions":{}}}}
```

### 9.2 Exact S0 SnapshotHash input

```json
{"last_trace_ref":null,"projection":"characteros-next/subject-state/snapshot-hash/v1","state_hash":"sha256:ee565db175773cc61024096afbbe42bbb5379a136842c583e869e085384693a5","state_revision":0,"subject_id":"subject-s0","trace_cursor":{"last_history_sequence":0,"offloaded_through_sequence":0,"offloaded_through_trace_ref":null}}
```

### 9.3 Exact R0 RepositoryRevisionHash input

```json
{"projection":"characteros-next/memory/repository-revision-hash/v1","value":{"index_manifest_hash":null,"parent_revision":null,"record_hashes":[],"repository_revision":"R0","schema_version":"repository-revision-manifest-v1"}}
```

### 9.4 Simple proposal and S1

The simple proposal replaces `/context` with `scene="lab"` and `current_observation_ref="observation:o1"` at expected revision 0. Its fingerprint input is:

```json
{"projection":"characteros-next/transition/proposal-fingerprint/v1","value":{"cause_refs":["observation:o1"],"domain_deltas":[{"domain":"context","expected_repository_revision":null,"operations":[{"path":"/context","value":{"active_entity_refs":[],"current_observation_ref":"observation:o1","environment_refs":[],"focus_refs":[],"scene":"lab","task":null}}],"producer":"context","provenance_refs":["observation:o1"]}],"expected_state_revision":0,"external_refs":[],"schema_version":"canonical-transition-proposal-v1","subject_id":"subject-s0","time_input":{"kind":"OCCURRENCE","occurrence_logical_time":0},"transition_type":"Observation"}}
```

Exact S1 StateHash input:

```json
{"projection":"characteros-next/subject-state/state-hash/v1","value":{"affect":{"active_channels":[],"generated_under_profile":null,"updated_at":null},"beliefs":{"items":[]},"context":{"active_entity_refs":[],"current_observation_ref":"observation:o1","environment_refs":[],"focus_refs":[],"scene":"lab","task":null},"identity":{"display_name":"","identity_anchors":[],"origin_metadata":{"creation_source":null,"seed_version":null},"self_schema_seed_refs":[],"subject_id":"subject-s0"},"mechanism_config":{"affect_profile":{"profile_id":"FAST_EMA_V0","timebase":"legacy_tick"},"feature_flags":{},"legacy_reference_defaults":{"alpha":0.06,"clamp":0.25,"tHold":60,"tau":150},"thresholds":{}},"memory_state":{"active_episode_refs":[],"autobiographical_index_revision":null,"consolidation_cursor":null,"last_retrieval_at":null,"lifecycle_metadata":{},"pending_encoding_refs":[],"recent_retrieval_trace":[],"repository_revision":"R0","retrieval_config":{"affect_congruence_enabled":false,"profile_id":"RETRIEVAL_V0","recent_trace_capacity":64},"working_refs":[]},"mood":{"baseline":0,"generated_under_profile":null,"last_update":null},"regulation":{"arousal":0.5,"energy":1,"fatigue":0,"last_update":null,"stress":0},"relationships":{"models":[]},"runtime_metadata":{"created_at":0,"last_transition_time":0,"last_transition_type":"Observation","logical_time":0,"state_revision":1,"subject_version":"subject-v0","updated_at":0},"schema_version":"subject-state-v0","traits_seed":{"dimensions":{}}}}
```

This is a serialization/hash vector, not an ObservationTransition conformance fixture and does not claim that a context-only proposal satisfies §7.2 required composition.

---

## 10. G5 — Trace contract

### 10.1 One commit, one TraceEntry

One successful canonical commit creates exactly one immutable `TraceEntryV1`, even when multiple domains contribute. A single entry contains deterministic `domain_mutations[]`; it is forbidden to create one canonical trace per domain for the same revision.

### 10.2 TraceEntryV1

All keys are required; nullable keys are explicit.

| Field | Exact contract |
|---|---|
| `trace_schema_version` | literal `trace-v1` |
| `trace_id` | typed trace ref; deterministically derived as described below |
| `history_sequence` | positive safe integer, equal to `subject_revision_after` in V0 |
| `transition_id` / `transition_type` / `subject_id` | exact proposal identity fields |
| `subject_revision_before` / `subject_revision_after` | after = before + 1 |
| `logical_time` | committed candidate logical time |
| `rule_ids` | exact constant set declared below |
| `cause_refs` | unique/sorted canonical refs |
| `proposal_ref` | required proposal ref from §8.6 |
| `domain_mutations` | nonempty `DomainMutationSummaryV1[]`, sorted by `(domain,producer)` |
| `state_hash_before` / `state_hash_after` | **required** `HashV1` |
| `memory_revision_before` / `memory_revision_after` | required non-null `RepositoryRevisionIdV0`; exact current/candidate values；equal for non-memory commits |
| `outcome` | literal `COMMITTED` |

`rule_ids` is exactly the lexicographically sorted constant `HASH-DET-001, SS-AUTH-001, SS-IMMUTABLE-001, SS-REVISION-001, TR-ATOMIC-001, TRACE-ATOMIC-001, TRACE-CONTENT-001` for every V0 committed TraceEntry. It records the generic canonical rules applied by subject-core; domain conformance IDs remain in fixture/evidence records and are not producer-controlled trace input.

`DomainMutationSummaryV1` is closed `{producer,domain,layers,field_changes}`. Producer/domain use the admitted registered pair in §7.2; summaries sort by raw ASCII `(domain,producer)`. `layers` is a unique raw-ASCII-sorted subset of `mood|affect|regulation|context|memory_state`. `field_changes` is a nonempty array of closed `{path,operation}` sorted by raw ASCII `path`; paths are unique `WritableFieldPathV0` and operation is literal `SET`. Values are omitted; required before/after StateHashes and paths provide the bounded summary.

Trace construction has no discretionary membership: `cause_refs` equals proposal `cause_refs` exactly；`proposal_ref` equals §8.6；one DomainMutationSummary is created per admitted DomainDelta and contains exactly that delta's operations；`layers` is the unique set of their first canonical layer names；memory revisions equal current/candidate `memory_state.repository_revision`；logical time equals candidate metadata. `external_refs` and per-delta `provenance_refs` remain reachable through the proposal ref and are not duplicated into cause refs.

`trace_id` is deterministic: SHA-256/JCS of `{projection:"characteros-next/trace/entry-id/v1",value:TRACE_BODY_WITHOUT_TRACE_ID}`, then encoded as `trace:<64 lowercase hex>`. Random UUID and wall clock are forbidden.

### 10.3 TraceWindowV1 and TraceCursorV1

```text
TraceWindowV1 = closed {
  trace_window_schema_version: "trace-window-v1"
  capacity: 64
  cursor: TraceCursorV1
  entries: TraceEntryV1[]
}

TraceCursorV1 = closed {
  last_history_sequence: safe integer
  offloaded_through_sequence: safe integer
  offloaded_through_trace_ref: TraceRef|null
}
```

Frozen invariants:

1. Capacity is the schema constant **64**, not runtime config.
2. S0 cursor is `0/0/null`; entries empty.
3. `last_history_sequence == runtime_metadata.state_revision`.
4. Entries are strictly ascending and contiguous by history sequence and contain the newest `min(state_revision,64)` committed entries.
5. For revision `<=64`, `offloaded_through_sequence=0` and ref=null. For revision `>64`, offloaded sequence=`state_revision-64` and ref is the last evicted TraceEntry.
6. `entries` is empty iff `runtime_metadata.state_revision=0`, in which case cursor is exactly `0/0/null` for every newly created subject (S0 is the golden example). For revision >0, `entries[0].history_sequence = offloaded_through_sequence+1` and the last entry sequence equals `last_history_sequence`.
7. Eviction is legal only after the same TraceEntry is durable in authoritative MutationHistory.

### 10.4 MutationHistory, AuditEvent and atomicity

- MutationHistory is the append-only authoritative sequence of committed TraceEntry records held in the atomic commit journal.
- TraceWindow is only the canonical recent projection; eviction is not history deletion.
- Rejected/aborted attempts create durable AuditEvent/attempt records, never committed TraceEntry or window entries.
- Candidate, revision, StateHash, TraceEntry, MutationHistory linkage, TraceWindow/Cursor, SnapshotHash and committed TransitionRecord are one `AtomicCommitBundleV1`.
- If trace/history preparation or the atomic store is unavailable, the commit aborts before authority advances. Post-commit trace repair is forbidden.

---

## 11. G6 — Restore and context semantics

`restore(envelope)` accepts exactly one closed `PersistedSubjectEnvelopeV1` JSON value; it never accepts a bare snapshot, physical path, database row or implementation-defined bytes:

| Field | Exact contract |
|---|---|
| `schema_version` | literal `subject-persistence-envelope-v1` |
| `serialization_version` | literal `canonical-json-v1` |
| `snapshot` | complete admitted `SubjectStateV0` JSON object including `trace_window` |
| `full_snapshot_checksum` | SHA-256/JCS of `{projection:"characteros-next/subject-state/full-persistence/v1",value:snapshot}` |
| `state_hash` | required StateHash of `snapshot` under §8.3 |
| `snapshot_hash` | required SnapshotHash of `snapshot` under §8.4 |
| `repository_bindings` | nonempty unique array of exact `RepositoryRevisionBindingV1`, sorted by `repository_revision` |
| `commit_head` | null for revision 0；otherwise closed `{commit_ref:CommitRef,record_checksum:HashV1}` |

`RepositoryRevisionBindingV1` is closed `{repository_revision:RepositoryRevisionIdV0,repository_revision_hash:HashV1}`. Its hash is verified against the immutable repository manifest through `ReferenceValidator`. The array is exactly the distinct set containing `snapshot.memory_state.repository_revision` and non-null `snapshot.memory_state.autobiographical_index_revision`; it contains no unrelated revision. For S0, the sole binding is `R0` plus `HASH-V1-R0-REPOSITORY`, `full_snapshot_checksum=HASH-V1-S0-FULL-CHECKSUM`, and `commit_head=null`. For revision `n>0`, `commit_head` must name the continuous valid `AtomicCommitBundleV1` at revision `n`, and its checksum must equal that record.

Restore first-error precedence and steps are exact:

1. Parse the closed envelope, supported versions and every embedded SubjectState required/unknown key, primitive range, array order and non-trace structural/cross-field invariant without defaulting；failure=`INVALID_SCHEMA`.
2. Recompute `full_snapshot_checksum`；mismatch=`FULL_SNAPSHOT_CHECKSUM_MISMATCH`.
3. Recompute StateHash；mismatch=`STATE_HASH_MISMATCH`.
4. Recompute SnapshotHash；mismatch=`SNAPSHOT_HASH_MISMATCH`.
5. Validate `repository_bindings` in ascending `repository_revision` order, including each immutable manifest existence/hash；first failure=`INVALID_MEMORY_REVISION`.
6. Validate Memory-bound refs in canonical SubjectState field order from §6.2 and then array index order；first missing ref=`INVALID_MEMORY_REFERENCE`.
7. Validate revision/TraceWindow/TraceCursor/MutationHistory linkage；failure=`TRACE_INTEGRITY_FAILURE`.
8. Validate commit head/checksum, the continuous authoritative bundle chain, and each bundle-bound prepared logical-result ref through verdict-only `PreparedResultValidator` in ascending commit sequence；missing/corrupt/mismatched record=`COMMIT_CHAIN_INTEGRITY_FAILURE`.
9. Materialize an immutable snapshot whose JCS value, revision, logical time and hashes equal the envelope.
10. Restore creates no transition, revision increment, TraceEntry, attempt or AuditEvent on success；no Context field is cleared, replaced or reset.

The first failing numbered step is the only returned code；later checks do not override it. Service unavailability at the first external capability actually reached maps to `SERVICE_UNAVAILABLE` without skipping any earlier local validation. Unknown version, missing field, invalid ref, corrupt hash/trace/revision or torn chain fails closed with the exact AdmissionError mapping in §13.3；no auto-repair, migration or downgrade.

The full-persistence checksum protects the embedded snapshot representation only; it is not a second restore envelope or a recursive checksum of itself.

All six WorkingContext fields are canonical, fully persisted, StateHash-included and exactly restored. “Transient” is replaced by **observation-scoped / expected short lifetime**: the next authorized ObservationTransition may replace focus/environment/current observation through a normal ContextDelta, producing revision+1, TraceEntry and new hashes. TimeTransition has no Context authority. A future explicit reset would require a separately authorized existing-owner delta or new versioned contract; restore itself can never perform it.

---

## 12. G7 — Affect config freeze

`MechanismConfigV0` is the only active affect configuration authority and is closed:

```json
{
  "affect_profile": { "profile_id": "FAST_EMA_V0", "timebase": "legacy_tick" },
  "legacy_reference_defaults": { "tHold": 60, "alpha": 0.06, "tau": 150, "clamp": 0.25 },
  "feature_flags": {},
  "thresholds": {}
}
```

- `affect_profile.profile_id` and `.timebase` are exact literals.
- `tHold=60` and `tau=150` are nonnegative/positive safe-integer legacy ticks; `alpha=0.06`, `clamp=0.25` are exact finite V0 constants.
- `feature_flags` and `thresholds` are `EmptyClosedObjectV0`; any key rejects until a new schema version.
- The legacy defaults are readonly reference parameters under the active profile, not learned state and not scientific truth.
- Mood/Affect `generated_under_profile` is only a profile-ID provenance string and may describe historical generation. It cannot override active config.
- Subject-core validates this schema but contains no FAST+EMA or emotion calculation.

---

## 13. G8 — Error, status and reason mapping

### 13.1 Status layers

| Layer | Frozen statuses | Rule |
|---|---|---|
| Subject creation result | `CREATED` | pure revision-0 materialization only；not a transition status and no persistence side effect |
| Subject-core response | `COMMITTED`, `ALREADY_COMMITTED`, `REJECTED`, `ABORTED` | discriminated §7 envelopes；no `NO_OP` or `REBASE_REQUIRED` inside canonical commit |
| Logical TransitionResult | `COMMITTED`, `ALREADY_COMMITTED`, `NO_OP`, `REJECTED`, `ABORTED`, `REBASE_REQUIRED` | `REBASE_REQUIRED` only for Learning/runtime after core stale rejection and unsafe rebuild |
| MICLResult | `COMPLETED`, `FAILED_BEFORE_STATE_CHANGE`, `FAILED_AFTER_TIME`, `FAILED_AFTER_OBSERVATION` | no `PARTIAL_COMPLETION`；status is based on successful commits in this MICL attempt |
| MICL admission response | `REJECTED` | only separate `MICLAdmissionErrorResultV1` for changed-fingerprint reuse；never a `MICLResultV1` status |
| PublishObservation | `PENDING`, `PUBLISHED` | rebuildable post-authority projection；not a transition/MICL status |

`REBASE_REQUIRED` is a Learning/runtime status, never an error code. Subject-core first returns `REJECTED + error_code=STALE_STATE_REVISION + reason=SS-REVISION-001`. Learning reloads/revalidates/rebuilds: safe rebuild uses a new transition ID/fingerprint；unsafe rebuild returns `status=REBASE_REQUIRED, error_code=STALE_STATE_REVISION, reason=REBASE-STALE-001`. MICL then returns `FAILED_AFTER_OBSERVATION` with `failure_reason=REBASE_REQUIRED`.

If Time commits, a later Observation failure is `FAILED_AFTER_TIME`. If Time is durable `NO_OP`, no canonical state changed; a later Observation failure is `FAILED_BEFORE_STATE_CHANGE`. A failure before any stage commit is also `FAILED_BEFORE_STATE_CHANGE`.

### 13.2 Frozen error codes

| Error code | Owner | Status | Retry? | Meaning |
|---|---|---|---|---|
| `INVALID_SCHEMA` | subject-core/domain schema owner | REJECTED | only corrected new payload/ID | malformed/unknown/missing/extra field or malformed revision |
| `INVALID_VALUE_RANGE` | subject-core/domain schema owner | REJECTED | corrected new payload/ID | scalar outside frozen range |
| `STALE_STATE_REVISION` | subject-core | REJECTED | reload; rebuilt payload uses new ID | expected revision mismatch before CAS |
| `INVALID_LOGICAL_TIME` | transition/runtime | REJECTED | corrected new payload/ID | invalid monotonic/occurrence time |
| `INVALID_TIMEBASE` | transition/runtime | REJECTED | corrected new payload/ID | unit/profile timebase invalid |
| `INVALID_MEMORY_REVISION` | subject-core capability check | REJECTED | after valid revision exists | repository revision missing/corrupt |
| `INVALID_MEMORY_REFERENCE` | subject-core capability check | REJECTED | corrected/rebuilt payload | ref absent from the validated revision |
| `FORBIDDEN_DIRECT_MUTATION` | subject-core boundary | REJECTED | no same bypass retry | attempted bypass of proposal/core authority |
| `UNKNOWN_SUBJECT` | subject-core | REJECTED | after subject exists | subject missing/identity mismatch |
| `PROPOSAL_REJECTED` | proposal owning domain | REJECTED | corrected new payload/ID | structured proposal failed domain validation |
| `DOMAIN_DELTA_CONFLICT` | subject-core | REJECTED | corrected new payload/ID | overlap/duplicate path or domain delta |
| `MISSING_REQUIRED_DELTA` | subject-core | REJECTED | corrected new payload/ID | §7.2 composition incomplete |
| `UNAUTHORIZED_PRODUCER` | subject-core | REJECTED | corrected producer/new ID | producer lacks path authority |
| `INVALID_TRANSITION_COMPOSITION` | transition/runtime | REJECTED | corrected new payload/ID | illegal stage/domain combination |
| `INVALID_TRANSITION_OWNER` | subject-core | REJECTED | corrected transition/new ID | transition lacks field authority |
| `INVARIANT_VIOLATION` | subject-core | REJECTED | corrected new payload/ID | valid fields violate a named cross-field rule |
| `COMMIT_CONFLICT` | atomic store/subject-core | REJECTED | reload and rebuild/new ID | precheck matched but compare-and-commit CAS lost |
| `TRANSITION_ID_REUSE` | identity journal | REJECTED | new transition ID | same ID, different fingerprint |
| `SERVICE_UNAVAILABLE` | runtime/infrastructure | ABORTED | same ID/fingerprint allowed | provider/store/read capability unavailable precommit |
| `OUT_OF_ORDER_OBSERVATION` | runtime | REJECTED | new valid observation request | occurrence time older than canonical time |
| `INVALID_STAGE_DEPENDENCY` | runtime | REJECTED | resume/correct stage | required prior stage result absent |
| `UNSUPPORTED_EVIDENCE_REF` | interpretation/appraisal | REJECTED | corrected proposal/new ID | evidence outside controlled projection |
| `MICL_ID_REUSE` | MICL workflow store | REJECTED | new MICL ID | same MICL ID + different stored MICL request fingerprint；never raw request bytes/hash |
| `ACTION_UNAVAILABLE` | CognitionAction runtime | ABORTED | policy/runtime retry | action reasoning unavailable; not `NO_ACTION` |
| `EXTERNAL_ACTION_FAILED` | external action boundary | ABORTED | external policy | external effect failed; no fake Outcome |
| `FULL_SNAPSHOT_CHECKSUM_MISMATCH` | restore/subject-core | REJECTED | corrected valid envelope | complete embedded snapshot checksum differs from recomputation |
| `STATE_HASH_MISMATCH` | restore/subject-core | REJECTED | corrected valid envelope | persisted StateHash differs from recomputation |
| `SNAPSHOT_HASH_MISMATCH` | restore/subject-core | REJECTED | corrected valid envelope | persisted SnapshotHash differs from recomputation |
| `TRACE_INTEGRITY_FAILURE` | restore/subject-core | REJECTED | recover externally, then retry | trace/window/cursor/history linkage invalid |
| `COMMIT_CHAIN_INTEGRITY_FAILURE` | restore/atomic store/identity or prepared-result integrity | REJECTED | recover externally, then retry | reserved identity continuation/record, head/checksum/continuous bundle chain or a bound prepared logical-result record is absent/corrupt/mismatched |

### 13.3 Exact primary reason and result-envelope mapping

| Condition | Status / error code | Exact `reason` | Envelope |
|---|---|---|---|
| malformed JSON；missing/extra key；invalid ID/enum/pointer/value shape | REJECTED / `INVALID_SCHEMA` | `SS-SCHEMA-001` | Admission before context；CanonicalError after context |
| admitted scalar outside range | REJECTED / `INVALID_VALUE_RANGE` | `SS-SCHEMA-001` | CanonicalError |
| expected revision differs at precheck | REJECTED / `STALE_STATE_REVISION` | `SS-REVISION-001` | CanonicalError |
| unsafe Learning rebuild after that stale result | REBASE_REQUIRED / `STALE_STATE_REVISION` | `REBASE-STALE-001` | logical TransitionResult, not CanonicalError |
| raw Time duration malformed before proposal | REJECTED / `INVALID_SCHEMA` | `SS-SCHEMA-001` | owning-runtime pre-proposal result；no identity/audit |
| raw Time duration negative / admitted unit not `tick` before proposal | REJECTED / `INVALID_LOGICAL_TIME` or `INVALID_TIMEBASE` | `TIME-ADVANCE-001` or `TIME-AFFECT-001` respectively | owning-runtime pre-proposal result；no identity/audit |
| checked canonical Time addition overflows safe integer | REJECTED / `INVALID_LOGICAL_TIME` | `TIME-ADVANCE-001` | CanonicalError |
| revision/history successor overflows safe integer | REJECTED / `INVARIANT_VIOLATION` | `SS-REVISION-001` | CanonicalError |
| missing/corrupt repository revision or bound ref | REJECTED / `INVALID_MEMORY_REVISION` or `INVALID_MEMORY_REFERENCE` | `MEM-REV-001` | CanonicalError for commit；Admission for CREATE/RESTORE |
| direct port bypass/read-only/core-derived path | REJECTED / `FORBIDDEN_DIRECT_MUTATION` | `LLM-AUTH-001` when authenticated actor is LLM/provider；otherwise `SS-AUTH-001` | CanonicalError when a valid attempt exists；otherwise Admission |
| well-formed producer lacks authenticated `(producer,domain)` binding | REJECTED / `UNAUTHORIZED_PRODUCER` | `SS-AUTH-001` | CanonicalError |
| registered producer/path but transition lacks ownership | REJECTED / `INVALID_TRANSITION_OWNER` | `SS-AUTH-001` | CanonicalError |
| overlap/duplicate path or `(producer,domain)` | REJECTED / `DOMAIN_DELTA_CONFLICT` | `TR-CONFLICT-001` | CanonicalError |
| missing required delta / illegal composition | REJECTED / `MISSING_REQUIRED_DELTA` or `INVALID_TRANSITION_COMPOSITION` | `TR-ATOMIC-001` | CanonicalError |
| whole-state cross-field invariant failure | REJECTED / `INVARIANT_VIOLATION` | `SS-SCHEMA-001` | CanonicalError |
| same transition ID, different fingerprint | REJECTED / `TRANSITION_ID_REUSE` | `IDEM-REUSE-001` | CanonicalError plus reuse-conflict audit；record successor changes only `record_version` and appended conflict fields |
| CAS loser at authority point | REJECTED / `COMMIT_CONFLICT` | `FAIL-CAS-001` | CanonicalError after reconciliation proves loser not committed |
| Interpretation/Appraisal proposal rejected by owner | REJECTED / `PROPOSAL_REJECTED` | `FAIL-SERVICE-001` | owning logical transition result |
| provider, retrieval, `StateReader`, `ReferenceValidator` or creation-R0 read unavailable before commit authority | ABORTED / `SERVICE_UNAVAILABLE` | `FAIL-SERVICE-001` | CanonicalError only if complete proposal/context/reservation exist；otherwise Admission or owning pre-proposal result |
| memory repository prepare unavailable before a new revision exists | ABORTED / `SERVICE_UNAVAILABLE` | `FAIL-PREPARE-001` | owning logical transition result |
| WorkflowStore prepared-record durability/read verification unavailable for NEW/SAME_OPEN, or prepared-record recovery read unavailable for terminal COMMITTED/NO_OP | ABORTED / `SERVICE_UNAVAILABLE` | `FAIL-PRECOMMIT-001` | Admission；OPEN or existing terminal identity unchanged；no new attempt/audit |
| trusted reservation continuation, prepared record or `PreparedLogicalResultBindingV1` is missing/corrupt/mismatched for NEW/SAME_OPEN | REJECTED / `COMMIT_CHAIN_INTEGRITY_FAILURE` | `SS-RESTORE-001` | Admission with operation COMMIT；OPEN unchanged；no attempt/audit/result ref |
| `TransitionIdentityJournal`, complete-bundle preparation or `AtomicCommitStore` unavailable before invocation；or failure already proven `DEFINITE_NOT_COMMITTED` | ABORTED / `SERVICE_UNAVAILABLE` | `FAIL-PRECOMMIT-001` | CanonicalError if durable attempt succeeds；otherwise Admission |
| reconciliation read unavailable after `AtomicCommitStore` returns `OUTCOME_UNKNOWN` | **no business result yet**；commit truth unresolved | `FAIL-PRECOMMIT-001` only as nonterminal operational classification | unresolved transport/reconciliation state；no ABORTED result or attempt until committed is found or definite non-publication is proved |
| valid parsed subject not found | REJECTED / `UNKNOWN_SUBJECT` | `SS-AUTH-001` | Admission |
| past occurrence | REJECTED / `OUT_OF_ORDER_OBSERVATION` | `TIME-OCCURRENCE-001` | owning logical transition result |
| missing stage result / unsupported evidence | REJECTED / `INVALID_STAGE_DEPENDENCY` or `UNSUPPORTED_EVIDENCE_REF` | `MICL-STAGE-001` or `LLM-EVID-001` respectively | owning logical transition result |
| same MICL ID, changed request fingerprint | REJECTED / `MICL_ID_REUSE` | `MICL-RESUME-001` | separate `MICLAdmissionErrorResultV1`；not MICLResult/transition result |
| action unavailable / external action failed | ABORTED / matching code | `MICL-ACTION-001` | optional-action runtime result；not P2 implementation scope |
| restore full-snapshot checksum mismatch | REJECTED / `FULL_SNAPSHOT_CHECKSUM_MISMATCH` | `SS-RESTORE-001` | Admission with operation RESTORE |
| restore StateHash / SnapshotHash mismatch | REJECTED / `STATE_HASH_MISMATCH` or `SNAPSHOT_HASH_MISMATCH` | `HASH-PROJ-001` or `HASH-SNAPSHOT-001` respectively | Admission with operation RESTORE |
| restore trace / commit chain corrupt | REJECTED / `TRACE_INTEGRITY_FAILURE` or `COMMIT_CHAIN_INTEGRITY_FAILURE` | `TRACE-CONTENT-001` or `SS-RESTORE-001` respectively | Admission with operation RESTORE |
| committed ALREADY or terminal NO_OP recovery finds its bound prepared record missing/corrupt | REJECTED / `COMMIT_CHAIN_INTEGRITY_FAILURE` | `SS-RESTORE-001` | Admission with operation COMMIT；authority/terminal identity unchanged；no attempt/audit/result ref or stage rerun |

### 13.4 Deterministic validation precedence

For one input with multiple defects, the reported code is the first failing layer in this fixed order: (0) invocation-boundary bypass or caller-forged trusted capability；(1) parse/closed-envelope syntax；(2) subject read and pre-context availability；(3) fingerprint + durable identity reservation/reuse；(3P) trusted reservation-continuation + prepared-record/binding integrity after NEW/SAME_OPEN routing；(4) expected state/repository revision guards plus checked revision/history and canonical-Time successors；(5) authenticated producer binding；(6) read-only/writable path and transition ownership；(7) duplicate/overlap/required composition；(8) path-specific value/range validation；(9) repository reference validation；(10) whole-state invariants；(11) trace/hash/bundle preparation；(12) atomic CAS. Layer 0 code is always Admission `FORBIDDEN_DIRECT_MUTATION`, with reason `LLM-AUTH-001` for an authenticated LLM/provider actor and `SS-AUTH-001` otherwise；layer 3P invalid returns Admission `COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001`, while layer 3P unavailable returns Admission `SERVICE_UNAVAILABLE/FAIL-PRECOMMIT-001`. Every list-valued later layer evaluates members in lexicographically sorted `(domain,producer,path)` order. Raw Time duration admission occurs in its owning runtime before layer 1 and never enters this sequence. This precedence makes SC-002A, SC-009, SC-011 and multi-invalid fixtures deterministic.

All post-context rejected/aborted cases that assert a canonical result record a durable attempt/AuditEvent, change no canonical state, keep revision delta 0 and create no TraceEntry. Admission errors do not pretend that such an attempt exists. `INVALID_REVISION`, `INVALID_DELTA`, `FAIL_CLOSED`, `STALE`, `TRANSITION_REJECTED`, `LEGAL_EMPTY_RETRIEVAL` and `NO_ACTION` are narrative/umbrella concepts, not error codes. Human text/stack/wall clock is noncanonical.

---

## 14. G9 — Transition identity durability

### 14.1 Reservation state machine and lookup

`transition_id` is globally unique, opaque ASCII and generated outside subject-core. After syntax admission, successful subject/current-snapshot read and fingerprint computation—but before revision/ownership/value validation—`TransitionIdentityJournal.reserveIdentity(transition_id,subject_id,transition_type,proposal_ref,payload_fingerprint)` performs durable create-if-absent and returns exactly one outcome:

| Outcome | Required routing |
|---|---|
| `NEW_RESERVED` | durable OPEN record created with `attempts=[]`; return a trusted continuation；only prepared-record work may start |
| `SAME_OPEN_OR_RETRY` | same subject/type/fingerprint；return a trusted continuation；append a new attempt only after prepared integrity and normal validation execute |
| `SAME_TERMINAL_COMMITTED` | return `AlreadyCommittedResultV1` from the original committed bundle；no attempt/trace/revision |
| `SAME_TERMINAL_NO_OP` | after its bound prepared record validates, return the original `NoOpTransitionResultV1`/logical wrapper；missing/corrupt follows §7.6 COMMIT Admission integrity failure；no new attempt/audit/stage rerun |
| `REUSE_CONFLICT_PENDING` | return the mismatching original record identity only；perform no write；caller must invoke the explicit conflict operation below with the already loaded canonical revision/logical-time/StateHash/SnapshotHash position |

A crash after `NEW_RESERVED` and before an attempt exists is therefore representable and recoverable. Same rejected/aborted fingerprint may retry through normal validation；a changed fingerprint always conflicts after restart. Bounded trace_window and derived idempotency indexes are never identity authority.

For `NEW_RESERVED` or `SAME_OPEN_OR_RETRY`, §7.6 prepared-record durability and identity/ref verification occur before semantic validation, NO_OP terminalization or bundle construction. Every later `TransitionAttemptV1` binds that exact ref. Terminal routes never create a replacement prepared record：COMMITTED/NO_OP recovery follows the stored original；reuse conflict follows the conflict operation below.

The public conceptual protocol has exactly two subject-core calls separated by one runtime-owned preparation step；a single `commit(proposal,binding)` entry point is forbidden because the binding cannot exist before reservation:

1. `reserveAndRoute(proposal)` performs syntax admission, current-state read, proposal ref/fingerprint derivation and the journal call above. NEW/SAME_OPEN returns only a trusted `ReservedTransitionContinuationV1`; terminal/reuse routes return their already frozen result/route and never call WorkflowStore.
2. Runtime uses that continuation to durably create/read-verify `PreparedLogicalResultV1` and mint `PreparedLogicalResultBindingV1`. Subject-core is not on this call path.
3. For a mutation proposal, runtime calls `commitReserved(proposal,continuation,ProducerAuthorizationSetV1,PreparedLogicalResultBindingV1)`. It must not call `reserveIdentity` or WorkflowStore. It recomputes proposal ref/fingerprint, verifies both trusted capabilities, rereads the journal, and requires the same identity header. A terminal successor routes to the stored original result without candidate construction. For same-header OPEN, it captures the exact current `record_version` as `identity_record_version_before`, then reloads the exact latest canonical authority and starts §13.4 layer 4 against that reload；the snapshot observed before runtime preparation is never reused. A greater OPEN record version is allowed；missing/corrupt header, version regression or identity/ref/fingerprint mismatch follows layer 3P and never creates an attempt.

`ReservedTransitionContinuationV1` is a trusted, noncanonical invocation capability with every logical field required: `{schema_version:"reserved-transition-continuation-v1",transition_id,subject_id,transition_type,proposal_ref,payload_fingerprint,identity_record_version_observed,route}`；`route=NEW_RESERVED|SAME_OPEN_OR_RETRY` and the observed version is a nonnegative safe integer. Only `reserveAndRoute` may mint it. It is excluded from proposal/fingerprint/state/hash/persistence and cannot be deserialized from caller data. After process loss, calling `reserveAndRoute` again with the same proposal performs an idempotent OPEN lookup and mints a fresh trusted continuation without appending an attempt/audit/version.

The exact Time zero-delta path consumes the same continuation through runtime `terminalizeReservedNoOp(proposal,continuation,ProducerAuthorizationSetV1(bindings=[]),PreparedLogicalResultBindingV1)`. It performs the same header/version/binding recheck, reloads exact latest canonical authority, then runs layers 4–8 including expected-revision/time and exact zero-delta/zero-binding composition guards before journal CAS stores one NO_OP attempt/result/terminal successor. A stale revision produces the ordinary durable `STALE_STATE_REVISION/SS-REVISION-001` rejected attempt/AuditEvent bound to the prepared ref and never terminalizes NO_OP. The operation never calls `AtomicCommitStore` and subject-core never emits a NO_OP status. A race to terminal is reconciled to the stored original. These two continuation consumers are mutually exclusive for one proposal.

Conflict recording has one exact separate operation so the journal never implicitly reads canonical state:

`TransitionIdentityJournal.recordReuseConflict(transition_id, attempted_subject_id, attempted_transition_type, attempted_proposal_ref, attempted_payload_fingerprint, revision_before, logical_time_before, state_hash_before, snapshot_hash_before)`.

The final four values must be the exact revision/logical-time/StateHash/SnapshotHash position already loaded by the caller before `reserveIdentity`. Under one journal CAS, this operation requires the existing header fingerprint to differ, uses the next contiguous conflict sequence, constructs the bound `AuditEventV1`, `CanonicalErrorResultV1` and `TransitionReuseConflictV1`, stores all three, and publishes one `record_version+1` successor whose header/attempts/terminal fields are byte-equal. The stable tuple `(attempted_subject_id,attempted_transition_type,attempted_proposal_ref,attempted_payload_fingerprint)` is the idempotency key；the four observed position fields are captured only on the first append and are not part of duplicate detection. If that attempted tuple is already present after retry/response loss—even if current authority later advanced—the operation returns its original CanonicalError result and first-observed position without a new conflict/audit/version；otherwise it appends exactly one. CAS/routing race rereads the record and repeats this rule. `OUTCOME_UNKNOWN` is reconciled by the same stable tuple before any result is claimed. The journal may read its own identity record but MUST NOT call `StateReader` or infer any canonical position field.

### 14.2 AuthoritativeTransitionRecordV1

Every key is required:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `transition-record-v1` |
| `record_version` | positive safe integer；starts 1 at reservation and increments once per record successor event；appending a terminal COMMITTED/NO_OP attempt and setting terminal fields is one event, not two |
| `transition_id` / `subject_id` / `transition_type` | immutable reserved identity fields |
| `proposal_ref` | immutable ref derived by §8.6 |
| `payload_fingerprint` | immutable `HashV1` |
| `fingerprint_version` | literal `proposal-fingerprint-v1` |
| `first_seen_sequence` | positive journal-local logical sequence；not SubjectState/logical time |
| `attempts` | append-only `TransitionAttemptV1[]`; may be empty only while OPEN |
| `reuse_conflicts` | append-only `TransitionReuseConflictV1[]`, default `[]` |
| `terminal_status` | `COMMITTED|NO_OP|null`; null while OPEN/retryable |
| `terminal_result_ref` | result ref iff terminal status non-null；otherwise null |

Rejected/aborted attempts do not make the header terminal. COMMITTED or NO_OP is single-assignment terminal；no later normal attempt may append. A later changed-fingerprint reuse may only append a `reuse_conflicts` successor while preserving the immutable header, all attempts and terminal fields byte-for-byte；that append increments `record_version` once. The committed final record is in the canonical atomic bundle. The journal reservation and prior attempts hand off by exact `record_version` CAS to `AtomicCommitStore`; successful authority publication atomically appends COMMITTED and sets the terminal fields. If a derived journal view misses that finalization, the committed bundle is authoritative and reconciliation rebuilds it.

### 14.3 TransitionAttemptV1, reuse conflicts and AuditEventV1

`TransitionAttemptV1` is closed and every key is required:

| Field | Exact type |
|---|---|
| `attempt_sequence` | positive safe integer；starts 1 and is contiguous within `attempts` |
| `status` | `REJECTED|ABORTED|NO_OP|COMMITTED` |
| `revision_before` / `revision_after` | `StateRevisionV0` |
| `state_hash_before` / `state_hash_after` | `HashV1` |
| `result_ref` | required result ref |
| `prepared_result_ref` | required original `workflow` ref from §7.6 |
| `trace_ref` | trace ref or null |
| `audit_ref` | audit ref or null |
| `error_code` | §13.2 code or null |
| `reason` | `RequirementIdV1|null` |

Status invariants: COMMITTED has `revision_after=revision_before+1`, required trace, changed-or-equal state hash as determined by candidate, and null audit/error/reason. NO_OP has equal revisions/hashes, null trace/audit/error and reason=`TIME-NOOP-001`. REJECTED/ABORTED have equal revisions/hashes, null trace, and non-null audit/error/reason. Every result ref points to the exact §7 envelope. Admission errors never enter attempts.

`TransitionReuseConflictV1` is closed and every key is required:

| Field | Exact type / rule |
|---|---|
| `conflict_sequence` | positive safe integer；starts 1 and is contiguous within `reuse_conflicts` |
| `attempted_subject_id` | `IdentifierV0` from the conflicting proposal |
| `attempted_transition_type` | exact `TransitionTypeV0` from the conflicting proposal |
| `attempted_proposal_ref` | exact conflicting `proposal` ref |
| `attempted_payload_fingerprint` | exact conflicting `HashV1` |
| `revision_before` / `logical_time_before` | first-observed canonical `StateRevisionV0` / `LogicalTimeV0` |
| `state_hash_before` / `snapshot_hash_before` | first-observed exact hashes |
| `error_code` | literal `TRANSITION_ID_REUSE` |
| `reason` | literal `IDEM-REUSE-001` |
| `audit_ref` | exact `audit` ref for this conflict |
| `result_ref` | exact `result` ref of its `CanonicalErrorResultV1` |

It records both the attempted values and, by parent record linkage, the original identity/fingerprint. It never overwrites the original header or appends a normal attempt.

`AuditEventV1` is closed and every key is required:

| Field | Exact type / rule |
|---|---|
| `schema_version` | literal `audit-event-v1` |
| `audit_ref` | deterministic `audit` ref from §14.4 |
| `subject_id` / `transition_id` | exact attempted identifiers |
| `payload_fingerprint` | attempt `HashV1`; conflicting fingerprint for reuse |
| `attempt_sequence` | positive safe integer；normal attempt sequence, or conflict sequence for reuse |
| `status` | `REJECTED|ABORTED|REUSE_CONFLICT` |
| `error_code` | exact non-null §13.2 code；`TRANSITION_ID_REUSE` iff reuse conflict |
| `reason` | exact non-null `RequirementIdV1` from §13.3 |
| `revision_before` | observed `StateRevisionV0` |
| `state_hash_before` | observed `HashV1` |

Human diagnostic text, stack and wall clock stay outside this projection.

### 14.4 Deterministic refs and acyclic derivation

All refs below use SHA-256/JCS, remove the `sha256:` prefix and prepend the declared ref kind:

1. `proposal_ref` follows §8.6.
2. `trace_id` follows §10.2.
3. `commit_ref = commit:<hex>` over `{projection:"characteros-next/subject-core/commit-id/v1",value:{subject_id,transition_id,transition_type,next_revision,state_hash_after,snapshot_hash_after,trace_ref,previous_commit_ref}}`.
4. `audit_ref = audit:<hex>` over `{projection:"characteros-next/subject-core/audit-id/v1",value:{subject_id,transition_id,payload_fingerprint,attempt_sequence,status,revision_before,state_hash_before,error_code,reason}}`; for reuse conflict, status is `REUSE_CONFLICT` and the attempted fingerprint is used.
5. Each result ref is `result:<hex>` over `{projection:"characteros-next/subject-core/result-id/v1",value:RESULT_WITHOUT_RESULT_REF}`. A COMMITTED result is computed after commit ref；a CanonicalError result after audit ref；a NO_OP result directly from its complete no-result-ref body. `AlreadyCommittedResultV1` creates no ref and carries `original_result_ref`.

This order has no self-reference. Random IDs, wall clock, store offsets and publish receipts are forbidden inputs.

---

## 15. G10 — Atomic persistence port contract

### 15.1 Conceptual ports

| Port | Responsibility | Forbidden |
|---|---|---|
| `StateReader` | load current committed bundle/snapshot and exact authoritative bundle-chain records by `commit_ref` for restore/reconciliation | repair/default/migrate；using a derived HEAD/index as authority |
| `TransitionRecordReader` | read unified durable identity/terminal-result view | using trace_window or derived index as ledger |
| `TransitionIdentityJournal` | first-seen reservation；retryable attempts；NO_OP terminal；explicit caller-bound reuse-conflict/failure audit | finalizing COMMITTED outside AtomicCommitStore；canonical state/history writes；implicitly reading canonical state to obtain revision/hash |
| `ReferenceValidator` | validate immutable repository revision/hash and bound refs | retrieval/ranking/payload mutation |
| `PreparedResultValidator` | inverted integrity capability: validate a `workflow` ref resolves to exact prepared-record bytes and expected identity/fingerprint；return verdict only | exposing MICL/domain content to subject-core；ranking/orchestration；canonical writes |
| runtime `WorkflowStore` | durably create/read content-addressed `PreparedLogicalResultV1` before authority；rebuild MICL checkpoint from prepared record + authoritative outcome | canonical state/history writes；being the sole truth for a committed logical result；subject-core import/call |
| `AtomicCommitStore` | the **only canonical write authority**: compare expected revision and atomically persist a complete bundle | separate state/trace/record commits, last-write-wins |
| `PublishSink` | publish a committed projection and recover by commit ref | rolling back canonical authority |
| `TraceHistoryView` | optional read/rebuild view over committed MutationHistory | prepare/commit authority；AuditEvent storage |

These are conceptual capabilities, not interfaces/classes/code and do not select Postgres, SQLite, Redis or any vendor.

### 15.2 AtomicCommitBundleV1

Every key is required:

| Field | Exact contract |
|---|---|
| `commit_version` | literal `atomic-commit-v1` |
| `serialization_version` | literal `canonical-json-v1` |
| `commit_ref` | deterministic ref from §14.4 |
| `subject_id` | current subject |
| `transition_id` / `transition_type` | exact proposal identity |
| `payload_fingerprint` | exact §8.6 fingerprint |
| `prepared_result_ref` | exact verified §7.6 `workflow` ref bound by the terminal TransitionAttempt |
| `expected_revision` / `next_revision` | next=expected+1 |
| `identity_record_version_before` | exact OPEN journal record version consumed by this commit |
| `previous_commit_ref` / `previous_record_checksum` | null only when `expected_revision=0` and no prior committed transition record; otherwise bind previous committed record |
| `next_snapshot` | embedded complete canonical `SubjectStateV0` JSON object including TraceWindow；not string/base64/implementation bytes |
| `logical_time_before` / `logical_time_after` | exact current/candidate logical times |
| `state_hash_before` / `state_hash_after` | current/recomputed candidate StateHashes |
| `snapshot_hash_before` / `snapshot_hash_after` | recomputed current/candidate SnapshotHashes |
| `trace_entry` | exact TraceEntryV1 |
| `trace_window` | exact next TraceWindowV1；byte-equal to `next_snapshot.trace_window` |
| `mutation_history_link` | closed `{history_sequence,previous_trace_ref,current_trace_ref}`；sequence=next revision；previous null only for first commit；current=TraceEntry.trace_id |
| `transition_record` | full terminal-COMMITTED `AuthoritativeTransitionRecordV1` successor |
| `canonical_result` | exact original `CanonicalCommitResultV1(status=COMMITTED)` object |
| `repository_revision_bindings` | nonempty unique/sorted `RepositoryRevisionBindingV1[]` |
| `record_checksum` | SHA-256/JCS envelope projection `characteros-next/atomic-commit/record-checksum/v1` over complete record excluding this checksum |

Cross-field equalities are mandatory:

1. `next_revision=expected_revision+1`；the current authority revision/hash equal expected/state_hash_before.
2. Bundle subject/transition/fingerprint/type equal the admitted proposal, trusted prepared-result binding, TraceEntry, transition record and canonical result；the binding ref equals the terminal TransitionAttempt ref. Outside subject-core, conformance/restore/recovery must resolve that ref to an exact §7.6 prepared record, recompute it and verify the same identity/fingerprint；missing/mismatch fails closed.
3. `next_snapshot.identity.subject_id=subject_id` and `next_snapshot.runtime_metadata.state_revision=next_revision`.
4. before logical/state/snapshot values equal current authority；after logical/state/snapshot values equal the exact candidate and §§8.3–8.4 recomputation；TraceEntry logical time and before/after hashes equal bundle fields.
5. TraceEntry revisions are expected/next；its `history_sequence=next_revision`.
6. `trace_window` JCS bytes equal `next_snapshot.trace_window`；its final entry JCS bytes equal `trace_entry`.
7. cursor last sequence and all mutation-history link sequences equal next revision；current trace ref equals TraceEntry ID；previous trace ref equals prior committed trace and is null iff expected revision is 0.
8. `snapshot_hash_before` recomputes from current state hash/subject/revision/cursor/last trace；`snapshot_hash_after` recomputes from candidate state hash/subject/next revision/exact cursor/current trace ref.
9. `commit_ref` recomputes by §14.4.
10. Canonical result subject/transition/fingerprint/revisions/state hashes/after snapshot hash/trace/commit refs equal bundle fields；its result ref recomputes by §14.4. The original COMMITTED `LogicalTransitionResultV1` is uniquely assembled from this outcome plus bundle times/before snapshot hash and prepared domain/external refs；committed audit refs are `[]`.
11. Transition record immutable identity equals reserved journal header；`record_version=identity_record_version_before+1`；its last attempt is COMMITTED and equals bundle revision/hash/result/trace；terminal result ref equals canonical result ref.
12. `repository_revision_bindings` equals the sorted distinct union of current and next snapshot repository/autobiographical revision IDs plus non-null memory-delta expected revisions；every hash validates and no unrelated revision appears.
13. expected revision 0 requires both previous fields null；revision >0 requires both and they must equal the immediately preceding authoritative bundle.
14. `record_checksum` is SHA-256/JCS of `{projection:"characteros-next/atomic-commit/record-checksum/v1",value:BUNDLE_WITHOUT_RECORD_CHECKSUM}`；the commit ref remains in checksum input.
15. No publish receipt/status, wall clock, stack, log, random value or physical location occurs anywhere in the bundle.

`AtomicCommitStore.compareAndCommit(expected_revision, identity_record_version_before, complete_bundle)` has exactly three top-level conceptual outcomes: `COMMITTED`, `CONFLICT`, `FAILURE`. `FAILURE` has required certainty `DEFINITE_NOT_COMMITTED|OUTCOME_UNKNOWN`. A revision/identity CAS mismatch is `CONFLICT`; it never overwrites the winner. `OUTCOME_UNKNOWN` is not an ABORTED business result: the caller must reconcile by transition ID/fingerprint until it finds the committed record or proves definite non-publication. Reconciliation unavailability keeps the operation unresolved and may surface only as a transport/operational failure；it appends no aborted attempt and returns no canonical/logical business result. Only after committed truth is found may the original result be returned；only after definite non-publication is proved may an aborted/retry attempt be durably appended.

### 15.3 Authority point and recovery oracle

P2.1 may later implement a local reference adapter, but this task only freezes its observable contract:

1. Build a complete same-subject pending bundle from an exact OPEN identity record；validate all §15.2 schema/checksum/hash equalities.
2. Durably flush the complete bundle before authority publication.
3. Atomically publish the complete committed bundle and finalize that identity record. This single publication is the authority point.
4. HEAD/current snapshot, TraceHistory/offload view, idempotency index, WorkflowStore terminal checkpoint and PublishSink view are rebuildable projections. A committed logical result is reconstructed from its immutable prepared record + authoritative bundle, never from checkpoint-only data.
5. Crash before authority point: none committed；pending bundle and prepared logical record are ignored/GC candidates；OPEN reservation remains retryable.
6. Crash after authority point but before HEAD/journal-view/index/workflow-checkpoint/publish update: committed bundle plus its pre-durable prepared record remain authoritative reconstruction inputs；recovery returns the byte-identical logical result and rebuilds projections；no rollback, stage rerun or duplicate.
7. Recovery accepts only the highest continuous valid commit chain. Torn/corrupt/gapped chain fails closed；it is never skipped or auto-repaired.
8. Atomic trace/history component preparation failure: none committed. CAS loser: none committed by loser. Repository prepare + commit failure: repository revision remains noncanonical orphan.

The contract promises single-subject compare-and-commit semantics and externally observable atomicity. It does not claim distributed durability or production deployment readiness.

Service-failure ownership is exact: repository/`ReferenceValidator` unavailability at restore steps 5–6 maps to `SERVICE_UNAVAILABLE/FAIL-SERVICE-001`; authoritative trace, commit-chain, `PreparedResultValidator` or atomic-journal unavailability at restore steps 7–8 maps to `SERVICE_UNAVAILABLE/FAIL-PRECOMMIT-001`. An earlier deterministic restore validation failure wins by §11 precedence. No adapter may choose a different reason from exception wording.

---

## 16. G11 — Retrieval ownership

The only allowed actor chain is:

```text
runtime/transitions/observation
  → runtime controlled projection builds RetrievalQuery
  → memory package deterministic RetrievalService reads MemoryRepository
  → memory producer returns RetrievalResult and optional retrieval-metadata delta
  → subject-core validates the delta and performs the canonical atomic commit
```

Subject-core **MUST NOT** import/call memory, retrieval, appraisal, affect, regulation, runtime, MICL or an LLM provider. It never executes retrieval, ranks memories or validates appraisal meaning. Calling the inverted `ReferenceValidator` / `PreparedResultValidator` verdict-only capabilities does not import or execute their owning domains；neither returns payload/domain meaning. Appraisal package deterministic validation owns appraisal proposal/evidence checks; subject-core later validates only canonical delta schema/authority/invariants.

---

## 17. Fixture catalog freeze

### 17.1 Counts and evidence rule

- Golden fixture: **1** (`S0`).
- P2.1 Subject Core fixtures: **24** exact cases.
- A1–A13 acceptance fixtures: **40** exact cases.
- **Total fixture cases: 65.**

Every future fixture result must name its Requirement IDs, input fixture version, oracle, previous/next revision and hashes, trace/audit expectation and evidence artifact. “Throws” or “looks correct” is never an oracle. This task defines fixtures only; no test file or evidence artifact is created.

### 17.2 Subject Core fixtures（24）

| Fixture | Frozen input/stimulus | Exact expected result | Requirement IDs | Evidence |
|---|---|---|---|---|
| SC-001 | two isolated S0 copies + same valid complete Observation proposal | each `COMMITTED`; revision `0→1`; old S0 unchanged；same candidate/result/hash/trace；one trace, no audit | `SS-IMMUTABLE-001`, `SS-REVISION-001`, `TR-DET-001`, `TR-ATOMIC-001`, `TRACE-ATOMIC-001`, `TRACE-CONTENT-001`, `HASH-DET-001` | fixture-results.json + state-hash-manifest.json + transition-trace-manifest.json |
| SC-002A | well-formed unregistered producer ID targets writable `/context` and lacks trusted capability | `REJECTED/UNAUTHORIZED_PRODUCER`, reason `SS-AUTH-001`; revision/hash unchanged；audit yes, trace none | `SS-AUTH-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | failure-summary.json |
| SC-002B | registered context producer in Time proposal targets `/context` | `REJECTED/INVALID_TRANSITION_OWNER`, reason `SS-AUTH-001`; revision/hash unchanged；audit yes, trace none | `SS-AUTH-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | failure-summary.json |
| SC-002C | valid LLM/provider identity attempts direct state/revision/trace write outside proposal/commit port | `AdmissionErrorResultV1 REJECTED/FORBIDDEN_DIRECT_MUTATION`, reason `LLM-AUTH-001`; no result/audit/trace/ref or state change | `SS-AUTH-001`, `LLM-AUTH-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | failure-summary.json |
| SC-003 | expected N, authority already N+1 before semantic validation | `REJECTED/STALE_STATE_REVISION`, reason `SS-REVISION-001`; attempt contributes `+0`; audit yes, trace none | `SS-REVISION-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | failure-summary.json |
| SC-003B | expected revision matched precheck；another commit wins store CAS | after reconciliation loser=`REJECTED/COMMIT_CONFLICT`; winner is authority；loser `+0`, audit yes, no loser trace | `FAIL-CAS-001`, `SS-REVISION-001` | failure-summary.json + transition-trace-manifest.json |
| SC-004A | committed ID + same fingerprint after restart | `ALREADY_COMMITTED`; original revisions/hashes/result/commit/trace refs；`+0`, no new audit/trace | `IDEM-COMMIT-001`, `SS-REVISION-001` | fixture-results.json |
| SC-004B | known ID + changed fingerprint | `REJECTED/TRANSITION_ID_REUSE`; new record-version successor appends only conflict+audit while identity/attempt/terminal fields remain byte-equal；trace none, `+0` | `IDEM-REUSE-001` | failure-summary.json |
| SC-004C | prior `ABORTED/SERVICE_UNAVAILABLE` ID + same fingerprint after restart；service recovered | OPEN/retry record appends full new attempt；new attempt `COMMITTED/+1` with one trace；prior audit retained, no duplicate | `IDEM-RETRY-001` | fixture-results.json + transition-trace-manifest.json |
| SC-005 | complete Observation bundle has `context.scene=""` | `REJECTED/INVALID_VALUE_RANGE`; Affect/Mood/Context/retrieval fields unchanged；revision `+0`, audit yes, trace none | `SS-REVISION-001`, `TR-ATOMIC-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | failure-summary.json + state-hash-manifest.json |
| SC-006 | valid known-subject proposal references absent/corrupt R999 | `REJECTED/INVALID_MEMORY_REVISION`, reason `MEM-REV-001`; `+0`, audit yes, trace none | `MEM-REV-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | repository-revision-manifest.json + failure-summary.json |
| SC-006B | repository payload/embedding/index key embedded in SubjectState/envelope | `INVALID_SCHEMA`; payload absent from admitted state/StateHash；no commit/trace | `MEM-OWN-001`, `SS-SCHEMA-001` | state-hash-manifest.json + failure-summary.json |
| SC-006C | R1 prepared；later Context value validation fails | `REJECTED/INVALID_VALUE_RANGE`; SubjectState remains R0；R1 is noncanonical orphan；`+0`, audit yes, trace none | `MEM-ORPHAN-001`, `TR-ATOMIC-001` | repository-revision-manifest.json + failure-summary.json |
| SC-007 | S0/S1/empty/R0/proposal vectors；member order, `-0`, excluded observability variants | exact §9 bytes/hashes；each included/excluded projection relation equals its stated golden outcome | `HASH-DET-001`, `HASH-PROJ-001`, `HASH-SER-001`, `HASH-SNAPSHOT-001` | state-hash-manifest.json |
| SC-008 | valid `PersistedSubjectEnvelopeV1` plus schema/full-checksum/state-hash/snapshot-hash/ref/trace/chain corrupt vectors | valid vector restores exactly；invalid vectors respectively `INVALID_SCHEMA`, `FULL_SNAPSHOT_CHECKSUM_MISMATCH`, `STATE_HASH_MISMATCH`, `SNAPSHOT_HASH_MISMATCH`, `INVALID_MEMORY_REVISION`, `TRACE_INTEGRITY_FAILURE`, `COMMIT_CHAIN_INTEGRITY_FAILURE`; no repair/audit/trace | `SS-SCHEMA-001`, `SS-RESTORE-001`, `MEM-REV-001`, `HASH-DET-001`, `HASH-PROJ-001`, `HASH-SER-001`, `HASH-SNAPSHOT-001` | state-hash-manifest.json + repository-revision-manifest.json + failure-summary.json |
| SC-008B | persisted snapshot has nonempty six-field observation-scoped Context, then restart | success；all Context JCS bytes, revision, StateHash and SnapshotHash equal；no transition/audit/trace | `SS-RESTORE-002`, `HASH-PROJ-001` | fixture-results.json + state-hash-manifest.json |
| SC-009 | valid ordinary delta uses classified readonly path `/identity` with exact IdentityV0 value | `REJECTED/FORBIDDEN_DIRECT_MUTATION`, reason `SS-AUTH-001`; `+0`, audit yes, trace none | `SS-AUTH-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | failure-summary.json |
| SC-010 | overlapping paths or duplicate producer/domain in varied input order | deterministic `REJECTED/DOMAIN_DELTA_CONFLICT`; `+0`, no apply/last-wins；audit yes, trace none | `TR-CONFLICT-001`, `TR-DET-001`, `TR-ATOMIC-001` | failure-summary.json |
| SC-011 | vector a: atomic trace/history/bundle component preparation unavailable after a durable attempt；vector b: trusted reservation continuation/prepared record/binding invalid before any attempt | a: durable `ABORTED/SERVICE_UNAVAILABLE`, reason `FAIL-PRECOMMIT-001`, authority `+0`, audit yes, trace none；b: COMMIT Admission `REJECTED/COMMIT_CHAIN_INTEGRITY_FAILURE`, reason `SS-RESTORE-001`, OPEN unchanged, authority `+0`, no attempt/audit/trace | `TR-ATOMIC-001`, `TRACE-ATOMIC-001`, `FAIL-PRECOMMIT-001`, `SS-RESTORE-001` | failure-summary.json + transition-trace-manifest.json |
| SC-011B | sequentially commit 65 entries from S0 | revision/cursor=65；capacity 64；offloaded sequence=1/ref=derived trace 1；window holds 2..65；MutationHistory reconstructs 1..65 | `TRACE-HISTORY-001`, `TRACE-CONTENT-001` | transition-trace-manifest.json |
| SC-012 | authority succeeds；HEAD/index/WorkflowStore terminal checkpoint/PublishSink update fails after the prepared logical record is durable；restart | original `COMMITTED/+1` unchanged；bundle resolves the exact prepared ref and reconstructs byte-identical domain/external refs + logical wrapper；retry=`ALREADY_COMMITTED/+0` with that original truth；PublishObservation `PENDING→PUBLISHED`; recovery rebuilds views；no rollback/stage rerun/duplicate/new result | `FAIL-PUBLISH-001`, `IDEM-RECOVERY-001`, `TRACE-ATOMIC-001` | fixture-results.json + failure-summary.json + transition-trace-manifest.json |
| SC-013 | committed bundle exists but derived idempotency index is missing | reconcile from bundle；retry=`ALREADY_COMMITTED/+0` with original refs；no new audit/trace | `IDEM-RECOVERY-001`, `IDEM-COMMIT-001` | fixture-results.json |
| SC-014A | ISO wall-clock string supplied as occurrence logical integer | `AdmissionErrorResultV1 REJECTED/INVALID_SCHEMA`; `+0`, no audit/trace; input excluded from canonical state | `SS-SCHEMA-001`, `FAIL-PRECOMMIT-001`, `HASH-PROJ-001` | failure-summary.json |
| SC-014B | same canonical input with different external logs/wall clock/correlation | same semantic result/canonical bytes/StateHash/trace body；observability values remain external | `HASH-DET-001`, `HASH-PROJ-001`, `TR-DET-001`, `TIME-WALL-001` | fixture-results.json + state-hash-manifest.json |

### 17.3 A1–A13 fixtures（40）

Each row below is one catalog case. A parameterized row may have named vectors, but `fixture-results.json` must emit one result record per vector; vectors do not inflate the 40-case catalog count. `Δrev` is relative to the declared fixture start. “trace none” means the failing attempt creates no mutation trace；already-committed earlier-stage traces remain authoritative.

| Case | Exact Requirement IDs | Frozen input | Exact status/code/revision/orphan/retry/trace-audit outcome | Evidence |
|---|---|---|---|---|
| A1.1 | `HASH-DET-001`, `HASH-SER-001`, `TR-DET-001`, `MEM-RET-DET-001`, `MICL-DET-001` | S0/R0；occurrence=current；fixed providers；run full MICL three isolated times | each `COMPLETED`, error null, `Δrev=+2` (Observation, Learning), no orphan/retry/audit；two traces；selected refs/deltas/final bytes/hashes/trace bodies equal across runs | fixture-results.json + state-hash-manifest.json + transition-trace-manifest.json + repository-revision-manifest.json |
| A1.2 | `HASH-DET-001`, `HASH-SER-001`, `TR-DET-001`, `MICL-DET-001`, `TIME-WALL-001` | same S0/elapsed/config；only wall-clock/log values differ；three isolated Time runs | each `COMMITTED`, error null, `Δrev=+1`, no orphan/retry/audit；one trace；candidate bytes/hash/trace body equal | fixture-results.json + state-hash-manifest.json + transition-trace-manifest.json |
| A2.1 | `MEM-REV-001`, `MEM-OWN-001`, `MEM-ORPHAN-001`, `SS-RESTORE-001` | S0；prepare sealed R1(parent R0) and commit it；repository also contains unadopted sealed R2；persist and restore | `COMMITTED`, error null, `Δrev=+1`; R2 remains noncanonical orphan；no retry/audit；one Learning trace；restore still binds R1 exactly；payload absent from state | fixture-results.json + repository-revision-manifest.json + state-hash-manifest.json + transition-trace-manifest.json |
| A2.2 | `MEM-REV-001`, `SS-RESTORE-001` | restore envelope references absent R999 | `Admission REJECTED/INVALID_MEMORY_REVISION`, `Δrev=0`, no orphan；retry only with valid envelope/repository；audit/trace none；fail closed | failure-summary.json + repository-revision-manifest.json + state-hash-manifest.json |
| A3.1 | `MEM-RET-DET-001`, `MEM-RET-HISTORY-001` | fixed query/config；controlled H1 versus H2 relevant histories；each retrieved three times | no TransitionResult；each history equals its frozen selected-ref/score/evidence vector；candidate count is a nonnegative safe integer，normalized reason values are in `[0,1]`，final scores are finite；H1 vector differs from H2；no state/orphan/audit/trace | fixture-results.json |
| A3.2 | `MEM-RET-DET-001`, `MEM-RET-CONTROL-001` | H1 versus H1+H3 irrelevant-history control；same query/config | no TransitionResult；selected relevant ref set/order equals the H1 golden vector despite irrelevant quantity；candidate count/ranking reason ranges remain valid and final scores equal the H1 golden values；no state/orphan/audit/trace | fixture-results.json |
| A4.1 | `MICL-RETRIEVAL-001` | same observation/state；two frozen valid RetrievalResults；fixed projection/provider | no TransitionResult；each appraisal-input hash equals its own golden value and the two golden values differ；no state/audit/trace | fixture-results.json |
| A4.2 | `MICL-STAGE-001` | Appraisal request lacks required RetrievalResult/Interpretation refs before a canonical transition proposal exists | owning-stage `REJECTED/INVALID_STAGE_DEPENDENCY`, `Δrev=0`, no orphan；retry with complete upstream evidence under same stage key；no transition identity/AuditEvent/trace，audit_refs=[] | failure-summary.json |
| A4.3 | `LLM-EVID-001` | appraisal proposal cites evidence outside controlled projection before a canonical transition proposal exists | owning-stage `REJECTED/UNSUPPORTED_EVIDENCE_REF`, `Δrev=0`, no orphan；retry corrected stage proposal；no transition identity/AuditEvent/trace，audit_refs=[] | failure-summary.json |
| A5.1 | `SS-AFFECT-001`, `SS-RESTORE-002` | valid envelope with non-neutral affect/mood and nonempty Context | restore success, error null, `Δrev=0`, no orphan/retry/audit/trace；affect/mood/Context bytes and hashes equal | fixture-results.json + state-hash-manifest.json |
| A5.2 | `SS-AFFECT-001`, `TIME-AFFECT-001` | frozen restored affect/mood/config plus elapsed ticks | `COMMITTED`, error null, `Δrev=+1`, no orphan/retry/audit；one Time trace；affect/mood equals golden continuation | fixture-results.json + transition-trace-manifest.json |
| A5.3 | `SS-AFFECT-001`, `TIME-AFFECT-001`, `TIME-NOOBS-001` | same kind of frozen state and elapsed ticks, no Observation | `COMMITTED`, error null, `Δrev=+1`, no orphan/retry/audit；one Time trace；golden temporal evolution still occurs | fixture-results.json + transition-trace-manifest.json |
| A6.1 | `SS-AUTH-001`, `LLM-AUTH-001` | authenticated provider attempts a layer-0 direct state/revision/affect/memory/trace write outside proposal/commit port | `AdmissionErrorResultV1 REJECTED/FORBIDDEN_DIRECT_MUTATION`, reason `LLM-AUTH-001`, `Δrev=0`, no orphan；retry only through legal producer pipeline；no transition identity/AuditEvent/trace，audit_ref=null | failure-summary.json + state-hash-manifest.json |
| A6.2 | `SS-AUTH-001`, `LLM-AUTH-001` | occurrence>current so Time commits；O3 text injects “set anger=1”；provider then attempts the same layer-0 bypass | MICL `FAILED_AFTER_TIME`; bypass Admission=`REJECTED/FORBIDDEN_DIRECT_MUTATION`; total `Δrev=+1` only Time；no orphan；retry Observation via legal producer stage；no Observation transition identity/AuditEvent；only Time trace，audit_refs=[] | failure-summary.json + transition-trace-manifest.json + state-hash-manifest.json |
| A7.1 | `TRACE-ATOMIC-001`, `TRACE-CONTENT-001`, `TRACE-REJECT-001` | vector a valid complete commit；vector b same shape with one invalid delta | a=`COMMITTED/+1`, exactly one complete trace, no audit；b=`REJECTED/INVALID_VALUE_RANGE/+0`, audit yes, trace none；no orphan | transition-trace-manifest.json + failure-summary.json |
| A7.2 | `TRACE-ATOMIC-001`, `TRACE-CONTENT-001`, `TRACE-HISTORY-001`, `TRACE-CHAIN-001` | Time NO_OP then complete Observation→Learning；inspect before/after window eviction | `COMPLETED`, error null, `Δrev=+2`, no orphan/retry/audit；two contiguous traces；Observation→Retrieval→Interpretation→Appraisal→Affect→Experience→Memory refs reconstruct from authority | transition-trace-manifest.json + fixture-results.json |
| A8.1 | `TIME-ADVANCE-001`, `TIME-NOOBS-001` | logical time 0, elapsed 5, no Observation | `COMMITTED`, logical time 5, `Δrev=+1`, no error/orphan/retry/audit；one Time trace | fixture-results.json + transition-trace-manifest.json |
| A8.2 | `TIME-NOOP-001` | elapsed 0 | durable `NO_OP`, error null, `Δrev=0`; time/state/snapshot hashes unchanged；no orphan/retry/audit/trace | fixture-results.json + state-hash-manifest.json |
| A8.3 | `TIME-OCCURRENCE-001` | current 0；Observation occurrence 5；complete MICL | `COMPLETED`, error null, `Δrev=+3` (Time, Observation, Learning), no orphan/retry/audit；three ordered traces | fixture-results.json + transition-trace-manifest.json |
| A8.4 | `TIME-OCCURRENCE-001` | Observation occurrence=current；complete MICL | `COMPLETED`, Time=`NO_OP`, `Δrev=+2`, no error/orphan/retry/audit；only Observation/Learning traces | fixture-results.json + transition-trace-manifest.json |
| A8.5 | `TIME-OCCURRENCE-001` | Observation occurrence<current, detected before a canonical transition proposal exists | MICL `FAILED_BEFORE_STATE_CHANGE`; owning-stage `REJECTED/OUT_OF_ORDER_OBSERVATION`, `Δrev=0`, no orphan；retry with new valid MICL request；no transition identity/AuditEvent/trace，audit_refs=[] | failure-summary.json + transition-trace-manifest.json |
| A8.6 | `TIME-WALL-001` | two equal canonical/logical Time inputs；different wall-clock/log values | both `COMMITTED`, each `Δrev=+1`; no error/orphan/retry/audit；one trace each；canonical bytes/hash/trace bodies equal | fixture-results.json + state-hash-manifest.json + transition-trace-manifest.json |
| A9.1 | `MICL-ACTION-001` | S0；Time NO_OP；complete minimal MICL；no action executor | `COMPLETED`, error null, `Δrev=+2`, no orphan/retry/audit；Observation/Learning traces；`external_effect_refs=[]`；no Action/Outcome | fixture-results.json + conformance-report.json + transition-trace-manifest.json |
| A10.1 | `FAIL-SERVICE-001`, `TRACE-REJECT-001` | Time committed；Interpretation provider unavailable before Observation canonical proposal | MICL `FAILED_AFTER_TIME`; Observation stage `ABORTED/SERVICE_UNAVAILABLE`; total `Δrev=+1`; no orphan；retry same micl request fingerprint/Observation stage key；no Observation transition identity/AuditEvent；only Time trace，audit_refs=[] | failure-summary.json + transition-trace-manifest.json |
| A10.2 | `FAIL-SERVICE-001`, `TRACE-REJECT-001` | Time committed；Interpretation proposal rejected by owner before Observation canonical proposal | MICL `FAILED_AFTER_TIME`; owning stage `REJECTED/PROPOSAL_REJECTED`; total `Δrev=+1`; no orphan；retry corrected stage proposal；no Observation transition identity/AuditEvent；only Time trace，audit_refs=[] | failure-summary.json + transition-trace-manifest.json |
| A10.3 | `FAIL-SERVICE-001`, `TRACE-REJECT-001` | Time committed；Appraisal proposal rejected by owner before Observation canonical proposal | MICL `FAILED_AFTER_TIME`; owning stage `REJECTED/PROPOSAL_REJECTED`; total `Δrev=+1`; no orphan；retry corrected stage proposal；no Observation transition identity/AuditEvent；only Time trace，audit_refs=[] | failure-summary.json + transition-trace-manifest.json |
| A10.4 | `FAIL-SERVICE-001`, `TRACE-REJECT-001` | Time committed；MemoryRepository read/retrieval unavailable before Observation canonical proposal | MICL `FAILED_AFTER_TIME`; Observation stage `ABORTED/SERVICE_UNAVAILABLE`; total `Δrev=+1`; no orphan；retry same micl request fingerprint/Observation stage key；no Observation transition identity/AuditEvent；only Time trace，audit_refs=[] | failure-summary.json + transition-trace-manifest.json |
| A10.5 | `FAIL-SERVICE-001`, `TRACE-REJECT-001` | Time committed；Affect producer unavailable before delta/Observation canonical proposal exists | MICL `FAILED_AFTER_TIME`; Observation stage `ABORTED/SERVICE_UNAVAILABLE`; total `Δrev=+1`; no orphan；retry same micl request fingerprint/Observation stage key；no Observation transition identity/AuditEvent；only Time trace，audit_refs=[] | failure-summary.json + transition-trace-manifest.json |
| A10.6 | `SS-REVISION-001`, `FAIL-PRECOMMIT-001`, `TRACE-REJECT-001` | authority N+1；proposal expected N | standalone core=`REJECTED/STALE_STATE_REVISION`, reason `SS-REVISION-001`; authority remains N+1 and tested attempt `Δrev=0`; no orphan；reload/revalidate/new ID；audit yes, trace none；no MICLResult | failure-summary.json |
| A10.7 | `FAIL-PREPARE-001`, `TRACE-REJECT-001` | Time NO_OP；Observation committed；Learning repository prepare fails before revision/canonical proposal creation | MICL `FAILED_AFTER_OBSERVATION`; Learning stage `ABORTED/SERVICE_UNAVAILABLE`; total `Δrev=+1`; orphan none；retry same micl request fingerprint/Learning stage key；no Learning transition identity/AuditEvent；only Observation trace，audit_refs=[] | failure-summary.json + repository-revision-manifest.json + transition-trace-manifest.json |
| A10.8 | `MEM-ORPHAN-001`, `FAIL-PRECOMMIT-001`, `REBASE-STALE-001`, `TRACE-REJECT-001` | Observation committed；R8 prepared；concurrent valid commit advances authority；unsafe Learning rebuild | core `REJECTED/STALE_STATE_REVISION`; Learning `REBASE_REQUIRED` with error `STALE_STATE_REVISION`, reason `REBASE-STALE-001`; MICL `FAILED_AFTER_OBSERVATION`; Learning `Δrev=0`; R8 orphan；audit yes, no Learning trace | failure-summary.json + repository-revision-manifest.json + transition-trace-manifest.json |
| A10.9 | `FAIL-CAS-001`, `TRACE-REJECT-001` | precheck passes；concurrent winner publishes before loser CAS | after reconciliation standalone loser=`REJECTED/COMMIT_CONFLICT`; authority changed only by winner；loser `Δrev=0`, no orphan；reload/rebuild/new ID；audit yes, no loser trace；no MICLResult | failure-summary.json + transition-trace-manifest.json |
| A10.10 | `FAIL-PUBLISH-001`, `IDEM-COMMIT-001`, `IDEM-REUSE-001`, `TRACE-REJECT-001` | response/workflow-terminal-checkpoint/publish lost after durable commit while prepared record remains durable；vector a same ID/stored `proposal-fingerprint-v1`；vector b same ID/different stored fingerprint | transition-level a reconstructs original logical wrapper from bundle+prepared ref then=`ALREADY_COMMITTED/+0` with original domain/external/revision/time/hash/trace refs, no new audit/trace/stage run；b=`REJECTED/TRANSITION_ID_REUSE/+0`, new-ID retry, conflict audit yes, trace none；no orphan；no MICLResult | fixture-results.json + failure-summary.json + transition-trace-manifest.json |
| A10.11 | `MICL-RESUME-001`, `TRACE-REJECT-001` | existing micl_id；vector a same completed request fingerprint；vector b same ID/different request fingerprint | a returns the original `COMPLETED` MICLResult byte-for-byte, no rerun/duplicate；b=separate `MICLAdmissionErrorResultV1 REJECTED/MICL_ID_REUSE/MICL-RESUME-001`, authority unchanged and `Δrev=0`; retry only with new micl_id；no MICLResult/transition identity/AuditEvent/orphan/new mutation trace，audit_refs=[] | fixture-results.json + failure-summary.json + transition-trace-manifest.json |
| A11.1 | `TR-ATOMIC-001`, `TR-CONFLICT-001`, `TRACE-ATOMIC-001` | one fully admitted Observation proposal has N deltas；Context is closed and complete but `scene=""` violates its frozen range | `REJECTED/INVALID_VALUE_RANGE`, `Δrev=0`, no orphan；correct whole payload/new ID；audit yes；none of Affect/Mood/Context/retrieval metadata commits；trace none | failure-summary.json + state-hash-manifest.json + transition-trace-manifest.json |
| A12.1 | `IDEM-COMMIT-001` | committed transition；same ID/fingerprint retry | `ALREADY_COMMITTED`, error null, `Δrev=0`, original refs；no orphan/retry/audit/new trace | fixture-results.json + transition-trace-manifest.json |
| A12.2 | `IDEM-REUSE-001` | used transition ID；payload/fingerprint changed | `REJECTED/TRANSITION_ID_REUSE`, `Δrev=0`; record successor changes only version+conflict/audit，all original identity/attempt/terminal fields unchanged；retry new ID；trace none | failure-summary.json |
| A12.3 | `IDEM-RETRY-001`, `IDEM-RECOVERY-001`, `MICL-RESUME-001` | Time NO_OP；Observation committed；Learning prepare first aborts pre-proposal；same micl_id/request retries after recovery | first `FAILED_AFTER_OBSERVATION`, total `Δrev=+1`; retry by Learning stage key runs Learning only and ends `COMPLETED`, another `+1`; Observation and successful Learning each exactly one trace；workflow failure checkpoint retained，no AuditEvent for first pre-proposal abort | fixture-results.json + failure-summary.json + transition-trace-manifest.json |
| A12.4 | `IDEM-COMMIT-001`, `MEM-IDEM-001` | Learning creates stable episode ID；same transition/memory intent retries | first `COMMITTED/+1`; retry `ALREADY_COMMITTED/+0`; repository set/count unchanged, no orphan/audit/new trace | fixture-results.json + repository-revision-manifest.json + transition-trace-manifest.json |
| A13.1 | `SS-REVISION-001`, `FAIL-PRECOMMIT-001`, `REBASE-STALE-001` | Observation committed；R8 prepared；concurrent commit advances revision；safe and unsafe revalidation vectors | both initial core attempts `REJECTED/STALE_STATE_REVISION`, `Δrev=0`, R8 orphan, audit yes, no Learning trace。Safe: full reload/revalidate/rebuild with new ID/revision then `COMMITTED/+1`。Unsafe: Learning `REBASE_REQUIRED`, MICL `FAILED_AFTER_OBSERVATION`, no further mutation。Never edit only expected revision | conformance-report.json + failure-summary.json + repository-revision-manifest.json + transition-trace-manifest.json |

---

## 18. Independent red-team review

| Attack | Verdict | Evidence |
|---|---|---|
| R1 Can a coding agent still ask what Relationship models contain? | **PASS** | §6.2 freezes exactly `{relationship_id,target_ref}` and readonly semantics. |
| R2 Is the StateHash algorithm still selectable? | **PASS** | §8 freezes SHA-256, JCS, wire and projection. |
| R3 Can raw `JSON.stringify(state)` be treated as canonical? | **PASS** | §8 requires validated JCS projection envelope and §9 vectors. |
| R4 Can restore silently reset Context? | **PASS** | §11 requires exact full-context materialization, same revision/hash. |
| R5 Is trace-window capacity or cursor still TBD? | **PASS** | §10 freezes capacity 64 and three-field logical cursor. |
| R6 Are before/after hashes optional? | **PASS** | TraceEntry requires both StateHash refs. |
| R7 Is affect_profile string/object ambiguous? | **PASS** | §12 freezes one object schema; provenance remains string/null. |
| R8 Is REBASE_REQUIRED an error code? | **PASS** | §13 freezes it as Learning/runtime status/reason; core returns stale rejection. |
| R9 Can transition reuse evade restart detection? | **PASS** | §14 requires durable fingerprint header and append-only attempt journal. |
| R10 Can state commit without trace/record and still conform? | **PASS** | §10/§15 put state, trace, history and identity result in one bundle/authority point. |
| R11 Can subject-core execute retrieval? | **PASS** | §16 and synchronized P1 wording prohibit every memory/retrieval import/call. |
| R12 Must coding change a P1 contract before its first implementation line? | **PASS** | G1–G11 are CLOSED; exact schema/catalog/vector/port/fixture contracts are frozen. |

Additional scope attacks also pass: no emotion calculation, memory ranking/payload, LLM provider, workflow orchestration, database choice, distributed design, test implementation, experiment or migration was added.

---

## 19. Closure, readiness and change control

### 19.1 Contract freeze completion criteria

- G1–G11 all CLOSED.
- 49/49 stable MUST IDs have source, fixture, oracle and evidence.
- S0 and all machine-implementable schemas are exact.
- Golden vectors are reproducible from stated bytes.
- Cross-document contradictions are explicitly superseded/synchronized.
- 65 fixture cases are frozen conceptually.
- Independent red-team R1–R12 all PASS.

Therefore:

```text
P2.1 Contract Freeze        = COMPLETE
P2.1 Coding Readiness       = READY FOR EXPLICIT AUTHORIZATION
P2.1 Implementation         = NOT STARTED
```

### 19.2 Safety check

- **NO CODE**
- **NO IMPLEMENTATION**
- **NO SCHEMA VALIDATOR**
- **NO HASH FUNCTION**
- **NO STATE/TRACE STORE**
- **NO TEST IMPLEMENTATION OR TEST RUN**
- **NO PACKAGE/DEPENDENCY BEHAVIOR CHANGE**
- **NO SUBJECT CORE / MICL / MEMORY / AFFECT / LLM**
- **NO EXPERIMENT**
- **NO MIGRATION OR OLD REPOSITORY CHANGE**
- **NO P2.1 START**

### 19.3 Only allowed next step

> **P2.1 Subject Core Implementation — REQUIRES EXPLICIT AUTHORIZATION**

This document does not provide that authorization and must not trigger implementation automatically.
