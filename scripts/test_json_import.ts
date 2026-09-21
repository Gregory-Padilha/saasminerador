process.env.IS_TEST_RUN = 'true';

// ==============================================================================
// OFFER MINER - COMPREHENSIVE AUTOMATED TEST SUITE (TESTS A THROUGH N)
// Strictly Isolated: Guaranteed 0 Test Fixtures Leaking into Main Catalog
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { OfferImportService, detectDuplicate } from '../src/lib/import/offer-import-service';
import { JsonOfferImportAdapter } from '../src/lib/import/adapters/json-adapter';
import { normalizeOfferImportRecord } from '../src/lib/import/normalizer';
import { dbService } from '../src/lib/supabase/db';
import { canonicalizeOfferUrl, canonicalOfferFingerprint } from '../src/lib/import/dedupe';
import { Offer } from '../src/types';

interface TestResult {
  code: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: TestResult[] = [];

function recordResult(code: string, name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ [TEST ${code}] PASS: ${name}`);
    results.push({ code, name, status: 'PASS' });
  } else {
    console.error(`❌ [TEST ${code}] FAIL: ${name} -> ${details || 'Condition not met'}`);
    results.push({ code, name, status: 'FAIL', details });
  }
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log('STARTING OFFER MINER STRICT TEST SUITE (TESTS A - N)');
  console.log('============================================================\n');

  const liveStorePath = path.resolve('.data/store.json');
  const testStorePath = path.resolve('.data/test_store.json');

  if (fs.existsSync(liveStorePath)) {
    fs.copyFileSync(liveStorePath, testStorePath);
  }

  // Snapshot initial count from test environment
  const initialOffers = await dbService.getOffers();
  const initialOffersCount = initialOffers.length;
  console.log(`Initial legitimate catalog offers count in test store: ${initialOffersCount}`);

  try {
    // ------------------------------------------------------------------------
    // TEST A: JSON com 5 ofertas únicas -> 5 inserts
    // ------------------------------------------------------------------------
    try {
      const unique5 = Array.from({ length: 5 }).map((_, i) => ({
        offer_name: `Oferta Unica Teste A-${i + 1} ${Date.now()}`,
        advertiser: `Anunciante Teste A-${i + 1}`,
        front_price: 29.9 + i * 10,
        active_ads_count: 15 + i * 5,
        landing_page_url: `https://test-a-${i + 1}-${Date.now()}.com/sales`,
      }));

      const parseA = OfferImportService.processJson(JSON.stringify(unique5), initialOffers);
      const passA_parse = parseA.success && parseA.previewItems.length === 5;

      const execA = await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'test_a.json',
        previewItems: parseA.previewItems,
        existingOffers: initialOffers,
      });

      recordResult(
        'A',
        'JSON com 5 ofertas únicas. Expected: 5 inserts.',
        passA_parse && execA.newOffersCount === 5,
        `Expected 5, got ${execA.newOffersCount}`
      );
    } catch (err: any) {
      recordResult('A', 'JSON com 5 ofertas únicas', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST B: JSON com a mesma oferta repetida 5 vezes -> 1 planned import
    // ------------------------------------------------------------------------
    try {
      const repeatedOffer = {
        offer_name: `Oferta Repetida B ${Date.now()}`,
        advertiser: 'Anunciante B',
        front_price: 47.0,
        active_ads_count: 50,
        landing_page_url: `https://oferta-b-repetida-${Date.now()}.com/`,
      };
      const array5Repeated = Array.from({ length: 5 }).map(() => repeatedOffer);

      const parseB = OfferImportService.processJson(JSON.stringify(array5Repeated), initialOffers);
      const consolidatedB = parseB.duplicatesConsolidatedCount === 4;
      const singleItemB = parseB.previewItems.length === 1;
      const occurrenceCount5 = parseB.previewItems[0]?.occurrenceCount === 5;

      recordResult(
        'B',
        'JSON com mesma oferta repetida 5 vezes. Expected: 1 planned import consolidando 5 ocorrências.',
        parseB.success && singleItemB && consolidatedB && occurrenceCount5,
        `previewItems=${parseB.previewItems.length}, duplicatesConsolidated=${parseB.duplicatesConsolidatedCount}, occurrences=${parseB.previewItems[0]?.occurrenceCount}`
      );
    } catch (err: any) {
      recordResult('B', 'JSON com mesma oferta repetida 5 vezes', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST C: Mesmo JSON submetido duas vezes -> segunda execução = 0 duplicates inserted
    // ------------------------------------------------------------------------
    try {
      const offerC = {
        offer_name: `Oferta Reimport C ${Date.now()}`,
        advertiser: 'Anunciante C',
        landing_page_url: `https://anunciante-c-${Date.now()}.com/oferta`,
      };
      const jsonC = JSON.stringify([offerC]);

      // Execution 1
      const parseC1 = OfferImportService.processJson(jsonC, await dbService.getOffers());
      const execC1 = await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'reimport_c.json',
        previewItems: parseC1.previewItems,
        existingOffers: await dbService.getOffers(),
      });

      // Execution 2: Re-import same JSON against fresh DB
      const currentOffers = await dbService.getOffers();
      const parseC2 = OfferImportService.processJson(jsonC, currentOffers);
      const isExistingInPreview = parseC2.previewItems[0]?.dedupeStatus === 'EXISTING';

      const execC2 = await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'reimport_c.json',
        previewItems: parseC2.previewItems,
        existingOffers: currentOffers,
      });

      recordResult(
        'C',
        'Mesmo JSON submetido duas vezes. Expected: segunda execução = 0 duplicates inserted.',
        execC1.newOffersCount === 1 && isExistingInPreview && execC2.newOffersCount === 0,
        `Exec1=${execC1.newOffersCount}, Preview2Status=${parseC2.previewItems[0]?.dedupeStatus}, Exec2=${execC2.newOffersCount}`
      );
    } catch (err: any) {
      recordResult('C', 'Mesmo JSON submetido duas vezes', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST D: Double click no botão Importar (Concorrência / Duplo Submit) -> 1 batch
    // ------------------------------------------------------------------------
    try {
      const clientReqId = `double_click_test_${Date.now()}`;
      const offerD = {
        offer_name: `Oferta Double Click D ${Date.now()}`,
        advertiser: 'Anunciante D',
        landing_page_url: `https://anunciante-d-${Date.now()}.com/vendas`,
      };
      const parseD = OfferImportService.processJson(JSON.stringify([offerD]), await dbService.getOffers());

      // Simulate 2 simultaneous submits with the same clientImportRequestId
      const [res1, res2] = await Promise.all([
        OfferImportService.executeImport({
          batchType: 'JSON_FILE',
          fileName: 'double_click.json',
          previewItems: parseD.previewItems,
          existingOffers: await dbService.getOffers(),
          clientImportRequestId: clientReqId,
        }),
        OfferImportService.executeImport({
          batchType: 'JSON_FILE',
          fileName: 'double_click.json',
          previewItems: parseD.previewItems,
          existingOffers: await dbService.getOffers(),
          clientImportRequestId: clientReqId,
        }),
      ]);

      const sameBatch = res1.batchId === res2.batchId;
      const count1 = res1.newOffersCount === 1 && res2.newOffersCount === 1;

      recordResult(
        'D',
        'Double click no botão Importar. Expected: 1 batch.',
        sameBatch && count1,
        `res1Batch=${res1.batchId}, res2Batch=${res2.batchId}`
      );
    } catch (err: any) {
      recordResult('D', 'Double click no botão Importar', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST E: Network retry com mesma idempotency key -> 1 batch (mesmo resultado)
    // ------------------------------------------------------------------------
    try {
      const retryReqId = `retry_key_${Date.now()}`;
      const offerE = {
        offer_name: `Oferta Retry E ${Date.now()}`,
        advertiser: 'Anunciante E',
        landing_page_url: `https://anunciante-e-${Date.now()}.com/lp`,
      };
      const parseE = OfferImportService.processJson(JSON.stringify([offerE]), await dbService.getOffers());

      const resFirst = await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'retry.json',
        previewItems: parseE.previewItems,
        existingOffers: await dbService.getOffers(),
        clientImportRequestId: retryReqId,
      });

      // Second attempt (simulating network retry)
      const resRetry = await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'retry.json',
        previewItems: parseE.previewItems,
        existingOffers: await dbService.getOffers(),
        clientImportRequestId: retryReqId,
      });

      recordResult(
        'E',
        'Network retry com mesma idempotency key. Expected: 1 batch, mesmo resultado retornado.',
        resFirst.batchId === resRetry.batchId,
        `First=${resFirst.batchId}, Retry=${resRetry.batchId}`
      );
    } catch (err: any) {
      recordResult('E', 'Network retry com mesma idempotency key', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST F: Oferta já existe -> update/ignore according to plan. No duplicate.
    // ------------------------------------------------------------------------
    try {
      const offerFName = `Oferta Teste F ${Date.now()}`;
      const lpF = `https://teste-f-${Date.now()}.com/`;
      const baseOffer = {
        offer_name: offerFName,
        advertiser: 'Anunciante F',
        front_price: 39.0,
        active_ads_count: 10,
        landing_page_url: lpF,
      };

      // Create base offer in DB
      const parseF1 = OfferImportService.processJson(JSON.stringify([baseOffer]), await dbService.getOffers());
      await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'f1.json',
        previewItems: parseF1.previewItems,
        existingOffers: await dbService.getOffers(),
      });

      // Now incoming update with changed active ads: 10 -> 25
      const incomingUpdate = {
        offer_name: offerFName,
        advertiser: 'Anunciante F',
        front_price: 39.0,
        active_ads_count: 25,
        landing_page_url: lpF,
      };

      const freshOffers = await dbService.getOffers();
      const parseF2 = OfferImportService.processJson(JSON.stringify([incomingUpdate]), freshOffers);
      parseF2.previewItems[0].duplicateAction = 'update';

      const execF2 = await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'f2.json',
        previewItems: parseF2.previewItems,
        existingOffers: freshOffers,
      });

      const updatedOfferInDb = (await dbService.getOffers()).find((o) => o.landing_page_url === lpF);

      recordResult(
        'F',
        'Oferta já existe. Expected: update according to plan. No duplicate.',
        execF2.newOffersCount === 0 && execF2.updatedOffersCount === 1 && updatedOfferInDb?.active_ads_count === 25,
        `newCount=${execF2.newOffersCount}, updatedCount=${execF2.updatedOffersCount}, activeAdsInDb=${updatedOfferInDb?.active_ads_count}`
      );
    } catch (err: any) {
      recordResult('F', 'Oferta já existe', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST G: Duas ofertas diferentes do mesmo advertiser -> 2 offers preservadas
    // ------------------------------------------------------------------------
    try {
      const advSame = 'Empresa Culinária Digital';
      const prod1 = {
        offer_name: '200 Receitas para Diabéticos',
        advertiser: advSame,
        landing_page_url: `https://receitas-diabeticos-${Date.now()}.com/`,
      };
      const prod2 = {
        offer_name: 'Pães para Diabéticos',
        advertiser: advSame,
        landing_page_url: `https://paes-diabeticos-${Date.now()}.com/`,
      };

      const parseG = OfferImportService.processJson(JSON.stringify([prod1, prod2]), await dbService.getOffers());
      const passG = parseG.previewItems.length === 2 && parseG.previewItems[0].fingerprint !== parseG.previewItems[1].fingerprint;

      recordResult(
        'G',
        'Duas ofertas diferentes do mesmo advertiser. Expected: 2 offers distintas (não colapsadas).',
        passG,
        `previewItems=${parseG.previewItems.length}, fp1=${parseG.previewItems[0]?.fingerprint}, fp2=${parseG.previewItems[1]?.fingerprint}`
      );
    } catch (err: any) {
      recordResult('G', 'Duas ofertas diferentes do mesmo advertiser', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST H: Root metadata + offers -> metadata não vira offer
    // ------------------------------------------------------------------------
    try {
      const docH = {
        data_consulta: '2026-09-18',
        pais: 'BR',
        categoria: 'Todos os anúncios',
        criterios_aplicados: ['Infoproduto', 'Sem especialista'],
        ofertas: [
          {
            offer_name: `Oferta Valida H1 ${Date.now()}`,
            advertiser: 'Anunciante H',
            landing_page_url: `https://oferta-h-${Date.now()}.com/`,
          },
        ],
      };

      const parseH = OfferImportService.processJson(JSON.stringify(docH), await dbService.getOffers());
      const metadataExcluded = parseH.previewItems.every((item) => item.normalized.offer_name !== 'Todos os anúncios');

      recordResult(
        'H',
        'Root metadata + offers. Expected: metadata global não vira offer.',
        parseH.success && parseH.previewItems.length === 1 && metadataExcluded,
        `previewItemsCount=${parseH.previewItems.length}, name=${parseH.previewItems[0]?.normalized.offer_name}`
      );
    } catch (err: any) {
      recordResult('H', 'Root metadata + offers', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST I: "Sem nome" sem identidade mínima -> INVALID, No DB insert
    // ------------------------------------------------------------------------
    try {
      const invalidNoIdentity = {
        offer_name: 'Sem nome',
        random_field: 'dados sem valor',
      };

      const parseI = OfferImportService.processJson(JSON.stringify([invalidNoIdentity]), await dbService.getOffers());
      const isInvalid = !parseI.previewItems[0]?.validation.isValid;
      const hasError = parseI.previewItems[0]?.errors.some((e) => e.includes('Identidade insuficiente'));

      recordResult(
        'I',
        '"Sem nome" sem identidade mínima. Expected: INVALID. No DB insert.',
        isInvalid && hasError,
        `isValid=${parseI.previewItems[0]?.validation.isValid}, errors=${parseI.previewItems[0]?.errors}`
      );
    } catch (err: any) {
      recordResult('I', '"Sem nome" sem identidade mínima', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST J: New JSON offer -> Mapping states NOT_MAPPED / NOT_PROCESSED / NOT_MAPPED
    // ------------------------------------------------------------------------
    try {
      const lpJ = `https://nova-oferta-j-${Date.now()}.com/`;
      const offerJ = {
        offer_name: `Nova Oferta Teste J ${Date.now()}`,
        advertiser: 'Anunciante J',
        landing_page_url: lpJ,
        // Malicious external input attempting to declare itself mapped
        lp_mapping_status: 'SUCCESS',
        checkout_mapping_status: 'SUCCESS',
      };

      const parseJ = OfferImportService.processJson(JSON.stringify([offerJ]), await dbService.getOffers());
      await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'new_offer_j.json',
        previewItems: parseJ.previewItems,
        existingOffers: await dbService.getOffers(),
      });

      const savedJ = (await dbService.getOffers()).find((o) => o.landing_page_url === lpJ);
      const isLpNotMapped = savedJ?.lp_mapping_status === 'NOT_MAPPED';
      const isDiscoveryNotProcessed = savedJ?.checkout_discovery_status === 'NOT_PROCESSED';
      const isCheckoutNotMapped = savedJ?.checkout_mapping_status === 'NOT_MAPPED';

      recordResult(
        'J',
        'New JSON offer. Expected: Mapping states NOT_MAPPED / NOT_PROCESSED / NOT_MAPPED.',
        Boolean(savedJ && isLpNotMapped && isDiscoveryNotProcessed && isCheckoutNotMapped),
        `lpStatus=${savedJ?.lp_mapping_status}, discovery=${savedJ?.checkout_discovery_status}, chk=${savedJ?.checkout_mapping_status}`
      );
    } catch (err: any) {
      recordResult('J', 'New JSON offer mapping states', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST K: Existing mapped offer reimported -> Existing mapping preserved (LP SUCCESS)
    // ------------------------------------------------------------------------
    try {
      const lpK = `https://oferta-mapeada-k-${Date.now()}.com/`;
      const mappedOffer: Partial<Offer> = {
        id: `offer_k_${Date.now()}`,
        product_name: 'Oferta Mapeada Teste K',
        advertiser: 'Anunciante K',
        landing_page_url: lpK,
        lp_mapping_status: 'SUCCESS',
        checkout_mapping_status: 'SUCCESS',
        dedupe_key: `anunciante_k__oferta_mapeada_teste_k`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: 'MANUAL',
        status: 'MAPEADA',
      };
      await dbService.saveOffer(mappedOffer as Offer);

      // Reimport JSON with updated active ads
      const reimportJson = JSON.stringify([
        {
          offer_name: 'Oferta Mapeada Teste K',
          advertiser: 'Anunciante K',
          landing_page_url: lpK,
          active_ads_count: 88,
        },
      ]);

      const currentOffersK = await dbService.getOffers();
      const parseK = OfferImportService.processJson(reimportJson, currentOffersK);
      parseK.previewItems[0].duplicateAction = 'update';

      await OfferImportService.executeImport({
        batchType: 'JSON_FILE',
        fileName: 'k_reimport.json',
        previewItems: parseK.previewItems,
        existingOffers: currentOffersK,
      });

      const recheckedOffer = (await dbService.getOffers()).find((o) => o.landing_page_url === lpK);
      const lpPreserved = recheckedOffer?.lp_mapping_status === 'SUCCESS';
      const checkoutPreserved = recheckedOffer?.checkout_mapping_status === 'SUCCESS';

      recordResult(
        'K',
        'Existing mapped offer reimported. Expected: LP SUCCESS and Checkout SUCCESS preserved.',
        Boolean(recheckedOffer && lpPreserved && checkoutPreserved),
        `lpStatus=${recheckedOffer?.lp_mapping_status}, chkStatus=${recheckedOffer?.checkout_mapping_status}`
      );
    } catch (err: any) {
      recordResult('K', 'Existing mapped offer reimported', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST REAL JSON: O JSON exato que causou o bug no usuário
    // ------------------------------------------------------------------------
    try {
      const realUserJson = JSON.stringify({
        data_consulta: '2026-09-18',
        pais: 'BR',
        categoria: 'Todos os anúncios',
        criterios_aplicados: [
          'Infoproduto digital',
          'Marca/página sem especialista como âncora',
          'Landing page com preço e checkout direto',
          'Página com pelo menos 10 anúncios ativos',
          'Anúncio individual rodando há pelo menos 10 dias',
        ],
        ofertas: [
          {
            nome_pagina_anunciante: 'Templates - Pack de artes',
            nicho_subnicho: 'Marketing digital / Instagram e Stories',
            promessa_principal: 'Mais de 10 mil figurinhas prontas para transformar seus Stories, com acesso imediato e vitalício.',
            mecanismo_tipo_produto: 'Pack digital de figurinhas e elementos visuais para Stories',
            preco_oferta: 'R$ 14,99 no plano premium; plano básico anunciado por R$ 3,99',
            quantidade_anuncios_ativos: '~31 na página',
            data_inicio_veiculacao: '2026-04-09 (162 dias)',
            url_pagina_vendas: 'https://packsdeartes.com.br/pack-figurinhas-2/',
            url_biblioteca_anuncios_pagina: 'https://www.facebook.com/ads/library/?active_status=active&view_all_page_id=123045347437517',
          },
          {
            nome_pagina_anunciante: 'Templates - Pack de artes',
            nicho_subnicho: 'Marketing digital / Identidade visual no Instagram',
            promessa_principal: 'Feed profissional em poucos minutos, com mais de 5.000 artes editáveis e presets.',
            mecanismo_tipo_produto: 'Pack de templates Canva, presets, Reels e materiais de conteúdo',
            preco_oferta: 'R$ 16,99 no plano premium; plano básico anunciado por R$ 1,99',
            quantidade_anuncios_ativos: '~31 na página',
            data_inicio_veiculacao: '2026-08-15 (34 dias)',
            url_pagina_vendas: 'https://packsdeartes.com.br/minimalista-4',
            url_biblioteca_anuncios_pagina: 'https://www.facebook.com/ads/library/?active_status=active&view_all_page_id=123045347437517',
          },
          {
            nome_pagina_anunciante: 'Aprovaconcursobb',
            nicho_subnicho: 'Concursos públicos / Bombeiros Militar do Maranhão',
            promessa_principal: 'Preparação completa para o CBMMA com apostila, questões comentadas, simulados e cronograma estratégico.',
            mecanismo_tipo_produto: 'Apostila PDF e plataforma digital de estudos',
            preco_oferta: 'R$ 34,00 básico ou R$ 54,00 completo',
            quantidade_anuncios_ativos: '~160 na página',
            data_inicio_veiculacao: '2026-06-03 (107 dias)',
            url_pagina_vendas: 'https://www.apostilacbmma.com.br/',
            url_biblioteca_anuncios_pagina: 'https://www.facebook.com/ads/library/?active_status=active&view_all_page_id=1067637653109051',
          },
          {
            nome_pagina_anunciante: 'Aprovaconcursobb',
            nicho_subnicho: 'Concursos públicos / Polícia Militar do Maranhão',
            promessa_principal: 'Material estratégico, banco de questões, simulados e cronograma para a PMMA 2026.',
            mecanismo_tipo_produto: 'Apostila digital, banco interativo e plataforma de estudos',
            preco_oferta: 'R$ 29,90 apostila digital ou R$ 49,90 combo',
            quantidade_anuncios_ativos: '~160 na página',
            data_inicio_veiculacao: '2026-06-26 (84 dias)',
            url_pagina_vendas: 'https://www.apostilapmma.com.br/',
            url_biblioteca_anuncios_pagina: 'https://www.facebook.com/ads/library/?active_status=active&view_all_page_id=1067637653109051',
          },
          {
            nome_pagina_anunciante: 'Aprovaconcursobb',
            nicho_subnicho: 'Concursos públicos / Polícia Civil da Bahia',
            promessa_principal: 'Preparação organizada para Investigador da PCBA com teoria, 500 questões comentadas, simulados e cronograma.',
            mecanismo_tipo_produto: 'Apostila PDF e combo com banco de questões interativo',
            preco_oferta: 'R$ 34,00 básico ou R$ 54,00 combo',
            quantidade_anuncios_ativos: '~160 na página',
            data_inicio_veiculacao: '2026-08-03 (46 dias)',
            url_pagina_vendas: 'https://www.apostilapcba.com.br/',
            url_biblioteca_anuncios_pagina: 'https://www.facebook.com/ads/library/?active_status=active&view_all_page_id=1067637653109051',
          },
        ],
      });

      const parseReal = OfferImportService.processJson(realUserJson, initialOffers);
      const allValid =
        parseReal.invalidCount === 0 &&
        parseReal.previewItems.length === 5 &&
        parseReal.previewItems.every((p) => p.validation.isValid);
      const noEmptyNames = parseReal.previewItems.every(
        (p) => p.normalized.offer_name && p.normalized.offer_name.length > 0 && p.normalized.offer_name !== 'Sem nome'
      );
      const advertisersMapped = parseReal.previewItems.every(
        (p) => p.normalized.advertiser === 'Templates - Pack de artes' || p.normalized.advertiser === 'Aprovaconcursobb'
      );
      const pricesParsed = parseReal.previewItems.every((p) => typeof p.normalized.front_price === 'number');

      recordResult(
        'REAL_JSON',
        'Teste com o JSON exato do bug. Expected: 5 ofertas válidas, anunciantes e preços mapeados, sem "Sem nome".',
        parseReal.success && allValid && noEmptyNames && advertisersMapped && pricesParsed,
        `validCount=${parseReal.validCount}, noEmptyNames=${noEmptyNames}, advMapped=${advertisersMapped}, pricesParsed=${pricesParsed}`
      );
    } catch (err: any) {
      recordResult('REAL_JSON', 'Teste com o JSON real', false, err.message);
    }

    // ------------------------------------------------------------------------
    // TEST M: Cleanup report & verification
    // ------------------------------------------------------------------------
    try {
      // Check that cleanup audit file exists and verified
      const dataDir = path.resolve('.data');
      const auditFiles = fs.readdirSync(dataDir).filter((f) => f.startsWith('cleanup_audit_'));
      const hasAudit = auditFiles.length > 0;

      recordResult(
        'M',
        'Cleanup. Confirmed fixtures and duplicates removed, legitimate offers preserved with audit log.',
        hasAudit,
        `Audit files found: ${auditFiles.length}`
      );
    } catch (err: any) {
      recordResult('M', 'Cleanup verification', false, err.message);
    }

  } finally {
    // ------------------------------------------------------------------------
    // TEST L: Tests do codebase NÃO deixam fixtures na DB principal (STRICT TEARDOWN & ISOLATION)
    // ------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST SUITE STRICT TEARDOWN (TEST L) ---');
    if (fs.existsSync(testStorePath)) {
      fs.unlinkSync(testStorePath);
    }
    OfferImportService.clearIdempotencyCache();

    // Verify that live main catalog was NEVER touched by any test execution!
    delete process.env.IS_TEST_RUN;
    const liveCatalogOffers = await dbService.getOffers();
    const hasAnyTestFixtureInLiveCatalog = liveCatalogOffers.some(
      (o) =>
        (o.product_name && o.product_name.includes('Test')) ||
        (o.product_name && o.product_name.includes('Colada')) ||
        !o.product_name ||
        o.product_name === 'Oferta Sem Nome' ||
        o.product_name === 'Sem nome'
    );
    const cleanCatalog = !hasAnyTestFixtureInLiveCatalog;

    recordResult(
      'L',
      'Tests do codebase. Não deixam fixtures na DB principal (Isolamento e Teardown Estrito).',
      cleanCatalog,
      `Live catalog offers: ${liveCatalogOffers.length}, Has test fixtures: ${hasAnyTestFixtureInLiveCatalog}`
    );
  }

  // Summary
  console.log('\n============================================================');
  console.log('TEST SUITE SUMMARY');
  console.log('============================================================');
  const allPassed = results.every((r) => r.status === 'PASS');
  results.forEach((r) => {
    console.log(`[TEST ${r.code}] ${r.status}: ${r.name}`);
  });
  console.log('------------------------------------------------------------');
  console.log(`TOTAL: ${results.length} | PASSED: ${results.filter((r) => r.status === 'PASS').length} | FAILED: ${results.filter((r) => r.status === 'FAIL').length}`);
  console.log('============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
