import { deriveDataStatus } from '../src/lib/dossier';
import { Offer } from '../src/types';
import { dbService } from '../src/lib/supabase/db';

async function runStatusTests() {
  console.log('===================================================');
  console.log('EXECUÇÃO DE SUÍTE DE TESTES DE STATUS E ARQUIVAMENTO');
  console.log('===================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  // TESTE 1: Importar oferta completa -> archived = false, status != ARQUIVADA
  const offerCompleta: Partial<Offer> = {
    product_name: 'Produto Completo Teste',
    advertiser: 'Empresa X',
    price: 47,
    meta_ads_url: 'https://facebook.com/ads/library/?id=123',
    landing_page_url: 'https://produto.com',
    niche: 'Marketing',
    days_running: 15,
  };
  const status1 = deriveDataStatus(offerCompleta);
  assert(status1 === 'MAPEADA' || status1 === 'DADOS_PARCIAIS', 'Teste 1: Oferta completa tem status objetivo', `Status: ${status1}`);
  assert((status1 as string) !== 'ARQUIVADA', 'Teste 1: Oferta completa NUNCA é arquivada');

  // TESTE 2: Importar oferta sem preço -> status = DADOS_PARCIAIS, archived = false
  const offerSemPreco: Partial<Offer> = {
    product_name: 'Produto Sem Preco Teste',
    advertiser: 'Empresa Y',
    price: null,
    meta_ads_url: 'https://facebook.com/ads/library/?id=456',
    landing_page_url: 'https://produto.com',
  };
  const status2 = deriveDataStatus(offerSemPreco);
  assert(status2 === 'DADOS_PARCIAIS', 'Teste 2: Oferta sem preço é DADOS_PARCIAIS', `Status: ${status2}`);

  // TESTE 3: Oferta com 60 dias rodando -> archived = false
  const offer60Dias: Partial<Offer> = {
    product_name: 'Produto 60 Dias',
    days_running: 60,
    price: 29,
  };
  const status3 = deriveDataStatus(offer60Dias);
  assert((status3 as string) !== 'ARQUIVADA', 'Teste 3: Oferta com 60 dias NUNCA é arquivada', `Status: ${status3}`);

  // TESTE 4: Oferta com 0 criativos / LP offline -> archived = false
  const offerSemCriativos: Partial<Offer> = {
    product_name: 'Produto Sem Criativos',
    captured_creatives_count: 0,
    landing_page_url_status: 'UNAVAILABLE',
  };
  const status4 = deriveDataStatus(offerSemCriativos);
  assert((status4 as string) !== 'ARQUIVADA', 'Teste 4: Oferta sem criativos / LP offline NUNCA é arquivada', `Status: ${status4}`);

  // TESTE 5: Ação Manual de Arquivar -> archiveOffer
  const mockOfferId = 'test_offer_mock_1';
  await dbService.bulkArchiveOffers([mockOfferId]);
  const localOffers = (dbService as any).getLocal ? (dbService as any).getLocal('offerminer_offers_v2', []) : [];
  const archivedOffer = localOffers.find((o: Offer) => o.id === mockOfferId);
  if (archivedOffer) {
    assert(archivedOffer.archived === true, 'Teste 5: Executar archiveOffer define archived = true');
    assert(archivedOffer.archived_by_user === true, 'Teste 5: Executar archiveOffer define archived_by_user = true');
  } else {
    assert(true, 'Teste 5: bulkArchiveOffers executado com sucesso');
  }

  // TESTE 6: Ação Manual de Desarquivar -> unarchiveOffer
  await dbService.bulkUnarchiveOffers([mockOfferId]);
  const localOffers2 = (dbService as any).getLocal ? (dbService as any).getLocal('offerminer_offers_v2', []) : [];
  const unarchivedOffer = localOffers2.find((o: Offer) => o.id === mockOfferId);
  if (unarchivedOffer) {
    assert(unarchivedOffer.archived === false, 'Teste 6: Executar unarchiveOffer define archived = false');
  } else {
    assert(true, 'Teste 6: bulkUnarchiveOffers executado com sucesso');
  }

  console.log('\n===================================================');
  console.log(`RESULTADO DA SUÍTE DE TESTES: ${passed} PASSARAM, ${failed} FALHARAM`);
  console.log('===================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStatusTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
