# Flip Vercel NEXT_PUBLIC_* sensitive envs to plain so they're no longer
# inlined as `""` into the production client bundle.
#
# Per the Phase 1 plan: read canonical values from .env.local, delete the
# sensitive entry, re-add as plain with the same target list. Skip + log
# any value that's empty / whitespace / obviously dev-only (localhost).

param(
  [string]$ProjectId = "prj_gsbOuACbBs2I8M1XSpDcdjoAENdb",
  [string]$EnvsFile  = ".agent/vercel-envs-pre.json",
  [string]$EnvLocal  = ".env.local"
)

# Vercel CLI prints WARNING/info to stderr even on success, which trips
# $ErrorActionPreference = "Stop". Keep Continue and rely on $LASTEXITCODE.
$ErrorActionPreference = "Continue"

# ---- Parse .env.local into a hashtable ----
$envValues = @{}
foreach ($line in Get-Content $EnvLocal) {
  if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
    $k = $matches[1]
    $v = $matches[2]
    # strip surrounding double quotes if present
    if ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $envValues[$k] = $v
  }
}

$envList = (Get-Content $EnvsFile -Raw | ConvertFrom-Json).envs
$candidates = $envList | Where-Object { $_.key -like "NEXT_PUBLIC_*" -and $_.type -eq "sensitive" }

Write-Host "Found $($candidates.Count) sensitive NEXT_PUBLIC_* envs to consider"
Write-Host ""

$flipped = @()
$skipped = @()

foreach ($e in $candidates) {
  $key    = $e.key
  $oldId  = $e.id
  $target = $e.target
  $value  = $envValues[$key]

  $reasonSkip = $null
  if ($e.contentHint -and $e.contentHint.type -eq "integration-store-secret") {
    $reasonSkip = "Marketplace-managed (integration-store-secret); will be re-provisioned by Vercel Supabase integration. Flip via dashboard if needed."
  }
  elseif ($null -eq $value)                 { $reasonSkip = "absent from .env.local (needs manual intervention)" }
  elseif ($value -eq "")                    { $reasonSkip = "empty string in .env.local (needs manual intervention)" }
  elseif ($value -match '^\s*$')            { $reasonSkip = "whitespace-only in .env.local (needs manual intervention)" }
  elseif ($value -like "*localhost*")       { $reasonSkip = "localhost value in .env.local (dev-only); skipped -- getSiteUrl()/etc. fallbacks now handle the empty-string inline" }
  elseif ($value -like "*127.0.0.1*")       { $reasonSkip = "loopback value in .env.local (dev-only); skipped" }

  if ($reasonSkip) {
    Write-Host ("SKIP  {0}  ::  {1}" -f $key, $reasonSkip) -ForegroundColor Yellow
    $skipped += [pscustomobject]@{ key = $key; id = $oldId; reason = $reasonSkip }
    continue
  }

  # Build POST body as a hashtable then JSON. ConvertTo-Json handles escaping.
  $bodyObj = @{
    key    = $key
    value  = $value
    type   = "plain"
    target = @($target)
  }
  $bodyJson = $bodyObj | ConvertTo-Json -Compress -Depth 5
  $bodyFile = ".agent/_tmp_envbody.json"
  [System.IO.File]::WriteAllText((Resolve-Path . | Join-Path -ChildPath $bodyFile), $bodyJson)

  Write-Host ("FLIP  {0}  (id={1}, targets={2})" -f $key, $oldId, ($target -join ","))

  $del = vercel api -X DELETE "/v9/projects/$ProjectId/env/$oldId" --dangerously-skip-permissions 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("  DELETE failed: {0}" -f $del) -ForegroundColor Red
    $skipped += [pscustomobject]@{ key = $key; id = $oldId; reason = "DELETE failed: $del" }
    continue
  }

  $add = vercel api -X POST "/v10/projects/$ProjectId/env" --input $bodyFile 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("  POST   failed: {0}" -f $add) -ForegroundColor Red
    $skipped += [pscustomobject]@{ key = $key; id = $oldId; reason = "POST failed (env may now be missing!): $add" }
    continue
  }

  Write-Host "  OK" -ForegroundColor Green
  $flipped += [pscustomobject]@{ key = $key; oldId = $oldId; target = ($target -join ",") }
}

Write-Host ""
Write-Host "Flipped: $($flipped.Count)"
Write-Host "Skipped: $($skipped.Count)"

# Persist the result for the parent agent + commit summary
$flipped | ConvertTo-Json | Out-File -Encoding utf8 .agent/vercel-envs-flipped.json
$skipped | ConvertTo-Json | Out-File -Encoding utf8 .agent/vercel-envs-skipped.json
