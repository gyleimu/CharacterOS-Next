/**
 * CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0 +
 * CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0 — product provider
 * diagnostics and turn progress.
 *
 * Pure PRODUCT/transport observability: which model-backed stage is running, how
 * long it took, how it failed, and — process-locally — what the frozen runtime
 * turn plan looks like and roughly how long the remaining stages may take. It
 * never reads or writes canonical subject state, never persists diagnostics,
 * never advances canonical Time, and never fabricates an appraisal, cognition,
 * language or adaptation result. Process-local only; resets on restart by design.
 *
 * ONE product truth for stage/status/latency: live turn progress, /diagnostics
 * and the latency samples all read the same records. No second mechanism.
 */

import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "@characteros-next/runtime";
import { ModelTransportErrorV0 } from "@characteros-next/runtime";

/** Product-only operator taxonomy; only stages that actually make model calls. */
export type ProviderStageV0 =
  | "APPRAISAL"
  | "BELIEF_ADAPTATION"
  | "PERSONALITY_ADAPTATION"
  | "RELATIONSHIP_ADAPTATION"
  | "COGNITION"
  | "LANGUAGE";

/** Smallest useful product failure categories (existing typed errors preserved). */
export type ProviderFailureCategoryV0 =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_MALFORMED_RESPONSE"
  | "PROVIDER_REJECTED_OUTPUT"
  | "PROVIDER_INTERNAL_ERROR";

export type ProviderStageStatusV0 =
  | "DISABLED"
  | "CONFIGURED"
  | "RUNNING"
  | "OK"
  | "FAILED"
  | "SKIPPED"
  /** Semantic stage ran by reusing an identical request's inference (no model call). */
  | "REUSED";

export interface ProviderStageRecordV0 {
  readonly stage: ProviderStageV0;
  readonly status: ProviderStageStatusV0;
  readonly latency_ms: number | null;
  readonly category: ProviderFailureCategoryV0 | null;
  readonly error_code: string | null;
  readonly detail: string | null;
}

/** Frozen runtime order of the reply-critical reply path. */
export const REPLY_PATH_STAGES_V0: readonly ProviderStageV0[] = Object.freeze([
  "APPRAISAL",
  "COGNITION",
  "LANGUAGE"
]);

/** Canonical operator display order for every product-observed stage. */
export const PROVIDER_STAGES_V0: readonly ProviderStageV0[] = Object.freeze([
  "APPRAISAL",
  "BELIEF_ADAPTATION",
  "PERSONALITY_ADAPTATION",
  "RELATIONSHIP_ADAPTATION",
  "COGNITION",
  "LANGUAGE"
]);

/** Structured, bounded diagnostics snapshot (the same truth as formatLines). */
export interface ProviderDiagnosticsSnapshotV0 {
  readonly model: string;
  readonly timeout_ms: number;
  readonly stages: readonly ProviderStageRecordV0[];
  readonly samples: readonly ProviderStageSampleV0WithStageV0[];
  readonly last_turn: ProviderTurnTimingV0 | null;
}

export interface ProviderStageSampleV0WithStageV0 {
  readonly stage: ProviderStageV0;
  readonly last_ms: number;
  readonly count: number;
}

/**
 * Expected stage plan for ONE product turn. Read-only description of what the
 * frozen runtime will attempt; it never changes which providers are called.
 *
 * `reply_stages` is the reply-critical path (language is conditional: it is
 * skipped when cognition returns CLARIFY_MISSING_CONTEXT).
 * `adaptation_stages` are the configured, product-timed post-reply adaptation
 * stages. Belief adaptation is deliberately NOT listed here: its model call runs
 * on a provider-internal transport the product does not wrap, so the product can
 * neither number nor time it live (it is still reported in /diagnostics).
 */
