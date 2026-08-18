# Build + push the custom Function OCI image to Vercel Container Registry.
#
# Image:
#   vcr.vercel.com/dobeutechnology/new-dobeu-net/new-dobeu-net-oci:latest
#
# Prerequisites:
#   1. Docker Desktop running
#   2. Project linked (vercel link)
#   3. vercel vcr login docker
#
# Usage:
#   pwsh ./scripts/push-vcr-function-image.ps1
#   pwsh ./scripts/push-vcr-function-image.ps1 -Tag v1
#   pwsh ./scripts/push-vcr-function-image.ps1 -Platforms "linux/amd64,linux/arm64"

[CmdletBinding()]
param(
  [string]$Tag = "latest",
  [string]$TeamSlug = "dobeutechnology",
  [string]$ProjectSlug = "new-dobeu-net",
  [string]$RepoName = "new-dobeu-net-oci",
  [string]$Platforms = "linux/amd64",
  [switch]$SkipLogin
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$context = Join-Path $repoRoot "containers\function"
$image = "vcr.vercel.com/$TeamSlug/$ProjectSlug/${RepoName}:$Tag"

if (-not (Test-Path (Join-Path $context "Dockerfile"))) {
  throw "Dockerfile not found at $context"
}

Write-Host "Checking Docker daemon..." -ForegroundColor Cyan
docker info 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Docker is not running. Start Docker Desktop, then re-run this script."
}

if (-not $SkipLogin) {
  Write-Host "Authenticating Docker to VCR (vercel vcr login docker)..." -ForegroundColor Cyan
  Push-Location $repoRoot
  try {
    vercel vcr login docker
    if ($LASTEXITCODE -ne 0) {
      throw "vercel vcr login docker failed (exit $LASTEXITCODE)"
    }
  }
  finally {
    Pop-Location
  }
}

Write-Host "Building and pushing:" -ForegroundColor Cyan
Write-Host "  image:     $image"
Write-Host "  platforms: $Platforms"
Write-Host "  context:   $context"

$output = "type=image,name=$image,push=true,oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true"

docker buildx build `
  --platform $Platforms `
  --file (Join-Path $context "Dockerfile") `
  --output $output `
  $context

if ($LASTEXITCODE -ne 0) {
  throw "docker buildx build failed (exit $LASTEXITCODE)"
}

Write-Host ""
Write-Host "Pushed $image" -ForegroundColor Green
Write-Host "Refresh the Vercel Images page for new-dobeu-net-oci — it should leave the empty Get started state."
Write-Host ""
Write-Host "Local smoke test (after pull):"
Write-Host "  docker pull $image"
Write-Host "  docker run --rm -p 8080:80 -e PORT=80 $image"
Write-Host "  curl http://localhost:8080/health"
