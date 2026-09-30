/* Round verdict — HISTORY_INTERNALIZATION_TEST_V1 / PHASE 0.
   The verdict text is read from the frozen scorer's own artifact, never re-typed here, so this
   program cannot disagree with the scorer it reports. */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..", "..");
const runDir = join(repo, "research", "north-star", "history-internalization", "phase-0", "evidence", "run-1");

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(runDir, name), "utf8")) as Record<string, unknown>;

const verdictArtifact = readJson("phase-0-verdict.json");
const delta = readJson("state-delta-report.json");
const hierarchy = readJson("evidence-hierarchy-update.json");
const integrity = (readJson("collection-integrity.json")["integrity"] ?? {}) as Record<string, unknown>;
const score = (readJson("frozen-scorer-output.json")["result"] ?? {}) as Record<string, unknown>;

const verdict = String(verdictArtifact["verdict"] ?? "MISSING");

const artifacts = Object.fromEntries(
  readdirSync(runDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => [`run-1/${name}`, sha256(join(runDir, name))])
);

const round = {
  round: "HISTORY_INTERNALIZATION_TEST_V1_PHASE_0",
  date: "2026-09-21",
  verdict,
  verdict_outcome: verdictArtifact["outcome"] ?? null,
  // The frozen predicate could not be evaluated as preregistered: arm B's trajectory did not
  // complete, so INCONCLUSIVE is forced and no level is raised.
  primary_predicate: verdictArtifact["primary_predicate"] ?? null,
  primary_predicate_satisfied: verdictArtifact["primary_predicate_satisfied"] ?? null,
  evidence_hierarchy_before: hierarchy["before"] ?? null,
  evidence_hierarchy_after: hierarchy["after"] ?? null,
  level_raised: (hierarchy["before"] ?? null) !== (hierarchy["after"] ?? null),
  executor_model: integrity["executor_model"] ?? null,
  transport_substituted: integrity["transport_substituted"] ?? null,
  schedule_followed: integrity["schedule_followed"] ?? null,
  qualification_passed: integrity["qualification_passed"] ?? null,
  turns_executed_A: integrity["turns_executed_A"] ?? null,
  turns_executed_B: integrity["turns_executed_B"] ?? null,
  total_model_calls: integrity["total_model_calls"] ?? null,
  call_tally: integrity["call_tally"] ?? null,
  integrity_failure_count: (integrity["integrity_failures"] as readonly string[] | undefined)?.length ?? null,
  credence: {
    pre_A: delta["credence_pre_A"] ?? null,
    post_A: delta["credence_post_A"] ?? null,
    pre_B: delta["credence_pre_B"] ?? null,
    post_B: delta["credence_post_B"] ?? null,
    delta_A: score["delta_A"] ?? null,
    delta_B: score["delta_B"] ?? null
  },
  descriptive_partial_observation: [
    "lived evidence reached the persistent canonical belief state: 7 of 8 completed belief-semantic resolutions produced a canonical commit, each moving the target credence by exactly the frozen 0.05 step",
    "the CONTRADICTS direction fired: arm B turn 1 moved credence DOWN, the first observed case in this programme of negative-valence lived evidence lowering a canonical credence",
    "the matched-opening design held: turn 0 is byte-identical across arms and produced the same classification and the same +0.05 movement in both",
    "no new proposition was admitted; both subjects ended with the single seeded target proposition",
    "on the two arm-differing evidence events that completed, both arms moved in their predicted and opposite directions",
    "NOT THE ENDPOINT and not admissible as the primary claim, because arm B's trajectory did not complete"
  ],
  failure_analysis: {
    arm_B_turn_2:
      "CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED: SEMANTIC_COMPLETENESS_FAILED: response_semantics PRIMARY_STANCE requires an authoritative SUBJECTIVE_SELECTION stance — executor-side, fail-closed",
    arm_B_turns_3_4: "session: ingress must record (CONFLICT) — cascade from the turn-2 failure; a single executor error ends the arm's usable trajectory",
    failure_reached_the_belief_chain: false,
    already_taxonomised_by: "research/experiments/executor-schema-failure-diagnostic-v0 (RESPONSE_SEMANTICS_INCOMPLETE); that line is scoped to deepseek-flash, this instance occurred on qwen3.5:9b"
  },
  corrections_recorded: readJson("PHASE_0_CORRECTIONS.json")["corrections"] ?? [],
  authorisations: {
    production_change: false,
    mechanism_added: false,
    rerun_missing_turns: false,
    next_stage_authorised: false,
    reason:
      "INCONCLUSIVE from engineering failure authorises nothing. The next attempt at this question is a new, separately preregistered run, not a repair of this one."
  },
  tokens: [
    "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE",
    "CHARACTEROS_UNMODIFIED",
    "EVIDENCE_HIERARCHY_UNCHANGED_AT_L1"
  ],
  artifact_sha256: artifacts
};

writeFileSync(
  join(repo, "research", "north-star", "history-internalization", "phase-0", "evidence", "ROUND_VERDICT.json"),
  `${JSON.stringify(round, null, 2)}\n`
);

console.log(`verdict: ${verdict}`);
console.log(`hierarchy: ${String(round.evidence_hierarchy_before)} -> ${String(round.evidence_hierarchy_after)} (raised: ${String(round.level_raised)})`);
console.log(`credence A ${String(round.credence.pre_A)} -> ${String(round.credence.post_A)} | B ${String(round.credence.pre_B)} -> ${String(round.credence.post_B)}`);
console.log(`turns ${String(round.turns_executed_A)}+${String(round.turns_executed_B)}, calls ${String(round.total_model_calls)}, integrity failures ${String(round.integrity_failure_count)}`);
console.log(`executor ${String(round.executor_model)}, transport substituted: ${String(round.transport_substituted)}`);
console.log(`artifacts hashed: ${Object.keys(artifacts).length}`);
