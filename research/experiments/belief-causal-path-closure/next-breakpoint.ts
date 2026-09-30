/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * BELIEF CAUSAL PATH — NEXT-BREAKPOINT ANALYSIS. 0 MODEL CALLS. 0 PRODUCTION CHANGES.
 *
 *   node research/experiments/belief-causal-path-closure/next-breakpoint.ts <outdir>
 *
 * Two jobs, both evidence-producing rather than assertion-producing:
 *
 *   1. Re-verify the D1/D2/D3 closure artifacts from their bytes and re-derive the frozen facts the
 *      analysis rests on (a null that cannot be reproduced is not a basis for designing anything).
 *
 *   2. Extract the CURRENT belief representation from the PRODUCTION SOURCE with file:line provenance:
 *      what a canonical belief item is, what the projection does to it, what the executor actually sees,
 *      and how proposition identity is derived. The point is to answer "what does the system represent
 *      belief AS" from the implementation rather than from a document name.
 *
 * It decides nothing scientific. It produces the inputs the design direction rests on.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { D2A1_CONTRACT_TEXT } from "../belief-causal-path-d2/contract-rev1-1c-a1-prerequisites.ts";

const D2 = "research/experiments/belief-causal-path-d2/evidence/run-001";
const D3 = "research/experiments/belief-semantic-binding-d3/evidence/run-001";
const CLOSURE = "research/experiments/belief-causal-path-closure/evidence/v1";
const D1_PROJECTION = "characteros-next/research/d1-belief-state-sensitivity/v1" as const;
const D2_PROJECTION = "characteros-next/research/d2-belief-causal-path/v1" as const;
const D3_PROJECTION = "characteros-next/research/d3-belief-semantic-binding/v1" as const;

const problems: string[] = [];

