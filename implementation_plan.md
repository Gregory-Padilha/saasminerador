# Plano de Reorientação do OFFER MINER — Central de Mineração & Inteligência

Reorientação completa do **OFFER MINER** de um sistema de "julgamento/score de ofertas" para uma verdadeira **Central de Mineração, Inteligência e Dossiê de Operações** (estilo Similarweb / Semrush / Meta Ads Intelligence para low-ticket).

O sistema **não dá notas (0–100), não julga qualidade, não calcula ROI e não decide se a oferta é boa**. Ele **coleta, organiza, armazena, destrincha, compara, acompanha e pesquisa fatos reais**. O usuário decide o que é interessante.

---

## 1. Mudanças Arquiteturais Centrais

### A. Remoção Completa de Scores e Julgamentos
- **Eliminar totalmente da UI e do fluxo**:
  - `Discovery Score` (e popovers / badges)
  - `Momentum Score` (e notas 0–100)
  - `Opportunity Score` (e fórmulas 70/30)
  - `Work Score / 100` e rankings de "melhor oportunidade"
  - Julgamento de validação (`VALIDADA`, `INVÁLIDA`, `FORA_DOS_CRITERIOS`) como selo de qualidade
- **Desativar funções de scoring**:
  - Deprecar `calculateDiscoveryScore`, `calculateMomentumScore`, `calculateOpportunityScore`.
  - Scores antigos no banco ficam depreciados sem quebrar registros existentes.

### B. Novos Status de Pesquisa (`status_pesquisa`)
Substituir o conceito de "validada/inválida" por status de fluxo de trabalho do pesquisador:
- `NOVA`: Acabou de entrar no banco
- `DADOS_PARCIAIS`: Faltam informações básicas
- `MAPEADA`: Principais informações coletadas
- `ANALISADA`: Dossiê completo preenchido
- `ACOMPANHANDO`: Em observação temporal
- `ARQUIVADA`: Fora do radar de trabalho atual

### C. Completude do Dossiê (Métrica Factual)
- Indicador objetivo de preenchimento: ex: `Dossiê: 72% completo (11/15 campos preenchidos)`.
- Tooltip: *"Representa apenas a completude das informações coletadas pelo minerador."*

---

## 2. Navegação Reestruturada (Sidebar)

- **VISÃO GERAL**
  - Dashboard (`/`)
- **MINERAÇÃO**
  - Ofertas (`/offers`)
  - Importações (`/imports`)
  - Radar (`/radar`) *(novo, substituindo Oportunidades)*
- **INTELIGÊNCIA**
  - Nichos (`/niches`)
  - Comparar (`/compare`)
  - Acompanhando (`/watchlist`)
- **PESQUISA**
  - Favoritas (`/favorites`)
  - Deep Dives (`/deep-dives`)
- **SISTEMA**
  - Configurações (`/settings`)

---

## 3. Dossiê da Oferta (`/offers/[id]`) — O Coração do Sistema

A página individual se torna o **Dossiê Completo da Operação**:

1. **Header da Oferta**:
   - Nome, Anunciante, Nicho > Subnicho, Tipo de Produto, Status de Pesquisa, Favoritar, Acompanhar, Deep Dive.
   - Botões de Ação Direta: `Abrir Meta Ads Library`, `Abrir Landing Page`, `Abrir Checkout`, `Editar Dossiê`.
2. **KPIs Factuais (Barra Superior)**:
   - Preço Front-end, Ads Ativos, Criativos Distintos, Dias Rodando, Operação Faceless, Primeiro Anúncio, Última Captura.
