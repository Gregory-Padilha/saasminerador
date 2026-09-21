import crypto from 'crypto';
import { knowledgeDb } from './db';
import { KnowledgeDocument, KnowledgeSource } from './types';

export function computeHash(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingDocument?: KnowledgeDocument;
  existingSource?: KnowledgeSource;
  reason?: 'HASH' | 'URL' | 'TITLE';
  message?: string;
}

export async function checkDuplicateKnowledge(
  contentOrHash: string,
  sourceUrl?: string,
  title?: string
): Promise<DuplicateCheckResult> {
  const sources = await knowledgeDb.getSources();
  const documents = await knowledgeDb.getDocuments();

  // 1. Check Source URL Match
  if (sourceUrl && sourceUrl.trim()) {
    const cleanUrl = sourceUrl.trim().toLowerCase();
    const existingSrc = sources.find((s) => s.sourceUrl && s.sourceUrl.trim().toLowerCase() === cleanUrl);
    if (existingSrc) {
      const existingDoc = documents.find((d) => d.sourceId === existingSrc.id);
      return {
        isDuplicate: true,
        existingSource: existingSrc,
        existingDocument: existingDoc,
        reason: 'URL',
        message: `Este link/URL já foi importado anteriormente na Biblioteca ("${existingDoc?.title || existingSrc.originalName}").`,
      };
    }
  }

  // 2. Check Hash Match
  const hash = contentOrHash.length === 64 && /^[a-f0-9]+$/i.test(contentOrHash)
    ? contentOrHash
    : computeHash(contentOrHash);

  const existingSrcByHash = sources.find((s) => s.hash === hash);
  if (existingSrcByHash) {
    const existingDoc = documents.find((d) => d.sourceId === existingSrcByHash.id);
    return {
      isDuplicate: true,
      existingSource: existingSrcByHash,
      existingDocument: existingDoc,
      reason: 'HASH',
      message: `Este conteúdo exato/arquivo já foi adicionado anteriormente ("${existingDoc?.title || existingSrcByHash.originalName}").`,
    };
  }

  // 3. Check Exact Title Match
  if (title && title.trim()) {
    const cleanTitle = title.trim().toLowerCase();
    const existingDocByTitle = documents.find((d) => d.title.trim().toLowerCase() === cleanTitle || d.originalTitle.trim().toLowerCase() === cleanTitle);
    if (existingDocByTitle) {
      return {
        isDuplicate: true,
        existingDocument: existingDocByTitle,
        reason: 'TITLE',
        message: `Já existe um documento com o mesmo título na Biblioteca ("${existingDocByTitle.title}").`,
      };
    }
  }

  return { isDuplicate: false };
}
