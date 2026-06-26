// apps/api/src/modules/auth/auth.validators.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido.').toLowerCase().trim(),
  password: z.string().min(1, 'Senha obrigatória.'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório.'),
})
