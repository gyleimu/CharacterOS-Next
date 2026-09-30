/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * PHASE 0 — DETERMINISTIC STUB PROVIDER SET (0 model calls).
 *
 * Extracted verbatim from `smoke.ts` so that more than one offline consumer can build the SAME stub
 * bundle instead of maintaining a near-copy. The repository's law is one implementation shared by both
 * users; a second, slightly different stub would be a silent divergence in the instrument.
 *
 * The stubs are NOT scientific instruments and their outputs are meaningless. They exist so that the
 * harness mechanics (freeze ordering, state capture, leakage scan, scoring handoff, id mapping) can be
 * exercised end to end without spending a call.
 */

import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../../../packages/runtime/dist/index.js";

import { P0_OUTCOME_BROKEN, P0_OUTCOME_KEPT } from "./contract.ts";
import type { Phase0AppraisalProviderV0, Phase0BundleV0 } from "./harness.ts";

/** The stub cognition payload: a lawful v8 proposal. Byte-identical to the smoke-era stub. */
export const STUB_COGNITION_CONTENT_V0 = JSON.stringify({
  response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
  schema_version: "conversation-cognition-proposal-v8",
  subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
  factual_assessment: { claims: [] },
  cognition: {
    schema_version: "cognition-proposal-v0",
    reasoning_summary: "offline stub cognition",
    relevant_memory_handles: [],
    considered_handles: [],
    current_intent: "respond to the user",
    confidence: 0.7,
    uncertainty: 0.3,
    action_intent: null,
    evidence_handles: []
  },
  communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
  clarification_basis: null
});

export const STUB_LANGUAGE_CONTENT_V0 = JSON.stringify({
  schema_version: "language-realization-semantic-draft-v1",
  text: "STUB_REPLY",
  evidence_refs: []
});

/** Builds the deterministic stub provider set. Every call is recorded; no request is altered. */
export function buildPhase0StubBundleV0(): Phase0BundleV0 {
  const tally: Phase0BundleV0["tally"] = { cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 };
  const cognitionRequests: Phase0BundleV0["cognitionRequests"] = [];
  const providerCalls: Phase0BundleV0["providerCalls"] = [];
  let currentTurn = "PRE";

  const cognitionTransport: ModelTransportV0 = {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const messages = request.messages.map((m) => ({ role: m.role, content: m.content }));
      cognitionRequests.push({ turn: currentTurn, messages });
      return { content: STUB_COGNITION_CONTENT_V0, model: "stub" } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;

  const languageTransport: ModelTransportV0 = {
    complete: async (): Promise<ModelTransportResponseV0> =>
      ({ content: STUB_LANGUAGE_CONTENT_V0, model: "stub" }) as ModelTransportResponseV0
  } as ModelTransportV0;

  const appraisalProvider = {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4
        },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as Phase0AppraisalProviderV0;

  return {
    cognitionTransport,
    languageTransport,
    appraisalProvider,
    beliefSemanticProvider: {
      propose: async (input: never) => {
        tally.belief_semantic += 1;
        const typed = input as {
          semantic_context_fingerprint: string;
          candidate_catalog_fingerprint: string;
          catalog: { propositions: readonly { proposition_id: string; proposition_label: string }[] };
          evidence: { evidence: readonly { scene: string }[] };
        };
        const bindings = {
          schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
          semantic_context_fingerprint: typed.semantic_context_fingerprint,
          candidate_catalog_fingerprint: typed.candidate_catalog_fingerprint
        };
        const text = typed.evidence.evidence.map((entry) => entry.scene).join("\n");
        const target = typed.catalog.propositions.find((p) => p.proposition_label.includes("Nadia")) ?? null;
        let output: unknown;
        if (target === null) output = { ...bindings, kind: "NO_BEARING" };
        else if (text.includes(P0_OUTCOME_KEPT))
          output = { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "SUPPORTS" };
        else if (text.includes(P0_OUTCOME_BROKEN))
          output = { ...bindings, kind: "EXISTING_PROPOSITION", proposition_id: target.proposition_id, relation: "CONTRADICTS" };
        else output = { ...bindings, kind: "NO_BEARING" };
        providerCalls.push({ turn: currentTurn, input, output, error: null });
        return output;
      }
    },
    tally,
    cognitionRequests,
    providerCalls,
    executorModel: "stub",
    executorBaseUrl: "stub",
    isStub: true,
    setTurnLabel: (label: string) => {
      currentTurn = label;
    }
  };
}
