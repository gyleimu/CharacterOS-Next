/**
 * @characteros-next/personality — PersonalityPlasticityProducerV0: deterministic
 * evidence → bounded PersonalityUpdateProposalV0. Pure producer: no canonical
 * mutation, no automatic evidence selection, no semantic direction inference,
 * no LLM, no network, no wall clock. Canonical authority stays with SubjectCore
 * (frozen PersonalityTransitionExecutor).
 */

export {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  proposePersonalityPlasticityV0,
  validatePersonalityPlasticityPolicy,
  type PersonalityPlasticityContextV0,
  type PersonalityPlasticityDirectionV0,
  type PersonalityPlasticityPolicyV0,
  type PersonalityPlasticityResultV0,
  type PersonalityPlasticityTargetV0
} from "./personality-plasticity-producer.js";
