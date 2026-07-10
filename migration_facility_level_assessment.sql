-- ============================================================
-- MIGRACAO: avaliacao de requisitos GISTM/TSM por BARRAGEM
-- Execute este SQL no SQL Editor do Supabase do projeto hidrobr-gistm
--
-- Contexto (definido com o cliente em 2026-07-09):
--   Hoje cada requisito (GISTM e TSM) e avaliado uma unica vez por CICLO,
--   mesmo quando o ciclo cobre varias barragens (assessment_cycles.facility_ids).
--   A partir desta migracao, cada barragem em escopo do ciclo passa a ter sua
--   propria resposta/avaliacao por requisito. O resultado do requisito no
--   nivel do CLIENTE passa a ser a MEDIA SIMPLES entre as barragens (calculada
--   no frontend, ver src/lib/facilityScoring.ts - nao ha coluna persistida
--   com esse valor).
--
-- Decisao de migracao de dados (aprovada com o cliente): ZERAR e reavaliar do
-- zero por barragem, em vez de duplicar as respostas antigas (que nao tinham
-- granularidade de barragem). Por isso este script ARQUIVA as respostas e
-- avaliacoes atuais em tabelas *_legacy_pre_facility (nao deleta o historico
-- definitivamente) e recria requirement_responses/tsm_responses vazias, ja
-- com a coluna facility_id obrigatoria.
--
-- IMPORTANTE - leia antes de rodar:
--   1. Este script foi escrito com base na leitura do codigo-fonte do app
--      (nao foi possivel confirmar diretamente o schema em producao neste
--      momento). Antes de rodar em producao, rode primeiro em um projeto
--      Supabase de staging/copia e confira se os nomes de constraint
--      (ON CONFLICT / UNIQUE) batem com os reais - use "\d requirement_responses"
--      e "\d tsm_responses" no SQL Editor para conferir antes.
--   2. Evidencias (arquivos no Storage) ligadas as respostas arquivadas NAO
--      sao apagadas do bucket "evidences" - apenas a referencia na tabela
--      evidences e arquivada junto com a resposta. Se precisar recuperar
--      arquivos antigos, consulte evidences_legacy_pre_facility.
--   3. Roda dentro de uma transacao (BEGIN/COMMIT ja incluido). Se algo
--      falhar, o Postgres desfaz tudo automaticamente.
-- ============================================================

begin;

-- 1. Arquiva GISTM: requirement_responses + dependentes
alter table if exists requirement_responses rename to requirement_responses_legacy_pre_facility;
alter table if exists hidrobr_assessments rename to hidrobr_assessments_legacy_pre_facility;
alter table if exists evidences rename to evidences_legacy_pre_facility;
alter table if exists comments rename to comments_legacy_pre_facility;

-- Renomear uma tabela NAO renomeia seus indices/constraints (eles ficam com o
-- nome antigo, ex: requirement_responses_pkey, idx_responses_cycle). Isso faz
-- as proximas CREATE TABLE/CREATE INDEX colidirem por nome duplicado. Este
-- bloco renomeia tudo que pertence as tabelas arquivadas, liberando os nomes
-- originais para as tabelas novas.
do $$
declare
  tbl text;
  r record;
begin
  foreach tbl in array array[
    'requirement_responses_legacy_pre_facility',
    'hidrobr_assessments_legacy_pre_facility',
    'evidences_legacy_pre_facility',
    'comments_legacy_pre_facility'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      for r in select conname from pg_constraint where conrelid = ('public.' || tbl)::regclass loop
        execute format('alter table public.%I rename constraint %I to %I', tbl, r.conname, r.conname || '_legacy');
      end loop;
      for r in select indexname from pg_indexes where schemaname = 'public' and tablename = tbl and indexname not like '%\_legacy' loop
        execute format('alter index public.%I rename to %I', r.indexname, r.indexname || '_legacy');
      end loop;
    end if;
  end loop;
end $$;

-- 2. Recria requirement_responses ja com facility_id obrigatorio
create table requirement_responses (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid not null references assessment_cycles(id) on delete cascade,
  facility_id uuid not null references tailings_facilities(id) on delete cascade,
  requirement_id integer not null references gistm_requirements(id),
  status requirement_status default 'not_started',
  implementation_text text,
  responsible_person varchar(255),
  sub_req_responses jsonb default '{}',
  submitted_at timestamptz,
  revision_count smallint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cycle_id, facility_id, requirement_id)
);
create index idx_responses_cycle on requirement_responses(cycle_id);
create index idx_responses_facility on requirement_responses(facility_id);
create index idx_responses_status on requirement_responses(cycle_id, status);

