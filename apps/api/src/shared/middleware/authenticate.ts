// apps/api/src/shared/middleware/authenticate.ts
// Middleware de autenticação JWT — protege todas as rotas privadas

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { prisma } from '../../config/database'
import { UnauthorizedError, ForbiddenError } from '../utils/response'
import { UserRole } from '@prisma/client'

export interface AuthPayload {
  userId: string
  role: UserRole
  organizationId: string | null
}

// Estende o tipo Request do Express para incluir o usuário autenticado
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso não fornecido.')
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload
    req.user = payload
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expirado. Faça login novamente.')
    }
    throw new UnauthorizedError('Token inválido.')
  }
}

// Middleware de autorização por roles
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError()
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Seu perfil não tem permissão para esta ação.')
    }
    next()
  }
}

// Helper: verifica se é usuário HIDROBR
export function isHidrobr(role: UserRole) {
  return role === 'hidrobr_admin' || role === 'hidrobr_consultant'
}

// Middleware: garante que o usuário acessa apenas sua própria organização
// (ou é HIDROBR, que pode acessar qualquer uma)
export function requireSameOrg(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new UnauthorizedError()
  if (isHidrobr(req.user.role)) return next()

  const orgIdParam = req.params.orgId || req.params.organizationId
  if (orgIdParam && orgIdParam !== req.user.organizationId) {
    throw new ForbiddenError('Acesso negado a esta organização.')
  }
  next()
}
