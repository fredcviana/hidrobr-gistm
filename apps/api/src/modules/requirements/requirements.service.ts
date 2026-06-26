// apps/api/src/modules/requirements/requirements.service.ts
import { prisma } from '../../config/database'
import { AuthPayload, isHidrobr } from '../../shared/middleware/authenticate'
import { NotFoundError, ForbiddenError, AppError } from '../../shared/utils/response'
import { AssessmentScore } from '@prisma/client'

const SCORE_MAP: Record<AssessmentScore, number> = {
  non_conforming: 0,
  partially_conforming: 50,
  conforming: 75,
  fully_conforming: 100,
  not_applicable: 0,
}

// Garante que o ciclo existe e o usuário tem acesso
async function validateCycleAccess(cycleId: string, user: AuthPayload) {
  const cycle = await prisma.assessmentCycle.findUnique({
    where: { id: cycleId },
    include: { organization: true },
  })
  if (!cycle) throw new NotFoundError('Ciclo')

  if (!isHidrobr(user.role) && cycle.organizationId !== user.organizationId) {
    throw new ForbiddenError()
  }
  return cycle
}

// Garante que a resposta existe e cria se necessário
async function ensureResponse(cycleId: string, requirementId: number) {
  let response = await prisma.requirementResponse.findUnique({
    where: { cycleId_requirementId: { cycleId, requirementId } },
  })

  if (!response) {
    const req = await prisma.gistmRequirement.findUnique({ where: { id: requirementId } })
    if (!req) throw new NotFoundError('Princípio GISTM')

    response = await prisma.requirementResponse.create({
      data: { cycleId, requirementId, status: 'not_started' },
    })
  }
  return response
}

// Recalcula o score global do ciclo
async function recalculateCycleScore(cycleId: string) {
  const assessments = await prisma.hidroBrAssessment.findMany({
    where: { response: { cycleId } },
    select: { scoreValue: true },
  })
  if (assessments.length === 0) return

  const avg = assessments.reduce((sum, a) => sum + a.scoreValue, 0) / assessments.length
  await prisma.assessmentCycle.update({
    where: { id: cycleId },
    data: { overallScore: Math.round(avg * 100) / 100 },
  })
}

