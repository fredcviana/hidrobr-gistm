// apps/api/src/modules/dashboard/dashboard.service.ts
import { prisma } from '../../config/database'
import { NotFoundError } from '../../shared/utils/response'

export const dashboardService = {
  async getOrgDashboard(orgId: string, cycleId?: string) {
    const org = await prisma.organization.findFirst({
      where: { id: orgId, isActive: true, deletedAt: null },
      include: { facilities: { where: { isActive: true } } },
    })
    if (!org) throw new NotFoundError('Organização')

    // Busca ciclo ativo ou o especificado
    const cycle = cycleId
      ? await prisma.assessmentCycle.findUnique({ where: { id: cycleId } })
      : await prisma.assessmentCycle.findFirst({
          where: { organizationId: orgId, status: 'active' },
          orderBy: { createdAt: 'desc' },
        })

    if (!cycle) {
      return {
        organization: { id: org.id, name: org.name, segment: org.segment },
        cycle: null,
        overallScore: 0,
        topicScores: [],
        statusDistribution: {},
        kpis: { totalRequirements: 18, approved: 0, pending: 0, notStarted: 18, evidenceCount: 0 },
        monthlyEvolution: [],
      }
    }

    // Busca todas as respostas do ciclo
    const responses = await prisma.requirementResponse.findMany({
      where: { cycleId: cycle.id },
      include: {
        requirement: { include: { topic: true } },
        assessment: { select: { score: true, scoreValue: true } },
        evidences: { select: { id: true } },
      },
    })

    // Distribuição de status
    const statusDist: Record<string, number> = {
      not_started: 0, in_progress: 0, submitted: 0,
      under_review: 0, approved: 0, needs_revision: 0,
    }

    // Preenche com respostas existentes
    responses.forEach((r) => {
      statusDist[r.status] = (statusDist[r.status] || 0) + 1
    })

    // Princípios sem resposta = not_started
    const answeredIds = new Set(responses.map((r) => r.requirementId))
    const totalReqs = await prisma.gistmRequirement.count()
    statusDist.not_started += totalReqs - answeredIds.size

    const approved = statusDist.approved
    const pending = statusDist.submitted + statusDist.under_review
    const notStarted = statusDist.not_started

    // Score por tópico
    const topics = await prisma.gistmTopic.findMany({ orderBy: { displayOrder: 'asc' } })
    const topicScores = topics.map((topic) => {
      const topicResponses = responses.filter((r) => r.requirement.topicId === topic.id)
      const topicReqs = topicResponses.length

      const assessed = topicResponses.filter((r) => r.assessment)
      const avgScore = assessed.length > 0
        ? Math.round(assessed.reduce((sum, r) => sum + (r.assessment?.scoreValue || 0), 0) / assessed.length)
        : 0

      const approvedCount = topicResponses.filter((r) => r.status === 'approved').length
      const completionPct = topicReqs > 0 ? Math.round((approvedCount / topicReqs) * 100) : 0

      return {
        topicId: topic.id,
        code: topic.code,
        title: topic.title,
        colorHex: topic.colorHex,
        icon: topic.icon,
        requirementCount: topicReqs,
        approvedCount,
        completionPct,
        avgScore,
      }
    })

    // Evidências totais
    const evidenceCount = responses.reduce((sum, r) => sum + r.evidences.length, 0)

    // Evolução mensal (últimos 6 meses de aprovações)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyData = await prisma.requirementResponse.groupBy({
      by: ['updatedAt'],
      where: {
        cycleId: cycle.id,
        status: 'approved',
        updatedAt: { gte: sixMonthsAgo },
      },
      _count: { id: true },
    })

    return {
      organization: { id: org.id, name: org.name, segment: org.segment, logoUrl: org.logoUrl },
      cycle: {
        id: cycle.id,
        name: cycle.name,
        referenceYear: cycle.referenceYear,
        startDate: cycle.startDate,
        targetDate: cycle.targetDate,
        status: cycle.status,
        overallScore: cycle.overallScore,
      },
      overallScore: cycle.overallScore || 0,
      topicScores,
      statusDistribution: statusDist,
      kpis: {
        totalRequirements: 18,
        approved,
        pending,
        notStarted,
        evidenceCount,
        completionPct: Math.round((approved / 18) * 100),
      },
      monthlyEvolution: monthlyData,
    }
  },

  async getPortfolio() {
    const orgs = await prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        facilities: { where: { isActive: true }, select: { id: true, name: true } },
        cycles: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, name: true, overallScore: true, referenceYear: true, status: true },
        },
        users: { where: { isActive: true }, select: { id: true, role: true } },
      },
      orderBy: { name: 'asc' },
    })

    return orgs.map((org) => {
      const activeCycle = org.cycles[0]
      const clientUsers = org.users.filter((u) =>
        ['client_admin', 'client_user', 'readonly'].includes(u.role)
      )
      return {
        id: org.id,
        name: org.name,
        cnpj: org.cnpj,
        segment: org.segment,
        logoUrl: org.logoUrl,
        contractEnd: org.contractEnd,
        facilityCount: org.facilities.length,
        userCount: clientUsers.length,
        activeCycle: activeCycle || null,
        overallScore: activeCycle?.overallScore || 0,
      }
    })
  },
}
