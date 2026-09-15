/* globals fetch */
/**
 * Provider instance identity (upstream adjudication 9eb0994 §6/§35):
 * version, model digest, base URL, process start timestamps where observable.
 * Best-effort and read-only: an unavailable field is recorded as null, never guessed.
 */
import { execFileSync } from 'node:child_process';

export async function providerInstance(baseUrl, model) {
  const version = await (await fetch(`${baseUrl}/api/version`)).json();
  const tags = await (await fetch(`${baseUrl}/api/tags`)).json();
  const installed = tags.models?.find((entry) => entry.name === model) ?? null;
  let processes;
  try {
    const output = execFileSync('powershell', ['-NoProfile', '-Command',
      "Get-Process ollama -ErrorAction SilentlyContinue | Select-Object Id,StartTime | ConvertTo-Json -Compress"], { encoding: 'utf8' });
    processes = JSON.parse(output);
    if (!Array.isArray(processes)) processes = [processes];
  } catch { processes = null; }
  return {
    provider_version: version.version ?? null,
    model_name: installed?.name ?? null,
    model_digest: installed?.digest ?? null,
    base_url: baseUrl,
    processes: processes === null ? null : processes.map((entry) => ({ id: entry.Id, start_time: entry.StartTime })),
    captured_at: new Date().toISOString()
  };
}

export function instanceIdentityChanged(before, after) {
  const key = (instance) => JSON.stringify(instance === null ? null : {
    provider_version: instance.provider_version, model_digest: instance.model_digest,
    processes: instance.processes
  });
  return key(before) !== key(after);
}
