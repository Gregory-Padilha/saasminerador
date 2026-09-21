import { NextResponse } from 'next/server';
import { miningPromptDbService, MiningPromptRecord } from '@/lib/ai-intelligence/mining-prompt-db';

export async function GET() {
  try {
    const prompts = await miningPromptDbService.listMiningPrompts();
    return NextResponse.json({ prompts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, configJson, generatedPrompt, refinedPrompt, model = 'claude-sonnet-5' } = body;

    if (!name || !configJson || !generatedPrompt) {
      return NextResponse.json({ error: 'Name, configJson and generatedPrompt are required.' }, { status: 400 });
    }

    const id = body.id || `mp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: MiningPromptRecord = {
      id,
      name,
      configJson,
      generatedPrompt,
      refinedPrompt,
      model,
      version: (body.version || 0) + 1,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await miningPromptDbService.saveMiningPrompt(record);
    return NextResponse.json({ prompt: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
