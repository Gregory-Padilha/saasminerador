export interface CaseCandidateOffer {
  id: string;
  name: string;
  niche?: string;
  activeAdsCount?: number;
  perceivedPrice?: string;
  longevityDays?: number;
  summary?: string;
  relevanceScore?: number;
}

export interface CaseEvidenceItem {
  id: string;
  type: 'offer_data' | 'ad_creative' | 'landing_page' | 'checkout' | 'knowledge' | 'memory';
  title: string;
  summary: string;
  sourceRef: string;
}

export interface CaseContradiction {
  id: string;
  title: string;
  description: string;
  competingHypotheses: string[];
  resolvedByHead?: string;
  resolutionNote?: string;
}

export interface CaseDecisionEntry {
  id: string;
  decisionType: 'POSITIONING' | 'AVATAR' | 'ANGLE' | 'PRODUCT_FORMAT' | 'MECHANISM' | 'PRICING' | 'ORDER_BUMP' | 'CREATIVE_HOOK' | 'LP_STRUCTURE' | 'TEST_VARIABLE';
  title: string;
  value: any;
  rationale: string;
  evidenceRefs: string[];
  alternativesConsidered: string[];
  status: 'OBSERVED' | 'INFERRED' | 'HYPOTHESIS' | 'APPROVED' | 'TESTING' | 'VALIDATED' | 'REJECTED';
  sourceAgent: string;
}

export interface OfficeCaseFile {
  id: string;
  missionId: string;
  mode: 'MODEL_EXISTING_OFFER' | 'CREATE_FROM_ZERO';
  goal: string;
  constraints: {
    maxFrontPrice?: number;
    facelessOnly?: boolean;
    quickProductionOnly?: boolean;
    targetNiches?: string[];
    avoidNiches?: string[];
    marketCountry?: string;
  };
  missionConstraints?: any;
  candidateUniverse: CaseCandidateOffer[];
  shortlistOffers: CaseCandidateOffer[];
  evidenceList: CaseEvidenceItem[];
  contradictions: CaseContradiction[];
  opportunityHypotheses: { id: string; title: string; rationale: string; rejected?: boolean; rejectionReason?: string }[];

  // Department Deliverables
  marketFindings?: {
    marketSignals?: string[];
    targetAudienceSummary?: any;
    auditorWarnings?: string[];
    acceptedShortlist?: CaseCandidateOffer[];
  };

  offerFindings?: {
    offerDnaSummary?: any;
    productBlueprint?: any;
    pricingArchitecture?: any;
  };

  gtmFindings?: {
    creativeSystem?: any;
    lpBlueprint?: any;
    validationPlan?: any;
  };

  decisionLedger: CaseDecisionEntry[];
  risksAndUnknowns: string[];
  openQuestions: string[];
  updatedAt: string;
}

