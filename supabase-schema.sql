-- ============================================================
-- HIDROBR GISTM Manager — Schema para Supabase
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- ── ENUMS ─────────────────────────────────────────────────────
create type user_role as enum ('hidrobr_admin','hidrobr_consultant','client_admin','client_user','readonly');
create type requirement_status as enum ('not_started','in_progress','submitted','under_review','approved','needs_revision');
create type assessment_score as enum ('non_conforming','partially_conforming','conforming','fully_conforming','not_applicable');
create type cycle_status as enum ('active','completed','archived','suspended');
create type action_priority as enum ('critical','high','medium','low');
create type action_status as enum ('open','in_progress','completed','cancelled','overdue');
create type content_type as enum ('video','article','webinar','document','quiz');
create type trail_status as enum ('draft','published','archived');

-- ── ORGANIZAÇÕES ──────────────────────────────────────────────
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name varchar(255) not null,
  cnpj varchar(18) unique,
  segment varchar(100),
  logo_url text,
  address jsonb default '{}',
  contacts jsonb default '{}',
  contract_start date,
  contract_end date,
  is_active boolean default true,
  settings jsonb default '{}',
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── PERFIS DE USUÁRIO (estende auth.users do Supabase) ────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id),
  full_name varchar(255) not null,
  role user_role not null default 'client_user',
  job_title varchar(150),
  phone varchar(30),
  avatar_url text,
  is_active boolean default true,
  preferences jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── TÓPICOS GISTM ─────────────────────────────────────────────
create table gistm_topics (
  id serial primary key,
  code varchar(10) not null unique,
  title varchar(255) not null,
  description text,
  display_order smallint not null,
  color_hex varchar(7),
  icon varchar(50)
);

-- ── PRINCÍPIOS GISTM ──────────────────────────────────────────
create table gistm_requirements (
  id serial primary key,
  topic_id integer not null references gistm_topics(id),
  code varchar(10) not null unique,
  title varchar(500) not null,
  description text not null,
  guidance text,
  display_order smallint not null,
  weight numeric(5,2) default 1.0,
  sub_requirements jsonb default '[]'
);

