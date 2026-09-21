import { KnowledgeChunk, KnowledgeCategory, KnowledgeType, SourceType } from './types';

export interface ChunkOptions {
  maxChunkSize?: number; // Characters per chunk (~350 words)
  overlapSize?: number;  // Character overlap
  section?: string;
  sourceType?: SourceType;
  sourceUrl?: string;
  version?: number;
}

/**
 * Heading and Paragraph-aware semantic chunking algorithm
 */
export function chunkKnowledgeDocument(
  documentId: string,
  documentTitle: string,
  category: KnowledgeCategory,
  knowledgeType: KnowledgeType,
  content: string,
  tags: string[] = [],
  options: ChunkOptions = {}
): KnowledgeChunk[] {
  const maxChunkSize = options.maxChunkSize || 1200;
  const overlapSize = options.overlapSize || 150;
  const sourceType = options.sourceType || 'FILE';
  const sourceUrl = options.sourceUrl;
  const version = options.version || 1;

  if (!content || !content.trim()) return [];

  // Split by markdown headings or double newlines
  const sections = content.split(/(?=\n#{1,4}\s+|\n\n)/g);
  const chunks: KnowledgeChunk[] = [];
  let currentChunkText = '';
  let chunkIndex = 0;
  let currentHeading = options.section || 'Geral';

  const pushChunk = (text: string, heading: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tokenEstimate = Math.ceil(trimmed.length / 4);

    chunks.push({
      id: `${documentId}-chunk-${chunkIndex + 1}`,
      documentId,
      documentTitle,
      section: heading,
      category,
      knowledgeType,
      chunkIndex: chunkIndex + 1,
      content: trimmed,
      tokenCount: tokenEstimate,
      tags,
      sourceType,
      sourceUrl,
      version,
      createdAt: new Date().toISOString(),
    });

    chunkIndex++;
  };

  sections.forEach((section) => {
    // Detect if section starts with heading
    const headingMatch = section.match(/^#{1,4}\s+(.+)$/m);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
    }

    if ((currentChunkText + section).length <= maxChunkSize) {
      currentChunkText += (currentChunkText ? '\n\n' : '') + section;
    } else {
      if (currentChunkText) {
        pushChunk(currentChunkText, currentHeading);
        const overlap = currentChunkText.slice(-overlapSize);
        currentChunkText = overlap + '\n\n' + section;
      } else {
        const paragraphs = section.split(/\n\n+/);
        paragraphs.forEach((p) => {
          if ((currentChunkText + p).length <= maxChunkSize) {
            currentChunkText += (currentChunkText ? '\n\n' : '') + p;
          } else {
            if (currentChunkText) pushChunk(currentChunkText, currentHeading);
            currentChunkText = p;
          }
        });
      }
    }
  });

  if (currentChunkText.trim()) {
    pushChunk(currentChunkText, currentHeading);
  }

  return chunks;
}
