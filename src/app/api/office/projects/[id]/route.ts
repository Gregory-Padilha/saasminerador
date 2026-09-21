import { NextResponse } from 'next/server';
import { officeDbService } from '@/lib/supabase/office-db';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const project = await officeDbService.getOfferProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Projeto de Oferta não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const body = await req.json();
    const { action, decisionId, newStatus, newRationale, newOfferSpec } = body;

    let project = await officeDbService.getOfferProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Projeto de Oferta não encontrado' }, { status: 404 });
    }

    if (action === 'edit_decision' && decisionId) {
      project.decisionLedger = project.decisionLedger.map((d: any) => {
        if (d.id === decisionId) {
          return {
            ...d,
            status: newStatus || d.status,
            rationale: newRationale ? `${d.rationale} [HUMAN OVERRIDE: ${newRationale}]` : d.rationale,
          };
        }
        return d;
      });
    }

    if (newOfferSpec) {
      project.offerSpec = { ...project.offerSpec, ...newOfferSpec };
    }

    await officeDbService.saveOfferProject(project);
    return NextResponse.json({ project });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
