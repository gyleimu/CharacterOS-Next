/**
 * LONG_HORIZON_MEMORY_RETRIEVAL_REMEDIATION_V0 — regression suite (0 model calls).
 *
 * Proves the deterministic lexical relevance signal makes the CURRENT USER UTTERANCE
 * influence memory selection while every frozen constraint holds: candidate membership
 * still comes only from canonical visible memory, temporal and subject scoping are
 * untouched, top-K is caller-controlled and stays 8 in the production query, the
 * fallback without a meaningful signal is byte-identical to the pre-remediation
 * ranking, and no Memory state mutates through retrieval.
 */

import { describe, expect, it } from "vitest";
import type { CanonicalRefV0 } from "@characteros-next/subject-core";

import { InMemoryMemoryRepository } from "../repository/in-memory-memory-repository.js";
import { createEpisodeContentReaderV0 } from "../records/episode-content-reader.js";
import { RepositoryBackedMemoryRetrievalServiceV0 } from "./repository-backed-retrieval-service.js";
import { hasMeaningfulLexicalSignalV0, normalizeLexicalTokensV0 } from "./lexical-relevance.js";

const SUBJECT = "subject-s0";
const ENTITY = "entity:n1";
/** A second, ALWAYS-present generic entity ref — the historical pinning cause: the
 * genesis-era episode carries it too, giving it one extra query overlap. */
const OWNER = "entity:owner";
const NOW = 90;

/** A valid EpisodicMemoryRecordV0 with the given scene and linked experience refs. */
function episodeRecord(ref: string, occurrence: number, scene: string, experienceRefs: readonly string[] = [], extraRefs: readonly string[] = []) {
  const references = [
    ...experienceRefs,
    ...extraRefs,
    ENTITY,
    `event:${ref.slice("episode:".length)}`,
    `observation:o-${ref.slice("episode:".length)}`
  ].sort();
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: ref,
    occurrence_logical_time: occurrence,
    recorded_at_logical_time: occurrence,
    provenance: { transition_id: `t-${ref.slice(8, 16)}`, producer: "memory", cause_refs: [...references].sort() },
    references,
    context: { scene, focus_refs: [ENTITY], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5, source: "ENCODING_DECLARED_V0" }
  };
}

/** A BEHAVIOR_OUTCOME-shaped experience payload (facts only). */
function experienceRecord(ref: string, behaviorText: string, outcomeText: string) {
  return {
    schema_version: "experience-record-v0",
    experience_kind: "BEHAVIOR_OUTCOME",
    experience_ref: ref,
    behavior_artifact: { schema_version: "character-language-behavior-v0", text: behaviorText },
    outcome: { outcome_kind: "CONVERSATION_REPLY", text: outcomeText }
  };
}

interface StoreRefs {
  readonly e0: string;
  readonly e1: string;
  readonly e2: string;
  readonly e3: string;
  readonly e4: string;
  readonly e5: string;
  readonly f1: string;
  readonly f2: string;
  readonly f3: string;
  readonly f4: string;
  readonly f5: string;
  readonly f6: string;
}

interface Store {
  readonly repo: InMemoryMemoryRepository;
  readonly service: RepositoryBackedMemoryRetrievalServiceV0;
  readonly refs: StoreRefs;
  readonly head: string;
}

/**
 * Builds the fixture life (times chosen so recency-only ranking picks the fillers):
 *   E0 genesis-era generic episode WITH the extra generic entity ref (the pin);
 *   E1 OLD strongly-topical episode (shelf fits — via experience outcome text, time 10);
 *   E2 recent unrelated episode (screws/jars, time 80);
 *   E3 recent topical episode (shelf project turned out well, time 85);
 *   E4 future episode (perfect shelf match, occurrence 200 > NOW — never eligible);
 *   E5 recent weakly-related episode (mentions "shelf" once, time 82);
 *   F1..F6 fillers (times 25..45, distinct mundane content — no probe vocabulary).
 */
