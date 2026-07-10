// src/features/action-plan/ActionPlanPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Save, CheckCircle2, Clock, AlertTriangle, Circle, ChevronDown, Building2, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { cycleFacilityIds, buildRequirementScoreMaps } from '@/lib/facilityScoring'

const PRIORITY: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Crítica',  cls: 'bg-red-100 text-red-700' },
  high:     { label: 'Alta',     cls: 'bg-orange-100 text-orange-700' },
  medium:   { label: 'Média',    cls: 'bg-amber-100 text-amber-700' },
  low:      { label: 'Baixa',    cls: 'bg-green-100 text-green-700' },
}
const STATUS_ACTION: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Aberta',       cls: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-purple-50 text-purple-700' },
  completed:   { label: 'Concluída',    cls: 'bg-emerald-50 text-emerald-700' },
  cancelled:   { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-500' },
}
const SCORE_OPTIONS = [
  { key: 'fully_conforming',     label: 'Totalmente Conforme',   value: 100, color: '#059669', bg: '#D1FAE5' },
  { key: 'conforming',           label: 'Conforme',              value: 75,  color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'partially_conforming', label: 'Parcialmente Conforme', value: 50,  color: '#D97706', bg: '#FFFBEB' },
  { key: 'non_conforming',       label: 'Não Conforme',          value: 0,   color: '#DC2626', bg: '#FEF2F2' },
]
const GISTM_PRINCIPLES = Array.from({ length: 15 }, (_, i) => ({ code: `P${String(i+1).padStart(2,'0')}`, standard: 'GISTM' }))
const TSM_PRINCIPLES = Array.from({ length: 18 }, (_, i) => ({ code: `TSM-P${String(i+1).padStart(2,'0')}`, standard: 'TSM' }))
const ALL_PRINCIPLES = [...GISTM_PRINCIPLES, ...TSM_PRINCIPLES]

