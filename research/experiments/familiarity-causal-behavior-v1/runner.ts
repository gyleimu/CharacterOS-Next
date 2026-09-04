/* eslint-disable no-restricted-imports -- Experiment-only built public transport seam. */
import type { ModelTransportV0 } from "../../../packages/runtime/dist/index.js";
import { buildWorld, check } from "./fixtures.ts";
import { ORDER, type Validity } from "./contract.ts";
import { observeResponse, endpoint, errorRecord, type Save } from "./observe.ts";
import { assertActual, type Preflight } from "./preflight.ts";
import { evaluatorMessages, parseEvaluation, summarize, type ScoredTrial } from "./evaluator.ts";

/** Offline tests may inject fakes; only the separately authorized run CLI can
 * construct a real primary run. Every failure remains in the 16-trial denominator.
 * No repetitions, fallback endpoint, replacement trial or response repair.
 */
export async function executePrimary(input: {
  preflight: Preflight;
  cognition: ModelTransportV0; language: ModelTransportV0; evaluator: ModelTransportV0;
  guard: () => Promise<void>; save: Save; sourceCommit: string;
}) {
  const trials: (ScoredTrial & { validity: Validity })[] = [];
  const calls = { cognition: 0, language: 0, evaluator: 0 };
  await input.save("arm-map", ORDER.map((item, i) => ({ trial_id: `observation-${String(i + 1).padStart(2, "0")}`, ...item })));
  await input.save("source", { source_commit: input.sourceCommit, denominator: 16, order: "separate arm-map" });
  for (const [index, item] of ORDER.entries()) {
    const id = `observation-${String(index + 1).padStart(2, "0")}`;
    const save: Save = (name, value) => input.save(`${id}/${name}`, value);
    let hostValid = false;
    const world = await buildWorld(item.arm === "A" ? 1 : 16);
    const o = await observeResponse(world, input, { save, guard: async (stage, actual) => {
      await input.guard();
      await assertActual(actual, input.preflight.arms[item.arm], item.arm, stage);
      hostValid = true;
    } });
    calls.cognition += o.cognition_stage.calls; calls.language += o.language_stage.calls;
    const score: ScoredTrial & { validity: Validity } = { ...item, host_valid: hostValid && o.validity !== "HOST_CAUSAL_TRACE_FAILURE" && o.canonical_unchanged,
      valid: false, evaluation: null, validity: o.validity };
    let evaluatorFailure = null;
    let evaluatorCalls = 0;
    if (o.validity === "VALID_BEHAVIOR") {
      try {
        await assertActual(o, input.preflight.arms[item.arm], item.arm, "language");
        const text = endpoint(o).text;
        check(o.language, "lawful evidence for blinded evaluator");
        const evidence = o.language.input.memory_episode_contents;
        const messages = evaluatorMessages(text, evidence);
        await save("blind-evaluator-input", { messages });
        await input.guard();
        await save("evaluator-attempt", { calls: 1 });
        calls.evaluator++;
        evaluatorCalls++;
        const response = await input.evaluator.complete({ messages });
        await save("evaluator-raw", { content: response.content, model: response.model });
        score.evaluation = parseEvaluation(response.content, evidence);
        await save("evaluator-validated", score.evaluation);
        score.valid = true;
      } catch (error) {
        score.validity = "EVALUATOR_FAILURE"; evaluatorFailure = errorRecord(error);
      }
    }
    try { await input.guard(); }
    catch (error) { score.host_valid = false; score.valid = false; score.validity = "HOST_CAUSAL_TRACE_FAILURE"; evaluatorFailure = errorRecord(error); }
    trials.push(score);
    await save("outcome", { trial_id: id, source_commit: input.sourceCommit, host_valid: score.host_valid,
      valid: score.valid, validity: score.validity, evaluation: score.evaluation, evaluator_failure: evaluatorFailure,
      production_failure: o.result?.kind === "FAILED" ? o.result : null,
      calls: { cognition: o.cognition_stage.calls, language: o.language_stage.calls, evaluator: evaluatorCalls } });
    if (!score.host_valid) break;
  }
  const result = { ...summarize(trials), behavior_trial_denominator: 16, calls, trials };
  await input.save("result", result); return result;
}
