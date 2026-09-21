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
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

console.log('--- SUPABASE CONFIGURATION CHECK ---');
console.log('URL:', url ? url : '(vazio)');
console.log('ANON KEY:', key ? `${key.substring(0, 12)}...` : '(vazio)');

if (!url || !key || url.includes('your-project') || key.includes('your-anon-public-key')) {
  console.log('\n❌ Supabase ainda não está configurado no .env com credenciais reais.');
  console.log('Instruções:');
  console.log('1. Abra https://supabase.com/dashboard');
  console.log('2. Copie a Project URL (ex: https://xyz.supabase.co)');
  console.log('3. Copie a Anon Public Key (eyJhbGci...)');
  console.log('4. Cole no arquivo .env');
  console.log('5. Execute o script supabase/schema.sql no SQL Editor do Supabase.');
  process.exit(0);
}

const supabase = createClient(url, key);

async function checkTables() {
  const tables = [
    'offers',
    'offer_snapshots',
    'offer_creatives',
    'offer_deliverables',
    'offer_bonuses',
    'offer_order_bumps',
    'offer_upsells',
    'offer_funnel_steps',
    'offer_analysis',
    'import_batches',
    'deep_dives',
    'saved_views',
    'user_settings',
    'profiles',
  ];

  console.log('\n🔍 Verificando tabelas no Supabase...\n');

  let missingCount = 0;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ Tabela [${table}]: NÃO encontrada ou sem permissão (${error.message})`);
        missingCount++;
      } else {
        console.log(`✅ Tabela [${table}]: Pronta e acessível!`);
      }
    } catch (err: any) {
      console.log(`❌ Tabela [${table}]: Erro de rede (${err.message})`);
      missingCount++;
    }
  }

  if (missingCount === 0) {
    console.log('\n🎉 SUCESSO TOTAL: Todas as 14 tabelas estão criadas e prontas no Supabase!');
  } else {
    console.log(`\n⚠️  ${missingCount} tabelas precisam ser criadas. Execute o arquivo supabase/schema.sql no Supabase SQL Editor.`);
  }
}

checkTables();
