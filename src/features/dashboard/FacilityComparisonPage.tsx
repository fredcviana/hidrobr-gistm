// src/features/dashboard/FacilityComparisonPage.tsx
// Visão comparativa de conformidade entre as barragens de um mesmo cliente.
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Loader2, AlertCircle, Layers } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { cycleFacilityIds, buildRequirementScoreMaps, facilityWeightedScore } from '@/lib/facilityScoring'

const TSM_STANDARD_ID = 2

const GISTM_TOPIC_COLORS: Record<string, string> = {
  T1: '#1B4F72', T2: '#117A65', T3: '#7D6608',
  T4: '#6E2F1A', T5: '#922B21', T6: '#1A5276',
}

function getBarColor(pct: number) {
  if (pct >= 75) return '#059669'
  if (pct >= 50) return '#2a78d6'
  if (pct >= 25) return '#D97706'
  if (pct > 0) return '#e34948'
  return '#D1D5DB'
}

function ScoreCell({ score, isWeakest }: { score: number; isWeakest: boolean }) {
  return (
    <td className="px-3 py-2 text-center">
      <span
        className="inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded-lg text-xs font-bold"
        style={{ color: getBarColor(score), background: getBarColor(score) + '15', outline: isWeakest ? `1.5px solid ${getBarColor(score)}` : 'none' }}
        title={isWeakest ? 'Barragem mais crítica neste tópico' : undefined}
      >
        {score}%
      </span>
    </td>
  )
}

