/* eslint-disable no-restricted-imports -- Research harness: imports frozen production roots and the frozen protocol by relative path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — execution authority (M3/M4/M5/M6).
 *
 * WHY THIS MODULE EXISTS: the audited preregistration delegated its integrity
 * gates to the CALLER. `prereg_sha_match`, `manifest_valid`, `design_rederivation`,
 * `tracked_tree_clean`, `config_hash_identity`, `schema_hash_identity`,
 * `system_hash_identity` and `user_hash_identity` were booleans handed to the
 * runner, so a caller could assert integrity it had never measured. This module
 * computes those facts from the repository, the manifest and the real runtime
 * objects, and the runner consumes only functions — never a caller assertion.
 *
 * The three authorities are INDEPENDENT and none implies another:
 *   A. blob/hash manifest verification     (`verifyManifest`)
 *   B. independent design re-derivation    (`rederiveDesign`) — 12 recomputed items
 *   C. runtime request/code-state binding   (`verifyRequestBinding`, per trial)
 *
 * Nothing in this module performs a network call, reads a credential or writes
 * any file.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";
import { ANALYSIS_LAW, DESIGN as FROZEN_DESIGN } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/contract.ts";
import {
  verifyFreezeManifest,
  type FreezeManifestShape
} from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/hashing.ts";

import { CALIBRATION_LAW } from "./calibration-law.ts";
import {
  authoritativeRequestHash,
  buildCalibrationRequest,
  serializeAuthoritativeRequest,
  type CalibrationRequestBody
} from "./calibration-request.ts";
import {
  CALIBRATION_INPUT,
  CELL_DEFINITION,
  CELL_IDS,
  CURRENT_SCENE,
  EXPERIMENT_ID,
  FROZEN_PROTOCOL_ID,
  HARD_GATE_IDS,
  MODEL,
  SAMPLE_SIZE,
  TARGET_PROPOSITION_LABEL,
  V0_FIREWALL,
  cellInterventionLawManifest,
  modelConfigManifest,
  trialSchedule
} from "./contract.ts";
import { buildBranch, hashJson, restoreBranch } from "./histories.ts";
import { applyBeliefView } from "./precheck.ts";
import { auditScanSurface } from "./scan-surface.ts";
import {
  auditInterventionWriterFree,
  auditV0DependencyFree,
  EXECUTION_CLOSURE_PATTERN,
  extractFunctionBody,
  tokenHitsInCode,
  REQUIRED_EXECUTION_MODULES,
  stripCommentsForAudit,
  type SourceFile,
  type V0FirewallReport,
  type WriterFirewallReport
} from "./source-audit.ts";

/* -------------------------------------------------------------------------- */
/* Failure codes (frozen vocabulary)                                           */
/* -------------------------------------------------------------------------- */

export const SCIENTIFIC_CODE_STATE_MISMATCH = "SCIENTIFIC_CODE_STATE_MISMATCH" as const;
export const CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH = "CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH" as const;
export const CALIBRATION_SYSTEM_HASH_DRIFT = "CALIBRATION_SYSTEM_HASH_DRIFT" as const;
export const CALIBRATION_USER_HASH_DRIFT = "CALIBRATION_USER_HASH_DRIFT" as const;
export const CALIBRATION_SCHEMA_HASH_DRIFT = "CALIBRATION_SCHEMA_HASH_DRIFT" as const;
export const CALIBRATION_MODEL_CONFIG_HASH_DRIFT = "CALIBRATION_MODEL_CONFIG_HASH_DRIFT" as const;
export const CALIBRATION_TRACKED_TREE_DIRTY = "CALIBRATION_TRACKED_TREE_DIRTY" as const;
export const CALIBRATION_MANIFEST_INVALID = "CALIBRATION_MANIFEST_INVALID" as const;
export const CALIBRATION_DESIGN_REDERIVATION_MISMATCH = "CALIBRATION_DESIGN_REDERIVATION_MISMATCH" as const;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** The five frozen hashes the manifest binds for the calibration request. */
export interface FrozenCalibrationRequestBinding {
  readonly system_hash: string;
  readonly user_hash: string;
  readonly schema_hash: string;
  readonly model_config_hash: string;
  readonly model_facing_request_hash: string;
}

