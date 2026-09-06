/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — frozen manifest (§54/§73).
 * Materialized and hashed BEFORE any official evidence trajectory exists.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  BASELINE_COMMIT, EXPERIMENT_ID, GENERATOR_SPEC, GATES,
  HISTORY_PAIRS, INSUFFICIENT_CONTEXT_LAW, METRIC_PROTOCOL, NO_RETUNE_LAW,
  PARTITION_PROBE_FAMILIES, PARTITION_PROBE_MECHANISM, PARTITION_PROBE_SEED,
  PERFORMANCE_LAW,
  PRODUCTION_SHAPED_DISCLAIMER, RESTORE_PROBES, RUN_ACCOUNTING,
  VERDICT_RULES, ZERO_MODEL_LAW, AMPLITUDE_CLASSES, D1_AMPLITUDE_MIX,
  D2_GOAL_CYCLE, D6_AMPLITUDE_MIX, D6_GOAL_CYCLE, D7_AMPLITUDE_MIX,
  FIELD_RULES, FAMILIES, FAMILY_SEEDS, GOAL_DELTA_MIX, ORDINARY_AMPLITUDE_MIX,
  C1_EVENT, C2_EVENT, C3_COMMON, C3_GOALS, C4_FIELDS, C5_FIELDS, C4C5_COMMON,
  E1_PATH, SHARED_Q_PAIRS, E2A_DESIGN
} from "./contract.ts";
import { canonicalJson, sha256 } from "./fixtures.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** §54: E1 law fingerprint — hash over the frozen E1 law source files. */
export function e1LawFingerprint(): string {
  const files = [
    `${E1_PATH}/contract.ts`,
    `${E1_PATH}/mechanisms.ts`,
    `${E1_PATH}/fixtures.ts`
  ];
  return sha256(JSON.stringify(files.map((p) => [p, sha256(readFileSync(join(ROOT, p)))])));
}

/** §54: E1 evidence fingerprint — hash over the committed E1 evidence tree. */
export function e1EvidenceFingerprint(): string {
  return sha256(execFileSync("git", ["ls-tree", "-r", "HEAD", "--", `${E1_PATH}/evidence/`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: ROOT }));
}

export function protocol() {
  return {
    experiment_id: EXPERIMENT_ID,
    schema_version: "production-shaped-appraisal-dynamics-manifest-e2",
    predecessor: {
      experiment: "STATE_RETENTION_AND_RECOVERY_E1",
      verdict: "SUPPORTED_FOR_NEXT_STAGE",
      frozen: true,
      law_reuse: "E2 imports the E1 B3 law (recovery, impulse, clamp, event order law) from the frozen E1 experiment modules; nothing is reimplemented and E1 is never modified."
    },
    git_baseline: BASELINE_COMMIT,
    research_question: "Does the E1-supported B3 bounded state-retention mechanism remain stable, recoverable, useful as a recent-history carrier, and free from pathological accumulation when driven by contract-valid synthetic Appraisal sequences shaped more like plausible CharacterOS inputs?",
    production_shaped_status: PRODUCTION_SHAPED_DISCLAIMER,
    frozen_law: {
      state: "valence [-1,1], activation [0,1]",
      baseline: "(0, 0.2)",
      tau: 150,
      recovery: "x(t+dt) = b + (x(t)-b) * exp(-dt/150) per axis",
      impulse: "q = relevance*intensity; u_v = 0.25*q*(2*goal_congruence-1); u_a = 0.20*q",
      b3_event: "x_after = clamp(x_before + u)",
      b3_reset_event: "x_after = clamp(b + u)",
      coefficient_changes: "none"
    },
    mechanisms: { primary: ["B0", "B2", "B3_RESET", "B3"], b1: "NOT implemented (E1 established equivalence with B3_RESET for this purpose)", b2: "frozen production ReferenceFastEmaAffectProducer, imported lawfully, native reporting only, cannot decide the verdict" },
    canonical_appraisal_shape: {
      fields: ["relevance", "goal_congruence", "attribution", "controllability", "uncertainty", "intensity", "assessment_confidence"],
      validators: "every generated event passes validateExperienceAppraisalProposalV0; record fixtures pass validateExperienceAppraisalRecordV0",
      insufficient_context: INSUFFICIENT_CONTEXT_LAW
    },
    generator: GENERATOR_SPEC,
    amplitude_classes: AMPLITUDE_CLASSES,
    amplitude_mixtures: { ordinary: ORDINARY_AMPLITUDE_MIX, d1: D1_AMPLITUDE_MIX, d6: D6_AMPLITUDE_MIX, d7: D7_AMPLITUDE_MIX },
    goal_rules: { delta_mixture: GOAL_DELTA_MIX, d2_cycle: D2_GOAL_CYCLE, d6_cycle: D6_GOAL_CYCLE, shared_q_pairs: SHARED_Q_PAIRS, field_rules: FIELD_RULES },
    families: FAMILIES,
    seeds: FAMILY_SEEDS,
    case_fixtures: { c1: C1_EVENT, c2: C2_EVENT, c3: { goals: C3_GOALS, common: C3_COMMON }, c4: C4_FIELDS, c5: C5_FIELDS, c4c5_common: C4C5_COMMON },
    history_pairs: HISTORY_PAIRS,
    probes: {
      partition: { families: PARTITION_PROBE_FAMILIES, seed: PARTITION_PROBE_SEED, mechanism: PARTITION_PROBE_MECHANISM, strategies: ["tick1", "tick10", "direct"], tolerance: 1e-12 },
      restore: RESTORE_PROBES,
      replay: "per mechanism (B0/B2/B3_RESET/B3): same id+payload -> REPLAY delta 0; same id changed payload -> CONFLICT; different id same payload -> APPLIED"
    },
    run_accounting: RUN_ACCOUNTING,
    metrics: METRIC_PROTOCOL,
    gates: GATES,
    verdict_rules: VERDICT_RULES,
    no_retune_law: NO_RETUNE_LAW,
    e2a_design_only: E2A_DESIGN,
    performance_law: PERFORMANCE_LAW,
    zero_model_law: ZERO_MODEL_LAW,
    production_isolation_law: "production source diff relative to the required baseline is empty; only research/experiments/affect-production-shaped-e2/ and evals/conformance/affect-production-shaped-e2.test.ts may change"
  };
}

export type ProtocolE2 = ReturnType<typeof protocol>;

export function protocolHash(): string {
  return sha256(canonicalJson(protocol()));
}
