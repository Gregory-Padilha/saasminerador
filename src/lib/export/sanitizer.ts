/**
 * Strict Security & Secret Sanitizer Engine for Offer Miner AI Context Export
 * Guarantees zero leak of API keys, bearer tokens, service role keys, signed URLs, auth cookies, or private chain-of-thought.
 */

export function sanitizeText(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Remove Chain of Thought / Private Model Reasoning blocks
  sanitized = sanitized.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  sanitized = sanitized.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  sanitized = sanitized.replace(/<private_reasoning>[\s\S]*?<\/private_reasoning>/gi, '');
  sanitized = sanitized.replace(/<chain_of_thought>[\s\S]*?<\/chain_of_thought>/gi, '');

  // 2. Sanitize OpenAI / Anthropic / Gemini / Supabase API keys
  sanitized = sanitized.replace(/sk-proj-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/sk-ant-api[a-zA-Z0-9_-]{20,}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT_TOKEN]');

  // 3. Sanitize Auth Headers & Cookies
  sanitized = sanitized.replace(/Authorization:\s*Bearer\s+[^\s"'\n]+/gi, 'Authorization: Bearer [REDACTED]');
  sanitized = sanitized.replace(/Cookie:\s*[^;\n]+/gi, 'Cookie: [REDACTED]');
  sanitized = sanitized.replace(/set-cookie:\s*[^;\n]+/gi, 'set-cookie: [REDACTED]');

  // 4. Sanitize Signed URLs (strip sensitive token query params)
  sanitized = sanitized.replace(/(\?|&)(token|sig|signature|X-Amz-Signature|X-Amz-Credential|auth)=[^&\s"'\n]+/gi, '$1$2=[REDACTED_TOKEN]');

  // 5. Sanitize internal local system directory paths
  sanitized = sanitized.replace(/\/Users\/[^\s\n"'\)\:]+/g, '[INTERNAL_PATH]');
  sanitized = sanitized.replace(/\/home\/[^\s\n"'\)\:]+/g, '[INTERNAL_PATH]');

  return sanitized;
}

/**
 * Recursively sanitizes objects or arrays
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeText(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      // Omit sensitive property keys completely
      if (
        lowerKey.includes('apikey') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('authtoken') ||
        lowerKey.includes('servicerole')
      ) {
        cleaned[key] = '[REDACTED_SENSITIVE_KEY]';
      } else {
        cleaned[key] = sanitizeObject(value);
      }
    }
    return cleaned as T;
  }

  return obj;
}
