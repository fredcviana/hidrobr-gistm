// src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { TsmDashboardPage } from '@/features/dashboard/TsmDashboardPage'
import { IntegratedDashboardPage } from '@/features/dashboard/IntegratedDashboardPage'
import { FacilityComparisonPage } from '@/features/dashboard/FacilityComparisonPage'
import { RequirementsPage } from '@/features/requirements/RequirementsPage'
import { EvidencesPage } from '@/features/evidences/EvidencesPage'
import { ActionPlanPage } from '@/features/action-plan/ActionPlanPage'
import { AcademyPage } from '@/features/academy/AcademyPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { StandardsSettingsPage } from '@/features/settings/StandardsSettingsPage'
import { HidrobrTeamPage } from '@/features/team/HidrobrTeamPage'
import { LeadsPage } from '@/features/leads/LeadsPage'
import { TsmRequirementsPage } from '@/features/requirements/TsmRequirementsPage'
import { PublicAssessmentPage } from '@/features/assessment/PublicAssessmentPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900">
      <div className="text-white text-center">
        <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Carregando...</p>
      </div>
    </div>
  )
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(profile)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [setProfile, setLoading])

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública — sem login */}
        <Route path="/assessment" element={<PublicAssessmentPage />} />

        {/* Rotas autenticadas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard-tsm" element={<TsmDashboardPage />} />
          <Route path="dashboard-integrado" element={<IntegratedDashboardPage />} />
          <Route path="dashboard-barragens" element={<FacilityComparisonPage />} />
          <Route path="requirements" element={<RequirementsPage />} />
          <Route path="evidences" element={<EvidencesPage />} />
          <Route path="action-plan" element={<ActionPlanPage />} />
          <Route path="academy" element={<AcademyPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="requirements-tsm" element={<TsmRequirementsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="standards-settings" element={<StandardsSettingsPage />} />
          <Route path="hidrobr-team" element={<HidrobrTeamPage />} />
          <Route path="gistm-settings" element={<Navigate to="/standards-settings" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
