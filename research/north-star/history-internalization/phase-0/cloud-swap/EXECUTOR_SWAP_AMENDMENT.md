# EXECUTOR SWAP AMENDMENT — PHASE 0 CLOUD CONDITION

**`EXECUTOR_SWAP_AUTHORISED_BY_OPERATOR`** · **`CLOUD_CONDITION_INFRASTRUCTURE_READY`**
**`MODEL_CALLS_THIS_ROUND = 0`** · **`PACKAGES_UNMODIFIED`** · **`SCIENCE_REUSED_BY_REFERENCE`**
`PHASE0_CLOUD_READINESS_NOT_YET_RUN` · `HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED`

Frozen before the first provider call of the swapped condition. It authorises **readiness only**; it
does not execute preparation, qualification or any scientific turn.

---

## 1. THE DECISION

The operator selected **Option 2 — replace the executor as infrastructure** from
`CONSTRAINED_OUTPUT_FEASIBILITY_VERDICT_FINAL.json`, with one constraint added:

```
CS_OPERATOR_DECISION   = OPTION_2_REPLACE_THE_EXECUTOR_AS_INFRASTRUCTURE
CS_OPERATOR_CONSTRAINT = DO_NOT_USE_THE_LOCAL_QWEN_EXECUTOR_IN_THIS_CONDITION
```

New executor condition:

```
provider      DEEPSEEK_OPENAI_COMPATIBLE
api style     OPENAI_COMPATIBLE_CHAT_COMPLETIONS  (POST {base_url}/chat/completions)
base url      https://api.deepseek.com
model         deepseek-flash
temperature   0
reasoning     provider-level thinking.type = disabled
enforcement   OPENAI_COMPATIBLE_JSON_SYNTAX_MODE_ONLY
credential    MODEL_API_KEY, environment ONLY (presence + fingerprint recorded; value never written)
```

## 2. WHY THIS WAS NOT A ONE-LINE CHANGE — THE FORK THAT WAS FOUND

Reconnaissance produced one finding that changed what "replace the executor" can mean, and it is
recorded here rather than absorbed silently.

Phase 0 drives **four** provider families, and in the shipped production wiring they do **not** share
one executor:

| family | production design | what produced the endpoint |
| --- | --- | --- |
| cognition | executor family (local or cloud) | — |
| language | executor family (local or cloud) | — |
| appraisal | executor family (local or cloud) | — |
| **belief_semantic** | **LOCAL-ONLY, by an explicit production law** | **the Phase-0 endpoint** |

`product-provider-bundle.ts` states the law in its own words — *"ADAPTATION IS LOCAL-ONLY: this
provider is Ollama-native, so it keeps the LOCAL endpoint and model even when cognition runs on the
cloud executor. Pointing it at the cloud endpoint would be a silent cross-provider mis-wire, not a
feature."*

The reproduced failure was in **cognition**. But Phase 0's **endpoint** is credence movement, which is
produced by the **belief-semantic** channel. A swap that moved only the failing family would therefore
have left the local executor inside the one channel the endpoint is read from, and
"the executor changed" would have been half true.

Under the operator's constraint (*do not use qwen3.5:9b in this condition*) the belief channel had to
move too. That is possible **without touching production**, because the frozen prompt builder
`buildBeliefSemanticOllamaPromptMessages` is exported from the built runtime index — so a
research-side sibling can reuse the exact same prompt bytes and differ only in transport. The
repository already has this pattern (`relationship-semantic-openai-provider.ts` is the OpenAI-compatible
sibling of `relationship-semantic-ollama-provider.ts`).

**All four families therefore move. None stays on the local executor.**

## 3. WHAT WAS BUILT (research-side only, `packages/` untouched)

| file | role |
| --- | --- |
| `contract-cloud-v0.ts` | the frozen decision, the changed/unchanged declaration, the non-transferred parameters, fail-closed configuration |
| `cloud-belief-semantic-provider.ts` | OpenAI-compatible sibling of the local belief provider. Reuses the **same function object** as the frozen prompt builder (asserted by identity, not paraphrased) |
| `cloud-bundle.ts` | all four families on the swapped endpoint, returning the SAME `Phase0BundleV0` interface |
| `cloud-readiness-contract.ts` | the cloud gate's criteria, the frozen non-target probe request, and a pure criteria function |
| `cloud-readiness.ts` | the runnable gate (identity request + 3 planned probes) |
| `cloud-swap.test.ts` | 32 offline tests, stub transports, 0 model calls, no network |

## 4. THE HONEST DIFF

**Changed** — every row below is a real difference in the condition:

```
provider                Ollama -> DEEPSEEK_OPENAI_COMPATIBLE
model                   qwen3.5:9b -> deepseek-flash
transport class         OllamaNativeCognitionTransportV0 + OllamaBeliefSemanticProviderV0
                          -> OpenAiCompatibleTransportV0 (all four families)
schema enforcement      OLLAMA_NATIVE_FORMAT_GRAMMAR_ENFORCED -> OPENAI_COMPATIBLE_JSON_SYNTAX_MODE_ONLY
reasoning policy        ollama-native think:false -> provider-level thinking.type=disabled
context allocation      explicit num_ctx -> provider-managed (NOT transferable, see §5)
execution identity      new opaque subject ids + a new run identity
```

**Unchanged** — reused by reference from the frozen REV2 contract, not re-implemented:

```
scientific question · target proposition id and label · baseline credence · predicted directions
turn templates · valence table · turns per arm · scorer (scorePhase0V0) · primary predicate
invalid policy · inconclusive conditions · evidence-hierarchy ceiling · subject genesis path
per-family OUTPUT budgets (cognition 2048, appraisal 256, belief semantic 512)
per-family TIMEOUTS     (cognition/language/appraisal 120 s, belief semantic 60 s)
model-visible PROMPT TEXT for every family
```

