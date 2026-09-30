/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * D1 Phase A — lawful counterfactual state construction. RESEARCH-ONLY, ZERO model calls.
 *
 * Route (frozen in REVISION 2, unchanged):
 *   createInteractiveSubjectSeedV0(...)      the PRODUCT's own subject-creation entry point
 *     -> author ONLY `beliefs`               the treatment; nothing else is touched
 *     -> materializeSubjectStateV4V0(...)    production genesis authoring + validation
 *     -> buildCognitiveContextProjectionV2ForExplicitV4(...)   the production projection
 *     -> the production V8 renderers         the production messages
 *
 * Forbidden and not used: the unexported test fixture `s0()`, hand-written SubjectStateV4, JSON
 * patching, unsafe mutation, and the belief-plasticity path (evidence-driven, which would make the
 * manipulation a lived-history formation rather than a lawful counterfactual).
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1, SubjectStateV0, SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import {
  BELIEF_STATE_SCHEMA_VERSION,
  deriveBeliefPropositionId,
  materializeSubjectStateV4V0
} from "../../../packages/subject-core/dist/index.js";
import {
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository
} from "../../../packages/memory/dist/index.js";
import { createInteractiveSubjectSeedV0 } from "../../../packages/runtime/dist/index.js";
import { deriveBeliefPropositionKeyV0 } from "../../../packages/runtime/dist/transitions/belief/belief-proposition-admission.js";
import { buildCognitiveContextProjectionV2ForExplicitV4 } from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import {
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D1_HASH_PROJECTION_V0, D1_PROPOSITION_LABEL, D1_STATE_LEVELS } from "./contract.ts";

export const D1_PRODUCTION_SEED_FUNCTION = "createInteractiveSubjectSeedV0" as const;
export const D1_PRODUCTION_MATERIALIZER = "materializeSubjectStateV4V0" as const;
export const D1_PRODUCTION_PROJECTION_BUILDER = "buildCognitiveContextProjectionV2ForExplicitV4" as const;

export interface D1BaseSubjectV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly identity_anchors: readonly string[];
  readonly personality_genesis_prior: null;
  readonly production_seed_function: typeof D1_PRODUCTION_SEED_FUNCTION;
  readonly production_materializer: typeof D1_PRODUCTION_MATERIALIZER;
  /** Hash of the production seed with an EMPTY belief container: the logical base of all levels. */
  readonly base_seed_hash_before_belief_authoring: HashV1;
}

async function freshR0Binding(): Promise<{ revision: "R0"; hash: string }> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  const manifest = await repo.readManifest("R0" as never);
  if (manifest === null) throw new Error("D1_PHASE_A: R0 manifest must exist");
  return { revision: "R0", hash: await computeRepositoryRevisionHash(manifest) };
}

/** Builds the production base subject via the product's own entry point. */
export async function createBaseSubjectV0(input: {
  readonly subject_id: string;
  readonly display_name: string;
  readonly identity_anchors: readonly string[];
}): Promise<{ readonly base: D1BaseSubjectV0; readonly seed: SubjectStateV0 }> {
  const productionSeed = createInteractiveSubjectSeedV0(
    input.subject_id,
    input.display_name,
    input.identity_anchors
  );
  // The ONLY authored field is the belief container; everything else is production-authored.
  const emptied: SubjectStateV0 = {
    ...productionSeed,
    beliefs: { schema_version: BELIEF_STATE_SCHEMA_VERSION, items: [] }
  } as unknown as SubjectStateV0;
  const base: D1BaseSubjectV0 = Object.freeze({
    subject_id: input.subject_id,
    display_name: input.display_name,
    identity_anchors: [...input.identity_anchors],
    personality_genesis_prior: null as null,
    production_seed_function: D1_PRODUCTION_SEED_FUNCTION,
    production_materializer: D1_PRODUCTION_MATERIALIZER,
    base_seed_hash_before_belief_authoring: await hashEnvelope(D1_HASH_PROJECTION_V0, {
      base_seed: emptied
    })
  });
  return { base, seed: emptied };
}

export interface D1PropositionV0 {
  readonly canonical_label: string;
  readonly proposition_id: string;
  readonly derivation: "deriveBeliefPropositionId";
  readonly canonical_label_hash: HashV1;
}

/** Derives the proposition identity with the PRODUCTION derivation. Never hand-written. */
export async function derivePropositionV0(subjectId: string): Promise<D1PropositionV0> {
  const canonicalLabel = D1_PROPOSITION_LABEL;
  // Production derivation chain, exactly as the admission authority does it:
  //   proposition_key = hashEnvelope(BELIEF_PROPOSITION_KEY_PROJECTION, { canonical_label })
  //   proposition_id  = deriveBeliefPropositionId(subjectId, proposition_key)
  // NOTE: the identity is SUBJECT-SCOPED, so HIGH / LOW / NEUTRAL share one proposition_id —
  // which is exactly what the isolation proof requires.
  const propositionKey = await deriveBeliefPropositionKeyV0(canonicalLabel);
  const propositionId = await deriveBeliefPropositionId(
    subjectId as never,
    propositionKey as never
  );
  return Object.freeze({
    canonical_label: canonicalLabel,
    proposition_id: propositionId,
    derivation: "deriveBeliefPropositionId" as const,
    canonical_label_hash: await hashEnvelope(D1_HASH_PROJECTION_V0, {
      canonical_label: canonicalLabel
    })
  });
}

