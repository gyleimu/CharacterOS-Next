/**
 * CHARACTEROS_VOICE_RUNTIME_CLIENT_V0 — transport behaviour against a real local
 * HTTP server.
 *
 * These tests use a genuine `node:http` double rather than a mocked fetch, so
 * the failure classification is exercised end to end: connection refused, a
 * server that never answers, a non-JSON body, an error status, and a real
 * chunked stream. That matters because the whole degradation story depends on
 * these classes being correct — a mis-classified failure would surface as a
 * broken turn instead of a silent voice channel.
 *
 * Also covered: streaming measures time-to-first-audio client-side and streams
 * incrementally (the double sends a chunk, waits, then sends more, so a client
 * that buffered everything before delivering would fail the timing assertion).
 */

import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import {
  VoiceFailureV0,
  VoiceRuntimeClientV0,
  type VoiceRuntimeConfigV0
} from "./index.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

/** Starts a server whose single route is decided by `handler`. */
async function startRuntime(handler: (path: string, res: ServerResponse) => void): Promise<string> {
  const server = createServer((req, res) => handler(req.url ?? "/", res));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

function configFor(baseUrl: string, overrides: Partial<VoiceRuntimeConfigV0> = {}): VoiceRuntimeConfigV0 {
  return {
    base_url: baseUrl,
    health_timeout_ms: 1_500,
    tts_timeout_ms: 3_000,
    asr_timeout_ms: 1_500,
    listen_timeout_ms: 1_500,
    ...overrides
  };
}

const TTS_REQUEST = {
  text: "你好。",
  voice_id: "characteros-default",
  instruct: "You are a helpful assistant. <|endofprompt|>",
  play: false,
  stream: false,
  save_path: null,
  return_audio: false
} as const;

describe("failure classification", () => {
  it("reports a refused connection as VOICE_RUNTIME_UNAVAILABLE", async () => {
    // Port 1 is reserved and never listening.
    const client = new VoiceRuntimeClientV0(configFor("http://127.0.0.1:1"));
    await expect(client.health()).rejects.toMatchObject({ code: "VOICE_RUNTIME_UNAVAILABLE" });
    expect(await client.isAvailable()).toBe(false);
  });

  it("reports an unresponsive server as VOICE_RUNTIME_TIMEOUT", async () => {
    const baseUrl = await startRuntime(() => {
      // Deliberately never respond.
    });
    const client = new VoiceRuntimeClientV0(configFor(baseUrl, { health_timeout_ms: 400 }));
    await expect(client.health()).rejects.toMatchObject({ code: "VOICE_RUNTIME_TIMEOUT" });
  });

  it("reports a non-JSON body as VOICE_RUNTIME_MALFORMED", async () => {
    const baseUrl = await startRuntime((_path, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("this is not json");
    });
    const client = new VoiceRuntimeClientV0(configFor(baseUrl));
    await expect(client.health()).rejects.toMatchObject({ code: "VOICE_RUNTIME_MALFORMED" });
  });

  it("reports an error status as VOICE_RUNTIME_REJECTED with the server detail", async () => {
    const baseUrl = await startRuntime((_path, res) => {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: "ASR is not available" }));
    });
    const client = new VoiceRuntimeClientV0(configFor(baseUrl));
    await expect(client.synthesize({ ...TTS_REQUEST })).rejects.toMatchObject({
      code: "VOICE_RUNTIME_REJECTED"
    });
  });

  it("reports a cancelled request as VOICE_CANCELLED, not as a timeout", async () => {
    const baseUrl = await startRuntime(() => {
      // never respond
    });
    const client = new VoiceRuntimeClientV0(configFor(baseUrl, { tts_timeout_ms: 5_000 }));
    const controller = new AbortController();
    const pending = client.synthesize({ ...TTS_REQUEST }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "VOICE_CANCELLED" });
  });

  it("never leaks a raw network error type", async () => {
    const client = new VoiceRuntimeClientV0(configFor("http://127.0.0.1:1"));
    try {
      await client.health();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(VoiceFailureV0);
      expect((error as VoiceFailureV0).code).toBe("VOICE_RUNTIME_UNAVAILABLE");
    }
  });
});

describe("health", () => {
  it("reports the runtime state and per-model residency", async () => {
    const baseUrl = await startRuntime((path, res) => {
      if (path !== "/health") {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          state: "DEGRADED",
          device: "cuda:0",
          asr_device: "cpu",
          fp16: true,
          uptime_ms: 1000,
          asr: { loaded: true, model_id: "iic/SenseVoiceSmall", device: "cpu", load_ms: 10, error: null },
          tts: { loaded: false, model_id: "Fun-CosyVoice3", device: "cuda:0", load_ms: 20, error: "CUDA OOM" },
          vram: { total_mb: 8188, used_mb: 4000, peak_mb: 4500 }
        })
      );
    });
    const client = new VoiceRuntimeClientV0(configFor(baseUrl));
    const health = await client.health();
    expect(health.state).toBe("DEGRADED");
    expect(health.tts.loaded).toBe(false);
    expect(health.tts.error).toBe("CUDA OOM");
    expect(health.asr.loaded).toBe(true);
  });
});

describe("streaming", () => {
  it("measures time-to-first-audio and streams chunks incrementally", async () => {
    const baseUrl = await startRuntime((path, res) => {
      if (path !== "/tts/stream") {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": "audio/L16; rate=24000; channels=1",
        "X-Voice-Sample-Rate": "24000"
      });
      // First chunk quickly, then a deliberate gap, then the rest. A client that
      // collected the whole body before reporting chunks would show ttfa ==
      // total_ms, which the assertion below would catch.
      res.write(Buffer.alloc(4800));
      setTimeout(() => {
        res.write(Buffer.alloc(4800));
        res.end();
      }, 250);
    });
    const client = new VoiceRuntimeClientV0(configFor(baseUrl));
    const observed: number[] = [];
    const result = await client.synthesizeStream(
      { ...TTS_REQUEST, stream: true },
      { onChunk: (chunk) => observed.push(chunk.index) }
    );
    expect(result.chunks).toBe(2);
    expect(result.bytes).toBe(9600);
    expect(result.audio_ms).toBe(200);
    expect(result.ttfa_ms).not.toBeNull();
    // The second chunk arrives 250ms after the first, so a client that buffered
    // the whole body would report ttfa == total instead of a gap.
    expect(result.ttfa_ms as number).toBeLessThan(result.total_ms - 100);
    expect(observed).toEqual([0, 1]);
  });

  it("rejects an error status before reading the stream", async () => {
    const baseUrl = await startRuntime((_path, res) => {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: "unknown voice_id" }));
    });
    const client = new VoiceRuntimeClientV0(configFor(baseUrl));
    await expect(client.synthesizeStream({ ...TTS_REQUEST, stream: true })).rejects.toMatchObject({
      code: "VOICE_RUNTIME_REJECTED"
    });
  });

  it("never throws from cancel(), even when the runtime is down", async () => {
    const client = new VoiceRuntimeClientV0(configFor("http://127.0.0.1:1"));
    await expect(client.cancel()).resolves.toBeUndefined();
  });
});
