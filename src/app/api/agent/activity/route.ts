import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface AgentActivityState {
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'STOPPED';
  task: string;
  current_step: number;
  max_steps: number;
  next_goal: string;
  last_action?: string;
  started_at: string | null;
  updated_at: string;
  task_id?: string;
}

// In-memory singleton state
let globalActivityState: AgentActivityState = {
  status: 'IDLE',
  task: '',
  current_step: 0,
  max_steps: 100,
  next_goal: '',
  started_at: null,
  updated_at: new Date().toISOString(),
};

const TIMEOUT_SECONDS = 65; // Auto-timeout if no ping for 65s

export async function GET() {
  try {
    const now = Date.now();
    const lastUpdate = new Date(globalActivityState.updated_at).getTime();
    const diffSeconds = Math.floor((now - lastUpdate) / 1000);

    // If marked running but no update within timeout, reset to IDLE
    if (globalActivityState.status === 'RUNNING' && diffSeconds > TIMEOUT_SECONDS) {
      globalActivityState = {
        ...globalActivityState,
        status: 'IDLE',
        next_goal: 'Tempo limite atingido sem atividade do navegador.',
        updated_at: new Date().toISOString(),
      };
    }

    let elapsedSeconds = 0;
    if (globalActivityState.started_at && globalActivityState.status === 'RUNNING') {
      const started = new Date(globalActivityState.started_at).getTime();
      elapsedSeconds = Math.max(0, Math.floor((now - started) / 1000));
    }

    return NextResponse.json({
      success: true,
      activity: {
        ...globalActivityState,
        is_running: globalActivityState.status === 'RUNNING',
        elapsed_seconds: elapsedSeconds,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao consultar atividade do agente.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nowIso = new Date().toISOString();

    const incomingStatus = (body.status || 'RUNNING').toUpperCase();

    if (incomingStatus === 'RUNNING') {
      const isNewRun = globalActivityState.status !== 'RUNNING' || body.resetStartTime;
      globalActivityState = {
        status: 'RUNNING',
        task: body.task || globalActivityState.task || 'Mineração de ofertas em andamento',
        current_step: typeof body.current_step === 'number' ? body.current_step : (body.step || globalActivityState.current_step || 1),
        max_steps: typeof body.max_steps === 'number' ? body.max_steps : (globalActivityState.max_steps || 100),
        next_goal: body.next_goal || body.goal || body.action || globalActivityState.next_goal || 'Iniciando varredura no navegador...',
        last_action: body.last_action || body.action || globalActivityState.last_action,
        started_at: isNewRun ? (body.started_at || nowIso) : (globalActivityState.started_at || nowIso),
        updated_at: nowIso,
        task_id: body.task_id || globalActivityState.task_id,
      };
    } else if (incomingStatus === 'RESET' || incomingStatus === 'IDLE') {
      globalActivityState = {
        status: 'IDLE',
        task: '',
        current_step: 0,
        max_steps: 100,
        next_goal: '',
        started_at: null,
        updated_at: nowIso,
      };
    } else {
      // COMPLETED, STOPPED, ERROR
      globalActivityState = {
        ...globalActivityState,
        status: incomingStatus as any,
        next_goal: body.next_goal || (incomingStatus === 'COMPLETED' ? 'Mineração concluída!' : 'Tarefa encerrada.'),
        updated_at: nowIso,
      };
    }

    return NextResponse.json({
      success: true,
      activity: {
        ...globalActivityState,
        is_running: globalActivityState.status === 'RUNNING',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao registrar atividade do agente.' },
      { status: 500 }
    );
  }
}
