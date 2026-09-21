import { NextRequest, NextResponse } from 'next/server';
import { aiDbService } from '@/lib/ai-intelligence/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get('id');

  if (threadId) {
    const thread = await aiDbService.getThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Thread não encontrada' }, { status: 404 });
    }
    const messages = await aiDbService.getMessages(threadId);
    const toolCalls = await aiDbService.getToolCalls(threadId);

    return NextResponse.json({ thread, messages, toolCalls });
  }

  const threads = await aiDbService.getThreads();
  return NextResponse.json({ threads });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, threadId, pinned, archived, title } = body as {
      action?: 'pin' | 'archive' | 'rename' | 'create';
      threadId?: string;
      pinned?: boolean;
      archived?: boolean;
      title?: string;
    };

    if (action === 'create') {
      const newThreadId = threadId || `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const thread = await aiDbService.saveThread({
        id: newThreadId,
        title: title || 'Nova Análise',
        provider: 'gemini',
        model: process.env.AI_DEFAULT_MODEL || 'gemini-2.5-flash',
        mode: 'quick',
        pinned: false,
        archived: false,
        attachedOfferIds: [],
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ success: true, thread });
    }

    if (!threadId) {
      return NextResponse.json({ error: 'threadId é obrigatório' }, { status: 400 });
    }

    const thread = await aiDbService.getThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Thread não encontrada' }, { status: 404 });
    }

    if (typeof pinned === 'boolean') thread.pinned = pinned;
    if (typeof archived === 'boolean') thread.archived = archived;
    if (title && title.trim()) thread.title = title.trim();
    thread.updatedAt = new Date().toISOString();

    await aiDbService.saveThread(thread);
    return NextResponse.json({ success: true, thread });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const threadId = url.searchParams.get('id');

  if (!threadId) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  }

  await aiDbService.deleteThread(threadId);
  return NextResponse.json({ success: true, deletedId: threadId });
}
