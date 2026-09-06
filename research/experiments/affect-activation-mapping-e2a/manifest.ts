/**
 * ACTIVATION_MAPPING_ABLATION_E2A — frozen manifest (§47).
 * Materialized and hashed BEFORE any official evidence trajectory exists.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  BASELINE_COMMIT, EXPERIMENT_ID, E1_PATH, E2_PATH,
  GATES, METRIC_PROTOCOL, RESTORE_TICK_D6, RUN_ACCOUNTING, SEED_SUBSET,
  SELECTION_LOGIC, SINGLE_FACTOR_LAW, VARIANTS, DISCIPLINE_LAW,
  ZERO_MODEL_LAW, PRODUCTION_ISOLATION_LAW, FAMILY_IDS, FAMILY_PURPOSE
} from "./contract.ts";
import { canonicalJson, sha256 } from "./fixtures.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** §44: exact source fingerprints of every frozen dependency. */
export function dependencyFingerprints() {
  const files = (paths: readonly string[]): string =>
    sha256(JSON.stringify(paths.map((p) => [p, sha256(readFileSync(join(ROOT, p)))])));
  return {
    e1_law: files([`${E1_PATH}/contract.ts`, `${E1_PATH}/mechanisms.ts`, `${E1_PATH}/fixtures.ts`]),
    e2_generator: files([`${E2_PATH}/generator.ts`, `${E2_PATH}/contract.ts`]),
    e2_metrics: files([`${E2_PATH}/metrics.ts`]),
    e2_evidence_tree: sha256(execFileSync("git", ["ls-tree", "-r", "HEAD", "--", `${E2_PATH}/evidence/`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: ROOT })),
    e1_evidence_tree: sha256(execFileSync("git", ["ls-tree", "-r", "HEAD", "--", `${E1_PATH}/evidence/`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: ROOT }))
  };
}

/** Frozen E2 official run-r2 bindings (from the committed E2 evidence). */
export const E2_FROZEN_BINDINGS = Object.freeze({
  e2_experiment_id: "PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2",
  e2_verdict: "SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK",
  e2_sub_risk: "ACTIVATION_MAPPING_RISK",
  e2_protocol_hash: "686b26f74992537bf2b676cd0ba867e517d141792a8e27d3de8501acb1227dc5",
  e2_corpus_root: "4999910c98fcebc88e00c59b08f0a8f5d088554a9aa1f950ad5afe75dd0445fd",
  e2_run_identity: "run-r2"
});

export function protocol() {
  return {
    experiment_id: EXPERIMENT_ID,
    schema_version: "activation-mapping-ablation-manifest-e2a",
    predecessor: {
      e1: { experiment: "STATE_RETENTION_AND_RECOVERY_E1", verdict: "SUPPORTED_FOR_NEXT_STAGE", frozen: true },
      e2: { experiment: E2_FROZEN_BINDINGS.e2_experiment_id, verdict: E2_FROZEN_BINDINGS.e2_verdict, sub_risk: E2_FROZEN_BINDINGS.e2_sub_risk, frozen: true },
      finding_isolated: "E2's only identified risk was ACTIVATION_MAPPING_RISK (D6 strong_debt Q95 = 0.320 > .05); valence cancellation itself passed."
    },
    git_baseline: BASELINE_COMMIT,
    research_question: "What minimum activation gain preserves a measurable event-driven activation response while eliminating the E2 activation debt pathology under D2/D6? Secondary: if only u_a = 0 passes the debt gates, is positive-only activation injection structurally problematic rather than merely over-gained?",
    single_factor: SINGLE_FACTOR_LAW,
    variants: VARIANTS,
    corpus_reuse: {
      source: "E2 frozen generator and sequence definitions, imported (never regenerated with new semantics)",
      e2_protocol_hash: E2_FROZEN_BINDINGS.e2_protocol_hash,
      e2_corpus_root: E2_FROZEN_BINDINGS.e2_corpus_root,
      families: FAMILY_IDS,
      family_purposes: FAMILY_PURPOSE,
      seed_subset: SEED_SUBSET,
      sequence_hash_binding: "per-lifetime sha256 over canonical {family, seed, T, quiet, events}; asserted identical across variants"
    },
    restore_probe: { family: "D6", seed: "E2-S00", tick: RESTORE_TICK_D6, law: "deterministic midpoint before the final quiet recovery window; frozen before the run" },
    metrics: METRIC_PROTOCOL,
    gates: GATES,
    selection_logic: SELECTION_LOGIC,
    run_accounting: RUN_ACCOUNTING,
    discipline_law: DISCIPLINE_LAW,
    zero_model_law: ZERO_MODEL_LAW,
    production_isolation_law: PRODUCTION_ISOLATION_LAW
  };
}

export type ProtocolE2A = ReturnType<typeof protocol>;

export function protocolHash(): string {
  return sha256(canonicalJson(protocol()));
}
