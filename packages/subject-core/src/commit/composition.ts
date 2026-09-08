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
import type { SubjectStateAnyVersionV0 } from "../types/subject-state-v4.js";
import { readSubjectStateSchemaVersion } from "../types/subject-state-v4.js";
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
    case "Personality": {
      return requirePaths(pathsForDomain(proposal, "personality"), "personality", ["/personality"], base);
    }
    case "Relationship": {
      return requirePaths(
        pathsForDomain(proposal, "relationship"),
        "relationship",
        ["/relationships"],
        base
      );
    }
    case "Belief": {
      return requirePaths(pathsForDomain(proposal, "belief"), "belief", ["/beliefs"], base);
    }
    default:
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${base}: unknown transition type`);
  }
}

/** Version-aware bounded dispatcher. The public/default validator above stays
 * byte-for-byte and behavior-for-behavior the frozen v3 composition law. */
export function validateProposalCompositionForStateVersion(
  predecessor: SubjectStateAnyVersionV0,
  proposal: CanonicalTransitionProposalV1
): ValidationResult<void> {
  const version = readSubjectStateSchemaVersion(predecessor);
  if (version === "subject-state-v3") return validateProposalComposition(proposal);
  if (version !== "subject-state-v4") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "composition predecessor schema_version is unsupported");
  }
  const base = `composition[${proposal.transition_type}:subject-state-v4]`;
  if (proposal.transition_type === "Time") {
    if (proposal.time_input.kind === "ELAPSED" && proposal.time_input.elapsed_time.value === 0) {
      return proposal.domain_deltas.length === 0
        ? ok(undefined)
        : fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: elapsed=0 must carry zero deltas`);
    }
    if (proposal.domain_deltas.length !== 2) {
      return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: positive Time requires exactly affect and regulation deltas`);
    }
    const affectDeltas = proposal.domain_deltas.filter((delta) => delta.domain === "affect");
    const regulationDeltas = proposal.domain_deltas.filter((delta) => delta.domain === "regulation");
    if (
      affectDeltas.length !== 1 ||
      affectDeltas[0]?.producer !== "affect" ||
      affectDeltas[0].operations.length !== 1 ||
      affectDeltas[0].operations[0]?.path !== "/affect"
    ) {
      return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: exact affect/affect /affect replacement required`);
    }
    if (
      regulationDeltas.length !== 1 ||
      regulationDeltas[0]?.producer !== "regulation" ||
      regulationDeltas[0].operations.length !== 1 ||
      regulationDeltas[0].operations[0]?.path !== "/regulation"
    ) {
      return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: exact regulation/regulation /regulation replacement required`);
    }
    return ok(undefined);
  }
  if (proposal.transition_type === "AffectApplication") {
    // CANONICAL_AFFECT_APPLICATION_V0: the one impulse writer. Exactly one
    // affect/affect delta carrying exactly the /affect replacement, applied at
    // the current logical time (OCCURRENCE). No other domain may ride along.
    if (proposal.time_input.kind !== "OCCURRENCE") {
      return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: AffectApplication requires OCCURRENCE time input`);
    }
    if (proposal.domain_deltas.length !== 1) {
      return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: AffectApplication requires exactly one affect delta`);
    }
    const delta = proposal.domain_deltas[0];
    if (
      delta?.producer !== "affect" ||
      delta.domain !== "affect" ||
      delta.operations.length !== 1 ||
      delta.operations[0]?.path !== "/affect"
    ) {
      return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: exact affect/affect /affect replacement required`);
    }
    return ok(undefined);
  }
  if (proposal.transition_type === "Learning") {
    // The governed pre-cognition Appraisal commit: memory-content only,
    // identical required path to the v3 Learning law.
    return requirePaths(
      pathsForDomain(proposal, "memory-content"),
      "memory-content",
      ["/memory_state/repository_revision"],
      base
    );
  }
  if (proposal.transition_type === "Observation") {
    // Event admission on v4: context is required; legacy affect/mood writes
    // are FORBIDDEN (Time is the only recovery writer; AffectApplication is
    // the only impulse writer on v4).
    const context = requirePaths(pathsForDomain(proposal, "context"), "context", ["/context"], base);
    if (!context.ok) return context;
    for (const delta of proposal.domain_deltas) {
      if (delta.domain === "affect") {
        return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: v4 Observation must not write legacy affect`);
      }
    }
    const retrieval = pathsForDomain(proposal, "memory-retrieval");
    if (retrieval.size > 0) {
      const requiredRetrievalFields = [
        "/memory_state/working_refs",
        "/memory_state/recent_retrieval_trace",
        "/memory_state/last_retrieval_at"
      ];
      const complete = requiredRetrievalFields.every((field) => retrieval.has(field));
      if (!complete) {
        return fail(
          "INVALID_TRANSITION_COMPOSITION",
          TR_ATOMIC,
          `${base}: optional memory-retrieval delta must contain all three retrieval fields`
        );
      }
    }
    return ok(undefined);
  }
  return fail("INVALID_TRANSITION_COMPOSITION", TR_ATOMIC, `${base}: v4 foundation does not support ${proposal.transition_type}`);
}
