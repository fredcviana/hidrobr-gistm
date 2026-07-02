// src/features/dashboard/DashboardPage.tsx
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, PieChart, Pie } from 'recharts'
import { TrendingUp, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const TOPIC_COLORS: Record<string, string> = {
  T1:'#005F73',T2:'#0A9396',T3:'#1B7A8A',T4:'#2D6A4F',T5:'#92400E'
}
const STATUS_COLORS: Record<string,string> = {
  not_started:'#E5E7EB',in_progress:'#3B82F6',submitted:'#D97706',
  under_review:'#8B5CF6',approved:'#059669',needs_revision:'#DC2626',
}
const STATUS_LABELS: Record<string,string> = {
  not_started:'Não iniciado',in_progress:'Em andamento',submitted:'Ag. avaliação',
  under_review:'Em revisão',approved:'Aprovado',needs_revision:'Revisar',
}

function Gauge({ value }: { value: number }) {
  const r=38,cx=50,cy=50,sa=-Math.PI*.75,sw=Math.PI*1.5
  const fs=sw*(value/100),ea=sa+fs
  const x1=cx+r*Math.cos(sa),y1=cy+r*Math.sin(sa)
  const bx2=cx+r*Math.cos(sa+sw),by2=cy+r*Math.sin(sa+sw)
  const ex=cx+r*Math.cos(ea),ey=cy+r*Math.sin(ea)
  const lf=fs>Math.PI?1:0
  const col=value>=75?'#059669':value>=50?'#0A9396':value>=25?'#D97706':'#DC2626'
  return (
    <svg viewBox="0 0 100 82" className="w-32 h-28 mx-auto">
      <path d={`M${x1} ${y1} A ${r} ${r} 0 1 1 ${bx2} ${by2}`} fill="none" stroke="#F3F4F6" strokeWidth="8" strokeLinecap="round"/>
      {value>0&&<path d={`M${x1} ${y1} A ${r} ${r} 0 ${lf} 1 ${ex} ${ey}`} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round"/>}
      <text x="50" y="53" textAnchor="middle" fontSize="18" fontWeight="800" fill={col} fontFamily="Inter,sans-serif">{value}%</text>
      <text x="50" y="66" textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="Inter,sans-serif">conformidade</text>
    </svg>
  )
}

function MetricCard({ value, label, delta, deltaType, color, icon: Icon }: {
  value: string|number; label: string; delta?: string
  deltaType?: 'up'|'down'|'warn'; color: string; icon: React.ElementType
}) {
  const dc = deltaType==='up'?'text-emerald-600 bg-emerald-50':deltaType==='down'?'text-red-600 bg-red-50':'text-amber-600 bg-amber-50'
  return (
    <div className="card p-5" style={{borderTop:`3px solid ${color}`}}>
      <div className="text-3xl font-extrabold tracking-tight" style={{color}}>{value}</div>
      <div className="text-sm text-gray-500 mt-1.5">{label}</div>
      {delta&&<span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-2 ${dc}`}>{delta}</span>}
    </div>
  )
}

export function DashboardPage() {
  const { profile } = useAuthStore()
  const orgId = profile?.organization_id
  const hb = isHidrobr(profile?.role)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', orgId],
    enabled: !!orgId || hb,
    queryFn: async () => {
      // Busca ciclo ativo
      let cycleQuery = supabase.from('assessment_cycles').select('*').eq('status','active').order('created_at',{ascending:false}).limit(1)
      if (!hb && orgId) cycleQuery = cycleQuery.eq('organization_id', orgId)
      const { data: cycles } = await cycleQuery
      const cycle = cycles?.[0]
      if (!cycle) return { cycle: null, kpis: { total:18, approved:0, pending:0, notStarted:18, completionPct:0 }, topicScores:[], statusDist:[], overallScore:0 }

      // Busca respostas
      const { data: responses } = await supabase
        .from('requirement_responses')
        .select('*, gistm_requirements(topic_id,code,gistm_topics(code,color_hex,title)), hidrobr_assessments(score,score_value)')
        .eq('cycle_id', cycle.id)

      // Busca todos os princípios para contar os não iniciados
      const { data: allReqs } = await supabase.from('gistm_requirements').select('id,topic_id,code,gistm_topics(code,color_hex,title)')

      const scoreMap: Record<string,number> = { non_conforming:0, partially_conforming:50, conforming:75, fully_conforming:100 }
      const respMap = new Map((responses??[]).map((r:any)=>[r.requirement_id,r]))

      const approved = (responses??[]).filter((r:any)=>r.status==='approved').length
      const pending = (responses??[]).filter((r:any)=>['submitted','under_review'].includes(r.status)).length
      const notStarted = 18 - (responses??[]).length + (responses??[]).filter((r:any)=>r.status==='not_started').length

      // Status distribution
      const statusCount: Record<string,number> = { not_started:0,in_progress:0,submitted:0,under_review:0,approved:0,needs_revision:0 }
      ;(responses??[]).forEach((r:any) => { statusCount[r.status]=(statusCount[r.status]||0)+1 })
      statusCount.not_started += 18 - (responses??[]).length
      const statusDist = Object.entries(statusCount).filter(([,v])=>v>0).map(([k,v])=>({name:STATUS_LABELS[k],value:v,color:STATUS_COLORS[k]}))

      // Topic scores
      const topicMap: Record<string,{name:string,color:string,scores:number[],approved:number,total:number}> = {}
      ;(allReqs??[]).forEach((req:any) => {
        const tc = req.gistm_topics?.code
        if (!tc) return
        if (!topicMap[tc]) topicMap[tc] = { name:req.gistm_topics.code, color:req.gistm_topics.color_hex||'#0A9396', scores:[], approved:0, total:0 }
        topicMap[tc].total++
        const resp = respMap.get(req.id)
        if (resp?.hidrobr_assessments?.[0]?.score_value != null) topicMap[tc].scores.push(resp.hidrobr_assessments[0].score_value)
        if (resp?.status==='approved') topicMap[tc].approved++
      })
      const topicScores = Object.values(topicMap).map(t=>({
        name:t.name, color:t.color,
        avgScore: t.scores.length?Math.round(t.scores.reduce((a,b)=>a+b,0)/t.scores.length):0,
        completionPct: Math.round((t.approved/t.total)*100),
      }))

      // Overall score
      const allScores = (responses??[]).flatMap((r:any)=>r.hidrobr_assessments?.map((a:any)=>a.score_value)??[]).filter((v:any)=>v!=null)
      const overallScore = allScores.length?Math.round(allScores.reduce((a:number,b:number)=>a+b,0)/allScores.length):0

      return { cycle, kpis:{ total:18, approved, pending, notStarted, completionPct:Math.round((approved/18)*100) }, topicScores, statusDist, overallScore }
    }
  })

  if (isLoading) return (
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400"/>
      <span className="text-sm">Carregando dashboard...</span>
    </div>
  )

  const { kpis, topicScores, statusDist, cycle, overallScore } = data ?? { kpis:{total:18,approved:0,pending:0,notStarted:18,completionPct:0}, topicScores:[], statusDist:[], cycle:null, overallScore:0 }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cycle?.name ?? 'Nenhum ciclo ativo'} · {profile?.organization?.name}</p>
        </div>
        {cycle && <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block"/>Ciclo ativo</span>}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard value={`${overallScore}%`} label="Conformidade global GISTM" color="#0A9396" icon={TrendingUp} deltaType="up" delta="Baseado nas avaliações HIDROBR"/>
        <MetricCard value={kpis.approved} label={`de ${kpis.total} princípios aprovados`} color="#059669" icon={CheckCircle2} deltaType="up" delta={`${kpis.completionPct}% concluídos`}/>
        <MetricCard value={kpis.pending} label="Aguardando avaliação HIDROBR" color="#D97706" icon={Clock} deltaType={kpis.pending>0?'warn':'up'} delta={kpis.pending>0?'Ação necessária':'Nenhum pendente'}/>
        <MetricCard value={kpis.notStarted} label="Princípios não iniciados" color="#DC2626" icon={AlertCircle} deltaType={kpis.notStarted>0?'down':'up'} delta={kpis.notStarted>0?'Priorizar':'Todos iniciados'}/>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="card col-span-3">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">Pontuação por tópico GISTM</h2></div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topicScores} barSize={36}>
                <XAxis dataKey="name" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis domain={[0,100]} tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip formatter={(v:number)=>[`${v} pts`,'Pontuação']} contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #E5E7EB'}}/>
                <Bar dataKey="avgScore" radius={[6,6,0,0]}>
                  {topicScores.map((t:any)=><Cell key={t.name} fill={t.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card col-span-2">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">Progresso geral</h2></div>
          <div className="p-4">
            <Gauge value={overallScore}/>
            <div className="space-y-2 mt-3">
              {topicScores.map((t:any)=>(
                <div key={t.name} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-8" style={{color:t.color}}>{t.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${t.completionPct}%`,background:t.color}}/>
                  </div>
                  <span className="text-xs font-semibold w-8 text-right" style={{color:t.color}}>{t.completionPct}%</span>
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
                <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={2}>
                  {statusDist.map((d:any,i:number)=><Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8}}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-1.5">
              {statusDist.map((d:any)=>(
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2 h-2 rounded-full" style={{background:d.color}}/>{d.name}</span>
                  <span className="font-semibold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card col-span-2">
          <div className="p-4 pb-0"><h2 className="text-sm font-bold text-gray-900">KPIs do ciclo</h2></div>
          <div className="p-4 space-y-0">
            {[
              ['Princípios aprovados', `${kpis.approved} de ${kpis.total}`],
              ['Pendentes de avaliação HIDROBR', `${kpis.pending}`],
              ['Não iniciados', `${kpis.notStarted}`],
              ['Taxa de conclusão', `${kpis.completionPct}%`],
              ['Prazo do ciclo', cycle?.target_date ? new Date(cycle.target_date).toLocaleDateString('pt-BR') : 'Não definido'],
            ].map(([l,v])=>(
              <div key={l} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{l}</span>
                <span className="text-sm font-semibold text-gray-800">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
