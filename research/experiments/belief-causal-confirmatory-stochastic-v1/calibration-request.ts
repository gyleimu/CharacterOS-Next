/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — frozen calibration request builder.
 *
 * Builds the ACTUAL model-facing calibration request through the SAME production
 * rendering path the confirmatory cells use, over a normal EMPTY-genesis
 * calibration subject. Deterministic by construction: the same inputs always
 * produce the same canonical bytes, and nothing host-side (trial id, timestamp,
 * run counter, prior output, filesystem path) can enter the provider-visible
 * body.
 *
 * The request therefore contains no trial identity: all 50 logical draws must be
 * byte-identical, which the calibration law enforces as a hard gate.
 */
import {
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository
} from "../../../packages/memory/dist/index.js";
import {
  materializeSubjectStateV4V0,
  validateSubjectState,
  type RepositoryRevisionBindingV1,
  type SubjectStateV0,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";

import { CALIBRATION_INPUT, CURRENT_SCENE, EXPERIMENT_ID, MODEL } from "./contract.ts";
import { hashJson, hashText } from "./histories.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { s0 } = await import(`${runtimeDist}transitions/observation/observation-fixtures.js`);
const { buildCognitiveContextProjection } = await import(
  `${runtimeDist}transitions/cognition-action/cognition-action-transition-executor.js`
);
const { buildConversationSubjectDataV4 } = await import(
  `${runtimeDist}providers/behavior/conversation-cognition-provider-v6.js`
);
const { CONVERSATION_COGNITION_SYSTEM_PROMPT_V8 } = await import(
  `${runtimeDist}providers/behavior/conversation-cognition-provider-v8.js`
);

export const CALIBRATION_NAMESPACE = CALIBRATION_INPUT.namespace;
export const CALIBRATION_SUBJECT_ID = CALIBRATION_INPUT.subject;

/** Canonical JSON: sorted keys, no whitespace — the ONLY serialization used for hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

/** The provider-visible request body. Host-side identity NEVER appears here. */
export interface CalibrationRequestBody {
  readonly model: string;
  readonly messages: readonly { readonly role: "system" | "user"; readonly content: string }[];
  readonly temperature: number;
  readonly max_tokens: number;
  readonly stream: boolean;
  readonly response_format: { readonly type: "json_object" };
}

export interface CalibrationRequest {
  readonly schema_version: "bcv1-calibration-request-v0";
  readonly experiment_id: string;
  readonly namespace: string;
  readonly subject_id: string;
  readonly body: CalibrationRequestBody;
  readonly hashes: {
    readonly system_hash: string;
    readonly user_hash: string;
    readonly schema_hash: string;
    readonly model_config_hash: string;
    readonly model_facing_request_hash: string;
  };
}

function seedStateForCalibration(repositoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as Record<string, unknown>;
  const raw = {
    ...base,
    identity: { ...(base["identity"] as Record<string, unknown>), subject_id: CALIBRATION_SUBJECT_ID },
    memory_state: {
      ...(base["memory_state"] as Record<string, unknown>),
      working_refs: [],
      repository_revision: repositoryRevision
    }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`calibration seed: ${checked.error.detail}`);
  if (checked.value.beliefs.items.length !== 0) {
    throw new Error("calibration subject must start from a normal EMPTY genesis");
  }
  return checked.value;
}

export interface CalibrationSubject {
  readonly subject_id: string;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly seed_belief_item_count: number;
  readonly genesis_envelope_hash: string;
  readonly snapshot_hash: string;
  /** The research-side view with the frozen observable context applied. */
  readonly view: SubjectStateV4;
}

/**
 * Builds the calibration subject's normal empty genesis on the real production
 * genesis path, then applies the SAME observable-context view the trial path
 * commits before cognition (scene text + task). Nothing is committed.
 */
export async function buildCalibrationSubject(): Promise<CalibrationSubject> {
  const repo = new InMemoryMemoryRepository();
  const prepared = await repo.prepareRevisionForIntent({
    intent_id: "intent-bcv1-calibration" as never,
    parent_revision: null as never,
    records: [] as never
  });
  const binding = {
    repository_revision: prepared.repository_revision,
    repository_revision_hash: await computeRepositoryRevisionHash(prepared.manifest)
  } as RepositoryRevisionBindingV1;
  if (!(await repo.validateRevisionBinding(binding as never))) {
    throw new Error("calibration repository binding invalid");
  }
  const seed = seedStateForCalibration(binding.repository_revision);
  const genesisResult = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: CALIBRATION_SUBJECT_ID, display_name: "", identity_anchors: [] },
      v3_source: seed,
      r0_binding: binding
    },
    r0_binding: binding,
    reference_validator: async (candidate: unknown) => JSON.stringify(candidate) === JSON.stringify(binding)
  } as never);
  if (!genesisResult.ok) throw new Error(`calibration genesis: ${genesisResult.code}: ${genesisResult.detail}`);
  const genesis = genesisResult.state as unknown as SubjectStateV4;
  if (genesis.beliefs.items.length !== 0) throw new Error("calibration genesis must be empty");

  // The trial path commits the observable context before cognition; the
  // calibration render applies the identical research-side view.
  const view = {
    ...genesis,
    context: {
      ...genesis.context,
      scene: `${CURRENT_SCENE.observed_utterance_prefix}${CURRENT_SCENE.text}"`,
      task: CURRENT_SCENE.task,
      current_observation_ref: `observation:o-${CURRENT_SCENE.source_event_id}` as never
    }
  } as unknown as SubjectStateV4;

  return {
    subject_id: CALIBRATION_SUBJECT_ID,
    state_revision: genesis.runtime_metadata.state_revision as number,
    repository_revision: genesis.memory_state.repository_revision as string,
    seed_belief_item_count: genesis.beliefs.items.length,
    genesis_envelope_hash: hashJson(genesisResult.envelope),
    snapshot_hash: hashJson(genesis),
    view
  };
}

