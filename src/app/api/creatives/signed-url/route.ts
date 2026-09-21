import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const storagePath = searchParams.get('path');

    if (!storagePath) {
      return NextResponse.json({ error: 'Parâmetro path é obrigatório.' }, { status: 400 });
    }

    // 1. Check Supabase Storage if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const bucketName = 'offer-media';
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(storagePath, 7200);

        if (data?.signedUrl && !error) {
          return NextResponse.json({ url: data.signedUrl, storagePath });
        }
      } catch (sbErr) {
        console.warn('[SIGNED-URL] Supabase signed url error:', sbErr);
      }
    }

    // 2. Check local disk candidate paths
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
        const relativeUrl = diskPath.replace(path.join(process.cwd(), 'public'), '');
        return NextResponse.json({ url: relativeUrl, storagePath });
      }
    }

    // 3. Fallback to /uploads/offer-media/${offerId}/${metaAdId}/${filename}
    if (offerId && metaAdId && filename) {
      return NextResponse.json({
        url: `/uploads/offer-media/${offerId}/${metaAdId}/${filename}`,
        storagePath,
      });
    }

    return NextResponse.json({
      url: `/uploads/${cleanPath}`,
      storagePath,
    });
  } catch (err: any) {
    console.error('[SIGNED-URL ERROR]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao gerar URL do arquivo.' },
      { status: 500 }
    );
  }
}
