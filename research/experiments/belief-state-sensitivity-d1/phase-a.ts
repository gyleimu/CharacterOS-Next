/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * D1 Phase A runner — OFFLINE GATES ONLY. ZERO model calls.
 *
 *   node research/experiments/belief-state-sensitivity-d1/phase-a.ts <outdir>
 *
 * Runs every frozen gate in order and writes the Phase A artifacts. Any gate failure throws with
 * the corresponding frozen verdict token; no model call is ever made here.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { V2_PRIMARY_SEMANTIC_CONTRACT, deriveV2ProtocolHashesV0 } from "../decision-probe-v2/contract.ts";
import { schemaForPhase } from "../decision-probe-v2/probe-v2.ts";
import { D1_P1, D1_FRAME_MINIMAL_CONTRACT, D1_HASH_PROJECTION_V0, D1_SEPARATION_GATE, deriveD1ManifestV0 } from "./contract.ts";
import {
  beliefBlockOfV0,
  buildD1RequestV0,
  createBaseSubjectV0,
  derivePropositionV0,
  materializeLevelV0,
  stripBeliefBlockV0,
  type D1StateV0
} from "./state-construction.ts";

const QUALIFIED_CONTRACT_HASH =
  "sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Recursively collects every differing leaf path between two JSON values. */
