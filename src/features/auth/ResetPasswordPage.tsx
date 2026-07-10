// src/features/auth/ResetPasswordPage.tsx
// Página para onde o Supabase redireciona o link de "esqueci minha senha"
// (ver resetPasswordForEmail em LoginPage.tsx). O próprio supabase-js já
// captura o token de recuperação presente na URL e abre uma sessão temporária
// (evento PASSWORD_RECOVERY) — aqui só pedimos a nova senha e chamamos
// auth.updateUser, sem nunca expor nem armazenar a senha em outro lugar.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    // O link de recuperação estabelece uma sessão assim que o supabase-js
    // processa o hash da URL. Damos um instante para isso acontecer antes de
    // decidir se o link é válido.
    let cancelled = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setReady(true); setInvalidLink(false) }
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) setReady(true)
      else setTimeout(() => { if (!cancelled) supabase.auth.getSession().then(({ data }) => {
        if (!cancelled && !data.session) setInvalidLink(true)
      }) }, 1500)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err: any) {
      setError(err.message ?? 'Erro ao definir nova senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <img src="/logo.png" alt="HIDROBR" className="h-16 w-auto" />
          <div className="text-xs text-white/40 uppercase tracking-widest">Sustainability Manager</div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-gray-900 mb-1">Senha atualizada</h1>
              <p className="text-sm text-gray-500">Redirecionando para o sistema...</p>
            </div>
          ) : invalidLink ? (
            <div className="text-center py-4">
              <h1 className="text-lg font-bold text-gray-900 mb-2">Link inválido ou expirado</h1>
              <p className="text-sm text-gray-500 mb-4">Solicite um novo link de redefinição na tela de login.</p>
              <button className="btn-primary" onClick={() => navigate('/login')}>Voltar para o login</button>
            </div>
          ) : !ready ? (
            <div className="flex items-center gap-3 text-gray-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
              <span className="text-sm">Validando link...</span>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Criar nova senha</h1>
              <p className="text-sm text-gray-500 mb-6">Defina uma nova senha de acesso (mín. 8 caracteres).</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Nova senha</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="form-input pr-10"
                      placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
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

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © 2025 HIDROBR Soluções Integradas
        </p>
      </div>
    </div>
  )
}
