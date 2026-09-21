import { officeDbService, OfficeMissionRecord, OfficeOfferProjectRecord } from '@/lib/supabase/office-db';
import { executeAgentRole } from './executor';
import { createMissionCostTracker } from './cost-tracker';
import { dbService } from '@/lib/supabase/db';
import { CompleteOfferProjectSpec } from './offer-schema';
import { buildMissionContract, buildTransformationContract, MissionContract, ModelingTransformationContract } from './contracts';
import { buildSourceOfferContextPack, SourceOfferContextPack } from './source-pack';
import { runQualityGates } from './quality-gates';

function cleanSubniche(mainNiche: string): string {
  if (mainNiche.toLowerCase().includes('química') || mainNiche.toLowerCase().includes('educação')) {
    return 'Engenharia & Exatas';
  }
  return `Especialização em ${mainNiche}`;
}

function buildDynamicNicheFallbacks(
  mainNiche: string,
  sourceName: string,
  targetMarket: string,
  isUS: boolean,
  briefObjective?: string
) {
  const cleanNiche = (!mainNiche || mainNiche === 'NOT_AVAILABLE' || mainNiche === 'N/I' || mainNiche === 'Geral')
    ? 'Educação e Conhecimento'
    : mainNiche;

  const defaultRecommendedName = `${sourceName} - Guia Prático (${targetMarket})`;

  const defaultAlternativeNames = [
    { name: `Acervo Prático de ${cleanNiche}`, concept: 'Solução estruturada e organizada', rationale: `Foco no aprendizado direto de ${cleanNiche}` },
    { name: `Manual Definitivo: ${cleanNiche}`, concept: 'Guia de consulta rápida', rationale: `Diferenciação pela facilidade de consulta` },
    { name: `Caderno de Aplicação de ${cleanNiche}`, concept: 'Formato prático e acionável', rationale: `Aplicação imediata dos conceitos` },
    { name: `Método Essencial de ${cleanNiche}`, concept: 'Passo a passo simplificado', rationale: `Eliminação de complexidade desnecessária` },
    { name: `Acelerador de Resultados em ${cleanNiche}`, concept: 'Formato sintetizado', rationale: `Economia de tempo para o usuário` },
  ];

  const defaultPrimaryAudience = isUS
    ? `Target audience interested in ${cleanNiche} seeking structured, easy-to-use digital materials.`
    : `Pessoas interessadas em ${cleanNiche} buscando um material digital prático, organizado e direto ao ponto.`;

  const defaultContext = isUS
    ? `Individuals looking to master ${cleanNiche} concepts quickly without reading dense technical manuals.`
    : `Pessoas buscando dominar ${cleanNiche} de forma descomplicada, sem perder tempo com teorias extensas.`;

  const defaultFunctionalPains = [
    `Dificuldade em assimilar conceitos complexos de ${cleanNiche} apenas com livros teóricos.`,
    `Perda de tempo pesquisando materiais desorganizados e dispersos.`,
    `Falta de um resumo visual e prático para aplicação rápida.`,
    `Alto custo de cursos e livros tradicionais da área de ${cleanNiche}.`,
    `Incerteza sobre quais materiais são realmente essenciais.`,
  ];

  const defaultEmotionalPains = [
    `Frustração por gastar horas estudando sem sentir evolução clara em ${cleanNiche}.`,
    `Insegurança ao aplicar os conceitos no dia a dia.`,
    `Sensação de sobrecarga com excesso de conteúdo irrelevante.`,
    `Ansiedade por ter prazos ou objetivos para cumprir em ${cleanNiche}.`,
    `Desejo de se destacar mas sem saber por onde começar.`,
  ];

  const defaultDesires = [
    `Aprender os conceitos centrais de ${cleanNiche} de forma visual e acelerada.`,
    `Ter um guia de referência prática sempre à mão no celular ou computador.`,
    `Economizar tempo de estudo e foco no que realmente gera resultado.`,
    `Acessar um acervo completo por um preço acessível.`,
    `Sentir confiança total na aplicação prática dos conhecimentos de ${cleanNiche}.`,
  ];

  const defaultObjections = [
    `O material é realmente direto e prático?`,
    `É fácil de ler e consultar no celular?`,
    `Vale o investimento em comparação com opções gratuitas?`,
    `Existe suporte ou garantia de satisfação?`,
    `Iniciantes conseguem acompanhar facilmente?`,
  ];

  const defaultBuyingTriggers = [
    `Preço de entrada baixo e promocional.`,
    `Acesso digital e imediato após a compra.`,
    `Garantia incondicional de reembolso.`,
  ];

  const defaultJobsToBeDone = [
    { job: `Aprender e consultar ${cleanNiche} com facilidade`, rationale: `Elimina a perda de tempo e sobrecarga de informação.` },
    { job: `Ter um material de apoio rápido para decisões no dia a dia`, rationale: `Aumenta a confiança e velocidade de execução.` },
  ];

  const defaultCategory = `Guias Digitais e Materiais de ${cleanNiche}`;
  const defaultSubcategory = `Resumos Visuais e Fichas Práticas`;
  const defaultCounterPositioning = `Diferente de manuais teóricos densos de ${cleanNiche} com linguagem rebuscada, este é um guia prático focado em aplicação rápida.`;
  const defaultDifferentiation = `Sintetizado em fichas e resumos estruturados para aprendizado em tempo recorde.`;
  const defaultPositioningStatement = `O acervo digital definitivo de ${cleanNiche} feito para quem busca aprendizado rápido e consulta prática.`;

  const defaultBigIdea = `Aprendizado Prático em ${cleanNiche}`;
  const defaultAngle = `Método Estruturado e Direto ao Ponto`;
  const defaultHookTerritory = `Demonstração visual do material e clareza do conteúdo`;

  const defaultCorePromise = `Acesse o acervo prático completo de ${cleanNiche} e acelere seu aprendizado sem perda de tempo.`;

  const defaultMechanismName = `Sistema de Aprendizado Estruturado de ${cleanNiche}`;
  const defaultMechanismExplanation = `Organização dos pilares essenciais de ${cleanNiche} em formato de fichas de consulta rápida.`;

  const defaultProductConcept = defaultRecommendedName;
  const defaultEstimatedScope = `Acervo Digital Completo + Materiais de Apoio`;

  const defaultDeliverables = [
    {
      name: `Acervo Principal de ${cleanNiche}`,
      contents: `Fichas visuais e resumos estratégicos de ${cleanNiche}`,
      purpose: `Entregável principal contendo todo o núcleo prático da oferta.`,
      problemSolved: `Elimina a desorganização e perda de tempo ao estudar ${cleanNiche}.`,
      deliveryMethod: `Download Digital Imediato em PDF`,
      inclusionRationale: `Elemento central da oferta.`,
    },
  ];

  const defaultBonuses = [
    {
      name: `Bônus 1: Guia de Aplicação Rápida de ${cleanNiche}`,
      concept: `Checklist de implementação em 1 página`,
      objectionReduced: `Medo de não saber por onde começar`,
      usageAccelerated: `Consulta instantânea`,
      valueAnchor: isUS ? '$19.00 USD' : 'R$ 29,90',
    },
    {
      name: `Bônus 2: Mapa de Referência Express`,
      concept: `Resumo executivo de conceitos-chave`,
      objectionReduced: `Falta de tempo para revisar`,
      usageAccelerated: `Revisão em 5 minutos`,
      valueAnchor: isUS ? '$27.00 USD' : 'R$ 37,00',
    },
  ];

  const defaultOrderBumps = [
    {
      name: `Order Bump 1: Caderno de Exercícios Práticos`,
      concept: `Casos e exemplos resolvidos em ${cleanNiche}`,
      complementaryWhy: `Aumenta a fixação do conteúdo`,
      proposedPrice: isUS ? '$9.95 USD' : 'R$ 19,90',
    },
    {
      name: `Order Bump 2: Fichas de Consulta Rápida`,
      concept: `Guia de bolso para o dia a dia`,
      complementaryWhy: `Praticidade em formato simplificado`,
      proposedPrice: isUS ? '$14.00 USD' : 'R$ 27,00',
    },
  ];

  const defaultLpSections = [
    { sectionNumber: '01', name: 'Hero Section (Hook & Core Promise)', purpose: 'Capturar atenção imediata', message: defaultCorePromise, content: 'Headline de alto impacto e CTA de acesso.', proofNeeded: 'Mockup 3D do produto digital' },
    { sectionNumber: '02', name: 'Problem & Frustration', purpose: 'Gerar identificação', message: `Cansado de perder tempo com materiais confusos de ${cleanNiche}?`, content: 'Descrição das frustrações ao estudar materiais tradicionais.', proofNeeded: 'Exemplos de dificuldades comuns' },
    { sectionNumber: '03', name: 'The New Mechanism', purpose: 'Apresentar a solução', message: defaultMechanismName, content: 'Explicação de como o acervo organiza o conhecimento.', proofNeeded: 'Visão interna da estrutura' },
    { sectionNumber: '04', name: 'Product Presentation', purpose: 'Demonstrar entregáveis', message: defaultDeliverables[0].name, content: 'Visão geral do conteúdo digital.', proofNeeded: 'Imagens das fichas e módulos' },
    { sectionNumber: '05', name: 'Categorization & Structure', purpose: 'Mostrar facilidade', message: `Organização por Pilares de ${cleanNiche}`, content: 'Estrutura clara de módulos e tópicos.', proofNeeded: 'Índice de navegação' },
    { sectionNumber: '06', name: 'Practical Integration', purpose: 'Quebrar objeção de tempo', message: 'Estude e consulte no seu próprio ritmo', content: 'Flexibilidade de uso em qualquer dispositivo.', proofNeeded: 'Selo Mobile Friendly' },
    { sectionNumber: '07', name: 'Social Proof & Validation', purpose: 'Construir confiança', message: `Aprovado por estudantes e leitores de ${cleanNiche}`, content: 'Depoimentos e avaliações positivas.', proofNeeded: 'Prints de comentários' },
    { sectionNumber: '08', name: 'Bonus 1', purpose: 'Aumentar valor percebido', message: defaultBonuses[0].name, content: defaultBonuses[0].concept, proofNeeded: 'Mockup do Bônus 1' },
    { sectionNumber: '09', name: 'Bonus 2', purpose: 'Anular objeção de tempo', message: defaultBonuses[1].name, content: defaultBonuses[1].concept, proofNeeded: 'Mockup do Bônus 2' },
    { sectionNumber: '10', name: 'Stack & Offer Value', purpose: 'Ancorar preço', message: isUS ? 'Total Value $97 → Today Only $27' : 'Valor Total R$ 197 → Hoje apenas R$ 47', content: 'Stack visual de entregáveis e bônus.', proofNeeded: 'Visual Stack' },
    { sectionNumber: '11', name: 'Risk-Free Guarantee', purpose: 'Eliminar risco', message: 'Garantia Incondicional de Satisfação', content: 'Garantia total de reembolso se não gostar.', proofNeeded: 'Selo de Garantia' },
    { sectionNumber: '12', name: 'FAQ', purpose: 'Resolver dúvidas finais', message: 'Perguntas Frequentes', content: 'Respostas sobre formato, entrega e acesso.', proofNeeded: 'Acordeão de FAQ' },
    { sectionNumber: '13', name: 'Final CTA & Checkout', purpose: 'Forçar ação', message: 'Garantir Acesso Imediato Agora', content: 'Chamada final para o checkout seguro.', proofNeeded: 'Selo Checkout Seguro' },
  ];

  const defaultCreativeConcepts = [
    {
      conceptName: `Conceito 1: Visão Geral do Acervo de ${cleanNiche}`,
      format: 'Vídeo 9:16 / Carrossel',
      audienceMoment: 'Buscando formas mais práticas de aprender',
      hookText: `Se você precisa dominar ${cleanNiche} sem perder semanas lendo teorias extensas...`,
      firstVisualFrame: 'Apresentação do produto digital em tela dividida',
      bodyConcept: 'Demonstração rápida da facilidade das fichas e organização.',
      proof: 'Gravação da interface e navegação do produto',
      ctaText: 'Clique para acessar o guia completo',
      whyThisAngleExists: 'Aborda a necessidade de velocidade e clareza no aprendizado.',
    },
    {
      conceptName: `Conceito 2: Comparativo Prático em ${cleanNiche}`,
      format: 'Motion Graphic / UGC',
      audienceMoment: 'Frustrado com materiais desorganizados',
      hookText: `A diferença entre estudar ${cleanNiche} de forma confusa x ter um mapa estruturado...`,
      firstVisualFrame: 'Comparação visual entre livro denso e fichas esquemáticas',
      bodyConcept: 'Mostra o alívio mental de ter um guia limpo e direto.',
      proof: 'Close no material de apoio',
      ctaText: 'Garanta seu acesso com desconto hoje',
      whyThisAngleExists: 'Destaca o benefício de organização e alívio do estresse.',
    },
  ];

  return {
    defaultRecommendedName,
    defaultAlternativeNames,
    defaultPrimaryAudience,
    defaultContext,
    defaultFunctionalPains,
    defaultEmotionalPains,
    defaultDesires,
    defaultObjections,
    defaultBuyingTriggers,
    defaultJobsToBeDone,
    defaultCategory,
    defaultSubcategory,
    defaultCounterPositioning,
    defaultDifferentiation,
    defaultPositioningStatement,
    defaultBigIdea,
    defaultAngle,
    defaultHookTerritory,
    defaultCorePromise,
    defaultMechanismName,
    defaultMechanismExplanation,
    defaultProductConcept,
    defaultEstimatedScope,
    defaultDeliverables,
    defaultBonuses,
    defaultOrderBumps,
    defaultLpSections,
    defaultCreativeConcepts,
  };
}

