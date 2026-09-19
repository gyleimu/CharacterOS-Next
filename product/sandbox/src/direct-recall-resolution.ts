/**
 * HOST_DIRECT_RECALL_PRODUCT_AUTHORITY_V0 — product integration.
 *
 * Wraps the cognition provider at the product layer. When the direct-recall
 * authority determines that the query is eligible, the host constructs the V8
 * proposal (SOURCE_QUOTE + PRIMARY_FACT) and validates it through the REAL V8
 * provider parse — the model is NOT called for the cognition step. When the
 * authority abstains, the normal cognition path runs unchanged.
 *
 * The language step still operates through the existing realization path on the
 * already-authorized claim (PRIMARY_FACT → plan → model phrasing), preserving all
 * frozen language laws.
 */

import { authorizeFactualClaimV1, type FactualSourceTextResolverV0 } from "@characteros-next/runtime";

/** Structural view of the cognition projection the resolver reads (read-only). */
interface CognitionProjectionViewV0 {
  readonly context?: { readonly scene?: string } | undefined;
  readonly memory_working_refs?: readonly string[] | undefined;
  readonly factual_memory_evidence?: { readonly entries?: readonly unknown[] } | undefined;
}
import {
  evaluateHostDirectRecallV0,
  type DirectRecallEvidenceEntryV0
} from "./host-direct-recall-authority.js";


export interface DirectRecallResolutionV0 {
  readonly route: "DIRECT_RECALL" | "NORMAL_COGNITION";
  readonly abstain_reason: string | null;
  /** The host-constructed V8 proposal, present only when route = DIRECT_RECALL. */
  readonly proposal: Record<string, unknown> | null;
  readonly span: string | null;
  readonly source_ref: string | null;
}

function extractEvidenceEntries(projection: unknown): DirectRecallEvidenceEntryV0[] {
  const record = projection === null || typeof projection !== "object" ? undefined : (projection as Record<string, unknown>);
  const bundle = record === undefined ? undefined : (record["factual_memory_evidence"] as { entries?: readonly unknown[] } | undefined);
  if (bundle === undefined || !Array.isArray(bundle.entries)) return [];
  return bundle.entries
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry) => ({
      episode_ref: typeof entry["episode_ref"] === "string" ? entry["episode_ref"] : "",
      kind: typeof entry["kind"] === "string" ? entry["kind"] : "",
      ...(typeof entry["delivered_behavior_text"] === "string" ? { delivered_behavior_text: entry["delivered_behavior_text"] } : {}),
      ...(typeof entry["exact_outcome_text"] === "string" ? { exact_outcome_text: entry["exact_outcome_text"] } : {}),
      ...(typeof entry["scene"] === "string" ? { scene: entry["scene"] } : {})
    }));
}

function extractSelectedRefs(projection: unknown): readonly string[] {
  const record = projection === null || typeof projection !== "object" ? undefined : (projection as Record<string, unknown>);
  const refs = record === undefined ? undefined : (record["memory_working_refs"] as readonly string[] | undefined);
  return refs ?? [];
}

/**
 * The ONE current-utterance extraction law shared by every product recall
 * authority (this module and RECALL_EVIDENCE_SELECTOR_PRODUCT_AUTHORITY_V0).
 * The product wraps the visitor's turn as `The user says: "..."`; the unwrapped
 * text is what a recall query must be classified against.
 */
export function extractRecallQueryV0(projection: unknown): string {
  const record = projection === null || typeof projection !== "object" ? undefined : (projection as Record<string, unknown>);
  const context = record?.["context"] as Record<string, unknown> | undefined;
  const scene = context === undefined || context === null ? "" : String(context["scene"] ?? "");
  // Strip the product wrapper: The user says: "..."
  const match = /^The user says: "(.*)"$/.exec(scene);
  return match === null ? scene : (match[1] ?? "");
}

/**
 * Evaluates the direct-recall authority and, if eligible, constructs the full V8
 * proposal. The caller must still pass it through the real V8 parse (the same
 * validation the model path uses) before delivering.
 */
export function resolveDirectRecallV0(
  projection: CognitionProjectionViewV0 | null | undefined
): DirectRecallResolutionV0 {
  const query = extractRecallQueryV0(projection);
  const evidenceEntries = extractEvidenceEntries(projection);
  const selectedRefs = extractSelectedRefs(projection);
  if (evidenceEntries.length === 0 || selectedRefs.length === 0) {
    return { route: "NORMAL_COGNITION", abstain_reason: "no memory evidence", proposal: null, span: null, source_ref: null };
  }

  const evaluation = evaluateHostDirectRecallV0(query, evidenceEntries, selectedRefs);
  if (!evaluation.eligible) {
    return { route: "NORMAL_COGNITION", abstain_reason: evaluation.abstain_reason, proposal: null, span: null, source_ref: null };
  }

  // Build the production source resolver (same semantics as the V8 provider).
  const sourceTexts: FactualSourceTextResolverV0 = (ref) => {
    for (const entry of evidenceEntries) {
      if (entry.episode_ref === ref) {
        return [entry.delivered_behavior_text ?? "", entry.exact_outcome_text ?? ""].filter((text) => text.length > 0);
      }
    }
    return null;
  };

  // Construct and authorize the SOURCE_QUOTE claim through the frozen authority.
  const authorization = authorizeFactualClaimV1(
    { kind: "SOURCE_QUOTE", text: evaluation.span ?? "", source_refs: [evaluation.source_ref ?? ""] as never },
    sourceTexts
  );
  if (authorization.status !== "AUTHORIZED_SOURCE_QUOTE") {
    return { route: "NORMAL_COGNITION", abstain_reason: `authorization rejected: ${authorization.status}`, proposal: null, span: null, source_ref: null };
  }

  // Construct the full V8 proposal with the authorized claim.
  const proposal: Record<string, unknown> = {
    schema_version: "conversation-cognition-proposal-v8",
    factual_assessment: {
      claims: [{ kind: "SOURCE_QUOTE", text: evaluation.span, source_handles: ["F1"] }]
    },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "Direct factual recall from the subject's recorded history.",
      relevant_memory_handles: ["F1"],
      considered_handles: ["F1"],
      current_intent: "Answer the user's direct factual recall question.",
      confidence: 0.95,
      uncertainty: 0.05,
      action_intent: null,
      evidence_handles: ["F1"]
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
  };

  return {
    route: "DIRECT_RECALL",
    abstain_reason: null,
    proposal,
    span: evaluation.span,
    source_ref: evaluation.source_ref
  };
}
