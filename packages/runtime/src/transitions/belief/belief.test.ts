/** BeliefState Foundation V0 executable acceptance coverage. No model/network calls. */

import { describe, expect, it } from "vitest";
import {
  BELIEF_STATE_SCHEMA_VERSION,
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  deriveBeliefPropositionId,
  restoreFromEnvelope,
  stateHash,
  validateBeliefState,
  validateIdentifier,
  validateLogicalTime,
  validateStateRevision,
  validateSubjectState,
  type BeliefItemStateV0,
  type InMemoryFacadeAssembly,
  type ProducerAuthorizationIssuer,
  type SubjectStateV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  parseEpisodeRef,
  type EpisodeRef,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { buildCognitiveContextProjection } from "../cognition-action/cognition-action-transition-executor.js";
import { allowedEvidenceSet } from "../cognition-action/types.js";
import { s0 } from "../observation/observation-fixtures.js";
import { initializeEmptyBeliefState } from "./belief-init.js";
import {
  BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
  deriveBeliefEvidenceMemberSetFingerprint,
  deriveBeliefTransitionId,
  validateBeliefMutationProposal,
  type BeliefMutationProposalV0
} from "./belief-mutation-proposal.js";
import { BeliefTransitionExecutor } from "./belief-transition-executor.js";

const SUBJECT_ID = "subject-s0";
const OTHER_SUBJECT_ID = "subject-other";
const PROPOSITION_KEY = "alice-is-reliable";
const PROPOSITION_LABEL = "Alice is reliable";
const EPISODE_A = "episode:belief-evidence-a";
const EPISODE_B = "episode:belief-evidence-b";
const EPISODE_NEWER = "episode:belief-evidence-newer";
const EPISODE_MISSING = "episode:belief-evidence-missing";

function requireOk<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(result.error.detail);
  return result.value;
}

function episodeRef(raw: string): EpisodeRef {
  return requireOk(parseEpisodeRef(raw, "fixture.episode_ref"));
}

function context(stateRevision = 0): RuntimeContext {
  return {
    subject_id: requireOk(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    current_logical_time: requireOk(validateLogicalTime(0, "ctx.current_logical_time")),
    state_revision: requireOk(validateStateRevision(stateRevision, "ctx.state_revision"))
  };
}

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly journal: InMemoryFacadeAssembly["journal"];
  readonly storeRead: InMemoryFacadeAssembly["storeRead"];
}

function createTestCore(
  snapshot: SubjectStateV0,
  memory: InMemoryMemoryRepository
): TestCore {
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[snapshot.identity.subject_id, snapshot]]),
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async (binding) =>
      memory.validateRevisionBinding(
        binding as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      )
  });
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (transitionId, subjectId, fingerprint) =>
      assembly.facade.reconcile(transitionId, subjectId, fingerprint),
    readCurrentSnapshot: async (subjectId) => {
      const bundle = assembly.storeRead.readCurrentBundle(subjectId);
      return bundle === null ? snapshot : bundle.next_snapshot;
    }
  };
  return {
    ...port,
    issuer: assembly.producerAuthorizationIssuer,
    journal: assembly.journal,
    storeRead: assembly.storeRead
  };
}

function memoryRepository(): InMemoryMemoryRepository {
  const memory = new InMemoryMemoryRepository();
  void memory.prepareRevision({ parent_revision: null, records: [] });
  void memory.prepareRevision({
    parent_revision: "R0" as never,
    records: [
      { ref: EPISODE_A, payload_hash: `sha256:${"1".repeat(64)}` },
      { ref: EPISODE_B, payload_hash: `sha256:${"2".repeat(64)}` }
    ] as never
  });
  void memory.prepareRevision({
    parent_revision: "R1" as never,
    records: [
      { ref: EPISODE_NEWER, payload_hash: `sha256:${"3".repeat(64)}` }
    ] as never
  });
  return memory;
}

