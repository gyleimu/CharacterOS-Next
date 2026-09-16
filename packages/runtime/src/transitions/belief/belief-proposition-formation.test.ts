/**
 * BELIEF_PROPOSITION_ADMISSION_V0 — proposition formation acceptance suite (Tests A–R).
 *
 * ONE offline deterministic suite exercising the REAL production stack end to end:
 *
 *   verified lived evidence
 *   → frozen Belief Semantic Target Resolution (EXISTING / NEW / NO_BEARING)
 *   → frozen Belief Adaptation Workflow V0 (durable checkpoint protocol)
 *   → HOST Belief Proposition Admission (canonical label, content-addressed key,
 *     host initial credence, duplicate routing) for a NEW candidate
 *   → frozen BeliefPlasticityProducer (±0.05) for an EXISTING candidate
 *   → frozen BeliefTransitionExecutor → SubjectCore canonical commit
 *
 * The semantic provider is TEST-LOCAL, deterministic and label-only: zero real
 * model calls, zero network. Every numeric/identity authority claim in this file
 * is a HOST value asserted against the canonical state.
 *
 * Test map:
 *   A  first belief from an empty genesis catalog
 *   B  empty catalog + abstention writes nothing
 *   C  a second DISTINCT proposition is lawfully formed
 *   D  an exact duplicate routes to the existing proposition (frozen +0.05)
 *   E  a contradiction uses the frozen -0.05 law (no inverse proposition)
 *   F  provider identity attacks fail closed
 *   G  provider numeric attacks fail closed
 *   H  evidence attacks fail closed
 *   I  canonical label normalization (NFC / whitespace) → same identity
 *   J  near duplicates stay distinct (no fuzzy merge in V0)
 *   K  durable-candidate tamper (label / evidence / kind) fails closed
 *   L  restart/restore keeps the formed belief (fresh store image, no journal)
 *   M  replay never double-creates
 *   N  existing-proposition plasticity regression (frozen ±0.05 unchanged)
 *   O  deterministic cognition projection sees the formed belief (no LLM)
 *   P  no decision/tendency/arbitration consumer was integrated
 *   Q  multiple formed propositions restore deterministically
 *   R  a NEW candidate under a NON-EMPTY catalog is never discarded
 */

import { describe, expect, it } from "vitest";
import * as beliefDomain from "./index.js";
import * as admissionModule from "./belief-proposition-admission.js";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import {
  BELIEF_STATE_SCHEMA_VERSION,
  createInMemorySubjectCoreFacade,
  deriveBeliefPropositionId,
  type AtomicCommitBundleAnyVersion,
  type InMemoryFacadeAssembly,
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";
import { s0 } from "../observation/observation-fixtures.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0
} from "./belief-semantic-target-resolution.js";
import {
  BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
  deriveBeliefAdaptationSemanticCandidateFingerprint,
  deriveBeliefAdaptationWorkflowCheckpointFingerprint,
  runBeliefAdaptationWorkflowV0,
  type BeliefAdaptationTerminalV0,
  type BeliefAdaptationWorkflowDepsV0,
  type BeliefAdaptationWorkflowRecordV0
} from "./belief-adaptation-workflow.js";
import { InMemoryBeliefAdaptationWorkflowStoreV0 } from "./belief-adaptation-workflow-store.js";
import {
  BELIEF_NEW_CANDIDATE_ROUTED_EXISTING_RELATION_V0,
  BELIEF_PROPOSITION_FIRST_CREDENCE,
  BELIEF_PROPOSITION_STANCE_ZERO_CREDENCE,
  decideBeliefPropositionAdmissionV0,
  deriveBeliefPropositionAdmissionOutputFingerprintV0,
  deriveBeliefPropositionKeyV0,
  deriveCanonicalBeliefPropositionLabelV0,
  executeBeliefPropositionAdmissionV0,
  validateBeliefAdmissionEvidenceRefsV0
} from "./belief-proposition-admission.js";
import {
  buildCognitiveContextProjection
} from "../cognition-action/cognition-action-transition-executor.js";
import { renderCognitiveSubjectData } from "../../providers/cognition/cognitive-prompt-projection.js";

const SUBJECT_ID = "subject-s0";
const BASE_LOGICAL_TIME = 10;
/** R1 holds every episode this suite ever offers (see the harness note). */
const REPOSITORY_REVISION = "R1";

const PROP_EXISTING = "prop.alice-keeps-plans";
const PROP_EXISTING_LABEL = "Alice keeps her plans.";
const PROP_OTHER = "prop.bob-helps";
const PROP_OTHER_LABEL = "Bob helps carry the boxes.";
const FORMED_LABEL = "Mira returns what she borrows.";
const SECOND_LABEL = "The library stays open on Sundays.";
const NEAR_DUPLICATE_LABEL = "Mira returns what she borrowed.";

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

function episode(ref: string, scene: string, occurrence: number): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: ref as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time: occurrence as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time: (occurrence + 1) as EpisodicMemoryRecordV0["recorded_at_logical_time"],
    provenance: {
      transition_id: identifier(`learning_${ref.replace(/[^a-z0-9]/gi, "_")}`) as never,
      producer: "memory",
      cause_refs: []
    },
    references: [] as unknown as EpisodicMemoryRecordV0["references"],
    context: { scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

interface BeliefItemFixture {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
}

function stateFixture(items: readonly BeliefItemFixture[], revision = 0): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: REPOSITORY_REVISION as never },
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: items.map((item) => ({
        proposition_id: identifier(item.proposition_id),
        proposition_label: item.proposition_label,
        credence: unit(item.credence)
      }))
    },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: BASE_LOGICAL_TIME,
      state_revision: revision,
      last_transition_time: null,
      last_transition_type: null,
      updated_at: BASE_LOGICAL_TIME
    },
    trace_window: {
      ...base.trace_window,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    }
  };
  return state as unknown as SubjectStateV0;
}

function existingDecision(
  propositionId: string,
  relation: "SUPPORTS" | "CONTRADICTS"
): (input: BeliefSemanticTargetResolutionProviderInputV0) => unknown {
  return (input) => ({
    schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
    kind: "EXISTING_PROPOSITION",
    proposition_id: identifier(propositionId),
    relation,
    semantic_context_fingerprint: input.semantic_context_fingerprint,
    candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
  });
}

