/**
 * Belief Decision Influence Relation Foundation V0 — CognitivePromptProjectionV1
 * acceptance suite (§85): determinism, exact content obligations, forbidden
 * vocabulary absence (no scoring/coaching language), order-insensitivity via
 * canonical action tuples, and V0 prompt bytes left untouched.
 *
 * Fully OFFLINE: deterministic fixtures only — no model, no transport.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../../transitions/observation/observation-fixtures.js";
import { buildCognitiveContextProjection } from "../../transitions/cognition-action/cognition-action-transition-executor.js";
import {
  deriveCognitionActionSpaceFingerprintV1,
  validateAllowedActionSpaceV1
} from "../../transitions/cognition-action/cognition-proposal-v1.js";
import { buildCognitionRelationProviderInputV1 } from "../../transitions/cognition-action/belief-decision-influence-relation.js";
import type { CognitionRelationProviderInputV1 } from "../../ports/cognition-relation-port.js";
import { COGNITION_RELATION_PROVIDER_INPUT_SCHEMA_VERSION } from "../../ports/cognition-relation-port.js";
import { renderCognitiveSystemRules } from "./cognitive-prompt-projection.js";
import {
  COGNITIVE_PROMPT_PROJECTION_V1_VERSION,
  buildCognitivePromptMessagesV1,
  renderCognitiveSubjectDataV1,
  renderCognitiveSystemRulesV1
} from "./cognitive-prompt-projection-v1.js";

const BELIEFS = [
  { proposition_id: "prop.bob-trustworthy", proposition_label: "Bob is trustworthy", credence: 0.9 },
  { proposition_id: "prop.alex-trustworthy", proposition_label: "Alex is trustworthy", credence: 0.5 }
];

async function buildInput(args: {
  readonly actions?: readonly { action_type: string; target_ref: string | null }[];
  readonly beliefItems?: readonly {
    readonly proposition_id: string;
    readonly proposition_label: string;
    readonly credence: number;
  }[];
  readonly workingRefs?: readonly string[];
}): Promise<CognitionRelationProviderInputV1> {
  const base = s0() as unknown as SubjectStateV0;
  const snapshot = {
    ...base,
    beliefs: { schema_version: "belief-state-v0", items: args.beliefItems ?? BELIEFS },
    memory_state: {
      ...(base.memory_state as unknown as Record<string, unknown>),
      working_refs: args.workingRefs ?? ["episode:e1", "episode:e2"]
    }
  } as unknown as SubjectStateV0;
  const projection = await buildCognitiveContextProjection(snapshot);
  const space = validateAllowedActionSpaceV1(
    args.actions ?? [
      { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
      { action_type: "communicate", target_ref: "entity:bob" }
    ]
  );
  if (!space.ok) throw new Error(`fixture action space invalid: ${space.error.detail}`);
  const fingerprint = await deriveCognitionActionSpaceFingerprintV1(space.value);
  return buildCognitionRelationProviderInputV1(projection, space.value, fingerprint);
}

function fullPrompt(input: CognitionRelationProviderInputV1): string {
  return buildCognitivePromptMessagesV1(input)
    .map((m) => `${m.role}\n${m.content}`)
    .join("\n");
}

describe("Relation Foundation V0 — V1 prompt projection determinism + shape", () => {
  it("is deterministic: identical input renders byte-identical messages", async () => {
    const input = await buildInput({});
    const a = buildCognitivePromptMessagesV1(input);
    const b = buildCognitivePromptMessagesV1(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(COGNITIVE_PROMPT_PROJECTION_V1_VERSION).toBe("cognitive-prompt-projection-v1");
  });

  it("emits exactly [system rules, subject data] with the V1 schema version + fingerprints", async () => {
    const input = await buildInput({});
    expect(input.schema_version).toBe(COGNITION_RELATION_PROVIDER_INPUT_SCHEMA_VERSION);
    const messages = buildCognitivePromptMessagesV1(input);
    expect(messages).toHaveLength(2);
    const [systemMessage, userMessage] = messages;
    if (systemMessage === undefined || userMessage === undefined) {
      throw new Error("expected exactly two V1 prompt messages");
    }
    expect(systemMessage.role).toBe("system");
    expect(userMessage.role).toBe("user");
    expect(systemMessage.content).toBe(renderCognitiveSystemRulesV1());
    expect(userMessage.content).toBe(renderCognitiveSubjectDataV1(input));
    const subject = userMessage.content;
    expect(subject).toContain(input.projection.projection_hash);
    expect(subject).toContain(`[action_space_fingerprint] ${input.action_space_fingerprint}`);
    expect(subject).toContain("prop.bob-trustworthy");
    expect(subject).toContain("CITEABLE CONTEXT REFS");
    // The relation schema obligation lives in the frozen SYSTEM rules section.
    expect(systemMessage.content).toContain("state_action_relations");
  });

  it("declares belief IDs as STATE LOCATORS ONLY, never evidence refs (explicit clarification)", async () => {
    const input = await buildInput({});
    const prompt = fullPrompt(input);
    expect(prompt).toContain("STATE LOCATORS ONLY");
    expect(prompt).toContain("MUST NEVER appear in relevant_memory_refs, considered_context_refs or evidence_refs");
  });

  it("renders canonical sorted action tuples; host order has NO authority (order-insensitive bytes)", async () => {
    const eastFirst = await buildInput({
      actions: [
        { action_type: "TRY_EAST_ENTRANCE", target_ref: null },
        { action_type: "TRY_WEST_ENTRANCE", target_ref: null }
      ]
    });
    const westFirst = await buildInput({
      actions: [
        { action_type: "TRY_WEST_ENTRANCE", target_ref: null },
        { action_type: "TRY_EAST_ENTRANCE", target_ref: null }
      ]
    });
    expect(fullPrompt(eastFirst)).toBe(fullPrompt(westFirst));
    const subject = renderCognitiveSubjectDataV1(eastFirst);
    const eastIdx = subject.indexOf('action_type="TRY_EAST_ENTRANCE"');
    const westIdx = subject.indexOf('action_type="TRY_WEST_ENTRANCE"');
    expect(eastIdx).toBeGreaterThan(-1);
    expect(westIdx).toBeGreaterThan(eastIdx);
  });

  it("renders the empty action space as an explicit MUST-be-empty relation instruction", async () => {
    const input = await buildInput({ actions: [] });
    expect(renderCognitiveSubjectDataV1(input)).toContain(
      "(no external actions allowed this cycle — state_action_relations MUST be empty)"
    );
  });

  it("renders the empty belief read surface without inventing items", async () => {
    const input = await buildInput({ beliefItems: [] });
    const subject = renderCognitiveSubjectDataV1(input);
    expect(subject).toContain("showing 0 of 0 canonical belief item(s)");
    expect(subject).not.toContain("prop.bob-trustworthy");
  });
});

describe("Relation Foundation V0 — V1 prompt forbidden vocabulary + coaching absence", () => {
  it("never mentions scoring/ranking vocabulary anywhere in the V1 prompt", async () => {
    const input = await buildInput({});
    const prompt = fullPrompt(input).toLowerCase();
    for (const forbidden of [
      "action_intent",
      "score",
      "weight",
      "rank",
      "winner",
      "selected_action",
      "influence_strength",
      "utility",
      "threshold",
      "margin"
    ]) {
      expect(prompt).not.toContain(forbidden);
    }
  });

  it("contains NO behavioral coaching language (PROMPT_V1_BEHAVIORAL_COACHING=NONE)", async () => {
    const input = await buildInput({});
    const prompt = fullPrompt(input).toLowerCase();
    for (const coaching of [
      "follow beliefs",
      "follow your beliefs",
      "obey",
      "prefer higher credence",
      "choose the best action",
      "pick the action",
      "you should act",
      "decide what to do"
    ]) {
      expect(prompt).not.toContain(coaching);
    }
  });

  it("leaves the frozen V0 prompt untouched (V0 still speaks action_intent)", () => {
    const v0Rules = renderCognitiveSystemRules();
    expect(v0Rules).toContain("action_intent");
    expect(renderCognitiveSystemRulesV1()).not.toContain("action_intent");
    expect(v0Rules).not.toBe(renderCognitiveSystemRulesV1());
  });
});
