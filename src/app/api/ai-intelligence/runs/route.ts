import { NextResponse } from 'next/server';
import { aiRunsService } from '@/lib/ai-intelligence/runs';
import { aiDbService } from '@/lib/ai-intelligence/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('id');
    const threadId = searchParams.get('threadId');
    const sinceSequence = parseInt(searchParams.get('sinceSequence') || '0', 10);

    if (threadId) {
      const latestRun = await aiRunsService.getLatestRunForThread(threadId);
      if (!latestRun) {
        return NextResponse.json({ run: null, events: [] });
      }
      const events = await aiRunsService.getEventsForRun(latestRun.id, sinceSequence);
      const messages = await aiDbService.getMessages(threadId);
      const assistantMessage = latestRun.assistant_message_id
        ? messages.find((m) => m.id === latestRun.assistant_message_id) || null
        : null;

      return NextResponse.json({ run: latestRun, assistantMessage, events });
    }

    if (!runId) {
      return NextResponse.json({ error: 'runId ou threadId é obrigatório' }, { status: 400 });
    }

    const run = await aiRunsService.getRunById(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run não encontrado' }, { status: 404 });
    }

    const events = await aiRunsService.getEventsForRun(runId, sinceSequence);
    let assistantMessage = null;
    if (run.assistant_message_id) {
      const messages = await aiDbService.getMessages(run.thread_id);
      assistantMessage = messages.find((m) => m.id === run.assistant_message_id) || null;
    }

    return NextResponse.json({ run, assistantMessage, events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao buscar run' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, runId } = body as { action: 'cancel' | 'reconnect'; runId: string };

    if (!runId) {
      return NextResponse.json({ error: 'runId é obrigatório' }, { status: 400 });
    }

    if (action === 'cancel') {
      const updated = await aiRunsService.updateRun(runId, {
        status: 'CANCELLED',
        completed_at: new Date().toISOString(),
        error_message: 'Execução cancelada pelo usuário.',
      });
      await aiRunsService.recordEvent(runId, 'error', { error: 'Execução cancelada pelo usuário.' });
      return NextResponse.json({ success: true, run: updated });
    }

    return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerenciar run' }, { status: 500 });
  }
}
