// ==============================================================================
// OFFER MINER - ROBUST HEADER DETECTION ENGINE WITH SCORING & CANDIDATE RANKING
// ==============================================================================

import { normalizeHeader, matchColumnWithConfidence } from './aliases';
import { HeaderCandidate } from '@/types';

export interface HeaderDetectionResult {
  headerRowIndex: number;
  headers: string[];
  score: number;
  confidence: number;
  candidates: HeaderCandidate[];
}

const TITLE_PATTERNS = [
  'mineracao',
  'mineração',
  'relatorio',
  'relatório',
  'ofertas validadas',
  'chatgpt work',
  'chatgpt',
  'ofertas mineradas',
  'planilha de ofertas',
  'database',
  'export',
  'sheet',
  'tabela de mineracao',
];

/**
 * Evaluates the first 20 rows of a worksheet matrix to find the true table header row.
 * Scores candidate rows based on keyword matches, text density, and data variance.
 */
export function detectHeaderRow(matrix: any[][]): HeaderDetectionResult {
  if (!matrix || matrix.length === 0) {
    return {
      headerRowIndex: 0,
      headers: [],
      score: 0,
      confidence: 0,
      candidates: [],
    };
  }

  const maxRowsToScan = Math.min(matrix.length, 25);
  const candidateScores: {
    rowIndex: number;
    score: number;
    headers: string[];
    recognizedCount: number;
    filledCount: number;
  }[] = [];

  for (let r = 0; r < maxRowsToScan; r++) {
    const row = matrix[r];
    if (!row || !Array.isArray(row)) continue;

    // Extract non-empty cell strings
    const cells = row.map((c) => (c !== null && c !== undefined ? String(c).trim() : ''));
    const filledCells = cells.filter((c) => c.length > 0);

    if (filledCells.length === 0) {
      continue;
    }

    let score = 0;
    let recognizedCount = 0;
    let textCount = 0;
    let numberCount = 0;

    for (const cell of filledCells) {
      // Check if purely numeric
      const isNum = !isNaN(Number(cell.replace(/[R$.,\s%]/g, '')));
      if (isNum && cell.length > 0) {
        numberCount++;
      } else {
        textCount++;
        score += 1; // +1 for text cell
      }

      // Check keyword match in dictionary
      const match = matchColumnWithConfidence(cell);
      if (match.confidence >= 80) {
        recognizedCount++;
        score += 3; // +3 for recognized alias keyword
      }
    }

    // Points for width
    if (filledCells.length >= 4) {
      score += 2;
    } else if (filledCells.length <= 2) {
      score -= 3; // Penalty for 1-2 cells (likely title/banner)
    }

    // Penalty if majority are numbers
    if (numberCount > textCount) {
      score -= 3;
    }

    // Penalty for document titles
    const rowConcat = normalizeHeader(filledCells.join(' '));
    for (const titleWord of TITLE_PATTERNS) {
      if (rowConcat.includes(titleWord) && recognizedCount <= 1) {
        score -= 5;
        break;
      }
    }

    // Bonus if the next row has data and different length/types
    if (r + 1 < matrix.length) {
      const nextRow = matrix[r + 1];
      if (nextRow && Array.isArray(nextRow)) {
        const nextFilled = nextRow.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
        if (nextFilled.length >= filledCells.length - 2) {
          score += 2;
        }
      }
    }

    candidateScores.push({
      rowIndex: r,
      score,
      headers: cells,
      recognizedCount,
      filledCount: filledCells.length,
    });
  }

  if (candidateScores.length === 0) {
    return {
      headerRowIndex: 0,
      headers: (matrix[0] || []).map((c) => (c !== null && c !== undefined ? String(c).trim() : '')),
      score: 0,
      confidence: 0,
      candidates: [],
    };
  }

  // Sort descending by score
  candidateScores.sort((a, b) => b.score - a.score);

  const best = candidateScores[0];
  const maxPossible = Math.max(10, best.filledCount * 4);
  const confidence = Math.min(100, Math.max(10, Math.round((best.score / maxPossible) * 100)));

  // Trim trailing empty headers
  let cleanHeaders = [...best.headers];
  while (cleanHeaders.length > 0 && !cleanHeaders[cleanHeaders.length - 1]) {
    cleanHeaders.pop();
  }

  const candidates: HeaderCandidate[] = candidateScores.slice(0, 5).map((c) => ({
    rowIndex: c.rowIndex,
    preview: c.headers.filter(Boolean).slice(0, 5),
    score: c.score,
  }));

  return {
    headerRowIndex: best.rowIndex,
    headers: cleanHeaders,
    score: best.score,
    confidence,
    candidates,
  };
}
