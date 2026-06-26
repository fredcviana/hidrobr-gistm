import { Router } from 'express'
import { authenticate } from '../../shared/middleware/authenticate'
import { ok } from '../../shared/utils/response'

export const evidencesRouter = Router()

evidencesRouter.get('/', authenticate, async (req, res) => {
  return ok(res, { message: 'Módulo evidences — em implementação' })
})
