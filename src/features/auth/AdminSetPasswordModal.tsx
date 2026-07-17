// src/features/auth/AdminSetPasswordModal.tsx
// Modal para um hidrobr_admin definir uma nova senha para outro usuário
// já cadastrado, via Edge Function Update-User-Password (service_role).
import { useState } from 'react'
import { X, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { updateUserPassword } from '@/lib/updateUserPassword'

interface Props {
  userId: string
  userName: string
  onClose: () => void
}

export function AdminSetPasswordModal({ userId, userName, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      const result = await updateUserPassword({ user_id: userId, new_password: password })
      if (!result.success) throw new Error(result.error)
      setDone(true)
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setError(err.message ?? 'Erro ao atualizar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Trocar senha — {userName}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4"/></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Senha atualizada</h3>
            <p className="text-sm text-gray-500">A nova senha já está ativa para {userName}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="form-label">Nova senha</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="form-input pr-10"
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Confirmar nova senha</label>
              <input type={showPass ? 'text' : 'password'} className="form-input"
                placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar nova senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
