// src/features/clients/ClientsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, Users, ChevronRight, Loader2, X, Save, AlertCircle, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isHidrobr } from '@/store/authStore'

// ── Modal genérico ────────────────────────────────────────────
function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

// ── Form field helper ─────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="form-label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      {children}
    </div>
  )
}

// ── Criar Organização ─────────────────────────────────────────
function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', cnpj: '', segment: '', contract_start: '', contract_end: '' })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('organizations').insert({
        name: form.name, cnpj: form.cnpj || null, segment: form.segment || null,
        contract_start: form.contract_start || null, contract_end: form.contract_end || null,
        is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organizations'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  return (
    <Modal title="Nova Organização Cliente" onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => mut.mutate()} disabled={mut.isPending || !form.name}>
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar organização
        </button>
      </>}>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
      <Field label="Razão social" required><input className="form-input" placeholder="Ex: Mineração Norte S.A." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="CNPJ"><input className="form-input" placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} /></Field>
      <Field label="Segmento mineral">
        <select className="form-input" value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
          <option value="">Selecione...</option>
          {['Minério de Ferro', 'Bauxita', 'Fosfato', 'Níquel', 'Cobre', 'Ouro', 'Outro'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Início do contrato"><input type="date" className="form-input" value={form.contract_start} onChange={e => setForm({ ...form, contract_start: e.target.value })} /></Field>
        <Field label="Fim do contrato"><input type="date" className="form-input" value={form.contract_end} onChange={e => setForm({ ...form, contract_end: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

// ── Criar Usuário ─────────────────────────────────────────────
function CreateUserModal({ orgId, orgName, onClose }: { orgId: string; orgName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'client_user', job_title: '' })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      // Cria usuário no Supabase Auth via Admin API (usando service role não disponível no client)
      // Workaround: inserir direto na tabela de convites ou usar função RPC
      const { data, error: authErr } = await supabase.auth.admin?.createUser?.({
        email: form.email, password: form.password,
        user_metadata: { full_name: form.full_name, role: form.role },
        email_confirm: true,
      }) as any

      if (authErr) throw authErr
      if (data?.user) {
        await supabase.from('profiles').insert({
          id: data.user.id, full_name: form.full_name,
          role: form.role, organization_id: orgId, job_title: form.job_title || null,
        })
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-users', orgId] }); onClose() },
    onError: (e: any) => setError(e.message ?? 'Erro ao criar usuário. Use o painel do Supabase para criar usuários.'),
  })

  return (
    <Modal title={`Novo usuário — ${orgName}`} onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => mut.mutate()} disabled={mut.isPending || !form.full_name || !form.email || !form.password}>
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar usuário
        </button>
      </>}>
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-4">
          <strong>Atenção:</strong> {error}
          <div className="mt-2 text-xs">
            Para criar usuários, acesse o painel do Supabase → Authentication → Users → Add user e depois configure o perfil.
          </div>
        </div>
      )}
      <Field label="Nome completo" required><input className="form-input" placeholder="Nome do usuário" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
      <Field label="E-mail" required><input type="email" className="form-input" placeholder="usuario@empresa.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="Senha temporária" required><input type="password" className="form-input" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
      <Field label="Cargo"><input className="form-input" placeholder="Ex: Engenheiro de Segurança" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></Field>
      <Field label="Perfil de acesso">
        <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="client_admin">Administrador do Cliente</option>
          <option value="client_user">Usuário do Cliente</option>
          <option value="readonly">Visualizador</option>
        </select>
      </Field>
    </Modal>
  )
}

