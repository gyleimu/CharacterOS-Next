/**
 * Fresh-process authoritative restore worker: rebuilds Memory from the frozen
 * fixtures, restores the exact committed subject head through the production
 * restore chain, re-renders the matched cognition input offline, and reports the
 * restored familiarity value + material digest. Zero model calls.
 */
import { readFileSync } from "node:fs";

import { SCENARIOS } from "./contract.ts";
import { offlineScene } from "./preflight.ts";
import { check, restoreHistory, type HistoryBundle } from "./world.ts";

interface WorkerInput {
  readonly bundle: HistoryBundle;
  readonly expect: { readonly familiarity: number | null; readonly state_revision: number; readonly material_digest: string };
}

const input = JSON.parse(readFileSync(0, "utf8")) as WorkerInput;
const runtime = await restoreHistory(input.bundle);
const snapshot = (await runtime.assembly.facade.readCurrentSnapshot("subject-familiarity-completion" as never)) as unknown as {
  runtime_metadata: { state_revision: number };
};
const scene = await offlineScene(runtime, input.bundle.condition, 0, false, null);
check(snapshot.runtime_metadata.state_revision === input.expect.state_revision, "fresh restore keeps the exact state revision");
check(scene.cognition.material_digest === input.expect.material_digest, "fresh restore renders the identical cognition input");
const report = {
  condition: input.bundle.condition,
  familiarity: input.bundle.familiarity_value,
  state_revision: snapshot.runtime_metadata.state_revision,
  material_digest: scene.cognition.material_digest,
  familiarity_entry_line: scene.cognition.familiarity_entry_line,
  result_kind: scene.result_kind,
  scenario: SCENARIOS[0]?.id ?? null,
  matches_parent: true
};
process.stdout.write(JSON.stringify(report));
