import { dbService } from '@/lib/supabase/db';
import { aiDbService } from '@/lib/ai-intelligence/db';
import { AIContextPackage, ExportFormat } from './types';
import { renderMarkdownPackage, renderJSONPackage } from './renderers';
import { sanitizeObject } from './sanitizer';

export class ContextExportService {
  /**
   * Fast non-blocking token estimator (~4 chars per token rule of thumb)
   */
  static estimateTokenCount(textOrObject: string | any): number {
    if (!textOrObject) return 0;
    const textStr = typeof textOrObject === 'string' ? textOrObject : JSON.stringify(textOrObject);
    return Math.ceil(textStr.length / 4);
  }

  /**
   * Export Thread Context from AI Intelligence
   */
  static async exportThreadContext(params: {
    threadId: string;
    scope: 'conversa' | 'conversa_sources' | 'full';
    format?: ExportFormat;
    checkboxes?: Record<string, boolean>;
  }): Promise<{ fileName: string; content: string; tokenEstimate: number; format: ExportFormat }> {
    const { threadId, scope, format = 'markdown', checkboxes = {} } = params;

    const thread = await aiDbService.getThreadById(threadId);
    const messages = await aiDbService.getMessages(threadId);

    const dateSlug = new Date().toISOString().split('T')[0];
    const threadSlug = thread?.title
      ? thread.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)
      : 'thread';

    const fileName = `ai-intelligence-thread-${threadSlug}-${dateSlug}.${format === 'json' ? 'json' : 'md'}`;

    const attachedOfferIds = thread?.attachedOfferIds || [];
    let offerFacts: Record<string, any> | undefined;
    let landingPageFacts: Record<string, any> | undefined;
    let checkoutFacts: Record<string, any> | undefined;

    if (attachedOfferIds.length > 0 && checkboxes.attachedOffers !== false) {
      const firstOffer = await dbService.getOfferById(attachedOfferIds[0]);
      if (firstOffer) {
        offerFacts = firstOffer;
        landingPageFacts = {
          status: firstOffer.lp_mapping_status || 'NOT_MAPPED',
          url: firstOffer.landing_page_url,
          heroHeadline: firstOffer.headline,
        };
        checkoutFacts = {
          status: firstOffer.checkout_mapping_status || 'NOT_MAPPED',
          url: firstOffer.checkout_url,
          frontPrice: firstOffer.price,
        };
      }
    }

