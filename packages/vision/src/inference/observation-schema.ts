/**
 * The structured-output contract, enforced by the DECODER rather than by hope.
 *
 * A 1.3B model does not reliably follow a prose type signature. Measured on the
 * real desktop with MiniCPM-V 4.6 (Ollama, temperature 0):
 *
 *   - prose contract          → `"confidence": 5` (1-10 scale), `entities` as
 *                               an array of strings, single strings where a list
 *                               was requested
 *   - prose + filled example  → correct shape, but invalid JSON (a missing comma
 *                               between two members) on 3/3 deterministic runs
 *   - JSON-schema grammar     → valid JSON with the exact shape, 3/3 runs
 *
 * So the schema below is passed to the runtime as a decoding grammar. The
 * validator in `observation.ts` remains the fail-closed backstop: this file
 * makes bad output unlikely, it does not make the adapter trust it.
 */

/**
 * JSON Schema for one observation. Kept in sync with `ModelObservationV0`.
 *
 * The `maxItems`/`maxLength` bounds are load-bearing, not cosmetic: a text-dense
 * screen (the acceptance run had a code editor plus a scrolling test terminal)
 * made the model enumerate on-screen text until it ran past the token budget,
 * which truncated the answer mid-JSON (`INVALID_MODEL_OUTPUT` after 15-16 s).
 * Capping the grammar keeps the answer complete — measured 133 tokens / 2.6 s
 * instead of a truncated 900.
 */
const SHORT_STRING_V0 = { type: "string", maxLength: 120 } as const;
const SHORT_LIST_V0 = (maxItems: number) => ({ type: "array", maxItems, items: SHORT_STRING_V0 }) as const;

export const OBSERVATION_JSON_SCHEMA_V0 = {
  type: "object",
  properties: {
    description: { type: "string", maxLength: 400 },
    confidence: { type: ["number", "null"] },
    entities: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          type: { type: "string", maxLength: 40 },
          description: SHORT_STRING_V0,
          confidence: { type: ["number", "null"] }
        },
        required: ["type", "description"]
      }
    },
    activities: SHORT_LIST_V0(5),
    visible_text: SHORT_LIST_V0(6),
    notable_events: SHORT_LIST_V0(5),
    uncertainty: SHORT_LIST_V0(4),
    application: { type: ["string", "null"], maxLength: 60 }
  },
  required: [
    "description",
    "confidence",
    "entities",
    "activities",
    "visible_text",
    "notable_events",
    "uncertainty",
    "application"
  ]
} as const;

/**
 * Field guidance that accompanies the grammar. It is not the type system anymore
 * (the schema is), so it only states the observations that matter and the scale
 * of `confidence`.
 */
export const OBSERVATION_FIELD_GUIDANCE_V0 = `Answer with ONE JSON object.
- "description": one or two short sentences about what is actually visible.
- "confidence": how sure you are, as a decimal from 0 to 1.
- "entities": every observed object, each as {"type","description","confidence"}.
- "activities": what is visibly happening.
- "visible_text": only text you can actually read, at most 8 short items.
- "notable_events": anything that changed or stands out.
- "uncertainty": anything you are unsure about, instead of guessing.
- "application": the application that dominates the screen, or null.
Use empty arrays when there is nothing to report, and keep the whole answer short.`;