function fixtureState(items: readonly BeliefItemStateV0[] = []): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  return {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: "R1" as never },
    beliefs: { schema_version: BELIEF_STATE_SCHEMA_VERSION, items }
  };
}

function buildWorld(items: readonly BeliefItemStateV0[] = []) {
  const memory = memoryRepository();
  const initial = fixtureState(items);
  const core = createTestCore(initial, memory);
  const executor = new BeliefTransitionExecutor({
    subjectCore: core,
    issuer: core.issuer,
    memoryRepository: memory
  });
  return { initial, memory, core, executor };
}

async function evidenceFingerprint(memberRefs: readonly string[]): Promise<string> {
  return deriveBeliefEvidenceMemberSetFingerprint(memberRefs.map(episodeRef));
}

async function insertProposal(options: {
  readonly proposition_key?: string;
  readonly proposition_label?: unknown;
  readonly initial_credence?: unknown;
  readonly expected_state_revision?: number;
  readonly member_refs?: readonly string[];
  readonly fingerprint_override?: string;
  readonly extra?: Record<string, unknown>;
} = {}): Promise<unknown> {
  const memberRefs = options.member_refs ?? [EPISODE_A];
  return {
    schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: SUBJECT_ID,
    expected_state_revision: options.expected_state_revision ?? 0,
    mutation: {
      kind: "INSERT",
      proposition_key: options.proposition_key ?? PROPOSITION_KEY,
      proposition_label: options.proposition_label ?? PROPOSITION_LABEL,
      initial_credence: options.initial_credence ?? 0.6
    },
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint:
        options.fingerprint_override ?? (await evidenceFingerprint(memberRefs))
    },
    ...options.extra
  };
}

async function updateProposal(
  propositionId: string,
  options: {
    readonly next_credence?: unknown;
    readonly expected_state_revision?: number;
    readonly member_refs?: readonly string[];
    readonly fingerprint_override?: string;
    readonly mutation_extra?: Record<string, unknown>;
  } = {}
): Promise<unknown> {
  const memberRefs = options.member_refs ?? [EPISODE_A];
  return {
    schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: SUBJECT_ID,
    expected_state_revision: options.expected_state_revision ?? 0,
    mutation: {
      kind: "UPDATE",
      proposition_id: propositionId,
      next_credence: options.next_credence ?? 0.7,
      ...options.mutation_extra
    },
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint:
        options.fingerprint_override ?? (await evidenceFingerprint(memberRefs))
    }
  };
}

async function propositionId(
  subjectId = SUBJECT_ID,
  propositionKey = PROPOSITION_KEY
): Promise<string> {
  return deriveBeliefPropositionId(
    requireOk(validateIdentifier(subjectId, "fixture.subject_id")),
    requireOk(validateIdentifier(propositionKey, "fixture.proposition_key"))
  );
}