export function FacilityComparisonPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const orgId = profile?.organization_id

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-facility-comparison', orgId, hb],
    enabled: !!profile,
    queryFn: async () => {
      let cycleQuery = supabase.from('assessment_cycles')
        .select('*, organizations(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      if (!hb && orgId) cycleQuery = cycleQuery.eq('organization_id', orgId)
      const { data: cycles } = await cycleQuery
      const cycle = cycles?.[0] ?? null

      if (!cycle) return { cycle: null, facilities: [], gTopics: [], tTopics: [] }

      const facilityIds = cycleFacilityIds(cycle)
      if (facilityIds.length === 0) return { cycle, facilities: [], gTopics: [], tTopics: [] }

      const { data: facilitiesRaw } = await supabase.from('tailings_facilities')
        .select('id,name,dam_code,consequence_class').in('id', facilityIds).order('name')

      // ── GISTM ──────────────────────────────────────────
      const { data: gTopics } = await supabase.from('gistm_topics').select('*').order('display_order')
      const { data: gPrinciples } = await supabase.from('gistm_principles').select('*').order('display_order')
      const { data: gRequirements } = await supabase.from('gistm_requirements').select('*')
      const { data: gResponses } = await supabase.from('requirement_responses').select('*')
        .eq('cycle_id', cycle.id).in('facility_id', facilityIds)
      const gRespIds = (gResponses ?? []).map((r: any) => r.id)
      const { data: gAssessments } = gRespIds.length > 0
        ? await supabase.from('hidrobr_assessments').select('response_id, score, score_value').in('response_id', gRespIds)
        : { data: [] as any[] }
      const gAssessMap = new Map((gAssessments ?? []).map((a: any) => [a.response_id, a]))
      const { scorePerFacility: gScorePerFacility } = buildRequirementScoreMaps(facilityIds, gResponses ?? [], gAssessMap)

      // ── TSM ────────────────────────────────────────────
      const { data: tTopics } = await supabase.from('standard_topics').select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')
      const { data: tRequirements } = await supabase.from('standard_requirements').select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')
      const tReqIds = (tRequirements ?? []).map((r: any) => r.id)
      const { data: tResponses } = tReqIds.length > 0
        ? await supabase.from('tsm_responses').select('*').eq('cycle_id', cycle.id).in('facility_id', facilityIds).in('requirement_id', tReqIds)
        : { data: [] as any[] }
      const tRespIds = (tResponses ?? []).map((r: any) => r.id)
      const { data: tAssessments } = tRespIds.length > 0
        ? await supabase.from('tsm_assessments').select('*').in('response_id', tRespIds)
        : { data: [] as any[] }
      const tAssessMap = new Map((tAssessments ?? []).map((a: any) => [a.response_id, a]))
      const { scorePerFacility: tScorePerFacility } = buildRequirementScoreMaps(facilityIds, tResponses ?? [], tAssessMap)

      const facilities = (facilitiesRaw ?? []).map((f: any) => {
        const gScore = facilityWeightedScore(gRequirements ?? [], f.id, gScorePerFacility)
        const tScore = facilityWeightedScore(tRequirements ?? [], f.id, tScorePerFacility)
        const combined = Math.round((gScore + tScore) / 2)

        const gTopicScores = (gTopics ?? []).map((topic: any) => {
          const tPrinciples = (gPrinciples ?? []).filter((p: any) => p.topic_id === topic.id)
          const reqs = (gRequirements ?? []).filter((r: any) => tPrinciples.some((p: any) => p.id === r.principle_id))
          return { code: topic.code, score: facilityWeightedScore(reqs, f.id, gScorePerFacility) }
        })
        const tTopicScores = (tTopics ?? []).map((topic: any) => {
          const reqs = (tRequirements ?? []).filter((r: any) => r.topic_id === topic.id)
          return { code: topic.code, score: facilityWeightedScore(reqs, f.id, tScorePerFacility) }
        })

        return {
          id: f.id, name: f.name, damCode: f.dam_code, consequenceClass: f.consequence_class,
          gScore, tScore, combined, gTopicScores, tTopicScores,
        }
      })

      return { cycle, facilities, gTopics: gTopics ?? [], tTopics: tTopics ?? [] }
    },
  })

  if (isLoading) return (
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
      <span className="text-sm">Carregando comparativo entre barragens...</span>
    </div>
  )

  if (error) return (
    <div className="p-6">
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Erro ao carregar comparativo</p>
        <p className="text-xs text-gray-400 mt-1">{(error as any)?.message}</p>
      </div>
    </div>
  )

  const { cycle, facilities, gTopics, tTopics } = data ?? { cycle: null, facilities: [], gTopics: [], tTopics: [] }

  if (!cycle) return (
    <div className="p-6">
      <div className="card p-10 text-center">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Nenhum ciclo ativo encontrado</p>
        <p className="text-gray-400 text-sm mt-1">
          {hb ? 'Crie um ciclo na página de Clientes.' : 'Contate a HIDROBR para criar um ciclo.'}
        </p>
      </div>
    </div>
  )

  if (facilities.length < 2) return (
    <div className="p-6">
      <div className="card p-10 text-center">
        <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Este cliente tem apenas uma barragem em escopo neste ciclo</p>
        <p className="text-gray-400 text-sm mt-1">A visão comparativa aparece quando há duas ou mais barragens.</p>
      </div>
    </div>
  )

  const chartData = facilities.map((f: any) => ({ name: f.name, GISTM: f.gScore, TSM: f.tScore, Combinado: f.combined }))

  function weakestId(topicCode: string, key: 'gTopicScores' | 'tTopicScores') {
    let min = Infinity, id = ''
    facilities.forEach((f: any) => {
      const s = f[key].find((t: any) => t.code === topicCode)?.score ?? 0
      if (s < min) { min = s; id = f.id }
    })
    return id
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comparativo entre Barragens</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cycle.name} · {cycle.organizations?.name} · {facilities.length} barragens</p>
        </div>
        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />Ciclo ativo
        </span>
      </div>

      {/* Gráfico comparativo */}
      <div className="card p-5">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900">Aderência geral por barragem</h2>
          <p className="text-xs text-gray-400 mt-0.5">GISTM, TSM e score combinado (média) de cada barragem — o resultado do cliente é o pior caso (elo mais fraco) entre elas</p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="GISTM" fill="#0A9396" radius={[4, 4, 0, 0]} />
            <Bar dataKey="TSM" fill="#7D6608" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Combinado" fill="#1A5276" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela por barragem */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Ranking de conformidade</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="py-2 pr-3">Barragem</th>
                <th className="py-2 px-3 text-center">Classe de consequência</th>
                <th className="py-2 px-3 text-center">GISTM</th>
                <th className="py-2 px-3 text-center">TSM</th>
                <th className="py-2 px-3 text-center">Combinado</th>
              </tr>
            </thead>
            <tbody>
              {[...facilities].sort((a: any, b: any) => a.combined - b.combined).map((f: any) => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-gray-800">{f.name}</div>
                    {f.damCode && <div className="text-xs text-gray-400">{f.damCode}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-center text-xs text-gray-500">{f.consequenceClass ?? '—'}</td>
                  <ScoreCell score={f.gScore} isWeakest={false} />
                  <ScoreCell score={f.tScore} isWeakest={false} />
                  <ScoreCell score={f.combined} isWeakest={f.id === [...facilities].sort((a: any, b: any) => a.combined - b.combined)[0].id} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparativo por tópico GISTM */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Score por tópico GISTM — por barragem</h2>
        <p className="text-xs text-gray-400 mb-3">Contorno destacado = barragem mais crítica naquele tópico</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="py-2 pr-3">Barragem</th>
                {gTopics.map((t: any) => (
                  <th key={t.id} className="py-2 px-3 text-center" style={{ color: GISTM_TOPIC_COLORS[t.code] ?? '#0A9396' }}>{t.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilities.map((f: any) => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-gray-800">{f.name}</td>
                  {gTopics.map((t: any) => {
                    const score = f.gTopicScores.find((x: any) => x.code === t.code)?.score ?? 0
                    return <ScoreCell key={t.id} score={score} isWeakest={f.id === weakestId(t.code, 'gTopicScores')} />
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparativo por tópico TSM */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Score por tópico TSM — por barragem</h2>
        <p className="text-xs text-gray-400 mb-3">Contorno destacado = barragem mais crítica naquele tópico</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="py-2 pr-3">Barragem</th>
                {tTopics.map((t: any) => (
                  <th key={t.id} className="py-2 px-3 text-center" style={{ color: t.color_hex ?? '#7D6608' }}>{t.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilities.map((f: any) => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-gray-800">{f.name}</td>
                  {tTopics.map((t: any) => {
                    const score = f.tTopicScores.find((x: any) => x.code === t.code)?.score ?? 0
                    return <ScoreCell key={t.id} score={score} isWeakest={f.id === weakestId(t.code, 'tTopicScores')} />
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
