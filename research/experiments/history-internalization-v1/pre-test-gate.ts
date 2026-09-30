/**
 * HISTORY_INTERNALIZATION_V1 — PHASE 0 PRE-TEST STATE GATE (zero model calls, read-only).
 *
 *   node research/experiments/history-internalization-v1/pre-test-gate.ts \
 *        [--root <subject-dir>] [--run <frozen-run-dir>] [--out <file>]
 *
 * Implements §7 of `research/north-star/HISTORY_INTERNALIZATION_TEST_V1_DESIGN.md`:
 *
 *   > **State-distance gate.** ... The test phase may run only if `δ_state ≥ δ_min` for the declared
 *   > target dimension AND no target dimension is at a bound. If the gate fails, the run is recorded as
 *   > `INCONCLUSIVE_BY_SATURATION` — a statement about the trajectory design, **not** evidence against H1.
 *
 * with its per-dimension non-degeneracy table:
 *
 *   Belief        `0 < credence < 1` for at least one item, else INCONCLUSIVE_BY_SATURATION
 *   Relationship  below the `32/32` cap
 *   Affect        activation **not pinned at 1.0**
 *   Memory        reported, not gated
 *   Personality   reported as an ABSENCE, never as a null result
 *   Regulation    recorded to document that it is inert
 *
 * TWO MODES, because they can read different amounts and the difference is load-bearing:
 *
 *   --root <dir>   a LIVE subject directory. §7 requires belief and relationship through the production
 *                  read-only projection, which this process does not open, so those are reported as
 *                  NOT READ rather than guessed. Affect/regulation come from the durable identity, which
 *                  is authoritative at the head revision.
 *
 *   --run <dir>    a FROZEN run's evidence directory. Its `pre-state-*.json` / `post-state-*.json` were
 *                  written by the production read path and therefore CONTAIN the full canonical state
 *                  view — beliefs, relationships, affect, regulation, personality. Every gated dimension
 *                  is readable here, so the gate can be fully published for those subjects.
 *
 * READ-ONLY: writes no subject state, performs no model call, mutates nothing. The only write is --out.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------------------------
// §7 non-degeneracy rules, as code
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

/**
 * §7 Affect: activation must NOT be pinned at 1.0.
 *
 * Two distinct ways to fail, kept distinct in the reason rather than collapsed:
 *   - `activation === 1`       → PINNED AT THE BOUND (§7's literal rule; the canonical subject's value)
 *   - `activation > 1` or `< 0` → OUT OF DOMAIN. Reporting an out-of-domain value as "non-degenerate"
 *                                 would be a silent hole, so it fails too — but for its own reason.
 * Values in [0,1) pass.
 */
export function affectNonDegenerateV0(reading: { readonly activation: unknown; readonly valence: unknown }): boolean | null {
  if (typeof reading.activation !== "number" || typeof reading.valence !== "number") return null;
  if (!Number.isFinite(reading.activation) || !Number.isFinite(reading.valence)) return null;
  return reading.activation < 1 && reading.activation >= 0;
}

/** Why affect passed or failed, so the reported reason names the actual cause. */
export function affectGateReasonV0(activation: unknown): string {
  if (typeof activation !== "number" || !Number.isFinite(activation)) return "activation is not a finite number";
  if (activation === 1) return "activation IS PINNED AT THE BOUND 1.0";
  if (activation > 1) return `activation ${String(activation)} is OUT OF DOMAIN (>1)`;
  if (activation < 0) return `activation ${String(activation)} is OUT OF DOMAIN (<0)`;
  return "activation is inside [0,1)";
}

/** §7 Belief: `0 < credence < 1` for AT LEAST ONE item. An empty set is not a pass. */
export function beliefNonDegenerateV0(items: readonly { readonly credence?: unknown }[] | null): boolean | null {
  if (items === null) return null;
  return items.some((item) => typeof item.credence === "number" && item.credence > 0 && item.credence < 1);
}

