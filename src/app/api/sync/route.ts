import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value, offers } = body;

    if (key && value !== undefined) {
      let finalValue = value;
      if (key === 'offerminer_offers_v2' && Array.isArray(value)) {
        finalValue = value.filter((o: any) => {
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
      }

      // Save key-value to server store
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.resolve(process.cwd(), '.data');
      const dataFile = path.join(dataDir, 'store.json');

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      let store: Record<string, string> = {};
      if (fs.existsSync(dataFile)) {
        try {
          store = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        } catch {}
      }

      store[key] = JSON.stringify(finalValue);
      fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf-8');

      return NextResponse.json({ success: true, key });
    }

    if (offers && Array.isArray(offers)) {
      for (const offer of offers) {
        if (offer && offer.id) {
          await dbService.updateOffer(offer.id, offer);
        }
      }
      return NextResponse.json({ success: true, count: offers.length });
    }

    return NextResponse.json({ error: 'Payload de sincronização inválido.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao sincronizar dados.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const offers = await dbService.getOffers();
    return NextResponse.json({ offers, count: offers.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao obter dados.' }, { status: 500 });
  }
}
