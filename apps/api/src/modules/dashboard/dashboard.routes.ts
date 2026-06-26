// apps/api/src/modules/dashboard/dashboard.routes.ts
import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { getOrgDashboard, getPortfolio } from './dashboard.controller'

export const dashboardRouter = Router()

dashboardRouter.get('/org/:orgId', authenticate, getOrgDashboard)
dashboardRouter.get('/portfolio', authenticate, authorize('hidrobr_admin', 'hidrobr_consultant'), getPortfolio)
