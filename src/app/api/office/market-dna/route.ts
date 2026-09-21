import { NextResponse } from 'next/server';
import { generateMarketDnaCatalog } from '@/lib/ai-office/market-dna';

export async function GET() {
  try {
    const catalog = await generateMarketDnaCatalog();
    return NextResponse.json({ marketDna: catalog });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const catalog = await generateMarketDnaCatalog(true);
    return NextResponse.json({ marketDna: catalog });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
