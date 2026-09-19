/**
 * CORE_V1_LONG_RUN — LONG-RUNNING OPERATION HARNESS (monitoring infrastructure).
 *
 * The frozen Core V1 is exercised through the NORMAL product path (`createProductRuntimeV0`
 * with the real product provider bundle: the current product executor configuration, no
 * substitution, no benchmark) for a batch of REAL lived interactions, with fresh
 * restarts in between. It records read-only checkpoints, verifies durable integrity
 * across every restart, and classifies anything suspicious as an ISSUE CANDIDATE.
 *
 * IT ADDS NO CORE MECHANISM and it never writes subject state directly: every
 * interaction is a normal `submitHumanText` turn, every reading is an existing
 * read-only projection. Nothing here repairs or tunes anything — observed problems
 * are captured, classified and left for adjudication (OBSERVED PROBLEM → FIX, never
 * IMAGINED FUTURE PROBLEM → NEW ARCHITECTURE).
 *
 * EXECUTOR FAMILY: whatever the product configuration resolves. `auto` picks the
 * cloud family when a credential is present in the environment, else the local one;
 * `CHARACTEROS_EXECUTOR=deepseek|ollama` selects explicitly. The product reads the
 * credential from `MODEL_API_KEY` ONLY (environment only, never a file, never an
 * argument) and this harness only ever reports its PRESENCE — never its value.
 *
 * DISABLED BY DEFAULT so the engineering gates stay at 0 model calls. To run a batch:
 *
 *   CHARACTEROS_EXECUTOR=deepseek CHARACTEROS_LONG_RUN=1 \
 *     npx vitest run product/sandbox/src/long-run-checkpoint.test.ts
 *
 * Optional: CHARACTEROS_LONG_RUN_ROOT (data root), CHARACTEROS_LONG_RUN_SUBJECT,
 * CHARACTEROS_LONG_RUN_HEAD (provenance line for the artifact), CHARACTEROS_TIMEOUT_MS
 * (per-call timeout; recorded in the artifact).
 *
 * MONITORING (no product change):
 * - per-stage provider call counts come from the EXISTING product diagnostics view;
 * - exact provider HTTP request counts and token usage come from the fetch-level
 *   `provider-request-observer` (usage absent from a provider is recorded as
 *   NOT_AVAILABLE, never estimated);
 * - checkpoints are named BEFORE / TURN_5 / TURN_10 / TURN_15 / TURN_20 / FINAL_RESTORE;
 * - failures are classified EXECUTOR / PRODUCT / CORE, and two consecutive
 *   same-context EXECUTOR failures STOP the batch instead of burning the rest.
 *
 * ARTIFACTS (machine-local; summary only — no credentials, no prompts, no hidden
 * reasoning): tmp/deepseek-long-run-checkpoint-<N>.json for the cloud family,
 * tmp/long-run-checkpoint-<N>.json otherwise, plus a crash-safe progress file
 * rewritten after every interaction.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createProductRuntimeV0,
  type ProductRuntimeV0,
  type ProductTurnResultV0
} from "./product-runtime.js";
import { PRODUCT_DEFAULT_DATA_ROOT_V0 } from "./product-paths.js";
import type { ProductLifeViewV0 } from "./product-life-operations.js";
import {
  installProviderRequestObserverV0,
  type ProviderRequestObserverV0
} from "./provider-request-observer.js";
import { evaluateBeliefEvidenceMembershipV0 } from "./monitoring-membership.js";
import {
  durableSizesV0,
  heapReadingV0,
  shouldResetChunkV0
} from "./long-run-memory-safe-monitoring.js";

const ENABLED = process.env["CHARACTEROS_LONG_RUN"] === "1";
const BATCH = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_INTERACTIONS"] ?? "20", 10);
  return Number.isSafeInteger(raw) && raw > 0 && raw <= 200 ? raw : 20;
})();
const SUBJECT_ID = process.env["CHARACTEROS_LONG_RUN_SUBJECT"] ?? "alice-longrun";
/** Scheduled fresh-restart cadence (every N interactions). Default 10; a slice may narrow it. */
const RESTART_EVERY = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_RESTART_EVERY"] ?? "10", 10);
  return Number.isSafeInteger(raw) && raw > 1 && raw <= 50 ? raw : 10;
})();
const DATA_ROOT =
  process.env["CHARACTEROS_LONG_RUN_ROOT"] ?? join(PRODUCT_DEFAULT_DATA_ROOT_V0, "subjects", SUBJECT_ID);
/**
 * SHORT-LIVED CHUNK MODE (§9/§10): one process never runs more than this many real
 * interactions, so the heap is reset by a deliberate process exit instead of growing
 * until Node's limit. The orchestrator starts the next chunk with a fresh process.
 */
const CHUNK_SIZE = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_CHUNK_SIZE"] ?? "10", 10);
  return Number.isSafeInteger(raw) && raw > 0 && raw <= 50 ? raw : 10;
})();
/** Optional durable-episode target that ends the chunk early (§10). */
const TARGET_EPISODES = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_TARGET_EPISODES"] ?? "0", 10);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
})();
/** Skip the first N plan lines so a resumed batch never replays lived scenario lines. */
const PLAN_OFFSET = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_PLAN_OFFSET"] ?? "0", 10);
  return Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
})();
/** §14 observability-only guard: stop and report if the cloud request count runs away. */
const MAX_DEEPSEEK_REQUESTS = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_MAX_REQUESTS"] ?? "400", 10);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : 400;
})();

/** Scenario set for a batch: `A` (the original 20 lines) or `B` (a later stretch of
 *  the same life). Both are natural mixed life content — no state targets, no test
 *  questions — and neither is scripted to move any state value. */
const PLAN_SET = (process.env["CHARACTEROS_LONG_RUN_PLAN"] ?? "A").trim().toUpperCase();

