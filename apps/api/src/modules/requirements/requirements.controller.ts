// apps/api/src/modules/requirements/requirements.controller.ts
import { Request, Response } from 'express'
import { requirementsService } from './requirements.service'
import { updateResponseSchema, assessSchema } from './requirements.validators'
import { ok } from '../../shared/utils/response'

export async function listResponses(req: Request, res: Response) {
  const data = await requirementsService.listResponses(req.params.cycleId, req.user!)
  return ok(res, data)
}

export async function getResponse(req: Request, res: Response) {
  const data = await requirementsService.getResponse(
    req.params.cycleId,
    parseInt(req.params.requirementId),
    req.user!
  )
  return ok(res, data)
}

export async function updateResponse(req: Request, res: Response) {
  const body = updateResponseSchema.parse(req.body)
  const data = await requirementsService.updateResponse(
    req.params.cycleId,
    parseInt(req.params.requirementId),
    body,
    req.user!
  )
  return ok(res, data)
}

export async function submitResponse(req: Request, res: Response) {
  const data = await requirementsService.submitResponse(
    req.params.cycleId,
    parseInt(req.params.requirementId),
    req.user!
  )
  return ok(res, data)
}

export async function assessResponse(req: Request, res: Response) {
  const body = assessSchema.parse(req.body)
  const data = await requirementsService.assessResponse(
    req.params.cycleId,
    parseInt(req.params.requirementId),
    body,
    req.user!
  )
  return ok(res, data)
}

export async function requestRevision(req: Request, res: Response) {
  const data = await requirementsService.requestRevision(
    req.params.cycleId,
    parseInt(req.params.requirementId),
    req.body.reason,
    req.user!
  )
  return ok(res, data)
}
