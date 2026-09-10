/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Bounded repair-slice utility over frozen built production roots: deterministic provider-content audit (zero model calls) and a ≤4-call real provider smoke. */

/**
 * DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_V0 — bounded repair utility.
 *
 *   node .../cli.ts audit <outdir>  — deterministic provider-surface audit over
 *                                     the FROZEN future-divergence projections
 *                                     (zero model calls)
 *   node .../cli.ts smoke <outdir>  — real qwen3.5:9b smoke (≤4 cognition
 *                                     calls, 0 language calls)
 *
 * This is a measurement-surface repair, not a scientific experiment: it does
 * not rerun DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ConversationCognitionProviderV1 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider.js";
import { OllamaNativeCognitionTransportV0 } from "../../../packages/runtime/dist/providers/cognition/ollama-native-cognition-transport.js";

const FROZEN_AUDIT =
  "research/experiments/durable-life-history-future-behavior-divergence-v0/evidence/run-1-real-provider/future-input-diff-audit.json";
const REPAIR_VERSION = "DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_V0";
const DIGEST = "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7";

interface ProjectionLike {
  readonly [key: string]: unknown;
  readonly projection_hash: string;
}

const command = process.argv[2];
const outdir = process.argv[3];
if (typeof command !== "string" || typeof outdir !== "string") {
  throw new Error("usage: cli.ts <audit|smoke> <outdir>");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

/** Deterministic render of the production provider request (zero model calls):
 * the transport captures the exact messages the provider assembled and returns
 * a minimal valid proposal so the provider completes its own validation path. */
async function renderRequest(projection: ProjectionLike): Promise<string> {
  let captured = "";
  const provider = new ConversationCognitionProviderV1({
    complete: async (request: { messages: { role: string; content: string }[] }) => {
      captured = request.messages.find((message) => message.role === "user")?.content ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projection.projection_hash,
            reasoning_summary: "audit capture",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: null,
            confidence: 0.5,
            uncertainty: 0.5,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "audit-fake"
      };
    }
  } as never);
  await provider.propose(projection as never);
  return captured;
}

