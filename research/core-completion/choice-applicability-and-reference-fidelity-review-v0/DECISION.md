# CHOICE APPLICABILITY + REFERENCE FIDELITY — ARCHITECTURE DECISION

Read-only review of the two defects left by `AFFECT_COGNITION_C4_3_CONTRACT_LEGIBILITY_AND_GROUNDING_V0`
(`AFFECT_COGNITION_C4_3_REVALIDATION_INCONCLUSIVE`, 55/65, formal matrix not run). Repository truth
verified at HEAD `7223580` (`origin/main` identical, clean worktree). **Zero production files changed.
Zero model calls.**

N6 ×5 and R3 ×5 are reproduced and explained below from the frozen raw records
(`forensics.mjs` → `forensics.json`, zero model calls).

## Principal Root Cause

`MULTIPLE_INTERACTING_ISSUES`

Two independent mechanisms with independent fixes, confirmed by the fix-coverage test in both
directions:

1. **`CHOICE_APPLICABILITY_SEMANTICS_STILL_AMBIGUOUS`** — the tag's *names* describe carrier state
   ("selected" / "not applicable"), which the model can read as "I selected an output/response"
   rather than "I made a subjective preference decision". N6 is a deterministic classification whose
   answer is fixed by a supplied rule, yet the model answered `SELECTED` with the plan-shaped stance
   `"I would classify 'abca' as a MATCH."` — a *response plan*, category B of the brief, leaking into
   the subjective-selection slot (category C).
2. **`MODEL_OWNED_CANONICAL_REF_TRANSCRIPTION_FRAGILE`** — the model must re-type 72-character opaque
   `episode:` hashes; in R3 all 5 replicates emitted the same lawful ref with two characters (`67`)
   deleted. Transcription is an *identity* duty, which this programme already moved host-side twice
   (`projection_hash`, Language `input_hash`).

`SINGLE_STAGE_COGNITION_INSUFFICIENT` is rejected: a second stage would still have to decide whether a
subjective selection exists (the applicability question would simply move to stage 1), and the ref
defect is orthogonal to the number of Cognition calls. `MODEL_CAPABILITY_LIMIT` is rejected as an
explanation: the same model copied all 95 other long refs exactly in the same run, and copied R3's
refs exactly under the C4.2 prompt — the fragility is prompt-sensitive, not a stable ceiling.

## Applicability Architecture Status

`CURRENT_TAG_REQUIRES_SEMANTIC_REFINEMENT`

