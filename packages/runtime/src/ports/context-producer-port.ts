/**
 * P2.3.3.1 — ContextProducerPort (contract + pure projection assembly).
 *
 * Responsibility (frozen): ObservationInputV0 → ControlledProjectionViewV0. The port
 * ONLY assembles the controlled projection — it performs no retrieval, no appraisal,
 * no affect calculation, no memory write, no NLU. Retrieval evidence and the scene
 * label are supplied by the caller (later executor stages); this contract computes the
 * deterministic projection hash over exactly the projected body.
 */

import type { HashV1 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { MemoryRetrievalResultV0 } from "@characteros-next/memory";
import type { ControlledProjectionViewV0 } from "./interpretation-port.js";
import type { ObservationInputV0 } from "../transitions/observation/types.js";

export const CONTROLLED_PROJECTION_SCHEMA_VERSION = "controlled-projection-view-v0" as const;
export const CONTROLLED_PROJECTION_HASH_PROJECTION =
  "characteros-next/runtime/controlled-projection/v1" as const;

export interface ControlledProjectionAssembly {
  /** Resolved scene label, or null until the executor fills it from the snapshot. */
  readonly context_scene: string | null;
  /** Retrieval evidence, or null when the retrieval stage has not run. */
  readonly retrieval_result: MemoryRetrievalResultV0 | null;
}

export interface ContextProducerPort {
  /**
   * Assembles the controlled projection for one observation input.
   * Deterministic: same (input, assembly) ⇒ byte-identical view and hash.
   */
  produceControlledProjection(
    input: ObservationInputV0,
    assembly: ControlledProjectionAssembly
  ): Promise<ControlledProjectionViewV0>;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Pure deterministic assembly helper (port contract reference): computes the unique
 * sorted union of fact refs and the domain-separated projection hash, then deep-freezes
 * the view. Never mutates the input.
 */
export async function buildControlledProjectionView(
  input: ObservationInputV0,
  assembly: ControlledProjectionAssembly
): Promise<ControlledProjectionViewV0> {
  const observationRefs = [...input.source_refs, ...input.entity_refs].sort(compareStrings);
  const uniqueRefs = observationRefs.filter(
    (ref, index) => index === 0 || observationRefs[index - 1] !== ref
  );
  const body = {
    projection_schema_version: CONTROLLED_PROJECTION_SCHEMA_VERSION,
    observation_id: input.observation_id,
    observation_refs: uniqueRefs,
    context_scene: assembly.context_scene,
    retrieval_result: assembly.retrieval_result
  };
  const projection_hash = (await hashEnvelope(
    CONTROLLED_PROJECTION_HASH_PROJECTION,
    body
  )) as HashV1;
  const view: ControlledProjectionViewV0 = {
    projection_hash,
    observation_id: input.observation_id,
    observation_refs: uniqueRefs,
    context_scene: assembly.context_scene,
    retrieval_result: assembly.retrieval_result
  };
  deepFreeze(view);
  return view;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
