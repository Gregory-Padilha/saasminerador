// ==============================================================================
// META ADS - MEDIA DOWNLOAD, THUMBNAILS & ELEMENT SCREENSHOTS (SHARP / FFMPEG)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { Page } from 'playwright';

const execFileAsync = promisify(execFile);

export interface DownloadedMediaResult {
  localFilePath: string;
  thumbnailLocalPath?: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  codecName?: string;
}

export interface MediaProbeResult {
  isValidVideo: boolean;
  isValidImage: boolean;
  codecName?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export async function createTempDir(requestId: string): Promise<string> {
  const tempDir = path.join('/tmp', 'offer-miner', requestId);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[MEDIA DOWNLOAD] Temp cleanup warning:', err);
  }
}

export async function captureCardScreenshot(
  page: Page,
  metaAdId: string,
  tempDir: string
): Promise<string | undefined> {
  try {
    const cardScreenshotPath = path.join(tempDir, `card-${metaAdId}.webp`);
    const locator = page.locator(`[data-meta-ad-id="${metaAdId}"]`).first();

    if ((await locator.count()) > 0) {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const rawPngPath = path.join(tempDir, `raw-card-${metaAdId}.png`);
      await locator.screenshot({ path: rawPngPath, type: 'png' });
      if (fs.existsSync(rawPngPath)) {
        const pngBuf = fs.readFileSync(rawPngPath);
        const webpBuf = await sharp(pngBuf)
          .webp({ quality: 85 })
          .toBuffer();
        fs.writeFileSync(cardScreenshotPath, webpBuf);
        try { fs.unlinkSync(rawPngPath); } catch {}
        return cardScreenshotPath;
      }
    }
  } catch (err) {
    console.warn(`[MEDIA DOWNLOAD] Failed to capture card screenshot for ${metaAdId}:`, err);
  }
  return undefined;
}

