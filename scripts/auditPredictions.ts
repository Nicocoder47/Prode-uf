/**
 * Auditoría CLI de predicciones — npm run audit:predictions
 * Escribe reports/predictions-audit.json con datos reales de Supabase.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { getPredictionAuditReport } from '../server/services/predictionAuditService.js'

async function main() {
  console.log('Auditoría de predicciones PRODEMUNDIAL 2026…\n')
  const report = await getPredictionAuditReport()

  console.log('Conteo por estado:')
  console.log(`  pending : ${report.counts.pending}`)
  console.log(`  locked  : ${report.counts.locked}`)
  console.log(`  scored  : ${report.counts.scored}`)
  console.log(`  total   : ${report.counts.total}`)
  console.log('')
  console.log(`Predicciones en partidos finished sin puntuar: ${report.unscoredOnFinished.length}`)
  console.log(`Partidos finished sin scoring ejecutado: ${report.finishedWithoutScoring.length}`)
  console.log(`Predicciones inconsistentes (winner vs marcador): ${report.inconsistent.length}`)

  mkdirSync('reports', { recursive: true })
  const outPath = 'reports/predictions-audit.json'
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nReporte guardado en ${outPath}`)
}

main().catch(err => {
  console.error('FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
})