function newCandidate(
  label: string,
  extra: Readonly<Record<string, unknown>> = {}
): (input: BeliefSemanticTargetResolutionProviderInputV0) => unknown {
  return (input) => ({
    schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
    kind: "NEW_PROPOSITION_CANDIDATE",
    proposed_label: label,
    semantic_context_fingerprint: input.semantic_context_fingerprint,
    candidate_catalog_fingerprint: input.candidate_catalog_fingerprint,
    ...extra
  });
}

function abstain(): (input: BeliefSemanticTargetResolutionProviderInputV0) => unknown {
  return (input) => ({
    schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
    kind: "NO_BEARING",
    semantic_context_fingerprint: input.semantic_context_fingerprint,
    candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
  });
}

/** Scripted label-only provider: one deterministic answer per claimed call. */
class ScriptedSemanticProvider implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;
  readonly inputs: BeliefSemanticTargetResolutionProviderInputV0[] = [];

  constructor(
    private readonly script: readonly ((input: BeliefSemanticTargetResolutionProviderInputV0) => unknown)[]
  ) {}

  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    const step = this.script[this.calls];
    this.calls += 1;
    this.inputs.push(input);
    if (step === undefined) throw new Error("scripted provider: no decision left for this call");
    return step(input);
  }
}

interface World {
  readonly initialState: SubjectStateV0;
  readonly deps: BeliefAdaptationWorkflowDepsV0;
  readonly store: InMemoryBeliefAdaptationWorkflowStoreV0;
  readonly provider: ScriptedSemanticProvider;
  readonly facade: InMemoryFacadeAssembly;
  readonly committedBundles: Map<string, AtomicCommitBundleAnyVersion>;
  readonly episodes: Readonly<Record<string, EpisodicMemoryRecordV0>>;
}

/**
 * Builds the REAL production stack: an in-memory Memory repository holding every
 * episode of the suite (one revision, so a multi-step scenario never needs a
 * memory-adoption transition), a SubjectCore facade, the PRODUCTION durable
 * workflow store, and a scripted provider.
 */
async function buildWorld(options: {
  readonly beliefs: readonly BeliefItemFixture[];
  readonly script: readonly ((input: BeliefSemanticTargetResolutionProviderInputV0) => unknown)[];
  readonly episodes: Readonly<Record<string, EpisodicMemoryRecordV0>>;
  readonly seedState?: SubjectStateV0;
  readonly seedStoreImage?: unknown;
  readonly nullBundleLookup?: boolean;
}): Promise<World> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] });
  const records = Object.values(options.episodes);
  const hashes: { ref: string; payload_hash: string }[] = [];
  for (const record of records) {
    hashes.push({
      ref: record.episode_ref,
      payload_hash: await repository.storePayload(record.episode_ref, record)
    });
  }
  await repository.prepareRevision({ parent_revision: "R0" as never, records: hashes as never });
  const state = options.seedState ?? stateFixture(options.beliefs);
  const facade = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, state]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async () => true,
    memoryAdoptionValidator: async () => false
  });
  const committedBundles = new Map<string, AtomicCommitBundleAnyVersion>();
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => facade.facade.reserveAndRoute(proposal),
    commitReserved: async (input) => {
      const bundle = await facade.facade.commitReserved(input);
      if (bundle.kind === "COMMITTED") {
        committedBundles.set(bundle.bundle.transition_id, bundle.bundle);
      }
      return bundle;
    },
    terminalizeReservedNoOp: (input) => facade.facade.terminalizeReservedNoOp(input),
    reconcile: (transitionId, subjectId, fingerprint) =>
      facade.facade.reconcile(transitionId, subjectId, fingerprint),
    readCurrentSnapshot: async (subjectId) => {
      const bundle = facade.storeRead.readCurrentBundle(subjectId);
      return bundle === null ? state : bundle.next_snapshot;
    }
  };
  const provider = new ScriptedSemanticProvider(options.script);
  const store = new InMemoryBeliefAdaptationWorkflowStoreV0();
  if (options.seedStoreImage !== undefined) {
    const restored = await store.restoreState(options.seedStoreImage);
    if (!restored.ok) throw new Error(`fixture store image invalid: ${restored.detail}`);
  }
  const deps: BeliefAdaptationWorkflowDepsV0 = {
    subjectCore: port,
    memoryRepository: repository,
    producerAuthorizationIssuer: facade.producerAuthorizationIssuer,
    semanticProvider: provider,
    workflowStore: store,
    readCommittedBundle:
      options.nullBundleLookup === true
        ? async () => null
        : async (transitionId) => committedBundles.get(transitionId) ?? null
  };
  return { initialState: state, deps, store, provider, facade, committedBundles, episodes: options.episodes };
}

function canonicalSnapshot(world: World): SubjectStateV0 {
  const bundle = world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never);
  if (bundle === null) throw new Error("expected a committed canonical bundle");
  return bundle.next_snapshot;
}

/** The canonical proposal carried by a commit bundle (V1 bundles never carry one). */
function canonicalProposalOf(
  bundle: AtomicCommitBundleAnyVersion | null | undefined
): { readonly cause_refs?: readonly string[]; readonly domain_deltas?: readonly unknown[] } | undefined {
  return (bundle as unknown as { canonical_proposal?: { readonly cause_refs?: readonly string[]; readonly domain_deltas?: readonly unknown[] } } | null | undefined)?.canonical_proposal;
}

function items(state: SubjectStateV0): readonly { proposition_id: string; proposition_label: string; credence: number }[] {
  return state.beliefs.items.map((item) => ({
    proposition_id: item.proposition_id as string,
    proposition_label: item.proposition_label,
    credence: item.credence as number
  }));
}

/** Mirrors the production session wiring: candidates = ALL canonical ids. */
function requestFor(
  world: World,
  workflowId: string,
  episodeRefs: readonly string[]
): Record<string, unknown> {
  const snapshot = world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never)?.next_snapshot;
  const current = snapshot ?? world.initialState;
  const candidateIds = current.beliefs.items
    .map((item) => item.proposition_id as string)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const selected = episodeRefs
    .map((ref) => world.episodes[ref])
    .filter((record): record is EpisodicMemoryRecordV0 => record !== undefined)
    .sort((a, b) => ((a.episode_ref as string) < (b.episode_ref as string) ? -1 : 1));
  return {
    schema_version: BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: workflowId,
    subject_id: SUBJECT_ID,
    expected_initial_state_revision: current.runtime_metadata.state_revision,
    expected_repository_revision: current.memory_state.repository_revision,
    proposition_candidate_ids: candidateIds,
    selected_episodes: selected
  };
}

