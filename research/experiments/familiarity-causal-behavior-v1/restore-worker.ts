import { readFileSync } from "node:fs";
import { restoreWorld, type RestoreBundle } from "./fixtures.ts";
import { preview } from "./preflight.ts";
const saved = JSON.parse(readFileSync(0, "utf8")) as RestoreBundle;
const observed = await preview(await restoreWorld(saved));
// The restore helper validates the full chain with a newly minted Level-2
// boundary; expose the persisted head without replaying ingestion or model calls.
const head = saved.bundles.at(-1);
observed.source.canonical_head = head ? { commit_ref: head.commit_ref, record_checksum: head.record_checksum } : null;
process.stdout.write(JSON.stringify(observed));
