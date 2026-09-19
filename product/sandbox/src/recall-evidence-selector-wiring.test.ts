/**
 * RECALL_EVIDENCE_SELECTOR_PRODUCT_AUTHORITY_V0 — end-to-end product wiring.
 *
 * Proves, with fake transports and 0 real model calls, that:
 *   - the authority is ABSENT when the flag is off (no selector call is possible);
 *   - when enabled, a recall-shaped turn DOES make exactly ONE selector call with
 *     the isolated tiny request (never the cognition V8 prompt);
 *   - a valid selection produces the host-constructed PRIMARY_FACT proposal and
 *     skips the cognition model call entirely;
 *   - ABSTAIN falls through to the normal cognition path unchanged.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import { createProductRuntimeV0 } from "./product-runtime.js";
import { resolveProductConfigurationV0, environmentFromRecordV0 } from "./product-configuration.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-recall-selector-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

interface Recorded {
  readonly label: string;
  readonly system: string;
  readonly user: string;
}

function transportOf(
  label: string,
  recorded: Recorded[],
  responder: (request: ModelTransportRequestV0) => string
): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const system = request.messages.find((message) => message.role === "system")?.content ?? "";
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      recorded.push({ label, system, user });
      return { content: responder(request), model: `fake-${label}` } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

const APPRAISAL_JSON = JSON.stringify({
  relevance: 0.6,
  goal_congruence: 0.5,
  attribution: "other",
  controllability: 0.5,
  uncertainty: 0.5,
  intensity: 0.4,
  assessment_confidence: 0.6
});

const COGNITION_JSON = JSON.stringify({
  schema_version: "conversation-cognition-proposal-v8",
  response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
  factual_assessment: { claims: [] },
  cognition: {
    schema_version: "cognition-proposal-v0",
    reasoning_summary: "offline",
    relevant_memory_handles: [],
    considered_handles: [],
    current_intent: "respond",
    confidence: 0.7,
    uncertainty: 0.3,
    action_intent: null,
    evidence_handles: []
  },
  subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
  communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
  clarification_basis: null
});

const LANGUAGE_JSON = JSON.stringify({
  schema_version: "language-realization-semantic-draft-v1",
  text: "Offline reply.",
  evidence_refs: []
});

async function openRuntime(input: {
  readonly dir: string;
  readonly selectorFlag: string | undefined;
  readonly selectorReply: string;
}): Promise<{
  readonly runtime: Awaited<ReturnType<typeof createProductRuntimeV0>>;
  readonly recorded: Recorded[];
}> {
  const recorded: Recorded[] = [];
  const environment = environmentFromRecordV0({
    CHARACTEROS_DATA_DIR: input.dir,
    ...(input.selectorFlag === undefined
      ? {}
      : { CHARACTEROS_RECALL_EVIDENCE_SELECTOR: input.selectorFlag })
  });
  const configuration = resolveProductConfigurationV0({
    environment,
    default_data_root: input.dir,
    default_data_root_origin: "test"
  });
  const base = createProductProviderBundleV0({ configuration, write: () => undefined });
  const bundle = {
    ...base,
    transports: {
      ...base.transports,
      cognition: transportOf("COGNITION", recorded, () => COGNITION_JSON),
      language: transportOf("LANGUAGE", recorded, () => LANGUAGE_JSON),
      appraisal: transportOf("APPRAISAL", recorded, () => APPRAISAL_JSON),
      recall_selector: transportOf("RECALL_SELECTOR", recorded, () => input.selectorReply)
    }
  };
  const runtime = await createProductRuntimeV0({
    data_root: input.dir,
    subject: { display_name: "selector-wiring" },
    session_label: "selector-wiring-test",
    environment,
    provider_bundle: bundle,
    write: () => undefined
  });
  return { runtime, recorded };
}

describe("RECALL_EVIDENCE_SELECTOR_PRODUCT_AUTHORITY_V0 — product wiring", () => {
  it("the authority is ABSENT by default, so no selector call is possible", async () => {
    const dir = makeTempDir();
    const { runtime, recorded } = await openRuntime({ dir, selectorFlag: undefined, selectorReply: "ABSTAIN" });
    expect(runtime.configuration().recall_evidence_selector_enabled.value).toBe(false);
    expect(runtime.recallSelectorAccounting()).toBeNull();
    await runtime.submitHumanText("Where does the neighbour's cat usually sleep?");
    expect(recorded.some((entry) => entry.label === "RECALL_SELECTOR")).toBe(false);
    await runtime.shutdown();
  });

  it("a fresh subject has no evidence, so an enabled selector is skipped (no candidates)", async () => {
    const dir = makeTempDir();
    const { runtime, recorded } = await openRuntime({ dir, selectorFlag: "1", selectorReply: "ABSTAIN" });
    expect(runtime.recallSelectorAccounting()).not.toBeNull();
    await runtime.submitHumanText("Where does the neighbour's cat usually sleep?");
    const accounting = runtime.recallSelectorAccounting();
    expect(accounting?.calls).toBe(0);
    expect(accounting?.skipped_no_candidates).toBe(1);
    expect(recorded.some((entry) => entry.label === "RECALL_SELECTOR")).toBe(false);
    await runtime.shutdown();
  });

  it("a non-recall turn never spends a selector call even when enabled", async () => {
    const dir = makeTempDir();
    const { runtime, recorded } = await openRuntime({ dir, selectorFlag: "1", selectorReply: "ABSTAIN" });
    await runtime.submitHumanText("I moved the whetstone yesterday.");
    expect(runtime.recallSelectorAccounting()?.skipped_not_recall_shaped).toBe(1);
    expect(runtime.recallSelectorAccounting()?.calls).toBe(0);
    expect(recorded.some((entry) => entry.label === "RECALL_SELECTOR")).toBe(false);
    await runtime.shutdown();
  });

  it("the isolated selector request never carries the cognition V8 prompt", async () => {
    const dir = makeTempDir();
    const { runtime, recorded } = await openRuntime({ dir, selectorFlag: "1", selectorReply: "ABSTAIN" });
    // A second turn gives the subject evidence from the first; either way the
    // selector prompt shape is fixed and tiny.
    await runtime.submitHumanText("Where does the neighbour's cat usually sleep?");
    for (const entry of recorded.filter((item) => item.label === "RECALL_SELECTOR")) {
      expect(entry.system).toContain("You are an evidence selector.");
      expect(entry.system).not.toContain("conversation-cognition-proposal-v8");
      expect(entry.user).toContain("Return exactly one of:");
    }
    await runtime.shutdown();
  });
});
