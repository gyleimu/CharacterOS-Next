/**
 * PRODUCT OUTPUT ROBUSTNESS V0 — TOLERANT_EXTERNAL_OUTPUT + STRICT_INTERNAL_STATE.
 *
 * WHY THIS EXISTS: the product cognition path had no tolerance for a model's
 * formatting slips. A markdown fence, a leading BOM, a bare enum string where the
 * contract wants `{kind: ...}`, or a truncated answer ended the turn terminally and
 * put the host into a permanent failed state that only a relaunch could clear. Real
 * local runs lost interactions to exactly that (truncated JSON, ordering rejections).
 *
 * THE LAW THIS MODULE ENFORCES:
 *   FORMAT MAY BE REPAIRED. MEANING MAY NEVER BE INVENTED.
 *
 * Normalization here is SEMANTICS-PRESERVING and provable by construction: it removes
 * transport/formatting noise, or maps an exactly-known equivalent representation to
 * its canonical shape. It never guesses an enum, never fills a missing field, never
 * drops a meaningful key, never invents a claim, handle, provenance or rationale, and
 * never rewrites cognition semantics. The production validator remains the sole
 * acceptance authority and is applied UNCHANGED after normalization.
 */
import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionAnyVersion } from "../../transitions/cognition-action/types.js";
import type { ConversationCognitionProposalV8 } from "../../transitions/conversation/conversation-cognition-proposal.js";
import type { FactualClaimAuthorizationTraceV0 } from "../../transitions/conversation/factual-claim-authorization.js";
import type { CommunicationDirectiveV0 } from "@characteros-next/behavior";
import { ConversationCognitionProviderV8 } from "./conversation-cognition-provider-v8.js";

/** Every normalization this module may apply, and nothing else. */
export type NormalizationKind =
  | "BOM_REMOVED"
  | "WHITESPACE_TRIMMED"
  | "MARKDOWN_FENCE_STRIPPED"
  | "SINGLE_OBJECT_EXTRACTED"
  | "KNOWN_DIRECTIVE_STRING_CANONICALIZED";

export interface NormalizationResult {
  readonly content: string;
  readonly applied: readonly NormalizationKind[];
  /** True when the content is byte-identical to the input. */
  readonly unchanged: boolean;
}

/** The only directive atoms whose bare-string form has a single lawful meaning. */
const KNOWN_DIRECTIVE_ATOMS: readonly string[] = Object.freeze(["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"]);

/**
 * Locates the single unambiguous top-level JSON object in a text that may carry
 * surrounding prose. Returns null when there is no brace-balanced object, or when
 * more than one top-level object exists (ambiguity is never guessed).
 */
function singleTopLevelObject(text: string): { readonly json: string; readonly surroundedByProse: boolean } | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index] as string;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const json = text.slice(start, index + 1);
        const hasTrailingObject = text.slice(index + 1).includes("{");
        if (hasTrailingObject) return null; // ambiguous: more than one object
        return { json, surroundedByProse: text.slice(0, start).trim().length > 0 || text.slice(index + 1).trim().length > 0 };
      }
    }
  }
  return null;
}

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Applies SEMANTICS-PRESERVING normalization. Deterministic: the same input always
 * yields the same output and the same `applied` list.
 */
export function normalizeModelContent(raw: string): NormalizationResult {
  const applied: NormalizationKind[] = [];
  let text = raw;

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    applied.push("BOM_REMOVED");
  }
  {
    const trimmed = text.trim();
    if (trimmed !== text) {
      text = trimmed;
      applied.push("WHITESPACE_TRIMMED");
    }
  }

  // One outer markdown fence: only when the fenced body itself parses as JSON.
  {
    const fenced = /^```[A-Za-z0-9_-]*\r?\n([\s\S]*?)\r?\n?```$/.exec(text);
    if (fenced !== null) {
      const body = (fenced[1] ?? "").trim();
      if (parseJsonOrNull(body) !== undefined) {
        text = body;
        applied.push("MARKDOWN_FENCE_STRIPPED");
      }
    }
  }

  // Exactly one unambiguous JSON object surrounded by prose.
  if (parseJsonOrNull(text) === undefined) {
    const found = singleTopLevelObject(text);
    if (found !== null && found.surroundedByProse && parseJsonOrNull(found.json) !== undefined) {
      text = found.json;
      applied.push("SINGLE_OBJECT_EXTRACTED");
    }
  }

  // Exactly-known equivalent representation: a KNOWN directive atom as a bare string
  // carries one lawful meaning under the frozen contract, so it is canonicalized to
  // the contract's object shape. An unknown string is NEVER repaired.
  {
    const parsed = parseJsonOrNull(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const directive = record["communication_directive"];
      if (typeof directive === "string" && KNOWN_DIRECTIVE_ATOMS.includes(directive)) {
        const canonical = JSON.stringify(
          { ...record, communication_directive: { kind: directive } },
          null,
          2
        );
        if (parseJsonOrNull(canonical) !== undefined) {
          text = canonical;
          applied.push("KNOWN_DIRECTIVE_STRING_CANONICALIZED");
        }
      }
    }
  }

  return { content: text, applied, unchanged: text === raw };
}

