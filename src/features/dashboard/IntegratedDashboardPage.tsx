// src/features/dashboard/IntegratedDashboardPage.tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, AlertCircle, Shield, AlertTriangle, Heart, Trash2, Leaf, Cloud, Droplet, Users, Circle, Layers, ClipboardList, Building2 } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { cycleFacilityIds, buildRequirementScoreMaps } from '@/lib/facilityScoring'

const TSM_STANDARD_ID = 2

const GISTM_TOPIC_COLORS: Record<string, string> = {
  T1: '#1B4F72', T2: '#117A65', T3: '#7D6608',
  T4: '#6E2F1A', T5: '#922B21', T6: '#1A5276',
}

const TOPIC_ICONS: Record<string, any> = {
  shield: Shield, 'alert-triangle': AlertTriangle, heart: Heart, trash: Trash2,
  leaf: Leaf, cloud: Cloud, droplet: Droplet, users: Users,
}

function TopicIcon({ name, color }: { name?: string; color?: string }) {
  const Comp = (name && TOPIC_ICONS[name]) || Circle
  return <Comp size={15} style={{ color: color ?? '#0A9396' }} />
}

function getBarColor(pct: number) {
  if (pct >= 75) return '#059669'
  if (pct >= 50) return '#2a78d6'
  if (pct >= 25) return '#D97706'
  if (pct > 0) return '#e34948'
  return '#D1D5DB'
}

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

function TopicBar({ code, label, score, color, icon }: { code: string; label: string; score: number; color: string; icon?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
        {icon !== undefined && <TopicIcon name={icon} color={color} />}
        <span className="text-[10px] font-bold" style={{ color }}>{code}</span>
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-semibold w-8 text-right" style={{ color: score === 0 ? '#9CA3AF' : color }}>{score}%</span>
    </div>
  )
}

