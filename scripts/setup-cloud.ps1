# PRODEMUNDIAL 2026 — conectar proyecto cloud Supabase + Vercel
# Uso: .\scripts\setup-cloud.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "irklqwsnehlfcgehvscm"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

Write-Host "==> Supabase login (abre el navegador si hace falta)" -ForegroundColor Cyan
npx supabase login

Write-Host "==> Link proyecto $ProjectRef" -ForegroundColor Cyan
npx supabase link --project-ref $ProjectRef

Write-Host "==> Aplicar migraciones" -ForegroundColor Cyan
npx supabase db push

Write-Host "==> Verificar salud Supabase" -ForegroundColor Cyan
if (Test-Path ".env.cloud") {
  Get-Content ".env.cloud" | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $k = $matches[1].Trim()
      $v = $matches[2].Trim().Trim('"').Trim("'")
      if (-not [string]::IsNullOrWhiteSpace($v) -and -not $env:$k) { Set-Item -Path "env:$k" -Value $v }
    }
  }
  npm run audit:supabase-health
} else {
  Write-Host "Creá .env.cloud desde .env.cloud.example con tus claves API" -ForegroundColor Yellow
}

Write-Host "==> Vercel (opcional)" -ForegroundColor Cyan
Write-Host "  npx vercel link"
Write-Host "  npx vercel env add VITE_SUPABASE_URL production"
Write-Host "  npx vercel env add VITE_SUPABASE_ANON_KEY production"
Write-Host "Listo. Dashboard: https://supabase.com/dashboard/project/$ProjectRef" -ForegroundColor Green
