import { useAuthStore } from '@/store/authStore'

export function AcademyPage() {
  const { profile } = useAuthStore()
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">academy</h1>
      <p className="text-sm text-gray-500 mb-6">Módulo em desenvolvimento</p>
      <div className="card p-10 text-center text-gray-400">
        <div className="text-4xl mb-3">🚧</div>
        <div className="font-medium text-gray-600">Em breve</div>
        <div className="text-sm mt-1">Logado como: {profile?.full_name} ({profile?.role})</div>
      </div>
    </div>
  )
}
