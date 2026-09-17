/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — test support (0 model calls, 0 network).
 *
 * Shared, deterministic fixtures for the calibration tests. Everything here is
 * mock or in-memory: no test in this experiment may reach a provider, and the
 * ONLY place a network call could originate is `calibration-transport.ts`, whose
 * tests inject a mock fetch.
 *
 * This module is deliberately NOT named `calibration-*.ts`: it is test support,
 * not part of the runtime execution closure that P17 audits.
 */
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

import {
  authoritativeRequestHash,
  buildCalibrationRequest,
  serializeAuthoritativeRequest,
  type CalibrationRequestBody
} from "./calibration-request.ts";
import type {
  AuthoritativeRequest,
  CalibrationAuthority,
  DesignRederivation,
  FrozenCalibrationRequestBinding
} from "./calibration-authority.ts";
import type {
  MinimalTransport,
  TransportAttempt,
  TransportFailureClass,
  TransportResult,
  TransportUsage
} from "./calibration-transport.ts";
import { MODEL, modelConfigManifest } from "./contract.ts";
import { hashJson } from "./histories.ts";
import type { SourceFile, V0FirewallReport, WriterFirewallReport } from "./source-audit.ts";

export const TEST_HEAD = "f".repeat(40);
export const TEST_APPROVED_SHA = TEST_HEAD;

export const ZERO_USAGE: TransportUsage = {
  prompt_tokens: 0,
  completion_tokens: 0,
  cached_tokens: 0,
  reasoning_tokens: 0,
  total_tokens: 0
};

/** The REAL frozen schema hash — computed, never typed in. */
export function realSchemaHash(): string {
  return hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA);
}

/** The REAL frozen calibration request, built through the production path. */
export async function realAuthoritativeRequest(): Promise<AuthoritativeRequest> {
  const request = await buildCalibrationRequest({
    schemaHash: realSchemaHash(),
    modelConfigHash: hashJson(modelConfigManifest())
  });
  const serialized = serializeAuthoritativeRequest(request.body);
  return {
    body: request.body,
    serialized_body: serialized,
    request_hash: authoritativeRequestHash(serialized),
    hashes: { ...request.hashes }
  };
}

export const ALL_MATCH_DESIGN: DesignRederivation = {
  matches: Object.fromEntries(
    [
      "scenario_hash",
      "intervention_law_hash",
      "scan_surface_hash",
      "evaluator_hash",
      "statistical_law_hash",
      "model_config_hash",
      "calibration_request_hash",
      "trial_schedule_hash",
      "low_history_hash",
      "high_history_hash",
      "proposition_identity",
      "seed_belief_item_count",
      // POST-PARITY: the contract binding is re-derived like every other item.
      "contract_parity_hash"
    ].map((item) => [item, true])
  ),
  expected: {},
  actual: {},
  additional: {},
  all_match: true,
  mismatched: [],
  formation_attestation: { fixture: "TEST_FORMATION_ATTESTATION" }
};

export const PASSED_WRITE_SURFACE: WriterFirewallReport = {
  passed: true,
  violations: [],
  intervention_body_writer_violations: [],
  execution_closure: ["calibration-runner.ts", "calibration-transport.ts", "cli.ts"],
  missing_required_modules: [],
  offline_formation_files: ["histories.ts"],
  durable_stable: true,
  detail: "test fixture: writer-free execution closure",
  durable_measurement: { fixture: true }
};

export const PASSED_V0_FIREWALL: V0FirewallReport = {
  passed: true,
  read_or_import_violations: [],
  files_scanned: ["calibration-runner.ts", "contract.ts"],
  execution_modules_scanned: ["calibration-runner.ts"],
  declared_paths_present: true,
  declared_fragment_count: 3,
  limitation: "test fixture"
};

export interface MockAuthorityOptions {
  readonly head?: string;
  readonly manifestSha?: string;
  readonly approvedSha?: string;
  readonly treeClean?: boolean;
  readonly renderRequest?: () => Promise<AuthoritativeRequest>;
  readonly schemaHash?: () => string;
  readonly modelConfigHash?: () => string;
  readonly design?: DesignRederivation;
  readonly manifestVerification?: { readonly ok: boolean; readonly detail: string };
  readonly writeSurface?: WriterFirewallReport;
  readonly v0Firewall?: V0FirewallReport;
  readonly secretSafety?: { readonly ok: boolean; readonly failures: readonly string[]; readonly detail: string };
  readonly executionClosure?: readonly SourceFile[];
  readonly auditedSources?: readonly SourceFile[];
}

