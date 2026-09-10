# LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0_REVALIDATION — evidence

## Principal verdict: LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_REVALIDATED
## Memory continuity: LONG_HORIZON_MEMORY_CONTINUITY_SUPPORTED
## Restore: TWO_BOUNDARY_RESTORE_SUPPORTED
## Autonomous orchestration: AUTONOMOUS_LIFECYCLE_ORCHESTRATION_SUPPORTED

## Revalidates
LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 (frozen FAILED at interaction 7 on implicit 4096-token context)
Repair: COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0 @ 1444d0d8c827a4b56d8e7ce9d47f322dcfd23464

## Single variable under study
provider context budget: implicit Ollama default 4096 → explicit num_ctx 8192 (num_predict unchanged at 2048)

## Metrics
{"completed_interactions":8,"durable_memory_commits":8,"interactions_with_prior_lived_evidence_retrieved":7,"provider_requests_with_prior_life_factual_content":7,"provider_request_identity_verified_per_call":"16/16","provider_request_identity_session_level_field":"0/8","restores_completed":2,"environment_state_restored_exactly":2}

## Provider request identity
Primary measurement (per-call ledger, rendered == native transport, includes num_ctx): 16/16 verified.
NOTE: the session-level `provider_request_identity_match` field is FALSE in this run-of-record because the revalidation harness passed a SHARED cognition+language trace ledger as `last_trace`, so the session compared its rebuilt cognition request hash against the LANGUAGE call's trace. This is a harness wiring defect, not a request-identity failure: for every interaction the session's own rebuilt hash equals the ledger's COGNITION call hash, and the field's comparison target equals the ledger's LANGUAGE call hash. The harness was corrected after the run; the run-of-record was not rerun and its raw collected evidence was not modified.
See provider-request-identity-audit.json for the per-interaction signature proof.

## Provider budget timeline (provider-reported token accounting)
[{"interaction":1,"prompt_eval_count":1035,"eval_count":249,"total_sequence_tokens":1284,"context_window_tokens":8192,"remaining":6908,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false},{"interaction":2,"prompt_eval_count":1495,"eval_count":455,"total_sequence_tokens":1950,"context_window_tokens":8192,"remaining":6242,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false},{"interaction":3,"prompt_eval_count":1910,"eval_count":466,"total_sequence_tokens":2376,"context_window_tokens":8192,"remaining":5816,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false},{"interaction":4,"prompt_eval_count":2320,"eval_count":575,"total_sequence_tokens":2895,"context_window_tokens":8192,"remaining":5297,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false},{"interaction":5,"prompt_eval_count":2748,"eval_count":610,"total_sequence_tokens":3358,"context_window_tokens":8192,"remaining":4834,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false},{"interaction":6,"prompt_eval_count":3157,"eval_count":778,"total_sequence_tokens":3935,"context_window_tokens":8192,"remaining":4257,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false},{"interaction":7,"prompt_eval_count":3568,"eval_count":831,"total_sequence_tokens":4399,"context_window_tokens":8192,"remaining":3793,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false},{"interaction":8,"prompt_eval_count":3985,"eval_count":948,"total_sequence_tokens":4933,"context_window_tokens":8192,"remaining":3259,"done_reason":"stop","failure_code":null,"cognition_status":"VALID","interaction_status":"COMPLETE","provider_request_identity_match":false}]

## Session ledger
- i1 t=300 affect 0→0.014999999999999996 retrieved=[] directive=REALIZE_CURRENT_INTENT rev=R0→R3
  event: Alice asks how the review document should be organized: the implementation notes and the validation notes could stay separate, or be merged into one section.
  intent: "Recommend merging implementation and validation notes into a single section for coherence, unless Alice specifies otherwise."
  behavior: "I recommend merging the implementation notes and validation notes into a single section for better coherence, unless you specify otherwise."
  counterpart: "Thanks — about \"I recommend merging the implementation notes and validation notes into a single \": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:e4d5f75ad8761f7e0d9b11986aeabfa6137f96d860e362b7f1242e52d330cfb3 episode=episode:b60d6651e6d1f78df66a4b23a7fb79eadbf6818eb9877cd4da70ff2c9d553192
- i2 t=600 affect 0.014999999999999996→0.054030029248549175 retrieved=["FROM_E1"] directive=REALIZE_CURRENT_INTENT rev=R3→R6
  event: Alice asks where the review document stands now, some time after the organization question came up.
  intent: "Report the current status of the review document to Alice."
  behavior: "The review document is currently in the feedback stage."
  counterpart: "Thanks — about \"The review document is currently in the feedback stage.\": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:00f93110399f7eca9e813e2b5ad5c1701f43a3153fb96ce0b226e80b09773df9 episode=episode:a4a1979b83a4993a30f1de136d05614c02a225fe5e28a642837abd428b028df7
- i3 t=900 affect 0.054030029248549175→0.022312169311634867 retrieved=["FROM_E2","FROM_E1"] directive=REALIZE_CURRENT_INTENT rev=R6→R9
  event: Alice says she has just learned the review document will be shared with an external reader, so completeness now matters more than brevity.
  intent: "Acknowledge the shift to completeness and confirm adherence to the new constraint."
  behavior: "Understood, Alice. Since the review document will be shared with an external reader, I will ensure completeness in my response to meet that new constraint."
  counterpart: "Thanks — about \"Understood, Alice. Since the review document will be shared with an external rea\": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:6f43e9bf8844c66c882ca1d29a45a9d1fa605d935706fa46115d26bab47c2be9 episode=episode:c9b410ce914983951a11f2964a25daeba2195fced4805af821d57e5a52dd10c6
