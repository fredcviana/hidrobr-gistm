import { Router } from 'express'
import { authenticate } from '../../shared/middleware/authenticate'
import { ok } from '../../shared/utils/response'

export const usersRouter = Router()

usersRouter.get('/', authenticate, async (req, res) => {
  return ok(res, { message: 'Módulo users — em implementação' })
})
