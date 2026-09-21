import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const ORPHAN_REMAP: Record<string, string> = {
  '34534e2b-66eb-4fe3-b8a7-6724ffa9b61b': '1acb6d4d-3b8b-4da7-979c-3caafada6087'
};

const MONTH_MAP: Record<string, string> = {
  jan: '01', janeiro: '01',
  fev: '02', fevereiro: '02',
  mar: '03', marco: '03', março: '03',
  abr: '04', abril: '04',
  mai: '05', maio: '05',
  jun: '06', junho: '06',
  jul: '07', julho: '07',
  ago: '08', agosto: '08',
  set: '09', setembro: '09',
  out: '10', outubro: '10',
  nov: '11', novembro: '11',
  dez: '12', dezembro: '12',
};

function normalizeDate(val: any): string | null {
  if (!val) return null;
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  const directTs = Date.parse(trimmed);
  if (!isNaN(directTs)) {
    return new Date(directTs).toISOString();
  }

  const match = trimmed.match(/(\d{1,2})\s+de\s+([a-zA-ZçÇãÃ]+)\s+de\s+(\d{4})/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTH_MAP[monthKey] || MONTH_MAP[monthKey.substring(0, 3)] || '01';
    const year = match[3];
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }

  return null;
}

function normalizeDateOnly(val: any): string | null {
  const dt = normalizeDate(val);
  return dt ? dt.substring(0, 10) : null;
}

