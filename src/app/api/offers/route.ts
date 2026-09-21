import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    if (!body || !body.product_name) {
      return NextResponse.json({ error: 'Dados da oferta inválidos.' }, { status: 400 });
    }

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
