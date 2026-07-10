-- ============================================================
-- IMPORTACAO: avaliacao GISTM da GMining / Brazauro Recursos Minerais
-- (unidade Tocantinzinho) a partir do documento
-- HBR101550001-GMN-RT001_R1_APENDICE_I_GISTM.xlsx
--
-- Este script assume que ja existem no sistema:
--   - a organizacao (Brazauro Recursos Minerais / GMining)
--   - as 3 barragens/estruturas: "Barragem TZ", "Celula 1", "Celula 2"
--   - um ciclo de avaliacao ATIVO para essa organizacao, com as 3
--     estruturas acima associadas (facility_ids)
--
-- ATUALIZACAO 2026-07-10: a primeira versao deste script usava ILIKE para
-- casar nomes de barragens/organizacao, e isso silenciosamente resolveu ZERO
-- linhas (o join nao deu erro, so nao encontrou match) porque os nomes reais
-- no banco sao "TZ" (nao "Barragem TZ") e "Celula 1"/"Celula 2" com acento
-- (o ILIKE nao ignora acento). O resultado: o script "deu certo" (sem erro)
-- mas nao inseriu nenhuma linha. Corrigido: os IDs abaixo foram confirmados
-- via consulta direta ao banco em 2026-07-10 e estao fixos (hardcoded) no
-- CTE "resolved", eliminando esse tipo de falha silenciosa:
--   organizacao (GMining): c8b41edd-a217-4a99-ab71-2a97f06a1040
--   ciclo ativo (Ciclo 2025): 637aa7f4-5332-4a1d-946f-9ab77219fde4
--   barragem TZ: ed11af20-6ce7-4f19-b0b8-527e0ffd951b
--   Celula 1: 0e6db5e4-be92-4dfd-86d5-c3e63171e973
--   Celula 2: c9ebe409-535a-4fda-aaa7-8899292e7b8a
-- Se esses registros forem recriados/apagados os IDs mudam - rode a ETAPA 0
-- de novo para confirmar antes de reusar este script.
--
-- Metodologia (definida com o cliente em 2026-07-10): o resultado do
-- requisito no nivel do cliente e o PIOR CASO entre as 3 estruturas -
-- e exatamente assim que a aba "2. ADERENCIA GISTM" do Excel calcula a
-- "Aderencia Considerada" (conferido: bate com o minimo em 100% das 77
-- linhas). Os scores continuos do Excel (0, 0.25, 0.5, 0.67, 0.75...)
-- foram convertidos para os 4 niveis do sistema por faixa:
--   = 100%        -> Totalmente Conforme (100)
--   >= 75%         -> Conforme (75)
--   >= 25%         -> Parcialmente Conforme (50)
--   <  25% (e 0%)  -> Nao Conforme (0)
--   "NAO APLICAVEL" no Excel -> Nao Aplicavel (excluido do pior-caso daquela
--   estrutura; se TODAS as estruturas forem N/A no mesmo requisito, o
--   requisito conta como 100 para nao penalizar o cliente - isso e uma
--   aproximacao: o Excel exclui esse requisito do calculo por completo.
--   So 1 dos 77 requisitos (10.5, RPSB) cai nesse caso neste documento;
--   a diferenca no score final do app fica em ~0,7 ponto percentual acima
--   do que o Excel reporta (44,98%). Avise se quiser paridade exata --
--   requer uma mudanca adicional no motor de calculo do app.
--
-- O parecer tecnico de cada resposta (assessment_text) usa o texto REAL da
-- coluna "OBSERVACAO HIDROBR (LACUNAS)" do Excel (aba "2. ADERENCIA GISTM")
-- quando havia gap identificado -- ou seja, quando a estrutura NAO estava
-- totalmente conforme, o mesmo texto de observacao registrado no Excel para
-- aquele requisito e usado nas 3 estruturas (o Excel nao detalha a
-- observacao por estrutura, so por requisito). Quando o requisito estava
-- plenamente atendido ou nao aplicavel, usa-se um texto padrao. Acentos
-- foram removidos do texto (transliteracao ASCII) para evitar corrupcao ao
-- colar no SQL Editor do Supabase (mesmo problema ja visto nas migrations
-- anteriores).
-- ============================================================

-- ==================== ETAPA 0: VERIFICACAO (rode antes) ====================
-- Devem retornar exatamente 1 linha:
select id, name from organizations where name ilike '%Brazauro%' or name ilike '%GMining%' or name ilike '%G Mining%' or name ilike '%Tocantinzinho%';

-- Devem retornar exatamente 3 linhas (ajuste os padroes se os nomes reais forem diferentes):
select id, name, organization_id from tailings_facilities
where organization_id = (select id from organizations where name ilike '%Brazauro%' or name ilike '%GMining%' or name ilike '%G Mining%' or name ilike '%Tocantinzinho%' limit 1)
  and (name ilike '%Barragem%TZ%' or name ilike '%elula 1%' or name ilike '%elula 2%');

-- Deve retornar exatamente 1 linha (o ciclo ativo que sera usado):
select id, name, facility_ids from assessment_cycles
where organization_id = (select id from organizations where name ilike '%Brazauro%' or name ilike '%GMining%' or name ilike '%G Mining%' or name ilike '%Tocantinzinho%' limit 1)
  and status = 'active'
order by created_at desc limit 1;

-- Deve retornar 77 linhas (confirma que gistm_requirements.code usa o formato "1.1".."15.3"):
select count(*) from gistm_requirements where code ~ '^[0-9]+\.[0-9]+$';


-- ==================== ETAPA 1: INSERCAO (so rode apos validar a etapa 0) ====================
begin;

with assessor as (
  select id as assessed_by from profiles where role in ('hidrobr_admin','hidrobr_consultant') order by created_at limit 1
),
raw(facility_name, requirement_code, status, score, score_value, assessment_text) as (
  values
  ('Barragem TZ', '1.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '1.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '1.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '1.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '1.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '1.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '1.3', 'needs_revision', 'partially_conforming', 50, 'Necessidade de formalizacao de um plano estruturado de engajamento das pessoas afetadas pelo projeto. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '1.3', 'needs_revision', 'partially_conforming', 50, 'Necessidade de formalizacao de um plano estruturado de engajamento das pessoas afetadas pelo projeto. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '1.3', 'needs_revision', 'partially_conforming', 50, 'Necessidade de formalizacao de um plano estruturado de engajamento das pessoas afetadas pelo projeto. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '1.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '1.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '1.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '2.1', 'approved', 'conforming', 75, 'Necessidade de incorporar, de forma explicita, incertezas relacionadas as mudancas climaticas nos estudos existentes. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '2.1', 'approved', 'conforming', 75, 'Necessidade de incorporar, de forma explicita, incertezas relacionadas as mudancas climaticas nos estudos existentes. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '2.1', 'approved', 'conforming', 75, 'Necessidade de incorporar, de forma explicita, incertezas relacionadas as mudancas climaticas nos estudos existentes. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '2.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de complementar e atualizar a caracterizacao fisico-quimica dos rejeitos, de forma a captar adequadamente a variabilidade de suas propriedades ao longo do tempo. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '2.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de complementar e atualizar a caracterizacao fisico-quimica dos rejeitos, de forma a captar adequadamente a variabilidade de suas propriedades ao longo do tempo. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '2.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '2.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '2.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '2.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '2.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '2.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '2.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '3.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '3.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '3.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '3.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '3.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '3.2', 'approved', 'conforming', 75, 'Necessidade de documentar a revisao e aprovacao da analise multicriterio pelo CIRR ou por revisor tecnico independente. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '3.3', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '3.3', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '3.3', 'needs_revision', 'partially_conforming', 50, 'Necessidade de incluir, de forma explicita, a avaliacao de impactos considerando incertezas relacionadas as mudancas climaticas e de documentar planos de mitigacao conforme a hierarquia de mitigacao. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '3.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de incorporar, nas atualizacoes de impacto, a avaliacao de efeitos associados as mudancas climaticas e impactos de longo prazo, com aplicacao formal dos principios de gestao adaptativa. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '3.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de incorporar, nas atualizacoes de impacto, a avaliacao de efeitos associados as mudancas climaticas e impactos de longo prazo, com aplicacao formal dos principios de gestao adaptativa. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '3.4', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de ajustar, nos documentos de projeto, os criterios adotados de forma a demonstrar explicitamente sua compatibilidade com a classificacao de consequencia extrema. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de ajustar, nos documentos de projeto, os criterios adotados de forma a demonstrar explicitamente sua compatibilidade com a classificacao de consequencia extrema. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de ajustar, nos documentos de projeto, os criterios adotados de forma a demonstrar explicitamente sua compatibilidade com a classificacao de consequencia extrema. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao e documentacao do projeto de fechamento, com definicao explicita dos criterios de projeto aplicaveis aos modos de falha plausiveis nessa fase do ciclo de vida da estrutura. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao e documentacao do projeto de fechamento, com definicao explicita dos criterios de projeto aplicaveis aos modos de falha plausiveis nessa fase do ciclo de vida da estrutura. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao e documentacao do projeto de fechamento, com definicao explicita dos criterios de projeto aplicaveis aos modos de falha plausiveis nessa fase do ciclo de vida da estrutura. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.5', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.5', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.5', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.6', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.6', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.6', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.7', 'needs_revision', 'partially_conforming', 50, 'Necessidade de avaliacao formal, pelo EdR em conjunto com o CIRR ou revisor tecnico independente, quanto a aplicabilidade retroativa dos requisitos do Principio 4 e a eventual necessidade de medidas alternativas de reducao de risco (ALARP). (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.7', 'needs_revision', 'partially_conforming', 50, 'Necessidade de avaliacao formal, pelo EdR em conjunto com o CIRR ou revisor tecnico independente, quanto a aplicabilidade retroativa dos requisitos do Principio 4 e a eventual necessidade de medidas alternativas de reducao de risco (ALARP). (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.7', 'needs_revision', 'partially_conforming', 50, 'Necessidade de avaliacao formal, pelo EdR em conjunto com o CIRR ou revisor tecnico independente, quanto a aplicabilidade retroativa dos requisitos do Principio 4 e a eventual necessidade de medidas alternativas de reducao de risco (ALARP). (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '4.8', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao formal do Relatorio de Base do Projeto (RBP), contendo premissas, criterios e restricoes operacionais, com revisao independente. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '4.8', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao formal do Relatorio de Base do Projeto (RBP), contendo premissas, criterios e restricoes operacionais, com revisao independente. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '4.8', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao formal do Relatorio de Base do Projeto (RBP), contendo premissas, criterios e restricoes operacionais, com revisao independente. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de avaliar refinamentos de tecnologias de rejeitos visando minimizar riscos para as pessoas e meio ambiente (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de avaliar refinamentos de tecnologias de rejeitos visando minimizar riscos para as pessoas e meio ambiente (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.1', 'needs_revision', 'partially_conforming', 50, 'Necessidade de avaliar refinamentos de tecnologias de rejeitos visando minimizar riscos para as pessoas e meio ambiente (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.2', 'needs_revision', 'partially_conforming', 50, 'O projeto nao contempla de forma integrada todos os aspectos exigidos pelo requisito, incluindo contexto tecnico, socioambiental, condicoes operacionais, viabilidade de fechamento seguro e revisoes periodicas baseadas em desempenho. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.2', 'needs_revision', 'partially_conforming', 50, 'O projeto nao contempla de forma integrada todos os aspectos exigidos pelo requisito, incluindo contexto tecnico, socioambiental, condicoes operacionais, viabilidade de fechamento seguro e revisoes periodicas baseadas em desempenho. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.2', 'needs_revision', 'partially_conforming', 50, 'O projeto nao contempla de forma integrada todos os aspectos exigidos pelo requisito, incluindo contexto tecnico, socioambiental, condicoes operacionais, viabilidade de fechamento seguro e revisoes periodicas baseadas em desempenho. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.3', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao de modelo de balanco hidrico para a Celula 02 e de adequacao do modelo de balanco hidrico da Barragem para contemplar integralmente mudancas climaticas, fases do ciclo de vida e medidas de prevencao e resposta a descargas acidentais, conforme diretrizes do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao de modelo de balanco hidrico para a Celula 02 e de adequacao do modelo de balanco hidrico da Barragem para contemplar integralmente mudancas climaticas, fases do ciclo de vida e medidas de prevencao e resposta a descargas acidentais, conforme diretrizes do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.3', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.4', 'approved', 'conforming', 75, 'Necessidade de elaboracao de analise de risco para a Celula 02, abortando todos os potenciais modos de falha e reduzindo riscos a um nivel ALARP sempre que possivel. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.4', 'approved', 'conforming', 75, 'Necessidade de elaboracao de analise de risco para a Celula 02, abortando todos os potenciais modos de falha e reduzindo riscos a um nivel ALARP sempre que possivel. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.4', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao de analise de risco para a Celula 02, abortando todos os potenciais modos de falha e reduzindo riscos a um nivel ALARP sempre que possivel. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.5', 'approved', 'conforming', 75, 'Necessidade de elaboracao do projeto de fechamento para a Barragem, Celula 01 e Celula 02 compativel com os requisitos do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.5', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao do projeto de fechamento para a Barragem, Celula 01 e Celula 02 compativel com os requisitos do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.5', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao do projeto de fechamento para a Barragem, Celula 01 e Celula 02 compativel com os requisitos do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao do projeto de fechamento e reabilitacao para a Barragem, Celula 01 e Celula 02, com detalhamento tecnico, ambiental e construtivo compativel com os requisitos do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao do projeto de fechamento e reabilitacao para a Barragem, Celula 01 e Celula 02, com detalhamento tecnico, ambiental e construtivo compativel com os requisitos do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao do projeto de fechamento e reabilitacao para a Barragem, Celula 01 e Celula 02, com detalhamento tecnico, ambiental e construtivo compativel com os requisitos do GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.7', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.7', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.7', 'needs_revision', 'non_conforming', 0, 'Necessidade comprovacao de confirmacao formal do atendimento ao criterio ALARP pelo Executivo Responsavel para a Celula 02, e registro de identificacao, aprovacao e documentacao de medidas adicionais para reducao de riscos e consequencias. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '5.8', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '5.8', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '5.8', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '6.1', 'needs_revision', 'partially_conforming', 50, 'Necessidade de desenvolver e implementar um SGDR para as estruturas, alem de desenvolver um plano de fechamento que se alinhe a intencao original do projeto. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '6.1', 'needs_revision', 'partially_conforming', 50, 'Necessidade de desenvolver e implementar um SGDR para as estruturas, alem de desenvolver um plano de fechamento que se alinhe a intencao original do projeto. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '6.1', 'needs_revision', 'partially_conforming', 50, 'Necessidade de desenvolver e implementar um SGDR para as estruturas, alem de desenvolver um plano de fechamento que se alinhe a intencao original do projeto. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '6.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '6.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '6.2', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '6.3', 'needs_revision', 'partially_conforming', 50, 'E necessario que o EdR e o RTER assinem o documento "as built" (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '6.3', 'needs_revision', 'partially_conforming', 50, 'E necessario que o EdR e o RTER assinem o documento "as built" (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '6.3', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '6.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao de um OMV para a Celula 02, e incluir nos manuais existentes para a Celula 01 e Barragem os controles criticos de cada instalacao. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '6.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de elaboracao de um OMV para a Celula 02, e incluir nos manuais existentes para a Celula 01 e Barragem os controles criticos de cada instalacao. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '6.4', 'needs_revision', 'non_conforming', 0, 'Necessidade de elaboracao de um OMV para a Celula 02, e incluir nos manuais existentes para a Celula 01 e Barragem os controles criticos de cada instalacao. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '6.5', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar um Sistema de Gestao de Mudancas (SGM) para avaliar, revisar, aprovar e documentar mudancas em qualquer fase do ciclo de vida das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '6.5', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar um Sistema de Gestao de Mudancas (SGM) para avaliar, revisar, aprovar e documentar mudancas em qualquer fase do ciclo de vida das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '6.5', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar um Sistema de Gestao de Mudancas (SGM) para avaliar, revisar, aprovar e documentar mudancas em qualquer fase do ciclo de vida das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '6.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de avaliar e incorporar tecnologias e abordagens novas e emergentes e usar novos conhecimentos para aprimorar o projeto, a construcao e a operacao das estruturas de disposicao de rejeitos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '6.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de avaliar e incorporar tecnologias e abordagens novas e emergentes e usar novos conhecimentos para aprimorar o projeto, a construcao e a operacao das estruturas de disposicao de rejeitos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '6.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de avaliar e incorporar tecnologias e abordagens novas e emergentes e usar novos conhecimentos para aprimorar o projeto, a construcao e a operacao das estruturas de disposicao de rejeitos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '7.1', 'approved', 'conforming', 75, 'Necessidade de desenvolvimento do SGDR e integra-lo ao programa de monitoramento de desempenho das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '7.1', 'approved', 'conforming', 75, 'Necessidade de desenvolvimento do SGDR e integra-lo ao programa de monitoramento de desempenho das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '7.1', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '7.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '7.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '7.2', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '7.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '7.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '7.3', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '7.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '7.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '7.4', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '7.5', 'needs_revision', 'partially_conforming', 50, 'E necessario que o EdR e o RTER revisem e aprovem formalmente os relatorios de monitoramento. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '7.5', 'needs_revision', 'partially_conforming', 50, 'E necessario que o EdR e o RTER revisem e aprovem formalmente os relatorios de monitoramento. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '7.5', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '8.1', 'approved', 'conforming', 75, 'Necessidade de elaboracao de uma politica ou compromisso que trate da recuperacao pos-falha. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '8.1', 'approved', 'conforming', 75, 'Necessidade de elaboracao de uma politica ou compromisso que trate da recuperacao pos-falha. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '8.1', 'approved', 'conforming', 75, 'Necessidade de elaboracao de uma politica ou compromisso que trate da recuperacao pos-falha. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '8.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de desenvolver uma estrutura de governanca de rejeitos, e um SGDR baseado em desenpenho, integrando-o ao SGAS. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '8.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de desenvolver uma estrutura de governanca de rejeitos, e um SGDR baseado em desenpenho, integrando-o ao SGAS. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '8.2', 'needs_revision', 'partially_conforming', 50, 'Necessidade de desenvolver uma estrutura de governanca de rejeitos, e um SGDR baseado em desenpenho, integrando-o ao SGAS. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '8.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver metodos de avaliacao de desempenho e pagamento de incentivos que considerem, pelo menos em parte, a seguranca publica e a integridade das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '8.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver metodos de avaliacao de desempenho e pagamento de incentivos que considerem, pelo menos em parte, a seguranca publica e a integridade das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '8.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver metodos de avaliacao de desempenho e pagamento de incentivos que considerem, pelo menos em parte, a seguranca publica e a integridade das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '8.4', 'approved', 'conforming', 75, 'Necessidade de nomear formalmente um ER para a Celula 02, alem de documentar a responsabilidade do ER de evitar ou minimizar as consequencias sociais e ambientais devido a falhas nas estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '8.4', 'approved', 'conforming', 75, 'Necessidade de nomear formalmente um ER para a Celula 02, alem de documentar a responsabilidade do ER de evitar ou minimizar as consequencias sociais e ambientais devido a falhas nas estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '8.4', 'needs_revision', 'non_conforming', 0, 'Necessidade de nomear formalmente um ER para a Celula 02, alem de documentar a responsabilidade do ER de evitar ou minimizar as consequencias sociais e ambientais devido a falhas nas estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '8.5', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '8.5', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '8.5', 'needs_revision', 'non_conforming', 0, 'Necessidade de nomear formalmente um RTER para a Celula 02 (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '8.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de definir equisitos minimos de qualificacao e experiencia para funcoes criticas de seguranca (RTER, EdR, ER) e desenvolver planos de sucessao para estes cargos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '8.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de definir equisitos minimos de qualificacao e experiencia para funcoes criticas de seguranca (RTER, EdR, ER) e desenvolver planos de sucessao para estes cargos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '8.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de definir equisitos minimos de qualificacao e experiencia para funcoes criticas de seguranca (RTER, EdR, ER) e desenvolver planos de sucessao para estes cargos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '8.7', 'needs_revision', 'partially_conforming', 50, 'Necessidade de designacao de um CIRR para a Celula 02, bem como de formalizacao, por escrito, de declaracao do Executivo Responsavel e do CIRR quanto a observancia de boas praticas profissionais e a inexistencia de conflitos de interesse. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '8.7', 'needs_revision', 'partially_conforming', 50, 'Necessidade de designacao de um CIRR para a Celula 02, bem como de formalizacao, por escrito, de declaracao do Executivo Responsavel e do CIRR quanto a observancia de boas praticas profissionais e a inexistencia de conflitos de interesse. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '8.7', 'needs_revision', 'non_conforming', 0, 'Necessidade de designacao de um CIRR para a Celula 02, bem como de formalizacao, por escrito, de declaracao do Executivo Responsavel e do CIRR quanto a observancia de boas praticas profissionais e a inexistencia de conflitos de interesse. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '9.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '9.1', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '9.1', 'needs_revision', 'non_conforming', 0, 'Contratar/Nomear oficialmente um EdR para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '9.2', 'approved', 'conforming', 75, 'Contratar/Nomear oficialmente um EdR para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '9.2', 'approved', 'conforming', 75, 'Contratar/Nomear oficialmente um EdR para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '9.2', 'needs_revision', 'non_conforming', 0, 'Contratar/Nomear oficialmente um EdR para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '9.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar um programa formal de gestao da qualidade. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '9.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar um programa formal de gestao da qualidade. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '9.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar um programa formal de gestao da qualidade. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '9.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '9.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '9.4', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '9.5', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e documentar um plano formal para a substituicao do EdR. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '9.5', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e documentar um plano formal para a substituicao do EdR. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '9.5', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e documentar um plano formal para a substituicao do EdR. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '10.1', 'approved', 'conforming', 75, 'Necessidade de desenvolver avaliacao de riscos para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '10.1', 'approved', 'conforming', 75, 'Necessidade de desenvolver avaliacao de riscos para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '10.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver avaliacao de riscos para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '10.2', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolvimento do SGDR. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '10.2', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolvimento do SGDR. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '10.2', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolvimento do SGDR. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '10.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '10.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '10.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '10.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '10.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '10.4', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '10.5', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '10.5', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '10.5', 'approved', 'not_applicable', 100, 'Requisito nao aplicavel a esta estrutura, conforme avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '10.6', 'needs_revision', 'partially_conforming', 50, 'Necessidade de designacao de um CIRR para a Celula 02, e realizar revisoes independentes com conteudo adequado para todas as estruturas, conforme indicado pelo GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '10.6', 'needs_revision', 'partially_conforming', 50, 'Necessidade de designacao de um CIRR para a Celula 02, e realizar revisoes independentes com conteudo adequado para todas as estruturas, conforme indicado pelo GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '10.6', 'needs_revision', 'non_conforming', 0, 'Necessidade de designacao de um CIRR para a Celula 02, e realizar revisoes independentes com conteudo adequado para todas as estruturas, conforme indicado pelo GISTM. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '10.7', 'needs_revision', 'non_conforming', 0, 'Necessidade de realizar estimativas periodicas e revisoes documentadas dos custos de fechamento, reabilitacao e pos-fechamento das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '10.7', 'needs_revision', 'non_conforming', 0, 'Necessidade de realizar estimativas periodicas e revisoes documentadas dos custos de fechamento, reabilitacao e pos-fechamento das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '10.7', 'needs_revision', 'non_conforming', 0, 'Necessidade de realizar estimativas periodicas e revisoes documentadas dos custos de fechamento, reabilitacao e pos-fechamento das estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '11.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar programas de capacitacao formal voltado a prevencao de falhas em estruturas de rejeito. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '11.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar programas de capacitacao formal voltado a prevencao de falhas em estruturas de rejeito. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '11.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver e implementar programas de capacitacao formal voltado a prevencao de falhas em estruturas de rejeito. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '11.2', 'needs_revision', 'non_conforming', 0, 'Necessidade de criar mecanismos que incorporem o conhecimento pratico e a experiencia dos trabalhadores. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '11.2', 'needs_revision', 'non_conforming', 0, 'Necessidade de criar mecanismos que incorporem o conhecimento pratico e a experiencia dos trabalhadores. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '11.2', 'needs_revision', 'non_conforming', 0, 'Necessidade de criar mecanismos que incorporem o conhecimento pratico e a experiencia dos trabalhadores. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '11.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '11.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '11.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '11.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de considerar fatores humanos e organizacionais nas analises de incidentes internos e externos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '11.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de considerar fatores humanos e organizacionais nas analises de incidentes internos e externos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '11.4', 'needs_revision', 'partially_conforming', 50, 'Necessidade de considerar fatores humanos e organizacionais nas analises de incidentes internos e externos. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '11.5', 'approved', 'conforming', 75, 'Necessidade de desenvolver mecanismos que reconhecam e/ou recompensem contribuicoes positivas de funcionarios e contratados na identificacao de riscos ou melhorias. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '11.5', 'approved', 'conforming', 75, 'Necessidade de desenvolver mecanismos que reconhecam e/ou recompensem contribuicoes positivas de funcionarios e contratados na identificacao de riscos ou melhorias. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '11.5', 'approved', 'conforming', 75, 'Necessidade de desenvolver mecanismos que reconhecam e/ou recompensem contribuicoes positivas de funcionarios e contratados na identificacao de riscos ou melhorias. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '12.1', 'approved', 'conforming', 75, 'Necessidade de formalizar as responsabilidade do ER de supervisionar e/ou aprovar  o processo de tratamento das preocupacoes de empregados e contratados. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '12.1', 'approved', 'conforming', 75, 'Necessidade de formalizar as responsabilidade do ER de supervisionar e/ou aprovar  o processo de tratamento das preocupacoes de empregados e contratados. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '12.1', 'approved', 'conforming', 75, 'Necessidade de formalizar as responsabilidade do ER de supervisionar e/ou aprovar  o processo de tratamento das preocupacoes de empregados e contratados. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '12.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '12.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '12.2', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '13.1', 'approved', 'conforming', 75, 'Necessidade de desenvolver um PAEBM para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '13.1', 'approved', 'conforming', 75, 'Necessidade de desenvolver um PAEBM para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '13.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver um PAEBM para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '13.2', 'approved', 'conforming', 75, 'Necessidade de desenvolver um PAEBM para a Celula 02 e desenvolver plano colaborativo com as autoridades locais para melhorar a prontidao e coordenacao em situacoes de emergencia. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '13.2', 'approved', 'conforming', 75, 'Necessidade de desenvolver um PAEBM para a Celula 02 e desenvolver plano colaborativo com as autoridades locais para melhorar a prontidao e coordenacao em situacoes de emergencia. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '13.2', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver um PAEBM para a Celula 02 e desenvolver plano colaborativo com as autoridades locais para melhorar a prontidao e coordenacao em situacoes de emergencia. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '13.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '13.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '13.3', 'needs_revision', 'non_conforming', 0, 'Necessidade de desenvolver um PAEBM para a Celula 02. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '13.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '13.4', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '13.4', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '14.1', 'approved', 'conforming', 75, 'Necessidade de desenvolver planos e estrategias de resposta e recuperacao pos-falha ou de estabelecer compromisso formal para a implementacao de acoes voltadas a resposta e a recuperacao na eventualidade de ocorrencia de falhas catastroficas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '14.1', 'approved', 'conforming', 75, 'Necessidade de desenvolver planos e estrategias de resposta e recuperacao pos-falha ou de estabelecer compromisso formal para a implementacao de acoes voltadas a resposta e a recuperacao na eventualidade de ocorrencia de falhas catastroficas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '14.1', 'approved', 'conforming', 75, 'Necessidade de desenvolver planos e estrategias de resposta e recuperacao pos-falha ou de estabelecer compromisso formal para a implementacao de acoes voltadas a resposta e a recuperacao na eventualidade de ocorrencia de falhas catastroficas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '14.2', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '14.2', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '14.2', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '14.3', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '14.3', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '14.3', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '14.4', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '14.4', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '14.4', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '14.5', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '14.5', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '14.5', 'needs_revision', 'non_conforming', 0, 'Gap identificado em avaliacao tecnica (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '15.1', 'needs_revision', 'partially_conforming', 50, 'Necessidade de divulgar informacoes da Celula 02, alem de assegurar o atendimento integral as informacoes requeridas pelo GISTM para todas as estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '15.1', 'needs_revision', 'partially_conforming', 50, 'Necessidade de divulgar informacoes da Celula 02, alem de assegurar o atendimento integral as informacoes requeridas pelo GISTM para todas as estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '15.1', 'needs_revision', 'non_conforming', 0, 'Necessidade de divulgar informacoes da Celula 02, alem de assegurar o atendimento integral as informacoes requeridas pelo GISTM para todas as estruturas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '15.2', 'approved', 'conforming', 75, 'Necessidade de desenvolver um plano de resposta para quando uma solicitacao for negada, o operador fornecer justificativa formal e transparente, informando o motivo e as restricoes envolvidas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '15.2', 'approved', 'conforming', 75, 'Necessidade de desenvolver um plano de resposta para quando uma solicitacao for negada, o operador fornecer justificativa formal e transparente, informando o motivo e as restricoes envolvidas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '15.2', 'approved', 'conforming', 75, 'Necessidade de desenvolver um plano de resposta para quando uma solicitacao for negada, o operador fornecer justificativa formal e transparente, informando o motivo e as restricoes envolvidas. (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Barragem TZ', '15.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 1', '15.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).'),
  ('Celula 2', '15.3', 'approved', 'fully_conforming', 100, 'Requisito atendido integralmente. Evidencias verificadas em auditoria tecnica de campo (ref. HBR101550001-GMN-RT001 Rev.1).')
),
resolved as (
  select
    '637aa7f4-5332-4a1d-946f-9ab77219fde4'::uuid as cycle_id,
    (case raw.facility_name
       when 'Barragem TZ' then 'ed11af20-6ce7-4f19-b0b8-527e0ffd951b'::uuid
       when 'Celula 1'    then '0e6db5e4-be92-4dfd-86d5-c3e63171e973'::uuid
       when 'Celula 2'    then 'c9ebe409-535a-4fda-aaa7-8899292e7b8a'::uuid
     end) as facility_id,
    gr.id as requirement_id,
    raw.status::requirement_status as status,
    raw.score::assessment_score as score,
    raw.score_value::smallint as score_value,
    raw.assessment_text
  from raw
  join gistm_requirements gr on gr.code = raw.requirement_code
),
inserted_responses as (
  insert into requirement_responses (cycle_id, facility_id, requirement_id, status, implementation_text, submitted_at)
  select
    resolved.cycle_id, resolved.facility_id, resolved.requirement_id, resolved.status,
    'Importado da avaliacao tecnica HIDROBR (doc. HBR101550001-GMN-RT001, Rev.1, 08/07/2026).',
    now()
  from resolved
  returning id, facility_id, requirement_id
)
insert into hidrobr_assessments (response_id, assessed_by, score, score_value, assessment_text, published_at)
select
  ir.id,
  (select assessed_by from assessor),
  res.score, res.score_value, res.assessment_text,
  '2026-07-08 00:00:00-03'::timestamptz
from inserted_responses ir
join resolved res on res.facility_id = ir.facility_id and res.requirement_id = ir.requirement_id;

commit;

-- Confira o resultado:
-- select f.name, count(*), avg(a.score_value) from requirement_responses rr
--   join tailings_facilities f on f.id = rr.facility_id
--   join hidrobr_assessments a on a.response_id = rr.id
--   where rr.cycle_id = (select id from assessment_cycles where organization_id = (select id from organizations where name ilike '%Brazauro%' limit 1) and status='active' order by created_at desc limit 1)
--   group by f.name;