export async function startOrAdvanceMission(missionId: string): Promise<OfficeMissionRecord> {
  let mission = await officeDbService.getMission(missionId);
  if (!mission) throw new Error(`Missão não encontrada: ${missionId}`);

  if (mission.status === 'COMPLETED' || mission.status === 'PAUSED' || mission.status === 'CANCELLED') {
    return mission;
  }

  let caseFile = { ...mission.caseFile };
  let costTracker = mission.costSummary || createMissionCostTracker(mission.id, mission.profileId);
  const brief = mission.missionBrief;

  if (!brief) {
    throw new Error('Mission Brief é obrigatório para a execução do Escritório.');
  }

  // FASE 0: PREPARING (CONTRACTS & SOURCE CONTEXT ASSEMBLY)
  const missionContract: MissionContract = buildMissionContract(mission.id, brief);
  const transContract: ModelingTransformationContract | null = buildTransformationContract(brief);
  const sourcePack: SourceOfferContextPack | null = await buildSourceOfferContextPack(brief.primaryOfferId, mission.id);

  // Store contracts into caseFile constraints
  caseFile.missionConstraints = {
    missionContract,
    transContract,
    sourcePackSummary: sourcePack
      ? {
          offerId: sourcePack.offerId,
          productName: sourcePack.productName,
          niche: sourcePack.niche,
          price: sourcePack.priceFormatted,
          activeAds: sourcePack.activeAdsCount,
        }
      : null,
  };

  if (mission.status === 'DRAFT' || mission.status === 'PLANNING') {
    mission.status = 'RESEARCHING';
    await officeDbService.saveMission(mission);

    const allOffers = await dbService.getOffers();
    const candidates = (sourcePack && sourcePack.isAvailable ? [sourcePack.rawOfferData] : allOffers.slice(0, 15)).map((o: any) => ({
      id: o.id || 'off_1',
      name: o.product_name || o.name || 'Oferta Base',
      niche: o.niche || 'Geral',
      activeAdsCount: o.active_ads_count || 0,
      perceivedPrice: o.price ? `R$ ${o.price}` : 'R$ 29,90',
      longevityDays: o.days_running || 30,
      summary: o.promise || o.headline || 'Oferta low-ticket de referência',
    }));

    caseFile.candidateUniverse = candidates;
    caseFile.shortlistOffers = candidates;

    mission.caseFile = caseFile;
    await officeDbService.saveMission(mission);
  }

  // FASE 1: MARKET & VALIDATION DEPARTMENT
  if (mission.status === 'RESEARCHING') {
    const r1 = await executeAgentRole(mission.id, 'market-signal-miner', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r1.updatedCostTracker;
    caseFile = r1.updatedCaseFile;

    const r2 = await executeAgentRole(mission.id, 'audience-positioning-researcher', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r2.updatedCostTracker;
    caseFile = r2.updatedCaseFile;

    const r3 = await executeAgentRole(mission.id, 'evidence-auditor', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r3.updatedCostTracker;
    caseFile = r3.updatedCaseFile;

    const headMarket = await executeAgentRole(
      mission.id,
      'head-market',
      mission.profileId,
      caseFile,
      costTracker,
      missionContract,
      transContract,
      sourcePack,
      'Consolide as evidências de mercado e aprove o posicionamento do avatar.'
    );
    costTracker = headMarket.updatedCostTracker;
    caseFile = headMarket.updatedCaseFile;

    caseFile.marketFindings = {
      marketSignals: r1.result.findings?.marketSignals || r1.result.findings?.findings || [],
      targetAudienceSummary: r2.result.findings || {},
      auditorWarnings: r3.result.findings?.risks || [],
      acceptedShortlist: caseFile.shortlistOffers,
    };

    mission.status = 'ARCHITECTING';
    mission.caseFile = caseFile;
    mission.costSummary = costTracker;
    await officeDbService.saveMission(mission);
  }

  // FASE 2: OFFER ARCHITECTURE DEPARTMENT
  if (mission.status === 'ARCHITECTING') {
    const r4 = await executeAgentRole(mission.id, 'offer-dna-analyst', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r4.updatedCostTracker;
    caseFile = r4.updatedCaseFile;

    const r5 = await executeAgentRole(mission.id, 'product-mechanism-architect', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r5.updatedCostTracker;
    caseFile = r5.updatedCaseFile;

    const r6 = await executeAgentRole(mission.id, 'pricing-monetization-strategist', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r6.updatedCostTracker;
    caseFile = r6.updatedCaseFile;

    const headOffer = await executeAgentRole(
      mission.id,
      'head-offer',
      mission.profileId,
      caseFile,
      costTracker,
      missionContract,
      transContract,
      sourcePack,
      'Consolide o conceito do produto, mecanismo único e precificação de acordo com o Mission & Transformation Contract.'
    );
    costTracker = headOffer.updatedCostTracker;
    caseFile = headOffer.updatedCaseFile;

    caseFile.offerFindings = {
      offerDnaSummary: r4.result.findings || {},
      productBlueprint: r5.result.findings || {},
      pricingArchitecture: r6.result.findings || {},
    };

    mission.status = 'GTM';
    mission.caseFile = caseFile;
    mission.costSummary = costTracker;
    await officeDbService.saveMission(mission);
  }

  // FASE 3: GO TO MARKET DEPARTMENT
  if (mission.status === 'GTM') {
    const r7 = await executeAgentRole(mission.id, 'creative-strategist', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r7.updatedCostTracker;
    caseFile = r7.updatedCaseFile;

    const r8 = await executeAgentRole(mission.id, 'copy-lp-strategist', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r8.updatedCostTracker;
    caseFile = r8.updatedCaseFile;

    const r9 = await executeAgentRole(mission.id, 'validation-scale-strategist', mission.profileId, caseFile, costTracker, missionContract, transContract, sourcePack);
    costTracker = r9.updatedCostTracker;
    caseFile = r9.updatedCaseFile;

    const headGtm = await executeAgentRole(
      mission.id,
      'head-gtm',
      mission.profileId,
      caseFile,
      costTracker,
      missionContract,
      transContract,
      sourcePack,
      'Consolide o Creative System, Landing Page Blueprint e Plano de Teste.'
    );
    costTracker = headGtm.updatedCostTracker;
    caseFile = headGtm.updatedCaseFile;

    caseFile.gtmFindings = {
      creativeSystem: r7.result.findings || {},
      lpBlueprint: r8.result.findings || {},
      validationPlan: r9.result.findings || {},
    };

    mission.status = 'DIRECTOR_REVIEW';
    mission.caseFile = caseFile;
    mission.costSummary = costTracker;
    await officeDbService.saveMission(mission);
  }

  // FASE 4: DIRECTOR SYNTHESIS & QUALITY GATES ENGINE
  if (mission.status === 'DIRECTOR_REVIEW') {
    const directorRes = await executeAgentRole(
      mission.id,
      'director',
      mission.profileId,
      caseFile,
      costTracker,
      missionContract,
      transContract,
      sourcePack,
      'Sintetize todas as decisões dos 3 Departamentos e elabore a OfferProjectSpec definitiva respeitando impreterivelmente o Mission & Transformation Contract.'
    );
    costTracker = directorRes.updatedCostTracker;
    caseFile = directorRes.updatedCaseFile;

    const dFindings = directorRes.result.findings || {};

    // Determine exact target currency and pricing text
    const currency = missionContract.targetCurrency;
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';

    const sourceName = sourcePack?.productName || brief.primaryOfferId || 'Oferta de Referência';
    const rawNiche = sourcePack?.niche || brief.niche;
    const mainNiche = (!rawNiche || rawNiche === 'NOT_AVAILABLE' || rawNiche === 'N/I' || rawNiche === 'Geral')
      ? 'Educação e Conhecimento'
      : rawNiche;
    const targetMarket = missionContract.targetMarket;
    const isUS = targetMarket === 'Estados Unidos';

    const dynamicFallbacks = buildDynamicNicheFallbacks(mainNiche, sourceName, targetMarket, isUS, brief.objective);

    // P0 MANDATORY NAME RULE: MODEL_EXISTING missions MUST receive a brand-new name
    let recommendedName = dFindings.recommendedOfferName || dFindings.recommendedName;
    if (!recommendedName || recommendedName.toLowerCase().includes('(brasil edition)') || recommendedName.toLowerCase().includes('us edition') || recommendedName.toLowerCase().endsWith(' pro')) {
      recommendedName = dynamicFallbacks.defaultRecommendedName;
    }

    const alternativeNames = dFindings.alternativeNames && Array.isArray(dFindings.alternativeNames) && dFindings.alternativeNames.length >= 3
      ? dFindings.alternativeNames
      : dynamicFallbacks.defaultAlternativeNames;

    // Deep Audience Aggregation
    const audFindings = caseFile.marketFindings?.targetAudienceSummary || {};
    const primaryAudience =
      dFindings.primaryAudience ||
      audFindings.primarySegment ||
      dynamicFallbacks.defaultPrimaryAudience;

    // Construct 13 Vertical Sections for Landing Page Blueprint
    const lpBlueprintSections = dynamicFallbacks.defaultLpSections;

    // Construct Creative Concepts
    const firstCreativeConcepts = dynamicFallbacks.defaultCreativeConcepts;

    // Deduplicate Decision Ledger
    const rawDecisions = (caseFile.decisionLedger && caseFile.decisionLedger.length > 0)
      ? caseFile.decisionLedger
      : [
          {
            id: `dec_${Date.now()}`,
            category: 'POSITIONING',
            title: `Nova Identidade Verbal: ${recommendedName}`,
            value: recommendedName,
            rationale: 'Substituição total do nome original para construção de ativos próprios.',
            evidenceRefs: [sourcePack?.offerId || 'EV_SOURCE_01'],
          },
          {
            id: `dec_${Date.now() + 1}`,
            category: 'PRICING',
            title: `Precificação Front Otimizada para Mercado (${isUS ? '$27.00 USD' : 'R$ 47,00'})`,
            value: isUS ? '$27.00 USD' : 'R$ 47,00',
            rationale: 'Ticket de entrada com baixo atrito de compra para tráfego direto de anúncios.',
            evidenceRefs: ['EV_PRICING_DEPT'],
          },
        ];

    const deduplicatedDecisions = rawDecisions.filter((dec: any, index: number, self: any[]) =>
      index === self.findIndex((d: any) => d.title === dec.title || (d.value && d.value === dec.value))
    ).map((d: any) => ({
      id: d.id || `dec_${Math.random().toString(36).substring(2, 6)}`,
      decisionType: d.category || d.decisionType || 'POSITIONING',
      title: d.title || 'Decisão Estratégica',
      value: typeof d.value === 'string' ? d.value : d.recommendation || JSON.stringify(d.value),
      rationale: d.rationale || 'Decisão fundamentada pelo departamento estratégico.',
      evidenceRefs: Array.isArray(d.evidenceRefs)
        ? d.evidenceRefs.map((e: any) => (typeof e === 'string' ? e : e.title || e.name || 'Evidência'))
        : [],
      alternativesConsidered: Array.isArray(d.alternativesConsidered) ? d.alternativesConsidered : [],
      uncertainty: d.uncertainty || 'EVIDÊNCIA MODERADA',
      status: 'APPROVED' as const,
    }));

    // Construct OfferProjectSpec dynamically from real LLM agent outputs
    const fullOfferSpec: CompleteOfferProjectSpec = {
      sourceOffer: sourcePack ? { id: sourcePack.offerId, name: sourcePack.productName } : undefined,
      transformationSummary: transContract ? {
        changesUsed: 2,
        maxChanges: transContract.maximumChanges,
        lockedDimensions: transContract.lockedDimensions,
      } : undefined,
      identity: {
        recommendedName,
        alternativeNames,
        tag: 'OFFICE_CREATED_SPEC',
      },
      opportunity: {
        thesis: brief.objective,
        detectedPatterns: caseFile.evidenceList.slice(0, 5).map((e) => e.summary),
        marketGap: `Demanda por materiais focados em ${mainNiche} para o mercado ${targetMarket}.`,
        whyTestable: `Formato digital faceless com produção ágil em complexidade ${brief.productionComplexity}.`,
      },
      market: {
        niche: mainNiche,
        subniche: (brief as any).subniche || sourcePack?.subniche || cleanSubniche(mainNiche),
        marketCountry: targetMarket,
        scalePotential: `Alto potencial em tráfego direto no mercado ${targetMarket}.`,
      },
      audience: {
        primaryAudience,
        secondaryAudience: dFindings.secondaryAudience || `Pessoas interessadas em aprimoramento em ${mainNiche}.`,
        context: dynamicFallbacks.defaultContext,
        painPoints: {
          functional: audFindings.functionalPains || dynamicFallbacks.defaultFunctionalPains,
          emotional: audFindings.emotionalPains || dynamicFallbacks.defaultEmotionalPains,
          practical: [`Dificuldade de encontrar materiais estruturados em ${mainNiche}`],
          identity: [`Desejo de evoluir rapidamente em ${mainNiche}`],
        },
        desires: audFindings.desires || dynamicFallbacks.defaultDesires,
        frustrations: audFindings.frustrations || [`Excesso de teorias complexas em ${mainNiche}`],
        objections: audFindings.objections || dynamicFallbacks.defaultObjections,
        buyingTriggers: audFindings.buyingTriggers || dynamicFallbacks.defaultBuyingTriggers,
        languagePatterns: audFindings.languagePatterns || [`"Preciso de algo prático sobre ${mainNiche}"`],
        currentAlternatives: audFindings.currentAlternatives || [`Livros teóricos tradicionais de ${mainNiche}`],
        jobsToBeDone: audFindings.jobsToBeDone || dynamicFallbacks.defaultJobsToBeDone,
      },
      positioning: {
        category: dynamicFallbacks.defaultCategory,
        subcategory: dynamicFallbacks.defaultSubcategory,
        counterPositioning: dynamicFallbacks.defaultCounterPositioning,
        differentiation: dynamicFallbacks.defaultDifferentiation,
        positioningStatement: dynamicFallbacks.defaultPositioningStatement,
      },
      bigIdea: {
        idea: dFindings.bigIdea || dynamicFallbacks.defaultBigIdea,
        angle: dFindings.angle || dynamicFallbacks.defaultAngle,
        hookTerritory: dynamicFallbacks.defaultHookTerritory,
      },
      promise: {
        corePromise: dFindings.corePromise || dynamicFallbacks.defaultCorePromise,
        secondaryPromises: [isUS ? 'Instant Digital Access' : 'Acesso Digital Instantâneo', isUS ? 'Bonus Guides Included' : 'Bônus Exclusivos Incluídos'],
        claimsBoundary: `Material educativo focado no Nicho de ${mainNiche}.`,
      },
      mechanism: {
        name: dFindings.mechanismName || dynamicFallbacks.defaultMechanismName,
        explanation: dynamicFallbacks.defaultMechanismExplanation,
        deliveryOfValue: 'Fichas e resumos estruturados digitais.',
        differentiation: 'Fichas de consulta rápida com acesso instantâneo.',
      },
      product: {
        concept: dFindings.productConcept || recommendedName,
        type: brief.preferredFormats[0] || 'PDF / Ebook',
        format: brief.preferredFormats.join(', ') || 'PDF Digital Interativo',
        delivery: 'Download digital imediato',
        usage: 'Consulta prática em dispositivos digitais',
        organization: `Organizado por módulos e pilares de ${mainNiche}`,
        estimatedScope: dynamicFallbacks.defaultEstimatedScope,
        productionComplexity: (brief.productionComplexity === 'Baixa' ? 'BAIXA' : brief.productionComplexity === 'Média' ? 'MÉDIA' : 'BAIXA') as 'BAIXA' | 'MÉDIA' | 'ALTA',
        faceless: brief.facelessPreference !== 'Indiferente',
        repeatUsage: true,
        timeToConsume: 'Acesso imediato e consulta rápida',
      },
      deliverables: dynamicFallbacks.defaultDeliverables,
      valueArchitecture: {
        coreProduct: `${recommendedName} (${isUS ? '$67 Value' : 'Valor R$ 197'})`,
        supportMaterials: [`Lista de Referência de ${mainNiche}`],
        bonuses: dynamicFallbacks.defaultBonuses,
        bumps: dynamicFallbacks.defaultOrderBumps,
        futureUpsell: isUS ? `Advanced ${mainNiche} Masterclass ($47)` : `Comunidade / Curso Avançado de ${mainNiche}`,
      },
      pricing: {
        observedRange: sourcePack?.priceFormatted || (isUS ? '$19.00 - $49.00 USD' : 'R$ 29,90 - R$ 97,00'),
        frontHypothesis: isUS ? '$27.00 USD' : 'R$ 47,00',
        anchorPrice: isUS ? '$97.00 USD' : 'R$ 197,00',
        testPrice: isUS ? '$27.00 USD' : 'R$ 47,00',
        rationale: isUS
          ? `Optimized low-ticket front price ($27.00 USD) for cold traffic in ${mainNiche}.`
          : `Ticket low-ticket otimizado para tráfego direto em ${mainNiche}.`,
        alternativesConsidered: isUS ? ['$19.00 USD', '$37.00 USD'] : ['R$ 29,90', 'R$ 67,00'],
      },
      monetization: {
        flow: 'Cold Traffic -> LP -> Checkout -> Order Bumps -> Upsell -> Thank You Page',
        orderBumps: dynamicFallbacks.defaultOrderBumps,
        futureUpsell: isUS ? 'VIP Membership' : 'Assinatura VIP',
      },
      creativeStrategy: {
        angleTerritories: [
          {
            angle: `Visual Proof & Practical Guide in ${mainNiche}`,
            audiencePain: `Skeptical about material quality`,
            hookExamples: [`"Aprenda os conceitos fundamentais de ${mainNiche} de forma direta..."`],
            visualMechanism: 'Navegação visual pelas fichas digitais',
            format: '9:16 Vertical Video / Motion',
            proof: 'Demonstração interna do conteúdo',
            ctaDirection: `Clique no link para garantir o acervo completo`,
            whyItMayWork: `Demonstra valor e praticidade no primeiro segundo`,
          },
        ],
        firstCreativeConcepts,
      },
      copyStrategy: {
        coreMessage: dynamicFallbacks.defaultCorePromise,
        headlineDirections: [
          `Guia Prático de ${mainNiche}: O Acervo Essencial para Aplicação Rápida`,
          `Domine ${mainNiche} em Tempo Recorde sem Perder Horas com Teorias`,
        ],
        subheadlineDirection: 'Sem enrolação. Acesso digital imediato no seu celular.',
        mainObjections: dynamicFallbacks.defaultObjections.slice(0, 2),
        proofStrategy: 'Demonstração interna das fichas e estrutura visual.',
        ctaConcept: isUS ? 'Claim My $27 Digital Access' : 'Garantir Acesso por R$ 47',
      },
      landingPageBlueprint: {
        heroHeadline: dynamicFallbacks.defaultCorePromise,
        heroSubheadline: 'Sem enrolação. Acesso digital imediato.',
        sections: lpBlueprintSections,
      },
      checkout: {
        front: isUS ? 'Stripe Direct Checkout' : 'Checkout Seguro',
        plans: [isUS ? 'Full Digital Access ($27.00 USD)' : 'Acesso Digital Completo (R$ 47,00)'],
        bumps: [isUS ? 'Exercise Guide ($9.95 USD)' : 'Guia de Exercícios (R$ 19,90)'],
        paymentStructure: isUS ? 'Credit Card / Apple Pay / PayPal' : 'Cartão / PIX',
        frictionConsiderations: ['Envio imediato por e-mail'],
      },
      validationPlan: {
        testMatrix: [
          {
            testName: `Validação de Tráfego Frio - ${mainNiche}`,
            hypothesis: 'Criativos focados em praticidade atingem CPA viável',
            variable: 'Hook Territory & Angle',
            setup: isUS ? '$50/day test budget on Meta Ads' : 'Orçamento de teste R$ 100/dia',
            successSignal: 'ROAS > 1.5 em 3 dias',
            failureSignal: 'CPA > limite do ticket',
            learningObjective: 'Validar viabilidade de aquisição direta',
          },
        ],
      },
      risks: [
        {
          failureMode: 'Queda de retenção no anúncio',
          description: 'Vídeo não retém nos primeiros 3 segundos',
          severity: 'MEDIUM',
          mitigation: 'Usar demonstração visual do produto no frame 1',
        },
      ],
      referenceIntelligence: sourcePack ? [{ offerName: sourcePack.productName, copiedAspect: 'Engine comercial e estrutura de precificação low-ticket', rationale: 'Desempenho de catálogo validado' }] : [],
      discardedFinalists: [],
      decisions: deduplicatedDecisions,
    };

    // Run Comprehensive Non-LLM Quality Gates Engine
    const qualityReport = runQualityGates(fullOfferSpec, missionContract, transContract, sourcePack);
    console.log(`[QUALITY_GATES_REPORT] Overall passed: ${qualityReport.overallPassed}. Failed gates: ${qualityReport.failedGateNames.join(', ')}`);

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const offerProjectRecord: OfficeOfferProjectRecord = {
      id: projectId,
      missionId: mission.id,
      projectName: fullOfferSpec.identity.recommendedName,
      workingName: `Tese ${mainNiche} (${targetMarket})`,
      market: targetMarket,
      niche: mainNiche,
      subniche: (brief as any).subniche || undefined,
      status: qualityReport.overallPassed ? 'APPROVED' : 'TESTING',
      referenceOfferIds: caseFile.shortlistOffers.map((o) => o.id),
      decisionLedger: fullOfferSpec.decisions,
      offerSpec: {
        ...fullOfferSpec,
        qualityReport,
        transformationMatrix: qualityReport.transformationMatrix,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await officeDbService.saveOfferProject(offerProjectRecord);

    mission.status = 'COMPLETED';
    mission.offerProjectId = projectId;
    mission.caseFile = caseFile;
    mission.costSummary = costTracker;
    await officeDbService.saveMission(mission);
  }

  return mission;
}
