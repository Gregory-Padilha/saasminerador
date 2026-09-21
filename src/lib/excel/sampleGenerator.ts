// ==============================================================================
// OFFER MINER - SAMPLE WORKBOOK GENERATOR FOR TESTING
// ==============================================================================

import * as XLSX from 'xlsx';

export function createSampleWorkMiningData(): any[] {
  return [
    {
      'Nome do Produto': '300 Receitas Airfryer Práticas',
      'Nicho': 'Gastronomia',
      'Subnicho': 'Airfryer',
      'Anunciante': 'Cozinha Fácil Digital',
      'Preço': 'R$ 27,90',
      'Ads Ativos': '24 anúncios',
      'Data 1º Anúncio': '2026-08-20',
      'Dias Rodando': '23 dias',
      'Faceless': 'SIM',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=1029384756',
      'Página de Vendas': 'https://receitasairfryer.com/oferta-vip?utm_source=meta&utm_campaign=cbo',
      'Headline': 'Economize até 40 minutos no almoço com 300 receitas rápidas na Airfryer',
      'Formato': 'Vídeo UGC',
      'Nota': 9.2,
      'Observações': 'Checkout com 2 order bumps de R$ 9,90 e 1 upsell de R$ 37,00.',
    },
    {
      'Nome do Produto': 'Protocolo Sono Profundo 21D',
      'Nicho': 'Saúde & Bem-Estar',
      'Subnicho': 'Insônia',
      'Anunciante': 'Instituto Mente Serena',
      'Preço': 'R$ 37,00',
      'Ads Ativos': '18',
      'Data 1º Anúncio': '2026-08-25',
      'Dias Rodando': '18',
      'Faceless': 'SIM',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=9928374615',
      'Página de Vendas': 'https://sonoperfeito.app/metodo',
      'Headline': 'Como reprogramar seu ciclo circadiano em 21 noites sem remédios',
      'Formato': 'Vídeo VSL Faceless',
      'Nota': 8.8,
      'Observações': 'Promessa forte com foco em mães e executivos.',
    },
    {
      'Nome do Produto': 'Planilha Gestão Financeira Pessoal Automática',
      'Nicho': 'Finanças Pessoais',
      'Subnicho': 'Controle de Gastos',
      'Anunciante': 'Finanças Descomplicadas',
      'Preço': 'R$ 19,90',
      'Ads Ativos': '31 anúncios',
      'Data 1º Anúncio': '2026-08-15',
      'Dias Rodando': '28',
      'Faceless': 'SIM',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=4488221199',
      'Página de Vendas': 'https://planilhadebolso.com.br/lp',
      'Headline': 'Tenha controle de 100% dos seus gastos no WhatsApp e Google Sheets',
      'Formato': 'Carrossel / Print',
      'Nota': 9.5,
      'Observações': 'Altíssimo volume de anúncios e comentários recentes elogiando.',
    },
    {
      'Nome do Produto': 'Caderno de Caligrafia Terapêutica',
      'Nicho': 'Desenvolvimento Pessoal',
      'Subnicho': 'Lettering & Anti-ansiedade',
      'Anunciante': 'Arte & Foco Studio',
      'Preço': '29,90',
      'Ads Ativos': '12',
      'Data 1º Anúncio': '2026-08-28',
      'Dias Rodando': '15',
      'Faceless': 'SIM',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=3300119922',
      'Página de Vendas': 'https://caligrafiaterapia.com/digital',
      'Headline': 'Reduza a ansiedade do dia a dia treinando traços relaxantes em PDF imprimível',
      'Formato': 'Vídeo Satisfatório',
      'Nota': 8.4,
      'Observações': 'Ticket de entrada leve, excelente para print on demand.',
    },
    {
      'Nome do Produto': 'Manual do Adestramento Positivo em Casa',
      'Nicho': 'Pets',
      'Subnicho': 'Cães',
      'Anunciante': 'Cão Educado Brasil',
      'Preço': 'R$ 47,00',
      'Ads Ativos': '15 anúncios',
      'Data 1º Anúncio': '2026-08-22',
      'Dias Rodando': '21',
      'Faceless': 'SIM',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=5566778811',
      'Página de Vendas': 'https://caoeducado.com/guia',
      'Headline': 'Ensine seu filhote a fazer as necessidades no lugar certo em 7 dias',
      'Formato': 'Vídeo Demo com Cachorros',
      'Nota': 8.6,
      'Observações': 'Página limpa com muitos depoimentos em vídeo.',
    },
    {
      'Nome do Produto': 'Pack 500 Artes Canva para Psicólogas',
      'Nicho': 'Design & Social Media',
      'Subnicho': 'Nichado Profissionais de Saúde',
      'Anunciante': 'Templates Pro',
      'Preço': 'R$ 29,90',
      'Ads Ativos': '22',
      'Data 1º Anúncio': '2026-08-18',
      'Dias Rodando': '25',
      'Faceless': 'SIM',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=7788990011',
      'Página de Vendas': 'https://canvapsico.com.br/pack',
      'Headline': '3 meses de conteúdo pronto para seu Instagram profissional em 5 minutos',
      'Formato': 'Carrossel Mockup',
      'Nota': 9.0,
      'Observações': 'Nicho muito comprador de esteira low-ticket.',
    },
    {
      'Nome do Produto': 'Guia Prático Marmitas Fitness da Semana',
      'Nicho': 'Gastronomia',
      'Subnicho': 'Emagrecimento & Meal Prep',
      'Anunciante': 'Nutri na Prática',
      'Preço': 'R$ 24,90',
      'Ads Ativos': '14',
      'Data 1º Anúncio': '2026-08-24',
      'Dias Rodando': '19',
      'Faceless': 'SIM',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=1122334455',
      'Página de Vendas': 'https://marmitasdasemana.com/oferta',
      'Headline': 'Como cozinhar todas as marmitas saudáveis da semana em apenas 2 horas no domingo',
      'Formato': 'Vídeo Passo a Passo',
      'Nota': 8.5,
      'Observações': 'Foco em praticidade e economia de supermercado.',
    },
    {
      'Nome do Produto': 'Curso Completo de Mentoria High Ticket VIP',
      'Nicho': 'Negócios',
      'Subnicho': 'Consultoria',
      'Anunciante': 'Expert Academy',
      'Preço': 'R$ 997,00', // Exemplo propositalmente INVÁLIDA pelo preço
      'Ads Ativos': '3',    // Exemplo propositalmente INVÁLIDA pelo volume de ads
      'Data 1º Anúncio': '2026-09-08',
      'Dias Rodando': '4',  // Exemplo propositalmente INVÁLIDA por dias rodando
      'Faceless': 'NÃO',
      'URL Meta Ads': 'https://facebook.com/ads/library/?id=9988776655',
      'Página de Vendas': 'https://mentoriavip.com/aplicacao',
      'Headline': 'Aprenda a fechar contratos de 10k',
      'Formato': 'Vídeo Especialista Falando',
      'Nota': 5.0,
      'Observações': 'Oferta fora do padrão Low-Ticket para teste de validação.',
    },
  ];
}

/**
 * Generates an Excel workbook binary array for sample download
 */
export function generateSampleExcelBuffer(): Uint8Array {
  const data = createSampleWorkMiningData();
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mineracao_ChatGPT_Work');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