The prompt-bytes claim is structural, not a promise: **the prompt is built by the production
providers, not by the transport**, and the belief-semantic family reuses the exported frozen builder by
function identity. The offline suite proves both.

## 5. PARAMETERS THAT DO NOT TRANSFER

Declared in the open, so the condition never looks smaller than it is:

| parameter | local value | status | consequence |
| --- | --- | --- | --- |
| `num_ctx` | 8192 cognition/language, 4096 appraisal | `NOT_TRANSFERABLE` | the remote endpoint manages its own context; no equivalent field exists on the frozen transport, so the allocation is not held equal and is not claimed to be |
| model digest | `6488c96f…93ea7` | `NOT_OBSERVABLE_REMOTELY` | no remote digest exists. A provider-reported model id is observed and is **strictly weaker**: it cannot detect a silent revision change behind a stable id |
| provider residency / mid-gate reload | resident-vs-unloaded sampling | `NOT_APPLICABLE` | there is no resident process. The criterion is declared inapplicable, **not substituted by a look-alike and not reported true** |

## 6. TWO DEFECTS FOUND IN MY OWN WORK THIS ROUND

1. **A single shared timeout would have silently retuned two channels.** The first draft gave all four
   families the 120 s used by `execute.ts` for its three cognition transports. The belief-semantic
   sibling's frozen default is **60 s**. The per-family split is now explicit and pinned by test. The
   error was caught by lint flagging an unused variable, not by reasoning — recorded as such.
2. **The readiness criteria were initially inline in the runnable**, which made them unevaluable
   offline. They are now a pure function and are exercised with inputs that must flip every gating
   criterion to false — the repository's own law being that a check which cannot fail certifies
   nothing.

## 7. READINESS — A DIFFERENT QUESTION, STATED AS SUCH

The local gate asked whether *this machine* had returned to a runnable state, using a content digest,
residency sampling and mid-gate reload detection. None of that exists remotely. This gate asks what can
actually be asked:

```
can the frozen executor configuration complete a production-shaped, NON-TARGET request repeatedly,
inside the frozen timeout, over the real credential, with no fallback, with a stable provider-reported
model id?
```

Gating criteria:

```
credential_present_and_accepted
configured_model_is_served_by_the_endpoint
all_probes_completed_normally
all_probes_completed_within_the_frozen_timeout
all_probes_used_the_same_frozen_request_hash
provider_reported_model_identical_across_all_probes
no_fallback_configured_or_used          (STRUCTURALLY_TRUE_BY_CONSTRUCTION — one endpoint exists)
```

Declared `NOT_APPLICABLE` / `NOT_OBSERVABLE_REMOTELY` in the verdict itself:
`same_model_digest_throughout` · `no_provider_reload_midway` · environment VRAM diagnostics.

Fail-closed properties, each proven offline:

- a local base URL in any spelling (`127.0.0.1`, `localhost`, `0.0.0.0`, `[::1]`, any `:11434`) is a
  **STOP**;
- an absent credential is a **STOP**, never a downgrade to the local executor;
- the probe request is audited against the frozen forbidden-substring list **before** any call;
- every string that can reach an artifact is redacted; the credential is recorded as
  presence + fingerprint only;
- there is no retry: a retried probe would change what `N` means.

## 8. BUDGET AND STOP RULES

```
readiness        3 probes + 1 identity request (max 4 provider requests)
qualification    6 turns (separate gate; authorised only by a readiness PASS)
stop           readiness FAIL  => stop; qualification NOT attempted, science NOT attempted
               qualification FAIL => stop; the swap is reported unusable; science NOT attempted
```

## 9. WHAT THIS ROUND DOES NOT DO

No scientific turn. No qualification. No Phase-1. No production or `packages/` change. No prompt,
scorer, predicate, trajectory, target-proposition or invalid-policy change. No retry of any kind. No
executor comparison verdict from the readiness gate.

## 10. FORBIDDEN CLAIMS (the ceiling is unchanged; these are added for the swap)

```
history internalization works
the subject has been shaped by its life
persistent belief influences cognition
persistent belief influences decision or behaviour
the local executor was the only cause of the null   (the swap has not been run)
the swapped executor is compliant                   (no qualification has run)
run-4 is comparable to run-1 or run-3               (different executor condition)
the D1 null is overturned or re-opened              (different executor condition; D1 is untouched)
```

## 11. THE HONEST LIMITATIONS OF THIS AMENDMENT

1. **The swapped executor has never been qualified on the production cognition contract.** The
   `EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1` API arm reached host validity 0.95–1.00 — but on that
   experiment's OWN portability-fixed scene prompt, not on `conversation-cognition-provider-v8` plus
   `SEMANTIC_COMPLETENESS_FAILED`. That contract is exactly what rejected the local executor twice. So
   the central open risk is real and unresolved: **the swap may not fix the failure at all.** That is
   what §7's qualification gate exists to determine, and a FAIL there is an informative outcome, not a
   wasted round.
2. **A run-4 result would be executor-conditional.** A Phase-0 positive or null on this condition is a
   statement about *CharacterOS with `deepseek-flash`*. It is **not comparable** to run-1/run-3, and it
   neither overturns nor re-opens D1, whose measured null was obtained on the local executor.
3. **`ADAPTATION IS LOCAL-ONLY` was a deliberate production decision** (cost, offline operation,
   provider independence). This amendment deviates from it **for this research condition only**, and
   declares that deviation instead of quietly changing the product. No production wiring is altered.
