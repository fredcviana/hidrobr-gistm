import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { prisma } from '../../config/database'
import { ok, NotFoundError } from '../../shared/utils/response'

export const cyclesRouter = Router()

cyclesRouter.get('/organizations/:orgId/cycles', authenticate, async (req, res) => {
  const cycles = await prisma.assessmentCycle.findMany({
    where: { organizationId: req.params.orgId },
    include: { facility: { select: { name: true, damCode: true } }, consultant: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return ok(res, cycles)
})

cyclesRouter.post('/organizations/:orgId/cycles', authenticate, authorize('hidrobr_admin', 'hidrobr_consultant'), async (req, res) => {
  const cycle = await prisma.assessmentCycle.create({
    data: { ...req.body, organizationId: req.params.orgId },
  })
  return ok(res, cycle, undefined, 201)
})

cyclesRouter.get('/:id', authenticate, async (req, res) => {
  const cycle = await prisma.assessmentCycle.findUnique({
    where: { id: req.params.id },
    include: { facility: true, organization: { select: { name: true } }, consultant: { select: { fullName: true } } },
  })
  if (!cycle) throw new NotFoundError('Ciclo')
  return ok(res, cycle)
})
