import { NextRequest, NextResponse } from 'next/server';
import { officeDbService } from '@/lib/supabase/office-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const missionId = searchParams.get('missionId');

    if (!missionId) {
      return NextResponse.json({ error: 'missionId parameter is required' }, { status: 400 });
    }

    const events = await officeDbService.getOfficeEventsForMission(missionId);
    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching office events' }, { status: 500 });
  }
}