// ── Criar Barragem ────────────────────────────────────────────
function CreateFacilityModal({ orgId, orgName, onClose }: { orgId: string; orgName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', dam_code: '', dam_type: 'Montante', consequence_class: 'Alto', operational_status: 'Ativa', height_meters: '', municipality: '', state: '' })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tailings_facilities').insert({
        organization_id: orgId, name: form.name, dam_code: form.dam_code || null,
        dam_type: form.dam_type, consequence_class: form.consequence_class,
        operational_status: form.operational_status,
        height_meters: form.height_meters ? parseFloat(form.height_meters) : null,
        location: form.municipality ? { municipality: form.municipality, state: form.state } : {},
        is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-facilities', orgId] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  return (
    <Modal title={`Nova barragem — ${orgName}`} onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => mut.mutate()} disabled={mut.isPending || !form.name}>
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar barragem
        </button>
      </>}>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome da barragem" required><input className="form-input" placeholder="Ex: Barragem Norte BN-01" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Código"><input className="form-input" placeholder="Ex: BN-01" value={form.dam_code} onChange={e => setForm({ ...form, dam_code: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Método de alteamento">
          <select className="form-input" value={form.dam_type} onChange={e => setForm({ ...form, dam_type: e.target.value })}>
            {['Montante', 'Linha de Centro', 'Jusante', 'Outro'].map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Classe de consequência">
          <select className="form-input" value={form.consequence_class} onChange={e => setForm({ ...form, consequence_class: e.target.value })}>
            {['Muito Alto', 'Alto', 'Médio', 'Baixo'].map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Status operacional">
          <select className="form-input" value={form.operational_status} onChange={e => setForm({ ...form, operational_status: e.target.value })}>
            {['Ativa', 'Inativa', 'Em construção', 'Fechada'].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Altura (m)"><input type="number" className="form-input" placeholder="85" value={form.height_meters} onChange={e => setForm({ ...form, height_meters: e.target.value })} /></Field>
        <Field label="Estado"><input className="form-input" placeholder="MG" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></Field>
      </div>
      <Field label="Município"><input className="form-input" placeholder="Ex: Brumadinho" value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })} /></Field>
    </Modal>
  )
}

// ── Criar Ciclo ───────────────────────────────────────────────
function CreateCycleModal({ orgId, orgName, onClose }: { orgId: string; orgName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ facility_id: '', name: '', reference_year: new Date().getFullYear().toString(), start_date: new Date().toISOString().split('T')[0], target_date: '' })
  const [error, setError] = useState('')

  const { data: facilities } = useQuery({
    queryKey: ['org-facilities', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('tailings_facilities').select('id,name').eq('organization_id', orgId).eq('is_active', true)
      return data ?? []
    },
  })

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('assessment_cycles').insert({
        organization_id: orgId, facility_id: form.facility_id, name: form.name,
        reference_year: parseInt(form.reference_year), start_date: form.start_date,
        target_date: form.target_date || null, status: 'active',
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-cycles', orgId] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  return (
    <Modal title={`Novo ciclo — ${orgName}`} onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary inline-flex items-center gap-2" onClick={() => mut.mutate()} disabled={mut.isPending || !form.facility_id || !form.name}>
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar ciclo
        </button>
      </>}>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
      <Field label="Barragem" required>
        <select className="form-input" value={form.facility_id} onChange={e => setForm({ ...form, facility_id: e.target.value })}>
          <option value="">Selecione a barragem...</option>
          {(facilities ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Field>
      <Field label="Nome do ciclo" required><input className="form-input" placeholder="Ex: Ciclo 2025 — Barragem Norte" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Ano de referência"><input type="number" className="form-input" value={form.reference_year} onChange={e => setForm({ ...form, reference_year: e.target.value })} /></Field>
        <Field label="Data de início"><input type="date" className="form-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
        <Field label="Prazo alvo"><input type="date" className="form-input" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

// ── Detalhe da organização ────────────────────────────────────
function OrgDetail({ org, onBack }: { org: any; onBack: () => void }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'users' | 'facilities' | 'cycles'>('facilities')
  const [modal, setModal] = useState<'user' | 'facility' | 'cycle' | null>(null)

  const { data: users } = useQuery({
    queryKey: ['org-users', org.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('organization_id', org.id)
      return data ?? []
    },
  })
  const { data: facilities } = useQuery({
    queryKey: ['org-facilities', org.id],
    queryFn: async () => {
      const { data } = await supabase.from('tailings_facilities').select('*').eq('organization_id', org.id).eq('is_active', true)
      return data ?? []
    },
  })
  const { data: cycles } = useQuery({
    queryKey: ['org-cycles', org.id],
    queryFn: async () => {
      const { data } = await supabase.from('assessment_cycles').select('*, tailings_facilities(name)').eq('organization_id', org.id).order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const tabs = [
    { id: 'facilities', label: `Barragens (${facilities?.length ?? 0})` },
    { id: 'users', label: `Usuários (${users?.length ?? 0})` },
    { id: 'cycles', label: `Ciclos (${cycles?.length ?? 0})` },
  ]

  const ROLE_LABELS: Record<string, string> = {
    client_admin: 'Administrador', client_user: 'Usuário', readonly: 'Visualizador',
    hidrobr_admin: 'Admin HIDROBR', hidrobr_consultant: 'Consultor HIDROBR',
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-secondary btn-sm" onClick={onBack}>← Voltar</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{org.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{org.segment} · CNPJ: {org.cnpj ?? '—'}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {tab === 'facilities' && <button className="btn-primary btn-sm inline-flex items-center gap-1.5" onClick={() => setModal('facility')}><Plus className="w-3.5 h-3.5" /> Nova barragem</button>}
          {tab === 'users' && <button className="btn-primary btn-sm inline-flex items-center gap-1.5" onClick={() => setModal('user')}><Plus className="w-3.5 h-3.5" /> Novo usuário</button>}
          {tab === 'cycles' && <button className="btn-primary btn-sm inline-flex items-center gap-1.5" onClick={() => setModal('cycle')}><Plus className="w-3.5 h-3.5" /> Novo ciclo</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Barragens */}
      {tab === 'facilities' && (
        <div className="card divide-y divide-gray-50">
          {(facilities ?? []).length === 0 && <div className="p-8 text-center text-gray-400"><div className="text-3xl mb-2">🏗️</div><p className="text-sm font-medium text-gray-500">Nenhuma barragem cadastrada</p></div>}
          {(facilities ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 flex-shrink-0">🏔️</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{f.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{f.dam_type} · Classe: {f.consequence_class} · {f.operational_status}</div>
              </div>
              <span className={`badge ${f.operational_status === 'Ativa' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{f.operational_status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Usuários */}
      {tab === 'users' && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Para criar usuários:</strong> acesse o painel do Supabase → Authentication → Users → Add user. Depois configure o perfil e organização aqui.
            </div>
          </div>
          <div className="card divide-y divide-gray-50">
            {(users ?? []).length === 0 && <div className="p-8 text-center text-gray-400"><div className="text-3xl mb-2">👥</div><p className="text-sm font-medium text-gray-500">Nenhum usuário nesta organização</p></div>}
            {(users ?? []).map((u: any) => (
              <div key={u.id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 rounded-full bg-brand-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {u.full_name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{u.full_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{u.job_title ?? '—'}</div>
                </div>
                <span className="badge bg-blue-50 text-blue-700">{ROLE_LABELS[u.role] ?? u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ciclos */}
      {tab === 'cycles' && (
        <div className="card divide-y divide-gray-50">
          {(cycles ?? []).length === 0 && <div className="p-8 text-center text-gray-400"><div className="text-3xl mb-2">📅</div><p className="text-sm font-medium text-gray-500">Nenhum ciclo cadastrado</p></div>}
          {(cycles ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.tailings_facilities?.name} · Ano {c.reference_year}</div>
              </div>
              <div className="text-right">
                {c.overall_score != null && <div className="text-sm font-bold text-brand-600">{c.overall_score}%</div>}
                <span className={`badge ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{c.status === 'active' ? 'Ativo' : c.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'user' && <CreateUserModal orgId={org.id} orgName={org.name} onClose={() => setModal(null)} />}
      {modal === 'facility' && <CreateFacilityModal orgId={org.id} orgName={org.name} onClose={() => setModal(null)} />}
      {modal === 'cycle' && <CreateCycleModal orgId={org.id} orgName={org.name} onClose={() => setModal(null)} />}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export function ClientsPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<any>(null)

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      let q = supabase.from('organizations').select('*, profiles(count), tailings_facilities(count), assessment_cycles(id,status,overall_score)').eq('is_active', true).order('name')
      if (!hb && profile?.organization_id) q = (q as any).eq('id', profile.organization_id)
      const { data } = await q
      return data ?? []
    },
    enabled: !!profile,
  })

  if (selectedOrg) return <OrgDetail org={selectedOrg} onBack={() => setSelectedOrg(null)} />

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Portfólio de Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orgs?.length ?? 0} organização{orgs?.length !== 1 ? 'ões' : ''} ativa{orgs?.length !== 1 ? 's' : ''}</p>
        </div>
        {hb && <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Nova organização</button>}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando...</span></div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {(orgs ?? []).length === 0 && (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Nenhuma organização cadastrada</p>
              {hb && <button className="btn-primary mt-4" onClick={() => setShowCreate(true)}>Criar primeira organização</button>}
            </div>
          )}
          {(orgs ?? []).map((org: any) => {
            const activeCycle = org.assessment_cycles?.find((c: any) => c.status === 'active')
            const initials = org.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('')
            return (
              <div key={org.id} className="flex items-center gap-4 p-5 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedOrg(org)}>
                <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{org.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{org.segment ?? '—'} · CNPJ: {org.cnpj ?? '—'}</div>
                </div>
                <div className="flex items-center gap-6 text-center flex-shrink-0">
                  {activeCycle && (
                    <div>
                      <div className="text-lg font-bold text-brand-600">{activeCycle.overall_score ?? 0}%</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">Conformidade</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-gray-700">{org.tailings_facilities?.[0]?.count ?? 0}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Barragens</div>
                  </div>
                  {activeCycle
                    ? <span className="badge bg-emerald-50 text-emerald-700">Ciclo ativo</span>
                    : <span className="badge bg-gray-100 text-gray-500">Sem ciclo</span>}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