/** A request RE-RENDERED from the real runtime objects, with its authoritative bytes. */
export interface AuthoritativeRequest {
  readonly body: CalibrationRequestBody;
  /** THE authoritative byte stream: `canonicalJson(body)`, sent verbatim. */
  readonly serialized_body: string;
  /** `hashText(serialized_body)` — the hash of the bytes that go on the wire. */
  readonly request_hash: string;
  readonly hashes: FrozenCalibrationRequestBinding;
}

export interface DesignRederivation {
  readonly matches: Readonly<Record<string, boolean>>;
  readonly expected: Readonly<Record<string, unknown>>;
  readonly actual: Readonly<Record<string, unknown>>;
  readonly additional: Readonly<Record<string, unknown>>;
  readonly all_match: boolean;
  readonly mismatched: readonly string[];
  readonly formation_attestation: Readonly<Record<string, unknown>>;
}

export interface AuthorityCheck {
  readonly ok: boolean;
  readonly failures: readonly string[];
  readonly detail: string;
}

export interface CodeStateCheck extends AuthorityCheck {
  readonly current_head: string;
  readonly manifest_prereg_sha: string;
  readonly approved_prereg_sha: string;
  readonly tracked_tree_clean: boolean;
  readonly code_state: string;
}

export interface RequestBindingCheck extends AuthorityCheck {
  readonly request: AuthoritativeRequest;
  readonly expected: FrozenCalibrationRequestBinding;
}

/**
 * Everything the runner and the CLI may learn about the frozen world. Every
 * member is a FUNCTION: no integrity claim is ever handed in as a boolean.
 */
export interface CalibrationAuthority {
  readonly approved_prereg_sha: string;
  readonly manifest_path: string;
  readonly repo_dir: string;
  manifest(): FreezeManifestShape & Record<string, unknown>;
  frozenRequestBinding(): FrozenCalibrationRequestBinding;
  currentHead(): string;
  trackedTreeClean(): boolean;
  codeState(): string;
  verifyManifest(): { readonly ok: boolean; readonly detail: string };
  rederiveDesign(): Promise<DesignRederivation>;
  renderRequest(): Promise<AuthoritativeRequest>;
  computeSchemaHash(): string;
  computeModelConfigHash(): string;
  /** Runtime execution modules (calibration-*.ts + cli.ts), enumerated from disk. */
  executionClosure(): readonly SourceFile[];
  /** Every non-test `.ts` source of this experiment — the P22 audit surface. */
  auditedSources(): readonly SourceFile[];
  auditWriteSurface(): Promise<WriterFirewallReport>;
  auditV0Firewall(): V0FirewallReport;
  auditSecretSafety(): AuthorityCheck;
}

export const EXPERIMENT_DIR_NAME = "belief-causal-confirmatory-stochastic-v1";

export { EXECUTION_CLOSURE_PATTERN, REQUIRED_EXECUTION_MODULES };

/* -------------------------------------------------------------------------- */
/* Real git reads — the runner reads these itself                              */
/* -------------------------------------------------------------------------- */

export function readGitHead(repoDir: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
}

/**
 * TRACKED worktree cleanliness (`--untracked-files=no`): untracked scratch
 * artifacts (evidence, manifests under tmp/) never invalidate a run, but any
 * modification of a TRACKED file does.
 */
export function readTrackedTreeClean(repoDir: string): boolean {
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: repoDir,
    encoding: "utf8"
  });
  return status.trim().length === 0;
}

export function codeStateOf(head: string, trackedTreeClean: boolean): string {
  return `${head}:${trackedTreeClean ? "TRACKED_TREE_CLEAN" : "TRACKED_TREE_DIRTY"}`;
}

/* -------------------------------------------------------------------------- */
/* Design re-derivation (M4)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The 12 independently recomputed design items, compared item by item against
 * the manifest. `histories` is re-formed through the REAL production path — not
 * read back from the evidence file — so the comparison is a re-derivation, not a
 * copy.
 */
