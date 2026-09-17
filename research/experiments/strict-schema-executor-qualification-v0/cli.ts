/**
 * STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0 — tracked CLI.
 *
 *   qualification-preflight   the frozen rubric, the registry and the budget: 0 calls
 *   qualification-run         Gate S for every candidate that CAN be tested
 *
 * Credentials are read from the environment only, are never printed or stored, and an
 * absent credential marks exactly that candidate NOT_TESTED_NO_CREDENTIAL — it never
 * blocks the remaining candidates.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANDIDATES,
  GATE_C_PLAN,
  GATE_S_RUBRIC,
  MAX_CALLS_PER_CANDIDATE,
  MAX_TOTAL_CANDIDATE_CALLS,
  QUALIFICATION_MARKERS,
  QUALIFICATION_NAMESPACE,
  type CandidateDefinition
} from "./contract.ts";
import {
  assembleArtifact,
  hashJson,
  QUALIFICATION_RUBRIC_HASH,
  runCandidateQualification,
  type CandidateQualificationResult,
  type QualificationArtifact
} from "./runner.ts";
import {
  createOllamaGrammarTransport,
  createStrictOpenAiTransport,
  OLLAMA_LOCAL_BASE_URL,
  type QualificationTransport
} from "./transport.ts";

export const MODEL_API_KEY_ENV = "MODEL_API_KEY" as const;
const STRICT_RESPONSE_FORMAT = Object.freeze({
  type: "json_schema",
  json_schema: Object.freeze({ name: "characteros_gate_s", strict: true })
});

export interface QualificationCliDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Test seam: built only for candidates that CAN be tested. */
  readonly transportFactory?: ((candidate: CandidateDefinition) => QualificationTransport | null) | undefined;
  readonly writeArtifact?: ((path: string, text: string) => void) | undefined;
  readonly maxCallsPerCandidate?: number | undefined;
  /** Reused frozen negative-control evidence; never a new probe. */
  readonly negativeControlNote?: string | undefined;
}

function credentialFor(candidate: CandidateDefinition, env: Readonly<Record<string, string | undefined>>): boolean {
  if (candidate.credential_env === null) return true;
  return (env[candidate.credential_env] ?? "").trim().length > 0;
}

/**
 * Builds the transport for a candidate that can be tested. The formal executor's
 * DeepSeek endpoint is NEVER contacted here: its negative-control evidence is frozen.
 */
function defaultTransportFactory(
  candidate: CandidateDefinition,
  env: Readonly<Record<string, string | undefined>>
): QualificationTransport | null {
  if (candidate.role === "NEGATIVE_STRUCTURAL_CONTROL") return null;
  if (candidate.id === "ollama-local") return createOllamaGrammarTransport(OLLAMA_LOCAL_BASE_URL, candidate.model);
  if (candidate.credential_env === null) return null;
  const apiKey = (env[candidate.credential_env] ?? "").trim();
  if (apiKey.length === 0) return null;
  // External strict-schema candidates: an OpenAI-compatible research transport with
  // the strict response_format. Base URLs are provider-specific and are supplied by
  // the operator when a credential exists.
  const baseUrl = (env[`${candidate.credential_env}_BASE_URL`] ?? "").trim();
  if (baseUrl.length === 0) return null;
  return createStrictOpenAiTransport(apiKey, baseUrl, candidate.model, STRICT_RESPONSE_FORMAT);
}

export interface QualificationPreflightReport {
  readonly schema_version: "strict-schema-executor-qualification-preflight-v0";
  readonly namespace: typeof QUALIFICATION_NAMESPACE;
  readonly markers: typeof QUALIFICATION_MARKERS;
  readonly rubric: typeof GATE_S_RUBRIC;
  readonly rubric_hash: string;
  readonly candidates: readonly {
    readonly id: string;
    readonly role: string;
    readonly provider: string;
    readonly model: string;
    readonly credential_env: string | null;
    readonly credential_available: boolean;
    readonly testable_in_this_slice: boolean;
  }[];
  readonly budget: { readonly per_candidate: number; readonly total: number };
  readonly gate_c_plan: typeof GATE_C_PLAN;
  readonly model_calls: 0;
  readonly network_calls: 0;
}

export function qualificationPreflight(deps: QualificationCliDeps): QualificationPreflightReport {
  const factory = deps.transportFactory ?? ((candidate: CandidateDefinition) => defaultTransportFactory(candidate, deps.env));
  return {
    schema_version: "strict-schema-executor-qualification-preflight-v0",
    namespace: QUALIFICATION_NAMESPACE,
    markers: QUALIFICATION_MARKERS,
    rubric: GATE_S_RUBRIC,
    rubric_hash: QUALIFICATION_RUBRIC_HASH,
    candidates: CANDIDATES.map((candidate) => {
      const credentialAvailable = credentialFor(candidate, deps.env);
      const testable = candidate.role === "NEGATIVE_STRUCTURAL_CONTROL" ? false : credentialAvailable && factory(candidate) !== null;
      return {
        id: candidate.id,
        role: candidate.role,
        provider: candidate.provider,
        model: candidate.model,
        credential_env: candidate.credential_env,
        credential_available: credentialAvailable,
        testable_in_this_slice: testable
      };
    }),
    budget: { per_candidate: MAX_CALLS_PER_CANDIDATE, total: MAX_TOTAL_CANDIDATE_CALLS },
    gate_c_plan: GATE_C_PLAN,
    model_calls: 0,
    network_calls: 0
  };
}