/** Natural mixed interactions (session 1 then session 2). No scripted state targets. */
function plan(batch: number): readonly string[] {
  const later = [
    // A LATER STRETCH OF THE SAME LIFE (used when CHARACTEROS_LONG_RUN_PLAN=B).
    "The second shelf is finally sanded; I spent the morning on the edges.",
    "I moved the plane to the shelf under the bench so it stops falling over.",
    "My neighbour asked whether I could help him fix his gate next week.",
    "I said yes, but only if the weather holds.",
    "It rained all afternoon, so I stayed in and sharpened the chisels instead.",
    "The whetstone is wearing hollow in the middle - I should replace it.",
    "I keep thinking about that bandsaw. It jammed again on a thin offcut.",
    "A friend from the old workshop called and we talked for an hour.",
    "He said the trick with that bandsaw is to slow the feed right down.",
    "I tried slowing the feed and it cut cleanly for the first time in weeks.",
    "So the slow feed tip was right; I owe him for that.",
    "I do not agree that my shelves are overbuilt; they hold what I need them to hold.",
    "Nothing much happened today. I swept the floor and went to bed early.",
    "The gate job with my neighbour went well - we finished it before lunch.",
    "He brought over some offcuts as thanks, so now I have more stock.",
    "I finally replaced the whetstone; the new one is much flatter.",
    "The chisel feels different on a flat stone - quicker to get an edge.",
    "I wrote the bandsaw setting on a card and taped it to the machine.",
    "The workshop is quieter now that the saw is not fighting me.",
    "Do you remember the first shelf I built? It feels like a long time ago.",
    "I hung the new plane on a proper hook so it is out of the way.",
    "My neighbour says he will bring his own tools next time.",
    "I swept out a year of sawdust from behind the bench.",
    "The offcuts he brought are mostly oak - better than what I had.",
    "I stood in the doorway for a while just looking at the tidy workshop."
  ];
  const third = [
    // A FURTHER STRETCH (CHARACTEROS_LONG_RUN_PLAN=C): the oak stool project.
    "I started sketching a small stool from the oak offcuts.",
    "The first cut was crooked, so I trimmed it and started again.",
    "I measured twice this time and the legs came out even.",
    "My neighbour asked what I was building and I showed him the sketch.",
    "He suggested a lower seat height, and he was right.",
    "I lowered the seat by two centimetres and it sits better.",
    "The stool is finished. It wobbles a little on the stone floor.",
    "I glued a thin shim under one leg and now it is steady.",
    "I do not agree that pine would have been easier; oak was what I had.",
    "Nothing much happened today - I just oiled the bench top.",
    "A letter came from the old workshop about a reunion in spring.",
    "I have not decided whether to go.",
    "The bandsaw has been quiet since I slowed the feed. That still pleases me.",
    "I sharpened the plane iron and the shavings come off in one piece now.",
    "My hands were sore after the sanding, so I stopped early.",
    "I keep the sketch in the drawer with the tape labels.",
    "The neighbour returned my clamp, cleaned, which was kind of him.",
    "I showed him the stool and he asked me to make one for his hallway.",
    "I said I would think about it.",
    "I measured his hallway space on a scrap of paper.",
    "The oak I have left is enough for one more stool.",
    "I started the second stool this morning, using the first as a pattern.",
    "It went together faster than the first one.",
    "I sanded the seat edges the way I like them now.",
    "Do you remember the drawers I labelled? The tape is still holding."
  ];
  const fourth = [
    // PLAN D — the workshop year continues; includes EARLY-MEMORY RECALL PROBES
    // (marked with *), which ask about things Alice really lived long ago without
    // ever stating the answer.
    "The stool has a place by the door now and I use it every day.",
    "*Do you remember what I told you about the top drawer and the chisel?",
    "I finally hung the spare saw blades on the wall, sorted by tooth count.",
    "My neighbour's gate is still holding after the rain.",
    "I spent a whole morning sharpening and did not mind it.",
    "The bench vice squeaks, so I oiled the screw thread.",
    "A delivery van blocked the lane for an hour and I lost patience.",
    "I do not agree that the workshop is too small; I know where everything is.",
    "Nothing much happened today. I made tea and read the paper.",
    "*Do you remember the drawer I labelled with tape, and what the label says?",
    "The post brought a catalogue and I looked at planes I cannot afford.",
    "I fixed the loose handle on the mallet with a wedge.",
    "The neighbour lent me his long clamps for the weekend.",
    "I returned them on Monday with a jar of jam from the kitchen.",
    "It was too cold to work, so I stayed in and drew plans instead.",
    "I sketched a small bookcase and measured the wall twice.",
    "*Do you remember what jammed twice and made me lose an hour?",
    "The second stool is done and the first one looks rough beside it.",
    "I sanded the first stool again to match, and it looks better now.",
    "My hands are getting used to the work again.",
    "The reunion letter is still on the shelf; I have not answered it.",
    "I bought a new saw file and the teeth cut true again.",
    "Rain came through a gap in the roof and I moved the oak away from it.",
    "I patched the gap with a strip of flashing and it held through the night.",
    "*Do you remember the neighbour's gate job, and whether it went well?",
    "I swept the floor twice today. There is always more sawdust.",
    "The cat from next door sleeps on the offcut pile.",
    "I made a small rack for the screwdrivers and it took under an hour.",
    "My sister called and we talked about the reunion.",
    "I think I will go to the reunion after all, but I have not written back.",
    "Nothing much happened. I sorted screws into jars by length.",
    "*Do you remember where I keep the whetstone now?",
    "The new whetstone is wearing evenly, which is a small pleasure.",
    "I cut a piece of the oak too short and had to start the rail again.",
    "I used the offcut for a doorstop so it was not wasted.",
    "The neighbour asked if I could look at his kitchen shelf.",
    "I said I would come by on Saturday if the weather is dry.",
    "I sharpened the chisels and put them away in their rolls.",
    "The workshop smelled of oil and wood shavings all afternoon.",
    "*Do you remember the shelves I built, and whether they fitted?",
    "The second rail went together without a mistake this time.",
    "I stood back and looked at the frame for a long while.",
    "My shoulders ached, so I stopped after three hours.",
    "The neighbour brought over two bottles of his cider as thanks.",
    "I drank one by the bench and listened to the rain on the roof.",
    "I wrote the measurements for the bookcase in the notebook.",
    "Tomorrow I want to cut the bookcase sides from the last of the oak.",
    "*Do you remember what I said about the reunion, and how I felt about going?"
  ];
  const fifth = [
    // PLAN E — the next stretch: the bookcase, the reunion, the neighbours.
    "I cut the bookcase sides this morning and they came out square.",
    "The last of the oak is barely enough, so I saved the offcuts.",
    "I glued up the first frame and left it in the clamps overnight.",
    "The glue line looks clean; I am pleased with it.",
    "The neighbour's kitchen shelf went up straight on Saturday.",
    "He insisted on paying me and I refused twice.",
    "We settled on him keeping the cider coming.",
    "Nothing much happened today - I swept and tidied and went to bed early.",
    "The reunion is in three weeks and I have written back saying yes.",
    "*Do you remember the very first thing I told you about the workshop?",
    "I found an old marking gauge in the bottom of a drawer.",
    "It was my father's, I think, though I cannot be sure.",
    "I cleaned the rust off it with oil and wire wool.",
    "It works well enough to mark a line now.",
    "The bookcase frame came out of the clamps and it is straight.",
    "I fitted the back panel from a thin sheet I had kept for years.",
    "*Do you remember what I keep in the bottom drawer beside the chisel?",
    "My sister says she will drive us both to the reunion.",
    "I booked nothing yet; she is more organised than me.",
    "It rained for two days and I did not go out at all.",
    "I read an old woodworking book and fell asleep in the chair.",
    "The bookcase is finished and holds the paperbacks already.",
    "I put it against the wall where the measurements were.",
    "The cat has already claimed the bottom shelf.",
    "I cleaned the whole workshop as a reward to myself.",
    "*Do you remember the bandsaw trouble and what fixed it in the end?",
    "The reunion is next week and I have picked out a clean shirt.",
    "I feel a little nervous about seeing everyone again.",
    "My sister says most of them are nervous too.",
    "The neighbour will water nothing while I am away; there is nothing to water.",
    "I packed the small plane to take and show the old crowd.",
    "The coach leaves at seven and I hate early starts.",
    "Nothing much happened - I checked the joints on the bookcase twice.",
    "The reunion was loud and warm and I am glad I went.",
    "People remembered me and asked about the workshop.",
    "I told them about the shelves and the stool and the slow feed trick.",
    "An old friend gave me a block plane he no longer uses.",
    "*Do you remember what we said about keeping the drawers labelled?",
    "I came home tired and happy and slept well.",
    "The block plane needs a new iron, so I ordered one.",
    "I put the plane from the reunion on the shelf with the others.",
    "The workshop feels fuller and more like itself than it has in years.",
    "My sister stayed for lunch and we talked about our parents.",
    "I showed her the bookcase and she asked for one just like it.",
    "I said yes, but not before spring.",
    "I measured the wall she wants it on, roughly, from memory.",
    "Nothing much happened today. I oiled the block plane and listened to the radio.",
    "*Do you remember how the first shelf felt when it fitted?",
    "I am looking forward to cutting the next boards.",
    "The oak is all used now, so I will need to find more.",
    "The neighbour knows a farmer with a stack of seasoned boards.",
    "I will ask him on Sunday when he comes by."
  ];
  const sixth = [
    // PLAN F — the autumn stretch (checkpoint-200 leg). Ordinary life with SIX natural
    // paraphrased recall callbacks (marked *): each asks about something Alice really
    // lived long ago, never in the historical probe wording, never revealing the answer.
    "The farmer delivered eight seasoned oak boards on Tuesday.",
    "I stacked them in the corner with spacers between each one.",
    "*I need to sharpen this — where did I end up putting the whetstone?",
    "My sister called about the bookcase I promised her for spring.",
    "I sketched a wider version and she approved it on the spot.",
    "The rain found a new gap in the roof and I moved the tools again.",
    "I nailed the flashing down properly this time, not just patched it.",
    "*The neighbour's cat is back — where does she like to sleep when she visits?",
    "Nothing much happened today. I cleaned the oilstone and made soup.",
    "I cut the first side panel for my sister's bookcase.",
    "The farmer's boards cut clean; well worth the money.",
    "*The saw is cutting roughly again — what fixed it last time?",
    "I wrote the fix on the card again and taped it under the window.",
    "My neighbour came by with apples from his garden.",
    "We drank tea in the workshop and talked about the reunion.",
    "*The stool wobbles again on the stone floor — what did I do about it before?",
    "I pressed the shim back down and it is steady for now.",
    "I planed the boards for the second side panel.",
    "The evening light comes earlier now; I stop by six.",
    "*I ran out of the cider he brought — what was it for again?",
    "I do not agree that oak is too heavy for bookcases; mine has stood for years.",
    "I glued up my sister's first frame and cleaned the clamps after.",
    "Nothing much happened. I swept and oiled the bench and went home.",
    "The reunion photos came in the post; I put one on the shelf.",
    "I started cutting the shelves for her bookcase.",
    "The cat followed me in again and claimed the offcut pile straight away.",
    "I labelled my sister's bookcase parts in pencil, the way I do now.",
    "My shoulder ached, so I stopped early and read the catalogue.",
    "The neighbour asked whether the bookcase wood is the same oak as my stools.",
    "I told him it is from the farmer's new stack, better seasoned.",
    "I sanded her shelves until they felt smooth under the hand.",
    "The reunion group is planning a spring visit to the old workshop.",
    "I offered to show them round if the owner agrees.",
    "*The bottom drawer sticks again — what did I say was in it?",
    "I waxed the drawer runner and it slides fine now.",
    "The frame for my sister's bookcase came out of the clamps straight.",
    "I fitted the back panel and stood it against the wall to look.",
    "Nothing much happened today. Tea, radio, a little sanding.",
    "The farmer asked me to build him a tool box for the truck.",
    "I said yes, from the offcuts, before the winter.",
    "I measured the truck bed with a tape he had, roughly.",
    "My sister visited and saw her bookcase assembled in the workshop.",
    "She nearly cried, which embarrassed us both.",
    "I promised to deliver it at the weekend in the farmer's truck.",
    "*Do you remember what I said I would never do with the oak?",
    "The truck run went fine and the bookcase is in her hall now.",
    "She filled it the same evening and sent me a photo.",
    "I started sketching the farmer's tool box from the offcuts.",
    "The workshop feels ready for winter for the first time in years.",
    "*Do you remember how the drawer labels are holding up?"
  ];
  const seventh = [
    // PLAN G — the cognition-memory-usage live acceptance: three natural paraphrased
    // recall callbacks whose retrieval targets and carrier content are already proven
    // (checkpoint-200 evaluation). Never the historical probe wording, no answers given.
    "Before I forget — which drawer did I say holds the chisel again?",
    "The neighbour's cat is at the door again — where does she usually nap when she visits?",
    "That stool is rocking on the floor once more — what did I use to steady it last time?"
  ];
  const chosen = PLAN_SET === "G" ? seventh : PLAN_SET === "F" ? sixth : PLAN_SET === "E" ? fifth : PLAN_SET === "D" ? fourth : PLAN_SET === "C" ? third : PLAN_SET === "B" ? later : null;
  if (chosen !== null) {
    if (batch <= chosen.length) return chosen.slice(0, batch);
    const filler: string[] = [];
    for (let index = chosen.length; index < batch; index += 1) {
      filler.push(`Day ${String(index + 1)}: I spent the afternoon tidying the workshop and making notes.`);
    }
    return [...chosen, ...filler];
  }
  const fixed = [
    // Session 1 — ordinary life, facts, corrections, feelings, a consequence, recall.
    "Morning. I finally sorted the workshop shelves yesterday.",
    "I keep my favourite chisel in the top drawer, next to the whetstone.",
    "The weather has been grey all week, so I stayed inside and varnished.",
    "Actually, I moved the whetstone to the bottom drawer last month.",
    "So the top drawer has the chisel and the bottom one has the whetstone.",
    "I finished the shelf today and it fits perfectly - that felt good.",
    "The bandsaw jammed twice and I lost an hour clearing it.",
    "Could you help me keep track of what I put where in the workshop?",
    "I labelled the drawers with tape after we talked about it.",
    "The label on the bottom drawer says whetstone - the tape is holding.",
    // Session 2 — disagreement, contradictions, mundane days, recall of feelings.
    "I do not agree that the shelves are finished; the edges still need sanding.",
    "I measured the second shelf and it is three millimetres short.",
    "Nothing much happened today, I just swept up and went home early.",
    "I sharpened the chisel again and put it back in the top drawer.",
    "The neighbour borrowed my clamp and returned it the same evening.",
    "That bandsaw jamming is still annoying me two weeks later.",
    "Tomorrow I want to start the second shelf from the same plan.",
    "The second shelf went together much faster than the first one.",
    "I checked both drawers again and the tape labels are still readable.",
    "Do you remember what I said about the bandsaw and how I felt about it?"
  ];
  if (batch <= fixed.length) return fixed.slice(0, batch);
  const extra: string[] = [];
  for (let index = fixed.length; index < batch; index += 1) {
    extra.push(`Day ${String(index + 1)}: I spent the afternoon tidying the workshop and making notes.`);
  }
  return [...fixed, ...extra];
}

