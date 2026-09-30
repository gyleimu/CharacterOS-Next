/**
 * HISTORY_INTERNALIZATION_V1 — PHASE 0 PRE-TEST STATE GATE (zero model calls, read-only).
 *
 *   node research/experiments/history-internalization-v1/pre-test-gate.ts [--root <subject-dir>] [--out <file>]
 *
 * Implements §7 of `research/north-star/HISTORY_INTERNALIZATION_TEST_V1_DESIGN.md`:
 *
 *   > **State-distance gate.** ... The test phase may run only if `δ_state ≥ δ_min` for the declared
 *   > target dimension AND no target dimension is at a bound. If the gate fails, the run is recorded as
 *   > `INCONCLUSIVE_BY_SATURATION` — a statement about the trajectory design, **not** evidence against H1.
 *
 * and its per-dimension non-degeneracy table:
 *
 *   Belief        `0 < credence < 1` for at least one item, else INCONCLUSIVE_BY_SATURATION
 *   Relationship  below the 32/32 cap
 *   Affect        activation **not pinned at 1.0**
 *   Memory        reported, not gated
 *   Personality   reported as an ABSENCE, never as a null result
 *   Regulation    recorded to document that it is inert
 *
 * WHY THIS RUNS FIRST, AND WHY IT IS CHEAP: §7 also says "All state reads are read-only projections over
 * an exact historical revision ... Zero model calls." So the gate is not a stage that competes with the
 * test phase for budget — it is a pre-condition that can be published before anything is spent. §7 calls
 * it "a design requirement, not an optional check", and the design doc's Phase-0 honesty clause says the
 * state-distance result "must be published FIRST".
 *
 * READ-ONLY BY CONSTRUCTION, following `scripts/long-run-inspect.mjs`:
 *   - a short-lived process that reads and parses one snapshot and exits;
 *   - it writes NO subject state, performs NO model call, and mutates nothing;
 *   - the ONLY write is the metrics file named by --out.
 *
 * WHAT IT REPORTS AND WHAT IT CANNOT YET REPORT, stated rather than hidden: the canonical AFFECT and
 * REGULATION values are read from the snapshot's durable identity at the head revision, which is
 * authoritative and needs no restore. BELIEF and RELATIONSHIP live inside the committed canonical store
 * and §7 requires them through the production read-only projection (`refsBelongToRevision` authority
 * passthrough) rather than by inspecting JSON. This program therefore reports them as
 * `REQUIRES_PRODUCTION_READ_PROJECTION` and does NOT guess a value — a guessed gate input would be worse
 * than an absent one.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------------------------
// The frozen §7 non-degeneracy rules, as code.
// ---------------------------------------------------------------------------------------------

export type GateOutcomeV0 = "GATE_PASS" | "INCONCLUSIVE_BY_SATURATION" | "GATE_INCOMPLETE";

export interface DimensionReadingV0 {
  readonly dimension: string;
  readonly value: unknown;
  readonly rule: string;
  /** true = non-degenerate, false = at a bound, null = not readable by this path. */
  readonly passes: boolean | null;
  readonly note: string;
}

/** §7 Affect: activation must NOT be pinned at 1.0. */
export function affectNonDegenerateV0(reading: { readonly activation: unknown; readonly valence: unknown }): boolean | null {
  if (typeof reading.activation !== "number" || typeof reading.valence !== "number") return null;
  return reading.activation !== 1;
}

/** §7 Belief: `0 < credence < 1` for AT LEAST ONE item. Absent/empty is not a pass. */
export function beliefNonDegenerateV0(items: readonly { readonly credence: unknown }[] | null): boolean | null {
  if (items === null) return null;
  if (items.length === 0) return false;
  return items.some((item) => typeof item.credence === "number" && item.credence > 0 && item.credence < 1);
}

