# LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — evidence

## Principal verdict: LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_FAILED
## Memory continuity: LONG_HORIZON_MEMORY_CONTINUITY_PARTIAL
## Restore: TWO_BOUNDARY_RESTORE_SUPPORTED
## Autonomous orchestration: AUTONOMOUS_LIFECYCLE_ORCHESTRATION_PARTIAL

## Metrics
{"completed_interactions":6,"durable_memory_commits":6,"interactions_with_prior_lived_evidence_retrieved":5,"provider_requests_with_prior_life_factual_content":5,"provider_request_identity_verified":6,"restores_completed":2,"environment_state_restored_exactly":2}

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
- i7 t=2100 affect 0.017360070170127563→0.002349430013481685 retrieved=[] directive=null rev=R18→R19
  event: Alice asks whether everything discussed so far is consistent, and whether anything agreed earlier is now missing.
  intent: null
  behavior: ""
  counterpart: ""
  experience=null episode=null

## Restores
[{"kind":"RESTORED","classification":"EXACT","next":3},{"kind":"RESTORED","classification":"EXACT","next":6}]

## Operator status example
{"schema_version":"long-horizon-operator-status-example-v0","example_from_interaction":8,"session_id":"alice-review-session-1","subject_id":"subject-s0","interaction":"6/7","logical_time":1800,"memory_repository_revision":"R18","current_affect":{"valence":0.017360070170127563,"activation":"see affect-timeline.json"},"current_intent":"Propose one checklist item for the remaining work.","latest_directive":"REALIZE_CURRENT_INTENT","latest_behavior":"Here is a checklist item for the remaining work: [ ] Verify that all feedback from Alice has been addressed in the review document.","retrieved_memories":[],"last_restore":"success","authority_tokens_exposed":"NONE"}
