import { Router } from 'express'
import { authenticate, authorize, requireSameOrg } from '../../shared/middleware/authenticate'
import { prisma } from '../../config/database'
import { ok, paginated, NotFoundError } from '../../shared/utils/response'

export const organizationsRouter = Router()

organizationsRouter.get('/', authenticate, authorize('hidrobr_admin', 'hidrobr_consultant'), async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const perPage = Math.min(parseInt(req.query.per_page as string) || 20, 100)
  const [data, total] = await Promise.all([
    prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      include: { facilities: { select: { id: true } }, cycles: { where: { status: 'active' }, select: { id: true, overallScore: true } } },
      skip: (page - 1) * perPage, take: perPage, orderBy: { name: 'asc' },
    }),
    prisma.organization.count({ where: { isActive: true, deletedAt: null } }),
  ])
  return paginated(res, data, total, page, perPage)
})

organizationsRouter.get('/:id', authenticate, requireSameOrg, async (req, res) => {
  const org = await prisma.organization.findFirst({
    where: { id: req.params.id, isActive: true, deletedAt: null },
    include: { facilities: { where: { isActive: true } }, users: { where: { isActive: true, deletedAt: null }, select: { id: true, fullName: true, role: true, email: true, jobTitle: true } } },
  })
  if (!org) throw new NotFoundError('Organização')
  return ok(res, org)
})

organizationsRouter.post('/', authenticate, authorize('hidrobr_admin'), async (req, res) => {
  const org = await prisma.organization.create({ data: req.body })
  return ok(res, org, undefined, 201)
})

organizationsRouter.patch('/:id', authenticate, async (req, res) => {
  const org = await prisma.organization.update({ where: { id: req.params.id }, data: req.body })
  return ok(res, org)
})
