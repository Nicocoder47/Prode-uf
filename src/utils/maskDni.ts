export function maskDni(dni: string | null | undefined): string {
  const value = (dni ?? '').trim()
  if (!value) return '—'
  if (value.length <= 4) return '*'.repeat(value.length)
  return '*'.repeat(Math.max(value.length - 4, 0)) + value.slice(-4)
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
