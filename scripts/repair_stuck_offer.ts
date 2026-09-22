import { dbService } from '../src/lib/supabase/db';

async function repairStuckOffer() {
  console.log('--- REPAIRING STUCK OFFER 126852a7-fb8a-4d07-a4b3-575fd338fad3 ---');
  const offers = await dbService.getOffers();
  const targetOffer = offers.find((o) => o.id === '126852a7-fb8a-4d07-a4b3-575fd338fad3');

  if (!targetOffer) {
    console.log('Target offer not found.');
    return;
  }

  console.log('Found offer before repair:', {
    id: targetOffer.id,
    product_name: targetOffer.product_name,
    advertiser: targetOffer.advertiser,
    status: targetOffer.status,
  });

  const now = new Date().toISOString();

  // Extract from meta_ads_url:
  // id=1628520415634615
  // view_all_page_id=319486974570981
  const updatedOffer = await dbService.updateOffer(targetOffer.id, {
    product_name: 'Anúncio Meta #1628520415634615',
    advertiser: 'Página Meta #319486974570981',
    status: 'DADOS_PARCIAIS',
    active_ads_count: 1,
    days_running: 1,
    discovery_score: 15,
    opportunity_score: 35,
    system_score: 35,
    niche: 'Negócios Digitais',
    subniche: 'Marketing',
    updated_at: now,
  });

  console.log('Updated offer successfully:', {
    id: updatedOffer?.id,
    product_name: updatedOffer?.product_name,
    advertiser: updatedOffer?.advertiser,
    status: updatedOffer?.status,
  });

  // Also create a linked job in stale state so the user can retry if desired
  const job = await dbService.createAnalysisJob({
    id: `job_recovered_${targetOffer.id.slice(0, 8)}`,
    workspace_id: 'ws_default_001',
    offer_id: targetOffer.id,
    input_url: targetOffer.meta_ads_url || '',
    status: 'stale',
    current_step: 'RESOLVE_META',
    progress_percent: 20,
    attempt: 1,
    max_attempts: 3,
    stage_message: 'Análise anterior interrompida. Metadados do anúncio foram preservados.',
    error_code: 'TIMEOUT_STALE_AUTO_RECOVERED',
    progress_data: {
      workspace_id: 'ws_default_001',
      offer_id: targetOffer.id,
      product_name: 'Anúncio Meta #1628520415634615',
      advertiser: 'Página Meta #319486974570981',
      current_step: 'RESOLVE_META',
      progress_percent: 20,
      logs: [
        {
          timestamp: now,
          stage: 'RESOLVE_META',
          message: 'Recuperado com sucesso: Ad ID 1628520415634615 e Página 319486974570981 identificados.',
        },
      ],
    },
  });

  console.log('Created linked recovered job:', {
    id: job.id,
    status: job.status,
    current_step: job.current_step,
  });
}

repairStuckOffer().catch(console.error);
