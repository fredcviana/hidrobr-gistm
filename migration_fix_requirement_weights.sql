-- ============================================================
-- FIX: peso dos requisitos GISTM/TSM não salva na tela de
-- Configurações de Padrões + define todos os pesos como 1.
--
-- DIAGNÓSTICO: gistm_requirements e standard_requirements têm RLS
-- (Row Level Security) habilitado, mas só existe política de LEITURA
-- ("gistm_requirements_public_read" etc). Não existe política de
-- UPDATE para o hidrobr_admin. Isso faz o UPDATE feito pela tela de
-- configurações afetar 0 linhas *sem gerar erro* — por isso parecia
-- "salvar" (a tela mostrava sucesso) mas o valor nunca era gravado.
-- Também corrigi no código um bug que sobrescrevia o título do
-- requisito GISTM pelo código (ex: "P07") a cada salvamento — como o
-- RLS sempre bloqueou a escrita, isso nunca chegou a corromper dados
-- de verdade, mas só ia parar de acontecer depois deste fix de RLS.
--
-- Rode este script no SQL Editor do Supabase do projeto correto.
-- ============================================================

begin;

-- ── 1. Política de escrita para hidrobr_admin (idempotente) ─────────────
drop policy if exists "gistm_requirements_admin_write" on gistm_requirements;
create policy "gistm_requirements_admin_write" on gistm_requirements for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- standard_requirements não está no supabase-schema.sql do repositório (foi
-- criada depois, fora do controle de versão) — garantimos aqui que RLS está
-- ligado e criamos a mesma política, sem presumir que já exista.
alter table if exists standard_requirements enable row level security;
drop policy if exists "standard_requirements_admin_write" on standard_requirements;
create policy "standard_requirements_admin_write" on standard_requirements for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- ── 2. Define peso 1 em todos os requisitos (GISTM e TSM) ────────────────
update gistm_requirements set weight = 1;
update standard_requirements set weight = 1;

commit;

-- Confira o resultado:
-- select code, weight from gistm_requirements order by display_order;
-- select code, weight from standard_requirements order by display_order;
