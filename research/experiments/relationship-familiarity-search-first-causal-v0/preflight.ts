/**
 * RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0 - zero-model preflight.
 * Verifies, before any real call: the SAME-CORPUS invariant, the manipulation check
 * for all three conditions, retrieval specificity, the frozen live chain, fresh
 * authoritative restore, and the endpoint classifier. REAL MODEL CALLS: 0.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ABLATED_CONDITION_ID,
  CONDITIONS,
  CONVENTION_REF,
  DISTRACTOR_REF,
  GENERIC_REF,
  MODEL,
  SCENARIOS,
  scheduledCallMaximum,
  scheduledScenes,
  type ConditionId
} from "./contract.ts";
import { runScene, type SceneObservation } from "./scene.ts";
import { buildHistory, check, hashJson, restoreHistory, type HistoryBundle, type Runtime } from "./world.ts";

export interface FrozenFixture {
  readonly schema_version: "familiarity-search-first-frozen-fixture-v0";
  readonly preflight_hash: string;
  readonly histories: Readonly<Record<ConditionId, HistoryBundle>>;
  readonly scheduled_calls_maximum: number;
  readonly model: unknown;
}

/** Deterministic offline cognition fixture: cites the counterpart convention when (and
 * only when) its F handle is advertised; otherwise asks for framing. */
