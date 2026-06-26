import { Router } from 'express'
import { authenticate } from '../../shared/middleware/authenticate'
import { prisma } from '../../config/database'
import { ok } from '../../shared/utils/response'

export const facilitiesRouter = Router()

facilitiesRouter.get('/organizations/:orgId/facilities', authenticate, async (req, res) => {
  const facilities = await prisma.tailingsFacility.findMany({
    where: { organizationId: req.params.orgId, isActive: true, deletedAt: null },
    orderBy: { name: 'asc' },
  })
  return ok(res, facilities)
})

facilitiesRouter.post('/organizations/:orgId/facilities', authenticate, async (req, res) => {
  const facility = await prisma.tailingsFacility.create({
    data: { ...req.body, organizationId: req.params.orgId },
  })
  return ok(res, facility, undefined, 201)
})
