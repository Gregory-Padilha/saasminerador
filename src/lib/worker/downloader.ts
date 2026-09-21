import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function downloadMediaBuffer(
  url: string,
  maxSizeMb: number = 100
): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const maxBytes = maxSizeMb * 1024 * 1024;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: '*/*',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > maxBytes) {
    throw new Error(`FILE_TOO_LARGE: ${Math.round(buffer.length / (1024 * 1024))}MB exceeds limit of ${maxSizeMb}MB`);
  }

  return {
    buffer,
    contentType,
    size: buffer.length,
  };
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function convertM3u8ToMp4(
  m3u8Url: string,
  outputMp4Path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const dir = path.dirname(outputMp4Path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Try ffmpeg if installed
    const cmd = `ffmpeg -y -i "${m3u8Url}" -c copy -bsf:a aac_adtstoasc "${outputMp4Path}"`;
    await execAsync(cmd, { timeout: 120000 });

    if (fs.existsSync(outputMp4Path) && fs.statSync(outputMp4Path).size > 0) {
      return { success: true };
    }
    return { success: false, error: 'FFmpeg finished but output file was empty.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'FFmpeg conversion failed' };
  }
}

export async function extractVideoThumbnail(
  videoFilePath: string,
  outputThumbnailPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const dir = path.dirname(outputThumbnailPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const cmd = `ffmpeg -y -ss 00:00:01 -i "${videoFilePath}" -vframes 1 -q:v 2 "${outputThumbnailPath}"`;
    await execAsync(cmd, { timeout: 30000 });

    if (fs.existsSync(outputThumbnailPath) && fs.statSync(outputThumbnailPath).size > 0) {
      return { success: true };
    }
    return { success: false, error: 'Could not extract video frame' };
  } catch (err: any) {
    return { success: false, error: err.message || 'FFmpeg thumbnail extraction failed' };
  }
}
