// apps/web/src/features/requirements/RequirementsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Paperclip, Loader2, CheckCircle2, Clock, AlertCircle, Send } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { requirementsApi } from '@/services/api'

const STATUS: Record<string, { label: string; cls: string }> = {
  not_started:    { label: 'Não Iniciado',    cls: 'bg-gray-100 text-gray-600' },
  in_progress:    { label: 'Em Andamento',    cls: 'bg-blue-50 text-blue-700' },
  submitted:      { label: 'Ag. Avaliação',   cls: 'bg-amber-50 text-amber-700' },
  under_review:   { label: 'Em Revisão',      cls: 'bg-purple-50 text-purple-700' },
  approved:       { label: 'Aprovado',        cls: 'bg-emerald-50 text-emerald-700' },
  needs_revision: { label: 'Revisar',         cls: 'bg-red-50 text-red-700' },
}
const SCORE: Record<string, { label: string; cls: string }> = {
  non_conforming:       { label: 'Não Conforme',        cls: 'bg-red-50 text-red-700' },
  partially_conforming: { label: 'Parc. Conforme',      cls: 'bg-amber-50 text-amber-700' },
  conforming:           { label: 'Conforme',            cls: 'bg-blue-50 text-blue-700' },
  fully_conforming:     { label: 'Tot. Conforme',       cls: 'bg-emerald-50 text-emerald-700' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS[status] ?? STATUS.not_started
  return <span className={`badge text-[11px] ${cfg.cls}`}>{cfg.label}</span>
}
function ScoreBadge({ score }: { score: string }) {
  const cfg = SCORE[score]
  if (!cfg) return null
  return <span className={`badge text-[11px] ${cfg.cls}`}>{cfg.label}</span>
}

interface SubReq { id: string; text: string }
interface Topic { id: number; code: string; title: string; colorHex: string }
interface Requirement {
  id: number; code: string; title: string; description: string
  guidance: string; subRequirements: SubReq[]; weight: number; topic: Topic
}
interface Response {
  id?: string; status: string; implementationText?: string
  responsiblePerson?: string
  subReqResponses?: Record<string, { done: boolean; note?: string }>
  submittedAt?: string; evidenceCount?: number
  assessment?: { score: string; scoreValue: number } | null
}
interface Entry { requirement: Requirement; response: Response }

const DEMO_CYCLE = '00000000-0000-0000-0000-000000000002'

function RequirementModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const hb = isHidrobr(user?.role)
  const { requirement: req, response: resp } = entry
  const [tab, setTab] = useState<'response'|'evidence'|'assessment'|'comments'>('response')
  const [text, setText] = useState(resp.implementationText ?? '')
  const [responsible, setResponsible] = useState(resp.responsiblePerson ?? '')
  const [subs, setSubs] = useState<Record<string,{done:boolean}>>(
    (resp.subReqResponses as Record<string,{done:boolean}>) ?? {}
  )
  const [hidrScore, setHidrScore] = useState('')
  const [hidrText, setHidrText] = useState('')
  const [hidrRec, setHidrRec] = useState('')

  const updateMut = useMutation({
    mutationFn: (data: any) => requirementsApi.update(DEMO_CYCLE, req.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requirements', DEMO_CYCLE] }),
  })
  const submitMut = useMutation({
    mutationFn: () => requirementsApi.submit(DEMO_CYCLE, req.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requirements', DEMO_CYCLE] }); onClose() },
  })
  const assessMut = useMutation({
    mutationFn: () => requirementsApi.assess(DEMO_CYCLE, req.id, {
      score: hidrScore, assessmentText: hidrText, recommendations: hidrRec,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requirements', DEMO_CYCLE] }); onClose() },
  })

  const subsDone = req.subRequirements.filter(s => subs[s.id]?.done).length

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="w-[600px] h-full bg-white flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{background:req.topic.colorHex+'20',color:req.topic.colorHex}}>{req.code}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{req.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{req.topic.title}</div>
          </div>
          <StatusBadge status={resp.status}/>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded border border-gray-200 ml-2 text-lg leading-none">✕</button>
        </div>

        <div className="flex border-b border-gray-200 flex-shrink-0">
          {(['response','evidence','assessment','comments'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                tab===t?'border-brand-600 text-brand-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t==='response'?'Resposta':t==='evidence'?`Evidências (${resp.evidenceCount??0})`:t==='assessment'?'Avaliação HIDROBR':'Comentários'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab==='response'&&(
            <div className="space-y-4">
              <div className="bg-brand-50 border-l-4 border-brand-400 p-3 rounded-r-lg">
                <div className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-1">Requisito</div>
                <div className="text-sm text-gray-700 leading-relaxed">{req.description}</div>
              </div>
              <div className="bg-gray-50 border-l-4 border-gray-300 p-3 rounded-r-lg">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Orientação</div>
                <div className="text-xs text-gray-500 leading-relaxed">{req.guidance}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Lista de verificação ({subsDone}/{req.subRequirements.length})
                </div>
                <div className="space-y-1.5">
                  {req.subRequirements.map(sub=>{
                    const done=subs[sub.id]?.done??false
                    return(
                      <div key={sub.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${done?'bg-emerald-50':'bg-gray-50 hover:bg-gray-100'}`}
                        onClick={()=>setSubs(p=>({...p,[sub.id]:{done:!done}}))}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${done?'bg-emerald-500':'border-2 border-gray-300'}`}>
                          {done&&<span className="text-white text-[10px] font-bold leading-none">✓</span>}
                        </div>
                        <span className={`text-xs leading-relaxed ${done?'text-gray-400 line-through':'text-gray-600'}`}>{sub.text}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="form-label">Como este requisito é atendido *</label>
                <textarea className="form-input resize-none" rows={5}
                  placeholder="Descreva detalhadamente como sua empresa atende este requisito..."
                  value={text} onChange={e=>setText(e.target.value)}/>
              </div>
              <div>
                <label className="form-label">Responsável pela implementação</label>
                <input type="text" className="form-input"
                  placeholder="Nome e cargo do responsável"
                  value={responsible} onChange={e=>setResponsible(e.target.value)}/>
              </div>
            </div>
          )}
          {tab==='evidence'&&(
            <div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-all mb-4"
                onClick={()=>alert('Upload integrado ao MinIO/S3 — disponível na v1.0')}>
                <Paperclip className="w-8 h-8 text-gray-300 mx-auto mb-3"/>
                <div className="text-sm font-semibold text-gray-700 mb-1">Arraste arquivos aqui</div>
                <div className="text-xs text-gray-400">PDF, Word, Excel — até 50 MB</div>
              </div>
              {(resp.evidenceCount??0)===0&&(
                <div className="text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">📭</div>
                  <div className="text-sm font-medium text-gray-500">Nenhuma evidência enviada</div>
                </div>
              )}
            </div>
          )}
          {tab==='assessment'&&(
            <div>
              {hb&&!resp.assessment&&(
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-brand-50 to-emerald-50 border border-brand-200 rounded-xl p-4">
                    <div className="text-sm font-bold text-brand-700 mb-3">Avaliar Requisito — HIDROBR</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Classificação</div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        {key:'fully_conforming',label:'⭐ Totalmente Conforme',color:'#059669',bg:'#D1FAE5'},
                        {key:'conforming',label:'✓ Conforme',color:'#1D4ED8',bg:'#EFF6FF'},
                        {key:'partially_conforming',label:'◑ Parcialmente Conforme',color:'#D97706',bg:'#FFFBEB'},
                        {key:'non_conforming',label:'✗ Não Conforme',color:'#DC2626',bg:'#FEF2F2'},
                      ].map(opt=>(
                        <button key={opt.key} onClick={()=>setHidrScore(opt.key)}
                          className={`p-3 rounded-lg text-xs font-semibold text-center border-2 transition-all ${hidrScore===opt.key?'border-current scale-[1.02]':'border-transparent hover:opacity-90'}`}
                          style={{color:opt.color,background:opt.bg}}>{opt.label}</button>
                      ))}
                    </div>
                    <label className="form-label">Parecer técnico *</label>
                    <textarea className="form-input resize-none mb-3" rows={4}
                      placeholder="Descreva a avaliação técnica..." value={hidrText} onChange={e=>setHidrText(e.target.value)}/>
                    <label className="form-label">Recomendações</label>
                    <textarea className="form-input resize-none" rows={3}
                      placeholder="Sugestões de melhoria..." value={hidrRec} onChange={e=>setHidrRec(e.target.value)}/>
                  </div>
                </div>
              )}
              {resp.assessment&&(
                <div className="bg-gradient-to-br from-brand-50 to-emerald-50 border border-brand-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-accent-500 flex items-center justify-center text-brand-900 text-xs font-bold">RM</div>
                    <div>
                      <div className="text-sm font-bold text-brand-700">Avaliação HIDROBR</div>
                      <div className="text-xs text-gray-400">Publicada em {resp.submittedAt??'—'}</div>
                    </div>
                    <ScoreBadge score={resp.assessment.score}/>
                  </div>
                  <p className="text-sm text-gray-700">Pontuação: {resp.assessment.scoreValue}/100</p>
                </div>
              )}
              {!hb&&!resp.assessment&&(
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300"/>
                  <div className="font-medium text-gray-500">Avaliação pendente</div>
                  <div className="text-xs mt-1">A HIDROBR ainda não avaliou este princípio</div>
                </div>
              )}
            </div>
          )}
          {tab==='comments'&&(
            <div>
              <div className="text-center py-8 text-gray-400 mb-4">
                <div className="text-3xl mb-2">💬</div>
                <div className="text-sm font-medium text-gray-500">Nenhum comentário</div>
              </div>
              <textarea className="form-input resize-none" rows={3} placeholder="Adicione um comentário..."/>
              <div className="flex gap-2 mt-2">
                <button className="btn-secondary btn-sm">Enviar</button>
                {hb&&<button className="btn-secondary btn-sm">Interno</button>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button className="btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          {tab==='response'&&(
            <button className="btn-secondary btn-sm" disabled={updateMut.isPending}
              onClick={()=>{updateMut.mutate({implementationText:text,responsiblePerson:responsible,subReqResponses:subs});onClose()}}>
              {updateMut.isPending?<Loader2 className="w-3 h-3 animate-spin"/>:'💾'} Salvar
            </button>
          )}
          {tab==='response'&&['in_progress','needs_revision'].includes(resp.status)&&!hb&&(
            <button
              className="btn-sm bg-accent-500 text-brand-900 font-semibold border-accent-500 hover:brightness-95 inline-flex items-center gap-1.5"
              onClick={()=>submitMut.mutate()}
              disabled={submitMut.isPending||text.length<20}>
              {submitMut.isPending?<Loader2 className="w-3 h-3 animate-spin"/>:<Send className="w-3 h-3"/>}
              Solicitar avaliação
            </button>
          )}
          {tab==='response'&&resp.status==='not_started'&&(
            <button className="btn-primary btn-sm"
              onClick={()=>{updateMut.mutate({implementationText:text,responsiblePerson:responsible,subReqResponses:subs});onClose()}}>
              Iniciar preenchimento
            </button>
          )}
          {tab==='assessment'&&hb&&!resp.assessment&&(
            <button className="btn-success btn-sm inline-flex items-center gap-1.5"
              onClick={()=>assessMut.mutate()}
              disabled={assessMut.isPending||!hidrScore||hidrText.length<20}>
              {assessMut.isPending?<Loader2 className="w-3 h-3 animate-spin"/>:<CheckCircle2 className="w-3 h-3"/>}
              Publicar avaliação
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TopicSection({ topic, entries, onSelect }: {
  topic: Topic; entries: Entry[]; onSelect:(e:Entry)=>void
}) {
  const [open, setOpen] = useState(topic.id===1)
  const approved = entries.filter(e=>e.response.status==='approved').length
  const pct = Math.round((approved/entries.length)*100)
  return (
    <div className="card mb-3">
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={()=>setOpen(!open)}>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:topic.colorHex}}/>
        <div className="flex-1">
          <span className="text-sm font-bold text-gray-900">{topic.code} — {topic.title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{width:`${pct}%`,background:topic.colorHex}}/>
            </div>
            <span className="font-semibold" style={{color:topic.colorHex}}>{pct}%</span>
          </div>
          <span>{approved}/{entries.length} aprovados</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open?'rotate-180':''}`}/>
      </div>
      {open&&(
        <div className="border-t border-gray-100">
          {entries.map(entry=>{
            const {requirement:req,response:resp}=entry
            return(
              <div key={req.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={()=>onSelect(entry)}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{background:topic.colorHex+'15',color:topic.colorHex}}>{req.code}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{req.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {req.subRequirements.length} critérios
                    {resp.responsiblePerson?` · ${resp.responsiblePerson}`:''}
                    {resp.submittedAt?` · Enviado ${resp.submittedAt}`:''}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(resp.evidenceCount??0)>0&&<span className="flex items-center gap-1 text-xs text-gray-400"><Paperclip className="w-3 h-3"/>{resp.evidenceCount}</span>}
                  {resp.assessment?.score&&<ScoreBadge score={resp.assessment.score}/>}
                  <StatusBadge status={resp.status}/>
                  <span className="text-gray-300 text-lg">›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function RequirementsPage() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Entry|null>(null)

  const {data,isLoading,error} = useQuery<Entry[]>({
    queryKey:['requirements',DEMO_CYCLE],
    queryFn:()=>requirementsApi.list(DEMO_CYCLE),
  })

  const filtered = filter==='all'?(data??[]):(data??[]).filter(e=>e.response.status===filter)
  const byTopic = filtered.reduce((acc,entry)=>{
    const id=entry.requirement.topic.id
    if(!acc[id])acc[id]={topic:entry.requirement.topic,entries:[]}
    acc[id].entries.push(entry)
    return acc
  },{} as Record<number,{topic:Topic;entries:Entry[]}>)

  if(isLoading)return(
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400"/>
      <span className="text-sm">Carregando princípios GISTM...</span>
    </div>
  )
  if(error)return(
    <div className="p-6"><div className="card p-8 text-center">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3"/>
      <p className="text-gray-600 text-sm">Erro ao carregar os requisitos.</p>
    </div></div>
  )

  return(
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Requisitos GISTM</h1>
          <p className="text-sm text-gray-500 mt-0.5">18 princípios · Ciclo 2024 — Barragem Norte BN-01</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        {[
          {id:'all',label:'Todos (18)'},
          {id:'approved',label:'Aprovados'},
          {id:'in_progress',label:'Em andamento'},
          {id:'submitted',label:'Pend. avaliação'},
          {id:'not_started',label:'Não iniciados'},
        ].map(f=>(
          <button key={f.id} onClick={()=>setFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter===f.id?'bg-brand-800 text-white border-brand-800':'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {Object.values(byTopic).map(({topic,entries})=>(
        <TopicSection key={topic.id} topic={topic} entries={entries} onSelect={setSelected}/>
      ))}
      {Object.keys(byTopic).length===0&&(
        <div className="card p-10 text-center text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm font-medium text-gray-500">Nenhum princípio neste filtro</div>
        </div>
      )}
      {selected&&<RequirementModal entry={selected} onClose={()=>setSelected(null)}/>}
    </div>
  )
}
