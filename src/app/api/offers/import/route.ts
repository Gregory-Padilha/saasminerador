import { NextRequest, NextResponse } from 'next/server';
import { OfferImportService } from '@/lib/import/offer-import-service';
import { dbService } from '@/lib/supabase/db';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireWorkspace } from '@/lib/auth/require-workspace';
import { ImportBatchType, ImportPreviewItem } from '@/lib/import/types';
import { ImportPreviewRow } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // 1. Authenticate and resolve caller workspace
  let wsCtx;
  try {
    wsCtx = await requireWorkspace();
  } catch (authErr: any) {
    return NextResponse.json(
      { error: authErr.message || 'Unauthorized', code: authErr.name || 'UNAUTHORIZED' },
      { status: authErr.statusCode || 401 }
    );
  }

  // 2. Authorization Role Check: VIEWER cannot import
  if (wsCtx.role === 'VIEWER') {
    return NextResponse.json(
      { error: 'Usuários com perfil de Leitor (VIEWER) não têm permissão para importar ofertas.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      batchType,
      fileName,
      previewItems,
      previewRows,
      globalMetadata,
      clientImportRequestId,
    } = body as {
      batchType?: ImportBatchType;
      fileName?: string | null;
      previewItems?: ImportPreviewItem[];
      previewRows?: ImportPreviewRow[];
      globalMetadata?: Record<string, any>;
      clientImportRequestId?: string;
    };

    const hasJsonItems = Array.isArray(previewItems) && previewItems.length > 0;
    const hasXlsxRows = Array.isArray(previewRows) && previewRows.length > 0;

    if (!hasJsonItems && !hasXlsxRows) {
      return NextResponse.json(
        { error: 'Nenhum registro para importação foi fornecido.' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const totalReceived = hasJsonItems ? previewItems!.length : previewRows!.length;

    let result: any;

    if (hasXlsxRows) {
      // 3A. XLSX Import Pipeline
      const displayFileName = fileName || 'planilha_importada.xlsx';
      const batchResult = await dbService.executeImportBatch(
        displayFileName,
        previewRows!,
        1,
        {
          import_type: batchType || 'XLSX',
          metadata: globalMetadata,
          workspace_id: wsCtx.workspaceId,
          user_id: wsCtx.userId,
        },
        supabase
      );

      result = {
        batchId: batchResult.batch.id,
        fileName: displayFileName,
        type: batchType || 'XLSX',
        totalRecords: previewRows!.length,
        newOffersCount: batchResult.newCount,
        updatedOffersCount: batchResult.updatedCount,
        ignoredDuplicatesCount: batchResult.ignoredCount,
        invalidCount: batchResult.batch.invalid_rows,
        errorsList: [],
        persistedOfferIds: batchResult.persisted_offer_ids,
        persistedOffers: batchResult.persistedOffers,
      };
    } else {
      // 3B. JSON Import Pipeline
      const existingOffers = await dbService.getOffers(undefined, supabase);

      result = await OfferImportService.executeImport({
        batchType: batchType || 'JSON_PASTE',
        fileName,
        previewItems: previewItems!,
        existingOffers,
        globalMetadata,
        clientImportRequestId,
        workspaceId: wsCtx.workspaceId,
        userId: wsCtx.userId,
        client: supabase,
      });
    }

    // 4. Compute Structured Canonical Response
    const persistedOfferIds = result.persistedOfferIds || [];
    const insertedCount = result.newOffersCount;
    const duplicateCount = result.ignoredDuplicatesCount + result.updatedOffersCount;
    const rejectedCount = (result.invalidCount || 0) + (result.errorsList?.length || 0);

    let status: 'SUCCESS' | 'COMPLETED_NO_INSERT' | 'PARTIAL' | 'ERROR' = 'SUCCESS';
    if (insertedCount === 0) {
      status = duplicateCount > 0 ? 'COMPLETED_NO_INSERT' : 'ERROR';
    } else if (rejectedCount > 0) {
      status = 'PARTIAL';
    }

    console.log(`[POST /api/offers/import]: User ${wsCtx.userId} | Workspace ${wsCtx.workspaceId} | Received: ${totalReceived} | Inserted: ${insertedCount} | Duplicates: ${duplicateCount} | Status: ${status}`);

    return NextResponse.json({
      status,
      success: status !== 'ERROR',
      received: totalReceived,
      valid: totalReceived - (result.invalidCount || 0),
      inserted: insertedCount,
      updated: result.updatedOffersCount,
      duplicates: duplicateCount,
      rejected: rejectedCount,
      persisted_offer_ids: persistedOfferIds,
      result,
      persistedOffers: result.persistedOffers || [],
    });
  } catch (err: any) {
    console.error('[POST /api/offers/import Error]:', err);
    return NextResponse.json(
      {
        status: 'ERROR',
        success: false,
        error: err.message || 'Falha ao persistir importação no servidor.',
        error_code: err.code || 'IMPORT_FAILED',
      },
      { status: 500 }
    );
  }
}