/** §7 Relationship: below the 32/32 cap. */
export function relationshipNonDegenerateV0(
  counterparts: readonly { readonly familiarity_credits: unknown }[] | null
): boolean | null {
  if (counterparts === null) return null;
  if (counterparts.length === 0) return false;
  return counterparts.some((entry) => typeof entry.familiarity_credits === "number" && entry.familiarity_credits < 32);
}

/**
 * §7 is a conjunction: the test phase may run only if every gated dimension is non-degenerate AND
 * `δ_state >= δ_min`. A `null` (unreadable) dimension makes the gate INCOMPLETE — never a pass.
 */
export function decidePreTestGateV0(input: {
  readonly dimensions: readonly DimensionReadingV0[];
  readonly delta_state: number | null;
  readonly delta_min: number | null;
}): { readonly outcome: GateOutcomeV0; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  const atBound = input.dimensions.filter((dimension) => dimension.passes === false);
  const unreadable = input.dimensions.filter((dimension) => dimension.passes === null);
  for (const dimension of atBound) reasons.push(`${dimension.dimension} IS AT A BOUND: ${dimension.note}`);
  for (const dimension of unreadable) reasons.push(`${dimension.dimension} NOT READABLE by this path: ${dimension.note}`);
  if (input.delta_state === null || input.delta_min === null) {
    reasons.push("δ_state / δ_min not yet declared or not yet measurable (needs the declared twin construction)");
  } else if (input.delta_state < input.delta_min) {
    reasons.push(`δ_state ${String(input.delta_state)} < δ_min ${String(input.delta_min)}`);
  }
  if (atBound.length > 0) return { outcome: "INCONCLUSIVE_BY_SATURATION", reasons };
  if (unreadable.length > 0 || input.delta_state === null || input.delta_min === null) {
    return { outcome: "GATE_INCOMPLETE", reasons };
  }
  return { outcome: "GATE_PASS", reasons };
}

// ---------------------------------------------------------------------------------------------
// Read-only measurement
// ---------------------------------------------------------------------------------------------

const argV0 = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? (process.argv[index + 1] as string) : fallback;
};

const root = resolve(argV0("root", "product/sandbox/.data/subjects/alice-longrun"));
const out = resolve(argV0("out", "research/experiments/history-internalization-v1/evidence/pre-test-gate.json"));

const names = readdirSync(root);
const snapshotName = names.find((name) => name.endsWith(".snapshot.json"));
if (snapshotName === undefined) {
  console.error("pre-test-gate: no snapshot found in", root);
  process.exit(2);
}
const snapshotPath = join(root, snapshotName);
const text = readFileSync(snapshotPath, "utf8");
const snapshot = JSON.parse(text) as {
  subject_id?: unknown;
  next_turn_index?: unknown;
  durable?: { identity?: Record<string, unknown> };
};

const identity = snapshot.durable?.identity ?? {};
const affect = (identity["affect"] ?? null) as { valence?: unknown; activation?: unknown } | null;

// §7 Regulation: recorded to document that it is inert. Read from the canonical state if present.
const regulation = (identity["regulation"] ?? null) as Record<string, unknown> | null;

