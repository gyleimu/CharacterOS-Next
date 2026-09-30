/* eslint-disable no-restricted-imports -- research probe */
import { buildArmWorldV0 } from "../belief-state-sensitivity-d1/world-a1.ts";
import { buildProjectionV0 } from "../belief-state-sensitivity-d1/state-construction.ts";
import { cognitionSystemPromptForV8, cognitionUserContentForV8 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

const out: Record<string, { sys: string; user: string; credence: number; proposition_id: string }> = {};
for (const level of ["HIGH", "LOW", "NEUTRAL"] as const) {
  const w = await buildArmWorldV0(level);
  const projection = await buildProjectionV0(w.post_observation_state);
  out[level] = {
    sys: cognitionSystemPromptForV8(projection),
    user: cognitionUserContentForV8(projection, {}),
    credence: w.credence,
    proposition_id: w.proposition_id
  };
}
const H = out["HIGH"]!, L = out["LOW"]!, N = out["NEUTRAL"]!;
console.log("sysLen:", H.sys.length, L.sys.length, N.sys.length);
console.log("userLen:", H.user.length, L.user.length, N.user.length);
console.log("system HIGH===LOW ?", H.sys === L.sys, "| HIGH===NEUTRAL ?", H.sys === N.sys);
console.log("proposition ids:", H.proposition_id, L.proposition_id, N.proposition_id);
const show = (a: string, b: string, tag: string) => {
  const al = a.split("\n"), bl = b.split("\n");
  console.log(`--- ${tag}: lines ${al.length}/${bl.length}`);
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i += 1) {
    if (al[i] !== bl[i]) console.log(`  @${i}\n    A: ${al[i]}\n    B: ${bl[i]}`);
  }
};
show(H.sys, L.sys, "SYSTEM H-vs-L");
show(H.user, L.user, "USER H-vs-L");