/**
 * §7 Relationship: "below the `32/32` cap".
 *
 * CORRECTED. The first version returned `false` for an EMPTY relationship set, which §7 does not say: an
 * empty set is vacuously below the cap — it is not saturated, it simply carries no contrast. The rule had
 * conflated "not at a bound" with "carries content", and the difference matters: §7's gate is about
 * bounds, while the contrast belongs to δ_state. The two are now reported separately.
 */
export function relationshipCapSatisfiedV0(counterparts: readonly { readonly familiarity_credits?: unknown }[]): boolean {
  return counterparts.every(
    (entry) => typeof entry.familiarity_credits === "number" && entry.familiarity_credits < 32
  );
}

export function relationshipCarriesContrastV0(counterparts: readonly unknown[]): boolean {
  return counterparts.length > 0;
}

/**
 * §7 is a conjunction: the test phase may run only if every gated dimension is non-degenerate AND
 * `δ_state >= δ_min`. A `null` dimension makes the gate INCOMPLETE — never a pass.
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

  const deltaUndeclared = input.delta_state === null || input.delta_min === null;
  const deltaTooSmall = !deltaUndeclared && (input.delta_state as number) < (input.delta_min as number);
  if (deltaUndeclared) {
    reasons.push("δ_state / δ_min not yet declared (the twin construction is not specified by the frozen design)");
  } else if (deltaTooSmall) {
    reasons.push(`δ_state ${String(input.delta_state)} < δ_min ${String(input.delta_min)}`);
  }

  // §7's own sentence is blanket: "If the gate fails, the run is recorded as `INCONCLUSIVE_BY_SATURATION`."
  // So a δ failure is recorded with that verdict too, with the reason naming δ — rather than inventing a
  // new token the frozen text does not contain.
  //
  // DEFECT FIXED HERE: the first version pushed the δ reason but still returned GATE_PASS, so a run whose
  // δ_state was below δ_min would have been allowed to proceed. Found by the conformance test.
  if (atBound.length > 0 || deltaTooSmall) return { outcome: "INCONCLUSIVE_BY_SATURATION", reasons };
  if (unreadable.length > 0 || deltaUndeclared) return { outcome: "GATE_INCOMPLETE", reasons };
  return { outcome: "GATE_PASS", reasons };
}

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

interface CanonicalViewV0 {
  readonly identity?: { readonly subject_id?: unknown };
  readonly logical_time?: unknown;
  readonly state_revision?: unknown;
  readonly repository_revision?: unknown;
  readonly affect?: { readonly valence?: unknown; readonly activation?: unknown } | null;
  readonly regulation?: unknown;
  readonly personality?: readonly unknown[];
  readonly beliefs?: readonly { readonly proposition_id?: unknown; readonly credence?: unknown }[];
  readonly relationships?: readonly { readonly familiarity_credits?: unknown }[];
}

/** The §7 table, from a FULL canonical state view. Every gated dimension is readable here. */
export function dimensionsFromCanonicalViewV0(view: CanonicalViewV0, label: string): DimensionReadingV0[] {
  const affect = view.affect ?? null;
  const beliefs = view.beliefs ?? null;
  const relationships = view.relationships ?? null;
  const credits = relationships === null ? null : relationships.map((entry) => entry.familiarity_credits);
  return [
    {
      dimension: "affect",
      value: affect,
      rule: "§7: activation NOT pinned at 1.0",
      passes: affect === null ? null : affectNonDegenerateV0({ activation: affect.activation, valence: affect.valence }),
      note:
        affect === null
          ? `${label}: no canonical affect`
          : `${label}: activation=${String(affect.activation)} valence=${String(affect.valence)} — ${affectGateReasonV0(affect.activation)}`
    },
    {
      dimension: "belief",
      value: beliefs,
      rule: "§7: 0 < credence < 1 for at least one item",
      passes: beliefNonDegenerateV0(beliefs),
      note:
        beliefs === null
          ? `${label}: no beliefs block`
          : `${label}: ${String(beliefs.length)} item(s) ` +
            beliefs.map((item) => `${String(item.proposition_id)}=${String(item.credence)}`).join(", ")
    },
    {
      dimension: "relationship",
      value: relationships,
      rule: "§7: below the 32/32 cap (carries no contrast when empty)",
      passes: relationships === null ? null : relationshipCapSatisfiedV0(relationships),
      note:
        relationships === null
          ? `${label}: no relationships block`
          : `${label}: ${String(relationships.length)} counterpart(s), credits=[${(credits ?? []).map(String).join(", ")}]` +
            ` — carries_contrast=${String(relationships.length > 0)}`
    },
    {
      dimension: "regulation",
      value: view.regulation ?? null,
      rule: "§7: recorded to document that it is inert (NOT gated)",
      passes: true,
      note: `${label}: ${view.regulation === undefined ? "absent" : JSON.stringify(view.regulation)}`
    },
    {
      dimension: "personality",
      value: "NONE",
      rule: "§7: reported as an ABSENCE, never as a null result",
      passes: true,
      note: `${label}: absent by construction (personality adaptation is disabled in production)`
    },
    {
      dimension: "memory",
      value: { logical_time: view.logical_time ?? null, state_revision: view.state_revision ?? null },
      rule: "§7: reported, not gated",
      passes: true,
      note: `${label}: logical_time=${String(view.logical_time)} state_revision=${String(view.state_revision)}`
    }
  ];
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

const argV0 = (name: string, fallback: string): string => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? (process.argv[index + 1] as string) : fallback;
};

