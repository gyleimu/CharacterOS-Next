/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV0 — projection-binding verification (B1–B7). ZERO model calls.
 *
 * B1 capture input comes from a genesis subject + a frozen D0 fixture
 * B2 the captured request is what the production provider really sends
 * B3 the production request hash is recorded BEFORE any probe transformation
 * B4 after transformation only the frozen contract's declared differences exist
 * B5 the probe never re-renders subject data or the belief projection
 * B6 no episodic history / retrieval snippets / summaries / training text / debug history /
 *    provenance is introduced
 * B7 repeated construction of the same fixture is stable in request bytes and hashes
 */

import { describe, expect, it } from "vitest";

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  ConversationCognitionProviderV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "../../../packages/runtime/dist/transports/model-transport.js";

import { runCognitionCapture } from "../canonical-affect-behavior-influence-v1/harness.ts";

import { captureProductionRequestForFixtureV0 } from "./binding.js";
import {
  buildDecisionProbeRequestV0,
  DECISION_PROBE_JSON_SCHEMA,
  DECISION_PROBE_OVERRIDE_BLOCK_V0
} from "./contract.js";
import { D0_FIXTURES, type DecisionProbeD0FixtureV0 } from "./fixtures.js";
import { buildFixtureWorldWithObservationV0 } from "./observation-binding.ts";

const FIXTURE = D0_FIXTURES[0] as DecisionProbeD0FixtureV0;

describe("DecisionProbeV0 binding — B1 source is a genesis subject + frozen fixture", () => {
  it("the observation reaches the subject through the production observation path, not the probe", async () => {
    const bound = await captureProductionRequestForFixtureV0(FIXTURE);
    expect(bound.fixture_id).toBe(FIXTURE.fixture_id);
    expect(bound.provenance.genesis).toBe("materializeSubjectStateV4V0+EXPLICIT_V4_FOUNDATION_V0");
    // D0Q_RUN_002 repaired the channel: the observation is committed through the production
    // observation path, so the scene carries the fixture text and the observation slot holds a
    // real ref (previously: genesis context.task + `[current observation] (none)`).
    expect(bound.provenance.observation_channel).toContain("production Observation commit");
    expect(bound.observation.scene).toBe(FIXTURE.observation_text);
    expect(bound.observation.task).toBeNull();
    expect(bound.observation.observation_ref.startsWith("observation:o-")).toBe(true);
    // And the subject is a real genesis subject (no lived episodes).
    expect(bound.subject_id.length).toBeGreaterThan(0);
    expect(bound.state_revision).toBeGreaterThanOrEqual(0);
  });

  it("a different fixture yields a different projection and request", async () => {
    const accept = await captureProductionRequestForFixtureV0(D0_FIXTURES[0] as DecisionProbeD0FixtureV0);
    const reject = await captureProductionRequestForFixtureV0(D0_FIXTURES[1] as DecisionProbeD0FixtureV0);
    expect(accept.hashes.production_request_hash).not.toBe(reject.hashes.production_request_hash);
    expect(accept.hashes.user_content_hash).not.toBe(reject.hashes.user_content_hash);
  });
});

describe("DecisionProbeV0 binding — B2 the captured request is the production request", () => {
  it("matches byte-for-byte what ConversationCognitionProviderV8 emits for the same projection", async () => {
    // The projection must come from the SAME world construction the binding uses (post-repair:
    // genesis + committed observation), otherwise the comparison is against a different subject.
    const { world } = await buildFixtureWorldWithObservationV0(FIXTURE);
    const capture = await runCognitionCapture(world, []);
    const projection = capture.provider_input;

    const emitted: ModelTransportRequestV0[] = [];
    const capturingTransport: ModelTransportV0 = {
      complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
        emitted.push(request);
        // A deliberately invalid body: we only need the REQUEST. V8's parser will reject it,
        // which is irrelevant to the capture and is asserted below to be irrelevant.
        return { content: "{}", model: "capturing-stub" };
      }
    };
    const provider = new ConversationCognitionProviderV8(capturingTransport as never);
    await provider.propose(projection as never).catch(() => undefined);

    expect(emitted).toHaveLength(1);
    const production = emitted[0] as ModelTransportRequestV0;

    const bound = await captureProductionRequestForFixtureV0(FIXTURE);
    expect(canonicalJsonString(bound.production_request.messages)).toBe(
      canonicalJsonString(production.messages)
    );
    expect(canonicalJsonString(bound.production_request.structured_output?.schema ?? {})).toBe(
      canonicalJsonString(production.structured_output?.schema ?? {})
    );
    expect(production.structured_output?.schema).toBe(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA);
  });
});