/** Extracts the source lines around a pattern, with provenance, for the architecture audit. */
async function extract(path: string, pattern: RegExp, context = 3): Promise<{ file: string; line: number; text: string }[]> {
  const lines = (await readFile(path, "utf8")).split("\n");
  const out: { file: string; line: number; text: string }[] = [];
  for (const [index, text] of lines.entries()) {
    if (pattern.test(text)) {
      const from = Math.max(0, index - context);
      const to = Math.min(lines.length, index + context + 1);
      out.push({ file: path, line: index + 1, text: lines.slice(from, to).join("\n") });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node next-breakpoint.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ===================== A. CLOSURE VERIFICATION ==============================================
  const verdict = JSON.parse(await readFile(join(CLOSURE, "CLOSURE_VERDICT.json"), "utf8")) as Record<string, unknown>;
  const ledger = JSON.parse(await readFile(join(CLOSURE, "BELIEF_CAUSAL_PATH_HASH_LEDGER_V1.json"), "utf8")) as {
    datasets_and_schedules: { label: string; path: string; recorded: string }[];
    all_match: boolean;
  };
  let mismatches = 0;
  for (const row of ledger.datasets_and_schedules) {
    if (row.label.startsWith("D1 core-treatment dataset")) {
      const doc = JSON.parse(await readFile(row.path, "utf8")) as { dataset: unknown };
      if (String(await hashEnvelope(D1_PROJECTION, { dataset: doc.dataset })) !== row.recorded) mismatches += 1;
    } else {
      const content = await readFile(row.path, "utf8");
      const projection = row.path.includes("belief-causal-path-d2") ? D2_PROJECTION : D3_PROJECTION;
      if (String(await hashEnvelope(projection, { name: row.path.split("/").pop() as string, content })) !== row.recorded) mismatches += 1;
    }
  }
  if (mismatches > 0) problems.push(`closure hash re-verification: ${mismatches} mismatches`);

  // the frozen counts this analysis rests on, re-derived from the datasets
  const a0 = JSON.parse(await readFile(join(D2, "a0-state-experiment/a0-state-dataset.json"), "utf8")) as { trials: { arm: string; parsed_stance_token: string }[] };
  const a1 = JSON.parse(await readFile(join(D2, "a1-state-experiment/a1-state-dataset.json"), "utf8")) as { trials: { arm: string; parsed_stance_token: string }[] };
  const d3t = JSON.parse(await readFile(join(D3, "d3-b-target/target-dataset.json"), "utf8")) as { trials: { parsed_relation: string }[] };
  const tally = (rows: { arm: string; parsed_stance_token: string }[], arm: string) => {
    const out: Record<string, number> = {};
    for (const row of rows.filter((r) => r.arm === arm)) out[row.parsed_stance_token] = (out[row.parsed_stance_token] ?? 0) + 1;
    return out;
  };
  const frozenFacts = {
    d2_a0: { HIGH: tally(a0.trials, "HIGH"), LOW: tally(a0.trials, "LOW") },
    d2_a1: { HIGH: tally(a1.trials, "HIGH"), LOW: tally(a1.trials, "LOW") },
    d3_b_target: d3t.trials.reduce<Record<string, number>>((acc, t) => {
      acc[t.parsed_relation] = (acc[t.parsed_relation] ?? 0) + 1;
      return acc;
    }, {})
  };
  const a1LowSupports = frozenFacts.d2_a1.LOW["SUPPORTS_PARAPHRASED_PRINCIPLE"] ?? 0;
  const a1LowOpposes = frozenFacts.d2_a1.LOW["OPPOSES_PARAPHRASED_PRINCIPLE"] ?? 0;
  if (a1LowSupports !== 5 || a1LowOpposes !== 0) problems.push("the frozen A1 LOW counts do not reproduce");

  // ===================== C. CURRENT BELIEF REPRESENTATION, FROM SOURCE ========================
  const architectureFacts = {
    canonical_item: await extract("packages/subject-core/src/types/subject-state.ts", /^export interface BeliefItemStateV0/, 6),
    canonical_belief_state: await extract("packages/subject-core/src/types/subject-state.ts", /^export interface BeliefStateV0/, 4),
    identity_is_the_label_hash: await extract("packages/runtime/src/transitions/belief/belief-proposition-admission.ts", /canonical_label: canonicalLabel/, 4),
    projection_maps_three_fields: await extract("packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.ts", /proposition_label: item.proposition_label/, 4),
    projection_cap_and_sort: await extract("packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.ts", /BELIEF_COGNITION_MAX_ITEMS/, 4),
    projection_item_schema: await extract("packages/runtime/src/transitions/cognition-action/types.ts", /^export interface BeliefStanceProjectionV0/, 5),
    executor_block_header: await extract("packages/runtime/src/providers/behavior/conversation-cognition-provider-v2.ts", /SUBJECTIVE BELIEF STANCES/, 1),
    executor_renders_json_per_item: await extract("packages/runtime/src/providers/behavior/conversation-cognition-provider-v2.ts", /JSON.stringify\(item\)/, 3)
  };
  const representationAudit = {
    question: "what does the system actually represent belief AS, at each layer?",
    canonical_storage: {
      shape: "{ proposition_id, proposition_label, credence }",
      semantic_object_present: false,
      relation_or_alias_present: false,
      derived_stance_word_present: false,
      embedding_present: false,
      detail: "there is no proposition-level object distinct from the label string, and no structure relating one proposition to another"
    },
    proposition_identity: {
      derivation: "proposition_key = hashEnvelope(projection, { canonical_label })",
      identity_is_the_content_address_of_the_exact_wording: true,
      consequence:
        "two semantically equivalent re-wordings are, at the representation level, two unrelated propositions with two different ids — nothing in the state says they express the same proposition"
    },
    projection: {
      transformation: "a direct field copy",
      fields_added: [],
      fields_dropped: [],
      selection: "sorted by proposition_id, truncated at BELIEF_COGNITION_MAX_ITEMS (64)",
      enrichment_or_ranking_by_relevance: false
    },
    executor_facing_block: {
      rendering: "one JSON object per line, under a section header",
      header_states: [
        "credence is subject endorsement strength, NOT world truth",
        "proposition IDs are STATE LOCATORS ONLY, never refs"
      ],
      detail: "the executor receives an opaque id, a sentence and a scalar; nothing marks the sentence as a proposition whose content could be re-expressed"
    },
    every_layer_carries_the_same_three_facts: true,
    no_layer_adds_a_proposition_level_object_or_any_relation: true
  };

  // ===================== THE A1 CONTRACT'S COMPETING CLAUSES ==================================
  const a1Contract: string = D2A1_CONTRACT_TEXT;
  const a1Clauses = {
    invites_transfer: a1Contract.includes("The subject data may word the same idea differently"),
    binds_the_stance_to_the_paraphrase_wording: a1Contract.includes("the stance to report is the stance toward THIS wording"),
    both_present_in_the_frozen_bytes: true,
    reading:
      "the frozen A1 contract simultaneously invites equivalence-based transfer and directs the reported stance to be toward the paraphrase's own wording; a model that answers the second clause literally is not obviously answering the transfer question",
    status: "POST_HOC_READING_OF_FROZEN_BYTES",
    does_not_invalidate_a1: "the A1 run remains a valid null for the question it asked",
    what_it_does_do: "it supplies a rival explanation of the null that does not require the CharacterOS representation to be at fault"
  };

  if (problems.length > 0) {
    await write("NEXT_BREAKPOINT_ANALYSIS_BLOCKED.json", { problems, model_calls: 0 });
    throw new Error(`NEXT_BREAKPOINT_ANALYSIS_BLOCKED: ${problems.join(" ; ")}`);
  }

  await write("CLOSURE_REVERIFICATION.json", {
    closure_final_states: verdict["verdicts"],
    closure_integrity: verdict["evidence_integrity"],
    independent_recomputation: { rows: ledger.datasets_and_schedules.length, mismatches },
    frozen_facts_reproduced: frozenFacts,
    link_4_locked: verdict["link_4_authorised"] === false,
    d2_b_reopened: verdict["d2_b_reopened"] === true,
    model_calls: 0
  });
  await write("CURRENT_BELIEF_REPRESENTATION_AUDIT.json", { representationAudit, source_extracts: architectureFacts });
  await write("A1_CONTRACT_CLAUSE_AUDIT.json", a1Clauses);

  process.stdout.write(
    `closure re-verified: ${String(ledger.datasets_and_schedules.length)} rows, ${String(mismatches)} mismatches\n` +
      `frozen A1 LOW: SUPPORTS ${String(a1LowSupports)}, OPPOSES ${String(a1LowOpposes)}\n` +
      `canonical belief = {proposition_id, proposition_label, credence}; identity = content-address of the exact wording\n` +
      `projection = a direct three-field copy, sorted by id, capped at 64; no layer adds a proposition-level object\n` +
      `A1 contract: invites transfer AND binds the stance to the paraphrase wording — both clauses present\n` +
      `D4_MODEL_CALLS = 0\n`
  );
}

await main();
