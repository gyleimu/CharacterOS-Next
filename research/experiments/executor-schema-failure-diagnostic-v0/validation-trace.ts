/* eslint-disable no-restricted-imports -- Research harness: calls FROZEN PRODUCTION validators and the production provider by relative dist path. */
/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — multi-stage validation trace.
 *
 * Every stage below calls the REAL production code and records its REAL output.
 * Nothing here re-implements, approximates or "improves" a validator, and no
 * explanation of a failure is generated: the raw `detail` string and the factual
 * authorization trace are stored verbatim.
 *
 * IMPORTANT STAGING HONESTY: in production the model-response path makes exactly
 * ONE contract-checking call — `canonicalizeConversationCognitionModelOutputV8` —
 * which internally covers closed keys, schema version, the nested V7 contract, the
 * factual-authority trace and the response-semantics atom. The provider then
 * classifies its failure. Stages D and E below are therefore a MECHANICAL
 * PROJECTION of that single call using the PROVIDER'S OWN classification rule
 * (factual trace rejected → host authority; `SEMANTIC_COMPLETENESS_FAILED:` →
 * response semantics; otherwise → schema/contract), and the ground truth for
 * every trial is recorded separately as `production_pipeline_verdict`, captured
 * by running the real `ConversationCognitionProviderV8` end to end.
 *
 * `validateConversationCognitionProposalV8` is deliberately NOT used as a stage:
 * production does not call it on model output (it is the host-bound validator and
 * additionally requires a projection binding the model never authors), so using
 * it would manufacture a rejection that production would never produce.
 */
