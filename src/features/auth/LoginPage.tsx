// src/features/auth/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // "Esqueci minha senha" — self-service via e-mail do Supabase, para não depender
  // de um admin (ou de mim) redefinindo senha manualmente pelo dashboard toda vez.
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotErr, setForgotErr] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : err.message ?? 'Erro ao fazer login.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotErr(''); setForgotMsg(''); setForgotLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setForgotMsg('Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha em instantes.')
    } catch (err: any) {
      setForgotErr(err.message?.includes('rate limit')
        ? 'Muitos pedidos de redefinição em pouco tempo. Aguarde alguns minutos e tente de novo.'
        : err.message ?? 'Erro ao solicitar redefinição de senha.')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <img src="/logo.png" alt="HIDROBR" className="h-16 w-auto" />
          <div className="text-xs text-white/40 uppercase tracking-widest">Sustainability Manager</div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!forgotMode ? (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Bem-vindo</h1>
              <p className="text-sm text-gray-500 mb-6">Entre com suas credenciais para acessar o sistema</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="form-label">E-mail</label>
                  <input type="email" className="form-input" placeholder="seu@email.com.br"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Senha</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="form-input pr-10"
                      placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="button"
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold mt-1.5"
                    onClick={() => { setForgotMode(true); setForgotEmail(email); setForgotMsg(''); setForgotErr('') }}>
                    Esqueci minha senha
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</> : 'Entrar no sistema'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Credenciais criadas no Supabase</p>
                <div className="space-y-2">
                  {[
                    { role: 'HIDROBR Admin', email: 'admin@hidrobr.com.br' },
                    { role: 'Consultor', email: 'consultor@hidrobr.com.br' },
                    { role: 'Cliente', email: 'cliente@mineracao.com.br' },
                  ].map(u => (
                    <div key={u.role} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                      <span className="font-semibold text-gray-700">{u.role}: </span>
                      <span className="text-gray-500">{u.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Redefinir senha</h1>
              <p className="text-sm text-gray-500 mb-6">Informe seu e-mail e enviaremos um link para você criar uma nova senha.</p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="form-label">E-mail</label>
                  <input type="email" className="form-input" placeholder="seu@email.com.br"
                    value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                </div>

                {forgotMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
                    {forgotMsg}
                  </div>
                )}
                {forgotErr && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {forgotErr}
                  </div>
                )}

                <button type="submit" disabled={forgotLoading} className="btn-primary w-full justify-center py-2.5 mt-2">
                  {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar link de redefinição'}
                </button>
                <button type="button"
                  className="text-xs text-gray-500 hover:text-gray-700 font-semibold w-full text-center"
                  onClick={() => { setForgotMode(false); setForgotMsg(''); setForgotErr('') }}>
                  ← Voltar para o login
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
