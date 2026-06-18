import { Router } from 'express';
import footballDataService from '../../src/services/footballData/footballDataService.js';
import linkingAdminService from '../../src/services/footballData/linkingAdminService.js';
import { relinkSinglePlayer } from '../../src/services/footballData/playerIdentityLinkingService.js';
import { getPredictionAuditReport, runMatchScoring, runMatchRescore } from '../services/predictionAuditService.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(requireAdmin);

router.get('/player-data-quality', async (_req, res, next) => {
  try {
    const report = await footballDataService.getPlayerDataQualityReport();
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.post('/enrich/players', async (req, res, next) => {
  try {
    const result = await footballDataService.adminEnrichPlayers(req.body ?? {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/enrich/players/:id', async (req, res, next) => {
  try {
    const result = await footballDataService.adminEnrichPlayer(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/enrich/team/:teamId', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { onlyMissingPhotos?: boolean; verified?: boolean };
    const result = await footballDataService.adminEnrichTeam(req.params.teamId, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/enrich/verified/resume', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { batchSize?: number; teamId?: string };
    const result = await footballDataService.adminEnrichPlayers({ ...body, verified: true, resume: true });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/enrich/missing-photos', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { teamId?: string; batchSize?: number };
    const result = await footballDataService.adminEnrichPlayers({ ...body, onlyMissingPhotos: true, verified: true });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/link/team/:teamId', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { batchSize?: number };
    const result = await footballDataService.adminLinkTeam(req.params.teamId, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/link/country/:countryName', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { batchSize?: number };
    const result = await footballDataService.adminLinkCountry(req.params.countryName, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/player-linking/team-progress', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.teamProgress());
  } catch (err) {
    next(err);
  }
});

router.get('/player-linking/priority-status', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.priorityTeamStatus());
  } catch (err) {
    next(err);
  }
});

// ── Player linking (Sprint V2) ──
router.get('/player-linking/status', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.playerStatus());
  } catch (err) {
    next(err);
  }
});

router.get('/player-linking/verified', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.verifiedPlayers());
  } catch (err) {
    next(err);
  }
});

router.get('/player-linking/unlinked', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.unlinkedPlayers());
  } catch (err) {
    next(err);
  }
});

router.get('/player-linking/possible-matches', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.possibleMatches());
  } catch (err) {
    next(err);
  }
});

router.get('/player-linking/conflicts', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.conflicts());
  } catch (err) {
    next(err);
  }
});

router.post('/player-linking/:playerId/approve', async (req, res, next) => {
  try {
    res.json(await linkingAdminService.approve(req.params.playerId));
  } catch (err) {
    next(err);
  }
});

router.post('/player-linking/:playerId/reject', async (req, res, next) => {
  try {
    res.json(await linkingAdminService.reject(req.params.playerId));
  } catch (err) {
    next(err);
  }
});

router.post('/player-linking/:playerId/conflict', async (req, res, next) => {
  try {
    res.json(await linkingAdminService.markConflict(req.params.playerId));
  } catch (err) {
    next(err);
  }
});

router.post('/player-linking/:playerId/retry', async (req, res, next) => {
  try {
    const result = await relinkSinglePlayer(req.params.playerId);
    res.json(result ?? { ok: false, reason: 'not_found' });
  } catch (err) {
    next(err);
  }
});

// ── Country linking (Sprint V2) ──
router.get('/country-linking/status', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.countryStatus());
  } catch (err) {
    next(err);
  }
});

router.get('/country-linking/unlinked', async (_req, res, next) => {
  try {
    res.json(await linkingAdminService.unlinkedCountries());
  } catch (err) {
    next(err);
  }
});

router.post('/country-linking/:countryId/approve', async (req, res, next) => {
  try {
    res.json(await linkingAdminService.approveCountry(req.params.countryId));
  } catch (err) {
    next(err);
  }
});

router.get('/predictions/audit', async (_req, res, next) => {
  try {
    res.json(await getPredictionAuditReport());
  } catch (err) {
    next(err);
  }
});

router.post('/predictions/score/:matchId', async (req, res, next) => {
  try {
    res.json(await runMatchScoring(req.params.matchId));
  } catch (err) {
    next(err);
  }
});

router.post('/predictions/rescore/:matchId', async (req, res, next) => {
  try {
    const { oldScoreHome, oldScoreAway } = req.body as { oldScoreHome: number; oldScoreAway: number };
    if (oldScoreHome == null || oldScoreAway == null) {
      res.status(400).json({ error: 'oldScoreHome y oldScoreAway requeridos' });
      return;
    }
    res.json(await runMatchRescore(req.params.matchId, oldScoreHome, oldScoreAway));
  } catch (err) {
    next(err);
  }
});

router.get('/knockout/audit', async (_req, res, next) => {
  try {
    const { getKnockoutAuditReport } = await import('../../src/services/knockout/knockoutQualificationService.js');
    res.json(await getKnockoutAuditReport());
  } catch (err) {
    next(err);
  }
});

router.post('/knockout/sync', async (_req, res, next) => {
  try {
    const { syncKnockoutBracket } = await import('../../src/services/knockout/knockoutQualificationService.js');
    res.json(await syncKnockoutBracket({ force: false }));
  } catch (err) {
    next(err);
  }
});

router.get('/system/health', async (_req, res, next) => {
  try {
    const { getSystemHealthReport } = await import('../services/systemHealthService.js');
    res.json(await getSystemHealthReport());
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/reset-password-dni', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }
    const { resetUserPasswordToDni } = await import('../services/adminAuthService.js');
    res.json(await resetUserPasswordToDni(req.params.userId, token));
  } catch (err) {
    next(err);
  }
});

export default router;
