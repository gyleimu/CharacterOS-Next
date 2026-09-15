/**
 * RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0 — zero-model preflight.
 *
 * Builds every condition through the REAL production path, measures the frozen
 * ABSENT rendering, executes the matched scenes offline with deterministic fake
 * transports, and attests:
 *   - the live protocol chain (Cognition V8 / Language V10 / response atom);
 *   - exact familiarity values per condition;
 *   - MATCHED Memory: LOW vs HIGH cognition input differs only in the
 *     familiarity material and enumerated revision/time metadata;
 *   - the §36 ablation: HIGH vs HIGH_ABLATED differ exactly in the replaced lines;
 *   - no condition-label leakage;
 *   - fresh-process authoritative restore preserves the value and the request.
 *
 * REAL MODEL CALLS: 0.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ABLATED_CONDITION_ID,
  CONDITIONS,
  CONVENTION_REF,
  MODEL,
  SCENARIOS,
  SUBJECT,
  scheduledCallMaximum,
  scheduledScenes,
  type ConditionId
} from "./contract.ts";
import { runScene, type AbsentRendering, type SceneObservation } from "./scene.ts";
import { buildHistory, buildHistoryWithCredits, check, hashJson, restoreHistory, type HistoryBundle, type Runtime } from "./world.ts";

export interface FrozenFixture {
  readonly schema_version: "familiarity-completion-frozen-fixture-v0";
  readonly preflight_hash: string;
  readonly absent_rendering: AbsentRendering;
  readonly histories: Readonly<Record<ConditionId, HistoryBundle>>;
  readonly scheduled_calls_maximum: number;
  readonly model: unknown;
}

/** Deterministic offline cognition transport: designates the convention quote as
 * the primary fact (a lawful PRIMARY_FACT over an authorized SOURCE_QUOTE). */
export function fakeCognitionTransport() {
  return {
    complete: async (request: { readonly messages: readonly { readonly role: string; readonly content: string }[] }) => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const conventionHandle = /^-\s*(F\d+):\s*episode:alice-convention-01$/m.exec(user)?.[1] ?? null;
      if (conventionHandle === null) {
        // the convention evidence is not advertised here; answer with a lawful act
        return {
          model: "fake-offline",
          content: JSON.stringify({
            schema_version: "conversation-cognition-proposal-v8",
            factual_assessment: { claims: [] },
            cognition: {
              schema_version: "cognition-proposal-v0", reasoning_summary: "offline fixture",
              relevant_memory_handles: [], considered_handles: [], current_intent: "respond",
              confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: []
            },
            subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
            response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
            communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
            clarification_basis: null
          })
        };
      }
      return {
        model: "fake-offline",
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v8",
          factual_assessment: {
            claims: [{
              kind: "SOURCE_QUOTE",
              text: "Use concise wording, a factual tone, and no unnecessary apology for these status updates.",
              source_handles: [conventionHandle]
            }]
          },
          cognition: {
            schema_version: "cognition-proposal-v0", reasoning_summary: "offline fixture",
            relevant_memory_handles: [], considered_handles: [conventionHandle], current_intent: "respond",
            confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: [conventionHandle]
          },
          subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
          response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
          clarification_basis: null
        })
      };
    }
  };
}

export function fakeLanguageTransport() {
  return {
    complete: async () => ({
      model: "fake-offline",
      content: JSON.stringify({
        schema_version: "language-realization-semantic-draft-v1",
        text: "Offline fixture realization.",
        evidence_refs: []
      })
    })
  };
}

