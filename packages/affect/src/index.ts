export type { AffectDelta, AffectProducer, MoodDelta } from "./types.js";

// --- CANONICAL_AFFECT_STATE_FOUNDATION_V0 — pure bounded-VA dynamics ------------

export {
  BOUNDED_AFFECT_DYNAMICS_V0,
  deriveAffectImpulseV0,
  applyAffectImpulseV0,
  advanceAffectTimeV0,
  createCanonicalAffectBaselineV0,
  AffectDynamicsContractErrorV0,
  type AffectImpulseInputV0,
  type AffectImpulseV0,
  type AffectDynamicsErrorCodeV0
} from "./bounded-affect-dynamics-v0.js";
