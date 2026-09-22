import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/auth/require-workspace';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMappingStats } from '@/lib/mapping/stats';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  let wsCtx;
  try {
    wsCtx = await requireWorkspace();
  } catch (authErr: any) {
    return NextResponse.json(
      { success: false, error: authErr.message || 'Não autorizado.', code: 'UNAUTHORIZED' },
      { status: authErr.statusCode || 401 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const summary = await getMappingStats(wsCtx.workspaceId, supabase);
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    console.error('[GET /api/mapping/summary Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao calcular estatísticas da central.' },
      { status: 500 }
    );
  }
}