import { ConversationCognitionProviderV8 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import {
  canonicalizeConversationCognitionModelOutputV8,
  type FactualClaimAuthorizationTraceV0
} from "../../../packages/runtime/dist/index.js";

import { ALLOWED_DIRECTIVE_ATOMS } from "../belief-causal-confirmatory-stochastic-v1/calibration-law.ts";

import { PRODUCTION_VALIDATOR_STRUCTURED_FIELDS_EXPOSED, PRODUCTION_VALIDATOR_SURFACE_NOTE } from "./contract.ts";

export type StageOutcome = "PASS" | "FAIL" | "NOT_REACHED";

export interface MechanicallySplitDetail {
  /** VERBATIM production output — always the authority. */
  readonly raw: string;
  /** Mechanical slice of `raw` before the first ": " — never an interpretation. */
  readonly path_prefix: string | null;
  /** Mechanical remainder of `raw`. */
  readonly rule_text: string;
  /** Mechanical prefix test for the production semantics marker. */
  readonly semantic_completeness_marker: boolean;
  readonly structured_fields: "NOT_EXPOSED_BY_PRODUCTION_VALIDATOR";
  readonly extraction: "MECHANICAL_SLICE_OF_PRODUCTION_STRING";
}

export function splitProductionDetail(detail: string): MechanicallySplitDetail {
  const separator = detail.indexOf(": ");
  const prefix = separator < 0 ? null : detail.slice(0, separator);
  // The production path prefix contains spaces ("conversation proposal.cognition.x"),
  // so it is recognised as the leading dotted locator rather than by a strict
  // identifier test — still a purely mechanical test of the production string.
  const looksLikePath =
    prefix !== null && prefix.includes(".") && /^[A-Za-z_][A-Za-z0-9_.[\]* ]*$/.test(prefix);
  return {
    raw: detail,
    path_prefix: looksLikePath ? prefix : null,
    rule_text: separator < 0 ? detail : detail.slice(separator + 2),
    semantic_completeness_marker: detail.startsWith("SEMANTIC_COMPLETENESS_FAILED"),
    structured_fields: "NOT_EXPOSED_BY_PRODUCTION_VALIDATOR",
    extraction: "MECHANICAL_SLICE_OF_PRODUCTION_STRING"
  };
}

export interface FactualTraceEntry {
  readonly status: string;
  readonly rejection_code: string | null;
  readonly claim_kind: string | null;
  readonly operation: string | null;
  readonly canonical_source_refs: readonly string[];
  readonly raw_claim: unknown;
}

export interface ValidationTrace {
  readonly STAGE_A_TRANSPORT: StageOutcome;
  readonly STAGE_B_ENVELOPE_JSON: StageOutcome;
  readonly STAGE_C_CONTENT_JSON: StageOutcome;
  readonly STAGE_D_PRODUCTION_SCHEMA: StageOutcome;
  readonly STAGE_E_PRODUCTION_HOST_AUTHORITY: StageOutcome;
  readonly STAGE_F_DIRECTIVE_ADMISSIBILITY: StageOutcome;
  readonly stage_details: {
    readonly transport: unknown;
    readonly envelope: { readonly json_valid: boolean; readonly error: string | null; readonly keys: readonly string[] };
    readonly content_json: { readonly valid: boolean; readonly error: string | null; readonly parsed_type: string };
    readonly production_schema: { readonly ok: boolean; readonly detail: MechanicallySplitDetail | null };
    readonly production_host_authority: {
      readonly ok: boolean;
      readonly detail: MechanicallySplitDetail | null;
      readonly factual_authorization_trace: readonly FactualTraceEntry[];
      readonly factual_rejection_codes: readonly string[];
      readonly response_semantics_rejected: boolean;
    };
    readonly directive_admissibility: {
      readonly directive: string | null;
      readonly allowed_atoms: readonly string[];
      readonly admissible: boolean;
      readonly rule: "RUNNER_LEVEL_ATOM_ADMISSIBILITY";
    };
  };
  /**
   * Ground truth: what the REAL production provider throws for this exact
   * response, captured by running it end to end.
   */
  readonly production_pipeline_verdict: {
    readonly threw: boolean;
    readonly code: string | null;
    readonly message: string | null;
    readonly factual_authorization_trace: readonly FactualTraceEntry[];
    readonly directive: string | null;
  };
  readonly validator_surface: {
    readonly structured_fields_exposed: typeof PRODUCTION_VALIDATOR_STRUCTURED_FIELDS_EXPOSED;
    readonly note: string;
  };
}

function traceEntries(trace: readonly FactualClaimAuthorizationTraceV0[]): readonly FactualTraceEntry[] {
  return trace.map((entry) => ({
    status: String(entry.status),
    rejection_code: entry.rejection_code === null ? null : String(entry.rejection_code),
    claim_kind: entry.claim_kind === null ? null : String(entry.claim_kind),
    operation: entry.operation === null ? null : String(entry.operation),
    canonical_source_refs: entry.canonical_source_refs.map((ref) => String(ref)),
    raw_claim: entry.raw_claim
  }));
}

/**
 * Runs the stages against ONE captured response.
 *
 * @param projection the frozen calibration projection the request was rendered from
 */
export async function buildValidationTrace(input: {
  readonly transportStage: StageOutcome;
  readonly transportDetail: unknown;
  readonly envelopeJsonValid: boolean;
  readonly envelopeJsonError: string | null;
  readonly envelopeKeys: readonly string[];
  readonly content: string | null;
  readonly projection: unknown;
}): Promise<ValidationTrace> {
  // ---- STAGE B: provider envelope ------------------------------------------
  const stageB: StageOutcome = input.envelopeJsonValid ? "PASS" : "FAIL";

  // ---- STAGE C: message.content is strict JSON ------------------------------
  let parsedContent: unknown = null;
  let contentJsonValid = false;
  let contentJsonError: string | null = null;
  if (input.content === null || input.transportStage !== "PASS") {
    return {
      STAGE_A_TRANSPORT: input.transportStage,
      STAGE_B_ENVELOPE_JSON: stageB,
      STAGE_C_CONTENT_JSON: "NOT_REACHED",
      STAGE_D_PRODUCTION_SCHEMA: "NOT_REACHED",
      STAGE_E_PRODUCTION_HOST_AUTHORITY: "NOT_REACHED",
      STAGE_F_DIRECTIVE_ADMISSIBILITY: "NOT_REACHED",
      stage_details: {
        transport: input.transportDetail,
        envelope: { json_valid: input.envelopeJsonValid, error: input.envelopeJsonError, keys: input.envelopeKeys },
        content_json: { valid: false, error: "content not available", parsed_type: "unavailable" },
        production_schema: { ok: false, detail: null },
        production_host_authority: { ok: false, detail: null, factual_authorization_trace: [], factual_rejection_codes: [], response_semantics_rejected: false },
        directive_admissibility: { directive: null, allowed_atoms: ALLOWED_DIRECTIVE_ATOMS, admissible: false, rule: "RUNNER_LEVEL_ATOM_ADMISSIBILITY" }
      },
      production_pipeline_verdict: { threw: false, code: null, message: null, factual_authorization_trace: [], directive: null },
      validator_surface: {
        structured_fields_exposed: PRODUCTION_VALIDATOR_STRUCTURED_FIELDS_EXPOSED,
        note: PRODUCTION_VALIDATOR_SURFACE_NOTE
      }
    };
  }
  try {
    parsedContent = JSON.parse(input.content);
    contentJsonValid = true;
  } catch (error) {
    contentJsonError = error instanceof Error ? error.message : "unknown JSON syntax failure";
  }

  // ---- STAGE D/E: the production contract call, split by the provider's rule --
  let productionDetail: string | null = null;
  let factualTrace: readonly FactualTraceEntry[] = [];
  let stageD: StageOutcome = "NOT_REACHED";
  let stageE: StageOutcome = "NOT_REACHED";
  let factualRejectionCodes: readonly string[] = [];
  let semanticsRejected = false;
  let directive: string | null = null;
  let schemaOk = false;
  let hostOk = false;

  if (contentJsonValid) {
    // The projection hash is what the production request was rendered from; the
    // brand is a compile-time marker on a value production itself produces. A
    // missing hash is a DIAGNOSTIC wiring error, never a staged rejection: fail
    // loudly rather than manufacture a schema failure that production would not
    // produce.
    const rawProjectionHash = (input.projection as { projection_hash?: unknown } | null)?.projection_hash;
    if (typeof rawProjectionHash !== "string" || rawProjectionHash.length === 0) {
      throw new Error("DIAGNOSTIC_PROJECTION_HASH_UNAVAILABLE: the frozen projection carries no projection_hash");
    }
    const checked = canonicalizeConversationCognitionModelOutputV8(
      parsedContent,
      input.projection as never,
      rawProjectionHash as never
    );
    factualTrace = traceEntries(checked.factual_authorization_trace);
    factualRejectionCodes = factualTrace
      .map((entry) => entry.rejection_code)
      .filter((code): code is string => code !== null);
    if (checked.ok) {
      stageD = "PASS";
      stageE = "PASS";
      schemaOk = true;
      hostOk = true;
      directive = String((checked.proposal as { communication_directive?: { kind?: unknown } }).communication_directive?.kind ?? "") || null;
    } else {
      productionDetail = checked.detail;
      semanticsRejected = checked.detail.startsWith("SEMANTIC_COMPLETENESS_FAILED");
      // The PROVIDER'S OWN classification rule, applied to the SAME call:
      if (factualRejectionCodes.length > 0) {
        stageD = "PASS";
        stageE = "FAIL";
      } else if (semanticsRejected) {
        stageD = "PASS";
        stageE = "FAIL";
      } else {
        stageD = "FAIL";
        stageE = "NOT_REACHED";
      }
    }
  }

  // ---- STAGE F: runner-level directive admissibility -------------------------
  const directiveAdmissible = directive !== null && ALLOWED_DIRECTIVE_ATOMS.includes(directive);
  const stageF: StageOutcome = directive === null ? "NOT_REACHED" : directiveAdmissible ? "PASS" : "FAIL";

  // ---- GROUND TRUTH: the real provider, end to end ---------------------------
  const provider = new ConversationCognitionProviderV8({
    complete: async () => ({ content: input.content ?? "", model: "diagnostic" })
  } as never);
  let verdictThrew = false;
  let verdictCode: string | null = null;
  let verdictMessage: string | null = null;
  let verdictTrace: readonly FactualTraceEntry[] = [];
  let verdictDirective: string | null = directive;
  try {
    const proposal = await provider.propose(input.projection as never);
    verdictDirective = String(proposal.communication_directive.kind);
  } catch (error) {
    verdictThrew = true;
    verdictCode = (error as { code?: string }).code ?? "HOST_VALIDATION_REJECTED";
    verdictMessage = error instanceof Error ? error.message : String(error);
    verdictTrace = traceEntries(((error as { factual_authorization_trace?: readonly FactualClaimAuthorizationTraceV0[] })
      .factual_authorization_trace ?? []) as readonly FactualClaimAuthorizationTraceV0[]);
  }

  return {
    STAGE_A_TRANSPORT: input.transportStage,
    STAGE_B_ENVELOPE_JSON: stageB,
    STAGE_C_CONTENT_JSON: contentJsonValid ? "PASS" : "FAIL",
    STAGE_D_PRODUCTION_SCHEMA: stageD,
    STAGE_E_PRODUCTION_HOST_AUTHORITY: stageE,
    STAGE_F_DIRECTIVE_ADMISSIBILITY: stageF,
    stage_details: {
      transport: input.transportDetail,
      envelope: { json_valid: input.envelopeJsonValid, error: input.envelopeJsonError, keys: input.envelopeKeys },
      content_json: {
        valid: contentJsonValid,
        error: contentJsonError,
        parsed_type: parsedContent === null ? "null" : Array.isArray(parsedContent) ? "array" : typeof parsedContent
      },
      production_schema: { ok: schemaOk, detail: productionDetail === null ? null : splitProductionDetail(productionDetail) },
      production_host_authority: {
        ok: hostOk,
        detail: productionDetail === null ? null : splitProductionDetail(productionDetail),
        factual_authorization_trace: factualTrace,
        factual_rejection_codes: factualRejectionCodes,
        response_semantics_rejected: semanticsRejected
      },
      directive_admissibility: {
        directive,
        allowed_atoms: ALLOWED_DIRECTIVE_ATOMS,
        admissible: directiveAdmissible,
        rule: "RUNNER_LEVEL_ATOM_ADMISSIBILITY"
      }
    },
    production_pipeline_verdict: {
      threw: verdictThrew,
      code: verdictCode,
      message: verdictMessage,
      factual_authorization_trace: verdictTrace,
      directive: verdictDirective
    },
    validator_surface: {
      structured_fields_exposed: PRODUCTION_VALIDATOR_STRUCTURED_FIELDS_EXPOSED,
      note: PRODUCTION_VALIDATOR_SURFACE_NOTE
    }
  };
}
