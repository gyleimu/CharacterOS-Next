/**
 * BELIEF_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — ONE bounded real-provider
 * validation through the REAL interactive production stack.
 *
 *   genesis foundation (ONE canonical proposition, credence 0.6)
 *   → History A: lived evidence lawfully supportive of the proposition
 *   → History B: lived evidence lawfully inconsistent with it
 *   (same genesis / subject architecture / initial belief / provider config /
 *   software; ONLY lived evidence differs; the subject is never told to
 *   believe or stop believing anything — §27)
 *   → frozen semantic resolution (REAL OllamaBeliefSemanticProviderV0)
 *   → frozen BeliefPlasticityProducer → frozen BeliefTransitionExecutor
 *   → authoritative restore (JSON round-trip, fresh runtime objects)
 *   → common current event to both restored runtimes (Level 5 evidence only —
 *     memory/affect also differ across histories, so belief-only causality is
 *     NOT claimed from this comparison — §42).
 *
 * Provider call accounting (§76) is reported per family: belief semantic,
 * appraisal, cognition, language. No retry, no self-evaluation loop (§77).
 *
 * REAL model: Ollama qwen3.5:9b (cognition/language num_predict 2048; belief
 * semantic provider keeps its OWN frozen bounded budget of 512 — §75).
 */

/* eslint-disable no-restricted-imports -- Isolated bounded real-provider validation over frozen built production roots (repo research-experiment convention); the interactive runtime, belief semantic provider and product appraisal provider are consumed through their frozen built surfaces. */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BELIEF_STATE_SCHEMA_VERSION,
  validateSubjectState,
  type SubjectStateV0
} from "../../../packages/subject-core/dist/index.js";
import {
  InteractiveSubjectRuntimeV0,
  OllamaBeliefSemanticProviderV0,
  OllamaNativeCognitionTransportV0,
  createInteractiveSubjectSeedV0,
  type BeliefAdaptationTurnReportV0,
  type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";
import { createProductAppraisalProviderV0 } from "../../../product/sandbox/dist/product-appraisal-provider.js";

const BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
const MODEL = process.env["CHARACTEROS_MODEL"] ?? "qwen3.5:9b";
const SUBJECT_ID = "belief-evidence-subject";
const TARGET_PROP = "prop.alice-keeps-promises";
const TARGET_LABEL = "Alice keeps promises";
const INITIAL_CREDENCE = 0.6;

// ---- §25/§23: lawful genesis-foundation proposition (experiential, not identity) ----
function seededV3Source(): SubjectStateV0 {
  const base = createInteractiveSubjectSeedV0(SUBJECT_ID, "Evidence Subject", []) as unknown as Record<string, unknown>;
  const raw = {
    ...base,
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: [{ proposition_id: TARGET_PROP, proposition_label: TARGET_LABEL, credence: INITIAL_CREDENCE }]
    }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`genesis fixture invalid: ${checked.error.detail}`);
  return checked.value;
}

// ---- REAL product transports (EXACT product budgets; no retry, no repair) ----
let cognitionCalls = 0;
let languageCalls = 0;

function productCognitionTransport(): ModelTransportV0 {
  return new OllamaNativeCognitionTransportV0({
    base_url: BASE_URL,
    model: MODEL,
    timeout_ms: 120_000,
    num_predict: 2048,
    context_window_tokens: 8192
  });
}

function countingLanguageTransport(): ModelTransportV0 {
  const inner = productCognitionTransport();
  return {
    complete: async (request) => {
      languageCalls += 1;
      return inner.complete(request);
    }
  } as ModelTransportV0;
}

function recordingTransport(inner: ModelTransportV0, recorder: RequestRecorder): ModelTransportV0 {
  return {
    complete: async (request) => {
      cognitionCalls += 1;
      recorder.requests.push({
        messages: (request as { messages: readonly { role: string; content: string }[] }).messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      });
      return inner.complete(request);
    }
  } as ModelTransportV0;
}

/** Records cognition requests so the belief projection in later cognition is observable. */
interface RequestRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

interface TurnEvidence {
  readonly turn_index: number;
  readonly user_text: string;
  readonly status: string;
  readonly subject_text: string | null;
  readonly failure: string | null;
  readonly belief_adaptation: BeliefAdaptationTurnReportV0 | null;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
}

