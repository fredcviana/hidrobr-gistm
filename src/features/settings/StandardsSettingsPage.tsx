// src/features/settings/StandardsSettingsPage.tsx
import { AssessmentFormEditor } from './AssessmentFormEditor'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Trash2, Save, Loader2, CheckCircle2, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

// ── Requirement Editor ────────────────────────────────────────
function RequirementEditor({ req, topicColor, onSaved }: { req: any; topicColor: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(req.title)
  const [description, setDescription] = useState(req.description)
  const [guidance, setGuidance] = useState(req.guidance ?? '')
  const [weight, setWeight] = useState(req.weight)
  const [subs, setSubs] = useState<{id:string;text:string}[]>(req.sub_requirements ?? [])
  const [saved, setSaved] = useState(false)

  // Detecta se é GISTM (usa gistm_requirements) ou TSM (usa standard_requirements)
  const table = req._table ?? 'gistm_requirements'

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from(table)
        .update({ title, description, guidance, weight, sub_requirements: subs, updated_at: new Date().toISOString() })
        .eq('id', req.id)
        .select('id')
      if (error) throw error
      // O Supabase não retorna erro quando a política de RLS bloqueia o UPDATE —
      // ele simplesmente afeta 0 linhas. Sem essa checagem, a tela mostra "Salvo!"
      // mesmo quando nada foi persistido. Detectamos isso aqui e avisamos o usuário.
      if (!data || data.length === 0) {
        throw new Error('A alteração não foi salva: seu usuário não tem permissão de escrita nesta tabela (política de RLS). Peça para um admin liberar UPDATE em ' + table + '.')
      }
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved() },
  })

  function addSub() {
    const newId = `${req.code}-${String.fromCharCode(97 + subs.length)}`
    setSubs([...subs, { id: newId, text: '' }])
  }

  const dirty = title !== req.title || description !== req.description ||
    guidance !== (req.guidance ?? '') || weight !== req.weight ||
    JSON.stringify(subs) !== JSON.stringify(req.sub_requirements ?? [])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white">
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: topicColor + '20', color: topicColor }}>
          {req.code}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{subs.length} subcritérios · Peso {weight}x</div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="badge bg-amber-50 text-amber-700 text-[10px]">Não salvo</span>}
          {saved && <span className="badge bg-emerald-50 text-emerald-700 text-[10px] inline-flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />Salvo</span>}
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
              <label className="form-label mb-0">Subcritérios</label>
              <button onClick={addSub} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {subs.map((sub, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-20 font-mono flex-shrink-0">{sub.id}</span>
                  <input className="form-input flex-1" value={sub.text}
                    onChange={e => { const u = [...subs]; u[i] = { ...u[i], text: e.target.value }; setSubs(u) }}
                    placeholder="Texto do subcritério..." />
                  <button onClick={() => setSubs(subs.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {subs.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-lg">
                  Nenhum subcritério. Clique em "Adicionar".
                </p>
              )}
            </div>
          </div>
          {mut.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
              {(mut.error as any)?.message ?? 'Erro ao salvar'}
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'6px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background: dirty && !mut.isPending ? '#002B3D' : '#9CA3AF',color:'white',border:'none',cursor: dirty ? 'pointer' : 'not-allowed'}}
              onClick={() => mut.mutate()} disabled={mut.isPending || !dirty}>
              {mut.isPending ? <><Loader2 className="w-3 h-3 animate-spin" />Salvando...</> :
               saved ? <><CheckCircle2 className="w-3 h-3" />Salvo!</> :
               <><Save className="w-3 h-3" />Salvar alterações</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── GISTM Tab ─────────────────────────────────────────────────
function GistmTab() {
  const qc = useQueryClient()
  const [topicFilter, setTopicFilter] = useState<string | null>(null)

  const { data: topics } = useQuery({
    queryKey: ['gistm-topics-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('gistm_topics').select('*').order('display_order')
      return data ?? []
    },
  })

  const { data: principles } = useQuery({
    queryKey: ['gistm-principles-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('gistm_principles').select('*').order('display_order')
      return data ?? []
    },
  })

  const { data: requirements, isLoading } = useQuery({
    queryKey: ['gistm-req-edit'],
    queryFn: async () => {
      const { data } = await supabase.from('gistm_requirements')
        .select('*')
        .order('display_order')
      return (data ?? []).map((r: any) => ({ ...r, _table: 'gistm_requirements' }))
    },
  })

  // Monta mapa de princípio → tópico
  const topicMap = new Map((topics ?? []).map((t: any) => [t.id, t]))
  const principleMap = new Map((principles ?? []).map((p: any) => [p.id, { ...p, topic: topicMap.get(p.topic_id) }]))

  // Filtra por tópico
  const filtered = topicFilter
    ? (requirements ?? []).filter((r: any) => {
        const p = principleMap.get(r.principle_id)
        return p?.topic?.id === topicFilter || p?.topic_id === topicFilter
      })
    : (requirements ?? [])

  // Agrupa por princípio
  const byPrinciple = filtered.reduce((acc: any, req: any) => {
    const pId = req.principle_id
    if (!acc[pId]) acc[pId] = { principle: principleMap.get(pId), reqs: [] }
    acc[pId].reqs.push(req)
    return acc
  }, {})

  return (
    <div>
      {/* Filtro por tópico */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setTopicFilter(null)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${!topicFilter ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200'}`}>
          Todos
        </button>
        {(topics ?? []).map((t: any) => (
          <button key={t.id} onClick={() => setTopicFilter(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${topicFilter === t.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
            style={topicFilter === t.id ? { background: t.color_hex } : {}}>
            {t.code} — {t.title?.split('–')[0]?.trim() ?? t.title}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-sm">Carregando requisitos...</span>
        </div>
      ) : (
        Object.values(byPrinciple).map((group: any) => {
          const p = group.principle
          const topicColor = p?.topic?.color_hex ?? '#0A9396'
          return (
            <div key={p?.id} className="mb-4">
              {/* Cabeçalho do princípio */}
              <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg"
                style={{ background: topicColor + '12', borderLeft: `3px solid ${topicColor}` }}>
                <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0"
                  style={{ background: topicColor + '25', color: topicColor }}>
                  {p?.code ?? 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{p?.title}</p>
                  <p className="text-[10px] text-gray-400">{group.reqs.length} requisitos · {p?.topic?.title}</p>
                </div>
              </div>
              {/* Requisitos */}
              {group.reqs.map((req: any) => (
                <RequirementEditor
                  key={req.id}
                  req={{ ...req, gistm_topics: p?.topic }}
                  topicColor={topicColor}
                  onSaved={() => qc.invalidateQueries({ queryKey: ['gistm-req-edit'] })}
                />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── TSM Tab ───────────────────────────────────────────────────
function TsmTab() {
  const qc = useQueryClient()
  const [topicFilter, setTopicFilter] = useState<string | null>(null)

  const { data: topics } = useQuery({
    queryKey: ['tsm-topics'],
    queryFn: async () => {
      const { data: standards } = await supabase.from('assessment_standards').select('id').eq('code', 'TSM').single()
      if (!standards) return []
      const { data } = await supabase.from('standard_topics').select('*').eq('standard_id', standards.id).order('display_order')
      return data ?? []
    },
  })

  const { data: reqs, isLoading } = useQuery({
    queryKey: ['tsm-reqs', topicFilter],
    queryFn: async () => {
      const { data: standards } = await supabase.from('assessment_standards').select('id').eq('code', 'TSM').single()
      if (!standards) return []
      let q = supabase.from('standard_requirements').select('*, standard_topics(code,title,color_hex)').eq('standard_id', standards.id).order('display_order')
      if (topicFilter) q = q.eq('topic_id', parseInt(topicFilter))
      const { data } = await q
      return (data ?? []).map((r: any) => ({ ...r, _table: 'standard_requirements' }))
    },
  })

  if ((topics ?? []).length === 0 && !isLoading) {
    return (
      <div className="card p-10 text-center">
        <div className="text-4xl mb-3">🌱</div>
        <p className="text-gray-600 font-medium mb-2">Tabelas TSM não encontradas</p>
        <p className="text-gray-400 text-sm mb-4">Execute o SQL de criação das tabelas TSM no Supabase primeiro.</p>
        <div className="bg-gray-900 rounded-xl p-4 text-left">
          <code className="text-green-400 text-xs">SQL Editor → New query → cole o conteúdo do arquivo tsm-schema.sql → Run</code>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <p className="text-sm text-blue-800 font-semibold mb-1">Towards Sustainable Mining (TSM)</p>
        <p className="text-xs text-blue-600">
          Programa da Mining Association of Canada. 8 protocolos, 18 requisitos. 
          Avaliação em 5 níveis: Nível C, Nível B, Nível A, Líder e Excelência.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setTopicFilter(null)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${!topicFilter ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200'}`}>
          Todos (18)
        </button>
        {(topics ?? []).map((t: any) => (
          <button key={t.id} onClick={() => setTopicFilter(String(t.id))}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${topicFilter === String(t.id) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
            style={topicFilter === String(t.id) ? { background: t.color_hex ?? '#1B4F72' } : {}}>
            {t.code.replace('TSM-', '')}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando...</span></div>
      ) : (
        (reqs ?? []).map((req: any) => (
          <RequirementEditor key={req.id} req={req}
            topicColor={req.standard_topics?.color_hex ?? '#1B4F72'}
            onSaved={() => qc.invalidateQueries({ queryKey: ['tsm-reqs'] })} />
        ))
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export function StandardsSettingsPage() {
  const { profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'gistm' | 'tsm' | 'assessment'>('gistm')

  if (profile?.role !== 'hidrobr_admin') return <Navigate to="/dashboard" replace />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurações de Padrões</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Edite títulos, descrições, orientações e subcritérios dos requisitos GISTM e TSM
          </p>
        </div>
        <span className="badge bg-brand-50 text-brand-700 border border-brand-200 inline-flex items-center gap-1.5">
          <Settings className="w-3 h-3" /> hidrobr_admin
        </span>
      </div>

      {/* Tabs GISTM / TSM */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {[
          { id: 'gistm', label: '🏔️  GISTM', sub: '15 princípios · UNEP/PRI/ICMM' },
          { id: 'tsm', label: '🌱  TSM', sub: '18 requisitos · Mining Association of Canada' },
          { id: 'assessment', label: '📋  Self Assessment', sub: 'Formulário público de captação' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as 'gistm' | 'tsm' | 'assessment')}
            className={`px-5 py-2.5 rounded-lg transition-all text-left ${activeTab === tab.id ? 'bg-white shadow-sm' : 'hover:bg-gray-200/50'}`}>
            <div className={`text-sm font-bold ${activeTab === tab.id ? 'text-brand-700' : 'text-gray-500'}`}>{tab.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{tab.sub}</div>
          </button>
        ))}
      </div>

      {activeTab === 'gistm' ? <GistmTab /> : activeTab === 'tsm' ? <TsmTab /> : <AssessmentFormEditor />}
    </div>
  )
}