describe("BeliefState V0 canonical foundation", () => {
  it("admits a deeply immutable empty belief-state-v0 genesis", () => {
    const empty = initializeEmptyBeliefState();
    expect(empty).toEqual({ schema_version: "belief-state-v0", items: [] });
    expect(validateBeliefState(empty, "beliefs").ok).toBe(true);
    expect(Object.isFrozen(empty)).toBe(true);
    expect(Object.isFrozen(empty.items)).toBe(true);
  });

  it("derives deterministic CharacterOS proposition ids from subject and key", async () => {
    const first = await propositionId();
    expect(await propositionId()).toBe(first);
    expect(await propositionId(OTHER_SUBJECT_ID)).not.toBe(first);
    expect(await propositionId(SUBJECT_ID, "alice-is-not-reliable")).not.toBe(first);
    expect(first).toMatch(/^belief-[0-9a-f]{64}$/);
    expect(validateIdentifier(first, "proposition_id").ok).toBe(true);
  });

  it("enforces label NFC, trimming, nonempty, and 512 UTF-16-unit maximum", async () => {
    const id = await propositionId();
    const valid = (label: string) =>
      validateBeliefState(
        {
          schema_version: "belief-state-v0",
          items: [{ proposition_id: id, proposition_label: label, credence: 0.5 }]
        },
        "beliefs"
      ).ok;
    expect(valid("a".repeat(512))).toBe(true);
    for (const invalid of ["", "   ", " leading", "trailing ", "e\u0301", "a".repeat(513)]) {
      expect(valid(invalid), JSON.stringify(invalid.slice(0, 20))).toBe(false);
    }
  });

  it("admits credence 0/0.5/1 and rejects nonfinite or out-of-range values", async () => {
    const id = await propositionId();
    const valid = (credence: number) =>
      validateBeliefState(
        {
          schema_version: "belief-state-v0",
          items: [{ proposition_id: id, proposition_label: PROPOSITION_LABEL, credence }]
        },
        "beliefs"
      ).ok;
    expect([0, 0.5, 1].every(valid)).toBe(true);
    expect([Number.NaN, Infinity, -Infinity, -0.01, 1.01].every((value) => !valid(value))).toBe(
      true
    );
  });

  it("requires closed items, raw-ASCII proposition ordering, and uniqueness", async () => {
    const a = await propositionId(SUBJECT_ID, "a");
    const b = await propositionId(SUBJECT_ID, "b");
    const first = a < b ? a : b;
    const second = a < b ? b : a;
    const item = (id: string) => ({
      proposition_id: id,
      proposition_label: PROPOSITION_LABEL,
      credence: 0.5
    });
    expect(
      validateBeliefState(
        { schema_version: "belief-state-v0", items: [item(first), item(second)] },
        "beliefs"
      ).ok
    ).toBe(true);
    expect(
      validateBeliefState(
        { schema_version: "belief-state-v0", items: [item(second), item(first)] },
        "beliefs"
      ).ok
    ).toBe(false);
    expect(
      validateBeliefState(
        { schema_version: "belief-state-v0", items: [item(first), item(first)] },
        "beliefs"
      ).ok
    ).toBe(false);
    expect(
      validateBeliefState(
        {
          schema_version: "belief-state-v0",
          items: [{ ...item(first), confidence: 1 }]
        },
        "beliefs"
      ).ok
    ).toBe(false);
  });
});

describe("Belief mutation proposal and evidence admission", () => {
  it("admits closed INSERT/UPDATE variants and makes UPDATE label-immutable by schema", async () => {
    const insert = validateBeliefMutationProposal(await insertProposal());
    expect(insert.ok).toBe(true);
    const update = validateBeliefMutationProposal(
      await updateProposal(await propositionId())
    );
    expect(update.ok).toBe(true);
    expect(
      validateBeliefMutationProposal(
        await updateProposal(await propositionId(), {
          mutation_extra: { proposition_label: "replacement" }
        })
      ).ok
    ).toBe(false);
    expect(
      validateBeliefMutationProposal(await insertProposal({ extra: { beliefs: {} } })).ok
    ).toBe(false);
  });

  it("rejects non-episode, empty, duplicate, and unordered evidence sets", async () => {
    const fingerprint = `sha256:${"0".repeat(64)}`;
    for (const refs of [
      [],
      ["memory:not-episode"],
      [EPISODE_A, EPISODE_A],
      [EPISODE_B, EPISODE_A]
    ]) {
      expect(
        validateBeliefMutationProposal(
          await insertProposal({ member_refs: refs, fingerprint_override: fingerprint })
        ).ok
      ).toBe(false);
    }
  });
});

