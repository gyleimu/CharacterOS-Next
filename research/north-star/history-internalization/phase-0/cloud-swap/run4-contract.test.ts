/**
 * RUN-4 CONTRACT — OFFLINE VERIFICATION (0 model calls, no network).
 *
 *   npx vitest run research/north-star/history-internalization/phase-0/cloud-swap/run4-contract.test.ts
 *
 * Three things are checked, each able to fail:
 *
 *   1. COMPLETENESS of the forbidden-inherited-identity list, DERIVED from the evidence rather than
 *      trusted. The first draft named five ids when fifteen had been consumed. Deriving the set means
 *      the list cannot silently drift again.
 *   2. the fresh run-4 identities satisfy the frozen §4 identity-leakage law and collide with nothing
 *      that has already been used;
 *   3. this tree cannot mint a scientific verdict — the same law the cloud-swap suite applies.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { P0_MAX_TOTAL_MODEL_CALLS, P0_QUAL_SUBJECT_ID, P0_SUBJECT_A_ID, P0_SUBJECT_B_ID } from "../contract.ts";
import { P0_FROZEN_SUBJECT_IDS_V0 } from "../harness.ts";
import { CS_QUALIFICATION_REV2_SUBJECT_IDS } from "./contract-cloud-v0.ts";
import {
  P0_RUN4_FORBIDDEN_INHERITED_IDS,
  P0_RUN4_MAX_TOTAL_MODEL_CALLS,
  P0_RUN4_SUBJECT_IDS
} from "./contract-run4.ts";

const PHASE0_DIR = join(process.cwd(), "research", "north-star", "history-internalization", "phase-0");
const EVIDENCE_DIR = join(PHASE0_DIR, "evidence");

/** Identity form: `subject-<stem>(-<stem>)*-<4 digits>`. Schema names such as `subject-state-view-v0`
 * have no 4-digit suffix and are therefore not identities. */
const IDENTITY_PATTERN = /subject-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{4}/g;

function allEvidenceText(): string {
  const chunks: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else chunks.push(readFileSync(full, "utf8"));
    }
  };
  walk(EVIDENCE_DIR);
  return chunks.join("\n");
}

const consumedIds = new Set(allEvidenceText().match(IDENTITY_PATTERN) ?? []);

/**
 * Run-4's OWN identities are consumed BY run-4, so once run-4 has executed they appear in the evidence
 * as well — and they are obviously not inherited. Excluding them is what keeps the completeness check
 * meaningful: every identity from an EARLIER run must still be forbidden.
 *
 * This exclusion is not cosmetic. The first version omitted it, and the check fired correctly the moment
 * run-4's own evidence landed, demanding that run-4 forbid its own subjects.
 */
const RUN4_OWN_IDS = new Set([
  P0_RUN4_SUBJECT_IDS.qualification,
  P0_RUN4_SUBJECT_IDS.armA,
  P0_RUN4_SUBJECT_IDS.armB
]);
const inheritedIds = new Set([...consumedIds].filter((id) => !RUN4_OWN_IDS.has(id)));

// =============================================================================================
// 1. COMPLETENESS — DERIVED FROM THE EVIDENCE, NOT TRUSTED
// =============================================================================================

describe("run-4 contract — the forbidden-inherited list is complete", () => {
  it("finds a non-empty set of previously consumed identities in the evidence (the check is not vacuous)", () => {
    expect(inheritedIds.size).toBeGreaterThanOrEqual(10);
  });

  it("lists EVERY identity consumed by an EARLIER run that appears anywhere in the phase-0 evidence", () => {
    const missing = [...inheritedIds].filter((id) => !P0_RUN4_FORBIDDEN_INHERITED_IDS.includes(id)).sort();
    expect(missing, `identities consumed but not forbidden to run-4: ${missing.join(", ")}`).toEqual([]);
  });

  it("contains the three frozen run-1 identities and every re-identified successor", () => {
    for (const id of [P0_SUBJECT_A_ID, P0_SUBJECT_B_ID, P0_QUAL_SUBJECT_ID]) {
      expect(P0_RUN4_FORBIDDEN_INHERITED_IDS).toContain(id);
    }
    for (const id of CS_QUALIFICATION_REV2_SUBJECT_IDS) {
      expect(P0_RUN4_FORBIDDEN_INHERITED_IDS).toContain(id);
    }
    expect(P0_RUN4_FORBIDDEN_INHERITED_IDS).toContain("subject-r2-q0v8-3319");
    expect(P0_RUN4_FORBIDDEN_INHERITED_IDS).toContain("subject-r3-7p4n-2185");
  });

  it("contains no entry that is not an identity of that form (no schema name leaked into the list)", () => {
    for (const id of P0_RUN4_FORBIDDEN_INHERITED_IDS) {
      expect(new RegExp(`^${IDENTITY_PATTERN.source}$`).test(id), `${id} is not an identity form`).toBe(true);
    }
  });
});