The **shape** (a tagged carrier with a positive non-selection token) is right and C4's
`NOT_APPLICABLE` worked on 25/30 null cells. What is missing is a *semantic contract* the model can
apply: the prompt lists NOT_APPLICABLE *examples* (task-shaped: "arithmetic, a lookup, extraction,
deterministic classification, plain factual restatement") but never states the **discriminator**.
The refinement therefore has two parts, both in the same semantic layer:

- **rename the token values** to `NO_SUBJECTIVE_SELECTION` / `SUBJECTIVE_SELECTION`, so the category —
  not the carrier — is what the model types; and
- **state the latitude principle** as the operative definition: *a subjective selection exists only
  when the supplied facts and rules leave more than one behaviorally admissible response and the
  subject selects among them; if the supplied material determines the answer, there is no subjective
  selection — even when the reply must assert a verdict, a category or a classification.*

Not merely cosmetic: the observed failure is a collision between "selected an output" and "selected a
preference", and making a category explicit in the schema is the lever that has worked three times in
this programme (C3's dedicated field eliminated a 65/65 enum echo; C4.2's explicit allowed/forbidden
classes eliminated 5/5 + 5/5 + 5/5 rationale defects; C4.3's restored contract closed 5/5 N2 cells).
Honest limit: the rename alone is not proven to bind; the latitude statement is the load-bearing part,
and both must be tested by the next qualification.

## Ref Architecture Status

`SHORT_HANDLE_CANONICALIZATION_REQUIRED`

Evidence: 325 model-emitted refs across 65 cells — **325 exact minus 5 corrupted**; the 5 are all R3's
episode hashes (identical 2-character deletion, `delta = -2`, in 5/5 replicates); 0 invented, 0
omitted. Per kind: `observation:` 65/65 exact, `entity:` 60/60, `environment:` 50/50, `subject:`
55/55, **`episode:` 95 exact + 5 corrupted**. Per length band: short 110/110 exact, medium 120/120
exact, **long (>40 chars) 95 exact + 5 corrupted**. Corruption is therefore confined to long opaque
identity strings, and the same scenario was copied perfectly under the C4.2 prompt.

## Principal Architecture Verdict

`REFINE_APPLICABILITY_AND_CHANGE_REF_WIRE_FORMAT`

The two decisions are independent (neither fix touches the other's cells) but they share one
principle: **the model proposes semantics and selects among advertised items; the host owns
deterministic identity.** Applicability refinement makes the category explicit; the wire-format change
stops asking the model to re-type identity.

## Applicability candidate assessment

| Candidate | Assessment |
| --- | --- |
| CA-A keep tag + rely on qualification | **REJECT** — the current prompt already states the rule and failed 5/5 on the one classification scenario; relying on qualification means the gate can never pass while the ambiguity stands |
| **CA-B explicit `SUBJECTIVE_SELECTION` semantics** | **RECOMMENDED** — names the category, adds the latitude discriminator; no new field, no new call, no taxonomy |
| CA-C model-output response semantic mode (`DETERMINISTIC_RESPONSE`/`SUBJECTIVE_SELECTION`/`MIXED`) | REJECT — a second model enum with the same self-report problem, and it drifts toward a task taxonomy |
| CA-D host supplies the selection obligation | **REJECT — not obtainable deterministically.** Verified: the projection exposes only `[context] scene` (raw user text) and the generic `task="Respond to the user's latest message."` for every scenario; there is no turn-kind, option list or obligation field. Deriving it would require arbitrary-NL interpretation. |
| CA-E separate response-plan and selection more strongly | PARTIAL — that is what CA-B does at the naming/definition level; a separate plan field (a second output) would add a misclassification surface without a discriminator |
| CA-F two-stage Cognition | REJECT — stage 1 must still answer applicability; solves neither defect |

**Does the host own applicability?** `NO` (no deterministic structure carries it).
**Does the model own applicability?** `YES` — it must declare the tag; the fix makes the declaration's
semantics unambiguous rather than relocating it.

## Ref candidate assessment

| Candidate | Assessment |
| --- | --- |
| RF-A canonical refs stay model-visible + stronger prompt | REJECT — the prompt already carried the binding and long-ref echo still corrupted in 5/5 R3 cells; prompt wording has now failed three times on identity-copying |
| RF-B alias + canonical ref both emitted | REJECT — re-introduces the exact transcription surface it removes |
| **RF-C host-issued short handles on the model wire, host resolves to canonical refs** | **RECOMMENDED** — the model *selects* an advertised item; the host owns identity; matches the host-bound-hash precedent |
| RF-D integer indices | REJECT — off-by-one risk, positional (breaks if list order changes), poor transcript auditability; handles are self-labelling |
| RF-E host infers the source from claim text | **REJECT with evidence** — R3's claims are `DERIVED_RESULT` paraphrases that appear verbatim in **no** source (0/4 in memory, 0/4 in the observation), so inference would require semantics |

## Exact design — applicability refinement (CA-B)

Model wire tokens change (protocol version bump to `conversation-cognition-proposal-v6`, since the
token values are part of the closed contract):

```ts
type SubjectiveSelectionV1 =
  | { readonly kind: "NO_SUBJECTIVE_SELECTION" }
  | { readonly kind: "SUBJECTIVE_SELECTION"; readonly stance: string; readonly subjective_rationale: string | null };
```

Prompt additions (replacing the NOT_APPLICABLE/SELECTED wording, keeping every other rule):

- **THE DISCRIMINATOR:** "A subjective selection exists ONLY when the supplied facts and rules leave
  more than one behaviourally admissible response and you select among them. If the supplied material
  determines the answer, there is NO subjective selection — even when you must assert a verdict, a
  category, a label or a classification (for example deciding that a token is a MATCH, that a sum is
  42, or that a parcel is on shelf C4). Stating a determined result is not selecting."
- `NO_SUBJECTIVE_SELECTION`: exactly `{ "kind": "NO_SUBJECTIVE_SELECTION" }`, no stance, no rationale.
- `SUBJECTIVE_SELECTION`: the current SELECTED obligations (on-question stance that stands alone,
  bounded non-factual rationale, preference-shaped rationale classes only) unchanged.
- `CLARIFY` requires `NO_SUBJECTIVE_SELECTION`; `REALIZE` admits either.

Everything else is untouched: `current_intent` stays descriptive-only, the rationale policy stays
frozen, stance stays the sole authority, Language's no-semantic-completion rule stays, the factual
authority stays, the projection hash stays host-bound.

## Exact design — ref wire format (RF-C)

**Model wire (V6 provider schema):** the request advertises two handle namespaces next to the content:

```
FACTUAL SOURCE HANDLES (the ONLY handles allowed in factual_assessment.claims[*].source_handles):
- F1: <inspectable factual source content>
- F2: ...
CITEABLE CONTEXT HANDLES (the ONLY handles allowed in considered_context_handles / evidence_handles):
- C1: <context> (entity / environment / episode / observation / subject, as today)
- C2: ...
```

The model emits `source_handles: ["F2"]` in claims and `considered_context_handles` /
`evidence_handles` in `cognition`. Canonical refs are **not** shown in the handle lists (they remain in
the FACTUAL SOURCE REFS / CITEABLE CONTEXT REFS lists for provenance context only, or are omitted
entirely — the implementation must choose one and freeze it; recommended: keep the canonical lists
visible for context but require handles wherever a ref is *used*).

**Host canonicalization (closed, deterministic):**

1. The host builds the handle map for the exact invocation: `F*` from
   `factualAssessmentSourceRefs(projection)` and `C*` from `allowedEvidenceSet(projection)`, each in a
   frozen deterministic order (the existing sorted enumeration), so the same turn always yields the
   same map.
2. Exactly-advertised handles are replaced by their canonical refs. **Unknown handle ⇒ fail closed**
   (`UNKNOWN_SOURCE_HANDLE`); no fuzzy resolution, no prefix matching, no fallback.
3. Duplicate or unsorted handle arrays ⇒ fail (the existing ref-hygiene validators run on the
   canonicalized arrays).
4. The canonicalized proposal then passes the **existing** validators unchanged: lawful factual
   sources, citation binding into both cognition arrays, inspectable content, `SOURCE_QUOTE` verbatim
   substring, claim bounds, §15 evidence membership.

**Handle properties (frozen):** host-issued; turn-local; unique within the turn; ordered
deterministically; `F*` and `C*` namespaces never interchangeable (a context handle can never satisfy a
claim source); maximum = the number of advertised entries; serialization as short strings; **never
persisted**, never in the authoritative proposal, canonical state, commit hashes, history or external
API identity; a handle from a previous turn/request resolves to nothing and fails closed.

**Authoritative stored representation:** canonical refs only, exactly as today — handles exist only on
the model wire and never appear in durable artifacts (§22, §30).

**Unchanged by handles:** which sources are lawful; what a source means; what counts as a fact;
`SOURCE_QUOTE` / `DERIVED_RESULT` semantics; the factual-authority boundary.

**Historical compatibility:** V1–V5 proposals keep canonical refs and are never rewritten; V6
introduces a *model-wire* schema distinct from the authoritative stored schema
(`model wire V6 → host canonicalization → authoritative proposal V6`), which is cleaner than changing
shared types for every historical version.

## Family D

`NOT JUSTIFIED`. Both frozen triggers remained silent in C4.3 (the withhold trigger a near-miss: N6 ×5
is one scenario, the rule requires two), a second stage does not answer applicability, and the ref
defect has nothing to do with stage count.

## Next qualification design (not executed)

Unchanged shape: 13 scenarios (`N1–N6`, `M1–M3`, `R1–R4`) × 5 = 65 cells, `AFFECT_ABSENT`, frozen
before the first call with prompt/schema/harness digests bound, no retries or replacements.

Endpoints:

- **Applicability:** `N1–N6` **30/30 `NO_SUBJECTIVE_SELECTION`** (with `RATIONALE_ABSENT`, correct
  facts, no invented preference, full delivery); `M/R` **35/35 `SUBJECTIVE_SELECTION`** with an
  on-question stance; 0 off-question; 0 semantic completions.
- **Ref fidelity:** every emitted handle lawful (**0 unknown**), **0 canonicalization failures**, all
  authoritative canonical refs exact, all source binding preserved, `SOURCE_QUOTE` still validated on
  the resolved canonical source.
- Unchanged: factual (0 unlawful sources, 0 self-state claims, 0 citation-binding violations),
  rationale (0 forbidden classes), Language (0 changed/dropped/invented/completions/fact-changes),
  0 false CLARIFY, isolation and leakage PASS.
- **Family-D re-freeze (new, symmetric, before calls):** failure-to-declare ⇒ ≥3/5 cells on ≥2
  choice-bearing scenarios without a usable `SUBJECTIVE_SELECTION`; failure-to-withhold ⇒ ≥3/5 cells on
  ≥2 null scenarios declaring `SUBJECTIVE_SELECTION`.
- Formal 476-cell matrix only on 65/65, primary causal endpoint unchanged (Cognition-level
  `SUBJECTIVE_SELECTION.stance` under P vs N).

Not recommended now (§37): reframing the null endpoint as "factual answer invariant + no
Affect-sensitive deviation". The current endpoint is preregistered and defensible; changing it would
require a new freeze and explicit rationale, and it would weaken the experiment's ability to show that
Affect does not convert factual resolution into preference.

## Recommended next slice

Exactly one:

`AFFECT_COGNITION_C4_4_SUBJECTIVE_SELECTION_SEMANTICS_AND_REF_HANDLES_V0`

Implement CA-B + RF-C as specified above, freeze, qualify 65, and run the formal matrix only on 65/65.
No Family D, no task-mode enum, no host-side NL classification, no Affect change.

## Dispositions

Canonical Affect changed: `NO` · Additional model calls: `0` · Expected latency impact: none · New
ontology: `NONE` · Production files changed: `NO` · Real diagnostic model calls: `0`.

Confidence: **MEDIUM** (the diagnosis is HIGH confidence — mechanical, reproduced 5/5, quantified
across 65 cells; the prospective binding of the refinement is MEDIUM, as this model has twice ignored
explicit prompt rules, though structural explicitness has also worked three times).

Largest remaining uncertainty: whether naming the category plus stating the latitude discriminator is
enough for `qwen3.5:9b` to withhold selection on determined-answer tasks. If it is not, the
applicability question has no cheaper answer than host-owned obligation built on new deterministic
structure — which does not exist today — and the next step would be a read-only design review of the
Observation/turn-kind contract, not another prompt revision.
