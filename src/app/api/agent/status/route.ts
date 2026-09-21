import { NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';

export const runtime = 'nodejs';

export async function GET() {
  const agentUrl = process.env.BROWSER_AGENT_URL || 'http://127.0.0.1:7788';
  let agentOnline = false;
  let latencyMs = 0;

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(agentUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok || res.status === 200 || res.status === 302) {
      agentOnline = true;
      latencyMs = Date.now() - startTime;
    }
  } catch {
    agentOnline = false;
    latencyMs = -1;
  }

  // Get shared database stats
  let totalOffersShared = 0;
  let uniqueNiches: string[] = [];
  try {
    const offers = await dbService.getOffers();
    totalOffersShared = offers.length;
    uniqueNiches = Array.from(
      new Set(offers.map((o) => o.niche).filter((n): n is string => Boolean(n)))
    );
  } catch {
    // fallback
  }

  return NextResponse.json({
    success: true,
    agent: {
      online: agentOnline,
      url: agentUrl,
      port: 7788,
      latencyMs,
      type: 'Browser-Use WebUI',
      engine: 'Playwright + LangChain + Python',
    },
    database: {
      totalOffersShared,
      nichesCount: uniqueNiches.length,
      sampleNiches: uniqueNiches.slice(0, 6),
    },
  });
}
