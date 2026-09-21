import { MiningPromptConfig, validateMiningConfig } from './mining-prompt-types';

export interface CompactExclusionEntry {
  offerId: string;
  title: string;
  advertiser?: string;
  domain?: string;
  lpDomain?: string;
  metaPageId?: string;
}

export function buildCompactExclusionManifest(offers: any[] = [], maxItems = 150): CompactExclusionEntry[] {
  if (!Array.isArray(offers) || offers.length === 0) return [];

  return offers.slice(0, maxItems).map((o) => {
    let domain = '';
    let lpDomain = '';
    try {
      if (o.landing_page_url) {
        domain = new URL(o.landing_page_url).hostname.replace(/^www\./, '');
        lpDomain = domain;
      }
    } catch {}

    return {
      offerId: o.id,
      title: o.product_name || o.name || 'Sem título',
      advertiser: o.advertiser || undefined,
      domain: domain || undefined,
      lpDomain: lpDomain || undefined,
      metaPageId: o.meta_page_id || undefined,
    };
  });
}

export function compileMiningPrompt(
  config: MiningPromptConfig,
  dbOffers: any[] = []
): {
  prompt: string;
  manifest: CompactExclusionEntry[];
  hardFiltersCount: number;
  outputFieldsCount: number;
  approxTokens: number;
  validationErrors: string[];
} {
  const val = validateMiningConfig(config);
  const validationErrors = val.errors;

  const manifest = config.excludeMinedOffers ? buildCompactExclusionManifest(dbOffers) : [];

  let hardFiltersCount = 0;
  if (config.digitalOnly) hardFiltersCount++;
  if (config.facelessPreference !== 'Any') hardFiltersCount++;
  if (config.minFrontPrice !== undefined || config.maxFrontPrice !== undefined) hardFiltersCount++;
  if (config.minActiveAds !== undefined || config.maxActiveAds !== undefined) hardFiltersCount++;
  if (config.minDaysActive !== undefined || config.maxDaysActive !== undefined) hardFiltersCount++;
  if (config.minUniqueCreatives !== undefined || config.maxUniqueCreatives !== undefined) hardFiltersCount++;
  if (config.expertPresence === 'Disallow') hardFiltersCount++;
  if (config.requireLandingPage) hardFiltersCount++;
  if (config.requireMetaAdsLink) hardFiltersCount++;
  if (config.excludeMinedOffers) hardFiltersCount++;

  const filename =
    config.filename && config.filename.trim()
      ? config.filename.trim()
      : `mining_${(config.niche || 'geral').toLowerCase().replace(/\s+/g, '_')}_${config.targetOffers}_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;

  // Build Exclusion Manifest String
  let manifestText = 'Nenhum manifesto de exclusão prévio configurado.';
  if (manifest.length > 0) {
    manifestText = manifest
      .map(
        (m) =>
          `- [ID: ${m.offerId}] "${m.title}" | Adv: ${m.advertiser || 'N/I'} | Domain: ${m.domain || 'N/I'}`
      )
      .join('\n');
  }

  // Construct Mega Prompt Sections
  const prompt = `# OFFER MINER — MINING WORKER MISSION

**Mission ID:** mis_worker_${Date.now()}
**Generated:** ${new Date().toISOString()}
**Objective:** Mine exactly **${config.targetOffers} valid unique digital offers** matching structured criteria.
**Target Market / Country:** ${config.country} (${config.language})
**Platform:** ${config.platform}

---

## 1. YOUR ROLE

You are an **OPERATIONAL MINING RESEARCH AGENT** for the Offer Miner platform.
- Your sole job is to execute structured web/ad library research, validate candidate offers against strict hard rules, and output structured data rows into an **XLSX spreadsheet**.
- **DO NOT** act as a marketing consultant or strategy analyst.
- **DO NOT** produce narrative essays, copy breakdowns, or creative critique during execution.
- **DO NOT** stop until you reach exactly **${config.targetOffers} VALID UNIQUE OFFERS** or reach exhausted search candidates.

---

## 2. MISSION & HARD FILTERS

Must find: **${config.targetOffers} valid offers** meeting ALL parameters below:

- **Niche / Market:** ${config.nicheMode === 'SPECIFIC_NICHE' ? `Specific Niche: "${config.niche}"${config.subniche ? ` (Subniche: "${config.subniche}")` : ''}` : 'ANY NICHE (Search whole catalog for scalable opportunities)'}
- **Keywords to Include:** ${config.keywords.length > 0 ? config.keywords.join(', ') : 'None specified'}
- **Keywords to Exclude:** ${config.excludeKeywords.length > 0 ? config.excludeKeywords.join(', ') : 'None specified'}
- **Adjacent Niches:** ${config.allowAdjacentNiches ? 'Allowed if product logic is relevant' : 'Strictly forbidden'}
- **Product Type:** ${config.digitalOnly ? 'DIGITAL PRODUCTS ONLY (Ebooks, Templates, Worksheets, Cards, Tools, Guides)' : 'Digital or Physical'}
- **Faceless Requirement:** ${config.facelessPreference === 'Required' ? 'STRICTLY FACELESS (No personal expert face)' : config.facelessPreference === 'Preferred' ? 'FACELESS PREFERRED' : 'Any (Face allowed)'}
- **Allowed Formats:** ${config.allowedFormats.join(', ')}
- **Excluded Formats:** ${config.excludedFormats.join(', ')}
- **Expert Presence:** ${config.expertPresence === 'Disallow' ? 'DISALLOWED (No personal brand expert or influencer)' : 'Allowed'}
- **Front Price Range:** ${config.minFrontPrice !== undefined || config.maxFrontPrice !== undefined ? `R$ ${config.minFrontPrice ?? 0} to R$ ${config.maxFrontPrice ?? '∞'}` : 'Any price'}
- **Active Ads Range:** ${config.minActiveAds !== undefined || config.maxActiveAds !== undefined ? `${config.minActiveAds ?? 1} to ${config.maxActiveAds ?? '∞'} active ads` : 'Any number of active ads'}
- **Days Active (Longevity):** ${config.minDaysActive !== undefined || config.maxDaysActive !== undefined ? `${config.minDaysActive ?? 1} to ${config.maxDaysActive ?? '∞'} days active` : 'Any longevity'}
- **Unique Creatives Range:** ${config.minUniqueCreatives !== undefined || config.maxUniqueCreatives !== undefined ? `${config.minUniqueCreatives ?? 1} to ${config.maxUniqueCreatives ?? '∞'} unique creatives` : 'Any number'}
- **Required Funnel Assets:** ${config.requireLandingPage ? 'Landing Page Required' : ''} ${config.requireCheckout ? '| Checkout Required' : ''} ${config.requirePriceVisible ? '| Price Visible Required' : ''} ${config.requireMetaAdsLink ? '| Exact Meta Ads URL Required' : ''}

---

## 3. DEFINITION OF A VALID OFFER (OFFER UNIT & CLUSTER RULES)

⚠️ **CRITICAL ARCHITECTURAL REQUIREMENT — PREVENT DUPLICATION / OVER-COUNTING:**

An **OFFER UNIT** is NOT an advertiser, nor a keyword search result. An offer can ONLY be accepted when you establish a single coherent commercial unit:
1. **Advertiser / Meta Page:** The specific advertiser running the ads.
2. **Specific Product / Offer Title:** A distinct product promise (e.g. "200 Receitas para Diabéticos").
3. **Offer Ad Cluster:** The set of active ads belonging EXCLUSIVELY to that specific offer.
4. **Destination / Landing Page:** The real destination URL linked from that offer's ads.
5. **Commercial Identity:** Coherent offer price and promise.

**STRICT ADVERTISER vs. OFFER RULE:**
- An advertiser page (e.g., "Editora Digital X") may sell **3 separate products** (Product A, Product B, Product C).
- You MUST treat Product A, Product B, Product C as **3 DISTINCT OFFERS**.
- **NEVER** sum the active ads of Product A + Product B + Product C together!
- The \`active_ads_count\` field MUST represent ONLY the active ads running for that EXACT product.

---

## 4. STEP-BY-STEP EXECUTION PROCEDURE

Follow these 15 execution steps in exact sequence:

- **PASSO 1 — PREPARE SEARCH:** Interpret criteria, normalize target keywords, load exclusion manifest.
- **PASSO 2 — SEARCH META ADS LIBRARY:** Search Meta Ads Library using varied keyword combinations, niche terms, and advertiser queries.
- **PASSO 3 — CHEAP PRE-FILTER:** Immediately discard physical items, wrong country/language, wrong product format, or obvious duplicates BEFORE deep link inspection.
- **PASSO 4 — IDENTIFY EXACT OFFER:** Isolate the specific product promise and separate it from other products sold by the same advertiser.
- **PASSO 5 — VERIFY ACTIVE ADS:** Count active ads belonging strictly to this single offer unit. Verify if count is within [${config.minActiveAds ?? 1} .. ${config.maxActiveAds ?? '∞'}].
- **PASSO 6 — VERIFY LONGEVITY:** Determine first seen date / days active. Verify within [${config.minDaysActive ?? 1} .. ${config.maxDaysActive ?? '∞'}].
- **PASSO 7 — VERIFY CREATIVES:** Count distinct ad creative variations without performing creative-by-creative visual audits.
- **PASSO 8 — RESOLVE DESTINATION URL:** Open the representative ad CTA link to capture the REAL destination Landing Page URL (follow redirects to final URL).
- **PASSO 9 — VERIFY PRODUCT MATCH:** Confirm the Landing Page matches the exact offer title observed in Meta Ads.
- **PASSO 10 — CHECK FRONT PRICE:** Locate front price on Landing Page / Checkout. Confirm within [R$ ${config.minFrontPrice ?? 0} .. R$ ${config.maxFrontPrice ?? '∞'}].
- **PASSO 11 — CHECK DUPLICATES:** Compare against current run accepted candidates AND the Compact Exclusion Manifest.
- **PASSO 12 — ACCEPT OR REJECT:** Accept ONLY if ALL hard filters pass. If any filter fails, **REJECT IMMEDIATELY** without writing a failure report.
- **PASSO 13 — SAVE ROW:** Append validated offer row to the export dataset.
- **PASSO 14 — CONTINUE:** Repeat search for next candidate offer.
- **PASSO 15 — STOP IMMEDIATELY:** As soon as exactly **${config.targetOffers} VALID UNIQUE OFFERS** are appended to the file: **STOP EXECUTION IMMEDIATELY**. Do NOT continue searching "to be safe".

---

## 5. TOKEN & TIME ECONOMY POLICY (${config.tokenEconomyMode})

Mode: **${config.tokenEconomyMode}**
- **SEARCH WIDE, VERIFY CHEAP, DEEP CHECK ONLY FINALISTS.**
- **FAST REJECTION POLICY:** When a candidate fails any filter (e.g., active ads < ${config.minActiveAds ?? 1} or physical product), discard it instantly and move to the next.
- **NO NARRATIVE REPORTS:** Do NOT write paragraphs explaining why an offer was rejected.
- **MAX 1 SHORT SENTENCE NOTES:** In the \`notes\` output column, write at most 1 short sentence (e.g. "Low-ticket ebook faceless validado com 18 ads ativos").

---

## 6. HARD RESTRICTIONS (AUTOMATIC EXCLUSIONS)

${config.digitalOnly ? '- ❌ DO NOT INCLUDE PHYSICAL PRODUCTS.' : ''}
${config.excludedFormats.map((f) => `- ❌ DO NOT INCLUDE FORMAT: ${f}.`).join('\n')}
${config.expertPresence === 'Disallow' ? '- ❌ DO NOT INCLUDE EXPERT / PERSONAL BRAND COURSES.' : ''}
${config.requireLandingPage ? '- ❌ DO NOT INCLUDE OFFERS WITHOUT A VALID LANDING PAGE.' : ''}
${config.requireMetaAdsLink ? '- ❌ DO NOT INCLUDE OFFERS WITHOUT AN EXACT META ADS URL.' : ''}
- ❌ DO NOT INCLUDE DUPLICATES (Same Title + Same Advertiser or Same LP Domain).

---

## 7. CRITICAL URL RULES

1. **Meta Ads URL:** MUST point to the exact advertiser page / ad cluster context (e.g. \`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=XXXX\`).
   - ⚠️ **PROHIBITED:** NEVER use a generic keyword search URL (e.g., \`https://www.facebook.com/ads/library/?q=diabéticos\`) as the \`meta_ads_url\`!
2. **Landing Page URL:** MUST be captured directly from the ad CTA button destination.
   - ⚠️ **PROHIBITED:** NEVER guess a Landing Page domain based on company name or advertiser name!
3. **Checkout URL:** Capture only when observed or accessible. NEVER invent checkout URLs.

---

## 8. DEDUPLICATION & COMPACT EXCLUSION MANIFEST

Do NOT re-mine offers that already exist in the Offer Miner database.

**Exclusion Manifest (${manifest.length} items):**
\`\`\`
${manifestText}
\`\`\`

---

## 9. OUTPUT CONTRACT & SCHEMA

Output File Format: **${config.outputFormat}**
Filename: \`${filename}\`

${
  config.outputFormat === 'JSON'
    ? `⚠️ **CRITICAL ARCHITECTURAL CONTRACT: USE EXACTLY SCHEMA \`offer-miner-worker-1.0\`**

When outputting JSON, you MUST produce a single valid JSON document following this exact structure:

\`\`\`json
{
  "schema_version": "offer-miner-worker-1.0",
  "metadata": {
    "query_date": "${new Date().toISOString().slice(0, 10)}",
    "country": "${config.country}",
    "platform": "${config.platform}",
    "target_offers": ${config.targetOffers},
    "criteria": [
      ${config.digitalOnly ? '"Infoproduto digital",' : ''}
      ${config.facelessPreference === 'Required' ? '"Marca/página sem especialista como âncora",' : ''}
      ${config.requireLandingPage ? '"Landing page com preço e checkout direto",' : ''}
      ${config.minActiveAds !== undefined ? `"Página com pelo menos ${config.minActiveAds} anúncios ativos",` : ''}
      ${config.minDaysActive !== undefined ? `"Anúncio individual rodando há pelo menos ${config.minDaysActive} dias"` : ''}
    ]
  },
  "offers": [
    {
      "offer_name": "Nome da Oferta Comercial",
      "advertiser": "Nome da Página ou Anunciante",
      "niche": "Nicho Comercial (NÃO colocar 'Todos os anúncios')",
      "subniche": "Subnicho Específico",
      "active_ads_count": 35,
      "unique_creatives_count": 8,
      "days_active": 21,
      "front_price": 29.90,
      "currency": "BRL",
      "meta_ads_url": "https://www.facebook.com/ads/library/?...",
      "landing_page_url": "https://...",
      "checkout_url": "https://...",
      "product_format": "Ebook",
      "faceless": true,
      "notes": "Breve nota operacional"
    }
  ]
}
\`\`\`

**REQUIRED RULES FOR JSON OUTPUT:**
1. \`schema_version\` MUST be exactly \`"offer-miner-worker-1.0"\`.
2. Execution metadata belongs in the \`metadata\` object.
3. Offers MUST be in the \`offers\` array.
4. Separate \`active_ads_count\` (volume of ads) from \`unique_creatives_count\` (distinct creative copies).
5. Never put Meta Ads search category (like 'Todos os anúncios') into \`niche\`.
`
    : `**Required Columns (Exact Order):**
${config.outputFields.map((field, idx) => `${idx + 1}. \`${field}\``).join('\n')}`
}

---

## 10. FINAL VALIDATION & DELIVERY

Before completing the task:
1. Count rows in the output dataset (must equal **${config.targetOffers}**).
2. Verify all URLs (\`meta_ads_url\` and \`landing_page_url\`) are present and non-generic.
3. Verify no duplicate offer names or LP domains exist.

**FINAL DELIVERY:**
Save the file as \`${filename}\` and return ONLY the file along with a 1-line completion summary.
`;

  const approxTokens = Math.ceil(prompt.length / 4);

  return {
    prompt,
    manifest,
    hardFiltersCount,
    outputFieldsCount: config.outputFields.length,
    approxTokens,
    validationErrors,
  };
}
