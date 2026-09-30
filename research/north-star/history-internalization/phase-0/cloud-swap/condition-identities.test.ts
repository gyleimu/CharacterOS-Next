/**
 * CONDITION IDENTITIES — the temporally-stable form of the completeness law.
 *
 * The first version of this suite derived "every identity that appears anywhere in the evidence" and
 * demanded run-4 forbid all of them. That is true only until a LATER run adds its own identities; it
 * fired correctly twice (once when run-4's own evidence landed, once when run-5's did), and each time
 * the right response was to narrow the scope — which is a sign the check was stated wrongly, not that
 * the list was wrong.
 *
 * It is now stated as an ALGEBRAIC INVARIANT over the frozen contracts, which cannot decay:
 *
 *   forbidden(run N) == forbidden(run N-1)  UNION  own(run N-1)
 *
 * plus one evidence-derived check that has no temporal problem at all: every identity appearing anywhere
 * in the phase-0 evidence must be DECLARED — either forbidden by the newest condition, or owned by a
 * condition that exists. An undeclared identity means a condition ran without declaring who it was.
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
  P0_RUN4_OWN_IDS,
  P0_RUN4_SUBJECT_IDS
} from "./contract-run4.ts";
import {
  P0_RUN5_AUGMENTATION,
  P0_RUN5_CHANGED_CONDITIONS,
  P0_RUN5_CONDITION,
  P0_RUN5_FORBIDDEN_INHERITED_IDS,
  P0_RUN5_OWN_IDS,
  P0_RUN5_SUBJECT_IDS,
  P0_RUN5_UNCHANGED_CONDITIONS
} from "./contract-run5.ts";

const PHASE0_DIR = join(process.cwd(), "research", "north-star", "history-internalization", "phase-0");
const EVIDENCE_DIR = join(PHASE0_DIR, "evidence");

/** Identity form: `subject-<stem>(-<stem>)*-<4 digits>`. Schema names have no 4-digit suffix. */
const IDENTITY_PATTERN = /subject-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{4}/g;
const IDENTITY_FORM = new RegExp(`^${IDENTITY_PATTERN.source}$`);

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

const evidenceIds = new Set(allEvidenceText().match(IDENTITY_PATTERN) ?? []);

// =============================================================================================
// 1. THE ALGEBRAIC INVARIANT — IT CANNOT DECAY AS LATER RUNS LAND
// =============================================================================================

describe("condition identities — the forbidden list is the accumulated chain", () => {
  it("the base set of frozen + REV1 identities is present in EVERY condition's list", () => {
    const base = [P0_SUBJECT_A_ID, P0_SUBJECT_B_ID, P0_QUAL_SUBJECT_ID, ...CS_QUALIFICATION_REV2_SUBJECT_IDS];
    for (const id of base) {
      expect(P0_RUN4_FORBIDDEN_INHERITED_IDS).toContain(id);
      expect(P0_RUN5_FORBIDDEN_INHERITED_IDS).toContain(id);
    }
  });

  it("run-5 forbids EVERYTHING run-4 forbade, PLUS run-4's own identities", () => {
    for (const id of P0_RUN4_FORBIDDEN_INHERITED_IDS) {
      expect(P0_RUN5_FORBIDDEN_INHERITED_IDS).toContain(id);
    }
    for (const id of P0_RUN4_OWN_IDS) {
      expect(P0_RUN5_FORBIDDEN_INHERITED_IDS).toContain(id);
    }
    // …and adds nothing beyond that chain: the list is derivable, not hand-grown.
    const expected = new Set([...P0_RUN4_FORBIDDEN_INHERITED_IDS, ...P0_RUN4_OWN_IDS]);
    const extra = P0_RUN5_FORBIDDEN_INHERITED_IDS.filter((id) => !expected.has(id));
    expect(extra, `run-5 forbids undeclared ids: ${extra.join(", ")}`).toEqual([]);
  });

  it("NO condition forbids its own identities", () => {
    for (const id of P0_RUN4_OWN_IDS) expect(P0_RUN4_FORBIDDEN_INHERITED_IDS).not.toContain(id);
    for (const id of P0_RUN5_OWN_IDS) expect(P0_RUN5_FORBIDDEN_INHERITED_IDS).not.toContain(id);
  });

  it("every listed identity is an identity form (no schema name leaked into a list)", () => {
    for (const id of [...P0_RUN4_FORBIDDEN_INHERITED_IDS, ...P0_RUN5_FORBIDDEN_INHERITED_IDS]) {
      expect(IDENTITY_FORM.test(id), `${id} is not an identity form`).toBe(true);
    }
  });
});

