// src/features/academy/AcademyPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, Video, FileText, Award, Loader2, X, Save, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isHidrobr } from '@/store/authStore'

const CONTENT_ICONS: Record<string, React.ElementType> = {
  video: Video, article: BookOpen, document: FileText, webinar: Video, quiz: Award
}
const CONTENT_LABELS: Record<string, string> = {
  video: 'Vídeo', article: 'Artigo', document: 'Documento', webinar: 'Webinar', quiz: 'Quiz', infographic: 'Infográfico'
}
const DIFFICULTY_LABELS: Record<string, { label: string; cls: string }> = {
  beginner: { label: 'Iniciante', cls: 'bg-green-50 text-green-700' },
  intermediate: { label: 'Intermediário', cls: 'bg-amber-50 text-amber-700' },
  advanced: { label: 'Avançado', cls: 'bg-red-50 text-red-700' },
}

function CreateContentModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', summary: '', content_type: 'article', media_url: '', duration_minutes: '', difficulty_level: 'beginner', is_published: true })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('academy_contents').insert({
        ...form,
        created_by: profile!.id,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        is_published: form.is_published,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['academy'] }); onClose() },
    onError: (e: any) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base font-bold text-gray-900">Novo conteúdo Academy</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="form-label">Título *</label>
            <input className="form-input" placeholder="Ex: Introdução ao GISTM" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Resumo</label>
            <textarea className="form-input resize-none" rows={2} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value })}>
                {Object.entries(CONTENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Nível</label>
              <select className="form-input" value={form.difficulty_level} onChange={e => setForm({ ...form, difficulty_level: e.target.value })}>
                {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Duração (min)</label>
              <input type="number" className="form-input" placeholder="30" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="form-label">URL do conteúdo</label>
            <input className="form-input" placeholder="https://..." value={form.media_url} onChange={e => setForm({ ...form, media_url: e.target.value })} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="published" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 text-brand-600" />
            <label htmlFor="published" className="text-sm text-gray-700">Publicar imediatamente</label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => mut.mutate()} disabled={mut.isPending || !form.title}>
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar conteúdo
          </button>
        </div>
      </div>
    </div>
  )
}

export function AcademyPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const isAdmin = profile?.role === 'hidrobr_admin'
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')

  const { data: contents, isLoading } = useQuery({
    queryKey: ['academy', filterType, filterLevel],
    queryFn: async () => {
      let q = supabase.from('academy_contents').select('*').order('created_at', { ascending: false })
      if (!hb) q = q.eq('is_published', true)
      if (filterType !== 'all') q = q.eq('content_type', filterType)
      if (filterLevel !== 'all') q = q.eq('difficulty_level', filterLevel)
      const { data } = await q
      return data ?? []
    },
  })

  const { data: progress } = useQuery({
    queryKey: ['my-progress', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase.from('user_progress').select('*').eq('user_id', profile!.id)
      return new Map((data ?? []).map((p: any) => [p.content_id, p]))
    },
  })

  const markDone = useMutation({
    mutationFn: async (contentId: string) => {
      const existing = progress?.get(contentId)
      if (existing) {
        await supabase.from('user_progress').update({ completed: true, completed_at: new Date().toISOString(), progress_pct: 100 }).eq('id', existing.id)
      } else {
        await supabase.from('user_progress').insert({ user_id: profile!.id, content_id: contentId, completed: true, completed_at: new Date().toISOString(), progress_pct: 100 })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-progress', profile?.id] }),
  })

  const togglePublish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      await supabase.from('academy_contents').update({ is_published: published }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academy'] }),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await supabase.from('academy_contents').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academy'] }),
  })

  const myProgress = progress ?? new Map()
  const completedCount = contents?.filter((c: any) => myProgress.get(c.id)?.completed).length ?? 0
  const totalCount = contents?.length ?? 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">GISTM Academy</h1>
          <p className="text-sm text-gray-500 mt-0.5">Trilhas de capacitação em gestão de barragens de rejeitos</p>
        </div>
        {isAdmin && <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Novo conteúdo</button>}
      </div>

      {/* Progresso pessoal */}
      {totalCount > 0 && (
        <div className="card p-5 mb-6 bg-gradient-to-r from-brand-900 to-brand-700 border-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-white font-bold">Seu progresso</div>
              <div className="text-brand-300 text-sm">{completedCount} de {totalCount} conteúdos concluídos</div>
            </div>
            <div className="text-3xl font-black text-white">{totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%</div>
          </div>
          <div className="w-full h-2 bg-brand-800 rounded-full overflow-hidden">
            <div className="h-full bg-accent-500 rounded-full transition-all duration-700" style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-4 mb-5">
        <div className="flex gap-2">
          {[['all', 'Todos'], ['video', 'Vídeos'], ['article', 'Artigos'], ['document', 'Documentos'], ['quiz', 'Quizzes']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterType(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filterType === v ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-gray-600 border-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        <select className="form-input w-40 text-xs" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="all">Todos os níveis</option>
          {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Grid de conteúdos */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /><span className="text-sm">Carregando...</span></div>
      ) : (contents ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Nenhum conteúdo disponível</p>
          {isAdmin && <button className="btn-primary mt-4" onClick={() => setShowCreate(true)}>Criar primeiro conteúdo</button>}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(contents ?? []).map((content: any) => {
            const Icon = CONTENT_ICONS[content.content_type] ?? FileText
            const done = myProgress.get(content.id)?.completed ?? false
            const diff = DIFFICULTY_LABELS[content.difficulty_level]
            return (
              <div key={content.id} className={`card overflow-visible ${done ? 'ring-2 ring-emerald-300' : ''}`}>
                <div className={`h-2 ${done ? 'bg-emerald-500' : 'bg-brand-400'}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>
                      {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    {!content.is_published && <span className="badge bg-gray-100 text-gray-500 text-[10px]">Rascunho</span>}
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-1 line-clamp-2">{content.title}</div>
                  {content.summary && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{content.summary}</p>}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="badge bg-blue-50 text-blue-700 text-[10px]">{CONTENT_LABELS[content.content_type] ?? content.content_type}</span>
                    {diff && <span className={`badge text-[10px] ${diff.cls}`}>{diff.label}</span>}
                    {content.duration_minutes && <span className="text-[10px] text-gray-400">{content.duration_minutes} min</span>}
                  </div>
                  <div className="flex gap-2">
                    {content.media_url && (
                      <a href={content.media_url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm flex-1 justify-center text-xs">
                        Acessar
                      </a>
                    )}
                    {!done ? (
                      <button className="btn-success btn-sm flex-1 justify-center text-xs inline-flex items-center gap-1"
                        onClick={() => markDone.mutate(content.id)}>
                        <CheckCircle2 className="w-3 h-3" /> Concluir
                      </button>
                    ) : (
                      <span className="btn-sm flex-1 text-center text-xs text-emerald-600 font-semibold">✓ Concluído</span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                      <button className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
                        onClick={() => togglePublish.mutate({ id: content.id, published: !content.is_published })}>
                        {content.is_published ? 'Despublicar' : 'Publicar'}
                      </button>
                      <span className="text-gray-200">|</span>
                      <button className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        onClick={() => { if (confirm('Remover este conteúdo?')) deleteMut.mutate(content.id) }}>
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateContentModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
