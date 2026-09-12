/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — shared product turn execution.
 *
 * ONE implementation of "run one instrumented human turn": publish the expected
 * plan, run the frozen serialized turn, report conditional-language and
 * adaptation outcomes truthfully, and close the turn's timing. Extracted from
 * `product-cli-session.ts` so the CLI and the local web product observe the SAME
 * lifecycle truth. Adds no canonical semantics and changes no provider call.
 */

import type { InteractiveTurnOutcomeV0 } from "@characteros-next/runtime";
import type { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import {
  buildProductTurnPlanV0,
  classifyProviderFailureV0,
  extractFailureStageV0,
  type ProductTurnPlanInputV0,
  type ProviderDiagnosticsV0,
  type ProviderFailureCategoryV0,
  type ProviderStageV0
} from "./provider-diagnostics.js";

export interface InstrumentedTurnResultV0 {
  readonly outcome: InteractiveTurnOutcomeV0;
  /** Total wall time of the turn, or null when no diagnostics clock is present. */
  readonly elapsed_ms: number | null;
}

/** Product-facing next action for a classified provider failure. */
export function suggestionForFailureV0(category: ProviderFailureCategoryV0 | string): string {
  switch (category) {
    case "PROVIDER_UNAVAILABLE":
      return "Check that Ollama is running and the configured model is installed, then relaunch.";
    case "PROVIDER_TIMEOUT":
      return "The local model exceeded the configured timeout; see /diagnostics, then retry or raise CHARACTEROS_TIMEOUT_MS.";
    case "PROVIDER_MALFORMED_RESPONSE":
      return "The model returned invalid structured output; see /diagnostics, then retry.";
    case "PROVIDER_REJECTED_OUTPUT":
      return "The model output was rejected by the frozen validator; see /diagnostics, then retry.";
    default:
      return "See /diagnostics, then /exit and relaunch to resume from durable state.";
  }
}

/**
 * Bounded, truthful failure summary: which stage failed, whether canonical work
 * committed or remains pending, why, and what the user can do next.
 */
export interface TurnFailureSummaryV0 {
  readonly stage: ProviderStageV0 | null;
  readonly persistence: "SAFE" | "PARTIAL";
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
  readonly pending_lifecycle_work: number;
  readonly category: ProviderFailureCategoryV0;
  readonly detail: string;
  readonly suggested_action: string;
}

export function buildTurnFailureSummaryV0(input: {
  readonly outcome: InteractiveTurnOutcomeV0;
  readonly diagnostics: ProviderDiagnosticsV0 | null;
  readonly pending_lifecycle_work: number;
}): TurnFailureSummaryV0 {
  const failure = input.outcome.failure;
  const stage = extractFailureStageV0(failure);
  const recorded = stage === null ? null : input.diagnostics?.last(stage) ?? null;
  const classified =
    recorded !== null && recorded.category !== null
      ? { category: recorded.category, detail: recorded.detail ?? "" }
      : classifyProviderFailureV0(failure ?? "unknown provider failure");
  const canonicalChanged =
    input.outcome.repository_revision_after !== input.outcome.repository_revision_before ||
    input.outcome.state_revision_after !== input.outcome.state_revision_before;
  const persistence = !canonicalChanged && input.pending_lifecycle_work === 0 ? "SAFE" : "PARTIAL";
  return {
    stage,
    persistence,
    repository_revision_before: input.outcome.repository_revision_before,
    repository_revision_after: input.outcome.repository_revision_after,
    state_revision_before: input.outcome.state_revision_before,
    state_revision_after: input.outcome.state_revision_after,
    pending_lifecycle_work: input.pending_lifecycle_work,
    category: classified.category,
    detail: classified.detail,
    suggested_action: suggestionForFailureV0(classified.category)
  };
}

/**
 * Reports post-turn adaptation truthfully into the ONE diagnostics record.
 * A report never changes the turn's outcome; the frozen runtime decides
 * fatality. SKIPPED means no model call was lawful (not a failure).
 */
function reportAdaptation(diagnostics: ProviderDiagnosticsV0, outcome: InteractiveTurnOutcomeV0): void {
  const belief = outcome.belief_adaptation;
  if (belief !== null) {
    if (belief.status === "DISABLED") diagnostics.noteReported("BELIEF_ADAPTATION", "DISABLED", belief.status);
    else if (belief.failure !== null)
      diagnostics.noteReported("BELIEF_ADAPTATION", "FAILED", `${belief.status} — ${belief.failure}`);
    else if (belief.status === "COMPLETED") diagnostics.noteReported("BELIEF_ADAPTATION", "OK", belief.status);
    else diagnostics.noteReported("BELIEF_ADAPTATION", "SKIPPED", belief.status);
  }
  const relationship = outcome.relationship_familiarity;
  if (relationship !== null) {
    if (relationship.status === "DISABLED") {
      diagnostics.noteReported("RELATIONSHIP_ADAPTATION", "DISABLED", "not configured");
    } else if (relationship.status === "NO_APPLICABLE_EPISODE") {
      diagnostics.noteReported("RELATIONSHIP_ADAPTATION", "SKIPPED", "no applicable counterpart episode");
    } else {
      diagnostics.noteReported("RELATIONSHIP_ADAPTATION", "OK", relationship.status);
    }
  }
}

/**
 * Runs exactly one instrumented product turn. Expectation is published BEFORE
 * the first provider call; total wall time spans the whole turn; from turn 2 on
 * the runtime also closes the previous delivered behavior, which is planned
 * truthfully. `onOutcome` runs immediately after the turn returns and before
 * adaptation reporting, preserving the existing CLI ordering.
 */
export async function runInstrumentedProductTurnV0(input: {
  readonly host: InteractiveSubjectHostV0;
  readonly diagnostics: ProviderDiagnosticsV0 | null;
  readonly turnPlan: ProductTurnPlanInputV0;
  readonly text: string;
  readonly onOutcome?: (outcome: InteractiveTurnOutcomeV0) => void;
}): Promise<InstrumentedTurnResultV0> {
  const diagnostics = input.diagnostics;
  const closingPriorOutcome =
    diagnostics !== null ? (await input.host.status()).pending_behavior_outcome : false;
  const started = diagnostics?.now() ?? null;
  diagnostics?.beginTurn(
    buildProductTurnPlanV0({ ...input.turnPlan, closing_prior_outcome: closingPriorOutcome })
  );
  const outcome = await input.host.send(input.text);
  const elapsed = started !== null && diagnostics !== null ? diagnostics.now() - started : null;
  input.onOutcome?.(outcome);
  if (diagnostics !== null) reportAdaptation(diagnostics, outcome);
  if (outcome.status !== "COMPLETE") {
    diagnostics?.endTurn({ status: "FAILED", total_ms: elapsed });
    return { outcome, elapsed_ms: elapsed };
  }
  // LANGUAGE is conditional and only knowable AFTER cognition: never promised
  // live, but reported truthfully here when it lawfully made no model call.
  if (!outcome.language_call_required) {
    diagnostics?.noteSkipped("LANGUAGE", `no language call (${outcome.language_status})`, false);
  }
  diagnostics?.endTurn({ status: "COMPLETE", total_ms: elapsed });
  return { outcome, elapsed_ms: elapsed };
}
