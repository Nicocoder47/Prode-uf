// players.controller.ts - minimal express controller
import { Router } from 'express'
import { prisma } from '../prisma/client'

const router = Router()

router.get('/:id', async (req, res) => {
  const id = req.params.id
  const player = await prisma.player.findUnique({ where: { id }, include: { team: true, ratings: true } })
  if (!player) return res.status(404).json({ error: 'not found' })
  res.json(player)
})

router.get('/:id/market', async (req, res) => {
  const id = req.params.id
  const market = await prisma.marketValue.findFirst({ where: { playerId: id }, orderBy: { observedAt: 'desc' } })
  res.json(market)
})

export default router