// ── Seletor de princípios ─────────────────────────────────────
function PrincipleSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = ALL_PRINCIPLES.filter(p => p.code.toLowerCase().includes(search.toLowerCase()))
  function toggle(code: string) { onChange(value.includes(code) ? value.filter(c => c !== code) : [...value, code]) }
  return (
    <div className="relative">
      <div className="form-input cursor-pointer flex items-center gap-2 flex-wrap min-h-[40px]" onClick={() => setOpen(!open)}>
        {value.length === 0 ? <span className="text-gray-400 text-sm">Selecione princípios...</span>
          : value.map(code => (
            <span key={code} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700"
              onClick={e => { e.stopPropagation(); toggle(code) }}>{code} ✕</span>
          ))}
        <ChevronDown className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
      </div>
      {open && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input className="form-input text-sm py-1.5" placeholder="Buscar..." value={search}
              onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
          </div>
          <div className="overflow-y-auto flex-1">
            {['GISTM','TSM'].map(std => (
              <div key={std}>
                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">{std}</div>
                {filtered.filter(p => p.standard === std).map(p => (
                  <div key={p.code} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 ${value.includes(p.code) ? 'bg-brand-50' : ''}`}
                    onClick={() => toggle(p.code)}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${value.includes(p.code) ? 'bg-brand-600' : 'border-2 border-gray-300'}`}>
                      {value.includes(p.code) && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <span className="text-sm text-gray-700">{p.code}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-100 flex justify-between">
            <button className="text-xs text-gray-400" onClick={() => onChange([])}>Limpar</button>
            <button className="text-xs text-brand-600 font-semibold" onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal de Reavaliação ──────────────────────────────────────
function ReassessmentModal({ action, cycleId, facilityIds, onClose, onComplete }: {
  action: any; cycleId: string; facilityIds: string[]; onClose: () => void; onComplete: () => void
}) {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [globalScore, setGlobalScore] = useState('')
  const [globalText, setGlobalText] = useState('')
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [expandedReq, setExpandedReq] = useState<string | null>(null)

  // Estado individual por requisito
  const [overrides, setOverrides] = useState<Record<string, { score: string; text: string; responseText: string }>>({})

  // Busca requisitos vinculados aos princípios da ação
  const { data: requirements, isLoading } = useQuery({
    queryKey: ['action-requirements', action.principle_codes, cycleId, facilityIds.join(',')],
    enabled: !!(action.principle_codes?.length) && !!cycleId && facilityIds.length > 0,
    queryFn: async () => {
      // Busca os princípios pelo código
      const { data: principles } = await supabase.from('gistm_principles')
        .select('id, code, number, title')
        .in('code', action.principle_codes ?? [])

      if (!principles?.length) return []

      // Busca requisitos desses princípios
      const principleIds = principles.map((p: any) => p.id)
      const { data: reqs } = await supabase.from('gistm_requirements')
        .select('id, code, description, guidance, principle_id, weight')
        .in('principle_id', principleIds)
        .order('display_order')

      // Busca respostas existentes no ciclo, em TODAS as barragens em escopo da ação
      const reqIds = (reqs ?? []).map((r: any) => r.id)
      const { data: responses } = reqIds.length > 0
        ? await supabase.from('requirement_responses')
            .select('id, requirement_id, facility_id, status, implementation_text, hidrobr_assessments(id, score, score_value, assessment_text)')
            .eq('cycle_id', cycleId)
            .in('facility_id', facilityIds)
            .in('requirement_id', reqIds)
        : { data: [] }

      // responsesByFacility[requirement_id] = Map<facility_id, response>
      const responsesByFacility = new Map<string, Map<string, any>>()
      ;(responses ?? []).forEach((r: any) => {
        if (!responsesByFacility.has(r.requirement_id)) responsesByFacility.set(r.requirement_id, new Map())
        responsesByFacility.get(r.requirement_id)!.set(r.facility_id, r)
      })
      const principleMap = new Map((principles ?? []).map((p: any) => [p.id, p]))

      return (reqs ?? []).map((req: any) => {
        const byFacility = responsesByFacility.get(req.id) ?? new Map()
        // resposta "representativa" (primeira barragem com dado) só para mostrar um preview no formulário
        const response = facilityIds.map((fid: string) => byFacility.get(fid)).find(Boolean) ?? null
        return {
          ...req,
          principle: principleMap.get(req.principle_id),
          response,
          responsesByFacility: byFacility,
        }
      })
    },
  })

  // Inicializa overrides quando carregam
  function getReqState(req: any) {
    if (overrides[req.id]) return overrides[req.id]
    const existing = req.response?.hidrobr_assessments?.[0]
    return {
      score: existing?.score ?? globalScore,
      text: existing?.assessment_text ?? globalText,
      responseText: req.response?.implementation_text ?? '',
    }
  }

  function setOverride(reqId: string, field: 'score' | 'text' | 'responseText', val: string) {
    setOverrides(prev => ({
      ...prev,
      [reqId]: { ...getReqState({ id: reqId, response: requirements?.find((r: any) => r.id === reqId)?.response }), [field]: val },
    }))
  }

  // Aplica score/texto global para todos que não têm override individual
  function applyGlobalToAll() {
    const newOverrides: Record<string, any> = {}
    ;(requirements ?? []).forEach((req: any) => {
      const current = overrides[req.id] || {}
      newOverrides[req.id] = {
        responseText: current.responseText ?? req.response?.implementation_text ?? '',
        score: current.score || globalScore,
        text: current.text || globalText,
      }
    })
    setOverrides(newOverrides)
  }

  async function handleSubmit() {
    if (!globalScore && !Object.values(overrides).some(o => o.score)) {
      setErrMsg('Selecione uma classificação para publicar as avaliações.')
      return
    }
    setSaving(true); setErrMsg('')
    try {
      for (const req of (requirements ?? [])) {
        const state = { ...getReqState(req), ...overrides[req.id] }
        const finalScore = state.score || globalScore
        const finalText = (state.text || globalText).trim()
        if (!finalScore || finalText.length < 10) continue

        const newStatus = ['fully_conforming', 'conforming'].includes(finalScore) ? 'approved' : 'needs_revision'
        const scoreValue = SCORE_OPTIONS.find(s => s.key === finalScore)?.value ?? 0

        // Aplica a mesma classificação/parecer em cada barragem em escopo da ação
        for (const facilityId of facilityIds) {
          const existing = req.responsesByFacility?.get(facilityId)
          let responseId = existing?.id

          if (!responseId) {
            const { data: newResp, error: respErr } = await supabase
              .from('requirement_responses').insert({
                cycle_id: cycleId,
                facility_id: facilityId,
                requirement_id: req.id,
                implementation_text: state.responseText || 'Atendimento vinculado ao plano de ação.',
                status: newStatus,
                submitted_at: new Date().toISOString(),
              }).select('id').single()
            if (respErr) throw new Error(`Erro ao criar resposta ${req.code}: ${respErr.message}`)
            responseId = newResp.id
          } else {
            await supabase.from('requirement_responses').update({
              status: newStatus,
              implementation_text: state.responseText || existing?.implementation_text || 'Atendimento vinculado ao plano de ação.',
              updated_at: new Date().toISOString(),
            }).eq('id', responseId)
          }

          // Upsert da avaliação
          await supabase.from('hidrobr_assessments').upsert({
            response_id: responseId,
            assessed_by: profile!.id,
            score: finalScore,
            score_value: scoreValue,
            assessment_text: finalText,
            published_at: new Date().toISOString(),
          }, { onConflict: 'response_id' })
        }
      }

      // Marca ação como concluída
      await supabase.from('action_items').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', action.id)

      qc.invalidateQueries({ queryKey: ['action-items'] })
      qc.invalidateQueries({ queryKey: ['requirements-v3'] })
      qc.invalidateQueries({ queryKey: ['dashboard-v3'] })
      onComplete()
    } catch (e: any) {
      setErrMsg(e.message ?? 'Erro ao publicar avaliações')
    } finally {
      setSaving(false)
    }
  }

  const reqs = requirements ?? []
  const noPrinciples = !action.principle_codes?.length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">Concluir ação e registrar avaliação GISTM</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{action.summary ?? action.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {errMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{errMsg}</div>
          )}

          {!noPrinciples && facilityIds.length > 1 && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-xs text-brand-700">
              A classificação publicada aqui será aplicada às {facilityIds.length} barragens vinculadas a esta ação.
            </div>
          )}

          {noPrinciples ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Esta ação não tem princípios GISTM vinculados. Ela será marcada como concluída sem registrar avaliações.
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-3 text-gray-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
              <span className="text-sm">Carregando requisitos vinculados...</span>
            </div>
          ) : (
            <>
              {/* Classificação em lote */}
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                <div className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-3">
                  Avaliação em lote — aplica para todos os {reqs.length} requisitos
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {SCORE_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => setGlobalScore(opt.key)}
                      className={`p-2.5 rounded-xl text-xs font-semibold text-center border-2 transition-all ${globalScore === opt.key ? 'border-current scale-[1.02] shadow-sm' : 'border-transparent hover:opacity-90'}`}
                      style={{ color: opt.color, background: opt.bg }}>
                      {opt.value === 100 ? '⭐ ' : opt.value === 75 ? '✅ ' : opt.value === 50 ? '⚠️ ' : '❌ '}
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <textarea className="form-input resize-none flex-1 text-sm" rows={2}
                    placeholder="Parecer técnico geral (será aplicado a todos os requisitos sem edição individual)..."
                    value={globalText} onChange={e => setGlobalText(e.target.value)} />
                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: globalScore && globalText ? '#002B3D' : '#9CA3AF', color: 'white', border: 'none', cursor: globalScore && globalText ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                    onClick={applyGlobalToAll} disabled={!globalScore || !globalText}>
                    Aplicar<br/>a todos
                  </button>
                </div>
              </div>

              {/* Lista de requisitos */}
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {reqs.length} requisitos vinculados — clique para editar individualmente
                </div>
                <div className="space-y-2">
                  {reqs.map((req: any) => {
                    const state = { ...getReqState(req), ...overrides[req.id] }
                    const reqScore = state.score || globalScore
                    const reqText = state.text || globalText
                    const scoreOpt = SCORE_OPTIONS.find(s => s.key === reqScore)
                    const isExpanded = expandedReq === req.id
                    const hasIndividualOverride = !!overrides[req.id]?.score || !!overrides[req.id]?.text
                    const existingAssessment = req.response?.hidrobr_assessments?.[0]

                    return (
                      <div key={req.id} className={`border rounded-xl overflow-hidden transition-all ${hasIndividualOverride ? 'border-brand-300' : 'border-gray-200'}`}>
                        {/* Row header */}
                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedReq(isExpanded ? null : req.id)}>
                          <span className="text-[11px] font-bold text-gray-400 font-mono w-8 flex-shrink-0">{req.code}</span>
                          <p className="text-xs text-gray-600 flex-1 line-clamp-1">{req.description}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {existingAssessment && !hasIndividualOverride && (
                              <span className="text-[10px] text-gray-400">já avaliado</span>
                            )}
                            {reqScore && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ color: scoreOpt?.color, background: scoreOpt?.bg }}>
                                {scoreOpt?.value}pts
                              </span>
                            )}
                            {hasIndividualOverride && (
                              <span className="text-[10px] text-brand-600 font-semibold">editado</span>
                            )}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                          </div>
                        </div>

                        {/* Formulário expandido */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Requisito oficial</div>
                              <p className="text-xs text-gray-600 leading-relaxed">{req.description}</p>
                              {req.guidance && <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">{req.guidance}</p>}
                            </div>

                            <div>
                              <label className="form-label text-xs">Texto do atendimento (resposta do cliente)</label>
                              <textarea className="form-input resize-none text-sm" rows={2}
                                placeholder="Como este requisito é atendido..."
                                value={state.responseText}
                                onChange={e => setOverride(req.id, 'responseText', e.target.value)} />
                            </div>

                            <div>
                              <label className="form-label text-xs">Classificação individual</label>
                              <div className="grid grid-cols-4 gap-1.5">
                                {SCORE_OPTIONS.map(opt => (
                                  <button key={opt.key}
                                    onClick={() => setOverride(req.id, 'score', opt.key)}
                                    className={`p-2 rounded-lg text-xs font-semibold text-center border-2 transition-all ${(overrides[req.id]?.score || '') === opt.key ? 'border-current' : 'border-transparent'}`}
                                    style={{ color: opt.color, background: opt.bg }}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="form-label text-xs">Parecer individual</label>
                              <textarea className="form-input resize-none text-sm" rows={2}
                                placeholder="Parecer específico para este requisito..."
                                value={state.text || ''}
                                onChange={e => setOverride(req.id, 'text', e.target.value)} />
                            </div>

                            {hasIndividualOverride && (
                              <button className="text-xs text-gray-400 hover:text-gray-600"
                                onClick={() => setOverrides(prev => { const n = {...prev}; delete n[req.id]; return n })}>
                                Remover edição individual (usar avaliação em lote)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500">
            {noPrinciples
              ? 'A ação será marcada como concluída'
              : `${reqs.length} requisitos · avaliação em lote ou individual`}
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                background: saving ? '#9CA3AF' : '#059669', color: 'white', border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Publicando...</>
                : <><CheckCircle2 className="w-4 h-4" /> Concluir ação e publicar avaliações</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal de criação/edição de ação ───────────────────────────
function ActionModal({ defaultOrgId, item, onClose }: { defaultOrgId: string; item?: any; onClose: () => void }) {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const qc = useQueryClient()
  const [form, setForm] = useState({
    organization_id: item?.organization_id ?? defaultOrgId,
    summary: item?.summary ?? item?.title ?? '',
    description: item?.description ?? '',
    priority: item?.priority ?? 'medium',
    status: item?.status ?? 'open',
    due_date: item?.due_date ?? '',
    facility_ids: item?.facility_ids ?? [],
    principle_codes: item?.principle_codes ?? [],
    estimated_gain: item?.estimated_gain ?? 0,
  })
  const [error, setError] = useState('')

  const { data: orgs } = useQuery({
    queryKey: ['orgs-for-action'],
    enabled: hb,
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id,name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const { data: facilities } = useQuery({
    queryKey: ['facilities-for-action', form.organization_id],
    enabled: !!form.organization_id,
    queryFn: async () => {
      const { data } = await supabase.from('tailings_facilities')
        .select('id,name').eq('organization_id', form.organization_id).eq('is_active', true).order('name')
      return data ?? []
    },
  })

  // Busca ciclo ativo da organização para calcular potencial de ganho
  const { data: gainData } = useQuery({
    queryKey: ['gain-potential', form.organization_id, form.principle_codes],
    enabled: !!form.organization_id && form.principle_codes.length > 0,
    queryFn: async () => {
      // Busca ciclo ativo da organização
      const { data: cycles } = await supabase.from('assessment_cycles')
        .select('id, facility_id, facility_ids').eq('organization_id', form.organization_id).eq('status', 'active').limit(1)
      const cycle = cycles?.[0]
      const cycleId = cycle?.id
      if (!cycleId) return { maxGain: 0, breakdown: [], totalWeight: 0 }

      // Barragens em escopo: as selecionadas na ação, senão todas as barragens do ciclo
      const facilityIds = form.facility_ids.length > 0 ? form.facility_ids : cycleFacilityIds(cycle)

      // Busca princípios pelos códigos selecionados
      const { data: principles } = await supabase.from('gistm_principles')
        .select('id, code, number').in('code', form.principle_codes.filter((c: string) => !c.startsWith('TSM')))
      if (!principles?.length) return { maxGain: 0, breakdown: [], totalWeight: 0 }

      // Busca requisitos desses princípios
      const { data: reqs } = await supabase.from('gistm_requirements')
        .select('id, code, weight, principle_id').in('principle_id', principles.map((p: any) => p.id))

      // Busca respostas e avaliações existentes no ciclo, escopadas às barragens da ação
      const reqIds = (reqs ?? []).map((r: any) => r.id)
      const { data: responses } = reqIds.length > 0 && facilityIds.length > 0
        ? await supabase.from('requirement_responses')
            .select('id, requirement_id, facility_id, status').eq('cycle_id', cycleId).in('facility_id', facilityIds).in('requirement_id', reqIds)
        : { data: [] }
      const { data: assessments } = (responses ?? []).length > 0
        ? await supabase.from('hidrobr_assessments')
            .select('response_id, score, score_value').in('response_id', (responses ?? []).map((r: any) => r.id))
        : { data: [] }

      // Busca peso total de todos os 77 requisitos (denominador do score)
      const { data: allReqs } = await supabase.from('gistm_requirements').select('weight')
      const totalWeight = (allReqs ?? []).reduce((s: number, r: any) => s + (Number(r.weight) || 1), 0)

      // Score do requisito = pior caso (mínimo) entre as barragens em escopo (mesma regra do dashboard)
      const assessMap = new Map((assessments ?? []).map((a: any) => [a.response_id, a]))
      const { clientScoreByRequirement } = buildRequirementScoreMaps(facilityIds, responses ?? [], assessMap)
      const principleMap = new Map((principles ?? []).map((p: any) => [p.id, p]))

      let maxGainPoints = 0
      const breakdown: any[] = []

      ;(reqs ?? []).forEach((req: any) => {
        const w = Number(req.weight) || 1
        const currentScore = clientScoreByRequirement.get(req.id) ?? 0
        const gap = (100 - currentScore) * w // pontos que faltam, ponderados
        maxGainPoints += gap
        const principle = principleMap.get(req.principle_id)
        breakdown.push({
          code: req.code,
          principleCode: principle?.code ?? '',
          currentScore,
          weight: w,
          gap: Math.round(gap),
        })
      })

      // Converte para % do score global
      const maxGain = totalWeight > 0 ? Math.round((maxGainPoints / totalWeight) * 100) / 100 : 0

      return { maxGain: Math.min(100, maxGain), breakdown, totalWeight }
    },
  })

  function toggleFacility(id: string) {
    setForm(f => ({
      ...f,
      facility_ids: f.facility_ids.includes(id) ? f.facility_ids.filter((x: string) => x !== id) : [...f.facility_ids, id],
    }))
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.organization_id) throw new Error('Selecione uma organização')
      if (!form.summary) throw new Error('Informe o título da ação')
      const payload = {
        organization_id: form.organization_id,
        summary: form.summary,
        title: form.summary,
        description: form.description,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        facility_ids: form.facility_ids,
        principle_codes: form.principle_codes,
        estimated_gain: form.estimated_gain || 0,
        updated_at: new Date().toISOString(),
      }
      if (item?.id) {
        const { error } = await supabase.from('action_items').update(payload).eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('action_items').insert({ ...payload, created_by: profile!.id })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['action-items'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const selectedOrg = orgs?.find((o: any) => o.id === form.organization_id)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">{item ? 'Editar ação' : 'Nova ação de melhoria'}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          {hb && (
            <div>
              <label className="form-label">Organização cliente *</label>
              <select className="form-input" value={form.organization_id}
                onChange={e => setForm({ ...form, organization_id: e.target.value, facility_ids: [] })}>
                <option value="">Selecione...</option>
                {(orgs ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          {hb && selectedOrg && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">{selectedOrg.name}</span>
            </div>
          )}
          <div>
            <label className="form-label">Ação resumida *</label>
            <input className="form-input" placeholder="Ex: Elaborar PAE conforme Portaria 70.389/2017"
              value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Detalhamento da ação</label>
            <textarea className="form-input resize-none" rows={3}
              placeholder="Descreva o que deve ser feito, como, por quem e os critérios de conclusão..."
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Prioridade</label>
              <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS_ACTION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Prazo</label>
              <input type="date" className="form-input" value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="form-label">Estruturas associadas <span className="text-gray-400 font-normal">(uma ou mais barragens)</span></label>
            {!form.organization_id ? (
              <div className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg p-3">{hb ? 'Selecione uma organização primeiro' : 'Nenhuma barragem disponível'}</div>
            ) : (facilities ?? []).length === 0 ? (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Nenhuma barragem cadastrada para esta organização</div>
            ) : (
              <div className="space-y-2">
                {(facilities ?? []).map((f: any) => {
                  const selected = form.facility_ids.includes(f.id)
                  return (
                    <div key={f.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${selected ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
                      onClick={() => toggleFacility(f.id)}>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 ${selected ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                        {selected && <span className="text-white text-[11px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{f.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <label className="form-label">Princípios/Requisitos vinculados <span className="text-gray-400 font-normal">(GISTM e/ou TSM)</span></label>
            <PrincipleSelector value={form.principle_codes} onChange={v => setForm({ ...form, principle_codes: v })} />
          </div>
          {/* Calculadora de ganho */}
          <div className="border border-brand-200 rounded-xl p-4 bg-brand-50">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-brand-700 uppercase tracking-wider">
                Ganho estimado de aderência
              </label>
              {gainData && gainData.maxGain > 0 && (
                <span className="text-[10px] font-semibold text-brand-600 bg-white border border-brand-200 px-2 py-0.5 rounded-full">
                  Potencial máximo: +{gainData.maxGain.toFixed(1)}%
                </span>
              )}
            </div>

            {form.principle_codes.length === 0 ? (
              <p className="text-xs text-brand-600">Selecione os princípios vinculados para calcular o potencial de ganho automaticamente.</p>
            ) : !gainData ? (
              <div className="flex items-center gap-2 text-xs text-brand-600">
                <Loader2 className="w-3 h-3 animate-spin" /> Calculando potencial...
              </div>
            ) : gainData.maxGain === 0 ? (
              <p className="text-xs text-brand-600">Todos os requisitos desses princípios já estão conformes. Ganho potencial: 0%.</p>
            ) : (
              <div className="space-y-3">
                {/* Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-brand-700">Ajuste a estimativa realista</span>
                    <span className="text-sm font-bold text-brand-700">+{form.estimated_gain.toFixed(1)}%</span>
                  </div>
                  <input
                    type="range" min="0" max={Math.ceil(gainData.maxGain * 10) / 10}
                    step="0.1" className="w-full"
                    value={form.estimated_gain}
                    onChange={e => setForm({ ...form, estimated_gain: parseFloat(e.target.value) })}
                  />
                  <div className="flex justify-between text-[10px] text-brand-500 mt-0.5">
                    <span>0%</span>
                    <span className="text-brand-400">Potencial máximo: +{gainData.maxGain.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Detalhamento por princípio */}
                <div className="bg-white border border-brand-200 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Requisitos pendentes dos princípios selecionados
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {gainData.breakdown.filter((r: any) => r.gap > 0).slice(0, 10).map((r: any) => (
                      <div key={r.code} className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-gray-400 w-8 flex-shrink-0">{r.code}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-400 rounded-full" style={{ width: `${r.currentScore}%` }} />
                        </div>
                        <span className="text-gray-500 w-10 text-right">{r.currentScore}pts</span>
                        <span className="text-emerald-600 w-12 text-right font-semibold">+{(r.gap / gainData.totalWeight * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                    {gainData.breakdown.filter((r: any) => r.gap > 0).length > 10 && (
                      <div className="text-[10px] text-gray-400 text-center pt-1">
                        +{gainData.breakdown.filter((r: any) => r.gap > 0).length - 10} requisitos adicionais
                      </div>
                    )}
                    {gainData.breakdown.filter((r: any) => r.gap === 0).length > 0 && (
                      <div className="text-[10px] text-emerald-600 mt-1">
                        ✓ {gainData.breakdown.filter((r: any) => r.gap === 0).length} requisitos já conformes
                      </div>
                    )}
                  </div>
                </div>

                {/* Contexto */}
                <p className="text-[11px] text-brand-600">
                  Se esta ação resolver <strong>{form.estimated_gain > 0 ? Math.round((form.estimated_gain / gainData.maxGain) * 100) : 0}%</strong> do potencial identificado,
                  o score global pode subir de <strong>{'{'}score atual{'}'}</strong> para <strong>{'{'}score atual + {form.estimated_gain.toFixed(1)}%{'}'}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: mut.isPending || !form.summary || !form.organization_id ? '#9CA3AF' : '#002B3D', color: 'white', border: 'none', cursor: mut.isPending || !form.summary || !form.organization_id ? 'not-allowed' : 'pointer' }}
            onClick={() => mut.mutate()} disabled={mut.isPending || !form.summary || !form.organization_id}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {item ? 'Salvar alterações' : 'Criar ação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card de ação ──────────────────────────────────────────────
function ActionCard({ action, onEdit, onComplete }: { action: any; onEdit: () => void; onComplete: () => void }) {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const qc = useQueryClient()
  const p = PRIORITY[action.priority] ?? PRIORITY.medium
  const s = STATUS_ACTION[action.status] ?? STATUS_ACTION.open
  const overdue = action.status !== 'completed' && action.due_date && new Date(action.due_date) < new Date()

  const { data: facilities } = useQuery({
    queryKey: ['facilities-names', (action.facility_ids ?? []).join(',')],
    enabled: (action.facility_ids?.length ?? 0) > 0,
    queryFn: async () => {
      const { data } = await supabase.from('tailings_facilities').select('id,name').in('id', action.facility_ids)
      return data ?? []
    },
  })
  const { data: org } = useQuery({
    queryKey: ['org-name', action.organization_id],
    enabled: !!action.organization_id && hb,
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('name').eq('id', action.organization_id).single()
      return data
    },
  })

  const deleteMut = useMutation({
    mutationFn: async () => supabase.from('action_items').delete().eq('id', action.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items'] }),
  })

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-brand-600">#{action.action_id ?? '—'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900 leading-snug">{action.summary ?? action.title}</h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`badge text-[10px] ${p.cls}`}>{p.label}</span>
              <span className={`badge text-[10px] ${s.cls}`}>{s.label}</span>
            </div>
          </div>
          {action.description && <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{action.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
            {hb && org && <span className="font-semibold text-brand-600">🏢 {org.name}</span>}
            {action.due_date && <span className={overdue ? 'text-red-600 font-semibold' : ''}>{overdue ? '⚠ ' : '📅 '}Prazo: {new Date(action.due_date).toLocaleDateString('pt-BR')}</span>}
            {(facilities?.length ?? 0) > 0 && <span>🏔️ {facilities!.map((f: any) => f.name).join(', ')}</span>}
            {(action.principle_codes?.length ?? 0) > 0 && <span>📋 {action.principle_codes.join(', ')}</span>}
            {(action.estimated_gain ?? 0) > 0 && <span className="text-emerald-600 font-semibold">📈 +{action.estimated_gain}%</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
        {action.status !== 'completed' && (
          <button
            className="text-xs text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg font-semibold transition-colors inline-flex items-center gap-1.5"
            onClick={onComplete}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
          </button>
        )}
        <button className="text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-semibold transition-colors" onClick={onEdit}>✏️ Editar</button>
        <button className="text-xs text-red-400 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          onClick={() => { if (confirm('Remover esta ação?')) deleteMut.mutate() }}>🗑️</button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export function ActionPlanPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const [filter, setFilter] = useState('all')
  const [filterOrg, setFilterOrg] = useState('')
  const [filterPrinciple, setFilterPrinciple] = useState('')
  const [modal, setModal] = useState<any>(null)
  const [completing, setCompleting] = useState<any>(null) // ação sendo concluída
  const orgId = profile?.organization_id ?? ''

  // Busca ciclo ativo para o modal de reavaliação
  const { data: activeCycle } = useQuery({
    queryKey: ['active-cycle-for-action', orgId, hb],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from('assessment_cycles').select('id,name,facility_id,facility_ids').eq('status', 'active').order('created_at', { ascending: false }).limit(1)
      if (!hb && orgId) q = q.eq('organization_id', orgId)
      const { data } = await q
      return data?.[0] ?? null
    },
  })

  const { data: orgs } = useQuery({
    queryKey: ['orgs-for-filter'],
    enabled: hb,
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id,name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['action-items', orgId, hb],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from('action_items').select('*').order('created_at', { ascending: false })
      if (!hb && orgId) q = q.eq('organization_id', orgId)
      const { data } = await q
      return data ?? []
    },
  })

  const filtered = (data ?? []).filter((a: any) => {
    if (filter !== 'all' && a.status !== filter) return false
    if (filterOrg && a.organization_id !== filterOrg) return false
    if (filterPrinciple && !(a.principle_codes ?? []).includes(filterPrinciple)) return false
    return true
  })

  const all = data ?? []
  const kpis = {
    total: all.length,
    open: all.filter((a: any) => a.status === 'open').length,
    inProgress: all.filter((a: any) => a.status === 'in_progress').length,
    completed: all.filter((a: any) => a.status === 'completed').length,
    totalGain: all.filter((a: any) => !['completed','cancelled'].includes(a.status))
      .reduce((s: number, a: any) => s + (Number(a.estimated_gain) || 0), 0),
  }

  // Busca ciclo da ação sendo concluída (para HIDROBR que pode ter múltiplos clientes)
  const { data: completingCycle } = useQuery({
    queryKey: ['cycle-for-completing', completing?.organization_id],
    enabled: !!completing?.organization_id,
    queryFn: async () => {
      const { data } = await supabase.from('assessment_cycles')
        .select('id,name,facility_id,facility_ids').eq('status', 'active').eq('organization_id', completing.organization_id)
        .order('created_at', { ascending: false }).limit(1)
      return data?.[0] ?? null
    },
  })

  const cycleForReassess = completing ? (completingCycle?.id ?? activeCycle?.id ?? '') : ''
  const reassessCycleObj = completing ? (completingCycle ?? activeCycle ?? null) : null
  const facilityIdsForReassess = completing
    ? ((completing.facility_ids?.length ? completing.facility_ids : cycleFacilityIds(reassessCycleObj)))
    : []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plano de Ação</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ações de melhoria com rastreabilidade por cliente, barragem e princípio</p>
        </div>
        <button
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
          onClick={() => setModal({})}>
          <Plus className="w-4 h-4" /> Nova ação
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: kpis.total, color: '#0A9396' },
          { label: 'Abertas', value: kpis.open, color: '#3B82F6' },
          { label: 'Em andamento', value: kpis.inProgress, color: '#8B5CF6' },
          { label: 'Concluídas', value: kpis.completed, color: '#059669' },
          { label: 'Ganho estimado', value: `+${Math.round(kpis.totalGain)}%`, color: '#059669' },
        ].map(k => (
          <div key={k.label} className="card p-3 text-center" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="flex gap-2 flex-wrap">
          {[['all','Todas'],['open','Abertas'],['in_progress','Em andamento'],['completed','Concluídas']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter===v?'bg-brand-900 text-white border-brand-900':'bg-white text-gray-600 border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        {hb && (
          <select className="form-input w-48 text-xs" value={filterOrg} onChange={e => setFilterOrg(e.target.value)}>
            <option value="">Todos os clientes</option>
            {(orgs ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select className="form-input w-44 text-xs" value={filterPrinciple} onChange={e => setFilterPrinciple(e.target.value)}>
          <option value="">Todos os princípios</option>
          <optgroup label="GISTM">{GISTM_PRINCIPLES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}</optgroup>
          <optgroup label="TSM">{TSM_PRINCIPLES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}</optgroup>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando...</span></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Nenhuma ação encontrada</p>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '13px', fontWeight: '600', background: '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={() => setModal({})}>Criar primeira ação</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((action: any) => (
            <ActionCard
              key={action.id}
              action={action}
              onEdit={() => setModal(action)}
              onComplete={() => setCompleting(action)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <ActionModal defaultOrgId={orgId} item={Object.keys(modal).length > 0 ? modal : undefined} onClose={() => setModal(null)} />
      )}

      {completing && cycleForReassess && (
        <ReassessmentModal
          action={completing}
          cycleId={cycleForReassess}
          facilityIds={facilityIdsForReassess}
          onClose={() => setCompleting(null)}
          onComplete={() => setCompleting(null)}
        />
      )}
    </div>
  )
}
