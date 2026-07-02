// src/features/settings/GistmSettingsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Trash2, Save, Loader2, CheckCircle2, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

interface SubReq { id: string; text: string }

function RequirementEditor({ req, onSaved }: { req: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(req.title)
  const [description, setDescription] = useState(req.description)
  const [guidance, setGuidance] = useState(req.guidance ?? '')
  const [weight, setWeight] = useState(req.weight)
  const [subs, setSubs] = useState<SubReq[]>(req.sub_requirements ?? [])
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('gistm_requirements')
        .update({ title, description, guidance, weight, sub_requirements: subs, updated_at: new Date().toISOString() })
        .eq('id', req.id)
      if (error) throw error
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved() },
  })

  function addSub() {
    const idx = subs.length
    const newId = `${req.code}-${String.fromCharCode(97 + idx)}`
    setSubs([...subs, { id: newId, text: '' }])
  }

  const dirty = title !== req.title || description !== req.description || guidance !== (req.guidance ?? '') ||
    weight !== req.weight || JSON.stringify(subs) !== JSON.stringify(req.sub_requirements ?? [])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white">
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: req.gistm_topics?.color_hex + '20', color: req.gistm_topics?.color_hex }}>
          {req.code}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{subs.length} subcritérios · Peso {weight} · {req.gistm_topics?.title}</div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="badge bg-amber-50 text-amber-700 text-[10px]">Não salvo</span>}
          {saved && <span className="badge bg-emerald-50 text-emerald-700 text-[10px] inline-flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Salvo</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <label className="form-label">Título *</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Peso no score</label>
              <select className="form-input" value={weight} onChange={e => setWeight(parseFloat(e.target.value))}>
                {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map(v => <option key={v} value={v}>{v}x</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Descrição do requisito *</label>
            <textarea className="form-input resize-none" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Orientação de implementação</label>
            <textarea className="form-input resize-none" rows={3}
              placeholder="Como o cliente deve implementar e documentar este requisito..."
              value={guidance} onChange={e => setGuidance(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Subcritérios (checklist)</label>
              <button onClick={addSub} className="btn-secondary btn-sm inline-flex items-center gap-1 text-xs">
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {subs.map((sub, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16 font-mono flex-shrink-0">{sub.id}</span>
                  <input className="form-input flex-1" value={sub.text}
                    onChange={e => { const u = [...subs]; u[i] = { ...u[i], text: e.target.value }; setSubs(u) }}
                    placeholder="Texto do subcritério..." />
                  <button onClick={() => setSubs(subs.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {subs.length === 0 && <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-lg">Nenhum subcritério. Clique em "Adicionar".</p>}
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button className="btn-primary btn-sm inline-flex items-center gap-1.5"
              onClick={() => mut.mutate()} disabled={mut.isPending || !dirty}>
              {mut.isPending ? <><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</> :
               saved ? <><CheckCircle2 className="w-3 h-3" /> Salvo!</> :
               <><Save className="w-3 h-3" /> Salvar alterações</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function GistmSettingsPage() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [topicFilter, setTopicFilter] = useState<number | null>(null)

  if (profile?.role !== 'hidrobr_admin') return <Navigate to="/dashboard" replace />

  const { data: topics } = useQuery({
    queryKey: ['gistm-topics'],
    queryFn: async () => { const { data } = await supabase.from('gistm_topics').select('*').order('display_order'); return data ?? [] },
  })

  const { data: requirements, isLoading } = useQuery({
    queryKey: ['gistm-req-edit', topicFilter],
    queryFn: async () => {
      let q = supabase.from('gistm_requirements').select('*, gistm_topics(code,title,color_hex)').order('display_order')
      if (topicFilter) q = q.eq('topic_id', topicFilter)
      const { data } = await q
      return data ?? []
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurações GISTM</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edite títulos, descrições, orientações e subcritérios dos 18 princípios</p>
        </div>
        <span className="badge bg-brand-50 text-brand-700 border border-brand-200 inline-flex items-center gap-1.5">
          <Settings className="w-3 h-3" /> hidrobr_admin
        </span>
      </div>

      {/* Filtro por tópico */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setTopicFilter(null)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${!topicFilter ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200'}`}>
          Todos (18)
        </button>
        {(topics ?? []).map((t: any) => (
          <button key={t.id} onClick={() => setTopicFilter(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${topicFilter === t.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
            style={topicFilter === t.id ? { background: t.color_hex } : {}}>
            {t.code}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando princípios...</span></div>
      ) : (
        (requirements ?? []).map((req: any) => (
          <RequirementEditor key={req.id} req={req} onSaved={() => qc.invalidateQueries({ queryKey: ['gistm-req-edit'] })} />
        ))
      )}
    </div>
  )
}
