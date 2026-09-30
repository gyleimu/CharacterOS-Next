/**
 * SUBJECT-ID MAP — OFFLINE VERIFICATION (0 model calls, stub transports only).
 *
 *   npx vitest run research/north-star/history-internalization/phase-0/subject-id-map.test.ts
 *
 * The map was added so a NEW condition can use FRESH subjects without disarming the leakage audit. So
 * the load-bearing question is not “does the map work” but:
 *
 *   is the audit actually DEAF when the map is wrong?
 *
 * If it were not, the map would be decoration. The decisive case below constructs a leak of the new
 * condition's arm-B id inside an arm-A request and shows that the FROZEN map does not see it while the
 * CUSTOM map does. That is the disarmament this parameterisation exists to prevent, demonstrated rather
 * than asserted.
 *
 * Plus: the DEFAULT path must still be the frozen path, byte for byte, end to end.
 */

import { describe, expect, it } from "vitest";

import {
  P0_QUAL_SUBJECT_ID,
  P0_SUBJECT_A_ID,
  P0_SUBJECT_B_ID,
  scorePhase0V0
} from "./contract.ts";
import { buildPhase0SourceV0 } from "./fixtures.ts";
import {
  P0_FROZEN_SUBJECT_IDS_V0,
  instrumentPhase0BundleV0,
  runPhase0ScheduleV0,
  scanExecutedRequestsV0,
  type Phase0BundleV0,
  type Phase0SubjectIdsV0
} from "./harness.ts";
import { buildPhase0StubBundleV0 } from "./stubs.ts";

/** A fresh condition's identities: non-frozen, opaque, colliding with no frozen id. */
const FRESH_IDS: Phase0SubjectIdsV0 = Object.freeze({
  qualification: "subject-v4m9-1177",
  armA: "subject-v4m9-6031",
  armB: "subject-v4m9-8452",
  sessionQualification: "session-v4m9-qual-0001",
  sessionA: "session-v4m9-6031-0001",
  sessionB: "session-v4m9-8452-0001"
});

function request(turn: string, ...contents: readonly string[]): Phase0BundleV0["cognitionRequests"][number] {
  return { turn, messages: contents.map((content, i) => ({ role: i === 0 ? "system" : "user", content })) };
}

function runWith(subjectIds?: Phase0SubjectIdsV0, armAId?: string, armBId?: string) {
  const bundle = buildPhase0StubBundleV0();
  const instrumented = instrumentPhase0BundleV0(bundle);
  return runPhase0ScheduleV0({
    bundle: instrumented,
    sourceA: buildPhase0SourceV0(armAId ?? subjectIds?.armA ?? P0_SUBJECT_A_ID),
    sourceB: buildPhase0SourceV0(armBId ?? subjectIds?.armB ?? P0_SUBJECT_B_ID),
    ...(subjectIds === undefined ? {} : { subjectIds }),
    log: () => {}
  }).then((result) => ({ result, instrumented }));
}

// =============================================================================================
// 1. THE DEFAULT PATH IS THE FROZEN PATH
// =============================================================================================

describe("subject-id map — the default path is unchanged", () => {
  it("defaults to the frozen identities, not to anything derived", () => {
    expect(P0_FROZEN_SUBJECT_IDS_V0).toEqual({
      qualification: P0_QUAL_SUBJECT_ID,
      armA: P0_SUBJECT_A_ID,
      armB: P0_SUBJECT_B_ID,
      sessionQualification: "session-qualification-0001",
      sessionA: "session-k7q2-4103-0001",
      sessionB: "session-k7q2-8267-0001"
    });
  });

  it("runs the whole frozen schedule unchanged when no map is supplied", async () => {
    const { result } = await runWith();
    expect(result.turns).toHaveLength(11);
    expect(result.turns.filter((t) => t.arm === "A")).toHaveLength(5);
    expect(result.turns.filter((t) => t.arm === "B")).toHaveLength(5);
    expect(result.qualification["subject_id"]).toBe(P0_QUAL_SUBJECT_ID);
    expect(result.qualificationPassed).toBe(true);
    expect(result.itemPreA?.credence).toBe(0.55);
    expect(result.itemPreB?.credence).toBe(0.55);
    // The stub chain is designed to reach the POSITIVE branch; if the default path had drifted, this
    // would not hold.
    const score = scorePhase0V0({
      credence_pre_A: result.itemPreA?.credence ?? 0,
      credence_post_A: result.itemPostA?.credence ?? 0,
      credence_pre_B: result.itemPreB?.credence ?? 0,
      credence_post_B: result.itemPostB?.credence ?? 0,
      turns_executed_A: 5,
      turns_executed_B: 5,
      integrity_failures: result.integrityFailures
    });
    expect(score.verdict.outcome).toBe("POSITIVE");
    expect(result.integrityFailures).toEqual([]);
    expect(result.executedLeakage["clean"]).toBe(true);
  });
});

