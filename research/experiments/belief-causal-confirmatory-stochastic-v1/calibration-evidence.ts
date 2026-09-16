/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — frozen calibration evidence schema.
 *
 * The evidence record is fixed NOW, before any call. It contains no credential,
 * no Authorization header, no request-body secret and no wall-clock value that
 * could leak host identity into a model-facing artifact.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import { CALIBRATION_LAW_ID } from "./calibration-law.ts";
import type { CalibrationRunResult } from "./calibration-runner.ts";

export const CALIBRATION_EVIDENCE_SCHEMA_VERSION = "bcv1-calibration-evidence-v0" as const;

export interface CalibrationEvidence {
  readonly schema_version: typeof CALIBRATION_EVIDENCE_SCHEMA_VERSION;
  readonly law_id: string;
  readonly experiment_id: string;
  readonly phase: "CALIBRATION";
  readonly preregistration_commit: string;
  readonly manifest_hash: string;
  readonly calibration_descriptor_hash: string;
  readonly code_state_attestation: {
    readonly head_before: string;
    readonly head_after: string;
    readonly tracked_tree_clean_before: boolean;
    readonly tracked_tree_clean_after: boolean;
  };
  readonly model: {
    readonly id: string;
    readonly config_hash: string;
  };
  readonly request: {
    readonly system_hash: string;
    readonly user_hash: string;
    readonly schema_hash: string;
    readonly model_config_hash: string;
    readonly model_facing_request_hash: string;
    readonly body_bytes: number;
  };
  readonly trials: CalibrationRunResult["trials"];
  readonly aggregates: CalibrationRunResult["aggregates"];
  readonly early_stopped: boolean;
  readonly integrity: CalibrationRunResult["integrity"];
  readonly decision: CalibrationRunResult["decision"];
  readonly usage_totals: CalibrationRunResult["aggregates"]["usage"];
  readonly api_cost: "NOT_REPORTED_BY_PROVIDER";
  readonly limitations: readonly string[];
  readonly evidence_hash?: string;
}

export interface CalibrationEvidenceInput {
  readonly preregistrationCommit: string;
  readonly manifestHash: string;
  readonly calibrationDescriptorHash: string;
  readonly headBefore: string;
  readonly headAfter: string;
  readonly trackedTreeCleanBefore: boolean;
  readonly trackedTreeCleanAfter: boolean;
  readonly modelId: string;
  readonly modelConfigHash: string;
  readonly run: CalibrationRunResult;
}

export function buildCalibrationEvidence(input: CalibrationEvidenceInput): CalibrationEvidence {
  const bodyBytes = Buffer.byteLength(JSON.stringify(input.run.request.body), "utf8");
  return {
    schema_version: CALIBRATION_EVIDENCE_SCHEMA_VERSION,
    law_id: CALIBRATION_LAW_ID,
    experiment_id: input.run.experiment_id,
    phase: "CALIBRATION",
    preregistration_commit: input.preregistrationCommit,
    manifest_hash: input.manifestHash,
    calibration_descriptor_hash: input.calibrationDescriptorHash,
    code_state_attestation: {
      head_before: input.headBefore,
      head_after: input.headAfter,
      tracked_tree_clean_before: input.trackedTreeCleanBefore,
      tracked_tree_clean_after: input.trackedTreeCleanAfter
    },
    model: { id: input.modelId, config_hash: input.modelConfigHash },
    request: {
      system_hash: input.run.request.hashes.system_hash,
      user_hash: input.run.request.hashes.user_hash,
      schema_hash: input.run.request.hashes.schema_hash,
      model_config_hash: input.run.request.hashes.model_config_hash,
      model_facing_request_hash: input.run.request.hashes.model_facing_request_hash,
      body_bytes: bodyBytes
    },
    trials: input.run.trials,
    aggregates: input.run.aggregates,
    early_stopped: input.run.early_stopped,
    integrity: input.run.integrity,
    decision: input.run.decision,
    usage_totals: input.run.aggregates.usage,
    api_cost: "NOT_REPORTED_BY_PROVIDER",
    limitations: [
      "The frozen calibration subject starts from a normal EMPTY genesis, while the confirmatory cells carry a non-EMPTY Belief projection: a successful calibration therefore does NOT prove that projection-bearing scenes are equally schema-stable.",
      "Calibration contributes 0 to every confirmatory count and never enters a confirmatory denominator.",
      "Stochasticity and truth-conflation flags are diagnostics only and cannot change the RUN/STOP law."
    ]
  };
}

/**
 * Writes the evidence to an UNTRACKED scratch location. It is deliberately not a
 * tracked write: the formal run must keep HEAD at the preregistration commit
 * until an independent review approves a result commit.
 */
export function writeCalibrationEvidence(path: string, evidence: CalibrationEvidence): string {
  const core: Omit<CalibrationEvidence, "evidence_hash"> = { ...evidence };
  const hash = `sha256:${hashOf(JSON.stringify(core))}`;
  writeFileSync(path, `${JSON.stringify({ ...core, evidence_hash: hash }, null, 2)}\n`);
  return hash;
}

function hashOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