async function main() {
  const isExecute = process.argv.includes('--execute');

  console.log('============================================================');
  console.log('OFFER MINER — MIGRATION RUNNER CANÔNICO (STORE -> SUPABASE)');
  console.log('============================================================\n');

  if (!url || !key) {
    console.error('❌ Supabase não configurado no .env ou .env.local.');
    process.exit(1);
  }

  let projectRef = 'unknown';
  try {
    projectRef = new URL(url).hostname.replace('.supabase.co', '');
  } catch {}

  console.log(`📡 Supabase Target: ${projectRef}`);
  console.log(`🔐 Modo: ${isExecute ? '⚡ EXECUTE (Escrita no Banco)' : '🔍 DRY-RUN (Somente Leitura)'}\n`);

  const supabase = createClient(url, key);

  // 1. Verificar se as tabelas existem no Supabase (usando GET real para evitar falso positivo do HEAD)
  const { data: testData, error: tableError } = await supabase.from('offers').select('id').limit(1);
  if (tableError) {
    console.error(`❌ Tabela 'public.offers' não encontrada ou inacessível no projeto ${projectRef}.`);
    console.error(`   Código de erro: ${tableError.code} - ${tableError.message}`);
    console.error('\n👉 AÇÃO NECESSÁRIA:');
    console.error('   Abra o SQL Editor do Supabase no projeto ' + projectRef + ' e execute:');
    console.error('   supabase/migrations/20260921000000_canonical_schema.sql\n');
    process.exit(1);
  }

  // 2. Ler store.json
  const storePath = path.resolve(process.cwd(), '.data/store.json');
  if (!fs.existsSync(storePath)) {
    console.error(`❌ Arquivo não encontrado: ${storePath}`);
    process.exit(1);
  }

  const rawStore = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  function parseColl(name: string): any[] {
    const raw = rawStore[name];
    if (!raw) return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  }

  const rawOffers = parseColl('offerminer_offers_v2');
  const offerIds = new Set(rawOffers.map(o => o.id));

  // Preparar todas as coleções em ordem topológica
  const dataset: { table: string; items: any[]; conflictKey?: string }[] = [];

  // A. Batches
  dataset.push({
    table: 'import_batches',
    items: parseColl('offerminer_batches_v2').map(b => ({
      id: b.id,
      file_name: b.file_name || 'import.xlsx',
      file_size: b.file_size || 0,
      sheet_count: b.sheet_count || 1,
      total_rows: b.total_rows || 0,
      successful_rows: b.successful_rows || 0,
      warning_rows: b.warning_rows || 0,
      error_rows: b.error_rows || 0,
      imported_rows: b.imported_rows || 0,
      updated_rows: b.updated_rows || 0,
      duplicate_rows: b.duplicate_rows || 0,
      invalid_rows: b.invalid_rows || 0,
      created_at: b.created_at || new Date().toISOString()
    }))
  });

  // B. Offers
  dataset.push({
    table: 'offers',
    items: rawOffers.map(o => {
      const {
        snapshots,
        creatives,
        deliverables,
        bonuses,
        order_bumps,
        upsells,
        funnel_steps,
        frontend_options,
        lp_sections,
        analysis,
        ...rest
      } = o;
      return {
        ...rest,
        product_name: o.product_name || o.offer_name || 'Sem nome',
        offer_name: o.offer_name || o.product_name || 'Sem nome',
        dedupe_key: o.dedupe_key || `${o.product_name}_${o.advertiser || ''}`,
        status: o.status || 'REVISAR',
        oldest_ad_date: normalizeDateOnly(o.oldest_ad_date),
        newest_ad_date: normalizeDateOnly(o.newest_ad_date),
        first_seen_at: normalizeDate(o.first_seen_at) || new Date().toISOString(),
        last_seen_at: normalizeDate(o.last_seen_at) || new Date().toISOString(),
        first_imported_at: normalizeDate(o.first_imported_at) || new Date().toISOString(),
        last_imported_at: normalizeDate(o.last_imported_at) || new Date().toISOString(),
        archived_at: normalizeDate(o.archived_at),
        lp_mapped_at: normalizeDate(o.lp_mapped_at),
        checkout_discovery_at: normalizeDate(o.checkout_discovery_at),
        checkout_mapped_at: normalizeDate(o.checkout_mapped_at),
        landing_page_url_last_checked_at: normalizeDate(o.landing_page_url_last_checked_at),
        data_scraping_started_at: normalizeDate(o.data_scraping_started_at),
        data_scraping_completed_at: normalizeDate(o.data_scraping_completed_at),
        last_creatives_capture_at: normalizeDate(o.last_creatives_capture_at),
        active_ads_count_observed_at: normalizeDate(o.active_ads_count_observed_at),
        raw_data: o.raw_data || {},
        extra_data: o.extra_data || {},
        created_at: normalizeDate(o.created_at) || new Date().toISOString(),
        updated_at: normalizeDate(o.updated_at) || new Date().toISOString()
      };
    })
  });

  // C. Creatives
  dataset.push({
    table: 'offer_creatives',
    items: parseColl('offerminer_creatives_v2').map(c => ({
      ...c,
      user_id: c.user_id || null,
      capture_job_id: c.capture_job_id || null,
      started_at: normalizeDateOnly(c.started_at),
      first_captured_at: normalizeDate(c.first_captured_at) || new Date().toISOString(),
      last_seen_at: normalizeDate(c.last_seen_at) || new Date().toISOString(),
      created_at: normalizeDate(c.created_at) || new Date().toISOString(),
      updated_at: normalizeDate(c.updated_at) || new Date().toISOString()
    }))
  });

  // D. Ads
  dataset.push({
    table: 'offer_ads',
    items: parseColl('offerminer_ads_v2').map(a => ({
      ...a,
      offer_id: ORPHAN_REMAP[a.offer_id] || a.offer_id,
      started_at: normalizeDate(a.started_at),
      first_seen_at: normalizeDate(a.first_seen_at) || new Date().toISOString(),
      last_seen_at: normalizeDate(a.last_seen_at) || new Date().toISOString(),
      created_at: normalizeDate(a.created_at) || new Date().toISOString(),
      updated_at: normalizeDate(a.updated_at) || new Date().toISOString()
    }))
  });

  // E. Ad Media
  dataset.push({
    table: 'offer_ad_media',
    items: parseColl('offerminer_ad_media_v2').map(m => ({
      ...m,
      offer_id: ORPHAN_REMAP[m.offer_id] || m.offer_id,
      created_at: m.created_at || new Date().toISOString(),
      updated_at: m.updated_at || new Date().toISOString()
    }))
  });

  // F. LP Captures
  dataset.push({
    table: 'landing_page_captures',
    items: parseColl('offerminer_lp_captures_v2').map(lp => ({
      ...lp,
      offer_id: ORPHAN_REMAP[lp.offer_id] || lp.offer_id,
      captured_at: normalizeDate(lp.captured_at) || new Date().toISOString(),
      created_at: normalizeDate(lp.created_at) || new Date().toISOString()
    }))
  });

  // G. LP Sections
  dataset.push({
    table: 'landing_page_sections',
    items: parseColl('offerminer_lp_sections_v2').map(s => ({
      ...s,
      offer_id: ORPHAN_REMAP[s.offer_id] || s.offer_id,
      created_at: normalizeDate(s.created_at) || new Date().toISOString()
    }))
  });

  // H. LP Links
  dataset.push({
    table: 'landing_page_links',
    items: parseColl('offerminer_lp_links_v2').map(l => ({
      ...l,
      offer_id: ORPHAN_REMAP[l.offer_id] || l.offer_id,
      created_at: normalizeDate(l.created_at) || new Date().toISOString()
    }))
  });

  // I. Deliverables
  dataset.push({
    table: 'offer_deliverables',
    items: parseColl('offerminer_deliverables_v2').map(d => ({
      ...d,
      created_at: normalizeDate(d.created_at) || new Date().toISOString()
    }))
  });

  // J. Bonuses
  dataset.push({
    table: 'offer_bonuses',
    items: parseColl('offerminer_bonuses_v2').map(b => ({
      ...b,
      created_at: normalizeDate(b.created_at) || new Date().toISOString()
    }))
  });

  // K. Snapshots
  dataset.push({
    table: 'offer_snapshots',
    items: parseColl('offerminer_snapshots_v2').filter(s => offerIds.has(s.offer_id)).map(s => ({
      ...s,
      oldest_ad_date: normalizeDateOnly(s.oldest_ad_date),
      captured_at: normalizeDate(s.captured_at) || new Date().toISOString()
    }))
  });

  // L. Order Bumps
  dataset.push({
    table: 'offer_order_bumps',
    items: parseColl('offerminer_orderbumps_v2')
  });

  // M. Funnels
  dataset.push({
    table: 'offer_funnel_steps',
    items: parseColl('offerminer_funnels_v2').map(f => ({
      ...f,
      verified_at: normalizeDate(f.verified_at)
    }))
  });

  // N. Proofs
  dataset.push({
    table: 'offer_proofs',
    items: parseColl('offerminer_proofs_v2').filter(p => offerIds.has(p.offer_id))
  });

  // O. Checkout Captures
  dataset.push({
    table: 'checkout_captures',
    items: parseColl('offerminer_checkout_captures_v2').map(c => ({
      ...c,
      offer_id: ORPHAN_REMAP[c.offer_id] || c.offer_id,
      captured_at: normalizeDate(c.captured_at) || new Date().toISOString(),
      created_at: normalizeDate(c.created_at) || new Date().toISOString()
    })).filter(c => offerIds.has(c.offer_id))
  });

  // P. Analysis Jobs
  dataset.push({
    table: 'offer_analysis_jobs',
    items: parseColl('offerminer_analysis_jobs_v2').map(j => ({
      ...j,
      offer_id: ORPHAN_REMAP[j.offer_id] || j.offer_id,
      started_at: normalizeDate(j.started_at),
      created_at: normalizeDate(j.created_at) || new Date().toISOString(),
      updated_at: normalizeDate(j.updated_at) || new Date().toISOString(),
      completed_at: normalizeDate(j.completed_at)
    })).filter(j => offerIds.has(j.offer_id))
  });

  // Q. Frontend Options
  dataset.push({
    table: 'offer_frontend_options',
    items: parseColl('offerminer_frontend_options_v2').map(o => ({
      ...o,
      original_option_id: o.id,
      id: `${o.offer_id}_${o.id}`,
      created_at: normalizeDate(o.created_at) || new Date().toISOString(),
      updated_at: normalizeDate(o.updated_at) || new Date().toISOString()
    }))
  });

  // R. Mapping Batches
  dataset.push({
    table: 'mapping_batches',
    items: parseColl('offerminer_mapping_batches_v2').map(b => ({
      ...b,
      started_at: normalizeDate(b.started_at),
      completed_at: normalizeDate(b.completed_at),
      created_at: normalizeDate(b.created_at) || new Date().toISOString(),
      updated_at: normalizeDate(b.updated_at) || new Date().toISOString()
    }))
  });

  // S. Mapping Jobs
  dataset.push({
    table: 'mapping_jobs',
    items: parseColl('offerminer_mapping_jobs_v2').map(j => ({
      ...j,
      started_at: normalizeDate(j.started_at),
      completed_at: normalizeDate(j.completed_at),
      created_at: normalizeDate(j.created_at) || new Date().toISOString(),
      updated_at: normalizeDate(j.updated_at) || new Date().toISOString()
    }))
  });

  // T. Agent Staged
  dataset.push({
    table: 'agent_staged_offers',
    items: parseColl('offerminer_agent_staged_v2')
  });

  // U. Deep Dives
  dataset.push({
    table: 'deep_dives',
    items: parseColl('offerminer_deepdives_v2')
  });

  // V. Import Rows
  dataset.push({
    table: 'import_rows',
    items: parseColl('offerminer_import_rows_v2').map(r => ({
      ...r,
      offer_id: r.offer_id && offerIds.has(r.offer_id) ? r.offer_id : null,
      created_at: r.created_at || new Date().toISOString()
    }))
  });

  // W. Creative Capture Jobs
  dataset.push({
    table: 'creative_capture_jobs',
    items: parseColl('offerminer_capturejobs_v2').map(j => {
      const { debug_data, mode, ...rest } = j;
      return {
        ...rest,
        started_at: normalizeDate(j.started_at),
        finished_at: normalizeDate(j.finished_at),
        created_at: normalizeDate(j.created_at) || new Date().toISOString(),
        updated_at: normalizeDate(j.updated_at) || new Date().toISOString()
      };
    })
  });

  // X. User Settings
  const settingsObj = rawStore['offerminer_settings_v2'];
  if (settingsObj) {
    const parsed = typeof settingsObj === 'string' ? JSON.parse(settingsObj) : settingsObj;
    dataset.push({
      table: 'user_settings',
      items: [{
        id: 'default-settings',
        min_price: parsed.min_price || 10,
        max_price: parsed.max_price || 50,
        min_ads: parsed.min_ads || 5,
        max_ads: parsed.max_ads || 50,
        min_days: parsed.min_days || 10,
        max_days: parsed.max_days || 30,
        require_faceless: parsed.require_faceless !== undefined ? parsed.require_faceless : true,
        updated_at: parsed.updated_at || new Date().toISOString()
      }]
    });
  }

  // Estatísticas do plano
  console.log('--- RESUMO DE PREPARAÇÃO DOS DADOS ---');
  let totalItems = 0;
  for (const group of dataset) {
    totalItems += group.items.length;
    console.log(`- ${group.table.padEnd(25)}: ${group.items.length} registros`);
  }
  console.log(`TOTAL DE REGISTROS A SINCRONIZAR: ${totalItems}\n`);

  if (!isExecute) {
    console.log('============================================================');
    console.log('DRY-RUN CONCLUÍDO. Nenhuma alteração foi realizada no Supabase.');
    console.log('Para executar a migração definitiva, execute:');
    console.log('npx tsx scripts/sync_store_to_supabase.ts --execute');
    console.log('============================================================');
    return;
  }

  // Executar migração por tabela em lotes
  const BATCH_SIZE = 50;
  console.log('⏳ INICIANDO GRAVAÇÃO NO SUPABASE...\n');

  for (const group of dataset) {
    const { table, items, conflictKey = 'id' } = group;
    console.log(`➡️ Sincronizando ${table} (${items.length} itens)...`);
    let inserted = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from(table)
        .upsert(chunk, { onConflict: conflictKey });

      if (upsertError) {
        console.error(`❌ Erro em ${table} (lote ${i}-${i + chunk.length}):`, upsertError.message);
        throw new Error(`Falha crítica na tabela ${table}: ${upsertError.message}`);
      }
      inserted += chunk.length;
    }
    console.log(`✅ ${table}: ${inserted}/${items.length} sincronizados com sucesso.`);
  }

  console.log('\n============================================================');
  console.log('🎉 MIGRAÇÃO CONCLUÍDA COM 100% DE SUCESSO!');
  console.log('============================================================');

  // Validação imediata pós-execução
  const { count: finalOffersCount } = await supabase.from('offers').select('*', { count: 'exact', head: true });
  console.log(`📊 Total de ofertas agora no Supabase Cloud: ${finalOffersCount}`);

  // Verificar ofertas alvo
  const { data: target1 } = await supabase.from('offers').select('id, product_name').eq('id', '20554e86-d1af-4523-a344-c931e4d2a6bc').single();
  const { data: target2 } = await supabase.from('offers').select('id, product_name').eq('id', '8b3828be-c1ba-44c9-a7e8-704837c1613a').single();
  console.log('Target 1 (Escolhida Para Sempre):', target1 ? '✅ ENCONTRADA' : '❌ NÃO ENCONTRADA');
  console.log('Target 2 (Mapa do Amor):', target2 ? '✅ ENCONTRADA' : '❌ NÃO ENCONTRADA');
}

main().catch((err) => {
  console.error('\n💥 ERRO FATAL NA MIGRAÇÃO:', err);
  process.exit(1);
});
