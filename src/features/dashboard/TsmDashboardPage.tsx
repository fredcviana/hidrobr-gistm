// src/features/dashboard/TsmDashboardPage.tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, AlertCircle, Shield, AlertTriangle, Heart, Trash2, Leaf, Cloud, Droplet, Users, Circle, Layers } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { cycleFacilityIds, buildRequirementScoreMaps } from '@/lib/facilityScoring'

const TSM_STANDARD_ID = 2

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

function TsmTimelineChart({ timelineData }: { timelineData: any[] }) {
  if (timelineData.length < 2) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      Dados insuficientes para gerar linha do tempo
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={timelineData} margin={{ top: 10, right: 24, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip formatter={(v: any) => `${v}%`} />
        <Line type="monotone" dataKey="aderencia" stroke="#0A9396" strokeWidth={2.5} dot={{ fill: '#0A9396', r: 4, strokeWidth: 0 }} name="Aderência TSM" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function TsmDashboardPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const orgId = profile?.organization_id

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-tsm', orgId, hb],
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
        cycle: null, overallScore: 0,
        kpis: { total: 0, approved: 0, pending: 0, notStarted: 0 },
        topicProgressData: [], timelineData: [], facilityCount: 0,
      }

      const facilityIds = cycleFacilityIds(cycle)

      const { data: topics } = await supabase.from('standard_topics').select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')
      const { data: requirements } = await supabase.from('standard_requirements').select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')
      const reqIds = (requirements ?? []).map((r: any) => r.id)
      const { data: responses } = reqIds.length > 0 && facilityIds.length > 0
        ? await supabase.from('tsm_responses').select('*').eq('cycle_id', cycle.id).in('facility_id', facilityIds).in('requirement_id', reqIds)
        : { data: [] as any[] }
      const respIds = (responses ?? []).map((r: any) => r.id)
      const { data: assessments } = respIds.length > 0
        ? await supabase.from('tsm_assessments').select('*').in('response_id', respIds)
        : { data: [] as any[] }

      const assessMap = new Map((assessments ?? []).map((a: any) => [a.response_id, a]))
      const { clientScoreByRequirement } = buildRequirementScoreMaps(facilityIds, responses ?? [], assessMap)

      const totalReqs = (requirements ?? []).length * (facilityIds.length || 1)
      const approved = (responses ?? []).filter((r: any) => r.status === 'approved').length
      const pending = (responses ?? []).filter((r: any) => r.status === 'submitted').length
      const notStarted = totalReqs - (responses ?? []).length + (responses ?? []).filter((r: any) => r.status === 'not_started').length

      let weightedSum = 0, totalWeight = 0
      ;(requirements ?? []).forEach((req: any) => {
        const w = Number(req.weight) || 1
        totalWeight += w
        weightedSum += (clientScoreByRequirement.get(req.id) ?? 0) * w
      })
      const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

      const topicProgressData = (topics ?? []).map((topic: any) => {
        const tReqs = (requirements ?? []).filter((r: any) => r.topic_id === topic.id)
        const tReqIds = new Set(tReqs.map((r: any) => r.id))
        const tInstances = (responses ?? []).filter((r: any) => tReqIds.has(r.requirement_id))
        const tApproved = tInstances.filter((r: any) => r.status === 'approved').length
        let wSum = 0, wTotal = 0
        tReqs.forEach((req: any) => {
          const w = Number(req.weight) || 1
          wTotal += w
          wSum += (clientScoreByRequirement.get(req.id) ?? 0) * w
        })
        return {
          id: topic.id, code: topic.code, title: topic.title, icon: topic.icon,
          color: topic.color_hex ?? '#0A9396',
          score: wTotal > 0 ? Math.round(wSum / wTotal) : 0,
          approved: tApproved, total: tInstances.length,
        }
      })

      const dates = Array.from(new Set((assessments ?? []).filter((a: any) => a.published_at).map((a: any) => a.published_at.slice(0, 10)))).sort()
      const timelineData = dates.map((d: any) => {
        const assessUntilMap = new Map((assessments ?? []).filter((a: any) => a.published_at && a.published_at.slice(0, 10) <= d).map((a: any) => [a.response_id, a]))
        const { clientScoreByRequirement: scoreAtDate } = buildRequirementScoreMaps(facilityIds, responses ?? [], assessUntilMap)
        let wSum = 0
        ;(requirements ?? []).forEach((req: any) => {
          const w = Number(req.weight) || 1
          wSum += (scoreAtDate.get(req.id) ?? 0) * w
        })
        return { data: d, aderencia: totalWeight > 0 ? Math.round(wSum / totalWeight) : 0 }
      })
      timelineData.push({ data: 'Hoje', aderencia: overallScore })

      return {
        cycle, overallScore,
        kpis: { total: totalReqs, approved, pending, notStarted },
        topicProgressData, timelineData, facilityCount: facilityIds.length,
      }
    },
  })

  if (isLoading) return (
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
      <span className="text-sm">Carregando dashboard TSM...</span>
    </div>
  )

  const { cycle, overallScore, kpis, topicProgressData, timelineData, facilityCount } = data as any

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
          <h1 className="text-xl font-bold text-gray-900">Dashboard TSM</h1>
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

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total de requisitos', value: kpis.total, color: '#0A9396' },
          { label: 'Aprovados', value: kpis.approved, color: '#059669' },
          { label: 'Pend. avaliação', value: kpis.pending, color: '#D97706' },
          { label: 'Não iniciados', value: kpis.notStarted, color: '#9CA3AF' },
        ].map(k => (
          <MetricCard key={k.label} value={k.value} label={k.label} color={k.color} />
        ))}
      </div>

      {/* Gauge + Score por tópico */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col items-center justify-center">
          <Gauge value={overallScore} label="Aderência geral TSM" />
        </div>
        <div className="card p-5 col-span-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Score por tópico</div>
          <div className="space-y-2.5">
            {topicProgressData.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2.5">
                <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
                  <TopicIcon name={t.icon} color={t.color} />
                  <span className="text-[10px] font-bold" style={{ color: t.color }}>{t.code}</span>
                </div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${t.score}%`, background: t.color }} />
                </div>
                <span className="text-[10px] font-semibold w-8 text-right" style={{ color: t.score === 0 ? '#9CA3AF' : t.color }}>{t.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detalhe por tópico */}
      <div className="card p-5">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Detalhamento por tópico</div>
        <div className="grid grid-cols-2 gap-3">
          {topicProgressData.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100" style={{ background: (t.color ?? '#0A9396') + '0A' }}>
              <TopicIcon name={t.icon} color={t.color} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{t.title}</p>
                <p className="text-xs text-gray-400">{t.approved}/{t.total} aprovados</p>
              </div>
              <span className="text-sm font-bold" style={{ color: t.color }}>{t.score}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Linha do tempo */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Evolução da aderência TSM ao longo do tempo</h2>
        <TsmTimelineChart timelineData={timelineData} />
      </div>
    </div>
  )
}