create table hidrobr_assessments (
  id uuid primary key default uuid_generate_v4(),
  response_id uuid not null unique references requirement_responses(id) on delete cascade,
  assessed_by uuid not null references profiles(id),
  score assessment_score not null,
  score_value smallint not null,
  assessment_text text not null,
  recommendations text,
  internal_notes text,
  published_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create table evidences (
  id uuid primary key default uuid_generate_v4(),
  response_id uuid not null references requirement_responses(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  file_name varchar(500) not null,
  storage_path text not null,
  file_size bigint,
  mime_type varchar(100),
  description text,
  is_valid boolean default true,
  validated_by uuid references profiles(id),
  validated_at timestamptz,
  created_at timestamptz default now()
);
create index idx_evidences_response on evidences(response_id);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  response_id uuid not null references requirement_responses(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);

-- 3. RLS + policies (mesma regra de acesso de antes, por organizacao)
alter table requirement_responses enable row level security;
alter table hidrobr_assessments enable row level security;
alter table evidences enable row level security;
alter table comments enable row level security;

create policy "responses_access" on requirement_responses for select using (
  cycle_id in (
    select id from assessment_cycles where
      organization_id in (select organization_id from profiles where id = auth.uid())
      or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
  )
);
create policy "responses_insert_update" on requirement_responses for all using (
  cycle_id in (
    select id from assessment_cycles where
      organization_id in (select organization_id from profiles where id = auth.uid())
      or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
  )
);
create policy "assessments_read" on hidrobr_assessments for select using (true);
create policy "assessments_hidrobr_write" on hidrobr_assessments for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);
create policy "evidences_access" on evidences for all using (
  response_id in (
    select rr.id from requirement_responses rr
    join assessment_cycles ac on ac.id = rr.cycle_id
    where ac.organization_id in (select organization_id from profiles where id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
  )
);
create policy "comments_access" on comments for all using (
  response_id in (
    select rr.id from requirement_responses rr
    join assessment_cycles ac on ac.id = rr.cycle_id
    where ac.organization_id in (select organization_id from profiles where id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
  )
);

-- 4. Arquiva TSM: tsm_responses + tsm_assessments
-- Ajuste o nome/coluna abaixo caso o schema real de tsm_responses tenha
-- colunas adicionais nao previstas aqui (confira com "\d tsm_responses" antes
-- de rodar em producao).
alter table if exists tsm_responses rename to tsm_responses_legacy_pre_facility;
alter table if exists tsm_assessments rename to tsm_assessments_legacy_pre_facility;

-- mesma correcao de nomes de indices/constraints explicada no passo 1
do $$
declare
  tbl text;
  r record;
begin
  foreach tbl in array array[
    'tsm_responses_legacy_pre_facility',
    'tsm_assessments_legacy_pre_facility'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      for r in select conname from pg_constraint where conrelid = ('public.' || tbl)::regclass loop
        execute format('alter table public.%I rename constraint %I to %I', tbl, r.conname, r.conname || '_legacy');
      end loop;
      for r in select indexname from pg_indexes where schemaname = 'public' and tablename = tbl and indexname not like '%\_legacy' loop
        execute format('alter index public.%I rename to %I', r.indexname, r.indexname || '_legacy');
      end loop;
    end if;
  end loop;
end $$;

create table tsm_responses (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid not null references assessment_cycles(id) on delete cascade,
  facility_id uuid not null references tailings_facilities(id) on delete cascade,
  requirement_id integer not null references standard_requirements(id),
  status requirement_status default 'not_started',
  implementation_text text,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cycle_id, facility_id, requirement_id)
);
create index idx_tsm_responses_cycle on tsm_responses(cycle_id);
create index idx_tsm_responses_facility on tsm_responses(facility_id);

create table tsm_assessments (
  id uuid primary key default uuid_generate_v4(),
  response_id uuid not null unique references tsm_responses(id) on delete cascade,
  assessed_by uuid not null references profiles(id),
  score assessment_score not null,
  score_value smallint not null,
  assessment_text text not null,
  recommendations text,
  published_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table tsm_responses enable row level security;
alter table tsm_assessments enable row level security;

create policy "tsm_responses_access" on tsm_responses for all using (
  cycle_id in (
    select id from assessment_cycles where
      organization_id in (select organization_id from profiles where id = auth.uid())
      or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
  )
);
create policy "tsm_assessments_read" on tsm_assessments for select using (true);
create policy "tsm_assessments_hidrobr_write" on tsm_assessments for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

commit;

-- ============================================================
-- Apos rodar com sucesso e validar o app, as tabelas *_legacy_pre_facility
-- podem ser mantidas indefinidamente como historico (nao atrapalham o app,
-- que nao faz mais referencia a elas) ou removidas manualmente quando nao
-- forem mais necessarias, com:
--   drop table requirement_responses_legacy_pre_facility cascade;
--   drop table hidrobr_assessments_legacy_pre_facility cascade;
--   drop table evidences_legacy_pre_facility cascade;
--   drop table comments_legacy_pre_facility cascade;
--   drop table tsm_responses_legacy_pre_facility cascade;
--   drop table tsm_assessments_legacy_pre_facility cascade;
-- ============================================================