/** Diagnostics for one cognition attempt. Never contains a credential or a full prompt. */
export interface ExecutorOutputDiagnostic {
  readonly event:
    | "ATTEMPT_SUCCEEDED"
    | "NORMALIZED"
    | "ATTEMPT_REJECTED"
    | "REGENERATION_REQUESTED"
    | "EXECUTOR_OUTPUT_DEGRADED";
  readonly attempt: number;
  readonly executor: string;
  readonly normalization_applied: readonly NormalizationKind[];
  /** Validator-derived class only (e.g. MODEL_SCHEMA_INVALID) — never a prompt or a payload. */
  readonly failure_class: string | null;
  /** Short validator-derived detail, truncated for logging. */
  readonly detail: string | null;
}

export interface RobustCognitionPolicy {
  /** At most ONE regeneration. Frozen here; never retry-until-valid. */
  readonly max_attempts: number;
  readonly executor_id: string;
}

export const ROBUST_COGNITION_POLICY: RobustCognitionPolicy = Object.freeze({
  max_attempts: 2,
  executor_id: "product-cognition-executor"
});

/**
 * Thrown when every lawful attempt failed. It carries the validator's real output and
 * the diagnostics for observability; the caller degrades gracefully, and NO
 * cognition-derived state is written from the rejected output (pre-cognition
 * canonical processing that already happened is governed by existing session law).
 */
export class CognitionOutputDegradedError extends Error {
  readonly code = "EXECUTOR_OUTPUT_DEGRADED" as const;
  readonly failure_class: string | null;
  readonly attempts: number;
  readonly normalization_applied: readonly NormalizationKind[];
  readonly diagnostics: readonly ExecutorOutputDiagnostic[];

  constructor(input: {
    readonly failure_class: string | null;
    readonly attempts: number;
    readonly normalization_applied: readonly NormalizationKind[];
    readonly diagnostics: readonly ExecutorOutputDiagnostic[];
    readonly detail: string;
  }) {
    super(`EXECUTOR_OUTPUT_DEGRADED: ${input.detail}`);
    this.name = "CognitionOutputDegradedError";
    this.failure_class = input.failure_class;
    this.attempts = input.attempts;
    this.normalization_applied = input.normalization_applied;
    this.diagnostics = input.diagnostics;
  }
}

/** The short, machine-written feedback used for the single regeneration. */
export function regenerationFeedbackText(input: {
  readonly failure_class: string | null;
  readonly detail: string;
}): string {
  const lines = [
    "Your previous response did not satisfy the required output contract.",
    "Validation errors:"
  ];
  const detail = input.detail.replace(/\s+/g, " ").trim().slice(0, 400);
  if (detail.length > 0) lines.push(`- ${detail}`);
  else if (input.failure_class !== null) lines.push(`- ${input.failure_class}`);
  lines.push("Return the same intended answer using the required structure.");
  lines.push("Do not change the underlying semantic decision.");
  return lines.join("\n");
}

/**
 * Wraps a transport so the model's content is normalized before it can reach the
 * validator, and so a regeneration can append ONE short machine feedback turn. The
 * transport contract itself is untouched (single request per call, no retry).
 */
