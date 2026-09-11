/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — minimal durable adaptation
 * ledger.
 *
 * Write-once records keyed by (subject, canonical evidence-set fingerprint):
 * replaying the same canonical evidence can never apply a second Personality
 * step. This is deliberately NOT a general workflow framework — it stores only
 * the terminal disposition of one evidence set.
 */

export const PERSONALITY_ADAPTATION_STORE_SCHEMA_VERSION =
  "personality-adaptation-store-v0" as const;

export const PERSONALITY_ADAPTATION_TERMINALS_V0 = Object.freeze([
  "ABSTAIN",
  "NOT_ELIGIBLE",
  "NO_CHANGE",
  "COMMITTED",
  "ALREADY_COMMITTED"
] as const);

export type PersonalityAdaptationTerminalV0 = (typeof PERSONALITY_ADAPTATION_TERMINALS_V0)[number];

export interface PersonalityAdaptationRecordV0 {
  readonly evidence_key: string;
  readonly subject_id: string;
  readonly evidence_episode_refs: readonly string[];
  readonly terminal: PersonalityAdaptationTerminalV0;
  readonly channel_id: string | null;
  readonly dimension_id: string | null;
  readonly direction: string | null;
  readonly prior_value: number | null;
  readonly next_value: number | null;
  readonly member_count: number | null;
  readonly total_activation: number | null;
  readonly mean_activation: number | null;
  readonly transition_ref: string | null;
}

export interface PersonalityAdaptationStoreStateV0 {
  readonly schema_version: typeof PERSONALITY_ADAPTATION_STORE_SCHEMA_VERSION;
  readonly records: readonly PersonalityAdaptationRecordV0[];
}

const STATE_KEYS: readonly string[] = ["schema_version", "records"];
const RECORD_KEYS: readonly string[] = [
  "evidence_key",
  "subject_id",
  "evidence_episode_refs",
  "terminal",
  "channel_id",
  "dimension_id",
  "direction",
  "prior_value",
  "next_value",
  "member_count",
  "total_activation",
  "mean_activation",
  "transition_ref"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function validateRecordV0(value: unknown): PersonalityAdaptationRecordV0 | null {
  if (!isRecord(value)) return null;
  for (const key of Object.keys(value)) {
    if (!RECORD_KEYS.includes(key)) return null;
  }
  const terminal = value["terminal"];
  if (
    typeof value["evidence_key"] !== "string" ||
    typeof value["subject_id"] !== "string" ||
    !Array.isArray(value["evidence_episode_refs"]) ||
    value["evidence_episode_refs"].some((ref) => typeof ref !== "string") ||
    typeof terminal !== "string" ||
    !PERSONALITY_ADAPTATION_TERMINALS_V0.includes(terminal as PersonalityAdaptationTerminalV0) ||
    !nullableString(value["channel_id"]) ||
    !nullableString(value["dimension_id"]) ||
    !nullableString(value["direction"]) ||
    !nullableNumber(value["prior_value"]) ||
    !nullableNumber(value["next_value"]) ||
    !nullableNumber(value["member_count"]) ||
    !nullableNumber(value["total_activation"]) ||
    !nullableNumber(value["mean_activation"]) ||
    !nullableString(value["transition_ref"])
  ) {
    return null;
  }
  return {
    evidence_key: value["evidence_key"],
    subject_id: value["subject_id"],
    evidence_episode_refs: [...(value["evidence_episode_refs"] as string[])],
    terminal: terminal as PersonalityAdaptationTerminalV0,
    channel_id: value["channel_id"] as string | null,
    dimension_id: value["dimension_id"] as string | null,
    direction: value["direction"] as string | null,
    prior_value: value["prior_value"] as number | null,
    next_value: value["next_value"] as number | null,
    member_count: value["member_count"] as number | null,
    total_activation: value["total_activation"] as number | null,
    mean_activation: value["mean_activation"] as number | null,
    transition_ref: value["transition_ref"] as string | null
  };
}

/**
 * In-memory write-once ledger. Serialized with the session durable state so a
 * restart cannot replay an already-consumed evidence set.
 */
export class InMemoryPersonalityAdaptationStoreV0 {
  private readonly records = new Map<string, PersonalityAdaptationRecordV0>();

  has(evidenceKey: string): boolean {
    return this.records.has(evidenceKey);
  }

  get(evidenceKey: string): PersonalityAdaptationRecordV0 | null {
    return this.records.get(evidenceKey) ?? null;
  }

  /**
   * Every episode ref already offered for this subject, raw-ASCII ascending.
   * Lets the wiring accumulate a coherent lived-evidence window across turns so
   * the frozen eligibility thresholds can be reached by genuinely distinct
   * committed experiences rather than by duplicating one.
   */
  evidenceRefsForSubject(subjectId: string): string[] {
    const refs = new Set<string>();
    for (const record of this.records.values()) {
      if (record.subject_id !== subjectId) continue;
      for (const ref of record.evidence_episode_refs) refs.add(ref);
    }
    return [...refs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  /** Write-once: an existing key is never overwritten. */
  record(record: PersonalityAdaptationRecordV0): void {
    if (!this.records.has(record.evidence_key)) {
      this.records.set(record.evidence_key, record);
    }
  }

  exportState(): PersonalityAdaptationStoreStateV0 {
    return {
      schema_version: PERSONALITY_ADAPTATION_STORE_SCHEMA_VERSION,
      records: [...this.records.values()]
    };
  }

  async restoreState(
    state: unknown
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly detail: string }> {
    if (state === null || state === undefined) return { ok: true };
    if (!isRecord(state)) return { ok: false, detail: "personality adaptation store state: expected object" };
    for (const key of Object.keys(state)) {
      if (!STATE_KEYS.includes(key)) return { ok: false, detail: `store state.${key}: unknown key` };
    }
    if (state["schema_version"] !== PERSONALITY_ADAPTATION_STORE_SCHEMA_VERSION) {
      return { ok: false, detail: "personality adaptation store state: invalid schema_version" };
    }
    const recordsRaw = state["records"];
    if (!Array.isArray(recordsRaw)) return { ok: false, detail: "store state.records: expected array" };
    const restored = new Map<string, PersonalityAdaptationRecordV0>();
    for (let index = 0; index < recordsRaw.length; index++) {
      const checked = validateRecordV0(recordsRaw[index]);
      if (checked === null) return { ok: false, detail: `store state.records[${index}]: invalid record` };
      if (restored.has(checked.evidence_key)) {
        return { ok: false, detail: `store state.records[${index}]: duplicate evidence_key` };
      }
      restored.set(checked.evidence_key, checked);
    }
    this.records.clear();
    for (const [key, record] of restored) this.records.set(key, record);
    return { ok: true };
  }
}