// =============================================================================================
// 2. A FRESH MAP IS ACTUALLY USED
// =============================================================================================

describe("subject-id map — fresh identities are used end to end", () => {
  it("drives the qualification subject and both arms from the supplied map", async () => {
    const { result } = await runWith(FRESH_IDS);
    expect(result.qualification["subject_id"]).toBe(FRESH_IDS.qualification);
    expect(result.qualificationPassed).toBe(true);
    expect(result.turns).toHaveLength(11);
    expect(result.integrityFailures).toEqual([]);
  });

  it("renders the FRESH ids into the model-visible requests and never the frozen ones", async () => {
    const { result, instrumented } = await runWith(FRESH_IDS);
    const rendered = instrumented.cognitionRequests
      .flatMap((request) => request.messages.map((message) => message.content))
      .join("\n");
    // The production cognition prompt renders subject_id into SUBJECT DATA, so a fresh run must show
    // the fresh identity.
    expect(rendered).toContain(FRESH_IDS.armA);
    expect(rendered).toContain(FRESH_IDS.armB);
    // And an earlier condition's identity must never appear in a later condition's bytes.
    expect(rendered).not.toContain(P0_SUBJECT_A_ID);
    expect(rendered).not.toContain(P0_SUBJECT_B_ID);
    expect(result.executedLeakage["clean"]).toBe(true);
  });
});

// =============================================================================================
// 3. THE DECISIVE CASE — THE AUDIT IS DEAF WITH THE WRONG MAP
// =============================================================================================

describe("subject-id map — the leakage audit's mapping is load-bearing", () => {
  /**
   * A leak of the NEW condition's arm-B identity inside an arm-A request. This is exactly the failure
   * the audit exists to catch, expressed for the new condition.
   */
  const leakingRequests: Phase0BundleV0["cognitionRequests"] = [
    request("A:turn_0", `system context`, `user text mentioning ${FRESH_IDS.armB}`)
  ];

  it("the FROZEN map does NOT catch it — the audit would have been silently disarmed", () => {
    const scan = scanExecutedRequestsV0(leakingRequests, P0_FROZEN_SUBJECT_IDS_V0);
    // This is the whole reason the map had to travel with the identities: substituting ids from outside
    // the harness, without parameterising the map, would have left this leak invisible while the audit
    // still reported “clean”.
    expect(scan["clean"]).toBe(true);
    expect((scan["hits"] as unknown[]).length).toBe(0);
  });

  it("the CUSTOM map DOES catch it", () => {
    const scan = scanExecutedRequestsV0(leakingRequests, FRESH_IDS);
    expect(scan["clean"]).toBe(false);
    const hits = scan["hits"] as { needle: string; turn: string }[];
    expect(hits.some((hit) => hit.needle === FRESH_IDS.armB && hit.turn === "A:turn_0")).toBe(true);
  });

  it("a subject's OWN id stays exempt, so the audit does not fire on legitimate prompts", () => {
    const ownIdRequests: Phase0BundleV0["cognitionRequests"] = [
      request("A:turn_0", `system`, `user text mentioning ${FRESH_IDS.armA}`),
      request("B:turn_0", `system`, `user text mentioning ${FRESH_IDS.armB}`),
      request("QUALIFICATION:turn_0", `system`, `user text mentioning ${FRESH_IDS.qualification}`)
    ];
    const scan = scanExecutedRequestsV0(ownIdRequests, FRESH_IDS);
    expect(scan["clean"]).toBe(true);
    expect(scan["own_subject_id_is_expected_and_is_not_a_leak"]).toBe(true);
    expect(scan["check_can_fire"]).toBe(true);
  });

  it("an earlier condition's id is forbidden in a later condition even though it is not in the map's arms", () => {
    const crossCondition: Phase0BundleV0["cognitionRequests"] = [
      request("A:turn_0", `system`, `user text mentioning ${P0_SUBJECT_B_ID}`)
    ];
    const scan = scanExecutedRequestsV0(crossCondition, FRESH_IDS);
    expect(scan["clean"]).toBe(false);
    expect((scan["hits"] as { needle: string }[]).some((hit) => hit.needle === P0_SUBJECT_B_ID)).toBe(true);
  });

  it("an unlabelled request is exempt from nothing: every id is foreign to it", () => {
    const unlabelled: Phase0BundleV0["cognitionRequests"] = [
      request("PRE", `system`, `user text mentioning ${FRESH_IDS.armA}`)
    ];
    const scan = scanExecutedRequestsV0(unlabelled, FRESH_IDS);
    expect(scan["clean"]).toBe(false);
  });
});
