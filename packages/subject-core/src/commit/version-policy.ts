/**
 * Production commit-version policy V0 — CharacterOS-owned, source-controlled,
 * FORWARD-ONLY (ATOMIC_COMMIT_BUNDLE_V2_PRODUCTION_EMISSION_V0).
 *
 * Post-cutover production law:
 *   - EVERY new successful production canonical commit targets
 *     `atomic-commit-v2` (new subjects, legacy V1-only subjects, existing V2
 *     subjects alike).
 *   - NO production V1 fallback: a failed V2 assembly/validation fails closed;
 *     the engine never retries as V1 or chooses V1 because the predecessor
 *     was V1.
 *   - Already-committed replay returns the ORIGINAL stored bundle byte-for-byte
 *     (V1 stays V1, V2 stays V2) — replay never reassembles or upgrades.
 *
 * There is deliberately NO public setter, no environment variable, no config
 * file, no feature flag, and no caller input that can select the commit
 * version: CALLER_CAN_SELECT_ATOMIC_COMMIT_VERSION = NO,
 * PUBLIC_COMMIT_VERSION_SELECTOR_API = NONE,
 * EXTERNAL_MUTABLE_V1_V2_FEATURE_FLAG_ALLOWED = NO.
 *
 * Cutover is a DEPLOYMENT PRECONDITION, not canonical state:
 * V2_PRODUCTION_CUTOVER_QUIESCENCE_REQUIRED = YES. Operational sequence:
 * stop new admission → quiesce V1-only writer processes → let active CAS paths
 * complete/terminate → reconcile OUTCOME_UNKNOWN → prevent old-writer restart →
 * activate the V2 writer. After the first V2 commit, a V1-only writer process
 * is forbidden (software rollback past the cutover emits nothing).
 * Level-2 operational safety only — no cryptographic/Level-3 claims.
 */

import type { AtomicCommitBundleVersionV0 } from "../types/persistence-v2.js";

/** The exact version every new successful production commit targets. */
export const PRODUCTION_COMMIT_TARGET_VERSION_V0 = "atomic-commit-v2" as const;

/** Deployment precondition freeze: cutover requires operator quiescence. */
export const V2_PRODUCTION_CUTOVER_QUIESCENCE_REQUIRED_V0 = "YES" as const;

/** Post-cutover production version policy. */
export const POST_CUTOVER_PRODUCTION_VERSION_POLICY_V0 = "V2_ONLY" as const;

/**
 * Internal production selector. Frozen constant — no caller input, no
 * environment, no wall clock. Not a product-facing "choose version" API.
 */
export function productionCommitTargetVersionV0(): Extract<
  AtomicCommitBundleVersionV0,
  "atomic-commit-v2"
> {
  return PRODUCTION_COMMIT_TARGET_VERSION_V0;
}