describe("DecisionProbeV0 binding — B3/B4 hashes recorded, declared diffs only", () => {
  it("B3 the production request hash is recorded before transformation and is stable", async () => {
    const bound = await captureProductionRequestForFixtureV0(FIXTURE);
    expect(bound.hashes.production_request_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(bound.hashes.binding_hash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const rebuilt = await buildDecisionProbeRequestV0(bound.production_request, "SUBSTITUTION_WITH_OVERRIDE");
    // The binding's recorded production hash equals the probe's own recomputation of it.
    expect(rebuilt.fidelity.production_request_hash).toBe(bound.hashes.production_request_hash);
  });

  it("B4 after transformation only the declared differences exist", async () => {
    const bound = await captureProductionRequestForFixtureV0(FIXTURE);
    for (const mode of ["PURE_SUBSTITUTION", "SUBSTITUTION_WITH_OVERRIDE"] as const) {
      const built = await buildDecisionProbeRequestV0(bound.production_request, mode);
      expect(built.fidelity.chain_of_custody_ok).toBe(true);
      expect(built.fidelity.schema_substituted).toBe(true);
      expect(built.fidelity.production_prefix_preserved).toBe(true);
      expect(built.fidelity.only_system_message_indented).toBe(true);
      expect(built.request.structured_output?.schema).toBe(DECISION_PROBE_JSON_SCHEMA);
      if (mode === "PURE_SUBSTITUTION") {
        expect(built.fidelity.messages_preserved).toBe(true);
      } else {
        const before =
          bound.production_request.messages.find((m) => m.role === "system")?.content ?? "";
        const after = built.request.messages.find((m) => m.role === "system")?.content ?? "";
        expect(after.slice(before.length)).toBe(DECISION_PROBE_OVERRIDE_BLOCK_V0);
        // The user message — the SUBJECT DATA carrier — is untouched at byte level.
        expect(built.request.messages.find((m) => m.role === "user")?.content).toBe(
          bound.production_request.messages.find((m) => m.role === "user")?.content
        );
      }
    }
  });
});

describe("DecisionProbeV0 binding — B5 the probe never re-renders subject data", () => {
  it("the probe request carries the production user content verbatim, in every mode", async () => {
    const bound = await captureProductionRequestForFixtureV0(FIXTURE);
    const productionUser =
      bound.production_request.messages.find((m) => m.role === "user")?.content ?? "";
    for (const mode of ["PURE_SUBSTITUTION", "SUBSTITUTION_WITH_OVERRIDE"] as const) {
      const built = await buildDecisionProbeRequestV0(bound.production_request, mode);
      const probeUser = built.request.messages.find((m) => m.role === "user")?.content ?? "";
      expect(probeUser).toBe(productionUser);
    }
    // The instrument module exposes no renderer that could author subject data.
    const contractModule = await import("./contract.js");
    for (const name of Object.keys(contractModule)) {
      expect(name).not.toContain("render");
      expect(name).not.toContain("buildConversationSubjectData");
    }
  });
});

describe("DecisionProbeV0 binding — B6 no history or leakage is introduced", () => {
  it("the production request for a genesis subject carries no episodic or retrieval content", async () => {
    const bound = await captureProductionRequestForFixtureV0(FIXTURE);
    const requestText = canonicalJsonString(bound.production_request);
    for (const forbidden of [
      "[CONVERSATION HISTORY]",
      "[TRANSCRIPT]",
      "provenance",
      "episode:",
      "training",
      "debug"
    ]) {
      expect(requestText.includes(forbidden)).toBe(false);
    }
  });

  it("the probe adds none of it either", async () => {
    const bound = await captureProductionRequestForFixtureV0(FIXTURE);
    const built = await buildDecisionProbeRequestV0(bound.production_request, "SUBSTITUTION_WITH_OVERRIDE");
    const before = canonicalJsonString(bound.production_request);
    const after = canonicalJsonString(built.request);
    for (const forbidden of ["[CONVERSATION HISTORY]", "[TRANSCRIPT]", "episode:", "provenance"]) {
      expect(after.includes(forbidden)).toBe(before.includes(forbidden));
    }
    expect(built.request.messages).toHaveLength(bound.production_request.messages.length);
  });
});

describe("DecisionProbeV0 binding — B7 repeated construction is stable", () => {
  it("the same fixture rebuilt yields the same request bytes and the same hashes", async () => {
    const first = await captureProductionRequestForFixtureV0(FIXTURE);
    const second = await captureProductionRequestForFixtureV0(FIXTURE);
    expect(canonicalJsonString(first.production_request)).toBe(
      canonicalJsonString(second.production_request)
    );
    expect(first.hashes.production_request_hash).toBe(second.hashes.production_request_hash);
    expect(first.hashes.binding_hash).toBe(second.hashes.binding_hash);
    expect(first.hashes.user_content_hash).toBe(second.hashes.user_content_hash);
  });

  it("all three fixtures build and each has a distinct request identity", async () => {
    const built = await Promise.all(
      D0_FIXTURES.map((fixture) => captureProductionRequestForFixtureV0(fixture))
    );
    const hashes = built.map((entry) => entry.hashes.production_request_hash);
    expect(new Set(hashes).size).toBe(D0_FIXTURES.length);
  });
});
