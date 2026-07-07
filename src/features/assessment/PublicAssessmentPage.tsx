// src/features/assessment/PublicAssessmentPage.tsx
// Formulário público de Self Assessment GISTM — sem autenticação
import { useState } from 'react'
import { Shield, ChevronRight, ChevronLeft, CheckCircle2, Loader2, Download, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Dados dos princípios para o formulário público ─────────────
const TOPICS = [
  {
    code: 'T1', title: 'Comunidades Afetadas', color: '#1B4F72', icon: '👥',
    principles: [
      { code: 'P01', number: 1, question: 'Engajamento comunitário e direitos humanos', description: 'Sua organização respeita os direitos humanos das comunidades afetadas, realiza due diligence e mantém mecanismos de queixas extrajudiciais?' },
    ],
  },
  {
    code: 'T2', title: 'Base de Conhecimentos', color: '#117A65', icon: '📚',
    principles: [
      { code: 'P02', number: 2, question: 'Caracterização técnica e ambiental', description: 'Existe uma base de conhecimentos atualizada sobre o contexto social, ambiental, geológico, hidrológico e sismológico da(s) barragem(ns)?' },
      { code: 'P03', number: 3, question: 'Uso do conhecimento em decisões', description: 'Os conhecimentos sobre mudanças climáticas, impactos ambientais e sociais são sistematicamente usados para apoiar decisões ao longo do ciclo de vida?' },
    ],
  },
  {
    code: 'T3', title: 'Projeto, Construção e Operação', color: '#7D6608', icon: '🏗️',
    principles: [
      { code: 'P04', number: 4, question: 'Critérios de projeto e classificação', description: 'A classificação de consequências da barragem foi determinada e os critérios de projeto foram definidos para minimizar riscos em todas as fases do ciclo de vida?' },
      { code: 'P05', number: 5, question: 'Projeto robusto e gestão hídrica', description: 'O projeto considera modos plausíveis de ruptura, inclui gestão hídrica e demonstra viabilidade do fechamento seguro?' },
      { code: 'P06', number: 6, question: 'Construção e operação conforme projeto', description: 'A construção e operação seguem a intenção do projeto com controle de qualidade, APO, Manual OMV e sistema de gestão de mudanças?' },
      { code: 'P07', number: 7, question: 'Sistema de monitoramento', description: 'Existe um sistema de monitoramento abrangente com indicadores de desempenho, PAAR e análises regulares pelo EdR?' },
    ],
  },
  {
    code: 'T4', title: 'Gestão e Governança', color: '#6E2F1A', icon: '🏛️',
    principles: [
      { code: 'P08', number: 8, question: 'Políticas e responsabilidades', description: 'O Conselho de Administração adotou políticas de gestão segura, há Executivo Responsável designado, RTER nomeado e estrutura de governança de rejeitos estabelecida?' },
      { code: 'P09', number: 9, question: 'Engenheiro de Registro (EdR)', description: 'Um EdR qualificado está contratado por escrito com autoridade, função e responsabilidades claramente definidas?' },
      { code: 'P10', number: 10, question: 'Níveis de revisão e auditorias', description: 'Avaliações de risco, revisões do SGDR, auditorias internas, revisões anuais pelo EdR e RPSB são realizadas nas frequências previstas?' },
      { code: 'P11', number: 11, question: 'Cultura organizacional', description: 'Existe educação dos funcionários sobre prevenção de falhas, mecanismos para incorporar experiência dos trabalhadores e gestão de lições aprendidas?' },
      { code: 'P12', number: 12, question: 'Canal de denúncias', description: 'Há um processo formal e confidencial para denúncias, com proteção contra retaliações aos denunciantes?' },
    ],
  },
  {
    code: 'T5', title: 'Resposta a Emergências', color: '#922B21', icon: '🚨',
    principles: [
      { code: 'P13', number: 13, question: 'Plano de emergência (PPRE/PAEBM)', description: 'Existe um PPRE/PAEBM baseado em cenários plausíveis, testado regularmente e desenvolvido com as comunidades e órgãos públicos?' },
      { code: 'P14', number: 14, question: 'Recuperação de longo prazo', description: 'Há planos preparados para recuperação de longo prazo após uma falha catastrófica, com engajamento de órgãos públicos e comunidades?' },
    ],
  },
  {
    code: 'T6', title: 'Divulgação Pública', color: '#1A5276', icon: '📢',
    principles: [
      { code: 'P15', number: 15, question: 'Transparência e acesso à informação', description: 'A organização publica anualmente informações sobre a classificação de consequências, avaliações de risco, monitoramento, PPRE e capacidade financeira para fechamento?' },
    ],
  },
]

const SCALE = [
  { value: 0,   label: 'Não implementamos',              sublabel: 'Não temos este processo ou documento', color: '#DC2626', bg: '#FEF2F2' },
  { value: 50,  label: 'Implementamos parcialmente',     sublabel: 'Existe, mas não está formalizado', color: '#D97706', bg: '#FFFBEB' },
  { value: 75,  label: 'Implementamos formalmente',      sublabel: 'Processo documentado e aplicado', color: '#2563EB', bg: '#EFF6FF' },
  { value: 100, label: 'Implementamos e auditamos',      sublabel: 'Auditado e continuamente melhorado', color: '#059669', bg: '#D1FAE5' },
]

const SEGMENTS = ['Minério de Ferro','Bauxita','Fosfato','Níquel','Cobre','Ouro','Carvão','Potássio','Outro']
const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function ScaleButton({ opt, selected, onClick }: { opt: typeof SCALE[0]; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${selected ? 'border-current scale-[1.01]' : 'border-transparent hover:opacity-90'}`}
      style={{ color: opt.color, background: opt.bg }}
    >
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
  const fs2 = size === 'lg' ? 28 : 16
  const fy = size === 'lg' ? 76 : 52
  return (
    <svg viewBox={vb} className={size === 'lg' ? 'w-36 h-28' : 'w-20 h-16'}>
      <path d={`M${x1} ${y1} A ${r} ${r} 0 1 1 ${bx2} ${by2}`} fill="none" stroke="#F3F4F6" strokeWidth={sw} strokeLinecap="round" />
      {v > 0 && <path d={`M${x1} ${y1} A ${r} ${r} 0 ${lf} 1 ${ex} ${ey}`} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" />}
      <text x={cx} y={fy} textAnchor="middle" fontSize={fs2} fontWeight="800" fill={col} fontFamily="Inter,sans-serif">{v}%</text>
    </svg>
  )
}

export function PublicAssessmentPage() {
  const [step, setStep] = useState(0) // 0=dados, 1-6=tópicos, 7=resultado
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [lead, setLead] = useState({
    company_name: '', contact_name: '', contact_email: '',
    contact_phone: '', contact_role: '', segment: '', dam_name: '', dam_count: '1', state: '',
  })
  const [answers, setAnswers] = useState<Record<string, number>>({})

  const totalSteps = 1 + TOPICS.length // dados + 6 tópicos
  const isDataStep = step === 0
  const isResultStep = step === totalSteps
  const currentTopic = !isDataStep && !isResultStep ? TOPICS[step - 1] : null

  // Calcula score
  function calcScore() {
    const all = TOPICS.flatMap(t => t.principles)
    const answered = all.filter(p => answers[p.code] != null)
    if (answered.length === 0) return 0
    const sum = all.reduce((s, p) => s + (answers[p.code] ?? 0), 0)
    return Math.round(sum / all.length)
  }

  function calcTopicScore(topicCode: string) {
    const topic = TOPICS.find(t => t.code === topicCode)
    if (!topic) return 0
    const sum = topic.principles.reduce((s, p) => s + (answers[p.code] ?? 0), 0)
    return Math.round(sum / topic.principles.length)
  }

  function canAdvance() {
    if (isDataStep) {
      return lead.company_name && lead.contact_name && lead.contact_email.includes('@') && lead.dam_name
    }
    if (currentTopic) {
      return currentTopic.principles.every(p => answers[p.code] != null)
    }
    return true
  }

  async function handleSubmit() {
    setSubmitting(true); setError('')
    try {
      const overall = calcScore()
      const scoresByTopic: Record<string, number> = {}
      TOPICS.forEach(t => { scoresByTopic[t.code] = calcTopicScore(t.code) })

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
      setSubmitted(true)
      setStep(totalSteps)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDownloadPDF() {
    // Abre janela de impressão como PDF
    window.print()
  }

  const score = calcScore()
  const scoreColor = score >= 75 ? '#059669' : score >= 50 ? '#2563EB' : score >= 25 ? '#D97706' : '#DC2626'
  const scoreLabel = score >= 75 ? 'Avançado' : score >= 50 ? 'Em desenvolvimento' : score >= 25 ? 'Inicial' : 'Incipiente'

  const criticalTopics = TOPICS
    .map(t => ({ ...t, score: calcTopicScore(t.code) }))
    .filter(t => t.principles.every(p => answers[p.code] != null))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#002B3D] text-white py-4 px-6 flex items-center gap-3 print:hidden">
        <div className="w-8 h-8 rounded-lg bg-[#0A9396] flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight">HIDROBR</div>
          <div className="text-[10px] text-white/40 uppercase tracking-widest">Self Assessment GISTM</div>
        </div>
        <div className="ml-auto text-xs text-white/40">
          Padrão Global da Indústria para a Gestão de Rejeitos · UNEP/ICMM/PRI
        </div>
      </div>

      {/* Progress bar */}
      {!isResultStep && (
        <div className="h-1 bg-gray-200 print:hidden">
          <div className="h-full bg-[#0A9396] transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ETAPA 0 — Dados da empresa */}
        {isDataStep && (
          <div>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#002B3D] flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#0A9396]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Avalie sua conformidade ao GISTM
              </h1>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Responda 15 perguntas em ~5 minutos e receba um diagnóstico gratuito do nível de conformidade da sua organização ao Padrão Global da Indústria para a Gestão de Rejeitos.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Razão social da empresa *</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396] focus:border-transparent"
                    placeholder="Ex: Mineração Norte S.A."
                    value={lead.company_name} onChange={e => setLead({ ...lead, company_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome *</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="Nome completo"
                    value={lead.contact_name} onChange={e => setLead({ ...lead, contact_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="Ex: Gerente de Segurança"
                    value={lead.contact_role} onChange={e => setLead({ ...lead, contact_role: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail corporativo *</label>
                  <input type="email" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="seu@empresa.com.br"
                    value={lead.contact_email} onChange={e => setLead({ ...lead, contact_email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="+55 31 99999-0000"
                    value={lead.contact_phone} onChange={e => setLead({ ...lead, contact_phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da barragem principal *</label>
                  <input className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    placeholder="Ex: Barragem Norte BN-01"
                    value={lead.dam_name} onChange={e => setLead({ ...lead, dam_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Segmento mineral</label>
                  <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    value={lead.segment} onChange={e => setLead({ ...lead, segment: e.target.value })}>
                    <option value="">Selecione...</option>
                    {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nº de barragens</label>
                  <input type="number" min="1" max="50" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    value={lead.dam_count} onChange={e => setLead({ ...lead, dam_count: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado (UF)</label>
                  <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A9396]"
                    value={lead.state} onChange={e => setLead({ ...lead, state: e.target.value })}>
                    <option value="">Selecione...</option>
                    {STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <strong>Privacidade:</strong> Seus dados serão usados exclusivamente pela HIDROBR para entrar em contato sobre o resultado desta avaliação. Não compartilhamos com terceiros.
              </div>
            </div>
          </div>
        )}

        {/* ETAPAS 1-6 — Perguntas por tópico */}
        {currentTopic && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: currentTopic.color + '20' }}>
                {currentTopic.icon}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: currentTopic.color }}>
                  Tópico {step} de {TOPICS.length}
                </div>
                <h2 className="text-lg font-bold text-gray-900">{currentTopic.title}</h2>
              </div>
            </div>

            <div className="space-y-6">
              {currentTopic.principles.map((principle, idx) => (
                <div key={principle.code} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: currentTopic.color + '15', color: currentTopic.color }}>
                      {principle.number}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 mb-1">{principle.question}</div>
                      <p className="text-xs text-gray-500 leading-relaxed">{principle.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SCALE.map(opt => (
                      <ScaleButton
                        key={opt.value}
                        opt={opt}
                        selected={answers[principle.code] === opt.value}
                        onClick={() => setAnswers({ ...answers, [principle.code]: opt.value })}
                      />
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
            {/* Cabeçalho do relatório */}
            <div className="bg-[#002B3D] rounded-2xl p-6 text-white mb-6 text-center">
              <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Diagnóstico GISTM</div>
              <div className="text-xl font-bold mb-0.5">{lead.company_name}</div>
              <div className="text-sm text-white/60">{lead.dam_name} · {new Date().toLocaleDateString('pt-BR')}</div>
            </div>

            {/* Score global */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 text-center">
              <div className="text-sm text-gray-500 mb-2">Nível de conformidade estimado</div>
              <Gauge value={score} size="lg" />
              <div className="text-lg font-bold mt-1" style={{ color: scoreColor }}>{scoreLabel}</div>
              <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">
                Score baseado em {Object.keys(answers).length} princípios avaliados de {TOPICS.flatMap(t => t.principles).length} totais do padrão GISTM
              </p>
            </div>

            {/* Score por tópico */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Resultado por tópico</h3>
              <div className="space-y-3">
                {TOPICS.map(t => {
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
                      <span className="text-sm font-bold w-10 text-right flex-shrink-0" style={{ color: col }}>{s}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tópicos críticos */}
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

            {/* CTA */}
            <div className="bg-[#002B3D] rounded-2xl p-6 text-white text-center mb-4 print:hidden">
              <div className="text-lg font-bold mb-2">Evolua para conformidade total</div>
              <p className="text-sm text-white/70 mb-4 max-w-sm mx-auto">
                A HIDROBR pode ajudar sua organização a implementar o GISTM de forma estruturada, com avaliações detalhadas e planos de ação personalizados.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <a href="mailto:contato@hidrobr.com.br"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A9396] rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                  Falar com um consultor
                </a>
                <button
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm font-semibold text-white hover:bg-white/20 transition-colors">
                  <Download className="w-4 h-4" /> Baixar relatório
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400">
              Resultado enviado para {lead.contact_email} · HIDROBR Soluções Integradas · {new Date().getFullYear()}
            </p>
          </div>
        )}

        {/* Mensagem de erro */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Navegação */}
        {!isResultStep && (
          <div className="flex items-center justify-between mt-8 print:hidden">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${step === 0 ? 'opacity-0 pointer-events-none' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps + 1 }).map((_, i) => (
                <div key={i} className={`rounded-full transition-all ${i === step ? 'w-6 h-2 bg-[#0A9396]' : i < step ? 'w-2 h-2 bg-[#0A9396]/40' : 'w-2 h-2 bg-gray-200'}`} />
              ))}
            </div>

            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance()}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${canAdvance() ? 'bg-[#002B3D] text-white hover:opacity-90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance() || submitting}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${canAdvance() && !submitting ? 'bg-[#059669] text-white hover:opacity-90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><CheckCircle2 className="w-4 h-4" /> Ver resultado</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          #resultado-print { padding: 20px; }
        }
      `}</style>
    </div>
  )
}
