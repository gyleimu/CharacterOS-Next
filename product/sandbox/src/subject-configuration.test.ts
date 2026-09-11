/**
 * PERSISTENT_SUBJECT_CONFIGURATION_V0 — configuration + resolution tests.
 *
 * Fully offline: fake transports. Uses real temporary directories so the
 * config/snapshot filesystem boundary is exercised end to end.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V1,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import {
  SUBJECT_CONFIG_SCHEMA_VERSION,
  SubjectConfigurationErrorV0,
  buildSubjectConfigForCreationV0,
  deriveSubjectIdV0,
  listSnapshotSubjectIdsV0,
  markSubjectDurableStatePresentV0,
  readProductSubjectConfigV0,
  resolvePersistentSubjectV0,
  subjectConfigPathV0,
  validateSubjectIdV0,
  writeProductSubjectConfigV0,
  type ProductSubjectConfigV0
} from "./subject-configuration.js";

type Mode = "CLARIFY" | "REALIZE";

interface TransportRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

function cognitionTransport(mode: () => Mode, recorder: TransportRecorder): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.requests.push({ messages: request.messages.map((m) => ({ role: m.role, content: m.content })) });
      const user = request.messages.find((m) => m.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond to the user",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: {
            kind: mode() === "REALIZE" ? "REALIZE_CURRENT_INTENT" : "CLARIFY_MISSING_CONTEXT"
          }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function languageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((m) => m.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "PRODUCT_REALIZATION_REPLY",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function hostDeps(mode: () => Mode, recorder: TransportRecorder) {
  return {
    conversationCognitionTransport: cognitionTransport(mode, recorder),
    languageTransport: languageTransport(),
    appraisalProvider: createConstantAppraisalProviderV0(),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

function hostConfigFor(
  root: string,
  identity: { subject_id: string; display_name: string; identity_anchors?: readonly string[] }
): InteractiveSubjectHostConfigV0 {
  return {
    subject_id: identity.subject_id,
    display_name: identity.display_name,
    identity_anchors: identity.identity_anchors ?? [],
    session_id: "sess-cfg-test",
    storage_root: root,
    interval_ticks: 1
  };
}

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-config-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

async function createDurableSubject(root: string, subjectId: string, displayName: string): Promise<void> {
  const host = await InteractiveSubjectHostV0.open(
    hostConfigFor(root, { subject_id: subjectId, display_name: displayName }),
    hostDeps(() => "CLARIFY", { requests: [] })
  );
  const outcome = await host.send("Hello, please remember this first message.");
  expect(outcome.status).toBe("COMPLETE");
}

describe("PERSISTENT_SUBJECT_CONFIGURATION_V0 — configuration + resolution", () => {
  it("empty root requires creation; creation config is deterministic and round-trips", async () => {
    const dir = makeTempDir();
    const decision = await resolvePersistentSubjectV0({ dataRoot: dir });
    expect(decision.kind).toBe("CREATE_REQUIRED");
    if (decision.kind === "CREATE_REQUIRED") expect(decision.preset).toBeNull();

    const config = buildSubjectConfigForCreationV0("Alice");
    expect(config.subject_id).toMatch(/^alice-[0-9a-f]{8}$/);
    expect(config.display_name).toBe("Alice");
    expect(config.identity_anchors).toEqual([]);
    expect(config.durable_state).toBe("NONE");
    expect(deriveSubjectIdV0("Alice")).toBe(config.subject_id);

    writeProductSubjectConfigV0(dir, config);
    const onDisk = JSON.parse(readFileSync(subjectConfigPathV0(dir), "utf8")) as ProductSubjectConfigV0;
    expect(onDisk).toEqual(config);
    expect(readProductSubjectConfigV0(dir)).toEqual({ kind: "CONFIG", config });
  });

  it("configuration setup alone creates no Memory (subject still at genesis)", async () => {
    const dir = makeTempDir();
    const config = buildSubjectConfigForCreationV0("Alice");
    writeProductSubjectConfigV0(dir, config);
    const host = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", { requests: [] }));
    const status = await host.status();
    expect(status.repository_revision).toBe("R0");
    expect(status.pending_behavior_outcome).toBe(false);
    expect(listSnapshotSubjectIdsV0(dir)).toHaveLength(0);
  });

  it("malformed configuration fails closed", () => {
    const dir = makeTempDir();
    writeFileSync(subjectConfigPathV0(dir), "{ this is not json", "utf8");
    expect(() => readProductSubjectConfigV0(dir)).toThrow(SubjectConfigurationErrorV0);
  });

  it("unsupported configuration version fails closed", () => {
    const dir = makeTempDir();
    writeFileSync(
      subjectConfigPathV0(dir),
      JSON.stringify({
        schema_version: "subject-config-v99",
        subject_id: "alice-00000000",
        display_name: "Alice",
        identity_anchors: [],
        durable_state: "PRESENT"
      }),
      "utf8"
    );
    expect(() => readProductSubjectConfigV0(dir)).toThrow(/unsupported schema_version/);
  });

  it("unsafe subject ids (path traversal / format) are rejected", async () => {
    const dir = makeTempDir();
    for (const bad of ["../evil", "..", "a/b", "C:\\Windows", "Alice", "", "a".repeat(65), "alice..x"]) {
      expect(() => validateSubjectIdV0(bad, "subject_id")).toThrow(SubjectConfigurationErrorV0);
    }
    await expect(resolvePersistentSubjectV0({ dataRoot: dir, overrideSubjectId: "../evil" })).rejects.toThrow(
      SubjectConfigurationErrorV0
    );
  });

  it("configuration/snapshot subject mismatch fails closed", async () => {
    const dir = makeTempDir();
    await createDurableSubject(dir, "alice-00000000", "Alice");
    writeProductSubjectConfigV0(dir, {
      schema_version: SUBJECT_CONFIG_SCHEMA_VERSION,
      subject_id: "bob-11111111",
      display_name: "Bob",
      identity_anchors: [],
      durable_state: "PRESENT"
    });
    await expect(resolvePersistentSubjectV0({ dataRoot: dir })).rejects.toThrow(/does not match configured subject/);
  });

  it("durable snapshot without configuration is recovered deterministically", async () => {
    const dir = makeTempDir();
    await createDurableSubject(dir, "alice-00000000", "Alice");
    expect(readProductSubjectConfigV0(dir).kind).toBe("NONE");
    const decision = await resolvePersistentSubjectV0({ dataRoot: dir });
    expect(decision.kind).toBe("RECOVER_AND_RESTORE");
    if (decision.kind === "RECOVER_AND_RESTORE") {
      expect(decision.config.subject_id).toBe("alice-00000000");
      expect(decision.config.display_name).toBe("Alice");
      expect(decision.config.durable_state).toBe("PRESENT");
    }
  });

  it("configuration without snapshot: NONE reinitializes, PRESENT fails closed", async () => {
    const noneDir = makeTempDir();
    const noneConfig = buildSubjectConfigForCreationV0("Alice");
    writeProductSubjectConfigV0(noneDir, noneConfig);
    const reinit = await resolvePersistentSubjectV0({ dataRoot: noneDir });
    expect(reinit.kind).toBe("REINITIALIZE");
    if (reinit.kind === "REINITIALIZE") expect(reinit.config.subject_id).toBe(noneConfig.subject_id);

    const presentDir = makeTempDir();
    writeProductSubjectConfigV0(presentDir, {
      schema_version: SUBJECT_CONFIG_SCHEMA_VERSION,
      subject_id: "alice-00000000",
      display_name: "Alice",
      identity_anchors: [],
      durable_state: "PRESENT"
    });
    await expect(resolvePersistentSubjectV0({ dataRoot: presentDir })).rejects.toThrow(
      /durable_state PRESENT but its snapshot is missing/
    );
  });

  it("second launch restores the same subject with continuous revision", async () => {
    const dir = makeTempDir();
    const config = buildSubjectConfigForCreationV0("Alice");
    writeProductSubjectConfigV0(dir, config);
    const first = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", { requests: [] }));
    await first.send("First message.");
    const firstStatus = await first.status();
    writeProductSubjectConfigV0(dir, markSubjectDurableStatePresentV0(dir, config));

    const decision = await resolvePersistentSubjectV0({ dataRoot: dir });
    expect(decision.kind).toBe("RESTORE");
    const second = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", { requests: [] }));
    expect(second.resolution()).toBe("SUBJECT_RESTORED");
    expect(second.subjectId()).toBe(config.subject_id);
    expect(second.displayName()).toBe("Alice");
    const secondStatus = await second.status();
    expect(secondStatus.repository_revision).toBe(firstStatus.repository_revision);
    expect(secondStatus.turn_index).toBe(firstStatus.turn_index);
  });

  it("no duplicate subject creation: a configured root never returns CREATE_REQUIRED", async () => {
    const dir = makeTempDir();
    const config = buildSubjectConfigForCreationV0("Alice");
    writeProductSubjectConfigV0(dir, config);
    const again = await resolvePersistentSubjectV0({ dataRoot: dir });
    expect(again.kind).toBe("REINITIALIZE");
    const host = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", { requests: [] }));
    await host.send("One interaction.");
    const after = await resolvePersistentSubjectV0({ dataRoot: dir });
    expect(after.kind).toBe("RESTORE");
  });

  it("ordinary flow keeps first-turn observational Memory and post-restart retrieval", async () => {
    const dir = makeTempDir();
    const config = buildSubjectConfigForCreationV0("Alice");
    writeProductSubjectConfigV0(dir, config);
    const first = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", { requests: [] }));
    const turnA = await first.send("My favorite color is teal.");
    expect(turnA.observational_experience_ref).toMatch(/^episode:/);
    writeProductSubjectConfigV0(dir, markSubjectDurableStatePresentV0(dir, config));

    const recorderB: TransportRecorder = { requests: [] };
    const second = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", recorderB));
    const turnB = await second.send("I'm buying a notebook. Any color suggestions?");
    expect(turnB.provider_memory_section_present).toBe(true);
    expect(recorderB.requests[0]?.messages[1]?.content ?? "").toContain("teal");
  });

  it("provider prompt semantics are unchanged and the display name never enters the prompt", async () => {
    const dir = makeTempDir();
    const config = buildSubjectConfigForCreationV0("Alice");
    const recorder: TransportRecorder = { requests: [] };
    const host = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", recorder));
    await host.send("Hello there.");
    const request = recorder.requests[0];
    expect(request?.messages).toHaveLength(2);
    expect(request?.messages[0]?.content).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V1);
    const userContent = request?.messages[1]?.content ?? "";
    expect(userContent).toContain(`[identity] subject_id="${config.subject_id}"`);
    expect(userContent).not.toContain("Alice");
    expect(userContent).not.toContain("[CONVERSATION HISTORY]");
    expect(userContent).not.toContain("[TRANSCRIPT]");
  });

  it("/status shows identity without mutation and uses the display-name label", async () => {
    const dir = makeTempDir();
    const config = buildSubjectConfigForCreationV0("Alice");
    const host = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", { requests: [] }));
    const lines: string[] = [];
    const session = new ProductCliSessionV0({
      host,
      subjectLabel: "Alice",
      model: "fake",
      providerLabel: "FAKE",
      contextWindowTokens: 8192,
      maxOutputTokens: 2048,
      debug: false,
      write: (line) => lines.push(line)
    });
    await session.handleLine("Hello.");
    const before = await host.status();
    await session.handleLine("/status");
    const after = await host.status();
    expect(lines.some((line) => line === "Display name: Alice")).toBe(true);
    expect(lines.some((line) => line === `Subject ID: ${config.subject_id}`)).toBe(true);
    expect(lines.some((line) => line.startsWith("Alice > "))).toBe(true);
    expect(after.state_revision).toBe(before.state_revision);
    expect(after.repository_revision).toBe(before.repository_revision);
  });

  it("V0 exposes no rename / subject-lifecycle command", async () => {
    const dir = makeTempDir();
    const config = buildSubjectConfigForCreationV0("Alice");
    const host = await InteractiveSubjectHostV0.open(hostConfigFor(dir, config), hostDeps(() => "CLARIFY", { requests: [] }));
    const lines: string[] = [];
    const session = new ProductCliSessionV0({
      host,
      subjectLabel: "Alice",
      model: "fake",
      providerLabel: "FAKE",
      contextWindowTokens: 8192,
      maxOutputTokens: 2048,
      debug: false,
      write: (line) => lines.push(line)
    });
    for (const command of ["/rename Bob", "/delete-subject", "/new-subject", "/reset"]) {
      await session.handleLine(command);
    }
    expect(lines.filter((line) => line.includes("Unknown command"))).toHaveLength(4);
  });
});
