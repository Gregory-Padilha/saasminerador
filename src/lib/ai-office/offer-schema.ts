/**
 * Offer Intelligence Office - Full Offer Specification Contract & Validator
 * Represents the complete 26-point offer package produced by the Office.
 */

export interface OfferAlternativeName {
  name: string;
  concept: string;
  rationale: string;
  riskOfMisinterpretation?: string;
}

export interface OfferAudiencePainPoints {
  functional?: string[];
  emotional?: string[];
  practical?: string[];
  identity?: string[];
}

export interface OfferJobToBeDone {
  job: string;
  rationale: string;
}

export interface OfferDeliverableItem {
  name: string;
  contents: string;
  purpose: string;
  problemSolved: string;
  deliveryMethod: string;
  inclusionRationale: string;
}

export interface OfferBonusItem {
  name: string;
  concept: string;
  objectionReduced: string;
  usageAccelerated: string;
  valueAnchor?: string;
}

export interface OfferOrderBumpItem {
  name: string;
  concept: string;
  complementaryWhy: string;
  proposedPrice: string;
  risk?: string;
}

export interface CreativeAngleTerritory {
  angle: string;
  audiencePain: string;
  hookExamples: string[];
  visualMechanism: string;
  format: string;
  proof: string;
  ctaDirection: string;
  whyItMayWork: string;
}

export interface CreativeConceptItem {
  conceptName: string;
  format: string;
  hookText: string;
  bodyConcept: string;
  ctaText: string;
}

export interface LandingPageSectionBlueprint {
  sectionNumber: string;
  name: string;
  purpose: string;
  message: string;
  content: string;
  proofNeeded: string;
  ctaIfAny?: string;
}

export interface ValidationTestMatrixItem {
  testName: string;
  hypothesis: string;
  variable: string;
  setup: string;
  successSignal: string;
  failureSignal: string;
  learningObjective: string;
}

export interface OfferFailureMode {
  failureMode: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mitigation: string;
}

export interface OfferDecisionRecord {
  id: string;
  decisionType: string;
  title: string;
  value: any;
  rationale: string;
  evidenceRefs: string[];
  alternativesConsidered: string[];
  uncertainty?: 'FORTE EVIDÊNCIA' | 'EVIDÊNCIA MODERADA' | 'EVIDÊNCIA LIMITADA' | 'HIPÓTESE DE TESTE';
  status: 'PROPOSED' | 'APPROVED' | 'HUMAN_OVERRIDE' | 'TESTING' | 'VALIDATED' | 'REJECTED';
}

export interface CompleteOfferProjectSpec {
  sourceOffer?: {
    id?: string;
    name?: string;
  };
  transformationSummary?: {
    changesUsed: number;
    maxChanges: number;
    lockedDimensions: string[];
  };
  transformationMatrix?: Array<{
    dimension: string;
    status: 'PRESERVED' | 'CHANGED' | 'ADAPTED' | 'LOCKED';
    sourceValue: string;
    modelValue: string;
  }>;

  // A. Identity
  identity: {
    recommendedName: string;
    alternativeNames: OfferAlternativeName[];
    tag: string;
  };

  // B. Opportunity
  opportunity: {
    thesis: string;
    detectedPatterns: string[];
    marketGap: string;
    whyTestable: string;
  };

  // C. Market
  market: {
    niche: string;
    subniche: string;
    marketCountry: string;
    scalePotential: string;
  };

  // D. Audience
  audience: {
    primaryAudience: string;
    secondaryAudience: string;
    context: string;
    painPoints: OfferAudiencePainPoints;
    desires: string[];
    frustrations: string[];
    objections: string[];
    buyingTriggers: string[];
    languagePatterns: string[];
    currentAlternatives: string[];
    jobsToBeDone: OfferJobToBeDone[];
  };

  // E. Positioning
  positioning: {
    category: string;
    subcategory: string;
    counterPositioning: string;
    differentiation: string;
    positioningStatement: string;
  };

  // F. Big Idea
  bigIdea: {
    idea: string;
    angle: string;
    hookTerritory: string;
  };

