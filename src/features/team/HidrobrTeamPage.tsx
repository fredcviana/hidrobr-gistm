// src/features/team/HidrobrTeamPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, X, Save, UserCheck, UserX, Mail, Briefcase, KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'
import { CreateHidrobrUserModal } from './CreateHidrobrUserModal'
import { AdminSetPasswordModal } from '@/features/auth/AdminSetPasswordModal'

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  hidrobr_admin:      { label: 'Administrador',       cls: 'bg-purple-50 text-purple-700' },
  hidrobr_consultant: { label: 'Consultor',           cls: 'bg-blue-50 text-blue-700' },
}

// ── Painel de clientes atribuídos ─────────────────────────────
// Atribuição é por cliente (organization_team_members, N:N), não por ciclo —
// permite vários membros da equipe HIDROBR no mesmo cliente simultaneamente.
function ConsultantClients({ consultantId, consultantName }: { consultantId: string; consultantName: string }) {
  const qc = useQueryClient()

  const { data: assignedOrgs } = useQuery({
    queryKey: ['consultant-orgs', consultantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_team_members')
        .select('id, organization_id, organizations(name)')
        .eq('profile_id', consultantId)
      return data ?? []
    },
  })

  const { data: allOrgs } = useQuery({
    queryKey: ['all-orgs-for-assign'],
    queryFn: async () => {
      const { data } = await supabase.from('organizations').select('id,name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const assignMut = useMutation({
    mutationFn: async (organizationId: string) => {
      await supabase.from('organization_team_members').insert({ organization_id: organizationId, profile_id: consultantId })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultant-orgs', consultantId] }),
  })

  const unassignMut = useMutation({
    mutationFn: async (organizationId: string) => {
      await supabase.from('organization_team_members').delete().eq('organization_id', organizationId).eq('profile_id', consultantId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultant-orgs', consultantId] }),
  })

  const assignedIds = new Set((assignedOrgs ?? []).map((a: any) => a.organization_id))
  const availableOrgs = (allOrgs ?? []).filter((o: any) => !assignedIds.has(o.id))

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        Clientes atribuídos a {consultantName.split(' ')[0]}
      </div>

      {(assignedOrgs ?? []).length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">Nenhum cliente atribuído.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {(assignedOrgs ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-xs font-semibold text-gray-800">{a.organizations?.name}</div>
              <button
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
                onClick={() => unassignMut.mutate(a.organization_id)}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      {availableOrgs.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Atribuir cliente</div>
          <div className="space-y-1">
            {availableOrgs.map((o: any) => (
              <button key={o.id}
                className="w-full flex items-center justify-between bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors text-left"
                onClick={() => assignMut.mutate(o.id)}
              >
                <div className="text-xs font-semibold text-blue-800">{o.name}</div>
                <span className="text-[10px] text-blue-600 font-semibold">+ Atribuir</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal de edição do membro ────────────────────────────────
function TeamMemberModal({ member, onClose }: { member: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    full_name: member.full_name ?? '',
    job_title: member.job_title ?? '',
    phone: member.phone ?? '',
    role: member.role ?? 'hidrobr_consultant',
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error('Nome obrigatório')
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        job_title: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role,
        updated_at: new Date().toISOString(),
      }).eq('id', member.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hidrobr-team'] })
      onClose()
    },
    onError: (e: any) => setError(e.message ?? 'Erro ao salvar'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Editar membro</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="form-label">Nome completo *</label>
            <input className="form-input" value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Cargo</label>
            <input className="form-input" placeholder="Ex: Consultor Sênior"
              value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Telefone</label>
            <input className="form-input" placeholder="+55 31 99999-0000"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Perfil</label>
            <select className="form-input" value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="hidrobr_consultant">Consultor</option>
              <option value="hidrobr_admin">Administrador</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: mut.isPending ? '#9CA3AF' : '#002B3D', color: 'white', border: 'none', cursor: mut.isPending ? 'not-allowed' : 'pointer' }}
            onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card do membro ────────────────────────────────────────────
function TeamMemberCard({ member }: { member: any }) {
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showClients, setShowClients] = useState(false)
  const [showSetPassword, setShowSetPassword] = useState(false)

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
          <button
            style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'5px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',background:'white',color:'#374151',border:'1px solid #D1D5DB',cursor:'pointer'}}
            onClick={() => setShowSetPassword(true)}
          >
            <KeyRound className="w-3.5 h-3.5" /> Trocar senha
          </button>
        </div>

        {showClients && (
          <ConsultantClients consultantId={member.id} consultantName={member.full_name} />
        )}
      </div>

      {showEdit && <TeamMemberModal member={member} onClose={() => setShowEdit(false)} />}
      {showSetPassword && (
        <AdminSetPasswordModal userId={member.id} userName={member.full_name} onClose={() => setShowSetPassword(false)} />
      )}
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

      {showCreate && <CreateHidrobrUserModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
