/* eslint-disable no-restricted-imports -- Experiment-only consumer of built public package roots. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { allowedEvidenceSet } from "../../../packages/runtime/dist/index.js";
import { buildWorld, check, equal, preview, restoreBundle, type ProviderInput, type World } from "./adapter.ts";
import { ALICE, BOB, CONVENTION_REF, ORDER, SCENARIO, type Arm } from "./contract.ts";

export const sha256 = (value: string | Uint8Array) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
export const inputHash = (input: ProviderInput) => sha256(JSON.stringify(input.messages));
export type Preview = Awaited<ReturnType<typeof preview>>;

export function assertInput(input: ProviderInput, arm: Arm, empty = false) {
  const p = input.projection;
  const familiarity = p.interaction_familiarity.find(f => f.counterpart_ref === ALICE);
  check(familiarity?.presence === "PRESENT" && familiarity.canonical_value === (arm === "A" ? 1 : 16) / 32, "exact Alice familiarity");
  check(equal(p.interaction_familiarity_cognition_influences.map(i => [i.counterpart_ref, i.context_resolution_strategy]),
    [[ALICE, arm === "A" ? "BASIC_CONTEXT_FIRST" : "COUNTERPART_CONTEXT_SEARCH_FIRST"]]), "exact active-counterpart influence");
  check(p.context.scene === SCENARIO && equal(p.context.active_entity_refs, [ALICE]), "frozen scenario");
  const expected = arm === "B" && !empty ? [CONVENTION_REF] : [];
  check(equal(p.recent_retrieval_refs, expected) && equal(input.evidence.map(e => e.ref), expected), "lawful selected convention only");
  check(equal(p.memory_working_refs, []), "no manually seeded working evidence");
  const allowed = [...allowedEvidenceSet(p)].sort();
  check(equal(allowed, [ALICE, ...expected].sort()), "exact evidence allowlist; no receipts/writer/history refs");
  check(equal(p.allowed_actions, []), "same empty declarative action space");
  check(!input.messages.some(m => /ARM [AB]|expected answer|desired outcome/.test(m.content)), "no arm/answer annotation");
  check(arm === "B" && !empty || !input.messages.some(m => m.content.includes("no unnecessary apology")), "no convention leaked into A/empty");
}

export function assertCycle(cycle: Preview, arm: Arm, empty = false) {
  assertInput(cycle.input, arm, empty);
  const trace = cycle.result.interaction_familiarity_retrieval;
  check(trace && cycle.result.outcome.kind === "NO_OP", "normal cognition zero-delta completion");
  check(cycle.queries.length === (arm === "A" ? 0 : 1) && trace.attempted_count === cycle.queries.length, "exact priority query count");
  check(trace.retrieval_failed_count === 0 && trace.no_priority_request_count === (arm === "A" ? 1 : 0), "retrieval trace consistency");
  if (arm === "B") {
    check(equal(cycle.queries[0], {
      schema_version: "memory-retrieval-query-v0", subject_id: cycle.input.projection.subject_id,
      repository_revision: "R0", semantic_reference: ALICE,
      temporal: { now_logical_time: 0, window_start: null }, entity_refs: [ALICE], relationship_refs: [], current_context_refs: [],
      salience_constraints: { min_declared_score: null, max_candidates: 16 }
    }), "exact Alice query; unchanged retrieval constraints");
    check(trace.attempts[0]?.outcome === (empty ? "ATTEMPTED_EMPTY" : "ATTEMPTED_WITH_USABLE_EVIDENCE"), "validated evidence outcome");
    check(equal(trace.attempts[0]?.selected_memory_refs, empty ? [] : [CONVENTION_REF]), "trace/projection evidence agreement");
  }
}

/** Everything other than history-caused state revision, familiarity, strategy,
 * selected refs and the binding hash must remain equal. Revisions are NOT hidden. */