async function runFormation(
  world: World,
  workflowId: string,
  episodeRefs: readonly string[]
): Promise<BeliefAdaptationTerminalV0> {
  return await runBeliefAdaptationWorkflowV0(world.deps, requestFor(world, workflowId, episodeRefs));
}

/**
 * Resume/replay of an EXISTING workflow identity: reconstructs the request from
 * the durable record's ORIGINAL binding (exactly as the session wiring's §32
 * resume does) — the workflow identity is bound to the original anchors, never
 * to the current ones.
 */
async function resumeWorkflow(
  world: World,
  workflowId: string,
  episodeRefs: readonly string[]
): Promise<BeliefAdaptationTerminalV0> {
  const record = await world.store.load(identifier(workflowId));
  if (record === null) throw new Error(`unreachable: no durable record ${workflowId}`);
  const episodes = episodeRefs
    .map((ref) => world.episodes[ref])
    .filter((entry): entry is EpisodicMemoryRecordV0 => entry !== undefined)
    .sort((a, b) => ((a.episode_ref as string) < (b.episode_ref as string) ? -1 : 1));
  return await runBeliefAdaptationWorkflowV0(world.deps, {
    schema_version: BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: workflowId,
    subject_id: SUBJECT_ID,
    expected_initial_state_revision: record.initial_state_revision,
    expected_repository_revision: record.repository_revision,
    proposition_candidate_ids: [...record.proposition_candidate_ids],
    selected_episodes: episodes
  });
}

/**
 * Runs a formation and CRASHES immediately after the durable proposal
 * checkpoint (before any canonical commit), leaving a non-terminal record with
 * a prepared proposal — the state a structural attacker would target.
 */
async function crashAfterProposalCheckpoint(
  world: World,
  workflowId: string,
  episodeRefs: readonly string[]
): Promise<void> {
  const store = world.store;
  const original = store.compareAndSetStage.bind(store);
  store.compareAndSetStage = async (id, fingerprint, from, to) => {
    if (to === "B5_PROPOSAL_PREPARED") {
      throw new Error("simulated crash after proposal checkpoint");
    }
    return await original(id, fingerprint, from, to);
  };
  try {
    await expect(runFormation(world, workflowId, episodeRefs)).rejects.toThrow(/simulated crash/);
  } finally {
    store.compareAndSetStage = original;
  }
  const record = await store.load(identifier(workflowId));
  expect(record?.proposal_checkpoint).not.toBeNull();
  expect(record?.terminal_result).toBeNull();
  // No canonical commit happened: the tamper target is a prepared proposal only.
  expect(world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never)).toBeNull();
}

interface TwoPropositionWorldOptions {
  readonly script: readonly ((input: BeliefSemanticTargetResolutionProviderInputV0) => unknown)[];
  readonly beliefs?: readonly BeliefItemFixture[];
}

async function twoPropositionWorld(options: TwoPropositionWorldOptions): Promise<World> {
  return await buildWorld({
    beliefs: options.beliefs ?? [],
    script: options.script,
    episodes: {
      "episode:ep-a": episode("episode:ep-a", "Mira returned the borrowed ladder and thanked me.", 7),
      "episode:ep-b": episode("episode:ep-b", "The library was open late on Sunday afternoon.", 9)
    }
  });
}

// ============================================================================
// Tests A / B / C — formation, abstention, distinct propositions
// ============================================================================

describe("BELIEF_PROPOSITION_ADMISSION_V0 — Tests A/B/C: formation, abstention, distinct propositions", () => {
  it("TEST A: an empty genesis catalog forms the first canonical belief from lived evidence", async () => {
    const world = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    const terminal = await runFormation(world, "wf-formation-a", ["episode:ep-a"]);
    expect(terminal).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    expect(world.provider.calls).toBe(1);

    const after = canonicalSnapshot(world);
    const formed = items(after);
    expect(formed).toHaveLength(1);
    const expectedKey = await deriveBeliefPropositionKeyV0(FORMED_LABEL);
    const expectedId = (await deriveBeliefPropositionId(SUBJECT_ID as never, expectedKey)) as string;
    expect(formed[0]).toEqual({
      proposition_id: expectedId,
      proposition_label: FORMED_LABEL,
      credence: BELIEF_PROPOSITION_FIRST_CREDENCE
    });
    // First credence is HOST-derived: stance-zero point + one frozen step.
    expect(BELIEF_PROPOSITION_STANCE_ZERO_CREDENCE + 0.05).toBe(BELIEF_PROPOSITION_FIRST_CREDENCE);

    // Provenance: the commit carries exactly the offered evidence as cause refs.
    const bundle = world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never);
    expect(bundle?.transition_type).toBe("Belief");
    const proposal = canonicalProposalOf(bundle);
    expect([...(proposal?.cause_refs ?? [])]).toEqual(["episode:ep-a"]);
    const delta = proposal?.domain_deltas?.[0] as
      | { domain?: string; provenance_refs?: readonly string[] }
      | undefined;
    expect(delta?.domain).toBe("belief");
    expect([...(delta?.provenance_refs ?? [])]).toEqual(["episode:ep-a"]);

    // The durable candidate is closed and label-only; the checkpoint is the
    // host proposal with an admission (not plasticity) authority fingerprint.
    const record = await world.store.load(identifier("wf-formation-a"));
    expect(record?.semantic_candidate).toEqual({
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      kind: "NEW_PROPOSITION_CANDIDATE",
      proposed_label: FORMED_LABEL,
      semantic_context_fingerprint: expect.any(String),
      candidate_catalog_fingerprint: expect.any(String)
    });
    expect(record?.plasticity_receipt).toBeNull();
    // The semantic candidate carries a LABEL only — no credence, no id, no key.
    expect(JSON.stringify(record?.semantic_candidate)).not.toContain("credence");
    expect(JSON.stringify(record?.semantic_candidate)).not.toContain("proposition_key");
    expect(JSON.stringify(record?.semantic_candidate)).not.toContain("proposition_id");
    expect(record?.proposal_checkpoint?.proposal.mutation).toEqual({
      kind: "INSERT",
      proposition_key: expectedKey,
      proposition_label: FORMED_LABEL,
      initial_credence: BELIEF_PROPOSITION_FIRST_CREDENCE
    });
    const expectedAuthorityFingerprint = await deriveBeliefPropositionAdmissionOutputFingerprintV0({
      proposition_key: expectedKey,
      canonical_label: FORMED_LABEL,
      initial_credence: BELIEF_PROPOSITION_FIRST_CREDENCE as UnitIntervalV0,
      member_refs: ["episode:ep-a"] as never
    });
    expect(record?.proposal_checkpoint?.plasticity_output_fingerprint).toBe(expectedAuthorityFingerprint);
  });

  it("TEST B: an empty catalog plus provider abstention writes nothing", async () => {
    const world = await twoPropositionWorld({ script: [abstain()] });
    const terminal = await runFormation(world, "wf-formation-b", ["episode:ep-a"]);
    expect(terminal).toMatchObject({ kind: "COMPLETE_NO_BEARING", canonical_commits: 0 });
    expect(world.committedBundles.size).toBe(0);
    expect(world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never)).toBeNull();
    const record = await world.store.load(identifier("wf-formation-b"));
    expect(record?.semantic_candidate?.kind).toBe("NO_BEARING");
    expect(record?.proposal_checkpoint).toBeNull();
  });

  it("TEST C: a second, DISTINCT proposition is lawfully formed (catalog P1 then P2)", async () => {
    const world = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL), newCandidate(SECOND_LABEL)]
    });
    const first = await runFormation(world, "wf-formation-c1", ["episode:ep-a"]);
    expect(first).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    const afterFirst = items(canonicalSnapshot(world));
    expect(afterFirst).toHaveLength(1);

    const second = await runFormation(world, "wf-formation-c2", ["episode:ep-b"]);
    expect(second).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    const afterSecond = items(canonicalSnapshot(world));
    expect(afterSecond).toHaveLength(2);
    // P1 unchanged; P2 lawfully inserted with the host first credence.
    const p1 = afterSecond.find((item) => item.proposition_label === FORMED_LABEL);
    const p2 = afterSecond.find((item) => item.proposition_label === SECOND_LABEL);
    expect(p1?.credence).toBe(BELIEF_PROPOSITION_FIRST_CREDENCE);
    expect(p2?.credence).toBe(BELIEF_PROPOSITION_FIRST_CREDENCE);
    expect(p2?.proposition_id).toBe(
      (await deriveBeliefPropositionId(
        SUBJECT_ID as never,
        await deriveBeliefPropositionKeyV0(SECOND_LABEL)
      )) as string
    );
    // Canonical storage order stays deterministic (raw-ASCII proposition id).
    expect(afterSecond.map((item) => item.proposition_id)).toEqual(
      [...afterSecond.map((item) => item.proposition_id)].sort()
    );
  });
});

