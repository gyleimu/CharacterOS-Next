/**
 * PROVIDER-PORTABLE COGNITION PROPOSAL CONTRACT — regression suite (Tests A–F).
 *
 * Guards the remediation of `REQUIRED_SCHEMA_SEMANTICS_NOT_FULLY_MODEL_VISIBLE`: before it,
 * 10 of the 80 requirements of the canonical proposal schema — including the REQUIRED
 * top-level fields `schema_version` and `communication_directive` — were named ONLY in the
 * provider structured-output schema, so an executor whose provider cannot enforce that schema
 * received strictly less information than the local grammar-enforcing executor. Cross-provider
 * compliance therefore could not be fairly compared.
 *
 * These tests intentionally use an INDEPENDENT walker over the SAME canonical schema (not the
 * renderer's own output) so a missing declaration cannot be masked, and no snapshot stands in
 * for the property.
 *
 * Zero model calls.
 */

import { describe, expect, it } from "vitest";

import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionAnyVersion } from "../../transitions/cognition-action/types.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V8,
  ConversationCognitionProviderV8,
  renderCognitionProposalContractV8
} from "./conversation-cognition-provider-v8.js";

const OBS = "observation:c4-contract";
const HASH = `sha256:${"a".repeat(64)}`;

interface RequirementRow {
  readonly kind: "required" | "const" | "enum";
  readonly path: string;
  readonly token: string;
}