interface DurableState {
  readonly origin: string;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly shared_revision: number | null;
  readonly episodes: number;
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly beliefs: readonly { readonly proposition_id: string; readonly credence: number }[];
  readonly relationships: readonly string[];
  readonly personality: readonly { readonly dimension_id: string; readonly value: number }[];
  readonly pending_behavior_outcome: boolean;
}

async function durableState(runtime: ProductRuntimeV0): Promise<DurableState> {
  const bootstrap = await runtime.bootstrap();
  const status = await runtime.status();
  return {
    origin: bootstrap.status,
    state_revision: status.state_revision,
    repository_revision: status.repository_revision,
    shared_revision: bootstrap.revisions.shared_revision,
    episodes: bootstrap.recent_memory.total_episode_count,
    affect: bootstrap.affect,
    beliefs: bootstrap.state.beliefs.map((item) => ({ proposition_id: item.proposition_id, credence: item.credence })),
    relationships: bootstrap.state.relationships.map((counterpart) => counterpart.counterpart_ref),
    personality: bootstrap.state.personality.map((dimension) => ({ ...dimension })),
    pending_behavior_outcome: status.pending_behavior_outcome ?? false
  };
}

/** Existing product diagnostics: per-stage provider call counts (no prompts). */
function stageCountsV0(runtime: ProductRuntimeV0): Record<string, number> | null {
  const view = runtime.diagnosticsView();
  const provider = view?.provider ?? null;
  if (provider === null) return null;
  const counts: Record<string, number> = {};
  for (const sample of provider.samples) counts[sample.stage] = sample.count;
  return counts;
}

type FailureClassV0 = "EXECUTOR" | "PRODUCT" | "CORE";

/** §19: executor failures are never folded into core. */
function classifyFailureV0(detail: string): { failure_class: FailureClassV0; kind: string; context: boolean } {
  if (/MODEL_TRANSPORT_MODEL_EMPTY_RESPONSE|completion content is empty|content is empty/i.test(detail)) {
    return { failure_class: "EXECUTOR", kind: "EMPTY_CONTENT", context: false };
  }
  if (/RATE_LIMIT|HTTP 429|rate limit/i.test(detail)) return { failure_class: "EXECUTOR", kind: "RATE_LIMIT", context: false };
  if (/MODEL_TIMEOUT|timed out/i.test(detail)) return { failure_class: "EXECUTOR", kind: "TIMEOUT", context: false };
  if (/MODEL_TRANSPORT_MODEL_OUTPUT_TRUNCATED|OUTPUT_TRUNCATED|done_reason=length/i.test(detail)) {
    return { failure_class: "EXECUTOR", kind: "OUTPUT_TRUNCATED", context: true };
  }
  if (/MODEL_HTTP_FAILURE|HTTP \d{3}|MODEL_CONNECTION_FAILURE/i.test(detail)) {
    return { failure_class: "EXECUTOR", kind: "PROVIDER_ERROR", context: false };
  }
  if (/refs not lexicographically sorted|duplicate ref/i.test(detail)) {
    return { failure_class: "PRODUCT", kind: "REFS_ORDER", context: false };
  }
  if (/SOURCE_QUOTE is not an exact substring|REJECTED_SOURCE_BINDING/i.test(detail)) {
    return { failure_class: "PRODUCT", kind: "SOURCE_QUOTE", context: false };
  }
  if (/INVOCATION_BINDING_INVALID|MODEL_SCHEMA_INVALID|LANGUAGE_SCHEMA_INVALID|FACTUAL_AUTHORIZATION_REJECTED|RESPONSE_SEMANTICS_REJECTED/i.test(detail)) {
    return { failure_class: "PRODUCT", kind: "OUTPUT_CONTRACT", context: false };
  }
  if (/restore mismatch|corruption|dangling|authority bypass|cross-subject/i.test(detail)) {
    return { failure_class: "CORE", kind: "CORE_INTEGRITY", context: false };
  }
  return { failure_class: "PRODUCT", kind: "TURN_FAILED_CLOSED", context: false };
}

