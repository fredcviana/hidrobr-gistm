# Patch para ClientsPage.tsx — Exclusão de Ciclo

## 1. Adicionar mutation deleteCycleMut dentro do OrgDetail

Adicione ANTES do return do componente OrgDetail:

```typescript
const deleteCycleMut = useMutation({
  mutationFn: async (cycleId: string) => {
    const { data: responses } = await supabase
      .from('requirement_responses').select('id').eq('cycle_id', cycleId)
    if (responses?.length) {
      const ids = responses.map((r: any) => r.id)
      await supabase.from('hidrobr_assessments').delete().in('response_id', ids)
      await supabase.from('evidences').delete().in('response_id', ids)
      await supabase.from('comments').delete().in('response_id', ids)
      await supabase.from('requirement_responses').delete().eq('cycle_id', cycleId)
    }
    const { error } = await supabase.from('assessment_cycles').delete().eq('id', cycleId)
    if (error) throw error
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['org-cycles', org.id] }),
  onError: (e: any) => alert(`Erro ao excluir: ${e.message}`),
})
```

## 2. Na aba cycles, adicionar botão de exclusão

Encontre a linha:
```
<span className={`badge ${c.status === 'active' ...`}>
```

Após o badge, adicione:
```typescript
{isAdmin && (
  <button
    className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
    onClick={() => {
      if (confirm(`Excluir "${c.name}"?\n\nApagará TODAS as respostas e avaliações. Não pode ser desfeito.`)) {
        deleteCycleMut.mutate(c.id)
      }
    }}>
    🗑️ Excluir
  </button>
)}
```
