-- ============================================================
-- FIX: standard_requirements sem policy de SELECT (RLS)
--
-- DIAGNOSTICO (2026-07-10): apos reconstruir o catalogo TSM (9 protocolos
-- reais / 34 indicadores) e importar as respostas/avaliacoes da GMining,
-- a pagina "Requisitos TSM" no app mostrava "0 requisitos" mesmo com os
-- 34 registros corretos na tabela (confirmado via SQL Editor, que roda
-- como "postgres" e ignora RLS).
--
-- Causa raiz: a tabela standard_requirements tem RLS HABILITADO
-- (relrowsecurity = true), mas so existia UMA policy nela
-- ("standard_requirements_admin_write", comando UPDATE, restrita a admins).
-- Sem nenhuma policy de SELECT, o Postgres nega a leitura para TODOS os
-- roles (authenticated e anon) -- a consulta via PostgREST retorna 200 OK
-- com um array vazio, sem erro algum, exatamente como o bug de GRANT
-- ausente encontrado mais cedo nesta mesma sessao (mesma classe de falha
-- silenciosa: falta de permissao no nivel de banco, nao um bug de front-end).
--
-- Essa tabela e usada tanto pela pagina TSM quanto por uma futura tela
-- generica de administracao de padroes (StandardsSettingsPage.tsx) -- o
-- GISTM nao e afetado pois usa uma tabela legada separada
-- (gistm_requirements), que tem RLS desabilitado.
--
-- Corrigido em 2026-07-10 com a policy abaixo (leitura aberta, mesmo nivel
-- de acesso que gistm_requirements ja tinha via GRANT com RLS desligado).
-- Confirmado ao vivo: pagina Requisitos TSM passou a mostrar 34 requisitos
-- e as avaliacoes corretamente por barragem.
-- ============================================================

create policy standard_requirements_read on standard_requirements for select using (true);

-- Verificacao:
select polname, polcmd from pg_policy where polrelid = 'standard_requirements'::regclass;
-- deve retornar 2 linhas: standard_requirements_admin_write (w) e standard_requirements_read (r)
