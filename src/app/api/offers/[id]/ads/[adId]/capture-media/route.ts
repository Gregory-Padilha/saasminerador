import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { processMediaDownload, createTempDir, cleanupTempDir } from '@/lib/meta-ads/media-download';
import { uploadAdMedia } from '@/lib/meta-ads/storage';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; adId: string }> }
) {
  let tempDir: string | null = null;
  try {
    const { id: offerId, adId } = await params;
    const offer = await dbService.getOfferById(offerId);
    if (!offer) {
      return NextResponse.json({ error: 'Oferta não encontrada.' }, { status: 404 });
    }

    const allAds = await dbService.getOfferAds(offerId);
    const targetAd = allAds.find((a) => a.id === adId || a.meta_ad_id === adId);

    if (!targetAd) {
      return NextResponse.json({ error: 'Anúncio não encontrado.' }, { status: 404 });
    }

    const existingMedia = targetAd.media[0];
    const sourceUrl = existingMedia?.original_url;

    if (!sourceUrl || !sourceUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'Não há URL de mídia gravada para este anúncio.' },
        { status: 422 }
      );
    }

    const requestId = `retry-${Date.now()}`;
    tempDir = await createTempDir(requestId);

    const mediaType = existingMedia.media_type === 'video' ? 'video' : 'image';
    const dlResult = await processMediaDownload(
      mediaType,
      sourceUrl,
      undefined,
      tempDir,
      targetAd.meta_ad_id
    );

    if (!dlResult) {
      return NextResponse.json(
        { error: 'Falha ao baixar mídia a partir da URL original.' },
        { status: 500 }
      );
    }

    const uploadRes = await uploadAdMedia(
      offer.user_id,
      offer.id,
      targetAd.meta_ad_id,
      mediaType,
      dlResult.localFilePath,
      dlResult.thumbnailLocalPath
    );

    await dbService.saveOfferAdMedia({
      id: existingMedia.id,
      offer_id: offer.id,
      user_id: offer.user_id,
      offer_ad_id: targetAd.id,
      media_type: mediaType,
      mime_type: dlResult.mimeType,
      original_url: sourceUrl,
      storage_path: uploadRes.storagePath,
      thumbnail_path: uploadRes.thumbnailPath,
      media_url: uploadRes.mediaUrl,
      thumbnail_url: uploadRes.thumbnailUrl,
      file_hash: dlResult.fileHash,
      file_size: dlResult.fileSize,
      width: dlResult.width,
      height: dlResult.height,
      duration_seconds: dlResult.durationSeconds,
      is_primary: true,
      capture_status: 'completed',
    });

    await dbService.saveOfferAd({
      id: targetAd.id,
      offer_id: offer.id,
      status: 'Ativo',
    });

    const updatedAds = await dbService.getOfferAds(offerId);
    const updatedTarget = updatedAds.find((a) => a.id === targetAd.id);

    return NextResponse.json({
      success: true,
      ad: updatedTarget,
      ads: updatedAds,
    });
  } catch (err: any) {
    console.error('[SINGLE AD RETRY ERROR]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao reprocessar anúncio.' },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}
