/**
 * Text Extractor for Knowledge Library
 * Supports .txt, .md, .json, .csv, .pdf, .docx
 */
export async function extractTextFromFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<{ text: string; warnings?: string[] }> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const warnings: string[] = [];

  // Plain Text, Markdown, JSON, CSV
  if (['txt', 'md', 'markdown', 'json', 'csv', 'tsv'].includes(ext) || mimeType?.includes('text') || mimeType?.includes('json')) {
    const raw = fileBuffer.toString('utf-8');
    if (!raw.trim()) {
      warnings.push('O arquivo de texto enviado está vazio.');
    }
    return { text: raw, warnings };
  }

  // PDF
  if (ext === 'pdf' || mimeType?.includes('pdf')) {
    const raw = fileBuffer.toString('utf-8');
    // Simple text extraction from PDF stream
    const matches = raw.match(/\(([^()]+)\)/g);
    let extracted = '';
    if (matches) {
      extracted = matches
        .map((m) => m.slice(1, -1))
        .filter((t) => t.length > 2 && /[\w\sÀ-ÿ.,!?\-\/]/.test(t))
        .join(' ');
    }

    if (!extracted.trim() || extracted.length < 50) {
      // Fallback clean regex extract
      extracted = raw.replace(/[^\w\sÀ-ÿ.,!?\-\/]/g, ' ').replace(/\s+/g, ' ');
    }

    if (extracted.trim().length < 30) {
      warnings.push('Este PDF não possui camada de texto extraível suficiente (pode ser um documento escaneado/imagem).');
    }

    return { text: extracted, warnings };
  }

  // DOCX / Word
  if (ext === 'docx' || mimeType?.includes('wordprocessingml')) {
    const raw = fileBuffer.toString('utf-8');
    const matches = raw.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    let extracted = '';
    if (matches) {
      extracted = matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
    } else {
      extracted = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    }
    return { text: extracted, warnings };
  }

  // Generic Fallback
  const text = fileBuffer.toString('utf-8').replace(/[^\w\sÀ-ÿ.,!?\-\/]/g, ' ');
  return { text, warnings };
}
