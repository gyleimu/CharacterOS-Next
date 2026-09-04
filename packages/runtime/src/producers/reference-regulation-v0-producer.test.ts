/**
 * P2.3.4.2b — REGULATION_V0 contract conformance tests (R1–R15 unit level)
 * against docs/implementation/p2-3-4-regulation-v0-reference-contract.md
 * (commit 69505fa). Executor-level evidence (R4/R12/R13/R14, port security)
 * lives in reference-regulation-integration.test.ts.
 */

import { describe, expect, it } from "vitest";

import type { DomainDeltaV0, RegulatoryStateV0 } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../types/runtime-context.js";
import type { RegulationProducerInputV0 } from "../ports/regulation-producer-port.js";
import { ReferenceRegulationV0Producer } from "./reference-regulation-v0-producer.js";

// ---------------------------------------------------------------------------------
// Fixtures (s0-shaped regulation: energy 1, stress 0, arousal 0.5, fatigue 0).
// ---------------------------------------------------------------------------------

function regulation(overrides: Record<string, unknown> = {}): RegulatoryStateV0 {
  return {
    energy: 1,
    stress: 0,
    arousal: 0.5,
    fatigue: 0,
    last_update: null,
    ...overrides
  } as unknown as RegulatoryStateV0;
}

function ctxAt(time: number): RuntimeContext {
  return {
    subject_id: "subject-s0" as never,
    current_logical_time: time as never,
    state_revision: 0 as never
  };
}

function inputAt(
  ticks: number,
  options: { time?: number; regulation?: RegulatoryStateV0 } = {}
): RegulationProducerInputV0 {
  return {
    context: ctxAt(options.time ?? 0),
    regulation: options.regulation ?? regulation(),
    elapsed_ticks: ticks
  };
}

function regulationValue(delta: DomainDeltaV0): Record<string, unknown> {
  const op = delta.operations[0];
  if (op === undefined) throw new Error("expected one operation");
  return op.value as Record<string, unknown>;
}

const producer = new ReferenceRegulationV0Producer();

function produce(input: RegulationProducerInputV0): Promise<DomainDeltaV0> {
  return producer.produceRegulationDelta(input);
}