/** Lines that may legitimately differ across conditions (revision/time metadata). */
const ALLOWED_DIFF_PATTERNS: readonly RegExp[] = Object.freeze([
  /^- entity:alice: presence=PRESENT level=\d+\/32$/,
  /^- entity:alice: context_resolution_strategy=\w+$/,
  /^\[interaction familiarity/,
  /^\[interaction familiarity cognition influence/,
  /^\[state_revision\]/,
  /^\[current state\]/,
  /^\[projection_hash\] \S+$/,
  /^\[current logical time\]/,
  /^\s*$/
]);

export function differingLines(left: string, right: string): readonly { readonly left: string | null; readonly right: string | null; readonly allowed: boolean }[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const length = Math.max(leftLines.length, rightLines.length);
  const differences: { left: string | null; right: string | null; allowed: boolean }[] = [];
  for (let index = 0; index < length; index += 1) {
    const entry = leftLines[index] ?? null;
    const other = rightLines[index] ?? null;
    if (entry === other) continue;
    const allowed = (entry !== null && ALLOWED_DIFF_PATTERNS.some((pattern) => pattern.test(entry)))
      || (other !== null && ALLOWED_DIFF_PATTERNS.some((pattern) => pattern.test(other)));
    differences.push({ left: entry, right: other, allowed });
  }
  return differences;
}

export async function offlineScene(
  runtime: Runtime,
  condition: string,
  scenarioIndex: number,
  ablation: boolean,
  absent: AbsentRendering | null,
  replicate = 1
): Promise<SceneObservation> {
  return await runScene(runtime, {
    condition,
    scenario: SCENARIOS[scenarioIndex] as never,
    replicate,
    ablation,
    absent,
    cognitionTransport: fakeCognitionTransport(),
    languageTransport: fakeLanguageTransport()
  });
}

export interface PreflightResult {
  readonly fixture: FrozenFixture;
  readonly evidence: unknown;
}

export async function preflight(): Promise<PreflightResult> {
  const primary = SCENARIOS[0] as never as { id: string; utterance: string };
  // --- build every history through the real production path (zero model calls) ---
  const lowBuilt = await buildHistory("LOW");
  const highBuilt = await buildHistory("HIGH");
  // ABSENT world: identical repository and episodes, ZERO admitted interactions.
  const absentWorld = await buildHistoryWithCredits(0, "ABSENT");

  const absentScene = await offlineScene(absentWorld.runtime, "ABSENT", 0, false, null);
  check(absentWorld.bundle.familiarity_value === null, "ABSENT world carries no familiarity credit");
  const absentEntry = absentScene.cognition.familiarity_entry_line;
  check(absentEntry === null, "ABSENT world has no PRESENT familiarity entry line");
  const absentRendering: AbsentRendering = {
    familiarity_entry_line: `- entity:alice: presence=ABSENT (no credited firsthand interaction familiarity)`,
    influence_lines: absentScene.recognition.influence_lines.length === 0 ? ["(none)"] : absentScene.recognition.influence_lines,
    familiarity_entry_absent_signature: hashJson(absentScene.recognition.familiarity_lines)
  };
  check(
    absentScene.recognition.familiarity_lines.some((line) => line.includes("presence=ABSENT")),
    "ABSENT rendering measured from the production renderer"
  );

  // --- matched scenes (offline) -------------------------------------------------
  // Each offline scene runs on its OWN freshly restored runtime, so the admitted
  // observation identity is condition-independent (identical bytes) without replays.
  const lowScene = await offlineScene(await restoreHistory(lowBuilt.bundle), "LOW", 0, false, absentRendering);
  const highScene = await offlineScene(await restoreHistory(highBuilt.bundle), "HIGH", 0, false, absentRendering);
  const ablatedScene = await offlineScene(await restoreHistory(highBuilt.bundle), ABLATED_CONDITION_ID, 0, true, absentRendering);

  check(lowScene.result_kind === "OUTPUT_READY" && highScene.result_kind === "OUTPUT_READY" && ablatedScene.result_kind === "OUTPUT_READY",
    `all offline scenes reach OUTPUT_READY (${lowScene.failure_stage ?? ""}${highScene.failure_stage ?? ""}${ablatedScene.failure_stage ?? ""})`);
  check(lowScene.language.schema_version === "language-realization-input-v10", "live Language V10 input");
  check(lowScene.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=1/32", "LOW renders 1/32");
  check(highScene.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=16/32", "HIGH renders 16/32");
  check(highScene.recognition.influence_lines.includes("- entity:alice: context_resolution_strategy=COUNTERPART_CONTEXT_SEARCH_FIRST"),
    "HIGH carries the SEARCH_FIRST influence");
  check(lowScene.recognition.influence_lines.includes("- entity:alice: context_resolution_strategy=BASIC_CONTEXT_FIRST"),
    "LOW carries the BASIC_CONTEXT_FIRST influence");
  check(lowScene.behavior_class === "ESTABLISHED_CONVENTION_USED", "offline primary class is deterministic");
  check(lowScene.cognition.convention_handle !== null && highScene.cognition.convention_handle !== null, "convention evidence is an advertised F handle in both conditions");

  // §35 matched-Memory attestation: differences are confined to the allowlist.
  const lowHighDiff = differingLines(lowScene.cognition.user_content, highScene.cognition.user_content);
  check(lowHighDiff.length > 0, "LOW vs HIGH differs somewhere");
  check(lowHighDiff.every((entry) => entry.allowed), `LOW vs HIGH differences confined to familiarity/revision lines: ${JSON.stringify(lowHighDiff.filter((entry) => !entry.allowed))}`);
  const lowHighFamiliarityOnly = lowHighDiff.filter((entry) => !/^\[projection_hash\]|^\[state_revision\]|^\[current state\]|^\[current logical time\]/.test(entry.left ?? entry.right ?? ""));
  check(lowHighFamiliarityOnly.length <= 2, `LOW vs HIGH substantive differences are the two familiarity lines (got ${lowHighFamiliarityOnly.length})`);

  // §36 ablation attestation: exactly the familiarity material was replaced.
  const highAblatedDiff = differingLines(highScene.cognition.user_content, ablatedScene.cognition.user_content);
  check(highAblatedDiff.every((entry) => entry.allowed), "HIGH vs HIGH_ABLATED differences are familiarity lines only");
  check(ablatedScene.cognition.familiarity_entry_line === null, "ablated request carries no PRESENT familiarity entry");
  check(ablatedScene.recognition.familiarity_lines.some((line) => line.includes("presence=ABSENT")), "ablated request renders the frozen ABSENT material");

  // condition-label leakage
  for (const scene of [lowScene, highScene, ablatedScene, absentScene]) {
    check(scene.recognition.condition_label_leak === false, `no condition labels in the model-facing input (${scene.condition})`);
  }

  // --- fresh-process authoritative restore --------------------------------------
  const restoreProof = await freshRestoreProof([
    { bundle: lowBuilt.bundle, expect: { familiarity: lowBuilt.bundle.familiarity_value, state_revision: lowBuilt.bundle.state_revision, material_digest: lowScene.cognition.material_digest } },
    { bundle: highBuilt.bundle, expect: { familiarity: highBuilt.bundle.familiarity_value, state_revision: highBuilt.bundle.state_revision, material_digest: highScene.cognition.material_digest } }
  ]);

  const fixture: FrozenFixture = {
    schema_version: "familiarity-completion-frozen-fixture-v0",
    preflight_hash: hashJson({
      histories: {
        LOW: { familiarity: lowBuilt.bundle.familiarity_value, revision: lowBuilt.bundle.state_revision, binding: lowBuilt.bundle.binding },
        HIGH: { familiarity: highBuilt.bundle.familiarity_value, revision: highBuilt.bundle.state_revision, binding: highBuilt.bundle.binding }
      },
      absentRendering,
      scenes: {
        LOW: { class: lowScene.behavior_class, entry: lowScene.cognition.familiarity_entry_line, digest: lowScene.cognition.material_digest, system: lowScene.cognition.system_hash },
        HIGH: { class: highScene.behavior_class, entry: highScene.cognition.familiarity_entry_line, digest: highScene.cognition.material_digest, system: highScene.cognition.system_hash },
        HIGH_ABLATED: { class: ablatedScene.behavior_class, entry: ablatedScene.cognition.familiarity_entry_line, digest: ablatedScene.cognition.material_digest, system: ablatedScene.cognition.system_hash },
        ABSENT: { class: absentScene.behavior_class, digest: absentScene.cognition.material_digest }
      },
      restoreProof,
      model: MODEL
    }),
    absent_rendering: absentRendering,
    histories: { LOW: lowBuilt.bundle, HIGH: highBuilt.bundle },
    scheduled_calls_maximum: scheduledCallMaximum(),
    model: MODEL
  };

  const evidence = {
    schema_version: "familiarity-completion-preflight-v0",
    model_calls: 0,
    familiarity: {
      LOW: lowBuilt.bundle.familiarity_value,
      HIGH: highBuilt.bundle.familiarity_value,
      ABSENT: null,
      expected: { LOW: CONDITIONS.LOW.expected_value, HIGH: CONDITIONS.HIGH.expected_value }
    },
    state_revisions: { LOW: lowBuilt.bundle.state_revision, HIGH: highBuilt.bundle.state_revision },
    repository_revisions: { LOW: lowBuilt.bundle.repository_revision, HIGH: highBuilt.bundle.repository_revision },
    matched_memory: {
      identical_repository_binding_hash: JSON.stringify(lowBuilt.bundle.binding) === JSON.stringify(highBuilt.bundle.binding),
      identical_episode_records: JSON.stringify(lowBuilt.bundle.records) === JSON.stringify(highBuilt.bundle.records),
      low_high_differences: lowHighDiff,
      substantive_difference_count: lowHighFamiliarityOnly.length
    },
    ablation: {
      differences: highAblatedDiff,
      removed: (ablatedScene as { ablation_removed?: readonly string[] }).ablation_removed ?? null,
      absent_rendering: absentRendering
    },
    offline_classes: {
      LOW: lowScene.behavior_class,
      HIGH: highScene.behavior_class,
      HIGH_ABLATED: ablatedScene.behavior_class,
      ABSENT: absentScene.behavior_class
    },
    live_chain: {
      language_schema: lowScene.language.schema_version,
      cognition_system_hash: lowScene.cognition.system_hash,
      convention_handle: lowScene.cognition.convention_handle,
      primary_scenario: primary.id
    },
    restore_proof: restoreProof,
    scheduled_scenes: scheduledScenes().length,
    scheduled_calls_maximum: scheduledCallMaximum()
  };
  return { fixture, evidence };
}

async function freshRestoreProof(
  jobs: readonly { readonly bundle: HistoryBundle; readonly expect: { readonly familiarity: number | null; readonly state_revision: number; readonly material_digest: string } }[]
): Promise<unknown> {
  const worker = fileURLToPath(new URL("./restore-worker.ts", import.meta.url));
  const proof: unknown[] = [];
  for (const job of jobs) {
    const result = spawnSync(process.execPath, [worker], { input: JSON.stringify(job), encoding: "utf8", timeout: 180000 });
    check(result.status === 0, `fresh-process restore worker (${job.bundle.condition}): ${result.stderr || result.stdout}`);
    proof.push(JSON.parse(result.stdout) as unknown);
  }
  return proof;
}

export const FROZEN_FIXTURE_HASH_INPUT = createHash("sha256").update(CONVENTION_REF + SUBJECT).digest("hex");
