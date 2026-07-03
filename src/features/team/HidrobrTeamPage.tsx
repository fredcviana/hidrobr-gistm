// src/features/team/HidrobrTeamPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Save, UserCheck, UserX, Mail, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  hidrobr_admin:      { label: 'Administrador',       cls: 'bg-purple-50 text-purple-700' },
  hidrobr_consultant: { label: 'Consultor',           cls: 'bg-blue-50 text-blue-700' },
}

// ── Modal de criação/edição ───────────────────────────────────
function TeamMemberModal({ member, onClose }: { member?: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    full_name: member?.full_name ?? '',
    job_title: member?.job_title ?? '',
    phone: member?.phone ?? '',
    role: member?.role ?? 'hidrobr_consultant',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')

  const updateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name,
        job_title: form.job_title || null,
        phone: form.phone || null,
        role: form.role,
        updated_at: new Date().toISOString(),
      }).eq('id', member.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hidrobr-team'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const isEditing = !!member

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {isEditing ? `Editar — ${member.full_name}` : 'Novo membro da equipe HIDROBR'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {!isEditing && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Para criar um novo usuário HIDROBR:</strong>
              <ol className="mt-2 space-y-1 text-xs list-decimal list-inside">
                <li>Acesse o Supabase → Authentication → Users → Add user</li>
                <li>Crie o usuário com e-mail e senha</li>
                <li>Volte aqui e edite o perfil para definir o cargo e role</li>
              </ol>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Nome completo *</label>
              <input className="form-input" placeholder="Dr. Ricardo Mendes"
                value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Cargo</label>
              <input className="form-input" placeholder="Consultor Sênior"
                value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Telefone</label>
              <input className="form-input" placeholder="+55 31 99999-0000"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="form-label">Perfil de acesso</label>
              <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="hidrobr_consultant">Consultor HIDROBR</option>
                <option value="hidrobr_admin">Administrador HIDROBR</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          {isEditing && (
            <button
              style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'8px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:'600',background:'#002B3D',color:'white',border:'none',cursor:'pointer'}}
              onClick={() => updateMut.mutate()}
              disabled={updateMut.isPending || !form.full_name}
            >
              {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar alterações
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Painel de clientes atribuídos ─────────────────────────────
function ConsultantClients({ consultantId, consultantName }: { consultantId: string; consultantName: string }) {
  const { data: cycles } = useQuery({
    queryKey: ['consultant-cycles', consultantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('assessment_cycles')
        .select('id, name, status, organizations(name), tailings_facilities(name)')
        .eq('assigned_consultant', consultantId)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: orgs } = useQuery({
    queryKey: ['all-orgs-for-assign'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id,name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const { data: activeCycles } = useQuery({
    queryKey: ['unassigned-cycles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assessment_cycles')
        .select('id, name, organizations(name)')
        .eq('status', 'active')
        .is('assigned_consultant', null)
      return data ?? []
    },
  })

  const qc = useQueryClient()
  const assignMut = useMutation({
    mutationFn: async (cycleId: string) => {
      await supabase.from('assessment_cycles').update({ assigned_consultant: consultantId }).eq('id', cycleId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consultant-cycles', consultantId] })
      qc.invalidateQueries({ queryKey: ['unassigned-cycles'] })
    },
  })

  const unassignMut = useMutation({
    mutationFn: async (cycleId: string) => {
      await supabase.from('assessment_cycles').update({ assigned_consultant: null }).eq('id', cycleId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consultant-cycles', consultantId] })
      qc.invalidateQueries({ queryKey: ['unassigned-cycles'] })
    },
  })

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        Ciclos atribuídos a {consultantName.split(' ')[0]}
      </div>

      {(cycles ?? []).length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">Nenhum ciclo atribuído.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {(cycles ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <div className="text-xs font-semibold text-gray-800">{c.organizations?.name}</div>
                <div className="text-[10px] text-gray-400">{c.name}</div>
              </div>
              <button
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
                onClick={() => unassignMut.mutate(c.id)}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {(activeCycles ?? []).length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Atribuir ciclo sem consultor</div>
          <div className="space-y-1">
            {(activeCycles ?? []).map((c: any) => (
              <button key={c.id}
                className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors text-left"
                onClick={() => assignMut.mutate(c.id)}
              >
                <div>
                  <div className="text-xs font-semibold text-blue-800">{c.organizations?.name}</div>
                  <div className="text-[10px] text-blue-500">{c.name}</div>
                </div>
                <span className="text-[10px] text-blue-600 font-semibold">+ Atribuir</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card do membro ────────────────────────────────────────────
function TeamMemberCard({ member }: { member: any }) {
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showClients, setShowClients] = useState(false)

  const toggleActive = useMutation({
    mutationFn: async () => {
      await supabase.from('profiles').update({ is_active: !member.is_active }).eq('id', member.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hidrobr-team'] }),
  })

  const cfg = ROLE_CONFIG[member.role] ?? { label: member.role, cls: 'bg-gray-100 text-gray-600' }
  const initials = member.full_name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('') ?? '?'

  return (
    <>
      <div className={`card p-5 ${!member.is_active ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-gray-900 truncate">{member.full_name}</span>
              {!member.is_active && <span className="badge bg-gray-100 text-gray-500 text-[10px]">Inativo</span>}
            </div>
            <div className="text-xs text-gray-400">{member.job_title ?? 'Sem cargo definido'}</div>
          </div>
          <span className={`badge text-[10px] ${cfg.cls}`}>{cfg.label}</span>
        </div>

        <div className="space-y-1.5 mb-4">
          {member.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="text-gray-300">📞</span> {member.phone}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'5px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background:'white',color:'#374151',border:'1px solid #D1D5DB',cursor:'pointer'}}
            onClick={() => setShowEdit(true)}
          >
            ✏️ Editar
          </button>
          <button
            style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'5px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background:'white',color:'#374151',border:'1px solid #D1D5DB',cursor:'pointer'}}
            onClick={() => setShowClients(!showClients)}
          >
            🏢 Clientes {showClients ? '▲' : '▼'}
          </button>
          <button
            style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'5px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background: member.is_active ? '#FEF2F2' : '#D1FAE5',color: member.is_active ? '#DC2626' : '#059669',border:'none',cursor:'pointer'}}
            onClick={() => toggleActive.mutate()}
          >
            {member.is_active ? <><UserX className="w-3.5 h-3.5" /> Desativar</> : <><UserCheck className="w-3.5 h-3.5" /> Reativar</>}
          </button>
        </div>

        {showClients && (
          <ConsultantClients consultantId={member.id} consultantName={member.full_name} />
        )}
      </div>

      {showEdit && <TeamMemberModal member={member} onClose={() => setShowEdit(false)} />}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────
export function HidrobrTeamPage() {
  const { profile } = useAuthStore()
  const [showCreate, setShowCreate] = useState(false)
  const [filterRole, setFilterRole] = useState('all')

  if (profile?.role !== 'hidrobr_admin') return <Navigate to="/dashboard" replace />

  const { data, isLoading } = useQuery({
    queryKey: ['hidrobr-team'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['hidrobr_admin', 'hidrobr_consultant'])
        .order('full_name')
      return data ?? []
    },
  })

  const filtered = filterRole === 'all'
    ? (data ?? [])
    : (data ?? []).filter((m: any) => m.role === filterRole)

  const total = data?.length ?? 0
  const active = data?.filter((m: any) => m.is_active).length ?? 0
  const consultants = data?.filter((m: any) => m.role === 'hidrobr_consultant').length ?? 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Equipe HIDROBR</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} membro{total !== 1 ? 's' : ''} · {active} ativo{active !== 1 ? 's' : ''} · {consultants} consultor{consultants !== 1 ? 'es' : ''}
          </p>
        </div>
        <button
          style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'8px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:'600',background:'#002B3D',color:'white',border:'none',cursor:'pointer'}}
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" /> Adicionar membro
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total da equipe', value: total, color: '#0A9396' },
          { label: 'Consultores ativos', value: active, color: '#059669' },
          { label: 'Administradores', value: data?.filter((m:any)=>m.role==='hidrobr_admin').length??0, color: '#7C3AED' },
        ].map(k => (
          <div key={k.label} className="card p-4" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {[['all','Todos'],['hidrobr_consultant','Consultores'],['hidrobr_admin','Administradores']].map(([v,l]) => (
          <button key={v} onClick={() => setFilterRole(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterRole===v?'bg-brand-900 text-white border-brand-900':'bg-white text-gray-600 border-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-sm">Carregando equipe...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((member: any) => (
            <TeamMemberCard key={member.id} member={member} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 card p-12 text-center">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-500 font-medium">Nenhum membro encontrado</p>
            </div>
          )}
        </div>
      )}

      {showCreate && <TeamMemberModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
