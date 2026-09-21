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
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const supabase = createClient(url, key);

async function main() {
  const store = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '.data/store.json'), 'utf-8'));
  const rawOffers = JSON.parse(store['offerminer_offers_v2']);

  console.log('=== FASE 15: VALIDAR AMOSTRA DE 10 OFERTAS ALEATÓRIAS/RELEVANTES ===\n');
  const sampleIndices = [3, 11, 22, 33, 44, 55, 66, 77, 88, 94];
  let matched = 0;

  for (const idx of sampleIndices) {
    const s = rawOffers[idx];
    if (!s) continue;

    const { data: c, error } = await supabase.from('offers').select('*').eq('id', s.id).single();
    if (error || !c) {
      console.log(`❌ [${idx}] Não encontrada: ${s.id}`);
      continue;
    }

    const nameMatch = (s.product_name || s.offer_name) === c.product_name;
    const adsMatch = s.active_ads_count === c.active_ads_count;
    const statusMatch = s.status === c.status;
    const lpMatch = (s.landing_page_url || '') === (c.landing_page_url || '');

    if (nameMatch && adsMatch && statusMatch && lpMatch) {
      matched++;
      console.log(`✅ [${idx}] ID: ${c.id.substring(0, 8)}... | Nome: ${c.product_name.padEnd(35)} | Ads: ${String(c.active_ads_count).padStart(3)} | Status: ${c.status.padEnd(10)} -> 100% IDENTICAL`);
    } else {
      console.log(`⚠️ [${idx}] Divergência parcial:`, { nameMatch, adsMatch, statusMatch, lpMatch });
    }
  }

  console.log(`\n🎉 Total da amostra validada: ${matched} / ${sampleIndices.length} ofertas idênticas!`);
}

main().catch(console.error);
