// ==============================================================================
// TEST SUITE: OFFER MINER URL INTEGRITY & PIPELINE AUDIT
// ==============================================================================

import * as XLSX from 'xlsx';
import { parseSpreadsheet } from '../src/lib/excel/parser';
import { matchColumnWithConfidence, normalizeHeader } from '../src/lib/excel/aliases';
import {
  normalizeUrl,
  canonicalizeUrlForComparison,
  extractHostname,
  classifyUrl,
  getCurrentLandingPageUrl,
} from '../src/lib/url-field-mapping';

async function runUrlIntegrityTests() {
  console.log('================================================================');
  console.log('🧪 INICIANDO TESTES DE INTEGRIDADE DE URLs DO OFFER MINER');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string, detail?: any) {
    if (condition) {
      console.log(`  ✓ PASSOU: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ FALHOU: ${message}`);
      if (detail) console.error('    Detalhes:', detail);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // TESTE 1: Preservação de URL Completa e Extração de Domínio
  // ---------------------------------------------------------------------------
  console.log('[TESTE 1] Preservação de URL Completa e Extração de Domínio');
  const fullUrl = 'https://atlas-das-escrituras-premium.metodogo.com/p/vsl-oferta?utm_source=fb&utm_campaign=c1';
  assert(
    normalizeUrl(fullUrl) === fullUrl,
    'normalizeUrl preserva query params e UTMs na gravação'
  );
  assert(
    extractHostname(fullUrl) === 'atlas-das-escrituras-premium.metodogo.com',
    'extractHostname extrai corretamente o hostname sem www'
  );
  assert(
    canonicalizeUrlForComparison(fullUrl) === 'https://atlas-das-escrituras-premium.metodogo.com/p/vsl-oferta',
    'canonicalizeUrlForComparison remove tracking params apenas para comparação'
  );

  // ---------------------------------------------------------------------------
  // TESTE 2: Domínio Isolado Sem URL Não Inventa URL Fictícia
  // ---------------------------------------------------------------------------
  console.log('\n[TESTE 2] Domínio Isolado Sem URL Não Inventa URL Fictícia');
  const rawDomainOnly = [
    {
      'Nome da Oferta': 'Curso de Marcenaria',
      'Anunciante': 'Marcenaria Moderna',
      'Domínio da Landing Page': 'marcenariamoderna.com.br',
    },
  ];
  const wsDomain = XLSX.utils.json_to_sheet(rawDomainOnly);
  const wbDomain = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbDomain, wsDomain, 'Sheet1');
  const bufDomain = XLSX.write(wbDomain, { type: 'array', bookType: 'xlsx' });
  const parseResultDomain = await parseSpreadsheet(bufDomain, 'teste_dominio.xlsx');
  const rowDomain = parseResultDomain.rows[0].normalized;

  assert(
    rowDomain.landing_page_url === null,
    'landing_page_url é null quando apenas o domínio é informado (NUNCA inventa https://domain.com/)'
  );
  assert(
    rowDomain.landing_page_domain === 'marcenariamoderna.com.br',
    'landing_page_domain armazena o domínio informado'
  );

  // ---------------------------------------------------------------------------
  // TESTE 3: Desambiguação de Aliases (URL Landing Page vs Domínio da LP)
  // ---------------------------------------------------------------------------
  console.log('\n[TESTE 3] Desambiguação de Aliases (URL Landing Page vs Domínio da LP)');
  const matchUrlCol = matchColumnWithConfidence('URL Landing Page');
  const matchDomainCol = matchColumnWithConfidence('Domínio da Landing Page');
  const matchDomainShort = matchColumnWithConfidence('Domínio da LP');

  assert(
    matchUrlCol.key === 'landing_page_url',
    '"URL Landing Page" mapeia para landing_page_url'
  );
  assert(
    matchDomainCol.key === 'landing_page_domain',
    '"Domínio da Landing Page" mapeia para landing_page_domain'
  );
  assert(
    matchDomainShort.key === 'landing_page_domain',
    '"Domínio da LP" mapeia para landing_page_domain'
  );

  // ---------------------------------------------------------------------------
  // TESTE 4: Colisão de Colunas no Mesmo Arquivo (Caso Real Atlas das Escrituras)
  // ---------------------------------------------------------------------------
  console.log('\n[TESTE 4] Prevenção de Sobrescrita por Colisão (Caso Atlas das Escrituras)');
  const realAtlasRow = [
    {
      'Nome da Oferta': 'Atlas da Escritura',
      'Anunciante': 'Atlas da Escritura - Recursos para Cristãos',
      'URL Landing Page': 'https://atlas-das-escrituras-premium.metodogo.com/p/guia-visual',
      'Domínio da Landing Page': 'atlas-das-escrituras.com',
      'URL Meta Ads Library': 'https://www.facebook.com/ads/library/?id=12345',
    },
  ];
  const wsAtlas = XLSX.utils.json_to_sheet(realAtlasRow);
  const wbAtlas = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbAtlas, wsAtlas, 'Sheet1');
  const bufAtlas = XLSX.write(wbAtlas, { type: 'array', bookType: 'xlsx' });
  const parseResultAtlas = await parseSpreadsheet(bufAtlas, 'atlas_test.xlsx');
  const atlasNorm = parseResultAtlas.rows[0].normalized;

  assert(
    atlasNorm.landing_page_url === 'https://atlas-das-escrituras-premium.metodogo.com/p/guia-visual',
    'landing_page_url preserva a URL completa e NÃO é sobrescrita pela coluna de domínio',
    atlasNorm.landing_page_url
  );
  assert(
    atlasNorm.landing_page_domain === 'atlas-das-escrituras-premium.metodogo.com',
    'landing_page_domain é derivado da URL completa',
    atlasNorm.landing_page_domain
  );
  assert(
    atlasNorm.meta_ads_url === 'https://www.facebook.com/ads/library/?id=12345',
    'meta_ads_url preservado corretamente'
  );

  // ---------------------------------------------------------------------------
  // TESTE 5: Classificação de URLs (Meta Ads Library, Checkout, LP, WhatsApp)
  // ---------------------------------------------------------------------------
  console.log('\n[TESTE 5] Classificação Inteligente de URLs');
  assert(
    classifyUrl('https://www.facebook.com/ads/library/?active_status=active&q=Atlas') === 'META_ADS_LIBRARY',
    'Link do Facebook Ads Library classificado como META_ADS_LIBRARY'
  );
  assert(
    classifyUrl('https://pay.kiwify.com.br/abc1234') === 'CHECKOUT',
    'Link da Kiwify classificado como CHECKOUT'
  );
  assert(
    classifyUrl('https://pay.hotmart.com/XYZ987') === 'CHECKOUT',
    'Link da Hotmart classificado como CHECKOUT'
  );
  assert(
    classifyUrl('https://wa.me/5511999999999') === 'WHATSAPP',
    'Link de WhatsApp classificado como WHATSAPP'
  );
  assert(
    classifyUrl('https://novodominio.com.br/oferta-especial') === 'LANDING_PAGE',
    'Link de site de vendas classificado como LANDING_PAGE'
  );

  // ---------------------------------------------------------------------------
  // TESTE 6: Proteção contra Meta Ads Library na coluna de LP (Caso Petrobras)
  // ---------------------------------------------------------------------------
  console.log('\n[TESTE 6] Proteção contra Meta Ads Library na coluna de LP');
  const petrobrasRow = [
    {
      'Nome do produto': 'Kit Aprovado Petrobras 2026',
      'Anunciante': 'Aprovação Estratégica',
      'URL Página de Vendas': 'https://www.facebook.com/ads/library/?active_status=active&q=Petrobras',
    },
  ];
  const wsPetro = XLSX.utils.json_to_sheet(petrobrasRow);
  const wbPetro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbPetro, wsPetro, 'Sheet1');
  const bufPetro = XLSX.write(wbPetro, { type: 'array', bookType: 'xlsx' });
  const parseResultPetro = await parseSpreadsheet(bufPetro, 'petrobras_test.xlsx');
  const petroNorm = parseResultPetro.rows[0].normalized;

  assert(
    petroNorm.landing_page_url === null,
    'landing_page_url é null quando a célula contém link da biblioteca Meta (NÃO salva Meta Ads como LP)'
  );
  assert(
    petroNorm.meta_ads_url === 'https://www.facebook.com/ads/library/?active_status=active&q=Petrobras',
    'meta_ads_url recebe o link da biblioteca Meta automaticamente'
  );

  // ---------------------------------------------------------------------------
  // TESTE 7: Fonte Única de Verdade (getCurrentLandingPageUrl)
  // ---------------------------------------------------------------------------
  console.log('\n[TESTE 7] Ponto Único de Verdade (getCurrentLandingPageUrl)');
  const mockOfferManual = {
    landing_page_url: 'https://site-original.com',
    landing_page_url_resolved: 'https://site-resolved.com',
    manual_override_url: 'https://site-manual.com',
  };
  assert(
    getCurrentLandingPageUrl(mockOfferManual) === 'https://site-manual.com/',
    'getCurrentLandingPageUrl prioriza manual_override_url'
  );

  const mockOfferResolved = {
    landing_page_url: 'https://site-original.com',
    landing_page_url_resolved: 'https://site-resolved.com',
  };
  assert(
    getCurrentLandingPageUrl(mockOfferResolved) === 'https://site-resolved.com/',
    'getCurrentLandingPageUrl prioriza resolvedUrl sobre landing_page_url'
  );

  console.log('\n================================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runUrlIntegrityTests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
