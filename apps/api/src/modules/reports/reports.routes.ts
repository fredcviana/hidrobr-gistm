import { Router } from 'express'
import { authenticate } from '../../shared/middleware/authenticate'
import { ok } from '../../shared/utils/response'

export const reportsRouter = Router()

reportsRouter.get('/', authenticate, async (req, res) => {
  return ok(res, { message: 'Módulo reports — em implementação' })
})