// ============================================================================
// Tests D / E / J — duplicate routing, contradiction, near duplicates
// ============================================================================

describe("BELIEF_PROPOSITION_ADMISSION_V0 — Tests D/E/J: routing, contradiction, near duplicates", () => {
  it("TEST D: an exact duplicate proposal routes to the existing proposition's frozen +0.05", async () => {
    const world = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL), newCandidate(FORMED_LABEL)]
    });
    await runFormation(world, "wf-dup-1", ["episode:ep-a"]);
    const formed = items(canonicalSnapshot(world))[0];
    if (formed === undefined) throw new Error("unreachable: no formed proposition");

    const second = await runFormation(world, "wf-dup-2", ["episode:ep-b"]);
    expect(second).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    const after = items(canonicalSnapshot(world));
    // No new item, no new identity, no parallel proposition.
    expect(after).toHaveLength(1);
    expect(after[0]?.proposition_id).toBe(formed.proposition_id);
    expect(after[0]?.proposition_label).toBe(FORMED_LABEL);
    expect(after[0]?.credence).toBe(formed.credence + 0.05);
    expect(after[0]?.credence).toBe(0.6000000000000001); // exact IEEE-754, never rounded

    // The duplicate route used the ORDINARY frozen plasticity path: a durable
    // plasticity receipt exists and the proposal is an UPDATE.
    const record = await world.store.load(identifier("wf-dup-2"));
    expect(record?.plasticity_receipt).not.toBeNull();
    expect(record?.plasticity_receipt?.relation).toBe(BELIEF_NEW_CANDIDATE_ROUTED_EXISTING_RELATION_V0);
    expect(record?.plasticity_receipt?.proposition_id).toBe(formed.proposition_id);
    expect(record?.plasticity_receipt?.current_credence).toBe(formed.credence);
    expect(record?.proposal_checkpoint?.proposal.mutation).toEqual({
      kind: "UPDATE",
      proposition_id: formed.proposition_id,
      next_credence: formed.credence + 0.05
    });
    // The persisted candidate is still the NEW label (non-authoritative).
    expect(record?.semantic_candidate?.kind).toBe("NEW_PROPOSITION_CANDIDATE");
  });

  it("TEST E: contradictory evidence uses the frozen -0.05 law and creates no inverse proposition", async () => {
    const world = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL), existingDecision("", "CONTRADICTS")]
    });
    await runFormation(world, "wf-contra-1", ["episode:ep-a"]);
    const formed = items(canonicalSnapshot(world))[0];
    if (formed === undefined) throw new Error("unreachable: no formed proposition");
    // Re-script the second decision against the FORMED id.
    const second = await runSecondDecision(world, "wf-contra-2", formed.proposition_id, "CONTRADICTS", [
      "episode:ep-b"
    ]);
    expect(second).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    const after = items(canonicalSnapshot(world));
    expect(after).toHaveLength(1);
    expect(after[0]?.proposition_id).toBe(formed.proposition_id);
    expect(after[0]?.credence).toBe(0.55 - 0.05);
  });

  it("TEST J: textually different (near-duplicate) labels stay DISTINCT propositions", async () => {
    const world = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL), newCandidate(NEAR_DUPLICATE_LABEL)]
    });
    await runFormation(world, "wf-near-1", ["episode:ep-a"]);
    await runFormation(world, "wf-near-2", ["episode:ep-b"]);
    const after = items(canonicalSnapshot(world));
    expect(after).toHaveLength(2);
    expect(new Set(after.map((item) => item.proposition_id)).size).toBe(2);
    // No embedding/LLM/fuzzy merge: the two canonical labels differ exactly by text.
    expect(after.map((item) => item.proposition_label).sort()).toEqual(
      [FORMED_LABEL, NEAR_DUPLICATE_LABEL].sort()
    );
  });

  it("TEST I: canonical label normalization gives equivalent text ONE identity", async () => {
    // Pure law: NFC + whitespace collapse + trim, and nothing else.
    expect(deriveCanonicalBeliefPropositionLabelV0("  Mira   returns\twhat she borrows.  ")).toEqual({
      ok: true,
      value: FORMED_LABEL
    });
    expect(deriveCanonicalBeliefPropositionLabelV0("Jose\u0301 keeps his word.")).toEqual({
      ok: true,
      value: "José keeps his word."
    });
    const decomposed = deriveCanonicalBeliefPropositionLabelV0("Jose\u0301 keeps his word.");
    const composed = deriveCanonicalBeliefPropositionLabelV0("José keeps his word.");
    expect(decomposed).toEqual(composed);
    if (!decomposed.ok || !composed.ok) throw new Error("unreachable: labels rejected");
    expect(await deriveBeliefPropositionKeyV0(decomposed.value)).toBe(
      await deriveBeliefPropositionKeyV0(composed.value)
    );
    // A NON-canonical label can never mint an identity: the key deriver fails
    // closed instead of silently creating a second identity for the same text.
    await expect(deriveBeliefPropositionKeyV0("  Mira   returns what she borrows.  ")).rejects.toThrow(
      /NOT_CANONICAL/
    );
    // Deliberately NOT normalized: case, negation, word order.
    expect(deriveCanonicalBeliefPropositionLabelV0("mira returns what she borrows.")).toEqual({
      ok: true,
      value: "mira returns what she borrows."
    });
    const caseVariant = deriveCanonicalBeliefPropositionLabelV0("mira returns what she borrows.");
    if (!caseVariant.ok) throw new Error("unreachable: label rejected");
    expect(await deriveBeliefPropositionKeyV0(FORMED_LABEL)).not.toBe(
      await deriveBeliefPropositionKeyV0(caseVariant.value)
    );
    expect(deriveCanonicalBeliefPropositionLabelV0("   ")).toMatchObject({ ok: false });

    // End to end: a whitespace-variant proposal routes to the SAME identity.
    const world = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL), newCandidate(`  Mira   returns what she borrows.  `)]
    });
    await runFormation(world, "wf-norm-1", ["episode:ep-a"]);
    const formed = items(canonicalSnapshot(world))[0];
    await runFormation(world, "wf-norm-2", ["episode:ep-b"]);
    const after = items(canonicalSnapshot(world));
    expect(after).toHaveLength(1);
    expect(after[0]?.proposition_id).toBe(formed?.proposition_id);
    expect(after[0]?.proposition_label).toBe(FORMED_LABEL);
  });
});

