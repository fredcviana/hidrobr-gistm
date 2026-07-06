// src/features/requirements/RequirementsPage.tsx
// CORREÇÃO: bug de salvamento da avaliação HIDROBR
// Nova hierarquia: Tópico > Princípio > Requisito
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, Clock, AlertCircle, Send, X } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  not_started: { label: 'Não Iniciado', cls: 'bg-gray-100 text-gray-600', dot: '#9CA3AF' },
  in_progress:  { label: 'Em Andamento', cls: 'bg-blue-50 text-blue-700', dot: '#3B82F6' },
  submitted:    { label: 'Ag. Avaliação', cls: 'bg-amber-50 text-amber-700', dot: '#D97706' },
  under_review: { label: 'Em Revisão', cls: 'bg-purple-50 text-purple-700', dot: '#8B5CF6' },
  approved:     { label: 'Aprovado', cls: 'bg-emerald-50 text-emerald-700', dot: '#059669' },
  needs_revision:{ label: 'Revisar', cls: 'bg-red-50 text-red-700', dot: '#DC2626' },
}
const SCORE_OPTIONS = [
  { key: 'fully_conforming',     label: 'Totalmente Conforme',   value: 100, color: '#059669', bg: '#D1FAE5' },
  { key: 'conforming',           label: 'Conforme',              value: 75,  color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'partially_conforming', label: 'Parcialmente Conforme', value: 50,  color: '#D97706', bg: '#FFFBEB' },
  { key: 'non_conforming',       label: 'Não Conforme',          value: 0,   color: '#DC2626', bg: '#FEF2F2' },
]

function StatusBadge({ status }: { status: string }) {
  const c = STATUS[status] ?? STATUS.not_started
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}

