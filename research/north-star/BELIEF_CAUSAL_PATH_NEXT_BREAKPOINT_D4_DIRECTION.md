# `BELIEF_CAUSAL_PATH_NEXT_BREAKPOINT` — D4 DESIGN DIRECTION

**`D4_DESIGN_DIRECTION_IDENTIFIED`**
**0 model calls · 0 production changes · 0 architecture changes · 0 new scientific results.**

The round's real job, per the brief, is not to find an experiment that might succeed — it is to try as
hard as possible to show that **our current explanation of the 3B3 null is wrong**, and only then, having
excluded the simpler executor-level accounts, allow the question to be attributed to CharacterOS
architecture. Most of what follows is that attempt.

---

## A. CLOSURE VERIFICATION

The closure artifacts were read and independently re-derived, not taken on trust:

| | |
| --- | --- |
| closure states | `BELIEF_CAUSAL_PATH_D1_D2_D3_EVIDENCE_FROZEN` · `LINK_3B_LOCALIZATION_COMPLETE` · `LINK_4_REMAINS_LOCKED` · `NO_NEW_SCIENTIFIC_CLAIM_ADDED` |
| hash re-verification | 9 dataset/schedule rows recomputed independently → **0 mismatches** |
| frozen facts reproduced from the datasets | A0 HIGH `ENDORSES_STRONGLY` 6, LOW `DOUBTS_STRONGLY` 6 · A1 HIGH `SUPPORTS` 6, LOW `SUPPORTS` 5 + `UNCERTAIN` 1 · D3-B target `SEMANTICALLY_ALIGNED` 6 |
| link 4 | locked; `d2_b_reopened: false` |

Nothing in the frozen evidence has changed, and the counts this analysis rests on were re-derived from
the datasets rather than quoted from a summary.

## B. FAILURE-SPACE DECOMPOSITION

Five candidate mechanisms from the brief, plus one this audit found in the frozen bytes. The important
column is the last one: what the existing evidence does to each candidate.