// ============================================================================
// Tests F / G / H — provider and evidence attacks
// ============================================================================

describe("BELIEF_PROPOSITION_ADMISSION_V0 — Tests F/G/H: authority attacks fail closed", () => {
  it("TEST F: a provider that supplies proposition_key / proposition_id is rejected", async () => {
    const keyAttack = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL, { proposition_key: "belief-prop-v0-attacker" })]
    });
    const keyTerminal = await runFormation(keyAttack, "wf-attack-key", ["episode:ep-a"]);
    expect(keyTerminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_PROVIDER_OUTPUT" });
    expect(keyAttack.committedBundles.size).toBe(0);

    const idAttack = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL, { proposition_id: identifier(PROP_EXISTING) })]
    });
    const idTerminal = await runFormation(idAttack, "wf-attack-id", ["episode:ep-a"]);
    expect(idTerminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_PROVIDER_OUTPUT" });
    expect(idAttack.committedBundles.size).toBe(0);

    // An EXISTING decision naming an unregistered proposition stays INVENTED_PROPOSITION_ID.
    const invented = await twoPropositionWorld({ script: [existingDecision("prop.invented", "SUPPORTS")] });
    const inventedTerminal = await runFormation(invented, "wf-attack-invented", ["episode:ep-a"]);
    expect(inventedTerminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVENTED_PROPOSITION_ID" });
    expect(invented.committedBundles.size).toBe(0);
  });

  it("TEST G: provider numeric authority is impossible (credence / delta / confidence)", async () => {
    for (const numericKey of ["initial_credence", "next_credence", "delta", "confidence", "credence", "score"]) {
      const world = await twoPropositionWorld({
        script: [newCandidate(FORMED_LABEL, { [numericKey]: 0.99 })]
      });
      const terminal = await runFormation(world, `wf-attack-${numericKey}`, ["episode:ep-a"]);
      expect(terminal, numericKey).toMatchObject({
        kind: "REJECTED_SEMANTIC",
        code: "INVALID_PROVIDER_OUTPUT",
        canonical_commits: 0
      });
      expect(world.committedBundles.size, numericKey).toBe(0);
    }
    // The admission decision itself has NO numeric input: extra keys are inert.
    const state = stateFixture([]);
    const bare = await decideBeliefPropositionAdmissionV0({
      subjectState: state,
      proposed_label: FORMED_LABEL,
      evidence_member_refs: ["episode:ep-a"]
    });
    const noisy = await decideBeliefPropositionAdmissionV0({
      subjectState: state,
      proposed_label: FORMED_LABEL,
      evidence_member_refs: ["episode:ep-a"],
      initial_credence: 0.99,
      next_credence: 0.99,
      delta: 0.5
    } as never);
    expect(noisy).toEqual(bare);
    expect(bare.initial_credence).toBe(BELIEF_PROPOSITION_FIRST_CREDENCE);
  });

  it("TEST H: malformed, duplicated, unsorted and invisible evidence fails closed", async () => {
    const state = stateFixture([]);
    // Pure evidence law.
    expect(validateBeliefAdmissionEvidenceRefsV0([])).toMatchObject({ ok: false });
    expect(validateBeliefAdmissionEvidenceRefsV0(["episode:b", "episode:a"])).toMatchObject({ ok: false });
    expect(validateBeliefAdmissionEvidenceRefsV0(["episode:a", "episode:a"])).toMatchObject({ ok: false });
    expect(validateBeliefAdmissionEvidenceRefsV0(["not-an-episode"])).toMatchObject({ ok: false });
    expect(
      await decideBeliefPropositionAdmissionV0({
        subjectState: state,
        proposed_label: FORMED_LABEL,
        evidence_member_refs: ["episode:b", "episode:a"]
      })
    ).toMatchObject({ code: "REJECTED_INVALID_EVIDENCE", proposition_key: null });
    expect(
      await decideBeliefPropositionAdmissionV0({
        subjectState: state,
        proposed_label: FORMED_LABEL,
        evidence_member_refs: []
      })
    ).toMatchObject({ code: "REJECTED_INVALID_EVIDENCE" });

    // End to end: an episode that the bound repository revision never contained.
    const world = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    const ghost = episode("episode:ep-ghost", "An episode that was never committed.", 5);
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, {
      ...requestFor(world, "wf-attack-ghost", ["episode:ep-a"]),
      selected_episodes: [ghost]
    });
    expect(terminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_EVIDENCE" });
    expect(world.committedBundles.size).toBe(0);
    expect(world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never)).toBeNull();

    // The committed proposal can only ever carry the offered evidence set.
    const formed = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    await runFormation(formed, "wf-attack-offered", ["episode:ep-a", "episode:ep-b"]);
    const record = await formed.store.load(identifier("wf-attack-offered"));
    expect(record?.proposal_checkpoint?.proposal.evidence_binding.member_refs).toEqual([
      "episode:ep-a",
      "episode:ep-b"
    ]);
  });
});