export const requirementsService = {
  async listResponses(cycleId: string, user: AuthPayload) {
    await validateCycleAccess(cycleId, user)

    const requirements = await prisma.gistmRequirement.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { topic: true },
    })

    const responses = await prisma.requirementResponse.findMany({
      where: { cycleId },
      include: {
        assessment: { select: { score: true, scoreValue: true, publishedAt: true } },
        evidences: { select: { id: true, fileName: true, fileType: true, isValid: true } },
        _count: { select: { comments: true } },
      },
    })

    const responseMap = new Map(responses.map((r) => [r.requirementId, r]))

    // Retorna todos os 18 princípios, com ou sem resposta
    return requirements.map((req) => {
      const response = responseMap.get(req.id)
      return {
        requirement: {
          id: req.id,
          code: req.code,
          title: req.title,
          description: req.description,
          guidance: req.guidance,
          subRequirements: req.subRequirements,
          weight: req.weight,
          displayOrder: req.displayOrder,
          topic: req.topic,
        },
        response: response
          ? {
              id: response.id,
              status: response.status,
              implementationText: response.implementationText,
              responsiblePerson: response.responsiblePerson,
              subReqResponses: response.subReqResponses,
              submittedAt: response.submittedAt,
              revisionCount: response.revisionCount,
              evidenceCount: response.evidences.length,
              commentCount: response._count.comments,
              assessment: isHidrobr(user.role)
                ? response.assessment
                : response.assessment?.score
                ? { score: response.assessment.score, scoreValue: response.assessment.scoreValue }
                : null,
            }
          : { status: 'not_started', evidenceCount: 0, commentCount: 0 },
      }
    })
  },

  async getResponse(cycleId: string, requirementId: number, user: AuthPayload) {
    await validateCycleAccess(cycleId, user)
    const response = await ensureResponse(cycleId, requirementId)

    const full = await prisma.requirementResponse.findUnique({
      where: { id: response.id },
      include: {
        requirement: { include: { topic: true } },
        assessment: true,
        evidences: {
          orderBy: { createdAt: 'desc' },
          include: { uploader: { select: { fullName: true } } },
        },
        comments: {
          where: isHidrobr(user.role) ? {} : { isInternal: false },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { fullName: true, role: true } } },
        },
      },
    })

    return full
  },

  async updateResponse(
    cycleId: string,
    requirementId: number,
    data: {
      implementationText?: string
      implementationDate?: string
      responsiblePerson?: string
      notes?: string
      subReqResponses?: Record<string, { done: boolean; note?: string }>
    },
    user: AuthPayload
  ) {
    const cycle = await validateCycleAccess(cycleId, user)
    const response = await ensureResponse(cycleId, requirementId)

    // Não pode editar se já foi aprovado
    if (response.status === 'approved' && !isHidrobr(user.role)) {
      throw new AppError('Resposta já aprovada não pode ser editada.', 400, 'ALREADY_APPROVED')
    }

    const before = { ...response }
    const updated = await prisma.requirementResponse.update({
      where: { id: response.id },
      data: {
        implementationText: data.implementationText,
        implementationDate: data.implementationDate ? new Date(data.implementationDate) : undefined,
        responsiblePerson: data.responsiblePerson,
        notes: data.notes,
        subReqResponses: data.subReqResponses as any,
        status: response.status === 'not_started' ? 'in_progress' : response.status,
      },
    })

    // Grava histórico
    await prisma.responseHistory.create({
      data: {
        responseId: response.id,
        changedBy: user.userId,
        changeType: 'client_edit',
        snapshotBefore: before as any,
        snapshotAfter: updated as any,
      },
    })

    return updated
  },

  async submitResponse(cycleId: string, requirementId: number, user: AuthPayload) {
    await validateCycleAccess(cycleId, user)
    const response = await ensureResponse(cycleId, requirementId)

    if (!['in_progress', 'needs_revision'].includes(response.status)) {
      throw new AppError(
        `Não é possível submeter uma resposta com status "${response.status}".`,
        400, 'INVALID_STATUS'
      )
    }

    if (!response.implementationText || response.implementationText.trim().length < 20) {
      throw new AppError(
        'A descrição de implementação deve ter pelo menos 20 caracteres.',
        422, 'VALIDATION_ERROR'
      )
    }

    const updated = await prisma.requirementResponse.update({
      where: { id: response.id },
      data: { status: 'submitted', submittedAt: new Date() },
    })

    // Notifica consultores HIDROBR
    const consultants = await prisma.user.findMany({
      where: { role: { in: ['hidrobr_admin', 'hidrobr_consultant'] }, isActive: true },
    })
    await prisma.notification.createMany({
      data: consultants.map((c) => ({
        userId: c.id,
        type: 'assessment_requested' as const,
        title: `Avaliação solicitada — ${response.requirementId}`,
        body: `${user.userId} submeteu o princípio para avaliação.`,
        link: `/cycles/${cycleId}/responses/${requirementId}`,
      })),
    })

    return updated
  },

  async assessResponse(
    cycleId: string,
    requirementId: number,
    data: {
      score: AssessmentScore
      assessmentText: string
      recommendations?: string
      internalNotes?: string
    },
    user: AuthPayload
  ) {
    await validateCycleAccess(cycleId, user)
    const response = await ensureResponse(cycleId, requirementId)

    if (!['submitted', 'under_review'].includes(response.status)) {
      throw new AppError(
        'Apenas respostas submetidas ou em revisão podem ser avaliadas.',
        400, 'INVALID_STATUS'
      )
    }

    const scoreValue = SCORE_MAP[data.score]

    // Cria ou atualiza a avaliação
    await prisma.hidroBrAssessment.upsert({
      where: { responseId: response.id },
      update: {
        assessedBy: user.userId,
        score: data.score,
        scoreValue,
        assessmentText: data.assessmentText,
        recommendations: data.recommendations,
        internalNotes: data.internalNotes,
        publishedAt: new Date(),
        revisedAt: new Date(),
        revisedBy: user.userId,
      },
      create: {
        responseId: response.id,
        assessedBy: user.userId,
        score: data.score,
        scoreValue,
        assessmentText: data.assessmentText,
        recommendations: data.recommendations,
        internalNotes: data.internalNotes,
        publishedAt: new Date(),
      },
    })

    // Atualiza status da resposta
    await prisma.requirementResponse.update({
      where: { id: response.id },
      data: { status: 'approved' },
    })

    // Recalcula score do ciclo
    await recalculateCycleScore(cycleId)

    // Notifica o cliente
    if (response.requirementId) {
      const cycle = await prisma.assessmentCycle.findUnique({
        where: { id: cycleId },
        include: { organization: { include: { users: { where: { isActive: true } } } } },
      })
      if (cycle?.organization?.users) {
        await prisma.notification.createMany({
          data: cycle.organization.users.map((u) => ({
            userId: u.id,
            organizationId: cycle.organizationId,
            type: 'assessment_completed' as const,
            title: `Avaliação concluída — P${String(requirementId).padStart(2, '0')}`,
            body: 'A HIDROBR publicou a avaliação do princípio. Confira o resultado.',
            link: `/cycles/${cycleId}/responses/${requirementId}`,
          })),
        })
      }
    }

    return { success: true, message: 'Avaliação publicada com sucesso.' }
  },

  async requestRevision(
    cycleId: string,
    requirementId: number,
    reason: string,
    user: AuthPayload
  ) {
    await validateCycleAccess(cycleId, user)
    const response = await ensureResponse(cycleId, requirementId)

    await prisma.requirementResponse.update({
      where: { id: response.id },
      data: {
        status: 'needs_revision',
        revisionCount: { increment: 1 },
      },
    })

    return { success: true, message: 'Revisão solicitada com sucesso.' }
  },
}