async function buildStore(): Promise<Store> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] });

  const refsMutable = {} as { -readonly [K in keyof StoreRefs]: string };
  const refs: StoreRefs = refsMutable;
  async function commit(parent: string, entries: { ref: string; payload: unknown }[]): Promise<string> {
    const records = [];
    for (const entry of entries) {
      const hash = await repo.storePayload(entry.ref as CanonicalRefV0, entry.payload);
      records.push({ ref: entry.ref, payload_hash: hash });
    }
    records.sort((left, right) => (left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0));
    const prepared = await repo.prepareRevision({ parent_revision: parent as never, records: records as never });
    return prepared.repository_revision;
  }

  const e0 = "episode:e0-generic";
  refsMutable.e0 = e0;
  await commit("R0", [
    { ref: e0, payload: episodeRecord(e0, 1, "The user says: Morning.", [], [OWNER]) }
  ]);

  const expOld = "experience:exp-old";
  const e1 = "episode:e1-old-shelf";
  refsMutable.e1 = e1;
  await commit("R1", [
    {
      ref: expOld,
      payload: experienceRecord(expOld, "A good day in the workshop.", "I finished the shelf today and it fits perfectly - that felt good.")
    },
    { ref: e1, payload: episodeRecord(e1, 10, "conversation-feedback-v0", [expOld]) }
  ]);

  const expMundane = "experience:exp-mundane";
  const e2 = "episode:e2-recent-mundane";
  const expShelf = "experience:exp-shelf";
  const e3 = "episode:e3-recent-shelf";
  const e5 = "episode:e5-recent-weak";
  refsMutable.e2 = e2;
  refsMutable.e3 = e3;
  refsMutable.e5 = e5;
  await commit("R2", [
    {
      ref: expMundane,
      payload: experienceRecord(expMundane, "Quiet evening.", "I sorted screws into jars by length and made tea.")
    },
    { ref: e2, payload: episodeRecord(e2, 80, "conversation-feedback-v0", [expMundane]) },
    {
      ref: expShelf,
      payload: experienceRecord(expShelf, "Glad it worked out.", "The shelf project turned out well; the shelf fits nicely now.")
    },
    { ref: e3, payload: episodeRecord(e3, 85, "conversation-feedback-v0", [expShelf]) },
    { ref: e5, payload: episodeRecord(e5, 82, "A shelf was mentioned in passing.", []) }
  ]);

  const e4 = "episode:e4-future-shelf";
  refsMutable.e4 = e4;
  await commit("R3", [
    { ref: e4, payload: episodeRecord(e4, 200, "The shelf fits perfectly and I built it today.", []) }
  ]);

  const fillerTimes = [25, 30, 35, 40, 45, 50];
  const fillerEntries = fillerTimes.map((time, index) => {
    const ref = `episode:f${String(index + 1)}-filler`;
    return {
      ref,
      payload: episodeRecord(ref, time, `Filler episode number ${String(index + 1)}: the quiet routine went on, and nothing notable happened in the workshop at all.`)
    };
  });
  const head = await commit("R3", fillerEntries);
  refsMutable.f1 = "episode:f1-filler";
  refsMutable.f2 = "episode:f2-filler";
  refsMutable.f3 = "episode:f3-filler";
  refsMutable.f4 = "episode:f4-filler";
  refsMutable.f5 = "episode:f5-filler";
  refsMutable.f6 = "episode:f6-filler";

  return { repo, service: new RepositoryBackedMemoryRetrievalServiceV0(repo), refs, head };
}

function queryFor(store: Store, options: { text?: string | null; max?: number; now?: number; revision?: string }): Record<string, unknown> {
  return {
    schema_version: "memory-retrieval-query-v0",
    subject_id: SUBJECT,
    repository_revision: (options.revision ?? store.head) as never,
    semantic_reference: null,
    temporal: { now_logical_time: options.now ?? NOW, window_start: null },
    entity_refs: [ENTITY, OWNER],
    relationship_refs: [],
    current_context_refs: [],
    salience_constraints: { min_declared_score: null, max_candidates: options.max ?? 8 },
    ...(options.text === undefined ? {} : { lexical_query_text: options.text })
  };
}

describe("R1/R3/R4: the utterance drives selection; old and recent topical episodes are both reachable", () => {
  it("a topical query selects the OLD topical episode (time 10) that recency-only ranking never surfaced", async () => {
    const store = await buildStore();
    const before = await store.service.retrieve(queryFor(store, { max: 8 }));
    const after = await store.service.retrieve(queryFor(store, { text: "Do you remember the shelf that fits?", max: 8 }));
    expect(before.selected_memory_refs).not.toContain(store.refs.e1);
    expect(after.selected_memory_refs).toContain(store.refs.e1);
    expect(after.selected_memory_refs).toContain(store.refs.e3);
  });

  it("recent relevant memory stays selected (no trade of recent quality for old recall)", async () => {
    const store = await buildStore();
    const after = await store.service.retrieve(queryFor(store, { text: "How did the shelf project turn out?", max: 8 }));
    expect(after.selected_memory_refs).toContain(store.refs.e3);
  });
});