// ============================================================================
// Test K — durable candidate tamper
// ============================================================================

describe("BELIEF_PROPOSITION_ADMISSION_V0 — Test K: durable candidate tamper fails closed", () => {
  /** Formation through a real store image, then structural tamper on the image. */
  async function tamperedFormation(
    mutate: (record: BeliefAdaptationWorkflowRecordV0) => BeliefAdaptationWorkflowRecordV0,
    options: {
      readonly recomputeRecordFingerprint?: boolean;
      readonly recomputeCandidateFingerprint?: boolean;
    } = {}
  ): Promise<{ terminal: BeliefAdaptationTerminalV0; world: World }> {
    const world = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    await crashAfterProposalCheckpoint(world, "wf-tamper", ["episode:ep-a"]);
    const record = await world.store.load(identifier("wf-tamper"));
    if (record === null) throw new Error("unreachable: no durable record");
    const image = world.store.exportState();
    const mutated = mutate(JSON.parse(JSON.stringify(record)) as BeliefAdaptationWorkflowRecordV0);
    const resealed =
      options.recomputeCandidateFingerprint === true && mutated.semantic_candidate !== null
        ? {
            ...mutated,
            semantic_candidate_fingerprint: await deriveBeliefAdaptationSemanticCandidateFingerprint(
              mutated.semantic_candidate
            )
          }
        : mutated;
    const sealed =
      options.recomputeRecordFingerprint === true
        ? {
            ...resealed,
            checkpoint_fingerprint:
              await deriveBeliefAdaptationWorkflowCheckpointFingerprint(resealed)
          }
        : resealed;
    // A FRESH world whose canonical state is still exactly at the workflow's
    // ORIGINAL binding (so resume MUST re-verify the whole durable chain).
    const tamperedWorld = await buildWorld({
      beliefs: [],
      script: [abstain()],
      episodes: {
        "episode:ep-a": episode("episode:ep-a", "Mira returned the borrowed ladder and thanked me.", 7)
      },
      seedStoreImage: {
        ...(image as object),
        records: [sealed]
      }
    });
    const terminal = await runBeliefAdaptationWorkflowV0(
      { ...tamperedWorld.deps, readCommittedBundle: async () => null },
      requestFor(tamperedWorld, "wf-tamper", ["episode:ep-a"])
    );
    return { terminal, world: tamperedWorld };
  }

  it("tampered proposed_label CANNOT authorize a different proposition, even with every visible fingerprint recomputed", async () => {
    const { terminal, world } = await tamperedFormation(
      (record) => {
        const candidate = record.semantic_candidate;
        if (candidate === null || candidate.kind !== "NEW_PROPOSITION_CANDIDATE") {
          throw new Error("unreachable: expected a NEW candidate");
        }
        // A fully capable structural attacker rewrites the label; the candidate
        // fingerprint is recomputed below (it is not a secret).
        return { ...record, semantic_candidate: { ...candidate, proposed_label: SECOND_LABEL } };
      },
      { recomputeRecordFingerprint: true, recomputeCandidateFingerprint: true }
    );
    // Even with every fingerprint recomputed, the replayed admission derives a
    // DIFFERENT proposal than the one checkpointed: the durable chain
    // re-derivation is the gate. Never a commit.
    expect(terminal).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT",
      canonical_commits: 0
    });
    expect(world.committedBundles.size).toBe(0);
  });

  it("tampered proposed_label with a stale candidate fingerprint fails closed", async () => {
    const { terminal } = await tamperedFormation(
      (record) => {
        const candidate = record.semantic_candidate;
        if (candidate === null || candidate.kind !== "NEW_PROPOSITION_CANDIDATE") {
          throw new Error("unreachable: expected a NEW candidate");
        }
        return { ...record, semantic_candidate: { ...candidate, proposed_label: SECOND_LABEL } };
      },
      { recomputeRecordFingerprint: true }
    );
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "SEMANTIC_CANDIDATE" });
  });

  it("a NEW candidate tampered into an EXISTING decision fails closed", async () => {
    const { terminal } = await tamperedFormation(
      (record) => {
        const candidate = record.semantic_candidate;
        if (candidate === null) throw new Error("unreachable: expected a candidate");
        return {
          ...record,
          semantic_candidate: {
            schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
            kind: "EXISTING_PROPOSITION",
            proposition_id: identifier(PROP_EXISTING),
            relation: "SUPPORTS",
            semantic_context_fingerprint: candidate.semantic_context_fingerprint,
            candidate_catalog_fingerprint: candidate.candidate_catalog_fingerprint
          }
        };
      },
      { recomputeRecordFingerprint: true }
    );
    // A NEW candidate relabelled as EXISTING has no numeric-authority receipt,
    // so the closed checkpoint/receipt coupling rejects the record first.
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_CHECKPOINT" });
  });

  it("tampered checkpointed evidence refs fail closed", async () => {
    const { terminal } = await tamperedFormation(
      (record) => {
        const checkpoint = record.proposal_checkpoint;
        if (checkpoint === null) throw new Error("unreachable: expected a checkpoint");
        const evidence = {
          ...checkpoint.proposal.evidence_binding,
          member_refs: ["episode:ep-b"] as never
        };
        return {
          ...record,
          proposal_checkpoint: {
            ...checkpoint,
            proposal: { ...checkpoint.proposal, evidence_binding: evidence }
          }
        };
      },
      { recomputeRecordFingerprint: true }
    );
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "PROPOSAL_CHECKPOINT" });
  });

  it("unknown keys / unknown candidate kinds in the durable record fail closed", async () => {
    const { terminal } = await tamperedFormation((record) => ({
      ...record,
      semantic_candidate:
        record.semantic_candidate === null
          ? null
          : ({ ...record.semantic_candidate, relation: "SUPPORTS" } as never)
    }));
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_CHECKPOINT" });
  });
});

// ============================================================================
// Tests L / M / Q — restart, replay, multiple propositions
// ============================================================================