export async function deriveCalibrationDesignFromAuthority(evidenceRoot: string): Promise<{
  readonly derived: Readonly<Record<string, unknown>>;
  readonly formation_attestation: Readonly<Record<string, unknown>>;
}> {
  const low = await buildBranch("LOW");
  const high = await buildBranch("HIGH");
  const scan = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA));
  const request = await buildCalibrationRequest({
    schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
    modelConfigHash: hashJson(modelConfigManifest())
  });
  const derived = {
    // 1 scenario
    scenario_hash: hashJson(CURRENT_SCENE),
    // 2 intervention law
    intervention_law_hash: hashJson(cellInterventionLawManifest()),
    // 3 scan surface
    scan_surface_hash: hashJson({
      surface: scan.exact_scan_surface,
      opaque_refs: scan.opaque_ref_leaves,
      enum_leaves: scan.enum_leaves,
      structural_leaves: scan.structural_leaves,
      unscanned: scan.unscanned_model_authored_semantic_text,
      schema_hash: scan.schema_hash
    }),
    // 4 evaluator
    evaluator_hash: hashJson({ gate_ids: HARD_GATE_IDS, cells: CELL_IDS, model: MODEL.id }),
    // 5 statistical law — derived from the FROZEN protocol constants, never literals
    statistical_law_hash: hashJson({
      law: ANALYSIS_LAW.primary,
      delta_min: FROZEN_DESIGN.delta_min,
      epsilon: FROZEN_DESIGN.epsilon,
      alpha_superiority: FROZEN_DESIGN.alpha_superiority,
      alpha_equivalence: FROZEN_DESIGN.alpha_equivalence
    }),
    // 6 model config
    model_config_hash: hashJson(modelConfigManifest()),
    // 7 calibration request (all five bound hashes)
    calibration_request: {
      system_hash: request.hashes.system_hash,
      user_hash: request.hashes.user_hash,
      schema_hash: request.hashes.schema_hash,
      model_config_hash: request.hashes.model_config_hash,
      model_facing_request_hash: request.hashes.model_facing_request_hash
    },
    // 8 trial schedule
    trial_schedule_hash: hashJson({
      primary: trialSchedule("PRIMARY"),
      replication: trialSchedule("REPLICATION")
    }),
    // 9/10 the two history branches, re-formed through the real production path
    low_history_hash: hashJson(low),
    high_history_hash: hashJson(high),
    // 11 proposition identity
    proposition_identity: {
      target_label: TARGET_PROPOSITION_LABEL,
      low: low.proposition,
      high: high.proposition
    },
    // 12 seed belief count
    seed_belief_item_count: [low.seed_belief_item_count, high.seed_belief_item_count],
    calibration_input_hash: hashJson(CALIBRATION_INPUT),
    calibration_law_hash: hashJson(CALIBRATION_LAW),
    protocol_id: FROZEN_PROTOCOL_ID,
    experiment_id: EXPERIMENT_ID,
    sample_size: SAMPLE_SIZE,
    cell_definition: CELL_DEFINITION
  } as const;
  const formation_attestation = {
    low_progression: low.progression,
    high_progression: high.progression,
    expected_low_progression: low.expected_progression,
    expected_high_progression: high.expected_progression,
    low_progression_exact: JSON.stringify(low.progression) === JSON.stringify(low.expected_progression),
    high_progression_exact: JSON.stringify(high.progression) === JSON.stringify(high.expected_progression),
    low_commit_chain: low.commit_chain,
    high_commit_chain: high.commit_chain,
    low_repository_digest: low.repository_digest,
    high_repository_digest: high.repository_digest,
    same_proposition_identity:
      low.proposition.proposition_key === high.proposition.proposition_key &&
      low.proposition.proposition_id === high.proposition.proposition_id &&
      low.proposition.canonical_label === TARGET_PROPOSITION_LABEL,
    evidence_root: evidenceRoot,
    formation: "REAL_PRODUCTION_PATH_RE_RUN_IN_MEMORY"
  };
  return { derived, formation_attestation };
}

