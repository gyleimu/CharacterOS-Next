/**
 * The capture source: ONE ffmpeg process per vision source.
 *
 * Verified constraints on Windows that shaped this design:
 *   - a DirectShow camera is exclusive: a second process cannot open the same
 *     device, so the source must NOT be probed by a second ffmpeg;
 *   - the `image2pipe` MJPEG demuxer buffers until end-of-stream, so a decoder
 *     chained on a live stream does not emit incrementally.
 *
 * Therefore a single process produces BOTH signals at once:
 *   stdout            → fixed-size grayscale thumbnails (rawvideo, 1 decode-free
 *                       frame per capture tick) for cheap change detection;
 *   127.0.0.1:<port>  → full-resolution MJPEG stills (loopback socket, in memory
 *                       only) used as model input.
 *
 * Nothing is written to disk, no image is ever decoded in Node, and no frame
 * leaves the machine.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server, type Socket } from "node:net";
import { MjpegFrameSplitterV0 } from "../frame-stream.js";
import type { VisionErrorCodeV0, VisionSourceKindV0 } from "../types.js";

export interface ThumbnailFrameV0 {
  readonly source: VisionSourceKindV0;
  readonly gray: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly captured_at_ms: number;
}

export interface StillFrameV0 {
  readonly source: VisionSourceKindV0;
  readonly jpeg: Buffer;
  readonly received_at_ms: number;
}

export interface DesktopRegionV0 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FrameSourceConfigV0 {
  readonly source: VisionSourceKindV0;
  readonly ffmpeg_path: string;
  readonly stream_fps: number;
  readonly still_fps: number;
  readonly analysis_width: number;
  readonly thumb_width: number;
  readonly thumb_height: number;
  readonly camera_device_name: string | null;
  readonly camera_input_size: string | null;
  readonly desktop_region: DesktopRegionV0 | null;
  readonly restart_backoff_ms: number;
  readonly max_restarts: number;
  readonly stable_after_ms: number;
}

export interface FrameSourceCallbacksV0 {
  readonly onThumbnail: (frame: ThumbnailFrameV0) => void;
  readonly onStill: (frame: StillFrameV0) => void;
  /** Structural diagnostics only — never image content. */
  readonly onDiagnostic: (event: {
    readonly code: VisionErrorCodeV0;
    readonly detail: string;
    readonly fatal: boolean;
  }) => void;
}

export type FrameSourceStartResultV0 =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: VisionErrorCodeV0; readonly detail: string };

const STDERR_TAIL_CHARS = 2000;

/** Builds the ffmpeg argv for one source. Exported for tests. */
export function buildFrameSourceArgsV0(config: FrameSourceConfigV0, stillPort: number): readonly string[] {
  const scale = `scale='min(${config.analysis_width},iw)':-2`;
  const filter =
    `[0:v]fps=${config.stream_fps},${scale},split=2[a][b];` +
    `[a]scale=${config.thumb_width}:${config.thumb_height},format=gray[thumb];` +
    `[b]fps=${config.still_fps},format=yuvj420p[still]`;
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin"];
  if (config.source === "desktop") {
    const region = config.desktop_region;
    args.push("-f", "gdigrab", "-framerate", String(config.stream_fps));
    if (region !== null) {
      args.push(
        "-offset_x",
        String(region.x),
        "-offset_y",
        String(region.y),
        "-video_size",
        `${region.width}x${region.height}`
      );
    }
    args.push("-i", "desktop");
  } else {
    if (config.camera_device_name === null) {
      throw new Error("camera source requires a resolved device name");
    }
    args.push("-f", "dshow");
    if (config.camera_input_size !== null) {
      args.push("-video_size", config.camera_input_size);
    }
    args.push("-i", `video=${config.camera_device_name}`);
  }
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[thumb]",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "gray",
    "pipe:1",
    "-map",
    "[still]",
    "-f",
    "mjpeg",
    "-flush_packets",
    "1",
    `tcp://127.0.0.1:${stillPort}`
  );
  return args;
}

export class FfmpegFrameSourceV0 {
  private child: ChildProcess | null = null;
  private server: Server | null = null;
  private stillSocket: Socket | null = null;
  private readonly stillSplitter = new MjpegFrameSplitterV0();
  private thumbBuffer: Buffer = Buffer.alloc(0);
  private stderrTail = "";
  private stopping = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private stableTimer: NodeJS.Timeout | null = null;
  private consecutiveRestarts = 0;
  private dead = false;
  private started = false;
  private readonly exitHook = (): void => this.killChild();

  constructor(
    private readonly config: FrameSourceConfigV0,
    private readonly callbacks: FrameSourceCallbacksV0,
    private readonly now: () => number = () => Date.now()
  ) {}

  get running(): boolean {
    return this.started && !this.dead && this.child !== null;
  }

  get restartCount(): number {
    return this.consecutiveRestarts;
  }

