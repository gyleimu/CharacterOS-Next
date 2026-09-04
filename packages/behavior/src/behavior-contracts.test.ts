/**
 * Behavior package contracts — acceptance suite
 * (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0): exact closed draft schema, text
 * bounds, canonical evidence law, host-owned behavior construction and
 * deterministic behavior_id identity.
 */

import { describe, expect, it } from "vitest";

import {
  LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0,
  LANGUAGE_REALIZATION_DRAFT_SCHEMA_VERSION_V0,
  validateLanguageRealizationDraftV0,
  buildCharacterLanguageBehaviorV0,
  CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0
} from "./index.js";

const HASH = "sha256:" + "a".repeat(64);
const ALICE_EPISODE = "episode:alice-01";

function validDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: LANGUAGE_REALIZATION_DRAFT_SCHEMA_VERSION_V0,
    input_hash: HASH,
    text: "Sure — I will keep the update concise and factual.",
    evidence_refs: [ALICE_EPISODE],
    ...overrides
  };
}

describe("LanguageRealizationDraftV0 validation", () => {
  it("accepts an exact closed valid draft", () => {
    const checked = validateLanguageRealizationDraftV0(validDraft());
    expect(checked.ok).toBe(true);
  });

  it("rejects unknown fields, wrong schema, non-object and missing keys", () => {
    expect(validateLanguageRealizationDraftV0(validDraft({ extra: 1 })).ok).toBe(false);
    expect(validateLanguageRealizationDraftV0(validDraft({ schema_version: "other-v0" })).ok).toBe(false);
    expect(validateLanguageRealizationDraftV0({ nope: true }).ok).toBe(false);
    const missing = validDraft();
    delete missing["text"];
    expect(validateLanguageRealizationDraftV0(missing).ok).toBe(false);
  });

  it("rejects empty, whitespace-only and non-canonical text without repair", () => {
    expect(validateLanguageRealizationDraftV0(validDraft({ text: "" })).ok).toBe(false);
    expect(validateLanguageRealizationDraftV0(validDraft({ text: "   \n\t " })).ok).toBe(false);
    expect(validateLanguageRealizationDraftV0(validDraft({ text: 42 })).ok).toBe(false);
    // control character: NUL is forbidden by the repository canonical text rule
    expect(validateLanguageRealizationDraftV0(validDraft({ text: "bad\u0000text" })).ok).toBe(false);
  });

  it("rejects text beyond the frozen 4096 code-point bound (no truncation)", () => {
    const oversized = "x".repeat(LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0 + 1);
    const checked = validateLanguageRealizationDraftV0(validDraft({ text: oversized }));
    expect(checked.ok).toBe(false);
    const exactlyAtBound = "x".repeat(LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0);
    expect(validateLanguageRealizationDraftV0(validDraft({ text: exactlyAtBound })).ok).toBe(true);
  });

  it("rejects malformed input_hash", () => {
    expect(validateLanguageRealizationDraftV0(validDraft({ input_hash: "sha256:xyz" })).ok).toBe(false);
    expect(validateLanguageRealizationDraftV0(validDraft({ input_hash: 7 })).ok).toBe(false);
  });

  it("rejects duplicate, unsorted and non-canonical evidence refs", () => {
    expect(
      validateLanguageRealizationDraftV0(validDraft({ evidence_refs: [ALICE_EPISODE, ALICE_EPISODE] })).ok
    ).toBe(false);
    expect(
      validateLanguageRealizationDraftV0(
        validDraft({ evidence_refs: ["episode:zzz-last", ALICE_EPISODE] })
      ).ok
    ).toBe(false);
    expect(validateLanguageRealizationDraftV0(validDraft({ evidence_refs: ["not-a-ref"] })).ok).toBe(false);
    expect(validateLanguageRealizationDraftV0(validDraft({ evidence_refs: "episode:alice-01" })).ok).toBe(false);
  });
});

describe("CharacterLanguageBehaviorV0 host construction", () => {
  it("builds a closed host-owned artifact with deterministic behavior_id", async () => {
    const draft = validateLanguageRealizationDraftV0(validDraft());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const built = await buildCharacterLanguageBehaviorV0({
      subject_id: "subject-s0" as never,
      source_revision: 7 as never,
      response_request_id: "resp-1" as never,
      draft: draft.value
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.behavior.schema_version).toBe(CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0);
    expect(built.behavior.behavior_id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(built.behavior.subject_id).toBe("subject-s0");
    expect(built.behavior.source_revision).toBe(7);
    expect(built.behavior.response_request_id).toBe("resp-1");
    expect(built.behavior.input_hash).toBe(HASH);
    expect(built.behavior.text).toBe(draft.value.text);
    expect(built.behavior.evidence_refs).toStrictEqual([ALICE_EPISODE]);
    expect(Object.isFrozen(built.behavior)).toBe(true);

    const again = await buildCharacterLanguageBehaviorV0({
      subject_id: "subject-s0" as never,
      source_revision: 7 as never,
      response_request_id: "resp-1" as never,
      draft: draft.value
    });
    expect(again.ok && built.ok ? again.behavior.behavior_id : null).toBe(built.behavior.behavior_id);
  });

  it("behavior_id changes when validated draft material changes", async () => {
    const draftA = validateLanguageRealizationDraftV0(validDraft());
    const draftB = validateLanguageRealizationDraftV0(validDraft({ text: "Different validated text." }));
    expect(draftA.ok && draftB.ok).toBe(true);
    if (!draftA.ok || !draftB.ok) return;
    const a = await buildCharacterLanguageBehaviorV0({
      subject_id: "subject-s0" as never,
      source_revision: 7 as never,
      response_request_id: "resp-1" as never,
      draft: draftA.value
    });
    const b = await buildCharacterLanguageBehaviorV0({
      subject_id: "subject-s0" as never,
      source_revision: 7 as never,
      response_request_id: "resp-1" as never,
      draft: draftB.value
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.behavior.behavior_id).not.toBe(b.behavior.behavior_id);
  });

  it("rejects malformed host bindings and oversized drafts", async () => {
    const draft = validateLanguageRealizationDraftV0(validDraft());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(
      (await buildCharacterLanguageBehaviorV0({ subject_id: "" as never, source_revision: 1 as never, response_request_id: "resp-1" as never, draft: draft.value })).ok
    ).toBe(false);
    expect(
      (await buildCharacterLanguageBehaviorV0({ subject_id: "subject-s0" as never, source_revision: -1 as never, response_request_id: "resp-1" as never, draft: draft.value })).ok
    ).toBe(false);
    expect(
      (await buildCharacterLanguageBehaviorV0({ subject_id: "subject-s0" as never, source_revision: 1 as never, response_request_id: "resp-1" as never, draft: undefined })).ok
    ).toBe(false);
  });
});