describe("BELIEF_PROPOSITION_ADMISSION_V0 — Tests L/M/Q: restart, replay, restore", () => {
  it("TEST L: a formed belief survives a restart with a fresh store image and no journal", async () => {
    const world = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    const firstTerminal = await runFormation(world, "wf-restart", ["episode:ep-a"]);
    const committed = canonicalSnapshot(world);
    const durableImage = JSON.parse(JSON.stringify(world.store.exportState())) as unknown;

    // A FRESH process-equivalent world: the durable store image is the ONLY
    // surviving state; the canonical subject is seeded from the committed snapshot.
    const restarted = await buildWorld({
      beliefs: [],
      script: [abstain()],
      episodes: {
        "episode:ep-a": episode("episode:ep-a", "Mira returned the borrowed ladder and thanked me.", 7)
      },
      seedState: committed,
      seedStoreImage: durableImage,
      nullBundleLookup: true
    });
    const terminal = await resumeWorkflow(restarted, "wf-restart", ["episode:ep-a"]);
    // The write-once terminal replays BYTE-EQUIVALENTLY: no second revision, no
    // provider call, no second belief (the reported canonical_commits: 1 is the
    // ORIGINAL commit, replayed verbatim).
    expect(terminal).toEqual(firstTerminal);
    expect(restarted.provider.calls).toBe(0);
    expect(restarted.committedBundles.size).toBe(0);
    const afterRestart = items(
      restarted.facade.storeRead.readCurrentBundle(SUBJECT_ID as never)?.next_snapshot ?? committed
    );
    expect(afterRestart).toEqual(items(committed));
    expect(afterRestart).toHaveLength(1);
    expect(afterRestart[0]?.credence).toBe(BELIEF_PROPOSITION_FIRST_CREDENCE);
  });

  it("TEST M: replaying a committed formation never creates a second belief", async () => {
    const world = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    const first = await runFormation(world, "wf-replay", ["episode:ep-a"]);
    expect(first).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    const after = canonicalSnapshot(world);
    const revision = after.runtime_metadata.state_revision;

    const replay = await resumeWorkflow(world, "wf-replay", ["episode:ep-a"]);
    expect(replay).toEqual(first);
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(1);
    const replayedState = canonicalSnapshot(world);
    expect(replayedState.runtime_metadata.state_revision).toBe(revision);
    expect(items(replayedState)).toEqual(items(after));

    // The frozen identity law is unchanged: re-invoking the SAME workflow id
    // with the CURRENT (advanced) revision binding is an identity conflict, not
    // a second work item.
    const rebindAttempt = await runFormation(world, "wf-replay", ["episode:ep-a"]);
    expect(rebindAttempt).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_IDENTITY" });
    expect(world.committedBundles.size).toBe(1);

    // The single-shot formation API is equally idempotent: an already-durable
    // proposition reports ROUTED_EXISTING, never a second INSERT.
    const singleShot = await executeBeliefPropositionAdmissionV0(
      {
        subjectCore: world.deps.subjectCore,
        memoryRepository: world.deps.memoryRepository,
        issuer: world.deps.producerAuthorizationIssuer
      },
      {
        subject_id: identifier(SUBJECT_ID),
        current_logical_time: after.runtime_metadata.logical_time as never,
        state_revision: after.runtime_metadata.state_revision as never
      },
      {
        snapshot: replayedState,
        proposed_label: FORMED_LABEL,
        evidence_member_refs: ["episode:ep-a"]
      }
    );
    expect(singleShot).toMatchObject({ kind: "ROUTED_EXISTING" });
    expect(world.committedBundles.size).toBe(1);
  });

  it("TEST Q: two formed propositions restore deterministically (no loss, no duplicates)", async () => {
    const world = await twoPropositionWorld({
      script: [newCandidate(FORMED_LABEL), newCandidate(SECOND_LABEL)]
    });
    const firstTerminal = await runFormation(world, "wf-multi-1", ["episode:ep-a"]);
    const secondTerminal = await runFormation(world, "wf-multi-2", ["episode:ep-b"]);
    const committed = canonicalSnapshot(world);
    const before = items(committed);
    expect(before).toHaveLength(2);

    const restarted = await buildWorld({
      beliefs: [],
      script: [abstain(), abstain()],
      episodes: {
        "episode:ep-a": episode("episode:ep-a", "Mira returned the borrowed ladder and thanked me.", 7),
        "episode:ep-b": episode("episode:ep-b", "The library was open late on Sunday afternoon.", 9)
      },
      seedState: committed,
      seedStoreImage: JSON.parse(JSON.stringify(world.store.exportState())) as unknown,
      nullBundleLookup: true
    });
    for (const [workflowId, ref, expected] of [
      ["wf-multi-1", "episode:ep-a", firstTerminal],
      ["wf-multi-2", "episode:ep-b", secondTerminal]
    ] as const) {
      const terminal = await resumeWorkflow(restarted, workflowId, [ref]);
      expect(terminal).toEqual(expected);
    }
    expect(restarted.provider.calls).toBe(0);
    expect(restarted.committedBundles.size).toBe(0);
    const after = items(
      restarted.facade.storeRead.readCurrentBundle(SUBJECT_ID as never)?.next_snapshot ?? committed
    );
    expect(after).toEqual(before);
    expect(after.map((item) => item.proposition_id)).toEqual(
      [...after.map((item) => item.proposition_id)].sort()
    );
  });
});

// ============================================================================
// Tests N / R — regression and the non-empty NEW catalog
// ============================================================================