describe("BeliefTransitionExecutor authority", () => {
  it("commits one evidence-bound INSERT with one /beliefs delta and no cross-domain cascade", async () => {
    const world = buildWorld();
    const before = structuredClone(world.initial);
    const beforeHash = await stateHash(world.initial);
    const result = await world.executor.execute(context(), await insertProposal());
    expect(result.kind, "detail" in result ? result.detail : "").toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;
    const after = result.bundle.next_snapshot;
    const expectedId = await propositionId();
    expect(after.schema_version).toBe("subject-state-v3");
    expect(after.beliefs).toEqual({
      schema_version: "belief-state-v0",
      items: [
        {
          proposition_id: expectedId,
          proposition_label: PROPOSITION_LABEL,
          credence: 0.6
        }
      ]
    });
    expect(after.runtime_metadata.state_revision).toBe(1);
    expect(after.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
    expect(await stateHash(after)).not.toBe(beforeHash);
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(1);
    expect(after.trace_window.entries).toHaveLength(1);
    const trace = after.trace_window.entries[0];
    expect(trace?.transition_type).toBe("Belief");
    expect(trace?.cause_refs).toEqual([EPISODE_A]);
    expect(trace?.domain_mutations).toEqual([
      {
        producer: "belief",
        domain: "belief",
        layers: ["beliefs"],
        field_changes: [{ path: "/beliefs", operation: "SET" }]
      }
    ]);
    for (const key of [
      "identity",
      "traits_seed",
      "personality",
      "memory_state",
      "relationships",
      "mood",
      "affect",
      "regulation",
      "context",
      "mechanism_config"
    ] as const) {
      expect(after[key], key).toEqual(before[key]);
    }
  });

  it("updates only the target credence while preserving immutable label and identity", async () => {
    const world = buildWorld();
    const inserted = await world.executor.execute(context(), await insertProposal());
    expect(inserted.kind).toBe("COMMITTED");
    if (inserted.kind !== "COMMITTED") return;
    const id = inserted.beliefs.items[0]?.proposition_id;
    if (id === undefined) throw new Error("missing inserted proposition");
    const beforeUpdateHash = await stateHash(inserted.bundle.next_snapshot);
    const updated = await world.executor.execute(
      context(1),
      await updateProposal(id, { expected_state_revision: 1, next_credence: 0.8 })
    );
    expect(updated.kind, "detail" in updated ? updated.detail : "").toBe("COMMITTED");
    if (updated.kind !== "COMMITTED") return;
    expect(updated.beliefs.items).toEqual([
      { proposition_id: id, proposition_label: PROPOSITION_LABEL, credence: 0.8 }
    ]);
    expect(updated.bundle.next_revision).toBe(2);
    expect(updated.bundle.next_snapshot.trace_window.entries).toHaveLength(2);
    expect(await stateHash(updated.bundle.next_snapshot)).not.toBe(beforeUpdateHash);
    expect(updated.bundle.next_snapshot.personality).toEqual(world.initial.personality);
    expect(updated.bundle.next_snapshot.relationships).toEqual(world.initial.relationships);
  });

  it("rejects a duplicate INSERT and an UPDATE of an unknown proposition", async () => {
    const world = buildWorld();
    expect((await world.executor.execute(context(), await insertProposal())).kind).toBe("COMMITTED");
    const duplicate = await world.executor.execute(
      context(1),
      await insertProposal({ expected_state_revision: 1, member_refs: [EPISODE_B] })
    );
    expect(duplicate.kind).toBe("REJECTED_ALREADY_REGISTERED");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(1);

    const unknown = await world.executor.execute(
      context(1),
      await updateProposal(`belief-${"f".repeat(64)}`, { expected_state_revision: 1 })
    );
    expect(unknown.kind).toBe("REJECTED_UNKNOWN_PROPOSITION");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(1);
  });

  it("durably terminalizes a same-value UPDATE with revision/hash/trace +0", async () => {
    const id = await propositionId();
    const world = buildWorld([
      {
        proposition_id: id as never,
        proposition_label: PROPOSITION_LABEL,
        credence: 0.5 as never
      }
    ]);
    const beforeHash = await stateHash(world.initial);
    const proposal = await updateProposal(id, { next_credence: 0.5 });
    const result = await world.executor.execute(context(), proposal);
    expect(result.kind).toBe("NO_OP");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
    const after = await world.core.readCurrentSnapshot(world.initial.identity.subject_id);
    expect(after?.runtime_metadata.state_revision).toBe(0);
    expect(after?.trace_window.entries).toHaveLength(0);
    expect(after === null ? null : await stateHash(after)).toBe(beforeHash);
    const transition = requireOk(
      validateBeliefMutationProposal(proposal)
    ) as BeliefMutationProposalV0;
    const transitionId = await deriveBeliefTransitionId(transition);
    const record = await world.core.journal.readRecord(transitionId);
    expect(record?.terminal_status).toBe("NO_OP");
    expect(record?.attempts[0]?.reason).toBe("TR-ATOMIC-001");
    expect((await world.executor.execute(context(), proposal)).kind).toBe("NO_OP");
    expect(
      (
        await world.executor.execute(
          context(),
          await updateProposal(id, { next_credence: 0.6 })
        )
      ).kind
    ).toBe("REUSE_CONFLICT");
  });

  it("rejects forged, missing, and newer-than-bound evidence before mutation", async () => {
    const cases = [
      await insertProposal({ fingerprint_override: `sha256:${"f".repeat(64)}` }),
      await insertProposal({ member_refs: [EPISODE_MISSING] }),
      await insertProposal({ member_refs: [EPISODE_NEWER] })
    ];
    const expected = [
      "REJECTED_FORGED_EVIDENCE_FINGERPRINT",
      "REJECTED_UNVERIFIED_EVIDENCE_MEMBER",
      "REJECTED_UNVERIFIED_EVIDENCE_MEMBER"
    ];
    for (let index = 0; index < cases.length; index++) {
      const world = buildWorld();
      expect((await world.executor.execute(context(), cases[index])).kind).toBe(expected[index]);
      expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
    }
  });

  it("rejects a repository manifest that does not match the bound revision", async () => {
    const world = buildWorld();
    const manifest = await world.memory.readManifest("R1" as never);
    if (manifest === null) throw new Error("expected R1 fixture manifest");
    world.memory.readManifest = async () => ({
      ...manifest,
      repository_revision: "R2" as never
    });

    const result = await world.executor.execute(context(), await insertProposal());
    expect(result.kind).toBe("REJECTED_UNVERIFIED_EVIDENCE_MEMBER");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("rejects stale expected revision without rewriting it", async () => {
    const world = buildWorld();
    const stale = await world.executor.execute(
      context(),
      await insertProposal({ expected_state_revision: 4 })
    );
    expect(stale.kind).toBe("REJECTED_STALE_REVISION");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("routes exact committed replay to ALREADY_COMMITTED with revision +0", async () => {
    const world = buildWorld();
    const proposal = await insertProposal();
    const first = await world.executor.execute(context(), proposal);
    expect(first.kind).toBe("COMMITTED");
    const replay = await world.executor.execute(context(), proposal);
    expect(replay.kind).toBe("ALREADY_COMMITTED");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(1);
  });

  it("routes same intent with changed label or credence payload to REUSE_CONFLICT", async () => {
    const world = buildWorld();
    expect((await world.executor.execute(context(), await insertProposal())).kind).toBe("COMMITTED");
    const changedLabel = await world.executor.execute(
      context(),
      await insertProposal({ proposition_label: "Alice is consistently reliable" })
    );
    expect(changedLabel.kind).toBe("REUSE_CONFLICT");

    const id = await propositionId();
    const updateA = await updateProposal(id, {
      expected_state_revision: 1,
      next_credence: 0.7,
      member_refs: [EPISODE_B]
    });
    expect((await world.executor.execute(context(1), updateA)).kind).toBe("COMMITTED");
    const changedCredence = await world.executor.execute(
      context(1),
      await updateProposal(id, {
        expected_state_revision: 1,
        next_credence: 0.9,
        member_refs: [EPISODE_B]
      })
    );
    expect(changedCredence.kind).toBe("REUSE_CONFLICT");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(2);
  });

  it("restores a committed V3 belief snapshot with exact hashes and checksums", async () => {
    const world = buildWorld();
    const inserted = await world.executor.execute(context(), await insertProposal());
    expect(inserted.kind).toBe("COMMITTED");
    if (inserted.kind !== "COMMITTED") return;
    const envelope = await createPersistenceEnvelope({
      snapshot: inserted.bundle.next_snapshot,
      repository_bindings: inserted.bundle.repository_revision_bindings,
      commit_head: {
        commit_ref: inserted.bundle.commit_ref,
        record_checksum: inserted.bundle.record_checksum
      }
    });
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    const restored = await restoreFromEnvelope(envelope.value, {
      referenceValidator: async () => true,
      commitChainVerifier: async () => true
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.snapshot).toEqual(inserted.bundle.next_snapshot);
    expect(restored.snapshot.beliefs).toEqual(inserted.beliefs);
    expect(await stateHash(restored.snapshot)).toBe(envelope.value.state_hash);
    expect(Object.isFrozen(restored.snapshot)).toBe(true);
    expect(Object.isFrozen(restored.snapshot.beliefs.items)).toBe(true);
  });

  it("rejects V2-as-V3, mixed placeholder shape, and malformed belief-state-v0", () => {
    const current = fixtureState();
    expect(validateSubjectState({ ...current, schema_version: "subject-state-v2" }).ok).toBe(
      false
    );
    expect(validateSubjectState({ ...current, beliefs: { items: [] } }).ok).toBe(false);
    expect(
      validateSubjectState({
        ...current,
        beliefs: { schema_version: "belief-state-v0", items: [], extra: true }
      }).ok
    ).toBe(false);
  });

  it("keeps cognition count-only and does not make belief state citeable", async () => {
    const id = await propositionId();
    const snapshot = fixtureState([
      {
        proposition_id: id as never,
        proposition_label: PROPOSITION_LABEL,
        credence: 0.75 as never
      }
    ]);
    const projection = await buildCognitiveContextProjection(snapshot);
    expect(projection.belief_item_count).toBe(1);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain(id);
    expect(serialized).not.toContain(PROPOSITION_LABEL);
    expect(allowedEvidenceSet(projection).has(id)).toBe(false);
  });

  it("roundtrips Belief journal identity and contains no model/network/random authority", async () => {
    const world = buildWorld();
    const proposal = await insertProposal();
    expect((await world.executor.execute(context(), proposal)).kind).toBe("COMMITTED");
    const validated = requireOk(validateBeliefMutationProposal(proposal));
    const transitionId = await deriveBeliefTransitionId(validated);
    const exported = world.core.journal.exportState();
    expect(exported.find((record) => record.transition_id === transitionId)?.transition_type).toBe(
      "Belief"
    );
    const other = buildWorld();
    other.core.journal.importState(structuredClone(exported));
    expect((await other.core.journal.readRecord(transitionId))?.transition_type).toBe("Belief");

    const executable = [
      initializeEmptyBeliefState,
      deriveBeliefPropositionId,
      deriveBeliefEvidenceMemberSetFingerprint,
      deriveBeliefTransitionId,
      validateBeliefMutationProposal,
      BeliefTransitionExecutor
    ]
      .map((entry) => entry.toString())
      .join("\n");
    for (const forbidden of [
      "Date.now",
      "new Date",
      "Math.random",
      "randomUUID",
      "fetch(",
      "eval(",
      "Function(",
      "child_process",
      "OpenAI",
      "Ollama",
      "LM Studio"
    ]) {
      expect(executable).not.toContain(forbidden);
    }
  });
});
