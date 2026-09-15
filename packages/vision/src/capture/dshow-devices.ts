/**
 * DirectShow device enumeration.
 *
 * `device_index` in the adapter configuration is resolved to the DirectShow
 * device NAME here, because that is what the capture filter takes. Enumeration is
 * a one-shot `-list_devices` probe that exits non-zero by design (it opens a
 * dummy input to force the device list).
 */

import { spawn } from "node:child_process";

export interface DshowVideoDeviceV0 {
  readonly index: number;
  readonly name: string;
}

export type DshowEnumerationResultV0 =
  | { readonly ok: true; readonly devices: readonly DshowVideoDeviceV0[] }
  | { readonly ok: false; readonly detail: string };

const DEVICE_PATTERN = /^\s*\[[^\]]*\]\s+"(.+)"\s+\(video\)\s*$/;

export async function listDshowVideoDevicesV0(
  ffmpegPath: string,
  timeoutMs = 15000
): Promise<DshowEnumerationResultV0> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let output = "";
    let settled = false;
    const finish = (result: DshowEnumerationResultV0): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, detail: `device enumeration timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    // The device list is printed on stderr.
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", (error: Error) => {
      finish({ ok: false, detail: `cannot run ${ffmpegPath}: ${error.message}` });
    });
    child.on("close", () => {
      const devices: DshowVideoDeviceV0[] = [];
      for (const line of output.split(/\r?\n/u)) {
        const match = DEVICE_PATTERN.exec(line);
        const name = match?.[1];
        if (name === undefined) continue;
        devices.push({ index: devices.length, name });
      }
      finish({ ok: true, devices });
    });
  });
}