describe("ReferenceRegulationV0Producer — REGULATION_V0 conformance", () => {
  // --- R1 determinism -----------------------------------------------------------
  it("R1: same regulation + same elapsed/time ⇒ byte-identical (deep-frozen) delta", async () => {
    const a = await produce(inputAt(7));
    const b = await produce(inputAt(7));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.isFrozen(a)).toBe(true);
  });

  // --- R2/R3/R5 identity + bookkeeping ------------------------------------------
  it.each([1, 5, 1234])("R2/R3/R5: elapsed=%i ⇒ four scalars unchanged, last_update = logical_time_after", async (ticks) => {
    const timeBefore = 900;
    const current = regulation({ last_update: 12 });
    const delta = await produce(inputAt(ticks, { time: timeBefore, regulation: current }));
    expect(delta.producer).toBe("regulation");
    expect(delta.domain).toBe("regulation");
    expect(delta.expected_repository_revision).toBeNull();
    expect(delta.provenance_refs).toEqual([]);
    expect(delta.operations).toHaveLength(1);
    const value = regulationValue(delta);
    expect(value["energy"]).toBe(current.energy);
    expect(value["stress"]).toBe(current.stress);
    expect(value["arousal"]).toBe(current.arousal);
    expect(value["fatigue"]).toBe(current.fatigue);
    expect(value["last_update"]).toBe(timeBefore + ticks);
  });

  it("R5: elapsed=1 emits exactly one complete /regulation replacement with exact fields", async () => {
    const delta = await produce(inputAt(1, { time: 41, regulation: regulation() }));
    expect(delta.operations).toHaveLength(1);
    const op = delta.operations[0];
    if (op === undefined) throw new Error("expected one operation");
    expect(op.path).toBe("/regulation");
    expect(regulationValue(delta)).toEqual({
      energy: 1,
      stress: 0,
      arousal: 0.5,
      fatigue: 0,
      last_update: 42
    });
  });

  // --- R6 large elapsed O(1) ------------------------------------------------------
  it("R6: large elapsed (1_000_000) ⇒ scalars byte-equivalent, last_update exact, no loop dependency", async () => {
    const current = regulation({ last_update: 3 });
    const small = await produce(inputAt(1, { time: 0, regulation: current }));
    const large = await produce(inputAt(1_000_000, { time: 0, regulation: current }));
    const smallValue = regulationValue(small);
    const largeValue = regulationValue(large);
    for (const key of ["energy", "stress", "arousal", "fatigue"]) {
      expect(largeValue[key]).toBe(smallValue[key]);
      expect(largeValue[key]).toBe(current[key as keyof RegulatoryStateV0]);
    }
    expect(largeValue["last_update"]).toBe(1_000_000);
    // Identity is O(1): large-elapsed result equals the elapsed=1 result apart
    // from bookkeeping (compared field-wise; produced values are deep-frozen).
    const baseline = regulationValue(small);
    for (const key of ["energy", "stress", "arousal", "fatigue"] as const) {
      expect(largeValue[key]).toBe(baseline[key]);
    }
  });

  // --- R7 boundary preservation ---------------------------------------------------
  it("R7: boundary values 0 / 1 / 0.5 and interior values preserved exactly", async () => {
    const cases: Array<Record<string, number>> = [
      { energy: 0, stress: 1, arousal: 0.5, fatigue: 0.123456789 },
      { energy: 1, stress: 0, arousal: 0.5, fatigue: 0.987654321 }
    ];
    for (const scalars of cases) {
      const delta = await produce(inputAt(33, { regulation: regulation(scalars) }));
      const value = regulationValue(delta);
      expect(value["energy"]).toBe(scalars["energy"]);
      expect(value["stress"]).toBe(scalars["stress"]);
      expect(value["arousal"]).toBe(scalars["arousal"]);
      expect(value["fatigue"]).toBe(scalars["fatigue"]);
    }
  });

  it("R7(-0): signed zero passes through byte-exactly (no invented normalization)", async () => {
    const delta = await produce(inputAt(4, { regulation: regulation({ fatigue: -0 }) }));
    expect(Object.is(regulationValue(delta)["fatigue"], -0)).toBe(true);
  });

  // --- R8 malformed intake fails closed --------------------------------------------
  it("R8: malformed scalars / shapes / elapsed ⇒ fail closed, no delta", async () => {
    const malformed: Array<RegulationProducerInputV0> = [
      inputAt(2, { regulation: regulation({ energy: Number.NaN }) }),
      inputAt(2, { regulation: regulation({ stress: Number.POSITIVE_INFINITY }) }),
      inputAt(2, { regulation: regulation({ arousal: 1.5 }) }),
      inputAt(2, { regulation: regulation({ fatigue: -0.5 }) }),
      inputAt(2, { regulation: regulation({ energy: "1" }) }),
      inputAt(2, { regulation: regulation({ last_update: -1 }) }),
      inputAt(2, { regulation: regulation({ last_update: Number.NaN }) }),
      inputAt(2, { regulation: regulation({ last_update: "0" }) }),
      inputAt(2, { regulation: regulation({ last_update: 1.5 }) }),
      { ...inputAt(2), regulation: undefined as unknown as RegulatoryStateV0 },
      inputAt(1.5),
      inputAt(-3),
      inputAt(Number.NaN),
      inputAt(Number.MAX_SAFE_INTEGER + 1),
      inputAt(2, { time: Number.NaN })
    ];
    for (const bad of malformed) {
      await expect(produce(bad)).rejects.toThrow(/reference regulation producer:/);
    }
  });

  it("R8/R6: logical-time overflow rejects through the canonical checked helper", async () => {
    await expect(
      produce(inputAt(16, { time: Number.MAX_SAFE_INTEGER }))
    ).rejects.toThrow(/canonical logical-time advance rejected/);
  });

  // --- R9 input immutability --------------------------------------------------------
  it("R9: input regulation bytes unchanged; deep-frozen input survives", async () => {
    const current = regulation({ last_update: 9 });
    const input = inputAt(9, { time: 100, regulation: current });
    const beforeBytes = JSON.stringify(current);
    Object.freeze(current);
    const delta = await produce(input);
    expect(JSON.stringify(current)).toBe(beforeBytes);
    expect(regulationValue(delta)["last_update"]).toBe(109);
  });

  // --- R10 least privilege ------------------------------------------------------------
  it("R10: intake surface carries only context / regulation / elapsed_ticks (no SubjectState)", () => {
    const input = inputAt(5);
    expect(Object.keys(input).sort()).toEqual(["context", "elapsed_ticks", "regulation"]);
    for (const forbidden of ["snapshot", "affect", "mood", "memory", "beliefs", "relationships", "traits", "identity"]) {
      expect(forbidden in input).toBe(false);
    }
    expect(Object.keys(input.context).sort()).toEqual([
      "current_logical_time",
      "state_revision",
      "subject_id"
    ]);
  });

  // --- R11 forbidden access ----------------------------------------------------------
  it("R11: zero wall-clock / randomness access on the happy path", async () => {
    const dateNow = Date.now;
    const mathRandom = Math.random;
    Date.now = (() => {
      throw new Error("wall clock accessed");
    }) as typeof Date.now;
    Math.random = () => {
      throw new Error("randomness accessed");
    };
    try {
      const delta = await produce(inputAt(5, { time: 7 }));
      expect(regulationValue(delta)["last_update"]).toBe(12);
    } finally {
      Date.now = dateNow;
      Math.random = mathRandom;
    }
  });

  // --- R15 ownership ------------------------------------------------------------------
  it("R15: delta operations contain ONLY /regulation (never /affect, /mood, anything else)", async () => {
    const delta = await produce(inputAt(3));
    expect(delta.operations.map((op) => op.path)).toEqual(["/regulation"]);
  });
});
