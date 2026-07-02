// src/features/requirements/RequirementsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Paperclip, Loader2, CheckCircle2, Clock, AlertCircle, Send } from 'lucide-react'
import { useAuthStore, isHidrobr } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const STATUS: Record<string,{label:string;cls:string}> = {
  not_started:{label:'Não Iniciado',cls:'bg-gray-100 text-gray-600'},
  in_progress:{label:'Em Andamento',cls:'bg-blue-50 text-blue-700'},
  submitted:{label:'Ag. Avaliação',cls:'bg-amber-50 text-amber-700'},
  under_review:{label:'Em Revisão',cls:'bg-purple-50 text-purple-700'},
  approved:{label:'Aprovado',cls:'bg-emerald-50 text-emerald-700'},
  needs_revision:{label:'Revisar',cls:'bg-red-50 text-red-700'},
}
const SCORE: Record<string,{label:string;cls:string}> = {
  non_conforming:{label:'Não Conforme',cls:'bg-red-50 text-red-700'},
  partially_conforming:{label:'Parcialmente Conforme',cls:'bg-amber-50 text-amber-700'},
  conforming:{label:'Conforme',cls:'bg-blue-50 text-blue-700'},
  fully_conforming:{label:'Totalmente Conforme',cls:'bg-emerald-50 text-emerald-700'},
}
const SCORE_VALUES: Record<string,number> = {
  non_conforming:0, partially_conforming:50, conforming:75, fully_conforming:100
}

function StatusBadge({status}:{status:string}) {
  const c=STATUS[status]??STATUS.not_started
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}
function ScoreBadge({score}:{score?:string}) {
  if(!score)return null
  const c=SCORE[score]
  return c?<span className={`badge ${c.cls}`}>{c.label}</span>:null
}

