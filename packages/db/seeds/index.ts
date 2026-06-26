// packages/db/seeds/index.ts
// Seed completo: tópicos GISTM, 18 princípios, organização demo e usuários

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco HIDROBR GISTM...')

  // ── 1. Tópicos GISTM ─────────────────────────────────────
  console.log('   → Criando tópicos GISTM...')

  const topics = await Promise.all([
    prisma.gistmTopic.upsert({
      where: { code: 'T1' },
      update: {},
      create: {
        code: 'T1',
        title: 'Propriedade, Responsabilidade e Compromissos',
        description: 'Governança, estrutura organizacional e compromissos com a segurança de barragens',
        displayOrder: 1,
        colorHex: '#005F73',
        icon: 'shield',
      },
    }),
    prisma.gistmTopic.upsert({
      where: { code: 'T2' },
      update: {},
      create: {
        code: 'T2',
        title: 'Conhecimento da Barragem',
        description: 'Entendimento técnico e documentação da instalação de rejeitos',
        displayOrder: 2,
        colorHex: '#0A9396',
        icon: 'database',
      },
    }),
    prisma.gistmTopic.upsert({
      where: { code: 'T3' },
      update: {},
      create: {
        code: 'T3',
        title: 'Projeto, Construção e Operação',
        description: 'Engenharia, gestão da construção e controles operacionais',
        displayOrder: 3,
        colorHex: '#1B7A8A',
        icon: 'settings',
      },
    }),
    prisma.gistmTopic.upsert({
      where: { code: 'T4' },
      update: {},
      create: {
        code: 'T4',
        title: 'Gestão de Riscos',
        description: 'Identificação de perigos, avaliação de riscos e preparação para emergências',
        displayOrder: 4,
        colorHex: '#2D6A4F',
        icon: 'alert-triangle',
      },
    }),
    prisma.gistmTopic.upsert({
      where: { code: 'T5' },
      update: {},
      create: {
        code: 'T5',
        title: 'Preparação e Resposta a Emergências',
        description: 'Planos de ação de emergência e engajamento comunitário',
        displayOrder: 5,
        colorHex: '#92400E',
        icon: 'flame',
      },
    }),
  ])

  const [t1, t2, t3, t4, t5] = topics

  // ── 2. Os 18 Princípios GISTM ────────────────────────────
  console.log('   → Criando 18 princípios GISTM...')

  const requirements = [
    // T1
    {
      topicId: t1.id, code: 'P01', displayOrder: 1, weight: 1.0,
      title: 'Propriedade e Responsabilidade',
      description: 'O Executivo Responsável designou um executivo sênior com autoridade e recursos necessários para implementar o GISTM.',
      guidance: 'Documente a designação formal do responsável sênior, incluindo carta de nomeação, descrição de cargo atualizada com responsabilidades de gestão de barragens, e evidências de alocação de recursos.',
      subRequirements: [
        { id: 'P01-a', text: 'Executivo Responsável formalmente designado por escrito' },
        { id: 'P01-b', text: 'Descrição de cargo atualizada com responsabilidades GISTM' },
        { id: 'P01-c', text: 'Alocação de orçamento documentada para gestão de barragens' },
        { id: 'P01-d', text: 'Registro de comprometimento da alta liderança' },
      ],
    },
    {
      topicId: t1.id, code: 'P02', displayOrder: 2, weight: 1.0,
      title: 'Competência Organizacional',
      description: 'O Proprietário possui capacidade organizacional e recursos para implementar e manter a gestão segura de rejeitos.',
      guidance: 'Demonstre através de organograma, descrições de cargos, qualificações da equipe e programas de desenvolvimento de competências.',
      subRequirements: [
        { id: 'P02-a', text: 'Organograma da gestão de barragens definido' },
        { id: 'P02-b', text: 'Matriz de competências elaborada para funções críticas' },
        { id: 'P02-c', text: 'Programa de treinamento e desenvolvimento documentado' },
        { id: 'P02-d', text: 'Procedimento de gestão de mudanças organizacionais' },
      ],
    },
    {
      topicId: t1.id, code: 'P03', displayOrder: 3, weight: 1.0,
      title: 'Integração ao Sistema de Gestão',
      description: 'A gestão de rejeitos está integrada ao sistema de gestão do Proprietário.',
      guidance: 'Apresente política de gestão de barragens, integração com SMS, objetivos e metas mensuráveis.',
      subRequirements: [
        { id: 'P03-a', text: 'Política de gestão de barragens publicada e comunicada' },
        { id: 'P03-b', text: 'Integração com sistema SMS da empresa documentada' },
        { id: 'P03-c', text: 'KPIs de segurança de barragens estabelecidos' },
        { id: 'P03-d', text: 'Processo de revisão periódica do sistema de gestão' },
      ],
    },
    // T2
    {
      topicId: t2.id, code: 'P04', displayOrder: 4, weight: 1.0,
      title: 'Caracterização do Local',
      description: 'Existe uma compreensão abrangente da instalação de rejeitos e seu entorno, mantida atualizada.',
      guidance: 'Documente estudos geológicos, geotécnicos, hidrológicos e hidrogeológicos completos e atualizados.',
      subRequirements: [
        { id: 'P04-a', text: 'Estudo geológico e geotécnico completo e atual' },
        { id: 'P04-b', text: 'Estudo hidrológico e hidráulico atualizado' },
        { id: 'P04-c', text: 'Investigação sísmica documentada (se aplicável)' },
        { id: 'P04-d', text: 'Dados ambientais da área de influência catalogados' },
      ],
    },
    {
      topicId: t2.id, code: 'P05', displayOrder: 5, weight: 1.0,
      title: 'Documentação de Projeto',
      description: 'A documentação de projeto está completa, atualizada e acessível.',
      guidance: 'Mantenha sistema de gestão documental com projetos as-built, memoriais de cálculo e relatórios técnicos.',
      subRequirements: [
        { id: 'P05-a', text: 'Projetos as-built disponíveis e atualizados' },
        { id: 'P05-b', text: 'Memoriais de cálculo estruturais documentados' },
        { id: 'P05-c', text: 'Sistema de gestão documental implementado' },
        { id: 'P05-d', text: 'Histórico de modificações de projeto registrado' },
      ],
    },
    {
      topicId: t2.id, code: 'P06', displayOrder: 6, weight: 1.0,
      title: 'Gestão do Conhecimento',
      description: 'Informações relacionadas à instalação de rejeitos são gerenciadas sistematicamente.',
      guidance: 'Estabeleça sistema de gestão do conhecimento com controle de versões e transferência de conhecimento.',
      subRequirements: [
        { id: 'P06-a', text: 'Plataforma de gestão documental implementada' },
        { id: 'P06-b', text: 'Procedimento de controle de versões estabelecido' },
        { id: 'P06-c', text: 'Plano de transferência de conhecimento documentado' },
        { id: 'P06-d', text: 'Backup e recuperação de dados garantidos' },
      ],
    },
    // T3
    {
      topicId: t3.id, code: 'P07', displayOrder: 7, weight: 1.5,
      title: 'Projeto e Construção',
      description: 'A instalação de rejeitos é projetada e construída de forma segura.',
      guidance: 'Demonstre conformidade com normas técnicas vigentes, controle de qualidade de construção e supervisão por profissional habilitado.',
      subRequirements: [
        { id: 'P07-a', text: 'Critérios de projeto documentados e fundamentados' },
        { id: 'P07-b', text: 'Plano de controle de qualidade de construção' },
        { id: 'P07-c', text: 'Supervisão técnica por profissional habilitado (ART)' },
        { id: 'P07-d', text: 'Inspeções de construção registradas e arquivadas' },
        { id: 'P07-e', text: 'Ensaios de laboratório e campo documentados' },
      ],
    },
    {
      topicId: t3.id, code: 'P08', displayOrder: 8, weight: 1.0,
      title: 'Caracterização dos Rejeitos',
      description: 'Os rejeitos e a água são caracterizados e compreendidos.',
      guidance: 'Apresente programa de caracterização físico-química e geotécnica dos rejeitos com histórico.',
      subRequirements: [
        { id: 'P08-a', text: 'Programa de caracterização físico-química dos rejeitos' },
        { id: 'P08-b', text: 'Ensaios geotécnicos de rejeitos realizados periodicamente' },
        { id: 'P08-c', text: 'Balanço hídrico da barragem calculado e monitorado' },
        { id: 'P08-d', text: 'Programa de qualidade da água implementado' },
      ],
    },
    {
      topicId: t3.id, code: 'P09', displayOrder: 9, weight: 1.5,
      title: 'Operações',
      description: 'A instalação de rejeitos é operada de forma segura e em conformidade com o projeto.',
      guidance: 'Mantenha procedimentos operacionais, programa de instrumentação e monitoramento, e inspeções regulares documentadas.',
      subRequirements: [
        { id: 'P09-a', text: 'Manual de operação e manutenção elaborado e atualizado' },
        { id: 'P09-b', text: 'Programa de instrumentação e monitoramento implementado' },
        { id: 'P09-c', text: 'Inspeções regulares realizadas e registradas' },
        { id: 'P09-d', text: 'Relatórios de desempenho periódicos elaborados' },
        { id: 'P09-e', text: 'Gestão de alteamentos documentada e controlada' },
      ],
    },
    {
      topicId: t3.id, code: 'P10', displayOrder: 10, weight: 1.0,
      title: 'Fechamento e Pós-Fechamento',
      description: 'O fechamento é planejado e a instalação será segura e estável em caráter permanente.',
      guidance: 'Elabore plano de fechamento integrado ao projeto desde as fases iniciais, com provisão financeira adequada.',
      subRequirements: [
        { id: 'P10-a', text: 'Plano de fechamento elaborado e integrado ao projeto' },
        { id: 'P10-b', text: 'Provisão financeira para fechamento estabelecida' },
        { id: 'P10-c', text: 'Critérios de sucesso do fechamento definidos' },
        { id: 'P10-d', text: 'Plano de monitoramento pós-fechamento documentado' },
      ],
    },
    // T4
    {
      topicId: t4.id, code: 'P11', displayOrder: 11, weight: 1.5,
      title: 'Classificação de Consequências',
      description: 'As potenciais consequências de ruptura são compreendidas e classificadas.',
      guidance: 'Realize estudo de ruptura hipotética (ERT) e classifique a barragem conforme DNPM/ANM e critérios internacionais.',
      subRequirements: [
        { id: 'P11-a', text: 'Estudo de ruptura hipotética (ERT) elaborado' },
        { id: 'P11-b', text: 'Classificação de dano potencial associado (DPA) realizada' },
        { id: 'P11-c', text: 'Mapeamento de populações e infraestruturas a jusante' },
        { id: 'P11-d', text: 'Revisão periódica da classificação documentada' },
      ],
    },
    {
      topicId: t4.id, code: 'P12', displayOrder: 12, weight: 1.5,
      title: 'Avaliação de Perigos',
      description: 'Perigos e suas potenciais consequências são identificados e avaliados.',
      guidance: 'Execute análise de perigos sistemática (HAZID, FMEA ou similar) com participação multidisciplinar.',
      subRequirements: [
        { id: 'P12-a', text: 'Análise de perigos sistematizada realizada (HAZID/FMEA)' },
        { id: 'P12-b', text: 'Cenários de falha identificados e documentados' },
        { id: 'P12-c', text: 'Avaliação de perigos naturais (hidrológico, sísmico)' },
        { id: 'P12-d', text: 'Revisão e atualização periódica da análise de perigos' },
      ],
    },
    {
      topicId: t4.id, code: 'P13', displayOrder: 13, weight: 1.5,
      title: 'Avaliação de Riscos',
      description: 'Os riscos associados à instalação de rejeitos são avaliados.',
      guidance: 'Conduza avaliação quantitativa ou semi-quantitativa de riscos com matriz de risco documentada.',
      subRequirements: [
        { id: 'P13-a', text: 'Avaliação de risco quantitativa ou semi-quantitativa realizada' },
        { id: 'P13-b', text: 'Matriz de risco documentada e aprovada' },
        { id: 'P13-c', text: 'Comparação com critérios de tolerabilidade de risco' },
        { id: 'P13-d', text: 'Revisão de risco após eventos significativos' },
      ],
    },
    {
      topicId: t4.id, code: 'P14', displayOrder: 14, weight: 1.5,
      title: 'Mitigação de Riscos',
      description: 'Os riscos são gerenciados para tão baixo quanto razoavelmente praticável (ALARP).',
      guidance: 'Implemente plano de ação de mitigação de riscos com prazos, responsáveis e verificação de eficácia.',
      subRequirements: [
        { id: 'P14-a', text: 'Plano de mitigação de riscos elaborado e em execução' },
        { id: 'P14-b', text: 'Critério ALARP aplicado e documentado' },
        { id: 'P14-c', text: 'Barreiras de controle identificadas e monitoradas' },
        { id: 'P14-d', text: 'Verificação de eficácia das medidas de mitigação' },
      ],
    },
    {
      topicId: t4.id, code: 'P15', displayOrder: 15, weight: 2.0,
      title: 'Revisão Independente',
      description: 'A instalação de rejeitos é sujeita a revisão regular por parte independente qualificada.',
      guidance: 'Contrate Revisão de Segurança de Barragem (RSB) por profissional independente qualificado com frequência adequada à classe da barragem.',
      subRequirements: [
        { id: 'P15-a', text: 'Revisor independente qualificado contratado (currículo comprovado)' },
        { id: 'P15-b', text: 'Escopo da revisão independente definido e abrangente' },
        { id: 'P15-c', text: 'Relatório de revisão independente elaborado e disponível' },
        { id: 'P15-d', text: 'Plano de ação para itens da revisão implementado' },
        { id: 'P15-e', text: 'Frequência de revisão adequada à classe da barragem' },
      ],
    },
    // T5
    {
      topicId: t5.id, code: 'P16', displayOrder: 16, weight: 2.0,
      title: 'Plano de Ação de Emergência',
      description: 'Um Plano de Ação de Emergência (PAE) existe e é mantido atualizado.',
      guidance: 'Elabore PAE conforme DNPM Portaria 70.389/2017, realize simulados periodicamente e mantenha comunicação com defesa civil.',
      subRequirements: [
        { id: 'P16-a', text: 'PAE elaborado conforme legislação vigente' },
        { id: 'P16-b', text: 'Mapa de zonas de autossalvamento e demais zonas' },
        { id: 'P16-c', text: 'Sistema de alerta e alarme instalado e testado' },
        { id: 'P16-d', text: 'Simulados realizados com frequência documentada' },
        { id: 'P16-e', text: 'Integração com Defesa Civil e autoridades comprovada' },
      ],
    },
    {
      topicId: t5.id, code: 'P17', displayOrder: 17, weight: 1.0,
      title: 'Revisão do Sistema de Gestão',
      description: 'O sistema de gestão de rejeitos é periodicamente revisado quanto à sua eficácia.',
      guidance: 'Realize auditorias internas e revisões pela direção com frequência definida, documentando resultados e ações.',
      subRequirements: [
        { id: 'P17-a', text: 'Programa de auditoria interna definido e executado' },
        { id: 'P17-b', text: 'Revisão pela direção realizada periodicamente' },
        { id: 'P17-c', text: 'Indicadores de desempenho monitorados e analisados' },
        { id: 'P17-d', text: 'Plano de melhoria contínua documentado' },
      ],
    },
    {
      topicId: t5.id, code: 'P18', displayOrder: 18, weight: 1.0,
      title: 'Comunidades Afetadas',
      description: 'Os direitos e interesses das comunidades afetadas são identificados e gerenciados.',
      guidance: 'Desenvolva programa de engajamento comunitário, mapeie populações afetadas e estabeleça canais de comunicação.',
      subRequirements: [
        { id: 'P18-a', text: 'Mapeamento de comunidades afetadas realizado' },
        { id: 'P18-b', text: 'Programa de engajamento comunitário implementado' },
        { id: 'P18-c', text: 'Canal de comunicação com comunidades estabelecido' },
        { id: 'P18-d', text: 'Registro de consultas e respostas mantido' },
      ],
    },
  ]

  for (const req of requirements) {
    await prisma.gistmRequirement.upsert({
      where: { code: req.code },
      update: {},
      create: {
        topicId: req.topicId,
        code: req.code,
        title: req.title,
        description: req.description,
        guidance: req.guidance,
        displayOrder: req.displayOrder,
        weight: req.weight,
        subRequirements: req.subRequirements,
      },
    })
  }

  // ── 3. Usuários HIDROBR ───────────────────────────────────
  console.log('   → Criando usuários HIDROBR...')

  const adminHash = await bcrypt.hash('Hidrobr@2025!', 12)
  const consultantHash = await bcrypt.hash('Hidrobr@2025!', 12)

  await prisma.user.upsert({
    where: { email: 'admin@hidrobr.com.br' },
    update: {},
    create: {
      email: 'admin@hidrobr.com.br',
      passwordHash: adminHash,
      role: 'hidrobr_admin',
      fullName: 'Administrador HIDROBR',
      jobTitle: 'Administrador do Sistema',
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'ricardo.mendes@hidrobr.com.br' },
    update: {},
    create: {
      email: 'ricardo.mendes@hidrobr.com.br',
      passwordHash: consultantHash,
      role: 'hidrobr_consultant',
      fullName: 'Dr. Ricardo Mendes',
      jobTitle: 'Consultor Sênior — Gestão de Barragens',
      isActive: true,
    },
  })

  // ── 4. Organização demo (cliente de exemplo) ──────────────
  console.log('   → Criando organização e usuário demo...')

  const demoOrg = await prisma.organization.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      name: 'Mineração Exemplo S.A.',
      cnpj: '00.000.000/0001-00',
      segment: 'iron_ore',
      address: { city: 'Belo Horizonte', state: 'MG', country: 'Brasil' },
      contacts: { phone: '+55 31 99999-9999', website: 'https://exemplo.com.br' },
      contractStart: new Date('2024-01-01'),
      contractEnd: new Date('2025-12-31'),
      isActive: true,
    },
  })

  const clientHash = await bcrypt.hash('Cliente@2025!', 12)

  await prisma.user.upsert({
    where: { email: 'ana.silva@mineracaoexemplo.com.br' },
    update: {},
    create: {
      email: 'ana.silva@mineracaoexemplo.com.br',
      passwordHash: clientHash,
      role: 'client_admin',
      fullName: 'Ana Carolina Silva',
      jobTitle: 'Gerente de Segurança de Barragens',
      organizationId: demoOrg.id,
      isActive: true,
    },
  })

  // ── 5. Barragem demo ──────────────────────────────────────
  console.log('   → Criando barragem demo...')

  const facility = await prisma.tailingsFacility.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: demoOrg.id,
      name: 'Barragem Norte — BN-01',
      damCode: 'MX-BN-01',
      location: { municipality: 'Brumadinho', state: 'MG', country: 'Brasil', lat: -20.1387, lng: -44.2028 },
      damType: 'Montante',
      consequenceClass: 'Alto',
      currentVolume: 12400000,
      totalCapacity: 20000000,
      heightMeters: 85,
      constructionYear: 2008,
      operationalStatus: 'Ativa',
      assignedEngineer: 'Eng. Carlos Pinto',
    },
  })

  // ── 6. Ciclo de avaliação demo ────────────────────────────
  console.log('   → Criando ciclo de avaliação demo...')

  const consultant = await prisma.user.findUnique({
    where: { email: 'ricardo.mendes@hidrobr.com.br' },
  })

  await prisma.assessmentCycle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      organizationId: demoOrg.id,
      facilityId: facility.id,
      name: 'Ciclo 2024 — Barragem Norte BN-01',
      referenceYear: 2024,
      startDate: new Date('2024-01-15'),
      targetDate: new Date('2024-12-31'),
      status: 'active',
      assignedConsultant: consultant?.id,
    },
  })

  console.log('')
  console.log('✅ Seed concluído com sucesso!')
  console.log('')
  console.log('   Usuários criados:')
  console.log('   ┌─────────────────────────────────────────────────────────┐')
  console.log('   │  HIDROBR Admin    admin@hidrobr.com.br / Hidrobr@2025!  │')
  console.log('   │  HIDROBR Consul.  ricardo.mendes@hidrobr.com.br          │')
  console.log('   │  Cliente Admin    ana.silva@mineracaoexemplo.com.br      │')
  console.log('   │  Senha cliente    Cliente@2025!                          │')
  console.log('   └─────────────────────────────────────────────────────────┘')
}

main()
  .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
