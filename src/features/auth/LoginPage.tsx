// src/features/auth/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="min-h-screen bg-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-400 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">HIDROBR</div>
            <div className="text-xs text-white/40 uppercase tracking-widest">GISTM Manager</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
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
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © 2025 HIDROBR Soluções Integradas
        </p>
      </div>
    </div>
  )
}
