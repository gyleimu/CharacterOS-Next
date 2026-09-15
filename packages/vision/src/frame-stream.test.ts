import { describe, expect, it } from "vitest";
import { MjpegFrameSplitterV0 } from "./frame-stream.js";

function jpeg(body: readonly number[]): Buffer {
  return Buffer.from([0xff, 0xd8, ...body, 0xff, 0xd9]);
}

function frameAt(frames: readonly Buffer[], index: number): Buffer {
  const frame = frames[index];
  if (frame === undefined) throw new Error(`no frame at index ${index}`);
  return frame;
}

describe("MJPEG stream splitter", () => {
  it("splits two stills arriving in one chunk", () => {
    const splitter = new MjpegFrameSplitterV0();
    const frames = splitter.push(Buffer.concat([jpeg([1, 2, 3]), jpeg([4, 5])]));
    expect(frames).toHaveLength(2);
    expect([...frameAt(frames, 0)]).toEqual([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    expect([...frameAt(frames, 1)]).toEqual([0xff, 0xd8, 4, 5, 0xff, 0xd9]);
  });

  it("reassembles a still that arrives across several chunks", () => {
    const splitter = new MjpegFrameSplitterV0();
    expect(splitter.push(Buffer.from([0xff, 0xd8, 7]))).toHaveLength(0);
    expect(splitter.push(Buffer.from([8, 9]))).toHaveLength(0);
    const frames = splitter.push(Buffer.from([0xff, 0xd9]));
    expect(frames).toHaveLength(1);
    expect([...frameAt(frames, 0)]).toEqual([0xff, 0xd8, 7, 8, 9, 0xff, 0xd9]);
  });

  it("resynchronizes past leading garbage", () => {
    const splitter = new MjpegFrameSplitterV0();
    const frames = splitter.push(Buffer.concat([Buffer.from([0x00, 0x11, 0x22]), jpeg([1])]));
    expect(frames).toHaveLength(1);
    expect(splitter.diagnostics().resyncs).toBeGreaterThan(0);
  });

  it("holds an unterminated still until its end marker arrives", () => {
    const splitter = new MjpegFrameSplitterV0();
    expect(splitter.push(Buffer.from([0xff, 0xd8, 1, 2, 3]))).toHaveLength(0);
    expect(splitter.diagnostics().pending_bytes).toBe(5);
  });

  it("drops a still that grows past the configured ceiling", () => {
    const splitter = new MjpegFrameSplitterV0(16);
    const frames = splitter.push(Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(32, 0x41)]));
    expect(frames).toHaveLength(0);
    expect(splitter.diagnostics().oversized_drops).toBe(1);
  });
});
