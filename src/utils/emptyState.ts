/** Mensajes vacíos amigables; comandos técnicos solo en dev/admin. */
export function isDevAdminMode(): boolean {
  return import.meta.env.DEV === true && import.meta.env.VITE_DEV_ADMIN === 'true';
}

export function emptyStateMessage(userMessage: string, devHint?: string): string {
  if (isDevAdminMode() && devHint) {
    return `${userMessage} (${devHint})`;
  }
  return userMessage;
}

export const EMPTY = {
  matches: 'Todavía no hay partidos disponibles.',
  matchesUpdating: 'Estamos actualizando el fixture.',
  teams: 'Las selecciones aparecerán cuando se carguen los datos.',
  players: 'Los jugadores estarán disponibles pronto.',
  playersProvider: 'Los jugadores estarán disponibles pronto.',
  standings: 'Las tablas de posiciones se publicarán pronto.',
  predictions: 'Todavía no hiciste predicciones. Tocá Predecir en un partido.',
  ranking: 'Aún no hay puntuaciones. ¡Sé el primero en predecir!',
  login: 'Iniciá sesión para ver tus predicciones.',
} as const;
