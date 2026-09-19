/**
 * LONG_HORIZON_COGNITION_MEMORY_USAGE_REMEDIATION_V0 — offline clause tests (0 model
 * calls).
 *
 * C1/C2: the memory-usage clause is appended to the cognition system prompt EXACTLY
 *        when the projection carries a non-empty factual-memory evidence bundle —
 *        EMPTY-genesis requests stay byte-identical to the frozen prompt, which keeps
 *        every preregistered request intact (verified by the frozen suites).
 * C3:    the clause states the general usage law (available evidence, may use, may
 *        ignore, clarification remains lawful when nothing resolves, latest chronology,
 *        prior-question entries never resolve, cite what you use) and contains NO
 *        domain vocabulary.
 */

import { describe, expect, it } from "vitest";

import {
  COGNITION_MEMORY_USAGE_CLAUSE_V8,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V8,
  cognitionSystemPromptForV8
} from "./conversation-cognition-provider-v8.js";

function projectionWithEvidence(entries: readonly unknown[]): unknown {
  return {
    schema_version: "cognitive-context-projection-v2",
    factual_memory_evidence: { schema_version: "factual-memory-evidence-v0", entries }
  };
}

describe("C1/C2: the clause is appended exactly when prior factual memory is present", () => {
  it("no evidence: the system prompt is byte-identical to the frozen V8 prompt", () => {
    expect(cognitionSystemPromptForV8({})).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8);
    expect(cognitionSystemPromptForV8({ factual_memory_evidence: { entries: [] } })).toBe(
      CONVERSATION_COGNITION_SYSTEM_PROMPT_V8
    );
    expect(cognitionSystemPromptForV8(null)).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8);
    expect(cognitionSystemPromptForV8(undefined)).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8);
  });

  it("evidence present: the frozen prompt plus exactly one appended clause", () => {
    const withClause = cognitionSystemPromptForV8(projectionWithEvidence([{ kind: "EPISODE_SCENE" }]));
    expect(withClause.startsWith(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8)).toBe(true);
    expect(withClause.endsWith(`\n${COGNITION_MEMORY_USAGE_CLAUSE_V8}`)).toBe(true);
    // Exactly one occurrence — deterministic, never duplicated.
    expect(withClause.split(COGNITION_MEMORY_USAGE_CLAUSE_V8)).toHaveLength(2);
  });
});

describe("C3: the clause states the general usage law with no domain vocabulary", () => {
  it("available evidence — may use, not must", () => {
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("candidate factual evidence for THIS turn");
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("ground a SOURCE_QUOTE claim in that entry and answer");
  });

  it("irrelevant entries are ignorable and clarification stays lawful when nothing resolves", () => {
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("You may ignore entries that do not resolve anything");
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("clarification remains correct");
  });

  it("contradiction safety: latest chronology governs, never blind assertion of the older entry", () => {
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("do not assert the older one blindly");
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("latest chronology");
  });

  it("self-match safety: a prior similar question never resolves anything by itself", () => {
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("merely a prior similar question never resolves anything");
  });

  it("source preservation: cite the entry actually used", () => {
    expect(COGNITION_MEMORY_USAGE_CLAUSE_V8).toContain("Always cite the entry you actually used");
  });

  it("no domain vocabulary anywhere in the clause", () => {
    for (const forbidden of ["whetstone", "bandsaw", "drawer", "chisel", "cider", "shelf", "alice", "stool"]) {
      expect(COGNITION_MEMORY_USAGE_CLAUSE_V8.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("the frozen V8 prompt chain is the base of the conditional result (not a modified copy)", () => {
    const noEvidence = cognitionSystemPromptForV8({});
    expect(noEvidence).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8);
    expect(noEvidence).not.toContain(COGNITION_MEMORY_USAGE_CLAUSE_V8);
  });
});