// =============================================================================================
// 2. NO UNDECLARED IDENTITY EVER RAN — evidence-derived, temporally stable
// =============================================================================================

describe("condition identities — nothing ran undeclared", () => {
  it("finds a non-empty set of identities in the evidence (the check is not vacuous)", () => {
    expect(evidenceIds.size).toBeGreaterThanOrEqual(10);
  });

  it("every identity appearing anywhere in the evidence is DECLARED", () => {
    const declared = new Set<string>([
      ...P0_RUN5_FORBIDDEN_INHERITED_IDS,
      ...P0_RUN4_OWN_IDS,
      ...P0_RUN5_OWN_IDS
    ]);
    const undeclared = [...evidenceIds].filter((id) => !declared.has(id)).sort();
    expect(undeclared, `identities found in evidence but declared by no condition: ${undeclared.join(", ")}`).toEqual(
      []
    );
  });
});

// =============================================================================================
// 3. THE FRESH IDENTITIES SATISFY THE FROZEN §4 LAW
// =============================================================================================

describe("condition identities — fresh identities satisfy §4", () => {
  it("arms share a stem, are equal length, and differ ONLY in a 4-digit suffix", () => {
    for (const ids of [P0_RUN4_SUBJECT_IDS, P0_RUN5_SUBJECT_IDS]) {
      expect(ids.armA.length).toBe(ids.armB.length);
      expect(ids.armA.slice(0, -4)).toBe(ids.armB.slice(0, -4));
      expect(ids.armA.slice(-4)).toMatch(/^[0-9]{4}$/);
      expect(ids.armB.slice(-4)).toMatch(/^[0-9]{4}$/);
      // No order meaning: not consecutive.
      expect(Math.abs(Number(ids.armA.slice(-4)) - Number(ids.armB.slice(-4)))).toBeGreaterThan(1);
    }
  });

  it("the qualification subject uses a DIFFERENT stem in every condition", () => {
    const stem = (id: string): string => id.split("-").slice(0, -1).join("-");
    for (const ids of [P0_RUN4_SUBJECT_IDS, P0_RUN5_SUBJECT_IDS]) {
      expect(stem(ids.qualification)).not.toBe(stem(ids.armA));
    }
  });

  it("run-5's identities are fresh, distinct, and are not the frozen map", () => {
    const fresh = [...P0_RUN5_OWN_IDS];
    expect(new Set(fresh).size).toBe(3);
    expect(fresh).not.toContain(P0_FROZEN_SUBJECT_IDS_V0.armA);
    expect(P0_RUN5_SUBJECT_IDS.sessionA).not.toBe(P0_FROZEN_SUBJECT_IDS_V0.sessionA);
    for (const id of fresh) expect(P0_RUN4_OWN_IDS).not.toContain(id);
  });
});

// =============================================================================================
// 4. REUSED VALUES AND NO VERDICT AUTHORITY IN THIS TREE
// =============================================================================================

describe("condition contracts — reused values and no verdict authority", () => {
  it("does not re-choose the call ceiling", () => {
    expect(P0_RUN4_MAX_TOTAL_MODEL_CALLS).toBe(P0_MAX_TOTAL_MODEL_CALLS);
  });

  it("the run-5 condition declares its ONE change and the UNCHANGED invalid policy", () => {
    expect(P0_RUN5_CONDITION).toContain("SOURCE_QUOTE_AUGMENTATION");
    expect(P0_RUN5_CHANGED_CONDITIONS["cognition_request_text"]).toContain("appended to the cognition request");
    expect(P0_RUN5_UNCHANGED_CONDITIONS["invalid_policy"]).toContain("UNCHANGED");
    expect(P0_RUN5_UNCHANGED_CONDITIONS["invalid_policy"]).toContain("no engineering-failure tolerance");
    expect(P0_RUN5_AUGMENTATION.length).toBeGreaterThan(200);
  });

  it("cannot mint a scientific verdict: no verdict token appears in the non-test sources", () => {
    const sources = readdirSync(join(PHASE0_DIR, "cloud-swap")).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")
    );
    expect(sources.length).toBeGreaterThanOrEqual(8);
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
