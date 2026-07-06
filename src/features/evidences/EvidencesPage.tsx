// src/features/evidences/EvidencesPage.tsx
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, Trash2, Loader2, FileText, Image, Table, Film, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isHidrobr } from '@/store/authStore'

const FILE_ICONS: Record<string, React.ElementType> = {
  'application/pdf': FileText,
  'image/jpeg': Image, 'image/png': Image, 'image/webp': Image,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': Table,
  'video/mp4': Film,
}
function fileIcon(mime?: string) {
  if (!mime) return FileText
  if (FILE_ICONS[mime]) return FILE_ICONS[mime]
  if (mime.startsWith('image/')) return Image
  if (mime.startsWith('video/')) return Film
  return FileText
}
function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function EvidencesPage() {
  const { profile } = useAuthStore()
  const hb = isHidrobr(profile?.role)
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cycleId, setCycleId] = useState('')
  const [selectedResponse, setSelectedResponse] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const { data: cycles } = useQuery({
    queryKey: ['cycles-evidences', profile?.organization_id],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase.from('assessment_cycles')
        .select('id,name').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(5)
      if (!hb && profile?.organization_id) q = q.eq('organization_id', profile.organization_id)
      const { data } = await q
      return data ?? []
    },
  })

  const activeCycleId = cycleId || cycles?.[0]?.id || ''

  // Busca respostas com requisitos — schema novo usa gistm_requirements
  const { data: responses } = useQuery({
    queryKey: ['responses-for-evidences', activeCycleId],
    enabled: !!activeCycleId,
    queryFn: async () => {
      const { data } = await supabase
        .from('requirement_responses')
        .select('id, requirement_id, gistm_requirements(code, description)')
        .eq('cycle_id', activeCycleId)
        .order('created_at', { ascending: true })
      return data ?? []
    },
  })

  // Busca evidências
  const { data: evidences, isLoading } = useQuery({
    queryKey: ['evidences', activeCycleId, selectedResponse],
    enabled: !!activeCycleId && (responses?.length ?? 0) > 0,
    queryFn: async () => {
      const responseIds = responses?.map((r: any) => r.id) ?? []
      if (responseIds.length === 0) return []
      let q = supabase.from('evidences')
        .select('*, profiles(full_name), requirement_responses(id, requirement_id, gistm_requirements(code, description))')
        .in('response_id', responseIds)
        .order('created_at', { ascending: false })
      if (selectedResponse) q = q.eq('response_id', selectedResponse)
      const { data } = await q
      return data ?? []
    },
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!selectedResponse) { setUploadErr('Selecione um requisito antes de fazer upload.'); return }
    if (file.size > 50 * 1024 * 1024) { setUploadErr('Arquivo muito grande. Máximo 50 MB.'); return }

    setUploading(true); setUploadErr(''); setSuccessMsg('')
    try {
      const path = `${activeCycleId}/${selectedResponse}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`

      const { error: storageErr } = await supabase.storage
        .from('evidences').upload(path, file, { upsert: false })

      if (storageErr) {
        if (storageErr.message?.includes('bucket') || storageErr.message?.includes('not found')) {
          throw new Error('Bucket "evidences" não configurado. Execute o SQL de configuração no Supabase.')
        }
        throw storageErr
      }

      const { error: dbErr } = await supabase.from('evidences').insert({
        response_id: selectedResponse,
        uploaded_by: profile!.id,
        file_name: file.name,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type,
        is_valid: true,
      })
      if (dbErr) throw dbErr

      setSuccessMsg(`${file.name} enviado com sucesso!`)
      qc.invalidateQueries({ queryKey: ['evidences'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      setUploadErr(err.message ?? 'Erro ao fazer upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(evidence: any) {
    const { data } = await supabase.storage
      .from('evidences').createSignedUrl(evidence.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const deleteMut = useMutation({
    mutationFn: async (evidence: any) => {
      await supabase.storage.from('evidences').remove([evidence.storage_path])
      const { error } = await supabase.from('evidences').delete().eq('id', evidence.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evidences'] }),
    onError: (e: any) => alert('Erro ao remover: ' + e.message),
  })

  const validateMut = useMutation({
    mutationFn: async ({ id, valid }: { id: string; valid: boolean }) => {
      const { error } = await supabase.from('evidences').update({
        is_valid: valid,
        validated_by: profile!.id,
        validated_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evidences'] }),
  })

  const kpis = {
    total: evidences?.length ?? 0,
    valid: evidences?.filter((e: any) => e.is_valid).length ?? 0,
    invalid: evidences?.filter((e: any) => !e.is_valid).length ?? 0,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Evidências</h1>
          <p className="text-sm text-gray-500 mt-0.5">Documentos comprobatórios por requisito GISTM</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total de evidências', value: kpis.total, color: '#0A9396' },
          { label: 'Validadas', value: kpis.valid, color: '#059669' },
          { label: 'Invalidadas', value: kpis.invalid, color: '#DC2626' },
        ].map(k => (
          <div key={k.label} className="card p-4" style={{ borderTop: `3px solid ${k.color}` }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros e upload */}
      <div className="card p-5 mb-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {(cycles?.length ?? 0) > 1 && (
            <div>
              <label className="form-label">Ciclo</label>
              <select className="form-input" value={activeCycleId} onChange={e => setCycleId(e.target.value)}>
                {(cycles ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Filtrar por requisito</label>
            <select className="form-input" value={selectedResponse} onChange={e => setSelectedResponse(e.target.value)}>
              <option value="">Todos os requisitos</option>
              {(responses ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.gistm_requirements?.code} — {r.gistm_requirements?.description?.slice(0, 50)}...
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full">
              <label className="form-label">
                Upload de evidência
                {!selectedResponse && <span className="text-amber-500 ml-1 font-normal">(selecione um requisito)</span>}
              </label>
              <input
                ref={fileInputRef} type="file" className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.mp4,.webp"
                onChange={handleUpload}
              />
              <button
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', width: '100%', padding: '8px 16px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: '600',
                  background: uploading || !selectedResponse ? '#9CA3AF' : '#002B3D',
                  color: 'white', border: 'none',
                  cursor: uploading || !selectedResponse ? 'not-allowed' : 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !selectedResponse}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Enviando...' : 'Selecionar arquivo'}
              </button>
            </div>
          </div>
        </div>

        {uploadErr && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{uploadErr}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 flex gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Lista de evidências */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <span className="text-sm">Carregando evidências...</span>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {(evidences ?? []).length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Nenhuma evidência enviada</p>
              <p className="text-gray-400 text-sm mt-1">Selecione um requisito e faça upload de documentos comprobatórios</p>
            </div>
          ) : (evidences ?? []).map((ev: any) => {
            const Icon = fileIcon(ev.mime_type)
            return (
              <div key={ev.id} className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ev.is_valid ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{ev.file_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                    <span className="font-mono">{ev.requirement_responses?.gistm_requirements?.code}</span>
                    <span>·</span>
                    <span>{formatBytes(ev.file_size)}</span>
                    <span>·</span>
                    <span>{ev.profiles?.full_name}</span>
                    <span>·</span>
                    <span>{new Date(ev.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ev.is_valid
                    ? <span className="badge bg-emerald-50 text-emerald-700">Válida</span>
                    : <span className="badge bg-red-50 text-red-700">Invalidada</span>}
                  {hb && (
                    <button
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${ev.is_valid
                        ? 'text-red-500 border-red-200 hover:bg-red-50'
                        : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                      onClick={() => validateMut.mutate({ id: ev.id, valid: !ev.is_valid })}>
                      {ev.is_valid ? 'Invalidar' : 'Validar'}
                    </button>
                  )}
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 hover:bg-gray-50 transition-colors inline-flex items-center gap-1"
                    onClick={() => handleDownload(ev)}>
                    <Download className="w-3.5 h-3.5" /> Baixar
                  </button>
                  {(hb || ev.uploaded_by === profile?.id) && (
                    <button
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      onClick={() => { if (confirm('Remover esta evidência?')) deleteMut.mutate(ev) }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
