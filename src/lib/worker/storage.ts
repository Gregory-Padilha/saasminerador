import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { CAPTURE_CONFIG } from './config';

export async function uploadMediaToStorage(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ success: boolean; storagePath: string; error?: string }> {
  // 1. Supabase Storage if configured
  if (isSupabaseConfigured() && supabase) {
    try {
      // Ensure bucket exists or insert into bucket
      const { data, error } = await supabase.storage
        .from(CAPTURE_CONFIG.STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.warn('Supabase storage upload error:', error);
      } else if (data) {
        return { success: true, storagePath };
      }
    } catch (err: any) {
      console.warn('Supabase storage exception:', err);
    }
  }

  // 2. Local filesystem storage fallback
  try {
    const localFullPath = path.join(process.cwd(), 'public', 'uploads', storagePath);
    const dir = path.dirname(localFullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localFullPath, buffer);
    return { success: true, storagePath };
  } catch (err: any) {
    return { success: false, storagePath, error: err.message };
  }
}

export async function getSignedMediaUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(CAPTURE_CONFIG.STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (data?.signedUrl && !error) {
        return data.signedUrl;
      }
    } catch (err) {
      console.warn('Supabase getSignedMediaUrl error:', err);
    }
  }

  // Fallback to local static serve URL
  return `/uploads/${storagePath}`;
}

export async function deleteMediaFromStorage(storagePath: string): Promise<boolean> {
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.storage.from(CAPTURE_CONFIG.STORAGE_BUCKET).remove([storagePath]);
    } catch (err) {
      console.warn('Supabase deleteMediaFromStorage error:', err);
    }
  }

  try {
    const localFullPath = path.join(process.cwd(), 'public', 'uploads', storagePath);
    if (fs.existsSync(localFullPath)) {
      fs.unlinkSync(localFullPath);
    }
    return true;
  } catch {
    return false;
  }
}
