// src/features/action-plan/ActionPlanPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Save, CheckCircle2, Clock, AlertTriangle, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isHidrobr } from '@/store/authStore'

const PRIORITY: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  critical: { label: 'Crítica', cls: 'bg-red-100 text-red-700', icon: AlertTriangle },
  high: { label: 'Alta', cls: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  medium: { label: 'Média', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  low: { label: 'Baixa', cls: 'bg-green-100 text-green-700', icon: Circle },
}
const STATUS_ACTION: Record<string, { label: string; cls: string }> = {
  open: { label: 'Aberta', cls: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'Em andamento', cls: 'bg-purple-50 text-purple-700' },
  completed: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
  overdue: { label: 'Atrasada', cls: 'bg-red-50 text-red-700' },
}

function ActionModal({ orgId, item, onClose }: { orgId: string; item?: any; onClose: () => void }) {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: item?.title ?? '',
    description: item?.description ?? '',
    priority: item?.priority ?? 'medium',
    status: item?.status ?? 'open',
    due_date: item?.due_date ?? '',
    requirement_code: item?.requirement_code ?? '',
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      if (item?.id) {
        const { error } = await supabase.from('action_items').update({
          ...form, due_date: form.due_date || null, updated_at: new Date().toISOString()
        }).eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('action_items').insert({
          ...form, organization_id: orgId, created_by: profile!.id,
          due_date: form.due_date || null,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['action-items', orgId] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">{item ? 'Editar ação' : 'Nova ação de melhoria'}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="form-label">Título da ação *</label>
            <input className="form-input" placeholder="Ex: Elaborar PAE conforme Portaria 70.389/2017"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Descrição</label>
            <textarea className="form-input resize-none" rows={3}
              placeholder="Descreva detalhes da ação necessária..."
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
              <input type="date" className="form-input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="form-label">Princípio GISTM relacionado</label>
            <select className="form-input" value={form.requirement_code} onChange={e => setForm({ ...form, requirement_code: e.target.value })}>
              <option value="">Nenhum</option>
              {Array.from({ length: 18 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary inline-flex items-center gap-2"
            onClick={() => mut.mutate()} disabled={mut.isPending || !form.title}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {item ? 'Salvar alterações' : 'Criar ação'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ActionPlanPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState<any>(null) // null | {} | item

  const orgId = profile?.organization_id ?? ''

  // HIDROBR pode ver todas as ações ou de uma org específica
  const { data, isLoading } = useQuery({
    queryKey: ['action-items', orgId],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from('action_items').select('*, profiles!owner_id(full_name)').order('created_at', { ascending: false })
      if (!hb && orgId) q = q.eq('organization_id', orgId)
      else if (hb && orgId) q = q.eq('organization_id', orgId)
      const { data } = await q
      return data ?? []
    },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('action_items').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items', orgId] }),
  })

  const completeMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('action_items').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items', orgId] }),
  })

  const filtered = filter === 'all' ? (data ?? []) : (data ?? []).filter((a: any) => a.status === filter)

  // KPIs
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
          <p className="text-sm text-gray-500 mt-0.5">Ações de melhoria originadas das avaliações GISTM</p>
        </div>
<button style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'8px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:'600',background:'#002B3D',color:'white',border:'none',cursor:'pointer'}} onClick={() => setModal({})}>
          <Plus className="w-4 h-4" /> Nova ação
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total de ações', value: kpis.total, color: '#0A9396' },
          { label: 'Em aberto', value: kpis.open, color: '#3B82F6' },
          { label: 'Em andamento', value: kpis.inProgress, color: '#8B5CF6' },
          { label: 'Atrasadas', value: kpis.overdue, color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="card p-4" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {[['all', 'Todas'], ['open', 'Abertas'], ['in_progress', 'Em andamento'], ['completed', 'Concluídas'], ['overdue', 'Atrasadas']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === v ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando...</span></div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Nenhuma ação encontrada</p>
              <button className="btn-primary mt-4" onClick={() => setModal({})}>Criar primeira ação</button>
            </div>
          )}
          {filtered.map((action: any) => {
            const p = PRIORITY[action.priority] ?? PRIORITY.medium
            const s = STATUS_ACTION[action.status] ?? STATUS_ACTION.open
            const overdue = action.status !== 'completed' && action.due_date && new Date(action.due_date) < new Date()
            return (
              <div key={action.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${p.cls}`}>
                  <p.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{action.title}</span>
                    {action.requirement_code && <span className="badge bg-brand-50 text-brand-700 text-[10px]">{action.requirement_code}</span>}
                  </div>
                  {action.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{action.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {action.due_date && (
                      <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                        {overdue ? '⚠ ' : ''}Prazo: {new Date(action.due_date).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {action.profiles?.full_name && <span>Responsável: {action.profiles.full_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`badge ${p.cls} text-[10px]`}>{p.label}</span>
                  <span className={`badge ${s.cls} text-[10px]`}>{s.label}</span>
                  {action.status !== 'completed' && (
                    <button className="btn-success btn-sm text-xs" onClick={() => completeMut.mutate(action.id)}>✓ Concluir</button>
                  )}
                  <button className="btn-secondary btn-sm text-xs" onClick={() => setModal(action)}>Editar</button>
                  <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    onClick={() => { if (confirm('Remover esta ação?')) deleteMut.mutate(action.id) }}>
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <ActionModal
          orgId={orgId}
          item={modal && Object.keys(modal).length > 0 ? modal : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
