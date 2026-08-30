/**
 * Runtime-local routing point for the frozen episode member-set fingerprint
 * authority. Keeping one implementation prevents domain transitions from
 * drifting onto subtly different evidence identity algorithms.
 */
export { deriveEvidenceMemberSetFingerprint } from "./personality/personality-update-proposal.js";
