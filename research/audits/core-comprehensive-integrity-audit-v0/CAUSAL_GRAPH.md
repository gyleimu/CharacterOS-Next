# CAUSAL GRAPH — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

Edge status legend: `PROVEN` (frozen causal evidence), `IMPLEMENTED_NOT_CAUSALLY_PROVEN`,
`LATENT` (code path exists, not reachable in product), `ABSENT`.

## Strongest currently proven chain

```
event (user text)
 → Observation admitted (conversation ingress)
 → Appraisal (pre-cognition, canonical INITIAL)          PROVEN  (PERSISTENT_SUBJECT_LIVED_HISTORY.../CONTENT_SENSITIVE_APPRAISAL)
 → AffectApplication (canonical commit)                  PROVEN  (affect-application chain; frozen experiments)
 → persistence / checkpoint                              PROVEN  (LONG_HORIZON revalidation: 2/2 EXACT)
 → authoritative restore                                 PROVEN  (same)
 → cognition projection (Memory + canonical affect)      PROVEN  (Level 2/4 lived-history)
 → different cognition request                           PROVEN
 → different current_intent                              PROVEN (real-model differentiation frozen slice)
 → different language behavior                           PROVEN (behavior→experience→memory chain)
 → Experience → durable Memory                          PROVEN
 → future retrieval / future cognition                   PROVEN (longitudinal multi-episode)
```

Every edge above is proven **at the architecture/plumbing level**. The marginal *behavioral value*
of Affect beyond Memory is NOT proven (NON_MEMORY_STATE_EFFECT_UNSTABLE_OR_MODEL_VARIANCE_DOMINATED).

## Full graph with statuses

```
current user event
 → Observation (ingress FIRST/REPLAY/CONFLICT)           IMPLEMENTED_NOT_CAUSALLY_PROVEN
 → Appraisal INITIAL (pre-cognition)                     PROVEN (plumbing)
 → AffectApplication (post-cognition)                    PROVEN (plumbing)
 → canonical Affect                                      PROVEN
 → memory admission (observation or reply+feedback)       PROVEN
 → retrieval (working + familiarity-priority)             IMPLEMENTED_NOT_CAUSALLY_PROVEN
 → factual memory evidence (PRIOR FACTUAL MEMORY)         IMPLEMENTED_NOT_CAUSALLY_PROVEN
 → cognition projection (V2)                              PROVEN (plumbing)
 → cognition provider proposal (intent + directive)       PROVEN (plumbing)
 → Language realization (REALIZE) / host clarify          PROVEN
 → delivered behavior → feedback → Experience → Memory     PROVEN (behavior→experience→memory frozen chain)
 → future state                                            PROVEN

Belief:
 → per-turn semantic provider call                        IMPLEMENTED
 → plasticity UPDATE of existing proposition               LATENT (empty genesis, no INSERT)
 → belief stance → cognition                              LATENT

Relationship:
 → counterpart registration (entity:alice)                 IMPLEMENTED
 → qualifying admission → governed familiarity write       IMPLEMENTED_NOT_CAUSALLY_PROVEN
 → familiarity → cognition influence (context ordering)    IMPLEMENTED_NOT_CAUSALLY_PROVEN
 → familiarity-priority retrieval evidence → cognition      PROVEN after AUD-01 fix (was inert)

Personality:
 → genesis prior P0 → traits_seed + P(t)                   IMPLEMENTED (no product prior)
 → lived-evidence plasticity                              LATENT (disabled; cannot bootstrap)
 → P(t) → cognition soft prior                            IMPLEMENTED_NOT_CAUSALLY_PROVEN (fixture tests only)

Time / regulation:
 → advanceTime → affect recovery → cognition              PROVEN (plumbing)
 → regulation pass-through                                PROVEN (constant)

Action:
 → allowed_actions → ActionIntent                          ABSENT in product (empty space)
```

## Highest-value proven facts for the affect question

1. The canonical affect value reaches the cognition request byte-exactly (projection + prompt).
2. The affect value at cognition is the pre-current-event state (one-turn lag, AUD-12).
3. Retrieval and Memory are byte-identical across the previous ablation's conditions.
4. Real-provider temperature-0 output is NOT deterministic (directive flip on identical request),
   so the affect-beyond-Memory question needs replication, not a single A/B.