function compareDesign(
  derived: Record<string, unknown>,
  design: Record<string, unknown>
): { matches: Record<string, boolean>; expected: Record<string, unknown>; actual: Record<string, unknown> } {
  const expected: Record<string, unknown> = {};
  const actual: Record<string, unknown> = {};
  const matches: Record<string, boolean> = {};
  const histories = (design["histories"] ?? {}) as Record<string, unknown>;
  const frozenRequest = (design["calibration_request"] ?? {}) as Record<string, unknown>;
  const derivedRequest = derived["calibration_request"] as Record<string, unknown>;
  const record = (item: string, manifestValue: unknown, derivedValue: unknown): void => {
    expected[item] = manifestValue;
    actual[item] = derivedValue;
    matches[item] = JSON.stringify(manifestValue) === JSON.stringify(derivedValue);
  };
  record("scenario_hash", design["scenario_hash"], derived["scenario_hash"]);
  record("intervention_law_hash", design["intervention_law_hash"], derived["intervention_law_hash"]);
  record("scan_surface_hash", design["scan_surface_hash"], derived["scan_surface_hash"]);
  record("evaluator_hash", design["evaluator_hash"], derived["evaluator_hash"]);
  record("statistical_law_hash", design["statistical_law_hash"], derived["statistical_law_hash"]);
  record("model_config_hash", design["model_config_hash"], derived["model_config_hash"]);
  record("calibration_request_hash", frozenRequest["model_facing_request_hash"], derivedRequest["model_facing_request_hash"]);
  record("trial_schedule_hash", design["trial_schedule_hash"], derived["trial_schedule_hash"]);
  record("low_history_hash", histories["low_hash"], derived["low_history_hash"]);
  record("high_history_hash", histories["high_hash"], derived["high_history_hash"]);
  record(
    "proposition_identity",
    { low: histories["low_proposition"], high: histories["high_proposition"] },
    (derived["proposition_identity"] as Record<string, unknown>)["low"] === undefined
      ? undefined
      : {
          low: (derived["proposition_identity"] as Record<string, unknown>)["low"],
          high: (derived["proposition_identity"] as Record<string, unknown>)["high"]
        }
  );
  record("seed_belief_item_count", design["seed_belief_item_count"], derived["seed_belief_item_count"]);
  return { matches, expected, actual };
}

/* -------------------------------------------------------------------------- */
/* The concrete authority                                                      */
/* -------------------------------------------------------------------------- */

export interface GitAuthorityInput {
  readonly approvedPreregSha: string;
  readonly manifestPath: string;
  readonly repoDir: string;
  readonly experimentDir: string;
  /** Test seams ONLY — production leaves these unset and reads git and the schema. */
  readonly overrides?: {
    readonly currentHead?: () => string;
    readonly trackedTreeClean?: () => boolean;
    readonly renderRequest?: () => Promise<AuthoritativeRequest>;
    readonly computeSchemaHash?: () => string;
    readonly computeModelConfigHash?: () => string;
    readonly rederiveDesign?: () => Promise<DesignRederivation>;
    readonly executionClosure?: () => readonly SourceFile[];
    readonly auditedSources?: () => readonly SourceFile[];
    readonly auditWriteSurface?: () => Promise<WriterFirewallReport>;
    readonly auditV0Firewall?: () => V0FirewallReport;
    readonly auditSecretSafety?: () => AuthorityCheck;
  };
}

