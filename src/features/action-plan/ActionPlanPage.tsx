// src/features/action-plan/ActionPlanPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Save, CheckCircle2, Clock, AlertTriangle, Circle, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isHidrobr } from '@/store/authStore'

const PRIORITY: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  critical: { label: 'Crítica',  cls: 'bg-red-100 text-red-700',    icon: AlertTriangle },
  high:     { label: 'Alta',     cls: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  medium:   { label: 'Média',    cls: 'bg-amber-100 text-amber-700',  icon: Clock },
  low:      { label: 'Baixa',    cls: 'bg-green-100 text-green-700',  icon: Circle },
}
const STATUS_ACTION: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Aberta',       cls: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-purple-50 text-purple-700' },
  completed:   { label: 'Concluída',    cls: 'bg-emerald-50 text-emerald-700' },
  cancelled:   { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-500' },
  overdue:     { label: 'Atrasada',     cls: 'bg-red-50 text-red-700' },
}

// Todos os princípios GISTM (P01-P15) e TSM (TSM-P01..TSM-P18)
const GISTM_PRINCIPLES = Array.from({ length: 15 }, (_, i) => ({
  code: `P${String(i + 1).padStart(2, '0')}`,
  label: `P${String(i + 1).padStart(2, '0')} — Princípio ${i + 1}`,
  standard: 'GISTM',
}))
const TSM_PRINCIPLES = Array.from({ length: 18 }, (_, i) => ({
  code: `TSM-P${String(i + 1).padStart(2, '0')}`,
  label: `TSM-P${String(i + 1).padStart(2, '0')} — Requisito TSM ${i + 1}`,
  standard: 'TSM',
}))
const ALL_PRINCIPLES = [...GISTM_PRINCIPLES, ...TSM_PRINCIPLES]

