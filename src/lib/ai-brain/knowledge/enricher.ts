import { KnowledgeCategory, KnowledgeType, SourceType } from './types';

export interface EnrichInput {
  rawContent: string;
  sourceType: SourceType;
  originalTitle: string;
  userCategory?: KnowledgeCategory;
  userType?: KnowledgeType;
  userTags?: string[];
  sourceUrl?: string;
  sourceAuthor?: string;
}

export interface EnrichedMetadata {
  title: string;
  originalTitle: string;
  description: string;
  category: KnowledgeCategory;
  knowledgeType: KnowledgeType;
  tags: string[];
  topics: string[];
  frameworksMentioned: string[];
  entities: string[];
  collections: string[];
  language: string;
}

/**
 * Heuristic and LLM enrichment engine
 */
export function enrichKnowledgeDocument(input: EnrichInput): EnrichedMetadata {
  const { rawContent, sourceType, originalTitle, userCategory, userType, userTags, sourceAuthor } = input;
  const contentLower = rawContent.toLowerCase();
  const titleLower = originalTitle.toLowerCase();

  // 1. Title Normalization & Bibliographic Auto-Naming
  let title = originalTitle.trim();
  const isRawFilename = /\.(pdf|docx|txt|md|csv|json)$/i.test(title) || /^(aula|video|doc|file|raw|anota[cç][aã]o)[_\-\s0-9]/i.test(title);

  // Clean raw file extensions and generic video titles
  title = title.replace(/\.(pdf|docx|txt|md|csv|json)$/i, '').replace(/[-_]+/g, ' ');

  if (/1-1-100|escala baiana/i.test(contentLower) || /1-1-100/i.test(titleLower)) {
    title = isRawFilename || title.length < 10 || titleLower.startsWith('video') ? 'Escala 1-1-100 — Estrutura e Aplicação' : title;
  } else if (/order bump/i.test(contentLower) || /bump/i.test(titleLower)) {
    title = isRawFilename || title.length < 10 || titleLower.startsWith('video') ? 'Estratégia de Order Bumps e Maximização de AOV' : title;
  } else if (/copywriting|copy|vsl|headline/i.test(contentLower)) {
    title = isRawFilename || title.length < 10 || titleLower.startsWith('video') ? 'Frameworks de Copywriting e Ângulos de Vendas' : title;
  } else if (/faceless|reels|tiktok|anúncios|criativo/i.test(contentLower)) {
    title = isRawFilename || title.length < 10 || titleLower.startsWith('video') ? 'Produção e Teste de Criativos de Alto Desempenho' : title;
  } else if (title.toLowerCase().startsWith('video') || title.length < 4) {
    const firstWords = rawContent
      .slice(0, 100)
      .replace(/[^\w\sÀ-ÿ]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .join(' ');
    title = firstWords ? `Documento sobre ${firstWords}` : 'Conhecimento Estruturado Offer Miner';
  }

  // Capitalize title properly
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // 2. Category Detection
  let category: KnowledgeCategory = userCategory || 'OUTROS';

  if (!userCategory || userCategory === 'OUTROS') {
    if (/1-1-100|escala|cbo|budget|meta ads|tráfego/i.test(contentLower)) {
      category = 'TRÁFEGO & ESCALA';
    } else if (/copy|headline|vsl|promessa|mecanismo|gancho/i.test(contentLower)) {
      category = 'COPY & POSICIONAMENTO';
    } else if (/criativo|faceless|roteiro|vídeo 9:16|imagem/i.test(contentLower)) {
      category = 'CRIATIVOS';
    } else if (/landing page|lp|hero section|página de vendas/i.test(contentLower)) {
      category = 'LANDING PAGES';
    } else if (/order bump|upsell|funil|aov|ticket/i.test(contentLower)) {
      category = 'FUNIS & MONETIZAÇÃO';
    } else if (/mineração|espionagem|pesquisa|concorrente/i.test(contentLower)) {
      category = 'PESQUISA & MINERAÇÃO';
    } else if (/estudo de caso|case|resultado|desafio/i.test(contentLower)) {
      category = 'ESTUDOS DE CASO';
    } else if (/framework|metodologia|passo a passo/i.test(contentLower)) {
      category = 'FRAMEWORKS';
    } else if (/produto|ebook|checkout|oferta/i.test(contentLower)) {
      category = 'OFERTAS & PRODUTO';
    }
  }

  // 3. Knowledge Type Detection
  let knowledgeType: KnowledgeType = userType || 'PLAYBOOK';

  if (!userType) {
    if (sourceType === 'VIDEO') {
      knowledgeType = 'TRANSCRIÇÃO';
    } else if (/sop|instrução|checklist/i.test(contentLower)) {
      knowledgeType = 'SOP';
    } else if (/estudo de caso|case/i.test(contentLower)) {
      knowledgeType = 'ESTUDO DE CASO';
    } else if (/framework|método/i.test(contentLower)) {
      knowledgeType = 'FRAMEWORK';
    }
  }

  // 4. Automatic Tagging
  const tagsSet = new Set<string>();

  if (userTags && userTags.length > 0) {
    userTags.forEach((t) => tagsSet.add(t.trim()));
  }

  tagsSet.add(category);
  tagsSet.add(knowledgeType);

  if (/1-1-100/i.test(contentLower)) tagsSet.add('1-1-100');
  if (/escala baiana/i.test(contentLower)) tagsSet.add('Escala Baiana');
  if (/meta ads|facebook ads/i.test(contentLower)) tagsSet.add('Meta Ads');
  if (/tiktok/i.test(contentLower)) tagsSet.add('TikTok');
  if (/order bump/i.test(contentLower)) tagsSet.add('Order Bumps');
  if (/cbo/i.test(contentLower)) tagsSet.add('CBO');
  if (/low ticket|low-ticket/i.test(contentLower)) tagsSet.add('Low Ticket');
  if (/faceless/i.test(contentLower)) tagsSet.add('Faceless');

  const tags = Array.from(tagsSet);

  // 5. Collections Assignment
  const collectionsSet = new Set<string>();
  collectionsSet.add(category);

  if (tags.includes('Meta Ads') || tags.includes('CBO') || tags.includes('1-1-100')) {
    collectionsSet.add('Tráfego & Escala');
  }
  if (tags.includes('Order Bumps') || tags.includes('Low Ticket')) {
    collectionsSet.add('Offer Modeling');
  }
  if (category === 'COPY & POSICIONAMENTO') {
    collectionsSet.add('Copy');
  }
  if (category === 'CRIATIVOS') {
    collectionsSet.add('Criativos');
  }

  const collections = Array.from(collectionsSet);

  // 6. Topics & Frameworks
  const frameworksMentioned: string[] = [];
  if (/1-1-100/i.test(contentLower)) frameworksMentioned.push('Escala 1-1-100');
  if (/escala baiana/i.test(contentLower)) frameworksMentioned.push('Escala Baiana');
  if (/365/i.test(contentLower)) frameworksMentioned.push('Volume Ancoragem');

  const topics: string[] = Array.from(tagsSet).slice(0, 6);
  const entities: string[] = sourceAuthor ? [sourceAuthor] : [];

  const description = `Documento de ${knowledgeType} sobre ${title} classificado em ${category}. Contém orientações e acervo de consulta para o Offer Miner.`;

  return {
    title,
    originalTitle,
    description,
    category,
    knowledgeType,
    tags,
    topics,
    frameworksMentioned,
    entities,
    collections,
    language: 'pt-BR',
  };
}
