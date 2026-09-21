import { NextResponse } from 'next/server';
import { compileMiningPrompt } from '@/lib/ai-intelligence/mining-prompt-compiler';
import { refineMiningPromptWithClaude } from '@/lib/ai-intelligence/mining-prompt-architect';
import { dbService } from '@/lib/supabase/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { config, compiledPrompt } = body;

    if (!config) {
      return NextResponse.json({ error: 'A configuração da mineração é obrigatória.' }, { status: 400 });
    }

    // Generate base prompt if not passed
    let basePrompt = compiledPrompt;
    if (!basePrompt) {
      const dbOffers = await dbService.getOffers().catch(() => []);
      const compiled = compileMiningPrompt(config, dbOffers);
      basePrompt = compiled.prompt;
    }

    const result = await refineMiningPromptWithClaude(config, basePrompt);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Error in mining prompt refine route:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
