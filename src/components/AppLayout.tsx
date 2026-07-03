// src/components/AppLayout.tsx
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { LayoutDashboard, ClipboardList, Paperclip, CheckSquare, GraduationCap, Building2, Bell, LogOut, Shield, Settings, Users } from 'lucide-react'

const NAV = [
  { section: 'Principal', items: [
    { to: '/dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
    { to: '/requirements', label: 'Requisitos',        icon: ClipboardList },
    { to: '/evidences',    label: 'Evidências',        icon: Paperclip },
    { to: '/action-plan',  label: 'Plano de Ação',     icon: CheckSquare },
  ]},
  { section: 'Capacitação', items: [
    { to: '/academy', label: 'HBR Academy', icon: GraduationCap },
  ]},
  { section: 'Gestão', items: [
    { to: '/clients',            label: 'Portfólio de Clientes', icon: Building2, hidrOnly: true },
    { to: '/hidrobr-team',       label: 'Equipe HIDROBR',        icon: Users,     adminOnly: true },
    { to: '/standards-settings', label: 'Config. Padrões',       icon: Settings,  adminOnly: true },
    { to: '/notifications',      label: 'Notificações',          icon: Bell },
  ]},
]

export function AppLayout() {
  const { profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const hb = isHidrobr(profile?.role)
  const isAdmin = profile?.role === 'hidrobr_admin'
  const initials = profile?.full_name?.split(' ').slice(0,2).map((n:string)=>n[0]).join('')??'?'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-60 bg-brand-900 flex flex-col flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8 h-[60px]">
          <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white leading-none">HIDROBR</div>
            <div className="text-[10px] text-white/35 uppercase tracking-widest">Sustainability Manager</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(section => (
            <div key={section.section} className="mb-1">
              <div className="text-[10px] text-white/30 uppercase tracking-wider px-4 py-2 mt-1">{section.section}</div>
              {section.items.filter(item => {
                if('hidrOnly' in item && item.hidrOnly && !hb) return false
                if('adminOnly' in item && item.adminOnly && !isAdmin) return false
                return true
              }).map(item => {
                const Icon = item.icon
                const active = location.pathname.startsWith(item.to)
                return (
                  <div key={item.to} className={`sidebar-item ${active?'active':''}`} onClick={()=>navigate(item.to)}>
                    <Icon className="w-4 h-4 flex-shrink-0"/>
                    <span className="flex-1">{item.label}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/7">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/6 cursor-pointer">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${hb?'bg-accent-500 text-brand-900':'bg-brand-400 text-white'}`}>{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-white truncate">{profile?.full_name}</div>
              <div className="text-[10px] text-white/35 truncate">
                {profile?.role==='hidrobr_admin'?'Admin HIDROBR':profile?.role==='hidrobr_consultant'?'Consultor HIDROBR':profile?.role==='client_admin'?'Admin Cliente':profile?.role==='client_user'?'Usuário Cliente':'Visualizador'}
              </div>
            </div>
            <button onClick={logout} className="text-white/30 hover:text-white/70 p-1 rounded" title="Sair"><LogOut className="w-3.5 h-3.5"/></button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-[60px] bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1"><span className="text-sm text-gray-400">{profile?.organization?.name??(hb?'HIDROBR Soluções Integradas':'')}</span></div>
          <button onClick={()=>navigate('/notifications')} className="relative w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"><Bell className="w-4 h-4"/></button>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet/></main>
      </div>
    </div>
  )
}
