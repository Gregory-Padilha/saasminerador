import { NextResponse } from 'next/server';
import { geminiProviderAdapter } from '@/lib/ai-intelligence/providers/gemini';

export const runtime = 'nodejs';

export async function POST() {
  const result = await geminiProviderAdapter.runDiagnostic();
  return NextResponse.json(result);
}
