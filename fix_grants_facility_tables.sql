-- ============================================================
-- FIX: permissoes ausentes nas tabelas recriadas pela migration
-- de avaliacao por barragem (migration_facility_level_assessment.sql)
--
-- DIAGNOSTICO (2026-07-10): apos a migration para facility_id, as
-- paginas de Requisitos e Dashboard nao mostravam NENHUM dado (0%
-- conformidade, todos os requisitos "nao iniciados"), mesmo com as
-- respostas/avaliacoes corretamente inseridas no banco (confirmado
-- via SQL direto). A causa raiz: aquela migration usou "archive +
-- create table" para requirement_responses, hidrobr_assessments,
-- evidences, comments, tsm_responses e tsm_assessments. Isso recria
-- as tabelas do zero, e as RLS policies foram reaplicadas -- mas os
-- GRANTs de privilegio de tabela (select/insert/update/delete) para
-- os roles "authenticated" e "anon" NAO foram reaplicados. RLS so
-- entra em jogo DEPOIS do GRANT de tabela ser satisfeito; sem o
-- GRANT, o PostgREST (usado pelo Supabase-js) retorna 403 Forbidden
-- direto, mesmo que as policies de RLS permitiriam o acesso.
--
-- Isso afetava TODOS os clientes do sistema, nao so a importacao da
-- GMining -- qualquer resposta/avaliacao criada apos a migration de
-- barragens estava invisivel no front-end.
--
-- Este script ja foi executado manualmente em 2026-07-10 (via SQL
-- Editor) para corrigir o problema em producao. Fica salvo aqui só
-- para registro/auditoria -- rodar novamente e idempotente (GRANT
-- nao da erro se repetido).
-- ============================================================

grant select, insert, update, delete on table requirement_responses to authenticated;
grant select, insert, update, delete on table requirement_responses to anon;
grant select, insert, update, delete on table hidrobr_assessments to authenticated;
grant select, insert, update, delete on table hidrobr_assessments to anon;
grant select, insert, update, delete on table evidences to authenticated;
grant select, insert, update, delete on table evidences to anon;
grant select, insert, update, delete on table comments to authenticated;
grant select, insert, update, delete on table comments to anon;
grant select, insert, update, delete on table tsm_responses to authenticated;
grant select, insert, update, delete on table tsm_responses to anon;
grant select, insert, update, delete on table tsm_assessments to authenticated;
grant select, insert, update, delete on table tsm_assessments to anon;

-- Verificacao (deve retornar 12 linhas, 4 privilegios x 6 tabelas x 2 roles = 48,
-- agrupado aqui por tabela+role = 12 linhas com n=4 cada):
select table_name, grantee, count(*) as n
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('requirement_responses','hidrobr_assessments','evidences','comments','tsm_responses','tsm_assessments')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;
