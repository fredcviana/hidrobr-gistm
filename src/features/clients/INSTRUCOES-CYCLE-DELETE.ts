// Trecho para substituir na aba de ciclos do ClientsPage.tsx
// Substitua o bloco {tab === 'cycles' && (...)} pelo conteúdo abaixo

// ADICIONE este import no topo do arquivo (junto com os outros):
// import { useMutation, useQueryClient } from '@tanstack/react-query'
// (já deve estar importado)

// SUBSTITUA o bloco tab === 'cycles' por este:
/*
      {tab === 'cycles' && (
        <div className="card divide-y divide-gray-50">
          {(cycles ?? []).length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-sm font-medium text-gray-500">Nenhum ciclo cadastrado</p>
            </div>
          )}
          {(cycles ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.tailings_facilities?.name} · Ano {c.reference_year}
                  {c.target_date ? ` · Prazo: ${new Date(c.target_date).toLocaleDateString('pt-BR')}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.overall_score != null && (
                  <div className="text-sm font-bold text-brand-600">{c.overall_score}%</div>
                )}
                <span className={`badge ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {c.status === 'active' ? 'Ativo' : c.status}
                </span>
                {isAdmin && (
                  <button
                    className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                    onClick={() => {
                      if (confirm(`Excluir o ciclo "${c.name}"?\n\nISTO IRÁ APAGAR todas as respostas, avaliações e evidências associadas. Esta ação não pode ser desfeita.`)) {
                        deleteCycleMut.mutate(c.id)
                      }
                    }}
                    disabled={deleteCycleMut.isPending}
                  >
                    🗑️ Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
*/

// ADICIONE esta mutation dentro do componente OrgDetail, junto com as outras:
/*
  const deleteCycleMut = useMutation({
    mutationFn: async (cycleId: string) => {
      // Exclui respostas e avaliações primeiro (cascade pode não estar configurado)
      const { data: responses } = await supabase
        .from('requirement_responses')
        .select('id')
        .eq('cycle_id', cycleId)
      
      if (responses && responses.length > 0) {
        const responseIds = responses.map((r: any) => r.id)
        await supabase.from('hidrobr_assessments').delete().in('response_id', responseIds)
        await supabase.from('evidences').delete().in('response_id', responseIds)
        await supabase.from('comments').delete().in('response_id', responseIds)
        await supabase.from('requirement_responses').delete().eq('cycle_id', cycleId)
      }
      
      const { error } = await supabase.from('assessment_cycles').delete().eq('id', cycleId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-cycles', org.id] }),
    onError: (e: any) => alert(`Erro ao excluir ciclo: ${e.message}`),
  })
*/

export {}
