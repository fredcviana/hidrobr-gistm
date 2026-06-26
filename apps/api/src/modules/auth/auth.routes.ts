// apps/api/src/modules/auth/auth.routes.ts
import { Router } from 'express'
import { login, refreshToken, logout, getMe } from './auth.controller'
import { authenticate } from '../../shared/middleware/authenticate'

export const authRouter = Router()

authRouter.post('/login', login)
authRouter.post('/refresh', refreshToken)
authRouter.post('/logout', authenticate, logout)
authRouter.get('/me', authenticate, getMe)
