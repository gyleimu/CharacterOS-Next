#!/usr/bin/env node
/**
 * LONG-RUN INSPECTOR — the ONLY place that materializes the whole durable store.
 *
 * Runs as a SHORT-LIVED SEPARATE PROCESS (§4 of the monitoring-OOM hardening): it
 * reads and parses the subject's snapshot once, derives compact metrics, writes them to
 * a small JSON file and exits completely — so no inspector object graph is ever
 * retained alongside a live runtime.
 *
 * Usage: node scripts/long-run-inspect.mjs --root <subject-dir> --out <metrics.json>
 *
 * It writes no subject state and performs no model call.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

function argV0(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
}

const root = resolve(argV0("root", "product/sandbox/.data/subjects/alice-longrun"));
const out = resolve(argV0("out", "tmp/long-run-inspect.json"));
const BREAK_EVEN_Q = 0.0532;
const IMPULSE_COEFFICIENT = 0.1;

const names = readdirSync(root);
const snapshotName = names.find((name) => name.endsWith(".snapshot.json"));
const sharedName = names.find((name) => name.endsWith(".shared-subject.json"));
if (snapshotName === undefined) {
  console.error("inspector: no snapshot found in", root);
  process.exit(2);
}
const snapshotPath = join(root, snapshotName);
const started = Date.now();
const text = readFileSync(snapshotPath, "utf8");
const value = JSON.parse(text);
const parseMs = Date.now() - started;

// ---- appraisal pressure (dimensions joined to their committed application) --------
const appraisalPattern =
  /"ref":\s*"(appraisal:[0-9a-f]+)"[\s\S]{0,4000}?"dimensions":\s*\{\s*"relevance":\s*(-?[0-9.]+)\s*,\s*"goal_congruence":\s*(-?[0-9.]+)[^}]*"intensity":\s*(-?[0-9.]+)/g;
const appraisals = new Map();
for (const match of text.matchAll(appraisalPattern)) {
  appraisals.set(match[1], { relevance: Number(match[2]), intensity: Number(match[4]) });
}
const applicationPattern =
  /"transition_type":\s*"AffectApplication",\s*"expected_state_revision":\s*(\d+),[\s\S]{0,1200}?"cause_refs":\s*\[([^\]]*)\][\s\S]{0,3000}?"path":\s*"\/affect",\s*"value":\s*\{\s*"schema_version":\s*"canonical-affect-v0",\s*"valence":\s*(-?[0-9.]+),\s*"activation":\s*(-?[0-9.]+)/g;
const qs = [];
let atBound = 0;
let applications = 0;
for (const match of text.matchAll(applicationPattern)) {
  applications += 1;
  const refs = match[2] ?? "";
  const appraisalRef = /"(appraisal:[0-9a-f]+)"/.exec(refs)?.[1];
  const dims = appraisalRef === undefined ? undefined : appraisals.get(appraisalRef);
  if (dims !== undefined) qs.push(dims.relevance * dims.intensity);
  if (Number(match[4]) >= 1) atBound += 1;
}
const sorted = [...qs].sort((left, right) => left - right);
const at = (fraction) =>
  sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];

// ---- save-cost equivalence, measured in THIS short-lived process ------------------
let saveMs;
let saveBytes;
try {
  const saveStarted = Date.now();
  const serialized = `${JSON.stringify(value)}\n`;
  const probe = `${snapshotPath}.inspect.tmp`;
  writeFileSync(probe, serialized, "utf8");
  saveMs = Date.now() - saveStarted;
  saveBytes = statSync(probe).size;
  rmSync(probe, { force: true });
} catch {
  saveMs = null;
  saveBytes = null;
}

const metrics = {
  schema_version: "long-run-inspector-metrics-v0",
  root,
  snapshot_name: snapshotName,
  snapshot_bytes: statSync(snapshotPath).size,
  shared_subject_bytes: sharedName === undefined ? null : statSync(join(root, sharedName)).size,
  parse_ms: parseMs,
  save_equivalence_ms: saveMs,
  serialized_bytes: saveBytes,
  appraisal_pressure: {
    applications,
    joined: qs.length,
    q_min: sorted[0] ?? null,
    q_median: at(0.5),
    q_p90: at(0.9),
    q_max: sorted.at(-1) ?? null,
    q_below_break_even: qs.filter((q) => q < BREAK_EVEN_Q).length,
    q_at_or_above_break_even: qs.filter((q) => q >= BREAK_EVEN_Q).length,
    at_bound_applications: atBound,
    impulse_coefficient: IMPULSE_COEFFICIENT
  },
  inspected_at: new Date().toISOString()
};
writeFileSync(out, `${JSON.stringify(metrics, null, 1)}\n`, "utf8");
console.log("LONG_RUN_INSPECT", JSON.stringify({ out, applications: metrics.appraisal_pressure.applications, save_equivalence_ms: saveMs }));
