# BELIEF_NEW_PROPOSITION_EVIDENCE_POLICY_BINDING_REVIEW — DECISION

READ-ONLY protocol adjudication. **Real model calls: 0. Production changes: NONE.**
HEAD `9de7361` (`main`, clean). Eligibility / label / identity / 0.55 credence /
paraphrase-distinctness / model-authority ceilings are NOT reopened (§26/§27).

## Statuses

| §  | Item | Verdict |
| --- | --- | --- |
| 35 | Principal root cause | `NO_PERSISTED_ADMISSION_POLICY_DISCRIMINATOR` |
| 36 | Existing discriminator status | `NO_EXISTING_DISCRIMINATOR_SUFFICIENT` |
| 37 | Binding status | `DYNAMIC_ADMISSION_NOT_BINDABLE` |
| 38 | Policy registry status | `DYNAMIC_ADMISSION_NOT_SUPPORTED` |
| 39 | Core status | `DYNAMIC_ADMISSION_REJECTED` |
| 40 | Principal architecture verdict | `CLOSE_DYNAMIC_NEW_PROPOSITION_ADMISSION` |

## Evidence: what a belief INSERT durably persists

`AtomicCommitBundleV2` persists, for every commit: `commit_version`, the **complete
canonical proposal** (`canonical_proposal: CanonicalTransitionProposalV1`), a generic
`writer_authority` envelope (null for ordinary, non-reserved commits such as `/beliefs`),
`commit_ref`, `transition_id`, `transition_type`, `payload_fingerprint`,
`prepared_result_ref`, revisions, predecessor linkage and `next_snapshot`
(`packages/subject-core/src/types/persistence-v2.ts:39-61`).

Consequences:

- **Durable**: proposition id/label/credence (inside the `/beliefs` replacement and the
  snapshot), the canonical proposal and its fingerprint, transition identity, the chain.
- **NOT durable**: the belief-domain proposal (`BeliefMutationProposalV0`) and its
  `BeliefEvidenceBindingV0` — the executor consumes them and emits a canonical delta; the
  bundle never stores them. No persisted field carries a belief proposal family/version,
  an admission-policy id, or a field-local proof.

Therefore no existing persisted discriminator can select a static policy registry entry for
a given historical INSERT (§2: a registry alone is insufficient without a selector; §14).

## Why every heavier route is rejected under the freeze

- **Option A (existing discriminator)** fails: `mutation.kind = INSERT` and
  `transition_type = "Belief"` do not distinguish *dynamic lived-evidence admission under
  policy V0* from tests/fixtures/other producers (§6), and no proposal-version field is
  persisted.
- **Option B (additive `BeliefEvidenceBindingV1` / `BeliefMutationProposalV1`)** fails at
  the durability step: the V1 binding would live in a domain proposal that the commit
  pipeline does not persist; making it durable would require either canonical Belief state
  (forbidden, §19) or generic commit-metadata/bundle changes (Core reopen, §31/§32).
- **Option C (static policy registry)** fails for the same selector reason (§14).
- **Option D (durable admission receipt)** fails §15/§43: the receipt has nowhere to be
  authority-bound — the canonical proposal carries no field for it, `cause_refs`/
  `external_refs` are ref-resolution surfaces (a new convention there would be a
  Core-level change), and a free-floating receipt without an authoritative binding is
  explicitly rejected.

## Closed verdict (§44 wording)

> CharacterOS V0 supports persistent evolution only of already-admitted Belief
> propositions; dynamic new-proposition acquisition is intentionally unsupported under the
> current Core freeze.

This is a scope decision, not an implementation failure. It does not reopen Core, does not
pollute canonical Belief state, does not change proposition identity, initial credence or
evidence eligibility, and does not alter existing-proposition plasticity (which remains the
only Belief evolution path, with `EXISTING_BELIEF_SELF_REINFORCEMENT_RISK` still recorded
and unfixed here).

## Compatibility (unchanged by this decision)

| Case | Readable | Writable | Historically validated | Live producer | Downgrade |
| --- | --- | --- | --- | --- | --- |
| Historical Belief V0 proposal + V0 binding | yes | yes (existing paths) | yes (unchanged laws) | existing plasticity only | n/a |
| Dynamic new-proposition admission | — | **no** | not applicable | **none** | forbidden |
| Existing-proposition update/plasticity | yes | yes | yes | yes | n/a |
| Restore of any history | yes | n/a | yes | n/a | n/a |

Generic Atomic Commit: unchanged. Generic restore: unchanged. Canonical Belief state:
unchanged.

## Recommended next slice

**`BELIEF_EXISTING_POSITION_SELF_REINFORCEMENT_REVIEW`** — the exact name frozen by the
previous slice's §61 is `BELIEF_EXISTING_PROPOSITION_SELF_REINFORCEMENT_REVIEW` (READ-ONLY):
bound the recorded `EXISTING_BELIEF_SELF_REINFORCEMENT_RISK` in the still-live
existing-proposition plasticity path, since that path is now the only way canonical Belief
can evolve. After it clears, the project's next move is a roadmap choice (Personality
product enablement / cross-domain persistent-state demo / product vertical slice), not
further Belief admission work.
