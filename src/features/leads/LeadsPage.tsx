// src/features/leads/LeadsPage.tsx
// Painel interno para gerenciar leads do Self Assessment público
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, ChevronDown, ChevronUp, UserPlus, X, Building2, Mail, Phone, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  new:       { label: 'Novo',       cls: 'bg-blue-50 text-blue-700' },
  contacted: { label: 'Contactado', cls: 'bg-amber-50 text-amber-700' },
  converted: { label: 'Convertido', cls: 'bg-emerald-50 text-emerald-700' },
  discarded: { label: 'Descartado', cls: 'bg-gray-100 text-gray-500' },
}

const TOPICS_SHORT = [
  { code: 'T1', label: 'Comunidades', color: '#1B4F72' },
  { code: 'T2', label: 'Conhecimento', color: '#117A65' },
  { code: 'T3', label: 'Projeto/Op.', color: '#7D6608' },
  { code: 'T4', label: 'Governança', color: '#6E2F1A' },
  { code: 'T5', label: 'Emergência', color: '#922B21' },
  { code: 'T6', label: 'Divulgação', color: '#1A5276' },
]

// ── Modal de conversão em cliente ─────────────────────────────
function ConvertModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    org_name: lead.company_name,
    dam_name: lead.dam_name,
    cycle_name: `Ciclo ${new Date().getFullYear()} — ${lead.company_name}`,
    segment: lead.segment ?? '',
  })

  async function handleConvert() {
    setSaving(true); setError('')
    try {
      // 1. Criar organização
      const { data: org, error: orgErr } = await supabase.from('organizations').insert({
        name: form.org_name,
        segment: form.segment || null,
        is_active: true,
      }).select('id').single()
      if (orgErr) throw orgErr

      // 2. Criar barragem
      const { data: facility, error: facErr } = await supabase.from('tailings_facilities').insert({
        organization_id: org.id,
        name: form.dam_name,
        is_active: true,
        operational_status: 'Ativa',
        consequence_class: 'Alto',
        dam_type: 'Montante',
      }).select('id').single()
      if (facErr) throw facErr

      // 3. Criar ciclo ativo
      const { data: cycle, error: cycErr } = await supabase.from('assessment_cycles').insert({
        organization_id: org.id,
        facility_id: facility.id,
        facility_ids: [facility.id],
        name: form.cycle_name,
        reference_year: new Date().getFullYear(),
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
      }).select('id').single()
      if (cycErr) throw cycErr

      // 4. Pré-preencher respostas com o self assessment
      // Busca os princípios para mapear códigos → IDs dos requisitos
      const { data: principles } = await supabase.from('gistm_principles').select('id, code')
      const { data: requirements } = await supabase.from('gistm_requirements').select('id, code, principle_id')

      const principleByCode = new Map((principles ?? []).map((p: any) => [p.code, p]))

      // Para cada princípio respondido, cria respostas para os requisitos
      const insertResponses: any[] = []
      Object.entries(lead.answers ?? {}).forEach(([pCode, score]: [string, any]) => {
        const principle = principleByCode.get(pCode)
        if (!principle) return
        const pReqs = (requirements ?? []).filter((r: any) => r.principle_id === principle.id)
        pReqs.forEach((req: any) => {
          const status = score >= 75 ? 'submitted' : score >= 50 ? 'in_progress' : 'in_progress'
          insertResponses.push({
            cycle_id: cycle.id,
            facility_id: facility.id,
            requirement_id: req.id,
            implementation_text: `Pré-preenchido via Self Assessment público (${new Date().toLocaleDateString('pt-BR')}). Score declarado: ${score}/100.`,
            status,
          })
        })
      })

      if (insertResponses.length > 0) {
        const { error: respErr } = await supabase.from('requirement_responses').insert(insertResponses)
        if (respErr) console.warn('Erro ao pré-preencher respostas:', respErr)
      }

      // 5. Marcar lead como convertido
      await supabase.from('public_assessments').update({
        status: 'converted',
        converted_org_id: org.id,
        converted_by: profile!.id,
        converted_at: new Date().toISOString(),
      }).eq('id', lead.id)

      qc.invalidateQueries({ queryKey: ['leads'] })
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Erro ao converter lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Converter lead em cliente</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-brand-800">
            Isso vai criar automaticamente uma <strong>organização</strong>, uma <strong>barragem</strong> e um <strong>ciclo ativo</strong>, com as respostas do self assessment pré-preenchidas como ponto de partida.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Razão social</label>
            <input className="form-input" value={form.org_name} onChange={e => setForm({ ...form, org_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da barragem</label>
            <input className="form-input" value={form.dam_name} onChange={e => setForm({ ...form, dam_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do ciclo</label>
            <input className="form-input" value={form.cycle_name} onChange={e => setForm({ ...form, cycle_name: e.target.value })} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: saving ? '#9CA3AF' : '#002B3D', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
            onClick={handleConvert} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Converter em cliente
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card do lead ──────────────────────────────────────────────
function LeadCard({ lead }: { lead: any }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [converting, setConverting] = useState(false)
  const s = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new
  const score = Math.round(lead.overall_score ?? 0)
  const scoreColor = score >= 75 ? '#059669' : score >= 50 ? '#2563EB' : score >= 25 ? '#D97706' : '#DC2626'

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      await supabase.from('public_assessments').update({ status }).eq('id', lead.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })

  return (
    <>
      <div className="card p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-4">
          {/* Score */}
          <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
            style={{ background: scoreColor + '15' }}>
            <div className="text-lg font-extrabold leading-none" style={{ color: scoreColor }}>{score}%</div>
            <div className="text-[9px] text-gray-400 mt-0.5">GISTM</div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-gray-900 truncate">{lead.company_name}</span>
              <span className={`badge text-[10px] ${s.cls}`}>{s.label}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{lead.dam_name}{lead.dam_count > 1 ? ` +${lead.dam_count - 1}` : ''}</span>
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.contact_email}</span>
              {lead.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.contact_phone}</span>}
              {lead.state && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.state}</span>}
              <span>{lead.contact_name}{lead.contact_role ? ` · ${lead.contact_role}` : ''}</span>
              <span>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
            </div>

            {/* Scores por tópico */}
            <div className="flex gap-2 mt-2">
              {TOPICS_SHORT.map(t => {
                const ts = Math.round(lead.scores_by_topic?.[t.code] ?? 0)
                return (
                  <div key={t.code} className="text-center">
                    <div className="text-[9px] font-bold mb-0.5" style={{ color: t.color }}>{t.code}</div>
                    <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${ts}%`, background: t.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {lead.status === 'new' && (
              <>
                <button
                  className="text-xs text-brand-600 border border-brand-200 hover:bg-brand-50 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  onClick={() => updateStatus.mutate('contacted')}>
                  Marcar contactado
                </button>
                <button
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
                  onClick={() => setConverting(true)}>
                  <UserPlus className="w-3.5 h-3.5" /> Converter
                </button>
              </>
            )}
            {lead.status === 'contacted' && (
              <button
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: '#002B3D', color: 'white', border: 'none', cursor: 'pointer' }}
                onClick={() => setConverting(true)}>
                <UserPlus className="w-3.5 h-3.5" /> Converter em cliente
              </button>
            )}
            {lead.status === 'new' && (
              <button className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition-colors"
                onClick={() => updateStatus.mutate('discarded')}>Descartar</button>
            )}
            <button onClick={() => setExpanded(!expanded)}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Respostas expandidas */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Respostas por princípio</div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(lead.answers ?? {}).map(([code, val]: [string, any]) => {
                const v = Math.round(val)
                const c = v >= 75 ? '#059669' : v >= 50 ? '#2563EB' : v >= 25 ? '#D97706' : '#DC2626'
                const l = v === 100 ? 'Auditado' : v === 75 ? 'Formal' : v === 50 ? 'Parcial' : 'Não impl.'
                return (
                  <div key={code} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-2">
                    <span className="text-[10px] font-bold text-gray-400 w-7 flex-shrink-0">{code}</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v}%`, background: c }} />
                    </div>
                    <span className="text-[9px] font-semibold w-12 text-right" style={{ color: c }}>{l}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {converting && <ConvertModal lead={lead} onClose={() => setConverting(false)} />}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────
export function LeadsPage() {
  const { profile } = useAuthStore()
  const [filterStatus, setFilterStatus] = useState('all')

  if (profile?.role !== 'hidrobr_admin') return <Navigate to="/dashboard" replace />

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filterStatus],
    queryFn: async () => {
      let q = supabase.from('public_assessments')
        .select('*').order('created_at', { ascending: false })
      if (filterStatus !== 'all') q = q.eq('status', filterStatus)
      const { data } = await q
      return data ?? []
    },
  })

  const all = data ?? []
  const kpis = {
    total: all.length,
    new: all.filter((l: any) => l.status === 'new').length,
    contacted: all.filter((l: any) => l.status === 'contacted').length,
    converted: all.filter((l: any) => l.status === 'converted').length,
    avgScore: all.length ? Math.round(all.reduce((s: number, l: any) => s + (l.overall_score ?? 0), 0) / all.length) : 0,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads — Self Assessment</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Empresas que preencheram o formulário público em{' '}
            <a href="/assessment" target="_blank" className="text-brand-600 hover:underline">
              /assessment
            </a>
          </p>
        </div>
        <a href="/assessment" target="_blank"
          className="text-xs px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-semibold">
          Ver formulário público ↗
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total leads', value: kpis.total, color: '#0A9396' },
          { label: 'Novos', value: kpis.new, color: '#3B82F6' },
          { label: 'Contactados', value: kpis.contacted, color: '#D97706' },
          { label: 'Convertidos', value: kpis.converted, color: '#059669' },
          { label: 'Score médio', value: `${kpis.avgScore}%`, color: '#6B7280' },
        ].map(k => (
          <div key={k.label} className="card p-3 text-center" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {[['all','Todos'],['new','Novos'],['contacted','Contactados'],['converted','Convertidos'],['discarded','Descartados']].map(([v,l]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterStatus===v?'bg-brand-900 text-white border-brand-900':'bg-white text-gray-600 border-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-sm">Carregando leads...</span>
        </div>
      ) : all.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">Nenhum lead ainda</p>
          <p className="text-gray-400 text-sm mt-1">Compartilhe o link do formulário público para começar a captar leads</p>
          <div className="mt-4 bg-gray-50 rounded-lg px-4 py-3 text-sm font-mono text-gray-600 inline-block">
            {window.location.origin}/assessment
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {all.map((lead: any) => <LeadCard key={lead.id} lead={lead} />)}
        </div>
      )}
    </div>
  )
}