// §7 Affect is ALSO visible in the affect-application history; the design doc cites the audit's
// "19/19 and 50/50 end-of-turn readings at exactly 1.000". Counted here so the same fact is re-measured
// on the current snapshot rather than quoted from the audit.
const applicationPattern =
  /"transition_type":\s*"AffectApplication",[\s\S]{0,3000}?"path":\s*"\/affect",\s*"value":\s*\{\s*"schema_version":\s*"canonical-affect-v0",\s*"valence":\s*(-?[0-9.]+),\s*"activation":\s*(-?[0-9.]+)/g;
let applications = 0;
let atBound = 0;
for (const match of text.matchAll(applicationPattern)) {
  applications += 1;
  if (Number(match[2]) >= 1) atBound += 1;
}

const dimensions: DimensionReadingV0[] = [
  {
    dimension: "affect",
    value: affect,
    rule: "§7: activation NOT pinned at 1.0",
    passes: affect === null ? null : affectNonDegenerateV0({ activation: affect.activation, valence: affect.valence }),
    note:
      affect === null
        ? "no canonical affect at the head revision"
        : `activation=${String(affect.activation)} valence=${String(affect.valence)}`
  },
  {
    dimension: "belief",
    value: null,
    rule: "§7: 0 < credence < 1 for at least one item",
    passes: null,
    note: "REQUIRES_PRODUCTION_READ_PROJECTION — belief lives in the committed canonical store; §7 requires the refsBelongToRevision read path, and this program refuses to guess"
  },
  {
    dimension: "relationship",
    value: null,
    rule: "§7: below the 32/32 cap",
    passes: null,
    note: "REQUIRES_PRODUCTION_READ_PROJECTION — same reason as belief"
  },
  {
    dimension: "regulation",
    value: regulation,
    rule: "§7: recorded to document that it is inert (NOT gated)",
    passes: true,
    note:
      regulation === null
        ? "the durable identity carries no regulation block; §7 does not gate regulation, so this does not affect the outcome"
        : `recorded, not gated: ${JSON.stringify(regulation)}`
  },
  {
    dimension: "personality",
    value: "NONE",
    rule: "§7: reported as an absence, never as a null result",
    passes: true,
    note: "disabled by construction — reported as an absence"
  },
  {
    dimension: "memory",
    value: { next_turn_index: snapshot.next_turn_index ?? null },
    rule: "§7: reported, not gated",
    passes: true,
    note: "reported, not gated"
  }
];

const decision = decidePreTestGateV0({ dimensions, delta_state: null, delta_min: null });

const metrics = {
  schema_version: "history-internalization-v1-pre-test-gate-v0",
  role: "PRE_TEST_GATE",
  model_calls: 0,
  read_only: true,
  subject: {
    root,
    snapshot_name: snapshotName,
    snapshot_bytes: statSync(snapshotPath).size,
    subject_id: snapshot.subject_id ?? null,
    next_turn_index: snapshot.next_turn_index ?? null,
    state_revision: identity["state_revision"] ?? null,
    repository_revision: identity["repository_revision"] ?? null,
    logical_time: identity["logical_time"] ?? null,
    subject_head: identity["subject_head"] ?? null
  },
  affect_history: { applications, at_bound: atBound, at_bound_fraction: applications === 0 ? null : atBound / applications },
  dimensions,
  delta_state: null,
  delta_min: null,
  delta_state_note:
    "δ_state is the declared distance between a trajectory's state and ITS TWIN's state. It needs the twin construction, which the frozen design does not specify; this gate does not invent one.",
  outcome: decision.outcome,
  reasons: decision.reasons,
  meaning:
    "INCONCLUSIVE_BY_SATURATION is a statement about the TRAJECTORY DESIGN, not evidence against H1 (§7). The design doc's Phase-0 honesty clause requires this gate result to be published FIRST.",
  forbidden_reading: [
    "this is not evidence against H1",
    "this is not a null result",
    "GATE_INCOMPLETE is not a pass"
  ]
};

writeFileSync(out, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
console.log(`PRE-TEST STATE GATE (0 model calls) — outcome: ${decision.outcome}`);
console.log(`  subject ${String(snapshot.subject_id)}  episodes(logical_time) ${String(identity["logical_time"])}  revision ${String(identity["repository_revision"])}`);
for (const dimension of dimensions) {
  console.log(`  ${dimension.dimension.padEnd(13)} passes=${String(dimension.passes).padEnd(5)} ${dimension.note}`);
}
console.log(`  affect applications ${String(applications)}, at bound 1.0: ${String(atBound)}`);
for (const reason of decision.reasons) console.log(`  reason: ${reason}`);
console.log(`  written: ${out}`);
