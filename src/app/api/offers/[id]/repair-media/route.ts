import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { dbService } from '@/lib/supabase/db';
import { generateVideoThumbnail, probeMediaMetadata } from '@/lib/meta-ads/media-download';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    if (!offerId) {
      return NextResponse.json({ error: 'ID de oferta inválido.' }, { status: 400 });
    }

    const ads = await dbService.getOfferAds(offerId);
    const results: any[] = [];

    for (const ad of ads) {
      const metaAdId = ad.meta_ad_id;
      const mediaDir = path.join(
        process.cwd(),
        'public',
        'uploads',
        'offer-media',
        offerId,
        metaAdId
      );

      if (!fs.existsSync(mediaDir)) {
        continue;
      }

      // Check files in mediaDir
      const files = fs.readdirSync(mediaDir);
      const hasImageFile = files.some((f) => f.startsWith('image') || f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'));
      const hasVideoFile = files.some((f) => f.endsWith('.mp4'));

      // Process image files
      const imageFileName = files.find((f) => f.startsWith('image') || (f.endsWith('.webp') && f !== 'thumbnail.webp' && f !== 'card.webp'));
      if (imageFileName) {
        const imagePath = path.join(mediaDir, imageFileName);
        try {
          const imgBuffer = fs.readFileSync(imagePath);
          const metadata = await sharp(imgBuffer).metadata();

          if (metadata.width && metadata.height && metadata.width > 0 && metadata.height > 0) {
            // Normalize to WebP if not already true webp
            const webpBuffer = await sharp(imgBuffer)
              .rotate()
              .webp({ quality: 90 })
              .toBuffer();

            const finalImagePath = path.join(mediaDir, 'image.webp');
            fs.writeFileSync(finalImagePath, webpBuffer);

            // Generate thumbnail.webp
            const thumbBuffer = await sharp(webpBuffer)
              .resize({ width: 800, withoutEnlargement: true, fit: 'inside' })
              .webp({ quality: 85 })
              .toBuffer();
            const finalThumbPath = path.join(mediaDir, 'thumbnail.webp');
            fs.writeFileSync(finalThumbPath, thumbBuffer);

            // Find or update image media row
            let imageMedia = ad.media.find((m) => m.media_type === 'image');
            if (imageMedia) {
              await dbService.saveOfferAdMedia({
                ...imageMedia,
                mime_type: 'image/webp',
                file_size: webpBuffer.length,
                width: metadata.width,
                height: metadata.height,
                storage_path: `default-user/${offerId}/${metaAdId}/image.webp`,
                media_url: `/uploads/offer-media/${offerId}/${metaAdId}/image.webp`,
                thumbnail_path: `default-user/${offerId}/${metaAdId}/thumbnail.webp`,
                thumbnail_url: `/uploads/offer-media/${offerId}/${metaAdId}/thumbnail.webp`,
                capture_status: 'completed',
              });
            } else {
              await dbService.saveOfferAdMedia({
                offer_id: offerId,
                offer_ad_id: ad.id,
                media_type: 'image',
                mime_type: 'image/webp',
                file_hash: `img-${metaAdId}`,
                file_size: webpBuffer.length,
                width: metadata.width,
                height: metadata.height,
                storage_path: `default-user/${offerId}/${metaAdId}/image.webp`,
                media_url: `/uploads/offer-media/${offerId}/${metaAdId}/image.webp`,
                thumbnail_path: `default-user/${offerId}/${metaAdId}/thumbnail.webp`,
                thumbnail_url: `/uploads/offer-media/${offerId}/${metaAdId}/thumbnail.webp`,
                is_primary: true,
                capture_status: 'completed',
              });
            }

            results.push({ metaAdId, type: 'image', status: 'repaired', width: metadata.width, height: metadata.height });
          }
        } catch (imgErr: any) {
          console.warn(`[REPAIR] Image repair failed for ${metaAdId}:`, imgErr.message);
        }
      }

      // Process video files
      const videoFileName = files.find((f) => f.endsWith('.mp4'));
      if (videoFileName) {
        const videoPath = path.join(mediaDir, videoFileName);
        try {
          const probe = await probeMediaMetadata(videoPath);
          if (probe.isValidVideo) {
            const thumbPath = path.join(mediaDir, 'thumbnail.webp');
            if (!fs.existsSync(thumbPath) || fs.statSync(thumbPath).size < 500) {
              await generateVideoThumbnail(videoPath, thumbPath, probe.durationSeconds);
            }

            let videoMedia = ad.media.find((m) => m.media_type === 'video');
            if (videoMedia) {
              await dbService.saveOfferAdMedia({
                ...videoMedia,
                width: probe.width,
                height: probe.height,
                duration_seconds: probe.durationSeconds,
                storage_path: `default-user/${offerId}/${metaAdId}/video.mp4`,
                media_url: `/uploads/offer-media/${offerId}/${metaAdId}/video.mp4`,
                thumbnail_path: `default-user/${offerId}/${metaAdId}/thumbnail.webp`,
                thumbnail_url: `/uploads/offer-media/${offerId}/${metaAdId}/thumbnail.webp`,
                capture_status: 'completed',
              });
            }

            results.push({ metaAdId, type: 'video', status: 'repaired', duration: probe.durationSeconds });
          }
        } catch (vidErr: any) {
          console.warn(`[REPAIR] Video repair failed for ${metaAdId}:`, vidErr.message);
        }
      }
    }

    const updatedAds = await dbService.getOfferAds(offerId);

    return NextResponse.json({
      success: true,
      repairedCount: results.length,
      results,
      ads: updatedAds,
    });
  } catch (err: any) {
    console.error('[POST /api/offers/[id]/repair-media Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao reparar mídias da oferta.' },
      { status: 500 }
    );
  }
}
