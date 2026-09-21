// ==============================================================================
// TEST SUITE: P0 — CATALOG PERSISTENCE & SMART JSON IMPORT VERIFICATION
// Tests A through J as required by user prompt
// ==============================================================================

import { OfferImportService } from '../src/lib/import/offer-import-service';
import { dbService } from '../src/lib/supabase/db';
import { resolveImportedOfferName } from '../src/lib/import/offer-name-resolver';
import { AI_TOOLS_LIST } from '../src/lib/ai-tools/registry';
import { isBadTestOffer } from '../src/lib/supabase/db';

const REAL_5_RECORDS_RAW = `
{
  "pagina": "Kit Kids Escolar",
  "anuncios\\_ativos": "Yes",
  "data\\_inicio": "11 de jun de 2026",
  "link\\_destino": "KITKIDSESCOLAR.COM.BR",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=865473736608989](https://www.facebook.com/ads/library/?id=865473736608989)",
  "tipo\\_material": "Lapbook Aprendendo Frações",
  "promessa": "Auxilia as crianças na introdução ao conceito de frações de forma clara e divertida, com abas interativas e exemplos práticos."
},
{
  "pagina": "Clube de Alemão",
  "anuncios\\_ativos": "Yes",
  "data\\_inicio": "18 de jun de 2026",
  "link\\_destino": "CLUBEDEALEMAO.COM",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=1311845471136701](https://www.facebook.com/ads/library/?id=1311845471136701)",
  "tipo\\_material": "Aulas de Alemão Gratuitas",
  "promessa": "Aulas AO VIVO, materiais de apoio e 100% GRATUITO, todos os sábados."
},
{
  "pagina": "Bianca Ribeiro",
  "anuncios\\_ativos": "Yes",
  "data\\_inicio": "13 de ago de 2026",
  "link\\_destino": "DINAMICASCAPS.LOVABLE.APP",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=1084116953997957](https://www.facebook.com/ads/library/?id=1084116953997957)",
  "tipo\\_material": "Pack com +200 Dinâmicas Terapêuticas para CAPS",
  "promessa": "Conduzir grupos com mais qualidade, sem passar horas planejando atividades, com acesso imediato."
},
{
  "pagina": "Clube da Pedagogia",
  "anuncios\\_ativos": "Yes",
  "data\\_inicio": "24 de jul de 2026",
  "link\\_destino": "CLUBEDAPEDAGOGIA.COM",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=1741320697058282](https://www.facebook.com/ads/library/?id=1741320697058282)",
  "tipo\\_material": "Caderno de Consciência Fonológica – 1º e 2º Ano",
  "promessa": "Material completo para trabalhar a consciência fonológica de forma leve e lúdica, pronto para imprimir e utilizar."
},
{
  "pagina": "Geovanna Santos",
  "anuncios\\_ativos": "Yes",
  "data\\_inicio": "21 de ago de 2026",
  "link\\_destino": "PORTALDEMATERIAIS.COM",
  "link\\_biblioteca": "[https://www.facebook.com/ads/library/?id=2189938591582064](https://www.facebook.com/ads/library/?id=2189938591582064)",
  "tipo\\_material": "Dinâmicas de Computação para BNCC",
  "promessa": "Receber +100 dinâmicas desplugadas prontas para aplicar na sala de aula, todas alinhadas à BNCC."
}
`;