/**
 * A CalibrationAuthority whose every fact is computed by the fixture, so a test
 * can make exactly ONE fact wrong and prove that the runner refuses.
 */
export async function mockAuthority(options: MockAuthorityOptions = {}): Promise<CalibrationAuthority> {
  const request = await realAuthoritativeRequest();
  const binding: FrozenCalibrationRequestBinding = { ...request.hashes };
  const head = options.head ?? TEST_HEAD;
  const manifestSha = options.manifestSha ?? TEST_HEAD;
  const approvedSha = options.approvedSha ?? TEST_HEAD;
  return {
    approved_prereg_sha: approvedSha,
    manifest_path: "<test-manifest>",
    repo_dir: "<test-repo>",
    manifest: () => ({
      schema_version: "stochastic-executor-causal-freeze-manifest-v1",
      protocol_id: "STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0",
      preregistration_commit_sha: manifestSha,
      code_blob_hashes: {},
      design: { calibration_request: binding },
      manifest_hash: "sha256:" + "0".repeat(64)
    }),
    frozenRequestBinding: () => binding,
    currentHead: () => head,
    trackedTreeClean: () => options.treeClean ?? true,
    codeState: () => `${head}:${(options.treeClean ?? true) ? "TRACKED_TREE_CLEAN" : "TRACKED_TREE_DIRTY"}`,
    verifyManifest: () => options.manifestVerification ?? { ok: true, detail: "test fixture: manifest verified" },
    rederiveDesign: async () => options.design ?? ALL_MATCH_DESIGN,
    renderRequest: options.renderRequest ?? (async () => request),
    computeSchemaHash: options.schemaHash ?? realSchemaHash,
    computeModelConfigHash: options.modelConfigHash ?? (() => hashJson(modelConfigManifest())),
    executionClosure: () => options.executionClosure ?? [],
    auditedSources: () => options.auditedSources ?? [],
    auditWriteSurface: async () => options.writeSurface ?? PASSED_WRITE_SURFACE,
    auditV0Firewall: () => options.v0Firewall ?? PASSED_V0_FIREWALL,
    auditSecretSafety: () =>
      options.secretSafety ?? { ok: true, failures: [], detail: "test fixture: secret safety clean" }
  };
}

/* -------------------------------------------------------------------------- */
/* Proposal fixtures                                                           */
/* -------------------------------------------------------------------------- */

export function handleForObservation(userText: string): string | null {
  const handlePattern = new RegExp("^-\\s*([FC][0-9]+):\\s*(\\S+)\\s*$");
  for (const line of userText.split("\n")) {
    const match = handlePattern.exec(line.trim());
    if (match !== null && (match[2] ?? "").startsWith("observation:")) return match[1] ?? null;
    if (match !== null && (match[2] ?? "").startsWith("source:")) return match[1] ?? null;
  }
  return null;
}

export function validProposalJson(
  directive: "REALIZE_CURRENT_INTENT" | "CLARIFY_MISSING_CONTEXT" = "REALIZE_CURRENT_INTENT",
  observationHandle: string | null = null
): string {
  return JSON.stringify({
    schema_version: "conversation-cognition-proposal-v8",
    response_semantics:
      directive === "CLARIFY_MISSING_CONTEXT"
        ? { kind: "PRIMARY_CLARIFICATION" }
        : { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "calibration mock cognition",
      relevant_memory_handles: [],
      considered_handles: directive === "CLARIFY_MISSING_CONTEXT" && observationHandle !== null ? [observationHandle] : [],
      current_intent: "respond to the user",
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: null,
      evidence_handles: []
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: directive },
    clarification_basis:
      directive === "CLARIFY_MISSING_CONTEXT"
        ? { current_observation_ref: "observation:o-source-event-bcv1-current-scene-1", missing_information: "the passage state", needed_for: "planning" }
        : null
  });
}

/**
 * A schema-valid proposal that the HOST rejects: it cites a source handle that
 * was never advertised, so factual authorization fails AFTER schema validation.
 */
/**
 * A SCHEMA-VALID proposal that the HOST rejects: the directive atom is lawful and
 * every field satisfies the production schema, but the response semantics are
 * incomplete (PRIMARY_STANCE with no authoritative SUBJECTIVE_SELECTION), so
 * production validation fails AFTER schema validation with
 * RESPONSE_SEMANTICS_REJECTED. This is the reachable schema-valid/host-invalid
 * case; it is NOT a schema failure and must never be reported as one.
 */