// ── Seletor múltiplo de princípios ────────────────────────────
function PrincipleSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = ALL_PRINCIPLES.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.standard.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter(c => c !== code) : [...value, code])
  }

  return (
    <div className="relative">
      <div
        className="form-input cursor-pointer flex items-center gap-2 flex-wrap min-h-[40px]"
        onClick={() => setOpen(!open)}
      >
        {value.length === 0 ? (
          <span className="text-gray-400 text-sm">Selecione princípios...</span>
        ) : (
          value.map(code => (
            <span key={code}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700"
              onClick={e => { e.stopPropagation(); toggle(code) }}>
              {code} ✕
            </span>
          ))
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
      </div>
      {open && (
        <div className="absolute z-30 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input className="form-input text-sm py-1.5" placeholder="Buscar princípio..."
              value={search} onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()} autoFocus />
          </div>
          <div className="overflow-y-auto flex-1">
            {['GISTM', 'TSM'].map(std => (
              <div key={std}>
                <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                  {std}
                </div>
                {filtered.filter(p => p.standard === std).map(p => (
                  <div key={p.code}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${value.includes(p.code) ? 'bg-brand-50' : ''}`}
                    onClick={() => toggle(p.code)}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${value.includes(p.code) ? 'bg-brand-600' : 'border-2 border-gray-300'}`}>
                      {value.includes(p.code) && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                    </div>
                    <span className="text-sm text-gray-700">{p.code}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-100 flex justify-between">
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => onChange([])}>Limpar</button>
            <button className="text-xs text-brand-600 font-semibold" onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Seletor múltiplo de barragens ─────────────────────────────
function FacilitySelector({ value, onChange, orgId }: {
  value: string[]; onChange: (v: string[]) => void; orgId: string
}) {
  const { data: facilities } = useQuery({
    queryKey: ['facilities-for-action', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase.from('tailings_facilities').select('id,name,organizations(name)').eq('is_active', true).order('name')
      if (orgId) q = q.eq('organization_id', orgId)
      const { data } = await q
      return data ?? []
    },
  })

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(f => f !== id) : [...value, id])
  }

  return (
    <div className="space-y-1.5">
      {(facilities ?? []).map((f: any) => (
        <div key={f.id}
          className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all ${value.includes(f.id) ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
          onClick={() => toggle(f.id)}>
          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${value.includes(f.id) ? 'bg-brand-600' : 'border-2 border-gray-300'}`}>
            {value.includes(f.id) && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
          </div>
          <span className="text-sm text-gray-700">{f.name}</span>
          {f.organizations?.name && <span className="text-xs text-gray-400 ml-auto">{f.organizations.name}</span>}
        </div>
      ))}
      {(facilities ?? []).length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">Nenhuma barragem cadastrada</p>
      )}
    </div>
  )
}

// ── Modal de criação/edição ────────────────────────────────────
function ActionModal({ orgId, item, onClose }: { orgId: string; item?: any; onClose: () => void }) {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    summary: item?.summary ?? item?.title ?? '',
    title: item?.title ?? '',           // detalhamento
    description: item?.description ?? '',
    priority: item?.priority ?? 'medium',
    status: item?.status ?? 'open',
    due_date: item?.due_date ?? '',
    facility_ids: item?.facility_ids ?? [],
    principle_codes: item?.principle_codes ?? [],
    estimated_gain: item?.estimated_gain ?? 0,
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        summary: form.summary,
        title: form.summary,   // mantém compatibilidade
        description: form.description,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        facility_ids: form.facility_ids,
        principle_codes: form.principle_codes,
        estimated_gain: form.estimated_gain,
        organization_id: orgId,
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['action-items', orgId] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {item ? 'Editar ação' : 'Nova ação de melhoria'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Ação resumida */}
          <div>
            <label className="form-label">Ação resumida * <span className="text-gray-400 font-normal">(título curto)</span></label>
            <input className="form-input" placeholder="Ex: Elaborar PAE conforme Portaria 70.389/2017"
              value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
          </div>

          {/* Detalhamento */}
          <div>
            <label className="form-label">Detalhamento da ação</label>
            <textarea className="form-input resize-none" rows={4}
              placeholder="Descreva em detalhes o que deve ser feito, como, por quem e quais são os critérios de conclusão..."
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          {/* Prioridade, Status, Prazo */}
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

          {/* Barragens associadas */}
          <div>
            <label className="form-label">
              Estruturas associadas
              <span className="text-gray-400 font-normal ml-1">(selecione uma ou mais barragens)</span>
            </label>
            <FacilitySelector value={form.facility_ids} onChange={v => setForm({ ...form, facility_ids: v })} orgId={orgId} />
          </div>

          {/* Princípios vinculados */}
          <div>
            <label className="form-label">
              Princípios/Requisitos vinculados
              <span className="text-gray-400 font-normal ml-1">(GISTM e/ou TSM)</span>
            </label>
            <PrincipleSelector value={form.principle_codes} onChange={v => setForm({ ...form, principle_codes: v })} />
          </div>

          {/* Ganho estimado */}
          <div>
            <label className="form-label">
              Ganho estimado de aderência
              <span className="text-gray-400 font-normal ml-1">(pontos % ao concluir)</span>
            </label>
            <div className="flex items-center gap-3">
              <input type="number" min="0" max="100" step="0.5" className="form-input w-28"
                placeholder="Ex: 5"
                value={form.estimated_gain || ''}
                onChange={e => setForm({ ...form, estimated_gain: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-gray-500 flex-1">
                Quantos pontos % de conformidade esta ação vai gerar quando concluída.
                Ex: se os requisitos vinculados valem 5% do score total, informe <strong>5</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: mut.isPending || !form.summary ? '#9CA3AF' : '#002B3D', color: 'white', border: 'none', cursor: mut.isPending || !form.summary ? 'not-allowed' : 'pointer' }}
            onClick={() => mut.mutate()} disabled={mut.isPending || !form.summary}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {item ? 'Salvar alterações' : 'Criar ação'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card de ação ──────────────────────────────────────────────
function ActionCard({ action, orgId, onEdit }: { action: any; orgId: string; onEdit: () => void }) {
  const qc = useQueryClient()
  const p = PRIORITY[action.priority] ?? PRIORITY.medium
  const s = STATUS_ACTION[action.status] ?? STATUS_ACTION.open
  const overdue = action.status !== 'completed' && action.due_date && new Date(action.due_date) < new Date()

  // Buscar nomes das barragens
  const { data: facilities } = useQuery({
    queryKey: ['facilities-names', action.facility_ids],
    enabled: (action.facility_ids?.length ?? 0) > 0,
    queryFn: async () => {
      const { data } = await supabase.from('tailings_facilities').select('id,name')
        .in('id', action.facility_ids)
      return data ?? []
    },
  })

  const completeMut = useMutation({
    mutationFn: async () => supabase.from('action_items').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', action.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items', orgId] }),
  })
  const deleteMut = useMutation({
    mutationFn: async () => supabase.from('action_items').delete().eq('id', action.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items', orgId] }),
  })

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        {/* ID */}
        <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-brand-600 text-center leading-tight">
            #{action.action_id ?? action.id?.slice(-4) ?? '—'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900 leading-snug">{action.summary ?? action.title}</h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`badge text-[10px] ${p.cls}`}>{p.label}</span>
              <span className={`badge text-[10px] ${s.cls}`}>{s.label}</span>
            </div>
          </div>

          {action.description && (
            <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{action.description}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
            {action.due_date && (
              <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                {overdue ? '⚠ ' : '📅 '}Prazo: {new Date(action.due_date).toLocaleDateString('pt-BR')}
              </span>
            )}
            {(facilities?.length ?? 0) > 0 && (
              <span>🏔️ {facilities!.map((f: any) => f.name).join(', ')}</span>
            )}
            {(action.principle_codes?.length ?? 0) > 0 && (
              <span>📋 {action.principle_codes.join(', ')}</span>
            )}
            {(action.estimated_gain ?? 0) > 0 && (
              <span className="text-emerald-600 font-semibold">📈 +{action.estimated_gain}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
        {action.status !== 'completed' && (
          <button
            className="text-xs text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg font-semibold transition-colors"
            onClick={() => completeMut.mutate()}>
            ✓ Concluir
          </button>
        )}
        <button
          className="text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          onClick={onEdit}>
          ✏️ Editar
        </button>
        <button
          className="text-xs text-red-400 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          onClick={() => { if (confirm('Remover esta ação?')) deleteMut.mutate() }}>
          🗑️
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export function ActionPlanPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const [filter, setFilter] = useState('all')
  const [filterPrinciple, setFilterPrinciple] = useState('')
  const [modal, setModal] = useState<any>(null)

  const orgId = profile?.organization_id ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['action-items', orgId],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from('action_items')
        .select('*')
        .order('created_at', { ascending: false })
      if (!hb && orgId) q = q.eq('organization_id', orgId)
      const { data } = await q
      return data ?? []
    },
  })

  const filtered = (data ?? []).filter((a: any) => {
    if (filter !== 'all' && a.status !== filter) return false
    if (filterPrinciple && !(a.principle_codes ?? []).includes(filterPrinciple)) return false
    return true
  })

  const all = data ?? []
  const kpis = {
    total: all.length,
    open: all.filter((a: any) => a.status === 'open').length,
    inProgress: all.filter((a: any) => a.status === 'in_progress').length,
    completed: all.filter((a: any) => a.status === 'completed').length,
    overdue: all.filter((a: any) => a.status !== 'completed' && a.due_date && new Date(a.due_date) < new Date()).length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plano de Ação</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ações de melhoria com rastreabilidade por barragem e princípio</p>
        </div>
        <button
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
          onClick={() => setModal({})}>
          <Plus className="w-4 h-4" /> Nova ação
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: kpis.total, color: '#0A9396' },
          { label: 'Abertas', value: kpis.open, color: '#3B82F6' },
          { label: 'Em andamento', value: kpis.inProgress, color: '#8B5CF6' },
          { label: 'Concluídas', value: kpis.completed, color: '#059669' },
          { label: 'Atrasadas', value: kpis.overdue, color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="card p-3 text-center" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {[['all', 'Todas'], ['open', 'Abertas'], ['in_progress', 'Em andamento'], ['completed', 'Concluídas']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === v ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        <select className="form-input w-48 text-xs"
          value={filterPrinciple} onChange={e => setFilterPrinciple(e.target.value)}>
          <option value="">Todos os princípios</option>
          <optgroup label="GISTM">
            {GISTM_PRINCIPLES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
          </optgroup>
          <optgroup label="TSM">
            {TSM_PRINCIPLES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
          </optgroup>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-sm">Carregando ações...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Nenhuma ação encontrada</p>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '13px', fontWeight: '600', background: '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={() => setModal({})}>
            Criar primeira ação
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((action: any) => (
            <ActionCard
              key={action.id}
              action={action}
              orgId={orgId}
              onEdit={() => setModal(action)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <ActionModal
          orgId={orgId}
          item={Object.keys(modal).length > 0 ? modal : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
