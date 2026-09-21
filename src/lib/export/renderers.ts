import { AIContextPackage } from './types';
import { sanitizeText, sanitizeObject } from './sanitizer';

/**
 * Deterministic Markdown Exporter Renderer
 * Converts AIContextPackage into clean, AI-ready Markdown. Zero LLM calls!
 */
export function renderMarkdownPackage(rawPkg: AIContextPackage): string {
  const pkg = sanitizeObject(rawPkg);
  const { metadata, aiInstructions, conversation, offerFacts, landingPageFacts, checkoutFacts, creativesFacts, sources, toolOutputs, insightsAndNotes, availability } = pkg;

  const lines: string[] = [];

  // 1. HEADER & AI META
  lines.push(`# OFFER MINER — ${metadata.title.toUpperCase()}`);
  lines.push('');
  lines.push(`Generated: ${metadata.generatedAt}`);
  if (metadata.subjectName) lines.push(`Subject / Thread: ${metadata.subjectName}`);
  if (metadata.subjectId) lines.push(`Subject ID: ${metadata.subjectId}`);
  if (metadata.mode) lines.push(`Mode: ${metadata.mode === 'deep' ? 'Profundo' : 'Rápido'}`);
  if (metadata.providersUsed && metadata.providersUsed.length > 0) {
    lines.push(`Providers utilizados: ${metadata.providersUsed.join(' / ')}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 2. PURPOSE
  lines.push('## PURPOSE');
  lines.push('');
  lines.push('Este arquivo foi exportado do Offer Miner para fornecer contexto estruturado a outro modelo de IA.');
  lines.push('Trate os dados abaixo como informações factuais e analíticas fornecidas pelo usuário/sistema.');
  lines.push('Não assuma que inferências são fatos observados.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // 3. INSTRUCTIONS FOR THE RECEIVING AI
  lines.push('## INSTRUCTIONS FOR THE RECEIVING AI');
  lines.push('');
  lines.push(aiInstructions.trim());
  lines.push('');
  lines.push('---');
  lines.push('');

  // 4. IDENTIDADE / CURRENT CONTEXT
  if (offerFacts) {
    lines.push('## 1. IDENTIDADE');
    lines.push('Source: METADATA');
    lines.push('');
    lines.push(`- Offer ID: ${offerFacts.id || 'N/A'}`);
    lines.push(`- Nome da Oferta: ${offerFacts.product_name || 'N/A'}`);
    lines.push(`- Anunciante: ${offerFacts.advertiser || 'N/A'}`);
    if (offerFacts.source_file_name) lines.push(`- Origem / XLS: ${offerFacts.source_file_name}`);
    if (offerFacts.meta_page_id) lines.push(`- Meta Page ID: ${offerFacts.meta_page_id}`);
    lines.push(`- Nicho: ${offerFacts.niche || 'Não especificado'}`);
    if (offerFacts.subniche) lines.push(`- Subnicho: ${offerFacts.subniche}`);
    lines.push(`- Tipo de Produto: ${offerFacts.product_type || 'Digital'}`);
    lines.push(`- Formato Faceless: ${offerFacts.faceless ? 'Sim' : 'Não / Não especificado'}`);
    lines.push('');

    // 5. SCALE / META ADS (STRICT DISTINCT COUNTS)
    lines.push('## 2. SCALE / META ADS');
    lines.push('Source: META_ADS_LIBRARY');
    lines.push('');
    lines.push(`- ACTIVE ADS COUNT: ${offerFacts.active_ads_count ?? 'N/A'} (Volume total de anúncios ativos observados simultaneamente na Meta Ads)`);
    lines.push(`- UNIQUE CREATIVES COUNT: ${offerFacts.unique_creatives_count ?? offerFacts.captured_creatives_count ?? 'N/A'} (Peças criativas únicas deduplicadas salvas)`);
    lines.push(`- COLLECTED ADS COUNT: ${offerFacts.collected_ads_count ?? 'N/A'}`);
    lines.push(`- FIRST SEEN: ${offerFacts.first_seen_at || offerFacts.oldest_ad_date || 'N/A'}`);
    lines.push(`- LAST SEEN: ${offerFacts.last_seen_at || offerFacts.latest_ad_date || 'N/A'}`);
    lines.push(`- DAYS RUNNING: ${offerFacts.max_observed_longevity_days ? `${offerFacts.max_observed_longevity_days} dias` : 'N/A'}`);
    lines.push(`- SCALE TIER: ${offerFacts.scale_tier || 'N/A'}`);
    lines.push('');

    // 6. HISTÓRICO
    if (offerFacts.snapshots && Array.isArray(offerFacts.snapshots) && offerFacts.snapshots.length > 0) {
      lines.push('## 3. HISTÓRICO DE ESCALA');
      lines.push('Source: HISTORICAL_SNAPSHOTS');
      lines.push('');
      offerFacts.snapshots.forEach((snap: any) => {
        lines.push(`- ${snap.date || snap.recorded_at}: ${snap.active_ads_count} anúncios ativos (${snap.change_label || 'snapshot'})`);
      });
      lines.push('');
    }

    // 7. PRODUTO / OFERTA
    lines.push('## 4. PRODUTO / ESTRUTURA COMERCIAL');
    lines.push('Source: DOSSIER');
    lines.push('');
    lines.push(`- Promessa Principal: ${offerFacts.promise || offerFacts.headline || 'N/A'}`);
    lines.push(`- Mecanismo Central: ${offerFacts.mechanism || 'N/A'}`);
    lines.push(`- Preço Front-End: ${offerFacts.price ? `R$ ${offerFacts.price}` : 'N/A'}`);
    lines.push(`- Formato do Entregável: ${offerFacts.deliverable_format || 'N/A'}`);
    if (offerFacts.bonuses && offerFacts.bonuses.length > 0) {
      lines.push(`- Bônus (${offerFacts.bonuses.length}): ${offerFacts.bonuses.map((b: any) => b.title || b.name || b).join(', ')}`);
    }
    lines.push('');

    // 8. PÚBLICO
    if (offerFacts.audience) {
      lines.push('## 5. PÚBLICO & AVATAR');
      lines.push('Source: DOSSIER / AI_ANALYSIS');
      lines.push('');
      lines.push(`- Dores Principais: ${offerFacts.audience.pains || 'N/A'}`);
      lines.push(`- Desejos Centrais: ${offerFacts.audience.desires || 'N/A'}`);
      lines.push(`- Objeções Conhecidas: ${offerFacts.audience.objections || 'N/A'}`);
      lines.push('');
    }

    // 9. COPY
    lines.push('## 6. COPY & HEADLINES');
    lines.push('Source: DOSSIER');
    lines.push('');
    lines.push(`- Headline: "${offerFacts.headline || 'N/A'}"`);
    if (offerFacts.subheadline) lines.push(`- Subheadline: "${offerFacts.subheadline}"`);
    if (offerFacts.cta) lines.push(`- Chamada para Ação (CTA): "${offerFacts.cta}"`);
    lines.push('');
  }

  // 10. LANDING PAGE
  lines.push('## 7. LANDING PAGE');
  lines.push('Source: MAPPER');
  lines.push('');
  if (landingPageFacts && landingPageFacts.status === 'MAPPED') {
    lines.push(`- URL: ${landingPageFacts.url || 'N/A'}`);
    lines.push(`- Status: MAPPED`);
    lines.push(`- Mapped At: ${landingPageFacts.mappedAt || 'N/A'}`);
    lines.push(`- Hero Headline: "${landingPageFacts.heroHeadline || 'N/A'}"`);
    if (landingPageFacts.sections) {
      lines.push(`- Seções Identificadas: ${landingPageFacts.sections.length}`);
    }
  } else {
    lines.push(`- Status: NOT_MAPPED`);
    lines.push(`- URL Conhecida: ${offerFacts?.landing_page_url || 'N/A'}`);
    lines.push('- Observação: A Landing Page ainda não foi mapeada pelo Offer Miner. Conteúdo não foi inventado.');
  }
  lines.push('');

  // 11. CHECKOUT
  lines.push('## 8. CHECKOUT');
  lines.push('Source: MAPPER / DOSSIER');
  lines.push('');
  if (checkoutFacts && checkoutFacts.status === 'MAPPED') {
    lines.push(`- Checkout URL: ${checkoutFacts.url || 'N/A'}`);
    lines.push(`- Discovery Status: FOUND`);
    lines.push(`- Mapping Status: MAPPED`);
    lines.push(`- Preço de Entrada: R$ ${checkoutFacts.frontPrice || 'N/A'}`);
    lines.push(`- Order Bumps (${checkoutFacts.orderBumps?.length || 0}): ${checkoutFacts.orderBumps ? checkoutFacts.orderBumps.map((b: any) => b.title).join(', ') : 'Nenhum bump identificado'}`);
  } else {
    lines.push(`- Checkout URL: ${offerFacts?.checkout_url || 'N/A'}`);
    lines.push(`- Discovery Status: ${offerFacts?.checkout_discovery_status || 'NOT_PROCESSED'}`);
    lines.push(`- Mapping Status: ${offerFacts?.checkout_mapping_status || 'NOT_MAPPED'}`);
    lines.push(`- Order Bumps: UNKNOWN (Checkout ainda não foi mapeado pelo Offer Miner. Tratar como desconhecido e não como ausência.)`);
  }
  lines.push('');

  // 12. CRIATIVOS & MÍDIAS
  if (creativesFacts && creativesFacts.length > 0) {
    lines.push('## 9. CRIATIVOS & MÍDIAS');
    lines.push('Source: CREATIVE_INTELLIGENCE');
    lines.push('');
    creativesFacts.forEach((c, idx) => {
      lines.push(`### Creative #${idx + 1} (${c.creativeId || c.id})`);
      lines.push(`- Tipo: ${c.mediaType || 'Vídeo'}`);
      lines.push(`- Duração: ${c.durationSeconds ? `${c.durationSeconds}s` : 'N/A'}`);
      lines.push(`- Anúncios Associados: ${c.associatedAdsCount || 1}`);
      lines.push(`- Primeira Veiculação: ${c.earliestSeenAdDate || c.earliestSeen || 'N/A'}`);
      if (c.hookAnalysis) {
        lines.push(`- Hook Verbatim: "${c.hookAnalysis.verbatimHook}" [${c.hookAnalysis.evidenceTimestamps || '00:00'}]`);
        lines.push(`- Tipo de Hook: ${c.hookAnalysis.hookType || 'N/A'}`);
      }
      if (c.transcript && c.transcript.fullText) {
        lines.push(`- Transcrição: "${c.transcript.fullText}"`);
      }
      if (c.sceneTimeline && Array.isArray(c.sceneTimeline)) {
        lines.push('- Linha do Tempo de Cenas:');
        c.sceneTimeline.forEach((s: any) => {
          lines.push(`  * [${s.start}-${s.end}] ${s.visualDescription} (Propósito: ${s.purposeInAd})`);
        });
      }
      lines.push('');
    });
  }

  // 13. DEEP DIVE / INSIGHTS / NOTAS
  if (insightsAndNotes && insightsAndNotes.length > 0) {
    lines.push('## 10. INSIGHTS & HYPOTHESES');
    lines.push('Source: USER_NOTE / AI_ANALYSIS');
    lines.push('');
    insightsAndNotes.forEach((item) => {
      lines.push(`- [${item.type.toUpperCase()}] ${item.title}: ${item.content}`);
    });
    lines.push('');
  }

  // 14. DATA AVAILABILITY MAP
  if (availability) {
    lines.push('## 11. DATA AVAILABILITY');
    lines.push('Source: SYSTEM_AUDIT');
    lines.push('');
    lines.push('| Component | Status | Details |');
    lines.push('| --- | --- | --- |');
    lines.push(`| Landing Page | ${availability.landingPage} | Preservado estado real |`);
    lines.push(`| Checkout | ${availability.checkout} | Preservado estado real |`);
    lines.push(`| Creatives | ${availability.creatives} | Mídias capturadas |`);
    lines.push(`| Audience | ${availability.audience} | Dores e desejos |`);
    lines.push(`| History | ${availability.history} | Snapshots gravados |`);
    lines.push(`| Copy Structure | ${availability.copy} | Headlines e promessas |`);
    lines.push('');
  }

  // 15. SOURCES LIST
  if (sources && sources.length > 0) {
    lines.push('## 12. SOURCES USED');
    lines.push('Source: PROVENANCE_TRACKER');
    lines.push('');
    sources.forEach((s) => {
      lines.push(`- [${s.type.toUpperCase()}] ${s.title} (ID: ${s.id}) ${s.provenance ? `• Provenance: ${s.provenance}` : ''}`);
    });
    lines.push('');
  }

  // 16. CONVERSATION THREAD
  if (conversation && conversation.length > 0) {
    lines.push('## CONVERSATION');
    lines.push('');
    conversation.forEach((msg) => {
      const roleUpper = msg.role.toUpperCase();
      lines.push(`### ${roleUpper}`);
      lines.push('');
      lines.push(msg.content.trim());
      lines.push('');
      if (msg.provider || msg.model) {
        lines.push(`*Generated by: ${msg.provider ? msg.provider.toUpperCase() : 'AI'} ${msg.model ? `(${msg.model})` : ''}*`);
        lines.push('');
      }
    });
  }

  return sanitizeText(lines.join('\n'));
}

/**
 * Deterministic JSON Exporter Renderer
 */
export function renderJSONPackage(rawPkg: AIContextPackage): string {
  const sanitized = sanitizeObject(rawPkg);
  return JSON.stringify(sanitized, null, 2);
}