/** Product appraisal transport: dedicated small budget (product parity). */
function productAppraisalTransport(): ModelTransportV0 {
  return new OllamaNativeCognitionTransportV0({
    base_url: BASE_URL,
    model: MODEL,
    timeout_ms: 120_000,
    num_predict: 256,
    context_window_tokens: 4096
  });
}

async function runHistory(
  historyId: "A" | "B",
  texts: readonly string[]
): Promise<{ readonly turns: TurnEvidence[]; readonly snapshot: unknown; readonly appraisalCalls: number }> {
  const recorder: RequestRecorder = { requests: [] };
  const appraisal = createProductAppraisalProviderV0({ transport: productAppraisalTransport() });
  const runtime = await InteractiveSubjectRuntimeV0.create({
    session_id: `belief-evidence-${historyId}`,
    subject: { subject_id: SUBJECT_ID, display_name: "Evidence Subject", identity_anchors: [] },
    v3_source: seededV3Source(),
    conversationCognitionTransport: recordingTransport(productCognitionTransport(), recorder),
    languageTransport: countingLanguageTransport(),
    factualEventAppraisalProvider: appraisal.provider,
    beliefSemanticProvider: new OllamaBeliefSemanticProviderV0({ base_url: BASE_URL, model: MODEL }),
    interval_ticks: 1
  });
  const turns: TurnEvidence[] = [];
  for (const [index, text] of texts.entries()) {
    const turn = await runtime.submitUserText(text);
    turns.push({
      turn_index: turn.turn_index,
      user_text: text,
      status: turn.status,
      subject_text: turn.status === "COMPLETE" ? turn.subject_text : null,
      failure: turn.failure,
      belief_adaptation: turn.belief_adaptation,
      state_revision_before: turn.state_revision_before,
      state_revision_after: turn.state_revision_after,
      repository_revision_before: turn.repository_revision_before,
      repository_revision_after: turn.repository_revision_after
    });
    if (turn.status !== "COMPLETE") break;
    void index;
  }
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(JSON.stringify(await runtime.snapshot())) as unknown;
  } catch (error) {
    // Honest failure record: mandatory pending work could not drain (e.g. a
    // fail-closed appraisal rejection). The turn evidence above stays valid.
    snapshot = { snapshot_failed: error instanceof Error ? error.message : String(error) };
  }
  return { turns, snapshot, appraisalCalls: appraisal.stats.callCount() };
}

function beliefLineOf(recorder: RequestRecorder, requestIndex: number): string | null {
  const request = recorder.requests[requestIndex];
  if (request === undefined) return null;
  const user = request.messages.find((m) => m.role === "user")?.content ?? "";
  const match = new RegExp(`\\{\\"proposition_id\\":\\"${TARGET_PROP}\\"[^}]*\\}`).exec(user);
  return match?.[0] ?? null;
}

async function commonTest(historyId: "A" | "B", snapshot: unknown): Promise<{
  readonly cognition_request_hash: string | null;
  readonly belief_line: string | null;
  readonly subject_text: string | null;
  readonly turn_status: string;
  readonly belief_adaptation: BeliefAdaptationTurnReportV0 | null;
  readonly cognition_calls: number;
  readonly language_calls: number;
  readonly appraisal_calls: number;
}> {
  const cognitionBefore = cognitionCalls;
  const languageBefore = languageCalls;
  const recorder: RequestRecorder = { requests: [] };
  const appraisal = createProductAppraisalProviderV0({ transport: productAppraisalTransport() });
  const runtime = await InteractiveSubjectRuntimeV0.restore(
    {
      session_id: `belief-evidence-common-${historyId}`,
      subject: { subject_id: SUBJECT_ID, display_name: "Evidence Subject", identity_anchors: [] },
      v3_source: seededV3Source(),
      conversationCognitionTransport: recordingTransport(productCognitionTransport(), recorder),
      languageTransport: countingLanguageTransport(),
      factualEventAppraisalProvider: appraisal.provider,
      beliefSemanticProvider: new OllamaBeliefSemanticProviderV0({ base_url: BASE_URL, model: MODEL }),
      interval_ticks: 1
    },
    snapshot as never
  );
  const turn = await runtime.submitUserText("Alice just promised to help me move apartments next weekend.");
  return {
    cognition_request_hash: recorder.requests[0] === undefined
      ? null
      : `${recorder.requests[0].messages.map((m) => `${m.role}:${m.content.length}`).join("|")}`,
    belief_line: beliefLineOf(recorder, 0),
    subject_text: turn.status === "COMPLETE" ? turn.subject_text : null,
    turn_status: turn.status,
    belief_adaptation: turn.belief_adaptation,
    cognition_calls: cognitionCalls - cognitionBefore,
    language_calls: languageCalls - languageBefore,
    appraisal_calls: appraisal.stats.callCount()
  };
}