3. **11 Abas Especializadas**:
   - **Visão Geral**: Produto & Entrega + Posicionamento (Headline, Subheadline, Promessa, Problema, Mecanismo, Big Idea) + Dossiê de Completude.
   - **Anunciante**: Perfil do anunciante (Página, Instagram, Site, Meta Ads Library URL, 1ª e última captura) + **Outras Ofertas desse Anunciante no Banco**.
   - **Criativos**: Galeria de thumbnails e mídias, Lista de Hooks Encontrados, Lista de Ângulos de Venda (Dor, Curiosidade, etc.), Resumo de Variações Criativas.
   - **Landing Page**: Tipo de LP (Sales Page, VSL, Advertorial, Quiz, etc.), Estrutura da LP (Hero, Problema, Solução, Benefícios, Entregáveis, Prova, Bônus, FAQ, etc.), Screenshots por seção.
   - **Oferta**: Front-end, Entregáveis detalhados, Bônus, Garantia, Order Bumps, Upsells, Downsells, Diagrama Visual da Esteira Comercial (Front $\rightarrow$ Bump $\rightarrow$ Upsell).
   - **Funil**: Sequência visual do funil (Ads $\rightarrow$ LP $\rightarrow$ Checkout $\rightarrow$ Bump $\rightarrow$ Upsell) + Plataforma de Checkout identificada (Kiwify, Hotmart, PerfectPay, Monetizze, Kirvano, Stripe, etc.).
   - **Histórico**: Fatos matemáticos cronológicos ($\Delta$ Ads, $\%$ de variação), Descrição de tendência simples ("Ads aumentando", "Ads estáveis", "Ads diminuindo", "Sem histórico"), Gráficos temporais de Ads, Preço e Criativos.
   - **Copy**: Registro objetivo de headlines, hooks, texto principal dos anúncios, promessas, CTAs, objeções e gatilhos identificados.
   - **Público**: Perfil do comprador, problema, desejo, contexto de compra, nível de consciência, linguagem.
   - **Notas**: Bloco manual para anotações e hipóteses do usuário.
   - **Dados Originais**: Visualizador completo de `raw_data` e `extra_data` importados da planilha.

---

## 4. Dashboard Factural (`/`)

- **StatCards Superiores**: Total de Ofertas, Ofertas Novas 7D, Em Acompanhamento, Deep Dives, Favoritas, Média de Ads, Preço Médio.
- **Painéis de Inteligência Real**:
  - *Top Nichos & Subnichos*
  - *Tipos de Produto Mais Encontrados* (Ebook, Printable, Mega Pack, Cards, Planner, etc.)
  - *Distribuição de Preço, Ads Ativos e Tempo Rodando*
  - *Formatos de Criativos Mais Utilizados*
  - *Mudanças Recentes no Banco* (ex: Oferta X $+7$ ads, Oferta Y preço ajustado, Oferta Z $+6$ criativos)
  - *Novas Ofertas Recém Importadas*
  - *Anunciantes Mais Ativos* (maior catálogo no banco)

---

## 5. Radar de Ofertas (`/radar`)

- Substitui a antiga página de Oportunidades por uma central de filtros facetados.
- **Filtros Rápidos**: 10–30 dias, 20+ Ads, 30+ Ads, R$20–30, R$30–40, Faceless, Com LP, Com Checkout, Com Bônus, Com Upsell, Acompanhando, Sem Deep Dive.
- **Ordenação Objetiva**: Mais recentes, Mais antigas, Mais Ads, Menos Ads, Maior preço, Menor preço, Mais dias rodando, Mais criativos, Última captura, Nome.

---

## 6. Ajustes nas Demais Telas

- **Comparador (`/compare`)**: Matriz comparando 18 dimensões factuais (Produto, Nicho, Tipo, Preço, Ads, Criativos, Dias, Faceless, Anunciante, Headline, Promessa, Formato, Garantia, Bônus, Order Bumps, Upsells, Tipo de LP, Checkout).
- **Nichos (`/niches`)**: Métricas consolidadas (Volume, Preço médio, Média de Ads, Dias médio, Tipos de produto, Formatos, Anunciantes).
- **Acompanhando (`/watchlist`)**: Colunas objetivas de Produto, Última captura, Ads atual, Ads anterior, Variação Delta e %, Dias, Tendência descritiva.
- **Deep Dives (`/deep-dives`)**: Status do fluxo de pesquisa profunda e percentual de completude do dossiê.
- **Configurações (`/settings`)**: Filtros e parâmetros de mineração da estratégia.

---

## 7. Plano de Verificação

### Testes Automatizados
- Executar build de produção (`npm run build`) para validar 100% de integridade em todas as rotas.
- Testes unitários para completude do dossiê, detecção de mudanças em snapshots e persistência de dados.

### Verificação Manual
- Navegar pelas rotas `/`, `/offers`, `/offers/[id]`, `/radar`, `/compare`, `/niches`, `/watchlist`, `/deep-dives`, `/imports`, `/settings`.
- Confirmar ausência total de pontuações arbitrárias, notas 0–100 e julgamentos "boa/ruim".
