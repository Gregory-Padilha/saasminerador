// ==============================================================================
// OFFER MINER - ROBUST COLUMN ALIAS DICTIONARY & NORMALIZER (CONFIDENCE SCORED)
// ==============================================================================

export interface ColumnDefinition {
  key: string;
  label: string;
  required?: boolean;
  description: string;
  aliases: string[];
}

export const SYSTEM_COLUMNS: ColumnDefinition[] = [
  {
    key: 'product_name',
    label: 'Produto',
    required: true,
    description: 'Título ou nome da oferta / infoproduto',
    aliases: [
      'produto',
      'nome',
      'oferta',
      'nome produto',
      'nome do produto',
      'nome_do_produto',
      'nome oferta',
      'nome da oferta',
      'nome_da_oferta',
      'produto principal',
      'oferta analisada',
      'nome infoproduto',
      'nome_infoproduto',
      'infoproduto',
      'titulo',
      'título',
      'titulo do produto',
      'título do produto',
      'product name',
      'product_name',
      'offer name',
      'offer_name',
      'product',
      'offer',
      'title',
      'item',
    ],
  },
  {
    key: 'niche',
    label: 'Nicho',
    description: 'Grande mercado (ex: Gastronomia, Educação, Saúde, etc.)',
    aliases: [
      'nicho',
      'categoria',
      'mercado',
      'nicho principal',
      'macro nicho',
      'macro_nicho',
      'macronicho',
      'segmento',
      'niche',
      'category',
      'market',
    ],
  },
  {
    key: 'subniche',
    label: 'Subnicho',
    description: 'Subsegmento específico (ex: Airfryer, Alfabetização, etc.)',
    aliases: [
      'subnicho',
      'sub nicho',
      'sub_nicho',
      'sub-nicho',
      'subcategoria',
      'micro nicho',
      'micro_nicho',
      'micronicho',
      'sub categoria',
      'sub_categoria',
      'subsegmento',
      'subniche',
      'sub_niche',
      'subcategory',
    ],
  },
  {
    key: 'product_type',
    label: 'Tipo de Produto',
    description: 'Formato de entrega (ex: Ebook, Printable, Mega Pack, Planner, etc.)',
    aliases: [
      'tipo de produto',
      'tipo_de_produto',
      'tipo do produto',
      'tipo_do_produto',
      'tipo produto',
      'tipo_produto',
      'tipo',
      'modelo de produto',
      'formato do produto',
      'product type',
      'product_type',
      'deliverable type',
    ],
  },
  {
    key: 'advertiser',
    label: 'Anunciante',
    description: 'Página ou empresa que está veiculando o anúncio',
    aliases: [
      'anunciante',
      'nome anunciante',
      'nome do anunciante',
      'nome_do_anunciante',
      'nome_anunciante',
      'pagina anunciante',
      'pagina do anunciante',
      'página do anunciante',
      'página anunciante',
      'anunciante meta',
      'anunciante_meta',
      'nome da pagina',
      'nome_da_pagina',
      'nome da página',
      'nome_da_página',
      'pagina',
      'página',
      'page name',
      'page_name',
      'page',
      'perfil',
      'advertiser',
      'advertiser name',
      'advertiser_name',
      'fanpage',
    ],
  },
  {
    key: 'price',
    label: 'Preço Front-End',
    description: 'Valor de venda do produto em reais',
    aliases: [
      'preco',
      'preço',
      'valor',
      'ticket',
      'ticket entrada',
      'ticket de entrada',
      'preco frontend',
      'preco front end',
      'preco front-end',
      'preço front end',
      'preço front-end',
      'preco_front_end',
      'preço_front_end',
      'valor frontend',
      'valor front end',
      'valor_front_end',
      'preco do produto',
      'preço do produto',
      'preco principal',
      'preço principal',
      'front end',
      'front-end',
      'front_end',
      'preco de venda',
      'preço de venda',
      'preco_de_venda',
      'preço_de_venda',
      'valor do produto',
      'valor_do_produto',
      'preco produto',
      'preço produto',
      'ticket medio',
      'ticket médio',
      'price',
      'front end price',
      'frontend_price',
      'ticket price',
    ],
  },
  {
    key: 'active_ads_count',
    label: 'Ads Ativos',
    description: 'Quantidade de criativos ativos na Meta Ads Library',
    aliases: [
      'ads',
      'ads ativos',
      'ads_ativos',
      'anuncios',
      'anúncios',
      'anuncios ativos',
      'anúncios ativos',
      'anuncios_ativos',
      'anúncios_ativos',
      'quantidade anuncios',
      'quantidade anúncios',
      'quantidade de anuncios',
      'quantidade de anúncios',
      'quantidade_de_anuncios',
      'quantidade_de_anúncios',
      'quantidade anuncios ativos',
      'quantidade anúncios ativos',
      'quantidade de anuncios ativos',
      'quantidade de anúncios ativos',
      'numero de anuncios',
      'numero de anúncios',
      'número de anúncios',
      'numero anuncios',
      'qtd anuncios ativos',
      'qtd anúncios ativos',
      'qtd de anuncios',
      'qtd de anúncios',
      'qtd anuncios',
      'qtd anúncios',
      'qtd_anuncios',
      'qtd_anúncios',
      'total ads',
      'total_ads',
      'active ads count',
      'active_ads_count',
      'active ads',
      'active_ads',
      'ads count',
      'ads_count',
      'running ads',
    ],
  },
  {
    key: 'days_running',
    label: 'Dias Rodando',
    description: 'Idade da oferta / dias em veiculação contínua',
    aliases: [
      'dias',
      'dias rodando',
      'dias_rodando',
      'dias no ar',
      'dias_no_ar',
      'tempo rodando',
      'tempo_rodando',
      'tempo no ar',
      'tempo_no_ar',
      'idade da oferta',
      'idade_da_oferta',
      'idade oferta',
      'dias ativos',
      'dias_ativos',
      'tempo ativo',
      'tempo_ativo',
      'days running',
      'days_running',
      'days active',
      'days_active',
      'running days',
      'running_days',
      'offer age',
    ],
  },
  {
    key: 'oldest_ad_date',
    label: 'Data do 1º Anúncio',
    description: 'Data em que o criativo mais antigo começou a rodar',
    aliases: [
      'primeiro anuncio',
      'primeiro anúncio',
      'data primeiro anuncio',
      'data primeiro anúncio',
      'data do primeiro anuncio',
      'data do primeiro anúncio',
      'data_primeiro_anuncio',
      'data_primeiro_anúncio',
      'anuncio mais antigo',
      'anúncio mais antigo',
      'data anuncio mais antigo',
      'data anúncio mais antigo',
      'data do anuncio mais antigo',
      'data do anúncio mais antigo',
      'data_do_anuncio_mais_antigo',
      'data_do_anúncio_mais_antigo',
      'data_anuncio_mais_antigo',
      'data_anúncio_mais_antigo',
      'data 1º anuncio',
      'data 1º anúncio',
      'data 1o anuncio',
      'data 1o anúncio',
      'data de inicio',
      'data de início',
      'data_de_inicio',
      'data_de_início',
      'data inicio',
      'data início',
      'data_inicio',
      'data_início',
      'oldest ad date',
      'oldest_ad_date',
      'first ad date',
      'first_ad_date',
      'start date',
      'start_date',
    ],
  },
  {
    key: 'faceless',
    label: 'Faceless (Sem Rosto)',
    description: 'Indica se a oferta roda sem influenciador / especialista',
    aliases: [
      'faceless',
      'sem rosto',
      'sem_rosto',
      'sem-rosto',
      'criterio faceless',
      'critério faceless',
      'criterio faceless sem rosto',
      'critério faceless sem rosto',
      'produto faceless',
      'oferta faceless',
      'anonimo',
      'anônimo',
      'is faceless',
      'is_faceless',
    ],
  },
  {
    key: 'meta_ads_url',
    label: 'URL Meta Ads',
    description: 'Link direto para a biblioteca de anúncios da Meta',
    aliases: [
      'meta ads',
      'meta_ads',
      'biblioteca',
      'biblioteca anuncios',
      'biblioteca anúncios',
      'biblioteca de anuncios',
      'biblioteca de anúncios',
      'biblioteca_de_anuncios',
      'biblioteca_de_anúncios',
      'url biblioteca',
      'url_biblioteca',
      'url biblioteca anuncios',
      'url biblioteca anúncios',
      'url da biblioteca de anuncios',
      'url da biblioteca de anúncios',
      'meta ads url',
      'meta_ads_url',
      'link meta ads',
      'link_meta_ads',
      'url meta ads',
      'url_meta_ads',
      'link meta',
      'link_meta',
      'url meta',
      'url_meta',
      'link biblioteca de anuncios',
      'link biblioteca',
      'facebook ads',
      'facebook_ads',
      'ad library',
      'ad_library',
      'ads library',
      'ads_library',
    ],
  },
  {
    key: 'landing_page_url',
    label: 'Landing Page (LP)',
    description: 'Link direto para a página de vendas',
    aliases: [
      'lp',
      'landing',
      'landing page',
      'landing_page',
      'pagina vendas',
      'página vendas',
      'pagina de vendas',
      'página de vendas',
      'pagina_de_vendas',
      'página_de_vendas',
      'url lp',
      'url_lp',
      'url da lp',
      'url pagina vendas',
      'url página vendas',
      'url da pagina de vendas',
      'url da página de vendas',
      'url_pagina_de_vendas',
      'url_página_de_vendas',
      'link pagina vendas',
      'link página vendas',
      'link pagina de vendas',
      'link página de vendas',
      'link_pagina_de_vendas',
      'link_página_de_vendas',
      'landing page url',
      'landing_page_url',
      'link lp',
      'link_lp',
      'url da pagina',
      'url da página',
      'link da pagina',
      'link da página',
      'site da oferta',
      'sales page',
      'sales_page',
    ],
  },
  {
    key: 'landing_page_domain',
    label: 'Domínio da LP',
    description: 'Hostname/domínio da página de vendas (ex: produto.com)',
    aliases: [
      'dominio da landing page',
      'domínio da landing page',
      'dominio da lp',
      'domínio da lp',
      'dominio lp',
      'domínio lp',
      'dominio da pagina',
      'domínio da página',
      'dominio da pagina de vendas',
      'domínio da página de vendas',
      'dominio pagina de vendas',
      'domínio página de vendas',
      'dominio landing page',
      'domínio landing page',
      'dominio da oferta',
      'domínio da oferta',
      'dominio do produto',
      'domínio do produto',
      'lp domain',
      'landing page domain',
      'domain',
      'dominio',
      'domínio',
      'host',
      'hostname',
    ],
  },
  {
    key: 'checkout_url',
    label: 'URL do Checkout',
    description: 'Link direto para o checkout (Hotmart, Kiwify, etc.)',
    aliases: [
      'checkout',
      'checkout url',
      'checkout_url',
      'link checkout',
      'link do checkout',
      'url checkout',
      'url_checkout',
      'link de pagamento',
      'url pagamento',
    ],
  },
  {
    key: 'headline',
    label: 'Headline / Promessa',
    description: 'Promessa principal do criativo ou página de vendas',
    aliases: [
      'headline',
      'headline principal',
      'headline_principal',
      'promessa',
      'promessa principal',
      'titulo do anuncio',
      'título do anúncio',
      'titulo_do_anuncio',
      'título_do_anúncio',
      'big idea',
      'big_idea',
      'copy principal',
      'copy',
      'copia',
      'cópia',
      'texto principal',
      'texto_principal',
      'main headline',
      'main_headline',
      'hook headline',
    ],
  },
  {
    key: 'subheadline',
    label: 'Subheadline',
    description: 'Subtítulo complementar da oferta',
    aliases: [
      'subheadline',
      'sub headline',
      'sub_headline',
      'sub-headline',
      'subtitulo',
      'subtítulo',
      'sub titulo',
      'sub título',
    ],
  },
  {
    key: 'ad_format',
    label: 'Formato do Anúncio',
    description: 'Ex: Vídeo, Imagem estática, Carrossel, UGC',
    aliases: [
      'formato',
      'formato anuncio',
      'formato anúncio',
      'formato do anuncio',
      'formato do anúncio',
      'formato_do_anuncio',
      'formato_do_anúncio',
      'formato_anuncio',
      'formato_anúncio',
      'formato principal',
      'formato_principal',
      'tipo criativo',
      'tipo de criativo',
      'tipo de anuncio',
      'tipo de anúncio',
      'tipo_de_anuncio',
      'tipo_de_anúncio',
      'tipo_de_criativo',
      'formato de criativo',
      'formato criativo',
      'formato dos criativos',
      'formato_dos_criativos',
      'formato dos anuncios',
      'formato dos anúncios',
      'midia',
      'mídia',
      'ad format',
      'ad_format',
      'creative type',
      'creative_type',
      'media type',
    ],
  },
  {
    key: 'notes',
    label: 'Observações',
    description: 'Anotações contextuais sobre ângulo, bônus, funil',
    aliases: [
      'observacao',
      'observação',
      'observacoes',
      'observações',
      'observacao work',
      'observação work',
      'observacao_work',
      'observação_work',
      'observacoes work',
      'observações work',
      'nota',
      'notas',
      'comentario',
      'comentário',
      'comentarios',
      'comentários',
      'anotacoes',
      'anotações',
      'notes',
      'obs',
      'detalhes',
    ],
  },
  {
    key: 'estimated_unique_creatives',
    label: 'Criativos Distintos Estimados',
    description: 'Quantidade estimada de criativos/ângulos visuais distintos veiculados',
    aliases: [
      'criativos',
      'criativos unicos',
      'criativos únicos',
      'criativos_unicos',
      'criativos_únicos',
      'criativos diferentes',
      'criativos_diferentes',
      'criativos distintos',
      'criativos_distintos',
      'quantidade de criativos',
      'quantidade de criativos diferentes',
      'quantidade de criativos unicos',
      'quantidade de criativos únicos',
      'quantidade de criativos distintos',
      'criativos estimados',
      'criativos_estimados',
      'criativos unicos estimados',
      'criativos únicos estimados',
      'qtd criativos',
      'qtd criativos unicos',
      'qtd criativos únicos',
      'qtd criativos diferentes',
      'qtd_criativos',
      'numero de criativos',
      'número de criativos',
      'unique creatives',
      'unique_creatives',
      'estimated unique creatives',
      'estimated_unique_creatives',
      'unique creatives estimate',
      'unique_creatives_estimate',
    ],
  },
  {
    key: 'work_score',
    label: 'Nota do Work',
    description: 'Avaliação inicial vinda do minerador ChatGPT Work (0 a 10)',
    aliases: [
      'score',
      'nota',
      'nota validacao',
      'nota validação',
      'nota de validacao',
      'nota de validação',
      'nota_de_validacao',
      'nota_de_validação',
      'nota work',
      'nota_work',
      'nota do work',
      'nota_do_work',
      'nota minerador',
      'nota do minerador',
      'nota_minerador',
      'nota_do_minerador',
      'miner score',
      'miner_score',
      'nota gpt',
      'nota_gpt',
      'work score',
      'work_score',
      'score work',
      'rating',
      'avaliacao',
      'avaliação',
      'pontuacao',
      'pontuação',
    ],
  },
];