    const conversation = messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      provider: m.metadata?.provider,
      model: m.metadata?.model,
      sourcesCount: m.metadata?.sources?.length || 0,
      toolCallsCount: m.metadata?.toolCallsCount || 0,
    }));

    const providersUsed = Array.from(
      new Set(messages.map((m) => m.metadata?.provider).filter(Boolean))
    ) as string[];

    const pkg: AIContextPackage = {
      metadata: {
        title: `Thread: ${thread?.title || 'Análise de Inteligência'}`,
        generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        version: '1.0.0',
        scope: scope === 'conversa' ? 'chat_conversa' : scope === 'conversa_sources' ? 'chat_sources' : 'chat_full',
        threadId,
        mode: thread?.mode || 'quick',
        providersUsed: providersUsed.length > 0 ? providersUsed : [thread?.provider || 'gemini'],
      },
      aiInstructions: `You are receiving structured context exported from Offer Miner AI Intelligence.
Use the data below as evidence and context.

Distinguish:
- observed facts;
- system-derived analysis;
- hypotheses.

Do not assume missing data is zero.
When a field is NOT_MAPPED, UNKNOWN or NOT_AVAILABLE, treat it as unknown rather than absence.`,
      conversation,
      offerFacts: scope === 'full' ? offerFacts : undefined,
      landingPageFacts: scope === 'full' ? landingPageFacts : undefined,
      checkoutFacts: scope === 'full' ? checkoutFacts : undefined,
      sources:
        scope !== 'conversa'
          ? messages.flatMap((m) => m.metadata?.sources || []).map((s) => ({
              type: s.type,
              id: s.id,
              title: s.title,
              url: (s as any).url || (s as any).targetUrl,
              provenance: 'AI_INTELLIGENCE_THREAD',
            }))
          : undefined,
    };

    const sanitizedPkg = sanitizeObject(pkg);
    const content = format === 'json' ? renderJSONPackage(sanitizedPkg) : renderMarkdownPackage(sanitizedPkg);
    const tokenEstimate = this.estimateTokenCount(content);

    return { fileName, content, tokenEstimate, format };
  }

  /**
   * Export Offer Dossier / Context from Offer Detail Page
   */
  static async exportOfferContext(params: {
    offerId: string;
    scope: 'compact' | 'dossier';
    format?: ExportFormat;
    includeAllCreatives?: boolean;
    selectedCheckboxes?: Record<string, boolean>;
  }): Promise<{ fileName: string; content: string; tokenEstimate: number; format: ExportFormat }> {
    const { offerId, scope, format = 'markdown', includeAllCreatives = false, selectedCheckboxes = {} } = params;

    const offer = await dbService.getOfferById(offerId);
    if (!offer) {
      throw new Error(`Oferta não encontrada para exportação: ${offerId}`);
    }

    const dateSlug = new Date().toISOString().split('T')[0];
    const nameSlug = offer.product_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 30);

    const fileName = `${nameSlug}-${scope === 'compact' ? 'compact-context' : 'full-dossier'}-${dateSlug}.${
      format === 'json' ? 'json' : 'md'
    }`;

    // Fetch Ads & Creatives associated with offer
    const ads = await dbService.getOfferAds(offerId);

    // Build Creatives Fact Records
    const creativesFacts = ads.slice(0, includeAllCreatives ? undefined : 10).map((ad) => {
      const primaryMedia = ad.media?.[0];
      return {
        creativeId: ad.id,
        mediaType: primaryMedia?.media_type || 'video',
        durationSeconds: primaryMedia?.duration_seconds || 47,
        associatedAdsCount: ad.media?.length || 1,
        earliestSeenAdDate: ad.started_at || offer.oldest_ad_date || new Date().toISOString(),
        headline: ad.headline || ad.primary_text?.substring(0, 80) || offer.headline || null,
        transcript: {
          fullText: ad.primary_text || 'Transcrição não gerada',
        },
      };
    });

    const isLpMapped = offer.lp_mapping_status === 'SUCCESS' || (offer.lp_mapping_status as string) === 'MAPPED';
    const isCheckoutMapped = offer.checkout_mapping_status === 'SUCCESS' || (offer.checkout_mapping_status as string) === 'MAPPED';

    const pkg: AIContextPackage = {
      metadata: {
        title: `${offer.product_name} — ${scope === 'compact' ? 'Contexto Compacto' : 'Dossiê Completo'}`,
        generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        version: '1.0.0',
        scope: scope === 'compact' ? 'offer_compact' : 'offer_dossier',
        subjectName: offer.product_name,
        subjectId: offer.id,
        activeAdsCount: offer.active_ads_count || 0,
        uniqueCreativesCount: offer.unique_creatives_count || offer.captured_creatives_count || 0,
        collectedAdsCount: offer.captured_creatives_count || offer.creatives?.length || 0,
        scrapingStatus: offer.data_scraping_status || 'NOT_PROCESSED',
      },
      aiInstructions: `You are receiving structured context exported from Offer Miner for offer "${offer.product_name}".

Use the data below as evidence and context.

Distinguish:
- observed facts;
- system-derived analysis;
- hypotheses.

Do not assume missing data is zero.
When a field is NOT_MAPPED, UNKNOWN or NOT_AVAILABLE, treat it as unknown rather than absence.`,
      offerFacts: selectedCheckboxes.identity !== false ? offer : undefined,
      landingPageFacts: selectedCheckboxes.landingPage !== false
        ? {
            status: isLpMapped ? 'MAPPED' : 'NOT_MAPPED',
            url: offer.landing_page_url,
            mappedAt: isLpMapped ? new Date().toISOString().split('T')[0] : undefined,
            heroHeadline: offer.headline,
          }
        : undefined,
      checkoutFacts: selectedCheckboxes.checkout !== false
        ? {
            status: isCheckoutMapped ? 'MAPPED' : 'NOT_MAPPED',
            url: offer.checkout_url,
            frontPrice: offer.price,
            discoveryStatus: offer.checkout_discovery_status || 'NOT_PROCESSED',
          }
        : undefined,
      creativesFacts: selectedCheckboxes.creatives !== false ? creativesFacts : undefined,
      availability: {
        landingPage: isLpMapped ? 'MAPPED' : 'NOT_MAPPED',
        checkout: isCheckoutMapped ? 'MAPPED' : 'UNKNOWN',
        creatives: `${offer.unique_creatives_count || offer.captured_creatives_count || 0} AVAILABLE`,
        audience: offer.niche ? 'PARTIAL' : 'NOT_AVAILABLE',
        history: `${offer.snapshots?.length || 0} SNAPSHOTS`,
        copy: offer.headline ? 'COMPLETE' : 'NOT_AVAILABLE',
      },
      insightsAndNotes: selectedCheckboxes.notes !== false && offer.notes
        ? [
            {
              type: 'user_note',
              title: 'Notas Manuais do Usuário',
              content: offer.notes,
            },
          ]
        : undefined,
    };

    const sanitizedPkg = sanitizeObject(pkg);
    const content = format === 'json' ? renderJSONPackage(sanitizedPkg) : renderMarkdownPackage(sanitizedPkg);
    const tokenEstimate = this.estimateTokenCount(content);

    return { fileName, content, tokenEstimate, format };
  }
}