export interface ProductTurnPlanV0 {
  readonly reply_stages: readonly ProviderStageV0[];
  /**
   * Stages that close the PREVIOUS turn's delivered behavior. From turn 2 on the
   * runtime admits the counterpart reply and appraises it (`completePending
   * LifecycleWork`) AFTER this turn's response text is produced but BEFORE the
   * turn result returns, so it is part of the wait and must not be mislabeled as
   * a reply stage.
   */
  readonly prior_reply_stages: readonly ProviderStageV0[];
  readonly adaptation_stages: readonly ProviderStageV0[];
  readonly language_conditional: boolean;
  /** Configured but not product-timed (belief adaptation); never numbered/estimated. */
  readonly untimed_adaptation_stages: readonly ProviderStageV0[];
}

export interface ProductTurnPlanInputV0 {
  readonly belief_adaptation_enabled: boolean;
  readonly relationship_adaptation_enabled: boolean;
  readonly personality_adaptation_enabled: boolean;
  /** True when the previous delivered behavior is still awaiting the counterpart reply. */
  readonly closing_prior_outcome?: boolean;
}

/** Builds the bounded expected plan from the CURRENT product configuration. */
export function buildProductTurnPlanV0(input: ProductTurnPlanInputV0): ProductTurnPlanV0 {
  const adaptation: ProviderStageV0[] = [];
  if (input.relationship_adaptation_enabled) adaptation.push("RELATIONSHIP_ADAPTATION");
  if (input.personality_adaptation_enabled) adaptation.push("PERSONALITY_ADAPTATION");
  return {
    reply_stages: REPLY_PATH_STAGES_V0,
    prior_reply_stages: input.closing_prior_outcome === true ? ["APPRAISAL"] : [],
    adaptation_stages: adaptation,
    language_conditional: true,
    untimed_adaptation_stages: input.belief_adaptation_enabled ? ["BELIEF_ADAPTATION"] : []
  };
}

export interface ProviderStageSampleV0 {
  readonly last_ms: number;
  readonly count: number;
}

/** Which plan group a stage belongs to (display grouping only). */
export type ProviderProgressGroupV0 = "REPLY" | "PRIOR_REPLY" | "ADAPTATION" | "NONE";

export type ProviderProgressEventTypeV0 =
  | "TURN_PLAN"
  | "TURN_STARTED"
  | "TURN_COMPLETED"
  | "TURN_FAILED"
  | "STAGE_RUNNING"
  | "STAGE_SUCCEEDED"
  | "STAGE_FAILED"
  | "STAGE_SKIPPED"
  | "STAGE_REPORTED"
  | "STAGE_REUSED";

/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — structured, prompt-free progress.
 * The SAME events the CLI renders as text; a visual client renders these instead
 * of parsing CLI strings. Never carries user text, prompts or Memory payloads.
 */
export interface ProviderProgressEventV0 {
  readonly type: ProviderProgressEventTypeV0;
  readonly stage?: ProviderStageV0;
  readonly group?: ProviderProgressGroupV0;
  readonly index?: number;
  readonly total?: number;
  readonly status?: ProviderStageStatusV0;
  readonly latency_ms?: number;
  readonly category?: ProviderFailureCategoryV0;
  readonly detail?: string;
  /** TURN_PLAN: the frozen plan for this turn. */
  readonly plan?: ProductTurnPlanV0;
  /** TURN_PLAN: rough reply-path estimate from process-local samples (null when unknown). */
  readonly reply_estimate_ms?: number | null;
  /** TURN_COMPLETED / TURN_FAILED: the turn's timing split. */
  readonly timing?: ProviderTurnTimingV0;
}

/** Rough reply-path estimate from the most recent successful local samples. */
export function estimateReplyPathMsV0(
  plan: ProductTurnPlanV0,
  sampleFor: (stage: ProviderStageV0) => number | null
): number | null {
  const sampled = plan.reply_stages.filter((stage) => sampleFor(stage) !== null);
  if (sampled.length === 0) return null;
  return sampled.reduce((total, stage) => total + (sampleFor(stage) ?? 0), 0);
}

export interface ProviderTurnTimingV0 {
  readonly status: "COMPLETE" | "FAILED";
  readonly total_ms: number | null;
  readonly provider_ms: number;
  readonly reply_ms: number;
  /** Prior-turn outcome closing time (never part of the reply path). */
  readonly prior_reply_ms: number;
  readonly adaptation_ms: number;
  readonly skipped: readonly ProviderStageV0[];
}

