/**
 * P2.3 Trust-Boundary Surgical Closure Round 3 — B4 collision-safe Observation
 * transition identity regressions.
 *
 * Red-team finding (BLOCKER B4): the old construction performed a LOSSY string
 * composition (`observationId.replace(":", "-")` inside `t-obs-<subject>-r<rev>-o<id>`),
 * so distinct legal tuples produced the EXACT SAME transition_id — breaking
 * reservation identity, replay, reuse detection, journal lookup and bundle
 * attribution. The mapping from authoritative Observation identity inputs to
 * transition_id must be injective; the fix is a domain-separated canonical hash
 * over the exact tuple (no Date.now / randomUUID / Math.random — determinism
 * must remain).
 */

import { describe, expect, it } from "vitest";

import { validateIdentifier } from "@characteros-next/subject-core";
import {
  observationTransitionId
} from "./observation-transition-executor.js";
import { timeTransitionId } from "../time/time-transition-executor.js";

/** Exact replica of the VULNERABLE lossy composition (evidence of danger). */
function legacyObservationTransitionId(
  subjectId: string,
  revision: number,
  observationId: string
): string {
  const safeObservationId = observationId.replace(":", "-");
  return `t-obs-${subjectId}-r${revision}-o${safeObservationId}`;
}

describe("round 3 — B4 collision-safe observation transition identity", () => {
  it("old-equivalent collision fixture proves the danger of the lossy composition", () => {
    // Two DISTINCT LEGAL tuples produce the EXACT SAME legacy transition id.
    // Mechanism: the composition interpolates its separators (`-r<rev>-o`) into
    // one undelimited ASCII string, so an observation id whose (legal) element
    // embeds the same separator pattern shifts the subject/revision boundary:
    //   A: subject `subject-s0`                    rev 0  obs `observation:x-r0-oobservation-y`
    //   B: subject `subject-s0-r0-oobservation-x`  rev 0  obs `observation:y`
    // both flatten to `t-obs-subject-s0-r0-oobservation-x-r0-oobservation-y`.
    // Every field is valid under the frozen IdentifierV0 / CanonicalRefV0 grammar.
    const legacyA = legacyObservationTransitionId("subject-s0", 0, "observation:x-r0-oobservation-y");
    const legacyB = legacyObservationTransitionId("subject-s0-r0-oobservation-x", 0, "observation:y");
    expect(legacyA).toBe(legacyB); // the demonstrated collision
    expect("subject-s0").not.toBe("subject-s0-r0-oobservation-x");
    expect("observation:x-r0-oobservation-y").not.toBe("observation:y");
  });

  it("the repaired construction separates the old collision pair", async () => {
    const idA = await observationTransitionId("subject-s0", 0, "observation:x-r0-oobservation-y");
    const idB = await observationTransitionId("subject-s0-r0-oobservation-x", 0, "observation:y");
    expect(idA).not.toBe(idB);
  });

  it("the repaired construction also separates tuples differing only in the sanitized character", async () => {
    // The legacy replace(":","-") made the id depend on the SANITIZED string:
    // any tuple pair differing only in that character shared one legacy id.
    const idA = await observationTransitionId("subject-s0", 0, "observation:a:b");
    const idB = await observationTransitionId("subject-s0", 0, "observation:a-b");
    expect(idA).not.toBe(idB);
  });

  it("same tuple → exactly the same transition ID (determinism preserved)", async () => {
    const first = await observationTransitionId("subject-s0", 0, "observation:o-77");
    const second = await observationTransitionId("subject-s0", 0, "observation:o-77");
    expect(first).toBe(second);
  });

  it("different subject / revision / observation_id → different IDs (injectivity)", async () => {
    const base = await observationTransitionId("subject-s0", 0, "observation:o-77");
    const otherSubject = await observationTransitionId("subject-s1", 0, "observation:o-77");
    const otherRevision = await observationTransitionId("subject-s0", 1, "observation:o-77");
    const otherObservation = await observationTransitionId("subject-s0", 0, "observation:o-78");
    expect(new Set([base, otherSubject, otherRevision, otherObservation]).size).toBe(4);
  });

  it("produced IDs stay valid under the frozen identifier syntax", async () => {
    const id = await observationTransitionId("subject-s0", 0, "observation:o-77");
    const checked = validateIdentifier(id, "observation transition id");
    expect(checked.ok).toBe(true);
    expect(id.startsWith("t-obs-")).toBe(true);
  });

  it("Time transition identity carries no lossy-encoding collision of this class", () => {
    // timeTransitionId interpolates only opaque scalars (no separator-bearing
    // sanitization); distinct tuples must stay distinct.
    const a = timeTransitionId("subject-s0", 0, 5);
    const b = timeTransitionId("subject-s0", 0, 6);
    const c = timeTransitionId("subject-s0", 1, 5);
    const d = timeTransitionId("subject-s1", 0, 5);
    expect(new Set([a, b, c, d]).size).toBe(4);
    expect(a).toBe(timeTransitionId("subject-s0", 0, 5)); // deterministic
  });
});
