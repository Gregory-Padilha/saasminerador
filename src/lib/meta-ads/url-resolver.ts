import 'server-only';

import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Resolves a storage_path into a fully-usable URL (Signed URL on Supabase or relative URL on local disk).
 * Handles all path formats:
 * - default-user/{offerId}/{metaAdId}/{filename}
 * - {userId}/{offerId}/{metaAdId}/{filename}
 * - /uploads/offer-media/...
 */
export async function resolveMediaStorageUrl(
  storagePath: string | null | undefined,
  fallbackUrl?: string | null
): Promise<string | null> {
  if (!storagePath && !fallbackUrl) return null;

  // 1. If Supabase is configured and storagePath is present
  if (storagePath && isSupabaseConfigured() && supabase) {
    try {
      const bucketName = 'offer-media';
      const cleanStoragePath = storagePath.replace(/^\/+/, '');
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(cleanStoragePath, 7200);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (err) {
      console.warn('[URL RESOLVER] Supabase signed URL generation warning:', err);
    }
  }

  // 2. Local Disk Resolution
  if (storagePath) {
    const cleanPath = storagePath.replace(/^\/+/, '');
    const parts = cleanPath.split('/');
    const filename = parts.pop() || '';
    const metaAdId = parts.pop() || '';
    const offerId = parts.pop() || '';

    const candidateDiskPaths = [
      path.join(process.cwd(), 'public', 'uploads', 'offer-media', offerId, metaAdId, filename),
      path.join(process.cwd(), 'public', 'uploads', cleanPath),
      path.join(process.cwd(), 'public', cleanPath),
      path.join(process.cwd(), 'public', 'uploads', 'offer-ad-media', offerId, metaAdId, filename),
    ];

    for (const diskPath of candidateDiskPaths) {
      if (diskPath && fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
        return diskPath.replace(path.join(process.cwd(), 'public'), '');
      }
    }

    if (offerId && metaAdId && filename) {
      return `/uploads/offer-media/${offerId}/${metaAdId}/${filename}`;
    }

    return `/uploads/${cleanPath}`;
  }

  // 3. Fallback to passed URL if storagePath wasn't valid
  if (fallbackUrl) {
    if (fallbackUrl.startsWith('http://') || fallbackUrl.startsWith('https://') || fallbackUrl.startsWith('/')) {
      return fallbackUrl;
    }
    return `/uploads/${fallbackUrl.replace(/^\/+/, '')}`;
  }

  return null;
}

export { validateMetaAdsLibraryUrl, isMetaAdsLibraryUrl, type MetaUrlValidationResult } from './url-utils';
