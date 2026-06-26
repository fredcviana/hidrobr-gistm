import { useAuthStore } from '@/store/authStore'

export function ClientsPage() {
  const user = useAuthStore(s => s.user)
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">clients</h1>
        <p className="text-sm text-gray-500 mt-1">Módulo em construção</p>
      </div>
      <div className="card p-8 text-center text-gray-400">
        <div className="text-4xl mb-3">🚧</div>
        <div className="font-semibold text-gray-600">Implementação em andamento</div>
        <div className="text-sm mt-1">Logado como: {user?.fullName} ({user?.role})</div>
      </div>
    </div>
  )
}
