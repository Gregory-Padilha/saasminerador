import { NextResponse } from 'next/server';
import { getMcpLocalUrl, getMcpPublicUrl } from '@/lib/mcp/config';

export const runtime = 'nodejs';

export async function GET() {
  const publicUrl = getMcpPublicUrl();
  const baseUrl = publicUrl ? publicUrl.replace(/\/api\/mcp\/?$/, '') : 'http://localhost:3000';

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Offer Miner AI Gateway REST API (Read-Only)',
      version: '1.0.0',
      description:
        'Universal REST API interface for AI agents, custom functions, and non-MCP tools to query Offer Miner catalog intelligence.',
    },
    servers: [
      {
        url: `${baseUrl}/api/ai`,
        description: publicUrl ? 'Remote HTTPS AI Gateway Server' : 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT or Token',
          description: 'Pass OFFER_MINER_MCP_TOKEN in the Authorization header: Bearer <token>',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Check AI Gateway Health',
          operationId: 'getHealth',
          responses: { '200': { description: 'Gateway active' } },
        },
      },
      '/offers': {
        get: {
          summary: 'Search Offers Catalog (search_offers)',
          operationId: 'searchOffers',
          parameters: [
            { name: 'query', in: 'query', schema: { type: 'string' } },
            { name: 'niche', in: 'query', schema: { type: 'string' } },
            { name: 'minAds', in: 'query', schema: { type: 'integer' } },
            { name: 'maxAds', in: 'query', schema: { type: 'integer' } },
            { name: 'minPrice', in: 'query', schema: { type: 'number' } },
            { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { '200': { description: 'Filtered offers summary list' } },
        },
      },
      '/offers/{id}': {
        get: {
          summary: 'Get Offer Detail by ID (get_offer)',
          operationId: 'getOffer',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Normalized offer detail' } },
        },
      },
      '/offers/{id}/context': {
        get: {
          summary: 'Get Offer Intelligence Context (get_offer_context)',
          operationId: 'getOfferContext',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'depth', in: 'query', schema: { type: 'string', enum: ['summary', 'standard', 'deep'] } },
          ],
          responses: { '200': { description: 'Offer intelligence context' } },
        },
      },
      '/offers/{id}/creatives': {
        get: {
          summary: 'List Creatives for Offer (list_creatives)',
          operationId: 'listCreatives',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['video', 'image', 'all'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: { '200': { description: 'Creatives list' } },
        },
      },
      '/landing-page': {
        get: {
          summary: 'Get Landing Page Analysis (get_landing_page_analysis)',
          operationId: 'getLandingPageAnalysis',
          parameters: [{ name: 'offerId', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Landing Page intelligence' } },
        },
      },
      '/checkout': {
        get: {
          summary: 'Get Checkout Analysis (get_checkout_analysis)',
          operationId: 'getCheckoutAnalysis',
          parameters: [{ name: 'offerId', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Checkout intelligence' } },
        },
      },
      '/compare': {
        post: {
          summary: 'Compare up to 3 Offers (compare_offers)',
          operationId: 'compareOffers',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    offerIds: { type: 'array', items: { type: 'string' }, maxItems: 3 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Side-by-side offer comparison' } },
        },
      },
      '/stats': {
        get: {
          summary: 'Get Catalog Aggregated Stats (get_dashboard_stats)',
          operationId: 'getStats',
          responses: { '200': { description: 'Aggregated dashboard stats' } },
        },
      },
      '/deep-dives': {
        get: {
          summary: 'Search Deep-Dive Workshops (search_deep_dives)',
          operationId: 'searchDeepDives',
          parameters: [
            { name: 'query', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Deep-dive list' } },
        },
      },
      '/insights': {
        get: {
          summary: 'Search Strategy Insights (search_insights)',
          operationId: 'searchInsights',
          parameters: [
            { name: 'query', in: 'query', schema: { type: 'string' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Strategy insights list' } },
        },
      },
      '/patterns': {
        get: {
          summary: 'Search Marketing Patterns (search_patterns)',
          operationId: 'searchPatterns',
          parameters: [{ name: 'query', in: 'query', schema: { type: 'string' } }],
          responses: { '200': { description: 'Marketing patterns list' } },
        },
      },
      '/history': {
        get: {
          summary: 'Get Offer Snapshot History (get_offer_history)',
          operationId: 'getHistory',
          parameters: [{ name: 'offerId', in: 'query', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Offer snapshot timeline' } },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}