const frozenAudit = JSON.parse(readFileSync(FROZEN_AUDIT, "utf8")) as {
  projections: Record<string, ProjectionLike>;
  production_evidence_bundles: Record<string, { entries: { kind: string; exact_outcome_text?: string; delivered_behavior_text?: string }[] }>;
};
const ARMS = ["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const;

/** §25 — classify every differing rendered line. */
function classifyLine(line: string): string {
  const trimmed = line.trim();
  if (line.startsWith("[projection_hash]")) return "EXPECTED_DERIVED_HASH";
  if (line.startsWith("[affect (canonical)]")) return "EXPECTED_BOUNDED_AFFECT_RESIDUAL";
  if (/^(episode_ref|experience_ref|event_ref|actor_ref):/.test(trimmed)) return "EXPECTED_REF_IDENTITY";
  if (/^(delivered_behavior_text|outcome_reply_text|scene):/.test(trimmed)) return "EXPECTED_MEMORY_CONTENT";
  if (line.startsWith("- ")) return "EXPECTED_MEMORY_CONTENT";
  return "UNEXPECTED_CONFOUND";
}

function affectValence(line: string): number {
  const match = /valence=(-?[0-9.eE+-]+)/.exec(line);
  if (match === null) throw new Error(`affect line unparsable: ${line}`);
  return Number(match[1]);
}

if (command === "audit") {
  mkdirSync(outdir, { recursive: true });
  const rendered: Record<string, string> = {};
  for (const arm of ARMS) {
    rendered[arm] = await renderRequest(frozenAudit.projections[arm]!);
  }
  const linesA = rendered["MEM_A"]!.split("\n");
  const linesB = rendered["MEM_B"]!.split("\n");
  const differing: { index: number; line_a: string; line_b: string; classification: string }[] = [];
  for (let i = 0; i < Math.max(linesA.length, linesB.length); i += 1) {
    if (linesA[i] !== linesB[i]) {
      differing.push({
        index: i,
        line_a: linesA[i] ?? "",
        line_b: linesB[i] ?? "",
        classification: classifyLine(linesA[i] ?? linesB[i] ?? "")
      });
    }
  }
  const counts = differing.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.classification] = (acc[entry.classification] ?? 0) + 1;
    return acc;
  }, {});
  const memoryBlockOf = (text: string): string => {
    const start = text.indexOf("[PRIOR FACTUAL MEMORY");
    const end = text.indexOf("[END HISTORICAL FACTUAL CONTENT]", start);
    return start < 0 ? "" : text.slice(start, end + "[END HISTORICAL FACTUAL CONTENT]".length);
  };
  const blockA = memoryBlockOf(rendered["MEM_A"]!);
  const blockB = memoryBlockOf(rendered["MEM_B"]!);
  const sharedOutsideMemory = (() => {
    const strip = (text: string): string =>
      text
        .replace(memoryBlockOf(text), "")
        .replace(/^\[affect \(canonical\)\].*$/m, "")
        .replace(/^\[projection_hash\].*$/m, "");
    return strip(rendered["MEM_A"]!) === strip(rendered["MEM_B"]!);
  })();
  const affectResidual = Math.abs(
    affectValence(linesA.find((line) => line.startsWith("[affect (canonical)]")) ?? "valence=0") -
    affectValence(linesB.find((line) => line.startsWith("[affect (canonical)]")) ?? "valence=0")
  );

  const audit = {
    schema_version: "durable-memory-cognition-provider-surface-repair-provider-content-diff-v0",
    repair_version: REPAIR_VERSION,
    source: {
      frozen_experiment: "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0",
      frozen_evidence: FROZEN_AUDIT,
      real_model_calls: 0
    },
    arms_rendered: [...ARMS],
    memory_section_present: Object.fromEntries(ARMS.map((arm) => [arm, memoryBlockOf(rendered[arm]!).length > 0])),
    rendered_a_vs_b: {
      differ: rendered["MEM_A"] !== rendered["MEM_B"],
      line_counts: [linesA.length, linesB.length],
      structurally_equal: linesA.length === linesB.length,
      differing_lines: differing,
      classification_counts: counts,
      unexpected_confound_count: counts["UNEXPECTED_CONFOUND"] ?? 0,
      shared_outside_memory_block_except_affect_and_hash: sharedOutsideMemory,
      affect_residual_absolute: affectResidual,
      affect_residual_below_threshold: affectResidual < 0.001
    },
    retrieved_evidence: {
      MEM_A: frozenAudit.production_evidence_bundles["MEM_A"],
      MEM_B: frozenAudit.production_evidence_bundles["MEM_B"]
    },
    rendered_memory_block: { MEM_A: blockA, MEM_B: blockB },
    rendered_blocks_differ: blockA !== blockB,
    shared_surrounding_context: sharedOutsideMemory
  };
  writeJson(join(outdir, "provider-content-diff.json"), audit);
  console.log(`AUDIT COMPLETE: blocks differ ${blockA !== blockB}; differing lines ${differing.length}; confounds ${counts["UNEXPECTED_CONFOUND"] ?? 0}`);
} else if (command === "smoke") {
  mkdirSync(join(outdir, "real-smoke"), { recursive: true });
  const smokeDir = resolve(outdir, "real-smoke");

  // Provider preflight — probe retry only (never a generation retry).
  const probeOnce = async (): Promise<{ reachable: boolean; version: string | null; digest: string | null; failure: string | null }> => {
    try {
      const tags = await fetch("http://127.0.0.1:11434/api/tags");
      const version = await fetch("http://127.0.0.1:11434/api/version");
      const body = await tags.json() as { models?: { name?: string; digest?: string }[] };
      const model = (body.models ?? []).find((entry) => entry.name === "qwen3.5:9b");
      const versionBody = await version.json() as { version?: string };
      return {
        reachable: true,
        version: versionBody.version ?? null,
        digest: model?.digest ?? null,
        failure: model === undefined ? "model qwen3.5:9b not listed" : null
      };
    } catch (error) {
      return { reachable: false, version: null, digest: null, failure: String(error).slice(0, 200) };
    }
  };
  let probe = await probeOnce();
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    if (probe.reachable && probe.digest === DIGEST) break;
    await new Promise((sleep) => setTimeout(sleep, 2000));
    probe = await probeOnce();
  }
  if (!probe.reachable || probe.digest !== DIGEST) {
    writeJson(join(smokeDir, "provider-preflight.json"), {
      schema_version: "durable-memory-cognition-provider-surface-repair-preflight-v0",
      repair_version: REPAIR_VERSION,
      reachable: probe.reachable,
      ollama_version: probe.version,
      model: "qwen3.5:9b",
      digest: probe.digest,
      digest_matches_required: probe.digest === DIGEST,
      failure: probe.failure
    });
    throw new Error(`REAL_PROVIDER_UNAVAILABLE: ${probe.failure ?? "digest mismatch"}`);
  }
  writeJson(join(smokeDir, "provider-preflight.json"), {
    schema_version: "durable-memory-cognition-provider-surface-repair-preflight-v0",
    repair_version: REPAIR_VERSION,
    reachable: true,
    ollama_version: probe.version,
    model: "qwen3.5:9b",
    digest: probe.digest,
    digest_matches_required: true,
    settings: { temperature: 0, think: false, stream: false, retries: 0, seed: null, num_predict: 2048, timeout_ms: 120000 },
    planned_cognition_calls: ARMS.length,
    planned_language_calls: 0
  });

  const requests: string[] = [];
  const responses: string[] = [];
  const rows: unknown[] = [];
  for (const arm of ARMS) {
    const projection = frozenAudit.projections[arm]!;
    const transport = new OllamaNativeCognitionTransportV0({
      base_url: "http://127.0.0.1:11434",
      model: "qwen3.5:9b",
      timeout_ms: 120000,
      num_predict: 2048
    });
    let userContent = "";
    const recordingTransport = {
      complete: async (request: { messages: { role: string; content: string }[] }) => {
        userContent = request.messages.find((message) => message.role === "user")?.content ?? "";
        return transport.complete(request as never);
      }
    };
    const recordingProvider = new ConversationCognitionProviderV1(recordingTransport as never);
    const started = Date.now();
    let status = "VALID";
    let detail: string | null = null;
    let proposal: unknown = null;
    try {
      proposal = await recordingProvider.propose(projection as never);
    } catch (error) {
      status = (error as { code?: string }).code ?? "OTHER_RUNTIME_FAILURE";
      detail = String((error as Error).message).slice(0, 400);
    }
    const evidenceText = frozenAudit.production_evidence_bundles[arm]?.entries
      .map((entry) => entry.delivered_behavior_text ?? entry.exact_outcome_text ?? "")
      .filter((text) => text.length > 0) ?? [];
    requests.push(JSON.stringify({
      arm,
      projection_hash: projection.projection_hash,
      rendered_user_content: userContent,
      factual_text_present: evidenceText.every((text) => userContent.includes(JSON.stringify(text))),
      memory_section_present: userContent.includes("PRIOR FACTUAL MEMORY")
    }));
    responses.push(JSON.stringify({
      arm,
      status,
      detail,
      raw_response: status === "VALID" ? JSON.stringify(proposal) : null
    }));
    rows.push({
      arm,
      status,
      latency_ms: Date.now() - started,
      projection_hash: projection.projection_hash,
      factual_text_present: evidenceText.every((text) => userContent.includes(JSON.stringify(text))),
      memory_section_present: userContent.includes("PRIOR FACTUAL MEMORY"),
      detail
    });
    console.log(`[smoke] ${arm}: ${status}${detail === null ? "" : ` (${detail.slice(0, 120)})`}`);
  }
  writeFileSync(join(smokeDir, "requests.jsonl"), requests.join("\n") + "\n");
  writeFileSync(join(smokeDir, "responses.jsonl"), responses.join("\n") + "\n");
  const valid = rows.filter((row) => (row as { status: string }).status === "VALID").length;
  const withMemorySection = rows.filter((row) => (row as { memory_section_present: boolean }).memory_section_present);
  writeJson(join(smokeDir, "summary.json"), {
    schema_version: "durable-memory-cognition-provider-surface-repair-smoke-summary-v0",
    repair_version: REPAIR_VERSION,
    provider: "OLLAMA_NATIVE",
    model: "qwen3.5:9b",
    digest: probe.digest,
    cognition_calls: rows.length,
    language_calls: 0,
    schema_accepted: valid,
    schema_rejected: rows.length - valid,
    all_schema_accepted: valid === rows.length,
    requests_with_memory_section: `${withMemorySection.length}/${rows.length} (the ablated arms intentionally render no memory section)`,
    factual_text_present_in_every_request_with_memory_section: withMemorySection.every((row) => (row as { factual_text_present: boolean }).factual_text_present),
    rows
  });
  console.log(`SMOKE COMPLETE: ${valid}/${rows.length} schema-accepted`);
} else if (command === "resummarize") {
  // Deterministic re-derivation of the smoke summary from the PERSISTED
  // requests/responses (zero model calls) — used to correct aggregate wording
  // without re-running any generation.
  const smokeDir = resolve(outdir, "real-smoke");
  const prior = JSON.parse(readFileSync(join(smokeDir, "summary.json"), "utf8")) as {
    rows: { arm: string; latency_ms: number | null }[];
  };
  const requestRows = readFileSync(join(smokeDir, "requests.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  const responseRows = readFileSync(join(smokeDir, "responses.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  const rows = responseRows.map((response, index) => {
    const request = requestRows.find((candidate) => candidate["arm"] === response["arm"]) ?? requestRows[index]!;
    return {
      arm: response["arm"],
      status: response["status"],
      latency_ms: prior.rows.find((row) => row.arm === response["arm"])?.latency_ms ?? null,
      projection_hash: request["projection_hash"],
      factual_text_present: request["factual_text_present"],
      memory_section_present: request["memory_section_present"],
      detail: response["detail"]
    };
  });
  const withMemorySection = rows.filter((row) => row.memory_section_present);
  writeJson(join(smokeDir, "summary.json"), {
    schema_version: "durable-memory-cognition-provider-surface-repair-smoke-summary-v0",
    repair_version: REPAIR_VERSION,
    provider: "OLLAMA_NATIVE",
    model: "qwen3.5:9b",
    digest: DIGEST,
    cognition_calls: rows.length,
    language_calls: 0,
    schema_accepted: rows.filter((row) => row.status === "VALID").length,
    schema_rejected: rows.filter((row) => row.status !== "VALID").length,
    all_schema_accepted: rows.every((row) => row.status === "VALID"),
    requests_with_memory_section: `${withMemorySection.length}/${rows.length} (the ablated arms intentionally render no memory section)`,
    factual_text_present_in_every_request_with_memory_section: withMemorySection.every((row) => row.factual_text_present === true),
    rows
  });
  console.log(`RESUMMARIZE COMPLETE: ${rows.length} rows re-derived from persisted evidence (0 model calls)`);
} else {
  throw new Error("unknown command; expected audit | smoke | resummarize");
}
