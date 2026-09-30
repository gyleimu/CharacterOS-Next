/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3-B QUALIFICATION BASE — a production V8 request with the belief block stripped.
 *
 * D3-B's qualification fixtures must not carry the canonical CAUTION proposition or the target
 * paraphrase (contract §7), but the production user content DOES carry the CAUTION belief line. So the
 * qualification base is built in two mechanical steps: compose the production request from a real
 * committed world through the frozen production path, then strip the belief block with the D1-frozen
 * `stripBeliefBlockV0`.
 *
 * This is an implementation-level binding, not a scientific rule: it removes a distractor that the
 * frozen design says must not be present. The audit in the runner proves the CAUTION label is present
 * before and absent after.
 */

import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

import { D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";
import { stripBeliefBlockV0 as d1StripBeliefBlockV0 } from "../belief-state-sensitivity-d1/state-construction.ts";
import { buildArmWorldV0 } from "../belief-state-sensitivity-d1/world-a1.ts";
import { buildProjectionV0 } from "../belief-state-sensitivity-d1/state-construction.ts";

/** The canonical CAUTION label, re-exported so callers do not reach into D1 directly. */
export const D1_CANONICAL_LABEL = D1_PROPOSITION_LABEL;

/** The A1 token vocabulary, used only as a leak check on qualification fixtures. */
export const A1_TOKEN_VOCABULARY_FOR_LEAK_CHECK: readonly string[] = Object.freeze([
  "SUPPORTS_PARAPHRASED_PRINCIPLE",
  "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE",
  "OPPOSES_PARAPHRASED_PRINCIPLE"
]);

/** The D1-frozen belief-block stripper, re-exported unchanged. */
export function stripBeliefBlockV0(userContent: string): string {
  return d1StripBeliefBlockV0(userContent);
}

export interface D3BProductionBaseV0 {
  readonly system_content: string;
  readonly user_content: string;
  readonly structured_output: ModelTransportRequestV0["structured_output"];
  readonly source: string;
  readonly arm: "NEUTRAL";
}

/**
 * A real production V8 request, built exactly as D1 and D2-A0/A1 built theirs: production genesis
 * materialisation -> production observation lifecycle -> production projection -> production provider
 * rendering. Arm NEUTRAL is used because D3-B is state-blind: the belief block is stripped anyway, so
 * the arm cannot reach the fixture.
 */
export async function buildProductionBaseRequestV0(): Promise<D3BProductionBaseV0> {
  const world = await buildArmWorldV0("NEUTRAL");
  const projection = await buildProjectionV0(world.post_observation_state as SubjectStateV4);
  return Object.freeze({
    system_content: cognitionSystemPromptForV8(projection),
    user_content: cognitionUserContentForV8(projection, {}),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA }),
    source: "production genesis -> observation lifecycle -> projection -> production V8 rendering (D1-frozen path)",
    arm: "NEUTRAL" as const
  });
}