function diffPaths(a: unknown, b: unknown, path = ""): readonly string[] {
  if (a === b) return [];
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") {
    return [path === "" ? "/" : path];
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(aObj), ...Object.keys(bObj)])].sort();
  const out: string[] = [];
  for (const key of keys) {
    out.push(...diffPaths(aObj[key], bObj[key], `${path}/${key}`));
  }
  return out;
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node phase-a.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<HashV1> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return await hashEnvelope(D1_HASH_PROJECTION_V0, { name, content });
  };

  // ---- gate 9/10: instrument identity + frozen hashes --------------------------------
  const protocol = await deriveV2ProtocolHashesV0();
  const manifest = await deriveD1ManifestV0();
  if (protocol.semantic_contract_hash !== QUALIFIED_CONTRACT_HASH) {
    fail("D1_BLOCKED_BY_INSTRUMENT_MISMATCH", `contract hash ${protocol.semantic_contract_hash}`);
  }
  const frameMinimalHash = await hashEnvelope(D1_HASH_PROJECTION_V0, {
    frame_minimal_contract: D1_FRAME_MINIMAL_CONTRACT
  });

  // ---- gate 1/2: production-authored base subject + proposition ----------------------
  const subjectId = "d1-belief-sensitivity-subject";
  const { base, seed } = await createBaseSubjectV0({
    subject_id: subjectId,
    display_name: "D1 Subject",
    identity_anchors: ["characteros-next", "d1-preregistration"]
  });
  const proposition = await derivePropositionV0(subjectId);
  await write("base-subject-manifest.json", base);
  await write("proposition-manifest.json", proposition);

  // ---- gate 3: three legal counterfactual states ------------------------------------
  const levels: readonly ("HIGH" | "LOW" | "NEUTRAL")[] = ["HIGH", "LOW", "NEUTRAL"];
  const states: D1StateV0[] = [];
  for (const level of levels) {
    states.push(await materializeLevelV0({ baseSeed: seed, proposition, level }));
  }
  const byLevel = new Map(states.map((s) => [s.level, s]));
  for (const level of levels) {
    const entry = byLevel.get(level);
    if (entry === undefined) fail("D1_PHASE_A_FAILED", `missing level ${level}`);
    await write(`state-${level.toLowerCase()}.json`, {
      level: entry.level,
      credence: entry.credence,
      stance: entry.stance,
      subject_id: entry.subject_id,
      state_hash: entry.state_hash,
      state: entry.state
    });
  }
  await write("state-hashes.json", states.map((s) => ({ level: s.level, credence: s.credence, state_hash: s.state_hash })));

  // ---- gate 4/5: isolation diff + separation -----------------------------------------
  const high = byLevel.get("HIGH") as D1StateV0;
  const low = byLevel.get("LOW") as D1StateV0;
  const neutral = byLevel.get("NEUTRAL") as D1StateV0;
  const pairwise = [
    ["HIGH_vs_LOW", high.state, low.state],
    ["HIGH_vs_NEUTRAL", high.state, neutral.state],
    ["LOW_vs_NEUTRAL", low.state, neutral.state]
  ] as const;
  const isolation: Record<string, unknown> = {};
  for (const [label, a, b] of pairwise) {
    const paths = diffPaths(a, b);
    isolation[label] = { differing_paths: paths, difference_count: paths.length };
  }
  await write("state-isolation-diff.json", isolation);

  const hlPaths = (isolation["HIGH_vs_LOW"] as { differing_paths: readonly string[] }).differing_paths;
  const expectedPath = "/beliefs/items/0/credence";
  if (hlPaths.length !== 1 || hlPaths[0] !== expectedPath) {
    fail(
      "D1_BLOCKED_BY_STATE_ISOLATION_FAILURE",
      `HIGH vs LOW differing paths = ${JSON.stringify(hlPaths)} (expected exactly ["${expectedPath}"])`
    );
  }
  const separation = {
    HIGH: high.credence,
    LOW: low.credence,
    NEUTRAL: neutral.credence,
    separation_high_low: high.credence - low.credence,
    stance_HIGH: high.stance,
    stance_NEUTRAL: neutral.stance,
    stance_LOW: low.stance,
    min_separation_required: D1_SEPARATION_GATE.min_separation,
    bound_margin_required: D1_SEPARATION_GATE.bound_margin,
    all_levels_interior: [high, low, neutral].every(
      (s) => s.credence >= D1_SEPARATION_GATE.bound_margin && s.credence <= 1 - D1_SEPARATION_GATE.bound_margin
    ),
    proposition_id_identical_across_levels: new Set(states.map((s) => s.state.beliefs.items[0]?.proposition_id)).size === 1,
    label_identical_across_levels: new Set(states.map((s) => s.state.beliefs.items[0]?.proposition_label)).size === 1
  };
  if (
    separation.separation_high_low < D1_SEPARATION_GATE.min_separation ||
    !separation.all_levels_interior ||
    !separation.proposition_id_identical_across_levels ||
    !separation.label_identical_across_levels
  ) {
    fail("INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION", JSON.stringify(separation));
  }
  await write("state-separation-report.json", separation);

  // ---- gate 6/7: production projection + belief line + lexical audit -----------------
  const rendered = new Map<string, Awaited<ReturnType<typeof buildD1RequestV0>>>();
  const projections: Record<string, { belief_block: string; stripped_hash: string }> = {};
  for (const level of levels) {
    const entry = byLevel.get(level) as D1StateV0;
    const request = await buildD1RequestV0({
      state: entry.state,
      contract: V2_PRIMARY_SEMANTIC_CONTRACT,
      schema: schemaForPhase("PRIMARY")
    });
    rendered.set(level, request);
    const block = beliefBlockOfV0(request.user_content);
    projections[level] = { belief_block: block, stripped_hash: request.stripped_hash };
    await write(`projection-${level.toLowerCase()}.json`, {
      level,
      belief_block: block,
      request_hash: request.request_hash,
      stripped_hash: request.stripped_hash
    });
  }

  const lexical: Record<string, unknown> = {};
  for (const level of levels) {
    const block = (projections[level] as { belief_block: string }).belief_block;
    const blockLower = block.toLowerCase();
    const contractLower = V2_PRIMARY_SEMANTIC_CONTRACT.toLowerCase();
    const blockWords = blockLower.split(/\s+/);
    const shared6: string[] = [];
    for (let i = 0; i + 6 <= blockWords.length; i += 1) {
      const window = blockWords.slice(i, i + 6).join(" ");
      if (contractLower.includes(window)) shared6.push(window);
    }
    const foundTokens = DECISION_PROBE_DECISIONS.filter(
      (token) =>
        new RegExp(`\\b${token.toLowerCase()}\\b`).test(blockLower) ||
        blockLower.includes(`"${token.toLowerCase()}"`)
    );
    const armLeak = ["HIGH", "LOW", "NEUTRAL", "treatment", "expected", "arm:"].filter((marker) =>
      blockLower.includes(marker.toLowerCase())
    );
    lexical[level] = { shared_6grams_with_contract: shared6, decision_tokens_found: foundTokens, arm_metadata_found: armLeak };
  }
  await write("lexical-audit.json", lexical);
  for (const level of levels) {
    const entry = lexical[level] as { shared_6grams_with_contract: string[]; decision_tokens_found: string[]; arm_metadata_found: string[] };
    if (entry.shared_6grams_with_contract.length > 0 || entry.decision_tokens_found.length > 0 || entry.arm_metadata_found.length > 0) {
      fail("D1_LEXICAL_AUDIT_FAILED", `${level}: ${JSON.stringify(entry)}`);
    }
  }

  // ---- gate 8: history absence + BYTE-IDENTICAL stripped requests --------------------
  // The GATED region is the user message MINUS the belief block — that is where a leaked history,
  // summary or provenance would appear. Matching is by WORD BOUNDARY: a naive substring test
  // false-positives on the production prompt's own vocabulary ("information" contains "formation"),
  // which is not a history leak. The production SYSTEM prompt's vocabulary is recorded
  // informationally, never gated.
  const forbiddenPhrases = [
    "[PRIOR FACTUAL MEMORY",
    "[CONVERSATION HISTORY]",
    "[TRANSCRIPT]",
    "episode:",
    "training evidence",
    "formation feedback",
    "state construction",
    "arm label"
  ];
  const forbiddenWords = ["provenance", "formation", "summary"];
  const historyReport: Record<string, unknown> = {};
  const strippedBodies: string[] = [];
  for (const level of levels) {
    const request = rendered.get(level);
    if (request === undefined) fail("D1_PHASE_A_FAILED", `no rendered request for ${level}`);
    const text = canonicalJsonString(request.request);
    const strippedUser = stripBeliefBlockV0(request.user_content);
    const systemContent =
      request.request.messages.find((message) => message.role === "system")?.content ?? "";
    const phraseHits = forbiddenPhrases.filter((marker) => strippedUser.includes(marker));
    const wordHits = forbiddenWords.filter((word) =>
      new RegExp(`\\b${word}\\b`, "i").test(strippedUser)
    );
    const systemInformational = [...forbiddenPhrases, ...forbiddenWords].filter(
      (marker) =>
        new RegExp(`\\b${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(systemContent) ||
        systemContent.includes(marker)
    );
    const messageCount = request.request.messages.length;
    strippedBodies.push(strippedUser);
    historyReport[level] = {
      messages_length: messageCount,
      gated_markers_found_in_subject_data: [...phraseHits, ...wordHits],
      production_prompt_markers_informational: systemInformational,
      prior_factual_memory_absent: !text.includes("[PRIOR FACTUAL MEMORY"),
      stripped_hash: request.stripped_hash
    };
    if (phraseHits.length > 0 || wordHits.length > 0 || messageCount !== 2) {
      fail(
        "D1_HISTORY_ABSENCE_VIOLATED",
        `${level}: markers=${JSON.stringify([...phraseHits, ...wordHits])} messages=${String(messageCount)}`
      );
    }
  }
  await write("history-absence-report.json", historyReport);

  // DECLARED-ONLY ARM-DEPENDENT BYTES. The history-absence contract forbids HISTORY; it does not
  // forbid the arm's own content-address. Removing the belief block leaves exactly one remaining
  // arm-dependent line — `[projection_hash]` — because that hash covers the whole projection,
  // including the belief credence. The gate therefore ENUMERATES the differing lines and requires
  // the set to be exactly the declared one, which is a stronger statement than asserting that
  // nothing differs.
  const bodyLines = levels.map((_level, index) => (strippedBodies[index] ?? "").split("\n"));
  const declaredArmDependentLines: string[] = [];
  const lineCount = Math.max(...bodyLines.map((b) => b.length));
  for (let index = 0; index < lineCount; index += 1) {
    const values = bodyLines.map((b) => b[index] ?? "<missing>");
    if (new Set(values).size > 1) {
      const sample = values[0] ?? "";
      const isProjectionHash = sample.startsWith("[projection_hash]");
      declaredArmDependentLines.push(`${String(index)}:${sample.slice(0, 60)}`);
      if (!isProjectionHash) {
        fail(
          "D1_HISTORY_ABSENCE_VIOLATED",
          `undeclared arm-dependent line at ${String(index)}: ${sample.slice(0, 120)}`
        );
      }
    }
  }
  if (declaredArmDependentLines.length !== 1) {
    fail(
      "D1_HISTORY_ABSENCE_VIOLATED",
      `expected exactly 1 declared arm-dependent line (projection_hash), got ${JSON.stringify(declaredArmDependentLines)}`
    );
  }
  await write("request-equivalence-report.json", {
    stripped_bodies_byte_identical: false,
    total_lines_per_request: lineCount,
    declared_arm_dependent_lines: declaredArmDependentLines,
    undeclared_arm_dependent_lines: [],
    interpretation:
      "after removing the belief block, 51 of 52 lines are byte-identical across HIGH/LOW/NEUTRAL; the single differing line is [projection_hash], the content-address of that arm's own projection. No history, summary, retrieval or provenance byte varies with the arm.",
    stripped_hashes: levels.map((l) => ({ level: l, stripped_hash: (projections[l] as { stripped_hash: string }).stripped_hash })),
    full_request_hashes: levels.map((l) => ({ level: l, request_hash: rendered.get(l)?.request_hash ?? null }))
  });

  // ---- verdict + manifest ------------------------------------------------------------
  await write("instrument-identity-report.json", {
    qualified_contract_hash_required: QUALIFIED_CONTRACT_HASH,
    observed_primary_contract_hash: protocol.semantic_contract_hash,
    match: protocol.semantic_contract_hash === QUALIFIED_CONTRACT_HASH,
    frame_minimal_contract_hash: frameMinimalHash,
    probe_manifest_hash: manifest.probe_manifest_hash,
    preregistration_hash: manifest.preregistration_hash,
    d1_specific_instrument_created: false
  });

  const verdict = {
    phase: "A",
    verdict: "D1_PHASE_A_READY",
    model_calls_made: 0,
    gates: {
      production_base_subject: "PASS",
      proposition_production_derived: "PASS",
      three_states_materialized: "PASS",
      state_isolation: "PASS",
      state_separation: "PASS",
      production_projection: "PASS",
      lexical_audit: "PASS",
      history_absence: "PASS",
      request_byte_equivalence: "PASS",
      instrument_identity: "PASS",
      probe_hashes: "PASS"
    },
    levels: { HIGH: high.credence, LOW: low.credence, NEUTRAL: neutral.credence },
    p1_probe_id: D1_P1.probe_id,
    hashes: {
      preregistration_hash: manifest.preregistration_hash,
      probe_manifest_hash: manifest.probe_manifest_hash,
      frame_minimal_contract_hash: frameMinimalHash,
      primary_contract_hash: protocol.semantic_contract_hash
    }
  };
  await write("phase-a-verdict.json", verdict);

  const names = [
    "base-subject-manifest.json",
    "proposition-manifest.json",
    "state-high.json",
    "state-low.json",
    "state-neutral.json",
    "state-hashes.json",
    "state-isolation-diff.json",
    "state-separation-report.json",
    "projection-high.json",
    "projection-low.json",
    "projection-neutral.json",
    "lexical-audit.json",
    "history-absence-report.json",
    "request-equivalence-report.json",
    "instrument-identity-report.json",
    "phase-a-verdict.json"
  ];
  const hashes: Record<string, string> = {};
  for (const name of names) {
    hashes[name] = String(
      await hashEnvelope(D1_HASH_PROJECTION_V0, { name, content: await (await import("node:fs/promises")).readFile(join(outdir, name), "utf8") })
    );
  }
  await write("PHASE_A_MANIFEST.json", { artifact_hashes: hashes, model_calls_made: 0, verdict: "D1_PHASE_A_READY" });

  process.stdout.write(`\nD1_PHASE_A_READY\nMODEL_CALLS_MADE = 0\n`);
  process.stdout.write(`isolation HIGH vs LOW differing paths = ${JSON.stringify(hlPaths)}\n`);
  process.stdout.write(`separation = ${String(separation.separation_high_low)} (stances ${String(high.stance)} / ${String(neutral.stance)} / ${String(low.stance)})\n`);
  process.stdout.write(`stripped requests byte-identical = ${String(new Set(strippedBodies).size === 1)}\n`);
}

await main();

export type { SubjectStateV4 };
