import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export async function GET() {
  const configured = isSupabaseConfigured();

  if (!configured || !supabase) {
    return NextResponse.json({
      configured: false,
      message: 'Supabase ainda não configurado no arquivo .env (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).',
      tables: [],
    });
  }

  try {
    const tableChecks = [
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

    const results: Record<string, { exists: boolean; error?: string }> = {};

    for (const table of tableChecks) {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        results[table] = { exists: false, error: error.message };
      } else {
        results[table] = { exists: true };
      }
    }

    const allExist = Object.values(results).every((r) => r.exists);

    return NextResponse.json({
      configured: true,
      tablesReady: allExist,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        configured: true,
        tablesReady: false,
        error: err.message || 'Erro ao comunicar com Supabase',
      },
      { status: 500 }
    );
  }
}
