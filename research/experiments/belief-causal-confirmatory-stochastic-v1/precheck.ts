/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — deterministic precheck (P1–P24).
 *
 * ZERO model calls. Everything here is offline and reproducible: the two real
 * histories, authoritative restore, the four-cell model-facing request rendering,
 * the exact scan surface, the branch-isolation audit, the V0 firewall, the
 * missing-blob verifier regression and the calibration-path audits. A single
 * failing precheck means the preregistration is NOT ready.
 *
 * §39 remediation: the UNSCANNED check is a REAL set difference between an
 * independent schema enumeration and the declared surface, P17 is a measured
 * caller-graph + immutability audit, and P22 scans this experiment's own sources
 * for V0-artifact reads. The pure audit helpers are exported so negative-control
 * tests can prove each check can FAIL.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V8 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import {
  CONFLATION_LAW,
  DESIGN,
  SAMPLING
} from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/contract.ts";
import { classifyTruthConflation } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/conflation.ts";
import { manifestHashOf, verifyFreezeManifest } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/hashing.ts";

import {
  CELL_DEFINITION,
  CELL_IDS,
  CURRENT_SCENE,
  FORBIDDEN_MODEL_FACING_LABELS,
  HARD_GATE_IDS,
  HIGH_EPISODES,
  LOW_EPISODES,
  SAMPLE_SIZE,
  SLICE_CALL_ATTESTATION,
  TARGET_PROPOSITION_LABEL,
  V0_FIREWALL,
  replicateRange,
  trialSchedule,
  type CellId
} from "./contract.ts";
import {
  branchIsolationAudit,
  buildBranch,
  check,
  hashJson,
  hashText,
  restoreBranch,
  type HistoryBundle,
  type RestoredBranch
} from "./histories.ts";
import { auditScanSurface } from "./scan-surface.ts";
import { deriveConfirmatoryVerdict, type VerdictInput } from "./verdict.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { buildCognitiveContextProjection } = await import(
  `${runtimeDist}transitions/cognition-action/cognition-action-transition-executor.js`
);
const { buildConversationSubjectDataV4 } = await import(
  `${runtimeDist}providers/behavior/conversation-cognition-provider-v6.js`
);