// ── Modal do requisito ─────────────────────────────────────────
function RequirementModal({ requirement, response, cycleId, principleCode, onClose }: {
  requirement: any; response: any; cycleId: string; principleCode: string; onClose: () => void
}) {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'resposta' | 'avaliacao'>('resposta')
  const [text, setText] = useState(response?.implementation_text ?? '')
  const [responsible, setResponsible] = useState(response?.responsible_person ?? '')
  const [score, setScore] = useState('')
  const [assessText, setAssessText] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [saving, setSaving] = useState(false)
  const [assessing, setAssessing] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const hasAssessment = (response?.hidrobr_assessments?.length ?? 0) > 0
  const assessment = response?.hidrobr_assessments?.[0]
  const currentStatus = response?.status ?? 'not_started'

  async function ensureResponse(newStatus?: string): Promise<string> {
    if (response?.id) {
      const { error } = await supabase.from('requirement_responses').update({
        implementation_text: text,
        responsible_person: responsible || null,
        ...(newStatus ? { status: newStatus, submitted_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', response.id)
      if (error) throw new Error(`Erro ao salvar resposta: ${error.message}`)
      return response.id
    } else {
      const { data, error } = await supabase.from('requirement_responses').insert({
        cycle_id: cycleId,
        requirement_id: requirement.id,
        implementation_text: text,
        responsible_person: responsible || null,
        status: newStatus ?? 'in_progress',
        ...(newStatus === 'submitted' ? { submitted_at: new Date().toISOString() } : {}),
      }).select('id').single()
      if (error) throw new Error(`Erro ao criar resposta: ${error.message}`)
      return data.id
    }
  }

  async function handleSave(newStatus?: string) {
    setSaving(true); setErrMsg(''); setSuccessMsg('')
    try {
      await ensureResponse(newStatus)
      await qc.invalidateQueries({ queryKey: ['requirements-v3'] })
      onClose()
    } catch (e: any) {
      setErrMsg(e.message ?? 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssess() {
    setErrMsg(''); setSuccessMsg('')

    // Validações
    if (!response?.id) {
      setErrMsg('O cliente deve preencher e salvar a resposta antes da avaliação.')
      return
    }
    if (!score) {
      setErrMsg('Selecione uma classificação de conformidade.')
      return
    }
    if (assessText.trim().length < 20) {
      setErrMsg('O parecer técnico deve ter pelo menos 20 caracteres.')
      return
    }

    setAssessing(true)
    try {
      // Passo 1: atualiza status da resposta para 'approved'
      const { error: statusError } = await supabase
        .from('requirement_responses')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', response.id)

      if (statusError) throw new Error(`Erro ao atualizar status: ${statusError.message}`)

      // Passo 2: insere a avaliação
      const scoreValue = SCORE_OPTIONS.find(s => s.key === score)?.value ?? 0
      const { error: assessError } = await supabase
        .from('hidrobr_assessments')
        .insert({
          response_id: response.id,
          assessed_by: profile!.id,
          score: score,
          score_value: scoreValue,
          assessment_text: assessText.trim(),
          recommendations: recommendations.trim() || null,
          published_at: new Date().toISOString(),
        })

      if (assessError) {
        // Se falhou ao inserir, reverte o status
        await supabase.from('requirement_responses').update({ status: 'submitted' }).eq('id', response.id)
        throw new Error(`Erro ao salvar avaliação: ${assessError.message}`)
      }

      // Sucesso
      await qc.invalidateQueries({ queryKey: ['requirements-v3', cycleId] })
      onClose()
    } catch (e: any) {
      setErrMsg(e.message ?? 'Erro desconhecido ao publicar avaliação')
    } finally {
      setAssessing(false)
    }
  }

  const scoreOpt = SCORE_OPTIONS.find(s => s.key === assessment?.score)

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-[620px] h-full bg-white flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-sm font-bold text-brand-700 flex-shrink-0">
            {requirement.code}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-400 mb-0.5">Princípio {principleCode}</div>
            <StatusBadge status={currentStatus} />
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded border border-gray-200 ml-2">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {(['resposta', 'avaliacao'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setErrMsg(''); setSuccessMsg('') }}
              className={`px-5 py-3 text-[13px] font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'resposta' ? 'Resposta do Cliente' : 'Avaliação HIDROBR'}
              {t === 'avaliacao' && hasAssessment && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Mensagens */}
          {errMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {successMsg}
            </div>
          )}

          {/* ABA RESPOSTA */}
          {tab === 'resposta' && (
            <div className="space-y-4">
              <div className="bg-brand-50 border-l-4 border-brand-400 p-4 rounded-r-xl">
                <div className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-1.5">Requisito {requirement.code}</div>
                <p className="text-sm text-gray-700 leading-relaxed">{requirement.description}</p>
              </div>
              {requirement.guidance && (
                <div className="bg-amber-50 border-l-4 border-amber-300 p-4 rounded-r-xl">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Orientação de atendimento</div>
                  <p className="text-xs text-amber-900 leading-relaxed">{requirement.guidance}</p>
                </div>
              )}
              <div>
                <label className="form-label">
                  Como sua organização atende este requisito *
                  <span className="text-gray-400 font-normal ml-1">(mín. 20 caracteres)</span>
                </label>
                <textarea className="form-input resize-none" rows={6}
                  placeholder="Descreva as práticas, documentos, processos e evidências que demonstram o atendimento..."
                  value={text} onChange={e => setText(e.target.value)} />
                <div className="text-right text-[11px] text-gray-400 mt-1">{text.length} caracteres</div>
              </div>
              <div>
                <label className="form-label">Responsável pela implementação</label>
                <input type="text" className="form-input" placeholder="Nome, cargo e área responsável"
                  value={responsible} onChange={e => setResponsible(e.target.value)} />
              </div>
            </div>
          )}

          {/* ABA AVALIAÇÃO */}
          {tab === 'avaliacao' && (
            <div>
              {/* Avaliação existente */}
              {hasAssessment && (
                <div className="rounded-xl p-5 border mb-4" style={{ background: scoreOpt?.bg, borderColor: scoreOpt?.color + '40' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: scoreOpt?.color }}>
                        Avaliação HIDROBR — Publicada
                      </div>
                      <div className="text-xl font-black" style={{ color: scoreOpt?.color }}>
                        {scoreOpt?.label} · {assessment.score_value}/100 pts
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white/70 flex items-center justify-center text-3xl">
                      {assessment.score_value === 100 ? '⭐' : assessment.score_value === 75 ? '✅' : assessment.score_value === 50 ? '⚠️' : '❌'}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-3" style={{ color: scoreOpt?.color }}>{assessment.assessment_text}</p>
                  {assessment.recommendations && (
                    <div className="mt-3 pt-3 border-t border-white/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: scoreOpt?.color }}>Recomendações</div>
                      <p className="text-xs leading-relaxed" style={{ color: scoreOpt?.color }}>{assessment.recommendations}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Formulário de nova avaliação */}
              {hb && !hasAssessment && (
                <div className="space-y-4">
                  {!response?.id && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Atenção:</strong> O cliente ainda não preencheu a resposta deste requisito.
                        <br />Você pode avaliar mesmo assim — vá para a aba Resposta, preencha e salve primeiro.
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Classificação de conformidade *
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {SCORE_OPTIONS.map(opt => (
                        <button key={opt.key} onClick={() => setScore(opt.key)}
                          className={`p-3.5 rounded-xl text-sm font-semibold text-center border-2 transition-all ${score === opt.key ? 'border-current scale-[1.02] shadow-sm' : 'border-transparent hover:opacity-90'}`}
                          style={{ color: opt.color, background: opt.bg }}>
                          {opt.value === 100 ? '⭐ ' : opt.value === 75 ? '✅ ' : opt.value === 50 ? '⚠️ ' : '❌ '}
                          {opt.label}
                          <span className="block text-xs font-normal mt-0.5 opacity-70">{opt.value} pontos</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">
                      Parecer técnico *
                      <span className="text-gray-400 font-normal ml-1">({assessText.length}/20 mín.)</span>
                    </label>
                    <textarea className="form-input resize-none" rows={5}
                      placeholder="Descreva a análise técnica do atendimento ao requisito..."
                      value={assessText} onChange={e => setAssessText(e.target.value)} />
                  </div>

                  <div>
                    <label className="form-label">Recomendações de melhoria <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <textarea className="form-input resize-none" rows={3}
                      placeholder="Sugestões para o próximo ciclo..."
                      value={recommendations} onChange={e => setRecommendations(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Cliente sem avaliação */}
              {!hb && !hasAssessment && (
                <div className="text-center py-16">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="font-medium text-gray-500">Aguardando avaliação da HIDROBR</p>
                  <p className="text-xs text-gray-400 mt-1">A avaliação será publicada após análise técnica</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-xs text-gray-400">
            {tab === 'avaliacao' && hb && !hasAssessment && score && (
              <span>Classificação: <strong>{SCORE_OPTIONS.find(s => s.key === score)?.label}</strong> · {SCORE_OPTIONS.find(s => s.key === score)?.value} pts</span>
            )}
          </div>
          <div className="flex gap-2.5">
            <button className="btn-secondary btn-sm" onClick={onClose}>Fechar</button>

            {tab === 'resposta' && (
              <>
                <button className="btn-secondary btn-sm inline-flex items-center gap-1.5"
                  disabled={saving} onClick={() => handleSave()}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : '💾'} Salvar
                </button>
                {(currentStatus === 'not_started' || !response) && (
                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleSave('in_progress')}>
                    Iniciar preenchimento
                  </button>
                )}
                {['in_progress', 'needs_revision'].includes(currentStatus) && !hb && (
                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: saving || text.length < 20 ? '#9CA3AF' : '#2DC98C', color: '#002B3D', border: 'none', cursor: saving || text.length < 20 ? 'not-allowed' : 'pointer' }}
                    onClick={() => handleSave('submitted')} disabled={saving || text.length < 20}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Solicitar avaliação
                  </button>
                )}
              </>
            )}

            {tab === 'avaliacao' && hb && !hasAssessment && (
              <button
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                  background: assessing || !score || assessText.trim().length < 20 ? '#9CA3AF' : '#059669',
                  color: 'white', border: 'none',
                  cursor: assessing || !score || assessText.trim().length < 20 ? 'not-allowed' : 'pointer',
                }}
                onClick={handleAssess}
                disabled={assessing || !score || assessText.trim().length < 20}>
                {assessing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Publicando...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Publicar avaliação</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── RequirementRow, PrincipleCard, TopicSection e RequirementsPage ──
function RequirementRow({ req, response, onSelect }: { req: any; response: any; onSelect: () => void }) {
  const status = response?.status ?? 'not_started'
  const s = STATUS[status] ?? STATUS.not_started
  const assessment = response?.hidrobr_assessments?.[0]
  const scoreOpt = SCORE_OPTIONS.find(o => o.key === assessment?.score)

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors" onClick={onSelect}>
      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ background: s.dot }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-bold text-gray-400 font-mono">{req.code}</span>
          {assessment && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: scoreOpt?.color, background: scoreOpt?.bg }}>
              {scoreOpt?.value} pts
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{req.description}</p>
        {response?.responsible_person && <p className="text-[10px] text-gray-400 mt-0.5">Resp.: {response.responsible_person}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={status} />
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
      </div>
    </div>
  )
}

function PrincipleCard({ principle, requirements, responseMap, topicColor, cycleId }: {
  principle: any; requirements: any[]; responseMap: Map<number, any>; topicColor: string; cycleId: string
}) {
  const [open, setOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState<any>(null)

  const approved = requirements.filter(r => responseMap.get(r.id)?.status === 'approved').length
  const pct = requirements.length > 0 ? Math.round((approved / requirements.length) * 100) : 0
  const pending = requirements.filter(r => ['submitted', 'under_review'].includes(responseMap.get(r.id)?.status ?? '')).length
  const needsRevision = requirements.filter(r => responseMap.get(r.id)?.status === 'needs_revision').length

  return (
    <>
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white">
        <div className="flex items-start gap-4 px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setOpen(!open)}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5"
            style={{ background: topicColor + '15', color: topicColor }}>
            {principle.number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">{principle.title}</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 flex-1">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-32">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: topicColor }} />
                </div>
                <span className="text-[11px] font-bold" style={{ color: topicColor }}>{pct}%</span>
              </div>
              <div className="flex gap-3 text-[11px] text-gray-400">
                <span>{approved}/{requirements.length} aprovados</span>
                {pending > 0 && <span className="text-amber-600 font-semibold">{pending} pend.</span>}
                {needsRevision > 0 && <span className="text-red-500 font-semibold">{needsRevision} revisar</span>}
              </div>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
        {open && (
          <div className="border-t border-gray-100">
            {requirements.map(req => (
              <RequirementRow key={req.id} req={req} response={responseMap.get(req.id) ?? null} onSelect={() => setSelectedReq(req)} />
            ))}
          </div>
        )}
      </div>
      {selectedReq && (
        <RequirementModal
          requirement={selectedReq}
          response={responseMap.get(selectedReq.id) ?? null}
          cycleId={cycleId}
          principleCode={principle.code}
          onClose={() => setSelectedReq(null)}
        />
      )}
    </>
  )
}

function TopicSection({ topic, principles, requirementsByPrinciple, responseMap, cycleId }: {
  topic: any; principles: any[]; requirementsByPrinciple: Map<number, any[]>; responseMap: Map<number, any>; cycleId: string
}) {
  const [open, setOpen] = useState(topic.code === 'T1')
  const allReqs = principles.flatMap(p => requirementsByPrinciple.get(p.id) ?? [])
  const approved = allReqs.filter(r => responseMap.get(r.id)?.status === 'approved').length
  const pct = allReqs.length > 0 ? Math.round((approved / allReqs.length) * 100) : 0

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:opacity-90 transition-opacity mb-2"
        style={{ background: topic.color_hex }} onClick={() => setOpen(!open)}>
        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{topic.code}</span>
        <span className="flex-1 text-sm font-bold text-white">{topic.title}</span>
        <div className="flex items-center gap-3 text-xs text-white/70">
          <span>{principles.length} princípios · {allReqs.length} requisitos</span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="ml-2">
          {principles.map(p => (
            <PrincipleCard key={p.id} principle={p}
              requirements={requirementsByPrinciple.get(p.id) ?? []}
              responseMap={responseMap} topicColor={topic.color_hex} cycleId={cycleId} />
          ))}
        </div>
      )}
    </div>
  )
}

export function RequirementsPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const [selectedCycleId, setSelectedCycleId] = useState('')

  const { data: cycles } = useQuery({
    queryKey: ['cycles-req', profile?.organization_id, hb],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from('assessment_cycles')
        .select('id,name,organization_id,organizations(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (!hb && profile?.organization_id) q = q.eq('organization_id', profile.organization_id)
      const { data } = await q
      if (data?.length && !selectedCycleId) setSelectedCycleId(data[0].id)
      return data ?? []
    },
  })

  const cycleId = selectedCycleId || cycles?.[0]?.id || ''

  const { data, isLoading } = useQuery({
    queryKey: ['requirements-v3', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const [{ data: topics }, { data: principles }, { data: requirements }, { data: responses }] = await Promise.all([
        supabase.from('gistm_topics').select('*').order('display_order'),
        supabase.from('gistm_principles').select('*').order('display_order'),
        supabase.from('gistm_requirements').select('*').order('display_order'),
        supabase.from('requirement_responses')
          .select('*, hidrobr_assessments(score,score_value,assessment_text,recommendations)')
          .eq('cycle_id', cycleId),
      ])
      return { topics: topics ?? [], principles: principles ?? [], requirements: requirements ?? [], responses: responses ?? [] }
    },
  })

  if (!cycleId) return (
    <div className="p-6"><div className="card p-10 text-center">
      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
      <p className="text-gray-600 font-medium">Nenhum ciclo ativo encontrado</p>
      <p className="text-gray-400 text-sm mt-1">{hb ? 'Crie um ciclo na página de Clientes.' : 'Contate a HIDROBR para criar um ciclo.'}</p>
    </div></div>
  )

  if (isLoading) return (
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
      <span className="text-sm">Carregando requisitos GISTM...</span>
    </div>
  )

  const { topics, principles, requirements, responses } = data!
  const responseMap = new Map(responses.map((r: any) => [r.requirement_id, r]))
  const principlesByTopic = new Map<number, any[]>()
  principles.forEach((p: any) => {
    if (!principlesByTopic.has(p.topic_id)) principlesByTopic.set(p.topic_id, [])
    principlesByTopic.get(p.topic_id)!.push(p)
  })
  const requirementsByPrinciple = new Map<number, any[]>()
  requirements.forEach((r: any) => {
    if (!requirementsByPrinciple.has(r.principle_id)) requirementsByPrinciple.set(r.principle_id, [])
    requirementsByPrinciple.get(r.principle_id)!.push(r)
  })

  const totalReqs = requirements.length
  const approved = responses.filter((r: any) => r.status === 'approved').length
  const pending = responses.filter((r: any) => ['submitted', 'under_review'].includes(r.status)).length
  const notStarted = totalReqs - responses.length + responses.filter((r: any) => r.status === 'not_started').length
  const cycle = cycles?.find((c: any) => c.id === cycleId)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Requisitos GISTM</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {principles.length} princípios · {totalReqs} requisitos · {cycle?.organizations?.name ?? cycle?.name}
          </p>
        </div>
        {hb && (cycles?.length ?? 0) > 1 && (
          <select className="form-input w-auto text-xs" value={cycleId} onChange={e => setSelectedCycleId(e.target.value)}>
            {(cycles ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.organizations?.name} — {c.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total de requisitos', value: totalReqs, color: '#0A9396' },
          { label: 'Aprovados', value: approved, color: '#059669' },
          { label: 'Pend. avaliação', value: pending, color: '#D97706' },
          { label: 'Não iniciados', value: notStarted, color: '#6B7280' },
        ].map(k => (
          <div key={k.label} className="card p-3" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-2xl font-extrabold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {topics.map((topic: any) => {
        const tPrinciples = principlesByTopic.get(topic.id) ?? []
        if (tPrinciples.length === 0) return null
        return (
          <TopicSection key={topic.id} topic={topic} principles={tPrinciples}
            requirementsByPrinciple={requirementsByPrinciple} responseMap={responseMap} cycleId={cycleId} />
        )
      })}
    </div>
  )
}
