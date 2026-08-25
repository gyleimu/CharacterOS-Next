/**
 * P2.1.1 — Canonical scalar types (types-only; no runtime logic).
 *
 * Single source of truth: docs/implementation/p2-1-contract-freeze.md (§2 frozen names,
 * §5.2 scalars, §5.3 ref grammar). Values in this module are opaque brand tags; their
 * lexical/range invariants are documented here and will be enforced by the P2.1.2
 * validation layer, not by runtime code in this package.
 */

declare const brand: unique symbol;

import type { RequirementId } from "./enums.js";

/** Nominal brand wrapper. `Brand<T, N>` is `T` structurally, distinguished nominally by `N`. */
export type Brand<T, N extends string> = T & { readonly [brand]: N };

/** ASCII identifier `^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$` (contract §5.2). Opaque. */
export type IdentifierV0 = Brand<string, "IdentifierV0">;

/** Globally unique opaque transition id (§5.2). No semantic parsing permitted. */
export type TransitionIdV0 = Brand<string, "TransitionIdV0">;

/** Safe integer `0..9007199254740991` (§5.2). */
export type LogicalTimeV0 = Brand<number, "LogicalTimeV0">;

/** Safe integer `0..9007199254740991` (§5.2). */
export type StateRevisionV0 = Brand<number, "StateRevisionV0">;

/** Safe integer `0..9007199254740991` (§5.2); journal-local history/lifecycle sequence. */
export type HistorySequenceV0 = Brand<number, "HistorySequenceV0">;

/** Finite IEEE-754 number in `[0,1]` (§5.2). */
export type UnitIntervalV0 = Brand<number, "UnitIntervalV0">;

/** Wire hash `sha256:` + 64 lowercase hex (§8.1). Composed: `sha256:[0-9a-f]{64}`. */
export type HashV1 = Brand<string, "HashV1">;

/** Immutable repository revision identifier (§5.2); verified through ReferenceValidator. */
export type RepositoryRevisionIdV0 = Brand<string, "RepositoryRevisionIdV0">;

/** One of the 49 frozen requirement leaf literals (§3). Owning-domain "reason" payload. */
export type RequirementIdV1 = RequirementId;

/** Deterministic content-addressed ref value (§14.4), e.g. `commit:<hex>` / `trace:<hex>`. */
export type ResultRefV0 = Brand<string, "ResultRefV0">;