export function createGitCalibrationAuthority(input: GitAuthorityInput): CalibrationAuthority {
  const manifest = JSON.parse(readFileSync(input.manifestPath, "utf8")) as FreezeManifestShape & Record<string, unknown>;
  const readHead = input.overrides?.currentHead ?? ((): string => readGitHead(input.repoDir));
  const readClean = input.overrides?.trackedTreeClean ?? ((): boolean => readTrackedTreeClean(input.repoDir));
  const frozenRequestBinding = (): FrozenCalibrationRequestBinding => {
    const design = (manifest.design ?? {}) as Record<string, unknown>;
    const bound = (design["calibration_request"] ?? {}) as Record<string, unknown>;
    return {
      system_hash: String(bound["system_hash"] ?? ""),
      user_hash: String(bound["user_hash"] ?? ""),
      schema_hash: String(bound["schema_hash"] ?? ""),
      model_config_hash: String(bound["model_config_hash"] ?? ""),
      model_facing_request_hash: String(bound["model_facing_request_hash"] ?? "")
    };
  };
  const computeSchemaHash = input.overrides?.computeSchemaHash ?? ((): string => hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA));
  const computeModelConfigHash = input.overrides?.computeModelConfigHash ?? ((): string => hashJson(modelConfigManifest()));
  const renderRequest = async (): Promise<AuthoritativeRequest> => {
    if (input.overrides?.renderRequest !== undefined) return await input.overrides.renderRequest();
    const request = await buildCalibrationRequest({
      schemaHash: computeSchemaHash(),
      modelConfigHash: computeModelConfigHash()
    });
    const serialized = serializeAuthoritativeRequest(request.body);
    return {
      body: request.body,
      serialized_body: serialized,
      request_hash: authoritativeRequestHash(serialized),
      hashes: request.hashes
    };
  };
  const executionClosure = input.overrides?.executionClosure ?? ((): readonly SourceFile[] => readExecutionClosure(input.experimentDir));
  const auditedSources = input.overrides?.auditedSources ?? ((): readonly SourceFile[] => readExperimentSources(input.experimentDir));
  let rederivation: Promise<DesignRederivation> | null = null;
  const rederiveDesign = async (): Promise<DesignRederivation> => {
    if (input.overrides?.rederiveDesign !== undefined) return await input.overrides.rederiveDesign();
    rederivation ??= (async (): Promise<DesignRederivation> => {
      const { derived, formation_attestation } = await deriveCalibrationDesignFromAuthority(input.experimentDir);
      const design = (manifest.design ?? {}) as Record<string, unknown>;
      const comparison = compareDesign({ ...derived }, design);
      const mismatched = Object.entries(comparison.matches)
        .filter(([, equal]) => !equal)
        .map(([item]) => item);
      return {
        matches: comparison.matches,
        expected: comparison.expected,
        actual: comparison.actual,
        additional: {
          calibration_input_hash: design["calibration_input_hash"] === derived["calibration_input_hash"],
          calibration_law_hash: design["calibration_law_hash"] === derived["calibration_law_hash"],
          protocol_id: design["protocol_id"] === derived["protocol_id"],
          experiment_id: design["experiment_id"] === derived["experiment_id"],
          sample_size: JSON.stringify(design["sample_size"]) === JSON.stringify(derived["sample_size"]),
          cell_definition: JSON.stringify(design["cell_definition"]) === JSON.stringify(derived["cell_definition"])
        },
        all_match: mismatched.length === 0,
        mismatched,
        formation_attestation
      };
    })();
    return await rederivation;
  };
  return {
    approved_prereg_sha: input.approvedPreregSha,
    manifest_path: input.manifestPath,
    repo_dir: input.repoDir,
    manifest: () => manifest,
    frozenRequestBinding,
    currentHead: readHead,
    trackedTreeClean: readClean,
    codeState: () => codeStateOf(readHead(), readClean()),
    verifyManifest: () => verifyFreezeManifest(input.repoDir, manifest),
    rederiveDesign,
    renderRequest,
    computeSchemaHash,
    computeModelConfigHash,
    executionClosure,
    auditedSources,
    auditWriteSurface: input.overrides?.auditWriteSurface ?? (() => auditRuntimeWriteSurface(input.experimentDir, executionClosure())),
    auditV0Firewall: input.overrides?.auditV0Firewall ?? (() => auditRuntimeV0Firewall(auditedSources())),
    auditSecretSafety: input.overrides?.auditSecretSafety ?? (() => auditSecretSafety(executionClosure()))
  };
}

/* -------------------------------------------------------------------------- */
/* Real source enumeration + the two firewalls                                 */
/* -------------------------------------------------------------------------- */

