// ==============================================================================
// META ADS - STORAGE UPLOADER & URL MANAGER (SUPABASE & LOCAL FALLBACK)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export interface StorageUploadResult {
  storagePath: string;
  mediaUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  cardScreenshotPath?: string;
  cardScreenshotUrl?: string;
}

export async function uploadAdCardScreenshot(
  userId: string | null | undefined,
  offerId: string,
  metaAdId: string,
  cardLocalPath: string
): Promise<{ cardScreenshotPath: string; cardScreenshotUrl: string }> {
  const safeUserId = userId || 'default-user';
  const bucketName = 'offer-media';
  const cardFilename = 'card.webp';
  const storagePath = `${safeUserId}/${offerId}/${metaAdId}/${cardFilename}`;

  let uploadedToSupabase = false;
  let cardScreenshotUrl = '';

  if (isSupabaseConfigured() && supabase) {
    try {
      const fileBuffer = fs.readFileSync(cardLocalPath);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, fileBuffer, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        cardScreenshotUrl = publicData.publicUrl;
        uploadedToSupabase = true;
      }
    } catch (err) {
      console.warn('[STORAGE] Supabase card screenshot upload warning:', err);
    }
  }

  if (!uploadedToSupabase) {
    const localTargetDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'offer-media',
      offerId,
      metaAdId
    );
    if (!fs.existsSync(localTargetDir)) {
      fs.mkdirSync(localTargetDir, { recursive: true });
    }
    const localDest = path.join(localTargetDir, cardFilename);
    fs.copyFileSync(cardLocalPath, localDest);
    cardScreenshotUrl = `/uploads/offer-media/${offerId}/${metaAdId}/${cardFilename}`;
  }

  return {
    cardScreenshotPath: storagePath,
    cardScreenshotUrl,
  };
}

export async function uploadAdMedia(
  userId: string | null | undefined,
  offerId: string,
  metaAdId: string,
  mediaType: 'video' | 'image',
  localFilePath: string,
  thumbnailLocalPath?: string
): Promise<StorageUploadResult> {
  const safeUserId = userId || 'default-user';
  const ext = mediaType === 'video' ? 'mp4' : 'webp';
  const mainFilename = mediaType === 'video' ? 'video.mp4' : 'image.webp';
  const thumbFilename = 'thumbnail.webp';

  const bucketName = 'offer-media';
  const storagePath = `${safeUserId}/${offerId}/${metaAdId}/${mainFilename}`;
  const thumbStoragePath = `${safeUserId}/${offerId}/${metaAdId}/${thumbFilename}`;

  let uploadedToSupabase = false;
  let mediaUrl = '';
  let thumbnailUrl: string | undefined;

  // 1. Try Supabase Storage if configured
  if (isSupabaseConfigured() && supabase) {
    try {
      const fileBuffer = fs.readFileSync(localFilePath);
      const mimeType = mediaType === 'video' ? 'video/mp4' : 'image/webp';

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error && data) {
        const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        mediaUrl = publicData.publicUrl;
        uploadedToSupabase = true;

        if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
          const thumbBuffer = fs.readFileSync(thumbnailLocalPath);
          const { error: thumbErr } = await supabase.storage
            .from(bucketName)
            .upload(thumbStoragePath, thumbBuffer, {
              contentType: 'image/webp',
              upsert: true,
            });
          if (!thumbErr) {
            const { data: thumbPub } = supabase.storage
              .from(bucketName)
              .getPublicUrl(thumbStoragePath);
            thumbnailUrl = thumbPub.publicUrl;
          }
        }
      }
    } catch (sbErr) {
      console.warn('[STORAGE] Supabase storage upload warning, falling back to local disk:', sbErr);
    }
  }

  // 2. Local Disk Fallback (/public/uploads/offer-media/...)
  if (!uploadedToSupabase) {
    const localTargetDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'offer-media',
      offerId,
      metaAdId
    );
    if (!fs.existsSync(localTargetDir)) {
      fs.mkdirSync(localTargetDir, { recursive: true });
    }

    const localMainDest = path.join(localTargetDir, mainFilename);
    fs.copyFileSync(localFilePath, localMainDest);
    mediaUrl = `/uploads/offer-media/${offerId}/${metaAdId}/${mainFilename}`;

    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      const localThumbDest = path.join(localTargetDir, thumbFilename);
      fs.copyFileSync(thumbnailLocalPath, localThumbDest);
      thumbnailUrl = `/uploads/offer-media/${offerId}/${metaAdId}/${thumbFilename}`;
    }
  }

  return {
    storagePath,
    mediaUrl,
    thumbnailPath: thumbnailUrl ? thumbStoragePath : undefined,
    thumbnailUrl,
  };
}
