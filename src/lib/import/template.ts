// ==============================================================================
// OFFER MINER - DETERMINISTIC JSON IMPORT TEMPLATE GENERATOR
// ==============================================================================

export const SAMPLE_IMPORT_TEMPLATE = {
  schema_version: '1.0',
  offers: [
    {
      offer_name: 'Atlas Visual de Radiologia Prática',
      advertiser: 'O Guia Digital',
      niche: 'Educação',
      subniche: 'Radiologia',
      active_ads_count: 120,
      unique_creatives_count: 18,
      front_price: 27.9,
      currency: 'BRL',
      meta_ads_url: 'https://www.facebook.com/ads/library/?id=1029384756',
      meta_page_id: '10023456789',
      landing_page_url: 'https://atlasradiologia.com.br',
      checkout_url: 'https://pay.kiwify.com.br/abc1234',
      product_format: 'PDF / Ebook',
      faceless: true,
      days_active: 48,
      first_seen: '2026-08-01',
      last_seen: '2026-09-18',
      headline: 'Aprenda Laudos de Radiologia em Metade do Tempo com Imagens Reais',
      notes: 'Guia ilustrado de alta conversão para estudantes e residentes de medicina.',
    },
    {
      offer_name: 'Protocolo Sono Profundo 21D',
      advertiser: 'Instituto Saúde Natural',
      niche: 'Saúde e Bem-estar',
      subniche: 'Sono e Ansiedade',
      active_ads_count: 45,
      unique_creatives_count: 8,
      front_price: 47.0,
      currency: 'BRL',
      meta_ads_url: 'https://www.facebook.com/ads/library/?id=9876543210',
      meta_page_id: '20098765432',
      landing_page_url: 'https://sonoprofundo.com.br/vsl',
      checkout_url: 'https://chk.hotmart.com/x98765y',
      product_format: 'Vídeo Aulas',
      faceless: false,
      days_active: 22,
      first_seen: '2026-08-27',
      last_seen: '2026-09-18',
      headline: 'O Método Natural para Dormir em 15 Minutos sem Remédios',
      notes: 'VSL de 12 minutos com forte apelo para alívio de insônia.',
    },
  ],
};

/**
 * Initiates browser download of the canonical offer-import-template.json file.
 */
export function downloadJsonImportTemplate(): void {
  const content = JSON.stringify(SAMPLE_IMPORT_TEMPLATE, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'offer-import-template.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
