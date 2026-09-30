# HARNESS DEFECT — a spurious PROCESS_STOP record was written during the CLEAN attempt 2

When the self-check was moved to run after the raw artifacts were persisted, its process-stop RECORD was
spliced in **before** the failure test, so it was written unconditionally. Attempt 2 completed cleanly
(0 integrity failures, augmentation self-check 11/11) and therefore carried a
`RUN5_PROCESS_STOP.json` claiming `PROCESS_STOP_CONDITION_NOT_ESTABLISHED` — a record contradicting the
run's own outcome.

The record was moved here rather than deleted, so the defect is auditable.
The file is preserved verbatim as `HARNESS_DEFECT_spurious_process_stop_written_during_clean_attempt_2.json`.

Fix: the decision is now the pure predicate `auditAugmentationAppliedV0`, and the process-stop record is
written only inside the failure branch. Four offline tests pin the predicate, including that an EMPTY
request list is not a PASS and that a request without a system message is an offender.

Nothing scientific was affected: the spurious record carries no measurement, and attempt 2's
`collection-integrity.json`, states, raw-trials and scorer input are untouched.