/**
 * Normalizes a column header string according to Rule 8:
 * - lowercase
 * - remove accents (NFD)
 * - replace \n, \r, _, - with space
 * - remove punctuation characters ()[]{}.,;:!?/*&%$#@~^"'\`
 * - collapse multiple spaces into one space
 * - trim
 */
export function normalizeHeader(header: string): string {
  if (!header) return '';
  return String(header)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[\r\n\t_-]+/g, ' ') // line breaks and underscores/dashes to space
    .replace(/[()[\]{}.,;:!?/*&%$#@~^"'\`\\]/g, '') // remove punctuation
    .replace(/\s+/g, ' ') // collapse spaces
    .trim();
}

export interface MatchResult {
  key: string | null;
  confidence: number;
  label: string;
}

/**
 * Matches a raw Excel column header against the alias dictionary with confidence score.
 * NEVER guesses blindly — returns confidence < 80 as unmapped (key: null).
 */
export function matchColumnWithConfidence(rawHeader: string): MatchResult {
  if (!rawHeader) {
    return { key: null, confidence: 0, label: 'Coluna Vazia' };
  }

  const norm = normalizeHeader(rawHeader);
  if (!norm) {
    return { key: null, confidence: 0, label: 'Coluna Vazia' };
  }

  // 1. Exact match on normalized header
  for (const col of SYSTEM_COLUMNS) {
    for (const alias of col.aliases) {
      const normAlias = normalizeHeader(alias);
      if (norm === normAlias) {
        return { key: col.key, confidence: 100, label: col.label };
      }
    }
  }

  // 2. High confidence substring / token match (e.g. "quantidade de anuncios ativos da oferta")
  const normWords = norm.split(' ').filter(Boolean);
  const isDomainHeader = normWords.includes('dominio') || normWords.includes('domain') || normWords.includes('host') || normWords.includes('hostname');
  const isUrlHeader = normWords.includes('url') || normWords.includes('link') || normWords.includes('site') || normWords.includes('pagina') || normWords.includes('sales');

  let bestMatch: { col: ColumnDefinition; confidence: number } | null = null;

  for (const col of SYSTEM_COLUMNS) {
    // Disambiguate landing_page_url vs landing_page_domain
    if (isDomainHeader && col.key === 'landing_page_url') {
      continue; // NEVER map a domain header to landing_page_url
    }
    if (!isDomainHeader && isUrlHeader && col.key === 'landing_page_domain') {
      continue; // Don't map explicit URL/link headers to landing_page_domain
    }

    for (const alias of col.aliases) {
      const normAlias = normalizeHeader(alias);
      const aliasWords = normAlias.split(' ').filter(Boolean);

      // Multi-word alias substring (e.g., "anuncios ativos" inside "quantidade de anuncios ativos da oferta")
      if (aliasWords.length >= 2 && norm.includes(normAlias)) {
        const ratio = normAlias.length / norm.length;
        const confidence = Math.round(85 + Math.min(10, ratio * 15));
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { col, confidence };
        }
      }

      // If all words of a multi-word alias (>=2 words) are present in header words
      if (aliasWords.length >= 2 && aliasWords.every((w) => normWords.includes(w))) {
        const confidence = 90;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { col, confidence };
        }
      }

      // For single word alias, require it to be a key distinctive word and not a common generic word like "tipo", "pagina"
      if (aliasWords.length === 1 && normWords.includes(normAlias)) {
        const genericShortWords = ['tipo', 'nome', 'link', 'url', 'data', 'nota', 'item', 'page', 'texto'];
        if (!genericShortWords.includes(normAlias) && normAlias.length >= 5) {
          // If the column has high relevance (e.g., "anuncios" inside "total anuncios")
          const ratio = normAlias.length / norm.length;
          if (ratio >= 0.4) {
            const confidence = 80;
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { col, confidence };
            }
          }
        }
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= 80) {
    return {
      key: bestMatch.col.key,
      confidence: bestMatch.confidence,
      label: bestMatch.col.label,
    };
  }

  return {
    key: null,
    confidence: bestMatch ? bestMatch.confidence : 0,
    label: 'Não mapeado',
  };
}

/**
 * Legacy wrapper for backward compatibility
 */
export function matchColumnAlias(rawHeader: string): string | null {
  const result = matchColumnWithConfidence(rawHeader);
  return result.key;
}

