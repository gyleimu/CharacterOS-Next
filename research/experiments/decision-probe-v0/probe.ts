/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV0 driver — one probe call, one scored record. RESEARCH-ONLY.
 *
 * The driver does exactly four things and nothing else:
 *   1. substitute the output contract into an ALREADY-PRODUCTION-BUILT request;
 *   2. call the injected transport ONCE (no retry, no repair, no fallback);
 *   3. validate the answer against the frozen closed set (fail closed);
 *   4. emit a hash-carrying record.
 *
 * It renders no subject data, owns no subject semantics, performs no canonical write,
 * and reads nothing from a subject. `DECISION_PROBE_ANNOTATION` in the record exists so
 * an auditor can confirm, without trusting prose, that the record was produced by this
 * instrument and not by a subject-semantics path.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import type {
  ModelTransportRequestV0,
  ModelTransportV0
} from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  buildDecisionProbeRequestV0,
  validateDecisionProbeOutputV0,
  type DecisionProbeDecisionV0,
  type DecisionProbeFidelityV0,
  type DecisionProbeModeV0,
  type DecisionProbeRejectionCodeV0
} from "./contract.ts";

export const DECISION_PROBE_ANNOTATION = "research-only-decision-probe-v0" as const;

export const DECISION_PROBE_RECORD_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe/record/v0" as const;

/** Closed outcome kinds. `TRANSPORT_FAILED` is never a decision. */
export const DECISION_PROBE_OUTCOMES = Object.freeze([
  "DECIDED",
  "REJECTED",
  "TRANSPORT_FAILED"
] as const);
export type DecisionProbeOutcomeV0 = (typeof DECISION_PROBE_OUTCOMES)[number];

export interface DecisionProbeRunInputV0 {
  readonly transport: ModelTransportV0;
  /** The request as the PRODUCTION path built and rendered it. Never re-rendered here. */
  readonly production_request: ModelTransportRequestV0;
  readonly mode: DecisionProbeModeV0;
  /** Opaque to the instrument; carried through for the caller's own bookkeeping. */
  readonly fixture_id: string;
  readonly replicate_ordinal: number;
}

export interface DecisionProbeRunRecordV0 {
  readonly annotation: typeof DECISION_PROBE_ANNOTATION;
  readonly fixture_id: string;
  readonly replicate_ordinal: number;
  readonly mode: DecisionProbeModeV0;
  readonly outcome: DecisionProbeOutcomeV0;
  readonly decision: DecisionProbeDecisionV0 | null;
  readonly rejection_code: DecisionProbeRejectionCodeV0 | null;
  readonly rejection_detail: string | null;
  readonly transport_failure: string | null;
  readonly response_model: string | null;
  readonly elapsed_ms: number | null;
  /** The RAW executor output, retained verbatim for the evidence bundle (D0 §6/§11).
   * It is never parsed twice, never repaired, and never influences scoring. */
  readonly raw_content: string | null;
  readonly fidelity: DecisionProbeFidelityV0;
  readonly record_hash: HashV1;
}

/**
 * Runs ONE probe. Never throws for a bad model answer (that is a REJECTED record) and
 * never throws for a transport failure (that is a TRANSPORT_FAILED record). It throws
 * only if the caller's own request could not be handled lawfully (fidelity violation),
 * because a low-fidelity run is not a measurement at all.
 */
export async function runDecisionProbeV0(
  input: DecisionProbeRunInputV0
): Promise<DecisionProbeRunRecordV0> {
  const built = await buildDecisionProbeRequestV0(input.production_request, input.mode);
  if (!built.fidelity.chain_of_custody_ok) {
    throw new Error(
      `DECISION_PROBE_FIDELITY_VIOLATION: ${JSON.stringify(built.fidelity)}`
    );
  }

  const startedAt = Date.now();
  let content: string | null = null;
  let responseModel: string | null = null;
  let transportFailure: string | null = null;
  try {
    const response = await input.transport.complete(built.request);
    content = response.content;
    responseModel = response.model;
  } catch (error) {
    transportFailure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  const elapsedMs = Date.now() - startedAt;

  let outcome: DecisionProbeOutcomeV0;
  let decision: DecisionProbeDecisionV0 | null = null;
  let rejectionCode: DecisionProbeRejectionCodeV0 | null = null;
  let rejectionDetail: string | null = null;

  if (transportFailure !== null) {
    outcome = "TRANSPORT_FAILED";
  } else {
    const validation = validateDecisionProbeOutputV0(content ?? "");
    if (validation.ok) {
      outcome = "DECIDED";
      decision = validation.output.decision;
    } else {
      outcome = "REJECTED";
      rejectionCode = validation.code;
      rejectionDetail = validation.detail;
    }
  }

  const body = Object.freeze({
    annotation: DECISION_PROBE_ANNOTATION,
    fixture_id: input.fixture_id,
    replicate_ordinal: input.replicate_ordinal,
    mode: input.mode,
    outcome,
    decision,
    rejection_code: rejectionCode,
    transport_failure: transportFailure,
    fidelity: built.fidelity
  });

  return Object.freeze({
    ...body,
    rejection_detail: rejectionDetail,
    response_model: responseModel,
    elapsed_ms: elapsedMs,
    raw_content: content,
    record_hash: await hashEnvelope(DECISION_PROBE_RECORD_HASH_PROJECTION_V0, body as unknown)
  });
}
