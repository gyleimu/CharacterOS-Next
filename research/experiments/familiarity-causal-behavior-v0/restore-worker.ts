import { readFileSync } from "node:fs";
import { preview, restoreWorld, type RestoreBundle } from "./adapter.ts";

// No ingestion or model calls; read the serialized authoritative history only.
const saved = JSON.parse(readFileSync(0, "utf8")) as RestoreBundle;
process.stdout.write(JSON.stringify(await preview(await restoreWorld(saved))));