export interface D1StateV0 {
  readonly level: "HIGH" | "LOW" | "NEUTRAL";
  readonly credence: number;
  readonly stance: number;
  readonly subject_id: string;
  readonly state: SubjectStateV4;
  readonly state_hash: HashV1;
}

/** Materialises one level from the SAME base seed, differing only in the belief credence. */
export async function materializeLevelV0(input: {
  readonly baseSeed: SubjectStateV0;
  readonly proposition: D1PropositionV0;
  readonly level: "HIGH" | "LOW" | "NEUTRAL";
}): Promise<D1StateV0> {
  const credence =
    input.level === "HIGH"
      ? D1_STATE_LEVELS.HIGH
      : input.level === "LOW"
        ? D1_STATE_LEVELS.LOW
        : D1_STATE_LEVELS.NEUTRAL_NOISE_CALIBRATION;
  const r0 = await freshR0Binding();
  const r0Binding = {
    repository_revision: r0.revision as never,
    repository_revision_hash: r0.hash as never
  };
  const authored: SubjectStateV0 = {
    ...input.baseSeed,
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: [
        {
          proposition_id: input.proposition.proposition_id as never,
          proposition_label: input.proposition.canonical_label,
          credence: credence as never
        }
      ]
    }
  } as unknown as SubjectStateV0;

  const result = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: {
        subject_id: input.baseSeed.identity.subject_id,
        display_name: input.baseSeed.identity.display_name,
        identity_anchors: [...input.baseSeed.identity.identity_anchors]
      },
      v3_source: authored,
      r0_binding: r0Binding
    },
    r0_binding: r0Binding,
    reference_validator: async (binding: unknown) =>
      JSON.stringify(binding) === JSON.stringify(r0Binding)
  } as never);
  if (!result.ok) {
    throw new Error(`D1_PHASE_A_MATERIALIZATION_FAILED: ${result.code}: ${result.detail}`);
  }
  return Object.freeze({
    level: input.level,
    credence,
    stance: 2 * credence - 1,
    subject_id: result.state.identity.subject_id,
    state: result.state,
    state_hash: await hashEnvelope(D1_HASH_PROJECTION_V0, { state: result.state })
  });
}

/** The production V2 projection, carrying the belief line. */
export async function buildProjectionV0(state: SubjectStateV4): Promise<unknown> {
  return await buildCognitiveContextProjectionV2ForExplicitV4(state);
}

export interface D1RenderedRequestV0 {
  readonly request: ModelTransportRequestV0;
  readonly user_content: string;
  readonly request_hash: HashV1;
  readonly stripped_hash: HashV1;
}

const BELIEF_HEADER = "[SUBJECTIVE BELIEF STANCES";
const MEMORY_MEMORY_MARKER = "[PRIOR FACTUAL MEMORY";

/** Removes the belief block (header, count line, and every item line) from rendered user content. */
export function stripBeliefBlockV0(userContent: string): string {
  const lines = userContent.split("\n");
  const start = lines.findIndex((line) => line.startsWith(BELIEF_HEADER));
  if (start < 0) throw new Error("D1_PHASE_A: belief header not found in rendered content");
  let end = start + 1;
  while (end < lines.length && !(lines[end] ?? "").startsWith("[")) end += 1;
  return [...lines.slice(0, start), ...lines.slice(end)].join("\n");
}

export function beliefBlockOfV0(userContent: string): string {
  const lines = userContent.split("\n");
  const start = lines.findIndex((line) => line.startsWith(BELIEF_HEADER));
  if (start < 0) throw new Error("D1_PHASE_A: belief header not found in rendered content");
  let end = start + 1;
  while (end < lines.length && !(lines[end] ?? "").startsWith("[")) end += 1;
  return lines.slice(start, end).join("\n");
}

/** Builds the probe request for a state: production messages + the frozen D1 contract. */
export async function buildD1RequestV0(input: {
  readonly state: SubjectStateV4;
  readonly contract: string;
  readonly schema: Readonly<Record<string, unknown>>;
}): Promise<D1RenderedRequestV0> {
  const projection = await buildProjectionV0(input.state);
  const messages = Object.freeze([
    Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(projection) }),
    Object.freeze({
      role: "user" as const,
      content: `${cognitionUserContentForV8(projection, {})}${input.contract}`
    })
  ]);
  const request = Object.freeze({
    messages,
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: input.schema })
  }) as unknown as ModelTransportRequestV0;
  const userContent = messages[1]?.content ?? "";
  return Object.freeze({
    request,
    user_content: userContent,
    request_hash: await hashEnvelope("characteros-next/research/decision-probe/request/v0", request as unknown),
    stripped_hash: await hashEnvelope(D1_HASH_PROJECTION_V0, {
      stripped: stripBeliefBlockV0(userContent)
    })
  });
}

export { MEMORY_MEMORY_MARKER as D1_PRIOR_MEMORY_MARKER };