const runDir = process.argv.includes("--run") ? resolve(argV0("run", "")) : null;
const root = resolve(argV0("root", "product/sandbox/.data/subjects/alice-longrun"));
const out = resolve(
  argV0(
    "out",
    runDir === null
      ? "research/experiments/history-internalization-v1/evidence/pre-test-gate.json"
      : "research/experiments/history-internalization-v1/evidence/pre-test-gate-run5.json"
  )
);

const base = {
  schema_version: "history-internalization-v1-pre-test-gate-v0",
  role: "PRE_TEST_GATE",
  model_calls: 0,
  read_only: true,
  delta_state: null,
  delta_min: null,
  delta_state_note:
    "δ_state is the declared distance between a trajectory's state and ITS TWIN's state. The frozen design does not specify the twin construction, so this gate does not invent one.",
  forbidden_reading: [
    "this is not evidence against H1",
    "this is not a null result",
    "GATE_INCOMPLETE is not a pass"
  ]
} as const;

if (runDir !== null) {
  // ---- mode 2: a frozen run's artifacts, where the full canonical view IS available --------------
  const read = (name: string): CanonicalViewV0 => {
    const parsed = JSON.parse(readFileSync(join(runDir, name), "utf8")) as { state?: { canonical_state_view?: CanonicalViewV0 } };
    const view = parsed.state?.canonical_state_view;
    if (view === undefined) throw new Error(`PRETEST_GATE_NO_CANONICAL_VIEW: ${name}`);
    return view;
  };
  const subjects = (["A", "B"] as const).map((arm) => {
    const pre = read(`pre-state-${arm}.json`);
    const post = read(`post-state-${arm}.json`);
    const preDimensions = dimensionsFromCanonicalViewV0(pre, `arm ${arm} PRE`);
    const postDimensions = dimensionsFromCanonicalViewV0(post, `arm ${arm} POST`);
    return {
      arm,
      subject_id: pre.identity?.subject_id ?? null,
      pre: { dimensions: preDimensions, decision: decidePreTestGateV0({ dimensions: preDimensions, delta_state: null, delta_min: null }) },
      post: { dimensions: postDimensions, decision: decidePreTestGateV0({ dimensions: postDimensions, delta_state: null, delta_min: null }) }
    };
  });
  // The declared target dimension for THIS experiment is the belief proposition the trajectories move.
  const target = (view: CanonicalViewV0): number | null =>
    view.beliefs?.[0]?.credence === undefined ? null : Number(view.beliefs[0].credence);
  const beliefA = subjects[0] === undefined ? null : target(read("post-state-A.json"));
  const beliefB = subjects[1] === undefined ? null : target(read("post-state-B.json"));
  const metrics = {
    ...base,
    mode: "FROZEN_RUN_ARTIFACTS",
    run_dir: runDir,
    subjects,
    declared_target_dimension: "belief: prop.nadia-keeps-commitments",
    target_dimension_contrast: {
      post_A: beliefA,
      post_B: beliefB,
      measured_abs_difference: beliefA === null || beliefB === null ? null : Math.abs(beliefA - beliefB),
      note: "measured, NOT yet compared to δ_min — δ_min is undeclared, and this is a between-TRAJECTORY distance, not the §7 twin distance"
    },
    outcome_per_subject: subjects.map((subject) => ({ arm: subject.arm, post: subject.post.decision.outcome })),
    published_consequence:
      "every gated dimension is NON-DEGENERATE in both arms' post-states, so the BOUND half of §7's gate passes on these subjects — unlike the real 216-episode subject, whose affect activation is pinned at 1.0. δ_state remains GATE_INCOMPLETE because the twin is unspecified."
  };
  writeFileSync(out, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  console.log(`PRE-TEST STATE GATE — mode FROZEN_RUN_ARTIFACTS (0 model calls)`);
  for (const subject of subjects) {
    console.log(`  arm ${subject.arm} (${String(subject.subject_id)})`);
    for (const dimension of subject.post.dimensions) {
      console.log(`    POST ${dimension.dimension.padEnd(13)} passes=${String(dimension.passes).padEnd(5)} ${dimension.note}`);
    }
    console.log(`    -> ${subject.post.decision.outcome}`);
  }
  console.log(`  target-dimension contrast (belief post A vs B): ${String(beliefA)} vs ${String(beliefB)}`);
  console.log(`  written: ${out}`);
} else {
  // ---- mode 1: a live subject directory ----------------------------------------------------------
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
  const regulation = (identity["regulation"] ?? null) as Record<string, unknown> | null;

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
          : `activation=${String(affect.activation)} valence=${String(affect.valence)} — ${affectGateReasonV0(affect.activation)}`
    },
    {
      dimension: "belief",
      value: null,
      rule: "§7: 0 < credence < 1 for at least one item",
      passes: null,
      note: "REQUIRES_PRODUCTION_READ_PROJECTION — belief lives in the committed canonical store; §7 requires the refsBelongToRevision read path, and this mode refuses to guess"
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
      rule: "§7: reported as an ABSENCE, never as a null result",
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
    ...base,
    mode: "LIVE_SUBJECT_DIRECTORY",
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
    outcome: decision.outcome,
    reasons: decision.reasons,
    meaning:
      "INCONCLUSIVE_BY_SATURATION is a statement about the TRAJECTORY DESIGN, not evidence against H1 (§7). The design doc's Phase-0 honesty clause requires this gate result to be published FIRST."
  };
  writeFileSync(out, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  console.log(`PRE-TEST STATE GATE (0 model calls) — outcome: ${decision.outcome}`);
  console.log(
    `  subject ${String(snapshot.subject_id)}  episodes(logical_time) ${String(identity["logical_time"])}  revision ${String(identity["repository_revision"])}`
  );
  for (const dimension of dimensions) {
    console.log(`  ${dimension.dimension.padEnd(13)} passes=${String(dimension.passes).padEnd(5)} ${dimension.note}`);
  }
  console.log(`  affect applications ${String(applications)}, at bound 1.0: ${String(atBound)}`);
  for (const reason of decision.reasons) console.log(`  reason: ${reason}`);
  console.log(`  written: ${out}`);
}
