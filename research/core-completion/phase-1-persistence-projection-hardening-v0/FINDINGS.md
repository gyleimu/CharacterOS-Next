# FINDINGS — CORE_PERSISTENCE_AND_PROJECTION_HARDENING_V0

Every finding below was re-verified against the code at HEAD `be722b6` before any patch
(the audit report was treated as a hypothesis, not truth).

## Confirmed defects fixed in this slice

### AUD-11 — canonical affect prompt line had no interpretation legend (P6 → FIXED)
- **Contract**: projection semantic interoperability — the model must be able to interpret
  canonical state; sibling sections (belief, familiarity, personality) all carry legends.
- **Root cause**: the frozen projection deliberately avoided named emotions but never added
  the numeric legend. Ranges exist only in a validator/source comment.
- **Patch**: one shared constant `CANONICAL_AFFECT_LEGEND_V0` in
  `cognitive-prompt-projection.ts`, rendered immediately after the canonical value line on
  both V2 surfaces (cognition-action prompt and conversation cognition prompt). Ranges are
  copied from the `CanonicalAffectV0` validator: `valence ∈ [-1,1]`, `activation ∈ [0,1]`.
  No named emotions, no behavioral instructions, no number→emotion mapping.
- **Regression**: `canonical-affect-cognition-integration-v0.test.ts` (AUD-11 test) +
  `conversation-cognition-provider.test.ts` §48.13.

### AUD-10 — conversation prompt citeable list diverged from the enforced allowlist (P5 → FIXED)
- **Contract**: `cognitive-prompt-projection.ts` declares the rendered citeable list is the
  exact `allowedEvidenceSet`; the V0 renderer, the LLM cognition provider and the
  conversation executor already derive from it. The conversation renderer hand-rolled a
  5-source subset that omitted `current_observation_ref`.
- **Root cause**: two prompt surfaces diverged; the newer one documented the divergence as a
  "lawful SUBSET", which is a false-confidence assertion (TEST_GAP_AUDIT pattern 1).
- **Patch**: the conversation renderer now derives from `allowedEvidenceSet(projection)` —
  one authority truth for prompt declaration and executable validation. The test asserts
  EXACT equality instead of subset tolerance.
- **Regression**: `conversation-cognition-provider.test.ts` §48.12.

### AUD-06 — repeated external observations created duplicate lived experience (P3 → FIXED)
- **Contract**: external Observation FIRST/REPLAY/CONFLICT; one external event must not
  become two durable episodes.
- **Root cause**: the Observation transition id binds `expected_state_revision`, which
  advances after the first commit, so a re-offer derived a NEW id and a second episode. The
  session authority had no replay gate; the product wrapper deduped independently.
- **Patch**: `external-observation-identity.ts` derives one content-addressed fingerprint
  over the exact semantic observation content and resolves the prior state from
  **authoritative canonical committed history** (committed Observation bundles). No parallel
  ledger, no process-local state, no change to the frozen transition-id law.
  - FIRST → no committed Observation for the identity ⇒ commit as before.
  - REPLAY → same identity + same fingerprint ⇒ return the SAME transition id / episode ref,
    commit nothing.
  - CONFLICT → same identity + different fingerprint ⇒ typed fail-closed error, no mutation.
- **Durability**: canonical bundles are exactly what authoritative restore rebuilds, so the
  gate survives process death (proven in `TRACE.json` and the runtime regression).
- **Regression**: `packages/runtime/src/session/external-observation-replay.test.ts`.

### AUD-07 — transition-identity journal was not durable (P3 → FIXED)
- **Contract**: the identity journal is the durable idempotency authority across restart.
- **Root cause**: `SessionDurableStateV0` has no journal field; restore built a fresh empty
  journal while `rebuildFromCommittedBundles` existed with no runtime caller.
- **Patch**: `restoreFromDurableState` now calls
  `assembly.journal.rebuildFromCommittedBundles(source.bundles)`. Only committed canonical
  evidence is reconstructed — no serialized capability objects, no WeakSet serialization.
- **Regression**: `packages/subject-core/src/identity/journal.test.ts` (rebuild → a
  restarted journal resolves an already-consumed transition as `SAME_TERMINAL_COMMITTED`,
  and the first-seen sequence counter recovers).

### AUD-08 — `checkpoint_ref` was computed but never verified (P3 → FIXED)
- **Contract**: `checkpoint_ref` is a content-addressed binding of the checkpoint body.
- **Root cause**: verification was never implemented on the read side; the checkpoint body
  was trusted as-is.
- **Patch**: one derivation authority (`deriveSessionCheckpointRefV0`) is shared by
  `checkpoint()` and a new fail-closed `verifySessionCheckpointRefV0`. `restoreFromSource`
  verifies the ref BEFORE rebuilding any state. `created_at` is deliberately excluded, so it
  remains observational (a changed timestamp alone does not fail). The one product call site
  that reconstructed a checkpoint body (`environment-subject-host.ts`) now derives a
  self-consistent ref and additionally verifies the persisted sidecar's own ref.
- **Regression**: `subject-session-v0.test.ts` (tampered body → FAILED; changed `created_at`
  → RESTORED) + existing environment continuity tests.

## Findings verified, not changed

- **AUD-12 (pre-current-event affect)**: confirmed still present and deliberate. Appraisal is
  pre-cognition; current-event `AffectApplication` runs after cognition. Frozen and
  documented (see `AFFECT_TIMING.md`). No lifecycle reorder — no GPT-6 gate was hit because
  no frozen requirement contradicts it.
- **AUD-01/02/03/04/05/09**: re-ran their regression tests; all green.
- **AUD-22 (`durable.identity.affect` observational)**: left observational. The canonical
  head is authoritative; promoting a duplicated checkpoint copy to authority risks
  split-brain authority (program §28). Documented, no change.
- **AUD-19/20/23/24/25**: documentation/comment drift and low-priority projection nits.
  Deferred — they do not block Phase 2 and changing them is not needed for integrity.
- **AUD-17/18**: authority/scope weaknesses, trusted-composition only; deferred (no new
  authority boundary in Phase 1).

## Retrieval channel classification (TARGET J — no redesign)

| Channel | Classification | Basis |
|---|---|---|
| `recent_retrieval_refs` | ACTIVE | fed by familiarity-selected refs (AUD-01 fix) and projected into CITEABLE CONTEXT REFS |
| `recent_retrieval_trace` | INTENTIONALLY_EMPTY / LEGACY | `retrieval_trace_ref: null` hardcoded; channel declared in schemas but no producer. Harmless; document + defer (program §20) |
| retrieval SEMANTIC dimension (AUD-14) | LEGACY / EFFECTIVELY DEAD | anchor is the fresh current-observation ref, which cannot match any prior episode; effective ranking is salience-tie + recency. Re-anchoring changes retrieval semantics ⇒ its own slice |
| environment / external channel label | BY DESIGN | external episodes are retrievable into human cognition with no channel label (documented confound surface) |

No retrieval algorithm was changed.
