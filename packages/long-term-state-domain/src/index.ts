/** Public entrypoint for the domain-neutral long-term-state boundary contract. */

export {
  LONG_TERM_STATE_DOMAIN_APPLICABILITY_SCHEMA_VERSION,
  LONG_TERM_STATE_DOMAINS_V0,
  canonicalizeLongTermStateDomainSetV0,
  validateLongTermStateDomainApplicabilityV0,
  validateLongTermStateDomainV0,
  validateLongTermStateTargetV0,
  type LongTermStateDomainApplicabilityV0,
  type LongTermStateDomainSetV0,
  type LongTermStateDomainV0,
  type LongTermStateTargetV0
} from "./long-term-state-domain.js";
