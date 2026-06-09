#!/usr/bin/env bash
# Valida secrets/vars de sync para GitHub Actions. Nunca imprime valores.
set -euo pipefail

resolve_supabase_url() {
  if [ -n "${INPUT_SUPABASE_URL:-}" ]; then
    printf '%s' "$INPUT_SUPABASE_URL"
  elif [ -n "${INPUT_VITE_SUPABASE_URL:-}" ]; then
    printf '%s' "$INPUT_VITE_SUPABASE_URL"
  fi
}

SUPABASE_URL_RESOLVED="$(resolve_supabase_url)"

presence() {
  if [ -n "${1:-}" ]; then
    echo "yes"
  else
    echo "no"
  fi
}

echo "=== Sync environment (presence only) ==="
echo "SUPABASE_URL set: $(presence "$SUPABASE_URL_RESOLVED")"
echo "SUPABASE_SERVICE_ROLE_KEY set: $(presence "${INPUT_SERVICE_ROLE:-}")"
echo "FOOTBALL_DATA_API_KEY set: $(presence "${INPUT_FOOTBALL_DATA:-}")"
echo "API_FOOTBALL_KEY set: $(presence "${INPUT_API_FOOTBALL:-}")"

missing=()
if [ -z "$SUPABASE_URL_RESOLVED" ]; then
  missing+=("SUPABASE_URL")
fi
if [ -z "${INPUT_SERVICE_ROLE:-}" ]; then
  missing+=("SUPABASE_SERVICE_ROLE_KEY")
fi
if [ -z "${INPUT_FOOTBALL_DATA:-}" ] && [ -z "${INPUT_API_FOOTBALL:-}" ]; then
  missing+=("FOOTBALL_DATA_API_KEY or API_FOOTBALL_KEY")
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "::error title=Missing GitHub Actions secrets::Configure repository secrets: ${missing[*]}. Repo → Settings → Secrets and variables → Actions."
  exit 1
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "SUPABASE_URL=${SUPABASE_URL_RESOLVED}"
    echo "SUPABASE_SERVICE_ROLE_KEY=${INPUT_SERVICE_ROLE}"
    [ -n "${INPUT_FOOTBALL_DATA:-}" ] && echo "FOOTBALL_DATA_API_KEY=${INPUT_FOOTBALL_DATA}"
    [ -n "${INPUT_API_FOOTBALL:-}" ] && echo "API_FOOTBALL_KEY=${INPUT_API_FOOTBALL}"
  } >> "$GITHUB_ENV"
fi

echo "Sync environment OK"
