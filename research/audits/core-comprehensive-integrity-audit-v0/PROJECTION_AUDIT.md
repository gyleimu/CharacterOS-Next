# PROJECTION AUDIT — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

## Section map (V2 / explicit-v4 production surface)

| Rendered section | Canonical source | Transform | Authority / citeable |
|---|---|---|---|
| `[identity]` | `identity.subject_id` | none | state-visible, not citeable |
| `[current state]` | `runtime_metadata.logical_time/state_revision` | none | not citeable |
| `[context] scene/task` | `context.scene/task` | raw interpolation (unescaped) | not citeable |
| `[current observation]` | `context.current_observation_ref` | none | in `allowedEvidenceSet` but not rendered as citeable (AUD-10) |
| `[focus refs]`, `[active entity refs]`, `[environment refs]` | `context.*` | copied | citeable |
| `[memory evidence (allowed refs)]` | `memory_state.working_refs` + `recent_retrieval_refs` | dedup+sort | citeable |
| `[PRIOR FACTUAL MEMORY …]` | resolved evidence bundle | `renderFactualMemoryEvidenceSectionV1` | episode_ref citeable only if also in memory refs; experience/event/actor refs NOT citeable |
| `[affect (canonical)] valence/activation` | `affect.valence/activation` | exact copy | state-visible; no legend (AUD-11) |
| `[regulation]` | regulation | none | state-visible |
| `[SUBJECTIVE BELIEF STANCES …]` | `beliefs.items` sorted, slice 64 | JSON copy | STATE_VISIBLE_NOT_CITEABLE |
| `[relationships]` | counterpart dims minus reserved | sorted | not citeable |
| `[interaction familiarity …]` + influence | derived read projection + fixed policy | derived | STATE_VISIBLE_NOT_CITEABLE |
| `[traits seed …]` | `traits_seed.dimensions` | JSON | not citeable |
| `[current acquired personality …]` + semantics + role | `personality.dimensions` + registry | JSON + anchors | not citeable (V2 only) |
| `CITEABLE CONTEXT REFS` | renderer-chosen set | sorted | executable authority = `allowedEvidenceSet` |
| `[ALLOWED ACTION SPACE]` | host `allowed_actions` | mapped | not hash-bound (AUD-29) |
| `[projection_hash]` | computed hash | — | binding gate |

## Findings

- **AUD-01 (fixed):** V2 builder dropped `additionalRecentRetrievalRefs`, so familiarity-selected evidence never
  reached the provider on the production path (and the trace over-reported selection).
- **AUD-10 (P5):** conversation renderer's citeable list omits `current_observation_ref` while the validator
  allowlist includes it; the V0 renderer uses the allowlist exactly. Test documents the subset as intentional.
- **AUD-11 (P6):** affect line has no range/neutral legend.
- **AUD-14 (P6):** retrieval's semantic anchor is the fresh current-observation ref, so the SEMANTIC dimension
  cannot match any prior episode; effective ranking is salience-tie then recency.
- **AUD-15 (P5):** `recent_retrieval_trace` is always empty; `recent_retrieval_refs` was dead until AUD-01.
- **AUD-25 (P3):** language episode reads use the pre-appraisal repository revision (conditional).
- **AUD-26 (P6):** scene/task interpolated unescaped (format-injection surface; SUBJECT DATA declared untrusted).
- **AUD-29 (P6):** `projection_hash` does not bind the allowed action space on the V0/V1 path.
- **AUD-30 (NO_ACTION):** V0 renderer omits familiarity presence/level but renders the self-contained influence.

## Information loss / semantic mismatch

- No numeric precision loss anywhere (raw IEEE-754 copy, no rounding).
- No inactive state presented as active; absent states render honest ABSENT/`(none)` markers.
- Two prompt surfaces (V0 vs conversation) do not agree on citeability — the only real projection inconsistency.
- The affect section is the only psychological section without a semantic legend.
