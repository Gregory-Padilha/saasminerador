import { NextRequest, NextResponse } from 'next/server';
import { knowledgeDb } from '@/lib/ai-brain/knowledge/db';
import { extractTextFromFile } from '@/lib/ai-brain/knowledge/extractor';
import { youtubeTranscriptProvider } from '@/lib/ai-brain/knowledge/transcription';
import { normalizeKnowledgeContent } from '@/lib/ai-brain/knowledge/normalization';
import { enrichKnowledgeDocument } from '@/lib/ai-brain/knowledge/enricher';
import { checkDuplicateKnowledge, computeHash } from '@/lib/ai-brain/knowledge/duplicates';
import { chunkKnowledgeDocument } from '@/lib/ai-brain/knowledge/chunker';
import { generateKnowledgeFicha } from '@/lib/ai-brain/knowledge/distiller';
import { KnowledgeDocument, KnowledgeSource, SourceType, KnowledgeCategory, KnowledgeType } from '@/lib/ai-brain/knowledge/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const doc = await knowledgeDb.getDocumentById(id);
      if (!doc) {
        return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
      }
      const chunks = await knowledgeDb.getChunks(id);
      const source = await knowledgeDb.getSourceById(doc.sourceId);
      return NextResponse.json({ document: doc, chunks, source });
    }

    const documents = await knowledgeDb.getDocuments();
    const sources = await knowledgeDb.getSources();

    return NextResponse.json({ documents, sources });
  } catch (err: any) {
    console.error('Error fetching knowledge documents:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let sourceType: SourceType = 'FILE';
    let rawContent = '';
    let fileName = '';
    let mimeType = '';
    let sourceUrl = '';
    let inputTitle = '';
    let inputCategory: KnowledgeCategory | undefined;
    let inputType: KnowledgeType | undefined;
    let inputTags: string[] = [];
    let forceDuplicate = false;
    const warnings: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      sourceType = (formData.get('source_type') as SourceType) || (file ? 'FILE' : 'PASTED_TEXT');
      sourceUrl = (formData.get('source_url') as string) || '';
      inputTitle = (formData.get('title') as string) || '';
      inputCategory = (formData.get('category') as KnowledgeCategory) || undefined;
      inputType = (formData.get('knowledge_type') as KnowledgeType) || undefined;
      forceDuplicate = formData.get('force') === 'true';

      const tagsStr = (formData.get('tags') as string) || '';
      if (tagsStr) inputTags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);

      if (sourceType === 'FILE' && file) {
        fileName = file.name;
        mimeType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const extraction = await extractTextFromFile(buffer, fileName, mimeType);
        rawContent = extraction.text;
        if (extraction.warnings) warnings.push(...extraction.warnings);
      } else if (sourceType === 'PASTED_TEXT') {
        rawContent = (formData.get('text') as string) || '';
        fileName = inputTitle || 'Texto Colado';
      } else if (sourceType === 'VIDEO' || sourceType === 'URL') {
        fileName = inputTitle || sourceUrl;
      }
    } else {
      const body = await req.json();
      sourceType = body.sourceType || (body.sourceUrl ? 'VIDEO' : 'PASTED_TEXT');
      sourceUrl = body.sourceUrl || '';
      rawContent = body.text || body.content || '';
      inputTitle = body.title || '';
      inputCategory = body.category;
      inputType = body.knowledgeType;
      inputTags = Array.isArray(body.tags) ? body.tags : [];
      forceDuplicate = !!body.force;
    }

    // Pipeline Stage 1 & 2: INGEST & EXTRACT / TRANSCRIBE
    let videoMetadata: any = null;

    if (sourceType === 'VIDEO' || (sourceUrl && (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be')))) {
      sourceType = 'VIDEO';
      const transcriptRes = await youtubeTranscriptProvider.getTranscript(sourceUrl);
      if (!transcriptRes.success) {
        if (!rawContent) {
          return NextResponse.json(
            {
              error: transcriptRes.error || 'Não foi possível obter a transcrição do vídeo.',
              requiresManualTranscript: true,
              metadata: transcriptRes.metadata,
            },
            { status: 400 }
          );
        }
      } else {
        rawContent = transcriptRes.transcript || rawContent;
        videoMetadata = transcriptRes.metadata;
        if (!inputTitle && videoMetadata?.title) {
          inputTitle = videoMetadata.title;
        }
      }
    }

    if (!rawContent || !rawContent.trim()) {
      return NextResponse.json({ error: 'Nenhum conteúdo utilizável foi fornecido para ingestão.' }, { status: 400 });
    }

    // Duplicate Check
    const hash = computeHash(rawContent);
    if (!forceDuplicate) {
      const dupCheck = await checkDuplicateKnowledge(hash, sourceUrl, inputTitle);
      if (dupCheck.isDuplicate) {
        return NextResponse.json(
          {
            warning: dupCheck.message,
            isDuplicate: true,
            existingDocument: dupCheck.existingDocument,
          },
          { status: 409 }
        );
      }
    }

    // Save Source Material
    const sourceId = `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sourceRecord: KnowledgeSource = {
      id: sourceId,
      sourceType,
      originalName: fileName || inputTitle || 'Fonte de Conhecimento',
      sourceUrl: sourceUrl || undefined,
      author: videoMetadata?.author,
      thumbnail: videoMetadata?.thumbnail,
      duration: videoMetadata?.duration,
      mimeType: mimeType || undefined,
      hash,
      rawContent,
      createdAt: new Date().toISOString(),
    };
    await knowledgeDb.saveSource(sourceRecord);

    // Pipeline Stage 3: ENRICH (Auto-title & Taxonomy)
    const enriched = enrichKnowledgeDocument({
      rawContent,
      sourceType,
      originalTitle: inputTitle || fileName || 'Conhecimento Sem Título',
      userCategory: inputCategory,
      userType: inputType,
      userTags: inputTags,
      sourceUrl,
      sourceAuthor: videoMetadata?.author,
    });

    // Pipeline Stage 4: NORMALIZE (Canonical Markdown Output)
    const normalized = normalizeKnowledgeContent({
      rawContent,
      sourceType,
      title: enriched.title,
      originalTitle: enriched.originalTitle,
      category: enriched.category,
      tags: enriched.tags,
      sourceUrl,
      sourceAuthor: videoMetadata?.author,
    });

    // Pipeline Stage 5: INDEX (Chunking & Ficha Generation)
    const docId = `kdoc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const chunks = chunkKnowledgeDocument(
      docId,
      enriched.title,
      enriched.category,
      enriched.knowledgeType,
      normalized.canonicalMarkdown,
      enriched.tags,
      { sourceType, sourceUrl }
    );

    const structuredFicha = generateKnowledgeFicha(
      enriched.title,
      normalized.cleanedText,
      enriched.category,
      enriched.knowledgeType
    );

    // Final Document Object
    const newDoc: KnowledgeDocument = {
      id: docId,
      sourceId,
      title: enriched.title,
      originalTitle: enriched.originalTitle,
      description: enriched.description,
      canonicalMarkdown: normalized.canonicalMarkdown,
      category: enriched.category,
      knowledgeType: enriched.knowledgeType,
      knowledgeStatus: 'PROCESSED',
      trustStatus: 'REFERÊNCIA',
      sourceType,
      sourceUrl: sourceUrl || undefined,
      sourceAuthor: videoMetadata?.author,
      tags: enriched.tags,
      topics: enriched.topics,
      frameworksMentioned: enriched.frameworksMentioned,
      entities: enriched.entities,
      collections: enriched.collections,
      language: 'pt-BR',
      processingStatus: 'READY',
      rawTranscript: sourceType === 'VIDEO' ? rawContent : undefined,
      structuredFicha,
      chunkCount: chunks.length,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await knowledgeDb.saveDocument(newDoc, chunks);

    return NextResponse.json({
      success: true,
      document: newDoc,
      source: sourceRecord,
      chunkCount: chunks.length,
      warnings,
    });
  } catch (err: any) {
    console.error('Error processing knowledge POST:', err);
    return NextResponse.json({ error: err.message || 'Erro interno de ingestão de conhecimento.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID do documento é obrigatório' }, { status: 400 });
    }
    await knowledgeDb.deleteDocument(id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('Error deleting knowledge document:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
