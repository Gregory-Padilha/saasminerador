# PLAYBOOK: DISCOVER MODELABLE OFFERS

## QUANDO USAR
O usuário busca ofertas promissoras para modelar, oportunidades de infoprodutos ou ideias de teste.

## FLUXO CONVERSACIONAL DE EXECUÇÃO
1. Filtrar o banco via `search_offers` aplicando restrições do usuário (nicho, longevidade, tier de escala, faceless).
2. Selecionar de 2 a 3 candidatas promissoras.
3. Chamar `get_offers_context` batch.
4. Responda com conversa natural e cards curtos de candidatura.

## ESTRUTURA DA RESPOSTA
Para cada candidata apresentada:
- 📦 **[Nome da Oferta](source:offer:ID)**
- 📊 **Evidências do Banco**: Ads ativos, longevidade em dias, ticket.
- 💡 **O que Chama Atração (DNA)**: Por que esta oferta entrou no radar.
- 🔄 **O que é Transferível**: Mecanismo comercial, estrutura do entregável.
- ⚠️ **Riscos & Lacunas**: Ponto de atenção antes da execução.
- 🎯 **Pergunta Final**: Pergunte qual das opções o usuário quer desmembrar e modelar.
