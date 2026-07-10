// src/features/clients/CreateCycleModal.tsx
// Modal para criar ciclo com uma ou mais barragens
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Save, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  orgId: string
  orgName: string
  onClose: () => void
}

export function CreateCycleModal({ orgId, orgName, onClose }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    reference_year: new Date().getFullYear().toString(),
    start_date: new Date().toISOString().split('T')[0],
    target_date: '',
    facility_ids: [] as string[],
  })
  const [error, setError] = useState('')

  const { data: facilities } = useQuery({
    queryKey: ['org-facilities-cycle', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('tailings_facilities')
        .select('id,name').eq('organization_id', orgId).eq('is_active', true).order('name')
      return data ?? []
    },
  })

  function toggleFacility(id: string) {
    setForm(f => ({
      ...f,
      facility_ids: f.facility_ids.includes(id)
        ? f.facility_ids.filter(x => x !== id)
        : [...f.facility_ids, id],
    }))
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (form.facility_ids.length === 0) throw new Error('Selecione pelo menos uma barragem')
      if (!form.name) throw new Error('Informe o nome do ciclo')

      // Cria o ciclo com a primeira barragem no campo legacy e o array no novo campo
      const { error } = await supabase.from('assessment_cycles').insert({
        organization_id: orgId,
        facility_id: form.facility_ids[0], // compatibilidade com campo antigo
        facility_ids: form.facility_ids,   // novo campo multi-estrutura
        name: form.name,
        reference_year: parseInt(form.reference_year),
        start_date: form.start_date,
        target_date: form.target_date || null,
        status: 'active',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-cycles', orgId] })
      onClose()
    },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">Novo ciclo — {orgName}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Barragens — seletor múltiplo */}
          <div>
            <label className="form-label">
              Estruturas associadas *
              <span className="text-gray-400 font-normal ml-1">
                (cada barragem selecionada será avaliada individualmente; o resultado do cliente é a média entre elas)
              </span>
            </label>
            {(facilities ?? []).length === 0 ? (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Nenhuma barragem cadastrada para esta organização. Cadastre uma barragem primeiro.
              </div>
            ) : (
              <div className="space-y-2">
                {(facilities ?? []).map((f: any) => {
                  const selected = form.facility_ids.includes(f.id)
                  return (
                    <div key={f.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${selected ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                      onClick={() => toggleFacility(f.id)}>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition-all ${selected ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                        {selected && <span className="text-white text-[11px] font-bold">✓</span>}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{f.name}</span>
                      {selected && <span className="ml-auto text-[10px] font-semibold text-brand-600">Selecionada</span>}
                    </div>
                  )
                })}
              </div>
            )}
            {form.facility_ids.length > 0 && (
              <p className="text-xs text-brand-600 mt-1.5 font-medium">
                {form.facility_ids.length} estrutura{form.facility_ids.length > 1 ? 's' : ''} selecionada{form.facility_ids.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Nome do ciclo */}
          <div>
            <label className="form-label">Nome do ciclo *</label>
            <input className="form-input" placeholder="Ex: Ciclo 2025 — Avaliação GISTM"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Ano de referência</label>
              <input type="number" className="form-input"
                value={form.reference_year} onChange={e => setForm({ ...form, reference_year: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Data de início</label>
              <input type="date" className="form-input"
                value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Prazo alvo</label>
              <input type="date" className="form-input"
                value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: mut.isPending || !form.name || form.facility_ids.length === 0 ? '#9CA3AF' : '#002B3D', color: 'white', border: 'none', cursor: mut.isPending || !form.name || form.facility_ids.length === 0 ? 'not-allowed' : 'pointer' }}
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.name || form.facility_ids.length === 0}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Criar ciclo
          </button>
        </div>
      </div>
    </div>
  )
}