export interface QualificationRunReport {
  readonly verdict: "QUALIFICATION_RUN_COMPLETE";
  readonly artifact: QualificationArtifact;
  readonly artifact_path: string;
  readonly artifact_hash: string;
  readonly total_candidate_calls: number;
  readonly candidates_eligible_for_gate_c: readonly string[];
  readonly formal_executor_changed: false;
  readonly new_prereg_created: false;
  readonly calibration_calls: 0;
  readonly primary_authorized: false;
}

export async function qualificationRun(
  input: { readonly artifactOut: string },
  deps: QualificationCliDeps
): Promise<QualificationRunReport> {
  const factory = deps.transportFactory ?? ((candidate: CandidateDefinition) => defaultTransportFactory(candidate, deps.env));
  const results: CandidateQualificationResult[] = [];
  for (const candidate of CANDIDATES.slice(0, 3 + 2)) {
    const credentialAvailable = credentialFor(candidate, deps.env);
    const isNegativeControl = candidate.role === "NEGATIVE_STRUCTURAL_CONTROL";
    const transport = isNegativeControl ? null : factory(candidate);
    if (!credentialAvailable || (transport === null && !isNegativeControl)) {
      results.push({
        candidate,
        credential_available: credentialAvailable,
        calls: 0,
        structural_cases: [],
        criteria: { S1: null, S2: null, S3: null, S4: null, S5: null, S6: null, S7: true, S8: true, S9: true, S10: null },
        full_v8_schema_accepted: null,
        max_length_semantics: "UNVERIFIED",
        host_repair_used: false,
        retries: 0,
        structural_gate: "NOT_TESTED_NO_CREDENTIAL",
        note:
          candidate.credential_env === null
            ? "no transport could be constructed for this candidate in this environment"
            : `credential ${candidate.credential_env} is absent from the process environment; this candidate is skipped WITHOUT blocking the others`
      });
      continue;
    }
    results.push(
      await runCandidateQualification({
        candidate,
        transport,
        credentialAvailable,
        priorEvidence:
          deps.negativeControlNote === undefined
            ? undefined
            : { strictFeatureUnavailable: true, note: deps.negativeControlNote },
        maxCalls: deps.maxCallsPerCandidate
      })
    );
  }

  const artifact = assembleArtifact(results);
  const { artifact_hash: _ignored, ...core } = artifact;
  void _ignored;
  const artifactHash = hashJson(core);
  const writer =
    deps.writeArtifact ??
    ((path: string, text: string): void => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    });
  writer(input.artifactOut, `${JSON.stringify({ ...core, artifact_hash: artifactHash }, null, 2)}\n`);
  const eligible = results.filter((result) => result.structural_gate === "STRUCTURAL_GATE_PASS").map((result) => result.candidate.id);
  return {
    verdict: "QUALIFICATION_RUN_COMPLETE",
    artifact: { ...core, artifact_hash: artifactHash },
    artifact_path: input.artifactOut,
    artifact_hash: artifactHash,
    total_candidate_calls: artifact.total_candidate_calls,
    candidates_eligible_for_gate_c: eligible,
    formal_executor_changed: false,
    new_prereg_created: false,
    calibration_calls: 0,
    primary_authorized: false
  };
}

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "";
  if (command === "qualification-preflight") {
    const report = qualificationPreflight({ env: process.env });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    const reportOut = flagValue(args, "--report-out");
    if (reportOut !== undefined) {
      mkdirSync(dirname(reportOut), { recursive: true });
      writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
    }
    process.stderr.write(`qualification-preflight: ${report.candidates.filter((c) => c.testable_in_this_slice).length} testable candidate(s), 0 calls\n`);
    return;
  }
  if (command === "qualification-run") {
    const artifactOut = flagValue(args, "--artifact-out");
    if (artifactOut === undefined || !args.includes("--authorize-qualification")) {
      process.stderr.write("usage: cli.ts qualification-run --artifact-out <PATH> --authorize-qualification\n");
      process.exitCode = 2;
      return;
    }
    const report = await qualificationRun(
      { artifactOut },
      {
        env: process.env,
        negativeControlNote:
          "frozen capability-probe evidence: response_format {type: json_schema} → HTTP 400 invalid_request_error \"This response_format type is unavailable now\" (tmp/probe/structured-output-capability-probe-v0.json)"
      }
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          verdict: report.verdict,
          total_candidate_calls: report.total_candidate_calls,
          candidates_eligible_for_gate_c: report.candidates_eligible_for_gate_c,
          gates: report.artifact.candidates.map((candidate) => ({ id: candidate.candidate.id, gate: candidate.structural_gate, calls: candidate.calls })),
          artifact_path: report.artifact_path,
          artifact_hash: report.artifact_hash,
          formal_executor_changed: report.formal_executor_changed,
          primary_authorized: report.primary_authorized
        },
        null,
        2
      )}\n`
    );
    process.stderr.write(`qualification-run complete: ${report.total_candidate_calls} candidate calls (ceiling ${MAX_TOTAL_CANDIDATE_CALLS})\n`);
    return;
  }
  process.stderr.write("usage: cli.ts <qualification-preflight|qualification-run --artifact-out <PATH> --authorize-qualification>\n");
  process.exitCode = 2;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) await main();
