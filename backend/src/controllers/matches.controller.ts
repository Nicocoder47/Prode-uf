// matches.controller.ts - minimal NestJS-style controller scaffold
import { Router } from 'express'
import { prisma } from '../prisma/client'

const router = Router()

// GET /matches/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id
  const match = await prisma.match.findUnique({ where: { id }, include: { homeTeam: true, awayTeam: true } })
  if (!match) return res.status(404).json({ error: 'not found' })
  res.json(match)
})

// GET /matches/:id/live snapshot
router.get('/:id/live', async (req, res) => {
  const id = req.params.id
  const snaps = await prisma.liveSnapshot.findMany({ where: { matchId: id }, orderBy: { takenAt: 'desc' }, take: 1 })
  res.json(snaps[0] || null)
})

export default router
