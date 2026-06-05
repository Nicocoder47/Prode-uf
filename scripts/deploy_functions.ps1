<#
Deploy Edge Functions to Supabase (PowerShell)

Prereqs:
- Install supabase CLI: https://supabase.com/docs/guides/cli
- Set env vars: $env:SUPABASE_PROJECT_REF and $env:SUPABASE_ACCESS_TOKEN

This script copies TS files from src/edge-functions into a temporary functions/<name>/index.ts
and runs `supabase functions deploy <name>` for each file.
#>

if (-not $env:SUPABASE_PROJECT_REF) {
  Write-Error "Set SUPABASE_PROJECT_REF environment variable before running."
  exit 1
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Error "supabase CLI not found in PATH. Install it first."
  exit 1
}

$edgeDir = Join-Path $PSScriptRoot '..\src\edge-functions'
$functionsDir = Join-Path $PSScriptRoot '..\functions'

if (Test-Path $functionsDir) { Remove-Item $functionsDir -Recurse -Force }
New-Item -ItemType Directory -Path $functionsDir | Out-Null

Get-ChildItem -Path $edgeDir -Filter *.ts | ForEach-Object {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $targetDir = Join-Path $functionsDir $name
  New-Item -ItemType Directory -Path $targetDir | Out-Null
  Copy-Item -Path $_.FullName -Destination (Join-Path $targetDir 'index.ts') -Force

  Write-Host "Deploying function: $name"
  supabase functions deploy $name --project-ref $env:SUPABASE_PROJECT_REF
}

Write-Host "Done. Consider cleaning up functions/ if not needed."