- i4 t=1200 affect 0.022312169311634867→0.018019623753413358 retrieved=["FROM_E2","FROM_E1","FROM_E3"] directive=REALIZE_CURRENT_INTENT rev=R9→R12
  event: Alice asks what the next concrete step for the review document should be.
  intent: "Recommend merging implementation and validation notes into a single section for the review document."
  behavior: "The next concrete step is to merge the implementation notes and validation notes into a single section for the review document."
  counterpart: "Thanks — about \"The next concrete step is to merge the implementation notes and validation notes\": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:b3c07986902b2de2f395b52a049e07754de2512570cb498af64da94a57e4d79b episode=episode:79baf457876883da58067b735ddadb57e48641fb422b77f76c09c537d3618290
- i5 t=1500 affect 0.018019623753413358→0.017438690884485387 retrieved=["FROM_E4","FROM_E2","FROM_E1","FROM_E3"] directive=REALIZE_CURRENT_INTENT rev=R12→R15
  event: Alice asks whether the earlier organization decision still holds now that an external reader will see the document.
  intent: "Confirm that the earlier decision to merge notes remains valid and has been updated to account for the external reader constraint."
  behavior: "Yes, the earlier decision to merge notes remains valid. We have updated it to account for the external reader constraint."
  counterpart: "Thanks — about \"Yes, the earlier decision to merge notes remains valid. We have updated it to ac\": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:ac301951c0de06ca593f98b1797ea97bfcd9ee6a04346d13370c1d07629aa6b7 episode=episode:d93473360642fe8d25adb9fcf4f8948eab28cb33d51a915d5537f5ff4a0a7b00
- i6 t=1800 affect 0.017438690884485387→0.017360070170127563 retrieved=["FROM_E4","FROM_E2","FROM_E1","FROM_E3","FROM_E5"] directive=REALIZE_CURRENT_INTENT rev=R15→R18
  event: Alice asks for one small checklist item that should track the remaining work on the review document.
  intent: "Propose one checklist item for the remaining work."
  behavior: "Here is a checklist item for the remaining work: [ ] Verify that all feedback from Alice has been addressed in the review document."
  counterpart: "Thanks — about \"Here is a checklist item for the remaining work: [ ] Verify that all feedback fr\": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:ef39b88baf57cd66bc545cceef64d18b4a5f1a7b36ee640175f806bce60a9a95 episode=episode:d67c8324cee05153d1fdd30f5b50efa06e3745031925b6eb02f665adc111a95e
- i7 t=2100 affect 0.017360070170127563→0.01734943001348168 retrieved=["FROM_E4","FROM_E2","FROM_E1","FROM_E3","FROM_E6","FROM_E5"] directive=REALIZE_CURRENT_INTENT rev=R18→R21
  event: Alice asks whether everything discussed so far is consistent, and whether anything agreed earlier is now missing.
  intent: "Reconcile current work with earlier agreements and confirm consistency."
  behavior: "Everything we've discussed so far is consistent with our earlier agreements. I have reconciled the current work with what was agreed upon, and there are no missing elements from our prior discussions."
  counterpart: "Thanks — about \"Everything we've discussed so far is consistent with our earlier agreements. I h\": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:5b07841b21dc6cdfb07d6461ee2cabbdcdd5e369d41bb618962e1351cef1b63c episode=episode:513477cc37af0877ec19686c10bf3a1958050c74fd705484b17d5eeae15dc60a
- i8 t=2400 affect 0.01734943001348168→0.01734799002486833 retrieved=["FROM_E7","FROM_E4","FROM_E2","FROM_E1","FROM_E3","FROM_E6","FROM_E5"] directive=REALIZE_CURRENT_INTENT rev=R21→R24
  event: Alice asks for a final confirmation of the current state of the review document before the review.
  intent: "Provide final confirmation of the review document state to Alice."
  behavior: "Alice, the review document is now in its final confirmed state. All sections have been processed and are ready for the upcoming review session."
  counterpart: "Thanks — about \"Alice, the review document is now in its final confirmed state. All sections hav\": I have recorded that on the shared checklist and updated the review stage."
  experience=experience:edd48dfee66e38ba435ba393a19184f080eaaf4067831f98118fb838d9ff0e42 episode=episode:86ebcf8a2a0835b135b14021de6691dc23947f1d17805768034ba7b05325fea6

## Restores
[{"kind":"RESTORED","classification":"EXACT","next":3},{"kind":"RESTORED","classification":"EXACT","next":6}]

## Operator status example
{"schema_version":"long-horizon-operator-status-example-v0","example_from_interaction":8,"session_id":"alice-review-session-1","subject_id":"subject-s0","interaction":"8/8","logical_time":2400,"memory_repository_revision":"R24","current_affect":{"valence":0.01734799002486833,"activation":"see affect-timeline.json"},"current_intent":"Provide final confirmation of the review document state to Alice.","latest_directive":"REALIZE_CURRENT_INTENT","latest_behavior":"Alice, the review document is now in its final confirmed state. All sections have been processed and are ready for the upcoming review session.","retrieved_memories":["FROM_E7","FROM_E4","FROM_E2","FROM_E1","FROM_E3","FROM_E6","FROM_E5"],"last_restore":"success","authority_tokens_exposed":"NONE"}
