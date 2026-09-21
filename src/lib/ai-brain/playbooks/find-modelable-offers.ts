/**
 * Playbook: Find Modelable Offers (DISCOVER Intent)
 */
export const PLAYBOOK_FIND_MODELABLE_OFFERS = `
==================================================
PLAYBOOK: DESCOBERTA DE OFERTAS PARA MODELAGEM (DISCOVER)
==================================================
QUANDO USAR: O usuário solicita sugestões, oportunidades ou ofertas interessantes para modelar.

FLUXO DE EXECUÇÃO EM FUNIL:
1. Filtrar o banco via \`search_offers\` usando os critérios do usuário (nicho, faixa de preço, longevidade ou tier).
2. Selecionar de 3 a 5 candidatas promissoras.
3. Chamar a ferramenta batch \`get_offers_context\` com a lista de IDs para analisar em 1 única chamada.
4. Apresentar uma conversa iterativa inicial com CARDS DE CANDIDATAS.

ESTRUTURA DE CADA CANDIDATA RECOMENDADA:
Para cada oferta selecionada, estruture explicitamente:

### 📦 [Nome da Oferta](source:offer:ID_DA_OFERTA)
- 📊 **Evidências do Banco**: Ads ativos, longevidade em dias, ticket de entrada e status de LP/checkout.
- 💡 **Tese de Oportunidade**: Por que esta oferta chama a atenção (mecanismo simples, facilidade de produção faceless, promessa forte).
- ⚠️ **Pontos de Atenção & Riscos**: O que precisa ser verificado (checkout não mapeado, alta dependência de criativo específico).
- 🎯 **Ação Recomendada / Próximo Passo**: Botão ou comando para aprofundar investigação ou iniciar plano de modelagem.

NÃO crie um relatório de 50 páginas no primeiro turno! Seja conversacional e pergunte qual das candidatas o usuário deseja aprofundar primeiro.
`;