| id | candidate | status after existing evidence |
| --- | --- | --- |
| **H1** | **Representation binding** — the stance is bound to the literal wording / record identity, not to a proposition-level object | **OPEN, and architecturally confirmed.** Identity *is* the content-address of the exact wording, so the state cannot express that two wordings are one proposition. But the executor could still supply that relation from its own semantics, which D3-B shows it can. Existing evidence cannot decide it. |
| **H2** | **Projection interface** — the canonical state is semantically richer and the projection flattens it | **WEAKENED BY EVIDENCE.** The projection is a *direct field copy*: it adds nothing and drops nothing, and the canonical item is the same three fields. **There is nothing richer to flatten.** H2 therefore collapses into H1 — whatever the executor lacks, CharacterOS never represented it at any layer. |
| **H3** | **Instruction boundary** — the contract never asked for the equivalence to be used | **WEAKENED BY EVIDENCE.** The frozen A1 contract *does* invite it: *"The subject data may word the same idea differently."* H3 as "absent instruction" is not available. |
| **H4** | **Object-vs-proposition semantics** — `credence` read as a property of the record rather than a composable stance on the proposition it expresses | **OPEN**, but in observable consequence it coincides with H1: both predict A0 fine, A1 null. A0 already shows the executor can produce a correct proposition-stance read *for the sentence it was shown*. |
| **H5** | **Transfer is not automatic in the executor** — relation recognition and relation-conditioned inference are different computations | **OPEN, and untouched by existing evidence.** D3-B refutes only the strong form ("cannot relate wordings"); recognising a relation when asked is not the same as using it unasked. **This is the candidate most likely to make the CharacterOS line of inquiry beside the point.** |
| **H6** | **Measurement contract** (found this round, not in the brief's list) | **OPEN, and newly evidenced.** The frozen A1 contract contains two clauses pulling opposite ways: it invites equivalence, and it also says *"the stance to report is the stance toward **THIS** wording"*. A model that answers the second clause literally is reporting a fresh stance on the paraphrase — which is a different question from the transfer question. |

**H6 deserves more weight than a footnote because it is the cheapest rival to every CharacterOS-blame
explanation, and it is visible in the frozen bytes rather than in the model.** It does **not** invalidate
A1: A1 remains a valid null for the question it asked. What it does is supply a reading in which the
representation need not be at fault.

**Which candidates are *not* yet distinguishable:** H1/H4, H5 and H6 all predict the same observable
pattern (A0 positive, D3-B positive, A1 null). No amount of re-reading D1/D2/D3 separates them. That is
the definition of the breakpoint this round had to find.

## C. CURRENT ARCHITECTURE AUDIT — FROM SOURCE, WITH PROVENANCE

Extracted from the implementation, with file:line, in
`evidence/next-breakpoint/CURRENT_BELIEF_REPRESENTATION_AUDIT.json`:

**Canonical storage** (`subject-core/src/types/subject-state.ts:90`) — the item is exactly:

```
{ proposition_id, proposition_label, credence }
```

No proposition-level object distinct from the label string; **no relation, no alias, no equivalence, no
derived stance word, no embedding**. The documented intent is explicit: *"Proposition identity is
CharacterOS-owned"* and *"A credence records only the subject's stance; it is not an objective truth
claim."*

**Proposition identity** (`belief-proposition-admission.ts:190–200`):

```
proposition_key = hashEnvelope("…/belief/proposition-key/v1", { canonical_label })
```

**Identity is the content-address of the exact wording.** Two semantically equivalent re-wordings are,
at the representation level, two unrelated propositions with two different ids. Nothing in the state says
they express the same proposition — that relation exists nowhere in CharacterOS and, in A1, could only
have come from the executor.

**Projection** (`cognition-action-transition-executor.ts:305–317`) — `belief_items` is a *direct copy* of
the three fields, sorted by `proposition_id`, truncated at `BELIEF_COGNITION_MAX_ITEMS = 64`. No
enrichment, no ranking by relevance, no added field.

**Executor-facing block** (`conversation-cognition-provider-v2.ts:213, 273`) — one `JSON.stringify(item)`
per line under a header that states *"credence is subject endorsement strength, NOT world truth"* and
*"**proposition IDs are STATE LOCATORS ONLY, never refs**"*.

**So: what does the system represent belief as? A lexical record — an opaque id, a sentence and a
scalar.** Every layer carries the same three facts; no layer adds a proposition-level object or any
relation between propositions. The executor is never told that the sentence denotes a proposition whose
content could be re-expressed, and the id is explicitly declared to be bookkeeping.

## D. THE MOST INFORMATIVE NEXT QUESTION

> **Can the frozen executor perform the composition `stance(A) + semantically-aligned(A,B) → stance(B)`
> at all, when A, B, `stance(A)` and the relation are supplied explicitly and CharacterOS is entirely
> absent?**

**Why this and nothing else.** Every other candidate next question — improve the projection, add an
instruction, add semantic ids, run more replicates — presupposes an answer to this one. If the executor
cannot perform the composition when it is handed *more* than CharacterOS provides (an explicit stance and
an explicit relation, no record to decode), then the A1 null is at least largely an executor-level
composition limitation, and **no CharacterOS representation change can be shown to be its cause.** Asking
anything else first risks modifying the architecture on the strength of an artifact we have not excluded.

**Why existing evidence cannot answer it.** D3-B shows relation *recognition* with both statements in
front of it; A0 shows stance *reporting* for a sentence it was shown. Neither composes the two, and
neither separates composition from credence-decoding. The composition has never been run.

## E. THE MINIMAL FUTURE EXPERIMENT — STATE-BLIND COMPOSITION BASELINE (design only, not run)

Two cells, **sequentially gated**, both state-blind, both `EXECUTOR_STATE_BLIND_CAPABILITY` — explicitly
**not** CharacterOS causal evidence.

**Cell C0a — composition alone.** Supply, as plain prompt facts: proposition A (synthetic, unrelated to
CAUTION), proposition B, an explicit `stance(A)` **as a stance word**, and the relation
`semantically aligned (A,B)`. Ask for the stance toward B. Fixtures cover endorsement→endorsement,
opposition→opposition, and a negative control with an unrelated pair where no transfer is defined.

**Cell C0b — composition plus decoding** (run **only if C0a is positive**). Identical, except `stance(A)`
is given as a **credence scalar** rather than a stance word, adding the decoding step.

**Each cell's instrument is qualified state-blind before it is used** (3 fixtures × 3 replicates = 9
calls, any invalid failing qualification — the D2/D3 discipline), then a stability gate (6 calls of one
frozen request, unanimity required), then the measurement (6 calls, unanimity required). The positive
predicate, fixtures, anchors, schema and invalid policy are frozen before any call.

