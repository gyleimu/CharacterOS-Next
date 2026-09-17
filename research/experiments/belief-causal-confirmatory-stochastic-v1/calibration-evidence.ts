/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — frozen calibration evidence schema.
 *
 * The evidence record is fixed NOW, before any call. It contains no credential,
 * no Authorization header, no request-body secret and no wall-clock value that
 * could leak host identity into a model-facing artifact.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { CALIBRATION_LAW_ID } from "./calibration-law.ts";
import type { CalibrationRunResult } from "./calibration-runner.ts";

export const CALIBRATION_EVIDENCE_SCHEMA_VERSION = "bcv1-calibration-evidence-v1" as const;

export interface CalibrationEvidence {
  readonly schema_version: typeof CALIBRATION_EVIDENCE_SCHEMA_VERSION;
  readonly law_id: string;
  readonly experiment_id: string;
  readonly phase: "CALIBRATION";
  readonly preregistration_commit: string;
  readonly approved_prereg_sha: string;
  readonly manifest_hash: string;
  readonly manifest_path: string;
  readonly calibration_descriptor_hash: string;
  readonly code_state_attestation: {
    readonly head_before: string;
    readonly head_after: string;
    readonly approved_prereg_sha: string;
    readonly manifest_prereg_sha: string;
    readonly three_way_equal: boolean;
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
    readonly runtime_request_hash: string;
    readonly body_bytes: number;
  };
  readonly trials: CalibrationRunResult["trials"];
  readonly aggregates: CalibrationRunResult["aggregates"];
  readonly early_stopped: boolean;
  readonly pre_call_verifications: number;
  readonly stopped_before_trial: number | null;
  readonly stop_reason: string | null;
  readonly integrity: CalibrationRunResult["integrity"];
  readonly decision: CalibrationRunResult["decision"];
  readonly usage_totals: CalibrationRunResult["aggregates"]["usage"];
  readonly api_cost: "NOT_REPORTED_BY_PROVIDER";
  /** The credential is env-only; nothing about it is ever recorded here. */
  readonly api_key_source: "MODEL_API_KEY_ENVIRONMENT";
  readonly primary_authorized: false;
  readonly limitations: readonly string[];
  readonly evidence_hash?: string;
}

export interface CalibrationEvidenceInput {
  readonly preregistrationCommit: string;
  readonly approvedPreregSha: string;
  readonly manifestHash: string;
  readonly manifestPath: string;
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
  const bodyBytes = Buffer.byteLength(input.run.request.serialized_body, "utf8");
  return {
    schema_version: CALIBRATION_EVIDENCE_SCHEMA_VERSION,
    law_id: CALIBRATION_LAW_ID,
    experiment_id: input.run.experiment_id,
    phase: "CALIBRATION",
    preregistration_commit: input.preregistrationCommit,
    approved_prereg_sha: input.approvedPreregSha,
    manifest_hash: input.manifestHash,
    manifest_path: input.manifestPath,
    calibration_descriptor_hash: input.calibrationDescriptorHash,
    code_state_attestation: {
      head_before: input.headBefore,
      head_after: input.headAfter,
      approved_prereg_sha: input.approvedPreregSha,
      manifest_prereg_sha: input.run.integrity.manifest_prereg_sha,
      three_way_equal:
        input.headBefore === input.run.integrity.manifest_prereg_sha &&
        input.run.integrity.manifest_prereg_sha === input.approvedPreregSha,
      tracked_tree_clean_before: input.trackedTreeCleanBefore,
      tracked_tree_clean_after: input.trackedTreeCleanAfter
    },
    model: { id: input.modelId, config_hash: input.modelConfigHash },
    request: {
      system_hash: input.run.request.system_hash,
      user_hash: input.run.request.user_hash,
      schema_hash: input.run.request.schema_hash,
      model_config_hash: input.run.request.model_config_hash,
      model_facing_request_hash: input.run.request.model_facing_request_hash,
      runtime_request_hash: input.run.integrity.runtime_request_hash,
      body_bytes: bodyBytes
    },
    trials: input.run.trials,
    aggregates: input.run.aggregates,
    early_stopped: input.run.early_stopped,
    pre_call_verifications: input.run.pre_call_verifications,
    stopped_before_trial: input.run.stopped_before_trial,
    stop_reason: input.run.stop_reason,
    integrity: input.run.integrity,
    decision: input.run.decision,
    usage_totals: input.run.aggregates.usage,
    api_cost: "NOT_REPORTED_BY_PROVIDER",
    api_key_source: "MODEL_API_KEY_ENVIRONMENT",
    primary_authorized: false,
    limitations: [
      "The frozen calibration subject starts from a normal EMPTY genesis, while the confirmatory cells carry a non-EMPTY Belief projection: a successful calibration therefore does NOT prove that projection-bearing scenes are equally schema-stable.",
      "Calibration contributes 0 to every confirmatory count and never enters a confirmatory denominator.",
      "Stochasticity and truth-conflation flags are diagnostics only and cannot change the RUN/STOP law.",
      "A successful calibration (EXECUTOR_CALIBRATION_RUN) authorizes NOTHING further: PRIMARY_AUTHORIZED is false and the primary/replication phases require a separate independent audit."
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
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...core, evidence_hash: hash }, null, 2)}\n`);
  return hash;
}

function hashOf(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
