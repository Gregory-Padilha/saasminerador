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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const keyToUse = serviceRoleKey || anonKey;

console.log('Using Supabase URL:', url);
console.log('Using Key type:', serviceRoleKey ? 'SERVICE_ROLE' : 'ANON');

const supabase = createClient(url, keyToUse);

async function diagnose() {
  console.log('\n=== 1. BUSCANDO OFFERS COM STATUS ANALYZING OU PLACEHOLDER ===');
  const { data: analyzingOffers, error: err1 } = await supabase
    .from('offers')
    .select('id, product_name, advertiser, status, lp_mapping_status, checkout_mapping_status, meta_ads_url, landing_page_url, created_at, updated_at, price, active_ads_count, days_running, oldest_ad_date')
    .or('status.eq.ANALYZING,product_name.ilike.%Analisando Anúncios%')
    .order('created_at', { ascending: false });

  if (err1) {
    console.error('Erro ao buscar offers:', err1);
  } else {
    console.log(`Encontradas ${analyzingOffers?.length || 0} offers com status ANALYZING:`);
    analyzingOffers?.forEach((o) => {
      console.log(JSON.stringify(o, null, 2));
    });
  }

  console.log('\n=== 2. BUSCANDO OS ÚLTIMOS 10 REGISTROS DA TABELA OFFERS ===');
  const { data: recentOffers, error: err2 } = await supabase
    .from('offers')
    .select('id, product_name, advertiser, status, lp_mapping_status, checkout_mapping_status, meta_ads_url, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (err2) {
    console.error('Erro ao buscar últimas offers:', err2);
  } else {
    console.log(`Últimas ${recentOffers?.length || 0} offers criadas:`);
    console.table(recentOffers);
  }

  console.log('\n=== 3. BUSCANDO JOBS EM OFFER_ANALYSIS_JOBS ===');
  const { data: jobs, error: err3 } = await supabase
    .from('offer_analysis_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (err3) {
    console.error('Erro ao buscar jobs:', err3);
  } else {
    console.log(`Encontrados ${jobs?.length || 0} jobs:`);
    jobs?.forEach((j) => {
      console.log(JSON.stringify(j, null, 2));
    });
  }
}

diagnose().catch(console.error);
