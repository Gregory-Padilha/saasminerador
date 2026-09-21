import { NextRequest, NextResponse } from 'next/server';
import { OfferImportService } from '@/lib/import/offer-import-service';
import { dbService } from '@/lib/supabase/db';
import { ImportBatchType, ImportPreviewItem } from '@/lib/import/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      batchType,
      fileName,
      previewItems,
      globalMetadata,
      clientImportRequestId,
    } = body as {
      batchType: ImportBatchType;
      fileName?: string | null;
      previewItems: ImportPreviewItem[];
      globalMetadata?: Record<string, any>;
      clientImportRequestId?: string;
    };

    if (!previewItems || !Array.isArray(previewItems) || previewItems.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum registro para importação foi fornecido.' },
        { status: 400 }
      );
    }

    // Load existing offers on server to ensure strict deduplication check
    const existingOffers = await dbService.getOffers();

    // Execute server-authoritative import batch
    const result = await OfferImportService.executeImport({
      batchType: batchType || 'JSON_PASTE',
      fileName,
      previewItems,
      existingOffers,
      globalMetadata,
      clientImportRequestId,
    });

    // Authoritative read of latest offers to send back to client
    const allCurrentOffers = await dbService.getOffers();
    const newlyCreatedOffers = allCurrentOffers.filter((o) => o.source_import_batch_id === result.batchId);

    return NextResponse.json({
      success: true,
      result,
      persistedOffers: newlyCreatedOffers,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/import Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao persistir importação no servidor.' },
      { status: 500 }
    );
  }
}
