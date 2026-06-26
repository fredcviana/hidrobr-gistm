// apps/api/src/modules/auth/auth.controller.ts
import { Request, Response } from 'express'
import { authService } from './auth.service'
import { loginSchema, refreshSchema } from './auth.validators'
import { ok } from '../../shared/utils/response'

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body)
  const result = await authService.login(body.email, body.password, req.ip, req.headers['user-agent'])
  return ok(res, result)
}

export async function refreshToken(req: Request, res: Response) {
  const body = refreshSchema.parse(req.body)
  const result = await authService.refresh(body.refreshToken)
  return ok(res, result)
}

export async function logout(req: Request, res: Response) {
  const body = refreshSchema.parse(req.body)
  await authService.logout(body.refreshToken)
  return ok(res, { message: 'Logout realizado com sucesso.' })
}

export async function getMe(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.userId)
  return ok(res, user)
}
