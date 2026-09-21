import { dbService } from '@/lib/supabase/db';
import { getOfferScaleTier } from '@/lib/scale-tier';
import { calculateDossierCompleteness } from '@/lib/dossier';
import { calculateFrontendPricing } from '@/lib/pricing';
import { AiToolContract, AiToolError } from './types';
import {
  SearchOffersSchema,
  GetOfferSchema,
  GetOfferContextSchema,
  GetOffersContextSchema,
  ListCreativesSchema,
  GetCreativeSchema,
  GetLandingPageAnalysisSchema,
  GetCheckoutAnalysisSchema,
  CompareOffersSchema,
  GetMappingStatusSchema,
  SearchDeepDivesSchema,
  GetDeepDiveSchema,
  SearchInsightsSchema,
  SearchPatternsSchema,
  GetOfferHistorySchema,
  SearchKnowledgeSchema,
  GetKnowledgeDocumentSchema,
  ListKnowledgeDocumentsSchema,
  CheckOfferDuplicateSchema,
  CheckOffersDuplicatesSchema,
} from '@/lib/mcp/schemas';
import { searchKnowledgeLibrary, knowledgeDb } from '@/lib/ai-brain/knowledge';

/**
 * Universal Shared AI Tool Definitions and Handlers (15 Read-Only Tools)
 */
