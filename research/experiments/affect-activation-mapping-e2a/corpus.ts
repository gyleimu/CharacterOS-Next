/**
 * ACTIVATION_MAPPING_ABLATION_E2A — frozen E2 generator reuse (§5/§43).
 * The E2 generator, family specs and corpus fixtures are imported — never
 * copied or reimplemented. E2A fingerprints the exact E2 source in the
 * manifest (no silent dependency drift).
 */

import { FAMILIES } from "../affect-production-shaped-e2/contract.ts";
import { buildFamilyCorpus, type FamilyCorpusE2 } from "../affect-production-shaped-e2/generator.ts";

export { buildFamilyCorpus };
export type { FamilyCorpusE2 };
export const FAMILIES_EXPORT = FAMILIES;