function RequirementModal({req,response,cycleId,onClose}:{req:any;response:any;cycleId:string;onClose:()=>void}) {
  const {profile}=useAuthStore()
  const hb=isHidrobr(profile?.role)
  const qc=useQueryClient()
  const [tab,setTab]=useState<'resposta'|'avaliacao'|'comentarios'>('resposta')
  const [text,setText]=useState(response?.implementation_text??'')
  const [responsible,setResponsible]=useState(response?.responsible_person??'')
  const [subs,setSubs]=useState<Record<string,{done:boolean}>>(response?.sub_req_responses??{})
  const [hidrScore,setHidrScore]=useState('')
  const [hidrText,setHidrText]=useState('')
  const [hidrRec,setHidrRec]=useState('')
  const [saving,setSaving]=useState(false)
  const [assessing,setAssessing]=useState(false)
  const [errMsg,setErrMsg]=useState('')

  const subsDone=req.sub_requirements?.filter((s:any)=>subs[s.id]?.done).length??0
  const hasAssessment=(response?.hidrobr_assessments?.length??0)>0
  const assessment=response?.hidrobr_assessments?.[0]

  // Garante que a resposta existe no banco e retorna o id
  async function ensureResponse(newStatus?:string): Promise<string> {
    if(response?.id) {
      // Atualiza resposta existente
      const {error}=await supabase.from('requirement_responses').update({
        implementation_text:text,
        responsible_person:responsible,
        sub_req_responses:subs,
        ...(newStatus?{status:newStatus,submitted_at:new Date().toISOString()}:{}),
        updated_at:new Date().toISOString(),
      }).eq('id',response.id)
      if(error)throw error
      return response.id
    } else {
      // Cria nova resposta
      const {data,error}=await supabase.from('requirement_responses').insert({
        cycle_id:cycleId,
        requirement_id:req.id,
        implementation_text:text,
        responsible_person:responsible,
        sub_req_responses:subs,
        status:newStatus??'in_progress',
        ...(newStatus==='submitted'?{submitted_at:new Date().toISOString()}:{}),
      }).select('id').single()
      if(error)throw error
      return data.id
    }
  }

  async function handleSave(newStatus?:string) {
    setSaving(true)
    setErrMsg('')
    try {
      await ensureResponse(newStatus)
      qc.invalidateQueries({queryKey:['requirements',cycleId]})
      onClose()
    } catch(e:any) {
      setErrMsg(e.message??'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssess() {
    if(!response?.id){setErrMsg('Salve a resposta primeiro antes de avaliar.');return}
    if(!hidrScore){setErrMsg('Selecione uma classificação.');return}
    if(hidrText.length<20){setErrMsg('O parecer técnico deve ter pelo menos 20 caracteres.');return}
    setAssessing(true)
    setErrMsg('')
    try {
      // Primeiro atualiza status da resposta
      const {error:e1}=await supabase.from('requirement_responses')
        .update({status:'approved',updated_at:new Date().toISOString()})
        .eq('id',response.id)
      if(e1)throw e1
      // Depois insere a avaliação
      const {error:e2}=await supabase.from('hidrobr_assessments').insert({
        response_id:response.id,
        assessed_by:profile!.id,
        score:hidrScore,
        score_value:SCORE_VALUES[hidrScore]??0,
        assessment_text:hidrText,
        recommendations:hidrRec||null,
        published_at:new Date().toISOString(),
      })
      if(e2)throw e2
      qc.invalidateQueries({queryKey:['requirements',cycleId]})
      onClose()
    } catch(e:any) {
      setErrMsg(e.message??'Erro ao publicar avaliação')
    } finally {
      setAssessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="w-[600px] h-full bg-white flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{background:req.gistm_topics?.color_hex+'20',color:req.gistm_topics?.color_hex}}>
            {req.code}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{req.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{req.gistm_topics?.title}</div>
          </div>
          <StatusBadge status={response?.status??'not_started'}/>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded border border-gray-200 ml-2 text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {(['resposta','avaliacao','comentarios'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab===t?'border-brand-600 text-brand-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t==='resposta'?'Resposta':t==='avaliacao'?'Avaliação HIDROBR':'Comentários'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {errMsg&&<div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{errMsg}</div>}

          {tab==='resposta'&&(
            <div className="space-y-4">
              <div className="bg-brand-50 border-l-4 border-brand-400 p-3 rounded-r-lg">
                <div className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-1">Requisito</div>
                <div className="text-sm text-gray-700 leading-relaxed">{req.description}</div>
              </div>
              {req.guidance&&(
                <div className="bg-gray-50 border-l-4 border-gray-300 p-3 rounded-r-lg">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Orientação</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{req.guidance}</div>
                </div>
              )}
              {(req.sub_requirements?.length??0)>0&&(
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Lista de verificação ({subsDone}/{req.sub_requirements.length})
                  </div>
                  <div className="space-y-1.5">
                    {req.sub_requirements.map((sub:any)=>{
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
              )}
              <div>
                <label className="form-label">Como este requisito é atendido *</label>
                <textarea className="form-input resize-none" rows={5}
                  placeholder="Descreva detalhadamente como sua empresa atende este requisito..."
                  value={text} onChange={e=>setText(e.target.value)}/>
              </div>
              <div>
                <label className="form-label">Responsável pela implementação</label>
                <input type="text" className="form-input" placeholder="Nome e cargo"
                  value={responsible} onChange={e=>setResponsible(e.target.value)}/>
              </div>
            </div>
          )}

          {tab==='avaliacao'&&(
            <div>
              {hb&&!hasAssessment&&(
                <div className="space-y-4">
                  {!response?.id&&(
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      O cliente ainda não preencheu este princípio. Salve uma resposta primeiro ou aguarde o cliente preencher.
                    </div>
                  )}
                  <div className={`bg-gradient-to-br from-brand-50 to-emerald-50 border border-brand-200 rounded-xl p-4 ${!response?.id?'opacity-60 pointer-events-none':''}`}>
                    <div className="text-sm font-bold text-brand-700 mb-3">Avaliar Requisito — HIDROBR</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Classificação de conformidade *</div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        {key:'fully_conforming',label:'⭐ Totalmente Conforme',color:'#059669',bg:'#D1FAE5'},
                        {key:'conforming',label:'✓ Conforme',color:'#1D4ED8',bg:'#EFF6FF'},
                        {key:'partially_conforming',label:'◑ Parcialmente Conforme',color:'#D97706',bg:'#FFFBEB'},
                        {key:'non_conforming',label:'✗ Não Conforme',color:'#DC2626',bg:'#FEF2F2'},
                      ].map(opt=>(
                        <button key={opt.key} onClick={()=>setHidrScore(opt.key)}
                          className={`p-3 rounded-lg text-xs font-semibold text-center border-2 transition-all ${hidrScore===opt.key?'border-current scale-[1.02] shadow-sm':'border-transparent hover:opacity-90'}`}
                          style={{color:opt.color,background:opt.bg}}>{opt.label}</button>
                      ))}
                    </div>
                    <label className="form-label">Parecer técnico * (mínimo 20 caracteres)</label>
                    <textarea className="form-input resize-none mb-3" rows={4}
                      placeholder="Descreva a avaliação técnica detalhada..."
                      value={hidrText} onChange={e=>setHidrText(e.target.value)}/>
                    <label className="form-label">Recomendações de melhoria</label>
                    <textarea className="form-input resize-none" rows={3}
                      placeholder="Sugestões para o próximo ciclo..."
                      value={hidrRec} onChange={e=>setHidrRec(e.target.value)}/>
                  </div>
                </div>
              )}
              {hasAssessment&&(
                <div className="bg-gradient-to-br from-brand-50 to-emerald-50 border border-brand-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-accent-500 flex items-center justify-center text-brand-900 text-xs font-bold flex-shrink-0">H</div>
                    <div>
                      <div className="text-sm font-bold text-brand-700">Avaliação HIDROBR publicada</div>
                      <div className="text-xs text-gray-400">Score: {assessment.score_value}/100</div>
                    </div>
                    <ScoreBadge score={assessment.score}/>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">{assessment.assessment_text}</p>
                  {assessment.recommendations&&(
                    <div className="bg-white/70 rounded-lg p-3">
                      <div className="text-[10px] font-bold text-brand-700 uppercase tracking-wider mb-1">Recomendações</div>
                      <p className="text-xs text-gray-600">{assessment.recommendations}</p>
                    </div>
                  )}
                </div>
              )}
              {!hb&&!hasAssessment&&(
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300"/>
                  <div className="font-medium text-gray-500">Avaliação pendente</div>
                  <div className="text-xs mt-1">A HIDROBR ainda não avaliou este princípio</div>
                </div>
              )}
            </div>
          )}

          {tab==='comentarios'&&(
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">💬</div>
              <div className="font-medium text-gray-500">Comentários em breve</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button className="btn-secondary btn-sm" onClick={onClose}>Cancelar</button>

          {tab==='resposta'&&(
            <>
              <button className="btn-secondary btn-sm inline-flex items-center gap-1.5"
                disabled={saving} onClick={()=>handleSave()}>
                {saving?<Loader2 className="w-3 h-3 animate-spin"/>:'💾'} Salvar
              </button>
              {(response?.status==='not_started'||!response)&&(
                <button className="btn-primary btn-sm" onClick={()=>handleSave('in_progress')}>
                  Iniciar preenchimento
                </button>
              )}
              {['in_progress','needs_revision'].includes(response?.status??'')&&!hb&&(
                <button
                  className="btn-sm bg-accent-500 text-brand-900 font-semibold border border-accent-500 hover:brightness-95 inline-flex items-center gap-1.5"
                  onClick={()=>handleSave('submitted')}
                  disabled={saving||text.length<20}>
                  {saving?<Loader2 className="w-3 h-3 animate-spin"/>:<Send className="w-3 h-3"/>}
                  Solicitar avaliação
                </button>
              )}
            </>
          )}

          {tab==='avaliacao'&&hb&&!hasAssessment&&response?.id&&(
            <button className="btn-success btn-sm inline-flex items-center gap-1.5"
              onClick={handleAssess}
              disabled={assessing||!hidrScore||hidrText.length<20}>
              {assessing?<Loader2 className="w-3 h-3 animate-spin"/>:<CheckCircle2 className="w-3 h-3"/>}
              Publicar avaliação
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TopicSection({topic,entries,onSelect}:{topic:any;entries:any[];onSelect:(e:any)=>void}) {
  const [open,setOpen]=useState(topic.code==='T1')
  const approved=entries.filter(e=>e.response?.status==='approved').length
  const pct=Math.round((approved/entries.length)*100)
  return (
    <div className="card mb-3">
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={()=>setOpen(!open)}>
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:topic.color_hex}}/>
        <div className="flex-1"><span className="text-sm font-bold text-gray-900">{topic.code} — {topic.title}</span></div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:topic.color_hex}}/>
            </div>
            <span className="font-semibold" style={{color:topic.color_hex}}>{pct}%</span>
          </div>
          <span>{approved}/{entries.length} aprovados</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open?'rotate-180':''}`}/>
      </div>
      {open&&(
        <div className="border-t border-gray-100">
          {entries.map(entry=>{
            const{req,response:resp}=entry
            return(
              <div key={req.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={()=>onSelect(entry)}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{background:topic.color_hex+'15',color:topic.color_hex}}>{req.code}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{req.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {req.sub_requirements?.length??0} critérios
                    {resp?.responsible_person?` · ${resp.responsible_person}`:''}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {resp?.hidrobr_assessments?.[0]?.score&&<ScoreBadge score={resp.hidrobr_assessments[0].score}/>}
                  <StatusBadge status={resp?.status??'not_started'}/>
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
  const {profile}=useAuthStore()
  const hb=isHidrobr(profile?.role)
  const [filter,setFilter]=useState('all')
  const [selected,setSelected]=useState<any>(null)
  const [selectedCycleId,setSelectedCycleId]=useState<string>('')

  // Busca ciclos disponíveis
  const {data:cycles}=useQuery({
    queryKey:['cycles-list',profile?.organization_id,hb],
    enabled:!!profile,
    queryFn:async()=>{
      let q=supabase.from('assessment_cycles').select('id,name,organization_id,status,organizations(name)').eq('status','active').order('created_at',{ascending:false})
      if(!hb&&profile?.organization_id) q=q.eq('organization_id',profile.organization_id)
      const{data}=await q
      return data??[]
    },
    onSuccess:(data:any[])=>{ if(data.length>0&&!selectedCycleId) setSelectedCycleId(data[0].id) }
  } as any)

  const cycleId=selectedCycleId||(cycles?.[0]?.id??'')

  const{data,isLoading,error}=useQuery({
    queryKey:['requirements',cycleId],
    enabled:!!cycleId,
    queryFn:async()=>{
      const{data:reqs}=await supabase.from('gistm_requirements').select('*,gistm_topics(id,code,title,color_hex)').order('display_order')
      const{data:responses}=await supabase.from('requirement_responses').select('*,hidrobr_assessments(score,score_value,assessment_text,recommendations)').eq('cycle_id',cycleId)
      const respMap=new Map((responses??[]).map((r:any)=>[r.requirement_id,r]))
      return(reqs??[]).map((req:any)=>({req,response:respMap.get(req.id)??null}))
    }
  })

  const filtered=filter==='all'?(data??[]):(data??[]).filter((e:any)=>(e.response?.status??'not_started')===filter)
  const byTopic=filtered.reduce((acc:any,entry:any)=>{
    const topic=entry.req.gistm_topics
    if(!topic)return acc
    if(!acc[topic.code])acc[topic.code]={topic,entries:[]}
    acc[topic.code].entries.push(entry)
    return acc
  },{})

  if(isLoading)return(
    <div className="p-6 flex items-center gap-3 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-brand-400"/>
      <span className="text-sm">Carregando princípios GISTM...</span>
    </div>
  )

  if(!cycleId)return(
    <div className="p-6"><div className="card p-10 text-center">
      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3"/>
      <p className="text-gray-600 font-medium">Nenhum ciclo ativo encontrado</p>
      <p className="text-gray-400 text-sm mt-1">
        {hb?'Crie um ciclo de avaliação na página de Clientes.':'Contate a HIDROBR para criar um ciclo de avaliação.'}
      </p>
    </div></div>
  )

  return(
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Requisitos GISTM</h1>
          <p className="text-sm text-gray-500 mt-0.5">18 princípios</p>
        </div>
        {hb&&(cycles?.length??0)>1&&(
          <select className="form-input w-auto" value={cycleId} onChange={e=>setSelectedCycleId(e.target.value)}>
            {(cycles??[]).map((c:any)=>(
              <option key={c.id} value={c.id}>{c.organizations?.name} — {c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {[['all','Todos (18)'],['approved','Aprovados'],['in_progress','Em andamento'],['submitted','Pend. avaliação'],['needs_revision','Revisar'],['not_started','Não iniciados']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter===v?'bg-brand-900 text-white border-brand-900':'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {Object.values(byTopic).map((g:any)=>(
        <TopicSection key={g.topic.code} topic={g.topic} entries={g.entries} onSelect={setSelected}/>
      ))}

      {Object.keys(byTopic).length===0&&!isLoading&&(
        <div className="card p-10 text-center text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm font-medium text-gray-500">Nenhum princípio neste filtro</div>
        </div>
      )}

      {selected&&(
        <RequirementModal
          req={selected.req}
          response={selected.response}
          cycleId={cycleId}
          onClose={()=>setSelected(null)}
        />
      )}
    </div>
  )
}
