// src/features/requirements/TsmRequirementsPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronDown, Loader2, X, Save, AlertCircle, CheckCircle2, Shield, AlertTriangle, Heart, Trash2, Leaf, Cloud, Droplet, Users, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { cycleFacilityIds } from '@/lib/facilityScoring'

const TSM_STANDARD_ID = 2

const TOPIC_ICONS: Record<string, any> = {
    shield: Shield,
    'alert-triangle': AlertTriangle,
    heart: Heart,
    trash: Trash2,
    leaf: Leaf,
    cloud: Cloud,
    droplet: Droplet,
    users: Users,
}

function TopicIcon({ name, color }: { name?: string | null; color?: string }) {
    const IconComp = (name && TOPIC_ICONS[name]) || Circle
    return <IconComp className="w-5 h-5" style={color ? { color } : undefined} />
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  not_started:   { label: 'Não iniciado',    color: '#9CA3AF', bg: '#F9FAFB',  dot: 'bg-gray-300' },
  in_progress:   { label: 'Em andamento',    color: '#7C3AED', bg: '#F5F3FF',  dot: 'bg-purple-400' },
  submitted:     { label: 'Ag. avaliação',   color: '#D97706', bg: '#FFFBEB',  dot: 'bg-amber-400' },
  approved:      { label: 'Aprovado',        color: '#059669', bg: '#ECFDF5',  dot: 'bg-emerald-500' },
  needs_revision:{ label: 'Revisar',         color: '#DC2626', bg: '#FEF2F2',  dot: 'bg-red-500' },
}

const SCORE_OPTIONS = [
  { key: 'fully_conforming',     label: 'Totalmente Conforme',   value: 100, color: '#059669', bg: '#D1FAE5' },
  { key: 'conforming',           label: 'Conforme',              value: 75,  color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'partially_conforming', label: 'Parcialmente Conforme', value: 50,  color: '#D97706', bg: '#FFFBEB' },
  { key: 'non_conforming',       label: 'Não Conforme',          value: 0,   color: '#DC2626', bg: '#FEF2F2' },
]

