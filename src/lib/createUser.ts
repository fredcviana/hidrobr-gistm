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

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
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

  const data = await response.json()
  return data
}
