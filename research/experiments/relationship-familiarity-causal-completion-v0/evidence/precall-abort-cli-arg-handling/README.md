# PRECALL TECHNICAL ABORT — CLI argument handling

The first `run` invocation passed the OUTPUT directory to the runner, which reads the
frozen fixture from its READINESS directory. The run aborted while reading
`frozen-fixture.json`: **0 model calls**, no scene executed, no outputs observed. The
CLI now takes `run <readiness-dir> [output-dir]` (matching the documented interface),
and the freeze was re-created on the corrected commit. No preregistered semantics
(contract, scenarios, thresholds, gates, worlds, ablation, endpoint) were changed.