**Why this is not "A1 minus a field"** (the brief's §8):

| | CharacterOS A1 | C0a | C0b |
| --- | --- | --- | --- |
| subject-state record | present (belief block) | **absent** | **absent** |
| production framing / observation context | present | **absent** | **absent** |
| relation A↔B | not supplied | **supplied explicitly** | **supplied explicitly** |
| `stance(A)` | must be decoded from a credence inside a record | **supplied as a stance word** | supplied as a credence scalar |
| what it measures | the whole CharacterOS readout | **composition alone** | composition + decoding |

C0a therefore tests the composition capability *itself*, on facts stated in the prompt, with no state
record to decode and no wording-binding clause to obey.

## F. ALTERNATIVE EXPLANATIONS — WHAT EACH OUTCOME WOULD MEAN

| outcome | localization | what it licenses | what it does **not** license |
| --- | --- | --- | --- |
| **C0a valid null** | `EXECUTOR_CROSS_EXPRESSION_STANCE_COMPOSITION_NOT_ESTABLISHED` | the A1 null is at least largely an executor-level composition limitation; the CharacterOS-representation line is de-prioritised | **no CharacterOS architecture change at all** — this outcome *blocks* that line |
| **C0a positive, C0b positive** | composition and decoding both available state-blind; **the A1 null is left unexplained** | designing a C2 comparison (same pair, same stance values, explicit state-blind stance **vs** CharacterOS projection) to decide whether the projection exposes equivalent usable information | not an architecture change; not "the projection is wrong"; C2 must be designed and gate separately |
| **C0a positive, C0b valid null** | the failure is in the **credence→stance decoding step when the target is a re-wording**, not in composition | a sharper localization than any available today; points at how `credence` is interpreted in the presence of a paraphrase (H4) | not a claim about the projection or the prompt |
| **either cell inconclusive** (any invalid / integrity failure) | nothing is localized | nothing | not a null, not a positive; **no re-run to force a result** |

**No outcome of this design reads as "CharacterOS is broken."** The two "positive" branches licence
*designing* a further discriminating stage, never changing behaviour; the null branch explicitly blocks
the architecture line. That asymmetry is deliberate: it is the structural guarantee the brief demanded.

## G. ARCHITECTURE CHANGE GATE

No CharacterOS belief-architecture modification study may be authorised until **all four** hold:

1. **C0a positive and C0b positive** — the executor demonstrably composes a stance across an aligned
   re-wording, and does so from a credence scalar, outside CharacterOS.
2. **The same executor on the CharacterOS projection, same proposition pair, same stance values, remains
   a valid null** — i.e. A1 stands, or a C2 comparison returns a valid null.
3. **The information difference is enumerated explicitly** — the baseline's advantage must be written
   down as a list of specific facts it supplied that the projection did not, not gestured at.
4. **Any proposed change is expressible as supplying an item on that enumerated list.** No speculative
   additions — embeddings, proposition graphs, relation propagation, extra LLM passes — without the
   enumeration that names them as the missing information.

Until those four hold: no projection change, no semantic ids, no embedding, no relation graph, no prompt
instruction, no relation propagation, no additional model pass. Each of those remains a **candidate**, not
a plan.

## RESEARCH ECONOMY

The ledger stands at **141 calls** (D1 66, D2 54, D3 21), and those are not interchangeable: only
scientific-target calls produce link evidence. C0a costs **21** (9 qualification + 6 gate + 6
measurement) and decides whether the CharacterOS line is even implicated; C0b adds **21** only if C0a
licenses it. Against 141 calls already spent inside CharacterOS, 21 calls to test whether CharacterOS
should be under suspicion at all is the cheapest information in the programme.

This round deliberately does **not**: re-test an established link; re-word A1 and repeat it; enlarge
replicates; add prompting to rescue a null; or write the relation or the stance into the answer.

## VERDICT

**`D4_DESIGN_DIRECTION_IDENTIFIED`** — the next experiment should answer one question: whether the frozen
executor can compose a stance across an aligned re-wording at all, given an explicit stance and an
explicit relation and no CharacterOS. It is prior to every architecture question because it decides
whether the A1 null is a statement about CharacterOS in the first place, and it discriminates H5
(executor composition) and H6 (contract clause conflict) from H1/H4 (representation binding) — three
candidate mechanisms that the existing evidence cannot separate.

No D4 preregistration is written here. No model was called. No production file was changed. Link 4
remains locked, and nothing in this analysis authorises an appraisal experiment as a way around 3B3.