describe("R2: two different queries over the same state produce different selections", () => {
  it("shelf query vs screws query rank differently", async () => {
    const store = await buildStore();
    const shelf = await store.service.retrieve(queryFor(store, { text: "How did the shelf project turn out?", max: 2 }));
    const screws = await store.service.retrieve(queryFor(store, { text: "Where are the sorted screws and jars?", max: 2 }));
    expect(shelf.selected_memory_refs).toContain(store.refs.e3);
    expect(screws.selected_memory_refs).toContain(store.refs.e2);
    expect(shelf.selected_memory_refs).not.toEqual(screws.selected_memory_refs);
  });
});

describe("R5: old strongly relevant outranks recent weakly relevant", () => {
  it("with one slot left, the strong old episode wins over any weak mention", async () => {
    const store = await buildStore();
    const result = await store.service.retrieve(queryFor(store, { text: "I finished the shelf today and it fits perfectly", max: 1 }));
    expect(result.selected_memory_refs).toEqual([store.refs.e1]);
  });
});

describe("R6/R15: no meaningful signal falls back to the unchanged structural ranking", () => {
  it("absent text and an unrelated text reproduce the pre-remediation selection", async () => {
    const store = await buildStore();
    const absent = await store.service.retrieve(queryFor(store, { max: 8 }));
    const unrelated = await store.service.retrieve(queryFor(store, { text: "Do you enjoy opera?", max: 8 }));
    expect(unrelated.selected_memory_refs).toEqual(absent.selected_memory_refs);
    // The fallback keeps the recency-first structural order (the pre-remediation law):
    // no unrelated ancient episode is promoted by the change.
    expect(absent.selected_memory_refs).not.toContain(store.refs.e1);
  });

  it("hasMeaningfulLexicalSignalV0 draws the line explicitly", () => {
    expect(hasMeaningfulLexicalSignalV0(null)).toBe(false);
    expect(hasMeaningfulLexicalSignalV0("")).toBe(false);
    expect(hasMeaningfulLexicalSignalV0("hi")).toBe(false);
    expect(hasMeaningfulLexicalSignalV0("Where was the whetstone moved?")).toBe(true);
  });
});

describe("R7: a future episode is excluded even with a perfect lexical match", () => {
  it("temporal scoping wins over relevance", async () => {
    const store = await buildStore();
    const result = await store.service.retrieve(queryFor(store, { text: "The shelf fits perfectly and I built it today.", max: 50 }));
    expect(result.selected_memory_refs).not.toContain(store.refs.e4);
  });
});

describe("R8: no cross-subject retrieval", () => {
  it("each subject's repository answers only with its own episodes", async () => {
    const store = await buildStore();
    const bobsRepo = new InMemoryMemoryRepository();
    await bobsRepo.prepareRevision({ parent_revision: null, records: [] });
    const bobsEpisode = "episode:bob-shelf";
    const hash = await bobsRepo.storePayload(bobsEpisode as CanonicalRefV0, episodeRecord(bobsEpisode, 50, "The shelf fits perfectly."));
    await bobsRepo.prepareRevision({ parent_revision: "R0" as never, records: [{ ref: bobsEpisode, payload_hash: hash }] as never });
    const bobsService = new RepositoryBackedMemoryRetrievalServiceV0(bobsRepo);

    // Bob's repository answers with Bob's episode (same query shape, Bob's revision).
    const forBob = await bobsService.retrieve(queryFor(store, { text: "The shelf fits perfectly.", max: 8, revision: "R1" }));
    expect(forBob.selected_memory_refs).toContain(bobsEpisode);

    // Alice's repository can never return Bob's episode, even with a perfect match.
    const forAlice = await store.service.retrieve(queryFor(store, { text: "The shelf fits perfectly.", max: 50 }));
    expect(forAlice.selected_memory_refs).not.toContain(bobsEpisode);
  });
});

describe("R9: the generic-overload episode is no longer permanently pinned", () => {
  it("a topical query leaves the generic episode out; the fallback keeps the historical law", async () => {
    const store = await buildStore();
    // Tier members (e1, e3, e5) fill the slots ahead of the double-overlap generic episode.
    const topical = await store.service.retrieve(queryFor(store, { text: "How did the shelf project turn out?", max: 3 }));
    expect(topical.selected_memory_refs).not.toContain(store.refs.e0);
    // Without a signal the fallback preserves the historical structural law, where the
    // generic episode's extra overlap keeps it selected — that IS the fallback law.
    const fallback = await store.service.retrieve(queryFor(store, { max: 3 }));
    expect(fallback.selected_memory_refs).toContain(store.refs.e0);
  });
});

