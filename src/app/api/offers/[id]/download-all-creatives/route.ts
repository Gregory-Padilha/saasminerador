import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/supabase/db';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    const offer = await dbService.getOfferById(offerId);

    if (!offer) {
      return NextResponse.json({ error: 'Oferta não encontrada.' }, { status: 404 });
    }

    const ads = await dbService.getOfferAds(offerId);
    const creatives = await dbService.getCreativesByOffer(offerId);

    if (ads.length === 0 && creatives.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum anúncio ou mídia armazenada para download.' },
        { status: 400 }
      );
    }

    const safeName = (offer.product_name || 'oferta')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);

    const archiverModule = require('archiver');
    const archive =
      typeof archiverModule === 'function'
        ? archiverModule('zip', { zlib: { level: 6 } })
        : archiverModule.ZipArchive
        ? new archiverModule.ZipArchive({ zlib: { level: 6 } })
        : new (archiverModule.default?.ZipArchive || archiverModule.default)({
            zlib: { level: 6 },
          });

    const passThrough = new PassThrough();
    const addedFiles = new Set<string>();

    // 1. Add files from offer_ads & offer_ad_media
    for (const ad of ads) {
      const metaId = ad.meta_ad_id || 'ad';

      for (const m of ad.media) {
        if (!m.storage_path && !m.media_url) continue;

        const isVideo = m.media_type === 'video';
        const folder = isVideo ? 'videos' : 'images';
        const ext = isVideo ? '.mp4' : '.jpg';
        const zipEntryName = `${folder}/${metaId}_${isVideo ? 'video' : 'image'}${ext}`;

        if (addedFiles.has(zipEntryName)) continue;

        // Candidate paths on disk
        const candidatePaths = [
          path.join(process.cwd(), 'public', 'uploads', m.storage_path || ''),
          path.join(
            process.cwd(),
            'public',
            'uploads',
            'offer-ad-media',
            offerId,
            metaId,
            isVideo ? 'video-01.mp4' : 'image-01.jpg'
          ),
          path.join(process.cwd(), 'public', m.media_url || ''),
        ];

        for (const p of candidatePaths) {
          if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
            archive.file(p, { name: zipEntryName });
            addedFiles.add(zipEntryName);
            break;
          }
        }
      }

      // Also add card screenshot if available
      if (ad.card_screenshot_path || ad.card_screenshot_url) {
        const cardZipName = `cards/${metaId}_card.webp`;
        if (!addedFiles.has(cardZipName)) {
          const candidateCardPaths = [
            path.join(process.cwd(), 'public', 'uploads', ad.card_screenshot_path || ''),
            path.join(
              process.cwd(),
              'public',
              'uploads',
              'offer-ad-media',
              offerId,
              metaId,
              'card.webp'
            ),
            path.join(process.cwd(), 'public', ad.card_screenshot_url || ''),
          ];
          for (const cp of candidateCardPaths) {
            if (cp && fs.existsSync(cp) && fs.statSync(cp).isFile()) {
              archive.file(cp, { name: cardZipName });
              addedFiles.add(cardZipName);
              break;
            }
          }
        }
      }
    }

    // 2. Fallback: Add from legacy offer_creatives
    if (addedFiles.size === 0) {
      let index = 1;
      for (const c of creatives) {
        if (!c.storage_path) continue;

        const isVideo = c.media_type === 'video' || c.format === 'Vídeo';
        const folder = isVideo ? 'videos' : 'images';
        const ext = path.extname(c.storage_path) || (isVideo ? '.mp4' : '.webp');
        const filename = `${folder}/${String(index).padStart(2, '0')}_${c.meta_ad_id || 'ad'}${ext}`;
        index++;

        const localFilePath = path.join(process.cwd(), 'public', 'uploads', c.storage_path);
        if (fs.existsSync(localFilePath) && !addedFiles.has(filename)) {
          archive.file(localFilePath, { name: filename });
          addedFiles.add(filename);
        }
      }
    }

    archive.pipe(passThrough);
    archive.finalize();

    const responseStream = new ReadableStream({
      start(controller) {
        passThrough.on('data', (chunk) => controller.enqueue(chunk));
        passThrough.on('end', () => controller.close());
        passThrough.on('error', (err) => controller.error(err));
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}_anuncios.zip"`,
      },
    });
  } catch (err: any) {
    console.error('[ZIP GENERATION ERROR]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao gerar arquivo ZIP de criativos.' },
      { status: 500 }
    );
  }
}
