# R2-K / ATTACK I regression: `pnpm typecheck` must succeed on a COLD tree.
#
# Attack reproduction: every package's exports/types point at ./dist, so a
# workspace-dependency type resolution needs previously built artifacts. On a
# clean checkout `pnpm typecheck` fails before `pnpm build` has ever run.
#
# This script removes all dist artifacts (cold state), runs `pnpm typecheck`
# and fails the gate if typecheck depends on stale build output. It never runs
# `pnpm build` itself — the gate order (typecheck, build, test, lint) must hold
# cold.
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Join-Path $PSScriptRoot "..")

Get-ChildItem -Path packages -Directory | ForEach-Object {
    $dist = Join-Path $_.FullName "dist"
    if (Test-Path -LiteralPath $dist) {
        Remove-Item -LiteralPath $dist -Recurse -Force
        Write-Output "removed $dist"
    }
}

Write-Output "cold typecheck..."
pnpm typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Error "ATTACK I open: cold typecheck depends on dist artifacts"
    exit 1
}
Write-Output "R2-K cold-start typecheck regression: PASS"
