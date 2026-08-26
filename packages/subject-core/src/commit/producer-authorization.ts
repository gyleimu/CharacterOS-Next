/**
 * P2.3 Trust-Boundary Closure Round 2 (ATTACK D closure) — issuer-backed producer
 * authorization capability.
 * Source: docs/implementation/p2-1-contract-freeze.md §7.1, §13.4 layer 0.
 *
 * A ProducerAuthorizationSetV1 is a TRUSTED capability: §7.1 requires that only the
 * host composition can construct an instance. This module makes that rule real with
 * an issuer: `issue` mints a deeply frozen set and registers it; `verify` is a
 * verdict-only gate (minted membership + closed-structure re-check). A structurally
 * identical copy forged by a caller is NOT minted and therefore never verifies.
 */

import type { ProducerAuthorizationSetV1 } from "../types/transition.js";

export interface ProducerAuthorizationIssuer {
  /** Mint one trusted authorization set (deeply frozen and registered). */
  issue(bindings: ProducerAuthorizationSetV1["bindings"]): ProducerAuthorizationSetV1;
  /** Verdict-only: true ONLY for sets minted by this issuer and still well-formed. */
  verify(set: ProducerAuthorizationSetV1): boolean;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/** Closed-structure re-check (§7.1): schema version + {producer,domain} bindings. */
function structurallyValid(set: unknown): set is ProducerAuthorizationSetV1 {
  if (set === null || typeof set !== "object") return false;
  const candidate = set as Record<string, unknown>;
  if (candidate["schema_version"] !== "producer-authorization-set-v1") return false;
  const bindings = candidate["bindings"];
  if (!Array.isArray(bindings)) return false;
  for (const binding of bindings) {
    if (binding === null || typeof binding !== "object") return false;
    const entry = binding as Record<string, unknown>;
    if (typeof entry["producer"] !== "string" || entry["producer"].length === 0) return false;
    if (typeof entry["domain"] !== "string" || entry["domain"].length === 0) return false;
  }
  return true;
}

/**
 * Creates one trusted issuer. The minted registry is closure-private (WeakSet): no
 * read surface exists besides the boolean verdict, keeping the capability verdict-only.
 * Bindings must be unique and sorted by `(producer,domain)` exactly as §7.1 freezes.
 */
export function createProducerAuthorizationIssuer(): ProducerAuthorizationIssuer {
  const minted = new WeakSet<ProducerAuthorizationSetV1>();
  return {
    issue(bindings) {
      let previous: string | undefined;
      for (const binding of bindings) {
        const key = `${binding.producer}|${binding.domain}`;
        if (previous !== undefined && !(key > previous)) {
          throw new Error(
            `producer authorization bindings must be unique and sorted by (producer,domain) (${previous} -> ${key})`
          );
        }
        previous = key;
      }
      const set: ProducerAuthorizationSetV1 = {
        schema_version: "producer-authorization-set-v1",
        bindings: bindings.map((binding) => ({
          producer: binding.producer,
          domain: binding.domain
        }))
      };
      deepFreeze(set);
      minted.add(set);
      return set;
    },
    verify(set) {
      return minted.has(set) && structurallyValid(set);
    }
  };
}
