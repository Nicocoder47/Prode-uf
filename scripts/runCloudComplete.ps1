# PRODEMUNDIAL 2026 - pipeline cloud completo desde Windows
# Uso: .\scripts\runCloudComplete.ps1

param(
  [switch]$SkipSync,
  [switch]$SkipPhotos,
  [switch]$SkipEnrich,
  [switch]$SkipAudit
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

function Import-CloudEnv {
  if (-not (Test-Path ".env.cloud")) {
    Write-Host "ERROR: Falta .env.cloud - copiar desde .env.cloud.example" -ForegroundColor Red
    exit 1
  }
  Get-Content ".env.cloud" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $k = $matches[1].Trim()
      $v = $matches[2].Trim().Trim('"').Trim("'")
      if ($v) { Set-Item -Path "env:$k" -Value $v -Force }
    }
  }
  if (-not $env:CORS_ORIGIN) { $env:CORS_ORIGIN = "https://prodemundialprode.vercel.app" }
  if (-not $env:PLAYER_ENRICH_FAST) { $env:PLAYER_ENRICH_FAST = "1" }
  if (-not $env:ENRICH_PLAYERS_LIMIT) { $env:ENRICH_PLAYERS_LIMIT = "20" }
}

function Merge-EnvCloudDefaults {
  $defaults = @{
    "CORS_ORIGIN" = "https://prodemundialprode.vercel.app"
    "VITE_USE_FOOTBALL_API" = "true"
    "ENRICH_PLAYERS_LIMIT" = "20"
    "PLAYER_ENRICH_FAST" = "1"
    "PLAYER_ENRICH_DELAY_MS" = "0"
    "PHOTO_SYNC_LIMIT" = "30"
    "PHOTO_SYNC_BATCHES" = "15"
  }
  $lines = @()
  if (Test-Path ".env.cloud") { $lines = Get-Content ".env.cloud" }
  $existing = @{}
  foreach ($l in $lines) {
    if ($l -match '^\s*([^#=]+)=') { $existing[$matches[1].Trim()] = $true }
  }
  $added = $false
  foreach ($k in $defaults.Keys) {
    if (-not $existing[$k]) {
      $lines += "$k=$($defaults[$k])"
      $added = $true
    }
  }
  if ($added) {
    $lines | Set-Content ".env.cloud" -Encoding utf8
    Write-Host "==> .env.cloud actualizado con defaults cloud" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "PRODEMUNDIAL - Cloud Complete Pipeline" -ForegroundColor Cyan
Write-Host ""
Merge-EnvCloudDefaults
Import-CloudEnv

if (-not $SkipSync) {
  Write-Host "==> [1/4] Sync datos" -ForegroundColor Cyan
  npm run sync:teams
  npm run sync:players
  npm run sync:fixtures
  npm run sync:standings
  npm run sync:teams:enrich
}

if (-not $SkipEnrich) {
  Write-Host "==> [2/4] Enriquecimiento jugadores" -ForegroundColor Cyan
  $batches = 5
  if ($env:ENRICH_CLOUD_BATCHES) { $batches = [int]$env:ENRICH_CLOUD_BATCHES }
  for ($i = 1; $i -le $batches; $i++) {
    Write-Host "  Lote enrich $i/$batches"
    npm run sync:players:enrich -- $env:ENRICH_PLAYERS_LIMIT
  }
}

if (-not $SkipPhotos) {
  Write-Host "==> [3/4] Fotos Wikimedia + TheSportsDB" -ForegroundColor Cyan
  npm run sync:photos:cloud
}

if (-not $SkipAudit) {
  Write-Host "==> [4/4] Auditorias cloud" -ForegroundColor Cyan
  npm run audit:cloud:all
}

Write-Host ""
Write-Host "OK Pipeline cloud local completado." -ForegroundColor Green
Write-Host "Pendiente manual:" -ForegroundColor Yellow
Write-Host "  1. Oracle VM: bash scripts/oracle-bootstrap.sh"
Write-Host "  2. Vercel: VITE_API_BASE_URL = http://IP-ORACLE:3001"
Write-Host "  3. Supabase Auth: docs/supabase-auth.md"
Write-Host "  4. UptimeRobot: docs/uptimerobot.md"
Write-Host "  5. API_FOOTBALL_KEY en .env.cloud (fotos/live avanzado)"
