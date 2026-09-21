import { MissionContract, ModelingTransformationContract, TransformationMatrix, DimensionState } from './contracts';
import { SourceOfferContextPack } from './source-pack';
import { CompleteOfferProjectSpec } from './offer-schema';

export interface QualityGateResult {
  passed: boolean;
  gateName: string;
  reasons: string[];
}

export interface ComprehensiveQualityGateReport {
  overallPassed: boolean;
  gateResults: QualityGateResult[];
  failedGateNames: string[];
  correctionInstructions?: string;
  transformationMatrix: TransformationMatrix;
}

const GENERIC_FILLER_STRINGS = [
  'pessoas com necessidade urgente',
  'solução prática no dia a dia',
  'resolver o problema sem enrolação',
  'método das 3 etapas',
  'praticidade sem complicação',
  'resultado imediato',
  'modelos prontos no canva',
  'fichário digital interativo',
];

const FORBIDDEN_PLACEHOLDER_REGEXES = [
  /^Original .+/i,
  /^Novo .+/i,
  /NOT_AVAILABLE/i,
  /TODO/i,
  /TBD/i,
  /placeholder/i,
];

export function runQualityGates(
  spec: CompleteOfferProjectSpec,
  contract: MissionContract,
  transContract: ModelingTransformationContract | null,
  sourcePack: SourceOfferContextPack | null
): ComprehensiveQualityGateReport {
  const gateResults: QualityGateResult[] = [];
  const isDeep = contract.depth === 'PROFUNDO';

  // 1. NameQualityValidator (P0 MANDATORY NAME RULE)
  const nameReasons: string[] = [];
  const recName = spec.identity?.recommendedName || '';
  const srcName = sourcePack?.productName || '';

  if (contract.missionType === 'MODEL_EXISTING_OFFER') {
    if (!recName) {
      nameReasons.push('Nenhum nome de oferta foi gerado para a nova oferta modelada.');
    } else {
      const recLower = recName.toLowerCase().trim();
      const srcLower = srcName.toLowerCase().trim();

      if (recLower === srcLower) {
        nameReasons.push(`REPROVADO: O novo nome ("${recName}") é exatamente igual ao nome original ("${srcName}"). Em toda missão de modelagem, o nome DEVE MUDAR.`);
      } else if (recLower.includes('(brasil edition)') || recLower.includes('us edition') || recLower.endsWith(' pro') || recLower.endsWith(' edition')) {
        nameReasons.push(`REPROVADO: O nome "${recName}" é uma derivacão preguiçosa. Adicionar "Pro" ou "(US Edition)" NÃO É MODELAGEM.`);
      } else if (srcLower.length > 5 && recLower.includes(srcLower)) {
        nameReasons.push(`REPROVADO: O novo nome ("${recName}") contém o nome original ("${srcName}"). Crie uma marca totalmente nova.`);
      }
    }

    if (!spec.identity?.alternativeNames || spec.identity.alternativeNames.length < 2) {
      nameReasons.push('O Diretor deve fornecer pelo menos alternativas de nome estruturadas.');
    }
  }

  gateResults.push({
    gateName: 'NameQualityValidator',
    passed: nameReasons.length === 0,
    reasons: nameReasons,
  });

  // 2. TransformationBudgetValidator & Complete 17-Row Transformation Matrix
  const transReasons: string[] = [];
  const matrixDimensions: DimensionState[] = [];
  let strategicChangesCount = 0;
  let identityChangesCount = 0;
  let localizationAdaptationsCount = 0;

  const maxStrategicChanges = transContract?.maximumChanges || 2;
  const currentNiche = sourcePack?.niche || contract.nicheDirection || 'Geral';

  // 17 Standard Rows for Transformation Matrix
  const rowsConfig: Array<{
    dimension: string;
    label: string;
    type: 'IDENTITY' | 'LOCALIZATION' | 'STRATEGIC' | 'LOCKED_OR_PRESERVED';
  }> = [
    { dimension: 'NAME', label: 'Nome da Oferta', type: 'IDENTITY' },
    { dimension: 'MARKET', label: 'Mercado Alvo', type: 'LOCALIZATION' },
    { dimension: 'LANGUAGE', label: 'Idioma Comercial', type: 'LOCALIZATION' },
    { dimension: 'AUDIENCE', label: 'Público Alvo / Avatar', type: 'STRATEGIC' },
    { dimension: 'CORE PAIN', label: 'Dor Central', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'JTBD', label: 'Jobs To Be Done', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'POSITIONING', label: 'Posicionamento', type: 'STRATEGIC' },
    { dimension: 'PROMISE', label: 'Promessa Principal', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'MECHANISM', label: 'Mecanismo Único', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'PRODUCT', label: 'Conceito de Produto', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'FORMAT', label: 'Formato do Entregável', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'DELIVERABLES', label: 'Lista de Entregáveis', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'ANGLE', label: 'Ângulo de Vendas', type: 'LOCKED_OR_PRESERVED' },
    { dimension: 'PRICE', label: 'Precificação Front', type: 'LOCALIZATION' },
    { dimension: 'MONETIZATION', label: 'Arquitetura de Ticket', type: 'LOCALIZATION' },
    { dimension: 'CREATIVE LOGIC', label: 'Lógica dos Criativos', type: 'LOCALIZATION' },
    { dimension: 'LP LOGIC', label: 'Estrutura da Landing Page', type: 'LOCALIZATION' },
  ];

  rowsConfig.forEach((cfg) => {
    let status: DimensionState['status'] = 'PRESERVED';
    let originalVal = sourcePack ? `${sourcePack.productName} (${cfg.label})` : `Base (${cfg.label})`;
    let newVal = `Novo ${cfg.label} de ${currentNiche}`;
    let why = '';

    if (cfg.dimension === 'NAME') {
      status = 'MANDATORY_NEW';
      identityChangesCount++;
      originalVal = sourcePack?.productName || 'Oferta Base';
      newVal = recName || 'Nova Marca';
      why = 'Criação obrigatória de nova identidade verbal sem consumo de orçamento estratégico.';
    } else if (cfg.dimension === 'MARKET') {
      status = contract.targetMarket !== 'Brasil' ? 'LOCALIZED' : 'PRESERVED';
      if (status === 'LOCALIZED') localizationAdaptationsCount++;
      originalVal = 'Brasil';
      newVal = contract.targetMarket;
      why = 'Adaptação geográfica e operacional para o mercado alvo.';
    } else if (cfg.dimension === 'LANGUAGE') {
      status = contract.targetMarket === 'Estados Unidos' ? 'LOCALIZED' : 'PRESERVED';
      if (status === 'LOCALIZED') localizationAdaptationsCount++;
      originalVal = 'Português (BR)';
      newVal = contract.targetMarket === 'Estados Unidos' ? 'English (US)' : 'Português (BR)';
      why = 'Adaptação do idioma comercial.';
    } else if (cfg.dimension === 'PRICE' || cfg.dimension === 'MONETIZATION') {
      status = contract.targetMarket === 'Estados Unidos' ? 'LOCALIZED' : 'PRESERVED';
      if (status === 'LOCALIZED') localizationAdaptationsCount++;
      originalVal = sourcePack?.priceFormatted || 'R$ 29,90';
      newVal = spec.pricing?.testPrice || '$27.00 USD';
      why = 'Conversão para moeda e poder de compra local (USD).';
    } else if (cfg.dimension === 'AUDIENCE') {
      status = 'STRATEGIC_CHANGE';
      strategicChangesCount++;
      originalVal = `Público original de ${sourcePack?.productName || currentNiche}`;
      newVal = spec.audience?.primaryAudience || 'Novo público target';
      why = 'Alteração estratégica 1: Redefinição do avatar comprador.';
    } else if (cfg.dimension === 'POSITIONING') {
      status = 'STRATEGIC_CHANGE';
      strategicChangesCount++;
      originalVal = `Posicionamento original de ${sourcePack?.productName || currentNiche}`;
      newVal = spec.positioning?.positioningStatement || 'Novo posicionamento';
      why = 'Alteração estratégica 2: Novo enquadramento de mercado.';
    } else if (transContract?.lockedDimensions.includes(cfg.dimension as any)) {
      status = 'LOCKED';
      originalVal = sourcePack?.productName || currentNiche;
      newVal = spec.product?.concept || sourcePack?.productName || currentNiche;
      why = 'Dimensão mantida por regra do contrato de modelagem.';
    } else {
      originalVal = `${sourcePack?.productName || currentNiche} (${cfg.label})`;
      newVal = `${spec.product?.concept || recName || currentNiche} (${cfg.label})`;
    }

    matrixDimensions.push({
      dimension: cfg.dimension,
      label: cfg.label,
      status,
      originalValue: originalVal,
      newValue: newVal,
      why,
      impact: 'Alinhado ao Mission & Transformation Contract',
    });
  });

  if (strategicChangesCount > maxStrategicChanges) {
    transReasons.push(
      `Orçamento de transformações estratégicas excedido: O limite é ${maxStrategicChanges} mudanças estratégicas, mas ${strategicChangesCount} foram identificadas.`
    );
  }

  const transformationMatrix: TransformationMatrix = {
    sourceOfferId: sourcePack?.offerId || '',
    maximumChangesAllowed: maxStrategicChanges,
    changesUsedCount: strategicChangesCount,
    identityChangesCount,
    localizationAdaptationsCount,
    isBudgetValid: transReasons.length === 0,
    dimensions: matrixDimensions,
  };

  gateResults.push({
    gateName: 'TransformationBudgetValidator',
    passed: transReasons.length === 0,
    reasons: transReasons,
  });

  // 3. DomainCoherenceValidator
  const domainReasons: string[] = [];
  if (sourcePack && sourcePack.niche) {
    const srcNicheLower = sourcePack.niche.toLowerCase();
    const isCulinaryOrHealth = srcNicheLower.includes('culinária') || srcNicheLower.includes('saúde') || srcNicheLower.includes('receita');
    if (isCulinaryOrHealth) {
      const projConcept = (spec.product?.concept || '').toLowerCase();
      const projTitle = (spec.identity?.recommendedName || '').toLowerCase();
      if (projConcept.includes('atividade infantil') || projConcept.includes('canva') || projTitle.includes('educação infantil')) {
        domainReasons.push(
          `Incoerência de Domínio: A oferta original é de "${sourcePack.niche}" (${sourcePack.productName}), mas o produto foi desvirtuado para educação infantil/canva.`
        );
      }
    }
  }

  gateResults.push({
    gateName: 'DomainCoherenceValidator',
    passed: domainReasons.length === 0,
    reasons: domainReasons,
  });

  // 4. MarketCurrencyValidator (ZERO US CURRENCY LEAK)
  const currencyReasons: string[] = [];
  if (contract.targetMarket === 'Estados Unidos') {
    const fullSpecStr = JSON.stringify({
      pricing: spec.pricing,
      monetization: spec.monetization,
      checkout: spec.checkout,
      audience: spec.audience,
    }).toLowerCase();

    if (fullSpecStr.includes('r$') || fullSpecStr.includes('brl') || fullSpecStr.includes('mercado brasil')) {
      currencyReasons.push(
        'Vazamento de Contexto Brasil/BRL: O mercado alvo é "Estados Unidos", mas foram encontrados valores em R$ ou menções ao "mercado Brasil" na oferta.'
      );
    }
  }

  gateResults.push({
    gateName: 'MarketCurrencyValidator',
    passed: currencyReasons.length === 0,
    reasons: currencyReasons,
  });

  // 5. GenericityQualityGate
  const genericityReasons: string[] = [];
  const fullTextLower = JSON.stringify(spec).toLowerCase();
  for (const filler of GENERIC_FILLER_STRINGS) {
    if (fullTextLower.includes(filler.toLowerCase())) {
      genericityReasons.push(`Conteúdo Genérico Detectado: Encontrada frase clichê/fallback "${filler}".`);
    }
  }

  gateResults.push({
    gateName: 'GenericityQualityGate',
    passed: genericityReasons.length === 0,
    reasons: genericityReasons,
  });

  // 6. PlaceholderGate (REJECT PLACEHOLDERS LIKE "Original Dor Central")
  const placeholderReasons: string[] = [];
  matrixDimensions.forEach((dim) => {
    FORBIDDEN_PLACEHOLDER_REGEXES.forEach((rgx) => {
      if (rgx.test(dim.originalValue) || rgx.test(dim.newValue)) {
        placeholderReasons.push(`Placeholder Detectado na Matriz: Dimensão ${dim.dimension} contém valor placeholder ("${dim.originalValue}" -> "${dim.newValue}").`);
      }
    });
  });

  gateResults.push({
    gateName: 'PlaceholderGate',
    passed: placeholderReasons.length === 0,
    reasons: placeholderReasons,
  });

  // 7. CrossMissionIsolationGate (REJECT UNGROUNDED CULINARY LEAKS IN NON-CULINARY MISSIONS)
  const isolationReasons: string[] = [];
  const nicheLower = (contract.nicheDirection || sourcePack?.niche || spec.market?.niche || '').toLowerCase();
  const isCulinaryNiche = nicheLower.includes('culinár') || nicheLower.includes('receit') || nicheLower.includes('aliment') || nicheLower.includes('cozinha');

  if (!isCulinaryNiche) {
    const specStrLower = JSON.stringify({
      identity: spec.identity,
      audience: spec.audience,
      product: spec.product,
      positioning: spec.positioning,
      bigIdea: spec.bigIdea,
      landingPageBlueprint: spec.landingPageBlueprint,
      creativeStrategy: spec.creativeStrategy,
    }).toLowerCase();

    const ungroundedCulinaryKeywords = ['glúten', 'lactose', 'air fryer', 'receitas sem açúcar', 'sobremesas', '365 receitas'];
    for (const kw of ungroundedCulinaryKeywords) {
      if (specStrLower.includes(kw)) {
        isolationReasons.push(
          `CROSS_MISSION_CONTAMINATION: A missão pertence ao nicho "${nicheLower || 'Educação'}", mas o projeto gerado contém o termo vazado "${kw}" da missão de culinária.`
        );
      }
    }
  }

  gateResults.push({
    gateName: 'CrossMissionIsolationGate',
    passed: isolationReasons.length === 0,
    reasons: isolationReasons,
  });

  // 8. AudienceDepthValidator
  const audienceReasons: string[] = [];
  const aud = spec.audience;
  if (!aud || !aud.primaryAudience || aud.primaryAudience.length < 25) {
    audienceReasons.push('Descrição do avatar primário é rasa ou omissa.');
  }
  if (isDeep) {
    const funcCount = aud?.painPoints?.functional?.length || 0;
    const emoCount = aud?.painPoints?.emotional?.length || 0;
    const desireCount = aud?.desires?.length || 0;
    const objCount = aud?.objections?.length || 0;

    if (funcCount < 3 || emoCount < 3 || desireCount < 3 || objCount < 3) {
      audienceReasons.push(
        `Insuficiência no Deep Mode (Audience): Requer pelo menos 3+ dores funcionais, emocionais, desejos e objeções especificadas (encontrado: ${funcCount} func, ${emoCount} emo).`
      );
    }
  }

  gateResults.push({
    gateName: 'AudienceDepthValidator',
    passed: audienceReasons.length === 0,
    reasons: audienceReasons,
  });

  // 9. ProductDepthValidator
  const productReasons: string[] = [];
  if (!spec.product?.concept || !spec.product?.format) {
    productReasons.push('Conceito ou formato do produto não foram especificados.');
  }
  if (!spec.deliverables || spec.deliverables.length === 0) {
    productReasons.push('A lista de entregáveis do produto está vazia.');
  }

  gateResults.push({
    gateName: 'ProductDepthValidator',
    passed: productReasons.length === 0,
    reasons: productReasons,
  });

  // 10. DecisionLedgerDedupValidator
  const decisionReasons: string[] = [];
  if (!spec.decisions || spec.decisions.length === 0) {
    decisionReasons.push('Decision Ledger está vazio. O Escritório deve registrar as decisões fundamentais do projeto.');
  } else {
    const titles = spec.decisions.map((d) => d.title.toLowerCase().trim());
    const uniqueTitles = new Set(titles);
    if (titles.length - uniqueTitles.size > 2) {
      decisionReasons.push('Decision Ledger possui decisões duplicadas ou repetitivas entre múltiplos agentes.');
    }
  }

  gateResults.push({
    gateName: 'DecisionLedgerDedupValidator',
    passed: decisionReasons.length === 0,
    reasons: decisionReasons,
  });

  // Calculate Overall
  const failedGateNames = gateResults.filter((g) => !g.passed).map((g) => g.gateName);
  const overallPassed = failedGateNames.length === 0;

  let correctionInstructions: string | undefined = undefined;
  if (!overallPassed) {
    correctionInstructions = `ALERTA DE QUALITY GATES (CORREÇÃO OBRIGATÓRIA):\n${gateResults
      .filter((g) => !g.passed)
      .map((g) => `- [${g.gateName}] ${g.reasons.join(' ')}`)
      .join('\n')}`;
  }

  return {
    overallPassed,
    gateResults,
    failedGateNames,
    correctionInstructions,
    transformationMatrix,
  };
}
