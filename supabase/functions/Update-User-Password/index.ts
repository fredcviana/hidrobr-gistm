// supabase/functions/Update-User-Password/index.ts
// Permite que um hidrobr_admin troque a senha de qualquer usuário cadastrado.
// Só o service_role pode chamar auth.admin.updateUserById, então essa checagem
// de permissão precisa acontecer aqui (nunca no client, que só tem a anon key).
import { createClient } from 'npm:@supabase/supabase-js@2.43.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ success: false, error: 'Não autenticado' }, 401)

    const { user_id, new_password } = await req.json()
    if (!user_id || typeof new_password !== 'string' || new_password.length < 8) {
      return jsonResponse({ success: false, error: 'Parâmetros inválidos: user_id e new_password (mín. 8 caracteres) são obrigatórios' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client "de quem chamou", só para descobrir quem é e checar o role em profiles.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !caller) return jsonResponse({ success: false, error: 'Sessão inválida' }, 401)

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (profileErr || callerProfile?.role !== 'hidrobr_admin') {
      return jsonResponse({ success: false, error: 'Apenas administradores HIDROBR podem trocar a senha de outros usuários' }, 403)
    }

    // Client com service_role — único que pode alterar a senha de outro usuário.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password })
    if (updateErr) return jsonResponse({ success: false, error: updateErr.message }, 400)

    return jsonResponse({ success: true })
  } catch (err) {
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : 'Erro inesperado' }, 500)
  }
})