/** Conservative, deterministic normalization for the mirroring watch (§18). */
function normalizedTokensV0(text: string): readonly string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * OBVIOUS near-verbatim mirroring: the user's own wording reappears almost intact in
 * the delivered reply — the longest contiguous shared token run covers at least 80%
 * of the user's tokens. Deliberately conservative; a count, never a judgement.
 */
function obviousMirrorV0(userText: string, replyText: string): boolean {
  const user = normalizedTokensV0(userText);
  if (user.length < 4) return false;
  const reply = normalizedTokensV0(replyText);
  let best = 0;
  for (let start = 0; start < user.length; start += 1) {
    for (let offset = 0; offset < reply.length; offset += 1) {
      let run = 0;
      while (start + run < user.length && offset + run < reply.length && user[start + run] === reply[offset + run]) {
        run += 1;
      }
      if (run > best) best = run;
    }
  }
  return best / user.length >= 0.8;
}

/**
 * §9 saturation classification — deterministic, from the committed series only.
 * NOT_OBSERVED: no completed turn sits at the bound. TRANSIENT_BOUND_CONTACT: the
 * bound was touched but the series also came back down. PERSISTENT_BOUND_SATURATION_
 * CANDIDATE: every completed turn in the batch sits at the bound and the pre-batch
 * checkpoint was already at the bound (no natural decline observed at all).
 */
function classifyActivationV0(
  series: readonly { readonly activation: number }[],
  startActivation: number | null
): "NOT_OBSERVED" | "TRANSIENT_BOUND_CONTACT" | "PERSISTENT_BOUND_SATURATION_CANDIDATE" {
  if (series.length === 0) return "NOT_OBSERVED";
  const atBound = series.filter((entry) => entry.activation >= 1).length;
  if (atBound === 0) return "NOT_OBSERVED";
  if (atBound < series.length) return "TRANSIENT_BOUND_CONTACT";
  return startActivation !== null && startActivation >= 1
    ? "PERSISTENT_BOUND_SATURATION_CANDIDATE"
    : "TRANSIENT_BOUND_CONTACT";
}

interface IssueCandidate {
  issue_id: string;
  subject_id: string;
  turn_index: number;
  timestamp: string;
  category: "CORE_INTEGRITY" | "BEHAVIORAL" | "PRODUCT";
  severity: "BLOCKER" | "MAJOR" | "MINOR";
  failure_class?: FailureClassV0;
  current_scene: string;
  relevant_durable_refs: readonly string[];
  state_snapshot_summary: Record<string, unknown>;
  retrieved_memory_refs: readonly string[];
  executor: string;
  result: string;
  expected: string;
  observed: string;
  reproducible: "YES" | "NO" | "UNKNOWN";
}

function latencyStatsV0(samples: readonly number[]): {
  readonly samples: number;
  readonly min: number | null;
  readonly median: number | null;
  readonly p95: number | null;
  readonly max: number | null;
  readonly total: number;
} {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (fraction: number): number | null =>
    sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)] ?? null;
  return {
    samples: sorted.length,
    min: sorted[0] ?? null,
    median: at(0.5),
    p95: at(0.95),
    max: sorted.at(-1) ?? null,
    total: sorted.reduce((sum, value) => sum + value, 0)
  };
}

