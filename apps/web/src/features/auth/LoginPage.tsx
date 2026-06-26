// apps/web/src/features/auth/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})
type Form = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: Form) {
    setServerError('')
    try {
      const result = await authApi.login(data.email, data.password)
      setAuth(result.user, result.accessToken, result.refreshToken)
      navigate('/dashboard')
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message ?? 'Erro ao fazer login. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen bg-[#002B3D] flex items-center justify-center p-4">
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

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Bem-vindo</h1>
          <p className="text-sm text-gray-500 mb-6">Entre com suas credenciais para acessar o sistema</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="form-label">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com.br"
                className={`form-input ${errors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* Senha */}
            <div>
              <label className="form-label">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`form-input pr-10 ${errors.password ? 'border-red-400' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</>
              ) : (
                'Entrar no sistema'
              )}
            </button>
          </form>

          {/* Credenciais de demo */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Credenciais de demonstração</p>
            <div className="space-y-2">
              {[
                { role: 'HIDROBR Admin', email: 'admin@hidrobr.com.br', pass: 'Hidrobr@2025!' },
                { role: 'Consultor HIDROBR', email: 'ricardo.mendes@hidrobr.com.br', pass: 'Hidrobr@2025!' },
                { role: 'Cliente Admin', email: 'ana.silva@mineracaoexemplo.com.br', pass: 'Cliente@2025!' },
              ].map((cred) => (
                <div key={cred.role} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <span className="font-semibold text-gray-700">{cred.role}: </span>
                  <span className="text-gray-500">{cred.email} / {cred.pass}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © 2025 HIDROBR Soluções Integradas · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