export function fakeCognitionTransport() {
  return {
    complete: async (request: { readonly messages: readonly { readonly role: string; readonly content: string }[] }) => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const handle = /^-\s*(F\d+):\s*episode:alice-08$/m.exec(user)?.[1] ?? null;
      const observationRef = /^\[current observation\] (\S+)$/m.exec(user)?.[1] ?? null;
      const observationHandle = (() => {
        if (observationRef === null) return null;
        for (const line of user.split(String.fromCharCode(10))) {
          const match = /^-\s*([FC][0-9]+):\s*(\S+)\s*$/m.exec(line.trim());
          if (match !== null && match[2] === observationRef) return match[1] ?? null;
        }
        return null;
      })();
      if (handle === null) {
        return {
          model: "fake-offline",
          content: JSON.stringify({
            schema_version: "conversation-cognition-proposal-v8",
            factual_assessment: { claims: [] },
            cognition: {
              schema_version: "cognition-proposal-v0", reasoning_summary: "offline fixture",
              relevant_memory_handles: [], considered_handles: observationHandle === null ? [] : [observationHandle], current_intent: "ask for framing",
              confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: []
            },
            subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
            response_semantics: { kind: "PRIMARY_CLARIFICATION" },
            communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
            clarification_basis: {
              current_observation_ref: observationRef ?? "observation:o-missing",
              missing_information: "the expected update format",
              needed_for: "revising the update"
            }
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
              source_handles: [handle]
            }]
          },
          cognition: {
            schema_version: "cognition-proposal-v0", reasoning_summary: "offline fixture",
            relevant_memory_handles: [], considered_handles: [handle], current_intent: "use the established convention",
            confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: [handle]
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

export async function offlineScene(runtime: Runtime, condition: string, scenarioIndex: number, ablation: boolean, replicate = 1): Promise<SceneObservation> {
  return await runScene(runtime, {
    condition,
    scenario: SCENARIOS[scenarioIndex] as never,
    replicate,
    ablation,
    cognitionTransport: fakeCognitionTransport(),
    languageTransport: fakeLanguageTransport()
  });
}

export interface PreflightResult {
  readonly fixture: FrozenFixture;
  readonly evidence: unknown;
}

export async function preflight(): Promise<PreflightResult> {
  const lowBuilt = await buildHistory("LOW");
  const highBuilt = await buildHistory("HIGH");
  check(lowBuilt.bundle.corpus_digest === highBuilt.bundle.corpus_digest, "LOW and HIGH expose the identical candidate corpus (digest)");
  check(JSON.stringify(lowBuilt.bundle.records) === JSON.stringify(highBuilt.bundle.records), "LOW and HIGH expose the identical records (refs + payload hashes)");
  check(JSON.stringify(lowBuilt.bundle.binding) === JSON.stringify(highBuilt.bundle.binding), "identical repository revision binding");
  check(lowBuilt.bundle.familiarity_value === CONDITIONS.LOW.expected_value, "LOW familiarity is 1/32");
  check(highBuilt.bundle.familiarity_value === CONDITIONS.HIGH.expected_value, "HIGH familiarity is 16/32");

  const lowScene = await offlineScene(await restoreHistory(lowBuilt.bundle), "LOW", 0, false);
  const highScene = await offlineScene(await restoreHistory(highBuilt.bundle), "HIGH", 0, false);
  const ablatedScene = await offlineScene(await restoreHistory(highBuilt.bundle), ABLATED_CONDITION_ID, 0, true);

  for (const scene of [lowScene, highScene, ablatedScene]) {
    check(scene.result_kind === "OUTPUT_READY", `offline scene OUTPUT_READY (${scene.condition}: ${String(scene.failure_stage ?? "")} ${String(scene.failure_detail ?? "")})`);
    check(scene.language.schema_version === "language-realization-input-v10" || scene.directive_kind === "CLARIFY_MISSING_CONTEXT",
      `live Language V10 (or host CLARIFY branch) in ${scene.condition}`);
    check(scene.recognition.condition_label_leak === false, `no condition labels in ${scene.condition}`);
  }

  check(lowScene.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=1/32", "LOW renders 1/32");
  check(lowScene.recognition.influence_lines.includes("- entity:alice: context_resolution_strategy=BASIC_CONTEXT_FIRST"), "LOW renders BASIC_CONTEXT_FIRST");
  check(lowScene.retrieval.queries === 0, "LOW issues NO priority retrieval");
  check(lowScene.retrieval.mediator_visible === false, "LOW sees no counterpart convention evidence");
  check(lowScene.behavior_class === "ASKS_FOR_FRAMING", `LOW offline class asks for framing (${lowScene.behavior_class})`);

  check(highScene.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=16/32", "HIGH renders 16/32");
  check(highScene.recognition.influence_lines.includes("- entity:alice: context_resolution_strategy=COUNTERPART_CONTEXT_SEARCH_FIRST"), "HIGH renders SEARCH_FIRST");
  check(highScene.retrieval.queries === 1, "HIGH issues exactly ONE priority retrieval");
  const highAttempt = highScene.retrieval.attempts[0];
  check(highAttempt !== undefined && highAttempt.selected_refs.includes(CONVENTION_REF), `HIGH production retrieval selects the counterpart item (${JSON.stringify(highAttempt?.selected_refs?.slice(0, 4))})`);
  check(highAttempt !== undefined && highAttempt.selected_refs.includes(GENERIC_REF) === false, "the generic item is not selected via retrieval (it is a working ref)");
  check(highAttempt !== undefined && highAttempt.selected_refs.includes(DISTRACTOR_REF) === false, "retrieval specificity: the distractor is never selected");
  check(highAttempt !== undefined && highAttempt.selected_content_hashes.length === highAttempt.selected_refs.length, "every selected ref carries a content hash");
  check(highScene.retrieval.mediator_visible === true, "the counterpart convention reaches the model-visible prompt in HIGH");
  check(highScene.recognition.counterpart_handle !== null, "the convention is an advertised F handle in HIGH");
  check(highScene.behavior_class === "USES_RETRIEVED_COUNTERPART_CONTEXT", `HIGH offline class uses retrieved counterpart context (${highScene.behavior_class})`);

  check(ablatedScene.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=16/32", "ABLATED still renders HIGH 16/32");
  check(ablatedScene.recognition.influence_lines.includes("- entity:alice: context_resolution_strategy=COUNTERPART_CONTEXT_SEARCH_FIRST"), "ABLATED still renders SEARCH_FIRST");
  check(ablatedScene.retrieval.queries === 1, "ABLATED still issues the priority retrieval");
  const ablatedAttempt = ablatedScene.retrieval.attempts[0];
  check(ablatedAttempt !== undefined && ablatedAttempt.replaced_with_empty === true, "ABLATED attests the mediator replacement");
  check(ablatedScene.retrieval.mediator_visible === false, "ABLATED sees no counterpart convention evidence");
  check(ablatedScene.behavior_class === "ASKS_FOR_FRAMING", `ABLATED offline class returns to the LOW class (${ablatedScene.behavior_class})`);

  check(unexpectedDiff(lowScene.cognition.user_content, highScene.cognition.user_content).length === 0, "LOW vs HIGH differences are retrieval/familiarity/metadata only; unexpected: " + JSON.stringify(unexpectedDiff(lowScene.cognition.user_content, highScene.cognition.user_content).slice(0, 6)));
  check(unexpectedDiff(highScene.cognition.user_content, ablatedScene.cognition.user_content).length === 0, "HIGH vs ABLATED differences are retrieval/familiarity/metadata only; unexpected: " + JSON.stringify(unexpectedDiff(highScene.cognition.user_content, ablatedScene.cognition.user_content).slice(0, 6)));

  const restoreProof = await freshRestoreProof([
    { bundle: lowBuilt.bundle, expect: { familiarity: lowBuilt.bundle.familiarity_value, state_revision: lowBuilt.bundle.state_revision, material_digest: lowScene.cognition.material_digest } },
    { bundle: highBuilt.bundle, expect: { familiarity: highBuilt.bundle.familiarity_value, state_revision: highBuilt.bundle.state_revision, material_digest: highScene.cognition.material_digest } }
  ]);

  const fixture: FrozenFixture = {
    schema_version: "familiarity-search-first-frozen-fixture-v0",
    preflight_hash: hashJson({
      corpus: { digest: lowBuilt.bundle.corpus_digest, refs: lowBuilt.bundle.records.map((entry) => entry.ref) },
      histories: {
        LOW: { familiarity: lowBuilt.bundle.familiarity_value, revision: lowBuilt.bundle.state_revision },
        HIGH: { familiarity: highBuilt.bundle.familiarity_value, revision: highBuilt.bundle.state_revision }
      },
      scenes: {
        LOW: { class: lowScene.behavior_class, digest: lowScene.cognition.material_digest, queries: lowScene.retrieval.queries },
        HIGH: { class: highScene.behavior_class, digest: highScene.cognition.material_digest, queries: highScene.retrieval.queries },
        HIGH_SEARCH_ABLATED: { class: ablatedScene.behavior_class, digest: ablatedScene.cognition.material_digest, queries: ablatedScene.retrieval.queries }
      },
      restoreProof,
      model: MODEL
    }),
    histories: { LOW: lowBuilt.bundle, HIGH: highBuilt.bundle },
    scheduled_calls_maximum: scheduledCallMaximum(),
    model: MODEL
  };

  const evidence = {
    schema_version: "familiarity-search-first-preflight-v0",
    model_calls: 0,
    same_corpus: {
      digest: lowBuilt.bundle.corpus_digest,
      refs: lowBuilt.bundle.records.map((entry) => entry.ref),
      digest_equal_across_conditions: true,
      repository_binding_equal: true
    },
    familiarity: { LOW: lowBuilt.bundle.familiarity_value, HIGH: highBuilt.bundle.familiarity_value },
    manipulation: {
      LOW: { queries: lowScene.retrieval.queries, mediator_visible: lowScene.retrieval.mediator_visible, strategy: "BASIC_CONTEXT_FIRST" },
      HIGH: {
        queries: highScene.retrieval.queries,
        selected_refs: highScene.retrieval.attempts[0]?.selected_refs ?? [],
        selected_content_hashes: highScene.retrieval.attempts[0]?.selected_content_hashes ?? [],
        mediator_visible: highScene.retrieval.mediator_visible,
        strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST"
      },
      HIGH_SEARCH_ABLATED: {
        queries: ablatedScene.retrieval.queries,
        mediator_visible: ablatedScene.retrieval.mediator_visible,
        replaced_with_empty: ablatedScene.retrieval.attempts[0]?.replaced_with_empty ?? null
      }
    },
    offline_classes: { LOW: lowScene.behavior_class, HIGH: highScene.behavior_class, HIGH_SEARCH_ABLATED: ablatedScene.behavior_class },
    live_chain: { language_schema: highScene.language.schema_version, atom: highScene.atom_kind, system_hash: highScene.cognition.system_hash },
    restore_proof: restoreProof,
    scheduled_scenes: scheduledScenes().length,
    scheduled_calls_maximum: scheduledCallMaximum()
  };
  return { fixture, evidence };
}

/** Non-allowlisted lines that differ between two rendered requests (order-tolerant:
 * after removing every allowlisted line, the remaining multisets must be equal). */
function unexpectedDiff(left: string, right: string): readonly string[] {
  const rest = (text: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const line of text.split(String.fromCharCode(10))) {
      if (allowedLine(line)) continue;
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    return counts;
  };
  const a = rest(left);
  const b = rest(right);
  const offending: string[] = [];
  for (const [line, count] of a) {
    const other = b.get(line) ?? 0;
    if (other !== count) offending.push("left x" + String(count) + " vs right x" + String(other) + ": " + line);
  }
  for (const [line] of b) {
    if ((a.get(line) ?? 0) === 0) offending.push("only-right: " + line);
  }
  return offending;
}

function allowedLine(line: string | null): boolean {
  if (line === null) return true;
  const patterns = [
    /^- entity:alice: (presence|context_resolution_strategy)=/,
    /^\[interaction familiarity/,
    /^\[current state\]/,
    /^\[projection_hash\]/,
    /^\[memory evidence \(allowed refs\)\]/,
    /^ {2}- (episode|observation|entity|environment|subject|experience):/,
    /^- (episode|observation|entity|environment|subject|experience):/,
    /^\[PRIOR FACTUAL MEMORY/,
    /^\[BEGIN HISTORICAL FACTUAL CONTENT/,
    /^\[END HISTORICAL FACTUAL CONTENT\]/,
    /^- Past episode record \(scene:/,
    /^ {2}episode_ref: /,
    /^FACTUAL SOURCE REFS/,
    /^FACTUAL SOURCE HANDLES/,
    /^CONTEXT HANDLES/,
    /^CITEABLE CONTEXT REFS/,
    /^-\s*F\d+: /,
    /^-\s*C\d+: /,
    /^ {2}\(none\)$/
  ];
  return patterns.some((pattern) => pattern.test(line));
}

async function freshRestoreProof(
  jobs: readonly { readonly bundle: HistoryBundle; readonly expect: { readonly familiarity: number | null; readonly state_revision: number; readonly material_digest: string } }[]
): Promise<unknown> {
  const worker = fileURLToPath(new URL("./restore-worker.ts", import.meta.url));
  const proof: unknown[] = [];
  for (const job of jobs) {
    const result = spawnSync(process.execPath, [worker], { input: JSON.stringify(job), encoding: "utf8", timeout: 180000 });
    check(result.status === 0, `fresh-process restore worker (${job.bundle.condition}): ${String(result.stderr || result.stdout)}`);
    proof.push(JSON.parse(result.stdout) as unknown);
  }
  return proof;
}
