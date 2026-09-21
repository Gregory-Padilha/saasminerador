import { dbService } from '../src/lib/supabase/db';
import { Offer, LandingPageAnalysisResult } from '../src/types';

async function runLpDossierSyncTest() {
  console.log('===================================================');
  console.log('TESTE FIM A FIM: SANIDADE DE SINCRONIZAÇÃO LP -> DOSSIÊ');
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

  // 1. Create a test offer
  const testOffer: Partial<Offer> = {
    id: `test_sync_${Date.now()}`,
    product_name: 'Atlas das Escrituras Teste',
    landing_page_url: 'https://atlas-das-escrituras-premium.metodogo.com',
    landing_page_domain: 'atlas-das-escrituras-premium.metodogo.com',
    status: 'NOVA',
    price: null,
    favorite: false,
    watching: false,
    in_deep_dive: false,
    dedupe_key: 'test_dedupe_sync_1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 2. Mock analysis result extracted from LP
  const mockAnalysis: LandingPageAnalysisResult = {
    capture: {
      id: `cap_test_${Date.now()}`,
      offer_id: testOffer.id!,
      url: testOffer.landing_page_url!,
      domain: testOffer.landing_page_domain!,
      captured_at: new Date().toISOString(),
      capture_status: 'analyzed',
    },
    heroXRay: {
      headline: 'Atlas das Escrituras — Entenda a Bíblia de Forma Visual',
      subheadline: 'Mais de 150 mapas, infográficos e cronologias bíblicas',
      price: 'R$ 17,90',
      rating: '4.9',
      social_proof: '4.850 leitores satisfeitos',
    },
    sections: [
      { id: 'sec_1', landing_page_capture_id: 'cap_1', offer_id: testOffer.id!, section_type: 'hero', position_index: 1 },
      { id: 'sec_2', landing_page_capture_id: 'cap_1', offer_id: testOffer.id!, section_type: 'deliverables', position_index: 2 },
      { id: 'sec_3', landing_page_capture_id: 'cap_1', offer_id: testOffer.id!, section_type: 'pricing', position_index: 3 },
    ],
    copy: {
      headlines: ['Atlas das Escrituras — Entenda a Bíblia de Forma Visual'],
      subheadlines: ['Mais de 150 mapas, infográficos e cronologias bíblicas'],
      promises: ['Compreenda o contexto histórico da Bíblia sem complicação em poucas semanas'],
      benefits: ['Visualização em mapas de alta resolução', 'Linhas do tempo detalhadas dos reinos de Israel'],
      painPoints: ['Dificuldade de conectar os livros do Antigo e Novo Testamento', 'Esquecimento frequente dos nomes de cidades bíblicas'],
      objections: ['Não precisa ter conhecimento teológico prévio'],
      testimonials: ['"Esse atlas mudou completamente meus estudos bíblicos!" — Maria S.'],
      guarantees: ['Garantia incondicional de 7 dias ou seu dinheiro de volta'],
      ctas: ['QUERO MEU ATLAS AGORA'],
      faqs: [{ question: 'Como recebo o acesso?', answer: 'O envio é imediato via e-mail após a confirmação do pagamento.' }],
      urgency: ['Desconto especial válido por tempo limitado'],
    },
    elements: {
      hasVsl: false,
      hasVideo: true,
      hasImages: true,
      hasMockups: true,
      hasTestimonials: true,
      hasReviews: true,
      hasRating: true,
      hasTimer: false,
      hasFaq: true,
      hasGuarantee: true,
      hasPriceTable: true,
      hasBadges: true,
      hasCheckout: true,
      hasWhatsApp: false,
      hasStickyCta: true,
      hasPopup: false,
    },
    links: [
      {
        id: 'link_1',
        capture_id: 'cap_1',
        offer_id: testOffer.id!,
        url: 'https://pay.kiwify.com.br/xyz123',
        domain: 'pay.kiwify.com.br',
        link_type: 'checkout',
        checkout_platform: 'kiwify',
        is_external: true,
      },
    ],
    commerce: {
      originalPrice: 47,
      currentPrice: 17.9,
      discountPercent: 62,
      currency: 'BRL',
      guaranteeDays: 7,
      guaranteeText: '7 dias de garantia incondicional',
      checkoutPlatform: 'kiwify',
      checkoutUrls: ['https://pay.kiwify.com.br/xyz123'],
      deliverables: [
        { name: 'Atlas das Escrituras em Alta Resolução PDF', description: 'Mais de 150 mapas ilustrados' },
        { name: 'Linha do Tempo Ilustrada dos Reis e Profetas' },
      ],
      bonuses: [
        { name: 'Guia de Estudos Devocionais Bíblicos', description: 'Bônus exclusivo', advertisedValue: 29.9 },
      ],
    },
    provenance: {},
  };

  // Save base offer first in local storage
  (dbService as any).saveOffer ? await (dbService as any).saveOffer(testOffer as Offer) : null;

  // Perform Sync
  const syncedOffer = await dbService.syncLandingPageToOffer(testOffer.id!, mockAnalysis);
  assert(!!syncedOffer, 'Passo 1: Sincronização executou sem erros');

  if (syncedOffer) {
    // Check Copy Module Sync
    assert(syncedOffer.headline === mockAnalysis.heroXRay.headline, 'Passo 2: Headline da Hero sincronizada');
    assert(syncedOffer.subheadline === mockAnalysis.heroXRay.subheadline, 'Passo 3: Subheadline sincronizada');
    assert(syncedOffer.promise === mockAnalysis.copy.promises[0], 'Passo 4: Promessa central sincronizada');
    assert(syncedOffer.problem === mockAnalysis.copy.painPoints[0], 'Passo 5: Problema alvo sincronizado');

    // Check Offer Module Sync
    assert(syncedOffer.price === 17.9, 'Passo 6: Preço atual de R$17.90 sincronizado');
    assert(syncedOffer.checkout_platform === 'kiwify', 'Passo 7: Plataforma Kiwify identificada');
    assert(syncedOffer.checkout_url === 'https://pay.kiwify.com.br/xyz123', 'Passo 8: URL do checkout salva');

    const deliverables = await dbService.getOfferDeliverables(testOffer.id!);
    assert(deliverables.length === 2, 'Passo 9: Entregáveis salvos automaticamente (2 itens)', `Encontrados: ${deliverables.length}`);

    const bonuses = await dbService.getOfferBonuses(testOffer.id!);
    assert(bonuses.length === 1, 'Passo 10: Bônus salvo automaticamente (1 item)', `Encontrados: ${bonuses.length}`);

    // Check Funnel Module Sync
    const funnelSteps = await dbService.getOfferFunnelSteps(testOffer.id!);
    assert(funnelSteps.length >= 2, 'Passo 11: Passos reais do funil salvos', `Passos: ${funnelSteps.length}`);

    // Check Audience Profile - No hardcoded default!
    assert(syncedOffer.audience_profile?.awareness_level === null || syncedOffer.audience_profile?.awareness_level === undefined, 'Passo 12: Sem default fictício "Consciente do Problema" em Nível de Consciência');

    // Check Proofs
    const proofs = await dbService.getOfferProofs(testOffer.id!);
    assert(proofs.length >= 1, 'Passo 13: Depoimento salvo como prova', `Provas: ${proofs.length}`);
  }

  console.log('\n===================================================');
  console.log(`RESULTADO DO TESTE DE SINCRONIZAÇÃO: ${passed} PASSARAM, ${failed} FALHARAM`);
  console.log('===================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLpDossierSyncTest().catch((err) => {
  console.error('Erro na execução do teste de sincronização:', err);
  process.exit(1);
});