export function IntegratedDashboardPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const orgId = profile?.organization_id

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-integrado', orgId, hb],
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

      if (!cycle) return {
        cycle: null,
        gistm: { score: 0, kpis: { total: 0, approved: 0 }, topics: [] },
        tsm: { score: 0, kpis: { total: 0, approved: 0 }, topics: [] },
        combinedScore: 0, facilityCount: 0,
      }

      const facilityIds = cycleFacilityIds(cycle)

      // ── GISTM ──────────────────────────────────────────
      const { data: gTopics } = await supabase.from('gistm_topics').select('*').order('display_order')
      const { data: gPrinciples } = await supabase.from('gistm_principles').select('*').order('display_order')
      const { data: gRequirements } = await supabase.from('gistm_requirements').select('*')
      const { data: gResponses } = facilityIds.length > 0
        ? await supabase.from('requirement_responses').select('*').eq('cycle_id', cycle.id).in('facility_id', facilityIds)
        : { data: [] as any[] }
      const gRespIds = (gResponses ?? []).map((r: any) => r.id)
      const { data: gAssessments } = gRespIds.length > 0
        ? await supabase.from('hidrobr_assessments').select('response_id, score, score_value, published_at').in('response_id', gRespIds)
        : { data: [] as any[] }

      const gAssessMap = new Map((gAssessments ?? []).map((a: any) => [a.response_id, a]))
      const { clientScoreByRequirement: gClientScore } = buildRequirementScoreMaps(facilityIds, gResponses ?? [], gAssessMap)

      let gWeightedSum = 0, gTotalWeight = 0
      ;(gRequirements ?? []).forEach((req: any) => {
        const w = Number(req.weight) || 1
        gTotalWeight += w
        gWeightedSum += (gClientScore.get(req.id) ?? 0) * w
      })
      const gScore = gTotalWeight > 0 ? Math.round(gWeightedSum / gTotalWeight) : 0
      const gApproved = (gResponses ?? []).filter((r: any) => r.status === 'approved').length

      const gTopicData = (gTopics ?? []).map((topic: any) => {
        const tPrinciples = (gPrinciples ?? []).filter((p: any) => p.topic_id === topic.id)
        const tReqs = (gRequirements ?? []).filter((r: any) => tPrinciples.some((p: any) => p.id === r.principle_id))
        let wSum = 0, wTotal = 0
        tReqs.forEach((req: any) => {
          const w = Number(req.weight) || 1
          wTotal += w
          wSum += (gClientScore.get(req.id) ?? 0) * w
        })
        return {
          code: topic.code, title: topic.title,
          color: GISTM_TOPIC_COLORS[topic.code] ?? '#0A9396',
          score: wTotal > 0 ? Math.round(wSum / wTotal) : 0,
        }
      })

      // ── TSM ────────────────────────────────────────────
      const { data: tTopics } = await supabase.from('standard_topics').select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')
      const { data: tRequirements } = await supabase.from('standard_requirements').select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')
      const tReqIds = (tRequirements ?? []).map((r: any) => r.id)
      const { data: tResponses } = tReqIds.length > 0 && facilityIds.length > 0
        ? await supabase.from('tsm_responses').select('*').eq('cycle_id', cycle.id).in('facility_id', facilityIds).in('requirement_id', tReqIds)
        : { data: [] as any[] }
      const tRespIds = (tResponses ?? []).map((r: any) => r.id)
      const { data: tAssessments } = tRespIds.length > 0
        ? await supabase.from('tsm_assessments').select('*').in('response_id', tRespIds)
        : { data: [] as any[] }

      const tAssessMap = new Map((tAssessments ?? []).map((a: any) => [a.response_id, a]))
      const { clientScoreByRequirement: tClientScore } = buildRequirementScoreMaps(facilityIds, tResponses ?? [], tAssessMap)

      let tWeightedSum = 0, tTotalWeight = 0
      ;(tRequirements ?? []).forEach((req: any) => {
        const w = Number(req.weight) || 1
        tTotalWeight += w
        tWeightedSum += (tClientScore.get(req.id) ?? 0) * w
      })
      const tScore = tTotalWeight > 0 ? Math.round(tWeightedSum / tTotalWeight) : 0
      const tApproved = (tResponses ?? []).filter((r: any) => r.status === 'approved').length

      const tTopicData = (tTopics ?? []).map((topic: any) => {
        const tReqs = (tRequirements ?? []).filter((r: any) => r.topic_id === topic.id)
        let wSum = 0, wTotal = 0
        tReqs.forEach((req: any) => {
          const w = Number(req.weight) || 1
          wTotal += w
          wSum += (tClientScore.get(req.id) ?? 0) * w
        })
        return {
          code: topic.code, title: topic.title, icon: topic.icon,
          color: topic.color_hex ?? '#0A9396',
          score: wTotal > 0 ? Math.round(wSum / wTotal) : 0,
        }
      })

      const combinedScore = Math.round((gScore + tScore) / 2)

      // ── Ações do Plano de Ação por estrutura ────────────
      // Cruza cada ação (facility_ids) com as barragens em escopo do ciclo, para
      // mostrar a execução operacional do plano ao lado do score de aderência.
      // Uma ação que cobre mais de uma barragem é contada em cada uma delas
      // (ela de fato afeta as duas); por isso o "ganho pendente" por estrutura
      // pode somar mais que o ganho pendente total quando há ações compartilhadas.
      const { data: facilitiesData } = facilityIds.length > 0
        ? await supabase.from('tailings_facilities').select('id, name').in('id', facilityIds)
        : { data: [] as any[] }
      const { data: actions } = await supabase.from('action_items')
        .select('id, facility_ids, status, due_date, estimated_gain')
        .eq('organization_id', cycle.organization_id)

      const today = new Date()
      const isPending = (a: any) => !['completed', 'cancelled'].includes(a.status)
      const isOverdue = (a: any) => isPending(a) && a.due_date && new Date(a.due_date) < today

      const actionsByFacility = (facilitiesData ?? []).map((f: any) => {
        const facActions = (actions ?? []).filter((a: any) => (a.facility_ids ?? []).includes(f.id))
        return {
          facilityId: f.id,
          facilityName: f.name,
          open: facActions.filter((a: any) => a.status === 'open').length,
          inProgress: facActions.filter((a: any) => a.status === 'in_progress').length,
          overdue: facActions.filter(isOverdue).length,
          pendingGain: facActions.filter(isPending).reduce((s: number, a: any) => s + (Number(a.estimated_gain) || 0), 0),
          total: facActions.length,
        }
      })
      const actionsNoFacility = (actions ?? []).filter((a: any) => (a.facility_ids ?? []).length === 0).length

      return {
        cycle,
        gistm: { score: gScore, kpis: { total: (gRequirements ?? []).length * (facilityIds.length || 1), approved: gApproved }, topics: gTopicData },
        tsm: { score: tScore, kpis: { total: (tRequirements ?? []).length * (facilityIds.length || 1), approved: tApproved }, topics: tTopicData },
        combinedScore, facilityCount: facilityIds.length,
        actionsByFacility, actionsNoFacility,
      }
    },
  })

  if (isLoading) return (
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
      <span className="text-sm">Carregando dashboard integrado...</span>
    </div>
  )

  const { cycle, gistm, tsm, combinedScore, facilityCount, actionsByFacility, actionsNoFacility } = data as any

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
          <h1 className="text-xl font-bold text-gray-900">Dashboard Integrado</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {cycle.name} · {cycle.organizations?.name}
            {facilityCount > 1 && <span className="text-gray-400"> · resultado consolidado de {facilityCount} barragens</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {facilityCount > 1 && (
            <Link to="/dashboard-barragens" className="badge bg-brand-50 text-brand-700 border border-brand-200 inline-flex items-center gap-1.5 hover:bg-brand-100 transition-colors">
              <Layers className="w-3 h-3" /> Comparar barragens
            </Link>
          )}
          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />Ciclo ativo
          </span>
        </div>
      </div>

      {/* Gauges comparativos */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col items-center justify-center">
          <Gauge value={gistm.score} label="Aderência GISTM" color="#0A9396" />
        </div>
        <div className="card p-5 flex flex-col items-center justify-center">
          <Gauge value={tsm.score} label="Aderência TSM" color="#7D6608" />
        </div>
        <div className="card p-5 flex flex-col items-center justify-center">
          <Gauge value={combinedScore} label="Score combinado (média)" color="#1A5276" />
        </div>
      </div>

      {/* KPIs lado a lado */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard value={gistm.kpis.total} label="Requisitos GISTM" color="#0A9396" />
        <MetricCard value={gistm.kpis.approved} label="Aprovados GISTM" color="#059669" />
        <MetricCard value={tsm.kpis.total} label="Requisitos TSM" color="#7D6608" />
        <MetricCard value={tsm.kpis.approved} label="Aprovados TSM" color="#059669" />
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        O score combinado é calculado como a média simples entre a aderência GISTM e a aderência TSM.
      </p>

      {/* Comparativo por tópico */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Score por tópico — GISTM</div>
          <div className="space-y-2.5">
            {gistm.topics.map((t: any) => (
              <TopicBar key={t.code} code={t.code} label={t.title} score={t.score} color={t.color} />
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Score por tópico — TSM</div>
          <div className="space-y-2.5">
            {tsm.topics.map((t: any) => (
              <TopicBar key={t.code} code={t.code} label={t.title} score={t.score} color={t.color} icon={t.icon} />
            ))}
          </div>
        </div>
      </div>

      {/* Ações do Plano de Ação por estrutura */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-600" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ações do plano por estrutura</span>
          </div>
          <Link to="/action-plan" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            Ver plano de ação completo →
          </Link>
        </div>

        {(actionsByFacility ?? []).length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nenhuma barragem em escopo neste ciclo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left py-2 font-bold">Estrutura</th>
                  <th className="text-center py-2 font-bold w-24">Abertas</th>
                  <th className="text-center py-2 font-bold w-28">Em andamento</th>
                  <th className="text-center py-2 font-bold w-24">Atrasadas</th>
                  <th className="text-right py-2 font-bold w-36">Ganho pendente</th>
                </tr>
              </thead>
              <tbody>
                {actionsByFacility.map((f: any) => (
                  <tr key={f.facilityId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 font-semibold text-gray-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-300" /> {f.facilityName}
                    </td>
                    <td className="text-center py-2.5">
                      <span className={`badge text-[10px] ${f.open > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>{f.open}</span>
                    </td>
                    <td className="text-center py-2.5">
                      <span className={`badge text-[10px] ${f.inProgress > 0 ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-400'}`}>{f.inProgress}</span>
                    </td>
                    <td className="text-center py-2.5">
                      <span className={`badge text-[10px] ${f.overdue > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'}`}>{f.overdue}</span>
                    </td>
                    <td className="text-right py-2.5 font-semibold">
                      {f.pendingGain > 0 ? <span className="text-emerald-600">+{f.pendingGain.toFixed(1)}%</span> : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-gray-400 mt-3">
          Ações que cobrem mais de uma estrutura são contadas em cada uma delas — o ganho pendente por estrutura pode
          somar mais que o total geral quando há ações compartilhadas.
          {(actionsNoFacility ?? 0) > 0 && ` ${actionsNoFacility} ação(ões) sem estrutura vinculada não aparecem nesta tabela.`}
        </p>
      </div>
    </div>
  )
}