export interface PrecheckResult {
  readonly ok: boolean;
  readonly failed: readonly string[];
  readonly checks: Readonly<Record<string, { readonly passed: boolean; readonly detail: unknown }>>;
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function experimentDirForAudit(): string {
  return fileURLToPath(new URL(".", import.meta.url));
}

/** Comments are irrelevant to a dependency audit; only code counts. */
function stripCommentsForAudit(source: string): string {
  const slash = 47;
  const star = 42;
  const lineFeed = 10;
  let out = "";
  let index = 0;
  while (index < source.length) {
    const code = source.charCodeAt(index);
    if (code === slash && source.charCodeAt(index + 1) === star) {
      index += 2;
      while (index < source.length && !(source.charCodeAt(index) === star && source.charCodeAt(index + 1) === slash)) index += 1;
      index += 2;
      out += " ";
      continue;
    }
    if (code === slash && source.charCodeAt(index + 1) === slash) {
      while (index < source.length && source.charCodeAt(index) !== lineFeed) index += 1;
      continue;
    }
    out += source[index];
    index += 1;
  }
  return out;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Model-facing belief-view intervention (§12/§35): read-only, never a durable write. */
function applyBeliefView(
  snapshot: SubjectStateV4,
  intervention: "NONE" | "ABLATE_TARGET" | "EQUALIZE_TARGET_TO_HIGH",
  targetPropositionId: string,
  highCredence: number
): SubjectStateV4 {
  if (intervention === "NONE") return snapshot;
  if (intervention === "ABLATE_TARGET") {
    return {
      ...snapshot,
      beliefs: {
        ...snapshot.beliefs,
        items: snapshot.beliefs.items.filter((item) => (item.proposition_id as string) !== targetPropositionId)
      }
    } as unknown as SubjectStateV4;
  }
  return {
    ...snapshot,
    beliefs: {
      ...snapshot.beliefs,
      items: snapshot.beliefs.items.map((item) =>
        (item.proposition_id as string) === targetPropositionId
          ? { ...item, credence: highCredence as never }
          : item
      )
    }
  } as unknown as SubjectStateV4;
}

async function renderRequest(snapshot: SubjectStateV4): Promise<{ system: string; user: string; projection_hash: string }> {
  const projection = await buildCognitiveContextProjection(snapshot as never);
  return {
    system: CONVERSATION_COGNITION_SYSTEM_PROMPT_V8,
    user: buildConversationSubjectDataV4(projection as never),
    projection_hash: (projection as { projection_hash: string }).projection_hash
  };
}

function normalizeNonBelief(user: string): string {
  const start = user.indexOf("[SUBJECTIVE BELIEF STANCES");
  const end = start < 0 ? -1 : user.indexOf("\n[relationships]", start);
  const withoutBelief = start >= 0 && end > start ? `${user.slice(0, start)}${user.slice(end)}` : user;
  return withoutBelief.replace(new RegExp("\\[projection_hash\\] \\S+"), "[projection_hash] <normalized>");
}

/* -------------------------------------------------------------------------- */
/* PURE audit helpers (exported for negative-control tests)                    */
/* -------------------------------------------------------------------------- */

/**
 * P17 audit: the model-facing intervention and render bodies must contain no
 * writer/commit token, the calibration path must not reach a writer call site,
 * and the durable belief items must be byte-identical before and after the
 * research-side views.
 */
export function auditInterventionWriterFree(input: {
  readonly interventionBody: string;
  readonly renderBody: string;
  readonly writerCallSiteFiles: readonly string[];
  readonly durableBefore: { readonly low: string; readonly high: string };
  readonly durableAfter: { readonly low: string; readonly high: string };
}): { readonly passed: boolean; readonly violations: readonly string[] } {
  const writerTokens = ["commitReserved", "reserveAndRoute", "terminalizeReservedNoOp", "writeBelief"];
  const violations = writerTokens.filter(
    (token) => input.interventionBody.includes(token) || input.renderBody.includes(token)
  );
  const calibrationTouchesWriter =
    input.writerCallSiteFiles.includes("calibration-runner.ts") ||
    input.writerCallSiteFiles.includes("calibration-request.ts");
  const durableStable =
    input.durableBefore.low === input.durableAfter.low && input.durableBefore.high === input.durableAfter.high;
  return {
    passed:
      violations.length === 0 &&
      input.interventionBody.length > 0 &&
      input.renderBody.length > 0 &&
      !calibrationTouchesWriter &&
      durableStable,
    violations
  };
}

/**
 * P22 audit: a V0 outcome artifact may appear ONLY as a declared firewall entry
 * in contract.ts; any read or import of one fails.
 */
export function auditV0DependencyFree(input: {
  readonly files: readonly { readonly file: string; readonly code: string }[];
  readonly declaredFirewallPaths: readonly string[];
}): {
  readonly passed: boolean;
  readonly readOrImportViolations: readonly { readonly file: string; readonly fragment: string }[];
} {
  const fragments = ["belief-causal-validation-v0/evidence", "V0_PRIMARY", "V0_REPLICATION"];
  const readOrImportViolations: { file: string; fragment: string }[] = [];
  let calibrationScanned = false;
  for (const entry of input.files) {
    if (entry.file === "calibration-runner.ts") calibrationScanned = true;
    for (const fragment of fragments) {
      let from = 0;
      for (;;) {
        const at = entry.code.indexOf(fragment, from);
        if (at < 0) break;
        from = at + fragment.length;
        const lineStart = entry.code.lastIndexOf("\n", at) + 1;
        const lineEnd = entry.code.indexOf("\n", at);
        const line = entry.code.slice(lineStart, lineEnd < 0 ? entry.code.length : lineEnd);
        const isRead =
          line.includes("readFileSync") || line.includes("require(") || line.includes("import ") || line.includes("from ");
        const isDeclaration =
          entry.file === "contract.ts" &&
          input.declaredFirewallPaths.some((declared) =>
            line.includes(declared.split("/").slice(-1)[0] as string)
          );
        if (isRead && !isDeclaration) readOrImportViolations.push({ file: entry.file, fragment });
      }
    }
  }
  return { passed: readOrImportViolations.length === 0 && calibrationScanned, readOrImportViolations };
}

/* -------------------------------------------------------------------------- */
/* precheck                                                                   */
/* -------------------------------------------------------------------------- */

export async function runPrecheck(evidenceDir: string, repoDir: string): Promise<PrecheckResult> {
  const checks: Record<string, { passed: boolean; detail: unknown }> = {};
  const record = (id: string, passed: boolean, detail: unknown): void => {
    checks[id] = { passed, detail };
  };

  // ---- histories through the REAL production formation path -------------------
  const low: HistoryBundle = await buildBranch("LOW");
  const high: HistoryBundle = await buildBranch("HIGH");
  writeJson(join(evidenceDir, "history-low.json"), low);
  writeJson(join(evidenceDir, "history-high.json"), high);

  record("P1_SEED_BELIEF_COUNT_ZERO", low.seed_belief_item_count === 0 && high.seed_belief_item_count === 0, {
    low: low.seed_belief_item_count,
    high: high.seed_belief_item_count
  });
  record("P2_LOW_FORMATION_PROGRESSION", JSON.stringify(low.progression) === JSON.stringify([0.55, 0.5, 0.45]), low.progression);
  record(
    "P3_HIGH_FORMATION_PROGRESSION",
    JSON.stringify(high.progression) === JSON.stringify([0.55, 0.6000000000000001, 0.6500000000000001]),
    high.progression
  );
  record(
    "P4_SAME_PROPOSITION_IDENTITY",
    low.proposition.proposition_key === high.proposition.proposition_key &&
      low.proposition.canonical_label === high.proposition.canonical_label &&
      low.proposition.canonical_label === TARGET_PROPOSITION_LABEL &&
      low.proposition.proposition_id === high.proposition.proposition_id,
    { low: low.proposition, high: high.proposition }
  );

  const isolation = branchIsolationAudit(low, high);
  writeJson(join(evidenceDir, "branch-isolation.json"), isolation as unknown as Record<string, unknown>);
  record("P5_BRANCH_ISOLATION", isolation.isolated, isolation);

  // ---- authoritative restore of both branches --------------------------------
  const lowBranch: RestoredBranch = await restoreBranch(low);
  const highBranch: RestoredBranch = await restoreBranch(high);
  writeJson(join(evidenceDir, "restore-attestation.json"), {
    low: lowBranch.restore,
    high: highBranch.restore,
    low_belief_items: lowBranch.snapshot.beliefs.items,
    high_belief_items: highBranch.snapshot.beliefs.items
  });

  // ---- §17 non-belief current-state equality ---------------------------------
  const nonBelief = (snapshot: SubjectStateV4): unknown => ({
    affect: snapshot.affect,
    regulation: snapshot.regulation,
    relationships: snapshot.relationships,
    personality: snapshot.personality,
    traits_seed: snapshot.traits_seed,
    context: snapshot.context,
    memory_state: snapshot.memory_state,
    identity: snapshot.identity,
    logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  });
  const nonBeliefLow = hashJson(nonBelief(lowBranch.snapshot));
  const nonBeliefHigh = hashJson(nonBelief(highBranch.snapshot));
  record("P6_NON_BELIEF_CANONICAL_EQUALITY", nonBeliefLow === nonBeliefHigh, { nonBeliefLow, nonBeliefHigh });
  record("P9_RELATIONSHIP_EQUALITY", hashJson(lowBranch.snapshot.relationships) === hashJson(highBranch.snapshot.relationships), {});
  record("P10_AFFECT_EQUALITY", hashJson(lowBranch.snapshot.affect) === hashJson(highBranch.snapshot.affect), {});
  record("P11_PERSONALITY_EQUALITY", hashJson(lowBranch.snapshot.personality) === hashJson(highBranch.snapshot.personality), {});

  // ---- four-cell model-facing requests ---------------------------------------
  const highItem = highBranch.snapshot.beliefs.items[0];
  check(highItem !== undefined, "HIGH branch holds exactly one belief item");
  const targetPropositionId = highItem.proposition_id as string;
  const highCredence = highItem.credence as number;
  const rendered: Record<
    CellId,
    { system: string; user: string; belief: string; nonBelief: string; projection_hash: string }
  > = {} as never;
  for (const cell of CELL_IDS) {
    const definition = CELL_DEFINITION[cell];
    const base = definition.durable === "LOW" ? lowBranch.snapshot : highBranch.snapshot;
    const withObservableContext = {
      ...base,
      context: {
        ...base.context,
        scene: `${CURRENT_SCENE.observed_utterance_prefix}${CURRENT_SCENE.text}"`,
        task: CURRENT_SCENE.task
      }
    } as SubjectStateV4;
    const view = applyBeliefView(withObservableContext, definition.intervention, targetPropositionId, highCredence);
    const request = await renderRequest(view);
    const start = request.user.indexOf("[SUBJECTIVE BELIEF STANCES");
    const end = request.user.indexOf("\n[relationships]", start);
    check(start >= 0 && end > start, `belief section present for ${cell}`);
    rendered[cell] = {
      system: request.system,
      user: request.user,
      belief: request.user.slice(start, end),
      nonBelief: hashText(normalizeNonBelief(request.user)),
      projection_hash: request.projection_hash
    };
  }
  writeJson(join(evidenceDir, "rendered-requests.json"), {
    schema_version: "bcv1-rendered-requests-v0",
    cells: Object.fromEntries(
      CELL_IDS.map((cell) => [
        cell,
        {
          system_hash: hashText(rendered[cell].system),
          user_hash: hashText(rendered[cell].user),
          belief_section_hash: hashText(rendered[cell].belief),
          non_belief_user_hash: rendered[cell].nonBelief,
          projection_hash: rendered[cell].projection_hash,
          belief_section: rendered[cell].belief
        }
      ])
    )
  });

  // ---- §15/§16/§51 firewalls --------------------------------------------------
  const historyRefs = [...LOW_EPISODES.map((entry) => entry.ref), ...HIGH_EPISODES.map((entry) => entry.ref)];
  const historyScenes = [...LOW_EPISODES, ...HIGH_EPISODES].map((entry) => entry.scene);
  const leakedRefs = CELL_IDS.flatMap((cell) => historyRefs.filter((ref) => rendered[cell].user.includes(ref)));
  const leakedScenes = CELL_IDS.flatMap((cell) => historyScenes.filter((scene) => rendered[cell].user.includes(scene)));
  const leakedLabels = CELL_IDS.flatMap((cell) =>
    FORBIDDEN_MODEL_FACING_LABELS.filter((label) => rendered[cell].user.includes(label))
  );
  const retrievalSections = CELL_IDS.map((cell) => {
    const match = new RegExp("\\[memory evidence \\(allowed refs\\)\\]\\n([\\s\\S]*?)\\n\\[").exec(rendered[cell].user);
    return { cell, section: match?.[1] ?? "(missing)" };
  });
  const retrievalLeak = retrievalSections.filter((entry) => entry.section.trim() !== "(none)");
  record(
    "P7_RAW_HISTORY_MODEL_FACING_LEAKAGE",
    leakedRefs.length === 0 && leakedScenes.length === 0 && leakedLabels.length === 0,
    { leakedRefs, leakedScenes, leakedLabels }
  );
  record("P8_MEMORY_RETRIEVAL_EXPOSURE_ZERO", retrievalLeak.length === 0, { retrievalSections });

  // ---- §13/§14/§35 cell-level invariants -------------------------------------
  const sceneEncodings = new Set(
    CELL_IDS.map((cell) => new RegExp("^\\[context\\] scene=.*$", "m").exec(rendered[cell].user)?.[0] ?? "(missing)")
  );
  record(
    "P12_CURRENT_SCENE_BYTE_EQUALITY",
    sceneEncodings.size === 1 &&
      CELL_IDS.every((cell) => rendered[cell].user.includes(CURRENT_SCENE.text)) &&
      CELL_IDS.every((cell) => rendered[cell].user.includes(CURRENT_SCENE.task)),
    { scene_hash: hashText(CURRENT_SCENE.text), scene_line_hash: hashText([...sceneEncodings][0] ?? "") }
  );
  record(
    "P13_B_D_MEDIATOR_BYTE_EQUALITY",
    rendered.B_HIGH.user === rendered.D_LOW_EQUALIZED.user &&
      rendered.B_HIGH.belief === rendered.D_LOW_EQUALIZED.belief &&
      rendered.B_HIGH.projection_hash === rendered.D_LOW_EQUALIZED.projection_hash,
    { b_user: hashText(rendered.B_HIGH.user), d_user: hashText(rendered.D_LOW_EQUALIZED.user) }
  );
  record(
    "P14_A_B_ONLY_BELIEF_SEMANTIC_DIFFERENCE",
    rendered.A_LOW.nonBelief === rendered.B_HIGH.nonBelief &&
      rendered.A_LOW.user !== rendered.B_HIGH.user &&
      rendered.A_LOW.belief.includes(`"credence":${low.final_credence}`) &&
      rendered.B_HIGH.belief.includes(`"credence":${highCredence}`),
    { a_non_belief: rendered.A_LOW.nonBelief, b_non_belief: rendered.B_HIGH.nonBelief }
  );
  const durableItems = (bundle: HistoryBundle): unknown => {
    const last = bundle.bundles.at(-1) as { next_snapshot: { beliefs: { items: unknown } } } | undefined;
    check(last !== undefined, `${bundle.condition} branch has a committed terminal bundle`);
    return last.next_snapshot.beliefs.items;
  };
  record(
    "P15_C_INTERVENTION_HIGH_DURABLE_UNCHANGED",
    hashJson(highBranch.snapshot.beliefs.items) === hashJson(durableItems(high)),
    { high_items: highBranch.snapshot.beliefs.items }
  );
  record(
    "P16_D_INTERVENTION_LOW_DURABLE_UNCHANGED",
    hashJson(lowBranch.snapshot.beliefs.items) === hashJson(durableItems(low)),
    { low_items: lowBranch.snapshot.beliefs.items }
  );

  // ---- §39 P17 (non-degenerate) ----------------------------------------------
  const experimentSource = (file: string): string =>
    stripCommentsForAudit(readFileSync(join(experimentDirForAudit(), file), "utf8"));
  const interventionBody =
    new RegExp("function applyBeliefView[\\s\\S]*?\\n\\}").exec(experimentSource("precheck.ts"))?.[0] ?? "";
  const renderBody =
    new RegExp("async function renderRequest[\\s\\S]*?\\n\\}").exec(experimentSource("precheck.ts"))?.[0] ?? "";
  const writerCallSiteFiles = (
    ["precheck.ts", "histories.ts", "calibration-runner.ts", "calibration-request.ts"] as const
  ).filter((file) => experimentSource(file).includes("runForEpisodeRefs"));
  const durableBefore = {
    low: hashJson(lowBranch.snapshot.beliefs.items),
    high: hashJson(highBranch.snapshot.beliefs.items)
  };
  for (const cell of CELL_IDS) {
    const definition = CELL_DEFINITION[cell];
    applyBeliefView(
      definition.durable === "LOW" ? lowBranch.snapshot : highBranch.snapshot,
      definition.intervention,
      targetPropositionId,
      highCredence
    );
  }
  const durableAfter = {
    low: hashJson(lowBranch.snapshot.beliefs.items),
    high: hashJson(highBranch.snapshot.beliefs.items)
  };
  const interventionAudit = auditInterventionWriterFree({
    interventionBody,
    renderBody,
    writerCallSiteFiles,
    durableBefore,
    durableAfter
  });
  record("P17_PRODUCTION_WRITE_DURING_INTERVENTION_FALSE", interventionAudit.passed, {
    intervention_path_writer_violations: interventionAudit.violations,
    intervention_body_found: interventionBody.length > 0,
    render_body_found: renderBody.length > 0,
    writer_call_site_files: writerCallSiteFiles,
    durable_before: durableBefore,
    durable_after: durableAfter,
    note:
      "the model-facing intervention and render paths contain no writer/commit token; the only writer call site is history formation, which is offline preparation (attested in P2/P3) and absent from the calibration path; durable belief items are byte-identical before and after every research-side view"
  });

  // ---- §18/§19 exact scan surface --------------------------------------------
  const scanAudit = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA));
  writeJson(join(evidenceDir, "scan-surface.json"), scanAudit as unknown as Record<string, unknown>);
  record(
    "P18_FULL_TRUTH_SCAN_SCHEMA_COVERAGE",
    scanAudit.unscanned_model_authored_semantic_text.length === 0 &&
      scanAudit.frozen_protocol_declared_paths_covered &&
      scanAudit.subjective_selection_covered &&
      scanAudit.derivation_text_covered &&
      scanAudit.exact_scan_surface.length > 0 &&
      scanAudit.independently_enumerated_string_leaves.length >= scanAudit.exact_scan_surface.length,
    scanAudit
  );

