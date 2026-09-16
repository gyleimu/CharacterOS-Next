/**
 * BELIEF_CAUSAL_VALIDATION_V0 — ONE scene in a FRESH process (§31).
 *
 * The worker receives the frozen durable history plus the cell's preregistered
 * intervention, performs the authoritative restore from that durable image
 * alone, and executes exactly ONE current-scene turn against the fixed API
 * executor. No live subject object, no conversation history, no hidden provider
 * state and no research state survive between scenes.
 */
import { CELL_DEFINITION, type CellId } from "./contract.ts";
import { restoreHistory, runScene, type BeliefViewIntervention, type HistoryBundle, type SceneObservation } from "./world.ts";

export interface SceneWorkerInput {
  readonly phase: string;
  readonly cell: CellId;
  readonly replicate: number;
  readonly history: HistoryBundle;
  readonly intervention: BeliefViewIntervention;
  readonly target_label: string;
}

export interface SceneWorkerOutput {
  readonly ok: boolean;
  readonly observation: SceneObservation | null;
  readonly failure: string | null;
}

export async function runSceneWorker(input: SceneWorkerInput): Promise<SceneWorkerOutput> {
  try {
    const world = await restoreHistory(input.history);
    const observation = await runScene({
      world,
      phase: input.phase,
      cell: input.cell,
      replicate: input.replicate,
      intervention: input.intervention,
      env: process.env,
      highCredenceLabel: input.target_label
    });
    return { ok: true, observation, failure: null };
  } catch (error) {
    return { ok: false, observation: null, failure: error instanceof Error ? error.message : String(error) };
  }
}

void CELL_DEFINITION;
