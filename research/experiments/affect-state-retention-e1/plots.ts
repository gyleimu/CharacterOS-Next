/**
 * STATE_RETENTION_AND_RECOVERY_E1 — deterministic SVG plots (§40).
 * Pure string generation from sample arrays; no dependencies, no randomness,
 * identical inputs produce byte-identical SVG.
 */

export interface PlotSeriesE1 {
  readonly label: string;
  readonly color: string;
  readonly points: readonly (readonly [number, number])[];
  readonly dashed?: boolean;
}

const WIDTH = 900;
const HEIGHT = 340;
const MARGIN = { left: 56, right: 16, top: 30, bottom: 40 };

function escapeXml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function linePlot(title: string, yLabel: string, yMin: number, yMax: number, xMax: number, series: readonly PlotSeriesE1[]): string {
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const sx = (t: number): number => MARGIN.left + (t / xMax) * plotW;
  const sy = (y: number): number => MARGIN.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;
  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`);
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="white"/>`);
  parts.push(`<text x="${MARGIN.left}" y="20" font-family="monospace" font-size="14" fill="#111">${escapeXml(title)}</text>`);
  // axes + gridlines (fixed y ticks)
  parts.push(`<line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${HEIGHT - MARGIN.bottom}" stroke="#888"/>`);
  parts.push(`<line x1="${MARGIN.left}" y1="${HEIGHT - MARGIN.bottom}" x2="${WIDTH - MARGIN.right}" y2="${HEIGHT - MARGIN.bottom}" stroke="#888"/>`);
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const y = yMin + ((yMax - yMin) * i) / tickCount;
    const py = sy(y);
    parts.push(`<line x1="${MARGIN.left}" y1="${py}" x2="${WIDTH - MARGIN.right}" y2="${py}" stroke="#eee"/>`);
    parts.push(`<text x="${MARGIN.left - 6}" y="${py + 4}" font-family="monospace" font-size="10" fill="#333" text-anchor="end">${Number(y.toPrecision(4))}</text>`);
  }
  for (let i = 0; i <= 6; i++) {
    const t = (xMax * i) / 6;
    parts.push(`<text x="${sx(t)}" y="${HEIGHT - MARGIN.bottom + 14}" font-family="monospace" font-size="10" fill="#333" text-anchor="middle">${Number(t.toPrecision(4))}</text>`);
  }
  parts.push(`<text x="12" y="${HEIGHT / 2}" font-family="monospace" font-size="11" fill="#333" transform="rotate(-90 12 ${HEIGHT / 2})" text-anchor="middle">${escapeXml(yLabel)}</text>`);
  parts.push(`<text x="${WIDTH / 2}" y="${HEIGHT - 6}" font-family="monospace" font-size="11" fill="#333" text-anchor="middle">experiment time (ticks)</text>`);
  for (const s of series) {
    const points = s.points.map((p) => `${sx(p[0]).toFixed(3)},${sy(p[1]).toFixed(3)}`).join(" ");
    parts.push(`<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="1.4"${s.dashed === true ? ' stroke-dasharray="6 4"' : ""}/>`);
  }
  // legend
  let ly = MARGIN.top + 8;
  for (const s of series) {
    parts.push(`<line x1="${WIDTH - 230}" y1="${ly}" x2="${WIDTH - 210}" y2="${ly}" stroke="${s.color}" stroke-width="2"${s.dashed === true ? ' stroke-dasharray="6 4"' : ""}/>`);
    parts.push(`<text x="${WIDTH - 204}" y="${ly + 4}" font-family="monospace" font-size="11" fill="#111">${escapeXml(s.label)}</text>`);
    ly += 16;
  }
  parts.push(`</svg>`);
  return parts.join("\n") + "\n";
}
