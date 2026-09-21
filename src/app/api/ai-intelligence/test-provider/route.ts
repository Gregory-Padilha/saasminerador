import { NextRequest, NextResponse } from 'next/server';
import { getProviderAdapter } from '@/lib/ai-intelligence/orchestrator';
import { ProviderId, AnalysisMode } from '@/lib/ai-intelligence/types';

export const runtime = 'nodejs';

/**
 * 4-Step Interactive Diagnostic Test Endpoint for AI Providers & Tool Layer
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { provider = 'gemini', mode = 'quick' } = body as { provider?: ProviderId; mode?: AnalysisMode };

    const adapter = getProviderAdapter(provider);
    const result = await adapter.runDiagnostic(mode);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        code: 'DIAGNOSTIC_FAILED',
        message: `Falha ao executar teste de diagnóstico: ${err.message}`,
      },
      { status: 500 }
    );
  }
}
