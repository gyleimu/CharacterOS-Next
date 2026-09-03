/* eslint-disable no-restricted-imports -- Experiment-only consumer of built public package roots. */
import type { ModelTransportV0 } from "../../../packages/runtime/dist/index.js";
import { buildWorld, check, equal, parseResponse, realProvider, runCycle, type ProviderInput } from "./adapter.ts";
import { ORDER } from "./contract.ts";
import { assertCycle, assertInput, inputHash, type Preflight } from "./harness.ts";
import { evaluatorMessages, parseEvaluation, summarize, type ScoredTrial } from "./evaluator.ts";

/** Test seam only. The CLI constructs both transports from the one frozen
 * config. Every artifact callback is awaited before any dependent request. */
export async function executePrimary(input: {
  preflight: Preflight;
  primary: ModelTransportV0;
  evaluator: ModelTransportV0;
  guard: () => Promise<void>;
  save: (name: string, value: unknown) => Promise<void>;
}) {
  const scored: ScoredTrial[] = [];
  let primaryCalls = 0;
  let evaluatorCalls = 0;
  await input.save("arm-map", ORDER.map((item, i) => ({ observation: i + 1, ...item })));
  for (let index = 0; index < ORDER.length; index++) {
    const item = ORDER[index];
    check(item, "scheduled trial");
    const id = `observation-${String(index + 1).padStart(2, "0")}`;
    const expected = input.preflight.arms[item.arm];
    const world = await buildWorld(item.arm === "A" ? 1 : 16);
    const observations: Parameters<typeof runCycle>[3] = { queries: [], retrievalResults: [] };
    let providerInput: ProviderInput | undefined;
    let raw: string | undefined;
    let phase = "HOST_PREFLIGHT";
    const score: ScoredTrial = { ...item, host_valid: false, valid: false, evaluation: null };
    let errorRecord: { phase: string; message: string } | null = null;
    try {
      const provider = realProvider(world, input.primary, async actual => {
        assertInput(actual, item.arm);
        check(equal(actual, expected.input) && equal(observations.queries, expected.queries) &&
          equal(observations.retrievalResults, expected.retrievalResults), "actual provider input/query/results equal preregistration");
        providerInput = actual;
        const head = world.assembly.storeRead.getCommittedBundles().at(-1);
        await input.save(`${id}/input`, { provider_input: actual, provider_input_hash: inputHash(actual),
          canonical_head: head?.commit_ref, canonical_revision: world.snapshot.runtime_metadata.state_revision,
          canonical_record_checksum: head?.record_checksum, repository_binding: world.binding, retrieval_observations: observations });
        await input.guard();
        score.host_valid = true;
        phase = "PRIMARY_TECHNICAL_FAILURE";
        primaryCalls++;
      }, async content => {
        raw = content;
        await input.save(`${id}/raw-provider`, { content });
        phase = "INVALID_PROVIDER_OUTPUT";
      });
      const cycle = await runCycle(world, provider, false, observations);
      check(providerInput, "actual provider input captured");
      phase = "HOST_POSTFLIGHT";
      assertCycle({ input: providerInput, ...cycle }, item.arm);
      await input.save(`${id}/host-result`, cycle);
      check(raw !== undefined, "raw provider output persisted");
      const response = parseResponse(raw);
      const messages = evaluatorMessages(response.reply, providerInput.evidence);
      await input.save(`${id}/blind-evaluator-input`, { messages });
      phase = "CONFIG_GUARD";
      await input.guard();
      phase = "EVALUATOR_TECHNICAL_FAILURE";
      evaluatorCalls++;
      const evaluation = await input.evaluator.complete({ messages });
      await input.save(`${id}/raw-evaluator`, { content: evaluation.content });
      phase = "CONFIG_GUARD";
      await input.guard();
      phase = "INVALID_EVALUATOR_OUTPUT";
      score.evaluation = parseEvaluation(evaluation.content, providerInput.evidence);
      score.valid = true;
    } catch (error) {
      errorRecord = { phase, message: error instanceof Error ? error.message : String(error) };
      if (["HOST_PREFLIGHT", "HOST_POSTFLIGHT", "CONFIG_GUARD"].includes(phase)) score.host_valid = false;
    }
    scored.push(score);
    // Mapping stays separate from evaluator-visible files; retain every failure.
    await input.save(`${id}/outcome`, { host_valid: score.host_valid, valid: score.valid,
      evaluation: score.evaluation, error: errorRecord, retrieval_observations: observations });
    if (!score.host_valid) break; // Never continue through a host/config violation.
  }
  const summary = { ...summarize(scored), primary_calls: primaryCalls, evaluator_calls: evaluatorCalls, trials: scored };
  await input.save("result", summary);
  return summary;
}
