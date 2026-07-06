// src/features/dashboard/DashboardPage.tsx
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts'
import { Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const TOPIC_COLORS: Record<string, string> = {
  T1: '#1B4F72', T2: '#117A65', T3: '#7D6608',
  T4: '#6E2F1A', T5: '#922B21', T6: '#1A5276',
}

function getBarColor(pct: number) {
  if (pct >= 75) return '#059669'
  if (pct >= 50) return '#2a78d6'
  if (pct >= 25) return '#D97706'
  if (pct > 0)   return '#e34948'
  return '#D1D5DB'
}

// ── Gauge ─────────────────────────────────────────────────────
function Gauge({ value, label, color }: { value: number; label?: string; color?: string }) {
  const r = 38, cx = 50, cy = 52
  const sa = -Math.PI * 0.75, sw = Math.PI * 1.5
  const v = Math.min(Math.max(value, 0), 100)
  const fs = sw * (v / 100)
  const ea = sa + fs
  const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa)
  const bx2 = cx + r * Math.cos(sa + sw), by2 = cy + r * Math.sin(sa + sw)
  const ex = cx + r * Math.cos(ea), ey = cy + r * Math.sin(ea)
  const lf = fs > Math.PI ? 1 : 0
  const col = color ?? getBarColor(v)
  return (
    <svg viewBox="0 0 100 88" className="w-28 h-24 mx-auto">
      <path d={`M${x1} ${y1} A ${r} ${r} 0 1 1 ${bx2} ${by2}`} fill="none" stroke="#F3F4F6" strokeWidth="9" strokeLinecap="round" />
      {v > 0 && <path d={`M${x1} ${y1} A ${r} ${r} 0 ${lf} 1 ${ex} ${ey}`} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" />}
      <text x="50" y="56" textAnchor="middle" fontSize="18" fontWeight="800" fill={col} fontFamily="Inter,sans-serif">{v}%</text>
      {label && <text x="50" y="70" textAnchor="middle" fontSize="8" fill="#9CA3AF" fontFamily="Inter,sans-serif">{label}</text>}
    </svg>
  )
}

function MetricCard({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color: string }) {
  return (
    <div className="card p-4" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-3xl font-extrabold tracking-tight" style={{ color }}>{value}</div>
      <div className="text-sm text-gray-500 mt-1.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// ── Gráfico de barras por princípio ───────────────────────────
function PrincipleAdherenceChart({ principleScores }: { principleScores: any[] }) {
  if (principleScores.length === 0) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      Nenhuma avaliação publicada ainda
    </div>
  )
  return (
    <div className="space-y-0">
      {principleScores.map((p: any) => {
        const barColor = getBarColor(p.atual)
        const proj = Math.min(100, p.atual + p.gain)
        const hasGain = p.gain > 0
        return (
          <div key={p.code} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
            {/* Código */}
            <div className="w-8 flex-shrink-0">
              <span className="text-[10px] font-bold text-gray-400">{p.code}</span>
            </div>
            {/* Barra */}
            <div className="flex-1 relative h-6 bg-gray-100 rounded-md overflow-hidden">
              {/* Barra atual */}
              <div
                className="absolute left-0 top-0 h-full rounded-md transition-all"
                style={{
                  width: `${p.atual}%`,
                  background: barColor,
                  borderRadius: hasGain && p.atual > 0 ? '6px 0 0 6px' : '6px',
                  opacity: p.atual === 0 ? 0 : 1,
                }}
              />
              {/* Ganho projetado */}
              {hasGain && (
                <div
                  className="absolute top-0 h-full"
                  style={{
                    left: `${p.atual}%`,
                    width: `${p.gain}%`,
                    background: barColor,
                    opacity: 0.3,
                    borderRadius: '0 6px 6px 0',
                  }}
                />
              )}
              {/* Label dentro da barra */}
              {p.atual >= 15 && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                  {p.atual}%
                </span>
              )}
            </div>
            {/* Valores à direita */}
            <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
              {p.atual < 15 && (
                <span className="text-[11px] font-semibold" style={{ color: p.atual === 0 ? '#9CA3AF' : barColor }}>
                  {p.atual}%
                </span>
              )}
              {hasGain && (
                <span className="text-[10px] text-emerald-600 font-semibold">
                  →{proj}%
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Legenda de cores */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 mt-1">
        {[
          { color: '#059669', label: '≥75% Conforme' },
          { color: '#2a78d6', label: '50–74% Progresso' },
          { color: '#D97706', label: '25–49% Atenção' },
          { color: '#e34948', label: '1–24% Crítico' },
          { color: '#D1D5DB', label: '0% Não iniciado' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px] text-gray-400 ml-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-emerald-400 opacity-40" />
          Ganho projetado
        </span>
      </div>
    </div>
  )
}

// ── Gráfico de linha temporal ─────────────────────────────────
function AdherenceTimelineChart({ timelineData, overallScore }: { timelineData: any[]; overallScore: number }) {
  if (timelineData.length < 2) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      Dados insuficientes para gerar linha do tempo
    </div>
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
        <div className="font-semibold text-gray-700 mb-1.5">{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-bold" style={{ color: p.color }}>{p.value}%</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={timelineData} margin={{ top: 10, right: 24, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={overallScore} stroke="#E5E7EB" strokeDasharray="4 4" />
        <Line
          type="monotone" dataKey="aderencia"
          stroke="#2a78d6" strokeWidth={2.5}
          dot={{ fill: '#2a78d6', r: 4, strokeWidth: 0 }}
          name="Aderência real"
          connectNulls
        />
        <Line
          type="monotone" dataKey="projetado"
          stroke="#059669" strokeWidth={2}
          strokeDasharray="5 3"
          dot={{ fill: '#059669', r: 3, strokeWidth: 0 }}
          name="Projeção"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Página principal ──────────────────────────────────────────
export function DashboardPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const orgId = profile?.organization_id

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-v3', orgId, hb],
    enabled: !!profile,
    queryFn: async () => {
      // Ciclo ativo
      let cycleQuery = supabase.from('assessment_cycles')
        .select('*, organizations(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      if (!hb && orgId) cycleQuery = cycleQuery.eq('organization_id', orgId)
      const { data: cycles } = await cycleQuery
      const cycle = cycles?.[0] ?? null

      if (!cycle) return {
        cycle: null, overallScore: 0, projectedScore: 0,
        kpis: { total: 0, approved: 0, pending: 0, notStarted: 0 },
        principleScores: [], timelineData: [], actionKpis: { total: 0, open: 0, completed: 0, totalGain: 0 },
        topicProgressData: [],
      }

      // Busca tudo separadamente
      const { data: topics } = await supabase.from('gistm_topics').select('*').order('display_order')
      const { data: principles } = await supabase.from('gistm_principles').select('*').order('display_order')
      const { data: requirements } = await supabase.from('gistm_requirements').select('*')
      const { data: responses } = await supabase.from('requirement_responses').select('*').eq('cycle_id', cycle.id)
      const { data: assessments } = await supabase.from('hidrobr_assessments')
        .select('response_id, score, score_value, published_at')
        .in('response_id', (responses ?? []).map((r: any) => r.id))
      let actionsQuery = supabase.from('action_items').select('*').order('due_date', { ascending: true })
      if (!hb && orgId) actionsQuery = actionsQuery.eq('organization_id', orgId)
      const { data: actionsRaw } = await actionsQuery

      const actionsArr = Array.isArray(actionsRaw) ? actionsRaw : []
      const assessMap = new Map((assessments ?? []).map((a: any) => [a.response_id, a]))
      const respByReqId = new Map((responses ?? []).map((r: any) => [r.requirement_id, r]))
      const reqWeightMap = new Map((requirements ?? []).map((r: any) => [r.id, Number(r.weight) || 1]))

      // Score global — todos os 77 requisitos no denominador
      let globalWeightedSum = 0, globalTotalWeight = 0
      ;(requirements ?? []).forEach((req: any) => {
        const w = Number(req.weight) || 1
        globalTotalWeight += w
        const resp = respByReqId.get(req.id)
        if (resp) {
          const sv = assessMap.get(resp.id)?.score_value
          if (sv != null) globalWeightedSum += sv * w
        }
      })
      const overallScore = globalTotalWeight > 0 ? Math.round(globalWeightedSum / globalTotalWeight) : 0

      // KPIs
      const totalReqs = (requirements ?? []).length
      const approved = (responses ?? []).filter((r: any) => r.status === 'approved').length
      const pending = (responses ?? []).filter((r: any) => ['submitted', 'under_review'].includes(r.status)).length
      const notStarted = totalReqs - (responses ?? []).length + (responses ?? []).filter((r: any) => r.status === 'not_started').length

      // Ações
      const openActions = actionsArr.filter((a: any) => !['completed', 'cancelled'].includes(a.status))
      const totalGain = openActions.reduce((s: number, a: any) => s + (Number(a.estimated_gain) || 0), 0)
      const projectedScore = Math.min(100, Math.round(overallScore + totalGain))

      // ── Score por princípio ────────────────────────────────
      const principleScores = (principles ?? []).map((p: any) => {
        const pReqs = (requirements ?? []).filter((r: any) => r.principle_id === p.id)
        let wSum = 0, wTotal = 0
        pReqs.forEach((req: any) => {
          const w = Number(req.weight) || 1
          wTotal += w
          const resp = respByReqId.get(req.id)
          if (resp) {
            const sv = assessMap.get(resp.id)?.score_value
            if (sv != null) wSum += sv * w
          }
        })
        const atual = wTotal > 0 ? Math.round(wSum / wTotal) : 0

        // Ganho projetado: soma estimated_gain das ações abertas vinculadas a este princípio
        const gain = openActions
          .filter((a: any) => (a.principle_codes ?? []).includes(p.code))
          .reduce((s: number, a: any) => s + (Number(a.estimated_gain) || 0), 0)

        const topic = (topics ?? []).find((t: any) => t.id === p.topic_id)
        return { code: p.code, number: p.number, atual, gain: Math.round(gain), topicCode: topic?.code ?? 'T1', topicColor: TOPIC_COLORS[topic?.code ?? 'T1'] ?? '#0A9396' }
      })

      // ── Linha do tempo ─────────────────────────────────────
      // Pontos reais: cada avaliação publicada acumula score no tempo
      type TimeEvent = { date: string; type: 'assessment' | 'action'; gain: number }
      const events: TimeEvent[] = []

      // Avaliações: cada uma representa a mudança no score quando foi publicada
      ;(assessments ?? []).forEach((a: any) => {
        if (a.published_at) {
          events.push({ date: a.published_at.slice(0, 10), type: 'assessment', gain: 0 })
        }
      })

      // Ações concluídas
      actionsArr.filter((a: any) => a.status === 'completed' && a.completed_at).forEach((a: any) => {
        events.push({ date: a.completed_at.slice(0, 10), type: 'action', gain: Number(a.estimated_gain) || 0 })
      })

      // Ações abertas com prazo (projetadas)
      openActions.filter((a: any) => a.due_date && a.estimated_gain).forEach((a: any) => {
        events.push({ date: a.due_date, type: 'action', gain: Number(a.estimated_gain) || 0 })
      })

      // Agrupa por data e recalcula score acumulado
      const dateSet = new Set(events.map(e => e.date))
      const sortedDates = Array.from(dateSet).sort()

      // Para cada data, recalcula o score considerando avaliações até aquela data
      const timelineData: any[] = []

      // Ponto de hoje com score atual
      const today = new Date().toISOString().slice(0, 10)
      timelineData.push({
        data: 'Hoje',
        aderencia: overallScore,
        projetado: null,
      })

      // Pontos futuros (ações abertas com prazo)
      let futureScore = overallScore
      const futureDates = sortedDates.filter(d => d > today)
      const byDate: Record<string, number> = {}
      openActions.filter((a: any) => a.due_date && a.estimated_gain).forEach((a: any) => {
        const d = a.due_date
        byDate[d] = (byDate[d] ?? 0) + (Number(a.estimated_gain) || 0)
      })
      futureDates.slice(0, 8).forEach(d => {
        futureScore = Math.min(100, futureScore + (byDate[d] ?? 0))
        const [year, month] = d.split('-')
        timelineData.push({
          data: `${month}/${year.slice(2)}`,
          aderencia: null,
          projetado: Math.round(futureScore),
        })
      })

      // Histórico real: recalcula score para cada data de avaliação passada
      const pastDates = sortedDates.filter(d => d <= today)
      if (pastDates.length > 1) {
        // Para cada data passada, calcula o score com avaliações até aquela data
        const historicalPoints: any[] = []
        pastDates.forEach(d => {
          const assessUntilDate = (assessments ?? []).filter((a: any) => a.published_at && a.published_at.slice(0, 10) <= d)
          const assessUntilMap = new Map(assessUntilDate.map((a: any) => [a.response_id, a]))
          let wSum = 0, wTotal = 0
          ;(requirements ?? []).forEach((req: any) => {
            const w = Number(req.weight) || 1
            wTotal += w
            const resp = respByReqId.get(req.id)
            if (resp) {
              const sv = assessUntilMap.get(resp.id)?.score_value
              if (sv != null) wSum += sv * w
            }
          })
          const score = wTotal > 0 ? Math.round(wSum / wTotal) : 0
          const [year, month, day] = d.split('-')
          historicalPoints.push({ data: `${day}/${month}`, aderencia: score, projetado: null })
        })
        // Insere histórico antes do "Hoje"
        timelineData.splice(0, 0, ...historicalPoints)
      }

      // Progresso por tópico para barra lateral
      const topicProgressData = (topics ?? []).map((topic: any, i: number) => {
        const tPrinciples = (principles ?? []).filter((p: any) => p.topic_id === topic.id)
        const tReqs = (requirements ?? []).filter((r: any) => tPrinciples.some((p: any) => p.id === r.principle_id))
        const tApproved = tReqs.filter((r: any) => respByReqId.get(r.id)?.status === 'approved').length
        let wSum = 0, wTotal = 0
        tReqs.forEach((req: any) => {
          const w = Number(req.weight) || 1
          wTotal += w
          const resp = respByReqId.get(req.id)
          if (resp) {
            const sv = assessMap.get(resp.id)?.score_value
            if (sv != null) wSum += sv * w
          }
        })
        return {
          code: topic.code,
          name: topic.title,
          score: wTotal > 0 ? Math.round(wSum / wTotal) : 0,
          pct: tReqs.length > 0 ? Math.round((tApproved / tReqs.length) * 100) : 0,
          color: Object.values(TOPIC_COLORS)[i] ?? '#0A9396',
        }
      })

      return {
        cycle, overallScore, projectedScore,
        kpis: { total: totalReqs, approved, pending, notStarted },
        principleScores, timelineData, topicProgressData,
        actionKpis: {
          total: actionsArr.length,
          open: openActions.length,
          completed: actionsArr.filter((a: any) => a.status === 'completed').length,
          totalGain: Math.round(totalGain),
        },
      }
    },
  })

  if (isLoading) return (
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
      <span className="text-sm">Carregando dashboard...</span>
    </div>
  )

  if (error) return (
    <div className="p-6">
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Erro ao carregar dashboard</p>
        <p className="text-xs text-gray-400 mt-1">{(error as any)?.message}</p>
      </div>
    </div>
  )

  if (!data) return null

  const { cycle, overallScore, projectedScore, kpis, principleScores, timelineData, topicProgressData, actionKpis } = data
  const gap = projectedScore - overallScore

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

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cycle.name} · {cycle.organizations?.name}</p>
        </div>
        <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />Ciclo ativo
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard value={`${overallScore}%`} label="Conformidade atual GISTM" color="#0A9396" sub="Todos os 77 requisitos considerados" />
        <MetricCard value={kpis.approved} label={`de ${kpis.total} requisitos aprovados`} color="#059669" sub={`${kpis.total > 0 ? Math.round((kpis.approved / kpis.total) * 100) : 0}% do total`} />
        <MetricCard value={kpis.pending} label="Aguardando avaliação HIDROBR" color="#D97706" sub={kpis.pending > 0 ? 'Ação necessária' : 'Nenhum pendente'} />
        <MetricCard value={kpis.notStarted} label="Requisitos não iniciados" color="#6B7280" sub={`de ${kpis.total} total`} />
      </div>

      {/* Gauges + progresso por tópico */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Aderência atual</div>
          <Gauge value={overallScore} label="conformidade" />
          <div className="text-xs text-gray-400 mt-2">Base: todos os {kpis.total} requisitos</div>
        </div>

        <div className="card p-5 text-center" style={{ borderTop: '3px solid #059669' }}>
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Aderência projetada</div>
          <Gauge value={projectedScore} label="se plano concluído" color="#059669" />
          <div className="text-xs text-emerald-600 font-semibold mt-2">
            {gap > 0 ? `+${gap}% com conclusão do plano` : 'Nenhum ganho estimado'}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">{actionKpis.open} ações abertas · +{actionKpis.totalGain}%</div>
        </div>

        <div className="card p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Score por tópico</div>
          <div className="space-y-2.5">
            {topicProgressData.map((t: any) => (
              <div key={t.code} className="flex items-center gap-2">
                <span className="text-[10px] font-bold w-6 flex-shrink-0" style={{ color: t.color }}>{t.code}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${t.score}%`, background: t.color }} />
                </div>
                <span className="text-[10px] font-semibold w-8 text-right" style={{ color: t.score === 0 ? '#9CA3AF' : t.color }}>{t.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico por princípio */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Aderência por princípio GISTM</h2>
            <p className="text-xs text-gray-400 mt-0.5">Score ponderado por requisito · barra transparente = ganho projetado pelo plano de ação</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            {(['T1','T2','T3','T4','T5','T6'] as const).map(code => (
              <span key={code} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: TOPIC_COLORS[code] }} />
                {code}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8">
          {/* Coluna esquerda: P01-P08 */}
          <div>
            {principleScores.slice(0, 8).map((p: any) => (
              <div key={p.code} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                <div className="w-8 flex-shrink-0">
                  <span className="text-[10px] font-bold" style={{ color: p.topicColor }}>{p.code}</span>
                </div>
                <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                  {p.atual > 0 && (
                    <div className="absolute left-0 top-0 h-full" style={{
                      width: `${p.atual}%`,
                      background: getBarColor(p.atual),
                      borderRadius: p.gain > 0 ? '4px 0 0 4px' : '4px',
                    }} />
                  )}
                  {p.gain > 0 && (
                    <div className="absolute top-0 h-full" style={{
                      left: `${p.atual}%`,
                      width: `${p.gain}%`,
                      background: getBarColor(p.atual),
                      opacity: 0.3,
                      borderRadius: '0 4px 4px 0',
                    }} />
                  )}
                </div>
                <div className="flex items-center gap-1 w-16 flex-shrink-0">
                  <span className="text-[10px] font-semibold" style={{ color: p.atual === 0 ? '#9CA3AF' : getBarColor(p.atual) }}>
                    {p.atual}%
                  </span>
                  {p.gain > 0 && (
                    <span className="text-[9px] text-emerald-600">+{p.gain}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Coluna direita: P09-P15 */}
          <div>
            {principleScores.slice(8).map((p: any) => (
              <div key={p.code} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                <div className="w-8 flex-shrink-0">
                  <span className="text-[10px] font-bold" style={{ color: p.topicColor }}>{p.code}</span>
                </div>
                <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                  {p.atual > 0 && (
                    <div className="absolute left-0 top-0 h-full" style={{
                      width: `${p.atual}%`,
                      background: getBarColor(p.atual),
                      borderRadius: p.gain > 0 ? '4px 0 0 4px' : '4px',
                    }} />
                  )}
                  {p.gain > 0 && (
                    <div className="absolute top-0 h-full" style={{
                      left: `${p.atual}%`,
                      width: `${p.gain}%`,
                      background: getBarColor(p.atual),
                      opacity: 0.3,
                      borderRadius: '0 4px 4px 0',
                    }} />
                  )}
                </div>
                <div className="flex items-center gap-1 w-16 flex-shrink-0">
                  <span className="text-[10px] font-semibold" style={{ color: p.atual === 0 ? '#9CA3AF' : getBarColor(p.atual) }}>
                    {p.atual}%
                  </span>
                  {p.gain > 0 && (
                    <span className="text-[9px] text-emerald-600">+{p.gain}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Legenda de cores */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 pt-3 border-t border-gray-100">
          {[
            { color: '#059669', label: '≥75% Conforme' },
            { color: '#2a78d6', label: '50–74% Em progresso' },
            { color: '#D97706', label: '25–49% Atenção' },
            { color: '#e34948', label: '1–24% Crítico' },
            { color: '#D1D5DB', label: '0% Não iniciado' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Linha do tempo de aderência */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Evolução da aderência ao longo do tempo</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Linha azul: aderência real por data de avaliação · Linha verde: projeção por prazo das ações
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-blue-500 inline-block rounded" />
              Aderência real
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-emerald-500 inline-block rounded border-dashed" style={{ borderTop: '2px dashed #059669', background: 'none' }} />
              Projeção
            </span>
          </div>
        </div>
        <AdherenceTimelineChart timelineData={timelineData} overallScore={overallScore} />
      </div>

      {/* Plano de ação */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total de ações', value: actionKpis.total, color: '#0A9396' },
          { label: 'Ações abertas', value: actionKpis.open, color: '#D97706' },
          { label: 'Concluídas', value: actionKpis.completed, color: '#059669' },
          { label: 'Ganho estimado total', value: `+${actionKpis.totalGain}%`, color: '#059669' },
        ].map(k => (
          <MetricCard key={k.label} value={k.value} label={k.label} color={k.color} />
        ))}
      </div>
    </div>
  )
}
