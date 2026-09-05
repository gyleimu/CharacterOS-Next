import { freemem } from "node:os";
import { createInterface } from "node:readline";

const MIB = 1024 * 1024;

interface Args {
  requested_mib: number;
  safety_floor_mib: number;
  chunk_mib: number;
  max_lifetime_ms: number;
}

function parsePositiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name}: positive integer required`);
  return parsed;
}

function parseArgs(argv: readonly string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (typeof flag !== "string" || typeof value !== "string") throw new Error("paired arguments required");
    values.set(flag, value);
  }
  const args = {
    requested_mib: parsePositiveInteger(values.get("--mib"), "--mib"),
    safety_floor_mib: parsePositiveInteger(values.get("--safety-floor-mib"), "--safety-floor-mib"),
    chunk_mib: parsePositiveInteger(values.get("--chunk-mib"), "--chunk-mib"),
    max_lifetime_ms: parsePositiveInteger(values.get("--max-lifetime-ms"), "--max-lifetime-ms")
  };
  if (args.requested_mib > 1024) throw new Error("--mib exceeds fixed 1024 MiB helper maximum");
  if (args.safety_floor_mib < 768) throw new Error("--safety-floor-mib may not be below 768 MiB");
  if (args.chunk_mib > 16 || args.requested_mib % args.chunk_mib !== 0) {
    throw new Error("--chunk-mib must divide requested MiB and be at most 16 MiB");
  }
  if (args.max_lifetime_ms > 600_000) throw new Error("--max-lifetime-ms exceeds 10-minute maximum");
  return args;
}

const args = parseArgs(process.argv.slice(2));
const chunks: Buffer[] = [];
const startedAt = new Date().toISOString();
let released = false;

function event(kind: string, extra: Record<string, unknown> = {}): void {
  process.stdout.write(`${kind} ${JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString(),
    ...extra
  })}\n`);
}

function release(reason: string, exitCode = 0): void {
  if (released) return;
  released = true;
  const actualMib = chunks.length * args.chunk_mib;
  chunks.length = 0;
  event("RELEASED", {
    reason,
    requested_mib: args.requested_mib,
    actual_allocated_mib: actualMib,
    started_at: startedAt,
    free_mib_at_release: Math.floor(freemem() / MIB)
  });
  process.exitCode = exitCode;
  setImmediate(() => process.exit(exitCode));
}

async function allocate(): Promise<void> {
  const freeBeforeMib = Math.floor(freemem() / MIB);
  for (let allocated = 0; allocated < args.requested_mib; allocated += args.chunk_mib) {
    const freeMib = Math.floor(freemem() / MIB);
    if (freeMib - args.chunk_mib <= args.safety_floor_mib) {
      event("ALLOCATION_STOPPED", {
        reason: "SAFETY_FLOOR_GUARD",
        free_mib: freeMib,
        actual_allocated_mib: chunks.length * args.chunk_mib
      });
      break;
    }
    const chunk = Buffer.allocUnsafe(args.chunk_mib * MIB);
    for (let offset = 0; offset < chunk.length; offset += 4096) {
      chunk[offset] = (chunks.length + offset / 4096) % 251;
    }
    chunks.push(chunk);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  event("READY", {
    requested_mib: args.requested_mib,
    actual_allocated_mib: chunks.length * args.chunk_mib,
    chunk_mib: args.chunk_mib,
    safety_floor_mib: args.safety_floor_mib,
    free_mib_before: freeBeforeMib,
    free_mib_after: Math.floor(freemem() / MIB),
    max_lifetime_ms: args.max_lifetime_ms
  });
}

const floorMonitor = setInterval(() => {
  const freeMib = Math.floor(freemem() / MIB);
  if (freeMib <= args.safety_floor_mib) release("SAFETY_FLOOR_REACHED", 8);
}, 250);
floorMonitor.unref();

const lifetime = setTimeout(() => release("MAX_LIFETIME_REACHED", 9), args.max_lifetime_ms);
lifetime.unref();

const input = createInterface({ input: process.stdin, terminal: false });
input.on("line", (line) => {
  if (line.trim().toLowerCase() === "release") release("PARENT_RELEASE");
});
input.on("close", () => release("PARENT_CHANNEL_CLOSED"));
process.on("SIGTERM", () => release("SIGTERM"));
process.on("SIGINT", () => release("SIGINT"));

await allocate();