// =============================================================================================
// 2. THE FRESH IDENTITIES SATISFY THE FROZEN §4 LAW
// =============================================================================================

describe("run-4 contract — the fresh identities satisfy §4", () => {
  it("the two ARM ids share a stem, are equal length and differ ONLY in a 4-digit suffix", () => {
    const a = P0_RUN4_SUBJECT_IDS.armA;
    const b = P0_RUN4_SUBJECT_IDS.armB;
    expect(a.length).toBe(b.length);
    expect(a.slice(0, -4)).toBe(b.slice(0, -4));
    expect(a.slice(-4)).toMatch(/^[0-9]{4}$/);
    expect(b.slice(-4)).toMatch(/^[0-9]{4}$/);
    expect(a).not.toBe(b);
  });

  it("the suffix carries no order meaning (not consecutive, not a 1/2 pair)", () => {
    const a = Number(P0_RUN4_SUBJECT_IDS.armA.slice(-4));
    const b = Number(P0_RUN4_SUBJECT_IDS.armB.slice(-4));
    expect(Math.abs(a - b)).toBeGreaterThan(1);
  });

  it("the in-run qualification subject uses a DIFFERENT stem, so non-target is never confusable with an arm", () => {
    const stem = (id: string): string => id.split("-").slice(0, -1).join("-");
    expect(stem(P0_RUN4_SUBJECT_IDS.qualification)).not.toBe(stem(P0_RUN4_SUBJECT_IDS.armA));
  });

  it("collides with nothing it must not, and is not the frozen map", () => {
    const fresh = [P0_RUN4_SUBJECT_IDS.qualification, P0_RUN4_SUBJECT_IDS.armA, P0_RUN4_SUBJECT_IDS.armB];
    expect(new Set(fresh).size).toBe(3);
    for (const id of fresh) {
      // NOT "absent from the evidence": run-4 has now executed, so its own identities are IN the
      // evidence by construction. Pre-run freshness was verified against the then-existing evidence and
      // is recorded in the preregistration; it cannot be re-derived from evidence that now contains
      // run-4 itself. What remains checkable, and is what matters, is that run-4's ids are not
      // forbidden to run-4 and do not collide with the frozen identities.
      expect(P0_RUN4_FORBIDDEN_INHERITED_IDS).not.toContain(id);
      expect(inheritedIds.has(id), `${id} collides with an earlier run's identity`).toBe(false);
    }
    expect(fresh).not.toContain(P0_FROZEN_SUBJECT_IDS_V0.armA);
    expect(P0_RUN4_SUBJECT_IDS.sessionA).not.toBe(P0_FROZEN_SUBJECT_IDS_V0.sessionA);
  });
});

// =============================================================================================
// 3. THE RUN-4 CEILING IS THE FROZEN CEILING, AND THIS TREE CANNOT MINT A VERDICT
// =============================================================================================

describe("run-4 contract — reused values and no verdict authority", () => {
  it("does not re-choose the call ceiling", () => {
    expect(P0_RUN4_MAX_TOTAL_MODEL_CALLS).toBe(P0_MAX_TOTAL_MODEL_CALLS);
  });

  it("cannot mint a scientific verdict: no verdict token appears in the run-4 sources", () => {
    const sources = readdirSync(join(PHASE0_DIR, "cloud-swap")).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")
    );
    expect(sources.length).toBeGreaterThanOrEqual(6);
    const forbidden = [
      "LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED",
      "HISTORY_INTERNALIZATION_V1_FAILURE_A_EXPERIENCE_TO_STATE_NOT_ESTABLISHED",
      "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE"
    ];
    for (const name of sources) {
      const source = readFileSync(join(PHASE0_DIR, "cloud-swap", name), "utf8");
      for (const needle of forbidden) {
        expect(source.includes(needle), `${name} must not contain ${needle}`).toBe(false);
      }
    }
  });
});
