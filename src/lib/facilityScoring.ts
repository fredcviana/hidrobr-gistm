// src/lib/facilityScoring.ts
//
// Utilitários compartilhados para agregar avaliações de requisitos (GISTM ou TSM)
// feitas por BARRAGEM (facility) em um resultado consolidado do CLIENTE.
//
// Regra de negócio (definida com o cliente em 2026-07-09, revisada em 2026-07-10
// para refletir a metodologia real já usada pela HIDROBR em avaliações manuais):
//   - Cada requisito é avaliado individualmente para cada barragem do ciclo.
//   - O resultado do requisito no nível do cliente é o PIOR CASO ("elo mais
//     fraco") entre os scores de todas as barragens em escopo — o cliente só
//     é tão conforme quanto sua barragem mais crítica naquele requisito. Uma
//     barragem sem avaliação publicada ainda entra com 0 (mesma convenção já
//     usada para "requisito não avaliado" no cálculo anterior, por cliente).
//   - Esse score consolidado por requisito alimenta as mesmas fórmulas de
//     score por princípio/tópico/geral que já existiam (soma ponderada por peso).

export interface WeightedItem {
  id: number
  weight?: number | string | null
}

export interface FacilityScopedResponse {
  id: string
  facility_id: string
  requirement_id: number
}

export interface AssessmentLike {
  score_value: number
  score?: string | null
  published_at?: string | null
}

/** Extrai a lista de facility_ids em escopo de um assessment_cycle, com compatibilidade
 *  para o campo legado singular `facility_id` em ciclos antigos criados antes do array. */
export function cycleFacilityIds(cycle: { facility_id?: string | null; facility_ids?: string[] | null } | null | undefined): string[] {
  if (!cycle) return []
  if (cycle.facility_ids && cycle.facility_ids.length > 0) return cycle.facility_ids
  if (cycle.facility_id) return [cycle.facility_id]
  return []
}

/** Média ponderada score×peso / soma dos pesos, a partir de um mapa id do item -> score (0-100).
 *  Itens ausentes do mapa contam como score 0 (mesma convenção de "ainda não avaliado"). */
export function weightedAverage(items: WeightedItem[], scoreById: Map<number, number>): number {
  let sum = 0
  let totalWeight = 0
  items.forEach(it => {
    const w = Number(it.weight) || 1
    totalWeight += w
    sum += (scoreById.get(it.id) ?? 0) * w
  })
  return totalWeight > 0 ? Math.round(sum / totalWeight) : 0
}

/**
 * A partir das respostas de requisito de TODAS as barragens em escopo de um ciclo e das
 * avaliações HIDROBR publicadas (mapeadas por response_id), monta:
 *  - scorePerFacility: facility_id -> (requirement_id -> score_value)
 *  - clientScoreByRequirement: requirement_id -> pior caso (mínimo) entre as barragens em escopo
 *
 * `assessByResponseId` pode ser filtrado por data (ex.: para recalcular a linha do tempo
 * histórica considerando apenas avaliações publicadas até uma certa data).
 */
export function buildRequirementScoreMaps(
  facilityIds: string[],
  responses: FacilityScopedResponse[],
  assessByResponseId: Map<string, AssessmentLike>,
) {
  const scorePerFacility = new Map<string, Map<number, number>>()
  facilityIds.forEach(fid => scorePerFacility.set(fid, new Map()))
  // requirement_id -> conjunto de facility_id para as quais o requisito foi marcado
  // "não aplicável" — essas barragens são excluídas do cálculo de pior caso daquele
  // requisito específico, em vez de contarem como 0 (o que penalizaria injustamente
  // uma barragem onde o requisito de fato não se aplica, ex.: uma célula nova ainda
  // sem sistema de monitoramento exigido).
  const naFacilitiesByRequirement = new Map<number, Set<string>>()

  const requirementIds = new Set<number>()
  responses.forEach(r => {
    requirementIds.add(r.requirement_id)
    const assessment = assessByResponseId.get(r.id)
    if (!assessment) return
    if (assessment.score === 'not_applicable') {
      if (!naFacilitiesByRequirement.has(r.requirement_id)) naFacilitiesByRequirement.set(r.requirement_id, new Set())
      naFacilitiesByRequirement.get(r.requirement_id)!.add(r.facility_id)
      return
    }
    const sv = assessment.score_value
    if (sv == null) return
    if (!scorePerFacility.has(r.facility_id)) scorePerFacility.set(r.facility_id, new Map())
    scorePerFacility.get(r.facility_id)!.set(r.requirement_id, sv)
  })

  const clientScoreByRequirement = new Map<number, number>()
  requirementIds.forEach(reqId => {
    const naFacilities = naFacilitiesByRequirement.get(reqId)
    const applicableFacilityIds = naFacilities ? facilityIds.filter(fid => !naFacilities.has(fid)) : facilityIds
    if (applicableFacilityIds.length === 0) {
      // requisito não se aplica a nenhuma barragem em escopo — não deve penalizar o cliente
      clientScoreByRequirement.set(reqId, 100)
      return
    }
    const worst = Math.min(...applicableFacilityIds.map(fid => scorePerFacility.get(fid)?.get(reqId) ?? 0))
    clientScoreByRequirement.set(reqId, worst)
  })

  return { scorePerFacility, clientScoreByRequirement }
}

/** Score (0-100) de UMA barragem específica para um conjunto de itens ponderados
 *  (requisitos de um princípio/tópico/catálogo inteiro), usado na visão comparativa. */
export function facilityWeightedScore(
  items: WeightedItem[],
  facilityId: string,
  scorePerFacility: Map<string, Map<number, number>>,
): number {
  const scoreById = scorePerFacility.get(facilityId) ?? new Map<number, number>()
  return weightedAverage(items, scoreById)
}
