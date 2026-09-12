# TEST GAP AUDIT — CORE_COMPREHENSIVE_INTEGRITY_AUDIT_V0

Not "do tests pass" but "do tests test the intended property".

## False-confidence patterns found

1. **Comment/assertion mismatch on citeability** — `conversation-cognition-provider.test.ts:17` claims the
   provider-facing ref set equals the lawful citeable set **exactly**, while the assertion at `:369` accepts a
   lawful **SUBSET**. The divergence (AUD-10) is thereby encoded as correct.
2. **v3-only coverage of a v4 production feature** — the familiarity-priority retrieval integration tests use
   `subject-state-v3`; the explicit-v4 dispatch (the product path) was never exercised, which is exactly how
   AUD-01 shipped inert. Fixed and now covered by the new v4 regression test.
3. **Fixture-only provenance tests** — personality salience/isolation tests hand-author P0/P1 projections and
   assert renderer semantics; they do not show any real subject ever has non-empty Personality (AUD-21).
4. **Tolerated reconstruction** — `subject-session-v0.test.ts:227` accepts `EXACT` **or**
   `EXPECTED_RECONSTRUCTED_IDENTITY`, so a head mismatch was never treated as failure (AUD-05 class).
5. **Isolation-only authority tests** — `BeliefTransitionExecutor` INSERT is tested directly, never through a
   product-reachable producer; the product path can never reach it (AUD-16).
6. **Deterministic fakes** — most session tests use deterministic transports. This is correct for plumbing but
   cannot prove real-model semantics; the previous ablation demonstrated temperature-0 nondeterminism, so no
   test or experiment may assume same-request → same-output.

## Properties with no test at all

- External observation replay / conflict dedup (AUD-06) — confirmed duplicated by `adversarial.mjs`.
- Durable persistence and reload of the transition-identity journal (AUD-07).
- `checkpoint_ref` content verification (AUD-08).
- Cross-subject restore binding for the long-horizon seam (AUD-09) — fixed, guard added (test light).
- Retrieval selection when a payload's self-declared `episode_ref` differs from its manifest binding (AUD-03)
  — now covered.
- Citation authority agreement between the prompt-rendered citeable list and the validator allowlist (AUD-10).
- Interpretation of the canonical affect line by a real model (AUD-11).

## What the suite proves well

- Canonical write path: authorization, identity rebinding, CAS, checksum/commit_ref recomputation, chain
  replay, restore continuity.
- Affect equations, validation, recovery, and projection exactness.
- Belief/relationship/personality contract mathematics (stance, arbitration tie law, reserved-dimension
  isolation, no fabricated neutrals).
- Language strict binding (input_hash, evidence allowlist, no retry/repair).
- Memory payload authority, visibility ancestry, deterministic ranking.

## Recommendation

Add the deferred regressions for AUD-06/07/08 and replace subset-tolerant assertions with exact-equality
assertions once AUD-10 is resolved. Treat any assertion that passes for two structurally different outcomes
as a coverage smell.
