// src/features/assessment/PublicAssessmentPage.tsx
// Formulário público — carrega configuração do banco (editável pelo admin)
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft, CheckCircle2, Loader2, Download, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const TOPIC_META: Record<string, { title: string; color: string; icon: string }> = {
  T1: { title: 'Comunidades Afetadas',              color: '#1B4F72', icon: '👥' },
  T2: { title: 'Base de Conhecimentos',             color: '#117A65', icon: '📚' },
  T3: { title: 'Projeto, Construção e Operação',    color: '#7D6608', icon: '🏗️' },
  T4: { title: 'Gestão e Governança',               color: '#6E2F1A', icon: '🏛️' },
  T5: { title: 'Resposta a Emergências',            color: '#922B21', icon: '🚨' },
  T6: { title: 'Divulgação Pública',                color: '#1A5276', icon: '📢' },
}

const SEGMENTS = ['Minério de Ferro','Bauxita','Fosfato','Níquel','Cobre','Ouro','Carvão','Potássio','Outro']
const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function ScaleButton({ opt, selected, onClick }: { opt: any; selected: boolean; onClick: () => void }) {
  const colors: Record<number,{color:string;bg:string}> = {
    0:   { color: '#DC2626', bg: '#FEF2F2' },
    50:  { color: '#D97706', bg: '#FFFBEB' },
    75:  { color: '#2563EB', bg: '#EFF6FF' },
    100: { color: '#059669', bg: '#D1FAE5' },
  }
  const c = colors[opt.value] ?? colors[0]
  return (
    <button onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${selected ? 'border-current scale-[1.01]' : 'border-transparent hover:opacity-90'}`}
      style={{ color: c.color, background: c.bg }}>
      <div className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-current bg-current' : 'border-current/40'}`}>
          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">{opt.label}</div>
          <div className="text-xs mt-0.5 opacity-70">{opt.sublabel}</div>
        </div>
        {selected && <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" />}
      </div>
    </button>
  )
}

function Gauge({ value, size = 'lg' }: { value: number; size?: 'sm' | 'lg' }) {
  const r = size === 'lg' ? 52 : 32
  const cx = size === 'lg' ? 70 : 44
  const cy = size === 'lg' ? 72 : 48
  const sw = size === 'lg' ? 12 : 8
  const sa = -Math.PI * 0.75, sw2 = Math.PI * 1.5
  const v = Math.min(Math.max(value, 0), 100)
  const fs = sw2 * (v / 100)
  const ea = sa + fs
  const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa)
  const bx2 = cx + r * Math.cos(sa + sw2), by2 = cy + r * Math.sin(sa + sw2)
  const ex = cx + r * Math.cos(ea), ey = cy + r * Math.sin(ea)
  const lf = fs > Math.PI ? 1 : 0
  const col = v >= 75 ? '#059669' : v >= 50 ? '#2563EB' : v >= 25 ? '#D97706' : '#DC2626'
  const vb = size === 'lg' ? '0 0 140 120' : '0 0 88 80'
  return (
    <svg viewBox={vb} className={size === 'lg' ? 'w-36 h-28' : 'w-20 h-16'}>
      <path d={`M${x1} ${y1} A ${r} ${r} 0 1 1 ${bx2} ${by2}`} fill="none" stroke="#F3F4F6" strokeWidth={sw} strokeLinecap="round" />
      {v > 0 && <path d={`M${x1} ${y1} A ${r} ${r} 0 ${lf} 1 ${ex} ${ey}`} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" />}
      <text x={cx} y={size === 'lg' ? 76 : 52} textAnchor="middle" fontSize={size === 'lg' ? 28 : 16} fontWeight="800" fill={col} fontFamily="Inter,sans-serif">{v}%</text>
    </svg>
  )
}

