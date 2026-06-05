/** Legacy entry — delega al servicio Player Data Quality Sprint V1 */
import { enrichPlayersBatch, type EnrichRunResult } from '../footballData/playerEnrichmentService';

export type EnrichPlayerDetailsOptions = {
  limit?: number;
  teamId?: string;
  force?: boolean;
  delayMs?: number;
};

export type EnrichPlayerDetailsResult = EnrichRunResult;

export async function enrichPlayerDetails(
  options: EnrichPlayerDetailsOptions = {},
): Promise<EnrichPlayerDetailsResult> {
  return enrichPlayersBatch({
    teamId: options.teamId,
    delayMs: options.delayMs,
    maxPerRun: options.limit,
  });
}

export default enrichPlayerDetails;