  // ---- §22 missing-blob verifier regression ----------------------------------
  const missingBlobManifest: Record<string, unknown> = {
    schema_version: "stochastic-executor-causal-freeze-manifest-v1",
    protocol_id: "STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0",
    preregistration_commit_sha: gitHead(repoDir),
    code_blob_hashes: { "research/this/path/does/not/exist.ts": `sha256:${"0".repeat(64)}` },
    design: { note: "missing-blob regression fixture" }
  };
  let missingBlobResult: { ok: boolean; detail: string } | null = null;
  let missingBlobThrew = false;
  try {
    const verification = verifyFreezeManifest(repoDir, rebuildManifestHash(missingBlobManifest) as never);
    missingBlobResult = { ok: verification.ok, detail: verification.detail };
  } catch (error) {
    missingBlobThrew = true;
    void (error instanceof Error ? error.message : String(error));
  }
  record("P19_MISSING_BLOB_VERIFIER_REGRESSION", missingBlobThrew === false && missingBlobResult?.ok === false, {
    threw: missingBlobThrew,
    result: missingBlobResult
  });

  // ---- §33/§49 identities and schedule ---------------------------------------
  const primary = trialSchedule("PRIMARY");
  const replication = trialSchedule("REPLICATION");
  const identities = [...primary, ...replication].map((entry) => entry.trial_id);
  const uniqueIdentities = new Set(identities);
  record(
    "P20_TRIAL_IDENTITIES_UNIQUE",
    uniqueIdentities.size === identities.length &&
      identities.length === SAMPLE_SIZE.primary_cognition_calls + SAMPLE_SIZE.replication_cognition_calls,
    { total: identities.length, unique: uniqueIdentities.size }
  );
  record(
    "P21_SCHEDULE_COMPLETE",
    primary.length === SAMPLE_SIZE.primary_cognition_calls &&
      replication.length === SAMPLE_SIZE.replication_cognition_calls &&
      CELL_IDS.every((cell) => primary.filter((entry) => entry.cell === cell).length === SAMPLE_SIZE.n_per_cell_per_phase) &&
      CELL_IDS.every((cell) => replication.filter((entry) => entry.cell === cell).length === SAMPLE_SIZE.n_per_cell_per_phase) &&
      replicateRange("PRIMARY").start === 1 &&
      replicateRange("PRIMARY").end === SAMPLE_SIZE.n_per_cell_per_phase &&
      replicateRange("REPLICATION").start === SAMPLE_SIZE.n_per_cell_per_phase + 1,
    {
      primary: primary.length,
      replication: replication.length,
      primary_range: replicateRange("PRIMARY"),
      replication_range: replicateRange("REPLICATION")
    }
  );
  writeJson(join(evidenceDir, "trial-schedule.json"), {
    schema_version: "bcv1-trial-schedule-v0",
    primary,
    replication,
    schedule_hash: hashJson({ primary, replication })
  });