/** Independent walker: collect every named requirement from a canonical schema object. */
function collectSchemaRequirements(schema: unknown): readonly RequirementRow[] {
  const rows: RequirementRow[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    const record = node as Record<string, unknown>;
    const push = (kind: RequirementRow["kind"], token: unknown): void => {
      if (typeof token !== "string") return;
      const key = `${kind}|${path}|${token}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ kind, path, token });
    };
    if (Array.isArray(record["required"])) {
      for (const name of record["required"]) push("required", name);
    }
    if (typeof record["const"] === "string") push("const", record["const"]);
    if (Array.isArray(record["enum"])) for (const value of record["enum"]) push("enum", value);
    for (const [key, value] of Object.entries((record["properties"] ?? {}) as Record<string, unknown>)) {
      walk(value, `${path}.${key}`);
    }
    for (const key of ["oneOf", "anyOf"]) {
      const branches = record[key];
      if (Array.isArray(branches)) branches.forEach((branch, index) => walk(branch, `${path}.${key}[${index}]`));
    }
    if (record["items"] !== undefined) walk(record["items"], `${path}[]`);
  };
  walk(schema, "proposal");
  return rows;
}

function projection(): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-c4-contract",
    current_logical_time: 1,
    state_revision: 1,
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0.4, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "status update", task: "respond", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS },
    memory_working_refs: [],
    recent_retrieval_refs: [],
    belief_item_count: 0,
    belief_items: [],
    relationship_counterpart_count: 0,
    relationship_dimensions: [],
    interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [],
    traits_dimensions: {},
    personality_dimensions: {},
    personality_disposition: {},
    allowed_actions: [],
    projection_hash: HASH
  } as unknown as CognitiveContextProjectionAnyVersion;
}

/** Records the exact request. `enforces_schema` models a provider with a grammar; the
 * "generic" variant models a provider whose strict schema mode is unavailable. */
class Capture implements ModelTransportV0 {
  readonly requests: ModelTransportRequestV0[] = [];
  constructor(
    private readonly value: unknown,
    private readonly enforcesSchema: boolean
  ) {}
  async complete(request: ModelTransportRequestV0) {
    this.requests.push(request);
    if (this.enforcesSchema && request.structured_output === undefined) {
      throw new Error("fixture: grammar-enforcing provider requires structured_output");
    }
    return { content: JSON.stringify(this.value), model: "fake" };
  }
}

const VALID_PROPOSAL_V8 = {
  schema_version: "conversation-cognition-proposal-v8",
  factual_assessment: { claims: [] },
  cognition: {
    schema_version: "cognition-proposal-v0",
    reasoning_summary: "the counterpart states a plan",
    relevant_memory_handles: [],
    considered_handles: [],
    current_intent: "acknowledge the continuation",
    confidence: 1,
    uncertainty: 0,
    action_intent: null,
    evidence_handles: []
  },
  subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
  communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
  clarification_basis: null,
  response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" }
};

describe("provider-portable cognition proposal contract", () => {
  it("TEST A: every canonical schema requirement is declared in the model-visible prompt", () => {
    const requirements = collectSchemaRequirements(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA);
    // The audit surface itself must be non-trivial, or the assertion below is vacuous.
    expect(requirements.length).toBeGreaterThan(50);

    const invisible = requirements.filter((row) => !CONVERSATION_COGNITION_SYSTEM_PROMPT_V8.includes(row.token));
    expect(
      invisible.map((row) => `${row.kind} ${row.path} token=${JSON.stringify(row.token)}`)
    ).toStrictEqual([]);

    // and the rendered section is derived from that same canonical schema
    const rendered = renderCognitionProposalContractV8(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA);
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8.endsWith(rendered)).toBe(true);
    for (const row of requirements.filter((entry) => entry.kind === "required")) {
      expect(rendered, `rendered contract omits ${row.token}`).toContain(row.token);
    }
  });

  it("TEST B: schema_version consts are model-visible (both top-level and nested)", () => {
    const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V8;
    expect(prompt).toContain("schema_version");
    expect(prompt).toContain("conversation-cognition-proposal-v8");
    expect(prompt).toContain("cognition-proposal-v0");
    // the nested requirement is a real schema fact, not a prompt coincidence
    const nested = collectSchemaRequirements(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)
      .filter((row) => row.kind === "const" && row.token === "cognition-proposal-v0");
    expect(nested.length).toBe(1);
  });

  it("TEST C: communication_directive and its enum are model-visible", () => {
    const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V8;
    expect(prompt).toContain("communication_directive");
    expect(prompt).toContain("CLARIFY_MISSING_CONTEXT");
    expect(prompt).toContain("REALIZE_CURRENT_INTENT");
    // the field is genuinely REQUIRED by the canonical schema
    const topLevelRequired = (CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA["required"] as readonly string[]);
    expect(topLevelRequired).toContain("communication_directive");
    expect(topLevelRequired).toContain("schema_version");
  });

  it("TEST D: dropping any required field from the canonical schema drops it from the contract", () => {
    const topLevelRequired = CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA["required"] as readonly string[];
    const properties = CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA["properties"] as Record<string, unknown>;
    expect(topLevelRequired.length).toBeGreaterThanOrEqual(7);

    for (const name of topLevelRequired) {
      const mutated = {
        ...CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
        required: topLevelRequired.filter((entry) => entry !== name),
        properties
      } as Readonly<Record<string, unknown>>;
      const rendered = renderCognitionProposalContractV8(mutated);
      // the removed required field is no longer declared as REQUIRED...
      expect(rendered, `removal of ${name} was not detected`).not.toContain(`REQUIRED ${name}:`);
      // ...which means the visibility guard is sensitive to exactly this field
      expect(renderCognitionProposalContractV8(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)).toContain(
        `REQUIRED ${name}:`
      );
    }
  });

  it("TEST E: the full contract reaches the model even when the provider cannot enforce the schema", async () => {
    const requirements = collectSchemaRequirements(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)
      .filter((row) => row.kind === "required");
    // a provider WITHOUT grammar enforcement still receives the complete contract text
    const capture = new Capture(VALID_PROPOSAL_V8, false);
    await new ConversationCognitionProviderV8(capture).propose(projection());
    const system = capture.requests[0]?.messages.find((message) => message.role === "system")?.content ?? "";
    for (const row of requirements) {
      expect(system, `model-visible contract omits ${row.token}`).toContain(row.token);
    }
    // and the structured-output request is still sent for providers that DO support it
    expect(capture.requests[0]?.structured_output).toEqual({
      kind: "JSON_SCHEMA",
      schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA
    });
  });

  it("TEST F: the grammar-enforcing route and the generic route receive the same contract", async () => {
    const grammar = new Capture(VALID_PROPOSAL_V8, true);
    const generic = new Capture(VALID_PROPOSAL_V8, false);
    await new ConversationCognitionProviderV8(grammar).propose(projection());
    await new ConversationCognitionProviderV8(generic).propose(projection());

    const grammarRequest = grammar.requests[0];
    const genericRequest = generic.requests[0];
    // byte-identical messages, so neither route sees provider-specific extra semantics
    expect(grammarRequest?.messages).toStrictEqual(genericRequest?.messages);
    expect(grammarRequest?.messages[0]?.content).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8);
    // and both carry the same canonical schema for providers that can enforce it
    expect(grammarRequest?.structured_output).toStrictEqual(genericRequest?.structured_output);
  });
});