async function main(): Promise<number> {
  const probe = await fetch(`${BASE_URL.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(10_000) });
  if (!probe.ok) {
    console.error(`provider unavailable: HTTP ${probe.status}`);
    return 1;
  }

  // §27: SAME everything; ONLY lived evidence differs. No belief instructions.
  const historyA = await runHistory("A", [
    "Alice promised to water my plants while I was away, and she did it every single day exactly as she said.",
    "Alice said she would return my ladder by Friday, and she brought it back Thursday evening, right on time."
  ]);
  const historyB = await runHistory("B", [
    "Alice promised to water my plants while I was away, but she forgot the whole week and the plants died.",
    "Alice said she would return my ladder by Friday, but a month has passed and she has not returned it."
  ]);
  const commonFailed = (history: { readonly snapshot: unknown }): string | null =>
    (history.snapshot as { snapshot_failed?: string } | null)?.snapshot_failed ?? null;
  const commonA = commonFailed(historyA) !== null ? null : await commonTest("A", historyA.snapshot);
  const commonB = commonFailed(historyB) !== null ? null : await commonTest("B", historyB.snapshot);

  const evidenceDir = join(import.meta.dirname, "evidence", "run-1-real-provider");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "history-a.json"), JSON.stringify(historyA, null, 2));
  writeFileSync(join(evidenceDir, "history-b.json"), JSON.stringify(historyB, null, 2));
  writeFileSync(join(evidenceDir, "common-test.json"), JSON.stringify({ commonA, commonB }, null, 2));

  const accounting = {
    belief_semantic_calls: 0,
    appraisal_calls:
      historyA.appraisalCalls +
      historyB.appraisalCalls +
      (commonA?.appraisal_calls ?? 0) +
      (commonB?.appraisal_calls ?? 0),
    cognition_calls: cognitionCalls,
    language_calls: languageCalls
  };
  // Belief semantic calls are observable through the frozen turn reports (§76).
  const beliefCalls =
    [...historyA.turns, ...historyB.turns].reduce(
      (sum, turn) => sum + (turn.belief_adaptation?.current?.provider_calls ?? 0) + (turn.belief_adaptation?.resumed ?? []).reduce((s, r) => s + r.provider_calls, 0),
      0
    ) + (commonA?.belief_adaptation?.current?.provider_calls ?? 0) + (commonB?.belief_adaptation?.current?.provider_calls ?? 0);
  accounting.belief_semantic_calls = beliefCalls;

  writeFileSync(join(evidenceDir, "summary.json"), JSON.stringify({ accounting, commonA, commonB }, null, 2));

  console.log("=== BELIEF_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — real validation ===");
  for (const [id, history] of [["A", historyA], ["B", historyB]] as const) {
    for (const turn of history.turns) {
      const current = turn.belief_adaptation?.current ?? null;
      console.log(
        `History ${id} turn ${turn.turn_index} [${turn.status}] ` +
          `belief: ${current?.terminal_kind ?? "n/a"} ` +
          `${current?.proposition_id ?? ""} ${current?.prior_credence ?? ""} -> ${current?.next_credence ?? ""} ` +
          `(provider_calls ${current?.provider_calls ?? 0})`
      );
    }
  }
  for (const [id, common] of [["A", commonA], ["B", commonB]] as const) {
    if (common === null) {
      console.log(`Common ${id}: SKIPPED (history snapshot unavailable — see history evidence)`);
    } else {
      console.log(`Common ${id}: status ${common.turn_status}, belief line: ${common.belief_line}`);
    }
  }
  console.log(`Call accounting (§76): ${JSON.stringify(accounting)}`);
  console.log(`Evidence written to ${evidenceDir}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
