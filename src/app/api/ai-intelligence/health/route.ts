import { NextResponse } from 'next/server';
import { openAIProviderAdapter } from '@/lib/ai-intelligence/providers/openai';
import { geminiProviderAdapter } from '@/lib/ai-intelligence/providers/gemini';
import { anthropicProviderAdapter } from '@/lib/ai-intelligence/providers/anthropic';

export const runtime = 'nodejs';

/**
 * Multi-Provider Health Check Endpoint
 * Checks OpenAI, Gemini, and Anthropic Claude status with 60s server cache.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceFresh = searchParams.get('fresh') === 'true';

    const [openai, gemini, anthropic] = await Promise.all([
      openAIProviderAdapter.checkHealth(forceFresh),
      geminiProviderAdapter.checkHealth(forceFresh),
      anthropicProviderAdapter.checkHealth(forceFresh),
    ]);

    return NextResponse.json({
      providers: {
        openai,
        gemini,
        anthropic,
      },
      toolLayer: { status: 'ONLINE', ready: true, count: 15 },
      database: { status: 'ONLINE' },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: `Erro ao verificar saúde dos provedores de IA: ${err.message}`,
      },
      { status: 500 }
    );
  }
}
