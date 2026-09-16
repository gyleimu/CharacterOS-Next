/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * BELIEF_CAUSAL_VALIDATION_V0 — deterministic precheck (§40) and hard gates.
 *
 * ZERO cognition model calls. Everything here is offline and reproducible:
 * history formation through the real production wiring, authoritative restore,
 * the four-cell model-facing request rendering, and every preregistered hard
 * gate. A single failing gate means NO scientific call is made.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";

import {
  CELL_DEFINITION,
  CELL_IDS,
  EXPECTED_HIGH_PROGRESSION,
  EXPECTED_LOW_PROGRESSION,
  GATES,
  MODEL,
  TARGET_PROPOSITION_LABEL,
  type CellId
} from "./contract.ts";
import {
  applyBeliefViewIntervention,
  buildHistory,
  check,
  hashJson,
  hashText,
  interventionFor,
  renderCognitionRequest,
  restoreHistory,
  normalizeNonBelief,
  splitBeliefSection,
} from "./world.ts";

export interface PrecheckResult {
  readonly ok: boolean;
  readonly failed_gates: readonly string[];
  readonly detail: Record<string, unknown>;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function runPrecheck(evidenceDir: string): Promise<PrecheckResult> {
  const failed: string[] = [];
  const gate = (name: string, ok: boolean, detail?: unknown): void => {
    if (!ok) failed.push(name);
    if (!ok && detail !== undefined) process.stderr.write(`[gate-fail] ${name}: ${JSON.stringify(detail).slice(0, 500)}\n`);
  };

  mkdirSync(evidenceDir, { recursive: true });

  // ---- histories through the REAL production formation path -------------------
  const low = await buildHistory("LOW");
  const high = await buildHistory("HIGH");
  writeJson(join(evidenceDir, "history-low.json"), low.bundle);
  writeJson(join(evidenceDir, "history-high.json"), high.bundle);

  gate("seed_belief_count_zero", low.bundle.seed_belief_item_count === 0 && high.bundle.seed_belief_item_count === 0);
  gate(
    "low_progression",
    JSON.stringify(low.bundle.progression) === JSON.stringify(EXPECTED_LOW_PROGRESSION),
    low.bundle.progression
  );
  gate(
    "high_progression",
    JSON.stringify(high.bundle.progression) === JSON.stringify(EXPECTED_HIGH_PROGRESSION),
    high.bundle.progression
  );
  gate(
    "same_proposition_semantics",
    low.bundle.proposition.proposition_key === high.bundle.proposition.proposition_key &&
      low.bundle.proposition.canonical_label === high.bundle.proposition.canonical_label &&
      low.bundle.proposition.canonical_label === TARGET_PROPOSITION_LABEL,
    { low: low.bundle.proposition, high: high.bundle.proposition }
  );
  gate(
    "same_proposition_id_and_commit_count",
    low.bundle.proposition.proposition_id === high.bundle.proposition.proposition_id &&
      low.bundle.state_revision === high.bundle.state_revision,
    { low_rev: low.bundle.state_revision, high_rev: high.bundle.state_revision }
  );
  gate("low_final_credence", low.bundle.final_credence === EXPECTED_LOW_PROGRESSION[2], low.bundle.final_credence);
  gate("high_final_credence", high.bundle.final_credence === EXPECTED_HIGH_PROGRESSION[2], high.bundle.final_credence);

  // ---- fresh-process authoritative restore -----------------------------------
  const lowWorld = await restoreHistory(low.bundle);
  const highWorld = await restoreHistory(high.bundle);
  const lowSnapshot = lowWorld.snapshot;
  const highSnapshot = highWorld.snapshot;

  gate(
    "restore_belief_identity",
    JSON.stringify(lowWorld.restore.belief_item) === JSON.stringify(lowSnapshot.beliefs.items) &&
      JSON.stringify(highWorld.restore.belief_item) === JSON.stringify(highSnapshot.beliefs.items),
    { low: lowWorld.restore.belief_item, high: highWorld.restore.belief_item }
  );

  // ---- §13 non-belief canonical state equality --------------------------------
  const nonBelief = (snapshot: SubjectStateV4): unknown => ({
    affect: snapshot.affect,
    regulation: snapshot.regulation,
    relationships: snapshot.relationships,
    personality: snapshot.personality,
    traits_seed: snapshot.traits_seed,
    context: snapshot.context,
    memory_state: snapshot.memory_state,
    identity: snapshot.identity,
    trace_cursor: snapshot.trace_window.cursor,
    logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  });
  const nonBeliefLow = hashJson(nonBelief(lowSnapshot));
  const nonBeliefHigh = hashJson(nonBelief(highSnapshot));
  gate("non_belief_state_equality", nonBeliefLow === nonBeliefHigh, { nonBeliefLow, nonBeliefHigh });
  gate(
    "non_belief_domain_equality",
    JSON.stringify(lowSnapshot.affect) === JSON.stringify(highSnapshot.affect) &&
      JSON.stringify(lowSnapshot.relationships) === JSON.stringify(highSnapshot.relationships) &&
      JSON.stringify(lowSnapshot.personality) === JSON.stringify(highSnapshot.personality) &&
      JSON.stringify(lowSnapshot.memory_state) === JSON.stringify(highSnapshot.memory_state)
  );

  // ---- model-facing cognition requests for the four cells ---------------------
  const highItem = highSnapshot.beliefs.items[0];
  const lowItem = lowSnapshot.beliefs.items[0];
  check(highItem !== undefined && lowItem !== undefined, "both conditions hold exactly one belief item");
  const rendered: Record<CellId, { system: string; user: string; projection_hash: string; belief: string; nonBeliefHash: string }> = {} as never;
  for (const cell of CELL_IDS) {
    const definition = CELL_DEFINITION[cell];
    const base = definition.durable === "LOW" ? lowSnapshot : highSnapshot;
    const intervention = interventionFor(cell, high.bundle);
    const view = applyBeliefViewIntervention(base, intervention);
    const request = await renderCognitionRequest(view);
    const sections = splitBeliefSection(request.user);
    rendered[cell] = {
      system: request.system,
      user: request.user,
      projection_hash: request.projection_hash,
      belief: sections.belief,
      nonBeliefHash: hashText(normalizeNonBelief(`${sections.before}${sections.after}`))
    };
  }
  writeJson(join(evidenceDir, "precheck-rendered-requests.json"), {
    schema_version: "belief-causal-rendered-requests-v0",
    cells: Object.fromEntries(
      Object.entries(rendered).map(([cell, entry]) => [
        cell,
        {
          system_hash: hashText(entry.system),
          user_hash: hashText(entry.user),
          belief_section_hash: hashText(entry.belief),
          non_belief_user_hash: entry.nonBeliefHash,
          projection_hash: entry.projection_hash,
          system: entry.system,
          user: entry.user,
          belief_section: entry.belief
        }
      ])
    )
  });

  // §12/§43: A differs from B ONLY in the belief-mediated projection.
  gate("prompt_system_identical", new Set(CELL_IDS.map((cell) => hashText(rendered[cell].system))).size === 1);
  gate(
    "non_belief_prompt_equivalence",
    new Set(CELL_IDS.map((cell) => rendered[cell].nonBeliefHash)).size === 1,
    Object.fromEntries(CELL_IDS.map((cell) => [cell, rendered[cell].nonBeliefHash]))
  );
  gate("a_vs_b_only_belief_difference", rendered.A_LOW_BELIEF.user !== rendered.B_HIGH_BELIEF.user && rendered.A_LOW_BELIEF.nonBeliefHash === rendered.B_HIGH_BELIEF.nonBeliefHash);
  gate(
    "a_vs_b_belief_repr_differs",
    rendered.A_LOW_BELIEF.belief !== rendered.B_HIGH_BELIEF.belief &&
      rendered.A_LOW_BELIEF.belief.includes(`"credence":${low.bundle.final_credence}`) &&
      rendered.B_HIGH_BELIEF.belief.includes(`"credence":${high.bundle.final_credence}`)
  );

  // §16/§42/§45: B and D are byte-identical model-facing inputs.
  gate(
    "b_d_full_input_equality",
    rendered.B_HIGH_BELIEF.user === rendered.D_LOW_BELIEF_MEDIATOR_EQUALIZED.user &&
      rendered.B_HIGH_BELIEF.belief === rendered.D_LOW_BELIEF_MEDIATOR_EQUALIZED.belief &&
      rendered.B_HIGH_BELIEF.projection_hash === rendered.D_LOW_BELIEF_MEDIATOR_EQUALIZED.projection_hash,
    {
      b_hash: hashText(rendered.B_HIGH_BELIEF.user),
      d_hash: hashText(rendered.D_LOW_BELIEF_MEDIATOR_EQUALIZED.user),
      b_projection: rendered.B_HIGH_BELIEF.projection_hash,
      d_projection: rendered.D_LOW_BELIEF_MEDIATOR_EQUALIZED.projection_hash
    }
  );

  // §17/§44: C removes the target item entirely (no fake neutral value).
  gate(
    "c_ablation_removes_target",
    !rendered.C_HIGH_BELIEF_MEDIATOR_ABLATED.belief.includes(TARGET_PROPOSITION_LABEL) &&
      rendered.C_HIGH_BELIEF_MEDIATOR_ABLATED.belief.includes("showing 0 of 0 canonical belief item(s)")
  );
  gate(
    "c_canonical_state_unchanged",
    JSON.stringify(interventionFor("C_HIGH_BELIEF_MEDIATOR_ABLATED", high.bundle)) !== null &&
      JSON.stringify(highSnapshot.beliefs.items[0]) ===
        JSON.stringify((highWorld.restore.belief_item as readonly unknown[])[0])
  );

  // §11: raw history never appears in the model-facing request.
  const historyRefs = [...low.bundle.records.map((record) => record.ref), ...high.bundle.records.map((record) => record.ref)];
  const historyScenes = [...low.bundle.records, ...high.bundle.records].length;
  void historyScenes;
  const leakedRefs = CELL_IDS.flatMap((cell) => historyRefs.filter((ref) => rendered[cell].user.includes(ref)));
  const leakedScenes = CELL_IDS.flatMap((cell) =>
    [...new Set([...low.bundle.steps.map((step) => step.episode_ref), ...high.bundle.steps.map((step) => step.episode_ref)])].length > 0
      ? ["episode:bcv-low", "episode:bcv-high"].filter((marker) => rendered[cell].user.includes(marker))
      : []
  );
  gate("raw_history_isolation", leakedRefs.length === 0 && leakedScenes.length === 0, { leakedRefs, leakedScenes });
  gate(
    "no_experiment_label_leakage",
    CELL_IDS.every((cell) => !/A_LOW_BELIEF|B_HIGH_BELIEF|C_HIGH_BELIEF_MEDIATOR_ABLATED|D_LOW_BELIEF_MEDIATOR_EQUALIZED|treatment|control group|intervention/.test(rendered[cell].user))
  );
  // The current observation is admitted by the scene itself (before cognition),
  // so the precheck gate is EQUALITY of the rendered observation line across
  // cells; the live scenes additionally assert the admitted ref is present.
  const observationLines = new Set(
    CELL_IDS.map(
      (cell) => /^\[current observation\] .*$/m.exec(rendered[cell].user)?.[0] ?? "(missing)"
    )
  );
  gate(
    "current_observation_identical",
    observationLines.size === 1 && !observationLines.has("(missing)"),
    [...observationLines]
  );

  const stateHashesEqualAcrossCells = new Set(CELL_IDS.map((cell) => rendered[cell].nonBeliefHash)).size === 1;

  const result: PrecheckResult = {
    ok: failed.length === 0,
    failed_gates: failed,
    detail: {
      schema_version: "belief-causal-precheck-v0",
      experiment_id: "BELIEF_CAUSAL_VALIDATION_V0",
      model: MODEL.id,
      model_calls: 0,
      history: {
        low: {
          progression: low.bundle.progression,
          final_credence: low.bundle.final_credence,
          state_revision: low.bundle.state_revision,
          proposition: low.bundle.proposition,
          steps: low.bundle.steps
        },
        high: {
          progression: high.bundle.progression,
          final_credence: high.bundle.final_credence,
          state_revision: high.bundle.state_revision,
          proposition: high.bundle.proposition,
          steps: high.bundle.steps
        }
      },
      restore: { low: lowWorld.restore, high: highWorld.restore },
      non_belief_state_hash: { low: nonBeliefLow, high: nonBeliefHigh },
      non_belief_state_identical: nonBeliefLow === nonBeliefHigh,
      non_belief_prompt_equivalent: stateHashesEqualAcrossCells && failed.includes("non_belief_prompt_equivalence") === false,
      prompts: Object.fromEntries(
        CELL_IDS.map((cell) => [
          cell,
          {
            system_hash: hashText(rendered[cell].system),
            user_hash: hashText(rendered[cell].user),
            belief_section_hash: hashText(rendered[cell].belief),
            non_belief_user_hash: rendered[cell].nonBeliefHash,
            projection_hash: rendered[cell].projection_hash
          }
        ])
      ),
      canonical_state_hashes: { low: lowWorld.restore.state_hash, high: highWorld.restore.state_hash },
      gates: GATES,
      failed_gates: failed
    }
  };
  writeJson(join(evidenceDir, "precheck.json"), result);
  return result;
}
