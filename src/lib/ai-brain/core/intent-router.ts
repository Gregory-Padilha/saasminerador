import { StrategicIntent } from './types';

/**
 * Classifies user prompt into strategic intent
 */
export function detectStrategicIntent(userPrompt: string): StrategicIntent {
  const text = userPrompt.toLowerCase().trim();

  if (
    text.includes('modelar') ||
    text.includes('como você modelaria') ||
    text.includes('como modelar') ||
    text.includes('plano de modelagem') ||
    text.includes('se você fosse modelar') ||
    text.includes('criar algo parecido') ||
    text.includes('sem copiar')
  ) {
    return 'MODEL';
  }

  if (
    text.includes('encontrar ofertas') ||
    text.includes('achar uma oferta') ||
    text.includes('oferta para testar') ||
    text.includes('ofertas que eu poderia modelar') ||
    text.includes('oportunidades pouco exploradas') ||
    text.includes('procure ofertas') ||
    text.includes('me mostre oportunidades') ||
    text.includes('faceless simples') ||
    text.includes('oferta nova')
  ) {
    return 'DISCOVER';
  }

  if (
    text.includes('comparar') ||
    text.includes('compare') ||
    text.includes('qual dessas três') ||
    text.includes('diferença entre')
  ) {
    return 'COMPARE';
  }

  if (
    text.includes('anúncios') ||
    text.includes('criativos') ||
    text.includes('hooks') ||
    text.includes('ganchos') ||
    text.includes('vídeos')
  ) {
    return 'RESEARCH_CREATIVE';
  }

  if (
    text.includes('order bump') ||
    text.includes('checkout') ||
    text.includes('pricing') ||
    text.includes('preço') ||
    text.includes('monetização') ||
    text.includes('monetizar')
  ) {
    return 'RESEARCH_MONETIZATION';
  }

  if (
    text.includes('nicho') ||
    text.includes('educação') ||
    text.includes('saúde') ||
    text.includes('faceless')
  ) {
    return 'EXPLORE_NICHE';
  }

  if (
    text.includes('analise') ||
    text.includes('diagnóstico') ||
    text.includes('profundo') ||
    text.includes('por que essa oferta está escalando') ||
    text.includes('merece um deep dive')
  ) {
    return 'ANALYZE';
  }

  return 'GENERAL';
}
