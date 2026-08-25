/**
 * P2.1.3 — §7.2 required-delta composition checks for commit-producing proposals.
 * Source: docs/implementation/p2-1-contract-freeze.md §7.2 composition table,
 * §13.4 layer 7. Pure input -> ValidationResult; no candidate application here.
 *
 * Time elapsed=0 zero-delta routing and NO_OP terminalization are runtime-owned and
 * are surfaced by the engine before this check; a nonempty Time delta set that reaches
 * here with elapsed=0 composes invalidly (INVALID_TRANSITION_COMPOSITION).
 */

import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { fail, ok, type ValidationResult } from "../validation/result.js";

const TR_ATOMIC = "TR-ATOMIC-001";

function pathsForDomain(proposal: CanonicalTransitionProposalV1, domain: string): Set<string> {
  const paths = new Set<string>();
  for (const delta of proposal.domain_deltas) {
    if (delta.domain !== domain) continue;
    for (const operation of delta.operations) paths.add(operation.path);
  }
  return paths;
}

function requirePaths(
  paths: Set<string>,
  domain: string,
  required: readonly string[],
  detailBase: string
): ValidationResult<void> {
  for (const path of required) {
    if (!paths.has(path)) {
      return fail("MISSING_REQUIRED_DELTA", TR_ATOMIC, `${detailBase}: ${domain} delta missing ${path}`);
    }
  }
  return ok(undefined);
}

/**
 * Enforces the §7.2 "Required delta content" table for one transition class.
 * Optional deltas may be absent; partial optional sets compose invalidly.
 */
export function validateProposalComposition(
  proposal: CanonicalTransitionProposalV1
): ValidationResult<void> {
  const base = `composition[${proposal.transition_type}]`;
  switch (proposal.transition_type) {
    case "Time": {
      if (proposal.time_input.kind === "ELAPSED" && proposal.time_input.elapsed_time.value === 0) {
        if (proposal.domain_deltas.length > 0) {
          return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: elapsed=0 must carry zero deltas`);
        }
        return ok(undefined);
      }
      const affect = requirePaths(pathsForDomain(proposal, "affect"), "affect", ["/mood", "/affect"], base);
      if (!affect.ok) return affect;
      return requirePaths(pathsForDomain(proposal, "regulation"), "regulation", ["/regulation"], base);
    }
    case "Observation": {
      const affect = requirePaths(pathsForDomain(proposal, "affect"), "affect", ["/mood", "/affect"], base);
      if (!affect.ok) return affect;
      const context = requirePaths(pathsForDomain(proposal, "context"), "context", ["/context"], base);
      if (!context.ok) return context;
      const retrieval = pathsForDomain(proposal, "memory-retrieval");
      if (retrieval.size > 0) {
        const requiredRetrievalFields = [
          "/memory_state/working_refs",
          "/memory_state/recent_retrieval_trace",
          "/memory_state/last_retrieval_at"
        ];
        const complete = requiredRetrievalFields.every((field) => retrieval.has(field));
        if (!complete) {
          // Partial optional set: presence means the whole trio composes atomically.
          return fail(
            "INVALID_TRANSITION_COMPOSITION",
            TR_ATOMIC,
            `${base}: optional memory-retrieval delta must contain all three retrieval fields`
          );
        }
      }
      return ok(undefined);
    }
    case "CognitionAction": {
      const hasContext = pathsForDomain(proposal, "context").has("/context");
      const hasRegulation = pathsForDomain(proposal, "regulation").has("/regulation");
      if (!hasContext && !hasRegulation) {
        return fail(
          "MISSING_REQUIRED_DELTA",
          TR_ATOMIC,
          `${base}: CognitionAction requires a context or regulation delta`
        );
      }
      return ok(undefined);
    }
    case "Learning": {
      return requirePaths(
        pathsForDomain(proposal, "memory-content"),
        "memory-content",
        ["/memory_state/repository_revision"],
        base
      );
    }
    default:
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${base}: unknown transition type`);
  }
}