export function createEmptyCaseFile(
  missionId: string,
  mode: 'MODEL_EXISTING_OFFER' | 'CREATE_FROM_ZERO',
  goal: string
): OfficeCaseFile {
  return {
    id: `case_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    missionId,
    mode,
    goal,
    constraints: {},
    candidateUniverse: [],
    shortlistOffers: [],
    evidenceList: [],
    contradictions: [],
    opportunityHypotheses: [],
    decisionLedger: [],
    risksAndUnknowns: [],
    openQuestions: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reduces agent deliverable output into Case File entities (Evidences, Decisions, Contradictions, Risks)
 */
export function reduceDeliverableIntoCaseFile(
  caseFile: OfficeCaseFile,
  roleId: string,
  findings: any
): OfficeCaseFile {
  const updated = { ...caseFile };

  // 1. Evidence List Reduction
  if (findings?.evidenceRefs && Array.isArray(findings.evidenceRefs)) {
    findings.evidenceRefs.forEach((ref: any, idx: number) => {
      const refStr = typeof ref === 'string' ? ref : ref.title || ref.name || 'Evidência de Mercado';
      const evId = `ev_${roleId}_${Date.now()}_${idx}`;
      if (!updated.evidenceList.some((e) => e.sourceRef === refStr)) {
        updated.evidenceList.push({
          id: evId,
          type: 'offer_data',
          title: `Evidência [${roleId}]: ${refStr}`,
          summary: findings.summary || `Padrão observado durante execução de ${roleId}`,
          sourceRef: refStr,
        });
      }
    });
  }

  // 2. Decision Ledger Reduction
  if (findings?.decisions && Array.isArray(findings.decisions)) {
    findings.decisions.forEach((dec: any, idx: number) => {
      const decId = `dec_${roleId}_${Date.now()}_${idx}`;
      updated.decisionLedger.push({
        id: decId,
        decisionType: dec.decisionType || 'POSITIONING',
        title: dec.title || `Decisão de ${roleId}`,
        value: dec.value || dec.summary || 'Aprovado',
        rationale: dec.rationale || findings.summary || 'Com base nas evidências levantadas',
        evidenceRefs: dec.evidenceRefs || findings.evidenceRefs || [],
        alternativesConsidered: dec.alternativesConsidered || [],
        status: 'APPROVED',
        sourceAgent: roleId,
      });
    });
  } else if (findings?.recommendations && Array.isArray(findings.recommendations)) {
    findings.recommendations.forEach((rec: any, idx: number) => {
      const recStr = typeof rec === 'string' ? rec : rec.title || rec.recommendation;
      if (recStr) {
        updated.decisionLedger.push({
          id: `dec_${roleId}_rec_${Date.now()}_${idx}`,
          decisionType: 'POSITIONING',
          title: `Recomendação [${roleId}]`,
          value: recStr,
          rationale: findings.summary || 'Proposto pelo agente',
          evidenceRefs: findings.evidenceRefs || [],
          alternativesConsidered: [],
          status: 'APPROVED',
          sourceAgent: roleId,
        });
      }
    });
  }

  // 3. Contradictions Reduction
  if (findings?.contradictions && Array.isArray(findings.contradictions)) {
    findings.contradictions.forEach((c: any, idx: number) => {
      const cStr = typeof c === 'string' ? c : c.title || c.description;
      if (cStr && !updated.contradictions.some((existing) => existing.title === cStr)) {
        updated.contradictions.push({
          id: `contra_${roleId}_${Date.now()}_${idx}`,
          title: cStr,
          description: typeof c === 'object' ? c.description || cStr : cStr,
          competingHypotheses: typeof c === 'object' ? c.competingHypotheses || [] : [],
        });
      }
    });
  }

  // 4. Risks & Unknowns
  if (findings?.risks && Array.isArray(findings.risks)) {
    findings.risks.forEach((r: any) => {
      const rStr = typeof r === 'string' ? r : r.description || r.risk;
      if (rStr && !updated.risksAndUnknowns.includes(rStr)) {
        updated.risksAndUnknowns.push(rStr);
      }
    });
  }

  updated.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Build thin, agent-tailored context slice to avoid token bloat
 */
export function buildAgentContextSlice(caseFile: OfficeCaseFile, agentRole: string): string {
  const summaryBlock = `
=== MISSÃO & CASE FILE ===
ID da Missão: ${caseFile.missionId}
Modo: ${caseFile.mode}
Objetivo: ${caseFile.goal}
Restrições: ${JSON.stringify(caseFile.constraints)}
Shortlist de Ofertas: ${caseFile.shortlistOffers.map((c) => c.name).join(', ') || 'Nenhuma fixada'}
Evidências Registradas: ${caseFile.evidenceList.length} itens
Decisões Registradas no Case File: ${caseFile.decisionLedger.length} registros
`;

  // Specific slice based on role
  if (agentRole.includes('market') || agentRole.includes('audience') || agentRole.includes('auditor')) {
    return `${summaryBlock}
=== DADOS DE MERCADO & HIPÓTESES ===
Candidatas Universo (${caseFile.candidateUniverse.length}):
${JSON.stringify(caseFile.candidateUniverse.slice(0, 10))}

Hipóteses de Oportunidade:
${JSON.stringify(caseFile.opportunityHypotheses)}

Contradições Abertas:
${JSON.stringify(caseFile.contradictions)}
`;
  }

  if (agentRole.includes('offer') || agentRole.includes('product') || agentRole.includes('pricing')) {
    return `${summaryBlock}
=== DEPARTAMENTO DE MERCADO (INPUT) ===
Achados do Mercado:
${JSON.stringify(caseFile.marketFindings || {})}

Shortlist Aprovada:
${JSON.stringify(caseFile.shortlistOffers)}
`;
  }

  if (agentRole.includes('gtm') || agentRole.includes('creative') || agentRole.includes('copy') || agentRole.includes('validation')) {
    return `${summaryBlock}
=== DEPARTAMENTO DE OFERTA (INPUT) ===
Achados da Arquitetura de Oferta:
${JSON.stringify(caseFile.offerFindings || {})}
`;
  }

  // Director gets full consolidated case file
  return `${summaryBlock}
=== VISÃO CONSOLIDADA DOS DEPARTAMENTOS ===
Mercado: ${JSON.stringify(caseFile.marketFindings || {})}
Oferta: ${JSON.stringify(caseFile.offerFindings || {})}
GTM: ${JSON.stringify(caseFile.gtmFindings || {})}
Contradições: ${JSON.stringify(caseFile.contradictions)}
Decision Ledger: ${JSON.stringify(caseFile.decisionLedger)}
Riscos: ${JSON.stringify(caseFile.risksAndUnknowns)}
`;
}