-- ── BARRAGENS ─────────────────────────────────────────────────
create table tailings_facilities (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name varchar(255) not null,
  dam_code varchar(50),
  location jsonb default '{}',
  dam_type varchar(100),
  consequence_class varchar(20),
  current_volume numeric(15,2),
  total_capacity numeric(15,2),
  height_meters numeric(8,2),
  construction_year smallint,
  operational_status varchar(50),
  assigned_engineer varchar(255),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── CICLOS DE AVALIAÇÃO ───────────────────────────────────────
create table assessment_cycles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  facility_id uuid not null references tailings_facilities(id),
  name varchar(255) not null,
  reference_year smallint not null,
  start_date date not null,
  target_date date,
  completed_date date,
  status cycle_status default 'active',
  assigned_consultant uuid references profiles(id),
  overall_score numeric(5,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── RESPOSTAS DOS PRINCÍPIOS ──────────────────────────────────
create table requirement_responses (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid not null references assessment_cycles(id) on delete cascade,
  requirement_id integer not null references gistm_requirements(id),
  status requirement_status default 'not_started',
  implementation_text text,
  responsible_person varchar(255),
  sub_req_responses jsonb default '{}',
  submitted_at timestamptz,
  revision_count smallint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cycle_id, requirement_id)
);

-- ── AVALIAÇÕES HIDROBR ────────────────────────────────────────
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

-- ── EVIDÊNCIAS ────────────────────────────────────────────────
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

-- ── COMENTÁRIOS ───────────────────────────────────────────────
create table comments (
  id uuid primary key default uuid_generate_v4(),
  response_id uuid not null references requirement_responses(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);

-- ── PLANO DE AÇÃO ─────────────────────────────────────────────
create table action_items (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id),
  requirement_code varchar(10),
  title varchar(500) not null,
  description text,
  priority action_priority default 'medium',
  status action_status default 'open',
  due_date date,
  completed_at timestamptz,
  owner_id uuid references profiles(id),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── NOTIFICAÇÕES ──────────────────────────────────────────────
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid references organizations(id),
  type varchar(50) not null,
  title varchar(255) not null,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ── ACADEMY ───────────────────────────────────────────────────
create table academy_contents (
  id uuid primary key default uuid_generate_v4(),
  requirement_id integer references gistm_requirements(id),
  title varchar(500) not null,
  summary text,
  content_type content_type not null,
  media_url text,
  duration_minutes smallint,
  difficulty_level varchar(20),
  tags text[] default '{}',
  is_published boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table learning_trails (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid not null references profiles(id),
  title varchar(300) not null,
  description text,
  target_role user_role,
  target_org_id uuid references organizations(id),
  status trail_status default 'draft',
  estimated_hours numeric(5,1),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table trail_contents (
  id uuid primary key default uuid_generate_v4(),
  trail_id uuid not null references learning_trails(id) on delete cascade,
  content_id uuid not null references academy_contents(id) on delete cascade,
  display_order smallint not null,
  unique(trail_id, content_id)
);

create table user_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  content_id uuid not null references academy_contents(id) on delete cascade,
  trail_id uuid references learning_trails(id),
  completed boolean default false,
  progress_pct smallint default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, content_id, trail_id)
);

-- ── EQUIPE HIDROBR ATRIBUÍDA AO CLIENTE (N:N) ─────────────────
-- Substitui o antigo assessment_cycles.assigned_consultant (1 consultor por
-- ciclo) por uma atribuição no nível do cliente, permitindo várias pessoas
-- da equipe HIDROBR no mesmo cliente.
create table organization_team_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (organization_id, profile_id)
);

-- ── ÍNDICES ───────────────────────────────────────────────────
create index idx_profiles_org on profiles(organization_id);
create index idx_profiles_role on profiles(role);
create index idx_facilities_org on tailings_facilities(organization_id);
create index idx_cycles_org on assessment_cycles(organization_id);
create index idx_responses_cycle on requirement_responses(cycle_id);
create index idx_responses_status on requirement_responses(cycle_id, status);
create index idx_evidences_response on evidences(response_id);
create index idx_notifications_user on notifications(user_id, is_read);
create index idx_actions_org on action_items(organization_id, status);
create index idx_org_team_members_org on organization_team_members(organization_id);
create index idx_org_team_members_profile on organization_team_members(profile_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table tailings_facilities enable row level security;
alter table assessment_cycles enable row level security;
alter table requirement_responses enable row level security;
alter table hidrobr_assessments enable row level security;
alter table evidences enable row level security;
alter table comments enable row level security;
alter table action_items enable row level security;
alter table notifications enable row level security;
alter table academy_contents enable row level security;
alter table learning_trails enable row level security;
alter table user_progress enable row level security;
alter table organization_team_members enable row level security;

-- Políticas: usuário lê seus próprios dados ou dados da sua org
-- GISTM topics e requirements são públicos (leitura)
alter table gistm_topics enable row level security;
alter table gistm_requirements enable row level security;
create policy "gistm_topics_public_read" on gistm_topics for select using (true);
create policy "gistm_requirements_public_read" on gistm_requirements for select using (true);

-- Profiles: usuário vê o próprio perfil
create policy "profiles_own" on profiles for all using (auth.uid() = id);

-- Organizations: usuário vê a própria org; HIDROBR vê todas
create policy "org_own_or_hidrobr" on organizations for select using (
  id in (select organization_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- Ciclos: mesma lógica
create policy "cycles_access" on assessment_cycles for select using (
  organization_id in (select organization_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- Respostas: mesma lógica via ciclo
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

-- Avaliações HIDROBR: todos podem ler, só HIDROBR pode inserir
create policy "assessments_read" on hidrobr_assessments for select using (true);
create policy "assessments_hidrobr_write" on hidrobr_assessments for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- Evidências
create policy "evidences_access" on evidences for all using (
  response_id in (
    select rr.id from requirement_responses rr
    join assessment_cycles ac on ac.id = rr.cycle_id
    where ac.organization_id in (select organization_id from profiles where id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
  )
);

-- Comentários
create policy "comments_access" on comments for all using (
  response_id in (
    select rr.id from requirement_responses rr
    join assessment_cycles ac on ac.id = rr.cycle_id
    where ac.organization_id in (select organization_id from profiles where id = auth.uid())
    or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
  )
);

-- Ações
create policy "actions_access" on action_items for all using (
  organization_id in (select organization_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- Notificações: cada um vê as suas
create policy "notifications_own" on notifications for all using (user_id = auth.uid());

-- Academy
create policy "academy_contents_read" on academy_contents for select using (is_published = true or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant')));
create policy "academy_contents_write" on academy_contents for all using (exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant')));
create policy "trails_read" on learning_trails for select using (status = 'published' or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant')));
create policy "trails_write" on learning_trails for all using (exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant')));
create policy "trail_contents_read" on trail_contents for select using (true);
create policy "progress_own" on user_progress for all using (user_id = auth.uid());
create policy "facilities_access" on tailings_facilities for select using (
  organization_id in (select organization_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);

-- Equipe do cliente: mesma lógica de leitura; só hidrobr_admin gerencia atribuições
create policy "org_team_members_select" on organization_team_members for select using (
  organization_id in (select organization_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role in ('hidrobr_admin','hidrobr_consultant'))
);
create policy "org_team_members_write" on organization_team_members for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'hidrobr_admin')
) with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'hidrobr_admin')
);

-- ── TRIGGER: criar profile ao registrar usuário ───────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client_user')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── MIGRAÇÃO: preserva atribuições antigas (1 consultor/ciclo) ─
-- na nova tabela de equipe por cliente (N:N).
insert into organization_team_members (organization_id, profile_id)
select distinct organization_id, assigned_consultant
from assessment_cycles
where assigned_consultant is not null
on conflict (organization_id, profile_id) do nothing;

-- ── SEED: TÓPICOS E PRINCÍPIOS GISTM ─────────────────────────
insert into gistm_topics (code,title,display_order,color_hex,icon) values
('T1','Propriedade, Responsabilidade e Compromissos',1,'#005F73','shield'),
('T2','Conhecimento da Barragem',2,'#0A9396','database'),
('T3','Projeto, Construção e Operação',3,'#1B7A8A','settings'),
('T4','Gestão de Riscos',4,'#2D6A4F','alert-triangle'),
('T5','Preparação e Resposta a Emergências',5,'#92400E','flame');

insert into gistm_requirements (topic_id,code,title,description,guidance,display_order,weight,sub_requirements) values
(1,'P01','Propriedade e Responsabilidade','O Executivo Responsável designou um executivo sênior com autoridade e recursos necessários para implementar o GISTM.','Documente a designação formal do responsável sênior, incluindo carta de nomeação e descrição de cargo atualizada.',1,1.0,'[{"id":"P01-a","text":"Executivo Responsável formalmente designado por escrito"},{"id":"P01-b","text":"Descrição de cargo atualizada com responsabilidades GISTM"},{"id":"P01-c","text":"Alocação de orçamento documentada"},{"id":"P01-d","text":"Registro de comprometimento da liderança"}]'),
(1,'P02','Competência Organizacional','O Proprietário possui capacidade organizacional e recursos para implementar e manter a gestão segura de rejeitos.','Demonstre através de organograma, descrições de cargos e programas de desenvolvimento de competências.',2,1.0,'[{"id":"P02-a","text":"Organograma da gestão de barragens definido"},{"id":"P02-b","text":"Matriz de competências elaborada"},{"id":"P02-c","text":"Programa de treinamento documentado"},{"id":"P02-d","text":"Procedimento de gestão de mudanças"}]'),
(1,'P03','Integração ao Sistema de Gestão','A gestão de rejeitos está integrada ao sistema de gestão do Proprietário.','Apresente política de gestão de barragens, integração com SMS e objetivos mensuráveis.',3,1.0,'[{"id":"P03-a","text":"Política de gestão publicada e comunicada"},{"id":"P03-b","text":"Integração com SMS documentada"},{"id":"P03-c","text":"KPIs de segurança estabelecidos"},{"id":"P03-d","text":"Processo de revisão periódica"}]'),
(2,'P04','Caracterização do Local','Existe uma compreensão abrangente da instalação de rejeitos e seu entorno, mantida atualizada.','Documente estudos geológicos, geotécnicos, hidrológicos e hidrogeológicos completos.',4,1.0,'[{"id":"P04-a","text":"Estudo geológico e geotécnico atual"},{"id":"P04-b","text":"Estudo hidrológico atualizado"},{"id":"P04-c","text":"Investigação sísmica documentada"},{"id":"P04-d","text":"Dados ambientais catalogados"}]'),
(2,'P05','Documentação de Projeto','A documentação de projeto está completa, atualizada e acessível.','Mantenha sistema de gestão documental com projetos as-built e memoriais de cálculo.',5,1.0,'[{"id":"P05-a","text":"Projetos as-built disponíveis e atualizados"},{"id":"P05-b","text":"Memoriais de cálculo documentados"},{"id":"P05-c","text":"Sistema documental implementado"},{"id":"P05-d","text":"Histórico de modificações registrado"}]'),
(2,'P06','Gestão do Conhecimento','Informações relacionadas à instalação são gerenciadas sistematicamente.','Estabeleça sistema com controle de versões e transferência de conhecimento.',6,1.0,'[{"id":"P06-a","text":"Plataforma documental implementada"},{"id":"P06-b","text":"Controle de versões estabelecido"},{"id":"P06-c","text":"Plano de transferência de conhecimento"},{"id":"P06-d","text":"Backup e recuperação garantidos"}]'),
(3,'P07','Projeto e Construção','A instalação de rejeitos é projetada e construída de forma segura.','Demonstre conformidade com normas técnicas e supervisão por profissional habilitado.',7,1.5,'[{"id":"P07-a","text":"Critérios de projeto documentados"},{"id":"P07-b","text":"Plano de controle de qualidade"},{"id":"P07-c","text":"Supervisão técnica habilitada (ART)"},{"id":"P07-d","text":"Inspeções de construção registradas"},{"id":"P07-e","text":"Ensaios de laboratório documentados"}]'),
(3,'P08','Caracterização dos Rejeitos','Os rejeitos e a água são caracterizados e compreendidos.','Apresente programa de caracterização físico-química e geotécnica.',8,1.0,'[{"id":"P08-a","text":"Programa de caracterização físico-química"},{"id":"P08-b","text":"Ensaios geotécnicos periódicos"},{"id":"P08-c","text":"Balanço hídrico calculado"},{"id":"P08-d","text":"Programa de qualidade da água"}]'),
(3,'P09','Operações','A instalação é operada de forma segura e em conformidade com o projeto.','Mantenha procedimentos operacionais, instrumentação e inspeções documentadas.',9,1.5,'[{"id":"P09-a","text":"Manual de operação atualizado"},{"id":"P09-b","text":"Programa de instrumentação implementado"},{"id":"P09-c","text":"Inspeções regulares registradas"},{"id":"P09-d","text":"Relatórios de desempenho periódicos"},{"id":"P09-e","text":"Gestão de alteamentos documentada"}]'),
(3,'P10','Fechamento e Pós-Fechamento','O fechamento é planejado e a instalação será segura em caráter permanente.','Elabore plano de fechamento integrado com provisão financeira.',10,1.0,'[{"id":"P10-a","text":"Plano de fechamento elaborado"},{"id":"P10-b","text":"Provisão financeira estabelecida"},{"id":"P10-c","text":"Critérios de sucesso definidos"},{"id":"P10-d","text":"Monitoramento pós-fechamento planejado"}]'),
(4,'P11','Classificação de Consequências','As potenciais consequências de ruptura são compreendidas e classificadas.','Realize estudo de ruptura hipotética e classifique conforme DNPM/ANM.',11,1.5,'[{"id":"P11-a","text":"Estudo de ruptura hipotética (ERT)"},{"id":"P11-b","text":"Classificação DPA realizada"},{"id":"P11-c","text":"Mapeamento de populações a jusante"},{"id":"P11-d","text":"Revisão periódica da classificação"}]'),
(4,'P12','Avaliação de Perigos','Perigos e consequências identificados e avaliados.','Execute análise sistematizada (HAZID/FMEA) com equipe multidisciplinar.',12,1.5,'[{"id":"P12-a","text":"Análise de perigos realizada (HAZID/FMEA)"},{"id":"P12-b","text":"Cenários de falha documentados"},{"id":"P12-c","text":"Avaliação de perigos naturais"},{"id":"P12-d","text":"Revisão periódica da análise"}]'),
(4,'P13','Avaliação de Riscos','Os riscos associados à instalação são avaliados.','Conduza avaliação quantitativa ou semi-quantitativa com matriz documentada.',13,1.5,'[{"id":"P13-a","text":"Avaliação de risco quantitativa realizada"},{"id":"P13-b","text":"Matriz de risco documentada"},{"id":"P13-c","text":"Comparação com critérios ALARP"},{"id":"P13-d","text":"Revisão após eventos significativos"}]'),
(4,'P14','Mitigação de Riscos','Os riscos são gerenciados para tão baixo quanto razoavelmente praticável (ALARP).','Implemente plano de mitigação com prazos, responsáveis e verificação de eficácia.',14,1.5,'[{"id":"P14-a","text":"Plano de mitigação elaborado"},{"id":"P14-b","text":"Critério ALARP aplicado"},{"id":"P14-c","text":"Barreiras de controle monitoradas"},{"id":"P14-d","text":"Verificação de eficácia das medidas"}]'),
(4,'P15','Revisão Independente','A instalação é sujeita a revisão regular por parte independente qualificada.','Contrate Revisão de Segurança de Barragem por profissional independente.',15,2.0,'[{"id":"P15-a","text":"Revisor independente qualificado contratado"},{"id":"P15-b","text":"Escopo da revisão definido"},{"id":"P15-c","text":"Relatório de revisão disponível"},{"id":"P15-d","text":"Plano de ação implementado"},{"id":"P15-e","text":"Frequência adequada à classe"}]'),
(5,'P16','Plano de Ação de Emergência','Um Plano de Ação de Emergência (PAE) existe e é mantido atualizado.','Elabore PAE conforme Portaria DNPM 70.389/2017, realize simulados periodicamente.',16,2.0,'[{"id":"P16-a","text":"PAE elaborado conforme legislação"},{"id":"P16-b","text":"Mapa de zonas de autossalvamento"},{"id":"P16-c","text":"Sistema de alerta instalado e testado"},{"id":"P16-d","text":"Simulados realizados e documentados"},{"id":"P16-e","text":"Integração com Defesa Civil comprovada"}]'),
(5,'P17','Revisão do Sistema de Gestão','O sistema de gestão é periodicamente revisado quanto à sua eficácia.','Realize auditorias internas e revisões pela direção com frequência definida.',17,1.0,'[{"id":"P17-a","text":"Programa de auditoria executado"},{"id":"P17-b","text":"Revisão pela direção realizada"},{"id":"P17-c","text":"Indicadores monitorados e analisados"},{"id":"P17-d","text":"Plano de melhoria contínua"}]'),
(5,'P18','Comunidades Afetadas','Os direitos e interesses das comunidades afetadas são identificados e gerenciados.','Desenvolva programa de engajamento comunitário e mapeie populações afetadas.',18,1.0,'[{"id":"P18-a","text":"Mapeamento de comunidades realizado"},{"id":"P18-b","text":"Programa de engajamento implementado"},{"id":"P18-c","text":"Canal de comunicação estabelecido"},{"id":"P18-d","text":"Registro de consultas mantido"}]');
