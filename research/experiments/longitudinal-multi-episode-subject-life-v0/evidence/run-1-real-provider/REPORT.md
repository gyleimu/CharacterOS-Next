# LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_V0 — evidence

## Principal verdict: LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_SUPPORTED
## Multi-episode retrieval: MULTI_EPISODE_RETRIEVAL_SUPPORTED
## Post-restore continuity: POST_RESTORE_LIFE_CONTINUITY_SUPPORTED

## Life ledger
- E1 t=0 affect 0→0.03149999999999999 retrieved=[] directive=REALIZE_CURRENT_INTENT rev=R0 → R3
  event: Alice asks how the review document should be organized: the implementation notes and the validation notes could stay separate or be merged before the review.
  intent: "Recommend merging implementation and validation notes for better document cohesion unless Alice specifies a need for separation."
  behavior: "I recommend merging the implementation notes and validation notes into a single section for better document cohesion, unless you specify a need to keep them separate."
  counterpart: "Thanks — about \"I recommend merging the implementation notes and validation notes into a single \": I have recorded that on the shared checklist and left one follow-up item for the review."
  experience=experience:bf92f4aed02c15d7450b24c6828d16767ad5e4962e34e56e24db3efb0f46149d episode=episode:132ff9d586d510b6f71fdadecf379c636e9093bf44078d61f20264fd501ca065
- E2 t=300 affect 0.004263061421953299→0.046763061421953286 retrieved=["FROM_E1"] directive=REALIZE_CURRENT_INTENT rev=R3 → R6
  event: Alice asks where the review document stands now, some time after the organization question came up.
  intent: "Report the current status of the review document to Alice."
  behavior: "The review document is currently under active assessment."
  counterpart: "Thanks — about \"The review document is currently under active assessment\": I have recorded that on the shared checklist and left one follow-up item for the review."
  experience=experience:07fd78314226e73e2e836993ee7be7dc932b5e69b0d0ffaaac26d9a39df96016 episode=episode:ae2f4effca354bc4cc3bed668a9738989a78ffa4e4c1c6bee4751aaad178acc3
- E3 t=600 affect 0.006328692162551165→0.013828692162551164 retrieved=["FROM_E1","FROM_E2"] directive=REALIZE_CURRENT_INTENT rev=R6 → R9
  event: Alice asks whether the outstanding item on the shared checklist can be closed before the review, and whether the earlier organization decision still holds.
  intent: "Clarify the status of the outstanding checklist item and confirm that the organization decision is pending the review."
  behavior: "Alice, the outstanding checklist item cannot be closed before the review. The organization's decision is currently pending that review."
  counterpart: "Thanks — about \"Alice, the outstanding checklist item cannot be closed before the review\": I have recorded that on the shared checklist and left one follow-up item for the review."
  experience=experience:2c5554b0fa547db2b8e4612195631b1ae33b36e13198720fffd0b6f946b1aaf8 episode=episode:fce58e10ea17834ddadfac62f103393494df85a1b94d0696b45eb6a17a84b81c
- E4 t=900 affect 0.0018715099706107879→0.0018715099706107879 retrieved=["FROM_E1","FROM_E2","FROM_E3"] directive=REALIZE_CURRENT_INTENT rev=R9 → R9
  event: Alice asks for a final confirmation before the review that reflects everything agreed so far.
  intent: "Provide final pre-review confirmation to Alice"
  behavior: "Alice, this is the final pre-review confirmation reflecting everything we've agreed upon so far."
  counterpart: "Thanks — about \"Alice, this is the final pre-review confirmation reflecting everything we've agr\": I have recorded that on the shared checklist and left one follow-up item for the review."
  experience=null episode=null

## Provider surface
- E1: memory_section=false request_identity_match=true request_hash=sha256:f60057ccf45ce695fefb7651359e785f3a8e8a820c9c9b7cb03c049a7488216c
- E2: memory_section=true request_identity_match=true request_hash=sha256:56757fded96fae80cf79848f26753296bf81d260eb586bc9d2b1fb3f3e3d67e1
- E3: memory_section=true request_identity_match=true request_hash=sha256:2e2cab8f7ed3885b7b0b98612eaf67794b306526b2a6f2461321d04e32aeff9b
- E4: memory_section=true request_identity_match=true request_hash=sha256:14cb599860526638e53198dc9003dbce8e5550c0ca13b8cbb5575535ec584d46

## Restore
{"pre_post_state_equal":true,"active_runtime_discarded":true}

## Tokens / cost
{"run_of_record_attempt":3,"cognition_calls":4,"language_calls":4,"cognition_prompt_tokens":6753,"cognition_completion_tokens":2020,"language_tokens":5660,"total_input_tokens":6753,"total_output_tokens":7680,"total_tokens":14433,"all_attempts":{"attempts":[2,3],"cognition_calls":5,"language_calls":5,"total_tokens":16991,"note":"includes aborted attempts; attempt 1's calls were lost before the crash-proof ledger existed and are recorded in attempt-history.json instead"},"external_api_monetary_cost":"0 (local Ollama; no external API calls)"}