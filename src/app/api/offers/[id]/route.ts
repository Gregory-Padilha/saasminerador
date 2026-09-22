import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { requireUser } from '@/lib/auth/require-user';
import { requireWorkspace } from '@/lib/auth/require-workspace';
import { requireRole } from '@/lib/auth/require-role';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch (authErr: any) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const offer = await dbService.getOfferById(id);

    if (!offer) {
      return NextResponse.json({ error: 'Oferta não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ offer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireWorkspace();
  } catch (authErr: any) {
    return NextResponse.json(
      { error: authErr.message || 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: authErr.statusCode || 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await dbService.updateOffer(id, body);

    return NextResponse.json({ success: true, offer: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['OWNER', 'ADMIN']);
  } catch (authErr: any) {
    return NextResponse.json(
      { error: authErr.message || 'Ação destrutiva restrita a OWNER ou ADMIN.', code: 'FORBIDDEN' },
      { status: authErr.statusCode || 403 }
    );
  }

  try {
    const { id } = await params;
    await dbService.deleteOffer(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