export async function downloadFileStream(
  url: string,
  destPath: string,
  expectedType: 'video' | 'image' = 'video'
): Promise<{ fileHash: string; fileSize: number; mimeType: string; rawBuffer?: Buffer }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch media from URL: ${url} (HTTP ${response.status})`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) {
    throw new Error(`Invalid content-type ${contentType} for media URL: ${url}`);
  }

  const fileStream = fs.createWriteStream(destPath);
  const hash = crypto.createHash('sha256');

  const reader = response.body.getReader();
  let fileSize = 0;
  let isHeaderChecked = false;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      if (!isHeaderChecked) {
        isHeaderChecked = true;
        const textSample = Buffer.from(value.slice(0, 100)).toString('utf8');
        if (textSample.includes('<!DOCTYPE') || textSample.includes('<html') || textSample.includes('Access Denied')) {
          fileStream.destroy();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          throw new Error(`Media response contains HTML/error content: ${textSample.slice(0, 40)}`);
        }
      }

      fileSize += value.length;
      hash.update(value);
      fileStream.write(Buffer.from(value));
      if (expectedType === 'image') {
        chunks.push(value);
      }
    }
  }

  await new Promise((resolve, reject) => {
    fileStream.end(resolve);
    fileStream.on('error', reject);
  });

  const fileHash = hash.digest('hex');
  const mimeType = contentType || (expectedType === 'video' ? 'video/mp4' : 'image/webp');
  const rawBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  return { fileHash, fileSize, mimeType, rawBuffer };
}

export async function probeMediaMetadata(filePath: string): Promise<MediaProbeResult> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_streams',
      '-show_format',
      filePath,
    ]);

    const info = JSON.parse(stdout);
    const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
    const width = videoStream?.width ? parseInt(videoStream.width, 10) : undefined;
    const height = videoStream?.height ? parseInt(videoStream.height, 10) : undefined;
    const codecName = videoStream?.codec_name;
    const durationStr = info.format?.duration || videoStream?.duration;
    const durationSeconds = durationStr ? parseFloat(durationStr) : undefined;

    const isMjpeg = codecName === 'mjpeg' || codecName === 'png';
    const isValidVideo = Boolean(
      videoStream &&
      codecName &&
      !isMjpeg &&
      durationSeconds &&
      durationSeconds > 0
    );
    const isValidImage = Boolean(videoStream && isMjpeg) || Boolean(width && height && !durationSeconds);

    return {
      isValidVideo,
      isValidImage,
      codecName,
      width,
      height,
      durationSeconds: isValidVideo ? durationSeconds : undefined,
    };
  } catch (err) {
    return { isValidVideo: false, isValidImage: false };
  }
}

export async function generateVideoThumbnail(
  videoPath: string,
  outputPath: string,
  durationSeconds?: number
): Promise<boolean> {
  try {
    const rawFramePath = outputPath + '.tmp.png';
    const ssTime = Math.min(Math.max((durationSeconds || 1) * 0.10, 1), 3);
    const ssFormatted = `00:00:0${ssTime.toFixed(2)}`;

    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      ssFormatted,
      '-i',
      videoPath,
      '-vframes',
      '1',
      rawFramePath,
    ]);

    if (fs.existsSync(rawFramePath) && fs.statSync(rawFramePath).size > 500) {
      const frameBuffer = fs.readFileSync(rawFramePath);
      const optimizedThumb = await sharp(frameBuffer)
        .rotate()
        .resize({ width: 800, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: 85 })
        .toBuffer();

      fs.writeFileSync(outputPath, optimizedThumb);
      try { fs.unlinkSync(rawFramePath); } catch {}
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[MEDIA DOWNLOAD] ffmpeg thumbnail warning:', err);
    return false;
  }
}

export async function processMediaDownload(
  mediaType: 'video' | 'image',
  sourceUrl: string,
  posterUrl: string | undefined,
  tempDir: string,
  metaAdId: string,
  bufferedBuffer?: Buffer
): Promise<DownloadedMediaResult | null> {
  try {
    const ext = mediaType === 'video' ? 'mp4' : 'webp';
    const filename = `${metaAdId}.${ext}`;
    const destPath = path.join(tempDir, filename);

    let fileHash = '';
    let fileSize = 0;
    let mimeType = mediaType === 'video' ? 'video/mp4' : 'image/webp';
    let width: number | undefined;
    let height: number | undefined;
    let durationSeconds: number | undefined;
    let codecName: string | undefined;
    let thumbnailLocalPath: string | undefined;

    // ==========================================
    // 1. IMAGE PROCESSING WITH SHARP
    // ==========================================
    if (mediaType === 'image') {
      let rawImageBuffer: Buffer;

      if (bufferedBuffer && bufferedBuffer.length > 2000) {
        rawImageBuffer = bufferedBuffer;
      } else {
        console.log(`[MEDIA DOWNLOAD] Downloading IMAGE from: ${sourceUrl.slice(0, 80)}...`);
        const tempRaw = path.join(tempDir, `raw-${metaAdId}.tmp`);
        const dl = await downloadFileStream(sourceUrl, tempRaw, 'image');
        rawImageBuffer = dl.rawBuffer || fs.readFileSync(tempRaw);
        try { if (fs.existsSync(tempRaw)) fs.unlinkSync(tempRaw); } catch {}
      }

      if (!rawImageBuffer || rawImageBuffer.length < 3000) {
        console.warn(`[IMAGE VALIDATION REJECTED] Image too small (${rawImageBuffer?.length || 0} bytes). Ad: ${metaAdId}`);
        return null;
      }

      // Validate & decode with Sharp
      const imageInstance = sharp(rawImageBuffer);
      const metadata = await imageInstance.metadata();

      if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
        console.warn(`[IMAGE VALIDATION REJECTED] Invalid image dimensions (${metadata.width}x${metadata.height}). Ad: ${metaAdId}`);
        return null;
      }

      width = metadata.width;
      height = metadata.height;

      // Convert full image to normalized WebP (quality: 90)
      const normalizedWebp = await imageInstance
        .rotate() // Respect EXIF orientation
        .webp({ quality: 90 })
        .toBuffer();

      fs.writeFileSync(destPath, normalizedWebp);
      fileSize = normalizedWebp.length;
      fileHash = crypto.createHash('sha256').update(normalizedWebp).digest('hex');
      mimeType = 'image/webp';

      // Generate dedicated 800px thumbnail for card gallery
      const thumbDest = path.join(tempDir, `${metaAdId}-thumb.webp`);
      const thumbBuffer = await sharp(normalizedWebp)
        .resize({ width: 800, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: 85 })
        .toBuffer();

      fs.writeFileSync(thumbDest, thumbBuffer);
      thumbnailLocalPath = thumbDest;

      console.log(
        `[IMAGE VALIDATED & STORED] Ad ${metaAdId}: ${width}x${height}, format: ${metadata.format}->webp, size: ${Math.round(fileSize / 1024)} KB, thumb: ${Math.round(thumbBuffer.length / 1024)} KB`
      );

      return {
        localFilePath: destPath,
        thumbnailLocalPath,
        fileHash,
        fileSize,
        mimeType,
        width,
        height,
      };
    }

    // ==========================================
    // 2. VIDEO PROCESSING WITH FFMPEG & PROBE
    // ==========================================
    if (bufferedBuffer && bufferedBuffer.length > 5000) {
      fs.writeFileSync(destPath, bufferedBuffer);
      fileSize = bufferedBuffer.length;
      fileHash = crypto.createHash('sha256').update(bufferedBuffer).digest('hex');
    } else {
      console.log(`[MEDIA DOWNLOAD] Downloading VIDEO from: ${sourceUrl.slice(0, 80)}...`);
      const dl = await downloadFileStream(sourceUrl, destPath, 'video');
      fileHash = dl.fileHash;
      fileSize = dl.fileSize;
      mimeType = dl.mimeType;
    }

    // STRICT VALIDATION WITH FFPROBE
    const probe = await probeMediaMetadata(destPath);

    if (!probe.isValidVideo || !probe.durationSeconds || probe.durationSeconds <= 0) {
      console.warn(
        `[VIDEO VALIDATION REJECTED] File is not a playable video (codec: ${probe.codecName}, duration: ${probe.durationSeconds}, size: ${fileSize} bytes). Ad: ${metaAdId}`
      );
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      return null;
    }

    width = probe.width;
    height = probe.height;
    durationSeconds = probe.durationSeconds;
    codecName = probe.codecName;

    // Generate video thumbnail from frame
    const thumbDest = path.join(tempDir, `${metaAdId}-thumb.webp`);
    const thumbGenerated = await generateVideoThumbnail(destPath, thumbDest, durationSeconds);

    if (thumbGenerated) {
      thumbnailLocalPath = thumbDest;
    } else if (posterUrl && posterUrl.startsWith('http')) {
      try {
        const rawPoster = path.join(tempDir, `raw-poster-${metaAdId}.tmp`);
        await downloadFileStream(posterUrl, rawPoster, 'image');
        if (fs.existsSync(rawPoster) && fs.statSync(rawPoster).size > 1000) {
          const posterBuf = fs.readFileSync(rawPoster);
          const posterWebp = await sharp(posterBuf)
            .rotate()
            .resize({ width: 800, withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 85 })
            .toBuffer();
          fs.writeFileSync(thumbDest, posterWebp);
          thumbnailLocalPath = thumbDest;
          try { fs.unlinkSync(rawPoster); } catch {}
        }
      } catch {}
    }

    console.log(
      `[VIDEO VALIDATED OK] Ad ${metaAdId}: ${width}x${height}, ${durationSeconds.toFixed(1)}s, ${Math.round(fileSize / 1024)} KB`
    );

    return {
      localFilePath: destPath,
      thumbnailLocalPath,
      fileHash,
      fileSize,
      mimeType,
      width,
      height,
      durationSeconds,
      codecName,
    };
  } catch (err: any) {
    console.error(`[MEDIA DOWNLOAD ERROR] Failed for ad ${metaAdId}:`, err.message);
    return null;
  }
}
