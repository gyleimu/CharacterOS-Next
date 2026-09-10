import {
  executeCognitionStage,
  executePostCognitionStage,
  type TrialRecord as DownstreamTrialRecord,
  probeProviderEnvironment as probeV1Root
} from "../canonical-affect-downstream-language-behavior-causal-v0/real-runner.ts";

/** Re-exports the FROZEN two-stage real-provider runner (cognition →
 * language → behavior) from the downstream language causal experiment — the
 * same frozen stages the prior chain slice used for its lives. This
 * experiment only feeds its own cells/identities and consumes the resulting
 * behavior artifacts. */

export type RealGenerationItem = Parameters<typeof executeCognitionStage>[0];

export async function generateRealBehavior(item: RealGenerationItem): Promise<DownstreamTrialRecord> {
  const inflight = await executeCognitionStage(item);
  return executePostCognitionStage(item, inflight);
}

export { probeV1Root };
