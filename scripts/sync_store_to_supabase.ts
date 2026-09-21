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

async function main() {
  const isExecute = process.argv.includes('--execute');

  console.log('============================================================');
  console.log('OFFER MINER — SINCRONIZAÇÃO SEGURA: STORE LOCAL -> SUPABASE');
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
  console.log(`🔐 Mode: ${isExecute ? 'EXECUTE (Modificará o banco)' : 'DRY-RUN (Somente Leitura)'}\n`);

  const supabase = createClient(url, key);

  // 1. Verificar se a tabela offers existe
  const { error: tableError } = await supabase.from('offers').select('id', { count: 'exact', head: true });
  if (tableError) {
    console.error(`❌ Tabela 'public.offers' não encontrada no projeto ${projectRef}.`);
    console.error(`   Erro: ${tableError.message}`);
    console.error('\n👉 AÇÃO NECESSÁRIA:');
    console.error('   Abra o SQL Editor do Supabase neste projeto e execute todo o conteúdo de:');
    console.error('   supabase/schema.sql\n');
    process.exit(1);
  }

  // 2. Ler arquivo .data/store.json
  const storePath = path.resolve(process.cwd(), '.data/store.json');
  if (!fs.existsSync(storePath)) {
    console.error(`❌ Arquivo não encontrado: ${storePath}`);
    process.exit(1);
  }

  const rawStore = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  const rawOffersStr = rawStore['offerminer_offers_v2'];
  const offers: any[] = rawOffersStr ? JSON.parse(rawOffersStr) : [];

  console.log(`📦 Ofertas encontradas no .data/store.json: ${offers.length}`);

  // 3. Contar quantas ofertas já existem no Supabase
  const { count: existingCount } = await supabase.from('offers').select('*', { count: 'exact', head: true });
  console.log(`☁️  Ofertas já existentes no Supabase: ${existingCount ?? 0}\n`);

  if (!isExecute) {
    console.log('------------------------------------------------------------');
    console.log('DRY-RUN CONCLUÍDO. Nenhuma alteração foi realizada.');
    console.log('Para sincronizar os dados para o Supabase, execute:');
    console.log('npx tsx scripts/sync_store_to_supabase.ts --execute');
    console.log('------------------------------------------------------------');
    return;
  }

  // 4. Executar UPSERT em lotes de 20
  console.log('⏳ Sincronizando ofertas...');
  const batchSize = 20;
  let inserted = 0;

  for (let i = 0; i < offers.length; i += batchSize) {
    const chunk = offers.slice(i, i + batchSize).map((o) => {
      // Filtrar campos de relações que não pertencem à tabela offers
      const {
        snapshots,
        creatives,
        deliverables,
        bonuses,
        order_bumps,
        upsells,
        funnel_steps,
        frontend_options,
        analysis,
        ...offerRow
      } = o;
      return offerRow;
    });

    const { error: insertError } = await supabase
      .from('offers')
      .upsert(chunk, { onConflict: 'id' });

    if (insertError) {
      console.error(`❌ Erro no lote ${i} - ${i + chunk.length}:`, insertError.message);
    } else {
      inserted += chunk.length;
      console.log(`✅ Lote sincronizado: ${inserted}/${offers.length} ofertas.`);
    }
  }

  console.log(`\n🎉 Concluído com sucesso! ${inserted} ofertas sincronizadas no Supabase.`);
}

main().catch(console.error);