// ── Modal de requisito ────────────────────────────────────────
function TsmRequirementModal({ requirement, response, cycleId, facilityId, onClose }: {
  requirement: any; response: any; cycleId: string; facilityId: string; onClose: () => void
}) {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const qc = useQueryClient()

  const [tab, setTab] = useState<'resposta' | 'avaliacao' | 'orientacao'>('resposta')
  const [text, setText] = useState(response?.implementation_text ?? '')
  const [score, setScore] = useState('')
  const [maturityLevel, setMaturityLevel] = useState('')
  const [assessText, setAssessText] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [saving, setSaving] = useState(false)
  const [assessing, setAssessing] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const [localAssessment, setLocalAssessment] = useState<any>(
    response?.tsm_assessments?.[0] ?? null
  )
  const hasAssessment = localAssessment !== null
  const assessment = localAssessment
  const currentStatus = response?.status ?? 'not_started'
  const statusCfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.not_started

  async function ensureResponse(newStatus?: string): Promise<string> {
    if (response?.id) {
      await supabase.from('tsm_responses').update({
        implementation_text: text,
        status: newStatus ?? response.status,
        updated_at: new Date().toISOString(),
      }).eq('id', response.id)
      return response.id
    } else {
      const { data, error } = await supabase.from('tsm_responses').insert({
        cycle_id: cycleId,
        facility_id: facilityId,
        requirement_id: requirement.id,
        implementation_text: text,
        status: newStatus ?? 'in_progress',
      }).select('id').single()
      if (error) throw new Error(`Erro ao criar resposta: ${error.message}`)
      return data.id
    }
  }

  async function handleSave(newStatus?: string) {
    setSaving(true); setErrMsg('')
    try {
      await ensureResponse(newStatus)
      await qc.invalidateQueries({ queryKey: ['tsm-requirements'], exact: false })
      onClose()
    } catch (e: any) {
      setErrMsg(e.message ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssess() {
    setErrMsg('')
    if (!response?.id) { setErrMsg('O cliente deve preencher e salvar a resposta antes da avaliação.'); return }
    if (!score) { setErrMsg('Selecione uma classificação.'); return }
    if (assessText.trim().length < 20) { setErrMsg('O parecer técnico deve ter pelo menos 20 caracteres.'); return }

    setAssessing(true)
    try {
      const newStatus = ['fully_conforming', 'conforming'].includes(score) ? 'approved' : 'needs_revision'
      const { error: statusError } = await supabase.from('tsm_responses')
        .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', response.id)
      if (statusError) throw new Error(statusError.message)

      const scoreValue = SCORE_OPTIONS.find(s => s.key === score)?.value ?? 0
      const { error: assessError } = await supabase.from('tsm_assessments').upsert({
        response_id: response.id,
        assessed_by: profile!.id,
        score,
        score_value: scoreValue,
        assessment_text: assessText.trim(),
        recommendations: recommendations.trim() || null,
        maturity_level: maturityLevel || null,
        published_at: new Date().toISOString(),
      }, { onConflict: 'response_id' })
      if (assessError) throw new Error(`Erro ao salvar avaliação: ${assessError.message}`)

      setLocalAssessment({ score, score_value: scoreValue, assessment_text: assessText.trim(), recommendations: recommendations.trim() || null, maturity_level: maturityLevel || null, published_at: new Date().toISOString() })
      await qc.invalidateQueries({ queryKey: ['tsm-requirements'], exact: false })
      onClose()
    } catch (e: any) {
      setErrMsg(e.message ?? 'Erro ao publicar avaliação')
    } finally {
      setAssessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: '#1B4F7220', color: '#1B4F72' }}>
            {requirement.code}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-snug">{requirement.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full`}
                style={{ background: statusCfg.bg, color: statusCfg.color }}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 flex-shrink-0">
          {(['resposta', 'avaliacao', 'orientacao'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t === 'resposta' ? 'Resposta' : t === 'avaliacao' ? 'Avaliação HIDROBR' : 'Orientação'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {errMsg && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4 flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{errMsg}</div>}

          {/* Descrição do requisito */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-600 leading-relaxed">{requirement.description}</p>
          </div>

          {/* ABA: Resposta */}
          {tab === 'resposta' && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Como este requisito TSM é atendido na sua organização?</label>
                <textarea className="form-input resize-none" rows={6}
                  placeholder="Descreva as práticas, processos, documentos e evidências que demonstram o atendimento a este requisito..."
                  value={text} onChange={e => setText(e.target.value)}
                  disabled={currentStatus === 'approved'} />
              </div>
              {hasAssessment && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  ⚠️ Este requisito já foi avaliado pela HIDROBR. Editar a resposta pode requerer nova avaliação.
                </div>
              )}
            </div>
          )}

          {/* ABA: Avaliação */}
          {tab === 'avaliacao' && (
            <div>
              {hasAssessment ? (
                <div className="space-y-4">
                  <div className="rounded-xl p-4 border"
                    style={{ background: SCORE_OPTIONS.find(s => s.key === assessment.score)?.bg, borderColor: SCORE_OPTIONS.find(s => s.key === assessment.score)?.color + '40' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl font-extrabold" style={{ color: SCORE_OPTIONS.find(s => s.key === assessment.score)?.color }}>
                        {assessment.score_value}pts
                      </div>
                      <div>
                        <div className="text-sm font-bold" style={{ color: SCORE_OPTIONS.find(s => s.key === assessment.score)?.color }}>
                          {SCORE_OPTIONS.find(s => s.key === assessment.score)?.label}
                        </div>
                        <div className="text-[10px] text-gray-400">{assessment.published_at ? new Date(assessment.published_at).toLocaleDateString('pt-BR') : ''}</div>
                      </div>
                      {assessment.maturity_level && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: '#1B4F7220', color: '#1B4F72' }}>
                          Nível {assessment.maturity_level}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{assessment.assessment_text}</p>
                    {assessment.recommendations && (
                      <div className="mt-3 pt-3 border-t border-current/10">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Recomendações</div>
                        <p className="text-xs text-gray-600">{assessment.recommendations}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : hb ? (
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Classificação de conformidade *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SCORE_OPTIONS.map(opt => (
                        <button key={opt.key} onClick={() => setScore(opt.key)}
                          className={`p-3 rounded-xl text-xs font-semibold text-left border-2 transition-all ${score === opt.key ? 'border-current scale-[1.01]' : 'border-transparent hover:opacity-90'}`}
                          style={{ color: opt.color, background: opt.bg }}>
                          {opt.label}
                          <span className="block text-[10px] opacity-70 mt-0.5">{opt.value} pontos</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Nível de maturidade TSM <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <div className="flex gap-2">
                      {['C', 'B', 'A', 'AA', 'AAA'].map(lvl => (
                        <button key={lvl} type="button" onClick={() => setMaturityLevel(maturityLevel === lvl ? '' : lvl)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${maturityLevel === lvl ? 'border-brand-700 bg-brand-700 text-white' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`}>
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Parecer técnico * <span className="text-gray-400 font-normal">(mín. 20 caracteres)</span></label>
                    <textarea className="form-input resize-none" rows={4}
                      placeholder="Descreva a análise técnica da conformidade ao requisito TSM..."
                      value={assessText} onChange={e => setAssessText(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Recomendações <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <textarea className="form-input resize-none" rows={2}
                      placeholder="Ações recomendadas para melhoria..."
                      value={recommendations} onChange={e => setRecommendations(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">Aguardando avaliação da HIDROBR</p>
                  <p className="text-xs mt-1">Submeta a resposta para solicitar avaliação</p>
                </div>
              )}
            </div>
          )}

          {/* ABA: Orientação */}
          {tab === 'orientacao' && (
            <div>
              {requirement.guidance ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">Orientação de implementação</div>
                  <p className="text-sm text-amber-800 leading-relaxed">{requirement.guidance}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma orientação específica cadastrada para este requisito.</p>
              )}
              {(requirement.sub_requirements ?? []).length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Subcritérios</div>
                  <div className="space-y-2">
                    {requirement.sub_requirements.map((sub: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] font-mono text-gray-400 flex-shrink-0 mt-0.5">{sub.id}</span>
                        <p className="text-xs text-gray-600">{sub.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
          <div className="flex gap-2">
            {tab === 'resposta' && !hb && currentStatus !== 'approved' && (
              <>
                <button
                  style={{ display:'inline-flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background:'white',color:'#374151',border:'1px solid #D1D5DB',cursor:'pointer' }}
                  onClick={() => handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar rascunho
                </button>
                <button
                  style={{ display:'inline-flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background: text.trim().length < 20 || saving ? '#9CA3AF' : '#002B3D',color:'white',border:'none',cursor: text.trim().length < 20 ? 'not-allowed' : 'pointer' }}
                  onClick={() => handleSave('submitted')} disabled={saving || text.trim().length < 20}>
                  Solicitar avaliação
                </button>
              </>
            )}
            {tab === 'avaliacao' && hb && !hasAssessment && (
              <button
                style={{ display:'inline-flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background: assessing || !score || assessText.trim().length < 20 ? '#9CA3AF' : '#059669',color:'white',border:'none',cursor: assessing || !score || assessText.trim().length < 20 ? 'not-allowed' : 'pointer' }}
                onClick={handleAssess} disabled={assessing || !score || assessText.trim().length < 20}>
                {assessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Publicar avaliação
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Row de requisito ──────────────────────────────────────────
function TsmRequirementRow({ req, response, onSelect }: { req: any; response: any; onSelect: () => void }) {
  const status = response?.status ?? 'not_started'
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
  const assessment = response?.tsm_assessments?.[0]

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
      onClick={onSelect}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <div className="w-12 flex-shrink-0">
        <span className="text-[11px] font-bold text-gray-400 font-mono">{req.code}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{req.title}</p>
        {req.description && <p className="text-xs text-gray-400 truncate mt-0.5">{req.description.slice(0, 80)}...</p>}
      </div>
      {assessment?.maturity_level && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#1B4F7220', color: '#1B4F72' }}>
          Nível {assessment.maturity_level}
        </span>
      )}
      {assessment && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: SCORE_OPTIONS.find(s => s.key === assessment.score)?.color, background: SCORE_OPTIONS.find(s => s.key === assessment.score)?.bg }}>
          {assessment.score_value}pts
        </span>
      )}
      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
        style={{ background: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export function TsmRequirementsPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const orgId = profile?.organization_id
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [selectedReq, setSelectedReq] = useState<{ req: any; response: any } | null>(null)
  const [topicFilter, setTopicFilter] = useState<number | null>(null)

  const { data: cycles } = useQuery({
    queryKey: ['cycles-tsm', orgId],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from('assessment_cycles')
        .select('id, name, facility_id, facility_ids, organizations(name)').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(10)
      if (!hb && orgId) q = q.eq('organization_id', orgId)
      const { data } = await q
      return data ?? []
    },
  })

  const cycleId = selectedCycleId || cycles?.[0]?.id || ''
  const cycle = cycles?.find((c: any) => c.id === cycleId)
  const cycleFacilityIdList = cycleFacilityIds(cycle)

  const { data: facilities } = useQuery({
    queryKey: ['cycle-facilities-tsm', cycleId, cycleFacilityIdList.join(',')],
    enabled: !!cycleId && cycleFacilityIdList.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('tailings_facilities').select('id,name,dam_code').in('id', cycleFacilityIdList).order('name')
      const list = data ?? []
      if (list.length && !selectedFacilityId) setSelectedFacilityId(list[0].id)
      return list
    },
  })

  const facilityId = selectedFacilityId || facilities?.[0]?.id || ''

  const { data, isLoading } = useQuery({
    queryKey: ['tsm-requirements', cycleId, facilityId],
    enabled: !!cycleId && !!facilityId,
    queryFn: async () => {
      // Busca tópicos e requisitos TSM
      const { data: topics } = await supabase.from('standard_topics')
        .select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')
      const { data: requirements } = await supabase.from('standard_requirements')
        .select('*').eq('standard_id', TSM_STANDARD_ID).order('display_order')

      // Busca respostas do ciclo, escopadas à barragem selecionada
      const reqIds = (requirements ?? []).map((r: any) => r.id)
      const { data: responses } = reqIds.length > 0
        ? await supabase.from('tsm_responses').select('*')
            .eq('cycle_id', cycleId).eq('facility_id', facilityId).in('requirement_id', reqIds)
        : { data: [] }

      // Busca avaliações separadamente
      const respIds = (responses ?? []).map((r: any) => r.id)
      const { data: assessments } = respIds.length > 0
        ? await supabase.from('tsm_assessments').select('*').in('response_id', respIds)
        : { data: [] }

      // Combina
      const assessMap = new Map((assessments ?? []).map((a: any) => [a.response_id, a]))
      const respMap = new Map((responses ?? []).map((r: any) => [
        r.requirement_id,
        { ...r, tsm_assessments: assessMap.has(r.id) ? [assessMap.get(r.id)] : [] }
      ]))

      return { topics: topics ?? [], requirements: requirements ?? [], respMap }
    },
  })

  const { topics, requirements, respMap } = data ?? { topics: [], requirements: [], respMap: new Map() }

  // KPIs
  const total = requirements.length
  const approved = [...respMap.values()].filter((r: any) => r.status === 'approved').length
  const pending = [...respMap.values()].filter((r: any) => r.status === 'submitted').length
  const notStarted = total - respMap.size + [...respMap.values()].filter((r: any) => r.status === 'not_started').length

  // Score ponderado
  const allAssessments = [...respMap.values()].flatMap((r: any) => r.tsm_assessments ?? [])
  const totalWeight = requirements.reduce((s: number, r: any) => s + (Number(r.weight) || 1), 0)
  let weightedSum = 0
  requirements.forEach((req: any) => {
    const resp = respMap.get(req.id)
    const sv = resp?.tsm_assessments?.[0]?.score_value
    if (sv != null) weightedSum += sv * (Number(req.weight) || 1)
  })
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  const filteredTopics = topicFilter ? topics.filter((t: any) => t.id === topicFilter) : topics

  if (!cycleId) return (
    <div className="p-6"><div className="card p-10 text-center">
      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
      <p className="text-gray-600 font-medium">Nenhum ciclo ativo encontrado</p>
    </div></div>
  )

  if (!facilityId) return (
    <div className="p-6"><div className="card p-10 text-center">
      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
      <p className="text-gray-600 font-medium">Nenhuma barragem vinculada a este ciclo</p>
    </div></div>
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Requisitos TSM</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {topics.length} tópicos · {total} requisitos · {cycle?.organizations?.name ?? ''}
          </p>
        </div>
        {(cycles?.length ?? 0) > 1 && (
          <select className="form-input w-64" value={cycleId} onChange={e => { setSelectedCycleId(e.target.value); setSelectedFacilityId('') }}>
            {(cycles ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.organizations?.name} — {c.name}</option>
            ))}
          </select>
        )}
      </div>

      {(facilities?.length ?? 0) > 1 && (
        <div className="mb-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Avaliação por barragem — a conformidade do cliente é o pior caso (elo mais fraco) entre todas as barragens
          </div>
          <div className="flex flex-wrap gap-2">
            {facilities!.map((f: any) => (
              <button key={f.id} onClick={() => setSelectedFacilityId(f.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${facilityId === f.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}>
                {f.name}{f.dam_code ? ` · ${f.dam_code}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total de requisitos', value: total, color: '#0A9396' },
          { label: 'Aprovados', value: approved, color: '#059669' },
          { label: 'Pend. avaliação', value: pending, color: '#D97706' },
          { label: 'Não iniciados', value: notStarted, color: '#9CA3AF' },
        ].map(k => (
          <div key={k.label} className="card p-4" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-3xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtro por tópico */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setTopicFilter(null)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${!topicFilter ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200'}`}>
          Todos
        </button>
        {topics.map((t: any) => (
          <button key={t.id} onClick={() => setTopicFilter(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${topicFilter === t.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
            style={topicFilter === t.id ? { background: t.color_hex ?? '#1B4F72' } : {}}>
            {t.code}
          </button>
        ))}
      </div>

      {/* Lista por tópico */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-sm">Carregando requisitos TSM...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTopics.map((topic: any) => {
            const topicReqs = requirements.filter((r: any) => r.topic_id === topic.id)
            const topicApproved = topicReqs.filter((r: any) => respMap.get(r.id)?.status === 'approved').length
            const topicScore = (() => {
              let ws = 0, wt = 0
              topicReqs.forEach((r: any) => {
                const w = Number(r.weight) || 1; wt += w
                const sv = respMap.get(r.id)?.tsm_assessments?.[0]?.score_value
                if (sv != null) ws += sv * w
              })
              return wt > 0 ? Math.round(ws / wt) : 0
            })()

            return (
              <div key={topic.id} className="card overflow-hidden">
                {/* Tópico header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: (topic.color_hex ?? '#1B4F72') + '15', borderBottom: `2px solid ${topic.color_hex ?? '#1B4F72'}` }}>
                  <div className="flex items-center gap-3">
                    {topic.icon && <TopicIcon name={topic.icon} color={topic.color_hex} />}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: topic.color_hex ?? '#1B4F72' }}>{topic.code}</span>
                      <p className="text-sm font-bold text-gray-900">{topic.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{topicApproved}/{topicReqs.length} aprovados</span>
                    {topicScore > 0 && (
                      <span className="font-bold" style={{ color: topic.color_hex ?? '#1B4F72' }}>{topicScore}%</span>
                    )}
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${topicScore}%`, background: topic.color_hex ?? '#1B4F72' }} />
                    </div>
                  </div>
                </div>
                {/* Requisitos */}
                <div className="divide-y divide-gray-50">
                  {topicReqs.map((req: any) => (
                    <TsmRequirementRow
                      key={req.id}
                      req={req}
                      response={respMap.get(req.id) ?? null}
                      onSelect={() => setSelectedReq({ req, response: respMap.get(req.id) ?? null })}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {selectedReq && (
        <TsmRequirementModal
          requirement={selectedReq.req}
          response={selectedReq.response}
          cycleId={cycleId}
          facilityId={facilityId}
          onClose={() => setSelectedReq(null)}
        />
      )}
    </div>
  )
}
