// src/lib/createUser.ts
// Chama a Edge Function para criar usuários com segurança
import { supabase } from './supabase'

interface CreateUserParams {
  email: string
  password: string
  full_name: string
  role: string
  organization_id?: string | null
  job_title?: string
  phone?: string
}

export async function createUser(params: CreateUserParams): Promise<{ success: boolean; error?: string; user?: any }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { success: false, error: 'Não autenticado' }

  let response: Response
  try {
    response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/Create-User`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(params),
      }
    )
  } catch (networkErr: any) {
    // fetch lança exceção antes de qualquer resposta (DNS/CORS/rede) — sem isso
    // o erro real ficava invisível e a função sequer aparecia nos logs do Supabase.
    return { success: false, error: `Falha de rede ao chamar Create-User: ${networkErr?.message || networkErr}` }
  }

  let data: any
  try {
    data = await response.json()
  } catch {
    // Resposta não-JSON (ex.: página de erro HTML do gateway) — expõe o status HTTP
    // em vez de estourar "Unexpected end of JSON input" sem contexto.
    return { success: false, error: `Resposta inesperada da função (HTTP ${response.status} ${response.statusText})` }
  }

  if (!response.ok && data.success === undefined) {
    return { success: false, error: data.error || `Erro HTTP ${response.status}` }
  }

  return data
}
