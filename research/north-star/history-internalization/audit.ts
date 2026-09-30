/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * RETURN TO NORTH STAR — CLOSURE + ARCHITECTURE AUDIT. 0 MODEL CALLS. 0 PRODUCTION CHANGES.
 *
 *   node research/north-star/history-internalization/audit.ts <outdir>
 *
 * Two jobs:
 *   1. mechanically verify the frozen D1..D4-C1 results the belief-micro line is being paused on;
 *   2. extract, with file:line provenance, what a lived Experience can ACTUALLY change in current
 *      production — which persistent states are updated, which chains are wired into the per-turn
 *      runtime, and which exist in code but are not driven.
 *
 * The distinction that matters throughout: CODE EXISTING IS NOT EVIDENCE. Each path is labelled with
 * both its wiring status and its evidence status.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

const E = "research/experiments";
const D1 = `${E}/belief-state-sensitivity-d1/evidence/run-001`;
const D2 = `${E}/belief-causal-path-d2/evidence/run-001`;
const D3 = `${E}/belief-semantic-binding-d3/evidence/run-001`;
const D4 = `${E}/belief-cross-expression-d4/evidence`;
const C1 = `${E}/belief-representation-comparator-d4-c1/evidence`;
const CLOSURE = `${E}/belief-causal-path-closure/evidence/v1`;
const RT = "packages/runtime/src";
const D1_PROJECTION = "characteros-next/research/d1-belief-state-sensitivity/v1" as const;
const D2_PROJECTION = "characteros-next/research/d2-belief-causal-path/v1" as const;
const D3_PROJECTION = "characteros-next/research/d3-belief-semantic-binding/v1" as const;
const D4_PROJECTION = "characteros-next/research/d4-cross-expression-composition/v1" as const;

