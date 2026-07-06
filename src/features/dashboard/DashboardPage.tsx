// src/features/dashboard/DashboardPage.tsx
// CORRIGIDO: null safety no destructuring + nova hierarquia gistm_principles
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from 'recharts'
import { Loader2, AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const TOPIC_COLORS = ['#1B4F72','#117A65','#7D6608','#6E2F1A','#922B21','#1A5276']

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
  const col = color ?? (v >= 75 ? '#059669' : v >= 50 ? '#0A9396' : v >= 25 ? '#D97706' : '#DC2626')
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

export function DashboardPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const orgId = profile?.organization_id

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-v2', orgId, hb],
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

      if (!cycle) {
        return {
          cycle: null,
          topicScores: [],
          statusDist: [],
          overallScore: 0,
          projectedScore: 0,
          kpis: { total: 0, approved: 0, pending: 0, notStarted: 0 },
          timelineData: [],
          actionKpis: { total: 0, open: 0, completed: 0, totalGain: 0 },
        }
      }

      // Busca estrutura GISTM
      const { data: topics } = await supabase.from('gistm_topics').select('*').order('display_order')
      const { data: principles } = await supabase.from('gistm_principles').select('*').order('display_order')
      const { data: requirements } = await supabase.from('gistm_requirements').select('*')
      const { data: responses } = await supabase.from('requirement_responses')
        .select('*')
        .eq('cycle_id', cycle.id)
      // Busca avaliações separadamente (mais confiável que join aninhado)
      const { data: assessments } = await supabase.from('hidrobr_assessments')
        .select('response_id, score, score_value')
        .in('response_id', (responses ?? []).map((r: any) => r.id))
      const assessMap = new Map((assessments ?? []).map((a: any) => [a.response_id, a]))
      let actionsQuery = supabase.from('action_items').select('*').order('due_date', { ascending: true })
      if (!hb && orgId) actionsQuery = actionsQuery.eq('organization_id', orgId)
      const { data: actionsRaw } = await actionsQuery

      // Combina respostas com avaliações
      const respMap = new Map((responses ?? []).map((r: any) => [
        r.requirement_id,
        { ...r, assessment: assessMap.get(r.id) ?? null }
      ]))

      // Score por tópico
      const topicScores = (topics ?? []).map((topic: any, i: number) => {
        const topicPrinciples = (principles ?? []).filter((p: any) => p.topic_id === topic.id)
        const topicReqs = (requirements ?? []).filter((r: any) =>
          topicPrinciples.some((p: any) => p.id === r.principle_id)
        )
        // Score ponderado: todos os requisitos no denominador, avaliados no numerador
        let weightedSum = 0, totalWeight = 0
        topicReqs.forEach((r: any) => {
          const w = Number(r.weight) || 1
          totalWeight += w
          const resp = respMap.get(r.id)
          if (resp) {
            const sv = assessMap.get(resp.id)?.score_value
            if (sv != null) weightedSum += sv * w
          }
        })
        const approved = topicReqs.filter((r: any) => respMap.get(r.id)?.status === 'approved').length
        return {
          name: topic.code,
          fullName: topic.title,
          avgScore: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0,
          completionPct: topicReqs.length ? Math.round((approved / topicReqs.length) * 100) : 0,
          color: TOPIC_COLORS[i] ?? '#0A9396',
          total: topicReqs.length,
          approved,
        }
      })

      // KPIs
      const totalReqs = (requirements ?? []).length
      const approved = (responses ?? []).filter((r: any) => r.status === 'approved').length
      const pending = (responses ?? []).filter((r: any) => ['submitted', 'under_review'].includes(r.status)).length
      const notStarted = totalReqs - (responses ?? []).length + (responses ?? []).filter((r: any) => r.status === 'not_started').length

      // Score global: considera TODOS os requisitos no denominador
      // Requisitos sem avaliação contam como 0 pontos
      const reqWeightMap = new Map((requirements ?? []).map((r: any) => [r.id, Number(r.weight) || 1]))
      const respByReqId = new Map((responses ?? []).map((r: any) => [r.requirement_id, r]))
      let globalWeightedSum = 0, globalTotalWeight = 0
      ;(requirements ?? []).forEach((req: any) => {
        const w = Number(req.weight) || 1
        globalTotalWeight += w
        const resp = respByReqId.get(req.id)
        if (resp) {
          const sv = assessMap.get(resp.id)?.score_value
          if (sv != null) {
            globalWeightedSum += sv * w
          }
          // se tem resposta mas sem avaliação, conta 0 (já está no denominador)
        }
        // sem resposta = 0 pontos (já está no denominador)
      })
      const overallScore = globalTotalWeight > 0
        ? Math.round(globalWeightedSum / globalTotalWeight)
        : 0

      // Status distribution
      const statusCount: Record<string, number> = { not_started: 0, in_progress: 0, submitted: 0, approved: 0, needs_revision: 0 }
      ;(responses ?? []).forEach((r: any) => { statusCount[r.status] = (statusCount[r.status] ?? 0) + 1 })
      statusCount.not_started += totalReqs - (responses ?? []).length
      const statusDist = Object.entries(statusCount)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({
          name: { not_started: 'Não iniciado', in_progress: 'Em andamento', submitted: 'Ag. avaliação', approved: 'Aprovado', needs_revision: 'Revisar' }[k] ?? k,
          value: v,
          color: { not_started: '#E5E7EB', in_progress: '#3B82F6', submitted: '#D97706', approved: '#059669', needs_revision: '#DC2626' }[k] ?? '#9CA3AF',
        }))

      // Ações e projeção
      const actionsArr = Array.isArray(actionsRaw) ? actionsRaw : []
      const openActions = actionsArr.filter((a: any) => !['completed', 'cancelled'].includes(a.status))
      const totalGain = openActions.reduce((sum: number, a: any) => sum + (Number(a.estimated_gain) || 0), 0)
      const projectedScore = Math.min(100, Math.round(overallScore + totalGain))

      // Linha do tempo
      const byMonth: Record<string, number> = {}
      openActions.forEach((a: any) => {
        if (!a.due_date || !a.estimated_gain) return
        const d = new Date(a.due_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        byMonth[key] = (byMonth[key] ?? 0) + (Number(a.estimated_gain) || 0)
      })

      let runningScore = overallScore
      const timelineData: any[] = [{ mes: 'Hoje', atual: overallScore, projetado: overallScore }]
      Object.entries(byMonth).sort().slice(0, 8).forEach(([key, gain]) => {
        const [year, month] = key.split('-')
        runningScore = Math.min(100, runningScore + gain)
        timelineData.push({ mes: `${month}/${year.slice(2)}`, atual: overallScore, projetado: Math.round(runningScore) })
      })

      return {
        cycle,
        topicScores,
        statusDist,
        overallScore,
        projectedScore,
        kpis: { total: totalReqs, approved, pending, notStarted },
        timelineData,
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

  // Segurança: data pode ser undefined na primeira renderização
  if (!data) return null

  const { cycle, topicScores, statusDist, overallScore, projectedScore, kpis, timelineData, actionKpis } = data
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
        <MetricCard value={`${overallScore}%`} label="Conformidade atual GISTM" color="#0A9396" sub="Baseado nas avaliações publicadas" />
        <MetricCard value={kpis.approved} label={`de ${kpis.total} requisitos aprovados`} color="#059669" sub={`${kpis.total > 0 ? Math.round((kpis.approved / kpis.total) * 100) : 0}% do total`} />
        <MetricCard value={kpis.pending} label="Aguardando avaliação HIDROBR" color="#D97706" sub={kpis.pending > 0 ? 'Ação necessária' : 'Nenhum pendente'} />
        <MetricCard value={kpis.notStarted} label="Requisitos não iniciados" color="#6B7280" sub={`de ${kpis.total} total`} />
      </div>

      {/* Gauges + progresso por tópico */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Aderência atual</div>
          <Gauge value={overallScore} label="conformidade" />
          <div className="text-xs text-gray-400 mt-2">Baseada nos requisitos avaliados</div>
        </div>

        <div className="card p-5 text-center" style={{ borderTop: '3px solid #059669' }}>
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Aderência projetada</div>
          <Gauge value={projectedScore} label="se plano concluído" color="#059669" />
          <div className="text-xs text-emerald-600 font-semibold mt-2">
            {gap > 0 ? `+${gap}% com conclusão do plano de ação` : 'Nenhum ganho estimado cadastrado'}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">{actionKpis.open} ações abertas · +{actionKpis.totalGain}% estimado</div>
        </div>

        <div className="card p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Progresso por tópico</div>
          <div className="space-y-2.5">
            {topicScores.map((t: any) => (
              <div key={t.name} className="flex items-center gap-2">
                <span className="text-[10px] font-bold w-6 flex-shrink-0" style={{ color: t.color }}>{t.name}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${t.completionPct}%`, background: t.color }} />
                </div>
                <span className="text-[10px] font-semibold w-8 text-right" style={{ color: t.color }}>{t.completionPct}%</span>
              </div>
            ))}
            {topicScores.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum dado de avaliação ainda</p>}
          </div>
        </div>
      </div>

      {/* Linha do tempo */}
      {timelineData.length > 1 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Projeção de aderência ao longo do tempo</h2>
              <p className="text-xs text-gray-400 mt-0.5">Baseado nos prazos e ganhos estimados das ações abertas</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-gray-300 inline-block border-dashed border-t" /> Atual</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-500 inline-block" /> Projetado</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip formatter={(v: number) => [`${v}%`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <ReferenceLine y={100} stroke="#E5E7EB" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="atual" stroke="#D1D5DB" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="Atual" />
              <Line type="monotone" dataKey="projetado" stroke="#059669" strokeWidth={2.5} dot={{ fill: '#059669', r: 4 }} name="Projetado" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Barras por tópico + Plano de ação */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card col-span-2 p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Pontuação média por tópico GISTM</h2>
          {topicScores.some((t: any) => t.avgScore > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topicScores} barSize={32} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [`${v} pts`, 'Pontuação']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                  {topicScores.map((t: any) => <Cell key={t.name} fill={t.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Nenhuma avaliação publicada ainda
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Plano de ação</h2>
          <div className="space-y-0">
            {[
              { label: 'Total de ações', value: actionKpis.total, color: '#0A9396' },
              { label: 'Ações abertas', value: actionKpis.open, color: '#D97706' },
              { label: 'Concluídas', value: actionKpis.completed, color: '#059669' },
              { label: 'Ganho total estimado', value: `+${actionKpis.totalGain}%`, color: '#059669' },
            ].map(k => (
              <div key={k.label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{k.label}</span>
                <span className="text-sm font-bold" style={{ color: k.color }}>{k.value}</span>
              </div>
            ))}
          </div>
          {gap > 0 && (
            <div className="mt-4 bg-emerald-50 rounded-xl p-3">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Se plano 100% concluído</div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600">{overallScore}% → {projectedScore}%</span>
                <span className="text-sm font-black text-emerald-700">+{gap}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status distribution */}
      {statusDist.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Distribuição de status dos requisitos</h2>
          <div className="grid grid-cols-5 gap-3">
            {statusDist.map((d: any) => (
              <div key={d.name} className="text-center p-3 rounded-xl" style={{ background: d.color + '18' }}>
                <div className="text-2xl font-black" style={{ color: d.color }}>{d.value}</div>
                <div className="text-[11px] text-gray-500 mt-1 leading-tight">{d.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
