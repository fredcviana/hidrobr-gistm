// src/lib/updateUserPassword.ts
// Chama a Edge Function que permite a um hidrobr_admin trocar a senha de outro
// usuário (só o service_role pode fazer isso — a validação de permissão
// acontece dentro da function, nunca no client).
import { supabase } from './supabase'

interface UpdateUserPasswordParams {
  user_id: string
  new_password: string
}

export async function updateUserPassword(params: UpdateUserPasswordParams): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { success: false, error: 'Não autenticado' }

  let response: Response
  try {
    response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/Update-User-Password`,
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
    return { success: false, error: `Falha de rede ao chamar Update-User-Password: ${networkErr?.message || networkErr}` }
  }

  let data: any
  try {
    data = await response.json()
  } catch {
    return { success: false, error: `Resposta inesperada da função (HTTP ${response.status} ${response.statusText})` }
  }

  if (!response.ok && data.success === undefined) {
    return { success: false, error: data.error || `Erro HTTP ${response.status}` }
  }

  return data
}