describe("BELIEF_PROPOSITION_ADMISSION_V0 — Tests N/R: regression and non-empty NEW", () => {
  it("TEST N: existing-proposition plasticity is unchanged (frozen ±0.05 both directions)", async () => {
    const world = await buildWorld({
      beliefs: [
        { proposition_id: PROP_EXISTING, proposition_label: PROP_EXISTING_LABEL, credence: 0.6 },
        { proposition_id: PROP_OTHER, proposition_label: PROP_OTHER_LABEL, credence: 0.4 }
      ],
      script: [existingDecision(PROP_EXISTING, "SUPPORTS")],
      episodes: { "episode:ep-a": episode("episode:ep-a", "Alice kept the plan again.", 7) }
    });
    const support = await runFormation(world, "wf-regression-up", ["episode:ep-a"]);
    expect(support).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    const afterSupport = items(canonicalSnapshot(world));
    expect(afterSupport.find((item) => item.proposition_id === PROP_EXISTING)?.credence).toBe(0.6 + 0.05);
    expect(afterSupport.find((item) => item.proposition_id === PROP_OTHER)?.credence).toBe(0.4);

    const down = await buildWorld({
      beliefs: [{ proposition_id: PROP_EXISTING, proposition_label: PROP_EXISTING_LABEL, credence: 0.6 }],
      script: [existingDecision(PROP_EXISTING, "CONTRADICTS")],
      episodes: { "episode:ep-a": episode("episode:ep-a", "Alice broke the plan.", 7) }
    });
    const contradiction = await runFormation(down, "wf-regression-down", ["episode:ep-a"]);
    expect(contradiction).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    expect(items(canonicalSnapshot(down))[0]?.credence).toBe(0.6 - 0.05);
  });

  it("TEST R: a NEW candidate under a NON-EMPTY catalog is admitted, never discarded", async () => {
    const world = await buildWorld({
      beliefs: [{ proposition_id: PROP_EXISTING, proposition_label: PROP_EXISTING_LABEL, credence: 0.6 }],
      script: [newCandidate(SECOND_LABEL)],
      episodes: { "episode:ep-b": episode("episode:ep-b", "The library was open late on Sunday.", 9) }
    });
    const terminal = await runFormation(world, "wf-nonempty-new", ["episode:ep-b"]);
    // The pre-admission law terminalized here with the label thrown away.
    expect(terminal.kind).not.toBe("COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED");
    expect(terminal).toMatchObject({ kind: "COMPLETE_COMMITTED", canonical_commits: 1 });
    const after = items(canonicalSnapshot(world));
    expect(after).toHaveLength(2);
    expect(after.find((item) => item.proposition_id === PROP_EXISTING)?.credence).toBe(0.6);
    expect(after.find((item) => item.proposition_label === SECOND_LABEL)?.credence).toBe(
      BELIEF_PROPOSITION_FIRST_CREDENCE
    );
  });

  it("TEST O: the deterministic cognition projection sees the formed belief (no LLM, no code change)", async () => {
    const world = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    await runFormation(world, "wf-projection", ["episode:ep-a"]);
    const after = canonicalSnapshot(world);
    const projection = await buildCognitiveContextProjection(after);
    expect(projection.belief_item_count).toBe(1);
    expect(projection.belief_items).toHaveLength(1);
    expect(projection.belief_items[0]?.proposition_label).toBe(FORMED_LABEL);
    expect(projection.belief_items[0]?.credence).toBe(BELIEF_PROPOSITION_FIRST_CREDENCE);
    const rendered = renderCognitiveSubjectData(projection);
    expect(rendered).toContain("showing 1 of 1 canonical belief item(s)");
    expect(rendered).toContain(FORMED_LABEL);
    expect(rendered).toContain('"credence":0.55');
  });
});

// ============================================================================
// Test P — no decision integration
// ============================================================================

describe("BELIEF_PROPOSITION_ADMISSION_V0 — Test P: no decision consumer was integrated", () => {
  it("the formation path introduces no decision / arbitration / tendency authority", async () => {
    // STATIC surface: the belief domain's exported API contains no decision,
    // tendency or arbitration symbol at all, and the admission module exports
    // exactly the formation laws. (The repository's no-restricted-imports
    // boundary lint is the enforced static gate that keeps the decision modules
    // out of this dependency direction.)

    for (const namespace of [beliefDomain, admissionModule]) {
      for (const exported of Object.keys(namespace)) {
        expect(exported, exported).not.toMatch(/decision|tendency|arbitration/i);
      }
    }
    expect(Object.keys(admissionModule).sort()).toEqual(
      [
        "BELIEF_NEW_CANDIDATE_ROUTED_EXISTING_RELATION_V0",
        "BELIEF_PROPOSITION_ADMISSION_OUTPUT_FINGERPRINT_PROJECTION",
        "BELIEF_PROPOSITION_ADMISSION_SCHEMA_VERSION",
        "BELIEF_PROPOSITION_ADMISSION_STEP_V0",
        "BELIEF_PROPOSITION_FIRST_CREDENCE",
        "BELIEF_PROPOSITION_KEY_PROJECTION",
        "BELIEF_PROPOSITION_STANCE_ZERO_CREDENCE",
        "NEAR_DUPLICATE_CANONICALIZATION_V0",
        "buildBeliefPropositionInsertProposalV0",
        "decideBeliefPropositionAdmissionV0",
        "deriveBeliefPropositionAdmissionOutputFingerprintV0",
        "deriveBeliefPropositionKeyV0",
        "deriveCanonicalBeliefPropositionLabelV0",
        "executeBeliefPropositionAdmissionV0",
        "validateBeliefAdmissionEvidenceRefsV0"
      ].sort()
    );

    // Runtime: a formation touches EXACTLY the belief domain delta.
    const world = await twoPropositionWorld({ script: [newCandidate(FORMED_LABEL)] });
    await runFormation(world, "wf-decision-free", ["episode:ep-a"]);
    const bundle = world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never);
    const proposal = canonicalProposalOf(bundle);
    expect(proposal?.domain_deltas).toHaveLength(1);
    const delta = proposal?.domain_deltas?.[0] as
      | { domain?: string; operations?: readonly { path?: string }[] }
      | undefined;
    expect(delta?.domain).toBe("belief");
    expect(delta?.operations?.map((operation) => operation.path)).toEqual(["/beliefs"]);
    const after = canonicalSnapshot(world);
    const before = stateFixture([]);
    expect(JSON.stringify(after.personality)).toBe(JSON.stringify(before.personality));
    expect(JSON.stringify(after.relationships)).toBe(JSON.stringify(before.relationships));
    expect(JSON.stringify(after.affect)).toBe(JSON.stringify(before.affect));
    expect(JSON.stringify(after.memory_state)).toBe(JSON.stringify(before.memory_state));
    // No new decision/tendency state appeared anywhere in the subject snapshot.
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
  });
});

/**
 * Re-runs ONE decision against an already-formed canonical proposition, using
 * the same durable world (used by TEST E, where the target id only exists after
 * the first formation).
 */
async function runSecondDecision(
  world: World,
  workflowId: string,
  propositionId: string,
  relation: "SUPPORTS" | "CONTRADICTS",
  episodeRefs: readonly string[]
): Promise<BeliefAdaptationTerminalV0> {
  const deps: BeliefAdaptationWorkflowDepsV0 = {
    ...world.deps,
    semanticProvider: new ScriptedSemanticProvider([existingDecision(propositionId, relation)])
  };
  return await runBeliefAdaptationWorkflowV0(deps, requestFor(world, workflowId, episodeRefs));
}
