/* eslint-disable no-restricted-imports -- Diagnostic-only reuse of the frozen representative fixture. */

import {
  PROVIDER_LOCK_V1,
  captureRepresentativeRequestV1,
  measureRepresentativeRequestV1,
  representativeProjectionV1,
  type RepresentativeRequestShapeV1
} from "../ollama-cognition-representative-load-v1/fixture.ts";
import type {
  CognitiveContextProjectionV0,
  ModelTransportRequestV0
} from "../../../packages/runtime/dist/index.js";

export const ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0 = Object.freeze({
  schema_version: "ollama-environment-resource-diagnostic-v0",
  diagnostic_id: "OLLAMA_ENVIRONMENT_RESOURCE_DIAGNOSTIC_V0",
  maximum_model_calls: 6,
  calls_per_level: 2,
  safety_floor_mib: 768,
  pressure_chunk_mib: 16,
  pressure_helper_max_lifetime_ms: 600_000,
  authority_boundary:
    "diagnostic observation only; never canonical state, behavior evidence, or scientific evidence"
});

export const PRESSURE_LEVELS_V0 = Object.freeze([
  Object.freeze({ level: 0, id: "LEVEL_0", requested_mib: 0, call_ids: ["0A", "0B"] as const }),
  Object.freeze({ level: 1, id: "LEVEL_1", requested_mib: 512, call_ids: ["1A", "1B"] as const }),
  Object.freeze({ level: 2, id: "LEVEL_2", requested_mib: 1024, call_ids: ["2A", "2B"] as const })
]);

export const FROZEN_REPRESENTATIVE_REQUEST_V0 = Object.freeze({
  request_hash: "sha256:4f86bb8094756a96bc8639d33e8b635a4bfb16223629a9a1c8ece05e6e31648d",
  post_bytes: 4522,
  server_prompt_tokens: 1068
});

export const PROVIDER_LOCK_ENVIRONMENT_V0 = PROVIDER_LOCK_V1;

export async function frozenRepresentativeFixtureV0(): Promise<{
  readonly projection: CognitiveContextProjectionV0;
  readonly request: ModelTransportRequestV0;
  readonly shape: RepresentativeRequestShapeV1;
}> {
  const projection = await representativeProjectionV1();
  const request = await captureRepresentativeRequestV1(projection);
  const shape = measureRepresentativeRequestV1(projection, request);
  return Object.freeze({ projection, request, shape });
}

export function representativeFixtureMatchesFrozenV0(shape: RepresentativeRequestShapeV1): boolean {
  return shape.request_hash === FROZEN_REPRESENTATIVE_REQUEST_V0.request_hash &&
    shape.post_bytes === FROZEN_REPRESENTATIVE_REQUEST_V0.post_bytes;
}
