// apps/web/src/features/dashboard/DashboardPage.tsx
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts'
import { TrendingUp, Clock, AlertCircle, CheckCircle2, FileText, Users, Loader2 } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { dashboardApi } from '@/services/api'

function ScoreGauge({ value }: { value: number }) {
  const r = 38, cx = 50, cy = 50
  const startAngle = -Math.PI * 0.75
  const sweep = Math.PI * 1.5
  const filled = sweep * (value / 100)
  const endAngle = startAngle + filled
  const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(startAngle + sweep), y2 = cy + r * Math.sin(startAngle + sweep)
  const ex = cx + r * Math.cos(endAngle), ey = cy + r * Math.sin(endAngle)
  const lf = filled > Math.PI ? 1 : 0
  const color = value >= 75 ? '#059669' : value >= 50 ? '#0A9396' : value >= 25 ? '#D97706' : '#DC2626'
  return (
    <svg viewBox="0 0 100 82" className="w-32 h-28 mx-auto">
      <path d={`M${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`} fill="none" stroke="#F3F4F6" strokeWidth="8" strokeLinecap="round" />
      {value > 0 && <path d={`M${x1} ${y1} A ${r} ${r} 0 ${lf} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />}
      <text x="50" y="53" textAnchor="middle" fontSize="18" fontWeight="800" fill={color} fontFamily="Inter,sans-serif">{value}%</text>
      <text x="50" y="66" textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="Inter,sans-serif">conformidade</text>
    </svg>
  )
}

function MetricCard({ value, label, delta, deltaType, color, icon: Icon }: {
  value: string | number; label: string; delta?: string
  deltaType?: 'up' | 'down' | 'warn'; color: string; icon: React.ElementType
}) {
  const dc = deltaType === 'up' ? 'text-emerald-600 bg-emerald-50' : deltaType === 'down' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'
  return (
    <div className="card p-5 relative overflow-hidden" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-3xl font-extrabold tracking-tight" style={{ color }}>{value}</div>
      <div className="text-sm text-gray-500 mt-1.5">{label}</div>
      {delta && <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-2 ${dc}`}>{delta}</span>}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  not_started: '#E5E7EB', in_progress: '#3B82F6', submitted: '#D97706',
  under_review: '#8B5CF6', approved: '#059669', needs_revision: '#DC2626',
}
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado', in_progress: 'Em andamento', submitted: 'Ag. avaliação',
  under_review: 'Em revisão', approved: 'Aprovado', needs_revision: 'Revisar',
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
        <span className="text-sm text-gray-500">Carregando dashboard...</span>
      </div>
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i=><Skeleton key={i} className="h-28"/>)}</div>
      <div className="grid grid-cols-5 gap-4">
        <Skeleton className="col-span-3 h-72" /><Skeleton className="col-span-2 h-72" />
      </div>
    </div>
  )
}

function PortfolioDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['portfolio'], queryFn: dashboardApi.getPortfolio })
  if (isLoading) return <DashboardSkeleton />
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Portfólio de Clientes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão consolidada de todos os clientes HIDROBR</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard value={data?.length ?? 0} label="Clientes ativos" color="#0A9396" icon={Users} />
        <MetricCard value={`${Math.round((data?.reduce((s:number,o:any)=>s+(Number(o.overallScore)||0),0)??0)/Math.max(data?.length??1,1))}%`} label="Conformidade média" color="#059669" icon={TrendingUp} />
        <MetricCard value={data?.reduce((s:number,o:any)=>s+o.facilityCount,0)??0} label="Barragens gerenciadas" color="#005F73" icon={FileText} />
      </div>
      <div className="card">
        <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">Conformidade por cliente</h2></div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data??[]} barSize={40}>
              <XAxis dataKey="name" tick={{fontSize:10}} tickFormatter={(v:string)=>v.split(' ')[0]} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip formatter={(v:number)=>[`${v}%`,'Conformidade']} contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #E5E7EB'}}/>
              <Bar dataKey="overallScore" radius={[6,6,0,0]} fill="#0A9396"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card divide-y divide-gray-50">
        {data?.map((org:any)=>(
          <div key={org.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white bg-brand-400 flex-shrink-0">{org.name.slice(0,2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{org.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{org.segment} · {org.facilityCount} barragem{org.facilityCount!==1?'s':''}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-brand-400">{org.overallScore??0}%</div>
              <div className="text-xs text-gray-400">conformidade</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const orgId = user?.organizationId
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', orgId],
    queryFn: () => dashboardApi.getOrg(orgId!),
    enabled: !!orgId,
  })
  if (!orgId && isHidrobr(user?.role)) return <PortfolioDashboard />
  if (isLoading) return <DashboardSkeleton />
  if (error || !data) return (
    <div className="p-6"><div className="card p-8 text-center">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3"/>
      <p className="text-gray-600">Erro ao carregar o dashboard.</p>
    </div></div>
  )
  const { kpis, topicScores, statusDistribution, cycle, overallScore } = data
  const pieData = Object.entries(statusDistribution as Record<string,number>)
    .filter(([,v])=>v>0).map(([k,v])=>({name:STATUS_LABELS[k]??k,value:v,color:STATUS_COLORS[k]}))
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cycle?.name??'Nenhum ciclo ativo'} · {user?.organization?.name}</p>
        </div>
        {cycle && <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"/>Ciclo ativo</span>}
      </div>
      <div className="grid grid-cols-4 gap-4">
        <MetricCard value={`${overallScore??0}%`} label="Conformidade global GISTM" delta="↑ +12% vs ciclo anterior" deltaType="up" color="#0A9396" icon={TrendingUp}/>
        <MetricCard value={kpis.approved} label={`de ${kpis.totalRequirements} princípios aprovados`} delta={`${kpis.completionPct}% concluídos`} deltaType="up" color="#059669" icon={CheckCircle2}/>
        <MetricCard value={kpis.pending} label="Aguardando avaliação HIDROBR" delta={kpis.pending>0?'Ação necessária':'Nenhum pendente'} deltaType={kpis.pending>0?'warn':'up'} color="#D97706" icon={Clock}/>
        <MetricCard value={kpis.notStarted} label="Princípios não iniciados" delta={kpis.notStarted>0?'Priorizar preenchimento':'Todos iniciados'} deltaType={kpis.notStarted>0?'down':'up'} color="#DC2626" icon={AlertCircle}/>
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="card col-span-3">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">Pontuação por tópico GISTM</h2></div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topicScores} barSize={32}>
                <XAxis dataKey="code" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v:number)=>[`${v} pts`,'Pontuação']} contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #E5E7EB'}}/>
                <Bar dataKey="avgScore" radius={[6,6,0,0]}>
                  {topicScores?.map((t:any)=><Cell key={t.code} fill={t.colorHex??'#0A9396'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3">
              {topicScores?.map((t:any)=>(
                <span key={t.code} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{background:t.colorHex}}/>
                  {t.code} <strong style={{color:t.colorHex}}>{t.avgScore??0}pts</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="card col-span-2">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">Progresso geral</h2></div>
          <div className="p-4">
            <ScoreGauge value={overallScore??0}/>
            <div className="space-y-2 mt-3">
              {topicScores?.map((t:any)=>(
                <div key={t.code} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-8" style={{color:t.colorHex}}>{t.code}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${t.completionPct??0}%`,background:t.colorHex}}/>
                  </div>
                  <span className="text-xs font-semibold w-8 text-right" style={{color:t.colorHex}}>{t.completionPct??0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">Status dos princípios</h2></div>
          <div className="p-4 flex flex-col items-center gap-3">
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={2}>
                  {pieData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-1.5">
              {pieData.map(d=>(
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2 h-2 rounded-full" style={{background:d.color}}/>{d.name}</span>
                  <span className="font-semibold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">KPIs do ciclo</h2></div>
          <div className="p-4">
            {[
              ['Evidências enviadas',`${kpis.evidenceCount??0} docs`],
              ['Princípios aprovados',`${kpis.approved} / ${kpis.totalRequirements}`],
              ['Pendentes de avaliação',`${kpis.pending}`],
              ['Taxa de conclusão',`${kpis.completionPct??0}%`],
              ['Prazo do ciclo',cycle?.targetDate?new Date(cycle.targetDate).toLocaleDateString('pt-BR'):'—'],
            ].map(([l,v])=>(
              <div key={l} className="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{l}</span>
                <span className="text-xs font-semibold text-gray-800">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">Ações recomendadas</h2></div>
          <div className="p-4 space-y-2">
            {[
              {icon:'📋',title:'Completar princípios',desc:`${kpis.notStarted} não iniciados`,href:'/requirements'},
              {icon:'📎',title:'Enviar evidências',desc:'Documentos comprobatórios',href:'/evidences'},
              {icon:'🎓',title:'Acessar Academy',desc:'Trilhas disponíveis',href:'/academy'},
            ].map(a=>(
              <a key={a.title} href={a.href} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all no-underline">
                <span className="text-xl flex-shrink-0">{a.icon}</span>
                <div>
                  <div className="text-xs font-semibold text-gray-800">{a.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{a.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
