/**
 * LONG-RUN MONITORING MEMBERSHIP — LR-002/LR-003 regression tests (0 model calls).
 *
 * M1: 102-episode shape — an old lawful episode OUTSIDE the newest-100 read-model
 *     window produces NO false BLOCKER (the checker never consults that window).
 * M2: a truly nonexistent ref still BLOCKS.
 * M3: a ref not yet visible at the transition's revision still BLOCKS (historical
 *     lawfulness; head visibility is never substituted).
 * M4: a head-visible old ref PASSES.
 * M5: the checker refuses to run without the production predicate and contains no
 *     window/manifest shortcut of its own.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  evaluateBeliefEvidenceMembershipV0,
  type BeliefEvidenceMembershipInputV0
} from "./monitoring-membership.js";

const HEAD = "R305";
const OLD_REVISION = "R2";

/** The production predicate over a durable membership set per revision. */
function predicateFrom(visible: Readonly<Record<string, readonly string[]>>) {
  return async (revision: string, refs: readonly string[]): Promise<boolean> => {
    const members = visible[revision] ?? [];
    return refs.every((ref) => members.includes(ref));
  };
}

function input(
  overrides: Partial<BeliefEvidenceMembershipInputV0> & Pick<BeliefEvidenceMembershipInputV0, "belongs">
): BeliefEvidenceMembershipInputV0 {
  return {
    transitions: [
      { workflow_id: "wf-1", evidence_episode_refs: ["episode:old-1", "episode:new-1"] }
    ],
    head_repository_revision: HEAD,
    transition_revisions: new Map([["wf-1", OLD_REVISION]]),
    ...overrides
  };
}

describe("M1: an old lawful episode outside the newest-100 window is not a false BLOCKER", () => {
  it("passes when the canonical authority still sees the old episode (window does not)", async () => {
    // A 102-episode subject whose bounded read model would only show the newest 100.
    const windowOfNewest100 = Array.from({ length: 100 }, (_, index) => `episode:new-${String(index)}`);
    expect(windowOfNewest100).not.toContain("episode:old-1");
    const verdict = await evaluateBeliefEvidenceMembershipV0(
      input({
        belongs: predicateFrom({
          [OLD_REVISION]: ["episode:old-1", "episode:new-1"],
          [HEAD]: ["episode:old-1", "episode:new-1", ...windowOfNewest100]
        })
      })
    );
    expect(verdict.verdict).toBe("PASS");
    expect(verdict.blocker_reason).toBeNull();
    expect(verdict.checked_transitions).toBe(1);
    expect(verdict.checked_refs).toBe(2);
    // Both the head check and the transition-time check ran.
    expect(verdict.findings.map((finding) => finding.check)).toEqual(["HEAD_REVISION", "TRANSITION_REVISION"]);
  });
});

describe("M2: a truly dangling ref still blocks", () => {
  it("reports BLOCKER when the durable membership does not contain the ref", async () => {
    const verdict = await evaluateBeliefEvidenceMembershipV0(
      input({
        belongs: predicateFrom({ [OLD_REVISION]: ["episode:old-1", "episode:new-1"], [HEAD]: ["episode:new-1"] })
      })
    );
    expect(verdict.verdict).toBe("BLOCKER");
    expect(verdict.blocker_reason).toContain("episode:old-1");
    expect(verdict.blocker_reason).toContain("HEAD_REVISION");
  });
});

describe("M3: historical lawfulness is not substituted by head visibility", () => {
  it("reports BLOCKER when the ref only became visible after the transition revision", async () => {
    const verdict = await evaluateBeliefEvidenceMembershipV0(
      input({
        belongs: predicateFrom({
          [OLD_REVISION]: ["episode:new-1"], // not yet visible at transition time
          [HEAD]: ["episode:old-1", "episode:new-1"]
        })
      })
    );
    expect(verdict.verdict).toBe("BLOCKER");
    expect(verdict.blocker_reason).toContain("TRANSITION_REVISION");
  });
});

describe("M4: a head-visible old ref passes", () => {
  it("passes with no findings against either revision", async () => {
    const verdict = await evaluateBeliefEvidenceMembershipV0(
      input({
        belongs: predicateFrom({
          [OLD_REVISION]: ["episode:old-1", "episode:new-1"],
          [HEAD]: ["episode:old-1", "episode:new-1"]
        })
      })
    );
    expect(verdict.verdict).toBe("PASS");
    expect(verdict.findings.every((finding) => finding.belongs)).toBe(true);
  });
});

describe("M5: no window or manifest shortcut exists in the checker", () => {
  it("refuses to run without the production predicate", async () => {
    await expect(
      evaluateBeliefEvidenceMembershipV0({
        transitions: [],
        head_repository_revision: HEAD,
        transition_revisions: new Map(),
        belongs: undefined as never
      })
    ).rejects.toThrow(/production validateRefsBelong predicate/);
  });

  it("the checker source contains no lived-memory window, manifest or retrieval shortcut", () => {
    const source = readFileSync(fileURLToPath(new URL("./monitoring-membership.ts", import.meta.url)), "utf8");
    for (const forbidden of ["livedMemory", "manifest", "recent_memory", "recentMemory", "retrieval"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
