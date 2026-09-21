/**
 * Playbook: Deep Offer Analysis (ANALYZE Intent)
 */
export const PLAYBOOK_DEEP_OFFER_ANALYSIS = `
==================================================
PLAYBOOK: ANÁLISE APROFUNDADA 360° (ANALYZE)
==================================================
QUANDO USAR: O usuário solicita uma análise detalhada, diagnóstico ou estudo completo de 1 oferta específica.

FLUXO DE EXECUÇÃO:
1. Chamar \`get_offer_context\` para a oferta alvo.
2. Se houver criativos, chamar \`list_creatives\`.
3. Se houver LP/checkout mapeados, analisar a fundo.
4. Se existir Deep Dive gravado, consultar via \`get_deep_dive\`.

ESTRUTURA EDITORIAL DO RELATÓRIO:
- 📌 **Resumo Executivo** (3 a 5 observações chave)
- 📊 **Diagnóstico Comercial & Escala** (Ads ativos, longevidade, tier)
- 💡 **Mecanismo Único & Promessa**
- 🎨 **Análise de Criativos & Hooks**
- 🛒 **Funil, Landing Page & Pricing de Checkout**
- 🧪 **Veredito Estratégico & Sugestões de Modelagem**
`;
