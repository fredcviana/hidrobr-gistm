// src/features/settings/AssessmentFormEditor.tsx
// Editor do formulário Self Assessment — aba dentro de Config. Padrões
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, CheckCircle2, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const TOPIC_META: Record<string, { title: string; color: string; icon: string }> = {
  T1: { title: 'Comunidades Afetadas',           color: '#1B4F72', icon: '👥' },
  T2: { title: 'Base de Conhecimentos',          color: '#117A65', icon: '📚' },
  T3: { title: 'Projeto, Construção e Operação', color: '#7D6608', icon: '🏗️' },
  T4: { title: 'Gestão e Governança',            color: '#6E2F1A', icon: '🏛️' },
  T5: { title: 'Resposta a Emergências',         color: '#922B21', icon: '🚨' },
  T6: { title: 'Divulgação Pública',             color: '#1A5276', icon: '📢' },
}

// ── Editor de configurações globais ──────────────────────────
function GlobalConfigEditor() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-global-config'],
    queryFn: async () => {
      const { data } = await supabase.from('assessment_form_config').select('*').eq('id', 1).single()
      return data
    },
  })

  const [form, setForm] = useState<any>(null)

  // Inicializa form quando data carrega
  if (data && !form) {
    setForm({
      contact_email: data.contact_email,
      form_title: data.form_title,
      form_subtitle: data.form_subtitle,
      cta_text: data.cta_text,
      privacy_text: data.privacy_text,
      scale_labels: data.scale_labels,
    })
  }

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assessment_form_config')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      qc.invalidateQueries({ queryKey: ['assessment-form-config'] })
      qc.invalidateQueries({ queryKey: ['assessment-global-config'] })
    },
  })

  if (isLoading || !form) return <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>

  return (
    <div className="space-y-5">
      {/* Link do formulário */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700">Link público do formulário</div>
          <div className="text-xs text-brand-500 mt-0.5 font-mono">{window.location.origin}/assessment</div>
        </div>
        <a href="/assessment" target="_blank"
          className="inline-flex items-center gap-1.5 text-xs text-brand-600 border border-brand-300 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors font-semibold">
          <ExternalLink className="w-3.5 h-3.5" /> Visualizar
        </a>
      </div>

      {/* Configurações gerais */}
      <div className="space-y-4">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Textos do formulário</div>

        <div>
          <label className="form-label">E-mail de contato (botão CTA)</label>
          <input className="form-input" value={form.contact_email}
            onChange={e => setForm({...form, contact_email: e.target.value})}
            placeholder="comercial@hidrobr.com" />
        </div>
        <div>
          <label className="form-label">Título do formulário</label>
          <input className="form-input" value={form.form_title}
            onChange={e => setForm({...form, form_title: e.target.value})} />
        </div>
        <div>
          <label className="form-label">Subtítulo / descrição</label>
          <textarea className="form-input resize-none" rows={3} value={form.form_subtitle}
            onChange={e => setForm({...form, form_subtitle: e.target.value})} />
        </div>
        <div>
          <label className="form-label">Texto do botão CTA (resultado)</label>
          <input className="form-input" value={form.cta_text}
            onChange={e => setForm({...form, cta_text: e.target.value})}
            placeholder="Falar com um consultor" />
        </div>
        <div>
          <label className="form-label">Texto de privacidade</label>
          <textarea className="form-input resize-none" rows={2} value={form.privacy_text}
            onChange={e => setForm({...form, privacy_text: e.target.value})} />
        </div>
      </div>

      {/* Escala de avaliação */}
      <div className="space-y-3">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Escala de avaliação (4 níveis)</div>
        {(form.scale_labels ?? []).map((opt: any, idx: number) => {
          const colors = ['#DC2626','#D97706','#2563EB','#059669']
          return (
            <div key={idx} className="border border-gray-200 rounded-xl p-4" style={{ borderLeftColor: colors[idx], borderLeftWidth: 3 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: colors[idx] }}>{opt.value}</div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nível {idx + 1}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Rótulo principal</label>
                  <input className="form-input text-sm" value={opt.label}
                    onChange={e => {
                      const updated = [...form.scale_labels]
                      updated[idx] = { ...updated[idx], label: e.target.value }
                      setForm({ ...form, scale_labels: updated })
                    }} />
                </div>
                <div>
                  <label className="form-label text-xs">Descrição secundária</label>
                  <input className="form-input text-sm" value={opt.sublabel}
                    onChange={e => {
                      const updated = [...form.scale_labels]
                      updated[idx] = { ...updated[idx], sublabel: e.target.value }
                      setForm({ ...form, scale_labels: updated })
                    }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: mut.isPending ? '#9CA3AF' : '#002B3D', color: 'white', border: 'none', cursor: mut.isPending ? 'not-allowed' : 'pointer' }}
          onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar configurações</>}
        </button>
      </div>
    </div>
  )
}

// ── Editor de princípios ──────────────────────────────────────
function PrinciplesEditor() {
  const qc = useQueryClient()
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<number, any>>({})

  const { data: principles, isLoading } = useQuery({
    queryKey: ['assessment-principles-edit'],
    queryFn: async () => {
      const { data } = await supabase.from('assessment_form_principles')
        .select('*').order('display_order')
      return data ?? []
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const { error } = await supabase.from('assessment_form_principles')
        .update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-principles-edit'] }),
  })

  async function savePrinciple(p: any) {
    const edit = edits[p.id]
    if (!edit) return
    setSavingId(p.id)
    try {
      const { error } = await supabase.from('assessment_form_principles')
        .update({ ...edit, updated_at: new Date().toISOString() }).eq('id', p.id)
      if (error) throw error
      setSavedId(p.id)
      setTimeout(() => setSavedId(null), 2500)
      setEditingId(null)
      qc.invalidateQueries({ queryKey: ['assessment-principles-edit'] })
      qc.invalidateQueries({ queryKey: ['assessment-form-config'] })
    } finally {
      setSavingId(null)
    }
  }

  if (isLoading) return <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>

  // Agrupa por tópico
  const topicCodes = [...new Set((principles ?? []).map((p: any) => p.topic_code))]

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        Princípios — {(principles ?? []).filter((p: any) => p.is_active).length} de {(principles ?? []).length} ativos no formulário
      </div>

      {topicCodes.map(tc => {
        const topic = TOPIC_META[tc as string] ?? { title: tc, color: '#0A9396', icon: '📋' }
        const tPrinciples = (principles ?? []).filter((p: any) => p.topic_code === tc)
        return (
          <div key={tc as string}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-base">{topic.icon}</span>
              <span className="text-xs font-bold" style={{ color: topic.color }}>{topic.title}</span>
            </div>
            <div className="space-y-2">
              {tPrinciples.map((p: any) => {
                const isEditing = editingId === p.id
                const edit = edits[p.id] ?? { question: p.question, description: p.description }

                return (
                  <div key={p.id} className={`border rounded-xl overflow-hidden transition-all ${!p.is_active ? 'opacity-50' : ''} ${isEditing ? 'border-brand-300' : 'border-gray-200'}`}>
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: topic.color + '15', color: topic.color }}>
                        {p.principle_code}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{p.question}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {savedId === p.id && <span className="text-[10px] text-emerald-600 font-semibold">✓ Salvo</span>}

                        {/* Toggle ativo/inativo */}
                        <button
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${p.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-400 border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                          onClick={() => toggleActive.mutate({ id: p.id, active: !p.is_active })}>
                          {p.is_active ? <><Eye className="w-3 h-3" /> Visível</> : <><EyeOff className="w-3 h-3" /> Oculto</>}
                        </button>

                        {/* Editar */}
                        <button
                          className="text-[11px] text-brand-600 border border-brand-200 hover:bg-brand-50 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                          onClick={() => {
                            if (isEditing) { setEditingId(null) } else {
                              setEdits({ ...edits, [p.id]: { question: p.question, description: p.description } })
                              setEditingId(p.id)
                            }
                          }}>
                          {isEditing ? 'Fechar' : '✏️ Editar'}
                        </button>
                      </div>
                    </div>

                    {/* Formulário de edição */}
                    {isEditing && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                        <div>
                          <label className="form-label text-xs">Pergunta (título curto)</label>
                          <input className="form-input text-sm" value={edit.question}
                            onChange={e => setEdits({ ...edits, [p.id]: { ...edit, question: e.target.value } })} />
                        </div>
                        <div>
                          <label className="form-label text-xs">Descrição detalhada</label>
                          <textarea className="form-input resize-none text-sm" rows={3} value={edit.description}
                            onChange={e => setEdits({ ...edits, [p.id]: { ...edit, description: e.target.value } })} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                          <button
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: savingId === p.id ? '#9CA3AF' : '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
                            onClick={() => savePrinciple(p)} disabled={savingId === p.id}>
                            {savingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Salvar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Componente exportado (usado como aba em StandardsSettingsPage) ──
export function AssessmentFormEditor() {
  const [tab, setTab] = useState<'config' | 'principles'>('config')

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        {[
          { id: 'config', label: '⚙️ Configurações gerais' },
          { id: 'principles', label: '📋 Perguntas e princípios' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' ? <GlobalConfigEditor /> : <PrinciplesEditor />}
    </div>
  )
}
