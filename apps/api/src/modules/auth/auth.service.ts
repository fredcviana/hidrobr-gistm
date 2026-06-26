// apps/api/src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { AppError, UnauthorizedError, NotFoundError } from '../../shared/utils/response'
import { AuthPayload } from '../../shared/middleware/authenticate'

const REFRESH_TTL_DAYS = 7

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  })
  const refreshToken = uuidv4() + '-' + uuidv4() // opaque token
  return { accessToken, refreshToken }
}

export const authService = {
  async login(email: string, password: string, ip?: string, userAgent?: string) {
    // Busca usuário ativo
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: true, deletedAt: null },
      include: { organization: { select: { id: true, name: true, isActive: true } } },
    })

    if (!user) throw new UnauthorizedError('E-mail ou senha incorretos.')

    // Verifica se a organização está ativa (para usuários de cliente)
    if (user.organization && !user.organization.isActive) {
      throw new UnauthorizedError('Sua organização está inativa. Contate a HIDROBR.')
    }

    // Verifica senha
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedError('E-mail ou senha incorretos.')

    // Gera tokens
    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
    }
    const family = uuidv4()
    const { accessToken, refreshToken } = generateTokens(payload)

    // Persiste refresh token
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS)

    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        family,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    })

    // Atualiza último login
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        organizationId: user.organizationId,
        organization: user.organization,
      },
    }
  },

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken)

    const session = await prisma.userSession.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    })

    if (!session) throw new UnauthorizedError('Refresh token inválido ou expirado.')
    if (!session.user.isActive) throw new UnauthorizedError('Usuário inativo.')

    // Invalida o token atual (rotação)
    await prisma.userSession.delete({ where: { id: session.id } })

    // Gera novos tokens
    const payload: AuthPayload = {
      userId: session.user.id,
      role: session.user.role,
      organizationId: session.user.organizationId,
    }
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload)

    // Persiste novo refresh token na mesma família
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS)

    await prisma.userSession.create({
      data: {
        userId: session.user.id,
        tokenHash: hashToken(newRefreshToken),
        family: session.family,
        expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    })

    return { accessToken, refreshToken: newRefreshToken }
  },

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken)
    await prisma.userSession.deleteMany({ where: { tokenHash } })
  },

  async getMe(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: {
        id: true, email: true, fullName: true, role: true,
        jobTitle: true, avatarUrl: true, phone: true,
        organizationId: true, lastLogin: true, preferences: true,
        organization: {
          select: { id: true, name: true, segment: true, logoUrl: true, isActive: true },
        },
      },
    })
    if (!user) throw new NotFoundError('Usuário')
    return user
  },
}