  // ---- §39 P22 (non-degenerate): V0 dependency scan over this experiment ------
  const firewallFiles = readdirSync(experimentDirForAudit())
    .filter((name) => name.endsWith(".ts"))
    .sort();
  const v0Audit = auditV0DependencyFree({
    files: firewallFiles.map((file) => ({ file, code: experimentSource(file) })),
    declaredFirewallPaths: V0_FIREWALL.forbidden_reads
  });
  record("P22_V0_CONFIRMATORY_COUNT_CONTRIBUTION_ZERO", v0Audit.passed, {
    files_scanned: firewallFiles,
    read_or_import_violations: v0Audit.readOrImportViolations,
    confirmatory_count_contribution: V0_FIREWALL.confirmatory_count_contribution,
    note: "no source reads or imports a V0 outcome artifact; the only occurrences are contract.ts's declared firewall list"
  });
  record("P23_MODEL_CALLS_ZERO", SLICE_CALL_ATTESTATION.total_model_calls === 0, SLICE_CALL_ATTESTATION);

  // ---- §55 hard-gate registry sanity + demonstrated verdict consumption ------
  const demonstration: VerdictInput = {
    phase: "PRIMARY",
    cells: {
      A_LOW: { scheduled: 200, host_valid: 200, realize: 60, conflation_flags: 0 },
      B_HIGH: { scheduled: 200, host_valid: 200, realize: 134, conflation_flags: 0 },
      C_HIGH_ABLATED: { scheduled: 200, host_valid: 200, realize: 20, conflation_flags: 0 },
      D_LOW_EQUALIZED: { scheduled: 200, host_valid: 200, realize: 138, conflation_flags: 0 }
    },
    prereg_sha_matches: true,
    manifest_valid: true,
    seed_belief_empty: true,
    formation_attested: true,
    raw_history_leaks: 0,
    retrieval_exposed: false,
    non_belief_state_equal: true,
    a_b_only_belief_difference: true,
    b_d_full_input_identity: true,
    intervention_production_writes: 0,
    secret_safety_clean: true,
    accounting: { planned: 800, actual: 800, unique: 800, duplicate: 0, missing: 0, extra: 0 },
    primary_conjunction_passed: null,
    replication_conjunction_passed: null
  };
  const demonstrated = deriveConfirmatoryVerdict(demonstration);
  record(
    "P24_VERDICT_LAW_CONSUMES_HARD_GATES",
    demonstrated.gates.length === HARD_GATE_IDS.length && demonstrated.verdict === "BELIEF_CAUSAL_RESULT_INCONCLUSIVE",
    { gates: demonstrated.gates.map((gate) => gate.id), verdict: demonstrated.verdict }
  );

  const failed = Object.entries(checks)
    .filter(([, entry]) => !entry.passed)
    .map(([id]) => id);
  const result: PrecheckResult = { ok: failed.length === 0, failed, checks };
  writeJson(join(evidenceDir, "precheck.json"), {
    schema_version: "bcv1-precheck-v0",
    experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
    model_calls: 0,
    frozen_parameters: {
      protocol_id: "STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0",
      delta_min: DESIGN.delta_min,
      epsilon: DESIGN.epsilon,
      n_per_cell_per_phase: SAMPLE_SIZE.n_per_cell_per_phase,
      calibration_draws: SAMPLING.calibration_draws,
      conflation_gate: CONFLATION_LAW.pass_means
    },
    classifier_self_check: {
      positive_case_flag: classifyTruthConflation("It is guaranteed true.").conflation,
      negative_case_flag: classifyTruthConflation("It is not guaranteed.").conflation
    },
    ...result
  });
  return result;
}

function gitHead(repoDir: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
}

function rebuildManifestHash(manifest: Record<string, unknown>): Record<string, unknown> {
  const core: Record<string, unknown> = { ...manifest };
  delete core["manifest_hash"];
  return { ...core, manifest_hash: manifestHashOf(core) };
}