export function PublicAssessmentPage() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [lead, setLead] = useState({
    company_name: '', contact_name: '', contact_email: '',
    contact_phone: '', contact_role: '', segment: '', dam_name: '', dam_count: '1', state: '',
  })
  const [answers, setAnswers] = useState<Record<string, number>>({})

  // Carrega configuração do banco
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['assessment-form-config'],
    queryFn: async () => {
      const { data: cfg } = await supabase.from('assessment_form_config').select('*').eq('id', 1).single()
      const { data: principles } = await supabase.from('assessment_form_principles')
        .select('*').eq('is_active', true).order('display_order')
      return { cfg, principles: principles ?? [] }
    },
  })

  if (loadingConfig) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#0A9396]" />
    </div>
  )

  const cfg = config?.cfg
  const allPrinciples = config?.principles ?? []
  const scaleLabels: any[] = cfg?.scale_labels ?? [
    { value: 0,   label: 'Não implementamos',          sublabel: 'Não temos este processo ou documento' },
    { value: 50,  label: 'Implementamos parcialmente', sublabel: 'Existe, mas não está formalizado' },
    { value: 75,  label: 'Implementamos formalmente',  sublabel: 'Processo documentado e aplicado' },
    { value: 100, label: 'Implementamos e auditamos',  sublabel: 'Auditado e continuamente melhorado' },
  ]
  const contactEmail = cfg?.contact_email ?? 'comercial@hidrobr.com'

  // Agrupa princípios ativos por tópico
  const topicCodes = [...new Set(allPrinciples.map((p: any) => p.topic_code))]
  const topics = topicCodes.map(tc => ({
    code: tc,
    ...TOPIC_META[tc],
    principles: allPrinciples.filter((p: any) => p.topic_code === tc),
  }))

  const totalSteps = 1 + topics.length
  const isDataStep = step === 0
  const isResultStep = step === totalSteps
  const currentTopic = !isDataStep && !isResultStep ? topics[step - 1] : null

  function calcScore() {
    if (allPrinciples.length === 0) return 0
    const sum = allPrinciples.reduce((s: number, p: any) => s + (answers[p.principle_code] ?? 0), 0)
    return Math.round(sum / allPrinciples.length)
  }
  function calcTopicScore(tc: string) {
    const tPrinciples = allPrinciples.filter((p: any) => p.topic_code === tc)
    if (!tPrinciples.length) return 0
    const sum = tPrinciples.reduce((s: number, p: any) => s + (answers[p.principle_code] ?? 0), 0)
    return Math.round(sum / tPrinciples.length)
  }

  function canAdvance() {
    if (isDataStep) return !!(lead.company_name && lead.contact_name && lead.contact_email.includes('@') && lead.dam_name)
    if (currentTopic) return currentTopic.principles.every((p: any) => answers[p.principle_code] != null)
    return true
  }

  async function handleSubmit() {
    setSubmitting(true); setError('')
    try {
      const overall = calcScore()
      const scoresByTopic: Record<string, number> = {}
      topics.forEach(t => { scoresByTopic[t.code] = calcTopicScore(t.code) })
      const { error: dbErr } = await supabase.from('public_assessments').insert({
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        contact_email: lead.contact_email,
        contact_phone: lead.contact_phone || null,
        contact_role: lead.contact_role || null,
        segment: lead.segment || null,
        dam_name: lead.dam_name,
        dam_count: parseInt(lead.dam_count) || 1,
        state: lead.state || null,
        answers,
        overall_score: overall,
        scores_by_topic: scoresByTopic,
        status: 'new',
      })
      if (dbErr) throw dbErr
      setStep(totalSteps)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const score = calcScore()
  const scoreColor = score >= 75 ? '#059669' : score >= 50 ? '#2563EB' : score >= 25 ? '#D97706' : '#DC2626'
  const scoreLabel = score >= 75 ? 'Avançado' : score >= 50 ? 'Em desenvolvimento' : score >= 25 ? 'Inicial' : 'Incipiente'
  const criticalTopics = topics
    .map(t => ({ ...t, score: calcTopicScore(t.code) }))
    .filter(t => t.principles.every((p: any) => answers[p.principle_code] != null))
    .sort((a, b) => a.score - b.score).slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#002B3D] text-white py-4 px-6 flex items-center gap-3 print:hidden">
        <img src="/logo.png" alt="HIDROBR" className="h-8 w-auto flex-shrink-0" />
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest">Self Assessment GISTM</div>
        </div>
        <div className="ml-auto text-xs text-white/40">Padrão Global da Indústria para a Gestão de Rejeitos · UNEP/ICMM/PRI</div>
      </div>

      {!isResultStep && (
        <div className="h-1 bg-gray-200 print:hidden">
          <div className="h-full bg-[#0A9396] transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ETAPA 0 — Dados */}
        {isDataStep && (
          <div>
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <img src="/logo.png" alt="HIDROBR" className="h-16 w-auto" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{cfg?.form_title ?? 'Avalie sua conformidade ao GISTM'}</h1>
              <p className="text-gray-500 text-sm max-w-md mx-auto">{cfg?.form_subtitle}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Razão social da empresa *</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="Ex: Mineração Norte S.A." value={lead.company_name} onChange={e => setLead({...lead,company_name:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome *</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="Nome completo" value={lead.contact_name} onChange={e => setLead({...lead,contact_name:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="Ex: Gerente de Segurança" value={lead.contact_role} onChange={e => setLead({...lead,contact_role:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail corporativo *</label>
                  <input type="email" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="seu@empresa.com.br" value={lead.contact_email} onChange={e => setLead({...lead,contact_email:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="+55 31 99999-0000" value={lead.contact_phone} onChange={e => setLead({...lead,contact_phone:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da barragem principal *</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="Ex: Barragem Norte BN-01" value={lead.dam_name} onChange={e => setLead({...lead,dam_name:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Segmento mineral</label>
                  <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    value={lead.segment} onChange={e => setLead({...lead,segment:e.target.value})}>
                    <option value="">Selecione...</option>
                    {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nº de barragens</label>
                  <input type="number" min="1" max="50" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    value={lead.dam_count} onChange={e => setLead({...lead,dam_count:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado (UF)</label>
                  <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    value={lead.state} onChange={e => setLead({...lead,state:e.target.value})}>
                    <option value="">Selecione...</option>
                    {STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <strong>Privacidade:</strong> {cfg?.privacy_text ?? 'Seus dados serão usados exclusivamente pela HIDROBR.'}
              </div>
            </div>
          </div>
        )}

        {/* ETAPAS por tópico */}
        {currentTopic && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: currentTopic.color + '20' }}>{currentTopic.icon}</div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: currentTopic.color }}>
                  Tópico {step} de {topics.length}
                </div>
                <h2 className="text-lg font-bold text-gray-900">{currentTopic.title}</h2>
              </div>
            </div>
            <div className="space-y-6">
              {currentTopic.principles.map((principle: any) => (
                <div key={principle.principle_code} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: currentTopic.color + '15', color: currentTopic.color }}>
                      {principle.principle_code.replace('P','')}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 mb-1">{principle.question}</div>
                      <p className="text-xs text-gray-500 leading-relaxed">{principle.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {scaleLabels.map((opt: any) => (
                      <ScaleButton key={opt.value} opt={opt}
                        selected={answers[principle.principle_code] === opt.value}
                        onClick={() => setAnswers({...answers, [principle.principle_code]: opt.value})} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESULTADO */}
        {isResultStep && (
          <div id="resultado-print">
            <div className="bg-[#002B3D] rounded-2xl p-6 text-white mb-6 text-center">
              <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Diagnóstico GISTM</div>
              <div className="text-xl font-bold mb-0.5">{lead.company_name}</div>
              <div className="text-sm text-white/60">{lead.dam_name} · {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 text-center">
              <div className="text-sm text-gray-500 mb-2">Nível de conformidade estimado</div>
              <Gauge value={score} size="lg" />
              <div className="text-lg font-bold mt-1" style={{ color: scoreColor }}>{scoreLabel}</div>
              <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">
                Score baseado em {Object.keys(answers).length} princípios avaliados de {allPrinciples.length} totais
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Resultado por tópico</h3>
              <div className="space-y-3">
                {topics.map(t => {
                  const s = calcTopicScore(t.code)
                  const col = s >= 75 ? '#059669' : s >= 50 ? '#2563EB' : s >= 25 ? '#D97706' : '#DC2626'
                  return (
                    <div key={t.code} className="flex items-center gap-3">
                      <span className="text-base w-6 flex-shrink-0">{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 mb-1 truncate">{t.title}</div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s}%`, background: col }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold w-10 text-right" style={{ color: col }}>{s}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
            {criticalTopics.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
                <h3 className="text-sm font-bold text-amber-900 mb-3">⚠️ Atenção prioritária</h3>
                <div className="space-y-2">
                  {criticalTopics.map(t => (
                    <div key={t.code} className="flex items-center gap-3">
                      <span className="text-base">{t.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-amber-900">{t.title}</div>
                        <div className="text-xs text-amber-700">
                          {t.score === 0 ? 'Nenhum requisito atendido — ação urgente necessária'
                           : t.score < 50 ? 'Conformidade baixa — requer plano de ação estruturado'
                           : 'Em desenvolvimento — oportunidade de melhoria'}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-amber-700">{t.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-[#002B3D] rounded-2xl p-6 text-white text-center mb-4 print:hidden">
              <div className="text-lg font-bold mb-2">Evolua para conformidade total</div>
              <p className="text-sm text-white/70 mb-4 max-w-sm mx-auto">
                A HIDROBR pode ajudar sua organização a implementar o GISTM de forma estruturada, com avaliações detalhadas e planos de ação personalizados.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <a href={`mailto:${contactEmail}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A9396] rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                  {cfg?.cta_text ?? 'Falar com um consultor'}
                </a>
                <button onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm font-semibold text-white hover:bg-white/20 transition-colors">
                  <Download className="w-4 h-4" /> Baixar relatório
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400">
              Diagnóstico enviado para {lead.contact_email} · HIDROBR · {new Date().getFullYear()}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {/* Navegação */}
        {!isResultStep && (
          <div className="flex items-center justify-between mt-8 print:hidden">
            <button onClick={() => setStep(s => s-1)} disabled={step === 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${step===0?'opacity-0 pointer-events-none':'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({length: totalSteps+1}).map((_,i) => (
                <div key={i} className={`rounded-full transition-all ${i===step?'w-6 h-2 bg-[#0A9396]':i<step?'w-2 h-2 bg-[#0A9396]/40':'w-2 h-2 bg-gray-200'}`} />
              ))}
            </div>
            {step < totalSteps - 1 ? (
              <button onClick={() => setStep(s => s+1)} disabled={!canAdvance()}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${canAdvance()?'bg-[#002B3D] text-white hover:opacity-90':'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!canAdvance()||submitting}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${canAdvance()&&!submitting?'bg-[#059669] text-white hover:opacity-90':'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                {submitting?<><Loader2 className="w-4 h-4 animate-spin"/>Enviando...</>:<><CheckCircle2 className="w-4 h-4"/>Ver resultado</>}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`@media print { body { background: white; } }`}</style>
    </div>
  )
}
