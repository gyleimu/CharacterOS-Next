/* eslint-disable no-restricted-imports -- Research harness: reuses the frozen experiment's request builder and contract by relative path (read-only). */
/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — frozen request binding.
 *
 * The ONLY thing this diagnostic changes relative to the failed calibration is
 * OBSERVATION DEPTH. The model-facing request must stay byte-identical, so this
 * module does not re-implement the request: it calls the frozen calibration
 * request builder (read-only import, nothing in that module is modified) and
 * REFUSES to proceed unless the resulting canonical bytes hash to the approved
 * frozen value. If the request cannot be reproduced exactly, the diagnostic stops
 * before any call rather than silently changing the treatment.
 */
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

import {
  buildCalibrationProjection,
  buildCalibrationRequest,
  buildCalibrationSubject,
  serializeAuthoritativeRequest,
  type CalibrationRequestBody,
  type CalibrationSubject
} from "../belief-causal-confirmatory-stochastic-v1/calibration-request.ts";
import { modelConfigManifest } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";

import {
  FROZEN_MODEL_FACING_REQUEST_BYTES,
  FROZEN_MODEL_FACING_REQUEST_HASH
} from "./contract.ts";
import { hashJson, hashText } from "./hash.ts";

export interface DiagnosticRequestBinding {
  readonly serialized_body: string;
  readonly request_hash: string;
  readonly body: CalibrationRequestBody;
  readonly body_bytes: number;
  readonly subject: CalibrationSubject;
  readonly projection: unknown;
  readonly reconstructed_hashes: {
    readonly system_hash: string;
    readonly user_hash: string;
    readonly schema_hash: string;
    readonly model_config_hash: string;
    readonly model_facing_request_hash: string;
  };
  readonly byte_identical_to_calibration: boolean;
  readonly expected_hash: string;
  readonly expected_bytes: number;
}

export class DiagnosticRequestMismatchError extends Error {
  readonly code = "DIAGNOSTIC_REQUEST_HASH_MISMATCH";
}

/**
 * Rebuilds the frozen request through the production rendering path over the same
 * EMPTY-genesis calibration subject, and reports the reconstructed hashes so the
 * caller can prove byte identity before spending a call.
 */
export async function buildDiagnosticRequest(): Promise<DiagnosticRequestBinding> {
  const subject = await buildCalibrationSubject();
  const projection = await buildCalibrationProjection(subject);
  const request = await buildCalibrationRequest({
    schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
    modelConfigHash: hashJson(modelConfigManifest()),
    subject
  });
  const serialized = serializeAuthoritativeRequest(request.body);
  const requestHash = hashText(serialized);
  return {
    serialized_body: serialized,
    request_hash: requestHash,
    body: request.body,
    body_bytes: Buffer.byteLength(serialized, "utf8"),
    subject,
    projection,
    reconstructed_hashes: { ...request.hashes, model_facing_request_hash: requestHash },
    byte_identical_to_calibration: requestHash === FROZEN_MODEL_FACING_REQUEST_HASH,
    expected_hash: FROZEN_MODEL_FACING_REQUEST_HASH,
    expected_bytes: FROZEN_MODEL_FACING_REQUEST_BYTES
  };
}

/** Fail-closed assertion: the diagnostic refuses to call on any request drift. */
export function assertFrozenRequest(binding: DiagnosticRequestBinding): void {
  if (binding.request_hash !== FROZEN_MODEL_FACING_REQUEST_HASH) {
    throw new DiagnosticRequestMismatchError(
      `diagnostic request hash ${binding.request_hash} != frozen ${FROZEN_MODEL_FACING_REQUEST_HASH}: the diagnostic must not change the treatment`
    );
  }
  if (binding.body_bytes !== FROZEN_MODEL_FACING_REQUEST_BYTES) {
    throw new DiagnosticRequestMismatchError(
      `diagnostic request is ${binding.body_bytes} bytes, frozen is ${FROZEN_MODEL_FACING_REQUEST_BYTES}`
    );
  }
}
