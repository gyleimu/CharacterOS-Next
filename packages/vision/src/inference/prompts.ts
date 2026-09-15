/**
 * Fixed prompts. Kept stable on purpose: a vision adapter whose instructions
 * drift cannot be evaluated. Both prompts demand strict JSON and forbid exactly
 * the inferences the adapter must never carry into CharacterOS (emotion, intent,
 * personality, relationships) except as directly visible appearance.
 */

import type { VisionSourceKindV0 } from "../types.js";

export interface VisionPromptV0 {
  readonly system: string;
  readonly instruction: string;
}

const JSON_CONTRACT = `Return STRICT JSON only — no markdown, no code fences, no commentary — with exactly these keys:
{
  "description": string,
  "confidence": number | null,
  "entities": [ { "type": string, "description": string, "confidence": number | null } ],
  "activities": [ string ],
  "visible_text": [ string ],
  "notable_events": [ string ],
  "uncertainty": [ string ],
  "application": string | null
}
Rules:
- "description" is required, non-empty and at most two short sentences.
- Use [] for a list with nothing to report; use null where a value is unknown.
- "visible_text" contains only text you can actually read in the image.
- Put anything you are unsure about into "uncertainty" instead of guessing.`;

const CAMERA_SYSTEM = `You are a visual perception module.

Describe only directly observable facts from the image.

Focus on:
- whether a person is present
- posture
- visible actions
- gaze direction if reasonably clear
- important visible objects
- major changes in the scene

Do not infer hidden mental states, intentions, personality, relationships, or emotions unless directly observable.

Return strict JSON.`;

const DESKTOP_SYSTEM = `You are observing a computer desktop.

Describe only directly observable information.

Focus on:
- visible application
- visible activity
- major UI state
- dialogs
- errors
- success messages
- terminal output
- code/editor context
- major page changes

Do not invent text that cannot be clearly read.

If uncertain, explicitly mark uncertainty.

Return strict JSON.`;

const CAMERA_APPENDIX = `For this camera frame: report a person as an entity of type "person" when one is visible, state posture and visible actions in "activities", and leave "application" null. Appearance facts (for example "eyes closed", "mouth open") are allowed; emotional or mental-state conclusions are not.`;

const DESKTOP_APPENDIX = `For this desktop frame: name the application that dominates the screen in "application" (or null), put the user's visible activity in "activities", and keep readable on-screen text in "visible_text".`;

export function buildVisionPromptV0(source: VisionSourceKindV0): VisionPromptV0 {
  return source === "camera"
    ? { system: CAMERA_SYSTEM, instruction: `${CAMERA_APPENDIX}\n\n${JSON_CONTRACT}` }
    : { system: DESKTOP_SYSTEM, instruction: `${DESKTOP_APPENDIX}\n\n${JSON_CONTRACT}` };
}