export const AI_TOOLS_LIST: AiToolContract[] = [
  {
    name: 'search_offers',
    description:
      "Search the user's Offer Miner catalog using factual filters such as niche, active ads, price, mapping state, scale tier and offer metadata. Use this before retrieving detailed information.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for product name, advertiser or niche' },
        niche: { type: 'array', items: { type: 'string' }, description: 'Filter by niches' },
        subniche: { type: 'array', items: { type: 'string' } },
        productType: { type: 'array', items: { type: 'string' } },
        minAds: { type: 'number' },
        maxAds: { type: 'number' },
        minDays: { type: 'number' },
        maxDays: { type: 'number' },
        minPrice: { type: 'number' },
        maxPrice: { type: 'number' },
        scaleTier: {
          type: 'array',
          items: { type: 'string', enum: ['NORMAL', 'SCALING', 'HIGH_SCALE', 'FULL_SCALE'] },
        },
        faceless: { type: 'boolean' },
        hasLandingPage: { type: 'boolean' },
        landingPageMapped: { type: 'boolean' },
        hasCheckout: { type: 'boolean' },
        checkoutMapped: { type: 'boolean' },
        favorite: { type: 'boolean' },
        deepDive: { type: 'boolean' },
        source: { type: 'array', items: { type: 'string' } },
        sort: { type: 'string' },
        limit: { type: 'number', default: 20 },
        cursor: { type: 'string' },
      },
    },
    execute: async (rawArgs) => {
      const args = SearchOffersSchema.parse(rawArgs);
      const allOffers = await dbService.getOffers();

      let filtered = [...allOffers];

      // Query Text Filter
      if (args.query && args.query.trim()) {
        const q = args.query.toLowerCase().trim();
        filtered = filtered.filter(
          (o) =>
            o.product_name.toLowerCase().includes(q) ||
            (o.advertiser && o.advertiser.toLowerCase().includes(q)) ||
            (o.niche && o.niche.toLowerCase().includes(q))
        );
      }

      // Niche Filter
      if (args.niche && args.niche.length > 0) {
        filtered = filtered.filter((o) => o.niche && args.niche?.includes(o.niche));
      }

      // Subniche Filter
      if (args.subniche && args.subniche.length > 0) {
        filtered = filtered.filter((o) => o.subniche && args.subniche?.includes(o.subniche));
      }

      // Product Type Filter
      if (args.productType && args.productType.length > 0) {
        filtered = filtered.filter((o) => o.product_type && args.productType?.includes(o.product_type));
      }

      // Ads Count Filter
      if (typeof args.minAds === 'number') {
        filtered = filtered.filter((o) => (o.active_ads_count ?? 0) >= args.minAds!);
      }
      if (typeof args.maxAds === 'number') {
        filtered = filtered.filter((o) => (o.active_ads_count ?? 0) <= args.maxAds!);
      }

      // Days Running Filter
      if (typeof args.minDays === 'number') {
        filtered = filtered.filter((o) => (o.days_running ?? 0) >= args.minDays!);
      }
      if (typeof args.maxDays === 'number') {
        filtered = filtered.filter((o) => (o.days_running ?? 0) <= args.maxDays!);
      }

      // Price Filter
      if (typeof args.minPrice === 'number') {
        filtered = filtered.filter((o) => (o.price ?? 0) >= args.minPrice!);
      }
      if (typeof args.maxPrice === 'number') {
        filtered = filtered.filter((o) => (o.price ?? 0) <= args.maxPrice!);
      }

      // Scale Tier Filter
      if (args.scaleTier && args.scaleTier.length > 0) {
        filtered = filtered.filter((o) => {
          const tier = getOfferScaleTier(o.active_ads_count).tier;
          return args.scaleTier?.includes(tier);
        });
      }

      // Faceless Filter
      if (typeof args.faceless === 'boolean') {
        filtered = filtered.filter((o) => Boolean(o.faceless) === args.faceless);
      }

      // Landing Page Status Filter
      if (typeof args.hasLandingPage === 'boolean') {
        filtered = filtered.filter((o) => Boolean(o.landing_page_url) === args.hasLandingPage);
      }
      if (typeof args.landingPageMapped === 'boolean') {
        filtered = filtered.filter((o) => (o.lp_mapping_status === 'SUCCESS') === args.landingPageMapped);
      }

      // Checkout Status Filter
      if (typeof args.hasCheckout === 'boolean') {
        filtered = filtered.filter((o) => Boolean(o.checkout_url) === args.hasCheckout);
      }
      if (typeof args.checkoutMapped === 'boolean') {
        filtered = filtered.filter((o) => (o.checkout_mapping_status === 'SUCCESS') === args.checkoutMapped);
      }

      // Favorite & DeepDive Filters
      if (typeof args.favorite === 'boolean') {
        filtered = filtered.filter((o) => Boolean(o.favorite) === args.favorite);
      }
      if (typeof args.deepDive === 'boolean') {
        filtered = filtered.filter((o) => Boolean(o.in_deep_dive) === args.deepDive);
      }

      // Sorting
      if (args.sort) {
        const sortKey = String(args.sort);
        if (sortKey === 'activeAds_desc' || sortKey === 'active_ads_count') {
          filtered.sort((a, b) => (b.active_ads_count ?? 0) - (a.active_ads_count ?? 0));
        } else if (sortKey === 'activeAds_asc') {
          filtered.sort((a, b) => (a.active_ads_count ?? 0) - (b.active_ads_count ?? 0));
        } else if (sortKey === 'daysRunning_desc' || sortKey === 'days_running') {
          filtered.sort((a, b) => (b.days_running ?? 0) - (a.days_running ?? 0));
        } else if (sortKey === 'price_asc') {
          filtered.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        } else if (sortKey === 'price_desc' || sortKey === 'price') {
          filtered.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        }
      }

      // Cursor Pagination
      let startIndex = 0;
      if (args.cursor) {
        const found = filtered.findIndex((o) => o.id === args.cursor);
        if (found >= 0) startIndex = found + 1;
      }

      const paginated = filtered.slice(startIndex, startIndex + args.limit);
      const nextCursor = paginated.length === args.limit ? paginated[paginated.length - 1].id : null;

      const summaryList = paginated.map((o) => {
        const scaleTier = getOfferScaleTier(o.active_ads_count).tier;
        const pricingInfo = calculateFrontendPricing(o.frontend_options, o.price);

        return {
          id: o.id,
          name: o.product_name,
          advertiser: o.advertiser ?? null,
          niche: o.niche ?? null,
          subniche: o.subniche ?? null,
          productType: o.product_type ?? 'Digital',
          activeAds: o.active_ads_count ?? null,
          distinctCreatives: o.estimated_unique_creatives ?? o.captured_creatives_count ?? null,
          daysRunning: o.days_running ?? null,
          scaleTier,
          price: o.price ?? null,
          prices: pricingInfo.options.map((opt) => opt.current_price),
          faceless: o.faceless ?? null,
          landingPageStatus: o.landing_page_url_status ?? (o.landing_page_url ? 'AVAILABLE' : 'NONE'),
          checkoutStatus: o.checkout_discovery_status ?? (o.checkout_url ? 'FOUND' : 'NONE'),
          scrapingStatus: o.data_scraping_status || 'NOT_PROCESSED',
          deepDiveStatus: o.in_deep_dive ? 'IN_WORKSHOP' : 'NONE',
        };
      });

      return {
        total: filtered.length,
        returned: summaryList.length,
        nextCursor,
        offers: summaryList,
      };
    },
  },
  {
    name: 'get_offer',
    description:
      'Retrieve normalized details for one specific offer by ID. Returns structured JSON fields conserving token window.',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string', description: 'The UUID of the offer' },
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'overview',
              'advertiser',
              'pricing',
              'creativeSummary',
              'landingPage',
              'checkout',
              'copy',
              'audience',
              'history',
              'deepDive',
              'mappingStatus',
              'scraping',
            ],
          },
        },
      },
      required: ['offerId'],
    },
    execute: async (rawArgs) => {
      const { offerId, include } = GetOfferSchema.parse(rawArgs);
      const offer = await dbService.getOfferById(offerId);

      if (!offer) {
        throw new AiToolError('NOT_FOUND', `Oferta com ID ${offerId} não encontrada.`);
      }

      const scaleInfo = getOfferScaleTier(offer.active_ads_count);
      const pricingInfo = calculateFrontendPricing(offer.frontend_options, offer.price);
      const dossierComp = calculateDossierCompleteness(offer);

      const requested = new Set(
        include || ['overview', 'advertiser', 'pricing', 'scale', 'landingPage', 'checkout', 'deepDive']
      );

      const result: Record<string, any> = {
        id: offer.id,
        name: offer.product_name,
        niche: offer.niche ?? null,
        subniche: offer.subniche ?? null,
        productType: offer.product_type ?? 'Digital',
      };

      if (requested.has('advertiser')) result.advertiser = offer.advertiser ?? null;
      if (requested.has('overview')) {
        result.faceless = offer.faceless ?? null;
        result.favorite = Boolean(offer.favorite);
        result.watching = Boolean(offer.watching);
        result.dossierCompleteness = dossierComp.percentage;
      }
      if (requested.has('scale') || requested.has('overview')) {
        result.scale = {
          activeAdsCount: offer.active_ads_count ?? null,
          activeAdsDescription: 'Volume total de anúncios ativos observados na Meta Ads (Métrica de Escala)',
          collectedAdsCount: offer.captured_ads_count ?? null,
          collectedAdsDescription: 'Quantidade de anúncios individualmente coletados no SaaS',
          uniqueCreativesCount: offer.captured_unique_creatives ?? offer.unique_creatives_count ?? offer.estimated_unique_creatives ?? null,
          uniqueCreativesDescription: 'Quantidade de peças criativas distintas identificadas após deduplicação',
          storedMediaCount: offer.stored_media_count ?? null,
          daysRunning: offer.days_running ?? null,
          tier: scaleInfo.tier,
          label: scaleInfo.label,
        };
      }
      if (requested.has('pricing')) {
        result.pricing = {
          price: offer.price ?? null,
          currency: offer.currency || 'BRL',
          options: pricingInfo.options.map((opt) => ({
            name: opt.name,
            price: opt.current_price,
            checkoutUrl: opt.cta_url ?? null,
          })),
          min: pricingInfo.min,
          max: pricingInfo.max,
          average: pricingInfo.average,
        };
      }
      if (requested.has('landingPage')) {
        result.landingPage = {
          url: offer.landing_page_url ?? null,
          status: offer.landing_page_url_status ?? null,
          mappedAt: offer.lp_mapped_at ?? null,
          headline: offer.headline ?? null,
          subheadline: offer.subheadline ?? null,
        };
      }
      if (requested.has('checkout')) {
        result.checkout = {
          url: offer.checkout_url ?? null,
          discoveryStatus: offer.checkout_discovery_status ?? null,
          discoveredAt: offer.checkout_discovery_at ?? null,
          orderBumpsCount: offer.order_bumps?.length || 0,
        };
      }
      if (requested.has('deepDive')) {
        result.inDeepDive = Boolean(offer.in_deep_dive);
      }
      if (requested.has('scraping') || requested.has('overview')) {
        result.scraping = {
          status: offer.data_scraping_status || 'NOT_PROCESSED',
          completedAt: offer.data_scraping_completed_at ?? null,
          conflicts: offer.data_scraping_reconciliation?.conflicts || [],
          reconciledFieldsCount: offer.data_scraping_reconciliation?.fieldsEnrichedCount || 0,
        };
      }

      return { offer: result };
    },
  },
  {
    name: 'get_offer_context',
    description:
      'Retrieve normalized intelligence context for one offer. Use when performing a detailed strategic analysis of a specific offer.',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string', description: 'The UUID of the offer' },
        depth: { type: 'string', enum: ['summary', 'standard', 'deep'], default: 'standard' },
      },
      required: ['offerId'],
    },
    execute: async (rawArgs) => {
      const { offerId, depth } = GetOfferContextSchema.parse(rawArgs);
      const offer = await dbService.getOfferById(offerId);

      if (!offer) {
        throw new AiToolError('NOT_FOUND', `Oferta com ID ${offerId} não encontrada.`);
      }

      const scaleInfo = getOfferScaleTier(offer.active_ads_count);
      const pricingInfo = calculateFrontendPricing(offer.frontend_options, offer.price);
      const dossierComp = calculateDossierCompleteness(offer);

      if (depth === 'summary') {
        return {
          offerId: offer.id,
          name: offer.product_name,
          advertiser: offer.advertiser ?? null,
          niche: offer.niche ?? null,
          scaleTier: scaleInfo.tier,
          activeAds: offer.active_ads_count ?? null,
          price: offer.price ?? null,
          dossierCompleteness: dossierComp.percentage,
          scrapingStatus: offer.data_scraping_status || 'NOT_PROCESSED',
        };
      }

      const deepDive = await dbService.getDeepDiveById(offerId);

      return {
        id: offer.id,
        name: offer.product_name,
        advertiser: offer.advertiser ?? null,
        niche: offer.niche ?? null,
        subniche: offer.subniche ?? null,
        productType: offer.product_type ?? 'Digital',
        faceless: offer.faceless ?? null,

        scale: {
          activeAds: offer.active_ads_count ?? null,
          daysRunning: offer.days_running ?? null,
          distinctCreatives: offer.estimated_unique_creatives ?? offer.captured_creatives_count ?? null,
          tier: scaleInfo.tier,
        },

        pricing: {
          frontPrice: offer.price ?? null,
          currency: offer.currency || 'BRL',
          optionsCount: pricingInfo.options.length,
          options: pricingInfo.options.map((opt) => ({
            name: opt.name,
            price: opt.current_price,
            checkoutUrl: opt.cta_url ?? null,
          })),
          minPrice: pricingInfo.min,
          maxPrice: pricingInfo.max,
          avgPrice: pricingInfo.average,
        },

        landingPage: {
          url: offer.landing_page_url ?? null,
          status: offer.landing_page_url_status ?? null,
          headline: offer.headline ?? null,
          subheadline: offer.subheadline ?? null,
        },

        checkout: {
          url: offer.checkout_url ?? null,
          discoveryStatus: offer.checkout_discovery_status ?? null,
          orderBumps: (offer.order_bumps || []).map((b) => ({
            name: b.name,
            price: b.price,
            description: b.description ?? null,
          })),
        },

        scraping: {
          status: offer.data_scraping_status || 'NOT_PROCESSED',
          completedAt: offer.data_scraping_completed_at ?? null,
          conflicts: offer.data_scraping_reconciliation?.conflicts || [],
          reconciledFieldsCount: offer.data_scraping_reconciliation?.fieldsEnrichedCount || 0,
        },

        deepDive: deepDive
          ? {
              status: deepDive.status,
              priority: deepDive.priority,
              investigationProgress: deepDive.investigation_progress ?? 0,
              snapshots: {
                start: deepDive.start_snapshot ?? null,
                end: deepDive.end_snapshot ?? null,
              },
              hypothesesCount: deepDive.hypotheses?.length || 0,
              insightsCount: deepDive.insights?.length || 0,
              caseSummary: deepDive.case_summary ?? null,
            }
          : null,
      };
    },
  },
  {
    name: 'get_offers_context',
    description:
      'Retrieve normalized intelligence context for MULTIPLE offers in a single batch call. Ideal for comparing or analyzing multiple offers efficiently without N+1 queries.',
    inputSchema: {
      type: 'object',
      properties: {
        offerIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of UUIDs of the offers to fetch (max 15)',
        },
        depth: { type: 'string', enum: ['summary', 'standard', 'deep'], default: 'standard' },
      },
      required: ['offerIds'],
    },
    execute: async (rawArgs) => {
      const { offerIds, depth } = GetOffersContextSchema.parse(rawArgs);
      const results: any[] = [];

      for (const id of offerIds.slice(0, 15)) {
        try {
          const offer = await dbService.getOfferById(id);
          if (!offer) continue;

          const scaleInfo = getOfferScaleTier(offer.active_ads_count);
          const pricingInfo = calculateFrontendPricing(offer.frontend_options, offer.price);
          const dossierComp = calculateDossierCompleteness(offer);

          if (depth === 'summary') {
            results.push({
              offerId: offer.id,
              name: offer.product_name,
              advertiser: offer.advertiser ?? null,
              niche: offer.niche ?? null,
              scaleTier: scaleInfo.tier,
              activeAds: offer.active_ads_count ?? null,
              price: offer.price ?? null,
              dossierCompleteness: dossierComp.percentage,
              scrapingStatus: offer.data_scraping_status || 'NOT_PROCESSED',
            });
          } else {
            results.push({
              id: offer.id,
              name: offer.product_name,
              advertiser: offer.advertiser ?? null,
              niche: offer.niche ?? null,
              subniche: offer.subniche ?? null,
              productType: offer.product_type ?? 'Digital',
              scale: {
                activeAds: offer.active_ads_count ?? null,
                daysRunning: offer.days_running ?? null,
                distinctCreatives: offer.estimated_unique_creatives ?? offer.captured_creatives_count ?? null,
                tier: scaleInfo.tier,
              },
              pricing: {
                frontPrice: offer.price ?? null,
                currency: offer.currency || 'BRL',
                optionsCount: pricingInfo.options.length,
                minPrice: pricingInfo.min,
                maxPrice: pricingInfo.max,
                avgPrice: pricingInfo.average,
              },
              landingPageUrl: offer.landing_page_url ?? null,
              checkoutUrl: offer.checkout_url ?? null,
              orderBumpsCount: offer.order_bumps?.length || 0,
              scrapingStatus: offer.data_scraping_status || 'NOT_PROCESSED',
            });
          }
        } catch {
          // ignore single item error in batch
        }
      }

      return { total: results.length, offers: results };
    },
  },
  {
    name: 'list_creatives',
    description:
      'List creative ads (video/image) associated with an offer with media URLs, headlines, primary text and dates.',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string' },
        type: { type: 'string', enum: ['video', 'image', 'all'], default: 'all' },
        limit: { type: 'number', default: 20 },
        cursor: { type: 'string' },
      },
      required: ['offerId'],
    },
    execute: async (rawArgs) => {
      const { offerId, type, limit, cursor } = ListCreativesSchema.parse(rawArgs);
      const offer = await dbService.getOfferById(offerId);

      if (!offer) {
        throw new AiToolError('NOT_FOUND', `Oferta com ID ${offerId} não encontrada.`);
      }

      let ads = offer.ads || [];
      if (type !== 'all') {
        ads = ads.filter((ad) => {
          const media = ad.media?.[0];
          return media?.media_type === type;
        });
      }

      let startIndex = 0;
      if (cursor) {
        const found = ads.findIndex((a) => a.id === cursor);
        if (found >= 0) startIndex = found + 1;
      }

      const paginated = ads.slice(startIndex, startIndex + limit);
      const nextCursor = paginated.length === limit ? paginated[paginated.length - 1].id : null;

      const creativesList = paginated.map((ad) => {
        const media = ad.media?.[0];
        return {
          adId: ad.id,
          metaAdId: ad.meta_ad_id,
          type: media?.media_type || 'video',
          mediaUrl: media?.media_display_url || media?.media_url || null,
          thumbnailUrl: media?.thumbnail_display_url || media?.thumbnail_url || null,
          headline: ad.headline ?? null,
          primaryText: ad.primary_text ?? null,
          cta: ad.cta ?? null,
          startDate: ad.started_at ?? null,
          durationSeconds: media?.duration_seconds ?? null,
        };
      });

      return {
        total: ads.length,
        returned: creativesList.length,
        nextCursor,
        creatives: creativesList,
      };
    },
  },
  {
    name: 'get_creative',
    description: 'Get complete detail for a single creative ad by creative ID.',
    inputSchema: {
      type: 'object',
      properties: {
        creativeId: { type: 'string' },
      },
      required: ['creativeId'],
    },
    execute: async (rawArgs) => {
      const { creativeId } = GetCreativeSchema.parse(rawArgs);
      const offers = await dbService.getOffers();

      let targetAd: any = null;
      for (const o of offers) {
        if (o.ads) {
          const found = o.ads.find((a) => a.id === creativeId || a.meta_ad_id === creativeId);
          if (found) {
            targetAd = found;
            break;
          }
        }
      }

      if (!targetAd) {
        throw new AiToolError('NOT_FOUND', `Criativo com ID ${creativeId} não encontrado.`);
      }

      return { creative: targetAd };
    },
  },
  {
    name: 'get_landing_page_analysis',
    description:
      'Retrieve structured Landing Page intelligence (headline, promise, CTA, sections, deliverables, bonuses, guarantees, FAQs).',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string' },
        includeSections: { type: 'boolean', default: false },
        includePricing: { type: 'boolean', default: true },
        includeCopy: { type: 'boolean', default: true },
        includeLinks: { type: 'boolean', default: false },
      },
      required: ['offerId'],
    },
    execute: async (rawArgs) => {
      const { offerId, includeSections, includePricing, includeCopy } = GetLandingPageAnalysisSchema.parse(rawArgs);
      const offer = await dbService.getOfferById(offerId);

      if (!offer) {
        throw new AiToolError('NOT_FOUND', `Oferta com ID ${offerId} não encontrada.`);
      }

      const pricingInfo = calculateFrontendPricing(offer.frontend_options, offer.price);

      return {
        url: offer.landing_page_url ?? null,
        status: offer.landing_page_url_status ?? null,
        mappedAt: offer.lp_mapped_at ?? null,
        copy: includeCopy
          ? {
              headline: offer.headline ?? null,
              subheadline: offer.subheadline ?? null,
              deliverables: (offer.deliverables || []).map((d) => d.title),
              bonuses: (offer.bonuses || []).map((b) => b.title),
            }
          : undefined,
        pricing: includePricing
          ? {
              frontPrice: offer.price ?? null,
              options: pricingInfo.options.map((opt) => ({
                name: opt.name,
                price: opt.current_price,
                checkoutUrl: opt.cta_url ?? null,
              })),
            }
          : undefined,
        sectionsCount: offer.lp_sections?.length || 0,
        sections: includeSections ? offer.lp_sections || [] : undefined,
      };
    },
  },
  {
    name: 'get_checkout_analysis',
    description:
      'Retrieve Checkout intelligence (provider, front price, installments, payment methods and order bump list).',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string' },
      },
      required: ['offerId'],
    },
    execute: async (rawArgs) => {
      const { offerId } = GetCheckoutAnalysisSchema.parse(rawArgs);
      const offer = await dbService.getOfferById(offerId);

      if (!offer) {
        throw new AiToolError('NOT_FOUND', `Oferta com ID ${offerId} não encontrada.`);
      }

      const isMapped = offer.checkout_discovery_status === 'FOUND' || Boolean(offer.checkout_url);
      const bumps = offer.order_bumps || [];
      const totalBumpsValue = bumps.reduce((acc, b) => acc + (b.price || 0), 0);

      return {
        checkoutUrl: offer.checkout_url ?? null,
        discoveryStatus: offer.checkout_discovery_status ?? 'NOT_PROCESSED',
        mapped: isMapped,
        frontPrice: offer.price ?? null,
        orderBumpsCount: bumps.length,
        totalBumpsValue: isMapped ? totalBumpsValue : null,
        orderBumps: isMapped
          ? bumps.map((b) => ({
              name: b.name,
              price: b.price,
              description: b.description ?? null,
            }))
          : 'unknown',
        lastMappedAt: offer.checkout_discovery_at ?? null,
      };
    },
  },
  {
    name: 'compare_offers',
    description:
      'Compare up to 3 offers factually side-by-side (scale, pricing, LP, checkout, copy). Maximum 3 offers allowed.',
    inputSchema: {
      type: 'object',
      properties: {
        offerIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 3,
          description: 'Array of 2 or 3 offer IDs to compare',
        },
      },
      required: ['offerIds'],
    },
    execute: async (rawArgs) => {
      const { offerIds } = CompareOffersSchema.parse(rawArgs);
      if (offerIds.length > 3) {
        throw new AiToolError('LIMIT_EXCEEDED', 'O comparador aceita no máximo 3 ofertas por requisição.');
      }

      const allOffers = await dbService.getOffers();
      const selected = allOffers.filter((o) => offerIds.includes(o.id));

      const comparison = selected.map((o) => {
        const scaleInfo = getOfferScaleTier(o.active_ads_count);
        const pricingInfo = calculateFrontendPricing(o.frontend_options, o.price);

        return {
          id: o.id,
          name: o.product_name,
          advertiser: o.advertiser ?? null,
          niche: o.niche ?? null,
          subniche: o.subniche ?? null,
          scale: {
            activeAds: o.active_ads_count ?? null,
            daysRunning: o.days_running ?? null,
            distinctCreatives: o.estimated_unique_creatives ?? o.captured_creatives_count ?? null,
            tier: scaleInfo.tier,
          },
          pricing: {
            frontPrice: o.price ?? null,
            min: pricingInfo.min,
            max: pricingInfo.max,
            average: pricingInfo.average,
            optionsCount: pricingInfo.options.length,
          },
          landingPage: {
            hasUrl: Boolean(o.landing_page_url),
            status: o.landing_page_url_status ?? null,
            headline: o.headline ?? null,
          },
          checkout: {
            hasUrl: Boolean(o.checkout_url),
            discoveryStatus: o.checkout_discovery_status ?? null,
            orderBumpsCount: o.order_bumps?.length || 0,
          },
        };
      });

      return {
        comparedOffersCount: selected.length,
        offers: comparison,
      };
    },
  },
  {
    name: 'get_dashboard_stats',
    description:
      'Retrieve aggregated metrics across the catalog (total offers, count by scale tier, by niche, avg ads, mapped %)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const offers = await dbService.getOffers();
      const tiersCount: Record<string, number> = {
        FULL_SCALE: 0,
        HIGH_SCALE: 0,
        SCALING: 0,
        NORMAL: 0,
      };
      const nicheCount: Record<string, number> = {};
      let totalAds = 0;
      let totalPrices = 0;
      let priceEntries = 0;
      let mappedLpCount = 0;
      let mappedCheckoutCount = 0;

      for (const o of offers) {
        const tier = getOfferScaleTier(o.active_ads_count).tier;
        tiersCount[tier] = (tiersCount[tier] || 0) + 1;

        if (o.niche) {
          nicheCount[o.niche] = (nicheCount[o.niche] || 0) + 1;
        }

        totalAds += o.active_ads_count || 0;
        if (typeof o.price === 'number' && o.price > 0) {
          totalPrices += o.price;
          priceEntries++;
        }

        if (o.landing_page_url) mappedLpCount++;
        if (o.checkout_url) mappedCheckoutCount++;
      }

      return {
        totalOffers: offers.length,
        tiersCount,
        nicheDistribution: nicheCount,
        averageActiveAds: offers.length ? Math.round(totalAds / offers.length) : 0,
        averagePrice: priceEntries ? Math.round((totalPrices / priceEntries) * 100) / 100 : null,
        mappedLandingPagesCount: mappedLpCount,
        mappedCheckoutsCount: mappedCheckoutCount,
        fullScaleCount: tiersCount['FULL_SCALE'] || 0,
      };
    },
  },
  {
    name: 'get_mapping_status',
    description:
      'Retrieve mapping automation status (LP mapping status, checkout discovery status, timestamps and errors).',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string' },
      },
    },
    execute: async (rawArgs) => {
      const { offerId } = GetMappingStatusSchema.parse(rawArgs);
      if (!offerId) {
        const offers = await dbService.getOffers();
        return {
          totalOffers: offers.length,
          mappedLpCount: offers.filter((o) => o.landing_page_url).length,
          mappedCheckoutCount: offers.filter((o) => o.checkout_url).length,
        };
      }

      const offer = await dbService.getOfferById(offerId);
      if (!offer) {
        throw new AiToolError('NOT_FOUND', `Oferta com ID ${offerId} não encontrada.`);
      }

      return {
        offerId: offer.id,
        landingPageUrl: offer.landing_page_url ?? null,
        landingPageStatus: offer.landing_page_url_status ?? 'NOT_MAPPED',
        lpMappedAt: offer.lp_mapped_at ?? null,
        lpLastError: offer.lp_last_error ?? null,
        checkoutUrl: offer.checkout_url ?? null,
        checkoutDiscoveryStatus: offer.checkout_discovery_status ?? 'NOT_PROCESSED',
        checkoutMappedAt: offer.checkout_discovery_at ?? null,
        checkoutLastError: offer.checkout_discovery_error ?? null,
      };
    },
  },
  {
    name: 'search_deep_dives',
    description:
      'Search deep-dive dossiers and strategic workshops saved in Offer Miner Intelligence Workshop.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', default: 20 },
        cursor: { type: 'string' },
      },
    },
    execute: async (rawArgs) => {
      const args = SearchDeepDivesSchema.parse(rawArgs);
      const deepDives = await dbService.getDeepDives();
      let filtered = [...deepDives];

      if (args.query && args.query.trim()) {
        const q = args.query.toLowerCase().trim();
        filtered = filtered.filter(
          (d) =>
            d.offer_id.toLowerCase().includes(q) ||
            (d.case_summary &&
              (d.case_summary.main_promise?.toLowerCase().includes(q) ||
                d.case_summary.what_sells?.toLowerCase().includes(q) ||
                d.case_summary.key_insights?.toLowerCase().includes(q)))
        );
      }

      if (args.status) filtered = filtered.filter((d) => d.status === args.status);
      if (args.priority) filtered = filtered.filter((d) => d.priority === args.priority);

      const paginated = filtered.slice(0, args.limit);
      return {
        total: filtered.length,
        returned: paginated.length,
        deepDives: paginated.map((d) => ({
          id: d.id,
          offerId: d.offer_id,
          status: d.status,
          priority: d.priority,
          investigationProgress: d.investigation_progress ?? 0,
          hypothesesCount: d.hypotheses?.length || 0,
          insightsCount: d.insights?.length || 0,
          updatedAt: d.updated_at,
        })),
      };
    },
  },
  {
    name: 'get_deep_dive',
    description:
      'Retrieve complete investigation dossier (hypotheses, insights, patterns, test ideas, notes, snapshots) for a deep dive.',
    inputSchema: {
      type: 'object',
      properties: {
        deepDiveId: { type: 'string' },
        offerId: { type: 'string' },
      },
    },
    execute: async (rawArgs) => {
      const { deepDiveId, offerId } = GetDeepDiveSchema.parse(rawArgs);
      const targetId = deepDiveId || offerId;

      if (!targetId) {
        throw new AiToolError('INVALID_ARGUMENT', 'Informe deepDiveId ou offerId.');
      }

      const deepDive = await dbService.getDeepDiveById(targetId);
      if (!deepDive) {
        throw new AiToolError('NOT_FOUND', `Dossiê de Inteligência não encontrado para ID ${targetId}.`);
      }

      return { deepDive };
    },
  },
  {
    name: 'search_insights',
    description:
      'Search registered strategy insights across offers by category (pricing, copy, offer structure, funnel, audience).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        niche: { type: 'string' },
        offerId: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
    },
    execute: async (rawArgs) => {
      const args = SearchInsightsSchema.parse(rawArgs);
      const deepDives = await dbService.getDeepDives();
      const allInsights: any[] = [];

      for (const d of deepDives) {
        if (d.insights) {
          for (const ins of d.insights) {
            allInsights.push({
              offerId: d.offer_id,
              deepDiveId: d.id,
              ...ins,
            });
          }
        }
      }

      let filtered = allInsights;

      if (args.query && args.query.trim()) {
        const q = args.query.toLowerCase().trim();
        filtered = filtered.filter(
          (i) =>
            (i.title && i.title.toLowerCase().includes(q)) ||
            (i.content && i.content.toLowerCase().includes(q)) ||
            (i.category && i.category.toLowerCase().includes(q))
        );
      }

      if (args.category) filtered = filtered.filter((i) => i.category === args.category);
      if (args.offerId) filtered = filtered.filter((i) => i.offerId === args.offerId);

      const paginated = filtered.slice(0, args.limit);
      return {
        total: filtered.length,
        returned: paginated.length,
        insights: paginated,
      };
    },
  },
  {
    name: 'search_patterns',
    description:
      'Search recurring marketing and commercial patterns registered in the Intelligence Workshop.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        niche: { type: 'string' },
      },
    },
    execute: async (rawArgs) => {
      const args = SearchPatternsSchema.parse(rawArgs);
      const deepDives = await dbService.getDeepDives();
      const allPatterns: any[] = [];

      for (const d of deepDives) {
        if (d.case_summary?.creative_pattern) {
          allPatterns.push({
            offerId: d.offer_id,
            deepDiveId: d.id,
            category: 'Creative Pattern',
            patternName: d.case_summary.creative_pattern,
          });
        }
        if (d.case_summary?.lp_structure) {
          allPatterns.push({
            offerId: d.offer_id,
            deepDiveId: d.id,
            category: 'LP Structure Pattern',
            patternName: d.case_summary.lp_structure,
          });
        }
      }

      let filtered = allPatterns;

      if (args.query && args.query.trim()) {
        const q = args.query.toLowerCase().trim();
        filtered = filtered.filter(
          (p) =>
            (p.patternName && p.patternName.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q))
        );
      }

      return {
        total: filtered.length,
        patterns: filtered,
      };
    },
  },
  {
    name: 'get_offer_history',
    description:
      'Retrieve historical snapshots and timeline changes for active ads, pricing and funnel status of an offer.',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string' },
      },
      required: ['offerId'],
    },
    execute: async (rawArgs) => {
      const { offerId } = GetOfferHistorySchema.parse(rawArgs);
      const offer = await dbService.getOfferById(offerId);

      if (!offer) {
        throw new AiToolError('NOT_FOUND', `Oferta com ID ${offerId} não encontrada.`);
      }

      const deepDive = await dbService.getDeepDiveById(offerId);

      return {
        offerId: offer.id,
        current: {
          activeAds: offer.active_ads_count ?? null,
          distinctCreatives: offer.estimated_unique_creatives ?? offer.captured_creatives_count ?? null,
          price: offer.price ?? null,
          landingPageStatus: offer.landing_page_url_status ?? null,
          checkoutStatus: offer.checkout_discovery_status ?? null,
          updatedAt: offer.updated_at ?? null,
        },
        snapshots: {
          initial: deepDive?.start_snapshot ?? null,
          latest: deepDive?.end_snapshot ?? null,
        },
      };
    },
  },
  {
    name: 'search_knowledge',
    description:
      'Search the user imported Knowledge Library (SOPs, playbooks, frameworks, case studies, transcripts, copywriting & scaling rules) using hybrid keyword/semantic search with provenance.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or question' },
        category: { type: 'string', description: 'Filter by Knowledge Category (e.g. TRÁFEGO & ESCALA, COPY & POSICIONAMENTO, CRIATIVOS, OFERTAS & PRODUTO)' },
        knowledge_type: { type: 'string', description: 'Filter by Knowledge Type (FRAMEWORK, PLAYBOOK, SOP, ESTUDO DE CASO, TRANSCRIÇÃO, etc.)' },
        trust_status: { type: 'string', description: 'Filter by trust status (VALIDADO, REFERÊNCIA, EXPERIMENTAL)' },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', default: 6 },
      },
    },
    execute: async (rawArgs: any) => {
      const args = SearchKnowledgeSchema.parse(rawArgs);
      const results = await searchKnowledgeLibrary(args.query || '', {
        category: args.category as any,
        knowledge_type: args.knowledge_type as any,
        trust_status: args.trust_status as any,
        tags: args.tags,
        limit: args.limit,
      });

      return {
        totalResults: results.length,
        results: results.map((r) => ({
          documentId: r.document.id,
          documentTitle: r.document.title,
          category: r.document.category,
          knowledgeType: r.document.knowledgeType,
          trustStatus: r.document.trustStatus,
          sourceType: r.document.sourceType,
          sourceUrl: r.document.sourceUrl || null,
          chunkIndex: r.chunk.chunkIndex,
          section: r.chunk.section || 'Geral',
          content: r.chunk.content,
          score: r.score,
          matchType: r.matchType,
          structuredFicha: r.document.structuredFicha || null,
        })),
      };
    },
  },
  {
    name: 'get_knowledge_document',
    description:
      'Retrieve full metadata, canonical markdown, and structured knowledge ficha of a document in the Knowledge Library.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Document UUID' },
      },
      required: ['documentId'],
    },
    execute: async (rawArgs: any) => {
      const { documentId } = GetKnowledgeDocumentSchema.parse(rawArgs);
      const doc = await knowledgeDb.getDocumentById(documentId);
      if (!doc) {
        throw new AiToolError('NOT_FOUND', `Documento com ID ${documentId} não encontrado na Biblioteca.`);
      }
      return doc;
    },
  },
  {
    name: 'list_knowledge_documents',
    description:
      'List available documents in the Knowledge Library for discovery and exploration.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        knowledge_type: { type: 'string' },
        trust_status: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
    },
    execute: async (rawArgs: any) => {
      const args = ListKnowledgeDocumentsSchema.parse(rawArgs);
      let docs = await knowledgeDb.getDocuments();
      if (args.category) docs = docs.filter((d) => d.category === args.category);
      if (args.knowledge_type) docs = docs.filter((d) => d.knowledgeType === args.knowledge_type);
      if (args.trust_status) docs = docs.filter((d) => d.trustStatus === args.trust_status);
      docs = docs.slice(0, args.limit || 20);

      return {
        totalFound: docs.length,
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          knowledgeType: d.knowledgeType,
          trustStatus: d.trustStatus,
          sourceType: d.sourceType,
          chunkCount: d.chunkCount,
          createdAt: d.createdAt,
          summary: d.structuredFicha?.summary || d.description || null,
        })),
      };
    },
  },
  {
    name: 'select_offer_creatives',
    description:
      'Select targeted creative assets for an offer using specific strategies (LONGEST_RUNNING, MOST_REUSED, LATEST, SPECIFIC_IDS). Never alters active_ads_count.',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string', description: 'The UUID or name of the offer' },
        count: { type: 'number', default: 2, description: 'Number of creatives to select' },
        selectionStrategy: {
          type: 'string',
          enum: ['LONGEST_RUNNING', 'EARLIEST_SEEN', 'MOST_REUSED', 'LATEST', 'SPECIFIC_IDS', 'DIVERSE_SAMPLE'],
          default: 'LONGEST_RUNNING',
        },
        mediaType: { type: 'string', enum: ['video', 'image', 'all'], default: 'all' },
        activeOnly: { type: 'boolean', default: true },
      },
      required: ['offerId'],
    },
    execute: async (rawArgs: any) => {
      const { CreativeTools } = await import('./creative-tools');
      return CreativeTools.selectOfferCreatives(rawArgs);
    },
  },
  {
    name: 'get_creative_media',
    description:
      'Retrieve media reference, storage reference, dimensions, duration, and audio presence for a creative asset.',
    inputSchema: {
      type: 'object',
      properties: {
        creativeId: { type: 'string', description: 'The UUID of the creative' },
      },
      required: ['creativeId'],
    },
    execute: async (rawArgs: any) => {
      const { CreativeTools } = await import('./creative-tools');
      return CreativeTools.getCreativeMedia(rawArgs.creativeId);
    },
  },
  {
    name: 'ensure_creative_media',
    description:
      'Action tool: ensures media file for a specific creative asset is stored and ready in Storage.',
    inputSchema: {
      type: 'object',
      properties: {
        creativeId: { type: 'string', description: 'The UUID of the creative' },
      },
      required: ['creativeId'],
    },
    execute: async (rawArgs: any) => {
      const { CreativeTools } = await import('./creative-tools');
      return CreativeTools.getCreativeMedia(rawArgs.creativeId);
    },
  },
  {
    name: 'analyze_creative',
    description:
      'Perform multimodal structural disassembly of a creative asset. Returns timestamped transcript [00:00-00:03], visual scene timeline, verbatim hook, narrative structure, and copy breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        creativeId: { type: 'string', description: 'The UUID of the creative' },
        analysisDepth: { type: 'string', enum: ['QUICK', 'STANDARD', 'DEEP'], default: 'STANDARD' },
        questions: { type: 'array', items: { type: 'string' } },
      },
      required: ['creativeId'],
    },
    execute: async (rawArgs: any) => {
      const { CreativeTools } = await import('./creative-tools');
      return CreativeTools.analyzeCreative(rawArgs);
    },
  },
  {
    name: 'compare_creative_structures',
    description:
      'Compare 2 or more creative structures side-by-side to extract shared patterns, hook differences, narrative differences, and transferable principles.',
    inputSchema: {
      type: 'object',
      properties: {
        creativeIds: { type: 'array', items: { type: 'string' }, description: 'Array of creative IDs to compare' },
      },
      required: ['creativeIds'],
    },
    execute: async (rawArgs: any) => {
      const { CreativeTools } = await import('./creative-tools');
      return CreativeTools.compareCreativeStructures(rawArgs.creativeIds);
    },
  },
  {
    name: 'check_offer_duplicate',
    description:
      'Check a single candidate offer for duplicates against the Offer Miner database using canonical URLs, Meta ad IDs, and normalized names. Returns factual duplicate status (NEW, DUPLICATE, POSSIBLE_DUPLICATE) and confidence basis without subjective scores.',
    inputSchema: {
      type: 'object',
      properties: {
        offer_name: { type: ['string', 'null'], description: 'Candidate offer name or product title' },
        advertiser: { type: ['string', 'null'], description: 'Advertiser name or Meta page name' },
        landing_page_url: { type: ['string', 'null'], description: 'Landing page destination URL' },
        checkout_url: { type: ['string', 'null'], description: 'Checkout gateway URL' },
        meta_ads_url: { type: ['string', 'null'], description: 'Meta Ads Library URL' },
        meta_ad_id: { type: ['string', 'null'], description: 'Meta Ad ID (numeric string)' },
        meta_page_id: { type: ['string', 'null'], description: 'Meta Page ID (numeric string)' },
      },
    },
    execute: async (rawArgs: any) => {
      const args = CheckOfferDuplicateSchema.parse(rawArgs);
      const { OfferDuplicateService } = await import('@/lib/offer/offer-duplicate-service');
      return await OfferDuplicateService.checkOne(args);
    },
  },
  {
    name: 'check_offers_duplicates',
    description:
      'Check a batch of up to 50 candidate offers for duplicates against the Offer Miner database in a single call. Efficiently groups candidates, performs canonical URL & Meta Ad ID matching, intra-batch deduplication, and returns status (NEW, DUPLICATE, POSSIBLE_DUPLICATE) with factual reasons.',
    inputSchema: {
      type: 'object',
      properties: {
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              candidate_id: { type: 'string', description: 'Unique identifier for this candidate in the batch' },
              offer_name: { type: ['string', 'null'], description: 'Candidate offer name or product title' },
              advertiser: { type: ['string', 'null'], description: 'Advertiser name or Meta page name' },
              landing_page_url: { type: ['string', 'null'], description: 'Landing page destination URL' },
              checkout_url: { type: ['string', 'null'], description: 'Checkout gateway URL' },
              meta_ads_url: { type: ['string', 'null'], description: 'Meta Ads Library URL' },
              meta_ad_id: { type: ['string', 'null'], description: 'Meta Ad ID (numeric string)' },
            },
            required: ['candidate_id'],
          },
          description: 'List of candidate offers to check (up to 50)',
        },
      },
      required: ['candidates'],
    },
    execute: async (rawArgs: any) => {
      const args = CheckOffersDuplicatesSchema.parse(rawArgs);
      const { OfferDuplicateService } = await import('@/lib/offer/offer-duplicate-service');
      return await OfferDuplicateService.checkMany(args);
    },
  },
];

export function getAiToolByName(name: string): AiToolContract | undefined {
  return AI_TOOLS_LIST.find((t) => t.name === name);
}

export async function executeAiTool(name: string, rawArgs: Record<string, any>): Promise<any> {
  const tool = getAiToolByName(name);
  if (!tool) {
    throw new AiToolError('NOT_FOUND', `Ferramenta de IA '${name}' não encontrada.`);
  }

  try {
    return await tool.execute(rawArgs);
  } catch (err: any) {
    if (err instanceof AiToolError) throw err;
    throw new AiToolError('INTERNAL_ERROR', err.message || 'Erro interno ao executar ferramenta de IA.');
  }
}