/** Every `.ts` source in this experiment except tests: the audited surface. */
export function readExperimentSources(experimentDir: string): readonly SourceFile[] {
  return readdirSync(experimentDir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort()
    .map((name) => ({ file: name, code: readFileSync(join(experimentDir, name), "utf8") }));
}

/** The runtime execution closure: calibration-*.ts + cli.ts, enumerated from disk. */
export function readExecutionClosure(experimentDir: string): readonly SourceFile[] {
  return readdirSync(experimentDir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && EXECUTION_CLOSURE_PATTERN.test(name))
    .sort()
    .map((name) => ({ file: name, code: readFileSync(join(experimentDir, name), "utf8") }));
}

/**
 * P17 — TWO independent facts, both MEASURED:
 *   (a) no writer/commit token exists in the enumerated execution closure
 *       (calibration-*.ts + cli.ts, read from disk — never a hardcoded list);
 *   (b) durable belief items hash identically before and after every
 *       research-side cell view is applied to a re-formed branch pair.
 * The formation path is allowed to hold writer call sites: it is offline
 * preparation, it is listed explicitly in the report, and it is never reachable
 * from the network path.
 */
export async function auditRuntimeWriteSurface(
  experimentDir: string,
  closure: readonly SourceFile[]
): Promise<WriterFirewallReport> {
  const precheckSource = stripCommentsForAudit(readFileSync(join(experimentDir, "precheck.ts"), "utf8"));
  const interventionBody = extractFunctionBody(precheckSource, "function applyBeliefView(");
  const renderBody = extractFunctionBody(precheckSource, "async function renderRequest(");
  const offlineFormationFiles = readExperimentSources(experimentDir)
    .filter((entry) => !closure.some((candidate) => candidate.file === entry.file))
    .filter((entry) => {
      const code = stripCommentsForAudit(entry.code);
      return code.includes("runForEpisodeRefs") || code.includes("BeliefTransitionExecutor") || code.includes("commitReserved");
    })
    .map((entry) => entry.file);

  const low = await buildBranch("LOW");
  const high = await buildBranch("HIGH");
  const lowRestored = await restoreBranch(low);
  const highRestored = await restoreBranch(high);
  const highItem = highRestored.snapshot.beliefs.items[0];
  const targetPropositionId = String(highItem?.proposition_id ?? "");
  const highCredence = Number(highItem?.credence ?? 0);
  const durableBefore = {
    low: hashJson(lowRestored.snapshot.beliefs.items),
    high: hashJson(highRestored.snapshot.beliefs.items)
  };
  const applied: string[] = [];
  for (const cell of CELL_IDS) {
    const definition = CELL_DEFINITION[cell];
    const base = definition.durable === "LOW" ? lowRestored.snapshot : highRestored.snapshot;
    applyBeliefView(base as never, definition.intervention, targetPropositionId, highCredence);
    applied.push(cell);
  }
  const durableAfter = {
    low: hashJson(lowRestored.snapshot.beliefs.items),
    high: hashJson(highRestored.snapshot.beliefs.items)
  };
  return {
    ...auditInterventionWriterFree({
      interventionBody,
      renderBody,
      executionClosure: closure,
      requiredExecutionModules: REQUIRED_EXECUTION_MODULES,
      offlineFormationFiles,
      durableBefore,
      durableAfter
    }),
    durable_measurement: {
      cells_applied: applied,
      durable_before: durableBefore,
      durable_after: durableAfter,
      target_proposition_id: targetPropositionId,
      high_credence: highCredence
    }
  } as WriterFirewallReport;
}

export function auditRuntimeV0Firewall(sources: readonly SourceFile[]): V0FirewallReport {
  return auditV0DependencyFree({
    files: sources,
    declaredFirewallPaths: V0_FIREWALL.forbidden_reads,
    executionModulePattern: EXECUTION_CLOSURE_PATTERN,
    requireDeclaredFirewall: true
  });
}

export function auditSecretSafety(closure: readonly SourceFile[]): AuthorityCheck {
  const failures: string[] = [];
  const transport = closure.find((entry) => entry.file === "calibration-transport.ts");
  if (transport === undefined) failures.push("CALIBRATION_TRANSPORT_NOT_IN_CLOSURE");
  const evidence = closure.find((entry) => entry.file === "calibration-evidence.ts");
  if (evidence === undefined) failures.push("CALIBRATION_EVIDENCE_NOT_IN_CLOSURE");
  if (transport !== undefined) {
    const code = stripCommentsForAudit(transport.code);
    if (!code.includes("authorization: `Bearer ${apiKey}`")) failures.push("TRANSPORT_CREDENTIAL_BINDING_MISSING");
    for (const forbidden of ["console.", "process.stdout", "process.stderr"]) {
      if (code.includes(forbidden)) failures.push(`TRANSPORT_LOGGING_SURFACE:${forbidden}`);
    }
  }
  if (evidence !== undefined) {
    const code = stripCommentsForAudit(evidence.code);
    if (/\bapiKey\b|\bbearer\b/i.test(code)) failures.push("EVIDENCE_CREDENTIAL_SURFACE");
    if (/\bsk-/.test(code)) failures.push("EVIDENCE_CREDENTIAL_PATTERN");
    if (code.includes("fetch(")) failures.push("EVIDENCE_NETWORK_SURFACE");
  }
  // The ENVIRONMENT may be read in exactly one module — the CLI host — and the
  // credential value must be passed onward as an opaque argument: no other
  // module may reach for the environment at all.
  // Code-only occurrence: this module NAMES the pattern it forbids, and a
  // vocabulary string is not an environment read.
  const envReaders = closure
    .filter((entry) => tokenHitsInCode(stripCommentsForAudit(entry.code), "process" + ".env").length > 0)
    .map((entry) => entry.file);
  if (envReaders.length !== 1 || envReaders[0] !== "cli.ts") {
    failures.push(`CREDENTIAL_ENV_READER_NOT_UNIQUE:${envReaders.join(",")}`);
  }
  const envValueReaders = closure
    .filter((entry) => /env\s*\[/.test(stripCommentsForAudit(entry.code)))
    .map((entry) => entry.file)
    .filter((file) => file !== "cli.ts");
  if (envValueReaders.length > 0) failures.push(`CREDENTIAL_ENV_DEREFERENCE_OUTSIDE_CLI:${envValueReaders.join(",")}`);
  return {
    ok: failures.length === 0,
    failures,
    detail:
      "credential surface: the environment is read in exactly one module (cli.ts) and the key is passed as an opaque value; the transport binds it only in the Authorization header, has no logging surface, and the evidence schema carries no credential or network surface"
  };
}

/** Declared V0 firewall paths come from the contract itself — never duplicated here. */

/* -------------------------------------------------------------------------- */
/* The three independent authority checks                                      */
/* -------------------------------------------------------------------------- */

/**
 * THREE-WAY LAW: CURRENT_GIT_HEAD == MANIFEST.preregistration_commit_sha ==
 * APPROVED_PREREG_SHA. The approved SHA is an EXTERNAL authorization value and is
 * never hardcoded in this source tree.
 */
export function verifyCodeStateAuthority(authority: CalibrationAuthority): CodeStateCheck {
  const failures: string[] = [];
  const currentHead = authority.currentHead();
  const manifestSha = String(authority.manifest()["preregistration_commit_sha"] ?? "");
  const approved = authority.approved_prereg_sha;
  if (currentHead !== manifestSha) failures.push(`${SCIENTIFIC_CODE_STATE_MISMATCH}:HEAD!=MANIFEST`);
  if (currentHead !== approved) failures.push(`${SCIENTIFIC_CODE_STATE_MISMATCH}:HEAD!=APPROVED_PREREG_SHA`);
  if (manifestSha !== approved) failures.push(`${SCIENTIFIC_CODE_STATE_MISMATCH}:MANIFEST!=APPROVED_PREREG_SHA`);
  const clean = authority.trackedTreeClean();
  if (!clean) failures.push(CALIBRATION_TRACKED_TREE_DIRTY);
  return {
    ok: failures.length === 0,
    failures,
    detail:
      failures.length === 0
        ? `HEAD == manifest == approved (${currentHead.slice(0, 12)}…), tracked tree clean`
        : `code-state authority failed: ${failures.join(", ")}`,
    current_head: currentHead,
    manifest_prereg_sha: manifestSha,
    approved_prereg_sha: approved,
    tracked_tree_clean: clean,
    code_state: codeStateOf(currentHead, clean)
  };
}

/**
 * RUNTIME REQUEST BINDING: re-render the request from the real runtime objects
 * and compare EVERY hash the manifest froze — the whole body hash first, then the
 * system/user/schema/model-config components.
 */
export async function verifyRequestBinding(authority: CalibrationAuthority): Promise<RequestBindingCheck> {
  const expected = authority.frozenRequestBinding();
  const request = await authority.renderRequest();
  const failures: string[] = [];
  if (request.request_hash !== expected.model_facing_request_hash) {
    failures.push(CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH);
  }
  if (request.hashes.system_hash !== expected.system_hash) failures.push(CALIBRATION_SYSTEM_HASH_DRIFT);
  if (request.hashes.user_hash !== expected.user_hash) failures.push(CALIBRATION_USER_HASH_DRIFT);
  if (authority.computeSchemaHash() !== expected.schema_hash) failures.push(CALIBRATION_SCHEMA_HASH_DRIFT);
  if (authority.computeModelConfigHash() !== expected.model_config_hash) failures.push(CALIBRATION_MODEL_CONFIG_HASH_DRIFT);
  // The authoritative bytes must hash to the runtime-derived hash: FROZEN ==
  // RUNTIME VERIFIED == the bytes handed to the transport.
  if (authoritativeRequestHash(request.serialized_body) !== request.request_hash) {
    failures.push(`${CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH}:SERIALIZATION_NOT_SELF_CONSISTENT`);
  }
  return {
    ok: failures.length === 0,
    failures,
    detail:
      failures.length === 0
        ? `runtime request bytes hash to the frozen model-facing request hash (${request.request_hash.slice(0, 22)}…)`
        : `runtime request binding failed: ${failures.join(", ")}`,
    request,
    expected
  };
}

export interface ExecutionPreflight {
  readonly ok: boolean;
  readonly failures: readonly string[];
  readonly code_state: CodeStateCheck;
  readonly manifest_verification: { readonly ok: boolean; readonly detail: string };
  readonly design_rederivation: DesignRederivation;
  readonly request_binding: RequestBindingCheck;
  readonly write_surface: WriterFirewallReport;
  readonly v0_firewall: V0FirewallReport;
  readonly secret_safety: AuthorityCheck;
}

/**
 * Steps 1–9 of the formal preflight order: code state, manifest, independent
 * design re-derivation, request binding, then the P17 and P22 firewalls. Any
 * failure here means ZERO network calls.
 */
export async function verifyExecutionAuthority(authority: CalibrationAuthority): Promise<ExecutionPreflight> {
  const codeState = verifyCodeStateAuthority(authority);
  const manifestVerification = authority.verifyManifest();
  const rederivation = await authority.rederiveDesign();
  const requestBinding = await verifyRequestBinding(authority);
  const writeSurface = await authority.auditWriteSurface();
  const v0Firewall = authority.auditV0Firewall();
  const secretSafety = authority.auditSecretSafety();
  const failures: string[] = [
    ...codeState.failures,
    ...(manifestVerification.ok ? [] : [CALIBRATION_MANIFEST_INVALID]),
    ...(rederivation.all_match ? [] : [CALIBRATION_DESIGN_REDERIVATION_MISMATCH]),
    ...requestBinding.failures,
    ...(writeSurface.passed ? [] : ["CALIBRATION_P17_WRITE_SURFACE_VIOLATION"]),
    ...(v0Firewall.passed ? [] : ["CALIBRATION_P22_V0_FIREWALL_VIOLATION"]),
    ...(secretSafety.ok ? [] : ["CALIBRATION_SECRET_SAFETY_VIOLATION"])
  ];
  return {
    ok: failures.length === 0,
    failures,
    code_state: codeState,
    manifest_verification: { ok: manifestVerification.ok, detail: manifestVerification.detail },
    design_rederivation: rederivation,
    request_binding: requestBinding,
    write_surface: writeSurface,
    v0_firewall: v0Firewall,
    secret_safety: secretSafety
  };
}

/** The per-trial pre-call gate: code state + the full request/hash binding. */
export async function verifyTrialPreCall(authority: CalibrationAuthority): Promise<{
  readonly ok: boolean;
  readonly failures: readonly string[];
  readonly request_binding: RequestBindingCheck;
  readonly code_state: CodeStateCheck;
}> {
  const codeState = verifyCodeStateAuthority(authority);
  const requestBinding = await verifyRequestBinding(authority);
  const failures = [...codeState.failures, ...requestBinding.failures];
  return { ok: failures.length === 0, failures, request_binding: requestBinding, code_state: codeState };
}
