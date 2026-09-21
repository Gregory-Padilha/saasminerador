import { KnowledgeCategory, SourceType } from './types';

export interface NormalizationInput {
  rawContent: string;
  sourceType: SourceType;
  title: string;
  originalTitle: string;
  category: KnowledgeCategory;
  tags: string[];
  sourceUrl?: string;
  sourceAuthor?: string;
}

export interface NormalizationOutput {
  canonicalMarkdown: string;
  cleanedText: string;
  sectionsCount: number;
}

/**
 * Removes timestamp noise (e.g. "00:14", "[01:23:45]", "12.4s"), removes duplicated caption lines,
 * and fixes paragraph breaks.
 */
export function cleanRawTranscript(text: string): string {
  if (!text) return '';

  let cleaned = text
    // Remove timestamps like 00:00:00, 00:00, [01:23], (00:45)
    .replace(/\[?\b\d{1,2}:\d{2}(?::\d{2})?\b\]?/g, '')
    // Remove timestamp seconds like 12.3s
    .replace(/\b\d+\.\d+s\b/gi, '')
    // Remove html entities leftover
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Deduplicate consecutive repeated phrases (common in video captions)
  const words = cleaned.split(/\s+/);
  const deduplicatedWords: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // If 4 consecutive words repeat exactly, skip duplicate chunk
    if (
      i >= 4 &&
      word.toLowerCase() === words[i - 4].toLowerCase() &&
      words[i - 1]?.toLowerCase() === words[i - 5]?.toLowerCase() &&
      words[i - 2]?.toLowerCase() === words[i - 6]?.toLowerCase()
    ) {
      continue;
    }
    deduplicatedWords.push(word);
  }

  cleaned = deduplicatedWords.join(' ');

  // Group into readable paragraphs roughly every 40-70 words
  const sentenceEndings = cleaned.split(/(?<=[.!?])\s+/);
  const paragraphs: string[] = [];
  let currentParagraph = '';

  sentenceEndings.forEach((sentence) => {
    currentParagraph += (currentParagraph ? ' ' : '') + sentence.trim();
    if (currentParagraph.length > 350) {
      paragraphs.push(currentParagraph);
      currentParagraph = '';
    }
  });

  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim());
  }

  return paragraphs.join('\n\n');
}

/**
 * KnowledgeNormalizationPipeline
 * Transforms raw source content into structured Canonical Markdown document.
 * MUST PRESERVE SUBSTANTIVE CONTENT (DO NOT AGGRESSIVELY SUMMARIZE!).
 */
export function normalizeKnowledgeContent(input: NormalizationInput): NormalizationOutput {
  const { rawContent, sourceType, title, originalTitle, category, tags, sourceUrl, sourceAuthor } = input;

  const cleanedText = sourceType === 'VIDEO' ? cleanRawTranscript(rawContent) : rawContent.trim();

  // Parse existing markdown headings if present
  const hasExistingHeadings = /^#{1,3}\s+/m.test(cleanedText);

  let structuredBody = '';
  let sectionsCount = 1;

  if (hasExistingHeadings) {
    structuredBody = cleanedText;
    sectionsCount = (cleanedText.match(/^#{1,3}\s+/gm) || []).length;
  } else {
    // Break into logical sections based on content length and paragraphs
    const paragraphs = cleanedText.split(/\n\n+/).filter((p) => p.trim().length > 0);

    if (paragraphs.length <= 3) {
      structuredBody = `## Conteúdo Principal\n\n${cleanedText}`;
      sectionsCount = 1;
    } else {
      const overviewCount = Math.max(1, Math.floor(paragraphs.length * 0.2));
      const overviewParagraphs = paragraphs.slice(0, overviewCount).join('\n\n');
      const mainParagraphs = paragraphs.slice(overviewCount, paragraphs.length - overviewCount).join('\n\n');
      const conclusionParagraphs = paragraphs.slice(paragraphs.length - overviewCount).join('\n\n');

      structuredBody = [
        `## Visão Geral & Contexto\n\n${overviewParagraphs}`,
        `## Conteúdo Principal & Playbook\n\n${mainParagraphs}`,
        `## Síntese de Aplicação\n\n${conclusionParagraphs}`,
      ].join('\n\n');

      sectionsCount = 3;
    }
  }

  // Frontmatter YAML metadata
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `originalTitle: "${originalTitle.replace(/"/g, '\\"')}"`,
    `category: "${category}"`,
    `tags: ${JSON.stringify(tags)}`,
    `sourceType: "${sourceType}"`,
    sourceUrl ? `sourceUrl: "${sourceUrl}"` : null,
    sourceAuthor ? `sourceAuthor: "${sourceAuthor}"` : null,
    `language: "pt-BR"`,
    `createdAt: "${new Date().toISOString()}"`,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  const canonicalMarkdown = `${frontmatter}\n\n# ${title}\n\n${structuredBody}`;

  return {
    canonicalMarkdown,
    cleanedText,
    sectionsCount,
  };
}
