import { StructuredKnowledgeFicha, KnowledgeCategory, KnowledgeType } from './types';

/**
 * Extracts structured Knowledge Ficha (summary, when to use, risks, prerequisites, concepts)
 */
export function generateKnowledgeFicha(
  title: string,
  content: string,
  category: KnowledgeCategory,
  knowledgeType: KnowledgeType
): StructuredKnowledgeFicha {
  const preview = content.slice(0, 1500);

  // Extract headings as key concepts
  const headingMatches = content.match(/^#{1,3}\s+(.+)$/gm);
  const keyConcepts = headingMatches
    ? headingMatches.map((h) => h.replace(/^#{1,3}\s+/, '').trim()).slice(0, 8)
    : [title, category, knowledgeType];

  const suggestedTags: string[] = [category.toLowerCase().replace(/\s+/g, '-'), knowledgeType.toLowerCase()];

  // Auto-detect common terms
  if (/1-1-100|escala baiana/i.test(content)) suggestedTags.push('escala-baiana', '1-1-100');
  if (/1-1-1/i.test(content)) suggestedTags.push('1-1-1');
  if (/order bump/i.test(content)) suggestedTags.push('order-bump');
  if (/meta ads|facebook ads/i.test(content)) suggestedTags.push('meta-ads');
  if (/faceless/i.test(content)) suggestedTags.push('faceless');

  return {
    summary: `Documento de ${knowledgeType} sobre ${title} na categoria ${category}. ${preview.slice(0, 250)}...`,
    when_to_use: `Utilize este ${knowledgeType.toLowerCase()} quando precisar de orientação sobre ${title} em campanhas de ${category}.`,
    when_not_to_use: `Não aplicar se o contexto de mercado ou modelo de negócio for incompatível com ${category}.`,
    prerequisites: `Conhecimento prévio das métricas de ${category} e estrutura do Offer Miner.`,
    risks: `Verifique se o orçamento e o volume de criativos são adequados antes da execução.`,
    key_concepts: keyConcepts,
    suggested_tags: suggestedTags,
  };
}