  // G. Promise
  promise: {
    corePromise: string;
    secondaryPromises: string[];
    claimsBoundary: string;
  };

  // H. Mechanism
  mechanism: {
    name: string;
    explanation: string;
    deliveryOfValue: string;
    differentiation: string;
  };

  // I. Product
  product: {
    concept: string;
    type: string;
    format: string;
    delivery: string;
    usage: string;
    organization: string;
    estimatedScope: string;
    productionComplexity: 'BAIXA' | 'MÉDIA' | 'ALTA';
    faceless: boolean;
    repeatUsage: boolean;
    timeToConsume: string;
  };

  // J. Deliverables
  deliverables: OfferDeliverableItem[];

  // K. Value Architecture & Bonuses
  valueArchitecture: {
    coreProduct: string;
    supportMaterials: string[];
    bonuses: OfferBonusItem[];
    bumps: OfferOrderBumpItem[];
    futureUpsell?: string;
  };

  // L. Pricing
  pricing: {
    observedRange: string;
    frontHypothesis: string;
    anchorPrice: string;
    testPrice: string;
    rationale: string;
    alternativesConsidered: string[];
  };

  // M. Monetization
  monetization: {
    flow: string;
    orderBumps: OfferOrderBumpItem[];
    futureUpsell: string;
  };

  // N. Creative Strategy
  creativeStrategy: {
    angleTerritories: CreativeAngleTerritory[];
    firstCreativeConcepts: CreativeConceptItem[];
  };

  // O. Copy Strategy
  copyStrategy: {
    coreMessage: string;
    headlineDirections: string[];
    subheadlineDirection: string;
    mainObjections: string[];
    proofStrategy: string;
    ctaConcept: string;
  };

  // P. Landing Page Blueprint
  landingPageBlueprint: {
    heroHeadline: string;
    heroSubheadline: string;
    sections: LandingPageSectionBlueprint[];
  };

  // Q. Checkout
  checkout: {
    front: string;
    plans: string[];
    bumps: string[];
    paymentStructure: string;
    frictionConsiderations: string[];
  };

  // R. Validation Plan
  validationPlan: {
    testMatrix: ValidationTestMatrixItem[];
  };

  // S. Failure Modes / Risks
  risks: OfferFailureMode[];

  // T. References & Discarded Finalists
  referenceIntelligence: { offerName: string; copiedAspect: string; rationale: string }[];
  discardedFinalists: { thesisName: string; rejectionReason: string }[];

  // U. Decision Ledger
  decisions: OfferDecisionRecord[];
}

/**
 * Completeness Gate: Verifies all mandatory sections before completing mission
 */
export function validateOfferCompleteness(spec: Partial<CompleteOfferProjectSpec>): {
  isComplete: boolean;
  missingSections: string[];
} {
  const missing: string[] = [];

  if (!spec.identity?.recommendedName) missing.push('Identity / Recommended Name');
  if (!spec.opportunity?.thesis) missing.push('Opportunity Thesis');
  if (!spec.audience?.primaryAudience) missing.push('Audience / Primary Audience');
  if (!spec.positioning?.positioningStatement) missing.push('Positioning Statement');
  if (!spec.bigIdea?.idea) missing.push('Big Idea');
  if (!spec.promise?.corePromise) missing.push('Core Promise');
  if (!spec.mechanism?.name) missing.push('Mechanism');
  if (!spec.product?.concept) missing.push('Product Concept');
  if (!spec.deliverables || spec.deliverables.length === 0) missing.push('Deliverables');
  if (!spec.pricing?.testPrice) missing.push('Pricing / Test Price');
  if (!spec.creativeStrategy?.angleTerritories || spec.creativeStrategy.angleTerritories.length === 0)
    missing.push('Creative Strategy');
  if (!spec.landingPageBlueprint?.sections || spec.landingPageBlueprint.sections.length === 0)
    missing.push('Landing Page Blueprint');
  if (!spec.validationPlan?.testMatrix || spec.validationPlan.testMatrix.length === 0)
    missing.push('Validation Plan');

  return {
    isComplete: missing.length === 0,
    missingSections: missing,
  };
}
