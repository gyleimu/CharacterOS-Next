/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C1 — THE FROZEN RECORD RENDERER.
 *
 * Produces the CharacterOS belief record EXACTLY as production does: the three fields in production
 * order, serialised by `JSON.stringify`, with the `proposition_id` obtained from the PRODUCTION
 * proposition-key derivation (never hand-written, never derived from the credence).
 *
 * It adds nothing: no derived stance, no SUPPORT/OPPOSE word, no semantic alias, no relation metadata,
 * no explanatory prose, no debugging metadata and no production framing.
 *
 * The cells are built by replacing ONLY the value after the frozen cue prefix, then applying the frozen
 * D4-C0a transformer — so the surrounding bytes are the ones C0a froze.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D4_C1_BELIEF_KEY_PROJECTION } from "./contract.ts";
import {
  buildD4C0ABaseRequestV0,
  buildD4C0AStanceTransferRequestV0
} from "../belief-cross-expression-d4/transformer-d4c0a.ts";

export const D4_C1_STANCE_CUE = "SUBJECT STANCE TOWARD A: " as const;

/** The production proposition-key derivation, reproduced field for field. */
export async function deriveC1PropositionIdV0(canonicalLabel: string): Promise<string> {
  const digest = String(await hashEnvelope(D4_C1_BELIEF_KEY_PROJECTION, { canonical_label: canonicalLabel }));
  return `belief-prop-v0-${digest.replace(/^sha256:/, "")}`;
}

/**
 * The exact production record bytes: `{"proposition_id":…,"proposition_label":…,"credence":…}` in that
 * order, with the credence rendered by JavaScript's default number formatting, which is what production's
 * `JSON.stringify` produces.
 */
export function renderC1BeliefRecordV0(propositionId: string, propositionLabel: string, credence: number): string {
  return JSON.stringify({ proposition_id: propositionId, proposition_label: propositionLabel, credence });
}

export interface D4C1BindingV0 {
  readonly proposition_a: string;
  readonly proposition_b: string;
  readonly relation: string;
}

/** Builds a cell by replacing only the stance value, then applying the frozen D4-C0a transformer. */
export function buildC1CellRequestV0(binding: D4C1BindingV0, stanceValue: string): ModelTransportRequestV0 {
  const base = buildD4C0ABaseRequestV0(binding as never);
  const user = base.messages[1]?.content ?? "";
  const lines = user.split("\n");
  const index = lines.findIndex((line) => line.startsWith(D4_C1_STANCE_CUE));
  if (index < 0) throw new Error("D4_C1_CUE_PREFIX_MISSING: the frozen binding block has no stance line");
  const replaced = [...lines];
  replaced[index] = `${D4_C1_STANCE_CUE}${stanceValue}`;
  const mutated = Object.freeze({
    messages: Object.freeze([base.messages[0], Object.freeze({ role: "user" as const, content: replaced.join("\n") })]),
    structured_output: base.structured_output
  }) as unknown as ModelTransportRequestV0;
  return buildD4C0AStanceTransferRequestV0(mutated);
}
