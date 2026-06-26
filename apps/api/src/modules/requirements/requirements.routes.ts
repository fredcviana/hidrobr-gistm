// apps/api/src/modules/requirements/requirements.routes.ts
import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import {
  listResponses, getResponse, updateResponse,
  submitResponse, assessResponse, requestRevision,
} from './requirements.controller'

export const requirementsRouter = Router()

// Listar todas as respostas de um ciclo
requirementsRouter.get('/cycles/:cycleId/responses', authenticate, listResponses)

// Detalhe de uma resposta
requirementsRouter.get('/cycles/:cycleId/responses/:requirementId', authenticate, getResponse)

// Cliente atualiza resposta
requirementsRouter.put(
  '/cycles/:cycleId/responses/:requirementId',
  authenticate,
  authorize('hidrobr_admin', 'hidrobr_consultant', 'client_admin', 'client_user'),
  updateResponse
)

// Cliente submete para avaliação
requirementsRouter.post(
  '/cycles/:cycleId/responses/:requirementId/submit',
  authenticate,
  authorize('hidrobr_admin', 'hidrobr_consultant', 'client_admin', 'client_user'),
  submitResponse
)

// HIDROBR publica avaliação
requirementsRouter.post(
  '/cycles/:cycleId/responses/:requirementId/assess',
  authenticate,
  authorize('hidrobr_admin', 'hidrobr_consultant'),
  assessResponse
)

// HIDROBR solicita revisão
requirementsRouter.post(
  '/cycles/:cycleId/responses/:requirementId/request-revision',
  authenticate,
  authorize('hidrobr_admin', 'hidrobr_consultant'),
  requestRevision
)
