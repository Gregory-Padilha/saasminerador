import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { requireUser } from '@/lib/auth/require-user';
import { requireWorkspace } from '@/lib/auth/require-workspace';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (authErr: any) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const quickFilter = searchParams.get('quickFilter') || undefined;

    let offers = await dbService.getOffers(quickFilter ? { quickFilter: quickFilter as any } : undefined);

    offers = offers.filter((o: any) => {
      if (!o) return false;
      const name = (o.product_name || '').trim();
      if (!name || name === 'Oferta Sem Nome' || name === 'Sem nome' || name === '<<Sem Nome>>') return false;
      const lower = name.toLowerCase();
      if (
        lower.includes('test 9') ||
        lower.includes('test 14') ||
        lower.includes('test 6') ||
        lower.includes('test 5') ||
        lower.includes('test 7') ||
        lower.includes('test 2') ||
        lower.includes('test 1') ||
        lower.includes('colada diretamente') ||
        lower.includes('previamente mapeada') ||
        lower.includes('central mapping') ||
        lower.includes('checkout test') ||
        lower.includes('landing page test')
      ) return false;
      if (o.is_demo_data || o.is_test_data || o.source_type === 'TEST') return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (err: any) {
    console.error('[GET /api/offers Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao buscar ofertas do servidor.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let wsCtx;
  try {
    wsCtx = await requireWorkspace();
  } catch (authErr: any) {
    return NextResponse.json(
      { error: authErr.message || 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: authErr.statusCode || 401 }
    );
  }

  try {
    const body = await req.json();
    if (!body || !body.product_name) {
      return NextResponse.json({ error: 'Dados da oferta inválidos.' }, { status: 400 });
    }

    // Always enforce server-side workspace_id
    body.workspace_id = wsCtx.workspaceId;

    const savedOffer = await dbService.saveOffer(body);

    return NextResponse.json({
      success: true,
      offer: savedOffer,
    });
  } catch (err: any) {
    console.error('[POST /api/offers Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao salvar oferta no servidor.' },
      { status: 500 }
    );
  }
}
