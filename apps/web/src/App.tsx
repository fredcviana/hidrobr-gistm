// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { RequirementsPage } from '@/features/requirements/RequirementsPage'
import { EvidencesPage } from '@/features/evidences/EvidencesPage'
import { ActionPlanPage } from '@/features/action-plan/ActionPlanPage'
import { AcademyPage } from '@/features/academy/AcademyPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="requirements" element={<RequirementsPage />} />
          <Route path="evidences" element={<EvidencesPage />} />
          <Route path="action-plan" element={<ActionPlanPage />} />
          <Route path="academy" element={<AcademyPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