  async start(): Promise<FrameSourceStartResultV0> {
    if (this.started) return { ok: true };
    this.stopping = false;
    this.dead = false;
    this.consecutiveRestarts = 0;
    let port: number;
    try {
      port = await this.listenStillSocket();
    } catch (error) {
      return {
        ok: false,
        code: "CAPTURE_FAILED",
        detail: `cannot bind loopback still socket: ${error instanceof Error ? error.message : String(error)}`
      };
    }
    this.started = true;
    process.on("exit", this.exitHook);
    const spawned = this.spawnProcess(port);
    if (!spawned.ok) {
      await this.stop();
      return spawned;
    }
    return { ok: true };
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.started = false;
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.stableTimer !== null) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    process.removeListener("exit", this.exitHook);
    this.killChild();
    this.stillSocket?.destroy();
    this.stillSocket = null;
    const server = this.server;
    this.server = null;
    if (server !== null) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    this.stillSplitter.reset();
    this.thumbBuffer = Buffer.alloc(0);
    this.stderrTail = "";
  }

  /** Releases the capture device but keeps the object restartable (pause/resume). */
  async pause(): Promise<void> {
    if (!this.started) return;
    this.stopping = true;
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.killChild();
    this.stillSocket?.destroy();
    this.stillSocket = null;
  }

  async resume(): Promise<void> {
    if (!this.started || this.child !== null) return;
    this.stopping = false;
    this.consecutiveRestarts = 0;
    const port = this.server?.address();
    if (port === null || typeof port === "string" || port === undefined) return;
    this.spawnProcess(port.port);
  }

  private killChild(): void {
    const child = this.child;
    this.child = null;
    if (child === null) return;
    try {
      child.kill();
    } catch {
      // The process is already gone.
    }
  }

  private async listenStillSocket(): Promise<number> {
    if (this.server !== null) {
      const address = this.server.address();
      if (address !== null && typeof address === "object") return address.port;
    }
    const server = createServer((socket) => this.acceptStillSocket(socket));
    server.on("error", () => {
      this.callbacks.onDiagnostic({
        code: "CAPTURE_FAILED",
        detail: "loopback still socket error",
        fatal: false
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    this.server = server;
    const address = server.address();
    if (address === null || typeof address !== "object") {
      throw new Error("loopback still socket has no port");
    }
    return address.port;
  }

  private acceptStillSocket(socket: Socket): void {
    // One producer at a time: a restarted ffmpeg replaces the previous socket.
    this.stillSocket?.destroy();
    this.stillSocket = socket;
    this.stillSplitter.reset();
    socket.on("data", (chunk: Buffer) => {
      for (const jpeg of this.stillSplitter.push(chunk)) {
        this.callbacks.onStill({
          source: this.config.source,
          jpeg,
          received_at_ms: this.now()
        });
      }
    });
    // A killed producer resets the connection; that is expected on restart.
    socket.on("error", () => undefined);
  }

  private spawnProcess(port: number): FrameSourceStartResultV0 {
    let args: readonly string[];
    try {
      args = buildFrameSourceArgsV0(this.config, port);
    } catch (error) {
      return {
        ok: false,
        code: "CAPTURE_FAILED",
        detail: error instanceof Error ? error.message : String(error)
      };
    }
    let child: ChildProcess;
    try {
      child = spawn(this.config.ffmpeg_path, [...args], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
    } catch (error) {
      return {
        ok: false,
        code: "FFMPEG_NOT_FOUND",
        detail: `cannot spawn ${this.config.ffmpeg_path}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
    this.child = child;
    this.thumbBuffer = Buffer.alloc(0);

    let spawnFailed: VisionErrorCodeV0 | null = null;
    child.on("error", (error: Error) => {
      spawnFailed = (error as NodeJS.ErrnoException).code === "ENOENT" ? "FFMPEG_NOT_FOUND" : "CAPTURE_FAILED";
      this.callbacks.onDiagnostic({
        code: spawnFailed,
        detail: `capture process error: ${error.message}`,
        fatal: true
      });
      this.handleExit(null);
    });
    child.stdout?.on("data", (chunk: Buffer) => this.consumeThumbnails(chunk));
    child.stderr?.on("data", (chunk: Buffer) => {
      this.stderrTail = (this.stderrTail + chunk.toString("utf8")).slice(-STDERR_TAIL_CHARS);
    });
    child.on("exit", (code) => {
      if (spawnFailed === null) this.handleExit(code);
    });

    if (this.stableTimer !== null) clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => {
      // A process that survives this long resets the restart budget.
      this.consecutiveRestarts = 0;
      this.stderrTail = "";
    }, this.config.stable_after_ms);

    return { ok: true };
  }

  private consumeThumbnails(chunk: Buffer): void {
    const frameBytes = this.config.thumb_width * this.config.thumb_height;
    this.thumbBuffer = this.thumbBuffer.length === 0 ? chunk : Buffer.concat([this.thumbBuffer, chunk]);
    while (this.thumbBuffer.length >= frameBytes) {
      const gray = new Uint8Array(frameBytes);
      gray.set(this.thumbBuffer.subarray(0, frameBytes));
      this.thumbBuffer = this.thumbBuffer.subarray(frameBytes);
      this.callbacks.onThumbnail({
        source: this.config.source,
        gray,
        width: this.config.thumb_width,
        height: this.config.thumb_height,
        captured_at_ms: this.now()
      });
    }
    if (this.thumbBuffer.length > frameBytes * 4) {
      // Desynchronized thumbnail stream: drop the partial remainder.
      this.thumbBuffer = Buffer.alloc(0);
    }
  }

  private handleExit(code: number | null): void {
    this.child = null;
    if (this.stopping || !this.started) return;
    if (this.stableTimer !== null) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    this.consecutiveRestarts += 1;
    const fatal = this.consecutiveRestarts > this.config.max_restarts;
    this.callbacks.onDiagnostic({
      code: fatal ? "CAPTURE_FAILED" : "CAPTURE_STOPPED",
      detail: `capture process exited (code ${code ?? "null"}) after ${this.stderrTail.trim().slice(-300)}`,
      fatal
    });
    if (fatal) {
      this.dead = true;
      return;
    }
    const delay = this.config.restart_backoff_ms * this.consecutiveRestarts;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      const port = this.server?.address();
      if (port === null || port === undefined || typeof port === "string") return;
      this.spawnProcess(port.port);
    }, delay);
  }
}
