import { Router } from 'express'
import { authenticate } from '../../shared/middleware/authenticate'
import { ok } from '../../shared/utils/response'

export const academyRouter = Router()

academyRouter.get('/', authenticate, async (req, res) => {
  return ok(res, { message: 'Módulo academy — em implementação' })
})
