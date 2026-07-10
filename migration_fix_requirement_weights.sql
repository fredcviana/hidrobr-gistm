-- ============================================================
-- FIX: peso dos requisitos GISTM/TSM nao salva na tela de
-- Configuracoes de Padroes + define todos os pesos como 1.
--
-- DIAGNOSTICO: gistm_requirements e standard_requirements tem RLS
-- (Row Level Security) habilitado, mas so existe politica de LEITURA
-- ("gistm_requirements_public_read" etc). Nao existe politica de
-- UPDATE para o hidrobr_admin. Isso faz o UPDATE feito pela tela de
-- configuracoes afetar 0 linhas SEM gerar erro - por isso parecia
-- "salvar" (a tela mostrava sucesso) mas o valor nunca era gravado.
--
-- Rode este script no SQL Editor do Supabase do projeto correto.
-- ============================================================

begin;

-- 1. Politica de escrita para hidrobr_admin (idempotente)
drop policy if exists "gistm_requirements_admin_write" on gistm_requirements;

create policy "gistm_requirements_admin_write" on gistm_requirements for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- standard_requirements nao esta no supabase-schema.sql do repositorio (foi
-- criada depois, fora do controle de versao) - garantimos aqui que RLS esta
-- ligado e criamos a mesma politica, sem presumir que ja exista.
alter table if exists standard_requirements enable row level security;

drop policy if exists "standard_requirements_admin_write" on standard_requirements;

create policy "standard_requirements_admin_write" on standard_requirements for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- 2. Define peso 1 em todos os requisitos (GISTM e TSM)
update gistm_requirements set weight = 1;
update standard_requirements set weight = 1;

commit;

-- Confira o resultado:
-- select code, weight from gistm_requirements order by display_order;
-- select code, weight from standard_requirements order by display_order;
