/**
 * P2.3.4.2b — ReferenceRegulationV0Producer: deterministic, parameter-free,
 * IDENTITY / STATE-PRESERVING reference RegulationProducerPort implementation
 * aligned to the COMMITTED REGULATION_V0 reference contract
 * (docs/implementation/p2-3-4-regulation-v0-reference-contract.md, commit 69505fa).
 *
 * STATUS — REFERENCE ENGINEERING BASELINE ONLY. REGULATION_V0 intentionally does
 * almost nothing: it is NOT psychological theory, NOT a homeostasis model, NOT
 * emotion regulation theory, NOT biologically plausible dynamics, NOT evidence
 * of realism, and NOT the final CharacterOS regulation mechanism. It exists so
 * the frozen TimeTransition pipeline operates against a deterministic Regulation
 * producer without inventing uncontracted psychological semantics.
 *
 * Exact state equation (contract §1/§6, normative for every positive-elapsed
 * TimeTransition):
 *
 *   energy_next  = energy_current        (byte-exact pass-through)
 *   stress_next  = stress_current        (byte-exact pass-through)
 *   arousal_next = arousal_current       (byte-exact pass-through)
 *   fatigue_next = fatigue_current       (byte-exact pass-through)
 *   last_update_next = logical_time_after
 *
 * Zero dynamics means zero dynamics (contract §10 / task §7): no recovery, no
 * decay, no gain, no threshold, no cooldown, no epsilon, no clamping toward a
 * target, no cross-field coupling, NO FAST_EMA parameter reuse (tHold/alpha/
 * tau/clamp are affect-owned and never consumed here).
 *
 * Least privilege (contract §4): intake is the closed {context, regulation,
 * elapsed_ticks} shape. Affect, Mood, Appraisal, Context state, MemoryState,
 * Retrieval, identity, traits, beliefs, relationships, LLM, wall clock and
 * randomness are never read; mechanism_config is never read (V0 is parameter-free).
 *
 * Time authority (contract §6): logical_time_after is derived ONLY through the
 * canonical subject-core helper `assertCheckedLogicalTimeAdvance` applied to the
 * authoritative `RuntimeContext.current_logical_time` — never Date.now, system
 * clock, timers or producer-local counters.
 *
 * Scope (contract §5): invoked only for positive-elapsed TimeTransition by the
 * executor's durable NO_OP rule; a direct invocation with elapsed_ticks === 0 is
 * a contract violation and fails closed.
 */

import {
  assertCheckedLogicalTimeAdvance,
  type DomainDeltaV0,
  type LogicalTimeV0,
  type RegulatoryStateV0
} from "@characteros-next/subject-core";
import type { RegulationProducerInputV0, RegulationProducerPort } from "../ports/regulation-producer-port.js";

// ---------------------------------------------------------------------------
// Fail-closed intake validation (contract §8): malformed input is rejected;
// valid canonical scalars are preserved byte-exactly (no normalization policy).
// ---------------------------------------------------------------------------

function failClosed(detail: string): never {
  throw new Error(`reference regulation producer: ${detail}`);
}

/** Frozen RegulatoryStateV0 constraints (freeze §6.3): finite [0,1] scalars. */
function requireUnitInterval(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    failClosed(`${label} must be a finite number in [0,1]`);
  }
}

function validateIntake(regulation: RegulatoryStateV0): void {
  if (regulation === null || typeof regulation !== "object") {
    failClosed("regulation must be an object");
  }
  requireUnitInterval(regulation.energy, "regulation.energy");
  requireUnitInterval(regulation.stress, "regulation.stress");
  requireUnitInterval(regulation.arousal, "regulation.arousal");
  requireUnitInterval(regulation.fatigue, "regulation.fatigue");
  const lastUpdate: unknown = regulation.last_update;
  if (
    lastUpdate !== null &&
    (typeof lastUpdate !== "number" || !Number.isSafeInteger(lastUpdate) || lastUpdate < 0)
  ) {
    failClosed("regulation.last_update must be null or a non-negative safe integer");
  }
}

/**
 * Canonical time derivation (contract §6): reuse the frozen subject-core checked
 * advance (safe-integer domain + overflow → INVALID_LOGICAL_TIME); the derived
 * value agrees exactly with the Time proposal's `logical_time_after`.
 */
function deriveLogicalTimeAfter(input: RegulationProducerInputV0): number {
  const before = input.context.current_logical_time;
  if (typeof before !== "number" || !Number.isFinite(before)) {
    failClosed("context.current_logical_time must be a canonical logical time");
  }
  const after = assertCheckedLogicalTimeAdvance(before as LogicalTimeV0, input.elapsed_ticks as LogicalTimeV0);
  if (!after.ok) {
    failClosed(
      `canonical logical-time advance rejected (${after.error.error_code}/${after.error.reason}): ${after.error.detail}`
    );
  }
  return after.value;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

// ---------------------------------------------------------------------------
// Reference producer (contract §5–§13).
// ---------------------------------------------------------------------------

/**
 * Deterministic identity-dynamics reference producer. Same (regulation,
 * elapsed_ticks, context) ⇒ byte-equivalent DomainDeltaV0; no randomness, no
 * clocks, no mutation of any input (the four scalars pass through untouched —
 * R7 boundary values `0`, `1`, `0.5` and arbitrary interior values survive
 * exactly; `-0` handling follows existing canonical numeric rules only).
 */
export class ReferenceRegulationV0Producer implements RegulationProducerPort {
  async produceRegulationDelta(input: RegulationProducerInputV0): Promise<DomainDeltaV0> {
    // ---- closed intake, fail-closed before any computation ---------------------
    const ticks = input.elapsed_ticks;
    if (typeof ticks !== "number" || !Number.isSafeInteger(ticks) || ticks < 0) {
      failClosed("elapsed_ticks must be a non-negative safe integer");
    }
    if (ticks === 0) {
      // Contract §5/§7 + TIME-NOOP-001: elapsed=0 routes to the durable NO_OP
      // path; reaching the producer with zero elapsed violates the contract.
      failClosed("elapsed_ticks=0 must never reach REGULATION_V0 (durable NO_OP path)");
    }
    if (input.regulation === undefined || input.regulation === null) {
      failClosed("regulation is required");
    }
    validateIntake(input.regulation);
    const current = input.regulation;

    // ---- exact state equation (identity) + canonical bookkeeping ----------------
    const logicalTimeAfter = deriveLogicalTimeAfter(input);
    const nextValue: RegulatoryStateV0 = {
      energy: current.energy,
      stress: current.stress,
      arousal: current.arousal,
      fatigue: current.fatigue,
      last_update: logicalTimeAfter as LogicalTimeV0
    };

    const delta = {
      producer: "regulation",
      domain: "regulation",
      expected_repository_revision: null,
      operations: [{ path: "/regulation", value: nextValue }],
      provenance_refs: []
    } as unknown as DomainDeltaV0;
    deepFreeze(delta);
    return delta;
  }
}

/** Factory alias (contract-adjacent naming): same reference producer. */
export function createReferenceRegulationV0Producer(): RegulationProducerPort {
  return new ReferenceRegulationV0Producer();
}