export function createNormalizingTransport(
  inner: ModelTransportV0,
  options: {
    readonly feedback?: string | undefined;
    readonly onNormalization?: ((applied: readonly NormalizationKind[]) => void) | undefined;
  } = {}
): ModelTransportV0 {
  return {
    async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
      const withFeedback: ModelTransportRequestV0 =
        options.feedback === undefined
          ? request
          : { ...request, messages: [...request.messages, { role: "user", content: options.feedback }] };
      const response = await inner.complete(withFeedback);
      const normalized = normalizeModelContent(response.content);
      if (!normalized.unchanged) options.onNormalization?.(normalized.applied);
      return { ...response, content: normalized.content };
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Attempt orchestration: normalize -> validate -> ONE regeneration -> degrade  */
/* -------------------------------------------------------------------------- */

/**
 * WHAT IS TOLERATED, AND WHAT IS NOT.
 *
 * TOLERATED — an OUTPUT-CONTRACT violation (`MODEL_SCHEMA_INVALID`): the model
 * answered, but what came back does not satisfy the required structure. Format
 * may be repaired, so this class gets the normalization pass and (if that is not
 * enough) exactly ONE regeneration whose prompt carries the real validator error.
 * If the second attempt is still contract-invalid, the turn DEGRADES gracefully.
 *
 * NEVER TOLERATED — everything else, unchanged from before this slice:
 *   transport/provider failures (`MODEL_TIMEOUT`, `MODEL_CONNECTION_FAILURE`,
 *   `MODEL_HTTP_FAILURE`, `MODEL_EMPTY_RESPONSE`, `MODEL_OUTPUT_TRUNCATED`)
 *   produced no usable output to validate; the product never retried them and
 *   still does not. Re-sending the identical request on a timeout is retry
 *   orchestration, not output tolerance.
 *   authority/law rejections (`FACTUAL_AUTHORIZATION_REJECTED`,
 *   `RESPONSE_SEMANTICS_REJECTED`, `INVOCATION_BINDING_INVALID`,
 *   `SEMANTIC_COMPLETENESS_FAILED`) are MEANING, not format: a well-formed
 *   proposal that violates a host law is never re-asked and never degraded — it
 *   keeps failing closed, so a semantic violation can never be converted into a
 *   softer product outcome.
 */
const TOLERATED_OUTPUT_FAILURES: readonly string[] = Object.freeze(["MODEL_SCHEMA_INVALID"]);

export interface RobustCognitionProviderV8 {
  propose(projection: CognitiveContextProjectionAnyVersion): Promise<ConversationCognitionProposalV8>;
  /** Diagnostic-only: the last attempt's factual authorization trace. */
  readonly lastFactualAuthorizationTrace: readonly FactualClaimAuthorizationTraceV0[];
  /** The last SUCCESSFUL proposal (the executor reads it after propose resolves). */
  readonly lastConversationProposal: ConversationCognitionProposalV8 | null;
  /** The last validated directive, or null. */
  readonly lastDirective: CommunicationDirectiveV0 | null;
  readonly diagnostics: readonly ExecutorOutputDiagnostic[];
  /** True once every lawful attempt failed and the caller must degrade. */
  readonly degraded: boolean;
}

function rejectionCodeOf(error: unknown): string | null {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function rejectionDetailOf(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  let detail = "";
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    detail = current.message;
    current = (current as { cause?: unknown }).cause;
  }
  return detail;
}

/**
 * The product cognition executor. It performs at most `ROBUST_COGNITION_POLICY.max_attempts`
 * attempts — never retry-until-valid — and every attempt runs the UNCHANGED production
 * validator, so a normalized output that the validator rejects is still a rejection.
 */
export function createRobustConversationCognitionProviderV8(input: {
  readonly transport: ModelTransportV0;
  readonly executorId?: string | undefined;
  readonly onDiagnostic?: ((diagnostic: ExecutorOutputDiagnostic) => void) | undefined;
  readonly maxAttempts?: number | undefined;
}): RobustCognitionProviderV8 {
  const executorId = input.executorId ?? ROBUST_COGNITION_POLICY.executor_id;
  const maxAttempts = Math.min(input.maxAttempts ?? ROBUST_COGNITION_POLICY.max_attempts, ROBUST_COGNITION_POLICY.max_attempts);
  const diagnostics: ExecutorOutputDiagnostic[] = [];
  let lastProvider: ConversationCognitionProviderV8 | null = null;

  const record = (diagnostic: ExecutorOutputDiagnostic): void => {
    diagnostics.push(diagnostic);
    input.onDiagnostic?.(diagnostic);
  };

  return {
    get lastFactualAuthorizationTrace(): readonly FactualClaimAuthorizationTraceV0[] {
      return lastProvider?.lastFactualAuthorizationTrace ?? Object.freeze([]);
    },
    get lastConversationProposal(): ConversationCognitionProposalV8 | null {
      return lastProvider?.lastConversationProposal ?? null;
    },
    get lastDirective(): CommunicationDirectiveV0 | null {
      return lastProvider?.lastDirective ?? null;
    },
    get diagnostics(): readonly ExecutorOutputDiagnostic[] {
      return diagnostics;
    },
    get degraded(): boolean {
      return diagnostics.some((entry) => entry.event === "EXECUTOR_OUTPUT_DEGRADED");
    },
    async propose(projection: ConversationCognitionProposalV8 extends never ? never : CognitiveContextProjectionAnyVersion) {
      let lastFailureClass: string | null = null;
      let lastDetail = "";
      const normalizationApplied = new Set<NormalizationKind>();

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const isFinalAttempt = attempt === maxAttempts;
        const feedback =
          attempt === 1 || lastFailureClass === null
            ? undefined
            : regenerationFeedbackText({ failure_class: lastFailureClass, detail: lastDetail });
        if (feedback !== undefined) {
          record({
            event: "REGENERATION_REQUESTED",
            attempt,
            executor: executorId,
            normalization_applied: [...normalizationApplied],
            failure_class: lastFailureClass,
            detail: lastDetail.slice(0, 200)
          });
        }
        const transport = createNormalizingTransport(input.transport, {
          feedback,
          onNormalization: (applied) => {
            for (const kind of applied) normalizationApplied.add(kind);
            record({
              event: "NORMALIZED",
              attempt,
              executor: executorId,
              normalization_applied: applied,
              failure_class: null,
              detail: null
            });
          }
        });
        const provider = new ConversationCognitionProviderV8(transport);
        lastProvider = provider;
        try {
          const proposal = await provider.propose(projection as never);
          record({
            event: "ATTEMPT_SUCCEEDED",
            attempt,
            executor: executorId,
            normalization_applied: [...normalizationApplied],
            failure_class: null,
            detail: null
          });
          return proposal;
        } catch (error) {
          lastFailureClass = rejectionCodeOf(error);
          lastDetail = rejectionDetailOf(error);
          record({
            event: "ATTEMPT_REJECTED",
            attempt,
            executor: executorId,
            normalization_applied: [...normalizationApplied],
            failure_class: lastFailureClass,
            detail: lastDetail.slice(0, 200)
          });
          if (lastFailureClass === null || !TOLERATED_OUTPUT_FAILURES.includes(lastFailureClass)) {
            // NOT an output-contract violation: no regeneration, no degradation.
            // The original failure keeps travelling exactly as it did before this
            // slice, so transport and semantic-authority outcomes are unchanged.
            throw error;
          }
          if (isFinalAttempt) {
            record({
              event: "EXECUTOR_OUTPUT_DEGRADED",
              attempt,
              executor: executorId,
              normalization_applied: [...normalizationApplied],
              failure_class: lastFailureClass,
              detail: lastDetail.slice(0, 200)
            });
            throw new CognitionOutputDegradedError({
              failure_class: lastFailureClass,
              attempts: attempt,
              normalization_applied: [...normalizationApplied],
              diagnostics: [...diagnostics],
              detail: lastDetail
            });
          }
        }
      }
      // Unreachable: the loop either returns or throws on the final attempt.
      throw new CognitionOutputDegradedError({
        failure_class: lastFailureClass,
        attempts: maxAttempts,
        normalization_applied: [...normalizationApplied],
        diagnostics: [...diagnostics],
        detail: lastDetail
      });
    }
  } as RobustCognitionProviderV8;
}

/** True when the error (or anything in its cause chain) is the degradation signal. */
export function isCognitionOutputDegraded(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (current instanceof CognitionOutputDegradedError) return true;
    if ((current as { code?: unknown }).code === "EXECUTOR_OUTPUT_DEGRADED") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
