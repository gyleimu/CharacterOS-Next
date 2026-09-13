# Repository and Provider Baseline

Captured 2026-09-13 before production changes or new model calls.

- Repository: `D:\Documents\CharacterOS-Next`
- Branch: `main`
- HEAD: `2418ca0a7b6346939dd15625f518c0346a410ea2`
- `origin/main`: `2418ca0a7b6346939dd15625f518c0346a410ea2`
- Ahead / behind: `0 / 0`
- Worktree: clean
- Node: `v24.19.0`
- pnpm: `11.19.0`
- Ollama: `0.33.3`
- Model: `qwen3.5:9b`
- Digest: `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`
- Quantization: `Q4_K_M`
- Prior transport output format: none; JSON requested only by prompt text.

The saved prior evidence contains seven identical malformed S1/Z outputs and seven identical malformed N4/A outputs. In both cells, raw Ollama `message.content` is missing the opening quotation mark of `relevant_memory_refs`. The existing Ollama transport returns `message.content` without substring extraction, fence stripping, repair, or retry; the V2 provider applies strict `JSON.parse` and rejects the malformed text. Live reproduction is captured separately.
