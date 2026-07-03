// src/features/team/CreateHidrobrUserModal.tsx
// Modal para criar usuário HIDROBR via Edge Function
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Save, Loader2 } from 'lucide-react'
import { createUser } from '@/lib/createUser'

export function CreateHidrobrUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    role: 'hidrobr_consultant', job_title: '', phone: '',
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      const result = await createUser({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        organization_id: null,
        job_title: form.job_title || undefined,
        phone: form.phone || undefined,
      })
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hidrobr-team'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Novo membro — Equipe HIDROBR</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="form-label">Nome completo *</label>
            <input className="form-input" placeholder="Dr. Ricardo Mendes"
              value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}/>
          </div>
          <div>
            <label className="form-label">E-mail *</label>
            <input type="email" className="form-input" placeholder="consultor@hidrobr.com.br"
              value={form.email} onChange={e => setForm({...form, email: e.target.value})}/>
          </div>
          <div>
            <label className="form-label">Senha temporária * (mín. 8 caracteres)</label>
            <input type="password" className="form-input" placeholder="Mínimo 8 caracteres"
              value={form.password} onChange={e => setForm({...form, password: e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Cargo</label>
              <input className="form-input" placeholder="Consultor Sênior"
                value={form.job_title} onChange={e => setForm({...form, job_title: e.target.value})}/>
            </div>
            <div>
              <label className="form-label">Telefone</label>
              <input className="form-input" placeholder="+55 31 99999-0000"
                value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
            </div>
          </div>
          <div>
            <label className="form-label">Perfil de acesso</label>
            <select className="form-input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="hidrobr_consultant">Consultor HIDROBR</option>
              <option value="hidrobr_admin">Administrador HIDROBR</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'8px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:'600',background: mut.isPending||!form.full_name||!form.email||form.password.length<8?'#9CA3AF':'#002B3D',color:'white',border:'none',cursor: mut.isPending||!form.full_name||!form.email||form.password.length<8?'not-allowed':'pointer'}}
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.full_name || !form.email || form.password.length < 8}
          >
            {mut.isPending?<><Loader2 className="w-4 h-4 animate-spin"/>Criando...</>:<><Save className="w-4 h-4"/>Criar membro</>}
          </button>
        </div>
      </div>
    </div>
  )
}
