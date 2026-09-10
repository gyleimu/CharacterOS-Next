# R2-K / ATTACK I regression: source-mapped workspace typecheck must succeed on a COLD tree.
#
# Attack reproduction: workspace exports/types point at ./dist, so a typecheck
# that resolves workspace dependencies through package exports can silently rely
# on previously built artifacts. A clean checkout must typecheck from source.
#
# This script mechanically inventories every pnpm workspace, removes each
# workspace's dist output (cold state), runs the source-mapped workspace
# typecheck, and fails if typecheck depends on stale build output. It never runs
# `pnpm build` itself — the gate order (typecheck, build, test, lint) must hold
# cold. PowerShell is the supported local regression host for this script.
$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$repositoryPrefix = $repositoryRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
    [System.IO.Path]::DirectorySeparatorChar
Set-Location -LiteralPath $repositoryRoot

$inventoryJson = pnpm --recursive list --depth -1 --json | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Error "Unable to enumerate pnpm workspaces"
    exit 1
}

# ConvertFrom-Json emits a top-level JSON array as a single object, so the
# parsed inventory must be enumerated through a variable — piping it directly
# into Where-Object would filter the array itself instead of its elements.
$inventory = $inventoryJson | ConvertFrom-Json
if ($null -eq $inventory) {
    Write-Error "pnpm workspace inventory is empty"
    exit 1
}

$workspacePackages = @($inventory | Where-Object {
    [System.IO.Path]::GetFullPath([string]$_.path) -ne $repositoryRoot
})
if ($workspacePackages.Count -eq 0) {
    Write-Error "No pnpm workspace packages were discovered"
    exit 1
}

foreach ($workspace in $workspacePackages) {
    $workspacePath = [System.IO.Path]::GetFullPath([string]$workspace.path)
    if (-not $workspacePath.StartsWith(
        $repositoryPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        Write-Error "Refusing workspace outside repository root: $workspacePath"
        exit 1
    }

    $dist = [System.IO.Path]::GetFullPath((Join-Path $workspacePath "dist"))
    if (-not $dist.StartsWith(
        $repositoryPrefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        Write-Error "Refusing dist path outside repository root: $dist"
        exit 1
    }

    if (Test-Path -LiteralPath $dist) {
        Remove-Item -LiteralPath $dist -Recurse -Force
        Write-Output "removed $dist"
    }
}

Write-Output "cold source-mapped workspace typecheck ($($workspacePackages.Count) packages)..."
pnpm typecheck:workspaces
if ($LASTEXITCODE -ne 0) {
    Write-Error "ATTACK I open: cold typecheck depends on dist artifacts"
    exit 1
}
Write-Output "R2-K cold-start typecheck regression: PASS"