async function runAllTests() {
  console.log('============================================================');
  console.log('INICIANDO BATERIA DE TESTES DE INTEGRAÇÃO (TESTES A - J)');
  console.log('============================================================\n');

  // --- TEST A: Processamento e Detecção do Bloco Real ---
  console.log('▶ TEST A: Detecção e Preview de 5 Registros Reais...');
  const currentOffers = await dbService.getOffers();
  const processResult = OfferImportService.processJson(REAL_5_RECORDS_RAW, []);
  if (!processResult.success || processResult.previewItems.length !== 5) {
    throw new Error(`TEST A FAILED: Esperado 5 ofertas no preview, obtido ${processResult.previewItems.length}`);
  }
  console.log('✔ TEST A: Preview detectou 5 ofertas com sucesso.');

  // --- TEST B: Nomes Canônicos Mapeados ---
  console.log('\n▶ TEST B: Validação dos 5 Nomes Canônicos...');
  const expectedNames = [
    'Lapbook Aprendendo Frações',
    'Aulas de Alemão Gratuitas',
    'Pack com +200 Dinâmicas Terapêuticas para CAPS',
    'Caderno de Consciência Fonológica – 1º e 2º Ano',
    'Dinâmicas de Computação para BNCC',
  ];
  const detectedNames = processResult.previewItems.map((p) => p.normalized.offer_name);
  for (let i = 0; i < expectedNames.length; i++) {
    if (detectedNames[i] !== expectedNames[i]) {
      throw new Error(`TEST B FAILED: Registro ${i + 1} nome esperado "${expectedNames[i]}", obtido "${detectedNames[i]}"`);
    }
    console.log(`✔ Offer #${i + 1}: ${detectedNames[i]} — PASS`);
  }

  // --- TEST C: Proibição de "Oferta Sem Nome" ---
  console.log('\n▶ TEST C: Verificação de Ausência de "Oferta Sem Nome"...');
  const allDbOffers = await dbService.getOffers();
  const namelessOffers = allDbOffers.filter((o) => {
    const n = (o.product_name || o.offer_name || '').toLowerCase().trim();
    return n === 'oferta sem nome' || n === 'sem nome' || n === '<<sem nome>>' || !n;
  });
  if (namelessOffers.length > 0) {
    throw new Error(`TEST C FAILED: Encontradas ${namelessOffers.length} ofertas sem nome no catálogo!`);
  }
  console.log('✔ TEST C: Zero "Oferta Sem Nome" no catálogo — PASS');

  // --- TEST D: Advertisers Mapeados Corretamente ---
  console.log('\n▶ TEST D: Validação dos Anunciantes Mapeados...');
  const expectedAdvertisers = [
    'Kit Kids Escolar',
    'Clube de Alemão',
    'Bianca Ribeiro',
    'Clube da Pedagogia',
    'Geovanna Santos',
  ];
  const detectedAdvertisers = processResult.previewItems.map((p) => p.normalized.advertiser);
  for (let i = 0; i < expectedAdvertisers.length; i++) {
    if (detectedAdvertisers[i] !== expectedAdvertisers[i]) {
      throw new Error(`TEST D FAILED: Anunciante esperado "${expectedAdvertisers[i]}", obtido "${detectedAdvertisers[i]}"`);
    }
    console.log(`✔ Advertiser #${i + 1}: ${detectedAdvertisers[i]} — PASS`);
  }

  // --- TEST E: Status de Mapeamento Inicial em /mapping ---
  console.log('\n▶ TEST E: Verificação de Presença em /mapping como LP NOT_MAPPED...');
  const jsonDbOffers = allDbOffers.filter((o) => o.source === 'JSON_PASTE' || o.source === 'JSON_IMPORT');
  for (const jOff of jsonDbOffers) {
    if (jOff.lp_mapping_status !== 'NOT_MAPPED') {
      throw new Error(`TEST E FAILED: Oferta ${jOff.product_name} possui lp_mapping_status = ${jOff.lp_mapping_status}`);
    }
    if (jOff.checkout_discovery_status !== 'NOT_PROCESSED') {
      throw new Error(`TEST E FAILED: Oferta ${jOff.product_name} possui checkout_discovery_status = ${jOff.checkout_discovery_status}`);
    }
    if (jOff.checkout_mapping_status !== 'NOT_MAPPED') {
      throw new Error(`TEST E FAILED: Oferta ${jOff.product_name} possui checkout_mapping_status = ${jOff.checkout_mapping_status}`);
    }
  }
  console.log('✔ TEST E: Todas as ofertas constam como LP NOT_MAPPED e Checkout NOT_PROCESSED — PASS');

  // --- TEST F: Proteção Contra Duplicação no Reimport ---
  console.log('\n▶ TEST F: Reimportar o Mesmo JSON...');
  const reimportPreview = OfferImportService.processJson(REAL_5_RECORDS_RAW, allDbOffers);
  const reimportResult = await OfferImportService.executeImport({
    batchType: 'JSON_PASTE',
    fileName: 'teste_reimport_protecao.json',
    previewItems: reimportPreview.previewItems,
    existingOffers: allDbOffers,
  });
  if (reimportResult.newOffersCount !== 0) {
    throw new Error(`TEST F FAILED: Esperado 0 novas ofertas no reimport, obtido ${reimportResult.newOffersCount}`);
  }
  if (reimportResult.ignoredDuplicatesCount !== 5) {
    throw new Error(`TEST F FAILED: Esperado 5 ignoradas no reimport, obtido ${reimportResult.ignoredDuplicatesCount}`);
  }
  console.log('✔ TEST F: 0 novas duplicadas criadas, 5 identificadas como existentes — PASS');

  // --- TEST G & H: Persistência no Store Server e Durabilidade ---
  console.log('\n▶ TEST G & H: Durabilidade e Persistência do Store...');
  const reloadedOffers = await dbService.getOffers();
  const reloadedJsonOffers = reloadedOffers.filter((o) => o.source === 'JSON_PASTE' || o.source === 'JSON_IMPORT');
  if (reloadedJsonOffers.length !== 5) {
    throw new Error(`TEST G/H FAILED: Esperado 5 ofertas no catálogo persistido, obtido ${reloadedJsonOffers.length}`);
  }
  console.log(`✔ TEST G & H: Catálogo persistido intacto com ${reloadedJsonOffers.length} ofertas JSON — PASS`);

  // --- TEST I: Ferramenta de Busca AI (search_offers) ---
  console.log('\n▶ TEST I: AI search_offers Busca as Ofertas Importadas...');
  const searchTool = AI_TOOLS_LIST.find((t) => t.name === 'search_offers');
  if (!searchTool) throw new Error('Tool search_offers não encontrada');

  const aiResult1 = (await searchTool.execute({ query: 'Frações' })) as any;
  if (aiResult1.total < 1 || !aiResult1.offers.some((o: any) => o.name.includes('Frações'))) {
    throw new Error('TEST I FAILED: Busca por "Frações" não retornou a oferta esperada');
  }

  const aiResult2 = (await searchTool.execute({ query: 'BNCC' })) as any;
  if (aiResult2.total < 1 || !aiResult2.offers.some((o: any) => o.name.includes('BNCC'))) {
    throw new Error('TEST I FAILED: Busca por "BNCC" não retornou a oferta esperada');
  }
  console.log('✔ TEST I: AI search_offers localizou com sucesso as novas ofertas — PASS');

  // --- TEST J: Nenhum Fixture Antigo Revivido ---
  console.log('\n▶ TEST J: Verificação de Ausência de Fixtures Antigos...');
  const revivedBadOffers = reloadedOffers.filter((o) => isBadTestOffer(o));
  if (revivedBadOffers.length > 0) {
    throw new Error(`TEST J FAILED: Encontradas ${revivedBadOffers.length} ofertas marcadas como bad test fixtures!`);
  }
  console.log('✔ TEST J: Zero fixtures de teste revividos — PASS');

  console.log('\n============================================================');
  console.log('TODOS OS TESTES DE INTEGRAÇÃO PASSARAM COM 100% DE SUCESSO!');
  console.log('============================================================');
}

runAllTests().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES:', err);
  process.exit(1);
});
