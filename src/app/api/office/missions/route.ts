import { NextResponse } from 'next/server';
import { officeDbService, OfficeMissionRecord } from '@/lib/supabase/office-db';
import { createEmptyCaseFile } from '@/lib/ai-office/case-file';
import { startOrAdvanceMission } from '@/lib/ai-office/scheduler';

export async function GET() {
  try {
    const missions = await officeDbService.listMissions();
    return NextResponse.json({ missions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      mode = 'CREATE_FROM_ZERO',
      goal,
      profileId = 'openai_balanced',
      budgetMode = 'BALANCED',
      attachedOfferIds = [],
      missionBrief,
    } = body;

    const finalGoal = goal || missionBrief?.objective;

    if (!finalGoal || !finalGoal.trim()) {
      return NextResponse.json({ error: 'O objetivo da missão é obrigatório.' }, { status: 400 });
    }

    const missionId = `mis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const caseFile = createEmptyCaseFile(missionId, mode, finalGoal);

    // If missionBrief is provided, attach constraints & preferences to caseFile
    if (missionBrief) {
      caseFile.missionConstraints = {
        primaryOfferId: missionBrief.primaryOfferId,
        referenceOfferIds: missionBrief.referenceOfferIds || attachedOfferIds,
        market: missionBrief.market,
        niche: missionBrief.niche,
        avoidedNiches: missionBrief.avoidedNiches,
        facelessPreference: missionBrief.facelessPreference,
        preferredFormats: missionBrief.preferredFormats,
        excludedFormats: missionBrief.excludedFormats,
        productionComplexity: missionBrief.productionComplexity,
        ticketOption: missionBrief.ticketOption,
        monetizationPreferences: missionBrief.monetizationPreferences,
        priorities: missionBrief.priorities,
        constraints: missionBrief.constraints,
        budgetProfile: missionBrief.budgetProfile,
      };
    }

    const finalAttachedOfferIds = Array.from(
      new Set([
        ...(attachedOfferIds || []),
        ...(missionBrief?.primaryOfferId ? [missionBrief.primaryOfferId] : []),
        ...(missionBrief?.referenceOfferIds || []),
      ])
    );

    const budgetProfileToModeMap: Record<string, 'ECONOMY' | 'BALANCED' | 'DEEP'> = {
      ECONOMICO: 'ECONOMY',
      BALANCEADO: 'BALANCED',
      PROFUNDO: 'DEEP',
    };

    const finalBudgetMode = missionBrief?.budgetProfile
      ? budgetProfileToModeMap[missionBrief.budgetProfile] || budgetMode
      : budgetMode;

    const newMission: OfficeMissionRecord = {
      id: missionId,
      title:
        title ||
        missionBrief?.missionName ||
        (mode === 'MODEL_EXISTING_OFFER' ? 'Modelagem de Oferta Existente' : 'Criação de Oferta do Zero'),
      mode: missionBrief?.missionType || mode,
      status: 'PLANNING',
      profileId,
      budgetMode: finalBudgetMode,
      goal: finalGoal,
      attachedOfferIds: finalAttachedOfferIds,
      caseFile,
      missionBrief,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await officeDbService.saveMission(newMission);

    // Auto start initial phase in background or sync
    startOrAdvanceMission(missionId).catch((err) => console.error('Error starting mission:', err));

    return NextResponse.json({ mission: newMission });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