export function accountDifferences(a: ProviderInput, b: ProviderInput) {
  check(a.messages[0], "system message exists");
  check(a.messages[0]?.content === b.messages[0]?.content, "identical system/base prompt");
  const permitted = ["state_revision", "interaction_familiarity", "interaction_familiarity_cognition_influences", "recent_retrieval_refs", "projection_hash"];
  const changed = Object.keys(a.projection).filter(k => !equal(
    a.projection[k as keyof typeof a.projection], b.projection[k as keyof typeof b.projection]));
  check(equal([...changed].sort(), [...permitted].sort()), "only explicitly accounted projection differences");
  return {
    invariant_projection_fields: Object.keys(a.projection).filter(k => !changed.includes(k)),
    downstream_projection_differences: changed,
    other_downstream_differences: ["validated selected Memory content", "repository manifest hash", "canonical commit head"],
    revision_note: "state_revision and source_state_revision differ because 1 versus 16 actual ingestion commits occurred; projection_hash binds those differences. No padding or state surgery.",
    system_prompt_hash: sha256(a.messages[0].content),
    provider_inputs_byte_identical: false
  };
}

function assertUnrelatedState(world: World) {
  const excluded = new Set(["relationships", "runtime_metadata", "trace_window"]);
  for (const key of Object.keys(world.genesis) as (keyof World["genesis"])[]) {
    if (!excluded.has(key)) check(equal(world.genesis[key], world.snapshot[key]), `unrelated state unchanged: ${key}`);
  }
}

export async function preflight() {
  const worlds = { A: await buildWorld(1), B: await buildWorld(16) };
  check(equal(worlds.A.genesis, worlds.B.genesis), "byte-equivalent initial subject fixtures");
  for (const w of Object.values(worlds)) assertUnrelatedState(w);
  const restore = { A: await restoreBundle(worlds.A), B: await restoreBundle(worlds.B) };
  const arms = { A: await preview(worlds.A), B: await preview(worlds.B) };
  assertCycle(arms.A, "A"); assertCycle(arms.B, "B");
  const accounting = accountDifferences(arms.A.input, arms.B.input);
  const repeats = [];
  for (const item of ORDER) {
    const again = await preview(await buildWorld(item.arm === "A" ? 1 : 16));
    assertCycle(again, item.arm);
    check(equal(again, arms[item.arm]), "same history has identical full host path and provider input; no label branch");
    repeats.push({ ...item, host_valid: true, provider_input_hash: inputHash(again.input) });
  }
  const bobWorld = await buildWorld(1, 16);
  const bob = await preview(bobWorld);
  assertCycle(bob, "A");
  check(bob.input.projection.interaction_familiarity.find(f => f.counterpart_ref === BOB)?.canonical_value === 16 / 32, "Bob genuinely ingested high familiarity");
  check(equal(bob.input.projection.interaction_familiarity_cognition_influences, arms.A.input.projection.interaction_familiarity_cognition_influences), "Bob cannot affect Alice strategy");
  check(equal(bob.input.evidence, arms.A.input.evidence), "Bob cannot affect Alice evidence");
  const empty = await preview(await buildWorld(16), true);
  assertCycle(empty, "B", true);
  // Separate process discards all in-memory authority receipts; the existing
  // Level-2 composition mints a new boundary and validates the persisted chain.
  const freshRestore: Partial<Record<Arm, Preview>> = {};
  for (const arm of ["A", "B"] as const) {
    const child = spawnSync(process.execPath, [fileURLToPath(new URL("./restore-worker.ts", import.meta.url))], {
      input: JSON.stringify(restore[arm]), encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024, windowsHide: true
    });
    check(child.status === 0, `fresh restore process: ${child.stderr || child.error?.message || ""}`);
    const restored = JSON.parse(child.stdout) as Preview;
    assertCycle(restored, arm);
    check(equal(restored, arms[arm]), "fresh authoritative restore preserves exact treatment and input");
    freshRestore[arm] = restored;
  }
  return { status: "PASS" as const, real_model_calls: 0, arms, accounting, repeats,
    controls: { same_state: "PASS", wrong_counterpart: bob, empty_retrieval: empty },
    fresh_restore: freshRestore, restore_bundles: restore };
}
export type Preflight = Awaited<ReturnType<typeof preflight>>;
