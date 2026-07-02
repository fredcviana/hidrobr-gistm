// src/features/notifications/NotificationsPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Loader2, AlertCircle, CheckCircle2, Clock, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

const TYPE_CONFIG: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  assessment_requested: { icon: Clock, cls: 'bg-amber-50 text-amber-600', label: 'Avaliação solicitada' },
  assessment_completed: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600', label: 'Avaliação concluída' },
  revision_requested: { icon: AlertCircle, cls: 'bg-red-50 text-red-600', label: 'Revisão solicitada' },
  evidence_uploaded: { icon: Bell, cls: 'bg-blue-50 text-blue-600', label: 'Evidência enviada' },
  deadline_reminder: { icon: Clock, cls: 'bg-orange-50 text-orange-600', label: 'Lembrete de prazo' },
  academy_content: { icon: BookOpen, cls: 'bg-purple-50 text-purple-600', label: 'Novo conteúdo Academy' },
  system_alert: { icon: AlertCircle, cls: 'bg-gray-50 text-gray-600', label: 'Alerta do sistema' },
}

export function NotificationsPage() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', profile?.id] }),
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile!.id).eq('is_read', false)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', profile?.id] }),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', profile?.id] }),
  })

  const unread = (data ?? []).filter((n: any) => !n.is_read).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notificações</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unread > 0 ? `${unread} não lida${unread !== 1 ? 's' : ''}` : 'Todas as notificações lidas'}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn-secondary inline-flex items-center gap-2" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando...</span></div>
      ) : (data ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Nenhuma notificação</p>
          <p className="text-gray-400 text-sm mt-1">Você receberá notificações sobre avaliações, evidências e prazos</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {(data ?? []).map((notif: any) => {
            const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system_alert
            const Icon = cfg.icon
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 p-4 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900">{notif.title}</span>
                    {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                  </div>
                  {notif.body && <p className="text-xs text-gray-500 mb-1">{notif.body}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span className={`badge text-[10px] ${cfg.cls} border-0`}>{cfg.label}</span>
                    <span>{new Date(notif.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {notif.link && (
                    <a href={notif.link} className="btn-secondary btn-sm text-xs">Ver</a>
                  )}
                  {!notif.is_read && (
                    <button className="btn-secondary btn-sm text-xs" onClick={() => markRead.mutate(notif.id)}>
                      Marcar lida
                    </button>
                  )}
                  <button className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded"
                    onClick={() => deleteMut.mutate(notif.id)}>
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info sobre notificações automáticas */}
      <div className="mt-6 card p-4 bg-brand-50 border-brand-200">
        <p className="text-sm text-brand-700 font-semibold mb-1">Notificações automáticas</p>
        <p className="text-xs text-brand-600">
          O sistema gera notificações automaticamente quando: um princípio é submetido para avaliação, uma avaliação HIDROBR é publicada, uma revisão é solicitada, ou um prazo está se aproximando.
        </p>
      </div>
    </div>
  )
}
