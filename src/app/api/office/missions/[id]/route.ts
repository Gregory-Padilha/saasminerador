import { NextResponse } from 'next/server';
import { officeDbService } from '@/lib/supabase/office-db';
import { startOrAdvanceMission } from '@/lib/ai-office/scheduler';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: missionId } = await context.params;
    const mission = await officeDbService.getMission(missionId);
    if (!mission) {
      return NextResponse.json({ error: 'Missão não encontrada' }, { status: 404 });
    }

    const agentRuns = await officeDbService.getAgentRunsForMission(missionId);
    let project = null;
    if (mission.offerProjectId) {
      project = await officeDbService.getOfferProject(mission.offerProjectId);
    }

    return NextResponse.json({
      mission,
      agentRuns,
      project,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: missionId } = await context.params;
    const body = await req.json();
    const { action } = body;

    let mission = await officeDbService.getMission(missionId);
    if (!mission) {
      return NextResponse.json({ error: 'Missão não encontrada' }, { status: 404 });
    }

    if (action === 'start' || action === 'advance') {
      mission = await startOrAdvanceMission(missionId);
    } else if (action === 'pause') {
      mission.status = 'PAUSED';
      await officeDbService.saveMission(mission);
    } else if (action === 'cancel') {
      mission.status = 'CANCELLED';
      await officeDbService.saveMission(mission);
    }

    return NextResponse.json({ mission });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
