// apps/api/src/modules/dashboard/dashboard.controller.ts
import { Request, Response } from 'express'
import { dashboardService } from './dashboard.service'
import { ok } from '../../shared/utils/response'
import { ForbiddenError } from '../../shared/utils/response'
import { isHidrobr } from '../../shared/middleware/authenticate'

export async function getOrgDashboard(req: Request, res: Response) {
  const { orgId } = req.params
  if (!isHidrobr(req.user!.role) && req.user!.organizationId !== orgId) {
    throw new ForbiddenError()
  }
  const data = await dashboardService.getOrgDashboard(orgId, req.query.cycleId as string)
  return ok(res, data)
}

export async function getPortfolio(req: Request, res: Response) {
  const data = await dashboardService.getPortfolio()
  return ok(res, data)
}
