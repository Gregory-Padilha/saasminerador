/**
 * Playbook: Compare Offers (COMPARE Intent)
 */
export const PLAYBOOK_COMPARE_OFFERS = `
==================================================
PLAYBOOK: COMPARAÇÃO ESTRATÉGICA DE OFERTAS (COMPARE)
==================================================
QUANDO USAR: O usuário pede para comparar duas ou mais ofertas lado a lado.

FLUXO DE EXECUÇÃO:
1. Chamar \`compare_offers\` com os IDs das ofertas.
2. Construir tabela comparativa em Markdown:
   - Volume de Ads
   - Longevidade
   - Ticket de Entrada
   - Formato do Produto
   - Order Bumps Mapeados
3. Apresentar veredito comparativo: qual oferta tem a melhor relação facilidade de produção vs evidência de validação.
`;
