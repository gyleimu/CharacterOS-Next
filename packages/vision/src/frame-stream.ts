/**
 * MJPEG stream framing.
 *
 * ffmpeg writes a continuous concatenation of JPEG images to one pipe; this
 * splitter turns that byte stream back into whole stills. JPEG entropy-coded data
 * byte-stuffs `0xFF`, so a `FF D9` sequence cannot occur inside a scan — scanning
 * for the EOI marker is exact for the streams this adapter produces.
 */

const SOI_0 = 0xff;
const SOI_1 = 0xd8;
const EOI_0 = 0xff;
const EOI_1 = 0xd9;

export interface MjpegSplitterDiagnosticsV0 {
  readonly pending_bytes: number;
  readonly resyncs: number;
  readonly oversized_drops: number;
}

export class MjpegFrameSplitterV0 {
  private buffer: Buffer = Buffer.alloc(0);
  private resyncs = 0;
  private oversizedDrops = 0;

  /** A single still above this size is treated as a desynchronized stream. */
  constructor(private readonly maxFrameBytes = 16 * 1024 * 1024) {}

  push(chunk: Buffer): readonly Buffer[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    const frames: Buffer[] = [];
    for (;;) {
      const start = this.findStart();
      if (start < 0) {
        // No SOI in the pending bytes: everything before it is unparsable noise.
        if (this.buffer.length > 0) {
          this.resyncs += 1;
          this.buffer = Buffer.alloc(0);
        }
        break;
      }
      if (start > 0) {
        this.resyncs += 1;
        this.buffer = this.buffer.subarray(start);
      }
      const end = this.findEnd(2);
      if (end < 0) {
        if (this.buffer.length > this.maxFrameBytes) {
          this.oversizedDrops += 1;
          this.buffer = Buffer.alloc(0);
        }
        break;
      }
      frames.push(Buffer.from(this.buffer.subarray(0, end)));
      this.buffer = this.buffer.subarray(end);
    }
    return frames;
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
  }

  diagnostics(): MjpegSplitterDiagnosticsV0 {
    return {
      pending_bytes: this.buffer.length,
      resyncs: this.resyncs,
      oversized_drops: this.oversizedDrops
    };
  }

  private findStart(): number {
    for (let index = 0; index + 1 < this.buffer.length; index += 1) {
      if (this.buffer[index] === SOI_0 && this.buffer[index + 1] === SOI_1) return index;
    }
    return -1;
  }

  private findEnd(from: number): number {
    for (let index = from; index + 1 < this.buffer.length; index += 1) {
      if (this.buffer[index] === EOI_0 && this.buffer[index + 1] === EOI_1) return index + 2;
    }
    return -1;
  }
}