/** The projection the production provider consumes (built by the frozen path). */
export async function buildCalibrationProjection(subject: CalibrationSubject): Promise<unknown> {
  return await buildCognitiveContextProjection(subject.view as never);
}

/**
 * The ACTUAL request body. Pure function of (frozen model config, rendered
 * system/user payloads); no host-side value can enter it.
 */
export function buildCalibrationRequestBody(input: {
  readonly system: string;
  readonly user: string;
}): CalibrationRequestBody {
  return {
    model: MODEL.id,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user }
    ],
    temperature: MODEL.temperature,
    max_tokens: MODEL.max_tokens,
    stream: MODEL.stream,
    response_format: { type: "json_object" }
  };
}

/**
 * THE authoritative serialization of the model-facing request: canonical JSON
 * (sorted keys at every level, no whitespace, UTF-8). Exactly ONE byte stream is
 * authoritative in this experiment — the one hashed here is the one the
 * transport puts on the wire, and a retry reuses that same string. A second
 * serialization (`JSON.stringify(body)`) would be a second request authority and
 * is therefore forbidden anywhere in the execution path.
 */
export function serializeAuthoritativeRequest(body: CalibrationRequestBody): string {
  return canonicalJson(body);
}

/** The request hash of an ALREADY serialized authoritative byte stream. */
export function authoritativeRequestHash(serializedBody: string): string {
  return hashText(serializedBody);
}

/**
 * MODEL_FACING_REQUEST_HASH scope (§9): exactly the provider-visible body —
 * model, both messages, temperature, max_tokens, stream and response_format.
 * Excluded by construction: credentials, HTTP headers, date/TLS, host-side trial
 * identity, filesystem paths and wall-clock values.
 */
export function modelFacingRequestHash(body: CalibrationRequestBody): string {
  return authoritativeRequestHash(serializeAuthoritativeRequest(body));
}

/** The frozen hash of this experiment's calibration request (bound in the manifest). */
export const FROZEN_CALIBRATION_REQUEST_HASH =
  "sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509" as const;

/** Builds the frozen calibration request (deterministic; call it as often as you like). */
export async function buildCalibrationRequest(input: {
  readonly schemaHash: string;
  readonly modelConfigHash: string;
  readonly subject?: CalibrationSubject;
}): Promise<CalibrationRequest> {
  const subject = input.subject ?? (await buildCalibrationSubject());
  const projection = await buildCalibrationProjection(subject);
  const user = buildConversationSubjectDataV4(projection as never);
  const system = CONVERSATION_COGNITION_SYSTEM_PROMPT_V8;
  const body = buildCalibrationRequestBody({ system, user });
  return {
    schema_version: "bcv1-calibration-request-v0",
    experiment_id: EXPERIMENT_ID,
    namespace: CALIBRATION_NAMESPACE,
    subject_id: subject.subject_id,
    body,
    hashes: {
      system_hash: hashText(system),
      user_hash: hashText(user),
      schema_hash: input.schemaHash,
      model_config_hash: input.modelConfigHash,
      model_facing_request_hash: modelFacingRequestHash(body)
    }
  };
}