const problems: string[] = [];

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/** Extracts the source lines around a pattern, for provenance. */
async function extract(path: string, pattern: RegExp, context = 2): Promise<{ file: string; line: number; text: string }[]> {
  const lines = (await readFile(path, "utf8")).split("\n");
  const out: { file: string; line: number; text: string }[] = [];
  for (const [index, text] of lines.entries()) {
    if (pattern.test(text)) {
      out.push({ file: path, line: index + 1, text: lines.slice(Math.max(0, index - context), index + context + 1).join("\n") });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ===================== 1. THE FROZEN RESULTS THE PAUSE RESTS ON ==============================
  const d1Hash = (await readJson<{ CORE_TREATMENT_DATASET_SHA256: string }>(`${D1}/core-treatment/core-treatment-dataset-hash.json`)).CORE_TREATMENT_DATASET_SHA256;
  const d1Verdict = await readJson<Record<string, unknown>>(`${D1}/core-treatment/core-scientific-verdict.json`);
  const a0Hash = (await readJson<{ A0_STATE_EXPERIMENT_DATASET_SHA256: string }>(`${D2}/a0-state-experiment/a0-state-dataset-hash.json`)).A0_STATE_EXPERIMENT_DATASET_SHA256;
  const a1Hash = (await readJson<{ A1_STATE_EXPERIMENT_DATASET_SHA256: string }>(`${D2}/a1-state-experiment/a1-state-dataset-hash.json`)).A1_STATE_EXPERIMENT_DATASET_SHA256;
  const d3Hash = (await readJson<{ D3_B_TARGET_DATASET_SHA256: string }>(`${D3}/d3-b-target/target-dataset-hash.json`)).D3_B_TARGET_DATASET_SHA256;
  const c0aHash = (await readJson<{ D4_C0A_TARGET_DATASET_SHA256: string }>(`${D4}/d4-c0a-target/target-dataset-hash.json`)).D4_C0A_TARGET_DATASET_SHA256;
  const c1Hash = (await readJson<{ D4_C1_COMPARATOR_TARGET_DATASET_SHA256: string }>(`${C1}/comparator-target/comparator-target-dataset-hash.json`)).D4_C1_COMPARATOR_TARGET_DATASET_SHA256;
  const closureVerdict = await readJson<{ verdicts: string[]; evidence_integrity: string }>(`${CLOSURE}/CLOSURE_VERDICT.json`);

  const recompute = async (label: string, path: string, projection: string, recorded: string) => {
    const content = await readFile(path, "utf8");
    const recomputed = String(await hashEnvelope(projection, { name: path.split("/").pop() as string, content }));
    const matches = recomputed === recorded;
    if (!matches) problems.push(`${label}: ${recorded} != ${recomputed}`);
    return { label, path, recorded, matches };
  };
  // D1 uses its own freeze convention — hashEnvelope(projection, { dataset }) over the sorted records
  // array — not the { name, content } convention of D2/D3/D4. This exact mismatch was recorded as a
  // protocol lesson during the belief-line closure; the convention is applied, not re-derived.
  const d1Doc = await readJson<{ dataset: unknown }>(`${D1}/core-treatment/core-treatment-dataset.json`);
  const d1Recomputed = String(await hashEnvelope(D1_PROJECTION, { dataset: d1Doc.dataset }));
  if (d1Recomputed !== d1Hash) problems.push(`D1 core-treatment dataset: ${d1Hash} != ${d1Recomputed}`);
  const frozen = [
    { label: "D1 core-treatment dataset (D1 convention)", path: `${D1}/core-treatment/core-treatment-dataset.json`, recorded: d1Hash, matches: d1Recomputed === d1Hash },
    await recompute("D2-A0 state dataset", `${D2}/a0-state-experiment/a0-state-dataset.json`, D2_PROJECTION, a0Hash),
    await recompute("D2-A1 state dataset", `${D2}/a1-state-experiment/a1-state-dataset.json`, D2_PROJECTION, a1Hash),
    await recompute("D3-B target dataset", `${D3}/d3-b-target/target-dataset.json`, D3_PROJECTION, d3Hash),
    await recompute("D4-C0a target dataset", `${D4}/d4-c0a-target/target-dataset.json`, D4_PROJECTION, c0aHash),
    await recompute("D4-C1 comparator dataset", `${C1}/comparator-target/comparator-target-dataset.json`, D4_PROJECTION, c1Hash)
  ];

  const beliefLine = {
    D1: { verdict: "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED", collection: d1Verdict["collection"], dataset: d1Hash },
    D2_A0: { verdict: "CANONICAL_PROPOSITION_STANCE_BINDING_ESTABLISHED", dataset: a0Hash },
    D2_A1: { verdict: "CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED_ON_PREREGISTERED_PARAPHRASE", dataset: a1Hash, class: "VALID_NULL" },
    D3_B: { verdict: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED", dataset: d3Hash, evidence_class: "EXECUTOR_STATE_BLIND_CAPABILITY" },
    D4_C0a: { verdict: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED", dataset: c0aHash },
    D4_C1: {
      verdict: "CHARACTEROS_BELIEF_RECORD_SUPPORTS_STATE_BLIND_CROSS_EXPRESSION_COMPOSITION",
      dataset: c1Hash,
      four_cells: "6/6 in the predicted direction in all four cells",
      consequence: "H_REPRESENTATION_FORM: SUBSTANTIALLY_WEAKENED"
    },
    closure_verdicts: closureVerdict.verdicts,
    closure_integrity: closureVerdict.evidence_integrity
  };

  // ===================== 2. WHAT LIVED EXPERIENCE CAN ACTUALLY CHANGE ==========================
  const runtime = `${RT}/session/interactive-subject-runtime-v0.ts`;
  const authority = `${RT}/session/explicit-v4-session-authority-v0.ts`;
  const evidenceWrite = await extract(runtime, /recordObservationalExperience|recordReply\(/, 3);
  const threeChains = await extract(runtime, /runLivedEvidence(Belief|Personality|RelationshipFamiliarity)Adaptation|runLivedEvidenceRelationshipFamiliarity/, 3);
  const orderingLaw = await extract(runtime, /no same-turn self-causation|strictly AFTER this turn's/, 2);
  const personalityOptional = await extract(authority, /personalityAdaptationFactory === undefined/, 3);
  const beliefDurable = await extract(`${RT}/session/belief-adaptation-wiring-v0.ts`, /durable, restored with session/, 3);
  const affectWiring = await extract(`${RT}/transitions/affect-application/affect-application-executor-v0.ts`, /BOUNDED_AFFECT_DYNAMICS_V0|DISPOSITION GATE/, 2);

  const paths = [
    {
      id: "EXPERIENCE_TO_BELIEF",
      link: "experience -> canonical belief state",
      mechanism: "the turn's newly committed lived episode is offered to the frozen belief plasticity chain",
      wiring_status: "WIRED_AND_DRIVEN_PER_TURN",
      evidence_status: "PARTIAL: D1 established that an AUTHORED credence difference is lawful and isolated; whether LIVED evidence moves credence through this chain has not been measured",
      persistence: "durable belief-adaptation workflow store, restored with the session; write-once terminals; one deterministic workflow id per (subject, evidence set)",
      is_the_v1_candidate_primary_channel: true,
      provenance: [...evidenceWrite, ...threeChains.filter((c) => c.text.includes("Belief")), ...beliefDurable]
    },
    {
      id: "EXPERIENCE_TO_RELATIONSHIP_FAMILIARITY",
      link: "experience -> canonical relationship familiarity",
      mechanism: "the same newly committed lived episode is offered to the frozen familiarity chain",
      wiring_status: "WIRED_AND_DRIVEN_PER_TURN",
      evidence_status: "CODE_WITHOUT_EXPERIMENTAL_EVIDENCE",
      persistence: "canonical relationship state",
      is_the_v1_candidate_primary_channel: false,
      provenance: threeChains.filter((c) => c.text.includes("Relationship") || c.text.includes("RELATIONSHIP"))
    },
    {
      id: "EXPERIENCE_TO_PERSONALITY",
      link: "experience -> canonical personality",
      mechanism: "the same episode is offered to the frozen personality plasticity chain, through an OPTIONAL composition-layer factory",
      wiring_status: "NOT_DRIVEN_IN_CURRENT_PRODUCTION: the factory is optional and nothing outside the runtime supplies it, so the port is null",
      evidence_status: "INACTIVE_IN_PRODUCTION",
      persistence: "would be the canonical personality dimension block",
      is_the_v1_candidate_primary_channel: false,
      provenance: personalityOptional
    },
    {
      id: "EXPERIENCE_TO_AFFECT",
      link: "experience -> canonical affect",
      mechanism: "an affect impulse consumed from ONE verified canonical INITIAL Appraisal for one authoritative factual event, with exactly-once accounting",
      wiring_status: "PRESENT_BUT_NOT_WIRED_TO_TURNS: the executor is instantiated only inside its own module, and a test asserts it is not exported from the runtime index",
      evidence_status: "NOT_DRIVEN_IN_PRODUCTION",
      persistence: "would be a canonical affect commit",
      is_the_v1_candidate_primary_channel: false,
      provenance: affectWiring
    },
    {
      id: "CAUSAL_ORDERING_LAW",
      link: "turn boundary",
      mechanism: "all lived-evidence adaptation runs strictly AFTER cognition, delivery and memory admission",
      wiring_status: "FROZEN_PRODUCTION_LAW",
      evidence_status: "documented in the production source; it is what makes turn N's learned state influence only turn N+1",
      persistence: "n/a",
      is_the_v1_candidate_primary_channel: false,
      provenance: orderingLaw
    }
  ];

  if (problems.length > 0) {
    await write("AUDIT_BLOCKED.json", { problems, model_calls: 0 });
    throw new Error(`AUDIT_BLOCKED: ${problems.join(" ; ")}`);
  }

  await write("frozen-belief-line-verification.json", { frozen, beliefLine, all_reproduce: true, model_calls: 0 });
  await write("CURRENT_EXPERIENCE_INTERNALIZATION_PATHS.json", {
    question: "what can a lived Experience ACTUALLY change in current production?",
    method: "extracted from production source with file:line provenance; code existing is not evidence",
    paths,
    summary: {
      driven_per_turn: paths.filter((p) => p.wiring_status === "WIRED_AND_DRIVEN_PER_TURN").map((p) => p.id),
      present_but_not_driven: paths.filter((p) => !p.wiring_status.startsWith("WIRED")).map((p) => p.id),
      the_v1_experiment_is_runnable_on: "EXPERIENCE_TO_BELIEF"
    },
    provenance_lines: {
      evidence_write: evidenceWrite
    }
  });

  process.stdout.write(
    `BELIEF LINE: all ${String(frozen.length)} frozen datasets recompute\n` +
      `driven per turn: ${paths.filter((p) => p.wiring_status === "WIRED_AND_DRIVEN_PER_TURN").map((p) => p.id).join(", ")}\n` +
      `present but not driven: ${paths.filter((p) => !p.wiring_status.startsWith("WIRED")).map((p) => p.id).join(", ")}\n` +
      `MODEL_CALLS_THIS_ROUND = 0\n`
  );
}

await main();