export interface ProviderDiagnosticsOptionsV0 {
  readonly write: (line: string) => void;
  /**
   * Optional structured observer receiving the SAME stage truth as `write`.
   * Additive: the CLI keeps using `write`; a visual client consumes events.
   */
  readonly observer?: (event: ProviderProgressEventV0) => void;
  /** Monotonic millisecond clock (injectable for deterministic tests). */
  readonly now?: () => number;
  readonly model: string;
  readonly timeout_ms: number;
  readonly debug: boolean;
}

function defaultMonotonicNowV0(): number {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

/** Maps an existing provider/transport error into a product category. */
export function classifyProviderFailureV0(error: unknown): {
  readonly category: ProviderFailureCategoryV0;
  readonly error_code: string | null;
  readonly detail: string;
} {
  if (error instanceof ModelTransportErrorV0) {
    switch (error.code) {
      case "MODEL_TIMEOUT":
        return { category: "PROVIDER_TIMEOUT", error_code: error.code, detail: error.message };
      case "MODEL_CONNECTION_FAILURE":
        return { category: "PROVIDER_UNAVAILABLE", error_code: error.code, detail: error.message };
      case "MODEL_HTTP_FAILURE":
        return error.http_status === 404
          ? { category: "PROVIDER_UNAVAILABLE", error_code: error.code, detail: error.message }
          : { category: "PROVIDER_INTERNAL_ERROR", error_code: error.code, detail: error.message };
      case "MODEL_EMPTY_RESPONSE":
      case "MODEL_OUTPUT_TRUNCATED":
        return { category: "PROVIDER_MALFORMED_RESPONSE", error_code: error.code, detail: error.message };
      default:
        return { category: "PROVIDER_INTERNAL_ERROR", error_code: error.code, detail: error.message };
    }
  }
  const detail = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  const errorCode = typeof code === "string" ? code : null;
  if (/MODEL_TIMEOUT|timed out|timeout/i.test(detail)) {
    return { category: "PROVIDER_TIMEOUT", error_code: errorCode, detail };
  }
  if (/MODEL_CONNECTION_FAILURE|ECONNREFUSED|fetch failed|connection refused|not reachable/i.test(detail)) {
    return { category: "PROVIDER_UNAVAILABLE", error_code: errorCode, detail };
  }
  if (/SCHEMA_INVALID|MODEL_SCHEMA_INVALID|not strict JSON|malformed/i.test(detail)) {
    return { category: "PROVIDER_MALFORMED_RESPONSE", error_code: errorCode, detail };
  }
  if (/REJECTED|rejection|unsupported/i.test(detail)) {
    return { category: "PROVIDER_REJECTED_OUTPUT", error_code: errorCode, detail };
  }
  return { category: "PROVIDER_INTERNAL_ERROR", error_code: errorCode, detail };
}

/** Extracts the failing product stage from a runtime turn failure string. */
export function extractFailureStageV0(failure: string | null): ProviderStageV0 | null {
  if (failure === null) return null;
  if (/APPRAISAL_FAILED/.test(failure)) return "APPRAISAL";
  if (/COGNITION_FAILED|COGNITION_/.test(failure)) return "COGNITION";
  if (/LANGUAGE_/.test(failure)) return "LANGUAGE";
  if (/BELIEF/i.test(failure)) return "BELIEF_ADAPTATION";
  if (/PERSONALITY/i.test(failure)) return "PERSONALITY_ADAPTATION";
  if (/RELATIONSHIP|FAMILIARITY/i.test(failure)) return "RELATIONSHIP_ADAPTATION";
  return null;
}

function shorten(value: string, max = 220): string {
  const flattened = value.replace(/[\r\n]+/g, " ");
  return flattened.length > max ? `${flattened.slice(0, max)}…` : flattened;
}

/**
 * Compact before-turn expectation (§20/§50): one line stating the bounded reply
 * plan, the conditional language stage, and a rough estimate derived ONLY from
 * successful samples observed in THIS process. It never presents the configured
 * timeout as an expected duration.
 */
export function formatTurnExpectationLineV0(
  plan: ProductTurnPlanV0,
  sampleFor: (stage: ProviderStageV0) => number | null
): string {
  const conditional = plan.language_conditional ? " (language skipped when cognition clarifies)" : "";
  const priorReply = plan.prior_reply_stages.length > 0 ? ` + ${plan.prior_reply_stages.length} prior-reply stage` : "";
  const adaptation =
    plan.adaptation_stages.length > 0 || plan.untimed_adaptation_stages.length > 0 ? " + optional adaptation" : "";
  const sampled = plan.reply_stages.filter((stage) => sampleFor(stage) !== null);
  const known = sampled.reduce((total, stage) => total + (sampleFor(stage) ?? 0), 0);
  const estimate =
    sampled.length === 0
      ? "reply estimate unavailable (no successful local sample yet)"
      : sampled.length === plan.reply_stages.length
        ? `reply estimate ~${formatLatencyV0(known)} (recent local calls)`
        : `reply estimate ~${formatLatencyV0(known)} + ${plan.reply_stages.length - sampled.length} unsampled stage(s) (recent local calls)`;
  return `Turn: up to ${plan.reply_stages.length} reply stages${conditional}${priorReply}${adaptation} | ${estimate}`;
}

/** Post-turn summary (§22/§27): total wall time distinguished from provider time. */
export function formatTurnCompletionLineV0(timing: ProviderTurnTimingV0): string {
  const total = timing.total_ms === null ? "unknown" : formatLatencyV0(timing.total_ms);
  const skipped = timing.skipped.length > 0 ? `; skipped: ${timing.skipped.join(", ")}` : "";
  const priorReply = timing.prior_reply_ms > 0 ? `, prior-reply ${formatLatencyV0(timing.prior_reply_ms)}` : "";
  return (
    `Turn completed in ${total} (provider time ${formatLatencyV0(timing.provider_ms)}: ` +
    `reply ${formatLatencyV0(timing.reply_ms)}${priorReply}, adaptation ${formatLatencyV0(timing.adaptation_ms)}${skipped})`
  );
}

function disabled(stage: ProviderStageV0): ProviderStageRecordV0 {
  return { stage, status: "DISABLED", latency_ms: null, category: null, error_code: null, detail: null };
}

export class ProviderDiagnosticsV0 {
  private readonly records = new Map<ProviderStageV0, ProviderStageRecordV0>();
  /** Process-local successful latency samples (reset on restart by construction). */
  private readonly samples = new Map<ProviderStageV0, ProviderStageSampleV0>();
  private activePlan: ProductTurnPlanV0 | null = null;
  /** Per-turn latency keyed `${stage}:${occurrence}` so reply slots stay distinct. */
  private turnLatencyBySlot = new Map<string, number>();
  private turnStageCounts = new Map<ProviderStageV0, number>();
  private turnSkipped: ProviderStageV0[] = [];
  private lastTurnTimingValue: ProviderTurnTimingV0 | null = null;

  constructor(private readonly options: ProviderDiagnosticsOptionsV0) {
    this.records.set("APPRAISAL", disabled("APPRAISAL"));
    this.records.set("BELIEF_ADAPTATION", disabled("BELIEF_ADAPTATION"));
    this.records.set("PERSONALITY_ADAPTATION", disabled("PERSONALITY_ADAPTATION"));
    this.records.set("RELATIONSHIP_ADAPTATION", disabled("RELATIONSHIP_ADAPTATION"));
    this.records.set("COGNITION", disabled("COGNITION"));
    this.records.set("LANGUAGE", disabled("LANGUAGE"));
  }

  now(): number {
    return (this.options.now ?? defaultMonotonicNowV0)();
  }

  /**
   * Structured event emission is strictly additive observability: a throwing
   * observer (e.g. a closed SSE socket) must never break a product turn.
   */
  private emit(event: ProviderProgressEventV0): void {
    const observer = this.options.observer;
    if (observer === undefined) return;
    try {
      observer(event);
    } catch {
      // Observability must never break the conversation.
    }
  }

  /**
   * Marks a stage as CONFIGURED without a call yet. Distinct from DISABLED so a
   * visual client never reads a wired-but-not-yet-called stage as "not
   * configured" (and vice versa).
   */
  enable(stage: ProviderStageV0): void {
    this.records.set(stage, {
      stage,
      status: "CONFIGURED",
      latency_ms: null,
      category: null,
      error_code: null,
      detail: "configured"
    });
  }

  // ---- process-local latency samples -----------------------------------------

  lastSuccessMs(stage: ProviderStageV0): number | null {
    return this.samples.get(stage)?.last_ms ?? null;
  }

  sampleCount(stage: ProviderStageV0): number {
    return this.samples.get(stage)?.count ?? 0;
  }

  lastTurnTiming(): ProviderTurnTimingV0 | null {
    return this.lastTurnTimingValue;
  }

  // ---- turn plan / live progress ---------------------------------------------

  /**
   * Starts one product turn: publishes the expectation line (and, in debug, the
   * plan) and begins per-turn accumulation. Called immediately before the
   * runtime turn so the header precedes the first provider call.
   */
  beginTurn(plan: ProductTurnPlanV0): void {
    this.activePlan = plan;
    this.turnLatencyBySlot = new Map();
    this.turnStageCounts = new Map();
    this.turnSkipped = [];
    this.emit({
      type: "TURN_PLAN",
      plan,
      reply_estimate_ms: estimateReplyPathMsV0(plan, (stage) => this.lastSuccessMs(stage))
    });
    this.emit({ type: "TURN_STARTED" });
    this.options.write(formatTurnExpectationLineV0(plan, (stage) => this.lastSuccessMs(stage)));
    if (this.options.debug) {
      this.options.write(
        `[debug] turn plan reply=${plan.reply_stages.join(",")} adaptation=${plan.adaptation_stages.join(",") || "(none)"} ` +
          `untimed=${plan.untimed_adaptation_stages.join(",") || "(none)"} personality=DISABLED `
      );
      this.options.write(`[debug] model=${this.options.model} timeout=${this.options.timeout_ms} ms provider=OLLAMA_NATIVE`);
    }
  }

  /**
   * Positions a stage inside the active plan for truthful bounded numbering.
   * `occurrence` is 1-based within the turn: a repeated reply-path stage is the
   * prior-turn outcome closing step, never a second reply slot.
   */
  private locationOf(
    stage: ProviderStageV0,
    occurrence: number
  ): { readonly prefix: string; readonly group: ProviderProgressGroupV0; readonly index: number; readonly total: number } {
    const plain = { prefix: `[${stage.toLowerCase()}]`, group: "NONE" as const, index: 0, total: 0 };
    const plan = this.activePlan;
    if (plan === null) return plain;
    if (occurrence > 1) {
      const priorIndex = plan.prior_reply_stages.indexOf(stage);
      if (priorIndex >= 0) {
        return {
          prefix: `[prior-reply ${priorIndex + 1}/${plan.prior_reply_stages.length} ${stage.toLowerCase()}]`,
          group: "PRIOR_REPLY",
          index: priorIndex + 1,
          total: plan.prior_reply_stages.length
        };
      }
      return plain;
    }
    const replyIndex = plan.reply_stages.indexOf(stage);
    if (replyIndex >= 0) {
      return {
        prefix: `[reply ${replyIndex + 1}/${plan.reply_stages.length} ${stage.toLowerCase()}]`,
        group: "REPLY",
        index: replyIndex + 1,
        total: plan.reply_stages.length
      };
    }
    // Adaptation numbering covers BOTH product-timed and untimed stages (the
    // untimed belief stage still runs; only its latency is unobservable), so a
    // visual client sees one bounded adaptation group. Untimed stages remain
    // excluded from any estimate.
    const adaptationTotal = plan.adaptation_stages.length + plan.untimed_adaptation_stages.length;
    const adaptationIndex = plan.adaptation_stages.indexOf(stage);
    if (adaptationIndex >= 0) {
      return {
        prefix: `[adaptation ${adaptationIndex + 1}/${adaptationTotal} ${stage.toLowerCase()}]`,
        group: "ADAPTATION",
        index: adaptationIndex + 1,
        total: adaptationTotal
      };
    }
    const untimedIndex = plan.untimed_adaptation_stages.indexOf(stage);
    if (untimedIndex >= 0) {
      return {
        prefix: `[adaptation ${plan.adaptation_stages.length + untimedIndex + 1}/${adaptationTotal} ${stage.toLowerCase()}]`,
        group: "ADAPTATION",
        index: plan.adaptation_stages.length + untimedIndex + 1,
        total: adaptationTotal
      };
    }
    return plain;
  }

  private nextOccurrence(stage: ProviderStageV0): number {
    const occurrence = (this.turnStageCounts.get(stage) ?? 0) + 1;
    this.turnStageCounts.set(stage, occurrence);
    return occurrence;
  }

  private recentHint(stage: ProviderStageV0): string {
    const sample = this.lastSuccessMs(stage);
    return sample === null ? "" : ` (~${formatLatencyV0(sample)} recent)`;
  }

  noteRunning(stage: ProviderStageV0): void {
    this.records.set(stage, { stage, status: "RUNNING", latency_ms: null, category: null, error_code: null, detail: null });
    const occurrence = this.nextOccurrence(stage);
    const location = this.locationOf(stage, occurrence);
    this.emit({
      type: "STAGE_RUNNING",
      stage,
      group: location.group,
      index: location.index,
      total: location.total,
      status: "RUNNING"
    });
    this.options.write(`${location.prefix} running...${this.recentHint(stage)}`);
  }

  noteSucceeded(stage: ProviderStageV0, latencyMs: number): void {
    this.records.set(stage, { stage, status: "OK", latency_ms: latencyMs, category: null, error_code: null, detail: null });
    this.samples.set(stage, { last_ms: latencyMs, count: this.sampleCount(stage) + 1 });
    const slot = `${stage}:${this.turnStageCounts.get(stage) ?? 1}`;
    this.turnLatencyBySlot.set(slot, (this.turnLatencyBySlot.get(slot) ?? 0) + latencyMs);
    const location = this.locationOf(stage, this.turnStageCounts.get(stage) ?? 1);
    this.emit({
      type: "STAGE_SUCCEEDED",
      stage,
      group: location.group,
      index: location.index,
      total: location.total,
      status: "OK",
      latency_ms: latencyMs
    });
    this.options.write(`${location.prefix} done (${formatLatencyV0(latencyMs)})`);
  }

  noteFailed(stage: ProviderStageV0, latencyMs: number, error: unknown): void {
    const classified = classifyProviderFailureV0(error);
    this.records.set(stage, {
      stage,
      status: "FAILED",
      latency_ms: latencyMs,
      category: classified.category,
      error_code: classified.error_code,
      detail: classified.detail
    });
    const location = this.locationOf(stage, this.turnStageCounts.get(stage) ?? 1);
    this.emit({
      type: "STAGE_FAILED",
      stage,
      group: location.group,
      index: location.index,
      total: location.total,
      status: "FAILED",
      latency_ms: latencyMs,
      category: classified.category,
      detail: classified.detail
    });
    this.options.write(
      `${location.prefix} failed (${formatLatencyV0(latencyMs)}): ${classified.category}` +
        (this.options.debug ? ` [${classified.error_code ?? "no-code"}] ${shorten(classified.detail, 160)}` : "")
    );
  }

  /**
   * A conditional stage that lawfully did not make a model call this turn.
   * `announce` is false for stages whose skip can only be determined after later
   * stages already ran (LANGUAGE) — the skip is still recorded, shown in
   * /diagnostics and listed in the post-turn summary, just not printed
   * out-of-order mid-stream.
   */
  noteSkipped(stage: ProviderStageV0, detail: string, announce = true): void {
    this.records.set(stage, {
      stage,
      status: "SKIPPED",
      latency_ms: this.records.get(stage)?.latency_ms ?? null,
      category: null,
      error_code: null,
      detail
    });
    if (!this.turnSkipped.includes(stage)) this.turnSkipped.push(stage);
    const location = this.locationOf(stage, 1);
    this.emit({
      type: "STAGE_SKIPPED",
      stage,
      group: location.group,
      index: location.index,
      total: location.total,
      status: "SKIPPED",
      detail
    });
    if (announce) this.options.write(`${location.prefix} SKIPPED — ${detail}`);
  }

  /**
   * APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — a semantic stage that ran by
   * reusing an identical request's already-validated inference. This is NOT a
   * fake transport call: no provider latency is added, the stage still appears
   * in progress and diagnostics, and the reuse is labelled explicitly.
   */
  noteReused(stage: ProviderStageV0, detail = "inference reused (identical request within this turn)"): void {
    const occurrence = this.nextOccurrence(stage);
    const location = this.locationOf(stage, occurrence);
    this.records.set(stage, {
      stage,
      status: "REUSED",
      latency_ms: 0,
      category: null,
      error_code: null,
      detail
    });
    this.emit({
      type: "STAGE_REUSED",
      stage,
      group: location.group,
      index: location.index,
      total: location.total,
      status: "REUSED",
      latency_ms: 0,
      detail
    });
    this.options.write(`${location.prefix} inference reused (no model call)`);
  }

  /** Records a stage outcome reported after the turn (e.g. belief adaptation). */
  noteReported(stage: ProviderStageV0, status: "OK" | "FAILED" | "DISABLED" | "SKIPPED", detail: string | null): void {
    this.records.set(stage, {
      stage,
      status,
      latency_ms: this.records.get(stage)?.latency_ms ?? null,
      category: status === "FAILED" ? "PROVIDER_INTERNAL_ERROR" : null,
      error_code: null,
      detail
    });
    if (status === "SKIPPED" && !this.turnSkipped.includes(stage)) this.turnSkipped.push(stage);
    const location = this.locationOf(stage, 1);
    const event: ProviderProgressEventV0 = {
      type: "STAGE_REPORTED",
      stage,
      group: location.group,
      index: location.index,
      total: location.total,
      status,
      ...(detail === null ? {} : { detail })
    };
    this.emit(event);
  }

  /**
   * Ends the turn: clears live progress and publishes the post-turn summary for
   * successful turns. A failed turn publishes nothing extra (the existing
   * stage-aware failure summary follows) but still clears progress truthfully so
   * no nonexistent later step remains displayed.
   */
  endTurn(input: { readonly status: "COMPLETE" | "FAILED"; readonly total_ms: number | null }): void {
    const plan = this.activePlan;
    const providerMs = [...this.turnLatencyBySlot.values()].reduce((total, value) => total + value, 0);
    const replyMs =
      plan === null
        ? providerMs
        : plan.reply_stages.reduce((total, stage) => total + (this.turnLatencyBySlot.get(`${stage}:1`) ?? 0), 0);
    const priorReplyMs =
      plan === null
        ? 0
        : plan.prior_reply_stages.reduce((total, stage) => total + (this.turnLatencyBySlot.get(`${stage}:2`) ?? 0), 0);
    const timing: ProviderTurnTimingV0 = {
      status: input.status,
      total_ms: input.total_ms,
      provider_ms: providerMs,
      reply_ms: replyMs,
      prior_reply_ms: priorReplyMs,
      adaptation_ms: providerMs - replyMs - priorReplyMs,
      skipped: [...this.turnSkipped]
    };
    this.lastTurnTimingValue = timing;
    this.activePlan = null;
    this.turnLatencyBySlot = new Map();
    this.turnStageCounts = new Map();
    this.turnSkipped = [];
    this.emit({ type: input.status === "COMPLETE" ? "TURN_COMPLETED" : "TURN_FAILED", timing });
    if (input.status === "COMPLETE") this.options.write(formatTurnCompletionLineV0(timing));
  }

  last(stage: ProviderStageV0): ProviderStageRecordV0 {
    return this.records.get(stage) ?? disabled(stage);
  }

  /**
   * Structured view of the SAME records `formatLines` renders (one truth for the
   * CLI text and any visual client). Contains no prompts, user text or Memory.
   */
  snapshot(): ProviderDiagnosticsSnapshotV0 {
    return {
      model: this.options.model,
      timeout_ms: this.options.timeout_ms,
      stages: PROVIDER_STAGES_V0.map((stage) => this.last(stage)),
      samples: PROVIDER_STAGES_V0.flatMap((stage) => {
        const sample = this.samples.get(stage);
        return sample === undefined ? [] : [{ stage, last_ms: sample.last_ms, count: sample.count }];
      }),
      last_turn: this.lastTurnTimingValue
    };
  }

  formatLines(): readonly string[] {
    const lines = [
      `Provider: ${this.options.model}`,
      `Configured timeout: ${this.options.timeout_ms} ms`,
      "Stages:"
    ];
    for (const stage of PROVIDER_STAGES_V0) {
      const record = this.last(stage);
      if (record.status === "DISABLED") {
        lines.push(`  ${stage}: DISABLED (not configured)`);
        continue;
      }
      if (record.status === "CONFIGURED") {
        lines.push(`  ${stage}: CONFIGURED (not yet called)`);
        continue;
      }
      if (record.status === "REUSED") {
        lines.push(`  ${stage}: REUSED (identical request; no model inference)`);
        continue;
      }
      const latency = record.latency_ms === null ? "n/a" : formatLatencyV0(record.latency_ms);
      const category = record.category === null ? "" : ` ${record.category}`;
      const detail = record.detail === null ? "" : ` — ${shorten(record.detail, 120)}`;
      lines.push(`  ${stage}: ${record.status} latency=${latency}${category}${detail}`);
    }
    lines.push("Local latency samples (process-local, resets on restart):");
    let anySample = false;
    for (const stage of PROVIDER_STAGES_V0) {
      const sample = this.samples.get(stage);
      if (sample === undefined) continue;
      anySample = true;
      lines.push(`  ${stage}: last ${formatLatencyV0(sample.last_ms)} (${sample.count} sample(s))`);
    }
    if (this.samples.get("BELIEF_ADAPTATION") === undefined && this.last("BELIEF_ADAPTATION").status !== "DISABLED") {
      lines.push("  BELIEF_ADAPTATION: not timed (provider-internal transport)");
    }
    if (!anySample) lines.push("  none yet (no successful local call in this process)");
    if (this.lastTurnTimingValue !== null) {
      const timing = this.lastTurnTimingValue;
      const priorReply = timing.prior_reply_ms > 0 ? ` prior-reply=${formatLatencyV0(timing.prior_reply_ms)}` : "";
      lines.push(
        `Last turn timing: status=${timing.status} total=${timing.total_ms === null ? "unknown" : formatLatencyV0(timing.total_ms)} ` +
          `provider=${formatLatencyV0(timing.provider_ms)} reply=${formatLatencyV0(timing.reply_ms)}${priorReply} ` +
          `adaptation=${formatLatencyV0(timing.adaptation_ms)} skipped=${timing.skipped.join(",") || "(none)"}`
      );
    }
    lines.push("No canonical subject state is written by provider diagnostics.");
    return lines;
  }
}

export function formatLatencyV0(latencyMs: number): string {
  if (latencyMs < 1000) return `${latencyMs} ms`;
  return `${(latencyMs / 1000).toFixed(1)} s`;
}

/** Wraps ONE transport instance with a single stage label. Pass-through only. */
export function wrapTransportForStageV0(
  inner: ModelTransportV0,
  stage: ProviderStageV0,
  diagnostics: ProviderDiagnosticsV0
): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      diagnostics.noteRunning(stage);
      const started = diagnostics.now();
      try {
        const response = await inner.complete(request);
        diagnostics.noteSucceeded(stage, diagnostics.now() - started);
        return response;
      } catch (error) {
        diagnostics.noteFailed(stage, diagnostics.now() - started, error);
        throw error;
      }
    }
  } as ModelTransportV0;
}
