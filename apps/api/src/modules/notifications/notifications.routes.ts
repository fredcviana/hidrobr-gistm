import { Router } from 'express'
import { authenticate } from '../../shared/middleware/authenticate'
import { ok } from '../../shared/utils/response'

export const notificationsRouter = Router()

notificationsRouter.get('/', authenticate, async (req, res) => {
  return ok(res, { message: 'Módulo notifications — em implementação' })
})