describe("R10: top-K stays caller-controlled (the production query keeps 8)", () => {
  it("max_candidates is honored exactly", async () => {
    const store = await buildStore();
    const result = await store.service.retrieve(queryFor(store, { text: "the shelf", max: 2 }));
    expect(result.selected_memory_refs).toHaveLength(2);
  });

});

describe("R11: the existing factual carrier receives the newly selected old episode", () => {
  it("the episode content reader resolves the selected old episode (same carrier cognition trusts)", async () => {
    const store = await buildStore();
    const result = await store.service.retrieve(queryFor(store, { text: "Do you remember the shelf that fits?", max: 8 }));
    expect(result.selected_memory_refs).toContain(store.refs.e1);
    const reader = createEpisodeContentReaderV0(store.repo);
    const content = await reader.read({
      repository_revision: store.head as never,
      refs: result.selected_memory_refs as unknown as CanonicalRefV0[]
    });
    expect(content.ok).toBe(true);
    if (content.ok) {
      const old = content.contents.find((entry) => entry.ref === store.refs.e1);
      expect(old?.scene).toBe("conversation-feedback-v0");
    }
  });
});

describe("R12: retrieval mutates nothing", () => {
  it("payload hashes, visibility and membership are identical after many retrievals", async () => {
    const store = await buildStore();
    const refs = Object.values(store.refs);
    const hashesBefore = new Map<string, string | null>(
      refs.map((ref) => [ref, null as string | null])
    );
    for (const ref of refs) hashesBefore.set(ref, await store.repo.payloadHashOf(ref as CanonicalRefV0));
    const revisionsBefore = store.repo.revisionIds();
    for (const text of ["the shelf that fits", "sorted screws and jars", "the shelf", "Do you enjoy opera?"]) {
      await store.service.retrieve(queryFor(store, { text, max: 8 }));
    }
    for (const ref of refs) {
      expect(await store.repo.payloadHashOf(ref as CanonicalRefV0)).toBe(hashesBefore.get(ref));
    }
    expect(store.repo.revisionIds()).toEqual(revisionsBefore);
    // The future episode is intentionally outside the head revision's ancestry (its
    // parent is R3): the production membership authority must keep refusing it.
    const visibleRefs = refs.filter((ref) => ref !== store.refs.e4);
    await expect(
      store.repo.validateRefsBelong(store.head as never, visibleRefs as unknown as CanonicalRefV0[])
    ).resolves.toBe(true);
    await expect(
      store.repo.validateRefsBelong(store.head as never, [store.refs.e4 as CanonicalRefV0])
    ).resolves.toBe(false);
  });
});

describe("R14: paraphrases work without any domain-specific mapping", () => {
  it("different surface wording of the same intent reaches the same topical episodes", async () => {
    const store = await buildStore();
    const direct = await store.service.retrieve(queryFor(store, { text: "The shelf fits perfectly.", max: 4 }));
    const paraphrase = await store.service.retrieve(queryFor(store, { text: "How did the shelf project turn out?", max: 4 }));
    expect(direct.selected_memory_refs).toContain(store.refs.e1);
    expect(paraphrase.selected_memory_refs).toContain(store.refs.e1);
    expect(paraphrase.selected_memory_refs).toContain(store.refs.e3);
  });
});

describe("query contract: the optional lexical text validates narrowly", () => {
  it("rejects non-strings and unbounded strings; accepts strings and null", async () => {
    const store = await buildStore();
    await expect(store.service.retrieve(queryFor(store, { max: 8, text: 42 as unknown as string }))).rejects.toThrow(
      /lexical_query_text/
    );
    await expect(store.service.retrieve(queryFor(store, { max: 8, text: "x".repeat(4097) }))).rejects.toThrow(
      /lexical_query_text/
    );
    await expect(store.service.retrieve(queryFor(store, { max: 8, text: null }))).resolves.toBeDefined();
  });

  it("the tokenizer folds plurals deterministically", () => {
    expect(normalizeLexicalTokensV0("The DRAWERS and boxes were labelled; cities, parties!")).toEqual([
      "the",
      "drawer",
      "and",
      "box",
      "were",
      "labelled",
      "city",
      "party"
    ]);
  });
});
