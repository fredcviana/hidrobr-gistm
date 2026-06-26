// apps/api/src/shared/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/response'
import { logger } from '../utils/logger'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Erros de validação Zod
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {}
    err.issues.forEach((issue) => {
      fields[issue.path.join('.')] = issue.message
    })
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        fields,
      },
    })
  }

  // Erros da aplicação
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    })
  }

  // Erros do Prisma
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any
    if (prismaErr.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Registro já existe.' },
      })
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registro não encontrado.' },
      })
    }
  }

  // Erros inesperados
  logger.error('Erro não tratado:', { message: err.message, stack: err.stack, url: req.url, method: req.method })

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor.'
        : err.message,
    },
  })
}
