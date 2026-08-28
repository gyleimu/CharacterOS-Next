/**
 * @characteros-next/memory-influence — read-only, domain-neutral influence
 * projection over immutable episodic memory records. Pure infrastructure:
 * no canonical writes, no LLM, no wall clock, no legacy galaxy mechanics.
 */

export {
  ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY,
  MEMORY_INFLUENCE_POLICY_SCHEMA_VERSION,
  validateMemoryInfluencePolicy,
  type MemoryInfluencePolicyV0
} from "./memory-influence-policy.js";

export {
  logicalDecayFactor,
  MemoryInfluenceProjectionErrorV0,
  projectMemoryInfluence,
  projectMemoryInfluences,
  type MemoryInfluenceProjectionV0
} from "./memory-influence-projection.js";
