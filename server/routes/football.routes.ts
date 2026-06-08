import { Router } from 'express';
import footballDataService from '../../src/services/footballData/footballDataService.js';

const router = Router();

function withPhotoUrl<T extends { photo?: string | null }>(player: T) {
  return { ...player, photoUrl: player.photo ?? null };
}

router.get('/groups', async (_req, res, next) => {
  try {
    const groups = await footballDataService.getGroups();
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id', async (req, res, next) => {
  try {
    const group = await footballDataService.getGroupById(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Grupo no encontrado' });
      return;
    }
    res.json(group);
  } catch (err) {
    next(err);
  }
});

router.get('/players', async (_req, res, next) => {
  try {
    const players = await footballDataService.getAllPlayers();
    res.json(players.map(withPhotoUrl));
  } catch (err) {
    next(err);
  }
});

router.get('/teams', async (_req, res, next) => {
  try {
    const teams = await footballDataService.getAllTeams();
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

router.get('/teams/:id', async (req, res, next) => {
  try {
    const team = await footballDataService.getTeamById(req.params.id);
    if (!team) {
      res.status(404).json({ error: 'Equipo no encontrado' });
      return;
    }
    res.json(team);
  } catch (err) {
    next(err);
  }
});

router.get('/teams/:id/players', async (req, res, next) => {
  try {
    const players = await footballDataService.getTeamPlayers(req.params.id);
    res.json(players.map(withPhotoUrl));
  } catch (err) {
    next(err);
  }
});

router.get('/players/:id', async (req, res, next) => {
  try {
    const player = await footballDataService.getPlayerById(req.params.id);
    if (!player) {
      res.status(404).json({ error: 'Jugador no encontrado' });
      return;
    }
    res.json(withPhotoUrl(player));
  } catch (err) {
    next(err);
  }
});

router.get('/players/:id/stats', async (req, res, next) => {
  try {
    const stats = await footballDataService.getPlayerStats(req.params.id);
    if (!stats) {
      res.status(404).json({ error: 'Estadísticas no disponibles' });
      return;
    }
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/fixtures/:id', async (req, res, next) => {
  try {
    const match = await footballDataService.getMatchById(req.params.id);
    if (!match) {
      res.status(404).json({ error: 'Partido no encontrado' });
      return;
    }
    res.json(match);
  } catch (err) {
    next(err);
  }
});

router.get('/fixtures', async (req, res, next) => {
  try {
    const fixtures = await footballDataService.getFixtures({
      group: typeof req.query.group === 'string' ? req.query.group : undefined,
      teamId: typeof req.query.teamId === 'string' ? req.query.teamId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    res.json(fixtures);
  } catch (err) {
    next(err);
  }
});

export default router;
