import {
  FROZEN_REPRESENTATIVE_REQUEST_V0,
  PROVIDER_LOCK_ENVIRONMENT_V0,
  frozenRepresentativeFixtureV0,
  representativeFixtureMatchesFrozenV0
} from "../ollama-environment-resource-v0/protocol.ts";

export const NATURAL_LOW_RESOURCE_PROTOCOL_V0 = Object.freeze({
  schema_version: "ollama-natural-low-resource-diagnostic-v0",
  diagnostic_id: "OLLAMA_NATURAL_LOW_RESOURCE_REPRODUCTION_V0",
  maximum_cognition_calls: 4,
  natural_window_lost_threshold_bytes: 1024 * 1024 * 1024,
  authority_boundary:
    "diagnostic observation only; never canonical state, behavior evidence, or scientific evidence",
  artificial_pressure_allowed: false
});

export const NATURAL_CALL_IDS_V0 = Object.freeze(["1", "2", "3", "4"] as const);

export const R3_REFERENCE_V0 = Object.freeze({
  available_ram_approx_mib: 449,
  request_bytes: [4234, 4280] as const,
  prompt_tokens: [980, 997] as const,
  initial_timeouts: 9,
  timeout_ms: 120000,
  signatures: [
    "GPU discovery watchdog timed out",
    "unable to refresh free memory",
    "very slow prompt processing",
    "approximately 58 second prompt-cache update"
  ] as const
});

export const HEALTHY_REPRESENTATIVE_V1_REFERENCE = Object.freeze({
  available_ram_approx_gib: 3.5,
  cold_elapsed_ms: 21224,
  warm_elapsed_ms: [6792, 7261, 7318] as const,
  warnings: 0
});

export {
  FROZEN_REPRESENTATIVE_REQUEST_V0,
  PROVIDER_LOCK_ENVIRONMENT_V0 as PROVIDER_LOCK_NATURAL_V0,
  frozenRepresentativeFixtureV0,
  representativeFixtureMatchesFrozenV0
};
