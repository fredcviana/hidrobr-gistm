// src/features/settings/StandardsSettingsPage.tsx
// Editor de padrões atualizado para nova hierarquia:
// Tópico > Princípio > Requisito
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Trash2, Save, Loader2, CheckCircle2, Settings, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

// ── Editor de requisito individual ────────────────────────────
function RequirementEditor({ req, topicColor, onSaved, onDeleted }: {
  req: any; topicColor: string; onSaved: () => void; onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState(req.description)
  const [guidance, setGuidance] = useState(req.guidance ?? '')
  const [weight, setWeight] = useState(req.weight)
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('gistm_requirements')
        .update({ description, guidance, weight, updated_at: new Date().toISOString() })
        .eq('id', req.id)
      if (error) throw error
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved() },
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('gistm_requirements').delete().eq('id', req.id)
      if (error) throw error
    },
    onSuccess: () => onDeleted(),
  })

  const dirty = description !== req.description || guidance !== (req.guidance ?? '') || weight !== req.weight

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2 bg-white">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="w-10 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: topicColor + '15', color: topicColor }}>
          {req.code}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 truncate">{description.slice(0, 80)}...</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-gray-400">Peso {weight}x</span>
          {dirty && <span className="badge bg-amber-50 text-amber-700 text-[10px]">Alterado</span>}
          {saved && <span className="badge bg-emerald-50 text-emerald-700 text-[10px] inline-flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />Salvo</span>}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
          <div>
            <label className="form-label">Descrição oficial do requisito *</label>
            <textarea className="form-input resize-none text-sm" rows={4}
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Orientação de atendimento</label>
            <textarea className="form-input resize-none text-sm" rows={3}
              placeholder="Como o cliente deve demonstrar o atendimento a este requisito..."
              value={guidance} onChange={e => setGuidance(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32">
              <label className="form-label">Peso no score</label>
              <select className="form-input" value={weight} onChange={e => setWeight(parseFloat(e.target.value))}>
                {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map(v => <option key={v} value={v}>{v}x</option>)}
              </select>
            </div>
            <div className="flex-1 flex justify-end gap-2 items-end pb-0.5">
              <button
                className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors border border-red-200"
                onClick={() => { if (confirm(`Remover requisito ${req.code}? Isso apagará todas as respostas associadas.`)) deleteMut.mutate() }}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Trash2 className="w-3 h-3 inline mr-1" />}
                Remover
              </button>
              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: dirty && !mut.isPending ? '#002B3D' : '#9CA3AF', color: 'white', border: 'none', cursor: dirty ? 'pointer' : 'not-allowed' }}
                onClick={() => mut.mutate()} disabled={mut.isPending || !dirty}>
                {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> :
                  saved ? <><CheckCircle2 className="w-3 h-3" />Salvo!</> :
                    <><Save className="w-3 h-3" />Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Editor de princípio ────────────────────────────────────────
function PrincipleEditor({ principle, topicColor, onSaved }: {
  principle: any; topicColor: string; onSaved: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(principle.title)
  const [saved, setSaved] = useState(false)
  const [addingReq, setAddingReq] = useState(false)
  const [newReqDesc, setNewReqDesc] = useState('')
  const [newReqGuidance, setNewReqGuidance] = useState('')

  const { data: requirements, refetch } = useQuery({
    queryKey: ['principle-reqs', principle.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from('gistm_requirements')
        .select('*').eq('principle_id', principle.id).order('display_order')
      return data ?? []
    },
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('gistm_principles')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', principle.id)
      if (error) throw error
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved() },
  })

  const addReqMut = useMutation({
    mutationFn: async () => {
      const maxOrder = Math.max(0, ...(requirements ?? []).map((r: any) => r.display_order))
      const nextNum = (requirements?.length ?? 0) + 1
      const code = `${principle.number}.${nextNum}`
      const { error } = await supabase.from('gistm_requirements').insert({
        principle_id: principle.id,
        code,
        description: newReqDesc,
        guidance: newReqGuidance || null,
        display_order: maxOrder + 1,
        weight: 1.0,
      })
      if (error) throw error
    },
    onSuccess: () => { setNewReqDesc(''); setNewReqGuidance(''); setAddingReq(false); refetch() },
  })

  const dirty = title !== principle.title

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white">
      {/* Header do princípio */}
      <div className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5"
          style={{ background: topicColor + '15', color: topicColor }}>
          {principle.number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{title}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {requirements?.length ?? '...'} requisitos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dirty && <span className="badge bg-amber-50 text-amber-700 text-[10px]">Alterado</span>}
          {saved && <span className="badge bg-emerald-50 text-emerald-700 text-[10px]">✓ Salvo</span>}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Editar título do princípio */}
          <div className="bg-brand-50 rounded-xl p-4">
            <label className="form-label">Título do princípio</label>
            <textarea className="form-input resize-none text-sm" rows={3}
              value={title} onChange={e => setTitle(e.target.value)} />
            <div className="flex justify-end mt-2">
              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: dirty ? '#002B3D' : '#9CA3AF', color: 'white', border: 'none', cursor: dirty ? 'pointer' : 'not-allowed' }}
                onClick={() => updateMut.mutate()} disabled={updateMut.isPending || !dirty}>
                {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Salvar título
              </button>
            </div>
          </div>

          {/* Lista de requisitos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Requisitos ({requirements?.length ?? 0})
              </div>
              <button
                className="text-xs text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center gap-1"
                onClick={() => setAddingReq(!addingReq)}
              >
                <Plus className="w-3 h-3" /> Novo requisito
              </button>
            </div>

            {(requirements ?? []).map((req: any) => (
              <RequirementEditor
                key={req.id}
                req={req}
                topicColor={topicColor}
                onSaved={() => refetch()}
                onDeleted={() => refetch()}
              />
            ))}

            {/* Formulário de novo requisito */}
            {addingReq && (
              <div className="border border-dashed border-brand-300 rounded-xl p-4 bg-brand-50 space-y-3 mt-2">
                <div className="text-xs font-bold text-brand-700 uppercase tracking-wider">Novo requisito</div>
                <div>
                  <label className="form-label">Descrição oficial *</label>
                  <textarea className="form-input resize-none text-sm" rows={4}
                    placeholder="Texto oficial do requisito conforme o padrão GISTM..."
                    value={newReqDesc} onChange={e => setNewReqDesc(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Orientação de atendimento</label>
                  <textarea className="form-input resize-none text-sm" rows={2}
                    placeholder="Como o cliente deve demonstrar o atendimento..."
                    value={newReqGuidance} onChange={e => setNewReqGuidance(e.target.value)} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="btn-secondary btn-sm" onClick={() => { setAddingReq(false); setNewReqDesc(''); setNewReqGuidance('') }}>
                    Cancelar
                  </button>
                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: newReqDesc.length > 20 ? '#002B3D' : '#9CA3AF', color: 'white', border: 'none', cursor: newReqDesc.length > 20 ? 'pointer' : 'not-allowed' }}
                    onClick={() => addReqMut.mutate()} disabled={addReqMut.isPending || newReqDesc.length < 20}>
                    {addReqMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Adicionar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab GISTM ─────────────────────────────────────────────────
function GistmTab() {
  const qc = useQueryClient()
  const [topicFilter, setTopicFilter] = useState<number | null>(null)

  const { data: topics } = useQuery({
    queryKey: ['gistm-topics-edit'],
    queryFn: async () => {
      const { data } = await supabase.from('gistm_topics').select('*').order('display_order')
      return data ?? []
    },
  })

  const { data: principles, isLoading } = useQuery({
    queryKey: ['gistm-principles-edit', topicFilter],
    queryFn: async () => {
      let q = supabase.from('gistm_principles').select('*').order('display_order')
      if (topicFilter) q = q.eq('topic_id', topicFilter)
      const { data } = await q
      return data ?? []
    },
  })

  const topicMap = new Map((topics ?? []).map((t: any) => [t.id, t]))

  return (
    <div>
      {/* Filtro por tópico */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setTopicFilter(null)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${!topicFilter ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200'}`}>
          Todos (15 princípios)
        </button>
        {(topics ?? []).map((t: any) => (
          <button key={t.id} onClick={() => setTopicFilter(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${topicFilter === t.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
            style={topicFilter === t.id ? { background: t.color_hex } : {}}>
            {t.code} — {t.title.split(',')[0].slice(0, 25)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-sm">Carregando princípios...</span>
        </div>
      ) : (
        (principles ?? []).map((p: any) => {
          const topic = topicMap.get(p.topic_id)
          return (
            <PrincipleEditor
              key={p.id}
              principle={p}
              topicColor={topic?.color_hex ?? '#0A9396'}
              onSaved={() => qc.invalidateQueries({ queryKey: ['gistm-principles-edit'] })}
            />
          )
        })
      )}
    </div>
  )
}

// ── Tab TSM ───────────────────────────────────────────────────
function TsmTab() {
  const { data: topics, isLoading } = useQuery({
    queryKey: ['tsm-topics-edit'],
    queryFn: async () => {
      const { data: std } = await supabase.from('assessment_standards').select('id').eq('code', 'TSM').single()
      if (!std) return []
      const { data } = await supabase.from('standard_topics').select('*').eq('standard_id', std.id).order('display_order')
      return data ?? []
    },
  })

  if (isLoading) return <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando...</span></div>

  if ((topics ?? []).length === 0) return (
    <div className="card p-10 text-center">
      <div className="text-4xl mb-3">🌱</div>
      <p className="text-gray-600 font-medium mb-2">Tabelas TSM não encontradas</p>
      <p className="text-gray-400 text-sm">Execute o SQL do TSM no Supabase primeiro.</p>
    </div>
  )

  return (
    <div>
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
        <p className="text-sm font-semibold text-green-800 mb-1">🌱 Towards Sustainable Mining (TSM)</p>
        <p className="text-xs text-green-600">Mining Association of Canada · 8 protocolos · 18 requisitos</p>
        <p className="text-xs text-green-500 mt-1">A edição de requisitos TSM estará disponível em breve.</p>
      </div>
      <div className="card divide-y divide-gray-50">
        {(topics ?? []).map((t: any) => (
          <div key={t.id} className="flex items-center gap-3 p-4">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color_hex ?? '#1B4F72' }} />
            <span className="text-sm font-semibold text-gray-700">{t.code}</span>
            <span className="text-sm text-gray-500">{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export function StandardsSettingsPage() {
  const { profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'gistm' | 'tsm'>('gistm')

  if (profile?.role !== 'hidrobr_admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurações de Padrões</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Edite títulos dos princípios, descrições e orientações dos requisitos GISTM e TSM
          </p>
        </div>
        <span className="badge bg-brand-50 text-brand-700 border border-brand-200 inline-flex items-center gap-1.5">
          <Settings className="w-3 h-3" /> hidrobr_admin
        </span>
      </div>

      {/* Tabs GISTM / TSM */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {[
          { id: 'gistm', label: '🏔️  GISTM', sub: '15 princípios · 77 requisitos · UNEP/PRI/ICMM' },
          { id: 'tsm', label: '🌱  TSM', sub: '18 requisitos · Mining Association of Canada' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as 'gistm' | 'tsm')}
            className={`px-5 py-2.5 rounded-lg transition-all text-left ${activeTab === tab.id ? 'bg-white shadow-sm' : 'hover:bg-gray-200/50'}`}>
            <div className={`text-sm font-bold ${activeTab === tab.id ? 'text-brand-700' : 'text-gray-500'}`}>{tab.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{tab.sub}</div>
          </button>
        ))}
      </div>

      {activeTab === 'gistm' ? <GistmTab /> : <TsmTab />}
    </div>
  )
}
