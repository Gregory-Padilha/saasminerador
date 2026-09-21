import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledgeLibrary, formatKnowledgeForPrompt } from '@/lib/ai-brain/knowledge/retrieval';
import { knowledgeDb } from '@/lib/ai-brain/knowledge/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query || '';
    const filters = body.filters || {};

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query de busca é obrigatória' }, { status: 400 });
    }

    const results = await searchKnowledgeLibrary(query, filters);
    const formattedContext = formatKnowledgeForPrompt(results);

    // Record usage if document was matched
    if (results.length > 0) {
      results.forEach((r) => {
        knowledgeDb.recordUsage({
          id: `usg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          documentId: r.document.id,
          query,
          createdAt: new Date().toISOString(),
        });
      });
    }

    return NextResponse.json({
      results,
      formattedContext,
      totalMatched: results.length,
    });
  } catch (err: any) {
    console.error('Error searching knowledge RAG:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
