import { dbService } from '../src/lib/supabase/db';

async function runTest() {
  console.log('🧪 Iniciando teste do fluxo de Aprovação de Ofertas Mineradas...');

  // 1. Stage a test offer
  console.log('1. Simulando oferta minerada pelo agente Browser-Use...');
  const testOfferData = {
    product_name: 'Pack Super Atividades Fonológicas BNCC - Teste ' + Date.now(),
    advertiser: 'Editora Aprender Feliz',
    price: 37.0,
    currency: 'BRL',
    niche: 'Educação',
    subniche: 'Alfabetização',
    landing_page_url: 'https://exemplo-aprender.com.br/lp-teste-' + Date.now(),
    checkout_url: 'https://pay.kiwify.com.br/exemplo123',
    meta_ads_url: 'https://facebook.com/ads/library/?id=999888777',
    active_ads_count: 5,
    headline: 'Caderno completo de alfabetização lúdica',
    promise: 'Mais de 300 atividades prontas para imprimir e aplicar.',
    source: 'BROWSER_USE_AGENT',
  };

  const staged = await dbService.stageOffer(testOfferData);
  console.log('✅ Oferta enviada para staging:', staged.id, staged.product_name, staged.status);

  // 2. Fetch pending offers
  const pending = await dbService.getStagedOffers('PENDING_APPROVAL');
  const found = pending.find((o) => o.id === staged.id);
  if (!found) {
    throw new Error('Falha: Oferta em staging não encontrada na lista pendente!');
  }
  console.log('✅ Oferta pendente confirmada na fila de aprovação (Total pendentes:', pending.length, ')');

  // 3. Approve offer
  console.log('3. Aprovando card de oferta...');
  const approvalRes = await dbService.approveStagedOffer(staged.id);
  if (!approvalRes.success || !approvalRes.offer) {
    throw new Error('Falha ao aprovar oferta staged!');
  }
  console.log('✅ Oferta aprovada com sucesso! Canonical ID:', approvalRes.offer.id);

  // 4. Verify canonical presence in catalog
  const catalog = await dbService.getOffers();
  const inCatalog = catalog.find((o) => o.id === approvalRes.offer!.id);
  if (!inCatalog) {
    throw new Error('Falha: Oferta aprovada NÃO encontrada no catálogo principal!');
  }
  console.log('✅ Oferta verificada no catálogo principal:', inCatalog.product_name, inCatalog.price, inCatalog.status);

  // 5. Verify staging state is updated to APPROVED
  const remainingPending = await dbService.getStagedOffers('PENDING_APPROVAL');
  const stillPending = remainingPending.some((o) => o.id === staged.id);
  if (stillPending) {
    throw new Error('Falha: Oferta ainda consta como pendente na fila de aprovação!');
  }
  console.log('✅ Oferta removida da fila de pendentes após aprovação.');

  console.log('\n🎉 TODOS OS TESTES DO FLUXO DE APROVAÇÃO PASSARAM COM SUCESSO!');
}

runTest().catch((err) => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
