/** Ranking deportivo: empates comparten puesto (1, 1, 1, 4, 4…). */
export function computeCompetitionRank<T extends { goals: number }>(index: number, items: T[]): number {
  if (index < 0 || index >= items.length) return index + 1
  const goals = items[index].goals
  const firstIndex = items.findIndex(item => item.goals === goals)
  return firstIndex + 1
}

export function withCompetitionRanks<T extends { goals: number }>(
  items: T[],
): Array<T & { rank: number }> {
  return items.map((item, index) => ({
    ...item,
    rank: computeCompetitionRank(index, items),
  }))
}