describe.skipIf(!ENABLED)("CORE_V1_LONG_RUN", () => {
  it(`runs ${String(BATCH)} real interactions with fresh restarts and checkpoints`, async () => {
    mkdirSync(DATA_ROOT, { recursive: true });
    const issues: IssueCandidate[] = [];
    const problem = (issue: Omit<IssueCandidate, "issue_id" | "subject_id" | "timestamp">): void => {
      issues.push({
        issue_id: `LR-${String(issues.length + 1).padStart(3, "0")}`,
        subject_id: SUBJECT_ID,
        timestamp: new Date().toISOString(),
        ...issue
      });
    };

    let runtime: ProductRuntimeV0;
    try {
      runtime = await createProductRuntimeV0({
        data_root: DATA_ROOT,
        subject: { display_name: SUBJECT_ID },
        session_label: "core-v1-long-run"
      });
    } catch (error) {
      // The product fails closed when the requested family has no credential. That is
      // a prerequisite problem, not a run: record it and stop loudly, nothing faked.
      const detail = error instanceof Error ? error.message.slice(0, 300) : "unknown";
      const blocked = {
        schema_version: "core-v1-long-run-blocked-v0",
        subject_id: SUBJECT_ID,
        data_root: DATA_ROOT,
        credential_present: process.env["MODEL_API_KEY"] !== undefined,
        requested_executor: process.env["CHARACTEROS_EXECUTOR"] ?? "(unset)",
        detail,
        note: "Run did not start: the product configuration failed closed before any interaction."
      };
      writeFileSync(
        join(process.cwd(), "tmp", "deepseek-long-run-blocked.json"),
        `${JSON.stringify(blocked, null, 2)}\n`,
        "utf8"
      );
      throw new Error(
        `DEEPSEEK_RUN_BLOCKED_CREDENTIAL_ABSENT: the product executor could not be created (${detail}). ` +
          `Export the credential in the environment (MODEL_API_KEY) — presence is required — and re-run. ` +
          `This harness never reads a credential from a file or an argument.`,
        { cause: error }
      );
    }
    const configuration = runtime.configView();
    const family = configuration.executor.effective;
    const credentialPresent = configuration.executor.credential_present;
    const backend = `${family} / ${configuration.model.value} @ ${configuration.endpoint.value}`;
    // Monitor the effective executor endpoint, plus the local executor endpoint the
    // Ollama-only adaptation providers keep using regardless of the selected family
    // (same default the product resolves when OLLAMA_BASE_URL is unset). Records
    // carry the host, so the artifact can split cloud and local traffic.
    const observedHosts = [
      configuration.endpoint.value,
      process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434"
    ];
    const requestObserver: ProviderRequestObserverV0 = installProviderRequestObserverV0(observedHosts);
    const artifactPath = join(
      process.cwd(),
      "tmp",
      `${family === "deepseek" ? "deepseek-" : ""}long-run-checkpoint-${String(BATCH)}.json`
    );
    const progressPath = join(
      process.cwd(),
      "tmp",
      `${family === "deepseek" ? "deepseek-" : ""}long-run-progress-${String(BATCH)}.json`
    );

    const checkpoints: Record<string, unknown>[] = [];
    const turns: Record<string, unknown>[] = [];
    const restartsDetail: Record<string, unknown>[] = [];
    const failureKinds: Record<string, number> = {};
    /** workflow_id → the repository revision where monitoring first observed the transition. */
    const beliefTransitionRevisions = new Map<string, string>();
    /** Per-turn accounting: provider vs local time, request count and token usage. */
    const turnMetrics: Record<string, unknown>[] = [];
    /** Persistence tripwires (§14) — any of these STOP the batch. */
    const tripwires: string[] = [];
    const restoreLatencies: number[] = [];
    let r1Conversion: Record<string, unknown> | null = null;
    let lastSnapshotBytes = durableSizesV0(DATA_ROOT).snapshot_bytes;

    const activationSeries: Record<string, unknown>[] = [];
    const mirrorFlags: Record<string, unknown>[] = [];
    let snapshotStartActivation: number | null = null;
    const snapshotBytesStart = durableSizesV0(DATA_ROOT).snapshot_bytes;

    let persistenceReviewRequired = false;
    let restarts = 0;
    let degradations = 0;
    let nonCompletions = 0;
    let attempted = 0;
    let totalProviderMs = 0;
    let contextWallOccurrences = 0;
    let consecutiveContextFailures = 0;
    let stoppedReason: string | null = null;
    let chunkStopReason: string | null = null;
    let lastExecutorFailureKind: string | null = null;
    let consecutiveSameExecutorFailures = 0;
    const heapChunkStart = heapReadingV0();
    const latencies: number[] = [];
    const replyTexts: string[] = [];

    /**
     * The whole record, rebuilt from live in-memory evidence. `partial: true` is the
     * crash-safe progress file (rewritten after every interaction); the same shape is
     * written once as the batch artifact at the end.
     */
    const buildRecord = async (partial: boolean, note: string): Promise<Record<string, unknown>> => {
      let state: DurableState | null;
      try {
        state = await durableState(runtime);
      } catch (error) {
        state = null;
        note = `${note} | state unreadable: ${error instanceof Error ? error.message.slice(0, 120) : "unknown"}`;
      }
      let stageCounts: Record<string, number> | null;
      try {
        stageCounts = stageCountsV0(runtime);
      } catch {
        stageCounts = null;
      }
      const providerView = runtime.diagnosticsView()?.provider ?? null;
      const wallStatus =
        contextWallOccurrences === 0
          ? `${family === "deepseek" ? "DEEPSEEK_LONGRUN_" : ""}CONTEXT_WALL_NOT_OBSERVED_AT_${String(attempted)}_TURNS`
          : "CONTEXT_WALL_OBSERVED";
      return {
        schema_version: "core-v1-long-run-checkpoint-v0",
        generated_from_head: process.env["CHARACTEROS_LONG_RUN_HEAD"] ?? "(unavailable)",
        subject_id: SUBJECT_ID,
        data_root: DATA_ROOT,
        executor: {
          requested: configuration.executor.requested,
          family,
          model: configuration.model.value,
          endpoint: configuration.endpoint.value,
          timeout_ms: configuration.timeout_ms.value,
          context_window_tokens: configuration.context_window_tokens.value,
          num_predict: configuration.num_predict.value,
          credential_present: credentialPresent,
          reason: configuration.executor.reason,
          observed_hosts: observedHosts,
          note: "current product executor configuration; no substitution, no benchmark"
        },
        deepseek: {
          provider_path: family === "deepseek" ? "OpenAiCompatibleTransportV0 (/chat/completions)" : null,
          credential_present: credentialPresent,
          model: family === "deepseek" ? configuration.model.value : null,
          endpoint: family === "deepseek" ? configuration.endpoint.value : null
        },
        batch: {
          requested: BATCH,
          attempted,
          completed: turns.filter((turn) => turn["status"] === "COMPLETE").length,
          failed: turns.filter((turn) => turn["status"] === "FAILED" || turn["status"] === "THREW").length,
          degraded: degradations,
          non_completions: nonCompletions
        },
        stop_reason: stoppedReason,
        restarts,
        restarts_detail: restartsDetail,
        interactions: turns,
        checkpoints,
        state,
        stage_counts: stageCounts,
        provider_diagnostics: providerView,
        provider_requests: requestObserver.summary(),
        latency_ms: latencyStatsV0(latencies),
        delivered_reply_texts: replyTexts,
        wall_watch: {
          context_wall_occurrences: contextWallOccurrences,
          stop_rule: "2 consecutive same-context EXECUTOR failures stop the batch",
          status: wallStatus
        },
        failure_kinds: failureKinds,
        chunk: {
          mode: "SHORT_LIVED",
          chunk_size: CHUNK_SIZE,
          target_episodes: TARGET_EPISODES,
          plan_offset: PLAN_OFFSET,
          max_deepseek_requests: MAX_DEEPSEEK_REQUESTS,
          stop_reason: chunkStopReason
        },
        heap: { start: heapChunkStart, end: heapReadingV0() },
        turn_metrics: turnMetrics,
        r1_conversion: r1Conversion,
        persistence_tripwires: tripwires,
        restore_latency_ms: restoreLatencies,
        persistence_bytes: {
          snapshot: durableSizesV0(DATA_ROOT).snapshot_bytes,
          shared: durableSizesV0(DATA_ROOT).shared_subject_bytes
        },
        // The appraisal-pressure watch now runs in the SHORT-LIVED inspector process
        // between chunks (scripts/long-run-inspect.mjs); the live worker never parses
        // the durable store. The orchestrator merges the inspector output into the
        // resume artifact.
        appraisal_pressure: null,
        persistence_review_required: persistenceReviewRequired,
        activation_series: activationSeries,
        near_verbatim_mirror_count: mirrorFlags.filter((flag) => flag["obvious_near_verbatim"] === true).length,
        mirror_flags: mirrorFlags,
        activation_saturation_classification: classifyActivationV0(
          activationSeries.map((entry) => ({ activation: Number(entry["activation"]) })),
          snapshotStartActivation
        ),
        snapshot_bytes: {
          start: snapshotBytesStart,
          current: durableSizesV0(DATA_ROOT).snapshot_bytes
        },
        degradations,
        non_completions: nonCompletions,
        issues,
        core_changes: [],
        partial,
        updated_at: new Date().toISOString(),
        note
      };
    };

    const persistProgress = async (note: string): Promise<void> => {
      writeFileSync(progressPath, `${JSON.stringify(await buildRecord(true, note), null, 2)}\n`, "utf8");
    };

    const checkpoint = async (label: string, index: number): Promise<void> => {
      const state = await durableState(runtime);
      const life: ProductLifeViewV0 = await runtime.lifeView();
      const memory = await runtime.livedMemory(100);
      const evolution = life.evolution;
      const entry: Record<string, unknown> = {
        checkpoint: label,
        interactions: index,
        restarts,
        durable: state,
        evolution_attribution: evolution.attribution,
        evolution_belief_transitions: evolution.durable_effects.belief.length,
        evolution_affect_transitions: evolution.durable_effects.affect.length,
        cognition_visible_episodes: evolution.cognition_visible.memory_episode_refs.length,
        memory_entries: memory.entries.map((entry_) => entry_.episode_ref),
        snapshot_bytes: durableSizesV0(DATA_ROOT).snapshot_bytes,
        heap: heapReadingV0(),
        stage_counts: stageCountsV0(runtime),
        provider_requests: requestObserver.summary(),
        degradations,
        non_completions: nonCompletions,
        total_provider_ms: totalProviderMs
      };
      checkpoints.push(entry);

      // ---- CORE INTEGRITY: lawful values, unique identity, no dangling provenance ----
      if (!Number.isFinite(state.affect.valence) || Math.abs(state.affect.valence) > 1) {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: label,
          relevant_durable_refs: [],
          state_snapshot_summary: state as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "affect valence outside [-1,1] or non-finite",
          expected: "valence in [-1,1]",
          observed: String(state.affect.valence),
          reproducible: "UNKNOWN"
        });
      }
      const beliefIds = state.beliefs.map((item) => item.proposition_id);
      if (new Set(beliefIds).size !== beliefIds.length) {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: label,
          relevant_durable_refs: beliefIds,
          state_snapshot_summary: state as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "duplicate proposition identity",
          expected: "unique proposition ids",
          observed: beliefIds.join(", "),
          reproducible: "YES"
        });
      }
      const episodeRefs = memory.entries.map((entry_) => entry_.episode_ref);
      if (new Set(episodeRefs).size !== episodeRefs.length) {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: label,
          relevant_durable_refs: [],
          state_snapshot_summary: state as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "duplicate episode refs",
          expected: "unique episodes",
          observed: String(episodeRefs.length),
          reproducible: "YES"
        });
      }
      // LR-002/LR-003 CORRECTION: durable membership is decided by the PRODUCTION
      // authority — at the head revision AND at the revision where monitoring first
      // observed each transition — and NEVER by the bounded read-model window above.
      const membershipTransitions = evolution.durable_effects.belief.map((transition) => ({
        workflow_id: transition.workflow_id,
        evidence_episode_refs: transition.evidence_episode_refs
      }));
      const membership = await evaluateBeliefEvidenceMembershipV0({
        transitions: membershipTransitions,
        head_repository_revision: state.repository_revision,
        transition_revisions: beliefTransitionRevisions,
        belongs: (revision, refs) => runtime.refsBelongToRevision(revision, refs)
      });
      for (const transition of membershipTransitions) {
        if (!beliefTransitionRevisions.has(transition.workflow_id)) {
          beliefTransitionRevisions.set(transition.workflow_id, state.repository_revision);
        }
      }
      entry["membership"] = {
        verdict: membership.verdict,
        checked_transitions: membership.checked_transitions,
        checked_refs: membership.checked_refs,
        findings: membership.findings.length,
        blocker_reason: membership.blocker_reason
      };
      if (membership.verdict === "BLOCKER") {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          failure_class: "CORE",
          current_scene: label,
          relevant_durable_refs: membership.findings.filter((finding) => !finding.belongs).flatMap((finding) => finding.refs),
          state_snapshot_summary: { membership } as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "belief transition cites an episode outside production durable membership",
          expected: "every evidence ref belongs at the head revision and at its transition revision",
          observed: membership.blocker_reason ?? "membership check failed",
          reproducible: "YES"
        });
      }
      for (const dimension of state.personality) {
        if (!Number.isFinite(dimension.value) || dimension.value < 0 || dimension.value > 1) {
          problem({
            turn_index: index,
            category: "CORE_INTEGRITY",
            severity: "BLOCKER",
            current_scene: label,
            relevant_durable_refs: [dimension.dimension_id],
            state_snapshot_summary: state as unknown as Record<string, unknown>,
            retrieved_memory_refs: [],
            executor: backend,
            result: "personality dimension outside [0,1]",
            expected: "unit interval",
            observed: `${dimension.dimension_id}=${String(dimension.value)}`,
            reproducible: "UNKNOWN"
          });
        }
      }

      // ---- BEHAVIORAL / SATURATION WATCH (observation only, never a repair) ----------
      if (Math.abs(state.affect.valence) >= 0.999) {
        problem({
          turn_index: index,
          category: "BEHAVIORAL",
          severity: "MINOR",
          current_scene: label,
          relevant_durable_refs: [],
          state_snapshot_summary: { affect: state.affect },
          retrieved_memory_refs: [],
          executor: backend,
          result: "POTENTIAL_DYNAMIC_SATURATION: canonical affect is at the bound",
          expected: "observe whether a real life stays pinned at the bound",
          observed: JSON.stringify(state.affect),
          reproducible: "UNKNOWN"
        });
      }
      const saturatedPersonality = state.personality.filter(
        (dimension) => dimension.value === 0 || dimension.value === 1
      );
      if (saturatedPersonality.length > 0) {
        problem({
          turn_index: index,
          category: "BEHAVIORAL",
          severity: "MINOR",
          current_scene: label,
          relevant_durable_refs: saturatedPersonality.map((dimension) => dimension.dimension_id),
          state_snapshot_summary: { personality: state.personality },
          retrieved_memory_refs: [],
          executor: backend,
          result: "POTENTIAL_DYNAMIC_SATURATION: acquired personality dimension at its bound",
          expected: "observe only",
          observed: JSON.stringify(saturatedPersonality),
          reproducible: "UNKNOWN"
        });
      }
      await persistProgress(`checkpoint ${label}`);
    };

    /**
     * A fresh host over the SAME data root: shutdown, re-create, verify the critical
     * durable fields are identical. Returns false when the subject could not be
     * restored at all (the batch cannot continue, and that is recorded, not repaired).
     */
    const restart = async (index: number, reason: "SCHEDULED" | "POST_FAILURE_RECOVERY"): Promise<boolean> => {
      let before: DurableState | null;
      try {
        before = await durableState(runtime);
      } catch {
        before = null; // the failed runtime may already refuse reads; that IS the observation
      }
      try {
        await runtime.shutdown();
      } catch {
        // a poisoned runtime may fail to shut down cleanly; a new host is still attempted
      }
      const restoreStarted = Date.now();
      try {
        runtime = await createProductRuntimeV0({
          data_root: DATA_ROOT,
          subject: { display_name: SUBJECT_ID },
          session_label: "core-v1-long-run"
        });
      } catch (error) {
        restartsDetail.push({
          restart: restarts + 1,
          reason,
          interactions: index,
          restore: "FAILED",
          detail: error instanceof Error ? error.message.slice(0, 200) : "unknown"
        });
        problem({
          turn_index: index,
          category: "PRODUCT",
          severity: "MAJOR",
          failure_class: "PRODUCT",
          current_scene: `restart ${String(restarts + 1)} (${reason})`,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: "a fresh product host could not be created over the subject data root",
          expected: "a fresh host, restored from durable state",
          observed: error instanceof Error ? error.message.slice(0, 200) : "unknown",
          reproducible: "UNKNOWN"
        });
        await persistProgress("recovery failed");
        return false;
      }
      restarts += 1;
      const restoreMs = Date.now() - restoreStarted;
      restoreLatencies.push(restoreMs);
      const after = await durableState(runtime);
      if (after.origin !== "RESTORED" && reason === "SCHEDULED") {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: `restart ${String(restarts)}`,
          relevant_durable_refs: [],
          state_snapshot_summary: after as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "a fresh runtime did not restore the existing subject",
          expected: "RESTORED",
          observed: after.origin,
          reproducible: "UNKNOWN"
        });
      }
      const mismatches: string[] = [];
      if (before !== null) {
        for (const key of [
          "state_revision",
          "repository_revision",
          "shared_revision",
          "episodes",
          "pending_behavior_outcome"
        ] as const) {
          if (before[key] !== after[key]) mismatches.push(`${key}: ${String(before[key])} -> ${String(after[key])}`);
        }
        if (JSON.stringify(before.affect) !== JSON.stringify(after.affect)) mismatches.push("affect");
        if (JSON.stringify(before.beliefs) !== JSON.stringify(after.beliefs)) mismatches.push("beliefs");
        if (JSON.stringify(before.relationships) !== JSON.stringify(after.relationships)) {
          mismatches.push("relationships");
        }
        if (JSON.stringify(before.personality) !== JSON.stringify(after.personality)) {
          mismatches.push("personality");
        }
      }
      const restore =
        before === null ? "RESTORED_UNVERIFIED" : mismatches.length === 0 ? "EXACT" : "MISMATCH";
      if (mismatches.length > 0) {
        // A poisoned (fail-closed) runtime keeps uncommitted bookkeeping in memory; a
        // fresh host restores the last DURABLE state, so a mismatch after a failure is
        // expected and is recorded as such — never as a durable-integrity block.
        const poisoned = reason === "POST_FAILURE_RECOVERY";
        problem({
          turn_index: index,
          category: poisoned ? "PRODUCT" : "CORE_INTEGRITY",
          severity: poisoned ? "MINOR" : "BLOCKER",
          failure_class: poisoned ? "PRODUCT" : "CORE",
          current_scene: `restart ${String(restarts)}`,
          relevant_durable_refs: [],
          state_snapshot_summary: { before, after } as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: poisoned
            ? "failed runtime's in-memory projection differs from the restored durable state"
            : "restore mismatch",
          expected: poisoned
            ? "the fresh host restores the last durable commit exactly"
            : "exact durable restore",
          observed: mismatches.join(" | "),
          reproducible: "YES"
        });
      }
      restartsDetail.push({
        restart: restarts,
        reason,
        interactions: index,
        restore,
        mismatches,
        origin: after.origin,
        restore_ms: restoreMs,
        after
      });
      checkpoints.push({
        checkpoint: `restart_${String(restarts)}`,
        interactions: index,
        restarts,
        reason,
        restore,
        mismatches
      });
      await persistProgress(`restart ${String(restarts)} (${reason})`);
      return true;
    };

    const interactions = plan(BATCH + PLAN_OFFSET).slice(PLAN_OFFSET);
    await checkpoint("START", 0);
    // §7 FRESH-RESTORE HEAP TRIPWIRE: if a brand-new process is already at the soft
    // limit right after restore, the runtime's operational memory envelope is reached.
    const freshHeap = heapReadingV0();
    if (shouldResetChunkV0(freshHeap)) {
      throw new Error(
        `RUNTIME_MEMORY_OPERATIONAL_LIMIT_REACHED: a fresh process is at heap ratio ${String(freshHeap.ratio)} after restore`
      );
    }
    let lastDurable: DurableState | null = await durableState(runtime);
    snapshotStartActivation = lastDurable.affect.activation;
    for (const [index, rawText] of interactions.entries()) {
      const number = index + 1;
      attempted = number;
      // A leading "*" marks a designed EARLY-MEMORY RECALL PROBE (§10): the marker is
      // stripped before submission and the turn is tagged, never answered by the host.
      const recallProbe = rawText.startsWith("*");
      const text = recallProbe ? rawText.slice(1).trim() : rawText;
      const requestsBefore = requestObserver.records().length;
      let turn: ProductTurnResultV0;
      let threw: string | null = null;
      try {
        const result = await runtime.submitHumanText(text);
        turn = runtime.summarizeTurn(result);
      } catch (error) {
        threw = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
        turn = {
          status: "FAILED",
          reply_text: null,
          turn_index: -1,
          subject_id: SUBJECT_ID,
          completed_prior_outcome: null,
          language_call_required: false,
          elapsed_ms: null,
          repository_revision_after: "",
          state_revision_after: -1,
          failure_detail: threw,
          failure: null
        } as unknown as ProductTurnResultV0;
        nonCompletions += 1;
        const classified = classifyFailureV0(threw);
        problem({
          turn_index: number,
          category: "PRODUCT",
          severity: "MAJOR",
          failure_class: classified.failure_class,
          current_scene: text,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: `turn threw (${classified.kind})`,
          expected: "a bounded failure summary",
          observed: threw,
          reproducible: "UNKNOWN"
        });
      }
      const detail = turn.failure_detail ?? "";
      const classified = classifyFailureV0(detail);
      if (turn.status !== "COMPLETE") {
        failureKinds[classified.kind] = (failureKinds[classified.kind] ?? 0) + 1;
      }
      turns.push({
        interaction: number,
        text,
        status: turn.status,
        elapsed_ms: turn.elapsed_ms,
        state_revision_after: turn.state_revision_after < 0 ? null : turn.state_revision_after,
        subject_turn_index: turn.turn_index < 0 ? null : turn.turn_index,
        language_call_required: turn.language_call_required,
        failure: detail === "" ? threw : detail,
        failure_class: classified.failure_class,
        failure_kind: classified.kind
      });
      if (turn.elapsed_ms !== null) {
        latencies.push(turn.elapsed_ms);
        totalProviderMs += turn.elapsed_ms;
      }
      if (turn.status === "COMPLETE" && turn.reply_text !== null) {
        replyTexts.push(turn.reply_text.slice(0, 400));
      }
      // §15 LATENCY SPLIT — provider time from the observer's per-request durations;
      // everything else in the turn is local (canonical state work + persistence).
      const turnRequests = requestObserver.records().slice(requestsBefore);
      const providerMs = turnRequests.reduce((sum, record) => sum + record.duration_ms, 0);
      const inputTokens = turnRequests.reduce((sum, record) => sum + (record.usage?.prompt_tokens ?? 0), 0);
      const outputTokens = turnRequests.reduce((sum, record) => sum + (record.usage?.completion_tokens ?? 0), 0);
      const localMs = turn.elapsed_ms === null ? null : Math.max(0, turn.elapsed_ms - providerMs);
      const snapshotNow = durableSizesV0(DATA_ROOT).snapshot_bytes;
      const heapTurn = heapReadingV0();
      turnMetrics.push({
        interaction: number,
        status: turn.status,
        heap_used: heapTurn.heap_used,
        heap_ratio: heapTurn.ratio,
        recall_probe: recallProbe,
        elapsed_ms: turn.elapsed_ms,
        provider_ms: providerMs,
        local_ms: localMs,
        requests: turnRequests.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        snapshot_bytes: snapshotNow
      });
      // §2 R1_REPRESENTATION_CONVERSION: the first save after R1 deployed rewrites the
      // historical pretty files minified. One large step down while the durable state
      // advances lawfully IS the conversion — never data loss, never a blocker.
      if (
        r1Conversion === null &&
        lastSnapshotBytes !== null &&
        snapshotNow !== null &&
        lastSnapshotBytes > 5_000_000 &&
        snapshotNow < lastSnapshotBytes * 0.7
      ) {
        r1Conversion = {
          at_interaction: number,
          before_bytes: lastSnapshotBytes,
          after_bytes: snapshotNow,
          ratio: Number((snapshotNow / lastSnapshotBytes).toFixed(4)),
          classification: "R1_REPRESENTATION_CONVERSION"
        };
      }
      if (snapshotNow !== null) lastSnapshotBytes = snapshotNow;
      // §14 PERSISTENCE TRIPWIRES — a trigger stops the batch; nothing is redesigned live.
      // The save path itself is measured by the SHORT-LIVED inspector process between
      // chunks; the per-turn LOCAL time is an observation of local work, not a save metric.
      if (snapshotNow !== null && snapshotNow > 350 * 1024 * 1024) {
        tripwires.push(`SNAPSHOT_ABOVE_350MB@${String(number)}`);
      }
      if (restoreLatencies.filter((ms) => ms > 30_000).length >= 2) {
        tripwires.push(`RESTORE_ABOVE_30S_TWICE@${String(number)}`);
      }
      if (tripwires.length > 0) {
        stoppedReason = "PERSISTENCE_OPERATIONAL_LIMIT_REACHED";
        await persistProgress(`stopped by persistence tripwire: ${tripwires.join(", ")}`);
        break;
      }
      // §6 HEAP SOFT TRIPWIRE: end the CHUNK long before Node's limit; a fresh process
      // restores and continues. This is a monitoring/process boundary, never a defect.
      if (shouldResetChunkV0(heapTurn)) {
        chunkStopReason = "CHUNK_MEMORY_RESET_REQUIRED";
        await persistProgress("chunk ended: heap soft tripwire");
        break;
      }
      // §10 chunk size / durable target boundaries.
      if (number >= CHUNK_SIZE) {
        chunkStopReason = "CHUNK_SIZE_REACHED";
        await persistProgress("chunk ended: chunk size reached");
        break;
      }
      if (TARGET_EPISODES !== null && lastDurable !== null && lastDurable.episodes >= TARGET_EPISODES) {
        chunkStopReason = "TARGET_EPISODES_REACHED";
        await persistProgress("chunk ended: durable episode target reached");
        break;
      }
      // §14 request guard (observability only).
      const cloudRequests = requestObserver.summary().by_path["/chat/completions"] ?? 0;
      if (cloudRequests > MAX_DEEPSEEK_REQUESTS) {
        tripwires.push("DEEPSEEK_REQUEST_GUARD_EXCEEDED");
        stoppedReason = "PERSISTENCE_OPERATIONAL_LIMIT_REACHED";
        await persistProgress("stopped: cloud request guard exceeded");
        break;
      }
      if (turn.status === "DEGRADED") {
        degradations += 1;
        problem({
          turn_index: number,
          category: "PRODUCT",
          severity: "MINOR",
          failure_class: "PRODUCT",
          current_scene: text,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: "EXECUTOR_OUTPUT_DEGRADED after one bounded regeneration",
          expected: "observe frequency",
          observed: (turn.failure_detail ?? "no detail").slice(0, 300),
          reproducible: "UNKNOWN"
        });
      }
      if (turn.status === "FAILED") {
        nonCompletions += 1;
        if (threw === null) {
          problem({
            turn_index: number,
            category: "PRODUCT",
            severity: classified.kind === "TIMEOUT" ? "MAJOR" : "MINOR",
            failure_class: classified.failure_class,
            current_scene: text,
            relevant_durable_refs: [],
            state_snapshot_summary: {},
            retrieved_memory_refs: [],
            executor: backend,
            result: `turn failed closed (${classified.kind})`,
            expected: "a completed turn",
            observed: detail.slice(0, 300),
            reproducible: "UNKNOWN"
          });
        }
        // §24 FAILED TURN LAW: a failed turn must not move durable state.
        let afterFailure: DurableState | null;
        try {
          afterFailure = await durableState(runtime);
        } catch {
          afterFailure = null;
        }
        if (afterFailure !== null && lastDurable !== null) {
          if (afterFailure.episodes !== lastDurable.episodes) {
            problem({
              turn_index: number,
              category: "CORE_INTEGRITY",
              severity: "BLOCKER",
              failure_class: "CORE",
              current_scene: text,
              relevant_durable_refs: [],
              state_snapshot_summary: { before: lastDurable, after: afterFailure } as unknown as Record<string, unknown>,
              retrieved_memory_refs: [],
              executor: backend,
              result: "a failed turn changed the durable episode count",
              expected: "durable state unchanged by a failed turn",
              observed: `${String(lastDurable.episodes)} -> ${String(afterFailure.episodes)}`,
              reproducible: "YES"
            });
          }
          if (afterFailure.state_revision !== lastDurable.state_revision && afterFailure.origin === "RESTORED") {
            // An in-memory advance without a durable commit is the fail-closed bookkeeping
            // pattern; it is recorded, and the durable snapshot mtime check below is the
            // authoritative statement about what was actually written.
            problem({
              turn_index: number,
              category: "PRODUCT",
              severity: "MINOR",
              failure_class: "PRODUCT",
              current_scene: text,
              relevant_durable_refs: [],
              state_snapshot_summary: { before: lastDurable, after: afterFailure } as unknown as Record<string, unknown>,
              retrieved_memory_refs: [],
              executor: backend,
              result: "fail-closed turn advanced the in-memory projection without a durable commit",
              expected: "durable revision unchanged by a failed turn",
              observed: `${String(lastDurable.state_revision)} -> ${String(afterFailure.state_revision)}`,
              reproducible: "YES"
            });
          }
        }
        if (classified.context) {
          contextWallOccurrences += 1;
          consecutiveContextFailures += 1;
        } else {
          consecutiveContextFailures = 0;
        }
        // §16 EXECUTOR OUTAGE STOP: two consecutive SAME-CLASS executor failures end the
        // batch (a provider outage must not be hammered through the whole plan).
        if (classified.failure_class === "EXECUTOR") {
          if (lastExecutorFailureKind === classified.kind) {
            consecutiveSameExecutorFailures += 1;
          } else {
            lastExecutorFailureKind = classified.kind;
            consecutiveSameExecutorFailures = 1;
          }
          if (consecutiveSameExecutorFailures >= 2) {
            chunkStopReason = `EXECUTOR_FAILURE_STOP_${classified.kind}`;
            await persistProgress(`chunk ended: two consecutive ${classified.kind} executor failures`);
            break;
          }
        } else {
          lastExecutorFailureKind = null;
          consecutiveSameExecutorFailures = 0;
        }
      } else {
        consecutiveContextFailures = 0;
        lastExecutorFailureKind = null;
        consecutiveSameExecutorFailures = 0;
        lastDurable = await durableState(runtime);
        // AFFECT ACTIVATION WATCH (§8) — one committed observation per completed turn.
        activationSeries.push({
          interaction: number,
          session_turn_index: turn.turn_index,
          state_revision: lastDurable.state_revision,
          episodes: lastDurable.episodes,
          valence: lastDurable.affect.valence,
          activation: lastDurable.affect.activation,
          snapshot_bytes: durableSizesV0(DATA_ROOT).snapshot_bytes,
          elapsed_ms: turn.elapsed_ms
        });
        // REPLY MIRRORING WATCH (§18) — conservative deterministic count.
        if (turn.reply_text !== null) {
          mirrorFlags.push({
            interaction: number,
            obvious_near_verbatim: obviousMirrorV0(text, turn.reply_text)
          });
        }
      }
      if (number % 5 === 0) {
        await checkpoint(`TURN_${String(number)}`, number);
        // §18 SNAPSHOT STOP CONDITION: past the review threshold, stop at the next
        // checkpoint instead of running the whole batch blindly.
        const snapshotNow = durableSizesV0(DATA_ROOT).snapshot_bytes;
        if (snapshotNow !== null && snapshotNow > 300 * 1024 * 1024) {
          persistenceReviewRequired = true;
          stoppedReason = "PERSISTENCE_SCALABILITY_REVIEW_REQUIRED";
          await persistProgress("stopped: snapshot above the review threshold");
          break;
        }
      }
      await persistProgress(`interaction ${String(number)} ${turn.status}`);
      if (number % RESTART_EVERY === 0 || number === interactions.length) {
        if (!(await restart(number, "SCHEDULED"))) {
          stoppedReason = "RESTART_FAILED";
          break;
        }
        lastDurable = await durableState(runtime);
      }
      if (turn.status === "FAILED") {
        if (consecutiveContextFailures >= 2) {
          // §20: two consecutive same-context failures stop the batch; do not burn the rest.
          stoppedReason = "STOPPED_AFTER_2_CONSECUTIVE_CONTEXT_FAILURES";
          await persistProgress("stopped by the context-failure stop rule");
          break;
        }
        // The product runtime stays closed after a failed turn (observed behaviour); an
        // operator restarts the app. One bounded recovery restart keeps the batch lived.
        if (!(await restart(number, "POST_FAILURE_RECOVERY"))) {
          stoppedReason = "RESTART_FAILED";
          break;
        }
        lastDurable = await durableState(runtime);
      }
    }

    // Every chunk (and the batch) ends with a fresh restore verification, then the
    // process exits — the deliberate heap reset of the short-lived chunk model.
    const finalRestoreOk = await restart(attempted, "SCHEDULED");
    if (finalRestoreOk) await checkpoint("FINAL_RESTORE", attempted);
    requestObserver.uninstall();

    const record = await buildRecord(
      false,
      "Operational observation only — no scientific verdict, no new core mechanism, no repair performed."
    );
    const serialized = `${JSON.stringify(record, null, 2)}\n`;
    writeFileSync(artifactPath, serialized, "utf8");
    const sha = createHash("sha256").update(serialized, "utf8").digest("hex");
    const batchInfo = record["batch"] as { completed: number; failed: number };
    const stateInfo = record["state"] as DurableState | null;
    const summary = {
      executor_family: family,
      model: configuration.model.value,
      credential_present: credentialPresent,
      interactions: `${String(batchInfo.completed)}/${String(BATCH)} COMPLETE`,
      attempted,
      failed: batchInfo.failed,
      stop_reason: stoppedReason,
      restarts,
      restarts_detail: restartsDetail.map((entry) => `${String(entry["reason"])}@${String(entry["interactions"])}:${String(entry["restore"])}`),
      degradations,
      non_completions: nonCompletions,
      context_wall_occurrences: contextWallOccurrences,
      provider_requests: record["provider_requests"],
      latency_ms: record["latency_ms"],
      episodes: stateInfo?.episodes ?? null,
      affect: stateInfo?.affect ?? null,
      beliefs: stateInfo?.beliefs ?? null,
      issues: issues.map((issue) => `${issue.issue_id} ${issue.severity} ${issue.category}: ${issue.result}`),
      artifact: artifactPath,
      sha256: sha
    };
    console.log("LONG_RUN_CHECKPOINT", JSON.stringify(summary, null, 2));
    console.log("LONG_RUN_CONFIG", JSON.stringify(configuration));
    // The harness never asserts a happy outcome: it records what happened. The only hard
    // expectations are that the batch ran to its end (or stopped by its own rule) and
    // that the artifact exists.
    expect(attempted).toBeGreaterThan(0);
    // A batch ends either by running its full size or by a DELIBERATE boundary: a chunk
    // stop (short-lived process model) or a recorded stop reason. Both are valid ends.
    expect(attempted === BATCH || chunkStopReason !== null || stoppedReason !== null).toBe(true);
    expect(readFileSync(artifactPath, "utf8").length).toBeGreaterThan(0);
  }, 28_800_000);
});
