// apps/api/src/shared/utils/response.ts
// Helpers para respostas padronizadas da API

import { Response } from 'express'

export interface ApiMeta {
  page?: number
  perPage?: number
  total?: number
  pages?: number
}

export function ok<T>(res: Response, data: T, meta?: ApiMeta, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) })
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, undefined, 201)
}

export function noContent(res: Response) {
  return res.status(204).send()
}

export function paginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  perPage: number
) {
  return ok(res, data, {
    page,
    perPage,
    total,
    pages: Math.ceil(total / perPage),
  })
}

// Classe de erro customizada para a API
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'BAD_REQUEST',
    public readonly fields?: Record<string, string>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} não encontrado.`, 404, 'NOT_FOUND')
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado.') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 422, 'VALIDATION_ERROR', fields)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}
