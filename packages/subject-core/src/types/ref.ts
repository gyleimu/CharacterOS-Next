/**
 * P2.1.1 — CanonicalRefV0 (types-only).
 * Source: docs/implementation/p2-1-contract-freeze.md §5.3.
 *
 * CanonicalRefV0 = `<kind>:<id>`; the exact regex and per-field kind allowlists are
 * validated by P2.1.2. Here we capture only the nominal shape.
 */

import type { Brand, IdentifierV0 } from "./scalars.js";

/** Opaque canonical reference value `kind:id` (§5.3). */
export type CanonicalRefV0 = Brand<string, "CanonicalRefV0">;

/** Raw reference `id` segment, `[A-Za-z0-9][A-Za-z0-9._~-]{0,127}` (§5.3). */
export type RefIdV0 = IdentifierV0;
