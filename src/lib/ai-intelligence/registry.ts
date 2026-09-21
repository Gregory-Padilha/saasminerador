import { AI_TOOLS_LIST } from '@/lib/ai-tools/registry';
import { ProviderId, ProviderModelConfig, AISourceReference } from './types';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  displayName: string;
  envKeyName: string;
  defaultFastModel: string;
  defaultDeepModel: string;
}

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'ChatGPT / OpenAI',
    envKeyName: 'OPENAI_API_KEY',
    defaultFastModel: 'gpt-4o-mini',
    defaultDeepModel: 'gpt-4o',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    displayName: 'Google Gemini',
    envKeyName: 'GEMINI_API_KEY',
    defaultFastModel: 'gemini-2.5-flash',
    defaultDeepModel: 'gemini-1.5-pro',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    displayName: 'Anthropic Claude',
    envKeyName: 'ANTHROPIC_API_KEY',
    defaultFastModel: 'claude-haiku-4-5-20251001',
    defaultDeepModel: 'claude-sonnet-4-5-20250929',
  },
};

/**
 * Get Provider Default Models (Fast vs Deep)
 */
export function getProviderDefaultModels(providerId: ProviderId): ProviderModelConfig {
  const meta = PROVIDER_REGISTRY[providerId] || PROVIDER_REGISTRY.gemini;
  return {
    fastModel: meta.defaultFastModel,
    deepModel: meta.defaultDeepModel,
  };
}

/**
 * Convert canonical Offer Miner AI Tools to OpenAI Function Calling Schema format
 */
export function getOpenAiToolsDefinition() {
  return AI_TOOLS_LIST.map((tool) => {
    const schema = JSON.parse(JSON.stringify(tool.inputSchema || { type: 'object', properties: {} }));
    const sanitizeSchema = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      delete obj.default;
      if (obj.properties) Object.values(obj.properties).forEach(sanitizeSchema);
      if (obj.items) sanitizeSchema(obj.items);
    };
    sanitizeSchema(schema);

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: schema,
      },
    };
  });
}

/**
 * Convert canonical Offer Miner AI Tools to Gemini Function Declarations format
 */
export function getGeminiToolsDefinition() {
  const declarations = AI_TOOLS_LIST.map((tool) => {
    const schema = JSON.parse(JSON.stringify(tool.inputSchema || { type: 'object', properties: {} }));
    const sanitizeSchema = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      delete obj.default;
      if (obj.properties) Object.values(obj.properties).forEach(sanitizeSchema);
      if (obj.items) sanitizeSchema(obj.items);
    };
    sanitizeSchema(schema);

    return {
      name: tool.name,
      description: tool.description,
      parameters: schema,
    };
  });

  return [{ functionDeclarations: declarations }];
}

/**
 * Convert canonical Offer Miner AI Tools to Anthropic Tool Schema format
 */
export function getAnthropicToolsDefinition() {
  return AI_TOOLS_LIST.map((tool) => {
    const schema = JSON.parse(JSON.stringify(tool.inputSchema || { type: 'object', properties: {} }));
    const sanitizeSchema = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      delete obj.default;
      if (obj.properties) Object.values(obj.properties).forEach(sanitizeSchema);
      if (obj.items) sanitizeSchema(obj.items);
    };
    sanitizeSchema(schema);

    return {
      name: tool.name,
      description: tool.description,
      input_schema: schema,
    };
  });
}

/**
 * Helper to extract sources from executed tool results
 */
export function extractSourcesFromToolResult(toolName: string, result: any): AISourceReference[] {
  const sources: AISourceReference[] = [];
  if (!result || typeof result !== 'object') return sources;

  try {
    if (result.offers && Array.isArray(result.offers)) {
      result.offers.forEach((o: any) => {
        if (o.id && o.name) {
          sources.push({
            type: 'offer',
            id: o.id,
            title: o.name,
            subtitle: o.advertiser || o.niche || undefined,
            meta: { activeAds: o.activeAds, price: o.price },
          });
        }
      });
    }

    if (result.offer) {
      const o = result.offer;
      if (o.id && o.name) {
        sources.push({
          type: 'offer',
          id: o.id,
          title: o.name,
          subtitle: o.niche || o.advertiser || undefined,
        });
      }
      if (o.landingPage?.url) {
        sources.push({
          type: 'landing_page',
          id: o.id,
          title: `LP: ${o.name}`,
          subtitle: o.landingPage.url,
        });
      }
      if (o.checkout?.url) {
        sources.push({
          type: 'checkout',
          id: o.id,
          title: `Checkout: ${o.name}`,
          subtitle: o.checkout.url,
        });
      }
    }

    if (toolName === 'get_offer_context' && result.id && result.name) {
      sources.push({
        type: 'offer',
        id: result.id,
        title: result.name,
        subtitle: result.niche || undefined,
      });
      if (result.landingPage?.url) {
        sources.push({
          type: 'landing_page',
          id: result.id,
          title: `LP: ${result.name}`,
          subtitle: result.landingPage.url,
        });
      }
      if (result.checkout?.url) {
        sources.push({
          type: 'checkout',
          id: result.id,
          title: `Checkout: ${result.name}`,
          subtitle: result.checkout.url,
        });
      }
    }

    if (toolName === 'list_creatives' && Array.isArray(result.creatives)) {
      result.creatives.forEach((c: any) => {
        if (c.adId) {
          sources.push({
            type: 'creative',
            id: c.adId,
            title: `Criativo: ${c.headline || c.metaAdId || c.adId}`,
            subtitle: c.type,
          });
        }
      });
    }
  } catch {
    // Non-critical source extraction
  }

  return sources;
}