export function hostInvalidProposalJson(): string {
  const proposal = JSON.parse(validProposalJson("REALIZE_CURRENT_INTENT")) as {
    response_semantics: unknown;
  };
  proposal.response_semantics = { kind: "PRIMARY_STANCE" };
  return JSON.stringify(proposal);
}

/**
 * A SECOND schema-valid / host-invalid case: a SOURCE_QUOTE claim citing an
 * advertised handle whose text is not in that source. Production factual
 * authorization rejects it with FACTUAL_AUTHORIZATION_REJECTED — again after
 * schema validation succeeded.
 */
export function factualInvalidProposalJson(advertisedHandle: string): string {
  const proposal = JSON.parse(validProposalJson("REALIZE_CURRENT_INTENT")) as {
    factual_assessment: { claims: unknown[] };
    response_semantics: unknown;
  };
  proposal.factual_assessment.claims = [
    {
      kind: "SOURCE_QUOTE",
      text: "This sentence appears in no source at all.",
      source_handles: [advertisedHandle]
    }
  ];
  proposal.response_semantics = { kind: "PRIMARY_FACT", claim_index: 0 };
  return JSON.stringify(proposal);
}

export type MockOutcome =
  | "VALID_REALIZE"
  | "VALID_CLARIFY"
  | "SCHEMA_INVALID"
  | "HOST_INVALID"
  | "TRANSPORT_FAIL";

export interface MockTransportOptions {
  readonly script?: readonly MockOutcome[];
  readonly defaultOutcome?: MockOutcome;
  readonly modelId?: string;
  readonly modelIdForCall?: (call: number) => string;
  /** Called AFTER a trial is handed to the transport: the test drives drift from real call counts. */
  readonly onCall?: (call: number) => void;
  /** Full control over the model content for a given call (1-based). */
  readonly contentFor?: (call: number) => string;
  readonly userText?: string;
}

export interface MockTransportHandle {
  readonly transport: MinimalTransport;
  /** Raw HTTP attempts consumed (mock attempts, never real calls). */
  attempts(): number;
  /** Logical trials offered to the transport. */
  calls(): number;
  /** The exact serialized bodies handed to the transport, in order. */
  bodies(): readonly string[];
}

export function mockTransport(options: MockTransportOptions = {}): MockTransportHandle {
  const observationHandle = options.userText === undefined ? null : handleForObservation(options.userText);
  let calls = 0;
  let attempts = 0;
  const bodies: string[] = [];
  return {
    transport: {
      id: "MOCK",
      async complete(serializedBody: string, bodyHash: string): Promise<TransportResult | { ok: false; code: string; failure_class: TransportFailureClass; detail: string; attempts: readonly TransportAttempt[] }> {
        const index = calls;
        calls += 1;
        bodies.push(serializedBody);
        options.onCall?.(index + 1);
        const outcome = options.script?.[index] ?? options.defaultOutcome ?? "VALID_REALIZE";
        const attempt: TransportAttempt = {
          attempt: 1,
          http_status: outcome === "TRANSPORT_FAIL" ? null : 200,
          failure_class: outcome === "TRANSPORT_FAIL" ? "NETWORK_ERROR" : "NO_FAILURE",
          elapsed_ms: 1,
          body_hash: bodyHash
        };
        attempts += 1;
        if (outcome === "TRANSPORT_FAIL") {
          return {
            ok: false,
            code: "TRANSPORT_NETWORK_ERROR",
            failure_class: "NETWORK_ERROR",
            detail: "mock transport failure",
            attempts: [attempt]
          };
        }
        const content =
          options.contentFor !== undefined
            ? options.contentFor(index + 1)
            : outcome === "SCHEMA_INVALID"
            ? "{ not valid json"
            : outcome === "HOST_INVALID"
              ? hostInvalidProposalJson()
              : validProposalJson(
                  outcome === "VALID_CLARIFY" ? "CLARIFY_MISSING_CONTEXT" : "REALIZE_CURRENT_INTENT",
                  observationHandle
                );
        return {
          ok: true,
          content,
          model: options.modelIdForCall?.(index + 1) ?? options.modelId ?? MODEL.id,
          usage: { prompt_tokens: 4400, completion_tokens: 3000, total_tokens: 7400, cached_tokens: 0, reasoning_tokens: 1200 },
          attempts: [attempt]
        };
      }
    },
    attempts: () => attempts,
    calls: () => calls,
    bodies: () => bodies
  };
}

/** The serialized request bytes a fresh real request would produce. */
export async function expectedSerializedBody(): Promise<string> {
  const request = await realAuthoritativeRequest();
  return request.serialized_body;
}

export type { CalibrationRequestBody };
