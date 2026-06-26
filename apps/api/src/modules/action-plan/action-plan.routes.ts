import { Router } from 'express'
import { authenticate } from '../../shared/middleware/authenticate'
import { ok } from '../../shared/utils/response'
import { prisma } from '../../config/database'

export const actionPlanRouter = Router()

actionPlanRouter.get('/organizations/:orgId/action-items', authenticate, async (req, res) => {
  const { orgId } = req.params
  const where: any = { organizationId: orgId }
  if (req.query.status) where.status = req.query.status
  if (req.query.priority) where.priority = req.query.priority

  const items = await prisma.actionItem.findMany({
    where,
    include: {
      owner: { select: { fullName: true, avatarUrl: true } },
      creator: { select: { fullName: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  })
  return ok(res, items)
})

actionPlanRouter.post('/organizations/:orgId/action-items', authenticate, async (req, res) => {
  const item = await prisma.actionItem.create({
    data: { ...req.body, organizationId: req.params.orgId, createdBy: req.user!.userId },
  })
  return ok(res, item, undefined, 201)
})

actionPlanRouter.patch('/action-items/:id', authenticate, async (req, res) => {
  const item = await prisma.actionItem.update({ where: { id: req.params.id }, data: req.body })
  return ok(res, item)
})
