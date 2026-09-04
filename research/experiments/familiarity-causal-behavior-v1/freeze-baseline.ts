/**
 * Centralized V1 execution freeze verification — the ONE authoritative policy
 * function deciding whether the CURRENT harness source fingerprint is authorized
 * to execute the frozen V1 scientific protocol.
 *
 * TWO-PHASE LAW:
 *
 *   Phase 1 — HISTORICAL READINESS CONSISTENCY:
 *     All readiness-time fingerprints (manifest, gates, amendment original)
 *     must internally agree. This proves "what was originally preregistered?"
 *     without consulting the current source.
 *
 *   Phase 2 — CURRENT EXECUTION AUTHORIZATION:
 *     The current source fingerprint must match EITHER the original readiness
 *     fingerprint (historical path, no amendment) OR the amendment's ONE
 *     authorized execution fingerprint (amendment path). Built fingerprint and
 *     protocol hash must match readiness in BOTH paths.
 *
 * This is the ONLY V1 harness policy function that decides whether the current
 * source fingerprint is execution-authorized. No second independent
 * current-source-vs-readiness comparison is permitted anywhere in the V1
 * harness.
 */

import { check } from "./fixtures.ts";
import type { ExecutionAmendmentV0 } from "./amendment.ts";

export interface FreezeBaselineInputs {
  readonly readiness_source_fingerprint: string;
  readonly readiness_built_fingerprint: string;
  readonly readiness_protocol_hash: string;
  readonly current_source_fingerprint: string;
  readonly current_built_fingerprint: string;
  readonly current_protocol_hash: string;
  readonly amendment?: ExecutionAmendmentV0;
}

/** Phase 1: readiness-time fingerprints internally agree across manifest/gates/amendment. */
export function verifyReadinessConsistencyV1(inputs: {
  readonly manifest_source_fingerprint: string;
  readonly manifest_built_fingerprint: string;
  readonly manifest_protocol_hash: string;
  readonly gates_source_fingerprint: string;
  readonly gates_built_fingerprint: string;
  readonly amendment?: ExecutionAmendmentV0;
}): void {
  check(
    inputs.manifest_source_fingerprint === inputs.gates_source_fingerprint,
    "readiness consistency: manifest source fingerprint must equal gates source fingerprint"
  );
  check(
    inputs.manifest_built_fingerprint === inputs.gates_built_fingerprint,
    "readiness consistency: manifest built fingerprint must equal gates built fingerprint"
  );
  if (inputs.amendment) {
    check(
      inputs.amendment.original_readiness_source_fingerprint === inputs.manifest_source_fingerprint,
      "readiness consistency: amendment original_readiness_source_fingerprint must match manifest"
    );
  }
}

/** Phase 2: current source is authorized via historical or amendment path. Built/protocol unchanged. */
export function verifyExecutionFreezeBaselineV1(inputs: FreezeBaselineInputs): void {
  check(
    inputs.current_built_fingerprint === inputs.readiness_built_fingerprint,
    "execution freeze: built fingerprint must exactly match readiness-time value"
  );
  check(
    inputs.current_protocol_hash === inputs.readiness_protocol_hash,
    "execution freeze: protocol hash must exactly match readiness-time value"
  );
  if (inputs.amendment) {
    check(
      inputs.current_source_fingerprint === inputs.amendment.authorized_execution_source_fingerprint,
      "execution freeze (amended): current source fingerprint must EXACTLY equal the amendment's authorized value"
    );
  } else {
    check(
      inputs.current_source_fingerprint === inputs.readiness_source_fingerprint,
      "execution freeze (historical): current source fingerprint must EXACTLY equal the readiness-time value"
    );
  }
}

/** Combined entry point: Phase 1 + Phase 2. */
export function verifyFreezeBaselineV1(inputs: FreezeBaselineInputs & {
  readonly gates_source_fingerprint: string;
  readonly gates_built_fingerprint: string;
}): void {
  verifyReadinessConsistencyV1({
    manifest_source_fingerprint: inputs.readiness_source_fingerprint,
    manifest_built_fingerprint: inputs.readiness_built_fingerprint,
    manifest_protocol_hash: inputs.readiness_protocol_hash,
    gates_source_fingerprint: inputs.gates_source_fingerprint,
    gates_built_fingerprint: inputs.gates_built_fingerprint,
    amendment: inputs.amendment
  });
  verifyExecutionFreezeBaselineV1(inputs);
}
